// Exports code-built unit models as MagicaVoxel files: models/vox/<type>.vox and <type>.json (core/voxexport.js runs in the
// page, since the models and their camo canvases live there). Needs the game served on :8787 (npm start).
// usage: node tools/export-vox.mjs <type> [type ...]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const types = process.argv.slice(2), port = '9353';
if (!types.length) { console.log('usage: node tools/export-vox.mjs <type> [type ...]'); process.exit(1); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'pixel-ops-vox-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
try {
  let t = []; for (let i = 0; i < 100 && !t.length; i++) { try { t = (await fetch(`http://localhost:${port}/json`).then(r => r.json())).filter(x => x.type === 'page'); } catch {} if (!t.length) await sleep(200); }
  const ws = new WebSocket(t[0].webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.navigate', { url: 'http://localhost:8787/?sandbox=1' });
  for (let i = 0; i < 200; i++) { const r = await send('Runtime.evaluate', { expression: '!!window.app', returnByValue: true }); if (r.result?.result?.value) break; await sleep(300); }
  mkdirSync('models/vox', { recursive: true });
  for (const type of types) {
    const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `import('/src/core/voxexport.js').then(m => { const r = m.exportVox('${type}'); const b = new Uint8Array(r.vox); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return JSON.stringify({ vox: btoa(s), meta: r.meta }); })` });
    if (r.result?.exceptionDetails) { console.log(type, 'failed:', r.result.exceptionDetails.text, JSON.stringify(r.result.exceptionDetails.exception?.description).slice(0, 400)); continue; }
    const { vox, meta } = JSON.parse(r.result.result.value);
    writeFileSync(`models/vox/${type}.vox`, Buffer.from(vox, 'base64')); writeFileSync(`models/vox/${type}.json`, JSON.stringify(meta, (k, v) => Array.isArray(v) && v.every(x => typeof x === 'number') ? '@' + JSON.stringify(v) : v, 1).replace(/"@(\[[^"]*\])"/g, '$1') + '\n');   // number lists on one line
    console.log(type, 'exported:', Buffer.from(vox, 'base64').length, 'bytes,', meta.colours, 'colours, parts', Object.keys(meta.pivots).join(' '));
  }
} finally { chrome.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
