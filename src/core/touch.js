// Touch gestures layered on Input. One finger: drag pans (with a fling), a tap on a
// friendly unit selects it (a vehicle too: Load in the selection panel, then a tap on the vehicle, boards it), a tap
// anywhere else orders the selection there (an enemy: attack-move; our sandbags: man them), a hold does the same and
// boards a vehicle held, and a hold with nothing selected starts a box select. The toolbar's Clear drops the selection. Two fingers: pinch zoom about the
// midpoint, twist to rotate, midpoint drag pans. Three fingers: drag up/down to tilt.
// Pens follow the one-finger rules. Camera changes made by gestures apply at once
// (no smoothing) so the ground stays under the fingers.
const HOLD_MS = 450, SLOP = 10, PICK_RADIUS = 14, STOP_MS = 120;

export class TouchInput {
  constructor(input) {
    this.input = input; this.app = input.app; this.rts = input.rts; this.canvas = input.canvas;
    this.pts = new Map();              // pointerId -> { x, y, x0, y0, t0 }
    this.gesture = null;               // 'drag' | 'box' | 'multi'
    this.hold = null; this.dragging = false; this.boxArmed = false; this.boxFrom = null;
    this.vel = { x: 0, z: 0 }; this.lastMoveT = 0; this.lastTap = null; this.hinted = false; this.doubleMs = 400;
    // the settings panel's "Tap orders" (hud.js), remembered in the browser, ?taps=0 for a link: off, a tap or a hold on the map gives
    // no order (a tap still selects a unit of ours; Load, Advance and the wheel's "Here" still take their tap)
    this.tapOrders = true; try { this.tapOrders = localStorage.getItem('pixelops.taps') !== '0'; } catch {} if (new URLSearchParams(location.search).get('taps') === '0') this.tapOrders = false;
    this.flingStop = false;  // this touch began on a moving map: it stops the fling and is never a tap (the tap to stop a glide used to order the selection there)
    this.ring = document.getElementById('hold');
    const stop = (e) => e.preventDefault();
    this.canvas.addEventListener('touchstart', stop, { passive: false });   // Safari: no double-tap zoom, callouts or page pinch
    this.canvas.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('gesturestart', stop);
  }

  norm(x, y) { const r = this.canvas.getBoundingClientRect(); return [(x - r.left) / r.width, (y - r.top) / r.height]; }
  ground(x, y) { const [nx, ny] = this.norm(x, y); return this.rts.screenToGround(nx, ny); }
  plane(x, y, h) { const [nx, ny] = this.norm(x, y); return this.rts.screenToPlane(nx, ny, h); }   // the point under the finger on the level of where the pan began
  get active() { return this.pts.size > 0; }

  onDown(e) {
    if (e.target !== this.canvas) return;
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}   // synthetic events have no active pointer
    const now = performance.now();
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: now });
    if (this.pts.size === 1) this.flingStop = !this.pts.size || Math.abs(this.vel.x) > 2 || Math.abs(this.vel.z) > 2;   // over 2 m/s: the map was still gliding
    this.vel.x = this.vel.z = 0;
    if (this.pts.size === 1) {
      this.gesture = this.boxArmed ? 'box' : 'drag'; this.dragging = false; this.boxFrom = { x: e.clientX, y: e.clientY };
      this.anchor = this.ground(e.clientX, e.clientY);
      this.hold = this.gesture === 'drag' && !this.flingStop && (this.tapOrders || this.deliberate() || !this.input.selected.length) ? { x: e.clientX, y: e.clientY, t0: now, fired: false } : null;   // no hold on a stopped glide; with tap orders off a hold only starts a box select (nothing selected) or completes an armed order
      if (this.hold) this.showRing(e.clientX, e.clientY);
    } else {
      this.cancelHold(); this.gesture = 'multi'; this.multi = this.multiState(); this.multiY = undefined; this.input.box.style.display = 'none';
    }
  }

  onMove(e) {
    const p = this.pts.get(e.pointerId); if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (this.gesture === 'multi') return this.onMulti();
    const d = Math.hypot(p.x - p.x0, p.y - p.y0);
    if (this.hold && !this.hold.fired) { if (d > SLOP) this.cancelHold(); else return; }
    if (this.hold && this.hold.fired && this.gesture !== 'box') return;          // order given: ignore the rest of this touch
    if (this.gesture === 'box') { this.drawBox(this.boxFrom.x, this.boxFrom.y, p.x, p.y); return; }
    if (d <= SLOP && !this.dragging) return;
    // the ground under the finger on the plane of the point the pan began on (anchor.y): across a gorge's rim or a bridge's edge
    // the terrain under the finger leaps 16 m along the view, and a pan that followed it leapt with it and flung the view
    const now = e.timeStamp, g = this.plane(p.x, p.y, this.anchor.y), t = this.rts.target;
    const dx = g.x - this.anchor.x, dz = g.z - this.anchor.z, leap = Math.hypot(dx, dz);
    // most of a screen's width in one event is no finger's move (a fast synthetic swipe in tools/touch-test moves 50 m a step): re-anchor, log, apply nothing
    if (leap > Math.max(60, 0.8 * (this.rts.viewW || 0)) && this.dragging) { this.rts.noteJump('pan', [this.anchor.x, this.anchor.z], [g.x, g.z], leap, `screen ${Math.round(p.x)},${Math.round(p.y)} dt ${Math.round(now - this.lastMoveT)} ms`); this.anchor = g; this.lastMoveT = now; return; }
    t.x -= dx; t.z -= dz; this.rts.follow = null;
    const dt = Math.max(0.004, (now - (this.dragging ? this.lastMoveT : now - 16)) / 1000);
    this.vel.x = this.vel.x * 0.4 - dx / dt * 0.6; this.vel.z = this.vel.z * 0.4 - dz / dt * 0.6;
    const vm = Math.hypot(this.vel.x, this.vel.z); if (vm > 400) { this.rts.noteJump('fling', [t.x, t.z], [t.x, t.z], vm, 'capped to 400 m/s'); this.vel.x *= 400 / vm; this.vel.z *= 400 / vm; }
    this.lastMoveT = now; this.dragging = true;
  }

  onUp(e) {
    const p = this.pts.get(e.pointerId); if (!p) return;
    this.pts.delete(e.pointerId);
    const now = performance.now(), tIn = e.timeStamp;
    if (this.gesture === 'multi') {
      if (this.pts.size >= 2) this.multi = this.multiState();
      else if (this.pts.size === 1) { const q = [...this.pts.values()][0]; this.gesture = 'drag'; this.dragging = true; this.hold = null; this.anchor = this.ground(q.x, q.y); this.vel.x = this.vel.z = 0; }
      else this.gesture = null;
      return;
    }
    const g = this.gesture; this.gesture = null; this.hideRing(); this.input.box.style.display = 'none';
    if (g === 'box') {
      this.boxArmed = false; this.app.hud.syncTouchbar?.();
      const f = this.boxFrom; this.hold = null;
      if (Math.hypot(p.x - f.x, p.y - f.y) > SLOP) this.input.boxSelect(f.x, f.y, p.x, p.y, false); else this.tap(p, now);
      return;
    }
    const fired = this.hold && this.hold.fired; this.hold = null;
    if (!fired && !this.dragging && !this.flingStop) this.tap(p, now);
    this.flingStop = false;
    if (tIn - this.lastMoveT > STOP_MS) this.vel.x = this.vel.z = 0;    // the finger stopped before lifting: no fling
    this.dragging = false;
  }

  // ---- gestures
  multiState() {
    const a = [...this.pts.values()], n = a.length;
    const cx = a.reduce((s, p) => s + p.x, 0) / n, cy = a.reduce((s, p) => s + p.y, 0) / n;
    const dist = Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y), ang = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x);
    return { n, cx, cy, dist, ang };
  }
  onMulti() {
    const prev = this.multi, cur = this.multiState(); this.multi = cur;
    if (!prev || prev.n !== cur.n) return;
    const rts = this.rts, t = rts.target;
    if (cur.n >= 3) { rts.rotateBy(0, (cur.cy - prev.cy) * 0.004); rts.pitch = rts.pitchT; return; }
    // midpoint drag pans, pinch zooms about the midpoint, twist rotates about it
    if (this.multiY === undefined) this.multiY = this.ground(prev.cx, prev.cy).y;   // the plane of the midpoint when the gesture began
    const g0 = this.plane(prev.cx, prev.cy, this.multiY), g1 = this.plane(cur.cx, cur.cy, this.multiY);
    t.x -= g1.x - g0.x; t.z -= g1.z - g0.z; rts.follow = null;
    const z0 = rts.zoomT; rts.zoomBy(cur.dist / Math.max(1, prev.dist)); const ratio = z0 / rts.zoomT;
    t.x += (g1.x - t.x) * (1 - ratio); t.z += (g1.z - t.z) * (1 - ratio);
    let da = cur.ang - prev.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    if (Math.abs(da) < 0.5) {
      rts.yawT += da;
      // keep the midpoint's ground point fixed while yaw changes about the target
      const c = Math.cos(da), s = Math.sin(da), rx = g1.x - t.x, rz = g1.z - t.z;
      t.x = g1.x - (rx * c + rz * s); t.z = g1.z - (rz * c - rx * s);
    }
    rts.zoom = rts.zoomT; rts.yaw = rts.yawT;
  }

  // an order the player armed on purpose, which a tap completes whatever the Tap orders setting says: Load, Advance, the wheel's "Here"
  deliberate() { const inp = this.input; return !!(inp.loading || inp.advancing || inp.picking); }
  tap(p, now) {
    const [nx, ny] = this.norm(p.x, p.y), inp = this.input, me = this.app.playerTeam ?? 0;
    const u = this.app.pick(nx, ny, PICK_RADIUS);
    if (inp.loading) { inp.loadInto(u); if (navigator.vibrate) navigator.vibrate(10); return; }   // after Load the tap picks the vehicle
    if (u && u.team === me && this.lastTap && this.lastTap.u === u && now - this.lastTap.t < this.doubleMs) { inp.selectType(u.type); this.lastTap = null; return; }   // double-tap: all of that type on screen
    this.lastTap = { t: now, u };
    if (!this.tapOrders && !this.deliberate()) { if (u && u.team === me) inp.clickSelect(nx, ny, false, PICK_RADIUS); return; }   // tap orders off: a tap on our own unit selects it (a double-tap its type), anything else is nothing
    // with units selected, a tap off our own units is an order (manning our sandbags counts as one); a tap on one of our
    // vehicles selects it, so a squad's selection never stands in the way of picking the APC
    const man = inp.canMan(u) || inp.canMan(inp.postAt(nx, ny));
    if (inp.selected.length && (!u || u.team !== me || man)) { inp.issueOrder(nx, ny, PICK_RADIUS); if (navigator.vibrate) navigator.vibrate(10); return; }
    inp.clickSelect(nx, ny, false, PICK_RADIUS);
    if (u && u.team === me && !this.hinted) { this.hinted = true; this.app.hud.toast('Tap the ground to move there'); }
  }

  update(dt) {
    const now = performance.now();
    if (this.hold && !this.hold.fired && now - this.hold.t0 >= HOLD_MS) {
      this.hold.fired = true; this.hideRing();
      const [nx, ny] = this.norm(this.hold.x, this.hold.y);
      if (this.input.selected.length) { this.input.issueOrder(nx, ny, PICK_RADIUS); if (navigator.vibrate) navigator.vibrate(10); }
      else { this.gesture = 'box'; this.boxFrom = { x: this.hold.x, y: this.hold.y }; this.app.hud.toast('Drag to box-select'); }
    }
    if (!this.pts.size && (Math.abs(this.vel.x) > 0.3 || Math.abs(this.vel.z) > 0.3)) {
      const t = this.rts.target; t.x += this.vel.x * dt; t.z += this.vel.z * dt;
      const k = Math.pow(0.005, dt); this.vel.x *= k; this.vel.z *= k;   // glide of about v/5 metres
    } else if (!this.pts.size) this.vel.x = this.vel.z = 0;
  }

  // ---- visuals
  showRing(x, y) { const r = this.ring; if (!r) return; r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.remove('on'); void r.offsetWidth; r.classList.add('on'); }
  hideRing() { this.ring?.classList.remove('on'); }
  cancelHold() { this.hold = null; this.hideRing(); }
  drawBox(x0, y0, x1, y1) {
    const b = this.input.box; b.style.display = 'block';
    b.style.left = Math.min(x0, x1) + 'px'; b.style.top = Math.min(y0, y1) + 'px'; b.style.width = Math.abs(x1 - x0) + 'px'; b.style.height = Math.abs(y1 - y0) + 'px';
  }
}
