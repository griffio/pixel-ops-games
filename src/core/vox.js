// MagicaVoxel .vox files: a reader, a writer and a greedy mesher. A file holds a palette of 256 colours (index 0 is empty),
// models as lists of (x, y, z, colour) voxels in a box, and a scene graph of named transforms, groups and shapes. The game
// reads one voxel as VOXEL metres, and maps MagicaVoxel's z-up, right-handed space onto its own (y up, +z forward in a
// model's frame) with x negated, which keeps the handedness: game (x, y, z) = (-vx, vz, vy) from the model's centre.
// Colours are not vertex attributes: each quad's UV points at its palette index in a 256 x 1 palette texture, so a model is
// one geometry per part under the renderer's usual materials.
export const VOXEL = 0.1;
const GROW = 0.002;   // metres each mesh quad grows past its voxels, closing rasteriser cracks at T-junctions

const te = new TextEncoder(), td = new TextDecoder();
function reader(buf) {
  const v = new DataView(buf); let o = 0;
  return { get o() { return o; }, set o(n) { o = n; }, i32: () => { const x = v.getInt32(o, true); o += 4; return x; }, u8: () => v.getUint8(o++), str: (n) => { const s = td.decode(new Uint8Array(buf, o, n)); o += n; return s; },
    dict: () => { const d = {}; const n = v.getInt32(o, true); o += 4; for (let i = 0; i < n; i++) { const kl = v.getInt32(o, true); o += 4; const k = td.decode(new Uint8Array(buf, o, kl)); o += kl; const vl = v.getInt32(o, true); o += 4; d[k] = td.decode(new Uint8Array(buf, o, vl)); o += vl; } return d; } };
}

// -> { palette: Uint8Array(1024) (rgba by index, index 0 empty), models: [{ sx, sy, sz, v: Uint8Array(sx*sy*sz) }], nodes: Map,
//      root: node id } where a node is { id, type: 'trn'|'grp'|'shp', name, hidden, child, children, models, t: [x, y, z], r }
export function parseVox(buf) {
  const r = reader(buf);
  if (r.str(4) !== 'VOX ') throw new Error('not a .vox file'); r.i32();
  const out = { palette: new Uint8Array(256 * 4), models: [], nodes: new Map(), root: null }; let size = null;
  for (let i = 1; i < 256; i++) { out.palette[i * 4] = out.palette[i * 4 + 1] = out.palette[i * 4 + 2] = Math.round((i - 1) / 254 * 255); out.palette[i * 4 + 3] = 255; }   // the default palette is greys until RGBA says otherwise
  const chunk = () => {
    const id = r.str(4), n = r.i32(), m = r.i32(), start = r.o;
    if (id === 'SIZE') size = [r.i32(), r.i32(), r.i32()];
    else if (id === 'XYZI') { const [sx, sy, sz] = size, v = new Uint8Array(sx * sy * sz), cnt = r.i32(); for (let k = 0; k < cnt; k++) { const x = r.u8(), y = r.u8(), z = r.u8(), c = r.u8(); if (x < sx && y < sy && z < sz) v[(z * sy + y) * sx + x] = c; } out.models.push({ sx, sy, sz, v }); }
    else if (id === 'RGBA') { for (let k = 0; k < 255; k++) { out.palette[(k + 1) * 4] = r.u8(); out.palette[(k + 1) * 4 + 1] = r.u8(); out.palette[(k + 1) * 4 + 2] = r.u8(); out.palette[(k + 1) * 4 + 3] = r.u8(); } }
    else if (id === 'nTRN') { const nid = r.i32(), d = r.dict(), child = r.i32(); r.i32(); r.i32(); const frames = r.i32(); let t = [0, 0, 0], rot = 4; for (let f = 0; f < frames; f++) { const fd = r.dict(); if (f === 0) { if (fd._t) t = fd._t.split(' ').map(Number); if (fd._r) rot = +fd._r; } } out.nodes.set(nid, { id: nid, type: 'trn', name: d._name || '', hidden: d._hidden === '1', child, t, r: rot }); if (out.root === null) out.root = nid; }
    else if (id === 'nGRP') { const nid = r.i32(), d = r.dict(), cnt = r.i32(), children = []; for (let k = 0; k < cnt; k++) children.push(r.i32()); out.nodes.set(nid, { id: nid, type: 'grp', name: d._name || '', children }); }
    else if (id === 'nSHP') { const nid = r.i32(), d = r.dict(), cnt = r.i32(), models = []; for (let k = 0; k < cnt; k++) { models.push(r.i32()); r.dict(); } out.nodes.set(nid, { id: nid, type: 'shp', name: d._name || '', models }); }
    r.o = start + n;
    const end = r.o + m; while (r.o < end) chunk();
  };
  chunk();   // MAIN, whose children are the rest
  return out;
}

// { palette: Uint8Array(1024), models: [{ sx, sy, sz, v }], scene: [{ name, t: [x, y, z], model?: index, children?: [...] }] } -> ArrayBuffer.
// The scene becomes MagicaVoxel's root transform (id 0) over a group (id 1) of named transforms, each over a shape or a group.
export function writeVox({ palette, models, scene }) {
  const parts = [];
  const u8 = (...a) => parts.push(Uint8Array.from(a)), i32 = (...a) => { const b = new Uint8Array(a.length * 4), v = new DataView(b.buffer); a.forEach((x, i) => v.setInt32(i * 4, x, true)); parts.push(b); };
  const str = (s) => { const b = te.encode(s); i32(b.length); parts.push(b); }, dict = (d) => { const ks = Object.keys(d); i32(ks.length); for (const k of ks) { str(k); str(String(d[k])); } };
  const chunkOf = (id, body) => { const save = parts.length; body(); const inner = parts.splice(save); const n = inner.reduce((s, p) => s + p.length, 0); parts.push(te.encode(id)); i32(n, 0); parts.push(...inner); };
  const main = [];   // chunks inside MAIN, built the same way then spliced in
  const save0 = parts.length;
  for (const m of models) {
    chunkOf('SIZE', () => i32(m.sx, m.sy, m.sz));
    chunkOf('XYZI', () => { const vox = []; for (let z = 0; z < m.sz; z++) for (let y = 0; y < m.sy; y++) for (let x = 0; x < m.sx; x++) { const c = m.v[(z * m.sy + y) * m.sx + x]; if (c) vox.push(x, y, z, c); } i32(vox.length / 4); parts.push(Uint8Array.from(vox)); });
  }
  let nextId = 2; const nodeChunks = [];
  const emitNode = (node) => {   // returns the id of the transform made for this node
    const tid = nextId++;
    if (node.children) { const gid = nextId++, kids = node.children.map(emitNode); nodeChunks.push(['nTRN', tid, node, gid], ['nGRP', gid, kids]); }
    else { const sid = nextId++; nodeChunks.push(['nTRN', tid, node, sid], ['nSHP', sid, node.model]); }
    return tid;
  };
  const top = scene.map(emitNode);
  chunkOf('nTRN', () => { i32(0); dict({}); i32(1); i32(-1); i32(-1); i32(1); dict({}); });
  chunkOf('nGRP', () => { i32(1); dict({}); i32(top.length); i32(...top); });
  for (const c of nodeChunks) {
    if (c[0] === 'nTRN') chunkOf('nTRN', () => { i32(c[1]); dict(c[2].name ? { _name: c[2].name } : {}); i32(c[3]); i32(-1); i32(-1); i32(1); dict({ _t: c[2].t.map(Math.round).join(' ') }); });
    else if (c[0] === 'nGRP') chunkOf('nGRP', () => { i32(c[1]); dict({}); i32(c[2].length); i32(...c[2]); });
    else chunkOf('nSHP', () => { i32(c[1]); dict({}); i32(1); i32(c[2]); dict({}); });
  }
  chunkOf('RGBA', () => { for (let i = 1; i <= 255; i++) u8(palette[i * 4], palette[i * 4 + 1], palette[i * 4 + 2], palette[i * 4 + 3] || 255); u8(0, 0, 0, 0); });
  const inner = parts.splice(save0); const n = inner.reduce((s, p) => s + p.length, 0);
  parts.push(te.encode('VOX ')); i32(150); parts.push(te.encode('MAIN')); i32(0, n); parts.push(...inner);
  const total = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(total); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out.buffer;
}

// a model's voxels -> geometry in the game's frame, centred on the model's box centre, as the renderer's { data (x, y, z, nx,
// ny, nz, u, v), idx, count }: every exposed face, neighbouring faces of one colour merged into one quad (greedy meshing),
// the UV pointing at the colour's palette slot
export function meshModel(m, voxel = VOXEL) {
  const { sx, sy, sz, v } = m, inGrid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz, id = (x, y, z) => (z * sy + y) * sx + x;
  // air reachable from outside the grid, by flood fill from its faces: faces onto enclosed air (a hollowed shell's inside) never show
  const outside = new Uint8Array(sx * sy * sz), stack = [];
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) if ((x === 0 || y === 0 || z === 0 || x === sx - 1 || y === sy - 1 || z === sz - 1) && !v[id(x, y, z)]) { outside[id(x, y, z)] = 1; stack.push(x, y, z); }
  while (stack.length) { const z = stack.pop(), y = stack.pop(), x = stack.pop(); for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const nx = x + dx, ny = y + dy, nz = z + dz; if (inGrid(nx, ny, nz) && !v[id(nx, ny, nz)] && !outside[id(nx, ny, nz)]) { outside[id(nx, ny, nz)] = 1; stack.push(nx, ny, nz); } } }
  const ENCLOSED = 256, at = (x, y, z) => !inGrid(x, y, z) ? 0 : v[id(x, y, z)] || (outside[id(x, y, z)] ? 0 : ENCLOSED);
  const verts = [], idx = []; const cx = sx / 2, cy = sy / 2, cz = sz / 2;
  const toGame = (x, y, z) => [-(x - cx) * voxel, (z - cz) * voxel, (y - cy) * voxel];
  const dims = [sx, sy, sz];
  // sweep each axis d in both directions; u, w are the other two axes; a mask over the slice holds the colour of the face to make
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, w = (d + 2) % 3, x = [0, 0, 0], q = [0, 0, 0]; q[d] = 1;
    const mask = new Int16Array(dims[u] * dims[w]);
    for (x[d] = -1; x[d] < dims[d];) {
      let n = 0;
      for (x[w] = 0; x[w] < dims[w]; x[w]++) for (x[u] = 0; x[u] < dims[u]; x[u]++) {
        const a = x[d] >= 0 ? at(x[0], x[1], x[2]) : 0, b = x[d] < dims[d] - 1 ? at(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : 0;
        mask[n++] = a && a !== ENCLOSED && !b ? a : (!a && b && b !== ENCLOSED ? -b : 0);   // + faces the +d way from a, - faces the -d way from b
      }
      x[d]++; n = 0;
      for (let j = 0; j < dims[w]; j++) for (let i = 0; i < dims[u];) {
        const c = mask[n]; if (!c) { i++; n++; continue; }
        let wd = 1; while (i + wd < dims[u] && mask[n + wd] === c) wd++;
        let hd = 1, done = false; while (j + hd < dims[w] && !done) { for (let k = 0; k < wd; k++) if (mask[n + k + hd * dims[u]] !== c) { done = true; break; } if (!done) hd++; }
        x[u] = i; x[w] = j;
        const du = [0, 0, 0], dw = [0, 0, 0]; du[u] = wd; dw[w] = hd;
        const p0 = toGame(x[0], x[1], x[2]), p1 = toGame(x[0] + du[0], x[1] + du[1], x[2] + du[2]), p2 = toGame(x[0] + du[0] + dw[0], x[1] + du[1] + dw[1], x[2] + du[2] + dw[2]), p3 = toGame(x[0] + dw[0], x[1] + dw[1], x[2] + dw[2]);
        const nv = [0, 0, 0]; nv[d] = c > 0 ? 1 : -1; const nn = [-nv[0], nv[2], nv[1]];
        const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
        const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const flip = cr[0] * nn[0] + cr[1] * nn[1] + cr[2] * nn[2] < 0, base = verts.length / 8, uv = [(Math.abs(c) + 0.5) / 256, 0.5];
        // each quad grows by a hair (2 mm) so neighbours overlap: greedy quads meet at T-junctions, where the rasteriser can leave a pixel crack
        const g1 = GROW / Math.hypot(...e1), g2 = GROW / Math.hypot(...e2), grow = (p, s1, s2) => [p[0] + s1 * e1[0] * g1 + s2 * e2[0] * g2, p[1] + s1 * e1[1] * g1 + s2 * e2[1] * g2, p[2] + s1 * e1[2] * g1 + s2 * e2[2] * g2];
        const q0 = grow(p0, -1, -1), q1 = grow(p1, 1, -1), q2 = grow(p2, 1, 1), q3 = grow(p3, -1, 1);
        for (const p of (flip ? [q0, q3, q2, q1] : [q0, q1, q2, q3])) verts.push(p[0], p[1], p[2], nn[0], nn[1], nn[2], uv[0], uv[1]);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        for (let l = 0; l < hd; l++) for (let k = 0; k < wd; k++) mask[n + k + l * dims[u]] = 0;
        i += wd; n += wd;
      }
    }
  }
  return { data: new Float32Array(verts), idx: new Uint16Array(idx), count: idx.length };
}

// the palette as a 256 x 1 canvas (index 0 transparent black), with optional overrides { index: [r, g, b] }
export function paletteCanvas(palette, overrides = null) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 1; const g = c.getContext('2d'), img = g.createImageData(256, 1);
  img.data.set(palette); if (overrides) for (const [i, rgb] of Object.entries(overrides)) { const k = +i * 4; img.data[k] = rgb[0]; img.data[k + 1] = rgb[1]; img.data[k + 2] = rgb[2]; img.data[k + 3] = 255; }
  g.putImageData(img, 0, 0); return c;
}
