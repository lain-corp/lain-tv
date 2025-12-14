from fastapi import FastAPI
from pydantic import BaseModel
import redis
import os
import random

app = FastAPI()

# Redis connection
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'redis'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    decode_responses=True
)

# Animation states based on Lain's moods
ANIMATIONS = {
    "neutral": {
        "idle": ["breathing", "blink", "slight_head_tilt"],
        "speaking": ["talking_neutral", "mouth_movement"]
    },
    "happy": {
        "idle": ["smile", "cheerful_blink"],
        "speaking": ["talking_happy", "excited_gestures"]
    },
    "curious": {
        "idle": ["head_tilt", "questioning_look", "eye_movement"],
        "speaking": ["talking_curious", "thinking_gesture"]
    },
    "cryptic": {
        "idle": ["mysterious_stare", "slow_blink", "glitch_effect"],
        "speaking": ["talking_cryptic", "eerie_movements", "digital_distortion"]
    },
    "playful": {
        "idle": ["playful_smile", "wink"],
        "speaking": ["talking_playful", "bouncy_movements"]
    }
}

class AnimationRequest(BaseModel):
    mood: str = "neutral"
    state: str = "idle"  # idle or speaking

@app.get("/health")
async def health():
    return {"status": "ok", "moods": list(ANIMATIONS.keys())}

@app.post("/get_animation")
async def get_animation(request: AnimationRequest):
    mood = request.mood.lower()
    state = request.state.lower()
    
    # Default to neutral if mood not found
    if mood not in ANIMATIONS:
        mood = "neutral"
    
    # Default to idle if state not found
    if state not in ["idle", "speaking"]:
        state = "idle"
    
    # Get animation options for this mood/state
    animations = ANIMATIONS[mood][state]
    
    # Pick a random animation
    animation = random.choice(animations)
    
    # Cache current animation in Redis
    redis_client.setex("current_animation", 60, animation)
    redis_client.setex("current_mood", 60, mood)
    
    return {
        "animation": animation,
        "mood": mood,
        "state": state,
        "duration": 2.0,  # seconds
        "loop": state == "idle"
    }

@app.get("/current")
async def current_animation():
    animation = redis_client.get("current_animation") or "breathing"
    mood = redis_client.get("current_mood") or "neutral"
    
    return {
        "animation": animation,
        "mood": mood
    }

@app.get("/moods")
async def get_moods():
    return {
        "moods": list(ANIMATIONS.keys()),
        "states": ["idle", "speaking"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
