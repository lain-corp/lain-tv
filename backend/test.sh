#!/bin/bash

# Lain.TV Backend Test Script
# Tests all services locally before Akash deployment

set -e

echo "🎭 Lain.TV Backend Test Suite"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is running"
echo ""

# Start services
echo "🚀 Starting all services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy (this may take 2-5 minutes)..."
echo "   LainLLM will download the 4.5GB model on first start..."
echo ""

# Wait for nginx to be ready
echo "Waiting for nginx..."
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Nginx is ready"
        break
    fi
    sleep 2
done

# Wait for LainLLM (takes longer due to model download)
echo "Waiting for LainLLM (this may take a few minutes)..."
for i in {1..180}; do
    if docker-compose logs lainllm 2>&1 | grep -q "Application startup complete" || \
       curl -s http://localhost:8080/api/ai/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} LainLLM is ready"
        break
    fi
    sleep 5
    if [ $((i % 6)) -eq 0 ]; then
        echo "  Still waiting... (${i}/180 attempts)"
    fi
done

# Wait for WebSocket
echo "Waiting for WebSocket..."
for i in {1..30}; do
    if docker-compose logs websocket 2>&1 | grep -q "WebSocket server running" || \
       curl -s http://localhost:8080/api/history > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} WebSocket is ready"
        break
    fi
    sleep 2
done

# Wait for TTS
echo "Waiting for TTS..."
for i in {1..30}; do
    if curl -s http://localhost:8080/api/tts/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} TTS is ready"
        break
    fi
    sleep 2
done

# Wait for Animation
echo "Waiting for Animation..."
for i in {1..30}; do
    if curl -s http://localhost:8080/api/animation/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Animation is ready"
        break
    fi
    sleep 2
done

echo ""
echo "🧪 Running API Tests..."
echo "======================"
echo ""

# Test 1: Nginx health
echo -n "Test 1: Nginx health check... "
if curl -s http://localhost:8080/health | grep -q "healthy"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test 2: LainLLM health
echo -n "Test 2: LainLLM health check... "
HEALTH=$(curl -s http://localhost:8080/api/ai/health)
if echo "$HEALTH" | grep -q "status"; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo "   Response: $HEALTH"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test 3: LainLLM stats
echo -n "Test 3: LainLLM stats... "
STATS=$(curl -s http://localhost:8080/api/ai/stats)
if echo "$STATS" | grep -q "model_loaded"; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo "   Response: $STATS"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test 4: Chat history
echo -n "Test 4: WebSocket chat history... "
HISTORY=$(curl -s http://localhost:8080/api/history)
if echo "$HISTORY" | grep -q "history"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test 5: Animation moods
echo -n "Test 5: Animation moods list... "
MOODS=$(curl -s http://localhost:8080/api/animation/moods)
if echo "$MOODS" | grep -q "moods"; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo "   Available moods: $MOODS"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test 6: TTS health
echo -n "Test 6: TTS service health... "
TTS_HEALTH=$(curl -s http://localhost:8080/api/tts/health)
if echo "$TTS_HEALTH" | grep -q "status"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test 7: AI Generation (the big one!)
echo ""
echo -n "Test 7: AI message generation... "
RESPONSE=$(curl -s -X POST http://localhost:8080/api/ai/generate \
    -H "Content-Type: application/json" \
    -d '{
        "message": "Hello Lain, tell me about the Wired",
        "user_id": "test_user",
        "username": "Tester"
    }')

if echo "$RESPONSE" | grep -q "response"; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo ""
    echo "   🎭 Lain's Response:"
    echo "   -------------------"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    echo ""
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "   Response: $RESPONSE"
fi

echo ""
echo "📊 Service Status:"
echo "=================="
docker-compose ps

echo ""
echo "📝 View Logs:"
echo "============="
echo "  All services:  docker-compose logs -f"
echo "  Nginx:         docker-compose logs -f nginx"
echo "  LainLLM:       docker-compose logs -f lainllm"
echo "  WebSocket:     docker-compose logs -f websocket"
echo "  TTS:           docker-compose logs -f tts"
echo "  Animation:     docker-compose logs -f animation"

echo ""
echo "🌐 Available Endpoints:"
echo "======================="
echo "  Health:          http://localhost:8080/health"
echo "  LainLLM API:     http://localhost:8080/api/ai/generate"
echo "  LainLLM Stats:   http://localhost:8080/api/ai/stats"
echo "  Chat History:    http://localhost:8080/api/history"
echo "  WebSocket:       ws://localhost:8080/ws"
echo "  Animation:       http://localhost:8080/api/animation/moods"
echo "  TTS:             http://localhost:8080/api/tts/health"

echo ""
echo "🛑 To stop all services:"
echo "  docker-compose down"
echo ""
echo "🗑️  To clean up and remove volumes:"
echo "  docker-compose down -v"
echo ""
