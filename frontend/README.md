# Frontend - Retro TV Interface

A retro television-themed frontend for Lain TV that displays video metadata from ICP canisters and streams content from Odysee.

## Design Features

- **Retro TV Aesthetic**: Corner television decorations with vintage CRT styling
- **Central Video Screen**: Main viewing area with scanline effects and retro green glow
- **Interactive TV Controls**: Bottom-right control panel with channel buttons and search
- **Channel Guide**: Left sidebar showing available videos as TV channels
- **Odysee Integration**: Embeds Odysee streams directly in the central screen

## Interface Elements

### TV Corner Decorations
- Four corner TV graphics with retro styling
- Simulated power LEDs and vintage design
- Slight rotation for authentic old TV look

### Main Screen
- Central video display area (60vw × 45vh)
- CRT-style border and shadow effects
- Scanline overlay for authentic retro feel
- Odysee video embedding capability

### Control Panel
- **Channel Controls**: CH+ and CH- buttons
- **Playback Controls**: Previous, Play/Pause, Next
- **Volume Controls**: VOL+ and VOL- (visual feedback)
- **Special Buttons**: Power toggle, Menu access
- **Search Area**: Text input and search button

### Channel Guide
- Left sidebar listing all available videos
- Videos mapped to channel numbers (1-10)
- Click to switch channels directly
- Highlights currently selected channel

## Technical Implementation

### Files
- `index.html` - Minimal HTML structure with config
- `styles.css` - Complete retro TV styling and animations
- `app.js` - Full JavaScript TV interface and Odysee integration

### Key Features
- **Mock Data Support**: Works without backend for development
- **Responsive Design**: Adapts to different screen sizes
- **Configurable API**: Easy to connect to ICP canister backend
- **Odysee Embedding**: Automatic conversion of Odysee URLs to embeds
- **Sound Effects**: Simple beep sounds for channel changes
- **Notifications**: Toast-style feedback for user actions

## Configuration

Update the canister API URL in `index.html`:

```javascript
window.CONFIG = {
  CANISTER_API: 'https://your-canister.ic0.app'
};
```

## API Expected Format

The frontend expects JSON from `/api/videos` endpoint:

```json
[
  {
    "id": "1",
    "title": "Video Title",
    "description": "Video description",
    "channel": "Channel Name",
    "odysee_url": "https://odysee.com/@channel:0/video:1",
    "thumbnail_url": "https://...",
    "published_at": 1699632000000
  }
]
```

## Usage

1. **Channel Navigation**: Use CH+ and CH- buttons or click videos in the guide
2. **Search**: Type in search box and click SEARCH or press Enter
3. **Playback**: Video controls work through the embedded Odysee player
4. **Power**: Toggle screen on/off with PWR button
5. **Menu**: Access additional options (currently shows notification)

## Development

To test locally:
```bash
cd frontend
python3 -m http.server 8000
# Open http://localhost:8000 in browser
```

## Next Steps

- Connect to actual ICP canister backend
- Add more sophisticated search and filtering
- Implement user preferences and favorites
- Add keyboard shortcuts for TV-like remote control
- Enhance mobile responsiveness