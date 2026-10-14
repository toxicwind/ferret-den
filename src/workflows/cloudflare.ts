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

import {
  runApiReconWorkflow,
  type ApiReconProfile,
  type ApiReconWorkflowResult,
} from "./api-recon.js";

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

export function buildCloudflareProfile(
  options: CloudflareReconOptions,
): ApiReconProfile {
  const baseUrl = `https://gateway.ai.cloudflare.com/v1/${options.accountId}/${options.gatewayId}`;
  return {
    provider: "cloudflare-ai-gateway",
    baseUrl,
    apiKey: options.apiToken,
    headers: {},
    timeoutMs: 10000,
    chatProbeModel: options.chatProbeModel ?? "@cf/meta/llama-3.1-8b-instruct",
    embeddingModel: options.embeddingModel ?? "@cf/baai/bge-m3",
    localQdrantUrl: options.localQdrantUrl ?? "http://127.0.0.1:25133",
    headerProbes: [
      // The gateway accepts the token as a Bearer; confirm it also works
      // via the api-key header some clients send.
      { name: "X-API-Key", value: options.apiToken, expect: "alt-auth accepted" },
    ],
  };
}

export async function runCloudflareRecon(
  options: CloudflareReconOptions,
): Promise<ApiReconWorkflowResult> {
  const profile = buildCloudflareProfile(options);
  return runApiReconWorkflow(profile);
}
