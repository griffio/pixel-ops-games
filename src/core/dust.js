import { hexToLinear } from './math.js';

// General point-sprite particle pool shared by both back ends: dust, smoke, fire,
// tracers and impacts. Renderers read pos/life/size/color/params and `n`.
export const PCOL = {
  dust: hexToLinear(0xb3a386), smoke: hexToLinear(0x2a2a2a), smokeLight: hexToLinear(0x6e6e6e),
  fire: hexToLinear(0xff8a2a), flash: hexToLinear(0xfff1b0), tracer: hexToLinear(0xffe9a0), impact: hexToLinear(0x8a8070),
};

export class DustSim {
  constructor(max = 6000) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.size = new Float32Array(max);
    this.color = new Float32Array(max * 3); this.params = new Float32Array(max * 2); // params: grow factor, max alpha
    this.damp = new Float32Array(max); this.free = [];   // recycled slots of dead particles
  }

  emit(x, y, z, vx, vy, vz, size, life, color = PCOL.dust, grow = 1, alpha = 0.55, damp = 0.92) {
    const i = this.free.length ? this.free.pop() : (this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max));
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = 1; this.maxLife[i] = life; this.size[i] = size;
    this.color[i * 3] = color[0]; this.color[i * 3 + 1] = color[1]; this.color[i * 3 + 2] = color[2];
    this.params[i * 2] = grow; this.params[i * 2 + 1] = alpha; this.damp[i] = damp;
  }

  // ---- effect recipes ------------------------------------------------------
  tracer(x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, d = Math.hypot(dx, dy, dz) || 1, v = 110;
    this.emit(x0, y0, z0, dx / d * v, dy / d * v, dz / d * v, 0.22, d / v, PCOL.tracer, 0, 1, 1);
    this.emit(x0, y0, z0, 0, 0, 0, 0.6, 0.07, PCOL.flash, 0, 1, 1);
  }
  impact(x, y, z) {
    for (let i = 0; i < 3; i++) this.emit(x, y, z, (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, 0.28, 0.35 + Math.random() * 0.2, PCOL.impact, 1, 0.8);
  }
  hitSpark(x, y, z) { this.emit(x, y, z, 0, 0.5, 0, 0.45, 0.12, PCOL.fire, 0, 1, 1); }
  smoke(x, y, z, k = 1) {
    const r = Math.random;
    this.emit(x + (r() - 0.5) * k, y, z + (r() - 0.5) * k, (r() - 0.5) * 0.8, 2.2 + r() * 1.4, (r() - 0.5) * 0.8, 1.0 * k, 3 + r() * 1.5, r() < 0.7 ? PCOL.smoke : PCOL.smokeLight, 1, 0.8, 0.992);
    if (r() < 0.35) this.emit(x + (r() - 0.5) * 0.6 * k, y, z + (r() - 0.5) * 0.6 * k, 0, 1.5 + r(), 0, 0.5 * k, 0.25 + r() * 0.2, PCOL.fire, 0, 1, 0.9);
  }
  explosion(x, y, z, k = 1) {
    const r = Math.random;
    for (let i = 0; i < 14 * k; i++) { const a = r() * Math.PI * 2, s = 2 + r() * 6; this.emit(x, y + 0.3, z, Math.cos(a) * s, 2 + r() * 5, Math.sin(a) * s, 0.5 + r() * 0.5, 0.5 + r() * 0.6, r() < 0.5 ? PCOL.fire : PCOL.smoke, 1, 0.9, 0.9); }
    this.emit(x, y + 0.5, z, 0, 0, 0, 3 * k, 0.12, PCOL.flash, 0, 1, 1);
  }

  fromUnit(u, dt) {
    const r = Math.random;
    if (u.spec.air) {
      if (u.rotor > 0.4 && u.alt < 6) {
        const k = u.rotor * (1 - u.alt / 6) * 6;
        for (let i = 0; i < k * dt * 20; i++) {
          const a = r() * Math.PI * 2, d = 2 + r() * 4;
          this.emit(u.pos.x + Math.cos(a) * d, 0.2 + r() * 0.5, u.pos.z + Math.sin(a) * d, Math.cos(a) * 6, 1.2, Math.sin(a) * 6, 0.45, 0.7 + r() * 0.5);
        }
      }
    } else if (u.speed > 1.5) {
      const rate = u.type === 'soldier' ? 4 : 14, back = u.type === 'soldier' ? 0.3 : u.radius;
      if (r() < rate * dt) {
        const bx = u.pos.x - Math.sin(u.heading) * back + (r() - 0.5) * u.radius, bz = u.pos.z - Math.cos(u.heading) * back + (r() - 0.5) * u.radius;
        this.emit(bx, 0.15, bz, (r() - 0.5) * 1.5, 0.6 + r() * 0.6, (r() - 0.5) * 1.5, u.type === 'soldier' ? 0.22 : 0.4, 0.6 + r() * 0.6);
      }
    }
  }

  update(dt) {
    const p = this.pos, v = this.vel, L = this.life, D = this.damp;
    for (let i = 0; i < this.n; i++) {
      if (L[i] <= 0) continue;
      L[i] -= dt / this.maxLife[i];
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      const k = Math.pow(D[i], dt * 60);
      v[i * 3] *= k; v[i * 3 + 1] *= k; v[i * 3 + 2] *= k;
      if (L[i] <= 0) { p[i * 3 + 1] = -5; this.free.push(i); }
    }
  }
}
