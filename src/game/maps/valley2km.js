import { rand } from '../../core/layout.js';
import { smooth } from '../../core/math.js';

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
// river width (the carve's half-width: open water is about 1.5 times it) at points along the river: narrow at the
// footbridge (x -560) and the bridge (0), wide where the ford is (560)
const RIVER_X = [-1000, -800, -640, -560, -480, -300, -120, 0, 120, 300, 480, 560, 640, 800, 1000];
const RIVER_W = [28, 30, 24, 16, 22, 24, 22, 18, 22, 24, 26, 30, 26, 30, 28];
const riverW = (x) => { for (let i = 0; i < RIVER_X.length - 1; i++) if (x <= RIVER_X[i + 1]) { const t = (x - RIVER_X[i]) / (RIVER_X[i + 1] - RIVER_X[i]); return RIVER_W[i] + (RIVER_W[i + 1] - RIVER_W[i]) * t; } return RIVER_W[RIVER_W.length - 1]; };

export const valley2km = {
  name: 'Palm Valley', size: 2000,
  nav: { foot: 1.5, vehicle: 2.5, cap: 200000 },   // a 2 km grid at 1 m would be 4 M cells (130 MB); long searches round the big hills need a bigger cap
  splatRes: 1024,
  ground: { base: 'sand', baseSize: 4, tiles: ['concrete', 'asphalt', 'grass', 'dirt'], tileSize: [16, 4, 4, 4] },
  bases: [{ team: 0, x: 0, z: -BASE, r: 42 }, { team: 1, x: 0, z: BASE, r: 42 }],
  // list order runs from BLUFOR's side to OPFOR's, each row from the west, so each side's first pick is its town
  locations: [
    { name: 'Kasbah', x: -LANE, z: -420, r: 32, home: 0 },
    { name: 'Depot', x: 0, z: -440, r: 26, home: 0 },
    { name: 'Quarry', x: LANE, z: -420, r: 30, home: 0 },
    { name: 'Bridge', x: 0, z: 0, r: 34 },
    { name: 'Mine', x: LANE, z: 420, r: 30, home: 1 },
    { name: 'Pumps', x: 0, z: 440, r: 26, home: 1 },
    { name: 'Souk', x: -LANE, z: 420, r: 32, home: 1 },
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
    const props = [], obstacles = [], lamps = [], tufts = [], decals = [], strips = [];
    const r = rand(2026);
    // the roads as drawn; nothing stands within their width plus 3 m
    const lines = this.roads.map(rd => ({ P: smooth(rd.points, 2), clear: rd.width / 2 + 3 }));
    const onRoad = (x, z, extra = 0) => lines.some(({ P, clear }) => { for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < clear + extra) return true; } return false; });
    const wet = (x, z, margin = 4) => Math.abs(z) < riverW(x) * 0.78 + margin;   // open water, and a margin of bank
    const near = (x, z, p, d) => Math.hypot(x - p.x, z - p.z) < d;
    const busy = (x, z) => onRoad(x, z) || wet(x, z) || this.locations.some(l => near(x, z, l, l.r + 25)) || this.bases.some(b => near(x, z, b, 60)) || this.bridges.some(b => Math.abs(x - b.x) < b.w / 2 + 8 && Math.abs(z) < b.len / 2 + 10);
    const box = (w, h, d, color, x, z, rot = 0) => {
      props.push({ geo: `box:${w},${h},${d}`, color, x, y: h / 2, z, rot: [0, rot, 0], cast: true });
      const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot)), hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
      obstacles.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, h });
    };
    const rock = (x, z) => { const s = 0.8 + r() * 2.2, col = [0x8c857a, 0x7a7368, 0x9a9388][Math.floor(r() * 3)], rot = r() * Math.PI; if (!busy(x, z)) box(+s.toFixed(2), +(s * 0.6).toFixed(2), +(s * 0.8).toFixed(2), col, x, z, rot); };
    const bush = (x, z) => {
      const s = 0.8 + r() * 0.5; if (busy(x, z)) return;
      for (const [ox, oz, rr, h] of [[0, 0, 1.3, 1.6], [0.9, 0.5, 0.9, 1.2], [-0.8, 0.6, 1.0, 1.1]])
        props.push({ geo: 'cyl:' + (rr * s).toFixed(2) + ',' + (rr * s * 1.15).toFixed(2) + ',' + (h * s).toFixed(2) + ',7', tex: 'bush', x: x + ox * s, y: h * s / 2, z: z + oz * s, rot: [0, 0, 0], cast: true });
      obstacles.push({ minX: x - 1.5 * s, maxX: x + 1.5 * s, minZ: z - 1.5 * s, maxZ: z + 1.5 * s, h: 1.6 * s });
    };
    const palm = (x, z) => {
      const tilt = (r() - 0.5) * 0.12; if (busy(x, z)) return;
      props.push({ geo: 'cyl:0.2,0.32,9,6', tex: 'trunk', x, y: 4.5, z, rot: [tilt, 0, tilt * 0.6], cast: true });
      const tx = x + Math.sin(tilt * 0.6) * 4.5, tz = z + Math.sin(tilt) * 4.5;
      props.push({ geo: 'cyl:0.55,0.4,0.7,6', tex: 'trunk', x: tx, y: 9.1, z: tz, rot: [0, 0, 0], cast: true, ax: x, az: z });
      for (let k = 0; k < 8; k++) props.push({ geo: 'frond:0.6,0.08,3.6,' + (0.35 + (k % 3) * 0.15).toFixed(2), tex: 'frond', x: tx, y: 9.3, z: tz, rot: [0, k * Math.PI / 4 + (k % 2) * 0.2, 0], cast: true, ax: x, az: z });
      obstacles.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5, h: 9 });
    };
    const scrub = (cx, cz, rad, n) => { for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d, z = Math.min(-2, cz + Math.sin(a) * d); if (!busy(x, z)) tufts.push({ x, z, yaw: r() * Math.PI, size: [0.7, 0.9, 1.15][Math.floor(r() * 3)] }); } };

    // ---- the south half: open desert clutter, the palm belt along the river, scrub
    for (let i = 0; i < 520; i++) rock(-985 + r() * 1970, -985 + r() * 950);
    for (let i = 0; i < 260; i++) bush(-985 + r() * 1970, -985 + r() * 950);
    for (let i = 0; i < 300; i++) { const x = -985 + r() * 1970, z = -(riverW(x) * 0.78 + 6 + r() * 60); palm(x, z); }
    for (let i = 0; i < 70; i++) scrub(-985 + r() * 1970, -(20 + r() * 70), 12 + r() * 20, 40);
    for (let i = 0; i < 90; i++) scrub(-985 + r() * 1970, -985 + r() * 900, 10 + r() * 20, 30);

    // ---- mirror everything north (z to -z; a turn about y becomes pi minus it, which mirrors a box exactly)
    const n = props.length; for (let i = 0; i < n; i++) { const p = props[i]; props.push({ ...p, z: -p.z, rot: [-p.rot[0], Math.PI - p.rot[1], p.rot[2]], ...(p.az !== undefined ? { az: -p.az } : {}) }); }
    const no = obstacles.length; for (let i = 0; i < no; i++) { const o = obstacles[i]; obstacles.push({ ...o, minZ: -o.maxZ, maxZ: -o.minZ }); }
    const nt = tufts.length; for (let i = 0; i < nt; i++) { const t = tufts[i]; tufts.push({ ...t, z: -t.z, yaw: Math.PI - t.yaw }); }

    // ---- bridges (absolute heights; the decks are walkable via WorldState.heightAt): deck, railings, piers. The footbridge
    // is planked, with rope rails on posts; its narrow deck between the rails keeps vehicles off it anyway
    for (const b of this.bridges) {
      const sn = Math.sin(b.angle), cs = Math.cos(b.angle), foot = !!b.foot;
      props.push({ geo: `box:${b.w},${foot ? 0.5 : 1.2},${b.len}`, color: foot ? 0x8a6a46 : 0x6a6a6c, x: b.x, y: b.y - (foot ? 0.25 : 0.6), z: b.z, rot: [0, b.angle, 0], cast: true, absY: true });
      for (const side of [-1, 1]) {
        const ox = cs * side * (b.w / 2 - 0.15), oz = -sn * side * (b.w / 2 - 0.15);
        props.push({ geo: `box:${foot ? 0.12 : 0.3},${foot ? 0.1 : 1.1},${b.len}`, color: foot ? 0x6b5236 : 0x8a8a8a, x: b.x + ox, y: b.y + (foot ? 1 : 0.55), z: b.z + oz, rot: [0, b.angle, 0], cast: true, absY: true });
        if (foot) for (let k = -b.len / 2 + 1; k <= b.len / 2 - 1; k += 4) props.push({ geo: 'box:0.14,1.05,0.14', color: 0x6b5236, x: b.x + ox + sn * k, y: b.y + 0.5, z: b.z + oz + cs * k, rot: [0, b.angle, 0], cast: true, absY: true });
        const len = b.len, hw = 0.15, c = Math.abs(cs), s = Math.abs(sn);
        obstacles.push({ minX: b.x + ox - (hw * c + len / 2 * s), maxX: b.x + ox + (hw * c + len / 2 * s), minZ: b.z + oz - (hw * s + len / 2 * c), maxZ: b.z + oz + (hw * s + len / 2 * c), h: b.y + 1.1 });
      }
      for (const k of foot ? [-10, 10] : [-18, 0, 18]) props.push({ geo: foot ? 'box:0.5,8,0.5' : 'box:2.6,10,2.6', color: foot ? 0x6b5236 : 0x7a7a7c, x: b.x + sn * k, y: b.y - (foot ? 4.25 : 5.6), z: b.z + cs * k, rot: [0, b.angle, 0], cast: true, absY: true });
    }

    // ---- roads and tracks
    for (const rd of this.roads) strips.push({ points: rd.points, width: rd.width, tex: rd.tex, vRepeat: rd.tex === 'road' ? 8 : 4, smooth: 2, y: rd.tex === 'road' ? 0.03 : 0.02 });
    return { props, obstacles, lamps, tufts, decals, strips };
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
