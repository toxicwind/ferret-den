import { existsSync, mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { runBinary, withHeavyGate } from "./runner.js";

// ---------------------------------------------------------------------------
// den:sniff — read-only, rate-limited URL fuzzing via ffuf.
//
// Ferret overlay: the model sees `sniff`, the warren runs ffuf. Output is
// den-speak (status/endpoint only), JSON-parsed, never the raw ffuf stream.
// Gated by den-names (confirm:true) and shares the heavy-scan semaphore —
// fuzzing a host is every bit as load-bearing as port scanning.
// ---------------------------------------------------------------------------

// Wordlist home: the Warren ships a compact common-paths list as the default;
// operators may point PD_WORDLIST at a richer one (raft-small, etc.).
function defaultWordlist(): string {
  const override = process.env.PD_WORDLIST;
  if (override && existsSync(override)) return override;
  return join(homedir(), ".pdtm", "wordlists", "ferret-common.txt");
}

const EMBEDDED_COMMON = [
  "api", "v1", "v2", "v3", "graphql", "rest", "rpc", "health", "healthz",
  "readyz", "livez", "status", "metrics", "debug", "internal", "admin",
  "docs", "swagger", "openapi", "openapi.json", "swagger.json", "meta",
  "version", "config", "env", ".env", "login", "auth", "token", "keys",
  "key", "usage", "quota", "billing", "credits", "models", "model",
  "completions", "chat", "chat/completions", "responses", "embeddings",
  "fine-tune", "files", "upload", "uploads", "search", "agent", "agents",
  "tasks", "jobs", "logs", "cache", "storage", "s3", "download", "stream",
  "ws", "queue", "users", "user", "account", "profile", "me", "sessions",
  "refresh", "register", "signup", "password", "reset",
];

function ensureWordlist(): string {
  const wl = defaultWordlist();
  if (existsSync(wl)) return wl;
  const dir = join(homedir(), ".pdtm", "wordlists");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "ferret-common.txt"), EMBEDDED_COMMON.join("\n") + "\n");
  return join(dir, "ferret-common.txt");
}

export interface FuzzHit {
  status: number;
  url: string | null;
  length: number;
}

export interface FuzzResult {
  target: string;
  hits: FuzzHit[];
  attempted: number;
  timedOut: boolean;
  stdout: string[];
}

export async function executeFuzz(
  target: string,
  opts: { wordlist?: string; statuses?: string; rate?: number; threads?: number; timeoutMs?: number } = {},
): Promise<FuzzResult> {
  // target must already be clean & contain a FUZZ placeholder or a path base
  const base = cleanTarget(target);
  const wordlist = opts.wordlist || ensureWordlist();
  const statuses = opts.statuses || "200,201,401,403,405";
  const rate = Math.min(opts.rate ?? 150, 400); // hard cap — be polite
  const threads = Math.min(opts.threads ?? 12, 30);
  const timeoutMs = Math.min(opts.timeoutMs ?? 120_000, 300_000);

  const args = [
    "-u", base,
    "-w", wordlist,
    "-mc", statuses,
    "-fs", "0",
    "-t", String(threads),
    "-rate", String(rate),
    "-timeout", "5",
    "-of", "json",
  ];

  // ffuf writes its JSON result document to the -o FILE (not stdout — `-o -`
  // is literally a filename). Persist to a temp file, read back, then clean
  // up: the estate doctrine is "read results from a file, never exec stdout."
  const tdir = mkdtempSync(join(tmpdir(), "den-sniff-"));
  const outfile = join(tdir, "results.json");
  args.push("-o", outfile);

  // Heavy fuzz shares the 2-slot gate with naabu/nuclei/shuffledns.
  const r = await withHeavyGate("ffuf", () => runBinary("ffuf", args, { timeoutMs }));

  let hits: FuzzHit[] = [];
  try {
    const doc = JSON.parse(readFileSync(outfile, "utf8"));
    if (Array.isArray(doc.results)) {
      hits = doc.results.map((o: any) => ({ status: o.status, url: o.input?.FUZZ ?? null, length: o.length ?? 0 }));
    }
  } catch {
    // no results written (offline/no matches) — leave the hits array empty
  } finally {
    rmSync(tdir, { recursive: true, force: true });
  }

  return {
    target: base,
    hits,
    attempted: hits.length,
    timedOut: r.timedOut,
    stdout: r.lines.slice(0, 200),
  };
}

// Targets must be http(s) and include FUZZ (or a path base — we append FUZZ).
function cleanTarget(t: string): string {
  const s = String(t ?? "").trim();
  if (s.length > 300 || !/^https?:\/\//i.test(s)) {
    throw new Error(`invalid fuzz target: ${String(t)} (must be http(s)://host[/path])`);
  }
  if (s.includes("FUZZ")) return s;
  return s.endsWith("/") ? `${s}FUZZ` : `${s}/FUZZ`;
}

export { cleanTarget };