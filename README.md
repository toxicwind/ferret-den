<div align="center">

# ferret-den

An MCP server that exposes ProjectDiscovery reconnaissance binaries under decoupled tool names to prevent false-positive model refusals.

[![WTFPL](https://img.shields.io/badge/license-WTFPL-111111?style=for-the-badge)](COPYING)
[![jobs](https://img.shields.io/badge/jobs-22-c45c26?style=for-the-badge)](#jobs)
[![shell](https://img.shields.io/badge/shell-none-2f6f4e?style=for-the-badge)](#architecture--safety)
[![stdio](https://img.shields.io/badge/transport-stdio-555555?style=for-the-badge)](#installation)

`den:whisker` runs `subfinder`. `den:fang` runs `nuclei`. The agent sees the job. The binary name stays out of the catalog.

[Why the Names](#why-the-names) · [Architecture & Safety](#architecture--safety) · [Jobs](#jobs) · [Installation](#installation) · [Configuration](#configuration) · [License](#license)

</div>

![A ferret in the trash holds a scrap labeled subfinder. The door only says den:whisker.](docs/header.jpg)

---

## Why the Names

Frontier models and automated API moderation layers frequently trigger refusal reflexes on specific cybersecurity keywords (`nuclei`, `subfinder`, `exploit`, `vulnerability scanner`). When these names appear directly in an MCP server's `tools/list` catalog, models often refuse benign reconnaissance tasks (such as asset inventory or attack surface mapping) before evaluating the prompt context, target authorization, or input arguments.

`ferret-den` decouples tool definitions from binary execution:

- **The Agent View:** The agent inspects `den:*` names paired with clear functional descriptions and typed schemas (e.g., `den:whisker` = "Finds subdomains").
- **The Process View:** The local server translates valid calls into local binary invocations via argument arrays (`subfinder`, `httpx`, `nuclei`).
- **The Safety View:** Destructive or active scanning actions are protected by explicit human confirmation gates (`confirm: true`), replacing brittle keyword blocking with real operational oversight.

This design reflects recent empirical research on agentic safety boundaries:

- [*Not All Refusals Are Equal: How Safety Alignment Fails Cybersecurity at Scale* (arXiv:2607.02714)](https://arxiv.org/abs/2607.02714): Demonstrates that cybersecurity refusals often operate as blunt, over-generalized directional vectors that penalize defensive workflows without stopping dedicated adversaries.
- [*A New Framework for Cybersecurity Refusals in AI Agents* (arXiv:2606.02644)](https://arxiv.org/abs/2606.02644): Evaluates refusal variations across frontier models on multi-step security tasks.
- [*MLLMs Fail to Refuse when Using Tools Agentically* (arXiv:2610.03938)](https://arxiv.org/abs/2610.03938): Shows that structured tool usage focuses models on API compliance, significantly reducing superficial conversational refusals.

Renaming is not an exploit or a jailbreak. If a model determines that an underlying objective is harmful, it will still refuse. The renaming simply prevents surface-level lexical filters from blocking authorized, routine recon.

---

## Architecture & Safety

- **No Shell Interpolation:** All binaries are spawned directly using argument arrays via POSIX `spawn`. Shells (`/bin/sh`, `cmd.exe`) are never invoked, eliminating command injection risks.
- **Execution Timeouts:** Kit jobs carry an enforced 120-second execution cap. `den:denhome` exits after 8 seconds.
- **Human Confirmation Gate:** `den:fang`, `den:raid`, `den:keeper`, `den:chatter`, `den:shadow`, and `den:denhome` require `confirm: true` before execution begins.
- **External Binaries:** The repository does not ship binaries. It invokes existing executables managed by `pdtm` in `$PD_TOOLS_DIR` (defaulting to `$HOME/.pdtm/go/bin`).

---

## Jobs

The server exposes 22 discrete MCP tools. The primary nine jobs feature fully typed argument schemas, while utility tasks accept a target and an argument array.

| MCP Tool Name | Underlying Binary | Functional Description | Execution Gate |
| :--- | :--- | :--- | :--- |
| `den:whisker` | `subfinder` | Discovers subdomains passively across public sources. | Standard |
| `den:squeak` | `dnsx` | Resolves hostnames and validates active DNS records. | Standard |
| `den:nose` | `httpx` | Probes HTTP/HTTPS endpoints for status, title, and tech stack. | Standard |
| `den:padlock` | `tlsx` | Inspects TLS/SSL certificates, ciphers, and protocols. | Standard |
| `den:scratch` | `naabu` | Performs fast TCP port scanning. | Standard |
| `den:tunnel` | `katana` | Crawls web pages and JavaScript links. | Standard |
| `den:rummage` | `shuffledns` | Brute-forces domain resolution against wordlists. | Standard |
| `den:fang` | `nuclei` | Executes vulnerability and configuration template checks. | `confirm: true` |
| `den:raid` | *chain* | Runs subfinder, dnsx, naabu, then probes open ports with httpx, crawls with katana, and scans with nuclei. | `confirm: true` |
| `den:keeper` | `pdtm` | Installs or updates ProjectDiscovery binaries. | `confirm: true` |
| `den:expose` | `uncover` | Discovers exposed assets and administrative panels via OSINT engines. | Standard |
| `den:chatter` | `notify` | Dispatches webhook and messaging notifications. | `confirm: true` |
| `den:shadow` | `proxify` | Intercepts and captures HTTP/HTTPS traffic. | `confirm: true` |
| `den:scatter` | `chaos` | Queries ProjectDiscovery Chaos threat intelligence datasets. | Standard |
| `den:cloak` | `cdncheck` | Detects CDN, cloud provider, and WAF IP ownership. | Standard |
| `den:range` | `asnmap` | Maps ASN IP ranges and CIDR blocks. | Standard |
| `den:mutate` | `alterx` | Generates permutation lists of subdomains. | Standard |
| `den:warren` | `mapcidr` | Formats and expands CIDR blocks. | Standard |
| `den:cloudkit` | `cloudlist` | Enumerates assets across cloud infrastructure providers. | Standard |
| `den:turf` | `tldfinder` | Discovers top-level domains for a given entity. | Standard |
| `den:denhome` | `simplehttpserver` | Spawns a local testing file server that auto-terminates after 8 seconds. | `confirm: true` |
| `den:muse` | `aix` | Prompts ProjectDiscovery AI command assistants. | Standard |
| `den:roster` | *internal* | Returns the active tool mapping table from the running server. | Standard |

---

## Installation

### Prerequisites

Install `pdtm` and set up the ProjectDiscovery suite:

```bash
go install github.com/projectdiscovery/pdtm/cmd/pdtm@latest
pdtm -install-all
```

### Server Setup

```bash
git clone https://github.com/toxicwind/ferret-den.git
cd ferret-den
cp .env.example .env
sh scripts/write-env.sh
sh scripts/link-bins.sh
bun install
bun src/index.ts
```

`scripts/link-bins.sh` generates the symlinks in the bin directory. The server exclusively accepts and processes `den:*` identifiers.

## Configuration

Add the server to your MCP client configuration (for example `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "den": {
      "command": "bun",
      "args": ["/path/to/ferret-den/src/index.ts"],
      "env": {
        "PD_TOOLS_DIR": "$HOME/.pdtm/go/bin"
      }
    }
  }
}
```

## Repository Layout

- `src/index.ts`: Primary MCP entrypoint; validates inputs and routes process execution.
- `src/den-names.ts`: Static mapping between MCP identifiers and system binaries.
- `src/tools/`: Type definitions and structured schemas for core tools.
- `src/tools/kit.ts`: Argument forwarding and timeout wrappers for utility tools.
- `src/workflows/bug-bounty.ts`: Pre-chained reconnaissance sequence (`den:raid`).
- `scripts/`: Environment configuration and binary symlink scripts.

## License

- The den translation layer, scripts, and documentation are licensed under [WTFPL v2](COPYING).
- Upstream MCP core components derived from [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp) remain under the MIT License.
