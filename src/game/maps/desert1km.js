import { rand } from '../../core/layout.js';
import { smooth } from '../../core/math.js';

// "Desert Crossing": 1 km map. Bases in the SW and NE corners; five locations in
// Advance-and-Secure order between them; an asphalt road joins the chain.
export const desert1km = {
  name: 'Desert Crossing', size: 1000,
  ground: { base: 'sand', baseSize: 4, tiles: ['concrete', 'asphalt', 'grass', 'dirt'], tileSize: [16, 4, 4, 4] },
  bases: [{ team: 0, x: -400, z: -400, r: 42 }, { team: 1, x: 430, z: 430, r: 42 }],
  locations: [
    { name: 'Outpost', x: -300, z: -290, r: 22 },
    { name: 'Airfield', x: -140, z: -160, r: 34 },
    { name: 'Village', x: 40, z: 10, r: 30 },
    { name: 'Depot', x: 210, z: 190, r: 24 },
    { name: 'Relay', x: 310, z: 300, r: 20 },
  ],
  roadPath: [[-400, -400], [-340, -345], [-300, -290], [-250, -250], [-205, -216], [-160, -190], [-110, -180], [-20, -80], [4, -38], [40, 10], [76, 58], [130, 110], [210, 190], [330, 330], [430, 430]],
  tracks: [[[72, -32], [150, -50], [250, -20], [320, 150], [310, 300]], [[-300, -290], [-380, -250], [-450, -310]], [[-140, -160], [20, -240], [200, -170]], [[150, 136], [120, 220], [60, 330]]],
  // Ridges with cut passes and two rivers form the choke points. Each river is bridged where the road
  // crosses it and fordable further out; the village sits on the land between them, so both sides
  // cross water to reach the centre (the layout is roughly point-symmetric about the village).
  terrain: {
    water: -3,
    features: [
      { type: 'ridge', x1: -297, z1: -96, x2: -113, z2: -334, w: 38, h: 32, p: 0.6, jag: 0.5, cuts: [{ x: -205, z: -216, r: 34 }] },   // Outpost - Airfield barrier
      { type: 'ridge', x1: 380, z1: 150, x2: 150, z2: 350, w: 36, h: 30, p: 0.6, jag: 0.5, cuts: [{ x: 268, z: 255, r: 34 }] },         // Depot - Relay barrier
      { type: 'ridge', x1: -470, z1: -200, x2: -300, z2: -110, w: 30, h: 22, p: 0.7, jag: 0.4 },
      { type: 'ridge', x1: 480, z1: 220, x2: 320, z2: 120, w: 30, h: 22, p: 0.7, jag: 0.4 },
      { type: 'ridge', x1: 220, z1: 480, x2: 130, z2: 340, w: 30, h: 22, p: 0.7, jag: 0.4 },
      { type: 'hill', x: 130, z: -90, r: 80, h: 26, p: 0.8, jag: 0.6 },
      { type: 'hill', x: -250, z: 130, r: 95, h: 34, p: 0.5, jag: 0.6 },
      { type: 'hill', x: 240, z: -330, r: 90, h: 28, p: 0.5, jag: 0.6 },
      { type: 'hill', x: -120, z: 320, r: 75, h: 20, p: 0.7, jag: 0.5 },
      { type: 'hill', x: 420, z: -80, r: 70, h: 22, p: 0.7, jag: 0.5 },
      { type: 'hill', x: -420, z: 80, r: 70, h: 18, p: 0.7, jag: 0.5 },
      { type: 'hill', x: 40, z: 420, r: 60, h: 14, p: 0.8, jag: 0.5 },
    ],
    rivers: [
      { path: [[-150, 500], [-20, 300], [80, 170], [170, 60], [290, -60], [420, -200], [500, -260]], w: 24, depth: 7 },      // north-east of the village
      { path: [[240, -490], [110, -300], [10, -150], [-80, -45], [-200, 80], [-330, 220], [-420, 290]], w: 24, depth: 7 },   // its mirror south-west
    ],
    fords: [{ x: 250, z: -20, r: 24, bed: -2.2 }, { x: -170, z: 40, r: 24, bed: -2.2 }],
  },
  bridges: [{ x: 130, z: 109, len: 64, w: 14, angle: 0.78, y: 1.3 }, { x: -35, z: -97, len: 64, w: 14, angle: 0.733, y: 1.3 }],
  flats: [
    { x: -400, z: -400, r: 48, m: 25 }, { x: 430, z: 430, r: 48, m: 25 },
    { x: -300, z: -290, r: 30, m: 20 }, { x: -140, z: -160, r: 84, m: 18 }, { x: 40, z: 10, r: 72, m: 22 },
    { x: 210, z: 190, r: 44, m: 20 }, { x: 310, z: 300, r: 28, m: 18 }, { x: 150, z: -220, r: 40, m: 18 },
  ],

  build() {
    const props = [], obstacles = [], lamps = [], tufts = [], decals = [], strips = [];
    const r = rand(2024);
    // The road as drawn (Chaikin-smoothed like its strip, 12 m wide). Nothing stands on it: obstacles whose centre is
    // within 9 m of its centre line lose their collision (roadFree, at the end), so props keep at least that far out.
    const road = smooth(this.roadPath, 2);
    const roadNear = (x, z) => { let best = [Infinity, x, z]; for (let i = 0; i < road.length - 1; i++) { const [ax, az] = road[i], [bx, bz] = road[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))), fx = ax + (bx - ax) * t, fz = az + (bz - az) * t, d = Math.hypot(x - fx, z - fz); if (d < best[0]) best = [d, fx, fz]; } return best; };
    const ROAD_CLEAR = 9, onRoad = (x, z, clear = ROAD_CLEAR) => roadNear(x, z)[0] < clear;
    // a point moved straight out from the road until it is `clear` metres from the centre line (towards `side` if it is on the line)
    const offRoad = (x, z, clear, side = [1, 0]) => {
      const [d, fx, fz] = roadNear(x, z); if (d >= clear) return [x, z];
      const [ux, uz] = d > 0.01 ? [(x - fx) / d, (z - fz) / d] : [side[0] / Math.hypot(...side), side[1] / Math.hypot(...side)];
      return [fx + ux * clear, fz + uz * clear];
    };
    const box = (w, h, d, color, x, z, { y = 0, rot = 0, obstacle = true, cast = true, tex } = {}) => {
      props.push({ geo: `box:${w},${h},${d}`, color, tex, x, y: y + h / 2, z, rot: [0, rot, 0], cast });
      if (obstacle) footprint(w, d, x, z, rot, y + h);
    };
    // A box blocks its own footprint. Axis-aligned (or nearly) it is one obstacle; rotated, it is cut into rows 0.5-1 m deep, each
    // spanning only the part of the box inside that row, so a diagonal wall or a turned house no longer blocks its whole
    // bounding box (rotated props used to block 4.7x their real area, invisible solid ground beside them).
    const footprint = (w, d, x, z, rot, top) => {
      const c = Math.cos(rot), s = Math.sin(rot);
      if (Math.abs(Math.sin(2 * rot)) < 0.1) { const hw = (w * Math.abs(c) + d * Math.abs(s)) / 2, hd = (w * Math.abs(s) + d * Math.abs(c)) / 2; obstacles.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, h: top }); return; }
      const rowH = Math.min(1, Math.max(0.5, Math.min(w, d))), su = Math.min(0.25, w / 2), sv = Math.min(0.25, d / 2), rows = new Map();
      for (let u = -w / 2; u <= w / 2 + 1e-6; u += su) for (let v = -d / 2; v <= d / 2 + 1e-6; v += sv) {
        const px = x + u * c + v * s, pz = z - u * s + v * c, k = Math.floor(pz / rowH);   // the props' rotation about y
        let r = rows.get(k); if (!r) rows.set(k, r = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
        r.minX = Math.min(r.minX, px); r.maxX = Math.max(r.maxX, px); r.minZ = Math.min(r.minZ, pz); r.maxZ = Math.max(r.maxZ, pz);
      }
      for (const r of rows.values()) obstacles.push({ minX: r.minX - 0.15, maxX: r.maxX + 0.15, minZ: r.minZ - 0.15, maxZ: r.maxZ + 0.15, h: top });
    };
    // Detailed props are built from many boxes placed in the object's own frame (lx across, ly up from the ground, lz
    // forward) and turned by rot about (ox, oz); every part takes the ground height at the object's anchor, so a house
    // or a wall stays rigid on a slope. Decoration draws from its own generator so r()'s sequence, and with it every
    // prop position and obstacle on the map, is unchanged. A plain-coloured part is a unit box scaled to size, so every
    // part of one colour shares one draw batch (a box's normals survive the scale); a textured part keeps its own
    // geometry so the texture keeps its world-unit scale.
    const rd = rand(4242);
    const part = (ox, oz, rot, lx, ly, lz, w, h, d, mat, ax = ox, az = oz) => {
      const c = Math.cos(rot), s = Math.sin(rot), tex = typeof mat === 'string';
      const cast = Math.min(w, h, d) >= 0.25 || Math.max(w, h, d) >= 3;   // ribs, rails, rungs and joints are too thin for a visible shadow; skipping them halves their cost
      props.push({ geo: tex ? `box:${w},${h},${d}` : 'box:1,1,1', ...(tex ? { tex: mat } : { color: mat, scale: [w, h, d] }), x: ox + lx * c + lz * s, y: ly + h / 2, z: oz - lx * s + lz * c, rot: [0, rot, 0], cast, ax, az });
    };
    // Reference look: sandbags laid lengthways in a running bond, the top course two bags deep. len along the stack's
    // local x, one obstacle for the whole stack.
    const BAG = [0x9c8b64, 0xa8976f, 0x8f7f5a];
    const bagStack = (x, z, rot, len = 3, h = 1.1, depth = 1, { y0 = 0, obstacle = true, ax = x, az = z } = {}) => {   // y0 lifts it onto a platform
      const rows = Math.round(h / 0.24), rh = h / rows, bh = +(rh - 0.05).toFixed(3);   // joints wide enough to show at 10 texels a metre
      part(x, z, rot, 0, y0, 0, +(len - 0.08).toFixed(2), +(h - rh + 0.02).toFixed(2), +(depth - 0.1).toFixed(2), 0x5e5139, ax, az);   // a dark core up to the top course, so a joint reads as a seam, not a hole
      for (let row = 0; row < rows; row++) {
        const top = row === rows - 1;
        for (let u = -len / 2 - (row % 2 ? 0.3 : 0); u < len / 2 - 1e-3; u += 0.6) {
          const a = Math.max(u, -len / 2), b = Math.min(u + 0.6, len / 2), w = +(b - a - 0.06).toFixed(2); if (w < 0.1) continue;
          const col = BAG[Math.floor(rd() * 3)];
          if (top) for (const s of [-1, 1]) part(x, z, rot, (a + b) / 2, y0 + row * rh, s * depth / 4, w, bh, +(depth / 2 - 0.03).toFixed(2), col, ax, az);
          else part(x, z, rot, (a + b) / 2, y0 + row * rh, 0, w, bh, depth, col, ax, az);
        }
      }
      if (obstacle) footprint(len, depth, x, z, rot, h);
    };
    // Reference look: grey concrete blocks in a running bond over a mortar core, with stained patches spanning several
    // blocks and the odd darker block. Runs from (x0, z0) to (x1, z1) along its local z.
    const BLOCK = [0xaaa9a3, 0x9c9b95, 0x8c8b86, 0xb5b4ad];
    const blockWall = (x0, z0, x1, z1, h = 2.2, t = 0.5) => {
      const len = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(x1 - x0, z1 - z0), x = (x0 + x1) / 2, z = (z0 + z1) / 2;
      const rows = Math.max(2, Math.round(h / 0.31)), rh = h / rows, bh = +(rh - 0.06).toFixed(3), seed = rd() * 10;
      part(x, z, rot, 0, 0, 0, t - 0.08, +(h - 0.02).toFixed(2), +(len - 0.04).toFixed(2), 0x7f7e79);   // mortar
      for (let row = 0; row < rows; row++) {
        for (let u = -len / 2 - (row % 2 ? 0.3 : 0); u < len / 2 - 1e-3; u += 0.6) {
          const a = Math.max(u, -len / 2), b = Math.min(u + 0.6, len / 2), w = +(b - a - 0.07).toFixed(2); if (w < 0.1) continue;
          const m = (a + b) / 2, stain = Math.sin(m * 0.7 + seed) + Math.sin(row * 0.9 + m * 0.31 + seed * 2);
          part(x, z, rot, 0, row * rh, m, t, bh, w, stain > 1.1 ? BLOCK[2] : stain > 0.5 ? BLOCK[1] : rd() < 0.1 ? BLOCK[2] : rd() < 0.3 ? BLOCK[3] : BLOCK[0]);
        }
      }
      footprint(t, len, x, z, rot, h);
    };
    const palm = (x, z, tilt = (r() - 0.5) * 0.12) => {
      props.push({ geo: 'cyl:0.2,0.32,9,6', tex: 'trunk', x, y: 4.5, z, rot: [tilt, 0, tilt * 0.6], cast: true });
      const tx = x + Math.sin(tilt * 0.6) * 4.5, tz = z + Math.sin(tilt) * 4.5;
      props.push({ geo: 'cyl:0.55,0.4,0.7,6', tex: 'trunk', x: tx, y: 9.1, z: tz, rot: [0, 0, 0], cast: true });
      for (let k = 0; k < 8; k++) props.push({ geo: 'frond:0.6,0.08,3.6,' + (0.35 + (k % 3) * 0.15).toFixed(2), tex: 'frond', x: tx, y: 9.3, z: tz, rot: [0, k * Math.PI / 4 + (k % 2) * 0.2, 0], cast: true });
      obstacles.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5, h: 9 });
    };
    const bush = (x, z, s = 0.8 + r() * 0.5) => {
      if (onRoad(x, z)) return;                                                                                          // after drawing s, so the rest of the map keeps its layout
      for (const [ox, oz, rr, h] of [[0, 0, 1.3, 1.6], [0.9, 0.5, 0.9, 1.2], [-0.8, 0.6, 1.0, 1.1]])
        props.push({ geo: 'cyl:' + (rr * s).toFixed(2) + ',' + (rr * s * 1.15).toFixed(2) + ',' + (h * s).toFixed(2) + ',7', tex: 'bush', x: x + ox * s, y: h * s / 2, z: z + oz * s, rot: [0, 0, 0], cast: true });
      obstacles.push({ minX: x - 1.5 * s, maxX: x + 1.5 * s, minZ: z - 1.5 * s, maxZ: z + 1.5 * s, h: 1.6 * s });
    };
    const rock = (x, z) => { const s = 0.8 + r() * 2.2, col = [0x8c857a, 0x7a7368, 0x9a9388][Math.floor(r() * 3)], rot = r() * Math.PI; if (!onRoad(x, z)) box(s, s * 0.6, s * 0.8, col, x, z, { rot }); };
    // Reference look: flat-roofed desert house in blotchy plaster, a cornice and a parapet round the roof, timber beam ends
    // under the roofline (and under the band between floors), small lattice windows with sills, and a framed plank door
    // on the side facing `toward` (the street).
    const PLASTER = ['plaster1', 'plaster2', 'plaster3'], TRIM = [0xc2a777, 0xb79d6e, 0xcbb38a], WOOD = 0xb08f5e, DOOR = 0x8a6a42, DARK = 0x2e2822;
    const house = (x, z, w = 7, d = 7, floors = 1, rot = 0, toward = null) => {
      const k = Math.floor(r() * 3), tex = PLASTER[k], trim = TRIM[k], fh = 3.6, h = fh * floors;   // its one r() call, as before
      const P = (lx, ly, lz, bw, bh, bd, m) => part(x, z, rot, lx, ly, lz, bw, bh, bd, m);
      box(w, h, d, null, x, z, { rot, tex });
      P(0, h - 0.1, 0, w + 0.3, 0.28, d + 0.3, trim);                                          // cornice
      for (const s of [-1, 1]) { P(0, h + 0.18, s * d / 2, w + 0.3, 0.45, 0.3, tex); P(s * w / 2, h + 0.18, 0, 0.3, 0.45, d - 0.3, tex); }   // parapet
      if (floors > 1) P(0, fh - 0.12, 0, w + 0.2, 0.24, d + 0.2, trim);                        // band between the floors
      // the four faces: which way is out, how long, and a box on a face at u along it, ly up, standing `out` proud of it
      const faces = [{ ax: 'z', s: 1, len: w }, { ax: 'z', s: -1, len: w }, { ax: 'x', s: 1, len: d }, { ax: 'x', s: -1, len: d }];
      const F = (f, u, ly, out, bw, bh, t, m) => f.ax === 'z' ? P(u, ly, f.s * (d / 2 + out), bw, bh, t, m) : P(f.s * (w / 2 + out), ly, u, t, bh, bw, m);
      for (const f of faces) for (let fl = 1; fl <= floors; fl++) {                            // beam ends
        const n = Math.max(3, Math.round(f.len / 1.3));
        for (let i = 0; i < n; i++) F(f, -f.len / 2 + (i + 0.5) * f.len / n, fl * fh - 0.42, 0.12, 0.2, 0.2, 0.26, WOOD);
      }
      let df = faces[0];                                                                       // the door goes on the face nearest the street
      if (toward) { const dx = toward[0] - x, dz = toward[1] - z, c = Math.cos(rot), s = Math.sin(rot), lx = dx * c - dz * s, lz = dx * s + dz * c; df = faces[Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? 2 : 3) : (lz > 0 ? 0 : 1)]; }
      const du = (rd() < 0.5 ? -1 : 1) * df.len * 0.2;
      F(df, du, 0, 0.02, 1.5, 2.45, 0.06, 0x4a3a2a); F(df, du, 0, 0.05, 1.1, 2.2, 0.08, DOOR); F(df, du, 2.45, 0.08, 1.7, 0.18, 0.18, trim);   // reveal, door, lintel
      for (const f of faces) for (let fl = 0; fl < floors; fl++) {                            // lattice windows
        const us = f === df && fl === 0 ? (f.len >= 6 ? [-du] : []) : f.len >= 7 ? [-f.len / 4, f.len / 4] : [0];
        for (const u of us) {
          const y = fl * fh + 1.3;
          F(f, u, y, 0.02, 0.85, 0.85, 0.06, DARK); F(f, u, y, 0.06, 0.06, 0.85, 0.06, WOOD); F(f, u, y + 0.4, 0.06, 0.85, 0.06, 0.06, WOOD); F(f, u, y - 0.08, 0.06, 1.0, 0.08, 0.14, trim);
        }
      }
    };
    // Reference look: airfield control tower: a plinth, a square shaft with a column of slit windows, a glazed cab between
    // a floor slab and an overhanging roof, a stepped hatch, antennas and a dish on top.
    const controlTower = (x, z) => {
      const P = (lx, ly, lz, w, h, d, m) => part(x, z, 0, lx, ly, lz, w, h, d, m), trim = TRIM[2];
      P(0, 0, 0, 7.6, 2.4, 7.6, 'render'); P(0, 2.4, 0, 7.8, 0.22, 7.8, trim);             // plinth and its cap
      P(0, 2.4, 0, 5.6, 11.2, 5.6, 'render');                                               // shaft
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) P(s * 2.83, 4.2 + i * 2.3, 0.8, 0.06, 1.1, 0.42, DARK);   // slit windows
      P(0, 13.6, 0, 8.2, 0.45, 8.2, trim);                                                     // cab floor
      P(0, 14.05, 0, 7.6, 2.5, 7.6, 0x262c31);                                                 // glass
      for (let i = 0; i < 5; i++) { const u = -3.8 + i * 1.9; for (const s of [-1, 1]) { P(u, 14.05, s * 3.82, 0.3, 2.5, 0.12, 'render'); P(s * 3.82, 14.05, u, 0.12, 2.5, 0.3, 'render'); } }   // mullions
      P(0, 16.55, 0, 8.6, 0.5, 8.6, trim);                                                     // roof
      P(0, 17.05, 0, 1.8, 0.25, 1.8, 'render'); P(0, 17.3, 0, 1.0, 0.2, 1.0, 'render');   // stepped hatch
      P(-3.0, 17.05, -3.0, 0.15, 2.2, 0.15, 0x8a8a86); P(-2.2, 17.05, -3.3, 0.12, 1.5, 0.12, 0x8a8a86); P(-3.3, 17.05, -2.0, 0.12, 1.2, 0.12, 0x8a8a86);   // antennas
      P(2.8, 17.05, 2.8, 0.2, 0.9, 0.2, trim);                                                 // dish mast
      props.push({ geo: 'cyl:0.85,0.85,0.16,10', color: 0xd8cba8, x: x + 2.8, y: 18.35, z: z + 2.65, rot: [1.15, 0.75, 0], cast: true, ax: x, az: z });   // dish
      footprint(7.6, 7.6, x, z, 0, 17.3);
    };
    const wallRun = blockWall;
    // Reference look (FLUX.2 klein 4B): Hesco barrier: fabric-lined cells of sand in a dark steel mesh, posts at every cell
    // joint and halfway across each cell, wires round the faces and across the top. len along local x.
    const MESH = 0x2c2d2e;
    const hesco = (x, z, rot, len = 5, h = 2.4, depth = 1.6) => {
      const P = (lx, ly, lz, w, hh, d, m) => part(x, z, rot, lx, ly, lz, w, hh, d, m), n = Math.max(1, Math.round(len / 1.25)), cell = len / n;
      for (let i = 0; i < n; i++) {
        const cx = -len / 2 + (i + 0.5) * cell;
        P(cx, 0, 0, +(cell - 0.04).toFixed(3), +(h - 0.1).toFixed(2), depth - 0.04, 'liner');                          // lined cell
        P(cx, h - 0.16, 0, +(cell - 0.16).toFixed(3), 0.12, depth - 0.16, 0xc8b088);                                    // sand fill
      }
      for (let i = 0; i <= 2 * n; i++) {                                                                                 // posts
        const px = -len / 2 + i * cell / 2, t = i % 2 ? 0.04 : 0.07;
        for (const s of [-1, 1]) P(px, 0, s * (depth / 2 + 0.01), t, h, t, MESH);
        if (i % 2 === 0) P(px, h - 0.05, 0, t, 0.05, depth, MESH);                                                       // across the top
      }
      for (const y of [0.04, h * 0.36, h * 0.68, h - 0.06]) {                                                            // wires round the faces
        for (const s of [-1, 1]) { P(0, y, s * (depth / 2 + 0.01), len, 0.05, 0.05, MESH); P(s * (len / 2 + 0.01), y, 0, 0.05, 0.05, depth, MESH); }
      }
      footprint(len, depth, x, z, rot, h);
    };
    // Reference look (FLUX.2 klein 4B): a weathered 20 ft container: ribbed sides and roof in a darker shade, rails along
    // every edge, rusty corner castings, doors at one end with four locking bars, and rust spots. 6 m along local x; y0
    // stands it on another one.
    const shade = (c, k) => ((Math.round((c >> 16) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k));
    const container = (x, z, rot, col, y0 = 0, obstacle = true) => {
      const P = (lx, ly, lz, w, h, d, m) => part(x, z, rot, lx, y0 + ly, lz, w, h, d, m), dark = shade(col, 0.78), rail = shade(col, 0.68);
      const L = 6, H = 2.6, D = 2.5, RUST = 0x7a3f24;
      P(0, 0.02, 0, L - 0.1, H - 0.04, D - 0.1, col);                                                                     // body
      for (let i = 0; i < 16; i++) { const u = -2.7 + i * 0.36; for (const s of [-1, 1]) P(u, 0.18, s * (D / 2 - 0.03), 0.14, H - 0.36, 0.06, dark); }   // side ribs
      for (let i = 0; i < 6; i++) { const v = -1.0 + i * 0.4; P(-L / 2 + 0.03, 0.18, v, 0.06, H - 0.36, 0.14, dark); }  // ribs on the closed end
      for (let i = 0; i < 14; i++) P(-2.6 + i * 0.4, H - 0.06, 0, 0.16, 0.04, D - 0.3, dark);                              // roof ribs
      for (const s of [-1, 1]) for (const y of [0, H - 0.14]) P(0, y, s * (D / 2 - 0.05), L - 0.1, 0.14, 0.1, rail);       // side rails
      for (const s of [-1, 1]) for (const y of [0, H - 0.14]) P(s * (L / 2 - 0.05), y, 0, 0.1, 0.14, D - 0.1, rail);      // end rails
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { P(sx * (L / 2 - 0.1), 0, sz * (D / 2 - 0.1), 0.24, 0.24, 0.24, RUST); P(sx * (L / 2 - 0.1), H - 0.24, sz * (D / 2 - 0.1), 0.24, 0.24, 0.24, RUST); for (const y of [0.24]) P(sx * (L / 2 - 0.06), y, sz * (D / 2 - 0.06), 0.12, H - 0.48, 0.12, rail); }   // corner castings and posts
      P(L / 2 - 0.02, 0.14, 0, 0.06, H - 0.3, 0.05, rail);                                                                // door seam
      for (const v of [-0.85, -0.4, 0.4, 0.85]) { P(L / 2 + 0.02, 0.1, v, 0.05, H - 0.22, 0.05, 0x6a6c6e); P(L / 2 + 0.05, 0.9, v + (v < 0 ? 0.12 : -0.12), 0.05, 0.06, 0.26, 0x6a6c6e); }   // locking bars, handles
      P(L / 2 + 0.01, 1.5, -0.62, 0.02, 0.12, 0.24, 0xc9a227);                                                            // placard
      for (let i = 0; i < 9; i++) {                                                                                       // rust spots
        const s = rd() < 0.5 ? -1 : 1, w = 0.12 + rd() * 0.3, h = 0.08 + rd() * 0.25;
        if (rd() < 0.75) P(-2.8 + rd() * 5.6, 0.2 + rd() * (H - 0.6), s * (D / 2 + 0.005), w, h, 0.02, RUST);
        else P(-2.6 + rd() * 5.2, H - 0.035, -1 + rd() * 2, w, 0.02, h, RUST);
      }
      if (obstacle) footprint(L, D, x, z, rot, y0 + H);
    };
    // A cylinder (axis up, or turned by rot) and a box turned off the vertical, both centred at ly and sharing the
    // object's ground anchor; used where part()'s turn about y is not enough.
    const cyl = (x, z, lx, ly, lz, r1, r2, h, segs, color, rot = [0, 0, 0]) => props.push({ geo: `cyl:${r1},${r2},${h},${segs}`, color, x: x + lx, y: ly, z: z + lz, rot, cast: true, ax: x, az: z });
    const tilt = (x, z, lx, ly, lz, w, h, d, color, rot) => props.push({ geo: 'box:1,1,1', color, scale: [w, h, d], x: x + lx, y: ly, z: z + lz, rot, cast: true, ax: x, az: z });
    const CONC = [0xa7a49c, 0x96938b], STAIN = 0x8a877f, TIN = [0x9aa0a4, 0x80868a], TIMBER = 0x5e4a34, STEEL = 0xa3a7aa, DARKM = 0x4a4d50;
    const stains = (P, w, d, h, n, y0 = 0.6) => {   // dirty patches on the four faces of a w x d block standing h high
      for (let i = 0; i < n; i++) {
        const f = rd() < 0.5 ? -1 : 1, y = y0 + rd() * (h - y0 - 0.6), sw = 0.2 + rd() * 0.5, sh = 0.1 + rd() * 0.35;
        if (rd() < 0.5) P((rd() - 0.5) * (w - 0.6), y, f * (d / 2 + 0.005), sw, sh, 0.02, STAIN); else P(f * (w / 2 + 0.005), y, (rd() - 0.5) * (d - 0.6), 0.02, sh, sw, STAIN);
      }
    };
    // Reference look (FLUX.2 klein 4B): watchtower: a concrete shaft with corner pilasters on a plinth, a timber ladder up
    // the front, a sandbagged post on the platform and a stepped tin roof on four posts. w x w, the platform at h; the
    // obstacle is the shaft, as before.
    const watchtower = (x, z, w = 3, h = 8) => {
      const P = (lx, ly, lz, bw, bh, bd, m) => part(x, z, 0, lx, ly, lz, bw, bh, bd, m), top = h + 0.25, e = (w + 1.3) / 2 - 0.3;
      P(0, 0, 0, w + 0.8, 0.4, w + 0.8, CONC[1]);                                                                         // plinth
      P(0, 0.4, 0, w, h - 0.4, w, CONC[0]);                                                                               // shaft
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(sx * (w / 2 - 0.12), 0.4, sz * (w / 2 - 0.12), 0.36, h - 0.4, 0.36, CONC[1]);   // pilasters
      stains(P, w + 0.1, w + 0.1, h, 6);
      for (const s of [-1, 1]) P(s * 0.28, 0, w / 2 + 0.14, 0.08, top + 1.1, 0.08, TIMBER);                              // ladder rails
      for (let y = 0.35; y < top + 1; y += 0.4) P(0, y, w / 2 + 0.14, 0.56, 0.06, 0.06, TIMBER);                         // rungs
      P(0, h, 0, w + 1.3, 0.25, w + 1.3, CONC[1]);                                                                        // platform
      for (const [bx, bz, br, bl] of [[0, e, 0, w + 1.3], [0, -e, 0, w + 1.3], [e, 0, Math.PI / 2, w + 0.1], [-e, 0, Math.PI / 2, w + 0.1]])
        bagStack(x + bx, z + bz, br, bl, 1.0, 0.6, { y0: top, obstacle: false, ax: x, az: z });                            // sandbagged post
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(sx * e, top, sz * e, 0.14, 2.1, 0.14, TIMBER);                // roof posts
      for (let i = 0; i < 4; i++) { const s = +((w + 1.9) * (1 - i * 0.22)).toFixed(2); P(0, top + 2.1 + i * 0.16, 0, s, 0.16, s, TIN[i === 3 ? 1 : 0]); }   // stepped tin roof
      footprint(w, w, x, z, 0, h);
    };
    // Reference look: hangar: blue corrugated walls under a barrel roof of rusty tin (stepped, with arch ribs), the
    // front open behind telescoping sliding doors. 30 x 22, 11 high, doors facing +z.
    const hangar = (x, z) => {
      const P = (lx, ly, lz, bw, bh, bd, m) => part(x, z, 0, lx, ly, lz, bw, bh, bd, m), W = 30, D = 22, wall = 5.5, n = 12, cw = W / n;
      const BLUE = 0x4a6584, BLUED = 0x3c5470, ROOF = [0x8f8c84, 0x99968d], RUSTR = 0x8a5a3a;
      P(0, 0, 0, W, wall, D, BLUE);                                                                                        // walls
      for (let i = 0; i < n; i++) {
        const uc = -W / 2 + (i + 0.5) * cw, t = uc / (W / 2), hh = +((11 - wall) * Math.sqrt(1 - t * t)).toFixed(2);
        P(uc, wall, 0, cw + 0.02, hh, D + 0.4, ROOF[i % 2]);                                                              // roof, one column per step
        for (const s of [-1, 1]) P(uc, wall, s * (D / 2 + 0.03), cw + 0.02, +(hh - 0.3).toFixed(2), 0.04, BLUE);         // end walls under the arch
        for (let k = 0; k < 7; k++) P(uc, wall + hh, -D / 2 + 1.5 + k * 3.17, cw + 0.03, 0.08, 0.3, 0xb2afa6);           // arch ribs
      }
      for (let i = 0; i < 14; i++) P(-W / 2 + 1 + rd() * (W - 2), wall + 4 + rd() * 1.2, -D / 2 + 1 + rd() * (D - 2), 0.6 + rd() * 1.6, 0.06, 0.4 + rd() * 1.2, RUSTR);   // rust on the crown
      for (const s of [-1, 1]) for (let k = 0; k < 18; k++) P(s * (W / 2 + 0.03), 0, -D / 2 + 0.7 + k * 1.22, 0.06, wall, 0.1, BLUED);   // wall ribs
      P(0, 0, D / 2 + 0.05, 22, 8, 0.06, 0x1e2124);                                                                      // open doorway
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {                                                              // sliding doors, stacked at the sides
        P(s * (9.3 - k * 1.3), 0, D / 2 + 0.12 + k * 0.1, 3.6, 8, 0.08, k % 2 ? BLUED : BLUE);
        for (let y = 1; y < 8; y += 1.6) P(s * (9.3 - k * 1.3), y, D / 2 + 0.17 + k * 0.1, 3.4, 0.08, 0.03, BLUED);
      }
      P(0, 8, D / 2 + 0.3, 24, 0.35, 0.3, DARKM);                                                                        // door track
      footprint(W, D, x, z, 0, 11);
    };
    // Reference look: prefab barracks hut: sage-green walls on a plinth, white-framed windows, two doors with steps, a
    // stepped gable roof of rusty tin (ridge along x). 18 x 8, 5 high.
    const barracks = (x, z) => {
      const P = (lx, ly, lz, bw, bh, bd, m) => part(x, z, 0, lx, ly, lz, bw, bh, bd, m), L = 18, D = 8, WALL = 0x8fa08e, FRAME = 0xe4e2da;
      P(0, 0, 0, L + 0.3, 0.3, D + 0.3, CONC[1]); P(0, 0.3, 0, L, 3.0, D, WALL);                                          // plinth, walls
      for (let i = 0; i < 5; i++) P(0, 3.3 + i * 0.34, 0, L + 0.6, 0.34, +(D + 0.6 - i * 1.8).toFixed(2), i % 2 ? 0x7d8783 : 0x858f8a);   // stepped roof
      for (let i = 0; i < 10; i++) P(-L / 2 + 0.5 + rd() * (L - 1), 3.3 + rd() * 1.6, (rd() < 0.5 ? -1 : 1) * (0.5 + rd() * 3.6), 0.4 + rd() * 1.2, 0.36, 0.3 + rd() * 0.6, 0x8a5a3a);   // rust patches
      const win = (u, s) => { P(u, 1.3, s * (D / 2 + 0.02), 1.1, 1.0, 0.04, FRAME); P(u, 1.38, s * (D / 2 + 0.05), 0.9, 0.84, 0.04, 0x2a3036); P(u, 1.38, s * (D / 2 + 0.07), 0.05, 0.84, 0.04, FRAME); };
      for (const u of [-7.2, -4.6, 5.2, 7.6]) win(u, 1);
      for (const u of [-6.5, -2.2, 2.2, 6.5]) win(u, -1);
      for (const u of [-2.0, 2.4]) { P(u, 0.3, D / 2 + 0.03, 1.1, 2.2, 0.05, FRAME); P(u, 0.35, D / 2 + 0.06, 0.9, 2.05, 0.05, 0x6f7d6d); P(u, 0, D / 2 + 0.45, 1.4, 0.3, 0.8, CONC[0]); }   // doors, steps
      for (const s of [-1, 1]) { P(s * (L / 2 + 0.02), 1.3, 0, 0.04, 1.0, 1.1, FRAME); P(s * (L / 2 + 0.05), 1.38, 0, 0.04, 0.84, 0.9, 0x2a3036); }   // end windows
      footprint(L, D, x, z, 0, 5);
    };
    // Reference look: horizontal fuel tank on concrete saddles, banded, a ladder up one end to a railed walkway along the
    // top. The tank and its obstacle are as before: 9 m along x, radius 2.2, centre 2.4 up.
    const fuelTank = (x, z) => {
      const P = (lx, ly, lz, bw, bh, bd, m) => part(x, z, 0, lx, ly, lz, bw, bh, bd, m), R = Math.PI / 2;
      props.push({ geo: 'cyl:2.2,2.2,9,10', color: 0xb0ab9e, x, y: 2.4, z, rot: [0, 0, R], cast: true });
      obstacles.push({ minX: x - 4.5, maxX: x + 4.5, minZ: z - 2.2, maxZ: z + 2.2, h: 4.6 });
      for (const u of [-2.7, 2.7]) P(u, 0, 0, 0.9, 1.1, 4.2, CONC[0]);                                                   // saddles
      for (const u of [-4.5, 4.5]) cyl(x, z, u, 2.4, 0, 2.26, 2.26, 0.14, 10, 0x8d897f, [0, 0, R]);                       // end rims
      for (const u of [-1.5, 1.5]) cyl(x, z, u, 2.4, 0, 2.24, 2.24, 0.16, 10, 0x9c978c, [0, 0, R]);                        // bands
      P(0, 4.58, 0, 7.4, 0.08, 0.7, DARKM);                                                                               // walkway
      for (const s of [-1, 1]) { for (let u = -3.6; u <= 3.61; u += 1.8) P(u, 4.66, s * 0.36, 0.05, 0.85, 0.05, STEEL); P(0, 5.48, s * 0.36, 7.3, 0.05, 0.05, STEEL); }   // handrails
      for (const s of [-1, 1]) P(4.66, 0, s * 0.25, 0.06, 5.2, 0.06, STEEL);                                             // ladder at the +x end
      for (let y = 0.3; y < 5; y += 0.38) P(4.66, y, 0, 0.06, 0.05, 0.5, STEEL);
    };
    // Reference look: floodlight: a round steel pole with collars on a base plate, a four-panel lamp housing on top (the
    // lamps glow at night). The obstacle is the old 0.6 m pole.
    const floodlight = (x, z) => {
      const P = (lx, ly, lz, bw, bh, bd, m) => part(x, z, 0, lx, ly, lz, bw, bh, bd, m);
      P(0, 0, 0, 1.0, 0.25, 1.0, 0x6e6e6c);                                                                               // base plate
      cyl(x, z, 0, 6.1, 0, 0.2, 0.26, 11.7, 8, 0x7c8084);                                                                  // pole
      for (const y of [3, 6, 9]) cyl(x, z, 0, y, 0, 0.31, 0.31, 0.2, 8, 0x5e6266);                                       // collars
      P(0, 11.9, 0, 0.5, 0.3, 0.5, DARKM);                                                                                // mount
      props.push({ geo: 'box:2.0,0.7,1.0', color: 0x222222, emissive: 0xfff2c0, x, y: 12.55, z, rot: [0, 0, 0], cast: true, lampHead: true, ax: x, az: z });   // lamps
      P(0, 12.1, 0, 2.3, 0.12, 1.3, DARKM); P(0, 12.88, 0, 2.3, 0.14, 1.3, DARKM);                                       // housing
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(sx * 1.1, 12.2, sz * 0.6, 0.1, 0.7, 0.1, DARKM);
      for (const s of [-1, 1]) { P(0, 12.2, s * 0.52, 0.08, 0.7, 0.06, DARKM); P(s * 1.02, 12.2, 0, 0.06, 0.7, 0.08, DARKM); }   // panel dividers
      footprint(0.6, 0.6, x, z, 0, 12);
      lamps.push({ x, y: 11, z, color: 0xffe7b0, distance: 55 });
    };
    // Reference look: radio mast: a square steel lattice (legs, a horizontal ring and a zig-zag brace every 1.5 m) on a
    // footing, panel antennas and two dishes high up, whip antennas on the platform. The obstacle is the old 1.2 m mast.
    const radioMast = (x, z, H = 24, w = 1.2) => {
      const P = (lx, ly, lz, bw, bh, bd, m) => part(x, z, 0, lx, ly, lz, bw, bh, bd, m), bay = 1.5, a = Math.atan2(bay, w), dl = +Math.hypot(w, bay).toFixed(3);
      P(0, 0, 0, w + 0.8, 0.3, w + 0.8, CONC[1]);                                                                        // footing
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(sx * w / 2, 0.3, sz * w / 2, 0.12, H - 0.3, 0.12, STEEL);    // legs
      for (let k = 0, y = 0.3; y < H - 0.1; k++, y += bay) {
        for (const s of [-1, 1]) { P(0, y, s * w / 2, w, 0.08, 0.08, STEEL); P(s * w / 2, y, 0, 0.08, 0.08, w, STEEL); }   // ring
        if (y + bay > H) break;
        const z1 = k % 2 ? a : -a;
        for (const s of [-1, 1]) { tilt(x, z, 0, y + bay / 2, s * w / 2, dl, 0.07, 0.07, STEEL, [0, 0, z1]); tilt(x, z, s * w / 2, y + bay / 2, 0, 0.07, 0.07, dl, STEEL, [-z1, 0, 0]); }   // braces
      }
      P(0, H, 0, w + 1.0, 0.18, w + 1.0, 0x8d9195);                                                                      // platform
      for (const [ax2, az2, hh] of [[0.55, 0.55, 3], [-0.55, 0.55, 2.4], [0.55, -0.55, 2.4], [-0.55, -0.55, 3], [0, 0, 4]]) P(ax2, H + 0.18, az2, 0.07, hh, 0.07, 0xc9ccce);   // whips
      for (const s of [-1, 1]) { P(s * (w / 2 + 0.12), H - 2.4, 0, 0.1, 1.4, 0.32, 0xd8d9d6); P(0, H - 2.4, s * (w / 2 + 0.12), 0.32, 1.4, 0.1, 0xd8d9d6); }   // panel antennas
      for (const y of [H - 6, H - 4.8]) { P(w / 2 + 0.15, y - 0.08, 0, 0.3, 0.16, 0.16, DARKM); cyl(x, z, w / 2 + 0.38, y, 0, 0.55, 0.55, 0.12, 10, 0xd8d9d6, [0, 0, Math.PI / 2]); }   // dishes
      footprint(w, w, x, z, 0, H);
    };
    // the equipment hut beside it: concrete under a slab roof, a steel door toward the mast, a vent and an air conditioner
    const equipmentHut = (x, z, toMast = -1) => {
      const P = (lx, ly, lz, bw, bh, bd, m) => part(x, z, 0, lx, ly, lz, bw, bh, bd, m);
      P(0, 0, 0, 6, 3.0, 5, 0xb2aea3); P(0, 3.0, 0, 6.4, 0.25, 5.4, 0x9a968d);                                           // walls, roof slab
      stains(P, 6, 5, 3.0, 8, 0.3);
      P(toMast * 3.02, 0, 0.8, 0.06, 2.1, 1.0, 0x6d7378); P(toMast * 3.05, 1.0, 1.15, 0.04, 0.08, 0.12, DARKM);          // door, handle
      P(-toMast * 3.03, 2.0, -1.0, 0.06, 0.5, 0.8, 0x5e6266);                                                            // vent
      P(0.8, 0.6, 2.75, 1.0, 0.8, 0.5, 0xc9cbc6); cyl(x, z, 0.8, 1.0, 3.01, 0.3, 0.3, 0.04, 10, 0x55595c, [Math.PI / 2, 0, 0]);   // air conditioner
      P(toMast * 4.3, 2.5, -0.3, 2.6, 0.12, 0.3, DARKM);                                                                 // cable tray to the mast
      footprint(6, 5, x, z, 0, 3.2);
    };
    // Reference look: market stall: a checked cloth awning with a valance on four timber poles, crates of fruit underneath.
    // No obstacle, as before.
    const FRUIT = [0xc0392b, 0xe67e22, 0x7dab3a, 0xe8c547];
    const stall = (x, z, rot, col, col2) => {
      const P = (lx, ly, lz, bw, bh, bd, m) => part(x, z, rot, lx, ly, lz, bw, bh, bd, m);
      for (const [px, pz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) P(px, 0, pz, 0.14, 2.6, 0.14, 0x7a5a3a);   // poles
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) P(-1.35 + i * 0.9, 2.6, -0.93 + j * 0.93, 0.9, 0.12, 0.93, (i + j) % 2 ? col2 : col);   // checked awning
      for (let i = 0; i < 4; i++) P(-1.35 + i * 0.9, 2.35, 1.42, 0.9, 0.3, 0.04, i % 2 ? col : col2);                   // valance
      for (const [cx, cz, y] of [[-0.7, 0.2, 0], [0.5, 0.35, 0], [-0.1, -0.5, 0], [0.5, 0.35, 0.5]]) {
        P(cx, y, cz, 0.8, 0.5, 0.6, 0x9a7448); P(cx, y + 0.1, cz + 0.31, 0.8, 0.06, 0.02, 0x6e5233);                    // crate and its slat
        for (let k = 0; k < 6; k++) P(cx - 0.25 + (k % 3) * 0.25, y + 0.5, cz - 0.12 + Math.floor(k / 3) * 0.24, 0.18, 0.12, 0.18, FRUIT[Math.floor(rd() * 4)]);   // fruit
      }
    };
    // Reference look: village well: a ring of stone blocks in two courses round a dark shaft, a timber frame with a
    // crossbeam, a rope and a bucket. Its obstacle stays where it is placed.
    const STONE = [0x8f8a80, 0x7e7a71, 0x9c978c];
    const well = (x, z) => {
      for (let c = 0; c < 2; c++) for (let k = 0; k < 10; k++) part(x, z, (k + c * 0.5) / 10 * Math.PI * 2, 0, c * 0.48, 1.15, 0.66, 0.44, 0.42, STONE[Math.floor(rd() * 3)]);   // stone ring
      cyl(x, z, 0, 0.5, 0, 0.98, 0.98, 0.1, 10, 0x1c2226);                                                               // the dark shaft
      const P = (lx, ly, lz, bw, bh, bd, m) => part(x, z, 0, lx, ly, lz, bw, bh, bd, m);
      for (const s of [-1, 1]) P(s * 1.5, 0, 0, 0.22, 2.7, 0.22, 0x6e4f33);                                              // posts
      P(0, 2.5, 0, 3.2, 0.22, 0.22, 0x6e4f33); P(0, 2.2, 0, 0.3, 0.3, 0.3, 0x5a3f28);                                     // crossbeam, pulley
      P(0, 1.35, 0, 0.05, 0.85, 0.05, 0xb59a6a); P(0, 1.05, 0, 0.34, 0.32, 0.34, 0x5e4630);                               // rope, bucket
    };
    const sandbagRing = (cx, cz, rad, gap = 0.9) => {
      const n = Math.round(rad * 2); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad; if (Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap))) < 0.35 || onRoad(x, z)) continue; bagStack(x, z, -a); }   // a gap at angle gap, and one where the road crosses
    };
    const containers = (x0, z0, cols, rows) => {
      const colsC = [0x6f4a3a, 0x44584a, 0x4f5a6b, 0x8a7a3a, 0x5a4a5a];
      for (let i = 0; i < cols * rows; i++) { const x = x0 + (i % cols) * 7, z = z0 + Math.floor(i / cols) * 4, rot = (r() - 0.5) * 0.15; container(x, z, rot, colsC[i % 5]); if (r() < 0.4) container(x, z, rot, colsC[(i + 2) % 5], 2.6, false); }
    };
    const scrub = (cx, cz, rad, n) => { for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad; tufts.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, yaw: r() * Math.PI, size: [0.7, 0.9, 1.15][Math.floor(r() * 3)] }); } };

    // ---- main bases: sandbag perimeter, containers, floodlights, a tower
    for (const b of this.bases) {
      sandbagRing(b.x, b.z, 30, Math.atan2(-b.z, -b.x));                                                              // the gate faces the map centre, where the road comes in
      containers(b.x - 20, b.z + 14, 3, 2);
      floodlight(...offRoad(b.x - 20, b.z - 15, ROAD_CLEAR + 1)); floodlight(...offRoad(b.x + 20, b.z + 15, ROAD_CLEAR + 1));   // just inside the ring
      watchtower(b.x + 22, b.z - 22, 5, 10);
    }
    // ---- Outpost: hesco wall ring (gates where the road runs through it), watchtower beside the road, sandbags
    { const o = this.locations[0]; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, x = o.x + Math.cos(a) * 16, z = o.z + Math.sin(a) * 16; if (i === 2 || onRoad(x, z, ROAD_CLEAR + 2.5)) continue; hesco(x, z, -a + Math.PI / 2); }
      watchtower(...offRoad(o.x, o.z, ROAD_CLEAR + 1.5, [-1, 1]), 3, 8); sandbagRing(o.x + 10, o.z - 8, 5, 2.5); for (let i = 0; i < 6; i++) bush(o.x + (r() - 0.5) * 60, o.z + (r() - 0.5) * 60); }
    // ---- Airfield: apron props (concrete painted in the splat), hangar, tower, containers, tanks, helipads
    { const a = this.locations[1], ax = a.x, az = a.z;
      hangar(ax - 50, az + 40);
      controlTower(ax + 60, az - 60);
      barracks(ax - 62, az - 20); barracks(ax - 62, az - 8);
      containers(ax + 10, az - 45, 7, 2);
      for (let i = 0; i < 3; i++) fuelTank(ax + 30, az + 5 + i * 6);                                                   // inside the apron, clear of the road across its corner
      floodlight(ax - 30, az - 60); floodlight(ax + 40, az + 65);
      for (const [hx, hz] of [[40, 40], [57, 40], [40, 57]]) decals.push({ x: ax + hx, z: az + hz, w: 14, d: 14, rot: 0, tex: 'helipad' });
      for (let i = 0; i < 6; i++) decals.push({ x: ax - 66 + i * 9, z: az - 64, w: 7, d: 12, rot: 0, tex: 'bay' });
      strips.push({ points: [[ax - 62, az - 26], [ax + 62, az + 8]], width: 0.6, tex: 'line', vRepeat: 4, y: 0.05 }, { points: [[ax - 62, az + 46], [ax + 62, az - 46]], width: 0.6, tex: 'line', vRepeat: 4, y: 0.05 }, { points: [[ax + 20, az - 62], [ax + 20, az + 62]], width: 0.6, tex: 'line', vRepeat: 4, y: 0.05 });
      strips.push({ points: [[ax - 62, az + 28], [ax + 62, az + 28]], width: 1.2, tex: 'dash', vRepeat: 16, y: 0.05, cutout: true });
    }
    // ---- Village: houses on a grid with lanes, compound walls, palms, market
    { const v = this.locations[2], vx = v.x, vz = v.z;
      // Street village: the road runs straight through the centre and every house and wall is placed in
      // point-symmetric pairs about it, so the approach from either base meets the same cover and the same
      // openings. (The old grid put a garden wall with one 4 m gap across the north-east approach, and the
      // road-clearance filter below silently removed the houses on one side of the road.)
      const d = [0.6, 0.8], n = [0.8, -0.6];                                                   // along / across the road
      const at = (s, o) => [vx + d[0] * s + n[0] * o, vz + d[1] * s + n[1] * o];
      const pair = (fn) => (s, o, ...rest) => { fn(...at(s, o), ...rest); fn(...at(-s, -o), ...rest); };
      const along = Math.atan2(d[0], d[1]);
      const plots = [[-32, 15], [-12, 15], [8, 15], [28, 15], [-22, 29], [0, 29], [22, 29]];
      const street = (x, z, ...rest) => { const t = (x - vx) * d[0] + (z - vz) * d[1]; house(x, z, ...rest, [vx + d[0] * t, vz + d[1] * t]); };   // door toward the road
      plots.forEach(([s, o], i) => pair(street)(s, o, 6 + (i % 3), 6 + ((i * 2) % 3), i % 4 === 0 ? 2 : 1, along + (r() - 0.5) * 0.2));
      const wallPair = (s0, o0, s1, o1, h) => { wallRun(...at(s0, o0), ...at(s1, o1), h); wallRun(...at(-s0, -o0), ...at(-s1, -o1), h); };
      wallPair(-40, 37, -6, 37);                                                               // compound walls behind the outer rows, opposite corners
      wallPair(-36, 11, -18, 11, 1.2); wallPair(-6, 11, 14, 11, 1.2);                          // low garden walls along the street (cover, not line-of-sight blockers)
      for (const [px, pz] of [[-40, -30], [-38, 22], [0, 44], [-14, 40]]) { palm(vx + px, vz + pz); palm(vx - px, vz - pz); }
      // market stalls in a gap of the east row: cloth awnings, poles, crates; a well in a gap of the west row
      for (let i = 0; i < 4; i++) { const [sx, sz] = at(13 + i * 3, 15), col = [0xb04a3a, 0x3a6ab0, 0xd0b040, 0x6a9a4a][i];
        stall(sx, sz, along, col, [0xe2b640, 0xe8e2d0, 0xb04a3a, 0xe8e2d0][i]);
        if (i % 2) box(1, 0.9, 1, 0x8a6a3a, sx + 1, sz - 2.2, { rot: r() * 0.5 });
      }
      { const [wx, wz] = at(-18, -15); well(wx, wz); obstacles.push({ minX: wx - 1.5, maxX: wx + 1.5, minZ: wz - 1.5, maxZ: wz + 1.5, h: 1.2 }); }
      for (let i = 0; i < 10; i++) bush(vx + (r() - 0.5) * 110, vz + (r() - 0.5) * 110);
      // mosque with a dome and minaret at the west edge
      { const mx = vx - 48, mz = vz + 2;
        box(12, 5, 10, null, mx, mz, { tex: 'plaster3' }); box(13, 0.4, 11, 0xc9b48f, mx, mz, { y: 5, obstacle: false });
        props.push({ geo: 'cyl:1.9,3.3,1.7,12', color: 0x7fa6a0, x: mx, y: 6.25, z: mz, rot: [0, 0, 0], cast: true });
        props.push({ geo: 'cyl:0.15,1.9,1.3,12', color: 0x7fa6a0, x: mx, y: 7.75, z: mz, rot: [0, 0, 0], cast: true });
        box(1.6, 2.6, 0.2, 0x4a3a2a, mx, mz + 5.05, { obstacle: false });
        box(2.2, 16, 2.2, null, mx - 8, mz - 6, { tex: 'plaster3' }); box(3.2, 0.5, 3.2, 0x7fa6a0, mx - 8, mz - 6, { y: 16, obstacle: false });
        props.push({ geo: 'cyl:0.1,1.5,1.5,10', color: 0x7fa6a0, x: mx - 8, y: 17.25, z: mz - 6, rot: [0, 0, 0], cast: true });
        for (let i = 0; i < 4; i++) box(0.3, 0.6, 0.3, 0x4a3a2a, mx - 8 + (i % 2 ? 0.9 : -0.9), mz - 6 + (i < 2 ? 0.9 : -0.9), { y: 15.4, obstacle: false });
      }
      // walled compound east of the village: a courtyard house with a gap on its west side
      { const cx = vx + 54, cz = vz - 2;
        house(cx + 2, cz + 1, 7, 6, 1, 0, [cx - 8, cz]); wallRun(cx - 8, cz - 8, cx + 8, cz - 8); wallRun(cx + 8, cz - 8, cx + 8, cz + 8); wallRun(cx + 8, cz + 8, cx - 8, cz + 8); wallRun(cx - 8, cz + 8, cx - 8, cz + 2); wallRun(cx - 8, cz - 8, cx - 8, cz - 3);
        for (let i = 0; i < 3; i++) box(1, 1, 1, 0x8a6a3a, cx - 5 + i * 1.2, cz + 5.5, { rot: r() * 0.4 });
        palm(cx - 4, cz - 4);
      }
      // rubble outside both compound walls
      for (let i = 0; i < 7; i++) { const s = 0.6 + r() * 0.9, col = [0xcbb58e, 0xb5a37c, 0x9c8b64][Math.floor(r() * 3)], rs = -40 + r() * 36, ro = 39 + r() * 3; pair((x, z) => box(s, s * 0.5, s * 0.8, col, x, z, { rot: r() * Math.PI }))(rs, ro); }
      well(vx + 50, vz - 22); obstacles.push({ minX: vx + 48.5, maxX: vx + 51.5, minZ: vz - 23.5, maxZ: vz - 20.5, h: 1.2 });
      scrub(vx, vz, 55, 120);
    }
    // ---- Depot: fuel tanks, fence posts, containers on an asphalt pad
    { const d = this.locations[3], dx = d.x, dz = d.z;
      // the road runs through the pad (north-east); six tanks in two staggered rows along its north-west side, 8 m apart along the road
      for (let i = 0; i < 6; i++) { const k = (i % 3) - 1, out = 14 + Math.floor(i / 3) * 8; fuelTank(dx + 0.707 * (8 * k - out), dz + 0.707 * (8 * k + out)); }
      containers(dx + 10, dz - 12, 3, 3);
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, x = dx + Math.cos(a) * 30, z = dz + Math.sin(a) * 30; if (!onRoad(x, z, 7)) box(0.3, 2.4, 0.3, 0x5a5a5a, x, z, { obstacle: false }); }   // fence posts, none on the road
      floodlight(dx - 26, dz + 20);
    }
    // ---- Relay: mast, hut, sandbags
    { const l = this.locations[4], [mx, mz] = offRoad(l.x, l.z, ROAD_CLEAR + 4);                                       // the location sits 4 m off the road: mast and hut beside it
      radioMast(mx, mz); equipmentHut(mx + 8, mz - 4); sandbagRing(mx, mz, 9, Math.atan2(-4, 8)); for (let i = 0; i < 5; i++) rock(l.x + (r() - 0.5) * 50, l.z + (r() - 0.5) * 50); }   // the ring opens to the hut, and to the road
    // ---- open desert: rocks, bushes, scrub patches, an oasis
    // keep the open desert clutter off the apron, the depot pad and the bases
    const a1 = this.locations[1], d1 = this.locations[3];
    const clear = (x, z) => Math.abs(x - a1.x) < 70 && Math.abs(z - a1.z) < 70 || Math.abs(x - d1.x) < 40 && Math.abs(z - d1.z) < 40 || this.bases.some(b => Math.hypot(x - b.x, z - b.z) < 40);
    for (let i = 0; i < 160; i++) { const x = -470 + r() * 940, z = -470 + r() * 940; if (!clear(x, z)) rock(x, z); }
    for (let i = 0; i < 90; i++) { const x = -470 + r() * 940, z = -470 + r() * 940; if (!clear(x, z)) bush(x, z); }
    for (let i = 0; i < 48; i++) { const x = -460 + r() * 920, z = -460 + r() * 920; if (!clear(x, z)) scrub(x, z, 14 + r() * 22, 90); }
    const oasis = { x: 150, z: -220 }; for (let i = 0; i < 6; i++) palm(oasis.x + (r() - 0.5) * 30, oasis.z + (r() - 0.5) * 30); scrub(oasis.x, oasis.z, 30, 260);
    // ---- bridge: deck, railings and piers (absolute heights; the deck is walkable via WorldState.heightAt)
    for (const b of this.bridges) {
      const sn = Math.sin(b.angle), cs = Math.cos(b.angle);
      props.push({ geo: `box:${b.w},1.2,${b.len}`, color: 0x6a6a6c, x: b.x, y: b.y - 0.6, z: b.z, rot: [0, b.angle, 0], cast: true, absY: true });
      for (const side of [-1, 1]) {
        const ox = cs * side * (b.w / 2 - 0.3), oz = -sn * side * (b.w / 2 - 0.3);
        props.push({ geo: `box:0.3,1.1,${b.len}`, color: 0x8a8a8a, x: b.x + ox, y: b.y + 0.55, z: b.z + oz, rot: [0, b.angle, 0], cast: true, absY: true });
        const len = b.len, hw = 0.15, c = Math.abs(cs), s = Math.abs(sn);
        obstacles.push({ minX: b.x + ox - (hw * c + len / 2 * s), maxX: b.x + ox + (hw * c + len / 2 * s), minZ: b.z + oz - (hw * s + len / 2 * c), maxZ: b.z + oz + (hw * s + len / 2 * c), h: b.y + 1.1 });
      }
      for (const k of [-18, 0, 18]) props.push({ geo: 'box:2.6,10,2.6', color: 0x7a7a7c, x: b.x + sn * k, y: b.y - 5.6, z: b.z + cs * k, rot: [0, b.angle, 0], cast: true, absY: true });
    }
    // ---- roads

    strips.push({ points: this.roadPath, width: 12, tex: 'road', vRepeat: 8, smooth: 2, y: 0.03 });
    for (const t of this.tracks) strips.push({ points: t, width: 5, tex: 'track', vRepeat: 4, smooth: 2, y: 0.02 });
    // keep obstacles off the road itself
    const roadFree = (o) => !onRoad((o.minX + o.maxX) / 2, (o.minZ + o.maxZ) / 2);
    const keep = new Set(obstacles.filter(roadFree));
    return { props, obstacles: [...keep], lamps, tufts: tufts.filter(t => !clear(t.x, t.z) && !onRoad(t.x, t.z, 6.5)), decals, strips, oasis };
  },

  // paints the splat map: r concrete, g asphalt, b grass, a dirt (sand elsewhere)
  paintSplat(g, px, half) {
    const ppm = px / (half * 2), X = (x) => (x + half) * ppm, Z = (z) => (half - z) * ppm;
    g.clearRect(0, 0, px, px);
    const disc = (x, z, rad, style) => { g.fillStyle = style; g.beginPath(); g.arc(X(x), Z(z), rad * ppm, 0, Math.PI * 2); g.fill(); };
    const a = this.locations[1]; g.fillStyle = 'rgb(255,0,0)'; g.fillRect(X(a.x - 64), Z(a.z + 64), 128 * ppm, 128 * ppm);           // airfield apron
    const d = this.locations[3]; g.fillStyle = 'rgb(0,255,0)'; g.fillRect(X(d.x - 34), Z(d.z + 34), 68 * ppm, 68 * ppm);             // depot pad
    for (const b of this.bases) disc(b.x, b.z, 36, 'rgba(0,0,0,0.85)');                                                              // dirt bases
    const v = this.locations[2]; disc(v.x, v.z, 60, 'rgba(0,0,0,0.9)'); for (const [ox, oz] of [[-40, -30], [-38, 22], [40, 30], [38, -22]]) disc(v.x + ox, v.z + oz, 9, 'rgba(0,0,255,0.9)');
    disc(150, -220, 34, 'rgba(0,0,255,0.95)'); disc(150, -220, 48, 'rgba(0,0,0,0.5)');                                               // oasis
    // riverside greenery and a sandy ford
    for (const rv of this.terrain.rivers.map(r => r.path)) { g.strokeStyle = 'rgba(0,0,255,0.75)'; g.lineWidth = 56 * ppm; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(X(rv[0][0]), Z(rv[0][1])); for (const p of rv.slice(1)) g.lineTo(X(p[0]), Z(p[1])); g.stroke(); }
    for (const f of this.terrain.fords) { g.fillStyle = 'rgb(0,0,0)'; g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(X(f.x), Z(f.z), f.r * 1.3 * ppm, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; }
    for (const t of this.tracks) { g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 9 * ppm; g.lineCap = 'round'; g.beginPath(); g.moveTo(X(t[0][0]), Z(t[0][1])); for (const p of t.slice(1)) g.lineTo(X(p[0]), Z(p[1])); g.stroke(); }
  },
};
