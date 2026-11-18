// workflow-lua.ts — runtime Lua workflow engine.
//
// Loads workflows/*.lua at runtime (no compile). Each Lua script exposes
//   function run(profile)   -- calls host fns, then sets _result
// The script is expected to assign `_result = { ... }`; the host reads it back.
// Adding a workflow = drop a .lua + one row in workflows/workflows.toml. A
// broken script fails only when invoked, never at build time.
import { LuaFactory } from "wasmoon";
import { readFileSync, existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { runBinarySync } from "./tools/runner.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
export const WORKFLOW_DIR = join(__dirname, "..", "workflows");
// Small JSON fetch exposed to Lua (GET/POST, key-agnostic).
async function jsonFetch(url, opts) {
    const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const headers = {
        "content-type": "application/json",
        ...(opts.headers ?? {}),
    };
    const t0 = Date.now();
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const resp = await fetch(url, {
            method,
            headers,
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        const text = await resp.text();
        let parsed = text;
        try {
            parsed = text ? JSON.parse(text) : null;
        }
        catch { }
        return {
            ok: resp.ok,
            status: resp.status,
            latencyMs: Date.now() - t0,
            body: parsed,
            error: resp.ok ? undefined : text.slice(0, 800),
        };
    }
    catch (e) {
        return {
            ok: false,
            status: 0,
            latencyMs: Date.now() - t0,
            body: null,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}
// Convert an array argument passed from Lua into a string[]. wasmoon surfaces a
// Lua array/pair table as a live object whose numeric keys are array positions.
function luaArrayToArgs(v) {
    if (!v || typeof v !== "object")
        return [];
    const t = v;
    const out = [];
    // Dense numeric keys first (1-based).
    let i = 1;
    for (;;) {
        if (i in t) {
            const x = t[i];
            if (x === null || x === undefined)
                break;
            out.push(String(x));
            i++;
        }
        else {
            break;
        }
    }
    if (out.length > 0)
        return out;
    // Worst case: any enumerable values (e.g. a single string pushed at key 1).
    for (const k of Object.keys(t)) {
        const vv = t[k];
        if (typeof vv === "string" || typeof vv === "number")
            out.push(String(vv));
    }
    return out;
}
// Convert a Lua result table (proxy) into a plain JSON-able JS object.
function toPlain(v, depth = 0) {
    if (depth > 6)
        return null;
    if (v === null || v === undefined)
        return null;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean")
        return v;
    if (t === "function")
        return undefined;
    if (t === "object") {
        const o = v;
        // Lua arrays are 1-based dense numeric tables; probe 1..n before treating
        // this as a map (wasmoon proxies do not expose a `.length`).
        if (1 in o) {
            const arr = [];
            let i = 1;
            for (;;) {
                if (i in o) {
                    arr.push(toPlain(o[i], depth + 1));
                    i++;
                }
                else
                    break;
            }
            if (arr.length > 0)
                return arr;
        }
        const obj = {};
        for (const k of Object.keys(o)) {
            const val = toPlain(o[k], depth + 1);
            if (val !== undefined)
                obj[k] = val;
        }
        return obj;
    }
    return null;
}
// Load a workflow .lua and invoke run(profile). Returns the content of `_result`.
export async function runLuaWorkflow(luaFile, profile) {
    const path = join(WORKFLOW_DIR, luaFile);
    if (!existsSync(path))
        throw new Error(`workflow lua not found: ${luaFile}`);
    const factory = new LuaFactory();
    const lua = await factory.createEngine();
    lua.global.set("log", (...xs) => process.stderr.write("[den-lua] " + xs.map(String).join(" ") + "\n"));
    lua.global.set("parse_json", (s) => {
        if (typeof s !== "string")
            return {};
        try {
            const p = JSON.parse(s);
            return (p && typeof p === "object") ? p : {};
        }
        catch {
            return {};
        }
    });
    // json_fetch must be BLOCKING for Lua workflows (async host fn cannot be
    // awaited across the JS-invoked Lua boundary). Drive /usr/bin/curl directly
    // (no shell) as a synchronous fetch; see blockingJsonFetch below.
    function blockingJsonFetch(url, o) {
        // Robust blocking HTTP for Lua: drive /usr/bin/curl directly (no shell).
        // Body -> temp file (-o), status -> stdout via -w %{http_code}, so the two are
        // never mis-separated (curl exits 0 even for 4xx/5xx).
        const tmp = join(tmpdir(), "den-json-" + Date.now().toString(36));
        let httpCode = "0";
        try {
            const args = ["-sS", "-m", String(o.timeoutMs ?? 60000), "-o", tmp, "-w", "%{http_code}"];
            const headers = (o.headers ?? {});
            for (const k of Object.keys(headers))
                args.push("-H", `${k}: ${headers[k]}`);
            if (o.body !== undefined)
                args.push("-H", "content-type: application/json", "-d", JSON.stringify(o.body));
            args.push("-H", "accept: application/json", url);
            httpCode = String(execFileSync("/usr/bin/curl", args, {
                encoding: "utf8", timeout: (o.timeoutMs ?? 60000) + 5000, maxBuffer: 64 * 1024,
            })).trim() || "0";
        }
        catch (e) {
            const err = e?.stderr ? String(e.stderr) : e?.message ? String(e.message) : String(e);
            let body = null;
            try {
                const b = readFileSync(tmp, "utf8");
                body = b ? JSON.parse(b) : null;
            }
            catch { }
            try {
                unlinkSync(tmp);
            }
            catch { }
            return { ok: false, status: Number(httpCode) || 0, body, error: err.slice(0, 800) };
        }
        let body = null;
        try {
            const b = readFileSync(tmp, "utf8");
            if (b) {
                try {
                    body = JSON.parse(b);
                }
                catch {
                    body = b.slice(0, 800);
                }
            }
        }
        catch { }
        try {
            unlinkSync(tmp);
        }
        catch { }
        const status = Number(httpCode) || 0;
        return { ok: status >= 200 && status < 300, status, body, error: status >= 400 ? String(body ?? "").slice(0, 800) : undefined };
    }
    lua.global.set("json_fetch", (u, o) => blockingJsonFetch(String(u), (o ?? {})));
    lua.global.set("binary", (name, argsTable, optsTable) => {
        const args = luaArrayToArgs(argsTable);
        const opts = {};
        if (optsTable && typeof optsTable === "object") {
            const t = optsTable;
            if (typeof t.timeoutMs === "number")
                opts.timeoutMs = t.timeoutMs;
            if (typeof t.stdin === "string")
                opts.stdin = t.stdin;
        }
        // Sync executor: returns a plain object table to Lua (no Promise to unwrap).
        return runBinarySync(name, args, opts);
    });
    // Convenience: fully-parsed, FLAT dnsx records as strings "host ip TYPE", so
    // Lua stores a flat string array that serializes cleanly across Lua<->JS.
    lua.global.set("dns_records", (domainsTable, typesSpec) => {
        const domains = Array.isArray(domainsTable)
            ? domainsTable.map(String)
            : luaArrayToArgs(domainsTable);
        const types = typeof typesSpec === "string" && typesSpec ? typesSpec : "A,AAAA,CNAME,MX,NS,TXT";
        const flags = { A: "-a", AAAA: "-aaaa", CNAME: "-cname", MX: "-mx", NS: "-ns", TXT: "-txt", PTR: "-ptr", SOA: "-soa" };
        const args = ["-json", "-silent"];
        for (const t of types.split(",")) {
            const f = flags[t.trim().toUpperCase()];
            if (f && !args.includes(f))
                args.push(f);
        }
        const r = runBinarySync("dnsx", args, { timeoutMs: 120000, stdin: domains.join("\n") + "\n" });
        const out = [];
        for (const line of r.lines) {
            try {
                const p = JSON.parse(line);
                const host = p.host || p.name;
                if (!host)
                    continue;
                for (const [field, key] of Object.entries({ a: "A", aaaa: "AAAA", cname: "CNAME", mx: "MX", ns: "NS", txt: "TXT" })) {
                    const v = p[field];
                    const arr = Array.isArray(v) ? v : v !== undefined && v !== null ? [v] : [];
                    for (const x of arr)
                        out.push(`${host} ${String(x)} ${key}`);
                }
            }
            catch { }
        }
        return out;
    });
    lua.global.set("profile", profile);
    await lua.doString(readFileSync(path, "utf8"));
    const runFn = await lua.global.get("run");
    if (typeof runFn !== "function")
        throw new Error(`workflow ${luaFile} has no run(profile)`);
    await runFn(profile);
    const raw = await lua.global.get("_result");
    lua.global.close();
    const plain = toPlain(raw);
    if (plain && typeof plain === "object")
        return plain;
    return { ok: true, value: plain };
}
