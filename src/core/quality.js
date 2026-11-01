// Adaptive quality: when frames stay slow the shadow map drops a step (4096 to 2048 to 1024) and comes back when they
// recover. The measure is the median rAF frame over the last two seconds: over 20 ms at three checks in a row drops a step;
// under 12 ms for twenty seconds restores one; at most one change every 20 s; never in a match's first ten seconds (its
// start has hitches of its own), while paused, or with the page hidden; after two drops straight after a restore it stops
// restoring for the session. ?adapt=0 turns it off. A toast says what changed; the settings panel's buffer line shows the size.
export class Quality {
  constructor(app) { this.app = app; this.base = app.renderer.shadowSize; this.min = 1024; this.ms = []; this.slow = 0; this.t = 0; this.checkAt = 2; this.fastSince = 0; this.lastChange = -Infinity; this.lastRestore = -Infinity; this.bounces = 0; this.changes = []; }
  frame(rawMs) {
    const a = this.app; if (document.hidden || !(rawMs > 0) || rawMs > 1000) return;
    this.t += rawMs / 1000; this.ms.push(rawMs); if (this.ms.length > 180) this.ms.shift();
    if (this.t < this.checkAt) return; this.checkAt = this.t + 2;
    if (!a.match || a.match.state !== 'play' || a.match.elapsed < 10 || (a.hud && a.hud.paused)) { this.slow = 0; this.fastSince = this.t; return; }
    const s = this.ms.slice().sort((x, y) => x - y), med = s[s.length >> 1], R = a.renderer;
    if (med > 20) {
      this.fastSince = this.t;
      if (++this.slow >= 3 && R.shadowSize > this.min && this.t - this.lastChange > 20) { if (this.t - this.lastRestore < 60) this.bounces++; this.step(R.shadowSize / 2, med); }
    } else {
      this.slow = 0;
      if (med >= 12) this.fastSince = this.t;
      else if (R.shadowSize < this.base && this.bounces < 2 && this.t - this.fastSince > 20 && this.t - this.lastChange > 20) { this.lastRestore = this.t; this.step(R.shadowSize * 2, med); }
    }
  }
  step(size, med) {
    const a = this.app; a.renderer.setShadowSize(size); this.lastChange = this.t; this.slow = 0; this.fastSince = this.t; this.ms.length = 0;
    this.changes.push({ t: +this.t.toFixed(0), size, med: +med.toFixed(1) });
    if (a.hud && a.hud.toast) a.hud.toast(size < this.base ? `Shadows ${size}: frames were ${Math.round(med)} ms` : `Shadows back to ${size}`);
  }
}
