import { Mode } from './base.js';

// Skirmish: no objectives. Tickets only; the higher count at full time wins.
export class Skirmish extends Mode {
  static key = 'skirmish'; static name = 'Skirmish'; static desc = 'No objectives: break the enemy force. First to 0 tickets loses; higher tickets at full time wins.';
  goals(team, extra = []) { return { attack: null, hold: null, threatened: extra.filter(l => this.match.enemiesNear(team, l.x, l.z, l.r + 25) > 0), fobAnchor: null, attackShare: 1, hunt: true }; }
}
