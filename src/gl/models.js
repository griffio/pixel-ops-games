import { Node, Mesh } from './scene.js';
import { hexToLinear, rng } from '../core/math.js';
import { camoCanvas, CAMO } from '../core/textures.js';

// Same box-built units as the three.js back end, expressed as scene-graph nodes
// with geometry keys and material descriptors. Local +Z is forward.
export function registerTextures(r) {
  for (const [name, c] of Object.entries(CAMO)) r.texture(name, camoCanvas(c.colors, c.seed, c.size), { nearest: true, repeat: true, mips: false });
}

const lam = (hex, extra = {}) => ({ color: [...hexToLinear(hex), 1], tex: null, emissive: [0, 0, 0], unlit: false, cast: true, ...extra });
const tex = (name) => ({ color: [1, 1, 1, 1], tex: name, emissive: [0, 0, 0], unlit: false, cast: true });
export const MAT = {
  skin: lam(0xc9966b), skin2: lam(0x8a5a3a), uniform: tex('uniform'),
  helmet: lam(0x6b6a4e), boots: lam(0x3a3127), pack: lam(0x7d7152), rifle: lam(0x1f1f1f),
  desert: tex('desert'), desert2: tex('desert2'), heli: tex('heli'), heliDark: lam(0x2e3330),
  glass: lam(0x1d2328), tire: lam(0x1a1a1a), rim: lam(0x6d6a60), metal: lam(0x2a2a2a), canvas: lam(0x6f6448),
  ring: { color: [...hexToLinear(0xf2c14e), 0.9], tex: null, emissive: [0, 0, 0], unlit: true, cast: false },
  navRed: lam(0x200000, { emissive: hexToLinear(0xff2020) }), navGreen: lam(0x002000, { emissive: hexToLinear(0x20ff40) }),
};

function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new Mesh(`box:${w},${h},${d}`, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m;
}
function wheel(r, w, x, y, z, parent) {
  const g = new Node(); g.position.set(x, y, z);
  const m = new Mesh(`cyl:${r},${r},${w},8`, MAT.tire); m.rotation.z = Math.PI / 2; g.add(m);
  const rim = new Mesh(`cyl:${r * 0.55},${r * 0.55},${w + 0.04},6`, MAT.rim); rim.rotation.z = Math.PI / 2; g.add(rim);
  parent.add(g); return g;
}
function ring(radius, parent) {
  const m = new Mesh(`ring:${radius * 0.8},${radius},16`, MAT.ring); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.visible = false; parent.add(m); return m;
}

export function buildSoldier() {
  const g = new Node(); const p = {};
  p.legL = new Node(); p.legL.position.set(-0.17, 0.9, 0); box(0.26, 0.9, 0.3, MAT.uniform, 0, -0.45, 0, p.legL);
  box(0.28, 0.2, 0.36, MAT.boots, 0, -0.82, 0.03, p.legL);
  p.legR = new Node(); p.legR.position.set(0.17, 0.9, 0); box(0.26, 0.9, 0.3, MAT.uniform, 0, -0.45, 0, p.legR);
  box(0.28, 0.2, 0.36, MAT.boots, 0, -0.82, 0.03, p.legR);
  p.torso = new Node(); p.torso.position.y = 0.9; g.add(p.torso);
  box(0.62, 0.72, 0.4, MAT.uniform, 0, 0.36, 0, p.torso);
  box(0.5, 0.5, 0.25, MAT.pack, 0, 0.4, -0.3, p.torso);
  box(0.34, 0.34, 0.34, rng() < 0.5 ? MAT.skin : MAT.skin2, 0, 0.95, 0.02, p.torso);
  box(0.46, 0.22, 0.48, MAT.helmet, 0, 1.17, 0, p.torso);
  p.armL = new Node(); p.armL.position.set(-0.42, 0.68, 0); box(0.2, 0.68, 0.24, MAT.uniform, 0, -0.3, 0, p.armL); p.torso.add(p.armL);
  p.armR = new Node(); p.armR.position.set(0.42, 0.68, 0); box(0.2, 0.68, 0.24, MAT.uniform, 0, -0.3, 0, p.armR); p.torso.add(p.armR);
  const rifle = box(0.1, 0.14, 1.0, MAT.rifle, -0.22, -0.5, 0.42, p.armR); rifle.rotation.y = 0.35;
  g.add(p.legL, p.legR);
  p.ring = ring(0.8, g);
  return { group: g, parts: p, height: 2.1, radius: 0.45 };
}

export function buildTruck() {
  const g = new Node(); const p = { wheels: [], steer: [] };
  box(5.6, 0.5, 2.0, MAT.metal, 0, 0.85, 0, g);
  box(2.3, 1.75, 2.4, MAT.desert, 0, 2.0, 2.0, g);
  box(2.3, 0.3, 2.4, MAT.desert2, 0, 2.95, 2.0, g);
  box(0.1, 0.7, 2.0, MAT.glass, 0, 2.35, 3.2, g);
  box(0.5, 0.5, 2.3, MAT.desert2, 0, 1.4, 3.4, g);
  box(2.5, 0.9, 3.8, MAT.desert2, 0, 1.55, -1.3, g);
  box(2.1, 0.8, 2.2, MAT.canvas, 0, 2.4, -1.2, g);
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
  const g = new Node(); const p = { wheels: [], steer: [] };
  box(2.5, 1.0, 7.2, MAT.desert2, 0, 1.4, 0, g);
  box(2.8, 1.0, 5.8, MAT.desert, 0, 2.35, 0.2, g);
  box(2.2, 0.6, 1.4, MAT.desert2, 0, 2.95, 2.6, g);
  box(0.4, 0.4, 0.6, MAT.glass, -0.6, 2.9, 3.0, g); box(0.4, 0.4, 0.6, MAT.glass, 0.6, 2.9, 3.0, g);
  p.turret = new Node(); p.turret.position.set(0, 2.85, -0.3); g.add(p.turret);
  box(1.5, 0.7, 1.7, MAT.desert, 0, 0.35, 0, p.turret);
  box(0.16, 0.16, 2.4, MAT.metal, 0.3, 0.45, 1.8, p.turret);
  box(2.9, 0.15, 0.5, MAT.metal, 0, 1.95, -3.1, g);
  for (let i = 0; i < 4; i++) for (const x of [-1.4, 1.4]) {
    const z = -2.5 + i * 1.6 + (i >= 2 ? 0.3 : 0);
    const w = wheel(0.62, 0.55, x, 0.62, z, g); p.wheels.push(w); if (i >= 2) p.steer.push(w);
  }
  p.ring = ring(3.6, g);
  return { group: g, parts: p, height: 3.9, radius: 2.4 };
}

export function buildHeli() {
  const g = new Node(); const p = {};
  const body = new Node(); g.add(body); p.body = body;
  box(2.2, 1.9, 5.4, MAT.heli, 0, 1.9, 0, body);
  box(1.9, 1.3, 2.0, MAT.heli, 0, 1.5, 3.4, body);
  box(1.7, 0.7, 1.3, MAT.glass, 0, 2.3, 3.0, body);
  box(0.6, 0.9, 1.6, MAT.glass, -1.12, 1.9, 0.4, body); box(0.6, 0.9, 1.6, MAT.glass, 1.12, 1.9, 0.4, body);
  box(2.6, 0.5, 2.6, MAT.heliDark, 0, 3.05, -0.2, body);
  box(3.6, 0.15, 0.9, MAT.heliDark, 0, 2.0, 1.2, body);
  box(0.8, 0.8, 4.6, MAT.heli, 0, 2.4, -4.6, body);
  box(0.25, 2.2, 1.1, MAT.heli, 0, 3.6, -6.6, body);
  box(2.4, 0.12, 0.7, MAT.heliDark, 0, 2.8, -6.0, body);
  box(0.2, 0.7, 0.2, MAT.metal, -0.9, 0.5, 2.2, body); box(0.2, 0.7, 0.2, MAT.metal, 0.9, 0.5, 2.2, body);
  wheel(0.3, 0.25, -0.9, 0.3, 2.2, body); wheel(0.3, 0.25, 0.9, 0.3, 2.2, body); wheel(0.25, 0.25, 0, 0.25, -5.6, body);
  box(0.16, 0.16, 0.16, MAT.navRed, -1.85, 2.05, 1.2, body); box(0.16, 0.16, 0.16, MAT.navGreen, 1.85, 2.05, 1.2, body);
  p.beacon = box(0.2, 0.2, 0.2, MAT.navRed, 0, 4.8, -6.6, body);
  p.rotor = new Node(); p.rotor.position.set(0, 3.55, -0.2); body.add(p.rotor);
  box(0.5, 0.5, 0.5, MAT.metal, 0, 0, 0, p.rotor);
  for (let i = 0; i < 4; i++) { const h = new Node(); h.rotation.y = i * Math.PI / 2; box(0.28, 0.07, 7.2, MAT.heliDark, 0, 0.1, 3.6, h); p.rotor.add(h); }
  p.tail = new Node(); p.tail.position.set(0.3, 3.9, -6.8); body.add(p.tail);
  box(0.1, 0.18, 2.2, MAT.heliDark, 0, 0, 0, p.tail); box(0.1, 2.2, 0.18, MAT.heliDark, 0, 0, 0, p.tail);
  p.ring = ring(4.5, g);
  return { group: g, parts: p, height: 4.2, radius: 2.8 };
}

export const builders = { soldier: buildSoldier, truck: buildTruck, apc: buildApc, heli: buildHeli };
