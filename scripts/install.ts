#!/usr/bin/env bun
/**
 * ferret-den auto-installer — first-class (2026-10-15).
 *
 * Installs every binary the den:* jobs execute, so the MCP server never
 * fails on a missing binary at call time. Resolution order per binary:
 *   1. PATH (already resolvable)
 *   2. pdtm catalog  -> `pdtm -install <bin>` (lands in ~/.pdtm/go/bin)
 *   3. go install fallback for binaries pdtm no longer carries
 *      (chaos = legacy chaos-client; GOBIN=~/.pdtm/go/bin)
 *
 * Modes:
 *   bun scripts/install.ts            # install everything missing
 *   bun scripts/install.ts --check    # verify only; exit 1 if anything missing
 *   bun scripts/install.ts --check --quiet   # silent verify for CI/health
 */

import { readdirSync, existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();
const PD_BIN = join(HOME, ".pdtm", "go", "bin");
const ROOT = join(import.meta.dir, "..");

// Extract the authoritative binary set from src/den-names.ts (static mapping
// is the single source of truth for what the server can execute).
const denNames = readFileSync(join(ROOT, "src", "den-names.ts"), "utf8");
// Internal composite workflows live in src/index.ts and execute other kit
// binaries — den-names.ts lists them under `bin:` but no external binary
// exists (e.g. den:raid). Exclude them from installer requirements.
const INTERNAL_WORKFLOWS = new Set(["bug_bounty_workflow", "recon_workflow"]);
const REQUIRED = [...new Set([...denNames.matchAll(/bin:\s*"([a-z0-9_-]+)"/g)].map((m) => m[1]))]
  .filter((b) => !INTERNAL_WORKFLOWS.has(b))
  .sort();

// pdtm does not carry every legacy binary; these fall back to `go install`.
const GO_FALLBACK: Record<string, { pkg: string; env?: Record<string, string> }> = {
  chaos: { pkg: "github.com/projectdiscovery/chaos-client/cmd/chaos" },
  // simplehttpserver had a Go module rename; pdtm carries it, but keep a
  // fallback path in case the catalog moves again.
  simplehttpserver: { pkg: "github.com/projectdiscovery/simplehttpserver/cmd/simplehttpserver" },
};

const check = Bun.argv.includes("--check");
const quiet = Bun.argv.includes("--quiet");
const err = (m: string) => console.error(m);

function resolvable(bin: string): string | null {
  if (existsSync(join(PD_BIN, bin))) return join(PD_BIN, bin);
  try {
    const out = Bun.spawnSync(["bash", "-lc", `command -v ${bin}`]);
    const p = out.stdout.toString().trim();
    return p || null;
  } catch {
    return null;
  }
}

const missing: string[] = [];
const present: string[] = [];
for (const bin of REQUIRED) {
  const p = resolvable(bin);
  if (p) present.push(bin);
  else missing.push(bin);
}

if (quiet && check) {
  process.exit(missing.length ? 1 : 0);
}

console.log(`# ferret-den auto-installer — ${REQUIRED.length} binaries required`);
console.log(`# present: ${present.length}  missing: ${missing.length}${missing.length ? " -> " + missing.join(", ") : ""}`);

if (check) {
  process.exit(missing.length ? 1 : 0);
}

for (const bin of missing) {
  err(`[install] ${bin} ...`);
  // 1) pdtm
  const pdtm = resolvable("pdtm") ?? join(HOME, "go", "bin", "pdtm");
  if (existsSync(pdtm)) {
    const r = Bun.spawnSync([pdtm, "-install", bin], { stdout: "pipe", stderr: "pipe" });
    if (existsSync(join(PD_BIN, bin))) {
      err(`[install] ${bin}: OK (pdtm)`);
      continue;
    }
    if (r.exitCode !== 0 && !GO_FALLBACK[bin]) {
      err(`[install] ${bin}: pdtm failed: ${r.stderr.toString().split("\n").slice(-2).join(" ").slice(0, 200)}`);
    }
  } else {
    err(`[install] pdtm not found (${pdtm}); using go install fallback for ${bin}`);
  }
  // 2) go install fallback
  const fb = GO_FALLBACK[bin];
  if (fb) {
    const env = { ...process.env, GOBIN: PD_BIN };
    const r = Bun.spawnSync(["go", "install", `${fb.pkg}@latest`], { env, stdout: "pipe", stderr: "pipe" });
    if (existsSync(join(PD_BIN, bin))) {
      err(`[install] ${bin}: OK (go install)`);
      continue;
    }
    err(`[install] ${bin}: go install failed: ${r.stderr.toString().split("\n").slice(-3).join(" ").slice(0, 300)}`);
    process.exitCode = 1;
    continue;
  }
  err(`[install] ${bin}: no resolver available (not in pdtm catalog, no go fallback)`);
  process.exitCode = 1;
}

const stillMissing = REQUIRED.filter((b) => !resolvable(b));
console.log(`# done — ${REQUIRED.length - stillMissing.length}/${REQUIRED.length} resolve${stillMissing.length ? ", still missing: " + stillMissing.join(", ") : ""}`);
if (stillMissing.length) process.exit(1);
