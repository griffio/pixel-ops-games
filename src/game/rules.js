// Ticket economy and timers (data, for tuning). 25-minute matches.
export const RULES = {
  matchLength: 25 * 60,
  startTickets: { skirmish: 400, aas: 400 },
  ticketCost: { soldier: 1, truck: 5, supply: 8, apc: 10, heli: 15, fob: 20, location: 10 },
  respawnTime: { soldier: 30, truck: 60, apc: 90, heli: 120 },
  captureRate: 1.2,          // progress per unit-second; 4 soldiers take ~21 s
  bleedEvery: 10,            // seconds per ticket while the enemy holds the majority
  fob: { hp: 300, buildTime: 20, supplyCost: 50, truckSupplies: 100, resupplyRate: 10, buildRange: 20, minSpacing: 80, enemyBaseDistance: 140, spawnRadius: 8 },
  heli: { capacity: 8, boardRange: 5 },
  force: { squads: 8, truck: 3, apc: 3, heli: 2 },
};
