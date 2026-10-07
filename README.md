# ferret-den

ProjectDiscovery MCP. This is the project. It used to be `estate/tools/pd-mcp`.

stdio JSON-RPC, Content-Length framing. Wraps the PDTM bins in `PD_TOOLS_DIR` (default `/home/toxic/.pdtm/go/bin`). Runs on yote.

```sh
./ferret pull
bun server.ts
```

`ferret pull` is `pdtm -update-all`. Server docs are `AGENTS.md`.
