import { Mode } from './base.js';
import { RULES } from '../rules.js';

// Territory Control: a hex grid over the map. A hex can be captured when it touches
// one you own; holding more hexes bleeds the enemy; 80% of the land wins outright.
export class Territory extends Mode {
  static key = 'territory'; static name = 'Territory Control'; static desc = 'Spread across a hex grid from your base; capture only hexes touching your own. More hexes bleeds the enemy; 80% of the land wins.';
  tickets() { return 400; }
  setup() {
    const m = this.match, half = m.world.half, R = 68, w = Math.sqrt(3) * R;
    this.R = R; this.hexes = []; const byKey = new Map();
    for (let q = -12; q <= 12; q++) for (let r = -12; r <= 12; r++) {
      const x = R * 1.5 * q, z = w * (r + q / 2);
      if (Math.abs(x) > half - 30 || Math.abs(z) > half - 30) continue;
      const land = !(m.world.terrain && m.world.terrain.underwater(x, z));
      const h = { q, r, x, z, owner: -1, progress: 0, land, n: [0, 0] }; this.hexes.push(h); byKey.set(q + ',' + r, h);
    }
    for (const h of this.hexes) h.adj = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].map(([dq, dr]) => byKey.get((h.q + dq) + ',' + (h.r + dr))).filter(Boolean);
    for (const t of this.teams) { const b = this.hexAt(t.base.x, t.base.z); b.owner = t.id; b.progress = t.id === 0 ? 100 : -100; b.home = t.id; }
    this.landCount = this.hexes.filter(h => h.land).length; this.bleedAcc = 0;
  }
  hexAt(x, z) { let best = null, bd = Infinity; for (const h of this.hexes) { const d = (h.x - x) ** 2 + (h.z - z) ** 2; if (d < bd) { bd = d; best = h; } } return best; }
  owned(team) { return this.hexes.filter(h => h.owner === team).length; }
  capturable(team, h) { return h.home === undefined && h.land && h.adj.some(a => a.owner === team); }
  tick(dt) {
    for (const h of this.hexes) h.n[0] = h.n[1] = 0;
    for (const u of this.units.units) { if (u.dead || u.mounted || u.spec.structure || (u.spec.air && u.alt > 1)) continue; const h = this.hexAt(u.pos.x, u.pos.z); h.n[u.team]++; }
    for (const h of this.hexes) {
      const [n0, n1] = h.n; if ((n0 && n1) || (!n0 && !n1) || h.home !== undefined) continue;
      const team = n0 ? 0 : 1; if (h.owner === team || !this.capturable(team, h)) continue;
      const sign = team === 0 ? 1 : -1;
      h.progress = Math.max(-100, Math.min(100, h.progress + sign * Math.min(8, n0 || n1) * RULES.captureRate * 1.6 * dt));
      if (h.owner === 1 - team && sign * h.progress >= 0) { const loser = h.owner; h.owner = -1; this.match.event({ type: 'hex lost', team: loser }); }
      if (h.owner !== team && Math.abs(h.progress) >= 100) { h.owner = team; }
    }
    const o0 = this.owned(0), o1 = this.owned(1);
    if (o0 !== o1) { this.bleedAcc += dt; while (this.bleedAcc >= RULES.bleedEvery) { this.bleedAcc -= RULES.bleedEvery; this.teams[o0 > o1 ? 1 : 0].tickets -= 1; } }
  }
  check() {
    for (const t of this.teams) if (this.owned(t.id) >= Math.ceil(this.landCount * 0.8)) return { winner: t, reason: 'controls 80% of the territory' };
    return null;
  }
  bar() {
    const o0 = this.owned(0), o1 = this.owned(1);
    return [{ name: 'BLUFOR', owner: 0, progress: o0 / this.landCount * 100, note: `${o0} hexes` }, { name: 'neutral', owner: -1, progress: 0, note: `${this.landCount - o0 - o1} hexes` }, { name: 'OPFOR', owner: 1, progress: -o1 / this.landCount * 100, note: `${o1} hexes` }];
  }
  drawMinimap(g, X, Z, k) {
    const R = this.R * k;
    for (const h of this.hexes) {
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const px = X(h.x) + Math.cos(a) * R * 0.96, pz = Z(h.z) + Math.sin(a) * R * 0.96; i ? g.lineTo(px, pz) : g.moveTo(px, pz); } g.closePath();
      g.fillStyle = h.owner === 0 ? 'rgba(127,178,229,0.35)' : h.owner === 1 ? 'rgba(232,106,90,0.35)' : h.land ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.15)';
      g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.5; g.stroke();
      if (h.owner === -1 && h.progress) { g.strokeStyle = h.progress > 0 ? '#7fb2e5' : '#e86a5a'; g.lineWidth = 1.5; g.beginPath(); g.arc(X(h.x), Z(h.z), R * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.abs(h.progress) / 100); g.stroke(); }
    }
  }
  goals(team, extra = []) {
    const eb = this.teams[1 - team].base, mb = this.teams[team].base;
    const cand = this.hexes.filter(h => h.owner !== team && this.capturable(team, h));
    // push toward the enemy base, preferring hexes the enemy holds lightly
    cand.sort((a, b) => (Math.hypot(a.x - eb.x, a.z - eb.z) + a.n[1 - team] * 25) - (Math.hypot(b.x - eb.x, b.z - eb.z) + b.n[1 - team] * 25));
    const toPt = (h, idx) => h ? { x: h.x, z: h.z, r: this.R * 0.7, index: idx, n: h.n } : null;
    const attack = toPt(cand[0], 'hex' + (cand[0] ? cand[0].q + ',' + cand[0].r : ''));
    const mine = this.hexes.filter(h => h.owner === team && h.home === undefined);
    const threatenedHex = mine.filter(h => h.n[1 - team] > 0).sort((a, b) => b.n[1 - team] - a.n[1 - team])[0];
    const front = mine.sort((a, b) => Math.hypot(a.x - eb.x, a.z - eb.z) - Math.hypot(b.x - eb.x, b.z - eb.z))[0];
    const threatened = [...extra.filter(l => this.match.enemiesNear(team, l.x, l.z, l.r + 25) > 0), ...(threatenedHex ? [toPt(threatenedHex, 'hexT')] : [])];
    return { attack, hold: threatened[0] || toPt(front, 'front'), threatened, fobAnchor: front ? { x: front.x, z: front.z, r: this.R * 0.7 } : null, attackShare: 0.7 };
  }
}
