import { rand } from '../../core/layout.js';

// "Desert Crossing": 1 km map. Bases in the SW and NE corners; five locations in
// Advance-and-Secure order between them; an asphalt road joins the chain.
export const desert1km = {
  name: 'Desert Crossing', size: 1000,
  ground: { base: 'sand', baseSize: 4, tiles: ['concrete', 'asphalt', 'grass', 'dirt'], tileSize: [16, 4, 4, 4] },
  bases: [{ team: 0, x: -400, z: -400, r: 42 }, { team: 1, x: 430, z: 430, r: 42 }],
  locations: [
    { name: 'Outpost', x: -300, z: -290, r: 22 },
    { name: 'Airfield', x: -120, z: -150, r: 34 },
    { name: 'Village', x: 40, z: 10, r: 30 },
    { name: 'Depot', x: 210, z: 190, r: 24 },
    { name: 'Relay', x: 310, z: 300, r: 20 },
  ],
  roadPath: [[-400, -400], [-340, -345], [-300, -290], [-250, -250], [-205, -216], [-160, -190], [-110, -180], [-20, -80], [40, -15], [130, 110], [210, 190], [330, 330], [430, 430]],
  tracks: [[[40, 10], [150, -50], [250, -20], [320, 150], [310, 300]], [[-300, -290], [-380, -250], [-450, -310]], [[-120, -150], [20, -240], [200, -170]], [[150, 136], [120, 220], [60, 330]]],
  // Ridges with cut passes and a river with one bridge and one ford form the choke points.
  terrain: {
    water: -3,
    features: [
      { type: 'ridge', x1: -297, z1: -96, x2: -113, z2: -334, w: 38, h: 32, p: 0.6, jag: 0.5, cuts: [{ x: -205, z: -216, r: 34 }] },   // Outpost - Airfield barrier
      { type: 'ridge', x1: -170, z1: 160, x2: 10, z2: -170, w: 36, h: 30, p: 0.6, jag: 0.5, cuts: [{ x: -32, z: -100, r: 34 }] },      // Airfield - Village barrier
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
    river: { path: [[-150, 500], [-20, 300], [80, 170], [170, 60], [290, -60], [420, -200], [500, -260]], w: 24, depth: 7 },
    fords: [{ x: 250, z: -20, r: 24, bed: -2.2 }],
  },
  bridges: [{ x: 130, z: 109, len: 64, w: 14, angle: 0.78, y: 1.3 }],
  flats: [
    { x: -400, z: -400, r: 48, m: 25 }, { x: 430, z: 430, r: 48, m: 25 },
    { x: -300, z: -290, r: 30, m: 20 }, { x: -120, z: -150, r: 84, m: 18 }, { x: 40, z: 10, r: 72, m: 22 },
    { x: 210, z: 190, r: 44, m: 20 }, { x: 310, z: 300, r: 28, m: 18 }, { x: 150, z: -220, r: 40, m: 18 },
  ],

  build() {
    const props = [], obstacles = [], lamps = [], tufts = [], decals = [], strips = [];
    const r = rand(2024);
    const box = (w, h, d, color, x, z, { y = 0, rot = 0, obstacle = true, cast = true, tex } = {}) => {
      props.push({ geo: `box:${w},${h},${d}`, color, tex, x, y: y + h / 2, z, rot: [0, rot, 0], cast });
      if (obstacle) {
        const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot)), hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
        obstacles.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, h: y + h });
      }
    };
    const palm = (x, z, tilt = (r() - 0.5) * 0.12) => {
      props.push({ geo: 'cyl:0.2,0.32,9,6', tex: 'trunk', x, y: 4.5, z, rot: [tilt, 0, tilt * 0.6], cast: true });
      const tx = x + Math.sin(tilt * 0.6) * 4.5, tz = z + Math.sin(tilt) * 4.5;
      props.push({ geo: 'cyl:0.55,0.4,0.7,6', tex: 'trunk', x: tx, y: 9.1, z: tz, rot: [0, 0, 0], cast: true });
      for (let k = 0; k < 8; k++) props.push({ geo: 'frond:0.6,0.08,3.6,' + (0.35 + (k % 3) * 0.15).toFixed(2), tex: 'frond', x: tx, y: 9.3, z: tz, rot: [0, k * Math.PI / 4 + (k % 2) * 0.2, 0], cast: true });
      obstacles.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5, h: 9 });
    };
    const bush = (x, z, s = 0.8 + r() * 0.5) => {
      for (const [ox, oz, rr, h] of [[0, 0, 1.3, 1.6], [0.9, 0.5, 0.9, 1.2], [-0.8, 0.6, 1.0, 1.1]])
        props.push({ geo: 'cyl:' + (rr * s).toFixed(2) + ',' + (rr * s * 1.15).toFixed(2) + ',' + (h * s).toFixed(2) + ',7', tex: 'bush', x: x + ox * s, y: h * s / 2, z: z + oz * s, rot: [0, 0, 0], cast: true });
      obstacles.push({ minX: x - 1.5 * s, maxX: x + 1.5 * s, minZ: z - 1.5 * s, maxZ: z + 1.5 * s, h: 1.6 * s });
    };
    const rock = (x, z) => { const s = 0.8 + r() * 2.2; box(s, s * 0.6, s * 0.8, [0x8c857a, 0x7a7368, 0x9a9388][Math.floor(r() * 3)], x, z, { rot: r() * Math.PI }); };
    const house = (x, z, w = 7, d = 7, floors = 1, rot = 0) => {
      const h = 3.6 * floors, col = [0xc9b48f, 0xbfa982, 0xd2bf9a][Math.floor(r() * 3)];
      box(w, h, d, col, x, z, { rot });
      box(w + 0.6, 0.4, d + 0.6, 0x8c7a5c, x, z, { y: h, rot, obstacle: false });
      box(1.4, 2.2, 0.2, 0x4a3a2a, x + Math.cos(rot) * 0, z + d / 2 + 0.05, { rot, obstacle: false });   // door
    };
    const wallRun = (x0, z0, x1, z1, h = 2.2) => {
      const len = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(x1 - x0, z1 - z0);
      box(0.5, h, len, 0xcbb58e, (x0 + x1) / 2, (z0 + z1) / 2, { rot });
    };
    const sandbagRing = (cx, cz, rad, gap = 0.9) => {
      const n = Math.round(rad * 2); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; if (Math.abs(a - gap) < 0.35) continue; box(3, 1.1, 1, 0x9c8b64, cx + Math.cos(a) * rad, cz + Math.sin(a) * rad, { rot: -a }); }
    };
    const floodlight = (x, z) => {
      box(0.6, 12, 0.6, 0x3a3a3a, x, z);
      props.push({ geo: 'box:2.2,0.8,1.2', color: 0x222222, emissive: 0xfff2c0, x, y: 12.2, z, rot: [0, 0, 0], cast: true, lampHead: true });
      lamps.push({ x, y: 11, z, color: 0xffe7b0, distance: 55 });
    };
    const containers = (x0, z0, cols, rows) => {
      const colsC = [0x6f4a3a, 0x44584a, 0x4f5a6b, 0x8a7a3a, 0x5a4a5a];
      for (let i = 0; i < cols * rows; i++) { const x = x0 + (i % cols) * 7, z = z0 + Math.floor(i / cols) * 4; box(6, 2.6, 2.5, colsC[i % 5], x, z, { rot: (r() - 0.5) * 0.15 }); if (r() < 0.4) box(6, 2.6, 2.5, colsC[(i + 2) % 5], x, z, { y: 2.6, obstacle: false }); }
    };
    const scrub = (cx, cz, rad, n) => { for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad; tufts.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, yaw: r() * Math.PI, size: [0.7, 0.9, 1.15][Math.floor(r() * 3)] }); } };

    // ---- main bases: sandbag perimeter, containers, floodlights, a tower
    for (const b of this.bases) {
      sandbagRing(b.x, b.z, 30, Math.atan2(-b.z, -b.x) < 0 ? 0.8 : 3.9);
      containers(b.x - 20, b.z + 14, 3, 2);
      floodlight(b.x - 24, b.z - 18); floodlight(b.x + 24, b.z + 18);
      box(5, 10, 5, 0x9a958b, b.x + 22, b.z - 22); box(7, 2.5, 7, 0x5b6a72, b.x + 22, b.z - 22, { y: 10, obstacle: false });
    }
    // ---- Outpost: hesco wall ring, watchtower, sandbags
    { const o = this.locations[0]; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (i === 2) continue; box(5, 2.4, 1.6, 0xb5a37c, o.x + Math.cos(a) * 16, o.z + Math.sin(a) * 16, { rot: -a + Math.PI / 2 }); }
      box(3, 8, 3, 0x6f6450, o.x, o.z); box(4.5, 1.8, 4.5, 0x5b6a72, o.x, o.z, { y: 8, obstacle: false }); sandbagRing(o.x + 10, o.z - 8, 5, 2.5); for (let i = 0; i < 6; i++) bush(o.x + (r() - 0.5) * 60, o.z + (r() - 0.5) * 60); }
    // ---- Airfield: apron props (concrete painted in the splat), hangar, tower, containers, tanks, helipads
    { const a = this.locations[1], ax = a.x, az = a.z;
      box(30, 11, 22, 0x8f8a80, ax - 50, az + 40); box(22, 8, 0.4, 0x3b3a38, ax - 50, az + 51, { obstacle: false });
      box(7, 14, 7, 0x9a958b, ax + 60, az - 60); box(9, 3, 9, 0x5b6a72, ax + 60, az - 60, { y: 14, obstacle: false });
      box(18, 5, 8, 0x8c8470, ax - 62, az - 20); box(18, 5, 8, 0x8c8470, ax - 62, az - 8);
      containers(ax + 10, az - 45, 7, 2);
      for (let i = 0; i < 3; i++) { props.push({ geo: 'cyl:2.2,2.2,9,10', color: 0xb0ab9e, x: ax + 55, y: 2.4, z: az + 10 + i * 6, rot: [0, 0, Math.PI / 2], cast: true }); obstacles.push({ minX: ax + 50.5, maxX: ax + 59.5, minZ: az + 7.8 + i * 6, maxZ: az + 12.2 + i * 6, h: 4.6 }); }
      floodlight(ax - 30, az - 60); floodlight(ax + 40, az + 65);
      for (const [hx, hz] of [[40, 40], [57, 40], [40, 57]]) decals.push({ x: ax + hx, z: az + hz, w: 14, d: 14, rot: 0, tex: 'helipad' });
      for (let i = 0; i < 6; i++) decals.push({ x: ax - 66 + i * 9, z: az - 64, w: 7, d: 12, rot: 0, tex: 'bay' });
      strips.push({ points: [[ax - 62, az - 26], [ax + 62, az + 8]], width: 0.6, tex: 'line', vRepeat: 4, y: 0.05 }, { points: [[ax - 62, az + 46], [ax + 62, az - 46]], width: 0.6, tex: 'line', vRepeat: 4, y: 0.05 }, { points: [[ax + 20, az - 62], [ax + 20, az + 62]], width: 0.6, tex: 'line', vRepeat: 4, y: 0.05 });
      strips.push({ points: [[ax - 62, az + 28], [ax + 62, az + 28]], width: 1.2, tex: 'dash', vRepeat: 16, y: 0.05, cutout: true });
    }
    // ---- Village: houses on a grid with lanes, compound walls, palms, market
    { const v = this.locations[2], vx = v.x, vz = v.z;
      const plots = [[-22, -18], [-8, -20], [8, -18], [22, -16], [-24, -2], [-6, 2], [10, -2], [24, 0], [-20, 16], [-4, 18], [12, 16], [26, 18], [-30, 30], [4, 32], [20, 34]];
      plots.forEach(([px, pz], i) => house(vx + px, vz + pz, 6 + (i % 3), 6 + ((i * 2) % 3), i % 4 === 0 ? 2 : 1, (r() - 0.5) * 0.2));
      wallRun(vx - 34, vz - 28, vx - 34, vz + 12); wallRun(vx - 34, vz + 12, vx - 12, vz + 12); wallRun(vx + 32, vz - 26, vx + 36, vz + 26);
      for (const [px, pz] of [[-40, -30], [-38, 22], [34, 40], [40, -36], [0, 44], [-14, 40]]) palm(vx + px, vz + pz);
      for (let i = 0; i < 4; i++) box(3, 2.2, 2, 0x6f6448, vx - 2 + i * 4, vz + 8, { obstacle: false, cast: true });
      props.push({ geo: 'cyl:1.4,1.4,1.2,8', color: 0x9a8f7a, x: vx, y: 0.6, z: vz - 8, rot: [0, 0, 0], cast: true }); obstacles.push({ minX: vx - 1.5, maxX: vx + 1.5, minZ: vz - 9.5, maxZ: vz - 6.5, h: 1.2 });
      for (let i = 0; i < 10; i++) bush(vx + (r() - 0.5) * 110, vz + (r() - 0.5) * 110);
      // mosque with a dome and minaret at the west edge
      { const mx = vx - 48, mz = vz + 2;
        box(12, 5, 10, 0xd8c7a3, mx, mz); box(13, 0.4, 11, 0xc9b48f, mx, mz, { y: 5, obstacle: false });
        props.push({ geo: 'cyl:1.9,3.3,1.7,12', color: 0x7fa6a0, x: mx, y: 6.25, z: mz, rot: [0, 0, 0], cast: true });
        props.push({ geo: 'cyl:0.15,1.9,1.3,12', color: 0x7fa6a0, x: mx, y: 7.75, z: mz, rot: [0, 0, 0], cast: true });
        box(1.6, 2.6, 0.2, 0x4a3a2a, mx, mz + 5.05, { obstacle: false });
        box(2.2, 16, 2.2, 0xe0d2b4, mx + 8, mz - 6); box(3.2, 0.5, 3.2, 0x7fa6a0, mx + 8, mz - 6, { y: 16, obstacle: false });
        props.push({ geo: 'cyl:0.1,1.5,1.5,10', color: 0x7fa6a0, x: mx + 8, y: 17.25, z: mz - 6, rot: [0, 0, 0], cast: true });
        for (let i = 0; i < 4; i++) box(0.3, 0.6, 0.3, 0x4a3a2a, mx + 8 + (i % 2 ? 0.9 : -0.9), mz - 6 + (i < 2 ? 0.9 : -0.9), { y: 15.4, obstacle: false });
      }
      // walled compound east of the village: a courtyard house with a gap on its west side
      { const cx = vx + 54, cz = vz - 2;
        house(cx + 2, cz + 1, 7, 6, 1, 0); wallRun(cx - 8, cz - 8, cx + 8, cz - 8); wallRun(cx + 8, cz - 8, cx + 8, cz + 8); wallRun(cx + 8, cz + 8, cx - 8, cz + 8); wallRun(cx - 8, cz + 8, cx - 8, cz + 2); wallRun(cx - 8, cz - 8, cx - 8, cz - 3);
        for (let i = 0; i < 3; i++) box(1, 1, 1, 0x8a6a3a, cx - 5 + i * 1.2, cz + 5.5, { rot: r() * 0.4 });
        palm(cx - 4, cz - 4);
      }
      // market: cloth awnings over the stalls, poles, crates
      for (let i = 0; i < 4; i++) { const sx = vx - 2 + i * 4, sz = vz + 8, col = [0xb04a3a, 0x3a6ab0, 0xd0b040, 0x6a9a4a][i];
        box(3.6, 0.14, 2.8, col, sx, sz, { y: 2.5, obstacle: false });
        for (const [ox, oz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) box(0.12, 2.5, 0.12, 0x5a4a3a, sx + ox, sz + oz, { obstacle: false });
        if (i % 2) box(1, 0.9, 1, 0x8a6a3a, sx + 1, sz - 2.2, { rot: r() * 0.5 });
      }
      // low garden walls along the south lane (cover, not line-of-sight blockers) and rubble by the west wall
      wallRun(vx - 20, vz + 26, vx + 10, vz + 26, 1.2); wallRun(vx + 14, vz + 26, vx + 30, vz + 26, 1.2);
      for (let i = 0; i < 7; i++) { const s = 0.6 + r() * 0.9; box(s, s * 0.5, s * 0.8, [0xcbb58e, 0xb5a37c, 0x9c8b64][Math.floor(r() * 3)], vx - 37 + r() * 4, vz - 26 + r() * 36, { rot: r() * Math.PI, obstacle: false }); }
      props.push({ geo: 'cyl:1.4,1.4,1.2,8', color: 0x9a8f7a, x: vx + 50, y: 0.6, z: vz - 22, rot: [0, 0, 0], cast: true }); obstacles.push({ minX: vx + 48.5, maxX: vx + 51.5, minZ: vz - 23.5, maxZ: vz - 20.5, h: 1.2 });
      scrub(vx, vz, 55, 120);
    }
    // ---- Depot: fuel tanks, fence posts, containers on an asphalt pad
    { const d = this.locations[3], dx = d.x, dz = d.z;
      for (let i = 0; i < 6; i++) { const x = dx - 15 + (i % 3) * 7, z = dz - 8 + Math.floor(i / 3) * 10; props.push({ geo: 'cyl:2.2,2.2,9,10', color: 0xb0ab9e, x, y: 2.4, z, rot: [0, 0, Math.PI / 2], cast: true }); obstacles.push({ minX: x - 4.5, maxX: x + 4.5, minZ: z - 2.2, maxZ: z + 2.2, h: 4.6 }); }
      containers(dx + 10, dz - 12, 3, 3);
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; box(0.3, 2.4, 0.3, 0x5a5a5a, dx + Math.cos(a) * 30, dz + Math.sin(a) * 30, { obstacle: false }); }
      floodlight(dx - 26, dz + 20);
    }
    // ---- Relay: mast, hut, sandbags
    { const l = this.locations[4]; box(1.2, 24, 1.2, 0x8a8a8a, l.x, l.z); box(3, 0.3, 3, 0x6a6a6a, l.x, l.z, { y: 24, obstacle: false }); box(6, 3.2, 5, 0xa39a86, l.x + 8, l.z - 4); sandbagRing(l.x, l.z, 9, 4.0); for (let i = 0; i < 5; i++) rock(l.x + (r() - 0.5) * 50, l.z + (r() - 0.5) * 50); }
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
    const roadFree = (o) => { const cx = (o.minX + o.maxX) / 2, cz = (o.minZ + o.maxZ) / 2; for (let i = 0; i < this.roadPath.length - 1; i++) { const [ax, az] = this.roadPath[i], [bx, bz] = this.roadPath[i + 1]; const t = Math.max(0, Math.min(1, ((cx - ax) * (bx - ax) + (cz - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); if (Math.hypot(cx - (ax + (bx - ax) * t), cz - (az + (bz - az) * t)) < 9) return false; } return true; };
    const keep = new Set(obstacles.filter(roadFree));
    return { props, obstacles: [...keep], lamps, tufts: tufts.filter(t => !clear(t.x, t.z)), decals, strips, oasis };
  },

  // paints the splat map: r concrete, g asphalt, b grass, a dirt (sand elsewhere)
  paintSplat(g, px, half) {
    const ppm = px / (half * 2), X = (x) => (x + half) * ppm, Z = (z) => (half - z) * ppm;
    g.clearRect(0, 0, px, px);
    const disc = (x, z, rad, style) => { g.fillStyle = style; g.beginPath(); g.arc(X(x), Z(z), rad * ppm, 0, Math.PI * 2); g.fill(); };
    const a = this.locations[1]; g.fillStyle = 'rgb(255,0,0)'; g.fillRect(X(a.x - 64), Z(a.z + 64), 128 * ppm, 128 * ppm);           // airfield apron
    const d = this.locations[3]; g.fillStyle = 'rgb(0,255,0)'; g.fillRect(X(d.x - 34), Z(d.z + 34), 68 * ppm, 68 * ppm);             // depot pad
    for (const b of this.bases) disc(b.x, b.z, 36, 'rgba(0,0,0,0.85)');                                                              // dirt bases
    const v = this.locations[2]; disc(v.x, v.z, 60, 'rgba(0,0,0,0.9)'); for (const [ox, oz] of [[-40, -30], [-38, 22], [34, 40], [40, -36]]) disc(v.x + ox, v.z + oz, 9, 'rgba(0,0,255,0.9)');
    disc(150, -220, 34, 'rgba(0,0,255,0.95)'); disc(150, -220, 48, 'rgba(0,0,0,0.5)');                                               // oasis
    // riverside greenery and a sandy ford
    const rv = this.terrain.river.path; g.strokeStyle = 'rgba(0,0,255,0.75)'; g.lineWidth = 56 * ppm; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(X(rv[0][0]), Z(rv[0][1])); for (const p of rv.slice(1)) g.lineTo(X(p[0]), Z(p[1])); g.stroke();
    for (const f of this.terrain.fords) { g.fillStyle = 'rgb(0,0,0)'; g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(X(f.x), Z(f.z), f.r * 1.3 * ppm, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; }
    for (const t of this.tracks) { g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 9 * ppm; g.lineCap = 'round'; g.beginPath(); g.moveTo(X(t[0][0]), Z(t[0][1])); for (const p of t.slice(1)) g.lineTo(X(p[0]), Z(p[1])); g.stroke(); }
  },
};
