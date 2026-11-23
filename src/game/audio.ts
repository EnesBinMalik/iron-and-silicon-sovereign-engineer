export class WorkshopAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private lastStepTime = 0;
  private lastBreathTime = 0;
  private lastWeldTime = 0;

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.42;
    this.masterGain.connect(this.ctx.destination);

    // Pre-generate 1.5s organic noise buffer for steam, welding, ice crunch, sparks
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * 1.5), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;

    // Deep industrial workshop bass & bowed string tension layer
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 140;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.06;

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.value = 55; // Deep A1 bass drone

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.value = 82.41; // E2 fifth harmonic

    this.droneOsc1.connect(this.droneFilter);
    this.droneOsc2.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    this.droneOsc1.start();
    this.droneOsc2.start();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateAtmosphere(combatIntensity: number, healthRatio: number): void {
    if (!this.ctx || !this.droneGain || !this.droneFilter) return;
    const now = this.ctx.currentTime;
    const targetGain = 0.05 + combatIntensity * 0.11;
    const targetFreq = 120 + combatIntensity * 260;
    this.droneGain.gain.setTargetAtTime(targetGain, now, 0.25);
    this.droneFilter.frequency.setTargetAtTime(targetFreq, now, 0.25);

    // Diegetic breathing / heartbeat cue when pressure is dangerously low
    if (healthRatio < 0.38 && now - this.lastBreathTime > 0.95) {
      this.lastBreathTime = now;
      this.playHeartbeatAndBreath(1 - healthRatio / 0.38);
    }
  }

  private playHeartbeatAndBreath(severity: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Low thump heartbeat
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(64, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.14);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18 * severity, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);

    // Heavy exhale
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 1.6;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.06 * severity, now + 0.1);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.45);
  }

  public playHammerSwing(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(220, now);
    bp.frequency.exponentialRampToValueAtTime(640, now + 0.14);
    bp.Q.value = 1.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.24);
  }

  public playHammerClang(heavy = false): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Multi-modal anvil/forged steel clang partials
    const partials = heavy ? [185, 312, 540, 890, 1420] : [260, 445, 790, 1280];
    partials.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * (0.97 + Math.random() * 0.06), now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94, now + 0.45);

      const g = this.ctx.createGain();
      const peak = (heavy ? 0.24 : 0.16) / (idx + 1);
      g.gain.setValueAtTime(peak, now);
      g.gain.exponentialRampToValueAtTime(0.0008, now + (heavy ? 0.58 : 0.36));

      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.62);
    });

    // High-voltage arc crackle transient
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(heavy ? 0.26 : 0.16, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    src.connect(hp);
    hp.connect(ng);
    ng.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.18);
  }

  public playFluxPull(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public playFluxThrow(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.2);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 950;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playGrappleZip(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.28);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playWeldTick(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    if (now - this.lastWeldTime < 0.09) return;
    this.lastWeldTime = now;

    // Soldering arc sizzle + mechanical wrench ratchet click
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2800 + Math.random() * 1400;
    bp.Q.value = 2.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.09);

    const click = this.ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(980, now);
    click.frequency.exponentialRampToValueAtTime(220, now + 0.025);
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.06, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    click.connect(cg);
    cg.connect(this.masterGain);
    click.start(now);
    click.stop(now + 0.035);
  }

  public playSteamBurst(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1600, now);
    hp.frequency.exponentialRampToValueAtTime(750, now + 0.55);
    hp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.65);
  }

  public playFootstep(icy: boolean): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStepTime < 0.34) return;
    this.lastStepTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = icy ? 2400 : 420;
    f.Q.value = icy ? 1.8 : 2.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(icy ? 0.07 : 0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.09);
  }

  public playRepairComplete(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [220, 330, 440].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.14, now + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.32);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.34);
    });
  }

  public dispose(): void {
    try {
      this.droneOsc1?.stop();
      this.droneOsc2?.stop();
      void this.ctx?.close();
    } catch {
      // Ignore cleanup errors
    }
    this.ctx = null;
  }
}
