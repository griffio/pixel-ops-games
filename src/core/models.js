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
  const TEAMED = new Set(['uniform', 'vest', 'desert', 'camo', 'sand', 'tarp', 'rim', 'boots']);
  let team = 0;
  const mat = (n) => (team === 1 && TEAMED.has(n) ? n + 'B' : n);
  const group = F.group;
  const box = (w, h, d, m, x, y, z, parent) => F.box(w, h, d, mat(m), x, y, z, parent);
  const mesh = (geo, m, x, y, z, parent) => F.mesh(geo, mat(m), x, y, z, parent);
  const wheel = (r, w, x, y, z, parent) => F.wheel(r, w, x, y, z, parent, mat('rim')), ring = F.ring;
  // Sandbags laid lengthways in a running bond (len along the stack's x), the top course two bags deep, the same as the
  // map's sandbag walls (maps/desert1km.js bagStack).
  const BAGS = ['sandbag', 'sandbag2', 'sandbag3'];
  function bagStack(len, h, depth, x, z, rotY, parent) {
    const s = group(); s.position.set(x, 0, z); s.rotation.y = rotY; parent.add(s);
    const rows = Math.round(h / 0.24), rh = h / rows, bh = +(rh - 0.05).toFixed(3);
    const ch = +(h - rh + 0.02).toFixed(2); box(+(len - 0.08).toFixed(2), ch, +(depth - 0.1).toFixed(2), 'bagCore', 0, ch / 2, 0, s);   // dark core up to the top course, behind the joints
    for (let row = 0; row < rows; row++) {
      const top = row === rows - 1;
      for (let u = -len / 2 - (row % 2 ? 0.3 : 0); u < len / 2 - 1e-3; u += 0.6) {
        const a = Math.max(u, -len / 2), b = Math.min(u + 0.6, len / 2), w = +(b - a - 0.06).toFixed(2); if (w < 0.1) continue;
        const m = BAGS[Math.floor(rng() * 3)], y = row * rh + rh / 2;
        if (top) for (const k of [-1, 1]) box(w, bh, +(depth / 2 - 0.03).toFixed(2), m, (a + b) / 2, y, k * depth / 4, s);
        else box(w, bh, depth, m, (a + b) / 2, y, 0, s);
      }
    }
    return s;
  }


  // Reference look: modern infantryman in multicam. High-cut helmet with an NVG shroud, rails and ear defenders,
  // tinted glasses; a plate carrier with magazine pouches over the jacket, a first-aid pouch with a red cross on the
  // belt, thigh pouches, knee pads and coyote boots; a pack with a radio antenna. The arms have elbows so both hands
  // stay on a carbine with an optic and foregrip (units.js solves them per pose: carried, shouldered, prone). Machine
  // gunners carry a belt-fed gun with a bipod instead; anti-tank soldiers add a recoilless launcher, slung until they
  // have a target (units.js shows the weapons each kit carries).
  function soldier() {
    const g = group(); const p = {};
    const skin = rng() < 0.5 ? 'skin' : 'skin2';
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? -1 : 1;
      const hip = group(); hip.position.set(s * 0.15, 1.1, 0);
      box(0.22, 0.52, 0.26, 'uniform', 0, -0.26, 0, hip);                          // thigh
      box(0.08, 0.2, 0.18, 'vest', s * 0.14, -0.28, 0, hip);                       // thigh pouch
      const knee = group(); knee.position.set(0, -0.52, 0); hip.add(knee);
      box(0.2, 0.5, 0.23, 'uniform', 0, -0.25, 0, knee);                           // shin
      box(0.2, 0.15, 0.06, 'vest', 0, -0.06, 0.13, knee);                          // knee pad
      box(0.24, 0.14, 0.34, 'boots', 0, -0.55, 0.04, knee); box(0.22, 0.1, 0.25, 'boots', 0, -0.45, 0, knee);   // boot
      g.add(hip); p['leg' + side] = hip; p['knee' + side] = knee;
    }
    p.torso = group(); p.torso.position.y = 1.1; g.add(p.torso); const T = p.torso;
    box(0.54, 0.78, 0.3, 'uniform', 0, 0.39, 0, T);                                 // jacket
    box(0.5, 0.48, 0.1, 'vest', 0, 0.47, 0.18, T); box(0.48, 0.5, 0.08, 'vest', 0, 0.47, -0.18, T);   // plate carrier, front and back
    box(0.58, 0.2, 0.32, 'vest', 0, 0.3, 0, T);                                     // cummerbund
    for (const x of [-0.15, 0, 0.15]) box(0.12, 0.18, 0.07, 'vest', x, 0.33, 0.255, T);   // magazine pouches
    box(0.58, 0.09, 0.33, 'belt', 0, 0.06, 0, T);                                   // belt
    box(0.16, 0.12, 0.08, 'olive', 0.06, 0.07, 0.2, T); box(0.07, 0.07, 0.02, 'medRed', 0.06, 0.08, 0.245, T);   // first-aid pouch
    box(0.08, 0.14, 0.12, 'vest', 0.3, 0.05, 0.05, T);                              // hip pouch
    box(0.42, 0.5, 0.2, 'uniform', 0, 0.5, -0.32, T); box(0.38, 0.12, 0.18, 'uniform', 0, 0.8, -0.31, T);   // pack and its lid
    box(0.03, 0.6, 0.03, 'gun', 0.14, 1.05, -0.37, T);                              // radio antenna
    box(0.14, 0.08, 0.14, skin, 0, 0.82, 0.02, T);                                  // neck
    p.head = group(); p.head.position.set(0, 0.84, 0.02); T.add(p.head); const H = p.head;
    box(0.3, 0.3, 0.3, skin, 0, 0.14, 0, H);                                        // face
    box(0.26, 0.07, 0.03, 'glass', 0, 0.17, 0.16, H);                               // glasses
    box(0.36, 0.17, 0.38, 'uniform', 0, 0.3, -0.01, H); box(0.37, 0.12, 0.3, 'uniform', 0, 0.21, -0.05, H);   // helmet
    box(0.1, 0.09, 0.05, 'gun', 0, 0.29, 0.2, H);                                   // NVG shroud
    for (const s of [-1, 1]) { box(0.03, 0.06, 0.2, 'gun', s * 0.19, 0.24, 0, H); box(0.05, 0.12, 0.12, 'gun', s * 0.165, 0.12, 0, H); }   // rails, ear defenders
    for (const side of ['L', 'R']) {
      const arm = group(); arm.position.set(side === 'L' ? -0.34 : 0.34, 0.72, 0); T.add(arm);
      box(0.18, 0.4, 0.2, 'uniform', 0, -0.19, 0, arm);                            // upper arm
      const el = group(); el.position.set(0, -0.38, 0); arm.add(el);
      box(0.17, 0.32, 0.19, 'uniform', 0, -0.16, 0, el);                           // forearm
      box(0.15, 0.13, 0.16, skin, 0, -0.38, 0, el);                                // hand
      p['arm' + side] = arm; p['elbow' + side] = el;
    }
    p.rifle = group(); T.add(p.rifle); const R = p.rifle;                           // carbine: +z down the barrel, the stock butt at z -0.4
    box(0.07, 0.12, 0.36, 'gun', 0, 0, 0, R);                                       // receiver
    box(0.075, 0.09, 0.26, 'gun', 0, 0, 0.31, R);                                   // handguard
    box(0.035, 0.035, 0.14, 'gun', 0, 0, 0.51, R); box(0.05, 0.05, 0.05, 'gun', 0, 0, 0.6, R);   // barrel, flash hider
    box(0.07, 0.12, 0.22, 'gun', 0, -0.03, -0.29, R);                               // stock
    box(0.06, 0.17, 0.09, 'gun', 0, -0.13, 0.06, R);                                // magazine
    box(0.05, 0.12, 0.06, 'gun', 0, -0.1, -0.08, R);                                // pistol grip
    box(0.06, 0.08, 0.12, 'gun', 0, 0.1, 0.02, R);                                  // optic
    box(0.04, 0.1, 0.05, 'gun', 0, -0.09, 0.3, R);                                  // foregrip
    p.mg = group(); T.add(p.mg); const M = p.mg;                                    // belt-fed machine gun, the same butt as the carbine
    box(0.09, 0.15, 0.42, 'gun', 0, 0, 0, M);                                       // receiver
    box(0.09, 0.04, 0.22, 'gun', 0, 0.09, 0.02, M); box(0.03, 0.05, 0.13, 'gun', 0, 0.14, 0.1, M);   // feed cover, carry handle
    box(0.08, 0.08, 0.18, 'gun', 0, 0.01, 0.3, M);                                  // handguard
    box(0.045, 0.045, 0.34, 'gun', 0, 0.01, 0.55, M); box(0.06, 0.06, 0.05, 'gun', 0, 0.01, 0.74, M);   // barrel, flash hider
    box(0.08, 0.13, 0.22, 'gun', 0, -0.03, -0.31, M);                               // stock
    box(0.05, 0.12, 0.06, 'gun', 0, -0.11, -0.08, M);                               // pistol grip
    box(0.14, 0.16, 0.16, 'olive', 0.02, -0.14, 0.05, M);                           // ammo pouch
    p.bipod = group(); p.bipod.position.set(0, -0.03, 0.62); M.add(p.bipod);
    for (const s of [-1, 1]) box(0.025, 0.025, 0.3, 'gun', s * 0.035, 0, -0.15, p.bipod);   // bipod legs, folded back under the barrel
    p.launcher = group(); T.add(p.launcher); const L = p.launcher;                  // recoilless launcher: +z out of the muzzle
    box(0.14, 0.14, 1.1, 'launcher', 0, 0, 0, L);                                   // tube
    box(0.2, 0.2, 0.2, 'gun', 0, 0, -0.62, L); box(0.17, 0.17, 0.06, 'gun', 0, 0, 0.56, L);   // venturi, muzzle ring
    box(0.05, 0.12, 0.06, 'gun', 0, -0.12, 0, L); box(0.05, 0.12, 0.06, 'gun', 0, -0.12, 0.27, L);   // trigger and front grips
    box(0.1, 0.1, 0.2, 'gun', 0, -0.1, -0.16, L);                                   // shoulder pad
    box(0.06, 0.1, 0.14, 'gun', 0.1, 0.06, 0.12, L);                                // sight, on the left of the tube
    p.ring = ring(0.8, g);
    return { group: g, parts: p, height: 2.4, radius: 0.45 };
  }

  // Reference look: 6x6 cargo truck in tri-colour camo. Square cab with a split windscreen, grille, mirrors on arms,
  // a roof antenna and a louvred air intake behind the door; a spare wheel behind the cab; a drop-side bed under a
  // canvas cover on hoops. The supply truck rolls its side curtains up over its load (crates, cases, jerry cans,
  // drums); a plain truck keeps them down, so the two read apart.
  function truck(supply) {
    const g = group(); const p = { wheels: [], steer: [] };
    const load = (w, h, d, m, x, z, y0 = 1.45) => box(w, h, d, m, x, y0 + h / 2, z, g);          // cargo standing on the bed
    box(1.3, 0.35, 6.6, 'metal', 0, 0.8, -0.2, g);                                                  // chassis rails
    box(2.4, 1.35, 2.05, 'camo', 0, 1.65, 2.32, g);                                                 // lower cab and hood
    box(2.4, 0.7, 1.8, 'camo', 0, 2.68, 2.2, g);                                                    // glasshouse
    box(2.46, 0.12, 1.9, 'camo', 0, 3.09, 2.2, g);                                                  // roof
    box(1.6, 0.7, 0.06, 'grille', 0, 1.62, 3.36, g);                                                // grille
    for (let i = 0; i < 4; i++) box(1.6, 0.05, 0.04, 'camo', 0, 1.36 + i * 0.17, 3.4, g);           // grille bars
    box(2.56, 0.32, 0.32, 'camo', 0, 1.05, 3.5, g);                                                 // bumper
    for (const s of [-1, 1]) {
      box(0.98, 0.52, 0.06, 'glass', s * 0.55, 2.7, 3.11, g);                                       // split windscreen
      box(0.06, 0.48, 0.85, 'glass', s * 1.21, 2.7, 2.45, g);                                       // door windows
      box(0.3, 0.22, 0.06, 'headlight', s * 0.95, 2.05, 3.37, g); box(0.14, 0.14, 0.06, 'amber', s * 0.95, 1.82, 3.37, g);   // headlight, indicator
      box(0.06, 0.5, 0.26, 'metal', s * 1.45, 2.65, 2.95, g); box(0.26, 0.04, 0.04, 'metal', s * 1.31, 2.8, 2.95, g);         // mirror on its arm
      box(0.1, 0.25, 0.3, 'metal', s * 0.75, 0.95, 3.7, g);                                         // tow hook
      box(0.5, 0.12, 0.35, 'metal', s * 1.0, 1.0, 1.75, g);                                         // cab step
      box(0.5, 0.5, 0.05, 'metal', s * 1.12, 0.6, -3.25, g);                                        // mud flap
      box(0.14, 0.2, 0.06, 'navRed', s * 1.1, 1.3, -3.69, g);                                       // tail light
    }
    box(0.05, 1.5, 0.05, 'metal', 0.7, 3.9, 2.8, g); box(0.14, 0.1, 0.14, 'metal', 0.7, 3.17, 2.8, g);   // antenna
    box(0.4, 1.25, 0.65, 'camo', 0.95, 2.0, 1.0, g);                                                // air intake behind the cab
    for (let i = 0; i < 6; i++) box(0.03, 0.05, 0.5, 'grille', 1.165, 1.55 + i * 0.17, 1.0, g);     // its louvres
    wheel(0.55, 0.38, -0.35, 2.45, 1.05, g);                                                        // spare wheel
    const tank = mesh('cyl:0.3,0.3,1.1,8', 'camo', -1.0, 0.85, 0.3, g); tank.rotation.x = Math.PI / 2;   // fuel tank
    box(0.45, 0.45, 0.8, 'camo', 1.0, 0.85, 0.3, g);                                                // battery box
    // drop-side bed (z 0.85..-3.65)
    box(2.5, 0.2, 4.5, 'camo', 0, 1.35, -1.4, g);
    for (const s of [-1, 1]) { box(0.08, 0.55, 4.5, 'camo', s * 1.25, 1.72, -1.4, g); box(0.04, 0.06, 4.5, 'sand', s * 1.29, 1.6, -1.4, g); box(0.04, 0.06, 4.5, 'sand', s * 1.29, 1.85, -1.4, g); }
    box(2.5, 0.55, 0.08, 'camo', 0, 1.72, -3.64, g);                                                // tailgate
    box(2.5, 1.25, 0.1, 'camo', 0, 2.07, 0.82, g);                                                  // headboard
    // canvas cover on five hoops
    for (const z of [0.72, -0.4, -1.52, -2.64, -3.55]) for (const s of [-1, 1]) box(0.08, 1.75, 0.08, 'tarp', s * 1.21, 2.82, z, g);
    box(2.6, 0.16, 4.45, 'tarp', 0, 3.68, -1.4, g); box(2.3, 0.1, 4.45, 'tarp', 0, 3.8, -1.4, g);   // roof and crown
    for (const z of [-0.4, -1.52, -2.64]) box(2.64, 0.2, 0.1, 'tarp', 0, 3.68, z, g);               // seams over the hoops
    box(2.5, 1.7, 0.06, 'tarp', 0, 2.82, 0.78, g);                                                  // front panel
    if (supply) {
      for (const s of [-1, 1]) box(0.16, 0.24, 4.45, 'tarp', s * 1.3, 3.48, -1.4, g);               // curtains rolled up
      box(2.5, 0.24, 0.24, 'tarp', 0, 3.48, -3.6, g);                                               // rear flap rolled up
      load(1.0, 0.7, 0.7, 'wood', 0.6, 0.4); load(0.9, 0.55, 0.65, 'case', -0.6, 0.4); load(0.8, 0.4, 0.6, 'case', -0.6, 0.4, 2.0);
      load(1.0, 0.5, 0.7, 'olive', 0.6, -0.5); load(0.9, 0.45, 0.6, 'olive', 0.6, -0.5, 1.95); load(1.0, 0.8, 0.8, 'olive', -0.6, -0.55);
      load(1.1, 0.9, 0.8, 'wood', 0.55, -1.55); load(0.9, 0.6, 0.7, 'case', -0.6, -1.5); load(0.7, 0.5, 0.6, 'wood', -0.6, -1.5, 2.05);
      for (let i = 0; i < 3; i++) load(0.18, 0.5, 0.36, 'olive', 0.35 + i * 0.24, -2.5);           // jerry cans
      load(0.9, 0.7, 0.8, 'wood', -0.6, -2.5);
      for (const x of [0.75, 0.15, -0.45]) mesh('cyl:0.28,0.28,0.85,8', 'drum', x, 1.88, -3.15, g);   // drums
      load(0.45, 0.55, 0.6, 'case', -0.95, -3.15);
    } else {
      for (const s of [-1, 1]) box(0.06, 1.6, 4.45, 'tarp', s * 1.27, 2.8, -1.4, g);               // curtains down
      box(2.5, 1.6, 0.06, 'tarp', 0, 2.8, -3.6, g);                                                 // rear flap down
    }
    for (const z of [2.3, -1.25, -2.5]) for (const x of [-1.12, 1.12]) {
      const w = wheel(0.62, 0.5, x, 0.62, z, g); p.wheels.push(w); if (z > 0) p.steer.push(w);
    }
    p.ring = ring(3.4, g);
    return { group: g, parts: p, height: 4, radius: 2.2 };
  }

  // Reference look: 8x8 wheeled carrier in tri-colour camo. Slab-sided hull over eight big wheels, a long sloped glacis
  // with the driver's hatch, raised roof hatches in lighter plate, a slotted stowage rail along each roof edge, a remote
  // weapon station with a heavy gun, width-marker posts at the nose, a stowage cage and two tall antennas at the rear.
  function apc() {
    const g = group(); const p = { wheels: [], steer: [] };
    box(2.0, 0.9, 6.2, 'camo', 0, 0.95, -0.4, g);                                                   // belly between the wheels
    box(3.0, 1.15, 5.3, 'camo', 0, 1.975, -0.85, g);                                                // hull (roof at 2.55, z -3.5..1.8)
    mesh('wedge:3.0,1.15,1.6,1.5,0', 'camo', 0, 1.975, 2.6, g);                                     // glacis down to the nose
    const nose = mesh('wedge:2.4,0.85,1.4,0.7,0', 'camo', 0, 0.975, 2.7, g); nose.rotation.z = Math.PI;   // lower nose, sloping back underneath
    box(2.8, 0.35, 0.2, 'camo', 0, 1.42, 3.32, g);                                                  // nose plate
    box(0.75, 0.3, 0.7, 'camo', 0.7, 2.45, 2.15, g); box(0.6, 0.06, 0.55, 'sand', 0.7, 2.63, 2.15, g);   // driver's hatch
    box(0.5, 0.1, 0.06, 'glass', 0.7, 2.5, 2.51, g);                                                // driver's periscopes
    box(0.5, 0.15, 0.4, 'camo', -0.9, 2.62, 1.3, g);                                                // roof vent
    box(0.9, 0.22, 0.9, 'camo', 0.55, 2.66, -0.2, g); box(0.7, 0.06, 0.7, 'sand', 0.55, 2.8, -0.2, g);   // commander's cupola
    box(0.5, 0.08, 0.04, 'glass', 0.55, 2.7, 0.26, g);
    for (const x of [-0.62, 0.62]) for (const z of [-1.35, -2.45]) { box(1.0, 0.1, 0.95, 'camo', x, 2.6, z, g); box(0.8, 0.08, 0.75, 'sand', x, 2.66, z, g); }   // troop hatches
    for (const s of [-1, 1]) {
      box(0.14, 0.32, 4.6, 'sand', s * 1.43, 2.7, -1.05, g);                                        // stowage rail along the roof edge
      for (let i = 0; i < 9; i++) box(0.04, 0.12, 0.26, 'grille', s * 1.505, 2.72, -3.05 + i * 0.5, g);   // its slots
      for (let i = 0; i < 4; i++) box(0.04, 0.45, 0.07, 'grille', s * 1.51, 2.05, 1.17 + i * 0.12, g);   // engine grille slats
      box(0.03, 0.12, 1.4, 'grille', s * 1.51, 1.62, 0.2, g);                                       // recess
      box(0.05, 0.05, 1.6, 'metal', s * 1.55, 1.95, -2.4, g);                                       // grab rail
      box(0.42, 0.26, 0.12, 'grille', s * 1.1, 1.42, 3.44, g); box(0.16, 0.14, 0.06, 'headlight', s * 1.0, 1.42, 3.5, g); box(0.12, 0.12, 0.06, 'amber', s * 1.22, 1.42, 3.5, g);   // light cluster
      box(0.14, 0.22, 0.2, 'metal', s * 0.7, 0.95, 3.2, g);                                         // tow hook
      box(0.05, 0.7, 0.05, 'metal', s * 1.38, 1.95, 3.15, g); box(0.04, 0.22, 0.2, 'olive', s * 1.38, 2.3, 3.15, g);   // width-marker post
      box(0.15, 0.2, 0.06, 'navRed', s * 1.3, 2.1, -3.53, g);                                       // tail light
    }
    box(2.2, 1.6, 0.06, 'camo', 0, 1.65, -3.53, g);                                                 // rear ramp
    for (const x of [-0.35, -1.35]) for (const z of [-2.8, -3.4]) box(0.05, 0.45, 0.05, 'sand', x, 2.78, z, g);   // stowage cage
    for (const z of [-2.8, -3.4]) box(1.0, 0.05, 0.05, 'sand', -0.85, 3.0, z, g);
    for (const x of [-0.35, -1.35]) box(0.05, 0.05, 0.6, 'sand', x, 3.0, -3.1, g);
    box(0.6, 0.25, 0.4, 'canvas', -0.85, 2.68, -3.1, g);
    box(0.14, 0.14, 0.14, 'metal', -1.25, 2.62, -3.25, g); box(0.06, 1.5, 0.06, 'metal', -1.25, 3.4, -3.25, g);   // antennas
    box(0.14, 0.14, 0.14, 'metal', 1.15, 2.62, -2.9, g); box(0.06, 1.1, 0.06, 'metal', 1.15, 3.2, -2.9, g);
    // remote weapon station
    p.turret = group(); p.turret.position.set(-0.35, 2.55, 0.6); g.add(p.turret); const T = p.turret;
    mesh('cyl:0.32,0.36,0.2,8', 'metal', 0, 0.1, 0, T);
    box(0.55, 0.45, 0.6, 'camo', 0, 0.42, 0, T);                                                    // cradle
    box(0.3, 0.32, 0.36, 'camo', 0.42, 0.55, 0.05, T); box(0.18, 0.14, 0.04, 'glass', 0.42, 0.58, 0.24, T);   // sight
    box(0.22, 0.28, 0.4, 'olive', -0.38, 0.6, 0, T);                                                // ammo can
    box(0.24, 0.24, 0.75, 'metal', -0.05, 0.72, 0.25, T);                                           // receiver
    box(0.15, 0.15, 1.8, 'metal', -0.05, 0.72, 1.5, T); box(0.21, 0.21, 0.2, 'metal', -0.05, 0.72, 2.4, T);   // barrel, muzzle
    for (let i = 0; i < 4; i++) for (const x of [-1.28, 1.28]) {
      const w = wheel(0.68, 0.52, x, 0.68, [2.35, 1.1, -1.15, -2.4][i], g); p.wheels.push(w); if (i < 2) p.steer.push(w);
    }
    p.ring = ring(3.8, g);
    return { group: g, parts: p, height: 3.6, radius: 2.5 };
  }

  // Reference look: CH-47 Chinook in tri-colour camo. Long square-sided cabin with rows of framed windows, a glazed
  // cockpit and refuelling probe, fuel sponsons along the lower sides, four-wheel gear, a dorsal fairing back to the
  // tall aft pylon with its two engines, and two three-bladed rotors turning opposite ways (front low, rear high);
  // each turns into a translucent disc at speed.
  function heli() {
    const g = group(); const p = { rotors: [] };
    const body = group(); g.add(body); p.body = body;
    box(2.5, 2.7, 9.8, 'camo', 0, 2.3, -0.7, body);                                                 // cabin (z -5.6..4.2)
    mesh('frustum:2.0,2.1,2.1,2.5,2.7', 'camo', 0, 2.3, 5.25, body);                                 // cockpit
    box(1.0, 0.4, 7.2, 'camo', 0, 3.9, -0.6, body);                                                 // dorsal fairing
    mesh('wedge:1.3,0.9,1.8,0.7,0.2', 'camo', 0, 4.05, 4.6, body);                                   // forward pylon
    mesh('wedge:1.5,1.8,2.5,1.3,0', 'camo', 0, 4.6, -4.45, body);                                    // aft pylon
    box(2.3, 0.12, 0.8, 'metal', 0, 1.05, -6.0, body);                                               // ramp lip
    box(0.08, 0.08, 1.4, 'metal', -0.8, 1.9, 6.9, body);                                             // refuelling probe
    p.beacon = box(0.18, 0.18, 0.18, 'navRed', 0, 5.55, -5.6, body);
    for (const s of [-1, 1]) {
      box(0.82, 0.68, 0.06, 'glass', s * 0.46, 2.8, 6.32, body); box(0.5, 0.4, 0.06, 'glass', s * 0.5, 1.6, 6.32, body);   // windscreens, chin windows
      const sw = box(0.06, 0.65, 1.1, 'glass', s * 1.14, 2.75, 5.35, body); sw.rotation.y = -s * 0.12;  // side windows, following the taper
      for (const z of [2.0, 0.6, -0.8, -2.2, -3.6]) { box(0.05, 0.6, 0.6, 'sand', s * 1.26, 2.7, z, body); box(0.05, 0.42, 0.42, 'glass', s * 1.28, 2.7, z, body); }   // framed windows
      box(0.05, 1.7, 0.9, 'sand', s * 1.26, 2.2, 3.4, body); box(0.05, 0.5, 0.5, 'glass', s * 1.28, 2.75, 3.4, body);   // crew door
      box(0.06, 0.06, 4.5, 'sand', s * 1.27, 3.5, -0.9, body);                                     // handrail
      box(0.12, 0.16, 0.3, 'metal', s * 1.33, 2.65, 3.0, body); box(0.07, 0.07, 0.8, 'metal', s * 1.4, 2.65, 3.5, body);   // door gun
      box(0.6, 0.9, 6.8, 'camo', s * 1.5, 1.35, -0.6, body); mesh('wedge:0.6,0.9,0.8,0.6,0', 'camo', s * 1.5, 1.35, 3.2, body);   // fuel sponson
      const e = mesh('cyl:0.42,0.42,2.0,8', 'engine', s * 1.05, 4.6, -4.4, body); e.rotation.x = Math.PI / 2;   // engine
      const ei = mesh('cyl:0.3,0.3,0.1,8', 'metal', s * 1.05, 4.6, -3.38, body); ei.rotation.x = Math.PI / 2;   // its intake
      box(0.25, 0.2, 0.5, 'engine', s * 0.75, 4.6, -4.4, body);
      box(0.15, 0.55, 0.15, 'metal', s * 1.45, 0.63, 2.9, body); wheel(0.36, 0.22, s * 1.32, 0.36, 2.9, body); wheel(0.36, 0.22, s * 1.58, 0.36, 2.9, body);   // front gear, twin wheels
      box(0.15, 0.55, 0.15, 'metal', s * 1.5, 0.63, -3.8, body); wheel(0.38, 0.3, s * 1.5, 0.38, -3.8, body);   // rear gear
    }
    box(0.14, 0.14, 0.14, 'navRed', 1.8, 1.5, 3.2, body); box(0.14, 0.14, 0.14, 'navGreen', -1.8, 1.5, 3.2, body);
    const rotor = (y, z, dir) => {
      const head = group(); head.position.set(0, y, z); body.add(head);
      box(0.5, 0.4, 0.5, 'metal', 0, 0, 0, head); mesh('cyl:0.25,0.25,0.5,6', 'metal', 0, -0.35, 0, head);   // hub, mast
      const blades = group(); head.add(blades);
      for (let i = 0; i < 3; i++) { const h = group(); h.rotation.y = i * Math.PI * 2 / 3; box(0.42, 0.07, 5.3, 'heliDark', 0, 0.1, 2.85, h); blades.add(h); }
      const disc = mesh('cyl:5.5,5.5,0.05,24', 'rotorBlur', 0, 0.1, 0, head); disc.visible = false;
      p.rotors.push({ head, blades, disc, dir });
    };
    rotor(4.75, 4.7, 1); rotor(5.85, -4.7, -1);
    p.ring = ring(6.5, g);
    return { group: g, parts: p, height: 5.9, radius: 3.0 };
  }

  // Amphibious assault vehicle (Peninsula's sea side: its APCs swim ashore from the ship instead of riding a craft): a tall
  // boxy tracked hull with a blunt sloped bow and a trim vane folded over it, side skirts over six road wheels, a small
  // one-man turret with an autocannon forward of centre, troop hatches aft, a rear ramp, and bilge-pump outlets high on the
  // rear quarters. The supply carrier is the same hull without the turret, its troop bay opened into a cargo well of
  // crates, cans and drums under a cargo gantry.
  function amphibHull(g) {
    const p = { wheels: [], steer: [] };
    box(2.6, 1.3, 7.2, 'camo', 0, 0.95, 0, g);                                                   // lower hull
    box(3.3, 1.35, 6.6, 'camo', 0, 2.2, -0.5, g);                                                // upper hull (roof at 2.875)
    mesh('wedge:3.3,1.35,1.6,1.3,0', 'camo', 0, 2.2, 3.3, g);                                     // bow, sloping back over the nose
    const chin = mesh('wedge:2.6,0.9,1.4,0.9,0', 'camo', 0, 0.75, 3.3, g); chin.rotation.z = Math.PI;   // under the bow, sloping back beneath
    box(3.0, 0.08, 1.5, 'metal', 0, 2.92, 3.0, g); for (const s of [-1, 1]) box(0.08, 0.3, 1.5, 'metal', s * 1.5, 2.75, 3.0, g);   // trim vane folded on the bow, its hinges
    box(2.9, 0.12, 0.5, 'camo', 0, 1.0, 3.9, g);                                                  // nose plate
    for (const s of [-1, 1]) {
      const x = s * 1.42;
      box(0.62, 0.22, 6.4, 'trackLinks', x, 0.11, 0, g); box(0.62, 0.12, 6.1, 'trackLinks', x, 0.95, -0.1, g);   // track runs
      box(0.04, 0.16, 6.3, 'trackEdge', x + s * 0.32, 0.16, 0, g);
      for (const z of [3.05, -3.1]) { const sp = mesh('cyl:0.44,0.44,0.6,10', 'trackLinks', x, 0.5, z, g); sp.rotation.z = Math.PI / 2; }   // sprocket, idler
      for (let i = 0; i < 6; i++) { const w = wheel(0.36, 0.42, x, 0.46, -2.45 + i * 0.98, g); p.wheels.push(w); }   // road wheels
      box(0.1, 0.55, 6.5, 'camo', s * 1.7, 0.85, 0, g);                                            // side skirt
      box(0.16, 0.5, 0.5, 'metal', s * 1.6, 2.5, -2.9, g); box(0.1, 0.1, 0.4, 'metal', s * 1.68, 2.35, -2.9, g);   // bilge-pump outlet
      box(0.05, 0.05, 2.8, 'metal', s * 1.7, 2.4, 0.2, g);                                        // grab rail
      box(0.36, 0.22, 0.12, 'grille', s * 1.05, 1.5, 3.95, g); box(0.14, 0.12, 0.06, 'headlight', s * 0.95, 1.5, 4.0, g); box(0.1, 0.1, 0.06, 'amber', s * 1.17, 1.5, 4.0, g);   // light cluster
      box(0.15, 0.2, 0.06, 'navRed', s * 1.35, 2.3, -3.83, g);                                     // tail light
      box(0.14, 0.14, 0.14, 'metal', s * 1.25, 2.95, -2.3, g); box(0.06, 1.3, 0.06, 'metal', s * 1.25, 3.6, -2.3, g);   // antennas
    }
    box(2.4, 1.4, 0.06, 'camo', 0, 1.95, -3.83, g);                                               // rear ramp
    box(0.7, 0.28, 0.7, 'camo', -0.95, 2.95, 1.9, g); box(0.55, 0.06, 0.55, 'sand', -0.95, 3.12, 1.9, g);   // driver's hatch
    box(0.45, 0.1, 0.06, 'glass', -0.95, 3.0, 2.28, g);                                           // periscopes
    return p;
  }
  function amphib() {
    const g = group(), p = amphibHull(g);
    for (const x of [-0.65, 0.65]) for (const z of [-1.1, -2.2]) { box(1.0, 0.1, 0.95, 'camo', x, 2.92, z, g); box(0.8, 0.08, 0.75, 'sand', x, 2.98, z, g); }   // troop hatches
    p.turret = group(); p.turret.position.set(0.55, 2.875, 0.9); g.add(p.turret); const T = p.turret;
    mesh('cyl:0.75,0.8,0.2,10', 'camo', 0, 0.1, 0, T);                                           // ring
    box(1.3, 0.55, 1.4, 'camo', 0, 0.47, 0, T); mesh('wedge:1.3,0.55,0.6,0.5,0', 'camo', 0, 0.47, 1.0, T);   // turret and its sloped front
    box(0.55, 0.22, 0.55, 'camo', -0.25, 0.85, -0.3, T); box(0.4, 0.06, 0.4, 'sand', -0.25, 0.99, -0.3, T);   // gunner's hatch
    box(0.3, 0.3, 0.3, 'camo', 0.4, 0.85, 0.2, T); box(0.2, 0.12, 0.04, 'glass', 0.4, 0.88, 0.37, T);   // sight
    box(0.3, 0.3, 0.6, 'metal', 0.2, 0.5, 1.2, T); box(0.14, 0.14, 1.7, 'metal', 0.2, 0.5, 2.3, T); box(0.2, 0.2, 0.2, 'metal', 0.2, 0.5, 3.1, T);   // mantlet, autocannon, muzzle
    box(0.1, 0.1, 1.1, 'metal', -0.25, 0.55, 1.6, T);                                              // coaxial MG
    p.ring = ring(3.8, g);
    return { group: g, parts: p, height: 3.9, radius: 2.5 };
  }
  function amphibSupply() {
    const g = group(), p = amphibHull(g);
    box(2.5, 0.5, 4.0, 'camo', 0, 3.05, -1.2, g);                                                 // the bay's coaming
    box(2.2, 0.3, 3.7, 'canvas', 0, 3.2, -1.2, g);                                                // tarpaulin over the well
    for (const [w, h, d, m, x, z, y] of [[0.9, 0.6, 0.8, 'wood', -0.6, 0.2, 3.3], [0.8, 0.5, 0.7, 'case', 0.55, 0.3, 3.3], [0.7, 0.45, 0.6, 'olive', 0.5, -0.8, 3.3], [0.18, 0.5, 0.36, 'olive', -0.7, -1.0, 3.3], [0.18, 0.5, 0.36, 'olive', -0.45, -1.0, 3.3], [0.9, 0.7, 0.8, 'wood', 0.1, -2.1, 3.3]]) box(w, h, d, m, x, y + h / 2, z, g);   // the load
    for (const x of [-0.55, 0.2]) mesh('cyl:0.26,0.26,0.8,8', 'drum', x, 3.75, -2.6, g);          // drums
    for (const s of [-1, 1]) box(0.1, 1.4, 0.1, 'metal', s * 1.2, 3.6, -3.3, g); box(2.6, 0.1, 0.1, 'metal', 0, 4.3, -3.3, g);   // cargo gantry
    p.ring = ring(3.8, g);
    return { group: g, parts: p, height: 4.4, radius: 2.5 };
  }

  // Forward operating base: radio mast, HAB tent and a sandbag ring. Static structure.
  function fob() {
    const g = group(); const p = {};
    box(0.3, 6, 0.3, 'metal', -2.2, 3, -1.5, g); box(1.2, 0.08, 1.2, 'metal', -2.2, 6, -1.5, g); box(0.5, 0.5, 0.5, 'rifle', -2.2, 1.0, -1.5, g);   // mast, dish, radio
    mesh('wedge:6,2.6,4.4,1.2,1.2', 'canvas', 1.2, 1.3, 0.2, g);                                                                                     // tent
    box(2.2, 1.0, 1.4, 'olive', -2.4, 0.5, 1.8, g); box(1.2, 0.7, 0.9, 'canvas', 1.0, 0.35, -2.8, g);                                               // crates
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (i === 9) continue; bagStack(2.6, 1.0, 0.9, Math.cos(a) * 5.2, Math.sin(a) * 5.2, -a, g); }
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
    bagStack(6, 1.0, 0.9, 0, 2.0, 0, g);                                                       // front
    for (const x of [-3, 3]) bagStack(3.9, 1.0, 0.9, x, 0.05, Math.PI / 2, g);                // sides
    box(0.6, 0.35, 0.6, 'olive', 1.2, 0.17, -0.6, g); box(0.5, 0.3, 0.5, 'canvas', -1.4, 0.15, -0.9, g);                             // ammo boxes
    p.ring = ring(4.2, g);
    return { group: g, parts: p, height: 1.2, radius: 3.6 };
  }

  // FOB emplacements: a waist-high ring of bags open to the rear (obstacles from emplacementBoxes() below), a gun on its
  // mount in the middle facing out over the front wall, its ammunition behind; the gunner stands in the slot behind it
  function emplacementRing(g) {
    bagStack(3.2, 0.72, 0.7, 0, 1.45, 0, g);                                                    // front
    for (const x of [-1.6, 1.6]) bagStack(2.3, 0.72, 0.7, x, 0.4, Math.PI / 2, g);              // sides
  }
  function empHmg() {   // an M2 on a low tripod
    const g = group(); const p = {}; emplacementRing(g);
    const t = p.turret = group(); g.add(t);   // the gun on its mount, which swings to the target (units.js)
    for (const [x, z, r] of [[-0.35, -0.2, 0.5], [0.35, -0.2, -0.5], [0, 0.45, 0]]) box(0.06, 0.06, 0.75, 'metal', x, 0.42, z, t).rotation.set(0.6 * (z > 0 ? -1 : 1), r, 0);   // tripod legs
    box(0.24, 0.22, 0.62, 'rifle', 0, 0.86, 0.05, t); box(0.07, 0.07, 1.2, 'metal', 0, 0.9, 0.95, t); box(0.11, 0.11, 0.18, 'metal', 0, 0.9, 1.5, t);   // receiver, barrel, muzzle
    box(0.2, 0.1, 0.14, 'metal', 0, 1.0, -0.32, t); box(0.24, 0.2, 0.32, 'olive', 0.3, 0.86, 0.02, t);                       // spade grips, ammo can on the mount
    for (const x of [-0.7, -0.35]) box(0.3, 0.22, 0.5, 'olive', x, 0.11, -0.9, g);                                           // spare cans
    p.ring = ring(2.4, g);
    return { group: g, parts: p, height: 1.1, radius: 1.9 };
  }
  function empAtgm() {  // a wire-guided launcher: tube on a tripod, sight box, missile crates
    const g = group(); const p = {}; emplacementRing(g);
    const t = p.turret = group(); g.add(t);
    for (const [x, z, r] of [[-0.4, -0.25, 0.5], [0.4, -0.25, -0.5], [0, 0.4, 0]]) box(0.07, 0.07, 0.85, 'metal', x, 0.45, z, t).rotation.set(0.55 * (z > 0 ? -1 : 1), r, 0);
    box(0.24, 0.24, 1.5, 'olive', 0, 1.02, 0.35, t); box(0.3, 0.3, 0.12, 'metal', 0, 1.02, 1.1, t);                          // launch tube, its mouth
    box(0.3, 0.26, 0.34, 'rifle', 0.28, 1.0, -0.15, t); box(0.1, 0.1, 0.1, 'glass', 0.28, 1.04, 0.04, t);                    // sight
    for (const x of [-0.75, 0.75]) box(0.34, 0.3, 1.3, 'olive', x, 0.15, -1.0, g);                                           // missile crates
    p.ring = ring(2.4, g);
    return { group: g, parts: p, height: 1.3, radius: 1.9 };
  }
  function empMortar() {  // an 81 mm tube on a baseplate and bipod, rounds stacked behind
    const g = group(); const p = {}; emplacementRing(g);
    const t = p.turret = group(); g.add(t);
    box(0.7, 0.08, 0.7, 'metal', 0, 0.04, -0.15, t);                                                                          // baseplate
    box(0.16, 0.16, 1.35, 'rifle', 0, 0.62, 0.2, t).rotation.set(-0.9, 0, 0);                                                // tube, raised 52 degrees (weapons.js mortar.elev)
    for (const x of [-0.25, 0.25]) box(0.05, 0.7, 0.05, 'metal', x, 0.35, 0.55, t).rotation.set(0, 0, x > 0 ? -0.3 : 0.3);   // bipod
    for (let i = 0; i < 6; i++) box(0.09, 0.09, 0.42, 'olive', -0.75 + (i % 3) * 0.13, 0.05 + Math.floor(i / 3) * 0.1, -0.95, g);   // rounds
    box(0.4, 0.26, 0.5, 'olive', 0.7, 0.13, -0.9, g);                                                                        // ammo box
    p.ring = ring(2.4, g);
    return { group: g, parts: p, height: 1.2, radius: 1.9 };
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
      box(0.1, 0.62, 6.9, 'camo', s * 1.78, 0.86, 0.05, g);                                  // side skirt
      box(0.12, 0.2, 0.9, 'camo', s * 1.79, 0.56, 3.2, g);                                    // skirt front lip
    }
    box(2.3, 0.75, 6.8, 'camo', 0, 0.72, 0, g);                                               // lower hull between the tracks
    box(3.56, 0.32, 6.4, 'camo', 0, 1.2, -0.25, g);                                           // deck over hull and tracks
    mesh('wedge:3.56,0.55,1.5,1.25,0', 'camo', 0, 1.1, 3.7, g);                               // sloped glacis
    box(0.32, 0.16, 0.1, 'headlight', -1.35, 1.32, 4.3, g); box(0.32, 0.16, 0.1, 'headlight', 1.35, 1.32, 4.3, g);   // headlight clusters
    box(3.4, 0.75, 0.3, 'camo', 0, 0.98, -3.55, g);                                           // rear plate
    box(0.16, 0.12, 0.06, 'navRed', -1.45, 1.2, -3.72, g); box(0.16, 0.12, 0.06, 'navRed', 1.45, 1.2, -3.72, g);   // tail lights
    box(2.3, 0.06, 1.6, 'grille', 0, 1.39, -2.6, g);                                          // engine deck grille
    box(0.5, 0.3, 0.8, 'camo', -1.4, 1.48, -2.6, g); box(0.5, 0.3, 0.8, 'camo', 1.4, 1.48, -2.6, g);   // deck stowage boxes
    p.turret = group(); p.turret.position.set(0, 1.36, -0.35); g.add(p.turret);
    const T = p.turret;
    mesh('wedge:3.1,0.75,2.6,1.25,0', 'camo', 0, 0.375, 0.95, T);                            // faceted turret front
    box(3.1, 0.75, 1.9, 'camo', 0, 0.375, -1.25, T);                                          // turret rear
    for (const s of [-1, 1]) {
      box(0.36, 0.5, 1.7, 'camo', s * 1.7, 0.4, -0.95, T);                                    // side stowage bins
      box(0.36, 0.28, 0.3, 'metal', s * 1.6, 0.58, 0.85, T); box(0.36, 0.28, 0.3, 'metal', s * 1.6, 0.28, 0.85, T);   // smoke launchers
      box(0.06, 0.45, 1.05, 'metal', s * 1.5, 0.72, -2.6, T);                                 // bustle rack rails
    }
    box(3.0, 0.08, 1.05, 'metal', 0, 0.5, -2.6, T); box(3.0, 0.06, 0.06, 'metal', 0, 0.95, -3.1, T);   // bustle rack floor and back rail
    box(2.5, 0.38, 0.85, 'canvas', 0, 0.73, -2.6, T); box(0.7, 0.3, 0.5, 'olive', 0.7, 1.05, -2.5, T);   // stowage in the rack
    box(1.0, 0.55, 0.45, 'camo', 0, 0.36, 2.4, T);                                            // mantlet
    box(0.26, 0.26, 4.4, 'camo', 0, 0.4, 4.7, T);                                             // 120 mm gun
    box(0.4, 0.4, 0.9, 'camo', 0, 0.4, 4.1, T);                                               // fume extractor
    box(0.32, 0.32, 0.2, 'metal', 0, 0.4, 6.95, T);                                           // muzzle
    box(0.8, 0.35, 0.8, 'camo', 0.75, 0.92, -0.5, T); box(0.5, 0.1, 0.12, 'glass', 0.75, 0.98, -0.08, T);   // commander's cupola
    box(0.15, 0.28, 0.15, 'metal', 0.75, 1.2, -0.45, T); box(0.09, 0.11, 1.15, 'metal', 0.75, 1.33, 0.05, T);   // commander's machine gun
    box(0.7, 0.12, 0.7, 'camo', -0.75, 0.81, -0.35, T);                                       // loader's hatch
    box(0.08, 0.26, 0.08, 'metal', -0.75, 0.98, -0.3, T); box(0.08, 0.1, 0.95, 'metal', -0.75, 1.1, 0.12, T);   // loader's machine gun
    box(0.5, 0.35, 0.42, 'camo', -0.6, 0.92, 1.05, T); box(0.38, 0.2, 0.04, 'glass', -0.6, 0.94, 1.27, T);   // gunner's sight
    box(0.32, 0.4, 0.32, 'camo', 0.35, 0.95, 0.55, T);                                         // commander's thermal viewer
    box(0.07, 0.6, 0.07, 'metal', 0.15, 1.05, -0.95, T); box(0.16, 0.08, 0.16, 'metal', 0.15, 1.36, -0.95, T);   // crosswind sensor
    box(0.04, 1.9, 0.04, 'metal', -1.2, 1.7, -1.7, T); box(0.04, 1.5, 0.04, 'metal', 1.25, 1.5, -1.75, T);   // antennas
    p.ring = ring(4.4, g);
    return { group: g, parts: p, height: 3.4, radius: 2.6 };
  }

  // Tank traps: a row of Czech hedgehogs across a road, each three steel beams crossed at their middles (tilted 35 degrees
  // and turned 120 degrees apart, so it stands on three feet), every other one turned a little. Static structure; its
  // obstacle boxes come from trapBoxes() below, and block vehicles only: infantry walk between them.
  function traps() {
    const g = group(); const p = {};
    for (let i = 0; i < TRAPS.n; i++) {
      const h = group(); h.position.set((i - (TRAPS.n - 1) / 2) * TRAPS.gap, 0, 0); h.rotation.y = (i % 2) * 0.5; g.add(h);
      for (let k = 0; k < 3; k++) box(2.4, 0.24, 0.24, k === 1 ? 'trap2' : 'trap', 0, 0.74, 0, h).rotation.set(0, k * 2.094, 0.62);
    }
    p.ring = ring(8.2, g);
    return { group: g, parts: p, height: 1.3, radius: 7.8 };
  }

  // Rally point: a radio pack on the ground and a short pole with a pennant in the team's camo. Static structure.
  function rally() {
    const g = group(); const p = {};
    box(0.5, 0.35, 0.3, 'canvas', 0, 0.17, 0, g); box(0.3, 0.25, 0.2, 'rifle', 0.05, 0.47, 0, g);   // pack and radio
    box(0.06, 1.8, 0.06, 'metal', -0.45, 0.9, 0, g); box(0.5, 0.32, 0.04, 'desert', -0.2, 1.62, 0, g);   // pole and pennant
    p.ring = ring(1.4, g);
    return { group: g, parts: p, height: 1.9, radius: 0.6 };
  }

  // Landing craft (an LCU): a flat steel hull riding low in the water, side walls round the open well deck, a bow ramp (+z)
  // with the team's band along its top, the wheelhouse and mast aft on the starboard side. Its origin is the waterline.
  function craft() {
    const g = group(); const p = {};
    box(7.2, 1.6, 22, 'hullDark', 0, 0.2, 0, g);                                     // hull, half under water
    box(7.6, 0.25, 22.2, 'hull', 0, 1.12, 0, g);                                    // deck edge
    box(6.2, 0.1, 17, 'case', 0, 1.02, 1.5, g);                                     // well deck
    for (const s of [-1, 1]) box(0.5, 1.6, 18, 'hull', s * 3.55, 1.95, 1, g);       // side walls
    box(6.6, 2.2, 0.35, 'hull', 0, 2.1, 11.1, g); box(6.6, 0.3, 0.4, 'sand', 0, 3.2, 11.1, g);   // bow ramp, raised, and the team band
    box(6.8, 0.8, 1.8, 'hull', 0, 1.6, -10.4, g);                                   // stern
    box(3.0, 2.8, 3.4, 'hull', -1.8, 2.6, -8.6, g); box(3.02, 0.6, 0.06, 'glass', -1.8, 3.4, -6.88, g);   // wheelhouse, its windows
    box(0.18, 3.5, 0.18, 'metal', -1.8, 5.7, -8.6, g);                              // mast
    p.ring = ring(12, g);
    return { group: g, parts: p, height: 4, radius: 9 };
  }

  // each builder takes the team so the whole model picks the right camo set
  const forTeam = (fn) => (t = 0) => { team = t; const r = fn(); team = 0; return r; };
  return { soldier: forTeam(soldier), truck: forTeam(() => truck(false)), supplyTruck: forTeam(() => truck(true)), apc: forTeam(apc), heli: forTeam(heli), fob: forTeam(fob), cache: forTeam(cache), sandbags: forTeam(sandbags), emp_hmg: forTeam(empHmg), emp_atgm: forTeam(empAtgm), emp_mortar: forTeam(empMortar), traps: forTeam(traps), rally: forTeam(rally), tank: forTeam(tank), craft: forTeam(craft), amphib: forTeam(amphib), amphibSupply: forTeam(amphibSupply) };



}

// a row of tank traps: n hedgehogs gap metres apart along the row (local x), 15 m in all, enough to close a road or a bridge
export const TRAPS = { n: 6, gap: 2.7, foot: 1.6 };
// world-space boxes, one per hedgehog, for a row of tank traps at (x, z) facing heading h (the row runs across it); for
// vehicles only (WorldState.vehicleObstacles and the vehicle nav grid)
export function trapBoxes(x, z, h) {
  const c = Math.cos(h), s = Math.sin(h), r = TRAPS.foot / 2;
  return Array.from({ length: TRAPS.n }, (_, i) => { const lx = (i - (TRAPS.n - 1) / 2) * TRAPS.gap, wx = x + lx * c, wz = z - lx * s; return { minX: wx - r, maxX: wx + r, minZ: wz - r, maxZ: wz + r, h: 1.3 }; });
}

// world-space obstacle boxes for an emplacement's ring of bags (0.72 m high, open to the rear) at (x, z) facing h
export function emplacementBoxes(x, z, h) {
  const c = Math.cos(h), s = Math.sin(h), out = [];
  const piece = (lx, lz, w, d) => { const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c, hw = (w * Math.abs(c) + d * Math.abs(s)) / 2, hd = (w * Math.abs(s) + d * Math.abs(c)) / 2; out.push({ minX: wx - hw, maxX: wx + hw, minZ: wz - hd, maxZ: wz + hd, h: 0.72 }); };
  for (let lx = -1.35; lx <= 1.35; lx += 0.45) piece(lx, 1.45, 0.45, 0.7);                    // front wall, 3.2 m
  for (let lz = -0.6; lz <= 1.3; lz += 0.45) { piece(-1.6, lz, 0.7, 0.45); piece(1.6, lz, 0.7, 0.45); }   // sides, 2.3 m
  return out;
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
  skin: 0xc9966b, skin2: 0x7a5236, hair: 0x1a1512, belt: 0x3b3127, boots: 0x8a7350, bootsB: 0x2f2a24, rifle: 0x1f1f1f, gun: 0x34373a, medRed: 0xb3261e, launcher: 0x56603c,
  heliDark: 0x2e3330, olive: 0x5c6b3f, trap: 0x4c4741, trap2: 0x6b4a35, sandbag: 0x9c8b64, sandbag2: 0xa8976f, sandbag3: 0x8f7f5a, bagCore: 0x5e5139, glass: 0x1d2328, tire: 0x1a1a1a, rim: 0xb09a64, rimB: 0x6c7550, metal: 0x2a2a2a, canvas: 0x6f6448,
  hub: 0x5e5340, tread: 0x2c2c2c, headlight: 0xf2ecd0, grille: 0x171717, amber: 0xd9822b,
  hull: 0x858a8e, hullDark: 0x4f5458,   // landing craft
  sand: 0xd6c08a, sandB: 0x87915f, engine: 0x6b6e6c, wood: 0x8a6a43, drum: 0x3e4a33, case: 0x3a3d40,   // vehicle plates, engines, cargo
  // Peninsula's landmarks (core/landmarks.js): the lighthouse, the radar station, the harbour sheds and boats, the assault ship
  lhWhite: 0xf2f0ea, lhRed: 0xc83a30, lhIron: 0x1e2124, stone: 0x9a958b, stone2: 0x8a857b, concrete: 0xcfcac0, concrete2: 0xbdb8ae, steelDoor: 0x5a5e62, domeWhite: 0xf0eee8, domeRib: 0xd8d6d0,
  shedWall: 0x6f8796, shedRust: 0x8a5a3a, shedRoof: 0x6a6e70, shedRoof2: 0x5c6063, shedDoor: 0x3b3f42, skylight: 0x9fb9b4,
  boatHull: 0xb33a32, boatDeck: 0x8a6a46, boatHouse: 0xf2f0ea, mast: 0x5a3e2a, netGrey: 0x8d8f86,
  shipGrey: 0x8f9499, shipDark: 0x4d5256, shipDeck: 0x5a5e62, deckLine: 0xe9e6dc, spotYellow: 0xd9b64a, island: 0x84898c, islandDark: 0x6f7477, gateDark: 0x1e2224, funnel: 0x3a3d40, dockFloor: 0x6e3a32,
};
export const TEXTURED = ['uniform', 'vest', 'desert', 'camo', 'tarp', 'trunk', 'frond', 'bush', 'uniformB', 'vestB', 'desertB', 'camoB', 'tarpB', 'wreck', 'net', 'trackLinks', 'trackEdge', 'plaster1', 'plaster2', 'plaster3', 'render', 'liner'];
