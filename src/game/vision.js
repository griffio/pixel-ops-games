import { RULES } from './rules.js';

// Fog of war: what each side can see. Every RULES.vision.every seconds each live unit casts rays over a grid of cells out to
// its sight range (a viewshed): along a ray a cell counts as seen while a man standing in it (1.2 m) rises above every hill and
// tall building in between, so ridges and buildings throw shadows. A unit's cells are kept until it moves or its eye height
// changes (kneeling, prone, a helicopter climbing), so units standing still cost nothing; a move of half a cell (4 m) recasts.
// An enemy is visible to a side when it stands in a cell that side sees, when it is in the air within one of that side's sight
// ranges (nothing hides a helicopter against the sky), or when it fired at that side in the last few seconds. FOBs, sandbag
// positions and rally points stay known once seen; weapon caches are objectives and always show. An enemy that drops out of
// sight leaves a last-known position (a ghost) for RULES.vision.ghost seconds. The CPU plans with contacts(): what its side sees
// plus those last-known positions. Switched off (?fog=0), every side sees everything, as before fog of war.
const STICKY = new Set(['fob', 'sandbags', 'rally', 'traps', 'emplacement']);

export class Vision {
  constructor(units, world, combat, on = true) {
    const V = RULES.vision;
    this.units = units; this.world = world; this.combat = combat; this.on = on; this.cAt = [-1, -1]; this.cList = [[], []];
    this.cell = V.cell; this.half = world.size / 2; this.n = Math.ceil(world.size / V.cell);
    this.stamp = [new Int32Array(this.n * this.n), new Int32Array(this.n * this.n)]; this.gen = 0;
    this.cache = new Map(); this.ghosts = [new Map(), new Map()]; this.mark = new Int32Array(this.n * this.n); this.markGen = 0;
    this.t = 0; this.acc = V.every;   // the first tick looks at once
    // the ground at each cell's centre, and tall obstacles (combat's line-of-sight boxes, 1.5 m and up) as the highest top in
    // it, where they cover an eighth of the cell or more (8 m2): a house wall (houses are walls 1 m thick) or a container stack
    // blocks the view, a lamp post or a fence post does not (a whole cell would make a 0.6 m pole an 8 m wall; combat's own
    // line of sight stays exact)
    const n = this.n, c = this.cell, ground = this.ground = new Float32Array(n * n);
    for (let cz = 0; cz < n; cz++) for (let cx = 0; cx < n; cx++) ground[cz * n + cx] = combat.groundAt((cx + 0.5) * c - this.half, (cz + 0.5) * c - this.half);
    const top = this.top = new Float32Array(n * n).fill(-Infinity), cover = new Float32Array(n * n), ci = (v) => Math.max(0, Math.min(n - 1, Math.floor((v + this.half) / c)));
    const highest = new Float32Array(n * n).fill(-Infinity);
    for (const o of world.obstacles) {
      const h = o.h === undefined ? 2 : o.h; if (h < 1.5) continue;
      const y = combat.groundAt((o.minX + o.maxX) / 2, (o.minZ + o.maxZ) / 2) + h;
      for (let cz = ci(o.minZ); cz <= ci(o.maxZ); cz++) for (let cx = ci(o.minX); cx <= ci(o.maxX); cx++) {
        const x0 = cx * c - this.half, z0 = cz * c - this.half, k = cz * n + cx;
        cover[k] += Math.max(0, Math.min(o.maxX, x0 + c) - Math.max(o.minX, x0)) * Math.max(0, Math.min(o.maxZ, z0 + c) - Math.max(o.minZ, z0));
        if (y > highest[k]) highest[k] = y;
      }
    }
    for (let k = 0; k < n * n; k++) if (cover[k] >= c * c / 8) top[k] = highest[k];
  }
  cellOf(x, z) { const n = this.n, cx = Math.floor((x + this.half) / this.cell), cz = Math.floor((z + this.half) / this.cell); return cx < 0 || cz < 0 || cx >= n || cz >= n ? -1 : cz * n + cx; }
  sight(u) { const S = RULES.vision.sight; return u.spec.air && u.alt > 2 ? S.air : S[u.type] || 0; }

  // the cells a viewer at (ox, oz) with its eye at height eye sees out to R, one sample per cell along each ray (the ground at
  // the cell's centre); from the air, buildings do not block
  cast(ox, oz, eye, R, air) {
    const out = [], c = this.cell, n = this.n, half = this.half, ground = this.ground, top = this.top;
    const mark = this.mark, mg = ++this.markGen;   // each cell once: rays crowd together near the viewer
    const own = this.cellOf(ox, oz); if (own >= 0) { out.push(own); mark[own] = mg; }
    const rays = Math.max(24, Math.ceil(2 * Math.PI * R / c));
    for (let i = 0; i < rays; i++) {
      const a = i / rays * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      let max = -Infinity;
      for (let d = c; d <= R; d += c) {
        const x = ox + dx * d, z = oz + dz * d, cx = Math.floor((x + half) / c), cz = Math.floor((z + half) / c);
        if (cx < 0 || cz < 0 || cx >= n || cz >= n) break;
        const k = cz * n + cx, g = ground[k];
        if ((g + 1.2 - eye) / d >= max && mark[k] !== mg) { mark[k] = mg; out.push(k); }
        const y = !air && top[k] > g ? top[k] : g, s = (y - eye) / d; if (s > max) max = s;
      }
    }
    return Int32Array.from(out);
  }

  // a unit that fires gives itself away to the side it fires at
  reveal(u, team) { (u.revealT || (u.revealT = [0, 0]))[team] = this.t + RULES.vision.reveal; }
  // does `team` see unit u now? (its own units, and wrecks, always)
  sees(team, u) { return !this.on || u.team === team || u.dead || u.type === 'cache' || (!!u.vis && u.vis[team] === this.gen); }
  seesCell(team, k) { return k >= 0 && this.stamp[team][k] === this.gen; }
  // seconds since `team` last saw the ground at (x, z) (a large number if never; 0 with the fog off)
  ageAt(team, x, z) { if (!this.on) return 0; const k = this.cellOf(x, z); return k < 0 ? Infinity : (this.gen - this.stamp[team][k]) * RULES.vision.every; }
  // what `team` knows of the enemy: the units it sees, and stand-ins where it last saw the others ({ ghost: true, age in s,
  // unit: the real one }, positioned where it was seen). Not mounted, not dead. Worked out once a tick.
  contacts(team) {
    if (this.cAt[team] === this.t) return this.cList[team];
    const out = [];
    for (const e of this.units.units) if (!e.dead && !e.mounted && e.team !== team && e.team >= 0 && e.team <= 1 && this.sees(team, e)) out.push(e);
    if (this.on) for (const [e, g] of this.ghosts[team]) out.push({ ghost: true, unit: e, age: this.t - g.t, pos: { x: g.x, y: g.y, z: g.z }, heading: g.heading, speed: 0,
      type: e.type, kit: e.kit, supply: e.supply, spec: e.spec, team: e.team, alt: g.alt, label: e.label, dead: false, mounted: null, supp: 0 });
    this.cAt[team] = this.t; return (this.cList[team] = out);
  }

  tick(dt) {
    const V = RULES.vision; this.t += dt; this.acc += dt;
    if (!this.on || this.acc < V.every - 1e-6) return; this.acc = 0;
    const gen = ++this.gen, U = this.units.units, viewers = [[], []];
    for (const u of U) {
      if (u.dead || u.mounted || u.team < 0 || u.team > 1) continue;
      const R = this.sight(u); if (!R) continue;
      const eye = this.combat.eyeY(u), air = u.spec.air && u.alt > 2;
      let c = this.cache.get(u);
      if (!c || c.r !== R || Math.abs(c.eye - eye) > 0.4 || Math.hypot(c.x - u.pos.x, c.z - u.pos.z) > 4) this.cache.set(u, c = { x: u.pos.x, z: u.pos.z, eye, r: R, cells: this.cast(u.pos.x, u.pos.z, eye, R, air) });
      const st = this.stamp[u.team]; for (const k of c.cells) st[k] = gen;
      viewers[u.team].push(u);
    }
    for (const e of U) {
      if (e.dead || e.team < 0 || e.team > 1) continue;
      const vis = e.vis || (e.vis = [-1, -1]);   // never seen: 0 would match "seen one look ago" at the first look and leave a ghost of every enemy
      for (let t = 0; t < 2; t++) {
        if (t === e.team) continue;
        let v = false;
        if (e.mounted) v = false;
        else if (STICKY.has(e.type) && e.known && e.known[t]) v = true;
        else if (e.spec.air && e.alt > 2) v = viewers[t].some(o => Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < this.sight(o));
        else v = this.stamp[t][this.cellOf(e.pos.x, e.pos.z)] === gen;
        if (!v && e.revealT && e.revealT[t] > this.t && !e.mounted) v = true;
        if (v) {
          vis[t] = gen; this.ghosts[t].delete(e);
          if (STICKY.has(e.type)) (e.known || (e.known = [false, false]))[t] = true;
        } else if (vis[t] === gen - 1 && !e.mounted) this.ghosts[t].set(e, { x: e.pos.x, y: e.pos.y, z: e.pos.z, alt: e.alt || 0, heading: e.heading, t: this.t, type: e.type, label: e.label });   // just lost sight of it
      }
    }
    for (const G of this.ghosts) for (const [e, g] of G) if (e.dead || this.t - g.t > V.ghost) G.delete(e);
  }
}
