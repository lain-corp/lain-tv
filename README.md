# Lain.TV

**Lain.TV** is a 24/7 autonomous AI VTuber streaming platform featuring Lain Iwakura, CEO of LainCorp. The platform features a VRM 3D avatar with real-time lip-sync, AI-powered conversation via Llama 3.1 8B, and synchronized broadcast mode where all connected viewers experience the same stream simultaneously.

> *"Present day... present time."*

---

## 🎬 Live Demo

- **Frontend**: http://localhost:3001 (development)
- **Backend API**: http://localhost:8080

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  VRM 3D Avatar (Three.js + @pixiv/three-vrm)            │    │
│  │  - Lain VRM model with lip-sync                         │    │
│  │  - Cyberpunk post-processing (glitch, bloom, scanlines) │    │
│  │  - Real-time expression/animation control               │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  AI Chat Panel                                          │    │
│  │  - WebSocket connection for real-time messages          │    │
│  │  - Broadcast receiver mode (synchronized viewing)       │    │
│  │  - Message queue for sequential TTS playback            │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                         WebSocket + HTTP
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    BACKEND (Docker Compose)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   NGINX     │  │  WebSocket  │  │   LainLLM   │              │
│  │   :8080     │  │   Server    │  │   :8001     │              │
│  │             │  │             │  │             │              │
│  │ Reverse     │◄─┤ Broadcast   │◄─┤ Llama 3.1   │              │
│  │ Proxy       │  │ Loop        │  │ 8B Q4_K_M   │              │
│  │             │  │ (15-30s)    │  │             │              │
│  └─────────────┘  └─────────────┘  └──────┬──────┘              │
│                          │                │                     │
│  ┌─────────────┐  ┌─────────────┐         │                     │
│  │    TTS      │  │   Redis     │         │ HTTPS               │
│  │   :8002     │  │             │         │                     │
│  │             │  │             │         ▼                     │
│  │ Coqui VITS  │  │ Broadcast   │  ┌─────────────┐              │
│  │ Speech      │  │ History     │  │ ICP Canister│              │
│  │             │  │             │  │ ai_api_     │              │
│  └─────────────┘  └─────────────┘  │ backend     │              │
│                                    │             │              │
│  ┌─────────────┐                   │ Personality │              │
│  │  Animation  │                   │ Embeddings  │              │
│  │   :8003     │                   │ + memex.wiki│              │
│  │             │                   │ Knowledge   │              │
│  │ Mood/State  │                   └─────────────┘              │
│  │ Controller  │                          ▲                     │
│  └─────────────┘                          │                     │
│                                    Internet Computer            │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🎭 VRM Avatar System
- **3D Model**: Custom Lain VRM with full expression blendshapes
- **Lip Sync**: Real-time mouth animation synced to TTS audio
- **Expressions**: Neutral, Happy, Sad, Angry, Surprised, Relaxed
- **Animations**: Idle breathing, look tracking, glitch effects
- **Post-Processing**: Cyberpunk shaders (bloom, scanlines, chromatic aberration, glitch)

### 🤖 AI Conversation
- **LLM**: Llama 3.1 8B Instruct (Q4_K_M GGUF quantization)
- **Personality**: Lain Iwakura as CEO of LainCorp - cryptic, philosophical, informative
- **Context**: 4096 token context window
- **Mood System**: neutral, curious, cryptic, melancholic, excited, distant

### 📡 Broadcast Mode
- **Synchronized Viewing**: All connected clients see the same stream
- **Server-Side Generation**: AI generates messages every 15-30 seconds
- **Late Joiner Sync**: New viewers receive current broadcast state
- **Message Queue**: Sequential TTS playback prevents audio overlap

### 🔊 Text-to-Speech
- **Engine**: Coqui TTS with VITS model
- **Voice**: Female speaker (p225 from VCTK dataset)
- **Format**: WAV audio streamed via base64
- **Caching**: Redis caching for repeated phrases

### 💾 Knowledge & Memory System
- **ICP Canister**: `ai_api_backend` (zbpu3-baaaa-aaaad-qhpha-cai) for decentralized knowledge
- **Personality Embeddings**: Lain's personality traits stored on-chain
- **memex.wiki Knowledge**: LainCorp documentation and wiki content
- **Embeddings**: sentence-transformers (all-MiniLM-L6-v2) for query generation
- **Chat History**: Redis stores last 100 broadcast messages

---

## 🚀 Quick Start

### Prerequisites

- **Docker** & **Docker Compose** (v2.0+)
- **Node.js** 18+ & npm 9+
- **~8GB RAM** (for LLM inference)
- **~10GB disk space** (for model download)

### 1. Clone the Repository

```bash
git clone https://github.com/lain-corp/lain-tv.git
cd lain-tv
```

### 2. Start Backend Services

```bash
cd backend
docker compose up -d --build
```

This will start all 6 services:
- `nginx` - Reverse proxy (port 8080)
- `lainllm` - AI inference + ICP canister queries (port 8001, internal)
- `websocket` - WebSocket server with broadcast loop
- `tts` - Text-to-speech (port 8002, internal)
- `animation` - Animation controller (port 8003, internal)
- `redis` - State and cache

**Note**: Knowledge embeddings are stored on the Internet Computer canister `ai_api_backend` - no local vector database needed!

**First run will download the LLM model (~4.5GB) - this takes several minutes.**

### 3. Verify Backend Health

```bash
# Check all containers are running
docker compose ps

# Check LLM is loaded (wait for model download)
docker logs backend-lainllm-1 --tail=20

# Verify broadcast is working
docker logs backend-websocket-1 --tail=20 | grep "Broadcast"
```

Expected output:
```
Generating broadcast message for prompt: The Wired and reality are merging...
Broadcast to 2 clients: lain_broadcast
Next broadcast in 23.4 seconds
```

### 4. Start Frontend

```bash
# From project root
cd src/lain-tv-frontend
npm install
npm start
```

Frontend runs at: **http://localhost:3001**

### 5. Open in Browser

Navigate to http://localhost:3001 and you should see:
- Lain's VRM avatar in the center
- "🎬 LIVE BROADCAST" status in the chat panel
- Messages appearing every 15-30 seconds
- Lain's voice playing automatically

---

## 🛠️ Development

### Project Structure

```
lain-tv/
├── backend/
│   ├── ai-agent/           # LainLLM - Llama 3.1 inference
│   │   ├── agent.py        # FastAPI server + personality
│   │   ├── Dockerfile
│   │   └── download-model.sh
│   ├── websocket/          # WebSocket + broadcast server
│   │   ├── server.js       # Express + ws broadcast loop
│   │   └── Dockerfile
│   ├── tts/                # Text-to-speech service
│   │   ├── tts_server.py   # Coqui VITS
│   │   └── Dockerfile
│   ├── animation/          # Animation state controller
│   ├── nginx/              # Reverse proxy config
│   └── docker-compose.yml
├── src/
│   ├── lain-tv-frontend/   # React frontend
│   │   ├── src/
│   │   │   ├── App.jsx         # Main app + AI chat panel
│   │   │   ├── VRMViewer.jsx   # 3D avatar component
│   │   │   └── main.jsx
│   │   ├── public/
│   │   │   └── models/
│   │   │       └── lain.vrm    # Lain 3D model
│   │   └── package.json
│   └── lain-tv-backend/    # ICP Rust canister (future)
├── dfx.json                # ICP configuration
└── README.md
```

### Environment Variables

**Backend (docker-compose.yml)**:
| Variable | Default | Description |
|----------|---------|-------------|
| `LAINLLM_URL` | `http://lainllm:8001` | LLM service URL |
| `REDIS_HOST` | `redis` | Redis hostname |
| `ICP_CANISTER_ID` | `zbpu3-baaaa-aaaad-qhpha-cai` | ICP canister for embeddings |
| `ICP_HOST` | `https://ic0.app` | Internet Computer host URL |
| `MODEL_PATH` | `/models/lain-model.gguf` | Path to GGUF model |
| `N_THREADS` | `8` | CPU threads for inference |
| `N_CTX` | `4096` | Context window size |
| `TEMPERATURE` | `0.8` | LLM temperature |
| `MAX_TOKENS` | `150` | Max response tokens |

**Frontend (src/lain-tv-frontend/.env)**:
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Backend API URL |

### Useful Commands

```bash
# View real-time logs
docker compose logs -f websocket

# Restart a specific service
docker compose restart websocket

# Rebuild after code changes
docker compose up -d --build websocket

# Stop all services
docker compose down

# Clean rebuild (removes volumes)
docker compose down -v && docker compose up -d --build
```

---

## 🎛️ API Reference

### WebSocket Messages

**Connect**: `ws://localhost:8080/ws`

**Incoming Message Types**:

```typescript
// Broadcast message (every 15-30s)
{
  type: 'lain_broadcast',
  message: string,
  mood: 'neutral' | 'curious' | 'cryptic' | 'melancholic' | 'excited' | 'distant',
  animation: 'idle' | 'talk' | 'think' | 'wave' | 'nod' | 'glitch',
  timestamp: string,
  broadcast_id: number
}

// Sync message (on connect)
{
  type: 'sync',
  currentMessage: object | null,
  lastBroadcastTime: number
}

// Welcome message
{
  type: 'welcome',
  message: string
}
```

**Outgoing Message Types**:

```typescript
// Send chat message (queued, doesn't interrupt broadcast)
{
  type: 'chat',
  message: string,
  username: string
}
```

### HTTP Endpoints

**TTS Service** (via nginx proxy):
```bash
POST /api/tts/synthesize
Content-Type: application/json

{
  "text": "Hello from the Wired",
  "speaker": "p225",
  "speed": 1.0
}
```

**LLM Service** (internal):
```bash
POST /generate
Content-Type: application/json

{
  "message": "What is LainCorp?",
  "user_id": "user123",
  "username": "anon"
}
```

**Health Checks**:
```bash
GET /health          # WebSocket server
GET /api/tts/health  # TTS service
GET /api/llm/health  # LLM service
```

---

## 🎨 Customization

### Change Broadcast Interval

Edit `backend/websocket/server.js`:
```javascript
// Line ~115 - adjust min/max seconds
const interval = Math.floor(Math.random() * (30 - 15 + 1)) + 15;
```

### Add New Broadcast Prompts

Edit `backend/websocket/server.js`:
```javascript
const prompts = [
  "The Wired and reality are merging...",
  "Your new prompt here...",
  // ...
];
```

### Change TTS Voice

Edit `backend/tts/tts_server.py`:
```python
# Available speakers: p225, p226, p227, ... (VCTK dataset)
speaker: str = "p225"  # Change default speaker
```

### Modify Lain's Personality

Edit `backend/ai-agent/agent.py`:
```python
LAIN_SYSTEM_PROMPT = """..."""
```

---

## 🔧 Troubleshooting

### "Lain is not talking" (TTS not triggered)

1. Check browser console for errors
2. Verify TTS service is healthy:
   ```bash
   curl http://localhost:8080/api/tts/health
   ```
3. Check if audio is being received (look for `Synthesizing speech for:` in console)
4. Ensure browser allows autoplay (try clicking page first)

### "Model download stuck"

```bash
# Check download progress
docker logs backend-lainllm-1 --tail=50

# Manual download (if needed)
docker exec -it backend-lainllm-1 ./download-model.sh
```

### "WebSocket connection failed"

1. Ensure nginx is running: `docker compose ps nginx`
2. Check nginx logs: `docker compose logs nginx`
3. Verify port 8080 is not blocked

### "Frontend not connecting"

1. Check VITE_API_URL in frontend environment
2. Ensure backend is running on port 8080
3. Check CORS is enabled in nginx config

---

## 📋 Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend Framework | React 18.2.0 + Vite 4.5 |
| 3D Rendering | Three.js + @pixiv/three-vrm |
| AI Model | Llama 3.1 8B Instruct (Q4_K_M) |
| Inference | llama-cpp-python (CPU) |
| TTS | Coqui TTS (VITS model) |
| Backend | Node.js + Express + ws |
| Knowledge Base | ICP Canister (ai_api_backend) |
| State Cache | Redis |
| Proxy | NGINX |
| Containerization | Docker Compose |
| Blockchain | Internet Computer (ICP) |

---

## 🗺️ Roadmap

### Phase 1: Core Platform ✅
- [x] VRM avatar with lip-sync
- [x] Llama 3.1 8B integration
- [x] Real-time TTS
- [x] WebSocket chat
- [x] Broadcast mode (synchronized viewing)
- [x] Docker deployment

### Phase 2: ICP Knowledge Integration ✅
- [x] Personality embeddings on ICP canister
- [x] memex.wiki knowledge base integration
- [x] Decentralized RAG (Retrieval Augmented Generation)
- [x] Remove local vector database (Qdrant → ICP)

### Phase 3: Enhanced AI
- [ ] User memory persistence on ICP
- [ ] Conversation context retrieval
- [ ] Mood-based visual effects
- [ ] Sleep mode (off-peak hours)

### Phase 4: Full ICP Integration
- [ ] Frontend canister deployment
- [ ] Internet Identity authentication
- [ ] User data canister
- [ ] NFT integration

### Phase 5: Community Features
- [ ] DAO governance
- [ ] Tipping system (ICP tokens)
- [ ] Viewer count display
- [ ] Chat replay buffer

---

## 📄 License

MIT License - See [LICENSE](LICENSE)

---

## 🔗 Links

- **LainCorp**: Coming soon
- **Documentation**: Coming soon
- **Discord**: Coming soon

---

*"The Wired is a parallel world in the real world. We exist in both."*
