// CPU commander v0: find the enemy's main concentration, send squads and APCs to
// engage it from range, keep two squads home, and let helicopters prowl the front.
export class Strategist {
  constructor(team, units, teams) { this.team = team; this.units = units; this.teams = teams; this.timer = 1 + Math.random() * 2; }

  enemyCluster() {
    const enemies = this.units.units.filter(u => !u.dead && u.team !== this.team && !(u.spec.air && u.alt > 2));
    if (!enemies.length) return null;
    let best = null, bestN = -1;
    for (const e of enemies) {
      let n = 0; for (const o of enemies) if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 20) n++;
      if (n > bestN) { bestN = n; best = e; }
    }
    return { x: best.pos.x, z: best.pos.z, n: bestN };
  }

  tick(dt) {
    this.timer -= dt; if (this.timer > 0) return; this.timer = 4 + Math.random() * 2;
    const base = this.teams[this.team].base, target = this.enemyCluster();
    const squads = this.units.squads.filter(s => s.team === this.team && s.leader);
    const vehicles = this.units.units.filter(u => u.team === this.team && !u.dead && !u.squad);
    const toward = (from, to, keep) => {   // point `keep` units short of `to`, with jitter
      const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, k = Math.max(0, d - keep) / d;
      return [from.x + dx * k + (Math.random() - 0.5) * 6, from.z + dz * k + (Math.random() - 0.5) * 6];
    };
    squads.forEach((sq, i) => {
      const c = sq.centroid();
      if (i < 2 || !target) {                       // home guard
        if (Math.hypot(c.x - base.x, c.z - base.z) > 14 && !sq.busy) sq.order(base.x + (Math.random() - 0.5) * 16, base.z + (Math.random() - 0.5) * 16);
        return;
      }
      if (sq.busy && sq.lastTarget && Math.hypot(sq.lastTarget[0] - target.x, sq.lastTarget[1] - target.z) < 12) return;
      const dest = toward(c, target, 18); sq.lastTarget = [target.x, target.z]; sq.order(dest[0], dest[1]);
    });
    for (const v of vehicles) {
      if (v.type === 'apc') {
        if (!target) continue;
        if (v.dest && v.lastTarget && Math.hypot(v.lastTarget[0] - target.x, v.lastTarget[1] - target.z) < 12) continue;
        const dest = toward(v.pos, target, 34); v.lastTarget   // autocannon outranges infantry AT = [target.x, target.z]; v.order(dest[0], dest[1]);
      } else if (v.type === 'heli') {
        // transports stay home in milestone 1; they only lift to cover the base when the fight comes close
        if (v.state !== 'parked' || !target || Math.hypot(target.x - base.x, target.z - base.z) > 45) continue;
        const dest = toward(v.pos, target, 22); v.order(dest[0], dest[1]);
      } else if (!v.dest && Math.random() < 0.3) {   // trucks shuffle around the base
        v.order(base.x + (Math.random() - 0.5) * 20, base.z + (Math.random() - 0.5) * 20);
      }
    }
  }
}
