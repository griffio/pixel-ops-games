// Tileable ground textures and decals, generated on canvases. World-space UVs tile
// them at a fixed density (16 px per metre) so the grain matches the unit camo.
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function prng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function noisy(g, w, h, base, amount, r, count = w * h / 2) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const a = r() * amount; g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.8})`;
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + Math.floor(r() * 2), 1);
  }
}

export function sandTile() {   // 4 m
  const [c, g] = canvas(64, 64), r = prng(101);
  noisy(g, 64, 64, '#c4b088', 0.12, r);
  for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? '#b09c74' : '#d2c09a'; g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 2 + Math.floor(r() * 3), 1 + Math.floor(r() * 2)); }
  return c;
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
export function grassTile() {
  const [c, g] = canvas(64, 64), r = prng(41);
  noisy(g, 64, 64, '#8a8a58', 0.16, r);
  for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.5 ? 'rgba(60,70,30,0.35)' : 'rgba(190,185,120,0.35)'; g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2)); }
  return c;
}
export function dirtTile() { const [c, g] = canvas(64, 64); noisy(g, 64, 64, '#a38e66', 0.14, prng(51)); return c; }

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
export function roadStrip() {
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
  driftEdges(g, W, H, r, 7);
  return c;
}
// dirt track: 5 m across, v along 5 m. Two darker wheel ruts with pebbles, a paler hump between them, ragged sandy edges.
export function trackStrip() {
  const W = 64, H = 64, [c, g] = canvas(W, H), r = prng(71);
  noisy(g, W, H, '#a28c64', 0.13, r, 1600);
  g.fillStyle = 'rgba(214,196,152,0.35)'; g.fillRect(24, 0, 16, H);                                                     // the hump, paler
  for (const x of [11, 46]) { g.fillStyle = 'rgba(84,70,48,0.5)'; g.fillRect(x, 0, 7, H); g.fillStyle = 'rgba(60,50,34,0.35)'; g.fillRect(x + 2, 0, 3, H); }   // ruts
  for (let i = 0; i < 40; i++) { const v = 120 + Math.floor(r() * 60); g.fillStyle = `rgb(${v},${v - 8},${v - 24})`; g.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1, 1); }   // pebbles
  driftEdges(g, W, H, r, 5);
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
export const GROUND_TEXTURES = {
  sand: sandTile, concrete: concreteTile, asphalt: asphaltTile, grass: grassTile, dirt: dirtTile,
  road: roadStrip, track: trackStrip, line: lineStrip, dash: dashStrip, helipad: helipadDecal, bay: bayDecal,
};
