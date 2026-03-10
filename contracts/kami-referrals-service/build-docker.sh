#!/bin/bash
# Build script for multi-platform Docker images
#
# Usage:
#   ./build-docker.sh                    # Build and push for amd64 and arm64
#   ./build-docker.sh --load              # Build for local platform only and load into Docker
#   PLATFORMS=linux/amd64 ./build-docker.sh  # Build for specific platform(s)

set -e

IMAGE_NAME="${IMAGE_NAME:-kami-referrals-service}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
BUILDER_NAME="multiarch-builder"

# Check if --load flag is set (for local builds)
LOAD_IMAGE=false
if [[ "$*" == *"--load"* ]]; then
    LOAD_IMAGE=true
    # For --load, only build for current platform
    PLATFORMS=$(docker buildx inspect default --bootstrap 2>/dev/null | grep "Platforms:" | cut -d: -f2 | tr -d ' ' || echo "linux/amd64")
    echo "Building for local platform: ${PLATFORMS}"
else
    echo "Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
    echo "Platforms: ${PLATFORMS}"
fi

# Create a new builder instance if it doesn't exist (only for multi-platform builds)
if [ "$LOAD_IMAGE" = false ]; then
    if ! docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1; then
        echo "Creating new buildx builder instance..."
        docker buildx create --name "${BUILDER_NAME}" --use
        docker buildx inspect --bootstrap
    else
        docker buildx use "${BUILDER_NAME}"
    fi
fi

# Build arguments
BUILD_ARGS=(
    --platform "${PLATFORMS}"
    --tag "${IMAGE_NAME}:${IMAGE_TAG}"
)

# Add --load for local builds, --push for registry pushes
if [ "$LOAD_IMAGE" = true ]; then
    BUILD_ARGS+=(--load)
else
    BUILD_ARGS+=(--push)
fi

BUILD_ARGS+=(.)

# Build
docker buildx build "${BUILD_ARGS[@]}"

if [ "$LOAD_IMAGE" = true ]; then
    echo "Build complete! Image loaded locally: ${IMAGE_NAME}:${IMAGE_TAG}"
else
    echo "Build complete! Image pushed: ${IMAGE_NAME}:${IMAGE_TAG}"
    echo "Platforms: ${PLATFORMS}"
fi

