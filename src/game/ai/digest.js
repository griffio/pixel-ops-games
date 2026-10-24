// The state digest a CPU side sends to a remote commander: everything the hand-coded strategist
// looks at, compressed to a page of JSON. Positions are rounded metres; every unit also carries
// the nearest location and its distance so a model can read the board without a map.
export function buildDigest(match, team, remote = null) {
  const m = match, T = m.teams[team], E = m.teams[1 - team], U = m.units.units, O = m.objectives ? m.objectives.list : [];
  const r = (v) => Math.round(v), live = (u) => !u.dead && !u.mounted;
  const nearLoc = (x, z) => { let best = null, bd = Infinity; for (const l of O) { const d = Math.hypot(l.x - x, l.z - z); if (d < bd) { bd = d; best = l; } } return best ? `${best.name}+${r(bd)}m` : 'open'; };
  const owner = (o) => (o === team ? 'ours' : o === 1 - team ? 'theirs' : 'neutral');
  const o = m.objectives;
  const locations = O.map(l => ({ name: l.name, at: [r(l.x), r(l.z)], owner: owner(l.owner), capturing: l.progress && l.owner === -1 ? (Math.sign(l.progress) === (team === 0 ? 1 : -1) ? 'ours' : 'theirs') : null, ours: l.n ? l.n[team] : 0, theirs: l.n ? l.n[1 - team] : 0, capturable: o ? o.capturable(team, l) && l.owner !== team : false }));
  const squads = m.units.squads.filter(s => s.team === team && s.leader).map(s => { const c = s.centroid(), al = s.members.filter(live); return { id: s.leader.label, men: al.length, kits: [...new Set(al.map(u => u.kit))], hp: r(al.reduce((a, u) => a + u.hp, 0) / Math.max(1, al.length)), pinned: al.filter(u => u.supp > 0.5).length || undefined, at: [r(c.x), r(c.z)], near: nearLoc(c.x, c.z), order: s.tag || 'idle' }; });
  const vehicles = U.filter(u => u.team === team && live(u) && !u.squad && !u.spec.structure).map(u => ({ id: u.label, type: u.supply ? 'supply' : u.type, hp: r(100 * u.hp / u.maxHp), at: [r(u.pos.x), r(u.pos.z)], near: nearLoc(u.pos.x, u.pos.z), supplies: u.supply ? r(u.supplies) : undefined, passengers: u.passengers && u.passengers.length ? u.passengers.length : undefined }));
  // enemy ground units grouped within 40 m
  const clusters = [];
  for (const u of U) {
    if (u.team === team || !live(u) || u.spec.structure || (u.spec.air && u.alt > 2)) continue;
    let c = clusters.find(k => Math.hypot(k.x - u.pos.x, k.z - u.pos.z) < 40);
    if (!c) { c = { x: u.pos.x, z: u.pos.z, n: 0, types: {} }; clusters.push(c); }
    c.n++; c.types[u.type] = (c.types[u.type] || 0) + 1; c.x += (u.pos.x - c.x) / c.n; c.z += (u.pos.z - c.z) / c.n;
  }
  const enemy = clusters.sort((a, b) => b.n - a.n).slice(0, 8).map(c => ({ at: [r(c.x), r(c.z)], near: nearLoc(c.x, c.z), units: c.types }));
  const fobs = (t) => U.filter(u => u.type === 'fob' && u.team === t && !u.dead).map(u => nearLoc(u.pos.x, u.pos.z));
  const sandbags = U.filter(u => u.type === 'sandbags' && u.team === team && !u.dead).map(u => nearLoc(u.pos.x, u.pos.z));
  const said = { captured: 'captured', lost: 'lost', fob: 'built a FOB', sandbags: 'dug in with sandbags', 'cache revealed': 'found a cache at', 'cache destroyed': 'destroyed the cache at' };
  // trends from the 5 s history: tickets 1, 2 and 3 minutes ago, losses per minute over the last 3 minutes, locations that changed hands in the last 5
  const H = m.history, last = m.sample(), ago = (sec) => { const want = m.elapsed - sec; let best = H[0] || last; for (const h of H) if (h[0] <= want) best = h; return best; };
  const tk = (h) => [h[1 + team], h[2 - team]], span = Math.max(0.5, Math.min(3, m.elapsed / 60)), base = ago(180);
  const trends = {
    tickets: { now: tk(last), min1: tk(ago(60)), min2: tk(ago(120)), min3: tk(ago(180)) },
    perMinute: { ourDeaths: +((last[3 + team] - base[3 + team]) / span).toFixed(1), theirDeaths: +((last[4 - team] - base[4 - team]) / span).toFixed(1), ourVehicles: +((last[5 + team] - base[5 + team]) / span).toFixed(1), theirVehicles: +((last[6 - team] - base[6 - team]) / span).toFixed(1) },
    changedHands: m.log.filter(e => m.elapsed - e.t < 300).map(e => `m${(e.t / 60).toFixed(1)} ${e.team === team ? 'we' : 'they'} ${e.type} ${e.loc}`).slice(-8),
  };
  const events = m.feed.filter(f => f.kind === 'kill' || f.e.type !== 'radio').slice(0, 6).map(f => f.kind === 'kill' ? `${f.k ? f.k.label : '?'} killed ${f.v.label}${f.v.team === team ? ' (ours)' : ''}` : `${f.e.team === team ? 'we' : 'they'} ${said[f.e.type] || f.e.type}${f.e.loc ? ' ' + f.e.loc.name : ''}`);
  return {
    side: T.name, mode: m.mode.constructor.key, minute: +(m.elapsed / 60).toFixed(1), minutesLeft: +(Math.max(0, m.time) / 60).toFixed(1),
    tickets: { ours: r(T.tickets), theirs: r(E.tickets) }, lost: { infantry: T.stats.losses.soldier || 0, vehicles: Object.entries(T.stats.losses).filter(([k]) => k !== 'soldier' && k !== 'fob').reduce((a, [, v]) => a + v, 0) },
    locations, next: o ? (o.nextFor(team) || {}).name || null : null, front: o ? (o.front(team) || {}).name || null : null,
    squads, vehicles, enemy, fobs: { ours: fobs(team), theirs: fobs(1 - team), kitsLeft: m.fobs.kitsLeft(team) }, sandbags,
    trends, events, plans: remote ? remote.planHistory() : [], notes: remote && remote.plan ? remote.plan.notes || '' : '', waiting: remote ? remote.waitState() : null,
  };
}
