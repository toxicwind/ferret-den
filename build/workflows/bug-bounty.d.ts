export interface RateLimitOptions {
    maxCrawlUrls?: number;
    maxScanUrls?: number;
    maxTopPorts?: number;
    batchSize?: number;
    delayBetweenBatches?: number;
    crawlDepth?: number;
}
export interface BugBountyWorkflowOptions {
    portScan: boolean;
    crawl: boolean;
    vulnerabilityScan: boolean;
    severityFilter?: string[];
    rateLimit?: RateLimitOptions;
}
export interface BugBountyWorkflowResult {
    summary: {
        domain: string;
        totalSubdomains: number;
        totalResolvedHosts: number;
        totalOpenPorts: number;
        totalLiveHosts: number;
        totalEndpoints: number;
        totalVulnerabilities: number;
        criticalFindings: number;
        highFindings: number;
        executionTime: number;
    };
    steps: Record<string, unknown>;
    findings: unknown[];
}
export declare function unique(items: string[]): string[];
export declare function portTargets(openPorts: Array<{
    host: string;
    port: number;
}>): string[];
export declare function runBugBountyWorkflow(domain: string, options: BugBountyWorkflowOptions): Promise<BugBountyWorkflowResult>;
