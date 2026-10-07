// Overlay. Callers see den names. The bin path stays inside the den.
export type DenTool = {
  den: string;
  bin: string;
  job: string;
  gated?: boolean;
};

export const DEN: DenTool[] = [
  { den: "whisker", bin: "subfinder", job: "Discovers subdomains passively across public sources." },
  { den: "squeak", bin: "dnsx", job: "Resolves hostnames and validates active DNS records." },
  { den: "nose", bin: "httpx", job: "Probes HTTP/HTTPS endpoints for status, title, and tech stack." },
  { den: "padlock", bin: "tlsx", job: "Inspects TLS/SSL certificates, ciphers, and protocols." },
  { den: "scratch", bin: "naabu", job: "Performs fast TCP port scanning." },
  { den: "tunnel", bin: "katana", job: "Crawls web pages and JavaScript links." },
  { den: "rummage", bin: "shuffledns", job: "Brute-forces domain resolution against wordlists." },
  { den: "fang", bin: "nuclei", job: "Executes vulnerability and configuration template checks.", gated: true },
  { den: "raid", bin: "bug_bounty_workflow", job: "Runs subfinder, dnsx, naabu, probes open ports, crawls, then scans.", gated: true },
  { den: "keeper", bin: "pdtm", job: "Installs or updates ProjectDiscovery binaries.", gated: true },
  { den: "expose", bin: "uncover", job: "Discovers exposed assets and administrative panels." },
  { den: "chatter", bin: "notify", job: "Dispatches webhook and messaging notifications.", gated: true },
  { den: "shadow", bin: "proxify", job: "Intercepts and captures HTTP/HTTPS traffic.", gated: true },
  { den: "scatter", bin: "chaos", job: "Queries ProjectDiscovery Chaos datasets." },
  { den: "cloak", bin: "cdncheck", job: "Detects CDN, cloud provider, and WAF IP ownership." },
  { den: "range", bin: "asnmap", job: "Maps ASN IP ranges and CIDR blocks." },
  { den: "mutate", bin: "alterx", job: "Generates permutation lists of subdomains." },
  { den: "warren", bin: "mapcidr", job: "Formats and expands CIDR blocks." },
  { den: "cloudkit", bin: "cloudlist", job: "Enumerates assets across cloud infrastructure providers." },
  { den: "turf", bin: "tldfinder", job: "Discovers top-level domains for a given entity." },
  { den: "denhome", bin: "simplehttpserver", job: "Spawns a local file server that exits after 8 seconds.", gated: true },
  { den: "muse", bin: "aix", job: "Prompts the ProjectDiscovery assistant." },
];

const BY_DEN = new Map(DEN.map((t) => [t.den, t]));

export function resolveDen(name: string): DenTool | undefined {
  return BY_DEN.get(name);
}
