export interface KatanaResult {
    endpoints: string[];
    count: number;
    error?: string;
}
export declare function executeKatana(urls: string[], depth?: number, scope?: string, maxDurationSeconds?: number): Promise<KatanaResult>;
