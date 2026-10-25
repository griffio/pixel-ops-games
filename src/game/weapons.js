// Weapon tables. range in metres; a burst of `burst` rounds `burstGap` apart, then `rate` seconds
// of pause; acc is the per-round hit chance at point blank (it falls to a quarter at full range,
// halves on the move, and drops through a burst); speed is the round's flight speed for tracers
// and travel time; hold is where infantry stop walking to shoot; arc = cannon shells drop under
// gravity, rocket = smoke trail. Point-blank damage per second stays near the earlier tables.
export const WEAPONS = {
  rifle:      { range: 60,  rate: 1.6, burst: 3,  burstGap: 0.11, dmgInf: 10, dmgVeh: 1.5, acc: 0.14, speed: 300, hold: 32, air: true },
  mg:         { range: 80,  rate: 1.7, burst: 8,  burstGap: 0.08, dmgInf: 7,  dmgVeh: 1.5, acc: 0.14, speed: 320, hold: 45, air: true },
  at:         { range: 90,  rate: 6,   burst: 1,  burstGap: 0,    dmgInf: 40, dmgVeh: 120, acc: 0.7,  speed: 55,  hold: 45, air: true, prefersVehicles: true, explosive: true, rocket: true },   // five rockets per APC; reaches an APC standing off at 70 m
  marksman:   { range: 110, rate: 2.6, burst: 1,  burstGap: 0,    dmgInf: 40, dmgVeh: 2,   acc: 0.4,  speed: 420, hold: 75, air: true },   // one shot, one kill
  medic:      { range: 60,  rate: 1.8, burst: 3,  burstGap: 0.11, dmgInf: 9,  dmgVeh: 1.5, acc: 0.12, speed: 300, hold: 32, air: true },
  engineer:   { range: 60,  rate: 1.8, burst: 3,  burstGap: 0.11, dmgInf: 9,  dmgVeh: 1.5, acc: 0.12, speed: 300, hold: 32, air: true },
  autocannon: { range: 150, rate: 2.0, burst: 4,  burstGap: 0.16, dmgInf: 20, dmgVeh: 14,  acc: 0.24, speed: 70,  hold: 0,  air: true, explosive: true, arc: true },
  coax:       { range: 90,  rate: 1.4, burst: 6,  burstGap: 0.09, dmgInf: 10, dmgVeh: 0,   acc: 0.25, speed: 480, hold: 0,  air: false },   // the tank's co-axial 7.62 mm MG: fires where the turret points, at infantry
  tankgun:    { range: 200, rate: 5,   burst: 1,  burstGap: 0,    dmgInf: 45, dmgVeh: 220, acc: 0.45, speed: 380, hold: 0,  air: false, prefersVehicles: true, explosive: true },   // 120 mm: three hits kill an APC, one a soldier
  doorgun:    { range: 80,  rate: 1.3, burst: 14, burstGap: 0.05, dmgInf: 7,  dmgVeh: 1,   acc: 0.18, speed: 320, hold: 0,  air: false },   // the Chinook's crew-door M240: a machine gun's reach, longer bursts from a steady mount
};
