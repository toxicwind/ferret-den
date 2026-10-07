import { readFileSync } from "fs";
const text = readFileSync(new URL("../src/den-names.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const dens = [...text.matchAll(/den: "([^"]+)"/g)].map((m) => m[1]);
if (new Set(dens).size !== dens.length) throw new Error("duplicate den name");
if (dens.length < 22) throw new Error("overlay short");
if (index.includes("pd_")) throw new Error("old prefix still on the surface");
if (!index.includes("unknown den tool")) throw new Error("overlay not closed");
console.log("overlay ok", dens.length);
