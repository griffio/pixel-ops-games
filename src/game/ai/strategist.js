// CPU commander v1: objective-aware. Most squads push the next capturable
// location, some hold the front (or any threatened location), APCs escort at
// autocannon range, trucks and helicopters stay home.
export class Strategist {
  constructor(team, units, teams, match) { this.team = team; this.units = units; this.teams = teams; this.match = match; this.timer = 1 + Math.random() * 2; }

  enemiesNear(x, z, r) { return this.units.units.filter(u => !u.dead && u.team !== this.team && !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - x, u.pos.z - z) < r); }
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

  tick(dt) {
    this.timer -= dt; if (this.timer > 0) return; this.timer = 4 + Math.random() * 2;
    const obj = this.match.objectives, base = this.teams[this.team].base;
    const squads = this.units.squads.filter(s => s.team === this.team && s.leader);
    const vehicles = this.units.units.filter(u => u.team === this.team && !u.dead && !u.squad);
    if (!obj) return this.skirmish(squads, vehicles, base);
    const attack = obj.nextFor(this.team), front = obj.front(this.team);
    const threatened = obj.list.filter(l => l.owner === this.team && this.enemiesNear(l.x, l.z, l.r + 25).length > 0);
    const hold = threatened[0] || front;
    const nAttack = attack ? Math.ceil(squads.length * (hold ? 0.65 : 1)) : 0;
    squads.forEach((sq, i) => {
      if (i < nAttack && attack) {
        // approach from outside the zone if it is defended, otherwise walk in and capture
        const foes = this.enemiesNear(attack.x, attack.z, attack.r + 20);
        if (foes.length > 1 && attack.n[this.team] < 4) { const c = this.cluster(foes), cen = sq.centroid(); const dx = c.x - cen.x, dz = c.z - cen.z, d = Math.hypot(dx, dz) || 1, k = Math.max(0, d - 20) / d; this.send(sq, cen.x + dx * k, cen.z + dz * k, 'approach'); }
        else { const [x, z] = this.inZone(attack.x, attack.z, attack); this.send(sq, x, z, 'cap' + attack.index); }
      } else if (hold) { const [x, z] = this.inZone(hold.x, hold.z, hold, 0.7); this.send(sq, x, z, 'hold' + hold.index); }
      else { const [x, z] = [base.x + (Math.random() - 0.5) * 20, base.z + (Math.random() - 0.5) * 20]; this.send(sq, x, z, 'home'); }
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
      } else if (v.type === 'heli') {
        const foes = this.enemiesNear(base.x, base.z, 60);
        if (v.state === 'parked' && foes.length) { const c = this.cluster(foes); v.order((base.x + c.x) / 2, (base.z + c.z) / 2); }
      } else if (!v.dest && Math.random() < 0.2) v.order(base.x + (Math.random() - 0.5) * 24, base.z + (Math.random() - 0.5) * 24);
    }
  }

  // no objectives: hunt the enemy's main cluster (milestone 1 behaviour)
  skirmish(squads, vehicles, base) {
    const target = this.cluster(this.units.units.filter(u => !u.dead && u.team !== this.team && !(u.spec.air && u.alt > 2)));
    squads.forEach((sq, i) => {
      if (i < 2 || !target) { if (!sq.busy) this.send(sq, base.x + (Math.random() - 0.5) * 16, base.z + (Math.random() - 0.5) * 16, 'home'); return; }
      const c = sq.centroid(), dx = target.x - c.x, dz = target.z - c.z, d = Math.hypot(dx, dz) || 1, k = Math.max(0, d - 18) / d;
      this.send(sq, c.x + dx * k, c.z + dz * k, 'hunt');
    });
    for (const v of vehicles) if (v.type === 'apc' && target && !v.dest) { const dx = target.x - v.pos.x, dz = target.z - v.pos.z, d = Math.hypot(dx, dz) || 1, k = Math.max(0, d - 34) / d; v.order(v.pos.x + dx * k, v.pos.z + dz * k); }
  }
}
