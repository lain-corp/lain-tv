import { useState, useEffect, useRef } from 'react';
// import { lain_tv_backend } from 'declarations/lain-tv-backend';  // Not needed for AI chat mode
import VRMViewer from './VRMViewer';

// Odysee Official Categories
const CATEGORIES = ['discover', 'artists', 'tech', 'gaming', 'music', 'sports', 'news', 'movies', 'education', 'comedy', 'lifestyle'];

// Category Selector Component
function CategorySelector({ selectedCategory, onCategorySelect }) {
  return (
    <div className="category-selector">
      {CATEGORIES.map((category) => (
        <button
          key={category}
          className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
          onClick={() => onCategorySelect(category)}
        >
          {category.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// TV Corner Component
function TVCorner({ className }) {
  return (
    <div className={`tv-corner ${className}`}>
      <img 
        src="/LAIN.gif" 
        alt="Lain animation" 
        className="corner-tv-content"
        onError={(e) => {
          e.target.style.display = 'none';
          console.warn('LAIN.gif not found');
        }}
      />
    </div>
  );
}

// AI Chat Panel Component (replaces Control Panel)
function AIChatPanel({ onSpeakingStateChange, autoSpeak = false }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);
  const processedMessages = useRef(new Set()); // Track processed message IDs to prevent duplicates
  const autoSpeakTimerRef = useRef(null);
  const messageQueue = useRef([]); // Queue for messages waiting to be spoken
  const isProcessingQueue = useRef(false); // Flag to prevent concurrent queue processing

  // WebSocket connection
  useEffect(() => {
    // Prevent double connection in React StrictMode
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }
    
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Lain');
      setIsConnected(true);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        // Handle sync message for late joiners
        if (data.type === 'sync') {
          console.log('Syncing to broadcast state...');
          if (data.current_message) {
            const syncMessage = {
              user: 'Lain',
              message: data.current_message.message,
              timestamp: data.current_message.timestamp,
              mood: data.current_message.mood,
              animation: data.current_message.animation,
              broadcast_id: data.current_message.broadcast_id
            };
            setMessages(prev => [...prev, syncMessage]);
            
            // Don't auto-play sync message, wait for next live broadcast
            console.log('Synced to current message (not playing audio)');
          }
          return;
        }
        
        // Handle live broadcast messages
        if (data.type === 'lain_broadcast') {
          // Create unique message ID to prevent duplicates
          const messageId = data.broadcast_id || `${Date.now()}-${Math.random()}`;
          if (processedMessages.current.has(messageId)) {
            console.log('Skipping duplicate broadcast:', messageId);
            return;
          }
          processedMessages.current.add(messageId);
          
          // Clean up old message IDs (keep last 100)
          if (processedMessages.current.size > 100) {
            const arr = Array.from(processedMessages.current);
            processedMessages.current = new Set(arr.slice(-50));
          }
          
          // Parse response text if needed
          let responseText = data.message;
          let mood = data.mood || 'neutral';
          let animation = data.animation || 'idle';
          
          // Parse JSON if the response is wrapped in markdown code blocks
          if (responseText && responseText.includes('```json')) {
            try {
              const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
              if (jsonMatch && jsonMatch[1]) {
                const parsed = JSON.parse(jsonMatch[1]);
                responseText = parsed.text || '';
                mood = parsed.mood || 'neutral';
                animation = parsed.animation || 'idle';
              }
            } catch (e) {
              console.error('Failed to parse JSON response:', e);
              responseText = responseText.replace(/```json|```/g, '').trim();
            }
          }
          
          // Skip empty responses
          if (!responseText || !responseText.trim()) {
            console.error('Broadcast returned empty response!');
            return;
          }
          
          const newMessage = {
            user: 'Lain',
            message: responseText,
            timestamp: data.timestamp || new Date().toISOString(),
            mood: mood,
            animation: animation,
            broadcast_id: messageId
          };
          setMessages(prev => [...prev, newMessage]);
          
          console.log('🎬 BROADCAST Lain says:', responseText);
          console.log('Mood:', mood, 'Animation:', animation);
          
          // Add to speech queue
          messageQueue.current.push(responseText);
          processMessageQueue();
        } else if (data.type === 'lain_response') {
          // Legacy handler for backward compatibility
          let responseText = data.message;
          let mood = data.mood || 'neutral';
          let animation = data.animation || 'idle';
          
          // Parse JSON if the response is wrapped in markdown code blocks
          if (responseText && responseText.includes('```json')) {
            try {
              // Extract JSON from markdown code block
              const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
              if (jsonMatch && jsonMatch[1]) {
                const parsed = JSON.parse(jsonMatch[1]);
                responseText = parsed.text || '';
                mood = parsed.mood || 'neutral';
                animation = parsed.animation || 'idle';
              }
            } catch (e) {
              console.error('Failed to parse JSON response:', e);
              // Use the raw response if JSON parsing fails
              responseText = responseText.replace(/```json|```/g, '').trim();
            }
          }
          
          // Skip empty responses
          if (!responseText || !responseText.trim()) {
            console.error('LLM returned empty response! Check backend logs.');
            return;
          }
          
          const newMessage = {
            user: 'Lain',
            message: responseText,
            timestamp: data.timestamp || new Date().toISOString(),
            mood: mood,
            animation: animation
          };
          setMessages(prev => [...prev, newMessage]);
          
          console.log('Lain responded:', responseText);
          console.log('Lain mood:', mood);
          console.log('Animation:', animation);
          
          // Add to speech queue
          messageQueue.current.push(responseText);
          processMessageQueue();
        } else if (data.type === 'welcome') {
          console.log('Welcome message:', data.message);
        } else if (data.type === 'error') {
          console.error('Server error:', data.message);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('Disconnected from Lain');
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Note: Auto-speak is now handled server-side in broadcast mode
  // The server generates messages every 15-30 seconds and broadcasts to all clients

  // Process message queue - only one message speaks at a time
  const processMessageQueue = async () => {
    if (isProcessingQueue.current || messageQueue.current.length === 0) {
      return;
    }
    
    isProcessingQueue.current = true;
    
    while (messageQueue.current.length > 0) {
      const text = messageQueue.current.shift();
      await synthesizeSpeech(text);
      // Small pause between messages
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    isProcessingQueue.current = false;
  };

  // Synthesize speech using TTS API
  const synthesizeSpeech = async (text) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      
      // Notify parent that speaking started
      if (onSpeakingStateChange) {
        onSpeakingStateChange(true);
      }
      setIsSpeaking(true);
      
      console.log('Synthesizing speech for:', text);
      
      const response = await fetch(`${apiUrl}/api/tts/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          speaker: 'p225',
          speed: 1.0
        })
      });
      
      if (!response.ok) {
        throw new Error(`TTS API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.audio) {
        // Decode base64 audio
        const audioData = atob(data.audio);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        
        // Create blob and play
        const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Create and play audio
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onloadedmetadata = () => {
          console.log('Audio duration:', audio.duration, 'seconds');
        };
        
        audio.onended = () => {
          console.log('Speech finished after', audio.currentTime, 'seconds');
          setIsSpeaking(false);
          if (onSpeakingStateChange) {
            onSpeakingStateChange(false);
          }
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setIsSpeaking(false);
          if (onSpeakingStateChange) {
            onSpeakingStateChange(false);
          }
        };
        
        await audio.play();
        console.log('Playing Lain\'s voice...');
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
      if (onSpeakingStateChange) {
        onSpeakingStateChange(false);
      }
    }
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !wsRef.current) return;
    
    // Don't send new message if Lain is currently speaking
    if (isSpeaking) {
      console.log('Waiting for Lain to finish speaking...');
      return;
    }

    const message = {
      type: 'chat',
      message: inputMessage,
      user_id: 'web_user',
      username: 'Viewer'
    };

    console.log('Sending message (queued in broadcast mode):', message);
    wsRef.current.send(JSON.stringify(message));
    
    // Add user message to local state
    // Note: In broadcast mode, this is local-only and won't affect other viewers
    setMessages(prev => [...prev, {
      user: 'You',
      message: inputMessage,
      timestamp: new Date().toISOString(),
      local: true // Mark as local-only message
    }]);
    
    setInputMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="ai-chat-panel">
      <div className="chat-header">
        <span className={isConnected ? 'status-connected' : 'status-disconnected'}>
          {isConnected ? '🎬 LIVE BROADCAST' : '○ DISCONNECTED'}
        </span>
        <span className="broadcast-info" style={{ fontSize: '0.8em', marginLeft: '10px', opacity: 0.7 }}>
          All viewers see the same stream
        </span>
      </div>
      
      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">Start a conversation with Lain...</div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message ${msg.user === 'You' ? 'message-user' : 'message-lain'}`}>
              <div className="message-author">{msg.user}</div>
              <div className="message-content">{msg.message}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-container">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="chat-input"
          disabled={!isConnected}
          rows={2}
        />
        <button 
          onClick={sendMessage}
          disabled={!isConnected || !inputMessage.trim() || isSpeaking}
          className="chat-send-btn"
          title={isSpeaking ? "Waiting for Lain to finish speaking..." : "Send message"}
        >
          {isSpeaking ? 'SPEAKING...' : 'SEND'}
        </button>
      </div>
    </div>
  );
}

// Control Panel Component
function ControlPanel({ currentChannel, onChannelUp, onChannelDown, onSearch, onPrevious, onNext, onTogglePlay, onPower, onMenu }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    onSearch(searchQuery);
    setSearchQuery('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="control-panel">
      <div className="channel-display">
        CH: <span id="channelNumber">{currentChannel.toString().padStart(2, '0')}</span>
      </div>
      <div className="control-grid">
        <button className="tv-button" onClick={onChannelUp}>CH+</button>
        <button className="tv-button" onClick={() => {}}>VOL+</button>
        <button className="tv-button" onClick={onPower}>PWR</button>
        <button className="tv-button" onClick={onChannelDown}>CH-</button>
        <button className="tv-button" onClick={() => {}}>VOL-</button>
        <button className="tv-button" onClick={onMenu}>MENU</button>
        <button className="tv-button" onClick={onPrevious}>⏮</button>
        <button className="tv-button" onClick={onTogglePlay}>⏯</button>
        <button className="tv-button" onClick={onNext}>⏭</button>
      </div>
      <div className="search-area">
        <input 
          type="text" 
          className="search-input"
          placeholder="Search videos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button className="search-btn" onClick={handleSearch}>SEARCH</button>
      </div>
    </div>
  );
}

// Video List Component
function VideoList({ videos, currentVideoIndex, onVideoSelect }) {
  return (
    <div className="video-list">
      <div style={{ color: '#00ff00', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>
        CHANNEL GUIDE
      </div>
      <div>
        {videos.map((video, index) => (
          <div 
            key={video.id}
            className={`video-item ${index === currentVideoIndex ? 'selected' : ''}`}
            onClick={() => onVideoSelect(index)}
          >
            <div className="video-title">{video.title.length > 25 ? video.title.substring(0, 25) + '...' : video.title}</div>
            <div className="video-channel">{video.channel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Screen Component - Now shows VRM Lain instead of videos
function MainScreen({ animationData, isLoading, isSpeaking }) {
  return (
    <div className="main-screen">
      <div className="screen-content">
        <div className="video-container" style={{ position: 'relative' }}>
          {isLoading ? (
            <div className="video-placeholder loading">
              LAIN TV<br />
              <small>Loading VRM model...</small>
            </div>
          ) : (
            <VRMViewer 
              animationData={animationData}
              modelPath="/models/lain.vrm"
              className="vrm-container"
              isSpeaking={isSpeaking}
            />
          )}
        </div>
        <div className="screen-overlay"></div>
      </div>
    </div>
  );
}

// Notification Component
function Notification({ message, show }) {
  if (!show) return null;

  return (
    <div className="notification">
      {message}
    </div>
  );
}

// Main App Component
function App() {
  const [animationData, setAnimationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentMood, setCurrentMood] = useState('neutral');
  const [currentState, setCurrentState] = useState('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true); // Auto-speak enabled by default
  const [notification, setNotification] = useState({ message: '', show: false });

  const handleSpeakingStateChange = (speaking) => {
    setIsSpeaking(speaking);
    setCurrentState(speaking ? 'speaking' : 'idle');
    console.log('Speaking state changed:', speaking ? 'speaking' : 'idle');
  };

  const fetchAnimationState = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/animation/get_animation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: currentMood,
          state: currentState
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnimationData(data);
      }
    } catch (error) {
      console.error('Error fetching animation state:', error);
      // Set default animation data on error
      setAnimationData({
        mood: 'neutral',
        state: 'idle',
        vrm_data: {
          blend_shapes: {},
          bone_rotations: {},
          effects: { glitch: 0, bloom: 0.3, scanlines: 0.2, chromatic: 0 }
        }
      });
    }
  };

  // Fetch initial animation state
  useEffect(() => {
    fetchAnimationState();
  }, []);

  // Update animation periodically for idle movement
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAnimationState();
    }, 5000); // Update every 5 seconds for natural idle animation

    return () => clearInterval(interval);
  }, [currentMood]);

  const showNotification = (message) => {
    setNotification({ message, show: true });
    setTimeout(() => {
      setNotification({ message: '', show: false });
    }, 2000);
  };

  return (
    <div className="lain-tv-app">
      {/* TV Corner decorations */}
      <TVCorner className="tv-top-left" />
      <TVCorner className="tv-top-right" />
      <TVCorner className="tv-bottom-left" />
      <TVCorner className="tv-bottom-right" />

      {/* Main screen - Now shows VRM Lain */}
      <MainScreen animationData={animationData} isLoading={isLoading} isSpeaking={isSpeaking} />

      {/* AI Chat Panel - replaces video list */}
      <div className="video-list">
        <div style={{ 
          color: '#00ff00', 
          fontWeight: 'bold', 
          marginBottom: '15px', 
          textAlign: 'center',
          fontSize: '1.2em',
          textShadow: '0 0 10px #00ff00'
        }}>
          💬 TALK TO LAIN
        </div>
        <div style={{ 
          fontSize: '0.8em', 
          color: '#00ff00', 
          marginBottom: '10px', 
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}>
          <span>Auto-speak:</span>
          <button 
            onClick={() => setAutoSpeak(!autoSpeak)}
            style={{
              background: autoSpeak ? '#00ff00' : 'rgba(0,255,0,0.2)',
              color: autoSpeak ? '#000' : '#00ff00',
              border: '2px solid #00ff00',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9em'
            }}
          >
            {autoSpeak ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* AI Chat Control Panel - replaces old control panel */}
      <AIChatPanel onSpeakingStateChange={handleSpeakingStateChange} autoSpeak={autoSpeak} />

      {/* Notification */}
      <Notification message={notification.message} show={notification.show} />
    </div>
  );
}

export default App;
