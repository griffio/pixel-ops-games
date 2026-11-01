// An in-page profiler for a device that cannot be inspected from here (the iPad): ?prof=1 wraps every system the frame runs
// (world, units, the match and its tick systems, dust, markers, rings, audio, input, camera, render with its GL and fog parts,
// the HUD with its roster and minimap) in timers, keeps the rAF frame times and the worst frames with what ran in them, and
// every 15 s posts a window's summary to the Worker's /perf, which writes it to its log (read live with `wrangler tail`).
// A small readout in the corner shows the live numbers, with Copy (the summaries so far, for pasting) and Send buttons.
// Frame time minus the systems' time is "other": the browser, the compositor, a GC pause, or the GPU holding the frame back.
const r1 = (v) => Math.round(v * 10) / 10;
export class Profiler {
  constructor(app, { every = 15 } = {}) {
    this.app = app; this.every = every; this.T = {}; this.prevT = {}; this.MX = {}; this.frames = []; this.worst = []; this.log = []; this.seq = 0;
    this.acc = 0; this.lastNow = null; this.lastPos = null; this.moved = 0; this.zoomMoved = 0; this.lastZoom = null; this.m = null; this.sent = 0; this.id = Math.random().toString(36).slice(2, 8);
    this.wrapAll(); this.overlay();
    addEventListener('pagehide', () => this.flush(true)); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(true); });
  }
  wrap(obj, key, label) {
    if (!obj || typeof obj[key] !== 'function' || obj[key].__prof) return;
    const f = obj[key].bind(obj), T = this.T, MX = this.MX;
    const g = (...args) => { const t = performance.now(); const r = f(...args); const d = performance.now() - t; T[label] = (T[label] || 0) + d; if (!(MX[label] >= d)) MX[label] = d; return r; };
    g.__prof = true; obj[key] = g;
  }
  wrapAll() {
    const a = this.app;
    this.wrap(a.world, 'update', 'world'); this.wrap(a.units, 'update', 'units'); this.wrap(a.dust, 'update', 'dust'); this.wrap(a.markers, 'update', 'markers'); this.wrap(a.rings, 'update', 'rings');
    this.wrap(a.audio, 'update', 'audio'); this.wrap(a.input, 'update', 'input'); this.wrap(a.rts, 'update', 'camera');
    this.wrap(a, 'render', 'render'); this.wrap(a.renderer, 'render', ' gl'); this.wrap(a.fog, 'update', ' fog');
    this.wrap(a.hud, 'update', 'hud'); if (a.hud) { this.wrap(a.hud.roster, 'update', ' roster'); this.wrap(a.hud, 'drawMinimap', ' minimap'); }
  }
  wrapMatch(m) {
    if (m === this.m) return; this.m = m;
    this.wrap(m, 'update', 'match'); this.wrap(m.spatial, 'rebuild', ' spatial'); this.wrap(m.vision, 'tick', ' vision'); this.wrap(m.combat, 'tick', ' combat'); this.wrap(m.respawn, 'tick', ' respawn'); this.wrap(m.rallies, 'tick', ' rallies'); this.wrap(m.support, 'tick', ' support'); this.wrap(m.fobs, 'tick', ' fobs'); this.wrap(m.orders, 'tick', ' orders');
    (m.strategists || []).forEach((s, i) => this.wrap(s, 'tick', ' ai' + i));
  }
  // called at the end of every frame with the rAF timestamp
  frame(now) {
    const a = this.app; if (a.match) this.wrapMatch(a.match);
    if (this.lastNow === null) { this.lastNow = now; return; }
    const ms = now - this.lastNow; this.lastNow = now; if (ms <= 0) return;
    const cur = {}; let sum = 0;
    for (const k in this.T) { const d = this.T[k] - (this.prevT[k] || 0); this.prevT[k] = this.T[k]; if (k[0] !== ' ') sum += d; if (d >= 0.3) cur[k.trim()] = r1(d); }   // top-level systems sum; the indented ones are parts of them
    this.frames.push(ms);
    if (ms > 33) { this.worst.push({ ms: r1(ms), js: r1(sum), top: Object.entries(cur).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => k + ' ' + v) }); if (this.worst.length > 40) { this.worst.sort((x, y) => y.ms - x.ms); this.worst.length = 12; } }
    const p = a.rts.target; if (this.lastPos) this.moved += Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z); this.lastPos = { x: p.x, z: p.z };
    if (this.lastZoom !== null) this.zoomMoved += Math.abs(a.rts.zoom - this.lastZoom); this.lastZoom = a.rts.zoom;
    this.acc += ms; if (this.acc >= this.every * 1000) this.flush(false);
    if ((this.uiAcc = (this.uiAcc || 0) + ms) > 500) { this.uiAcc = 0; this.paint(); }
  }
  summary(final) {
    const a = this.app, R = a.renderer, m = a.match, F = this.frames.slice().sort((x, y) => x - y), n = F.length, q = (p) => n ? r1(F[Math.min(n - 1, Math.floor(p * (n - 1)))]) : 0;
    const total = F.reduce((s, v) => s + v, 0), mean = (k) => n ? r1(this.T[k] / n * 10) / 10 : 0;
    const systems = {}; let js = 0; for (const k of Object.keys(this.T).sort()) { const v = this.T[k] / Math.max(1, n); if (v >= 0.02) systems[k] = [r1(v), r1(this.MX[k] || 0)]; if (k[0] !== ' ') js += v; }
    const dyn = [...R.batches.values()].reduce((s, b) => s + b.n, 0), U = a.units.units;
    const gl = R.gl, dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      id: this.id, seq: this.seq++, final: !!final, at: new Date().toISOString(), seconds: r1(total / 1000),
      frames: { n, fps: n ? Math.round(1000 * n / Math.max(1, total)) : 0, med: q(0.5), p90: q(0.9), p99: q(0.99), max: q(1), over33: F.filter(v => v > 33).length, over50: F.filter(v => v > 50).length, over100: F.filter(v => v > 100).length },
      js: { total: r1(js), other: r1(total / Math.max(1, n) - js) }, systems,
      render: { calls: R.stats.calls, chunks: R.stats.chunks, shadowChunks: R.stats.shadowChunks, wide: !!R.stats.wide, coarse: !!R.useCoarse, shadowSize: R.shadowSize, shadows: R.shadows, pcf: R.pcf, rt: [a.pixel.rtW, a.pixel.rtH], pixelScale: a.pixel.pixelScale, dpr: a.pixel.dpr, dyn, dynBatches: [...R.batches.values()].filter(b => b.n).length, baked: R.stats.baked || 0, canvas: [a.canvas.width, a.canvas.height] },
      scene: { map: a.world.map ? a.world.map.name : null, minute: m ? r1(m.elapsed / 60) : null, alive: U.filter(u => !u.dead).length, units: U.length, structures: U.filter(u => u.spec.structure && !u.dead).length, zoom: r1(a.rts.zoom), panned: Math.round(this.moved), zoomed: r1(this.zoomMoved), fog: !!(a.fog && a.fog.on), paused: !!a.hud.paused, hybrid: m ? m.hybrid || '' : '' },
      device: { ua: navigator.userAgent.slice(0, 120), screen: [screen.width, screen.height], win: [innerWidth, innerHeight], dpr: devicePixelRatio, cores: navigator.hardwareConcurrency || 0, touch: navigator.maxTouchPoints || 0, gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) },
      worst: this.worst.sort((x, y) => y.ms - x.ms).slice(0, 10),
    };
  }
  flush(final) {
    if (!this.frames.length) return;
    const s = this.summary(final); this.log.push(s);
    const body = JSON.stringify(s);
    try { if (!(navigator.sendBeacon && navigator.sendBeacon('/perf', new Blob([body], { type: 'application/json' })))) fetch('/perf', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {}); this.sent++; } catch {}
    this.frames = []; this.worst = []; for (const k in this.T) this.T[k] = 0; for (const k in this.MX) this.MX[k] = 0; this.prevT = {}; this.acc = 0; this.moved = 0; this.zoomMoved = 0;   // reset in place: the wrappers hold these objects
    this.paint();
  }
  overlay() {
    const el = this.el = document.createElement('pre');
    el.style.cssText = 'position:fixed;left:8px;top:64px;z-index:60;margin:0;padding:6px 8px;font:10px/1.35 ui-monospace,Menlo,monospace;color:#e8e2d4;background:rgba(10,12,14,.72);border:1px solid rgba(255,255,255,.15);border-radius:6px;max-width:46vw;white-space:pre-wrap;pointer-events:auto';
    const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:6px;margin-bottom:4px';
    const btn = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'font:11px ui-monospace,Menlo,monospace;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,.3);background:#2a2f36;color:#fff'; b.onpointerdown = (e) => { e.stopPropagation(); }; b.onclick = (e) => { e.stopPropagation(); f(); }; bar.appendChild(b); return b; };
    btn('Send', () => this.flush(false));
    btn('Copy', () => { const txt = JSON.stringify(this.log.concat(this.frames.length ? [this.summary(false)] : [])); const done = () => { this.note = 'copied ' + Math.round(txt.length / 1024) + ' KB'; this.paint(); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => { this.note = 'copy failed'; this.paint(); }); else { this.note = 'no clipboard'; this.paint(); } });
    btn('Hide', () => { el.style.display = 'none'; });
    el.appendChild(bar); this.text = document.createElement('span'); el.appendChild(this.text); document.body.appendChild(el);
  }
  paint() {
    if (!this.text) return;
    const F = this.frames.slice(-120).sort((x, y) => x - y), n = F.length, q = (p) => n ? r1(F[Math.floor(p * (n - 1))]) : 0, R = this.app.renderer;
    const top = Object.entries(this.T).filter(([k]) => k[0] !== ' ').map(([k, v]) => [k, v / Math.max(1, this.frames.length)]).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => `${k} ${r1(v)}`).join('  ');
    this.text.textContent = `prof ${this.id}  sent ${this.sent}  ${this.note || ''}\nlast 2 s: med ${q(0.5)} p90 ${q(0.9)} max ${q(1)} ms   calls ${R.stats.calls} chunks ${R.stats.chunks}/${R.stats.shadowChunks}${R.useCoarse ? ' coarse' : ''}  zoom ${r1(this.app.rts.zoom)}\nms/frame: ${top}`;
  }
}
