import { AAS } from './aas.js';
import { ITEMS } from '../loadout.js';
import { emplacementBoxes } from '../../core/models.js';

// Hold: base defence on Hilltop Farm (docs/GAME_PLAN.md, "Base defence mode plan", B1). The player's side owns the one place,
// the HQ, from the start and has three minutes to build before the first wave; then the attackers come in at the map's
// spawn points every 90 s, each wave a little stronger (TABLES, by the CPU setting), and walk at the HQ under the built-in strategist. Dead
// attackers do not come back. The attackers win by taking the HQ zone (an ordinary capture, so about 45 s with a few men
// standing in it); the player wins when the clock runs down, or when the last wave is broken.
// The waves by the lobby's CPU setting (B4): the build phase, the gap between waves, the squads of each wave, the APCs (which
// also breach walls, strategist.breach), the mortar teams (a mortar set up at range by the spawn, crewed by a squad of the
// wave, that shells whatever the attackers see and the walls when they are shut out) and the supplies a wave held brings.
const TABLES = {
  easy: { build: 240, gap: 100, income: 60, waves: [
    { squads: ['rifle', 'rifle'] },
    { squads: ['rifle', 'rifle'] },
    { squads: ['rifle', 'support'] },
    { squads: ['rifle', 'rifle', 'support'] },
    { squads: ['rifle', 'support', 'at'], apc: 1 },
    { squads: ['rifle', 'rifle', 'support'], apc: 1 },
    { squads: ['rifle', 'rifle', 'support', 'medic'], apc: 1 },
    { squads: ['rifle', 'rifle', 'support', 'at', 'marksman'], apc: 2 },
  ] },
  normal: { build: 180, gap: 90, income: 40, waves: [
    { squads: ['rifle', 'rifle'] },
    { squads: ['rifle', 'rifle', 'support'] },
    { squads: ['rifle', 'support', 'at'] },
    { squads: ['rifle', 'rifle', 'support'], apc: 1 },
    { squads: ['rifle', 'rifle', 'support', 'at'], apc: 1, mortar: 1 },
    { squads: ['rifle', 'rifle', 'support', 'medic'], apc: 1, mortar: 1 },
    { squads: ['rifle', 'rifle', 'support', 'at', 'marksman'], apc: 2, mortar: 1 },
    { squads: ['rifle', 'rifle', 'rifle', 'support', 'at', 'medic'], apc: 2, mortar: 1 },
  ] },
  hard: { build: 150, gap: 80, income: 30, waves: [
    { squads: ['rifle', 'rifle', 'support'] },
    { squads: ['rifle', 'rifle', 'support', 'rifle'] },
    { squads: ['rifle', 'rifle', 'support', 'at'], apc: 1 },
    { squads: ['rifle', 'rifle', 'support', 'rifle'], apc: 1, mortar: 1 },
    { squads: ['rifle', 'rifle', 'support', 'at', 'rifle'], apc: 1, mortar: 1 },
    { squads: ['rifle', 'rifle', 'support', 'medic', 'rifle'], apc: 2, mortar: 1 },
    { squads: ['rifle', 'rifle', 'support', 'at', 'marksman', 'rifle'], apc: 2, mortar: 2 },
    { squads: ['rifle', 'rifle', 'rifle', 'support', 'at', 'medic', 'rifle'], apc: 2, mortar: 2 },
  ] },
};
const MORTAR_CREW = ['rifle', 'rifle', 'rifle', 'rifle'];
export class Hold extends AAS {
  static key = 'hold'; static name = 'Hold the Farm'; static desc = 'Base defence: three minutes to build on the knoll, then hold the HQ against eight waves. The CPU wins by taking your HQ zone; you win at the clock, or by breaking every wave. The CPU setting sets the waves: easy gives four minutes to build and no mortars, hard two and a half, bigger waves, armour from the third and mortar teams.'; static sides = false;
  static minutes = 15;
  // the table for the lobby's CPU setting (the match's difficulty; normal when the mode is made without a match, as the lobby does)
  get table() { const d = this.match && this.match.difficulty; return TABLES[d && d.key] || TABLES.normal; }
  get length() { const T = this.table; return T.build + (T.waves.length - 1) * T.gap + 90; }   // the clock: the last wave lands with a minute and a half to take the HQ
  postRange() { return Hold.RING; }   // the garrison's commander mans positions anywhere on the farm, not only at the HQ's ring
  playerBuilds = true;   // the placement ghost and the build plan (core/builder.js, game/buildplan.js)
  buildRules = { buildRange: 140, sandbagsMax: 20, trapsMax: 10, perFob: 12, fobRange: 100, wallsMax: 30, platformsMax: 8 };   // the dump at the HQ serves the whole farm; room for a real defence
  static RING = 95;   // build within this of the HQ: the knoll and the ground just below its lip
  tickets(team) { return team === 1 ? 9999 : super.tickets(team); }   // the attackers' losses are the waves themselves
  ticketCost(u) { return u.type === 'soldier' ? 1 : undefined; }   // a man of the garrison costs one of the farm's 200, as the waves were cut for (B4), not the two of the open maps (morale and fire plan F3)
  deploys(team) { return team === 0; }   // no starting force for the attackers: the waves are theirs
  setup() {
    super.setup();
    const hq = this.hq = this.objectives.list[0]; hq.owner = 0; hq.progress = 100; hq.homes = [0, 1];   // both sides may capture it: the objectives' rule lets a side take only a place next to its own base, and the HQ is the player's home with no links (until B5 the attackers could never take it)
    this.wave = 0; this.nextWave = this.table.build; this.lastSpawnAt = Infinity; this.alive = 0;
    const m = this.match, b = this.teams[0].base;   // the HQ: a FOB for emplacements and respawns, and the supply truck the base keeps topped up
    const fob = m.units.spawn('fob', b.x + 2, b.z - 4, 0, 0); fob.label = 'HQ';
    // the supply pool: a dump beside the HQ, 300 to start and 40 more for each wave held, never refilled; it counts as a supply
    // holder to the build rules (u.supply, u.supplies) with the farm within its 140 m reach, and a low box so nobody walks through it
    const d = this.dump = m.units.spawn('dump', b.x - 9, b.z + 7, 0.4, 0); d.label = 'SUPPLY'; d.supply = true; d.supplies = 300; d.noRefill = true;
    const o = { minX: d.pos.x - 2.0, maxX: d.pos.x + 2.0, minZ: d.pos.z - 1.3, maxZ: d.pos.z + 1.3, h: 1.2 }; d.dumpBox = o;
    m.world.addObstacle(o); m.nav.foot.block(o, 0.3); m.nav.vehicle.block(o); m.combat.addLow(o);
  }
  get spawns() { const s = this.match.world.map.spawns; return s && s.length ? s : [{ x: 0, z: 236, w: 60, name: 'the north' }]; }
  spawnWave() {
    const T = this.table, W = T.waves[Math.min(this.wave, T.waves.length - 1)], m = this.match, S = this.spawns, n = ++this.wave;
    // a wave comes in on one side, the sides taking turns, so it lands together on one face of the base and the player shifts
    // squads to meet it; the last three waves come in on both sides at once
    const split = this.wave > T.waves.length - 3 && S.length > 1, side = (i) => S[split ? i % S.length : n % S.length];
    const at = (sp, k) => [sp.x + (k - 1) * 9 + (Math.random() - 0.5) * 6, sp.z + (Math.random() - 0.5) * 6];
    W.squads.forEach((kind, i) => { const sp = side(i), [x, z] = at(sp, i % 3); const sq = m.units.spawnSquad(x, z, 1, ITEMS[kind].kits); for (const u of sq.members) { u.heading = Math.atan2(-x, -z); u.group.rotation.y = u.heading; } });
    for (let i = 0; i < (W.apc || 0); i++) { const sp = side(i), [x, z] = at(sp, 1); m.units.spawn('apc', x, z, Math.atan2(-x, -z), 1); }
    for (let i = 0; i < (W.mortar || 0); i++) this.mortarTeam(side(i));
    if (n > 1 && this.dump && !this.dump.dead && this.hq.owner === 0) this.dump.supplies += T.income;   // a wave held: more to build with
    this.lastSpawnAt = m.elapsed; this.nextWave = m.elapsed + T.gap;
    const from = split ? S.map(s => s.name).join(' and ') : side(0).name;
    m.event({ type: 'radio', team: 0, who: 'HQ', text: `Wave ${n} of ${T.waves.length}: ${W.squads.length} squads${W.apc ? ` and ${W.apc} APC` : ''}${W.mortar ? ` and ${W.mortar} mortar team${W.mortar > 1 ? 's' : ''}` : ''} on ${from}` });
    for (const s of m.strategists || []) if (s.remote && s.team === 1) s.remote.nudge();
  }
  // a mortar team: a mortar set up at the spawn's firing spot (the map's, else 50 m in from the spawn toward the HQ) facing the
  // HQ, an obstacle like any emplacement, and a rifle squad beside it; the strategist's garrison rule crews it (one man on the
  // tube, the rest standing by) and the gun outlives its crew for the next wave to take over
  mortarTeam(sp) {
    const m = this.match, hq = this.hq, d = Math.hypot(hq.x - sp.x, hq.z - sp.z) || 1, [mx, mz] = sp.mortar || [sp.x + (hq.x - sp.x) / d * 50, sp.z + (hq.z - sp.z) / d * 50];
    const N = m.nav.foot, c = N.nearest(N.cellOf(mx), N.cellOf(mz), 12), x = c ? N.world(c[0]) : mx, z = c ? N.world(c[1]) : mz, h = Math.atan2(hq.x - x, hq.z - z);
    const g = m.units.spawn('emplacement', x, z, h, 1, { gun: 'mortar' }); g.label = `MO-${String(m.fobs.emplacementsOf(1).length).padStart(2, '0')}`;
    if (m.fobs.onEmplacement) m.fobs.onEmplacement(g, emplacementBoxes(x, z, h));
    const sq = m.units.spawnSquad(x - Math.sin(h) * 8 + 3, z - Math.cos(h) * 8, 1, MORTAR_CREW); for (const u of sq.members) { u.heading = h; u.group.rotation.y = h; }
    return g;
  }
  tick(dt) {
    const m = this.match; this.objectives.tick(dt, m.spatial);   // no majority bleed
    if (this.wave < this.table.waves.length && m.elapsed >= this.nextWave) this.spawnWave();
    // the attackers do not come back: nobody of theirs waits in the respawn queue, and a body goes after twenty seconds
    let alive = 0;
    for (const u of m.units.units) { if (u.team !== 1 || u.spec.structure) continue; if (!u.dead) { alive++; continue; } if (!u.noRespawn) { u.noRespawn = true; m.respawn.cancel(u); } if (u.type === 'soldier' && u.deathT > 20) u.remove = true; }
    this.alive = alive;
  }
  check() {
    const m = this.match;
    if (this.hq.owner === 1) return { winner: this.teams[1], reason: 'overran the HQ' };
    if (m.time <= 0) return { winner: this.teams[0], reason: 'held the farm until the clock ran down' };
    if (this.wave >= this.table.waves.length && this.alive === 0 && m.elapsed - this.lastSpawnAt > 8) return { winner: this.teams[0], reason: 'broke every wave' };
    return null;
  }
  // the attackers go at the HQ with everyone; the player's own commander (hybrid) holds it
  goals(team, extra = []) {
    if (team === 1) return { attack: this.hq, hold: null, threatened: [], fobAnchor: null, attackShare: 1, posture: 'aggressive', lift: false };
    return { attack: null, hold: this.hq, threatened: this.threatenedOf(team, extra), fobAnchor: this.hq, attackShare: 0 };
  }
  siteOk(team, x, z) { return team !== 0 || Math.hypot(x - this.hq.x, z - this.hq.z) <= Hold.RING ? null : `outside the farm: build within ${Hold.RING} m of the HQ`; }
  reinfLine() { const p = this.phase(), s = this.dump && !this.dump.dead ? Math.round(this.dump.supplies) : 0; return `Supplies ${s}${p.build ? ` · build phase ${Math.ceil(p.left)} s` : p.left !== null ? ` · wave ${this.wave} of ${this.table.waves.length}, next in ${Math.ceil(p.left)} s` : ' · last wave'}`; }
  // where the threat comes from, for the facing of what gets built: the nearer spawn for the defenders, the HQ for the attackers
  threatFrom(team, x, z) { if (team === 1) return this.hq; let best = null, bd = Infinity; for (const s of this.spawns) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } } return best; }
  // for the commander's digest (ai/digest.js) and the debrief: where the waves stand
  forDigest() {
    const T = this.table, p = this.phase(), S = this.spawns, next = this.wave < T.waves.length ? T.waves[this.wave] : null, n = this.wave + 1;
    const split = n > T.waves.length - 3 && S.length > 1, side = split ? S.map(s => s.name).join(' and ') : S[n % S.length].name;
    return { wave: this.wave, of: T.waves.length, buildPhase: p.build || undefined, nextWaveIn: p.left === null ? undefined : Math.round(p.left), nextWaveFrom: next ? side : undefined, nextWave: next ? { squads: next.squads.length, apc: next.apc || 0, mortarTeams: next.mortar || 0 } : undefined,
      attackersAlive: this.alive, spawns: S.map(s => ({ name: s.name, at: [Math.round(s.x), Math.round(s.z)], mortarAt: s.mortar ? s.mortar.map(Math.round) : undefined })), supplies: this.dump && !this.dump.dead ? Math.round(this.dump.supplies) : 0, suppliesPerWaveHeld: T.income };
  }
  // the debrief's own rows (hud.showEnd): waves held, what the attackers lost, what fell
  debrief() {
    const m = this.match, st = m.teams[0].stats, T = this.table, U = m.units.units, walls = U.filter(u => u.type === 'wall' && !u.dead).length, breached = m.buildings ? m.buildings.list.filter(b => b.unit && b.down).length : 0;
    return [['Waves held', `${this.hq.owner === 0 ? this.wave : Math.max(0, this.wave - 1)} of ${T.waves.length}`, ''], ['Attackers killed', '', `${m.teams[1].stats.losses.soldier || 0} men, ${m.teams[1].stats.losses.apc || 0} APC`],
      ['Works built', `${st.walls || 0} wall${st.walls === 1 ? '' : 's'}, ${st.platforms || 0} platform${st.platforms === 1 ? '' : 's'}`, ''], ['Walls breached', `${breached} (${walls} standing)`, ''], ['Supplies left', this.dump ? Math.round(this.dump.supplies) : 0, '']];
  }
  phase() { const m = this.match; if (this.wave === 0) return { build: true, left: Math.max(0, this.nextWave - m.elapsed) }; return { build: false, left: this.wave < this.table.waves.length ? Math.max(0, this.nextWave - m.elapsed) : null }; }
  bar() {
    const p = this.phase(), mm = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const note = p.build ? `build phase ${mm(p.left)}` : p.left !== null ? `wave ${this.wave} of ${this.table.waves.length} · next in ${mm(p.left)}` : `last wave · ${this.alive} left`;
    return [...super.bar(), { name: 'Waves', owner: -1, progress: 0, note }];
  }
  drawMinimap(g, X, Z, k) {
    super.drawMinimap(g, X, Z, k);
    g.fillStyle = 'rgba(232,106,90,0.9)';
    for (const s of this.spawns) { const x = X(s.x), z = Z(s.z), dx = -Math.sign(s.x || 0.01) * 5, dz = Math.sign(s.z || 0.01) * 5; g.beginPath(); g.moveTo(x + (Math.abs(s.x) > Math.abs(s.z) ? dx : 0), z + (Math.abs(s.z) >= Math.abs(s.x) ? dz : 0)); g.lineTo(x + 4, z + 4); g.lineTo(x - 4, z - 4); g.closePath(); g.fill(); }
  }
}
