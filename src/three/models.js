import * as THREE from 'three';
import { geometry } from './geometry.js';
import { camoCanvas, CAMO } from '../core/textures.js';
import { makeBuilders, COLORS, TEXTURED } from '../core/models.js';

// three.js materials + factory for the shared model definitions in core/models.js.
function camoTexture(name) {
  const t = new THREE.CanvasTexture(camoCanvas(CAMO[name]));
  t.magFilter = t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const lam = (o) => new THREE.MeshLambertMaterial(o);
export const MAT = {};
for (const [k, hex] of Object.entries(COLORS)) MAT[k] = lam({ color: hex });
for (const k of TEXTURED) MAT[k] = lam({ map: camoTexture(k) });
MAT.ring = new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.9, depthWrite: false });
MAT.navRed = lam({ color: 0x200000, emissive: 0xff2020, emissiveIntensity: 1 });
MAT.navGreen = lam({ color: 0x002000, emissive: 0x20ff40, emissiveIntensity: 1 });

const F = {
  group: () => new THREE.Group(),
  box(w, h, d, mat, x = 0, y = 0, z = 0, parent = null) {
    const m = new THREE.Mesh(geometry(`box:${w},${h},${d}`), MAT[mat]); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
    if (parent) parent.add(m); return m;
  },
  wheel(r, w, x, y, z, parent) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const m = new THREE.Mesh(geometry(`cyl:${r},${r},${w},8`), MAT.tire); m.rotation.z = Math.PI / 2; m.castShadow = m.receiveShadow = true; g.add(m);
    const rim = new THREE.Mesh(geometry(`cyl:${r * 0.55},${r * 0.55},${w + 0.04},6`), MAT.rim); rim.rotation.z = Math.PI / 2; g.add(rim);
    parent.add(g); return g;
  },
  ring(radius, parent) {
    const m = new THREE.Mesh(geometry(`ring:${radius * 0.8},${radius},16`), MAT.ring); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.visible = false;
    parent.add(m); return m;
  },
};
export const builders = makeBuilders(F);
