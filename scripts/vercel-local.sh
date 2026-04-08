#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_NODE_MAJOR="${STINT_NODE_MAJOR:-20}"
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"
CANONICAL_DIR="${STINT_CANONICAL_DIR:-$HOME/Code/apex-fantasy}"

resolve_node_bin_dir() {
  local current_node_bin=""
  local current_major=""

  if command -v node >/dev/null 2>&1; then
    current_node_bin="$(command -v node)"
    current_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
    if [[ "$current_major" == "$EXPECTED_NODE_MAJOR" ]]; then
      dirname "$current_node_bin"
      return 0
    fi
  fi

  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [[ -d "$nvm_dir/versions/node" ]]; then
    local resolved=""
    for candidate in "$nvm_dir"/versions/node/v"$EXPECTED_NODE_MAJOR"*; do
      if [[ -x "$candidate/bin/node" ]]; then
        resolved="$candidate/bin"
      fi
    done

    if [[ -n "$resolved" ]]; then
      printf '%s\n' "$resolved"
      return 0
    fi
  fi

  printf 'Could not find Node %s. Install it or run `nvm install %s`.\n' "$EXPECTED_NODE_MAJOR" "$EXPECTED_NODE_MAJOR" >&2
  exit 1
}

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

NODE_BIN_DIR="$(resolve_node_bin_dir)"
export PATH="$NODE_BIN_DIR:$PATH"
NODE_BIN="$NODE_BIN_DIR/node"
NPM_BIN="$NODE_BIN_DIR/npm"
NODE_ROOT="$(cd "$NODE_BIN_DIR/.." && pwd)"
NPM_CLI="$NODE_ROOT/lib/node_modules/npm/bin/npm-cli.js"

if [[ "$SOURCE_DIR" != "$CANONICAL_DIR" && -f "$CANONICAL_DIR/package.json" ]]; then
  printf 'This Desktop copy is no longer the canonical website workspace.\n' >&2
  printf 'Use the clean local repo instead:\n' >&2
  printf '  cd %s\n' "$CANONICAL_DIR" >&2
  printf '  npm run publish:whoami\n' >&2
  exit 1
fi

if [[ ! -f "$NPM_CLI" ]]; then
  printf 'Could not find npm-cli.js for Node %s at %s.\n' "$EXPECTED_NODE_MAJOR" "$NPM_CLI" >&2
  exit 1
fi

printf 'Running Vercel CLI from %s\n' "$SOURCE_DIR"
printf 'Node version: %s\n' "$("$NODE_BIN" -v)"

cd "$SOURCE_DIR"
exec "$NODE_BIN" "$NPM_CLI" exec --yes -- vercel "$@"
