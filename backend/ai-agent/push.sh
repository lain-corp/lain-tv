#!/bin/bash
set -e

# OpenRegistry credentials  
REGISTRY="openregistry.dev"
USERNAME="LainCorp"
TOKEN="oreg_pat_01KCE9AYNK5T4WDTY5XEGDNCKG"
# Note: OpenRegistry shows LainCorp/LainLLM but Docker requires lowercase
IMAGE_NAME="${REGISTRY}/laincorp/lainllm"
VERSION=${1:-"latest"}

echo "🔐 Logging in to ${REGISTRY}..."
echo "${TOKEN}" | docker login ${REGISTRY} --username ${USERNAME} --password-stdin

if [ $? -ne 0 ]; then
    echo "❌ Login failed. Trying alternative auth method..."
    docker login ${REGISTRY} -u ${USERNAME} -p ${TOKEN}
fi

echo ""
echo "📦 Tagging image..."
docker tag openregistry.dev/laincorp/lainllm:${VERSION} ${IMAGE_NAME}:${VERSION}

echo ""
echo "📤 Pushing ${IMAGE_NAME}:${VERSION}..."
docker push ${IMAGE_NAME}:${VERSION}

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed ${IMAGE_NAME}:${VERSION}"
    echo ""
    echo "Image available at:"
    echo "  ${IMAGE_NAME}:${VERSION}"
else
    echo ""
    echo "❌ Push failed - checking if repository exists..."
    echo ""
    echo "⚠️  If you see 'access restricted' error:"
    echo "1. Visit https://openregistry.dev"
    echo "2. Create repository: LainCorp/lainllm (all lowercase)"
    echo "3. Make sure repository is public or token has push access"
    exit 1
fi
