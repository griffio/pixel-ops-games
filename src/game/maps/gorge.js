import { rand } from '../../core/layout.js';
import { smooth } from '../../core/math.js';
import { Terrain } from '../../core/terrain.js';
import { makeKit } from './kit.js';

// "Olive Gorge": 1.2 km, combined arms, mirror-symmetric about the river (z = 0) like Palm Valley: the south half is laid out
// and the north half is its mirror image (terrain via mirrorZ, everything else copied at the end of build), so both sides get
// the same ground and the same distances. BLUFOR's base is in the south, OPFOR's in the north. z is north; +x is WEST, as
// on every map (the minimap mirrors the splat for that reason), so a place at -x lies east. A river in a gorge cuts the
// plateau in two; an old hill town stands on both rims, joined by one stone bridge (the Old Bridge, the centre place); the
// gorge opens into a shallow basin on the west (+x) where a ford crosses it; a timber footbridge crosses it on the east by the
// water mill, for infantry only. Each side's home row: a walled monastery on an olive-terraced knoll in the east (Monastery,
// Convent) and an olive mill among its groves in the west (Olive Mill, Winery). Five places, three ways over the river, three
// of five for the majority. Plan and measurements: docs/GAME_PLAN.md, "Olive Gorge plan".
const S = (pts) => pts.map(([x, z]) => [x, -z]);                 // the mirror image of a south-half path
const across = (pts) => [...pts, ...S(pts).reverse().slice(1)];   // a south-half path ending on the river, carried on north
const both = (list) => [...list, ...list.map(r => ({ ...r, points: S(r.points) }))];

const LANE = 330, ROW = -250, BASE = 520, WATER = -9, PAD = 2.5;   // PAD: the town's level, the stone bridge's deck
// sandbag positions round each south place, outside its walls and facing the enemy's half; the north places get the mirror
// images. The CPU digs in at the ones facing the enemy (strategist.digSpot)
const DEFEND = {
  Monastery: [[-318, -226], [-342, -226], [-304, -240], [-304, -260], [-354, -228]],
  Mill: [[318, -224], [342, -224], [360, -240], [360, -260], [300, -228]],
};
// the river's carve half-width along x: the gorge reach narrow (x -600 to 200: narrowest at the footbridge, -330, and the
// bridge, 0), the lower reach wide where the ford is (330, to the west)
const RIVER_X = [-600, -480, -400, -330, -260, -160, -80, 0, 80, 160, 200, 260, 330, 400, 480, 600];
const RIVER_W = [14, 13, 12, 10, 12, 13, 12, 12, 13, 14, 16, 24, 30, 32, 30, 28];
const riverW = (x) => { for (let i = 0; i < RIVER_X.length - 1; i++) if (x <= RIVER_X[i + 1]) { const t = (x - RIVER_X[i]) / (RIVER_X[i + 1] - RIVER_X[i]); return RIVER_W[i] + (RIVER_W[i + 1] - RIVER_W[i]) * t; } return RIVER_W[RIVER_W.length - 1]; };
// the monastery's terraces: six steps of 1.3 m, 12 m apart, each a level disc with a 5 m bank (slope under 0.45, so a truck
// climbs them); walls stand on every other step's edge (build)
const TERRACES = [100, 88, 76, 64, 52, 40].map((r, i) => ({ x: -LANE, z: ROW, r, m: 5, y: 2.6 + i * 1.3 }));
const GROVES = [   // olive groves on the plateau and round the mill: [x, z, w, d], rows 9 m apart, a tree every 8 m (south half)
  [-200, -470, 48, 40], [200, -470, 48, 40], [-90, -312, 50, 36], [90, -312, 50, 36], [-470, -300, 56, 44], [470, -300, 56, 44], [-232, -172, 44, 36], [232, -172, 44, 36],
  [292, -302, 50, 34], [372, -302, 50, 34], [282, -200, 44, 34], [384, -200, 44, 34],
];

export const gorge = {
  name: 'Olive Gorge', size: 1200, clock: 20, tickets: 400, squadSlots: 8, budget: 1200,   // 20 minutes, 400 tickets, 8 squads on 1,200 points: a map where the pool decides (docs/GAME_PLAN.md, "Olive Gorge plan")
  hour: 16.5, wind: [0.6, 0.3],   // late afternoon, long shadows down the terraces
  blurb: 'A gorge splits a hill town: one old stone bridge, a ford where the gorge opens, a footbridge at the mill. Olive terraces either side.',
  nav: { foot: 1.2, vehicle: 2, cap: 150000 },   // a million infantry cells
  splatRes: 1024,
  // dry olive-country grass everywhere (tile 4 is the same texture: painted ground keeps it where nothing else is painted);
  // the base, a lusher meadow, shows where the splat is cleared (the basin and the lower reach's banks)
  ground: { base: 'meadow', baseSize: 12.8, tiles: ['concrete', 'sand', 'dirt', 'grass'], tileSize: [16, 12.8, 12.8, 12.8] },
  bases: [{ team: 0, x: 0, z: -BASE, r: 40 }, { team: 1, x: 0, z: BASE, r: 40 }],
  // list order runs from BLUFOR's side to OPFOR's, each row from the east, so each side's first pick is its monastery
  locations: [
    { name: 'Monastery', x: -LANE, z: ROW, r: 30, home: 0, defend: DEFEND.Monastery },
    { name: 'Olive Mill', x: LANE, z: ROW, r: 28, home: 0, defend: DEFEND.Mill },
    { name: 'Old Bridge', x: 0, z: 0, r: 38, defend: [[-14, -42], [14, -42], [-14, 42], [14, 42]] },
    { name: 'Winery', x: LANE, z: -ROW, r: 28, home: 1, defend: S(DEFEND.Mill) },
    { name: 'Convent', x: -LANE, z: -ROW, r: 30, home: 1, defend: S(DEFEND.Monastery) },
  ],
  links: [['Monastery', 'Old Bridge'], ['Olive Mill', 'Old Bridge'], ['Old Bridge', 'Winery'], ['Old Bridge', 'Convent'], ['Monastery', 'Convent'], ['Olive Mill', 'Winery']],
  roads: [
    { points: across([[0, -590], [0, -BASE], [-24, -440], [0, -330], [20, -200], [0, -110], [0, -60], [0, -24], [0, 0]]), width: 9, tex: 'road' },   // base to base over the Old Bridge
    ...both([{ points: [[0, -BASE], [-120, -500], [-250, -410], [-LANE, -312], [-LANE, -266]], width: 7, tex: 'road' }]),                            // to the monastery's south gate
    ...both([{ points: [[0, -BASE], [120, -500], [250, -410], [LANE, -312], [LANE, ROW]], width: 7, tex: 'road' }]),                                 // into the mill's yard
    { points: across([[-LANE, -234], [-346, -160], [-LANE, -70], [-LANE, -20], [-LANE, 0]]), width: 4, tex: 'track', kind: 'track' },                 // the north gate to the footbridge
    { points: across([[LANE, ROW], [344, -160], [LANE, -80], [LANE, -34], [LANE, 0]]), width: 5, tex: 'track', kind: 'track' },                      // the yard through the ford
    ...both([{ points: [[-LANE, -300], [-170, -262], [0, -252], [170, -262], [LANE, -300]], width: 4, tex: 'track', kind: 'track' }]),               // along the home row
    ...both([{ points: [[-60, -122], [-60, -40], [-24, -34]], width: 4, tex: 'track', kind: 'track' }, { points: [[60, -122], [60, -40], [24, -34]], width: 4, tex: 'track', kind: 'track' }]),   // the town's lanes
  ],
  terrain: {
    cell: 2, water: WATER, wade: 0.8, mirrorZ: true,   // 2 m height cells for the gorge's walls; units wade water up to 0.8 m deep (the ford), at half speed
    features: [
      { type: 'hill', x: 0, z: -70, r: 130, h: 3, p: 1.3 },                                                                           // the town's rise
      { type: 'hill', x: -LANE, z: ROW, r: 120, h: 12, p: 1.0 },                                                                      // the monastery's knoll (the terraces are flats)
      { type: 'hill', x: LANE, z: ROW, r: 100, h: 5, p: 1.1 },                                                                        // the mill's rise
      { type: 'hill', x: -165, z: -140, r: 70, h: 9, p: 0.8, jag: 0.5 }, { type: 'hill', x: 165, z: -140, r: 70, h: 9, p: 0.8, jag: 0.5 },     // between the lanes
      { type: 'hill', x: -150, z: -385, r: 70, h: 10, p: 0.8, jag: 0.5 }, { type: 'hill', x: 150, z: -385, r: 70, h: 10, p: 0.8, jag: 0.5 },   // behind the home row
      { type: 'hill', x: -520, z: -130, r: 90, h: 14, p: 0.7, jag: 0.5 }, { type: 'hill', x: 520, z: -130, r: 90, h: 14, p: 0.7, jag: 0.5 },   // the flanks
      { type: 'hill', x: -520, z: -430, r: 90, h: 12, p: 0.7, jag: 0.5 }, { type: 'hill', x: 520, z: -430, r: 90, h: 12, p: 0.7, jag: 0.5 },
      { type: 'hill', x: LANE, z: 0, r: 130, h: -6, p: 1.0 },                                                                         // the basin the gorge opens into at the ford
    ],
    rivers: [
      { path: RIVER_X.slice(0, 11).map(x => [x, 0]), ws: RIVER_W.slice(0, 11), w: 12, depth: 16 },   // the gorge reach: 7 m of water under 7 m of rock
      { path: RIVER_X.slice(10).map(x => [x, 0]), ws: RIVER_W.slice(10), w: 28, depth: 11 },         // the lower reach: a shallow, wide stretch
    ],
    fords: [{ x1: LANE, z1: -34, x2: LANE, z2: 34, r: 13, m: 9, bed: WATER - 0.6 }],   // the ford: a level bed 0.6 m under the water, 26 m wide
  },
  // the long barrier and where it is crossed, for route-finding (nav.js gates): the river at the footbridge (infantry), the
  // bridge and the ford; d: metres either side of the line a crossing takes
  gates: [{ at: 0, portals: [{ x: -LANE, d: 24, foot: true }, { x: 0, d: 30 }, { x: LANE, d: 44 }] }],
  // where tank traps close a crossing to vehicles: both ends of the bridge, and the ford's banks (two rows each: it is 26 m
  // wide); the CPU lays them at the ones on its side
  chokes: [[0, -28], [LANE - 12, -48], [LANE + 12, -48], [0, 28], [LANE - 12, 48], [LANE + 12, 48]],
  bridges: [
    { x: 0, z: 0, len: 40, w: 10, angle: 0, y: PAD, stone: true },
    { x: -LANE, z: 0, len: 32, w: 5, angle: 0, y: 1.6, foot: true },   // 5 m: the railings, padded 0.6 m for the 1.2 m foot grid, must leave a whole cell free across the deck (a 3 m and a 4 m deck left none)
  ],
  flats: [
    { x: 0, z: -BASE, r: 50, m: 25 },                                      // the base
    ...TERRACES,                                                           // the monastery's terraces, the lowest first
    { x: LANE, z: ROW, r: 38, m: 14 },                                     // the mill's yard
    { x: 0, z: -66, r: 64, m: 18, y: PAD },                                // the town, level with the bridge deck
    { x: -LANE, z: -20, r: 10, m: 6, y: 1.6 },                             // the footbridge's end
    { x: LANE, z: -46, r: 16, m: 10 },                                     // the approach to the ford
  ],

  build() {
    const r = rand(3131), rd = rand(7272), strips = [], thickets = [];
    const T = new Terrain(this.size, this.terrain.cell || 4, { ...this.terrain, flats: this.flats });   // the heights the world will build, to place by height
    // the roads as drawn; nothing stands within their width plus 3 m
    const lines = this.roads.map(rd => ({ P: smooth(rd.points, 2), clear: rd.width / 2 + 3 }));
    const onRoad = (x, z, extra = 0) => lines.some(({ P, clear }) => { for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < clear + extra) return true; } return false; });
    const wet = (x, z, margin = 4) => Math.abs(z) < riverW(x) + margin;   // the gorge and its slopes, and a margin of rim
    const K = makeKit({ r, rd, onRoad: (x, z) => onRoad(x, z) });
    const { props, obstacles, lamps, tufts, emitters, box, cottage, church, fieldWall, stoneWall, pen, mill, well, fountain, olive, cypress, rock, scrub, sandbagRing, containers, floodlight, watchtower, bagStack, equipmentHut, MED } = K;
    // what is built keeps a circle clear (x, z, radius); scatter keeps off it, off the roads, the water, the places and the bases
    const placed = [], take = (x, z, rad) => placed.push([x, z, rad]);
    const room = (x, z, rad) => !onRoad(x, z, rad) && !wet(x, z, rad) && !placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + rad + 2.5);
    const busy = (x, z) => onRoad(x, z) || wet(x, z) || this.locations.some(l => Math.hypot(x - l.x, z - l.z) < l.r + 20) || this.bases.some(b => Math.hypot(x - b.x, z - b.z) < 60)
      || this.bridges.some(b => Math.abs(x - b.x) < b.w / 2 + 8 && Math.abs(z) < b.len / 2 + 10) || placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + 3);
    const M = this.locations[0], O = this.locations[1];
    // walks a path and calls fn(x, z, tx, tz) every `step` metres with the unit tangent, for rows of trees along a road
    const along = (pts, step, fn) => { const P = smooth(pts, 2); let acc = step * 0.5; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / L, tz = (bz - az) / L; for (let d = acc; d < L; d += step) fn(ax + tx * d, az + tz * d, tx, tz); acc = (acc - L) % step; if (acc < 0) acc += step; } };
    // a grove: rows `gap` apart, a tree every `sp` m along them, a metre of jitter, on open ground
    const grove = (cx, cz, w, d, gap = 9, sp = 8) => { for (let gz = -d / 2 + 3; gz <= d / 2 - 3; gz += gap) for (let gx = -w / 2 + 3 + (gz / gap % 2 ? sp / 2 : 0); gx <= w / 2 - 3; gx += sp) { const x = cx + gx + (r() - 0.5) * 2, z = cz + gz + (r() - 0.5) * 2; if (r() < 0.85 && !onRoad(x, z, 2) && !wet(x, z, 6) && !placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + 2)) olive(x, z); } };

    // ---- the main base: a sandbag perimeter with its gate to the north, containers, floodlights, a tower
    { const b = this.bases[0];
      sandbagRing(b.x, b.z, 30, Math.atan2(-b.z, -b.x)); containers(b.x - 30, b.z + 12, 3, 2); take(b.x, b.z, 34);
      floodlight(b.x - 18, b.z - 16); floodlight(b.x + 18, b.z + 16); watchtower(b.x + 22, b.z - 22, 5, 10); }

    // ---- the town, south half: the main street from the bridge up through the square, lanes at x +-60, stone houses in the
    // Mediterranean palette with their doors to the street, a church facing the square with a fountain, garden walls between
    // the rows, a parapet along the gorge's rim either side of the bridge (low cover for the bridge fight), sandbags at its end
    { const H = (x, z, rot, fl = r() < 0.45 ? 2 : 1) => { const w = 7 + Math.floor(r() * 3), d = 6 + Math.floor(r() * 2); cottage(x, z, w, d, rot + (r() - 0.5) * 0.08, fl, MED); take(x, z, Math.hypot(w, d) / 2); };
      church(-22, -62, 0, MED); take(-22, -62, 12);                                                             // north of the square, its tower at the west end
      fountain(-14, -82); take(-14, -82, 3);
      const two = () => r() < 0.55 ? 2 : 1;
      for (const z of [-124, -114, -104, -50, -40]) for (const s of [-1, 1]) H(s * 12.5, z, s > 0 ? Math.PI / 2 : -Math.PI / 2, two());   // the main street, doors to it
      for (const z of [-94, -84, -74, -64]) H(12.5, z, Math.PI / 2, two());                                                                 // the square's east side
      for (const lx of [-31, 31]) for (const z of [-122, -111, -100, -89, -78, -67, -56, -45]) if (!(lx < 0 && z >= -96 && z <= -56)) H(lx, z, r() < 0.5 ? 0 : Math.PI / 2, two());   // the middle rows, an alley either side (none on the square or by the church)
      for (const lx of [-60, 60]) for (const z of [-118, -107, -96, -85, -74, -63, -52]) for (const s of [-1, 1]) H(lx + s * 11.5, z, s > 0 ? Math.PI / 2 : -Math.PI / 2, two());   // both sides of each lane
      for (const s of [-1, 1]) { fieldWall(s * 21, -128, s * 21, -118); fieldWall(s * 40, -128, s * 40, -116); fieldWall(s * 22, -36, s * 42, -36); fieldWall(s * 78, -120, s * 78, -96); fieldWall(s * 78, -84, s * 78, -56); }   // garden walls at the town's edges
      fieldWall(-30, -94, -30, -86); fieldWall(-40, -56, -40, -48);
      fieldWall(-56, -17, -9, -17); fieldWall(9, -17, 56, -17);                                                 // the parapet along the rim
      bagStack(-7.5, -26, 0, 3); bagStack(7.5, -26, 0, 3);
      for (const [x, z] of [[-27, -95], [-19, -95], [-11, -95], [-40, -62], [-40, -70], [34, -30], [-34, -30]]) cypress(x, z);
      for (const [x, z] of [[-42, -84], [42, -106], [-20, -118], [20, -96], [-70, -46], [70, -46]]) if (room(x, z, 3)) { olive(x, z); take(x, z, 2); }
    }

    // ---- the Monastery: a walled compound on the top terrace with a gate south and north (the road comes in from the south,
    // the footbridge track leaves by the north), a chapel along the axis's east side, a cloister range on the west, a well,
    // cypresses at the gates; dry-stone walls on every other terrace's edge with gaps where the roads climb; olives on the
    // terraces between them
    { const cx = M.x, cz = M.z, hw = 18, hd = 15, gate = 4.5, WALL = 3.2, T = 1.0;
      const W = (x0, z0, x1, z1) => stoneWall(cx, cz, 0, x0 - cx, z0 - cz, x1 - cx, z1 - cz, WALL, undefined, T, false);   // in the compound's frame: a part takes the ground height at its anchor, and the top terrace is level
      W(cx - hw, cz - hd, cx - gate, cz - hd); W(cx + gate, cz - hd, cx + hw, cz - hd);                         // south wall, the gate on the axis
      W(cx - hw, cz + hd, cx - gate, cz + hd); W(cx + gate, cz + hd, cx + hw, cz + hd);                         // north wall and gate
      W(cx - hw, cz - hd, cx - hw, cz + hd); W(cx + hw, cz - hd, cx + hw, cz + hd);                             // west and east
      church(cx + 9, cz, Math.PI / 2, MED); take(cx + 9, cz, 12);                                               // the chapel, its tower to the north
      cottage(cx - 10, cz, 12, 6, Math.PI / 2, 2, MED); take(cx - 10, cz, 7);                                   // the cloister range
      well(cx - 10, cz + 10); take(cx - 10, cz + 10, 2);
      for (const [x, z] of [[cx - 7, cz - 20], [cx + 7, cz - 20], [cx - 7, cz + 20], [cx + 7, cz + 20]]) cypress(x, z);
      take(cx, cz, 26);
      for (const R of [40, 64, 88]) { const n = Math.round(2 * Math.PI * R / 8); for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 0.82) / n * Math.PI * 2, x0 = cx + Math.cos(a0) * R, z0 = cz + Math.sin(a0) * R, x1 = cx + Math.cos(a1) * R, z1 = cz + Math.sin(a1) * R; if (r() < 0.2 || onRoad((x0 + x1) / 2, (z0 + z1) / 2, 3) || onRoad(x0, z0, 1) || onRoad(x1, z1, 1)) continue; fieldWall(x0, z0, x1, z1); } }
      for (const R of [46, 58, 70, 82, 94]) { const n = Math.round(2 * Math.PI * R / 9); for (let i = 0; i < n; i++) { const a = (i + (R / 12 % 2) * 0.5) / n * Math.PI * 2, x = cx + Math.cos(a) * R + (r() - 0.5) * 2, z = cz + Math.sin(a) * R + (r() - 0.5) * 2; if (r() < 0.75 && !onRoad(x, z, 2)) olive(x, z); } }
    }

    // ---- the Olive Mill: a two-storey mill, a press shed and a store round a yard walled east and west (open to the road
    // south and the ford track north), a well, a threshing floor (splat), groves in rows all round
    { const cx = O.x, cz = O.z;
      cottage(cx - 16, cz + 6, 12, 7, Math.PI / 2, 2, MED); take(cx - 16, cz + 6, 7);                            // the mill
      cottage(cx + 16, cz + 10, 10, 6, Math.PI / 2, 1, MED); take(cx + 16, cz + 10, 6);                           // the press shed
      cottage(cx + 16, cz - 8, 8, 6, 0, 1, MED); take(cx + 16, cz - 8, 5);                                      // the store
      well(cx + 8, cz); take(cx + 8, cz, 2);
      fieldWall(cx - 24, cz - 14, cx - 24, cz + 20); fieldWall(cx + 24, cz - 14, cx + 24, cz + 20);
      fieldWall(cx - 24, cz - 14, cx - 12, cz - 14); fieldWall(cx + 12, cz - 14, cx + 24, cz - 14); fieldWall(cx - 24, cz + 20, cx - 10, cz + 20); fieldWall(cx + 10, cz + 20, cx + 24, cz + 20);
      for (const [x, z] of [[cx - 28, cz - 18], [cx + 28, cz - 18]]) cypress(x, z);
      take(cx, cz, 28);
    }
    for (const [x, z, w, d] of GROVES) grove(x, z, w, d);

    // ---- the footbridge's mill (its wheel to the gorge) and the ford's shepherd's hut and pen
    mill(-312, -24, Math.PI / 2); take(-312, -24, 7);
    cottage(352, -64, 7, 5, 0.3, 1, MED); take(352, -64, 5); pen(364, -80, 0.3, 9, 7); take(364, -80, 6);

    // ---- cypress rows along the base roads and the main road's approach to the town; rocks along the gorge's rim; scrub
    for (const rdef of this.roads.filter(rr => rr.width === 7 && rr.points.every(p => p[1] <= 0))) along(rdef.points.slice(0, 4), 14, (x, z, tx, tz) => { const px = x - tz * 6.5, pz = z + tx * 6.5; if (!busy(px, pz)) cypress(px, pz); });
    along([[0, -500], [-24, -440], [0, -330], [20, -200], [0, -150]], 16, (x, z, tx, tz) => { for (const s of [-1, 1]) { const px = x - tz * 7.5 * s, pz = z + tx * 7.5 * s; if (!busy(px, pz)) cypress(px, pz); } });
    for (let x = -590; x < 590; x += 7) if (r() < 0.55) { const px = x + (r() - 0.5) * 4, pz = -(riverW(px) + 2.5 + r() * 5); if (!busy(px, pz)) rock(px, pz); }
    for (let i = 0; i < 160; i++) { const x = -585 + r() * 1170, z = -585 + r() * 560; if (!busy(x, z) && T.height(x, z) > 2) rock(x, z); }
    for (let i = 0; i < 60; i++) { const x = -585 + r() * 1170, z = -585 + r() * 560; if (!busy(x, z)) scrub(x, z, 10 + r() * 16, 30); }
    for (let i = 0; i < 90; i++) { const x = -585 + r() * 1170, z = -585 + r() * 560; if (room(x, z, 3) && !busy(x, z)) { olive(x, z); take(x, z, 2); } }   // lone olives

    // ---- maquis: thickets of scrub on the hillsides (they block sight like a wall, infantry push through at half pace,
    // vehicles go round), a jittered box of 10 to 18 m a side where the ground stands 2.5 m up and is not too steep, off the
    // roads, the places, the bases, the groves, the terraces and the town; inside, a few broad masses carry the shadow and the
    // small bushes between them cast none (the Hollow's lesson: sizes from short lists, so the bushes batch)
    const MASS = [[2.4, 1.7], [3.0, 1.9], [3.6, 2.2]], BUSH = [0.9, 1.15, 1.4];
    const mass = (x, z) => { const [rr, h] = MASS[Math.floor(r() * MASS.length)]; props.push({ geo: `cyl:${rr},${(rr * 1.12).toFixed(2)},${h},8`, tex: 'bush', x, y: h / 2, z, rot: [0, r() * Math.PI * 2, 0], cast: true, sway: true }); };
    const bushAt = (x, z) => { const s = BUSH[Math.floor(r() * BUSH.length)]; props.push({ geo: `cyl:${(1.3 * s).toFixed(2)},${(1.5 * s).toFixed(2)},${(1.6 * s).toFixed(2)},7`, tex: 'bush', x, y: 0.8 * s, z, rot: [0, r() * Math.PI * 2, 0], cast: false, sway: true }); };
    const maquis = (x, z, w, d) => { thickets.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: 2.2, thicket: true, walk: 0.55 }); for (let i = 0; i < w * d / 45; i++) mass(x + (r() - 0.5) * (w - 4), z + (r() - 0.5) * (d - 4)); for (let i = 0; i < w * d / 28; i++) bushAt(x + (r() - 0.5) * (w - 2), z + (r() - 0.5) * (d - 2)); };
    for (let i = 0, made = 0; i < 4000 && made < 90; i++) {
      const x = -570 + r() * 1140, z = -570 + r() * 540, w = 10 + r() * 8, d = 10 + r() * 8;
      if (T.height(x, z) < 2.5 || T.slope(x, z) > 0.5 || busy(x, z) || onRoad(x, z, 12) || Math.hypot(x - M.x, z - M.z) < 110 || (Math.abs(x) < 90 && z > -140)) continue;
      if (GROVES.some(([gx, gz, gw, gd]) => Math.abs(x - gx) < gw / 2 + 12 && Math.abs(z - gz) < gd / 2 + 12) || thickets.some(t => Math.max(t.minX - (x + w / 2), (x - w / 2) - t.maxX, t.minZ - (z + d / 2), (z - d / 2) - t.maxZ) < 8)) continue;
      maquis(x, z, w, d); take(x, z, Math.max(w, d) / 2); made++;
    }

    // ---- mirror everything north (z to -z; a turn about y becomes pi minus it, which mirrors a box exactly)
    const n = props.length; for (let i = 0; i < n; i++) { const p = props[i]; props.push({ ...p, z: -p.z, rot: [-p.rot[0], Math.PI - p.rot[1], p.rot[2]], ...(p.az !== undefined ? { az: -p.az } : {}) }); }
    const no = obstacles.length; for (let i = 0; i < no; i++) { const o = obstacles[i]; obstacles.push({ ...o, minZ: -o.maxZ, maxZ: -o.minZ }); }
    const nt = tufts.length; for (let i = 0; i < nt; i++) { const t = tufts[i]; tufts.push({ ...t, z: -t.z, yaw: Math.PI - t.yaw }); }
    const nl = lamps.length; for (let i = 0; i < nl; i++) lamps.push({ ...lamps[i], z: -lamps[i].z });
    const nth = thickets.length; for (let i = 0; i < nth; i++) { const t = thickets[i]; thickets.push({ ...t, minZ: -t.maxZ, maxZ: -t.minZ }); }

    // ---- the bridges (absolute heights; the decks are walkable via WorldState.heightAt): the stone bridge and the timber
    // footbridge, their piers and piles down to the gorge's bed
    for (const b of this.bridges) K.bridge(b, 0.15, -16.5);
    // ---- a haze over the water in the gorge, low between its walls
    for (let x = -560; x <= 180; x += 60) emitters.push({ x: x + (r() - 0.5) * 10, y: 0.5, z: 0, kind: 'mist', k: 1.3, rate: 0.5, abs: WATER + 0.3 });

    // ---- roads and tracks
    for (const rd of this.roads) strips.push({ points: rd.points, width: rd.width, tex: rd.tex, vRepeat: rd.tex === 'road' ? 12 : 5, smooth: 2, y: rd.tex === 'road' ? 0.03 : 0.02, cutout: true });
    return { props, obstacles, lamps, tufts, decals: K.decals, emitters, strips, thickets };
  },

  // paints the splat map: r concrete, g sand, b dirt, a the dry grass (the base meadow where the alpha is cleared); every
  // shape twice, mirrored. mix(c, s, d) weights with the rest dry grass, so a painted pixel always sums to one
  paintSplat(g, px, half) {
    const ppm = px / (half * 2), X = (x) => (x + half) * ppm, Z = (z) => (half - z) * ppm;
    const mix = (c, s, d) => `rgba(${Math.round(c * 255)},${Math.round(s * 255)},${Math.round(d * 255)},${(1 - c - s - d).toFixed(3)})`;
    g.clearRect(0, 0, px, px); g.fillStyle = mix(0, 0, 0); g.fillRect(0, 0, px, px);   // dry grass over the plateau
    const disc = (x, z, rad, style) => { g.fillStyle = style; for (const s of [1, -1]) { g.beginPath(); g.arc(X(x), Z(z * s), rad * ppm, 0, Math.PI * 2); g.fill(); } };
    const rect = (x, z, w, d, style) => { g.fillStyle = style; for (const s of [1, -1]) g.fillRect(X(x - w / 2), Z(s * z + d / 2), w * ppm, d * ppm); };
    const stroke = (pts, width, style) => { g.strokeStyle = style; g.lineWidth = width * ppm; g.lineCap = 'round'; g.lineJoin = 'round'; for (const s of [1, -1]) { g.beginPath(); g.moveTo(X(pts[0][0]), Z(s * pts[0][1])); for (const p of pts.slice(1)) g.lineTo(X(p[0]), Z(s * p[1])); g.stroke(); } };
    // the meadow: the basin round the ford and the lower reach's banks, cut out of the dry grass (the base shows through)
    g.save(); g.globalCompositeOperation = 'destination-out';
    for (const s of [1, -1]) { g.fillStyle = 'rgba(0,0,0,0.8)'; g.beginPath(); g.ellipse(X(LANE), Z(s * 30), 120 * ppm, 100 * ppm, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.6)'; for (let x = 200; x <= half; x += 8) rect(x, -(riverW(x) + 8), 9, 16, 'rgba(0,0,0,0.6)');
    g.restore();
    // bases, the town, the monastery's terraces, the mill's yard, the groves
    disc(0, -BASE, 36, mix(0, 0, 0.6));
    disc(0, -66, 66, mix(0, 0, 0.55)); rect(-14, -80, 30, 24, mix(1, 0, 0)); rect(0, -30, 56, 22, mix(0.6, 0, 0.1));
    disc(-LANE, ROW, 100, mix(0, 0, 0.22)); disc(-LANE, ROW, 40, mix(0, 0, 0.45));
    disc(LANE, ROW, 30, mix(0, 0, 0.6)); disc(LANE - 16, ROW - 12, 6, mix(1, 0, 0));
    for (const [x, z, w, d] of GROVES) rect(x, z, w, d, mix(0, 0, 0.3));
    // the ford's shingle, and dirt under the tracks
    rect(LANE, -24, 56, 48, mix(0, 0.8, 0));
    for (const rd of this.roads) if (rd.kind === 'track') { const pts = rd.points.filter(p => p[1] <= 0); if (pts.length >= 2) stroke(pts, 8, mix(0, 0, 0.7)); }   // the south tracks (the stroke mirrors them)
  },
};
