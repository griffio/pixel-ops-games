// Tileable ground textures and decals, generated on canvases. World-space UVs tile them at a fixed density: the natural
// ground (grass, meadow, sand, dirt) at 10 px a metre, one texel to a pixel of the game's buffer at normal zoom, so its
// grain stays crisp instead of averaging away; the made surfaces at 16 px a metre (4 for the big concrete slabs).
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function prng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function noisy(g, w, h, base, amount, r, count = w * h / 2) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const a = r() * amount; g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.8})`;
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + Math.floor(r() * 2), 1);
  }
}

// tileable value noise: a lattice of cells x cells random values that wraps, smoothly interpolated over n x n pixels; and
// octaves of it summed (each [cells, weight]) into 0..1
function lattice(n, cells, r) {
  const v = Float32Array.from({ length: cells * cells }, r), out = new Float32Array(n * n), sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const fx = x / n * cells, fy = y / n * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy), x1 = (ix + 1) % cells, y1 = (iy + 1) % cells;
    const a = v[iy * cells + ix], b = v[iy * cells + x1], c = v[y1 * cells + ix], d = v[y1 * cells + x1];
    out[y * n + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }
  return out;
}
function octaves(n, list, r) { const out = new Float32Array(n * n); let w = 0; for (const [cells, k] of list) { const l = lattice(n, cells, r); for (let i = 0; i < out.length; i++) out[i] += l[i] * k; w += k; } for (let i = 0; i < out.length; i++) out[i] /= w; return out; }
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
// a tileable lattice sampler over an n-pixel period: cx x cy random values, smoothly interpolated, any coordinates wrapped
function sampler(n, cx, cy, r) {
  const v = Float32Array.from({ length: cx * cy }, r), sm = (t) => t * t * (3 - 2 * t);
  return (px, py) => {
    const fx = (((px % n) + n) % n) / n * cx, fy = (((py % n) + n) % n) / n * cy, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy), x1 = (ix + 1) % cx, y1 = (iy + 1) % cy;
    const a = v[iy * cx + ix], b = v[iy * cx + x1], c = v[y1 * cx + ix], d = v[y1 * cx + x1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}
// a field standardised to mean 0, spread 1 (so a layer's contrast is what its weight says, however many octaves fed it)
function standard(F) { let m = 0; for (const v of F) m += v; m /= F.length; let q = 0; for (const v of F) q += (v - m) ** 2; const sd = Math.sqrt(q / F.length) || 1; return F.map(v => (v - m) / sd); }
// Natural ground's fine detail (12.8 m at 128 px, wrapping without a seam): the colour with a low-contrast grain of clumps
// under a metre and a half, dabs two pixels wide leaning one way (blades, ripples) and specks. Nothing in it is big or bold
// enough to show the tile repeating: the patches, highlights, hollows and streaks a metre and up come from the ground shader,
// out of noise in world space that never repeats. Colours are [r, g, b].
function detailTile({ seed, base, dark, light, grain = 0.06, strokes, len, slant = 2.356, spread = 0.5, alpha = [0.1, 0.26], lit = 0.6, specks = [] }) {
  const n = 128, [c, g] = canvas(n, n), r = prng(seed), img = g.createImageData(n, n), d = img.data;
  const O = [[8, 1], [16, 0.8], [32, 0.6]].map(([k, w]) => [sampler(n, k, k, r), w]), G = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let v = 0; for (const [f, w] of O) v += f(x, y) * w; G[y * n + x] = v; }
  const Z = standard(G);
  for (let i = 0; i < n * n; i++) { for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = clamp255(base[ch] * (1 + Z[i] * grain)); d[i * 4 + 3] = 255; }
  const put = (x, y, col, a) => { const i = ((((y % n) + n) % n) * n + (((x % n) + n) % n)) * 4; for (let ch = 0; ch < 3; ch++) d[i + ch] = clamp255(d[i + ch] * (1 - a) + col[ch] * a); };
  for (let i = 0; i < strokes; i++) {   // soft dabs two pixels wide, mostly light, leaning one way
    const x = r() * n, y = r() * n, L = len[0] + r() * (len[1] - len[0]), ang = slant + (r() - 0.5) * spread, col = r() < lit ? light : dark, a = alpha[0] + r() * (alpha[1] - alpha[0]);
    for (let s2 = 0; s2 < L; s2++) { const px = Math.floor(x + Math.cos(ang) * s2), py = Math.floor(y + Math.sin(ang) * s2); put(px, py, col, a); put(px + 1, py, col, a * 0.6); }
  }
  for (const [col, count, a] of specks) for (let i = 0; i < count; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); put(x, y, col, a); if (r() < 0.4) put(x + 1, y, col, a * 0.7); }
  g.putImageData(img, 0, 0);
  return c;
}

export function sandTile() {   // 12.8 m: fine grit, wind ripples, shell flecks (dunes and drifts come from the shader)
  return detailTile({ seed: 101, base: [208, 192, 160], dark: [185, 169, 137], light: [230, 217, 187], grain: 0.035, strokes: 240, len: [3, 7], slant: 0.12, spread: 0.18, alpha: [0.08, 0.2],
    specks: [[[150, 130, 98], 260, 0.5], [[232, 222, 196], 140, 0.5]] });
}
export function concreteTile() {   // 16 m: 2x2 slabs with seams
  const [c, g] = canvas(256, 256), r = prng(7);
  for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
    const v = 0.93 + r() * 0.12; g.fillStyle = `rgb(${Math.round(182 * v)},${Math.round(176 * v)},${Math.round(164 * v)})`; g.fillRect(sx * 128, sy * 128, 128, 128);
  }
  for (let i = 0; i < 2600; i++) { const a = 0.05 + r() * 0.12; g.fillStyle = r() < 0.5 ? `rgba(60,50,40,${a})` : `rgba(255,250,240,${a})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 2); }
  g.strokeStyle = 'rgba(70,62,55,0.55)'; g.lineWidth = 2;
  for (const p of [0, 128, 256]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.moveTo(0, p); g.lineTo(256, p); g.stroke(); }
  return c;
}
export function asphaltTile() { const [c, g] = canvas(64, 64); noisy(g, 64, 64, '#5b5b5d', 0.14, prng(31)); return c; }
export function grassTile() {   // 12.8 m of the oasis's olive grass: tufts and blades leaning one way (patches and hollows from the shader)
  return detailTile({ seed: 41, base: [158, 160, 120], dark: [113, 120, 86], light: [208, 205, 153], grain: 0.06, strokes: 900, len: [2, 5], lit: 0.6,
    specks: [[[64, 70, 36], 200, 0.45], [[208, 198, 142], 110, 0.5]] });
}
export function meadowTile() {   // 12.8 m of Narva's summer grass: tufts and blades leaning one way, clover and daisies (patches from the shader)
  return detailTile({ seed: 43, base: [134, 158, 102], dark: [93, 115, 77], light: [189, 203, 137], grain: 0.06, strokes: 1000, len: [2, 5], lit: 0.6,
    specks: [[[46, 72, 30], 240, 0.5], [[214, 214, 186], 40, 0.6], [[202, 186, 92], 40, 0.55]] });
}
export function dirtTile() {   // 12.8 m of packed earth: grit, scuffs and pebbles (damp and dry patches from the shader)
  return detailTile({ seed: 51, base: [163, 142, 102], dark: [126, 108, 76], light: [194, 176, 138], grain: 0.05, strokes: 240, len: [2, 5], slant: 0.3, spread: 0.9, alpha: [0.08, 0.22],
    specks: [[[110, 96, 74], 320, 0.55], [[206, 192, 160], 160, 0.5]] });
}
// the ground's slow variation over tens of metres (the shader samples it at two scales across the map): grey, 0..1
export function macroTile() {
  const n = 256, [c, g] = canvas(n, n), r = prng(87), N = octaves(n, [[4, 1], [8, 0.55], [16, 0.3]], r), img = g.createImageData(n, n), d = img.data;
  for (let i = 0; i < n * n; i++) { const v = clamp255(255 * Math.max(0, Math.min(1, (N[i] - 0.5) * 1.8 + 0.5))); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}
// 6 m of rock for steep ground (cliffs, cut banks, bluffs; the ground shader lays it by slope): grey-brown strata broken into
// blocks with dark joints, each band and each row of blocks wrapping exactly so the tile repeats, then grit and pale flecks
export function rockTile() {
  const [c, g] = canvas(64, 64), r = prng(71), SH = ['#8a8277', '#7b746a', '#958d80', '#726b61', '#857c70'];
  for (let y = 0; y < 64;) {
    const h = Math.min(64 - y, 5 + Math.floor(r() * 7)), start = Math.floor(r() * 64);
    for (let x = 0; x < 64;) { const w = Math.min(64 - x, 9 + Math.floor(r() * 20)); g.fillStyle = SH[Math.floor(r() * SH.length)]; for (const o of [0, -64]) g.fillRect(((start + x) % 64) + o, y, w, h); x += w; }
    g.fillStyle = '#56504a'; g.fillRect(0, y + h - 1, 64, 1); y += h;   // the bed joint under each band
  }
  for (let i = 0; i < 26; i++) { const x = Math.floor(r() * 64), y = Math.floor(r() * 64), l = 2 + Math.floor(r() * 5); g.fillStyle = '#4a453f'; g.fillRect(x, y, 1, l); }   // cracks
  const img = g.getImageData(0, 0, 64, 64), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 22; for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, d[i + k] + n)); }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 30; i++) { g.fillStyle = r() < 0.6 ? '#a59d90' : '#5e5850'; g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1 + Math.floor(r() * 2), 1); }
  return c;
}

// sand drifted over a strip's edges: each row of the texture gets its own ragged edge from both sides, sand-coloured
// pixels over the edge and nothing at all past it (alpha 0: the strip is drawn as a cutout, so the ground shows through)
function driftEdges(g, w, h, r, reach, sand = [196, 176, 136]) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (const side of [0, 1]) {
    const k = Math.sin(y / h * Math.PI * 2 * (2 + side)) * 0.5 + 0.5, gone = Math.floor(r() * 2 + k * 2), drift = gone + Math.floor(r() * reach * 0.6 + k * reach * 0.6);
    for (let i = 0; i < drift; i++) {
      const x = side ? w - 1 - i : i, o = (y * w + x) * 4;
      if (i < gone) { d[o + 3] = 0; continue; }
      const t = (drift - i) / (drift - gone + 1), n = 0.9 + r() * 0.2;   // thicker sand towards the edge
      for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.round(d[o + ch] * (1 - t) + sand[ch] * n * t);
    }
  }
  g.putImageData(img, 0, 0);
}
// road strip: u across the width (12 m), v along 12 m, about 10 pixels a metre each way. Worn asphalt: patches, cracks,
// lighter wheel tracks in each lane; broken white edge lines, faded lane dashes, a double yellow centre line; sand drifted
// over ragged edges.
export function roadStrip(edge) {
  const W = 128, H = 128, [c, g] = canvas(W, H), r = prng(61);
  noisy(g, W, H, '#5a5a5c', 0.1, r, 6000);
  for (let i = 0; i < 7; i++) { const v = 78 + Math.floor(r() * 16); g.fillStyle = `rgba(${v},${v},${v + 2},0.55)`; g.fillRect(10 + Math.floor(r() * 100), Math.floor(r() * H), 8 + Math.floor(r() * 18), 6 + Math.floor(r() * 16)); }   // repair patches
  for (const x of [26, 44, 84, 102]) { g.fillStyle = 'rgba(120,120,120,0.16)'; g.fillRect(x - 3, 0, 7, H); }               // the wheels' polish
  g.strokeStyle = 'rgba(30,30,32,0.75)'; g.lineWidth = 1;
  for (let i = 0; i < 9; i++) { let x = 8 + r() * 112, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 10; y += 3 + r() * 6; g.lineTo(x, y); } g.stroke(); }   // cracks
  const paint = (x, w, col, from, to, wear) => { for (let y = from; y < to; y++) if (r() > wear) { g.fillStyle = col; g.fillRect(x, y, w, 1); } };
  paint(5, 2, '#d8d6cf', 0, H, 0.12); paint(121, 2, '#d8d6cf', 0, H, 0.12);                                              // edge lines
  for (const x of [34, 93]) { paint(x, 2, '#d8d6cf', 8, 48, 0.25); paint(x, 2, '#d8d6cf', 72, 112, 0.25); }               // lane dashes, 4 m on, 2 m off
  paint(61, 2, '#d4ad3a', 0, H, 0.08); paint(65, 2, '#d4ad3a', 0, H, 0.08);                                              // centre line
  driftEdges(g, W, H, r, 7, edge);
  return c;
}
// dirt track: 5 m across, v along 5 m. Two darker wheel ruts with pebbles, a paler hump between them, ragged sandy edges.
export function trackStrip(edge) {
  const W = 64, H = 64, [c, g] = canvas(W, H), r = prng(71);
  noisy(g, W, H, '#a28c64', 0.13, r, 1600);
  g.fillStyle = 'rgba(214,196,152,0.35)'; g.fillRect(24, 0, 16, H);                                                     // the hump, paler
  for (const x of [11, 46]) { g.fillStyle = 'rgba(84,70,48,0.5)'; g.fillRect(x, 0, 7, H); g.fillStyle = 'rgba(60,50,34,0.35)'; g.fillRect(x + 2, 0, 3, H); }   // ruts
  for (let i = 0; i < 40; i++) { const v = 120 + Math.floor(r() * 60); g.fillStyle = `rgb(${v},${v - 8},${v - 24})`; g.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1, 1); }   // pebbles
  driftEdges(g, W, H, r, 5, edge);
  return c;
}
// railway: 5 m across, v along 5 m. Grey ballast, dark sleepers 2.6 m long every 0.7 m, the rails' shine (the rails themselves
// are props), grass growing in at the ragged edges.
export function railwayStrip() {
  const W = 64, H = 64, [c, g] = canvas(W, H), r = prng(81);
  noisy(g, W, H, '#8b8883', 0.16, r, 2200);
  for (let i = 0; i < 7; i++) { const y = Math.round(i * H / 7) + 2; g.fillStyle = '#5b4433'; g.fillRect(15, y, 34, 4); g.fillStyle = 'rgba(30,22,16,0.4)'; g.fillRect(15, y + 3, 34, 1); }
  for (const x of [22, 41]) { g.fillStyle = 'rgba(70,66,62,0.9)'; g.fillRect(x, 0, 2, H); g.fillStyle = 'rgba(200,198,190,0.6)'; g.fillRect(x, 0, 1, H); }
  driftEdges(g, W, H, r, 5, MEADOW);
  return c;
}
export function lineStrip() { const [c, g] = canvas(8, 8); g.fillStyle = '#d4ad3a'; g.fillRect(0, 0, 8, 8); return c; }
export function dashStrip() { const [c, g] = canvas(8, 32); g.clearRect(0, 0, 8, 32); g.fillStyle = '#e8e2d2'; g.fillRect(0, 0, 8, 16); return c; }
export function helipadDecal() {   // 14 m
  const [c, g] = canvas(224, 224); g.clearRect(0, 0, 224, 224);
  g.strokeStyle = '#e8e2d2'; g.lineWidth = 11; g.beginPath(); g.arc(112, 112, 106, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8e2d2'; g.fillRect(64, 72, 18, 80); g.fillRect(142, 72, 18, 80); g.fillRect(64, 103, 96, 18);
  return c;
}
export function bayDecal() {   // 7 x 12 m parking bay outline
  const [c, g] = canvas(112, 192); g.clearRect(0, 0, 112, 192); g.strokeStyle = 'rgba(240,236,224,0.8)'; g.lineWidth = 6; g.strokeRect(4, 4, 104, 184);
  return c;
}
const MEADOW = [108, 138, 68];   // the meadow tile's average: green maps' road edges drift into grass, not sand
export const GROUND_TEXTURES = {
  sand: sandTile, concrete: concreteTile, asphalt: asphaltTile, grass: grassTile, meadow: meadowTile, dirt: dirtTile, rock: rockTile, macro: macroTile,
  road: () => roadStrip(), track: () => trackStrip(), roadM: () => roadStrip(MEADOW), trackM: () => trackStrip(MEADOW), railway: railwayStrip, line: lineStrip, dash: dashStrip, helipad: helipadDecal, bay: bayDecal,
};
