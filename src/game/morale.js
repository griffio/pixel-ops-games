import { RULES } from './rules.js';

// Squad morale (docs/GAME_PLAN.md, morale and fire plan F2). Suppression is a man's seconds: it drives him flat and decays in
// 2.5 s. Morale is the squad's minutes: 0..1, down with casualties in the squad and near it, with sustained suppression and
// with armour in sight it has no answer to, up when it is out of contact, faster near friends and at home, never above what
// its strength allows. Four states with hysteresis (RULES.morale): steady; shaken (aims worse, pauses longer); pinned (flat,
// will not move toward an enemy it can see); broken (drops its orders and runs for cover away from the enemy, then toward
// home, fires only at men within reach, takes no order until it steadies). The CPU weighs a squad by its state and leaves a
// broken one alone (sq.pinUntil); the roster card says so; the digest carries it. Ticks at the match rate after combat.
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export class Morale {
  constructor(match) { this.m = match; this.units = match.units; }
  // a man of a squad killed (dead) or wounded: his squad, and the squads of his side standing near him, feel it
  onCasualty(v, dead) {
    const R = RULES.morale, sq = v.squad; if (!sq || v.type !== 'soldier') return;
    this.hit(sq, dead ? (v.bledOut ? R.near : R.killed) : R.wounded);   // a man dying of his wounds was paid for when he went down
    for (const o of this.units.squads) if (o !== sq && o.team === sq.team && o.leader && dist(o.centroid(), v.pos) < R.nearRadius) this.hit(o, R.near);
  }
  hit(sq, amount) { const fit = sq.members.filter(u => u.fit); if (fit.length && fit.every(u => u.post && u.post.settled)) amount *= RULES.morale.postedDrain; sq.morale = Math.max(0, (sq.morale ?? 1) - amount); sq.hitAt = this.m.elapsed; }   // a casualty costs a settled squad half
  tick(dt) {
    const R = RULES.morale, m = this.m, now = m.elapsed, V = m.vision, C = m.combat;
    const contacts = [null, null], contactsOf = (t) => contacts[t] || (contacts[t] = (V ? V.contacts(t) : this.units.units.filter(u => u.team === 1 - t && !u.dead)).filter(u => !u.spec.structure && !u.down && !(u.spec.air && u.alt > 2)));
    for (const sq of this.units.squads) {
      if (sq.morale === undefined) { sq.morale = 1; sq.state = 'steady'; }
      const fit = sq.members.filter(u => u.fit && !u.mounted && !u.afloat);
      if (!fit.length) { if (sq.state === 'broken') this.unbreak(sq); if (!sq.members.some(u => !u.dead)) { sq.morale = 1; sq.state = 'steady'; } continue; }   // wiped out: fresh men come back steady; all down or aboard: nothing to do
      const t = sq.team, c = sq.centroid(), foes = t === 0 || t === 1 ? contactsOf(t) : [];
      let threat = null, td = R.threatRadius; for (const e of foes) { const d = dist(e.pos, c); if (d < td) { td = d; threat = e; } }
      sq.threat = threat ? { x: threat.pos.x, z: threat.pos.z, d: td } : null;
      const supp = fit.reduce((s, u) => s + u.supp, 0) / fit.length, engaged = fit.some(u => u.enemy && !u.enemy.dead);
      const strength = fit.length / sq.members.length, weak = 1 + (1 - strength);   // a squad down to two men feels everything half as much again
      // drains: half as much for a squad settled in its positions (bags, a platform, a gun), less at home (R.postedDrain, R.homeDrain)
      const base = m.teams[t].base, home = dist(base, c) < 60 || this.units.units.some(u => u.type === 'fob' && u.team === t && !u.dead && dist(u.pos, c) < 40);
      const posted = fit.every(u => u.post && u.post.settled);
      let drain = supp * R.suppDrain;
      if (threat && (threat.type === 'apc' || threat.type === 'tank') && td < R.armourRadius && !fit.some(u => u.kit === 'at')) drain += R.armourDrain;
      sq.morale = Math.max(0, sq.morale - drain * weak * (posted ? R.postedDrain : home ? R.homeDrain : 1) * dt);
      // recovery: calm (nobody suppressed, nobody engaging, no casualty for a while), faster near friends or at home, slower weak
      const calm = supp < 0.2 && !engaged && now - (sq.hitAt || -1e9) > R.calmAfter;
      if (calm) {
        const friends = this.units.squads.some(o => o !== sq && o.team === t && o.fitCount >= 2 && o.state !== 'broken' && dist(o.centroid(), c) < R.friendRadius);
        const rate = (sq.state === 'broken' && !threat ? R.recoverBroken : R.recover) * (home ? 2 : friends ? 1.5 : 1) * (fit.length < 2 ? 0.6 : 1);
        sq.morale = Math.min(R.capBase + (1 - R.capBase) * strength, sq.morale + rate * dt);
      }
      // the state, with hysteresis
      const s = sq.state, v = sq.morale, T = R.thresholds;
      let next = s;
      if (s === 'steady') { if (v < T.shaken) next = 'shaken'; }
      else if (s === 'shaken') { if (v < T.pinned) next = 'pinned'; else if (v >= T.steadyAgain) next = 'steady'; }
      else if (s === 'pinned') { if (v < T.broken) next = 'broken'; else if (v >= T.shakenAgain) next = 'shaken'; }
      else if (s === 'broken') { if (v >= T.pinnedAgain) next = 'pinned'; }
      if (next !== s) { if (next === 'broken') this.breakSq(sq, fit); else if (s === 'broken') this.unbreak(sq); sq.state = next; sq.stateAt = now; if (this.onState) this.onState(sq, next, s); }
      // what the state does to the men
      const pinned = sq.state === 'pinned'; for (const u of sq.members) u.pinnedDown = pinned;   // flat (Unit.stepGround), and crawling if moved; not through suppression, which would feed the drain and hold the squad there
      if (sq.state === 'broken') this.flee(sq, fit, c);
    }
  }
  // the squad breaks: whatever it was doing is dropped, every man runs
  breakSq(sq, fit) {
    sq.fleeAt = -1e9;
    for (const u of fit) { u.advance = false; u.holdFire = false; u.fleeing = true; u.enemy = null; u.burst = 0; if (u.post) u.leavePost(); }
    this.flee(sq, fit, sq.centroid());
  }
  unbreak(sq) { for (const u of sq.members) u.fleeing = false; sq.fleeGoal = null; for (const u of sq.members) if (u.fit && !u.down) { u.dest = null; u.target = null; u.path = null; } }   // stops where it is, flat (pinned follows)
  // where a broken squad runs: out of the nearest enemy's sight behind a building or a hill (combat.coverPoint), else straight
  // away from him; with no enemy about, toward home (the nearest own place, FOB or base) when one is near; then it waits
  flee(sq, fit, c) {
    const m = this.m, now = m.elapsed, R = RULES.morale; sq.pinUntil = now + 3;   // the strategist leaves it alone
    if (sq.busy && now - sq.fleeAt < 6) return;
    if (now - sq.fleeAt < 1.5) return;
    const th = sq.threat; let goal = null;
    if (th) {
      goal = m.combat.coverPoint(c.x, c.z, th.x, th.z, R.fleeRun, m.nav && m.nav.foot) || null;
      if (!goal) { const dx = c.x - th.x, dz = c.z - th.z, d = Math.hypot(dx, dz) || 1; goal = [c.x + dx / d * R.fleeRun, c.z + dz / d * R.fleeRun]; }
    } else if (sq.busy) return;
    else {
      const t = sq.team, base = m.teams[t].base, o = m.objectives, homes = [{ x: base.x, z: base.z }, ...this.units.units.filter(u => u.type === 'fob' && u.team === t && !u.dead).map(u => u.pos), ...(o ? o.list.filter(l => l.owner === t) : [])];
      let best = null, bd = R.homeRadius; for (const h of homes) { const d = dist(h, c); if (d > 15 && d < bd) { bd = d; best = h; } }
      if (!best) return;
      goal = [best.x, best.z];
    }
    const H = m.world.half - 6; goal[0] = Math.max(-H, Math.min(H, goal[0])); goal[1] = Math.max(-H, Math.min(H, goal[1]));
    if (sq.fleeGoal && dist({ x: sq.fleeGoal[0], z: sq.fleeGoal[1] }, { x: goal[0], z: goal[1] }) < 8 && sq.busy) return;
    sq.fleeGoal = goal; sq.fleeAt = now; sq.order(goal[0], goal[1], undefined, true);
    for (const u of fit) u.advance = false;
  }
}
