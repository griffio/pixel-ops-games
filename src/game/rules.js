// Ticket economy and timers (data, for tuning). 25-minute matches. Infantry are
// expendable: 35 hp, 15 s respawns in squad waves, 1 ticket each; everything else
// costs twice what it did; pools are 500 so a one-sided match ends by tickets.
export const RULES = {
  matchLength: 25 * 60,
  startTickets: { skirmish: 500, aas: 500 },
  ticketCost: { soldier: 1, truck: 10, supply: 16, apc: 20, heli: 30, fob: 40, location: 20 },
  respawnTime: { soldier: 15, truck: 60, apc: 90, heli: 120 },
  waveSlack: 8,              // squadmates who died within this many seconds come back together
  captureRate: 1.2,          // progress per unit-second; 4 soldiers take ~21 s
  bleedEvery: 5,             // seconds per ticket while the enemy holds the majority
  fob: { hp: 300, buildTime: 20, supplyCost: 50, truckSupplies: 100, resupplyRate: 10, buildRange: 20, minSpacing: 80, enemyBaseDistance: 140, spawnRadius: 8 },
  heli: { capacity: 8, boardRange: 5 },
  force: { squads: 8, truck: 3, apc: 3, heli: 2 },
};
