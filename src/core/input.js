// Mouse + keyboard: LMB click/drag-box selects, RMB click orders, RMB/MMB drag
// rotates/pans, wheel zooms toward the cursor's ground point. Touch and pen
// pointers are handed to TouchInput. Picking is delegated to the back end through
// app.pick(nx, ny, radiusPx).
import { TouchInput } from './touch.js';

export class Input {
  constructor(app) {
    this.app = app; this.canvas = app.canvas; this.rts = app.rts; this.units = app.units; this.hud = app.hud;
    this.selected = []; this.down = null;
    this.box = document.getElementById('selbox');
    this.touch = new TouchInput(this);
    const c = this.canvas, rts = this.rts, mouse = (e) => e.pointerType === 'mouse';
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => mouse(e) ? this.onDown(e) : this.touch.onDown(e));
    window.addEventListener('pointermove', e => mouse(e) ? this.onMove(e) : this.touch.onMove(e));
    window.addEventListener('pointerup', e => mouse(e) ? this.onUp(e) : this.touch.onUp(e));
    window.addEventListener('pointercancel', e => mouse(e) ? this.onUp(e) : this.touch.onUp(e));
    c.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => rts.keys.clear());
    document.addEventListener('mouseleave', () => rts.mouse.set(-1, -1, 0));
  }

  norm(e) { const r = this.canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
  update(dt) { this.touch.update(dt); }

  onDown(e) {
    if (e.target !== this.canvas) return;
    const [nx, ny] = this.norm(e);
    this.down = { button: e.button, x: e.clientX, y: e.clientY, nx, ny, moved: false, ground: this.rts.screenToGround(nx, ny) };
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}
  }

  onMove(e) {
    const [nx, ny] = this.norm(e); this.rts.mouse.set(nx, ny, 0); this.rts.edgePan = true;   // a real mouse showed up: edge panning is useful again
    const d = this.down; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (!d.moved) return;
    if (d.button === 2) this.rts.rotateBy(-e.movementX * 0.006, e.movementY * 0.004);
    else if (d.button === 1) { const g = this.rts.screenToGround(nx, ny); this.rts.target.sub(g.sub(d.ground)); this.rts.follow = null; }
    else if (d.button === 0) {
      const b = this.box; b.style.display = 'block';
      b.style.left = Math.min(d.x, e.clientX) + 'px'; b.style.top = Math.min(d.y, e.clientY) + 'px';
      b.style.width = Math.abs(dx) + 'px'; b.style.height = Math.abs(dy) + 'px';
    }
  }

  onUp(e) {
    const d = this.down; if (!d) return; this.down = null; this.box.style.display = 'none';
    const [nx, ny] = this.norm(e);
    if (d.button === 0) { d.moved ? this.boxSelect(d.x, d.y, e.clientX, e.clientY, e.shiftKey) : this.clickSelect(nx, ny, e.shiftKey); }
    else if (d.button === 2 && !d.moved) this.issueOrder(nx, ny);
  }

  onWheel(e) {
    e.preventDefault();
    const [nx, ny] = this.norm(e), rts = this.rts, t = rts.target;
    if (rts.follow) { rts.zoomBy(Math.exp(-e.deltaY * 0.0022)); return; }   // following a unit: zoom about it, keep following
    // One anchor per zoom gesture: the ground point under the cursor when the wheel starts. The zoom eases
    // over several frames, so re-anchoring on every tick picks a point that has already slid away from the
    // cursor and the view drifts toward it. The anchor's camera-space offset is fixed, so for any zoom the
    // target that keeps it under the cursor is anchor - offset / zoom (the view width scales with 1 / zoom).
    // The anchor lives until the cursor moves or something else moves the camera (pan, rotate, follow).
    const z = this.zoomAnchor;
    const valid = z && Math.abs(nx - z.nx) < 0.004 && Math.abs(ny - z.ny) < 0.004 && Math.abs(t.x - z.tx) < 1e-6 && Math.abs(t.z - z.tz) < 1e-6 && z.yaw === rts.yawT && z.pitch === rts.pitchT;
    if (!valid) { const a = rts.screenToGround(nx, ny); this.zoomAnchor = { nx, ny, a, ox: (a.x - t.x) * rts.zoom, oz: (a.z - t.z) * rts.zoom, yaw: rts.yawT, pitch: rts.pitchT }; }
    const za = this.zoomAnchor;
    rts.zoomBy(Math.exp(-e.deltaY * 0.0022));
    t.x = za.a.x - za.ox / rts.zoomT; t.z = za.a.z - za.oz / rts.zoomT; za.tx = t.x; za.tz = t.z; rts.follow = null;
  }

  onKey(e, down) {
    if (e.target.tagName === 'INPUT') return;
    if (down) {
      if (e.code === 'Space') { e.preventDefault(); this.hud.togglePause(); return; }
      if (e.code === 'KeyF') { this.rts.follow = this.selected[0] || null; if (this.rts.follow) this.hud.toast('Following ' + this.rts.follow.label); return; }
      if (e.code === 'Escape') { this.select([]); return; }
      if (e.code === 'KeyR') { this.rts.reset(); return; }
      if (e.code === 'KeyB') { this.hud.action('fob'); return; }
      if (e.code === 'KeyN') { this.hud.action('sandbags'); return; }
      if (e.code === 'KeyT') { this.hud.action('rally'); return; }
      if (e.code === 'KeyU') { this.hud.action('unload'); return; }
      if (e.code === 'KeyM') { this.hud.toggleSound(); return; }
    }
    down ? this.rts.keys.add(e.code) : this.rts.keys.delete(e.code);
  }

  clickSelect(nx, ny, add, radiusPx = 0) {
    const u = this.app.pick(nx, ny, radiusPx), me = this.app.playerTeam ?? 0;
    if (u && u.team !== me) { if (this.selected.length) this.orderAt(u.pos.x, u.pos.z); return; }   // click an enemy: attack-move there
    if (!u) { if (!add) this.select([]); return; }
    const set = u.squad ? u.squad.members : [u];
    this.select(add ? [...new Set([...this.selected, ...set])] : set);
  }

  boxSelect(x0, y0, x1, y1, add) {
    const r = this.canvas.getBoundingClientRect();
    const minX = Math.min(x0, x1) - r.left, maxX = Math.max(x0, x1) - r.left, minY = Math.min(y0, y1) - r.top, maxY = Math.max(y0, y1) - r.top;
    const found = this.units.units.filter(u => {
      const [sx, sy] = this.rts.worldToScreen(u.pos.x, u.pos.y + 1, u.pos.z, r.width, r.height);
      return sx >= minX && sx <= maxX && sy >= minY && sy <= maxY;
    });
    this.select(add ? [...new Set([...this.selected, ...found])] : found);
  }

  // every friendly unit of a type that is on screen (double-tap / double-click)
  selectType(type) {
    const r = this.canvas.getBoundingClientRect(), me = this.app.playerTeam ?? 0;
    const found = this.units.units.filter(u => u.type === type && u.team === me && !u.dead && !u.mounted && (() => { const [sx, sy] = this.rts.worldToScreen(u.pos.x, u.pos.y + 1, u.pos.z, r.width, r.height); return sx >= 0 && sx <= r.width && sy >= 0 && sy <= r.height; })());
    this.select(found); if (found.length) this.hud.toast(`${found.length} ${type}${found.length > 1 ? 's' : ''} on screen`);
  }

  select(list) {
    for (const u of this.selected) u.setSelected(false);
    const me = this.app.playerTeam ?? 0;
    this.selected = list.filter(u => !u.dead && u.team === me);
    for (const u of this.selected) u.setSelected(true);
    if (this.selected.length && this.app.audio) this.app.audio.ui('select');
    this.hud.showSelection(this.selected);
  }

  issueOrder(nx, ny, radiusPx = 0) {
    // right-click (or tap) on a friendly helicopter, truck or APC with infantry selected: board it
    const u = this.app.pick(nx, ny, radiusPx), me = this.app.playerTeam ?? 0;
    if (this.canBoard(u)) {
      const squads = new Set(); for (const s of this.selected) if (s.type === 'soldier') (s.squad ? squads.add(s.squad) : s.board(u));
      for (const sq of squads) sq.board(u);
      const want = this.selected.filter(s => s.type === 'soldier' && !s.mounted && !s.dead).length, room = u.seats - u.passengers.length;
      if (u.spec.air) u.dropOnLand = true;
      this.hud.toast(`Boarding ${u.label}${want > room ? ` (${room} seat${room === 1 ? '' : 's'}; the rest stay)` : ''}: ${u.spec.air ? 'fly it and they get out where it lands' : 'drive it and they get out where it stops'}`); return;
    }
    if (u && u.team !== me && !u.dead) { this.orderAt(u.pos.x, u.pos.z); return; }   // an enemy under the finger: attack-move onto it
    const g = this.rts.screenToGround(nx, ny); this.orderAt(g.x, g.z);
  }
  // a friendly carrier with a free seat, and infantry in the selection to put in it
  canBoard(u) { const me = this.app.playerTeam ?? 0; return !!(u && u.seats && u.team === me && !u.dead && u.passengers.length < u.seats && this.selected.some(s => s.type === 'soldier' && !s.mounted)); }
  orderAt(gx, gz) {
    if (!this.selected.length) return;
    const g = { x: gx, z: gz };
    if (this.units.world.isBlocked(g.x, g.z, 1)) { this.hud.toast('Blocked'); if (this.app.audio) this.app.audio.ui('deny'); return; }
    const squads = new Set(), loose = [];
    for (const u of this.selected) u.squad ? squads.add(u.squad) : loose.push(u);
    const all = [...squads, ...loose], n = all.length;
    const cols = Math.ceil(Math.sqrt(n)), gap = loose.some(u => u.spec.air) ? 12 : 7;
    all.forEach((t, i) => {
      const c = i % cols, rw = Math.floor(i / cols);
      t.order(g.x + (c - (cols - 1) / 2) * gap, g.z + (rw - (Math.ceil(n / cols) - 1) / 2) * gap);
    });
    this.app.markers.add(g.x, g.z); if (this.app.audio) this.app.audio.ui('order');
    if (this.app.match && this.app.match.voices) this.app.match.voices.ordered(this.selected);
    this.hud.toast(`Move order: ${this.selected.length} unit${this.selected.length > 1 ? 's' : ''}`);
  }
}
