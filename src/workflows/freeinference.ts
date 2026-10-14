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

import {
  runApiReconWorkflow,
  compactDetail,
  type ApiReconProfile,
  type ApiReconWorkflowResult,
} from "./api-recon.js";

export const FREEINFERENCE_BASE_URL = "https://freeinference.org/v1";
export const FREEINFERENCE_ANTHROPIC_BASE_URL = "https://freeinference.org/anthropic/v1";
export const FREEINFERENCE_QDRANT_PROXY_URL = "https://freeinference.org/v1/qdrant";

export interface FreeInferenceReconOptions {
  apiKey: string;
  /** Model to use for the chat round-trip. Defaults to glm-5.3-flash. */
  chatProbeModel?: string;
  /** Embedding model to probe. Defaults to bge-m3. */
  embeddingModel?: string;
  /** Local qdrant URL to also probe (estate runs one on 25133). */
  localQdrantUrl?: string;
  /** Models the docs claim exist. Defaults to the documented set. */
  documentedModels?: string[];
}

/**
 * Build the FreeInference recon profile. Every documented behavior becomes
 * a header probe so the header matrix records what the gateway really does.
 */
export function buildFreeInferenceProfile(
  options: FreeInferenceReconOptions,
): ApiReconProfile {
  return {
    provider: "freeinference",
    baseUrl: FREEINFERENCE_BASE_URL,
    apiKey: options.apiKey,
    headers: {
      "X-Reasoning-Passthrough": "false",
    },
    timeoutMs: 10000,
    chatProbeModel: options.chatProbeModel ?? "glm-5.3-flash",
    embeddingModel: options.embeddingModel ?? "bge-m3",
    anthropicBaseUrl: FREEINFERENCE_ANTHROPIC_BASE_URL,
    localQdrantUrl: options.localQdrantUrl ?? "http://127.0.0.1:25133",
    headerProbes: [
      // Alt auth: X-API-Key is documented to accept the same key without Bearer.
      { name: "X-API-Key", value: options.apiKey, expect: "alt-auth accepted" },
      // Tracing: documented to be echoed back in the response.
      {
        name: "X-Request-ID",
        value: "api-recon-probe-0001",
        expect: "echoed in response",
      },
      // Session correlation: documented as logged + traceable.
      {
        name: "X-Session-ID",
        value: "api-recon-session-0001",
        expect: "accepted",
      },
      // Strict OpenAI mode: documented to strip reasoning_content.
      {
        name: "X-Reasoning-Passthrough",
        value: "false",
        expect: "reasoning_content stripped",
      },
    ],
    documentedModels: options.documentedModels ?? [
      // The docs recommend glm-5.1 everywhere but the live list had 6 models
      // and glm-5.1 was not among them. Verify or bust.
      "glm-5.1",
      "glm-5.3-flash",
      "minimax-m3",
      "qwen3.6-35b",
      "deepseek-v4-flash",
      "bge-m3",
    ],
  };
}

/**
 * Run the full FreeInference recon. Returns the universal result plus
 * provider-specific extras (qdrant proxy reachability).
 */
export async function runFreeInferenceRecon(
  options: FreeInferenceReconOptions,
): Promise<
  ApiReconWorkflowResult & {
    qdrantProxy: { ok: boolean; status: number; detail: string };
  }
> {
  const profile = buildFreeInferenceProfile(options);
  const base = await runApiReconWorkflow(profile);

  // The Qdrant proxy is provider-specific and not part of the universal
  // core — probe it here so the finding lands next to the rest.
  let qdrantProxy: { ok: boolean; status: number; detail: string } = {
    ok: false,
    status: 0,
    detail: "not probed",
  };
  try {
    const res = await fetch(`${FREEINFERENCE_QDRANT_PROXY_URL}/`, {
      method: "GET",
      headers: { "api-key": options.apiKey },
      signal: AbortSignal.timeout(8000),
    });
    qdrantProxy = {
      ok: res.ok,
      status: res.status,
      detail: compactDetail(await res.text()),
    };
  } catch (err) {
    qdrantProxy = {
      ok: false,
      status: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  if (qdrantProxy.ok) {
    base.findings.push({ kind: "qdrant-proxy-ok", detail: FREEINFERENCE_QDRANT_PROXY_URL });
  } else {
    base.findings.push({
      kind: "qdrant-proxy-unreachable",
      detail: `${FREEINFERENCE_QDRANT_PROXY_URL}: ${qdrantProxy.detail}`,
    });
  }
  base.summary.findings = base.findings.length;

  return { ...base, qdrantProxy };
}
