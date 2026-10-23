import { rng } from './math.js';

// Unit models defined once for both back ends. A back end supplies a factory F:
//   F.group()                              -> empty transform node
//   F.box(w, h, d, matName, x, y, z, parent) -> box mesh
//   F.wheel(r, w, x, y, z, parent)         -> spinning wheel group (axle along X)
//   F.mesh(geoKey, matName, x, y, z, parent) -> mesh of any geometry key
//   F.ring(radius, parent)                 -> hidden selection ring
// Local +Z is forward. Sizes are world units; at 10 texels/unit a soldier is ~23 texels tall.
export function makeBuilders(F) {
  // Material names resolve per team: OPFOR (team 1) uses the 'B' recolour when one exists.
  const TEAMED = new Set(['uniform', 'vest', 'desert', 'desert2', 'heli']);
  let team = 0;
  const mat = (n) => (team === 1 && TEAMED.has(n) ? n + 'B' : n);
  const group = F.group;
  const box = (w, h, d, m, x, y, z, parent) => F.box(w, h, d, mat(m), x, y, z, parent);
  const mesh = (geo, m, x, y, z, parent) => F.mesh(geo, mat(m), x, y, z, parent);
  const wheel = F.wheel, ring = F.ring;


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

  // Reference look: sloped glacis, roof hatches, side stowage, olive rear ramp, big rimmed wheels.
  function apc() {
    const g = group(); const p = { wheels: [], steer: [] };
    box(2.7, 1.1, 7.6, 'desert2', 0, 1.65, 0, g);                                   // lower hull
    mesh('wedge:2.9,1.15,7.0,1.6,0.5', 'desert', 0, 2.75, 0.1, g);                  // upper hull, sloped front
    mesh('wedge:2.5,0.35,2.2,0.9,0', 'desert2', 0, 3.4, 1.6, g);                    // driver hump
    box(0.5, 0.08, 0.7, 'desert2', -0.8, 3.37, 0.9, g); box(0.5, 0.08, 0.7, 'desert2', 0.8, 3.37, 0.9, g);   // hatches
    box(0.4, 0.4, 0.5, 'glass', -0.7, 3.1, 2.7, g); box(0.4, 0.4, 0.5, 'glass', 0.7, 3.1, 2.7, g);          // vision blocks
    p.turret = group(); p.turret.position.set(0, 3.33, -0.5); g.add(p.turret);
    mesh('wedge:1.7,0.75,2.0,0.6,0.3', 'desert', 0, 0.37, 0, p.turret);
    box(0.7, 0.1, 0.7, 'desert2', -0.35, 0.78, -0.3, p.turret);                     // commander hatch
    box(0.16, 0.16, 2.8, 'metal', 0.35, 0.45, 2.0, p.turret);                        // gun
    box(0.3, 0.3, 0.6, 'metal', 0.35, 0.45, 0.9, p.turret);                          // mantlet
    box(0.35, 0.45, 2.4, 'canvas', -1.6, 2.9, -1.2, g); box(0.35, 0.45, 2.4, 'canvas', 1.6, 2.9, -1.2, g);   // side stowage
    box(2.4, 1.3, 0.18, 'olive', 0, 2.3, -3.85, g);                                   // rear ramp
    box(0.06, 1.8, 0.06, 'metal', -1.1, 4.2, -2.6, g);                               // antenna
    for (let i = 0; i < 4; i++) for (const x of [-1.45, 1.45]) {
      const w = wheel(0.8, 0.62, x, 0.8, [-2.7, -1.35, 0.95, 2.35][i], g); p.wheels.push(w); if (i >= 2) p.steer.push(w);
    }
    p.ring = ring(3.8, g);
    return { group: g, parts: p, height: 4.6, radius: 2.5 };
  }

  // Reference look: grey utility helicopter, tapered nose and boom, side windows, rotor
  // that turns into a translucent disc at speed.
  function heli() {
    const g = group(); const p = {};
    const body = group(); g.add(body); p.body = body;
    box(2.3, 1.9, 4.6, 'heli', 0, 1.95, -0.2, body);                                  // cabin
    mesh('frustum:1.4,1.2,2.6,2.3,1.9', 'heli', 0, 1.75, 3.4, body);                  // nose
    mesh('wedge:1.9,0.75,1.5,1.0,0', 'glass', 0, 2.55, 3.0, body);                    // windscreen
    box(0.5, 0.7, 1.4, 'glass', -1.17, 2.2, 0.5, body); box(0.5, 0.7, 1.4, 'glass', 1.17, 2.2, 0.5, body);   // cabin doors
    box(0.5, 0.6, 0.9, 'glass', -1.17, 2.3, 1.9, body); box(0.5, 0.6, 0.9, 'glass', 1.17, 2.3, 1.9, body);   // cockpit windows
    mesh('frustum:2.2,0.7,2.6,1.6,0.5', 'heliDark', 0, 3.2, -0.9, body);               // engine deck
    box(3.6, 0.15, 0.9, 'heliDark', 0, 2.1, 1.0, body);                                 // stub wings
    box(0.3, 0.3, 0.9, 'metal', -1.9, 2.0, 1.0, body); box(0.3, 0.3, 0.9, 'metal', 1.9, 2.0, 1.0, body);     // pods
    mesh('frustum:0.9,1.0,5.2,0.5,0.6', 'heli', 0, 2.5, -5.1, body);                    // tail boom
    box(0.25, 2.3, 1.1, 'heli', 0, 3.6, -7.3, body);                                     // fin
    box(2.6, 0.12, 0.8, 'heliDark', 0, 2.3, -7.6, body);                                 // stabilator
    box(0.2, 0.7, 0.2, 'metal', -0.9, 0.5, 2.0, body); box(0.2, 0.7, 0.2, 'metal', 0.9, 0.5, 2.0, body);     // gear legs
    box(0.15, 1.8, 0.15, 'metal', 0, 1.2, -6.3, body);                                   // tail strut
    wheel(0.3, 0.25, -0.9, 0.3, 2.0, body); wheel(0.3, 0.25, 0.9, 0.3, 2.0, body); wheel(0.25, 0.25, 0, 0.25, -6.3, body);
    box(0.16, 0.16, 0.16, 'navRed', -1.85, 2.15, 1.0, body); box(0.16, 0.16, 0.16, 'navGreen', 1.85, 2.15, 1.0, body);
    p.beacon = box(0.2, 0.2, 0.2, 'navRed', 0, 4.85, -7.3, body);
    p.rotor = group(); p.rotor.position.set(0, 3.75, -0.5); body.add(p.rotor);
    box(0.5, 0.5, 0.5, 'metal', 0, 0, 0, p.rotor);
    p.blades = group(); p.rotor.add(p.blades);
    for (let i = 0; i < 4; i++) { const h = group(); h.rotation.y = i * Math.PI / 2; box(0.3, 0.07, 7.4, 'heliDark', 0, 0.1, 3.7, h); p.blades.add(h); }
    p.disc = mesh('cyl:7.4,7.4,0.05,24', 'rotorBlur', 0, 0.1, 0, p.rotor); p.disc.visible = false;
    p.tail = group(); p.tail.position.set(0.3, 3.9, -7.5); body.add(p.tail);
    box(0.1, 0.18, 2.2, 'heliDark', 0, 0, 0, p.tail); box(0.1, 2.2, 0.18, 'heliDark', 0, 0, 0, p.tail);
    p.ring = ring(4.5, g);
    return { group: g, parts: p, height: 4.4, radius: 2.8 };
  }

  // each builder takes the team so the whole model picks the right camo set
  const forTeam = (fn) => (t = 0) => { team = t; const r = fn(); team = 0; return r; };
  return { soldier: forTeam(soldier), truck: forTeam(truck), apc: forTeam(apc), heli: forTeam(heli) };


}

// sRGB hex colours shared by both back ends' material tables
export const COLORS = {
  skin: 0xc9966b, skin2: 0x7a5236, hair: 0x1a1512, belt: 0x3b3127, boots: 0x3a3127, rifle: 0x1f1f1f,
  heliDark: 0x2e3330, olive: 0x5c6b3f, glass: 0x1d2328, tire: 0x1a1a1a, rim: 0x8a877c, metal: 0x2a2a2a, canvas: 0x6f6448,
};
export const TEXTURED = ['uniform', 'vest', 'desert', 'desert2', 'heli', 'trunk', 'frond', 'bush', 'uniformB', 'vestB', 'desertB', 'desert2B', 'heliB', 'wreck'];
