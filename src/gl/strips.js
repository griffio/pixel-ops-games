// Triangle-strip geometry along a polyline (roads, tracks, painted lines). u runs
// 0..1 across the width, v along the length in world units / vRepeat, so a strip
// texture tiles along the road. Output matches buildGeometry(): interleaved
// [px py pz nx ny nz u v] + Uint16 indices.
export function stripGeometry(points, width, vRepeat = 8, y = 0.03, heightAt = null, spacing = 3) {
  // resample so the strip can follow terrain between the polyline's own vertices
  if (heightAt) {
    const out = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
      for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    points = out;
  }
  const v = [], idx = [], hw = width / 2;
  let dist = 0;
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    let dx = next[0] - prev[0], dz = next[1] - prev[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz, nz = dx;                               // left normal
    if (i > 0) dist += Math.hypot(x - points[i - 1][0], z - points[i - 1][1]);
    const t = dist / vRepeat;
    const xl = x + nx * hw, zl = z + nz * hw, xr = x - nx * hw, zr = z - nz * hw;
    v.push(xl, y + (heightAt ? heightAt(xl, zl) : 0), zl, 0, 1, 0, 0, t);
    v.push(xr, y + (heightAt ? heightAt(xr, zr) : 0), zr, 0, 1, 0, 1, t);
    if (i > 0) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }   // counter-clockwise from above
  }
  return { data: new Float32Array(v), idx: new Uint16Array(idx), count: idx.length };
}

// Flat quad decal (helipad, parking bay) of size w x d centred at the origin, UV 0..1.
export function decalGeometry(w, d, y = 0.04) {
  const x = w / 2, z = d / 2;
  return {
    data: new Float32Array([-x, y, z, 0, 1, 0, 0, 0, x, y, z, 0, 1, 0, 1, 0, x, y, -z, 0, 1, 0, 1, 1, -x, y, -z, 0, 1, 0, 0, 1]),
    idx: new Uint16Array([0, 1, 2, 0, 2, 3]), count: 6,
  };
}
