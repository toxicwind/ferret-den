import { readFileSync } from "fs";
const text = readFileSync(new URL("../src/tools/dnsx.ts", import.meta.url), "utf8");
if (!text.includes("AAAA: \"-aaaa\"")) throw new Error("aaaa flag");
if (text.includes('args.push("-a", recordType)')) throw new Error("old record flag");
if (!text.includes("p[field]")) throw new Error("parser");
const http = readFileSync(new URL("../src/tools/httpx.ts", import.meta.url), "utf8");
if (!http.includes("2000")) throw new Error("url length");
console.log("tool fixes ok");
