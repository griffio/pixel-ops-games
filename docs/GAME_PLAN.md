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
  decides tempo. Follow-up: BLUFOR won every CPU-vs-CPU run, worth checking the
  map or lattice for a side bias.

## Open questions







1. Match length target: 15 minutes (arcade) or 25 (methodical)? Affects ticket pools.
2. Fog of war: none (Squad-style, everything visible) or squad-based vision?
3. OPFOR art: olive/green recolour of the same models, or distinct silhouettes?
4. Should losing all vehicles in the loadout end the game's vehicle supply, or do
   vehicles respawn at main base on a timer (proposed: timer plus ticket cost)?
