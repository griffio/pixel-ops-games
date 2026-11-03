// Morale and ammunition probe (docs/GAME_PLAN.md, morale and fire plan). Steps one CPU-vs-CPU match headless, as fast as it
// goes, and prints every `every` simulated seconds, for each side: its live squads by morale state (game/morale.js), the mean
// morale, the wounded on the ground, the wounded, bled out and patched up so far, the infantry deaths, the tickets, the fit
// men's mean share of their magazines, the dry men and the squads off to fill up: the dynamics a balance run's end line
// cannot show (the first morale cut looked fine by its deaths and had every squad of both sides broken from minute five).
// Needs the game served locally (npm start). A seed replays the same match (the page's Math.random is not reseeded here, so
// only the simulation's own rng is fixed; use tools/balance.mjs for exact replays).
// usage: node tools/morale-probe.mjs '<url>' [seconds=600] [every=30] [port=9490]
// e.g.   node tools/morale-probe.mjs 'http://localhost:8787/?r=gl&cpu=both&map=hollow&loadout=balanced&cpuloadout=light&seed=3' 720 60
import { spawn } from 'node:child_process'; import { mkdtempSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const [,, url, secs = '600', every = '30', port = '9490'] = process.argv;
const profile = mkdtempSync(join(tmpdir(), 'pixel-ops-probe-')), sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=480,320', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
const errors = [];
try {
  let t = []; for (let i = 0; i < 100 && !t.length; i++) { try { t = (await fetch(`http://localhost:${port}/json`).then(r => r.json())).filter(x => x.type === 'page'); } catch {} if (!t.length) await sleep(200); }
  const ws = new WebSocket(t[0].webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text || '').slice(0, 300)); };
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) console.log('page error:', JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.requestAnimationFrame = () => 0;' });
  await send('Page.navigate', { url });
  let ready = false; for (let i = 0; i < 150 && !ready; i++) { ready = await ev('!!(window.app && window.app.match && window.app.match.strategists && window.app.match.strategists.length === 2)'); if (!ready) await sleep(200); }
  if (!ready) throw new Error('no match');
  await ev(`(() => { const a = window.app, m = a.match; a.audio = null; m.combat.audio = null; m.voices = null;
    window.__step = (s) => { const dt = 0.05; for (let i = 0; i < s / dt && m.state === 'play'; i++) { a.world.update(dt); a.units.update(dt); m.update(dt); a.dust.update(dt); a.markers.update(dt); } };
    window.__snap = () => { const m = window.app.match, T = m.teams, out = []; for (const t of [0, 1]) { const S = m.units.squads.filter(s => s.team === t && s.members.some(u => !u.dead)); const by = {}; for (const s of S) by[s.state] = (by[s.state] || 0) + 1;
      const down = m.units.units.filter(u => u.team === t && u.type === 'soldier' && u.down && !u.dead).length, st = T[t].stats;
      const men = m.units.units.filter(u => u.team === t && u.type === 'soldier' && u.fit), amf = men.length ? (men.reduce((a, u) => a + (u.ammoFrac ?? 1), 0) / men.length).toFixed(2) : '-', dry = men.filter(u => u.dry).length, rearm = S.filter(s => s.tag === 'rearm').length;
      out.push({ squads: by, down, wounded: st.wounded || 0, bled: st.bled || 0, patched: st.recovered || 0, dead: st.losses.soldier || 0, tickets: Math.round(T[t].tickets), mor: S.length ? (S.reduce((a, s) => a + s.morale, 0) / S.length).toFixed(2) : '-', amf, dry, rearm }); }
      return { t: Math.round(m.elapsed), state: m.state, sides: out }; }; return true; })()`);
  for (let s = 0; s < +secs; s += +every) {
    await ev(`window.__step(${every})`);
    const r = await ev('JSON.stringify(window.__snap())'); const j = JSON.parse(r);
    const f = (x) => `squads ${JSON.stringify(x.squads).replace(/"/g, '')} mor ${x.mor} down ${x.down} wnd ${x.wounded} bled ${x.bled} patched ${x.patched} dead ${x.dead} tk ${x.tickets} ammo ${x.amf} dry ${x.dry} rearming ${x.rearm}`;
    console.log(`${String(j.t).padStart(4)} s  A: ${f(j.sides[0])}\n        B: ${f(j.sides[1])}`);
    if (j.state !== 'play') { console.log('match over:', j.state); break; }
  }
  if (errors.length) console.log('page errors:', errors.length, errors.slice(0, 3));
} finally { chrome.kill('SIGKILL'); rmSync(profile, { recursive: true, force: true }); }
