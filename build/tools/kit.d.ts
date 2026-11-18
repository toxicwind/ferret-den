export declare function executeKit(bin: string, target: string | undefined, extra: unknown): Promise<{
    lines: string[];
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
}>;
