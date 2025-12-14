import { useState, useEffect } from 'react';
import { lain_tv_backend } from 'declarations/lain-tv-backend';

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
    if (!odyseeUrl || !odyseeUrl.includes('odysee.com/')) {
      return odyseeUrl;
    }
    
    // Handle different Odysee URL formats
    // From: https://odysee.com/@channel:id/video:id
    // To: https://odysee.com/$/embed/@channel:id/video:id
    const urlParts = odyseeUrl.split('odysee.com/');
    if (urlParts.length === 2) {
      const path = urlParts[1];
      return `https://odysee.com/$/embed/${path}`;
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
  const [allVideos, setAllVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentChannel, setCurrentChannel] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState({ message: '', show: false });

  // Mock data for development
  const mockVideos = [
    {
      id: '0',
      title: 'AI Art Works - Chill Lofi Stream',
      description: 'Relaxing AI-generated art and music 24/7',
      channel: 'aiartworks360',
      category: 'artists',
      featured: true,
      odysee_url: 'https://odysee.com/@aiartworks360:2/chill:bf',
      thumbnail_url: null,
      published_at: Date.now(),
    },
    {
      id: '1',
      title: 'Get ready for Lain I/O',
      description: 'Exploring blockchain technology and the Internet Computer',
      channel: 'laincorp',
      category: 'tech',
      featured: true,
      odysee_url: 'https://odysee.com/Lain-I-O:0ebb072b602d44c0268f47c90414169ce7417420',
      thumbnail_url: null,
      published_at: Date.now() - 86400000,
    }
  ];

  useEffect(() => {
    loadVideos();
  }, []);

  // Filter videos when category changes
  useEffect(() => {
    if (allVideos.length > 0) {
      filterVideosByCategory(selectedCategory);
    }
  }, [selectedCategory, allVideos]);

  const loadVideos = async () => {
    setIsLoading(true);
    try {
      // Fetch only featured videos for the channel guide
      const backendVideos = await lain_tv_backend.get_featured_videos();
      if (backendVideos && backendVideos.length > 0) {
        // Convert BigInt to Number for timestamps if needed
        const processedVideos = backendVideos.map(v => ({
          ...v,
          published_at: Number(v.published_at),
          fetched_at: Number(v.fetched_at),
        }));
        setAllVideos(processedVideos);
        filterVideosByCategory(selectedCategory, processedVideos);
      } else {
        // Fall back to mock data
        setAllVideos(mockVideos);
        setVideos(mockVideos);
      }
    } catch (error) {
      console.error('Error loading videos, using mock data:', error);
      setAllVideos(mockVideos);
      setVideos(mockVideos);
    }
    setIsLoading(false);
  };

  const filterVideosByCategory = (category, videoList = allVideos) => {
    if (category === 'discover') {
      setVideos(videoList);
    } else {
      const filtered = videoList.filter(v => v.category === category);
      setVideos(filtered.length > 0 ? filtered : videoList);
    }
    setCurrentVideoIndex(0);
    setCurrentChannel(1);
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    showNotification(`📺 ${category.toUpperCase()}`);
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

  const handleSearch = async (query) => {
    if (!query) return;
    
    showNotification(`🔍 Searching...`);
    
    try {
      // Search across ALL videos (including non-featured) via backend
      const searchResults = await lain_tv_backend.search_videos(query);
      
      if (searchResults && searchResults.length > 0) {
        // Process and display search results
        const processedResults = searchResults.map(v => ({
          ...v,
          published_at: Number(v.published_at),
          fetched_at: Number(v.fetched_at),
        }));
        
        setVideos(processedResults);
        setCurrentVideoIndex(0);
        setCurrentChannel(1);
        showNotification(`🔍 Found ${processedResults.length} results`);
      } else {
        // Fall back to local search in featured videos
        const filtered = allVideos.filter(video => 
          video.title.toLowerCase().includes(query.toLowerCase()) || 
          video.channel.toLowerCase().includes(query.toLowerCase()) ||
          video.description.toLowerCase().includes(query.toLowerCase())
        );
        
        if (filtered.length > 0) {
          setVideos(filtered);
          setCurrentVideoIndex(0);
          setCurrentChannel(1);
          showNotification(`🔍 Found ${filtered.length} results`);
        } else {
          showNotification('❌ No results found');
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      // Fall back to local search
      const filtered = allVideos.filter(video => 
        video.title.toLowerCase().includes(query.toLowerCase()) || 
        video.channel.toLowerCase().includes(query.toLowerCase()) ||
        video.description.toLowerCase().includes(query.toLowerCase())
      );
      
      if (filtered.length > 0) {
        setVideos(filtered);
        setCurrentVideoIndex(0);
        setCurrentChannel(1);
        showNotification(`🔍 Found ${filtered.length} results`);
      } else {
        showNotification('❌ No results found');
      }
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

      {/* Category selector */}
      <CategorySelector 
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
      />

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
