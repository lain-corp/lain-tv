from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import redis
import os
import base64
from TTS.api import TTS
import soundfile as sf
import io
import numpy as np

app = FastAPI()

# Redis connection
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'redis'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    decode_responses=False
)

# Initialize TTS model (using lightweight VITS model)
# You can change this to a Lain-specific voice model if available
tts = TTS(model_name="tts_models/en/vctk/vits", progress_bar=False)

class TTSRequest(BaseModel):
    text: str
    speaker: str = "p225"  # Female speaker
    speed: float = 1.0

@app.get("/health")
async def health():
    return {"status": "ok", "model": "vits"}

@app.post("/synthesize")
async def synthesize(request: TTSRequest):
    try:
        # Generate speech
        wav = tts.tts(text=request.text, speaker=request.speaker)
        
        # Convert to audio bytes
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, wav, samplerate=22050, format='WAV')
        audio_bytes = audio_buffer.getvalue()
        
        # Encode to base64 for transport
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        # Cache in Redis (expire after 1 hour)
        cache_key = f"tts:{hash(request.text + request.speaker)}"
        redis_client.setex(cache_key, 3600, audio_bytes)
        
        return {
            "success": True,
            "audio": audio_base64,
            "format": "wav",
            "sample_rate": 22050
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def stats():
    return {
        "model": "vits",
        "speakers_available": len(tts.speakers) if hasattr(tts, 'speakers') else 0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
