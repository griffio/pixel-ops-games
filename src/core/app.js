import { seedRng } from './math.js';

// Shared bootstrap: URL view parameters, the initial population and the frame loop.
// A back end supplies: canvas, pixel, rts, world, units, dust, markers, hud,
// resize(W, H) and render(dt).
export function applyUrlParams({ rts, pixel, world }) {
  const q = new URLSearchParams(location.search);
  if (q.has('x')) rts.target.x = +q.get('x');
  if (q.has('z')) rts.target.z = +q.get('z');
  if (q.has('zoom')) { rts.zoomT = +q.get('zoom'); pixel.pixelScale = rts.zoomT; }
  if (q.has('yaw')) rts.yaw = rts.yawT = +q.get('yaw');
  if (q.has('pitch')) rts.pitch = rts.pitchT = +q.get('pitch');
  if (q.has('hour')) { world.time = +q.get('hour'); world.update(0); }
  if (q.has('pixel')) pixel.enabled = q.get('pixel') !== '0';
  if (q.has('tpu')) pixel.texelsPerUnit = +q.get('tpu');
  if (q.has('seed')) seedRng(+q.get('seed'));
}

export function populate(units) {
  for (let i = 0; i < 10; i++) units.spawnSquad();
  for (let i = 0; i < 6; i++) units.spawn('truck');
  for (let i = 0; i < 4; i++) units.spawn('apc');
  units.spawn('heli', 45, 45, Math.PI); units.spawn('heli', 62, 45, Math.PI * 1.2); units.spawn('heli', 45, 62, Math.PI * 0.8);
  units.spawn('heli'); units.spawn('heli');
  for (let i = 0; i < 6; i++) units.spawn('truck', -70 + i * 9 + 3.5, -64, 0); // parked in bays
}

export function runLoop(app) {
  let W = 0, H = 0;
  const resize = () => { W = window.innerWidth; H = window.innerHeight; app.resize(W, H); };
  window.addEventListener('resize', resize); resize();
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (window.innerWidth !== W || window.innerHeight !== H) resize();   // catches missed resize events (emulation, zoom)
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const simDt = app.hud.paused ? 0 : dt;
    app.world.update(simDt);
    app.units.update(simDt);
    app.dust.update(simDt);
    app.markers.update(simDt);
    app.rts.update(dt, W, H);
    app.render(dt, W, H);
    app.hud.update(dt, W, H);
  };
  requestAnimationFrame(frame);
}
