// Drives headless Chrome over the DevTools protocol: runs a CPU-vs-CPU match for a
// while and reports tickets, losses, kill feed and any page exceptions.
import { spawn } from 'node:child_process';
// usage: node tools/match-test.mjs 'http://localhost:8787/?r=gl&seed=11&zoom=2' [port] [profileDir]
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
  const a = window.app; if (!a || !a.match) return JSON.stringify({ error: "no match" });
  const m = a.match, t = m.teams;
  const alive = (team, type) => a.units.units.filter(u => u.team === team && u.type === type && !u.dead).length;
  return JSON.stringify({ renderer: a.rendererName, state: m.state, time: Math.round(m.time), loadouts: t.map(x => x.loadoutName + "/" + x.doctrine.name), tickets: [Math.round(t[0].tickets), Math.round(t[1].tickets)], kills: [t[0].kills, t[1].kills], losses: [t[0].losses, t[1].losses],
    alive: { blu: [alive(0, "soldier"), alive(0, "truck"), alive(0, "apc"), alive(0, "heli")], op: [alive(1, "soldier"), alive(1, "truck"), alive(1, "apc"), alive(1, "heli")] },
    objectives: m.objectives ? m.objectives.list.map(l => l.name + ":" + (l.owner === -1 ? "n" : l.owner) + ":" + Math.round(l.progress)) : null, units: a.units.units.length, wrecks: a.units.units.filter(u => u.wreck).length, particles: a.dust.n, drawCalls: a.drawCalls(), feed: m.feed.slice(0, 3).map(f => (f.k ? f.k.label : "?") + ">" + f.v.label) });
})()`;
const res = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
console.log(res.result?.result?.value ?? JSON.stringify(res));
if (errors.length) console.log('page errors:', errors.slice(0, 3));
ws.close(); chrome.kill();
