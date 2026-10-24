import { AAS } from './aas.js';
import { RULES } from '../rules.js';

// Invasion: the defenders start owning every location with fewer tickets; attackers
// must take all of them before the clock runs out. Each capture costs the defenders.
export class Invasion extends AAS {
  static key = 'invasion'; static name = 'Invasion'; static desc = 'Attackers must capture every location before the 20-minute clock; defenders start with all of them but fewer tickets (650 vs 400).'; static sides = true;
  get attacker() { return this.opts.side === 'defend' ? 1 : 0; }
  get defender() { return 1 - this.attacker; }
  tickets(team) { return team === this.attacker ? 650 : 400; }
  get length() { return 20 * 60; }
  setup() {
    super.setup();
    for (const l of this.objectives.list) { l.owner = this.defender; l.progress = this.defender === 0 ? 100 : -100; }
  }
  onEvent(type, loc, team) {
    if (type === 'lost' && team === this.defender) this.teams[team].tickets -= 30;   // each location the defenders give up
    if (type === 'captured' && this.teams[team].doctrine.captureBonus) this.teams[team].tickets += this.teams[team].doctrine.captureBonus;
    this.match.event({ type, loc, team });
  }
  tick(dt) { this.objectives.tick(dt, this.match.spatial); }   // no majority bleed
  check() {
    if (this.objectives.allOwned(this.attacker)) return { winner: this.teams[this.attacker], reason: 'captured every location' };
    if (this.match.time <= 0) return { winner: this.teams[this.defender], reason: 'held out until the clock ran down' };
    return null;
  }
  goals(team, extra = []) {
    const o = this.objectives, order = o.order(this.attacker);
    const frontline = order.find(l => l.owner !== this.attacker) || null;           // first location the attackers still need
    if (team === this.attacker) return { attack: frontline, hold: o.front(team), threatened: this.threatenedOf(team, extra), fobAnchor: o.front(team), attackShare: 0.9 };
    const next = order[order.indexOf(frontline) + 1] || frontline;
    const threatened = this.threatenedOf(team, extra);
    return { attack: frontline && frontline.owner !== team ? frontline : null, hold: frontline, reserve: next, threatened, fobAnchor: next, attackShare: frontline && frontline.owner !== team ? 0.5 : 0 };
  }
}
