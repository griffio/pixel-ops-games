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

## Open questions

1. Match length target: 15 minutes (arcade) or 25 (methodical)? Affects ticket pools.
2. Fog of war: none (Squad-style, everything visible) or squad-based vision?
3. OPFOR art: olive/green recolour of the same models, or distinct silhouettes?
4. Should losing all vehicles in the loadout end the game's vehicle supply, or do
   vehicles respawn at main base on a timer (proposed: timer plus ticket cost)?
