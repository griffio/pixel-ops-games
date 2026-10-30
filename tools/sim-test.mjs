// Steps a match headless and evaluates a test against it: loads the URL in headless Chrome over the DevTools protocol with
// the animation loop frozen, waits for the match, then runs the test file's body as an async function (a, m, step) where
// a is window.app, m is the match and step(n) advances the simulation n ticks of 50 ms. The body's return value is printed
// as JSON with any page errors. Works against a local server or the live site.
// usage: node tools/sim-test.mjs <url> <test.js> [port]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [,, url, testFile, port = '9480'] = process.argv;
if (!url || !testFile) { console.log('usage: node tools/sim-test.mjs <url> <test.js> [port]'); process.exit(1); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'pixel-ops-sim-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
try {
  let t = []; for (let i = 0; i < 100 && !t.length; i++) { try { t = (await fetch(`http://localhost:${port}/json`).then(r => r.json())).filter(x => x.type === 'page'); } catch {} if (!t.length) await sleep(200); }
  const ws = new WebSocket(t[0].webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.requestAnimationFrame = () => 0; window.__errs = []; addEventListener("error", e => window.__errs.push(String(e.message))); try { localStorage.setItem("pixelops.guide", JSON.stringify({ briefed: true, seen: [] })); } catch {}' });
  await send('Page.navigate', { url });
  let ready = false; for (let i = 0; i < 300 && !ready; i++) { const r = await send('Runtime.evaluate', { expression: '!!(window.app && window.app.match && window.app.match.units)', returnByValue: true }); ready = r.result?.result?.value; if (!ready) await sleep(200); }
  if (!ready) { console.log('no match after 60 s'); process.exitCode = 1; }
  else {
    const body = readFileSync(testFile, 'utf8');
    const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => { const a = window.app, m = a.match;
      a.audio = null; if (m.combat) { m.combat.audio = null; m.combat.onShot = null; } m.voices = null;   // onShot calls the voices, nulled here
      const step = (n) => { for (let i = 0; i < n; i++) { a.world.update(0.05); a.units.update(0.05); m.update(0.05); a.dust.update(0.05); a.world.ambient && a.world.ambient(0.05); a.markers.update(0.05); } };
      const result = await (async (a, m, step) => { ${body} })(a, m, step);
      return JSON.stringify({ result, errs: window.__errs }); })()` });
    const v = r.result?.result?.value;
    if (typeof v !== 'string') { console.log(JSON.stringify(r).slice(0, 1500)); process.exitCode = 1; } else console.log(v);
  }
} finally { chrome.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
