// Synthesized sound effects for Shadow Vault. Everything is WebAudio
// oscillators and noise: no audio files, no network. Safe to construct
// in Node (no AudioContext there): every call becomes a no-op.

function makeContext() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  return new AC();
}

/** Tiny synth: footsteps, alert stings, pickups, coin clinks, jingles. */
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  /** Create/resume the context on a user gesture. Never throws. */
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = makeContext();
        if (!this.ctx) return;
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.25;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, dur, type = 'sine', volume = 0.5, slideTo = null) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    try {
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur);
    } catch {
      // Audio is decoration: never break the game.
    }
  }

  noiseBurst(dur, volume = 0.3, lowpass = 1200) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    } catch {
      // Audio is decoration: never break the game.
    }
  }

  /** Soft footstep tick; pitch alternates left/right. */
  footstep(sneaking, alternate) {
    if (sneaking) {
      this.noiseBurst(0.05, 0.08, 500);
    } else {
      this.tone(alternate ? 150 : 120, 0.06, 'triangle', 0.18);
    }
  }

  /** Rising two-note sting when the alarm trips. */
  alarm() {
    this.tone(440, 0.16, 'square', 0.3, 660);
    setTimeout(() => this.tone(660, 0.22, 'square', 0.3, 880), 140);
  }

  /** Short blip when a shard is collected. */
  pickup() {
    this.tone(880, 0.1, 'sine', 0.4, 1320);
  }

  /** Metallic clink when a coin lands. */
  coinClink() {
    this.tone(1900, 0.07, 'triangle', 0.3, 1500);
    setTimeout(() => this.tone(2400, 0.09, 'triangle', 0.25), 70);
  }

  /** Soft tick while a guard grows suspicious. */
  suspiciousTick() {
    this.tone(520, 0.08, 'sine', 0.22);
  }

  /** Little arpeggio for a cleared level. */
  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.16, 'sine', 0.35), i * 110);
    });
  }

  /** Low thud when the player is caught. */
  caught() {
    this.tone(180, 0.35, 'sawtooth', 0.35, 60);
  }
}
