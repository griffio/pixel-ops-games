// Renders the lobby's map cards (icons/maps/<key>.png) from the game's own minimap: the ground, hill shading and water, with
// the places as white dots and the two bases in their sides' colours, 220 px square, north up. Needs the game served on
// :8787 (npm start).
// usage: node tools/make-map-thumbs.mjs [key ...]   (no keys: every map)
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAPS } from '../src/game/maps/index.js';
const only = process.argv.slice(2), port = '9352', OUT = 'icons/maps';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'pixel-ops-thumbs-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--window-size=800,600', 'about:blank'], { stdio: 'ignore' });
try {
  let t = []; for (let i = 0; i < 100 && !t.length; i++) { try { t = (await fetch(`http://localhost:${port}/json`).then(r => r.json())).filter(x => x.type === 'page'); } catch {} if (!t.length) await sleep(200); }
  const ws = new WebSocket(t[0].webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Page.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.requestAnimationFrame = () => 0;' });
  mkdirSync(OUT, { recursive: true });
  for (const key of Object.keys(MAPS).filter(k => !only.length || only.includes(k))) {
    await send('Page.navigate', { url: `http://localhost:8787/?map=${key}&cpu=both&seed=1` });
    for (let i = 0; i < 200; i++) { if (await ev('!!(window.app && window.app.match && window.app.world.map)')) break; await sleep(400); }
    const png = await ev(`(() => { const a = window.app, map = a.world.map, c = a.hud.minimapBackground(map), g = c.getContext('2d'), S = c.width, k = S / map.size, X = (x) => (map.size / 2 - x) * k, Z = (z) => (map.size / 2 - z) * k;
      for (const l of map.locations) { g.fillStyle = '#f4f1e8'; g.strokeStyle = '#1b1d1f'; g.lineWidth = 1.5; g.beginPath(); g.arc(X(l.x), Z(l.z), 4, 0, Math.PI * 2); g.fill(); g.stroke(); }
      map.bases.forEach((b, i) => { g.strokeStyle = (b.team ?? i) === 0 ? '#7fb2e5' : '#e86a5a'; g.lineWidth = 2.5; g.beginPath(); g.arc(X(b.x), Z(b.z), Math.max(6, b.r * k), 0, Math.PI * 2); g.stroke(); });
      return c.toDataURL('image/png').split(',')[1]; })()`);
    writeFileSync(join(OUT, `${key}.png`), Buffer.from(png, 'base64')); console.log('saved', key);
  }
} finally { chrome.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
