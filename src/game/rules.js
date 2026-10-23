// Ticket economy and timers (data, for tuning). 25-minute matches.
export const RULES = {
  matchLength: 25 * 60,
  startTickets: { skirmish: 400 },
  ticketCost: { soldier: 1, truck: 5, supply: 8, apc: 10, heli: 15, fob: 20, location: 10 },
  respawnTime: { soldier: 30, truck: 60, apc: 90, heli: 120 },
  // M1 fixed force per team (loadouts arrive in milestone 3)
  force: { squads: 8, truck: 3, apc: 3, heli: 2 },
};
