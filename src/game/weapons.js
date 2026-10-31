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
  mk19:       { range: 130, rate: 3.5, burst: 4,  burstGap: 0.18, dmgInf: 12, dmgVeh: 4,   acc: 0.3,  speed: 75,  hold: 0,  air: false, explosive: true, arc: true, splash: 4.5 },   // the Humvee's grenade launcher: lobbed bursts of four that wound and pin (a first cut at 22 damage and five a burst killed a squad in three bursts), little use against armour
  grenade:    { range: 35,  rate: 4,   burst: 1,  burstGap: 0,    dmgInf: 30, dmgVeh: 5,   acc: 0.5,  speed: 20,  hold: 0,  air: false, explosive: true, arc: true, splash: 4, thrown: true },   // a rifleman's hand grenade (RULES.grenades, combat.throwGrenade): lobbed at men in cover within 35 m, bursting over 4 m (G3: 40 over 5 m had the Hollow ending by tickets before minute 10 in half its matches); thrown: no flash, no tracer, no report, and cover does not shrink the throw
  coax:       { range: 90,  rate: 1.4, burst: 6,  burstGap: 0.09, dmgInf: 10, dmgVeh: 0,   acc: 0.25, speed: 480, hold: 0,  air: false },   // the tank's co-axial 7.62 mm MG: fires where the turret points, at infantry
  tankgun:    { range: 200, rate: 5,   burst: 1,  burstGap: 0,    dmgInf: 45, dmgVeh: 220, acc: 0.45, speed: 380, hold: 0,  air: false, prefersVehicles: true, explosive: true },   // 120 mm: three hits kill an APC, one a soldier
  // FOB emplacements, fired by the soldier manning one (combat.gunOf): a heavy machine gun that pins infantry at
  // range, a wire-guided anti-tank launcher reaching twice as far as the shoulder rocket, and a mortar that lobs
  // shells at anything its side can see (indirect: no line of sight from the tube), bursting over splash metres
  hmg:        { range: 120, rate: 1.5, burst: 10, burstGap: 0.07, dmgInf: 12, dmgVeh: 4,   acc: 0.2,  speed: 360, hold: 0,  air: true },
  atgm:       { range: 200, rate: 10,  burst: 1,  burstGap: 0,    dmgInf: 40, dmgVeh: 220, acc: 0.8,  speed: 75,  hold: 0,  air: true, prefersVehicles: true, explosive: true, rocket: true },
  mortar:     { range: 400, min: 40,   rate: 7,   burst: 1,  burstGap: 0,  dmgInf: 70, dmgVeh: 30,  acc: 0.3,  speed: 64,  hold: 0,  air: false, explosive: true, arc: true, indirect: true, elev: 0.9, splash: 7 },   // elev: the tube's 52 degrees, the charge set for the range (4 s in the air at 60 m, 10 s at 400 m)
  doorgun:    { range: 80,  rate: 1.3, burst: 14, burstGap: 0.05, dmgInf: 7,  dmgVeh: 1,   acc: 0.18, speed: 320, hold: 0,  air: false },   // the Chinook's crew-door M240: a machine gun's reach, longer bursts from a steady mount
  // the Little Bird's stub mounts (core/units.js SPEC.bird): a seven-shot pod of unguided rockets to port, fired one at a time
  // and bursting over splash metres, seven a sortie (SPEC.bird.ammo, refilled hovering over its base), and a three-barrel
  // .50 gatling to starboard that joins in on infantry
  hydra:      { range: 140, rate: 2.0, burst: 1,  burstGap: 0,    dmgInf: 30, dmgVeh: 60,  acc: 0.5,  speed: 130, hold: 0,  air: false, prefersVehicles: true, explosive: true, rocket: true, splash: 5 },   // a rocket kills a soldier only near its burst (35 hp), and wounds the rest; the first pass (45, every 1.4 s) mowed 50 a match a bird
  gau19:      { range: 110, rate: 1.6, burst: 12, burstGap: 0.045, dmgInf: 9,  dmgVeh: 3,  acc: 0.2,  speed: 400, hold: 0,  air: false },
};
