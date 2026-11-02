import { Mesh, Node } from '../gl/scene.js';
import { sandbagBoxes, emplacementBoxes, trapBoxes, wallBoxes, platformBoxes, PLAT } from './models.js';
import { KINDS } from '../game/buildplan.js';
import { icon } from './icons.js';

// The placement ghost and the build bar (docs/GAME_PLAN.md, B2): a tile picks a structure, a translucent footprint follows
// the mouse (or sits where the last tap landed, on a tablet), green where it may go and red where it may not with the
// reason and the cost beside it; R or the arrows turn it in 15 degree steps from the facing the mode suggests; a click
// (or Place) drops it onto the build plan (game/buildplan.js), where the nearest free engineer picks it up. Queued builds
// keep a dimmer ghost until an engineer starts them; their chips in the bar cancel them.
const $ = (id) => document.getElementById(id);
const OK = { color: [0.45, 0.95, 0.5, 0.42], tex: null, emissive: [0.05, 0.3, 0.08], unlit: true, cast: false, blend: true };
const BAD = { color: [1, 0.35, 0.3, 0.45], tex: null, emissive: [0.3, 0.05, 0.05], unlit: true, cast: false, blend: true };
const QUEUED = { color: [0.9, 0.85, 0.5, 0.3], tex: null, emissive: [0.2, 0.18, 0.05], unlit: true, cast: false, blend: true };
const STEP = Math.PI / 12;
const GLYPH = { sandbags: 'sandbags', hmg: 'hmg', atgm: 'atgm', mortar: 'mortar', traps: 'traps', wall: 'wall', platform: 'platform' };
export class Builder {
  constructor(app) {
    this.app = app; this.active = null; this.ghost = null; this.marks = new Map(); this.mouse = null; this.mouseAt = 0; this.last = null;
    this.el = $('build'); if (!this.el) return;
    this.tiles = this.el.querySelector('.b-tiles'); this.bar = this.el.querySelector('.b-bar'); this.hint = this.el.querySelector('.b-hint'); this.queue = this.el.querySelector('.b-queue');
    this.tiles.innerHTML = Object.entries(KINDS).map(([k, K]) => `<button class="b-tile" data-k="${k}" title="${K.name}: ${K.cost()} supplies, about ${K.time()} s">${icon(GLYPH[k])}<b>${K.name}</b><small>${K.cost()}</small></button>`).join('');
    this.el.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return; e.stopPropagation();
      if (t.dataset.k) this.pick(t.dataset.k); else if (t.dataset.b === 'rotl') this.rotate(-STEP); else if (t.dataset.b === 'rotr') this.rotate(STEP); else if (t.dataset.b === 'place') this.place(); else if (t.dataset.b === 'cancel') this.cancel(); else if (t.dataset.x) this.cancelEntry(+t.dataset.x);
    });
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  get plan() { const m = this.app.match; return m && m.plan; }
  get on() { return !!this.active; }
  // a tile: enter placement for that kind (again on the same tile leaves it)
  pick(kind) {
    if (!this.plan) return;
    if (this.active && this.active.kind === kind) { this.cancel(); return; }
    this.active = { kind, h: null, at: null }; this.last = null;
    for (const b of this.tiles.children) b.classList.toggle('on', b.dataset.k === kind);
    document.body.classList.add('placing');
    const touch = this.app.touch; this.app.hud.toast(touch ? `Tap where the ${KINDS[kind].name.toLowerCase()} go, turn with the arrows, then Place` : `Click where the ${KINDS[kind].name.toLowerCase()} go · R turns`);
    this.update(0);
  }
  cancel() { this.active = null; this.dropGhost(); for (const b of this.tiles.children) b.classList.remove('on'); document.body.classList.remove('placing'); this.hint.textContent = ''; this.renderQueue(); }
  rotate(d) { if (!this.active) return; const c = this.spot(); if (!c) return; if (this.active.h === null) this.active.h = c.h; this.active.h += d; this.update(0); }
  // the mouse moved over the ground (input.onMove); a tap put the ghost somewhere (input.clickSelect / issueOrder)
  hover(nx, ny) { if (!this.active || this.app.touch) return; const g = this.app.rts.screenToGround(nx, ny); this.mouse = [g.x, g.z]; this.mouseAt = performance.now(); }
  tapAt(nx, ny) { if (!this.active) return false; const g = this.app.rts.screenToGround(nx, ny); if (this.app.touch) { this.active.at = [g.x, g.z]; this.update(0); } else { this.mouse = [g.x, g.z]; this.mouseAt = performance.now(); this.place(); } return true; }
  // where the ghost sits: the tap on a tablet, the mouse while it moves, else the middle of the view
  spot() {
    const a = this.active; if (!a) return null; const rts = this.app.rts;
    const p = a.at || (this.mouse && performance.now() - this.mouseAt < 4000 ? this.mouse : [rts.target.x, rts.target.z]);
    return { ...this.plan.check(a.kind, p[0], p[1], a.h), kind: a.kind };
  }
  place() {
    const c = this.spot(); if (!c) return;
    if (!c.ok) { this.app.hud.toast(c.reason); if (this.app.audio) this.app.audio.ui('deny'); return; }
    const r = this.plan.add(c.kind, c.x, c.z, c.h);
    if (!r.ok) { this.app.hud.toast(r.reason); return; }
    this.app.hud.toast(`${KINDS[c.kind].name} planned: ${c.cost} supplies, the nearest engineer is on his way`); if (this.app.audio) this.app.audio.ui('order');
    if (this.app.touch) this.active.at = null;   // the next tap places the next one
    this.renderQueue();
  }
  cancelEntry(id) { const e = this.plan && this.plan.list.find(x => x.id === id); if (e) { this.plan.cancel(e); this.app.hud.toast(`${KINDS[e.kind].name} cancelled`); this.renderQueue(); } }
  // the footprint of a kind at a spot as thin boxes, in one of the three materials
  footprint(kind, x, z, h, mat) {
    const g = new Node(); g.bound = 12; const W = this.app.world, y = W.surfaceAt(x, z);
    const boxes = kind === 'traps' ? trapBoxes(x, z, h) : KINDS[kind].gun ? emplacementBoxes(x, z, h) : kind === 'wall' ? wallBoxes(x, z, h) : kind === 'platform' ? platformBoxes(x, z, h).filter(b => b.leg) : sandbagBoxes(x, z, h);
    for (const b of boxes) { const m = new Mesh('box:1,1,1', mat), w = b.maxX - b.minX, d = b.maxZ - b.minZ, hh = b.h || (kind === 'traps' ? 1.3 : KINDS[kind].gun ? 0.72 : 1.0); m.position.set((b.minX + b.maxX) / 2 - x, hh / 2 + 0.05, (b.minZ + b.maxZ) / 2 - z); m.scale.set(w, hh, d); g.add(m); }
    if (kind === 'platform') { const m = new Mesh('box:1,1,1', mat); m.position.set(0, PLAT.h + 0.1, 0); m.scale.set(PLAT.w, 0.2, PLAT.d); m.rotation.y = h; g.add(m); const l = new Mesh('box:1,1,1', mat); l.position.set(-Math.sin(h) * (PLAT.d / 2 + 0.3), PLAT.h / 2, -Math.cos(h) * (PLAT.d / 2 + 0.3)); l.scale.set(0.8, PLAT.h, 0.2); l.rotation.y = h; g.add(l); }   // the deck, and the ladder at the back for the facing
    if (KINDS[kind].gun) { const m = new Mesh('box:1,1,1', mat); m.position.set(Math.sin(h) * 0.2, 0.6, Math.cos(h) * 0.2); m.scale.set(0.3, 0.3, 1.4); m.rotation.y = h; g.add(m); }   // the gun's barrel, for the facing (a mesh turned by h points the way a unit with heading h faces)
    g.position.set(x, y, z); return g;
  }
  dropGhost() { if (this.ghost) { this.app.units.scene.remove(this.ghost); this.ghost = null; } }
  update(dt) {
    const plan = this.plan; if (!plan) { if (this.ghost) this.dropGhost(); return; }
    if (this.active) {
      const c = this.spot(), key = c && `${c.kind}|${c.x.toFixed(1)}|${c.z.toFixed(1)}|${c.h.toFixed(2)}|${c.ok}`;
      if (c && key !== this.last) { this.last = key; this.dropGhost(); this.ghost = this.footprint(c.kind, c.x, c.z, c.h, c.ok ? OK : BAD); this.app.units.scene.add(this.ghost); }
      if (c) { const t = c.ok ? `${KINDS[c.kind].name} · ${c.cost} supplies · ${Math.round(c.time)} s · facing ${Math.round(((c.h * 180 / Math.PI) % 360 + 360) % 360)}°` : c.reason; if (this.hint.textContent !== t) this.hint.textContent = t; }
    }
    // a dim ghost on each queued build until its engineer starts it
    const want = new Set();
    for (const e of plan.list) { if (e.state === 'building') continue; want.add(e.id); if (!this.marks.has(e.id)) { const g = this.footprint(e.kind, e.x, e.z, e.h, QUEUED); this.app.units.scene.add(g); this.marks.set(e.id, g); } }
    for (const [id, g] of this.marks) if (!want.has(id)) { this.app.units.scene.remove(g); this.marks.delete(id); }
    if ((this.qAcc = (this.qAcc || 0) + dt) > 0.5) { this.qAcc = 0; this.renderQueue(); }
  }
  renderQueue() {
    const plan = this.plan; if (!plan || !this.queue) return;
    const pool = plan.pool(), planned = plan.planned();
    const head = `<div class="b-pool">Supplies <b>${pool}</b>${planned ? ` <small>(${planned} planned)</small>` : ''}</div>`;
    const html = head + plan.list.map(e => `<span class="b-chip ${e.state}">${KINDS[e.kind].name} ${e.state === 'building' ? 'building' : e.state === 'walking' ? (e.why ? e.why : `${e.eng.label} walking`) : 'waiting for an engineer'}<button data-x="${e.id}" title="Cancel">✕</button></span>`).join('');
    if (this.queueHtml !== html) { this.queueHtml = html; this.queue.innerHTML = html; }
  }
}
