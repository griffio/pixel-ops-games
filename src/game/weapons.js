// Weapon tables. range in metres; a burst of `burst` rounds `burstGap` apart, then `rate` seconds of pause (a soldier's pause
// stretches with range, 0.6x at the muzzle to 1.5x at full range, with a wide jitter: combat.fire); acc is the per-round hit
// chance at point blank (it falls to a quarter at full range, halves on the move, and drops through a burst); `aim` is the
// seconds a soldier takes to lay on a new target at half range (more further out, more suppressed); `lethal` is the chance a
// direct hit on a soldier kills him outright, the rest go down wounded (combat.casualty, Unit.wound); `supp` is the suppression
// a round landing near a man puts on him (explosives 0.4 within 9 m); speed is the round's flight speed for tracers and travel
// time; hold is where infantry stop walking to shoot; arc = cannon shells drop under gravity, rocket = smoke trail; `lone` is
// how close a lone soldier must be before a launcher spends a rocket on him (groups are fair game at any range); `mag` rounds
// a magazine, `mags` spare magazines a man carries and `reload` the seconds to change one (RULES.ammo: dry men take no target,
// a man on his last magazine fires only at what is close or inside 0.6 of his range; a FOB gun's belt is not counted). Since the
// morale and fire plan (docs/GAME_PLAN.md, F1): single aimed rifle shots and short gun bursts, a fifth of the old volume, each
// round worth about twice as much; dmgInf is kept for fragments and splash, which give a casualty with a chance from it.
export const WEAPONS = {
  rifle:      { range: 60,  rate: 3.0, burst: 1,  burstGap: 0,    dmgInf: 10, dmgVeh: 1.5, acc: 0.2, lethal: 0.4,  supp: 0.15, aim: 1.0, speed: 300, hold: 32, air: true, mag: 30, mags: 4, reload: 3 },
  mg:         { range: 80,  rate: 3.6, burst: 6,  burstGap: 0.1,  dmgInf: 7,  dmgVeh: 1.5, acc: 0.14, lethal: 0.35, supp: 0.15, aim: 1.2, speed: 320, hold: 45, air: true, mag: 50, mags: 4, reload: 5 },
  at:         { range: 90,  rate: 6,   burst: 1,  burstGap: 0,    dmgInf: 40, dmgVeh: 120, acc: 0.7,  lethal: 0.8,  supp: 0.4,  aim: 1.5, speed: 55,  hold: 45, air: true, prefersVehicles: true, explosive: true, rocket: true, lone: 25, mag: 1, mags: 3, reload: 0 },   // five rockets per APC; reaches an APC standing off at 70 m; a lone man only inside 25 m
  marksman:   { range: 110, rate: 4.0, burst: 1,  burstGap: 0,    dmgInf: 40, dmgVeh: 2,   acc: 0.45,  lethal: 0.7,  supp: 0.3,  aim: 1.6, speed: 420, hold: 75, air: true, mag: 10, mags: 5, reload: 3 },   // one shot, one casualty
  medic:      { range: 60,  rate: 3.2, burst: 1,  burstGap: 0,    dmgInf: 9,  dmgVeh: 1.5, acc: 0.17, lethal: 0.4,  supp: 0.15, aim: 1.0, speed: 300, hold: 32, air: true, mag: 30, mags: 3, reload: 3 },
  engineer:   { range: 60,  rate: 3.2, burst: 1,  burstGap: 0,    dmgInf: 9,  dmgVeh: 1.5, acc: 0.17, lethal: 0.4,  supp: 0.15, aim: 1.0, speed: 300, hold: 32, air: true, mag: 30, mags: 3, reload: 3 },
  autocannon: { range: 150, rate: 3.0, burst: 3,  burstGap: 0.16, dmgInf: 20, dmgVeh: 14,  acc: 0.24, lethal: 0.7,  supp: 0.4,  speed: 70,  hold: 0,  air: true, explosive: true, arc: true },
  mk19:       { range: 130, rate: 4.5, burst: 3,  burstGap: 0.18, dmgInf: 12, dmgVeh: 4,   acc: 0.3,  lethal: 0.5,  supp: 0.4,  speed: 75,  hold: 0,  air: false, explosive: true, arc: true, splash: 4.5 },   // the Humvee's grenade launcher: lobbed bursts of three that wound and pin, little use against armour
  grenade:    { range: 35,  rate: 4,   burst: 1,  burstGap: 0,    dmgInf: 30, dmgVeh: 5,   acc: 0.5,  lethal: 0.6,  supp: 0.4,  speed: 20,  hold: 0,  air: false, explosive: true, arc: true, splash: 4, thrown: true },   // a rifleman's hand grenade (RULES.grenades, combat.throwGrenade): lobbed at men in cover within 35 m, bursting over 4 m; thrown: no flash, no tracer, no report, and cover does not shrink the throw
  coax:       { range: 90,  rate: 3.2, burst: 6,  burstGap: 0.1,  dmgInf: 10, dmgVeh: 0,   acc: 0.19, lethal: 0.4,  supp: 0.15, speed: 480, hold: 0,  air: false },   // the tank's co-axial 7.62 mm MG: fires where the turret points, at infantry
  tankgun:    { range: 200, rate: 5,   burst: 1,  burstGap: 0,    dmgInf: 45, dmgVeh: 220, acc: 0.45, lethal: 0.9,  supp: 0.4,  speed: 380, hold: 0,  air: false, prefersVehicles: true, explosive: true },   // 120 mm: three hits kill an APC, one a soldier
  // FOB emplacements, fired by the soldier manning one (combat.gunOf): a heavy machine gun that pins infantry at
  // range, a wire-guided anti-tank launcher reaching twice as far as the shoulder rocket, and a mortar that lobs
  // shells at anything its side can see (indirect: no line of sight from the tube), bursting over splash metres
  hmg:        { range: 120, rate: 3.8, burst: 8,  burstGap: 0.1,  dmgInf: 12, dmgVeh: 4,   acc: 0.16, lethal: 0.55, supp: 0.2,  aim: 1.2, speed: 360, hold: 0,  air: true },
  atgm:       { range: 200, rate: 10,  burst: 1,  burstGap: 0,    dmgInf: 40, dmgVeh: 220, acc: 0.8,  lethal: 0.8,  supp: 0.4,  aim: 2.0, speed: 75,  hold: 0,  air: true, prefersVehicles: true, explosive: true, rocket: true, lone: 30 },
  mortar:     { range: 400, min: 40,   rate: 7,   burst: 1,  burstGap: 0,  dmgInf: 70, dmgVeh: 30,  acc: 0.3,  lethal: 0.85, supp: 0.4,  speed: 64,  hold: 0,  air: false, explosive: true, arc: true, indirect: true, elev: 0.9, splash: 7 },   // elev: the tube's 52 degrees, the charge set for the range (4 s in the air at 60 m, 10 s at 400 m)
  doorgun:    { range: 80,  rate: 3.2, burst: 10, burstGap: 0.1,  dmgInf: 7,  dmgVeh: 1,   acc: 0.12, lethal: 0.4,  supp: 0.12, speed: 320, hold: 0,  air: false },   // the Chinook's crew-door M240: a machine gun's reach, longer bursts from a steady mount
  // the Little Bird's stub mounts (core/units.js SPEC.bird): a seven-shot pod of unguided rockets to port, fired one at a time
  // and bursting over splash metres, seven a sortie (SPEC.bird.ammo, refilled hovering over its base), and a three-barrel
  // .50 gatling to starboard that joins in on infantry
  hydra:      { range: 140, rate: 2.0, burst: 1,  burstGap: 0,    dmgInf: 30, dmgVeh: 60,  acc: 0.5,  lethal: 0.6,  supp: 0.4,  speed: 130, hold: 0,  air: false, prefersVehicles: true, explosive: true, rocket: true, splash: 5 },
  gau19:      { range: 110, rate: 3.2, burst: 10, burstGap: 0.1,  dmgInf: 9,  dmgVeh: 3,   acc: 0.14, lethal: 0.5,  supp: 0.15, speed: 400, hold: 0,  air: false },
};
