import { GLRenderer } from './renderer.js';
import { Scene } from './scene.js';
import { World } from './world.js';
import { builders, registerTextures } from './models.js';
import { Markers } from './markers.js';
import { RtsCamera } from '../core/camera.js';
import { HALF } from '../core/layout.js';
import { UnitManager } from '../core/units.js';
import { DustSim } from '../core/dust.js';
import { Input } from '../core/input.js';
import { Hud } from '../core/hud.js';
import { applyUrlParams, populate, runLoop } from '../core/app.js';

const canvas = document.getElementById('view');
const renderer = new GLRenderer(canvas);
const pixel = renderer.pixel;
registerTextures(renderer);

const scene = new Scene();
const rts = new RtsCamera(pixel, HALF - 10);
const world = new World(scene, renderer);
const units = new UnitManager(scene, world, builders);
const dust = new DustSim(); units.dust = dust;
const markers = new Markers(scene);

const app = {
  canvas, pixel, rts, world, units, dust, markers,
  rendererName: 'WebGL2', otherRenderer: { name: 'three.js', param: '' },
  drawCalls: () => renderer.stats.calls,
  setShadows: (on) => { renderer.shadows = on; },
  pick(nx, ny) { const id = renderer.pick(nx, ny); return id ? units.byPickId(id) : null; },
  resize(W, H) { renderer.setSize(W, H); },
  render(dt, W, H) { renderer.render(scene, rts, world.lightState, dust, W, H); },
};
applyUrlParams(app);
app.hud = new Hud(app);
app.input = new Input(app);
populate(units);
runLoop(app);
window.app = app;
