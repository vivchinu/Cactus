import * as THREE from 'three';
import confetti from 'canvas-confetti';

export const STATES = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  TALKING: 'TALKING',
  REACTION: 'REACTION',
};

export class AnimationManager {
  constructor(cactusCharacter, audioEngine) {
    this.character = cactusCharacter;
    this.audioEngine = audioEngine;

    this.currentState = STATES.IDLE;
    this.stateTimer = 0;

    // Random timers for Idle micro-actions
    this.nextBlinkTime = 2.0;
    this.nextLookTime = 3.0;

    // Reaction Animation progress variables
    this.reactionType = null;
    this.reactionProgress = 0;
    this.onReactionComplete = null;

    // Particle FX container element
    this.fxOverlayEl = document.getElementById('fxOverlay');
  }

  setState(newState, data = {}) {
    this.currentState = newState;
    this.stateTimer = 0;

    switch (newState) {
      case STATES.IDLE:
        this.character.setEyeScale(1.0);
        this.character.setMouthOpen(0);
        this.character.setBlink(0);
        this.character.setPupilOffset(0, 0);
        break;

      case STATES.LISTENING:
        this.character.setEyeScale(1.15); // Eyes wide
        this.character.setPupilOffset(0, -0.02); // Focus forward
        this.character.setMouthOpen(0.1);
        break;

      case STATES.PROCESSING:
        this.character.setEyeScale(1.1);
        this.character.setPupilOffset(0, 0.08); // Look upward thinking
        this.character.setBlink(0.5);
        break;

      case STATES.TALKING:
        this.character.setEyeScale(1.05);
        this.character.setPupilOffset(0, 0);
        break;

      case STATES.REACTION:
        this.reactionType = data.type || this.getRandomReactionType();
        this.reactionProgress = 0;
        this.onReactionComplete = data.onComplete || null;
        if (this.audioEngine) {
          this.audioEngine.playReactionSound(this.reactionType);
        }
        this.triggerVisualEffects(this.reactionType);
        break;
    }
  }

  triggerVisualEffects(type) {
    if (!this.fxOverlayEl) return;

    const emojis = {
      jump: '🚀',
      wiggle: '💃',
      lean: '🙃',
      spin: '💫',
      fall: '💥',
      proud: '🌟',
    };
    const emoji = emojis[type] || '🎉';

    const el = document.createElement('div');
    el.className = 'tap-emoji-pop';
    el.textContent = emoji;
    el.style.cssText = `
      position: fixed;
      left: 50%;
      top: 40%;
      transform: translate(-50%, -50%);
      font-size: 56px;
      animation: tapEmojiFloat 0.9s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
      pointer-events: none;
      z-index: 150;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  getRandomReactionType() {
    const reactions = ['jump', 'wiggle', 'lean', 'spin', 'fall', 'proud'];
    return reactions[Math.floor(Math.random() * reactions.length)];
  }

  triggerTapParticleEffect(clientX, clientY, comboCount = 1) {
    // 1. Canvas Confetti Burst at exact tap screen coordinates
    const normX = clientX / window.innerWidth;
    const normY = clientY / window.innerHeight;

    confetti({
      particleCount: Math.min(70, 25 + comboCount * 6),
      spread: Math.min(100, 50 + comboCount * 8),
      origin: { x: normX, y: normY },
      colors: ['#ff60a4', '#4bae81', '#ffd147', '#9eb5f7', '#ff4d6d'],
      ticks: 120,
      gravity: 0.8,
    });

    // 2. Play funny tap sound
    if (this.audioEngine) {
      this.audioEngine.playReactionSound(comboCount > 4 ? 'jump' : 'spin');
    }

    // 3. Floating Emoji & Combo Pop in DOM
    if (this.fxOverlayEl) {
      const emojis = ['✨', '🌟', '🌸', '❤️', '🎉', '😂', '🌵', '💥', '🥳'];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

      const el = document.createElement('div');
      el.className = 'tap-emoji-pop';
      el.textContent = comboCount > 2 ? `${randomEmoji} x${comboCount}!` : randomEmoji;
      el.style.cssText = `
        position: fixed;
        left: ${clientX}px;
        top: ${clientY}px;
        transform: translate(-50%, -50%);
        font-family: 'Fredoka', cursive, sans-serif;
        font-size: ${Math.min(48, 28 + comboCount * 3)}px;
        font-weight: 700;
        color: #ffffff;
        text-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: tapEmojiFloat 0.75s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
        pointer-events: none;
        z-index: 150;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 780);
    }

    // 4. Squishy Bounce Reaction on Cactus Model
    this.character.targetScale.set(1.22, 0.78, 1.22);
    this.character.targetRotation.z += (Math.random() - 0.5) * 0.35;
    this.character.setBlink(1);
    setTimeout(() => {
      this.character.targetScale.set(1, 1, 1);
      this.character.setBlink(0);
    }, 180);

    // If rapid combo threshold reached (> 5 taps), trigger big reaction dance!
    if (comboCount >= 5 && this.currentState === STATES.IDLE) {
      this.setState(STATES.REACTION);
    }
  }

  update(delta, elapsed) {
    this.stateTimer += delta;

    switch (this.currentState) {
      case STATES.IDLE:
        this.updateIdleState(delta, elapsed);
        break;

      case STATES.LISTENING:
        this.updateListeningState(delta, elapsed);
        break;

      case STATES.PROCESSING:
        this.updateProcessingState(delta, elapsed);
        break;

      case STATES.TALKING:
        this.updateTalkingState(delta, elapsed);
        break;

      case STATES.REACTION:
        this.updateReactionState(delta, elapsed);
        break;
    }

    // Always update 3D character lerps & spring transforms
    this.character.update(delta, elapsed);
  }

  updateIdleState(delta, elapsed) {
    // 1. Gentle breathing (Y-scale sine wave)
    const breath = Math.sin(elapsed * 2.2) * 0.025;
    this.character.targetScale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);

    // 2. Small body sway
    const swayZ = Math.sin(elapsed * 1.2) * 0.04;
    const swayY = Math.sin(elapsed * 0.7) * 0.05;
    this.character.targetRotation.set(0, swayY, swayZ);

    // 3. Random Blinking logic
    if (this.stateTimer > this.nextBlinkTime) {
      this.character.setBlink(1);
      setTimeout(() => this.character.setBlink(0), 160);
      this.nextBlinkTime = this.stateTimer + 2.5 + Math.random() * 3.5;
    }

    // 4. Random Pupil Looking logic
    if (this.stateTimer > this.nextLookTime) {
      const offsetX = (Math.random() - 0.5) * 0.12;
      const offsetY = (Math.random() - 0.5) * 0.08;
      this.character.setPupilOffset(offsetX, offsetY);
      this.nextLookTime = this.stateTimer + 3.0 + Math.random() * 4.0;
    }
  }

  updateListeningState(delta, elapsed) {
    // Leans slightly forward towards user
    this.character.targetRotation.set(-0.15, Math.sin(elapsed * 2) * 0.04, 0.06);

    // Live audio level bounce
    const micLevel = this.audioEngine ? this.audioEngine.getLiveMicLevel() : 0;
    const bounce = micLevel * 0.3;
    this.character.targetPosition.set(0, bounce, 0);

    // Ears/head curious movement
    if (micLevel > 0.08) {
      this.character.setEyeScale(1.25);
    } else {
      this.character.setEyeScale(1.15);
    }
  }

  updateProcessingState(delta, elapsed) {
    // Head wobble curiously
    const wobbleZ = Math.sin(elapsed * 15) * 0.08;
    const wobbleY = Math.cos(elapsed * 10) * 0.1;
    this.character.targetRotation.set(-0.08, wobbleY, wobbleZ);
    this.character.targetPosition.set(0, Math.sin(elapsed * 12) * 0.05, 0);
  }

  updateTalkingState(delta, elapsed) {
    const audioLevel = this.audioEngine ? this.audioEngine.getPlaybackAudioLevel() : 0.3;

    // 1. Lip-sync mouth morphing
    const mouthOpen = Math.min(1.0, audioLevel * 2.8 + Math.sin(elapsed * 20) * 0.15);
    this.character.setMouthOpen(mouthOpen);

    // 2. Body bouncing with speech rhythm
    const bounceY = audioLevel * 0.45 + Math.abs(Math.sin(elapsed * 14)) * 0.1;
    this.character.targetPosition.set(0, bounceY, 0);

    // 3. Head & Body animated movements
    const rotZ = Math.sin(elapsed * 12) * (0.12 + audioLevel * 0.15);
    const rotY = Math.cos(elapsed * 9) * 0.2;
    this.character.targetRotation.set(-audioLevel * 0.1, rotY, rotZ);

    // Stretch scale on volume peaks
    this.character.targetScale.set(1 - audioLevel * 0.15, 1 + audioLevel * 0.25, 1 - audioLevel * 0.15);

    // Random pupil eye tracking while talking
    if (Math.random() < 0.08) {
      this.character.setPupilOffset((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.08);
    }
  }

  updateReactionState(delta, elapsed) {
    this.reactionProgress += delta * 1.8; // Duration approx 1.2s

    const t = Math.min(1.0, this.reactionProgress);

    switch (this.reactionType) {
      case 'jump': {
        // Arc jump position + 360 Y spin
        const jumpArc = Math.sin(t * Math.PI) * 1.4;
        this.character.targetPosition.set(0, jumpArc, 0);
        this.character.targetRotation.set(0, t * Math.PI * 2, 0);

        // Squash on landing
        if (t > 0.8) {
          const squash = Math.sin((t - 0.8) * 5 * Math.PI) * 0.25;
          this.character.targetScale.set(1 + squash, 1 - squash, 1 + squash);
        }
        break;
      }

      case 'wiggle': {
        // Fast side-to-side wiggle dance
        const wiggleZ = Math.sin(t * Math.PI * 14) * 0.3 * (1 - t);
        this.character.targetRotation.set(0, 0, wiggleZ);
        this.character.targetPosition.set(0, Math.abs(Math.sin(t * Math.PI * 10)) * 0.2, 0);
        break;
      }

      case 'lean': {
        // Dramatic lean to side, almost tipping over pot
        const leanZ = Math.sin(t * Math.PI) * 0.6;
        this.character.targetRotation.set(0, 0, leanZ);
        break;
      }

      case 'spin': {
        // Quick 360 spin with dizzy pupils
        this.character.targetRotation.set(0, t * Math.PI * 2, 0);
        this.character.setPupilOffset(Math.sin(t * 30) * 0.1, Math.cos(t * 30) * 0.1);
        break;
      }

      case 'fall': {
        // Fall sideways and recover bounce
        if (t < 0.5) {
          const fallT = t / 0.5;
          this.character.targetRotation.set(fallT * 0.8, 0, fallT * 0.5);
          this.character.targetPosition.set(0, -fallT * 0.3, 0);
        } else {
          const recT = (t - 0.5) / 0.5;
          const bounceBack = (1 - recT) * 0.8;
          this.character.targetRotation.set(bounceBack * Math.sin(recT * 10), 0, bounceBack);
          this.character.targetPosition.set(0, 0, 0);
        }
        break;
      }

      case 'proud': {
        // Puff chest, eyes big, flower glowing
        const chestPuff = Math.sin(t * Math.PI) * 0.3;
        this.character.targetScale.set(1 + chestPuff, 1 + chestPuff, 1 + chestPuff);
        this.character.targetRotation.set(-0.2, Math.sin(t * Math.PI * 4) * 0.1, 0);
        break;
      }
    }

    if (t >= 1.0) {
      if (this.onReactionComplete) {
        this.onReactionComplete();
      }
      this.setState(STATES.IDLE);
    }
  }
}

// Add CSS keyframe rule for emoji reaction pop in DOM
const style = document.createElement('style');
style.textContent = `
  @keyframes emojiPopUp {
    0% { transform: scale(0.2) translateY(20px); opacity: 0; }
    40% { transform: scale(1.3) translateY(-30px); opacity: 1; }
    100% { transform: scale(1) translateY(-70px); opacity: 0; }
  }
  @keyframes tapEmojiFloat {
    0% { transform: translate(-50%, -50%) scale(0.4) rotate(0deg); opacity: 0; }
    30% { transform: translate(-50%, -80%) scale(1.2) rotate(-8deg); opacity: 1; }
    100% { transform: translate(-50%, -140%) scale(0.8) rotate(12deg); opacity: 0; }
  }
`;
document.head.appendChild(style);
