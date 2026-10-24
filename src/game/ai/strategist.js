import { RULES } from '../rules.js';

// CPU commander v2: objective-aware manoeuvre, logistics (FOB one hop behind the
// front) and air (helicopter lifts for squads far from the fight).
export class Strategist {
  constructor(team, units, teams, match) { this.team = team; this.units = units; this.teams = teams; this.match = match; this.timer = 1 + Math.random() * 2; this.reflex = 0.5; this.plan = null; this.lifts = new Map(); this.diff = match.difficulty || { plan: 5, attackShare: 0, logistics: true }; }

  enemiesNear(x, z, r) { return this.units.units.filter(u => !u.dead && !u.mounted && u.team !== this.team && !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - x, u.pos.z - z) < r); }
  friendsNear(x, z, r) { return this.units.units.filter(u => !u.dead && !u.mounted && u.team === this.team && Math.hypot(u.pos.x - x, u.pos.z - z) < r); }
  cluster(list) {
    let best = null, bestN = -1;
    for (const e of list) { let n = 0; for (const o of list) if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 20) n++; if (n > bestN) { bestN = n; best = e; } }
    return best ? { x: best.pos.x, z: best.pos.z } : null;
  }
  inZone(x, z, loc, k = 0.6) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * loc.r * k; return [loc.x + Math.cos(a) * d, loc.z + Math.sin(a) * d]; }
  send(sq, x, z, tag, zone = null) {
    if (sq.busy && sq.tag === tag && sq.goal && Math.hypot(sq.goal[0] - x, sq.goal[1] - z) < 12) return;
    const c = sq.centroid(); if (!sq.busy && Math.hypot(c.x - x, c.z - z) < 10 && sq.tag === tag) return;
    sq.goal = [x, z]; sq.tag = tag; sq.zone = zone; sq.order(x, z);
  }
  toward(from, to, keep, jitter = 6) { const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, k = Math.max(0, d - keep) / d; return [from.x + dx * k + (Math.random() - 0.5) * jitter, from.z + dz * k + (Math.random() - 0.5) * jitter]; }

  tick(dt) {
    if ((this.reflex -= dt) <= 0) { this.reflex = 1; this.caution(); }
    this.timer -= dt; if (this.timer > 0) return; this.timer = this.diff.plan + Math.random() * 2;
    const base = this.teams[this.team].base;
    // drop lifts whose helicopter or squad is gone, so squads return to the pool
    for (const [k, v] of [...this.lifts]) { const heli = k.type === 'heli' ? k : v, sq = k.type === 'heli' ? v.sq : k; if (!heli || heli.dead || !sq || !sq.leader) { this.lifts.delete(k); if (sq) for (const m of sq.members) m.boardTarget = null; } }
    const squads = this.units.squads.filter(s => s.team === this.team && s.leader && !this.lifts.has(s) && !s.members.some(m => m.building) && !(s.pinUntil > this.match.elapsed));   // pinned squads (in cover from armour, or stalking it) keep doing that
    const vehicles = this.units.units.filter(u => u.team === this.team && !u.dead && !u.squad && !u.spec.structure);
    const myFobs = this.units.units.filter(u => u.type === 'fob' && u.team === this.team && !u.dead).map(f => ({ x: f.pos.x, z: f.pos.z, r: 18, index: 'fob' + f.id }));
    const g = this.match.mode.goals(this.team, myFobs);
    if (g.hunt) return this.skirmish(squads, vehicles, base);
    const attack = g.attack, hold = g.hold, reserve = g.reserve || null;
    const enemyFob = this.units.units.find(u => u.type === 'fob' && u.team !== this.team && !u.dead && (attack ? Math.hypot(u.pos.x - attack.x, u.pos.z - attack.z) < 160 : true));
    const logisticsSquad = this.logistics(squads, vehicles, g.fobAnchor, hold);
    const free = squads.filter(s => s !== logisticsSquad);
    const share = Math.min(0.95, Math.max(0.2, g.attackShare + this.diff.attackShare));
    const nAttack = attack ? Math.ceil(free.length * share) : 0;
    const posts = hold ? this.match.fobs.sandbagsOf(this.team).filter(s => Math.hypot(s.pos.x - hold.x, s.pos.z - hold.z) < hold.r + 12) : []; let post = 0;   // our sandbag positions at the place we hold, one squad each
    free.forEach((sq, i) => {
      if (enemyFob && i === 0 && attack) { this.send(sq, enemyFob.pos.x, enemyFob.pos.z, 'raid'); return; }   // one squad raids the nearest enemy FOB
      if (i < nAttack && attack) {
        const foes = this.enemiesNear(attack.x, attack.z, attack.r + 20);
        if (foes.length > 1 && (attack.n ? attack.n[this.team] : 0) < 4) {   // stand off and shoot rather than walk into them, from behind something if an APC overlooks the spot
          const c = this.cluster(foes), cen = sq.centroid(); let [x, z] = this.toward(cen, c, 35);
          const apc = this.units.units.find(f => f.type === 'apc' && !f.dead && f.team !== this.team && Math.hypot(f.pos.x - x, f.pos.z - z) < 150 && this.match.combat.canSeePoint(f, x, z));
          if (apc) { const p = this.match.combat.coverPoint(x, z, apc.pos.x, apc.pos.z, 30, this.units.nav.foot); if (p) [x, z] = p; }
          this.send(sq, x, z, 'approach', attack);
        }
        else { const [x, z] = this.inZone(attack.x, attack.z, attack); this.send(sq, x, z, 'cap' + attack.index, attack); }
      } else if (reserve && hold && i >= nAttack + Math.ceil((free.length - nAttack) * 0.7)) { const [x, z] = this.inZone(reserve.x, reserve.z, reserve, 0.6); this.send(sq, x, z, 'reserve' + reserve.index, reserve); }
      else if (hold && post < posts.length) { const s = posts[post++]; this.send(sq, s.pos.x - Math.sin(s.heading) * 0.4, s.pos.z - Math.cos(s.heading) * 0.4, 'post' + s.id, hold); }
      else if (hold) { const [x, z] = this.inZone(hold.x, hold.z, hold, 0.7); this.send(sq, x, z, 'hold' + hold.index, hold); }
      else this.send(sq, base.x + (Math.random() - 0.5) * 20, base.z + (Math.random() - 0.5) * 20, 'home');
    });
    for (const v of vehicles) {
      if (v.type === 'apc') {
        const goal = attack || hold; if (!goal) continue;
        const foes = this.enemiesNear(goal.x, goal.z, goal.r + 40), c = this.cluster(foes);
        let x, z;
        // close to a 70 m standoff from the enemy cluster: outside rocket reach, well inside the cannon's; nearer than
        // that the turret does the work from where it stands, and caution() backs it off when something gets close
        if (c) { const dx = c.x - v.pos.x, dz = c.z - v.pos.z, d = Math.hypot(dx, dz) || 1; if (d < 85) continue; const k = (d - 70) / d; x = v.pos.x + dx * k; z = v.pos.z + dz * k; }
        else [x, z] = this.inZone(goal.x, goal.z, goal, 0.8);
        if (v.dest && v.goal && Math.hypot(v.goal[0] - x, v.goal[1] - z) < 12) continue;
        v.goal = [x, z]; v.order(x, z);
      } else if (v.type === 'heli') this.air(v, free, attack, base);
      else if (!v.supply && !v.dest && Math.random() < 0.2) v.order(base.x + (Math.random() - 0.5) * 24, base.z + (Math.random() - 0.5) * 24);
    }
  }

  // Caution, once a second. Armour first: a squad an enemy APC can see within 110 m stalks it to rocket range if
  // it carries launchers, otherwise it moves behind the nearest building or hill out of the APC's sight (or falls
  // back if there is none) and stays there while the APC is about. Then infantry: a squad with an enemy inside 22 m
  // falls back unless it stands in the zone it was sent to take or hold, or clearly has the numbers. An APC with an
  // enemy inside 50 m backs off to 70 m.
  halt(sq, tag) { for (const m of sq.members) if (!m.dead) { m.dest = null; m.target = null; m.path = null; } sq.tag = tag; sq.goal = null; }
  caution() {
    const enemies = this.units.units.filter(u => !u.dead && !u.mounted && u.team !== this.team && !u.spec.structure && !(u.spec.air && u.alt > 2));
    if (!enemies.length) return;
    const C = this.match.combat, now = this.match.elapsed, apcs = enemies.filter(e => e.type === 'apc');
    const nearest = (x, z) => { let b = null, bd = Infinity; for (const e of enemies) { const d = Math.hypot(e.pos.x - x, e.pos.z - z); if (d < bd) { bd = d; b = e; } } return [b, bd]; };
    const away = (x, z, e, dist) => { const dx = x - e.pos.x, dz = z - e.pos.z, d = Math.hypot(dx, dz) || 1; return [x + dx / d * dist, z + dz / d * dist]; };
    for (const sq of this.units.squads) {
      if (sq.team !== this.team || !sq.leader || sq.mounted || this.lifts.has(sq) || sq.members.some(m => m.building)) continue;
      const c = sq.centroid();
      let apc = null, ad = 1e9; for (const v of apcs) { const d = Math.hypot(v.pos.x - c.x, v.pos.z - c.z); if (d < 150 && d < ad && C.canSeePoint(v, c.x, c.z)) { apc = v; ad = d; } }
      if (apc) {
        if (sq.members.some(m => !m.dead && m.kit === 'at')) { if (ad > 72) { const [x, z] = this.toward(c, apc.pos, 60); this.send(sq, x, z, 'stalk', sq.zone); } else this.halt(sq, 'stalk'); }
        else if (sq.tag !== 'cover' || (!sq.busy && (sq.seen = (sq.seen || 0) + 1) >= 2)) {   // not yet hiding, or settled in cover and still seen twice running: pick cover again
          const p = C.coverPoint(c.x, c.z, apc.pos.x, apc.pos.z, 26, this.units.nav.foot); sq.seen = 0;
          if (p) { sq.goal = p; sq.tag = 'cover'; sq.order(p[0], p[1]); } else { const [x, z] = away(c.x, c.z, apc, 30); sq.goal = [x, z]; sq.tag = 'back'; sq.order(x, z); }
        }
        sq.pinUntil = now + 6; continue;
      }
      sq.seen = 0;
      if ((sq.tag === 'cover' || sq.tag === 'stalk') && apcs.some(v => Math.hypot(v.pos.x - c.x, v.pos.z - c.z) < 150)) { sq.pinUntil = now + 6; continue; }   // heads down while it is about
      const [e, d] = nearest(c.x, c.z); if (!e || d > 22) continue;
      if (sq.zone && Math.hypot(c.x - sq.zone.x, c.z - sq.zone.z) < sq.zone.r) continue;                     // stand and fight for the zone
      if (sq.tag && sq.tag.startsWith('post')) continue;                                                     // dug in: stay
      if (this.friendsNear(c.x, c.z, 25).length >= this.enemiesNear(c.x, c.z, 25).length * 2) continue;    // we clearly have the numbers
      const [x, z] = away(c.x, c.z, e, 28); sq.goal = [x, z]; sq.tag = 'back'; sq.order(x, z);
    }
    for (const v of this.units.units) {
      if (v.team !== this.team || v.dead || v.type !== 'apc') continue;
      const [e, d] = nearest(v.pos.x, v.pos.z); if (!e || d > 50) continue;
      const [x, z] = away(v.pos.x, v.pos.z, e, 70 - d); v.goal = [x, z]; v.order(x, z);
    }
  }

  // Logistics: with kits left, a supply truck and an engineer squad, build a FOB one hop
  // behind the front (towards our base) and keep the pair together until it is up.
  logistics(squads, vehicles, anchor, hold = null) {
    const fobs = this.match.fobs, team = this.teams[this.team], base = team.base;
    if (this.plan && (this.plan.sq.engineer === null || this.plan.truck.dead || this.plan.done)) this.plan = null;
    if (!this.plan) {
      if (!this.diff.logistics) return null;
      const sq = squads.find(s => s.engineer); if (!sq) return null;
      const truckTo = (at) => vehicles.filter(v => v.supply && v.supplies >= RULES.fob.supplyCost).sort((a, b) => Math.hypot(a.pos.x - at.x, a.pos.z - at.z) - Math.hypot(b.pos.x - at.x, b.pos.z - at.z))[0];
      if (anchor && fobs.kitsLeft(this.team) > 0) {
        const truck = truckTo(anchor); if (!truck) return null;
        const [x, z] = this.toward(anchor, base, Math.hypot(anchor.x - base.x, anchor.z - base.z) - 45, 0);   // 45 m behind the location, towards home
        if (this.units.nav.vehicle.blocked(x, z) || fobs.active(this.team).some(f => Math.hypot(f.pos.x - x, f.pos.z - z) < RULES.fob.minSpacing)) return null;
        this.plan = { kind: 'fob', sq, truck, x, z, t: 0 };
      } else if (hold && fobs.sandbagsOf(this.team).length < RULES.sandbags.max && !fobs.sandbagsOf(this.team).some(s => Math.hypot(s.pos.x - hold.x, s.pos.z - hold.z) < hold.r + 12)) {
        // no kit to spend: dig in at the location we hold, a few metres towards the enemy
        const truck = vehicles.filter(v => v.supply && v.supplies >= RULES.sandbags.supplyCost).sort((a, b) => Math.hypot(a.pos.x - hold.x, a.pos.z - hold.z) - Math.hypot(b.pos.x - hold.x, b.pos.z - hold.z))[0]; if (!truck) return null;
        const eb = this.teams[1 - this.team].base, dx = eb.x - hold.x, dz = eb.z - hold.z, d = Math.hypot(dx, dz) || 1;
        let x = hold.x + dx / d * Math.min(10, hold.r * 0.5), z = hold.z + dz / d * Math.min(10, hold.r * 0.5);
        if (this.units.nav.foot.blocked(x, z)) { const c = this.units.nav.foot.nearest(this.units.nav.foot.cellOf(x), this.units.nav.foot.cellOf(z), 10); if (!c) return null; x = this.units.nav.foot.world(c[0]); z = this.units.nav.foot.world(c[1]); }
        this.plan = { kind: 'sandbags', sq, truck, x, z, t: 0 };
      } else return null;
    }
    const p = this.plan; p.t += 5;
    if (p.t > 240) { this.plan = null; return null; }                                   // give up on stalled plans
    const eng = p.sq.engineer, near = (u, r) => Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r;
    if (!near(p.truck, 8) && !p.truck.dest) p.truck.order(p.x + 4, p.z + 4);
    if (!near(eng, 4) && !p.sq.busy) this.send(p.sq, p.x, p.z, 'fob');
    if (near(eng, 4) && near(p.truck, RULES.fob.buildRange) && !eng.building) { const r = p.kind === 'sandbags' ? fobs.startSandbags(eng) : fobs.startBuild(eng); if (r.ok) p.done = true; else if (p.kind === 'sandbags') this.plan = null; }
    return p.sq;
  }

  // Air: a parked helicopter at base lifts a squad that gathers beside it when the
  // objective is far, lands it short of the objective on our side, and flies home.
  air(heli, squads, attack, base) {
    const lift = this.lifts.get(heli);
    if (lift) {
      const sq = lift.sq;
      if (!sq.leader || heli.dead) { this.lifts.delete(heli); this.lifts.delete(sq); return; }
      if (lift.stage === 'board') {
        if (sq.mounted) { heli.dropOnLand = true; heli.order(lift.lz[0], lift.lz[1]); lift.stage = 'fly'; }
        else if ((lift.t += 5) > 90) { this.lifts.delete(heli); this.lifts.delete(sq); for (const m of sq.members) m.boardTarget = null; if (heli.passengers.length) heli.unload(); }
      } else if (lift.stage === 'fly') {
        if (heli.state === 'parked' && !heli.passengers.length) { lift.stage = 'return'; sq.goal = null; this.lifts.delete(sq); heli.dropOnLand = true; heli.order(base.x + (Math.random() - 0.5) * 16, base.z + (Math.random() - 0.5) * 16); }
      } else if (heli.state === 'parked') this.lifts.delete(heli);
      return;
    }
    if (!attack || heli.state !== 'parked' || Math.hypot(heli.pos.x - base.x, heli.pos.z - base.z) > 50) return;
    if (this.lifts.size > 0) return;                                                     // one lift at a time: no piecemeal drops
    const far = Math.hypot(attack.x - base.x, attack.z - base.z);
    if (far < 350) return;
    const sq = squads.find(s => { const c = s.centroid(); return !s.mounted && Math.hypot(c.x - heli.pos.x, c.z - heli.pos.z) < 40 && Math.hypot(c.x - attack.x, c.z - attack.z) > 250 && !this.lifts.has(s); });
    if (!sq) return;
    let [lx, lz] = this.toward(attack, base, 70, 0);
    for (let k = 0; k < 3 && this.enemiesNear(lx, lz, 80).length; k++) [lx, lz] = this.toward({ x: lx, z: lz }, base, 50, 0);
    if (this.units.nav.vehicle.blocked(lx, lz) || this.enemiesNear(lx, lz, 80).length) return;   // only into a quiet landing zone
    sq.board(heli); sq.tag = 'lift'; this.lifts.set(heli, { sq, lz: [lx, lz], stage: 'board', t: 0 }); this.lifts.set(sq, heli);
  }

  // no objectives: hunt the enemy's main cluster (milestone 1 behaviour)
  skirmish(squads, vehicles, base) {
    const target = this.cluster(this.units.units.filter(u => !u.dead && !u.mounted && u.team !== this.team && !(u.spec.air && u.alt > 2)));
    squads.forEach((sq, i) => {
      if (i < 2 || !target) { if (!sq.busy) this.send(sq, base.x + (Math.random() - 0.5) * 16, base.z + (Math.random() - 0.5) * 16, 'home'); return; }
      const c = sq.centroid(), [x, z] = this.toward(c, target, 18); this.send(sq, x, z, 'hunt');
    });
    for (const v of vehicles) if (v.type === 'apc' && target && !v.dest) { const [x, z] = this.toward(v.pos, target, 34); v.order(x, z); }
  }
}
