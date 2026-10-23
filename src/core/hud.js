const $ = (id) => document.getElementById(id);
const fmtTime = (h) => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
const fmtDur = (h) => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const deg = (r) => Math.round(r * 180 / Math.PI);
// 16x10 silhouettes for the unit tags
const ICON = {
  soldier: '<circle cx="3" cy="2.2" r="1.5"/><rect x="1.7" y="4" width="2.6" height="5.5"/><circle cx="8" cy="2.2" r="1.5"/><rect x="6.7" y="4" width="2.6" height="5.5"/><circle cx="13" cy="2.2" r="1.5"/><rect x="11.7" y="4" width="2.6" height="5.5"/>',
  truck: '<rect x="1" y="3.5" width="8" height="4.5"/><rect x="9" y="1.5" width="5.5" height="6.5"/><circle cx="4" cy="8.8" r="1.2"/><circle cx="12" cy="8.8" r="1.2"/>',
  apc: '<path d="M1 7.5 L3.5 3 H13 L15 7.5 Z"/><circle cx="3.5" cy="8.6" r="1.1"/><circle cx="6.8" cy="8.6" r="1.1"/><circle cx="10.2" cy="8.6" r="1.1"/><circle cx="13.5" cy="8.6" r="1.1"/>',
  heli: '<rect x="1" y="1" width="14" height="1.2"/><rect x="3" y="3" width="9" height="4.5" rx="1.5"/><rect x="11" y="4" width="4.5" height="1.3"/><rect x="14" y="2.5" width="1.2" height="3"/>',
  cache: '<rect x="2" y="4" width="12" height="5"/><path d="M1 4 L8 1 L15 4 Z"/>',
  fob: '<rect x="7.4" y="0.5" width="1.2" height="9"/><path d="M4 3 L8 1 L12 3" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="7" width="12" height="2.5"/>',
};


// HUD + control panel. Back-end hooks on app: pixel (settings), setShadows(on),
// drawCalls(), markers.add(x, z), rendererName, otherRenderer {name, param}.
export class Hud {
  constructor(app) {
    this.app = app; this.labelRoot = $('labels'); this.tags = new Map();
    this.paused = false; this.fpsAcc = 0; this.fpsN = 0; this.fps = 0;
    this.bind();
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
    $('c-auto').addEventListener('change', e => a.units.auto = e.target.checked);
    $('b-pause').addEventListener('click', () => this.togglePause());
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
      this.modeShown = true; document.querySelector('#match .small').textContent = m.mode.constructor.name + (m.mode.constructor.sides ? (m.mode.attacker === (this.app.playerTeam ?? 0) ? ' · attacking' : ' · defending') : '');
      document.querySelector('#match .t0 .nm').innerHTML = `BLUFOR<br><em>${t0.doctrine.name}</em>`; document.querySelector('#match .t1 .nm').innerHTML = `OPFOR<br><em>${t1.doctrine.name}</em>`;
      for (const id of ['minimap', 'objs', 'match', 'reinf-h', 'reinf']) $(id).style.display = ''; this.mmHidden = false;
      $('reinf-h').insertAdjacentHTML('afterend', `<select id="spawn-pref"><option value="auto">spawn nearest the squad</option><option value="base">spawn at main base</option>${t0.doctrine.heliSpawn ? '<option value="heli">spawn beside idle helicopter</option>' : ''}</select>`); $('spawn-pref').addEventListener('change', e => { t0.spawnPref = e.target.value; });
    }

    const feed = $('feed'), lines = m.feed.filter(f => f.t < 8);
    if (lines.length !== feed.childElementCount || (lines[0] && feed.firstChild && feed.firstChild.dataset.k !== lines[0].v.pickId + '')) {
      feed.innerHTML = lines.map(f => `<div data-k="${f.v.pickId}"><b class="t${f.k ? f.k.team : 0}">${f.k ? f.k.label : '?'}</b> &rsaquo; <b class="t${f.v.team}">${f.v.label}</b> ${f.v.type}</div>`).join('');
    }
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
    $('reinf').innerHTML = `<div>FOBs ${fobs} · kits ${kits}${build ? ` · building ${Math.ceil(build.t)}s` : ''}</div>` + (q.length ? q.map(x => `<div><b>${x.unit.label}</b> ${x.unit.type} ${Math.ceil(x.t)}s</div>`).join('') : '<div>all units deployed</div>');
    this.drawMinimap(m);
  }

  // ---- minimap: cached terrain, then zones, units and the camera footprint
  minimapBackground(map) {
    const S = 220, bg = document.createElement('canvas'); bg.width = bg.height = S; const g = bg.getContext('2d');
    const splat = document.createElement('canvas'); splat.width = splat.height = S; map.paintSplat(splat.getContext('2d'), S, map.size / 2);
    const sp = splat.getContext('2d').getImageData(0, 0, S, S).data, out = g.createImageData(S, S), o = out.data;
    const sand = [196, 176, 136], tiles = [[182, 176, 164], [91, 91, 93], [138, 138, 88], [163, 142, 102]];
    for (let i = 0; i < S * S; i++) {
      const w = [sp[i * 4] / 255, sp[i * 4 + 1] / 255, sp[i * 4 + 2] / 255, sp[i * 4 + 3] / 255], rest = Math.max(0, 1 - w[0] - w[1] - w[2] - w[3]);
      for (let c = 0; c < 3; c++) o[i * 4 + c] = sand[c] * rest + tiles[0][c] * w[0] + tiles[1][c] * w[1] + tiles[2][c] * w[2] + tiles[3][c] * w[3];
      o[i * 4 + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    // hillshade from the terrain
    const T = this.app.world.terrain;
    if (T) {
      const img = g.getImageData(0, 0, S, S), d = img.data;
      for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
        const x = px / S * map.size - map.size / 2, z = map.size / 2 - py / S * map.size, nn = T.normal(x, z), i = (py * S + px) * 4;
        if (T.height(x, z) < T.water) { d[i] = 52; d[i + 1] = 92; d[i + 2] = 112; continue; }
        const shade = 0.72 + 0.55 * Math.max(0, nn[0] * -0.5 + nn[1] * 0.75 + nn[2] * 0.45);
        d[i] = Math.min(255, d[i] * shade); d[i + 1] = Math.min(255, d[i + 1] * shade); d[i + 2] = Math.min(255, d[i + 2] * shade);
      }
      g.putImageData(img, 0, 0);
    }

    const k = S / map.size, X = (x) => (x + map.size / 2) * k, Z = (z) => (map.size / 2 - z) * k;
    const line = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); g.moveTo(X(pts[0][0]), Z(pts[0][1])); for (const p of pts.slice(1)) g.lineTo(X(p[0]), Z(p[1])); g.stroke(); };
    for (const t of map.tracks || []) line(t, 1.5, '#8a7450');
    if (map.roadPath) line(map.roadPath, 2.5, '#4a4a4c');
    this.mmX = X; this.mmZ = Z; this.mmK = k;
    return bg;
  }
  drawMinimap(m) {
    const a = this.app, map = a.world.map; if (!map) return;
    const cv = $('minimap'), g = cv.getContext('2d');
    if (!this.mmBg) {
      this.mmBg = this.minimapBackground(map);
      const toWorld = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * map.size - map.size / 2, map.size / 2 - (e.clientY - r.top) / r.height * map.size]; };
      let down = false;
      cv.addEventListener('pointerdown', e => { down = true; const [x, z] = toWorld(e); a.rts.target.set(x, 0, z); a.rts.follow = null; e.preventDefault(); });
      window.addEventListener('pointermove', e => { if (down) { const [x, z] = toWorld(e); a.rts.target.set(x, 0, z); } });
      window.addEventListener('pointerup', () => down = false);
    }
    g.drawImage(this.mmBg, 0, 0);
    const X = this.mmX, Z = this.mmZ, k = this.mmK, me = a.playerTeam ?? 0;
    for (const b of m.teams) { g.strokeStyle = b.id === 0 ? '#7fb2e5' : '#e86a5a'; g.lineWidth = 1; g.beginPath(); g.arc(X(b.base.x), Z(b.base.z), b.base.r * k, 0, Math.PI * 2); g.stroke(); }
    m.mode.drawMinimap(g, X, Z, k);
    for (const u of a.units.units) {
      if (u.dead || u.mounted) continue;
      g.fillStyle = u.team === me ? '#9fd0ff' : '#ff8a7a';
      if (u.type === 'fob') { g.strokeStyle = g.fillStyle; g.lineWidth = 1.5; g.strokeRect(X(u.pos.x) - 3, Z(u.pos.z) - 3, 6, 6); continue; }
      const s = u.type === 'soldier' ? 2 : 3; g.fillRect(X(u.pos.x) - s / 2, Z(u.pos.z) - s / 2, s, s);
    }
    // camera footprint
    g.strokeStyle = 'rgba(242,193,78,0.9)'; g.lineWidth = 1; g.beginPath();
    [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([sx, sy], i) => { const p = a.rts.screenToGround(sx, sy); i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z)); });
    g.closePath(); g.stroke();
  }
  showEnd(m) {
    const me = this.app.playerTeam ?? 0;
    $('end-h').textContent = m.winner === null ? 'DRAW' : m.winner.id === me ? 'VICTORY' : 'DEFEAT';
    $('end-d').textContent = `${m.mode.constructor.name}: ${m.reason} · BLUFOR ${Math.max(0, Math.round(m.teams[0].tickets))} / OPFOR ${Math.max(0, Math.round(m.teams[1].tickets))} tickets`;
    $('end').style.display = 'block'; $('end-again').onclick = () => location.reload();
  }

  togglePause()
 { this.paused = !this.paused; $('b-pause').textContent = this.paused ? 'Resume' : 'Pause'; this.toast(this.paused ? 'Paused' : 'Running'); }
  toast(msg) { const t = $('toast'); t.textContent = msg; t.style.opacity = 1; clearTimeout(this.tt); this.tt = setTimeout(() => t.style.opacity = 0, 1400); }

  showSelection(list) {
    const el = $('selinfo'); if (!list.length) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const types = {}; for (const u of list) types[u.type] = (types[u.type] || 0) + 1;
    const desc = Object.entries(types).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`).join(', ');
    $('sel-n').textContent = list.length === 1 ? list[0].label : `${list.length} UNITS`;
    $('sel-d').textContent = list.length === 1
      ? `${list[0].type} · ${list[0].spec.air ? list[0].state : (list[0].target ? 'moving' : 'idle')} · right-click to move · F to follow`
      : desc + ' · right-click to move in formation';
    this.renderActions(list);
  }
  // context actions: build a FOB with a selected engineer, unload a helicopter
  renderActions(list) {
    const m = this.app.match, box = $('sel-actions'); box.innerHTML = '';
    if (!m) return;
    const eng = list.find(u => u.kit === 'engineer' && !u.dead);
    if (eng) { const c = m.fobs.canBuild(eng); box.insertAdjacentHTML('beforeend', `<button data-act="fob" ${c.ok ? '' : 'disabled'} title="${c.reason || ''}">Build FOB (B)${c.ok ? '' : ' · ' + c.reason}</button>`); }
    const heli = list.find(u => u.type === 'heli' && !u.dead && u.passengers.length);
    if (heli) box.insertAdjacentHTML('beforeend', `<button data-act="unload" ${heli.alt > 0.5 ? 'disabled' : ''}>Unload ${heli.passengers.length} (U)</button>`);
    const kits = m.fobs.kitsLeft(this.app.playerTeam ?? 0); if (eng) box.insertAdjacentHTML('beforeend', `<span class="hint">FOB kits left: ${kits}</span>`);
    box.onclick = (e) => { const b = e.target.closest('button'); if (b) this.action(b.dataset.act); };
  }
  action(kind) {
    const m = this.app.match, sel = this.app.input.selected; if (!m) return;
    if (kind === 'fob') { const eng = sel.find(u => u.kit === 'engineer' && !u.dead); if (!eng) return this.toast('Select an engineer'); const r = m.fobs.startBuild(eng); this.toast(r.ok ? `Building FOB, ${Math.round(r.build.total)} s` : r.reason); }
    if (kind === 'unload') { const heli = sel.find(u => u.type === 'heli' && u.passengers.length); if (!heli) return; if (heli.alt > 0.5) return this.toast('Land first'); heli.unload(); this.toast('Unloaded'); }
    this.showSelection(sel);
  }

  update(dt, w, h) {
    const a = this.app;
    if (a.match) this.updateMatch(a.match);
    else if (!this.mmHidden) { this.mmHidden = true; for (const id of ['minimap', 'objs', 'match', 'reinf-h', 'reinf']) $(id).style.display = 'none'; }

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
      if (u.dead || u.mounted) continue;
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
      tag.style.display = vis ? 'block' : 'none';
      if (vis) tag.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
      tag.classList.toggle('sel', u.selected);
    }
    for (const [u, tag] of this.tags) if (!want.has(u)) { tag.remove(); this.tags.delete(u); }
  }
}
