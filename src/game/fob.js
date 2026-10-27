import { RULES } from './rules.js';
import { sandbagBoxes, trapBoxes, emplacementBoxes, TRAPS } from '../core/models.js';
import { roadDist, roadAlong } from '../core/math.js';

// Forward operating bases: an engineer within range of a supply truck that holds
// enough supplies builds a FOB (radio + spawn point) over buildTime seconds.
export class Fobs {
  constructor(units, teams, world) { this.units = units; this.teams = teams; this.world = world; this.builds = []; this.onBuilt = null; this.onSandbags = null; this.onTraps = null; this.onTrapsCleared = null; this.onEmplacement = null; }

  active(team) { return this.units.units.filter(u => u.type === 'fob' && u.team === team && !u.dead); }
  kitsLeft(team) { const t = this.teams[team]; return Math.max(0, t.fobKits - this.active(team).length - this.builds.filter(b => b.team === team && !b.kind).length); }   // FOB builds have no kind
  sandbagsOf(team) { return this.units.units.filter(u => u.type === 'sandbags' && u.team === team && !u.dead); }
  emplacementsOf(team) { return this.units.units.filter(u => u.type === 'emplacement' && u.team === team && !u.dead); }
  // Emplacements belong to a FOB: an engineer within fobRange of one of his side's FOBs, beside a supply truck with the
  // gun's supplies, builds it where he stands, facing the enemy's base; perFob to a FOB, clear of the FOB, other
  // emplacements and sandbags, and of the road
  emplacementsAt(fob) {
    const R = RULES.emplacement;
    return this.emplacementsOf(fob.team).filter(e => Math.hypot(e.pos.x - fob.pos.x, e.pos.z - fob.pos.z) <= R.fobRange).length + this.builds.filter(b => b.kind === 'emplacement' && b.fob === fob).length;
  }
  // whether (x, z) will take an emplacement for `team`: { fob } when it will, { reason, fob? } when not
  emplacementSite(team, x, z) {
    const R = RULES.emplacement, d = (u) => Math.hypot(u.pos.x - x, u.pos.z - z);
    const fob = this.active(team).filter(f => d(f) <= R.fobRange).sort((a, b) => d(a) - d(b))[0];
    if (!fob) return { reason: `needs one of your FOBs within ${R.fobRange} m` };
    if (this.emplacementsAt(fob) >= R.perFob) return { reason: `this FOB has its ${R.perFob} emplacements`, fob };
    if (d(fob) < R.fobClear) return { reason: 'too close to the FOB', fob };
    for (const o of [...this.emplacementsOf(team), ...this.sandbagsOf(team)]) if (d(o) < R.minSpacing) return { reason: `too close to another position (${R.minSpacing} m)`, fob };
    if (this.builds.some(b => (b.kind === 'emplacement' || b.kind === 'sandbags') && b.team === team && Math.hypot(b.x - x, b.z - z) < R.minSpacing)) return { reason: 'too close to another build', fob };
    if (this.units.nav && this.units.nav.foot.blocked(x, z)) return { reason: 'no room here', fob };
    if (roadDist(this.world.map, x, z) < R.roadClear) return { reason: 'too close to the road', fob };
    return { fob };
  }
  // at: the spot the CPU chose, used when the engineer stands within 3 m of it (he stops a little short of a point)
  canBuildEmplacement(eng, gun, at = null) {
    const g = RULES.emplacement[gun];
    if (!g) return { ok: false, reason: 'no such emplacement' };
    if (!eng || eng.dead || eng.kit !== 'engineer' || eng.mounted) return { ok: false, reason: 'needs an engineer' };
    if (eng.building) return { ok: false, reason: 'already building' };
    const [x, z] = at && Math.hypot(at[0] - eng.pos.x, at[1] - eng.pos.z) < 3 ? at : [eng.pos.x, eng.pos.z];
    const site = this.emplacementSite(eng.team, x, z); if (site.reason) return { ok: false, reason: site.reason };
    const truck = this.units.units.filter(t => t.supply && !t.dead && t.team === eng.team && t.supplies >= g.supplyCost && Math.hypot(t.pos.x - eng.pos.x, t.pos.z - eng.pos.z) <= RULES.fob.buildRange)[0];
    if (!truck) return { ok: false, reason: `needs a supply truck with ${g.supplyCost} supplies within ${RULES.fob.buildRange} m` };
    return { ok: true, truck, fob: site.fob, x, z };
  }
  startEmplacement(eng, gun, at = null) {
    const c = this.canBuildEmplacement(eng, gun, at); if (!c.ok) return c;
    const d = this.teams[eng.team].doctrine || {}, t = RULES.emplacement[gun].buildTime * (d.fobBuild || 1);
    const b = { kind: 'emplacement', gun, fob: c.fob, eng, truck: c.truck, team: eng.team, x: c.x, z: c.z, t, total: t };
    eng.building = b; eng.hold = true; eng.target = null; eng.dest = null; eng.path = null;
    this.builds.push(b); return { ok: true, build: b };
  }
  // Improvised sandbag position: the same crew as a FOB (an engineer by a supply truck), cheaper and quicker, no kit
  canBuildSandbags(eng) {
    const r = RULES.sandbags;
    if (!eng || eng.dead || eng.kit !== 'engineer' || eng.mounted) return { ok: false, reason: 'needs an engineer' };
    if (eng.building) return { ok: false, reason: 'already building' };
    if (this.sandbagsOf(eng.team).length + this.builds.filter(b => b.team === eng.team && b.kind === 'sandbags').length >= r.max) return { ok: false, reason: `no more than ${r.max} positions` };
    const truck = this.units.units.filter(t => t.supply && !t.dead && t.team === eng.team && t.supplies >= r.supplyCost && Math.hypot(t.pos.x - eng.pos.x, t.pos.z - eng.pos.z) <= RULES.fob.buildRange)[0];
    if (!truck) return { ok: false, reason: `needs a supply truck with ${r.supplyCost} supplies within ${RULES.fob.buildRange} m` };
    for (const s of this.sandbagsOf(eng.team)) if (Math.hypot(s.pos.x - eng.pos.x, s.pos.z - eng.pos.z) < r.minSpacing) return { ok: false, reason: `too close to another position (${r.minSpacing} m)` };
    const enemyBase = this.teams[1 - eng.team].base; if (Math.hypot(enemyBase.x - eng.pos.x, enemyBase.z - eng.pos.z) < r.enemyBaseDistance) return { ok: false, reason: 'too close to the enemy main base' };
    if (this.units.nav && this.units.nav.foot.blocked(eng.pos.x, eng.pos.z)) return { ok: false, reason: 'no room here' };
    if (roadDist(this.world.map, eng.pos.x, eng.pos.z) < r.roadClear) return { ok: false, reason: 'too close to the road' };   // it would block our own convoys
    return { ok: true, truck };
  }
  startSandbags(eng) {
    const c = this.canBuildSandbags(eng); if (!c.ok) return c;
    const d = this.teams[eng.team].doctrine || {}, t = RULES.sandbags.buildTime * (d.fobBuild || 1);
    const b = { kind: 'sandbags', eng, truck: c.truck, team: eng.team, x: eng.pos.x, z: eng.pos.z, t, total: t };
    eng.building = b; eng.hold = true; eng.target = null; eng.dest = null; eng.path = null;
    this.builds.push(b); return { ok: true, build: b };
  }
  // Tank traps: a row of hedgehogs across the road the engineer stands on (or across the way to the enemy's base off the
  // road), from a supply truck like sandbags. They stop every vehicle, ours too; any engineer standing at a row clears it.
  trapsOf(team) { return this.units.units.filter(u => u.type === 'traps' && u.team === team && !u.dead); }
  // the row of traps (anyone's) whose line passes within r of a point
  trapsAt(x, z, r = RULES.traps.clearRange) {
    const half = (TRAPS.n - 1) / 2 * TRAPS.gap + TRAPS.foot / 2; let best = null, bd = r;
    for (const t of this.units.units) {
      if (t.type !== 'traps' || t.dead) continue;
      const c = Math.cos(t.heading), s = Math.sin(t.heading), dx = x - t.pos.x, dz = z - t.pos.z, lx = dx * c - dz * s, lz = dx * s + dz * c, d = Math.hypot(Math.max(0, Math.abs(lx) - half), lz);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  // where a row laid from (x, z) goes and which way it faces: across the road, centred on it, within 12 m of one; elsewhere
  // where the engineer stands, across the way to the enemy's base
  trapRow(x, z, team) {
    const [d, tx, tz, px, pz] = roadAlong(this.world.map, x, z); if (d < 12) return [px, pz, Math.atan2(tx, tz)];
    const eb = this.teams[1 - team].base; return [x, z, Math.atan2(eb.x - x, eb.z - z)];
  }
  canBuildTraps(eng) {
    const r = RULES.traps;
    if (!eng || eng.dead || eng.kit !== 'engineer' || eng.mounted) return { ok: false, reason: 'needs an engineer' };
    if (eng.building) return { ok: false, reason: 'already building' };
    if (this.trapsOf(eng.team).length + this.builds.filter(b => b.team === eng.team && b.kind === 'traps').length >= r.max) return { ok: false, reason: `no more than ${r.max} rows of traps` };
    const truck = this.units.units.filter(t => t.supply && !t.dead && t.team === eng.team && t.supplies >= r.supplyCost && Math.hypot(t.pos.x - eng.pos.x, t.pos.z - eng.pos.z) <= RULES.fob.buildRange)[0];
    if (!truck) return { ok: false, reason: `needs a supply truck with ${r.supplyCost} supplies within ${RULES.fob.buildRange} m` };
    if (this.trapsAt(eng.pos.x, eng.pos.z, r.minSpacing)) return { ok: false, reason: `too close to other traps (${r.minSpacing} m)` };
    const enemyBase = this.teams[1 - eng.team].base; if (Math.hypot(enemyBase.x - eng.pos.x, enemyBase.z - eng.pos.z) < r.enemyBaseDistance) return { ok: false, reason: 'too close to the enemy main base' };
    return { ok: true, truck };
  }
  startTraps(eng) {
    const c = this.canBuildTraps(eng); if (!c.ok) return c;
    const [rx, rz, h] = this.trapRow(eng.pos.x, eng.pos.z, eng.team), t = RULES.traps.buildTime;
    const b = { kind: 'traps', eng, truck: c.truck, team: eng.team, x: eng.pos.x, z: eng.pos.z, rx, rz, h, t, total: t };
    eng.building = b; eng.hold = true; eng.target = null; eng.dest = null; eng.path = null;
    this.builds.push(b); return { ok: true, build: b };
  }
  canClear(eng) {
    if (!eng || eng.dead || eng.kit !== 'engineer' || eng.mounted) return { ok: false, reason: 'needs an engineer' };
    if (eng.building) return { ok: false, reason: 'already working' };
    const traps = this.trapsAt(eng.pos.x, eng.pos.z); if (!traps) return { ok: false, reason: `no traps within ${RULES.traps.clearRange} m` };
    if (this.builds.some(b => b.kind === 'clear' && b.traps === traps)) return { ok: false, reason: 'already being cleared' };
    return { ok: true, traps };
  }
  startClear(eng) {
    const c = this.canClear(eng); if (!c.ok) return c;
    const t = RULES.traps.clearTime, b = { kind: 'clear', eng, traps: c.traps, team: eng.team, x: eng.pos.x, z: eng.pos.z, t, total: t };
    eng.building = b; eng.hold = true; eng.target = null; eng.dest = null; eng.path = null;
    this.builds.push(b); return { ok: true, build: b };
  }
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
      const cancel = e.dead || e.mounted || Math.hypot(e.pos.x - b.x, e.pos.z - b.z) > 3 || (b.truck && (b.truck.dead || Math.hypot(b.truck.pos.x - b.x, b.truck.pos.z - b.z) > RULES.fob.buildRange + 5)) || (b.traps && b.traps.dead);
      if (cancel) { e.building = null; e.hold = false; this.builds.splice(i, 1); continue; }
      b.t -= dt; if (b.t > 0) continue;
      e.building = null; e.hold = false; this.builds.splice(i, 1);
      if (b.kind === 'traps') {
        b.truck.supplies -= RULES.traps.supplyCost;
        const u = this.units.spawn('traps', b.rx, b.rz, b.h, b.team); u.label = `TT-${String(this.trapsOf(b.team).length).padStart(2, '0')}`;
        if (this.onTraps) this.onTraps(u, trapBoxes(b.rx, b.rz, b.h));
        continue;
      }
      if (b.kind === 'clear') { if (this.onTrapsCleared) this.onTrapsCleared(b.traps, b.team); continue; }
      if (b.kind === 'emplacement') {
        b.truck.supplies -= RULES.emplacement[b.gun].supplyCost;
        const eb = this.teams[1 - b.team].base, h = Math.atan2(eb.x - b.x, eb.z - b.z), pre = { hmg: 'MG', atgm: 'AT', mortar: 'MO' }[b.gun];
        const u = this.units.spawn('emplacement', b.x, b.z, h, b.team, { gun: b.gun }); u.label = `${pre}-${String(this.emplacementsOf(b.team).filter(e => e.gun === b.gun).length).padStart(2, '0')}`;
        if (this.onEmplacement) this.onEmplacement(u, emplacementBoxes(b.x, b.z, h));
        continue;
      }
      if (b.kind === 'sandbags') {
        b.truck.supplies -= RULES.sandbags.supplyCost;
        const eb = this.teams[1 - b.team].base, h = Math.atan2(eb.x - b.x, eb.z - b.z);   // the open side faces home
        const u = this.units.spawn('sandbags', b.x, b.z, h, b.team); u.label = `SB-${String(this.sandbagsOf(b.team).length).padStart(2, '0')}`;
        if (this.onSandbags) this.onSandbags(u, sandbagBoxes(b.x, b.z, h));
        continue;
      }
      b.truck.supplies -= RULES.fob.supplyCost;
      const fob = this.units.spawn('fob', b.x, b.z, Math.random() * Math.PI * 2, b.team);
      fob.label = `FB-${String(this.active(b.team).length).padStart(2, '0')}`;
      if (this.onBuilt) this.onBuilt(fob);
    }
  }
}
