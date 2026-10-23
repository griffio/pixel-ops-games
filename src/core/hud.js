const $ = (id) => document.getElementById(id);
const fmtTime = (h) => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
const fmtDur = (h) => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const deg = (r) => Math.round(r * 180 / Math.PI);

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

  togglePause() { this.paused = !this.paused; $('b-pause').textContent = this.paused ? 'Resume' : 'Pause'; this.toast(this.paused ? 'Paused' : 'Running'); }
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
    const want = new Set();
    for (const u of a.units.units) {
      const lead = u.squad ? u.squad.leader === u : true;
      if (!(lead || u.selected)) continue;
      want.add(u);
      let tag = this.tags.get(u);
      if (!tag) { tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = u.label; this.labelRoot.appendChild(tag); this.tags.set(u, tag); }
      const [sx, sy] = a.rts.worldToScreen(u.pos.x, u.pos.y + u.height + 0.3, u.pos.z, w, h);
      const vis = sx > -40 && sx < w + 40 && sy > -20 && sy < h + 20;
      tag.style.display = vis ? 'block' : 'none';
      if (vis) tag.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
      tag.classList.toggle('sel', u.selected);
    }
    for (const [u, tag] of this.tags) if (!want.has(u)) { tag.remove(); this.tags.delete(u); }
  }
}
