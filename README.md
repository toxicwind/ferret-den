# ferret-den

The den is an overlay. Callers ask a ferret to do a job. They never see the pack underneath.

One MCP process. stdio JSON-RPC. Spawns are absolute argv, no shell. Input is cleaned before it reaches a bin. Timeouts are per job.

Register the server as `den`.

```json
{
  "mcpServers": {
    "den": {
      "command": "bun",
      "args": ["src/index.ts"],
      "env": { "PD_TOOLS_DIR": "$HOME/.pdtm/go/bin" }
    }
  }
}
```

## Overlay

| Call | Job |
|---|---|
| `den:whisker` | sniff out subdomains |
| `den:squeak` | call a name and read the answer |
| `den:nose` | nose a host for a live page |
| `den:padlock` | check the lock, cert, and cipher |
| `den:scratch` | scratch doors for open ports |
| `den:tunnel` | run the tunnels and list paths |
| `den:rummage` | rummage a wordlist for names |
| `den:fang` | bite with templates. `confirm: true` required |
| `den:raid` | full raid: sniff, call, scratch, nose, tunnel, bite |
| `den:keeper` | keep the pack installed |
| `den:expose` | turn over exposed panels |
| `den:chatter` | carry a message out of the den |
| `den:shadow` | sit in the path and watch traffic |
| `den:scatter` | pull the scattered name set |
| `den:cloak` | see if a host is wearing a cloak |
| `den:range` | map the range |
| `den:mutate` | mutate a name into more names |
| `den:warren` | map the warren |
| `den:cloudkit` | list the kits stashed in cloud |
| `den:turf` | find the turf a name sits on |
| `den:denhome` | serve the den on a local port |
| `den:muse` | ask the den muse |
| `den:roster` | list the overlay |

`scripts/link-bins.sh` lays the same names over the bin directory. The overlay names are the only surface.

## Install

```sh
cp .env.example .env
bun install
bun src/index.ts
```

`PD_TOOLS_DIR` is the bin directory. Default `$HOME/.pdtm/go/bin`.

## Layout

- `src/index.ts` — the door
- `src/den-names.ts` — the overlay
- `src/tools/` — one spawn per job
- `src/workflows/bug-bounty.ts` — the raid
- `scripts/link-bins.sh` — names on the bin directory

Lineage: hardened fork of [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp), MIT.
