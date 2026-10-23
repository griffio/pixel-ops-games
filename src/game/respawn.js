import { RULES } from './rules.js';

// Death bookkeeping and respawns. Vehicle losses are charged at death; infantry
// respawns are charged when the soldier comes back. Doctrines scale the timers;
// Air Assault may put infantry down beside an idle friendly helicopter.
export class Respawn {
  constructor(units, teams, world) { this.units = units; this.teams = teams; this.world = world; this.queue = []; }

  cost(u) { return u.supply ? RULES.ticketCost.supply : (RULES.ticketCost[u.type] || 0); }   // fob: 20; caches are charged by the mode
  timer(u) { const d = this.teams[u.team].doctrine || {}; return RULES.respawnTime[u.type] * (u.type === 'soldier' ? (d.infantryRespawn || 1) : (d.vehicleRespawn || 1)); }

  onDeath(victim, killer) {
    const team = this.teams[victim.team]; team.losses++;
    if (killer) this.teams[killer.team].kills++;
    if (victim.type !== 'soldier') team.tickets -= this.cost(victim);
    if (victim.spec.structure) return;                                    // FOBs are not rebuilt by the queue
    this.queue.push({ unit: victim, t: this.timer(victim) });
  }
  cancel(unit) { const i = this.queue.findIndex(q => q.unit === unit); if (i >= 0) this.queue.splice(i, 1); }

  // Infantry come back at the spawn point nearest their squad (main base, any live FOB,
  // or beside an idle helicopter under Air Assault); vehicles always at main.
  spawnPoint(u, team) {
    const d = team.doctrine || {};
    if (u.type !== 'soldier') return team.spawnPoint(this.world, u.spec.air ? 7 : 4);
    const base = team.spawnPoint(this.world, 1);
    const live = u.squad ? u.squad.members.filter(m => !m.dead && m !== u) : [];
    const ref = live.length ? { x: live.reduce((s, m) => s + m.pos.x, 0) / live.length, z: live.reduce((s, m) => s + m.pos.z, 0) / live.length } : null;
    const near = (x, z, r) => { const a = Math.random() * Math.PI * 2, k = Math.random() * r; return [x + Math.cos(a) * k, z + Math.sin(a) * k]; };
    if (team.spawnPref === 'heli' && d.heliSpawn) {
      const heli = this.units.units.find(h => h.type === 'heli' && h.team === team.id && !h.dead && h.state === 'parked');
      if (heli) return [heli.pos.x + (Math.random() - 0.5) * 8, heli.pos.z - 4 - Math.random() * 4];
    }
    if (team.spawnPref === 'base' || !ref) return base;
    let best = base, bd = Math.hypot(base[0] - ref.x, base[1] - ref.z);
    for (const f of this.units.units) {
      if (f.type !== 'fob' || f.dead || f.team !== team.id) continue;
      const dd = Math.hypot(f.pos.x - ref.x, f.pos.z - ref.z); if (dd < bd) { bd = dd; best = near(f.pos.x, f.pos.z, 8); }
    }
    return best;
  }

  tick(dt) {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i]; q.t -= dt; if (q.t > 0) continue;
      const u = q.unit, team = this.teams[u.team];
      if (u.type === 'soldier') {
        if (team.tickets < RULES.ticketCost.soldier) continue;            // can't afford it yet
        team.tickets -= RULES.ticketCost.soldier;
        const [x, z] = this.spawnPoint(u, team);
        u.revive(x, z, Math.random() * Math.PI * 2);
        const L = u.squad && u.squad.members.find(m => !m.dead && m !== u);
        if (L) u.order(L.pos.x + (Math.random() - 0.5) * 3, L.pos.z + (Math.random() - 0.5) * 3);   // rejoin the squad
      } else {
        const [x, z] = this.spawnPoint(u, team);
        const n = this.units.spawn(u.type, x, z, Math.random() * Math.PI * 2, u.team, { supply: u.supply }); n.label = u.label;
      }
      this.queue.splice(i, 1);
    }
  }
}
