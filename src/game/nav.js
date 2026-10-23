// 1-unit navigation grid with A* (8-neighbour, no corner cutting) and string-pulling.
// Two passability layers: 'foot' (infantry) and 'vehicle' (wider clearance).
export class NavGrid {
  constructor(size = 160, cell = 1) {
    this.size = size; this.cell = cell; this.half = size / 2; this.n = Math.round(size / cell);
    const N = this.n * this.n;
    this.layers = { foot: new Uint8Array(N), vehicle: new Uint8Array(N) };
    this.g = new Float32Array(N); this.f = new Float32Array(N); this.parent = new Int32Array(N);
    this.stamp = new Int32Array(N); this.closed = new Int32Array(N); this.gen = 0;
    this.heap = new Int32Array(N); this.heapN = 0;
  }
  build(obstacles) {
    for (const [name, pad] of [['foot', 0.6], ['vehicle', 2.2]]) {
      const L = this.layers[name]; L.fill(0);
      const border = Math.ceil(2 / this.cell);
      for (let iz = 0; iz < this.n; iz++) for (let ix = 0; ix < this.n; ix++)
        if (ix < border || iz < border || ix >= this.n - border || iz >= this.n - border) L[iz * this.n + ix] = 1;
      for (const o of obstacles) {
        const x0 = Math.max(0, this.cellOf(o.minX - pad)), x1 = Math.min(this.n - 1, this.cellOf(o.maxX + pad));
        const z0 = Math.max(0, this.cellOf(o.minZ - pad)), z1 = Math.min(this.n - 1, this.cellOf(o.maxZ + pad));
        for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) L[iz * this.n + ix] = 1;
      }
    }
  }
  cellOf(v) { return Math.floor((v + this.half) / this.cell); }
  world(i) { return (i + 0.5) * this.cell - this.half; }
  passable(L, ix, iz) { return ix >= 0 && iz >= 0 && ix < this.n && iz < this.n && L[iz * this.n + ix] === 0; }
  blocked(layer, x, z) { return !this.passable(this.layers[layer], this.cellOf(x), this.cellOf(z)); }

  // nearest passable cell to (ix, iz) within radius r (ring search)
  nearest(L, ix, iz, r = 6) {
    if (this.passable(L, ix, iz)) return [ix, iz];
    for (let d = 1; d <= r; d++) for (let dx = -d; dx <= d; dx++) for (let dz = -d; dz <= d; dz++)
      if ((Math.abs(dx) === d || Math.abs(dz) === d) && this.passable(L, ix + dx, iz + dz)) return [ix + dx, iz + dz];
    return null;
  }
  lineClear(L, x0, z0, x1, z1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) { const t = s / steps; if (!this.passable(L, this.cellOf(x0 + (x1 - x0) * t), this.cellOf(z0 + (z1 - z0) * t))) return false; }
    return true;
  }

  // binary heap on f
  push(i) { const h = this.heap, f = this.f; let k = this.heapN++; h[k] = i; while (k > 0) { const p = (k - 1) >> 1; if (f[h[p]] <= f[h[k]]) break; [h[p], h[k]] = [h[k], h[p]]; k = p; } }
  pop() {
    const h = this.heap, f = this.f, top = h[0]; h[0] = h[--this.heapN]; let k = 0;
    for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < this.heapN && f[h[l]] < f[h[m]]) m = l; if (r < this.heapN && f[h[r]] < f[h[m]]) m = r; if (m === k) break; [h[m], h[k]] = [h[k], h[m]]; k = m; }
    return top;
  }

  // world start/end -> array of [x, z] waypoints (excluding start), or null if unreachable
  findPath(layer, sx, sz, tx, tz, maxExpand = 40000) {
    const L = this.layers[layer], n = this.n;
    const s = this.nearest(L, this.cellOf(sx), this.cellOf(sz)), t = this.nearest(L, this.cellOf(tx), this.cellOf(tz));
    if (!s || !t) return null;
    const goal = t[1] * n + t[0], start = s[1] * n + s[0];
    if (this.lineClear(L, sx, sz, this.world(t[0]), this.world(t[1]))) return [[tx, tz]];
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
        if (!this.passable(L, nx, nz)) continue;
        if (dx && dz && (!this.passable(L, cx + dx, cz) || !this.passable(L, cx, cz + dz))) continue;
        const ni = nz * n + nx, ng = g[cur] + (dx && dz ? 1.414 : 1);
        if (st[ni] === gen && ng >= g[ni]) continue;
        st[ni] = gen; g[ni] = ng; f[ni] = ng + H(ni); par[ni] = cur; this.push(ni);
      }
    }
    if (!found) return null;
    const cells = []; for (let i = goal; i !== -1; i = par[i]) cells.push(i); cells.reverse();
    // string pulling: keep only waypoints needed to keep the line clear
    const pts = [[sx, sz]];
    let anchor = [sx, sz], last = null;
    for (let k = 1; k < cells.length; k++) {
      const p = [this.world(cells[k] % n), this.world(Math.floor(cells[k] / n))];
      if (last && !this.lineClear(L, anchor[0], anchor[1], p[0], p[1])) { pts.push(last); anchor = last; }
      last = p;
    }
    pts.push([tx, tz]); pts.shift();
    return pts;
  }
}
