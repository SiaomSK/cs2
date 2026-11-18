import type { WeaponId } from './types';

class TacticalAudio {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public muted = false;
  private lastStepTime = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const len = this.ctx.sampleRate * 1.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public playShot(weaponId: WeaponId, distanceAttenuation = 1): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || distanceAttenuation <= 0.03) return;
    const now = ctx.currentTime;
    const vol = Math.min(1, distanceAttenuation);

    if (weaponId === 'knife') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(600, now + 0.12);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.15);
      return;
    }

    // Noise burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    const nGain = ctx.createGain();

    // Punch oscillator
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();

    const pitchJitter = 0.94 + Math.random() * 0.12;

    if (weaponId === 'usp') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200 * pitchJitter, now);
      filter.Q.value = 1.4;
      nGain.gain.setValueAtTime(0.22 * vol, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.06);
      oGain.gain.setValueAtTime(0.16 * vol, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    } else if (weaponId === 'awp') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800 * pitchJitter, now);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.45);
      nGain.gain.setValueAtTime(0.55 * vol, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(175 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.28);
      oGain.gain.setValueAtTime(0.42 * vol, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    } else if (weaponId === 'ak47' || weaponId === 'deagle') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3400 * pitchJitter, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + 0.18);
      nGain.gain.setValueAtTime(0.36 * vol, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.11);
      oGain.gain.setValueAtTime(0.28 * vol, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    } else {
      // M4A4, MP9, Glock
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3600 * pitchJitter, now);
      filter.frequency.exponentialRampToValueAtTime(520, now + 0.13);
      nGain.gain.setValueAtTime(0.28 * vol, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.08);
      oGain.gain.setValueAtTime(0.22 * vol, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    }

    noise.connect(filter).connect(nGain).connect(ctx.destination);
    osc.connect(oGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.55);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playHitmarker(headshot: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (headshot) {
      // Classic crisp helmet "dink"
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2450, now);
      osc.frequency.exponentialRampToValueAtTime(1650, now + 0.09);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.045);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    }
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playFootstep(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    if (now - this.lastStepTime < 0.28) return;
    this.lastStepTime = now;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340 + Math.random() * 110;
    filter.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.08);
  }

  public playReload(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.22].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 520 : 780, now + offset);
      gain.gain.setValueAtTime(0.08, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.04);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.05);
    });
  }

  public playBuy(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1180, now + 0.05);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playBombBeep(urgent = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(urgent ? 2950 : 2400, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playExplosion(distanceAttenuation = 1): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const vol = Math.max(0.15, Math.min(1, distanceAttenuation));

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.85);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.95);
  }

  public playRoundEnd(win: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = win ? [440, 554.37, 659.25] : [330, 293.66, 220];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.11);
      gain.gain.setValueAtTime(0.12, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.36);
    });
  }
}

export const tacticalAudio = new TacticalAudio();
