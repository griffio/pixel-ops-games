import * as THREE from 'three';
import { geometry } from './geometry.js';
import { camoCanvas, CAMO, tuftCanvas } from '../core/textures.js';
import { makeBuilders, COLORS, TEXTURED } from '../core/models.js';

// three.js materials + factory for the shared model definitions in core/models.js.
function canvasTexture(cv, repeat = true) {
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  return t;
}
const lam = (o) => new THREE.MeshLambertMaterial(o);
export const MAT = {};
for (const [k, hex] of Object.entries(COLORS)) MAT[k] = lam({ color: hex });
for (const k of TEXTURED) MAT[k] = lam({ map: canvasTexture(camoCanvas(CAMO[k])) });
MAT.tuft = lam({ map: canvasTexture(tuftCanvas(), false), alphaTest: 0.5 });
MAT.ring = new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.9, depthWrite: false });
MAT.rotorBlur = new THREE.MeshBasicMaterial({ color: 0x15171a, transparent: true, opacity: 0.3, depthWrite: false });
MAT.rotorBlur.userData.noShadow = true;
MAT.navRed = lam({ color: 0x200000, emissive: 0xff2020, emissiveIntensity: 1 });
MAT.navGreen = lam({ color: 0x002000, emissive: 0x20ff40, emissiveIntensity: 1 });

export const F = {
  group: () => new THREE.Group(),
  mesh(geo, mat, x = 0, y = 0, z = 0, parent = null) {
    const m = new THREE.Mesh(geometry(geo), MAT[mat]); m.position.set(x, y, z);
    m.castShadow = !MAT[mat].userData.noShadow; m.receiveShadow = true;
    if (parent) parent.add(m); return m;
  },
  box(w, h, d, mat, x = 0, y = 0, z = 0, parent = null) { return F.mesh(`box:${w},${h},${d}`, mat, x, y, z, parent); },
  wheel(r, w, x, y, z, parent) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const m = F.mesh(`cyl:${r},${r},${w},8`, 'tire', 0, 0, 0, g); m.rotation.z = Math.PI / 2;
    const rim = F.mesh(`cyl:${r * 0.7},${r * 0.7},${w + 0.06},6`, 'rim', 0, 0, 0, g); rim.rotation.z = Math.PI / 2; rim.castShadow = false;
    parent.add(g); return g;
  },
  // swap every lit material in a model for the charred wreck texture (selection ring stays)
  recolor(root, matName) { root.traverse(o => { if (o.isMesh && o.material !== MAT.ring && o.material !== MAT.rotorBlur) o.material = MAT[matName]; }); },
  ring(radius, parent) {
    const m = new THREE.Mesh(geometry(`ring:${radius * 0.8},${radius},16`), MAT.ring); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.visible = false;
    parent.add(m); return m;
  },
};
export const builders = makeBuilders(F);
