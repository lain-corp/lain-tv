"""
LainLLM - AI Agent for Lain.TV
CPU-optimized inference using llama.cpp with GGUF models
Queries ICP canister (ai_api_backend) for personality embeddings and memex.wiki knowledge
Uses ic-py SDK for proper candid RPC calls
"""

import os
import asyncio
import json
import re
import struct
from typing import Optional, Dict, List, Any
from datetime import datetime
import logging

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis.asyncio as redis
from sentence_transformers import SentenceTransformer
from llama_cpp import Llama

# IC Python SDK imports
from ic.client import Client
from ic.identity import Identity
from ic.agent import Agent
from ic.candid import encode, decode, Types

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
ic_agent: Optional[Agent] = None
ic_canister_id: str = ""

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

# ICP Canister helper functions using ic-py SDK
def call_canister_query(method: str, params: List[Dict]) -> Any:
    """Make a query call to the ICP canister using candid encoding
    
    params should be a list of {'type': Types.X, 'value': value} dicts
    """
    global ic_agent, ic_canister_id
    
    if not ic_agent:
        logger.warning("IC Agent not initialized")
        return None
    
    try:
        # Encode arguments using candid (ic-py format)
        encoded_args = encode(params)
        
        # Make query call
        result = ic_agent.query_raw(
            ic_canister_id,
            method,
            encoded_args
        )
        
        return result
    except Exception as e:
        logger.error(f"IC canister query error ({method}): {e}")
        return None

def call_canister_update(method: str, params: List[Dict]) -> Any:
    """Make an update call to the ICP canister using candid encoding"""
    global ic_agent, ic_canister_id
    
    if not ic_agent:
        logger.warning("IC Agent not initialized")
        return None
    
    try:
        # Encode arguments using candid
        encoded_args = encode(params)
        
        # Make update call
        result = ic_agent.update_raw(
            ic_canister_id,
            method,
            encoded_args
        )
        
        return result
    except Exception as e:
        logger.error(f"IC canister update error ({method}): {e}")
        return None

async def search_icp_knowledge(query_embedding: List[float], categories: Optional[List[str]] = None, limit: int = 10) -> List[Dict]:
    """Search the ICP canister for relevant knowledge using embeddings
    
    Uses the search_personality candid method which searches personality embeddings
    """
    global ic_agent, encoder
    
    if not ic_agent or not encoder:
        return []
    
    try:
        # The canister method: search_personality(channel_id: text, embedding: vec float32) -> vec text
        channel_id = "#wiki"  # Default channel - changed from #lain-tv which doesn't exist
        
        # Convert embedding to the format expected by candid (vec float32)
        embedding_vec = [float(x) for x in query_embedding]
        
        # ic-py format: list of {type, value} dicts
        params = [
            {'type': Types.Text, 'value': channel_id},
            {'type': Types.Vec(Types.Float32), 'value': embedding_vec}
        ]
        
        # Encode and call
        encoded_args = encode(params)
        
        # Make query call - ic-py returns already decoded result
        result = ic_agent.query_raw(
            ic_canister_id,
            "search_personality",
            encoded_args
        )
        
        if result and isinstance(result, list) and len(result) > 0:
            # ic-py returns already decoded: [{'type': 'rec_0', 'value': [...strings...]}]
            texts = result[0].get('value', [])
            if isinstance(texts, list):
                logger.info(f"ICP search_personality returned {len(texts)} results")
                return [{"topic": "[Personality]", "content": text, "relevance": 0.9} for text in texts if isinstance(text, str)]
        
        return []
    except Exception as e:
        logger.error(f"ICP knowledge search error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []

async def search_personality_icp(channel_id: str, query_embedding: List[float]) -> List[str]:
    """Search for personality context from ICP canister"""
    global ic_agent
    
    if not ic_agent:
        return []
    
    try:
        embedding_vec = [float(x) for x in query_embedding]
        
        params = [
            {'type': Types.Text, 'value': channel_id},
            {'type': Types.Vec(Types.Float32), 'value': embedding_vec}
        ]
        
        encoded_args = encode(params)
        
        # ic-py returns already decoded result
        result = ic_agent.query_raw(
            ic_canister_id,
            "search_personality",
            encoded_args
        )
        
        if result and isinstance(result, list) and len(result) > 0:
            # ic-py returns already decoded: [{'type': 'rec_0', 'value': [...strings...]}]
            texts = result[0].get('value', [])
            return texts if isinstance(texts, list) else []
        return []
    except Exception as e:
        logger.error(f"ICP personality search error: {e}")
        return []

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global llm, redis_client, encoder, ic_agent, ic_canister_id
    
    logger.info("Starting LainLLM service v2.1 (ICP Canister Mode with ic-py)...")
    
    # Initialize IC Agent for canister queries
    try:
        ic_canister_id = ICP_CANISTER_ID
        
        # Create anonymous identity for query calls
        identity = Identity()
        
        # Create IC client pointing to mainnet
        client = Client(url=ICP_HOST)
        
        # Create agent
        ic_agent = Agent(identity, client)
        
        # Test connection by getting personality embeddings count
        try:
            # ic-py uses empty list for no args
            encoded_args = encode([])
            result = ic_agent.query_raw(
                ic_canister_id,
                "get_personality_embeddings",
                encoded_args
            )
            if result and isinstance(result, list) and len(result) > 0:
                # ic-py returns already decoded: [{'type': ..., 'value': [...]}]
                count = len(result[0].get('value', []))
                logger.info(f"✓ ICP Canister connected: {ic_canister_id}")
                logger.info(f"  Personality embeddings available: {count}")
            else:
                logger.warning(f"⚠ ICP Canister query returned empty result")
        except Exception as e:
            logger.warning(f"⚠ ICP Canister test query failed: {e}")
            logger.info("  Will retry on first knowledge query...")
            
    except Exception as e:
        logger.error(f"✗ IC Agent initialization failed: {e}")
        ic_agent = None
    
    # Initialize Redis
    try:
        redis_client = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}")
        await redis_client.ping()
        logger.info("✓ Redis connected")
    except Exception as e:
        logger.error(f"✗ Redis connection failed: {e}")
    
    # Initialize sentence encoder (needed to generate query embeddings)
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
    logger.info("LainLLM service stopped")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy" if llm else "degraded",
        model_loaded=llm is not None,
        redis_connected=redis_client is not None,
        icp_canister_connected=ic_agent is not None
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
    """Retrieve relevant past interactions from ICP canister
    
    Uses: search_user_conversation_history(user_id, channel_id, embedding, limit) -> vec text
    """
    global ic_agent, encoder
    
    if not ic_agent or not encoder:
        return []
    
    try:
        query_embedding = encoder.encode(message).tolist()
        embedding_vec = [float(x) for x in query_embedding]
        
        # ic-py format for (text, text, vec float32, opt nat32)
        params = [
            {'type': Types.Text, 'value': principal_id},
            {'type': Types.Text, 'value': "#general"},  # Changed from #lain-tv which doesn't exist
            {'type': Types.Vec(Types.Float32), 'value': embedding_vec},
            {'type': Types.Opt(Types.Nat32), 'value': limit}
        ]
        
        encoded_args = encode(params)
        
        # ic-py returns already decoded result
        result = ic_agent.query_raw(
            ic_canister_id,
            "search_user_conversation_history",
            encoded_args
        )
        
        context = []
        if result and isinstance(result, list) and len(result) > 0:
            # ic-py returns already decoded: [{'type': ..., 'value': [...]}]
            texts = result[0].get('value', [])
            if isinstance(texts, list):
                for item in texts:
                    if isinstance(item, str):
                        context.append({
                            "past_message": item[:200],
                            "past_response": "",
                            "relevance": 0.8
                        })
                logger.info(f"Retrieved {len(context)} conversation entries from ICP for user {principal_id[:8]}...")
        
        return context
    except Exception as e:
        logger.error(f"Error recalling context from ICP: {e}")
        return []

async def recall_knowledge(message: str, limit: int = 10) -> List[Dict]:
    """Retrieve relevant knowledge from ICP canister (ai_api_backend)
    
    This queries the canister's personality embeddings which includes:
    - Lain personality embeddings
    - memex.wiki content
    - LainCorp documentation
    
    Uses: search_personality(channel_id, embedding) -> vec text
    Searches across multiple channels to get comprehensive knowledge.
    """
    global ic_agent, encoder
    
    if not ic_agent or not encoder:
        logger.warning("IC Agent or encoder not available for knowledge recall")
        return []
    
    try:
        query_embedding = encoder.encode(message).tolist()
        embedding_vec = [float(x) for x in query_embedding]
        
        knowledge = []
        
        # Search across multiple relevant channels
        # The canister has: #wiki, #tech, #general, #art, #music, #gaming, etc.
        channels_to_search = ["#wiki", "#tech", "#general"]
        
        for channel in channels_to_search:
            try:
                # Method: search_personality(channel_id: text, embedding: vec float32) -> vec text
                params = [
                    {'type': Types.Text, 'value': channel},
                    {'type': Types.Vec(Types.Float32), 'value': embedding_vec}
                ]
                
                encoded_args = encode(params)
                
                # ic-py returns already decoded result
                result = ic_agent.query_raw(
                    ic_canister_id,
                    "search_personality",
                    encoded_args
                )
                
                if result and isinstance(result, list) and len(result) > 0:
                    # Result is already decoded: [{'type': 'rec_0', 'value': [...strings...]}]
                    texts = result[0].get('value', [])
                    if isinstance(texts, list):
                        for idx, text in enumerate(texts):
                            if isinstance(text, str) and len(text) > 10:
                                # Determine category based on channel and content
                                text_lower = text.lower()
                                if channel == "#wiki" or "wiki" in text_lower or "memex" in text_lower:
                                    topic = "[Wiki Knowledge]"
                                elif "laincorp" in text_lower or "lain.tv" in text_lower:
                                    topic = "[LainCorp]"
                                elif channel == "#tech":
                                    topic = "[Tech Knowledge]"
                                else:
                                    topic = "[Personality]"
                                
                                knowledge.append({
                                    "topic": topic,
                                    "content": text,
                                    "channel": channel,
                                    "relevance": 0.9 - (idx * 0.05)  # Decreasing relevance
                                })
                        
                        logger.info(f"  Channel {channel}: found {len(texts)} results")
            except Exception as e:
                logger.warning(f"  Channel {channel} search failed: {e}")
                continue
        
        # Sort by relevance and limit
        knowledge.sort(key=lambda x: x['relevance'], reverse=True)
        knowledge = knowledge[:limit]
        
        logger.info(f"Retrieved {len(knowledge)} knowledge entries from ICP canister for query: {message[:50]}...")
        
        # Log sample of retrieved knowledge for debugging
        if knowledge:
            logger.info(f"  Sample knowledge: {knowledge[0]['content'][:100]}...")
        
        return knowledge
    except Exception as e:
        logger.error(f"Error recalling knowledge from ICP: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []

async def remember_interaction(principal_id: str, message: str, response: str, mood: str):
    """Store conversation in ICP canister memory
    
    Uses: store_conversation_chunk(conversation_embedding) -> text
    """
    global ic_agent, encoder
    
    if not ic_agent or not encoder:
        return
    
    try:
        # Generate embedding for the conversation
        conversation_text = f"User: {message}\nLain: {response}"
        embedding = encoder.encode(conversation_text).tolist()
        embedding_vec = [float(x) for x in embedding]
        
        # Get next chunk index
        chunk_index = 0
        try:
            params = [
                {'type': Types.Text, 'value': principal_id},
                {'type': Types.Text, 'value': "#general"}  # Changed from #lain-tv
            ]
            encoded_args = encode(params)
            # ic-py returns already decoded result
            result = ic_agent.query_raw(
                ic_canister_id,
                "get_next_conversation_chunk_index",
                encoded_args
            )
            if result and isinstance(result, list) and len(result) > 0:
                # ic-py returns already decoded: [{'type': ..., 'value': N}]
                chunk_index = result[0].get('value', 0) if isinstance(result[0], dict) else 0
        except Exception as e:
            logger.debug(f"Could not get chunk index: {e}")
            chunk_index = 0
        
        # Create conversation embedding record
        # conversation_embedding = record {
        #   user_id: text, channel_id: text, conversation_text: text,
        #   embedding: vec float32, message_count: nat32, chunk_index: nat32,
        #   created_at: nat64, summary: text
        # }
        record_type = Types.Record({
            "user_id": Types.Text,
            "channel_id": Types.Text,
            "conversation_text": Types.Text,
            "embedding": Types.Vec(Types.Float32),
            "message_count": Types.Nat32,
            "chunk_index": Types.Nat32,
            "created_at": Types.Nat64,
            "summary": Types.Text
        })
        
        conversation_record = {
            "user_id": principal_id,
            "channel_id": "#general",  # Changed from #lain-tv
            "conversation_text": conversation_text,
            "embedding": embedding_vec,
            "message_count": 1,
            "chunk_index": chunk_index,
            "created_at": int(datetime.now().timestamp() * 1_000_000_000),  # nanoseconds
            "summary": response[:100]
        }
        
        params = [{'type': record_type, 'value': conversation_record}]
        encoded_args = encode(params)
        
        # Make update call to store
        result = ic_agent.update_raw(
            ic_canister_id,
            "store_conversation_chunk",
            encoded_args
        )
        
        if result:
            logger.debug(f"Stored interaction for {principal_id[:8]}... in ICP canister")
        else:
            logger.warning(f"Failed to store interaction: no result returned")
            
    except Exception as e:
        logger.error(f"Error storing memory in ICP: {e}")
        import traceback
        logger.error(traceback.format_exc())

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
    global ic_agent, ic_canister_id
    
    knowledge_stats = {"personality_count": 0}
    
    # Try to get knowledge stats from ICP canister
    if ic_agent:
        try:
            encoded_args = encode([])
            # ic-py returns already decoded result
            result = ic_agent.query_raw(
                ic_canister_id,
                "get_personality_embeddings",
                encoded_args
            )
            if result and isinstance(result, list) and len(result) > 0:
                # ic-py returns already decoded: [{'type': ..., 'value': [...]}]
                records = result[0].get('value', [])
                knowledge_stats["personality_count"] = len(records)
        except Exception as e:
            logger.warning(f"Could not fetch ICP stats: {e}")
    
    return {
        "model_loaded": llm is not None,
        "model_path": MODEL_PATH if llm else None,
        "icp_canister_id": ic_canister_id,
        "icp_connected": ic_agent is not None,
        "knowledge_stats": knowledge_stats,
        "n_threads": N_THREADS,
        "n_ctx": N_CTX,
        "temperature": TEMPERATURE
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
