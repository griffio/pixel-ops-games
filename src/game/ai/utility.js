import { RULES } from '../rules.js';

// Utility commander: every plan tick it measures a handful of shared considerations, scores the options of
// each decision from them and picks the best, locally and in well under a millisecond. It produces a plan in
// the same shape as the LLM commander's (src/game/ai/plan.js), so the strategist carries it out the same way
// (applyPlan, squad roles). A personality is a set of weights; difficulty adds noise to the scores; a bonus
// for the option already chosen, decaying over a minute, stops it dithering. Lattice modes only (Advance and
// Secure, Invasion): elsewhere decide() returns false and the built-in planner runs.
export const PERSONAS = {
  balanced:   { urgency: 1,   armour: 1,   commit: 0.12, push: 1,    wait: 1,   reserve: 1 },
  aggressive: { urgency: 1.4, armour: 0.6, commit: 0.05, push: 1.25, wait: 0.5, reserve: 0.6 },
  patient:    { urgency: 0.7, armour: 1.4, commit: 0.25, push: 0.8,  wait: 1.5, reserve: 1.4 },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const sigmoid = (x, mid, width) => 1 / (1 + Math.exp(-(x - mid) / width));
// combat weight of a unit: a pinned soldier counts half, an APC four, a helicopter two, a truck half
const weight = (u) => u.type === 'soldier' ? (u.supp > 0.5 ? 0.5 : 1) : u.type === 'tank' ? 6 : u.type === 'apc' ? 4 : u.type === 'heli' ? 2 : 0.5;

export class UtilityCommander {
  constructor(strategist, persona = 'balanced') {
    this.s = strategist; this.match = strategist.match; this.team = strategist.team; this.units = strategist.units;
    this.persona = PERSONAS[persona] ? persona : 'balanced'; this.w = PERSONAS[this.persona];
    this.noise = (strategist.diff && strategist.diff.noise !== undefined) ? strategist.diff.noise : 0.06;
    this.plan = null; this.planAt = -Infinity; this.waitSince = null; this.waitMet = false; this.waitKey = '';
    this.chosen = {}; this.roleOf = new Map(); this.logLen = 0; this.memory = {}; this.scores = {}; this.said = ''; this.saidAt = -Infinity;
  }
  get fresh() { return !!this.plan; }

  // pick the best option of one decision: its score, a little noise, and the commitment bonus for the current choice
  pick(key, opts, tau = 60) {   // tau: how long a commitment takes to fade, in seconds
    const c = this.chosen[key], now = this.match.elapsed; let best = null;
    for (const o of opts) {
      o.total = o.score + (Math.random() - 0.5) * this.noise + (c && c.value === o.value ? this.w.commit * Math.exp(-(now - c.at) / tau) : 0);
      if (!best || o.total > best.total) best = o;
    }
    if (!c || c.value !== best.value) this.chosen[key] = { value: best.value, at: now };
    this.scores[key] = opts.map(o => [o.value, +o.score.toFixed(2)]);
    return best;
  }

  // the shared considerations, measured once per decision round
  measure(squads) {
    const m = this.match, t = this.team, o = m.objectives, U = this.units.units, now = m.elapsed;
    // the enemy as far as our side knows it (fog of war): what it sees, and where it last saw the rest, a sighting counting
    // for less as it ages; a place they hold that we have not looked at for half a minute is taken to hold about a squad
    const V = m.vision, foes = this.s.contacts().filter(u => !u.spec.structure && !(u.spec.air && u.alt > 2));
    const conf = (u) => u.ghost ? Math.max(0.3, 1 - u.age / RULES.vision.ghost) : 1;
    const enemyAt = (x, z, r) => { let s = 0; for (const u of foes) if (Math.hypot(u.pos.x - x, u.pos.z - z) < r) s += weight(u) * conf(u); return s; };
    const unseen = (l) => l.owner === 1 - t && V.ageAt(t, l.x, l.z) > 30 ? RULES.vision.guess : 0;
    let ours = 0; for (const u of U) if (!u.dead && !u.mounted && u.team === t && !u.spec.structure && !u.supply) ours += weight(u);
    const enemyApcs = foes.filter(u => u.type === 'apc' || u.type === 'tank');   // enemy armour
    const haveAT = squads.some(sq => sq.members.some(u => !u.dead && u.kit === 'at'));
    // armour threat at a point: enemy APCs within cannon range that can see it, nearer counting more
    const armourAt = (x, z) => { let n = 0; for (const v of enemyApcs) { const d = Math.hypot(v.pos.x - x, v.pos.z - z); if (d < 150 && m.combat.canSeePoint(v, x, z)) n += 1 - d / 200; } return n; };
    // ticket pressure: our lead's swing over the last three minutes, who holds the majority, how far ahead we are
    const H = m.history, last = m.sample(); let base = H[0] || last; for (const h of H) if (h[0] <= now - 180) base = h;
    const leadOf = (h) => h[1 + t] - h[2 - t], lead = leadOf(last), swing = lead - leadOf(base);
    const ownedUs = o.owned(t), ownedThem = o.owned(1 - t);
    const pressure = clamp01(0.45 - swing / 80 + (ownedThem > ownedUs ? 0.25 : ownedUs > ownedThem ? -0.2 : 0) - lead / 400);
    // time pressure: late in the match when behind; an Invasion attacker is always behind
    const invAttacker = m.mode.constructor.key === 'invasion' && m.mode.attacker === t;
    const minutesLeft = Math.max(0, m.time) / 60, behind = invAttacker || lead < 0;
    const timeP = behind ? clamp01(1 - minutesLeft / (invAttacker ? 20 : 12)) : 0;
    const urgency = clamp01(Math.max(pressure, timeP, invAttacker ? 0.5 : 0) * this.w.urgency);
    // readiness: men standing and not pinned, out of all the men our squads have
    let men = 0, up = 0, supp = 0;
    for (const sq of this.units.squads) if (sq.team === t) for (const u of sq.members) { men++; if (!u.dead) { up++; supp += u.supp || 0; } }
    const readiness = men ? (up / men) * (1 - 0.5 * supp / Math.max(1, up)) : 0;
    // travel: how close a place is to our nearest spawn (main base or a FOB); 1 on top of it, a half at 350 m
    const spawns = [m.teams[t].base, ...U.filter(u => u.type === 'fob' && u.team === t && !u.dead).map(f => f.pos)];
    const travel = (l) => { let d = Infinity; for (const sp of spawns) d = Math.min(d, Math.hypot(sp.x - l.x, sp.z - l.z)); return 1 / (1 + d / 350); };
    return { foes, enemyAt, unseen, ours, enemyApcs, haveAT, armourAt, lead, swing, ownedUs, ownedThem, pressure, timeP, urgency, readiness, travel };
  }

  decide(squads, vehicles) {
    const m = this.match, o = m.objectives; if (!o) return false;
    const t = this.team, w = this.w, M = this.measure(squads), L = o.list, U = this.units.units;
    if (m.log.length !== this.logLen) { this.logLen = m.log.length; this.chosen = {}; }   // a location changed hands: commitments lapse

    // 1. attack target: the capturable locations, or none (sit on what we hold). Free places (no enemy we know of near them,
    // strategist.grabsFor) are taken by a detachment each (9.), so the main force goes where there is a fight; only when
    // every candidate is free does one of them become the target. With more than one candidate, a place near where our
    // attack force already is counts for more (momentum: on a big map a switch of target costs minutes of walking), and a
    // commitment fades over a minute for each kilometre of map.
    const all = L.filter(l => l.owner !== t && o.capturable(t, l)), free0 = this.s.grabsFor(null);
    const cands = all.some(l => !free0.includes(l)) ? all.filter(l => !free0.includes(l)) : all;
    const ratioAt = (l) => { const theirs = Math.max(M.enemyAt(l.x, l.z, l.r + 60), M.unseen(l)); return M.ours / (M.ours + theirs + 0.5); };
    const armourF = (l) => 1 / (1 + M.armourAt(l.x, l.z) * w.armour * (M.haveAT ? 0.5 : 1));
    const force = squads.filter(sq => this.roleOf.get(sq.leader.label) === 'assault').map(sq => sq.centroid()), fx = force.length ? force.reduce((s, c) => s + c.x, 0) / force.length : m.teams[t].base.x, fz = force.length ? force.reduce((s, c) => s + c.z, 0) / force.length : m.teams[t].base.z;
    const reach = (l) => 1 / (1 + Math.hypot(l.x - fx, l.z - fz) / 400), maxReach = Math.max(...cands.map(reach), 1e-9);
    const momentum = (l) => cands.length > 1 ? 0.5 + 0.5 * reach(l) / maxReach : 1;
    const attackOpts = cands.map(l => ({ value: l.name, loc: l, score: sigmoid(ratioAt(l), 0.45, 0.08) * armourF(l) * (0.4 + 0.6 * M.travel(l)) * (0.6 + 0.4 * M.urgency) * momentum(l) * w.push }));
    attackOpts.push({ value: null, loc: null, score: 0.3 * (M.ownedUs > M.ownedThem ? 1 : 0.4) * (1 - M.urgency) * (0.6 + 0.4 * (1 - M.readiness)) / w.push });
    const target = this.pick('attack', attackOpts, 60 * m.world.size / 1000).loc;
    const grabs = free0.filter(l => l !== target);

    // 2. hold: our locations by value (the front, or one whose loss flips the majority) times threat to it
    const front = o.front(t, target), flips = M.ownedUs - 1 <= M.ownedThem;   // our place next to the target: the one to hold first, the staging point
    const postsAt = (l) => m.fobs.sandbagsOf(t).filter(s => Math.hypot(s.pos.x - l.x, s.pos.z - l.z) < this.s.postRange(l)).length;   // our sandbag positions at a place
    const holdOpts = L.filter(l => l.owner === t).map(l => {
      const threat = 1 - Math.exp(-M.enemyAt(l.x, l.z, l.r + 120) / 6), value = l === front ? 1 : flips ? 0.75 : 0.45;
      return { value: l.name, loc: l, threat, score: value * (0.25 + 0.75 * threat) * (postsAt(l) ? 1.15 : 1) };
    }).sort((a, b) => b.score - a.score);
    const hold = holdOpts.filter((h, i) => i === 0 || h.score > 0.35).slice(0, 3), holdLoc = hold.length ? hold[0].loc : null, holdThreat = hold.length ? hold[0].threat : 0;
    this.scores.hold = holdOpts.map(h => [h.value, +h.score.toFixed(2)]);

    // 3. attack share: enough force for the target (projected ratio), not leaving threatened holds bare, no more than needed
    const theirsAtTarget = target ? Math.max(M.enemyAt(target.x, target.z, target.r + 60), M.unseen(target)) : 0;
    const adequacy = (s, frac = 1) => clamp01(((M.ours * s * frac) / Math.max(1, theirsAtTarget) - 0.7) / 1.2);
    const share = target ? this.pick('share', [0.35, 0.5, 0.65, 0.8, 0.95].map(s => ({ value: s,
      score: (0.3 + 0.7 * adequacy(s)) * (1 - 0.6 * holdThreat * s) * (1 + 0.3 * M.urgency * s) * (1 - 0.2 * s * (1 - M.urgency)) }))).value : 0.5;

    // 4. posture
    const exposure = target ? Math.min(1, M.armourAt(target.x, target.z)) : 0, fav = target ? ratioAt(target) : 0.5;
    const posture = this.pick('posture', [
      { value: 'aggressive', score: (0.25 + 0.35 * fav + 0.35 * M.urgency + 0.15 * M.readiness - 0.3 * exposure * (M.haveAT ? 0.5 : 1)) * w.push },
      { value: 'balanced', score: 0.45 },
      { value: 'cautious', score: (0.15 + 0.35 * exposure * w.armour + 0.3 * (1 - M.readiness) + 0.2 * clamp01(M.lead / 150) - 0.25 * M.urgency) / w.push },
    ]).value;

    // 5. logistics: a FOB when the front is a long walk from any spawn and quiet; sandbag positions (three to a place) at the
    // place we hold, best dug in a lull, still worth it under pressure, after the FOB while a kit is left
    const eng = squads.some(sq => sq.engineer), truck = vehicles.find(v => v.supply && !v.dead);
    const quiet = front ? Math.exp(-M.enemyAt(front.x, front.z, 100) / 4) : 0;
    const logistics = this.pick('logistics', [
      { value: 'fob', score: m.fobs.kitsLeft(t) > 0 && eng && truck && truck.supplies >= RULES.fob.supplyCost && front ? 0.3 + 0.6 * (1 - M.travel(front)) * quiet : 0 },
      { value: 'sandbags', score: eng && truck && truck.supplies >= RULES.sandbags.supplyCost && holdLoc && m.fobs.sandbagsOf(t).length < RULES.sandbags.max && postsAt(holdLoc) < 3
        ? (0.3 + 0.35 * Math.exp(-M.enemyAt(holdLoc.x, holdLoc.z, 80) / 3) + 0.25 * holdThreat) * (m.fobs.kitsLeft(t) > 0 ? 0.6 : 1) : 0 },
      { value: 'none', score: 0.25 },
    ]).value;

    // 6. lift: helicopters fly squads to far objectives that no enemy APC overlooks
    const lift = !vehicles.some(v => v.type === 'heli') || !target ? true : this.pick('lift', [
      { value: true, score: 0.1 + (1 - M.travel(target)) / (1 + M.armourAt(target.x, target.z)) },
      { value: false, score: 0.3 },
    ]).value;

    // 7. wait: attack now, or first gather at the front, wait for our APC, or let the defenders thin out
    let waitFor = null;
    if (target && front && front !== target) {
      const nAttack = Math.max(1, Math.ceil(squads.length * share));
      const nearNow = squads.filter(sq => { const c = sq.centroid(); return Math.hypot(c.x - target.x, c.z - target.z) < 150; }).length;
      const nowA = adequacy(share, Math.min(nearNow, nAttack) / nAttack), allA = adequacy(share);
      const count = m.enemiesNear(t, target.x, target.z, target.r + 25), prev = this.memory[target.name]; this.memory[target.name] = count;
      const opts = [
        { value: 'none', score: 0.25 + 0.5 * nowA + 0.35 * M.urgency },
        { value: 'squadsAt', score: (0.15 + 0.8 * Math.max(0, allA - nowA)) * (1 - M.urgency) * w.wait },
      ];
      const apcDown = !vehicles.some(v => v.type === 'apc' || v.type === 'tank') && m.respawn.queue.some(q => q.unit.team === t && (q.unit.type === 'apc' || q.unit.type === 'tank'));
      if (apcDown) opts.push({ value: 'apcAlive', score: 0.55 * (1 - M.urgency) * w.wait * clamp01(theirsAtTarget / 8) });
      if (prev !== undefined && count > 2 && count < prev * 0.8) opts.push({ value: 'enemyBelow', score: 0.4 * (1 - M.urgency) * w.wait });
      const c = this.pick('wait', opts).value;
      if (c === 'squadsAt') waitFor = { kind: 'squadsAt', at: front.name, count: Math.min(squads.length, Math.max(2, Math.ceil(nAttack * 0.75))) };
      else if (c === 'apcAlive') waitFor = { kind: 'apcAlive' };
      else if (c === 'enemyBelow') waitFor = { kind: 'enemyBelow', at: target.name, count: Math.max(1, Math.floor(count * 0.6)) };
    }
    const key = JSON.stringify([target && target.name, waitFor]);
    if (key !== this.waitKey) { this.waitKey = key; this.waitSince = m.elapsed; this.waitMet = false; }   // a new wait starts its clock; a held one stays met

    // 9. squad roles: special jobs where there is demand, filled greedily by kit fit, condition and distance;
    // the rest split by the share into assault and hold, best attackers first
    const free = squads.filter(sq => !sq.engineer || logistics === 'none');
    const alive = (sq) => sq.members.filter(u => !u.dead), has = (sq, k) => alive(sq).some(u => u.kit === k);
    const cond = (sq) => { const a = alive(sq); return a.length / sq.members.length * (1 - 0.5 * a.reduce((s, u) => s + (u.supp || 0), 0) / Math.max(1, a.length)); };
    const near = (sq, p) => { if (!p) return 0.5; const c = sq.centroid(); return 1 / (1 + Math.hypot(c.x - p.x, c.z - p.z) / 250); };
    const keep = (sq, role) => this.roleOf.get(sq.leader.label) === role ? w.commit : 0;
    const armourNearHold = !!holdLoc && M.enemyApcs.some(v => Math.hypot(v.pos.x - holdLoc.x, v.pos.z - holdLoc.z) < 250);
    const enemyFob = this.s.contacts().find(u => u.type === 'fob' && [holdLoc, target].some(p => p && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < 300));
    const truckAtRisk = truck && truck.dest && M.enemyAt(truck.pos.x, truck.pos.z, 120) > 0;
    const demand = { screen: holdLoc && (armourNearHold || M.enemyAt(holdLoc.x, holdLoc.z, holdLoc.r + 150) > 4) ? 1 : 0, reserve: free.length >= 4 && holdThreat > 0.4 ? 1 : 0, raid: enemyFob ? 1 : 0, escort: truckAtRisk ? 1 : 0 };
    const fit = {
      screen: (sq) => (has(sq, 'at') && armourNearHold ? 1 : has(sq, 'mg') ? 0.8 : 0.4) * cond(sq) * near(sq, holdLoc),
      reserve: (sq) => (0.4 + 0.6 * (1 - cond(sq))) * near(sq, holdLoc) * w.reserve,
      raid: (sq) => (has(sq, 'at') ? 1 : 0.7) * cond(sq) * near(sq, enemyFob && enemyFob.pos),
      escort: (sq) => (has(sq, 'mg') ? 1 : 0.7) * cond(sq) * near(sq, truck && truck.pos),
    };
    const pairs = [];
    for (const sq of free) for (const role of Object.keys(demand)) if (demand[role]) pairs.push({ sq, role, score: fit[role](sq) + keep(sq, role) });
    pairs.sort((a, b) => b.score - a.score);
    const roles = new Map(), grabAt = new Map();
    for (const p of pairs) if (p.score > 0.25 && demand[p.role] > 0 && !roles.has(p.sq)) { roles.set(p.sq, p.role); demand[p.role]--; }
    // a squad for each free place, the nearest in good order (the one already on its way first); two stay for attack and holds
    for (const l of grabs) {
      const pool = free.filter(sq => !roles.has(sq)); if (pool.length < 3) break;
      const fitG = (sq) => cond(sq) * near(sq, l) + (this.roleOf.get(sq.leader.label) === 'grab@' + l.name ? w.commit : 0);
      const sq = pool.sort((a, b) => fitG(b) - fitG(a))[0]; roles.set(sq, 'grab'); grabAt.set(sq, l);
    }
    const armourAtTarget = !!target && M.enemyApcs.some(v => Math.hypot(v.pos.x - target.x, v.pos.z - target.z) < 150);
    const rest = free.filter(sq => !roles.has(sq)).map(sq => ({ sq, score: (has(sq, 'at') && armourAtTarget ? 1 : has(sq, 'rifle') ? 0.9 : 0.7) * cond(sq) * near(sq, target) + keep(sq, 'assault') })).sort((a, b) => b.score - a.score);
    const nAttack = target ? Math.min(rest.length, Math.ceil(free.length * share)) : 0;
    rest.forEach((r, i) => roles.set(r.sq, i < nAttack ? 'assault' : 'hold'));
    const atFor = { hold: holdLoc, reserve: holdLoc, screen: holdLoc };
    const squadRoles = [...roles].map(([sq, role]) => { const at = role === 'grab' ? grabAt.get(sq) : atFor[role]; this.roleOf.set(sq.leader.label, role === 'grab' ? 'grab@' + at.name : role); return at ? { id: sq.leader.label, role, at: at.name } : { id: sq.leader.label, role }; });
    this.scores.roles = squadRoles.map(r => r.id + ':' + r.role);

    // a line of radio chatter when the intent changes, at most every 20 s
    const said = !target ? `Holding ${holdLoc ? holdLoc.name : 'what we have'}, let them come to us.`
      : waitFor && waitFor.kind === 'squadsAt' ? `Gathering at ${front.name} before we hit ${target.name}.`
      : waitFor && waitFor.kind === 'apcAlive' ? `Waiting for armour before ${target.name}.`
      : waitFor && waitFor.kind === 'enemyBelow' ? `They're thinning out at ${target.name}, wait for it.`
      : `Pushing ${target.name}${fav > 0.6 ? ', we have the numbers' : M.urgency > 0.6 ? ', we are bleeding tickets' : ''}.`;
    const reason = said + (posture === 'aggressive' ? ' Go hard.' : posture === 'cautious' ? ' Keep your heads down.' : '');
    if (said !== this.said && m.elapsed - this.saidAt > 20) { this.said = said; this.saidAt = m.elapsed; m.event({ type: 'radio', team: t, text: reason }); }

    this.plan = { attack: target ? target.name : null, hold: hold.map(h => h.value), attackShare: share, posture, logistics, lift, reason, notes: '', nextReviewIn: 20, waitFor, squads: squadRoles };
    this.planAt = m.elapsed;
    this.considerations = { urgency: +M.urgency.toFixed(2), pressure: +M.pressure.toFixed(2), timeP: +M.timeP.toFixed(2), readiness: +M.readiness.toFixed(2), lead: M.lead, swing: M.swing, ours: +M.ours.toFixed(1), theirsAtTarget: +theirsAtTarget.toFixed(1) };
    return true;
  }
}
