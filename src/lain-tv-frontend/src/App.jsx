import { useState, useEffect } from 'react';
import { lain_tv_backend } from 'declarations/lain-tv-backend';

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

// Main Screen Component
function MainScreen({ currentVideo, isLoading }) {
  const getOdyseeEmbedUrl = (odyseeUrl) => {
    if (odyseeUrl && odyseeUrl.includes('odysee.com/')) {
      return odyseeUrl.replace('odysee.com/', 'odysee.com/$/embed/');
    }
    return odyseeUrl;
  };

  return (
    <div className="main-screen">
      <div className="screen-content">
        <div className="video-container">
          {isLoading ? (
            <div className="video-placeholder loading">
              LAIN TV<br />
              <small>Loading from ICP...</small>
            </div>
          ) : currentVideo ? (
            <iframe
              src={getOdyseeEmbedUrl(currentVideo.odysee_url)}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="video-placeholder">
              LAIN TV<br />
              <small>Select a channel</small>
            </div>
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
  const [videos, setVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentChannel, setCurrentChannel] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState({ message: '', show: false });

  // Mock data for development
  const mockVideos = [
    {
      id: '1',
      title: 'Decentralized Future on ICP',
      description: 'Exploring blockchain technology and the Internet Computer',
      channel: 'TechLain',
      odysee_url: 'https://odysee.com/@lainlives:c/decentralized-tech:e',
      thumbnail_url: null,
      published_at: Date.now() - 86400000,
    },
    {
      id: '2',
      title: 'Cyberpunk Aesthetics & Digital Art',
      description: 'Visual culture in the digital age',
      channel: 'VisualLain',
      odysee_url: 'https://odysee.com/@lainlives:c/cyberpunk-culture:3',
      thumbnail_url: null,
      published_at: Date.now() - 172800000,
    },
    {
      id: '3',
      title: 'Web3 Development Tutorial',
      description: 'Building decentralized apps on Internet Computer',
      channel: 'DevLain',
      odysee_url: 'https://odysee.com/@lainlives:c/icp-development:7',
      thumbnail_url: null,
      published_at: Date.now() - 259200000,
    },
    {
      id: '4',
      title: 'Digital Philosophy & Consciousness',
      description: 'Consciousness in cyberspace and virtual reality',
      channel: 'PhiloLain',
      odysee_url: 'https://odysee.com/@lainlives:c/digital-philosophy:1',
      thumbnail_url: null,
      published_at: Date.now() - 345600000,
    },
    {
      id: '5',
      title: 'Network Protocols Explained',
      description: 'Understanding the wired and network infrastructure',
      channel: 'TechLain',
      odysee_url: 'https://odysee.com/@lainlives:c/network-protocols:9',
      thumbnail_url: null,
      published_at: Date.now() - 432000000,
    }
  ];

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    setIsLoading(true);
    try {
      // Try to fetch from backend canister
      const backendVideos = await lain_tv_backend.list_videos();
      if (backendVideos && backendVideos.length > 0) {
        setVideos(backendVideos);
      } else {
        // Use mock data if no backend data
        setVideos(mockVideos);
      }
    } catch (error) {
      console.error('Error loading videos from backend, using mock data:', error);
      setVideos(mockVideos);
    }
    setIsLoading(false);
  };

  const showNotification = (message) => {
    setNotification({ message, show: true });
    setTimeout(() => {
      setNotification({ message: '', show: false });
    }, 2000);
  };

  const handleChannelUp = () => {
    const nextChannel = currentChannel < 10 ? currentChannel + 1 : 1;
    setCurrentChannel(nextChannel);
    const videoIndex = (nextChannel - 1) % videos.length;
    setCurrentVideoIndex(videoIndex);
  };

  const handleChannelDown = () => {
    const prevChannel = currentChannel > 1 ? currentChannel - 1 : 10;
    setCurrentChannel(prevChannel);
    const videoIndex = (prevChannel - 1) % videos.length;
    setCurrentVideoIndex(videoIndex);
  };

  const handleVideoSelect = (index) => {
    setCurrentVideoIndex(index);
    setCurrentChannel(index + 1);
  };

  const handleNext = () => {
    const nextIndex = (currentVideoIndex + 1) % videos.length;
    setCurrentVideoIndex(nextIndex);
    setCurrentChannel(nextIndex + 1);
  };

  const handlePrevious = () => {
    const prevIndex = currentVideoIndex > 0 ? currentVideoIndex - 1 : videos.length - 1;
    setCurrentVideoIndex(prevIndex);
    setCurrentChannel(prevIndex + 1);
  };

  const handleSearch = (query) => {
    if (!query) return;
    
    const filtered = videos.filter(video => 
      video.title.toLowerCase().includes(query.toLowerCase()) || 
      video.channel.toLowerCase().includes(query.toLowerCase()) ||
      video.description.toLowerCase().includes(query.toLowerCase())
    );
    
    if (filtered.length > 0) {
      const index = videos.indexOf(filtered[0]);
      setCurrentVideoIndex(index);
      setCurrentChannel(index + 1);
      showNotification(`🔍 Found: ${filtered[0].title}`);
    } else {
      showNotification('❌ No results found');
    }
  };

  const handleTogglePlay = () => {
    showNotification('⏯ Playback control via Odysee player');
  };

  const handlePower = () => {
    showNotification('📺 LAIN TV');
  };

  const handleMenu = () => {
    showNotification('📋 MENU - Use search or channel buttons');
  };

  const currentVideo = videos.length > 0 ? videos[currentVideoIndex] : null;

  return (
    <div className="lain-tv-app">
      {/* TV Corner decorations */}
      <TVCorner className="tv-top-left" />
      <TVCorner className="tv-top-right" />
      <TVCorner className="tv-bottom-left" />
      <TVCorner className="tv-bottom-right" />

      {/* Main screen */}
      <MainScreen currentVideo={currentVideo} isLoading={isLoading} />

      {/* Video list sidebar */}
      <VideoList 
        videos={videos} 
        currentVideoIndex={currentVideoIndex}
        onVideoSelect={handleVideoSelect}
      />

      {/* Control panel */}
      <ControlPanel
        currentChannel={currentChannel}
        onChannelUp={handleChannelUp}
        onChannelDown={handleChannelDown}
        onSearch={handleSearch}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onTogglePlay={handleTogglePlay}
        onPower={handlePower}
        onMenu={handleMenu}
      />

      {/* Notification */}
      <Notification message={notification.message} show={notification.show} />
    </div>
  );
}

export default App;
