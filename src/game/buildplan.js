import { RULES } from './rules.js';

// The player's build plan (docs/GAME_PLAN.md, "Base defence mode plan", B2): what the placement ghost drops. Each entry
// is a structure wanted at a spot with a facing; the nearest free engineer of the side walks there, and when he stands at
// it with a supply truck in range the ordinary build starts (game/fob.js) and runs as any other. An entry whose engineer
// dies or wanders goes back to the queue; cancelling one before the build starts costs nothing. The mode says what may
// be built where (siteOk) and how far a truck's supplies reach (buildRules), and the HUD reads the queue for its chips.
export const KINDS = {
  sandbags: { name: 'Sandbags', cost: () => RULES.sandbags.supplyCost, time: () => RULES.sandbags.buildTime },
  hmg: { name: 'HMG', gun: 'hmg', cost: () => RULES.emplacement.hmg.supplyCost, time: () => RULES.emplacement.hmg.buildTime },
  atgm: { name: 'AT gun', gun: 'atgm', cost: () => RULES.emplacement.atgm.supplyCost, time: () => RULES.emplacement.atgm.buildTime },
  mortar: { name: 'Mortar', gun: 'mortar', cost: () => RULES.emplacement.mortar.supplyCost, time: () => RULES.emplacement.mortar.buildTime },
  traps: { name: 'Tank traps', cost: () => RULES.traps.supplyCost, time: () => RULES.traps.buildTime },
  wall: { name: 'Wall', cost: () => RULES.wall.supplyCost, time: () => RULES.wall.buildTime },
  platform: { name: 'Platform', cost: () => RULES.platform.supplyCost, time: () => RULES.platform.buildTime },
};
// how far apart two planned builds must be (a built one is in the ground and its boxes speak for it): wall runs may touch end to
// end, a platform wants a little clearance, bags and guns keep their 12 m from each other
const GAP = (a, b) => (a === 'traps' || b === 'traps' ? 0 : a === 'wall' && b === 'wall' ? 5.8 : a === 'wall' || b === 'wall' ? 5 : a === 'platform' && b === 'platform' ? 7.5 : a === 'platform' || b === 'platform' ? 6 : RULES.sandbags.minSpacing);
export class BuildPlan {
  constructor(match, team = 0) { this.m = match; this.team = team; this.list = []; this.seq = 0; this.acc = 0; }
  get fobs() { return this.m.fobs; }
  // may `kind` go at (x, z) facing h? { ok, reason, cost, x, z, h }: traps snap across a road within 12 m, so the spot may move
  check(kind, x, z, h = null) {
    const K = KINDS[kind], F = this.fobs, team = this.team; if (!K) return { ok: false, reason: 'no such structure' };
    let site, at = [x, z], hh = h;
    if (kind === 'traps') { const [rx, rz, rh] = F.trapRow(x, z, team, h); at = [rx, rz]; hh = rh; site = F.trapSite(team, rx, rz); }
    else if (K.gun) site = F.emplacementSite(team, x, z);
    else if (kind === 'wall') site = F.wallSite(team, x, z, h);
    else if (kind === 'platform') site = F.platformSite(team, x, z, h);
    else site = F.sandbagSite(team, x, z);
    if (!site.reason && this.list.some(e => { const g = GAP(e.kind, kind); return g && Math.hypot(e.x - at[0], e.z - at[1]) < g; })) site = { reason: 'too close to another planned build' };
    if (!site.reason && kind === 'traps' && this.list.some(e => e.kind === 'traps' && Math.hypot(e.x - at[0], e.z - at[1]) < RULES.traps.minSpacing)) site = { reason: `too close to planned traps (${RULES.traps.minSpacing} m)` };
    const pool = this.pool(), cost = K.cost(), planned = this.list.reduce((s, e) => s + KINDS[e.kind].cost(), 0);
    if (!site.reason && pool < planned + cost) site = { reason: `not enough supplies: ${pool} left, ${planned} already planned` };
    return { ok: !site.reason, reason: site.reason || null, cost, x: at[0], z: at[1], h: hh === null ? F.threatHeading(team, at[0], at[1]) : hh, time: K.time() };
  }
  // the side's supplies: what its trucks carry (Hold: the one parked at the HQ)
  pool() { return Math.round(this.m.units.units.filter(t => t.supply && !t.dead && t.team === this.team).reduce((s, t) => s + t.supplies, 0)); }
  planned() { return this.list.reduce((s, e) => s + KINDS[e.kind].cost(), 0); }
  add(kind, x, z, h = null) {
    const c = this.check(kind, x, z, h); if (!c.ok) return c;
    const e = { id: ++this.seq, kind, gun: KINDS[kind].gun || null, x: c.x, z: c.z, h: c.h, eng: null, build: null, state: 'queued', why: null, cost: c.cost };
    this.list.push(e); return { ok: true, entry: e };
  }
  cancel(e) {
    const i = this.list.indexOf(e); if (i < 0) return false; this.list.splice(i, 1);
    if (e.eng) { if (e.build) this.fobs.cancel(e.eng); else if (e.eng.dest) { e.eng.dest = null; e.eng.target = null; e.eng.path = null; } e.eng.planFor = null; }
    return true;
  }
  engineers() { return this.m.units.units.filter(u => u.team === this.team && u.kit === 'engineer' && !u.dead && !u.mounted && !u.afloat); }
  free() { return this.engineers().filter(u => !u.building && !u.planFor); }
  start(e) {
    const F = this.fobs, at = [e.x, e.z];
    const r = e.kind === 'traps' ? F.startTraps(e.eng, at, e.h) : e.gun ? F.startEmplacement(e.eng, e.gun, at, e.h) : e.kind === 'wall' ? F.startWall(e.eng, at, e.h) : e.kind === 'platform' ? F.startPlatform(e.eng, at, e.h) : F.startSandbags(e.eng, at, e.h);
    if (r.ok) { e.build = r.build; e.state = 'building'; e.why = null; if (this.onStart) this.onStart(e); } else e.why = r.reason;
    return r.ok;
  }
  tick(dt) {
    if (!this.list.length) return; this.acc += dt; const slow = this.acc >= 0.5; if (slow) this.acc = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i], eng = e.eng;
      if (e.state === 'building') {
        if (eng && eng.building === e.build) continue;
        // the build is over: done when the structure stands there, otherwise (the engineer walked, died, was cancelled) back to the queue
        const want = e.gun ? 'emplacement' : e.kind, done = this.m.units.units.some(u => !u.dead && u.team === this.team && u.type === want && Math.hypot(u.pos.x - e.x, u.pos.z - e.z) < 4);
        if (eng) eng.planFor = null;
        if (done) { this.list.splice(i, 1); if (this.onDone) this.onDone(e); } else { e.state = 'queued'; e.eng = null; e.build = null; }
        continue;
      }
      if (e.state === 'walking') {
        if (!eng || eng.dead || eng.mounted || eng.building) { if (eng && !eng.building) eng.planFor = null; e.state = 'queued'; e.eng = null; continue; }
        const d = Math.hypot(eng.pos.x - e.x, eng.pos.z - e.z);
        if (d <= (e.kind === 'platform' ? 4.2 : 2.6)) { if (slow || !e.triedAt) { e.triedAt = this.m.elapsed; if (!this.start(e)) { /* waits where he is: a truck out of range, supplies short */ } } continue; }
        if (!eng.dest && slow) this.walk(e);   // his order was lost (an attack-move, a hold): sent again
        continue;
      }
      if (slow) { const f = this.free().sort((a, b) => Math.hypot(a.pos.x - e.x, a.pos.z - e.z) - Math.hypot(b.pos.x - e.x, b.pos.z - e.z))[0]; if (f) { e.eng = f; f.planFor = e; e.state = 'walking'; this.walk(e); } }
    }
  }
  // the engineer stands a step to the rear of the spot (the open side), clear of what he builds; a platform's ladder foot is further back
  walk(e) { const eng = e.eng, s = Math.sin(e.h), c = Math.cos(e.h), back = e.kind === 'platform' ? 3.4 : 1.6; eng.leavePost && eng.leavePost(); eng.order(e.x - s * back, e.z - c * back); eng.manual = true; }
  forDigest() { return this.list.map(e => ({ kind: e.kind, at: [Math.round(e.x), Math.round(e.z)], state: e.state })); }
}
