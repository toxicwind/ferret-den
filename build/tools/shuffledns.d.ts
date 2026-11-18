export interface ShufflednsResult {
    subdomains: string[];
    count: number;
    error?: string;
}
export declare function executeShuffledns(domain: string, wordlist: string, resolvers?: string[]): Promise<ShufflednsResult>;
