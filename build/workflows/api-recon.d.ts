/**
 * api-recon — universal OpenAI-compatible v1 endpoint recon workflow.
 *
 * Every provider that speaks "/v1" looks the same from the outside: a
 * /models list, a /chat/completions round-trip, maybe /embeddings, maybe
 * an Anthropic-shaped gateway next door. The differences that matter for
 * client optimization live in the headers — auth alternatives, tracing
 * echo, reasoning-passthrough toggles — and in the gap between what the
 * docs claim and what the endpoint actually does.
 *
 * This is the universal core. Provider derivatives (freeinference.ts,
 * cloudflare.ts) build on it by supplying an ApiReconProfile.
 *
 * Patterns harvested from the Pens via pattern-forge:
 *   withTimeoutSignal + clear  (providerDiscovery.ts)
 *   Bearer vs X-API-Key auth   (providerDiscovery.ts — bankr heuristic)
 *   dedupe Set on model ids    (listOpenAICompatibleModels)
 *   {id, apiName, label} entry (toDiscoveredModelEntry)
 *   /readyz + latency          (checkQdrantHealth)
 */
export interface ApiReconHeaderProbe {
    name: string;
    value: string;
    expect?: string;
}
export interface ApiReconProfile {
    provider: string;
    baseUrl: string;
    apiKey?: string;
    altAuthHeader?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    chatProbeModel?: string;
    embeddingModel?: string;
    anthropicBaseUrl?: string;
    localQdrantUrl?: string;
    headerProbes?: ApiReconHeaderProbe[];
    documentedModels?: string[];
}
export interface ApiReconModelEntry {
    id: string;
    apiName: string;
    label: string;
}
export interface ApiReconStepResult {
    ok: boolean;
    latencyMs: number;
    status?: number;
    error?: string;
    detail?: string;
}
/** Concrete (non-optional) shape of each step, as produced by its probe. */
export interface ApiReconModelsStep extends ApiReconStepResult {
    models: ApiReconModelEntry[];
}
export interface ApiReconChatStep extends ApiReconStepResult {
    content: string;
    model: string;
}
export interface ApiReconEmbeddingsStep extends ApiReconStepResult {
    dimensions: number;
}
export interface ApiReconAnthropicStep extends ApiReconStepResult {
    models: string[];
}
export interface ApiReconQdrantStep extends ApiReconStepResult {
    collections: string[];
}
export interface ApiReconFinding {
    kind: string;
    detail: string;
}
export interface ApiReconHeaderMatrixResult {
    header: string;
    value: string;
    ok: boolean;
    status?: number;
    note: string;
}
export interface ApiReconWorkflowResult {
    summary: {
        provider: string;
        baseUrl: string;
        modelsFound: number;
        documentedModelsMissing: string[];
        findings: number;
        executionTime: number;
    };
    steps: {
        models?: ApiReconModelsStep;
        chatRoundTrip?: ApiReconChatStep;
        embeddings?: ApiReconEmbeddingsStep;
        headerMatrix?: ApiReconHeaderMatrixResult[];
        anthropicGateway?: ApiReconAnthropicStep;
        localQdrant?: ApiReconQdrantStep;
    };
    findings: ApiReconFinding[];
}
export declare function compactDetail(value: string, maxLength?: number): string;
/**
 * Run the universal v1 endpoint recon against a provider profile.
 * Read-only: GETs and one deterministic chat/embedding round-trip.
 */
export declare function runApiReconWorkflow(profile: ApiReconProfile): Promise<ApiReconWorkflowResult>;
