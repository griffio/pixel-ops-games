import { rand } from '../../core/layout.js';
import { smooth } from '../../core/math.js';
import { Terrain } from '../../core/terrain.js';
import { makeKit } from './kit.js';

// "The Hollow": 500 m, infantry only (docs/GAME_PLAN.md, "The Hollow"). Two ridges run north to south with a gully between
// them; the Hamlet sits on the gully floor and a clearing crowns each crest. Thickets over the flanks (sight-blocking, walked
// through slowly) and draws cut into them make a maze of dead ground, so a squad ambushes or is ambushed: hold fire and
// attack-move are the orders here. Point-symmetric through the centre: OPFOR's half is BLUFOR's turned by 180 degrees, so
// the two sides' walks and views match. x east, z north. The ridge profile bulges (p 0.8), so a crest does not overlook the
// gully floor: the killing grounds are the clearings and the floor at the hamlet.
const CREST_X = 150, CREST_Z = 140, RIDGE = { w: 70, h: 16 };
const turn = (k) => { const o = { ...k }; for (const key of ['x', 'z', 'x1', 'z1', 'x2', 'z2']) if (o[key] !== undefined) o[key] = -o[key]; return o; };   // the same feature on the other side
const sym = (list) => list.flatMap(k => [k, turn(k)]);
const TRACK = [[-215, -215], [-150, -220], [-60, -195], [-10, -120], [0, -40], [0, 40], [10, 120], [60, 195], [150, 220], [215, 215]];
// draws: dead ground cut into the flanks, three into each ridge's gully side and two into its outer side (centre lines)
const DRAWS = sym([
  { type: 'ridge', x1: -150, z1: -110, x2: -70, z2: -95, w: 14, h: -5, p: 0.7 },
  { type: 'ridge', x1: -150, z1: -10, x2: -72, z2: 10, w: 14, h: -5, p: 0.7 },
  { type: 'ridge', x1: -150, z1: 110, x2: -70, z2: 125, w: 14, h: -5, p: 0.7 },
  { type: 'ridge', x1: -150, z1: -60, x2: -225, z2: -75, w: 13, h: -5, p: 0.7 },
  { type: 'ridge', x1: -150, z1: 120, x2: -225, z2: 135, w: 13, h: -5, p: 0.7 },
]);

export const hollow = {
  name: 'The Hollow', size: 500, mode: 'aas', infantryOnly: true, tickets: 200, clock: 12,
  hour: 10.5, wind: [0.5, 0.8],
  blurb: 'Infantry only: two wooded ridges and the gully between, a hamlet on the floor, a clearing on each crest. Ambush, or be ambushed.',
  nav: { foot: 1, vehicle: 2 },
  splatRes: 512,
  ground: { base: 'meadow', baseSize: 12.8, tiles: ['concrete', 'asphalt', 'dirt', 'meadow'], tileSize: [16, 4, 12.8, 12.8] },   // r concrete, g asphalt, b dirt, alpha meadow (paintSplat)
  bases: [{ team: 0, x: -215, z: -215, r: 30 }, { team: 1, x: 215, z: 215, r: 30 }],
  // five places: each side's clearing on its crest and its floor place near its end of the gully touch its base; the Hamlet
  // in the middle links to all four, so the majority is your own two and the Hamlet, and capturing all means taking two
  // places under the enemy's base (three places ended a CPU match by capture-all in four minutes)
  locations: [
    { name: 'West Clearing', x: -150, z: 60, r: 18, home: 0 },
    { name: 'Ford', x: 0, z: -115, r: 20, home: 0 },
    { name: 'Hamlet', x: 0, z: 0, r: 22 },
    { name: 'Mill', x: 0, z: 115, r: 20, home: 1 },
    { name: 'East Clearing', x: 150, z: -60, r: 18, home: 1 },
  ],
  links: [['West Clearing', 'Hamlet'], ['Ford', 'Hamlet'], ['Hamlet', 'East Clearing'], ['Hamlet', 'Mill']],
  tracks: [TRACK],
  terrain: {
    water: -40,   // none: the stream bed is dry
    features: [
      ...sym([{ type: 'ridge', x1: -CREST_X, z1: -CREST_Z, x2: -CREST_X, z2: CREST_Z, w: RIDGE.w, h: RIDGE.h, p: 0.8, jag: 0.35 }]),   // the two ridges
      ...DRAWS,
      { type: 'ridge', x1: 0, z1: -230, x2: 0, z2: 230, w: 22, h: -2.5, p: 0.6 },   // the stream bed down the gully floor
      ...sym([{ type: 'hill', x: -245, z: -100, r: 50, h: 9, p: 0.8, jag: 0.3 }, { type: 'hill', x: -100, z: -245, r: 50, h: 9, p: 0.8, jag: 0.3 }]),   // knolls either side of each base: a bowl
    ],
  },
  flats: [
    { x: -215, z: -215, r: 34, m: 22 }, { x: 215, z: 215, r: 34, m: 22 },   // the bases
    { x: 0, z: 0, r: 34, m: 22 },                                            // the hamlet
    { x: -150, z: 60, r: 20, m: 16 }, { x: 150, z: -60, r: 20, m: 16 },     // the clearings
    { x: 0, z: -115, r: 18, m: 14 }, { x: 0, z: 115, r: 18, m: 14 },         // the ford and the mill
  ],
  build() {
    const r = rand(5051), rd = rand(6163), strips = [], thickets = [];
    const T = new Terrain(this.size, 4, { ...this.terrain, flats: this.flats });   // the heights the world will build, to place by height
    const track = smooth(TRACK, 2), draws = DRAWS.map(d => [[d.x1, d.z1], [d.x2, d.z2]]);
    const near = (x, z, P, clear) => { for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < clear) return true; } return false; };
    const onTrack = (x, z, extra = 0) => near(x, z, track, 5 + extra);
    const inDraw = (x, z, extra = 0) => draws.some(d => near(x, z, d, 7 + extra));
    const K = makeKit({ r, rd, onRoad: (x, z) => onTrack(x, z) });
    const { props, obstacles, lamps, tufts, decals, emitters, box, house, pine, birch, rock, well, scrub } = K;
    const placeFree = (x, z, m) => !this.locations.some(l => Math.hypot(x - l.x, z - l.z) < l.r + m) && !this.bases.some(b => Math.hypot(x - b.x, z - b.z) < b.r + m);
    // a bush with no collision of its own (the kit's blocks the foot grid): three swaying cylinders, as the kit draws one
    const bushAt = (x, z, s = 0.9 + r() * 0.5) => { for (const [ox, oz, rr, h] of [[0, 0, 1.3, 1.6], [0.9, 0.5, 0.9, 1.2], [-0.8, 0.6, 1.0, 1.1]]) props.push({ geo: 'cyl:' + (rr * s).toFixed(2) + ',' + (rr * s * 1.15).toFixed(2) + ',' + (h * s).toFixed(2) + ',7', tex: 'bush', x: x + ox * s, y: h * s / 2, z: z + oz * s, rot: [0, 0, 0], cast: true, sway: true }); };
    // ---- thickets over the flanks: where the ground stands 2.5 to 12.5 m up, off the track, the draws' floors, the places and
    // the bases; a jittered box of 14 to 24 m a side in three cells of four (20 m cells), a bush every 3 m and a tree every 90 m2
    const thicket = (x, z, w, d) => {
      thickets.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: 2.2, thicket: true, walk: 0.55 });
      for (let i = 0; i < w * d / 9; i++) bushAt(x + (r() - 0.5) * (w - 2), z + (r() - 0.5) * (d - 2));
      for (let i = 0; i < w * d / 90; i++) { const tx = x + (r() - 0.5) * (w - 3), tz = z + (r() - 0.5) * (d - 3); if (r() < 0.6) pine(tx, tz, 9 + r() * 4); else birch(tx, tz, 7 + r() * 3); }
    };
    // the west half decides and the east half is its turn through the centre, so both sides get the same woods
    const both = (x, z, w, d) => { thicket(x, z, w, d); thicket(-x, -z, w, d); };
    const ok = (x, z, m) => !onTrack(x, z, 10) && !inDraw(x, z, 6) && placeFree(x, z, m) && !this.bases.some(b => Math.hypot(x - b.x, z - b.z) < b.r + 30);
    for (let gx = -232; gx < 0; gx += 16) for (let gz = -232; gz <= 232; gz += 16) {
      const x = gx + (r() - 0.5) * 6, z = gz + (r() - 0.5) * 6, h = T.height(x, z);
      if (h < 1.5 || r() > 0.9 || !ok(x, z, 12)) continue;
      both(x, z, 12 + r() * 8, 12 + r() * 8);
    }
    // ---- hedgerows across the floor: thin thickets 30 to 60 m long that cut the gully's lines of sight, with gaps between
    for (let i = 0, made = 0; i < 400 && made < 11; i++) {
      const x = -(r() * 70), z = (r() - 0.5) * 440, along = r() < 0.6, len = 30 + r() * 30, w = 5;
      const hw = along ? w : len, hd = along ? len : w;
      if (T.height(x, z) > 1.5 || !ok(x, z, 16) || thickets.some(t => Math.max(t.minX - (x + hw / 2), (x - hw / 2) - t.maxX, t.minZ - (z + hd / 2), (z - hd / 2) - t.maxZ) < 10)) continue;
      if (onTrack(x - hw / 2, z - hd / 2, 6) || onTrack(x + hw / 2, z + hd / 2, 6) || onTrack(x, z, 6)) continue;
      both(x, z, hw, hd); made++;
    }
    // ---- copses and lone trees on the floor, rocks on the slopes, grass on the floor
    for (let i = 0; i < 5; i++) { const x = -(r() * 200), z = (r() - 0.5) * 420, h = T.height(x, z); if (h > 2.5 || onTrack(x, z, 10) || !placeFree(x, z, 26)) continue; for (const s of [1, -1]) for (let k = 0; k < 4 + r() * 4; k++) { const tx = s * (x + (r() - 0.5) * 24), tz = s * (z + (r() - 0.5) * 24); if (!onTrack(tx, tz, 4)) (r() < 0.5 ? pine : birch)(tx, tz); } }
    for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 460, z = (r() - 0.5) * 460, h = T.height(x, z); if (h < 3 || h > 14 || onTrack(x, z, 6) || !placeFree(x, z, 6)) continue; rock(x, z); }
    for (let i = 0; i < 14; i++) { const x = (r() - 0.5) * 400, z = (r() - 0.5) * 400; if (T.height(x, z) < 3 && !onTrack(x, z, 8)) scrub(x, z, 14 + r() * 14, 40); }
    // ---- the hamlet (blockout: the kit's plain houses round a green, a well, low field walls along the lane; H3 dresses it)
    { const H = this.locations[2], lowWall = (x, z, len, rot) => box(len, 1.1, 0.5, 0x8a8478, x, z, { rot });
      house(H.x - 16, H.z + 10, 8, 7, 1, 0.15); house(H.x + 13, H.z + 13, 7, 9, 1, -0.2); house(H.x + 15, H.z - 11, 9, 7, 1, 0.1); house(H.x - 13, H.z - 15, 7, 7, 1, -0.1); house(H.x + 1, H.z + 26, 8, 8, 1, 0.05);
      well(H.x + 2, H.z - 1);
      lowWall(H.x - 24, H.z - 2, 22, Math.PI / 2 + 0.1); lowWall(H.x + 26, H.z + 1, 24, Math.PI / 2 - 0.1); lowWall(H.x - 4, H.z - 26, 20, 0.05); lowWall(H.x + 8, H.z + 34, 18, -0.05); }
    // ---- the ford: stepping stones and a wall; the mill: a tall house by the stream (blockout)
    { const F = this.locations[1], M = this.locations[3]; for (let k = 0; k < 5; k++) rock(F.x - 8 + k * 4, F.z + (k % 2) * 2); box(12, 1.0, 0.5, 0x8a8478, F.x - 14, F.z + 10, { rot: 0.3 });
      house(M.x + 10, M.z - 6, 9, 7, 2, 0.05); box(12, 1.0, 0.5, 0x8a8478, M.x - 12, M.z + 8, { rot: -0.3 }); }
    // ---- the clearings: a ruined barn and a wall stub each, cover on the crest
    for (const l of [this.locations[0], this.locations[4]]) { const s = l.z > 0 ? 1 : -1; box(10, 2.6, 6, 0x6b5a48, l.x + 6 * s, l.z - 8 * s, { rot: 0.3 * s }); box(9, 1.0, 0.5, 0x8a8478, l.x - 8 * s, l.z + 6 * s, { rot: Math.PI / 2 + 0.2 * s }); }
    // ---- the bases: a hut and a wall each
    for (const b of this.bases) { const s = b.x > 0 ? 1 : -1; house(b.x + 14 * s, b.z - 12 * s, 7, 6, 1, 0.1); box(14, 1.1, 0.5, 0x8a8478, b.x - 16 * s, b.z + 10 * s, { rot: 0.2 }); }
    strips.push({ points: TRACK, width: 5, tex: 'track', vRepeat: 5, smooth: 2, y: 0.02, cutout: true });
    return { props, obstacles, lamps, emitters, tufts, decals, strips, thickets };
  },
  // the splat: dirt along the track and on the bare ground of the bases and the hamlet's lane, the rest meadow
  paintSplat(g, px, half) {
    const ppm = px / (half * 2), X = (x) => (x + half) * ppm, Z = (z) => (half - z) * ppm;
    const mix = (c, a, d) => `rgba(${Math.round(c * 255)},${Math.round(a * 255)},${Math.round(d * 255)},${(1 - c - a - d).toFixed(3)})`;
    g.clearRect(0, 0, px, px);
    const disc = (x, z, rad, style) => { g.fillStyle = style; g.beginPath(); g.arc(X(x), Z(z), rad * ppm, 0, Math.PI * 2); g.fill(); };
    const stroke = (pts, width, style) => { g.strokeStyle = style; g.lineWidth = width * ppm; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); };
    for (const b of this.bases) disc(b.x, b.z, 30, mix(0, 0, 0.55));
    disc(0, 0, 16, mix(0, 0, 0.4));
    stroke(smooth(TRACK, 2), 7, mix(0, 0, 0.8));
    for (const l of [this.locations[0], this.locations[4]]) disc(l.x, l.z, 14, mix(0, 0, 0.25));
    for (const l of [this.locations[1], this.locations[3]]) disc(l.x, l.z, 12, mix(0, 0, 0.35));
  },
};
