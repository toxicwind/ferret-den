import { executeSubfinder } from "../tools/subfinder.js";
import { executeDnsx } from "../tools/dnsx.js";
import { executeNaabu } from "../tools/naabu.js";
import { executeHttpx } from "../tools/httpx.js";
import { executeKatana } from "../tools/katana.js";
import { executeNuclei } from "../tools/nuclei.js";
export function unique(items) {
    const out = [];
    const seen = new Set();
    for (const raw of items) {
        const s = String(raw || "").trim();
        if (!s || seen.has(s))
            continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}
export function portTargets(openPorts) {
    return unique(openPorts.filter((p) => p.host && p.port).map((p) => `${p.host}:${p.port}`));
}
async function inBatches(items, size, delayMs, run) {
    const n = Math.max(1, size);
    for (let i = 0; i < items.length; i += n) {
        await run(items.slice(i, i + n));
        if (i + n < items.length && delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}
function severityOf(v) {
    return String(v.info?.severity || "").toLowerCase();
}
export async function runBugBountyWorkflow(domain, options) {
    const startTime = Date.now();
    const rateLimit = {
        maxCrawlUrls: options.rateLimit?.maxCrawlUrls ?? 10,
        maxScanUrls: options.rateLimit?.maxScanUrls ?? 20,
        maxTopPorts: options.rateLimit?.maxTopPorts ?? 100,
        batchSize: options.rateLimit?.batchSize ?? 50,
        delayBetweenBatches: options.rateLimit?.delayBetweenBatches ?? 1000,
        crawlDepth: options.rateLimit?.crawlDepth ?? 2,
    };
    const result = {
        summary: {
            domain,
            totalSubdomains: 0,
            totalResolvedHosts: 0,
            totalOpenPorts: 0,
            totalLiveHosts: 0,
            totalEndpoints: 0,
            totalVulnerabilities: 0,
            criticalFindings: 0,
            highFindings: 0,
            executionTime: 0,
        },
        steps: {},
        findings: [],
    };
    try {
        const discovered = await executeSubfinder(domain, true);
        result.steps.subdomainDiscovery = discovered;
        const names = unique([domain, ...discovered.subdomains]);
        result.summary.totalSubdomains = names.length;
        const resolved = [];
        await inBatches(names, rateLimit.batchSize, rateLimit.delayBetweenBatches, async (batch) => {
            const part = await executeDnsx(batch);
            resolved.push(...part.resolved);
            if (part.error)
                result.steps.dnsError = part.error;
        });
        result.steps.dnsResolution = { resolved, count: resolved.length };
        result.summary.totalResolvedHosts = resolved.length;
        const hosts = unique(resolved.map((r) => r.domain));
        if (hosts.length === 0)
            hosts.push(domain);
        let probe = hosts.slice();
        if (options.portScan) {
            const scanned = hosts.slice(0, 50);
            const ports = await executeNaabu(scanned, undefined, rateLimit.maxTopPorts);
            result.steps.portScanning = ports;
            result.summary.totalOpenPorts = ports.count;
            probe = unique([...hosts, ...portTargets(ports.openPorts)]);
        }
        const http = await executeHttpx(probe, true, true);
        result.steps.httpProbing = http;
        result.summary.totalLiveHosts = http.count;
        const liveUrls = unique(http.responses.filter((r) => r.url && (r.statusCode == null || r.statusCode < 500)).map((r) => r.url));
        if (liveUrls.length === 0) {
            result.summary.executionTime = Math.round((Date.now() - startTime) / 1000);
            return result;
        }
        let endpoints = [];
        if (options.crawl) {
            const crawled = await executeKatana(liveUrls.slice(0, rateLimit.maxCrawlUrls), rateLimit.crawlDepth);
            result.steps.webCrawling = crawled;
            endpoints = crawled.endpoints;
            result.summary.totalEndpoints = crawled.count;
        }
        if (options.vulnerabilityScan) {
            const targets = unique([...liveUrls, ...endpoints]).slice(0, rateLimit.maxScanUrls);
            const nuclei = await executeNuclei(targets, undefined, options.severityFilter || ["critical", "high", "medium"]);
            result.steps.vulnerabilityScanning = nuclei;
            result.summary.totalVulnerabilities = nuclei.count;
            result.summary.criticalFindings = nuclei.vulnerabilities.filter((v) => severityOf(v) === "critical").length;
            result.summary.highFindings = nuclei.vulnerabilities.filter((v) => severityOf(v) === "high").length;
            result.findings = nuclei.vulnerabilities;
        }
    }
    catch (error) {
        result.steps.error = error instanceof Error ? error.message : String(error);
    }
    result.summary.executionTime = Math.round((Date.now() - startTime) / 1000);
    return result;
}
