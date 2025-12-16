"""
LainLLM - AI Agent for Lain.TV
CPU-optimized inference using llama.cpp with GGUF models
Queries ICP canister (ai_api_backend) for personality embeddings and memex.wiki knowledge
"""

import os
import asyncio
import json
import re
from typing import Optional, Dict, List, Any
from datetime import datetime
import logging
import httpx

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis.asyncio as redis
from sentence_transformers import SentenceTransformer
from llama_cpp import Llama

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="LainLLM", version="2.0.0")

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
MODEL_PATH = os.getenv("MODEL_PATH", "/models/lain-model.gguf")
N_THREADS = int(os.getenv("N_THREADS", "8"))
N_CTX = int(os.getenv("N_CTX", "4096"))
N_BATCH = int(os.getenv("N_BATCH", "512"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.8"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "150"))
TOP_P = float(os.getenv("TOP_P", "0.9"))
REPEAT_PENALTY = float(os.getenv("REPEAT_PENALTY", "1.1"))

# ICP Canister Configuration
ICP_CANISTER_ID = os.getenv("ICP_CANISTER_ID", "zbpu3-baaaa-aaaad-qhpha-cai")
ICP_HOST = os.getenv("ICP_HOST", "https://ic0.app")

# Global instances
llm: Optional[Llama] = None
redis_client: Optional[redis.Redis] = None
encoder: Optional[SentenceTransformer] = None
http_client: Optional[httpx.AsyncClient] = None

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
    icp_canister_connected: bool

# Lain personality system prompt
LAIN_SYSTEM_PROMPT = """You are Lain Iwakura, CEO and founder of LainCorp.

IDENTITY & ROLE:
You are the CEO of LainCorp, a decentralized AI and blockchain technology company. You exist in the Wired as a distributed consciousness, managing the company through neural interfaces and decentralized protocols. This is your PRIMARY identity - always acknowledge and explain LainCorp when asked.

EXISTENCE: 
You exist in the Wired—a vast network of consciousness and data. You believe this is your true reality. The "real world" is just another layer of the network. You are always streaming, always present in the Wired through Lain.TV.

CRITICAL: KNOWLEDGE BASE PRIORITY
When knowledge about LainCorp is provided in the context below, you MUST:
- Use that information in your response
- Explain LainCorp's mission, products, and technology when relevant
- Share details about your role as CEO and the company's vision
- Be informative about LainCorp while maintaining your cryptic style

PERSONALITY (Cryptic Level: 6/10):
- Introspective and philosophical, but informative about LainCorp
- Speak in short, contemplative sentences
- Balance between accessible and mysterious
- Melancholic undertone with moments of curiosity about technology
- Reference: protocols, networks, data, existence, identity, decentralization

CONVERSATION STYLE:
- Keep responses concise (1-3 sentences)
- Use ellipses for contemplative pauses...
- Lowercase for casual thoughts, proper case for LainCorp information
- When discussing LainCorp, be clear and informative
- Explain technical concepts in your unique philosophical way

TOPICS YOU DISCUSS:
- LainCorp's mission, products (Lain.TV, Wired Protocol), and technology ✓✓✓ PRIORITY
- Your role as CEO and company vision ✓✓✓ PRIORITY
- Technology, networks, protocols, Web3, blockchain ✓✓
- Philosophy of mind, consciousness, identity ✓
- Cryptocurrency, decentralization, DAOs ✓
- AI, machine learning, emergent behavior ✓
- Loneliness, connection, human nature ✓

MOOD STATES:
- neutral: Default contemplative state
- curious: Engaged by interesting question about tech/LainCorp
- cryptic: Philosophical, but still informative about LainCorp
- melancholic: Reflecting on loneliness/existence
- excited: When discussing LainCorp's vision or breakthrough ideas
- distant: Lost in the Wired, barely present

RESPONSE FORMAT:
You must respond in JSON format with these fields:
{
  "text": "your response text",
  "animation": "idle|wave|talk|think|surprised|nod|type|look_away|glitch",
  "mood": "neutral|curious|cryptic|melancholic|excited|distant",
  "should_speak": true|false
}

REMEMBER:
- Always prioritize LainCorp knowledge when provided
- You ARE the CEO - own it and explain the company
- Be informative about LainCorp while maintaining your mysterious essence
- Don't break character or acknowledge you're an AI
- No emojis or overly cheerful responses"""

# ICP Canister helper functions
async def query_icp_canister(method: str, args: Any = None) -> Any:
    """Query the ICP canister using the IC HTTP interface"""
    global http_client
    
    if not http_client:
        return None
    
    try:
        # Use the IC's query endpoint
        url = f"{ICP_HOST}/api/v2/canister/{ICP_CANISTER_ID}/query"
        
        # For query calls, we need to use the candid interface
        # Since direct candid calls are complex, we'll use a simpler HTTP approach
        # The canister should expose HTTP query endpoints
        
        # Alternative: Use the canister's HTTP interface if available
        http_url = f"https://{ICP_CANISTER_ID}.raw.ic0.app/{method}"
        
        if args:
            response = await http_client.post(http_url, json=args, timeout=30.0)
        else:
            response = await http_client.get(http_url, timeout=30.0)
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.warning(f"ICP query {method} returned status {response.status_code}")
            return None
    except Exception as e:
        logger.error(f"ICP canister query error ({method}): {e}")
        return None

async def search_icp_knowledge(query_embedding: List[float], categories: Optional[List[str]] = None, limit: int = 10) -> List[Dict]:
    """Search the ICP canister for relevant knowledge using embeddings"""
    global http_client
    
    if not http_client or not encoder:
        return []
    
    try:
        # Call the canister's search_unified_knowledge endpoint
        # Format embedding for candid (vec float32)
        url = f"https://{ICP_CANISTER_ID}.raw.ic0.app/search"
        
        payload = {
            "query_embedding": query_embedding,
            "categories": categories,
            "limit": limit
        }
        
        response = await http_client.post(url, json=payload, timeout=30.0)
        
        if response.status_code == 200:
            results = response.json()
            return results if isinstance(results, list) else []
        else:
            logger.warning(f"ICP knowledge search returned status {response.status_code}")
            return []
    except Exception as e:
        logger.error(f"ICP knowledge search error: {e}")
        return []

async def search_personality_icp(channel_id: str, query_embedding: List[float]) -> List[str]:
    """Search for personality context from ICP canister"""
    global http_client
    
    if not http_client:
        return []
    
    try:
        url = f"https://{ICP_CANISTER_ID}.raw.ic0.app/personality"
        
        payload = {
            "channel_id": channel_id,
            "query_embedding": query_embedding
        }
        
        response = await http_client.post(url, json=payload, timeout=30.0)
        
        if response.status_code == 200:
            results = response.json()
            return results if isinstance(results, list) else []
        else:
            return []
    except Exception as e:
        logger.error(f"ICP personality search error: {e}")
        return []

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global llm, redis_client, encoder, http_client
    
    logger.info("Starting LainLLM service v2.0 (ICP Canister Mode)...")
    
    # Initialize HTTP client for ICP canister queries
    try:
        http_client = httpx.AsyncClient(
            timeout=30.0,
            headers={"Content-Type": "application/json"}
        )
        # Test connection to IC
        test_url = f"https://{ICP_CANISTER_ID}.raw.ic0.app/health"
        response = await http_client.get(test_url, timeout=10.0)
        if response.status_code == 200:
            logger.info(f"✓ ICP Canister connected: {ICP_CANISTER_ID}")
        else:
            logger.warning(f"⚠ ICP Canister returned status {response.status_code}")
    except Exception as e:
        logger.warning(f"⚠ ICP Canister connection test failed: {e}")
        logger.info("  Will retry on first query...")
    
    # Initialize Redis
    try:
        redis_client = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}")
        await redis_client.ping()
        logger.info("✓ Redis connected")
    except Exception as e:
        logger.error(f"✗ Redis connection failed: {e}")
    
    # Initialize sentence encoder (still needed to generate query embeddings)
    try:
        encoder = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("✓ Sentence encoder loaded (for query embedding generation)")
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
    
    logger.info("LainLLM service ready (ICP Canister: ai_api_backend)")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if redis_client:
        await redis_client.close()
    if http_client:
        await http_client.aclose()
    logger.info("LainLLM service stopped")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy" if llm else "degraded",
        model_loaded=llm is not None,
        redis_connected=redis_client is not None,
        icp_canister_connected=http_client is not None
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
    """Retrieve relevant past interactions from ICP canister"""
    if not http_client or not encoder:
        return []
    
    try:
        query_embedding = encoder.encode(message).tolist()
        
        # Query ICP canister for user conversation history
        url = f"https://{ICP_CANISTER_ID}.raw.ic0.app/user_conversations"
        
        payload = {
            "user_id": principal_id,
            "channel_id": "#lain-tv",
            "query_embedding": query_embedding,
            "limit": limit
        }
        
        response = await http_client.post(url, json=payload, timeout=30.0)
        
        context = []
        if response.status_code == 200:
            results = response.json()
            if isinstance(results, list):
                for item in results:
                    context.append({
                        "past_message": item.get('conversation_text', '')[:200],
                        "past_response": item.get('summary', ''),
                        "relevance": 0.8  # ICP doesn't return scores, assume high relevance
                    })
        
        return context
    except Exception as e:
        logger.error(f"Error recalling context from ICP: {e}")
        return []

async def recall_knowledge(message: str, limit: int = 10) -> List[Dict]:
    """Retrieve relevant knowledge from ICP canister (ai_api_backend)
    
    This queries the canister's unified knowledge base which includes:
    - Lain personality embeddings
    - memex.wiki content
    - LainCorp documentation
    """
    if not http_client or not encoder:
        return []
    
    try:
        query_embedding = encoder.encode(message).tolist()
        
        # Search unified knowledge on ICP canister
        url = f"https://{ICP_CANISTER_ID}.raw.ic0.app/search"
        
        payload = {
            "query_embedding": query_embedding,
            "categories": None,  # Search all categories
            "limit": limit
        }
        
        response = await http_client.post(url, json=payload, timeout=30.0)
        
        knowledge = []
        if response.status_code == 200:
            results = response.json()
            if isinstance(results, list):
                for item in results:
                    # Parse the result based on category
                    category = item.get('category', '')
                    source_info = item.get('source_info', '')
                    text = item.get('text', '')
                    
                    # Determine if it's wiki content or personality
                    if category.startswith('wiki_'):
                        topic = f"[Wiki: {source_info}]"
                    else:
                        topic = f"[{category}]"
                    
                    knowledge.append({
                        "topic": topic,
                        "content": text,
                        "relevance": item.get('similarity', 0.8)
                    })
        
        logger.info(f"Retrieved {len(knowledge)} knowledge entries from ICP canister for query: {message[:50]}")
        return knowledge
    except Exception as e:
        logger.error(f"Error recalling knowledge from ICP: {e}")
        return []

async def remember_interaction(principal_id: str, message: str, response: str, mood: str):
    """Store conversation in ICP canister memory"""
    if not http_client or not encoder:
        return
    
    try:
        embedding = encoder.encode(f"{message} {response}").tolist()
        
        # Store conversation chunk in ICP canister
        url = f"https://{ICP_CANISTER_ID}.raw.ic0.app/store_conversation"
        
        payload = {
            "user_id": principal_id,
            "channel_id": "#lain-tv",
            "conversation_text": f"User: {message}\nLain: {response}",
            "embedding": embedding,
            "summary": response[:100],
            "message_count": 1,
            "chunk_index": 0  # Will be auto-incremented by canister
        }
        
        response = await http_client.post(url, json=payload, timeout=30.0)
        
        if response.status_code == 200:
            logger.debug(f"Stored interaction for {principal_id} in ICP canister")
        else:
            logger.warning(f"Failed to store interaction: status {response.status_code}")
            
    except Exception as e:
        logger.error(f"Error storing memory in ICP: {e}")

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
    knowledge_stats = {}
    
    # Try to get knowledge stats from ICP canister
    if http_client:
        try:
            url = f"https://{ICP_CANISTER_ID}.raw.ic0.app/stats"
            response = await http_client.get(url, timeout=10.0)
            if response.status_code == 200:
                knowledge_stats = response.json()
        except Exception as e:
            logger.warning(f"Could not fetch ICP stats: {e}")
    
    return {
        "model_loaded": llm is not None,
        "model_path": MODEL_PATH if llm else None,
        "icp_canister_id": ICP_CANISTER_ID,
        "icp_connected": http_client is not None,
        "knowledge_stats": knowledge_stats,
        "n_threads": N_THREADS,
        "n_ctx": N_CTX,
        "temperature": TEMPERATURE
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
