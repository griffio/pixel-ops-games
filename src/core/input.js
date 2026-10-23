// Mouse + keyboard: LMB click/drag-box selects, RMB click orders, RMB/MMB drag
// rotates/pans, wheel zooms toward the cursor's ground point. Picking is
// delegated to the back end through app.pick(nx, ny).
export class Input {
  constructor(app) {
    this.app = app; this.canvas = app.canvas; this.rts = app.rts; this.units = app.units; this.hud = app.hud;
    this.selected = []; this.down = null;
    this.box = document.getElementById('selbox');
    const c = this.canvas, rts = this.rts;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => this.onDown(e));
    window.addEventListener('pointermove', e => this.onMove(e));
    window.addEventListener('pointerup', e => this.onUp(e));
    c.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => rts.keys.clear());
    document.addEventListener('mouseleave', () => rts.mouse.set(-1, -1, 0));
  }

  norm(e) { const r = this.canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }

  onDown(e) {
    if (e.target !== this.canvas) return;
    const [nx, ny] = this.norm(e);
    this.down = { button: e.button, x: e.clientX, y: e.clientY, nx, ny, moved: false, ground: this.rts.screenToGround(nx, ny) };
    this.canvas.setPointerCapture?.(e.pointerId);
  }

  onMove(e) {
    const [nx, ny] = this.norm(e); this.rts.mouse.set(nx, ny, 0);
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
    const [nx, ny] = this.norm(e);
    const before = this.rts.screenToGround(nx, ny);
    this.rts.zoomBy(Math.exp(-e.deltaY * 0.0022));
    const ratio = this.rts.pixel.pixelScale / this.rts.zoomT, t = this.rts.target;
    t.x += (before.x - t.x) * (1 - ratio); t.z += (before.z - t.z) * (1 - ratio);
  }

  onKey(e, down) {
    if (e.target.tagName === 'INPUT') return;
    if (down) {
      if (e.code === 'Space') { e.preventDefault(); this.hud.togglePause(); return; }
      if (e.code === 'KeyF') { this.rts.follow = this.selected[0] || null; if (this.rts.follow) this.hud.toast('Following ' + this.rts.follow.label); return; }
      if (e.code === 'Escape') { this.select([]); return; }
      if (e.code === 'KeyR') { this.rts.reset(); return; }
    }
    down ? this.rts.keys.add(e.code) : this.rts.keys.delete(e.code);
  }

  clickSelect(nx, ny, add) {
    const u = this.app.pick(nx, ny), me = this.app.playerTeam ?? 0;
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

  select(list) {
    for (const u of this.selected) u.setSelected(false);
    const me = this.app.playerTeam ?? 0;
    this.selected = list.filter(u => !u.dead && u.team === me);
    for (const u of this.selected) u.setSelected(true);
    this.hud.showSelection(this.selected);
  }

  issueOrder(nx, ny) { const g = this.rts.screenToGround(nx, ny); this.orderAt(g.x, g.z); }
  orderAt(gx, gz) {
    if (!this.selected.length) return;
    const g = { x: gx, z: gz };
    if (this.units.world.isBlocked(g.x, g.z, 1)) { this.hud.toast('Blocked'); return; }
    const squads = new Set(), loose = [];
    for (const u of this.selected) u.squad ? squads.add(u.squad) : loose.push(u);
    const all = [...squads, ...loose], n = all.length;
    const cols = Math.ceil(Math.sqrt(n)), gap = loose.some(u => u.spec.air) ? 12 : 7;
    all.forEach((t, i) => {
      const c = i % cols, rw = Math.floor(i / cols);
      t.order(g.x + (c - (cols - 1) / 2) * gap, g.z + (rw - (Math.ceil(n / cols) - 1) / 2) * gap);
    });
    this.app.markers.add(g.x, g.z);
    this.hud.toast(`Move order: ${this.selected.length} unit${this.selected.length > 1 ? 's' : ''}`);
  }
}
