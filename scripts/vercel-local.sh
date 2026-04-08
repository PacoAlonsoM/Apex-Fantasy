#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/node-runtime.sh"

if [[ $# -eq 0 ]]; then
  cat <<'EOF'
Usage: ./scripts/vercel-local.sh <vercel-subcommand> [args...]

Examples:
  ./scripts/vercel-local.sh whoami
  ./scripts/vercel-local.sh link
  ./scripts/vercel-local.sh deploy
  ./scripts/vercel-local.sh deploy --prod
EOF
  exit 1
fi

stint_setup_node_runtime
stint_assert_canonical_workspace

NODE_ROOT="$(cd "$STINT_NODE_BIN_DIR/.." && pwd)"
NPM_CLI="$NODE_ROOT/lib/node_modules/npm/bin/npm-cli.js"

if [[ ! -f "$NPM_CLI" ]]; then
  printf 'Could not find npm-cli.js for Node %s at %s.\n' "$STINT_EXPECTED_NODE_MAJOR" "$NPM_CLI" >&2
  exit 1
fi

printf 'Running Vercel CLI from %s\n' "$STINT_SOURCE_DIR"
printf 'Node version: %s\n' "$("$STINT_NODE_BIN" -v)"

cd "$STINT_SOURCE_DIR"
exec "$STINT_NODE_BIN" "$NPM_CLI" exec --yes -- vercel "$@"
