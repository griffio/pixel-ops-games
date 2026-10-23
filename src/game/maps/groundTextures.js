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

// road strip: u across the width, v along 8 m. White edges, dashed lanes, double yellow centre.
export function roadStrip() {
  const [c, g] = canvas(64, 128); noisy(g, 64, 128, '#58585a', 0.12, prng(61), 2000);
  g.fillStyle = '#d8d6cf'; g.fillRect(2, 0, 2, 128); g.fillRect(60, 0, 2, 128);
  g.fillRect(15, 0, 2, 48); g.fillRect(47, 0, 2, 48);
  g.fillStyle = '#d4ad3a'; g.fillRect(29, 0, 2, 128); g.fillRect(33, 0, 2, 128);
  return c;
}
export function trackStrip() {
  const [c, g] = canvas(32, 64); noisy(g, 32, 64, '#a08a62', 0.14, prng(71), 800);
  g.fillStyle = 'rgba(90,75,50,0.45)'; g.fillRect(6, 0, 4, 64); g.fillRect(22, 0, 4, 64);
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
