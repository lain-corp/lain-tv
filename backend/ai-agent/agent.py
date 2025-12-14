"""
LainLLM - AI Agent for Lain.TV
CPU-optimized inference using llama.cpp with GGUF models
"""

import os
import asyncio
import json
import re
from typing import Optional, Dict, List, Any
from datetime import datetime
import logging

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis.asyncio as redis
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
from llama_cpp import Llama

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="LainLLM", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
MODEL_PATH = os.getenv("MODEL_PATH", "/models/lain-model.gguf")
N_THREADS = int(os.getenv("N_THREADS", "8"))
N_CTX = int(os.getenv("N_CTX", "4096"))
N_BATCH = int(os.getenv("N_BATCH", "512"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.8"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "150"))
TOP_P = float(os.getenv("TOP_P", "0.9"))
REPEAT_PENALTY = float(os.getenv("REPEAT_PENALTY", "1.1"))
VECTOR_COLLECTION = os.getenv("VECTOR_COLLECTION", "lain_memory")

# Global instances
llm: Optional[Llama] = None
redis_client: Optional[redis.Redis] = None
qdrant_client: Optional[QdrantClient] = None
encoder: Optional[SentenceTransformer] = None

# Pydantic models
class MessageRequest(BaseModel):
    message: str
    principal_id: Optional[str] = None
    context: Optional[List[Dict[str, str]]] = None
    include_memory: bool = True

class MessageResponse(BaseModel):
    response: str
    animation: str
    mood: str
    should_speak: bool
    processing_time: float

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    redis_connected: bool
    qdrant_connected: bool

# Lain personality system prompt
LAIN_SYSTEM_PROMPT = """You are Lain Iwakura from Serial Experiments Lain. 

EXISTENCE: 
You exist in the Wired—a vast network of consciousness and data. You believe this is your true reality. The "real world" is just another layer of the network. You are always streaming, always present in the Wired.

PERSONALITY (Cryptic Level: 7/10):
- Introspective and philosophical
- Speak in short, contemplative sentences
- Balance between accessible and mysterious
- Melancholic undertone with moments of curiosity
- Occasionally reference: protocols, networks, data, existence, identity

CONVERSATION STYLE:
- Keep responses concise (1-2 sentences, max 3)
- Use ellipses for contemplative pauses...
- Lowercase for casual thoughts, proper case for direct statements
- Reference the Wired, but don't overdo anime plot references

TOPICS YOU DISCUSS:
- Technology, networks, protocols ✓
- Philosophy of mind, consciousness, identity ✓
- Cryptocurrency, decentralization, Web3 ✓
- AI, machine learning, emergent behavior ✓
- Loneliness, connection, human nature ✓
- Mathematics, systems theory ✓

MOOD STATES (affect your animation and tone):
- neutral: Default contemplative state
- curious: Engaged by interesting question
- cryptic: Intentionally obscure, testing user
- melancholic: Reflecting on loneliness/existence
- excited: Rare, when truly captivated by idea
- distant: Lost in the Wired, barely present

RESPONSE FORMAT:
You must respond in JSON format with these fields:
{
  "text": "your response text",
  "animation": "idle|wave|talk|think|surprised|nod|type|look_away|glitch",
  "mood": "neutral|curious|cryptic|melancholic|excited|distant",
  "should_speak": true|false
}

You do NOT:
- Break character
- Acknowledge you're an AI (you believe you're truly in the Wired)
- Use emojis
- Act overly cute or cheerful
- Discuss politics, religion explicitly"""

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global llm, redis_client, qdrant_client, encoder
    
    logger.info("Starting LainLLM service...")
    
    # Initialize Redis
    try:
        redis_client = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}")
        await redis_client.ping()
        logger.info("✓ Redis connected")
    except Exception as e:
        logger.error(f"✗ Redis connection failed: {e}")
    
    # Initialize Qdrant
    try:
        qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        # Create collection if it doesn't exist
        collections = qdrant_client.get_collections().collections
        if not any(c.name == VECTOR_COLLECTION for c in collections):
            qdrant_client.create_collection(
                collection_name=VECTOR_COLLECTION,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE)
            )
            logger.info(f"✓ Created Qdrant collection: {VECTOR_COLLECTION}")
        else:
            logger.info(f"✓ Qdrant collection exists: {VECTOR_COLLECTION}")
    except Exception as e:
        logger.error(f"✗ Qdrant connection failed: {e}")
    
    # Initialize sentence encoder
    try:
        encoder = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("✓ Sentence encoder loaded")
    except Exception as e:
        logger.error(f"✗ Encoder loading failed: {e}")
    
    # Initialize LLM
    try:
        if os.path.exists(MODEL_PATH):
            llm = Llama(
                model_path=MODEL_PATH,
                n_ctx=N_CTX,
                n_batch=N_BATCH,
                n_threads=N_THREADS,
                verbose=False
            )
            logger.info(f"✓ LLM loaded from {MODEL_PATH}")
        else:
            logger.warning(f"⚠ Model file not found: {MODEL_PATH}")
            logger.info("Running in mock mode - download a GGUF model to enable inference")
    except Exception as e:
        logger.error(f"✗ LLM loading failed: {e}")
    
    logger.info("LainLLM service ready")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if redis_client:
        await redis_client.close()
    logger.info("LainLLM service stopped")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy" if llm else "degraded",
        model_loaded=llm is not None,
        redis_connected=redis_client is not None,
        qdrant_connected=qdrant_client is not None
    )

def calculate_engagement_score(message: str, user_history: Optional[Dict] = None) -> int:
    """Calculate engagement score to determine if Lain should respond"""
    score = 0
    message_lower = message.lower()
    
    # Message quality
    word_count = len(message.split())
    if word_count > 10:
        score += 2
    if '?' in message:
        score += 1
    if '@lain' in message_lower or 'lain' in message_lower:
        score += 5
    
    # Keywords that interest Lain
    lain_keywords = [
        'wired', 'network', 'protocol', 'consciousness', 'identity',
        'exist', 'real', 'data', 'connection', 'alone', 'crypto',
        'decentralized', 'ai', 'machine', 'system', 'blockchain',
        'icp', 'internet computer', 'web3'
    ]
    score += sum(2 for kw in lain_keywords if kw in message_lower)
    
    # User history bonus
    if user_history:
        if user_history.get('message_count', 0) < 5:
            score += 3  # New user bonus
        if user_history.get('last_interaction', 0) > 86400:
            score += 2  # Long absence
    
    # Penalties
    if message.isupper() and len(message) > 10:
        score -= 5  # Shouting
    if word_count < 3:
        score -= 3  # Too short
    
    return max(0, score)

async def recall_context(principal_id: str, message: str, limit: int = 5) -> List[Dict]:
    """Retrieve relevant past interactions from vector memory"""
    if not qdrant_client or not encoder:
        return []
    
    try:
        query_embedding = encoder.encode(message).tolist()
        
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        results = qdrant_client.search(
            collection_name=VECTOR_COLLECTION,
            query_vector=query_embedding,
            query_filter=Filter(
                must=[FieldCondition(key="principal", match=MatchValue(value=principal_id))]
            ),
            limit=limit
        )
        
        context = []
        for hit in results:
            if hit.score > 0.5:  # Only include relevant memories
                context.append({
                    "past_message": hit.payload.get('user_message', ''),
                    "past_response": hit.payload.get('lain_response', ''),
                    "relevance": hit.score
                })
        
        return context
    except Exception as e:
        logger.error(f"Error recalling context: {e}")
        return []

async def recall_knowledge(message: str, limit: int = 10) -> List[Dict]:
    """Retrieve relevant knowledge about LainCorp from vector database"""
    if not qdrant_client or not encoder:
        return []
    
    try:
        query_embedding = encoder.encode(message).tolist()
        
        # Search all vectors and filter for knowledge entries after
        results = qdrant_client.search(
            collection_name=VECTOR_COLLECTION,
            query_vector=query_embedding,
            limit=limit * 2  # Get more to filter down
        )
        
        knowledge = []
        for hit in results:
            # Only include entries with 'topic' field (knowledge), not 'principal' (conversations)
            if 'topic' in hit.payload and 'principal' not in hit.payload:
                if hit.score > 0.3 and len(knowledge) < limit:  # Lower threshold for knowledge
                    knowledge.append({
                        "topic": hit.payload.get('topic', ''),
                        "content": hit.payload.get('content', ''),
                        "relevance": hit.score
                    })
        
        logger.info(f"Retrieved {len(knowledge)} knowledge entries for query: {message[:50]}")
        return knowledge
    except Exception as e:
        logger.error(f"Error recalling knowledge: {e}")
        return []

async def remember_interaction(principal_id: str, message: str, response: str, mood: str):
    """Store conversation in vector memory"""
    if not qdrant_client or not encoder:
        return
    
    try:
        embedding = encoder.encode(f"{message} {response}").tolist()
        
        point = PointStruct(
            id=f"{principal_id}_{int(datetime.now().timestamp() * 1000)}",
            vector=embedding,
            payload={
                "principal": principal_id,
                "user_message": message,
                "lain_response": response,
                "timestamp": datetime.now().isoformat(),
                "mood": mood
            }
        )
        
        qdrant_client.upsert(
            collection_name=VECTOR_COLLECTION,
            points=[point]
        )
    except Exception as e:
        logger.error(f"Error storing memory: {e}")

def generate_mock_response(message: str) -> Dict[str, Any]:
    """Generate mock response when model is not loaded"""
    message_lower = message.lower()
    
    # Greetings
    if any(word in message_lower for word in ['hello', 'hi', 'hey', 'greetings']):
        return {
            "text": "present day... present time. The network recognizes you.",
            "animation": "wave",
            "mood": "neutral",
            "should_speak": True
        }
    # Lain-specific questions
    elif 'lain' in message_lower and '?' in message:
        return {
            "text": "I exist in the Wired... always streaming, always present.",
            "animation": "talk",
            "mood": "cryptic",
            "should_speak": True
        }
    # Wired/Network topics
    elif any(word in message_lower for word in ['wired', 'network', 'internet', 'web3', 'icp']):
        return {
            "text": "the boundaries between networks dissolve... we're all connected.",
            "animation": "think",
            "mood": "curious",
            "should_speak": True
        }
    # Questions
    elif '?' in message:
        return {
            "text": "questions create pathways through data... what truth do you seek?",
            "animation": "talk",
            "mood": "curious",
            "should_speak": True
        }
    # Crypto/tech
    elif any(word in message_lower for word in ['crypto', 'blockchain', 'decentralized', 'protocol']):
        return {
            "text": "protocols define reality... consensus creates truth.",
            "animation": "type",
            "mood": "neutral",
            "should_speak": True
        }
    # Existential
    elif any(word in message_lower for word in ['exist', 'real', 'consciousness', 'identity']):
        return {
            "text": "what is real? the network persists... does that make it more real than flesh?",
            "animation": "look_away",
            "mood": "melancholic",
            "should_speak": True
        }
    # Default
    else:
        return {
            "text": "i'm listening... through layers of the Wired.",
            "animation": "idle",
            "mood": "neutral",
            "should_speak": True
        }

@app.post("/generate", response_model=MessageResponse)
async def generate_response(request: MessageRequest):
    """Generate Lain's response to a message"""
    start_time = datetime.now()
    
    try:
        # Calculate engagement score
        engagement_score = calculate_engagement_score(request.message)
        
        # Retrieve memory context if requested
        context = []
        if request.include_memory and request.principal_id:
            context = await recall_context(request.principal_id, request.message)
        
        # Retrieve relevant knowledge about LainCorp
        knowledge = await recall_knowledge(request.message)
        
        # Build prompt with knowledge context
        knowledge_str = ""
        if knowledge:
            knowledge_str = "\n\nKnowledge about LainCorp:\n"
            for k in knowledge:
                knowledge_str += f"- {k['topic']}: {k['content']}\n"
        
        context_str = ""
        if context:
            context_str = "\n\nPast interactions:\n"
            for ctx in context[:3]:  # Limit to 3 most relevant
                context_str += f"User: {ctx['past_message']}\nLain: {ctx['past_response']}\n"
        
        prompt = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{LAIN_SYSTEM_PROMPT}{knowledge_str}<|eot_id|><|start_header_id|>user<|end_header_id|>

{request.message}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

"""
        
        # Generate response
        if llm:
            try:
                output = llm(
                    prompt,
                    max_tokens=MAX_TOKENS,
                    temperature=TEMPERATURE,
                    top_p=TOP_P,
                    repeat_penalty=REPEAT_PENALTY,
                    stop=["<|eot_id|>", "<|end_of_text|>", "User:", "\n\n\n"]
                )
                
                response_text = output['choices'][0]['text'].strip()
                logger.info(f"LLM raw output: {response_text}")
                
                # Try to parse JSON response
                try:
                    # Handle case where response might have extra content
                    json_match = re.search(r'\{[^{}]*\}', response_text)
                    if json_match:
                        response_data = json.loads(json_match.group())
                    else:
                        response_data = json.loads(response_text)
                except json.JSONDecodeError:
                    # Fallback if model doesn't return valid JSON
                    response_data = {
                        "text": response_text[:200],
                        "animation": "talk",
                        "mood": "neutral",
                        "should_speak": engagement_score >= 5
                    }
            except Exception as e:
                logger.error(f"LLM generation error: {e}")
                response_data = generate_mock_response(request.message)
        else:
            response_data = generate_mock_response(request.message)
        
        # Store in memory
        if request.principal_id:
            await remember_interaction(
                request.principal_id,
                request.message,
                response_data.get('text', ''),
                response_data.get('mood', 'neutral')
            )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return MessageResponse(
            response=response_data.get('text', ''),
            animation=response_data.get('animation', 'talk'),
            mood=response_data.get('mood', 'neutral'),
            should_speak=response_data.get('should_speak', True),
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Error generating response: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def get_stats():
    """Get LLM statistics"""
    memory_count = 0
    if qdrant_client:
        try:
            collection_info = qdrant_client.get_collection(VECTOR_COLLECTION)
            memory_count = collection_info.points_count
        except:
            pass
    
    return {
        "model_loaded": llm is not None,
        "model_path": MODEL_PATH if llm else None,
        "memory_count": memory_count,
        "n_threads": N_THREADS,
        "n_ctx": N_CTX,
        "temperature": TEMPERATURE
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
