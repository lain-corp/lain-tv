# Local Testing Guide

Test the complete Lain.TV backend locally before deploying to Akash.

## Quick Start

```bash
cd backend

# Run automated tests (starts all services and tests endpoints)
./test.sh
```

This will:
1. Start all 7 services via Docker Compose
2. Wait for services to be ready (2-5 minutes for first run)
3. Run automated API tests
4. Display service status and available endpoints

## Manual Testing

### Start Services

```bash
cd backend
docker-compose up -d
```

### Check Service Status

```bash
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f lainllm
docker-compose logs -f websocket
docker-compose logs -f nginx
```

### Test Endpoints

**1. Health Check**
```bash
curl http://localhost:8080/health
```

**2. LainLLM AI Generation**
```bash
curl -X POST http://localhost:8080/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello Lain, tell me about the Wired",
    "user_id": "test_user",
    "username": "Tester"
  }'
```

**3. LainLLM Stats**
```bash
curl http://localhost:8080/api/ai/stats
```

**4. Chat History**
```bash
curl http://localhost:8080/api/history
```

**5. Animation Moods**
```bash
curl http://localhost:8080/api/animation/moods
```

**6. Get Animation for Mood**
```bash
curl -X POST http://localhost:8080/api/animation/get_animation \
  -H "Content-Type: application/json" \
  -d '{
    "mood": "cryptic",
    "state": "speaking"
  }'
```

**7. TTS Health**
```bash
curl http://localhost:8080/api/tts/health
```

### WebSocket Testing

**Option 1: Using wscat (install with `npm install -g wscat`)**
```bash
wscat -c ws://localhost:8080/ws

# Then send:
{"type":"chat","message":"Hello Lain!","username":"Tester","user_id":"test_001"}
```

**Option 2: Using Node.js test script**
```bash
cd backend/websocket
npm install
cd ..
node test-websocket.js
```

**Option 3: Using browser console**
```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
    console.log('Connected!');
    ws.send(JSON.stringify({
        type: 'chat',
        message: 'Hello Lain!',
        username: 'Browser',
        user_id: 'browser_001'
    }));
};

ws.onmessage = (event) => {
    console.log('Received:', JSON.parse(event.data));
};
```

## Service Architecture

```
┌─────────────────────────────────────────────┐
│         Browser/Client (port 8080)          │
└─────────────────┬───────────────────────────┘
                  │
         ┌────────▼────────┐
         │     Nginx       │  Reverse Proxy
         │   Port: 80      │
         └────────┬────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼────┐  ┌────▼────┐  ┌─────▼──────┐
│WebSocket│ │ LainLLM │  │ TTS/Anim   │
│:8080    │ │  :8001  │  │ :8002/8003 │
└───┬────┘  └────┬────┘  └─────┬──────┘
    │            │              │
    └────────────┼──────────────┘
                 │
         ┌───────┴────────┐
         │                │
    ┌────▼────┐    ┌─────▼──────┐
    │  Redis  │    │   Qdrant   │
    │  :6379  │    │ :6333/6334 │
    └─────────┘    └────────────┘
```

## Troubleshooting

### Model Download Taking Too Long

The first time LainLLM starts, it downloads a 4.5GB model. Monitor progress:

```bash
docker-compose logs -f lainllm
```

### Service Won't Start

Check individual service logs:

```bash
docker-compose logs lainllm
docker-compose logs websocket
docker-compose logs nginx
```

### Port Already in Use

If port 8080 is already in use, edit `docker-compose.yml`:

```yaml
nginx:
  ports:
    - "9090:80"  # Change 8080 to any available port
```

### Out of Memory

LainLLM needs at least 8GB RAM. Reduce threads in `docker-compose.yml`:

```yaml
lainllm:
  environment:
    - N_THREADS=4  # Reduce from 8
```

### Reset Everything

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove downloaded model (will re-download)
docker volume rm backend_model-cache

# Start fresh
docker-compose up -d
```

## Expected Resource Usage

- **CPU**: ~10-12 cores total
- **RAM**: ~10-12GB total
  - LainLLM: ~6-8GB (largest)
  - Qdrant: ~2GB
  - Others: ~2GB combined
- **Disk**: ~6GB (mostly model file)

## Stop Services

```bash
# Stop but keep data
docker-compose down

# Stop and remove all data
docker-compose down -v
```

## Next Steps

Once local testing passes:
1. Push any fixes to GitHub
2. Deploy to Akash using `deploy-build.yaml`
3. Akash will build the same images and run the same configuration
