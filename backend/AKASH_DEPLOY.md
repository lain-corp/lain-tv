# Akash Deployment Guide for Lain.TV

Complete guide to deploying Lain.TV backend on Akash Network.

## Prerequisites

1. **Akash CLI installed**
   ```bash
   brew install akash
   ```

2. **Akash wallet with AKT tokens**
   - Minimum 5 AKT for deployment deposit
   - Additional AKT for ongoing costs (~2-5 AKT/month)

3. **Docker images pushed to registry**
   All images must be available at `openregistry.dev/laincorp/` (all lowercase):
   - `lainllm:latest`
   - `laintts:latest`
   - `lainanimation:latest`
   - `lainwebsocket:latest`

## Step 1: Build and Push All Docker Images

### LainLLM (already done)
```bash
cd ai-agent
./build-and-push.sh
```

### Build remaining services
```bash
# TTS Engine
cd ../tts-engine
docker build -t openregistry.dev/laincorp/laintts:latest .
docker push openregistry.dev/laincorp/laintts:latest

# Animation Controller
cd ../animation-controller
docker build -t openregistry.dev/laincorp/lainanimation:latest .
docker push openregistry.dev/laincorp/lainanimation:latest

# WebSocket Server
cd ../websocket-server
docker build -t openregistry.dev/laincorp/lainwebsocket:latest .
docker push openregistry.dev/laincorp/lainwebsocket:latest
```

## Step 2: Setup Akash Wallet

```bash
# Create or import wallet
akash keys add lain-deployer
# OR import existing: akash keys add lain-deployer --recover

# Export wallet address
export AKASH_ACCOUNT_ADDRESS="$(akash keys show lain-deployer -a)"
export AKASH_KEY_NAME=lain-deployer
export AKASH_KEYRING_BACKEND=os
export AKASH_NET="https://raw.githubusercontent.com/akash-network/net/main/mainnet"
export AKASH_VERSION="$(akash version | grep 'Version:' | cut -d' ' -f2)"
export AKASH_CHAIN_ID="$(curl -s "$AKASH_NET/chain-id.txt")"
export AKASH_NODE="$(curl -s "$AKASH_NET/rpc-nodes.txt" | head -n1)"

# Fund wallet (if needed)
echo "Send AKT to: $AKASH_ACCOUNT_ADDRESS"
```

## Step 3: Create Deployment Certificate

```bash
# Create certificate (one-time setup)
akash tx cert generate client --from $AKASH_KEY_NAME

# Publish certificate to blockchain
akash tx cert publish client --from $AKASH_KEY_NAME
```

## Step 4: Deploy to Akash

```bash
cd /Users/laincorp/LainCorp/lain-tv/backend

# Create deployment
akash tx deployment create deploy.yaml --from $AKASH_KEY_NAME

# Get deployment sequence (DSEQ)
export AKASH_DSEQ="$(akash query deployment list --owner $AKASH_ACCOUNT_ADDRESS --state active | grep -A1 'dseq:' | tail -n1 | awk '{print $2}')"

echo "Deployment DSEQ: $AKASH_DSEQ"

# Wait for bids (30-60 seconds)
akash query market bid list --owner $AKASH_ACCOUNT_ADDRESS --dseq $AKASH_DSEQ

# Choose a bid and create lease
export AKASH_PROVIDER="<provider-address-from-bids>"

akash tx market lease create --dseq $AKASH_DSEQ --from $AKASH_KEY_NAME --provider $AKASH_PROVIDER

# Send manifest to provider
akash provider send-manifest deploy.yaml --dseq $AKASH_DSEQ --from $AKASH_KEY_NAME --provider $AKASH_PROVIDER
```

## Step 5: Get Service URLs

```bash
# Get lease status and URLs
akash provider lease-status --dseq $AKASH_DSEQ --from $AKASH_KEY_NAME --provider $AKASH_PROVIDER

# Your services will be available at:
# - LainLLM API: http://<provider-ip>:<port-lainllm>
# - WebSocket: ws://<provider-ip>:<port-websocket>
```

## Step 6: Test Deployment

```bash
# Get forwarded ports
akash provider lease-status --dseq $AKASH_DSEQ --from $AKASH_KEY_NAME --provider $AKASH_PROVIDER | grep "forwarded-port"

# Test LainLLM health
curl http://<provider-ip>:<lainllm-port>/health

# Test WebSocket health
curl http://<provider-ip>:<websocket-port>/health

# Test AI generation
curl -X POST http://<provider-ip>:<lainllm-port>/generate \
  -H "Content-Type: application/json" \
  -d '{
    "message": "hello lain",
    "principal_id": "test-user"
  }'
```

## Resource Allocation

**Total Resources:**
- CPU: 23 cores
- RAM: 21GB
- Storage: 25GB

**Estimated Cost:** ~2-5 AKT/month (~$4-10 USD)

**Per Service:**
- **LainLLM**: 16 CPU, 12GB RAM (main inference)
- **Qdrant**: 2 CPU, 4GB RAM (vector DB)
- **WebSocket**: 2 CPU, 1GB RAM (connections)
- **TTS**: 2 CPU, 2GB RAM (voice synthesis)
- **Redis**: 0.5 CPU, 1GB RAM (cache)
- **Animation**: 0.5 CPU, 512MB RAM (state machine)

## Management Commands

### Update deployment
```bash
# Modify deploy.yaml, then:
akash tx deployment update deploy.yaml --dseq $AKASH_DSEQ --from $AKASH_KEY_NAME
akash provider send-manifest deploy.yaml --dseq $AKASH_DSEQ --from $AKASH_KEY_NAME --provider $AKASH_PROVIDER
```

### Close deployment
```bash
akash tx deployment close --dseq $AKASH_DSEQ --from $AKASH_KEY_NAME
```

### View logs
```bash
akash provider service-logs --dseq $AKASH_DSEQ --from $AKASH_KEY_NAME --provider $AKASH_PROVIDER --service lainllm
akash provider service-logs --dseq $AKASH_DSEQ --from $AKASH_KEY_NAME --provider $AKASH_PROVIDER --service websocket
```

### Shell access
```bash
akash provider lease-shell --dseq $AKASH_DSEQ --from $AKASH_KEY_NAME --provider $AKASH_PROVIDER --service lainllm
```

## Important Notes

1. **Model Download**: The Llama 3.1 8B model (~4.5GB) must be included in the Docker image or downloaded on first start
2. **Persistent Storage**: Redis and Qdrant use ephemeral storage - consider backup strategy
3. **Public Access**: WebSocket is exposed globally for frontend connections
4. **Cost Monitoring**: Check lease status regularly to monitor AKT spending

## Troubleshooting

**Deployment fails:**
- Check all Docker images are pushed to registry
- Verify wallet has enough AKT (5+ AKT)
- Try different provider if bids fail

**Services not responding:**
- Check logs: `akash provider service-logs`
- Verify service dependencies are healthy
- Check resource limits aren't exceeded

**High costs:**
- Reduce CPU allocation for non-LLM services
- Use smaller model (3B instead of 8B)
- Lower `N_THREADS` in LainLLM

## Next Steps

After deployment:
1. Note down the WebSocket URL
2. Update ICP frontend with WebSocket endpoint
3. Test end-to-end with frontend
4. Setup monitoring/alerts
5. Configure domain name (optional)
