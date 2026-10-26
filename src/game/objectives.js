import { RULES } from './rules.js';

// What a unit counts for in a capture zone: one, or the doctrine's airCapture (two under Air Assault) while it is fresh
// off a helicopter (Unit.landedT). Zones cap the count at eight.
export const captureWeight = (u, teams) => { const d = u.landedT > 0 && teams[u.team].doctrine; return (d && d.airCapture) || 1; };

// Capture zones for Advance and Secure. progress runs -100 (OPFOR owned) .. +100
// (BLUFOR owned). The lattice is a network: a team can capture a location that touches its main base (home) or borders
// one it holds. A map lists its links (pairs of location names) and gives each location touching a base `home: team`;
// without links the locations form one chain in list order, the first touching team 0's base and the last team 1's.
// List order runs from team 0's side to team 1's (order(), next and front read it). What the capture bar shows is public,
// fog of war or not: contested (both sides in the zone) and pushing (the side draining or taking it, -1 for none).
export class Objectives {
  constructor(locations, teams, links = null) {
    this.list = locations.map((l, i) => ({ ...l, index: i, owner: -1, progress: 0, n: [0, 0], contested: false, pushing: -1, adj: [], homes: l.home === undefined ? [] : [].concat(l.home) }));
    const L = this.list, byName = (n) => { const l = L.find(x => x.name === n); if (!l) throw new Error('lattice: no location ' + n); return l; };
    if (links) for (const [a, b] of links) { const A = byName(a), B = byName(b); A.adj.push(B); B.adj.push(A); }
    else { for (let i = 1; i < L.length; i++) { L[i - 1].adj.push(L[i]); L[i].adj.push(L[i - 1]); } if (L.length) { L[0].homes.push(0); L[L.length - 1].homes.push(1); } }
    this.teams = teams; this.onEvent = null; this.scratch = [];
  }
  order(team) { return team === 0 ? this.list : [...this.list].reverse(); }
  capturable(team, loc) { return loc.homes.includes(team) || loc.adj.some(a => a.owner === team); }
  owned(team) { return this.list.filter(l => l.owner === team).length; }
  allOwned(team) { return this.list.every(l => l.owner === team); }
  nextFor(team) { return this.order(team).find(l => l.owner !== team && this.capturable(team, l)) || null; }
  // where a team stands toward a place it wants: the place of its own next to that one, nearest it (on a chain, the last it
  // holds in order); with no place in mind, or none of ours beside it, the last place it holds in order
  front(team, toward = null) {
    if (toward) { const n = toward.adj.filter(a => a.owner === team).sort((a, b) => Math.hypot(a.x - toward.x, a.z - toward.z) - Math.hypot(b.x - toward.x, b.z - toward.z))[0]; if (n) return n; }
    const o = this.order(team).filter(l => l.owner === team); return o[o.length - 1] || null;
  }

  tick(dt, spatial) {
    for (const loc of this.list) {
      const list = spatial.query(loc.x, loc.z, loc.r, this.scratch);
      let n0 = 0, n1 = 0, w = 0;
      for (const u of list) { if (u.dead || u.mounted || u.spec.structure || (u.spec.air && u.alt > 1)) continue; u.team === 0 ? n0++ : n1++; w += captureWeight(u, this.teams); }
      loc.n[0] = n0; loc.n[1] = n1; loc.contested = !!(n0 && n1); loc.pushing = -1;
      if ((n0 && n1) || (!n0 && !n1)) continue;
      const team = n0 ? 0 : 1, n = Math.min(8, w);
      if (!this.capturable(team, loc)) continue;
      if (loc.owner !== team) loc.pushing = team;
      const before = loc.progress, sign = team === 0 ? 1 : -1;
      loc.progress = Math.max(-100, Math.min(100, loc.progress + sign * n * RULES.captureRate * dt));
      // neutralised: the previous owner loses it
      if (loc.owner === 1 - team && sign * loc.progress >= 0) { const loser = loc.owner; loc.owner = -1; this.fire('lost', loc, loser); }
      if (loc.owner !== team && Math.abs(loc.progress) >= 100) { loc.owner = team; this.fire('captured', loc, team); }
      if (before !== loc.progress && loc.owner === team) loc.progress = sign * 100;
    }
  }
  fire(type, loc, team) { if (this.onEvent) this.onEvent(type, loc, team); }
}
