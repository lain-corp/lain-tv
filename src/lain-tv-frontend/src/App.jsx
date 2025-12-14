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
function AIChatPanel() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Lain');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'history') {
          setMessages(data.messages || []);
        } else if (data.type === 'message') {
          setMessages(prev => [...prev, {
            user: data.user || 'Lain',
            message: data.message,
            timestamp: new Date().toISOString()
          }]);
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

  const sendMessage = () => {
    if (!inputMessage.trim() || !wsRef.current) return;

    const message = {
      type: 'chat',
      message: inputMessage,
      user_id: 'web_user',
      username: 'Anonymous'
    };

    wsRef.current.send(JSON.stringify(message));
    
    // Add user message to local state
    setMessages(prev => [...prev, {
      user: 'You',
      message: inputMessage,
      timestamp: new Date().toISOString()
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
    <div className="control-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        color: isConnected ? '#00ff00' : '#ff0000', 
        fontWeight: 'bold', 
        padding: '10px',
        textAlign: 'center',
        borderBottom: '1px solid #00ff00'
      }}>
        {isConnected ? '● CONNECTED TO LAIN' : '○ DISCONNECTED'}
      </div>
      
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {messages.map((msg, index) => (
          <div key={index} style={{
            padding: '8px',
            backgroundColor: msg.user === 'You' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 255, 0.1)',
            border: `1px solid ${msg.user === 'You' ? '#00ff00' : '#ff00ff'}`,
            borderRadius: '4px'
          }}>
            <div style={{ 
              color: msg.user === 'You' ? '#00ff00' : '#ff00ff',
              fontSize: '0.8em',
              marginBottom: '4px'
            }}>
              {msg.user}
            </div>
            <div style={{ color: '#ffffff' }}>{msg.message}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div style={{ padding: '10px', borderTop: '1px solid #00ff00' }}>
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Talk to Lain..."
          style={{
            width: '100%',
            minHeight: '60px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid #00ff00',
            color: '#00ff00',
            padding: '8px',
            fontFamily: 'monospace',
            fontSize: '14px',
            resize: 'none',
            marginBottom: '8px'
          }}
          disabled={!isConnected}
        />
        <button 
          onClick={sendMessage}
          disabled={!isConnected || !inputMessage.trim()}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: isConnected ? '#00ff00' : '#666',
            color: '#000',
            border: 'none',
            fontWeight: 'bold',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            fontFamily: 'monospace'
          }}
        >
          SEND TO LAIN
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
function MainScreen({ animationData, isLoading }) {
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
  const [notification, setNotification] = useState({ message: '', show: false });

  const fetchAnimationState = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
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
      <MainScreen animationData={animationData} isLoading={isLoading} />

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
        <div style={{ fontSize: '0.8em', color: '#00ff00', marginBottom: '10px', textAlign: 'center' }}>
          Connect to the Wired...
        </div>
      </div>

      {/* AI Chat Control Panel - replaces old control panel */}
      <AIChatPanel />

      {/* Notification */}
      <Notification message={notification.message} show={notification.show} />
    </div>
  );
}

export default App;
