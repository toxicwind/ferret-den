import { readFileSync } from "fs";
const text = readFileSync(new URL("../src/workflows/bug-bounty.ts", import.meta.url), "utf8");
for (const need of ["portTargets", "unique([domain", "executeHttpx(probe", "severityOf", "hosts.slice(0, 50)"]) {
  if (!text.includes(need)) throw new Error("missing " + need);
}
if (text.includes("v.info.severity.toLowerCase")) throw new Error("unguarded severity");
console.log("raid chain ok");
