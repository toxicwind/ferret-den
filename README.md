# ferret-den

An MCP door for a recon pack. Callers ask the den to do a job. The pack names stay under the floor.

One process. stdio JSON-RPC. Absolute argv, no shell. Input is cleaned before a spawn. Each job has its own timeout.

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
| `den:fang` | bite with templates. `confirm: true` |
| `den:raid` | full raid: sniff, call, scratch, nose, tunnel, bite |
| `den:keeper` | keep the pack installed. `confirm: true` |
| `den:expose` | turn over exposed panels |
| `den:chatter` | carry a message out. `confirm: true` |
| `den:shadow` | sit in the path. `confirm: true` |
| `den:scatter` | pull the scattered name set |
| `den:cloak` | see if a host is wearing a cloak |
| `den:range` | map the range |
| `den:mutate` | mutate a name into more names |
| `den:warren` | map the warren |
| `den:cloudkit` | list the kits stashed in cloud |
| `den:turf` | find the turf a name sits on |
| `den:denhome` | serve the den. `confirm: true`, dies at 8 seconds |
| `den:muse` | ask the den muse |
| `den:roster` | list the overlay |

The first nine are typed spawns. The rest go through the kit: cleaned argv, no shell, 120 second cap. `den:roster` is the map.

`scripts/link-bins.sh` lays the same names over the bin directory. That is the overlay on disk. The door does not accept the old names.

## Install

```sh
cp .env.example .env
sh scripts/write-env.sh
sh scripts/link-bins.sh
bun install
bun src/index.ts
```

`PD_TOOLS_DIR` is the bin directory. Default `$HOME/.pdtm/go/bin`. `.env` is not committed.

## Layout

- `src/index.ts` — the door
- `src/den-names.ts` — the overlay
- `src/tools/` — typed spawns
- `src/tools/kit.ts` — the rest of the pack
- `src/workflows/bug-bounty.ts` — the raid
- `scripts/link-bins.sh` — names on the bin directory
- `scripts/write-env.sh` — write `.env` from that directory

Lineage: hardened fork of [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp), MIT.
