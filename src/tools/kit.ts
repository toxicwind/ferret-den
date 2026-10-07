import { runBinary, cleanList } from "./runner.js";

const KIT = new Set([
  "pdtm", "uncover", "notify", "proxify", "chaos", "cdncheck", "asnmap",
  "alterx", "mapcidr", "cloudlist", "tldfinder", "simplehttpserver", "aix",
]);

export async function executeKit(bin: string, target: string | undefined, extra: unknown) {
  if (!KIT.has(bin)) throw new Error(`not a kit bin: ${bin}`);
  const args = cleanList(extra, 20, 200);
  if (target && target.trim()) args.unshift(target.trim().slice(0, 300));
  const timeoutMs = bin === "simplehttpserver" ? 8_000 : 120_000;
  const r = await runBinary(bin, args, { timeoutMs });
  return {
    lines: r.lines.slice(0, 200),
    stderr: r.stderr.slice(-1500),
    exitCode: r.exitCode,
    timedOut: r.timedOut,
  };
}
