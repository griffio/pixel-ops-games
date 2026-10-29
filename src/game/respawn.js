import { RULES } from './rules.js';

// Death bookkeeping and respawns. Vehicle losses are charged at death; infantry
// respawns are charged when the soldier comes back. Doctrines scale the timers;
// Air Assault may put infantry down beside an idle friendly helicopter, Light Infantry beside a parked truck.
export class Respawn {
  constructor(units, teams, world) { this.units = units; this.teams = teams; this.world = world; this.queue = []; this.clock = 0; this.rallies = null; this.landing = null; }
  sea(team) { return this.landing && this.landing.team === team.id ? this.landing : null; }   // the landing craft, for a side based on a ship

  cost(u) { return u.supply ? RULES.ticketCost.supply : (RULES.ticketCost[u.type] || 0); }   // fob: 40; caches are charged by the mode
  timer(u) { const t = this.teams[u.team], d = t.doctrine || {}; return RULES.respawnTime[u.type] * (u.type === 'soldier' ? (d.infantryRespawn || 1) : (d.vehicleRespawn || 1)) * (u.type === 'heli' ? d.heliRespawn || 1 : 1) * (t.respawnMul || 1); }

  onDeath(victim, killer) {
    const team = this.teams[victim.team]; team.losses++;
    if (killer) this.teams[killer.team].kills++;
    if (victim.type !== 'soldier') team.tickets -= this.cost(victim);
    if (victim.spec.structure || victim.spec.naval) return;              // FOBs are not rebuilt by the queue; landing craft are replaced by their own (landing.js)
    this.queue.push({ unit: victim, t: this.timer(victim), died: this.clock });
  }
  cancel(unit) { const i = this.queue.findIndex(q => q.unit === unit); if (i >= 0) this.queue.splice(i, 1); }

  // The squad's rally, when it is the spawn this soldier would use: the squad has no one left standing, or the rally is
  // nearer the squad than main, any FOB or any doctrine spawn. Forcing main or a helicopter or truck spawn skips it, and so
  // does enemy armour within RULES.rally.armourRadius of it (the men would come back under its gun).
  rallyFor(u, team) {
    if (u.type !== 'soldier' || !u.squad || !this.rallies || team.spawnPref === 'base' || team.spawnPref === 'heli' || team.spawnPref === 'truck') return null;
    const r = this.rallies.of(u.squad); if (!r || this.rallies.covered(r)) return null;
    const live = u.squad.members.filter(m => !m.dead && m !== u && !m.mounted); if (!live.length) return r;
    const x = live.reduce((s, m) => s + m.pos.x, 0) / live.length, z = live.reduce((s, m) => s + m.pos.z, 0) / live.length, dr = Math.hypot(r.pos.x - x, r.pos.z - z);
    if (Math.hypot(team.base.x - x, team.base.z - z) < dr) return null;
    for (const f of this.units.units) if (f.type === 'fob' && !f.dead && f.team === team.id && Math.hypot(f.pos.x - x, f.pos.z - z) < dr) return null;
    for (const v of this.carriers(team)) if (Math.hypot(v.pos.x - x, v.pos.z - z) < dr) return null;
    return r;
  }
  // Doctrine spawns: an idle (parked) helicopter under Air Assault, a parked troop truck under Light Infantry; never one
  // with an enemy within 30 m. Worked out once per tick per team: every queued soldier asks.
  carriers(team) {
    if (this.carriersAt !== this.clock) { this.carriersAt = this.clock; this.carrierCache = []; }
    const hit = this.carrierCache[team.id]; if (hit) return hit;
    const d = team.doctrine || {}, U = this.units.units;
    const list = U.filter(v => v.team === team.id && !v.dead && (v.type === 'heli' ? d.heliSpawn && v.state === 'parked' : v.type === 'truck' && d.truckSpawn && !v.supply && Math.abs(v.speed) < 0.3 && !v.dest)
      && !U.some(e => e.team !== team.id && !e.dead && !e.mounted && !e.spec.structure && Math.hypot(e.pos.x - v.pos.x, e.pos.z - v.pos.z) < 30)
      && !(v.type === 'heli' && this.sea(team) && this.sea(team).atShip(v.pos.x, v.pos.z)));   // not one on a ship's flight deck: men there would be stranded
    return (this.carrierCache[team.id] = list);
  }
  beside(v) { const [x, z] = v.exitPoints(1 + Math.floor(Math.random() * (v.spec.air ? 8 : 6))).pop(); return [x, z]; }   // round the airframe, or behind the tailgate
  atRally(r) {
    for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, k = 1 + Math.random() * 3, x = r.pos.x + Math.cos(a) * k, z = r.pos.z + Math.sin(a) * k; if (!this.world.isBlocked(x, z, 0.6)) return [x, z]; }
    return [r.pos.x, r.pos.z];
  }

  // Infantry come back at the spawn point nearest their squad (main base, any live FOB,
  // or beside an idle helicopter under Air Assault, a parked truck under Light Infantry); vehicles always at main.
  // Forcing the helicopter or truck spawn takes the one nearest the squad.
  spawnPoint(u, team) {
    if (u.type !== 'soldier') return team.spawnPoint(this.world, u.spec.air ? 7 : 4);
    const base = team.spawnPoint(this.world, 1);
    const live = u.squad ? u.squad.members.filter(m => !m.dead && m !== u) : [];
    // the squad is where its living members are; a squad wiped out is where this soldier fell
    const ref = live.length ? { x: live.reduce((s, m) => s + m.pos.x, 0) / live.length, z: live.reduce((s, m) => s + m.pos.z, 0) / live.length } : { x: u.pos.x, z: u.pos.z };
    const near = (x, z, r) => { const a = Math.random() * Math.PI * 2, k = Math.random() * r; return [x + Math.cos(a) * k, z + Math.sin(a) * k]; };
    const carriers = this.carriers(team), pref = team.spawnPref;
    if (pref === 'heli' || pref === 'truck') {
      const v = carriers.filter(c => c.type === pref).sort((a, b) => Math.hypot(a.pos.x - ref.x, a.pos.z - ref.z) - Math.hypot(b.pos.x - ref.x, b.pos.z - ref.z))[0];
      if (v) return this.beside(v);
    }
    if (pref === 'base') return base;
    let best = base, bd = Math.hypot(base[0] - ref.x, base[1] - ref.z);
    for (const f of this.units.units) {
      if (f.type !== 'fob' || f.dead || f.team !== team.id) continue;
      const dd = Math.hypot(f.pos.x - ref.x, f.pos.z - ref.z); if (dd < bd) { bd = dd; best = near(f.pos.x, f.pos.z, 8); }
    }
    for (const v of carriers) { const dd = Math.hypot(v.pos.x - ref.x, v.pos.z - ref.z); if (dd < bd) { bd = dd; best = this.beside(v); } }
    return best;
  }

  tick(dt) {
    this.clock += dt;
    for (const q of this.queue) q.t -= dt;
    // squad waves: a soldier whose timer is up pulls squadmates who died up to waveSlack seconds later along
    for (const q of this.queue) if (q.t <= 0 && q.unit.type === 'soldier' && q.unit.squad) for (const o of this.queue) if (o !== q && o.unit.squad === q.unit.squad && o.t > 0 && o.t <= RULES.waveSlack) o.t = 0;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i], u = q.unit, team = this.teams[u.team];
      // a soldier whose spawn is the squad's rally ignores his own timer and comes back on the rally's wave, if he has been down long enough
      const rally = this.rallyFor(u, team);
      if (rally ? !(rally.waveNow && this.clock - q.died >= RULES.rally.cutoff) : q.t > 0) continue;
      if (u.type === 'soldier') {
        // a doctrine may make men cheaper (Light Infantry: half a ticket); the fraction carries over, so every second man is free
        const cost = RULES.ticketCost.soldier * ((team.doctrine && team.doctrine.respawnCost) ?? 1), due = Math.floor((team.respawnDebt || 0) + cost + 1e-9);
        if (team.tickets < due) continue;            // can't afford it yet
        team.respawnDebt = (team.respawnDebt || 0) + cost - due; team.tickets -= due;
        const [x, z] = rally ? this.atRally(rally) : this.spawnPoint(u, team);
        u.revive(x, z, Math.random() * Math.PI * 2);
        const L = u.squad && u.squad.members.find(m => !m.dead && m !== u && !m.afloat);
        if (this.sea(team) && this.sea(team).atShip(x, z)) this.sea(team).embark(u);   // back on the ship: into the well dock for a landing craft
        else if (L) u.order(L.pos.x + (Math.random() - 0.5) * 3, L.pos.z + (Math.random() - 0.5) * 3);   // rejoin the squad
      } else {
        const S = this.sea(team), [x, z] = S && u.spec.air ? S.deckSpot() : this.spawnPoint(u, team);   // a ship's helicopters on its flight deck
        const n = this.units.spawn(u.type, x, z, Math.random() * Math.PI * 2, u.team, { supply: u.supply }); n.label = u.label;
        if (S && !n.spec.air) S.embark(n);
      }
      this.queue.splice(i, 1);
    }
  }
}
