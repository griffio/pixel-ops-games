// Dust particle simulation shared by both back ends. Renderers read `pos`,
// `life`, `size` and `n` and draw them as point sprites.
export class DustSim {
  constructor(max = 1500) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.size = new Float32Array(max);
  }

  emit(x, y, z, vx, vy, vz, size, life) {
    const i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = 1; this.maxLife[i] = life; this.size[i] = size;
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
    const p = this.pos, v = this.vel, L = this.life;
    for (let i = 0; i < this.n; i++) {
      if (L[i] <= 0) continue;
      L[i] -= dt / this.maxLife[i];
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      v[i * 3] *= 0.92; v[i * 3 + 2] *= 0.92; v[i * 3 + 1] *= 0.95;
      if (L[i] <= 0) p[i * 3 + 1] = -5;
    }
  }
}
