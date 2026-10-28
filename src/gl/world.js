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
    super(map); this.scene = scene; this.renderer = renderer; this.heads = []; this.beams = []; this.birds = []; this.focus = { x: 0, z: 0 }; this.t = 0;
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
    this.buildBirds();
  }

  update(dt) {
    super.update(dt); this.applyLighting(); this.t += dt;
    const night = this.light.night > 0.5;
    for (const b of this.beams) { b.visible = night; if (night) b.rotation.y += dt * 0.5; }
    for (const g of this.birds) {   // gulls: each on its own circle, flapping, a little bob
      g.a += dt * g.v / g.r; const x = g.cx + Math.cos(g.a) * g.r, z = g.cz + Math.sin(g.a) * g.r;
      g.node.position.set(x, g.y + Math.sin(this.t * 1.3 + g.ph) * 0.8, z); g.node.rotation.y = -g.a;
      const flap = Math.sin(this.t * 7 + g.ph) * 0.55; g.wl.rotation.z = flap; g.wr.rotation.z = -flap;
    }
  }
  // the ambient emitters, at the sim's pace (paused with it)
  ambient(dt) {
    if (!this.dust || dt <= 0) return;
    const wind = this.map.wind || [0.8, 0.3];
    for (const e of this.emitters) { e.acc += dt * e.rate; while (e.acc >= 1) { e.acc -= 1; this.dust.ambient(e.kind, e.x, e.y, e.z, e.k, wind); } }
  }
  // gulls over the water: a few at each spot the map names ({ x, z, r, y, n }), each a body and two wings
  buildBirds() {
    const GULL = { color: [0.93, 0.94, 0.95, 1], tex: null, emissive: [0, 0, 0], cast: false }, TIP = { color: [0.25, 0.26, 0.28, 1], tex: null, emissive: [0, 0, 0], cast: false };
    for (const s of this.map.birds || []) for (let i = 0; i < s.n; i++) {
      const node = new Node(); node.bound = 3;
      const body = new Mesh('box:1,1,1', GULL); body.scale.set(0.7, 0.2, 0.3); node.add(body);
      const wing = (side) => { const w = new Node(); w.position.set(0, 0.06, side * 0.1); const m = new Mesh('box:1,1,1', GULL); m.scale.set(0.4, 0.06, 1.0); m.position.z = side * 0.5; w.add(m); const t = new Mesh('box:1,1,1', TIP); t.scale.set(0.3, 0.06, 0.2); t.position.z = side * 1.05; w.add(t); node.add(w); return w; };
      const wl = wing(1), wr = wing(-1), base = Math.max(this.heightAt(s.x, s.z), this.terrain ? this.terrain.water : 0);
      this.scene.add(node); this.birds.push({ node, wl, wr, cx: s.x + (Math.random() - 0.5) * 12, cz: s.z + (Math.random() - 0.5) * 12, r: s.r * (0.7 + Math.random() * 0.6), y: base + s.y + (Math.random() - 0.5) * 6, a: Math.random() * Math.PI * 2, v: 7 + Math.random() * 3, ph: Math.random() * 7 });
    }
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
