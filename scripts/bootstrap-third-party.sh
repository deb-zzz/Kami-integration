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

if [[ ! -f ".env" ]]; then
  if [[ -f "compose.env.example" ]]; then
    cp compose.env.example .env
    echo "Created .env from compose.env.example"
    echo "Update GHCR_OWNER/GHCR_TAG/GHCR_SCHEMA_TAG in .env before first run."
  else
    echo "Error: compose.env.example not found." >&2
    exit 1
  fi
fi

if [[ ! -f "pgbouncer.ini" ]]; then
  cat > pgbouncer.ini <<'EOF'
[databases]
kami-v1 = host=db port=5432 auth_user=kami

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_user = kami
auth_file = /etc/pgbouncer/userlist.txt
auth_query = SELECT usename, passwd FROM pg_shadow WHERE usename=$1
pool_mode = transaction
max_client_conn = 500
default_pool_size = 20
admin_users = kami
ignore_startup_parameters = extra_float_digits
EOF
  echo "Created pgbouncer.ini"
fi

if [[ ! -f "userlist.txt" ]]; then
  cat > userlist.txt <<'EOF'
"kami" "local-dev-password"
EOF
  echo "Created userlist.txt"
fi

echo "Starting infrastructure: db, pgbouncer, redis..."
docker compose -f compose.yml up -d db pgbouncer redis

echo "Bootstrapping database schema via dbpusher..."
docker compose -f compose.yml run --rm dbpusher

CORE_SERVICES=(
  profile-service
  project-service
  tag-service
  post-service
  social-service
  feed-service
  collections-service
  web3-service
  s3media-service
  notifications-service
  collaboration-service
  signin-service
  wallet-service
  cart-service
  comm-service
  auth-service
  admin-service
  mailing-list-service
  referral-service
  web3-funding-service
  api-gateway
  platform
  platform-admin
)

echo "Starting core platform services..."
docker compose -f compose.yml up -d "${CORE_SERVICES[@]}"

echo
echo "Platform bootstrap complete."
echo
docker compose -f compose.yml ps
echo
echo "Try these URLs:"
echo "  Platform UI: http://localhost:6003"
echo "  Admin UI:    http://localhost:6005"
echo "  API GW:      http://localhost:6004"
