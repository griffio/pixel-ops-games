// Drives headless Chrome over the DevTools protocol: loads the sandbox and checks
// that app.pick() returns the unit under each unit's own screen position.
import { spawn } from 'node:child_process';
// usage: node tools/pick-test.mjs 'http://localhost:8787/?r=gl&seed=11&zoom=2' [port] [profileDir]
const [,, url, port = '9333', profile = '/tmp/pixel-ops-cdp-profile'] = process.argv;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--hide-scrollbars', url], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = (await fetch(`http://localhost:${port}/json`).then(r => r.json())).filter(t => t.type === 'page' && t.url.startsWith('http')); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
// force a real viewport: headless Chrome sometimes keeps a tiny window despite --window-size
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const errors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception?.description || '')); });
// wait for the app to boot (three.js comes from a CDN)
for (let i = 0; i < 60; i++) { const r = await send('Runtime.evaluate', { expression: '!!window.app && window.app.units.units.length > 0', returnByValue: true }); if (r.result?.result?.value) break; await sleep(500); }
// headless Chrome grows its window after the page boots; wait for the real viewport
for (let i = 0; i < 40; i++) { const r = await send('Runtime.evaluate', { expression: 'innerWidth >= 1000 && innerHeight >= 600', returnByValue: true }); if (r.result?.result?.value) break; await sleep(500); }
await sleep(3000);
const expr = `(async () => {
  const a = window.app; if (!a) return JSON.stringify({ error: 'no app' });
  const W = innerWidth, H = innerHeight; let ok = 0, bad = 0, miss = 0, tested = 0; const bads = [];
  for (const u of a.units.units) {
    const [sx, sy] = a.rts.worldToScreen(u.pos.x, u.pos.y + (u.spec.air ? 2.2 : 1.2), u.pos.z, W, H);
    if (sx < 20 || sx > W - 20 || sy < 20 || sy > H - 20) continue;
    tested++;
    const hit = a.pick(sx / W, sy / H);
    if (hit === u || (hit && hit.squad && hit.squad === u.squad)) ok++; else if (hit) { bad++; bads.push(u.label + '->' + hit.label); } else { miss++; bads.push(u.label + '->none'); }
  }
  // box select everything on screen, then order a move and confirm targets were set
  a.input.boxSelect(0, 0, W, H, false); const sel = a.input.selected.length;
  a.input.issueOrder(0.5, 0.5); const ordered = a.input.selected.filter(u => u.target).length;
  return JSON.stringify({ renderer: a.rendererName, units: a.units.units.length, tested, ok, bad, miss, sample: bads.slice(0, 6), boxSelected: sel, ordered, drawCalls: a.drawCalls(), buffer: a.pixel.rtW + 'x' + a.pixel.rtH });
})()`;
const res = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
console.log(res.result?.result?.value ?? JSON.stringify(res));
if (errors.length) console.log('page errors:', errors.slice(0, 3));
ws.close(); chrome.kill();
