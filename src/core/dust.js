import { hexToLinear } from './math.js';
import { ProjectileSim } from './projectiles.js';

// General point-sprite particle pool shared by both back ends: dust, smoke, fire,
// tracers, muzzle flashes and impacts. Renderers read pos/life/size/color/params and `n`.
// params: [grow factor, max alpha]; an alpha of 2 + a marks the particle additive (it glows).
// `lights` holds brief point lights (muzzle flashes, explosions) for the renderer's lighting.
export const PCOL = {
  dust: hexToLinear(0xb3a386), smoke: hexToLinear(0x2a2a2a), smokeLight: hexToLinear(0x6e6e6e),
  fire: hexToLinear(0xff8a2a), flash: hexToLinear(0xfff1b0), tracer: hexToLinear(0xffe9a0), impact: hexToLinear(0x8a8070),
  flame: hexToLinear(0xffc240), ember: hexToLinear(0xffb060), debris: hexToLinear(0x3a3530), soot: hexToLinear(0x151515),
  flashCore: hexToLinear(0xfff8dc), flashHalo: hexToLinear(0xffa23a), brass: hexToLinear(0xd9ab4e), spark: hexToLinear(0xffd36a),
};
const ADD = 2;
// muzzle flash recipes per weapon class: halo/core sprite sizes (m), flash life (s), light power and reach, extras
export const MUZZLE = {
  rifle:    { halo: 0.9, core: 0.4,  life: 0.07, light: 9,  dist: 7,  smoke: 0 },
  mg:       { halo: 1.0, core: 0.45, life: 0.06, light: 11, dist: 7,  smoke: 0 },
  marksman: { halo: 1.2, core: 0.5,  life: 0.08, light: 14, dist: 8,  smoke: 1 },
  cannon:   { halo: 2.4, core: 1.1,  life: 0.1,  light: 50, dist: 15, smoke: 3, brass: 2, sparks: 4 },
  rocket:   { halo: 2.8, core: 1.2,  life: 0.12, light: 55, dist: 17, smoke: 4, sparks: 3, backblast: true },
  doorgun:  { halo: 1.3, core: 0.6,  life: 0.06, light: 18, dist: 9,  smoke: 0, brass: 1 },
  tank:     { halo: 3.8, core: 1.7,  life: 0.13, light: 90, dist: 22, smoke: 7, sparks: 5, ring: true },   // 120 mm: a big flash, smoke, and dust blown off the ground
};

export class DustSim {
  constructor(max = 6000) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.size = new Float32Array(max);
    this.color = new Float32Array(max * 3); this.params = new Float32Array(max * 2); // params: grow factor, max alpha
    this.damp = new Float32Array(max); this.grav = new Float32Array(max); this.free = [];   // recycled slots of dead particles
    this.lights = []; this.shots = new ProjectileSim(this);   // rounds in flight; renderers draw their tracer streaks
  }

  emit(x, y, z, vx, vy, vz, size, life, color = PCOL.dust, grow = 1, alpha = 0.55, damp = 0.92, grav = 0) {
    const i = this.free.length ? this.free.pop() : (this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max));
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = 1; this.maxLife[i] = life; this.size[i] = size;
    this.color[i * 3] = color[0]; this.color[i * 3 + 1] = color[1]; this.color[i * 3 + 2] = color[2];
    this.params[i * 2] = grow; this.params[i * 2 + 1] = alpha; this.damp[i] = damp; this.grav[i] = grav;
  }
  // a brief point light; intensity fades linearly over `life`
  light(x, y, z, color, intensity, distance, life) { this.lights.push({ x, y, z, color, intensity, distance, life, maxLife: life }); if (this.lights.length > 24) this.lights.shift(); }

  // ---- effect recipes ------------------------------------------------------
  // flash at the muzzle: an orange halo with a near-white core, both additive, plus the class extras
  muzzle(x, y, z, dx, dy, dz, kind = 'rifle') {
    const m = MUZZLE[kind] || MUZZLE.rifle, r = Math.random, px = dz, pz = -dx;   // px/pz: to the right of the barrel
    this.emit(x, y, z, dx * 2, dy * 2, dz * 2, m.halo, m.life, PCOL.flashHalo, 0, ADD + 0.6, 1);
    this.emit(x + dx * 0.15, y + dy * 0.15, z + dz * 0.15, dx * 2, dy * 2, dz * 2, m.core, m.life * 0.8, PCOL.flashCore, 0, ADD + 1, 1);
    for (let i = 0; i < (m.sparks || 0); i++) { const s = 14 + r() * 18; this.emit(x, y, z, dx * s + (r() - 0.5) * 6, dy * s + 1 + r() * 2, dz * s + (r() - 0.5) * 6, 0.14, 0.12 + r() * 0.12, PCOL.spark, 0, ADD + 1, 0.9, 10); }
    for (let i = 0; i < m.smoke; i++) this.emit(x + dx * (0.3 + r()), y + 0.1, z + dz * (0.3 + r()), dx * 2 + (r() - 0.5), 0.8 + r() * 0.6, dz * 2 + (r() - 0.5), 0.45 + r() * 0.3, 0.5 + r() * 0.4, PCOL.smokeLight, 1, 0.45, 0.94);
    for (let i = 0; i < (m.brass || 0); i++) this.emit(x - dx * 0.8, y - 0.1, z - dz * 0.8, px * (2 + r() * 2) + (r() - 0.5), 2.5 + r() * 2, pz * (2 + r() * 2) + (r() - 0.5), 0.12, 0.8 + r() * 0.4, PCOL.brass, 0, 1, 0.99, 14);
    if (m.ring) for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, s = 5 + r() * 5; this.emit(x + Math.cos(a), 0.2, z + Math.sin(a), Math.cos(a) * s, 0.4, Math.sin(a) * s, 0.8 + r() * 0.5, 0.7 + r() * 0.5, PCOL.dust, 1, 0.5, 0.9); }
    if (m.backblast) for (let i = 0; i < 5; i++) this.emit(x - dx * 1.2, y - 0.3, z - dz * 1.2, -dx * (4 + r() * 4) + (r() - 0.5) * 3, 0.5 + r(), -dz * (4 + r() * 4) + (r() - 0.5) * 3, 0.7 + r() * 0.5, 0.5 + r() * 0.4, PCOL.dust, 1, 0.5, 0.9);
    this.light(x, y, z, PCOL.flashHalo, m.light, m.dist, m.life * 1.5);
  }
  tracer(x0, y0, z0, x1, y1, z1, size = 0.22) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, d = Math.hypot(dx, dy, dz) || 1, v = 110;
    this.emit(x0, y0, z0, dx / d * v, dy / d * v, dz / d * v, size, d / v, PCOL.tracer, 0, ADD + 1, 1);
  }
  impact(x, y, z) {
    for (let i = 0; i < 3; i++) this.emit(x, y, z, (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, 0.28, 0.35 + Math.random() * 0.2, PCOL.impact, 1, 0.8);
  }
  // a round hit: a glowing dot and a few sparks that bounce away under gravity
  hitSpark(x, y, z) {
    const r = Math.random;
    this.emit(x, y, z, 0, 0.5, 0, 0.45, 0.12, PCOL.fire, 0, ADD + 1, 1);
    for (let i = 0; i < 3; i++) this.emit(x, y, z, (r() - 0.5) * 7, 1 + r() * 4, (r() - 0.5) * 7, 0.1, 0.2 + r() * 0.25, PCOL.spark, 0, ADD + 1, 0.95, 12);
  }
  puff(x, y, z) { const r = Math.random; for (let i = 0; i < 2; i++) this.emit(x + (r() - 0.5) * 0.4, y, z + (r() - 0.5) * 0.4, (r() - 0.5) * 1.2, 0.8 + r() * 0.6, (r() - 0.5) * 1.2, 0.5, 0.5 + r() * 0.3, PCOL.smokeLight, 1, 0.5, 0.95); }
  // burning wreck: shrinking tongues of flame, the odd ember, and thick soot
  fire(x, y, z, k = 1) {
    const r = Math.random;
    this.emit(x + (r() - 0.5) * 1.4 * k, y, z + (r() - 0.5) * 1.4 * k, (r() - 0.5) * 0.5, 1.6 + r() * 1.6, (r() - 0.5) * 0.5, (0.4 + r() * 0.6) * k, 0.25 + r() * 0.45, r() < 0.4 ? PCOL.flame : PCOL.fire, -1, ADD + 0.9, 0.97);
    if (r() < 0.25) this.emit(x + (r() - 0.5) * k, y + 0.3, z + (r() - 0.5) * k, (r() - 0.5) * 2.5, 3 + r() * 3, (r() - 0.5) * 2.5, 0.16, 0.7 + r() * 0.7, PCOL.ember, 0, ADD + 1, 0.985, 4);
    if (r() < 0.2) this.emit(x + (r() - 0.5) * k, y + 1.2, z + (r() - 0.5) * k, (r() - 0.5) * 0.6, 2.2 + r() * 1.2, (r() - 0.5) * 0.6, 0.7 * k, 2.5 + r() * 1.5, PCOL.soot, 1, 0.5, 0.992);
  }
  smoke(x, y, z, k = 1) {
    const r = Math.random;
    this.emit(x + (r() - 0.5) * k, y, z + (r() - 0.5) * k, (r() - 0.5) * 0.8, 2.2 + r() * 1.4, (r() - 0.5) * 0.8, 1.0 * k, 3 + r() * 1.5, r() < 0.7 ? PCOL.smoke : PCOL.smokeLight, 1, 0.8, 0.992);
    if (r() < 0.35) this.emit(x + (r() - 0.5) * 0.6 * k, y, z + (r() - 0.5) * 0.6 * k, 0, 1.5 + r(), 0, 0.5 * k, 0.25 + r() * 0.2, PCOL.fire, 0, ADD + 1, 0.9);
  }
  explosion(x, y, z, k = 1) {
    const r = Math.random;
    for (let i = 0; i < 14 * k; i++) { const a = r() * Math.PI * 2, s = 2 + r() * 6; this.emit(x, y + 0.3, z, Math.cos(a) * s, 2 + r() * 5, Math.sin(a) * s, 0.5 + r() * 0.5, 0.5 + r() * 0.6, r() < 0.5 ? PCOL.fire : PCOL.smoke, 1, 0.9, 0.9); }
    this.emit(x, y + 0.5, z, 0, 0, 0, 1.6 * k, 0.12, PCOL.flash, -1, ADD + 0.8, 1);   // the first-frame flash, shrinking
    this.light(x, y + 1, z, PCOL.fire, 45 * k, 12 + 5 * k, 0.18);
    // fireball, debris on ballistic arcs, a dust ring along the ground
    for (let i = 0; i < 6 * k; i++) this.emit(x + (r() - 0.5) * 1.6 * k, y + 0.4, z + (r() - 0.5) * 1.6 * k, (r() - 0.5) * 2, 2.5 + r() * 3, (r() - 0.5) * 2, (1.0 + r() * 1.0) * k, 0.35 + r() * 0.35, r() < 0.5 ? PCOL.flame : PCOL.fire, -1, ADD + 0.85, 0.95);
    for (let i = 0; i < 12 * k; i++) { const a = r() * Math.PI * 2, s = 5 + r() * 9; this.emit(x, y + 0.5, z, Math.cos(a) * s, 6 + r() * 8, Math.sin(a) * s, 0.22, 0.9 + r() * 0.7, PCOL.debris, 0, 1, 0.985, 16); }
    for (let i = 0; i < 10 * k; i++) { const a = r() * Math.PI * 2, s = 5 + r() * 5; this.emit(x, y + 0.15, z, Math.cos(a) * s, 0.6, Math.sin(a) * s, (0.7 + r() * 0.5) * k, 1 + r() * 0.7, PCOL.dust, 1, 0.5, 0.9); }
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
    } else if (Math.abs(u.speed) > 1.5) {
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
      v[i * 3] *= k; v[i * 3 + 1] = v[i * 3 + 1] * k - this.grav[i] * dt; v[i * 3 + 2] *= k;
      if (this.grav[i] > 0 && p[i * 3 + 1] < 0.05 && v[i * 3 + 1] < 0) { v[i * 3 + 1] = 0; v[i * 3] *= 0.3; v[i * 3 + 2] *= 0.3; this.grav[i] = 0; }   // debris comes to rest on the ground
      if (L[i] <= 0) { p[i * 3 + 1] = -5; this.free.push(i); }
    }
    for (let i = this.lights.length - 1; i >= 0; i--) { const l = this.lights[i]; l.life -= dt; if (l.life <= 0) this.lights.splice(i, 1); }
    this.shots.update(dt);
  }
}
