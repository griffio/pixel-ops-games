// Minimal math for the engine core. Matrices are column-major Float32Array(16)
// (the WebGL / three.js convention) so the same data feeds either back end.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { this.x = this.y = this.z = s; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
  cross(v) { const { x, y, z } = this; return this.set(y * v.z - z * v.y, z * v.x - x * v.z, x * v.y - y * v.x); }
}

export const Mat4 = {
  create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  identity(m) { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  copy(out, a) { out.set(a); return out; },
  multiply(out, a, b) { // out = a * b
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return out;
  },
  // translation * rotation(Euler XYZ, three.js order) * scale
  fromTRS(te, p, r, s) {
    const a = Math.cos(r.x), b = Math.sin(r.x), c = Math.cos(r.y), d = Math.sin(r.y), e = Math.cos(r.z), f = Math.sin(r.z);
    const ae = a * e, af = a * f, be = b * e, bf = b * f;
    te[0] = c * e * s.x; te[1] = (af + be * d) * s.x; te[2] = (bf - ae * d) * s.x; te[3] = 0;
    te[4] = -c * f * s.y; te[5] = (ae - bf * d) * s.y; te[6] = (be + af * d) * s.y; te[7] = 0;
    te[8] = d * s.z; te[9] = -b * c * s.z; te[10] = a * c * s.z; te[11] = 0;
    te[12] = p.x; te[13] = p.y; te[14] = p.z; te[15] = 1;
    return te;
  },
  ortho(te, left, right, top, bottom, near, far) {
    const w = 1 / (right - left), h = 1 / (top - bottom), p = 1 / (far - near);
    te.fill(0);
    te[0] = 2 * w; te[5] = 2 * h; te[10] = -2 * p; te[15] = 1;
    te[12] = -(right + left) * w; te[13] = -(top + bottom) * h; te[14] = -(far + near) * p;
    return te;
  },
  // camera world matrix looking from eye to target (three.js Matrix4.lookAt + position)
  cameraWorld(te, eye, target, up) {
    const z = eye.clone().sub(target).normalize();
    const x = up.clone().cross(z);
    if (x.length() < 1e-6) x.set(1, 0, 0); else x.normalize();   // looking straight down: pick any horizontal axis
    const y = z.clone().cross(x);
    te[0] = x.x; te[1] = x.y; te[2] = x.z; te[3] = 0;
    te[4] = y.x; te[5] = y.y; te[6] = y.z; te[7] = 0;
    te[8] = z.x; te[9] = z.y; te[10] = z.z; te[11] = 0;
    te[12] = eye.x; te[13] = eye.y; te[14] = eye.z; te[15] = 1;
    return te;
  },
  invert(out, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return Mat4.identity(out);
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },
  // perspective-divide transform of a point; returns a new Vec3
  transformPoint(m, v) {
    const x = v.x, y = v.y, z = v.z;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    return new Vec3((m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w);
  },
  column(m, i) { return new Vec3(m[i * 4], m[i * 4 + 1], m[i * 4 + 2]); },
};

// colour helpers: scene colours are authored as sRGB hex and lit in linear space
export const srgbToLinear = (c) => c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
export const linearToSrgb = (c) => c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;
export const hexToLinear = (hex) => [srgbToLinear(((hex >> 16) & 255) / 255), srgbToLinear(((hex >> 8) & 255) / 255), srgbToLinear((hex & 255) / 255)];
export const lerpColor = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Smooth a polyline with Chaikin subdivision so roads bend instead of kink (the strip renderer, and
// the map keeping props off the road it draws).
export function smooth(points, iterations = 2) {
  let p = points;
  for (let k = 0; k < iterations; k++) {
    const out = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(p[p.length - 1]); p = out;
  }
  return p;
}

// Metres from the centre line of the nearest of a map's roads as drawn (roadPath, and each entry of roads that is not a
// dirt track, smoothed); Infinity on a map without one.
const roadLines = new WeakMap();
export function roadDist(map, x, z) {
  if (!map) return Infinity;
  let L = roadLines.get(map);
  if (!L) roadLines.set(map, L = [...(map.roadPath ? [map.roadPath] : []), ...(map.roads || []).filter(r => r.kind !== 'track').map(r => r.points)].map(p => smooth(p, 2)));
  let best = Infinity;
  for (const P of L) for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); best = Math.min(best, Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t))); }
  return best;
}

// The nearest point on any of a map's roads or dirt tracks: [distance, tangent x, tangent z, x, z] (a unit tangent along
// the road, and the point on its centre line); [Infinity, 0, 1, x, z] on a map without roads. Tank traps lie across the
// road they stand on, centred on it.
const allLines = new WeakMap();
export function roadAlong(map, x, z) {
  if (!map) return [Infinity, 0, 1, x, z];
  let L = allLines.get(map);
  if (!L) allLines.set(map, L = [...(map.roadPath ? [map.roadPath] : []), ...(map.tracks || []), ...(map.roads || []).map(r => r.points)].map(p => smooth(p, 2)));
  let best = [Infinity, 0, 1, x, z];
  for (const P of L) for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz); if (d < best[0]) { const l = Math.sqrt(l2); best = [d, dx / l, dz / l, px, pz]; }
  }
  return best;
}

// Simulation randomness goes through `rng` so a URL seed gives the same scene on
// every back end (three.js consumes Math.random for its own object ids).
export let rng = Math.random;
export function seedRng(seed) {
  let s = seed >>> 0 || 1;
  rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
