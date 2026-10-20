// workflow-lua.ts — runtime Lua workflow engine.
//
// Loads workflows/*.lua at runtime (no compile). Each Lua script exposes
//   function run(profile)   -- calls host fns, then sets _result
// The script is expected to assign `_result = { ... }`; the host reads it back.
// Adding a workflow = drop a .lua + one row in workflows/workflows.toml. A
// broken script fails only when invoked, never at build time.

import { LuaFactory } from "wasmoon";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { runBinary, runBinarySync } from "./tools/runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WORKFLOW_DIR = join(__dirname, "..", "workflows");

export type LuaWorkflowResult = Record<string, unknown>;

// Small JSON fetch exposed to Lua (GET/POST, key-agnostic).
async function jsonFetch(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: unknown; timeoutMs?: number }
): Promise<Record<string, unknown>> {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const headers: Record<string, string> = {
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
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {}
    return {
      ok: resp.ok,
      status: resp.status,
      latencyMs: Date.now() - t0,
      body: parsed,
      error: resp.ok ? undefined : text.slice(0, 800),
    };
  } catch (e) {
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
function luaArrayToArgs(v: unknown): string[] {
  if (!v || typeof v !== "object") return [];
  const t = v as Record<string, unknown>;
  const out: string[] = [];
  // Dense numeric keys first (1-based).
  let i = 1;
  for (;;) {
    if (i in t) {
      const x = t[i];
      if (x === null || x === undefined) break;
      out.push(String(x));
      i++;
    } else {
      break;
    }
  }
  if (out.length > 0) return out;
  // Worst case: any enumerable values (e.g. a single string pushed at key 1).
  for (const k of Object.keys(t)) {
    const vv = t[k];
    if (typeof vv === "string" || typeof vv === "number") out.push(String(vv));
  }
  return out;
}

// Convert a Lua result table (proxy) into a plain JSON-able JS object.
function toPlain(v: unknown, depth = 0): unknown {
  if (depth > 6) return null;
  if (v === null || v === undefined) return null;
  const t = typeof v;
  if (t === "string" || t === "number" || t === "boolean") return v;
  if (t === "function") return undefined;
  if (t === "object") {
    const o = v as Record<string, unknown>;
    // Lua arrays are 1-based dense numeric tables; probe 1..n before treating
    // this as a map (wasmoon proxies do not expose a `.length`).
    if (1 in o) {
      const arr: unknown[] = [];
      let i = 1;
      for (;;) {
        if (i in o) { arr.push(toPlain(o[i], depth + 1)); i++; } else break;
      }
      if (arr.length > 0) return arr;
    }
    const obj: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      const val = toPlain(o[k], depth + 1);
      if (val !== undefined) obj[k] = val;
    }
    return obj;
  }
  return null;
}

// Load a workflow .lua and invoke run(profile). Returns the content of `_result`.
export async function runLuaWorkflow(
  luaFile: string,
  profile: Record<string, unknown>
): Promise<LuaWorkflowResult> {
  const path = join(WORKFLOW_DIR, luaFile);
  if (!existsSync(path)) throw new Error(`workflow lua not found: ${luaFile}`);

  const factory = new LuaFactory();
  const lua = await factory.createEngine();

  lua.global.set("log", (...xs: unknown[]) =>
    process.stderr.write("[den-lua] " + xs.map(String).join(" ") + "\n")
  );
  lua.global.set("parse_json", (s: unknown) => {
    if (typeof s !== "string") return {};
    try {
      const p = JSON.parse(s);
      return (p && typeof p === "object") ? p : {};
    } catch {
      return {};
    }
  });
  lua.global.set("json_fetch", (u: string, o?: Record<string, unknown>) =>
    jsonFetch(u, (o ?? {}) as Record<string, unknown>)
  );
  lua.global.set("binary", (name: string, argsTable: unknown, optsTable?: Record<string, unknown>) => {
    const args = luaArrayToArgs(argsTable);
    const opts: { timeoutMs?: number; stdin?: string } = {};
    if (optsTable && typeof optsTable === "object") {
      const t = optsTable as Record<string, unknown>;
      if (typeof t.timeoutMs === "number") opts.timeoutMs = t.timeoutMs;
      if (typeof t.stdin === "string") opts.stdin = t.stdin;
    }
    // Sync executor: returns a plain object table to Lua (no Promise to unwrap).
    return runBinarySync(name, args, opts);
  });

// Convenience: fully-parsed, FLAT dnsx records as strings "host ip TYPE", so
// Lua stores a flat string array that serializes cleanly across Lua<->JS.
  lua.global.set("dns_records", (domainsTable: unknown, typesSpec: unknown) => {
    const domains = Array.isArray(domainsTable)
      ? domainsTable.map(String)
      : luaArrayToArgs(domainsTable);
    const types = typeof typesSpec === "string" && typesSpec ? typesSpec : "A,AAAA,CNAME,MX,NS,TXT";
    const flags: Record<string, string> = { A: "-a", AAAA: "-aaaa", CNAME: "-cname", MX: "-mx", NS: "-ns", TXT: "-txt", PTR: "-ptr", SOA: "-soa" };
    const args = ["-json", "-silent"];
    for (const t of types.split(",")) {
      const f = flags[t.trim().toUpperCase()];
      if (f && !args.includes(f)) args.push(f);
    }
    const r = runBinarySync("dnsx", args, { timeoutMs: 120000, stdin: domains.join("\n") + "\n" });
    const out: string[] = [];
    for (const line of r.lines) {
      try {
        const p = JSON.parse(line);
        const host = p.host || p.name;
        if (!host) continue;
        for (const [field, key] of Object.entries({ a: "A", aaaa: "AAAA", cname: "CNAME", mx: "MX", ns: "NS", txt: "TXT" })) {
          const v = p[field];
          const arr = Array.isArray(v) ? v : v !== undefined && v !== null ? [v] : [];
          for (const x of arr) out.push(`${host} ${String(x)} ${key}`);
        }
      } catch {}
    }
    return out;
  });

  lua.global.set("profile", profile);
  await lua.doString(readFileSync(path, "utf8"));
  const runFn = await lua.global.get("run");
  if (typeof runFn !== "function") throw new Error(`workflow ${luaFile} has no run(profile)`);
  await runFn(profile);
  const raw = await lua.global.get("_result");
  lua.global.close();
  const plain = toPlain(raw);
  if (plain && typeof plain === "object") return plain as LuaWorkflowResult;
  return { ok: true, value: plain };
}