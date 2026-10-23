import { RULES } from './rules.js';

// Forward operating bases: an engineer within range of a supply truck that holds
// enough supplies builds a FOB (radio + spawn point) over buildTime seconds.
export class Fobs {
  constructor(units, teams, world) { this.units = units; this.teams = teams; this.world = world; this.builds = []; this.onBuilt = null; }

  active(team) { return this.units.units.filter(u => u.type === 'fob' && u.team === team && !u.dead); }
  kitsLeft(team) { const t = this.teams[team]; return Math.max(0, t.fobKits - this.active(team).length - this.builds.filter(b => b.team === team).length); }
  nearestTruck(u) {
    const r = RULES.fob;
    return this.units.units.filter(t => t.supply && !t.dead && t.team === u.team && t.supplies >= r.supplyCost && Math.hypot(t.pos.x - u.pos.x, t.pos.z - u.pos.z) <= r.buildRange)[0] || null;
  }
  canBuild(eng) {
    const r = RULES.fob;
    if (!eng || eng.dead || eng.kit !== 'engineer' || eng.mounted) return { ok: false, reason: 'needs an engineer' };
    if (eng.building) return { ok: false, reason: 'already building' };
    if (this.kitsLeft(eng.team) <= 0) return { ok: false, reason: 'no FOB kits left' };
    const truck = this.nearestTruck(eng); if (!truck) return { ok: false, reason: `needs a supply truck with ${r.supplyCost} supplies within ${r.buildRange} m` };
    for (const f of this.active(eng.team)) if (Math.hypot(f.pos.x - eng.pos.x, f.pos.z - eng.pos.z) < r.minSpacing) return { ok: false, reason: `too close to another FOB (${r.minSpacing} m)` };
    const enemyBase = this.teams[1 - eng.team].base; if (Math.hypot(enemyBase.x - eng.pos.x, enemyBase.z - eng.pos.z) < r.enemyBaseDistance) return { ok: false, reason: 'too close to the enemy main base' };
    if (this.units.nav && this.units.nav.vehicle.blocked(eng.pos.x, eng.pos.z)) return { ok: false, reason: 'ground too steep or wet here' };
    return { ok: true, truck };
  }
  startBuild(eng) {
    const c = this.canBuild(eng); if (!c.ok) return c;
    const d = this.teams[eng.team].doctrine || {};
    const b = { eng, truck: c.truck, team: eng.team, x: eng.pos.x, z: eng.pos.z, t: RULES.fob.buildTime * (d.fobBuild || 1), total: RULES.fob.buildTime * (d.fobBuild || 1) };
    eng.building = b; eng.hold = true; eng.target = null; eng.dest = null; eng.path = null;
    this.builds.push(b); return { ok: true, build: b };
  }
  tick(dt) {
    for (let i = this.builds.length - 1; i >= 0; i--) {
      const b = this.builds[i], e = b.eng;
      const cancel = e.dead || e.mounted || Math.hypot(e.pos.x - b.x, e.pos.z - b.z) > 3 || b.truck.dead || Math.hypot(b.truck.pos.x - b.x, b.truck.pos.z - b.z) > RULES.fob.buildRange + 5;
      if (cancel) { e.building = null; e.hold = false; this.builds.splice(i, 1); continue; }
      b.t -= dt; if (b.t > 0) continue;
      b.truck.supplies -= RULES.fob.supplyCost;
      e.building = null; e.hold = false; this.builds.splice(i, 1);
      const fob = this.units.spawn('fob', b.x, b.z, Math.random() * Math.PI * 2, b.team);
      fob.label = `FB-${String(this.active(b.team).length).padStart(2, '0')}`;
      if (this.onBuilt) this.onBuilt(fob);
    }
  }
}
