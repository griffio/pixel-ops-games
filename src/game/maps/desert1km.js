import { rand } from '../../core/layout.js';
import { smooth } from '../../core/math.js';
import { makeKit } from './kit.js';

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
    const strips = [];
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
    const { props, obstacles, lamps, tufts, decals, bridge, box, footprint, part, BAG, bagStack, BLOCK, blockWall, palm, bush, rock, PLASTER, house, controlTower, wallRun, MESH, hesco, shade, container, cyl, tilt, CONC, stains, watchtower, hangar, barracks, fuelTank, floodlight, radioMast, equipmentHut, FRUIT, stall, STONE, well, sandbagRing, containers, scrub, TRIM, WOOD, DOOR, DARK, STAIN, TIN, TIMBER, STEEL, DARKM } = makeKit({ r, rd: rand(4242), onRoad });

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
    // ---- bridges (absolute heights; the deck is walkable via WorldState.heightAt): kit.js bridge(), railings inset 0.3 m
    for (const b of this.bridges) bridge(b, 0.3);
    // ---- roads

    strips.push({ points: this.roadPath, width: 12, tex: 'road', vRepeat: 12, smooth: 2, y: 0.03, cutout: true });   // cutouts: sand-drifted ragged edges
    for (const t of this.tracks) strips.push({ points: t, width: 5, tex: 'track', vRepeat: 5, smooth: 2, y: 0.02, cutout: true });
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
