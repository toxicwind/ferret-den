/**
 * freeinference — FreeInference provider derivative of api-recon.
 *
 * Docs (doc.freeinference.org) are an unreliable narrator. This derivative
 * verifies every documented claim empirically against the live endpoint:
 *   - glm-5.1 is recommended across the docs but was NOT in /v1/models.
 *   - X-API-Key is documented as an alternative auth header.
 *   - X-Request-ID is documented to be echoed back in the response.
 *   - X-Session-ID is documented for request correlation.
 *   - X-Reasoning-Passthrough: false strips reasoning_content (verified).
 *   - /v1/embeddings with bge-m3 is documented for codebase indexing.
 *   - /anthropic/v1 is documented as an Anthropic-compatible gateway.
 *   - /v1/qdrant/ is documented as a Qdrant proxy.
 *
 * Every claim becomes a probe; every probe produces a finding.
 */
import { type ApiReconProfile, type ApiReconWorkflowResult } from "./api-recon.js";
export declare const FREEINFERENCE_BASE_URL = "https://freeinference.org/v1";
export declare const FREEINFERENCE_ANTHROPIC_BASE_URL = "https://freeinference.org/anthropic/v1";
export declare const FREEINFERENCE_QDRANT_PROXY_URL = "https://freeinference.org/v1/qdrant";
export interface FreeInferenceReconOptions {
    apiKey: string;
    /** Model to use for the chat round-trip. Defaults to glm-5.3-flash. */
    chatProbeModel?: string;
    /** Embedding model to probe. Defaults to bge-m3. */
    embeddingModel?: string;
    /** Local qdrant URL to also probe (Pens runs one on 25133). */
    localQdrantUrl?: string;
    /** Models the docs claim exist. Defaults to the documented set. */
    documentedModels?: string[];
}
/**
 * Build the FreeInference recon profile. Every documented behavior becomes
 * a header probe so the header matrix records what the gateway really does.
 */
export declare function buildFreeInferenceProfile(options: FreeInferenceReconOptions): ApiReconProfile;
/**
 * Run the full FreeInference recon. Returns the universal result plus
 * provider-specific extras (qdrant proxy reachability).
 */
export declare function runFreeInferenceRecon(options: FreeInferenceReconOptions): Promise<ApiReconWorkflowResult & {
    qdrantProxy: {
        ok: boolean;
        status: number;
        detail: string;
    };
}>;
