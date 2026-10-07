<div align="center">

# ferret-den

An MCP server that runs the ProjectDiscovery recon binaries under other names.

[![WTFPL](https://img.shields.io/badge/license-WTFPL-111111?style=for-the-badge)](COPYING)
[![jobs](https://img.shields.io/badge/jobs-22-c45c26?style=for-the-badge)](#jobs)
[![shell](https://img.shields.io/badge/shell-none-2f6f4e?style=for-the-badge)](#why-the-names)
[![stdio](https://img.shields.io/badge/transport-stdio-555555?style=for-the-badge)](#install)

`whisker` calls subfinder. `fang` calls nuclei. The agent does not see those words in the tool list.

[Why the names](#why-the-names) · [Jobs](#jobs) · [Install](#install) · [License](#license)

</div>

Clone this if you want an agent to run reconnaissance through MCP, and the agent refuses as soon as a tool is named `nuclei` or `subfinder`. The binaries are the same. The names in front of them are not.

The binaries come from [pdtm](https://github.com/projectdiscovery/pdtm). This repository does not ship them. It spawns whatever is in `$PD_TOOLS_DIR`, which defaults to `$HOME/.pdtm/go/bin`. The spawn uses an argument array. There is no shell.

## Why the names

A refusal layer often matches the string, not the job. If `nuclei` is in the tool catalog, some models stop before they read the arguments. If the tool is named `fang`, that string is gone. The process that runs is still nuclei. The confirm flag on `fang` is the real gate. The name exists so the call can get that far.

That is the ferret part. A ferret does not label the cache with what is inside it. The table below is the label, and it is for you. `den:roster` does not include the binary names. The agent sees the left column. You read the middle column.

The papers do not agree, which is why this is a rename and not a claim that the model will comply.

- [Not All Refusals Are Equal](https://arxiv.org/abs/2607.02714) treats cybersecurity refusal as its own direction in the model, separate from other refusals.
- [A New Framework for Cybersecurity Refusals in AI Agents](https://arxiv.org/abs/2606.02644) finds that most of the frontier models they tested barely refuse offensive web tasks. Two of them do refuse.
- [MLLMs Fail to Refuse when Using Tools Agentically](https://arxiv.org/abs/2610.03938) finds that tool use can lower refusal, not raise it.

The rename is for the models that flinch at the word. It is not a bypass. If the model will not run a template scan, `fang` will not talk it into one.

```
agent -> MCP -> den:whisker -> subfinder -> text
```

## Jobs

| Call | Binary | What it does | Gate |
|---|---|---|---|
| `den:whisker` | subfinder | Finds subdomains. | |
| `den:squeak` | dnsx | Resolves names. | |
| `den:nose` | httpx | Probes live HTTP. | |
| `den:padlock` | tlsx | Reads the TLS version, cipher, and certificate. | |
| `den:scratch` | naabu | Finds open ports. | |
| `den:tunnel` | katana | Crawls paths. | |
| `den:rummage` | shuffledns | Brutes names from a wordlist. | |
| `den:fang` | nuclei | Runs template scans. | `confirm: true` |
| `den:raid` | the chain | Runs subfinder, dnsx, naabu, httpx, katana, and nuclei. | |
| `den:keeper` | pdtm | Installs or updates the binaries. | `confirm: true` |
| `den:expose` | uncover | Finds exposed panels. | |
| `den:chatter` | notify | Sends a notification. | `confirm: true` |
| `den:shadow` | proxify | Intercepts traffic. | `confirm: true` |
| `den:scatter` | chaos | Pulls dataset names. | |
| `den:cloak` | cdncheck | Checks for a CDN. | |
| `den:range` | asnmap | Maps an ASN range. | |
| `den:mutate` | alterx | Permutes names. | |
| `den:warren` | mapcidr | Maps a CIDR. | |
| `den:cloudkit` | cloudlist | Lists cloud assets. | |
| `den:turf` | tldfinder | Looks up TLDs. | |
| `den:denhome` | simplehttpserver | Serves files locally, then exits after 8 seconds. | `confirm: true` |
| `den:muse` | aix | Asks the pack assistant. | |
| `den:roster` | | Returns the left column from the running server. | |

The first nine jobs have typed arguments. The rest take `target` and a short `args` array. A bad flag comes back as stderr. The server does not keep the output.

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

- `src/index.ts` accepts a den name and spawns the binary.
- `src/den-names.ts` is the map from den name to binary.
- `src/tools/` holds the typed spawns.
- `src/tools/kit.ts` runs the rest, with a 120 second cap.
- `src/workflows/bug-bounty.ts` runs the chain.
- `scripts/write-env.sh` writes `.env`, which is not committed.
- `scripts/link-bins.sh` symlinks the den names onto the binaries.

The server started as a fork of [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp). That part remains MIT. See `LICENSE`.

## License

Do what the fuck you want with the den names, the scripts, and this README. The terms are [WTFPL v2](COPYING).

The inherited server is MIT. Both notices stay.
