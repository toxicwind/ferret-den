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
/** AbortSignal with a cleanup timer, mirroring the Pens's withTimeoutSignal. */
function withTimeoutSignal(timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return {
        signal: controller.signal,
        clear: () => clearTimeout(timeout),
    };
}
function trimTrailingSlash(value) {
    return value.replace(/\/+$/, "");
}
export function compactDetail(value, maxLength = 180) {
    const compact = value.trim().replace(/\s+/g, " ");
    if (!compact)
        return "";
    return compact.length <= maxLength ? compact : compact.slice(0, maxLength);
}
function redactKey(key) {
    if (!key)
        return undefined;
    return key.length > 8 ? `${key.slice(0, 5)}…${key.slice(-3)}` : "<short>";
}
/** Auth headers: Bearer by default, X-API-Key when the profile asks for it. */
function authHeaders(profile) {
    if (!profile.apiKey)
        return {};
    if (profile.altAuthHeader) {
        return { [profile.altAuthHeader]: profile.apiKey };
    }
    return { Authorization: `Bearer ${profile.apiKey}` };
}
async function fetchJson(url, init = {}) {
    const start = Date.now();
    const { signal, clear } = withTimeoutSignal(init.timeoutMs ?? 8000);
    try {
        const response = await fetch(url, {
            method: init.method ?? "GET",
            headers: init.headers,
            body: init.body,
            signal,
        });
        const text = await response.text();
        let body = null;
        try {
            body = JSON.parse(text);
        }
        catch {
            // Non-JSON response — caller inspects status + error instead.
        }
        return {
            ok: response.ok,
            status: response.status,
            latencyMs: Date.now() - start,
            body,
        };
    }
    catch (err) {
        return {
            ok: false,
            status: 0,
            latencyMs: Date.now() - start,
            body: null,
            error: err instanceof Error ? err.message : String(err),
        };
    }
    finally {
        clear();
    }
}
/** Step 1: GET /models — deduped, mapped to catalog entries. */
async function probeModels(profile) {
    const url = `${trimTrailingSlash(profile.baseUrl)}/models`;
    const headers = { ...authHeaders(profile), ...(profile.headers ?? {}) };
    const res = await fetchJson(url, {
        headers,
        timeoutMs: profile.timeoutMs,
    });
    const step = {
        ok: res.ok,
        latencyMs: res.latencyMs,
        status: res.status,
        error: res.error,
        models: [],
    };
    if (!res.ok || !res.body?.data) {
        step.error = compactDetail(res.error ?? `HTTP ${res.status}`);
        return step;
    }
    const seen = new Set();
    for (const raw of res.body.data) {
        if (!raw.id || seen.has(raw.id))
            continue;
        seen.add(raw.id);
        step.models.push({
            id: raw.id,
            apiName: raw.id,
            label: raw.display_name ?? raw.id,
        });
    }
    step.detail = `${step.models.length} models`;
    return step;
}
/** Step 2: POST /chat/completions round-trip with a deterministic prompt. */
async function probeChatRoundTrip(profile, model) {
    const url = `${trimTrailingSlash(profile.baseUrl)}/chat/completions`;
    const headers = {
        "Content-Type": "application/json",
        ...authHeaders(profile),
        ...(profile.headers ?? {}),
    };
    const res = await fetchJson(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "reply with exactly: STRICT_OK" }],
            max_tokens: 20,
            temperature: 0,
        }),
        timeoutMs: profile.timeoutMs,
    });
    const step = {
        ok: res.ok,
        latencyMs: res.latencyMs,
        status: res.status,
        error: res.error,
        content: "",
        model,
    };
    if (!res.ok || !res.body) {
        step.error = compactDetail(res.error ?? `HTTP ${res.status}`);
        return step;
    }
    step.content = res.body.choices?.[0]?.message?.content ?? "";
    if (!step.content) {
        step.ok = false;
        step.error = "empty content";
    }
    return step;
}
/** Step 3: POST /embeddings — reports vector dimension. */
async function probeEmbeddings(profile, model) {
    const url = `${trimTrailingSlash(profile.baseUrl)}/embeddings`;
    const headers = {
        "Content-Type": "application/json",
        ...authHeaders(profile),
        ...(profile.headers ?? {}),
    };
    const res = await fetchJson(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, input: "hello world" }),
        timeoutMs: profile.timeoutMs,
    });
    const step = {
        ok: res.ok,
        latencyMs: res.latencyMs,
        status: res.status,
        error: res.error,
        dimensions: 0,
    };
    if (!res.ok || !res.body) {
        step.error = compactDetail(res.error ?? `HTTP ${res.status}`);
        return step;
    }
    step.dimensions = res.body.data?.[0]?.embedding?.length ?? 0;
    if (step.dimensions === 0) {
        step.ok = false;
        step.error = "empty embedding";
    }
    return step;
}
/** Step 4: header matrix — send each probe header, record what changes. */
async function probeHeaderMatrix(profile) {
    const url = `${trimTrailingSlash(profile.baseUrl)}/models`;
    const results = [];
    for (const probe of profile.headerProbes ?? []) {
        const headers = {
            ...authHeaders(profile),
            ...(profile.headers ?? {}),
            [probe.name]: probe.value,
        };
        const res = await fetchJson(url, { headers, timeoutMs: profile.timeoutMs });
        results.push({
            header: probe.name,
            value: redactKey(probe.value) ?? probe.value,
            ok: res.ok,
            status: res.status,
            note: res.ok
                ? (probe.expect ?? "accepted")
                : compactDetail(res.error ?? `HTTP ${res.status}`) || "rejected",
        });
    }
    return results;
}
/** Step 5: Anthropic-shaped gateway — GET /v1/models in Anthropic clothing. */
async function probeAnthropicGateway(profile) {
    if (!profile.anthropicBaseUrl)
        return undefined;
    const url = `${trimTrailingSlash(profile.anthropicBaseUrl)}/models`;
    const headers = {
        "anthropic-version": "2023-06-01",
        ...authHeaders(profile),
        ...(profile.headers ?? {}),
    };
    const res = await fetchJson(url, {
        headers,
        timeoutMs: profile.timeoutMs,
    });
    const step = {
        ok: res.ok,
        latencyMs: res.latencyMs,
        status: res.status,
        error: res.error,
        models: [],
    };
    if (!res.ok || !res.body?.data) {
        step.error = compactDetail(res.error ?? `HTTP ${res.status}`);
        return step;
    }
    step.models = res.body.data.map((m) => m.id ?? "").filter(Boolean);
    step.detail = `${step.models.length} models`;
    return step;
}
/** Step 6: local qdrant — health + collections (vector-store readiness). */
async function probeLocalQdrant(profile) {
    if (!profile.localQdrantUrl)
        return undefined;
    const base = trimTrailingSlash(profile.localQdrantUrl);
    const health = await fetchJson(`${base}/healthz`, { timeoutMs: 3000 });
    const step = {
        ok: health.ok,
        latencyMs: health.latencyMs,
        status: health.status,
        error: health.error,
        collections: [],
    };
    if (!health.ok) {
        step.error = compactDetail(health.error ?? `HTTP ${health.status}`) || "unreachable";
        return step;
    }
    const cols = await fetchJson(`${base}/collections`, { timeoutMs: 3000 });
    if (cols.ok && cols.body?.result?.collections) {
        step.collections = cols.body.result.collections.map((c) => c.name ?? "").filter(Boolean);
        step.detail = `${step.collections.length} collections`;
    }
    return step;
}
/**
 * Run the universal v1 endpoint recon against a provider profile.
 * Read-only: GETs and one deterministic chat/embedding round-trip.
 */
export async function runApiReconWorkflow(profile) {
    const startTime = Date.now();
    const result = {
        summary: {
            provider: profile.provider,
            baseUrl: profile.baseUrl,
            modelsFound: 0,
            documentedModelsMissing: [],
            findings: 0,
            executionTime: 0,
        },
        steps: {},
        findings: [],
    };
    console.error(`[api-recon] ${profile.provider}: probing ${profile.baseUrl}`);
    // Step 1: model catalog
    const modelsStep = await probeModels(profile);
    result.steps.models = modelsStep;
    result.summary.modelsFound = modelsStep.models.length;
    if (!modelsStep.ok) {
        result.findings.push({
            kind: "models-unreachable",
            detail: compactDetail(modelsStep.error ?? "unknown"),
        });
    }
    // Step 2: chat round-trip on the configured or first model
    const chatModel = profile.chatProbeModel ?? modelsStep.models[0]?.id ?? "";
    if (chatModel) {
        const chatStep = await probeChatRoundTrip(profile, chatModel);
        result.steps.chatRoundTrip = chatStep;
        if (chatStep.ok && chatStep.content.includes("STRICT_OK")) {
            result.findings.push({ kind: "chat-ok", detail: `${chatModel} (${chatStep.latencyMs}ms)` });
        }
        else if (!chatStep.ok) {
            result.findings.push({
                kind: "chat-failed",
                detail: compactDetail(chatStep.error ?? "unknown"),
            });
        }
    }
    // Step 3: embeddings
    if (profile.embeddingModel) {
        const embStep = await probeEmbeddings(profile, profile.embeddingModel);
        result.steps.embeddings = embStep;
        if (embStep.ok) {
            result.findings.push({
                kind: "embeddings-ok",
                detail: `${profile.embeddingModel} dim=${embStep.dimensions}`,
            });
        }
    }
    // Step 4: header matrix
    if (profile.headerProbes && profile.headerProbes.length > 0) {
        const matrix = await probeHeaderMatrix(profile);
        result.steps.headerMatrix = matrix;
        for (const m of matrix) {
            result.findings.push({
                kind: m.ok ? "header-accepted" : "header-rejected",
                detail: `${m.header}: ${m.note}`,
            });
        }
    }
    // Step 5: anthropic gateway
    const anthropicStep = await probeAnthropicGateway(profile);
    if (anthropicStep) {
        result.steps.anthropicGateway = anthropicStep;
        if (anthropicStep.ok) {
            result.findings.push({
                kind: "anthropic-gateway-ok",
                detail: `${anthropicStep.models.length} models`,
            });
        }
    }
    // Step 6: local qdrant
    const qdrantStep = await probeLocalQdrant(profile);
    if (qdrantStep) {
        result.steps.localQdrant = qdrantStep;
        if (qdrantStep.ok) {
            result.findings.push({
                kind: "local-qdrant-ok",
                detail: `${qdrantStep.collections.length} collections`,
            });
        }
    }
    // Doc-vs-reality check: documented models missing from the live list
    if (profile.documentedModels && modelsStep.ok) {
        const live = new Set(modelsStep.models.map((m) => m.id));
        for (const doc of profile.documentedModels) {
            if (!live.has(doc)) {
                result.summary.documentedModelsMissing.push(doc);
                result.findings.push({
                    kind: "documented-model-missing",
                    detail: `${doc} is in the docs but not in /models`,
                });
            }
        }
    }
    result.summary.findings = result.findings.length;
    result.summary.executionTime = Math.round((Date.now() - startTime) / 1000);
    console.error(`[api-recon] ${profile.provider}: done in ${result.summary.executionTime}s, ` +
        `${result.findings.length} findings`);
    return result;
}
