import { rand } from '../../core/layout.js';
import { smooth } from '../../core/math.js';
import { Terrain } from '../../core/terrain.js';
import { makeKit } from './kit.js';

// "Hilltop Farm": 500 m, the base defence map (docs/GAME_PLAN.md, "Base defence mode plan"). A farm on a flat knoll at the
// centre, fields falling away on every side, a lane in from the north and a track from the east, both hedged, two copses
// the attackers come through, a pond to the south that nobody crosses. The player builds on the knoll and the 40 m below
// its lip; the waves come in at the lane's and the track's ends (hold.js reads `spawns`). x east, z north.
const LANE = [[-12, 245], [-16, 190], [-8, 130], [-2, 80], [0, 46]];      // the north lane, up to the knoll's lip
const TRACK = [[245, 24], [190, 30], [130, 20], [80, 10], [46, 4]];        // the east track
const KNOLL = { r: 120, h: 10 };

export const hilltop = {
  name: 'Hilltop Farm', size: 500, mode: 'hold', infantryOnly: true, keepKits: true, footSquads: 6, preset: 'garrison', tickets: 200, clock: 15,   // keepKits: engineers and launchers stay (fitMap); tickets: a bare garrison on normal spends 160 to 190 of them over the waves (B4 runs), works save most of that; clock: hold.js sets it by the CPU setting
  hour: 9.5, wind: [0.6, 0.4],
  blurb: 'Base defence: three minutes to lay out the farm on the knoll, then hold the HQ against waves from the north lane and the east track.',
  nav: { foot: 1, vehicle: 2 },
  splatRes: 512,
  ground: { base: 'meadow', baseSize: 12.8, tiles: ['concrete', 'asphalt', 'dirt', 'meadow'], tileSize: [16, 4, 12.8, 12.8] },
  bases: [{ team: 0, x: 0, z: 0, r: 36 }, { team: 1, x: 226, z: 226, r: 14 }],   // the knoll; the attackers' corner is a formality, their waves come in at `spawns`
  locations: [{ name: 'HQ', x: 0, z: 0, r: 22, home: 0 }],                      // the one place: the farmyard; the attackers take it by standing in it
  spawns: [{ x: -12, z: 236, w: 60, name: 'the north lane', mortar: [-62, 168] }, { x: 236, z: 24, w: 60, name: 'the east track', mortar: [166, 64] }],   // mortar: where a wave's mortar team sets up (hold.js), in the fields 175 m out, in sight of a position at the farm's edge
  tracks: [LANE, TRACK],
  terrain: {
    water: -1.5,   // the pond: the one basin dug below it
    features: [
      { type: 'hill', x: 0, z: 0, r: KNOLL.r, h: KNOLL.h, p: 1.5, jag: 0.12 },        // the knoll, flat on top (flats)
      { type: 'hill', x: 30, z: -160, r: 48, h: -6, p: 1.2 },                          // the pond
      { type: 'hill', x: -170, z: 150, r: 60, h: 4, p: 1, jag: 0.3 }, { type: 'hill', x: 160, z: -120, r: 70, h: 3.5, p: 1, jag: 0.3 },   // low rises: dead ground for the attackers
    ],
  },
  flats: [{ x: 0, z: 0, r: 42, m: 18 }],
  build() {
    const r = rand(7171), rd = rand(8383), strips = [], thickets = [];
    const T = new Terrain(this.size, 4, { ...this.terrain, flats: this.flats });
    const lane = smooth(LANE, 2), track = smooth(TRACK, 2);
    const near = (x, z, P, clear) => { for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < clear) return true; } return false; };
    const onRoad = (x, z, extra = 0) => near(x, z, lane, 5 + extra) || near(x, z, track, 5 + extra);
    const K = makeKit({ r, rd, onRoad: (x, z) => onRoad(x, z) });
    const { props, obstacles, lamps, tufts, decals, emitters, box, pine, birch, rock, well, scrub, cottage, fieldWall, pen } = K;
    const knoll = (x, z, m = 0) => Math.hypot(x, z) < 46 + m;
    const inPond = (x, z) => T.height(x, z) < this.terrain.water + 0.4;
    const MASS = [[2.4, 1.7], [3.0, 1.9], [3.6, 2.2]], BUSH = [0.9, 1.15, 1.4];
    const mass = (x, z) => { const [rr, h] = MASS[Math.floor(r() * MASS.length)]; props.push({ geo: `cyl:${rr},${(rr * 1.12).toFixed(2)},${h},8`, tex: 'bush', x, y: h / 2, z, rot: [0, r() * Math.PI * 2, 0], cast: true, sway: true }); };
    const bushAt = (x, z) => { const s = BUSH[Math.floor(r() * BUSH.length)]; props.push({ geo: `cyl:${(1.3 * s).toFixed(2)},${(1.5 * s).toFixed(2)},${(1.6 * s).toFixed(2)},7`, tex: 'bush', x, y: 0.8 * s, z, rot: [0, r() * Math.PI * 2, 0], cast: false, sway: true }); };
    // a hedge: a thin thicket (sight-blocking, walked through slowly) with its masses and bushes
    const hedge = (x, z, w, d) => {
      thickets.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: 2.2, thicket: true, walk: 0.55 });
      for (let i = 0; i < w * d / 30; i++) mass(x + (r() - 0.5) * (w - 3), z + (r() - 0.5) * (d - 3));
      for (let i = 0; i < w * d / 20; i++) bushAt(x + (r() - 0.5) * (w - 2), z + (r() - 0.5) * (d - 2));
    };
    // ---- hedgerows either side of the lane and the track, in runs of 24 to 40 m with gaps, from the edge in to 60 m of the yard
    const hedgeAlong = (P, side) => { for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L; for (let s = 0; s < L; s += 34 + r() * 14) { const len = 24 + r() * 16, t0 = s / L, t1 = Math.min(1, (s + len) / L), mx = ax + (bx - ax) * (t0 + t1) / 2 + nx * side * 9, mz = az + (bz - az) * (t0 + t1) / 2 + nz * side * 9; if (knoll(mx, mz, 14) || inPond(mx, mz)) continue; const along = Math.abs(bx - ax) > Math.abs(bz - az); hedge(mx, mz, along ? (t1 - t0) * L : 4, along ? 4 : (t1 - t0) * L); } } };
    for (const side of [-1, 1]) { hedgeAlong(LANE.slice(0, 4), side); hedgeAlong(TRACK.slice(0, 4), side); }
    // ---- two copses on the rises, where the attackers gather, and lone trees across the fields
    for (const [cx, cz] of [[-150, 140], [150, -110]]) for (let k = 0; k < 14; k++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 34, tx = cx + Math.cos(a) * d, tz = cz + Math.sin(a) * d; if (onRoad(tx, tz, 8)) continue; if (r() < 0.55) pine(tx, tz, 10 + r() * 4); else birch(tx, tz, 7 + r() * 3); }
    for (let i = 0; i < 22; i++) { const x = (r() - 0.5) * 460, z = (r() - 0.5) * 460; if (knoll(x, z, 30) || onRoad(x, z, 12) || inPond(x, z) || Math.hypot(x - 226, z - 226) < 40) continue; if (r() < 0.5) pine(x, z, 9 + r() * 4); else birch(x, z, 6 + r() * 3); }
    for (let i = 0; i < 24; i++) { const x = (r() - 0.5) * 420, z = (r() - 0.5) * 420, h = T.height(x, z); if (knoll(x, z, 4) || h < 2.5 || onRoad(x, z, 6)) continue; rock(x, z); }   // rocks on the knoll's slopes
    for (let i = 0; i < 16; i++) { const x = (r() - 0.5) * 420, z = (r() - 0.5) * 420; if (!knoll(x, z, 20) && !onRoad(x, z, 8) && !inPond(x, z)) scrub(x, z, 14 + r() * 14, 40); }
    // ---- the farm on the knoll: the house and the barn off-centre, a pen, a well, two runs of wall at the lip (cover with gaps);
    // the yard between them stays open ground for the player's own works
    cottage(-16, 12, 10, 7, 0.15); cottage(18, -14, 12, 7, 1.62);
    pen(20, 16, 0.1, 10, 8); well(-6, -16);
    fieldWall(-34, 26, -14, 32); fieldWall(28, 22, 36, 6); fieldWall(-36, -8, -36, -26);
    box(2.4, 0.7, 1.0, 0x8a847a, 4, 18, { rot: 0.3 });   // a trough
    // ---- the pond's reeds
    for (let i = 0; i < 30; i++) { const a = r() * Math.PI * 2, d = 42 + r() * 12, x = 30 + Math.cos(a) * d, z = -160 + Math.sin(a) * d; if (!inPond(x, z) && T.height(x, z) < 0.5) bushAt(x, z); }
    strips.push({ points: LANE, width: 5, tex: 'track', vRepeat: 5, smooth: 2, y: 0.02, cutout: true }, { points: TRACK, width: 5, tex: 'track', vRepeat: 5, smooth: 2, y: 0.02, cutout: true });
    return { props, obstacles, lamps, emitters, tufts, decals, strips, thickets };
  },
  // the splat: the yard's bare earth, dirt along the lane and the track, the rest meadow
  paintSplat(g, px, half) {
    const ppm = px / (half * 2), X = (x) => (x + half) * ppm, Z = (z) => (half - z) * ppm;
    const mix = (c, a, d) => `rgba(${Math.round(c * 255)},${Math.round(a * 255)},${Math.round(d * 255)},${(1 - c - a - d).toFixed(3)})`;
    g.clearRect(0, 0, px, px);
    const disc = (x, z, rad, style) => { g.fillStyle = style; g.beginPath(); g.arc(X(x), Z(z), rad * ppm, 0, Math.PI * 2); g.fill(); };
    const stroke = (pts, width, style) => { g.strokeStyle = style; g.lineWidth = width * ppm; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); };
    disc(0, 0, 34, mix(0, 0, 0.5)); disc(0, 0, 18, mix(0, 0, 0.75));
    stroke(smooth(LANE, 2), 7, mix(0, 0, 0.8)); stroke(smooth(TRACK, 2), 7, mix(0, 0, 0.8));
  },
};
