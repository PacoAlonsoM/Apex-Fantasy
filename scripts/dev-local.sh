#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/node-runtime.sh"

PORT_TO_USE="${PORT:-3000}"
stint_setup_node_runtime
stint_assert_canonical_workspace
stint_ensure_dependencies

if lsof -nP -iTCP:"$PORT_TO_USE" -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'Port %s is already in use. Stop the process that owns it, then rerun npm start.\n' "$PORT_TO_USE" >&2
  exit 1
fi

printf 'Running STINT from %s\n' "$STINT_SOURCE_DIR"
printf 'Node version: %s\n' "$("$STINT_NODE_BIN" -v)"
printf 'Dev URL: http://localhost:%s\n' "$PORT_TO_USE"

cd "$STINT_SOURCE_DIR"
exec "$STINT_NODE_BIN" ./node_modules/next/dist/bin/next dev --webpack --port "$PORT_TO_USE"
