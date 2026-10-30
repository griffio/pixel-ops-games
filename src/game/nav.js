// Navigation grid with A* (8-neighbour, no corner cutting) and string pulling.
// One grid per passability class: infantry at 1 m with 0.6 m clearance, vehicles
// at 2 m with 2.2 m clearance. A 1 km infantry grid is a million cells (~25 MB).
export class NavGrid {
  constructor(size, cell = 1, pad = 0.6) {
    this.size = size; this.cell = cell; this.pad = pad; this.half = size / 2; this.n = Math.ceil(size / cell);
    const N = this.n * this.n;
    this.L = new Uint8Array(N);
    this.g = new Float32Array(N); this.f = new Float32Array(N); this.parent = new Int32Array(N);
    this.stamp = new Int32Array(N); this.closed = new Int32Array(N); this.gen = 0;
    this.heap = new Int32Array(N); this.heapN = 0;
    this.cap = 80000;   // cells a search may expand; a map with a bigger grid sets more (map.nav.cap)
    // the heuristic's weight: a little over 1 makes A* greedy enough to expand a fraction of the cells on open ground, for
    // routes a percent or two longer at most (a match's first plan used to stall a frame for 400 ms pathing every squad at 1.0)
    this.hw = 1.15;
  }
  build(obstacles, terrain = null, maxSlope = 1, passable = null) {
    this.src = { obstacles, terrain, maxSlope, passable };   // kept for refresh()
    const L = this.L, pad = this.pad; L.fill(0);
    if (terrain) for (let iz = 0; iz < this.n; iz++) for (let ix = 0; ix < this.n; ix++) {   // steep ground and water are impassable, bridges always pass
      const x = this.world(ix), z = this.world(iz);
      if (passable && passable(x, z)) continue;
      if (terrain.slope(x, z) > maxSlope || terrain.height(x, z) < terrain.water - terrain.wade) L[iz * this.n + ix] = 1;
    }
    const border = Math.ceil(3 / this.cell);
    for (let iz = 0; iz < this.n; iz++) for (let ix = 0; ix < this.n; ix++)
      if (ix < border || iz < border || ix >= this.n - border || iz >= this.n - border) L[iz * this.n + ix] = 1;
    for (const o of [...obstacles, ...(this.extra || [])]) {   // extra: the vehicle grids' own blocks (thickets from the start, tank traps as they are laid)
      const x0 = Math.max(0, this.cellOf(o.minX - pad)), x1 = Math.min(this.n - 1, this.cellOf(o.maxX + pad));
      const z0 = Math.max(0, this.cellOf(o.minZ - pad)), z1 = Math.min(this.n - 1, this.cellOf(o.maxZ + pad));
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) L[iz * this.n + ix] = 1;
    }
  }
  cellOf(v) { return Math.floor((v + this.half) / this.cell); }
  world(i) { return (i + 0.5) * this.cell - this.half; }
  passable(ix, iz) { return ix >= 0 && iz >= 0 && ix < this.n && iz < this.n && this.L[iz * this.n + ix] === 0; }
  blocked(x, z) { return !this.passable(this.cellOf(x), this.cellOf(z)); }
  // connected regions of passable cells (8-neighbour without corner cutting is the same as 4-neighbour), labelled lazily
  region(ix, iz) { if (!this.passable(ix, iz)) return 0; if (!this.labels) this.labelRegions(); return this.labels[iz * this.n + ix]; }
  labelRegions() {
    const n = this.n, L = this.L, lab = this.labels = (this.labelBuf || (this.labelBuf = new Int32Array(n * n))).fill(0), stack = this.stackBuf || (this.stackBuf = new Int32Array(n * n)); let next = 0; const sizes = this.sizes = [0];   // buffers kept: a relabel (after every build) no longer allocates 18 MB
    for (let i = 0; i < n * n; i++) {
      if (L[i] || lab[i]) continue;
      lab[i] = ++next; sizes[next] = 0; let sp = 0; stack[sp++] = i;
      while (sp) {
        const c = stack[--sp], cx = c % n; sizes[next]++;
        if (cx > 0 && !L[c - 1] && !lab[c - 1]) { lab[c - 1] = next; stack[sp++] = c - 1; }
        if (cx < n - 1 && !L[c + 1] && !lab[c + 1]) { lab[c + 1] = next; stack[sp++] = c + 1; }
        if (c >= n && !L[c - n] && !lab[c - n]) { lab[c - n] = next; stack[sp++] = c - n; }
        if (c < n * n - n && !L[c + n] && !lab[c + n]) { lab[c + n] = next; stack[sp++] = c + n; }
      }
    }
    let big = 0; for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[big]) big = i; this.main = big;   // the open map; everything else is a pocket between obstacles
  }
  // is (x, z) in a pocket cut off from the open map (or blocked)? orders never end there
  inPocket(x, z) { const r = this.region(this.cellOf(x), this.cellOf(z)); return !r || r !== this.main; }
  // the nearest cell of the open map, out to r cells
  nearestMain(ix, iz, r = 15) {
    if (!this.labels) this.labelRegions();
    for (let d = 0; d <= r; d++) for (let dz = -d; dz <= d; dz++) for (let dx = -d; dx <= d; dx++)
      if ((Math.abs(dx) === d || Math.abs(dz) === d) && this.region(ix + dx, iz + dz) === this.main) return [ix + dx, iz + dz];
    return null;
  }
  // mark one obstacle box placed after the build (sandbags)
  block(o, pad = this.pad) {
    this.labels = null;
    const L = this.L, x0 = Math.max(0, this.cellOf(o.minX - pad)), x1 = Math.min(this.n - 1, this.cellOf(o.maxX + pad)), z0 = Math.max(0, this.cellOf(o.minZ - pad)), z1 = Math.min(this.n - 1, this.cellOf(o.maxZ + pad));
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) L[iz * this.n + ix] = 1;
  }

  // Works the cells in a box out again from the ground, the obstacles (the same list build() had, which grows as sandbags
  // go up) and the extra blocks (this.extra: the tank traps, on the vehicle grid): what has to happen when a block is
  // taken away, which block() alone cannot undo.
  refresh(minX, maxX, minZ, maxZ) {
    const { obstacles, terrain, maxSlope, passable } = this.src, L = this.L, n = this.n, pad = this.pad, border = Math.ceil(3 / this.cell);
    const x0 = Math.max(0, this.cellOf(minX - pad)), x1 = Math.min(n - 1, this.cellOf(maxX + pad)), z0 = Math.max(0, this.cellOf(minZ - pad)), z1 = Math.min(n - 1, this.cellOf(maxZ + pad));
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      const x = this.world(ix), z = this.world(iz); let b = ix < border || iz < border || ix >= n - border || iz >= n - border;
      if (!b && terrain && !(passable && passable(x, z))) b = terrain.slope(x, z) > maxSlope || terrain.height(x, z) < terrain.water - terrain.wade;
      L[iz * n + ix] = b ? 1 : 0;
    }
    for (const o of [...obstacles, ...(this.extra || [])]) {
      if (o.maxX + pad < this.world(x0) - this.cell || o.minX - pad > this.world(x1) + this.cell || o.maxZ + pad < this.world(z0) - this.cell || o.minZ - pad > this.world(z1) + this.cell) continue;
      const ax = Math.max(x0, this.cellOf(o.minX - pad)), bx = Math.min(x1, this.cellOf(o.maxX + pad)), az = Math.max(z0, this.cellOf(o.minZ - pad)), bz = Math.min(z1, this.cellOf(o.maxZ + pad));
      for (let iz = az; iz <= bz; iz++) for (let ix = ax; ix <= bx; ix++) L[iz * n + ix] = 1;
    }
    this.labels = null;
  }

  nearest(ix, iz, r = 8) {
    if (this.passable(ix, iz)) return [ix, iz];
    for (let d = 1; d <= r; d++) for (let dx = -d; dx <= d; dx++) for (let dz = -d; dz <= d; dz++)
      if ((Math.abs(dx) === d || Math.abs(dz) === d) && this.passable(ix + dx, iz + dz)) return [ix + dx, iz + dz];
    return null;
  }
  lineClear(x0, z0, x1, z1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) { const t = s / steps; if (!this.passable(this.cellOf(x0 + (x1 - x0) * t), this.cellOf(z0 + (z1 - z0) * t))) return false; }
    return true;
  }
  push(i) { const h = this.heap, f = this.f; let k = this.heapN++; h[k] = i; while (k > 0) { const p = (k - 1) >> 1; if (f[h[p]] <= f[h[k]]) break; [h[p], h[k]] = [h[k], h[p]]; k = p; } }
  pop() {
    const h = this.heap, f = this.f, top = h[0]; h[0] = h[--this.heapN]; let k = 0;
    for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < this.heapN && f[h[l]] < f[h[m]]) m = l; if (r < this.heapN && f[h[r]] < f[h[m]]) m = r; if (m === k) break; [h[m], h[k]] = [h[k], h[m]]; k = m; }
    return top;
  }

  // world start/end -> array of [x, z] waypoints (excluding start), or null if unreachable
  // Gates: a map's long barriers (a river, a line of bluffs) that run the width of the map along z = at (axis 'z', the
  // default) or its height along x = at (axis 'x': a river running north-south), crossed only at a few portals ({ x, d,
  // foot }: x is the portal's place along the line, crossed from d metres before the line to d metres past it; foot:
  // infantry only). A route from one side to the other goes portal to portal, the shortest chain in straight lines, each
  // leg a search that stays on one side, so a search never floods a whole river bank looking for the way over.
  setGates(gates, vehicle, axis = 'z') { this.gateAxis = axis; this.gates = gates.map(g => ({ at: g.at, portals: g.portals.filter(p => !(vehicle && p.foot)) })).sort((a, b) => a.at - b.at); }
  across(x, z) { return this.gateAxis === 'x' ? x : z; }   // the coordinate the gate lines cut
  zone(v) { let k = 0; for (const g of this.gates) if (v > g.at) k++; return k; }
  // worked in (u along the lines, v across them); W turns a (u, v) pair back into world (x, z)
  gatedPath(sx, sz, tx, tz, a, b, maxExpand) {
    const X = this.gateAxis === 'x', W = (u, v) => (X ? [v, u] : [u, v]);
    const [su, sv] = W(sx, sz), [tu, tv] = W(tx, tz);   // W is its own inverse
    const dir = b > a ? 1 : -1, lines = []; for (let k = a; k !== b; k += dir) lines.push(this.gates[dir > 0 ? k : k - 1]);
    const inside = (u, v, g, p) => Math.abs(v - g.at) <= p.d && Math.abs(u - p.x) <= 25;   // already in the pass or on the bridge
    // every chain of portals with its length in straight lines; the shortest first, and if one fails (a crossing blocked:
    // tank traps on the bridge) the next, up to four
    const chains = [];
    const walk = (i, pu, pv, len, picks) => {
      if (i === lines.length) { chains.push({ len: len + Math.hypot(tu - pu, tv - pv), picks: picks.slice() }); return; }
      const g = lines[i];
      for (const p of g.portals) { picks.push(p); walk(i + 1, p.x, g.at + dir * p.d, len + Math.hypot(p.x - pu, g.at - dir * p.d - pv) + 2 * p.d, picks); picks.pop(); }
    };
    walk(0, su, sv, 0, []);
    chains.sort((a, b) => a.len - b.len);
    for (const { picks } of chains.slice(0, 4)) {
      const out = []; let pu = su, pv = sv;
      const leg = (u0, v0, u1, v1) => { const p = this.findPath(...W(u0, v0), ...W(u1, v1), maxExpand, true); if (!p) throw new Error('leg'); out.push(...p); };
      try {
        picks.forEach((p, i) => {
          const g = lines[i], ev = g.at - dir * p.d, xv = g.at + dir * p.d, inS = i === 0 && inside(su, sv, g, p);
          if (!inS) leg(pu, pv, p.x, ev);
          leg(inS ? su : p.x, inS ? sv : ev, p.x, xv);   // over the bridge, through the pass
          pu = p.x; pv = xv;
        });
        leg(pu, pv, tu, tv);
        return out;
      } catch { /* this chain is blocked somewhere: the next */ }
    }
    return null;
  }
  findPath(sx, sz, tx, tz, maxExpand = this.cap, oneSide = false) {
    // two ends on separate patches of open ground (an island for a vehicle, a pocket between buildings) have no route:
    // say so at once rather than flood the map looking for one
    if (!oneSide) { const s = this.nearest(this.cellOf(sx), this.cellOf(sz)), t = this.nearest(this.cellOf(tx), this.cellOf(tz)); if (!s || !t || this.region(s[0], s[1]) !== this.region(t[0], t[1])) return null; }
    if (this.gates && !oneSide) { const a = this.zone(this.across(sx, sz)), b = this.zone(this.across(tx, tz)); if (a !== b) return this.gatedPath(sx, sz, tx, tz, a, b, maxExpand); }
    const n = this.n;
    const s = this.nearest(this.cellOf(sx), this.cellOf(sz)), t = this.nearest(this.cellOf(tx), this.cellOf(tz));
    if (!s || !t) return null;
    const goal = t[1] * n + t[0], start = s[1] * n + s[0];
    if (this.lineClear(sx, sz, this.world(t[0]), this.world(t[1]))) return [[tx, tz]];
    const gen = ++this.gen, g = this.g, f = this.f, st = this.stamp, closed = this.closed, par = this.parent;
    const hw = this.hw, H = (i) => { const dx = Math.abs((i % n) - t[0]), dz = Math.abs(Math.floor(i / n) - t[1]); return hw * (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)); };
    this.heapN = 0; st[start] = gen; g[start] = 0; f[start] = H(start); par[start] = -1; this.push(start);
    let expanded = 0, found = false;
    while (this.heapN > 0) {
      const cur = this.pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur] === gen) continue; closed[cur] = gen;
      if (++expanded > maxExpand) break;
      const cx = cur % n, cz = Math.floor(cur / n);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.passable(nx, nz)) continue;
        if (dx && dz && (!this.passable(cx + dx, cz) || !this.passable(cx, cz + dz))) continue;
        const ni = nz * n + nx, ng = g[cur] + (dx && dz ? 1.414 : 1);
        if (st[ni] === gen && ng >= g[ni]) continue;
        st[ni] = gen; g[ni] = ng; f[ni] = ng + H(ni); par[ni] = cur; this.push(ni);
      }
    }
    if (!found) return null;
    const cells = []; for (let i = goal; i !== -1; i = par[i]) cells.push(i); cells.reverse();
    const pts = []; let anchor = [sx, sz], last = null;
    for (let k = 1; k < cells.length; k++) {
      const p = [this.world(cells[k] % n), this.world(Math.floor(cells[k] / n))];
      if (last && !this.lineClear(anchor[0], anchor[1], p[0], p[1])) { pts.push(last); anchor = last; }
      last = p;
    }
    pts.push([tx, tz]);
    return pts;
  }
}
