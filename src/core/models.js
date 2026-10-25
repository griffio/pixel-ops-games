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
  const TEAMED = new Set(['uniform', 'vest', 'desert', 'desert2', 'heli', 'tank']);
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

  // Reference look: 6x6 cargo truck; cab with side glass, mirrors, grille and headlights, an
  // exhaust stack and fuel tank, a netted load with crates on top under the roll frame.
  function truck() {
    const g = group(); const p = { wheels: [], steer: [] };
    box(5.8, 0.5, 2.0, 'metal', 0, 0.85, -0.1, g);                                                 // chassis
    box(2.3, 1.75, 2.4, 'desert', 0, 2.0, 2.0, g);                                                  // cab
    box(2.3, 0.3, 2.4, 'desert2', 0, 2.95, 2.0, g);                                                 // roof
    box(0.1, 0.7, 2.0, 'glass', 0, 2.35, 3.2, g);                                                   // windscreen
    box(0.1, 0.6, 1.0, 'glass', -1.2, 2.4, 1.9, g); box(0.1, 0.6, 1.0, 'glass', 1.2, 2.4, 1.9, g); // side windows
    box(0.12, 0.3, 0.2, 'metal', -1.35, 2.5, 2.9, g); box(0.12, 0.3, 0.2, 'metal', 1.35, 2.5, 2.9, g);   // mirrors
    box(1.6, 0.55, 0.1, 'grille', 0, 1.6, 3.22, g);                                                 // grille
    box(0.3, 0.2, 0.1, 'headlight', -0.9, 1.95, 3.22, g); box(0.3, 0.2, 0.1, 'headlight', 0.9, 1.95, 3.22, g);   // headlights
    box(0.5, 0.5, 2.3, 'desert2', 0, 1.4, 3.4, g);                                                  // bumper
    box(0.14, 1.7, 0.14, 'metal', 1.25, 3.3, 0.75, g);                                              // exhaust stack
    const tank = mesh('cyl:0.36,0.36,1.4,8', 'metal', -1.15, 1.05, -0.4, g); tank.rotation.x = Math.PI / 2;   // fuel tank
    box(2.5, 0.9, 3.8, 'desert2', 0, 1.55, -1.3, g);                                                // bed
    box(2.1, 0.8, 2.6, 'net', 0, 2.4, -1.3, g);                                                     // netted load
    box(0.9, 0.5, 0.7, 'olive', 0.5, 2.95, -0.7, g); box(0.7, 0.4, 0.6, 'canvas', -0.55, 2.95, -2.0, g);   // crates on top
    for (const z of [-3.0, 0.4]) for (const x of [-1.15, 1.15]) box(0.1, 1.9, 0.1, 'metal', x, 2.9, z, g);
    for (const x of [-1.15, 1.15]) box(0.1, 0.1, 3.5, 'metal', x, 3.85, -1.3, g);
    for (const z of [-3.0, 0.4]) box(2.4, 0.1, 0.1, 'metal', 0, 3.85, z, g);
    for (const z of [-2.75, -1.45, 1.9]) for (const x of [-1.25, 1.25]) {
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
    box(0.24, 0.24, 0.3, 'metal', 0.35, 0.45, 3.35, p.turret);                       // muzzle brake
    box(0.3, 0.3, 0.6, 'metal', 0.35, 0.45, 0.9, p.turret);                          // mantlet
    for (const x of [-0.78, 0.78]) for (let i = 0; i < 3; i++) box(0.1, 0.1, 0.3, 'metal', x, 0.7, 0.5 - i * 0.14, p.turret);   // smoke launchers
    box(0.08, 0.1, 0.9, 'metal', -0.35, 0.98, -0.1, p.turret); box(0.1, 0.22, 0.1, 'metal', -0.35, 0.88, -0.45, p.turret);   // pintle MG
    box(0.28, 0.16, 0.1, 'headlight', -1.0, 1.95, 3.84, g); box(0.28, 0.16, 0.1, 'headlight', 1.0, 1.95, 3.84, g);           // headlights
    box(0.4, 0.5, 0.25, 'olive', -0.8, 2.35, -3.98, g); box(0.4, 0.5, 0.25, 'olive', 0.8, 2.35, -3.98, g);                  // jerry cans
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

  // Forward operating base: radio mast, HAB tent and a sandbag ring. Static structure.
  function fob() {
    const g = group(); const p = {};
    box(0.3, 6, 0.3, 'metal', -2.2, 3, -1.5, g); box(1.2, 0.08, 1.2, 'metal', -2.2, 6, -1.5, g); box(0.5, 0.5, 0.5, 'rifle', -2.2, 1.0, -1.5, g);   // mast, dish, radio
    mesh('wedge:6,2.6,4.4,1.2,1.2', 'canvas', 1.2, 1.3, 0.2, g);                                                                                     // tent
    box(2.2, 1.0, 1.4, 'olive', -2.4, 0.5, 1.8, g); box(1.2, 0.7, 0.9, 'canvas', 1.0, 0.35, -2.8, g);                                               // crates
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (i === 9) continue; const h = group(); h.position.set(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2); h.rotation.y = -a; box(2.6, 1.0, 0.9, 'sandbag', 0, 0.5, 0, h); g.add(h); }
    p.ring = ring(6.5, g);
    return { group: g, parts: p, height: 6.4, radius: 5.5 };
  }

  // Weapon cache: crates under a tarp. Static structure.
  function cache() {
    const g = group(); const p = {};
    box(2.4, 1.0, 1.6, 'olive', -0.6, 0.5, 0, g); box(1.6, 0.9, 1.2, 'canvas', 1.2, 0.45, 0.6, g); box(1.2, 0.7, 1.0, 'rifle', 0.8, 0.35, -1.1, g);
    mesh('wedge:4.2,1.4,3.6,1.0,1.0', 'canvas', 0.3, 1.3, 0, g);
    box(0.12, 1.8, 0.12, 'metal', -1.9, 0.9, -1.6, g); box(0.12, 1.8, 0.12, 'metal', 2.3, 0.9, 1.6, g);
    p.ring = ring(3, g);
    return { group: g, parts: p, height: 2.4, radius: 2.2 };
  }

  // Improvised fighting position: a U of sandbags open to the rear, a squad fits inside. Static structure;
  // its obstacle boxes come from sandbagBoxes() below.
  function sandbags() {
    const g = group(); const p = {};
    for (const x of [-2, 0, 2]) box(2, 1.0, 0.9, 'sandbag', x, 0.5, 2.0, g);                                                       // front
    for (const z of [1.0, -0.9]) { box(0.9, 1.0, 2.0, 'sandbag', -3.0, 0.5, z, g); box(0.9, 1.0, 2.0, 'sandbag', 3.0, 0.5, z, g); }   // sides
    box(0.6, 0.35, 0.6, 'olive', 1.2, 0.17, -0.6, g); box(0.5, 0.3, 0.5, 'canvas', -1.4, 0.15, -0.9, g);                             // ammo boxes
    p.ring = ring(4.2, g);
    return { group: g, parts: p, height: 1.2, radius: 3.6 };
  }

  // Reference look: M1 Abrams in tri-colour camo. Low hull with a sloped glacis, side skirts over seven road wheels
  // between checkered track runs; a wide flat turret with stowage bins and a bustle rack; a long 120 mm gun with a fume
  // extractor; commander's and loader's machine guns, gunner's sight, smoke launchers, crosswind sensor and antennas.
  function tank() {
    const g = group(); const p = { wheels: [], steer: [] };
    for (const s of [-1, 1]) {
      const x = s * 1.42;
      box(0.62, 0.22, 6.8, 'trackLinks', x, 0.11, 0, g);                                   // lower track run
      box(0.62, 0.12, 6.5, 'trackLinks', x, 1.0, -0.05, g);                                 // upper track run
      box(0.04, 0.16, 6.7, 'trackEdge', x + s * 0.32, 0.16, 0, g);                           // bright link ends
      for (const z of [3.3, -3.35]) { const sp = mesh('cyl:0.46,0.46,0.6,10', 'trackLinks', x, 0.55, z, g); sp.rotation.z = Math.PI / 2; }   // sprocket and idler
      for (let i = 0; i < 7; i++) { const w = wheel(0.38, 0.42, x, 0.5, -2.6 + i * 0.85, g); p.wheels.push(w); }   // road wheels
      box(0.1, 0.62, 6.9, 'tank', s * 1.78, 0.86, 0.05, g);                                  // side skirt
      box(0.12, 0.2, 0.9, 'tank', s * 1.79, 0.56, 3.2, g);                                    // skirt front lip
    }
    box(2.3, 0.75, 6.8, 'tank', 0, 0.72, 0, g);                                               // lower hull between the tracks
    box(3.56, 0.32, 6.4, 'tank', 0, 1.2, -0.25, g);                                           // deck over hull and tracks
    mesh('wedge:3.56,0.55,1.5,1.25,0', 'tank', 0, 1.1, 3.7, g);                               // sloped glacis
    box(0.32, 0.16, 0.1, 'headlight', -1.35, 1.32, 4.3, g); box(0.32, 0.16, 0.1, 'headlight', 1.35, 1.32, 4.3, g);   // headlight clusters
    box(3.4, 0.75, 0.3, 'tank', 0, 0.98, -3.55, g);                                           // rear plate
    box(0.16, 0.12, 0.06, 'navRed', -1.45, 1.2, -3.72, g); box(0.16, 0.12, 0.06, 'navRed', 1.45, 1.2, -3.72, g);   // tail lights
    box(2.3, 0.06, 1.6, 'grille', 0, 1.39, -2.6, g);                                          // engine deck grille
    box(0.5, 0.3, 0.8, 'tank', -1.4, 1.48, -2.6, g); box(0.5, 0.3, 0.8, 'tank', 1.4, 1.48, -2.6, g);   // deck stowage boxes
    p.turret = group(); p.turret.position.set(0, 1.36, -0.35); g.add(p.turret);
    const T = p.turret;
    mesh('wedge:3.1,0.75,2.6,1.25,0', 'tank', 0, 0.375, 0.95, T);                            // faceted turret front
    box(3.1, 0.75, 1.9, 'tank', 0, 0.375, -1.25, T);                                          // turret rear
    for (const s of [-1, 1]) {
      box(0.36, 0.5, 1.7, 'tank', s * 1.7, 0.4, -0.95, T);                                    // side stowage bins
      box(0.36, 0.28, 0.3, 'metal', s * 1.6, 0.58, 0.85, T); box(0.36, 0.28, 0.3, 'metal', s * 1.6, 0.28, 0.85, T);   // smoke launchers
      box(0.06, 0.45, 1.05, 'metal', s * 1.5, 0.72, -2.6, T);                                 // bustle rack rails
    }
    box(3.0, 0.08, 1.05, 'metal', 0, 0.5, -2.6, T); box(3.0, 0.06, 0.06, 'metal', 0, 0.95, -3.1, T);   // bustle rack floor and back rail
    box(2.5, 0.38, 0.85, 'canvas', 0, 0.73, -2.6, T); box(0.7, 0.3, 0.5, 'olive', 0.7, 1.05, -2.5, T);   // stowage in the rack
    box(1.0, 0.55, 0.45, 'tank', 0, 0.36, 2.4, T);                                            // mantlet
    box(0.26, 0.26, 4.4, 'tank', 0, 0.4, 4.7, T);                                             // 120 mm gun
    box(0.4, 0.4, 0.9, 'tank', 0, 0.4, 4.1, T);                                               // fume extractor
    box(0.32, 0.32, 0.2, 'metal', 0, 0.4, 6.95, T);                                           // muzzle
    box(0.8, 0.35, 0.8, 'tank', 0.75, 0.92, -0.5, T); box(0.5, 0.1, 0.12, 'glass', 0.75, 0.98, -0.08, T);   // commander's cupola
    box(0.15, 0.28, 0.15, 'metal', 0.75, 1.2, -0.45, T); box(0.09, 0.11, 1.15, 'metal', 0.75, 1.33, 0.05, T);   // commander's machine gun
    box(0.7, 0.12, 0.7, 'tank', -0.75, 0.81, -0.35, T);                                       // loader's hatch
    box(0.08, 0.26, 0.08, 'metal', -0.75, 0.98, -0.3, T); box(0.08, 0.1, 0.95, 'metal', -0.75, 1.1, 0.12, T);   // loader's machine gun
    box(0.5, 0.35, 0.42, 'tank', -0.6, 0.92, 1.05, T); box(0.38, 0.2, 0.04, 'glass', -0.6, 0.94, 1.27, T);   // gunner's sight
    box(0.32, 0.4, 0.32, 'tank', 0.35, 0.95, 0.55, T);                                         // commander's thermal viewer
    box(0.07, 0.6, 0.07, 'metal', 0.15, 1.05, -0.95, T); box(0.16, 0.08, 0.16, 'metal', 0.15, 1.36, -0.95, T);   // crosswind sensor
    box(0.04, 1.9, 0.04, 'metal', -1.2, 1.7, -1.7, T); box(0.04, 1.5, 0.04, 'metal', 1.25, 1.5, -1.75, T);   // antennas
    p.ring = ring(4.4, g);
    return { group: g, parts: p, height: 3.4, radius: 2.6 };
  }

  // Rally point: a radio pack on the ground and a short pole with a pennant in the team's camo. Static structure.
  function rally() {
    const g = group(); const p = {};
    box(0.5, 0.35, 0.3, 'canvas', 0, 0.17, 0, g); box(0.3, 0.25, 0.2, 'rifle', 0.05, 0.47, 0, g);   // pack and radio
    box(0.06, 1.8, 0.06, 'metal', -0.45, 0.9, 0, g); box(0.5, 0.32, 0.04, 'desert', -0.2, 1.62, 0, g);   // pole and pennant
    p.ring = ring(1.4, g);
    return { group: g, parts: p, height: 1.9, radius: 0.6 };
  }

  // each builder takes the team so the whole model picks the right camo set
  const forTeam = (fn) => (t = 0) => { team = t; const r = fn(); team = 0; return r; };
  return { soldier: forTeam(soldier), truck: forTeam(truck), apc: forTeam(apc), heli: forTeam(heli), fob: forTeam(fob), cache: forTeam(cache), sandbags: forTeam(sandbags), rally: forTeam(rally), tank: forTeam(tank) };



}

// world-space obstacle boxes (low cover, 1 m high) for a sandbag position at (x,z) facing heading h. Each bag
// is cut into 0.5 m pieces so the axis-aligned boxes hug a wall at any heading and leave the inside open.
export function sandbagBoxes(x, z, h) {
  const c = Math.cos(h), s = Math.sin(h), out = [];
  const piece = (lx, lz, w, d) => { const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c, hw = (w * Math.abs(c) + d * Math.abs(s)) / 2, hd = (w * Math.abs(s) + d * Math.abs(c)) / 2; out.push({ minX: wx - hw, maxX: wx + hw, minZ: wz - hd, maxZ: wz + hd, h: 1.0 }); };
  for (let lx = -2.75; lx <= 2.75; lx += 0.5) piece(lx, 2.0, 0.5, 0.9);                       // front wall, 6 m
  for (let lz = -1.65; lz <= 1.75; lz += 0.5) { piece(-3.0, lz, 0.9, 0.5); piece(3.0, lz, 0.9, 0.5); }   // sides, 3.9 m
  return out;
}

// sRGB hex colours shared by both back ends' material tables
export const COLORS = {
  skin: 0xc9966b, skin2: 0x7a5236, hair: 0x1a1512, belt: 0x3b3127, boots: 0x3a3127, rifle: 0x1f1f1f,
  heliDark: 0x2e3330, olive: 0x5c6b3f, sandbag: 0x9c8b64, glass: 0x1d2328, tire: 0x1a1a1a, rim: 0x8a877c, metal: 0x2a2a2a, canvas: 0x6f6448,
  hub: 0xb9b5a8, tread: 0x2c2c2c, headlight: 0xf2ecd0, grille: 0x171717,
};
export const TEXTURED = ['uniform', 'vest', 'desert', 'desert2', 'heli', 'trunk', 'frond', 'bush', 'uniformB', 'vestB', 'desertB', 'desert2B', 'heliB', 'wreck', 'net', 'tank', 'tankB', 'trackLinks', 'trackEdge'];
