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
    case 'wedge': return wedge(a[0], a[1], a[2], a[3], a[4] || 0);
    case 'frustum': return frustum(a[0], a[1], a[2], a[3], a[4]);
    case 'frond': return frond(a[0], a[1], a[2], a[3]);
    case 'tuft': return tuft(a[0], a[1]);
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

// ---- convex solids built from quads ------------------------------------------
// Each quad gets a flat normal from its edges, oriented away from `hint` (the
// solid's centre), so winding never has to be tracked by hand. UVs are planar
// along the quad's edges in world units.
function addQuad(v, i, p0, p1, p2, p3, hint = [0, 0, 0]) {
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
  let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const l = Math.hypot(...n) || 1; n = n.map(c => c / l);
  const cx = (p0[0] + p1[0] + p2[0] + p3[0]) / 4 - hint[0], cy = (p0[1] + p1[1] + p2[1] + p3[1]) / 4 - hint[1], cz = (p0[2] + p1[2] + p2[2] + p3[2]) / 4 - hint[2];
  let pts = [p0, p1, p2, p3];
  if (n[0] * cx + n[1] * cy + n[2] * cz < 0) { n = n.map(c => -c); pts = [p0, p3, p2, p1]; }
  const t1 = e1.map(c => c / (Math.hypot(...e1) || 1)), t2 = e2.map(c => c / (Math.hypot(...e2) || 1));
  const base = v.length / 8;
  for (const p of pts) {
    const d = [p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]];
    v.push(p[0], p[1], p[2], n[0], n[1], n[2], (d[0] * t1[0] + d[1] * t1[1] + d[2] * t1[2]) * UV_SCALE, (d[0] * t2[0] + d[1] * t2[1] + d[2] * t2[2]) * UV_SCALE);
  }
  i.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

// Box whose top-front edge is set back by sf and top-back edge by sb (sloped glacis / nose).
function wedge(w, h, d, sf, sb) {
  const x = w / 2, y = h / 2, z = d / 2, v = [], i = [];
  const B0 = [-x, -y, -z], B1 = [x, -y, -z], B2 = [x, -y, z], B3 = [-x, -y, z];
  const T0 = [-x, y, -z + sb], T1 = [x, y, -z + sb], T2 = [x, y, z - sf], T3 = [-x, y, z - sf];
  addQuad(v, i, B0, B1, B2, B3); addQuad(v, i, T0, T1, T2, T3); addQuad(v, i, B3, B2, T2, T3);
  addQuad(v, i, B0, B1, T1, T0); addQuad(v, i, B0, B3, T3, T0); addQuad(v, i, B1, B2, T2, T1);
  return pack(v, i);
}

// Tapered box: front face (+z) is w x h, back face (-z) is w2 x h2.
function frustum(w, h, d, w2, h2) {
  const x = w / 2, y = h / 2, z = d / 2, x2 = w2 / 2, y2 = h2 / 2, v = [], i = [];
  const F0 = [-x, -y, z], F1 = [x, -y, z], F2 = [x, y, z], F3 = [-x, y, z];
  const K0 = [-x2, -y2, -z], K1 = [x2, -y2, -z], K2 = [x2, y2, -z], K3 = [-x2, y2, -z];
  addQuad(v, i, F0, F1, F2, F3); addQuad(v, i, K0, K1, K2, K3); addQuad(v, i, F0, F1, K1, K0);
  addQuad(v, i, F3, F2, K2, K3); addQuad(v, i, F0, F3, K3, K0); addQuad(v, i, F1, F2, K2, K1);
  return pack(v, i);
}

// Palm frond: a thin box from the origin along +z, pitched down by `droop` and narrowing to the tip.
function frond(w, t, len, droop) {
  const c = Math.cos(droop), s = -Math.sin(droop), v = [], i = [];
  const P = (x, y, z) => [x, y * c + z * s, -y * s + z * c];  // rotate about x by -droop
  const B0 = P(-w / 2, -t / 2, 0), B1 = P(w / 2, -t / 2, 0), B2 = P(w / 6, -t / 2, len), B3 = P(-w / 6, -t / 2, len);
  const T0 = P(-w / 2, t / 2, 0), T1 = P(w / 2, t / 2, 0), T2 = P(w / 6, t / 2, len), T3 = P(-w / 6, t / 2, len);
  const hint = P(0, 0, len / 2);
  addQuad(v, i, B0, B1, B2, B3, hint); addQuad(v, i, T0, T1, T2, T3, hint); addQuad(v, i, B0, B1, T1, T0, hint);
  addQuad(v, i, B3, B2, T2, T3, hint); addQuad(v, i, B0, B3, T3, T0, hint); addQuad(v, i, B1, B2, T2, T1, hint);
  return pack(v, i);
}

// Grass tuft: two crossed vertical quads, each emitted twice so both sides survive culling. UVs 0..1.
function tuft(w, h) {
  const x = w / 2, v = [], i = [];
  const quad = (a, b, c, d, n) => { const base = v.length / 8; for (const [p, uv] of [[a, [0, 0]], [b, [1, 0]], [c, [1, 1]], [d, [0, 1]]]) v.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1]); i.push(base, base + 1, base + 2, base, base + 2, base + 3); };
  quad([-x, 0, 0], [x, 0, 0], [x, h, 0], [-x, h, 0], [0, 0, 1]); quad([x, 0, 0], [-x, 0, 0], [-x, h, 0], [x, h, 0], [0, 0, -1]);
  quad([0, 0, -x], [0, 0, x], [0, h, x], [0, h, -x], [1, 0, 0]); quad([0, 0, x], [0, 0, -x], [0, h, -x], [0, h, x], [-1, 0, 0]);
  return pack(v, i);
}
