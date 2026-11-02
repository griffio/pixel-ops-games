// Hold the Farm balance runs (docs/GAME_PLAN.md, base defence B4). Plays Hilltop Farm with both sides under the built-in
// commander (the garrison holds the HQ, mans the positions and crews the guns; the waves come as the mode sends them), at
// each CPU setting and seed asked for, with the base bare or with a standard set of works stood up before the first wave
// (what two engineers and 300 supplies buy in the build phase: eight wall runs with a gate on each face, two platforms, two
// sandbag positions, a heavy machine gun and a mortar), several matches at once in headless Chrome, and prints a line a
// match: who won and why, when, the tickets, the waves spawned, the attackers killed, the walls left and the HQ's owner.
// Needs the game served locally (python3 -m http.server 8787 in the project root).
// usage: node tools/hold-balance.mjs [options]
//   --diff easy,normal,hard     CPU settings (default normal)
//   --seeds 1,2                 seeds (default 1)
//   --base bare,works           the base as deployed (bare) and/or with the standard works (default works)
//   --parallel 2                matches at once (default 2)
//   --length 1200               cap in simulated seconds
//   --url http://localhost:8787
//   --port 9460                 first DevTools port
//   --json out.json             also save the raw results
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const diffs = opt('diff', 'normal').split(','), seeds = opt('seeds', '1').split(',').map(Number), bases = opt('base', 'works').split(',');
const parallel = +opt('parallel', 2), length = +opt('length', 1200), base = opt('url', 'http://localhost:8787'), port0 = +opt('port', 9460), jsonOut = opt('json', '');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const matches = []; for (const diff of diffs) for (const b of bases) for (const seed of seeds) matches.push({ diff, base: b, seed });
const seedOf = (seed) => (seed * 2654435761) >>> 0 || 1;
const seeded = (seed) => `{ let s = ${seedOf(seed)}; window.__reseed = (v) => { s = v >>> 0 || 1; }; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }`;
// the standard works, stood up through the match's own completion hooks (what a finished build does), facing the threat
const WORKS = `
  const { wallBoxes, platformBoxes, platformDeck, sandbagBoxes, emplacementBoxes } = await import('/src/core/models.js');
  const F = m.fobs, W = a.world, put = (type, x, z, h, opts) => { const u = a.units.spawn(type, x, z, h, 0, opts); return u; };
  for (const [x, z] of [[-18, 44], [-12, 44], [-6, 44], [0, 44], [6, 44]]) { const u = put('wall', x, z, 0); F.onWall(u, wallBoxes(x, z, 0)); }          // the north face, a gate east of it
  for (const [x, z] of [[44, -6], [44, 0], [44, 6]]) { const u = put('wall', x, z, Math.PI / 2); F.onWall(u, wallBoxes(x, z, Math.PI / 2)); }            // the east face, a gate north of it
  for (const [x, z, h] of [[-6, 35, 0], [35, 0, Math.PI / 2]]) { const u = put('platform', x, z, h); F.onPlatform(u, platformBoxes(x, z, h), platformDeck(x, z, h, W.surfaceAt(x, z))); }
  for (const [x, z, h] of [[16, 36, 0], [40, 20, Math.PI / 2]]) { const u = put('sandbags', x, z, h); F.onSandbags(u, sandbagBoxes(x, z, h)); }
  { const u = put('emplacement', -16, 28, 0, { gun: 'hmg' }); u.label = 'MG-01'; F.onEmplacement(u, emplacementBoxes(-16, 28, 0)); }
  { const u = put('emplacement', -20, -20, 0.3, { gun: 'mortar' }); u.label = 'MO-01'; F.onEmplacement(u, emplacementBoxes(-20, -20, 0.3)); }
  m.mode.dump.supplies = 8;`;
const play = (len, seed, works) => `(async () => {
  const { seedRng } = await import('/src/core/math.js');
  seedRng(${seed + 101}); window.__reseed(${seedOf(seed + 1)});
  const a = window.app, m = a.match, T = m.teams;
  a.audio = null; m.combat.audio = null; m.combat.onShot = null; m.voices = null;
  ${works ? WORKS : ''}
  const dt = 0.05; let breached = 0; const prevEv = m.event.bind(m); m.event = (e) => { if (e.type === 'wall breached') breached++; return prevEv(e); };
  const wavesAt = [], crewUp = []; let lastWave = 0;
  while (m.state === 'play' && m.elapsed < ${len}) { a.world.update(dt); a.units.update(dt); m.update(dt); a.dust.update(dt); a.markers.update(dt);
    if (m.mode.wave !== lastWave) { lastWave = m.mode.wave; wavesAt.push(Math.round(m.elapsed)); crewUp.push(a.units.units.filter(u => u.team === 0 && u.type === 'soldier' && !u.dead && u.post && u.post.settled).length); } }
  const U = a.units.units;
  return JSON.stringify({ state: m.state, winner: m.winner ? m.winner.id : null, reason: m.reason || 'cap reached', time: Math.round(m.elapsed), tickets: T.map(t => Math.round(t.tickets)),
    waves: m.mode.wave, wavesAt, crewUp, hq: m.mode.hq.owner, lost: T[0].stats.losses.soldier || 0, killed: T[1].stats.losses.soldier || 0, apcsKilled: T[1].stats.losses.apc || 0, alive: m.mode.alive,
    walls: U.filter(u => u.type === 'wall' && !u.dead).length, breached, platforms: U.filter(u => u.type === 'platform' && !u.dead).length, mortarsOurs: U.filter(u => u.type === 'emplacement' && u.team === 1 && !u.dead).length, supplies: m.mode.dump ? Math.round(m.mode.dump.supplies) : 0 });
})()`;
async function run(match, port) {
  if (await fetch(`http://localhost:${port}/json/version`).then(() => true, () => false)) return { ...match, failed: `port ${port} in use`, wall: 0, errors: [] };
  const profile = mkdtempSync(join(tmpdir(), 'pixel-ops-hold-'));
  const url = `${base}/?r=gl&map=hilltop&mode=hold&cpu=both&loadout=garrison&difficulty=${match.diff}&seed=${match.seed}&zoom=1&fog=1&mobile=0`;
  const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=480,320', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  const t0 = Date.now(), errors = [];
  try {
    let targets = []; for (let i = 0; i < 100 && !targets.length; i++) { try { targets = (await fetch(`http://localhost:${port}/json`).then(r => r.json())).filter(t => t.type === 'page'); } catch {} if (!targets.length) await sleep(200); }
    if (!targets.length) throw new Error('Chrome did not start');
    const ws = new WebSocket(targets[0].webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const pending = new Map();
    ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `${seeded(match.seed)} window.requestAnimationFrame = () => 0; try { localStorage.setItem("pixelops.guide", JSON.stringify({ briefed: true, seen: [] })); } catch {}` });
    await send('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 120 && !ready; i++) { const r = await send('Runtime.evaluate', { expression: '!!(window.app && window.app.match && window.app.match.strategists && window.app.match.strategists.length === 2)', returnByValue: true }); ready = r.result?.result?.value; if (!ready) await sleep(500); }
    if (!ready) throw new Error('no CPU-vs-CPU match started');
    await sleep(1500);
    const r = await send('Runtime.evaluate', { expression: play(length, match.seed, match.base === 'works'), awaitPromise: true, returnByValue: true });
    const ex = r.result?.exceptionDetails; if (ex) throw new Error('page: ' + ((ex.exception && ex.exception.description) || ex.text || '').split('\n').slice(0, 2).join(' '));
    const v = r.result?.result?.value; if (typeof v !== 'string') throw new Error(JSON.stringify(r).slice(0, 300));
    ws.close();
    return { ...match, ...JSON.parse(v), wall: Math.round((Date.now() - t0) / 1000), errors };
  } catch (e) { return { ...match, failed: String(e.message || e), wall: Math.round((Date.now() - t0) / 1000), errors }; }
  finally { const gone = new Promise(r => chrome.once('exit', r)); chrome.kill(); await Promise.race([gone, sleep(5000)]); try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} }
}
const pad = (s, n) => String(s).padEnd(n), clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const line = (r) => r.failed ? `${r.diff} ${r.base} seed ${r.seed}: FAILED (${r.failed})`
  : `${pad(r.diff, 7)}${pad(r.base, 6)}seed ${r.seed}  ${pad(r.winner === 0 ? 'farm held' : r.winner === 1 ? 'farm lost' : 'draw', 10)} ${pad(r.reason, 38)} ${clock(r.time)}  tickets ${r.tickets[0]}  waves ${r.waves} (at ${r.wavesAt.join(' ')})  lost ${r.lost}  killed ${r.killed}+${r.apcsKilled} APC  left ${r.alive}  walls ${r.walls}/${r.breached} breached  up at waves ${r.crewUp.join(' ')}  supplies ${r.supplies}  ${r.wall}s${r.errors.length ? '  ERRORS ' + r.errors[0] : ''}`;
try { await fetch(base); } catch { console.error(`Nothing is served at ${base}`); process.exit(1); }
console.log(`${matches.length} matches (${diffs.join(',')} × ${bases.join(',')} × seeds ${seeds.join(',')}), ${parallel} at a time\n`);
const results = [], queue = matches.map((m, i) => ({ m, i }));
await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async (_, w) => { while (queue.length) { const { m, i } = queue.shift(); const r = await run(m, port0 + w); results[i] = r; console.log(line(r)); } }));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 1));
