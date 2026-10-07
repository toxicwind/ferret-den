#!/bin/sh
# Point ferret names at the real bins. Does not replace the upstream file.
DIR="${PD_TOOLS_DIR:-$HOME/.pdtm/go/bin}"
link() { [ -x "$DIR/$2" ] && ln -sfn "$2" "$DIR/$1" && echo "$1 -> $2"; }
link whisker subfinder
link squeak dnsx
link nose httpx
link padlock tlsx
link scratch naabu
link tunnel katana
link rummage shuffledns
link fang nuclei
link keeper pdtm
link expose uncover
link chatter notify
link shadow proxify
link scatter chaos
link cloak cdncheck
link range asnmap
link mutate alterx
link warren mapcidr
link cloudkit cloudlist
link turf tldfinder
link denhome simplehttpserver
link muse aix
echo "den bins linked in $DIR"
