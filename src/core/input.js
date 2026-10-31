// Mouse + keyboard: LMB click/drag-box selects, RMB click orders, RMB/MMB drag
// rotates/pans, wheel zooms toward the cursor's ground point. Touch and pen
// pointers are handed to TouchInput. Picking is delegated to the back end through
// app.pick(nx, ny, radiusPx).
import { TouchInput } from './touch.js';

export class Input {
  constructor(app) {
    this.app = app; this.canvas = app.canvas; this.rts = app.rts; this.units = app.units; this.hud = app.hud;
    this.selected = []; this.down = null; this.loading = false; this.advancing = false;   // loading: Load was pressed, the next pick is the vehicle to board; advancing: Z was pressed, the next click on the ground is an attack-move
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
    else if (d.button === 2 && !d.moved) this.issueOrder(nx, ny, 0, e.altKey);   // Alt + right-click: an attack-move
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
      if (e.code === 'Escape') { if (this.app.guide && this.app.guide.isOpen) this.app.guide.close(); else if (this.loading) this.startLoad(); else if (this.advancing) this.startAdvance(); else this.select([]); return; }
      if (e.code === 'KeyH') { if (this.app.guide) this.app.guide.toggle(); return; }
      if (e.code === 'F3') { e.preventDefault(); this.hud.toggleDev(); return; }   // the engine panels
      if (e.code === 'KeyR') { this.rts.reset(); return; }
      if (e.code === 'KeyB') { this.hud.action('fob'); return; }
      if (e.code === 'KeyN') { this.hud.action('sandbags'); return; }
      if (e.code === 'KeyX') { this.hud.action('traps'); return; }
      if (e.code === 'KeyT') { this.hud.action('rally'); return; }
      if (e.code === 'KeyU') { this.hud.action('unload'); return; }
      if (e.code === 'KeyL') { this.hud.action('load'); return; }
      if (e.code === 'KeyZ') { this.hud.action('advance'); return; }
      if (e.code === 'KeyO') { this.hud.action('holdfire'); return; }
      if (e.code === 'KeyG') { this.hud.action('emp_hmg'); return; }
      if (e.code === 'KeyJ') { this.hud.action('emp_atgm'); return; }
      if (e.code === 'KeyK') { this.hud.action('emp_mortar'); return; }
      if (e.code === 'KeyM') { this.hud.toggleSound(); return; }
      if (e.code === 'KeyC') { this.hud.action('cancel'); return; }   // stop the selected engineer's build
      if (e.code === 'KeyV') { this.hud.action('refill'); return; }   // the selected supply trucks: home to refill, then back
      const dg = /^Digit([1-9])$/.exec(e.code);   // groups: 1-9 select one (twice: go there), Ctrl or Shift with the number makes one
      if (dg) { e.preventDefault(); const g = +dg[1], R = this.hud.roster; if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) R.assign(g); else if (!R.recall(g)) this.hud.toast(`No group ${g} yet: select units, then Ctrl or Shift + ${g}`); return; }
    }
    down ? this.rts.keys.add(e.code) : this.rts.keys.delete(e.code);
  }

  clickSelect(nx, ny, add, radiusPx = 0) {
    const u = this.app.pick(nx, ny, radiusPx), me = this.app.playerTeam ?? 0;
    if (this.loading) { this.loadInto(u); return; }   // after Load the click picks the vehicle
    if (this.advancing) { this.advancing = false; const g = u && u.team !== me ? u.pos : this.rts.screenToGround(nx, ny); if (this.selected.length) this.orderAt(g.x, g.z, true); else this.hud.showSelection(this.selected); return; }   // after Z the click is the attack-move's goal
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
    const movers = found.filter(u => !u.spec.structure), pick = movers.length ? movers : found;   // a FOB or sandbags only when nothing that moves is in the box
    this.select(add ? [...new Set([...this.selected, ...pick])] : pick);
  }

  // every friendly unit of a type that is on screen (double-tap / double-click)
  selectType(type) {
    const r = this.canvas.getBoundingClientRect(), me = this.app.playerTeam ?? 0;
    const found = this.units.units.filter(u => u.type === type && u.team === me && !u.dead && !u.mounted && (() => { const [sx, sy] = this.rts.worldToScreen(u.pos.x, u.pos.y + 1, u.pos.z, r.width, r.height); return sx >= 0 && sx <= r.width && sy >= 0 && sy <= r.height; })());
    this.select(found); if (found.length) this.hud.toast(`${found.length} ${type}${found.length > 1 ? 's' : ''} on screen`);
  }

  select(list) {
    this.loading = false; this.advancing = false;
    for (const u of this.selected) u.setSelected(false);
    const me = this.app.playerTeam ?? 0;
    this.selected = list.filter(u => !u.dead && u.team === me && !u.spec.naval && !u.afloat);   // landing craft run themselves
    for (const u of this.selected) u.setSelected(true);
    if (this.selected.length && this.app.audio) this.app.audio.ui('select');
    this.hud.showSelection(this.selected);
  }

  issueOrder(nx, ny, radiusPx = 0, advance = false) {
    // right-click (or a hold) on a friendly helicopter, truck or APC with infantry selected: board it; on a sandbag position: man it
    this.loading = false; advance = advance || this.advancing; this.advancing = false;
    const me = this.app.playerTeam ?? 0, hit = this.app.pick(nx, ny, radiusPx);
    const u = !hit || (hit.team === me && !hit.seats && !hit.crew) ? this.postAt(nx, ny) || hit : hit;   // the open middle of a sandbag position counts as the position
    if (this.canBoard(u)) { this.board(u); return; }
    if (this.canMan(u)) {   // a friendly sandbag position: man it, four to a position
      const want = this.selected.filter(s => s.type === 'soldier' && !s.mounted && !s.dead);
      let n = 0, k = 0; for (const s of want) if (s.man(u)) n++;
      if (n) for (const s of want) if (!(s.post && s.post.sb === u)) { const [x, z] = u.localToWorld((k % 3 - 1) * 1.6, -4.4 - 1.4 * (k++ / 3 | 0)); s.order(x, z); }   // the rest wait just behind it
      const slots = u.crew.length;
      this.hud.toast(n ? `Manning ${u.label}: ${n} in${want.length > n ? `, ${want.length - n} wait behind (${slots === 1 ? 'one gunner' : slots + ' slots'})` : ''}` : `${u.label} is fully manned`);
      if (this.app.audio) this.app.audio.ui(n ? 'order' : 'deny'); return;
    }
    if (u && u.team !== me && !u.dead) { this.orderAt(u.pos.x, u.pos.z, advance); return; }   // an enemy under the finger: attack-move onto it
    const g = this.rts.screenToGround(nx, ny); this.orderAt(g.x, g.z, advance);
  }
  // Attack-move (Z or the Advance button): the next click or tap on the ground sends the selection there with infantry
  // stopping to fight whatever comes into their hold range on the way, instead of only what is at close quarters (a plain
  // move walks through fire). Pressing again, or Esc, cancels; Alt + right-click does it in one
  startAdvance() {
    if (!this.selected.some(u => !u.spec.structure)) { this.hud.toast('Select units first'); return; }
    this.advancing = !this.advancing; this.loading = false;
    this.hud.toast(this.advancing ? `Attack-move: ${this.app.touch ? 'tap' : 'click'} the ground` : 'Attack-move cancelled'); this.hud.showSelection(this.selected);
  }
  // the selected soldiers' squads walk to vehicle u and get in
  board(u) {
    const squads = new Set(); let want = 0, far = 0;
    for (const s of this.selected) if (s.type === 'soldier') { if (s.squad) squads.add(s.squad); else if (!s.mounted && !s.dead) { s.board(u); want++; } }
    for (const sq of squads) { const r = sq.board(u); want += r.n; far += r.far; }   // a split squad: only the men near the vehicle go
    const room = u.seats - u.passengers.length;
    u.dropOnArrive = false; u.dropOnLand = false;   // aboard until Unload (U), however often it stops or lands
    this.hud.toast(`Boarding ${u.label}${want > room ? ` (${room} seat${room === 1 ? '' : 's'}; the rest stay)` : ''}${far ? ` (${far} far off stay where they are)` : ''}: ${u.spec.air ? 'fly it, land, then Unload (U)' : 'drive it, then Unload (U)'}`);
  }
  // Load (L or the button): soldiers selected with a vehicle that has room board it at once; otherwise the next tap or click on
  // one of our vehicles is the one they board (pressing Load again, or Esc, cancels)
  startLoad() {
    if (this.loading) { this.loading = false; this.hud.toast('Loading cancelled'); this.hud.showSelection(this.selected); return; }
    if (!this.selected.some(s => s.type === 'soldier' && !s.mounted && !s.dead)) { this.hud.toast('Select soldiers first'); return; }
    const car = this.selected.find(u => this.canBoard(u));
    if (car) { this.loadInto(car); return; }
    this.loading = true; this.hud.toast(`${this.app.touch ? 'Tap' : 'Click'} your APC, truck or helicopter to board it`); this.hud.showSelection(this.selected);
  }
  // the pick after Load: a vehicle of ours with a free seat takes the soldiers and becomes the selection, ready to drive; anything else cancels
  loadInto(u) {
    this.loading = false;
    const L = this.app.match && this.app.match.landing, me = this.app.playerTeam ?? 0;
    if (L && u && u.amphib && u.team === me && !u.dead) {   // men waiting in the well dock go straight aboard an amphibian lying alongside
      const dock = this.selected.filter(s => s.type === 'soldier' && s.afloat && (s.mounted === L.dock || (s.mounted && s.mounted.type === 'craft' && s.mounted.state === 'dock')));   // in the dock, or aboard a craft still in it
      if (dock.length) { const n = L.loadAmphib(u, dock); this.hud.toast(n ? `${n} aboard ${u.label}` : u.passengers.length >= u.seats ? `${u.label} has no free seat` : `${u.label} must be alongside the ship`); this.select([u]); return; }
    }
    if (!this.canBoard(u)) { this.hud.toast(u && u.seats && u.team === (this.app.playerTeam ?? 0) && !u.dead ? `${u.label} has no free seat` : 'Loading cancelled'); this.hud.showSelection(this.selected); return; }
    this.board(u); this.select([u]);
  }
  // a friendly carrier with a free seat, and infantry in the selection to put in it
  canBoard(u) { const me = this.app.playerTeam ?? 0; return !!(u && u.seats && u.team === me && !u.dead && u.passengers.length < u.seats && this.selected.some(s => s.type === 'soldier' && !s.mounted)); }
  // the friendly sandbag position whose footprint holds the ground point under the cursor
  postAt(nx, ny) { const me = this.app.playerTeam ?? 0, g = this.rts.screenToGround(nx, ny); return this.units.units.find(s => s.crew && s.team === me && !s.dead && (([lx, lz]) => Math.abs(lx) < 3.5 && lz > -2.5 && lz < 2.5)(s.worldToLocal(g.x, g.z))) || null; }
  // a friendly sandbag position, and infantry in the selection to man it
  canMan(u) { const me = this.app.playerTeam ?? 0; return !!(u && u.crew && u.team === me && !u.dead && this.selected.some(s => s.type === 'soldier' && !s.mounted)); }
  // Hold fire (O or the button): the selected soldiers' squads stay quiet and hidden, taking no target, until an enemy
  // comes within 20 m or they are fired on, then open up (game/combat.js); pressed again: fire at will
  toggleHoldFire() {
    const sqs = [...new Set(this.selected.filter(u => u.type === 'soldier' && !u.dead).map(u => u.squad || u))];
    if (!sqs.length) { this.hud.toast('Select soldiers'); return; }
    const on = !sqs.every(s => s.setHoldFire ? s.holdingFire : s.holdFire);
    const adv = on && sqs.some(s => (s.members || [s]).some(m => !m.dead && m.advance && m.dest));   // an attack-move under way: hold fire drops it, and the toast says so
    for (const s of sqs) { if (s.setHoldFire) s.setHoldFire(on); else { s.holdFire = on; if (on) s.advance = false; } }
    this.hud.toast(on ? `Holding fire: ${sqs.length} squad${sqs.length > 1 ? 's' : ''}, until an enemy is at 20 m or they are fired on${adv ? ', attack-move off' : ''}` : 'Fire at will'); if (this.app.audio) this.app.audio.ui('order'); this.hud.showSelection(this.selected);
  }
  orderAt(gx, gz, advance = false) {
    if (!this.selected.length) return;
    if (this.selected.every(u => u.spec.structure)) { if (this.app.touch) this.select([]); return; }   // a FOB, sandbags or a gun can't move
    const g = { x: gx, z: gz };
    if (this.units.world.isBlocked(g.x, g.z, 1)) { this.hud.toast('Blocked'); if (this.app.audio) this.app.audio.ui('deny'); return; }
    const squads = new Set(), loose = [];
    for (const u of this.selected) if (!u.spec.structure) u.squad ? squads.add(u.squad) : loose.push(u);
    const all = [...squads, ...loose], n = all.length;
    const cols = Math.ceil(Math.sqrt(n)), gap = loose.some(u => u.spec.air) ? 12 : 7;
    const quiet = advance ? all.filter(t => t.setHoldFire ? t.holdingFire : t.holdFire).length : 0;   // squads holding fire: an attack-move lifts it, and the toast says so
    all.forEach((t, i) => {
      const c = i % cols, rw = Math.floor(i / cols);
      const ox = g.x + (c - (cols - 1) / 2) * gap, oz = g.z + (rw - (Math.ceil(n / cols) - 1) / 2) * gap;
      if (advance) t.advanceTo(ox, oz); else t.order(ox, oz);
      t.dropOnArrive = false;   // the player's passengers stay aboard until Unload (U): a stop on the way is not a drop
      if (t.spec && t.spec.air) { t.dropOnLand = false; t.orbit = { x: ox, z: oz, r: 30 }; }   // a helicopter circles there, door gun firing, until Unload or Land
    });
    this.app.markers.add(g.x, g.z); if (this.app.audio) this.app.audio.ui('order');
    if (this.app.match && this.app.match.voices) this.app.match.voices.ordered(this.selected);
    const moving = this.selected.filter(u => !u.spec.structure).length; this.hud.toast(`${advance ? 'Attack-move' : 'Move order'}: ${moving} unit${moving > 1 ? 's' : ''}${quiet ? ', fire at will' : ''}`);
  }
}
