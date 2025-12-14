# Deploy to Akash with Build-from-Source

This guide shows how to deploy Lain.TV to Akash Network using the **build-from-source** feature, which builds the Docker image directly on Akash infrastructure from your GitHub repository.

## Why Build on Akash?

- ✅ No need to push large images to a registry
- ✅ Builds happen on Akash infrastructure (faster, more efficient)
- ✅ Automatically rebuilds when you push code changes
- ✅ No local Docker required for deployment

## Prerequisites

1. **Akash CLI installed**
   ```bash
   brew install akash
   ```

2. **Akash wallet with AKT tokens** (5-10 AKT recommended)
   ```bash
   # Create wallet
   akash keys add laincorp-deployer
   
   # Get your address
   akash keys show laincorp-deployer -a
   
   # Fund it from an exchange or faucet
   ```

3. **Certificate created**
   ```bash
   akash tx cert generate client --from laincorp-deployer
   akash tx cert publish client --from laincorp-deployer
   ```

4. **GitHub repository is public** (required for Akash to clone)
   - Repository: `https://github.com/lain-corp/lain-tv.git`
   - Make sure it's public or provide access credentials

## Deployment Files

We have two deployment options:

### Option 1: Build from GitHub (Recommended)
**File:** `backend/deploy-build.yaml`

This SDL tells Akash to:
1. Clone your GitHub repository
2. Build the Docker image using `backend/ai-agent/Dockerfile`
3. Deploy all services (LainLLM, Redis, Qdrant, WebSocket, TTS, Animation)

```yaml
lainllm:
  image: ghcr.io/lain-corp/lain-tv/lainllm:latest
  build:
    context: https://github.com/lain-corp/lain-tv.git
    dockerfile: backend/ai-agent/Dockerfile
```

### Option 2: Pre-built Image
**File:** `backend/deploy.yaml`

This requires you to push the image to a registry first (Docker Hub, GHCR, etc.)

## Deploy Steps

### Step 1: Set Environment Variables

```bash
export AKASH_NODE=https://rpc.akashnet.net:443
export AKASH_CHAIN_ID=akashnet-2
export AKASH_KEYRING_BACKEND=os
export AKASH_FROM=deployer
export AKASH_GAS=auto
export AKASH_GAS_ADJUSTMENT=1.5
export AKASH_GAS_PRICES=0.025uakt
```

### Step 2: Create Deployment

```bash
cd /Users/laincorp/LainCorp/lain-tv/backend

# Deploy with build-from-source
akash tx deployment create deploy-build.yaml --from deployer
```

This will output a **Deployment ID (DSEQ)**. Save it!

```
DSEQ=12345678  # Your deployment sequence number
```

### Step 3: Wait for Bids

```bash
# Check bids (wait 1-2 minutes)
akash query market bid list --owner $(akash keys show deployer -a) --dseq $DSEQ
```

### Step 4: Accept a Bid

```bash
# Get provider address from bid
PROVIDER=akash1...  # Provider address from bid list

# Create lease
akash tx market lease create --dseq $DSEQ --provider $PROVIDER --from deployer
```

### Step 5: Send Manifest

```bash
# Send the deployment manifest to the provider
akash provider send-manifest deploy-build.yaml \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from deployer
```

**The provider will now:**
1. Clone your GitHub repository
2. Build the Docker image from `backend/ai-agent/Dockerfile`
3. Download the Llama 3.1 8B model (4.5GB) on first start
4. Start all services

### Step 6: Check Build Progress

```bash
# View build logs
akash provider lease-logs \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from deployer \
  --follow

# Check specific service
akash provider lease-logs \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from deployer \
  --service lainllm \
  --follow
```

### Step 7: Get Service URLs

```bash
# Get lease status with URLs
akash provider lease-status \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from deployer
```

Output will show:
```json
{
  "services": {
    "lainllm": {
      "uris": ["http://provider.akash.network:12345"]
    },
    "websocket": {
      "uris": ["http://provider.akash.network:12346"]
    }
  }
}
```

## Service Endpoints

After deployment, you'll have:

- **LainLLM API**: Port 8001 (globally exposed)
  - `/generate` - Generate AI responses
  - `/health` - Health check
  - `/stats` - Service statistics

- **WebSocket Server**: Port 80 (globally exposed at lain.tv)
  - Main interface for real-time chat
  - Connects to LainLLM backend

- **Internal Services** (not exposed globally):
  - Redis: Port 6379
  - Qdrant: Port 6333/6334
  - TTS: Port 8002
  - Animation: Port 8003

## Update Deployment

To update your code:

```bash
# 1. Push changes to GitHub
git add .
git commit -m "Update AI agent"
git push origin main

# 2. Update the deployment (triggers rebuild)
akash tx deployment update deploy-build.yaml --dseq $DSEQ --from deployer

# 3. Send updated manifest
akash provider send-manifest deploy-build.yaml \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from deployer
```

## Monitor Deployment

```bash
# Check deployment status
akash query deployment get --owner $(akash keys show deployer -a) --dseq $DSEQ

# Check lease status
akash query market lease get \
  --owner $(akash keys show deployer -a) \
  --dseq $DSEQ \
  --provider $PROVIDER

# View logs (all services)
akash provider lease-logs \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from deployer \
  --follow

# View logs (specific service)
akash provider lease-logs \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from deployer \
  --service lainllm \
  --follow
```

## Close Deployment

```bash
# Close deployment and get refund for unused time
akash tx deployment close --dseq $DSEQ --from deployer
```

## Estimated Costs

Based on `deploy-build.yaml` resources:

- **Total Resources**: 23 CPU cores, 21GB RAM
- **Build Time**: ~5-10 minutes (one-time)
- **Model Download**: ~2 minutes (one-time, on first start)
- **Monthly Cost**: ~2-5 AKT/month (~$4-10 USD depending on AKT price)

## Troubleshooting

### Build Fails

```bash
# Check build logs
akash provider lease-logs --dseq $DSEQ --provider $PROVIDER --from deployer --service lainllm

# Common issues:
# - GitHub repo not public
# - Dockerfile path incorrect
# - Build dependencies missing
```

### Model Download Fails

The model is downloaded on container startup. If it fails:

```bash
# Check logs for download errors
akash provider lease-logs --dseq $DSEQ --provider $PROVIDER --from deployer --service lainllm

# The download-model.sh script will retry automatically
# Ensure the service has enough storage (20Gi allocated)
```

### Services Not Starting

```bash
# Check all service statuses
akash provider service-status --dseq $DSEQ --provider $PROVIDER --from deployer

# Check specific service logs
akash provider lease-logs --dseq $DSEQ --provider $PROVIDER --from deployer --service redis
```

### Out of Resources

If you see "insufficient resources" errors:

1. Lower CPU/memory in `deploy-build.yaml` profiles
2. Wait for more providers to bid
3. Increase bid price in placement section

## Next Steps

1. ✅ Code pushed to GitHub
2. ⏳ Deploy to Akash using build-from-source
3. ⏳ Test LainLLM API endpoints
4. ⏳ Connect frontend to WebSocket service
5. ⏳ Configure domain (lain.tv) to point to Akash deployment

## Resources

- [Akash Network Docs](https://docs.akash.network/)
- [Akash Discord](https://discord.akash.network/)
- [Provider Status](https://akashnet.net/providers)
