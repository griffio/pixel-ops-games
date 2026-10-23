import { Node, Mesh } from './scene.js';
import { hexToLinear } from '../core/math.js';
import { camoCanvas, CAMO } from '../core/textures.js';
import { makeBuilders, COLORS, TEXTURED } from '../core/models.js';

// WebGL2 materials + factory for the shared model definitions in core/models.js.
export function registerTextures(r) {
  for (const [name, c] of Object.entries(CAMO)) r.texture(name, camoCanvas(c), { nearest: true, repeat: true, mips: false });
}
const lam = (hex, extra = {}) => ({ color: [...hexToLinear(hex), 1], tex: null, emissive: [0, 0, 0], unlit: false, cast: true, ...extra });
export const MAT = {};
for (const [k, hex] of Object.entries(COLORS)) MAT[k] = lam(hex);
for (const k of TEXTURED) MAT[k] = { color: [1, 1, 1, 1], tex: k, emissive: [0, 0, 0], unlit: false, cast: true };
MAT.ring = { color: [...hexToLinear(0xf2c14e), 0.9], tex: null, emissive: [0, 0, 0], unlit: true, cast: false };
MAT.navRed = lam(0x200000, { emissive: hexToLinear(0xff2020) });
MAT.navGreen = lam(0x002000, { emissive: hexToLinear(0x20ff40) });

const F = {
  group: () => new Node(),
  box(w, h, d, mat, x = 0, y = 0, z = 0, parent = null) {
    const m = new Mesh(`box:${w},${h},${d}`, MAT[mat]); m.position.set(x, y, z); if (parent) parent.add(m); return m;
  },
  wheel(r, w, x, y, z, parent) {
    const g = new Node(); g.position.set(x, y, z);
    const m = new Mesh(`cyl:${r},${r},${w},8`, MAT.tire); m.rotation.z = Math.PI / 2; g.add(m);
    const rim = new Mesh(`cyl:${r * 0.55},${r * 0.55},${w + 0.04},6`, MAT.rim); rim.rotation.z = Math.PI / 2; g.add(rim);
    parent.add(g); return g;
  },
  ring(radius, parent) {
    const m = new Mesh(`ring:${radius * 0.8},${radius},16`, MAT.ring); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.visible = false;
    parent.add(m); return m;
  },
};
export const builders = makeBuilders(F);
