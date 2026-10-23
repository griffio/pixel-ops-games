import { seedRng } from './math.js';
import { Match } from '../game/match.js';

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

export function populate(app) {
  const { units, rts } = app;
  const q = new URLSearchParams(location.search);
  // ?stage=soldier|truck|apc|heli puts one unit at the camera target and sends it forward, for close-ups
  const stage = q.get('stage');
  if (stage) {
    const t = rts.target, team = +(q.get('team') || 0);
    if (stage === 'soldier') { const sq = units.spawnSquad(t.x, t.z, team); sq.order(t.x, t.z + 60); rts.follow = sq.leader; }
    else if (units.builders[stage]) { const u = units.spawn(stage, t.x, t.z, 0, team); u.order(t.x, t.z + 60); rts.follow = u; }
    units.auto = false; document.getElementById('c-auto').checked = false;
    if (q.has('kill')) { const u = units.units[0]; u.mgr = units; u.damage(9999); }   // debug: inspect death / wreck effects
    return;
  }
  // ?sandbox=1 keeps the free-roam airfield; otherwise a Skirmish match starts (cpu=both|none|1)
  if (q.get('sandbox') !== '1') {
    const cpu = q.get('cpu') === 'both' ? [0, 1] : q.get('cpu') === 'none' ? [] : [1];
    app.match = new Match(app, { cpu });
    document.getElementById('c-auto').checked = false;
    if (!q.has('x')) rts.target.set(app.match.teams[0].base.x + 10, 0, app.match.teams[0].base.z + 10);
    return;
  }

  for (let i = 0; i < 10; i++) units.spawnSquad();
  for (let i = 0; i < 6; i++) units.spawn('truck');
  for (let i = 0; i < 4; i++) units.spawn('apc');
  units.spawn('heli', 45, 45, Math.PI); units.spawn('heli', 62, 45, Math.PI * 1.2); units.spawn('heli', 45, 62, Math.PI * 0.8);
  units.spawn('heli'); units.spawn('heli');
  for (let i = 0; i < 6; i++) units.spawn('truck', -70 + i * 9 + 3.5, -64, 0); // parked in bays
}

export function runLoop(app) {
  // ?warp=N pre-steps the simulation N seconds so screenshots can start mid-action
  const warp = +(new URLSearchParams(location.search).get('warp') || 0);
  for (let t = 0; t < warp; t += 0.05) { app.world.update(0.05); app.units.update(0.05); if (app.match) app.match.update(0.05); app.dust.update(0.05); app.markers.update(0.05); }

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
    if (app.match) app.match.update(simDt);
    app.dust.update(simDt);
    app.markers.update(simDt);
    app.rts.update(dt, W, H);
    app.render(dt, W, H);
    app.hud.update(dt, W, H);
  };
  requestAnimationFrame(frame);
}
