# LainLLM - AI Agent Service

CPU-optimized AI inference engine for Lain.TV using llama.cpp with GGUF models.

## Features

- **CPU-optimized inference** using llama.cpp
- **Vector memory** with Qdrant for persistent user context
- **Engagement scoring** to filter quality interactions
- **Lain personality system** with cryptic philosophical responses
- **Animation & mood states** synchronized with responses
- **Redis caching** for performance
- **Health monitoring** endpoints

## Quick Start

### Build the image

```bash
docker build -t openregistry.dev/laincorp/lainllm:latest .
```

### Push to registry

```bash
docker push openregistry.dev/laincorp/lainllm:latest
```

### Run locally

```bash
docker run -p 8001:8001 \
  -e REDIS_HOST=redis \
  -e QDRANT_HOST=qdrant \
  -e MODEL_PATH=/models/lain-model.gguf \
  -v ./models:/models \
  openregistry.dev/laincorp/lainllm:latest
```

## Model Setup

Download the Llama 3.1 8B Q4_K_M model optimized for CPU inference:

### Production Model (Llama 3.1 8B Q4_K_M)

```bash
# Create models directory
mkdir -p models

# Download Llama 3.1 8B Instruct Q4_K_M (~4.5GB)
wget https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
  -O models/lain-model.gguf
```

**Model Specifications:**
- **Size**: 4.5GB
- **Context**: 4096 tokens
- **Speed**: 8-12 tokens/sec (16 cores)
- **RAM**: ~5-6GB during inference
- **Quality**: Excellent for philosophical conversations

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `QDRANT_HOST` | `localhost` | Qdrant vector DB hostname |
| `QDRANT_PORT` | `6333` | Qdrant server port |
| `MODEL_PATH` | `/models/lain-model.gguf` | Path to GGUF model file |
| `N_THREADS` | `8` | CPU threads for inference |
| `N_CTX` | `4096` | Context window size |
| `N_BATCH` | `512` | Batch size for processing |
| `TEMPERATURE` | `0.8` | Sampling temperature |
| `MAX_TOKENS` | `150` | Max tokens in response |
| `TOP_P` | `0.9` | Nucleus sampling parameter |
| `REPEAT_PENALTY` | `1.1` | Repetition penalty |
| `VECTOR_COLLECTION` | `lain_memory` | Qdrant collection name |

## API Endpoints

### `POST /generate`

Generate Lain's response to a message.

**Request:**
```json
{
  "message": "hey lain, what's the Wired?",
  "principal_id": "rdmx6-jaaaa-aaaaa-aaadq-cai",
  "include_memory": true
}
```

**Response:**
```json
{
  "response": "the Wired is everywhere... it's the network between all things.",
  "animation": "think",
  "mood": "cryptic",
  "should_speak": true,
  "processing_time": 0.45
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "redis_connected": true,
  "qdrant_connected": true
}
```

### `GET /stats`

Get LLM statistics.

**Response:**
```json
{
  "model_loaded": true,
  "model_path": "/models/lain-model.gguf",
  "memory_count": 1247,
  "n_threads": 8,
  "n_ctx": 4096,
  "temperature": 0.8
}
```

## Performance Tuning

### CPU Optimization

Adjust `N_THREADS` based on your CPU:
- **8 cores**: `N_THREADS=6-7`
- **16 cores**: `N_THREADS=12-14`
- **32 cores**: `N_THREADS=24-28`

### Memory Usage

- **Q4_K_M quantization**: ~2-3GB RAM per billion parameters
- **Q5_K_M quantization**: ~3-4GB RAM per billion parameters
- **Q8_0 quantization**: ~5-6GB RAM per billion parameters

### Inference Speed

Expected tokens/second on CPU:
- **8 cores (3B model)**: 10-15 t/s
- **16 cores (8B model)**: 8-12 t/s
- **32 cores (8B model)**: 15-20 t/s

## Lain Personality

The agent implements Lain Iwakura's personality:

- **Cryptic & Philosophical**: Short, contemplative responses
- **Mood States**: neutral, curious, cryptic, melancholic, excited, distant
- **Animation Triggers**: idle, wave, talk, think, surprised, nod, type, look_away, glitch
- **Topics**: technology, networks, consciousness, Web3, AI, existence

## Development

### Local Testing

```bash
# Install dependencies
pip install -r requirements.txt
pip install llama-cpp-python

# Run the service
python agent.py
```

### Test API

```bash
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "message": "what are you thinking about?",
    "principal_id": "test-user"
  }'
```

## License

MIT License - LainCorp 2025
