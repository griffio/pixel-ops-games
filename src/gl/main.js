import { GLRenderer } from './renderer.js';
import { Scene } from './scene.js';
import { World } from './world.js';
import { builders, registerTextures, F } from './models.js';
import { loadVoxModels, loadVoxProps } from './voxmodels.js';
import { Markers } from './markers.js';
import { Rings } from './rings.js';
import { FogView } from './fog.js';
import { Guide } from '../core/guide.js';
import { RtsCamera } from '../core/camera.js';
import { UnitManager } from '../core/units.js';
import { DustSim } from '../core/dust.js';
import { Input } from '../core/input.js';
import { Hud } from '../core/hud.js';
import { applyUrlParams, populate, runLoop, detectTouch } from '../core/app.js';
import { mapFor } from '../game/maps/index.js';

const q = new URLSearchParams(location.search);
const sandbox = q.get('sandbox') === '1';
const canvas = document.getElementById('view');
const touch = detectTouch();
const renderer = new GLRenderer(canvas, touch ? { shadowSize: 2048, dprCap: 1 } : {});   // tablets: smaller shadow map, no retina composite
const pixel = renderer.pixel;
registerTextures(renderer);
if (q.get('vox') !== '0') { Object.assign(builders, await loadVoxModels(renderer, ['tank', 'apc', 'humvee', 'truck', 'supplyTruck', 'craft', 'heli', 'bird', 'soldier', 'amphib', 'amphibSupply'])); await loadVoxProps(renderer, ['lighthouse', 'radar', 'shed', 'boat', 'ship']); }   // unit models from models/vox/*.vox replace the code-built ones of the same type, and the landmarks stand as vox props; ?vox=0 keeps the code ones

const scene = new Scene();
const savedMap = (() => { try { return localStorage.getItem('pixelops.map'); } catch { return null; } })();   // the map last picked in the lobby
const world = new World(scene, renderer, sandbox ? null : mapFor(q.get('map') || savedMap));   // ?map=<key> (game/maps/index.js), or the legacy airfield in sandbox mode
const rts = new RtsCamera(pixel, world.half - 10);
const units = new UnitManager(scene, world, builders, F.recolor);
const dust = new DustSim(); units.dust = dust; world.dust = dust;   // the world reads muzzle-flash lights from the particle pool
const markers = new Markers(scene, world.heightAt), rings = new Rings(scene, renderer, world.heightAt);   // capture rings round the locations (gl/rings.js)
world.focus = rts.target; rts.heightAt = world.heightAt;

if (touch) { document.body.classList.add('touch'); rts.edgePan = false; }
const app = {
  canvas, pixel, rts, world, units, dust, markers, rings, touch, renderer,
  rendererName: 'WebGL2', otherRenderer: { name: 'three.js sandbox', param: 'three' },
  drawCalls: () => renderer.stats.calls,
  setShadows: (on) => { renderer.shadows = on; },
  pick(nx, ny, radiusPx = 0) { const id = renderer.pick(nx, ny, radiusPx); return id ? units.byPickId(id) : null; },
  resize(W, H) { renderer.setSize(W, H); },
  render(dt, W, H) { app.fog.update(dt); renderer.render(scene, rts, world.lightState, dust, W, H); },
};
applyUrlParams(app);
app.fog = new FogView(app);   // before the HUD, which wires the Fog shading setting to it
app.guide = new Guide(app);   // the field manual and hints, before the HUD too
app.hud = new Hud(app);
app.input = new Input(app);
populate(app);
runLoop(app);
window.app = app;
