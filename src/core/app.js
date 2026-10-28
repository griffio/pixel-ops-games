import { seedRng } from './math.js';
import { Match } from '../game/match.js';
import { Lobby } from '../game/ui/lobby.js';
import { MAPS } from '../game/maps/index.js';
import { preset, counterPick } from '../game/loadout.js';
import { AudioEngine } from './audio.js';

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
  if (q.has('tpu')) { pixel.texelsPerUnit = +q.get('tpu'); rts.baseTpu = +q.get('tpu'); }
  if (q.has('seed')) seedRng(+q.get('seed'));
}

// Touch profile: iPad and phones (coarse primary pointer with multi-touch). ?mobile=1|0 forces it either way.
export function detectTouch() {
  const q = new URLSearchParams(location.search);
  if (q.has('mobile')) return q.get('mobile') !== '0';
  return navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches;
}

export function populate(app) {
  const { units, rts } = app;
  const q = new URLSearchParams(location.search);
  // ?stage=soldier|truck|apc|tank|heli puts one unit at the camera target and sends it forward, for close-ups
  const stage = q.get('stage');
  if (stage) {
    const t = rts.target, team = +(q.get('team') || 0);
    if (stage === 'soldier') { const sq = units.spawnSquad(t.x, t.z, team); sq.order(t.x, t.z + 60); rts.follow = sq.leader; }
    else if (units.builders[stage]) { const u = units.spawn(stage, t.x, t.z, 0, team); u.order(t.x, t.z + 60); rts.follow = u; }
    units.auto = false; document.getElementById('c-auto').checked = false;
    if (q.has('kill')) { const u = units.units[0]; u.mgr = units; u.damage(9999); }   // debug: inspect death / wreck effects
    return;
  }
  // ?sandbox=1 keeps the free-roam airfield; otherwise a match: the force builder opens unless the
  // CPU plays both sides or ?loadout=<preset> skips it (cpu=both|none|1, mode=aas|skirmish)
  if (q.get('sandbox') !== '1' && !app.sandboxOnly) {
    document.body.classList.add('game');   // a map, not the engine sandbox: the engine panels wait for F3
    const cpu = q.get('cpu') === 'both' ? [0, 1] : q.get('cpu') === 'none' ? [] : [1];
    app.fogOff = q.get('fog') === '0';   // ?fog=0: no fog of war for anyone, the CPU included
    app.commanderUrl = q.get('commander') === '1' ? '/commander' : (q.get('commander') || null);   // remote commander endpoint for the CPU sides
    app.commanderModel = q.get('model') || null;
    app.aiModes = (q.get('ai') || '').split(','); app.personas = (q.get('persona') || '').split(',');   // ?ai=rules for the older planner (default utility; per team: utility,rules), ?persona=balanced|aggressive|patient   // ?model=<key> picks a model from the Worker's allow-list (llama, gpt-oss-120b, qwen3-30b, mistral-small)
    app.startMatch = (playerLoadout, modeOpts = {}) => {
      const cpuKey = q.get('cpuloadout') || counterPick(playerLoadout);
      const fixed = app.world.map && app.world.map.mode;   // a map made for one mode (Peninsula: Invasion, attacked from its first base)
      const mode = fixed || q.get('mode') || modeOpts.mode || 'aas', difficulty = q.get('difficulty') || modeOpts.difficulty || 'normal';
      if (!q.has('commander') && modeOpts.commander !== undefined) { app.commanderUrl = modeOpts.commander ? '/commander' : null; app.commanderModel = modeOpts.commander || null; }   // the lobby's Opponent (a link's ?commander= wins)
      let side = q.get('side') || modeOpts.side || 'attack', swap = q.get('swap') === '1';
      if (fixed) { if (side === 'defend') swap = !swap; side = swap ? 'defend' : 'attack'; }   // its first base always attacks: defending, or ?swap=1, plays from the other base
      // ?swap=1 plays the sides the other way round (BLUFOR from the NE base, lattice reversed): a balance check for CPU-vs-CPU runs
      if (swap && app.world.map && !app.world.map.swapped) { const mp = app.world.map; mp.bases = [...mp.bases].reverse(); mp.locations = [...mp.locations].reverse().map(l => l.home === undefined ? l : { ...l, home: [].concat(l.home).map(h => 1 - h) }); mp.swapped = true; }   // a place touching a base now touches the other team's
      app.match = new Match(app, { cpu, mode, side, difficulty, loadouts: [playerLoadout, preset(cpuKey)] });
      if (app.audio) app.audio.ui('start');
      // the sun stands still during a match (a moving sun crawls every shadow edge at close zoom); ?hour= picks the time
      app.world.timeSpeed = 0; if (!q.has('hour')) { app.world.time = 9.5; app.world.update(0); }
      document.getElementById('c-tspeed').value = 0; document.getElementById('v-tspeed').textContent = '0×';
      document.getElementById('c-auto').checked = false;
      if (!q.has('x')) rts.target.set(app.match.teams[0].base.x + 10, 0, app.match.teams[0].base.z + 10);
      app.hud.toast(`${app.match.teams[0].loadoutName} vs ${app.match.teams[1].loadoutName}`);
    };
    if (cpu.includes(0) || q.has('loadout')) app.startMatch(preset(q.get('loadout') || 'balanced'));
    else { const b = app.world.map && app.world.map.bases ? app.world.map.bases[0] : { x: -400, z: -400 }; app.lobby = new Lobby(app.startMatch, app.world.map && app.world.map.name, app.world.map && app.world.map.mode, { maps: Object.entries(MAPS).map(([key, m]) => ({ key, name: m.name, size: m.size, blurb: m.blurb, mode: m.mode })), current: Object.keys(MAPS).find(k => MAPS[k] === app.world.map), commanderLocked: q.has('commander') }); rts.target.set(b.x + 10, 0, b.z + 10); }   // the camera behind the force builder looks at our base
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
  // ?warp=N pre-steps the simulation N seconds so screenshots can start mid-action (silently)
  const warp = +(new URLSearchParams(location.search).get('warp') || 0);
  for (let t = 0; t < warp; t += 0.05) { app.world.update(0.05); app.units.update(0.05); if (app.match) app.match.update(0.05); app.dust.update(0.05); app.markers.update(0.05); }
  app.audio = new AudioEngine(app); if (app.match) app.match.attachAudio(app.audio);

  let W = 0, H = 0;
  const resize = () => { W = window.innerWidth; H = window.innerHeight; app.resize(W, H); };
  window.addEventListener('resize', resize); resize();
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (window.innerWidth !== W || window.innerHeight !== H) resize();   // catches missed resize events (emulation, zoom)
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;   // the first rAF stamp can precede performance.now(); never step backwards
    const simDt = app.hud.paused ? 0 : dt;
    app.world.update(simDt);
    app.units.update(simDt);
    if (app.match) app.match.update(simDt);
    app.dust.update(simDt);
    app.markers.update(simDt);
    if (app.audio) app.audio.update(dt);
    if (app.input) app.input.update(dt);
    app.rts.update(dt, W, H);
    app.render(dt, W, H);
    app.hud.update(dt, W, H);
  };
  requestAnimationFrame(frame);
}
