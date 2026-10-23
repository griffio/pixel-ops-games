// CPU difficulty: multipliers the match applies to the CPU-controlled team only.
// acc/dmg scale its weapons, respawn its timers, plan is the commander's re-plan
// interval in seconds, attackShare shifts how much of the force attacks, kits adds
// FOB kits, logistics gates FOB building.
export const DIFFICULTY = {
  easy:   { name: 'Easy',   desc: 'CPU shoots worse, respawns slower, never builds FOBs', acc: 0.75, dmg: 0.85, respawn: 1.3, plan: 7, attackShare: -0.1, kits: 0, logistics: false },
  normal: { name: 'Normal', desc: 'Even terms', acc: 1, dmg: 1, respawn: 1, plan: 5, attackShare: 0, kits: 0, logistics: true },
  hard:   { name: 'Hard',   desc: 'CPU shoots better, respawns faster, an extra FOB kit, keener attacks', acc: 1.2, dmg: 1.15, respawn: 0.8, plan: 3.5, attackShare: 0.12, kits: 1, logistics: true },
};
export const difficulty = (k) => DIFFICULTY[k] || DIFFICULTY.normal;
