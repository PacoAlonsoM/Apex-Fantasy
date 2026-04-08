#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/node-runtime.sh"

stint_setup_node_runtime
stint_assert_canonical_workspace
stint_ensure_dependencies

printf 'Building STINT from %s\n' "$STINT_SOURCE_DIR"
printf 'Node version: %s\n' "$("$STINT_NODE_BIN" -v)"

cd "$STINT_SOURCE_DIR"
exec "$STINT_NODE_BIN" ./node_modules/next/dist/bin/next build --webpack
