// Capture rings: a ring on the ground round each location at its capture radius, so the zone to stand in is plain to see.
// It takes the holder's colour (BLUFOR blue, OPFOR red, as the HUD), solid while the place is held and dashed, in the taking
// side's colour, while a side is capturing or draining it; a place nobody holds and nobody is taking wears a faint grey
// ring. Each ring is built once per match with its vertices on the ground (the height query at every point, a little
// above it), so it lies on a hill as it does on a field.
import { hexToLinear } from '../core/math.js';
import { Mesh } from './scene.js';

const COLOUR = { 0: 0x7fb2e5, 1: 0xe86a5a, n: 0xd8d4c8 }, LIFT = 0.35, WIDTH = 0.45, SEGS = 120, DASHES = 24;   // a thin line: it is a hint, not a wall
const mat = (hex, alpha) => ({ color: [...hexToLinear(hex), alpha], tex: null, emissive: [0, 0, 0], unlit: true, cast: false });
export class Rings {
  constructor(scene, renderer, heightAt) {
    this.scene = scene; this.renderer = renderer; this.heightAt = heightAt; this.match = null; this.items = [];
    this.mats = { solid: { 0: mat(COLOUR[0], 0.7), 1: mat(COLOUR[1], 0.7), n: mat(COLOUR.n, 0.3) }, dash: { 0: mat(COLOUR[0], 0.8), 1: mat(COLOUR[1], 0.8), n: mat(COLOUR.n, 0.3) } };
    this.on = true;
  }
  // a ring's geometry round (x, z) at radius r: `dashes` arcs (1 for a solid ring), each covering 60% of its share, as a
  // flat strip WIDTH wide whose vertices sit LIFT over the ground; local to the mesh at (x, 0, z)
  geometry(key, x, z, r, dashes) {
    const v = [], idx = [], per = Math.max(4, Math.round(SEGS / dashes)), fill = dashes > 1 ? 0.6 : 1;
    for (let d = 0; d < dashes; d++) {
      const a0 = d / dashes * Math.PI * 2, span = fill * Math.PI * 2 / dashes, base = v.length / 8;
      for (let s = 0; s <= per; s++) {
        const t = a0 + span * s / per, cs = Math.cos(t), sn = Math.sin(t);
        for (const rr of [r + WIDTH / 2, r - WIDTH / 2]) { const px = x + cs * rr, pz = z + sn * rr; v.push(cs * rr, this.heightAt(px, pz) + LIFT, sn * rr, 0, 1, 0, 0.5, 0.5); }
      }
      for (let s = 0; s < per; s++) { const a = base + s * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    return this.renderer.registerGeometry(key, { data: new Float32Array(v), idx: new Uint16Array(idx), count: idx.length });
  }
  attach(match) {
    for (const it of this.items) { this.scene.remove(it.solid); this.scene.remove(it.dash); }
    this.items = []; this.match = match;
    const list = match && match.objectives ? match.objectives.list : [], name = match && match.world && match.world.map ? match.world.map.name : 'map';
    for (const l of list) {
      const solid = new Mesh(this.geometry(`capring:${name}:${l.index}:solid`, l.x, l.z, l.r, 1), this.mats.solid.n), dash = new Mesh(this.geometry(`capring:${name}:${l.index}:dash`, l.x, l.z, l.r, DASHES), this.mats.dash.n);
      for (const m of [solid, dash]) { m.position.set(l.x, 0, l.z); m.bound = l.r + 2; m.visible = false; this.scene.add(m); }
      this.items.push({ loc: l, solid, dash });
    }
  }
  update(match) {
    if (match !== this.match) this.attach(match);
    for (const { loc, solid, dash } of this.items) {
      const taking = loc.pushing >= 0 ? loc.pushing : -1, held = loc.owner;
      const dashed = this.on && taking >= 0, solidOn = this.on && !dashed;
      dash.visible = dashed; solid.visible = solidOn;
      if (dashed) dash.mat = this.mats.dash[taking];
      else if (solidOn) solid.mat = held >= 0 ? this.mats.solid[held] : this.mats.solid.n;
    }
  }
}
