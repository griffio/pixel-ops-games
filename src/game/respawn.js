import { RULES } from './rules.js';

// Death bookkeeping and respawns at the team's main base. Vehicle losses are
// charged at death; infantry respawns are charged when the soldier comes back.
export class Respawn {
  constructor(units, teams, world) { this.units = units; this.teams = teams; this.world = world; this.queue = []; }

  onDeath(victim, killer) {
    const team = this.teams[victim.team]; team.losses++;
    if (killer) this.teams[killer.team].kills++;
    if (victim.type !== 'soldier') team.tickets -= RULES.ticketCost[victim.type];
    this.queue.push({ unit: victim, t: RULES.respawnTime[victim.type] });
  }

  tick(dt) {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i]; q.t -= dt; if (q.t > 0) continue;
      const u = q.unit, team = this.teams[u.team];
      if (u.type === 'soldier') {
        if (team.tickets < RULES.ticketCost.soldier) continue;            // can't afford it yet
        team.tickets -= RULES.ticketCost.soldier;
        const [x, z] = team.spawnPoint(this.world, 1);
        u.revive(x, z, Math.random() * Math.PI * 2);
        const L = u.squad && u.squad.members.find(m => !m.dead && m !== u);
        if (L) u.order(L.pos.x + (Math.random() - 0.5) * 3, L.pos.z + (Math.random() - 0.5) * 3);   // rejoin the squad
      } else {
        const [x, z] = team.spawnPoint(this.world, u.spec.air ? 7 : 4);
        const n = this.units.spawn(u.type, x, z, Math.random() * Math.PI * 2, u.team); n.label = u.label;
      }
      this.queue.splice(i, 1);
    }
  }
}
