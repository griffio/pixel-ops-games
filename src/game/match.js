import { RULES } from './rules.js';
import { makeTeams } from './teams.js';
import { NavGrid } from './nav.js';
import { SpatialHash } from './spatial.js';
import { Combat } from './combat.js';
import { Buildings } from './buildings.js';
import { Respawn } from './respawn.js';
import { Support } from './support.js';
import { Fobs } from './fob.js';
import { Strategist } from './ai/strategist.js';
import { RemoteCommander } from './ai/remote.js';
import { UtilityCommander } from './ai/utility.js';
import { Rallies } from './rally.js';
import { Vision } from './vision.js';
import { VoiceDirector } from './voices.js';
import { DOCTRINES, PRESETS, expand, fitMap, preset } from './loadout.js';
import { createMode } from './modes/index.js';
import { Landing } from './landing.js';
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
      const onFoot = map && map.infantryOnly;   // a doctrine may price and time its men differently where there are no vehicles (respawn.js reads these)
      t.respawnCost = onFoot && t.doctrine.respawnCostInfantryOnly !== undefined ? t.doctrine.respawnCostInfantryOnly : t.doctrine.respawnCost;
      t.infantryRespawn = onFoot && t.doctrine.infantryRespawnInfantryOnly !== undefined ? t.doctrine.infantryRespawnInfantryOnly : t.doctrine.infantryRespawn;
      const p = Object.entries(PRESETS).find(([k, v]) => v.doctrine === t.loadout.doctrine && JSON.stringify(v.items) === JSON.stringify(t.loadout.items));
      t.loadoutName = p ? p[1].name : 'Custom'; t.fobKits = map && map.infantryOnly ? 0 : (t.loadout.items && t.loadout.items.fob) || 0;   // an infantry-only map strips the kit with the vehicles (fitMap)
      t.stats = { kills: {}, losses: {}, killsBy: {}, killsByUnit: {}, buildings: 0, captures: 0, lost: 0, fobs: 0, fobsLost: 0, caches: 0 };   // kills by what they hit, and by what did it (a soldier's kit, a vehicle's type); buildings brought down
      if (cpu.includes(i)) { const d = this.difficulty; t.acc = d.acc; t.dmg = d.dmg; t.respawnMul = d.respawn; if (!(map && map.infantryOnly)) t.fobKits += d.kits; }
    });
    const nc = (map && map.nav) || {};   // grid cells: 1 m and 2 m; a 2 km map uses coarser ones (memory: 4 M cells at 1 m is 130 MB)
    this.nav = { foot: new NavGrid(this.world.size, nc.foot || 1, 0.6), vehicle: new NavGrid(this.world.size, nc.vehicle || 2, 2.2) };
    this.nav.vehicle.extra = this.world.vehicleObstacles;   // thickets now, tank traps as they are laid: blocks for vehicles only
    this.nav.foot.build(this.world.obstacles, this.world.terrain, 0.9, this.world.onBridge); this.nav.vehicle.build(this.world.obstacles, this.world.terrain, 0.45, (x, z) => this.world.onBridge(x, z, true));
    if (map && map.sea) {   // a side based on a ship: its APCs and supply trucks swim, on a grid open over any water and vehicle-passable land
      const T = this.world.terrain, A = this.nav.amphib = new NavGrid(this.world.size, nc.vehicle || 2, 2.2); A.extra = this.world.vehicleObstacles;
      A.build(this.world.obstacles, T, 0.45, (x, z) => this.world.onBridge(x, z, true) || (T && T.height(x, z) < T.water));
      this.units.amphibFor = (team, type, opts) => !!(this.teams[team] && this.teams[team].base.ship && (type === 'apc' || (type === 'truck' && opts.supply)));
    }
    if (nc.cap) { this.nav.foot.cap = this.nav.vehicle.cap = nc.cap; if (this.nav.amphib) this.nav.amphib.cap = nc.cap; }
    if (map && map.gates) { this.nav.foot.setGates(map.gates, false, map.gateAxis); this.nav.vehicle.setGates(map.gates, true, map.gateAxis); }   // long barriers crossed portal to portal (nav.js); gateAxis 'x' for lines running north-south
    this.nav.foot.labelRegions(); this.nav.vehicle.labelRegions(); if (this.nav.amphib) this.nav.amphib.labelRegions();   // now, not inside the first order: labelling the big grids took the first plan's frame 110 ms
    this.units.nav = this.nav;
    this.spatial = new SpatialHash(8); this.units.spatial = this.spatial;
    this.combat = new Combat(this.units, this.spatial, this.world, app.dust); this.combat.teams = this.teams; this.combat.audio = app.audio || null;
    this.vision = new Vision(this.units, this.world, this.combat, !app.fogOff); this.combat.vision = this.vision;   // fog of war: what each side sees (?fog=0: everything)
    this.buildings = new Buildings(this); this.combat.buildings = this.buildings;   // what stray rounds can knock down
    this.respawn = new Respawn(this.units, this.teams, this.world);
    this.support = new Support(this.units, this.respawn, this.teams); this.support.match = this;   // the match: which sides are CPU, the builds under way
    this.fobs = new Fobs(this.units, this.teams, this.world);
    this.rallies = new Rallies(this.units, this.teams, this); this.respawn.rallies = this.rallies;
    this.landing = map && map.sea ? new Landing(this, map.sea) : null; this.respawn.landing = this.landing;   // a side based on a ship comes ashore by landing craft
    this.voices = null; if (app.audio) this.attachAudio(app.audio);
    this.feed = []; this.events = []; this.feedId = 0; this.history = []; this.histAcc = 5; this.elapsed = 0; this.log = [];   // log: captures and losses with times
    this.fobs.onBuilt = (fob) => this.event({ type: 'fob', team: fob.team, fob });
    // a finished sandbag position becomes low cover: obstacles for movement, cover for combat; anyone caught inside a bag steps out
    this.fobs.onSandbags = (u, boxes) => {
      u.sbBoxes = boxes;
      for (const o of boxes) { this.world.obstacles.push(o); this.nav.foot.block(o, 0.3); this.nav.vehicle.block(o); if (this.nav.amphib) this.nav.amphib.block(o); this.combat.addLow(o); }   // a tighter foot pad keeps the inside of the U open
      for (const v of this.units.units) {
        if (v.dead || v === u || v.spec.structure || !v.spec.nav || Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) > 7) continue;
        const nav = this.nav[v.spec.nav]; if (!nav.blocked(v.pos.x, v.pos.z)) continue;
        const c = nav.nearest(nav.cellOf(v.pos.x), nav.cellOf(v.pos.z), 10); if (c) { v.pos.x = nav.world(c[0]); v.pos.z = nav.world(c[1]); }
      }
      this.event({ type: 'sandbags', team: u.team });
    };
    // an emplacement's ring of bags is low cover and an obstacle like a sandbag position's
    this.fobs.onEmplacement = (u, boxes) => {
      for (const o of boxes) { this.world.obstacles.push(o); this.nav.foot.block(o, 0.3); this.nav.vehicle.block(o); if (this.nav.amphib) this.nav.amphib.block(o); this.combat.addLow(o); }
      for (const v of this.units.units) {
        if (v.dead || v === u || v.spec.structure || !v.spec.nav || Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) > 5) continue;
        const nav = this.nav[v.spec.nav]; if (!nav.blocked(v.pos.x, v.pos.z)) continue;
        const c = nav.nearest(nav.cellOf(v.pos.x), nav.cellOf(v.pos.z), 10); if (c) { v.pos.x = nav.world(c[0]); v.pos.z = nav.world(c[1]); }
      }
      this.event({ type: 'emplacement', team: u.team, gun: u.gun, label: u.label });
    };
    // tank traps: boxes that stop vehicles only (world.vehicleObstacles, and the vehicle grid's extra blocks); a vehicle caught
    // in the row is put on the nearest free ground. Cleared, the boxes go and the grid round them is worked out again.
    this.fobs.onTraps = (u, boxes) => {
      u.trapBoxes = boxes;
      for (const o of boxes) { this.world.vehicleObstacles.push(o); this.nav.vehicle.block(o); if (this.nav.amphib) this.nav.amphib.block(o); }
      const nav = this.nav.vehicle;
      for (const v of this.units.units) {
        if (v.dead || v.spec.nav !== 'vehicle' || Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) > 14 || !nav.blocked(v.pos.x, v.pos.z)) continue;
        const c = nav.nearest(nav.cellOf(v.pos.x), nav.cellOf(v.pos.z), 10); if (c) { v.pos.x = nav.world(c[0]); v.pos.z = nav.world(c[1]); }
      }
      this.event({ type: 'traps', team: u.team });
    };
    this.fobs.onTrapsCleared = (u, team) => {
      const W = this.world.vehicleObstacles, B = u.trapBoxes || [];
      for (const o of B) { const i = W.indexOf(o); if (i >= 0) W.splice(i, 1); }
      u.dead = true; u.remove = true;
      if (B.length) this.nav.vehicle.refresh(Math.min(...B.map(o => o.minX)), Math.max(...B.map(o => o.maxX)), Math.min(...B.map(o => o.minZ)), Math.max(...B.map(o => o.maxZ)));
      this.event({ type: 'traps cleared', team });
    };
    // a sandbag position cleared by an engineer: its crew step out, its bags stop being obstacles and cover, and the grids
    // round it are worked out again, so a crossing it shut is open
    this.fobs.onSandbagsCleared = (u, team) => {
      for (const s of this.units.units) if (s.post && s.post.sb === u) s.leavePost();
      const O = this.world.obstacles, B = u.sbBoxes || [];
      for (const o of B) { const i = O.indexOf(o); if (i >= 0) O.splice(i, 1); }
      u.dead = true; u.remove = true;
      if (B.length) {
        const x0 = Math.min(...B.map(o => o.minX)), x1 = Math.max(...B.map(o => o.maxX)), z0 = Math.min(...B.map(o => o.minZ)), z1 = Math.max(...B.map(o => o.maxZ));
        for (const g of [this.nav.foot, this.nav.vehicle, this.nav.amphib]) if (g) g.refresh(x0, x1, z0, z1);
        this.combat.rebuildGrids();
      }
      this.event({ type: 'sandbags cleared', team });
    };
    this.combat.onSprung = (u) => { if (u.team === (this.app.playerTeam ?? 0) && this.app.hud) this.app.hud.toast(`${u.squad && u.squad.leader ? u.squad.leader.label : u.label} opens fire`); };
    this.combat.onDeath = (v, k) => {
      this.respawn.onDeath(v, k);
      const s = this.teams[v.team].stats; s.losses[v.type] = (s.losses[v.type] || 0) + 1; if (v.type === 'fob') s.fobsLost++;
      if (k) { const ks = this.teams[k.team].stats, by = k.type === 'soldier' ? (k.firedKit || k.kit) : k.type; ks.kills[v.type] = (ks.kills[v.type] || 0) + 1; ks.killsBy[by] = (ks.killsBy[by] || 0) + 1; ks.killsByUnit[k.label] = (ks.killsByUnit[k.label] || 0) + 1; }   // by unit label (a squad's men share theirs), kept on the team: a wreck's object may be gone by the debrief
      this.pushFeed({ kind: 'kill', v, k });
      if (v.type !== 'soldier' && this.app.audio) this.app.audio.explosion(v.pos.x, v.pos.z, v.type === 'tank' ? 1.8 : v.type === 'apc' ? 1.5 : 1);
      if (v.type === 'apc' || v.type === 'tank') for (const s of this.strategists || []) if (s.remote && s.team === v.team) s.remote.nudge();
      if (this.voices) this.voices.onDeath(v, k);
      if (v.ejected) { const ps = v.ejected; v.ejected = null; for (const { p, dmg } of ps) if (p.damage(dmg, k)) this.combat.onDeath(p, k); }   // passengers of a destroyed carrier: hurt getting out, or killed, and counted
    };
    this.time = this.mode.length; this.state = 'play'; this.winner = null; this.reason = ''; this.acc = 0;
    this.units.auto = false;
    this.deploy(); if (this.landing) this.landing.afterDeploy();
    this.mode.setup();
    this.objectives = this.mode.objectives || null;
    this.strategists = cpu.map(t => new Strategist(t, this.units, this.teams, this));
    // the utility commander is the default; ?ai=rules gives a side the older built-in planner (per team: ?ai=utility,rules);
    // ?persona=aggressive|patient|balanced likewise
    const perTeam = (list, t) => ((list && list.length > 1 ? list[t] : list && list[0]) || '').trim();
    for (const s of this.strategists) if ((perTeam(app.aiModes, s.team) || 'utility') === 'utility') s.utility = new UtilityCommander(s, perTeam(app.personas, s.team) || 'balanced');
    // a remote commander (?commander=1 for the Worker's /commander, or a URL) advises each CPU side; its one-liners go to the feed
    if (app.commanderUrl) for (const s of this.strategists) { s.remote = new RemoteCommander(this, s.team, app.commanderUrl, { model: app.commanderModel || null }); s.remote.onPlan = (p) => { if (p.reason) this.event({ type: 'radio', team: s.team, text: p.reason }); }; }
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
    if (e.type === 'captured' || e.type === 'lost') for (const s of this.strategists || []) if (s.remote) s.remote.nudge();   // a remote commander hears about it at once
    if (this.app.audio) this.app.audio.event(e.type, e.team === (this.app.playerTeam ?? 0));
    if (this.voices) this.voices.onEvent(e);
  }
  // combat sounds and the player's radio (also called by app.js when the engine is made after a match that started at boot)
  attachAudio(audio) {
    this.combat.audio = audio; const pt = this.app.playerTeam ?? 0;
    this.voices = this.cpu.includes(pt) ? null : new VoiceDirector(this, audio, pt);
    this.combat.onShot = this.voices ? (u) => this.voices.onShot(u) : null;
  }
  pushFeed(f) { f.t = 0; f.id = ++this.feedId; this.feed.unshift(f); this.feed.length = Math.min(this.feed.length, 7); }
  // live enemy ground units of `team` within r of a point: those `team` can see (fog of war), or all of them for game rules (all)
  enemiesNear(team, x, z, r, all = false) { let n = 0; for (const u of this.units.units) if (!u.dead && !u.mounted && u.team !== team && !u.spec.structure && !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - x, u.pos.z - z) < r && (all || this.vision.sees(team, u))) n++; return n; }

  deploy() {
    const w = this.world;
    for (const team of this.teams) {
      const b = team.base, d = Math.hypot(b.x, b.z) || 1, dx = -b.x / d, dz = -b.z / d, lx = -dz, lz = dx, toward = Math.atan2(dx, dz);
      const at = (fwd, lat) => [b.x + dx * fwd + lx * lat, b.z + dz * fwd + lz * lat];
      const place = (fwd, lat, pad, fn) => { let [x, z] = at(fwd, lat); if (w.isBlocked(x, z, pad)) [x, z] = team.spawnPoint(w, pad); return fn(x, z); };
      const force = expand(fitMap(team.loadout, this.world.map));   // an infantry-only map strips the vehicles
      const squads = force.filter(f => f.kind === 'squad'), apcs = force.filter(f => f.type === 'apc'), tanks = force.filter(f => f.type === 'tank'), trucks = force.filter(f => f.type === 'truck'), humvees = force.filter(f => f.type === 'humvee'), helis = force.filter(f => f.type === 'heli'), birds = force.filter(f => f.type === 'bird');
      squads.forEach((f, i) => place(4 + (i % 2) * 5, -14 + Math.floor(i / 2) * 7, 2, (x, z) => {
        const sq = this.units.spawnSquad(x, z, team.id, f.kits); sq.item = f.item; for (const m of sq.members) { m.heading = toward; m.group.rotation.y = toward; }
      }));
      apcs.forEach((f, i) => place(11, -10 + i * 10, 4, (x, z) => this.units.spawn('apc', x, z, toward, team.id)));
      tanks.forEach((f, i) => place(18, -6 + i * 12, 5, (x, z) => this.units.spawn('tank', x, z, toward, team.id)));
      trucks.forEach((f, i) => place(-4, -12 + i * 8, 4, (x, z) => this.units.spawn('truck', x, z, toward, team.id, { supply: f.supply })));
      helis.forEach((f, i) => place(-13, -12 + i * 16, 8, (x, z) => this.units.spawn('heli', x, z, toward, team.id)));
      birds.forEach((f, i) => place(-22, -8 + i * 12, 6, (x, z) => this.units.spawn('bird', x, z, toward, team.id)));
      humvees.forEach((f, i) => place(-4, 12 + i * 7, 3, (x, z) => this.units.spawn('humvee', x, z, toward, team.id)));
    }
  }

  update(dt) {
    if (this.state !== 'play' || dt <= 0) return;
    this.time -= dt; this.elapsed += dt;
    if ((this.histAcc += dt) >= 5) { this.histAcc = 0; this.history.push(this.sample()); }
    this.spatial.rebuild(this.units.units);
    if (this.landing) this.landing.move(dt);   // landing craft sail every frame; their loading and beaching run at the tick
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
    this.vision.tick(dt);
    this.combat.tick(dt);
    this.rallies.tick(dt);   // before respawns: burned rallies are gone and due waves are flagged
    this.respawn.tick(dt);
    if (this.landing) this.landing.tick(dt);
    this.support.tick(dt);
    this.fobs.tick(dt);
    this.mode.tick(dt);
    for (const s of ((this.tickNo = (this.tickNo || 0) + 1) & 1) ? [...this.strategists].reverse() : this.strategists) s.tick(dt);   // neither commander plans first every tick
    if (this.voices) this.voices.tick(dt);
  }
  end(winner, reason) {
    this.state = 'over'; this.winner = winner; this.reason = reason;
    this.history.push(this.sample());
    this.app.hud.showEnd(this);
  }
}
