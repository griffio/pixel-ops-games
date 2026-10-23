// A game mode owns the objectives, the mode-specific ticket rules and the win
// condition, and tells the HUD and the CPU commander what matters.
export class Mode {
  static key = 'base'; static name = 'Mode'; static desc = ''; static sides = false;
  constructor(match, opts = {}) { this.match = match; this.opts = opts; this.teams = match.teams; this.units = match.units; }
  tickets(team) { return 400; }
  get length() { return 25 * 60; }
  setup() {}
  tick(dt) {}
  // { winner: team | null (draw), reason } when the mode decides the match, else null
  check() { return null; }
  // objectives bar: [{ name, owner (-1/0/1), progress (-100..100), note }]
  bar() { return []; }
  drawMinimap(g, X, Z, k) {}
  // what the CPU should do: attack / hold targets ({x,z,r,index,n?}), threatened places,
  // the FOB anchor, and the fraction of free squads to commit to the attack
  goals(team) { return { attack: null, hold: null, threatened: [], fobAnchor: null, attackShare: 0.65 }; }
  // enemy structures worth raiding near a point
  raidTarget(team, near) { return null; }
}
