import { Mode } from './base.js';
import { Objectives } from '../objectives.js';
import { RULES } from '../rules.js';

// Advance and Secure: a lattice of locations captured in order; holding the majority
// bleeds the enemy; losing a location costs tickets; capturing all of them wins.
export class AAS extends Mode {
  static key = 'aas'; static name = 'Advance & Secure'; static desc = 'Capture the five locations in order. Hold the majority to bleed the enemy; take all five to win outright.';
  setup() {
    const map = this.match.world.map;
    this.objectives = new Objectives(map.locations, this.teams, map.links || null); this.bleedAcc = 0;
    this.objectives.onEvent = (type, loc, team) => this.onEvent(type, loc, team);
  }
  onEvent(type, loc, team) {
    if (type === 'lost') this.teams[team].tickets -= RULES.ticketCost.location;
    if (type === 'captured' && this.teams[team].doctrine.captureBonus) this.teams[team].tickets += this.teams[team].doctrine.captureBonus;
    this.match.event({ type, loc, team });
  }
  tick(dt) {
    this.objectives.tick(dt, this.match.spatial);
    const o0 = this.objectives.owned(0), o1 = this.objectives.owned(1);
    if (o0 !== o1) { this.bleedAcc += dt; while (this.bleedAcc >= RULES.bleedEvery) { this.bleedAcc -= RULES.bleedEvery; this.teams[o0 > o1 ? 1 : 0].tickets -= 1; } }
  }
  check() {
    if (this.objectives.allOwned(0)) return { winner: this.teams[0], reason: 'captured every location' };
    if (this.objectives.allOwned(1)) return { winner: this.teams[1], reason: 'captured every location' };
    return null;
  }
  bar() { return this.objectives.list.map(l => ({ name: l.name, owner: l.owner, progress: l.progress, note: l.owner === 0 ? 'BLUFOR' : l.owner === 1 ? 'OPFOR' : (l.progress ? 'capturing' : 'neutral') })); }
  drawMinimap(g, X, Z, k) {
    for (const l of this.objectives.list) {
      g.fillStyle = l.owner === 0 ? 'rgba(127,178,229,0.35)' : l.owner === 1 ? 'rgba(232,106,90,0.35)' : 'rgba(255,255,255,0.15)';
      g.beginPath(); g.arc(X(l.x), Z(l.z), l.r * k, 0, Math.PI * 2); g.fill();
      if (l.owner === -1 && l.progress) { g.strokeStyle = l.progress > 0 ? '#7fb2e5' : '#e86a5a'; g.lineWidth = 2; g.beginPath(); g.arc(X(l.x), Z(l.z), l.r * k, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.abs(l.progress) / 100); g.stroke(); }
    }
  }
  threatenedOf(team, extra = []) {
    const places = [...this.objectives.list.filter(l => l.owner === team), ...extra];
    return places.filter(l => l.contested || l.pushing === 1 - team || this.match.enemiesNear(team, l.x, l.z, l.r + 25) > 0);   // the capture bar shows a fight anyone can see
  }
  goals(team, extra = []) {
    const o = this.objectives, attack = o.nextFor(team), front = o.front(team), threatened = this.threatenedOf(team, extra);
    return { attack, hold: threatened[0] || front, threatened, fobAnchor: front, attackShare: 0.65 };
  }
}
