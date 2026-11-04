import { AAS } from './aas.js';
import { Objectives } from '../objectives.js';

// Random Advance and Secure: the match draws a chain of places through the map's lattice, from one of team 0's home places
// to one of team 1's, and plays Advance and Secure along it: each place is capturable only from the one before it, so the
// route to the enemy differs from match to match and the places off the chain are ground to cross. A chain runs toward the
// enemy base (each place no more than 60 m back along the base-to-base line from the one before; a move along a home row is
// allowed), is 3 to 5 places long unless the map says otherwise (map.raas = { min, max }), ends at the first of the enemy's
// home places it reaches, and longer chains are drawn more often (weight: length squared). A map without links (Desert
// Crossing) plays its list, which is a chain already. ?chain=A,B,C forces one (names in order) for replays and screenshots.
// The chain's ends are the homes; the map's own home flags come off the other places (docs/GAME_PLAN.md, "Random lanes plan").
export class RAAS extends AAS {
  static key = 'raas'; static name = 'Random Advance & Secure'; static desc = 'Advance & Secure along a route drawn for the match: a chain of places from your side to theirs, taken in order, different every match. The rest of the map is ground to cross.';
  setup() {
    const map = this.match.world.map, forced = this.opts.chain ? String(this.opts.chain).split(',').map(s => s.trim()).filter(Boolean) : null;
    this.chain = chainFor(map, forced, Math.random);
    this.objectives = new Objectives(this.chain, this.teams, null); this.bleedAcc = 0;   // no links: a chain in list order, its ends the homes
    this.objectives.onEvent = (type, loc, team) => this.onEvent(type, loc, team); this.objectives.reveal();
    this.match.pushFeed({ kind: 'event', e: { type: 'route', team: -1, names: this.chain.map(l => l.name) } });
  }
  tick(dt) { super.tick(dt); this.objectives.reveal(); }
  // under fog of war a side knows the chain only as far as the first place it does not hold, and keeps what it has seen
  known(team, loc) { return !!(loc.seen && loc.seen[team]); }
  routeNames() { return this.objectives.list.map(l => this.hidden(l) ? '?' : l.name); }   // the route as the viewer knows it
}

const strip = (l) => { const o = { ...l }; delete o.home; return o; };
const homeOf = (l, t) => l.home !== undefined && [].concat(l.home).includes(t);
// every chain the map allows: simple paths over the links from a team-0 home to the first team-1 home met, toward the
// enemy base within the tolerance, min to max places long
export function chainsFor(map) {
  const L = map.locations, byName = (n) => L.find(l => l.name === n);
  if (!map.links || !map.bases || map.bases.length < 2) return [L.map(strip)];
  const adj = new Map(L.map(l => [l.name, []])); for (const [a, b] of map.links) { adj.get(a).push(byName(b)); adj.get(b).push(byName(a)); }
  const b0 = map.bases[0], b1 = map.bases[1], ax = b1.x - b0.x, az = b1.z - b0.z, al = Math.hypot(ax, az) || 1, p = (l) => ((l.x - b0.x) * ax + (l.z - b0.z) * az) / al;
  const min = (map.raas && map.raas.min) || 3, max = (map.raas && map.raas.max) || 5, TOL = 60, out = [];
  const walk = (path) => {
    const last = path[path.length - 1];
    if (path.length > 1 && homeOf(last, 1)) { if (path.length >= min) out.push(path.map(strip)); return; }
    if (path.length >= max) return;
    for (const n of adj.get(last.name)) { if (path.includes(n) || p(n) < p(last) - TOL) continue; path.push(n); walk(path); path.pop(); }
  };
  for (const h of L.filter(l => homeOf(l, 0))) walk([h]);
  return out.length ? out : [L.map(strip)];
}
// one chain for a match: the forced names if they are the map's, else drawn from chainsFor with longer chains favoured
export function chainFor(map, forced, rnd = Math.random) {
  if (forced && forced.length >= 2) { const c = forced.map(n => map.locations.find(l => l.name === n)).filter(Boolean); if (c.length === forced.length) return c.map(strip); }
  const all = chainsFor(map), w = all.map(c => c.length * c.length), total = w.reduce((s, v) => s + v, 0);
  let r = rnd() * total, i = 0; while (i < all.length - 1 && (r -= w[i]) > 0) i++;
  return all[i];
}
