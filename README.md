# ferret-den

stdio MCP server. An agent calls a job by name. The server spawns a recon binary with a schema, a timeout, and no shell.

This is the recon leg of a tool-using model. The model already has GitHub, search, and a browser. It does not have a safe way to enumerate a domain. Giving it a shell makes it invent flags. This server is the missing call: the model picks a job, the process runs the binary, the result comes back as text.

## Where it sits

```
model  ->  MCP client  ->  den  ->  binary  ->  result
```

The model never sees a prompt full of flags. It sees tools. `whisker` takes a domain. `fang` takes targets and `confirm: true`. A wrong call fails in the schema instead of in a shell string.

It is not a model, not a scanner you drive by hand, and not a store of findings. It is the actuator. Another tool, or the same model on the next turn, reads the result.

## Surface

Names are the only public call. `den:roster` lists them. The bin directory is configured, not advertised.

| Call | Job | Gate |
|---|---|---|
| `den:whisker` | subdomains for a domain | |
| `den:squeak` | resolve names | |
| `den:nose` | probe live HTTP | |
| `den:padlock` | TLS version, cipher, cert | |
| `den:scratch` | open ports | |
| `den:tunnel` | crawl paths | |
| `den:rummage` | wordlist names | |
| `den:fang` | template scan | `confirm: true` |
| `den:raid` | the chain: names, resolve, ports, HTTP, crawl, templates | |
| `den:keeper` | install or update the pack | `confirm: true` |
| `den:expose` | exposed panels | |
| `den:chatter` | send a notification | `confirm: true` |
| `den:shadow` | proxy traffic | `confirm: true` |
| `den:scatter` | dataset names | |
| `den:cloak` | CDN check | |
| `den:range` | ASN range | |
| `den:mutate` | name permutations | |
| `den:warren` | CIDR map | |
| `den:cloudkit` | cloud assets | |
| `den:turf` | TLD lookup | |
| `den:denhome` | local file server | `confirm: true`, killed at 8s |
| `den:muse` | pack assistant | |
| `den:roster` | list this table | |

The first nine are typed. The rest take `target` and a short `args` array. Args are cleaned. There is no shell.

## Install

Bins live in `$PD_TOOLS_DIR`. Default `$HOME/.pdtm/go/bin`.

```sh
cp .env.example .env
sh scripts/write-env.sh
sh scripts/link-bins.sh
bun install
bun src/index.ts
```

Client:

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

`scripts/link-bins.sh` puts the same names next to the binaries. The door still only accepts the names in the table.

## Limits

- Kit jobs are a cleaned argv pass, not a typed flag set. A bad flag comes back as stderr.
- `denhome` cannot stay up. The timeout is 8 seconds.
- `fang` does not run unless `confirm` is true.
- The server does not store output. The client does.

## Layout

- `src/index.ts` — door
- `src/den-names.ts` — call names
- `src/tools/` — typed spawns
- `src/tools/kit.ts` — the rest
- `src/workflows/bug-bounty.ts` — raid
- `scripts/write-env.sh` — write `.env`
- `scripts/link-bins.sh` — names on the bin directory

Fork of [intelligent-ears/pd-tools-mcp](https://github.com/intelligent-ears/pd-tools-mcp). MIT.
