import { Node, Mesh } from './scene.js';
import { hexToLinear } from '../core/math.js';
import { camoCanvas, CAMO, tuftCanvas } from '../core/textures.js';
import { makeBuilders, COLORS, TEXTURED } from '../core/models.js';

// WebGL2 materials + factory for the shared model definitions in core/models.js.
export function registerTextures(r) {
  for (const [name, c] of Object.entries(CAMO)) r.texture(name, camoCanvas(c), { nearest: true, repeat: true, mips: false });
  r.texture('tuft', tuftCanvas(), { nearest: true, repeat: false, mips: false });
}
const lam = (hex, extra = {}) => ({ color: [...hexToLinear(hex), 1], tex: null, emissive: [0, 0, 0], unlit: false, cast: true, ...extra });
export const MAT = {};
for (const [k, hex] of Object.entries(COLORS)) MAT[k] = lam(hex);
for (const k of TEXTURED) MAT[k] = { color: [1, 1, 1, 1], tex: k, emissive: [0, 0, 0], unlit: false, cast: true };
MAT.tuft = { color: [1, 1, 1, 1], tex: 'tuft', emissive: [0, 0, 0], unlit: false, cast: true, cutout: true };
MAT.ring = { color: [...hexToLinear(0xf2c14e), 0.9], tex: null, emissive: [0, 0, 0], unlit: true, cast: false };
MAT.rotorBlur = { color: [...hexToLinear(0x15171a), 0.3], tex: null, emissive: [0, 0, 0], unlit: true, cast: false };
MAT.navRed = lam(0x200000, { emissive: hexToLinear(0xff2020) });
MAT.navGreen = lam(0x002000, { emissive: hexToLinear(0x20ff40) });

export const F = {
  group: () => new Node(),
  mesh(geo, mat, x = 0, y = 0, z = 0, parent = null) { const m = new Mesh(geo, MAT[mat]); m.position.set(x, y, z); if (parent) parent.add(m); return m; },
  box(w, h, d, mat, x = 0, y = 0, z = 0, parent = null) { return F.mesh(`box:${w},${h},${d}`, mat, x, y, z, parent); },
  wheel(r, w, x, y, z, parent, rimMat = 'rim') {
    const g = new Node(); g.position.set(x, y, z);
    const m = F.mesh(`cyl:${r},${r},${w},8`, 'tire', 0, 0, 0, g); m.rotation.z = Math.PI / 2;
    const tread = F.mesh(`cyl:${r * 1.02},${r * 1.02},${w * 0.34},8`, 'tread', 0, 0, 0, g); tread.rotation.z = Math.PI / 2;   // lighter centre band on the tyre
    const rim = F.mesh(`cyl:${r * 0.7},${r * 0.7},${w + 0.06},6`, rimMat, 0, 0, 0, g); rim.rotation.z = Math.PI / 2;
    const hub = F.mesh(`cyl:${r * 0.3},${r * 0.3},${w + 0.14},6`, 'hub', 0, 0, 0, g); hub.rotation.z = Math.PI / 2;
    parent.add(g); return g;
  },
  recolor(root, matName) { const walk = (n) => { if (n.geo && n.mat !== MAT.ring && n.mat !== MAT.rotorBlur) n.mat = MAT[matName]; for (const c of n.children) walk(c); }; walk(root); },
  ring(radius, parent) {
    const m = new Mesh(`ring:${radius * 0.8},${radius},16`, MAT.ring); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.visible = false;
    parent.add(m); return m;
  },
};
export const builders = makeBuilders(F);
