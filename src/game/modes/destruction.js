import { Mode } from './base.js';

// Destruction: the defenders hide three weapon caches, one active at a time, in the
// locations on their side. Attackers find and destroy them before the clock; each
// cache lost costs the defenders 80 tickets.
export class Destruction extends Mode {
  static key = 'destruction'; static name = 'Destruction'; static desc = 'Attackers hunt three weapon caches hidden near the defenders’ locations, one at a time, before the 20-minute clock. Each cache lost costs the defenders 80 tickets.'; static sides = true;
  static minutes = 20;
  get attacker() { return this.opts.side === 'defend' ? 1 : 0; }
  get defender() { return 1 - this.attacker; }
  tickets(team) { return team === this.attacker ? 600 : 450; }
  setup() {
    const map = this.match.world.map, locs = this.defender === 1 ? [...map.locations].reverse() : map.locations;
    // caches in the three locations nearest the defenders' base, revealed nearest-first
    const sites = locs.slice(0, 3).reverse();
    this.caches = sites.map((site, i) => {
      const [x, z] = this.units.freePoint(3, 60, site.x, site.z, site.r * 0.8);
      const u = this.units.spawn('cache', x, z, Math.random() * Math.PI * 2, this.defender);
      u.label = `CACHE ${i + 1}`; u.group.visible = false;
      return { unit: u, site, index: i, state: 'hidden', t: 0 };
    });
    this.phase = 0;
  }
  get active() { return this.caches[this.phase] || null; }
  tick(dt) {
    const c = this.active; if (!c) return;
    if (c.state === 'hidden') {
      c.t += dt;
      const near = this.match.enemiesNear(this.defender, c.unit.pos.x, c.unit.pos.z, 70, true) > 0;   // a rule: anyone close finds it
      if (near || c.t > 90) { c.state = 'revealed'; c.unit.group.visible = true; this.match.event({ type: 'cache revealed', loc: c.site, team: this.attacker }); }
    }
    if (c.unit.dead && c.state !== 'destroyed') {
      c.state = 'destroyed'; this.teams[this.defender].tickets -= 80; this.phase++;
      this.match.event({ type: 'cache destroyed', loc: c.site, team: this.attacker });
    }
  }
  check() {
    if (this.phase >= this.caches.length) return { winner: this.teams[this.attacker], reason: 'destroyed every cache' };
    if (this.match.time <= 0) return { winner: this.teams[this.defender], reason: 'caches survived the clock' };
    return null;
  }
  bar() {
    return this.caches.map((c, i) => ({ name: c.site.name, owner: c.state === 'destroyed' ? this.attacker : this.defender, progress: c.state === 'destroyed' ? 100 : 0,
      note: c.state === 'destroyed' ? 'destroyed' : c.state === 'revealed' ? `cache ${c.unit.hp}/${c.unit.maxHp}` : i === this.phase ? 'cache hidden' : 'later' }));
  }
  drawMinimap(g, X, Z, k) {
    for (const c of this.caches) {
      if (c.state === 'hidden' && c.index === this.phase) { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.setLineDash([3, 3]); g.lineWidth = 1; g.beginPath(); g.arc(X(c.site.x), Z(c.site.z), c.site.r * k, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      if (c.state === 'revealed') { const x = X(c.unit.pos.x), z = Z(c.unit.pos.z); g.fillStyle = '#ffd25a'; g.beginPath(); g.moveTo(x, z - 5); g.lineTo(x + 5, z); g.lineTo(x, z + 5); g.lineTo(x - 5, z); g.closePath(); g.fill(); }
    }
  }
  goals(team, extra = []) {
    const c = this.active;
    if (!c) return { attack: null, hold: null, threatened: [], fobAnchor: null, attackShare: 0 };
    const cachePt = { x: c.unit.pos.x, z: c.unit.pos.z, r: 16, index: 'cache' + c.index, n: [0, 0] };
    const sitePt = { x: c.site.x, z: c.site.z, r: c.site.r, index: 'site' + c.index, n: [0, 0] };
    const threatened = extra.filter(l => this.match.enemiesNear(team, l.x, l.z, l.r + 25) > 0);
    if (team === this.attacker) {
      const prev = this.caches[this.phase - 1];
      return { attack: c.state === 'revealed' ? cachePt : sitePt, hold: null, threatened, fobAnchor: prev ? prev.site : null, attackShare: 0.85 };
    }
    return { attack: null, hold: c.state === 'revealed' ? cachePt : sitePt, threatened: [...threatened, ...(this.match.enemiesNear(team, c.unit.pos.x, c.unit.pos.z, 60) ? [cachePt] : [])], fobAnchor: c.site, attackShare: 0 };
  }
}
