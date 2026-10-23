import { WORLD_SIZE, HALF, rand } from './layout.js';

// Procedural canvases. Back ends upload them as sRGB textures.
export function camoCanvas(colors, seed = 1, size = 16) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  let s = seed; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  g.fillStyle = colors[0]; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = colors[1 + Math.floor(r() * (colors.length - 1))];
    const w = 2 + Math.floor(r() * 5), h = 2 + Math.floor(r() * 4);
    g.fillRect(Math.floor(r() * size), Math.floor(r() * size), w, h);
  }
  return cv;
}

export const CAMO = {
  uniform: { colors: ['#b19a6e', '#9c8559', '#c4ad83', '#86704a'], seed: 11, size: 8 },
  desert: { colors: ['#b8a071', '#a38a5d', '#cbb485', '#8f7a52', '#d5c296'], seed: 5, size: 16 },
  desert2: { colors: ['#a89265', '#947f55', '#bda77a', '#7f6b48'], seed: 9, size: 16 },
  heli: { colors: ['#4f5650', '#454c47', '#5a615a', '#3e4541'], seed: 21, size: 16 },
};

export function groundCanvas() {
  const px = 2048, ppu = px / WORLD_SIZE;
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  const g = cv.getContext('2d');
  const r = rand(7);
  const slab = 8 * ppu;
  for (let y = 0; y < px; y += slab) for (let x = 0; x < px; x += slab) {
    const v = 0.9 + r() * 0.18;
    g.fillStyle = `rgb(${Math.round(176 * v)},${Math.round(166 * v)},${Math.round(148 * v)})`;
    g.fillRect(x, y, slab, slab);
  }
  for (let i = 0; i < 24000; i++) {
    const a = 0.05 + r() * 0.12;
    g.fillStyle = r() < 0.5 ? `rgba(60,50,40,${a})` : `rgba(255,250,240,${a})`;
    g.fillRect(r() * px, r() * px, 1 + r() * 4, 1 + r() * 4);
  }
  g.strokeStyle = 'rgba(70,62,55,0.55)'; g.lineWidth = 2;
  for (let i = 0; i <= px; i += slab) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, px); g.moveTo(0, i); g.lineTo(px, i); g.stroke(); }
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
