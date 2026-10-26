// CPU-vs-CPU balance runs. Plays each matchup to the end in headless Chrome, several at once, stepping the simulation
// in the page as fast as it will go (the page's own loop never runs), then prints every result and win tables per
// pairing and per preset. Each pairing is played both ways round by default, so each preset gets both bases. The page's
// Math.random is seeded from the match seed, so a seed replays the same match (as long as the code is the same): compare a
// change against the same seeds before and after.
// Needs the game served locally (python3 -m http.server 8787 in the project root).
// usage: node tools/balance.mjs [options]
//   --pairs balanced:armoured,light:mechanized   preset keys from src/game/loadout.js (default: a core set, below)
//   --seeds 1,2                                   seeds (default 1,2)
//   --one-side                                    only as written: the first preset at the south-west base
//   --mode aas                                    game mode (default aas)
//   --length 1600                                 cap in simulated seconds (a match lasts 1,500)
//   --parallel 4                                  matches at once (default 4)
//   --url http://localhost:8787                   where the game is served
//   --extra 'ai=rules&persona=aggressive'         extra query parameters for every match
//   --json results.json                           also save the raw results
//   --port 9450                                   first DevTools port (one per match at once; two runs side by side need different ones)
// CHROME=/path/to/chrome overrides the browser.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const pairs = opt('pairs', 'balanced:armoured,balanced:mechanized,light:mechanized,air:light').split(',').map(p => p.split(':'));
const seeds = opt('seeds', '1,2').split(',').map(Number), both = !args.includes('--one-side');
const mode = opt('mode', 'aas'), length = +opt('length', 1600), parallel = +opt('parallel', 4), base = opt('url', 'http://localhost:8787'), extra = opt('extra', ''), jsonOut = opt('json', ''), port0 = +opt('port', 9450);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const matches = [];
for (const [a, b] of pairs) for (const seed of seeds) { matches.push({ blu: a, op: b, seed }); if (both) matches.push({ blu: b, op: a, seed }); }

// a seeded Math.random (mulberry32) as page source; window.__reseed rewinds that same generator, so code that kept a
// reference to Math.random follows the reseed too
const seedOf = (seed) => (seed * 2654435761) >>> 0 || 1;
const seeded = (seed) => `{ let s = ${seedOf(seed)}; window.__reseed = (v) => { s = v >>> 0 || 1; }; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }`;
// the whole match, in the page, in one go (nothing else can run between steps): returns the result as JSON. Both random
// sources (Math.random and the simulation's own rng) are reseeded as it starts, whatever the page drew while loading, and
// sound is switched off (it rate-limits on the audio clock, which runs in real time, and draws random numbers).
const play = (len, seed) => `(async () => {
  const { seedRng } = await import('/src/core/math.js');
  seedRng(${seed + 101}); window.__reseed(${seedOf(seed + 1)});
  const a = window.app, m = a.match, T = m.teams;
  a.audio = null; m.combat.audio = null; m.voices = null;   // sound rate-limits on the audio clock (real time) and draws random numbers: off
  window.__start = Math.round(a.units.units.reduce((h, u) => h + u.pos.x * 3 + u.pos.z * 7 + u.hp, 0) * 1000) + ':' + m.elapsed.toFixed(3) + ':' + m.strategists.map(s => s.timer.toFixed(4)).join(',');
  const kills = [{}, {}], prev = m.combat.onDeath;
  m.combat.onDeath = (v, k) => { if (k) { const t = k.type === 'soldier' ? k.kit : k.type; kills[k.team][t] = (kills[k.team][t] || 0) + 1; } prev(v, k); };
  const dt = 0.05;
  while (m.state === 'play' && m.elapsed < ${len}) { a.world.update(dt); a.units.update(dt); m.update(dt); a.dust.update(dt); a.markers.update(dt); }
  return JSON.stringify({ state: m.state, winner: m.winner ? m.winner.id : null, reason: m.reason || 'cap reached', time: Math.round(m.elapsed), tickets: T.map(t => Math.round(t.tickets)),
    losses: T.map(t => t.stats.losses), kills, captures: T.map(t => t.stats.captures), sandbags: [0, 1].map(i => a.units.units.filter(u => u.type === 'sandbags' && u.team === i).length),
    start: window.__start, sig: Math.round(a.units.units.reduce((h, u) => h + u.pos.x * 3 + u.pos.z * 7 + u.hp, 0)) });
})()`;

async function run(match, port) {
  // a browser left over from an earlier run would answer on this port in place of the one started here
  if (await fetch(`http://localhost:${port}/json/version`).then(() => true, () => false)) return { ...match, failed: `port ${port} is in use (a Chrome left from an earlier run? pkill -f pixel-ops-balance)`, wall: 0, errors: [] };
  const profile = mkdtempSync(join(tmpdir(), 'pixel-ops-balance-'));
  const url = `${base}/?r=gl&cpu=both&mode=${mode}&loadout=${match.blu}&cpuloadout=${match.op}&seed=${match.seed}&zoom=1${extra ? '&' + extra : ''}`;
  const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=480,320', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  const t0 = Date.now(), errors = [];
  try {
    let targets = [];
    for (let i = 0; i < 100 && !targets.length; i++) { try { targets = (await fetch(`http://localhost:${port}/json`).then(r => r.json())).filter(t => t.type === 'page'); } catch {} if (!targets.length) await sleep(200); }
    if (!targets.length) throw new Error('Chrome did not start');
    const ws = new WebSocket(targets[0].webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const pending = new Map();
    ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text || '').split('\n').slice(0, 2).join(' ')); };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable'); await send('Page.enable');
    // before any of the game's code runs: Math.random seeded from the match seed, and no animation frames (nothing draws, and
    // only the fixed steps below move the simulation), so a seed replays the same match
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `${seeded(match.seed)} window.requestAnimationFrame = () => 0;` });
    await send('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 120 && !ready; i++) { const r = await send('Runtime.evaluate', { expression: '!!(window.app && window.app.match && window.app.match.strategists && window.app.match.strategists.length === 2)', returnByValue: true }); ready = r.result?.result?.value; if (!ready) await sleep(500); }
    if (!ready) throw new Error('no CPU-vs-CPU match started');
    await sleep(1500);   // let the page finish loading before the match is stepped
    const r = await send('Runtime.evaluate', { expression: play(length, match.seed), awaitPromise: true, returnByValue: true });
    const ex = r.result?.exceptionDetails; if (ex) throw new Error('page: ' + ((ex.exception && ex.exception.description) || ex.text || '').split('\n').slice(0, 2).join(' '));   // the match threw
    const v = r.result?.result?.value; if (typeof v !== 'string') throw new Error(JSON.stringify(r).slice(0, 300));
    ws.close();
    return { ...match, ...JSON.parse(v), wall: Math.round((Date.now() - t0) / 1000), errors };
  } catch (e) { return { ...match, failed: String(e.message || e), wall: Math.round((Date.now() - t0) / 1000), errors }; }
  finally {   // let Chrome exit before removing its profile; a leftover temp folder never fails the run
    const gone = new Promise(r => chrome.once('exit', r)); chrome.kill(); await Promise.race([gone, sleep(5000)]);
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  }
}

const pad = (s, n) => String(s).padEnd(n), clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
function line(r) {
  if (r.failed) return `seed ${r.seed}  ${r.blu} v ${r.op}: FAILED (${r.failed})`;
  const win = r.winner === 0 ? r.blu : r.winner === 1 ? r.op : 'draw';
  const veh = (l) => sum(l) - (l.soldier || 0) - (l.fob || 0);
  return `seed ${r.seed}  ${pad(r.blu + ' (SW)', 17)} v ${pad(r.op + ' (NE)', 17)} ${pad(win === 'draw' ? 'draw' : win + ' wins', 17)} ${pad(r.reason, 24)} ${clock(r.time)}  tickets ${r.tickets[0]}-${r.tickets[1]}  infantry lost ${r.losses[0].soldier || 0}-${r.losses[1].soldier || 0}  vehicles lost ${veh(r.losses[0])}-${veh(r.losses[1])}  sandbags ${r.sandbags[0]}-${r.sandbags[1]}${r.errors.length ? `  PAGE ERRORS ${r.errors.length}: ${r.errors[0]}` : ''}  (${r.wall} s)`;
}

try { await fetch(base); } catch { console.error(`Nothing is served at ${base}: start a server in the project root (python3 -m http.server 8787) or pass --url.`); process.exit(1); }
console.log(`${matches.length} matches (${pairs.map(p => p.join(' v ')).join(', ')}; seeds ${seeds.join(',')}${both ? '; both ways round' : ''}), ${parallel} at a time\n`);
const results = [], queue = matches.map((m, i) => ({ m, i }));
await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async (_, w) => {
  while (queue.length) { const { m, i } = queue.shift(); const r = await run(m, port0 + w); results[i] = r; console.log(line(r)); }
}));

// win tables: per pairing (either base), and per preset over everything it played
const ok = results.filter(r => r && !r.failed), key = (a, b) => [a, b].sort().join(' v ');
const byPair = new Map(), byPreset = new Map();
for (const r of ok) {
  const k = key(r.blu, r.op), p = byPair.get(k) || { games: 0, wins: {}, draws: 0, margin: {} }; byPair.set(k, p); p.games++;
  const win = r.winner === 0 ? r.blu : r.winner === 1 ? r.op : null;
  if (win) p.wins[win] = (p.wins[win] || 0) + 1; else p.draws++;
  p.margin[r.blu] = (p.margin[r.blu] || 0) + r.tickets[0] - r.tickets[1]; p.margin[r.op] = (p.margin[r.op] || 0) + r.tickets[1] - r.tickets[0];
  for (const [side, preset] of [[0, r.blu], [1, r.op]]) { const s = byPreset.get(preset) || { games: 0, wins: 0, draws: 0 }; byPreset.set(preset, s); s.games++; if (r.winner === side) s.wins++; else if (r.winner === null) s.draws++; }
}
console.log('\nper pairing (wins either base; average final ticket margin per game)');
for (const [k, p] of byPair) { const [a, b] = k.split(' v '); console.log(`  ${pad(k, 26)} ${a} ${p.wins[a] || 0} - ${p.wins[b] || 0} ${b}${p.draws ? `, ${p.draws} drawn` : ''}   margin ${a} ${Math.round(p.margin[a] / p.games) >= 0 ? '+' : ''}${Math.round(p.margin[a] / p.games)}`); }
console.log('\nper preset');
for (const [k, s] of [...byPreset].sort((x, y) => y[1].wins / y[1].games - x[1].wins / x[1].games)) console.log(`  ${pad(k, 12)} won ${s.wins} of ${s.games} (${Math.round(100 * s.wins / s.games)}%)${s.draws ? `, ${s.draws} drawn` : ''}`);
const swWins = ok.filter(r => r.winner === 0).length, neWins = ok.filter(r => r.winner === 1).length;
console.log(`\nby base: south-west won ${swWins}, north-east won ${neWins} of ${ok.length}`);
const bad = results.filter(r => r && (r.failed || r.errors.length)); if (bad.length) console.log(`${bad.length} match(es) failed or threw page errors (see above)`);
if (jsonOut) { writeFileSync(jsonOut, JSON.stringify(results, null, 1)); console.log(`raw results: ${jsonOut}`); }
