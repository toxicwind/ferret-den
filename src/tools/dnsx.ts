import { runBinary, cleanList } from "./runner.js";

export interface DnsxResult {
  resolved: Array<{ domain: string; ip: string; type: string }>;
  count: number;
  error?: string;
}

const RECORD_FLAGS: Record<string, string> = {
  A: "-a",
  AAAA: "-aaaa",
  CNAME: "-cname",
  NS: "-ns",
  TXT: "-txt",
  MX: "-mx",
  PTR: "-ptr",
  SOA: "-soa",
};

export function dnsFlag(recordType?: string): { flag: string; field: string } {
  const key = String(recordType || "A").trim().toUpperCase();
  const flag = RECORD_FLAGS[key];
  if (!flag) throw new Error(`unsupported record type: ${recordType}`);
  return { flag, field: key.toLowerCase() };
}

export async function executeDnsx(
  domains: string[],
  recordType?: string,
  resolvers?: string[]
): Promise<DnsxResult> {
  const list = cleanList(domains);
  if (list.length === 0) return { resolved: [], count: 0, error: "no valid domains" };
  const { flag, field } = dnsFlag(recordType);
  const args = ["-json", "-silent", flag];
  const resolversClean = (resolvers ?? []).map((r) => String(r).trim()).filter((r) => /^[0-9a-fA-F.:]+$/.test(r));
  if (resolversClean.length > 0) args.push("-r", resolversClean.join(","));
  const r = await runBinary("dnsx", args, {
    timeoutMs: 300_000,
    stdin: list.join("\n") + "\n",
  });
  const resolved: Array<{ domain: string; ip: string; type: string }> = [];
  const seen = new Set<string>();
  for (const line of r.lines) {
    let p: any;
    try { p = JSON.parse(line); } catch { continue; }
    const host = p.host || p.name;
    const values = Array.isArray(p[field]) ? p[field] : p[field] ? [p[field]] : [];
    if (!host || values.length === 0) continue;
    for (const value of values) {
      const answer = String(value);
      const key = `${host}|${field}|${answer}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push({ domain: String(host), ip: answer, type: field.toUpperCase() });
    }
  }
  if (r.exitCode !== 0 && resolved.length === 0) {
    return { resolved: [], count: 0, error: `dnsx failed (exit ${r.exitCode}): ${r.stderr.slice(-2000)}` };
  }
  return { resolved, count: resolved.length };
}
