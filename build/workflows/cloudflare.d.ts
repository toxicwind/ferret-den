/**
 * cloudflare — Cloudflare AI Gateway derivative of api-recon.
 *
 * The AI Gateway (https://gateway.ai.cloudflare.com/v1/<account>/<gateway>)
 * speaks the universal OpenAI v1 shape: /models, /chat/completions,
 * /embeddings. What differs from a normal provider:
 *
 *   - Auth is the Cloudflare API token, not a provider key.
 *   - The path embeds account + gateway id.
 *   - Universal endpoints like /gateway/models list what the gateway can
 *     reach, and per-provider paths (<provider>/<model>) do the work.
 *   - Free vs paid is a real question: Workers AI has a free tier, the
 *     catalog models behind the gateway may not. This derivative records
 *     what the gateway actually exposes so the config only wires models
 *     that respond.
 */
import { type ApiReconProfile, type ApiReconWorkflowResult } from "./api-recon.js";
export interface CloudflareReconOptions {
    /** Cloudflare API token. Never logged. */
    apiToken: string;
    /** Cloudflare account id. */
    accountId: string;
    /** AI Gateway name (slug). */
    gatewayId: string;
    /** Model to use for the chat round-trip. */
    chatProbeModel?: string;
    /** Embedding model to probe. */
    embeddingModel?: string;
    /** Local qdrant URL to also probe. */
    localQdrantUrl?: string;
}
export declare function buildCloudflareProfile(options: CloudflareReconOptions): ApiReconProfile;
export declare function runCloudflareRecon(options: CloudflareReconOptions): Promise<ApiReconWorkflowResult>;
