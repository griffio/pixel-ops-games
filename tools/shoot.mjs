// README frames with a frozen animation loop: loads a match pre-stepped by ?warp=, steps the simulation tick by tick (50 ms)
// until a predicate on `app` returns a camera target, then places the camera, renders one frame and saves the canvas as PNG
// (several frames, a few ticks apart). Page.captureScreenshot comes back blank while rAF is frozen; the canvas itself does not.
// usage: node tools/shoot.mjs <jobs.json> [port]      frames land next to the jobs file as <name>-<offset>.png, 1280x720
// jobs: [{ name, url, pred, at?, every, maxTicks, zoom, pitch, yaw, frames: [tick offsets after the moment] }]
//   pred: a JS expression over `a` (window.app) and `m` (the match) returning { x, z, y? } for the moment to shoot, or null to keep stepping
//   at:   an optional expression evaluated at each frame for the camera target instead (a moving unit: { x: u.pos.x, y: u.alt, z: u.pos.z })
//   y is a height above the ground to centre on: the target moves y / tan(pitch) along the view, since the camera clamps it to the terrain
// example (the Little Bird's first rocket, the camera on the bird):
//   { "name": "bird", "url": "http://localhost:8787/?r=gl&cpu=both&loadout=balanced&cpuloadout=gunship&seed=5&fog=0&hour=13&warp=280&hud=0&x=0&z=0",
//     "pred": "(() => { const b = a.units.units.find(u => u.label === 'LB-01' && !u.dead); if (!b) return null; const r = a.dust.shots.list.find(p => p.kind === 'rocket' && p.t < 0.12 && Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < 12); return r ? { x: b.pos.x, y: b.alt, z: b.pos.z } : null; })()",
//     "at": "(() => { const b = a.units.units.find(u => u.label === 'LB-01' && !u.dead); return b ? { x: b.pos.x, y: b.alt, z: b.pos.z } : null; })()",
//     "every": 1, "maxTicks": 3600, "zoom": 2.8, "pitch": 0.58, "yaw": 2.4, "frames": [1, 2, 3] }
// a capture in progress: pred "(() => { const l = a.rings.items.map(i => i.loc).find(l => l.pushing >= 0 && l.owner !== l.pushing); return l ? { x: l.x, z: l.z } : null; })()"
import { spawn } from 'node:child_process'; import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join, dirname } from 'node:path';
const [,, jobsFile, port = '9590'] = process.argv; const jobs = JSON.parse(readFileSync(jobsFile, 'utf8')); const outDir = dirname(jobsFile);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'pixel-ops-shot-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio', '--window-size=1280,720', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const timer = setTimeout(() => { console.log('timed out'); chrome.kill('SIGKILL'); process.exit(2); }, 10 * 60 * 1000);
try {
  let t = []; for (let i = 0; i < 100 && !t.length; i++) { try { t = (await fetch(`http://localhost:${port}/json`).then(r => r.json())).filter(x => x.type === 'page'); } catch {} if (!t.length) await sleep(200); }
  if (!t.length) throw new Error('Chrome did not start');
  const ws = new WebSocket(t[0].webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true }); if (r.result?.exceptionDetails) console.log('page error:', JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.requestAnimationFrame = () => 0; window.__errs = []; addEventListener("error", e => window.__errs.push(String(e.message))); try { localStorage.setItem("pixelops.guide", JSON.stringify({ briefed: true, seen: [] })); localStorage.removeItem("pixelops.rings"); } catch {}' });
  for (const j of jobs) {
    console.log('==', j.name);
    await send('Page.navigate', { url: j.url });
    let ready = false; for (let i = 0; i < 300 && !ready; i++) { ready = await ev('!!(window.app && window.app.match && window.app.match.units && window.app.rings && window.app.match.elapsed > 0)'); if (!ready) await sleep(200); }
    if (!ready) { console.log('no match after 60 s'); continue; }
    await ev(`(() => { const a = window.app, m = a.match; a.audio = null; if (m.combat) m.combat.audio = null; m.voices = null;
      window.__step = (n) => { for (let i = 0; i < n; i++) { a.world.update(0.05); a.units.update(0.05); m.update(0.05); a.dust.update(0.05); a.world.ambient && a.world.ambient(0.05); a.markers.update(0.05); a.rings.update(m); } };
      window.__pred = () => { const a = window.app, m = a.match; return (${j.pred}); };
      window.__at = () => { const a = window.app, m = a.match; return (${j.at || 'null'}); };
      window.__cam = (c) => { const a = window.app, rts = a.rts, W = innerWidth, H = innerHeight; rts.fly = null; rts.follow = null; if (c.x !== undefined) { const sh = (c.y || 0) / Math.tan(${j.pitch}); rts.target.set(c.x - Math.sin(${j.yaw}) * sh, 0, c.z - Math.cos(${j.yaw}) * sh); } rts.zoom = rts.zoomT = ${j.zoom}; rts.pitch = rts.pitchT = ${j.pitch}; rts.yaw = rts.yawT = ${j.yaw};
        for (const el of document.body.children) if (el.id !== 'view') el.style.visibility = 'hidden'; a.resize(W, H); for (let i = 0; i < 3; i++) rts.update(0.05, W, H); a.render(0.05, W, H); return { W, H, t: Math.round(m.elapsed), png: document.getElementById('view').toDataURL('image/png') }; };
      return 1; })()`);
    let found = null, ticks = 0; const every = j.every || 1, max = j.maxTicks || 2400;
    for (; ticks < max && !found; ticks += every) { found = await ev('JSON.stringify(window.__pred() || null)'); found = found && JSON.parse(found); if (!found) await ev(`window.__step(${every})`); }
    console.log(found ? `found ${JSON.stringify(found)} after ${ticks} ticks` : `nothing found in ${max} ticks; shooting anyway`); if (!found) found = {};
    let at = 0;
    for (const off of (j.frames || [0])) {
      if (off > at) { await ev(`window.__step(${off - at})`); at = off; }
      const cam = j.at ? (JSON.parse(await ev('JSON.stringify(window.__at() || null)')) || found) : found;
      const info = JSON.parse(await ev(`JSON.stringify(window.__cam(${JSON.stringify(cam)}))`) || '{}');
      const out = join(outDir, `${j.name}-${off}.png`); writeFileSync(out, Buffer.from((info.png || '').split(',')[1] || '', 'base64')); console.log('saved', out, info.W, info.H, info.t, 'errs', await ev('JSON.stringify(window.__errs)'));
    }
  }
  ws.close();
} finally { clearTimeout(timer); chrome.kill('SIGKILL'); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
