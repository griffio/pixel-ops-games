import { AAS } from './aas.js';
import { ITEMS } from '../loadout.js';

// Hold: base defence on Hilltop Farm (docs/GAME_PLAN.md, "Base defence mode plan", B1). The player's side owns the one place,
// the HQ, from the start and has three minutes to build before the first wave; then the attackers come in at the map's
// spawn points every 90 s, each wave a little stronger (WAVES), and walk at the HQ under the built-in strategist. Dead
// attackers do not come back. The attackers win by taking the HQ zone (an ordinary capture, so about 45 s with a few men
// standing in it); the player wins when the clock runs down, or when the last wave is broken.
const BUILD = 180, GAP = 90;
const WAVES = [
  { squads: ['rifle', 'rifle'] },
  { squads: ['rifle', 'rifle', 'support'] },
  { squads: ['rifle', 'support', 'at'] },
  { squads: ['rifle', 'rifle', 'support'], apc: 1 },
  { squads: ['rifle', 'rifle', 'support', 'at'], apc: 1 },
  { squads: ['rifle', 'rifle', 'support', 'medic'], apc: 1 },
  { squads: ['rifle', 'rifle', 'support', 'at', 'marksman'], apc: 2 },
  { squads: ['rifle', 'rifle', 'rifle', 'support', 'at', 'medic'], apc: 2 },
];
export class Hold extends AAS {
  static key = 'hold'; static name = 'Hold the Farm'; static desc = 'Base defence: three minutes to build on the knoll, then hold the HQ against eight waves over twelve minutes. The CPU wins by taking your HQ zone; you win at the clock, or by breaking every wave.'; static sides = false;
  static minutes = 15;
  playerBuilds = true;   // the placement ghost and the build plan (core/builder.js, game/buildplan.js)
  buildRules = { buildRange: 140, sandbagsMax: 20, trapsMax: 10, perFob: 12, fobRange: 100, wallsMax: 30, platformsMax: 8 };   // the one truck parked at the HQ serves the whole farm; room for a real defence
  static RING = 95;   // build within this of the HQ: the knoll and the ground just below its lip
  tickets(team) { return team === 1 ? 9999 : super.tickets(team); }   // the attackers' losses are the waves themselves
  deploys(team) { return team === 0; }   // no starting force for the attackers: the waves are theirs
  setup() {
    super.setup();
    const hq = this.hq = this.objectives.list[0]; hq.owner = 0; hq.progress = 100;
    this.wave = 0; this.nextWave = BUILD; this.lastSpawnAt = Infinity; this.alive = 0;
    const m = this.match, b = this.teams[0].base;   // the HQ: a FOB for emplacements and respawns, and the supply truck the base keeps topped up
    const fob = m.units.spawn('fob', b.x + 2, b.z - 4, 0, 0); fob.label = 'HQ';
    const t = m.units.spawn('truck', b.x - 10, b.z + 8, Math.PI / 2, 0, { supply: true }); t.label = 'SP-01'; t.supplies = 300; t.noRefill = true; t.manual = true;   // the supply pool: 300 to start, 40 more for each wave held, no refilling
    this.truck = t;
  }
  get spawns() { const s = this.match.world.map.spawns; return s && s.length ? s : [{ x: 0, z: 236, w: 60, name: 'the north' }]; }
  spawnWave() {
    const W = WAVES[Math.min(this.wave, WAVES.length - 1)], m = this.match, S = this.spawns, n = ++this.wave;
    const at = (sp, k) => [sp.x + (k - 1) * 9 + (Math.random() - 0.5) * 6, sp.z + (Math.random() - 0.5) * 6];
    W.squads.forEach((kind, i) => { const sp = S[i % S.length], [x, z] = at(sp, i % 3); const sq = m.units.spawnSquad(x, z, 1, ITEMS[kind].kits); for (const u of sq.members) { u.heading = Math.atan2(-x, -z); u.group.rotation.y = u.heading; } });
    for (let i = 0; i < (W.apc || 0); i++) { const sp = S[(i + 1) % S.length], [x, z] = at(sp, 1); m.units.spawn('apc', x + (sp.w ? 0 : 0), z, Math.atan2(-x, -z), 1); }
    if (n > 1 && this.truck && !this.truck.dead && this.hq.owner === 0) this.truck.supplies += 40;   // a wave held: more to build with
    this.lastSpawnAt = m.elapsed; this.nextWave = m.elapsed + GAP;
    const from = S.length > 1 ? S.map(s => s.name).join(' and ') : S[0].name;
    m.event({ type: 'radio', team: 0, who: 'HQ', text: `Wave ${n} of ${WAVES.length}: ${W.squads.length} squads${W.apc ? ` and ${W.apc} APC` : ''} on ${from}` });
    for (const s of m.strategists || []) if (s.remote && s.team === 1) s.remote.nudge();
  }
  tick(dt) {
    const m = this.match; this.objectives.tick(dt, m.spatial);   // no majority bleed
    if (this.wave < WAVES.length && m.elapsed >= this.nextWave) this.spawnWave();
    // the attackers do not come back: nobody of theirs waits in the respawn queue, and a body goes after twenty seconds
    let alive = 0;
    for (const u of m.units.units) { if (u.team !== 1 || u.spec.structure) continue; if (!u.dead) { alive++; continue; } if (!u.noRespawn) { u.noRespawn = true; m.respawn.cancel(u); } if (u.type === 'soldier' && u.deathT > 20) u.remove = true; }
    this.alive = alive;
  }
  check() {
    const m = this.match;
    if (this.hq.owner === 1) return { winner: this.teams[1], reason: 'overran the HQ' };
    if (m.time <= 0) return { winner: this.teams[0], reason: 'held the farm until the clock ran down' };
    if (this.wave >= WAVES.length && this.alive === 0 && m.elapsed - this.lastSpawnAt > 8) return { winner: this.teams[0], reason: 'broke every wave' };
    return null;
  }
  // the attackers go at the HQ with everyone; the player's own commander (hybrid) holds it
  goals(team, extra = []) {
    if (team === 1) return { attack: this.hq, hold: null, threatened: [], fobAnchor: null, attackShare: 1, posture: 'aggressive', lift: false };
    return { attack: null, hold: this.hq, threatened: this.threatenedOf(team, extra), fobAnchor: this.hq, attackShare: 0 };
  }
  siteOk(team, x, z) { return team !== 0 || Math.hypot(x - this.hq.x, z - this.hq.z) <= Hold.RING ? null : `outside the farm: build within ${Hold.RING} m of the HQ`; }
  reinfLine() { const p = this.phase(), s = this.truck && !this.truck.dead ? Math.round(this.truck.supplies) : 0; return `Supplies ${s}${p.build ? ` · build phase ${Math.ceil(p.left)} s` : p.left !== null ? ` · wave ${this.wave} of ${WAVES.length}, next in ${Math.ceil(p.left)} s` : ' · last wave'}`; }
  // where the threat comes from, for the facing of what gets built: the nearer spawn for the defenders, the HQ for the attackers
  threatFrom(team, x, z) { if (team === 1) return this.hq; let best = null, bd = Infinity; for (const s of this.spawns) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } } return best; }
  phase() { const m = this.match; if (this.wave === 0) return { build: true, left: Math.max(0, this.nextWave - m.elapsed) }; return { build: false, left: this.wave < WAVES.length ? Math.max(0, this.nextWave - m.elapsed) : null }; }
  bar() {
    const p = this.phase(), mm = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const note = p.build ? `build phase ${mm(p.left)}` : p.left !== null ? `wave ${this.wave} of ${WAVES.length} · next in ${mm(p.left)}` : `last wave · ${this.alive} left`;
    return [...super.bar(), { name: 'Waves', owner: -1, progress: 0, note }];
  }
  drawMinimap(g, X, Z, k) {
    super.drawMinimap(g, X, Z, k);
    g.fillStyle = 'rgba(232,106,90,0.9)';
    for (const s of this.spawns) { const x = X(s.x), z = Z(s.z), dx = -Math.sign(s.x || 0.01) * 5, dz = Math.sign(s.z || 0.01) * 5; g.beginPath(); g.moveTo(x + (Math.abs(s.x) > Math.abs(s.z) ? dx : 0), z + (Math.abs(s.z) >= Math.abs(s.x) ? dz : 0)); g.lineTo(x + 4, z + 4); g.lineTo(x - 4, z - 4); g.closePath(); g.fill(); }
  }
}
