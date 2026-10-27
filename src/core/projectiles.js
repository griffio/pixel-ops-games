import { hexToLinear } from './math.js';

// Rounds in flight: straight bullets, cannon shells on a gravity arc, rockets with a smoke
// trail. A shot is launched so that it arrives at a chosen point; the game resolves what it
// does there through `onArrive` once it gets there. Renderers draw `segs` (tracer streaks,
// two vertices of x,y,z,r,g,b,intensity each) every frame.
const C = { tracer: hexToLinear(0xffe9a0), rifle: hexToLinear(0xffd98a), shell: hexToLinear(0xffb060), rocket: hexToLinear(0xffc080), smoke: hexToLinear(0x8a8a8a), flame: hexToLinear(0xffc240) };
const G = 9.8;

export class ProjectileSim {
  constructor(dust) { this.dust = dust; this.list = []; this.segs = new Float32Array(64 * 14); this.segCount = 0; }

  // launch from (x,y,z) to (tx,ty,tz): straight at `speed`, or lofted under gravity when `arc`
  // (the low-angle solution for a fixed muzzle speed, or with `high` the plunging one a mortar fires; out of reach, it
  // lobs at 45 degrees and falls short)
  fire({ x, y, z, tx, ty, tz, speed, arc = false, high = false, kind = 'bullet', trail = 3, onArrive = null }) {
    const dx = tx - x, dy = ty - y, dz = tz - z, dh = Math.hypot(dx, dz) || 0.01;
    let vx, vy, vz, T;
    if (arc) {
      const v2 = speed * speed, disc = v2 * v2 - G * (G * dh * dh + 2 * dy * v2);
      const tan = disc >= 0 ? (v2 + (high ? 1 : -1) * Math.sqrt(disc)) / (G * dh) : 1, cos = 1 / Math.sqrt(1 + tan * tan), vh = speed * cos;
      vx = dx / dh * vh; vz = dz / dh * vh; vy = speed * tan * cos; T = dh / vh;
    } else { const d = Math.hypot(dx, dy, dz) || 0.01; vx = dx / d * speed; vy = dy / d * speed; vz = dz / d * speed; T = d / speed; }
    this.list.push({ x, y, z, vx, vy, vz, grav: arc ? G : 0, t: 0, T, kind, trail, onArrive });
  }

  update(dt) {
    const L = this.list, d = this.dust, r = Math.random;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i], step = Math.min(dt, p.T - p.t);
      p.t += step; p.x += p.vx * step; p.y += p.vy * step; p.z += p.vz * step; p.vy -= p.grav * step;
      if (p.kind === 'shell') { d.emit(p.x, p.y, p.z, 0, 0, 0, 0.5, 0.06, C.shell, 0, 3, 1); d.emit(p.x, p.y, p.z, (r() - 0.5) * 0.4, 0.3, (r() - 0.5) * 0.4, 0.3, 0.6 + r() * 0.3, C.smoke, 1, 0.35, 0.95); }
      else if (p.kind === 'rocket') { d.emit(p.x, p.y, p.z, 0, 0, 0, 0.35, 0.05, C.flame, 0, 3, 1); d.emit(p.x, p.y, p.z, (r() - 0.5) * 0.6, 0.4 + r() * 0.4, (r() - 0.5) * 0.6, 0.4 + r() * 0.3, 0.9 + r() * 0.6, C.smoke, 1, 0.5, 0.96); }
      if (p.t >= p.T - 1e-6) { L.splice(i, 1); if (p.onArrive) p.onArrive(p); }
    }
    this.pack();
  }

  // tracer streaks: from the round back along its path, up to `trail` metres, bright at the head and dark at the tail
  pack() {
    const n = this.list.length; if (this.segs.length < n * 14) this.segs = new Float32Array(n * 2 * 14);
    const s = this.segs; let k = 0;
    for (const p of this.list) {
      const vl = Math.hypot(p.vx, p.vy, p.vz) || 1, len = Math.min(p.trail, p.t * vl);
      const col = p.kind === 'shell' ? C.shell : p.kind === 'rocket' ? C.rocket : p.trail > 4 ? C.tracer : C.rifle, a = p.kind === 'bullet' && p.trail <= 4 ? 0.6 : 0.95;
      s[k++] = p.x - p.vx / vl * len; s[k++] = p.y - p.vy / vl * len; s[k++] = p.z - p.vz / vl * len; s[k++] = col[0]; s[k++] = col[1]; s[k++] = col[2]; s[k++] = 0;
      s[k++] = p.x; s[k++] = p.y; s[k++] = p.z; s[k++] = col[0]; s[k++] = col[1]; s[k++] = col[2]; s[k++] = a;
    }
    this.segCount = n;
  }
}
