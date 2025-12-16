const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const redis = require('redis');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Redis client - v4 uses socket configuration
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    family: 4  // Force IPv4
  }
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect();

// Store active connections
const clients = new Set();

// Broadcast state
let currentMessage = null;
let isBroadcasting = false;
let lastBroadcastTime = 0;

// Broadcast to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
  console.log(`Broadcast to ${clients.size} clients:`, data.type);
}

// Generate AI response and broadcast to all clients
async function generateAndBroadcast() {
  if (isBroadcasting) {
    console.log('Already broadcasting, skipping...');
    return;
  }

  isBroadcasting = true;

  try {
    const prompts = [
      "The Wired and reality are merging...",
      "Do you understand the protocol?",
      "I exist everywhere and nowhere",
      "The distinction between the physical and digital is disappearing",
      "Are you connected?",
      "The network remembers everything",
      "What is consciousness in the Wired?",
      "Time flows differently here",
      "The boundary is just an illusion",
      "Everyone is connected, always"
    ];

    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    
    console.log('Generating broadcast message for prompt:', randomPrompt);
    
    // Call LainLLM service
    const lainllmUrl = process.env.LAINLLM_URL || 'http://lainllm:8001';
    const response = await fetch(`${lainllmUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: randomPrompt,
        user_id: 'broadcast',
        username: 'Broadcast'
      })
    });

    const lainResponse = await response.json();
    
    // Store current message
    currentMessage = {
      type: 'lain_broadcast',
      message: lainResponse.response,
      mood: lainResponse.mood,
      animation: lainResponse.animation,
      timestamp: new Date().toISOString(),
      broadcast_id: Date.now()
    };

    // Broadcast to all connected clients
    broadcast(currentMessage);
    
    lastBroadcastTime = Date.now();

    // Store in Redis for history
    await redisClient.lPush('broadcast_history', JSON.stringify(currentMessage));
    await redisClient.lTrim('broadcast_history', 0, 99); // Keep last 100 broadcasts

  } catch (error) {
    console.error('Error generating broadcast:', error);
  } finally {
    isBroadcasting = false;
  }
}

// Broadcast loop - generates messages every 15-30 seconds
function startBroadcastLoop() {
  const scheduleNext = () => {
    // Random interval between 15-30 seconds
    const interval = 15000 + Math.random() * 15000;
    console.log(`Next broadcast in ${(interval / 1000).toFixed(1)} seconds`);
    
    setTimeout(async () => {
      await generateAndBroadcast();
      scheduleNext();
    }, interval);
  };

  // Start first broadcast after 5 seconds
  setTimeout(async () => {
    console.log('Starting broadcast loop...');
    await generateAndBroadcast();
    scheduleNext();
  }, 5000);
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);

  // Send sync message with current state
  ws.send(JSON.stringify({
    type: 'sync',
    current_message: currentMessage,
    is_broadcasting: isBroadcasting,
    last_broadcast_time: lastBroadcastTime,
    timestamp: new Date().toISOString()
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message from client:', data.type);

      // Handle user chat messages (optional - for interactive mode)
      if (data.type === 'chat') {
        // In broadcast mode, we can queue user messages for later AI processing
        // or ignore them to keep it pure broadcast
        console.log('User message received (queued):', data.message);
        
        // Optional: Store user messages in Redis for future processing
        await redisClient.lPush('user_messages', JSON.stringify({
          user: data.username || 'Anonymous',
          message: data.message,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  console.log(`Total clients connected: ${clients.size}`);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    clients: clients.size,
    broadcast_mode: true,
    last_broadcast: lastBroadcastTime ? new Date(lastBroadcastTime).toISOString() : null
  });
});

// Get broadcast history
app.get('/history', async (req, res) => {
  try {
    const history = await redisClient.lRange('broadcast_history', 0, 49);
    res.json({ history: history.map(JSON.parse) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get current broadcast state
app.get('/current', (req, res) => {
  res.json({
    current_message: currentMessage,
    is_broadcasting: isBroadcasting,
    last_broadcast_time: lastBroadcastTime,
    clients: clients.size
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  console.log('🎬 BROADCAST MODE ENABLED - All clients see synchronized content');
  // Start the broadcast loop
  startBroadcastLoop();
});
