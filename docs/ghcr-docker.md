# GHCR Docker Build Guide

This monorepo includes a reusable container build setup so third parties can build and publish images without private runners.

## What was added

- `Dockerfile.app` - generic Dockerfile for apps under `apps/*`
- `Dockerfile.dbpusher` - schema image for `dbpusher` compose service
- `.dockerignore` - keeps builds smaller/faster
- `.github/workflows/ghcr-build-and-push.yml` - GitHub Actions matrix that builds and pushes app images to GHCR
- `.github/workflows/validate-compose-build-coverage.yml` - fails CI when `compose.yml` references services missing source in this monorepo

## How image naming works

Each app is pushed as:

- `ghcr.io/<owner>/<image_name>:<tag>`

Example:

- `ghcr.io/acme-org/kami-platform-web:latest`

## Required repository settings

1. In GitHub repo settings, ensure Actions has permission to write packages.
2. Keep workflow permissions for packages enabled (the workflow sets `packages: write`).
3. If using organization restrictions, allow publishing to GHCR for this repo.

No custom registry username/password secret is required; the workflow uses `${{ secrets.GITHUB_TOKEN }}`.

## Triggering builds

- Push to `main`, or
- Manually run the `Build and Push App Images (GHCR)` workflow.

## Local image build example

```bash
docker build \
  -f Dockerfile.app \
  --build-arg APP_PATH=apps/web \
  -t ghcr.io/<owner>/kami-platform-web:local .
```

## Running a built image

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  ghcr.io/<owner>/kami-platform-web:latest
```

## Using with docker compose

`compose.yml` is already parameterized for GHCR using:

- `GHCR_OWNER`
- `GHCR_TAG`
- `GHCR_SCHEMA_TAG`

Set these via a root `.env` file (you can copy `compose.env.example`):

```bash
cp compose.env.example .env
```

Then run:

```bash
docker compose -f compose.yml up -d
```

The resolved image format is:

`ghcr.io/${GHCR_OWNER}/<service-image>:${GHCR_TAG}`

Third parties can fork the repo, run the workflow, and then run Compose against their own GHCR images.

## Compose coverage status

Built from this monorepo by workflow:

- `platform` (`kami-platform-web`)
- `platform-admin` (`kami-platform-admin-ui`) using `apps/admin-service`
- `api-gateway`
- `signin-service`
- `wallet-service`
- `cart-service`
- `comm-service`
- `s3media-service` (`kami-platform-media-service`)
- `admin-service`
- `auth-service`
- `notifications-service`
- `post-service` (`kami-platform-posts-service`)
- `web3-service`
- `feed-service`
- `profile-service`
- `project-service`
- `collections-service`
- `collaboration-service` (`kami-platform-collaborate-service`)
- `social-service`
- `tag-service`
- `mailing-list-service`
- `referral-service` (`contracts/kami-referrals-service`)
- `web3-funding-service`
- `dbpusher` (`kami-platform-v1-schema`, via `Dockerfile.dbpusher`)

`compose.yml` has been pruned to monorepo-backed app services plus infrastructure services, so third parties can build and run the defined platform scope directly from this repository.
