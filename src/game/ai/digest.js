// The state digest a CPU side sends to a remote commander: everything the hand-coded strategist
// looks at, compressed to a page of JSON. Positions are rounded metres; every unit also carries
// the nearest location and its distance so a model can read the board without a map. The enemy is
// what this side knows under fog of war (game/vision.js): what it sees, where it last saw the rest
// (lastSeen, seconds ago), enemies in a zone only as far as it sees them, and the FOBs it has found.
export function buildDigest(match, team, remote = null) {
  const m = match, T = m.teams[team], E = m.teams[1 - team], U = m.units.units, O = m.objectives ? m.objectives.list : [], V = m.vision, known = V.contacts(team);
  const r = (v) => Math.round(v), live = (u) => !u.dead && !u.mounted;
  const nearLoc = (x, z) => { let best = null, bd = Infinity; for (const l of O) { const d = Math.hypot(l.x - x, l.z - z); if (d < bd) { bd = d; best = l; } } return best ? `${best.name}+${r(bd)}m` : 'open'; };
  const owner = (o) => (o === team ? 'ours' : o === 1 - team ? 'theirs' : 'neutral');
  const o = m.objectives, st = m.strategists && m.strategists.find(s => s.team === team), free = st ? st.grabsFor(null) : [];   // free: where a grab job is accepted
  // the most enemies seen at one look in or within 60 m of a place in the last two minutes (strategist.note), when that is more
  // than we see there now: they may still be there, out of sight
  const recent = (l) => { const k = st && st.seenAt && st.seenAt.get(l); if (!k || m.elapsed - k.t > 120) return undefined;
    const now = known.filter(u => !u.ghost && !u.spec.structure && !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - l.x, u.pos.z - l.z) < l.r + 60).length;
    return k.n > now ? { units: k.units, secondsAgo: r(m.elapsed - k.t) } : undefined; };
  const locations = O.map(l => ({ name: l.name, at: [r(l.x), r(l.z)], owner: owner(l.owner), capturing: l.progress && l.owner === -1 ? (Math.sign(l.progress) === (team === 0 ? 1 : -1) ? 'ours' : 'theirs') : null, ours: l.n ? l.n[team] : 0,
    theirs: !V.on ? (l.n ? l.n[1 - team] : 0) : known.filter(u => !u.ghost && !u.spec.structure && !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - l.x, u.pos.z - l.z) < l.r).length, contested: l.contested || undefined, capturable: o ? o.capturable(team, l) && l.owner !== team : false,
    grabbable: free.includes(l) || undefined, links: l.adj ? l.adj.map(a => a.name) : undefined, base: l.homes && l.homes.length ? l.homes.map(owner).join(',') : undefined, recent: recent(l) }));   // the network: neighbours, and whose main base it touches
  // the engineer squad's logistics job and where (its order alone reads "fob" whatever it builds)
  const JOB = { fob: 'build a FOB', sandbags: 'dig sandbags', traps: 'lay tank traps', clear: 'clear tank traps' }, job = (s) => st && st.plan && st.plan.sq === s && !st.plan.done ? `${st.plan.kind === 'emplacement' ? 'set up ' + { hmg: 'a heavy machine gun (hmg)', atgm: 'an anti-tank launcher (atgm)', mortar: 'a mortar' }[st.plan.gun] : JOB[st.plan.kind]} at ${nearLoc(st.plan.x, st.plan.z)}` : undefined;
  // a squad aboard a vehicle says which: helicopters fly squads in, APCs and trucks drive them (both are "lift" to the strategist)
  const order = (s) => { const c = s.tag === 'lift' && st && st.lifts.get(s); return c && c.type ? `${c.type === 'heli' ? 'flying in' : 'riding'} ${c.label}` : s.tag || 'idle'; };
  // a squad walking to hold, reserve, screen or grab a place goes round known enemy fire when it can (strategist.detour):
  // which of our places it goes by and the walk, or exposed when there is no way round
  const route = (s) => { const w = s.route; return !w || w.tag !== s.tag || !s.busy ? undefined : w.via ? `via ${w.via} (${w.m} m walk), round the enemy at ${nearLoc(...w.past)}` : `exposed: no way round the enemy at ${nearLoc(...w.past)}`; };
  const squads = m.units.squads.filter(s => s.team === team && s.leader).map(s => { const c = s.centroid(), al = s.members.filter(live); return { id: s.leader.label, men: al.length, kits: [...new Set(al.map(u => u.kit))], hp: r(al.reduce((a, u) => a + u.hp, 0) / Math.max(1, al.length)), pinned: al.filter(u => u.supp > 0.5).length || undefined, rally: s.rally && !s.rally.dead ? nearLoc(s.rally.pos.x, s.rally.pos.z) : undefined, at: [r(c.x), r(c.z)], near: nearLoc(c.x, c.z), order: order(s), job: job(s), route: route(s), refused: st && st.refused ? st.refused.get(s.leader.label) : undefined }; });
  // a squad wiped out is off the map until its men come back (at its rally, a FOB or main): back is the seconds until the
  // first is due (0: waiting on its rally's wave or on tickets); a job given to it now applies when it returns
  const Q = m.respawn ? m.respawn.queue : [];
  for (const s of m.units.squads) if (s.team === team && !s.leader && s.members.length) {
    const q = Q.filter(e => s.members.includes(e.unit));
    squads.push({ id: s.members[0].label, men: 0, kits: [...new Set(s.members.map(u => u.kit))], down: true, back: q.length ? r(Math.max(0, Math.min(...q.map(e => e.t)))) : undefined, rally: s.rally && !s.rally.dead ? nearLoc(s.rally.pos.x, s.rally.pos.z) : undefined });
  }
  const vehicles = U.filter(u => u.team === team && live(u) && !u.squad && !u.spec.structure && !u.spec.naval).map(u => ({ id: u.label, type: u.supply ? 'supply' : u.type, hp: r(100 * u.hp / u.maxHp), at: [r(u.pos.x), r(u.pos.z)], near: nearLoc(u.pos.x, u.pos.z), to: u.dest && Math.hypot(u.dest.x - u.pos.x, u.dest.z - u.pos.z) > 20 ? nearLoc(u.dest.x, u.dest.z) : undefined, supplies: u.supply ? r(u.supplies) : undefined, refilling: u.refilling || undefined, refused: st && st.refused ? st.refused.get(u.label) : undefined, passengers: u.passengers && u.passengers.length ? u.passengers.length : undefined }));
  // enemy ground units as far as we know them, grouped within 40 m; a group seen only before carries lastSeen (its freshest sighting)
  const clusters = [];
  for (const u of known) {
    if (u.spec.structure || (u.spec.air && u.alt > 2)) continue;
    let c = clusters.find(k => Math.hypot(k.x - u.pos.x, k.z - u.pos.z) < 40);
    if (!c) { c = { x: u.pos.x, z: u.pos.z, n: 0, types: {}, age: Infinity }; clusters.push(c); }
    c.n++; c.types[u.type] = (c.types[u.type] || 0) + 1; c.x += (u.pos.x - c.x) / c.n; c.z += (u.pos.z - c.z) / c.n; c.age = Math.min(c.age, u.ghost ? u.age : 0);
  }
  const enemy = clusters.sort((a, b) => b.n - a.n).slice(0, 8).map(c => ({ at: [r(c.x), r(c.z)], near: nearLoc(c.x, c.z), units: c.types, lastSeen: c.age ? r(c.age) : undefined }));
  const fobs = (t) => (t === team ? U.filter(u => u.type === 'fob' && u.team === t && !u.dead) : known.filter(u => u.type === 'fob')).map(u => nearLoc(u.pos.x, u.pos.z));
  const sandbags = U.filter(u => u.type === 'sandbags' && u.team === team && !u.dead).map(u => nearLoc(u.pos.x, u.pos.z));
  // FOB emplacements: ours with whether a gunner is on it, theirs where we have found them
  const emplacements = { ours: U.filter(u => u.type === 'emplacement' && u.team === team && !u.dead).map(u => ({ id: u.label, gun: u.gun, near: nearLoc(u.pos.x, u.pos.z), hp: r(100 * u.hp / u.maxHp), manned: !!u.crewAt(0) })),
    theirs: known.filter(u => u.type === 'emplacement').map(u => ({ gun: u.gun || (u.unit && u.unit.gun), near: nearLoc(u.pos.x, u.pos.z) })) };
  // enemy helicopters in the air (left out of the groups above): where we see them, or last saw them
  const air = known.filter(u => u.spec && u.spec.air && u.alt > 2).map(u => ({ id: u.label, near: nearLoc(u.pos.x, u.pos.z), lastSeen: u.ghost ? r(u.age) : undefined }));
  const traps = { ours: U.filter(u => u.type === 'traps' && u.team === team && !u.dead).map(u => nearLoc(u.pos.x, u.pos.z)), theirs: known.filter(u => u.type === 'traps').map(u => nearLoc(u.pos.x, u.pos.z)) };   // rows of tank traps: they stop every vehicle, ours too
  const said = { captured: 'captured', lost: 'lost', fob: 'built a FOB', sandbags: 'dug in with sandbags', traps: 'laid tank traps', 'traps cleared': 'cleared tank traps', 'rally lost': 'lost a rally point', emplacement: 'set up an emplacement', 'cache revealed': 'found a cache at', 'cache destroyed': 'destroyed the cache at' };
  // trends from the 5 s history: tickets 1, 2 and 3 minutes ago, losses per minute over the last 3 minutes, locations that changed hands in the last 5
  const H = m.history, last = m.sample(), ago = (sec) => { const want = m.elapsed - sec; let best = H[0] || last; for (const h of H) if (h[0] <= want) best = h; return best; };
  const tk = (h) => [h[1 + team], h[2 - team]], span = Math.max(0.5, Math.min(3, m.elapsed / 60)), base = ago(180);
  const trends = {
    tickets: { now: tk(last), min1: tk(ago(60)), min2: tk(ago(120)), min3: tk(ago(180)) },
    perMinute: { ourDeaths: +((last[3 + team] - base[3 + team]) / span).toFixed(1), theirDeaths: +((last[4 - team] - base[4 - team]) / span).toFixed(1), ourVehicles: +((last[5 + team] - base[5 + team]) / span).toFixed(1), theirVehicles: +((last[6 - team] - base[6 - team]) / span).toFixed(1) },
    changedHands: m.log.filter(e => m.elapsed - e.t < 300).map(e => `m${(e.t / 60).toFixed(1)} ${e.team === team ? 'we' : 'they'} ${e.type} ${e.loc}`).slice(-8),
  };
  const hidden = (e) => e.type === 'radio' || (V.on && e.team !== team && (e.type === 'fob' || e.type === 'sandbags' || e.type === 'traps' || e.type === 'emplacement'));   // the enemy's own news, under fog of war
  const events = m.feed.filter(f => f.kind === 'kill' || !hidden(f.e)).slice(0, 6).map(f => f.kind === 'kill' ? `${f.k ? f.k.label : '?'} killed ${f.v.label}${f.v.team === team ? ' (ours)' : ''}` : `${f.e.team === team ? 'we' : 'they'} ${said[f.e.type] || f.e.type}${f.e.loc ? ' ' + f.e.loc.name : ''}`);
  return {
    map: m.world && m.world.map ? { name: m.world.map.name, size: m.world.map.size } : undefined, bases: { ours: [r(T.base.x), r(T.base.z)], theirs: [r(E.base.x), r(E.base.z)] },
    side: T.name, mode: m.mode.constructor.key, minute: +(m.elapsed / 60).toFixed(1), minutesLeft: +(Math.max(0, m.time) / 60).toFixed(1),
    tickets: { ours: r(T.tickets), theirs: r(E.tickets) }, lost: { infantry: T.stats.losses.soldier || 0, vehicles: Object.entries(T.stats.losses).filter(([k]) => k !== 'soldier' && k !== 'fob' && k !== 'emplacement').reduce((a, [, v]) => a + v, 0), emplacements: T.stats.losses.emplacement || undefined },
    locations, next: o ? (o.nextFor(team) || {}).name || null : null, front: o ? (o.front(team) || {}).name || null : null,
    squads, vehicles, enemy, air, emplacements, fobs: { ours: fobs(team), theirs: fobs(1 - team), kitsLeft: m.fobs.kitsLeft(team) }, sandbags, traps,
    trends, events, plans: remote ? remote.planHistory() : [], notes: remote && remote.plan ? remote.plan.notes || '' : '', waiting: remote ? remote.waitState() : null,
  };
}
