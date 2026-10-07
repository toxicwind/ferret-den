<div align="center">

# ferret-den

A ferret does not leave the pack names on the door.

[![license](https://img.shields.io/github/license/toxicwind/ferret-den?style=for-the-badge)](LICENSE)
[![stars](https://img.shields.io/github/stars/toxicwind/ferret-den?style=for-the-badge)](https://github.com/toxicwind/ferret-den/stargazers)
[![jobs](https://img.shields.io/badge/jobs-22-c45c26?style=for-the-badge)](https://github.com/toxicwind/ferret-den)
[![shell](https://img.shields.io/badge/shell-none-2f6f4e?style=for-the-badge)](https://github.com/toxicwind/ferret-den)

MCP server for the ProjectDiscovery recon bins. The agent calls a den job. The server spawns the bin. No shell.

[Why the names](#why-the-names) · [Jobs](#jobs) · [Install](#install)

</div>

> You are downloading a door. The scanners still come from [pdtm](https://github.com/projectdiscovery/pdtm). `whisker` is subfinder. `fang` is nuclei. If that sentence is enough, skip the lore.

## Why the names

A ferret caches food where the casual walker will not look. Same trick.

The model already has GitHub, search, and a browser. Point it at a shell and it will type `subfinder` from memory, invent a flag, and call the mess reconnaissance. The door does not offer that word. It offers `whisker`. The spawn underneath is still the real binary, absolute argv, timeout, cleaned input.

The obfuscation is the tool list, not the install. You can read this table and know what you ran. The agent cannot shop the catalog by the pack names, because those names are not tools. That is the whole den.

```
model  ->  MCP client  ->  den:whisker  ->  subfinder  ->  text
```

## Jobs

`den:roster` returns this from the running server, without the bin column. The bin column is for you.

| Call | Bin | Job | Gate |
|---|---|---|---|
| `den:whisker` | subfinder | subdomains | |
| `den:squeak` | dnsx | resolve names | |
| `den:nose` | httpx | probe live HTTP | |
| `den:padlock` | tlsx | TLS version, cipher, cert | |
| `den:scratch` | naabu | open ports | |
| `den:tunnel` | katana | crawl paths | |
| `den:rummage` | shuffledns | wordlist brute | |
| `den:fang` | nuclei | template scan | `confirm: true` |
| `den:raid` | chain | subfinder, dnsx, naabu, httpx, katana, nuclei | |
| `den:keeper` | pdtm | install or update the pack | `confirm: true` |
| `den:expose` | uncover | exposed panels | |
| `den:chatter` | notify | send a notification | `confirm: true` |
| `den:shadow` | proxify | intercept traffic | `confirm: true` |
| `den:scatter` | chaos | dataset names | |
| `den:cloak` | cdncheck | CDN check | |
| `den:range` | asnmap | ASN range | |
| `den:mutate` | alterx | name permutations | |
| `den:warren` | mapcidr | CIDR map | |
| `den:cloudkit` | cloudlist | cloud assets | |
| `den:turf` | tldfinder | TLD lookup | |
| `den:denhome` | simplehttpserver | local file server, killed at 8 seconds | `confirm: true` |
| `den:muse` | aix | pack assistant | |
| `den:roster` | | list the overlay | |

The first nine are typed. The rest take `target` and a short `args` array. A bad flag comes back as stderr. `fang` will not bite unless `confirm` is true. `denhome` dies at 8 seconds. A den that serves forever has the door off.

## Install

This repo does not ship the bins.

```sh
go install github.com/projectdiscovery/pdtm/cmd/pdtm@latest
pdtm -install-all
cp .env.example .env
sh scripts/write-env.sh
sh scripts/link-bins.sh
bun install
bun src/index.ts
```

`PD_TOOLS_DIR` defaults to `$HOME/.pdtm/go/bin`. `.env` is not committed.

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

`scripts/link-bins.sh` lays the den names over the bin directory. The door still will not answer to the old ones.

## Layout

- `src/index.ts` — the door
- `src/den-names.ts` — the cache map
- `src/tools/` — typed spawns
- `src/tools/kit.ts` — the rest, 120 second cap
- `src/workflows/bug-bounty.ts` — the raid
- `scripts/write-env.sh` — write `.env`
- `scripts/link-bins.sh` — names on the bins

Fork of [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp). MIT. The lineage can keep its name. The door has one.
