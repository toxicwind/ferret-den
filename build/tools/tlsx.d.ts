export interface TlsxResult {
    hosts: Array<{
        host: string;
        port?: number;
        probeStatus?: boolean;
        tlsVersion?: string;
        cipher?: string;
        subjectAN?: string[];
        expired?: boolean;
        selfSigned?: boolean;
        wildcard?: boolean;
    }>;
    count: number;
    error?: string;
}
export declare function executeTlsx(hosts: string[], port?: number): Promise<TlsxResult>;
