export class Team {
  constructor(id, name, base, tickets, color) { this.id = id; this.name = name; this.base = base; this.tickets = tickets; this.color = color; this.kills = 0; this.losses = 0; this.loadout = null; this.doctrine = null; this.loadoutName = ''; this.spawnPref = 'auto'; this.fobKits = 0; this.landing = null; }
  // where ground units go home to: the main base, or for a side based on a ship the beach its landing craft use (game/landing.js)
  get home() { return this.landing ? this.landing.home() : this.base; }
  // random point inside the base circle that is not blocked
  spawnPoint(world, pad = 3) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * (this.base.r - 4);
      const x = this.base.x + Math.cos(a) * r, z = this.base.z + Math.sin(a) * r;
      if (!world.isBlocked(x, z, pad)) return [x, z];
    }
    return [this.base.x, this.base.z];
  }
}
export function makeTeams(tickets, bases) {
  const b = bases || [{ team: 0, x: -50, z: -58, r: 17 }, { team: 1, x: 54, z: 54, r: 17 }];
  return [new Team(0, 'BLUFOR', b[0], tickets, '#7fb2e5'), new Team(1, 'OPFOR', b[1], tickets, '#e86a5a')];
}
