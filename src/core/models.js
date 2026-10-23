import { rng } from './math.js';

// Unit models defined once for both back ends. A back end supplies a factory F:
//   F.group()                              -> empty transform node
//   F.box(w, h, d, matName, x, y, z, parent) -> box mesh
//   F.wheel(r, w, x, y, z, parent)         -> spinning wheel group (axle along X)
//   F.ring(radius, parent)                 -> hidden selection ring
// Local +Z is forward. Sizes are world units; at 10 texels/unit a soldier is ~23 texels tall.
export function makeBuilders(F) {
  const { group, box, wheel, ring } = F;

  // Reference look: realistic proportions, bare dark hair, chest rig, rifle held
  // diagonally across the body with both hands, knees that bend while running.
  function soldier() {
    const g = group(); const p = {};
    const skin = rng() < 0.5 ? 'skin' : 'skin2';
    for (const side of ['L', 'R']) {
      const hip = group(); hip.position.set(side === 'L' ? -0.15 : 0.15, 1.1, 0);
      box(0.22, 0.52, 0.26, 'uniform', 0, -0.26, 0, hip);
      const knee = group(); knee.position.set(0, -0.52, 0); hip.add(knee);
      box(0.2, 0.5, 0.23, 'uniform', 0, -0.25, 0, knee);
      box(0.24, 0.14, 0.34, 'boots', 0, -0.55, 0.04, knee);
      g.add(hip); p['leg' + side] = hip; p['knee' + side] = knee;
    }
    p.torso = group(); p.torso.position.y = 1.1; g.add(p.torso);
    box(0.56, 0.78, 0.3, 'uniform', 0, 0.39, 0, p.torso);        // shirt
    box(0.5, 0.52, 0.12, 'vest', 0, 0.42, 0.18, p.torso);         // chest rig
    box(0.48, 0.3, 0.1, 'vest', 0, 0.5, -0.18, p.torso);          // back pouch
    box(0.58, 0.1, 0.32, 'belt', 0, 0.05, 0, p.torso);            // belt
    box(0.3, 0.3, 0.3, skin, 0, 0.98, 0.02, p.torso);             // head
    box(0.32, 0.12, 0.32, 'hair', 0, 1.17, -0.01, p.torso);       // hair top
    box(0.32, 0.18, 0.1, 'hair', 0, 1.0, -0.14, p.torso);         // hair back
    for (const side of ['L', 'R']) {
      const arm = group(); arm.position.set(side === 'L' ? -0.36 : 0.36, 0.72, 0); p.torso.add(arm);
      box(0.18, 0.62, 0.2, 'uniform', 0, -0.3, 0, arm);
      box(0.16, 0.14, 0.16, skin, 0, -0.66, 0, arm);              // hand
      p['arm' + side] = arm;
    }
    p.rifle = group(); p.rifle.position.set(0.05, 0.3, 0.3); p.rifle.rotation.set(-0.25, -0.55, 0); p.torso.add(p.rifle);
    box(0.07, 0.11, 1.05, 'rifle', 0, 0, 0.1, p.rifle);           // receiver + barrel
    box(0.07, 0.2, 0.09, 'rifle', 0, -0.14, 0.05, p.rifle);       // magazine
    box(0.08, 0.14, 0.3, 'rifle', 0, -0.03, -0.45, p.rifle);      // stock
    p.ring = ring(0.8, g);
    return { group: g, parts: p, height: 2.4, radius: 0.45 };
  }

  function truck() {
    const g = group(); const p = { wheels: [], steer: [] };
    box(5.6, 0.5, 2.0, 'metal', 0, 0.85, 0, g);                       // chassis
    box(2.3, 1.75, 2.4, 'desert', 0, 2.0, 2.0, g);                     // cab
    box(2.3, 0.3, 2.4, 'desert2', 0, 2.95, 2.0, g);                   // roof
    box(0.1, 0.7, 2.0, 'glass', 0, 2.35, 3.2, g);                      // windscreen
    box(0.5, 0.5, 2.3, 'desert2', 0, 1.4, 3.4, g);                     // bumper
    box(2.5, 0.9, 3.8, 'desert2', 0, 1.55, -1.3, g);                   // bed
    box(2.1, 0.8, 2.2, 'canvas', 0, 2.4, -1.2, g);                     // cargo
    for (const z of [-3.0, 0.4]) for (const x of [-1.15, 1.15]) box(0.1, 1.9, 0.1, 'metal', x, 2.9, z, g);
    for (const x of [-1.15, 1.15]) box(0.1, 0.1, 3.5, 'metal', x, 3.85, -1.3, g);
    for (const z of [-3.0, 0.4]) box(2.4, 0.1, 0.1, 'metal', 0, 3.85, z, g);
    for (const z of [-2.0, 1.9]) for (const x of [-1.25, 1.25]) {
      const w = wheel(0.6, 0.5, x, 0.6, z, g); p.wheels.push(w); if (z > 0) p.steer.push(w);
    }
    p.ring = ring(3.2, g);
    return { group: g, parts: p, height: 4, radius: 2.2 };
  }

  function apc() {
    const g = group(); const p = { wheels: [], steer: [] };
    box(2.5, 1.0, 7.2, 'desert2', 0, 1.4, 0, g);
    box(2.8, 1.0, 5.8, 'desert', 0, 2.35, 0.2, g);
    box(2.2, 0.6, 1.4, 'desert2', 0, 2.95, 2.6, g);
    box(0.4, 0.4, 0.6, 'glass', -0.6, 2.9, 3.0, g); box(0.4, 0.4, 0.6, 'glass', 0.6, 2.9, 3.0, g);
    p.turret = group(); p.turret.position.set(0, 2.85, -0.3); g.add(p.turret);
    box(1.5, 0.7, 1.7, 'desert', 0, 0.35, 0, p.turret);
    box(0.16, 0.16, 2.4, 'metal', 0.3, 0.45, 1.8, p.turret);
    box(2.9, 0.15, 0.5, 'metal', 0, 1.95, -3.1, g);
    for (let i = 0; i < 4; i++) for (const x of [-1.4, 1.4]) {
      const z = -2.5 + i * 1.6 + (i >= 2 ? 0.3 : 0);
      const w = wheel(0.62, 0.55, x, 0.62, z, g); p.wheels.push(w); if (i >= 2) p.steer.push(w);
    }
    p.ring = ring(3.6, g);
    return { group: g, parts: p, height: 3.9, radius: 2.4 };
  }

  function heli() {
    const g = group(); const p = {};
    const body = group(); g.add(body); p.body = body;
    box(2.2, 1.9, 5.4, 'heli', 0, 1.9, 0, body);
    box(1.9, 1.3, 2.0, 'heli', 0, 1.5, 3.4, body);
    box(1.7, 0.7, 1.3, 'glass', 0, 2.3, 3.0, body);
    box(0.6, 0.9, 1.6, 'glass', -1.12, 1.9, 0.4, body); box(0.6, 0.9, 1.6, 'glass', 1.12, 1.9, 0.4, body);
    box(2.6, 0.5, 2.6, 'heliDark', 0, 3.05, -0.2, body);
    box(3.6, 0.15, 0.9, 'heliDark', 0, 2.0, 1.2, body);
    box(0.8, 0.8, 4.6, 'heli', 0, 2.4, -4.6, body);
    box(0.25, 2.2, 1.1, 'heli', 0, 3.6, -6.6, body);
    box(2.4, 0.12, 0.7, 'heliDark', 0, 2.8, -6.0, body);
    box(0.2, 0.7, 0.2, 'metal', -0.9, 0.5, 2.2, body); box(0.2, 0.7, 0.2, 'metal', 0.9, 0.5, 2.2, body);
    wheel(0.3, 0.25, -0.9, 0.3, 2.2, body); wheel(0.3, 0.25, 0.9, 0.3, 2.2, body); wheel(0.25, 0.25, 0, 0.25, -5.6, body);
    box(0.16, 0.16, 0.16, 'navRed', -1.85, 2.05, 1.2, body); box(0.16, 0.16, 0.16, 'navGreen', 1.85, 2.05, 1.2, body);
    p.beacon = box(0.2, 0.2, 0.2, 'navRed', 0, 4.8, -6.6, body);
    p.rotor = group(); p.rotor.position.set(0, 3.55, -0.2); body.add(p.rotor);
    box(0.5, 0.5, 0.5, 'metal', 0, 0, 0, p.rotor);
    for (let i = 0; i < 4; i++) { const h = group(); h.rotation.y = i * Math.PI / 2; box(0.28, 0.07, 7.2, 'heliDark', 0, 0.1, 3.6, h); p.rotor.add(h); }
    p.tail = group(); p.tail.position.set(0.3, 3.9, -6.8); body.add(p.tail);
    box(0.1, 0.18, 2.2, 'heliDark', 0, 0, 0, p.tail); box(0.1, 2.2, 0.18, 'heliDark', 0, 0, 0, p.tail);
    p.ring = ring(4.5, g);
    return { group: g, parts: p, height: 4.2, radius: 2.8 };
  }

  return { soldier, truck, apc, heli };
}

// sRGB hex colours shared by both back ends' material tables
export const COLORS = {
  skin: 0xc9966b, skin2: 0x7a5236, hair: 0x1a1512, belt: 0x3b3127, boots: 0x3a3127, rifle: 0x1f1f1f,
  heliDark: 0x2e3330, glass: 0x1d2328, tire: 0x1a1a1a, rim: 0x6d6a60, metal: 0x2a2a2a, canvas: 0x6f6448,
};
export const TEXTURED = ['uniform', 'vest', 'desert', 'desert2', 'heli'];
