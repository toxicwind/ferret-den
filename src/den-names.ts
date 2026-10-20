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
  { den: "keeper", bin: "pdtm", job: "Installs or updates kit members.", gated: true },
  { den: "expose", bin: "uncover", job: "Discovers exposed assets and administrative panels." },
  { den: "chatter", bin: "notify", job: "Dispatches webhook and messaging notifications.", gated: true },
  { den: "shadow", bin: "proxify", job: "Intercepts and captures HTTP/HTTPS traffic.", gated: true },
  { den: "scatter", bin: "chaos", job: "Queries curated public datasets." },
  { den: "cloak", bin: "cdncheck", job: "Detects CDN, cloud provider, and WAF IP ownership." },
  { den: "range", bin: "asnmap", job: "Maps ASN IP ranges and CIDR blocks." },
  { den: "mutate", bin: "alterx", job: "Generates permutation lists of subdomains." },
  { den: "warren", bin: "mapcidr", job: "Formats and expands CIDR blocks." },
  { den: "cloudkit", bin: "cloudlist", job: "Enumerates assets across cloud infrastructure providers." },
  { den: "turf", bin: "tldfinder", job: "Discovers top-level domains for a given entity." },
  { den: "denhome", bin: "simplehttpserver", job: "Spawns a local file server that exits after 8 seconds.", gated: true },
  { den: "muse", bin: "aix", job: "Prompts the kit assistant." },
  { den: "sniff", bin: "ffuf", job: "Fuzzes URL paths/parameters for live endpoints (read-only, rate-limited).", gated: true },
  // Lua workflow overlays — runtime-dispatched by the Lua engine (not compiled).
  // Adding a workflow = drop a .lua + a row here + one in workflows/workflows.toml.
  { den: "recon", bin: "recon_workflow", job: "Composable subdomain→DNS→probe→port pipeline (runtime Lua workflow)." },
  { den: "bug_bounty", bin: "bug_bounty_workflow", job: "Full bug bounty pipeline incl. scrape/scan (runtime Lua workflow).", gated: true },
  { den: "api_recon", bin: "api_recon_workflow", job: "Universal OpenAI-compatible v1 endpoint recon (runtime Lua workflow)." },
  { den: "freeinference_recon", bin: "freeinference_recon_workflow", job: "FreeInference provider recon (runtime Lua workflow)." },
  { den: "cloudflare_recon", bin: "cloudflare_recon_workflow", job: "Cloudflare AI Gateway recon (runtime Lua workflow)." },
  { den: "opencode_zen_recon", bin: "opencode_zen_recon_workflow", job: "OpenCodeZen provider recon (runtime Lua workflow)." },
];

const BY_DEN = new Map(DEN.map((t) => [t.den, t]));

export function resolveDen(name: string): DenTool | undefined {
  return BY_DEN.get(name);
}
