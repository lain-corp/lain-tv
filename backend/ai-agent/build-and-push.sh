#!/bin/bash
set -e

# LainLLM Build and Push Script
# Builds the Docker image and pushes to openregistry.dev

IMAGE_NAME="openregistry.dev/laincorp/lainllm"
VERSION=${1:-"latest"}

echo "🏗️  Building LainLLM Docker image..."
echo "Image: ${IMAGE_NAME}:${VERSION}"
echo ""

# Build the image
docker build -t ${IMAGE_NAME}:${VERSION} .

# Also tag as latest if version is specified
if [ "$VERSION" != "latest" ]; then
    docker tag ${IMAGE_NAME}:${VERSION} ${IMAGE_NAME}:latest
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Pushing to registry..."

# Push to registry
docker push ${IMAGE_NAME}:${VERSION}

if [ "$VERSION" != "latest" ]; then
    docker push ${IMAGE_NAME}:latest
fi

echo ""
echo "🎉 Successfully pushed LainLLM!"
echo ""
echo "Image: ${IMAGE_NAME}:${VERSION}"
echo ""
echo "To pull and run:"
echo "  docker pull ${IMAGE_NAME}:${VERSION}"
echo "  docker run -p 8001:8001 ${IMAGE_NAME}:${VERSION}"
