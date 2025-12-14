# VRM Model Setup

## Quick Start

1. Place your `lain.vrm` file in this directory (`public/models/`)
2. The VRMViewer component will automatically load it from `/models/lain.vrm`

## VRM Model Requirements

### File Format
- **Format**: VRM 1.0 or VRM 0.x
- **Extension**: `.vrm` (GLTF-based format)
- **Recommended size**: < 20MB for web performance

### Blend Shapes (Required for Expressions)
Your VRM model should include these blend shapes for proper animation:
- `happy` - Happy expression
- `angry` - Angry expression  
- `sad` - Sad expression
- `relaxed` - Relaxed expression
- `surprised` - Surprised expression
- `aa` - Mouth open (for speech)
- `ih` - Mouth smile shape
- `oh` - Mouth O shape
- `blink` - Eye blink
- `blinkLeft` - Left eye blink
- `blinkRight` - Right eye blink
- `lookUp` - Look up
- `lookDown` - Look down
- `lookLeft` - Look left
- `lookRight` - Look right

### Humanoid Bones (Required for Movement)
Standard VRM humanoid rig with these bones:
- `head` - Head bone
- `neck` - Neck bone
- `spine` - Spine bone
- `leftShoulder` - Left shoulder
- `rightShoulder` - Right shoulder

## Creating a VRM Model

### Option 1: VRoid Studio (Easiest)
1. Download [VRoid Studio](https://vroid.com/en/studio) (free)
2. Create or customize your Lain character
3. Export as VRM 1.0
4. VRoid automatically includes all required blend shapes and bones

### Option 2: Blender (Advanced)
1. Create character in Blender
2. Install [VRM Add-on for Blender](https://github.com/saturday06/VRM-Addon-for-Blender)
3. Set up humanoid rig
4. Add blend shapes (shape keys)
5. Export as VRM

### Option 3: Use Pre-made Models
- [VRoid Hub](https://hub.vroid.com/) - Browse VRM models
- [Booth.pm](https://booth.pm/) - Paid/free VRM models
- [The Seed Online](https://seed.online/) - VRM character creator

## Testing Your Model

1. Place `lain.vrm` in `public/models/`
2. Run the frontend: `npm start`
3. The VRMViewer will load and display your model
4. Test expressions by changing moods in the UI
5. Check browser console for any loading errors

## Optimizing for Web

### Reduce File Size
- Use compressed textures (PNG → WebP/JPG)
- Limit texture resolution (2048x2048 max, 1024x1024 recommended)
- Remove unused materials/meshes
- Optimize polygon count (< 50k polygons recommended)

### Performance Tips
- Test in browser DevTools Performance tab
- Target 60 FPS with model loaded
- Check memory usage (< 200MB recommended)
- Optimize blend shapes (avoid extreme values)

## Troubleshooting

### Model Not Loading
- Check browser console for errors
- Verify file is named exactly `lain.vrm`
- Ensure VRM version is 1.0 or 0.x
- Try opening in [Three.js VRM Viewer](https://three-vrm.dev/) to validate

### Expressions Not Working
- Verify blend shapes exist in model
- Check blend shape names match required list
- Test individual blend shapes in VRM editor
- Ensure blend shape values are 0.0-1.0 range

### Poor Performance
- Reduce model polygon count
- Compress textures
- Lower texture resolution
- Disable unnecessary materials
- Check for too many draw calls

## Current Model Location

**Expected path**: `/Users/laincorp/LainCorp/lain-tv/src/lain-tv-frontend/public/models/lain.vrm`

The model will be served at: `https://your-icp-canister.ic0.app/models/lain.vrm`

## Animation Data Format

The animation server provides this data structure:
```json
{
  "vrm_data": {
    "blend_shapes": {
      "happy": 0.8,
      "aa": 0.3,
      "blink": 0.0,
      ...
    },
    "bone_rotations": {
      "head": [0.1, 0.0, 0.05],
      "neck": [0.0, 0.0, 0.0],
      ...
    },
    "effects": {
      "glitch": 0.6,
      "bloom": 0.4,
      "scanlines": 0.3,
      ...
    }
  },
  "mood": "cryptic",
  "state": "speaking"
}
```

## Next Steps

1. ✅ Place your VRM model in this directory
2. ✅ Install frontend dependencies: `cd src/lain-tv-frontend && npm install`
3. ✅ Test locally: `npm start`
4. ✅ Deploy to ICP: `dfx deploy lain-tv-frontend`
