// Uniform grid over unit positions for neighbour queries (targeting, separation).
export class SpatialHash {
  constructor(cell = 8) { this.cell = cell; this.map = new Map(); }
  key(ix, iz) { return (ix + 1024) * 4096 + (iz + 1024); }
  rebuild(units) {
    this.map.clear();
    for (const u of units) {
      if (u.dead || u.mounted) continue;
      const k = this.key(Math.floor(u.pos.x / this.cell), Math.floor(u.pos.z / this.cell));
      let b = this.map.get(k); if (!b) { b = []; this.map.set(k, b); } b.push(u);
    }
  }
  // all live units within r of (x, z); `out` is reused by callers to avoid allocation
  query(x, z, r, out = []) {
    out.length = 0;
    const c = this.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c), r2 = r * r;
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const b = this.map.get(this.key(ix, iz)); if (!b) continue;
      for (const u of b) { const dx = u.pos.x - x, dz = u.pos.z - z; if (dx * dx + dz * dz <= r2) out.push(u); }
    }
    return out;
  }
  // visit each close pair once
  forEachPair(maxDist, fn) {
    const c = this.cell, span = Math.ceil(maxDist / c);
    for (const [k, b] of this.map) {
      const ix = Math.floor(k / 4096) - 1024, iz = (k % 4096) - 1024;
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) fn(b[i], b[j]);
      for (let dx = 0; dx <= span; dx++) for (let dz = -span; dz <= span; dz++) {
        if (dx === 0 && dz <= 0) continue;
        const o = this.map.get(this.key(ix + dx, iz + dz)); if (!o) continue;
        for (const a of b) for (const d of o) fn(a, d);
      }
    }
  }
}
