# ferret-den

MCP server for the ProjectDiscovery bins. One process, eight tools, no shell.

stdio JSON-RPC with Content-Length framing. Spawns are absolute argv. Timeouts are per tool. Input is cleaned before it reaches a bin.

## Install

```sh
go install github.com/projectdiscovery/pdtm/cmd/pdtm@latest
./ferret install
bun install
bun src/index.ts
```

`PD_TOOLS_DIR` is the bin directory. Default `/home/toxic/.pdtm/go/bin`. `PD_<NAME>_BIN` overrides one tool. `SHUFFLEDNS_BIN` overrides shuffledns.

## Client

```json
{
  "mcpServers": {
    "ferret-den": {
      "command": "bun",
      "args": ["src/index.ts"],
      "env": { "PD_TOOLS_DIR": "/home/toxic/.pdtm/go/bin" }
    }
  }
}
```

## Tools

| Tool | Bin | Timeout |
|---|---|---|
| subfinder | subfinder | 5 min |
| dnsx | dnsx | 5 min |
| httpx | httpx | 5 min |
| tlsx | tlsx | 5 min |
| naabu | naabu | 10 min |
| katana | katana | 10 min |
| shuffledns | shuffledns | 10 min |
| nuclei | nuclei | 15 min |

`bug_bounty_workflow` runs the chain. `./ferret pull` is `pdtm -update-all`. Templates are a separate pull: `nuclei -update-templates`.

## Layout

- `src/index.ts` — MCP server
- `src/tools/` — one file per bin
- `src/workflows/bug-bounty.ts` — the chain
- `den-call.ts` — direct caller
- `AGENTS.md` — timeouts and path rules

Lineage: hardened fork of [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp), MIT. Bins stay upstream.
