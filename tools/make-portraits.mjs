// Renders the unit strip's portraits (icons/units/<key>.png) from the game's own models: each squad type lined up, each
// vehicle and each build, posed on open ground and cropped at 240 x 136 (cards show them at half size, sharp on a
// retina screen). Needs the game served on :8787 (npm start).
// usage: node tools/make-portraits.mjs [key ...]   (no keys: all of them)
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const only = process.argv.slice(2), port = '9351', OUT = 'icons/units';
const SUBJECTS = {
  rifle: ['rifle', 'rifle', 'mg', 'rifle'], support: ['mg', 'mg', 'rifle', 'rifle'], at: ['at', 'at', 'rifle', 'rifle'], medic: ['rifle', 'medic', 'rifle', 'rifle'],
  engineer: ['rifle', 'engineer', 'rifle', 'rifle'], marksman: ['marksman', 'rifle', 'rifle', 'rifle'],
  apc: 'apc', truck: 'truck', supply: 'supply', tank: 'tank', heli: 'heli', amphib: 'amphib', amphibSupply: 'amphibSupply', fob: 'fob', sandbags: 'sandbags', traps: 'traps', hmg: 'emp_hmg', atgm: 'emp_atgm', mortar: 'emp_mortar',
};
const W = 240, H = 136;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'pixel-ops-portraits-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--window-size=1200,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
try {
  let t = []; for (let i = 0; i < 100 && !t.length; i++) { try { t = (await fetch(`http://localhost:${port}/json`).then(r => r.json())).filter(x => x.type === 'page'); } catch {} if (!t.length) await sleep(200); }
  const ws = new WebSocket(t[0].webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result?.result?.value; };
  await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:8787/?cpu=both&loadout=balanced&seed=1&fog=0&mobile=0' });
  for (let i = 0; i < 120; i++) { if (await ev('!!(window.app && window.app.match && window.app.match.units)')) break; await sleep(500); }
  // a still world with nothing drawn over it
  await ev(`(() => { const a = window.app; a.hud.setPaused(true, true); a.rts.fly = null; a.rts.follow = null; if (a.guide) { a.guide.setHints(false); if (a.guide.isOpen) a.guide.close(); }   // fly: the opening flight would carry the camera off the subject
    const s = document.createElement('style'); s.textContent = '#labels, #edges, .panel, #touchbar, #minimap, #objs, #feed, #dock, #help { visibility: hidden !important; }'; document.head.appendChild(s);
    return 1; })()`);
  mkdirSync(OUT, { recursive: true });
  for (const [key, v] of Object.entries(SUBJECTS)) {
    if (only.length && !only.includes(key)) continue;
    // posed on open sand on the BLUFOR side of Palm Valley, facing three-quarters toward the camera
    await ev(`(() => { const a = window.app, r = a.rts, X = 140, Z = -560, y = r.yaw, rx = Math.cos(y), rz = -Math.sin(y), v = ${JSON.stringify(v)}, made = [];
      if (Array.isArray(v)) v.forEach((kit, i) => { const o = (i - 1.5) * 1.05, u = a.units.spawn('soldier', X + rx * o, Z + rz * o, y + 0.55, 0); u.kit = kit; made.push(u); });
      else if (v.startsWith('emp_')) made.push(a.units.spawn('emplacement', X, Z, y + 0.6, 0, { gun: v.slice(4) }));
      else made.push(a.units.spawn(v === 'supply' || v === 'amphibSupply' ? 'truck' : v === 'amphib' ? 'apc' : v, X, Z, y + (v === 'heli' ? 0.9 : 0.75), 0, v === 'supply' ? { supply: true } : v === 'amphib' ? { amphib: true } : v === 'amphibSupply' ? { supply: true, amphib: true } : {}));   // the amphibians asked for by name, on any map
      a.units.update(0); window.__made = made; r.follow = null; r.target.set(X, 0, Z); r.zoom = r.zoomT = 2.5; r.pitch = r.pitchT = 0.62; return 1; })()`);
    const measure = () => ev(`(() => { const r = window.app.rts; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const u of window.__made) for (const [dx, dy, dz] of [[-1, 0, -1], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [0, 1, 0]]) { const R = u.radius || 1, [sx, sy] = r.worldToScreen(u.pos.x + dx * R, u.pos.y + dy * (u.height || 2), u.pos.z + dz * R, innerWidth, innerHeight); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      return [x0, y0, x1, y1]; })()`);
    await sleep(500); let box = await measure();
    for (let pass = 0; pass < 2; pass++) {   // zoom until it fills the frame
      const fit = Math.min((Array.isArray(v) ? 190 : 205) / (box[2] - box[0]), 112 / (box[3] - box[1]));
      await ev(`(() => { const r = window.app.rts; r.zoom = r.zoomT = r.zoomT * ${fit}; return 1; })()`); await sleep(500); box = await measure();
    }
    await sleep(1200);
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(cx - W / 2), y: Math.round(cy - H / 2 - 4), width: W, height: H, scale: 1 } });
    writeFileSync(`${OUT}/${key}.png`, Buffer.from(shot.result.data, 'base64'));
    await ev(`(() => { for (const u of window.__made) window.app.units.removeUnit(u); return 1; })()`);
    console.log(key);
  }
} finally { chrome.kill(); await sleep(800); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
