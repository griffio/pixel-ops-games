# Pixel Ops — game plan

Premise: one human versus one CPU commander. Each side builds a force loadout
that suits its tactics. Both teams draw on a ticket pool that simulates combat
effectiveness: losing strategic locations, forward operating bases (FOBs),
vehicles, and every infantry respawn costs tickets. A team at 0 tickets loses
immediately. Each game mode adds its own win condition on top.

## 1. Design

### Teams and factions
- Two teams: BLUFOR (tan desert camo, current models) and OPFOR (olive/green
  camo variants of the same models). The player picks a side; the CPU takes the other.
- Units gain: team, hp, kit (weapon table), veterancy (optional later).

### Tickets
Starting pool per mode (AAS 300 / Invasion attackers 400, defenders 250 /
Territory 350). Costs are data in `src/game/rules.js` for tuning:

| Event | Tickets |
|---|---|
| Infantry respawn | 1 |
| Truck lost | 5 |
| Supply truck lost | 8 |
| APC lost | 10 |
| Transport helicopter lost | 15 |
| FOB radio destroyed | 20 |
| Strategic location lost (AAS) | 10 |
| Enemy holds majority of locations | 1 per 10 s bleed |

### Loadouts (force builder)
A points budget (1200) spent before the match. Items unlock what the team can
spawn during the match and set the respawn timers.

- Squads: Rifle 100 · Support (MG) 130 · Anti-tank 140 · Medic 120 · Engineer 120 · Marksman 110
- Vehicles: Truck 60 · Supply truck 80 · APC 220 · Transport helicopter 300
- FOB kits 50 each (radio + HAB spawn point); engineers place them near a supply truck
- Doctrine (pick one, free): Mechanized (APCs 25% cheaper, faster vehicle respawn) ·
  Air Assault (helicopters cheaper, squads can spawn aboard) · Light Infantry (respawn
  timer halved, +1 squad slot) · Entrenched (FOB build time halved, +10 tickets per held location)

The CPU picks from archetype loadouts (Mechanized, Air Assault, Light Infantry,
Defensive) and counter-picks against the player's choice (for example more
anti-tank if the player goes Mechanized). Loadouts save to localStorage.
(Since 2026-10-25 the CPU never picks Air Assault; see Status.)

### Combat model
- Weapons: range, rate, damage vs infantry / vs vehicle, accuracy falloff.
  Rifle, MG, AT launcher, APC autocannon, door gun.
- Line of sight: ray against obstacle boxes; cover reduces hit chance.
- Infantry: hp, death animation (fall + fade), medic revive window (10 s).
- Vehicles: hp, crew, wreck on death (burning smoke particles), blocks the road.
- Helicopters: transport squads (mount at base/FOB, dismount at target), vulnerable
  to AT fire while low.
- Fixed 20 Hz simulation tick with seeded RNG; rendering interpolates. This also
  gives deterministic replays.

### Strategic layer
- Strategic locations: circular capture zones (radius 10–14) with capture progress;
  more units in the zone capture faster; neutral → owned.
- Main bases at opposite map corners, protected zones (no capture, auto-damage to intruders).
- FOBs: radio (hp 300) + HAB spawn point. Placed by an engineer within 20 units of a
  supply truck; consumes 1 FOB kit. Destroying the radio removes the spawn and costs tickets.
- Respawn: at main base, any friendly FOB HAB, or aboard an idle transport helicopter
  (Air Assault). Spawn panel shows the ticket cost and the timer.

### Game modes
1. **Advance and Secure (AAS)** — a lattice of locations captured in order. Holding the
   majority bleeds the enemy. Win: enemy at 0 tickets or capturing their last location.
2. **Invasion** — attackers (fewer locations, more tickets) must take every location
   before the 20-minute timer; defenders win on time or attacker tickets at 0.
3. **Destruction** — attackers find and destroy three weapon caches; each destroyed
   cache reveals the next and costs defenders 40 tickets. Defenders win on time.
4. **Territory Control** — a hex grid; holding more hexes bleeds the enemy; capturing
   80% of the map wins outright. Rewards maneuver over attrition.

Each mode is a data object: objectives, ticket rules, timer, win checks, AI weights.

### CPU commander
- Strategist (every 5 s): scores objectives by value, distance, enemy presence and
  own strength; assigns squads to attack / defend / flank; keeps a reserve.
- Logistics: sends supply trucks and engineers to build FOBs one hop behind the front.
- Air: transport helicopters ferry squads to the next objective, avoid known AT.
- Squad brain (every 0.5 s): engage visible enemies, take cover near obstacles,
  retreat below 40% strength, call for medic.
- Difficulty: reaction delay, accuracy modifier and ticket handicap.

### Maps
- Map 1: the current airfield, extended with a village block, a ridge, and five
  locations (Village, Hangar, Fuel Depot, Container Yard, Tower). Main bases at the
  north-west and south-east corners.
- Maps are data: layout props, obstacles, nav grid, locations, spawn points, caches.
- Direction for the next maps (2026-10-26; Desert Crossing is a placeholder): more
  ways to attack each place, and chokepoints such as bridges where a route can be
  blocked, so the player and the CPU commander face real choices about where to
  push and where to dig in. Each place carries its own defensive positions in the
  map data, each covering one approach, which replaces `digSpot()`'s generic
  spots (on Desert Crossing the north-east side digs in about half as much
  because its places sit on the road). Deliberate road blocks (tank traps, wire)
  belong with these maps; on the open desert vehicles simply drive round.
  Bases and locations exactly mirrored through the centre: Desert Crossing's
  Village sits off-centre and its north-east route is 29 m shorter, which gives
  that side about 60% of CPU matches (see "Fog of war, stage 2").

## 2. Architecture

Keeps the core / back-end split. New `src/game/` folder, renderer-agnostic:

```
src/game/
  rules.js         ticket costs, budgets, timers (data)
  teams.js         team state, ticket pools, colours
  nav.js           1-unit grid, A* and flow fields for squads
  spatial.js       hash grid for targeting and separation (replaces O(n²))
  weapons.js       weapon tables and hit resolution
  combat.js        targeting, firing, damage, death, wrecks, tracers/impacts (effects via core/dust-style pools)
  objectives.js    capture zones, main bases, caches
  fob.js           radios, HABs, placement rules, supply consumption
  respawn.js       spawn points, timers, ticket deduction
  loadout.js       items, doctrines, validation, CPU archetypes
  modes/aas.js, invasion.js, destruction.js, territory.js
  ai/strategist.js, ai/logistics.js, ai/squadBrain.js
  match.js         state machine: menu → loadout → deploy → play → debrief
ui/                loadout screen, spawn panel, objectives bar, kill feed, debrief (HTML overlays)
```

Engine changes needed in the existing core:
- Fixed-timestep simulation with interpolation; seeded RNG already exists.
- Unit: team, hp, kit, dead/wreck states, mount/dismount, team-specific materials
  (second camo set per back end).
- Camera/input: team filter on selection; touch layer for iPad; hotkeys for spawn panel.
- Renderer: wreck smoke and tracer points via the existing point-sprite path; capture
  rings and FOB markers as unlit instanced rings; nothing new in GL/three beyond materials.
- Map loading from data instead of `buildLayout()` constants.

## 3. Milestones (each one playable)

1. **Teams and combat core** — two factions, hp, infantry and vehicle fire, death,
   wrecks, tracers, ticket counter, Skirmish mode (tickets only), CPU targets enemies.
   Includes the nav grid and spatial hash since combat needs both.
2. **Objectives and AAS** — capture zones, lattice, bleed, main bases, respawn panel,
   match timer, end screen, Strategist v1.
3. **Loadouts** — force builder screen with budget and doctrines, spawn menu driven by
   the loadout, CPU archetypes and counter-pick, saved loadouts.
4. **FOBs, logistics and air** — supply trucks, FOB placement and destruction,
   helicopter mount/dismount, Logistics and Air AI.
5. **Modes** — Invasion, Destruction, Territory Control, mode select, per-mode AI weights.
6. **iPad** — touch controls (drag pan, pinch zoom, twist rotate, long-press order),
   responsive HUD, PWA manifest, shadow map 2048 and DPR 1 on mobile.
7. **Polish** — sound (ElevenLabs effects), smoke and fire, kill feed, debrief graphs,
   village map content, difficulty levels.

## Status

- **Milestone 1 — done (2026-10-23).** Teams with olive OPFOR recolour, hit points,
  rifle / MG / AT / autocannon / door-gun weapons with line of sight, infantry deaths
  and vehicle wrecks with smoke, tracers and impacts, respawns at main base, ticket
  pools, Skirmish mode with a 25-minute timer, CPU commander v0, A* navigation and a
  spatial hash. Decisions taken: 25-minute matches, no fog of war, OPFOR is a
  recolour, vehicles respawn at main on a timer plus ticket cost. Simulation runs
  combat and AI at a fixed 10 Hz tick; full determinism (fixed movement step) is deferred.
- Tuning note: with both sides CPU-controlled and fully committed, 400 tickets last
  about 17 minutes. A human commander fights more slowly; revisit after milestone 2.

- **Milestone 2 — done (2026-10-23).** 1 km *Desert Crossing* map as data (bases,
  five locations, road and tracks, props, splat-painted terrain). Engine scaling:
  chunked static instance batches with per-chunk culling, shadow frustum fitted to
  the view and snapped to shadow texels, splat-mapped tiled ground with road strips
  and decals, strategic zoom below one pixel per texel, 1 m infantry and 2 m vehicle
  navigation grids. Game: Advance and Secure with lattice capture, majority bleed,
  location-loss tickets and capture-all victory; objectives bar, minimap with camera
  jump, reinforcements panel; Strategist v1 (attack next capturable, hold the front
  or threatened locations, APC escorts at autocannon range). WebGL2 is now the
  default and only game renderer; three.js serves the legacy sandbox.
- Scale decision: one unit is one metre; final maps target 2 km. The 1 km map exercises
  every scaling path, so 2 km is content work.

- **Terrain (2026-10-23).** Analytic heightfield (hills of 10–26 m plus rolling noise,
  level pads under bases and locations) rendered as static 64 m chunk meshes in
  ground mode. Units, props, lamps, roads and decals follow the height; the camera
  picks on slopes; hills block line of sight in combat; slopes above 45% are
  impassable for vehicles and above 90% for infantry; the minimap is hill-shaded.

- **Choke points (2026-10-23).** Terrain rebuilt around ridge features: three 30 m
  ridges with a single notch pass each separate Outpost/Airfield, Airfield/Village and
  Depot/Relay; mesas up to 54 m; flank ridges by the bases. A river with 7 m channel
  crosses between Village and Depot with one bridge (deck, railings, piers; walkable
  via WorldState.heightAt) and one ford. Water and slopes above 45% are impassable
  for vehicles (about 23% of the map), above 90% for infantry (12%). Verified by path
  probes: every leg of the chain is reachable and vehicles route through the passes
  and over the bridge; base-to-base is 1.2 km for vehicles.

- **Milestone 3 — done (2026-10-23).** Force builder before the match: 1,200-point
  budget, six squad types with distinct kits (rifle, support, anti-tank, medic,
  marksman, engineer), four vehicle items including supply trucks, four doctrines
  (Mechanized, Air Assault, Light Infantry, Entrenched), five presets, validation
  (budget, squad and vehicle slots), saved to localStorage. Doctrines act in play:
  cheaper APCs or helicopters, faster respawns, an extra squad slot, +10 tickets per
  capture, and infantry respawning beside an idle helicopter (spawn preference in the
  reinforcements panel). Medics revive squadmates within 12 s of death; engineers
  repair vehicles. The CPU picks an archetype that answers the player's force.

- **Milestone 4 — done (2026-10-23).** Supply trucks with supplies that refill at
  main; FOB kits in the loadout; engineers build a FOB (radio mast, tent, sandbag
  ring) within 20 m of a supply truck, 20 s (Entrenched 10 s); FOBs are 300 hp
  structures that cost 20 tickets when destroyed; infantry respawn at the nearest
  spawn to their squad (main, FOB, or an idle helicopter under Air Assault). Squads
  board landed helicopters (right-click), ride mounted and invisible to combat and
  captures, and unload on landing; passengers die with a shot-down helicopter. CPU
  Logistics builds one FOB behind the front with a truck and an engineer squad; CPU
  Air lifts squads at base toward objectives more than 250 m away, landing them 70 m
  short on its own side and avoiding known enemies; one squad raids enemy FOBs.
- Balance note: Air Assault still underperforms Balanced in CPU-vs-CPU runs; the
  helicopter discount went to 35% so the preset fields six squads.

- **Milestone 5 — done (2026-10-23).** Modes behind one interface (`src/game/modes/`):
  the mode owns objectives, ticket rules, win checks, the objectives bar, minimap
  drawing and the CPU's goals. Advance & Secure (extracted), Invasion (defenders own
  everything, 500 vs 300 tickets, 20 minutes, 15 tickets per lost location),
  Destruction (three caches hidden near the defenders' locations, revealed by
  proximity or after 90 s, 40 tickets each, 20 minutes), Territory Control (68 m hex
  grid, adjacency capture, majority bleed, 80% wins) and Skirmish. Mode and side are
  chosen in the force builder and remembered. Strategist takes attack/hold/reserve
  goals and an attack share from the mode.

- **Milestone 6 — done (2026-10-23).** Touch layer beside the mouse input
  (`src/core/touch.js`): tap selects, double-tap selects a type on screen, a hold on
  the ground orders (or boards a landed helicopter), a hold with nothing selected
  starts a box select, one finger pans with a fling, two fingers pinch-zoom and twist
  about the midpoint, three fingers tilt. Gesture camera changes apply without
  smoothing so the ground stays under the fingers; picking searches a 14 px radius.
  Mobile profile (coarse pointer with multi-touch, or `?mobile=1`): DPR 1, 2048
  shadow map, no edge pan, touch toolbar (Box, Follow, Pause, Base, engine panels),
  gesture hints, larger tap targets, force builder stacks to one column under 900 px.
  Web app manifest with generated icons (`tools/make-icons.mjs`); no service worker.
  Verified with a CDP touch harness (`tools/touch-test.mjs`): pan distance, pinch
  factor and twist angle match to the decimal, midpoint drift under 0.2 m.

- **Shadow stability (2026-10-23).** Shadow edges rippled while panning over hills:
  the light frustum was sized from the four screen-corner ground hits, which move
  with the terrain under them, so the shadow texel size drifted every frame (0.3 m
  over a 2 m pan) and every edge re-rasterised on a new grid. The frustum is now
  sized from the camera's own footprint (view size and pitch) in quarter-octave
  steps, so the texel size is constant until the zoom crosses a step and the texel
  snap keeps the grid still in the world. The depth test is a 2x2 bilinear
  comparison thresholded at 0.5: edges follow the sub-texel iso-line instead of the
  shadow texel staircase while staying hard. Measured with a shadow-mask probe:
  0.3% of shadow pixels change per one-texel pan at the base on both 2048 and 4096
  maps. The sun's own movement at 24x measured small at zoom 3 but is plainly
  visible at zoom 12 as texels flipping along every edge, so matches now run with
  the sun fixed (time speed 0, 09:30; `?hour=` picks another time, the World panel
  slider restarts the clock). Decision taken 2026-10-23: no day cycle in matches.
  Still visible on close inspection: the sand tiles are nearest-sampled without
  mips, so fine grain sparkles under pan, most at the screen's centre row and column.

- **Milestone 7 — done (2026-10-23).** Sound (`src/core/audio.js`): WebAudio
  synthesis with no assets, positional one-shots per weapon kit, explosions,
  impacts, rotor and engine loops for the nearest vehicles, UI and match cues,
  rate limiting, mute/volume persisted; `tools/make-sounds.mjs` generates
  ElevenLabs clips into `sounds/` which the engine prefers when present (no API
  key was available in this session, so the clips are untested). Effects: burning
  wrecks (flames, embers, soot for 45 s), explosions with fireball, ballistic
  debris and a dust ring, explosive hits and muzzle puffs; particles gained
  gravity. Kill feed with weapon and class icons, event lines for captures, FOBs
  and caches, fading. Debrief with a ticket graph from 5-second history samples
  and a stats table (net tickets, kills, losses by class, captures, FOBs, caches).
  Village content: mosque and minaret, walled compound, market awnings and
  crates, garden walls, rubble, a second well. CPU difficulty (`src/game/difficulty.js`):
  Easy / Normal / Hard scale the CPU's accuracy, damage, respawn timers, plan
  cadence, attack share and FOB kits; chosen in the force builder and persisted.
  Verified headlessly: hard CPU multipliers applied and FOBs built, easy CPU built
  none, 60 history samples over 300 s, feed carrying kill and event lines, audio
  context running with 91 voices in 6 s and no page errors, debrief rendered.

- **Expendable infantry (2026-10-24).** Soldiers have 35 hp (four rifle hits, two
  autocannon, one marksman round), respawn in 15 s and come back in squad waves
  (squadmates who died within 8 s return together), still 1 ticket each.
  Everything else costs twice what it did (truck 10, supply 16, APC 20, heli 30,
  FOB 40, location 20, bleed every 5 s, Entrenched +20) and pools are 500 (Invasion
  650 / 400, Destruction 600 / 450). Rockets do 90 to vehicles so armour needs
  infantry cover. Measured on full 25-minute CPU matches (seed 11, Balanced vs
  Mechanized): infantry deaths per minute 4.2 / 6.4 before, 6.7 / 7.0 after; the
  match now ends by tickets at 24:55 (359 / 0) instead of the clock with 329 / 118;
  Light vs Air ends at the clock with 340 / 37. Deaths rose less than the
  lethality because the CPUs spend most of the match walking; FOB placement now
  decides tempo. Follow-up: BLUFOR won every CPU-vs-CPU run; see *Side balance*.

- **Side balance (2026-10-24).** Mirrored CPU-vs-CPU runs (Balanced vs Balanced,
  `?cpu=both&swap=1` plays the sides the other way round) showed the south-west
  side winning 13 of 16 whichever team sat there, and every match turning on who
  took the Village first and held it (3 v 2 bleeds 12 tickets a minute). Two map
  faults: the Village's garden walls funnelled the north-east attacker through
  one 4 m gap into the defenders' guns, and the road-clearance filter had
  silently removed the obstacles (not the models) of the houses on one side of
  the road; and the river separated the Village from the Depot only, so the
  north-east side crossed a 14 m bridge under fire while the south-west walked
  through a 68 m ridge cut. The road now runs straight through the Village,
  whose houses and walls stand in point-symmetric pairs along it; a second river
  mirrors the first south-west of the Village (bridged where the road crosses
  it, fordable further out) in place of the Airfield–Village ridge, and the
  Airfield moved 22 m to keep its apron dry. Over 32 mirrored runs each side now
  wins 16 (by team index BLUFOR 20, OPFOR 12: within noise, worth watching).
  Measured with scratch runners over tools/match-test.mjs plus stepped probes
  that logged captures, zone presence, river crossings and death positions.

- **Muzzle flashes and vehicle detail (2026-10-24).** Shots now leave the barrel
  (a little ahead of the unit at gun height) with a muzzle flash sized by weapon
  class (`MUZZLE` in `src/core/dust.js`): an orange halo and a near-white core,
  cannon and rocket flashes with sparks, smoke, ejected brass and a rocket
  backblast. Particles can be additive (alpha encoded as 2 + a) and are drawn
  as round, premultiplied sprites in one pass, so flashes, fire, embers and
  tracers glow while smoke still covers. Each flash and explosion also adds a
  brief point light (`dust.lights`); the world feeds those first into eight
  shader light slots (was four lamps), so a volley lights the squad and the
  ground around it the way the reference frames do. Models: trucks are 6x6 with
  side glass, mirrors, grille, headlights, exhaust stack, fuel tank and a netted
  load (new `net` texture with a mesh grid); APCs gain a muzzle brake, smoke
  launchers, a pintle gun, headlights and jerry cans; wheels have hubs and a
  lighter tread band. Checked with paused CDP captures of a volley, the cannon,
  a rifle and a vehicle-size explosion.

- **Gunnery (2026-10-24).** Shots are rounds in flight (`src/core/projectiles.js`):
  the hit is rolled on the trigger, the damage lands when the round arrives, and
  a miss is aimed past the target and comes down on the ground around it, so
  bullets, cannon shells and rockets are seen travelling and landing. Cannon
  shells fly a gravity arc at 70 m/s (the low-angle solution for the range;
  about two seconds to 150 m) with a glowing head and smoke; rockets trail
  smoke; tracers are additive line streaks, bright at the head, instead of
  dots. Ranges roughly doubled (rifle 60, MG 80, marksman 110, rocket 60 then 90,
  autocannon 150, door gun 70); infantry fire bursts (rifle 3, MG 8, door gun
  10) with a pause between, per-round accuracy lower and falling to a quarter
  at full range, halved on the move and dropping through a burst, so
  point-blank damage per second stays near the old tables while fights open
  earlier. Infantry walk and fire until a hold range (rifle 32, MG 45, marksman
  75), then stop. Line of sight is the same hills-plus-tall-boxes test, now
  rechecked every half second and run through a 20 m grid of the obstacles.
  Seed 11 Balanced vs Mechanized now ends by tickets at 24:26 for Mechanized
  (157 left) with infantry deaths per minute 8.9 / 5.6 (was 6.7 / 7.0 and a
  Balanced win): longer-ranged cannon and rockets favour armour more. Eight
  mirrored Balanced runs all reach the clock with 290-420 infantry deaths a
  match, so pacing holds, but the side that loses the Village now dies about
  twice as fast as the holder; Light Infantry vs Air Assault (seed 7) ends at
  6:33 by capturing every location (was a clock win at 340 / 37), a matchup
  for the loadout-balance follow-up.

- **Cautious CPU and vehicle steering (2026-10-24).** Enemy vehicles were seen
  stopping and driving in a circle: a vehicle ordered to a point a few metres
  away at a wide angle kept creeping forward while it turned and orbited a goal
  it could never reach (the commander hands APCs such points when it holds them
  short of the enemy). Vehicles now back up to a near goal behind them, pivot
  for a near goal to the side, and may carry negative speed (every reader of
  speed takes its magnitude; the lead on moving targets keeps the sign). Open-
  ground tests: goals 4-20 m behind or beside an APC are reached in 2-5 s.
  The commander gained a once-a-second caution pass (`Strategist.caution`):
  a squad with an enemy inside 22 m falls back 28 m unless it stands in the
  zone it was sent to take or hold or clearly has the numbers; an APC with an
  enemy inside 50 m backs off to 70 m, and the plan now closes APCs to a 70 m
  standoff (outside rocket reach, inside the cannon's) instead of 34 m. Squads
  approach a defended objective to 35 m rather than 20 m and shoot from there.
  Infantry on the move only stop for an enemy inside 18 m; once where they were
  sent they hold and shoot out to their hold range. Measured on a stepped
  Mechanized-vs-Mechanized match: CPU APC samples with an enemy inside 40 m
  fell from 22% to 9%, per-minute medians 48-85 m during the fighting. With the
  standoff, mirrored runs lost almost no vehicles (0-1 a match against 2-5
  before), so rockets now reach 90 m, inside which a standing-off APC can be
  hit about once in five shots: the next eight mirrored runs lost 10 vehicles
  between them (2 before), all still reaching the clock.

- **Anti-tank accuracy (2026-10-24).** Rocket accuracy raised from 0.3 to 0.7
  (user: make APCs easier to kill). Measured with a duel probe (an anti-tank
  squad with two launchers against a stationary APC that shoots back, eight
  trials): at 0.3, 0.5 and 0.7 the squad never kills the APC at 35 or 60 m,
  because the autocannon kills the squad in 15-55 s after it has fired only
  4-5 rockets; mirrored CPU matches lose the same 10 vehicles over eight runs
  at any accuracy, since standing-off APCs stay out of reach. Survival time is
  the binding limit, not accuracy. A measured package of accuracy 0.7, reload
  6 s and 120 damage (five hits) kills the APC in 7 of 8 duels at 35 m (mean
  20 s) and 2 of 8 at 60 m; only the accuracy part is applied.

- **Cover (2026-10-24).** Enemy squads still walked into an APC's gun. Combat
  now keeps two obstacle grids: tall boxes block line of sight as before, and
  low ones (garden walls, sandbags, rocks, 0.7-1.5 m) give partial cover: a
  soldier standing right behind one is half as likely to be hit from across it.
  `coverPoint` finds the nearest squad-wide spot, out to 26-30 m, that a threat
  cannot see (behind a building or over a hill), and `canSeePoint` asks whether
  a unit sees a ground point. The commander's caution pass treats any enemy APC
  within 150 m that can see a squad as the first problem: a squad with
  launchers stalks it to 60 m and fires, any other squad moves to cover (or
  falls back 30 m if there is none) and stays pinned there while the APC is
  about; approach orders near an overlooking APC land on a covered spot. Over
  15 minutes of Balanced vs Mechanized on seeds 3-5, the Balanced side's
  infantry deaths went from 332 (104 to autocannon fire) to 177 (82), so
  losses halved and armour kills fell a fifth, but squads in or on their way to
  cover are still hit at 55-75 m when the APC repositions, and the pace slows.
  Proper strong points (garrisoning buildings, engineer-built sandbag
  positions) are the natural next step and are proposed, not built.

- **Vehicle spin (2026-10-24).** The player's APC still stopped and spun with its
  turret fixed: a fallback in ground movement rotated any unit boxed in on all
  sides at 2.5 rad/s to wriggle free, so a vehicle parked against a wall with a
  goal 1.6 m away (just outside its 1.5 m arrival radius) spun for good, and
  the turret, aimed relative to the hull, went round with it. Removed. Orders
  that land inside a building snap to the nearest open vehicle cell, a unit
  that is trying to move but gets no nearer its waypoint for 1.5 s treats the
  last waypoint as reached (or re-paths an earlier one), and the turret keeps
  its bearing while the hull turns under it. Probe: orders 1-20 m behind,
  beside, onto a squad, into or beside a village house all arrive in 1-10 s.

- **Rocket package applied (2026-10-24).** Reload 6 s (was 10) and 120 damage to
  vehicles (was 90), so five hits kill an APC; accuracy stays 0.7. Seed 11
  Balanced vs Mechanized, which lost no APCs with accuracy alone, now loses
  3 and 4 in a 257 / 213 match; eight mirrored Balanced runs lose 38 vehicles
  between them (10 before the cover and spin fixes, 37 after them), all
  reaching the clock with closer scores and one draw.

- **Sandbag positions (2026-10-24).** The user chose improvised strong points
  over garrisons. An engineer beside a supply truck builds a U of sandbags open
  to the rear (`N`, 12 supplies, 12 s, halved under Entrenched, up to eight a
  side, 12 m apart, not within 60 m of the enemy main). The position is a
  static `sandbags` unit (untargetable, not counted for captures) whose bags
  become runtime obstacles cut into 0.5 m pieces so axis-aligned boxes hug the
  walls at any heading: pushed into the world's obstacle list, blocked in both
  nav grids (a 0.3 m foot pad keeps the inside open) and added to combat's low-
  cover grid, so a squad inside is half as likely to be hit from the front or
  sides and not from behind; anyone caught inside a bag steps to the nearest
  open cell. The CPU's logistics plan digs in at the location it holds, a few
  metres towards the enemy, once its FOB kit is spent, and its hold orders put
  one squad in each position there. Probe: built in 6 s, 26 obstacle pieces,
  inside passable, covered from the front, a squad walks in from 20 m; a CPU
  match built positions at the Outpost, Airfield and Depot by 15 minutes.

- **LLM commander, digest and Worker (2026-10-24).** The user wants the CPU
  commander to take plans from a model, on Cloudflare (Workers + Workers AI in
  one runtime). Built the game side and the Worker. `src/game/ai/digest.js`
  compresses a side's view to about 1,700-2,200 characters (500-600 tokens):
  tickets, locations with owner, contest counts and capturability, our squads
  (kits, strength, nearest location, order), vehicles, enemy clusters within
  40 m, FOBs and kits, sandbags, the last six events and the previous plan.
  `src/game/ai/plan.js` holds the plan schema (attack, hold, attackShare,
  posture, logistics, lift, reason) and a validator shared by game and Worker
  that drops anything not legal. `src/game/ai/remote.js` posts the digest every
  20 s of match time per CPU side, keeps the latest plan for 90 s, never blocks.
  The strategist applies it in `applyPlan` (attack only if capturable in the
  lattice, holds only if ours, posture scales caution distances, logistics
  prefers FOB or sandbags or none, lift on or off) and the reason goes to the
  feed as radio chatter. `?commander=1` uses `/commander` on the serving
  origin, `?commander=<url>` any endpoint; `tools/commander-stub.mjs` is a
  heuristic stand-in. `worker/index.js` + `wrangler.jsonc` serve the game as
  static assets (`.assetsignore` excludes secrets, tools, docs) and answer
  `/commander` from Workers AI with a JSON-schema response. Measured: Llama 3.3
  70B fp8 fast answers in 1.8-2.7 s (about 1,100 prompt tokens, 42 neurons a
  call); GLM 5.3 flash spent its whole budget on hidden reasoning and took
  9 s, so Llama is the default. With the stub a 4-minute CPU match made 10
  calls a side, all applied; with the real model under `wrangler dev` both
  sides got plans ("Take Village", "Secure Village") in 2.4-2.7 s, from the
  Worker's own origin and cross-origin. The Cloudflare token is account-scoped
  (`/user/tokens/verify` rejects it, Workers AI accepts it). Deployed by the
  user to https://pixel-ops.griffio-work.workers.dev; the first deploy also
  uploaded `.wrangler/` (local dev state), fixed in `.assetsignore` and
  redeployed. Live: a plan in 2.4 s direct, 3.5 s from the page; a CPU match
  played off the live site got plans for both sides. Next: judge plan quality against the built-in planner over a
  few matches, and consider Agent Memory only at match boundaries.

- **Stances and suppression (2026-10-24).** User feedback before anything
  else: infantry should kneel to fire and lie flat under heavy fire. Soldiers
  now carry a suppression value (0-1) and a stance: standing on the move,
  kneeling when still, prone when suppression passes 0.5 (or 0.25 while
  still), with the pose blended over the walk animation in `units.js` (hips
  drop, left thigh forward and right knee down for the kneel; body flat, legs
  back, arms forward for prone). Suppression comes from rounds landing or
  bursting near a soldier (`Combat.suppress`: rifle 0.07, machine gun 0.10,
  cannon 0.25, explosive 0.40 per round, the victim of a hit doubled) and
  decays with a 2.5 s time constant. Effects: eye and target heights follow
  the stance, a kneeling or prone target takes 80% / 60% of the hit chance
  (floor 0.3 together with cover), a suppressed shooter aims at (1 - 0.4 x
  suppression) and fires 1.5x slower above 0.7, and a prone soldier ordered to
  move crawls at 30%. The digest reports pinned men per squad. Test: an MG
  squad at 40 m pins a rifle squad in two seconds and the rifle squad's own
  machine gun pins the MG squad back, so both lie flat trading fire with few
  casualties for 30 s; manoeuvre, cover, armour and rockets decide those
  stand-offs now. Eight mirrored Balanced runs all reach the clock with 120-290
  infantry deaths a match (250-400 before) and 58 vehicles lost between them
  (38 before): fewer men die, more vehicles do, and the losing side keeps more
  tickets. The knobs are the per-round amounts and the 2.5 s decay in
  `Combat.suppress` and `units.js`.

- **Commander memory: trends, plan history, notes (2026-10-24).** The model is
  stateless, so the game remembers for it in fixed-size blocks instead of a
  growing prompt. Match history rows (every 5 s) now carry tickets, infantry
  and vehicle losses and locations owned per side, and the match keeps a log
  of captures and losses with times. The digest adds `trends` (tickets now and
  1, 2, 3 minutes ago; our and their deaths and vehicle losses per minute over
  the last three minutes; locations that changed hands in the last five),
  `plans` (the last three plans, kept only when the orders change or a minute
  passes, each with its outcome measured from the state it was made in: ticket
  swing, captured, lost, infantry and vehicles lost), and `notes`, a 300-
  character field the model writes and gets back unchanged. The prompt tells
  it to read the trends before the snapshot, change a plan whose outcome was
  bad and write fresh notes about intent. Digest about 3,300 characters
  (1,600 prompt tokens); Llama 3.3 70B answers in about 3.3 s. Check: two
  consecutive calls on the same state, the second carrying the first answer's
  notes and outcome, gave a continuing plan and notes that build on the
  earlier ones ("continue pushing Airfield, waiting for the FOB near Village").
  The deployed Worker needs `npm run deploy` to pick up the new prompt. Next:
  `waitFor` conditions and `nextReviewIn`, then squad roles.

- **Tempo: nextReviewIn and waitFor (2026-10-24).** The plan gained
  `nextReviewIn` (10-60 s until the next call; the game also asks at once when
  a location changes hands or one of the side's APCs dies, via
  `RemoteCommander.nudge`) and `waitFor`, a condition that holds the attack
  back: `squadsAt` (count of our squads within r+20 of one of our locations,
  the staging point), `enemyBelow` (fewer than count enemies near a location),
  `apcAlive`, or `seconds`. While a wait is unmet the strategist drops the
  attack goal and sends everyone to the staging location; the wait clock
  survives re-issued plans and the game stops waiting after two minutes. The
  digest reports `waiting` with whether it holds. Against the stub (which
  stages three squads at the front before a defended objective and asks again
  in 12 s): the cadence followed the plan (25 s, then 12 s), the attack goal
  was null while squads gathered at the Village, and the push on the Airfield
  launched the moment three squads were there. With Llama 3.3 70B the
  mechanism is used but not finely: it chose squadsAt Village x3 for a
  defended Airfield, then after a prompt line about when waiting pays it chose
  apcAlive (already true, so attack at once) in both the defended and the
  lightly held case. A stronger model behind AI Gateway, or a few worked
  examples in the prompt, is the lever if that matters. Gotcha: `wrangler dev`
  restarts mid-request because its own `.wrangler/state` writes sit inside the
  watched assets directory; the scratch Node harness that imports the Worker
  and calls Workers AI over REST is the reliable way to test the prompt.

- **Squad roles (2026-10-24).** The plan's `squads` array gives particular
  squads jobs by their digest id: assault (join the attack with the standoff
  and cover logic), hold (stand at a location of ours, sandbag posts first),
  reserve (wait inside a location behind the front, never drawn into the
  attack), screen (an overwatch point 50 m out from the location towards the
  enemy, moved into cover if an APC overlooks it), raid (the nearest enemy
  FOB), escort (stay 4 m off the nearest supply truck). The validator keeps
  only ids present in the digest, known roles and known locations; the
  strategist's plan tick runs the assigned squads first and splits the rest by
  attack share as before, and the logistics squad is never reassigned. Plan
  history summarises roles as counts. Against the stub (anti-tank squad
  screens the front, one rifle squad in reserve): SQ-11 sat 49-52 m out from
  the Depot the whole time and SQ-08 inside it, while the free squads fought
  for the Village and the engineers built. The real model assigns roles with
  valid ids and sensible kits (rifle and anti-tank squads to assault, one
  hold, one reserve); with the bigger prompt it now answers in 6-8 s, inside
  the 14 s timeout. A match without a commander is unchanged. The deployed
  Worker needs `npm run deploy` for the new prompt.

- **AI Gateway (2026-10-24).** Created the `pixel-ops` gateway over the API
  (logs on, cache off, 300 requests a minute sliding, no gateway auth) and
  routed the Worker's Workers AI calls through it with the `gateway` option on
  `env.AI.run`, tagging each call with side, minute and mode as metadata;
  `vars.GATEWAY` names it and an empty value calls Workers AI directly. The
  first logged commander call shows 1,812 tokens in, 169 out, cost $0.0009,
  9.3 s. The logs are the evaluation dataset for the commander: every digest
  and plan pair, queryable over the API. The new API token also covers the
  gateway API and expires 2026-10-31. Next on this thread: an `anthropic`
  provider mode in the Worker posting the same prompt to Claude through the
  gateway with a stored key (built 2026-10-26, "Claude commander"), then mirrored
  batches per model.

- **Model comparison (2026-10-24).** The Worker's handler was run in Node
  against eleven Workers AI models on the same two digests (an Airfield held
  by 26 soldiers and an APC, and one held by 3), two calls each, reasoning
  models given a 2,500-token budget. Valid plans and latency: Llama 3.3 70B
  fp8 fast 4/4 at 5-9 s; gpt-oss-120b 3/4 at 8-25 s; gpt-oss-20b 1/4 at
  18-38 s; Qwen3 30B 4/4 at 6-17 s; Mistral Small 3.1 24B 4/4 at 6-10 s;
  Gemma 4 26B 0/4 and Nemotron 3 120B 0/4 at 40-48 s (no usable JSON);
  DeepSeek V4.1 flash, V4 pro, Kimi K2.6 and GLM 5.3 are not on the Workers
  Free plan. Judgement: gpt-oss-120b was the only one that read the board
  ("clear the enemy APC at Village before pushing Airfield", screens assigned,
  share 0.5-0.7 when defended and 0.9 with "Airfield looks thin" when not);
  Mistral and Qwen gave sane but generic plans; Llama kept choosing the
  already-true apcAlive wait. Mistral once waited for eight squads when the
  side had five, so the validator now caps squadsAt by the squads in the
  digest. The commander timeout is 30 s and `?model=<key>` picks a model from
  an allow-list in the Worker (llama, gpt-oss-120b, qwen3-30b, mistral-small,
  each with its own output budget), logged as metadata in the gateway, so
  models can be compared in real matches; the request body's model key is
  stripped before it reaches the model. Live check: gpt-oss-120b answered a
  defended digest in 10.7 s with a five-squad plan. Recommendation: play a few
  matches with `?model=gpt-oss-120b` against the Llama default; the gateway
  logs give every digest and plan pair for review. Anthropic or another
  provider stays optional: a stored key in the gateway and a second provider
  branch in the Worker if the catalogue models prove not enough.

- **Utility commander (2026-10-25).** Built the local utility AI from the
  sketch: `src/game/ai/utility.js` measures shared considerations each plan
  tick (force ratio, armour that can see a point, ticket pressure, time
  pressure, readiness, travel) and scores the options of the nine decisions,
  producing a plan in the LLM commander's schema so `applyPlan` and squad roles
  carry it out; the strategist takes a fresh remote plan first, then the
  utility plan, then the mode's goals. Personalities are weight sets
  (balanced, aggressive, patient), difficulty adds score noise (easy 0.25,
  normal 0.06, hard 0.02), a decaying commitment bonus stops dithering, and a
  location changing hands resets commitments. Met waits now latch until the
  wait changes, for both commanders, so an attack doesn't flicker off as
  squads leave the staging point. `?ai=utility` (or per team `utility,rules`)
  and `?persona=` select it. Head-to-head against the built-in planner on
  eight seeds, each played with the sides swapped: 12-4, mean ticket margin
  +91. The probe of a loss found every squad tagged "cover" for fifteen
  minutes: the caution pass kept squads hidden while any enemy APC was within
  150 m, and nothing went after it. Squads now hide at most 12 / 25 / 45 s
  (aggressive / balanced / cautious) once the APC can't see them, and the
  nearest anti-tank squad hunts any enemy APC within 150 m of a squad without
  launchers, closing until it can see it inside rocket range. That fix is
  shared by both commanders; the rerun went 14-2 for the utility AI, mean
  margin +204, winning seven of eight from each side. Made the default CPU
  commander the same day (`?ai=rules` restores the old planner). Utility
  against utility on the mirrored seeds: BLUFOR 9, OPFOR 7, every match to the
  clock, several decided by under 40 tickets, and 4-6 captures a side where
  the old planner managed 2-3, so the front moves more.

- **Stuck vehicles and phantom obstacles (2026-10-25).** The user's APC stuck
  against a building, firing but ignoring orders. Reproduced: a vehicle whose
  centre ends up inside a wall's clearance (radius x 0.9) had every step
  rejected, even straight away from the wall. Root cause: rotated map boxes
  blocked their whole axis-aligned bounding box, so the street village's
  diagonal walls and turned houses (and other rotated props) blocked 21,000 m2
  for 4,500 m2 of real footprint, and vehicles wedged themselves against
  invisible ground beside buildings; one garden wall alone blocked a 21 x 28 m
  rectangle. Fixes: the map builder cuts any rotated box into 0.5-1 m rows that
  span only its footprint (1,454 boxes, 5,819 m2 blocked in total), with an
  8 m grid behind `isBlocked`; separation pushes never shove a unit into a
  clearance; a unit already inside one moves with half the clearance and may
  take any step that doesn't go deeper (`penetration`); orders snap to the
  nearest cell of the open map's main connected region (the nav grid labels
  regions; pockets between houses are excluded), and a unit with no route
  drives straight, along a line that never goes deeper, to the nearest cell
  of the goal's region and routes from there. Tests: at three depths against
  a house wall the committed code never moved; now every case leaves, along
  the wall or 50 m round the houses. Forty random jammed spots around the
  Village: 0 of 40 reached reachable goals before, 32 of 40 after; the misses
  are inside the walled compound and narrow alleys a vehicle cannot enter.
  Regression: utility against the built-in planner on the corrected map went
  15-1, mean margin about +175, and a 25-minute warp now takes 27-48 s
  instead of 45-90 s thanks to the obstacle grid.

- **Rally points (2026-10-25).** The first port from the Squad research
  (`reports/`), with its scaled values. `src/game/rally.js`: each squad's
  leader drops one rally (`T` or the Rally button) with a squadmate within
  8 m; not with an enemy within 30 m (the attempt restarts the cooldown) or
  within 120 m of the enemy main; a 60 s cooldown per squad, a new rally
  replaces the old. A soldier whose nearest spawn is the squad's rally (or
  whose squad is wiped out) ignores his own 15 s timer and returns on the
  rally's 30 s wave if he has been down at least 10 s, still 1 ticket; forcing
  main base skips rallies. Any enemy within 18 m burns it, with a feed line.
  Minimap triangle, `RP-xx` label, reinforcements panel shows the wave
  countdown, the digest reports each squad's rally. Both CPU commanders share a
  placement rule: within 160 m of the squad's zone (or hiding from or hunting
  armour), more than 200 m from home, no enemy within 40 m, no rally of its own
  within 70 m. Tests: two squadmates killed beside a fresh rally were back on
  its first wave (30 s); a wiped squad came back together; an enemy at 25 m
  left it, at 15 m burned it; forcing main skipped it. A CPU side places 23-33
  rallies a match, loses 3-14, and does most of its respawning at them.
  Mirrored utility-vs-utility: BLUFOR 9, OPFOR 7, every match to the clock,
  infantry deaths up about 40% (170-300 a side), losers ending on 5-90
  tickets, so the 500 pools stay.

- **M1 Abrams tank (2026-10-25).** A new `tank` unit: 1,200 hp, 7 m/s, the
  `tankgun` kit (120 mm, 200 m, one round per 5 s, 220 to vehicles, 45 to a
  soldier, accuracy 0.45, a flat fast shell with a long tracer). Specs carry
  `armour: true`: explosive hits are scaled by facing in `Combat.facing`
  (front 0.6, sides 1.25, rear 2), so 5 rear rockets kill it against 17
  frontal. 30 tickets, 150 s respawn (105 s under Mechanized), 380 points
  (Mechanized takes 15% off); new *Armoured* preset (2 rifle, AT, engineer,
  tank, APC, supply truck, FOB kit, 1,078 points) and counter-pick to
  *Defensive* against a tank. Model after a
  voxel reference: tri-colour desert camo (BLUFOR) or olive (OPFOR) through
  `camoCanvas`, which gains a checker pass for the track links and their
  light link ends; seven road wheels under side skirts, a wedge-fronted turret
  with a bustle rack and stowage, smoke launchers, commander's and loader's
  MGs, sights and antennas, a long gun with fume extractor. Its own muzzle
  recipe (big halo, a strong light, a dust ring kicked off the ground) and a
  deep report and engine note. Both CPU commanders treat tanks as armour
  wherever they handled APCs: 90 m standoff, squads hide from its sight, AT
  squads hunt it, utility weight 6. Mirrored Armoured utility-vs-utility, 8
  games: BLUFOR 5, OPFOR 3, every game ending on tickets at 20-23 minutes
  with 1-5 tanks lost a side. Armoured against Balanced, sides swapped, 8
  games: Armoured 3-5, mean ticket margin +8 for Armoured, so one tank does
  not unbalance a match; OPFOR won 7 of 8 of these, against 5-3 BLUFOR on the
  same seeds mirrored, which reads as variance but is worth watching. No coax
  MG yet: against infantry the tank is a slow single shot.

- **Vehicle models from references (2026-10-25).** The APC, helicopter and
  trucks rebuilt after the user's voxel references, in the tank's style, and
  all vehicles now share one tri-colour camo (`camo`, olive `camoB` for
  OPFOR) with light `sand` plates and sand wheel hubs (`rim`/`rimB`). APC: an
  8x8 carrier with a long glacis, driver's hatch, cupola, four raised troop
  hatches, slotted stowage rails along the roof edges, a remote weapon
  station, width-marker posts, a rear cage and antennas; lower than before
  (roof 2.55 m), so its gun height, eye height and wreck smoke came down with
  it (still the autocannon kit). Helicopter: now a Chinook, a long cabin with
  framed windows, glazed cockpit, fuel sponsons, twin-wheel gear, door guns,
  aft pylon with two engines and tandem three-bladed rotors turning opposite
  ways (`parts.rotors`, each blurring into its own disc); it fires from the
  door gun on the target's side. Gameplay unchanged (8 seats, same speed and
  hit points). Trucks: a 6x6 with a square cab, split windscreen, louvred
  intake, spare wheel and a drop-side bed under canvas on hoops; the supply
  truck (`builders.supplyTruck`, picked by `spawn(..., { supply })`) rolls
  its curtains up over crates, cases, jerry cans and drums, a plain truck
  keeps them down. Fixed on the way: a cruising helicopter's bank was
  `turn / dt`, so a paused frame (dt 0) set it to NaN and the helicopter
  vanished for the rest of the match. Air Assault still loses in CPU hands
  (four of four, as it did before the change, with no helicopter losses).

- **Soldier model from references (2026-10-25).** After two voxel references
  (low ready, and aiming with a muzzle flash): multicam uniform (`uniform`
  reworked to tan with green and brown; OPFOR keeps olive), a high-cut helmet
  with NVG shroud, rails and ear defenders, glasses, a coyote plate carrier
  with three magazine pouches, a belt with a red-cross first-aid pouch, thigh
  pouches, knee pads, coyote boots (`boots`/`bootsB`, dark for OPFOR), a pack
  with a radio antenna, and a shorter carbine (about 1 m) with an optic and
  foregrip in gun grey. Arms now have elbows, and units.js solves both arms
  each frame (two-bone reach, `reach()`) so the hands stay on the pistol grip
  and foregrip. The rifle blends between three poses in the torso's frame:
  carried across the chest muzzle down to the left, shouldered while the
  soldier has an enemy (`aimK`, the torso bladed a quarter turn and the
  rifle's pitch and yaw cancelling the torso's so it points at the target,
  head dropped to the sight), and out in front when prone (head lifted). The
  muzzle flash now starts at the shouldered rifle's muzzle for each stance
  (gun height 1.85 m standing, 1.31 kneeling, 0.2 prone). A full CPU match
  ran clean; at normal zoom the soldiers read about as before.

- **Kit weapons (2026-10-25).** The soldier model carries all three weapons
  and units.js shows the ones a kit uses: `mg` holds a belt-fed gun (feed
  cover, carry handle, heavy barrel, ammo pouch, a bipod that folds down when
  prone) in the carbine's poses; `at` keeps a recoilless launcher (olive tube,
  venturi, grips, shoulder pad, sight on the left) slung diagonally across the
  pack while it has no target, then swaps it onto the right shoulder (prone:
  alongside the head) and slings the carbine across the pack. Hands follow
  whichever weapon is held (`HOLD`), and the muzzle flash starts at that
  weapon's muzzle; the rocket's existing backblast lands behind the venturi.

- **Standing at rest, a real kneel (2026-10-25).** Soldiers that stopped
  without a target went into the kneel stance, and the kneel pose (rear thigh
  swung back 0.9 rad, hips down 0.45 m) left the rear knee in the air with the
  foot kicked up, so a halted squad looked mid-stride. Now soldiers kneel only
  when stopped with a target (stand otherwise), and the kneel drops the hips
  0.5 m onto the right knee with that shin flat behind and the left shin
  upright.

- **Map props from references (2026-10-25).** Five voxel references: sandbag
  wall, concrete block wall, one- and two-storey desert houses, airfield
  control tower. In `maps/desert1km.js`, multi-part props are placed with
  `part()` in the object's own frame, every part taking the ground height at
  the object's anchor (`ax`/`az`, read by `gl/world.js`) so a building stays
  rigid on a slope; decoration draws from its own generator (`rd`), so `r()`
  and with it every prop position and obstacle are unchanged. Sandbag walls
  (`bagStack`: base perimeters, the Outpost and Relay rings) are bags in a
  running bond in three tints with a doubled top course over a dark core, and
  the FOB ring and the engineer's sandbag position use the same stack from
  `models.js`. Village and compound walls (`blockWall`) are grey concrete
  blocks in a running bond over mortar, with stained patches. Houses are
  plaster (`plaster1-3`, blotchy) with a cornice and parapet, timber beam ends
  under the roofline and the band between floors, lattice windows with sills,
  and a framed door on the side facing the street (the compound house's faces
  its gate). The control tower has a plinth, a shaft with slit windows, a
  glazed cab, a roof hatch, antennas and a dish (`render` texture); the mosque
  takes the plaster too. Plain-coloured parts are a unit box scaled to size
  (`scale` on a prop), so each colour is one batch: props went from 972 to
  8,186 but draw calls only from 844 to 874 over the village, and frame time
  is about the same. Obstacles are as before (the tower's footprint grew from
  7 to 7.6 m).

- **Generated references (2026-10-25).** The remaining props get their
  references from Workers AI. The user's prompt ("Create a 3dsprite - crudely
  pixel drawn suitable for simple 3d rendered game. No background. Blocky
  pixels.") on a Hesco wall and a container across the nine text-to-image
  models: FLUX.2 klein 4B was the only one to get the Hesco right and matched
  the voxel look on both, and the user chose it (runner-up FLUX.2 dev; klein
  9B failed four of five calls; schnell, Lucid Origin, Phoenix and the SDXL
  family drew the wrong object or a scene). `tools/make-refs.mjs` generates
  the rest (output under `refs/`, ignored). From its images: the Outpost ring
  is Hesco (`hesco`: speckled `liner` cells with sand tops in a dark steel
  mesh) and every container is a 20 ft box (`container`: ribs, rails, rusty
  corner castings, locking bars, rust spots) in the same five colours,
  positions and stacks. Obstacles unchanged (compared in Node against the
  previous commit: all 1,454 identical but the control tower's). The free
  plan's 10,000 neurons a day ran out on the comparison; the user supplied a
  temporary key for the last eight references (used inline for that one run,
  not stored). From them: the Outpost watchtower and both main-base guard
  towers (`watchtower`: concrete shaft with pilasters, ladder, sandbagged post
  on the platform using `bagStack` raised with `y0`, stepped tin roof), the
  Airfield hangar (blue ribbed walls, stepped barrel roof with arch ribs and
  rust, open doorway behind telescoping doors), the two barracks huts (sage
  prefab, framed windows, doors with steps, stepped gable roof), every fuel
  tank (saddles, bands, end rims, railed walkway, end ladder), every
  floodlight (round pole with collars, four-panel lamp housing, the lamp core
  still glowing at night), the Relay mast and hut (lattice with zig-zag
  braces, panel antennas, dishes and whips; concrete hut with door, vent, air
  conditioner, cable tray), the market stalls (checked awnings, crates of
  fruit) and the wells (stone ring, timber frame, rope, bucket). Obstacles are
  identical in value and order to before (bar the control tower). Parts
  thinner than 0.25 m (and shorter than 3 m) no longer cast shadows. The map
  now has 14,677 prop pieces against 972; draw calls 873/1,192/759 over the
  village, a wide view and the Airfield against 844/1,145/734. On this Mac
  mini's Intel UHD 630 with vsync off, frame time is about 5-9% above the
  previous commit (village 11 ms against 10, wide 14.8 against 14.3, Airfield
  11.0 against 10.1); with vsync on, both builds sit at the same 60/30 fps
  steps.

- **Recorded weapon sounds (2026-10-25).** The user asked for better gun and
  explosion sounds from free libraries. All sources are CC0: rifles, the MG,
  marksman and door gun from the Free Firearm Sound Library (OpenGameArt; AR-15
  for BLUFOR rifles, AK-47 for OPFOR, Mosin-Nagant 7.62x54R for the MG, Tikka
  .30-06 for the marksman, Savage .300 BLK for the door gun), and the
  autocannon, tank gun, rocket launch, explosions, shell blasts, ground impacts
  and ricochets from Freesound, each licence read from its page. Single shots
  were found by onset detection, cut with their echo, faded and set to a
  per-category level (peak 50 ms RMS: guns -18 to -9 dBFS, explosions -6,
  impacts -24; the old ElevenLabs clips ranged from -47 to clipping), 2-4
  takes a sound (`sounds/CREDITS.md`). The engine takes a list of takes per
  name, picks one at random, plays OPFOR rifles from `rifleB`, gives the tank
  gun its own clip and plays a `blast` where rockets and shells land (they
  used to make the bullet-impact tick). Fixed on the way: a clip's output was
  disconnected after the synthesized sound's length, so recorded clips were
  cut short (a rifle at 0.34 s, the explosion at 1.55 s).

- **Radio voices and recorded loops (2026-10-25).** With the user's ElevenLabs
  credits (4,500): a voice audition (8 voices, 404 credits) from which the user
  chose Adam for the squads and Brian for HQ; 31 lines on `eleven_v3` (717
  credits; shouted lines tagged), each trimmed, levelled, radio-coloured and
  wrapped in a push-to-talk click and squelch tail; and sound effects on
  `eleven_text_to_sound_v2` at about 10 credits a second (565): Chinook rotor,
  tank, APC and truck engine loops, desert wind and distant battle ambience,
  two bullet whizzes, digging and an AT reload. Loops have their tail
  crossfaded into their head and are WAV (MP3 padding clicks at every repeat).
  About 1,690 credits spent, about 2,810 left. `src/game/voices.js`
  (`VoiceDirector`) watches the match for the player's side: contact on a
  squad's first engagement, taking fire at mean suppression 0.55, man down
  (medic if the squad has one), enemy armour once per vehicle per squad within
  70 m, target down on a vehicle kill, reloading on some AT shots, moving on
  orders, rally down and digging in from the HUD; HQ on objective, FOB and
  rally events, armour first seen within 200 m, FOB damage, tickets at 100,
  vehicles back from respawn, and the result. `AudioEngine.voice()` plays one
  line at a time (HQ lines queue, two at most; squad chatter is dropped while
  busy), cooldowns per line plus a 10 s gap after any squad line: a 15-minute
  CPU match logged about 5 lines a minute with the radio never busy, so fewer
  in play. Engines and rotors use the loops (playback rate with speed or rotor
  spin, synthesis kept as the fallback), the ambience swells with recent
  shooting, near misses on soldiers whizz, AT gunners reload 1.6 s after a
  shot, FOB and sandbag builds dig. `Match.attachAudio` creates the radio, also
  when the engine is made after a match started at boot.

- **Chinook blade slap (2026-10-25).** The user found the rotor not realistic
  enough: it should chop. Measured as the spectrum of the loudness envelope,
  the ElevenLabs loop did chop (12.9 Hz) but softly (modulation depth 0.52),
  and its 0.6 s crossfade blended out-of-step beats at every repeat. The
  rotor is now a CC0 recording of real blade chop (TRP on Freesound, picked
  by sliding a window for strong, regular chop at a steady level: depth 0.94),
  slowed to 78% so it beats at the Chinook's ~11 slaps a second (two
  three-bladed rotors at 225 rpm) and sounds heavier, and looped on a whole
  number of blade beats starting on a beat, with a one-beat in-phase
  crossfade, a wrap-around level curve and an FFT resample (periodic), so the
  rhythm and the waveform both run straight through the seam. In play the
  slaps speed up as the rotor spools (playback 0.55-1.0).

- **Tank firing fixes and coax MG (2026-10-25).** The user saw the tank not
  firing on enemies. In open ground it did fire (every 5 s, 40-45% hits); the
  causes found: its first round could leave before the turret had turned (39
  degrees off in one test), so turreted vehicles now wait until the turret is
  within 7 degrees (`Combat.onTarget`); sight lines were flat, so any box over
  1.5 m between gun and target blocked the shot, now a box blocks only where
  the line passes below its top (`los`/`segHits` take end heights; matches
  barely changed, buildings do the real blocking: a tank saw about 30% of the
  enemies within 200 m); and against infantry it fired one round per 5 s.
  The tank now has a second weapon, `kit2: 'coax'` (7.62 mm: 90 m, bursts of
  six 0.09 s apart every 1.4 s, 10 per hit, accuracy 0.25), fired from the
  mantlet at the turret's target when that is infantry, with its own burst
  and reload (`cooldown2`, `burst2`); soldiers inside 60 m score above any
  vehicle for a tank, and on retarget it turns from armour to them. The kill
  feed names the weapon that scored (`firedKit`). A first version (110 m,
  12 per hit, 0.35) let Armoured beat Balanced 6-2 with up to twice the enemy
  infantry dead; toned down, mirrored seeds 1-4 split 4-4 (Armoured 2 wins as
  BLUFOR, 2 as OPFOR), Balanced losing 1.2x the infantry Armoured does.

- **Tap to move on touch (2026-10-25).** On the iPad a tap selected a unit
  but a tap on the ground did nothing visible: by design it cleared the
  selection, and orders needed a 0.45 s hold that players did not find. Now,
  with units selected, a tap anywhere but on a friendly unit orders them there
  (an enemy: attack-move; a landed friendly helicopter with infantry
  selected: board), the hold still orders, a tap on a friendly unit selects
  it, and the touch toolbar's **Clear** drops the selection. Hints and help
  say "tap the ground to move". `tools/touch-test.mjs` now checks tap-to-move
  (the order lands on the tapped point and the selection stays) and Clear,
  tapping only open, walkable ground on the canvas. Its drag-pan step passes
  about two runs in three under software GL: a 300-500 ms frame can let the
  hold fire before the first move arrives (unrelated to this change; not an
  issue at 60 fps).

- **Truck and APC transport (2026-10-25).** The user asked what a truck does:
  nothing (fast, unarmed, carrying nothing; only helicopters took passengers).
  Seats are now in the spec (`spec.seats`: heli 8, truck 8, APC 4; a supply
  truck none) and boarding works for any carrier: soldiers walk to a ground
  vehicle's tail (`boardPoint`) and mount once it is slow (or alongside it if a
  wall is behind), a carrier given a move order lets them out where it stops
  (`dropOnArrive`) in a fan behind it, never inside a wall (`exitPoints`), a
  helicopter where it lands as before; right-click or tap boards
  (`Input.canBoard`), **U** or the Unload button lets them out at once
  (stopping a ground vehicle), the selection line shows "n/8 aboard". A
  destroyed carrier now hands its passengers to the match (`ejected`), which
  applies the damage through the normal death path: out of a ground vehicle or
  a landed helicopter they take 20 and usually live, shot down in the air they
  die; before, a downed helicopter's passengers were killed outside the match
  and never respawned. Light Infantry may respawn beside a parked troop truck
  without enemies within 30 m (`truckSpawn`, a reinforcements option). The CPU
  (`Strategist.ride`): a troop truck at base, or an APC leaving it, takes the
  nearest squad within 150 m of base that would otherwise walk 250 m or more,
  drives it to a quiet point short of the objective (120 m truck, 100 m APC,
  50 m further back for each nearby enemy) and lets it out; the truck goes
  home, the APC fights on. Fixed on the way: the CPU helicopter lift's landing
  zone used `toward(attack, base, 70)`, which is 70 m from our own base, not
  short of the objective, so CPU Chinooks flew squads round their own base; it
  and the ground lifts now use `toward(base, goal, keep)`, and the helicopter
  lift takes squads from around base like the trucks (it needed one within
  40 m of the helicopter, which rarely happened). In a 15-minute Light v Air
  match the CPU drove one truck run (dropped 121 m short of the Airfield) and
  flew two helicopter lifts; Air Assault still lost its three test matches, so
  its weakness lies elsewhere. Touch tests and CPU matches ran clean.

- **Why Air Assault kept losing (2026-10-25).** An in-page probe (kills by
  killer type, ticket losses, respawn sources, helicopter time by state) over
  Air v Mechanized and Air v Balanced found the CPU's two Chinooks parked at main
  for 89-100% of every match (the second never flew in six matches; the first
  flew 0-2 lifts) with no kills: a third of the budget doing nothing. The lift
  needed a whole squad within 150 m of base, but squads walk out at the start
  and later respawn at rallies and FOBs. The doctrine's perk was dead too: the
  auto spawn (and the README) counted an idle helicopter as a spawn point, but
  the code only used it when the player forced the helicopter option, so the
  CPU never had it. Two more leaks showed up: the CPU sent its supply truck to
  dig sandbags in a location under attack, where the enemy APC killed it, two
  to seven times a match at 16 tickets each; and a squad wiped out with no rally
  always came back at main base (52 of 80 Air respawns in one match), 600 m
  from the fight. Fixes: `Respawn.carriers()` (idle helicopters under Air
  Assault, parked troop trucks under Light Infantry, none with an enemy within
  30 m) join main and FOBs as auto spawns and in the rally comparison, and the
  forced options take the one nearest the squad; a wiped squad's spawn is the
  one nearest where the soldier fell. `Strategist.air()` now ferries
  individual soldiers from around main (`riders`: anyone whose way to their
  squad passes the landing zone and saves 150 m, not the FOB builders), waits
  up to 15 s to fill and sends each back to his squad on landing; under Air
  Assault one helicopter perches 130 m short of the objective (`perchAt`: no
  enemies within 100 m, no armour within 180 m), and `caution()` lifts it off
  within a second when it is hit or enemies come within 70 m or armour within
  160 m. Supply trucks drive home when enemy armour is within 120 m or enemies
  within 40 m, and no FOB or sandbag job goes to a site within 150 m of enemy
  armour. Result over the three test matchups: Air's truck losses 2-7 a match
  to none, helicopter losses none, two of three went the full 25 minutes, but
  Air still lost all three (the 47-290 to 34-240 range). Not the force mix: one
  Chinook plus a support squad and a truck, or a second AT squad in place of
  the medic and FOB kit, lost the same way. The doctrine: Balanced's own force
  under Air Assault lost to Balanced from both sides (0-238, 17-256) while the
  Balanced mirror went 169-190, so Entrenched's +20 tickets a capture and
  faster FOBs outweigh cheaper helicopters and the helicopter spawn. Balanced v
  Armoured over seven matches after the changes went 5-2 to Armoured (4-4
  before): within the run-to-run noise of single matches, but worth watching.
  The user chose to make helicopters pay off more: under Air Assault a
  helicopter now respawns in half the time (`heliRespawn: 0.5`, 60 s), and a
  soldier a helicopter sets down counts two toward capture for 90 s
  (`Unit.landedT`, `airCapture: 2`, `captureWeight()` in Advance and Secure,
  Invasion and Territory; zones still cap at eight). CPU v CPU it changed
  nothing: Air lost all seven test matches (v Mechanized x3, Balanced x2, Light
  x2), flying one to six lifts a match and losing at most one helicopter. The
  perks pay only when helicopters die or land troops on a quiet objective, and
  the CPU loses the infantry fight for the contested middle, where a zone with
  both sides in it does not move at all.
  On top of that, Air Assault took half of Entrenched's ticket perk (+10 a
  location captured, `captureBonus: 10`). Still 0-7 over the same matchups: Air
  captured only two or three locations a match (its own first two, at most one
  more), so the perk paid 20-30 tickets, and it lost 1.3-3.8 soldiers for every
  enemy soldier (107-34, 245-153, 186-105, 242-185, 140-37, 450-277, 351-143).
  What decides CPU matches is the infantry fight at the middle location, and
  forces without armour lose it to forces with an APC (Light Infantry loses to
  Mechanized the same way).
  Decision (user): keep both perks for human players, who can land troops on
  undefended objectives, and stop the CPU picking a doctrine it cannot play.
  `counterPick` now answers Entrenched with Armoured (a tank against dug-in
  positions, was Air Assault) and draws its random pick from Balanced,
  Mechanized and Armoured; `?cpuloadout=air` still forces it for tests.

- **Nothing on the road (2026-10-25).** The road runs through the Outpost and
  the Depot, passes 4 m from the Relay's centre and enters both main bases, and
  props were placed without regard to it; `roadFree` then dropped the collision
  of any obstacle within 9 m of the (unsmoothed) centre line, leaving the prop
  drawn: vehicles drove through the Outpost watchtower, the Relay mast and part
  of its sandbag ring, hesco walls where the road crosses the Outpost ring, the
  Depot's six fuel tanks (which also overlapped into two long rows), one of the
  Airfield's fuel tanks, a floodlight and a run of perimeter sandbags at each
  base (whose gate faced the map corner: the two angle branches were swapped),
  fence posts, a bush. The map now measures the road as drawn (`smooth()`
  moved from `gl/strips.js` to `core/math.js`, shared by the renderer and the
  map; `roadNear`, `onRoad`, `offRoad` in `build()`), keeps every prop at least
  9 m from the centre line and uses the same test in `roadFree`: rings
  (`sandbagRing`, the Outpost hescos) leave gates where the road crosses, the
  Outpost tower, Relay mast and hut and base floodlights move straight out
  from the road (the base floodlights also just inside the ring), the Depot
  tanks stand in two staggered rows along its north-west side, the Airfield
  tanks on the apron west of it, the base gate faces the road, and bushes and
  rocks on it are skipped after drawing their random numbers, so the rest of
  the map keeps its layout. A Node check over `build()` finds no prop centre
  within 7.7 m of the road outside the bridges (the road is 12 m wide);
  CPU matches capture and drive out of the bases as before.

- **CPU Chinooks fly fire support (2026-10-25).** A CPU helicopter with nothing
  to carry and at 95% health or more takes off for `gunSpot()`: the three
  biggest knots of enemy infantry within 100 m of the places it attacks and
  holds or of any of its squads, and for each eight bearings 40 m out (our side
  first); a point within 165 m of an enemy APC is out (tank guns can't shoot
  up), launchers within 95 m count against it, more than two rule it out, and
  the fewest wins. It hovers there (`Unit.hover`: a helicopter that arrives
  stays in the air, turning broadside to its target so a door gun bears) and
  follows the fight every plan tick, home after two ticks with nothing to
  shoot; `caution()` sends it home below 70% or moves it when the point gets
  exposed. Ferrying and the Air Assault perch come first. Needed alongside:
  every enemy force has an AT squad, rockets reach 90 m and the door gun 70, so
  at first no point was ever safe (126 of 142 searches in one match), and with
  launchers allowed it fired 793 rounds for 4 kills. So an unguided rocket at a
  helicopter in the air now hits 0.35 as often (`Combat.fire`), the door gun
  is an M240 on a steady mount (80 m, 14-round bursts 0.05 s apart, 7 damage,
  0.18 accuracy; was 70 m, 10 rounds, 6, 0.14), and a helicopter landed in its
  main base is repaired, full in a minute (`Support`). Over the seven Air
  Assault test matchups it killed 34-35 a match against Light Infantry (about
  20 minutes on station), 4-8 against Balanced, 0-2 against Mechanized (its
  APCs keep it back), and lost three Chinooks in seven matches; Air Assault
  still lost all seven, so the CPU keeps not picking it.

- **Manning sandbags (2026-10-25).** The user expected soldiers to get in and
  out of sandbag positions. Before, there was no such state: protection was the
  generic low-cover rule (a low obstacle within 3 m toward the shooter halves
  the hit chance), and a rifle squad ordered into a position, as the CPU posted
  its squads, ended up about 4 m behind it, one of four covered from the front
  and none from the side. Two causes: separation pushed every soldier out to
  the sum of the radii from the position's centre (the sandbags model has a
  3.6 m radius), and the walking grid's clearance closed the front half of the
  inside. Now a position (`spec.hollow`: no separation) has four firing slots
  (`POST_SLOTS`: two against the front wall, one against each side) and a crew;
  `Unit.man(sb)` takes the first free slot, walks to the open rear
  (`postEntry`) on the grid, then straight in (`stepPost`), and settles at the
  slot (or as close as the bags allow, within 1.2 m); settled he holds it and
  faces out. `Combat.dugIn`: a settled soldier shot at from the front or sides
  (within 108 degrees of the position's facing) has 0.35 of the hit chance
  instead of cover's 0.5 (floor 0.2 with stance), and suppression builds at
  half rate. Any order without `keepPost` takes him out. Right-click or tap on a
  friendly position (or the open ground inside it: `Input.postAt`) mans it,
  four at most, with a toast for a full one; **U** or the Leave position button
  walks them out of the back; the selection line says who is manning. The CPU
  mans the positions at the place it holds (`manPost`) and keeps a squad that
  is in or on its way in out of the job share (it used to reshuffle the post
  squad within 15 s), and `caution()` leaves manned squads in place under
  armour. Tested: four in and settled from a player order, 0.35 from the front,
  45 degrees and the side, 1.0 from the rear; a second squad told the position
  is full; U walks them out; a CPU squad manned a position at the Village
  within 30 s and held it. The CPU still rarely builds sandbags (none in 12
  minutes in two Entrenched matches): its truck guard keeps dig-in jobs away
  from enemy armour.

- **CPU digs in more often (2026-10-25).** Measured over three 15-minute
  matches, each CPU side built exactly one sandbag position and its commander
  picked "no logistics" 45-90% of the time. Causes: one position per held
  place (`logistics` skipped a place with any), the utility score for
  sandbags rose only with the threat to the place (the worst time to park a
  supply truck there), a FOB kit whose site was blocked just now stopped all
  logistics, and two older bugs that left jobs to time out after four minutes:
  a squad on the move was never redirected to the job (`!p.sq.busy` guarded
  the order, so the engineer kept walking to an attack 250 m off), and an
  engineer 7 m from the spot was "there" for `send()` (squad centroid within
  10 m) but not for the build (4 m). Now: `digSpot()` gives up to three
  positions per held place facing the enemy's side (10 m in front of the
  middle, both flanks at 14 m, scaled to the place; stand-ins where the road
  or a building takes one), 12 m apart, off the road, never within 150 m of
  enemy armour or 40 m of enemies; the utility scores sandbags 0.3 + 0.35 x
  quiet + 0.25 x threat while the place has fewer than three (x0.6 while a FOB
  kit is left, so the FOB comes first); a blocked FOB site falls through to
  digging; the job orders the squad to the spot whatever it was doing and the
  engineer onto it; squads manning positions count toward the attack share as
  holders. Result: 3-6 positions a side in 15-25 minutes (team 1 fewer, its
  Depot and Relay sit on the road), manned for long stretches, no supply
  trucks lost; seven full matches went to time with Balanced v Armoured 2-2,
  Balanced v Mechanized 1-1, Balanced over Light.

- **Balance runs (2026-10-26).** `tools/balance.mjs` plays CPU-vs-CPU matches to
  the end in headless Chrome, several at once, and prints each result and win
  tables per pairing, per preset and per base. The page's own loop never runs:
  the tool steps the simulation in one synchronous block, about a minute per
  25-minute match, 16 matches in under four minutes twelve at a time. A seed
  replays the same match: Math.random is seeded before the page loads and both
  random sources are reseeded as the match starts, and sound is off (its rate
  limit runs on the audio clock, which is real time, and it draws random
  numbers). The turret's idle scan used `performance.now()` and decides when a
  turret can fire; it now runs on simulation time. Checked with 48 copies of
  one seed (twelve at a time, interpreter-only V8 too) and six full matches run
  twice: all identical. Early test runs that did diverge are put down to
  Chrome processes left by crashed runs holding the debugging ports; the tool
  now refuses a port that is in use. Default set, both bases, seeds 1-2:
  Armoured v Balanced 2-2, Balanced over Mechanized 3-1, Mechanized over Light
  4-0, Light over Air 4-0 (the CPU never picks Air Assault; it is a player's
  doctrine), south-west 7 and north-east 9 of 16. Four games a pairing is a
  small sample: more seeds before changing numbers on it.

- **No sandbags on the road (2026-10-26).** A player could build a position
  across the road and block their own convoys; the CPU already kept its spots
  off it. `canBuildSandbags` now refuses within `RULES.sandbags.roadClear` (10
  m of the centre line: 6 m half width plus the position's 4 m), with "too
  close to the road" on the button. The road distance moved from the
  strategist to `roadDist(map, x, z)` in core/math.js; the CPU's spots keep 4 m
  more, since its engineer starts digging within 4 m of the spot. Same 16
  balance matches as above: positions per match south-west 4.3 to 3.8,
  north-east 1.9 to 2.2, no page errors. Agreed with the user: the north-east
  imbalance is left to the map redesign (per-place defensive positions) and
  FOB emplacements wait until after fog of war.

- **Fog of war, stage 1: vision and the player's view (2026-10-26).** The user
  chose the recommended design: team vision with line of sight, darkened ground
  outside it (a setting, so plain hidden enemies stay one click away), the CPU
  on the same rules, firing reveals the shooter. Stages: 1 vision and the
  player's view (the CPU still sees everything), 2 the CPU plays by vision and
  scouts, 3 the LLM commander's digest and a balance check.
  `game/vision.js`: every 0.2 s each unit casts rays over an 8 m grid out to
  its sight range (soldier 120, APC 160, tank 210, truck 100, landed heli 120,
  heli in the air 250 over buildings, FOB and sandbags 100: just past each
  main weapon), one sample per cell; a cell counts while a man standing in it
  (1.2 m) clears every hill and tall building (1.5 m and up, combat's
  line-of-sight boxes) in between, so ridges and buildings throw shadows. A
  unit's cells are kept until it moves 4 m or its eye height changes. Enemies
  are visible in a seen cell; in the air, within any sight range; for 5 s
  after firing at the side (and a unit fired at is seen by the shooter's
  side, so tracers never fly into the dark at nothing); FOBs, sandbags and
  rallies once seen; caches always (objectives). Losing sight leaves a ghost
  (last position) for 30 s. Cost: 0.56 ms a vision tick for both sides, 23% of
  a headless CPU-vs-CPU simulation (from 44% before one-sample-per-cell, cell
  heights cached and the 4 m recast); CPU-vs-CPU results are unchanged
  (vision draws no random numbers and nothing reads it yet).
  `gl/fog.js` (the player's view): enemies not seen get `group.hidden` (the
  renderer skips them, so no shadow or pick either); a per-cell texture eased
  over 0.25 s darkens and greys unseen ground and props in the main shader;
  ghosts are fading red outlines; the minimap shades unseen ground, leaves out
  unseen enemies and outlines ghosts; no name tags on unseen enemies; the
  enemy's radio, FOB and sandbag events stay out of the feed; HQ's "armour
  sighted" fires when our side first sees a vehicle. Off when spectating
  (`?fog=1` forces team 0's view) and once the match ends, so the debrief
  shows everything. Engine sounds and dust still carry from hidden vehicles.

- **Fog of war, stage 2: the CPU plays by vision (2026-10-26).** `Vision.contacts(team)`
  is what a side knows: the enemies it sees plus stand-ins at last-known positions
  (ghost, age, the real unit behind it), worked out once a tick. The strategist's
  enemiesNear/armourNear, the attack stand-off, screen cover, caution (armour,
  squads falling back, APC stand-off, AT squads hunting: the hunt keys on the
  real vehicle, not the stand-in), the perch and fire-support threat checks, the
  enemy FOB to raid and Skirmish hunting (no contact: sweep toward their base)
  all use contacts; so does the utility commander, a sighting counting for less
  as it ages (x1 seen, down to x0.3 at 30 s), and a place the enemy holds that
  the side has not seen for 30 s counts as held by `RULES.vision.guess` (4, about
  a squad) so the CPU does not walk into an unseen garrison. `match.enemiesNear`
  counts only seen enemies (game rules pass `all`: Destruction's cache reveal).
  Capture zones publish what the capture bar shows (`contested`, `pushing`), and
  Advance and Secure/Invasion count a place of ours as threatened when it is
  contested or being drained, unseen attackers or not; Territory ranks hexes by
  seen enemies, not the zone counts. `?fog=0` (app.fogOff) switches vision off
  for everyone: contacts are then every enemy and the 16 default matches replay
  exactly as before fog of war. With fog: no page errors, captures per match
  5.4 (5.6 without), infantry deaths 291 (350): fights start with less
  information. 48 matches each way (default pairings, seeds 1-6, both bases):
  south-west 19 / north-east 29 without fog, 14 / 34 with it; by preset with
  fog Mechanized 19/24, Armoured 7/12, Light 12/24, Balanced 10/24, Air 0/12.
  The north-east lean is the map's, not the fog's: mirror Balanced matches with
  the fog off go to the north-east six times out of six, which takes the Village
  first every time (134-166 s). The Village sits at (40, 10), not the centre,
  and the north-east route to it is shorter (base 177 m to Relay, 149 m to
  Depot, 248 m to Village: 573 m, against 149 + 206 + 248 = 602 m from the
  south-west; its respawns walk 28 m less), and the swap test (`?swap=1`) shows
  the edge follows the base, not the team. The next map has to be exactly
  point-symmetric (bases and locations mirrored through the centre); the
  balance tool's mirror pairing (`--pairs balanced:balanced`) is the check.

- **Fog of war, stage 3: the LLM commander's digest (2026-10-26).** The digest
  leaked the enemy four ways: exact counts in every capture zone, every enemy
  unit as clusters, every enemy FOB, and the enemy's FOB and sandbag news in
  the events. Now (`digest.js`, with the fog on) a location's `theirs` counts
  the enemies the side sees in the zone and `contested` comes from the capture
  bar; `enemy` clusters are built from contacts, a group seen only before
  carrying `lastSeen` (seconds, its freshest sighting); `fobs.theirs` lists
  only enemy FOBs it has found; the enemy's FOB and sandbag events are left
  out. The Worker's system prompt explains the fog (what lastSeen, theirs and
  contested mean, and that an enemy-held place may hold more than it shows);
  it goes out with the next `npm run deploy`. Checked: team 1's digest five
  minutes in showed 17 of the 25 enemies at the Airfield and no enemy FOB
  (the fog-off digest listed the FOB at the Outpost); six minutes against the
  commander stub, stepped in chunks so its replies land: 38 plans answered
  and applied, no errors. The balance check is stage 2's.

- **Fog fixes after the first deploy (2026-10-26).** The user saw their own
  area grey while the minimap showed it lit: the image textures leave
  `UNPACK_FLIP_Y_WEBGL` on, so the fog grid went up mirrored north to south
  (the headless checks looked at the Village, which sits on the mirror line).
  `setFog` now uploads with the flip off. The fixed view then showed big blocky
  shadows: any tall box blocked its whole 8 m cell, so a 0.6 m floodlight pole
  cast the shadow of an 8 m wall (282 of the 574 tall boxes are under 2 m
  across). A cell now blocks sight when tall boxes cover an eighth of it
  (8 m2): house walls (1 m thick) and container stacks block, poles and spaced
  posts do not; 163 cells block across the map. The CPU's vision always ran the
  right way round; the blocking change touches it: 16 default matches, no
  errors, captures 5.5 a match (5.4), infantry deaths 323 (291).

- **Second map: decisions and engine groundwork (2026-10-26).** The user chose
  layout A (three lanes across a river: a town lane with an infantry-only
  footbridge, a road lane through the one vehicle bridge, an open lane with a
  ford), 2 km, desert again, tank traps as the only route blocker, and better
  river, road and bridge textures. The map is mirror-symmetric about the river
  (z to -z), not rotated: rotation would make the west and east crossings the
  same kind, mirroring keeps each lane's character and gives both sides the same
  distances. Seven places: each side's home row (town, depot, quarry; capturable
  from the start), the Bridge in the middle, the far row; four is the majority.
  Groundwork, with Desert Crossing unchanged (16 default matches replay exactly):
  the lattice is a network (`Objectives`: a map gives `links`, pairs of names, and
  `home: team` for the places touching a base; without links the list is a chain,
  which reduces to the old rule; Invasion's front is the first place the attacker
  can take); `?swap=1` flips `home` on linked maps; maps are picked by key
  (`game/maps/index.js`, `?map=`); a map sets its nav grid cells (`map.nav`): at
  2 km a 1 m infantry grid is 4 M cells, 132 MB, and long searches hit the
  80,000-cell cap, so the new map uses 1.5 m (59 MB, paths 10-20 ms) and 2.5 m for
  vehicles; `Terrain` no longer takes `Math.max(...h)`, which overflows the stack
  at 2 km (250,000 heights).

- **Palm Valley, terrain and roads (2026-10-26).** `maps/valley2km.js`: bases at
  (0, -820) and (0, 820); Kasbah, Depot, Quarry / Bridge / Mine, Pumps, Souk; a
  river along z = 0 narrow at the footbridge and the bridge, wide at the ford, two
  sandbars; bluffs at 230 m with a pass per lane; hinterland hills, a quarry pit,
  dunes; asphalt to the town and over the bridge, dirt tracks along each row and
  through the ford; a palm belt and fields along the banks; scattered rocks and
  bushes. Engine support: `Terrain` `mirrorZ` (builds the south half and copies it:
  heights match to the last bit), per-point river widths (`ws`), capsule fords with
  a level bed, a wading depth (`wade`: the ford's bed is 0.6 m under the water and
  units wade it at half speed; Desert Crossing keeps its rule, ground 0.3 m clear of
  the water, and its matches still replay exactly); footbridges (`foot: true`) left
  out of the vehicle grid; `roads` (several, `kind: 'track'` for dirt) in the road
  rules, the minimap and the strips; `splatRes` (1024 at 2 km). Route-finding:
  across the river or the bluffs a search used to flood a whole bank looking for the
  way over (a vehicle detour found nothing at the 80,000-cell cap, 50-160 ms
  uncapped), so a map can declare gates (`gates`: barrier lines and their crossings,
  footbridges for infantry only); a route goes crossing to crossing, the shortest
  chain in straight lines, each leg a search on one side; the cap is per map (200,000
  here). 800 random routes: none fails, 2.6 ms (vehicles) and 5.4 ms (infantry) on
  average, 36 ms at worst. Found on the way: the water surface had always been a
  0 x 0 plane (`plane:,`), so no map ever drew its water; it is the map's size now.
  CPU check, 12 matches: no errors, about a minute each, south-west 7 north-east 5.
  But each side only ever takes its middle place at the start (Depot, Pumps, about
  80 s), leaves its town and quarry neutral for most of the match, and sends
  everything at the Bridge: the footbridge and the ford see 0-9 unit-minutes a match
  against 100-250 at the bridge. The utility commander picks one attack target, which
  was all a chain ever offered; on a network it never spreads out. Next: let it take
  free places with a detachment and pick lanes.

- **CPU target picking on a network (2026-10-26).** A minute-by-minute dump showed
  two faults: the utility commander gives every squad a role, so a strategist-only
  grab reflex never had a squad to send; and the attack target flipped Bridge,
  Kasbah, Quarry, Kasbah within four minutes, so the attack walked between places
  600-1,100 m apart and never arrived (some matches had no infantry deaths). Now:
  `Strategist.grabsFor` lists free places (capturable, no enemy we know of within
  60 m of the zone (a sighting older than 15 s does not count), no armour within
  120 m, not contested, not held by the enemy unless seen in the last 30 s); the
  utility commander keeps them out of the attack candidates (unless every candidate
  is free) and gives each one a `grab` squad, the nearest in good order, two squads
  always left for attack and holds; among several candidates a place near the
  current attack force scores up to double (momentum), and a commitment fades over
  60 s per kilometre of map (120 s here). `front(team, toward)` is the place of ours
  next to the target (the staging point and FOB anchor); on a chain it is the old
  front. The strategist runs the grab reflex for advisers that leave squads free
  (the rules planner); `grab` is a plan role, so the LLM can use it (the Worker's
  prompt says so). Desert Crossing still replays its 16 default matches exactly (a
  chain offers one candidate, which leaves every score as it was). Palm Valley, 12
  matches: each side's town and quarry taken within five minutes 43 times of 48
  (almost never before), infantry deaths 234 a match (35-50), six captures in the
  enemy's row through the flanks (four by the town, two by the ford), the footbridge
  and the ford used (92 and 123 unit-minutes against 0-9 a match); the Bridge, the
  majority's pivot, is still the main fight (3,733). Mirror matches (Balanced and
  Mechanized, seeds 1-6): south-west 5, north-east 7, average margin 16 tickets.

- **Palm Valley buildings and defensive positions (2026-10-26).** Desert Crossing's
  prop builders moved to `maps/kit.js` (`makeKit({ r, rd, onRoad })`: houses, walls,
  hesco, containers, towers, hangar, barracks, fuel tanks, floodlights, masts, huts,
  stalls, wells, sandbags, palms, bushes, rocks, scrub); its build output is
  byte-identical (FNV hash of the JSON, 14,170 props, 1,518 obstacles). Palm Valley's
  south half, mirrored north: a base like Desert Crossing's; Kasbah, a round town of
  flat-roofed houses on a 12 m grid round an open square (gaps of 2.5 m or more for the
  1.5 m grid; houses big enough to block sight), a mosque and minaret, stalls, a well,
  palm yards and a ruined wall on its south-west side; Depot, fuel tanks either side of
  the track in from Kasbah, containers and a barracks hut east of the road, a pump
  house, a fence, floodlights; Quarry, a crusher fed by a conveyor, gravel heaps, a site
  office, a tower and containers beside the pit (its floor is below the river, so it
  is a flooded pit); the bridgehead, hesco walls, sandbags, a guard hut and a light;
  ruined walls along the town lane. 24,400 props, 5,100 obstacles. Each place lists
  sandbag positions round its approaches (`locations[].defend`; the north places get
  the mirror images); `digSpot` takes those facing the enemy first (flanks next, never
  the ones behind) with the usual tests, and `postRange(loc)` (out to the map's spots,
  or 12 m past the zone as before) decides which positions belong to a place for
  digging, manning and the utility's count. Checks: every spot walkable and
  reachable, every place reachable on foot and by vehicle; 12 matches without errors,
  infantry deaths 209 a match, 9.6 sandbag positions a match, all on the map's spots;
  mirror matches 6-6, margin 18, positions 4.7 and 4.5 a side; Desert Crossing
  replays exactly. A match takes about three minutes in the balance tool now (one to
  two before the buildings): more obstacles for the sight and cover tests.

- **Player onboarding (2026-10-26).** The README explained FOBs and rally points for
  developers; the game explained nothing beyond key hints. `core/guide.js`: a field
  manual (H, a panel button, ? on touch; the game pauses while it is open; Esc closes
  it) with eight pages: objective, controls (touch or desktop), squads, spawns (what a
  FOB and a rally point are for: every fallen soldier walks back from his spawn, so
  spawns decide how fast an attack refills; a FOB serves every squad and lasts but
  costs 40 tickets to lose, a rally serves one squad and is cheap), sandbags,
  transport, vehicles and fog of war; every number in it is read from RULES. A
  briefing opens it on the objective page at the player's first match. One-time hints
  (localStorage `pixelops.guide`; a Hints setting): the objective first, then moving,
  engineers beside a supply truck (B, N), a squad 250 m from base without a rally (T),
  soldiers near a vehicle with seats, an empty sandbag position near a squad, enemy
  armour in sight, the first last-known outline, a place of ours being drained, the
  first squad wiped out; one at a time, 16 s each, the Manual button on the card opens
  the page that explains it. Checked in a fresh profile by stepping frames by hand
  (headless Chrome runs no animation frames without input): the briefing opens at
  0.5 s paused, closing resumes, the objective hint comes first, the engineer hint
  fires beside the truck, the touch wording names the buttons. The README had a FOB
  costing 20 tickets; it costs 40 since the balance pass (fixed).

- **Tank traps (2026-10-26).** A row of six Czech hedgehogs (`traps` unit, model in
  core/models.js, `trapBoxes`: 15 m, enough to close a road or the bridge deck), laid by
  an engineer beside a supply truck (X; 20 supplies, 10 s, six rows a side, 18 m apart,
  not within 100 m of the enemy base), centred across the road he stands on
  (`roadAlong` in core/math.js) or across the way to the enemy's base off a road. Its
  boxes stop vehicles only: `WorldState.vehicleObstacles` (`isBlocked`/`penetration`
  take a vehicle flag, used by vehicle movement) and the vehicle nav grid
  (`nav.vehicle.extra`); infantry walk between, no cover, no sight blocking. Any
  engineer standing within 8 m of a row clears it (X, 8 s); `NavGrid.refresh(box)`
  works the cells out again from the ground, the obstacles and the remaining blocks.
  Gated routes try the next chain of crossings when one is blocked (a trapped bridge:
  vehicles go by the ford). Rows stay known once seen under fog of war; the enemy's
  laying stays out of the feed. CPU (`strategist.trapSpot`): at a choke the map lists
  (`chokes`; Palm Valley: both bridge ends, the ford banks in pairs) on its side (nearer
  a place it holds than any of theirs, within 400 m), where it has seen enemy armour
  within 600 m in the last two minutes, clear of enemies and armour, not within 30 m of
  its vehicles' way to the place it pushes for; two rows at most, a job every two
  minutes. It clears the enemy's within 180 m of the place it pushes for or holds, and
  its own between the place it pushes from and the target (the vehicle route cannot show
  those: it already goes round them), then leaves that choke alone for five minutes (the
  first version laid, cleared and laid again). The first rule set, armour merely in the
  enemy loadout, laid 33 rows in 12 matches with that churn; armour in sight at the
  moment of the check laid 2; seen in the last two minutes: 29 rows, two clears, mostly
  pairs closing the ford. Desert Crossing lists no chokes: its matches replay exactly.
  The field manual's sandbag page covers traps, and a hint flags the first enemy row.

- **River, road and bridge graphics (2026-10-26).** The user asked for all three, the
  river after a reference picture (deep teal, a bright broken foam rim at the shore,
  squiggly foam lines trailing into the water). Water: a depth map from the terrain
  (one byte per terrain vertex, (depth + 0.5) / 4.5, uploaded unflipped) and a water
  mode in the main shader (uMode 2), drawn lit after the opaque pass (blended, no depth
  write, not picked), so bridges shadow it and the night and fog of war darken it.
  Colour from pale to deep teal with depth; foam by distance to the shore (depth over the
  bank's slope, so steep and gentle banks get the same widths): a ragged rim broken into
  brighter chunks, curling lines running out over 7 m along the slope (spaced 4.6 m,
  warped by noise, animated), drifting ripples on the ford's shallows. Ground mode reads
  the same map: wet sand within 0.45 m above the water and a darker bed under it. Grass
  tufts under the water are left out. First versions: foam by depth gave a 1-pixel band
  on steep banks and grainy speckle where the lines' direction flipped on flat water;
  the lines came out as an even comb, then too pale in narrow channels. Roads: asphalt
  and dirt-track textures redrawn at about 10 pixels a metre (patches, cracks, polished
  wheel tracks, broken edge lines, faded dashes; ruts, pebbles and a paler hump), with
  sand drifted over ragged cut-out edges so they blend into the ground. Bridges: one
  builder in maps/kit.js for both maps: a concrete deck on girders, kerbs, railings on
  posts, two-column piers with caps on the river bed, abutments and wing walls; the
  footbridge in planks on stringers with rope rails and piles. The railing obstacles are
  unchanged, so Desert Crossing still replays exactly. Road strips now ride a deck out to
  3 m past its sides: Desert Crossing's road bends as it leaves its bridge and used to
  drop under the deck there.

- **Claude commander (2026-10-26).** The user stored an Anthropic key in the `pixel-ops`
  gateway (BYOK, alias `default`) to try thinking models. `env.AI.run` only reaches Workers
  AI, so the Worker has a second branch: `?model=haiku`, `sonnet` or `opus` (Claude Haiku
  5.5, Sonnet 5.5, Opus 5.5) call `messages.create` through the official `@anthropic-ai/sdk`
  against the gateway's Anthropic endpoint (`env.AI.gateway(id).getUrl('anthropic')`, so no
  account id in the Worker). The gateway adds the stored key when a request carries none:
  the SDK gets a placeholder key and a fetch wrapper drops the auth headers, so only
  `cf-aig-authorization` (the `CF_AIG_TOKEN` secret) and `cf-aig-metadata` (side, minute,
  mode, model) go out. Request: the system prompt as `system`, the digest as the user turn,
  adaptive thinking, the plan schema as a structured output (`jsonSchemaOutputFormat` moves
  the numeric and length limits into the descriptions; `validatePlan` still enforces them),
  no temperature (the API rejects it now), 16,000 tokens; a refusal or running out of tokens
  is an error and the CPU carries on with its own plan. `:low` to `:max` after the key sets
  the effort. The game's timeout went from 30 s to 60 s. The system prompt stopped
  describing Desert Crossing (five locations in a line, 1 km): the digest now carries the
  map's name and size, both bases, and each location's links and the base it touches.
  Checks: the handler in Node and in `wrangler dev`, and a match served by the local Worker
  with both CPU sides on Haiku. On one Palm Valley digest (4,850 tokens in) Haiku answered
  in 3 to 5 s with 370 tokens out and no thinking, Sonnet in 7 s with 880 (540 thinking),
  Opus in 12 s with 880 (530 thinking): about $0.0007, $0.019 and $0.037 a call. Opus read
  the board (bleeding them with 4 of 7, Depot contested by about 13 and an APC, pull back to
  Bridge if the APCs drop below 40 hp, no kits left so sandbags only); Sonnet sent two MG
  squads to grab Kasbah and Quarry, both enemy-held, against the role's description. The
  Worker bundle is 971 KB (171 KB gzipped) with the SDK.

## Open questions








1. Match length target: 15 minutes (arcade) or 25 (methodical)? Affects ticket pools.
2. Fog of war: none (Squad-style, everything visible) or squad-based vision?
   Decided 2026-10-26: team vision with line of sight, darkened ground, and the CPU
   on the same rules (see "Fog of war" under Status).
3. OPFOR art: olive/green recolour of the same models, or distinct silhouettes?
4. Should losing all vehicles in the loadout end the game's vehicle supply, or do
   vehicles respawn at main base on a timer (proposed: timer plus ticket cost)?
