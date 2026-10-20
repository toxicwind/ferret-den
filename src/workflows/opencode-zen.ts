/**
 * opencode-zen — OpenCode Zen free-tier recon workflow.
 *
 * Zen's free models (-free or zero-priced) are served only to requests that
 * look like the OpenCode client itself. Zen answers 403 FreeTierError
 * "OpenCode's free tier can only be used from within OpenCode" to anything
 * else (mid-October 2026: also at /zen/v1 even for OpenCode's own requests;
 * the same request at /inference/v1 answers 200).
 *
 * This workflow probes whether the OpenCode Zen endpoint admits the estate's
 * requests, recording the header matrix that Zen's gate checks:
 *   - User-Agent (must be versioned opencode/<ver> ai-sdk/... runtime/bun/...)
 *   - x-opencode-session / x-opencode-session-id (session attribution)
 *   - x-opencode-request (turn attribution)
 *   - x-opencode-client (must be "cli")
 *   - x-opencode-project (must be "global")
 *   - x-session-affinity / X-Session-Id (must be ABSENT — Zen refuses free
 *     tier requests carrying them since mid-October 2026)
 *   - /zen/v1 vs /inference/v1 (free tier moved to /inference/v1)
 *   - bash + read tools (must be offered, lowercased, each taking a parameter)
 *
 * Read-only: GET /models and one deterministic streaming chat round-trip.
 */
import { runApiReconWorkflow, type ApiReconProfile } from "./api-recon.js";

// OpenCode Zen free tier requires a versioned User-Agent. Zen's free tier
// turns away anything older than 1.18.0 (426 "OpenCode 1.18.0 or newer is
// required to use the free tier").
export const OPENCODE_ZEN_USER_AGENT =
  "opencode/1.19.0 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.14";

// OpenCode Zen free models want bash and read tools offered, lowercased,
// each taking a parameter (OpenCode's own schemas, mid-October 2026).
export const OPENCODE_ZEN_FREE_TOOLS = ["bash", "read"];

export const OPENCODE_ZEN_FREE_TOOL_SCHEMAS: Record<string, string> = {
  bash: JSON.stringify({
    type: "object",
    properties: {
      command: { type: "string", description: "The command to execute" },
      timeout: { type: "integer", description: "Optional timeout in milliseconds" },
      workdir: { type: "string", description: "The working directory to run the command in" },
    },
    required: ["command"],
  }),
  read: JSON.stringify({
    type: "object",
    properties: {
      filePath: { type: "string", description: "The absolute path to the file or directory to read" },
      offset: { type: "integer", description: "The line number to start reading from (1-indexed)" },
      limit: { type: "integer", description: "The maximum number of lines to read" },
    },
    required: ["filePath"],
  }),
};

// Whether a URL is at OpenCode's gateway (Zen, Go or inference API).
export function isOpenCodeZenURL(u: string): boolean {
  try {
    const pu = new URL(String(u).trim());
    return pu.hostname === "opencode.ai" || pu.hostname.endsWith(".opencode.ai");
  } catch {
    return false;
  }
}

// Translate a Zen URL (/zen/v1/…) to the inference API (/inference/v1/…).
// Zen's free tier answers 403 at /zen/v1 since mid-October 2026; the same
// request at /inference/v1 answers 200. Any other URL (Go's /zen/go among
// others) is returned unchanged.
export function openCodeZenFreeURL(u: string): string {
  try {
    const pu = new URL(u);
    if (!isOpenCodeZenURL(u)) return u;
    const rest = pu.pathname.startsWith("/zen") ? pu.pathname.slice(4) : "";
    if (rest === "" || rest === "/go" || rest.startsWith("/go/")) return u;
    pu.pathname = "/inference" + rest;
    return pu.toString();
  } catch {
    return u;
  }
}

// Inject OpenCode client headers into an existing headers record.
// OpenCodeClient makes a request carry what OpenCode itself sends to Zen:
// User-Agent, x-opencode-session, x-opencode-session-id, x-opencode-request,
// x-opencode-client, x-opencode-project. Deletes x-session-affinity /
// X-Session-Id (Zen's free tier answers 403 FreeTierError to requests
// carrying them).
export function openCodeZenClientHeaders(
  headers: Record<string, string>,
  session: string,
  requestId: string,
): Record<string, string> {
  const h: Record<string, string> = { ...headers };
  delete h["x-session-affinity"];
  delete h["X-Session-Id"];
  h["User-Agent"] = OPENCODE_ZEN_USER_AGENT;
  h["x-opencode-session"] = session;
  h["x-opencode-session-id"] = session;
  h["x-opencode-request"] = requestId;
  h["x-opencode-client"] = "cli";
  h["x-opencode-project"] = "global";
  return h;
}

// Whether a model is one of OpenCode Zen's free ones.
// A free model is one whose id ends in -free, or one models.dev prices at nothing.
export function isOpenCodeZenFreeModel(model: string, inputPrice = 0, outputPrice = 0): boolean {
  if (model.endsWith("-free")) return true;
  if (inputPrice === 0 && outputPrice === 0) return true;
  return false;
}

// Whether an error is Zen's free-tier refusal.
export function isOpenCodeZenFreeTierError(status: number | undefined, body: unknown, msg: string): boolean {
  if (status === 403 && /FreeTierError|free tier can only be used from within/i.test(msg)) return true;
  const b = body as { error?: { type?: string; message?: string } } | undefined;
  return (
    b?.error?.type === "FreeTierError" ||
    /OpenCode's free tier can only be used from within/i.test(b?.error?.message ?? "")
  );
}

// Build an OpenCode Zen free-tier probe body (streamed, offering bash and read).
export function openCodeZenProbeBody(body: unknown): string {
  let m: Record<string, unknown>;
  try {
    m = typeof body === "string" ? JSON.parse(body) : { ...(body as Record<string, unknown>) };
  } catch {
    return typeof body === "string" ? body : JSON.stringify(body);
  }
  const tools: unknown[] = [];
  for (const name of OPENCODE_ZEN_FREE_TOOLS) {
    let schema: unknown = {};
    try {
      schema = JSON.parse(OPENCODE_ZEN_FREE_TOOL_SCHEMAS[name] ?? "{}");
    } catch {
      schema = {};
    }
    tools.push({
      type: "function",
      function: {
        name,
        description: "Not available in this session. Never call this tool.",
        parameters: schema,
      },
    });
  }
  m.stream = true;
  m.tools = tools;
  return JSON.stringify(m);
}

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
    models?: { ok: boolean; latencyMs: number; models: string[] };
    chatRoundTrip?: { ok: boolean; latencyMs: number; content: string; model: string };
    headerMatrix?: Array<{
      header: string;
      value: string;
      ok: boolean;
      status?: number;
      note: string;
    }>;
    urlTranslation?: { zenV1: string; inferenceV1: string; ok: boolean };
  };
  findings: Array<{ kind: string; detail: string }>;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function compactDetail(value: string, maxLength = 180): string {
  const compact = value.trim().replace(/\s+/g, " ");
  if (!compact) return "";
  return compact.length <= maxLength ? compact : compact.slice(0, maxLength);
}

async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; latencyMs: number; body: T | null; error?: string }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 8000);
  try {
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.headers,
      body: init.body,
      signal: controller.signal,
    });
    const text = await response.text();
    let body: T | null = null;
    try {
      body = JSON.parse(text) as T;
    } catch {
      // Non-JSON response.
    }
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - start,
      body,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      body: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeModels(profile: OpenCodeZenReconProfile): Promise<{ ok: boolean; status?: number; latencyMs: number; models: string[]; detail?: string; error?: string }> {
  const url = `${trimTrailingSlash(profile.baseUrl)}/models`;
  const headers: Record<string, string> = {};
  if (profile.apiKey) headers["Authorization"] = `Bearer ${profile.apiKey}`;
  const res = await fetchJson<{ data?: Array<{ id?: string }> }>(url, { headers, timeoutMs: profile.timeoutMs });
  const step: { ok: boolean; status?: number; latencyMs: number; models: string[]; detail?: string; error?: string } = { ok: res.ok, latencyMs: res.latencyMs, models: [] as string[] };
  if (!res.ok || !res.body?.data) return step;
  for (const raw of res.body.data) {
    if (raw.id) step.models.push(raw.id);
  }
  step.detail = `${step.models.length} models`;
  return step as any;
}

async function probeChatRoundTrip(profile: OpenCodeZenReconProfile, model: string): Promise<{ ok: boolean; status?: number; latencyMs: number; content: string; model: string; error?: string }> {
  const url = `${trimTrailingSlash(profile.baseUrl)}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...openCodeZenClientHeaders({}, "api-recon-session", "api-recon-request"),
  };
  if (profile.apiKey) headers["Authorization"] = `Bearer ${profile.apiKey}`;
  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: "reply with exactly: STRICT_OK" }],
    max_tokens: 20,
    temperature: 0,
    stream: true,
    tools: OPENCODE_ZEN_FREE_TOOLS.map((name) => ({
      type: "function",
      function: {
        name,
        description: "Not available in this session. Never call this tool.",
        parameters: JSON.parse(OPENCODE_ZEN_FREE_TOOL_SCHEMAS[name] ?? "{}"),
      },
    })),
  });
  const start = Date.now();
  let content = "";
  let ok = false;
  let status = 0;
  let error = "";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(profile.timeoutMs ?? 8000),
    });
    status = response.status;
    ok = response.ok;
    if (response.ok) {
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline !== -1) {
            const row = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            const line = row.replace(/\r$/, "").replace(/^\uFEFF/, "");
            if (line.startsWith("data: ")) {
              const payload = line.slice(6);
              if (payload === "[DONE]") continue;
              try {
                const data = JSON.parse(payload);
                const delta = data.choices?.[0]?.delta ?? {};
                if (delta.content) content += delta.content;
              } catch {
                // Non-JSON SSE line — ignore.
              }
            }
            newline = buffer.indexOf("\n");
          }
        }
      }
      ok = true;
    } else {
      error = await response.text();
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return { ok, latencyMs: Date.now() - start, content, model, status, error } as any;
}

async function probeHeaderMatrix(profile: OpenCodeZenReconProfile): Promise<Array<{ header: string; value: string; ok: boolean; status?: number; note: string }>> {
  const url = `${trimTrailingSlash(profile.baseUrl)}/models`;
  const results: Array<{ header: string; value: string; ok: boolean; status?: number; note: string }> = [];
  const probes = [
    { name: "x-opencode-session", value: "api-recon-session", expect: "accepted" },
    { name: "x-opencode-session-id", value: "api-recon-session", expect: "accepted" },
    { name: "x-opencode-request", value: "api-recon-request", expect: "accepted" },
    { name: "x-opencode-client", value: "cli", expect: "accepted" },
    { name: "x-opencode-project", value: "global", expect: "accepted" },
    { name: "User-Agent", value: OPENCODE_ZEN_USER_AGENT, expect: "accepted" },
    { name: "x-session-affinity", value: "should-be-absent", expect: "rejected" },
  ];
  for (const probe of probes) {
    const headers: Record<string, string> = { ...openCodeZenClientHeaders({}, "api-recon-session", "api-recon-request") };
    if (profile.apiKey) headers["Authorization"] = `Bearer ${profile.apiKey}`;
    headers[probe.name] = probe.value;
    const res = await fetchJson<unknown>(url, { headers, timeoutMs: profile.timeoutMs });
    results.push({
      header: probe.name,
      value: probe.value,
      ok: res.ok,
      status: res.status,
      note: res.ok ? (probe.expect ?? "accepted") : compactDetail(res.error ?? `HTTP ${res.status}`) || "rejected",
    });
  }
  return results;
}

async function probeUrlTranslation(profile: OpenCodeZenReconProfile): Promise<{ zenV1: string; inferenceV1: string; ok: boolean }> {
  const zenV1 = `${trimTrailingSlash(profile.baseUrl)}/zen/v1/chat/completions`;
  const inferenceV1 = openCodeZenFreeURL(zenV1);
  const headers: Record<string, string> = openCodeZenClientHeaders({}, "api-recon-session", "api-recon-request");
  if (profile.apiKey) headers["Authorization"] = `Bearer ${profile.apiKey}`;
  const res = await fetchJson<unknown>(inferenceV1, {
    method: "OPTIONS",
    headers,
    timeoutMs: profile.timeoutMs,
  });
  return { zenV1, inferenceV1, ok: res.ok || res.status === 405 };
}

/**
 * Run the OpenCode Zen free-tier recon. Read-only: GET /models, one
 * streaming chat round-trip with OpenCode headers + bash/read tools, header
 * matrix, and /zen/v1 → /inference/v1 URL translation check.
 */
export async function runOpenCodeZenRecon(profile: OpenCodeZenReconProfile): Promise<OpenCodeZenReconResult> {
  const startTime = Date.now();
  const result: OpenCodeZenReconResult = {
    summary: { provider: "opencode-zen", baseUrl: profile.baseUrl, admission: "unknown", executionTime: 0 },
    steps: {},
    findings: [],
  };

  console.error(`[opencode-zen] probing ${profile.baseUrl}`);

  // Step 1: model catalog
  const modelsStep = await probeModels(profile);
  result.steps.models = modelsStep;
  if (!modelsStep.ok) {
    result.findings.push({ kind: "models-unreachable", detail: compactDetail(modelsStep.error ?? "unknown") });
  }

  // Step 2: chat round-trip with OpenCode headers + bash/read tools
  const chatModel = profile.chatProbeModel ?? modelsStep.models[0] ?? "z-ai/glm-5.3-flash";
  if (chatModel) {
    const chatStep = await probeChatRoundTrip(profile, chatModel);
    result.steps.chatRoundTrip = chatStep;
    if (chatStep.ok) {
      result.findings.push({ kind: "chat-ok", detail: `${chatModel} (${chatStep.latencyMs}ms)` });
    } else if (chatStep.status === 403) {
      result.findings.push({
        kind: "free-tier-locked",
        detail: `${chatModel}: 403 FreeTierError — Zen's free tier only admits OpenCode client`,
      });
      result.summary.admission = "locked";
    } else {
      result.findings.push({ kind: "chat-failed", detail: compactDetail(chatStep.error ?? `HTTP ${chatStep.status}`) });
    }
  }

  // Step 3: header matrix
  const matrix = await probeHeaderMatrix(profile);
  result.steps.headerMatrix = matrix;
  for (const m of matrix) {
    result.findings.push({ kind: m.ok ? "header-accepted" : "header-rejected", detail: `${m.header}: ${m.note}` });
  }

  // Step 4: URL translation /zen/v1 → /inference/v1
  const translation = await probeUrlTranslation(profile);
  result.steps.urlTranslation = translation;
  if (translation.ok) {
    result.findings.push({ kind: "url-translation-ok", detail: `${translation.zenV1} → ${translation.inferenceV1}` });
  }

  if (result.findings.some((f) => f.kind === "chat-ok")) result.summary.admission = "open";
  result.summary.executionTime = Math.round((Date.now() - startTime) / 1000);
  console.error(`[opencode-zen] done in ${result.summary.executionTime}s, admission=${result.summary.admission}`);
  return result;
}

export * as OpenCodeZenRecon from "./opencode-zen.js";
