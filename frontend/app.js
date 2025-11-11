// Lain TV - Retro TV Interface
class LainTV {
  constructor() {
    this.videos = [];
    this.currentChannel = 1;
    this.maxChannels = 10;
    this.currentVideo = null;
    this.isLoading = false;
    
    this.init();
  }
  
  init() {
    this.createTVInterface();
    this.bindEvents();
    this.loadVideos();
  }
  
  createTVInterface() {
    // Clear existing content
    document.body.innerHTML = '';
    
    // TV Corner decorations
    ['tv-top-left', 'tv-top-right', 'tv-bottom-left', 'tv-bottom-right'].forEach(className => {
      const corner = document.createElement('div');
      corner.className = `tv-corner ${className}`;
      document.body.appendChild(corner);
    });
    
    // Main screen
    const mainScreen = document.createElement('div');
    mainScreen.className = 'main-screen';
    mainScreen.innerHTML = `
      <div class="screen-content">
        <div class="video-container" id="videoContainer">
          <div class="video-placeholder loading" id="videoPlaceholder">
            LAIN TV<br>
            <small>Connecting to Odysee...</small>
          </div>
        </div>
        <div class="screen-overlay"></div>
      </div>
    `;
    document.body.appendChild(mainScreen);
    
    // Video list sidebar
    const videoList = document.createElement('div');
    videoList.className = 'video-list';
    videoList.innerHTML = `
      <div style="color: #00ff00; font-weight: bold; margin-bottom: 15px; text-align: center;">
        CHANNEL GUIDE
      </div>
      <div id="videoListContent"></div>
    `;
    document.body.appendChild(videoList);
    
    // Control panel
    const controlPanel = document.createElement('div');
    controlPanel.className = 'control-panel';
    controlPanel.innerHTML = `
      <div class="channel-display">
        CH: <span id="channelNumber">${this.currentChannel.toString().padStart(2, '0')}</span>
      </div>
      <div class="control-grid">
        <button class="tv-button" id="chUp">CH+</button>
        <button class="tv-button" id="volUp">VOL+</button>
        <button class="tv-button" id="power">PWR</button>
        <button class="tv-button" id="chDown">CH-</button>
        <button class="tv-button" id="volDown">VOL-</button>
        <button class="tv-button" id="menu">MENU</button>
        <button class="tv-button" id="prev">⏮</button>
        <button class="tv-button" id="play">⏯</button>
        <button class="tv-button" id="next">⏭</button>
      </div>
      <div class="search-area">
        <input type="text" class="search-input" id="searchInput" placeholder="Search videos...">
        <button class="search-btn" id="searchBtn">SEARCH</button>
      </div>
    `;
    document.body.appendChild(controlPanel);
  }
  
  bindEvents() {
    // Channel controls
    document.getElementById('chUp').addEventListener('click', () => this.channelUp());
    document.getElementById('chDown').addEventListener('click', () => this.channelDown());
    
    // Playback controls
    document.getElementById('prev').addEventListener('click', () => this.previousVideo());
    document.getElementById('next').addEventListener('click', () => this.nextVideo());
    document.getElementById('play').addEventListener('click', () => this.togglePlay());
    
    // Other controls
    document.getElementById('power').addEventListener('click', () => this.togglePower());
    document.getElementById('menu').addEventListener('click', () => this.showMenu());
    
    // Search
    document.getElementById('searchBtn').addEventListener('click', () => this.search());
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.search();
    });
    
    // Volume controls (placeholder)
    document.getElementById('volUp').addEventListener('click', () => this.volumeUp());
    document.getElementById('volDown').addEventListener('click', () => this.volumeDown());
  }
  
  async loadVideos() {
    this.isLoading = true;
    this.updateVideoPlaceholder('Loading videos from ICP...');
    
    try {
      // Try to fetch from configured canister API
      const apiUrl = window.CONFIG?.CANISTER_API || 'mock';
      
      if (apiUrl === 'mock' || apiUrl.includes('REPLACE_WITH_CANISTER')) {
        // Use mock data for demo
        this.videos = this.generateMockVideos();
      } else {
        const response = await fetch(`${apiUrl}/api/videos`);
        this.videos = await response.json();
      }
      
      this.renderVideoList();
      this.selectChannel(this.currentChannel);
      
    } catch (error) {
      console.error('Error loading videos:', error);
      this.videos = this.generateMockVideos();
      this.renderVideoList();
      this.selectChannel(this.currentChannel);
    }
    
    this.isLoading = false;
  }
  
  generateMockVideos() {
    return [
      {
        id: '1',
        title: 'Decentralized Future',
        description: 'Exploring blockchain technology',
        channel: 'TechLain',
        odysee_url: 'https://odysee.com/@TechLain:0/decentralized-future:1',
        thumbnail_url: null,
        published_at: Date.now() - 86400000,
      },
      {
        id: '2',
        title: 'Cyberpunk Aesthetics',
        description: 'Visual culture in digital age',
        channel: 'VisualLain',
        odysee_url: 'https://odysee.com/@VisualLain:0/cyberpunk-aesthetics:1',
        thumbnail_url: null,
        published_at: Date.now() - 172800000,
      },
      {
        id: '3',
        title: 'Web3 Development',
        description: 'Building on Internet Computer',
        channel: 'DevLain',
        odysee_url: 'https://odysee.com/@DevLain:0/web3-development:1',
        thumbnail_url: null,
        published_at: Date.now() - 259200000,
      },
      {
        id: '4',
        title: 'Digital Philosophy',
        description: 'Consciousness in cyberspace',
        channel: 'PhiloLain',
        odysee_url: 'https://odysee.com/@PhiloLain:0/digital-philosophy:1',
        thumbnail_url: null,
        published_at: Date.now() - 345600000,
      },
      {
        id: '5',
        title: 'Network Protocols',
        description: 'Understanding the wired',
        channel: 'TechLain',
        odysee_url: 'https://odysee.com/@TechLain:0/network-protocols:1',
        thumbnail_url: null,
        published_at: Date.now() - 432000000,
      }
    ];
  }
  
  renderVideoList() {
    const listContent = document.getElementById('videoListContent');
    listContent.innerHTML = '';
    
    this.videos.forEach((video, index) => {
      const item = document.createElement('div');
      item.className = 'video-item';
      item.innerHTML = `
        <div class="video-title">${this.truncateText(video.title, 25)}</div>
        <div class="video-channel">${video.channel}</div>
      `;
      item.addEventListener('click', () => this.selectVideo(index));
      listContent.appendChild(item);
    });
  }
  
  selectChannel(channelNum) {
    this.currentChannel = channelNum;
    document.getElementById('channelNumber').textContent = channelNum.toString().padStart(2, '0');
    
    // Map channel number to video index
    const videoIndex = (channelNum - 1) % this.videos.length;
    this.selectVideo(videoIndex);
  }
  
  selectVideo(index) {
    if (index >= 0 && index < this.videos.length) {
      this.currentVideo = this.videos[index];
      this.displayVideo(this.currentVideo);
      this.highlightVideoItem(index);
    }
  }
  
  displayVideo(video) {
    const container = document.getElementById('videoContainer');
    
    // Create Odysee embed iframe
    const iframe = document.createElement('iframe');
    iframe.src = this.getOdyseeEmbedUrl(video.odysee_url);
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.frameBorder = '0';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    
    container.innerHTML = '';
    container.appendChild(iframe);
    
    // Update channel display
    const channelDisplay = container.parentElement.querySelector('.channel-display') || document.querySelector('.channel-display');
    if (channelDisplay) {
      const videoIndex = this.videos.indexOf(video);
      this.currentChannel = videoIndex + 1;
      document.getElementById('channelNumber').textContent = this.currentChannel.toString().padStart(2, '0');
    }
  }
  
  getOdyseeEmbedUrl(odyseeUrl) {
    // Convert regular Odysee URL to embed URL
    if (odyseeUrl.includes('odysee.com/')) {
      return odyseeUrl.replace('odysee.com/', 'odysee.com/$/embed/');
    }
    return odyseeUrl;
  }
  
  highlightVideoItem(index) {
    document.querySelectorAll('.video-item').forEach((item, i) => {
      if (i === index) {
        item.style.background = 'rgba(0,255,0,0.3)';
        item.style.borderColor = '#00ff00';
      } else {
        item.style.background = 'rgba(0,255,0,0.1)';
        item.style.borderColor = '#333';
      }
    });
  }
  
  channelUp() {
    const nextChannel = this.currentChannel < this.maxChannels ? this.currentChannel + 1 : 1;
    this.selectChannel(nextChannel);
    this.playChannelChangeSound();
  }
  
  channelDown() {
    const prevChannel = this.currentChannel > 1 ? this.currentChannel - 1 : this.maxChannels;
    this.selectChannel(prevChannel);
    this.playChannelChangeSound();
  }
  
  nextVideo() {
    const currentIndex = this.videos.indexOf(this.currentVideo);
    const nextIndex = (currentIndex + 1) % this.videos.length;
    this.selectVideo(nextIndex);
  }
  
  previousVideo() {
    const currentIndex = this.videos.indexOf(this.currentVideo);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : this.videos.length - 1;
    this.selectVideo(prevIndex);
  }
  
  togglePlay() {
    // For Odysee embeds, we can't control playback directly
    // This could send a message to the iframe or show a notification
    this.showNotification('⏯ Playback control via Odysee player');
  }
  
  volumeUp() {
    this.showNotification('🔊 Volume UP');
  }
  
  volumeDown() {
    this.showNotification('🔉 Volume DOWN');
  }
  
  togglePower() {
    const screen = document.querySelector('.main-screen');
    screen.style.opacity = screen.style.opacity === '0.1' ? '1' : '0.1';
    this.showNotification(screen.style.opacity === '0.1' ? '📴 STANDBY' : '📺 POWER ON');
  }
  
  showMenu() {
    this.showNotification('📋 MENU - Use search or channel buttons');
  }
  
  search() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    if (!query) return;
    
    const filtered = this.videos.filter(video => 
      video.title.toLowerCase().includes(query) || 
      video.channel.toLowerCase().includes(query) ||
      video.description.toLowerCase().includes(query)
    );
    
    if (filtered.length > 0) {
      const index = this.videos.indexOf(filtered[0]);
      this.selectVideo(index);
      this.showNotification(`🔍 Found: ${filtered[0].title}`);
    } else {
      this.showNotification('❌ No results found');
    }
    
    document.getElementById('searchInput').value = '';
  }
  
  updateVideoPlaceholder(text) {
    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) {
      placeholder.innerHTML = text;
    }
  }
  
  showNotification(text) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.9);
      color: #00ff00;
      padding: 10px 20px;
      border: 1px solid #00ff00;
      border-radius: 5px;
      z-index: 1000;
      font-family: 'Courier New', monospace;
    `;
    notification.textContent = text;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 2000);
  }
  
  playChannelChangeSound() {
    // Create a simple beep sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'square';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // Audio not supported, ignore
    }
  }
  
  truncateText(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }
}

// Initialize the TV interface when page loads
document.addEventListener('DOMContentLoaded', () => {
  new LainTV();
});

// Handle window resize
window.addEventListener('resize', () => {
  // Adjust layout if needed
});