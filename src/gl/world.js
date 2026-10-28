import { WorldState } from '../core/layout.js';
import { groundCanvas } from '../core/textures.js';
import { hexToLinear, smooth } from '../core/math.js';
import { Node, Mesh } from './scene.js';
import { MAT } from './models.js';
import { GROUND_TEXTURES } from '../game/maps/groundTextures.js';
import { stripGeometry, decalGeometry } from './strips.js';

// WebGL2 world: splat-mapped tiled ground, road strips and decals, static props
// baked into chunked instance buffers, lamps. Produces `lightState` for the renderer.
export class World extends WorldState {
  constructor(scene, renderer, map = null) {
    super(map); this.scene = scene; this.renderer = renderer; this.heads = []; this.beams = []; this.marks = []; this.onShake = null; this.focus = { x: 0, z: 0 };
    // ambient emitters (chimneys, steam, mist): their height is above the ground, or absolute with `abs`; ticked by ambient()
    this.emitters = (this.layout.emitters || []).map(e => ({ ...e, y: e.abs !== undefined ? e.abs + e.y : this.heightAt(e.x, e.z) + e.y, acc: Math.random() }));
    map ? this.buildMapGround() : this.buildLegacyGround();
    this.buildProps();
    renderer.finalizeStatic();
    this.lamps = this.layout.lamps.map(l => ({ pos: [l.x, l.y + this.heightAt(l.x, l.z), l.z], color: hexToLinear(l.color), distance: l.distance }));
    this.applyLighting();
  }

  tex(name, opts) { if (!this.renderer.textures.has('g_' + name)) this.renderer.texture('g_' + name, GROUND_TEXTURES[name](), opts); return 'g_' + name; }

  buildMapGround() {
    const m = this.map, r = this.renderer, g = m.ground;
    // crisp texels up close, but mipmapped when a screen pixel covers several: nearest sampling with no mips picked a
    // different sand texel every frame the camera panned, and the ground sparkled
    const tile = (n) => this.tex(n, { nearestMag: true, repeat: true, mips: true });
    const res = m.splatRes || 512, splat = document.createElement('canvas'); splat.width = splat.height = res;   // a 2 km map asks for 1024 (2 m a texel)
    m.paintSplat(splat.getContext('2d'), res, this.half);
    r.dataTexture('splat', splat);
    r.setGround({ splat: 'splat', base: tile(g.base), tiles: g.tiles.map(tile), tileSize: g.tileSize, baseSize: g.baseSize, mapSize: this.size, rock: this.terrain ? tile('rock') : null, rockSize: 6, macro: this.tex('macro', { repeat: true, mips: true }) });   // rock on steep slopes; the slow variation (smooth, not pixelated)
    if (this.terrain) {
      this.buildTerrainChunks();
      if (this.terrain.water > -Infinity) {   // water surface: a plane at the water level, seen only where the ground is carved below it
        const T = this.terrain, n = T.n, depth = new Uint8Array(n * n);   // its depth map: shading, foam and the wet banks (shaders.js)
        for (let i = 0; i < n * n; i++) depth[i] = Math.round(Math.max(0, Math.min(1, (T.water - T.h[i] + 0.5) / 4.5)) * 255);
        r.setWater(depth, n, T.cell, T.half);
        const water = new Mesh(`plane:${this.size},${this.size}`, { color: [1, 1, 1, 1], tex: null, emissive: [0, 0, 0], cast: false, water: true });
        water.rotation.x = -Math.PI / 2; water.position.y = this.terrain.water; this.scene.add(water);
      }
    }
    else { const ground = new Mesh(`plane:${this.size},${this.size}`, { color: [1, 1, 1, 1], tex: null, emissive: [0, 0, 0], cast: false, ground: true }); ground.rotation.x = -Math.PI / 2; this.scene.add(ground); }
    const H = this.heightAt;
    // a road strip rides a bridge deck out to 3 m past its sides, so a road that bends as it leaves the bridge stays on top
    // of the deck instead of dropping to the ground under it (looks only: units use heightAt)
    const HS = (x, z) => { let h = H(x, z); for (const b of this.bridges) { const dx = x - b.x, dz = z - b.z, c = Math.cos(b.angle), sn = Math.sin(b.angle); if (Math.abs(dx * sn + dz * c) <= b.len / 2 && Math.abs(dx * c - dz * sn) <= b.w / 2 + 3) h = Math.max(h, b.y); } return h; };
    // roads and painted lines follow the terrain; long strips stay dynamic (always drawn), decals are static
    this.layout.strips.forEach((s, i) => {
      const pts = s.smooth ? smooth(s.points, s.smooth) : s.points;
      const key = r.registerGeometry('strip#' + i, stripGeometry(pts, s.width, s.vRepeat, s.y + 0.4, HS));
      const mesh = new Mesh(key, { color: [1, 1, 1, 1], tex: tile(s.tex), emissive: [0, 0, 0], cast: false, cutout: !!s.cutout });
      this.scene.add(mesh);
    });
    for (const d of this.layout.decals) {
      const key = r.registerGeometry(`decal:${d.w},${d.d}`, decalGeometry(d.w, d.d));
      const mesh = new Mesh(key, { color: [1, 1, 1, 1], tex: this.tex(d.tex, { nearest: true, repeat: false, mips: false }), emissive: [0, 0, 0], cast: false, cutout: true });
      mesh.position.set(d.x, H(d.x, d.z), d.z); mesh.rotation.y = d.rot || 0; r.addStatic(mesh);
    }
  }

  // terrain as one static ground-mode mesh per 64 m chunk (16 x 16 cells of 4 m), culled with the chunk
  buildTerrainChunks() {
    const T = this.terrain, cs = this.renderer.chunkSize, cells = cs / T.cell, mat = { color: [1, 1, 1, 1], tex: null, emissive: [0, 0, 0], cast: true, ground: true };
    for (let cz = -this.half; cz < this.half; cz += cs) for (let cx = -this.half; cx < this.half; cx += cs) {
      const ox = cx + cs / 2, oz = cz + cs / 2, v = [], idx = [];
      for (let iz = 0; iz <= cells; iz++) for (let ix = 0; ix <= cells; ix++) {
        const x = cx + ix * T.cell, z = cz + iz * T.cell, n = T.normal(x, z);
        v.push(x - ox, T.height(x, z), z - oz, n[0], n[1], n[2], 0, 0);
      }
      for (let iz = 0; iz < cells; iz++) for (let ix = 0; ix < cells; ix++) {
        const a = iz * (cells + 1) + ix, b = a + 1, c = a + cells + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const key = this.renderer.registerGeometry(`terrain#${cx},${cz}`, { data: new Float32Array(v), idx: new Uint16Array(idx), count: idx.length });
      const mesh = new Mesh(key, mat); mesh.position.set(ox, 0, oz); this.renderer.addStatic(mesh);
    }
  }

  buildLegacyGround() {
    this.renderer.texture('ground', groundCanvas(), { nearest: true, mips: false });
    const ground = new Mesh(`plane:${this.size},${this.size}`, { color: [1, 1, 1, 1], tex: 'ground', emissive: [0, 0, 0], cast: false });
    ground.rotation.x = -Math.PI / 2; this.scene.add(ground);
    const outer = new Mesh(`plane:${this.size * 4},${this.size * 4}`, { color: [...hexToLinear(0x8a8a58), 1], tex: null, emissive: [0, 0, 0], cast: false });
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; this.scene.add(outer);
  }

  buildProps() {
    const mats = new Map(), r = this.renderer;
    for (const p of this.layout.props) {
      let mat;
      if (p.tex) mat = MAT[p.tex];
      else if (p.emissive !== undefined) { mat = { color: [...hexToLinear(p.color), 1], tex: null, emissive: hexToLinear(p.emissive), emissiveI: 0, cast: p.cast }; this.heads.push(mat); }
      else { const k = p.color + ':' + p.cast; if (!mats.has(k)) mats.set(k, { color: [...hexToLinear(p.color), 1], tex: null, emissive: [0, 0, 0], cast: p.cast }); mat = mats.get(k); }
      // a swaying part (trees, bushes): its own material, flagged for the wind in the shaders, with the height of its centre
      // over the ground in the colour's alpha (1 - y / 64) so the shader knows how far up the tree each vertex is
      if (p.sway && !p.absY) mat = { ...mat, sway: true, color: [mat.color[0], mat.color[1], mat.color[2], 1 - Math.min(63, p.y) / 64] };
      // multi-part props share their anchor's ground height. A box or straight cylinder of any size is a scaled unit one (the
      // vertex shader scales its UVs back to world units; axis-aligned normals survive the scale), so a chunk's props of one
      // material draw as one batch instead of one per size
      let geo = p.geo, scale = p.scale;
      if (!scale && (geo.startsWith('box:') || geo.startsWith('cyl:'))) {
        const a = geo.slice(4).split(',').map(Number);
        if (geo[0] === 'b') { geo = 'box:1,1,1'; scale = a; }
        else if (a[0] === a[1] && a[0] > 0) { geo = `cyl:1,1,1,${a[3]}`; scale = [a[0], a[2], a[0]]; }
      }
      const m = new Mesh(geo, mat); m.position.set(p.x, p.absY ? p.y : p.y + this.heightAt(p.ax ?? p.x, p.az ?? p.z), p.z); m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      if (scale) m.scale.set(scale[0], scale[1], scale[2]);
      if (p.beam) {   // a lighthouse beam: a long bar on a pivot at the lantern, turning, shown only at night
        const pivot = new Node(); pivot.position.copy(m.position); pivot.bound = 50; m.position.set((scale ? scale[0] : 1) / 2, 0, 0); pivot.add(m); this.scene.add(pivot); this.beams.push(pivot);
      } else if (p.lampHead) { m.bound = 3; this.scene.add(m); } else r.addStatic(m);   // lamp heads change emissive at night, so they stay dynamic
    }
    for (const t of this.layout.tufts) {
      if (this.terrain && this.terrain.height(t.x, t.z) < this.terrain.water) continue;   // none under the water
      const m = new Mesh('tuft:' + t.size + ',' + (t.size * 1.1).toFixed(2), MAT.tuft); m.position.set(t.x, this.heightAt(t.x, t.z), t.z); m.rotation.y = t.yaw; r.addStatic(m);
    }
  }

  update(dt) {
    super.update(dt); this.applyLighting();
    const night = this.light.night > 0.5;
    for (const b of this.beams) { b.visible = night; if (night) b.rotation.y += dt * 0.5; }
  }
  // the ambient emitters, at the sim's pace (paused with it); and what the explosions left: marks to lay, shakes for the camera
  ambient(dt) {
    if (!this.dust) return;
    for (const m of this.dust.marks.splice(0)) this.addMark(m);
    for (const s of this.dust.shakes.splice(0)) if (this.onShake) this.onShake(s);
    if (dt <= 0) return;
    for (let i = this.marks.length - 1; i >= 0; i--) { const m = this.marks[i]; if ((m.t += dt) > m.life) { this.scene.remove(m.mesh); this.marks.splice(i, 1); } }
    const wind = this.map.wind || [0.8, 0.3];
    for (const e of this.emitters) { e.acc += dt * e.rate; while (e.acc >= 1) { e.acc -= 1; this.dust.ambient(e.kind, e.x, e.y, e.z, e.k, wind); } }
  }
  // a mark of battle on the ground: a scorch or crater decal, one of a few sizes, turned at random, gone after two minutes;
  // at most 150, the oldest making way
  addMark({ x, z, r, kind }) {
    if (this.terrain && this.terrain.height(x, z) < this.terrain.water) return;   // not on the water
    const sizes = kind === 'scorch' ? [4, 6, 9] : [2.5, 3.5], s = sizes.reduce((p, q) => Math.abs(q - r * 2) < Math.abs(p - r * 2) ? q : p);
    const rd = this.renderer, key = rd.registerGeometry(`decal:${s},${s}`, decalGeometry(s, s));
    this.markMats = this.markMats || {}; const mat = this.markMats[kind] || (this.markMats[kind] = { color: [1, 1, 1, 1], tex: this.tex(kind, { nearest: true, repeat: false, mips: false }), emissive: [0, 0, 0], cast: false, cutout: true });
    const m = new Mesh(key, mat); m.position.set(x, this.heightAt(x, z) + 0.07, z); m.rotation.y = Math.random() * Math.PI * 2; m.bound = s;
    this.scene.add(m); this.marks.push({ mesh: m, t: 0, life: 120 });
    if (this.marks.length > 150) { const old = this.marks.shift(); this.scene.remove(old.mesh); }
  }

  applyLighting() {
    const L = this.light;
    for (const h of this.heads) h.emissiveI = L.lampEmissive;
    // the shader takes eight point lights: muzzle flashes and explosions first (brief and bright), then the lamps nearest the camera focus
    const fx = this.focus.x, fz = this.focus.z, dist = (p) => Math.hypot(p[0] - fx, p[2] - fz);
    const flashes = (this.dust ? this.dust.lights : []).map(f => ({ pos: [f.x, f.y, f.z], color: f.color, intensity: f.intensity * (f.life / f.maxLife), distance: f.distance })).sort((a, b) => dist(a.pos) - dist(b.pos));
    const near = this.lamps.map(l => ({ pos: l.pos, color: l.color, intensity: L.lampI, distance: l.distance })).sort((a, b) => dist(a.pos) - dist(b.pos));
    this.lightState = {
      sunDir: L.sunDir, sunColor: L.sunColor, sunI: L.sunI, hemiSky: L.hemiSky, hemiGround: L.hemiGround, hemiI: L.hemiI,
      background: L.background, points: [...flashes, ...near].slice(0, 8),
    };
  }
}
