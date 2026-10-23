import { RULES } from '../rules.js';

// CPU commander v2: objective-aware manoeuvre, logistics (FOB one hop behind the
// front) and air (helicopter lifts for squads far from the fight).
export class Strategist {
  constructor(team, units, teams, match) { this.team = team; this.units = units; this.teams = teams; this.match = match; this.timer = 1 + Math.random() * 2; this.plan = null; this.lifts = new Map(); }

  enemiesNear(x, z, r) { return this.units.units.filter(u => !u.dead && !u.mounted && u.team !== this.team && !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - x, u.pos.z - z) < r); }
  friendsNear(x, z, r) { return this.units.units.filter(u => !u.dead && !u.mounted && u.team === this.team && Math.hypot(u.pos.x - x, u.pos.z - z) < r); }
  cluster(list) {
    let best = null, bestN = -1;
    for (const e of list) { let n = 0; for (const o of list) if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 20) n++; if (n > bestN) { bestN = n; best = e; } }
    return best ? { x: best.pos.x, z: best.pos.z } : null;
  }
  inZone(x, z, loc, k = 0.6) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * loc.r * k; return [loc.x + Math.cos(a) * d, loc.z + Math.sin(a) * d]; }
  send(sq, x, z, tag) {
    if (sq.busy && sq.tag === tag && sq.goal && Math.hypot(sq.goal[0] - x, sq.goal[1] - z) < 12) return;
    const c = sq.centroid(); if (!sq.busy && Math.hypot(c.x - x, c.z - z) < 10 && sq.tag === tag) return;
    sq.goal = [x, z]; sq.tag = tag; sq.order(x, z);
  }
  toward(from, to, keep, jitter = 6) { const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, k = Math.max(0, d - keep) / d; return [from.x + dx * k + (Math.random() - 0.5) * jitter, from.z + dz * k + (Math.random() - 0.5) * jitter]; }

  tick(dt) {
    this.timer -= dt; if (this.timer > 0) return; this.timer = 4 + Math.random() * 2;
    const obj = this.match.objectives, base = this.teams[this.team].base;
    // drop lifts whose helicopter or squad is gone, so squads return to the pool
    for (const [k, v] of [...this.lifts]) { const heli = k.type === 'heli' ? k : v, sq = k.type === 'heli' ? v.sq : k; if (!heli || heli.dead || !sq || !sq.leader) { this.lifts.delete(k); if (sq) for (const m of sq.members) m.boardTarget = null; } }
    const squads = this.units.squads.filter(s => s.team === this.team && s.leader && !this.lifts.has(s) && !s.members.some(m => m.building));
    const vehicles = this.units.units.filter(u => u.team === this.team && !u.dead && !u.squad && !u.spec.structure);
    if (!obj) return this.skirmish(squads, vehicles, base);
    const attack = obj.nextFor(this.team), front = obj.front(this.team);
    const myFobs = this.units.units.filter(u => u.type === 'fob' && u.team === this.team && !u.dead);
    const threatened = [...obj.list.filter(l => l.owner === this.team), ...myFobs.map(f => ({ x: f.pos.x, z: f.pos.z, r: 18, index: 'fob' + f.id }))].filter(l => this.enemiesNear(l.x, l.z, l.r + 25).length > 0);
    const enemyFob = this.units.units.find(u => u.type === 'fob' && u.team !== this.team && !u.dead && (attack ? Math.hypot(u.pos.x - attack.x, u.pos.z - attack.z) < 160 : true));
    const hold = threatened[0] || front;
    const logisticsSquad = this.logistics(squads, vehicles, front, attack);
    const free = squads.filter(s => s !== logisticsSquad);
    const nAttack = attack ? Math.ceil(free.length * (hold ? 0.65 : 1)) : 0;
    free.forEach((sq, i) => {
      if (enemyFob && i === 0) { this.send(sq, enemyFob.pos.x, enemyFob.pos.z, 'raid'); return; }   // one squad raids the nearest enemy FOB
      if (i < nAttack && attack) {
        const foes = this.enemiesNear(attack.x, attack.z, attack.r + 20);
        if (foes.length > 1 && attack.n[this.team] < 4) { const c = this.cluster(foes), cen = sq.centroid(); const [x, z] = this.toward(cen, c, 20); this.send(sq, x, z, 'approach'); }
        else { const [x, z] = this.inZone(attack.x, attack.z, attack); this.send(sq, x, z, 'cap' + attack.index); }
      } else if (hold) { const [x, z] = this.inZone(hold.x, hold.z, hold, 0.7); this.send(sq, x, z, 'hold' + hold.index); }
      else this.send(sq, base.x + (Math.random() - 0.5) * 20, base.z + (Math.random() - 0.5) * 20, 'home');
    });
    for (const v of vehicles) {
      if (v.type === 'apc') {
        const goal = attack || hold; if (!goal) continue;
        const foes = this.enemiesNear(goal.x, goal.z, goal.r + 40), c = this.cluster(foes);
        let x, z;
        if (c) { const dx = c.x - v.pos.x, dz = c.z - v.pos.z, d = Math.hypot(dx, dz) || 1, k = Math.max(0, d - 34) / d; x = v.pos.x + dx * k; z = v.pos.z + dz * k; }
        else [x, z] = this.inZone(goal.x, goal.z, goal, 0.8);
        if (v.dest && v.goal && Math.hypot(v.goal[0] - x, v.goal[1] - z) < 12) continue;
        v.goal = [x, z]; v.order(x, z);
      } else if (v.type === 'heli') this.air(v, free, attack, base);
      else if (!v.supply && !v.dest && Math.random() < 0.2) v.order(base.x + (Math.random() - 0.5) * 24, base.z + (Math.random() - 0.5) * 24);
    }
  }

  // Logistics: with kits left, a supply truck and an engineer squad, build a FOB one hop
  // behind the front (towards our base) and keep the pair together until it is up.
  logistics(squads, vehicles, front, attack) {
    const fobs = this.match.fobs, team = this.teams[this.team], base = team.base;
    if (this.plan && (this.plan.sq.engineer === null || this.plan.truck.dead || this.plan.done)) this.plan = null;
    if (!this.plan) {
      if (fobs.kitsLeft(this.team) <= 0) return null;
      const anchor = front || (attack ? null : null); if (!anchor) return null;
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
