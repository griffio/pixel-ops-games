import { Roster, squadKind } from './roster.js';
import { icon, ring, mmss, BUILDS, buildKind, portrait } from './icons.js';
import { RULES } from '../game/rules.js';
const $ = (id) => document.getElementById(id);
const fmtTime = (h) => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
const fmtDur = (h) => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const deg = (r) => Math.round(r * 180 / Math.PI);
// 16x10 silhouettes for the unit tags
const ICON = {
  soldier: '<circle cx="3" cy="2.2" r="1.5"/><rect x="1.7" y="4" width="2.6" height="5.5"/><circle cx="8" cy="2.2" r="1.5"/><rect x="6.7" y="4" width="2.6" height="5.5"/><circle cx="13" cy="2.2" r="1.5"/><rect x="11.7" y="4" width="2.6" height="5.5"/>',
  truck: '<rect x="1" y="3.5" width="8" height="4.5"/><rect x="9" y="1.5" width="5.5" height="6.5"/><circle cx="4" cy="8.8" r="1.2"/><circle cx="12" cy="8.8" r="1.2"/>',
  apc: '<path d="M1 7.5 L3.5 3 H13 L15 7.5 Z"/><circle cx="3.5" cy="8.6" r="1.1"/><circle cx="6.8" cy="8.6" r="1.1"/><circle cx="10.2" cy="8.6" r="1.1"/><circle cx="13.5" cy="8.6" r="1.1"/>',
  tank: '<rect x="1" y="5" width="14" height="3" rx="1.5"/><rect x="4" y="2.5" width="6.5" height="2.5"/><rect x="10" y="3.2" width="6" height="1"/>',
  heli: '<rect x="0.5" y="1.6" width="7" height="0.9"/><rect x="8.5" y="0.6" width="7" height="0.9"/><rect x="1.5" y="4" width="13.5" height="3.6" rx="1.4"/><rect x="11" y="1.4" width="3" height="3"/><rect x="3.5" y="2.4" width="2" height="2"/><circle cx="4" cy="8.6" r="0.9"/><circle cx="12" cy="8.6" r="0.9"/>',
  cache: '<rect x="2" y="4" width="12" height="5"/><path d="M1 4 L8 1 L15 4 Z"/>',
  fob: '<rect x="7.4" y="0.5" width="1.2" height="9"/><path d="M4 3 L8 1 L12 3" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="7" width="12" height="2.5"/>',
  flag: '<rect x="3" y="0.5" width="1.2" height="9.5"/><path d="M4.2 1 L13 3.2 L4.2 5.6 Z"/>',
  skull: '<circle cx="8" cy="4" r="3.4"/><rect x="5.6" y="6.5" width="4.8" height="2.6"/><circle cx="6.6" cy="3.8" r="0.9" fill="#111"/><circle cx="9.4" cy="3.8" r="0.9" fill="#111"/>',
};
const ico = (k) => `<svg class="ico" viewBox="0 0 16 10">${ICON[k] || ''}</svg>`;
const SQUAD_NAME = { rifle: 'Rifle squad', support: 'Support squad', at: 'Anti-tank squad', medic: 'Medic squad', engineer: 'Engineer squad', marksman: 'Marksman squad' };
const picOf = (u) => u.squad ? squadKind(u.squad.members.map(m => m.kit))[0] : u.type === 'emplacement' ? u.gun : u.supply ? 'supply' : u.type === 'soldier' ? 'rifle' : u.type;
// a refusal from the game, cut to a word or two for a tile; the whole reason comes up when the tile is tapped
const SHORT = [[/already/, 'BUSY'], [/supply truck/, 'NO TRUCK'], [/FOB kits/, 'NO KITS'], [/one of your FOBs/, 'NEEDS FOB'], [/emplacements$/, 'FOB FULL'], [/enemy main base/, 'ENEMY BASE'], [/road/, 'ON ROAD'],
  [/too close|traps within/, 'TOO CLOSE'], [/no more than/, 'LIMIT'], [/steep|wet|no room/, 'NO ROOM'], [/squadmate/, 'ALONE'], [/ready in (\d+)/, (r) => r[1] + ' S'], [/enemy within/, 'ENEMY NEAR'], [/on foot/, 'ON FOOT'], [/free seat/, 'NO SEAT']];
const short = (why) => { for (const [re, out] of SHORT) { const r = why.match(re); if (r) return typeof out === 'function' ? out(r) : out; } return 'N/A'; };
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const BUILD_ACTS = ['fob', 'sandbags', 'traps', 'emp_hmg', 'emp_atgm', 'emp_mortar'];
const FOOT = { sandbags: 2.8, fob: 6, hmg: 2.4, atgm: 2.4, mortar: 2.4 };   // the ground a build takes, for its outline
const KIT_NAME = { rifle: 'rifle', mg: 'MG', at: 'AT', marksman: 'marksman', medic: 'rifle', engineer: 'rifle', autocannon: 'autocannon', doorgun: 'door gun', tankgun: '120 mm', coax: 'coax MG', hmg: 'HMG', atgm: 'ATGM', mortar: 'mortar', hydra: 'rockets', mk19: 'Mk 19', gau19: 'gatling' };
const TYPE_NAME = { apc: 'APC', humvee: 'Humvee', tank: 'tank', heli: 'Chinook', bird: 'Little Bird', truck: 'truck', craft: 'landing craft', emplacement: 'FOB gun' };   // vehicles in the debrief's weapon list


// HUD + control panel. Back-end hooks on app: pixel (settings), setShadows(on),
// drawCalls(), markers.add(x, z), rendererName, otherRenderer {name, param}.
export class Hud {
  constructor(app) {
    this.app = app; this.labelRoot = $('labels'); this.tags = new Map();
    this.paused = false; this.fpsAcc = 0; this.fpsN = 0; this.fps = 0;
    this.marks = new Map(); this.actAcc = 0; this.busy = null;
    this.bind(); this.roster = new Roster(app);
  }

  bind() {
    const a = this.app;
    for (const b of document.querySelectorAll('[data-spawn]')) b.addEventListener('click', () => {
      const k = b.dataset.spawn, um = a.units;
      if (k === 'squad') um.spawnSquad(); else if (k === 'many') for (let i = 0; i < 10; i++) um.spawnSquad();
      else if (k === 'clear') { a.input.select([]); um.clear(); } else um.spawn(k);
      this.toast(k === 'clear' ? 'Cleared' : `Spawned ${k}`);
    });
    const link = (id, vid, fn, fmt = (v) => v) => { const el = $(id); const upd = () => { $(vid).textContent = fmt(+el.value); fn(+el.value); }; el.addEventListener('input', upd); upd(); };
    link('c-tpu', 'v-tpu', v => { a.rts.baseTpu = v; });
    link('c-tspeed', 'v-tspeed', v => { a.world.timeSpeed = v; }, v => v + '×');
    link('c-hour', 'v-hour', v => { if (this.draggingHour) a.world.time = v % 24; }, v => fmtTime(v));
    $('c-hour').addEventListener('pointerdown', () => this.draggingHour = true);
    window.addEventListener('pointerup', () => this.draggingHour = false);
    $('c-pixel').addEventListener('change', e => a.pixel.enabled = e.target.checked);
    $('c-outline').addEventListener('change', e => a.pixel.outline = e.target.checked);
    $('c-shadow').addEventListener('change', e => a.setShadows(e.target.checked));
    if (a.fog) { $('c-fogshade').checked = a.fog.shade; $('c-fogshade').addEventListener('change', e => { a.fog.shade = e.target.checked; }); }
    $('c-auto').addEventListener('change', e => a.units.auto = e.target.checked);
    $('b-pause').addEventListener('click', () => this.togglePause());
    $('b-manual').addEventListener('click', () => { if (a.guide) a.guide.toggle(); });
    $('b-dev').addEventListener('click', () => this.toggleDev());
    if (a.guide) { $('c-hints').checked = a.guide.store.hints; $('c-hints').addEventListener('change', e => a.guide.setHints(e.target.checked)); }
    if (a.rings && $('c-rings')) {   // capture rings round the locations (gl/rings.js), remembered in the browser
      let on = true; try { on = localStorage.getItem('pixelops.rings') !== '0'; } catch {}
      a.rings.on = on; $('c-rings').checked = on;
      $('c-rings').addEventListener('change', e => { a.rings.on = e.target.checked; try { localStorage.setItem('pixelops.rings', e.target.checked ? '1' : '0'); } catch {} });
    }
    // the touch toolbar (top left): box select, pause, the camera to base, the manual, sound, the engine panels
    const TB = { box: ['box', 'Box'], pause: ['pause', ''], base: ['base', ''], help: ['help', ''], sound: ['sound', ''], dev: ['gear', ''] };
    for (const b of document.querySelectorAll('[data-tb]')) { const t = TB[b.dataset.tb]; if (t) b.innerHTML = icon(t[0]) + (t[1] ? `<span>${t[1]}</span>` : ''); b.addEventListener('click', () => this.touchAction(b.dataset.tb)); }
    $('btoast').addEventListener('click', e => { if (e.target.closest('button') && this.busy) this.cancelBuild(this.busy.eng); });
    $('c-sound').addEventListener('change', e => { if (a.audio) { a.audio.setEnabled(e.target.checked); this.syncSound(); } });
    $('c-vol').addEventListener('input', e => { if (a.audio) { a.audio.setVolume(+e.target.value / 100); this.syncSound(); } });
    setTimeout(() => this.syncSound(), 0);
    $('b-reset').addEventListener('click', () => a.rts.reset());
    // renderer switch keeps the rest of the URL (view params) intact
    $('s-renderer').textContent = a.rendererName;
    const sw = $('r-switch'); sw.textContent = `switch to ${a.otherRenderer.name}`;
    const q = new URLSearchParams(location.search); a.otherRenderer.param ? q.set('r', a.otherRenderer.param) : q.delete('r');
    if (a.otherRenderer.param === 'three') q.set('sandbox', '1');
    sw.href = '?' + q.toString();
    // sync panel with URL-provided state
    $('c-tpu').value = a.rts.baseTpu; $('v-tpu').textContent = a.rts.baseTpu;
    $('c-pixel').checked = a.pixel.enabled;
    if (!a.world.map) { $('minimap').style.display = 'none'; $('objs').style.display = 'none'; $('reinf-h').style.display = 'none'; $('reinf').style.display = 'none'; }
  }

  updateMatch(m) {
    const [t0, t1] = m.teams;
    $('m-t0').textContent = Math.max(0, Math.round(t0.tickets)); $('m-t1').textContent = Math.max(0, Math.round(t1.tickets));
    const s = Math.max(0, Math.ceil(m.time)); $('m-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (!this.modeShown) {
      this.modeShown = true; document.querySelector('#match .small').textContent = m.mode.constructor.name + (m.mode.constructor.sides ? (m.mode.attacker === (this.app.playerTeam ?? 0) ? ' · attacking' : ' · defending') : '') + (m.cpu && m.cpu.length === 1 ? ` · ${m.difficulty.name} CPU` : '');
      document.querySelector('#match .t0 .nm').innerHTML = `BLUFOR<br><em>${t0.doctrine.name}</em>`; document.querySelector('#match .t1 .nm').innerHTML = `OPFOR<br><em>${t1.doctrine.name}</em>`;
      for (const id of ['minimap', 'objs', 'match', 'reinf-h', 'reinf']) $(id).style.display = ''; this.mmHidden = false;
      this.roster.setupSpawnPref(m.teams[this.app.playerTeam ?? 0]); document.body.classList.add('match');   // the respawn choice lives on the unit strip
    }

    // under fog of war the enemy's own news stays theirs: its commander's radio, its FOB going up, its digging in
    const a = this.app, hush = a.fog && a.fog.on ? (f) => f.kind === 'event' && f.e.team !== (a.playerTeam ?? 0) && (f.e.type === 'radio' || f.e.type === 'fob' || f.e.type === 'sandbags' || f.e.type === 'traps' || f.e.type === 'emplacement') : () => false;
    const feed = $('feed'), lines = m.feed.filter(f => f.t < 10 && !hush(f)), key = lines.map(f => f.id).join(',');
    if (key !== this.feedKey) { this.feedKey = key; feed.innerHTML = lines.map(f => this.feedLine(f)).join(''); }
    lines.forEach((f, i) => { const el = feed.children[i]; if (el) el.style.opacity = f.t > 7 ? ((10 - f.t) / 3).toFixed(2) : 1; });
    // objectives bar from the mode
    const objs = $('objs'), items = m.mode.bar();
    if (objs.childElementCount !== items.length) objs.innerHTML = items.map(l => `<div class="obj"><b>${l.name}</b><span></span><i></i></div>`).join('');
    items.forEach((l, i) => {
      const el = objs.children[i], p = l.progress;
      el.className = 'obj' + (l.owner === 0 ? ' t0' : l.owner === 1 ? ' t1' : '');
      el.children[1].textContent = l.note;
      const bar = el.children[2]; bar.style.width = Math.abs(p) + '%'; bar.className = p < 0 ? 't1' : '';
    });
    // reinforcements for the player's team
    const me = this.app.playerTeam ?? 0, q = m.respawn.queue.filter(x => x.unit.team === me).sort((a, b) => a.t - b.t).slice(0, 6);
    const fobs = m.fobs.active(me).length, kits = m.fobs.kitsLeft(me), build = m.fobs.builds.find(b => b.team === me);
    const L = m.teams[me].landing, ls = L && L.status();   // a side on a ship: what waits in its well dock, how many craft are out
    $('reinf').innerHTML = (ls ? `<div>Ship: ${ls.waiting} men${ls.vehicles ? `, ${ls.vehicles} vehicles` : ''} waiting · craft ${ls.out}/${ls.craft} out</div>` : '') + `<div>FOBs ${fobs} · kits ${kits}${build ? ` · building ${Math.ceil(build.t)}s` : ''}</div>` + (q.length ? q.map(x => { const r = m.rallies && m.respawn.rallyFor(x.unit, m.teams[me]); return `<div><b>${x.unit.label}</b> ${x.unit.type} ${r ? 'rally ' + Math.ceil(m.rallies.nextWaveIn(r)) : Math.max(0, Math.ceil(x.t))}s</div>`; }).join('') : '<div>all units deployed</div>');
    this.drawMinimap(m);
  }

  feedLine(f) {
    if (f.kind === 'kill') {
      const k = f.k, v = f.v, kit = k && k.kit ? KIT_NAME[k.firedKit || k.kit] || k.firedKit || k.kit : '';
      return `<div class="kill${v.type !== 'soldier' ? ' veh' : ''}"><b class="t${k ? k.team : 0}">${k ? k.label : '?'}</b><span class="w">${kit}</span>${ico(v.type === 'soldier' ? 'skull' : v.type)}<b class="t${v.team}">${v.label}</b></div>`;
    }
    const e = f.e, team = e.team, name = team === 0 ? 'BLUFOR' : 'OPFOR', loc = e.loc ? e.loc.name : '';
    const text = e.type === 'captured' ? `captured <b>${loc}</b>` : e.type === 'lost' ? `lost <b>${loc}</b>` : e.type === 'fob' ? 'FOB is up' : e.type === 'building' ? 'brought a building down' : e.type === 'sandbags' ? 'dug in behind sandbags' : e.type === 'emplacement' ? `set up ${{ hmg: 'a heavy machine gun', atgm: 'an anti-tank launcher', mortar: 'a mortar' }[e.gun] || 'an emplacement'} <b>${e.label || ''}</b>` : e.type === 'traps' ? 'laid tank traps' : e.type === 'traps cleared' ? 'cleared tank traps' : e.type === 'sandbags cleared' ? 'cleared a sandbag position' : e.type === 'rally lost' ? `lost rally point <b>${e.rally || ''}</b>` : e.type === 'radio' ? `<i>${String(e.text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</i>` : e.type === 'cache revealed' ? `found the cache at <b>${loc}</b>` : e.type === 'cache destroyed' ? `destroyed the cache at <b>${loc}</b>` : e.type;
    return `<div class="ev">${ico(e.type === 'fob' ? 'fob' : e.type.startsWith('cache') ? 'cache' : 'flag')}<b class="t${team}">${name}</b> ${text}</div>`;
  }

  // ---- minimap: cached terrain, then zones, units and the camera footprint. North (+z) is up and +x is to the LEFT: the
  // world as the camera draws it seen from above (facing north, +x is on screen-left), so panning and the map agree
  minimapBackground(map) {
    const S = 220, bg = document.createElement('canvas'); bg.width = bg.height = S; const g = bg.getContext('2d');
    const splat = document.createElement('canvas'); splat.width = splat.height = S; map.paintSplat(splat.getContext('2d'), S, map.size / 2);
    const sp = splat.getContext('2d').getImageData(0, 0, S, S).data, out = g.createImageData(S, S), o = out.data;
    const TONE = { sand: [196, 176, 136], concrete: [182, 176, 164], asphalt: [91, 91, 93], grass: [138, 138, 88], meadow: [108, 138, 68], dirt: [163, 142, 102] };   // each ground tile's average colour
    const sand = TONE[map.ground.base] || TONE.sand, tiles = map.ground.tiles.map(t => TONE[t] || TONE.sand);
    for (let i = 0; i < S * S; i++) {
      const j = i - (i % S) + (S - 1 - (i % S));   // the splat is painted with +x to the right: read it mirrored
      const w = [sp[j * 4] / 255, sp[j * 4 + 1] / 255, sp[j * 4 + 2] / 255, sp[j * 4 + 3] / 255], rest = Math.max(0, 1 - w[0] - w[1] - w[2] - w[3]);
      for (let c = 0; c < 3; c++) o[i * 4 + c] = sand[c] * rest + tiles[0][c] * w[0] + tiles[1][c] * w[1] + tiles[2][c] * w[2] + tiles[3][c] * w[3];
      o[i * 4 + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    // hillshade from the terrain
    const T = this.app.world.terrain;
    if (T) {
      const img = g.getImageData(0, 0, S, S), d = img.data;
      for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
        const x = map.size / 2 - px / S * map.size, z = map.size / 2 - py / S * map.size, nn = T.normal(x, z), i = (py * S + px) * 4;
        if (T.height(x, z) < T.water) { d[i] = 52; d[i + 1] = 92; d[i + 2] = 112; continue; }
        const shade = 0.72 + 0.55 * Math.max(0, nn[0] * -0.5 + nn[1] * 0.75 + nn[2] * 0.45);
        d[i] = Math.min(255, d[i] * shade); d[i + 1] = Math.min(255, d[i + 1] * shade); d[i + 2] = Math.min(255, d[i + 2] * shade);
      }
      g.putImageData(img, 0, 0);
    }

    const k = S / map.size, X = (x) => (map.size / 2 - x) * k, Z = (z) => (map.size / 2 - z) * k;
    const line = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); g.moveTo(X(pts[0][0]), Z(pts[0][1])); for (const p of pts.slice(1)) g.lineTo(X(p[0]), Z(p[1])); g.stroke(); };
    for (const t of map.tracks || []) line(t, 1.5, '#8a7450');
    for (const r of map.roads || []) if (r.kind === 'track') line(r.points, 1.5, '#8a7450');
    if (map.roadPath) line(map.roadPath, 2.5, '#4a4a4c');
    for (const r of map.roads || []) if (r.kind !== 'track') line(r.points, r.width >= 10 ? 2.5 : 2, '#4a4a4c');
    this.mmX = X; this.mmZ = Z; this.mmK = k;
    return bg;
  }
  drawMinimap(m) {
    const a = this.app, map = a.world.map; if (!map) return;
    const cv = $('minimap'), g = cv.getContext('2d');
    if (!this.mmBg) {
      this.mmBg = this.minimapBackground(map);
      const toWorld = (e) => { const r = cv.getBoundingClientRect(); return [map.size / 2 - (e.clientX - r.left) / r.width * map.size, map.size / 2 - (e.clientY - r.top) / r.height * map.size]; };
      let down = false;
      cv.addEventListener('pointerdown', e => { down = true; const [x, z] = toWorld(e); a.rts.target.set(x, 0, z); a.rts.follow = null; e.preventDefault(); });
      window.addEventListener('pointermove', e => { if (down) { const [x, z] = toWorld(e); a.rts.target.set(x, 0, z); } });
      window.addEventListener('pointerup', () => down = false);
    }
    g.drawImage(this.mmBg, 0, 0);
    const X = this.mmX, Z = this.mmZ, k = this.mmK, me = a.playerTeam ?? 0;
    for (const b of m.teams) { g.strokeStyle = b.id === 0 ? '#7fb2e5' : '#e86a5a'; g.lineWidth = 1; g.beginPath(); g.arc(X(b.base.x), Z(b.base.z), b.base.r * k, 0, Math.PI * 2); g.stroke(); }
    // fog of war: unseen ground shaded, enemies out of sight left off, last-known positions as red diamonds
    const fog = a.fog, ov = fog && fog.minimap();
    if (ov) { const V = m.vision, ext = V.n * V.cell; g.imageSmoothingEnabled = true; g.save(); g.translate(X(-V.half), Z(-V.half + ext)); g.scale(-1, 1); g.drawImage(ov, 0, 0, ext * k, ext * k); g.restore(); }   // the overlay has +x to the right: drawn mirrored
    m.mode.drawMinimap(g, X, Z, k);
    if (fog) { g.strokeStyle = 'rgba(255,138,122,0.8)'; g.lineWidth = 1; for (const gh of fog.ghosts()) { const x = X(gh.x), z = Z(gh.z), r = gh.type === 'soldier' ? 2 : 3; g.beginPath(); g.moveTo(x, z - r); g.lineTo(x + r, z); g.lineTo(x, z + r); g.lineTo(x - r, z); g.closePath(); g.stroke(); } }
    for (const u of a.units.units) {
      if (u.dead || u.mounted || (fog && !fog.sees(u))) continue;
      g.fillStyle = u.team === me ? '#9fd0ff' : '#ff8a7a';
      if (u.type === 'fob') { g.strokeStyle = g.fillStyle; g.lineWidth = 1.5; g.strokeRect(X(u.pos.x) - 3, Z(u.pos.z) - 3, 6, 6); continue; }
      if (u.type === 'rally') { g.strokeStyle = g.fillStyle; g.lineWidth = 1.2; const x = X(u.pos.x), z = Z(u.pos.z); g.beginPath(); g.moveTo(x, z - 3.5); g.lineTo(x + 3, z + 2); g.lineTo(x - 3, z + 2); g.closePath(); g.stroke(); continue; }
      if (u.type === 'traps') { g.strokeStyle = g.fillStyle; g.lineWidth = 1.2; const x = X(u.pos.x), z = Z(u.pos.z); g.beginPath(); g.moveTo(x - 2.5, z - 2.5); g.lineTo(x + 2.5, z + 2.5); g.moveTo(x + 2.5, z - 2.5); g.lineTo(x - 2.5, z + 2.5); g.stroke(); continue; }   // tank traps
      if (u.type === 'sandbags') continue;
      const s = u.type === 'soldier' ? 2 : 3; g.fillRect(X(u.pos.x) - s / 2, Z(u.pos.z) - s / 2, s, s);
    }
    // camera footprint
    g.strokeStyle = 'rgba(242,193,78,0.9)'; g.lineWidth = 1; g.beginPath();
    [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([sx, sy], i) => { const p = a.rts.screenToGround(sx, sy); i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z)); });
    g.closePath(); g.stroke();
  }
  // ---- debrief: ticket graph and a stats table per team
  showEnd(m) {
    const me = this.app.playerTeam ?? 0, won = m.winner !== null && m.winner.id === me;
    $('end-h').textContent = m.winner === null ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
    const mins = Math.floor(m.elapsed / 60), secs = String(Math.floor(m.elapsed % 60)).padStart(2, '0');
    $('end-d').textContent = `${m.mode.constructor.name} · ${m.reason} · ${mins}:${secs} played`;
    this.drawTickets(m, $('end-graph'));
    const [a, b] = m.teams, S = (t, k) => t.stats.kills[k] || 0, L = (t, k) => t.stats.losses[k] || 0, VEHS = ['truck', 'apc', 'humvee', 'tank', 'heli', 'bird'];
    const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);
    const rows = [
      ['Tickets left', Math.max(0, Math.round(a.tickets)), Math.max(0, Math.round(b.tickets))],
      ['Net tickets', (() => { const v = Math.round(a.tickets - m.mode.tickets(0)); return (v >= 0 ? '+' : '') + v; })(), (() => { const v = Math.round(b.tickets - m.mode.tickets(1)); return (v >= 0 ? '+' : '') + v; })()],
      ['Kills', sum(a.stats.kills), sum(b.stats.kills)],
      ['Infantry lost', L(a, 'soldier'), L(b, 'soldier')],
      ['Vehicles lost', VEHS.reduce((n, k) => n + L(a, k), 0), VEHS.reduce((n, k) => n + L(b, k), 0)],
      ['Vehicles killed', VEHS.reduce((n, k) => n + S(a, k), 0), VEHS.reduce((n, k) => n + S(b, k), 0)],
      ['Captures', a.stats.captures, b.stats.captures],
      ['Locations lost', a.stats.lost, b.stats.lost],
      ['FOBs built / lost', `${a.stats.fobs} / ${a.stats.fobsLost}`, `${b.stats.fobs} / ${b.stats.fobsLost}`],
    ];
    if (a.stats.caches || b.stats.caches) rows.push(['Caches destroyed', a.stats.caches, b.stats.caches]);
    if (a.stats.buildings || b.stats.buildings) rows.push(['Buildings brought down', a.stats.buildings, b.stats.buildings]);
    if (L(a, 'craft') || L(b, 'craft')) rows.push(['Landing craft sunk', L(a, 'craft'), L(b, 'craft')]);
    // what did the killing: the three deadliest weapons of each side, and the unit with the most kills
    const WEAPON = (k) => KIT_NAME[k] || TYPE_NAME[k] || k, top = (t) => Object.entries(t.stats.killsBy || {}).sort((p, q) => q[1] - p[1]).slice(0, 3).map(([k, n]) => `${WEAPON(k)} ${n}`).join(' · ') || '–';
    const ace = (t) => { const e = Object.entries(t.stats.killsByUnit || {}).sort((p, q) => q[1] - p[1])[0]; return e ? `${e[0]} · ${e[1]}` : '–'; };
    rows.push(['Deadliest weapons', top(a), top(b)], ['Deadliest unit', ace(a), ace(b)]);
    $('end-stats').innerHTML = `<table><tr><th></th><th class="t0">BLUFOR<em>${a.loadoutName} · ${a.doctrine.name}</em></th><th class="t1">OPFOR<em>${b.loadoutName} · ${b.doctrine.name}${m.cpu.includes(1) ? ' · ' + m.difficulty.name : ''}</em></th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>`;
    $('end').style.display = 'block';
    $('end-again').onclick = () => location.reload();
    $('end-lobby').onclick = () => { location.href = location.pathname; };
    if (this.app.audio) this.app.audio.ui(m.winner === null ? 'lose' : won ? 'win' : 'lose');
    if (m.voices) m.voices.end(won);
  }
  drawTickets(m, cv) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, h = m.history, pl = 34, pr = 10, pt = 12, pb = 22;
    g.clearRect(0, 0, W, H); if (h.length < 2) return;
    const tMax = Math.max(60, h[h.length - 1][0]), yMax = Math.max(50, ...h.map(p => Math.max(p[1], p[2])));
    const X = (t) => pl + (t / tMax) * (W - pl - pr), Y = (v) => pt + (1 - v / yMax) * (H - pt - pb);
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.fillStyle = '#9a958a'; g.font = '9px Menlo, monospace'; g.textAlign = 'right';
    for (let i = 0; i <= 4; i++) { const v = Math.round(yMax * i / 4), y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(pl, y); g.lineTo(W - pr, y); g.stroke(); g.fillText(v, pl - 4, y + 3); }
    g.textAlign = 'center';
    for (let t = 0; t <= tMax; t += tMax > 900 ? 300 : 120) { const x = Math.round(X(t)) + 0.5; g.beginPath(); g.moveTo(x, pt); g.lineTo(x, H - pb); g.stroke(); g.fillText(Math.round(t / 60) + 'm', x, H - 8); }
    [['#7fb2e5', 1], ['#e86a5a', 2]].forEach(([col, i]) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); h.forEach((p, k) => k ? g.lineTo(X(p[0]), Y(p[i])) : g.moveTo(X(p[0]), Y(p[i]))); g.stroke(); });
    g.fillStyle = '#9a958a'; g.textAlign = 'left'; g.fillText('tickets', pl + 4, pt + 8);
  }

  togglePause() { this.setPaused(!this.paused); }
  setPaused(on, quiet = false) {   // quiet: the field manual pausing behind itself, no toast
    this.paused = on; $('b-pause').textContent = this.paused ? 'Resume' : 'Pause'; if (!quiet) this.toast(this.paused ? 'Paused' : 'Running');
    const tb = document.querySelector('[data-tb=pause]'); if (tb) { tb.innerHTML = icon(this.paused ? 'play' : 'pause'); tb.title = this.paused ? 'Resume' : 'Pause'; tb.classList.toggle('on', this.paused); }
  }
  // the touch toolbar's buttons, and Follow and Clear from the command bar
  touchAction(k) {
    const a = this.app, inp = a.input, t = inp.touch;
    if (k === 'box') { t.boxArmed = !t.boxArmed; this.syncTouchbar(); this.toast(t.boxArmed ? 'Drag a box to select' : 'Box select off'); }
    else if (k === 'clear') { inp.select([]); this.toast('Selection cleared'); }
    else if (k === 'follow') { a.rts.follow = inp.selected[0] || null; this.toast(a.rts.follow ? 'Following ' + a.rts.follow.label : 'Select a unit to follow'); }
    else if (k === 'pause') this.togglePause();
    else if (k === 'help') { if (this.app.guide) this.app.guide.toggle(); }
    else if (k === 'base') { const b = a.match && a.match.teams[a.playerTeam ?? 0].base; if (b) { a.rts.target.set(b.x, 0, b.z); a.rts.follow = null; } else a.rts.reset(); }
    else if (k === 'dev') this.toggleDev();
    else if (k === 'sound') this.toggleSound();
  }
  // the engine panels (stats, spawning, render and world settings): hidden in a match until wanted (Engine, F3, the gear on touch)
  toggleDev() {
    const on = document.body.classList.toggle('dev');
    if (this.app.lobby) this.app.lobby.renderOpponent();   // the lobby offers the Claude commanders only with them on
    this.toast(on ? 'Engine panels shown (F3 hides them)' : 'Engine panels hidden (F3 shows them)');
  }
  toggleSound() { const au = this.app.audio; if (!au) return; au.resume(); au.setEnabled(!au.enabled); this.syncSound(); this.toast(au.enabled ? 'Sound on' : 'Sound off'); }
  syncSound() {
    const au = this.app.audio; if (!au) return;
    $('c-sound').checked = au.enabled; $('c-vol').value = Math.round(au.volume * 100); $('v-vol').textContent = Math.round(au.volume * 100) + '%';
    const tb = document.querySelector('[data-tb=sound]'); if (tb) { tb.innerHTML = icon(au.enabled ? 'sound' : 'mute'); tb.title = au.enabled ? 'Sound on' : 'Sound off'; }
  }
  syncTouchbar() { const b = document.querySelector('[data-tb=box]'); if (b) b.classList.toggle('on', !!this.app.input?.touch?.boxArmed); }
  toast(msg) { const t = $('toast'); t.textContent = msg; t.style.opacity = 1; clearTimeout(this.tt); this.tt = setTimeout(() => t.style.opacity = 0, 1400); }

  showSelection(list) {
    const el = $('selinfo'); document.body.classList.toggle('sel', list.length > 0);   // the key help hides and the dock drops into its place
    if (this.roster) this.roster.refresh();
    if (!list.length) { el.style.display = 'none'; this.actHtml = null; return; }
    el.style.display = 'flex';
    const types = {}; for (const u of list) types[u.type] = (types[u.type] || 0) + 1;
    const desc = Object.entries(types).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`).join(', ');
    const sqs = new Set(list.map(u => u.squad || u)), one = sqs.size === 1 && list[0].squad;
    $('sel-n').textContent = one ? `${list[0].label} · ${SQUAD_NAME[squadKind(list[0].squad.members.map(u => u.kit))[0]]}` : list.length === 1 ? list[0].label : `${list.length} UNITS`;
    const how = this.app.touch ? 'tap the ground to move · tap an enemy to attack' : 'right-click to move · F to follow';
    const GUN = { hmg: 'heavy machine gun', atgm: 'anti-tank launcher', mortar: 'mortar' };
    $('sel-d').textContent = one ? `${list.length}/${list[0].squad.members.length} men${list.some(u => u.post) ? ` · manning ${list.find(u => u.post).post.sb.label}` : ''} · ${this.app.touch ? 'tap the ground to move' : 'right-click to move'}`
      : list.length === 1 && list[0].spec.structure && list[0].type !== 'emplacement' ? this.structureText(list[0])
      : list.length === 1 && list[0].type === 'emplacement'
      ? `${GUN[list[0].gun] || 'emplacement'} · ${list[0].crewAt(0) ? 'manned' : `no gunner: ${this.app.touch ? 'tap' : 'right-click'} it with soldiers selected`} · ${Math.round(100 * list[0].hp / list[0].maxHp)}%`
      : list.length === 1
      ? `${list[0].type} · ${list[0].post ? `manning ${list[0].post.sb.label}${list[0].post.settled ? '' : ' (on the way)'}` : list[0].spec.air ? list[0].state : (list[0].target ? 'moving' : 'idle')}${list[0].seats ? ` · ${list[0].passengers.length}/${list[0].seats} aboard` : ''}${list[0].crew ? ` · ${list[0].crew.length - list[0].freeSlots}/${list[0].crew.length} manned` : ''} · ${how}`
      : desc + (list.some(u => u.post) ? ` · ${list.filter(u => u.post).length} manning sandbags` : '') + (this.app.touch ? ' · tap the ground to move in formation' : ' · right-click to move in formation');
    $('sel-th').innerHTML = this.app.match ? `<img src="${portrait(picOf(list[0]))}" alt="" onerror="this.remove()">` : '';
    this.actHtml = null; this.renderActions(list);
  }
  // what a structure is for: it never moves, so it gets no "moving" and no move hint
  structureText(u) {
    const m = this.app.match, hp = `${Math.round(100 * u.hp / u.maxHp)}%`, tap = this.app.touch ? 'tap' : 'right-click';
    if (u.type === 'fob') return `forward operating base · every squad can respawn here · ${m ? `${m.fobs.emplacementsAt(u)}/${RULES.emplacement.perFob} guns · ` : ''}${hp}`;
    if (u.type === 'sandbags') return `sandbag position · ${u.crew.length - u.freeSlots}/${u.crew.length} manned · ${tap} it with soldiers selected to man it · an engineer at it clears it`;
    if (u.type === 'traps') return 'tank traps · no vehicle gets past, ours included · an engineer at the row clears them';
    if (u.type === 'rally') return `rally point${u.rallyOf ? ' of ' + u.rallyOf.members[0].label : ''} · ${m && m.rallies && m.rallies.covered(u) ? `enemy armour within ${RULES.rally.armourRadius} m: its men come back at the next spawn until it leaves` : `its men come back here every ${RULES.rally.wave} s${m && m.rallies ? ` · next in ${Math.ceil(m.rallies.nextWaveIn(u))} s` : ''}`}`;
    return `${u.type} · ${hp}`;
  }
  // the command bar: the selection's orders, then what its engineer can build (each with its supply cost), the build under
  // way counting down and Cancel. A tile that can't be used says why in a word; tapping it gives the whole reason.
  renderActions(list) {
    const m = this.app.match, box = $('sel-actions');
    if (!m) { box.innerHTML = ''; this.actHtml = null; return; }
    const me = this.app.playerTeam ?? 0, inp = this.app.input, U = this.app.units.units;
    const orders = list.some(u => !u.spec.structure) ? [{ act: 'follow', glyph: 'follow', name: 'Follow', key: 'F', on: list.includes(this.app.rts.follow), title: 'Keep the camera on it' }] : [];   // nothing to follow on a FOB
    if (list.some(u => !u.spec.structure && !u.dead && u.team === me)) orders.push({ act: 'advance', glyph: 'advance', name: inp && inp.advancing ? 'Pick ground' : 'Advance', key: 'Z', on: inp && inp.advancing, title: inp && inp.advancing ? `${this.app.touch ? 'Tap' : 'Click'} the ground to attack-move there` : `Attack-move: infantry stop and fight whatever comes into range on the way, lifting hold fire (Z, then ${this.app.touch ? 'tap' : 'click'} the ground${this.app.touch ? '' : '; or Alt + right-click'})` });
    const men = list.filter(u => u.type === 'soldier' && !u.dead && !u.mounted && u.team === me);
    if (men.length) { const on = men.every(u => u.holdFire); orders.push({ act: 'holdfire', glyph: 'holdfire', name: on ? 'Holding fire' : 'Hold fire', key: 'O', on, title: on ? 'Fire at will' : 'Hold fire: the squad stays quiet and hidden, no target and no shot, until an enemy comes within 20 m or it is fired on, then opens up; an attack-move under way becomes a plain move' }); }
    const sqs = [...new Set(list.filter(u => u.type === 'soldier' && u.squad && u.team === me).map(u => u.squad))];
    if (sqs.length && m.rallies) { const c = sqs.map(sq => m.rallies.canPlace(sq)), ok = c.some(x => x.ok), why = c.find(x => !x.ok); orders.push({ act: 'rally', glyph: 'rally', name: 'Rally', key: 'T', why: ok ? null : why.reason, title: 'Drop a rally point: the squad respawns here' }); }
    if (list.some(u => u.type === 'soldier' && !u.dead && !u.mounted && u.team === me)) {
      const room = U.some(v => v.seats && v.team === me && !v.dead && v.passengers.length < v.seats);
      orders.push({ act: 'load', glyph: 'load', name: inp && inp.loading ? 'Pick one' : 'Load', key: 'L', on: inp && inp.loading, why: room ? null : 'No vehicle with a free seat', title: inp && inp.loading ? `${this.app.touch ? 'Tap' : 'Click'} a vehicle to board it, or Load again to cancel` : 'Board a vehicle' });
    }
    const car = list.find(u => u.seats && !u.dead && u.passengers.length), flying = (u) => u.spec.air && !u.spec.noLand && !u.dead && u.state !== 'parked' && u.state !== 'spooldown';
    if (car) orders.push({ act: 'unload', glyph: 'unload', name: `${flying(car) ? 'Land' : 'Unload'} ${car.passengers.length}`, key: 'U', title: flying(car) ? 'Land and let them out' : 'Let them out' });   // a helicopter in the air lands first
    else if (list.some(flying)) orders.push({ act: 'unload', glyph: 'unload', name: 'Land', key: 'U', title: 'Land here' });
    else if (list.some(u => u.post && !u.dead)) orders.push({ act: 'unload', glyph: 'unload', name: 'Leave', key: 'U', title: 'Leave the position' });
    const trucks = list.filter(u => u.supply && !u.dead && u.team === me);   // supply trucks: home to refill, then back
    if (trucks.length) { const going = trucks.some(t => t.refillHome); orders.push({ act: 'refill', glyph: 'sup', name: going ? 'Refilling' : 'Refill', key: 'V', on: going, why: !going && trucks.every(t => t.supplies >= RULES.fob.truckSupplies) ? 'Full' : null, title: 'Drive home to refill, then come back here' }); }
    orders.push({ act: 'clear', glyph: 'clear', name: 'Deselect', key: 'Esc', title: 'Clear the selection' });
    let html = `<div class="grp"><h6>Orders</h6><div class="tiles">${orders.map(t => this.tile(t)).join('')}</div></div>`;
    const eng = list.find(u => u.kit === 'engineer' && !u.dead);
    if (eng) {
      const b = eng.building, bk = b && buildKind(b), F = m.fobs, R = RULES;
      const cl = F.canClear(eng), traps = cl.ok && !b ? ['clear', cl, 0] : ['traps', F.canBuildTraps(eng), R.traps.supplyCost];
      const items = [['sandbags', F.canBuildSandbags(eng), R.sandbags.supplyCost, R.sandbags.buildTime], ['fob', F.canBuild(eng), R.fob.supplyCost, R.fob.buildTime], [...traps, R.traps.buildTime],
        ...['hmg', 'atgm', 'mortar'].map(g => [g, F.canBuildEmplacement(eng, g), R.emplacement[g].supplyCost, R.emplacement[g].buildTime])];
      const tiles = items.map(([k, c, cost, time]) => {
        const B = k === 'clear' && cl.sandbags ? { ...BUILDS.clear, name: 'Clearing sandbags', say: 'clearing the sandbag position' } : BUILDS[k], t = { act: B.act, pic: B.pic, name: B.short || B.name, key: B.key, cost, title: `${B.name}${cost ? `: ${cost} supplies` : ''}${time ? `, about ${Math.round(time * (k === 'traps' || k === 'clear' ? 1 : (m.teams[eng.team].doctrine || {}).fobBuild || 1))} s` : ''}` };
        if (b) return { ...t, state: bk === k || (bk === 'clear' && k === 'traps') ? 'act' : 'busy' };
        return c.ok ? t : { ...t, state: 'off', why: c.reason };
      });
      if (b) tiles.push({ act: 'cancel', glyph: 'clear', name: 'Cancel', key: 'C', cls: 'cancel', title: `Stop ${BUILDS[bk].say}` });
      const truck = U.filter(t => t.supply && !t.dead && t.team === eng.team && Math.hypot(t.pos.x - eng.pos.x, t.pos.z - eng.pos.z) <= R.fob.buildRange).sort((x, y) => y.supplies - x.supplies)[0];
      const head = truck ? `${icon('sup')}${truck.label} ${Math.round(truck.supplies)} <i><b style="width:${Math.round(truck.supplies)}%"></b></i>` : `no supply truck within ${R.fob.buildRange} m`;
      html += `<div class="vr"></div><div class="grp"><h6>Build <em>${head} · FOB kits ${F.kitsLeft(eng.team)}</em></h6><div class="tiles">${tiles.map(t => this.tile(t)).join('')}</div></div>`;
    }
    if (html !== this.actHtml) { this.actHtml = html; box.innerHTML = html; }
    box.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.why) { this.toast(b.dataset.why); if (this.app.audio) this.app.audio.ui('deny'); return; } this.action(b.dataset.act); };
    this.tickActions(list);
  }
  tile(t) {
    const face = t.pic ? `<span class="pi"><img src="${portrait(t.pic)}" alt=""></span>` : icon(t.glyph);
    const flag = t.state === 'busy' ? '<span class="flag">BUSY</span>' : t.state === 'off' ? `<span class="flag">${short(t.why)}</span>` : '';
    const live = t.state === 'act' ? '<span class="tm"></span><span class="fill"></span>' : '';
    return `<button class="tile${t.state ? ' ' + t.state : ''}${t.cls ? ' ' + t.cls : ''}${t.on ? ' on' : ''}" data-act="${t.act}"${t.why ? ` data-why="${esc(t.why)}"` : ''} title="${esc(t.why || t.title || t.name)}">${face}<span class="nm">${t.name}</span>${this.app.touch ? '' : `<span class="key">${t.key}</span>`}${t.cost ? `<span class="cost">${t.cost}</span>` : ''}${flag}${live}</button>`;
  }
  // the parts of the command bar that change every frame: the build countdown and its bar, and the line under the name
  tickActions(list) {
    const eng = list.find(u => u.kit === 'engineer' && !u.dead && u.building), b = eng && eng.building, act = $('sel-actions').querySelector('.tile.act');
    if (act && b) { act.querySelector('.tm').textContent = mmss(b.t); act.querySelector('.fill').style.width = `${Math.round(100 * (1 - b.t / b.total))}%`; }
    const line = b ? `${BUILDS[buildKind(b)].say[0].toUpperCase()}${BUILDS[buildKind(b)].say.slice(1)} · ${mmss(b.t)}` : '';
    const el = $('sel-b'); if (el.textContent !== line) el.textContent = line;
  }
  // a build button pressed while the engineer is busy: what he is doing, how long is left, and a way to stop it
  busyToast(eng) {
    const b = eng.building, B = BUILDS[buildKind(b)], who = eng.squad ? eng.squad.members[0].label : eng.label;
    this.busy = { eng, until: performance.now() + 4000 }; $('toast').style.opacity = 0;
    const el = $('btoast'); el.style.display = 'flex';
    el.innerHTML = `${ring(1 - b.t / b.total, B.glyph, 30)}<span><b>${who} is ${B.say}</b> · ready in <em>${Math.ceil(b.t)}</em> s. Cancel to start something else.</span><button type="button">Cancel</button>`;
    if (this.app.audio) this.app.audio.ui('deny');
  }
  tickBusy() {
    const bz = this.busy; if (!bz) return;
    const b = bz.eng.building, el = $('btoast');
    if (!b || bz.eng.dead || performance.now() > bz.until) { this.busy = null; el.style.display = 'none'; return; }
    const em = el.querySelector('em'); if (em) em.textContent = Math.ceil(b.t);
    const arc = el.querySelector('.arc'); if (arc) { const C = +arc.getAttribute('stroke-dasharray').split(' ')[1]; arc.setAttribute('stroke-dasharray', `${(C * (1 - b.t / b.total)).toFixed(1)} ${C}`); }
  }
  cancelBuild(eng) {
    const m = this.app.match, b = eng && m && m.fobs.cancel(eng); if (!b) { this.toast('Nothing is being built'); return; }
    this.busy = null; $('btoast').style.display = 'none';
    this.toast(`${BUILDS[buildKind(b)].name} cancelled`); if (this.app.audio) this.app.audio.ui('order');
    this.showSelection(this.app.input.selected);
  }
  action(kind) {
    const m = this.app.match, sel = this.app.input.selected; if (!m) return;
    if (kind === 'load') { this.app.input.startLoad(); return; }
    if (kind === 'advance') { this.app.input.startAdvance(); return; }
    if (kind === 'holdfire') { this.app.input.toggleHoldFire(); return; }
    if (kind === 'follow' || kind === 'clear') { this.touchAction(kind); return; }
    if (kind === 'cancel') { this.cancelBuild(sel.find(u => u.kit === 'engineer' && !u.dead && u.building)); return; }
    if (kind === 'refill') {   // selected supply trucks drive home, fill up and come back
      const me = this.app.playerTeam ?? 0, ts = sel.filter(u => u.supply && !u.dead && u.team === me && !u.refillHome && u.supplies < RULES.fob.truckSupplies);
      if (!ts.length) { this.toast(sel.some(u => u.supply) ? 'Already full, or on its way' : 'Select a supply truck'); if (this.app.audio) this.app.audio.ui('deny'); return; }
      for (const t of ts) m.support.startRefill(t);
      this.toast(`${ts.map(t => t.label).join(', ')} heading home to refill, then back`); if (this.app.audio) this.app.audio.ui('order'); this.showSelection(sel); return;
    }
    const busy = BUILD_ACTS.includes(kind) && sel.find(u => u.kit === 'engineer' && !u.dead && u.building);
    if (busy) { this.busyToast(busy); return; }   // one build at a time: say what he is on, and offer Cancel
    if (kind.startsWith('emp_')) {   // an emplacement where the engineer stands
      const gun = kind.slice(4), eng = sel.find(u => u.kit === 'engineer' && !u.dead); if (!eng) return this.toast('Select an engineer');
      const r = m.fobs.startEmplacement(eng, gun), name = { hmg: 'heavy machine gun', atgm: 'anti-tank launcher', mortar: 'mortar' }[gun];
      this.toast(r.ok ? `Building a ${name}, ${Math.round(r.build.total)} s` : r.reason);
      if (this.app.audio) { this.app.audio.ui(r.ok ? 'order' : 'deny'); if (r.ok) this.app.audio.foley('dig', eng.pos.x, eng.pos.z); }
      this.showSelection(sel); return;
    }
    if (kind === 'fob') { const eng = sel.find(u => u.kit === 'engineer' && !u.dead); if (!eng) return this.toast('Select an engineer'); const r = m.fobs.startBuild(eng); this.toast(r.ok ? `Building FOB, ${Math.round(r.build.total)} s` : r.reason); if (this.app.audio) { this.app.audio.ui(r.ok ? 'order' : 'deny'); if (r.ok) this.app.audio.foley('dig', eng.pos.x, eng.pos.z); } }
    if (kind === 'traps') {   // at a row of traps, or a sandbag position, an engineer clears it; anywhere else he lays traps
      const eng = sel.find(u => u.kit === 'engineer' && !u.dead); if (!eng) return this.toast('Select an engineer');
      const cl = m.fobs.canClear(eng), r = cl.ok ? m.fobs.startClear(eng) : m.fobs.startTraps(eng);
      this.toast(r.ok ? `${cl.ok ? (cl.sandbags ? 'Clearing the sandbag position' : 'Clearing tank traps') : 'Laying tank traps'}, ${Math.round(r.build.total)} s` : r.reason);
      if (this.app.audio) { this.app.audio.ui(r.ok ? 'order' : 'deny'); if (r.ok) this.app.audio.foley('dig', eng.pos.x, eng.pos.z); }
    }
    if (kind === 'sandbags') { const eng = sel.find(u => u.kit === 'engineer' && !u.dead); if (!eng) return this.toast('Select an engineer'); const r = m.fobs.startSandbags(eng); this.toast(r.ok ? `Building sandbags, ${Math.round(r.build.total)} s` : r.reason); if (this.app.audio) { this.app.audio.ui(r.ok ? 'order' : 'deny'); if (r.ok) this.app.audio.foley('dig', eng.pos.x, eng.pos.z); } if (r.ok && m.voices) m.voices.say('vo_sq_dig', 10); }
    if (kind === 'rally') {
      const sqs = [...new Set(sel.filter(u => u.type === 'soldier' && u.squad && !u.dead).map(u => u.squad))]; if (!sqs.length) return this.toast('Select a squad');
      const done = [], why = []; for (const sq of sqs) { const r = m.rallies.place(sq); if (r.ok) done.push(r.rally.label); else why.push(r.reason); }
      this.toast(done.length ? `Rally ${done.join(', ')} placed` : why[0]); if (this.app.audio) this.app.audio.ui(done.length ? 'order' : 'deny');
      if (done.length && m.voices) m.voices.say('vo_sq_rally', 10);
    }
    if (kind === 'unload') {   // a helicopter in the air lands where it is and lets them out on the ground (or just lands, empty); a ground vehicle stops where it is; soldiers in sandbags step out of the back
      const air = (u) => u.spec.air && !u.dead && u.state !== 'parked' && u.state !== 'spooldown';
      const cars = sel.filter(u => u.seats && !u.dead && (u.passengers.length || air(u))), crew = sel.filter(u => u.post && !u.dead);
      if (cars.length) {
        let n = 0, landing = 0, noRoom = 0;
        for (const c of cars) {
          if (air(c)) { c.orbit = null; c.hover = false; c.target = null; c.dest = null; c.dropOnLand = c.passengers.length > 0; if (c.state !== 'land') { if (c.tryLand() === 'none') noRoom++; else landing++; } continue; }   // here if it may, else at the nearest clear ground, else it hovers
          if (!c.spec.air) { c.dest = null; c.target = null; c.path = null; c.speed = 0; } n += c.passengers.length; c.unload();
        }
        this.toast(noRoom && !landing && !n ? `No room to land within 60 m: ${noRoom > 1 ? noRoom + ' hover' : 'it hovers'} until ordered elsewhere` : n ? `Unloaded ${n}${landing ? `; ${landing} landing` : ''}${noRoom ? `; ${noRoom} with no room to land` : ''}` : landing ? (cars.some(c => c.passengers.length) ? 'Landing: they get out on the ground' : 'Landing') + (noRoom ? `; ${noRoom} with no room to land` : '') : 'Nobody aboard');
      } else if (crew.length) {
        const where = new Set(crew.map(u => u.post.sb.label));
        for (const u of crew) { const [ex, ez] = u.post.sb.postEntry(); u.order(ex + (Math.random() - 0.5) * 3, ez + (Math.random() - 0.5) * 3); }
        this.toast(`Left ${[...where].join(', ')}`);
      } else return;
    }
    this.showSelection(sel);
  }

  update(dt, w, h) {
    const a = this.app;
    if (a.match) this.updateMatch(a.match);
    if (a.guide) a.guide.tick(dt);
    if (!a.match && !this.mmHidden) { this.mmHidden = true; for (const id of ['minimap', 'objs', 'match', 'reinf-h', 'reinf']) $(id).style.display = 'none'; }

    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    $('s-fps').textContent = this.fps; $('s-units').textContent = a.units.units.length;
    $('s-calls').textContent = a.drawCalls();
    $('s-buf').textContent = `${a.pixel.rtW}×${a.pixel.rtH}`;
    $('s-zoom').textContent = a.pixel.pixelScale.toFixed(1) + '×';
    $('s-cam').textContent = `${deg(a.rts.yaw) % 360}° / ${deg(a.rts.pitch)}°`;
    const wd = a.world; $('day').textContent = `DAY ${wd.day}`; $('time').textContent = fmtTime(wd.time); $('phase').textContent = wd.phase();
    const [n, hrs] = wd.nextPhase(); $('next').textContent = `${n} in ${fmtDur(hrs)}`;
    if (!this.draggingHour) { $('c-hour').value = wd.time.toFixed(1); $('v-hour').textContent = fmtTime(wd.time); }
    $('sunfill').style.transform = `translateY(${(wd.light.night * 100).toFixed(0)}%)`;
    // labels: vehicles, helis and squad leaders; any selected unit
    const want = new Set(), me = a.playerTeam ?? 0;
    for (const u of a.units.units) {
      if (u.dead || u.mounted || (a.fog && !a.fog.sees(u))) continue;   // no tag on an enemy out of sight
      const lead = u.squad ? u.squad.leader === u : true;
      if (!(lead || u.selected)) continue;
      want.add(u);
      let tag = this.tags.get(u);
      if (!tag) {
        tag = document.createElement('div'); tag.className = 'tag';
        const segs = u.squad ? u.squad.members.length : 1;
        tag.innerHTML = `<i class="tick"></i><svg class="ico" viewBox="0 0 16 10">${ICON[u.type] || ''}</svg><span>${u.label}</span><b class="bar">${'<i></i>'.repeat(segs)}</b>`;
        tag.classList.toggle('enemy', u.team !== me);
        this.labelRoot.appendChild(tag); this.tags.set(u, tag);
      }
      const bar = tag.lastChild;
      if (u.squad) u.squad.members.forEach((m, i) => bar.children[i].classList.toggle('dead', m.dead));
      else bar.firstChild.style.transform = `scaleX(${(u.hp / u.maxHp).toFixed(2)})`;


      const [sx, sy] = a.rts.worldToScreen(u.pos.x, u.pos.y + u.height + 0.3, u.pos.z, w, h);
      const vis = sx > -40 && sx < w + 40 && sy > -20 && sy < h + 20;
      tag.style.display = vis && !(u.building && u.team === me) ? 'block' : 'none';   // an engineer at work wears the build's marker instead
      if (vis) tag.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
      tag.classList.toggle('sel', u.selected);
    }
    for (const [u, tag] of this.tags) if (!want.has(u)) { tag.remove(); this.tags.delete(u); }
    if (!a.match) return;
    this.buildMarks(a.match, w, h);
    this.roster.update(dt); this.roster.edges(w, h);
    const sel = a.input.selected;
    if (sel.length) { this.actAcc += dt; if (this.actAcc > 0.25) { this.actAcc = 0; this.renderActions(sel); } else this.tickActions(sel); }
    this.tickBusy();
  }
  // our builds going up: a ring over the engineer with what he is building and the time left, where his tag was, and a
  // dashed outline on the ground where it will stand
  buildMarks(m, w, h) {
    const me = this.app.playerTeam ?? 0, rts = this.app.rts, live = new Set();
    for (const b of m.fobs.builds) {
      if (b.team !== me) continue; live.add(b);
      let mk = this.marks.get(b);
      if (!mk) { mk = { el: document.createElement('div'), foot: document.createElement('div'), key: '' }; mk.el.className = 'bmark'; mk.foot.className = 'bfoot'; this.labelRoot.append(mk.foot, mk.el); this.marks.set(b, mk); }
      const e = b.eng, k = buildKind(b), B = BUILDS[k], f = 1 - b.t / b.total, key = `${Math.ceil(b.t)}:${Math.round(f * 40)}`;
      if (mk.key !== key) { mk.key = key; mk.el.innerHTML = `${ring(f, B.glyph, 40)}<span class="bt"><span>${e.squad ? e.squad.members[0].label : e.label} · ${(b.kind === 'clear' ? 'Clearing' : B.name).toUpperCase()}</span>${mmss(b.t)}</span>`; }
      const [sx, sy] = rts.worldToScreen(e.pos.x, e.pos.y + e.height + 0.3, e.pos.z, w, h), on = !e.mounted && sx > -60 && sx < w + 60 && sy > -60 && sy < h + 60;
      mk.el.style.display = on ? '' : 'none'; if (on) mk.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
      const r = FOOT[k], gy = this.app.world.heightAt(b.x, b.z);
      if (!r) { mk.foot.style.display = 'none'; continue; }
      const [cx, cy] = rts.worldToScreen(b.x, gy, b.z, w, h), [rx] = rts.worldToScreen(b.x + r * Math.cos(rts.yaw), gy, b.z - r * Math.sin(rts.yaw), w, h), [, ry] = rts.worldToScreen(b.x - r * Math.sin(rts.yaw), gy, b.z - r * Math.cos(rts.yaw), w, h);
      const W = Math.abs(rx - cx) * 2, H = Math.abs(ry - cy) * 2;
      mk.foot.style.display = on ? '' : 'none'; mk.foot.style.width = `${Math.round(W)}px`; mk.foot.style.height = `${Math.round(H)}px`; mk.foot.style.transform = `translate(${Math.round(cx - W / 2)}px, ${Math.round(cy - H / 2)}px)`;
    }
    for (const [b, mk] of this.marks) if (!live.has(b)) { mk.el.remove(); mk.foot.remove(); this.marks.delete(b); }
  }
}
