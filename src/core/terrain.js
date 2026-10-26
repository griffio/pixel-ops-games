// Heightfield from terrain features (round hills and elongated ridges with cut
// passes), multi-octave value noise for jagged crests, carved rivers with fords,
// and level pads blended in. Sampled bilinearly from a 4 m grid.
function hash(ix, iz) { let n = (ix * 374761393 + iz * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}
export function fbm(x, z, oct = 4) { let s = 0, amp = 0.5, f = 1, norm = 0; for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, z * f); norm += amp; amp *= 0.5; f *= 2.1; } return s / norm; }

function segDist(x, z, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2));
  return Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t));
}

export class Terrain {
  constructor(size, cell = 4, def = {}) {
    this.size = size; this.cell = cell; this.half = size / 2; this.n = Math.round(size / cell) + 1;
    this.water = def.water === undefined ? -Infinity : def.water;
    const features = def.features || [], flats = def.flats || [], rivers = def.rivers || (def.river ? [def.river] : []), fords = def.fords || [];
    const n = this.n, h = this.h = new Float32Array(n * n);
    const feature = (x, z, k) => {
      let t;
      if (k.type === 'ridge') t = 1 - (segDist(x, z, k.x1, k.z1, k.x2, k.z2) / k.w) ** 2;
      else t = 1 - ((x - k.x) ** 2 + (z - k.z) ** 2) / (k.r * k.r);
      if (t <= 0) return 0;
      let y = k.h * Math.pow(t, k.p || 1);
      const jag = k.jag || 0;
      if (jag) y *= 1 - jag * 0.5 + jag * fbm(x * 0.045 + 7, z * 0.045 - 3) + jag * 0.35 * (fbm(x * 0.13, z * 0.13, 3) - 0.5) * t;
      // cuts are capsules running across the ridge (a notch), so the pass has no shoulders
      for (const c of k.cuts || []) {
        let d;
        if (k.type === 'ridge') { const rdx = k.x2 - k.x1, rdz = k.z2 - k.z1, rl = Math.hypot(rdx, rdz) || 1, px = -rdz / rl, pz = rdx / rl, L = c.len || k.w + 30; d = segDist(x, z, c.x - px * L, c.z - pz * L, c.x + px * L, c.z + pz * L); }
        else d = Math.hypot(x - c.x, z - c.z);
        const d2 = (d / c.r) ** 2; if (d2 < 1) { const u = 1 - d2; y *= 1 - u * u * (3 - 2 * u) * 0.92; }
      }
      return y;
    };
    const raw = (x, z) => {
      let y = 1.2 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.4) + 2.6 * (fbm(x * 0.02, z * 0.02) - 0.5) + 0.8 * (fbm(x * 0.09, z * 0.09, 3) - 0.5);
      y = Math.max(y, -2);
      for (const k of features) y += feature(x, z, k);
      return y;
    };
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      const x = ix * cell - this.half, z = iz * cell - this.half;
      let y = raw(x, z);
      for (const f of flats) {                            // level pads with a smooth margin
        const d = Math.hypot(x - f.x, z - f.z); if (d >= f.r + f.m) continue;
        const target = f.y !== undefined ? f.y : (f.y = raw(f.x, f.z));
        const w = d <= f.r ? 1 : 1 - (d - f.r) / f.m;
        y = y + (target - y) * (w * w * (3 - 2 * w));
      }
      for (const river of rivers) {                       // carve each channel, then raise fords into shallows
        let d = Infinity; for (let i = 0; i < river.path.length - 1; i++) d = Math.min(d, segDist(x, z, ...river.path[i], ...river.path[i + 1]));
        const k = Math.max(0, 1 - (d / river.w) ** 2);
        if (k > 0) y += (-river.depth - y) * k;
      }
      if (rivers.length) {
        for (const f of fords) { const d2 = ((x - f.x) ** 2 + (z - f.z) ** 2) / (f.r * f.r); if (d2 < 1 && y < f.bed) y += (f.bed - y) * (1 - d2); }
      }
      h[iz * n + ix] = y;
    }
    let max = -Infinity; for (const y of h) if (y > max) max = y; this.max = max;   // not Math.max(...h): a 2 km map has 250,000 heights, past the argument limit
  }
  height(x, z) {
    const n = this.n, c = this.cell, fx = (x + this.half) / c, fz = (z + this.half) / c;
    const ix = Math.max(0, Math.min(n - 2, Math.floor(fx))), iz = Math.max(0, Math.min(n - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - ix)), tz = Math.max(0, Math.min(1, fz - iz)), h = this.h;
    const a = h[iz * n + ix], b = h[iz * n + ix + 1], cc = h[(iz + 1) * n + ix], d = h[(iz + 1) * n + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (cc * (1 - tx) + d * tx) * tz;
  }
  normal(x, z) {
    const e = this.cell * 0.5, dx = this.height(x + e, z) - this.height(x - e, z), dz = this.height(x, z + e) - this.height(x, z - e);
    const nx = -dx / (2 * e), nz = -dz / (2 * e), l = Math.hypot(nx, 1, nz);
    return [nx / l, 1 / l, nz / l];
  }
  slope(x, z) { const n = this.normal(x, z); return Math.hypot(n[0], n[2]) / n[1]; }
  underwater(x, z) { return this.height(x, z) < this.water; }
  // true when the segment between two points in the air clears the ground
  los(ax, ay, az, bx, by, bz) {
    const d = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(d / 3));
    for (let s = 1; s < steps; s++) { const t = s / steps; if (this.height(ax + (bx - ax) * t, az + (bz - az) * t) > ay + (by - ay) * t - 0.3) return false; }
    return true;
  }
}
