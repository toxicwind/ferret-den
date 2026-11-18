export interface FuzzHit {
    status: number;
    url: string | null;
    length: number;
}
export interface FuzzResult {
    target: string;
    hits: FuzzHit[];
    attempted: number;
    timedOut: boolean;
    stdout: string[];
}
export declare function executeFuzz(target: string, opts?: {
    wordlist?: string;
    statuses?: string;
    rate?: number;
    threads?: number;
    timeoutMs?: number;
}): Promise<FuzzResult>;
declare function cleanTarget(t: string): string;
export { cleanTarget };
