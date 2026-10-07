// Overlay. Callers see den names. The bin path stays inside the den.
export type DenTool = {
  den: string;
  bin: string;
  job: string;
  gated?: boolean;
};

export const DEN: DenTool[] = [
  { den: "whisker", bin: "subfinder", job: "sniff out subdomains" },
  { den: "squeak", bin: "dnsx", job: "call a name and read the answer" },
  { den: "nose", bin: "httpx", job: "nose a host for a live page" },
  { den: "padlock", bin: "tlsx", job: "check the lock, cert, and cipher" },
  { den: "scratch", bin: "naabu", job: "scratch doors for open ports" },
  { den: "tunnel", bin: "katana", job: "run the tunnels and list paths" },
  { den: "rummage", bin: "shuffledns", job: "rummage a wordlist for names" },
  { den: "fang", bin: "nuclei", job: "bite with templates", gated: true },
  { den: "raid", bin: "bug_bounty_workflow", job: "full den raid" },
  { den: "keeper", bin: "pdtm", job: "keep the pack installed", gated: true },
  { den: "expose", bin: "uncover", job: "turn over exposed panels" },
  { den: "chatter", bin: "notify", job: "carry a message out of the den", gated: true },
  { den: "shadow", bin: "proxify", job: "sit in the path and watch traffic", gated: true },
  { den: "scatter", bin: "chaos", job: "pull the scattered name set" },
  { den: "cloak", bin: "cdncheck", job: "see if a host is wearing a cloak" },
  { den: "range", bin: "asnmap", job: "map the range" },
  { den: "mutate", bin: "alterx", job: "mutate a name into more names" },
  { den: "warren", bin: "mapcidr", job: "map the warren" },
  { den: "cloudkit", bin: "cloudlist", job: "list the kits stashed in cloud" },
  { den: "turf", bin: "tldfinder", job: "find the turf a name sits on" },
  { den: "denhome", bin: "simplehttpserver", job: "serve the den on a local port", gated: true },
  { den: "muse", bin: "aix", job: "ask the den muse" },
];

const BY_DEN = new Map(DEN.map((t) => [t.den, t]));

export function resolveDen(name: string): DenTool | undefined {
  return BY_DEN.get(name);
}
