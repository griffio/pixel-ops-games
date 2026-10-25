import { clamp, lerp, smoothstep, hexToLinear, lerpColor } from './math.js';
import { Terrain } from './terrain.js';

export const WORLD_SIZE = 160;      // ground is WORLD_SIZE x WORLD_SIZE units, centred on 0
export const HALF = WORLD_SIZE / 2;

export function rand(seed) { // tiny deterministic PRNG
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Static scene as data. Each prop: { geo: 'box:w,h,d' | 'cyl:rt,rb,h,seg', color, x, y, z, rot:[x,y,z], cast }.
// Renderer back ends turn these into meshes; the core only needs the obstacle boxes.
export function buildLayout() {
  const props = [], obstacles = [], lamps = [];
  const box = (w, h, d, color, x, z, { y = 0, rot = 0, obstacle = true, cast = true } = {}) => {
    props.push({ geo: `box:${w},${h},${d}`, color, x, y: y + h / 2, z, rot: [0, rot, 0], cast });
    if (obstacle) {
      const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
      const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
      obstacles.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, h: y + h });
    }
  };
  // hangar
  box(30, 11, 22, 0x8f8a80, -55, 50);
  box(28, 1.5, 0.6, 0x4a4742, -55, 61.2, { y: 9, obstacle: false });
  box(22, 8, 0.4, 0x3b3a38, -55, 61.0, { obstacle: false });
  // control tower
  box(7, 14, 7, 0x9a958b, 70, -70); box(9, 3, 9, 0x5b6a72, 70, -70, { y: 14, obstacle: false });
  // barracks
  box(18, 5, 8, 0x8c8470, -70, -20); box(18, 5, 8, 0x8c8470, -70, -8);
  // containers
  const cols = [0x6f4a3a, 0x44584a, 0x4f5a6b, 0x8a7a3a, 0x5a4a5a];
  const r = rand(3);
  for (let i = 0; i < 14; i++) {
    const x = 10 + (i % 7) * 7, z = -45 - Math.floor(i / 7) * 4;
    box(6, 2.6, 2.5, cols[i % cols.length], x, z, { rot: (r() - 0.5) * 0.15 });
    if (r() < 0.4) box(6, 2.6, 2.5, cols[(i + 2) % cols.length], x, z, { y: 2.6, obstacle: false });
  }
  // fuel tanks (cylinders lying on their side)
  for (let i = 0; i < 3; i++) {
    props.push({ geo: 'cyl:2.2,2.2,9,10', color: 0xb0ab9e, x: 60, y: 2.4, z: 10 + i * 6, rot: [0, 0, Math.PI / 2], cast: true });
    obstacles.push({ minX: 55.5, maxX: 64.5, minZ: 7.8 + i * 6, maxZ: 12.2 + i * 6, h: 4.6 });
  }
  // sandbag walls + jersey barriers
  for (let i = 0; i < 8; i++) box(3, 1.1, 1, 0x9c8b64, -20 + i * 3.2, 20, { rot: 0.1 });
  for (let i = 0; i < 6; i++) box(2.6, 1.2, 0.7, 0xb5b0a4, 30, -10 + i * 3, { rot: Math.PI / 2 });
  // floodlight poles: pole + emissive head + point light
  for (const [x, z] of [[-30, -60], [40, 70], [-75, 75], [75, 75]]) {
    box(0.6, 12, 0.6, 0x3a3a3a, x, z);
    props.push({ geo: 'box:2.2,0.8,1.2', color: 0x222222, emissive: 0xfff2c0, x, y: 12.2, z, rot: [0, 0, 0], cast: true, lampHead: true });
    lamps.push({ x, y: 11, z, color: 0xffe7b0, distance: 55 });
  }
  // palms along the grass strip: tilted trunk, crown, 8 drooping fronds
  const palm = (x, z, tilt) => {
    props.push({ geo: 'cyl:0.2,0.32,9,6', tex: 'trunk', x, y: 4.5, z, rot: [tilt, 0, tilt * 0.6], cast: true });
    const tx = x + Math.sin(tilt * 0.6) * 4.5, tz = z + Math.sin(tilt) * 4.5;
    props.push({ geo: 'cyl:0.55,0.4,0.7,6', tex: 'trunk', x: tx, y: 9.1, z: tz, rot: [0, 0, 0], cast: true });
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + (k % 2) * 0.2, droop = (0.35 + (k % 3) * 0.15).toFixed(2);
      props.push({ geo: 'frond:0.6,0.08,3.6,' + droop, tex: 'frond', x: tx, y: 9.3, z: tz, rot: [0, a, 0], cast: true });
    }
    obstacles.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5, h: 9 });
  };
  for (const [x, z, t] of [[-62, 76, 0.05], [-38, 77.5, -0.04], [-12, 75, 0.08], [16, 78, -0.06], [58, 76, 0.03]]) palm(x, z, t);
  // bushes: overlapping rounded blobs
  const bush = (x, z, s) => {
    for (const [ox, oz, r, h] of [[0, 0, 1.3, 1.6], [0.9, 0.5, 0.9, 1.2], [-0.8, 0.6, 1.0, 1.1], [0.2, -0.9, 0.8, 1.0]])
      props.push({ geo: 'cyl:' + (r * s).toFixed(2) + ',' + (r * s * 1.15).toFixed(2) + ',' + (h * s).toFixed(2) + ',7', tex: 'bush', x: x + ox * s, y: h * s / 2, z: z + oz * s, rot: [0, 0, 0], cast: true });
    obstacles.push({ minX: x - 1.6 * s, maxX: x + 1.6 * s, minZ: z - 1.6 * s, maxZ: z + 1.6 * s, h: 1.6 * s });
  };
  for (const [x, z, s] of [[-72, 72, 1.0], [-50, 78, 0.8], [-24, 72.5, 1.1], [4, 72, 0.9], [34, 77, 1.2], [46, 72, 0.8], [72, 73, 1.0]]) bush(x, z, s);
  // grass tufts: static crossed billboards in three sizes
  const tufts = [], tr = rand(17);
  for (let i = 0; i < 1100; i++) {
    const x = -79 + tr() * 158, z = 70.4 + tr() * 9.2;
    tufts.push({ x, z, yaw: tr() * Math.PI, size: [0.7, 0.9, 1.15][Math.floor(tr() * 3)] });
  }
  return { props, obstacles, lamps, tufts };
}


const WHITE = hexToLinear(0xfff6e6), WARM = hexToLinear(0xffb36a), MOON = hexToLinear(0x8fa8d8);
const SKY_D = hexToLinear(0xcfd8e6), SKY_N = hexToLinear(0x3a4a70), GND_D = hexToLinear(0x6b6050), GND_N = hexToLinear(0x101418);
const BG_D = hexToLinear(0x6b6557), BG_N = hexToLinear(0x121316);

// Sun by day, a gentle moon by night. All colours are linear RGB; intensities follow
// three.js' physical light units so both back ends produce the same image.
export function lighting(time) {
  const a = (time - 6) / 12 * Math.PI, elev = Math.sin(a);
  const az = (time / 24) * Math.PI * 2 + Math.PI * 0.6;
  const night = smoothstep(-elev, -0.05, 0.25);
  const low = clamp(1 - Math.abs(elev) / 0.35, 0, 1);
  const e = elev > 0 ? Math.max(elev, 0.12) : Math.max(-elev * 0.7, 0.3);
  const c = Math.cos(Math.asin(e));
  const sunDir = [Math.cos(az) * c, e, Math.sin(az) * c];
  if (elev <= 0) { sunDir[0] *= -1; sunDir[2] *= -1; }
  return {
    night, sunDir,
    sunColor: lerpColor(lerpColor(WHITE, WARM, low), MOON, night),
    sunI: lerp(2.3 * (0.6 + 0.4 * Math.max(elev, 0)), 0.35, night),
    hemiI: lerp(0.95, 0.22, night),
    hemiSky: lerpColor(SKY_D, SKY_N, night), hemiGround: lerpColor(GND_D, GND_N, night),
    background: lerpColor(BG_D, BG_N, night),
    lampI: 110 * night, lampEmissive: night,
  };
}

export class WorldState {
  // `map` is a map definition (size, build(), bases, locations); without one the
  // legacy 160 m airfield layout is used.
  constructor(map = null) {
    this.map = map; this.size = map ? map.size : WORLD_SIZE; this.half = this.size / 2;
    this.layout = map ? map.build() : buildLayout(); this.obstacles = this.layout.obstacles;
    this.terrain = map && map.terrain ? new Terrain(this.size, 4, { ...map.terrain, flats: map.flats || [] }) : null;
    this.bridges = (map && map.bridges) || [];
    // height including bridge decks (local-frame rectangle test)
    this.heightAt = (x, z) => {
      let h = this.terrain ? this.terrain.height(x, z) : 0;
      for (const b of this.bridges) {
        const dx = x - b.x, dz = z - b.z, c = Math.cos(b.angle), s = Math.sin(b.angle), along = dx * s + dz * c, across = dx * c - dz * s;
        if (Math.abs(along) <= b.len / 2 && Math.abs(across) <= b.w / 2) h = Math.max(h, b.y);
      }
      return h;
    };
    this.onBridge = (x, z) => this.bridges.some(b => { const dx = x - b.x, dz = z - b.z, c = Math.cos(b.angle), s = Math.sin(b.angle); return Math.abs(dx * s + dz * c) <= b.len / 2 && Math.abs(dx * c - dz * s) <= b.w / 2; });

    this.time = 14; this.timeSpeed = 60; this.day = 1;
    this.light = lighting(this.time);
  }

  phase() {
    const t = this.time;
    if (t >= 5 && t < 7) return 'Dawn'; if (t >= 7 && t < 18) return 'Day';
    if (t >= 18 && t < 20) return 'Dusk'; return 'Night';
  }
  nextPhase() { // [name, hoursUntil]
    const t = this.time, marks = [[5, 'Dawn'], [7, 'Day'], [18, 'Dusk'], [20, 'Night'], [29, 'Dawn']];
    for (const [h, n] of marks) if (t < h) return [n, h - t];
    return ['Dawn', 29 - t];
  }
  update(dt) {
    this.time += dt * this.timeSpeed / 3600;
    if (this.time >= 24) { this.time -= 24; this.day++; }
    this.light = lighting(this.time); this.night = this.light.night;
  }
  // obstacles bucketed in 8 m cells, rebuilt whenever the list grows (sandbags), so a query only touches the boxes nearby
  obstacleGrid() {
    if (this._grid && this._gridN === this.obstacles.length) return this._grid;
    const g = new Map();
    for (const o of this.obstacles) for (let cz = Math.floor(o.minZ / 8); cz <= Math.floor(o.maxZ / 8); cz++) for (let cx = Math.floor(o.minX / 8); cx <= Math.floor(o.maxX / 8); cx++) { const k = cx * 4096 + cz; let a = g.get(k); if (!a) g.set(k, a = []); a.push(o); }
    this._grid = g; this._gridN = this.obstacles.length; return g;
  }
  obstaclesNear(x, z, pad, fn) {
    const g = this.obstacleGrid();
    for (let cz = Math.floor((z - pad) / 8); cz <= Math.floor((z + pad) / 8); cz++) for (let cx = Math.floor((x - pad) / 8); cx <= Math.floor((x + pad) / 8); cx++) { const a = g.get(cx * 4096 + cz); if (a) for (const o of a) if (fn(o)) return true; }
    return false;
  }
  isBlocked(x, z, pad = 0) { return this.obstaclesNear(x, z, pad, (o) => x > o.minX - pad && x < o.maxX + pad && z > o.minZ - pad && z < o.maxZ + pad); }
  // how deep a point sits inside the padded obstacles (0 when clear): lets a unit that ended up too close to a wall back out
  penetration(x, z, pad = 0) {
    let deepest = 0;
    this.obstaclesNear(x, z, pad, (o) => { if (x > o.minX - pad && x < o.maxX + pad && z > o.minZ - pad && z < o.maxZ + pad) deepest = Math.max(deepest, Math.min(x - (o.minX - pad), o.maxX + pad - x, z - (o.minZ - pad), o.maxZ + pad - z)); return false; });
    return deepest;
  }
}
