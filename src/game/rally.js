import { RULES } from './rules.js';

// Rally points: each squad's own forward spawn, after Squad's (values scaled to a 1 km map and a 15 s respawn,
// see reports/). The squad's leader drops one with a squadmate close by; squadmates who die come back there on
// the rally's wave, as long as they have been down long enough to make it; a single enemy close by burns it.
// Placing again moves it, after a cooldown. Free, no tickets, nothing to build.
export class Rallies {
  constructor(units, teams, match) { this.units = units; this.teams = teams; this.match = match; this.list = []; }

  of(sq) { return sq && sq.rally && !sq.rally.dead ? sq.rally : null; }
  cooldownLeft(sq) { return Math.max(0, (sq.rallyReadyAt || 0) - this.match.elapsed); }
  nextWaveIn(r) { return Math.max(0, r.nextWave - this.match.elapsed); }
  enemyWithin(team, x, z, r) {
    for (const u of this.units.units) if (!u.dead && !u.mounted && u.team !== team && !u.spec.structure && !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - x, u.pos.z - z) < r) return true;
    return false;
  }

  // can this squad's leader drop a rally where he stands? (pure: the HUD asks every frame)
  canPlace(sq) {
    const R = RULES.rally, L = sq && sq.leader;
    if (!L || L.mounted) return { ok: false, reason: 'needs the squad on foot' };
    const cd = this.cooldownLeft(sq); if (cd > 0) return { ok: false, reason: `ready in ${Math.ceil(cd)} s` };
    if (!sq.members.some(m => m !== L && !m.dead && !m.mounted && Math.hypot(m.pos.x - L.pos.x, m.pos.z - L.pos.z) <= R.placeRange)) return { ok: false, reason: `needs a squadmate within ${R.placeRange} m` };
    const eb = this.teams[1 - L.team].base; if (Math.hypot(eb.x - L.pos.x, eb.z - L.pos.z) < R.enemyBaseDistance) return { ok: false, reason: 'too close to the enemy main base' };
    if (this.units.nav && this.units.nav.foot.blocked(L.pos.x, L.pos.z)) return { ok: false, reason: 'no room here' };
    if (this.enemyWithin(L.team, L.pos.x, L.pos.z, R.blockRadius)) return { ok: false, reason: `enemy within ${R.blockRadius} m`, enemy: true };
    return { ok: true };
  }

  place(sq) {
    const R = RULES.rally, c = this.canPlace(sq);
    if (!c.ok) { if (c.enemy) sq.rallyReadyAt = this.match.elapsed + R.cooldown; return c; }   // trying under fire costs the cooldown, as in Squad
    const old = this.of(sq); if (old) this.remove(old);
    const L = sq.leader, u = this.units.spawn('rally', L.pos.x, L.pos.z, L.heading, L.team);
    u.label = 'RP-' + (L.label.split('-')[1] || sq.id); u.rallyOf = sq; u.nextWave = this.match.elapsed + R.wave; u.waveNow = false;
    sq.rally = u; sq.rallyReadyAt = this.match.elapsed + R.cooldown; this.list.push(u);
    return { ok: true, rally: u };
  }
  remove(u) { u.dead = true; u.remove = true; if (u.rallyOf && u.rallyOf.rally === u) u.rallyOf.rally = null; }

  // before respawns each tick: burn rallies with an enemy on top of them, and flag the ones whose wave is due
  tick() {
    const now = this.match.elapsed, R = RULES.rally;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const u = this.list[i];
      if (u.dead) { this.list.splice(i, 1); continue; }
      u.waveNow = false;
      if (this.enemyWithin(u.team, u.pos.x, u.pos.z, R.burnRadius)) {
        this.remove(u); this.list.splice(i, 1);
        if (this.units.dust) this.units.dust.puff(u.pos.x, u.pos.y + 0.5, u.pos.z);
        this.match.event({ type: 'rally lost', team: u.team, rally: u.label });
        continue;
      }
      if (now >= u.nextWave) { u.waveNow = true; u.nextWave += R.wave; }
    }
  }
}
