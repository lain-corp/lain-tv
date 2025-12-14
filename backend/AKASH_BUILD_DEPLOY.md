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

## Deployment File

**File:** `backend/deploy-build.yaml`

This SDL tells Akash to:
1. Clone your GitHub repository
2. Build all Docker images from their respective Dockerfiles:
   - `backend/ai-agent/Dockerfile` → LainLLM service
   - `backend/websocket/Dockerfile` → WebSocket server
   - `backend/tts/Dockerfile` → TTS service
   - `backend/animation/Dockerfile` → Animation service
3. Deploy all 6 services (LainLLM, Redis, Qdrant, WebSocket, TTS, Animation)

**Example service definition with build:**
```yaml
lainllm:
  image: ghcr.io/lain-corp/lain-tv/lainllm:latest
  build:
    context: https://github.com/lain-corp/lain-tv.git
    dockerfile: backend/ai-agent/Dockerfile

websocket:
  image: ghcr.io/lain-corp/lain-tv/websocket:latest
  build:
    context: https://github.com/lain-corp/lain-tv.git
    dockerfile: backend/websocket/Dockerfile

tts:
  image: ghcr.io/lain-corp/lain-tv/tts:latest
  build:
    context: https://github.com/lain-corp/lain-tv.git
    dockerfile: backend/tts/Dockerfile

animation:
  image: ghcr.io/lain-corp/lain-tv/animation:latest
  build:
    context: https://github.com/lain-corp/lain-tv.git
    dockerfile: backend/animation/Dockerfile
```

## Deploy Steps

### Step 1: Set Environment Variables

```bash
export AKASH_NODE=https://rpc.akashnet.net:443
export AKASH_CHAIN_ID=akashnet-2
export AKASH_KEYRING_BACKEND=os
export AKASH_FROM=laincorp-deployer
export AKASH_GAS=auto
export AKASH_GAS_ADJUSTMENT=1.5
export AKASH_GAS_PRICES=0.025uakt
```

### Step 2: Create Deployment

```bash
cd /Users/laincorp/LainCorp/lain-tv/backend

# Deploy with build-from-source (all services built on Akash)
akash tx deployment create deploy-build.yaml --from laincorp-deployer
```

This will output a **Deployment ID (DSEQ)**. Save it!

```
DSEQ=12345678  # Your deployment sequence number
```

### Step 3: Wait for Bids

```bash
# Check bids (wait 1-2 minutes)
akash query market bid list --owner $(akash keys show laincorp-deployer -a) --dseq $DSEQ
```

### Step 4: Accept a Bid

```bash
# Get provider address from bid
PROVIDER=akash1...  # Provider address from bid list

# Create lease
akash tx market lease create --dseq $DSEQ --provider $PROVIDER --from laincorp-deployer
```

### Step 5: Send Manifest

```bash
# Send the deployment manifest to the provider
akash provider send-manifest deploy-build.yaml \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from laincorp-deployer
```

**The provider will now:**
1. Clone your GitHub repository
2. Build 4 Docker images in parallel:
   - LainLLM (AI agent with llama.cpp)
   - WebSocket (Node.js real-time server)
   - TTS (Python + Coqui TTS)
   - Animation (Python state management)
3. Download the Llama 3.1 8B model (4.5GB) when LainLLM starts
4. Start all 6 services (including Redis and Qdrant)

### Step 6: Check Build Progress

```bash
# View all build logs
akash provider lease-logs \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from laincorp-deployer \
  --follow

# Check specific service build/runtime logs
akash provider lease-logs \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from laincorp-deployer \
  --service lainllm \
  --follow

# Check WebSocket service
akash provider lease-logs \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from laincorp-deployer \
  --service websocket \
  --follow
```

### Step 7: Get Service URLs

```bash
# Get lease status with URLs
akash provider lease-status \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from laincorp-deployer
```

Output will show:
```json
{
  "services": {
    "lainllm": {
      "uris": ["http://provider.akash.network:12345"]
    },
    "websocket": {
      "uris": ["http://provider.akash.network:12346", "https://lain.tv"]
    }
  }
}
```

## Service Endpoints

After deployment, you'll have:

- **LainLLM API**: Port 8001 (globally exposed)
  - `POST /generate` - Generate AI responses with Llama 3.1 8B
  - `GET /health` - Health check
  - `GET /stats` - Service statistics

- **WebSocket Server**: Port 80 (globally exposed at lain.tv)
  - Real-time bidirectional chat interface
  - Connects to LainLLM backend
  - `GET /health` - Health check
  - `GET /history` - Chat history

- **TTS Service**: Port 8002 (internal only)
  - `POST /synthesize` - Generate speech from text
  - `GET /health` - Health check

- **Animation Service**: Port 8003 (internal only)
  - `POST /get_animation` - Get animation for mood/state
  - `GET /current` - Current animation state
  - `GET /moods` - Available moods

- **Supporting Services** (internal only):
  - Redis: Port 6379 (cache and message queue)
  - Qdrant: Port 6333/6334 (vector database for memory)

## Update Deployment

To update your code:

```bash
# 1. Push changes to GitHub
git add .
git commit -m "Update AI agent"
git push origin main

# 2. Update the deployment (triggers rebuild on Akash)
akash tx deployment update deploy-build.yaml --dseq $DSEQ --from laincorp-deployer

# 3. Send updated manifest
akash provider send-manifest deploy-build.yaml \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from laincorp-deployer
```

**Note:** Akash will automatically rebuild all services from your updated GitHub repository!

## Monitor Deployment

```bash
# Check deployment status
akash query deployment get --owner $(akash keys show laincorp-deployer -a) --dseq $DSEQ

# Check lease status
akash query market lease get \
  --owner $(akash keys show laincorp-deployer -a) \
  --dseq $DSEQ \
  --provider $PROVIDER

# View logs (all services)
akash provider lease-logs \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from laincorp-deployer \
  --follow

# View logs (specific service)
akash provider lease-logs \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from laincorp-deployer \
  --service lainllm \
  --follow

# View WebSocket logs
akash provider lease-logs \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from laincorp-deployer \
  --service websocket \
  --follow
```

## Close Deployment

```bash
# Close deployment and get refund for unused time
akash tx deployment close --dseq $DSEQ --from laincorp-deployer
```

## Estimated Costs

Based on `deploy-build.yaml` resources:

- **Total Resources**: 23 CPU cores, 21GB RAM, 35GB storage
- **Build Time**: ~10-15 minutes (one-time for all 4 services)
- **Model Download**: ~2 minutes (one-time, on first start)
- **Monthly Cost**: ~2-5 AKT/month (~$4-10 USD depending on AKT price)

**Service Resource Breakdown:**
- LainLLM: 16 CPU, 12GB RAM (largest - runs AI inference)
- Qdrant: 2 CPU, 4GB RAM (vector database)
- WebSocket: 2 CPU, 1GB RAM (real-time server)
- TTS: 2 CPU, 2GB RAM (voice synthesis)
- Redis: 0.5 CPU, 1GB RAM (cache)
- Animation: 0.5 CPU, 512MB RAM (state management)

## Troubleshooting

### Build Fails

```bash
# Check build logs for specific service
akash provider lease-logs --dseq $DSEQ --provider $PROVIDER --from laincorp-deployer --service lainllm
akash provider lease-logs --dseq $DSEQ --provider $PROVIDER --from laincorp-deployer --service websocket
akash provider lease-logs --dseq $DSEQ --provider $PROVIDER --from laincorp-deployer --service tts

# Common issues:
# - GitHub repo not public (must be public for Akash to clone)
# - Dockerfile path incorrect in deploy-build.yaml
# - Build dependencies missing or network issues during build
# - npm/pip install failures
```

### Model Download Fails

The Llama 3.1 8B model is downloaded when LainLLM container starts:

```bash
# Check logs for download errors
akash provider lease-logs --dseq $DSEQ --provider $PROVIDER --from laincorp-deployer --service lainllm

# The download-model.sh script will retry automatically
# Ensure the service has enough storage (20Gi allocated)
# Download may take 2-5 minutes depending on provider bandwidth
```

### Services Not Starting

```bash
# Check all service statuses
akash provider service-status --dseq $DSEQ --provider $PROVIDER --from laincorp-deployer

# Check specific service logs
akash provider lease-logs --dseq $DSEQ --provider $PROVIDER --from laincorp-deployer --service redis
akash provider lease-logs --dseq $DSEQ --provider $PROVIDER --from laincorp-deployer --service qdrant

# Common issues:
# - Service dependencies not ready (e.g., LainLLM waiting for Redis)
# - Port conflicts or network misconfiguration
# - Insufficient resources allocated
```

### Out of Resources

If you see "insufficient resources" errors:

1. Lower CPU/memory in `deploy-build.yaml` profiles
2. Wait for more providers to bid
3. Increase bid price in placement section

## Next Steps

1. ✅ All code pushed to GitHub (4 services with Dockerfiles)
2. ⏳ Deploy to Akash using build-from-source (one command)
3. ⏳ Monitor build progress for all 4 services
4. ⏳ Test service endpoints (LainLLM, WebSocket, TTS, Animation)
5. ⏳ Connect frontend to WebSocket service URL
6. ⏳ Configure domain DNS (lain.tv) to point to Akash deployment
7. ⏳ Test end-to-end chat flow with Lain AI

## Build-from-Source Benefits Summary

✅ **No registry uploads needed** - Builds happen directly on Akash  
✅ **No size limits** - Build dependencies don't count toward image size  
✅ **Automatic rebuilds** - Push to GitHub, update deployment, done  
✅ **Parallel builds** - All 4 services build simultaneously  
✅ **Cost effective** - Only pay for runtime, not build infrastructure  

## Resources

- [Akash Network Docs](https://docs.akash.network/)
- [Akash SDL Reference](https://docs.akash.network/readme/stack-definition-language)
- [Akash Discord](https://discord.akash.network/)
- [Provider Status](https://akashnet.net/providers)
- [GitHub Repo](https://github.com/lain-corp/lain-tv)
