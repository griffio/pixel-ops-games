import { RULES } from './rules.js';
import { makeTeams } from './teams.js';
import { NavGrid } from './nav.js';
import { SpatialHash } from './spatial.js';
import { Combat } from './combat.js';
import { Respawn } from './respawn.js';
import { Strategist } from './ai/strategist.js';

// Match flow for milestone 1: Skirmish. Two fixed forces, tickets drain on losses and
// respawns, first to 0 loses; at full time the higher ticket count wins.
export class Match {
  constructor(app, { cpu = [1], length = RULES.matchLength } = {}) {
    this.app = app; this.units = app.units; this.world = app.world;
    this.teams = makeTeams(RULES.startTickets.skirmish);
    this.nav = new NavGrid(); this.nav.build(this.world.obstacles); this.units.nav = this.nav;
    this.spatial = new SpatialHash(8); this.units.spatial = this.spatial;
    this.combat = new Combat(this.units, this.spatial, this.world, app.dust);
    this.respawn = new Respawn(this.units, this.teams, this.world);
    this.feed = [];
    this.combat.onDeath = (v, k) => { this.respawn.onDeath(v, k); this.feed.unshift({ v, k, t: 0 }); this.feed.length = Math.min(this.feed.length, 6); };
    this.strategists = cpu.map(t => new Strategist(t, this.units, this.teams));
    this.time = length; this.state = 'play'; this.winner = null; this.reason = ''; this.acc = 0;
    this.units.auto = false;
    this.deploy();
  }

  deploy() {
    const F = RULES.force, w = this.world;
    for (const team of this.teams) {
      // spread the force: infantry and APCs toward the map centre, trucks and helicopters at the back
      const b = team.base, d = Math.hypot(b.x, b.z) || 1, dx = -b.x / d, dz = -b.z / d, lx = -dz, lz = dx, toward = Math.atan2(dx, dz);
      const at = (fwd, lat) => [b.x + dx * fwd + lx * lat, b.z + dz * fwd + lz * lat];
      const place = (type, fwd, lat, pad, fn) => {
        let [x, z] = at(fwd, lat);
        if (w.isBlocked(x, z, pad)) [x, z] = team.spawnPoint(w, pad);
        return fn(x, z);
      };
      for (let i = 0; i < F.squads; i++) place('squad', 4 + (i % 2) * 5, -12 + Math.floor(i / 2) * 7, 2, (x, z) => {
        const sq = this.units.spawnSquad(x, z, team.id); for (const m of sq.members) { m.heading = toward; m.group.rotation.y = toward; }
      });
      for (let i = 0; i < F.apc; i++) place('apc', 11, -10 + i * 10, 4, (x, z) => this.units.spawn('apc', x, z, toward, team.id));
      for (let i = 0; i < F.truck; i++) place('truck', -4, -8 + i * 8, 4, (x, z) => this.units.spawn('truck', x, z, toward, team.id));
      for (let i = 0; i < F.heli; i++) place('heli', -12, -8 + i * 16, 8, (x, z) => this.units.spawn('heli', x, z, toward, team.id));
    }
  }

  update(dt) {
    if (this.state !== 'play' || dt <= 0) return;
    this.time -= dt;
    this.spatial.rebuild(this.units.units);
    this.acc += dt;
    while (this.acc >= 0.1) { this.acc -= 0.1; this.tick(0.1); }
    for (const f of this.feed) f.t += dt;
    const [a, b] = this.teams;
    if (a.tickets <= 0 || b.tickets <= 0) this.end(a.tickets <= 0 ? (b.tickets <= 0 ? null : b) : a, 'tickets exhausted');
    else if (this.time <= 0) this.end(a.tickets === b.tickets ? null : (a.tickets > b.tickets ? a : b), 'time expired');
  }
  tick(dt) {
    this.combat.tick(dt);
    this.respawn.tick(dt);
    for (const s of this.strategists) s.tick(dt);
  }
  end(winner, reason) { this.state = 'over'; this.winner = winner; this.reason = reason; this.app.hud.showEnd(this); }
}
