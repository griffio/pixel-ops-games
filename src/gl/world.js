import { WorldState } from '../core/layout.js';
import { groundCanvas } from '../core/textures.js';
import { hexToLinear } from '../core/math.js';
import { Mesh } from './scene.js';
import { MAT } from './models.js';
import { GROUND_TEXTURES } from '../game/maps/groundTextures.js';
import { stripGeometry, decalGeometry, smooth } from './strips.js';

// WebGL2 world: splat-mapped tiled ground, road strips and decals, static props
// baked into chunked instance buffers, lamps. Produces `lightState` for the renderer.
export class World extends WorldState {
  constructor(scene, renderer, map = null) {
    super(map); this.scene = scene; this.renderer = renderer; this.heads = []; this.focus = { x: 0, z: 0 };
    map ? this.buildMapGround() : this.buildLegacyGround();
    this.buildProps();
    renderer.finalizeStatic();
    this.lamps = this.layout.lamps.map(l => ({ pos: [l.x, l.y + this.heightAt(l.x, l.z), l.z], color: hexToLinear(l.color), distance: l.distance }));
    this.applyLighting();
  }

  tex(name, opts) { if (!this.renderer.textures.has('g_' + name)) this.renderer.texture('g_' + name, GROUND_TEXTURES[name](), opts); return 'g_' + name; }

  buildMapGround() {
    const m = this.map, r = this.renderer, g = m.ground;
    const tile = (n) => this.tex(n, { nearest: true, repeat: true, mips: false });
    const splat = document.createElement('canvas'); splat.width = splat.height = 512;
    m.paintSplat(splat.getContext('2d'), 512, this.half);
    r.dataTexture('splat', splat);
    r.setGround({ splat: 'splat', base: tile(g.base), tiles: g.tiles.map(tile), tileSize: g.tileSize, baseSize: g.baseSize, mapSize: this.size });
    if (this.terrain) {
      this.buildTerrainChunks();
      if (this.terrain.water > -Infinity) {   // water surface: unlit translucent plane, visible only where the ground is carved below it
        const water = new Mesh(`plane:,`, { color: [...hexToLinear(0x2b5468), 0.82], tex: null, emissive: [0, 0, 0], unlit: true, cast: false });
        water.rotation.x = -Math.PI / 2; water.position.y = this.terrain.water; this.scene.add(water);
      }
    }
    else { const ground = new Mesh(`plane:${this.size},${this.size}`, { color: [1, 1, 1, 1], tex: null, emissive: [0, 0, 0], cast: false, ground: true }); ground.rotation.x = -Math.PI / 2; this.scene.add(ground); }
    const H = this.heightAt;
    // roads and painted lines follow the terrain; long strips stay dynamic (always drawn), decals are static
    this.layout.strips.forEach((s, i) => {
      const pts = s.smooth ? smooth(s.points, s.smooth) : s.points;
      const key = r.registerGeometry('strip#' + i, stripGeometry(pts, s.width, s.vRepeat, s.y + 0.4, H));
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
      const m = new Mesh(p.geo, mat); m.position.set(p.x, p.absY ? p.y : p.y + this.heightAt(p.x, p.z), p.z); m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      p.lampHead ? this.scene.add(m) : r.addStatic(m);   // lamp heads change emissive at night, so they stay dynamic
    }
    for (const t of this.layout.tufts) {
      const m = new Mesh('tuft:' + t.size + ',' + (t.size * 1.1).toFixed(2), MAT.tuft); m.position.set(t.x, this.heightAt(t.x, t.z), t.z); m.rotation.y = t.yaw; r.addStatic(m);
    }
  }

  update(dt) { super.update(dt); this.applyLighting(); }
  applyLighting() {
    const L = this.light;
    for (const h of this.heads) h.emissiveI = L.lampEmissive;
    // the shader takes four point lights: use the ones nearest the camera focus
    const near = this.lamps.map(l => ({ l, d: Math.hypot(l.pos[0] - this.focus.x, l.pos[2] - this.focus.z) })).sort((a, b) => a.d - b.d).slice(0, 4).map(o => o.l);
    this.lightState = {
      sunDir: L.sunDir, sunColor: L.sunColor, sunI: L.sunI, hemiSky: L.hemiSky, hemiGround: L.hemiGround, hemiI: L.hemiI,
      background: L.background, points: near.map(l => ({ pos: l.pos, color: l.color, intensity: L.lampI, distance: l.distance })),
    };
  }
}
