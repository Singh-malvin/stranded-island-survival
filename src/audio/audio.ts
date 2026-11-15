/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Procedural Web Audio API sound & adaptive soundscape engine for Stranded

import type { StepSurface } from '../survival/world.ts';

class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private masterMuffleFilter: BiquadFilterNode | null = null;

  // Ambient sound nodes
  private waveGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private springGain: GainNode | null = null;
  private insectGain: GainNode | null = null;
  private calmPadGain: GainNode | null = null;
  private tensePadGain: GainNode | null = null;

  // 3D spatial panners
  private surfPanner: PannerNode | null = null;
  private campfirePanner: PannerNode | null = null;
  private springPanner: PannerNode | null = null;

  // Biome & closed caption state
  private lastHeartbeatMs: number = 0;
  private lastBirdChirpMs: number = 0;
  private lastCaveDripMs: number = 0;
  private lastCaptionMs: Record<string, number> = {};
  private captionCb: ((text: string) => void) | null = null;
  private isAmbientRunning: boolean = false;

  // Boss Encounter Dynamic Music & Voice
  private bossMusicActive: boolean = false;
  private bossMusicPhase: 1 | 2 | 3 | 'victory' = 1;
  private bossMusicTimer: number | null = null;
  private bossBeatStep: number = 0;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  public setCaptionCallback(cb: ((text: string) => void) | null) {
    this.captionCb = cb;
  }

  public emitCaption(text: string, cooldownMs: number = 4200) {
    if (!this.captionCb || this.isMuted) return;
    const now = performance.now();
    if ((this.lastCaptionMs[text] ?? 0) + cooldownMs > now) return;
    this.lastCaptionMs[text] = now;
    this.captionCb(text);
  }

  public setMuffleLevel(muffle01: number) {
    if (!this.ctx || !this.masterMuffleFilter) return;
    const clamped = Math.max(0, Math.min(1, muffle01));
    const targetHz = 19500 * Math.pow(0.025, clamped); // 19.5kHz clear -> ~490Hz deep underwater/low-HP muffle
    this.masterMuffleFilter.frequency.setTargetAtTime(targetHz, this.ctx.currentTime, 0.08);
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
      this.masterMuffleFilter = this.ctx.createBiquadFilter();
      this.masterMuffleFilter.type = 'lowpass';
      this.masterMuffleFilter.frequency.setValueAtTime(19500, this.ctx.currentTime);
      this.masterMuffleFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.masterMuffleFilter);
      this.masterMuffleFilter.connect(this.ctx.destination);
      this.setupAmbientGenerators();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // Create pink/white noise buffer for rain/wind/waves
  private createNoiseBuffer(durationSeconds: number = 2): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * durationSeconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Filter towards pinkish noise
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    return buffer;
  }

  private setupAmbientGenerators() {
    if (!this.ctx || !this.masterGain) return;

    const noiseBuffer = this.createNoiseBuffer(3);
    if (!noiseBuffer) return;

    // Ocean Waves loop + spatial shoreline panner
    const waveSource = this.ctx.createBufferSource();
    waveSource.buffer = noiseBuffer;
    waveSource.loop = true;

    const waveFilter = this.ctx.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

    this.waveGain = this.ctx.createGain();
    this.waveGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    this.surfPanner = this.ctx.createPanner();
    this.surfPanner.panningModel = 'equalpower';
    this.surfPanner.distanceModel = 'inverse';
    this.surfPanner.refDistance = 8;
    this.surfPanner.maxDistance = 95;
    this.surfPanner.rolloffFactor = 0.85;

    waveSource.connect(waveFilter);
    waveFilter.connect(this.waveGain);
    this.waveGain.connect(this.surfPanner);
    this.surfPanner.connect(this.masterGain);
    waveSource.start();

    // Slow LFO for ocean wave swells (period ~7s)
    const waveLfo = this.ctx.createOscillator();
    waveLfo.type = 'sine';
    waveLfo.frequency.setValueAtTime(0.14, this.ctx.currentTime);
    const waveLfoGain = this.ctx.createGain();
    waveLfoGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    waveLfo.connect(waveLfoGain);
    waveLfoGain.connect(this.waveGain.gain);
    waveLfo.start();

    // Rain loop
    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.setValueAtTime(900, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    rainSource.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    rainSource.start();

    // Wind loop
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
    windFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

    windSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    windSource.start();

    // Fire crackle noise + spatial campfire panner
    const fireSource = this.ctx.createBufferSource();
    fireSource.buffer = noiseBuffer;
    fireSource.loop = true;

    const fireFilter = this.ctx.createBiquadFilter();
    fireFilter.type = 'bandpass';
    fireFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    fireFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.fireGain = this.ctx.createGain();
    this.fireGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.campfirePanner = this.ctx.createPanner();
    this.campfirePanner.panningModel = 'equalpower';
    this.campfirePanner.distanceModel = 'inverse';
    this.campfirePanner.refDistance = 3.5;
    this.campfirePanner.maxDistance = 38;
    this.campfirePanner.rolloffFactor = 1.2;

    fireSource.connect(fireFilter);
    fireFilter.connect(this.fireGain);
    this.fireGain.connect(this.campfirePanner);
    this.campfirePanner.connect(this.masterGain);
    fireSource.start();

    // Freshwater spring trickle loop + spatial spring panner
    const springSource = this.ctx.createBufferSource();
    springSource.buffer = noiseBuffer;
    springSource.loop = true;
    const springFilter = this.ctx.createBiquadFilter();
    springFilter.type = 'bandpass';
    springFilter.frequency.setValueAtTime(1950, this.ctx.currentTime);
    springFilter.Q.setValueAtTime(2.6, this.ctx.currentTime);
    this.springGain = this.ctx.createGain();
    this.springGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.springPanner = this.ctx.createPanner();
    this.springPanner.panningModel = 'equalpower';
    this.springPanner.distanceModel = 'inverse';
    this.springPanner.refDistance = 4;
    this.springPanner.maxDistance = 42;
    this.springPanner.rolloffFactor = 1.15;
    springSource.connect(springFilter);
    springFilter.connect(this.springGain);
    this.springGain.connect(this.springPanner);
    this.springPanner.connect(this.masterGain);
    springSource.start();

    // Night crickets / coastal insect chorus (chirp-modulated high carrier)
    const cricketCarrier = this.ctx.createOscillator();
    cricketCarrier.type = 'sine';
    cricketCarrier.frequency.setValueAtTime(3850, this.ctx.currentTime);
    const cricketHarmony = this.ctx.createOscillator();
    cricketHarmony.type = 'sine';
    cricketHarmony.frequency.setValueAtTime(4380, this.ctx.currentTime);

    const cricketBias = this.ctx.createConstantSource();
    cricketBias.offset.setValueAtTime(0.5, this.ctx.currentTime);
    const cricketLfo = this.ctx.createOscillator();
    cricketLfo.type = 'sine';
    cricketLfo.frequency.setValueAtTime(14.5, this.ctx.currentTime);
    const cricketLfoDepth = this.ctx.createGain();
    cricketLfoDepth.gain.setValueAtTime(0.45, this.ctx.currentTime);

    const cricketGate = this.ctx.createGain();
    cricketGate.gain.setValueAtTime(0, this.ctx.currentTime);
    cricketBias.connect(cricketGate.gain);
    cricketLfo.connect(cricketLfoDepth);
    cricketLfoDepth.connect(cricketGate.gain);

    this.insectGain = this.ctx.createGain();
    this.insectGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    cricketCarrier.connect(cricketGate);
    cricketHarmony.connect(cricketGate);
    cricketGate.connect(this.insectGain);
    this.insectGain.connect(this.masterGain);
    cricketCarrier.start();
    cricketHarmony.start();
    cricketBias.start();
    cricketLfo.start();

    // Adaptive ambient music pad: warm coastal Dsus2 (calm) vs dark D tritone/minor (tense)
    const calmFilter = this.ctx.createBiquadFilter();
    calmFilter.type = 'lowpass';
    calmFilter.frequency.setValueAtTime(420, this.ctx.currentTime);
    this.calmPadGain = this.ctx.createGain();
    this.calmPadGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    [146.83, 220.0, 329.63].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
      osc.connect(calmFilter);
      osc.start();
    });
    calmFilter.connect(this.calmPadGain);
    this.calmPadGain.connect(this.masterGain);

    const tenseFilter = this.ctx.createBiquadFilter();
    tenseFilter.type = 'lowpass';
    tenseFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
    this.tensePadGain = this.ctx.createGain();
    this.tensePadGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    [73.42, 103.83, 155.56].forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
      osc.connect(tenseFilter);
      osc.start();
    });
    tenseFilter.connect(this.tensePadGain);
    this.tensePadGain.connect(this.masterGain);

    this.isAmbientRunning = true;
  }

  private playHeartbeatPulse(intensity: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    [0, 0.17].forEach((offset, beatIdx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(beatIdx === 0 ? 58 : 48, t + offset);
      osc.frequency.exponentialRampToValueAtTime(28, t + offset + 0.14);
      const peak = (beatIdx === 0 ? 0.34 : 0.24) * intensity;
      gain.gain.setValueAtTime(peak, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + offset);
      osc.stop(t + offset + 0.18);
    });
  }

  // Update continuous ambient volumes based on player state, weather, and danger tension
  public updateAmbience(params: {
    distanceToOcean: number; // in pixels
    rainIntensity: number; // 0 to 1
    windSpeed: number; // 0 to 1
    nearCampfire: boolean;
    isNight?: boolean;
    inCave?: boolean;
    tenseFactor?: number; // 0 to 1
    health?: number; // 0 to 100
    hypothermia?: boolean;
  }) {
    if (!this.ctx || !this.isAmbientRunning) return;
    const t = this.ctx.currentTime;

    // Ocean volume rises when closer to beach/coast
    if (this.waveGain) {
      const caveMuffle = params.inCave ? 0.35 : 1;
      const oceanTarget = Math.max(0.05, Math.min(0.35, 1 - params.distanceToOcean / 1200)) * caveMuffle;
      this.waveGain.gain.setTargetAtTime(oceanTarget, t, 0.5);
    }

    // Rain volume
    if (this.rainGain) {
      const rainTarget = params.rainIntensity * (params.inCave ? 0.14 : 0.35);
      this.rainGain.gain.setTargetAtTime(rainTarget, t, 0.4);
    }

    // Wind volume
    if (this.windGain) {
      const windTarget = 0.05 + params.windSpeed * 0.25;
      this.windGain.gain.setTargetAtTime(windTarget, t, 0.5);
    }

    // Campfire crackle
    if (this.fireGain) {
      const fireTarget = params.nearCampfire ? 0.22 : 0.0;
      this.fireGain.gain.setTargetAtTime(fireTarget, t, 0.3);
    }

    // Night coastal insect chorus (hushed by heavy rain or deep caves)
    if (this.insectGain) {
      const clearNight = params.isNight && !params.inCave && params.rainIntensity < 0.35;
      const insectTarget = clearNight ? 0.024 * (1 - params.rainIntensity) : 0.0;
      this.insectGain.gain.setTargetAtTime(insectTarget, t, 0.8);
    }

    // Adaptive calm vs tense background music underscore
    const tension = Math.max(0, Math.min(1, params.tenseFactor ?? (params.isNight ? 0.55 : 0.1)));
    if (this.calmPadGain) {
      const calmTarget = Math.max(0.008, (1 - tension) * 0.032);
      this.calmPadGain.gain.setTargetAtTime(calmTarget, t, 1.2);
    }
    if (this.tensePadGain) {
      const tenseTarget = Math.max(0, tension - 0.18) * 0.034;
      this.tensePadGain.gain.setTargetAtTime(tenseTarget, t, 1.0);
    }

    // Low-health / hypothermia heartbeat pulse
    const hp = params.health ?? 100;
    const dangerPulse = hp < 38 || Boolean(params.hypothermia);
    if (dangerPulse) {
      const urgency = Math.max(params.hypothermia ? 0.55 : 0, Math.min(1, (38 - hp) / 30));
      const beatIntervalMs = 980 - urgency * 360;
      const nowMs = performance.now();
      if (nowMs - this.lastHeartbeatMs >= beatIntervalMs) {
        this.lastHeartbeatMs = nowMs;
        this.playHeartbeatPulse(0.45 + urgency * 0.55);
      }
    }
  }

  // One-shot procedural sound effects
  public playChop() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Woody impact thump + click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 110 + Math.random() * 25;
    osc.frequency.setValueAtTime(baseFreq * 2.2, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.06);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  public playMine() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Stone clink ping
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const pitch = 480 + Math.random() * 80;
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.7, t + 0.08);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playPickup() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(580, t + 0.07);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  public playCraft() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Two pleasant upward notes
    [0, 0.08].forEach((delay, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 330 : 495, t + delay);

      gain.gain.setValueAtTime(0.3, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + delay);
      osc.stop(t + delay + 0.16);
    });
  }

  public playDrink() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Liquid gulp
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.09);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.18);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playHurt() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Punchy low grunt/hit
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.2);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  public playThunder() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.emitCaption('[Thunderclap]', 3000);
    const t = this.ctx.currentTime;

    // Low rumble + explosive crack
    const noiseBuffer = this.createNoiseBuffer(1.8);
    if (!noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 1.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
  }

  public playAnimalBite() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.12);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playFoghorn() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Distant twin ship horn
    [0, 1.2].forEach((delay) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(115, t + delay);

      gain.gain.setValueAtTime(0.01, t + delay);
      gain.gain.linearRampToValueAtTime(0.4, t + delay + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.0);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + delay);
      osc.stop(t + delay + 1.05);
    });
  }

  public playVictoryFanfare() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Major triumphant chords
    const notes = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      const delay = idx * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + delay);

      gain.gain.setValueAtTime(0.35, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + delay);
      osc.stop(t + delay + 1.25);
    });
  }

  public playDefeat() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const notes = [220, 207.65, 196.0, 174.61]; // A, G#, G, F descending
    notes.forEach((freq, idx) => {
      const delay = idx * 0.2;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);

      gain.gain.setValueAtTime(0.4, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + delay);
      osc.stop(t + delay + 0.38);
    });
  }

  public playBuild() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Solid carpentry hammer strike
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);

    // Chime after hammer
    setTimeout(() => {
      if (!this.ctx || !this.masterGain || this.isMuted) return;
      const t2 = this.ctx.currentTime;
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, t2);
      gain2.gain.setValueAtTime(0.2, t2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.2);
      osc2.connect(gain2);
      gain2.connect(this.masterGain!);
      osc2.start(t2);
      osc2.stop(t2 + 0.22);
    }, 90);
  }

  /** Warm harbor arrival chord progression played on reaching Port Solis Quay. */
  public playArrivalTheme() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const chords = [
      { delay: 0.0, freqs: [293.66, 369.99, 440.0, 587.33], dur: 1.1 }, // Dmaj
      { delay: 0.9, freqs: [392.0, 493.88, 587.33, 783.99], dur: 1.2 }, // Gmaj
      { delay: 1.9, freqs: [440.0, 554.37, 659.25, 880.0], dur: 1.8 }, // Amaj resolve
    ];
    chords.forEach((chord) => {
      chord.freqs.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + chord.delay);
        gain.gain.setValueAtTime(0.001, t + chord.delay);
        gain.gain.linearRampToValueAtTime(0.09, t + chord.delay + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, t + chord.delay + chord.dur);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t + chord.delay);
        osc.stop(t + chord.delay + chord.dur + 0.05);
      });
    });
  }

  /** Surface-matched footstep foley across sand, jungle grass, basalt stone, water & dock timber. */
  public playStep(surface: StepSurface = 'sand') {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const dur = surface === 'water' ? 0.14 : surface === 'sand' ? 0.08 : 0.06;
    const noiseBuffer = this.createNoiseBuffer(dur);
    if (!noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    if (surface === 'water') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(920, t);
      filter.frequency.exponentialRampToValueAtTime(360, t + dur);
      filter.Q.setValueAtTime(1.5, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    } else if (surface === 'stone') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1750, t);
      filter.Q.setValueAtTime(2.6, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    } else if (surface === 'wood') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(780, t);
      filter.Q.setValueAtTime(2.2, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      const knock = this.ctx.createOscillator();
      const knockGain = this.ctx.createGain();
      knock.type = 'triangle';
      knock.frequency.setValueAtTime(175, t);
      knock.frequency.exponentialRampToValueAtTime(92, t + 0.055);
      knockGain.gain.setValueAtTime(0.11, t);
      knockGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      knock.connect(knockGain);
      knockGain.connect(this.masterGain);
      knock.start(t);
      knock.stop(t + 0.07);
    } else if (surface === 'grass') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(680, t);
      filter.Q.setValueAtTime(1.2, t);
      gain.gain.setValueAtTime(0.075, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    } else {
      // sand
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1150, t);
      gain.gain.setValueAtTime(0.085, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    }

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
  }

  /** Crisp organic chewing / bite crunch sound for eating food. */
  public playEat() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.24);
    if (!buf) return;
    for (let bite = 0; bite < 2; bite++) {
      const start = t + bite * 0.13;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1450 - bite * 220, start);
      filter.Q.setValueAtTime(1.8, start);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(start);
      src.stop(start + 0.1);
    }
  }

  /** Heavy timber crack + leafy crash thud when chopping down a palm/tree. */
  public playWoodCrack() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.75);
    if (buf) {
      const crack = this.ctx.createBufferSource();
      crack.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(980, t);
      f.frequency.exponentialRampToValueAtTime(190, t + 0.35);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.26, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      crack.connect(f);
      f.connect(g);
      g.connect(this.masterGain);
      crack.start(t);
    }
    const thud = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(108, t + 0.38);
    thud.frequency.exponentialRampToValueAtTime(34, t + 0.72);
    tg.gain.setValueAtTime(0.001, t);
    tg.gain.setValueAtTime(0.28, t + 0.38);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.76);
    thud.connect(tg);
    tg.connect(this.masterGain);
    thud.start(t + 0.36);
    thud.stop(t + 0.8);
  }

  /** Flint spark strike + whooshing flame ignition for lighting campfires. */
  public playSparkIgnite() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.45);
    if (buf) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(2800, t);
      f.frequency.exponentialRampToValueAtTime(420, t + 0.42);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      s.connect(f);
      f.connect(g);
      g.connect(this.masterGain);
      s.start(t);
    }
    const tick = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    tick.type = 'triangle';
    tick.frequency.setValueAtTime(2400, t);
    tick.frequency.exponentialRampToValueAtTime(640, t + 0.045);
    tg.gain.setValueAtTime(0.16, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    tick.connect(tg);
    tg.connect(this.masterGain);
    tick.start(t);
    tick.stop(t + 0.06);
  }

  /** Cloth wrapping / tightening rustle for healing bandages & poultices. */
  public playBandageWrap() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.38);
    if (!buf) return;
    for (let i = 0; i < 2; i++) {
      const start = t + i * 0.18;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, start);
      filter.Q.setValueAtTime(1.1, start);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.11, start + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.17);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      src.start(start);
      src.stop(start + 0.18);
    }
  }

  /** Crisp paper unfold rustle when glancing at map or survival journal. */
  public playPaperRustle() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.18);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.setValueAtTime(2100, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    src.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    src.start(t);
  }

  /** Water breaststroke splash pulse while swimming. */
  public playSwimStroke() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.32);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(620, t);
    f.frequency.exponentialRampToValueAtTime(260, t + 0.28);
    f.Q.setValueAtTime(0.95, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    src.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    src.start(t);
  }

  /** Quiet hypothermic shiver breath/teeth chatter cue. */
  public playShiverChatter() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const start = t + i * 0.065;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420 + (i % 2) * 90, start);
      g.gain.setValueAtTime(0.025, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.035);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.04);
    }
  }

  /** Muted dry cough cue when sick from spoiled food or foul water. */
  public playCough() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.26);
    if (!buf) return;
    for (let i = 0; i < 2; i++) {
      const start = t + i * 0.14;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(520 - i * 80, start);
      f.Q.setValueAtTime(2.2, start);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
      src.connect(f);
      f.connect(g);
      g.connect(this.masterGain);
      src.start(start);
      src.stop(start + 0.12);
    }
  }

  /** Spatial 3D audio listener + dynamic biome creatures, cave drips, spring trickle & captions. */
  public updateSpatialAndBiomeAmbience(params: {
    listenerPos: { x: number; y: number; z: number };
    listenerForward: { x: number; y: number; z: number };
    surfPos: { x: number; y: number; z: number };
    springPos: { x: number; y: number; z: number };
    campfirePos: { x: number; y: number; z: number } | null;
    inCave: boolean;
    inForest: boolean;
    isNight: boolean;
    rainIntensity: number;
    nearOcean: boolean;
    health: number;
    underwater: boolean;
  }) {
    if (!this.ctx || !this.isAmbientRunning) return;
    const t = this.ctx.currentTime;

    // 1. Update listener transform
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.setValueAtTime(params.listenerPos.x, t);
      L.positionY.setValueAtTime(params.listenerPos.y, t);
      L.positionZ.setValueAtTime(params.listenerPos.z, t);
      L.forwardX.setValueAtTime(params.listenerForward.x, t);
      L.forwardY.setValueAtTime(params.listenerForward.y, t);
      L.forwardZ.setValueAtTime(params.listenerForward.z, t);
      L.upX.setValueAtTime(0, t);
      L.upY.setValueAtTime(1, t);
      L.upZ.setValueAtTime(0, t);
    }

    // 2. Position 3D panners
    const setPan = (p: PannerNode | null, pos: { x: number; y: number; z: number }) => {
      if (!p) return;
      if (p.positionX) {
        p.positionX.setValueAtTime(pos.x, t);
        p.positionY.setValueAtTime(pos.y, t);
        p.positionZ.setValueAtTime(pos.z, t);
      } else {
        p.setPosition(pos.x, pos.y, pos.z);
      }
    };
    setPan(this.surfPanner, params.surfPos);
    setPan(this.springPanner, params.springPos);
    if (params.campfirePos) {
      setPan(this.campfirePanner, params.campfirePos);
    }

    if (this.springGain) {
      const dx = params.listenerPos.x - params.springPos.x;
      const dz = params.listenerPos.z - params.springPos.z;
      const dSpring = Math.hypot(dx, dz);
      const springTarget = Math.max(0, 1 - dSpring / 34) * (params.inCave ? 0.04 : 0.14);
      this.springGain.gain.setTargetAtTime(springTarget, t, 0.35);
    }

    // 3. Muffle master audio when underwater or critically wounded
    const hpMuffle = params.health < 32 ? ((32 - params.health) / 32) * 0.55 : 0;
    const totalMuffle = params.underwater ? 0.96 : hpMuffle;
    this.setMuffleLevel(totalMuffle);

    // 4. Procedural daytime forest bird chirps & cave water drips
    const nowMs = performance.now();
    if (
      !this.isMuted &&
      !params.underwater &&
      !params.isNight &&
      !params.inCave &&
      params.inForest &&
      params.rainIntensity < 0.35 &&
      nowMs - this.lastBirdChirpMs > 3400 + Math.random() * 4800
    ) {
      this.lastBirdChirpMs = nowMs;
      this.playBirdChirp();
      this.emitCaption('[Tropical Birds Chirping]', 8500);
    } else if (
      !this.isMuted &&
      !params.underwater &&
      params.inCave &&
      nowMs - this.lastCaveDripMs > 2600 + Math.random() * 3400
    ) {
      this.lastCaveDripMs = nowMs;
      this.playCaveDrip();
      this.emitCaption('[Cave Water Drip]', 7000);
    }

    // 5. Environmental closed captions
    if (!this.isMuted) {
      if (params.underwater) {
        this.emitCaption('[Submerged Muffled Water]', 5000);
      } else if (params.campfirePos) {
        const dc = Math.hypot(
          params.listenerPos.x - params.campfirePos.x,
          params.listenerPos.z - params.campfirePos.z
        );
        if (dc < 8) this.emitCaption('[Campfire Crackling]', 9500);
      } else if (params.nearOcean) {
        this.emitCaption('[Ocean Surf Breaking]', 11000);
      }
    }
  }

  private playBirdChirp() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < notes; i++) {
      const start = t + i * 0.11;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const f0 = 2400 + Math.random() * 900;
      osc.frequency.setValueAtTime(f0, start);
      osc.frequency.exponentialRampToValueAtTime(f0 * (1.22 + Math.random() * 0.15), start + 0.045);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.92, start + 0.085);
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.042, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.095);
    }
  }

  private playCaveDrip() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const base = 980 + Math.random() * 440;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.48, t + 0.065);
    g.gain.setValueAtTime(0.065, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  /** Explicit public heartbeat cue for critical health/oxygen distress. */
  public playHeartbeat(intensity: number = 0.7) {
    this.initContext();
    this.playHeartbeatPulse(Math.max(0.15, Math.min(1.2, intensity)));
    this.emitCaption('[Heavy Heartbeat]', 5000);
  }

  /** Sharp wood + stone snap when a tool's durability hits zero. */
  public playToolBreak() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.emitCaption('[Tool Shattered!]', 2000);
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.32);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(1600, t);
      f.Q.setValueAtTime(1.4, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.38, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      src.connect(f);
      f.connect(g);
      g.connect(this.masterGain);
      src.start(t);
    }
    [320, 195].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.045);
      osc.frequency.exponentialRampToValueAtTime(65, t + i * 0.045 + 0.14);
      g.gain.setValueAtTime(0.28, t + i * 0.045);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.045 + 0.15);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t + i * 0.045);
      osc.stop(t + i * 0.045 + 0.16);
    });
  }

  /** Heavy water plunge splash when entering deep water or surfacing. */
  public playSplash(intensity: number = 0.85) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.emitCaption('[Water Splash]', 3200);
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.45);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(920, t);
    f.frequency.exponentialRampToValueAtTime(240, t + 0.42);
    f.Q.setValueAtTime(0.85, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
    src.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    src.start(t);
  }

  // -------------------------------------------------------------------------
  // BOSS FIGHT SOUND EFFECTS, ECHOING VOICE & PHASE-REACTIVE MUSIC
  // -------------------------------------------------------------------------

  public setBossMusicState(active: boolean, phase: 1 | 2 | 3 | 'victory' = 1) {
    const phaseChanged = this.bossMusicPhase !== phase;
    this.bossMusicActive = active;
    this.bossMusicPhase = phase;
    if (!active || phaseChanged) {
      if (this.bossMusicTimer !== null && typeof window !== 'undefined') {
        window.clearInterval(this.bossMusicTimer);
        this.bossMusicTimer = null;
      }
      if (!active) return;
    }
    this.initContext();
    if (this.bossMusicTimer === null && typeof window !== 'undefined') {
      this.bossBeatStep = 0;
      const tickMs = phase === 3 ? 210 : phase === 2 ? 250 : phase === 'victory' ? 380 : 300;
      this.bossMusicTimer = window.setInterval(() => this.triggerBossMusicStep(), tickMs);
    }
  }

  private triggerBossMusicStep() {
    if (!this.bossMusicActive || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const step = this.bossBeatStep++;

    if (this.bossMusicPhase === 'victory') {
      if (step % 4 === 0) {
        const chord = step % 8 === 0 ? [261.63, 329.63, 392.0] : [293.66, 369.99, 440.0];
        chord.forEach((f) => {
          const o = this.ctx!.createOscillator();
          const g = this.ctx!.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, t);
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(0.045, t + 0.18);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
          o.connect(g);
          g.connect(this.masterGain!);
          o.start(t);
          o.stop(t + 1.2);
        });
      }
      return;
    }

    const phase = this.bossMusicPhase;
    // Deep war-drum pulse on downbeats
    if (step % 2 === 0 || (phase >= 2 && step % 4 === 3)) {
      const drum = this.ctx.createOscillator();
      const dg = this.ctx.createGain();
      drum.type = 'triangle';
      const pitch = step % 4 === 0 ? 92 : 66;
      drum.frequency.setValueAtTime(pitch, t);
      drum.frequency.exponentialRampToValueAtTime(34, t + 0.19);
      dg.gain.setValueAtTime(phase === 3 ? 0.22 : 0.16, t);
      dg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      drum.connect(dg);
      dg.connect(this.masterGain);
      drum.start(t);
      drum.stop(t + 0.24);
    }

    // D minor / Dorian menacing bass ostinato
    const scale = [73.42, 87.31, 98.0, 110.0, 116.54, 130.81];
    const pat = phase === 3 ? [0, 0, 4, 2, 0, 5, 4, 1] : [0, -1, 1, 2, 0, -1, 4, 3];
    const noteIdx = pat[step % pat.length];
    if (noteIdx >= 0) {
      const bass = this.ctx.createOscillator();
      const fil = this.ctx.createBiquadFilter();
      const bg = this.ctx.createGain();
      bass.type = 'sawtooth';
      bass.frequency.setValueAtTime(scale[noteIdx], t);
      fil.type = 'lowpass';
      fil.frequency.setValueAtTime(phase === 3 ? 620 : 380, t);
      bg.gain.setValueAtTime(0.085, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
      bass.connect(fil);
      fil.connect(bg);
      bg.connect(this.masterGain);
      bass.start(t);
      bass.stop(t + 0.25);
    }

    // Phase 2/3 tension shimmer high stabs
    if (phase >= 2 && step % 4 === 2) {
      const lead = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lead.type = 'triangle';
      lead.frequency.setValueAtTime(phase === 3 ? 587.33 : 440.0, t);
      lg.gain.setValueAtTime(0.045, t);
      lg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      lead.connect(lg);
      lg.connect(this.masterGain);
      lead.start(t);
      lead.stop(t + 0.3);
    }
  }

  public playMeleeSlash(isHeavy: boolean = false) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(isHeavy ? 0.28 : 0.16);
    if (buf) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(isHeavy ? 620 : 980, t);
      f.frequency.exponentialRampToValueAtTime(220, t + (isHeavy ? 0.26 : 0.15));
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(isHeavy ? 0.28 : 0.19, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (isHeavy ? 0.27 : 0.16));
      s.connect(f);
      f.connect(g);
      g.connect(this.masterGain);
      s.start(t);
    }
  }

  public playHeavyImpact(isStagger: boolean = false) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = isStagger ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(isStagger ? 190 : 140, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.28);
    g.gain.setValueAtTime(0.36, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(t);
    o.stop(t + 0.32);
  }

  public playParryBlock(parried: boolean = false) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    [parried ? 1320 : 620, parried ? 1980 : 410].forEach((freq) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.65, t + 0.18);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g);
      g.connect(this.masterGain!);
      o.start(t);
      o.stop(t + 0.22);
    });
  }

  public playDodgeRoll() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.24);
    if (!buf) return;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(550, t);
    f.frequency.exponentialRampToValueAtTime(160, t + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    s.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    s.start(t);
  }

  public playBowShoot() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(125, t + 0.14);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(t);
    o.stop(t + 0.18);
  }

  public playFlareShoot() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(760, t);
    o.frequency.exponentialRampToValueAtTime(190, t + 0.28);
    g.gain.setValueAtTime(0.26, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(t);
    o.stop(t + 0.32);
  }

  public playExplosionBlast() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.emitCaption('[Explosion!]', 2600);
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.75);
    if (buf) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(840, t);
      f.frequency.exponentialRampToValueAtTime(95, t + 0.72);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.45, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.74);
      s.connect(f);
      f.connect(g);
      g.connect(this.masterGain);
      s.start(t);
    }
    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.55);
    sg.gain.setValueAtTime(0.42, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    sub.connect(sg);
    sg.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.6);
  }

  public playAuraCast() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    [220, 330, 660].forEach((freq, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = i === 0 ? 'sawtooth' : 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 1.45, t + 0.45);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.52);
      o.connect(g);
      g.connect(this.masterGain!);
      o.start(t);
      o.stop(t + 0.55);
    });
  }

  public playCrystalShatter() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.emitCaption('[Aura Crystal Shatters!]', 2400);
    const t = this.ctx.currentTime;
    [1480, 1960, 2640].forEach((freq, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t + i * 0.04);
      o.frequency.exponentialRampToValueAtTime(freq * 0.42, t + i * 0.04 + 0.35);
      g.gain.setValueAtTime(0.16, t + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.38);
      o.connect(g);
      g.connect(this.masterGain!);
      o.start(t + i * 0.04);
      o.stop(t + i * 0.04 + 0.4);
    });
  }

  /** Deep echoing voice synthesis + cavern sub-bass boom + Web Speech API + captions. */
  public playBossVoice(line: string, durationMs: number = 3400) {
    this.emitCaption(`THE AURA KING: "${line}"`, durationMs);
    this.initContext();
    if (!this.isMuted && this.ctx && this.masterGain) {
      const t = this.ctx.currentTime;
      // Echoing sovereign formant resonance bed
      [68, 102, 136].forEach((f, idx) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = idx === 0 ? 'sawtooth' : 'triangle';
        o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * 0.86, t + 1.4);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(idx === 0 ? 0.09 : 0.055, t + 0.14);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.55);
        o.connect(g);
        g.connect(this.masterGain!);
        o.start(t);
        o.stop(t + 1.6);
      });
    }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && !this.isMuted) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(line);
        utter.pitch = 0.52;
        utter.rate = 0.82;
        utter.volume = 0.9;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      // Headless or speech-blocked fallback handled seamlessly by WebAudio + subtitles
    }
  }

  private introEngineOsc: OscillatorNode | null = null;
  private introEngineGain: GainNode | null = null;

  public setIntroEngineDrone(intensity: number) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    if (this.isMuted || intensity <= 0.01) {
      if (this.introEngineGain) {
        this.introEngineGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
      }
      return;
    }
    if (!this.introEngineOsc || !this.introEngineGain) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 64;
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      gain.gain.value = 0.0001;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      this.introEngineOsc = osc;
      this.introEngineGain = gain;
    }
    this.introEngineOsc.frequency.setTargetAtTime(62 + intensity * 38, this.ctx.currentTime, 0.25);
    this.introEngineGain.gain.setTargetAtTime(
      Math.min(0.11, intensity * 0.085),
      this.ctx.currentTime,
      0.2
    );
  }

  public stopIntroEngineDrone() {
    if (this.ctx && this.introEngineGain) {
      this.introEngineGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
    }
    try {
      this.introEngineOsc?.stop((this.ctx?.currentTime ?? 0) + 0.15);
    } catch {
      // Ignore already-stopped oscillator
    }
    this.introEngineOsc = null;
    this.introEngineGain = null;
  }

  public playIntroCue(
    cue: 'chime' | 'thunder' | 'oxygen' | 'alarm' | 'spark' | 'breakup' | 'impact' | 'wakeup'
  ) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (cue === 'chime') {
      [587.33, 783.99].forEach((freq, i) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t + i * 0.22);
        g.gain.setValueAtTime(0.12, t + i * 0.22);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.22 + 0.55);
        o.connect(g);
        g.connect(this.masterGain!);
        o.start(t + i * 0.22);
        o.stop(t + i * 0.22 + 0.6);
      });
    } else if (cue === 'thunder') {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(92, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 1.15);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(t);
      o.stop(t + 1.3);
    } else if (cue === 'oxygen') {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(1180, t);
      o.frequency.exponentialRampToValueAtTime(420, t + 0.28);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(t);
      o.stop(t + 0.36);
    } else if (cue === 'alarm') {
      [0, 0.34, 0.68].forEach((off) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(740, t + off);
        o.frequency.setValueAtTime(520, t + off + 0.14);
        g.gain.setValueAtTime(0.08, t + off);
        g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.28);
        o.connect(g);
        g.connect(this.masterGain!);
        o.start(t + off);
        o.stop(t + off + 0.3);
      });
    } else if (cue === 'spark') {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1950, t);
      o.frequency.exponentialRampToValueAtTime(240, t + 0.12);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(t);
      o.stop(t + 0.15);
    } else if (cue === 'breakup' || cue === 'impact') {
      const dur = cue === 'impact' ? 1.4 : 0.85;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(cue === 'impact' ? 115 : 165, t);
      o.frequency.exponentialRampToValueAtTime(26, t + dur);
      g.gain.setValueAtTime(cue === 'impact' ? 0.28 : 0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(t);
      o.stop(t + dur + 0.05);
    } else if (cue === 'wakeup') {
      // Gentle wave crest swell on Palm Cove beach
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(110, t);
      o.frequency.linearRampToValueAtTime(145, t + 1.2);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(t);
      o.stop(t + 2.5);
    }
  }

  public playStoryCue(
    cue: 'rifle' | 'harpoon' | 'cleave' | 'shrine' | 'stealth_alert' | 'jail_lock' | 'sight_pulse' | 'boat_shatter'
  ) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    if (cue === 'rifle') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1120, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.16);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    } else if (cue === 'harpoon') {
      o.type = 'triangle';
      o.frequency.setValueAtTime(360, t);
      o.frequency.exponentialRampToValueAtTime(75, t + 0.22);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    } else if (cue === 'cleave' || cue === 'boat_shatter') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(cue === 'boat_shatter' ? 140 : 280, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.65);
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.68);
    } else if (cue === 'shrine') {
      o.type = 'sine';
      o.frequency.setValueAtTime(440, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.55);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
    } else if (cue === 'stealth_alert') {
      o.type = 'square';
      o.frequency.setValueAtTime(520, t);
      o.frequency.linearRampToValueAtTime(780, t + 0.18);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    } else if (cue === 'jail_lock') {
      o.type = 'square';
      o.frequency.setValueAtTime(220, t);
      o.frequency.setValueAtTime(135, t + 0.08);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    } else {
      o.type = 'sine';
      o.frequency.setValueAtTime(640, t);
      o.frequency.exponentialRampToValueAtTime(320, t + 0.35);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    }
    o.connect(g);
    g.connect(this.masterGain);
    o.start(t);
    o.stop(t + 0.72);
  }
}

export const audio = new AudioManager();
