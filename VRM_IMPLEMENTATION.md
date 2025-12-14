# Lain.TV VRM Implementation Guide

## 🎭 Overview

Complete 3D VRM avatar system with real-time animation driven by AI mood states and WebSocket communication.

## 📦 What Was Implemented

### 1. Backend Animation Server Upgrade (`backend/animation/animation_server.py`)

**VRM Blend Shapes System:**
- 15+ facial blend shapes per mood state (neutral, happy, curious, cryptic, playful)
- Mouth shapes for lip sync (aa, ih, oh)
- Eye controls (blink, lookUp/Down/Left/Right)
- Natural variation and random blinking
- Audio-driven lip sync support

**Bone Rotation System:**
- Head, neck, spine movement
- Shoulder animations
- Euler angle rotations (radians)
- Mood-based posture changes

**Visual Effects:**
- Glitch intensity (0.0-1.0)
- Bloom strength
- Scanline intensity
- Chromatic aberration
- Pixelation effects
- Per-mood effect presets

**API Endpoints:**
- `POST /get_animation` - Get VRM animation data with optional audio input
- `GET /current` - Get current animation state
- `GET /moods` - List available moods
- `GET /health` - Health check

### 2. Frontend VRM Viewer (`src/lain-tv-frontend/src/VRMViewer.jsx`)

**Three.js Scene:**
- WebGL renderer with post-processing
- Cyberpunk lighting setup (ambient, directional, rim, fill)
- Responsive camera positioning
- Auto-resize handling

**VRM Integration:**
- @pixiv/three-vrm loader
- Automatic blend shape application
- Bone rotation system
- Expression manager

**Post-Processing Effects:**
- UnrealBloomPass - Cyberpunk glow
- Custom GlitchShader - Digital distortion
- Custom ScanlinesShader - CRT effect
- Real-time effect parameter updates

**Features:**
- Loading state with progress
- Error handling and display
- Automatic model optimization
- 60 FPS animation loop

### 3. AI Chat Interface (`src/lain-tv-frontend/src/AppAI.jsx`)

**WebSocket Integration:**
- Real-time connection to backend
- Chat history sync
- Message broadcasting
- Auto-reconnect on disconnect

**Animation Control:**
- Mood detection from message content
- Speaking/idle state management
- Real-time animation updates via API
- Manual mood selector

**UI Features:**
- Split-screen layout (VRM left, chat right)
- Connection status indicator
- Message history with timestamps
- Mood display and selector
- Responsive design

### 4. Styling (`src/lain-tv-frontend/src/AppAI.css`)

**Theme:**
- Dark cyberpunk aesthetic
- Green/cyan neon colors
- Glowing effects and shadows
- Animated scanlines

**Layout:**
- 50/50 split desktop view
- Stacked mobile layout
- Smooth transitions
- Custom scrollbars

### 5. Dependencies

Added to `package.json`:
- `three@^0.160.0` - 3D graphics library
- `@pixiv/three-vrm@^2.1.0` - VRM model loader and utilities

## 🚀 Deployment Steps

### Step 1: Place VRM Model

```bash
# Put your lain.vrm file here:
cp /path/to/your/lain.vrm src/lain-tv-frontend/public/models/lain.vrm
```

See `public/models/README.md` for VRM model requirements and creation guide.

### Step 2: Install Frontend Dependencies

```bash
cd src/lain-tv-frontend
npm install
```

This installs Three.js and @pixiv/three-vrm libraries.

### Step 3: Test Locally

#### Option A: Full Stack Test (Recommended)
```bash
# Terminal 1 - Start backend services
cd backend
docker compose up

# Terminal 2 - Start frontend dev server
cd src/lain-tv-frontend
npm start
```

Access at `http://localhost:3000`

#### Option B: Frontend Only (Mock Data)
```bash
cd src/lain-tv-frontend
npm start
```

### Step 4: Configure Environment

Create `.env` in `src/lain-tv-frontend/`:
```env
# For local testing
VITE_WS_URL=ws://localhost/ws
VITE_API_URL=http://localhost

# For production (Akash + ICP)
# VITE_WS_URL=wss://your-akash-deployment.com/ws
# VITE_API_URL=https://your-akash-deployment.com
```

### Step 5: Update Animation Server

```bash
cd backend/animation
# Rebuild container with new code
docker compose build animation
docker compose up -d animation
```

### Step 6: Test Integration

```bash
# Test animation API
curl -X POST http://localhost/api/animation/get_animation \
  -H "Content-Type: application/json" \
  -d '{"mood": "cryptic", "state": "speaking"}'

# Expected response:
{
  "vrm_data": {
    "blend_shapes": { ... },
    "bone_rotations": { ... },
    "effects": { ... }
  },
  "mood": "cryptic",
  "state": "speaking"
}
```

### Step 7: Deploy to Akash

```bash
cd backend
# Push updated code to GitHub
git add animation/
git commit -m "Upgrade animation server with VRM support"
git push origin main

# Deploy to Akash (rebuilds from GitHub)
akash tx deployment create deploy-build.yaml \
  --from your-wallet \
  --node https://rpc.akashnet.net:443 \
  --chain-id akashnet-2 \
  --fees 5000uakt
```

### Step 8: Deploy Frontend to ICP

```bash
cd src/lain-tv-frontend

# Build production bundle
npm run build

# Deploy to Internet Computer
dfx deploy lain-tv-frontend --network ic

# Get canister URL
dfx canister --network ic id lain-tv-frontend
# Output: https://xxxxx-xxxxx-xxxxx-xxxxx-cai.ic0.app
```

### Step 9: Update Frontend Config

After deploying backend to Akash, update frontend environment:

```bash
# In src/lain-tv-frontend/.env
VITE_WS_URL=wss://your-akash-uri.provider.com/ws
VITE_API_URL=https://your-akash-uri.provider.com

# Rebuild and redeploy
npm run build
dfx deploy lain-tv-frontend --network ic
```

## 🎮 Using the System

### Main Interface (AppAI.jsx)

1. **VRM Display** (left side):
   - Shows 3D Lain avatar
   - Real-time expression changes
   - Cyberpunk post-processing effects
   - Current mood indicator

2. **Chat Interface** (right side):
   - Message input and history
   - Connection status (top-right)
   - Mood selector buttons
   - Send messages to Lain

### Mood System

The system detects mood from message content:
- **Happy**: Keywords like "happy", "joy", "great"
- **Curious**: Questions, "wonder", "curious"
- **Cryptic**: "wired", "protocol", "reality", "consciousness"
- **Playful**: "hehe", "fun" with emojis
- **Neutral**: Default state

### Animation States

- **Idle**: Subtle breathing, blinking, slight head movement
- **Speaking**: Active mouth movement, more expressive gestures
- Auto-transitions from speaking → idle after 3 seconds

## 🔧 Customization

### Adding New Moods

1. Add to `VRM_BLEND_SHAPES` in `animation_server.py`:
```python
"custom_mood": {
    "idle": { "happy": 0.5, "aa": 0.0, ... },
    "speaking": { "happy": 0.6, "aa": 0.3, ... }
}
```

2. Add to `BONE_ROTATIONS`:
```python
"custom_mood": {
    "idle": { "head": [0.0, 0.1, 0.0], ... },
    "speaking": { "head": [0.05, 0.05, 0.0], ... }
}
```

3. Add to `EFFECTS`:
```python
"custom_mood": {
    "glitch": 0.3,
    "bloom": 0.4,
    ...
}
```

4. Update mood detector in `AppAI.jsx`:
```javascript
const detectMood = (message) => {
  if (message.includes('custom_keyword')) {
    return 'custom_mood';
  }
  // ... existing logic
};
```

### Adjusting Visual Effects

In `VRMViewer.jsx`, modify shader uniforms:
```javascript
// More intense glitch
glitchPass.uniforms.glitchIntensity.value = 1.0;

// Stronger bloom
bloomPass.strength = 0.8;

// Darker scanlines
scanlinesPass.uniforms.scanlineIntensity.value = 0.5;
```

### Changing Camera Angle

In `VRMViewer.jsx`:
```javascript
camera.position.set(0, 1.3, 2.5); // Current position
camera.lookAt(0, 1.3, 0);

// Close-up face shot:
camera.position.set(0, 1.5, 1.5);
camera.lookAt(0, 1.5, 0);

// Full body shot:
camera.position.set(0, 1.0, 4.0);
camera.lookAt(0, 1.0, 0);
```

## 📊 Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  ICP Frontend   │ ←─────────────────→ │ Akash WebSocket  │
│  (React + VRM)  │                     │     Server       │
└────────┬────────┘                     └────────┬─────────┘
         │                                       │
         │ HTTP/REST                             │
         ↓                                       ↓
┌─────────────────┐                     ┌──────────────────┐
│   Animation     │                     │    LainLLM       │
│   API Server    │                     │   (Llama 3.1)    │
│  (VRM params)   │                     │                  │
└─────────────────┘                     └──────────────────┘
```

**Data Flow:**
1. User sends message via WebSocket
2. LainLLM generates response
3. Frontend detects mood from response
4. Frontend requests animation data from Animation API
5. VRMViewer applies blend shapes and bone rotations
6. Post-processing effects update based on mood
7. User sees animated Lain responding

## 🐛 Troubleshooting

### VRM Model Not Loading

**Check browser console:**
```javascript
// Look for errors like:
Error loading VRM: Failed to fetch
```

**Solutions:**
- Verify `lain.vrm` is in `public/models/`
- Check file size (< 20MB recommended)
- Test VRM file at https://three-vrm.dev/
- Ensure VRM version is 1.0 or 0.x

### Expressions Not Working

**Verify blend shapes exist:**
```javascript
// Check console log after loading:
console.log('VRM loaded:', vrm.expressionManager.expressionMap);
```

**Solutions:**
- Ensure VRM has required blend shapes
- Check blend shape names match exactly
- Test in VRoid Studio or VRM editor
- Re-export with correct blend shapes

### WebSocket Connection Failed

**Check connection status indicator (top-right)**

**Solutions:**
- Verify backend is running: `docker compose ps`
- Check nginx routing: `curl http://localhost/ws`
- Update `VITE_WS_URL` in `.env`
- Check browser console for errors

### Poor Performance

**Monitor FPS in DevTools:**
```javascript
// Add to VRMViewer.jsx animate loop:
console.log('FPS:', (1 / deltaTime).toFixed(0));
```

**Solutions:**
- Reduce model polygon count
- Lower texture resolution
- Disable some post-processing effects
- Reduce effect intensity values
- Use lighter VRM model

## 📝 Next Enhancements

### Planned Features:
1. ✅ VRM blend shapes and bone rotations
2. ✅ Cyberpunk post-processing effects
3. ✅ WebSocket real-time integration
4. ✅ Mood-based animation system
5. ⏳ Audio-driven lip sync (TTS integration)
6. ⏳ Hand gesture animations
7. ⏳ Background environment (Wired aesthetic)
8. ⏳ Particle effects for cryptic mood
9. ⏳ Camera movements and transitions
10. ⏳ Multiple character support

### Audio Lip Sync (Coming Soon):

```javascript
// In AppAI.jsx, when receiving TTS audio:
const audioData = await fetch('/api/tts/synthesize', {
  method: 'POST',
  body: JSON.stringify({ text: message })
});

const audioBuffer = await audioData.arrayBuffer();
const audioContext = new AudioContext();
const buffer = await audioContext.decodeAudioData(audioBuffer);

// Analyze amplitude for lip sync
const analyzer = audioContext.createAnalyser();
const dataArray = new Uint8Array(analyzer.frequencyBinCount);
analyzer.getByteTimeDomainData(dataArray);

// Send to animation API
updateAnimation('speaking', mood, dataArray);
```

## 🎉 Success Criteria

Your implementation is working when:
- ✅ VRM model loads and displays in browser
- ✅ Expressions change when switching moods
- ✅ Head/body movement visible
- ✅ Cyberpunk effects active (glitch, bloom, scanlines)
- ✅ WebSocket connects and shows status
- ✅ Chat messages appear and trigger animation
- ✅ Mood detection works from message content
- ✅ Smooth transitions between states
- ✅ 60 FPS performance maintained

## 📚 Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [@pixiv/three-vrm Docs](https://github.com/pixiv/three-vrm)
- [VRM Specification](https://vrm.dev/en/)
- [VRoid Studio](https://vroid.com/en/studio)
- [Akash Network](https://akash.network/)
- [Internet Computer](https://internetcomputer.org/)

---

**Built with 💚 for the Wired**
