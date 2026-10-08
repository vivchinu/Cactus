import * as THREE from 'three';
import { CactusCharacter } from './cactusModel.js';
import { AudioEngine } from './audioEngine.js';
import { AnimationManager, STATES } from './animationManager.js';

class TalkingCactusApp {
  constructor() {
    this.canvas = document.getElementById('cactusCanvas');
    this.container = document.querySelector('.canvas-wrapper');

    // DOM Elements
    this.splashScreen = document.getElementById('splashScreen');
    this.splashProgress = document.getElementById('splashProgress');

    this.micBtn = document.getElementById('micBtn');
    this.micSection = document.querySelector('.mic-section');
    this.micIcon = document.getElementById('micSvg');
    this.stopSquare = document.getElementById('stopSquare');
    this.statusPill = document.getElementById('statusPill');
    this.statusText = document.getElementById('statusText');

    this.speechBubble = document.getElementById('speechBubble');
    this.speechBubbleText = document.getElementById('speechBubbleText');

    this.helpBtn = document.getElementById('helpBtn');
    this.helpModal = document.getElementById('helpModal');
    this.closeHelpModalBtn = document.getElementById('closeHelpModalBtn');
    this.closeHelpModalX = document.getElementById('closeHelpModalX');

    this.voiceFxBtn = document.getElementById('voiceFxBtn');
    this.voicePickerDropdown = document.getElementById('voicePickerDropdown');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');

    this.textInputDrawer = document.getElementById('textInputDrawer');
    this.customTextInput = document.getElementById('customTextInput');
    this.sendTextBtn = document.getElementById('sendTextBtn');

    this.isSoundMuted = false;

    // Init Three.js Scene & Environment
    this.initThree();
    this.buildStudioEnvironment();

    // Init Character & Engines
    this.cactus = new CactusCharacter(this.scene);
    this.audioEngine = new AudioEngine();
    this.animManager = new AnimationManager(this.cactus, this.audioEngine);

    // Setup Event Listeners
    this.initEventListeners();

    // Animate Splash Loading Screen Progress & Tween Fade-Out
    this.initSplashScreen();

    // Resize Handler
    window.addEventListener('resize', () => this.onWindowResize());
    this.onWindowResize();

    // Start Main Render Loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initSplashScreen() {
    if (!this.splashScreen || !this.splashProgress) return;

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25 + 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        this.splashProgress.style.width = '100%';

        // Smooth tween fade-out after brief pause
        setTimeout(() => {
          this.splashScreen.classList.add('fade-out');
          setTimeout(() => {
            if (this.splashScreen.parentNode) {
              this.splashScreen.style.display = 'none';
            }
          }, 650);
        }, 350);
      } else {
        this.splashProgress.style.width = `${progress}%`;
      }
    }, 120);
  }

  initThree() {
    this.scene = new THREE.Scene();

    // Camera framed for mobile 9:16 aspect ratio (moved slightly back for ideal spacing)
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 2.9, 15);
    this.camera.lookAt(0, 3, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Warm Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.75);
    this.scene.add(ambientLight);

    // Sun Directional Light (Warm Sunlight from top right)
    const mainLight = new THREE.DirectionalLight(0xfffaee, 1.1);
    mainLight.position.set(4, 7, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.bias = -0.001;
    this.scene.add(mainLight);

    // Green Ambient Rim Light
    const rimLight = new THREE.DirectionalLight(0x78d9a0, 0.5);
    rimLight.position.set(-5, 4, -3);
    this.scene.add(rimLight);

    // Warm Table Fill Light
    const fillLight = new THREE.PointLight(0xffd1a4, 0.45, 10);
    fillLight.position.set(0, 1.2, 2.5);
    this.scene.add(fillLight);
  }

  buildStudioEnvironment() {
    // 1. Warm Oak Wood Table Surface (Matching Reference Screenshot!)
    const woodCanvas = document.createElement('canvas');
    woodCanvas.width = 256;
    woodCanvas.height = 256;
    const ctx = woodCanvas.getContext('2d');
    ctx.fillStyle = '#c48b55';
    ctx.fillRect(0, 0, 256, 256);
    // Draw wood grain lines
    ctx.strokeStyle = '#a86e3b';
    ctx.lineWidth = 2;
    for (let i = 0; i < 256; i += 12) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.bezierCurveTo(80, i + 6, 170, i - 6, 256, i + 2);
      ctx.stroke();
    }
    const woodTex = new THREE.CanvasTexture(woodCanvas);
    woodTex.wrapS = THREE.RepeatWrapping;
    woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(4, 4);

    const tableGeo = new THREE.PlaneGeometry(16, 16);
    const tableMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.5,
      metalness: 0.05,
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.rotation.x = -Math.PI / 2;
    tableMesh.position.y = 0.01;
    tableMesh.receiveShadow = true;
    this.scene.add(tableMesh);

    // 2. Soft Green Studio Background Wall
    const bgGeo = new THREE.PlaneGeometry(24, 18);
    const bgMat = new THREE.MeshStandardMaterial({
      color: 0x3b895d,
      roughness: 0.7,
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(0, 7, -4.5);
    this.scene.add(bgMesh);

    // 3. Background Props (Books on Left, Yellow Speaker Box on Right!)
    // Stack of books (Left background)
    const bookColors = [0xdf6a58, 0xf0cf85, 0x93b7e4];
    for (let i = 0; i < 3; i++) {
      const bookGeo = new THREE.BoxGeometry(1.2, 0.22, 0.9);
      const bookMat = new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.6 });
      const bookMesh = new THREE.Mesh(bookGeo, bookMat);
      bookMesh.position.set(-2.6, 0.11 + i * 0.23, -1.8);
      bookMesh.rotation.y = 0.15 * (i + 1);
      bookMesh.castShadow = true;
      this.scene.add(bookMesh);
    }

    // Yellow Speaker Box (Right background)
    const speakerGroup = new THREE.Group();
    speakerGroup.position.set(2.6, 0.8, -1.8);

    const boxGeo = new THREE.BoxGeometry(1.2, 1.6, 0.9);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xebaf3c, roughness: 0.4 });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.castShadow = true;
    speakerGroup.add(boxMesh);

    // Speaker Cone Circle
    const coneGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.05, 32);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3 });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.rotation.x = Math.PI / 2;
    coneMesh.position.set(0, 0.1, 0.46);
    speakerGroup.add(coneMesh);

    this.scene.add(speakerGroup);
  }

  initEventListeners() {
    // 1. Microphone Action Button
    this.micBtn.addEventListener('click', () => this.handleMicToggle());

    // 3. Voice FX Button & Dropdown
    this.voiceFxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.voicePickerDropdown.classList.toggle('hidden');
    });

    document.querySelectorAll('.voice-option').forEach((option) => {
      option.addEventListener('click', (e) => {
        document.querySelectorAll('.voice-option').forEach((opt) => opt.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');

        const pitch = target.getAttribute('data-pitch');
        this.audioEngine.setPitch(pitch);
        this.voicePickerDropdown.classList.add('hidden');
      });
    });

    document.addEventListener('click', () => {
      this.voicePickerDropdown.classList.add('hidden');
    });

    // Interactive Drag-to-Rotate Touch & Mouse Controls on Canvas
    let isDragging = false;
    let previousMouseX = 0;

    const onPointerDown = (e) => {
      isDragging = true;
      previousMouseX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const deltaX = currentX - previousMouseX;
      previousMouseX = currentX;

      this.cactus.userRotationY += deltaX * 0.008;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    this.canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // Continuous Tapping Particle Burst & Combo Interaction
    let tapComboCount = 0;
    let lastTapTime = 0;

    const handleCactusTap = (clientX, clientY) => {
      const now = performance.now();
      if (now - lastTapTime < 650) {
        tapComboCount++;
      } else {
        tapComboCount = 1;
      }
      lastTapTime = now;

      this.animManager.triggerTapParticleEffect(clientX, clientY, tapComboCount);
    };

    this.canvas.addEventListener('click', (e) => {
      handleCactusTap(e.clientX, e.clientY);
    });

    // 5. Sound Mute Toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.isSoundMuted = !this.isSoundMuted;
      this.soundToggleBtn.style.opacity = this.isSoundMuted ? '0.4' : '1.0';
    });

    // 6. Help Modal
    this.helpBtn.addEventListener('click', () => this.openHelpModal());
    this.closeHelpModalBtn.addEventListener('click', () => this.closeHelpModal());
    this.closeHelpModalX.addEventListener('click', () => this.closeHelpModal());
    this.helpModal.addEventListener('click', (e) => {
      if (e.target === this.helpModal) this.closeHelpModal();
    });

    // 6. Keyboard Input Drawer
    this.sendTextBtn.addEventListener('click', () => {
      const val = this.customTextInput.value.trim();
      if (val) {
        this.processSpeechPhrase(val);
        this.customTextInput.value = '';
        this.textInputDrawer.classList.add('hidden');
      }
    });

    this.customTextInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const val = this.customTextInput.value.trim();
        if (val) {
          this.processSpeechPhrase(val);
          this.customTextInput.value = '';
          this.textInputDrawer.classList.add('hidden');
        }
      }
    });
  }

  async handleMicToggle() {
    if (this.animManager.currentState === STATES.LISTENING) {
      this.stopListeningAndRepeat();
    } else if (this.animManager.currentState === STATES.IDLE) {
      try {
        await this.audioEngine.startRecording(() => {
          if (this.animManager.currentState === STATES.LISTENING) {
            this.stopListeningAndRepeat();
          }
        });

        this.animManager.setState(STATES.LISTENING);
        this.updateUIForListening();
      } catch (err) {
        console.warn('Microphone access denied:', err);
        this.statusText.textContent = 'Mic access needed!';
        this.showSpeechBubble('Please allow microphone access to talk with me! 🎙️');
        setTimeout(() => this.hideSpeechBubble(), 4500);
      }
    }
  }

  async stopListeningAndRepeat() {
    this.animManager.setState(STATES.PROCESSING);
    this.updateUIForProcessing();

    const result = await this.audioEngine.stopRecording();

    setTimeout(() => {
      if (result && result.buffer) {
        this.startCactusRepeat(result.buffer, result.text);
      } else {
        this.processSpeechPhrase('I repeated what you said!');
      }
    }, 400);
  }

  async processSpeechPhrase(text) {
    if (this.animManager.currentState !== STATES.IDLE) return;

    this.animManager.setState(STATES.PROCESSING);
    this.updateUIForProcessing();

    const buffer = await this.audioEngine.synthesizeTextToBuffer(text);

    setTimeout(() => {
      this.startCactusRepeat(buffer, text);
    }, 400);
  }

  startCactusRepeat(buffer, text) {
    this.animManager.setState(STATES.TALKING);
    this.updateUIForTalking();
    this.showSpeechBubble(text);

    if (!this.isSoundMuted) {
      this.audioEngine.playPitchShifted(buffer, () => {
        this.hideSpeechBubble();
        this.animManager.setState(STATES.REACTION, {
          onComplete: () => {
            this.updateUIForIdle();
          },
        });
      });
    } else {
      setTimeout(() => {
        this.hideSpeechBubble();
        this.animManager.setState(STATES.REACTION, {
          onComplete: () => {
            this.updateUIForIdle();
          },
        });
      }, 2000);
    }
  }

  updateUIForListening() {
    this.micSection.classList.add('recording');
    this.micIcon.classList.add('hidden');
    this.stopSquare.classList.remove('hidden');
    this.statusText.textContent = "I'm listening...";
  }

  updateUIForProcessing() {
    this.micSection.classList.remove('recording');
    this.micIcon.classList.remove('hidden');
    this.stopSquare.classList.add('hidden');
    this.statusText.textContent = 'Processing...';
  }

  updateUIForTalking() {
    this.statusText.textContent = 'Cactus repeating...';
  }

  updateUIForIdle() {
    this.micSection.classList.remove('recording');
    this.micIcon.classList.remove('hidden');
    this.stopSquare.classList.add('hidden');
    this.statusText.textContent = 'TAP TO TALK';
  }

  showSpeechBubble(text) {
    this.speechBubbleText.textContent = text;
    this.speechBubble.classList.remove('hidden');
  }

  hideSpeechBubble() {
    this.speechBubble.classList.add('hidden');
  }

  openHelpModal() {
    this.helpModal.classList.remove('hidden');
  }

  closeHelpModal() {
    this.helpModal.classList.add('hidden');
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    this.animManager.update(delta, elapsed);
    this.renderer.render(this.scene, this.camera);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new TalkingCactusApp();
});
