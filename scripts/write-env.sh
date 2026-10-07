#!/bin/sh
# Write .env for this checkout. Override PD_TOOLS_DIR to point elsewhere.
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DIR=${PD_TOOLS_DIR:-$HOME/.pdtm/go/bin}
printf '%s\n' "PD_TOOLS_DIR=$DIR" "SHUFFLEDNS_BIN=$DIR/shuffledns" > "$ROOT/.env"
echo "wrote $ROOT/.env"
