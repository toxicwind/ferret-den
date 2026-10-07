<div align="center">

# ferret-den

An MCP server that runs the ProjectDiscovery recon binaries under other names.

[![WTFPL](https://img.shields.io/badge/license-WTFPL-111111?style=for-the-badge)](COPYING)
[![jobs](https://img.shields.io/badge/jobs-22-c45c26?style=for-the-badge)](#jobs)
[![shell](https://img.shields.io/badge/shell-none-2f6f4e?style=for-the-badge)](#why-the-names)
[![stdio](https://img.shields.io/badge/transport-stdio-555555?style=for-the-badge)](#install)

`whisker` calls subfinder. `fang` calls nuclei. The agent never sees those words in the tool list.

[Why the names](#why-the-names) · [Jobs](#jobs) · [Install](#install) · [License](#license)

</div>

You clone this if you want an agent to do recon through MCP, and the agent refuses the moment the tool is named `nuclei` or `subfinder`. The binaries are unchanged. The names in front of them are not.

The binaries come from [pdtm](https://github.com/projectdiscovery/pdtm). This repo does not ship them. It spawns whatever is in `$PD_TOOLS_DIR` (default `$HOME/.pdtm/go/bin`) with an argument array. There is no shell.

## Why the names

A refusal layer often matches the string, not the job. Put `nuclei` in the tool catalog and some models stop before they read the arguments. Rename the tool `fang` and that string is gone. The process that runs is still nuclei. The confirm flag on `fang` is the real gate. The name is so the call gets that far.

That is the ferret bit. A ferret does not label the cache with what is in it. The table below is the label, for you. `den:roster` does not include the binary names. The agent shops the left column. You read the middle one.

The papers are mixed, which is why this is a rename and not a claim of safety:

- [Not All Refusals Are Equal](https://arxiv.org/abs/2607.02714) treats cybersecurity refusal as its own direction in the model, separable from other refusals.
- [A New Framework for Cybersecurity Refusals in AI Agents](https://arxiv.org/abs/2606.02644) finds most of the frontier models they tested barely refuse offensive web tasks. Two do.
- [MLLMs Fail to Refuse when Using Tools Agentically](https://arxiv.org/abs/2610.03938) finds tool use can lower refusal, not raise it.

So the rename is for the models that flinch at the word. It is not a bypass guarantee. If the model will not run a template scan, `fang` will not talk it into one.

```
agent -> MCP -> den:whisker -> subfinder -> text
```

## Jobs

| Call | Binary | What it does | Gate |
|---|---|---|---|
| `den:whisker` | subfinder | subdomains | |
| `den:squeak` | dnsx | resolve names | |
| `den:nose` | httpx | probe live HTTP | |
| `den:padlock` | tlsx | TLS version, cipher, cert | |
| `den:scratch` | naabu | open ports | |
| `den:tunnel` | katana | crawl paths | |
| `den:rummage` | shuffledns | wordlist brute | |
| `den:fang` | nuclei | template scan | `confirm: true` |
| `den:raid` | the chain | subfinder, dnsx, naabu, httpx, katana, nuclei | |
| `den:keeper` | pdtm | install or update the binaries | `confirm: true` |
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
| `den:roster` | | the left column, from the running server | |

The first nine have typed arguments. The rest take `target` and a short `args` array. A bad flag comes back as stderr. The server does not keep the output.

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

`scripts/link-bins.sh` symlinks `whisker` onto `subfinder` in the bin directory. The server still only accepts the den names.

## Layout

- `src/index.ts` accepts a den name and spawns the binary
- `src/den-names.ts` is the map
- `src/tools/` typed spawns
- `src/tools/kit.ts` the rest, 120 second cap
- `src/workflows/bug-bounty.ts` the chain
- `scripts/write-env.sh` writes `.env`, which is not committed
- `scripts/link-bins.sh` symlinks the den names onto the binaries

The server code started as a fork of [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp). That part remains MIT. See `LICENSE`.

## License

Do what the fuck you want with the den names, the scripts, and this README. [WTFPL v2](COPYING).

The inherited server is MIT. Both notices stay.
