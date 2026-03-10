#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not in PATH." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose v2 is required." >&2
  exit 1
fi

MODE="${1:-soft}"

case "$MODE" in
  soft)
    echo "Stopping containers (preserving volumes)..."
    docker compose -f compose.yml down
    ;;
  hard)
    echo "Stopping containers and removing volumes..."
    docker compose -f compose.yml down -v
    ;;
  *)
    echo "Usage: ./scripts/teardown-third-party.sh [soft|hard]" >&2
    echo "  soft: docker compose down" >&2
    echo "  hard: docker compose down -v" >&2
    exit 1
    ;;
esac

echo
echo "Teardown complete ($MODE)."
