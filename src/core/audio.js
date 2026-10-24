// Sound. WebAudio, no assets required: one-shots (shots, impacts, explosions, cues)
// are synthesized from filtered noise and tones; helicopters and moving vehicles
// get looping voices; everything positional is attenuated and panned relative to
// the camera target. If sounds/manifest.json exists (clips made with
// tools/make-sounds.mjs via ElevenLabs) those clips replace the synthesized
// one-shots. The context starts on the first pointer or key event.
const RATE = { shot: [10, 0.15], impact: [5, 0.15], hit: [6, 0.15], explosion: [4, 0.3] };   // max voices per window (s)
const KITS = {
  rifle:      { dur: 0.09, lp: [3200, 700], g: 0.45, click: [1800, 200, 0.03] },
  mg:         { dur: 0.06, lp: [2800, 600], g: 0.38, click: [1500, 200, 0.02] },
  medic:      { dur: 0.09, lp: [3200, 700], g: 0.45, click: [1800, 200, 0.03] },
  engineer:   { dur: 0.09, lp: [3200, 700], g: 0.45, click: [1800, 200, 0.03] },
  marksman:   { dur: 0.16, lp: [4200, 500], g: 0.75, click: [2400, 150, 0.04] },
  at:         { dur: 0.6,  lp: [500, 3200], g: 0.55, click: [220, 80, 0.4] },
  autocannon: { dur: 0.16, lp: [1300, 250], g: 0.8,  click: [170, 50, 0.12] },
  doorgun:    { dur: 0.06, lp: [2600, 600], g: 0.4,  click: [1400, 200, 0.02] },
};

export class AudioEngine {
  constructor(app) {
    this.app = app; this.ctx = null; this.master = null; this.noise = null; this.clips = new Map(); this.loops = new Map();
    this.enabled = true; this.volume = 0.7; this.stats = { voices: 0, played: 0, dropped: 0, loops: 0, clips: 0 };
    this.windows = new Map(); this.active = 0;
    try { const s = JSON.parse(localStorage.getItem('pixelops.audio')); if (s) { this.enabled = s.enabled !== false; this.volume = Math.min(1, Math.max(0, +s.volume || 0)); } } catch {}
    const start = () => this.resume();
    for (const t of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(t, start, { passive: true });
  }

  // ---- context ---------------------------------------------------------------
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? this.volume : 0; this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.loadClips();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  async loadClips() {
    try {
      const r = await fetch('sounds/manifest.json', { cache: 'no-store' }); if (!r.ok) return;
      const m = await r.json();
      for (const [name, file] of Object.entries(m.clips || {})) {
        const b = await fetch('sounds/' + file).then(x => x.arrayBuffer()).then(x => this.ctx.decodeAudioData(x)).catch(() => null);
        if (b) { this.clips.set(name, b); this.stats.clips++; }
      }
    } catch {}
  }
  save() { try { localStorage.setItem('pixelops.audio', JSON.stringify({ enabled: this.enabled, volume: this.volume })); } catch {} }
  setEnabled(on) { this.enabled = !!on; if (this.master) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.05); this.save(); }
  setVolume(v) { this.volume = Math.min(1, Math.max(0, v)); if (this.master && this.enabled) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05); this.save(); }
  get ready() { return !!this.ctx && this.enabled && this.ctx.state === 'running'; }

  // ---- positional helpers ----------------------------------------------------
  spatial(x, z) {
    const rts = this.app.rts, t = rts.target, dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz);
    const zoomK = Math.min(1.6, Math.max(0.6, rts.zoom / 3));                              // zoomed in: nearer sounds dominate
    const gain = 1 / (1 + Math.pow(d / (45 / zoomK), 2));
    const { right } = rts.groundAxes(), pan = Math.max(-1, Math.min(1, (dx * right.x + dz * right.z) / 60));
    return { gain, pan, d };
  }
  allow(kind) {
    const [max, win] = RATE[kind] || [8, 0.15], now = this.ctx.currentTime;
    const list = (this.windows.get(kind) || []).filter(t => now - t < win); this.windows.set(kind, list);
    if (list.length >= max || this.active > 48) { this.stats.dropped++; return false; }
    list.push(now); return true;
  }
  out(gain, pan, dur) {
    const ctx = this.ctx, g = ctx.createGain(); g.gain.value = gain;
    let node = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(this.master);
    this.active++; this.stats.played++; this.stats.voices = this.active;
    setTimeout(() => { this.active--; this.stats.voices = this.active; try { g.disconnect(); node.disconnect(); } catch {} }, dur * 1000 + 150);
    return g;
  }
  // filtered noise burst with a lowpass sweep and an amplitude envelope
  burst(dest, dur, lp, gain, hp = 80, attack = 0.004) {
    const ctx = this.ctx, t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(lp[0], t); f.frequency.exponentialRampToValueAtTime(Math.max(40, lp[1]), t + dur);
    const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(h); h.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + dur + 0.02);
  }
  tone(dest, f0, f1, dur, gain, type = 'sine', delay = 0) {
    const ctx = this.ctx, t = ctx.currentTime + delay, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  clip(name, dest, rate = 1) {
    const b = this.clips.get(name); if (!b) return false;
    const src = this.ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate; src.connect(dest); src.start(); return true;
  }

  // ---- one-shots -------------------------------------------------------------
  shot(kit, x, z) {
    if (!this.ready) return; const k = KITS[kit] || KITS.rifle, s = this.spatial(x, z); if (s.gain < 0.02 || !this.allow('shot')) return;
    const dest = this.out(s.gain * k.g, s.pan, k.dur + 0.1);
    if (this.clip(kit, dest, 0.95 + Math.random() * 0.1)) return;
    this.burst(dest, k.dur, k.lp, 1, kit === 'at' ? 60 : 120);
    if (k.click) this.tone(dest, k.click[0], k.click[1], k.click[2], 0.6, kit === 'at' || kit === 'autocannon' ? 'triangle' : 'square');
  }
  explosion(x, z, k = 1) {
    if (!this.ready) return; const s = this.spatial(x, z); if (s.gain < 0.01 || !this.allow('explosion')) return;
    const dest = this.out(Math.min(1, s.gain * 1.4), s.pan, 1.4 * k);
    if (this.clip('explosion', dest, 1 / Math.sqrt(k))) return;
    this.burst(dest, 1.1 * k, [900, 60], 1, 40, 0.01); this.tone(dest, 75, 28, 0.9 * k, 0.8, 'sine');
    this.burst(dest, 0.25, [4000, 1500], 0.5, 300, 0.002);
  }
  impact(x, z) { if (!this.ready) return; const s = this.spatial(x, z); if (s.gain < 0.08 || !this.allow('impact')) return; const dest = this.out(s.gain * 0.14, s.pan, 0.1); if (!this.clip('impact', dest)) this.burst(dest, 0.035, [2600, 900], 1, 400); }
  hit(x, z) { if (!this.ready) return; const s = this.spatial(x, z); if (s.gain < 0.05 || !this.allow('hit')) return; const dest = this.out(s.gain * 0.2, s.pan, 0.1); if (!this.clip('hit', dest)) this.burst(dest, 0.045, [3400, 1200], 1, 500); }

  // UI and match cues (not positional)
  ui(name) {
    if (!this.ready) return;
    const dest = this.out(0.5, 0, 1.2), seq = (notes, dur, gap, type = 'triangle', g = 0.35) => notes.forEach((f, i) => this.tone(dest, f, f, dur, g, type, i * gap));
    if (this.clip(name, dest)) return;
    switch (name) {
      case 'select': this.tone(dest, 880, 880, 0.045, 0.12, 'square'); break;
      case 'order': this.tone(dest, 620, 990, 0.07, 0.18, 'square'); break;
      case 'deny': this.tone(dest, 300, 180, 0.12, 0.2, 'square'); break;
      case 'captured': seq([523, 784], 0.14, 0.12); break;
      case 'lost': seq([784, 523], 0.14, 0.12); break;
      case 'fob': seq([440, 554, 659], 0.12, 0.1); break;
      case 'cache': seq([659, 554, 440], 0.12, 0.1); break;
      case 'start': seq([392, 523, 659, 784], 0.16, 0.12); break;
      case 'win': seq([523, 659, 784, 1047], 0.22, 0.16); break;
      case 'lose': seq([659, 523, 415, 311], 0.22, 0.16); break;
      case 'death': this.burst(dest, 0.12, [600, 150], 0.35, 60); break;
      default: this.tone(dest, 700, 700, 0.05, 0.1);
    }
  }
  // match events from Match.event(); friendly says whose side the player is on
  event(type, friendly) {
    if (type === 'captured') this.ui(friendly ? 'captured' : 'lost');
    else if (type === 'lost') this.ui(friendly ? 'lost' : 'captured');
    else if (type === 'fob') { if (friendly) this.ui('fob'); }
    else if (type === 'cache destroyed') this.ui('cache');
  }

  // ---- loops: rotors and engines, nearest six vehicles ----------------------------
  update(dt) {
    if (!this.ready) return;
    const ctx = this.ctx, now = ctx.currentTime, want = new Map();
    const vehicles = this.app.units.units.filter(u => !u.dead && u.type !== 'soldier' && !u.spec.structure && (u.spec.air ? u.rotor > 0.03 : Math.abs(u.speed) > 0.3))
      .map(u => ({ u, s: this.spatial(u.pos.x, u.pos.z) })).filter(v => v.s.gain > 0.015).sort((a, b) => b.s.gain - a.s.gain).slice(0, 6);
    for (const { u, s } of vehicles) {
      let L = this.loops.get(u);
      if (!L) { L = u.spec.air ? this.rotorVoice() : this.engineVoice(); this.loops.set(u, L); }
      want.set(u, true);
      if (u.spec.air) { const r = u.rotor; L.lfo.frequency.setTargetAtTime(6 + 14 * r, now, 0.1); L.filter.frequency.setTargetAtTime(220 + 500 * r, now, 0.1); L.gain.gain.setTargetAtTime(s.gain * (0.12 + 0.5 * r) * Math.min(1, 0.4 + u.alt / 12), now, 0.08); }
      else { L.osc.frequency.setTargetAtTime(48 + Math.abs(u.speed) * (u.type === 'apc' ? 4 : 6), now, 0.1); L.gain.gain.setTargetAtTime(s.gain * (u.type === 'apc' ? 0.18 : 0.12), now, 0.08); }
      L.pan.pan.setTargetAtTime(s.pan, now, 0.1);
    }
    for (const [u, L] of [...this.loops]) if (!want.has(u)) { L.gain.gain.setTargetAtTime(0, now, 0.08); this.loops.delete(u); setTimeout(() => { try { L.stop(); } catch {} }, 400); }
    this.stats.loops = this.loops.size;
  }
  voiceOut() {
    const ctx = this.ctx, gain = ctx.createGain(); gain.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    gain.connect(pan); pan.connect(this.master); return { gain, pan };
  }
  rotorVoice() {
    const ctx = this.ctx, { gain, pan } = this.voiceOut();
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 400; filter.Q.value = 0.8;
    const chop = ctx.createGain(); chop.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 12; const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    lfo.connect(lfoG); lfoG.connect(chop.gain);
    src.connect(filter); filter.connect(chop); chop.connect(gain); src.start(); lfo.start();
    return { gain, pan, filter, lfo, stop() { src.stop(); lfo.stop(); gain.disconnect(); } };
  }
  engineVoice() {
    const ctx = this.ctx, { gain, pan } = this.voiceOut();
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 60;
    const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 30.5;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 380;
    osc.connect(filter); osc2.connect(filter); filter.connect(gain); osc.start(); osc2.start();
    return { gain, pan, osc, stop() { osc.stop(); osc2.stop(); gain.disconnect(); } };
  }
}
