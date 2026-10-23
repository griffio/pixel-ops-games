import * as THREE from 'three';
import { camoCanvas, CAMO } from '../core/textures.js';
import { rng } from '../core/math.js';

// All models are built from boxes/cylinders with shared materials. Local +Z is
// the unit's forward direction. They are deliberately chunky: at ~10 texels per
// world unit a soldier is ~18 texels tall, which is what gives the crude
// pixel-sprite read when the low-res buffer is upscaled.

function camoTexture(name) {
  const c = CAMO[name];
  const t = new THREE.CanvasTexture(camoCanvas(c.colors, c.seed, c.size));
  t.magFilter = t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const lam = (o) => new THREE.MeshLambertMaterial(o);
export const MAT = {
  skin: lam({ color: 0xc9966b }), skin2: lam({ color: 0x8a5a3a }),
  uniform: lam({ map: camoTexture('uniform') }),
  helmet: lam({ color: 0x6b6a4e }), boots: lam({ color: 0x3a3127 }), pack: lam({ color: 0x7d7152 }),
  rifle: lam({ color: 0x1f1f1f }),
  desert: lam({ map: camoTexture('desert') }),
  desert2: lam({ map: camoTexture('desert2') }),
  heli: lam({ map: camoTexture('heli') }),
  heliDark: lam({ color: 0x2e3330 }),
  glass: lam({ color: 0x1d2328 }), tire: lam({ color: 0x1a1a1a }), rim: lam({ color: 0x6d6a60 }),
  metal: lam({ color: 0x2a2a2a }), canvas: lam({ color: 0x6f6448 }),
  ring: new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.9, depthWrite: false }),
  ringGreen: new THREE.MeshBasicMaterial({ color: 0x7fd1a8, transparent: true, opacity: 0.6, depthWrite: false }),
  navRed: new THREE.MeshLambertMaterial({ color: 0x200000, emissive: 0xff2020, emissiveIntensity: 1 }),
  navGreen: new THREE.MeshLambertMaterial({ color: 0x002000, emissive: 0x20ff40, emissiveIntensity: 1 }),
};

const GEO = {};
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = null) {
  const key = `${w},${h},${d}`;
  GEO[key] ||= new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(GEO[key], mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  if (parent) parent.add(m); return m;
}
function wheel(r, w, x, y, z, parent) {
  // group spins around X (axle). mesh is a cylinder rotated so its axis is X.
  const g = new THREE.Group(); g.position.set(x, y, z);
  const key = `cyl${r},${w}`; GEO[key] ||= new THREE.CylinderGeometry(r, r, w, 8);
  const m = new THREE.Mesh(GEO[key], MAT.tire); m.rotation.z = Math.PI / 2; m.castShadow = m.receiveShadow = true; g.add(m);
  const key2 = `cyl${r * 0.55},${w + 0.04}`; GEO[key2] ||= new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.04, 6);
  const rim = new THREE.Mesh(GEO[key2], MAT.rim); rim.rotation.z = Math.PI / 2; g.add(rim);
  parent.add(g); return g;
}
function ring(radius, parent) {
  const key = `ring${radius}`; GEO[key] ||= new THREE.RingGeometry(radius * 0.8, radius, 16);
  const m = new THREE.Mesh(GEO[key], MAT.ring); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.visible = false; parent.add(m); return m;
}

export function buildSoldier() {
  const g = new THREE.Group(); const p = {};
  p.legL = new THREE.Group(); p.legL.position.set(-0.17, 0.9, 0); box(0.26, 0.9, 0.3, MAT.uniform, 0, -0.45, 0, p.legL);
  box(0.28, 0.2, 0.36, MAT.boots, 0, -0.82, 0.03, p.legL);
  p.legR = new THREE.Group(); p.legR.position.set(0.17, 0.9, 0); box(0.26, 0.9, 0.3, MAT.uniform, 0, -0.45, 0, p.legR);
  box(0.28, 0.2, 0.36, MAT.boots, 0, -0.82, 0.03, p.legR);
  p.torso = new THREE.Group(); p.torso.position.y = 0.9; g.add(p.torso);
  box(0.62, 0.72, 0.4, MAT.uniform, 0, 0.36, 0, p.torso);
  box(0.5, 0.5, 0.25, MAT.pack, 0, 0.4, -0.3, p.torso);
  box(0.34, 0.34, 0.34, rng() < 0.5 ? MAT.skin : MAT.skin2, 0, 0.95, 0.02, p.torso);
  box(0.46, 0.22, 0.48, MAT.helmet, 0, 1.17, 0, p.torso);
  p.armL = new THREE.Group(); p.armL.position.set(-0.42, 0.68, 0); box(0.2, 0.68, 0.24, MAT.uniform, 0, -0.3, 0, p.armL); p.torso.add(p.armL);
  p.armR = new THREE.Group(); p.armR.position.set(0.42, 0.68, 0); box(0.2, 0.68, 0.24, MAT.uniform, 0, -0.3, 0, p.armR); p.torso.add(p.armR);
  // rifle held across the chest, attached to right arm
  const rifle = box(0.1, 0.14, 1.0, MAT.rifle, -0.22, -0.5, 0.42, p.armR); rifle.rotation.y = 0.35;
  g.add(p.legL, p.legR);
  p.ring = ring(0.8, g);
  return { group: g, parts: p, height: 2.1, radius: 0.45 };
}

export function buildTruck() {
  const g = new THREE.Group(); const p = { wheels: [], steer: [] };
  box(5.6, 0.5, 2.0, MAT.metal, 0, 0.85, 0, g);                       // chassis
  box(2.3, 1.75, 2.4, MAT.desert, 0, 2.0, 2.0, g);                     // cab
  box(2.3, 0.3, 2.4, MAT.desert2, 0, 2.95, 2.0, g);                   // roof
  box(0.1, 0.7, 2.0, MAT.glass, 0, 2.35, 3.2, g);                      // windscreen
  box(0.5, 0.5, 2.3, MAT.desert2, 0, 1.4, 3.4, g);                     // bumper/grille
  box(2.5, 0.9, 3.8, MAT.desert2, 0, 1.55, -1.3, g);                   // bed
  box(2.1, 0.8, 2.2, MAT.canvas, 0, 2.4, -1.2, g);                     // cargo lump
  // roll cage
  for (const z of [-3.0, 0.4]) for (const x of [-1.15, 1.15]) box(0.1, 1.9, 0.1, MAT.metal, x, 2.9, z, g);
  for (const x of [-1.15, 1.15]) box(0.1, 0.1, 3.5, MAT.metal, x, 3.85, -1.3, g);
  for (const z of [-3.0, 0.4]) box(2.4, 0.1, 0.1, MAT.metal, 0, 3.85, z, g);
  for (const z of [-2.0, 1.9]) for (const x of [-1.25, 1.25]) {
    const w = wheel(0.6, 0.5, x, 0.6, z, g); p.wheels.push(w); if (z > 0) p.steer.push(w);
  }
  p.ring = ring(3.2, g);
  return { group: g, parts: p, height: 4, radius: 2.2 };
}

export function buildApc() {
  const g = new THREE.Group(); const p = { wheels: [], steer: [] };
  box(2.5, 1.0, 7.2, MAT.desert2, 0, 1.4, 0, g);                        // lower hull
  box(2.8, 1.0, 5.8, MAT.desert, 0, 2.35, 0.2, g);                      // upper hull
  box(2.2, 0.6, 1.4, MAT.desert2, 0, 2.95, 2.6, g);                     // sloped glacis stand-in
  box(0.4, 0.4, 0.6, MAT.glass, -0.6, 2.9, 3.0, g); box(0.4, 0.4, 0.6, MAT.glass, 0.6, 2.9, 3.0, g); // vision blocks
  p.turret = new THREE.Group(); p.turret.position.set(0, 2.85, -0.3); g.add(p.turret);
  box(1.5, 0.7, 1.7, MAT.desert, 0, 0.35, 0, p.turret);
  box(0.16, 0.16, 2.4, MAT.metal, 0.3, 0.45, 1.8, p.turret);
  box(2.9, 0.15, 0.5, MAT.metal, 0, 1.95, -3.1, g);                      // rear ledge
  for (let i = 0; i < 4; i++) for (const x of [-1.4, 1.4]) {
    const z = -2.5 + i * 1.6 + (i >= 2 ? 0.3 : 0);
    const w = wheel(0.62, 0.55, x, 0.62, z, g); p.wheels.push(w); if (i >= 2) p.steer.push(w);
  }
  p.ring = ring(3.6, g);
  return { group: g, parts: p, height: 3.9, radius: 2.4 };
}

export function buildHeli() {
  const g = new THREE.Group(); const p = {};
  const body = new THREE.Group(); g.add(body); p.body = body;
  box(2.2, 1.9, 5.4, MAT.heli, 0, 1.9, 0, body);                          // cabin
  box(1.9, 1.3, 2.0, MAT.heli, 0, 1.5, 3.4, body);                        // nose
  box(1.7, 0.7, 1.3, MAT.glass, 0, 2.3, 3.0, body);                       // canopy
  box(0.6, 0.9, 1.6, MAT.glass, -1.12, 1.9, 0.4, body); box(0.6, 0.9, 1.6, MAT.glass, 1.12, 1.9, 0.4, body); // doors
  box(2.6, 0.5, 2.6, MAT.heliDark, 0, 3.05, -0.2, body);                  // engine deck
  box(3.6, 0.15, 0.9, MAT.heliDark, 0, 2.0, 1.2, body);                   // stub wings
  box(0.8, 0.8, 4.6, MAT.heli, 0, 2.4, -4.6, body);                       // tail boom
  box(0.25, 2.2, 1.1, MAT.heli, 0, 3.6, -6.6, body);                      // fin
  box(2.4, 0.12, 0.7, MAT.heliDark, 0, 2.8, -6.0, body);                  // stabiliser
  box(0.2, 0.7, 0.2, MAT.metal, -0.9, 0.5, 2.2, body); box(0.2, 0.7, 0.2, MAT.metal, 0.9, 0.5, 2.2, body); // gear legs
  wheel(0.3, 0.25, -0.9, 0.3, 2.2, body); wheel(0.3, 0.25, 0.9, 0.3, 2.2, body); wheel(0.25, 0.25, 0, 0.25, -5.6, body);
  // nav lights
  box(0.16, 0.16, 0.16, MAT.navRed, -1.85, 2.05, 1.2, body); box(0.16, 0.16, 0.16, MAT.navGreen, 1.85, 2.05, 1.2, body);
  p.beacon = box(0.2, 0.2, 0.2, MAT.navRed, 0, 4.8, -6.6, body);
  // main rotor
  p.rotor = new THREE.Group(); p.rotor.position.set(0, 3.55, -0.2); body.add(p.rotor);
  box(0.5, 0.5, 0.5, MAT.metal, 0, 0, 0, p.rotor);
  for (let i = 0; i < 4; i++) { const b = box(0.28, 0.07, 7.2, MAT.heliDark, 0, 0.1, 3.6, p.rotor); b.rotation.y = 0; const h = new THREE.Group(); h.rotation.y = i * Math.PI / 2; h.add(b); p.rotor.add(h); }
  // tail rotor (spins around X, mounted on the fin's side)
  p.tail = new THREE.Group(); p.tail.position.set(0.3, 3.9, -6.8); body.add(p.tail);
  box(0.1, 0.18, 2.2, MAT.heliDark, 0, 0, 0, p.tail); box(0.1, 2.2, 0.18, MAT.heliDark, 0, 0, 0, p.tail);
  p.ring = ring(4.5, g);
  return { group: g, parts: p, height: 4.2, radius: 2.8 };
}

export const builders = { soldier: buildSoldier, truck: buildTruck, apc: buildApc, heli: buildHeli };
