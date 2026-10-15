#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { executeSubfinder } from "./tools/subfinder.js";
import { executeDnsx } from "./tools/dnsx.js";
import { executeNaabu } from "./tools/naabu.js";
import { executeHttpx } from "./tools/httpx.js";
import { executeKatana } from "./tools/katana.js";
import { executeNuclei } from "./tools/nuclei.js";
import { executeTlsx } from "./tools/tlsx.js";
import { executeShuffledns } from "./tools/shuffledns.js";
import { runApiReconWorkflow, type ApiReconProfile } from "./workflows/api-recon.js";
import { runFreeInferenceRecon } from "./workflows/freeinference.js";
import { runCloudflareRecon } from "./workflows/cloudflare.js";
import { runReconWorkflow } from "./workflows/recon.js";
import { runBugBountyWorkflow } from "./workflows/bug-bounty.js";
import { cleanDomain, cleanList, cleanPortSpec, withHeavyGate, checkAllBinaries } from "./tools/runner.js";
import { DEN, resolveDen } from "./den-names.js";
import { executeKit } from "./tools/kit.js";

function toList(input: unknown): string[] {
  if (Array.isArray(input)) return cleanList(input);
  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return [];
    return s.includes(",") ? cleanList(s.split(",")) : cleanList([s]);
  }
  return [];
}

function sanitizeDomain(d: unknown): string {
  let s = String(d ?? "").trim().toLowerCase();
  s = s.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  return cleanDomain(s);
}

// ferret-den MCP server. Hardened fork of intelligent-ears/pd-tools-mcp (MIT).
// Binaries resolve via PD_TOOLS_DIR ($HOME/.pdtm/go/bin) and
// SHUFFLEDNS_BIN ($HOME/.pdtm/go/bin/shuffledns); per-binary override
// PD_<NAME>_BIN. All spawns are absolute-path argv, no shell, with timeouts.

const server = new Server(
  {
    name: "den",
    version: "1.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

function toolResult(result: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

function toolError(name: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: `Error executing ${name}: ${msg}` }],
    isError: true,
  };
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const baseTools = [
      {
        name: "subfinder",
        description: "Discover subdomains for a given domain using passive sources",
        inputSchema: {
          type: "object",
          properties: {
            domain: { type: "string", description: "Target domain (e.g., example.com)" },
            silent: { type: "boolean", description: "Show only subdomains in output" },
          },
          required: ["domain"],
        },
      },
      {
        name: "dnsx",
        description: "Resolve DNS records for domains and subdomains",
        inputSchema: {
          type: "object",
          properties: {
            domains: { type: "array", items: { type: "string" }, description: "List of domains to resolve" },
            recordType: { type: "string", description: "DNS record type (A, AAAA, CNAME, etc.)" },
            resolvers: { type: "array", items: { type: "string" }, description: "Custom DNS resolvers (e.g. 8.8.8.8)" },
          },
          required: ["domains"],
        },
      },
      {
        name: "naabu",
        description: "Fast port scanner to discover open ports on hosts",
        inputSchema: {
          type: "object",
          properties: {
            hosts: { type: "array", items: { type: "string" }, description: "List of hosts to scan" },
            ports: { type: "string", description: "Ports to scan (e.g., '80,443' or '1-1000')" },
            topPorts: { type: "number", description: "Scan top N ports (default 100, max 1000)" },
            scanType: { type: "string", description: "c = connect scan (unprivileged, default), s = SYN scan (needs root)" },
          },
          required: ["hosts"],
        },
      },
      {
        name: "httpx",
        description: "Probe HTTP/HTTPS servers and gather information",
        inputSchema: {
          type: "object",
          properties: {
            urls: { type: "array", items: { type: "string" }, description: "List of URLs or hosts to probe" },
            followRedirects: { type: "boolean", description: "Follow HTTP redirects" },
            techDetect: { type: "boolean", description: "Enable technology detection (wappalyzer)" },
          },
          required: ["urls"],
        },
      },
      {
        name: "katana",
        description: "Fast web crawler for discovering endpoints and paths",
        inputSchema: {
          type: "object",
          properties: {
            urls: { type: "array", items: { type: "string" }, description: "List of URLs to crawl" },
            depth: { type: "number", description: "Crawl depth (default: 2, max: 5)" },
            scope: { type: "string", description: "Field scope filter (e.g., dn, rdn)" },
            maxDurationSeconds: { type: "number", description: "Max crawl duration in seconds (max 600)" },
          },
          required: ["urls"],
        },
      },
      {
        name: "nuclei",
        description: "Fast vulnerability scanner using YAML-based templates",
        inputSchema: {
          type: "object",
          properties: {
            targets: { type: "array", items: { type: "string" }, description: "List of targets to scan" },
            templateIds: { type: "array", items: { type: "string" }, description: "Nuclei template IDs to run (e.g. http-missing-security-headers)" },
            severity: { type: "array", items: { type: "string" }, description: "Filter by severity (critical, high, medium, low, info)" },
            confirm: { type: "boolean", description: "MUST be true - nuclei is destructive-gated" },
          },
          required: ["targets", "confirm"],
        },
      },
      {
        name: "tlsx",
        description: "Probe TLS/SSL configuration: versions, ciphers, cert expiry, self-signed, wildcard",
        inputSchema: {
          type: "object",
          properties: {
            hosts: { type: "array", items: { type: "string" }, description: "List of hosts to probe" },
            port: { type: "number", description: "TLS port (default: 443)" },
          },
          required: ["hosts"],
        },
      },
      {
        name: "shuffledns",
        description: "Active subdomain brute-forcing with a wordlist",
        inputSchema: {
          type: "object",
          properties: {
            domain: { type: "string", description: "Target domain (e.g., example.com)" },
            wordlist: { type: "string", description: "Absolute path to wordlist file on the MCP host" },
            resolvers: { type: "array", items: { type: "string" }, description: "Custom DNS resolvers" },
          },
          required: ["domain", "wordlist"],
        },
      },
      {
        name: "bug_bounty_workflow",
        description:
          "Execute complete bug bounty reconnaissance workflow: subdomain discovery, DNS resolution, port scanning, HTTP probing, crawling, and vulnerability scanning",
        inputSchema: {
          type: "object",
          properties: {
            domain: { type: "string", description: "Target domain for bug bounty reconnaissance" },
            portScan: { type: "boolean", description: "Include port scanning (default: true)" },
            crawl: { type: "boolean", description: "Include web crawling (default: true)" },
            vulnerabilityScan: { type: "boolean", description: "Include vulnerability scanning (default: true)" },
            severityFilter: { type: "array", items: { type: "string" }, description: "Nuclei severity filter (critical, high, medium, low)" },
           "maxCrawlUrls": { "type": "number", "description": "Maximum URLs to crawl (default: 10)" },
           "maxScanUrls": { "type": "number", "description": "Maximum URLs to scan with Nuclei (default: 20)" },
           "maxTopPorts": { "type": "number", "description": "Maximum top ports for Naabu (default: 100)" },
           "batchSize": { "type": "number", "description": "Batch size for DNS/HTTP requests (default: 50)" },
           "delayBetweenBatches": { "type": "number", "description": "Delay in milliseconds between batches (default: 1000)" },
           "crawlDepth": { "type": "number", "description": "Crawl depth for Katana (default: 2)" },
          },
          required: ["domain"],
        },
      },
      {
        name: "recon_workflow",
        description:
          "Execute optimization-focused surface recon: subdomain discovery, DNS resolution, HTTP probing, TLS probing, and crawling to surface API endpoints and header behaviors humans miss. Read-only.",
        inputSchema: {
          type: "object",
          properties: {
            domain: { type: "string", description: "Target domain for recon" },
            crawl: { type: "boolean", "description": "Include web crawling (default: true)" },
            crawlDepth: { type: "number", "description": "Crawl depth for Katana (default: 2)" },
            resolveSubdomains: { type: "boolean", "description": "Resolve discovered subdomains (default: true)" },
          },
          required: ["domain"],
        },
      },
      {
        name: "api_recon_workflow",
        description:
          "Universal OpenAI-compatible v1 endpoint recon: GET /models, chat round-trip, embeddings probe, header matrix (alt auth, tracing, reasoning passthrough), Anthropic gateway probe, and local qdrant health. Read-only. Supply a profile or one of the named providers.",
        inputSchema: {
          type: "object",
          properties: {
            provider: { type: "string", "description": "Named provider to load a built-in profile for: freeinference, cloudflare" },
            baseUrl: { type: "string", "description": "Base URL when using a custom profile, e.g. https://freeinference.org/v1" },
            apiKey: { type: "string", "description": "API key for auth (Bearer by default)" },
            altAuthHeader: { type: "string", "description": "Alternative auth header name, e.g. X-API-Key" },
            anthropicBaseUrl: { type: "string", "description": "Anthropic-shaped gateway base URL if the provider has one" },
            localQdrantUrl: { type: "string", "description": "Local qdrant URL for the vector-store step (default http://127.0.0.1:25133)" },
            chatProbeModel: { type: "string", "description": "Model for the chat round-trip probe" },
            embeddingModel: { type: "string", "description": "Embedding model to probe" },
            documentedModels: { "type": "array", "items": { "type": "string" }, "description": "Models the docs claim exist; checked against the live /models list" },
          },
          required: ["provider"],
        },
      },
      {
        name: "freeinference_recon_workflow",
        description:
          "FreeInference provider recon: verifies every documented claim empirically (glm-5.1 existence, X-API-Key alt auth, X-Request-ID echo, X-Session-ID, X-Reasoning-Passthrough, bge-m3 embeddings, /anthropic/v1 gateway, /v1/qdrant proxy). Docs are an unreliable narrator — probes are ground truth.",
        inputSchema: {
          type: "object",
          properties: {
            apiKey: { type: "string", "description": "FreeInference API key" },
            chatProbeModel: { type: "string", "description": "Model for chat round-trip (default glm-5.3-flash)" },
            embeddingModel: { type: "string", "description": "Embedding model (default bge-m3)" },
            localQdrantUrl: { type: "string", "description": "Local qdrant URL (default http://127.0.0.1:25133)" },
          },
          required: ["apiKey"],
        },
      },
      {
        name: "cloudflare_recon_workflow",
        description:
          "Cloudflare AI Gateway recon: probes the gateway's /models, chat round-trip, embeddings, and records what the gateway actually exposes so config only wires models that respond.",
        inputSchema: {
          type: "object",
          properties: {
            apiToken: { type: "string", "description": "Cloudflare API token" },
            accountId: { type: "string", "description": "Cloudflare account id" },
            gatewayId: { type: "string", "description": "AI Gateway name (slug)" },
            chatProbeModel: { type: "string", "description": "Model for chat round-trip" },
            embeddingModel: { type: "string", "description": "Embedding model to probe" },
          },
          required: ["apiToken", "accountId", "gatewayId"],
        },
      },
    ];
  const denTools = DEN.filter((d) => d.bin === "bug_bounty_workflow" || baseTools.some((t) => t.name === d.bin)).map((d) => {
    const base = baseTools.find((t) => t.name === d.bin);
    const kitSchema = {
      type: "object",
      properties: {
        target: { type: "string", description: "Primary target, host, or name" },
        args: { type: "array", items: { type: "string" }, description: "Extra argv, no shell" },
        confirm: { type: "boolean", description: "Required for gated jobs" },
      },
    };
    return {
      name: d.den,
      description: d.job,
      inputSchema: base?.inputSchema || kitSchema,
    };
  });
  const roster = [{
    name: "roster",
    description: "List the den overlay: name and job.",
    inputSchema: { type: "object", properties: {} },
  }];
  return { tools: [...denTools, ...roster] };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name: rawName, arguments: args } = request.params;
  if (rawName === "roster") return toolResult(DEN.map(({ den, job }) => ({ den, job })));
  const den = resolveDen(rawName);
  if (!den) throw new Error(`unknown den tool: ${rawName}`);
  const name = den.bin;
  const a = (args ?? {}) as Record<string, any>;
  if (den.gated && a.confirm !== true) {
    throw new Error(`${den.den} is gated: pass confirm true`);
  }

  try {
    switch (name) {
      case "subfinder": {
        const domain = sanitizeDomain(a.domain ?? a.target);
        return toolResult(await executeSubfinder(domain, a.silent !== false));
      }

      case "dnsx": {
        const domains = toList(a.domains ?? a.target ?? a.domain);
        if (domains.length === 0) throw new Error("target, domain, or domains must be provided");
        const recordType = a.recordType ?? (Array.isArray(a.types) ? a.types.join(",") : a.types);
        const resolvers = toList(a.resolvers ?? a.resolver);
        return toolResult(await executeDnsx(domains, recordType, resolvers));
      }

      case "naabu": {
        const hosts = toList(a.hosts ?? a.target ?? a.host);
        if (hosts.length === 0) throw new Error("target, host, or hosts must be provided");
        const scanType = a.scanType === "s" ? "s" : "c";
        const ports = cleanPortSpec(a.ports);
        const topPorts = a.topPorts ?? a.top_ports;
        return toolResult(
          await withHeavyGate("naabu", () =>
            executeNaabu(hosts, ports, topPorts, scanType)
          )
        );
      }

      case "httpx": {
        const urls = toList(a.urls ?? a.target ?? a.url);
        if (urls.length === 0) throw new Error("target, url, or urls must be provided");
        const followRedirects = !!(a.followRedirects ?? a.follow_redirects ?? false);
        const techDetect = a.techDetect ?? a.tech_detect ?? a.include_title ?? true;
        return toolResult(
          await executeHttpx(urls, followRedirects, !!techDetect)
        );
      }

      case "katana": {
        const urls = toList(a.urls ?? a.target ?? a.url);
        if (urls.length === 0) throw new Error("target, url, or urls must be provided");
        return toolResult(
          await executeKatana(urls, a.depth ?? 2, a.scope, a.maxDurationSeconds ?? a.timeout_sec)
        );
      }

      case "nuclei": {
        if (a.confirm !== true) {
          throw new Error(
            "nuclei is destructive-gated: pass confirm:true to actually scan."
          );
        }
        const targets = toList(a.targets ?? a.target);
        if (targets.length === 0) throw new Error("target or targets must be provided");
        const templateIds = toList(a.templateIds ?? a.templates ?? a.template);
        const severity = Array.isArray(a.severity) ? a.severity : (typeof a.severity === "string" ? a.severity.split(",") : undefined);
        return toolResult(
          await withHeavyGate("nuclei", () =>
            executeNuclei(targets, templateIds, severity)
          )
        );
      }

      case "tlsx": {
        const hosts = toList(a.hosts ?? a.target ?? a.host);
        if (hosts.length === 0) throw new Error("target, host, or hosts must be provided");
        return toolResult(await executeTlsx(hosts, a.port ?? 443));
      }

      case "shuffledns": {
        const domain = sanitizeDomain(a.domain ?? a.target);
        if (typeof a.wordlist !== "string") {
          throw new Error("wordlist must be a string");
        }
        const resolvers = toList(a.resolvers ?? a.resolver);
        return toolResult(
          await withHeavyGate("shuffledns", () =>
            executeShuffledns(domain, a.wordlist, resolvers)
          )
        );
      }

      case "bug_bounty_workflow": {
        const domain = sanitizeDomain(a.domain ?? a.target);
        return toolResult(
          await runBugBountyWorkflow(domain, {
            portScan: a.portScan ?? true,
            crawl: a.crawl ?? true,
            vulnerabilityScan: a.vulnerabilityScan ?? true,
            severityFilter: a.severityFilter,
            rateLimit: {
              maxCrawlUrls: a.maxCrawlUrls,
              maxScanUrls: a.maxScanUrls,
              maxTopPorts: a.maxTopPorts,
              batchSize: a.batchSize,
              delayBetweenBatches: a.delayBetweenBatches,
              crawlDepth: a.crawlDepth,
            },
          })
        );
      }
      case "recon_workflow": {
        const domain = sanitizeDomain(a.domain ?? a.target);
        return toolResult(
          await runReconWorkflow(domain, {
            crawl: a.crawl ?? true,
            crawlDepth: a.crawlDepth ?? 2,
            resolveSubdomains: a.resolveSubdomains ?? true,
          })
        );
      }
      case "api_recon_workflow": {
        const provider = String(a.provider ?? "");
        if (provider === "freeinference") {
          if (!a.apiKey) throw new Error("api_recon_workflow: apiKey required for freeinference");
        return toolResult(
            await runFreeInferenceRecon({
              apiKey: String(a.apiKey),
              chatProbeModel: a.chatProbeModel,
              embeddingModel: a.embeddingModel,
              localQdrantUrl: a.localQdrantUrl,
              documentedModels: a.documentedModels,
          })
        );
      }
        if (provider === "cloudflare") {
          if (!a.apiToken || !a.accountId || !a.gatewayId)
            throw new Error("api_recon_workflow: apiToken, accountId, gatewayId required for cloudflare");
        return toolResult(
            await runCloudflareRecon({
              apiToken: String(a.apiToken),
              accountId: String(a.accountId),
              gatewayId: String(a.gatewayId),
              chatProbeModel: a.chatProbeModel,
              embeddingModel: a.embeddingModel,
              localQdrantUrl: a.localQdrantUrl,
          })
        );
      }
        if (!a.baseUrl) throw new Error("api_recon_workflow: baseUrl required for custom profiles");
        const profile: ApiReconProfile = {
          provider: provider || "custom",
          baseUrl: String(a.baseUrl),
          apiKey: a.apiKey ? String(a.apiKey) : undefined,
          altAuthHeader: a.altAuthHeader ? String(a.altAuthHeader) : undefined,
          anthropicBaseUrl: a.anthropicBaseUrl ? String(a.anthropicBaseUrl) : undefined,
          localQdrantUrl: a.localQdrantUrl ?? "http://127.0.0.1:25133",
          chatProbeModel: a.chatProbeModel,
          embeddingModel: a.embeddingModel,
          documentedModels: a.documentedModels,
        };
        return toolResult(await runApiReconWorkflow(profile));
      }
      case "freeinference_recon_workflow": {
        if (!a.apiKey) throw new Error("freeinference_recon_workflow: apiKey required");
        return toolResult(
          await runFreeInferenceRecon({
            apiKey: String(a.apiKey),
            chatProbeModel: a.chatProbeModel,
            embeddingModel: a.embeddingModel,
            localQdrantUrl: a.localQdrantUrl,
          })
        );
      }
      case "cloudflare_recon_workflow": {
        if (!a.apiToken || !a.accountId || !a.gatewayId)
          throw new Error("cloudflare_recon_workflow: apiToken, accountId, gatewayId required");
        return toolResult(
          await runCloudflareRecon({
            apiToken: String(a.apiToken),
            accountId: String(a.accountId),
            gatewayId: String(a.gatewayId),
            chatProbeModel: a.chatProbeModel,
            embeddingModel: a.embeddingModel,
            localQdrantUrl: a.localQdrantUrl,
          })
        );
      }

      default: {
        if (!den) throw new Error(`Unknown tool: ${rawName}`);
        if (den.gated && a.confirm !== true) {
          throw new Error(`${den.den} is gated: pass confirm true`);
        }
        return toolResult(await executeKit(den.bin, a.target ?? a.domain ?? a.host, a.args));
      }
    }
  } catch (error) {
    return toolError(name, error);
  }
});

// Start the server
async function main() {
  // Fail fast if binaries are missing (grafted from estate pd-mcp).
  // 2026-10-15, safety directive: workflows are NOT auto-run at startup
  // unless scheduled. On missing binaries the server aborts loudly with the
  // fix command — the installer only ever runs when explicitly invoked
  // (bun run install-bins) or scheduled by the operator.
  try {
    checkAllBinaries();
  } catch (err) {
    console.error(`[ferret-den] missing kit member: ${(err as Error).message}`);
    console.error("[ferret-den] fix with:  cd ferret-den && bun run install-bins");
    console.error("[ferret-den] (installer is explicit-only; it is never auto-run)");
    throw err;
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ferret-den MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
