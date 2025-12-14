import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

// Cyberpunk post-processing shaders
const GlitchShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    glitchIntensity: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float glitchIntensity;
    varying vec2 vUv;
    
    float random(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    void main() {
      vec2 uv = vUv;
      
      if (glitchIntensity > 0.0) {
        // Horizontal glitch lines
        float glitch = step(0.98, random(vec2(floor(uv.y * 100.0), floor(time * 10.0))));
        uv.x += (random(vec2(floor(uv.y * 10.0), floor(time))) - 0.5) * glitch * glitchIntensity * 0.1;
        
        // RGB shift
        float shift = glitchIntensity * 0.01;
        vec4 r = texture2D(tDiffuse, uv + vec2(shift, 0.0));
        vec4 g = texture2D(tDiffuse, uv);
        vec4 b = texture2D(tDiffuse, uv - vec2(shift, 0.0));
        
        gl_FragColor = vec4(r.r, g.g, b.b, 1.0);
      } else {
        gl_FragColor = texture2D(tDiffuse, uv);
      }
    }
  `
};

const ScanlinesShader = {
  uniforms: {
    tDiffuse: { value: null },
    scanlineIntensity: { value: 0.2 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float scanlineIntensity;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float scanline = sin(vUv.y * 800.0) * 0.5 + 0.5;
      color.rgb -= scanline * scanlineIntensity * 0.1;
      gl_FragColor = color;
    }
  `
};

const VRMViewer = ({ animationData, className = '' }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const vrmRef = useRef(null);
  const composerRef = useRef(null);
  const glitchPassRef = useRef(null);
  const scanlinesPassRef = useRef(null);
  const bloomPassRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e); // Darker blue-purple background
    sceneRef.current = scene;
    
    console.log('VRMViewer: Scene initialized');

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      30,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.7, 8); // Positioned to see full body
    camera.lookAt(0, 0.7, 0); // Look at center of model
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    console.log('VRMViewer: Container dimensions:', width, 'x', height);
    
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    console.log('VRMViewer: Renderer initialized');

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x6688ff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const rimLight = new THREE.DirectionalLight(0xff00ff, 0.3);
    rimLight.position.set(-1, 0.5, -1);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x00ffff, 0.2);
    fillLight.position.set(1, -0.5, 1);
    scene.add(fillLight);

    // Post-processing setup
    const composer = new EffectComposer(renderer);
    composerRef.current = composer;

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom pass for cyberpunk glow
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(containerRef.current.clientWidth, containerRef.current.clientHeight),
      0.3, // strength
      0.4, // radius
      0.85 // threshold
    );
    bloomPassRef.current = bloomPass;
    composer.addPass(bloomPass);

    // Glitch pass
    const glitchPass = new ShaderPass(GlitchShader);
    glitchPassRef.current = glitchPass;
    composer.addPass(glitchPass);

    // Scanlines pass
    const scanlinesPass = new ShaderPass(ScanlinesShader);
    scanlinesPassRef.current = scanlinesPass;
    composer.addPass(scanlinesPass);

    // Load VRM model
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    console.log('Starting VRM load from /models/lain.vrm');
    
    loader.load(
      '/models/lain.vrm',
      (gltf) => {
        console.log('GLTF loaded:', gltf);
        const vrm = gltf.userData.vrm;
        
        if (!vrm) {
          console.error('No VRM data found in GLTF file');
          setError('Invalid VRM file format');
          setLoading(false);
          return;
        }
        
        console.log('VRM object:', vrm);
        console.log('VRM scene:', vrm.scene);
        
        // Disable frustum culling for proper rendering
        vrm.scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.frustumCulled = false;
          }
        });
        
        VRMUtils.removeUnnecessaryJoints(gltf.scene);
        VRMUtils.rotateVRM0(vrm);
        
        // Calculate bounding box to center the model
        const box = new THREE.Box3().setFromObject(vrm.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        console.log('Model bounding box center:', center);
        console.log('Model size:', size);
        console.log('Model position before adjustment:', vrm.scene.position);
        
        // Center the model at origin and position at ground level
        vrm.scene.position.x = -center.x;
        vrm.scene.position.y = -box.min.y; // Put feet at y=0
        vrm.scene.position.z = -center.z;
        
        console.log('Model position after adjustment:', vrm.scene.position);
        
        scene.add(vrm.scene);
        vrmRef.current = vrm;
        
        // Adjust camera to fit the model
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5; // Add some padding
        
        camera.position.set(0, size.y * 0.5, cameraZ);
        camera.lookAt(0, size.y * 0.5, 0);
        
        console.log('Camera adjusted to:', camera.position);
        console.log('Looking at:', { x: 0, y: size.y * 0.5, z: 0 });
        
        console.log('VRM added to scene successfully');
        console.log('Scene children:', scene.children.length);
        setLoading(false);
      },
      (progress) => {
        const percent = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : 0;
        console.log('Loading VRM:', percent + '%', 'loaded:', progress.loaded, 'total:', progress.total);
      },
      (error) => {
        console.error('Error loading VRM:', error);
        setError(`Failed to load VRM: ${error.message}`);
        setLoading(false);
      }
    );

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      const deltaTime = clockRef.current.getDelta();
      
      if (vrmRef.current) {
        vrmRef.current.update(deltaTime);
      }
      
      // Update glitch shader time
      if (glitchPassRef.current) {
        glitchPassRef.current.uniforms.time.value += deltaTime;
      }
      
      composer.render();
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      
      renderer.setSize(width, height);
      composer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
    };
  }, []);

  // Apply animation data to VRM
  useEffect(() => {
    if (!vrmRef.current || !animationData?.vrm_data) return;

    const vrm = vrmRef.current;
    const { blend_shapes, bone_rotations, effects } = animationData.vrm_data;

    // Apply blend shapes
    if (blend_shapes && vrm.expressionManager) {
      Object.entries(blend_shapes).forEach(([name, value]) => {
        // Map our blend shape names to VRM expressions
        const expressionName = mapBlendShapeToVRM(name);
        if (expressionName && vrm.expressionManager.expressionMap[expressionName]) {
          vrm.expressionManager.setValue(expressionName, value);
        }
      });
    }

    // Apply bone rotations
    if (bone_rotations && vrm.humanoid) {
      Object.entries(bone_rotations).forEach(([boneName, rotation]) => {
        const bone = getBoneByName(vrm, boneName);
        if (bone && rotation.length === 3) {
          bone.rotation.set(rotation[0], rotation[1], rotation[2]);
        }
      });
    }

    // Apply visual effects
    if (effects) {
      if (glitchPassRef.current) {
        glitchPassRef.current.uniforms.glitchIntensity.value = effects.glitch || 0.0;
      }
      if (scanlinesPassRef.current) {
        scanlinesPassRef.current.uniforms.scanlineIntensity.value = effects.scanlines || 0.2;
      }
      if (bloomPassRef.current) {
        bloomPassRef.current.strength = effects.bloom || 0.3;
      }
    }
  }, [animationData]);

  // Helper function to map our blend shape names to VRM standard names
  const mapBlendShapeToVRM = (name) => {
    const mapping = {
      'happy': 'happy',
      'angry': 'angry',
      'sad': 'sad',
      'relaxed': 'relaxed',
      'surprised': 'surprised',
      'aa': 'aa',
      'ih': 'ih',
      'oh': 'oh',
      'blink': 'blink',
      'blinkLeft': 'blinkLeft',
      'blinkRight': 'blinkRight',
      'lookUp': 'lookUp',
      'lookDown': 'lookDown',
      'lookLeft': 'lookLeft',
      'lookRight': 'lookRight'
    };
    return mapping[name];
  };

  // Helper function to get bone by name
  const getBoneByName = (vrm, boneName) => {
    const boneMapping = {
      'head': 'head',
      'neck': 'neck',
      'spine': 'spine',
      'leftShoulder': 'leftShoulder',
      'rightShoulder': 'rightShoulder'
    };
    
    const vrmBoneName = boneMapping[boneName];
    if (!vrmBoneName) return null;
    
    return vrm.humanoid?.getNormalizedBoneNode(vrmBoneName);
  };

  return (
    <div className={`vrm-viewer ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#00ffff',
          fontSize: '1.2rem',
          textShadow: '0 0 10px #00ffff'
        }}>
          Loading Lain...
        </div>
      )}
      
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#ff0066',
          fontSize: '1rem',
          textAlign: 'center',
          padding: '20px',
          background: 'rgba(0,0,0,0.8)',
          borderRadius: '8px'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default VRMViewer;
