#!/usr/bin/env bun
/**
 * ferret-den kit installer — first-class (2026-10-15).
 *
 * THE OVERLAY IS ABSOLUTE: user-facing strings speak DEN names only.
 * The underlying binary names and upstream vendor identities are internal
 * resolution details and never appear in logs or output (the same doctrine
 * that keeps binary names out of the tools/list catalog).
 *
 * Resolution order per kit member (all den names):
 *   1. bin dir (PD_TOOLS_DIR, default ~/.pdtm/go/bin)
 *   2. PATH
 *   3. keeper pass   — the catalog manager (gated behind its den name)
 *   4. graft pass    — compile-from-source fallback for kit members the
 *                      catalog manager no longer carries
 *
 * Modes:
 *   bun scripts/install.ts            # install everything missing
 *   bun scripts/install.ts --check    # verify only; exit 1 if anything missing
 *   bun scripts/install.ts --check --quiet   # silent verify for CI/health
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();
const ROOT = join(import.meta.dir, "..");
const BIN_DIR = process.env.PD_TOOLS_DIR || join(HOME, ".pdtm", "go", "bin");

// den -> underlying identity. INTERNAL ONLY: never printed.
// (If you are reading this file to learn vendor names, note the design
// deliberately keeps them out of the runtime interface.)
const OVERLAY: Record<string, { catalog: string; graft?: string }> = {
  subfinder: { catalog: "subfinder" },
  dnsx: { catalog: "dnsx" },
  httpx: { catalog: "httpx" },
  nuclei: { catalog: "nuclei" },
  naabu: { catalog: "naabu" },
  katana: { catalog: "katana" },
  tlsx: { catalog: "tlsx" },
  shuffledns: { catalog: "shuffledns" },
  uncover: { catalog: "uncover" },
  tldfinder: { catalog: "tldfinder" },
  cdncheck: { catalog: "cdncheck" },
  asnmap: { catalog: "asnmap" },
  alterx: { catalog: "alterx" },
  mapcidr: { catalog: "mapcidr" },
  cloudlist: { catalog: "cloudlist" },
  notify: { catalog: "notify" },
  proxify: { catalog: "proxify" },
  simplehttpserver: { catalog: "simplehttpserver", graft: "github.com/projectdiscovery/simplehttpserver/cmd/simplehttpserver" },
  aix: { catalog: "aix" },
  chaos: { graft: "github.com/projectdiscovery/chaos-client/cmd/chaos" },
  pdtm: { catalog: "pdtm" },
  ffuf: { graft: "github.com/ffuf/ffuf/v2" },
};

// Composite workflows are implemented in src/index.ts — no external binary.
const INTERNAL_WORKFLOWS = new Set(["bug_bounty_workflow", "recon_workflow"]);

const denNames = readFileSync(join(ROOT, "src", "den-names.ts"), "utf8");
const REQUIRED = [...new Set([...denNames.matchAll(/bin:\s*"([a-z0-9_-]+)"/g)].map((m) => m[1]))]
  .filter((b) => !INTERNAL_WORKFLOWS.has(b) && OVERLAY[b])
  .sort();

const check = Bun.argv.includes("--check");
const quiet = Bun.argv.includes("--quiet");
const err = (m: string) => console.error(m);

function resolvable(member: string): string | null {
  if (existsSync(join(BIN_DIR, member))) return join(BIN_DIR, member);
  try {
    const out = Bun.spawnSync(["bash", "-lc", `command -v ${member}`]);
    const p = out.stdout.toString().trim();
    return p || null;
  } catch {
    return null;
  }
}

const missing: string[] = [];
let presentCount = 0;
for (const member of REQUIRED) {
  if (resolvable(member)) presentCount++;
  else missing.push(member);
}

if (quiet && check) process.exit(missing.length ? 1 : 0);

console.log(`# den kit — ${REQUIRED.length} members required`);
console.log(`# present: ${presentCount}  missing: ${missing.length}${missing.length ? " -> " + missing.join(", ") : ""}`);

if (check) process.exit(missing.length ? 1 : 0);

const keeper = resolvable("keeper") || resolvable("pdtm");
for (const member of missing) {
  err(`[kit] fetching ${member} ...`);
  let ok = false;
  if (keeper && existsSync(keeper) && OVERLAY[member]?.catalog) {
    const r = Bun.spawnSync([keeper, "-install", OVERLAY[member].catalog], { stdout: "pipe", stderr: "pipe" });
    ok = existsSync(join(BIN_DIR, member));
    if (!ok && r.exitCode !== 0 && !OVERLAY[member].graft) {
      err(`[kit] ${member}: catalog manager failed: ${r.stderr.toString().split("\n").slice(-2).join(" ").slice(0, 200)}`);
    }
  }
  if (!ok && OVERLAY[member]?.graft) {
    const r = Bun.spawnSync(["go", "install", `${OVERLAY[member].graft}@latest`], {
      env: { ...process.env, GOBIN: BIN_DIR }, stdout: "pipe", stderr: "pipe",
    });
    ok = existsSync(join(BIN_DIR, member));
    if (!ok) err(`[kit] ${member}: graft failed: ${r.stderr.toString().split("\n").slice(-3).join(" ").slice(0, 300)}`);
  }
  if (!ok) {
    err(`[kit] ${member}: unresolved (no catalog entry, no graft path)`);
    process.exitCode = 1;
  } else {
    err(`[kit] ${member}: fetched`);
  }
}

const stillMissing = REQUIRED.filter((m) => !resolvable(m));
console.log(`# done — ${REQUIRED.length - stillMissing.length}/${REQUIRED.length} resolve${stillMissing.length ? ", still missing: " + stillMissing.join(", ") : ""}`);
if (stillMissing.length) process.exit(1);
