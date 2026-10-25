import { WORLD_SIZE, HALF, rand } from './layout.js';

// Procedural canvases. Back ends upload them as sRGB textures.
// Camo: base colour, random blotches, 1-2 px specks and per-pixel noise. Geometry UVs put
// 16 texture pixels per world unit, so at 10 render texels per unit the grain reads as
// roughly one mottle per pixel, like the reference sprites.
export function camoCanvas({ colors, seed = 1, size = 32, blotch = [3, 9], count = 40, specks = 80, noise = 0.1, grid = 0, checker = null }) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  let s = seed; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const pick = () => colors[1 + Math.floor(r() * (colors.length - 1))];
  g.fillStyle = colors[0]; g.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    g.fillStyle = pick();
    const w = blotch[0] + Math.floor(r() * (blotch[1] - blotch[0] + 1)), h = blotch[0] + Math.floor(r() * (blotch[1] - blotch[0] + 1));
    const x = Math.floor(r() * size), y = Math.floor(r() * size);
    g.fillRect(x, y, w, h); g.fillRect(x - size, y, w, h); g.fillRect(x, y - size, w, h); g.fillRect(x - size, y - size, w, h); // tileable
  }
  for (let i = 0; i < specks; i++) { g.fillStyle = pick(); g.fillRect(Math.floor(r() * size), Math.floor(r() * size), 1 + Math.floor(r() * 2), 1); }
  if (grid) { g.fillStyle = 'rgba(0,0,0,0.4)'; for (let i = 0; i < size; i += grid) { g.fillRect(i, 0, 1, size); g.fillRect(0, i, size, 1); } }   // cargo net mesh
  if (checker) { g.fillStyle = checker.color; for (let y = 0; y < size; y += checker.cell) for (let x = (y / checker.cell) % 2 ? checker.cell : 0; x < size; x += checker.cell * 2) g.fillRect(x, y, checker.cell, checker.cell); }   // track links
  const img = g.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const k = 1 + (r() - 0.5) * 2 * noise; d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k); }
  g.putImageData(img, 0, 0);
  return cv;
}

export const CAMO = {
  uniform: { colors: ['#bcaa7a', '#a8945f', '#c9b98a', '#7f8d55', '#97a265', '#8e784b'], seed: 11, blotch: [2, 5], count: 20, specks: 40, noise: 0.08 },   // multicam: tan with green and brown
  vest: { colors: ['#8b8158', '#7a714c', '#988e64', '#6d6644'], seed: 13, blotch: [2, 4], count: 30, specks: 60, noise: 0.1 },   // coyote-green kit
  desert: { colors: ['#b8a071', '#a38a5d', '#cbb485', '#8f7a52', '#d5c296'], seed: 5, blotch: [4, 10], count: 36, specks: 60, noise: 0.08 },
  trunk: { colors: ['#7a6a4a', '#6a5a3c', '#8a7a58', '#5e5034'], seed: 31, blotch: [1, 3], count: 60, specks: 40, noise: 0.1 },
  frond: { colors: ['#6f8c3a', '#5f7a30', '#86a347', '#4e6626'], seed: 33, blotch: [1, 3], count: 60, specks: 60, noise: 0.12 },
  bush: { colors: ['#5f7a35', '#4f6a2b', '#729044', '#3e5520'], seed: 35, blotch: [2, 4], count: 50, specks: 60, noise: 0.12 },
  // OPFOR recolours: olive uniforms, woodland vehicles, dark green helicopters
  uniformB: { colors: ['#7f8a5a', '#6a7549', '#8f9a68', '#56603a', '#76804f'], seed: 51, blotch: [2, 5], count: 22, specks: 50, noise: 0.1 },
  vestB: { colors: ['#4e5538', '#434930', '#5a6142'], seed: 53, blotch: [2, 4], count: 30, specks: 60, noise: 0.1 },
  desertB: { colors: ['#6e7a4a', '#5a4a36', '#7f8c58', '#4d5a35', '#8a7a52'], seed: 55, blotch: [4, 10], count: 36, specks: 60, noise: 0.08 },
  wreck: { colors: ['#2a2724', '#1d1b19', '#3a3531', '#171514'], seed: 61, blotch: [2, 6], count: 50, specks: 80, noise: 0.15 },
  net: { colors: ['#555a3c', '#474b30', '#636848', '#3b3f28'], seed: 71, blotch: [1, 3], count: 70, specks: 90, noise: 0.12, grid: 4 },   // cargo net over a tarp
  // every vehicle: tri-colour sand, brown and green in big blocky patches (BLUFOR); a woodland olive and brown for OPFOR
  camo: { colors: ['#cfb67d', '#dcc690', '#8a6a43', '#66793c', '#c3a96f'], seed: 81, size: 64, blotch: [9, 22], count: 20, specks: 24, noise: 0.05 },
  camoB: { colors: ['#66724a', '#57633d', '#4a3c2a', '#7b8556', '#3f4a2c'], seed: 83, size: 64, blotch: [9, 22], count: 20, specks: 24, noise: 0.05 },
  tarp: { colors: ['#c4ad74', '#bba46b', '#cdb67e', '#b49c63'], seed: 91, blotch: [2, 6], count: 18, specks: 30, noise: 0.04 },   // the truck's canvas cover
  tarpB: { colors: ['#6f7650', '#666d48', '#787f58', '#5f6642'], seed: 93, blotch: [2, 6], count: 18, specks: 30, noise: 0.04 },
  // house plaster: three tints, each with darker blotches where it has worn and been patched (map props)
  plaster1: { colors: ['#d2bb8b', '#bf9c6c', '#b48f63', '#c8a87a'], seed: 95, blotch: [5, 12], count: 5, specks: 20, noise: 0.03 },
  plaster2: { colors: ['#c8ae80', '#b39065', '#a9875d', '#bd9e72'], seed: 97, blotch: [5, 12], count: 5, specks: 20, noise: 0.03 },
  plaster3: { colors: ['#dac7a0', '#c8aa80', '#bf9f75', '#d0b88e'], seed: 99, blotch: [5, 12], count: 5, specks: 20, noise: 0.03 },
  liner: { colors: ['#9d9a91', '#8b8880', '#aeaba2', '#7d7a73', '#b3a587'], seed: 103, blotch: [1, 2], count: 40, specks: 140, noise: 0.06 },   // Hesco fabric
  render: { colors: ['#d9c69c', '#d2bd92', '#dfcda6'], seed: 101, blotch: [2, 4], count: 6, specks: 16, noise: 0.025 },   // smooth render: the control tower
  trackLinks: { colors: ['#2a2927', '#232220', '#33312e'], seed: 85, blotch: [1, 2], count: 8, specks: 20, noise: 0.08, checker: { cell: 2, color: '#565450' } },
  trackEdge: { colors: ['#1b1b1b', '#1b1b1b'], seed: 87, blotch: [1, 1], count: 0, specks: 0, noise: 0.04, checker: { cell: 2, color: '#d9d6cf' } },   // the bright link ends along the track's lower edge
};


// Grass tuft with transparent background: a fan of light-khaki blades.
export function tuftCanvas() {
  const size = 16, cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'); g.clearRect(0, 0, size, size);
  let s = 41; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const cols = ['#c2bb7e', '#a9a66a', '#d2c98c', '#b5ae72'];
  for (let b = 0; b < 7; b++) {
    const x0 = 6 + r() * 4, x1 = 1 + r() * 14, h = 4 + r() * 11;
    g.strokeStyle = cols[b % cols.length]; g.lineWidth = 1 + (r() < 0.4 ? 1 : 0);
    g.beginPath(); g.moveTo(x0, size); g.quadraticCurveTo((x0 + x1) / 2, size - h * 0.6, x1, size - h); g.stroke();
  }
  return cv;
}

export function groundCanvas() {
  const px = 2048, ppu = px / WORLD_SIZE;
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  const g = cv.getContext('2d');
  const r = rand(7);
  const slab = 8 * ppu;
  for (let y = 0; y < px; y += slab) for (let x = 0; x < px; x += slab) {
    const v = 0.9 + r() * 0.18;
    g.fillStyle = `rgb(${Math.round(182 * v)},${Math.round(176 * v)},${Math.round(164 * v)})`;
    g.fillRect(x, y, slab, slab);
  }
  for (let i = 0; i < 24000; i++) {
    const a = 0.05 + r() * 0.12;
    g.fillStyle = r() < 0.5 ? `rgba(60,50,40,${a})` : `rgba(255,250,240,${a})`;
    g.fillRect(r() * px, r() * px, 1 + r() * 4, 1 + r() * 4);
  }
  g.strokeStyle = 'rgba(70,62,55,0.55)'; g.lineWidth = 2;
  for (let i = 0; i <= px; i += slab) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, px); g.moveTo(0, i); g.lineTo(px, i); g.stroke(); }
  // asphalt road with white lane dashes and a double yellow centre line (z -39..-25)
  const Z = (z) => (z + HALF) * ppu;
  g.fillStyle = '#5b5b5d'; g.fillRect(0, Z(-39), px, 14 * ppu);
  for (let i = 0; i < 9000; i++) { const a = 0.06 + r() * 0.1; g.fillStyle = r() < 0.5 ? 'rgba(20,20,22,' + a + ')' : 'rgba(200,200,205,' + a + ')'; g.fillRect(r() * px, Z(-39) + r() * 14 * ppu, 1 + r() * 3, 1 + r() * 2); }
  g.strokeStyle = '#d8d6cf'; g.lineWidth = 0.3 * ppu; g.setLineDash([]);
  g.beginPath(); g.moveTo(0, Z(-38.6)); g.lineTo(px, Z(-38.6)); g.moveTo(0, Z(-25.4)); g.lineTo(px, Z(-25.4)); g.stroke();
  g.save(); g.setLineDash([3 * ppu, 3 * ppu]); g.beginPath(); g.moveTo(0, Z(-35.5)); g.lineTo(px, Z(-35.5)); g.moveTo(0, Z(-28.5)); g.lineTo(px, Z(-28.5)); g.stroke(); g.restore();
  g.strokeStyle = '#d4ad3a'; g.lineWidth = 0.22 * ppu;
  g.beginPath(); g.moveTo(0, Z(-32.3)); g.lineTo(px, Z(-32.3)); g.moveTo(0, Z(-31.7)); g.lineTo(px, Z(-31.7)); g.stroke();
  // grass strip along the south edge (z > 70) with a sandy path
  g.fillStyle = '#8a8a58'; g.fillRect(0, Z(70), px, 10 * ppu);
  for (let i = 0; i < 14000; i++) { const a = 0.08 + r() * 0.14; g.fillStyle = r() < 0.5 ? 'rgba(60,70,30,' + a + ')' : 'rgba(190,185,120,' + a + ')'; g.fillRect(r() * px, Z(70) + r() * 10 * ppu, 1 + r() * 4, 1 + r() * 3); }
  g.strokeStyle = '#b9ad86'; g.lineWidth = 3.2 * ppu; g.beginPath(); g.moveTo(0, Z(73)); g.quadraticCurveTo(px * 0.5, Z(78.5), px, Z(74)); g.stroke();
  const Y = (ax, az, bx, bz, w = 0.6, dash = null) => {
    g.save(); g.strokeStyle = '#d4ad3a'; g.lineWidth = w * ppu; g.lineCap = 'butt';
    if (dash) g.setLineDash(dash.map(d => d * ppu));
    g.beginPath(); g.moveTo((ax + HALF) * ppu, (az + HALF) * ppu); g.lineTo((bx + HALF) * ppu, (bz + HALF) * ppu); g.stroke(); g.restore();
  };
  Y(-80, -30, 80, 10); Y(-80, 60, 80, -60); Y(20, -80, 20, 80, 0.6, [6, 3]); Y(-50, -80, -50, 80, 0.6, [6, 3]);
  Y(-80, -5, -20, -5); Y(-20, -5, -20, 40); Y(50, -80, 80, -50);
  g.save(); g.strokeStyle = 'rgba(240,236,224,0.9)'; g.lineWidth = 1.2 * ppu; g.setLineDash([8 * ppu, 8 * ppu]);
  g.beginPath(); g.moveTo((-80 + HALF) * ppu, (30 + HALF) * ppu); g.lineTo((80 + HALF) * ppu, (30 + HALF) * ppu); g.stroke(); g.restore();
  const H = (cx, cz) => {
    g.save(); g.translate((cx + HALF) * ppu, (cz + HALF) * ppu);
    g.strokeStyle = '#e8e2d2'; g.lineWidth = 0.7 * ppu; g.beginPath(); g.arc(0, 0, 7 * ppu, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#e8e2d2'; const t = 1.1 * ppu, h = 5 * ppu;
    g.fillRect(-3 * ppu, -h / 2, t, h); g.fillRect(3 * ppu - t, -h / 2, t, h); g.fillRect(-3 * ppu, -t / 2, 6 * ppu, t);
    g.restore();
  };
  H(45, 45); H(62, 45); H(45, 62);
  g.strokeStyle = 'rgba(240,236,224,0.7)'; g.lineWidth = 0.35 * ppu;
  for (let i = 0; i < 6; i++) { const x = (-70 + i * 9 + HALF) * ppu, z = (-70 + HALF) * ppu; g.strokeRect(x, z, 7 * ppu, 12 * ppu); }
  return cv;
}
