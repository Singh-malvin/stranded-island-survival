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

  // Ambient sound nodes
  private waveGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private insectGain: GainNode | null = null;
  private calmPadGain: GainNode | null = null;
  private tensePadGain: GainNode | null = null;

  private lastHeartbeatMs: number = 0;
  private isAmbientRunning: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
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

    // Ocean Waves loop
    const waveSource = this.ctx.createBufferSource();
    waveSource.buffer = noiseBuffer;
    waveSource.loop = true;

    const waveFilter = this.ctx.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

    this.waveGain = this.ctx.createGain();
    this.waveGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    waveSource.connect(waveFilter);
    waveFilter.connect(this.waveGain);
    this.waveGain.connect(this.masterGain);
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

    // Fire crackle noise
    const fireSource = this.ctx.createBufferSource();
    fireSource.buffer = noiseBuffer;
    fireSource.loop = true;

    const fireFilter = this.ctx.createBiquadFilter();
    fireFilter.type = 'bandpass';
    fireFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    fireFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.fireGain = this.ctx.createGain();
    this.fireGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    fireSource.connect(fireFilter);
    fireFilter.connect(this.fireGain);
    this.fireGain.connect(this.masterGain);
    fireSource.start();

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
}

export const audio = new AudioManager();
