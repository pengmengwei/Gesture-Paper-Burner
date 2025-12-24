import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private ctx: AudioContext | null = null;
  private isMusicPlaying = false;
  private nextNoteTimer: any;

  // Initialize AudioContext (must be done after user interaction)
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- Cute Background Music Generator ---
  startMusic() {
    if (this.isMusicPlaying) return;
    this.init();
    this.isMusicPlaying = true;
    this.playNextNote();
  }

  stopMusic() {
    this.isMusicPlaying = false;
    clearTimeout(this.nextNoteTimer);
  }

  private playNextNote() {
    if (!this.isMusicPlaying || !this.ctx) return;

    // Pentatonic Scale (C Majorish): C4, D4, E4, G4, A4, C5
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    const freq = scale[Math.floor(Math.random() * scale.length)];
    const duration = 0.6;
    const time = this.ctx.currentTime;

    // Soft Sine Wave
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    
    // Envelope: Soft Attack, Long Release
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.05, time + 0.1); // Low volume for background
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + duration);

    // Random timing for "natural" feel
    const nextDelay = 400 + Math.random() * 600; 
    this.nextNoteTimer = setTimeout(() => this.playNextNote(), nextDelay);
  }

  // --- Sound Effects ---

  playCrumple() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Filtered noise bursts
    for (let i = 0; i < 3; i++) {
      const start = t + i * 0.05;
      const noise = this.createNoiseBuffer();
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800 + Math.random() * 500;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.1);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      src.start(start);
      src.stop(start + 0.15);
    }
  }

  playBurn() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const duration = 2.5;

    // 1. Rumble (Low frequency noise)
    const noise = this.createNoiseBuffer();
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.linearRampToValueAtTime(100, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.2);
    gain.gain.linearRampToValueAtTime(0, t + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    src.start(t);
    src.stop(t + duration);

    // 2. Crackles (High frequency pops)
    const crackleCount = 30;
    for (let i = 0; i < crackleCount; i++) {
      const crackleTime = t + Math.random() * duration * 0.8;
      this.playCrackle(crackleTime);
    }
  }

  private playCrackle(time: number) {
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 100 + Math.random() * 200;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.02);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.03);
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}