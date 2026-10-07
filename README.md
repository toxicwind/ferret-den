<div align="center">

# ferret-den

An MCP server that exposes ProjectDiscovery reconnaissance binaries under decoupled tool names to prevent false-positive model refusals.

[![WTFPL](https://img.shields.io/badge/license-WTFPL-111111?style=for-the-badge)](COPYING)
[![jobs](https://img.shields.io/badge/jobs-22-c45c26?style=for-the-badge)](#jobs)
[![shell](https://img.shields.io/badge/shell-none-2f6f4e?style=for-the-badge)](#architecture--safety)
[![stdio](https://img.shields.io/badge/transport-stdio-555555?style=for-the-badge)](#installation)

`den:whisker` runs subfinder. `den:fang` runs nuclei. The connected agent sees the job and the schema. The canonical binary names never appear in the tool catalog.

[Why the names](#why-the-names) · [Architecture and safety](#architecture--safety) · [Jobs](#jobs) · [Installation](#installation) · [Configuration](#configuration) · [License](#license)

</div>

This is an agent-facing translation layer, not a human command-line wrapper. An MCP client lists `den:*` tools. The local server turns a valid call into a ProjectDiscovery binary. A person who wants to type `subfinder` should install [pdtm](https://github.com/projectdiscovery/pdtm) and skip this repository.

## Why the names

Frontier models and API moderation layers often refuse on cybersecurity keywords such as `nuclei`, `subfinder`, and `vulnerability scanner`. When those words sit in an MCP `tools/list` catalog, a model can refuse a benign inventory job before it reads the target, the authorization, or the arguments.

ferret-den splits the tool definition from the process:

- The agent sees `den:*` names, a functional description, and a typed schema. `den:whisker` is "finds subdomains."
- The server turns a valid call into a local spawn. The binary is still `subfinder`, `httpx`, or `nuclei`.
- Active or destructive jobs require `confirm: true`. That is an operator gate, not a keyword filter.

The papers describe the refusal problem. They do not say a rename is a bypass.

- [Not All Refusals Are Equal](https://arxiv.org/abs/2607.02714) treats cybersecurity refusal as its own direction, wide enough to catch defensive work.
- [A New Framework for Cybersecurity Refusals in AI Agents](https://arxiv.org/abs/2606.02644) measures how frontier agents refuse, or fail to refuse, offensive web tasks.
- [MLLMs Fail to Refuse when Using Tools Agentically](https://arxiv.org/abs/2610.03938) finds that structured tool use can lower conversational refusal.

Renaming is not a jailbreak. If the model decides the objective is harmful, it can still refuse. The rename only stops a lexical filter from blocking the call before that decision.

## Architecture and safety

- There is no shell. Binaries are spawned with an argument array. `/bin/sh` is never invoked.
- Kit jobs die at 120 seconds. `den:denhome` dies at 8 seconds.
- `den:fang`, `den:raid`, `den:keeper`, `den:chatter`, `den:shadow`, and `den:denhome` do not run unless `confirm` is true.
- This repository does not ship binaries. It uses the pdtm install in `$PD_TOOLS_DIR`, which defaults to `$HOME/.pdtm/go/bin`.
- The server does not store output. The client does.

```
agent -> MCP -> den:whisker -> subfinder -> text
```

## Jobs

The first nine jobs have typed schemas. The rest take `target` and a short `args` array. `den:roster` returns the den names and jobs only. It does not return the binary column.

| MCP tool | Binary | What it does | Gate |
|---|---|---|---|
| `den:whisker` | subfinder | Discovers subdomains from public sources. | |
| `den:squeak` | dnsx | Resolves names and checks DNS records. | |
| `den:nose` | httpx | Probes HTTP for status, title, and technology. | |
| `den:padlock` | tlsx | Reads certificates, ciphers, and protocol versions. | |
| `den:scratch` | naabu | Scans TCP ports. | |
| `den:tunnel` | katana | Crawls pages and JavaScript links. | |
| `den:rummage` | shuffledns | Brute-forces names against a wordlist. | |
| `den:fang` | nuclei | Runs vulnerability and configuration templates. | `confirm: true` |
| `den:raid` | chain | Runs subfinder, dnsx, naabu, then probes the open ports with httpx, crawls, and scans with nuclei. | `confirm: true` |
| `den:keeper` | pdtm | Installs or updates the ProjectDiscovery binaries. | `confirm: true` |
| `den:expose` | uncover | Finds exposed assets and admin panels. | |
| `den:chatter` | notify | Sends a webhook or message. | `confirm: true` |
| `den:shadow` | proxify | Intercepts HTTP traffic. | `confirm: true` |
| `den:scatter` | chaos | Queries the Chaos dataset. | |
| `den:cloak` | cdncheck | Detects CDN, cloud, and WAF ranges. | |
| `den:range` | asnmap | Maps ASN ranges. | |
| `den:mutate` | alterx | Permutes subdomains. | |
| `den:warren` | mapcidr | Expands CIDR blocks. | |
| `den:cloudkit` | cloudlist | Lists cloud assets. | |
| `den:turf` | tldfinder | Finds top-level domains for a name. | |
| `den:denhome` | simplehttpserver | Serves files locally, then exits after 8 seconds. | `confirm: true` |
| `den:muse` | aix | Asks the ProjectDiscovery assistant. | |
| `den:roster` | | Returns the active den names from the running server. | |

## Installation

Install the binaries first. This repository does not include them.

```sh
go install github.com/projectdiscovery/pdtm/cmd/pdtm@latest
pdtm -install-all
```

Then run the server.

```sh
git clone https://github.com/toxicwind/ferret-den.git
cd ferret-den
cp .env.example .env
sh scripts/write-env.sh
sh scripts/link-bins.sh
bun install
bun src/index.ts
```

`scripts/link-bins.sh` symlinks the den names onto the binaries. The server still accepts only `den:*` names.

## Configuration

```json
{
  "mcpServers": {
    "den": {
      "command": "bun",
      "args": ["/path/to/ferret-den/src/index.ts"],
      "env": { "PD_TOOLS_DIR": "$HOME/.pdtm/go/bin" }
    }
  }
}
```

## Layout

- `src/index.ts` validates the call and spawns the binary.
- `src/den-names.ts` maps a den name to a binary.
- `src/tools/` holds the typed schemas.
- `src/tools/kit.ts` forwards cleaned arguments for the utility jobs.
- `src/workflows/bug-bounty.ts` is the `den:raid` chain.
- `scripts/write-env.sh` writes `.env`, which is not committed.
- `scripts/link-bins.sh` creates the symlinks.

The server started as a fork of [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp).

## License

Do what the fuck you want with the den names, the scripts, and this README. The terms are [WTFPL v2](COPYING).

The inherited server remains MIT. See `LICENSE`. Both notices stay.
