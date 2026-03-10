# KAMI Monorepo

This repository contains the KAMI platform codebase and Docker/GHCR automation so third parties can build and run the platform from this monorepo.

## Repository Structure

```text
apps/                         # Frontend + backend app services
packages/kami-platform-v1-schema/   # Shared Prisma schema
contracts/kami-referrals-service/   # Referral backend service source
compose.yml                   # Runtime orchestration (GHCR images)
compose.env.example           # Compose image-tag variables template
Dockerfile.app                # Generic app image builder
Dockerfile.dbpusher           # Schema image builder for db bootstrap
.github/workflows/            # GHCR build + compose coverage validation
```

## Step-by-Step: Build and Run (Third-Party)

### 1) Prerequisites

Install:

- Docker Desktop (with Compose v2)
- A GitHub account with permission to run Actions in your fork

Optional local dev tooling:

- Node 22 + pnpm (only needed if you want local non-container development)

### 2) Fork and clone

1. Fork this repository to your GitHub account or org.
2. Clone your fork locally:

```bash
git clone https://github.com/<your-owner>/<your-repo>.git
cd <your-repo>
```

### 3) Enable GHCR publishing in your fork

In your fork settings:

1. Ensure GitHub Actions is enabled.
2. Ensure workflow permissions allow writing packages (`packages: write`).
3. Ensure GHCR package publishing is allowed for this repo/org policy.

This repo’s workflow uses `${{ secrets.GITHUB_TOKEN }}` (no custom Docker Hub secrets required).

### 4) Build and push images to GHCR

Use workflow:

- `.github/workflows/ghcr-build-and-push.yml`

Trigger either:

- Push to `main`, or
- Manual `workflow_dispatch` from the Actions tab.

Images will be published to:

- `ghcr.io/<your-owner>/<image-name>:<tag>`

### 5) Configure Compose image variables

Create a root `.env` for Compose substitutions:

```bash
cp compose.env.example .env
```

Then edit `.env`:

```env
GHCR_OWNER=<your-github-owner-or-org-lowercase>
GHCR_TAG=latest
GHCR_SCHEMA_TAG=latest
```

Quick bootstrap option (recommended):

```bash
./scripts/bootstrap-third-party.sh
```

The script will:

- create `.env` from `compose.env.example` (if missing),
- create `pgbouncer.ini` and `userlist.txt` (if missing),
- start infra containers (`db`, `pgbouncer`, `redis`),
- run schema bootstrap (`dbpusher`),
- start core platform services.

Teardown helpers:

```bash
# Stop containers, keep data volumes
./scripts/teardown-third-party.sh

# Stop containers and remove data volumes
./scripts/teardown-third-party.sh hard
```

### 6) Prepare PgBouncer sidecar files

`compose.yml` expects two files in repo root:

- `pgbouncer.ini`
- `userlist.txt`

Create `pgbouncer.ini`:

```ini
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
```

Create `userlist.txt`:

```text
"kami" "local-dev-password"
```

### 7) Login for pulling private GHCR images

If your GHCR packages are private:

```bash
echo <gh_pat_with_read:packages> | docker login ghcr.io -u <your-github-username> --password-stdin
```

### 8) Start infrastructure first

```bash
docker compose -f compose.yml up -d db pgbouncer redis
docker compose -f compose.yml ps
```

### 9) Bootstrap database schema

`dbpusher` image runs Prisma schema sync:

```bash
docker compose -f compose.yml run --rm dbpusher
```

### 10) Start core platform services

This command starts services that are currently buildable from this monorepo:

```bash
docker compose -f compose.yml up -d \
  profile-service project-service tag-service post-service social-service feed-service \
  collections-service web3-service s3media-service notifications-service collaboration-service \
  signin-service wallet-service cart-service comm-service auth-service admin-service \
  mailing-list-service referral-service web3-funding-service \
  api-gateway platform platform-admin
```

### 11) Verify platform is functioning

Check service status:

```bash
docker compose -f compose.yml ps
```

Smoke-test endpoints:

```bash
curl -i http://localhost:6004/profile-service
curl -i http://localhost:6004/web3-service
curl -i http://localhost:6004/post-service
```

Open frontends:

- Platform UI: `http://localhost:6003`
- Admin UI: `http://localhost:6005`

### 12) Stop/reset

Stop:

```bash
docker compose -f compose.yml down
```

Stop + remove volumes (full reset):

```bash
docker compose -f compose.yml down -v
```

## Current Coverage

`compose.yml` is aligned to services that are buildable from this monorepo plus infrastructure services. This means third parties can follow this guide and run the defined platform scope without relying on external app repositories.

The CI workflow `.github/workflows/validate-compose-build-coverage.yml` enforces this alignment and fails if unclassified/non-monorepo services are added.

## Additional References

- GHCR build details: `docs/ghcr-docker.md`
- Compose runtime config: `compose.yml`
- Image tag variables: `compose.env.example`
