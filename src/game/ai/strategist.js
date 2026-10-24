import { RULES } from '../rules.js';

// CPU commander v2: objective-aware manoeuvre, logistics (FOB one hop behind the
// front) and air (helicopter lifts for squads far from the fight).
export class Strategist {
  constructor(team, units, teams, match) { this.team = team; this.units = units; this.teams = teams; this.match = match; this.timer = 1 + Math.random() * 2; this.reflex = 0.5; this.plan = null; this.lifts = new Map(); this.diff = match.difficulty || { plan: 5, attackShare: 0, logistics: true }; }

  enemiesNear(x, z, r) { return this.units.units.filter(u => !u.dead && !u.mounted && u.team !== this.team && !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - x, u.pos.z - z) < r); }
  friendsNear(x, z, r) { return this.units.units.filter(u => !u.dead && !u.mounted && u.team === this.team && Math.hypot(u.pos.x - x, u.pos.z - z) < r); }
  cluster(list) {
    let best = null, bestN = -1;
    for (const e of list) { let n = 0; for (const o of list) if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 20) n++; if (n > bestN) { bestN = n; best = e; } }
    return best ? { x: best.pos.x, z: best.pos.z } : null;
  }
  inZone(x, z, loc, k = 0.6) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * loc.r * k; return [loc.x + Math.cos(a) * d, loc.z + Math.sin(a) * d]; }
  send(sq, x, z, tag, zone = null) {
    if (sq.busy && sq.tag === tag && sq.goal && Math.hypot(sq.goal[0] - x, sq.goal[1] - z) < 12) return;
    const c = sq.centroid(); if (!sq.busy && Math.hypot(c.x - x, c.z - z) < 10 && sq.tag === tag) return;
    sq.goal = [x, z]; sq.tag = tag; sq.zone = zone; sq.order(x, z);
  }
  toward(from, to, keep, jitter = 6) { const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, k = Math.max(0, d - keep) / d; return [from.x + dx * k + (Math.random() - 0.5) * jitter, from.z + dz * k + (Math.random() - 0.5) * jitter]; }

  tick(dt) {
    if ((this.reflex -= dt) <= 0) { this.reflex = 1; this.caution(); }
    this.timer -= dt; if (this.timer > 0) return; this.timer = this.diff.plan + Math.random() * 2;
    const base = this.teams[this.team].base;
    // drop lifts whose helicopter or squad is gone, so squads return to the pool
    for (const [k, v] of [...this.lifts]) { const heli = k.type === 'heli' ? k : v, sq = k.type === 'heli' ? v.sq : k; if (!heli || heli.dead || !sq || !sq.leader) { this.lifts.delete(k); if (sq) for (const m of sq.members) m.boardTarget = null; } }
    const squads = this.units.squads.filter(s => s.team === this.team && s.leader && !this.lifts.has(s) && !s.members.some(m => m.building));
    const vehicles = this.units.units.filter(u => u.team === this.team && !u.dead && !u.squad && !u.spec.structure);
    const myFobs = this.units.units.filter(u => u.type === 'fob' && u.team === this.team && !u.dead).map(f => ({ x: f.pos.x, z: f.pos.z, r: 18, index: 'fob' + f.id }));
    const g = this.match.mode.goals(this.team, myFobs);
    if (g.hunt) return this.skirmish(squads, vehicles, base);
    const attack = g.attack, hold = g.hold, reserve = g.reserve || null;
    const enemyFob = this.units.units.find(u => u.type === 'fob' && u.team !== this.team && !u.dead && (attack ? Math.hypot(u.pos.x - attack.x, u.pos.z - attack.z) < 160 : true));
    const logisticsSquad = this.logistics(squads, vehicles, g.fobAnchor);
    const free = squads.filter(s => s !== logisticsSquad);
    const share = Math.min(0.95, Math.max(0.2, g.attackShare + this.diff.attackShare));
    const nAttack = attack ? Math.ceil(free.length * share) : 0;
    free.forEach((sq, i) => {
      if (enemyFob && i === 0 && attack) { this.send(sq, enemyFob.pos.x, enemyFob.pos.z, 'raid'); return; }   // one squad raids the nearest enemy FOB
      if (i < nAttack && attack) {
        const foes = this.enemiesNear(attack.x, attack.z, attack.r + 20);
        if (foes.length > 1 && (attack.n ? attack.n[this.team] : 0) < 4) { const c = this.cluster(foes), cen = sq.centroid(); const [x, z] = this.toward(cen, c, 35); this.send(sq, x, z, 'approach', attack); }   // stand off and shoot rather than walk into them
        else { const [x, z] = this.inZone(attack.x, attack.z, attack); this.send(sq, x, z, 'cap' + attack.index, attack); }
      } else if (reserve && hold && i >= nAttack + Math.ceil((free.length - nAttack) * 0.7)) { const [x, z] = this.inZone(reserve.x, reserve.z, reserve, 0.6); this.send(sq, x, z, 'reserve' + reserve.index, reserve); }
      else if (hold) { const [x, z] = this.inZone(hold.x, hold.z, hold, 0.7); this.send(sq, x, z, 'hold' + hold.index, hold); }
      else this.send(sq, base.x + (Math.random() - 0.5) * 20, base.z + (Math.random() - 0.5) * 20, 'home');
    });
    for (const v of vehicles) {
      if (v.type === 'apc') {
        const goal = attack || hold; if (!goal) continue;
        const foes = this.enemiesNear(goal.x, goal.z, goal.r + 40), c = this.cluster(foes);
        let x, z;
        // close to a 70 m standoff from the enemy cluster: outside rocket reach, well inside the cannon's; nearer than
        // that the turret does the work from where it stands, and caution() backs it off when something gets close
        if (c) { const dx = c.x - v.pos.x, dz = c.z - v.pos.z, d = Math.hypot(dx, dz) || 1; if (d < 85) continue; const k = (d - 70) / d; x = v.pos.x + dx * k; z = v.pos.z + dz * k; }
        else [x, z] = this.inZone(goal.x, goal.z, goal, 0.8);
        if (v.dest && v.goal && Math.hypot(v.goal[0] - x, v.goal[1] - z) < 12) continue;
        v.goal = [x, z]; v.order(x, z);
      } else if (v.type === 'heli') this.air(v, free, attack, base);
      else if (!v.supply && !v.dest && Math.random() < 0.2) v.order(base.x + (Math.random() - 0.5) * 24, base.z + (Math.random() - 0.5) * 24);
    }
  }

  // Caution, once a second: a squad with an enemy inside 22 m falls back out of the fight unless it stands in the
  // zone it was sent to take or hold, or clearly has the numbers; an APC with an enemy inside 50 m backs off to 70 m.
  caution() {
    const enemies = this.units.units.filter(u => !u.dead && !u.mounted && u.team !== this.team && !u.spec.structure && !(u.spec.air && u.alt > 2));
    if (!enemies.length) return;
    const nearest = (x, z) => { let b = null, bd = Infinity; for (const e of enemies) { const d = Math.hypot(e.pos.x - x, e.pos.z - z); if (d < bd) { bd = d; b = e; } } return [b, bd]; };
    const away = (x, z, e, dist) => { const dx = x - e.pos.x, dz = z - e.pos.z, d = Math.hypot(dx, dz) || 1; return [x + dx / d * dist, z + dz / d * dist]; };
    for (const sq of this.units.squads) {
      if (sq.team !== this.team || !sq.leader || sq.mounted || this.lifts.has(sq) || sq.members.some(m => m.building)) continue;
      const c = sq.centroid(), [e, d] = nearest(c.x, c.z); if (!e || d > 22) continue;
      if (sq.zone && Math.hypot(c.x - sq.zone.x, c.z - sq.zone.z) < sq.zone.r) continue;                     // stand and fight for the zone
      if (this.friendsNear(c.x, c.z, 25).length >= this.enemiesNear(c.x, c.z, 25).length * 2) continue;    // we clearly have the numbers
      const [x, z] = away(c.x, c.z, e, 28); sq.goal = [x, z]; sq.tag = 'back'; sq.order(x, z);
    }
    for (const v of this.units.units) {
      if (v.team !== this.team || v.dead || v.type !== 'apc') continue;
      const [e, d] = nearest(v.pos.x, v.pos.z); if (!e || d > 50) continue;
      const [x, z] = away(v.pos.x, v.pos.z, e, 70 - d); v.goal = [x, z]; v.order(x, z);
    }
  }

  // Logistics: with kits left, a supply truck and an engineer squad, build a FOB one hop
  // behind the front (towards our base) and keep the pair together until it is up.
  logistics(squads, vehicles, anchor) {
    const fobs = this.match.fobs, team = this.teams[this.team], base = team.base;
    if (this.plan && (this.plan.sq.engineer === null || this.plan.truck.dead || this.plan.done)) this.plan = null;
    if (!this.plan) {
      if (!this.diff.logistics || fobs.kitsLeft(this.team) <= 0) return null;
      if (!anchor) return null;
      const truck = vehicles.filter(v => v.supply && v.supplies >= RULES.fob.supplyCost).sort((a, b) => Math.hypot(a.pos.x - anchor.x, a.pos.z - anchor.z) - Math.hypot(b.pos.x - anchor.x, b.pos.z - anchor.z))[0];
      const sq = squads.find(s => s.engineer); if (!truck || !sq) return null;
      const [x, z] = this.toward(anchor, base, Math.hypot(anchor.x - base.x, anchor.z - base.z) - 45, 0);   // 45 m behind the location, towards home
      if (this.units.nav.vehicle.blocked(x, z) || fobs.active(this.team).some(f => Math.hypot(f.pos.x - x, f.pos.z - z) < RULES.fob.minSpacing)) return null;
      this.plan = { sq, truck, x, z, t: 0 };
    }
    const p = this.plan; p.t += 5;
    if (p.t > 240) { this.plan = null; return null; }                                   // give up on stalled plans
    const eng = p.sq.engineer, near = (u, r) => Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r;
    if (!near(p.truck, 8) && !p.truck.dest) p.truck.order(p.x + 4, p.z + 4);
    if (!near(eng, 4) && !p.sq.busy) this.send(p.sq, p.x, p.z, 'fob');
    if (near(eng, 4) && near(p.truck, RULES.fob.buildRange) && !eng.building) { const r = fobs.startBuild(eng); if (r.ok) p.done = true; }
    return p.sq;
  }

  // Air: a parked helicopter at base lifts a squad that gathers beside it when the
  // objective is far, lands it short of the objective on our side, and flies home.
  air(heli, squads, attack, base) {
    const lift = this.lifts.get(heli);
    if (lift) {
      const sq = lift.sq;
      if (!sq.leader || heli.dead) { this.lifts.delete(heli); this.lifts.delete(sq); return; }
      if (lift.stage === 'board') {
        if (sq.mounted) { heli.dropOnLand = true; heli.order(lift.lz[0], lift.lz[1]); lift.stage = 'fly'; }
        else if ((lift.t += 5) > 90) { this.lifts.delete(heli); this.lifts.delete(sq); for (const m of sq.members) m.boardTarget = null; if (heli.passengers.length) heli.unload(); }
      } else if (lift.stage === 'fly') {
        if (heli.state === 'parked' && !heli.passengers.length) { lift.stage = 'return'; sq.goal = null; this.lifts.delete(sq); heli.dropOnLand = true; heli.order(base.x + (Math.random() - 0.5) * 16, base.z + (Math.random() - 0.5) * 16); }
      } else if (heli.state === 'parked') this.lifts.delete(heli);
      return;
    }
    if (!attack || heli.state !== 'parked' || Math.hypot(heli.pos.x - base.x, heli.pos.z - base.z) > 50) return;
    if (this.lifts.size > 0) return;                                                     // one lift at a time: no piecemeal drops
    const far = Math.hypot(attack.x - base.x, attack.z - base.z);
    if (far < 350) return;
    const sq = squads.find(s => { const c = s.centroid(); return !s.mounted && Math.hypot(c.x - heli.pos.x, c.z - heli.pos.z) < 40 && Math.hypot(c.x - attack.x, c.z - attack.z) > 250 && !this.lifts.has(s); });
    if (!sq) return;
    let [lx, lz] = this.toward(attack, base, 70, 0);
    for (let k = 0; k < 3 && this.enemiesNear(lx, lz, 80).length; k++) [lx, lz] = this.toward({ x: lx, z: lz }, base, 50, 0);
    if (this.units.nav.vehicle.blocked(lx, lz) || this.enemiesNear(lx, lz, 80).length) return;   // only into a quiet landing zone
    sq.board(heli); sq.tag = 'lift'; this.lifts.set(heli, { sq, lz: [lx, lz], stage: 'board', t: 0 }); this.lifts.set(sq, heli);
  }

  // no objectives: hunt the enemy's main cluster (milestone 1 behaviour)
  skirmish(squads, vehicles, base) {
    const target = this.cluster(this.units.units.filter(u => !u.dead && !u.mounted && u.team !== this.team && !(u.spec.air && u.alt > 2)));
    squads.forEach((sq, i) => {
      if (i < 2 || !target) { if (!sq.busy) this.send(sq, base.x + (Math.random() - 0.5) * 16, base.z + (Math.random() - 0.5) * 16, 'home'); return; }
      const c = sq.centroid(), [x, z] = this.toward(c, target, 18); this.send(sq, x, z, 'hunt');
    });
    for (const v of vehicles) if (v.type === 'apc' && target && !v.dest) { const [x, z] = this.toward(v.pos, target, 34); v.order(x, z); }
  }
}
