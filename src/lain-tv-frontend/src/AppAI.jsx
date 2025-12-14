import { useState, useEffect, useRef } from 'react';
import VRMViewer from './VRMViewer';
import './AppAI.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [animationData, setAnimationData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentMood, setCurrentMood] = useState('neutral');
  const wsRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    // Use environment variable or default to localhost for development
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Lain backend');
      setIsConnected(true);
      // Request initial animation state
      fetchAnimationState();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'history') {
          // Load chat history
          setMessages(data.messages || []);
        } else if (data.type === 'message') {
          // New message from Lain
          setMessages(prev => [...prev, {
            user: data.user || 'Lain',
            message: data.message,
            timestamp: new Date().toISOString()
          }]);
          
          // Update animation based on response
          if (data.user === 'Lain') {
            updateAnimation('speaking', detectMood(data.message));
          }
        } else if (data.type === 'animation') {
          // Direct animation update
          setAnimationData(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('Disconnected from Lain backend');
      setIsConnected(false);
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Fetch animation state from API
  const fetchAnimationState = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost';
      const response = await fetch(`${apiUrl}/api/animation/get_animation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: currentMood,
          state: 'idle'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnimationData(data);
      }
    } catch (error) {
      console.error('Error fetching animation state:', error);
    }
  };

  // Update animation based on state and mood
  const updateAnimation = async (state, mood = currentMood) => {
    setCurrentMood(mood);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost';
      const response = await fetch(`${apiUrl}/api/animation/get_animation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: mood,
          state: state
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnimationData(data);
        
        // Return to idle after speaking
        if (state === 'speaking') {
          setTimeout(() => {
            updateAnimation('idle', mood);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Error updating animation:', error);
    }
  };

  // Detect mood from message content
  const detectMood = (message) => {
    const text = message.toLowerCase();
    
    if (text.includes('happy') || text.includes('joy') || text.includes('great') || text.includes('😊')) {
      return 'happy';
    } else if (text.includes('?') || text.includes('wonder') || text.includes('curious')) {
      return 'curious';
    } else if (text.includes('wired') || text.includes('protocol') || text.includes('reality') || text.includes('consciousness')) {
      return 'cryptic';
    } else if (text.includes('hehe') || text.includes('😄') || text.includes('fun')) {
      return 'playful';
    }
    
    return 'neutral';
  };

  // Send message to Lain
  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected) return;

    const message = {
      user: 'You',
      message: inputMessage,
      timestamp: new Date().toISOString()
    };

    // Add user message to chat
    setMessages(prev => [...prev, message]);

    // Send to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        message: inputMessage
      }));
    }

    setInputMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="lain-app">
      {/* Connection status indicator */}
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        <span className="status-dot"></span>
        {isConnected ? 'CONNECTED TO THE WIRED' : 'DISCONNECTED'}
      </div>

      {/* Main container */}
      <div className="main-container">
        {/* VRM Viewer - Left side */}
        <div className="vrm-container">
          <VRMViewer animationData={animationData} className="vrm-display" />
          
          {/* Mood indicator */}
          <div className="mood-display">
            <div className="mood-label">CURRENT MOOD</div>
            <div className={`mood-value mood-${currentMood}`}>
              {currentMood.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Chat interface - Right side */}
        <div className="chat-container">
          <div className="chat-header">
            <h1>LAIN.TV</h1>
            <p className="tagline">Present day, Present time</p>
          </div>

          {/* Message list */}
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="no-messages">
                <p>No messages yet...</p>
                <p className="hint">Say hello to Lain</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`message ${msg.user === 'Lain' ? 'message-lain' : 'message-user'}`}
                >
                  <div className="message-header">
                    <span className="message-user">{msg.user}</span>
                    <span className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-content">{msg.message}</div>
                </div>
              ))
            )}
          </div>

          {/* Input area */}
          <div className="input-container">
            <textarea
              className="message-input"
              placeholder={isConnected ? "Enter the Wired..." : "Connecting..."}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isConnected}
              rows={3}
            />
            <button 
              className="send-button" 
              onClick={sendMessage}
              disabled={!isConnected || !inputMessage.trim()}
            >
              SEND
            </button>
          </div>

          {/* Mood selector */}
          <div className="mood-selector">
            <span className="mood-selector-label">Change Mood:</span>
            {['neutral', 'happy', 'curious', 'cryptic', 'playful'].map(mood => (
              <button
                key={mood}
                className={`mood-btn ${currentMood === mood ? 'active' : ''}`}
                onClick={() => updateAnimation('idle', mood)}
              >
                {mood}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
