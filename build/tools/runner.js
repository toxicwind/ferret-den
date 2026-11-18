import { spawn, execFileSync } from "child_process";
import { accessSync, constants, existsSync, mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
// ---------------------------------------------------------------------------
// Binary resolution — Pens-aware.
// PD_TOOLS_DIR defaults to $HOME/.pdtm/go/bin; SHUFFLEDNS_BIN to that dir.
// separate yote go/bin path. Per-binary override: PD_<NAME>_BIN
// (e.g. PD_HTTPX_BIN=/custom/path/httpx).
// ---------------------------------------------------------------------------
function home() {
    return process.env.HOME || process.env.USERPROFILE || ".";
}
export const PD_TOOLS_DIR = process.env.PD_TOOLS_DIR || `${home()}/.pdtm/go/bin`;
export const SHUFFLEDNS_BIN = process.env.SHUFFLEDNS_BIN || `${PD_TOOLS_DIR}/shuffledns`;
const binCache = new Map();
export function resolveBinary(name) {
    const cached = binCache.get(name);
    if (cached)
        return cached;
    const override = process.env[`PD_${name.toUpperCase()}_BIN`];
    const p = override || (name === "shuffledns" ? SHUFFLEDNS_BIN : join(PD_TOOLS_DIR, name));
    if (!existsSync(p)) {
        throw new Error(`kit member '${name}' not found at ${p} (set PD_${name.toUpperCase()}_BIN to override)`);
    }
    try {
        accessSync(p, constants.X_OK);
    }
    catch {
        throw new Error(`kit member '${name}' at ${p} is not executable`);
    }
    binCache.set(name, p);
    return p;
}
// ---------------------------------------------------------------------------
// Input guards. spawn() never uses a shell, so these are defense-in-depth:
// strip control chars / newlines, cap lengths and counts.
// ---------------------------------------------------------------------------
const CONTROL_RE = /[\0\r\n]/;
export function cleanList(items, maxItems = 1000, maxLen = 253) {
    const out = [];
    const seen = new Set();
    if (!Array.isArray(items))
        return out;
    for (const raw of items) {
        const s = String(raw).trim();
        if (!s || s.length > maxLen || CONTROL_RE.test(s))
            continue;
        if (seen.has(s))
            continue;
        seen.add(s);
        out.push(s);
        if (out.length >= maxItems)
            break;
    }
    return out;
}
export function cleanDomain(d) {
    const s = String(d ?? "").trim().toLowerCase();
    if (!s || s.length > 253 || !/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(s)) {
        throw new Error(`invalid domain: ${String(d)}`);
    }
    return s;
}
export function cleanPortSpec(p) {
    if (p == null || p === "")
        return undefined;
    const s = String(p).trim();
    if (!/^[0-9,\- ]+$/.test(s) || s.length > 200) {
        throw new Error(`invalid port spec: ${s}`);
    }
    return s;
}
export function runBinary(binary, args, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 300_000;
    return new Promise((resolve) => {
        let bin;
        try {
            bin = resolveBinary(binary);
        }
        catch (err) {
            resolve({
                lines: [],
                stderr: err instanceof Error ? err.message : String(err),
                exitCode: null,
                timedOut: false,
            });
            return;
        }
        const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
        const lines = [];
        let stderr = "";
        let remainder = "";
        let settled = false;
        let timedOut = false;
        const done = (exitCode) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (remainder.trim())
                lines.push(remainder);
            resolve({ lines, stderr, exitCode, timedOut });
        };
        const timer = setTimeout(() => {
            timedOut = true;
            stderr += `\n[timeout] killed after ${timeoutMs}ms`;
            child.kill("SIGKILL");
        }, timeoutMs);
        // Don't let the watchdog keep the MCP server alive by itself
        timer.unref?.();
        child.stdout.on("data", (d) => {
            remainder += d.toString();
            const parts = remainder.split("\n");
            remainder = parts.pop() ?? "";
            for (const p of parts)
                if (p.trim())
                    lines.push(p);
        });
        child.stderr.on("data", (d) => {
            stderr += d.toString();
            if (stderr.length > 64_000)
                stderr = stderr.slice(-64_000);
        });
        child.on("close", (code) => done(code));
        child.on("error", (err) => {
            stderr += `\n[spawn error] ${err.message}`;
            done(null);
        });
        if (opts.stdin != null) {
            child.stdin.write(opts.stdin);
        }
        child.stdin.end();
    });
}
// ---------------------------------------------------------------------------
// JSONL parsing helper: parse each line, keep what pick() accepts.
// ---------------------------------------------------------------------------
export function parseJsonl(lines, pick) {
    const out = [];
    const seen = new Set();
    for (const line of lines) {
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch {
            continue;
        }
        const item = pick(parsed);
        if (item == null)
            continue;
        const key = JSON.stringify(item);
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}
export function ok(payload) {
    return { ok: true, result: payload };
}
// ---------------------------------------------------------------------------
// Heavy-scan concurrency gate (grafted from Pens pd-mcp server.ts).
// Port/vuln/mass-bruteforce scans share a 2-slot cap; extras queue.
// ---------------------------------------------------------------------------
const HEAVY_TOOLS = new Set(["naabu", "nuclei", "shuffledns"]);
const HEAVY_LIMIT = 2;
class Semaphore {
    max;
    running = 0;
    queue = [];
    constructor(max) {
        this.max = max;
    }
    async acquire() {
        if (this.running < this.max) {
            this.running++;
            return;
        }
        await new Promise((res) => this.queue.push(res));
        this.running++;
    }
    release() {
        this.running--;
        const next = this.queue.shift();
        if (next)
            next();
    }
}
const heavySem = new Semaphore(HEAVY_LIMIT);
export function isHeavyTool(name) {
    return HEAVY_TOOLS.has(name);
}
/** Run fn under the heavy-scan gate if name is a heavy tool. */
export async function withHeavyGate(name, fn) {
    if (!isHeavyTool(name))
        return fn();
    await heavySem.acquire();
    try {
        return await fn();
    }
    finally {
        heavySem.release();
    }
}
// ---------------------------------------------------------------------------
// Startup binary check (grafted from Pens pd-mcp server.ts).
// Fail fast at launch with a clear message instead of failing mid-call.
// ---------------------------------------------------------------------------
const ALL_BINARIES = [
    "httpx",
    "dnsx",
    "shuffledns",
    "subfinder",
    "naabu",
    "nuclei",
    "katana",
    "tlsx",
];
export function checkAllBinaries() {
    const missing = [];
    for (const name of ALL_BINARIES) {
        try {
            resolveBinary(name);
        }
        catch (err) {
            missing.push(name + ": " + (err instanceof Error ? err.message : String(err)));
        }
    }
    if (missing.length > 0) {
        throw new Error("pd-mcp startup: " + missing.length + " binaries missing:\n  " + missing.join("\n  "));
    }
}
// ---------------------------------------------------------------------------
// runBinarySync — blocking sibling of runBinary, for the Lua workflow engine.
// Returns the SAME RunResult shape synchronously so Lua receives a plain table
// (wasmoon does not auto-unwrap an async host function's Promise into a table;
// this sidesteps that by resolving before crossing the boundary).
// ---------------------------------------------------------------------------
export function runBinarySync(binary, args, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 300_000;
    let bin;
    try {
        bin = resolveBinary(binary);
    }
    catch (err) {
        return {
            lines: [],
            stderr: err instanceof Error ? err.message : String(err),
            exitCode: null,
            timedOut: false,
        };
    }
    try {
        // dnsx requires hostnames as a FILE (-l), not stdin, on this box. When
        // stdin is supplied for dnsx, write it to a temp file and pass -l instead.
        let finalArgs = args;
        let cleanup = null;
        if (binary === "dnsx" && opts.stdin != null) {
            const d = mkdtempSync(join(tmpdir(), "dnsx-sync-"));
            const lf = join(d, "hosts.txt");
            writeFileSync(lf, opts.stdin);
            finalArgs = [...args, "-l", lf];
            cleanup = () => rmSync(d, { recursive: true, force: true });
        }
        const stdoutRaw = execFileSync(bin, finalArgs, {
            maxBuffer: 64 * 1024 * 1024,
            timeout: timeoutMs,
            encoding: "utf8",
            killSignal: "SIGKILL",
        });
        cleanup?.();
        return {
            lines: stdoutRaw ? stdoutRaw.split("\n").map((l) => l.trim()).filter(Boolean) : [],
            stderr: "",
            exitCode: 0,
            timedOut: false,
        };
    }
    catch (e) {
        const timed = typeof e?.killed === "boolean" && (e?.signal === "SIGKILL" || timedOutSignal(e));
        return {
            lines: [],
            stderr: e?.stderr ? String(e.stderr) : e?.message ? String(e.message) : String(e),
            exitCode: typeof e?.status === "number" ? e.status : null,
            timedOut: timed,
        };
    }
}
function timedOutSignal(e) {
    return e?.code === "ETIMEDOUT" || e?.signal === "SIGKILL";
}
