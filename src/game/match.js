import { RULES } from './rules.js';
import { makeTeams } from './teams.js';
import { NavGrid } from './nav.js';
import { SpatialHash } from './spatial.js';
import { Combat } from './combat.js';
import { Respawn } from './respawn.js';
import { Support } from './support.js';
import { Fobs } from './fob.js';
import { Strategist } from './ai/strategist.js';
import { RemoteCommander } from './ai/remote.js';
import { DOCTRINES, PRESETS, expand, preset } from './loadout.js';
import { createMode } from './modes/index.js';
import { difficulty } from './difficulty.js';

// Match flow. The mode object owns objectives and win conditions; the match owns
// teams, tickets, the simulation systems and the clock. Each team deploys the force
// in its loadout; doctrines shape respawns and spawns.
export class Match {
  constructor(app, { cpu = [1], mode = 'aas', side = 'attack', loadouts = [preset('balanced'), preset('balanced')], difficulty: diffKey = 'normal' } = {}) {
    this.app = app; this.units = app.units; this.world = app.world;
    const map = this.world.map;
    if (!(map && map.locations && map.locations.length)) mode = 'skirmish';
    this.mode = createMode(mode, this, { side });
    this.difficulty = difficulty(diffKey); this.cpu = cpu;
    this.teams = makeTeams(400, map && map.bases);
    this.mode.teams = this.teams;
    this.teams.forEach((t, i) => {
      t.tickets = this.mode.tickets(i);
      t.loadout = loadouts[i]; t.doctrine = DOCTRINES[t.loadout.doctrine] || DOCTRINES.entrenched;
      const p = Object.entries(PRESETS).find(([k, v]) => v.doctrine === t.loadout.doctrine && JSON.stringify(v.items) === JSON.stringify(t.loadout.items));
      t.loadoutName = p ? p[1].name : 'Custom'; t.fobKits = (t.loadout.items && t.loadout.items.fob) || 0;
      t.stats = { kills: {}, losses: {}, captures: 0, lost: 0, fobs: 0, fobsLost: 0, caches: 0 };
      if (cpu.includes(i)) { const d = this.difficulty; t.acc = d.acc; t.dmg = d.dmg; t.respawnMul = d.respawn; t.fobKits += d.kits; }
    });
    this.nav = { foot: new NavGrid(this.world.size, 1, 0.6), vehicle: new NavGrid(this.world.size, 2, 2.2) };
    this.nav.foot.build(this.world.obstacles, this.world.terrain, 0.9, this.world.onBridge); this.nav.vehicle.build(this.world.obstacles, this.world.terrain, 0.45, this.world.onBridge); this.units.nav = this.nav;
    this.spatial = new SpatialHash(8); this.units.spatial = this.spatial;
    this.combat = new Combat(this.units, this.spatial, this.world, app.dust); this.combat.teams = this.teams; this.combat.audio = app.audio || null;
    this.respawn = new Respawn(this.units, this.teams, this.world);
    this.support = new Support(this.units, this.respawn, this.teams);
    this.fobs = new Fobs(this.units, this.teams, this.world);
    this.feed = []; this.events = []; this.feedId = 0; this.history = []; this.histAcc = 5; this.elapsed = 0; this.log = [];   // log: captures and losses with times
    this.fobs.onBuilt = (fob) => this.event({ type: 'fob', team: fob.team, fob });
    // a finished sandbag position becomes low cover: obstacles for movement, cover for combat; anyone caught inside a bag steps out
    this.fobs.onSandbags = (u, boxes) => {
      for (const o of boxes) { this.world.obstacles.push(o); this.nav.foot.block(o, 0.3); this.nav.vehicle.block(o); this.combat.addLow(o); }   // a tighter foot pad keeps the inside of the U open
      for (const v of this.units.units) {
        if (v.dead || v === u || v.spec.structure || !v.spec.nav || Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) > 7) continue;
        const nav = this.nav[v.spec.nav]; if (!nav.blocked(v.pos.x, v.pos.z)) continue;
        const c = nav.nearest(nav.cellOf(v.pos.x), nav.cellOf(v.pos.z), 10); if (c) { v.pos.x = nav.world(c[0]); v.pos.z = nav.world(c[1]); }
      }
      this.event({ type: 'sandbags', team: u.team });
    };
    this.combat.onDeath = (v, k) => {
      this.respawn.onDeath(v, k);
      const s = this.teams[v.team].stats; s.losses[v.type] = (s.losses[v.type] || 0) + 1; if (v.type === 'fob') s.fobsLost++;
      if (k) { const ks = this.teams[k.team].stats; ks.kills[v.type] = (ks.kills[v.type] || 0) + 1; }
      this.pushFeed({ kind: 'kill', v, k });
      if (v.type !== 'soldier' && this.app.audio) this.app.audio.explosion(v.pos.x, v.pos.z, v.type === 'apc' ? 1.5 : 1);
    };
    this.time = this.mode.length; this.state = 'play'; this.winner = null; this.reason = ''; this.acc = 0;
    this.units.auto = false;
    this.deploy();
    this.mode.setup();
    this.objectives = this.mode.objectives || null;
    this.strategists = cpu.map(t => new Strategist(t, this.units, this.teams, this));
    // a remote commander (?commander=1 for the Worker's /commander, or a URL) advises each CPU side; its one-liners go to the feed
    if (app.commanderUrl) for (const s of this.strategists) { s.remote = new RemoteCommander(this, s.team, app.commanderUrl); s.remote.onPlan = (p) => { if (p.reason) this.event({ type: 'radio', team: s.team, text: p.reason }); }; }
    this.spatial.rebuild(this.units.units);
  }

  // one history row every 5 s: [t, tickets0, tickets1, infantry lost 0, 1, vehicles lost 0, 1, locations owned 0, 1]
  sample() {
    const veh = (t) => Object.entries(t.stats.losses).filter(([k]) => k !== 'soldier' && k !== 'fob').reduce((a, [, v]) => a + v, 0);
    const [a, b] = this.teams, o = this.objectives;
    return [Math.round(this.elapsed), Math.max(0, Math.round(a.tickets)), Math.max(0, Math.round(b.tickets)), a.stats.losses.soldier || 0, b.stats.losses.soldier || 0, veh(a), veh(b), o ? o.owned(0) : 0, o ? o.owned(1) : 0];
  }
  event(e) {
    e.t = 0; this.events.unshift(e); this.events.length = Math.min(this.events.length, 4);
    if (e.type === 'captured' || e.type === 'lost') { this.log.push({ t: this.elapsed, type: e.type, loc: e.loc ? e.loc.name : '', team: e.team }); if (this.log.length > 60) this.log.shift(); }
    const s = e.team !== undefined && this.teams[e.team] ? this.teams[e.team].stats : null;
    if (s) { if (e.type === 'captured') s.captures++; else if (e.type === 'lost') s.lost++; else if (e.type === 'fob') s.fobs++; else if (e.type === 'cache destroyed') s.caches++; }
    if (e.type !== 'hex lost') this.pushFeed({ kind: 'event', e });
    if (this.app.audio) this.app.audio.event(e.type, e.team === (this.app.playerTeam ?? 0));
  }
  pushFeed(f) { f.t = 0; f.id = ++this.feedId; this.feed.unshift(f); this.feed.length = Math.min(this.feed.length, 7); }
  // live enemy ground units of `team` within r of a point
  enemiesNear(team, x, z, r) { let n = 0; for (const u of this.units.units) if (!u.dead && !u.mounted && u.team !== team && !u.spec.structure && !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - x, u.pos.z - z) < r) n++; return n; }

  deploy() {
    const w = this.world;
    for (const team of this.teams) {
      const b = team.base, d = Math.hypot(b.x, b.z) || 1, dx = -b.x / d, dz = -b.z / d, lx = -dz, lz = dx, toward = Math.atan2(dx, dz);
      const at = (fwd, lat) => [b.x + dx * fwd + lx * lat, b.z + dz * fwd + lz * lat];
      const place = (fwd, lat, pad, fn) => { let [x, z] = at(fwd, lat); if (w.isBlocked(x, z, pad)) [x, z] = team.spawnPoint(w, pad); return fn(x, z); };
      const force = expand(team.loadout);
      const squads = force.filter(f => f.kind === 'squad'), apcs = force.filter(f => f.type === 'apc'), trucks = force.filter(f => f.type === 'truck'), helis = force.filter(f => f.type === 'heli');
      squads.forEach((f, i) => place(4 + (i % 2) * 5, -14 + Math.floor(i / 2) * 7, 2, (x, z) => {
        const sq = this.units.spawnSquad(x, z, team.id, f.kits); sq.item = f.item; for (const m of sq.members) { m.heading = toward; m.group.rotation.y = toward; }
      }));
      apcs.forEach((f, i) => place(11, -10 + i * 10, 4, (x, z) => this.units.spawn('apc', x, z, toward, team.id)));
      trucks.forEach((f, i) => place(-4, -12 + i * 8, 4, (x, z) => this.units.spawn('truck', x, z, toward, team.id, { supply: f.supply })));
      helis.forEach((f, i) => place(-13, -12 + i * 16, 8, (x, z) => this.units.spawn('heli', x, z, toward, team.id)));
    }
  }

  update(dt) {
    if (this.state !== 'play' || dt <= 0) return;
    this.time -= dt; this.elapsed += dt;
    if ((this.histAcc += dt) >= 5) { this.histAcc = 0; this.history.push(this.sample()); }
    this.spatial.rebuild(this.units.units);
    this.acc += dt;
    while (this.acc >= 0.1) { this.acc -= 0.1; this.tick(0.1); }
    for (const f of this.feed) f.t += dt;
    for (const e of this.events) e.t += dt;
    const [a, b] = this.teams;
    const w = this.mode.check();
    if (w) return this.end(w.winner, w.reason);
    if (a.tickets <= 0 || b.tickets <= 0) this.end(a.tickets <= 0 ? (b.tickets <= 0 ? null : b) : a, 'tickets exhausted');
    else if (this.time <= 0) this.end(a.tickets === b.tickets ? null : (a.tickets > b.tickets ? a : b), 'time expired');
  }
  tick(dt) {
    this.combat.tick(dt);
    this.respawn.tick(dt);
    this.support.tick(dt);
    this.fobs.tick(dt);
    this.mode.tick(dt);
    for (const s of this.strategists) s.tick(dt);
  }
  end(winner, reason) {
    this.state = 'over'; this.winner = winner; this.reason = reason;
    this.history.push(this.sample());
    this.app.hud.showEnd(this);
  }
}
