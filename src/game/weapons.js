// Weapon tables: range in world units, rate in seconds between shots, damage per hit.
// Tuned so a 400-ticket match lasts about 20 minutes with both sides committed.
export const WEAPONS = {
  rifle:      { range: 28, rate: 0.55, dmgInf: 10, dmgVeh: 1.5, acc: 0.16, air: true },
  mg:         { range: 32, rate: 0.14, dmgInf: 7,  dmgVeh: 1.5, acc: 0.1,  air: true },
  at:         { range: 30, rate: 10,   dmgInf: 40, dmgVeh: 90,  acc: 0.35, air: true, prefersVehicles: true, explosive: true },   // seven rockets per APC: armour needs infantry cover
  marksman:   { range: 46, rate: 2.2,  dmgInf: 40, dmgVeh: 2,   acc: 0.42, air: true },   // one shot, one kill
  medic:      { range: 26, rate: 0.6,  dmgInf: 9,  dmgVeh: 1.5, acc: 0.14, air: true },
  engineer:   { range: 26, rate: 0.6,  dmgInf: 9,  dmgVeh: 1.5, acc: 0.14, air: true },
  autocannon: { range: 40, rate: 0.45, dmgInf: 20, dmgVeh: 14,  acc: 0.22, air: true, explosive: true },
  doorgun:    { range: 34, rate: 0.12, dmgInf: 6,  dmgVeh: 1,   acc: 0.12, air: false },
};
