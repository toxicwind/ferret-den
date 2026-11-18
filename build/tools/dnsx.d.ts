export interface DnsxResult {
    resolved: Array<{
        domain: string;
        ip: string;
        type: string;
    }>;
    count: number;
    error?: string;
}
/** Expand a record-type spec ("A", "a,txt,ns", "A,AAAA") into dnsx flags + fields. */
export declare function dnsFlags(recordType?: string | string[]): {
    flags: string[];
    fields: string[];
};
export declare function executeDnsx(domains: string[], recordType?: string | string[], resolvers?: string[]): Promise<DnsxResult>;
