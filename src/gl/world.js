import { WorldState, WORLD_SIZE } from '../core/layout.js';
import { groundCanvas } from '../core/textures.js';
import { hexToLinear } from '../core/math.js';
import { Mesh } from './scene.js';

// WebGL2 view of the shared world layout. Produces `lightState` for the renderer.
export class World extends WorldState {
  constructor(scene, renderer) {
    super(); this.scene = scene;
    renderer.texture('ground', groundCanvas(), { mips: true });
    const ground = new Mesh(`plane:${WORLD_SIZE},${WORLD_SIZE}`, { color: [1, 1, 1, 1], tex: 'ground', emissive: [0, 0, 0], cast: false });
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const outer = new Mesh(`plane:${WORLD_SIZE * 4},${WORLD_SIZE * 4}`, { color: [...hexToLinear(0x6b6557), 1], tex: null, emissive: [0, 0, 0], cast: false });
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; scene.add(outer);

    const mats = new Map(); this.heads = [];
    for (const p of this.layout.props) {
      let mat;
      if (p.emissive !== undefined) { mat = { color: [...hexToLinear(p.color), 1], tex: null, emissive: hexToLinear(p.emissive), emissiveI: 0, cast: p.cast }; this.heads.push(mat); }
      else { if (!mats.has(p.color)) mats.set(p.color, { color: [...hexToLinear(p.color), 1], tex: null, emissive: [0, 0, 0], cast: true }); mat = mats.get(p.color); mat.cast = p.cast; }
      const m = new Mesh(p.geo, mat); m.position.set(p.x, p.y, p.z); m.rotation.set(p.rot[0], p.rot[1], p.rot[2]); scene.add(m);
    }
    this.lamps = this.layout.lamps.map(l => ({ pos: [l.x, l.y, l.z], color: hexToLinear(l.color), distance: l.distance }));
    this.applyLighting();
  }
  update(dt) { super.update(dt); this.applyLighting(); }
  applyLighting() {
    const L = this.light;
    for (const h of this.heads) h.emissiveI = L.lampEmissive;
    this.lightState = {
      sunDir: L.sunDir, sunColor: L.sunColor, sunI: L.sunI, hemiSky: L.hemiSky, hemiGround: L.hemiGround, hemiI: L.hemiI,
      background: L.background, points: this.lamps.map(l => ({ pos: l.pos, color: l.color, intensity: L.lampI, distance: l.distance })),
    };
  }
}
