import { Vec3, lerp, clamp, wrapAngle as wrap, rng } from './math.js';
import { HALF } from './layout.js';

const rnd = (a, b) => a + rng() * (b - a);

const SPEC = {
  soldier: { speed: 4.6, turn: 9, accel: 18, label: 'SQ', air: false },
  truck:   { speed: 9.5, turn: 1.1, accel: 5, label: 'TR', air: false },
  apc:     { speed: 8,   turn: 0.9, accel: 4, label: 'AP', air: false },
  heli:    { speed: 16,  turn: 1.4, accel: 6, label: 'HE', air: true },
};
const counters = {}; let pickSeq = 0;

export class Unit {
  constructor(type, build, x, z, heading = rng() * Math.PI * 2) {
    const spec = SPEC[type]; this.type = type; this.spec = spec;
    const m = build();
    this.pickId = m.group.pickId = ++pickSeq; this.group = m.group; this.parts = m.parts; this.height = m.height; this.radius = m.radius;
    this.pos = this.group.position; this.pos.set(x, 0, z);
    this.heading = heading; this.group.rotation.y = heading;
    this.speed = 0; this.target = null; this.selected = false; this.squad = null;
    this.idle = rnd(0, 3); this.phase = rng() * 6; this.hp = 1;
    this.alt = 0; this.altT = 0; this.rotor = 0; this.rotorT = 0; this.state = 'parked'; this.tilt = 0; this.bank = 0;
    this.id = (counters[type] = (counters[type] || 0) + 1);
    this.label = `${spec.label}-${String(this.id).padStart(2, '0')}`;
    this.dist = 0; this.dead = false;
  }

  get moving() { return this.speed > 0.05 || this.state === 'cruise' || this.state === 'takeoff'; }

  setSelected(s) { this.selected = s; this.parts.ring.visible = s; }

  order(x, z) {
    this.target = new Vec3(x, 0, z); this.idle = 0;
    if (this.spec.air && (this.state === 'parked' || this.state === 'spooldown')) this.state = 'spool';
  }

  // ---- ground vehicles & infantry ------------------------------------------
  stepGround(dt, world) {
    const s = this.spec; let want = 0;
    if (this.target) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, dist = Math.hypot(dx, dz);
      const arrive = this.type === 'soldier' ? 0.5 : 1.5;
      if (dist < arrive) { this.target = null; }
      else {
        const desired = Math.atan2(dx, dz), diff = wrap(desired - this.heading);
        const maxTurn = s.turn * dt * (this.type === 'soldier' ? 1 : clamp(this.speed / 3, 0.35, 1));
        this.heading += clamp(diff, -maxTurn, maxTurn);
        const align = this.type === 'soldier' ? 1 : clamp(1.2 - Math.abs(diff) / Math.PI * 2.2, 0.3, 1);
        want = s.speed * align * clamp(dist / (this.type === 'soldier' ? 1.5 : 6), 0.25, 1);
      }
    }
    this.speed += clamp(want - this.speed, -s.accel * 2 * dt, s.accel * dt);
    if (this.speed < 0.01) this.speed = 0;
    const step = this.speed * dt, sx = Math.sin(this.heading) * step, sz = Math.cos(this.heading) * step;
    let nx = this.pos.x + sx, nz = this.pos.z + sz;
    const pad = this.radius * 0.9;
    if (world.isBlocked(nx, nz, pad)) {
      if (!world.isBlocked(this.pos.x + sx, this.pos.z, pad)) nz = this.pos.z;
      else if (!world.isBlocked(this.pos.x, this.pos.z + sz, pad)) nx = this.pos.x;
      else { nx = this.pos.x; nz = this.pos.z; this.heading += (this.id % 2 ? 1 : -1) * 2.5 * dt; this.speed *= 0.5; }
    }
    this.dist += Math.hypot(nx - this.pos.x, nz - this.pos.z);
    this.pos.x = clamp(nx, -HALF + 2, HALF - 2); this.pos.z = clamp(nz, -HALF + 2, HALF - 2);
    this.group.rotation.y = this.heading;
    this.animate(dt);
  }

  animate(dt) {
    const p = this.parts;
    if (this.type === 'soldier') {
      const run = clamp(this.speed / this.spec.speed, 0, 1);
      this.phase += dt * (3 + 10 * run);
      const sw = Math.sin(this.phase) * 0.95 * run;
      p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
      p.armL.rotation.x = -sw * 0.7; p.armR.rotation.x = sw * 0.4 - 1.2 * (0.55 + 0.45 * run);
      p.armL.rotation.x += -0.8 * run;
      p.torso.position.y = 0.9 + Math.abs(Math.cos(this.phase)) * 0.09 * run;
      p.torso.rotation.x = 0.18 * run; // lean into the run
      p.legL.position.y = p.legR.position.y = 0.9 + Math.abs(Math.cos(this.phase)) * 0.09 * run;
    } else {
      const spin = this.speed * dt / 0.6;
      for (const w of p.wheels) w.rotation.x += spin;
      if (this.target) {
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
        const diff = wrap(Math.atan2(dx, dz) - this.heading);
        const st = clamp(diff, -0.5, 0.5);
        for (const w of p.steer) w.rotation.y = lerp(w.rotation.y, st, 1 - Math.pow(0.01, dt));
      }
      if (p.turret) p.turret.rotation.y = Math.sin(this.phase + performance.now() * 0.0004) * 0.6;
    }
  }

  // ---- helicopter ----------------------------------------------------------
  stepAir(dt, world) {
    const s = this.spec, p = this.parts;
    switch (this.state) {
      case 'parked': this.rotorT = 0; break;
      case 'spool': this.rotorT = 1; if (this.rotor > 0.95) { this.state = 'takeoff'; this.altT = rnd(7, 11); } break;
      case 'takeoff': if (this.alt > this.altT - 0.5) this.state = 'cruise'; break;
      case 'cruise': {
        if (!this.target) { this.state = 'land'; break; }
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, dist = Math.hypot(dx, dz);
        if (dist < 1.2 && this.speed < 1.5) { this.state = 'land'; this.target = null; break; }
        const desired = Math.atan2(dx, dz), diff = wrap(desired - this.heading);
        const turn = clamp(diff, -s.turn * dt, s.turn * dt); this.heading += turn;
        const want = s.speed * clamp(dist / 14, 0.08, 1) * clamp(1.3 - Math.abs(diff), 0.15, 1);
        this.speed += clamp(want - this.speed, -s.accel * 1.5 * dt, s.accel * dt);
        this.bank = lerp(this.bank, -turn / dt * 0.25, 1 - Math.pow(0.02, dt));
        break;
      }
      case 'land': {
        this.speed = Math.max(0, this.speed - s.accel * 1.5 * dt); this.altT = 0;
        if (this.alt < 0.02) { this.state = 'spooldown'; }
        break;
      }
      case 'spooldown': this.rotorT = 0; if (this.rotor < 0.02) { this.state = 'parked'; this.rotor = 0; } break;
    }
    if (this.state !== 'cruise') { this.bank = lerp(this.bank, 0, 1 - Math.pow(0.02, dt)); if (this.state !== 'land') this.speed = Math.max(0, this.speed - s.accel * dt); }
    // vertical
    const climb = this.state === 'land' ? 2.2 : 3.5;
    this.alt += clamp(this.altT - this.alt, -climb * dt, climb * dt);
    if (this.state === 'land' && this.alt < 0.02) this.alt = 0;
    // rotor
    this.rotor += clamp(this.rotorT - this.rotor, -0.35 * dt, 0.3 * dt);
    p.rotor.rotation.y += this.rotor * 28 * dt; p.tail.rotation.x += this.rotor * 60 * dt;
    p.beacon.visible = (performance.now() * 0.002 + this.id) % 2 < 0.25;
    // move
    const step = this.speed * dt;
    this.pos.x = clamp(this.pos.x + Math.sin(this.heading) * step, -HALF + 4, HALF - 4);
    this.pos.z = clamp(this.pos.z + Math.cos(this.heading) * step, -HALF + 4, HALF - 4);
    this.pos.y = this.alt;
    this.group.rotation.y = this.heading;
    this.tilt = lerp(this.tilt, this.speed / s.speed * 0.22, 1 - Math.pow(0.02, dt));
    p.body.rotation.x = this.tilt; p.body.rotation.z = this.bank;
    p.ring.position.y = -this.alt + 0.04;
    this.dist += step;
  }

  step(dt, world) { this.spec.air ? this.stepAir(dt, world) : this.stepGround(dt, world); }
}

export class Squad {
  constructor(members) { this.members = members; for (const m of members) m.squad = this; this.idle = rnd(0, 4); }
  get leader() { return this.members.find(m => !m.dead) || null; }
  get alive() { return this.members.some(m => !m.dead); }
  order(x, z) {
    const L = this.leader; if (!L) return;
    const h = Math.atan2(x - L.pos.x, z - L.pos.z), c = Math.cos(h), s = Math.sin(h);
    const offs = [[0, 0], [-1.3, -1.3], [1.3, -1.3], [-2.6, -2.6], [2.6, -2.6], [0, -2.6], [-1.3, -3.9], [1.3, -3.9]];
    this.members.forEach((m, i) => { const [ox, oz] = offs[i % offs.length]; m.order(x + ox * c + oz * s, z - ox * s + oz * c); });
  }
}

export class UnitManager {
  constructor(scene, world, builders) {
    this.scene = scene; this.world = world; this.builders = builders; this.units = []; this.squads = []; this.auto = true;
  }
  byPickId(id) { return this.units.find(u => u.pickId === id) || null; }

  freePoint(pad = 3, tries = 40) {
    for (let i = 0; i < tries; i++) {
      const x = rnd(-HALF + 8, HALF - 8), z = rnd(-HALF + 8, HALF - 8);
      if (!this.world.isBlocked(x, z, pad)) return [x, z];
    }
    return [0, 0];
  }

  add(unit) { this.units.push(unit); this.scene.add(unit.group); return unit; }
  spawn(type, x, z, heading) {
    if (x === undefined) [x, z] = this.freePoint(SPEC[type].air ? 6 : 3);
    return this.add(new Unit(type, this.builders[type], x, z, heading));
  }
  spawnSquad(x, z) {
    if (x === undefined) [x, z] = this.freePoint(3);
    const members = []; const h = rng() * Math.PI * 2;
    for (let i = 0; i < 4; i++) members.push(this.spawn('soldier', x + (i % 2) * 1.4 - 0.7, z + Math.floor(i / 2) * 1.4 - 0.7, h));
    const sq = new Squad(members); sq.id = (this.squadCount = (this.squadCount || 0) + 1);
    for (const m of members) m.label = `SQ-${String(sq.id).padStart(2, '0')}`;
    this.squads.push(sq); return sq;
  }
  clear() { for (const u of this.units) this.scene.remove(u.group); this.units = []; this.squads = []; }

  update(dt) {
    const w = this.world;
    for (const u of this.units) { u.step(dt, w); if (this.dust && dt > 0) this.dust.fromUnit(u, dt); }
    // separation between ground units (cheap O(n^2); fine for a few hundred units)
    const g = this.units.filter(u => !u.spec.air || u.alt < 0.1);
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const a = g[i], b = g[j]; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const r = a.radius + b.radius, d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (r - d) * 0.5, nx = dx / d, nz = dz / d;
        const wa = b.radius / r, wb = a.radius / r; // lighter unit moves more
        if (!(a.spec.air)) { a.pos.x -= nx * push * wa; a.pos.z -= nz * push * wa; }
        if (!(b.spec.air)) { b.pos.x += nx * push * wb; b.pos.z += nz * push * wb; }
      }
    }
    if (!this.auto) return;
    // autonomous orders
    for (const sq of this.squads) {
      const L = sq.leader; if (!L) continue;
      if (sq.members.every(m => !m.target)) { sq.idle -= dt; if (sq.idle <= 0) { const [x, z] = this.freePoint(2); sq.order(x, z); sq.idle = rnd(2, 9); } }
    }
    for (const u of this.units) {
      if (u.squad) continue;
      const parked = u.spec.air ? u.state === 'parked' : !u.target;
      if (parked) { u.idle -= dt; if (u.idle <= 0) { const [x, z] = this.freePoint(u.spec.air ? 7 : 4); u.order(x, z); u.idle = u.spec.air ? rnd(6, 20) : rnd(2, 10); } }
    }
  }
}
