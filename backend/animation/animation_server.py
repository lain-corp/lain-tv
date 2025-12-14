from fastapi import FastAPI
from pydantic import BaseModel
import redis
import os
import random
import math

app = FastAPI()

# Redis connection
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'redis'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    decode_responses=True
)

# VRM Blend Shape mappings (ARKit/VRM standard blend shapes)
# Values range from 0.0 to 1.0
VRM_BLEND_SHAPES = {
    "neutral": {
        "idle": {
            "happy": 0.0,
            "angry": 0.0,
            "sad": 0.0,
            "relaxed": 0.3,
            "surprised": 0.0,
            "aa": 0.0,  # mouth open
            "ih": 0.0,  # mouth smile
            "oh": 0.0,  # mouth O shape
            "blink": 0.0,
            "blinkLeft": 0.0,
            "blinkRight": 0.0,
            "lookUp": 0.0,
            "lookDown": 0.0,
            "lookLeft": 0.0,
            "lookRight": 0.0
        },
        "speaking": {
            "happy": 0.1,
            "angry": 0.0,
            "sad": 0.0,
            "relaxed": 0.2,
            "surprised": 0.0,
            "aa": 0.3,  # mouth movement
            "ih": 0.2,
            "oh": 0.15,
            "blink": 0.0,
            "blinkLeft": 0.0,
            "blinkRight": 0.0,
            "lookUp": 0.0,
            "lookDown": 0.0,
            "lookLeft": 0.0,
            "lookRight": 0.0
        }
    },
    "happy": {
        "idle": {
            "happy": 0.8,
            "angry": 0.0,
            "sad": 0.0,
            "relaxed": 0.5,
            "surprised": 0.1,
            "aa": 0.0,
            "ih": 0.6,  # smile
            "oh": 0.0,
            "blink": 0.0,
            "blinkLeft": 0.0,
            "blinkRight": 0.0,
            "lookUp": 0.1,
            "lookDown": 0.0,
            "lookLeft": 0.0,
            "lookRight": 0.0
        },
        "speaking": {
            "happy": 0.9,
            "angry": 0.0,
            "sad": 0.0,
            "relaxed": 0.4,
            "surprised": 0.2,
            "aa": 0.4,
            "ih": 0.7,
            "oh": 0.2,
            "blink": 0.0,
            "blinkLeft": 0.0,
            "blinkRight": 0.0,
            "lookUp": 0.15,
            "lookDown": 0.0,
            "lookLeft": 0.0,
            "lookRight": 0.0
        }
    },
    "curious": {
        "idle": {
            "happy": 0.2,
            "angry": 0.0,
            "sad": 0.0,
            "relaxed": 0.3,
            "surprised": 0.4,
            "aa": 0.1,
            "ih": 0.2,
            "oh": 0.15,
            "blink": 0.0,
            "blinkLeft": 0.0,
            "blinkRight": 0.0,
            "lookUp": 0.3,
            "lookDown": 0.0,
            "lookLeft": 0.2,
            "lookRight": 0.2
        },
        "speaking": {
            "happy": 0.3,
            "angry": 0.0,
            "sad": 0.0,
            "relaxed": 0.2,
            "surprised": 0.5,
            "aa": 0.35,
            "ih": 0.3,
            "oh": 0.25,
            "blink": 0.0,
            "blinkLeft": 0.0,
            "blinkRight": 0.0,
            "lookUp": 0.25,
            "lookDown": 0.0,
            "lookLeft": 0.15,
            "lookRight": 0.15
        }
    },
    "cryptic": {
        "idle": {
            "happy": 0.0,
            "angry": 0.2,
            "sad": 0.3,
            "relaxed": 0.1,
            "surprised": 0.0,
            "aa": 0.0,
            "ih": 0.0,
            "oh": 0.0,
            "blink": 0.3,  # half-closed eyes
            "blinkLeft": 0.0,
            "blinkRight": 0.0,
            "lookUp": 0.0,
            "lookDown": 0.2,
            "lookLeft": 0.0,
            "lookRight": 0.0
        },
        "speaking": {
            "happy": 0.0,
            "angry": 0.25,
            "sad": 0.35,
            "relaxed": 0.0,
            "surprised": 0.0,
            "aa": 0.2,
            "ih": 0.0,
            "oh": 0.15,
            "blink": 0.2,
            "blinkLeft": 0.0,
            "blinkRight": 0.0,
            "lookUp": 0.0,
            "lookDown": 0.25,
            "lookLeft": 0.0,
            "lookRight": 0.0
        }
    },
    "playful": {
        "idle": {
            "happy": 0.7,
            "angry": 0.0,
            "sad": 0.0,
            "relaxed": 0.6,
            "surprised": 0.2,
            "aa": 0.0,
            "ih": 0.5,
            "oh": 0.0,
            "blink": 0.0,
            "blinkLeft": 0.0,
            "blinkRight": 0.5,  # wink
            "lookUp": 0.0,
            "lookDown": 0.0,
            "lookLeft": 0.3,
            "lookRight": 0.3
        },
        "speaking": {
            "happy": 0.85,
            "angry": 0.0,
            "sad": 0.0,
            "relaxed": 0.5,
            "surprised": 0.3,
            "aa": 0.4,
            "ih": 0.6,
            "oh": 0.25,
            "blink": 0.0,
            "blinkLeft": 0.0,
            "blinkRight": 0.0,
            "lookUp": 0.1,
            "lookDown": 0.0,
            "lookLeft": 0.2,
            "lookRight": 0.2
        }
    }
}

# Bone rotation values (in radians) for head/body movement
# Format: [x, y, z] euler angles
BONE_ROTATIONS = {
    "neutral": {
        "idle": {
            "head": [0.0, 0.0, 0.05],  # slight tilt
            "neck": [0.0, 0.0, 0.0],
            "spine": [0.0, 0.0, 0.0],
            "leftShoulder": [0.0, 0.0, 0.0],
            "rightShoulder": [0.0, 0.0, 0.0]
        },
        "speaking": {
            "head": [0.0, 0.0, 0.0],
            "neck": [0.05, 0.0, 0.0],  # slight nod
            "spine": [0.0, 0.0, 0.0],
            "leftShoulder": [0.0, 0.0, 0.0],
            "rightShoulder": [0.0, 0.0, 0.0]
        }
    },
    "happy": {
        "idle": {
            "head": [0.1, 0.0, 0.0],  # head up
            "neck": [0.0, 0.0, 0.0],
            "spine": [0.0, 0.0, 0.0],
            "leftShoulder": [0.0, 0.0, -0.1],
            "rightShoulder": [0.0, 0.0, 0.1]
        },
        "speaking": {
            "head": [0.05, 0.0, 0.05],
            "neck": [0.05, 0.0, 0.0],
            "spine": [0.0, 0.0, 0.0],
            "leftShoulder": [0.0, 0.0, -0.1],
            "rightShoulder": [0.0, 0.0, 0.1]
        }
    },
    "curious": {
        "idle": {
            "head": [0.0, 0.0, 0.3],  # head tilt
            "neck": [0.0, 0.0, 0.1],
            "spine": [0.0, 0.0, 0.0],
            "leftShoulder": [0.0, 0.0, 0.0],
            "rightShoulder": [0.0, 0.0, 0.0]
        },
        "speaking": {
            "head": [0.0, 0.1, 0.25],  # tilted and turned
            "neck": [0.0, 0.0, 0.1],
            "spine": [0.0, 0.0, 0.0],
            "leftShoulder": [0.0, 0.0, 0.0],
            "rightShoulder": [0.0, 0.0, 0.0]
        }
    },
    "cryptic": {
        "idle": {
            "head": [-0.1, 0.0, 0.0],  # head down, mysterious
            "neck": [0.0, 0.0, 0.0],
            "spine": [0.0, 0.0, 0.0],
            "leftShoulder": [0.0, 0.0, 0.0],
            "rightShoulder": [0.0, 0.0, 0.0]
        },
        "speaking": {
            "head": [-0.15, 0.0, 0.0],
            "neck": [0.0, 0.0, 0.0],
            "spine": [0.0, 0.0, 0.0],
            "leftShoulder": [0.0, 0.0, 0.0],
            "rightShoulder": [0.0, 0.0, 0.0]
        }
    },
    "playful": {
        "idle": {
            "head": [0.0, 0.15, 0.2],  # playful angle
            "neck": [0.0, 0.0, 0.1],
            "spine": [0.0, 0.05, 0.0],
            "leftShoulder": [0.0, 0.0, -0.15],
            "rightShoulder": [0.0, 0.0, 0.15]
        },
        "speaking": {
            "head": [0.05, 0.1, 0.15],
            "neck": [0.0, 0.0, 0.1],
            "spine": [0.0, 0.05, 0.0],
            "leftShoulder": [0.0, 0.0, -0.15],
            "rightShoulder": [0.0, 0.0, 0.15]
        }
    }
}

# Visual effects for cyberpunk aesthetic
EFFECTS = {
    "neutral": {
        "glitch": 0.0,
        "bloom": 0.3,
        "scanlines": 0.2,
        "chromatic": 0.0,
        "pixelation": 0.0
    },
    "happy": {
        "glitch": 0.0,
        "bloom": 0.5,
        "scanlines": 0.15,
        "chromatic": 0.0,
        "pixelation": 0.0
    },
    "curious": {
        "glitch": 0.1,
        "bloom": 0.35,
        "scanlines": 0.25,
        "chromatic": 0.1,
        "pixelation": 0.0
    },
    "cryptic": {
        "glitch": 0.6,
        "bloom": 0.4,
        "scanlines": 0.4,
        "chromatic": 0.3,
        "pixelation": 0.2
    },
    "playful": {
        "glitch": 0.2,
        "bloom": 0.45,
        "scanlines": 0.2,
        "chromatic": 0.15,
        "pixelation": 0.0
    }
}

class AnimationRequest(BaseModel):
    mood: str = "neutral"
    state: str = "idle"  # idle or speaking
    audioData: list = None  # Optional: audio amplitude data for lip sync

def add_variation(value, variation=0.1):
    """Add slight random variation to values for natural movement"""
    return value + random.uniform(-variation, variation)

def calculate_blink():
    """Random blink animation"""
    # Blink every 3-5 seconds on average
    if random.random() < 0.05:  # 5% chance per frame
        return random.uniform(0.8, 1.0)
    return 0.0

def calculate_lip_sync(audio_data):
    """Calculate mouth blend shapes from audio amplitude data"""
    if not audio_data or len(audio_data) == 0:
        return {"aa": 0.0, "ih": 0.0, "oh": 0.0}
    
    # Use audio amplitude to drive mouth shapes
    amplitude = sum(audio_data) / len(audio_data)
    
    # Map amplitude to different mouth shapes with some variation
    aa = min(1.0, amplitude * 1.2)  # Mouth open
    ih = min(1.0, amplitude * 0.8)  # Smile component
    oh = min(1.0, amplitude * 0.6)  # O shape
    
    return {"aa": aa, "ih": ih, "oh": oh}

@app.get("/health")
async def health():
    return {"status": "ok", "moods": list(VRM_BLEND_SHAPES.keys())}

@app.post("/get_animation")
async def get_animation(request: AnimationRequest):
    mood = request.mood.lower()
    state = request.state.lower()
    
    # Default to neutral if mood not found
    if mood not in VRM_BLEND_SHAPES:
        mood = "neutral"
    
    # Default to idle if state not found
    if state not in ["idle", "speaking"]:
        state = "idle"
    
    # Get base blend shapes for this mood/state
    blend_shapes = VRM_BLEND_SHAPES[mood][state].copy()
    
    # Get bone rotations
    bone_rotations = BONE_ROTATIONS[mood][state].copy()
    
    # Get effects
    effects = EFFECTS[mood].copy()
    
    # Add natural variations
    for key in blend_shapes:
        if key not in ["blink", "blinkLeft", "blinkRight"]:
            blend_shapes[key] = max(0.0, min(1.0, add_variation(blend_shapes[key], 0.05)))
    
    # Add random blinking
    blink_value = calculate_blink()
    blend_shapes["blink"] = blink_value
    
    # If audio data provided and speaking, use it for lip sync
    if state == "speaking" and request.audioData:
        lip_sync = calculate_lip_sync(request.audioData)
        blend_shapes["aa"] = lip_sync["aa"]
        blend_shapes["ih"] = lip_sync["ih"]
        blend_shapes["oh"] = lip_sync["oh"]
    
    # Add subtle head movement variation for idle
    if state == "idle":
        bone_rotations["head"] = [
            add_variation(bone_rotations["head"][0], 0.05),
            add_variation(bone_rotations["head"][1], 0.05),
            add_variation(bone_rotations["head"][2], 0.05)
        ]
    
    # Cache current animation in Redis
    import json
    animation_data = {
        "blend_shapes": blend_shapes,
        "bone_rotations": bone_rotations,
        "effects": effects,
        "mood": mood,
        "state": state
    }
    redis_client.setex("current_animation", 60, json.dumps(animation_data))
    redis_client.setex("current_mood", 60, mood)
    
    return {
        "vrm_data": {
            "blend_shapes": blend_shapes,
            "bone_rotations": bone_rotations,
            "effects": effects
        },
        "mood": mood,
        "state": state,
        "duration": 2.0,  # seconds
        "loop": state == "idle"
    }

@app.get("/current")
async def current_animation():
    import json
    animation_str = redis_client.get("current_animation")
    mood = redis_client.get("current_mood") or "neutral"
    
    if animation_str:
        animation_data = json.loads(animation_str)
        return animation_data
    
    # Return default if nothing cached
    return {
        "blend_shapes": VRM_BLEND_SHAPES["neutral"]["idle"],
        "bone_rotations": BONE_ROTATIONS["neutral"]["idle"],
        "effects": EFFECTS["neutral"],
        "mood": "neutral",
        "state": "idle"
    }

@app.get("/moods")
async def get_moods():
    return {
        "moods": list(VRM_BLEND_SHAPES.keys()),
        "states": ["idle", "speaking"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
