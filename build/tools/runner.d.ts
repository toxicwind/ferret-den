export declare const PD_TOOLS_DIR: string;
export declare const SHUFFLEDNS_BIN: string;
export declare function resolveBinary(name: string): string;
export declare function cleanList(items: unknown, maxItems?: number, maxLen?: number): string[];
export declare function cleanDomain(d: unknown): string;
export declare function cleanPortSpec(p: unknown): string | undefined;
export interface RunResult {
    lines: string[];
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
}
export declare function runBinary(binary: string, args: string[], opts?: {
    timeoutMs?: number;
    stdin?: string;
}): Promise<RunResult>;
export declare function parseJsonl<T>(lines: string[], pick: (o: any) => T | null): T[];
export declare function ok<T>(payload: T): {
    ok: true;
} & {
    result: T;
};
export declare function isHeavyTool(name: string): boolean;
/** Run fn under the heavy-scan gate if name is a heavy tool. */
export declare function withHeavyGate<T>(name: string, fn: () => Promise<T>): Promise<T>;
export declare function checkAllBinaries(): void;
export declare function runBinarySync(binary: string, args: string[], opts?: {
    timeoutMs?: number;
    stdin?: string;
}): RunResult;
