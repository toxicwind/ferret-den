export declare const OPENCODE_ZEN_USER_AGENT = "opencode/1.19.0 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.14";
export declare const OPENCODE_ZEN_FREE_TOOLS: string[];
export declare const OPENCODE_ZEN_FREE_TOOL_SCHEMAS: Record<string, string>;
export declare function isOpenCodeZenURL(u: string): boolean;
export declare function openCodeZenFreeURL(u: string): string;
export declare function openCodeZenClientHeaders(headers: Record<string, string>, session: string, requestId: string): Record<string, string>;
export declare function isOpenCodeZenFreeModel(model: string, inputPrice?: number, outputPrice?: number): boolean;
export declare function isOpenCodeZenFreeTierError(status: number | undefined, body: unknown, msg: string): boolean;
export declare function openCodeZenProbeBody(body: unknown): string;
export interface OpenCodeZenReconProfile {
    baseUrl: string;
    apiKey?: string;
    timeoutMs?: number;
    chatProbeModel?: string;
}
export interface OpenCodeZenReconResult {
    summary: {
        provider: string;
        baseUrl: string;
        admission: "open" | "locked" | "unknown";
        executionTime: number;
    };
    steps: {
        models?: {
            ok: boolean;
            latencyMs: number;
            models: string[];
        };
        chatRoundTrip?: {
            ok: boolean;
            latencyMs: number;
            content: string;
            model: string;
        };
        headerMatrix?: Array<{
            header: string;
            value: string;
            ok: boolean;
            status?: number;
            note: string;
        }>;
        urlTranslation?: {
            zenV1: string;
            inferenceV1: string;
            ok: boolean;
        };
    };
    findings: Array<{
        kind: string;
        detail: string;
    }>;
}
/**
 * Run the OpenCode Zen free-tier recon. Read-only: GET /models, one
 * streaming chat round-trip with OpenCode headers + bash/read tools, header
 * matrix, and /zen/v1 → /inference/v1 URL translation check.
 */
export declare function runOpenCodeZenRecon(profile: OpenCodeZenReconProfile): Promise<OpenCodeZenReconResult>;
export * as OpenCodeZenRecon from "./opencode-zen.js";
