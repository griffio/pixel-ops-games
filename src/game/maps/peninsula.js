import { rand } from '../../core/layout.js';
import { smooth } from '../../core/math.js';
import { coastDistance } from '../../core/terrain.js';
import { makeKit } from './kit.js';

// "Peninsula" (plan 2026-10-28; P1 blockout, P2 the ship and its landing craft): 1.2 km of a rocky peninsula running north into
// the sea, cut off from the mainland by a canal across its neck with a single bridge. Invasion only: the attacker comes from the
// sea (its main base is an assault ship off the west coast: helicopters on the flight deck, everything else run ashore by landing
// craft, game/landing.js), the defender from its base on the mainland, over the bridge. Cliffs ring the coast except at three landings: West Beach (sand, vehicles), North Cove (a
// notch under the cliffs, infantry) and the harbour quay on the east coast. Five places: the three landings (the attacker's
// home places, so it may land anywhere first), Radar Hill in the middle, and the Bridgehead at the peninsula end of the bridge.
//
// Laid out in real east/north metres (e, n), as Narva is: facing north this engine shows +x on screen-left, so east is -x and
// every position goes through P(e, n).
const P = (e, n) => [-e, n];
const at = (e, n, o = {}) => ({ x: -e, z: n, ...o });
const W = (pts) => pts.map(p => P(...p));

const LIFT = 6, CANAL_N = -351;   // the land stands 6 m over its base height (the sea 3 m under it); the canal's middle
// the coastlines, (e, n): the peninsula from the canal's west end round the north tip, and the mainland past the map's edges
const PEN = [[-110, -330], [-130, -200], [-200, -100], [-290, -30], [-310, 20], [-325, 80], [-318, 150], [-290, 220], [-240, 290], [-215, 320], [-180, 300], [-150, 318], [-120, 380], [-60, 420], [0, 450], [60, 470], [110, 445], [180, 380], [260, 300], [310, 220], [330, 140], [335, 80], [310, 60], [300, 0], [320, -40], [280, -110], [200, -170], [130, -230], [110, -330]];
const MAIN = [[-700, -380], [-320, -395], [-160, -375], [-110, -372], [110, -372], [170, -378], [330, -398], [700, -385], [700, -700], [-700, -700]];
const LAND = [W(PEN), W(MAIN)];
const BEACH = [[-310, 20], [-325, 80], [-318, 150]], COVE = [[-180, 300], [-150, 318]], QUAY = [[310, 60], [300, 0]];
const SHIP = { e: -470, n: 300, len: 150, beam: 28, deck: 7.6 };
// the landing craft's lanes (e, n) from off the stern gate to each beach, and where men muster up the beach
const LANES = [
  { name: 'West Beach', place: 'Village', vehicles: true, path: [[-470, 190], [-455, 160], [-410, 120], [-350, 95], [-331, 88]], muster: [-290, 92] },
  { name: 'North Cove', place: 'Lighthouse', vehicles: false, path: [[-470, 190], [-440, 205], [-425, 300], [-390, 385], [-280, 405], [-205, 365], [-167, 322]], muster: [-160, 290] },
  { name: 'Harbour quay', place: 'Harbour', vehicles: true, path: [[-470, 190], [-440, 205], [-428, 300], [-425, 420], [-300, 545], [0, 560], [220, 495], [380, 345], [420, 190], [445, 40], [365, -12], [318, 28]], muster: [282, 30] },
];

export const peninsula = {
  name: 'Peninsula', size: 1200, mode: 'invasion',
  splatRes: 1024,
  ground: { base: 'meadow', baseSize: 4, tiles: ['concrete', 'sand', 'dirt', 'meadow'], tileSize: [16, 4, 4, 4] },   // the fourth weight is the meadow itself (see paintSplat)
  bases: [at(SHIP.e, SHIP.n, { team: 0, r: 80, ship: true }), at(0, -500, { team: 1, r: 42 })],   // the attacker's assault ship; the defender's base on the mainland
  // the ship's side (game/landing.js): its well dock and the way craft leave it, three craft, the flight deck's landing spots, the lanes
  sea: { dock: P(SHIP.e, SHIP.n - 76), out: Math.PI, craft: 3, deck: [-50, -20, 10, 40].map(k => P(SHIP.e - 7, SHIP.n + k)), lanes: LANES.map(l => ({ ...l, path: W(l.path), muster: P(...l.muster) })) },
  // the attacker's landings first, then the hill, then the bridge (list order runs from team 0's side to team 1's)
  locations: [
    at(-215, 110, { name: 'Village', r: 32, home: 0 }),
    at(40, 405, { name: 'Lighthouse', r: 24, home: 0 }),
    at(250, 45, { name: 'Harbour', r: 30, home: 0 }),
    at(60, 130, { name: 'Radar Hill', r: 26 }),
    at(0, -280, { name: 'Bridgehead', r: 28, home: 1 }),
  ],
  links: [['Village', 'Radar Hill'], ['Lighthouse', 'Radar Hill'], ['Harbour', 'Radar Hill'], ['Village', 'Bridgehead'], ['Harbour', 'Bridgehead'], ['Radar Hill', 'Bridgehead']],
  roads: [
    // from the defender's base over the canal bridge (n -384 to -318, dead straight with lead-ins) to the crossroads
    { points: [[0, -560], [0, -500], [0, -420], [0, -394], [0, -384], [0, -318], [0, -308], [0, -280], [-20, -180], [-10, -80], [0, 20]].map(p => P(...p)), width: 10, tex: 'road' },
    { points: [[-600, -470], [-300, -482], [0, -470], [300, -476], [600, -466]].map(p => P(...p)), width: 9, tex: 'road' },   // the mainland's coast road
    { points: [[0, 20], [-110, 50], [-215, 110], [-262, 150]].map(p => P(...p)), width: 8, tex: 'road' },                      // to the village and the top of the beach
    { points: [[0, 20], [130, 22], [250, 45], [288, 36]].map(p => P(...p)), width: 8, tex: 'road' },                           // to the harbour
    { points: [[0, 20], [40, 80], [60, 130], [75, 230], [60, 330], [40, 400]].map(p => P(...p)), width: 6, tex: 'road' },      // over Radar Hill to the lighthouse
    { points: [[-160, 305], [-100, 350], [-20, 395], [30, 405]].map(p => P(...p)), width: 4, tex: 'track', kind: 'track' },    // the path up from North Cove
  ],
  terrain: {
    water: -3, wade: 0.8, cell: 2,   // a 2 m height grid keeps the cliffs sheer
    features: [
      { type: 'hill', ...at(60, 130), r: 150, h: 18, p: 1.3, jag: 0.15 },         // Radar Hill
      { type: 'hill', ...at(30, 420), r: 80, h: 5, p: 1 },                          // the lighthouse's headland
      ...[[-120, 220, 90, 6], [180, -100, 90, 5], [-150, -170, 70, 4], [170, 250, 70, 5], [-420, -540, 130, 10], [400, -545, 140, 12]].map(([e, n, r, h]) => ({ type: 'hill', ...at(e, n), r, h, p: 0.9, jag: 0.4 })),
    ],
    coast: {
      land: LAND, lift: LIFT, seabed: -10,
      shores: [
        ...BEACH.slice(1).map((p, i) => ({ x1: -BEACH[i][0], z1: BEACH[i][1], x2: -p[0], z2: p[1], m: 25, kind: 'beach' })),
        { x1: -COVE[0][0], z1: COVE[0][1], x2: -COVE[1][0], z2: COVE[1][1], m: 10, kind: 'cove' },
        { x1: -QUAY[0][0], z1: QUAY[0][1], x2: -QUAY[1][0], z2: QUAY[1][1], m: 8, kind: 'quay' },
      ],
    },
  },
  // the canal is crossed only at the bridge (nav.js gates: a line east-west at the canal, one portal)
  gates: [{ at: CANAL_N, portals: [{ x: 0, d: 42 }] }],
  // where tank traps go: both ends of the bridge, the top of West Beach, the harbour quay
  chokes: [P(0, -394), P(0, -308), P(-292, 60), P(-292, 120), P(282, 30)],
  bridges: [at(0, CANAL_N, { len: 66, w: 12, angle: 0, y: LIFT }),   // the canal bridge, level with the land on both sides
    at(SHIP.e, SHIP.n + 2, { len: SHIP.len + 10, w: SHIP.beam + 2, angle: 0, y: SHIP.deck, foot: true, deck: true })],   // the ship's flight deck: helicopters land on it
  flats: [
    at(0, -500, { r: 50, m: 25 }),
    at(0, -388, { r: 12, m: 16, y: LIFT }), at(0, -314, { r: 12, m: 16, y: LIFT }),   // the bridge's ends
    at(265, 30, { r: 45, m: 35, y: -1.3 }),                                             // the harbour, down to quay height
    at(40, 405, { r: 22, m: 14 }), at(60, 130, { r: 18, m: 16 }), at(-215, 110, { r: 40, m: 30 }),
  ],

  build() {
    const r = rand(4401), rd = rand(5127), strips = [];
    const lines = this.roads.map(o => ({ P: smooth(o.points, 2), clear: o.width / 2 + 3 }));
    const near = (x, z, Pl, clear) => { for (let i = 0; i < Pl.length - 1; i++) { const [ax, az] = Pl[i], [bx, bz] = Pl[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < clear) return true; } return false; };
    const onRoad = (x, z, extra = 0) => lines.some(l => near(x, z, l.P, l.clear + extra));
    const inland = (x, z) => coastDistance(LAND, x, z)[0];   // metres from the coast, + on land
    const K = makeKit({ r, rd, onRoad: (x, z) => onRoad(x, z) });
    const { props, obstacles, box, part, footprint, cyl, sandbagRing, containers, floodlight, watchtower, radioMast, pine, birch, bush, scrub } = K;
    const placed = [], take = (x, z, rad) => placed.push([x, z, rad]);
    const busy = (x, z, rad) => onRoad(x, z, rad) || inland(x, z) < rad + 8 || this.locations.some(l => Math.hypot(x - l.x, z - l.z) < l.r + 12 + rad) || this.bases.some(b => Math.hypot(x - b.x, z - b.z) < 70 + rad)
      || placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + rad + 3);
    // a box at absolute height (the ship, boats, the breakwater and sea stacks stand in water, not on the sea bed)
    const A = (x, y0, z, w, h, d, color, rot = 0, cast = true) => props.push({ geo: 'box:1,1,1', color, scale: [w, h, d], x, y: y0 + h / 2, z, rot: [0, rot, 0], cast, absY: true });

    // ---- main bases: a sandbag perimeter, containers, lights and a tower
    for (const b of this.bases.filter(b => !b.ship)) { sandbagRing(b.x, b.z, 30, Math.atan2(-b.z, -b.x)); containers(b.x - 30, b.z + 12, 3, 2); floodlight(b.x - 18, b.z - 16); floodlight(b.x + 18, b.z + 16); watchtower(b.x + 22, b.z - 22, 5, 10); take(b.x, b.z, 40); }
    for (const b of this.bridges.filter(b => !b.deck)) K.bridge(b, 0.15);

    // ---- buildings of the coast: whitewashed cottages under slate roofs stepped like voxels, a church, harbour sheds
    const WALLS = [0xebe8de, 0xdfd9cb, 0xe6e0d2, 0xcfc8b8], ROOF = [0x4f5359, 0x5a4b45, 0x464a50], DOORS = [0x3d5a6e, 0x6e3a32, 0x3f5e3f], GLASS = 0x2c3138;
    const cottage = (x, z, w, d, rot, floors = 1) => {   // ridge along local x, door and windows on the long faces, a chimney on one gable
      const Q = (lx, ly, lz, bw, bh, bd, m) => part(x, z, rot, lx, ly, lz, bw, bh, bd, m), h = 3.1 * floors;
      const wall = WALLS[Math.floor(rd() * WALLS.length)], roof = ROOF[Math.floor(rd() * ROOF.length)], du = (rd() < 0.5 ? -1 : 1) * w / 4;
      Q(0, 0, 0, w, h, d, wall); footprint(w, d, x, z, rot, h + 2.4);
      for (let k = 0; k < 4; k++) Q(0, h + k * 0.62, 0, w + 0.5, 0.62, +((d + 0.7) * (1 - k / 4.3)).toFixed(2), roof);
      Q(w / 2 - 0.8, h, 0, 0.9, 3.4, 0.9, wall); Q(w / 2 - 0.8, h + 3.4, 0, 1.0, 0.2, 1.0, 0x6b6660);
      Q(du, 0, -d / 2 - 0.04, 1.0, 2.1, 0.08, DOORS[Math.floor(rd() * DOORS.length)]);
      for (const s of [-1, 1]) for (let fl = 0; fl < floors; fl++) for (const u of [-w / 3, 0, w / 3]) if (!(s < 0 && fl === 0 && Math.abs(u - du) < 1.4)) Q(u, fl * 3.1 + 1.1, s * (d / 2 + 0.03), 0.9, 1.0, 0.06, GLASS);
    };
    const church = (x, z, rot) => {   // a nave and a square tower with a stepped spire at its west end
      const Q = (lx, ly, lz, bw, bh, bd, m) => part(x, z, rot, lx, ly, lz, bw, bh, bd, m);
      Q(0, 0, 0, 18, 6, 9, 0xd9d3c4); for (let k = 0; k < 5; k++) Q(0, 6 + k * 0.8, 0, 18.4, 0.8, +(9.8 * (1 - k / 5.4)).toFixed(2), 0x4c5056);
      Q(-11, 0, 0, 5, 13, 5, 0xcfc8b8); for (let k = 0; k < 5; k++) Q(-11, 13 + k * 1.4, 0, +(5.4 * (1 - k / 5)).toFixed(2), 1.4, +(5.4 * (1 - k / 5)).toFixed(2), 0x4c5056);
      for (const s of [-1, 1]) for (const u of [-5, 0, 5]) Q(u, 2, s * 4.53, 1.0, 2.6, 0.06, GLASS);
      Q(-13.53, 0, 0, 0.08, 3, 1.6, 0x5b3a2a); footprint(23, 9, x, z, rot, 20);
    };
    const shed = (x, z, w, d, rot, col) => {   // a harbour warehouse: corrugated walls, a low stepped roof, big doors to the quay (its -x face)
      const Q = (lx, ly, lz, bw, bh, bd, m) => part(x, z, rot, lx, ly, lz, bw, bh, bd, m);
      Q(0, 0, 0, w, 7, d, col); for (let k = 0; k < 3; k++) Q(0, 7 + k * 0.6, 0, +((w + 0.6) * (1 - k / 3.4)).toFixed(2), 0.6, d + 0.4, 0x6a6e70);
      for (const u of [-d / 4, d / 4]) Q(-w / 2 - 0.05, 0, u, 0.1, 5, 5, 0x3b3f42);
      footprint(w, d, x, z, rot, 8.8);
    };

    // ---- the village behind West Beach: cottages along its road and round the green, the church on the north side
    { const [x, z] = P(-205, 172); church(x, z, Math.PI / 2 + 0.08); take(x, z, 16); }
    for (let i = 0, n = 0; i < 400 && n < 24; i++) {
      const a = r() * Math.PI * 2, dd = 48 + r() * 70, [x, z] = P(-215 + Math.cos(a) * dd, 110 + Math.sin(a) * dd), w = 8 + Math.floor(r() * 4), dep = 5.5 + Math.floor(r() * 2);
      if (busy(x, z, 7) || Math.hypot(x - P(-300, 85)[0], z - 85) < 60) continue;   // none on the beach
      cottage(x, z, w, dep, Math.round((Math.atan2(z - 110, x - P(-215, 0)[0]) + Math.PI / 2) / (Math.PI / 2)) * Math.PI / 2 + (r() - 0.5) * 0.3); take(x, z, 7); n++;
    }

    // ---- the lighthouse on the headland: a white tower with a red band, its lantern lit at night, the keepers' cottages
    { const [x, z] = P(40, 432);
      cyl(x, z, 0, 0.5, 0, 4.0, 4.4, 1, 14, 0x9a958b);                                                // plinth
      cyl(x, z, 0, 8, 0, 2.3, 3.0, 14, 12, 0xf2f0ea); cyl(x, z, 0, 11, 0, 2.48, 2.56, 2.4, 12, 0xb33a32);   // tower, red band
      cyl(x, z, 0, 15.2, 0, 3.0, 3.0, 0.4, 12, 0x2b2d30);                                               // gallery
      props.push({ geo: 'cyl:1.6,1.6,2.2,10', color: 0x333333, emissive: 0xfff2c0, x, y: 16.5, z, rot: [0, 0, 0], cast: true, lampHead: true, ax: x, az: z });
      cyl(x, z, 0, 18.3, 0, 0.3, 2.0, 1.4, 10, 0xb33a32); K.lamps.push({ x, y: 16.5, z, color: 0xfff2c0, distance: 70 });
      footprint(8, 8, x, z, 0, 19); take(x, z, 6);
      for (const [e, n] of [[72, 398], [72, 386]]) { const [cx, cz] = P(e, n); cottage(cx, cz, 12, 6, 0, 1); take(cx, cz, 7); } }

    // ---- Radar Hill: the dome on a block, an operations hut and a mast just off the top
    { const [x, z] = P(82, 160);
      box(7, 5, 7, 0xcfcac0, x, z); cyl(x, z, 0, 6.2, 0, 4.4, 4.4, 2.4, 16, 0xf0eee8); cyl(x, z, 0, 8.4, 0, 3.4, 4.4, 2.0, 16, 0xf0eee8); cyl(x, z, 0, 10.1, 0, 1.8, 3.4, 1.4, 16, 0xf0eee8);
      const [hx, hz] = P(100, 140); box(10, 3.2, 5, 0xa8a49a, hx, hz, { rot: 0.2 }); take(x, z, 8); take(hx, hz, 6);
      const [mx, mz] = P(38, 160); radioMast(mx, mz, 26); take(mx, mz, 3); }

    // ---- the harbour: three sheds along the quay, its kerb and bollards, a breakwater with a light, boats in the basin
    for (const [e, n, w, d, col] of [[268, -2, 16, 26, 0x6f8796], [272, 90, 14, 22, 0x8c6f5a], [228, -28, 18, 18, 0x77807a]]) { const [x, z] = P(e, n); shed(x, z, w, d, 0, col); take(x, z, Math.hypot(w, d) / 2); }
    { const [x0, z0] = P(...QUAY[0]), [x1, z1] = P(...QUAY[1]), L = Math.hypot(x1 - x0, z1 - z0);
      for (let k = 2; k < L; k += 9) { const t = k / L; A(x0 + (x1 - x0) * t + 1.4, -1.3, z0 + (z1 - z0) * t, 0.5, 0.7, 0.5, 0x2b2d30); } }   // inland is +x
    const BW = [[335, 80], [372, 56], [392, 18]].map(p => P(...p));
    for (let i = 0; i < BW.length - 1; i++) { const [ax, az] = BW[i], [bx, bz] = BW[i + 1], L = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az); for (let k = 0; k <= L; k += 3.5) { const t = k / L, j = (rd() - 0.5) * 0.6; A(ax + (bx - ax) * t, -10, az + (bz - az) * t, 6 + j, 8.2 + rd() * 0.6, 4, [0x8d8880, 0x7e7a72, 0x96918a][Math.floor(rd() * 3)], rot + j * 0.3); } }
    { const [x, z] = BW.at(-1); A(x, -1.8, z, 2.2, 5.5, 2.2, 0xb33a32); A(x, 3.7, z, 1.4, 1.2, 1.4, 0xf2f0ea); }
    for (const [e, n, rot, col] of [[352, 50, 0.05, 0xb33a32], [360, 34, -0.04, 0x2f5f8a], [340, 64, 0.1, 0x3f6a46], [349, 70, 0.6, 0xc9a23a]]) {   // clear of the craft's berth at the quay   // fishing boats: hull, deck, wheelhouse, mast
      const [x, z] = P(e, n), c = Math.cos(rot), s = Math.sin(rot), Bt = (lz, y0, w, h, d, m) => A(x + lz * s, y0, z + lz * c, w, h, d, m, rot);
      Bt(0, -3.8, 3.4, 1.6, 11, col); Bt(0, -2.2, 3.0, 0.2, 10.4, 0x8a6a46); Bt(-2, -2.0, 2.2, 2.0, 2.6, 0xf2f0ea); Bt(-2, 0, 2.4, 0.2, 2.8, 0x2b2d30); Bt(2.5, -2.0, 0.18, 5.5, 0.18, 0x5a3e2a);
    }

    // ---- the assault ship off the west coast (a prop until P2 makes it the attacker's base): hull, flight deck, the island on
    // the starboard (east) side, the well dock's gate at the stern
    { const [sx, sz] = P(SHIP.e, SHIP.n), L = SHIP.len, B = SHIP.beam, x = (lx) => sx - lx;   // lx: metres east of the centre line
      A(sx, -8, sz, B - 4, 7, L - 6, 0x4d5256); A(sx, -1, sz, B, 8, L - 4, 0x8f9499);                                       // lower and upper hull
      A(sx, -1, sz + L / 2 + 2, B - 10, 8, 8, 0x8f9499); A(sx, -1, sz + L / 2 + 7, B - 18, 8, 5, 0x8f9499);                   // the bow narrowing
      A(sx, SHIP.deck - 0.6, sz + 2, B + 2, 0.6, L + 10, 0x5a5e62);                                                                       // flight deck
      for (let k = -L / 2; k < L / 2; k += 9) A(sx, 7.62, sz + k, 0.5, 0.04, 5, 0xe9e6dc, 0, false);                       // centre line
      for (const k of [-50, -20, 10, 40]) A(x(-7), 7.62, sz + k, 8, 0.04, 8, 0xd9b64a, 0, false);                            // landing spots
      A(x(11), 7.6, sz + 8, 6, 12, 34, 0x84898c); A(x(11), 19.6, sz + 12, 6.4, 1.6, 12, GLASS); A(x(11), 21.2, sz + 12, 5, 2.4, 10, 0x84898c);   // island, bridge windows
      props.push({ geo: 'cyl:0.35,0.5,11,6', color: 0x5b5f62, x: x(11), y: 28, z: sz + 12, rot: [0, 0, 0], cast: true, absY: true });   // mast
      A(sx, -1, sz - (L - 4) / 2 - 0.2, 16, 6, 0.4, 0x1e2224);                                                                   // the well dock's stern gate
      obstacles.push({ minX: sx - B / 2, maxX: sx + B / 2, minZ: sz - L / 2 - 2, maxZ: sz + L / 2 + 10, h: 7.6 }); }

    // ---- sea stacks off the cliffs, rocks along the cliff tops
    for (const [e, n, s] of [[-345, 220, 7], [-275, 340, 5], [-205, 395, 6], [20, 492, 8], [205, 395, 5], [355, 180, 6], [-160, -250, 5], [190, -230, 6]]) {
      const [x, z] = P(e, n); let w = s, y = -10; for (let k = 0; k < 4; k++) { const h = 3 + rd() * 3 + (k === 0 ? 8 : 0); A(x + (rd() - 0.5) * 1.5, y, z + (rd() - 0.5) * 1.5, w, h, w * (0.8 + rd() * 0.4), [0x6f665c, 0x7e756a, 0x655d54][k % 3], rd() * 1.5); y += h; w *= 0.72; }
    }
    for (let i = 0; i < 600; i++) { const e = (r() - 0.5) * 1180, n = (r() - 0.5) * 1180, [x, z] = P(e, n), d = inland(x, z); if (d < 5 || d > 16 || busy(x, z, -6)) continue; K.rock(x, z); }

    // ---- dunes behind West Beach, and woods: pine and birch over the plateau and the mainland, clear of the beach and the harbour
    for (const [e, n] of [[-280, 40], [-288, 95], [-282, 140], [-170, 312]]) { const [x, z] = P(e, n); scrub(x, z, 18, 60); }
    const beachy = (x, z) => [...BEACH, [-300, 40]].some(([e, n]) => Math.hypot(x - P(e, n)[0], z - n) < 55) || Math.hypot(x - P(265, 30)[0], z - 30) < 70;
    for (let i = 0, n = 0; i < 5000 && n < 520; i++) {
      const e = (r() - 0.5) * 1170, nn = (r() - 0.5) * 1170, [x, z] = P(e, nn);
      if (busy(x, z, 3) || beachy(x, z)) continue;
      const clump = 1 + Math.floor(r() * 4);
      for (let k = 0; k < clump; k++) { const tx = x + (r() - 0.5) * 12, tz = z + (r() - 0.5) * 12; if (busy(tx, tz, 2)) continue; (r() < 0.7 ? pine : birch)(tx, tz, 8 + r() * 5); take(tx, tz, 2); n++; }
      if (r() < 0.3) bush(x + 4, z - 3);
    }

    for (const rd0 of this.roads) strips.push({ points: rd0.points, width: rd0.width, tex: rd0.tex === 'road' ? 'roadM' : 'trackM', vRepeat: rd0.tex === 'road' ? 12 : 5, smooth: 2, y: rd0.tex === 'road' ? 0.03 : 0.02, cutout: true });
    return { props, obstacles, lamps: K.lamps, tufts: K.tufts, decals: K.decals, strips };
  },

  // the splat: concrete, sand and dirt weights in r, g, b and the meadow in alpha (1 - the rest), as Narva weighs them. Each tile
  // is painted as its own grey mask with plain overdraw, then the three are packed a pixel at a time with their sum held to
  // 0.92: a canvas keeps colour premultiplied, so a pixel with no alpha left loses its colour, and a weight painted over an
  // opaque one would only tint it.
  paintSplat(g, px, half) {
    const ppm = px / (half * 2), X = (e) => (-e + half) * ppm, Z = (n) => (half - n) * ppm;
    const grey = (v) => { const k = Math.round(v * 255); return `rgb(${k},${k},${k})`; };
    const layer = (v) => { const c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d'); x.fillStyle = grey(v); x.fillRect(0, 0, px, px); return x; };
    const C = layer(0), S = layer(0.6), D = layer(0.3);                                                              // the sea bed: sand and silt
    const path = (x, pts, close) => { x.beginPath(); pts.forEach(([e, n], i) => i ? x.lineTo(X(e), Z(n)) : x.moveTo(X(e), Z(n))); if (close) x.closePath(); };
    const fill = (x, pts, v) => { x.fillStyle = grey(v); path(x, pts, true); x.fill(); };
    const stroke = (x, pts, width, v, close = false) => { x.strokeStyle = grey(v); x.lineWidth = width * ppm; x.lineCap = 'round'; x.lineJoin = 'round'; path(x, pts, close); x.stroke(); };
    const disc = (x, e, n, rad, v) => { x.fillStyle = grey(v); x.beginPath(); x.arc(X(e), Z(n), rad * ppm, 0, Math.PI * 2); x.fill(); };
    const rect = (x, e, n, w, d, v) => { x.fillStyle = grey(v); x.fillRect(X(e) - w * ppm / 2, Z(n) - d * ppm / 2, w * ppm, d * ppm); };
    const all = (fn, vc, vs, vd) => { fn(C, vc); fn(S, vs); fn(D, vd); };                                          // one shape on all three masks
    for (const pts of [PEN, MAIN]) all((x, v) => fill(x, pts, v), 0, 0, 0);                                          // the land: meadow
    const fr = rand(77);                                                                                             // fields on the mainland
    for (let i = 0; i < 18; i++) { const e = (fr() - 0.5) * 1100, n = -430 - fr() * 150, w = 60 + fr() * 90, d = 30 + fr() * 40, ploughed = fr() < 0.5; if (Math.abs(e) < 70) continue; all((x, v) => rect(x, e, n, w, d, v), 0, ploughed ? 0 : 0.15, ploughed ? 0.6 : 0.3); }
    all((x, v) => { stroke(x, PEN, 14, v, true); stroke(x, MAIN.slice(0, 8), 14, v); }, 0.3, 0, 0.6);                 // bare rock down the cliffs
    all((x, v) => stroke(x, BEACH, 66, v), 0, 0.92, 0); all((x, v) => stroke(x, [[-284, 40], [-290, 90], [-284, 140]], 34, v), 0, 0.6, 0.1);   // West Beach, its dunes
    all((x, v) => stroke(x, COVE, 30, v), 0, 0.9, 0.02);
    all((x, v) => fill(x, [[312, 70], [298, 0], [312, -30], [230, -40], [222, 92], [300, 92]], v), 0.85, 0, 0.04);    // the harbour's concrete
    all((x, v) => disc(x, 60, 130, 30, v), 0.15, 0, 0.45); all((x, v) => disc(x, 40, 410, 20, v), 0.5, 0, 0.2);     // the worn hilltop, the lighthouse yard
    all((x, v) => disc(x, -215, 110, 26, v), 0.25, 0.1, 0.35);                                                       // the village green's paths
    for (const b of this.bases.filter(b => !b.ship)) all((x, v) => disc(x, -b.x, b.z, 36, v), 0.3, 0, 0.6);
    const [c, sd, d] = [C, S, D].map(x => x.getImageData(0, 0, px, px).data), img = g.createImageData(px, px), o = img.data;
    for (let i = 0; i < o.length; i += 4) {
      let wc = c[i] / 255, ws = sd[i] / 255, wd = d[i] / 255; const t = wc + ws + wd; if (t > 0.92) { const k = 0.92 / t; wc *= k; ws *= k; wd *= k; }
      o[i] = wc * 255; o[i + 1] = ws * 255; o[i + 2] = wd * 255; o[i + 3] = (1 - wc - ws - wd) * 255;
    }
    g.putImageData(img, 0, 0);
  },
};
