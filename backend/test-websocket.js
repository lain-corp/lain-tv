#!/usr/bin/env node

/**
 * WebSocket Test Client for Lain.TV
 * Tests real-time chat functionality
 */

const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8080/ws';

console.log('🎭 Lain.TV WebSocket Test Client');
console.log('=================================');
console.log(`Connecting to: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server\n');
    
    // Send a test message
    const testMessage = {
        type: 'chat',
        message: 'Hello Lain! Can you tell me about yourself?',
        username: 'WebSocketTester',
        user_id: 'ws_test_001'
    };
    
    console.log('📤 Sending message:');
    console.log(JSON.stringify(testMessage, null, 2));
    console.log('');
    
    ws.send(JSON.stringify(testMessage));
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received message:');
        console.log(JSON.stringify(message, null, 2));
        console.log('');
        
        // Close after receiving response
        if (message.type === 'lain_response') {
            console.log('✅ Test completed successfully!');
            console.log('Lain responded:', message.message);
            setTimeout(() => {
                ws.close();
                process.exit(0);
            }, 1000);
        }
    } catch (error) {
        console.error('❌ Error parsing message:', error);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('\n👋 WebSocket connection closed');
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('⏱️  Timeout - no response received');
    ws.close();
    process.exit(1);
}, 30000);
