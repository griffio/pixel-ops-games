import { ITEMS, DOCTRINES, PRESETS, BUDGET, itemCost, summarize, clone, preset, saveLoadout, loadSaved } from '../loadout.js';
import { MODES } from '../modes/index.js';

const $ = (id) => document.getElementById(id);

// Pre-match force builder. Calls onDeploy(loadout) when the player commits.
export class Lobby {
  constructor(onDeploy) {
    this.onDeploy = onDeploy;
    this.loadout = loadSaved() || preset('balanced');
    try { this.modeOpts = JSON.parse(localStorage.getItem('pixelops.mode')) || { mode: 'aas', side: 'attack' }; } catch { this.modeOpts = { mode: 'aas', side: 'attack' }; }
    if (!MODES[this.modeOpts.mode]) this.modeOpts.mode = 'aas';
    this.root = $('lobby'); this.root.style.display = 'block';
    this.build();
    this.render();
  }

  build() {
    const row = (k) => `<div class="lb-item" data-k="${k}"><div class="n">${ITEMS[k].name}<small>${ITEMS[k].desc}</small></div><div class="c" data-cost="${k}"></div><div class="q"><button data-dec="${k}">&minus;</button><b data-n="${k}">0</b><button data-inc="${k}">+</button></div></div>`;
    $('lb-squads').innerHTML = Object.keys(ITEMS).filter(k => ITEMS[k].kind === 'squad').map(row).join('');
    $('lb-vehicles').innerHTML = Object.keys(ITEMS).filter(k => ITEMS[k].kind !== 'squad').map(row).join('');
    $('lb-doctrines').innerHTML = Object.entries(DOCTRINES).map(([k, d]) => `<label class="lb-doc"><input type="radio" name="doctrine" value="${k}"><div><b>${d.name}</b><small>${d.desc}</small></div></label>`).join('');
    $('lb-presets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button data-preset="${k}">${p.name}</button>`).join('');
    $('lb-modes').innerHTML = Object.values(MODES).filter(M => M.key !== 'skirmish' || true).map(M => `<label class="lb-doc"><input type="radio" name="mode" value="${M.key}"><div><b>${M.name}</b><small>${M.desc}</small></div></label>`).join('') + `<div id="lb-side" class="row"><span class="lb-lbl">Your side</span><label><input type="radio" name="side" value="attack"> attack</label><label><input type="radio" name="side" value="defend"> defend</label></div>`;
    this.root.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.inc) this.set(t.dataset.inc, this.n(t.dataset.inc) + 1);
      else if (t.dataset.dec) this.set(t.dataset.dec, this.n(t.dataset.dec) - 1);
      else if (t.dataset.preset) { this.loadout = preset(t.dataset.preset); this.render(); }
      else if (t.id === 'lb-save') { saveLoadout(this.loadout); $('lb-msg').textContent = 'saved'; setTimeout(() => $('lb-msg').textContent = '', 1200); }
      else if (t.id === 'lb-deploy') this.deploy();
    });
    this.root.addEventListener('change', (e) => {
      if (e.target.name === 'doctrine') { this.loadout.doctrine = e.target.value; this.render(); }
      if (e.target.name === 'mode') { this.modeOpts.mode = e.target.value; this.render(); }
      if (e.target.name === 'side') { this.modeOpts.side = e.target.value; this.render(); }
    });
  }

  n(k) { return this.loadout.items[k] || 0; }
  set(k, v) { this.loadout.items[k] = Math.max(0, Math.min(9, v)); if (!this.loadout.items[k]) delete this.loadout.items[k]; this.render(); }

  render() {
    const l = this.loadout, s = summarize(l);
    for (const k of Object.keys(ITEMS)) { $('lb-squads').parentElement.querySelector(`[data-n="${k}"]`).textContent = this.n(k); $('lb-squads').parentElement.querySelector(`[data-cost="${k}"]`).textContent = itemCost(k, l.doctrine); }
    for (const r of this.root.querySelectorAll('input[name=doctrine]')) r.checked = r.value === l.doctrine;
    for (const r of this.root.querySelectorAll('input[name=mode]')) r.checked = r.value === this.modeOpts.mode;
    for (const r of this.root.querySelectorAll('input[name=side]')) r.checked = r.value === this.modeOpts.side;
    $('lb-side').style.display = MODES[this.modeOpts.mode].sides ? 'flex' : 'none';
    $('lb-sub').textContent = `Desert Crossing · ${MODES[this.modeOpts.mode].name} · ${Math.round(new MODES[this.modeOpts.mode]({ teams: [], units: null, world: {} }).length / 60)}:00 · you command BLUFOR, the CPU answers your loadout`;
    const pct = Math.min(100, s.cost / BUDGET * 100);
    $('lb-summary').innerHTML = `<div class="bar"><i style="width:${pct}%" class="${s.cost > BUDGET ? 'over' : ''}"></i></div>
      <div class="kv"><span>points</span><b>${s.cost} / ${BUDGET}</b></div><div class="kv"><span>squads</span><b>${s.squads} / ${s.slots}</b></div><div class="kv"><span>vehicles</span><b>${s.vehicles} / 9</b></div>
      ${s.errors.length ? `<div class="err">${s.errors.join(' · ')}</div>` : '<div class="ok">ready to deploy</div>'}`;
    $('lb-deploy').disabled = !s.ok;
  }

  deploy() {
    if (!summarize(this.loadout).ok) return;
    saveLoadout(this.loadout); try { localStorage.setItem('pixelops.mode', JSON.stringify(this.modeOpts)); } catch {}
    this.root.style.display = 'none';
    this.onDeploy(clone(this.loadout), { ...this.modeOpts });
  }
}
