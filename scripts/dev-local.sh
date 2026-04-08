#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_NODE_MAJOR="${STINT_NODE_MAJOR:-20}"
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"
PORT_TO_USE="${PORT:-3000}"
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

NODE_BIN_DIR="$(resolve_node_bin_dir)"
export PATH="$NODE_BIN_DIR:$PATH"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" != "$EXPECTED_NODE_MAJOR" ]]; then
  printf 'Expected Node %s but found %s.\n' "$EXPECTED_NODE_MAJOR" "$(node -v)" >&2
  exit 1
fi

NPM_BIN="$NODE_BIN_DIR/npm"
NODE_BIN="$NODE_BIN_DIR/node"

if [[ "$SOURCE_DIR" != "$CANONICAL_DIR" && -f "$CANONICAL_DIR/package.json" ]]; then
  printf 'This Desktop copy is no longer the canonical website workspace.\n' >&2
  printf 'Use the clean local repo instead:\n' >&2
  printf '  cd %s\n' "$CANONICAL_DIR" >&2
  printf '  npm start\n' >&2
  exit 1
fi

if [[ ! -d "$SOURCE_DIR/node_modules/next" ]]; then
  printf 'Installing project dependencies with Node %s...\n' "$(node -v)"
  (
    cd "$SOURCE_DIR"
    "$NPM_BIN" install --no-audit --no-fund
  )
fi

if lsof -nP -iTCP:"$PORT_TO_USE" -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'Port %s is already in use. Stop the process that owns it, then rerun npm start.\n' "$PORT_TO_USE" >&2
  exit 1
fi

printf 'Running STINT from %s\n' "$SOURCE_DIR"
printf 'Node version: %s\n' "$(node -v)"
printf 'Dev URL: http://localhost:%s\n' "$PORT_TO_USE"

cd "$SOURCE_DIR"
exec node ./node_modules/next/dist/bin/next dev --webpack --port "$PORT_TO_USE"
