import { RULES } from '../rules.js';
import { roadDist } from '../../core/math.js';

// the engineer's jobs each logistics order of a remote commander allows (a FOB falls back to sandbags when no kit or site is left)
const JOBS = { fob: ['clear', 'fob', 'sandbags'], sandbags: ['clear', 'sandbags'], traps: ['clear', 'traps'], hmg: ['clear', 'emplacement'], atgm: ['clear', 'emplacement'], mortar: ['clear', 'emplacement'], none: [] };
const GUNS = ['hmg', 'atgm', 'mortar'];   // FOB emplacements (game/fob.js)

// CPU commander v2: objective-aware manoeuvre, logistics (FOB one hop behind the
// front) and lifts (helicopters, trucks and APCs carry squads far from the fight).
export class Strategist {
  constructor(team, units, teams, match) { this.team = team; this.units = units; this.teams = teams; this.match = match; this.timer = 1 + Math.random() * 2; this.reflex = 0.5; this.plan = null; this.remote = null; this.utility = null; this.posture = 'balanced'; this.prefer = 'fob'; this.lift = true; this.lifts = new Map(); this.diff = match.difficulty || { plan: 5, attackShare: 0, logistics: true }; }

  // what our side knows of the enemy (fog of war, game/vision.js): the units it sees, and stand-ins where it last saw the
  // others. Everything below plans with these, never with the enemy's real positions.
  contacts() { return this.match.vision.contacts(this.team); }
  enemiesNear(x, z, r) { return this.contacts().filter(u => !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - x, u.pos.z - z) < r); }
  armourNear(x, z, r) { return this.contacts().some(e => (e.type === 'apc' || e.type === 'tank') && Math.hypot(e.pos.x - x, e.pos.z - z) < r); }
  friendsNear(x, z, r) { return this.units.units.filter(u => !u.dead && !u.mounted && u.team === this.team && Math.hypot(u.pos.x - x, u.pos.z - z) < r); }
  cluster(list) {
    let best = null, bestN = -1;
    for (const e of list) { let n = 0; for (const o of list) if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 20) n++; if (n > bestN) { bestN = n; best = e; } }
    return best ? { x: best.pos.x, z: best.pos.z } : null;
  }
  inZone(x, z, loc, k = 0.6) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * loc.r * k; return [loc.x + Math.cos(a) * d, loc.z + Math.sin(a) * d]; }
  // careful: a walk to hold, reserve, screen or grab a place (or home), which goes round known enemy fire (detour)
  send(sq, x, z, tag, zone = null, careful = false) {
    if (sq.busy && sq.tag === tag && sq.goal && Math.hypot(sq.goal[0] - x, sq.goal[1] - z) < 12) return;
    const c = sq.centroid(); if (!sq.busy && Math.hypot(c.x - x, c.z - z) < 10 && sq.tag === tag) return;
    sq.goal = [x, z]; sq.tag = tag; sq.zone = zone;
    const via = careful ? this.detour(sq, c, x, z) : (sq.route = null);
    if (via) sq.order(via.x, via.z); else sq.order(x, z);
  }
  // Known enemy fire, for routes: where we see enemies or last saw them, with the reach of their guns (a soldier in a group of
  // three or more 110 m, an APC 190, a tank 240, a machine-gun emplacement 150, an anti-tank one 220; the mortar is left out,
  // it reaches most of a lane and misses more than it hits), and an enemy-held place not seen in the last 30 s, its zone and
  // 150 m. Worked out once a tick.
  dangers() {
    const now = this.match.elapsed; if (this.dangerAt === now) return this.dangerList;
    const C = this.contacts().filter(u => !(u.spec.air && u.alt > 2)), list = [];
    for (const u of C) {
      const gun = u.type === 'emplacement' ? u.gun || (u.unit && u.unit.gun) : null;
      const r = u.type === 'apc' ? 190 : u.type === 'tank' ? 240 : gun === 'hmg' ? 150 : gun === 'atgm' ? 220
        : u.type === 'soldier' && C.filter(o => o.type === 'soldier' && Math.hypot(o.pos.x - u.pos.x, o.pos.z - u.pos.z) < 30).length >= 3 ? 110 : 0;
      if (r) list.push({ x: u.pos.x, z: u.pos.z, r });
    }
    const o = this.match.objectives, V = this.match.vision;
    if (o) for (const l of o.list) if (l.owner === 1 - this.team && V.ageAt(this.team, l.x, l.z) > 30) list.push({ x: l.x, z: l.z, r: l.r + 150 });
    this.dangerAt = now; return (this.dangerList = list);
  }
  // What we have seen at each place, once a second: the most enemies seen in or within 60 m of it at one look, and when. A
  // sighting outlives its ghosts (30 s), so a place that held ten men a minute ago does not read as empty because no one is
  // looking now; a bigger look replaces it, and so does any look once two minutes have passed (the digest's recent).
  note() {
    const o = this.match.objectives; if (!o) return;
    const now = this.match.elapsed, seen = this.seenAt || (this.seenAt = new Map());
    const C = this.contacts().filter(u => !u.ghost && !u.spec.structure && !(u.spec.air && u.alt > 2));
    for (const l of o.list) {
      const here = C.filter(u => Math.hypot(u.pos.x - l.x, u.pos.z - l.z) < l.r + 60), rec = seen.get(l);
      if (!here.length || (rec && here.length < rec.n && now - rec.t <= 120)) continue;
      const units = {}; for (const u of here) units[u.type] = (units[u.type] || 0) + 1;
      seen.set(l, { t: now, n: here.length, units });
    }
  }
  // the first danger a walk from (sx, sz) along pts comes within reach of, leaving out any its start or its end is inside
  // (leaving a fight, or walking into the one it was sent to, is the plan's business); null when the way is clear
  underFire(D, sx, sz, pts) {
    const [gx, gz] = pts[pts.length - 1];
    const near = (d, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz, t = L ? Math.max(0, Math.min(1, ((d.x - ax) * vx + (d.z - az) * vz) / L)) : 0; return Math.hypot(ax + vx * t - d.x, az + vz * t - d.z) < d.r; };
    for (const d of D) {
      if (Math.hypot(sx - d.x, sz - d.z) < d.r || Math.hypot(gx - d.x, gz - d.z) < d.r) continue;
      let px = sx, pz = sz; for (const [x, z] of pts) { if (near(d, px, pz, x, z)) return d; px = x; pz = z; }
    }
    return null;
  }
  pathLen(sx, sz, pts) { let L = 0, px = sx, pz = sz; for (const [x, z] of pts) { L += Math.hypot(x - px, z - pz); px = x; pz = z; } return L; }
  // A careful walk of 120 m or more whose way comes within reach of known enemy fire goes by one of our places or a neutral one
  // clear of it: the first (by the straight line) whose way in and way on are both clear, if that is no more than 2.5 times as
  // far; with none, it walks the direct way anyway. sq.route tells the digest: { via, m, past } (the place, the walk in metres,
  // the danger) or { past } (exposed). Returns the place to walk to first, or null to walk straight there. Kept for 8 s while
  // the squad stays put (the plan re-sends holds every few seconds); at the place, the next send walks on. The digest shows the
  // route while the squad is still walking under the order it was worked out for (tag).
  detour(sq, c, x, z) {
    const nav = this.units.nav && this.units.nav.foot, o = this.match.objectives; sq.route = null;
    if (!nav || !o || Math.hypot(x - c.x, z - c.z) < 120) return null;
    const now = this.match.elapsed, k = sq.routeMemo;
    if (k && now - k.t < 8 && Math.hypot(k.x - x, k.z - z) < 40 && Math.hypot(k.cx - c.x, k.cz - c.z) < 30 && !(k.via && Math.hypot(k.via.x - c.x, k.via.z - c.z) < 40)) { sq.route = k.route; return k.via; }
    const D = this.dangers(), direct = D.length ? nav.findPath(c.x, c.z, x, z) : null, hit = direct && this.underFire(D, c.x, c.z, direct);
    let via = null, route = null;
    if (hit) {
      route = { past: [hit.x, hit.z], tag: sq.tag };
      const L0 = this.pathLen(c.x, c.z, direct), far = (l) => Math.hypot(l.x - c.x, l.z - c.z) + Math.hypot(x - l.x, z - l.z);
      const ways = o.list.filter(l => l.owner !== 1 - this.team && Math.hypot(l.x - c.x, l.z - c.z) > 60 && Math.hypot(l.x - x, l.z - z) > 60 && far(l) < 2.5 * L0
        && !D.some(d => Math.hypot(l.x - d.x, l.z - d.z) < d.r)).sort((a, b) => far(a) - far(b)).slice(0, 3);
      for (const l of ways) {
        const p1 = nav.findPath(c.x, c.z, l.x, l.z), p2 = p1 && nav.findPath(l.x, l.z, x, z); if (!p2) continue;
        const L = this.pathLen(c.x, c.z, p1) + this.pathLen(l.x, l.z, p2);
        if (L > 2.5 * L0 || this.underFire(D, c.x, c.z, p1) || this.underFire(D, l.x, l.z, p2)) continue;
        via = { x: l.x, z: l.z }; route = { ...route, via: l.name, m: Math.round(L) }; break;
      }
    }
    sq.routeMemo = { x, z, cx: c.x, cz: c.z, t: now, via, route }; sq.route = route;
    return via;
  }
  // a squad mans a sandbag position (Unit.man: four firing slots) at the place it holds; once in, it stays
  manPost(sq, s, zone) {
    sq.zone = zone; sq.goal = [s.pos.x, s.pos.z];
    if (sq.tag === 'post' + s.id && sq.members.every(m => m.dead || (m.post && m.post.sb === s))) return;
    sq.tag = 'post' + s.id; sq.man(s);
  }
  toward(from, to, keep, jitter = 6) { const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, k = Math.max(0, d - keep) / d; return [from.x + dx * k + (Math.random() - 0.5) * jitter, from.z + dz * k + (Math.random() - 0.5) * jitter]; }

  tick(dt) {
    if (this.remote) this.remote.tick(dt);
    if ((this.reflex -= dt) <= 0) { this.reflex = 1; this.note(); this.caution(); }
    this.timer -= dt; if (this.timer > 0) return; this.timer = this.diff.plan + Math.random() * 2;
    const base = this.teams[this.team].base;
    // drop lifts whose carrier or troops are gone, so squads return to the pool
    // (lift keys are carriers, which are units with a type, and the squads riding them whole)
    for (const [k, v] of [...this.lifts]) if (k.type && (k.dead || (v.sq ? !v.sq.leader : v.riders.length && !k.passengers.length && v.riders.every(m => m.dead)))) this.endLift(k);
    const squads = this.units.squads.filter(s => s.team === this.team && s.leader && !this.lifts.has(s) && !s.members.some(m => m.building) && !(s.pinUntil > this.match.elapsed));   // pinned squads (in cover from armour, or stalking it) keep doing that
    const vehicles = this.units.units.filter(u => u.team === this.team && !u.dead && !u.squad && !u.spec.structure);
    const myFobs = this.units.units.filter(u => u.type === 'fob' && u.team === this.team && !u.dead).map(f => ({ x: f.pos.x, z: f.pos.z, r: 18, index: 'fob' + f.id }));
    const g = this.match.mode.goals(this.team, myFobs);
    // who sets the plan: a fresh remote commander, else the utility commander, else the mode's goals as they are
    const adviser = this.remote && this.remote.fresh ? this.remote : this.utility && this.utility.decide(squads, vehicles) ? this.utility : null;
    if (adviser) this.applyPlan(g, adviser);
    this.posture = g.posture || 'balanced'; this.prefer = g.logistics || 'fob'; this.lift = g.lift !== false;
    this.exact = adviser !== null && adviser === this.remote;   // a remote commander's logistics are orders; the others' are preferences
    if (g.hunt) return this.skirmish(squads, vehicles, base);
    const attack = g.attack, hold = g.hold, reserve = g.reserve || null;
    const enemyFob = this.contacts().find(u => u.type === 'fob' && (attack ? Math.hypot(u.pos.x - attack.x, u.pos.z - attack.z) < 160 : true));
    const logisticsSquad = this.logistics(squads, vehicles, g.fobAnchor, hold, attack);
    const allPosts = hold ? this.match.fobs.sandbagsOf(this.team).filter(s => Math.hypot(s.pos.x - hold.x, s.pos.z - hold.z) < this.postRange(hold)) : [];   // our sandbag positions at the place we hold, one squad each
    // a squad manning one (or on its way in) keeps it and sits out the job share; the other positions go to squads given the hold job
    const manned = squads.filter(sq => sq !== logisticsSquad && allPosts.some(s => sq.tag === 'post' + s.id && sq.members.some(m => m.post && m.post.sb === s)));
    for (const sq of manned) this.manPost(sq, allPosts.find(s => sq.tag === 'post' + s.id), hold);
    const posts = allPosts.filter(s => !manned.some(sq => sq.tag === 'post' + s.id)); let post = 0;
    const garrison = this.garrison(squads, [logisticsSquad, ...manned]);   // the squad crewing our FOB emplacements, if we have any
    const free = squads.filter(s => s !== logisticsSquad && !manned.includes(s) && s !== garrison);
    const o2 = this.match.objectives, byName = (n) => (o2 ? o2.list.find(l => l.name === n) : null) || null;
    // what each job means on the ground
    const attackWith = (sq) => {
      if (!attack) return holdAt(sq, hold);
      const foes = this.enemiesNear(attack.x, attack.z, attack.r + 20);
      if (foes.length > 1 && (attack.n ? attack.n[this.team] : 0) < 4) {   // stand off and shoot rather than walk into them, from behind something if an APC overlooks the spot
        const c = this.cluster(foes), cen = sq.centroid(); let [x, z] = this.toward(cen, c, 35);
        const apc = this.contacts().find(f => (f.type === 'apc' || f.type === 'tank') && Math.hypot(f.pos.x - x, f.pos.z - z) < 150 && this.match.combat.canSeePoint(f, x, z));
        if (apc) { const p = this.match.combat.coverPoint(x, z, apc.pos.x, apc.pos.z, 30, this.units.nav.foot); if (p) [x, z] = p; }
        this.send(sq, x, z, 'approach', attack);
      }
      else { const [x, z] = this.inZone(attack.x, attack.z, attack); this.send(sq, x, z, 'cap' + attack.index, attack); }
    };
    const holdAt = (sq, loc) => {
      if (!loc) return this.send(sq, base.x + (Math.random() - 0.5) * 20, base.z + (Math.random() - 0.5) * 20, 'home', null, true);
      if (loc === hold && post < posts.length) return this.manPost(sq, posts[post++], hold);
      const [x, z] = this.inZone(loc.x, loc.z, loc, 0.7); this.send(sq, x, z, 'hold' + loc.index, loc, true);
    };
    const reserveAt = (sq, loc) => { if (!loc) return holdAt(sq, hold); const [x, z] = this.inZone(loc.x, loc.z, loc, 0.6); this.send(sq, x, z, 'reserve' + loc.index, loc, true); };
    const screenAt = (sq, loc) => {   // an overwatch position 50 m out from our location towards the enemy, in cover if armour overlooks it
      if (!loc) return holdAt(sq, hold);
      const to = attack || this.teams[1 - this.team].base; let [x, z] = this.toward(loc, to, Math.max(0, Math.hypot(to.x - loc.x, to.z - loc.z) - 50), 8);
      const apc = this.contacts().find(f => (f.type === 'apc' || f.type === 'tank') && Math.hypot(f.pos.x - x, f.pos.z - z) < 150 && this.match.combat.canSeePoint(f, x, z));
      if (apc) { const p = this.match.combat.coverPoint(x, z, apc.pos.x, apc.pos.z, 30, this.units.nav.foot); if (p) [x, z] = p; }
      this.send(sq, x, z, 'screen' + loc.index, loc, true);
    };
    const raid = (sq) => { if (enemyFob) this.send(sq, enemyFob.pos.x, enemyFob.pos.z, 'raid'); else attackWith(sq); };
    const escort = (sq) => { const truck = vehicles.filter(v => v.supply && !v.dead).sort((p, q) => Math.hypot(p.pos.x - sq.centroid().x, p.pos.z - sq.centroid().z) - Math.hypot(q.pos.x - sq.centroid().x, q.pos.z - sq.centroid().z))[0]; if (!truck) return holdAt(sq, hold); this.send(sq, truck.pos.x + 4, truck.pos.z - 4, 'escort'); };
    // a remote commander may give squads jobs by id; the rest follow the attack share
    const grabbable = this.grabsFor(attack);   // places a squad may take on its own
    const roles = new Map(); if (adviser) for (const r of adviser.plan.squads || []) roles.set(r.id, r);
    const assigned = free.filter(sq => roles.has(sq.leader.label)), rest = free.filter(sq => !roles.has(sq.leader.label));
    // jobs a remote commander gave that are not carried out as given, with the reason (the digest tells it next time)
    const refused = this.refused = new Map(), elsewhere = (r, why) => refused.set(r.id, `${r.role}${r.at ? ' at ' + r.at : ''}: ${why}`);
    for (const sq of squads) sq.aaPost = null;   // set again below for the squads still on anti-air duty
    if (garrison && roles.has(garrison.leader.label)) elsewhere(roles.get(garrison.leader.label), 'it crews our FOB emplacements, so it stays on them');
    for (const sq of assigned) {
      const r = roles.get(sq.leader.label), at = r.at ? byName(r.at) : null, ours = at && at.owner === this.team ? at : null;
      if (r.at && !ours && (r.role === 'hold' || r.role === 'reserve' || r.role === 'screen' || r.role === 'antiair')) elsewhere(r, `not ours, so at ${hold ? hold.name : 'base'} instead`);
      if (r.role === 'raid' && !enemyFob) elsewhere(r, 'no enemy FOB known near the attack, so with the attack instead');
      if (r.role === 'assault') attackWith(sq);
      else if (r.role === 'hold') holdAt(sq, ours || hold);
      else if (r.role === 'reserve') reserveAt(sq, ours || reserve || hold);
      else if (r.role === 'screen') screenAt(sq, ours || hold);
      else if (r.role === 'antiair') {   // an anti-air post: stand at the place; skyward() sends it at helicopters within 180 m of it
        const post = ours || hold;
        if (!sq.members.some(m => !m.dead && m.kit === 'at')) { elsewhere(r, 'no launcher in the squad, so it holds instead'); holdAt(sq, post); }
        else if (!post) holdAt(sq, null);
        else { sq.aaPost = post; const [x, z] = this.inZone(post.x, post.z, post, 0.5); this.send(sq, x, z, 'aa' + post.index, post, true); }
      }
      else if (r.role === 'raid') raid(sq);
      else if (r.role === 'escort') escort(sq);
      else if (r.role === 'grab') { if (grabbable.includes(at)) { const [x, z] = this.inZone(at.x, at.z, at, 0.6); this.send(sq, x, z, 'grab' + at.index, at, true); } else { rest.push(sq); elsewhere(r, `${this.grabRefusal(at, attack) || 'not grabbable'}, so it follows attackShare`); } }   // a free place only: anywhere else (held, guarded, the attack itself) it would be one squad attacking alone, so it joins the attack share
      else attackWith(sq);
    }
    // free places: another place we can take that no enemy we know of holds or is near gets a squad of its own (the nearest
    // free one, or the one already on its way), so on a lattice with several ways forward the side spreads out instead of
    // sending everyone at one place; at least two squads stay for the attack and the holds
    for (const l of grabbable) {
      if (rest.length < 3) break;
      const key = 'grab' + l.index, d = (s) => { const c = s.centroid(); return Math.hypot(c.x - l.x, c.z - l.z); };
      const sq = rest.find(s => s.tag === key) || [...rest].sort((a, b) => d(a) - d(b))[0];
      rest.splice(rest.indexOf(sq), 1);
      const [x, z] = this.inZone(l.x, l.z, l, 0.6); this.send(sq, x, z, key, l, true);
    }
    // a remote commander's share is exact (0 sends none of these squads; the built-in planners keep a fifth at least), and an
    // engineer squad it left without a job, and without a logistics job, waits at the hold by the truck rather than attacking
    const idleEng = this.exact ? rest.find(sq => sq.engineer) : null; if (idleEng) { rest.splice(rest.indexOf(idleEng), 1); holdAt(idleEng, hold); }
    const share = this.exact ? g.attackShare : Math.min(0.95, Math.max(0.2, g.attackShare + this.diff.attackShare));
    const nAttack = attack ? Math.min(rest.length, Math.ceil((rest.length + manned.length) * share)) : 0;   // squads manning sandbags count as holders, not out of the attack
    rest.forEach((sq, i) => {
      if (enemyFob && i === 0 && attack && !assigned.length) { raid(sq); return; }   // one squad raids the nearest enemy FOB unless the commander hands out jobs itself
      if (i < nAttack && attack) attackWith(sq);
      else if (reserve && hold && i >= nAttack + Math.ceil((rest.length - nAttack) * 0.7)) reserveAt(sq, reserve);
      else holdAt(sq, hold);
    });
    this.placeRallies(squads);
    // Air Assault: one helicopter parks behind the place we're pushing for, as a spawn point
    if (this.percher && (this.percher.dead || (this.lifts.get(this.percher) || {}).stage !== 'perch')) this.percher = null;
    const front = attack || hold, perch = this.teams[this.team].doctrine.heliSpawn && front && Math.hypot(front.x - base.x, front.z - base.z) >= 300 ? this.perchAt(base, front) : null;
    // a remote commander may give armour jobs by id: hold keeps it at one of our places (the hold when the place is not ours),
    // anything else goes with the attack
    const vroles = new Map(); if (adviser) for (const r of adviser.plan.vehicles || []) vroles.set(r.id, r);
    for (const v of vehicles) {
      if (v.type === 'apc' || v.type === 'tank') {
        const job = vroles.get(v.label), at = job && job.role === 'hold' ? byName(job.at) : null, keep = job && job.role === 'hold' ? (at && at.owner === this.team ? at : hold) : null;
        if (keep && keep !== at) refused.set(v.label, `hold at ${job.at}: not ours, so at ${keep.name} instead`);
        const goal = keep || attack || hold; if (!goal) continue;
        if (v.type === 'apc' && (!keep || this.lifts.has(v)) && this.ride(v, free, attack, base)) continue;   // an APC leaving base takes a squad with it (one holding finishes a drop under way, then starts none)
        const standoff = v.type === 'tank' ? 90 : 70;   // the tank's gun reaches 200 m: it stands further off
        const foes = this.enemiesNear(goal.x, goal.z, goal.r + 40), c = this.cluster(foes);
        let x, z;
        // close to a 70 m standoff from the enemy cluster: outside rocket reach, well inside the cannon's; nearer than
        // that the turret does the work from where it stands, and caution() backs it off when something gets close
        if (c) { const dx = c.x - v.pos.x, dz = c.z - v.pos.z, d = Math.hypot(dx, dz) || 1; if (d < standoff + 15) continue; const k = (d - standoff) / d; x = v.pos.x + dx * k; z = v.pos.z + dz * k; }
        else [x, z] = this.inZone(goal.x, goal.z, goal, 0.8);
        // a place armour cannot get to (an island or a footbridge), or a standoff point in the river: it
        // supports from a spot it can reach on our bank, within its gun's reach of the place instead of stalling at the water
        if (!this.vehicleReaches(v, x, z)) { const p = this.supportSpot(v, goal, v.type === 'tank' ? 180 : 140); if (!p) continue; [x, z] = p; }
        if (v.dest && v.goal && Math.hypot(v.goal[0] - x, v.goal[1] - z) < 12) continue;
        v.goal = [x, z]; v.order(x, z);
      } else if (v.type === 'heli') this.air(v, attack, base, perch, hold);
      else if (v.type === 'truck' && !v.supply) { if (!this.ride(v, free, attack, base) && !v.dest && Math.hypot(v.pos.x - base.x, v.pos.z - base.z) > 40) v.order(base.x + (Math.random() - 0.5) * 24, base.z + (Math.random() - 0.5) * 24); }   // a troop truck between runs waits at base
    }
  }

  // An emplacement for the FOB nearest the front while it has room: a remote commander's gun when it asked for one, else
  // the first missing one a truck can pay for of a heavy machine gun, then an anti-tank launcher when enemy armour has
  // been about (a mortar otherwise), then the other; at a spot 14 to 22 m out from the FOB towards the enemy (flanks
  // next) that the FOB rules accept. Null when there is none.
  emplacementJob(sq, front, vehicles) {
    const F = this.match.fobs, R = RULES.emplacement, team = this.team; if (!front) return null;
    const fob = F.active(team).sort((a, b) => Math.hypot(a.pos.x - front.x, a.pos.z - front.z) - Math.hypot(b.pos.x - front.x, b.pos.z - front.z))[0];
    if (!fob || F.emplacementsAt(fob) >= R.perFob) return null;
    const have = F.emplacementsOf(team).filter(e => Math.hypot(e.pos.x - fob.pos.x, e.pos.z - fob.pos.z) <= R.fobRange).map(e => e.gun);
    const armour = (this.armourSeen || []).length > 0, order = this.exact && GUNS.includes(this.prefer) ? [this.prefer] : ['hmg', armour ? 'atgm' : 'mortar', armour ? 'mortar' : 'atgm'];
    const trucks = vehicles.filter(v => v.supply && !v.refilling).sort((a, b) => Math.hypot(a.pos.x - fob.pos.x, a.pos.z - fob.pos.z) - Math.hypot(b.pos.x - fob.pos.x, b.pos.z - fob.pos.z));
    let gun = null, truck = null;
    for (const g of order) { if (have.includes(g) && !this.exact) continue; truck = trucks.find(v => v.supplies >= R[g].supplyCost); if (truck) { gun = g; break; } }
    if (!gun) return null;
    const eb = this.teams[1 - team].base, face = Math.atan2(eb.x - fob.pos.x, eb.z - fob.pos.z);
    for (const r of [16, 22, 14]) for (const k of [0, 1, -1, 2, -2, 3, -3]) {
      const a = face + k * 0.45, x = fob.pos.x + Math.sin(a) * r, z = fob.pos.z + Math.cos(a) * r;
      if (!F.emplacementSite(team, x, z).reason) return { kind: 'emplacement', gun, sq, truck, x, z, t: 0 };
    }
    return null;
  }
  // The FOB emplacements' crew: one squad, a man to each gun and the rest standing by them, kept while it lives (a fresh
  // one, the free squad nearest the guns, engineers and anti-tank squads last, when it is gone). Out of the plan's jobs.
  garrison(squads, skip) {
    const guns = this.match.fobs.emplacementsOf(this.team); if (!guns.length) { this.garrisonSq = null; return null; }
    let sq = this.garrisonSq && this.garrisonSq.leader && squads.includes(this.garrisonSq) ? this.garrisonSq : null;
    if (!sq && this.garrisonSq && this.garrisonSq.leader) return this.garrisonSq;   // pinned for now (in cover, stalking): still ours
    if (!sq) {
      const c = guns[0].pos, at = (s) => s.members.some(m => !m.dead && m.kit === 'at'), d = (s) => Math.hypot(s.centroid().x - c.x, s.centroid().z - c.z);
      sq = squads.filter(s => !skip.includes(s) && !s.mounted && !this.lifts.has(s)).sort((a, b) => (a.engineer ? 2 : at(a) ? 1 : 0) - (b.engineer ? 2 : at(b) ? 1 : 0) || d(a) - d(b))[0];
      if (!sq) return null;
    }
    this.garrisonSq = sq; sq.tag = 'garrison';
    const crew = sq.members.filter(m => !m.dead && !m.mounted);
    for (const g of guns) if (!g.crewAt(0)) { const m = crew.find(x => !x.post && !x.building); if (!m) break; m.man(g); }
    const spare = crew.filter(m => !m.post && !m.building), by = guns[0];
    for (const m of spare) if (!m.dest && Math.hypot(m.pos.x - by.pos.x, m.pos.z - by.pos.z) > 10) { const [x, z] = by.postEntry(); m.order(x + (Math.random() - 0.5) * 6, z + (Math.random() - 0.5) * 6); }
    return sq;
  }

  // why grabsFor leaves place l out (the reason a remote commander's grab is refused), or null when it would take it
  grabRefusal(l, attack) {
    const o = this.match.objectives, t = this.team;
    if (!l) return 'no such place';
    if (l.owner === t) return 'already ours';
    if (l === attack) return 'it is the attack';
    if (!o.capturable(t, l)) return 'not next to a place we hold';
    if (l.contested) return 'contested';
    if (l.owner === 1 - t && this.match.vision.ageAt(t, l.x, l.z) > 30) return 'enemy-held and not seen empty in the last 30 s';
    if (this.enemiesNear(l.x, l.z, l.r + 60).some(u => !u.spec.structure && (!u.ghost || u.age < 15))) return 'enemies seen in or near it';
    if (this.armourNear(l.x, l.z, 120)) return 'enemy armour near it';
    return null;
  }

  // Places worth a squad of their own: ones we can take besides the attack target, with no enemy we know of within 60 m of the
  // zone (a sighting older than 15 s does not count), no enemy armour within 120 m, not contested, and not held by the enemy
  // unless we have seen it in the last 30 s (an unseen place they hold may well be defended). Neutral ones first, then nearest.
  grabsFor(attack) {
    const o = this.match.objectives; if (!o) return [];
    const t = this.team, V = this.match.vision, base = this.teams[t].base;
    return o.list.filter(l => l !== attack && l.owner !== t && o.capturable(t, l) && !l.contested && !(l.owner === 1 - t && V.ageAt(t, l.x, l.z) > 30)
      && !this.enemiesNear(l.x, l.z, l.r + 60).some(u => !u.spec.structure && (!u.ghost || u.age < 15)) && !this.armourNear(l.x, l.z, 120))
      .sort((a, b) => (a.owner === -1 ? 0 : 1) - (b.owner === -1 ? 0 : 1) || Math.hypot(a.x - base.x, a.z - base.z) - Math.hypot(b.x - base.x, b.z - base.z));
  }

  // Helicopters in the air: for each enemy helicopter within 150 m of one of our squads (or 180 m of an anti-air post a
  // remote commander set), the nearest anti-tank squad not busy with armour or another helicopter (a posted one first),
  // within 300 m, closes until it is inside 75 m, then stands and fires. While it does, its launchers are braced
  // (squad.aa: twice the chance of a hit on a helicopter in the air, combat.js); helicopters fly over cover, so no sight test.
  skyward() {
    const mine = this.units.squads.filter(sq => sq.team === this.team);
    for (const sq of mine) sq.aa = false;
    const helis = this.contacts().filter(u => u.spec && u.spec.air && u.alt > 2 && !u.dead && (!u.ghost || u.age < 4)); if (!helis.length) return;
    const now = this.match.elapsed, at = (sq) => sq.members.some(m => !m.dead && m.kit === 'at');
    const ours = mine.filter(sq => sq.leader && !sq.mounted && !sq.posted && !this.lifts.has(sq) && !sq.members.some(m => m.building));
    const far = (sq, p) => { const c = sq.centroid(); return Math.hypot(c.x - p.x, c.z - p.z); };
    for (const h of helis) {
      const real = h.unit || h;
      // a threat while it is near one of our squads or over an anti-air post; a squad that went after this helicopter
      // counts only if the place it belongs (its zone) is near it too, so the hunter alone does not keep the hunt going.
      // A posted squad answers only helicopters over its own place.
      const strayed = (sq) => sq.skyTarget === real && !(sq.zone && Math.hypot(sq.zone.x - h.pos.x, sq.zone.z - h.pos.z) < 150);
      const guards = (sq) => sq.aaPost && Math.hypot(sq.aaPost.x - h.pos.x, sq.aaPost.z - h.pos.z) < 180;
      if (!ours.some(sq => (!strayed(sq) && far(sq, h.pos) < 150) || guards(sq))) continue;
      let best = null, bd = Infinity;
      for (const sq of ours) {
        if (!at(sq) || (sq.aaPost && !guards(sq)) || sq.tag === 'stalk' || sq.tag === 'hunt' || (sq.tag === 'skyward' && sq.skyTarget && sq.skyTarget !== real && !sq.skyTarget.dead)) continue;   // armour comes first
        const d = far(sq, h.pos) - (sq.aaPost ? 100 : 0); if (d < 300 && d < bd) { bd = d; best = sq; }
      }
      if (!best) continue;
      const d = far(best, h.pos); best.skyTarget = real; best.aa = true; best.pinUntil = now + 6;
      if (d < 75) this.halt(best, 'skyward'); else { const [x, z] = this.toward(best.centroid(), h.pos, 55); this.send(best, x, z, 'skyward', best.zone); }
    }
  }

  // Rally points: a squad that has reached the area it was sent to (within 160 m of its zone, or dug in hiding from or hunting
  // armour), clear of enemies, more than 200 m from home, drops a rally when it has none within 70 m, or its rally has enemy
  // armour on it (canPlace keeps the new one 100 m from armour), and the cooldown allows.
  placeRallies(squads) {
    const R = this.match.rallies; if (!R) return;
    const base = this.teams[this.team].base;
    for (const sq of squads) {
      if (!sq.leader || sq.mounted || R.cooldownLeft(sq) > 0) continue;
      const c = sq.centroid(), zone = sq.zone;
      if (Math.hypot(c.x - base.x, c.z - base.z) < 200) continue;
      const there = zone ? Math.hypot(c.x - zone.x, c.z - zone.z) < 160 : ['cover', 'stalk', 'hunt'].includes(sq.tag) || (sq.tag || '').startsWith('screen');
      if (!there) continue;
      const r = R.of(sq); if (r && !R.covered(r) && Math.hypot(r.pos.x - c.x, r.pos.z - c.z) < 70) continue;
      if (this.enemiesNear(c.x, c.z, 40).length) continue;
      if (R.canPlace(sq).ok) R.place(sq);
    }
  }

  // A remote commander's plan overrides the mode's goals wherever it names something legal: the attack
  // must be the next capturable location in the lattice, holds must be ours; the rest are knobs.
  applyPlan(g, remote) {
    const p = remote.plan, o = this.match.objectives; if (!o) return;
    const byName = (n) => o.list.find(l => l.name === n) || null;
    const target = p.attack ? byName(p.attack) : null;
    // a remote commander's target taken since it planned: hold it until the next plan (asked for at once on the capture)
    // rather than following the mode's next goal in the seconds the answer takes
    const taken = remote === this.remote && target && target.owner === this.team ? target : null;
    if (target && target.owner !== this.team && o.capturable(this.team, target)) { g.attack = target; g.fobAnchor = o.front(this.team, target) || g.fobAnchor; }   // the FOB goes behind the place we push from
    else if (taken || (!p.attack && p.hold.length)) g.attack = null;
    const h = p.hold.map(byName).filter(l => l && l.owner === this.team); if (h.length) g.hold = h[0];
    if (taken) g.hold = taken;
    g.attackShare = p.attackShare; g.posture = p.posture; g.logistics = p.logistics; g.lift = p.lift;
    // a wait holds the attack back: everyone gathers at the staging location until the condition holds (two minutes at most)
    if (p.waitFor && g.attack) {
      const waited = this.match.elapsed - (remote.waitSince ?? remote.planAt), met = remote.waitMet || this.waitMet(p.waitFor, waited); remote.waitMet = met;   // once met, a wait stays met until it changes, so the attack doesn't flicker as squads leave the staging point
      if (!met && waited < 120) { const stage = byName(p.waitFor.at); if (stage && stage.owner === this.team) g.hold = stage; g.attack = null; }
    }
  }
  waitMet(w, waited) {
    const o = this.match.objectives, loc = w.at ? o.list.find(l => l.name === w.at) : null;
    if (w.kind === 'seconds') return waited >= w.count;
    if (w.kind === 'apcAlive') return this.units.units.some(u => u.team === this.team && (u.type === 'apc' || u.type === 'tank') && !u.dead);
    if (!loc) return true;
    if (w.kind === 'squadsAt') return this.units.squads.filter(s => s.team === this.team && s.leader && !s.mounted && Math.hypot(s.centroid().x - loc.x, s.centroid().z - loc.z) < loc.r + 20).length >= w.count;
    if (w.kind === 'enemyBelow') return this.match.enemiesNear(this.team, loc.x, loc.z, loc.r + 25) < w.count;
    return true;
  }

  // Caution, once a second. Armour first: a squad an enemy APC can see within 150 m stalks it to rocket range if
  // it carries launchers and the APC has no more than a squad's worth of infantry and no other armour round it (escorted), otherwise it moves
  // behind the nearest building or hill out of the APC's sight (or falls back if there is none) and stays there while the
  // APC is about. Then infantry: a squad with an enemy inside 22 m
  // falls back unless it stands in the zone it was sent to take or hold, or clearly has the numbers. Squads manning
  // sandbags stay put through all of it. An APC with an enemy inside 50 m backs off to 70 m.
  halt(sq, tag) { for (const m of sq.members) if (!m.dead) { m.dest = null; m.target = null; m.path = null; } sq.tag = tag; sq.goal = null; }
  caution() {
    const enemies = this.contacts().filter(u => !u.spec.structure && !(u.spec.air && u.alt > 2));
    // where we have seen enemy armour in the last two minutes, while it lives (trapSpot lays traps where it has been; a
    // vehicle that respawns is a new unit, seen afresh)
    const now0 = this.match.elapsed; this.armourSeen = (this.armourSeen || []).filter(s => now0 - s.t < 120 && !s.u.dead);
    for (const u of enemies) if (!u.ghost && (u.type === 'apc' || u.type === 'tank')) this.armourSeen.push({ x: u.pos.x, z: u.pos.z, t: now0, u });
    this.skyward();
    if (!enemies.length) return;
    const C = this.match.combat, now = this.match.elapsed, apcs = enemies.filter(e => e.type === 'apc' || e.type === 'tank');   // armour
    const k = this.posture === 'aggressive' ? 0.6 : this.posture === 'cautious' ? 1.3 : 1;   // posture scales every distance below
    const hideMax = this.posture === 'aggressive' ? 12 : this.posture === 'cautious' ? 45 : 25;   // seconds a squad stays hidden from armour that can no longer see it
    const nearest = (x, z) => { let b = null, bd = Infinity; for (const e of enemies) { const d = Math.hypot(e.pos.x - x, e.pos.z - z); if (d < bd) { bd = d; b = e; } } return [b, bd]; };
    const away = (x, z, e, dist) => { const dx = x - e.pos.x, dz = z - e.pos.z, d = Math.hypot(dx, dz) || 1; return [x + dx / d * dist, z + dz / d * dist]; };
    // armour with more than a squad of infantry within 50 m of it, or another APC or tank within 100 m (whose gun covers the
    // ground a launcher team would cross): going for it would walk into all of them
    const escorted = (v) => { let n = 0; for (const e of enemies) { const d = Math.hypot(e.pos.x - v.pos.x, e.pos.z - v.pos.z); if ((e.type === 'soldier' && d < 50 && ++n > 4) || (e !== v && (e.type === 'apc' || e.type === 'tank') && d < 100)) return true; } return false; };
    for (const sq of this.units.squads) {
      if (sq.team !== this.team || !sq.leader || sq.mounted || this.lifts.has(sq) || sq.members.some(m => m.building)) continue;
      if (sq.posted) continue;                                                                               // manning sandbags: they stay, armour or not
      const c = sq.centroid();
      let apc = null, ad = 1e9; for (const v of apcs) { const d = Math.hypot(v.pos.x - c.x, v.pos.z - c.z); if (d < 150 && d < ad && C.canSeePoint(v, c.x, c.z)) { apc = v; ad = d; } }
      if (apc) {
        if (sq.members.some(m => !m.dead && m.kit === 'at') && !escorted(apc)) { if (ad > 72) { const [x, z] = this.toward(c, apc.pos, 60); this.send(sq, x, z, 'stalk', sq.zone); } else this.halt(sq, 'stalk'); }
        else if (sq.tag !== 'cover' || (!sq.busy && (sq.seen = (sq.seen || 0) + 1) >= 2)) {   // not yet hiding, or settled in cover and still seen twice running: pick cover again
          const p = C.coverPoint(c.x, c.z, apc.pos.x, apc.pos.z, 26, this.units.nav.foot); sq.seen = 0;
          if (p) { if (sq.tag !== 'cover') sq.hideSince = now; sq.goal = p; sq.tag = 'cover'; sq.order(p[0], p[1]); } else { const [x, z] = away(c.x, c.z, apc, 30); sq.goal = [x, z]; sq.tag = 'back'; sq.order(x, z); }
        }
        sq.pinUntil = now + 6; continue;
      }
      sq.seen = 0;
      // heads down while it is about, but not for ever: after hideMax the squad rejoins the plan (and hides again if it is seen)
      if ((sq.tag === 'stalk' || (sq.tag === 'cover' && now - (sq.hideSince || 0) < hideMax)) && apcs.some(v => Math.hypot(v.pos.x - c.x, v.pos.z - c.z) < 150)) { sq.pinUntil = now + 6; continue; }
      const [e, d] = nearest(c.x, c.z); if (!e || d > 22 * k) continue;
      if (sq.zone && Math.hypot(c.x - sq.zone.x, c.z - sq.zone.z) < sq.zone.r) continue;                     // stand and fight for the zone
      if (sq.tag && sq.tag.startsWith('post')) continue;                                                     // dug in: stay
      if (this.friendsNear(c.x, c.z, 25).length >= this.enemiesNear(c.x, c.z, 25).length * 2) continue;    // we clearly have the numbers
      const [x, z] = away(c.x, c.z, e, 28); sq.goal = [x, z]; sq.tag = 'back'; sq.order(x, z);
    }
    // armour that threatens our squads is hunted: for each enemy APC within 150 m of one of our squads without launchers, the
    // nearest anti-tank squad within 300 m not already on another APC closes in until it can see it inside rocket range, then
    // stops and fires. Escorted armour is left to the plan: the hunters would meet its infantry first.
    const ours = this.units.squads.filter(sq => sq.team === this.team && sq.leader && !sq.mounted && !sq.posted && !this.lifts.has(sq) && !sq.members.some(m => m.building));
    const hasAT = (sq) => sq.members.some(m => !m.dead && m.kit === 'at');
    for (const apc of apcs) {
      if (escorted(apc) || !ours.some(sq => !hasAT(sq) && Math.hypot(sq.centroid().x - apc.pos.x, sq.centroid().z - apc.pos.z) < 150)) continue;
      const real = apc.unit || apc;   // a last-known position stands in for its vehicle: hunt the vehicle, not the stand-in
      let best = null, bd = 300;
      for (const sq of ours) {
        if (!hasAT(sq) || sq.tag === 'stalk' || (sq.huntTarget && sq.huntTarget !== real && !sq.huntTarget.dead)) continue;
        const c = sq.centroid(), d = Math.hypot(c.x - apc.pos.x, c.z - apc.pos.z); if (d < bd) { bd = d; best = sq; }
      }
      if (!best) continue;
      best.huntTarget = real;
      if (bd < 80 && C.canSeePoint(best.leader, apc.pos.x, apc.pos.z)) this.halt(best, 'hunt');
      else { const [x, z] = this.toward(best.centroid(), apc.pos, 45); this.send(best, x, z, 'hunt', best.zone); }
      best.pinUntil = now + 6;
    }
    for (const v of this.units.units) {
      if (v.team !== this.team || v.dead || (v.type !== 'apc' && v.type !== 'tank')) continue;
      const keep = v.type === 'tank' ? 90 : 70;
      const [e, d] = nearest(v.pos.x, v.pos.z); if (!e || d > 50 * k) continue;
      const [x, z] = away(v.pos.x, v.pos.z, e, keep * k - d); v.goal = [x, z]; v.order(x, z);
    }
    // soft vehicles: the perched helicopter takes off when it is hit or enemies or armour come close, and a supply truck
    // with enemy armour within 120 m (or enemies within 40 m) drives home, dropping its job; a lost truck costs 16 tickets
    const base = this.teams[this.team].base, home = (v) => v.order(base.x + (Math.random() - 0.5) * 24, base.z + (Math.random() - 0.5) * 24);
    const pl = this.percher && this.lifts.get(this.percher);
    if (pl && pl.stage === 'perch') {
      const h = this.percher, hit = h.hp < (pl.hp ?? h.hp); pl.hp = h.hp;
      if (hit || this.enemiesNear(h.pos.x, h.pos.z, 70).length || this.armourNear(h.pos.x, h.pos.z, 160)) { this.endLift(h); this.percher = null; this.heliHome(h, base); }
    }
    // a fire-support helicopter goes home to the ground crew below 70% (one rocket does it), and moves off when an APC can
    // reach it or more than one launcher is about: to another firing point, or home if there is none
    for (const [h, l] of [...this.lifts]) {
      if (!h.type || l.stage !== 'gun') continue;
      if (h.hp < h.maxHp * 0.7) { this.endLift(h); this.heliHome(h, base); continue; }
      if (this.exposed(h.pos.x, h.pos.z) <= 1 && this.exposed(l.at[0], l.at[1]) <= 1) continue;
      const spot = this.gunSpot(l.places, base);
      if (spot) { l.at = spot; h.order(spot[0], spot[1]); } else { this.endLift(h); this.heliHome(h, base); }
    }
    for (const v of this.units.units) {
      if (v.team !== this.team || v.dead || !v.supply || Math.hypot(v.pos.x - base.x, v.pos.z - base.z) < 80) continue;
      if (!this.armourNear(v.pos.x, v.pos.z, 120) && !this.enemiesNear(v.pos.x, v.pos.z, 40).length) continue;
      if (this.plan && this.plan.truck === v) this.plan = null;
      if (!v.dest || Math.hypot(v.dest.x - base.x, v.dest.z - base.z) > 30) home(v);
    }
  }

  // Logistics: with kits left, a supply truck and an engineer squad, build a FOB one hop
  // behind the front (towards our base) and keep the pair together until it is up; without a kit
  // (or with no FOB site just now) dig sandbag positions at the place we hold (digSpot). Before either, clear enemy tank
  // traps we have seen near the place we push for or hold; after the FOB, lay traps at a choke on our side (trapSpot).
  // A remote commander's choice is an order (this.exact): only the jobs in JOBS for it, so sandbags never turn into traps
  // half a map away, and traps are laid when it asks whether or not enemy armour has been seen.
  logistics(squads, vehicles, anchor, hold = null, attack = null) {
    const fobs = this.match.fobs, team = this.teams[this.team], base = team.base, want = (kind) => !this.exact || (JOBS[this.prefer] || JOBS.fob).includes(kind);
    // under a remote commander a sandbag job follows its first hold: one given out for the place it held before is dropped
    const stale = (p) => this.exact && ((p.kind === 'sandbags' && hold && Math.hypot(p.x - hold.x, p.z - hold.z) > this.postRange(hold)) || (p.kind === 'emplacement' && GUNS.includes(this.prefer) && p.gun !== this.prefer));
    if (this.plan && (this.plan.sq.engineer === null || (this.plan.truck && this.plan.truck.dead) || (this.plan.traps && this.plan.traps.dead) || this.plan.done || !want(this.plan.kind) || stale(this.plan))) this.plan = null;
    // a supply truck too low for any job (sandbags cost least) drives home and refills to full before it takes another: one
    // that ran dry used to stand where it was for the rest of the match
    for (const v of vehicles) {
      if (!v.supply) continue;
      if (v.refilling && v.supplies >= RULES.fob.truckSupplies) v.refilling = false;
      if (v.supplies >= RULES.sandbags.supplyCost || (this.plan && this.plan.truck === v)) continue;
      v.refilling = true;
      if (Math.hypot(v.pos.x - base.x, v.pos.z - base.z) > base.r - 6 && (!v.dest || Math.hypot(v.dest.x - base.x, v.dest.z - base.z) > 30)) v.order(base.x + (Math.random() - 0.5) * 24, base.z + (Math.random() - 0.5) * 24);
    }
    const stocked = (v, cost) => v.supply && !v.refilling && v.supplies >= cost;
    if (!this.plan) {
      if (!this.diff.logistics || this.prefer === 'none') return null;
      const sq = squads.find(s => s.engineer); if (!sq) return null;
      // traps in the way: the enemy's that we have seen near the place we push for or hold, and our own between the place we
      // push from and the place we push for, or near it (laid when the fight was elsewhere). The vehicle route cannot show
      // our own: it is worked out with them in place, so it already goes round them, the long way.
      const goal = attack || hold, from = attack && this.match.objectives.front(this.team, attack);
      const between = (u) => attack && (Math.hypot(u.pos.x - attack.x, u.pos.z - attack.z) < 120 || (from && this.onRoute([[from.x, from.z], [attack.x, attack.z]], u.pos.x, u.pos.z, 40)));
      const block = (goal && this.contacts().find(u => u.type === 'traps' && Math.hypot(u.pos.x - goal.x, u.pos.z - goal.z) < 180)) || fobs.trapsOf(this.team).find(between);
      if (block) {
        this.plan = { kind: 'clear', sq, truck: null, traps: block, x: block.pos.x, z: block.pos.z, t: 0 };   // no truck needed
        if (block.team === this.team) (this.chokeRest || (this.chokeRest = new Map())).set(Math.round(block.pos.x) + ',' + Math.round(block.pos.z), this.match.elapsed + 300);   // we need it open: not there again for five minutes
      }
      const truckTo = (at) => vehicles.filter(v => stocked(v, RULES.fob.supplyCost)).sort((a, b) => Math.hypot(a.pos.x - at.x, a.pos.z - at.z) - Math.hypot(b.pos.x - at.x, b.pos.z - at.z))[0];
      if (!this.plan && anchor && fobs.kitsLeft(this.team) > 0 && this.prefer !== 'sandbags' && want('fob')) {
        const truck = truckTo(anchor), [x, z] = this.toward(anchor, base, Math.hypot(anchor.x - base.x, anchor.z - base.z) - 45, 0);   // 45 m behind the location, towards home
        if (truck && !this.units.nav.vehicle.blocked(x, z) && !this.armourNear(x, z, 150) && !fobs.active(this.team).some(f => Math.hypot(f.pos.x - x, f.pos.z - z) < RULES.fob.minSpacing)) this.plan = { kind: 'fob', sq, truck, x, z, t: 0 };
      }
      if (!this.plan && want('emplacement')) { const job = this.emplacementJob(sq, attack || hold, vehicles); if (job) this.plan = job; }   // after the FOB, its guns
      if (!this.plan && want('traps')) {   // tank traps at a choke on our side, when the enemy fields armour (or when ordered)
        const spot = this.trapSpot(attack, this.exact), truck = spot && vehicles.filter(v => stocked(v, RULES.traps.supplyCost)).sort((a, b) => Math.hypot(a.pos.x - spot[0], a.pos.z - spot[1]) - Math.hypot(b.pos.x - spot[0], b.pos.z - spot[1]))[0];
        if (truck) { this.plan = { kind: 'traps', sq, truck, x: spot[0], z: spot[1], t: 0 }; this.trapsNext = this.match.elapsed + 120; }
      }
      if (!this.plan && hold && fobs.sandbagsOf(this.team).length < RULES.sandbags.max && want('sandbags')) {   // no kit, or no FOB site just now: dig in at the place we hold
        const spot = this.digSpot(hold); if (!spot) return null;
        const truck = vehicles.filter(v => stocked(v, RULES.sandbags.supplyCost)).sort((a, b) => Math.hypot(a.pos.x - hold.x, a.pos.z - hold.z) - Math.hypot(b.pos.x - hold.x, b.pos.z - hold.z))[0]; if (!truck) return null;
        this.plan = { kind: 'sandbags', sq, truck, x: spot[0], z: spot[1], t: 0 };
      }
      if (!this.plan) return null;
    }
    const p = this.plan; p.t += 5;
    if (p.t > 240) { this.plan = null; return null; }                                   // give up on stalled plans
    const eng = p.sq.engineer, near = (u, r) => Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r;
    if (p.truck && !near(p.truck, 8) && !p.truck.dest) p.truck.order(p.x + 4, p.z + 4);
    // the squad to the spot, whatever it was doing (a squad on the move used to keep its old orders), and the engineer himself
    // onto it: his squad standing within 10 m of it counts as there for send()
    if (!near(eng, 4)) this.send(p.sq, p.x, p.z, 'fob');
    if (!near(eng, 4) && !eng.building && (!eng.dest || Math.hypot(eng.dest.x - p.x, eng.dest.z - p.z) > 3)) eng.order(p.x, p.z);
    if (near(eng, 4) && (!p.truck || near(p.truck, RULES.fob.buildRange)) && !eng.building) {
      const r = p.kind === 'sandbags' ? fobs.startSandbags(eng) : p.kind === 'traps' ? fobs.startTraps(eng) : p.kind === 'clear' ? fobs.startClear(eng) : p.kind === 'emplacement' ? fobs.startEmplacement(eng, p.gun, [p.x, p.z]) : fobs.startBuild(eng);
      if (r.ok) p.done = true; else if (p.kind !== 'fob') this.plan = null;
    }
    return p.sq;
  }

  // Where to dig in at a place we hold: up to three positions facing the enemy's side, one out in front of the middle and one on
  // each flank (scaled to the place; further spots stand in for any the road or a building takes), each 12 m or more apart; never on the road (the convoys use it), nor with enemy
  // armour within 150 m or enemies within 40 m (the supply truck has to stand beside the engineer). Null when there is none.
  // The spot keeps 4 m more than the build rule's road clearance: the engineer starts digging within 4 m of it.
  // Where to lay tank traps: a choke the map lists (map.chokes: bridge ends, ford banks) on our side (nearer a place we hold
  // than any place they hold, within 400 m of ours), where live enemy armour has come within 200 m of it in the last two minutes
  // (armour seen at the bridge says nothing about a ford 500 m off, and armour since destroyed threatens nothing), clear of other traps, of
  // enemies and of their armour, and not within 30 m of our own vehicles' way from home to the place we push for (traps
  // stop our vehicles too), nor where we cleared our own in the last five minutes. Two rows at most, one job every two
  // minutes. Null when there is none. ordered: a remote commander asked for traps, so no armour need have been seen.
  trapSpot(attack, ordered = false) {
    const map = this.match.world.map, o = this.match.objectives, t = this.team, fobs = this.match.fobs;
    if (!map || !map.chokes || !o || this.match.elapsed < (this.trapsNext || 0) || fobs.trapsOf(t).length >= 2) return null;
    const armour = this.armourSeen || []; if (!armour.length && !ordered) return null;
    const ours = o.list.filter(l => l.owner === t), theirs = o.list.filter(l => l.owner === 1 - t); if (!ours.length) return null;
    const rest = this.chokeRest || new Map(), resting = ([x, z]) => [...rest].some(([k, until]) => { const [rx, rz] = k.split(',').map(Number); return until > this.match.elapsed && Math.hypot(rx - x, rz - z) < 20; });
    const far = ([x, z], ls) => Math.min(Infinity, ...ls.map(l => Math.hypot(x - l.x, z - l.z)));
    const route = this.routeTo(attack);
    return map.chokes.filter(c => far(c, ours) < 400 && far(c, ours) < far(c, theirs) && (ordered || armour.some(v => Math.hypot(v.x - c[0], v.z - c[1]) < 200)) && !resting(c)
      && !fobs.trapsAt(c[0], c[1], RULES.traps.minSpacing) && !this.enemiesNear(c[0], c[1], 50).length && !this.armourNear(c[0], c[1], 150) && !this.onRoute(route, c[0], c[1], 30))
      .sort((a, b) => far(a, ours) - far(b, ours))[0] || null;
  }
  // our vehicles' way from home to a place (the vehicle grid's route, worked out at most every 20 s for the same place) as a
  // list of points from the base; and whether a point lies within r of a list of points
  routeTo(l) {
    if (!l) return null; const now = this.match.elapsed, c = this.routeCache;
    if (c && c.name === l.name && now - c.at < 20) return c.pts;
    const b = this.teams[this.team].base, p = this.units.nav.vehicle.findPath(b.x, b.z, l.x, l.z);
    this.routeCache = { name: l.name, at: now, pts: p ? [[b.x, b.z], ...p] : null }; return this.routeCache.pts;
  }
  onRoute(pts, x, z, r) {
    if (!pts) return false;
    for (let i = 1; i < pts.length; i++) { const [px, pz] = pts[i - 1], dx = pts[i][0] - px, dz = pts[i][1] - pz, k = Math.max(0, Math.min(1, ((x - px) * dx + (z - pz) * dz) / (dx * dx + dz * dz || 1))); if (Math.hypot(x - px - dx * k, z - pz - dz * k) < r) return true; }
    return false;
  }

  // How far from a place its sandbag positions stand: out to the map's own spots for it, or 12 m past the zone.
  postRange(loc) { return loc.defend ? Math.max(...loc.defend.map(([x, z]) => Math.hypot(x - loc.x, z - loc.z))) + 8 : loc.r + 12; }
  digSpot(hold) {
    const mine = this.match.fobs.sandbagsOf(this.team), N = this.units.nav.foot;
    if (mine.filter(s => Math.hypot(s.pos.x - hold.x, s.pos.z - hold.z) < this.postRange(hold)).length >= 3) return null;
    const eb = this.teams[1 - this.team].base, d = Math.hypot(eb.x - hold.x, eb.z - hold.z) || 1, ex = (eb.x - hold.x) / d, ez = (eb.z - hold.z) / d, k = Math.max(0.75, Math.min(1.2, hold.r / 26));
    // a map may give a place its own positions (map.locations[].defend, covering its approaches): the ones facing the
    // enemy's side first, flanks next, never the ones behind; the same tests as below, but a spot is used where it is
    if (hold.defend) {
      const face = ([x, z]) => ((x - hold.x) * ex + (z - hold.z) * ez) / (Math.hypot(x - hold.x, z - hold.z) || 1);
      for (const [x, z] of hold.defend.filter(p => face(p) > -0.35).sort((a, b) => face(b) - face(a))) {
        if (N.blocked(x, z) || N.inPocket(x, z)) continue;
        if (mine.some(s => Math.hypot(s.pos.x - x, s.pos.z - z) < RULES.sandbags.minSpacing + 1) || roadDist(this.match.world.map, x, z) < RULES.sandbags.roadClear + 4 || this.armourNear(x, z, 150) || this.enemiesNear(x, z, 40).length) continue;
        return [x, z];
      }
      return null;
    }
    for (const [a, c] of [[10, 0], [6, 14], [6, -14], [16, 7], [16, -7], [-2, 18], [-2, -18]]) {   // the first three are the plan; the rest stand in where the road or a building takes one
      let x = hold.x + (ex * a + ez * c) * k, z = hold.z + (ez * a - ex * c) * k;
      if (N.blocked(x, z)) { const cell = N.nearest(N.cellOf(x), N.cellOf(z), 6); if (!cell) continue; x = N.world(cell[0]); z = N.world(cell[1]); }
      if (N.inPocket(x, z)) continue;                                                   // somewhere the engineer can walk to
      if (mine.some(s => Math.hypot(s.pos.x - x, s.pos.z - z) < RULES.sandbags.minSpacing + 1) || roadDist(this.match.world.map, x, z) < RULES.sandbags.roadClear + 4 || this.armourNear(x, z, 150) || this.enemiesNear(x, z, 40).length) continue;
      return [x, z];
    }
    return null;
  }
  endLift(c) {
    const l = this.lifts.get(c); if (!l) return; this.lifts.delete(c);
    for (const s of l.sq ? [l.sq] : l.squads) { this.lifts.delete(s); s.goal = null; }
    for (const m of l.sq ? l.sq.members : l.riders) if (m.boardTarget === c) m.boardTarget = null;
  }
  // a point `keep` metres short of `at` on our side, stepped back 50 m at a time while enemies are within r (or, with
  // armour set, enemy armour within that distance); null when no quiet, open spot is left
  quietSpot(base, at, keep, r, armour = 0) {
    const hot = (x, z) => this.enemiesNear(x, z, r).length || (armour && this.armourNear(x, z, armour));
    let [x, z] = this.toward(base, at, keep, 0);
    for (let k = 0; k < 3 && hot(x, z); k++) [x, z] = this.toward(base, { x, z }, 50, 0);
    return this.units.nav.vehicle.blocked(x, z) || hot(x, z) ? null : [x, z];
  }
  perchAt(base, at) { return this.quietSpot(base, at, 130, 100, 180); }
  // can vehicle v drive to (x, z)? Both ends on the same patch of the vehicle grid's open ground (nav.js regions: an island, or
  // water under a footbridge, is not)
  vehicleReaches(v, x, z) {
    const nav = this.units.nav.vehicle, a = nav.nearest(nav.cellOf(v.pos.x), nav.cellOf(v.pos.z), 4), b = nav.nearest(nav.cellOf(x), nav.cellOf(z), 3);
    return !!(a && b && nav.region(a[0], a[1]) === nav.region(b[0], b[1]));
  }
  // which side of the map's river lines (nav gates) a point is on; 0 on a map without any
  sideOf(x, z) { const nav = this.units.nav.vehicle; return nav.gates ? nav.zone(nav.across(x, z)) : 0; }
  // Where armour supports a place it cannot reach: a point 40 m to `range` from it that the vehicle can drive to on its own side
  // of any river line, preferring one in sight of the place (hills and tall buildings in the way), then the nearest the vehicle,
  // then the nearer the place. Null when there is none. Kept per place and side for a minute.
  supportSpot(v, goal, range) {
    const side = this.sideOf(v.pos.x, v.pos.z), key = goal.name + ':' + side + ':' + range, now = this.match.elapsed, memo = this.supportMemo || (this.supportMemo = new Map()), hit = memo.get(key);
    if (hit && now - hit.t < 60) return hit.p;
    const C = this.match.combat, T = this.match.world.terrain, gy = C.groundAt(goal.x, goal.z) + 1.5;
    let best = null, bd = Infinity;
    for (let r = 40; r <= range; r += 20) for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2, px = goal.x + Math.cos(a) * r, pz = goal.z + Math.sin(a) * r;
      if (this.sideOf(px, pz) !== side || !this.vehicleReaches(v, px, pz)) continue;
      const py = C.groundAt(px, pz) + 2.6, sees = (!T || T.los(px, py, pz, goal.x, gy, goal.z)) && C.los(px, pz, goal.x, goal.z, py, gy);
      const d = Math.hypot(px - v.pos.x, pz - v.pos.z) + r * 0.5 + (sees ? 0 : 500);
      if (d < bd) { bd = d; best = [px, pz]; }
    }
    memo.set(key, { t: now, p: best }); return best;
  }   // out of sight of the fight, out of autocannon reach

  // Air: a helicopter at base ferries whoever is around it with a long walk ahead (a squad that respawned there,
  // stragglers going back to their squads), waiting up to 15 s for more to come aboard, lands them 70 m short of the
  // objective on our side and flies home. Under Air Assault one helicopter instead parks 130 m short (perch) as a
  // spawn point for the whole side (Respawn: an idle helicopter), and moves when the front moves on (or, in caution(), when threatened).
  air(heli, attack, base, perch, hold = null) {
    const lift = this.lifts.get(heli), parked = heli.state === 'parked', home = () => this.heliHome(heli, base);
    const sit = (at) => { this.lifts.set(heli, { stage: 'perch', at, riders: [], squads: [], hp: heli.hp }); this.percher = heli; heli.hover = false; heli.order(at[0], at[1]); };
    if (lift) {
      if (lift.stage === 'board') {
        if (attack && heli.passengers.length < heli.seats) this.riders(heli, lift, attack, base);   // late arrivals (a fresh wave of respawns) climb in too
        const waiting = lift.riders.some(m => !m.dead && !m.mounted && m.boardTarget === heli), lz = attack ? this.quietSpot(base, attack, 70, 80) : null;
        lift.t += 5;
        if (!waiting && heli.passengers.length && (lift.t >= 15 || heli.passengers.length >= heli.seats - 1)) {
          if (lz) { heli.dropOnLand = true; heli.order(lz[0], lz[1]); lift.stage = 'fly'; } else { this.endLift(heli); heli.unload(); }   // nowhere quiet to land: everyone out
        } else if (lift.t > 60) { this.endLift(heli); heli.unload(); }                  // they never made it: give up
      } else if (lift.stage === 'fly') {
        if (parked && !heli.passengers.length) {                                         // dropped: each one rejoins his squad, then perch or fly home
          for (const m of lift.riders) { const L = m.squad && m.squad.members.find(o => !o.dead && !o.mounted && !lift.riders.includes(o)); if (!m.dead && L) m.order(L.pos.x + (Math.random() - 0.5) * 3, L.pos.z + (Math.random() - 0.5) * 3); }
          this.endLift(heli);
          if (perch && !this.percher) sit(perch); else home();
        }
      } else if (lift.stage === 'perch') {                                              // the front moved on: follow it, or go home (caution() flies it off when threatened)
        if (!perch) { this.endLift(heli); this.percher = null; home(); }
        else if (Math.hypot(perch[0] - lift.at[0], perch[1] - lift.at[1]) > 80) { lift.at = perch; heli.order(perch[0], perch[1]); }
      } else if (lift.stage === 'gun') {                                                // fire support: follow the fight (caution() pulls it out when hurt or exposed)
        lift.places = [attack, hold];
        const spot = this.gunSpot(lift.places, base);
        if (!spot) { if (++lift.idle >= 2) { this.endLift(heli); home(); } }            // nothing to shoot for two plan ticks: home
        else { lift.idle = 0; if (Math.hypot(spot[0] - lift.at[0], spot[1] - lift.at[1]) > 15) { lift.at = spot; heli.order(spot[0], spot[1]); } }
      } else if (parked) this.lifts.delete(heli);                                        // home again
      return;
    }
    if (!parked) return;
    const atBase = Math.hypot(heli.pos.x - base.x, heli.pos.z - base.z) < 60;
    if (atBase && this.lift && attack) {
      const l = { stage: 'board', riders: [], squads: [], t: 0 };
      if (this.riders(heli, l, attack, base)) { this.lifts.set(heli, l); return; }
    }
    if (perch && !this.percher) return sit(perch);
    if (!atBase) return home();                                                         // a helicopter parked out on its own goes home
    if (heli.hp >= heli.maxHp * 0.95) {                                                  // repaired and with nothing to carry: fire support
      const spot = this.gunSpot([attack, hold], base);
      if (spot) { heli.hover = true; heli.order(spot[0], spot[1]); this.lifts.set(heli, { stage: 'gun', at: spot, places: [attack, hold], idle: 0, riders: [], squads: [] }); }
    }
  }
  heliHome(heli, base) { heli.hover = false; heli.dropOnLand = true; heli.order(base.x + (Math.random() - 0.5) * 16, base.z + (Math.random() - 0.5) * 16); this.lifts.set(heli, { stage: 'return', riders: [], squads: [] }); }
  // Fire support: a hover point 40 m from the biggest knot of enemy infantry around the places we attack and hold, or around
  // any of our squads (the fight may be elsewhere, away from the enemy's APCs). Never in
  // reach of an APC's autocannon (165 m; tank guns can't shoot up); launchers (95 m) count against a point, and one with more
  // than two in reach is out; the fewest wins, then our side. Null if there is none.
  // Infinity in reach of an APC, else the launchers within 150 m of (x, z): anti-tank squads now come for a helicopter in
  // the air from that far and fire braced (skyward), so a fire-support helicopter stays only with one launcher about at most
  exposed(x, z) {
    let n = 0;
    for (const e of this.contacts()) { const d = Math.hypot(e.pos.x - x, e.pos.z - z); if (e.type === 'apc' && d < 165) return Infinity; if (e.kit === 'at' && d < 150) n++; }
    return n;
  }
  gunSpot(places, base) {
    const squads = this.units.squads.filter(s => s.team === this.team && s.leader && !s.mounted).map(s => { const c = s.centroid(); return { x: c.x, z: c.z, r: 0 }; });
    const around = [...places.filter(Boolean), ...squads];
    const foes = this.contacts().filter(u => u.type === 'soldier' && around.some(l => Math.hypot(u.pos.x - l.x, u.pos.z - l.z) < l.r + 100));
    if (foes.length < 2) return null;
    // the knot of foes with the fewest launchers and APCs about: try the three biggest knots
    const knots = [], left = [...foes];
    while (left.length && knots.length < 3) { const c = this.cluster(left); knots.push(c); for (let i = left.length - 1; i >= 0; i--) if (Math.hypot(left[i].pos.x - c.x, left[i].pos.z - c.z) < 30) left.splice(i, 1); }
    let best = null, bestN = 2;
    for (const c of knots) { const s = this.gunSpotAt(c, base); if (s && s.n < bestN) { bestN = s.n; best = s.at; } }
    return best;
  }
  // a hover point 40 m from c with the fewest launchers about (one at most), trying our side first; { at, n } or null
  gunSpotAt(c, base) {
    const H = this.units.world.half - 10, ours = Math.atan2(base.x - c.x, base.z - c.z);
    let best = null;
    for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) { const a = ours + k * Math.PI / 4, x = c.x + Math.sin(a) * 40, z = c.z + Math.cos(a) * 40; if (Math.abs(x) > H || Math.abs(z) > H) continue; const n = this.exposed(x, z); if (n <= 1 && (!best || n < best.n)) best = { at: [x, z], n }; }
    return best;
  }
  // Soldiers around base whose way to their squad (or to the squad's goal) runs past the landing zone, so the flight saves
  // them 150 m or more of walking; not a squad holding base or on another lift, nor the engineers off to build a FOB.
  // They board heli, and a squad riding whole is taken out of the plan until it lands.
  riders(heli, lift, attack, base) {
    const lz = this.toward(base, attack, 70, 0), room = heli.seats - heli.passengers.length - lift.riders.filter(m => !m.dead && !m.mounted && m.boardTarget === heli).length;
    if (room <= 0) return 0;
    const wantLz = (m) => {
      const sq = m.squad, rest = sq ? sq.members.filter(o => !o.dead && !o.mounted && Math.hypot(o.pos.x - base.x, o.pos.z - base.z) > 150) : [];
      const to = sq && sq.goal && sq.tag !== 'home' ? { x: sq.goal[0], z: sq.goal[1] } : rest.length ? rest[0].pos : attack;
      return Math.hypot(to.x - lz[0], to.z - lz[1]) < Math.hypot(to.x - m.pos.x, to.z - m.pos.z) - 150;
    };
    const fresh = this.units.units.filter(m => m.type === 'soldier' && m.team === this.team && !m.dead && !m.mounted && !m.boardTarget && !m.building && !lift.riders.includes(m)
      && !(m.squad && (this.lifts.has(m.squad) || m.squad.tag === 'home' || (this.plan && this.plan.sq === m.squad))) && Math.hypot(m.pos.x - base.x, m.pos.z - base.z) < 120 && wantLz(m))
      .sort((a, b) => Math.hypot(a.pos.x - heli.pos.x, a.pos.z - heli.pos.z) - Math.hypot(b.pos.x - heli.pos.x, b.pos.z - heli.pos.z)).slice(0, room);
    if (!fresh.length || (!lift.riders.length && fresh.length < 2)) return 0;            // not worth a flight for one straggler
    for (const m of fresh) { m.board(heli); lift.riders.push(m); }
    for (const s of new Set(fresh.map(m => m.squad).filter(Boolean))) if (!lift.squads.includes(s) && s.members.every(o => o.dead || lift.riders.includes(o))) { lift.squads.push(s); s.tag = 'lift'; this.lifts.set(s, heli); }
    return fresh.length;
  }

  // Ground lifts: a troop truck, or an APC leaving base, takes a squad that gathers at its tail toward a far objective,
  // stops on our side of it (out of rocket range of anyone there) and lets them out; a truck then drives home for the
  // next squad, an APC fights on. True while the lift has the vehicle, so the caller leaves it alone.
  ride(v, squads, goal, base) {
    const lift = this.lifts.get(v);
    if (lift) {
      const sq = lift.sq, done = () => { this.lifts.delete(v); this.lifts.delete(sq); for (const m of sq.members) m.boardTarget = null; sq.goal = null; };
      if (!sq.leader || v.dead) { done(); return false; }
      if (lift.stage === 'board') {
        const waiting = sq.members.some(m => !m.dead && !m.mounted && m.boardTarget === v);
        if (v.passengers.length && !waiting) { v.order(lift.drop[0], lift.drop[1]); lift.stage = 'drive'; }
        else if ((lift.t += 5) > 60) { done(); if (v.passengers.length) v.unload(); return false; }   // the squad never made it: give up
        return true;
      }
      if (!v.passengers.length) { done(); if (v.type === 'truck') v.order(base.x + (Math.random() - 0.5) * 24, base.z + (Math.random() - 0.5) * 24); return false; }
      if (!v.dest) v.order(lift.drop[0], lift.drop[1]);   // stopped short (backed off from a threat, say): carry on
      return true;
    }
    if (!this.lift || !goal || v.passengers.length || Math.hypot(v.pos.x - base.x, v.pos.z - base.z) > 60 || Math.hypot(goal.x - v.pos.x, goal.z - v.pos.z) < 250) return false;
    // a squad around base (just respawned there, or not yet sent far) that would otherwise walk 250 m or more
    const sq = squads.filter(s => { const c = s.centroid(); return !s.mounted && !this.lifts.has(s) && s.aliveCount <= v.seats && Math.hypot(c.x - base.x, c.z - base.z) < 150 && Math.hypot(c.x - goal.x, c.z - goal.z) > 250; })
      .sort((p, q) => Math.hypot(p.centroid().x - v.pos.x, p.centroid().z - v.pos.z) - Math.hypot(q.centroid().x - v.pos.x, q.centroid().z - v.pos.z))[0];
    if (!sq) return false;
    let drop = this.quietSpot(base, goal, v.type === 'apc' ? 100 : 120, 80); if (!drop) return false;   // short of the objective on our side, only to a quiet spot
    if (!this.vehicleReaches(v, drop[0], drop[1])) { drop = this.supportSpot(v, goal, 140); if (!drop) return false; }   // not in the river or on an island it cannot reach
    sq.board(v); sq.tag = 'lift'; this.lifts.set(v, { sq, drop, stage: 'board', t: 0 }); this.lifts.set(sq, v);
    return true;
  }

  // no objectives: hunt the enemy's main cluster as far as we know it (milestone 1 behaviour); knowing of none, sweep toward
  // their base until something shows
  skirmish(squads, vehicles, base) {
    const eb = this.teams[1 - this.team].base, target = this.cluster(this.contacts().filter(u => !(u.spec.air && u.alt > 2))) || { x: eb.x, z: eb.z };
    squads.forEach((sq, i) => {
      if (i < 2 || !target) { if (!sq.busy) this.send(sq, base.x + (Math.random() - 0.5) * 16, base.z + (Math.random() - 0.5) * 16, 'home'); return; }
      const c = sq.centroid(), [x, z] = this.toward(c, target, 18); this.send(sq, x, z, 'hunt');
    });
    for (const v of vehicles) if ((v.type === 'apc' || v.type === 'tank') && target && !v.dest) { const [x, z] = this.toward(v.pos, target, 34); v.order(x, z); }
  }
}
