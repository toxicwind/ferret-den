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
export declare function runReconWorkflow(domain: string, options?: ReconWorkflowOptions): Promise<ReconWorkflowResult>;
