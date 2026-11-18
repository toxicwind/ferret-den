import { runBinary, cleanList } from "./runner.js";
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
const RECORD_FLAGS = {
    A: "-a",
    AAAA: "-aaaa",
    CNAME: "-cname",
    NS: "-ns",
    TXT: "-txt",
    MX: "-mx",
    PTR: "-ptr",
    SOA: "-soa",
};
/** Expand a record-type spec ("A", "a,txt,ns", "A,AAAA") into dnsx flags + fields. */
export function dnsFlags(recordType) {
    const specs = Array.isArray(recordType)
        ? recordType
        : String(recordType || "A")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    if (specs.length === 0)
        specs.push("A");
    const flags = [];
    const fields = [];
    for (const spec of specs) {
        const key = String(spec).toUpperCase();
        const flag = RECORD_FLAGS[key];
        if (!flag)
            throw new Error(`unsupported record type: ${spec}`);
        if (!flags.includes(flag)) {
            flags.push(flag);
            fields.push(key.toLowerCase());
        }
    }
    return { flags, fields };
}
export async function executeDnsx(domains, recordType, resolvers) {
    const list = cleanList(domains);
    if (list.length === 0)
        return { resolved: [], count: 0, error: "no valid domains" };
    const { flags, fields } = dnsFlags(recordType);
    const args = ["-json", "-silent", ...flags];
    const resolversClean = (resolvers ?? []).map((r) => String(r).trim()).filter((r) => /^[0-9a-fA-F.:]+$/.test(r));
    if (resolversClean.length > 0)
        args.push("-r", resolversClean.join(","));
    // dnsx needs hostnames as a FILE (-l), not stdin, on this box — write a
    // throwaway list so multi-record resolution actually returns rows.
    let tmpDir = null;
    let listFile = null;
    try {
        tmpDir = mkdtempSync(join(tmpdir(), "dnsx-"));
        listFile = join(tmpDir, "hosts.txt");
        writeFileSync(listFile, list.join("\n") + "\n");
        args.push("-l", listFile);
    }
    catch {
        // fallthrough: rely on stdin if temp-file creation failed
    }
    const r = await runBinary("dnsx", args, {
        timeoutMs: 300_000,
    });
    if (tmpDir) {
        try {
            if (listFile)
                unlinkSync(listFile);
            rmSync(tmpDir, { recursive: true, force: true });
        }
        catch { }
    }
    const resolved = [];
    const seen = new Set();
    for (const line of r.lines) {
        let p;
        try {
            p = JSON.parse(line);
        }
        catch {
            continue;
        }
        const host = p.host || p.name;
        if (!host)
            continue;
        for (const field of fields) {
            const raw = p[field];
            const values = Array.isArray(raw) ? raw : raw !== undefined && raw !== null ? [raw] : [];
            if (values.length === 0)
                continue;
            for (const value of values) {
                const answer = String(value);
                const key = `${host}|${field}|${answer}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                resolved.push({ domain: String(host), ip: answer, type: field.toUpperCase() });
            }
        }
    }
    if (r.exitCode !== 0 && resolved.length === 0) {
        return { resolved: [], count: 0, error: `dnsx failed (exit ${r.exitCode}): ${r.stderr.slice(-2000)}` };
    }
    return { resolved, count: resolved.length };
}
