import { rand } from '../../core/layout.js';
import { smooth } from '../../core/math.js';
import { makeKit } from './kit.js';

// "Palm Valley": 2 km map, mirror-symmetric about the river (z = 0): the south half is laid out and the north half is its
// mirror image (terrain via mirrorZ, everything else copied here), so both sides get the same ground and the same distances.
// BLUFOR's base is in the south, OPFOR's in the north. Three lanes cross the valley: the town lane in the west (Kasbah,
// Souk) over a footbridge only infantry can use, the road lane in the middle (Depot, Bridge, Pumps) over the one bridge
// that takes vehicles, the open lane in the east (Quarry, Mine) through a ford. Bluffs at 230 m either side of the river
// have a pass in each lane. Each side can take its own row from the start; a place is capturable from a held neighbour.
const S = (pts) => pts.map(([x, z]) => [x, -z]);                 // the mirror image of a south-half path
const across = (pts) => [...pts, ...S(pts).reverse().slice(1)];   // a south-half path ending on the river, carried on north
const both = (list) => [...list, ...list.map(r => ({ ...r, points: S(r.points) }))];

const LANE = 560, BLUFF = 230, BASE = 820;
// sandbag positions round each south place, covering its approaches (the street mouths, the roads and tracks in); the
// north places get their mirror images. The CPU digs in at the ones facing the enemy (strategist.digSpot)
const DEFEND = {
  Kasbah: [[-546, -364], [-576, -364], [-506, -404], [-516, -462], [-628, -408], [-560, -476]],
  Depot: [[18, -404], [-18, -404], [-44, -436], [44, -436], [22, -478], [-22, -478]],
  Quarry: [[546, -378], [576, -378], [516, -412], [604, -440], [548, -462]],
};
// river width (the carve's half-width: open water is about 1.5 times it) at points along the river: narrow at the
// footbridge (x -560) and the bridge (0), wide where the ford is (560)
const RIVER_X = [-1000, -800, -640, -560, -480, -300, -120, 0, 120, 300, 480, 560, 640, 800, 1000];
const RIVER_W = [28, 30, 24, 16, 22, 24, 22, 18, 22, 24, 26, 30, 26, 30, 28];
const riverW = (x) => { for (let i = 0; i < RIVER_X.length - 1; i++) if (x <= RIVER_X[i + 1]) { const t = (x - RIVER_X[i]) / (RIVER_X[i + 1] - RIVER_X[i]); return RIVER_W[i] + (RIVER_W[i + 1] - RIVER_W[i]) * t; } return RIVER_W[RIVER_W.length - 1]; };

export const valley2km = {
  name: 'Palm Valley', size: 2000,
  blurb: 'A river valley, the same from both sides: three lanes through bluff passes to a bridge, a ford and a footbridge.',
  nav: { foot: 1.5, vehicle: 2.5, cap: 200000 },   // a 2 km grid at 1 m would be 4 M cells (130 MB); long searches round the big hills need a bigger cap
  splatRes: 1024,
  ground: { base: 'sand', baseSize: 12.8, tiles: ['concrete', 'asphalt', 'grass', 'dirt'], tileSize: [16, 4, 12.8, 12.8] },
  bases: [{ team: 0, x: 0, z: -BASE, r: 42 }, { team: 1, x: 0, z: BASE, r: 42 }],
  // list order runs from BLUFOR's side to OPFOR's, each row from the west, so each side's first pick is its town
  locations: [
    { name: 'Kasbah', x: -LANE, z: -420, r: 32, home: 0, defend: DEFEND.Kasbah },
    { name: 'Depot', x: 0, z: -440, r: 26, home: 0, defend: DEFEND.Depot },
    { name: 'Quarry', x: LANE, z: -420, r: 30, home: 0, defend: DEFEND.Quarry },
    { name: 'Bridge', x: 0, z: 0, r: 34, defend: [[-17, -38], [17, -38], [-17, 38], [17, 38]] },
    { name: 'Mine', x: LANE, z: 420, r: 30, home: 1, defend: S(DEFEND.Quarry) },
    { name: 'Pumps', x: 0, z: 440, r: 26, home: 1, defend: S(DEFEND.Depot) },
    { name: 'Souk', x: -LANE, z: 420, r: 32, home: 1, defend: S(DEFEND.Kasbah) },
  ],
  links: [['Kasbah', 'Depot'], ['Depot', 'Quarry'], ['Souk', 'Pumps'], ['Pumps', 'Mine'], ['Depot', 'Bridge'], ['Bridge', 'Pumps'], ['Kasbah', 'Souk'], ['Quarry', 'Mine']],
  roads: [
    { points: across([[0, -985], [0, -BASE], [-30, -640], [0, -440], [35, -310], [0, -BLUFF], [0, -60], [0, 0]]), width: 12, tex: 'road' },   // base to base over the bridge
    ...both([{ points: [[0, -BASE], [-200, -760], [-420, -600], [-LANE, -420]], width: 9, tex: 'road' }]),                                    // to the town
    ...both([{ points: [[-LANE, -420], [-LANE, -BLUFF], [-LANE, -24]], width: 5, tex: 'track', kind: 'track' }]),                             // town to the footbridge
    { points: across([[0, -BASE], [220, -760], [430, -610], [LANE, -420], [LANE, -BLUFF], [LANE, -70], [LANE, 0]]), width: 5, tex: 'track', kind: 'track' },   // to the quarry and through the ford
    ...both([{ points: [[-LANE, -420], [-280, -470], [0, -440]], width: 5, tex: 'track', kind: 'track' }, { points: [[0, -440], [280, -470], [LANE, -420]], width: 5, tex: 'track', kind: 'track' }]),   // along each row
  ],
  terrain: {
    water: -3, wade: 0.8, mirrorZ: true,   // units wade water up to 0.8 m deep (the ford), at half speed
    features: [
      // the bluffs, a pass in each lane (the north bluff is the mirror image)
      { type: 'ridge', x1: -1000, z1: -BLUFF, x2: 1000, z2: -BLUFF, w: 34, h: 24, p: 0.6, jag: 0.45, cuts: [{ x: -LANE, z: -BLUFF, r: 30 }, { x: 0, z: -BLUFF, r: 32 }, { x: LANE, z: -BLUFF, r: 30 }] },
      // the hinterland: cover between the lanes and on the flanks
      { type: 'hill', x: -290, z: -580, r: 95, h: 18, p: 0.7, jag: 0.5 }, { type: 'hill', x: 290, z: -580, r: 95, h: 18, p: 0.7, jag: 0.5 },
      { type: 'hill', x: -820, z: -560, r: 120, h: 28, p: 0.6, jag: 0.6 }, { type: 'hill', x: 820, z: -560, r: 120, h: 28, p: 0.6, jag: 0.6 },
      { type: 'hill', x: -330, z: -900, r: 85, h: 14, p: 0.8, jag: 0.5 }, { type: 'hill', x: 330, z: -900, r: 85, h: 14, p: 0.8, jag: 0.5 },
      { type: 'hill', x: -820, z: -880, r: 90, h: 20, p: 0.7, jag: 0.5 }, { type: 'hill', x: 820, z: -880, r: 90, h: 20, p: 0.7, jag: 0.5 },
      // the town sits on a gentle rise; the quarry is a pit with spoil heaps round it
      { type: 'hill', x: -LANE, z: -460, r: 130, h: 6, p: 1.2 },
      { type: 'hill', x: LANE + 70, z: -370, r: 42, h: -7, p: 0.6 },
      { type: 'hill', x: LANE - 85, z: -490, r: 36, h: 10, p: 0.8, jag: 0.5 }, { type: 'hill', x: LANE + 95, z: -500, r: 40, h: 12, p: 0.7, jag: 0.6 },
      // dunes on the valley floor
      { type: 'hill', x: -300, z: -130, r: 55, h: 5, p: 0.9, jag: 0.4 }, { type: 'hill', x: 300, z: -130, r: 55, h: 5, p: 0.9, jag: 0.4 },
      { type: 'hill', x: -820, z: -120, r: 70, h: 8, p: 0.8, jag: 0.5 }, { type: 'hill', x: 820, z: -120, r: 70, h: 8, p: 0.8, jag: 0.5 },
    ],
    rivers: [{ path: RIVER_X.map(x => [x, 0]), ws: RIVER_W, w: 26, depth: 7 }],
    fords: [
      { x1: LANE, z1: -34, x2: LANE, z2: 34, r: 15, m: 10, bed: -3.6 },               // the ford: a level bed 0.6 m under the water, 30 m wide
      { x1: -360, z1: 0, x2: -240, z2: 0, r: 5, m: 9, bed: 0.4 },                       // sandbars splitting the channel
      { x1: 240, z1: 0, x2: 360, z2: 0, r: 5, m: 9, bed: 0.4 },
    ],
  },
  // the long barriers and where they are crossed, for route-finding (nav.js gates): the bluffs at their passes, the river at
  // the footbridge (infantry), the bridge and the ford; d: metres either side of the line a crossing takes
  gates: [-BLUFF, 0, BLUFF].map(at => ({ at, portals: at ? [{ x: -LANE, d: 45 }, { x: 0, d: 45 }, { x: LANE, d: 45 }] : [{ x: -LANE, d: 32, foot: true }, { x: 0, d: 44 }, { x: LANE, d: 62 }] })),
  // where tank traps close a crossing to vehicles: both ends of the bridge, and the ford's banks (two rows each: it is 30 m
  // wide); the CPU lays them at the ones on its side
  chokes: [[0, -44], [545, -62], [575, -62], [0, 44], [545, 62], [575, 62]],
  bridges: [
    { x: 0, z: 0, len: 64, w: 14, angle: 0, y: 1.3 },
    { x: -LANE, z: 0, len: 44, w: 4, angle: 0, y: 1.0, foot: true },
  ],
  flats: [
    { x: 0, z: -BASE, r: 50, m: 25 },
    { x: -LANE, z: -420, r: 64, m: 20 }, { x: 0, z: -440, r: 44, m: 18 }, { x: LANE, z: -420, r: 34, m: 14 },
    { x: 0, z: -44, r: 22, m: 14 }, { x: -LANE, z: -30, r: 12, m: 10 }, { x: LANE, z: -62, r: 18, m: 12 },   // the approaches to the bridge, footbridge and ford
  ],

  build() {
    const r = rand(2026), rd = rand(4646), strips = [];
    // the roads as drawn; nothing stands within their width plus 3 m
    const lines = this.roads.map(rd => ({ P: smooth(rd.points, 2), clear: rd.width / 2 + 3 }));
    const onRoad = (x, z, extra = 0) => lines.some(({ P, clear }) => { for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < clear + extra) return true; } return false; });
    const wet = (x, z, margin = 4) => Math.abs(z) < riverW(x) * 0.78 + margin;   // open water, and a margin of bank
    const K = makeKit({ r, rd, onRoad: (x, z) => onRoad(x, z) });
    const { props, obstacles, lamps, tufts, box, part, footprint, house, wallRun, hesco, containers, fuelTank, floodlight, watchtower, barracks, equipmentHut, stall, well, palm, bagStack, sandbagRing, tilt, scrub } = K;
    // what is built keeps a circle clear (x, z, radius); scatter keeps off it, off the roads, the water, the places and the bases
    const placed = [], take = (x, z, rad) => placed.push([x, z, rad]);
    const room = (x, z, rad) => !onRoad(x, z, rad) && !wet(x, z, rad) && !placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + rad + 2.5);
    const busy = (x, z) => onRoad(x, z) || wet(x, z) || this.locations.some(l => Math.hypot(x - l.x, z - l.z) < l.r + 25) || this.bases.some(b => Math.hypot(x - b.x, z - b.z) < 60)
      || this.bridges.some(b => Math.abs(x - b.x) < b.w / 2 + 8 && Math.abs(z) < b.len / 2 + 10) || placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + 3);

    // ---- the main base: a sandbag perimeter with its gate to the north, containers, floodlights, a tower
    { const b = this.bases[0];
      sandbagRing(b.x, b.z, 30, Math.atan2(-b.z, -b.x)); containers(b.x - 30, b.z + 12, 3, 2); take(b.x, b.z, 34);
      floodlight(b.x - 18, b.z - 16); floodlight(b.x + 18, b.z + 16); watchtower(b.x + 22, b.z - 22, 5, 10); }

    // ---- Kasbah: a round town of flat-roofed houses on a 12 m grid round an open square, a mosque on its north-west corner,
    // stalls and a well on the square, yards with palms; the gaps between houses stay 2.5 m or wider (the 1.5 m grid)
    { const t = this.locations[0], cx = t.x, cz = t.z;
      const mx = cx - 20, mz = cz + 19;                                                                       // mosque and minaret
      box(12, 5, 10, null, mx, mz, { tex: 'plaster3' }); box(13, 0.4, 11, 0xc9b48f, mx, mz, { y: 5, obstacle: false });
      props.push({ geo: 'cyl:1.9,3.3,1.7,12', color: 0x7fa6a0, x: mx, y: 6.25, z: mz, rot: [0, 0, 0], cast: true });
      props.push({ geo: 'cyl:0.15,1.9,1.3,12', color: 0x7fa6a0, x: mx, y: 7.75, z: mz, rot: [0, 0, 0], cast: true });
      box(1.6, 2.6, 0.2, 0x4a3a2a, mx, mz - 5.05, { obstacle: false });
      box(2.2, 16, 2.2, null, mx - 8, mz + 6, { tex: 'plaster3' }); box(3.2, 0.5, 3.2, 0x7fa6a0, mx - 8, mz + 6, { y: 16, obstacle: false });
      props.push({ geo: 'cyl:0.1,1.5,1.5,10', color: 0x7fa6a0, x: mx - 8, y: 17.25, z: mz + 6, rot: [0, 0, 0], cast: true });
      take(mx - 2, mz + 1, 9);
      well(cx + 5, cz - 6); obstacles.push({ minX: cx + 3.5, maxX: cx + 6.5, minZ: cz - 7.5, maxZ: cz - 4.5, h: 1.2 }); take(cx + 5, cz - 6, 2);
      for (let i = 0; i < 4; i++) { const col = [0xb04a3a, 0x3a6ab0, 0xd0b040, 0x6a9a4a][i], x = cx - 4 + i * 4.2, z = cz - 15; if (room(x, z, 2.5)) { stall(x, z, 0, col, [0xe2b640, 0xe8e2d0, 0xb04a3a, 0xe8e2d0][i]); take(x, z, 2.5); } }   // the square's south side, off the road
      for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
        const w = 6 + Math.floor(r() * 3), d = 6 + Math.floor(r() * 3), fl = r() < 0.3 ? 2 : 1, x = cx + gx * 12 + (r() - 0.5) * 2, z = cz + gz * 12 + (r() - 0.5) * 2, rot = (r() < 0.5 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.08, yard = r() < 0.12;
        if ((Math.abs(gx) <= 1 && Math.abs(gz) <= 1) || Math.hypot(gx, gz) > 4.3) continue;                    // the square; a round town
        const rad = Math.hypot(w, d) / 2;
        if (yard) { if (room(x, z, 3)) { palm(x, z); take(x, z, 2); } continue; }
        if (!room(x, z, rad)) continue;
        house(x, z, w, d, fl, rot, [cx, cz]); take(x, z, rad);
      }
      // a ruined old wall on the town's south and west edges, gaps where the roads come in
      for (let i = 0; i < 16; i++) { const a = Math.PI * (0.75 + i / 16 * 0.85), x0 = cx + Math.cos(a) * 62, z0 = cz + Math.sin(a) * 62, x1 = cx + Math.cos(a + 0.09) * 62, z1 = cz + Math.sin(a + 0.09) * 62; if (r() < 0.25 || !room((x0 + x1) / 2, (z0 + z1) / 2, 3)) continue; wallRun(x0, z0, x1, z1, 2.4); }
      scrub(cx, cz, 70, 90);
    }

    // ---- Depot: fuel tanks west of the road either side of the track in from Kasbah, stacked containers east of the road, a
    // fence, a pump house and a barracks hut
    { const d = this.locations[1], dx = d.x, dz = d.z;
      for (const x of [dx - 24, dx - 37]) for (const z of [dz - 22, dz - 34, dz + 20]) if (room(x, z, 5)) { fuelTank(x, z); take(x, z, 5); }
      containers(dx + 14, dz - 22, 3, 3); take(dx + 21, dz - 18, 9);
      if (room(dx + 26, dz + 14, 9)) { barracks(dx + 26, dz + 14); take(dx + 26, dz + 14, 10); }
      equipmentHut(dx - 30, dz + 36, 1); take(dx - 30, dz + 36, 4);
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, x = dx + Math.cos(a) * 40, z = dz + Math.sin(a) * 34; if (!onRoad(x, z, 2)) box(0.3, 2.4, 0.3, 0x5a5a5a, x, z, { obstacle: false }); }   // fence posts
      floodlight(dx - 20, dz + 26); floodlight(dx + 22, dz - 30);
    }

    // ---- Quarry: a crusher fed by a conveyor, gravel heaps, a site office, a tower, containers; the pit north-east of it has
    // flooded (its floor is below the river)
    { const q = this.locations[2], qx = q.x, qz = q.z;
      const kx = qx + 38, kz = qz + 22;                                                                       // the crusher
      part(kx, kz, 0, 0, 0, 0, 7, 6, 6, 0x8f8b82); part(kx, kz, 0, 0, 6, 0, 5, 2.5, 5, 0x77736b); part(kx, kz, 0, 0, 8.5, 0, 6, 0.4, 6, 0x9a5b35);   // body, hopper, rusty lip
      for (const s of [-1, 1]) part(kx, kz, 0, s * 3.6, 0, 0, 0.3, 7, 0.3, 0x5e6266);
      footprint(7, 6, kx, kz, 0, 9); take(kx, kz, 6);
      tilt(kx, kz, -12, 4.5, 0, 17, 0.25, 1.4, 0x3a3c3e, [0, 0, 0.36]);                                       // the conveyor, rising to the hopper
      for (const lx of [-18, -12, -6]) part(kx, kz, 0, lx, 0, 0, 0.25, 2 + (lx + 20) * 0.35, 1.2, 0x6e7276);
      for (const [gx, gz, gr, gh] of [[qx - 18, qz + 26, 7, 5], [qx + 8, qz - 26, 6, 4.5], [qx - 30, qz - 8, 5, 3.5]]) if (room(gx, gz, gr)) {   // gravel heaps
        props.push({ geo: `cyl:0.4,${gr},${gh},10`, color: 0xa39a88, x: gx, y: gh / 2, z: gz, rot: [0, 0, 0], cast: true }); footprint(gr * 1.3, gr * 1.3, gx, gz, 0, gh); take(gx, gz, gr);
      }
      if (room(qx - 30, qz - 30, 10)) { barracks(qx - 30, qz - 30); take(qx - 30, qz - 30, 10); }
      watchtower(qx + 30, qz - 26, 3, 8); take(qx + 30, qz - 26, 3);
      containers(qx + 40, qz - 6, 2, 2); take(qx + 44, qz - 4, 7);
      floodlight(qx - 12, qz + 36); floodlight(qx + 34, qz - 6);
      for (let i = 0; i < 24; i++) { const a = r() * Math.PI * 2, d = 46 + r() * 30, x = qx + 70 + Math.cos(a) * d * 0.7, z = qz + 50 + Math.sin(a) * d * 0.7, s = 1.5 + r() * 2.5; if (room(x, z, s)) box(+s.toFixed(2), +(s * 0.7).toFixed(2), +(s * 0.9).toFixed(2), [0x8c857a, 0x7a7368, 0x9a9388][i % 3], x, z, { rot: r() * Math.PI }); }   // boulders round the pit
    }

    // ---- the bridgehead: hesco walls either side of the road, sandbags at the bridge's end, a guard hut, a light
    { hesco(-15, -50, 0, 7.5); hesco(15, -50, 0, 7.5); take(-15, -50, 4); take(15, -50, 4);
      bagStack(-9.5, -38, 0, 3); bagStack(9.5, -38, 0, 3);
      equipmentHut(-24, -66, 1); take(-24, -66, 4); floodlight(22, -60); }
    // ---- the town lane: ruined walls along the way to the footbridge, cover for the walk across the valley
    for (const [x0, z0, x1, z1] of [[-590, -300, -578, -292], [-532, -248, -522, -258], [-596, -150, -586, -140], [-534, -118, -522, -112], [-590, -70, -582, -60]]) if (room((x0 + x1) / 2, (z0 + z1) / 2, 6)) { wallRun(x0, z0, x1, z1, 2.2); take((x0 + x1) / 2, (z0 + z1) / 2, 6); }

    // ---- the open south half: rocks, bushes, the palm belt along the river, scrub
    const rock = (x, z) => { const s = 0.8 + r() * 2.2, col = [0x8c857a, 0x7a7368, 0x9a9388][Math.floor(r() * 3)], rot = r() * Math.PI; if (!busy(x, z)) box(+s.toFixed(2), +(s * 0.6).toFixed(2), +(s * 0.8).toFixed(2), col, x, z, { rot }); };
    const bush = (x, z) => { const s = 0.8 + r() * 0.5; if (busy(x, z)) return; K.bush(x, z, s); };
    const tree = (x, z) => { const tl = (r() - 0.5) * 0.12; if (!busy(x, z)) palm(x, z, tl); };
    for (let i = 0; i < 520; i++) rock(-985 + r() * 1970, -985 + r() * 950);
    for (let i = 0; i < 260; i++) bush(-985 + r() * 1970, -985 + r() * 950);
    for (let i = 0; i < 300; i++) { const x = -985 + r() * 1970, z = -(riverW(x) * 0.78 + 6 + r() * 60); tree(x, z); }
    const tuft = (cx, cz, rad, n) => { for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d, z = Math.min(-2, cz + Math.sin(a) * d), yaw = r() * Math.PI, size = [0.7, 0.9, 1.15][Math.floor(r() * 3)]; if (!onRoad(x, z) && !wet(x, z)) tufts.push({ x, z, yaw, size }); } };
    for (let i = 0; i < 70; i++) tuft(-985 + r() * 1970, -(20 + r() * 70), 12 + r() * 20, 40);
    for (let i = 0; i < 90; i++) tuft(-985 + r() * 1970, -985 + r() * 900, 10 + r() * 20, 30);

    // ---- mirror everything north (z to -z; a turn about y becomes pi minus it, which mirrors a box exactly)
    const n = props.length; for (let i = 0; i < n; i++) { const p = props[i]; props.push({ ...p, z: -p.z, rot: [-p.rot[0], Math.PI - p.rot[1], p.rot[2]], ...(p.az !== undefined ? { az: -p.az } : {}) }); }
    const no = obstacles.length; for (let i = 0; i < no; i++) { const o = obstacles[i]; obstacles.push({ ...o, minZ: -o.maxZ, maxZ: -o.minZ }); }
    const nt = tufts.length; for (let i = 0; i < nt; i++) { const t = tufts[i]; tufts.push({ ...t, z: -t.z, yaw: Math.PI - t.yaw }); }
    const nl = lamps.length; for (let i = 0; i < nl; i++) lamps.push({ ...lamps[i], z: -lamps[i].z });

    // ---- bridges (absolute heights; the decks are walkable via WorldState.heightAt): kit.js bridge(), the road bridge in
    // concrete, the footbridge in timber; railings inset 0.15 m
    for (const b of this.bridges) K.bridge(b, 0.15);

    // ---- roads and tracks
    for (const rd of this.roads) strips.push({ points: rd.points, width: rd.width, tex: rd.tex, vRepeat: rd.tex === 'road' ? 12 : 5, smooth: 2, y: rd.tex === 'road' ? 0.03 : 0.02, cutout: true });   // cutouts: sand-drifted ragged edges
    return { props, obstacles, lamps, tufts, decals: K.decals, strips };
  },

  // paints the splat map: r concrete, g asphalt, b grass, a dirt (sand elsewhere); every shape twice, mirrored
  paintSplat(g, px, half) {
    const ppm = px / (half * 2), X = (x) => (x + half) * ppm, Z = (z) => (half - z) * ppm;
    g.clearRect(0, 0, px, px);
    const disc = (x, z, rad, style) => { g.fillStyle = style; for (const s of [1, -1]) { g.beginPath(); g.arc(X(x), Z(z * s), rad * ppm, 0, Math.PI * 2); g.fill(); } };
    const rect = (x, z, w, d, style) => { g.fillStyle = style; for (const s of [1, -1]) g.fillRect(X(x - w / 2), Z(s * z + d / 2), w * ppm, d * ppm); };
    const stroke = (pts, width, style) => { g.strokeStyle = style; g.lineWidth = width * ppm; g.lineCap = 'round'; g.lineJoin = 'round'; for (const s of [1, -1]) { g.beginPath(); g.moveTo(X(pts[0][0]), Z(s * pts[0][1])); for (const p of pts.slice(1)) g.lineTo(X(p[0]), Z(s * p[1])); g.stroke(); } };
    // the green belt: grass along both banks, fields cut into it, a sandy strip at the water's edge
    g.fillStyle = 'rgba(0,0,255,0.8)'; g.beginPath();
    for (let x = -half; x <= half; x += 10) g.lineTo(X(x), Z(riverW(x) * 0.78 + 70 + 12 * Math.sin(x / 90)));
    for (let x = half; x >= -half; x -= 10) g.lineTo(X(x), Z(-(riverW(x) * 0.78 + 70 + 12 * Math.sin(x / 90))));
    g.fill();
    const fr = rand(77);
    for (let i = 0; i < 60; i++) { const x = -980 + fr() * 1960, z = -(riverW(x) * 0.78 + 12 + fr() * 50); rect(x, z, 18 + fr() * 30, 8 + fr() * 14, fr() < 0.5 ? 'rgba(0,0,255,1)' : 'rgba(0,0,0,0.55)'); }
    for (let x = -half; x <= half; x += 6) { const w = riverW(x) * 0.78; rect(x, -(w + 3), 7, 6, 'rgba(0,0,0,0.45)'); }
    // bases, places and crossings
    for (const b of this.bases.slice(0, 1)) disc(b.x, b.z, 36, 'rgba(0,0,0,0.85)');
    const [kas, dep, qua] = this.locations;
    disc(kas.x, kas.z, 70, 'rgba(0,0,0,0.8)'); for (const [ox, oz] of [[-48, -30], [-44, 26], [46, 28], [42, -26]]) disc(kas.x + ox, kas.z + oz, 9, 'rgba(0,0,255,0.9)');
    rect(dep.x, dep.z, 70, 60, 'rgb(0,255,0)');
    disc(qua.x + 40, qua.z + 20, 70, 'rgba(255,0,0,0.6)');
    disc(0, -44, 26, 'rgba(255,0,0,0.6)');
    rect(LANE, -50, 46, 40, 'rgba(0,0,0,0.9)');
    // dirt under the tracks
    for (const rd of this.roads) if (rd.kind === 'track' && rd.points.every(p => p[1] <= 0)) stroke(rd.points, 9, 'rgba(0,0,0,0.8)');
    const lane = this.roads.find(rd => rd.kind === 'track' && rd.points.some(p => p[1] > 0) && rd.points.some(p => p[1] < 0));   // the one through the ford if (lane) stroke(lane.points.filter(p => p[1] <= 0), 9, 'rgba(0,0,0,0.8)');
  },
};
