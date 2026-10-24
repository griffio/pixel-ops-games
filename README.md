# Pixel Ops — 3D pixel-art engine sandbox

A browser sandbox for testing a "3D rendered as pixel art" RTS look, with two
interchangeable renderers behind one simulation:

- **raw WebGL2** back end with instanced batching (the default), no dependencies
- **three.js** back end (`?r=three`, legacy airfield sandbox only)

Low-poly units are rendered into a small buffer whose texel size is fixed in
**world** units, then upscaled with nearest filtering, so zooming in makes the
pixels chunkier while the camera rotates freely. No build step.

## Run

```bash
npm start            # python3 -m http.server 8787
open http://localhost:8787               # WebGL2, the game renderer
open http://localhost:8787/?r=three      # legacy three.js back end (160 m airfield sandbox only)
```

By default the **force builder** opens over the 1 km *Desert Crossing* map: spend
1,200 points on squads (rifle, support, anti-tank, medic, marksman, engineer),
vehicles (trucks, supply trucks, APCs, transport helicopters) and one doctrine
(Mechanized, Air Assault, Light Infantry, Entrenched), or pick a preset. Your
loadout is saved in the browser. The CPU reads it and counter-picks, then a
25-minute **Advance and Secure** match starts: you command BLUFOR (tan) from the
south-west corner against OPFOR (olive) in the north-east. Five locations
(Outpost, Airfield, Village, Depot, Relay) are captured in order; holding the
majority bleeds the enemy's tickets, losing a location costs 10, and capturing all
five wins outright. Each side starts with 500 tickets; vehicle losses and
infantry respawns drain them, and the first team at 0 loses. Infantry are
expendable: 35 hit points, one ticket, back in 15 seconds in squad waves. Left-drag to select
squads, right-click to move them, click an enemy to attack-move, click the
minimap to jump the camera, and keep zooming out for the strategic view.
`?loadout=air|mechanized|light|defensive|balanced` skips the builder,
`?cpuloadout=<preset>` fixes the CPU's pick, `?cpu=both` lets the CPU play both
sides, `?cpu=none` disables it, `?mode=skirmish` drops the objectives, and
`?sandbox=1` restores the free-roam airfield with no combat.

Any static server works (ES modules can't load over `file://`). three.js comes
from jsDelivr via an import map; the WebGL2 back end loads nothing external.
The stats panel has a link that switches renderer while keeping the view.

**Logistics and air.** Supply trucks carry 100 supplies and refill inside your
main base. Select an engineer squad standing within 20 m of a supply truck and
press **B** (or the Build FOB button) to raise a forward operating base in 20 s
(10 s under Entrenched); each FOB kit in your loadout allows one FOB. A FOB is a
spawn point: fallen infantry come back at whichever spawn is nearest their squad
(main base, a FOB, or beside an idle helicopter under Air Assault; the
reinforcements panel can force main base). Destroying a FOB radio costs its owner
20 tickets, so the CPU raids yours and defends its own. With infantry selected,
right-click a friendly landed helicopter to board it, then order the helicopter
somewhere: it unloads on landing (**U** unloads a parked helicopter). The CPU
commander builds a FOB one hop behind its front and lifts squads toward distant
objectives.

**Game modes** (picked in the force builder, or `?mode=` with `?side=attack|defend`):
- *Advance & Secure*: capture the five locations in order; majority bleed; take all to win.
- *Invasion*: defenders start with every location and 300 tickets against the attackers'
  500; attackers must take them all before the 20-minute clock, each capture costs the
  defenders 15 tickets.
- *Destruction*: three weapon caches hidden near the defenders' locations, one active at a
  time and revealed when attackers come close or after 90 s; destroying all three before the
  20-minute clock wins, each costs the defenders 40 tickets.
- *Territory Control*: a hex grid over the map; capture only hexes touching your own; more
  hexes bleeds the enemy; 80% of the land wins outright.
- *Skirmish*: tickets only.

## Controls

| Input | Action |
|---|---|
| Left click / drag | Select unit or squad / box-select |
| Right click | Move order (selected squads and vehicles move in formation) |
| Right drag, `Q` / `E` | Rotate camera (yaw + pitch) |
| Wheel | Zoom (changes pixel scale, keeps the point under the cursor fixed) |
| `WASD` / arrows / screen edge / middle drag | Pan |
| `F` | Follow the selected unit |
| `Space` | Pause simulation |
| `R` / Reset view | Default camera |
| `M` | Mute / unmute |

### Touch (iPad)

Touch and pen pointers go to a gesture layer; a mouse or trackpad keeps the table above.

| Gesture | Action |
|---|---|
| Tap a unit | Select it (its whole squad); tap an enemy with a selection to attack-move |
| Double-tap a unit | Select every friendly unit of that type on screen |
| Hold on the ground | Order the selection there (the ring fills in 0.45 s); hold a landed helicopter to board it |
| Hold with nothing selected, then drag | Box select |
| One-finger drag | Pan, with a fling on release |
| Pinch | Zoom about the midpoint |
| Twist | Rotate about the midpoint |
| Three-finger drag up/down | Tilt |
| Toolbar | **Box** arms a one-shot box select, **Follow**, **Pause**, **Base** jumps to your main, **⚙** shows the engine panels |

Tablets and phones (a coarse primary pointer with multi-touch) get the mobile
profile: device pixel ratio 1, a 2048 shadow map, no edge panning, keyboard hints
and engine panels hidden, larger tap targets, and the force builder as a scrolling
sheet. `?mobile=1` or `?mobile=0` forces the profile either way. The page ships a
web app manifest and icons, so "Add to Home Screen" installs it full-screen in
landscape; there is no service worker, so it still needs the server.

## Sound, difficulty and debrief

Sound is synthesized in WebAudio with no assets: filtered-noise shots per weapon,
explosions, impacts, looping rotor and engine voices for the nearest six
vehicles, and cues for selection, orders, captures, FOBs and the match result.
Everything positional is attenuated and panned around the camera target. The
context starts on the first click or touch; the Render panel has a mute box and
volume slider, the touch toolbar a note button, and `M` mutes. The one-shots and
cues ship as ElevenLabs clips in `sounds/` (listed in `sounds/manifest.json`), which
the engine prefers over its own synthesis; delete the manifest to hear the
synthesized set. To regenerate them, put an ElevenLabs key in `.env` as
`ELEVEN_LABS_API=...` (ignored by git) and run `node tools/make-sounds.mjs`, or name
the clips to redo: `node tools/make-sounds.mjs explosion rifle`.

The force builder picks the CPU difficulty. Easy CPU shoots and hits softer,
respawns slower and never builds FOBs; Hard shoots and hits harder, respawns
faster, gets an extra FOB kit, re-plans every few seconds and commits more of
its force to the attack. `?difficulty=easy|normal|hard` overrides it.

The match ends on a debrief: a ticket graph for both teams over the match and a
table of kills, losses by class, captures, locations lost, FOBs and caches, with
"Play again" and "Change loadout". The kill feed shows the killer's weapon and
the victim's class, and reports captures, FOBs and cache events; vehicle kills are
highlighted. Destroyed vehicles burn for 45 seconds with flames, embers and soot
before smouldering out; explosions throw debris on ballistic arcs and a dust ring.

URL parameters set the initial state so the two back ends can be compared on
identical frames: `?r=gl&seed=7&x=52&z=50&zoom=6&yaw=0.6&pitch=0.95&hour=21&pixel=0&tpu=12`

`?stage=soldier|truck|apc|heli` spawns just that unit at the camera target, sends it
forward and follows it, for close-up inspection of models and animation:
`?r=gl&stage=soldier&zoom=10&yaw=1.2&pitch=0.8&hour=10`

`?warp=12` pre-steps the simulation 12 seconds before the first frame, so a
screenshot can catch a helicopter already airborne or a squad mid-run.


## Layout

```
index.html          page, HUD markup, picks the back end from ?r=
src/core/           renderer-agnostic engine
  math.js           Vec3, column-major Mat4, colour-space helpers, seedable rng
  layout.js         world size, props as data (hangar, containers, palms, bushes, grass tufts), obstacles, sun/moon lighting, WorldState
  terrain.js        heightfield from ridge/hill features with noise-jagged crests and notch passes, a carved river with fords, level pads; height, normal, slope, water and line-of-sight queries
  models.js         unit models (soldier, truck, APC, helicopter) built through a per-back-end factory
  geometry.js       box, cylinder, wedge, frustum, frond, ring, plane and grass-tuft generators with world-unit UVs
  textures.js       procedural tarmac (slabs, taxi lines, asphalt road, grass strip), camo and grass-tuft canvases
  camera.js         orthographic RTS camera (orbit, zoom-as-pixel-scale, texel snapping, follow)
  units.js          steering, obstacle sliding, separation, squads, helicopter state machine
  dust.js           dust particle simulation
  input.js, hud.js  RTS input / selection and the HUD; picking delegated to the back end
  app.js            URL params, match or sandbox population, frame loop (with ?warp pre-stepping)
src/game/           milestone 1 game layer (renderer-agnostic)
  rules.js          tickets, costs, respawn timers, fixed M1 force
  weapons.js        weapon tables
  teams.js          team state and base spawn points
  nav.js            1-unit A* grid with foot / vehicle layers and string pulling
  spatial.js        hash grid for targeting and separation
  combat.js         targeting, line of sight, firing, damage, death callbacks
  respawn.js        ticket charges and respawns at main base
  ai/strategist.js  CPU commander: objectives, logistics (FOBs), air lifts, FOB raids
  objectives.js     capture zones, lattice order, ownership events
  modes/            game modes behind one interface: aas, invasion, destruction, territory, skirmish (objectives, tickets, win checks, HUD bar, minimap, CPU goals)
  loadout.js        force builder data: items, doctrines, presets, validation, CPU counter-pick, saved loadouts
  support.js        medic revives, engineer repairs, supply truck refills
  fob.js            forward operating bases: build rules, construction, spawn points
  ui/lobby.js       the pre-match force builder screen
  maps/             map definitions (desert1km.js) and ground texture generators
  match.js          AAS / Skirmish match flow, 10 Hz game tick, bleed, win checks
src/three/          three.js back end: models, world, PixelRenderer (low-res target + outline), dust, markers
src/gl/             WebGL2 back end
  scene.js          Node / Mesh scene graph with the same position/rotation/visible surface
  shaders.js        GLSL ES 3.00: lit instanced, shadow depth, pick id, composite, dust
  renderer.js       dynamic + chunked static instance batches, chunk culling, view-fitted shadow pass, splat ground, composite, pick buffer
  strips.js         road / line strip and decal geometry
  models.js, world.js, markers.js, main.js
```

## How the WebGL2 renderer works

- Every mesh is an instance of a shared geometry. Each frame the scene graph is
  walked once, world matrices are computed, and instance records (matrix, colour,
  emissive, pick id) are appended to a batch keyed by geometry + texture + flags.
  One `drawElementsInstanced` per batch: ~60 units cost about 125 draw calls
  including the shadow pass, versus roughly 1000 for the three.js back end.
- Shadow pass renders depth from an orthographic light camera into a 4096²
  depth texture (2048² on tablets). The light frustum is sized from the camera's
  footprint in quarter-octave steps and its eye is snapped to shadow texels, so the
  shadow grid stays still in the world while panning. The lit pass does a 2×2
  bilinear depth comparison thresholded at 0.5 with a normal-offset bias: edges stay
  hard but follow the sub-texel iso-line instead of the shadow texel staircase.
- Lighting is Lambert with three.js' physical units (irradiance / π, sRGB
  textures via `SRGB8_ALPHA8`, linear-to-sRGB in the composite), so both back
  ends produce the same image from the same `lighting(time)` values.
- Picking renders instance ids into a small colour buffer on click and reads
  one pixel; no CPU raycasting.

## Tuning knobs (right panel)

Pixelate on/off (compare with native resolution at identical framing), outline,
shadows, texels per unit (4–24), time speed, hour of day, autonomous orders,
spawn buttons.

## Headless checks

`tools/pick-test.mjs` launches headless Chrome (software GL), loads a URL, and
asserts that `app.pick()` returns the unit under each visible unit, then
box-selects and orders everything on screen. Run it against either back end:

```bash
node tools/pick-test.mjs 'http://localhost:8787/?r=gl&seed=11&zoom=2' 9351
node tools/pick-test.mjs 'http://localhost:8787/?seed=11&zoom=2' 9352
```

`tools/match-test.mjs` runs a CPU-vs-CPU match for a while and reports tickets,
objectives, FOBs, lifts and the kill feed. `tools/touch-test.mjs` drives the touch
layer with synthetic touches on an iPad-sized viewport (tap, hold, drag, pinch,
twist, tilt, box select, double-tap) and checks the mobile profile and manifest:

```bash
node tools/match-test.mjs 'http://localhost:8787/?cpu=both&seed=11&warp=240&mode=invasion' 9333
node tools/touch-test.mjs 'http://localhost:8787/?mobile=1&cpu=none&loadout=balanced&seed=5' 9341 /tmp/touch-profile shot.png
```

For a still frame, headless Chrome's `--screenshot` with `--virtual-time-budget`
works too; the `seed` parameter makes both back ends build the same scene.
