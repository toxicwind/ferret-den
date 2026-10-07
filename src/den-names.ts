// den: names. The bin stays the upstream file. The alias says what the ferret does.
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
  { den: "raid", bin: "bug_bounty_workflow", job: "full den raid: sniff, call, scratch, nose, tunnel, bite" },
  { den: "keeper", bin: "pdtm", job: "keep the bin pack installed" },
  { den: "expose", bin: "uncover", job: "turn over exposed panels" },
  { den: "chatter", bin: "notify", job: "carry a message out of the den" },
  { den: "shadow", bin: "proxify", job: "sit in the path and watch traffic" },
  { den: "scatter", bin: "chaos", job: "pull the chaos name set" },
  { den: "cloak", bin: "cdncheck", job: "see if a host is wearing a CDN cloak" },
  { den: "range", bin: "asnmap", job: "map the ASN range" },
  { den: "mutate", bin: "alterx", job: "mutate a name into more names" },
  { den: "warren", bin: "mapcidr", job: "map the CIDR warren" },
  { den: "cloudkit", bin: "cloudlist", job: "list the kits stashed in cloud" },
  { den: "turf", bin: "tldfinder", job: "find the turf a name sits on" },
  { den: "denhome", bin: "simplehttpserver", job: "serve the den on a local port" },
  { den: "muse", bin: "aix", job: "ask the den muse" },
];

export const DEN_BY_NAME = new Map(DEN.map((t) => [t.den, t]));
export const DEN_BY_BIN = new Map(DEN.map((t) => [t.bin, t]));

export function resolveDen(name: string): DenTool | undefined {
  const raw = name.startsWith("pd_") ? name.slice(3) : name.startsWith("den_") ? name.slice(4) : name;
  return DEN_BY_NAME.get(raw) || DEN_BY_BIN.get(raw);
}
