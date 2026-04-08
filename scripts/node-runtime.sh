#!/usr/bin/env bash
set -euo pipefail

STINT_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STINT_EXPECTED_NODE_MAJOR="${STINT_NODE_MAJOR:-20}"
STINT_CANONICAL_DIR="${STINT_CANONICAL_DIR:-$HOME/Code/apex-fantasy}"
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"

stint_resolve_node_bin_dir() {
  local current_node_bin=""
  local current_major=""

  if command -v node >/dev/null 2>&1; then
    current_node_bin="$(command -v node)"
    current_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
    if [[ "$current_major" == "$STINT_EXPECTED_NODE_MAJOR" ]]; then
      dirname "$current_node_bin"
      return 0
    fi
  fi

  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [[ -d "$nvm_dir/versions/node" ]]; then
    local resolved=""
    for candidate in "$nvm_dir"/versions/node/v"$STINT_EXPECTED_NODE_MAJOR"*; do
      if [[ -x "$candidate/bin/node" ]]; then
        resolved="$candidate/bin"
      fi
    done

    if [[ -n "$resolved" ]]; then
      printf '%s\n' "$resolved"
      return 0
    fi
  fi

  printf 'Could not find Node %s. Install it or run `nvm install %s`.\n' "$STINT_EXPECTED_NODE_MAJOR" "$STINT_EXPECTED_NODE_MAJOR" >&2
  exit 1
}

stint_setup_node_runtime() {
  local node_bin_dir=""
  node_bin_dir="$(stint_resolve_node_bin_dir)"
  export PATH="$node_bin_dir:$PATH"
  export STINT_NODE_BIN_DIR="$node_bin_dir"
  export STINT_NODE_BIN="$node_bin_dir/node"
  export STINT_NPM_BIN="$node_bin_dir/npm"

  local node_major=""
  node_major="$("$STINT_NODE_BIN" -p 'process.versions.node.split(".")[0]')"
  if [[ "$node_major" != "$STINT_EXPECTED_NODE_MAJOR" ]]; then
    printf 'Expected Node %s but found %s.\n' "$STINT_EXPECTED_NODE_MAJOR" "$("$STINT_NODE_BIN" -v)" >&2
    exit 1
  fi
}

stint_assert_canonical_workspace() {
  if [[ "$STINT_SOURCE_DIR" != "$STINT_CANONICAL_DIR" && -f "$STINT_CANONICAL_DIR/package.json" ]]; then
    printf 'This Desktop copy is no longer the canonical website workspace.\n' >&2
    printf 'Use the clean local repo instead:\n' >&2
    printf '  cd %s\n' "$STINT_CANONICAL_DIR" >&2
    printf '  npm start\n' >&2
    exit 1
  fi
}

stint_ensure_dependencies() {
  if [[ ! -d "$STINT_SOURCE_DIR/node_modules/next" ]]; then
    printf 'Installing project dependencies with Node %s...\n' "$("$STINT_NODE_BIN" -v)"
    (
      cd "$STINT_SOURCE_DIR"
      "$STINT_NPM_BIN" install --no-audit --no-fund
    )
  fi
}
