import { RULES } from './rules.js';
import { makeTeams } from './teams.js';
import { NavGrid } from './nav.js';
import { SpatialHash } from './spatial.js';
import { Combat } from './combat.js';
import { Respawn } from './respawn.js';
import { Objectives } from './objectives.js';
import { Strategist } from './ai/strategist.js';

// Match flow. Advance and Secure when the map has locations (capture in lattice
// order, majority bleed, capturing everything wins outright); Skirmish otherwise.
// Tickets drain on losses and respawns; at 0 the team loses; at full time the
// higher ticket count wins.
export class Match {
  constructor(app, { cpu = [1], length = RULES.matchLength, mode } = {}) {
    this.app = app; this.units = app.units; this.world = app.world;
    const map = this.world.map;
    this.mode = mode || (map && map.locations && map.locations.length ? 'aas' : 'skirmish');
    this.teams = makeTeams(RULES.startTickets[this.mode], map && map.bases);
    this.nav = { foot: new NavGrid(this.world.size, 1, 0.6), vehicle: new NavGrid(this.world.size, 2, 2.2) };
    this.nav.foot.build(this.world.obstacles, this.world.terrain, 0.9, this.world.onBridge); this.nav.vehicle.build(this.world.obstacles, this.world.terrain, 0.45, this.world.onBridge); this.units.nav = this.nav;
    this.spatial = new SpatialHash(8); this.units.spatial = this.spatial;
    this.combat = new Combat(this.units, this.spatial, this.world, app.dust);
    this.respawn = new Respawn(this.units, this.teams, this.world);
    this.feed = []; this.events = [];
    this.combat.onDeath = (v, k) => { this.respawn.onDeath(v, k); this.feed.unshift({ v, k, t: 0 }); this.feed.length = Math.min(this.feed.length, 6); };
    this.objectives = this.mode === 'aas' ? new Objectives(map.locations, this.teams) : null;
    if (this.objectives) this.objectives.onEvent = (type, loc, team) => {
      if (type === 'lost') this.teams[team].tickets -= RULES.ticketCost.location;
      this.events.unshift({ type, loc, team, t: 0 }); this.events.length = Math.min(this.events.length, 4);
    };
    this.strategists = cpu.map(t => new Strategist(t, this.units, this.teams, this));
    this.time = length; this.state = 'play'; this.winner = null; this.reason = ''; this.acc = 0; this.bleedAcc = 0;
    this.units.auto = false;
    this.deploy();
  }

  deploy() {
    const F = RULES.force, w = this.world;
    for (const team of this.teams) {
      const b = team.base, d = Math.hypot(b.x, b.z) || 1, dx = -b.x / d, dz = -b.z / d, lx = -dz, lz = dx, toward = Math.atan2(dx, dz);
      const at = (fwd, lat) => [b.x + dx * fwd + lx * lat, b.z + dz * fwd + lz * lat];
      const place = (fwd, lat, pad, fn) => { let [x, z] = at(fwd, lat); if (w.isBlocked(x, z, pad)) [x, z] = team.spawnPoint(w, pad); return fn(x, z); };
      for (let i = 0; i < F.squads; i++) place(4 + (i % 2) * 5, -12 + Math.floor(i / 2) * 7, 2, (x, z) => {
        const sq = this.units.spawnSquad(x, z, team.id); for (const m of sq.members) { m.heading = toward; m.group.rotation.y = toward; }
      });
      for (let i = 0; i < F.apc; i++) place(11, -10 + i * 10, 4, (x, z) => this.units.spawn('apc', x, z, toward, team.id));
      for (let i = 0; i < F.truck; i++) place(-4, -8 + i * 8, 4, (x, z) => this.units.spawn('truck', x, z, toward, team.id));
      for (let i = 0; i < F.heli; i++) place(-12, -8 + i * 16, 8, (x, z) => this.units.spawn('heli', x, z, toward, team.id));
    }
  }

  update(dt) {
    if (this.state !== 'play' || dt <= 0) return;
    this.time -= dt;
    this.spatial.rebuild(this.units.units);
    this.acc += dt;
    while (this.acc >= 0.1) { this.acc -= 0.1; this.tick(0.1); }
    for (const f of this.feed) f.t += dt;
    for (const e of this.events) e.t += dt;
    const [a, b] = this.teams;
    if (this.objectives) {
      if (this.objectives.allOwned(0)) return this.end(a, 'captured every location');
      if (this.objectives.allOwned(1)) return this.end(b, 'captured every location');
    }
    if (a.tickets <= 0 || b.tickets <= 0) this.end(a.tickets <= 0 ? (b.tickets <= 0 ? null : b) : a, 'tickets exhausted');
    else if (this.time <= 0) this.end(a.tickets === b.tickets ? null : (a.tickets > b.tickets ? a : b), 'time expired');
  }
  tick(dt) {
    this.combat.tick(dt);
    this.respawn.tick(dt);
    if (this.objectives) {
      this.objectives.tick(dt, this.spatial);
      const o0 = this.objectives.owned(0), o1 = this.objectives.owned(1);
      if (o0 !== o1) { this.bleedAcc += dt; while (this.bleedAcc >= RULES.bleedEvery) { this.bleedAcc -= RULES.bleedEvery; this.teams[o0 > o1 ? 1 : 0].tickets -= 1; } }
    }
    for (const s of this.strategists) s.tick(dt);
  }
  end(winner, reason) { this.state = 'over'; this.winner = winner; this.reason = reason; this.app.hud.showEnd(this); }
}
