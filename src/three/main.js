import * as THREE from 'three';
import { PixelRenderer } from './pixelRenderer.js';
import { World } from './world.js';
import { builders } from './models.js';
import { DustView } from './dustView.js';
import { Markers } from './markers.js';
import { RtsCamera } from '../core/camera.js';
import { HALF } from '../core/layout.js';
import { UnitManager } from '../core/units.js';
import { DustSim } from '../core/dust.js';
import { Input } from '../core/input.js';
import { Hud } from '../core/hud.js';
import { applyUrlParams, populate, runLoop } from '../core/app.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;   // hard, pixel-crisp shadows
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
const pixel = new PixelRenderer(renderer);
const rts = new RtsCamera(pixel, HALF - 10);
const world = new World(scene);
const units = new UnitManager(scene, world, builders);
const dust = new DustSim(); units.dust = dust;
const dustView = new DustView(scene, dust, pixel);
const markers = new Markers(scene);

// three.js camera driven by the shared pure-math camera
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, rts.near, rts.far);
cam.matrixAutoUpdate = false; cam.matrixWorldAutoUpdate = false;
function syncCamera() {
  cam.projectionMatrix.fromArray(rts.proj); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.matrixWorld.fromArray(rts.world); cam.matrix.copy(cam.matrixWorld); cam.matrixWorldInverse.fromArray(rts.view);
}

const ray = new THREE.Raycaster();
const app = {
  canvas, pixel, rts, world, units, dust, markers,
  rendererName: 'three.js', otherRenderer: { name: 'WebGL2', param: 'gl' },
  drawCalls: () => renderer.info.render.calls,
  setShadows: (on) => { renderer.shadowMap.enabled = on; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); },
  pick(nx, ny) {
    syncCamera();
    ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), cam);
    const groups = units.units.map(u => u.group);
    for (const h of ray.intersectObjects(groups, true)) {
      let o = h.object; while (o && !groups.includes(o)) o = o.parent;
      if (o) return units.units.find(u => u.group === o);
    }
    return null;
  },
  resize(W, H) {
    pixel.dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(Math.round(W * pixel.dpr), Math.round(H * pixel.dpr), false);
  },
  render(dt, W, H) {
    syncCamera();
    pixel.setDepthThreshold(cam, 0.45);
    dustView.update();
    renderer.info.reset();
    pixel.render(scene, cam, W, H);
  },
};
applyUrlParams(app);
app.hud = new Hud(app);
app.input = new Input(app);
populate(units);
runLoop(app);
window.app = app;
