import { rand } from '../../core/layout.js';
import { smooth } from '../../core/math.js';
import { makeKit } from './kit.js';

// "Narva" (blockout): 3 km of the Estonia-Russia border at Narva, compressed to about 0.6 of the real distances. The Narva
// River runs south to north just east of the middle, from the reservoir over the dam, round Kreenholm island and its falls,
// under the railway bridge and the Friendship Bridge. Narva fills the west bank, Ivangorod the east. Three lanes: the dam
// (south) and the Friendship Bridge (north) take armour; the dry falls at Kreenholm and the railway bridge (middle) only
// infantry. Nine places, three to a row: BLUFOR's on the Narva bank, three neutral on the crossings, OPFOR's on the
// Ivangorod bank. The city kit (panel blocks, point blocks, garages, pine and birch, track, wagons, platforms, the truss bridge,
// Balti's banded chimneys) follows the user's voxel diorama; Hermann Castle, Ivangorod Fortress, the Kreenholm mills, the Town Hall
// and both stations, and the hydro station (its dam, hall and switchyard) follow their own references.
//
// Laid out in real east/north metres (e, n). In this engine +x shows on screen-left when the camera faces north (+z), so
// east is -x: P(e, n) gives world [x, z], and every position below goes through it.
const P = (e, n) => [-e, n];
const at = (e, n, o = {}) => ({ x: -e, z: n, ...o });

const BASE_E = 1050, BASE_N = -200;
// the river's centre line (kept within 25 m of e = 0, where the crossing gate runs) and its carve half-width per point
// (open water is about 0.78 of it): wide at Kreenholm, where the islands split it
const RIVER = [[0, -1500, 60], [0, -1150, 60], [-8, -900, 58], [-12, -780, 150], [-12, -650, 155], [-8, -530, 150], [0, -400, 58], [0, -50, 56], [8, 250, 56], [0, 450, 56], [-18, 800, 58], [10, 1150, 58], [22, 1500, 60]];
const riverE = (n) => { for (let i = 0; i < RIVER.length - 1; i++) if (n <= RIVER[i + 1][1]) { const t = (n - RIVER[i][1]) / (RIVER[i + 1][1] - RIVER[i][1]); return [RIVER[i][0] + (RIVER[i + 1][0] - RIVER[i][0]) * t, RIVER[i][2] + (RIVER[i + 1][2] - RIVER[i][2]) * t]; } return [RIVER.at(-1)[0], RIVER.at(-1)[2]]; };
const RESERVOIR = { e: 0, n: -1650, r: 600, h: -14 };   // a basin below the water level south of the dam

const DAM_N = -1100, FALLS_N = -650, RAIL_N = -50, BRIDGE_N = 450;
// the line runs dead straight over the railway bridge's deck (e -62 to 62) and 36 m beyond each end, so track and truss line up
const RAIL = [[-1500, -190], [-900, -140], [-560, -110], [-250, -70], [-98, RAIL_N], [-64, RAIL_N], [64, RAIL_N], [98, RAIL_N], [250, -55], [560, -60], [1000, -100], [1500, -150]];
const railAt = (e) => { for (let i = 0; i < RAIL.length - 1; i++) if (e <= RAIL[i + 1][0]) { const [e0, n0] = RAIL[i], [e1, n1] = RAIL[i + 1], k = (n1 - n0) / (e1 - e0); return [n0 + k * (e - e0), k]; } return [RAIL.at(-1)[1], 0]; };   // the line's n at e, and its slope
// the two towns as outlines (e, n): Narva's blocks stop short of the main base; Ivangorod is smaller
const NARVA = [[-960, 520], [-740, 760], [-200, 760], [-90, 540], [-90, -330], [-260, -600], [-620, -720], [-940, -650], [-960, -300]];
const IVANGOROD = [[150, 760], [560, 780], [900, 600], [930, -250], [700, -380], [150, -300]];
const inPoly = (poly, e, n) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ei, ni] = poly[i], [ej, nj] = poly[j]; if ((ni > n) !== (nj > n) && e < (ej - ei) * (n - ni) / (nj - ni) + ei) c = !c; } return c; };

export const narva3km = {
  name: 'Narva', size: 3000,
  nav: { foot: 2, vehicle: 3, cap: 260000 },   // a 3 km grid: 2.25 M infantry cells and 1 M vehicle cells (about 95 MB with the search arrays)
  splatRes: 1536,
  ground: { base: 'meadow', baseSize: 4, tiles: ['concrete', 'asphalt', 'dirt', 'meadow'], tileSize: [16, 4, 4, 4] },   // the fourth weight is the meadow itself (see paintSplat)
  bases: [at(-BASE_E, BASE_N, { team: 0, r: 42 }), at(BASE_E, BASE_N, { team: 1, r: 42 })],
  // BLUFOR's row south to north, the river row south to north, OPFOR's row north to south (so ?swap=1 pairs each with its
  // counterpart)
  locations: [
    at(-480, -1000, { name: 'Balti Plant', r: 38, home: 0 }),
    at(-560, -90, { name: 'Narva Station', r: 34, home: 0 }),
    at(-330, 580, { name: 'Old Town', r: 38, home: 0 }),
    at(40, FALLS_N, { name: 'Kreenholm', r: 36 }),
    at(0, RAIL_N, { name: 'Rail Bridge', r: 28 }),
    at(0, BRIDGE_N, { name: 'Friendship Bridge', r: 30 }),
    at(330, 540, { name: 'Ivangorod Fortress', r: 38, home: 1 }),
    at(560, -70, { name: 'Ivangorod Station', r: 34, home: 1 }),
    at(480, -1000, { name: 'Narva HES', r: 36, home: 1 }),
  ],
  links: [['Balti Plant', 'Narva Station'], ['Narva Station', 'Old Town'], ['Kreenholm', 'Rail Bridge'], ['Rail Bridge', 'Friendship Bridge'],
    ['Narva HES', 'Ivangorod Station'], ['Ivangorod Station', 'Ivangorod Fortress'], ['Balti Plant', 'Kreenholm'], ['Narva Station', 'Rail Bridge'],
    ['Old Town', 'Friendship Bridge'], ['Kreenholm', 'Narva HES'], ['Rail Bridge', 'Ivangorod Station'], ['Friendship Bridge', 'Ivangorod Fortress']],
  roads: [
    // roads cross the Friendship Bridge (e -66 to 66) and the dam (e -70 to 70) dead straight, with a straight lead-in at each end that
    // the smoothing leaves on the line, so the asphalt lies on the deck
    { points: [[-1500, 320], [-1200, 240], [-900, 450], [-450, 640], [-190, 470], [-98, BRIDGE_N], [-66, BRIDGE_N], [66, BRIDGE_N], [98, BRIDGE_N], [190, 470], [450, 560], [900, 350], [1200, 240], [1500, 300]].map(p => P(...p)), width: 12, tex: 'road' },   // Tallinn to Saint Petersburg over the Friendship Bridge
    { points: [[-450, 640], [-560, -90], [-560, -760], [-480, -1000], [-220, -1080], [-104, DAM_N], [-70, DAM_N], [70, DAM_N], [104, DAM_N], [300, -1060], [480, -1000], [560, -70], [450, 560]].map(p => P(...p)), width: 9, tex: 'road' },   // the ring: both stations, the plant, the dam, the HES
    { points: [[-BASE_E, BASE_N], [-700, -190], [-590, -150], [-560, -90]].map(p => P(...p)), width: 9, tex: 'road' },
    { points: [[BASE_E, BASE_N], [700, -190], [590, -150], [560, -70]].map(p => P(...p)), width: 9, tex: 'road' },
    { points: [[-BASE_E, BASE_N], [-1100, 120], [-1200, 240]].map(p => P(...p)), width: 9, tex: 'road' },
    { points: [[BASE_E, BASE_N], [1100, 120], [1200, 240]].map(p => P(...p)), width: 9, tex: 'road' },
    { points: [[-560, -90], [-300, -60], [-120, RAIL_N]].map(p => P(...p)), width: 5, tex: 'track', kind: 'track' },   // the foot lane to the railway bridge
    { points: [[-480, -1000], [-300, -760], [-150, FALLS_N]].map(p => P(...p)), width: 5, tex: 'track', kind: 'track' },   // and to the falls
    { points: [[110, RAIL_N], [300, -30], [560, -25]].map(p => P(...p)), width: 5, tex: 'track', kind: 'track' },
    { points: [[128, FALLS_N], [175, FALLS_N], [320, -800], [480, -1000]].map(p => P(...p)), width: 5, tex: 'track', kind: 'track' },   // off the Kreenholm footbridge's end
  ],
  // the Tallinn-Saint Petersburg line through both stations and over the railway bridge
  rail: RAIL.map(p => P(...p)),
  terrain: {
    water: -3, wade: 0.8,
    features: [
      // the high limestone banks under the castle and the fortress, notched where the road comes down to the bridge
      { type: 'ridge', x1: P(-95, 150)[0], z1: 150, x2: P(-95, 780)[0], z2: 780, w: 34, h: 11, p: 0.7, jag: 0.35, cuts: [{ x: P(-95, BRIDGE_N)[0], z: BRIDGE_N, r: 42, len: 60 }] },
      { type: 'ridge', x1: P(95, 150)[0], z1: 150, x2: P(95, 780)[0], z2: 780, w: 34, h: 11, p: 0.7, jag: 0.35, cuts: [{ x: P(95, BRIDGE_N)[0], z: BRIDGE_N, r: 42, len: 60 }] },
      { type: 'hill', x: -RESERVOIR.e, z: RESERVOIR.n, r: RESERVOIR.r, h: RESERVOIR.h, p: 1 },
      // Balti's ash hills, the plant's high ground
      ...[[-700, -1130, 90, 22], [-820, -960, 70, 16], [-640, -1250, 70, 14]].map(([e, n, r, h]) => ({ type: 'hill', x: -e, z: n, r, h, p: 0.8, jag: 0.25 })),
      // rolling country between the towns and the edges
      ...[[-1250, 900, 160, 14], [-1300, -900, 150, 12], [1250, 900, 160, 14], [1300, -900, 150, 12], [-850, 1150, 120, 9], [850, 1150, 120, 9], [-1000, -1350, 110, 8], [1000, -1350, 110, 8], [0, 1250, 140, 10]].map(([e, n, r, h]) => ({ type: 'hill', x: -e, z: n, r, h, p: 0.8, jag: 0.5 })),
    ],
    rivers: [{ path: RIVER.map(([e, n]) => P(e, n)), ws: RIVER.map(r => r[2]), w: 58, depth: 8 }],
    fords: [
      { x1: -40, z1: -760, x2: -40, z2: -545, r: 38, m: 10, bed: 1.0 },     // Kreenholm island (e 40), the mills
      { x1: 62, z1: -715, x2: 62, z2: -600, r: 17, m: 8, bed: 1.0 },        // Joala island (e -62)
      { x1: 20, z1: -700, x2: 20, z2: -610, r: 18, m: 8, bed: -3.4 },       // the shallows between them, waded
      { x1: 100, z1: -735, x2: 100, z2: -565, r: 24, m: 10, bed: -2.4 },    // the dry falls: the western channel, a rock bed above the water since the dam took it
    ],
  },
  // the river is crossed only at its portals (nav.js gates, running north-south here): the dam, the falls (infantry, through
  // Joala, the shallows and Kreenholm), the railway bridge (infantry) and the Friendship Bridge
  gateAxis: 'x',
  gates: [{ at: 0, portals: [{ x: DAM_N, d: 85 }, { x: FALLS_N, d: 40, foot: true }, { x: RAIL_N, d: 72, foot: true }, { x: BRIDGE_N, d: 78 }] }],
  // where tank traps close a crossing: both ends of the Friendship Bridge and of the dam
  chokes: [P(-78, BRIDGE_N), P(78, BRIDGE_N), P(-82, DAM_N), P(82, DAM_N)],
  bridges: [
    at(0, BRIDGE_N, { len: 132, w: 14, angle: Math.PI / 2, y: 1.3 }),          // Friendship Bridge
    at(0, RAIL_N, { len: 124, w: 6, angle: Math.PI / 2, y: 1.6, foot: true, truss: true }),  // railway bridge: a blue truss of two spans, walked by infantry
    at(0, DAM_N, { len: 140, w: 12, angle: Math.PI / 2, y: 5.0 }),              // the dam's crest road, 8 m over the water, ramps at both ends
    at(102, FALLS_N, { len: 52, w: 6, angle: Math.PI / 2, y: 1.0, foot: true }),  // Kreenholm to the east bank (6 m: a 4 m deck's railings close every 2 m cell)
  ],
  flats: [
    at(-BASE_E, BASE_N, { r: 50, m: 25 }), at(BASE_E, BASE_N, { r: 50, m: 25 }),
    at(-560, -90, { r: 70, m: 20 }), at(560, -70, { r: 60, m: 20 }), at(-330, 580, { r: 50, m: 20 }), at(330, 540, { r: 50, m: 20 }), at(-480, -1000, { r: 90, m: 25 }), at(480, -1000, { r: 60, m: 20 }),
    at(-80, BRIDGE_N, { r: 20, m: 14, y: 1.0 }), at(80, BRIDGE_N, { r: 20, m: 14, y: 1.0 }), at(-76, RAIL_N, { r: 16, m: 12, y: 1.2 }), at(76, RAIL_N, { r: 16, m: 12, y: 1.2 }),
    at(-82, DAM_N, { r: 18, m: 32, y: 4.7 }), at(82, DAM_N, { r: 18, m: 32, y: 4.7 }),   // the dam's ramps: 4 m over 32 m, a 1 in 8
    at(-165, 390, { r: 42, m: 16 }), at(190, 380, { r: 66, m: 16 }),   // level ground for the castle and the fortress
  ],

  build() {
    const r = rand(1704), rd = rand(3251), strips = [];
    const lines = this.roads.map(rd => ({ P: smooth(rd.points, 2), clear: rd.width / 2 + 3 })).concat([{ P: this.rail, clear: 7 }]);
    const near = (x, z, Pl, clear) => { for (let i = 0; i < Pl.length - 1; i++) { const [ax, az] = Pl[i], [bx, bz] = Pl[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < clear) return true; } return false; };
    const onRoad = (x, z, extra = 0) => lines.some(l => near(x, z, l.P, l.clear + extra));
    const wet = (x, z, margin = 6) => { const [ce, w] = riverE(z), e = -x; return Math.abs(e - ce) < w * 0.78 + margin || Math.hypot(e - RESERVOIR.e, z - RESERVOIR.n) < RESERVOIR.r * 0.9 + margin; };
    const K = makeKit({ r, rd, onRoad: (x, z) => onRoad(x, z) });
    const { props, obstacles, box, part, house, sandbagRing, containers, floodlight, watchtower, damWorks, hydroHall, switchyard, townHall, stationBuilding, car, fountain, hermannCastle, fortress, millBuilding, millRace, panelBlock, panelTower, garages, pine, birch, boxcar, tankWagon, platform, chimney } = K;
    const placed = [], take = (x, z, rad) => placed.push([x, z, rad]);
    // long blocks keep rectangles, not circles (a circle round a 60 m block would clear a whole street of neighbours)
    const rects = [], rectOf = (x, z, w, d) => [x - w / 2, x + w / 2, z - d / 2, z + d / 2];
    const dRect = (px, pz, [x0, x1, z0, z1]) => Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(z0 - pz, 0, pz - z1));
    const busy = (x, z, rad) => onRoad(x, z, rad) || wet(x, z, rad) || this.locations.some(l => Math.hypot(x - l.x, z - l.z) < l.r + 12 + rad) || this.bases.some(b => Math.hypot(x - b.x, z - b.z) < 70 + rad)
      || placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + rad + 3) || rects.some(R => dRect(x, z, R) < rad + 3);
    // room for a w x d block (axis-aligned) with m metres round it: clear of the roads and water along its edges, the places,
    // the bases, everything placed
    const roomRect = (x, z, w, d, m) => {
      const R = rectOf(x, z, w, d), M = rectOf(x, z, w + 2 * m, d + 2 * m);
      if (rects.some(Q => Q[0] < M[1] && Q[1] > M[0] && Q[2] < M[3] && Q[3] > M[2]) || placed.some(([px, pz, pr]) => dRect(px, pz, R) < pr + m)) return false;
      if (this.locations.some(l => dRect(l.x, l.z, R) < l.r + 12) || this.bases.some(b => dRect(b.x, b.z, R) < 70)) return false;
      const nu = Math.ceil(w / 10), nv = Math.ceil(d / 10);
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const px = R[0] + (R[1] - R[0]) * i / nu, pz = R[2] + (R[3] - R[2]) * j / nv; if (onRoad(px, pz, 3) || wet(px, pz, 4)) return false; }
      return true;
    };
    const takeRect = (x, z, w, d) => rects.push(rectOf(x, z, w, d));
    const B = (e, n, w, h, d, color, rot = 0) => { const [x, z] = P(e, n); box(w, h, d, color, x, z, { rot }); take(x, z, Math.hypot(w, d) / 2); };   // a plain block, w along east

    // ---- main bases: a sandbag perimeter, containers, lights and a tower
    for (const b of this.bases) { sandbagRing(b.x, b.z, 30, Math.atan2(-b.z, -b.x)); containers(b.x - 30, b.z + 12, 3, 2); floodlight(b.x - 18, b.z - 16); floodlight(b.x + 18, b.z + 16); watchtower(b.x + 22, b.z - 22, 5, 10); take(b.x, b.z, 40); }

    // ---- landmarks: Hermann Castle and Ivangorod Fortress either side of the Friendship Bridge and Kreenholm's mills, after the
    // user's voxel references, like the Town Hall, the stations and the hydro station below
    { const [cx, cz] = P(-165, 385); hermannCastle(cx, cz, 0); take(cx, cz, 54); }          // Hermann Castle: its gate faces the town, Tall Hermann the bridge
    { const [fx, fz] = P(190, 380); fortress(fx, fz, 80, 110, 0); take(fx, fz, 80); }         // Ivangorod Fortress: a riverside tower, its gate on the town side
    { const [tx, tz] = P(-330, 640); townHall(tx, tz, 0); take(tx, tz, 32); }               // the Town Hall on the square's north side, its stair down to the square
    { const m1 = P(40, -705), m2 = P(40, -592);                                                // Kreenholm: two mills fronting the falls, a boiler house and its chimney, the race
      millBuilding(m1[0], m1[1], 64, 6, -Math.PI / 2, 20); take(m1[0], m1[1], 34); millBuilding(m2[0], m2[1], 50, 5, -Math.PI / 2, 18); take(m2[0], m2[1], 28);
      B(64, -650, 12, 9, 26, 0x93432f); const [cx, cz] = P(68, -632); props.push({ geo: 'cyl:1.7,2.4,46,12', color: 0x8a3c2a, x: cx, y: 23, z: cz, rot: [0, 0, 0], cast: true }); obstacles.push({ minX: cx - 2.4, maxX: cx + 2.4, minZ: cz - 2.4, maxZ: cz + 2.4, h: 46 });
      const [rx, rz] = P(86, -705); millRace(rx, rz, 56, -Math.PI / 2); }
    // the two stations, their entrances facing the towns, their backs to the platforms; Narva's forecourt with a fountain and cars
    { const [sx, sz] = P(-650, -88); stationBuilding(sx, sz, Math.PI, 22); take(sx, sz, 34); const [fx, fz] = P(-650, -58); fountain(fx, fz); take(fx, fz, 4);
      for (const [e, n, r0] of [[-688, -62, 0], [-694, -55, 0.1], [-612, -63, Math.PI], [-605, -56, Math.PI + 0.06]]) { const [cx, cz] = P(e, n); car(cx, cz, r0); take(cx, cz, 3); } }
    { const [sx, sz] = P(650, -40); stationBuilding(sx, sz, Math.PI, 10); take(sx, sz, 24); }
    // the yards: a platform on the station side of the main line, sidings on the other with trains of boxcars and tank wagons
    const onLine = (e, off) => { const [n, k] = railAt(e), [x, z] = P(e, n + off); return { x, z, rot: Math.atan2(-k, -1) }; };
    const siding = (e0, e1, off) => { const a = onLine(e0, off), b = onLine(e1, off); for (const u of [-0.76, 0.76]) part((a.x + b.x) / 2, (a.z + b.z) / 2, a.rot, 0, 0.25, u, Math.hypot(b.x - a.x, b.z - a.z), 0.16, 0.12, 0x55504a); strips.push({ points: [[a.x, a.z], [b.x, b.z]], width: 5, tex: 'railway', vRepeat: 5, smooth: 0, y: 0.04, cutout: true }); };
    const train = (e0, n, off) => { for (let i = 0; i < n; i++) { const w = onLine(e0 + i * 14.6, off); (rd() < 0.45 ? tankWagon : boxcar)(w.x, w.z, w.rot); } };
    for (const [e, off] of [[-650, 6], [650, 6]]) { const p = onLine(e, off); platform(p.x, p.z, 90, p.rot + Math.PI, true); take(p.x, p.z, 46); }   // turned so its yellow edge faces the track
    for (const [e0, e1, off, trains] of [[-810, -610, -7, [[-800, 6], [-700, 4]]], [-520, -370, -7, [[-510, 5]]], [-800, -620, -13, [[-790, 9]]], [380, 530, -7, [[390, 5]]], [620, 780, -7, [[630, 6]]], [620, 780, -13, [[640, 7]]]]) {
      siding(e0, e1, off); for (const [s0, k] of trains) train(s0, k, off);
      const m = onLine((e0 + e1) / 2, off); take(m.x, m.z, (e1 - e0) / 2 + 6);
    }
    { const [hx, hz] = P(-480, -1070), th = 0.32;                                                                          // Balti: a brick turbine hall under a red gable roof, four banded chimneys, the coal store
      box(120, 30, 40, 0x9a4430, hx, hz); take(hx, hz, 64);
      for (const s of [-1, 1]) props.push({ geo: 'box:1,1,1', color: 0xc9572f, scale: [122, 0.5, 21.6], x: hx, y: 30 + 20 * Math.tan(th) / 2, z: hz + s * 10, rot: [s * th, 0, 0], cast: true, ax: hx, az: hz });
      for (const u of [-40, -10, 20, 45]) part(hx, hz, 0, u, 36.4, 0, 5, 2.2, 3, 0x8a8f92);   // roof vents
      for (const [k, h] of [[0, 150], [1, 120], [2, 150], [3, 100]]) { const [x, z] = P(-560 + k * 45, -1120); chimney(x, z, h, k % 2 ? 3.6 : 4.4); take(x, z, 6); }
      B(-380, -930, 50, 12, 30, 0x7d7a74); }
    { const [hx, hz] = P(150, -1040); hydroHall(hx, hz, 0); take(hx, hz, 30);                 // the hydro station: its hall facing the river, the switchyard behind it,
      const [sx, sz] = P(165, -990); switchyard(sx, sz, 0); take(sx, sz, 22);                   // rocks breaking the tailwater below the dam
      for (const [e, n, k] of [[-34, -1082, 5], [28, -1086, 4], [-8, -1074, 3]]) for (let i = 0; i < k; i++) {
        const [x, z] = P(e + (rd() - 0.5) * 9, n + (rd() - 0.5) * 7), w = 2 + rd() * 2.5, top = -2.4 + rd() * 1.4;
        props.push({ geo: 'box:1,1,1', color: [0x8c857a, 0x7a7368, 0x9a9388][i % 3], scale: [w, top + 8, w * (0.7 + rd() * 0.5)], x, y: (top - 8) / 2, z, rot: [0, rd() * Math.PI, 0], cast: true, absY: true });
      } }

    // ---- the towns: Soviet blocks of five storeys (15 m) and nine (27 m) on a loose grid, long sides east-west, grass between;
    // Old Town's four-storey blocks closer together; Ivangorod mostly houses, a few blocks
    const blocks = (poly, cellE, cellN, odds) => {
      for (let n = -900; n <= 900; n += cellN) for (let e = -1000; e <= 1000; e += cellE) {
        const ee = e + (r() - 0.5) * 16, nn = n + (r() - 0.5) * 12, roll = r(); if (!inPoly(poly, ee, nn)) continue;
        const nine = roll < odds.nine, park = roll > 1 - odds.park, len = nine ? 70 + Math.floor(r() * 3) * 10 : 45 + Math.floor(r() * 3) * 10, turned = r() < 0.25;
        const w = turned ? 12 : len, d = turned ? len : 12, [x, z] = P(ee, nn);
        if (park) {   // a yard: a row of lock-up garages, or a few trees
          const nG = 4 + Math.floor(r() * 5), gw = turned ? 7 : nG * 3.4, gd = turned ? nG * 3.4 : 7;
          if (r() < 0.55 && roomRect(x, z, gw, gd, 6)) { garages(x, z, nG, turned ? Math.PI / 2 : 0); takeRect(x, z, gw, gd); }
          else for (let k = 0; k < 6; k++) { const tx = x + (r() - 0.5) * 40, tz = z + (r() - 0.5) * 24; if (!busy(tx, tz, 2)) { (r() < 0.5 ? pine : birch)(tx, tz, 8 + r() * 5); take(tx, tz, 2); } }
          continue;
        }
        if (nine && r() < 0.35) { if (!roomRect(x, z, 18, 18, 10)) continue; panelTower(x, z, r() < 0.5 ? 0 : Math.PI); takeRect(x, z, 18, 18); continue; }
        if (!roomRect(x, z, w + 2, d + 6, 9)) continue;
        panelBlock(x, z, len, nine ? 9 : 5, turned ? Math.PI / 2 : (r() < 0.5 ? 0 : Math.PI)); takeRect(x, z, w + 2, d + 6);
      }
    };
    blocks(NARVA, 64, 36, { nine: 0.3, park: 0.16 });
    { const oldTown = [[-520, 460], [-520, 740], [-180, 740], [-150, 470]];
      for (let n = 470; n <= 740; n += 30) for (let e = -520; e <= -150; e += 50) { const [x, z] = P(e + (r() - 0.5) * 6, n); if (!inPoly(oldTown, e, n) || !roomRect(x, z, 42, 18, 6)) continue; panelBlock(x, z, 40, 4, r() < 0.5 ? 0 : Math.PI); takeRect(x, z, 42, 18); } }
    for (let n = -300; n <= 760; n += 38) for (let e = 160; e <= 930; e += 38) {
      const ee = e + (r() - 0.5) * 14, nn = n + (r() - 0.5) * 14, roll = r(); if (!inPoly(IVANGOROD, ee, nn) || roll < 0.35) continue;
      const [x, z] = P(ee, nn);
      if (roll > 0.9) { if (roomRect(x, z, 50, 18, 8)) { panelBlock(x, z, 48, 5, r() < 0.5 ? 0 : Math.PI); takeRect(x, z, 50, 18); } continue; }
      const w = 7 + Math.floor(r() * 3), d = 7 + Math.floor(r() * 3); if (busy(x, z, 6)) continue;
      house(x, z, w, d, r() < 0.3 ? 2 : 1, (r() < 0.5 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.1, P(450, 200)); take(x, z, 6);
    }

    // ---- woods and copses: pine and birch, thinner near the towns; trees block sight like any tall box
    const tree = (x, z) => {
      if (busy(x, z, 1.5) || inPoly(NARVA, -x, z) || inPoly(IVANGOROD, -x, z)) return;
      if (rd() < 0.55) pine(x, z, 9 + rd() * 5); else birch(x, z, 7 + rd() * 4);
    };
    for (let i = 0; i < 70; i++) {   // copses: a centre, a radius, a density
      const ce = (r() - 0.5) * 2900, cn = (r() - 0.5) * 2900, rad = 30 + r() * 70, k = Math.round(rad * rad / 260);
      for (let j = 0; j < k; j++) { const a = r() * Math.PI * 2, dd = Math.sqrt(r()) * rad, [x, z] = P(ce + Math.cos(a) * dd, cn + Math.sin(a) * dd); if (Math.abs(x) < 1480 && Math.abs(z) < 1480) tree(x, z); }
    }
    for (let i = 0; i < 260; i++) { const [x, z] = P((r() - 0.5) * 2900, (r() - 0.5) * 2900); tree(x, z); }   // single trees

    // ---- the railway: ballast under two rails
    const onDeck = (i) => Math.abs(this.rail[i][0]) <= 64 && Math.abs(this.rail[i + 1][0]) <= 64;   // the truss carries its own sleepers and rails there
    for (let i = 0; i < this.rail.length - 1; i++) {
      if (onDeck(i)) continue;
      const [ax, az] = this.rail[i], [bx, bz] = this.rail[i + 1], len = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      for (const s of [-0.76, 0.76]) part(mx, mz, rot, s, 0.25, 0, 0.12, 0.16, +len.toFixed(2), 0x55504a);
    }
    for (const b of this.bridges) K.bridge(b, 0.15);
    damWorks(this.bridges.find(b => b.z === DAM_N));   // the dam's body, gates and white water under its crest road
    for (const rd of this.roads) strips.push({ points: rd.points, width: rd.width, tex: rd.tex === 'road' ? 'roadM' : 'trackM', vRepeat: rd.tex === 'road' ? 12 : 5, smooth: 2, y: rd.tex === 'road' ? 0.03 : 0.02, cutout: true });   // edges drifting into grass
    { const k = this.rail.findIndex((p, i) => i < this.rail.length - 1 && onDeck(i));   // the ground track either side of the bridge, not over its deck
      for (const pts of [this.rail.slice(0, k + 1), this.rail.slice(k + 1)]) strips.push({ points: pts, width: 5, tex: 'railway', vRepeat: 5, smooth: 0, y: 0.04, cutout: true }); }
    return { props, obstacles, lamps: K.lamps, tufts: K.tufts, decals: K.decals, strips };
  },

  // The splat map: r concrete, g asphalt, b dirt, and a the meadow. The ground shader adds the four weights without
  // normalising, and a canvas fill's alpha is the fourth weight, so each fill here is a mix (c, a, d) of the first three with
  // alpha 1 - (c + a + d): the grass that is left. Mixes stay at 0.92 or below, or the fill's colour would be lost at alpha 0.
  paintSplat(g, px, half) {
    const ppm = px / (half * 2), X = (e) => (-e + half) * ppm, Z = (n) => (half - n) * ppm;
    const mix = (c, a, d) => `rgba(${Math.round(c * 255)},${Math.round(a * 255)},${Math.round(d * 255)},${(1 - c - a - d).toFixed(3)})`;
    g.clearRect(0, 0, px, px);
    const disc = (e, n, rad, style) => { g.fillStyle = style; g.beginPath(); g.arc(X(e), Z(n), rad * ppm, 0, Math.PI * 2); g.fill(); };
    const rect = (e, n, w, d, style) => { g.fillStyle = style; g.fillRect(X(e) - w * ppm / 2, Z(n) - d * ppm / 2, w * ppm, d * ppm); };
    const stroke = (pts, width, style) => { g.strokeStyle = style; g.lineWidth = width * ppm; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(-x), Z(z)) : g.moveTo(X(-x), Z(z))); g.stroke(); };
    // ploughed and mown fields in the country
    const fr = rand(91);
    for (let i = 0; i < 46; i++) { const e = (fr() - 0.5) * 2800, n = (fr() - 0.5) * 2800; if (inPoly(NARVA, e, n) || inPoly(IVANGOROD, e, n) || Math.abs(e) < 200) continue; rect(e, n, 80 + fr() * 140, 50 + fr() * 90, fr() < 0.5 ? mix(0, 0, 0.7) : mix(0, 0, 0.35)); }
    disc(-330, 580, 55, mix(0.85, 0, 0)); disc(330, 540, 45, mix(0.6, 0, 0.2));                                         // Old Town's square, Ivangorod's
    rect(190, 380, 76, 106, mix(0.55, 0.12, 0.15));                                                                         // the fortress's court
    rect(-600, -118, 300, 46, mix(0.4, 0.45, 0)); rect(600, -70, 260, 40, mix(0.4, 0.45, 0));                             // station yards: grey gravel
    rect(-650, -66, 100, 36, mix(0.85, 0, 0)); rect(650, -24, 60, 22, mix(0.8, 0, 0));                                     // the stations' forecourts
    stroke(this.rail, 8, mix(0.35, 0.45, 0));
    rect(-480, -1040, 220, 170, mix(0.8, 0, 0)); rect(150, -1040, 58, 34, mix(0.75, 0, 0)); rect(165, -990, 44, 22, mix(0.45, 0.35, 0));   // the plant's yard, the hydro hall's, the switchyard's gravel
    for (const [e, n, rad] of [[-700, -1130, 80], [-820, -960, 62], [-640, -1250, 62]]) disc(e, n, rad, mix(0.6, 0.2, 0));   // grey ash
    rect(-100, FALLS_N, 40, 180, mix(0.5, 0, 0.4));                                                                         // the dry falls' rock bed
    for (const b of this.bases) disc(-b.x, b.z, 36, mix(0.3, 0, 0.6));
  },
};
