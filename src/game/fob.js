import { RULES } from './rules.js';
import { sandbagBoxes, trapBoxes, emplacementBoxes, wallBoxes, platformBoxes, platformDeck, TRAPS, WALL, PLAT } from '../core/models.js';
import { roadDist, roadAlong, pathDist } from '../core/math.js';

// Forward operating bases: an engineer within range of a supply truck that holds
// enough supplies builds a FOB (radio + spawn point) over buildTime seconds.
export class Fobs {
  constructor(units, teams, world) { this.units = units; this.teams = teams; this.world = world; this.builds = []; this.onBuilt = null; this.onSandbags = null; this.onTraps = null; this.onTrapsCleared = null; this.onEmplacement = null; }

  active(team) { return this.units.units.filter(u => u.type === 'fob' && u.team === team && !u.dead); }
  // a mode may loosen the rules for its map (Hold: the farm's one truck serves the whole knoll, more positions): mode.buildRules
  rule(key, dflt) { const M = this.match && this.match.mode, R = M && M.buildRules; return R && R[key] !== undefined ? R[key] : dflt; }
  buildRange(team) { return this.rule('buildRange', RULES.fob.buildRange); }
  // a truck of the side with `cost` supplies within reach of the engineer
  truckFor(eng, cost) { const r = this.buildRange(eng.team); return this.units.units.filter(t => t.supply && !t.dead && t.team === eng.team && t.supplies >= cost && Math.hypot(t.pos.x - eng.pos.x, t.pos.z - eng.pos.z) <= r)[0] || null; }
  // the mode's say on a spot (Hold: inside the farm); null when it has none
  siteOk(team, x, z) { const M = this.match && this.match.mode; return M && M.siteOk ? M.siteOk(team, x, z) : null; }
  kitsLeft(team) { const t = this.teams[team]; return Math.max(0, t.fobKits - this.active(team).length - this.builds.filter(b => b.team === team && !b.kind).length); }   // FOB builds have no kind
  sandbagsOf(team) { return this.units.units.filter(u => u.type === 'sandbags' && u.team === team && !u.dead); }
  emplacementsOf(team) { return this.units.units.filter(u => u.type === 'emplacement' && u.team === team && !u.dead); }
  // Emplacements belong to a FOB: an engineer within fobRange of one of his side's FOBs, beside a supply truck with the
  // gun's supplies, builds it where he stands, facing the enemy's base; perFob to a FOB, clear of the FOB, other
  // emplacements and sandbags, and of the road
  emplacementsAt(fob) {
    const R = RULES.emplacement;
    return this.emplacementsOf(fob.team).filter(e => Math.hypot(e.pos.x - fob.pos.x, e.pos.z - fob.pos.z) <= this.rule('fobRange', R.fobRange)).length + this.builds.filter(b => b.kind === 'emplacement' && b.fob === fob).length;
  }
  // whether (x, z) will take an emplacement for `team`: { fob } when it will, { reason, fob? } when not
  emplacementSite(team, x, z) {
    const R = RULES.emplacement, d = (u) => Math.hypot(u.pos.x - x, u.pos.z - z), fobRange = this.rule('fobRange', R.fobRange), perFob = this.rule('perFob', R.perFob);
    const bad = this.siteOk(team, x, z); if (bad) return { reason: bad };
    const fob = this.active(team).filter(f => d(f) <= fobRange).sort((a, b) => d(a) - d(b))[0];
    if (!fob) return { reason: `needs one of your FOBs within ${fobRange} m` };
    if (this.emplacementsAt(fob) >= perFob) return { reason: `this FOB has its ${perFob} emplacements`, fob };
    if (d(fob) < R.fobClear) return { reason: 'too close to the FOB', fob };
    for (const o of [...this.emplacementsOf(team), ...this.sandbagsOf(team)]) if (d(o) < R.minSpacing) return { reason: `too close to another position (${R.minSpacing} m)`, fob };
    if (this.builds.some(b => (b.kind === 'emplacement' || b.kind === 'sandbags') && b.team === team && Math.hypot(b.x - x, b.z - z) < R.minSpacing)) return { reason: 'too close to another build', fob };
    if (this.units.nav && this.units.nav.foot.blocked(x, z)) return { reason: 'no room here', fob };
    if (roadDist(this.world.map, x, z) < R.roadClear) return { reason: 'too close to the road', fob };
    const xr = this.onCrossing(x, z); if (xr) return { reason: xr, fob };
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
    const truck = this.truckFor(eng, g.supplyCost);
    if (!truck) return { ok: false, reason: `needs a supply truck with ${g.supplyCost} supplies within ${this.buildRange(eng.team)} m` };
    return { ok: true, truck, fob: site.fob, x, z };
  }
  // h: a facing the player chose (the placement ghost); otherwise the mode's threat heading when it is done
  startEmplacement(eng, gun, at = null, h = null) {
    const c = this.canBuildEmplacement(eng, gun, at); if (!c.ok) return c;
    const d = this.teams[eng.team].doctrine || {}, t = RULES.emplacement[gun].buildTime * (d.fobBuild || 1);
    const b = { kind: 'emplacement', gun, fob: c.fob, eng, truck: c.truck, team: eng.team, x: c.x, z: c.z, h: h === null ? undefined : h, t, total: t };
    eng.building = b; eng.hold = true; eng.target = null; eng.dest = null; eng.path = null;
    this.builds.push(b); return { ok: true, build: b };
  }
  // Bags never go where they would shut a crossing: the road check keeps them off roads, this keeps them off bridge decks
  // (any bridge, within m of its edges) and the railway, which the road check does not know (the Rail Bridge on Narva is
  // railway, and a position on its 10 m deck once closed it to every vehicle for the rest of the match)
  onCrossing(x, z, m = 6) {
    const B = this.world.bridges || [];
    for (const b of B) { if (b.deck) continue; const dx = x - b.x, dz = z - b.z, c = Math.cos(b.angle), s = Math.sin(b.angle); if (Math.abs(dx * s + dz * c) <= b.len / 2 + m && Math.abs(dx * c - dz * s) <= b.w / 2 + m) return 'not on a bridge'; }   // a platform's deck is no crossing
    const rail = this.world.map && this.world.map.rail; if (rail && rail.length > 1 && pathDist(rail, x, z) < RULES.sandbags.roadClear) return 'too close to the railway';
    return null;
  }
  // Improvised sandbag position: the same crew as a FOB (an engineer by a supply truck), cheaper and quicker, no kit
  // whether (x, z) will take a sandbag position for `team`: {} when it will, { reason } when not
  sandbagSite(team, x, z) {
    const r = RULES.sandbags, max = this.rule('sandbagsMax', r.max);
    const bad = this.siteOk(team, x, z); if (bad) return { reason: bad };
    if (this.sandbagsOf(team).length + this.builds.filter(b => b.team === team && b.kind === 'sandbags').length >= max) return { reason: `no more than ${max} positions` };
    for (const s of this.sandbagsOf(team)) if (Math.hypot(s.pos.x - x, s.pos.z - z) < r.minSpacing) return { reason: `too close to another position (${r.minSpacing} m)` };
    for (const e of this.emplacementsOf(team)) if (Math.hypot(e.pos.x - x, e.pos.z - z) < RULES.emplacement.minSpacing) return { reason: `too close to a gun (${RULES.emplacement.minSpacing} m)` };
    if (this.builds.some(b => (b.kind === 'emplacement' || b.kind === 'sandbags') && b.team === team && b.eng && Math.hypot(b.x - x, b.z - z) < r.minSpacing)) return { reason: 'too close to another build' };
    const enemyBase = this.teams[1 - team].base; if (Math.hypot(enemyBase.x - x, enemyBase.z - z) < r.enemyBaseDistance) return { reason: 'too close to the enemy main base' };
    if (this.units.nav && this.units.nav.foot.blocked(x, z)) return { reason: 'no room here' };
    if (roadDist(this.world.map, x, z) < r.roadClear) return { reason: 'too close to the road' };   // it would block our own convoys
    const xr = this.onCrossing(x, z); if (xr) return { reason: xr };
    return {};
  }
  canBuildSandbags(eng, at = null) {
    const r = RULES.sandbags;
    if (!eng || eng.dead || eng.kit !== 'engineer' || eng.mounted) return { ok: false, reason: 'needs an engineer' };
    if (eng.building) return { ok: false, reason: 'already building' };
    const [x, z] = at && Math.hypot(at[0] - eng.pos.x, at[1] - eng.pos.z) < 3 ? at : [eng.pos.x, eng.pos.z];
    const site = this.sandbagSite(eng.team, x, z); if (site.reason) return { ok: false, reason: site.reason };
    const truck = this.truckFor(eng, r.supplyCost);
    if (!truck) return { ok: false, reason: `needs a supply truck with ${r.supplyCost} supplies within ${this.buildRange(eng.team)} m` };
    return { ok: true, truck, x, z };
  }
  startSandbags(eng, at = null, h = null) {
    const c = this.canBuildSandbags(eng, at); if (!c.ok) return c;
    const d = this.teams[eng.team].doctrine || {}, t = RULES.sandbags.buildTime * (d.fobBuild || 1);
    const b = { kind: 'sandbags', eng, truck: c.truck, team: eng.team, x: c.x, z: c.z, h: h === null ? undefined : h, t, total: t };
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
  // which way a position faces: toward where the mode says the threat comes from (Hold: the nearer spawn), else the enemy's main base
  threatHeading(team, x, z) {
    const M = this.match && this.match.mode, p = M && M.threatFrom ? M.threatFrom(team, x, z) : null, eb = p || this.teams[1 - team].base;
    return Math.atan2(eb.x - x, eb.z - z);
  }
  trapRow(x, z, team, h = null) {   // h: a facing the player chose, used off the road
    const [d, tx, tz, px, pz] = roadAlong(this.world.map, x, z); if (d < 12) return [px, pz, Math.atan2(tx, tz)];
    return [x, z, h === null ? this.threatHeading(team, x, z) : h];
  }
  // whether a row at (x, z) is allowed for `team`: {} or { reason }
  trapSite(team, x, z) {
    const r = RULES.traps, max = this.rule('trapsMax', r.max);
    const bad = this.siteOk(team, x, z); if (bad) return { reason: bad };
    if (this.trapsOf(team).length + this.builds.filter(b => b.team === team && b.kind === 'traps').length >= max) return { reason: `no more than ${max} rows of traps` };
    if (this.trapsAt(x, z, r.minSpacing)) return { reason: `too close to other traps (${r.minSpacing} m)` };
    const enemyBase = this.teams[1 - team].base; if (Math.hypot(enemyBase.x - x, enemyBase.z - z) < r.enemyBaseDistance) return { reason: 'too close to the enemy main base' };
    return {};
  }
  canBuildTraps(eng, at = null) {
    const r = RULES.traps;
    if (!eng || eng.dead || eng.kit !== 'engineer' || eng.mounted) return { ok: false, reason: 'needs an engineer' };
    if (eng.building) return { ok: false, reason: 'already building' };
    const [x, z] = at && Math.hypot(at[0] - eng.pos.x, at[1] - eng.pos.z) < 3 ? at : [eng.pos.x, eng.pos.z];
    const site = this.trapSite(eng.team, x, z); if (site.reason) return { ok: false, reason: site.reason };
    const truck = this.truckFor(eng, r.supplyCost);
    if (!truck) return { ok: false, reason: `needs a supply truck with ${r.supplyCost} supplies within ${this.buildRange(eng.team)} m` };
    return { ok: true, truck, x, z };
  }
  startTraps(eng, at = null, h = null) {
    const c = this.canBuildTraps(eng, at); if (!c.ok) return c;
    const [rx, rz, hh] = at && h !== null ? [c.x, c.z, h] : this.trapRow(c.x, c.z, eng.team, h), t = RULES.traps.buildTime;
    const b = { kind: 'traps', eng, truck: c.truck, team: eng.team, x: c.x, z: c.z, rx, rz, h: hh, t, total: t };
    eng.building = b; eng.hold = true; eng.target = null; eng.dest = null; eng.path = null;
    this.builds.push(b); return { ok: true, build: b };
  }
  // Base defence works (docs/GAME_PLAN.md B3), from a supply truck like sandbags: a wall run, 6 m of gabions across the facing that
  // blocks sight and movement until shellfire brings it down (game/buildings.js), and a platform, a 6 by 4 m deck 3 m up that four
  // men man and see over the walls from. Both go where the ghost puts them (the build plan) or where the engineer stands.
  wallsOf(team) { return this.units.units.filter(u => u.type === 'wall' && u.team === team && !u.dead); }
  platformsOf(team) { return this.units.units.filter(u => u.type === 'platform' && u.team === team && !u.dead); }
  // the ground under a footprint: clear of every obstacle (built ones too, so runs may touch end to end), dry, not too steep, off
  // the roads and crossings, clear of the FOB; `pts` are world points to try, `slope` the most the ground may fall
  groundOk(team, pts, slope, fobClear) {
    const W = this.world, T = W.terrain;
    for (const [px, pz] of pts) {
      if (Math.abs(px) > W.half - 4 || Math.abs(pz) > W.half - 4) return 'at the edge of the map';
      if (W.isBlocked(px, pz, 0.3, true)) return 'no room here';
      if (T && T.height(px, pz) < T.water) return 'in the water';
      if (T && T.slope(px, pz) > slope) return 'too steep here';
      for (const f of this.active(team)) if (Math.hypot(f.pos.x - px, f.pos.z - pz) < fobClear) return 'too close to the FOB';
      if (roadDist(W.map, px, pz) < RULES.sandbags.roadClear) return 'too close to the road';
      const xr = this.onCrossing(px, pz); if (xr) return xr;
    }
    return null;
  }
  // whether a wall run at (x, z) facing h (the run lies across the facing) is allowed for `team`: {} or { reason }
  wallSite(team, x, z, h = null) {
    const R = RULES.wall, max = this.rule('wallsMax', R.max), hh = h === null ? this.threatHeading(team, x, z) : h, c = Math.cos(hh), s = Math.sin(hh);
    const bad = this.siteOk(team, x, z); if (bad) return { reason: bad };
    if (this.wallsOf(team).length + this.builds.filter(b => b.team === team && b.kind === 'wall').length >= max) return { reason: `no more than ${max} wall runs` };
    const g = this.groundOk(team, [-2.5, -1.25, 0, 1.25, 2.5].map(lx => [x + lx * c, z - lx * s]), 0.9, R.fobClear); if (g) return { reason: g };
    for (const p of this.platformsOf(team)) if (Math.hypot(p.pos.x - x, p.pos.z - z) < 5) return { reason: 'too close to a platform' };
    if (this.builds.some(b => (b.kind === 'wall' || b.kind === 'platform') && b.team === team && Math.hypot(b.x - x, b.z - z) < (b.kind === 'wall' ? 5.5 : 5))) return { reason: 'too close to another build' };
    return {};
  }
  // whether a platform at (x, z) facing h is allowed: level ground under all four legs and room for the ladder behind
  platformSite(team, x, z, h = null) {
    const R = RULES.platform, max = this.rule('platformsMax', R.max), hh = h === null ? this.threatHeading(team, x, z) : h, c = Math.cos(hh), s = Math.sin(hh), T = this.world.terrain;
    const bad = this.siteOk(team, x, z); if (bad) return { reason: bad };
    if (this.platformsOf(team).length + this.builds.filter(b => b.team === team && b.kind === 'platform').length >= max) return { reason: `no more than ${max} platforms` };
    const L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c], hx = PLAT.w / 2 - 0.4, hz = PLAT.d / 2 - 0.4, corners = [L(-hx, -hz), L(hx, -hz), L(-hx, hz), L(hx, hz)];
    const g = this.groundOk(team, [[x, z], ...corners, L(0, -PLAT.d / 2 - 1.4), L(0, -PLAT.d / 2 - 3)], R.maxSlope, R.fobClear); if (g) return { reason: g };
    if (T) { const ys = corners.map(([px, pz]) => T.height(px, pz)); if (Math.max(...ys) - Math.min(...ys) > 1.2) return { reason: 'too steep here' }; }   // the legs would float or sink
    for (const p of this.platformsOf(team)) if (Math.hypot(p.pos.x - x, p.pos.z - z) < 7.5) return { reason: 'too close to another platform' };
    for (const w of this.wallsOf(team)) if (Math.hypot(w.pos.x - x, w.pos.z - z) < 5) return { reason: 'too close to a wall' };
    for (const o of [...this.sandbagsOf(team), ...this.emplacementsOf(team)]) if (Math.hypot(o.pos.x - x, o.pos.z - z) < 6) return { reason: 'too close to another position' };
    if (this.builds.some(b => b.kind && b.kind !== 'traps' && b.kind !== 'clear' && b.team === team && Math.hypot(b.x - x, b.z - z) < (b.kind === 'platform' ? 7.5 : 6))) return { reason: 'too close to another build' };
    return {};
  }
  canBuildWall(eng, at = null, h = null) {
    if (!eng || eng.dead || eng.kit !== 'engineer' || eng.mounted) return { ok: false, reason: 'needs an engineer' };
    if (eng.building) return { ok: false, reason: 'already building' };
    const [x, z] = at && Math.hypot(at[0] - eng.pos.x, at[1] - eng.pos.z) < 3.5 ? at : [eng.pos.x, eng.pos.z];
    const site = this.wallSite(eng.team, x, z, h); if (site.reason) return { ok: false, reason: site.reason };
    const truck = this.truckFor(eng, RULES.wall.supplyCost);
    if (!truck) return { ok: false, reason: `needs a supply truck with ${RULES.wall.supplyCost} supplies within ${this.buildRange(eng.team)} m` };
    return { ok: true, truck, x, z };
  }
  startWall(eng, at = null, h = null) {
    const c = this.canBuildWall(eng, at, h); if (!c.ok) return c;
    const d = this.teams[eng.team].doctrine || {}, t = RULES.wall.buildTime * (d.fobBuild || 1);
    const b = { kind: 'wall', eng, truck: c.truck, team: eng.team, x: c.x, z: c.z, h: h === null ? undefined : h, t, total: t };
    eng.building = b; eng.hold = true; eng.target = null; eng.dest = null; eng.path = null;
    this.builds.push(b); return { ok: true, build: b };
  }
  canBuildPlatform(eng, at = null, h = null) {
    if (!eng || eng.dead || eng.kit !== 'engineer' || eng.mounted) return { ok: false, reason: 'needs an engineer' };
    if (eng.building) return { ok: false, reason: 'already building' };
    const [x, z] = at && Math.hypot(at[0] - eng.pos.x, at[1] - eng.pos.z) < 5 ? at : [eng.pos.x, eng.pos.z];   // he stands at the ladder's foot, behind it
    const site = this.platformSite(eng.team, x, z, h); if (site.reason) return { ok: false, reason: site.reason };
    const truck = this.truckFor(eng, RULES.platform.supplyCost);
    if (!truck) return { ok: false, reason: `needs a supply truck with ${RULES.platform.supplyCost} supplies within ${this.buildRange(eng.team)} m` };
    return { ok: true, truck, x, z };
  }
  startPlatform(eng, at = null, h = null) {
    const c = this.canBuildPlatform(eng, at, h); if (!c.ok) return c;
    const d = this.teams[eng.team].doctrine || {}, t = RULES.platform.buildTime * (d.fobBuild || 1);
    const b = { kind: 'platform', eng, truck: c.truck, team: eng.team, x: c.x, z: c.z, h: h === null ? undefined : h, t, total: t };
    eng.building = b; eng.hold = true; eng.target = null; eng.dest = null; eng.path = null;
    this.builds.push(b); return { ok: true, build: b };
  }
  // the wall run (anyone's) whose line passes within r of a point, and the platform whose deck a point is within r of
  wallsAt(x, z, r = RULES.sandbags.clearRange) {
    let best = null, bd = r;
    for (const t of this.units.units) {
      if (t.type !== 'wall' || t.dead) continue;
      const [lx, lz] = t.worldToLocal(x, z), d = Math.hypot(Math.max(0, Math.abs(lx) - WALL.len / 2), lz);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  platformsAt(x, z, r = RULES.sandbags.clearRange) {
    let best = null, bd = r;
    for (const t of this.units.units) { if (t.type !== 'platform' || t.dead) continue; const [lx, lz] = t.worldToLocal(x, z), d = Math.hypot(Math.max(0, Math.abs(lx) - PLAT.w / 2), Math.max(0, Math.abs(lz) - PLAT.d / 2)); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  // the sandbag position (anyone's) nearest a point, within r of its centre
  sandbagsAt(x, z, r = RULES.sandbags.clearRange) {
    let best = null, bd = r;
    for (const s of this.units.units) { if (s.type !== 'sandbags' || s.dead) continue; const d = Math.hypot(s.pos.x - x, s.pos.z - z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  // an engineer clears the row of traps he stands at, or failing that the sandbag position: either side's
  canClear(eng) {
    if (!eng || eng.dead || eng.kit !== 'engineer' || eng.mounted) return { ok: false, reason: 'needs an engineer' };
    if (eng.building) return { ok: false, reason: 'already working' };
    const traps = this.trapsAt(eng.pos.x, eng.pos.z), sandbags = traps ? null : this.sandbagsAt(eng.pos.x, eng.pos.z), wall = traps || sandbags ? null : this.wallsAt(eng.pos.x, eng.pos.z), platform = traps || sandbags || wall ? null : this.platformsAt(eng.pos.x, eng.pos.z);
    if (!traps && !sandbags && !wall && !platform) return { ok: false, reason: `no traps, sandbags, wall or platform within ${RULES.traps.clearRange} m` };
    const what = traps || sandbags || wall || platform; if (this.builds.some(b => b.kind === 'clear' && (b.traps === what || b.sandbags === what || b.wall === what || b.platform === what))) return { ok: false, reason: 'already being cleared' };
    return { ok: true, traps, sandbags, wall, platform };
  }
  startClear(eng) {
    const c = this.canClear(eng); if (!c.ok) return c;
    const t = c.traps ? RULES.traps.clearTime : c.sandbags ? RULES.sandbags.clearTime : c.wall ? RULES.wall.clearTime : RULES.platform.clearTime, b = { kind: 'clear', eng, traps: c.traps || null, sandbags: c.sandbags || null, wall: c.wall || null, platform: c.platform || null, team: eng.team, x: eng.pos.x, z: eng.pos.z, t, total: t };
    eng.building = b; eng.hold = true; eng.target = null; eng.dest = null; eng.path = null;
    this.builds.push(b); return { ok: true, build: b };
  }
  // stop what this engineer is building; nothing has been spent yet (the truck pays when it is done)
  cancel(eng) {
    const i = this.builds.findIndex(b => b.eng === eng); if (i < 0) return null;
    const b = this.builds[i]; this.builds.splice(i, 1); eng.building = null; eng.hold = false; return b;
  }
  nearestTruck(u) { return this.truckFor(u, RULES.fob.supplyCost); }
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
      // off the spot (a platform's builder stands at the ladder's foot, behind the deck), aboard, dead, the truck gone or away, the thing to clear gone: the build stops
      const cancel = e.dead || e.mounted || Math.hypot(e.pos.x - b.x, e.pos.z - b.z) > (b.kind === 'platform' ? 5 : 3) || (b.truck && (b.truck.dead || Math.hypot(b.truck.pos.x - b.x, b.truck.pos.z - b.z) > this.buildRange(b.team) + 5)) || (b.traps && b.traps.dead) || (b.sandbags && b.sandbags.dead) || (b.wall && b.wall.dead) || (b.platform && b.platform.dead);
      if (cancel) { e.building = null; e.hold = false; this.builds.splice(i, 1); continue; }
      b.t -= dt; if (b.t > 0) continue;
      e.building = null; e.hold = false; this.builds.splice(i, 1);
      if (b.kind === 'traps') {
        b.truck.supplies -= RULES.traps.supplyCost;
        const u = this.units.spawn('traps', b.rx, b.rz, b.h, b.team); u.label = `TT-${String(this.trapsOf(b.team).length).padStart(2, '0')}`;
        if (this.onTraps) this.onTraps(u, trapBoxes(b.rx, b.rz, b.h));
        continue;
      }
      if (b.kind === 'clear') { if (b.sandbags) { if (this.onSandbagsCleared) this.onSandbagsCleared(b.sandbags, b.team); } else if (b.wall) { if (this.onWallCleared) this.onWallCleared(b.wall, b.team); } else if (b.platform) { if (this.onPlatformCleared) this.onPlatformCleared(b.platform, b.team); } else if (this.onTrapsCleared) this.onTrapsCleared(b.traps, b.team); continue; }
      if (b.kind === 'wall' || b.kind === 'platform') {
        b.truck.supplies -= RULES[b.kind].supplyCost;
        const h = b.h !== undefined ? b.h : this.threatHeading(b.team, b.x, b.z);   // a wall lies across the threat; a platform's parapet faces it, its ladder away
        const u = this.units.spawn(b.kind, b.x, b.z, h, b.team); u.label = `${b.kind === 'wall' ? 'WL' : 'PF'}-${String((b.kind === 'wall' ? this.wallsOf(b.team) : this.platformsOf(b.team)).length).padStart(2, '0')}`;
        if (b.kind === 'wall') { if (this.onWall) this.onWall(u, wallBoxes(b.x, b.z, h)); }
        else if (this.onPlatform) this.onPlatform(u, platformBoxes(b.x, b.z, h), platformDeck(b.x, b.z, h, this.world.surfaceAt ? this.world.surfaceAt(b.x, b.z) : this.world.heightAt(b.x, b.z)));
        continue;
      }
      if (b.kind === 'emplacement') {
        b.truck.supplies -= RULES.emplacement[b.gun].supplyCost;
        const h = b.h !== undefined ? b.h : this.threatHeading(b.team, b.x, b.z), pre = { hmg: 'MG', atgm: 'AT', mortar: 'MO' }[b.gun];
        const u = this.units.spawn('emplacement', b.x, b.z, h, b.team, { gun: b.gun }); u.label = `${pre}-${String(this.emplacementsOf(b.team).filter(e => e.gun === b.gun).length).padStart(2, '0')}`;
        if (this.onEmplacement) this.onEmplacement(u, emplacementBoxes(b.x, b.z, h));
        continue;
      }
      if (b.kind === 'sandbags') {
        b.truck.supplies -= RULES.sandbags.supplyCost;
        const h = b.h !== undefined ? b.h : this.threatHeading(b.team, b.x, b.z);   // the open side faces away from the threat, toward home
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
