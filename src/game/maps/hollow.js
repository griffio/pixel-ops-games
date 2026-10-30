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
const TRACK = [[-215, -215], [-150, -220], [-60, -195], [-10, -120], [0, -44], [-20, -22], [-20, 22], [0, 44], [10, 120], [60, 195], [150, 220], [215, 215]];
const LOOP = [[0, 44], [20, 22], [20, -22], [0, -44]];   // the lane's other arm round the hamlet green: the track's turn, so the ring is symmetric
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
  hour: 8.4, wind: [0.5, 0.8],   // a low morning sun, mist in the gully
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
    const track = smooth(TRACK, 2), loop = smooth(LOOP, 2), draws = DRAWS.map(d => [[d.x1, d.z1], [d.x2, d.z2]]);
    const near = (x, z, P, clear) => { for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < clear) return true; } return false; };
    const onTrack = (x, z, extra = 0) => near(x, z, track, 5 + extra) || near(x, z, loop, 5 + extra);
    const inDraw = (x, z, extra = 0) => draws.some(d => near(x, z, d, 7 + extra));
    const K = makeKit({ r, rd, onRoad: (x, z) => onTrack(x, z) });
    const { props, obstacles, lamps, tufts, decals, emitters, box, pine, birch, rock, well, scrub, cottage, church, fieldWall, pen, ruinedBarn, mill } = K;
    const placeFree = (x, z, m) => !this.locations.some(l => Math.hypot(x - l.x, z - l.z) < l.r + m) && !this.bases.some(b => Math.hypot(x - b.x, z - b.z) < b.r + m);
    // hedge masses and bushes with no collision of their own (the kit's bush blocks the foot grid): one swaying cylinder each.
    // The first cut drew every thicket as a bush every 3 m of three cylinders apiece, 28,800 shadow-casting cylinders over the
    // map (Palm Valley has 1,500), and an iPad juddered on a drag; now a few broad masses carry the shadow and the small
    // bushes between them cast none
    // sizes come from short lists, never a free random: the renderer batches instances by geometry string, and a bush of
    // its own size was a draw call of its own (18,000 calls and 126 ms a frame for the hamlet view on the Mac mini)
    const MASS = [[2.4, 1.7], [3.0, 1.9], [3.6, 2.2]], BUSH = [0.9, 1.15, 1.4];
    const mass = (x, z) => { const [rr, h] = MASS[Math.floor(r() * MASS.length)]; props.push({ geo: `cyl:${rr},${(rr * 1.12).toFixed(2)},${h},8`, tex: 'bush', x, y: h / 2, z, rot: [0, r() * Math.PI * 2, 0], cast: true, sway: true }); };
    const bushAt = (x, z) => { const s = BUSH[Math.floor(r() * BUSH.length)]; props.push({ geo: `cyl:${(1.3 * s).toFixed(2)},${(1.5 * s).toFixed(2)},${(1.6 * s).toFixed(2)},7`, tex: 'bush', x, y: 0.8 * s, z, rot: [0, r() * Math.PI * 2, 0], cast: false, sway: true }); };
    // ---- thickets over the flanks: where the ground stands 1.5 m up, off the track, the draws' floors, the places and the
    // bases; a jittered box of 12 to 20 m a side in nine cells of ten (16 m cells); inside, a hedge mass every 40 m2, a small
    // bush every 25 m2 and a tree every 90 m2
    const thicket = (x, z, w, d) => {
      thickets.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: 2.2, thicket: true, walk: 0.55 });
      for (let i = 0; i < w * d / 40; i++) mass(x + (r() - 0.5) * (w - 4), z + (r() - 0.5) * (d - 4));
      for (let i = 0; i < w * d / 25; i++) bushAt(x + (r() - 0.5) * (w - 2), z + (r() - 0.5) * (d - 2));
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
    // ---- the hamlet: the church on the green at the very centre (its nave along x, so it turns onto itself but for the
    // tower), three pairs of cottages turned through the centre, a well and a trough, field walls along the lane and
    // round the gardens, every wall paired with its turn
    { const H = this.locations[2];
      church(H.x, H.z, 0);
      for (const [x, z, w, d, rot] of [[-30, 10, 8, 6, 1.5], [-7, 29, 9, 6, 0.05], [31, -6, 7, 8, 1.6]]) { cottage(H.x + x, H.z + z, w, d, rot); cottage(H.x - x, H.z - z, w, d, rot + Math.PI); }
      well(H.x - 12, H.z - 9); box(2.4, 0.7, 1.0, 0x8a847a, H.x + 12, H.z + 9, { rot: 0.4 });   // the well, and a stone trough across the green
      for (const [x0, z0, x1, z1] of [[-25, -24, -25, 2], [-36, 18, -24, 24], [-18, 36, 2, 38], [24, -30, 34, -16], [27, 4, 27, 16]]) { fieldWall(H.x + x0, H.z + z0, H.x + x1, H.z + z1); fieldWall(H.x - x0, H.z - z0, H.x - x1, H.z - z1); } }
    // ---- the ford: stepping stones over the bed and a byre; the mill: the mill with its wheel to the stream; a wall each
    { const F = this.locations[1], M = this.locations[3];
      for (let k = 0; k < 5; k++) rock(F.x - 8 + k * 4, F.z + (k % 2) * 2);
      cottage(F.x - 12, F.z - 9, 8, 6, 0.2); fieldWall(F.x - 20, F.z + 6, F.x - 6, F.z + 12);
      mill(M.x + 13, M.z + 9, 0.2); fieldWall(M.x + 22, M.z - 6, M.x + 8, M.z - 12); }   // the wheel on its west side, to the stream bed
    // ---- the clearings: a ruined barn and a run of wall each, cover on the crest
    for (const l of [this.locations[0], this.locations[4]]) { const s = l.z > 0 ? 1 : -1; ruinedBarn(l.x + 6 * s, l.z - 8 * s, 0.3 * s); fieldWall(l.x - 9 * s, l.z + 2 * s, l.x - 7 * s, l.z + 12 * s); }
    // ---- pens in the mouths of the inner draws (the three on each ridge's gully side): a wall round dead ground
    for (const d of DRAWS) { if (Math.abs(d.x2) > 100) continue; const a = Math.atan2(d.x1 - d.x2, d.z1 - d.z2); pen(d.x2 + Math.sin(a) * 10, d.z2 + Math.cos(a) * 10, a + Math.PI / 2 + 0.3, 9, 7); }
    // ---- the bases: a cottage and a wall each
    for (const b of this.bases) { const s = b.x > 0 ? 1 : -1; cottage(b.x + 14 * s, b.z - 12 * s, 8, 6, 0.1 + (s < 0 ? 0 : Math.PI)); fieldWall(b.x - 22 * s, b.z + 8 * s, b.x - 10 * s, b.z + 12 * s); }
    // ---- mist along the stream bed and up the draws, a morning haze that the sun burns through slowly
    for (let z = -200; z <= 200; z += 40) if (Math.abs(z) > 50) emitters.push({ x: (r() - 0.5) * 10, y: 0.6, z: z + (r() - 0.5) * 10, kind: 'mist', k: 1.7, rate: 1.4 });   // not on the hamlet green
    for (const d of DRAWS) if (Math.abs(d.x2) <= 100) emitters.push({ x: (d.x1 + d.x2) / 2, y: 0.8, z: (d.z1 + d.z2) / 2, kind: 'mist', k: 1.8, rate: 1.2 });
    strips.push({ points: TRACK, width: 5, tex: 'track', vRepeat: 5, smooth: 2, y: 0.02, cutout: true }, { points: LOOP, width: 5, tex: 'track', vRepeat: 5, smooth: 2, y: 0.02, cutout: true });
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
    stroke(smooth(TRACK, 2), 7, mix(0, 0, 0.8)); stroke(smooth(LOOP, 2), 7, mix(0, 0, 0.8));
    for (const l of [this.locations[0], this.locations[4]]) disc(l.x, l.z, 14, mix(0, 0, 0.25));
    for (const l of [this.locations[1], this.locations[3]]) disc(l.x, l.z, 12, mix(0, 0, 0.35));
  },
};
