// Geometry generators keyed by string so meshes can share buffers (both back ends use them).
// Output is interleaved [px py pz nx ny nz u v] + Uint16 indices.
// Box and cylinder UVs are in WORLD units scaled by UV_SCALE, so a camo texture has the
// same grain on a 0.2-unit arm as on a 7-unit hull instead of being stretched per face.
export const UV_SCALE = 0.5;   // one texture repeat every 2 world units
export function buildGeometry(key) {
  const [type, args] = key.split(':'); const a = args.split(',').map(Number);
  switch (type) {
    case 'box': return box(a[0], a[1], a[2]);
    case 'cyl': return cylinder(a[0], a[1], a[2], a[3]);
    case 'ring': return ring(a[0], a[1], a[2]);
    case 'plane': return plane(a[0], a[1]);
    default: throw new Error('unknown geometry ' + key);
  }
}

function pack(verts, idx) { return { data: new Float32Array(verts), idx: new Uint16Array(idx), count: idx.length }; }

function box(w, h, d) {
  const x = w / 2, y = h / 2, z = d / 2, v = [], i = [];
  // [normal, u-axis, v-axis] per face, matching three.js BoxGeometry orientation
  const faces = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  for (const [n, u, vv] of faces) {
    const base = v.length / 8;
    const eu = Math.abs(u[0] * x + u[1] * y + u[2] * z), ev = Math.abs(vv[0] * x + vv[1] * y + vv[2] * z); // half extents along u, v
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      v.push(n[0] * x + u[0] * x * su + vv[0] * x * sv, n[1] * y + u[1] * y * su + vv[1] * y * sv, n[2] * z + u[2] * z * su + vv[2] * z * sv,
        n[0], n[1], n[2], (su + 1) * eu * UV_SCALE, (sv + 1) * ev * UV_SCALE);
    }
    i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return pack(v, i);
}

function cylinder(rt, rb, h, seg) {
  const v = [], i = [], hh = h / 2, slope = (rb - rt) / h;
  for (let s = 0; s <= seg; s++) {
    const t = s / seg * Math.PI * 2, sn = Math.sin(t), cs = Math.cos(t), nl = Math.hypot(1, slope);
    const uu = s / seg * Math.PI * (rt + rb) * UV_SCALE;
    v.push(rt * sn, hh, rt * cs, sn / nl, slope / nl, cs / nl, uu, h * UV_SCALE);
    v.push(rb * sn, -hh, rb * cs, sn / nl, slope / nl, cs / nl, uu, 0);
  }
  for (let s = 0; s < seg; s++) { const a = s * 2; i.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  for (const [r, y, ny] of [[rt, hh, 1], [rb, -hh, -1]]) {
    const c = v.length / 8; v.push(0, y, 0, 0, ny, 0, 0.5, 0.5);
    for (let s = 0; s <= seg; s++) { const t = s / seg * Math.PI * 2; v.push(r * Math.sin(t), y, r * Math.cos(t), 0, ny, 0, r * Math.sin(t) * UV_SCALE, r * Math.cos(t) * UV_SCALE); }
    for (let s = 0; s < seg; s++) ny > 0 ? i.push(c, c + 1 + s, c + 2 + s) : i.push(c, c + 2 + s, c + 1 + s);
  }
  return pack(v, i);
}

function ring(inner, outer, seg) {
  const v = [], i = [];
  for (let s = 0; s <= seg; s++) {
    const t = s / seg * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t);
    v.push(outer * cs, outer * sn, 0, 0, 0, 1, 0.5, 0.5); v.push(inner * cs, inner * sn, 0, 0, 0, 1, 0.5, 0.5);
  }
  for (let s = 0; s < seg; s++) { const a = s * 2; i.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  return pack(v, i);
}

function plane(w, h) {
  const x = w / 2, y = h / 2;
  return pack([-x, -y, 0, 0, 0, 1, 0, 0, x, -y, 0, 0, 0, 1, 1, 0, x, y, 0, 0, 0, 1, 1, 1, -x, y, 0, 0, 0, 1, 0, 1], [0, 1, 2, 0, 2, 3]);
}
