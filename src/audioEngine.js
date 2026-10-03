export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordedBuffer = null;
    
    this.micStream = null;
    this.micAnalyser = null;
    this.playbackAnalyser = null;

    this.pitchMultiplier = 1.45; // Default funny high pitch

    // Speech Recognition
    this.recognition = null;
    this.transcribedText = '';

    // Silence detection variables
    this.isRecording = false;
    this.hasSpoken = false;
    this.silenceStartTime = 0;
    this.silenceThreshold = 0.03; // Audio level threshold for silence

    // Callbacks
    this.onSilenceDetected = null;
    this.onSpeechTranscript = null;

    this.initSpeechRecognition();
  }

  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setPitch(pitch) {
    this.pitchMultiplier = parseFloat(pitch);
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          this.transcribedText = transcript.trim();
          if (this.onSpeechTranscript) {
            this.onSpeechTranscript(this.transcribedText);
          }
        }
      };

      this.recognition.onerror = (err) => {
        console.warn('Speech recognition warning:', err);
      };
    }
  }

  async startRecording(onSilenceCallback) {
    this.ensureAudioContext();
    this.onSilenceDetected = onSilenceCallback;
    this.recordedChunks = [];
    this.recordedBuffer = null;
    this.transcribedText = '';
    this.hasSpoken = false;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.warn('Microphone access denied or error:', err);
      throw new Error('Microphone access denied');
    }

    // Set up Live Audio Analyser for Silence & Level Detection
    const micSource = this.audioCtx.createMediaStreamSource(this.micStream);
    this.micAnalyser = this.audioCtx.createAnalyser();
    this.micAnalyser.fftSize = 512;
    micSource.connect(this.micAnalyser);

    // MediaRecorder setup
    this.mediaRecorder = new MediaRecorder(this.micStream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(100);
    this.isRecording = true;
    this.silenceStartTime = performance.now();

    // Start Speech Recognition if available
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        // Recognition might already be running
      }
    }
  }

  getLiveMicLevel() {
    if (!this.isRecording || !this.micAnalyser) return 0;
    const dataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);
    this.micAnalyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length / 255;

    // Check for speech activity & silence detection
    if (avg > this.silenceThreshold) {
      this.hasSpoken = true;
      this.silenceStartTime = performance.now();
    } else if (this.hasSpoken) {
      const durationSilent = performance.now() - this.silenceStartTime;
      if (durationSilent > 1400 && this.onSilenceDetected) {
        // Auto stop after 1.4s of silence
        this.onSilenceDetected();
      }
    }

    return avg;
  }

  stopRecording() {
    return new Promise((resolve) => {
      if (!this.isRecording) {
        resolve(null);
        return;
      }

      this.isRecording = false;

      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch (e) {}
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = async () => {
          // Stop mic track
          if (this.micStream) {
            this.micStream.getTracks().forEach((track) => track.stop());
          }

          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();

          try {
            this.recordedBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            resolve({
              buffer: this.recordedBuffer,
              text: this.transcribedText || 'I repeated what you said!',
            });
          } catch (e) {
            console.warn('Failed to decode recorded audio, creating fallback synthetic buffer:', e);
            resolve({
              buffer: this.createFallbackAudioBuffer('Hello!'),
              text: this.transcribedText || 'Hello!',
            });
          }
        };
        this.mediaRecorder.stop();
      } else {
        resolve(null);
      }
    });
  }

  // Play Pitch-Shifted Audio Buffer with Analyser Output
  playPitchShifted(buffer, onEndedCallback) {
    this.ensureAudioContext();

    if (!buffer) {
      if (onEndedCallback) onEndedCallback();
      return;
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;

    // Pitch shift achieved via playbackRate modifier
    source.playbackRate.value = this.pitchMultiplier;

    // Analyser Node for Lip-sync & visualizer during playback
    this.playbackAnalyser = this.audioCtx.createAnalyser();
    this.playbackAnalyser.fftSize = 512;

    source.connect(this.playbackAnalyser);
    this.playbackAnalyser.connect(this.audioCtx.destination);

    source.onended = () => {
      if (onEndedCallback) onEndedCallback();
    };

    source.start(0);
  }

  getPlaybackAudioLevel() {
    if (!this.playbackAnalyser) return 0;
    const dataArray = new Uint8Array(this.playbackAnalyser.frequencyBinCount);
    this.playbackAnalyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length / 255;
  }

  // Synthesizes Text to Audio Buffer (Speech Synthesis fallback or quick preset phrases)
  async synthesizeTextToBuffer(text) {
    this.ensureAudioContext();
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.pitch = 1.3;
        utterance.rate = 1.1;

        // Since SpeechSynthesis doesn't output directly to Web Audio node in all browsers,
        // we synthesize a funny sound pattern buffer that matches speech length!
        const duration = Math.max(1.2, text.length * 0.08);
        const sampleRate = this.audioCtx.sampleRate;
        const buffer = this.audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
        const channelData = buffer.getChannelData(0);

        // Generate funny synthesized chipmunk vocal harmonics matching phrase
        for (let i = 0; i < channelData.length; i++) {
          const t = i / sampleRate;
          const freq = 440 + Math.sin(t * 12) * 120 + Math.sin(t * 40) * 80;
          const envelope = Math.sin((t / duration) * Math.PI);
          channelData[i] = Math.sin(t * freq * Math.PI * 2) * envelope * 0.4;
        }

        window.speechSynthesis.speak(utterance);
        resolve(buffer);
      } else {
        resolve(this.createFallbackAudioBuffer(text));
      }
    });
  }

  createFallbackAudioBuffer(text) {
    const duration = Math.max(1.2, text.length * 0.07);
    const sampleRate = this.audioCtx.sampleRate;
    const buffer = this.audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const wave = Math.sin(t * 520 * Math.PI * 2) + Math.sin(t * 780 * Math.PI * 2) * 0.5;
      const pulse = Math.sin(t * 15) > 0 ? 1 : 0.2;
      data[i] = wave * pulse * 0.25;
    }
    return buffer;
  }

  // Play Funny Boing / Jump Reaction Sound Effect
  playReactionSound(type) {
    this.ensureAudioContext();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;

    if (type === 'jump') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'spin' || type === 'wiggle') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(220, now + 0.25);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'fall') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.4);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  }
}
