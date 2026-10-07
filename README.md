# ferret-den

[![den](https://img.shields.io/badge/door-den-111111?style=for-the-badge)](https://github.com/toxicwind/ferret-den)
[![jobs](https://img.shields.io/badge/jobs-22-c45c26?style=for-the-badge)](https://github.com/toxicwind/ferret-den)
[![shell](https://img.shields.io/badge/shell-none-2f6f4e?style=for-the-badge)](https://github.com/toxicwind/ferret-den)
[![license](https://img.shields.io/badge/license-MIT-555555?style=for-the-badge)](LICENSE)

MCP server for the ProjectDiscovery recon bins. An agent calls a den job. The server spawns the matching binary. Absolute argv, timeouts, no shell.

You are downloading a door, not a scanner. The bins still come from [pdtm](https://github.com/projectdiscovery/pdtm) and live in `$HOME/.pdtm/go/bin`. ferret-den is the overlay: `whisker` is subfinder, `fang` is nuclei, and the old names are not on the tool list.

```
model  ->  MCP client  ->  den  ->  ProjectDiscovery bin  ->  text
```

Register the server as `den`.

## Jobs

`den:roster` returns this list from the running server.

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

The first nine are typed. The rest take `target` and a short `args` array. Args are cleaned. There is no shell.

## Install

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

`scripts/link-bins.sh` symlinks the den names onto those bins. The door still only accepts the den names.

## Limits

- Kit jobs are a cleaned argv pass. A bad flag comes back as stderr.
- `denhome` cannot stay up. The timeout is 8 seconds.
- `fang` does not run unless `confirm` is true.
- The server does not store output.

## Layout

- `src/index.ts` — the door
- `src/den-names.ts` — den name to bin
- `src/tools/` — typed spawns
- `src/tools/kit.ts` — the rest, 120 second cap
- `src/workflows/bug-bounty.ts` — the raid
- `scripts/write-env.sh` — write `.env`
- `scripts/link-bins.sh` — den names on the bin directory

Fork of [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp). MIT.
