import { WEAPONS } from './weapons.js';

// Targeting, line of sight, firing and damage. Ticks at a fixed rate from Match.
export class Combat {
  constructor(units, spatial, world, dust) {
    this.units = units; this.spatial = spatial; this.world = world; this.dust = dust;
    this.onDeath = null; this.scratch = []; this.teams = null; this.audio = null;
    this.blockers = world.obstacles.filter(o => (o.h === undefined ? 2 : o.h) >= 1.5);
  }

  // 2D segment vs. the tall obstacle boxes
  los(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    for (const o of this.blockers) {
      let t0 = 0, t1 = 1;
      for (const [p, d, lo, hi] of [[ax, dx, o.minX, o.maxX], [az, dz, o.minZ, o.maxZ]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
        let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) break;
      }
      if (t0 <= t1) return false;
    }
    return true;
  }

  eyeY(u) { return u.pos.y + (u.type === 'soldier' ? 1.5 : u.type === 'apc' ? 3.6 : 1.8); }
  canSee(u, e) {
    const T = this.world.terrain;
    if (T && !T.los(u.pos.x, this.eyeY(u), u.pos.z, e.pos.x, e.pos.y + 1.2, e.pos.z)) return false;   // hills block
    if ((u.spec.air && u.alt > 2) || (e.spec.air && e.alt > 2)) return true;
    return this.los(u.pos.x, u.pos.z, e.pos.x, e.pos.z);
  }

  findTarget(u, w) {
    const list = this.spatial.query(u.pos.x, u.pos.z, w.range, this.scratch);
    let best = null, bestScore = -Infinity;
    for (const e of list) {
      if (e.team === u.team || e.dead || e.mounted) continue;
      if (e.spec.air && e.alt > 2 && !w.air) continue;
      const d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z);
      let score = -d;
      if (w.prefersVehicles && e.type !== 'soldier') score += 40;
      if (!w.prefersVehicles && e.type === 'soldier') score += 6;
      if (score <= bestScore) continue;
      if (!this.canSee(u, e)) continue;
      best = e; bestScore = score;
    }
    return best;
  }

  tick(dt) {
    for (const u of this.units.units) {
      if (u.dead || !u.kit || u.mounted) continue;
      const w = WEAPONS[u.kit];
      u.cooldown -= dt;
      if (u.enemy) {
        const e = u.enemy, d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z);
        if (e.dead || e.mounted || d > w.range * 1.15 || ((u.retarget -= dt) <= 0 && !this.canSee(u, e))) { u.enemy = null; u.retarget = 0.3; }
        else u.hold = u.type === 'soldier' && d < w.range * 0.8;
      }
      if (!u.enemy) {
        u.hold = false;
        if ((u.retarget -= dt) <= 0) { u.retarget = 0.4 + Math.random() * 0.3; u.enemy = this.findTarget(u, w); }
      }
      if (u.enemy && u.cooldown <= 0) this.fire(u, w, u.enemy);
    }
  }

  fire(u, w, e) {
    u.cooldown = w.rate * (0.85 + Math.random() * 0.3);
    const my = this.eyeY(u);
    const ey = e.pos.y + (e.spec.air ? 2 : e.type === 'soldier' ? 1.1 : 2.2);
    const d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z);
    const T = this.teams ? this.teams[u.team] : null;
    let chance = w.acc * (1 - 0.6 * d / w.range) * ((T && T.acc) || 1);
    if (u.speed > 0.5) chance *= 0.5;
    if (e.type !== 'soldier') chance *= 1.6;             // vehicles are big targets
    const hit = Math.random() < chance;
    const sx = e.pos.x + (hit ? 0 : (Math.random() - 0.5) * 4), sz = e.pos.z + (hit ? 0 : (Math.random() - 0.5) * 4);
    this.dust.tracer(u.pos.x, my, u.pos.z, sx, hit ? ey : e.pos.y + 0.1, sz);
    if (w.explosive) this.dust.puff(u.pos.x, my, u.pos.z);
    if (this.audio) this.audio.shot(u.kit, u.pos.x, u.pos.z);
    if (hit) {
      const dmg = (e.type === 'soldier' ? w.dmgInf : w.dmgVeh) * ((T && T.dmg) || 1);
      if (w.explosive) this.dust.explosion(sx, ey, sz, 0.35); else this.dust.hitSpark(sx, ey, sz);
      if (this.audio) this.audio.hit(sx, sz);
      if (e.damage(dmg, u)) { this.onDeath && this.onDeath(e, u); }
    } else { this.dust.impact(sx, e.pos.y + 0.1, sz); if (this.audio) this.audio.impact(sx, sz); }
  }
}
