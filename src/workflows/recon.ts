import { executeSubfinder } from "../tools/subfinder.js";
import { executeDnsx } from "../tools/dnsx.js";
import { executeHttpx } from "../tools/httpx.js";
import { executeTlsx } from "../tools/tlsx.js";
import { executeKatana } from "../tools/katana.js";

/**
 * recon-workflow — optimization-focused surface recon (not attack).
 *
 * Purpose: discover the things humans miss — undocumented API endpoints,
 * header-driven behaviors, model/feature gaps between status feeds and
 * public model lists, and infra details that unlock better client config.
 *
 * Runs read-only probes only. No exploitation, no payloads.
 */
export interface ReconWorkflowOptions {
  crawl?: boolean;
  crawlDepth?: number;
  resolveSubdomains?: boolean;
}

export interface ReconFinding {
  kind: string;
  detail: string;
}

export interface ReconWorkflowResult {
  summary: {
    domain: string;
    totalSubdomains: number;
    totalResolvedHosts: number;
    totalLiveHosts: number;
    totalEndpoints: number;
    executionTime: number;
  };
  steps: {
    subdomainDiscovery?: any;
    dnsResolution?: any;
    httpProbing?: any;
    tlsProbing?: any;
    webCrawling?: any;
  };
  findings: ReconFinding[];
}

export async function runReconWorkflow(
  domain: string,
  options: ReconWorkflowOptions = {},
): Promise<ReconWorkflowResult> {
  const startTime = Date.now();
  const crawl = options.crawl ?? true;
  const crawlDepth = options.crawlDepth ?? 2;
  const resolveSubdomains = options.resolveSubdomains ?? true;

  const result: ReconWorkflowResult = {
    summary: {
      domain,
      totalSubdomains: 0,
      totalResolvedHosts: 0,
      totalLiveHosts: 0,
      totalEndpoints: 0,
      executionTime: 0,
    },
    steps: {},
    findings: [],
  };

  // Step 1: Subdomain discovery
  console.error("Step 1: Discovering subdomains...");
  const subfinderResult = await executeSubfinder(domain, true);
  result.steps.subdomainDiscovery = subfinderResult;
  result.summary.totalSubdomains = subfinderResult.count;

  const hosts = resolveSubdomains && subfinderResult.subdomains.length > 0
    ? subfinderResult.subdomains
    : [domain];

  // Step 2: DNS resolution
  if (resolveSubdomains) {
    console.error(`Step 2: Resolving ${hosts.length} hosts...`);
    const dnsxResult = await executeDnsx(hosts);
    result.steps.dnsResolution = dnsxResult;
    result.summary.totalResolvedHosts = dnsxResult.count;
  }

  // Step 3: HTTP probing (tech detect, status, CDN, ASN)
  console.error("Step 3: Probing HTTP services...");
  const httpxResult = await executeHttpx(hosts, true, false);
  result.steps.httpProbing = httpxResult;
  result.summary.totalLiveHosts = httpxResult.count;

  const liveUrls = httpxResult.responses
    .filter((r) => r.statusCode && r.statusCode < 500)
    .map((r) => r.url);

  // Step 4: TLS probing
  console.error("Step 4: Probing TLS...");
  try {
    const tlsxResult = await executeTlsx(liveUrls.slice(0, 20));
    result.steps.tlsProbing = tlsxResult;
  } catch (err) {
    console.error(`TLS step failed: ${err}`);
  }

  // Step 5: Web crawling for endpoint/API surface discovery
  if (crawl && liveUrls.length > 0) {
    const urlsToCrawl = liveUrls.slice(0, 10);
    console.error(`Step 5: Crawling ${urlsToCrawl.length} URLs (depth ${crawlDepth})...`);
    const katanaResult = await executeKatana(urlsToCrawl, crawlDepth);
    result.steps.webCrawling = katanaResult;
    result.summary.totalEndpoints = katanaResult.count;

    // Surface crawl-discovered API endpoints as findings — these are the
    // optimization targets humans miss (status feeds, stats, model lists).
    for (const url of katanaResult.endpoints ?? []) {
      if (/\/api\/|\/stats|\/status|\/models|\/v1\//.test(url)) {
        result.findings.push({
          kind: "api-surface",
          detail: url,
        });
      }
    }
  }

  result.summary.executionTime = Math.round((Date.now() - startTime) / 1000);
  console.error(`Recon workflow completed in ${result.summary.executionTime}s`);
  return result;
}
