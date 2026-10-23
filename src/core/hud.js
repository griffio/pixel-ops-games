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
    link('c-tpu', 'v-tpu', v => { a.pixel.texelsPerUnit = v; });
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
    sw.href = '?' + q.toString();
    // sync panel with URL-provided state
    $('c-tpu').value = a.pixel.texelsPerUnit; $('v-tpu').textContent = a.pixel.texelsPerUnit;
    $('c-pixel').checked = a.pixel.enabled;
  }

  updateMatch(m) {
    const [t0, t1] = m.teams;
    $('m-t0').textContent = Math.max(0, Math.round(t0.tickets)); $('m-t1').textContent = Math.max(0, Math.round(t1.tickets));
    const s = Math.max(0, Math.ceil(m.time)); $('m-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const feed = $('feed'), lines = m.feed.filter(f => f.t < 8);
    if (lines.length !== feed.childElementCount || (lines[0] && feed.firstChild && feed.firstChild.dataset.k !== lines[0].v.pickId + '')) {
      feed.innerHTML = lines.map(f => `<div data-k="${f.v.pickId}"><b class="t${f.k ? f.k.team : 0}">${f.k ? f.k.label : '?'}</b> &rsaquo; <b class="t${f.v.team}">${f.v.label}</b> ${f.v.type}</div>`).join('');
    }
  }
  showEnd(m) {
    const me = this.app.playerTeam ?? 0;
    $('end-h').textContent = m.winner === null ? 'DRAW' : m.winner.id === me ? 'VICTORY' : 'DEFEAT';
    $('end-d').textContent = `${m.reason} · BLUFOR ${Math.max(0, Math.round(m.teams[0].tickets))} / OPFOR ${Math.max(0, Math.round(m.teams[1].tickets))} tickets`;
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
  }

  update(dt, w, h) {
    const a = this.app;
    if (a.match) this.updateMatch(a.match);

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
      if (u.dead) continue;
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
