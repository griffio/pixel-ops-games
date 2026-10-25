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
  return JSON.stringify({ renderer: a.rendererName, state: m.state, time: Math.round(m.time), mode: m.mode.constructor.key + (m.mode.constructor.sides ? "/attacker=" + m.mode.attacker : ""), bar: m.mode.bar().map(b => b.name + ":" + b.owner + ":" + Math.round(b.progress) + ":" + b.note), loadouts: t.map(x => x.loadoutName + "/" + x.doctrine.name), tickets: [Math.round(t[0].tickets), Math.round(t[1].tickets)], kills: [t[0].kills, t[1].kills], losses: [t[0].losses, t[1].losses],
    alive: { blu: [alive(0, "soldier"), alive(0, "truck"), alive(0, "apc"), alive(0, "heli")], op: [alive(1, "soldier"), alive(1, "truck"), alive(1, "apc"), alive(1, "heli")] },
    objectives: m.objectives ? m.objectives.list.map(l => l.name + ":" + (l.owner === -1 ? "n" : l.owner) + ":" + Math.round(l.progress)) : null, fobs: [m.fobs.active(0).length, m.fobs.active(1).length], fobPos: a.units.units.filter(u => u.type === "fob" && !u.dead).map(u => [u.team, Math.round(u.pos.x), Math.round(u.pos.z)]), builds: m.fobs.builds.length, mounted: a.units.units.filter(u => u.mounted).length, lifts: m.strategists.map(s => s.lifts.size), supplies: a.units.units.filter(u => u.supply && !u.dead).map(u => Math.round(u.supplies)), units: a.units.units.length, wrecks: a.units.units.filter(u => u.wreck).length, particles: a.dust.n, drawCalls: a.drawCalls(), feed: m.feed.slice(0, 4).map(f => f.kind === "kill" ? (f.k ? f.k.label : "?") + ">" + f.v.label : "[" + f.e.type + (f.e.loc ? " " + f.e.loc.name : "") + "]"), difficulty: m.difficulty.name, elapsed: Math.round(m.elapsed), winner: m.winner ? m.winner.name : (m.state === 'over' ? 'draw' : null), reason: m.reason, infantryDeathsPerMin: t.map(x => +((x.stats.losses.soldier || 0) / Math.max(1, m.elapsed / 60)).toFixed(1)), ticketsPerMin: t.map((x, i) => +((m.mode.tickets(i) - x.tickets) / Math.max(1, m.elapsed / 60)).toFixed(1)), cpuMul: [t[1].acc, t[1].dmg, t[1].respawnMul, t[1].fobKits], commander: m.strategists.map(s => s.remote ? { ...s.remote.stats, plan: s.remote.plan } : null), ai: m.strategists.map(s => s.utility ? 'utility:' + s.utility.persona : 'rules'), history: m.history.length, stats: t.map(x => x.stats), audio: a.audio ? a.audio.stats : null });
})()`;
const res = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
console.log(res.result?.result?.value ?? JSON.stringify(res));
if (errors.length) console.log('page errors:', errors.slice(0, 3));
ws.close(); chrome.kill();
