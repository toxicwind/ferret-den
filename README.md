# ferret-den

[![den](https://img.shields.io/badge/door-den-111111?style=for-the-badge)](https://github.com/toxicwind/ferret-den)
[![jobs](https://img.shields.io/badge/jobs-22-c45c26?style=for-the-badge)](https://github.com/toxicwind/ferret-den)
[![shell](https://img.shields.io/badge/shell-none-2f6f4e?style=for-the-badge)](https://github.com/toxicwind/ferret-den)
[![license](https://img.shields.io/badge/license-MIT-555555?style=for-the-badge)](LICENSE)

The model has GitHub. The model has search. The model has a browser. The model does not have a snout.

Give it a shell and it will invent flags, quote nothing, and call that reconnaissance. ferret-den is the door you put in front of the pack so the model asks for a job and gets a spawn. Absolute argv. Timeouts. No shell. The pack names stay under the floorboards, which is where a ferret keeps anything worth having.

```
model  ->  MCP client  ->  den  ->  binary  ->  a pile of text
```

Register the server as `den`. If you register it as anything else you have missed the bit.

## The jobs

`den:roster` will recite this if you do not trust the README. Correct instinct.

| Call | What the ferret actually does | Do not skip |
|---|---|---|
| `den:whisker` | sniffs out subdomains | |
| `den:squeak` | calls a name and reads who answers | |
| `den:nose` | noses a host for a live page | |
| `den:padlock` | checks the lock, the cert, the cipher | |
| `den:scratch` | scratches the doors for open ports | |
| `den:tunnel` | runs the tunnels and lists the paths | |
| `den:rummage` | rummages a wordlist | |
| `den:fang` | bites with templates | `confirm: true` or it will not |
| `den:raid` | the whole stupid chain | |
| `den:keeper` | keeps the pack installed | `confirm: true` |
| `den:expose` | turns over exposed panels | |
| `den:chatter` | carries a message out of the den | `confirm: true` |
| `den:shadow` | sits in the path and watches | `confirm: true` |
| `den:scatter` | pulls the scattered name set | |
| `den:cloak` | checks if the host is wearing a cloak | |
| `den:range` | maps the range | |
| `den:mutate` | mutates a name into more names | |
| `den:warren` | maps the warren | |
| `den:cloudkit` | lists the kits stashed in cloud | |
| `den:turf` | finds the turf a name sits on | |
| `den:denhome` | serves the den, then gets killed at 8 seconds | `confirm: true` |
| `den:muse` | ask the muse. it might even answer | |

The first nine are typed. The rest take `target` and a short `args` list. Args are cleaned. There is still no shell. `denhome` cannot stay up. That is not a bug. A den that serves forever is a burrow with the door off.

## Install

Bins live in `$PD_TOOLS_DIR`. Default `$HOME/.pdtm/go/bin`. The directory is a configuration. It is not the name of the door.

```sh
cp .env.example .env
sh scripts/write-env.sh
sh scripts/link-bins.sh
bun install
bun src/index.ts
```

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

`scripts/link-bins.sh` lays the same names over the bin directory. The door still will not answer to the old ones. That was the point.

## What it will not do

- It will not remember the last raid. The client keeps the pile.
- It will not run `fang` because you sounded sure.
- It will not grow a typed flag set for `muse`. Kit jobs return stderr when you guess.
- It will not become a model. The model is the thing that got lost and knocked.

## Layout

- `src/index.ts` — the door
- `src/den-names.ts` — the names on the door
- `src/tools/` — typed spawns
- `src/tools/kit.ts` — the rest of the pack, cleaned argv, 120 seconds
- `src/workflows/bug-bounty.ts` — the raid
- `scripts/write-env.sh` — writes `.env`, which is not committed
- `scripts/link-bins.sh` — names on the bin directory

Fork of [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp). MIT. The lineage can keep its own name. The door has one.
