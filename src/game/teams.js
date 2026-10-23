export class Team {
  constructor(id, name, base, tickets, color) { this.id = id; this.name = name; this.base = base; this.tickets = tickets; this.color = color; this.kills = 0; this.losses = 0; }
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
export function makeTeams(tickets) {
  return [
    new Team(0, 'BLUFOR', { x: -50, z: -58, r: 17 }, tickets, '#7fb2e5'),
    new Team(1, 'OPFOR', { x: 54, z: 54, r: 17 }, tickets, '#e86a5a'),
  ];
}
