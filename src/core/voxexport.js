// Exports a code-built unit model as a MagicaVoxel .vox file (plus a .json of what the file cannot hold), by voxelising its
// boxes and cylinders at VOXEL metres. Each animated part of the rig (the turret, every wheel, a helicopter's rotor heads,
// a soldier's limbs) becomes its own named model, so the loader (gl/voxmodels.js) can drive it as before; the rest is the
// 'hull'. Colours are sampled from the part's material: a plain colour as itself, a camo texture at the voxel's UV on the box
// face it sits on, snapped to that camo's own colours so the palette stays small. Team-coloured materials also record the
// OPFOR colour for each palette slot they use (meta.team), a second skin tone for the soldier's skin slots (meta.variants,
// one palette variant a build picks at random, as the code model picks its skin), and each part's pivot (meta.pivots), since a part turns about its
// rig node, not its model's centre. Glowing materials (tail lights, nav lights) go in a '<part>.glow' model of their own with
// the glow colour in meta.emissive, since a palette holds no emissive. Runs in the page: tools/export-vox.mjs calls exportVox()
// and saves what it returns.
import { makeBuilders } from './models.js';
import { makeLandmarks } from './landmarks.js';
import { F, MAT } from '../gl/models.js';
import { camoCanvas, CAMO } from './textures.js';
import { Mat4, Vec3 } from './math.js';
import { writeVox, VOXEL } from './vox.js';
import { UV_SCALE } from './geometry.js';

const UNIT = new Vec3(1, 1, 1);
const VOXEL_FOR = { soldier: 0.05, lighthouse: 0.2, shed: 0.15, ship: 0.25 };   // finer than the vehicles' 0.1 m for the soldier (a rifle barrel or a pair of glasses is one voxel either way, but limbs keep their shape); coarser for the big landmarks, whose parts must stay under 255 voxels a side
const TEAMED = ['uniform', 'vest', 'desert', 'camo', 'sand', 'tarp', 'rim', 'boots'];   // the recoloured-per-team materials of core/models.js
const NAME = new Map(Object.entries(MAT).map(([k, v]) => [v, k]));
const canvases = new Map(), canvasFor = (n) => { if (!canvases.has(n)) canvases.set(n, CAMO[n] ? (() => { const c = camoCanvas(CAMO[n]); return { w: c.width, h: c.height, d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data }; })() : null); return canvases.get(n); };
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const srgb = (c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
const nearest = (rgb, list) => list.reduce((best, c) => { const d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2; return d < best[0] ? [d, c] : best; }, [Infinity, list[0]])[1];

// the colour of a material at a point on a box (local coordinates, half extents, world scale: the shader stretches a unit
// box's UVs by its scale per face axis), as [r, g, b] 0..255, with the OPFOR colour where the material is team-coloured
function sample(matName, lx, ly, lz, hw, hh, hd, sc) {
  const m = MAT[matName]; if (!m) return { a: [255, 0, 255] };
  if (!m.tex) { const a = [srgb(m.color[0]), srgb(m.color[1]), srgb(m.color[2])]; const bName = matName + 'B', mb = TEAMED.includes(matName) && MAT[bName]; return { a, b: mb ? [srgb(mb.color[0]), srgb(mb.color[1]), srgb(mb.color[2])] : null }; }
  const ax = Math.abs(lx) / hw, ay = Math.abs(ly) / hh, az = Math.abs(lz) / hd;   // which face is nearest
  let u, v, eu, ev;
  let su, sv;
  if (ax >= ay && ax >= az) { u = lx > 0 ? -lz : lz; v = ly; eu = hd; ev = hh; su = sc[2]; sv = sc[1]; } else if (ay >= az) { u = lx; v = ly > 0 ? -lz : lz; eu = hw; ev = hd; su = sc[0]; sv = sc[2]; } else { u = lz > 0 ? lx : -lx; v = ly; eu = hw; ev = hh; su = sc[0]; sv = sc[1]; }
  const tu = (u + eu) * su * UV_SCALE, tv = (v + ev) * sv * UV_SCALE;
  const pick = (name) => { const c = canvasFor(name); if (!c) return null; const px = Math.floor(((tu % 1) + 1) % 1 * c.w), py = Math.floor(((tv % 1) + 1) % 1 * c.h), i = (py * c.w + px) * 4; return nearest([c.d[i], c.d[i + 1], c.d[i + 2]], CAMO[name].colors.map(hex)); };
  const a = pick(m.tex) || [255, 0, 255], bName = m.tex + 'B', b = TEAMED.includes(m.tex) && CAMO[bName] ? pick(bName) : null;
  return { a, b };
}

// -> { vox: ArrayBuffer, meta: { height, radius, pivots: { part: [x, y, z] }, team: { paletteIndex: [r, g, b] } } }
export function exportVox(type, builder = null) {   // builder: a (team) => { group, parts, height, radius } in place of the code model of that type
  const built = (builder || makeBuilders(F)[type] || makeLandmarks(F)[type])(0), g = built.group, p = built.parts, V = VOXEL_FOR[type] || VOXEL;   // a unit, or a landmark (core/landmarks.js)
  const partOf = new Map();   // rig node -> part name
  const steer = (p.steer || []).map(w => (p.wheels || []).indexOf(w)).filter(i => i >= 0), rotors = [];
  for (const [k, v] of Object.entries(p)) {
    if (k === 'ring' || k === 'steer') continue;
    if (Array.isArray(v)) v.forEach((n, i) => {
      if (n && n.head) {   // a rotor: its head turns, its blades hide behind a blur disc at speed (code-built by the loader)
        partOf.set(n.head, `rotors_${i}`); if (n.blades) partOf.set(n.blades, `blades_${i}`);
        const d = n.disc, a = d && d.geo.slice(4).split(',').map(Number);
        rotors[i] = { dir: n.dir, disc: d ? { geo: `cyl:${d.scale.x},${d.scale.x},${d.scale.y},${a[3]}`, y: +d.position.y.toFixed(3) } : null };
      } else if (n && n.position && !partOf.has(n)) partOf.set(n, `${k}_${i}`);
    });
    else if (v && v.position) partOf.set(v, k);
  }
  const parts = new Map([['hull', { pivot: Mat4.create(), meshes: [] }]]), parent = {};
  const visit = (node, parentWorld, part) => {
    if (node.visible === false) return;
    Mat4.fromTRS(node.local, node.position, node.rotation, node.scale); parentWorld ? Mat4.multiply(node.world, parentWorld, node.local) : node.world.set(node.local);
    const name = partOf.get(node);
    if (name) {   // a part's frame is its rig node's place and turn, never its scale (a beacon is a scaled unit box: its voxels are 0.1 m, not 0.1 of its size)
      const pivot = Mat4.fromTRS(Mat4.create(), node.position, node.rotation, UNIT); if (parentWorld) Mat4.multiply(pivot, parentWorld, Float32Array.from(pivot));
      if (part !== 'hull') parent[name] = part; part = name; parts.set(name, { pivot, meshes: [] });
    }
    if (node.geo && NAME.has(node.mat) && /^(box|cyl|wedge|frustum):/.test(node.geo)) { const e = node.mat.emissive; parts.get(part).meshes.push({ geo: node.geo, mat: NAME.get(node.mat), world: Float32Array.from(node.world), emis: e && (e[0] || e[1] || e[2]) ? e : null }); }
    for (const c of node.children) visit(c, node.world, part);
  };
  visit(g, null, 'hull');
  // glowing meshes split off into '<part>.glow' (one per glow colour) at the part's pivot, unless the whole part glows
  const emissive = {};
  for (const [name, part] of [...parts]) {
    const lit = part.meshes.filter(m => !m.emis), glows = new Map(); for (const m of part.meshes) if (m.emis) { const k = m.emis.join(','); if (!glows.has(k)) glows.set(k, []); glows.get(k).push(m); }
    if (!glows.size) continue;
    if (!lit.length && glows.size === 1) { emissive[name] = [...glows.values()][0][0].emis.map(x => +x.toFixed(4)); continue; }
    part.meshes = lit;
    let i = 0; for (const ms of glows.values()) { const gn = `${name}.glow${glows.size > 1 ? i++ : ''}`; parts.set(gn, { pivot: part.pivot, meshes: ms }); emissive[gn] = ms[0].emis.map(x => +x.toFixed(4)); }
  }
  const palette = new Uint8Array(256 * 4), index = new Map(), team = {}, models = [], scene = [], pivots = {}, matOf = {};
  const slot = (rgb, rgbB, mat) => { const k = rgb.join(','); if (!index.has(k)) { const i = index.size + 1; if (i > 255) return 255; index.set(k, i); palette.set([rgb[0], rgb[1], rgb[2], 255], i * 4); if (rgbB) team[i] = rgbB; matOf[i] = mat; } return index.get(k); };
  const inv = Mat4.create(), local = Mat4.create(), tmp = new Vec3();
  for (const [name, part] of parts) {
    if (!part.meshes.length) continue;
    Mat4.invert(inv, part.pivot);
    // each mesh in the part's frame, with its half extents and the corners' bounding box
    const ms = part.meshes.map(m => {
      Mat4.multiply(local, inv, m.world); const kind = m.geo.slice(0, m.geo.indexOf(':')), a = m.geo.slice(kind.length + 1).split(',').map(Number), box = kind !== 'cyl';
      // half extents of the shape's own box: a wedge (w, h, d, sf, sb) is a box whose top face is set back sf from the front and sb from
      // the back, so its ends slope; a frustum (w, h, d, w2, h2) tapers from its +z face (w x h) to its -z face (w2 x h2)
      const he = kind === 'box' || kind === 'wedge' ? [a[0] / 2, a[1] / 2, a[2] / 2] : kind === 'frustum' ? [Math.max(a[0], a[3]) / 2, Math.max(a[1], a[4]) / 2, a[2] / 2] : [Math.max(a[0], a[1]), a[2] / 2, Math.max(a[0], a[1])];
      const sc = [Math.hypot(local[0], local[1], local[2]), Math.hypot(local[4], local[5], local[6]), Math.hypot(local[8], local[9], local[10])];
      let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const q = Mat4.transformPoint(local, tmp.set(sx * he[0], sy * he[1], sz * he[2])); min = min.map((v, i) => Math.min(v, [q.x, q.y, q.z][i])); max = max.map((v, i) => Math.max(v, [q.x, q.y, q.z][i])); }
      return { ...m, kind, local: Float32Array.from(local), inv: (() => { const o = Mat4.create(); Mat4.invert(o, local); return o; })(), he, box, a, sc, min, max };
    });
    const lo = [0, 1, 2].map(i => Math.min(...ms.map(m => m.min[i])) - V * 0.5), hi = [0, 1, 2].map(i => Math.max(...ms.map(m => m.max[i])) + V * 0.5);
    const sx = Math.max(1, Math.ceil((hi[0] - lo[0]) / V)), sy = Math.max(1, Math.ceil((hi[2] - lo[2]) / V)), sz = Math.max(1, Math.ceil((hi[1] - lo[1]) / V));
    const v = new Uint8Array(sx * sy * sz), gmaxX = lo[0] + sx * V;
    const prio = new Float32Array(sx * sy * sz).fill(Infinity);   // where shapes overlap the thinnest claims the voxel: plates, lights and glass over the bulk they sit on
    for (const m of ms) {
      // a voxel is taken by its centre, so a box keeps its size; one thinner than a voxel in some axis widens to a voxel in
      // that axis (a skirt, a window, a pair of glasses keeps one layer) rather than every box growing half a voxel a side
      const tol = m.sc.map((s, i) => Math.max(0.02 * V, (V - 2 * m.he[i] * s) / 2) / s);
      const thin = Math.min(m.he[0] * m.sc[0], m.he[1] * m.sc[1], m.he[2] * m.sc[2]);
      const i0 = Math.max(0, Math.floor((gmaxX - m.max[0]) / V)), i1 = Math.min(sx - 1, Math.floor((gmaxX - m.min[0]) / V));
      const j0 = Math.max(0, Math.floor((m.min[2] - lo[2]) / V)), j1 = Math.min(sy - 1, Math.floor((m.max[2] - lo[2]) / V));
      const k0 = Math.max(0, Math.floor((m.min[1] - lo[1]) / V)), k1 = Math.min(sz - 1, Math.floor((m.max[1] - lo[1]) / V));
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const gx = gmaxX - (i + 0.5) * V, gy = lo[1] + (k + 0.5) * V, gz = lo[2] + (j + 0.5) * V;
        const q = Mat4.transformPoint(m.inv, tmp.set(gx, gy, gz));
        let inside;
        if (m.kind === 'box') inside = Math.abs(q.x) <= m.he[0] + tol[0] && Math.abs(q.y) <= m.he[1] + tol[1] && Math.abs(q.z) <= m.he[2] + tol[2];
        else if (m.kind === 'frustum') { const t = Math.max(0, Math.min(1, (m.he[2] - q.z) / (2 * m.he[2]))), hw = (m.a[0] + (m.a[3] - m.a[0]) * t) / 2, hh = (m.a[1] + (m.a[4] - m.a[1]) * t) / 2; inside = Math.abs(q.z) <= m.he[2] + tol[2] && Math.abs(q.x) <= hw + tol[0] && Math.abs(q.y) <= hh + tol[1]; }
        else if (m.kind === 'wedge') { const t = Math.max(0, Math.min(1, (q.y + m.he[1]) / (2 * m.he[1]))), zf = m.he[2] - (m.a[3] || 0) * t, zb = -m.he[2] + (m.a[4] || 0) * t; inside = Math.abs(q.x) <= m.he[0] + tol[0] && Math.abs(q.y) <= m.he[1] + tol[1] && q.z <= zf + tol[2] && q.z >= zb - tol[2]; }
        else { const rt = m.a[0], rb = m.a[1], h = m.a[2], t = h ? (q.y + h / 2) / h : 0.5, r = rb + (rt - rb) * Math.max(0, Math.min(1, t)); inside = Math.abs(q.y) <= h / 2 + tol[1] && Math.hypot(q.x, q.z) <= r + Math.max(tol[0], tol[2]); }
        const at = (k * sy + j) * sx + i;
        if (!inside || thin > prio[at]) continue;
        const c = sample(m.mat, q.x, q.y, q.z, m.he[0], m.he[1], m.he[2], m.sc);
        v[at] = slot(c.a, c.b, m.mat); prio[at] = thin;
      }
    }
    // hollow: a voxel boxed in on all six sides never shows, and a solid hull would make the file several times the size
    const solid = Uint8Array.from(v), at = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && solid[(z * sy + y) * sx + x];
    for (let k = 1; k < sz - 1; k++) for (let j = 1; j < sy - 1; j++) for (let i = 1; i < sx - 1; i++) if (at(i, j, k) && at(i - 1, j, k) && at(i + 1, j, k) && at(i, j - 1, k) && at(i, j + 1, k) && at(i, j, k - 1) && at(i, j, k + 1)) v[(k * sy + j) * sx + i] = 0;
    const centre = [(lo[0] + gmaxX) / 2, lo[1] + sz * V / 2, lo[2] + sy * V / 2], pv = [part.pivot[12], part.pivot[13], part.pivot[14]];
    const t = [-(pv[0] + centre[0]) / V, (pv[2] + centre[2]) / V, (pv[1] + centre[1]) / V];   // the model's centre in the root frame, vox units
    scene.push({ name, t, model: models.length }); models.push({ sx, sy, sz, v }); pivots[name] = pv.map(x => +x.toFixed(3));
  }
  // the other skin tone as a palette variant, for the slots the skin took
  const skin = Object.values(matOf).find(m => m === 'skin' || m === 'skin2'), other = skin === 'skin' ? 'skin2' : 'skin', variants = [];
  if (skin) { const c = MAT[other].color, rgb = [srgb(c[0]), srgb(c[1]), srgb(c[2])], v = {}; for (const [i, m] of Object.entries(matOf)) if (m === skin) v[i] = rgb; variants.push(v); }
  // a landmark's recolours: each variant maps material names to a hex colour, for the slots those materials took
  for (const vm of built.variants || []) { const v = {}; for (const [i, m] of Object.entries(matOf)) if (vm[m] !== undefined) v[i] = [(vm[m] >> 16) & 255, (vm[m] >> 8) & 255, vm[m] & 255]; variants.push(v); }
  const ring = p.ring && p.ring.geo ? +p.ring.geo.split(':')[1].split(',')[1] : undefined;   // the selection ring's radius (ring:in,out,seg)
  return { vox: writeVox({ palette, models, scene }), meta: { type, voxel: V, height: built.height, radius: built.radius, ring, pivots, parent, steer, rotors: rotors.length ? rotors : undefined, team, variants: variants.length ? variants : undefined, emissive, colours: index.size } };
}
