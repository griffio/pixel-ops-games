# Pixel Ops — 3D pixel-art engine sandbox

A browser sandbox for testing a "3D rendered as pixel art" RTS look, with two
interchangeable renderers behind one simulation:

- **three.js** back end (`?r=three`, the default)
- **raw WebGL2** back end with instanced batching (`?r=gl`), no dependencies

Low-poly units are rendered into a small buffer whose texel size is fixed in
**world** units, then upscaled with nearest filtering, so zooming in makes the
pixels chunkier while the camera rotates freely. No build step.

## Run

```bash
npm start            # python3 -m http.server 8787
open http://localhost:8787            # three.js
open http://localhost:8787/?r=gl      # WebGL2
```

By default a 25-minute **Skirmish** match starts: you command BLUFOR (tan) against
a CPU OPFOR (olive) commander. Each side starts with 400 tickets; vehicle losses
and infantry respawns drain them, and the first team at 0 loses. Left-drag to
select your squads, right-click to move them, click an enemy to attack-move.
`?cpu=both` lets the CPU play both sides, `?cpu=none` disables it, and
`?sandbox=1` restores the free-roam airfield with no combat.

Any static server works (ES modules can't load over `file://`). three.js comes
from jsDelivr via an import map; the WebGL2 back end loads nothing external.
The stats panel has a link that switches renderer while keeping the view.

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
  ai/strategist.js  CPU commander v0
  match.js          Skirmish match flow, 10 Hz game tick, win check
src/three/          three.js back end: models, world, PixelRenderer (low-res target + outline), dust, markers
src/gl/             WebGL2 back end
  scene.js          Node / Mesh scene graph with the same position/rotation/visible surface
  shaders.js        GLSL ES 3.00: lit instanced, shadow depth, pick id, composite, dust
  renderer.js       instanced batches, shadow pass, low-res pass, composite, pick buffer
  models.js, world.js, markers.js, main.js
```

## How the WebGL2 renderer works

- Every mesh is an instance of a shared geometry. Each frame the scene graph is
  walked once, world matrices are computed, and instance records (matrix, colour,
  emissive, pick id) are appended to a batch keyed by geometry + texture + flags.
  One `drawElementsInstanced` per batch: ~60 units cost about 125 draw calls
  including the shadow pass, versus roughly 1000 for the three.js back end.
- Shadow pass renders depth from an orthographic light camera into a 4096²
  depth texture; the lit pass does a hard compare with a normal-offset bias,
  which gives the crisp pixel shadows.
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

For a still frame, headless Chrome's `--screenshot` with `--virtual-time-budget`
works too; the `seed` parameter makes both back ends build the same scene.
