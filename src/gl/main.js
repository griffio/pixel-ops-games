import { GLRenderer } from './renderer.js';
import { Scene } from './scene.js';
import { World } from './world.js';
import { builders, registerTextures, F } from './models.js';
import { Markers } from './markers.js';
import { RtsCamera } from '../core/camera.js';
import { UnitManager } from '../core/units.js';
import { DustSim } from '../core/dust.js';
import { Input } from '../core/input.js';
import { Hud } from '../core/hud.js';
import { applyUrlParams, populate, runLoop } from '../core/app.js';
import { desert1km } from '../game/maps/desert1km.js';

const q = new URLSearchParams(location.search);
const sandbox = q.get('sandbox') === '1';
const canvas = document.getElementById('view');
const renderer = new GLRenderer(canvas);
const pixel = renderer.pixel;
registerTextures(renderer);

const scene = new Scene();
const world = new World(scene, renderer, sandbox ? null : desert1km);   // the 1 km map, or the legacy airfield in sandbox mode
const rts = new RtsCamera(pixel, world.half - 10);
const units = new UnitManager(scene, world, builders, F.recolor);
const dust = new DustSim(); units.dust = dust;
const markers = new Markers(scene, world.heightAt);
world.focus = rts.target; rts.heightAt = world.heightAt;

const app = {
  canvas, pixel, rts, world, units, dust, markers,
  rendererName: 'WebGL2', otherRenderer: { name: 'three.js sandbox', param: 'three' },
  drawCalls: () => renderer.stats.calls,
  setShadows: (on) => { renderer.shadows = on; },
  pick(nx, ny) { const id = renderer.pick(nx, ny); return id ? units.byPickId(id) : null; },
  resize(W, H) { renderer.setSize(W, H); },
  render(dt, W, H) { renderer.render(scene, rts, world.lightState, dust, W, H); },
};
applyUrlParams(app);
app.hud = new Hud(app);
app.input = new Input(app);
populate(app);
runLoop(app);
window.app = app;
