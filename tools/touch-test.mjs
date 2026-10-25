// Drives the touch layer in headless Chrome over CDP with synthetic touches on an
// iPad-sized viewport: tap-select, hold-to-order, tap-to-move, Clear, drag pan + fling, pinch, twist,
// three-finger tilt, hold-and-drag box select, double-tap. Also checks the mobile
// render profile and the manifest, and saves a screenshot.
// usage: node tools/touch-test.mjs [url] [port] [profileDir] [screenshot.png]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [,, url = 'http://localhost:8787/?mobile=1&cpu=none&loadout=balanced&seed=5', port = '9341', profile = '/tmp/pixel-ops-touch-profile', shot = ''] = process.argv;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1180,820', '--hide-scrollbars', url], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = (await fetch(`http://localhost:${port}/json`).then(r => r.json())).filter(t => t.type === 'page' && t.url.startsWith('http')); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception?.description || '')); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error('eval: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value; };
await send('Runtime.enable'); await send('Page.enable');
// retina only for the screenshot run: software GL at 2x makes frames slow enough to turn taps into holds
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: shot ? 2 : 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
for (let i = 0; i < 60; i++) { if (await ev('!!(window.app && window.app.units && window.app.units.units.length > 0)')) break; await sleep(500); }
for (let i = 0; i < 40; i++) { if (await ev('innerWidth >= 1000 && innerHeight >= 600')) break; await sleep(500); }
await sleep(2500);

const touch = async (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i, radiusX: 8, radiusY: 8 })) });
const tapAt = async (x, y, holdMs = 40) => { await touch('touchStart', [[x, y]]); await sleep(holdMs); await touch('touchEnd', []); await sleep(holdMs < 40 ? 60 : 120); };
const dragPath = async (fromPts, toPts, steps = 8, stepMs = 16) => {   // multi-finger linear drag
  await touch('touchStart', fromPts); await sleep(30);
  for (let s = 1; s <= steps; s++) { await touch('touchMove', fromPts.map((p, i) => [p[0] + (toPts[i][0] - p[0]) * s / steps, p[1] + (toPts[i][1] - p[1]) * s / steps, i])); await sleep(stepMs); }
};
const results = {};
const camera = () => ev('JSON.stringify({ x: app.rts.target.x, z: app.rts.target.z, zoom: app.rts.zoomT, yaw: app.rts.yawT, pitch: app.rts.pitchT })').then(JSON.parse);

// 0. profile
results.profile = await ev(`JSON.stringify({ touch: app.touch, bodyTouch: document.body.classList.contains('touch'), dpr: app.pixel.dpr, shadow: app.renderer.shadowSize, edgePan: app.rts.edgePan, touchbar: getComputedStyle(document.getElementById('touchbar')).display, stats: getComputedStyle(document.getElementById('stats')).display, manifest: !!document.querySelector('link[rel=manifest]') })`).then(JSON.parse);

// 1. tap a friendly soldier that is on screen
const unitPos = await ev(`(() => { const me = 0; for (const u of app.units.units) { if (u.team !== me || u.type !== 'soldier' || u.dead) continue; const [sx, sy] = app.rts.worldToScreen(u.pos.x, u.pos.y + 0.9, u.pos.z, innerWidth, innerHeight); if (sx > 200 && sx < innerWidth - 300 && sy > 160 && sy < innerHeight - 120) return JSON.stringify({ sx, sy, label: u.label, squad: u.squad ? u.squad.members.length : 1 }); } return null; })()`).then(v => v && JSON.parse(v));
if (unitPos) { await tapAt(unitPos.sx, unitPos.sy); results.tapSelect = { unit: unitPos.label, squad: unitPos.squad, selected: await ev('app.input.selected.length') }; }
else results.tapSelect = 'no soldier on screen';

// 2. hold on open ground to order the selection
const sel0 = await ev('app.input.selected.length');
const hx = 560, hy = 300;
await touch('touchStart', [[hx, hy]]); await sleep(700); await touch('touchEnd', []); await sleep(150);
results.holdOrder = { selectedBefore: sel0, moving: await ev('app.input.selected.filter(u => u.target).length'), markers: await ev('app.markers.list ? app.markers.list.length : (app.markers.items ? app.markers.items.length : -1)') };

// 3. tap empty ground (no unit within 40 px) with units selected: they move there and stay selected
await sleep(300);
const empty = await ev(`(() => { const pts = app.units.units.filter(u => !u.dead).map(u => app.rts.worldToScreen(u.pos.x, u.pos.y + 1, u.pos.z, innerWidth, innerHeight)); for (let y = 200; y < innerHeight - 150; y += 30) for (let x = 250; x < innerWidth - 300; x += 30) { const g = app.rts.screenToGround(x / innerWidth, y / innerHeight); if (!pts.some(p => Math.hypot(p[0] - x, p[1] - y) < 40) && document.elementFromPoint(x, y) === app.canvas && !app.world.isBlocked(g.x, g.z, 1)) return JSON.stringify([x, y]); } return null; })()`).then(v => v && JSON.parse(v));   // open, walkable ground on the canvas
if (empty) {
  await ev('app.input.select(app.units.squads.find(s => s.team === 0 && s.alive).members); for (const u of app.input.selected) { u.target = null; u.dest = null; }');
  await tapAt(empty[0], empty[1]);
  const g = await ev(`JSON.stringify(app.rts.screenToGround(${empty[0]} / innerWidth, ${empty[1]} / innerHeight))`).then(JSON.parse);
  results.tapMove = { at: empty, selected: await ev('app.input.selected.length'), moving: await ev('app.input.selected.filter(u => u.dest).length'), toast: await ev('document.getElementById("toast")?.textContent || ""'),
    destOff: await ev(`Math.round(Math.min(...app.input.selected.filter(u => u.dest).map(u => Math.hypot(u.dest.x - ${g.x}, u.dest.z - ${g.z}))))`) };
  await ev('app.hud.touchAction("clear")'); results.clear = { selected: await ev('app.input.selected.length') };
}

// 4. one-finger drag pans (finger moves left 400 px: the view shifts right along the camera's right axis)
let c0 = await camera();
await dragPath([[800, 420]], [[400, 420]], 10, 16); await touch('touchEnd', []); await sleep(60);
let c1 = await camera();
const axes = await ev('JSON.stringify(app.rts.groundAxes())').then(JSON.parse);
const along = ((c1.x - c0.x) * axes.right.x + (c1.z - c0.z) * axes.right.z), across = ((c1.x - c0.x) * axes.fwd.x + (c1.z - c0.z) * axes.fwd.z);
results.dragPan = { alongRight: +along.toFixed(1), alongFwd: +across.toFixed(1), expected: +(400 / (c0.zoom * 10)).toFixed(1), selectedAfter: await ev('app.input.selected.length') };
// fling: a fast in-page drag released while still moving keeps the camera going
const f0 = await camera();
await ev(`(async () => { const pe = (type, x, y) => (type === 'pointerdown' ? app.canvas : window).dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 7, clientX: x, clientY: y, bubbles: true, isPrimary: true })), wait = (ms) => new Promise(r => setTimeout(r, ms)); pe('pointerdown', 700, 420); for (let i = 1; i <= 8; i++) { await wait(16); pe('pointermove', 700 - i * 40, 420); } pe('pointerup', 380, 420); })()`);
await sleep(100); const f1 = await camera(); await sleep(900); const f2 = await camera();
results.fling = { velAtRelease: await ev('JSON.stringify(app.input.touch.vel)'), moved: +Math.hypot(f1.x - f0.x, f1.z - f0.z).toFixed(1), extra: +Math.hypot(f2.x - f1.x, f2.z - f1.z).toFixed(1) };

await ev('app.input.touch.vel.x = app.input.touch.vel.z = 0'); await sleep(250);   // stop the glide before measuring drift
// 5. pinch out: zoom in about the midpoint; the ground under the midpoint should stay put
const mid = [600, 420];
const gBefore = await ev(`JSON.stringify(app.rts.screenToGround(${mid[0]} / innerWidth, ${mid[1]} / innerHeight))`).then(JSON.parse);
c0 = await camera();
await dragPath([[520, 420, 0], [680, 420, 1]], [[440, 420, 0], [760, 420, 1]], 10, 16); await touch('touchEnd', []); await sleep(120);
c1 = await camera();
const gAfter = await ev(`JSON.stringify(app.rts.screenToGround(${mid[0]} / innerWidth, ${mid[1]} / innerHeight))`).then(JSON.parse);
results.pinch = { zoomBefore: +c0.zoom.toFixed(2), zoomAfter: +c1.zoom.toFixed(2), expected: +(c0.zoom * 2).toFixed(2), midDrift: +Math.hypot(gAfter.x - gBefore.x, gAfter.z - gBefore.z).toFixed(2) };

// 6. twist 40 degrees clockwise about the same midpoint
const r = 140, a0 = 0, a1 = 40 * Math.PI / 180, fa = (a) => [[mid[0] - r * Math.cos(a), mid[1] - r * Math.sin(a), 0], [mid[0] + r * Math.cos(a), mid[1] + r * Math.sin(a), 1]];
const gA0 = await ev(`JSON.stringify(app.rts.screenToGround(${fa(a1)[0][0]} / innerWidth, ${fa(a1)[0][1]} / innerHeight))`).then(JSON.parse);   // where finger A will end up: ground there now
const gMid0 = await ev(`JSON.stringify(app.rts.screenToGround(${mid[0]} / innerWidth, ${mid[1]} / innerHeight))`).then(JSON.parse);
const gFingerA0 = await ev(`JSON.stringify(app.rts.screenToGround(${fa(a0)[0][0]} / innerWidth, ${fa(a0)[0][1]} / innerHeight))`).then(JSON.parse);
c0 = await camera();
await touch('touchStart', fa(a0)); await sleep(30);
for (let s = 1; s <= 12; s++) { await touch('touchMove', fa(a0 + (a1 - a0) * s / 12)); await sleep(16); }
await touch('touchEnd', []); await sleep(120);
c1 = await camera();
const gMid1 = await ev(`JSON.stringify(app.rts.screenToGround(${mid[0]} / innerWidth, ${mid[1]} / innerHeight))`).then(JSON.parse);
const gFingerA1 = await ev(`JSON.stringify(app.rts.screenToGround(${fa(a1)[0][0]} / innerWidth, ${fa(a1)[0][1]} / innerHeight))`).then(JSON.parse);
results.twist = { dyawDeg: +((c1.yaw - c0.yaw) * 180 / Math.PI).toFixed(1), expectedDeg: 40, midDrift: +Math.hypot(gMid1.x - gMid0.x, gMid1.z - gMid0.z).toFixed(2), fingerDrift: +Math.hypot(gFingerA1.x - gFingerA0.x, gFingerA1.z - gFingerA0.z).toFixed(2), zoomChange: +(c1.zoom - c0.zoom).toFixed(3) };

// 7. three-finger tilt
c0 = await camera();
await dragPath([[500, 300, 0], [600, 300, 1], [700, 300, 2]], [[500, 450, 0], [600, 450, 1], [700, 450, 2]], 8, 16); await touch('touchEnd', []); await sleep(80);
c1 = await camera(); results.tilt = { dpitch: +(c1.pitch - c0.pitch).toFixed(3) };

// 8. hold with nothing selected, then drag: box select around the friendly units on screen
await ev('app.input.select([]); app.hud.touchAction("base")'); await sleep(400);
const box = await ev(`(() => { const me = 0, pts = []; for (const u of app.units.units) { if (u.team !== me || u.dead || u.mounted) continue; const [sx, sy] = app.rts.worldToScreen(u.pos.x, u.pos.y + 1, u.pos.z, innerWidth, innerHeight); if (sx > 40 && sx < innerWidth - 260 && sy > 140 && sy < innerHeight - 80) pts.push([sx, sy]); } if (pts.length < 2) return null; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return JSON.stringify({ n: pts.length, x0: Math.min(...xs) - 20, y0: Math.min(...ys) - 20, x1: Math.max(...xs) + 20, y1: Math.max(...ys) + 20 }); })()`).then(v => v && JSON.parse(v));
if (box) {
  await touch('touchStart', [[box.x0, box.y0]]); await sleep(700);
  for (let s = 1; s <= 8; s++) { await touch('touchMove', [[box.x0 + (box.x1 - box.x0) * s / 8, box.y0 + (box.y1 - box.y0) * s / 8]]); await sleep(16); }
  await touch('touchEnd', []); await sleep(120);
  results.holdBox = { onScreen: box.n, selected: await ev('app.input.selected.length') };
} else results.holdBox = 'not enough units on screen';

// 9. double-tap a soldier: all soldiers on screen
const u2 = await ev(`(() => { for (const u of app.units.units) { if (u.team !== 0 || u.type !== 'soldier' || u.dead) continue; const [sx, sy] = app.rts.worldToScreen(u.pos.x, u.pos.y + 0.9, u.pos.z, innerWidth, innerHeight); if (sx > 200 && sx < innerWidth - 300 && sy > 160 && sy < innerHeight - 120) return JSON.stringify({ sx, sy }); } return null; })()`).then(v => v && JSON.parse(v));
const synth = `(type, x, y, id = 1) => app.canvas.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y, bubbles: true, isPrimary: true }))`;
if (u2) { await ev('app.input.select([]); app.input.touch.doubleMs = 3000');   // each tap's pick readback stalls software GL for ~400 ms
  await ev(`(async () => { const pe = ${synth}, wait = (ms) => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 2; i++) { pe('pointerdown', ${u2.sx}, ${u2.sy}); await wait(40); window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', pointerId: 1, clientX: ${u2.sx}, clientY: ${u2.sy}, bubbles: true })); await wait(90); } })()`); await ev('app.input.touch.doubleMs = 400'); results.doubleTap = { selected: await ev('app.input.selected.length'), soldiersOnScreen: await ev(`app.units.units.filter(u => u.team === 0 && u.type === 'soldier' && !u.dead && !u.mounted && (() => { const [sx, sy] = app.rts.worldToScreen(u.pos.x, u.pos.y + 1, u.pos.z, innerWidth, innerHeight); return sx >= 0 && sx <= innerWidth && sy >= 0 && sy <= innerHeight; })()).length`) }; }

// 10. toolbar + manifest
await ev('app.hud.touchAction("box")'); results.toolbar = { boxArmed: await ev('app.input.touch.boxArmed'), boxClass: await ev('document.querySelector("[data-tb=box]").classList.contains("on")') }; await ev('app.hud.touchAction("box")');
results.manifest = await ev(`fetch('manifest.json').then(r => r.json()).then(m => m.name + ' icons=' + m.icons.length).catch(e => 'ERR ' + e.message)`);
results.icon = await ev(`fetch('icons/icon-192.png').then(r => r.status)`);
results.selinfo = await ev('document.getElementById("sel-d").textContent');
if (shot) { await ev('app.input.select([])'); await sleep(300); const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(shot, Buffer.from(s.result.data, 'base64')); results.screenshot = shot; }
console.log(JSON.stringify(results, null, 1));
if (errors.length) console.log('page errors:', errors.slice(0, 4));
ws.close(); chrome.kill();
