// Ticket economy and timers (data, for tuning). 25-minute matches. Infantry are
// expendable: 35 hp, 15 s respawns in squad waves, 1 ticket each; everything else
// costs twice what it did; pools are 500 so a one-sided match ends by tickets.
export const RULES = {
  matchLength: 25 * 60,
  startTickets: { skirmish: 500, aas: 500 },
  ticketCost: { soldier: 1, truck: 10, supply: 16, apc: 20, tank: 30, heli: 30, fob: 40, location: 20 },
  respawnTime: { soldier: 15, truck: 60, apc: 90, tank: 150, heli: 120 },
  waveSlack: 8,              // squadmates who died within this many seconds come back together
  captureRate: 1.2,          // progress per unit-second; 4 soldiers take ~21 s
  bleedEvery: 5,             // seconds per ticket while the enemy holds the majority
  fob: { hp: 300, buildTime: 20, supplyCost: 50, truckSupplies: 100, resupplyRate: 10, buildRange: 20, minSpacing: 80, enemyBaseDistance: 140, spawnRadius: 8 },
  // fog of war (game/vision.js): sight ranges sit just past each unit's main weapon (rifle 60, marksman 110, autocannon
  // 150, tank gun 200); `air` is a helicopter in the air, which also looks over buildings. A shooter shows to the side it
  // fires at for `reveal` s; a last-known position stays `ghost` s. Cells are `cell` m, refreshed every `every` s. The CPU
  // takes a place the enemy holds that it has not seen for 30 s to hold `guess` (combat weight: about four soldiers).
  vision: { cell: 8, every: 0.2, reveal: 5, ghost: 30, guess: 4, sight: { soldier: 120, apc: 160, tank: 210, truck: 100, heli: 120, air: 250, fob: 100, sandbags: 100 } },
  sandbags: { buildTime: 12, supplyCost: 12, max: 8, minSpacing: 12, enemyBaseDistance: 60, roadClear: 10 },   // improvised fighting positions: no kit, an engineer by a supply truck; never on the road (6 m half width + the position's 4 m)
  // a squad's own forward spawn (Squad's rally, scaled): spawns on a wave, needs a squadmate within placeRange to drop,
  // can't be dropped with an enemy inside blockRadius, burns with any enemy inside burnRadius
  rally: { wave: 30, cutoff: 10, cooldown: 60, placeRange: 8, blockRadius: 30, burnRadius: 18, enemyBaseDistance: 120 },
  heli: { capacity: 8, boardRange: 5 },
  force: { squads: 8, truck: 3, apc: 3, heli: 2 },
};
