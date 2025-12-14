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

// Redis client
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect();

// Store active connections
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);

      if (data.type === 'chat') {
        // Forward to LainLLM service
        const lainllmUrl = process.env.LAINLLM_URL || 'http://lainllm:8001';
        const response = await fetch(`${lainllmUrl}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: data.message,
            user_id: data.user_id || 'anonymous',
            username: data.username || 'Anonymous'
          })
        });

        const lainResponse = await response.json();

        // Broadcast Lain's response to all clients
        const broadcast = {
          type: 'lain_response',
          message: lainResponse.response,
          mood: lainResponse.mood,
          animation: lainResponse.animation,
          timestamp: new Date().toISOString()
        };

        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(broadcast));
          }
        });

        // Store in Redis for history
        await redisClient.lPush('chat_history', JSON.stringify({
          user: data.username,
          message: data.message,
          lain_response: lainResponse.response,
          timestamp: new Date().toISOString()
        }));
        await redisClient.lTrim('chat_history', 0, 99); // Keep last 100 messages
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to Lain.TV',
    timestamp: new Date().toISOString()
  }));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', clients: clients.size });
});

// Get chat history
app.get('/history', async (req, res) => {
  try {
    const history = await redisClient.lRange('chat_history', 0, 49);
    res.json({ history: history.map(JSON.parse) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
