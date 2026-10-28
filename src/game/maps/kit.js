// Prop builders shared by the maps: boxes with their footprints, multi-part props (houses, walls, hesco, containers,
// towers, hangars, tanks, masts, stalls, wells), sandbags, palms, bushes, rocks and scrub. A map's build() makes a kit with
// its own random generators (r for layout, rd for decoration, so decoration never shifts the layout) and its road test,
// places things with it, and returns the kit's props, obstacles, lamps, tufts and decals with its own strips.
export function makeKit({ r, rd, onRoad = () => false }) {
  const props = [], obstacles = [], lamps = [], tufts = [], decals = [];
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
  // Reference look: a concrete road bridge (a deck slab on two girders, kerbs, steel railings on posts with two rails,
  // two-column piers with caps standing on the river bed, an abutment and wing walls at each end) or, with b.foot, a
  // timber footbridge (planks on two stringers, rope rails at two heights on posts, piles). Absolute heights: the deck's top
  // is at b.y. The railings are the obstacles, inset from the deck's edge, exactly as they always were; the rest is for the
  // eye. Local frame as part(): x across the deck, z along it.
  const bridge = (b, inset = 0.3, bed = -7.5) => {
    const c = Math.cos(b.angle), s = Math.sin(b.angle), L = b.len, W = b.w;
    const P = (lx, ly, lz, w, h, d, color) => props.push({ geo: 'box:1,1,1', color, scale: [w, h, d], x: b.x + lx * c + lz * s, y: ly + h / 2, z: b.z - lx * s + lz * c, rot: [0, b.angle, 0], cast: Math.min(w, h, d) >= 0.25 || Math.max(w, h, d) >= 3, absY: true });
    const pile = (lx, lz, r, y0, h, color) => props.push({ geo: `cyl:${r},${r},${+h.toFixed(2)},8`, color, x: b.x + lx * c + lz * s, y: y0 + h / 2, z: b.z - lx * s + lz * c, rot: [0, 0, 0], cast: true, absY: true });
    if (b.truss) {
      // a railway truss after the user's diorama: blue steel through-trusses (chords, end posts, verticals, diagonals sloping
      // down to mid-span, cross-bracing overhead) in spans of up to 70 m on stone piers, a steel deck with sleepers and two
      // rails. Its members tilt in the bridge's own vertical plane, so a truss runs along x or z (angle 0 or a right angle).
      const BLUE = 0x3a6db0, STONE = 0x8d8880, H = 6.5, spans = Math.ceil(L / 70), Ls = L / spans, n = Math.max(4, Math.round(Ls / 6.2)), pl = Ls / n, alongX = Math.abs(s) > 0.5;
      const beam = (lx, z0, y0, z1, y1, t, color) => {   // a member in the plane x = lx of the bridge's frame, from (z0, y0) to (z1, y1)
        const len = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y1 - y0, z1 - z0), mz = (z0 + z1) / 2, my = (y0 + y1) / 2;
        props.push({ geo: 'box:1,1,1', color, scale: alongX ? [len, t, t] : [t, t, len], x: b.x + lx * c + mz * s, y: my, z: b.z - lx * s + mz * c, rot: alongX ? [0, 0, a * Math.sign(s)] : [-a * Math.sign(c), 0, 0], cast: true, absY: true });
      };
      P(0, b.y - 0.45, 0, W, 0.45, L, 0x46484a);                                                                                       // deck
      for (let k = -L / 2 + 0.6; k < L / 2; k += 1.2) P(0, b.y, +k.toFixed(2), 2.6, 0.12, 0.25, 0x5b4433);                          // sleepers
      for (const sx of [-0.75, 0.75]) P(sx, b.y + 0.12, 0, 0.12, 0.16, L, 0x6e6a66);                                               // rails
      const top = b.y + H;
      for (let k = 0; k < spans; k++) {
        const z0 = -L / 2 + k * Ls, z1 = z0 + Ls, mid = (z0 + z1) / 2;
        for (const sx of [-1, 1].map(v => v * (W / 2 + 0.25))) {
          P(sx, b.y - 0.5, mid, 0.5, 0.5, Ls, BLUE); P(sx, top - 0.25, mid, 0.5, 0.5, Ls - 2 * pl, BLUE);                         // chords
          beam(sx, z0, b.y, z0 + pl, top, 0.55, BLUE); beam(sx, z1, b.y, z1 - pl, top, 0.55, BLUE);                               // end posts
          for (let i = 1; i < n; i++) P(sx, b.y, z0 + i * pl, 0.35, H, 0.35, BLUE);                                                 // verticals
          for (let i = 1; i < n - 1; i++) { const a0 = z0 + i * pl, a1 = a0 + pl, down = i < n / 2; beam(sx, a0, down ? top : b.y, a1, down ? b.y : top, 0.32, BLUE); }   // diagonals
        }
        for (let i = 1; i < n; i++) P(0, top - 0.3, z0 + i * pl, W + 0.5, 0.3, 0.3, BLUE);                                         // overhead bracing
        if (k > 0) P(0, bed, z0, W + 2.4, +(b.y - 0.9 - bed).toFixed(2), 3.2, STONE);                                               // a pier between spans
      }
      for (const sz of [-1, 1]) P(0, -2.5, sz * (L / 2 - 1.0), W + 1.6, +(b.y + 1.5).toFixed(2), 2.0, STONE);                      // abutments
    } else if (b.foot) {
      const WOODS = [0x8a6a46, 0x7a5c3c, 0x957552];
      for (const sx of [-1, 1]) P(sx * (W / 2 - 0.5), b.y - 0.55, 0, 0.3, 0.35, L, TIMBER);                                           // stringers
      for (let k = -L / 2 + 0.25, i = 0; k < L / 2; k += 0.46, i++) P(+((rd() - 0.5) * 0.06).toFixed(3), b.y - 0.2, +k.toFixed(2), W - 0.1, 0.2, 0.4, WOODS[i % 3]);   // planks, the odd one askew
      for (let k = -L / 2 + 0.5; k <= L / 2 - 0.5 + 1e-6; k += 4) for (const sx of [-1, 1]) P(sx * (W / 2 - 0.15), b.y, +k.toFixed(2), 0.14, 1.05, 0.14, TIMBER);   // posts
      for (const y of [0.5, 0.95]) for (const sx of [-1, 1]) P(sx * (W / 2 - 0.15), b.y + y, 0, 0.06, 0.06, L - 1, 0xb59a6a);         // rope rails
      for (const k of [-L / 4, L / 4]) for (const sx of [-1, 1]) pile(sx * 1.4, +k.toFixed(2), 0.22, bed, b.y - 0.55 - bed, TIMBER);   // piles
    } else {
      P(0, b.y - 1.0, 0, W, 1.0, L, CONC[0]);                                                                                        // deck slab
      for (const sx of [-1, 1]) P(+(sx * W / 3).toFixed(2), b.y - 1.9, 0, 1.2, 0.9, L, CONC[1]);                                     // girders
      for (const sx of [-1, 1]) P(sx * (W / 2 - 0.25), b.y, 0, 0.5, 0.3, L, 0xb5b2aa);                                              // kerbs
      for (const sx of [-1, 1]) {                                                                                                     // railings
        for (let k = -L / 2 + 1; k <= L / 2 - 1 + 1e-6; k += 2) P(sx * (W / 2 - inset), b.y + 0.3, +k.toFixed(2), 0.12, 0.8, 0.12, STEEL);
        P(sx * (W / 2 - inset), b.y + 1.05, 0, 0.14, 0.1, L, STEEL); P(sx * (W / 2 - inset), b.y + 0.65, 0, 0.08, 0.08, L, STEEL);
      }
      for (const k of [-L / 3, 0, L / 3].map(v => +v.toFixed(2))) {                                                                  // piers on the bed, and their caps
        for (const sx of [-1, 1]) P(sx * W / 4, bed, k, 1.6, +(b.y - 2.0 - bed).toFixed(2), 1.6, CONC[1]);
        P(0, b.y - 2.6, k, W - 1, 0.7, 2.0, CONC[0]);
      }
      for (const sz of [-1, 1]) {                                                                                                     // abutments and wing walls
        P(0, -2.5, sz * (L / 2 - 1.0), W + 1.2, +(b.y + 1.5).toFixed(2), 2.0, CONC[1]);
        for (const sx of [-1, 1]) P(sx * (W / 2 + 0.6), -2.5, sz * (L / 2 + 2.5), 1.0, +(b.y + 2.9).toFixed(2), 5.0, CONC[0]);
      }
    }
    for (const side of [-1, 1]) {   // the railings block movement
      const ox = c * side * (W / 2 - inset), oz = -s * side * (W / 2 - inset), hw = 0.15, ac = Math.abs(c), as = Math.abs(s);
      obstacles.push({ minX: b.x + ox - (hw * ac + L / 2 * as), maxX: b.x + ox + (hw * ac + L / 2 * as), minZ: b.z + oz - (hw * as + L / 2 * ac), maxZ: b.z + oz + (hw * as + L / 2 * ac), h: b.y + 1.1 });
    }
  };
  // ---- Narva's city kit, after the user's voxel diorama (2026-10-28): Soviet panel blocks of five and nine storeys with
  // entrance canopies, a nine-storey point block, brick lock-up garages, pine and birch, wagons and a platform, banded chimneys.
  const PANEL = [0xcac5b8, 0xbfb9ab, 0xd3cec2], GLASS = 0x4a5562, ROOFG = 0x8e8b84, CANOPY = 0xb3aea3, BENCH = 0x6e5a44, DOORP = 0x5b4b3d;
  // Windows cost little: one dark band per floor along a face, cut into panes by full-height pilasters at each 3.2 m bay, so a
  // facade is a few parts per floor and bay rather than one per pane. Q places parts in the building's frame; the face runs
  // along local x at z = s * half (ax 'x') or along local z at x = s * half (ax 'z').
  const facade = (Q, ax, s, half, len, floors, h, col) => {
    const F = (u, ly, out, w, hh, t, m) => (ax === 'x' ? Q(u, ly, s * (half + out), w, hh, t, m) : Q(s * (half + out), ly, u, t, hh, w, m));
    const bays = Math.max(1, Math.round(len / 3.2)), bw = len / bays;
    for (let f = 0; f < floors; f++) F(0, f * 2.8 + 0.85, 0.03, len - 0.8, 1.35, 0.06, GLASS);
    for (let i = 0; i <= bays; i++) F(-len / 2 + i * bw, 0, 0.07, 1.5, h - 0.3, 0.1, col);
    return bw;
  };
  const roofOf = (Q, w, d, h, col) => {   // a flat roof inside a parapet
    Q(0, h, 0, w - 0.6, 0.1, d - 0.6, ROOFG);
    for (const s of [-1, 1]) { Q(0, h, s * (d / 2 - 0.15), w, 0.45, 0.3, col); Q(s * (w / 2 - 0.15), h, 0, 0.3, 0.45, d - 0.6, col); }
  };
  const entrance = (Q, u, zFace, col) => {   // a door under a concrete canopy with side walls, a bench beside it (on the -z face)
    Q(u, 0, zFace - 0.08, 1.3, 2.2, 0.08, DOORP); Q(u, 2.5, zFace - 0.9, 2.4, 0.18, 1.8, CANOPY);
    for (const k of [-1, 1]) Q(u + k * 1.1, 0, zFace - 0.9, 0.18, 2.5, 1.8, col);
    Q(u + 2.6, 0, zFace - 2.4, 1.6, 0.45, 0.5, BENCH);
  };
  // A panel block along its local x, len long and depth deep, floors of 2.8 m: windows on all four faces, entrances on the -z
  // face with a stair hut above each on the roof.
  const panelBlock = (x, z, len, floors = 5, rot = 0, depth = 12) => {
    const col = PANEL[Math.floor(rd() * 3)], h = +(floors * 2.8 + 0.5).toFixed(2), Q = (lx, ly, lz, w, hh, d, m) => part(x, z, rot, lx, ly, lz, w, hh, d, m);
    Q(0, 0, 0, len, h, depth, col); footprint(len, depth, x, z, rot, h);
    let bw = 0; for (const s of [-1, 1]) { bw = facade(Q, 'x', s, depth / 2, len, floors, h, col); facade(Q, 'z', s, len / 2, depth, floors, h, col); }
    roofOf(Q, len, depth, h, col);
    const n = Math.max(2, Math.round(len / 18));
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + (Math.floor((k + 0.5) * len / n / bw) + 0.5) * bw;
      entrance(Q, u, -depth / 2, col); Q(u, h, -depth / 2 + 3, 3, 2.2, 4, col);
    }
  };
  // A nine-storey point block: w x d, windows on all faces, a lift and stair column standing out of the +z face with slit
  // windows, the entrance on -z, a machine room on the roof.
  const panelTower = (x, z, rot = 0, floors = 9, w = 18, d = 15) => {
    const col = PANEL[Math.floor(rd() * 3)], h = +(floors * 2.8 + 0.5).toFixed(2), Q = (lx, ly, lz, bw, hh, bd, m) => part(x, z, rot, lx, ly, lz, bw, hh, bd, m);
    Q(0, 0, 0, w, h, d, col); footprint(w, d + 3, x, z, rot, h);
    for (const s of [-1, 1]) { facade(Q, 'x', s, d / 2, w, floors, h, col); facade(Q, 'z', s, w / 2, d, floors, h, col); }
    Q(0, 0, d / 2 + 1.5, 4, h + 2.4, 3, col);
    for (let f = 0; f < floors; f++) Q(0, f * 2.8 + 1.1, d / 2 + 3.03, 0.8, 1.2, 0.06, GLASS);
    roofOf(Q, w, d, h, col); Q(-3, h, -1, 6, 2.6, 5, col);
    entrance(Q, 0, -d / 2, col);
  };
  // A row of n brick lock-up garages along local x (3.4 m each, 6.5 deep, 2.6 high) under one dark roof slab overhanging the
  // doors on the local -z face, a door and lintel per garage, brick piers between them.
  const BRICK = [0x9b4a33, 0x8f432e, 0xa5533a], GROOF = 0x4d4845, GDOOR = 0x6b3a2a;
  const garages = (x, z, n, rot = 0) => {
    const col = BRICK[Math.floor(rd() * 3)], W = n * 3.4, Q = (lx, ly, lz, w, hh, d, m) => part(x, z, rot, lx, ly, lz, w, hh, d, m);
    Q(0, 0, 0, W, 2.6, 6.5, col); footprint(W, 6.5, x, z, rot, 2.6);
    Q(0, 2.6, -0.2, W + 0.3, 0.25, 7.1, GROOF);
    for (let i = 0; i < n; i++) { const u = -W / 2 + (i + 0.5) * 3.4; Q(u, 0.05, -3.29, 2.6, 2.15, 0.08, GDOOR); Q(u, 2.2, -3.31, 2.9, 0.22, 0.1, shade(col, 0.8)); }
    for (let i = 0; i <= n; i++) Q(-W / 2 + i * 3.4, 0, -3.3, 0.4, 2.6, 0.14, col);
  };
  // Voxel trees after the diorama: a pine of stacked square tiers on a brown trunk; a birch with a white, black-flecked trunk under
  // a few bright-green blocks. Each blocks sight at its trunk like any tall box. h is the height.
  const PINE = [0x2c5a35, 0x356a3c, 0x2a4f31], BIRCHL = [0x8cbf4e, 0x7db043, 0x9acb5b];
  const pine = (x, z, h = 11) => {
    const yaw = rd() * Math.PI / 2, s = h / 11, t = h * 0.22, Q = (ly, w, hh, m) => part(x, z, yaw, 0, ly, 0, w, hh, w, m);
    Q(0, 0.5, t + 0.5, 0x5a3e2a);
    let y = t; [[3.6, 0.3], [2.8, 0.3], [2.0, 0.25], [1.2, 0.2]].forEach(([w, k], i) => { const th = (h - t) * k; Q(y, w * s, th + 0.4, PINE[i % 3]); y += th; });
    Q(y, 0.5 * s, 0.8 * s, PINE[1]);
    obstacles.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, h });
  };
  const birch = (x, z, h = 9) => {
    const yaw = rd() * Math.PI / 2, s = h / 9, t = h * 0.5, Q = (lx, ly, lz, w, hh, d, m) => part(x, z, yaw, lx, ly, lz, w, hh, d, m);
    Q(0, 0, 0, 0.42, t + 1, 0.42, 0xe6e2d6);
    for (let k = 0; k < 3; k++) Q(0, 0.8 + k * t / 3, 0.2, 0.44, 0.18, 0.06, 0x2b2a28);
    Q(0, t, 0, 3 * s, 2.6 * s, 3 * s, BIRCHL[0]); Q(0.9 * s, t + 1.6 * s, -0.5 * s, 2.2 * s, 2.2 * s, 2.2 * s, BIRCHL[1]);
    Q(-0.8 * s, t + 1.2 * s, 0.7 * s, 2 * s, 2 * s, 2 * s, BIRCHL[2]); Q(0, t + 3 * s, 0, 1.4 * s, 1.4 * s, 1.4 * s, BIRCHL[0]);
    obstacles.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, h });
  };
  // Rolling stock along its local x (rot turns it onto the track): a rust-brown boxcar with ribbed sides and sliding doors, a
  // grey tank wagon on a dark-green frame; both on two bogies.
  const WAGON = [0x7b3626, 0x6e3122, 0x84402c];
  const bogies = (Q) => { for (const u of [-4.6, 4.6]) Q(u, 0.15, 0, 2.6, 0.75, 2.0, 0x2a2a2a); };
  const boxcar = (x, z, rot = 0) => {
    const col = WAGON[Math.floor(rd() * 3)], Q = (lx, ly, lz, w, hh, d, m) => part(x, z, rot, lx, ly, lz, w, hh, d, m);
    bogies(Q); Q(0, 0.85, 0, 13, 0.35, 2.6, 0x2c2c2c); Q(0, 1.2, 0, 13.6, 2.7, 2.9, col);
    Q(0, 3.9, 0, 13.6, 0.25, 3.0, shade(col, 0.82)); Q(0, 4.15, 0, 13.2, 0.18, 2.4, shade(col, 0.82));
    for (const s of [-1, 1]) { Q(0, 1.4, s * 1.47, 3.0, 2.3, 0.06, shade(col, 0.88)); for (const u of [-5, -2.5, 2.5, 5]) Q(u, 1.25, s * 1.47, 0.12, 2.6, 0.05, shade(col, 0.72)); }
    footprint(13.6, 2.9, x, z, rot, 4.3);
  };
  const tankWagon = (x, z, rot = 0) => {
    const Q = (lx, ly, lz, w, hh, d, m) => part(x, z, rot, lx, ly, lz, w, hh, d, m);
    bogies(Q); Q(0, 0.85, 0, 12, 0.4, 2.5, 0x2f4a36);
    props.push({ geo: 'cyl:1.35,1.35,11,12', color: 0xb9b8b0, x, y: 2.65, z, rot: [0, rot, Math.PI / 2], cast: true, ax: x, az: z });   // turned onto its side, then along the track
    props.push({ geo: 'cyl:0.6,0.6,0.6,10', color: 0xa3a29a, x, y: 4.2, z, rot: [0, 0, 0], cast: true, ax: x, az: z });                 // the dome
    for (const u of [-3.5, 0, 3.5]) Q(u, 1.25, 0, 0.2, 1.5, 2.9, 0x2f4a36);                                                            // the straps' saddles
    footprint(12, 2.8, x, z, rot, 4.0);
  };
  // a platform beside a track along local x: a concrete slab with a yellow edge on the -z side, lamp posts, a small shelter
  const platform = (x, z, len, rot = 0) => {
    const Q = (lx, ly, lz, w, hh, d, m) => part(x, z, rot, lx, ly, lz, w, hh, d, m);
    Q(0, 0, 0, len, 0.95, 3.4, 0xa9a59c); Q(0, 0.95, -1.5, len, 0.03, 0.3, 0xd8c24a);
    for (let u = -len / 2 + 6; u <= len / 2 - 6; u += 18) { Q(u, 0.95, 1.0, 0.16, 4.2, 0.16, 0x5c5f62); Q(u, 5.1, 0.7, 0.3, 0.18, 0.8, 0x5c5f62); }
    Q(0, 0.95, 1.1, 0.14, 2.5, 0.14, 0x5c5f62); Q(4, 0.95, 1.1, 0.14, 2.5, 0.14, 0x5c5f62); Q(2, 3.45, 0.9, 5, 0.15, 1.6, 0x6a6e70); Q(2, 0.95, 1.6, 4.4, 1.6, 0.08, 0x8fa0a8);
    footprint(len, 3.4, x, z, rot, 0.95);
  };
  // a power-station chimney in red and white bands, tapering, a dark cap
  const chimney = (x, z, h = 120, r0 = 4.2) => {
    const n = 9, bh = h / n;
    for (let i = 0; i < n; i++) { const rb = r0 * (1 - 0.25 * i / n), rt = r0 * (1 - 0.25 * (i + 1) / n); props.push({ geo: `cyl:${rt.toFixed(2)},${rb.toFixed(2)},${bh.toFixed(2)},12`, color: i % 2 ? 0xe8e4dc : 0xb5432f, x, y: (i + 0.5) * bh, z, rot: [0, 0, 0], cast: true, ax: x, az: z }); }
    props.push({ geo: `cyl:${(r0 * 0.8).toFixed(2)},${(r0 * 0.8).toFixed(2)},1.2,12`, color: 0x3a3a3a, x, y: h + 0.6, z, rot: [0, 0, 0], cast: true, ax: x, az: z });
    obstacles.push({ minX: x - r0, maxX: x + r0, minZ: z - r0, maxZ: z + r0, h });
  };
  // ---- Narva's landmarks, after the user's voxel references (2026-10-28): Hermann Castle, Ivangorod Fortress, a Kreenholm mill.
  // Roofs are stepped like the voxel references (stacked boxes or cylinders), so nothing but the mill's gable needs a tilt.
  const LIME = [0xb2ab9e, 0xa79f92, 0xbbb5a9], GREYST = [0x969087, 0x8a847a, 0xa19b91], MOSS = 0x7f7c62, ROOFT = [0xc4572f, 0xb04b28], TIMBERB = 0x6e4a2e;
  const frameOf = (ox, oz, rot) => { const c = Math.cos(rot), s = Math.sin(rot); return (lx, lz) => [ox + lx * c + lz * s, oz - lx * s + lz * c]; };   // a building's local (lx, lz) in the world, as part() places
  // A stone wall from (lx0, lz0) to (lx1, lz1) in a building's frame, t thick and h high, merlons along its top and a few
  // weathered patches on its faces; it blocks movement and sight.
  const stoneWall = (ox, oz, rot, lx0, lz0, lx1, lz1, h, cols = LIME, t = 2.4, merlons = true) => {
    const len = Math.hypot(lx1 - lx0, lz1 - lz0), r2 = rot + Math.atan2(lx1 - lx0, lz1 - lz0), [cx, cz] = frameOf(ox, oz, rot)((lx0 + lx1) / 2, (lz0 + lz1) / 2);
    const Q = (lx, ly, lz, w, hh, d, m) => part(cx, cz, r2, lx, ly, lz, w, hh, d, m, ox, oz);
    Q(0, 0, 0, t, h, len, cols[0]); footprint(t, len, cx, cz, r2, h);
    if (merlons) for (let u = -len / 2 + 1; u <= len / 2 - 0.5; u += 2.2) Q(0, h, u, t, 1.2, 1.1, cols[1]);
    for (let k = 0; k < Math.round(len / 9); k++) { const u = (rd() - 0.5) * (len - 6), y = 1 + rd() * (h - 4), side = rd() < 0.5 ? -1 : 1; Q(side * (t / 2 + 0.03), y, u, 0.06, 1.5 + rd() * 2.5, 2 + rd() * 4, rd() < 0.4 ? MOSS : cols[2]); }
  };
  const stepRoof = (Q, lx, ly, lz, w, d, h, steps, cols) => { for (let k = 0; k < steps; k++) { const f = 1 - k / steps; Q(lx, ly + k * h / steps, lz, +(w * f).toFixed(2), +(h / steps).toFixed(2), +(d * f).toFixed(2), cols[k % cols.length]); } };   // a pyramid in voxel steps
  const flag = (Q, lx, ly, lz, col = 0xb5432f) => { Q(lx, ly, lz, 0.14, 3, 0.14, 0x4a4a4a); Q(lx + 0.6, ly + 2.2, lz, 1.1, 0.7, 0.06, col); };
  // Hermann Castle: a square of limestone curtain walls round a grass court, red gallery roofs stepped down inside the walls,
  // a gate in the +x wall, a square corner turret at (+x, -z) under a red stepped roof, and the white Tall Hermann at the
  // (-x, +z) corner (stone quoins, small windows, a clock, a timber gallery, a steep stepped roof with a dormer and a vane)
  // rising out of a lower walled forecourt.
  const hermannCastle = (ox, oz, rot = 0) => {
    const S = 44, hs = S / 2, H = 13, Q = (lx, ly, lz, w, hh, d, m) => part(ox, oz, rot, lx, ly, lz, w, hh, d, m), W = frameOf(ox, oz, rot);
    stoneWall(ox, oz, rot, -hs, -hs, hs, -hs, H); stoneWall(ox, oz, rot, -hs, hs, hs, hs, H); stoneWall(ox, oz, rot, -hs, -hs, -hs, hs, H);
    stoneWall(ox, oz, rot, hs, -hs, hs, -5, H); stoneWall(ox, oz, rot, hs, 5, hs, hs, H);
    Q(hs, 5.5, 0, 2.4, H - 5.5, 10.2, LIME[1]); Q(hs + 1.25, 0, 0, 0.1, 5.5, 4, 0x3a3226);                                        // over the gate, its dark arch
    for (const [ax, s] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) for (const [off, y, wd, col] of [[2.5, H - 1.2, 2.6, ROOFT[0]], [4.8, H - 2.2, 2.4, ROOFT[1]]]) {   // gallery roofs in two steps
      const len = S - 2 * off - 1; ax === 'x' ? Q(0, y, s * (hs - off), len, 0.45, wd, col) : Q(s * (hs - off), y, 0, wd, 0.45, len, col);
    }
    for (const [ax, s] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) { const len = S - 13; ax === 'x' ? Q(0, H - 6.5, s * (hs - 6.0), len, 4.3, 0.3, TIMBERB) : Q(s * (hs - 6.0), H - 6.5, 0, 0.3, 4.3, len, TIMBERB); }   // the galleries' timber fronts
    { const tx = hs - 2, tz = -hs + 2; Q(tx, 0, tz, 7, 19, 7, LIME[0]); stepRoof(Q, tx, 19, tz, 8, 8, 6, 6, ROOFT); flag(Q, tx, 25, tz); const [wx, wz] = W(tx, tz); footprint(7, 7, wx, wz, rot, 19); }   // the corner turret
    // the forecourt: lower crenellated walls round the tower's outer corner
    stoneWall(ox, oz, rot, -hs - 12, hs - 16, -hs - 12, hs + 10, 7); stoneWall(ox, oz, rot, -hs - 12, hs + 10, -hs + 14, hs + 10, 7); stoneWall(ox, oz, rot, -hs + 14, hs + 10, -hs + 14, hs, 7);
    // Tall Hermann
    const tx = -hs + 4, tz = hs - 4, T = 11, TH = 44;
    Q(tx, 0, tz, T, TH, T, 0xe6e2d8); { const [wx, wz] = W(tx, tz); footprint(T, T, wx, wz, rot, TH + 12); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let y = 0.4, k = 0; y < TH - 1; y += 2.4, k++) Q(tx + sx * (T / 2 - 0.45), y, tz + sz * (T / 2 - 0.45), k % 2 ? 1.3 : 1.0, 1.0, k % 2 ? 1.0 : 1.3, 0x9b958a);   // quoins
    for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const y of [9, 19, 29]) Q(tx + fx * (T / 2 + 0.03), y, tz + fz * (T / 2 + 0.03), fx ? 0.08 : 1.0, 1.3, fz ? 0.08 : 1.0, 0x35302a);   // small windows
    Q(tx + T / 2 + 0.05, 37.5, tz, 0.12, 2.8, 2.8, 0x7a4f2c); Q(tx + T / 2 + 0.12, 37.8, tz, 0.08, 2.2, 2.2, 0xf1ece0); Q(tx + T / 2 + 0.18, 38.9, tz, 0.05, 1.0, 0.18, 0x2a2a2a); Q(tx + T / 2 + 0.18, 38.8, tz + 0.35, 0.05, 0.18, 0.8, 0x2a2a2a);   // the clock, facing the town
    Q(tx, TH, tz, T + 1.6, 2.6, T + 1.6, TIMBERB); for (let u = -6; u <= 6; u += 1.5) { Q(tx + u, TH + 0.3, tz + (T + 1.6) / 2 + 0.02, 0.12, 2, 0.06, 0x4f3420); Q(tx + (T + 1.6) / 2 + 0.02, TH + 0.3, tz + u, 0.06, 2, 0.12, 0x4f3420); }   // the timber gallery
    stepRoof(Q, tx, TH + 2.6, tz, T + 2.4, T + 2.4, 12, 9, ROOFT);
    Q(tx - 2.2, TH + 4.6, tz, 2.4, 2.2, 2.0, 0xe6e2d8); Q(tx - 2.2, TH + 6.8, tz, 2.8, 0.5, 2.4, ROOFT[1]); Q(tx - 2.2, TH + 5.2, tz - 1.03, 0.9, 1.0, 0.06, 0x35302a);   // a dormer
    flag(Q, tx, TH + 14.6, tz, 0x5a5a5a);
    for (const [bx, bz] of [[-6, -4], [4, 6], [-2, 8]]) Q(bx, 0, bz, 1.2, 1.0, 1.2, 0x8a6a46);   // crates in the court
  };
  // Ivangorod Fortress: grey crenellated walls (w along x, d along z) with round towers at the corners and halfway along the
  // long sides, each under a conical roof stepped in brown or red courses, a gate in the -x wall.
  const CONES = [[0x6e4a33, 0x5e3f2b], [0xb4552f, 0xa04a29], [0x9c7468, 0x8a655a], [0x7a5238, 0x684631]];
  const fortress = (ox, oz, w, d, rot = 0) => {
    const H = 12, hw = w / 2, hd = d / 2, W = frameOf(ox, oz, rot), cyl = (lx, lz, y, r1, r2, h, col) => { const [x, z] = W(lx, lz); props.push({ geo: `cyl:${r1.toFixed(2)},${r2.toFixed(2)},${h.toFixed(2)},14`, color: col, x, y, z, rot: [0, 0, 0], cast: true, ax: ox, az: oz }); };
    stoneWall(ox, oz, rot, -hw, -hd, hw, -hd, H, GREYST, 3); stoneWall(ox, oz, rot, -hw, hd, hw, hd, H, GREYST, 3); stoneWall(ox, oz, rot, hw, -hd, hw, hd, H, GREYST, 3);
    stoneWall(ox, oz, rot, -hw, -hd, -hw, -6, H, GREYST, 3); stoneWall(ox, oz, rot, -hw, 6, -hw, hd, H, GREYST, 3);
    part(ox, oz, rot, -hw, 5.5, 0, 3, H - 5.5, 12.2, GREYST[1]); part(ox, oz, rot, -hw - 1.55, 0, 0, 0.1, 5.5, 4.5, 0x2e2a24);   // over the gate, its arch
    const towers = [[-hw, -hd, 7.5], [hw, -hd, 7.5], [-hw, hd, 7.5], [hw, hd, 7.5], [hw, 0, 6.5], [-hw, hd / 2, 6]];
    towers.forEach(([lx, lz, r], i) => {
      const th = r > 7 ? 18 : 15, cone = CONES[i % CONES.length];
      cyl(lx, lz, th / 2, r, r, th, GREYST[i % 3]); cyl(lx, lz, th + 0.4, r + 0.5, r + 0.5, 0.8, GREYST[1]);   // the drum and a corbelled ring
      for (let k = 0; k < 6; k++) { const r1 = (r + 0.8) * (1 - (k + 1) / 6.4), r0 = (r + 0.8) * (1 - k / 6.4), h = (r * 1.2) / 6; cyl(lx, lz, th + 0.8 + (k + 0.5) * h, Math.max(0.3, r1), r0, h, cone[k % 2]); }
      const [x, z] = W(lx, lz); obstacles.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, h: th });
    });
  };
  // A Kreenholm mill along its local x: red brick, `floors` of 3.6 m with white-framed windows between brick piers, a white
  // transom across each floor's panes, a cornice, stair towers at both ends, a pediment and door at the middle of the -z face,
  // and a slate gable roof. Its long axis runs along x or z (the roof's tilt), as rot 0, pi or +-pi/2 give.
  const BRICKM = [0xa04a35, 0x93432f];
  const millBuilding = (x, z, len, floors = 6, rot = 0, depth = 20) => {
    const col = BRICKM[Math.floor(rd() * 2)], fh = 3.6, h = floors * fh + 1, Q = (lx, ly, lz, w, hh, d, m) => part(x, z, rot, lx, ly, lz, w, hh, d, m);
    Q(0, 0, 0, len, h, depth, col); footprint(len + 8, depth, x, z, rot, h + 6);
    const face = (ax, s, half, flen) => {
      const F = (u, ly, out, w, hh, t, m) => (ax === 'x' ? Q(u, ly, s * (half + out), w, hh, t, m) : Q(s * (half + out), ly, u, t, hh, w, m));
      const bays = Math.max(1, Math.round(flen / 3.4)), bw = flen / bays;
      for (let f = 0; f < floors; f++) { const y = f * fh + 1.0; F(0, y, 0.02, flen - 0.6, 2.2, 0.05, 0xe8e2d4); F(0, y + 0.18, 0.05, flen - 0.6, 1.84, 0.05, 0x2f343a); F(0, y + 1.15, 0.08, flen - 0.6, 0.14, 0.04, 0xe8e2d4); }
      for (let i = 0; i <= bays; i++) F(-flen / 2 + i * bw, 0, 0.1, 1.5, h, 0.1, col);
    };
    for (const s of [-1, 1]) { face('x', s, depth / 2, len); face('z', s, len / 2, depth); }
    Q(0, h - 0.6, 0, len + 0.6, 0.6, depth + 0.6, 0x7e3a2a);                                                                           // cornice
    for (const s of [-1, 1]) { Q(s * (len / 2 + 2), 0, 0, 4, h + 4, depth * 0.55, col); Q(s * (len / 2 + 2), h + 4, 0, 4.4, 0.6, depth * 0.55 + 0.4, 0x7e3a2a); for (let f = 0; f < floors; f++) Q(s * (len / 2 + 4.03), f * fh + 1.4, 0, 0.06, 1.6, 1.2, 0x2f343a); }   // stair towers
    for (let k = 0; k < 3; k++) Q(0, h + k * 1.3, -depth / 2 + 0.6, 14 - k * 4.5, 1.3, 1.2, col);                                      // pediment, stepped
    Q(0, h + 1.3, -depth / 2 - 0.02, 1.4, 1.4, 0.06, 0xe8e2d4);                                                                      // its round window
    Q(0, 0, -depth / 2 - 0.08, 2.6, 3.4, 0.12, 0x5a3a26); Q(0, 3.4, -depth / 2 - 0.1, 3.4, 0.4, 0.16, 0xe8e2d4);                        // door, lintel
    // the gable roof: two slopes tilted about the long axis
    const [wx, wz] = [x, z], alongX = Math.abs(Math.cos(rot)) > 0.5, th = 0.38, run = depth / 2 + 0.5, rise = run * Math.tan(th), sw = run / Math.cos(th);
    for (const s of [-1, 1]) { const [px, pz] = frameOf(x, z, rot)(0, s * run / 2); props.push({ geo: 'box:1,1,1', color: s > 0 ? 0x5d6266 : 0x6a6f73, scale: alongX ? [len + 0.8, 0.5, sw] : [sw, 0.5, len + 0.8], x: px, y: h + rise / 2, z: pz, rot: alongX ? [s * th * Math.sign(Math.cos(rot)), 0, 0] : [0, 0, -s * th * Math.sign(Math.sin(rot))], cast: true, ax: wx, az: wz }); }
  };
  // the mill race: a stone quay wall along local x with arched sluices, white water foaming out of each onto the river at +z
  // At absolute heights, from the river bed up to `top` (the island's level), so the foam lies on the water (at `water`)
  // however high the bank is where the wall stands.
  const millRace = (x, z, len, rot = 0, top = 1.0, water = -3, n = 5) => {
    const W = frameOf(x, z, rot), A = (lx, y0, lz, w, h, d, color) => { const [px, pz] = W(lx, lz); props.push({ geo: 'box:1,1,1', color, scale: [w, h, d], x: px, y: y0 + h / 2, z: pz, rot: [0, rot, 0], cast: h > 0.3, absY: true }); };
    A(0, water - 3, 0, len, top - water + 3, 2.4, 0x9a958c); A(0, top, 0, len, 0.3, 2.8, 0xb0aba1);
    for (let i = 0; i < n; i++) { const u = -len / 2 + (i + 0.5) * len / n; A(u, water - 0.2, 1.22, 3, 2.9, 0.1, 0x262a2c); A(u, water + 0.02, 2.4, 3.2, 0.1, 2.6, 0xeef4f6); A(u + 0.6, water + 0.02, 4.2, 2.2, 0.1, 1.6, 0xdde9ee); A(u - 0.5, water + 0.02, 5.6, 1.4, 0.08, 1.2, 0xeef4f6); }
    const [cx, cz] = W(0, 0); footprint(len, 2.4, cx, cz, rot, top + 0.3);
  };
  return { props, obstacles, lamps, tufts, decals, bridge, box, hermannCastle, fortress, millBuilding, millRace, panelBlock, panelTower, garages, pine, birch, boxcar, tankWagon, platform, chimney, footprint, part, BAG, bagStack, BLOCK, blockWall, palm, bush, rock, PLASTER, house, controlTower, wallRun, MESH, hesco, shade, container, cyl, tilt, CONC, stains, watchtower, hangar, barracks, fuelTank, floodlight, radioMast, equipmentHut, FRUIT, stall, STONE, well, sandbagRing, containers, scrub, TRIM, WOOD, DOOR, DARK, STAIN, TIN, TIMBER, STEEL, DARKM };
}
