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
  }
  build(obstacles, terrain = null, maxSlope = 1, passable = null) {
    const L = this.L, pad = this.pad; L.fill(0);
    if (terrain) for (let iz = 0; iz < this.n; iz++) for (let ix = 0; ix < this.n; ix++) {   // steep ground and water are impassable, bridges always pass
      const x = this.world(ix), z = this.world(iz);
      if (passable && passable(x, z)) continue;
      if (terrain.slope(x, z) > maxSlope || terrain.height(x, z) < terrain.water + 0.3) L[iz * this.n + ix] = 1;
    }
    const border = Math.ceil(3 / this.cell);
    for (let iz = 0; iz < this.n; iz++) for (let ix = 0; ix < this.n; ix++)
      if (ix < border || iz < border || ix >= this.n - border || iz >= this.n - border) L[iz * this.n + ix] = 1;
    for (const o of obstacles) {
      const x0 = Math.max(0, this.cellOf(o.minX - pad)), x1 = Math.min(this.n - 1, this.cellOf(o.maxX + pad));
      const z0 = Math.max(0, this.cellOf(o.minZ - pad)), z1 = Math.min(this.n - 1, this.cellOf(o.maxZ + pad));
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) L[iz * this.n + ix] = 1;
    }
  }
  cellOf(v) { return Math.floor((v + this.half) / this.cell); }
  world(i) { return (i + 0.5) * this.cell - this.half; }
  passable(ix, iz) { return ix >= 0 && iz >= 0 && ix < this.n && iz < this.n && this.L[iz * this.n + ix] === 0; }
  blocked(x, z) { return !this.passable(this.cellOf(x), this.cellOf(z)); }
  // mark one obstacle box placed after the build (sandbags)
  block(o, pad = this.pad) {
    const L = this.L, x0 = Math.max(0, this.cellOf(o.minX - pad)), x1 = Math.min(this.n - 1, this.cellOf(o.maxX + pad)), z0 = Math.max(0, this.cellOf(o.minZ - pad)), z1 = Math.min(this.n - 1, this.cellOf(o.maxZ + pad));
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) L[iz * this.n + ix] = 1;
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
  findPath(sx, sz, tx, tz, maxExpand = 80000) {
    const n = this.n;
    const s = this.nearest(this.cellOf(sx), this.cellOf(sz)), t = this.nearest(this.cellOf(tx), this.cellOf(tz));
    if (!s || !t) return null;
    const goal = t[1] * n + t[0], start = s[1] * n + s[0];
    if (this.lineClear(sx, sz, this.world(t[0]), this.world(t[1]))) return [[tx, tz]];
    const gen = ++this.gen, g = this.g, f = this.f, st = this.stamp, closed = this.closed, par = this.parent;
    const H = (i) => { const dx = Math.abs((i % n) - t[0]), dz = Math.abs(Math.floor(i / n) - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
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
