// Writes the PWA icons (icons/*.png) from a 20x20 pixel-art APC, nearest-upscaled.
// No dependencies: a minimal PNG encoder on top of node's zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const PAL = { '.': [20, 22, 26], g: [91, 94, 69], t: [194, 168, 120], T: [166, 141, 96], s: [217, 194, 151], d: [58, 51, 40], w: [34, 32, 28], r: [138, 135, 124], y: [242, 193, 78], k: [46, 44, 40] };
const ART = [
  '....................',
  '....................',
  '....................',
  '....................',
  '........sttt........',
  '.......sttttt.......',
  '......sTTTTTTTt.....',
  '....sttttttttttt....',
  '...sTTTTTTTTTTTTt...',
  '...TTTTTTTTTTTTTTTy.',
  '...TTTTTTTTTTTTTTT..',
  '....dddddddddddddd..',
  '...wrw.wrw.wrw.wrw..',
  '...www.www.www.www..',
  '..gggggggggggggggg..',
  '..gkgggkgggkgggkgg..',
  '..gggggggggggggggg..',
  '....................',
  '....................',
  '....................',
];
const N = ART.length;

const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
function png(size, pixelAt) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; for (let x = 0; x < size; x++) { const [r, g, b] = pixelAt(x, y); const o = y * (size * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// `inset` shrinks the art toward the centre (maskable icons keep content inside the inner 80%)
const art = (size, inset = 0) => (x, y) => {
  const u = (x + 0.5) / size, v = (y + 0.5) / size, a = (u - 0.5) / (1 - 2 * inset) + 0.5, b = (v - 0.5) / (1 - 2 * inset) + 0.5;
  if (a < 0 || a >= 1 || b < 0 || b >= 1) return PAL['.'];
  return PAL[ART[Math.floor(b * N)][Math.floor(a * N)]];
};
mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', png(192, art(192)));
writeFileSync('icons/icon-512.png', png(512, art(512)));
writeFileSync('icons/icon-maskable-512.png', png(512, art(512, 0.1)));
writeFileSync('icons/apple-touch-icon.png', png(180, art(180)));
console.log('wrote icons/');
