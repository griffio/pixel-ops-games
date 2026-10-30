// The unit strip along the bottom of the screen: a card for each of the player's squads, vehicles and builds, with what it
// is doing. Tabs filter it, the Under fire and Idle chips step through those units, + makes a group of the selection
// (keys 1-9 select a group, Ctrl or Shift with a number makes one). A tap on a card selects the unit, a second tap takes
// the camera there, a hold follows it. Units out of view get a pointer on the screen edge that takes the camera to them.
import { RULES } from '../game/rules.js';
import { icon, ring, mmss, BUILDS, buildKind, portrait } from './icons.js';

const ALERT = 6;           // seconds a card stays red after its unit was hit
const PLACE_PAD = 30;      // a squad this far outside a location still holds it
const HOLD_MS = 500, SLOP = 10;
const VEH = { tank: ['TANK', 0], apc: ['APC', 1], heli: ['CHINOOK', 2], bird: ['LITTLE BIRD', 2], truck: ['TRUCK', 3] };
const STRUCT = { fob: 0, emplacement: 1, sandbags: 2, traps: 3 };
const GUN = { hmg: 'HMG', atgm: 'AT GUN', mortar: 'MORTAR' };
export const squadKind = (kits) => kits.includes('engineer') ? ['engineer', 'ENG'] : kits.includes('medic') ? ['medic', 'MEDIC'] : kits.includes('at') ? ['at', 'AT']
  : kits.includes('marksman') ? ['marksman', 'MARKS'] : kits.filter(k => k === 'mg').length > 1 ? ['support', 'SUPPORT'] : ['rifle', 'RIFLE'];
const pct = (f) => Math.round(100 * Math.max(0, Math.min(1, f)));

export class Roster {
  constructor(app) {
    this.app = app;
    const el = this.el = document.getElementById('roster');
    el.innerHTML = `<div class="tabs"><span class="tl"></span><span class="sp"></span><span class="chips"></span><select id="land-at" title="Where your landing craft put men and vehicles ashore"></select><select id="spawn-pref" title="Where your infantry respawn"></select><button class="fold" data-k="fold" title="Show or hide the cards">${icon('fold')}</button></div><div class="cards"></div>`;
    this.tabsEl = el.querySelector('.tl'); this.chipsEl = el.querySelector('.chips'); this.cardsEl = el.querySelector('.cards'); this.edgesEl = document.getElementById('edges');
    this.cards = new Map(); this.list = []; this.byKey = new Map();
    this.tab = 'all'; this.groups = new Map(); this.last = { fire: -1, idle: -1 };
    this.hp = new Map(); this.alertUntil = new Map(); this.acc = 1; this.ids = new WeakMap(); this.nextId = 1; this.pointers = [];
    let kept = null; try { kept = localStorage.getItem('pixelops.strip'); } catch {}
    this.folded = kept ? kept === 'folded' : innerHeight < 560;   // a phone on its side starts with the cards folded away
    el.classList.toggle('folded', this.folded);
    // one press handler for cards, tabs, chips and the fold button: elements are redrawn as the game runs, so a press
    // is matched by its key (data-k), not by the element it started on
    el.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-k]'); if (!t || e.target.closest('select')) return;
      const k = t.dataset.k; this.press = { k, x: e.clientX, y: e.clientY, held: false };
      clearTimeout(this.holdT); this.holdT = setTimeout(() => { if (this.press && this.press.k === k) { this.press.held = true; this.hold(k); } }, HOLD_MS);
    });
    el.addEventListener('pointermove', e => { const p = this.press; if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) { this.press = null; clearTimeout(this.holdT); } });
    const end = (e, ok) => {
      const p = this.press; this.press = null; clearTimeout(this.holdT); if (!p || p.held || !ok) return;
      const t = e.target.closest && e.target.closest('[data-k]'); if (t && t.dataset.k === p.k) this.activate(p.k, e.shiftKey || e.metaKey || e.ctrlKey);
    };
    el.addEventListener('pointerup', e => end(e, true)); el.addEventListener('pointercancel', e => end(e, false));   // a scroll of the strip cancels
    el.addEventListener('contextmenu', e => e.preventDefault());
    this.edgesEl.addEventListener('click', e => { const t = e.target.closest('[data-k]'); if (t) this.goTo(t.dataset.k, true); });
  }

  get me() { return this.app.playerTeam ?? 0; }
  // the respawn choice, from the doctrine: it lives on the strip
  setupSpawnPref(team) {
    const s = document.getElementById('spawn-pref'), d = team.doctrine || {};
    s.innerHTML = `<option value="auto">Respawn near squad</option><option value="base">Respawn at main base</option>${d.heliSpawn ? '<option value="heli">Respawn by helicopter</option>' : ''}${d.truckSpawn ? '<option value="truck">Respawn by truck</option>' : ''}`;
    s.value = team.spawnPref || 'auto'; s.onchange = () => { team.spawnPref = s.value; this.acc = 1; };
    // a side based on a ship: which beach its landing craft run to (game/landing.js); vehicles go to the nearest beach that takes them
    const L = team.landing, b = document.getElementById('land-at'); b.style.display = L ? '' : 'none';
    if (L) { b.innerHTML = L.lanes.map(l => `<option value="${l.name}">Land at ${l.name}${l.vehicles ? '' : ' (infantry)'}</option>`).join(''); b.value = L.choice; b.onchange = () => { L.choice = b.value; }; }
  }

  // ---- what each card says
  near(x, z) { const O = this.app.match.objectives ? this.app.match.objectives.list : []; let best = null, bd = Infinity; for (const l of O) { const d = Math.hypot(l.x - x, l.z - z); if (d < bd) { bd = d; best = l; } } return { l: best, d: bd }; }
  place(x, z, pad = PLACE_PAD) {
    const T = this.app.match.teams[this.me]; if (Math.hypot(T.base.x - x, T.base.z - z) < 90) return 'main base';
    const n = this.near(x, z); return n.l && n.d < n.l.r + pad ? n.l.name : null;
  }
  toward(u, at) { const where = this.place(at.x, at.z, 60), d = Math.round(Math.hypot(at.x - u.pos.x, at.z - u.pos.z)), adv = u.advance && u.dest ? 'Advancing · ' : ''; return where ? `${adv}${where === 'main base' ? 'Base' : where} · ${d} m` : `${adv || 'Moving · '}${d} m`; }   // the arrow says where to
  // a card goes red for a few seconds after its unit loses health, and while its soldiers are pinned down
  hit(key, units, hpNow) {
    const now = this.app.match.elapsed, before = this.hp.get(key); this.hp.set(key, hpNow);
    if ((before !== undefined && hpNow < before - 0.5) || units.some(u => !u.dead && u.supp > 0.35)) this.alertUntil.set(key, now + ALERT);
    return (this.alertUntil.get(key) || 0) > now;
  }
  // when the first of a squad's men is back: on the rally's wave (if he has been down long enough), else his own timer
  eta(e, T) {
    const m = this.app.match, R = RULES.rally, rally = e.unit.type === 'soldier' ? m.respawn.rallyFor(e.unit, T) : null;
    if (rally) { const nw = m.rallies.nextWaveIn(rally), since = m.respawn.clock - e.died; return { t: nw + (since + nw >= R.cutoff ? 0 : R.wave), total: R.wave, rally }; }
    return { t: Math.max(0, e.t), total: m.respawn.timer(e.unit), rally: null };
  }
  squad(sq) {
    const m = this.app.match, T = m.teams[this.me], label = sq.members[0].label, [pic, sub] = squadKind(sq.members.map(u => u.kit)), al = sq.members.filter(u => !u.dead);
    const d = { key: 'q:' + label, label, sub, pic, kind: 'squad' };
    d.pips = sq.members.map(u => u.dead ? 'dead' : u.hp < u.maxHp * 0.7 ? 'hurt' : '');
    if (!al.length) {   // wiped out: when the first man is back, and where
      const q = m.respawn.queue.filter(e => sq.members.includes(e.unit)).map(e => this.eta(e, T)).sort((a, b) => a.t - b.t)[0];
      const r = sq.rally && !sq.rally.dead ? sq.rally : null; d.units = []; d.down = true; d.anchor = r ? r.pos : sq.members[0].pos;
      if (!q) Object.assign(d, { glyph: 'clock', text: 'Down' });
      else if (q.t <= 0 && T.tickets < RULES.ticketCost.soldier) Object.assign(d, { glyph: 'clock', text: 'Down · no tickets' });
      else Object.assign(d, { glyph: 'clock', text: `Back in ${mmss(q.t)}${q.rally ? ' · ' + q.rally.label : ''}`, ring: { f: 1 - q.t / Math.max(q.t, q.total), t: q.t, glyph: 'clock', color: 'var(--muted)' } });
      return d;
    }
    const foot = al.filter(u => !u.mounted), car = !foot.length && al[0].mounted;
    d.units = car ? [car] : foot; d.anchor = (car || foot[0]).pos;
    d.alert = this.hit(d.key, sq.members, sq.members.reduce((s, u) => s + (u.dead ? 0 : u.hp), 0));
    const cx = foot.length ? foot.reduce((s, u) => s + u.pos.x, 0) / foot.length : d.anchor.x, cz = foot.length ? foot.reduce((s, u) => s + u.pos.z, 0) / foot.length : d.anchor.z;
    const eng = sq.engineer, b = eng && !eng.dead && eng.building, mv = foot.find(u => u.dest || u.target), post = foot.find(u => u.post);
    if (b) { const B = BUILDS[buildKind(b)]; Object.assign(d, { glyph: 'build', tone: 'y', text: `${B.name} ${mmss(b.t)}`, ring: { f: 1 - b.t / b.total, t: b.t, glyph: B.glyph } }); }
    else if (d.alert) Object.assign(d, { glyph: 'fire', tone: 'red', text: `Under fire${this.place(cx, cz) ? ' · ' + this.place(cx, cz) : ''}` });
    else if (car) Object.assign(d, { glyph: car.spec.air ? 'air' : 'ride', tone: 'go', text: car.type === 'dock' ? 'On the ship' : `${car.spec.air ? 'Flying in' : 'In'} ${car.label}` });   // the dock: waiting for a landing craft
    else if (post) Object.assign(d, { glyph: 'post', text: `Manning ${post.post.sb.label}` });
    else if (mv) Object.assign(d, { glyph: 'move', tone: 'go', text: this.toward(mv, mv.dest || mv.target) });
    else if (foot.some(u => u.enemy)) Object.assign(d, { glyph: 'aim', text: `Engaging${this.place(cx, cz) ? ' · ' + this.place(cx, cz) : ''}` });
    else {
      const n = this.near(cx, cz), l = n.l, sign = this.me === 0 ? 1 : -1;
      if (l && n.d < l.r && l.owner !== this.me) Object.assign(d, { glyph: 'flag', tone: 'cap', text: l.contested ? `Contested · ${l.name}` : l.owner === 1 - this.me ? `Contesting ${l.name}` : `Taking ${l.name} ${Math.max(0, Math.round(sign * l.progress))}%` });
      else { const p = this.place(cx, cz); Object.assign(d, { glyph: 'hold', text: p === 'main base' ? 'At main base' : p ? `Holding ${p}` : 'Holding · open ground', idle: true }); }
    }
    return d;
  }
  vehicle(u) {
    const m = this.app.match, [sub, ord] = VEH[u.type], d = { key: 'v:' + u.label, label: u.label, sub: u.supply ? 'SUPPLY' : u.amphib ? 'AAV' : sub, pic: u.amphib ? (u.supply ? 'amphibSupply' : 'amphib') : u.supply ? 'supply' : u.type, kind: 'veh', ord, units: [u], anchor: u.pos };
    d.hp = u.hp / u.maxHp; if (u.supply) d.sup = u.supplies / RULES.fob.truckSupplies; if (u.seats) d.seat = `${u.passengers.length}/${u.seats}`;
    d.alert = this.hit(d.key, [u], u.hp);
    const feeding = m.fobs.builds.find(b => b.truck === u), go = u.dest || u.target, air = u.spec.air;
    if (u.afloat) Object.assign(d, { glyph: 'ride', tone: 'go', text: u.mounted && u.mounted.type !== 'dock' ? `In ${u.mounted.label}` : 'On the ship' });   // waiting for, or aboard, a landing craft
    else if (feeding) Object.assign(d, { glyph: 'sup', tone: 'y', text: `Supplying ${feeding.eng.label}` });
    else if (d.alert) Object.assign(d, { glyph: 'fire', tone: 'red', text: 'Under fire' });
    else if (air && u.hoverNoRoom) Object.assign(d, { glyph: 'air', tone: 'y', text: 'No room to land' });
    else if (air && u.spec.noLand && u.hover && !u.dest) Object.assign(d, { glyph: 'air', tone: 'go', text: `Hovering${u.ammo !== undefined ? ` · ${Math.floor(u.ammo)} rockets` : ''}` });
    else if (air && u.state === 'land') Object.assign(d, { glyph: 'air', tone: 'go', text: 'Landing' });
    else if (air && u.orbit) Object.assign(d, { glyph: 'air', tone: 'go', text: `Circling ${this.place(u.orbit.x, u.orbit.z, 80) || 'the spot'}` });
    else if (go) Object.assign(d, { glyph: air ? 'air' : 'move', tone: 'go', text: this.toward(u, go) });
    else if (u.refilling) Object.assign(d, { glyph: 'sup', text: 'Refilling' });
    else if (u.enemy) Object.assign(d, { glyph: 'aim', text: 'Engaging' });
    else { const p = this.place(u.pos.x, u.pos.z, 60); Object.assign(d, { glyph: 'idle', text: `Parked · ${p || 'open ground'}`, idle: true }); }
    return d;
  }
  lost(e, T) {   // a destroyed vehicle waiting at main
    const u = e.unit, [sub, ord] = VEH[u.type], q = this.eta(e, T);
    return { key: 'v:' + u.label, label: u.label, sub: u.supply ? 'SUPPLY' : u.amphib ? 'AAV' : sub, pic: u.amphib ? (u.supply ? 'amphibSupply' : 'amphib') : u.supply ? 'supply' : u.type, kind: 'veh', ord, units: [], anchor: T.base, down: true, glyph: 'clock', text: `Destroyed · back in ${mmss(q.t)}`, ring: { f: 1 - q.t / Math.max(q.t, q.total), t: q.t, glyph: 'clock', color: 'var(--muted)' } };
  }
  site(b) {   // a build going up: its own card until it is done
    if (!this.ids.has(b)) this.ids.set(b, this.nextId++);
    const B = BUILDS[buildKind(b)], sq = b.eng.squad;
    return { key: 'b:' + this.ids.get(b), label: (b.kind === 'clear' ? 'CLEARING' : B.name.toUpperCase()), sub: '', pic: B.pic, kind: 'built', ord: -1, ghost: true, units: sq ? sq.members.filter(u => !u.dead && !u.mounted) : [b.eng], anchor: { x: b.x, z: b.z },
      glyph: 'build', tone: 'y', text: `${b.kind === 'clear' ? 'Clear' : 'Ready'} in ${mmss(b.t)} · ${b.eng.label}`, ring: { f: 1 - b.t / b.total, t: b.t, glyph: B.glyph } };
  }
  structure(u) {
    const p = this.place(u.pos.x, u.pos.z, 60) || 'open ground', d = { key: 's:' + u.label, label: u.label, kind: 'built', ord: STRUCT[u.type], units: [], anchor: u.pos, hp: u.hp / u.maxHp };
    d.alert = this.hit(d.key, [u], u.hp);
    if (u.type === 'fob') Object.assign(d, { sub: 'FOB', pic: 'fob', glyph: 'fob', text: `Spawn · ${p}` });
    else if (u.type === 'emplacement') { const on = !!u.crewAt(0); Object.assign(d, { sub: GUN[u.gun] || 'GUN', pic: u.gun, glyph: 'post', units: [u], text: on ? `Manned · ${p}` : 'No gunner', tone: on ? '' : 'y' }); }
    else if (u.type === 'sandbags') { const n = u.crew ? u.crew.length - u.freeSlots : 0; Object.assign(d, { sub: 'BAGS', pic: 'sandbags', glyph: 'post', text: `${n ? n + ' in' : 'Empty'} · ${p}` }); }
    else Object.assign(d, { sub: 'TRAPS', pic: 'traps', glyph: 'traps', text: p, hp: null });
    if (d.alert) Object.assign(d, { glyph: 'fire', tone: 'red', text: `Under fire · ${p}` });
    return d;
  }
  collect() {
    const a = this.app, m = a.match, me = this.me, T = m.teams[me], U = a.units.units;
    const squads = a.units.squads.filter(s => s.team === me && s.members.length).map(s => this.squad(s)).sort((x, y) => x.label.localeCompare(y.label, undefined, { numeric: true }));
    const vehicles = U.filter(u => u.team === me && !u.dead && !u.squad && VEH[u.type]).map(u => this.vehicle(u));
    for (const e of m.respawn.queue) if (e.unit.team === me && VEH[e.unit.type] && !vehicles.some(v => v.label === e.unit.label)) vehicles.push(this.lost(e, T));
    vehicles.sort((x, y) => x.ord - y.ord || x.label.localeCompare(y.label, undefined, { numeric: true }));
    const built = [...m.fobs.builds.filter(b => b.team === me).map(b => this.site(b)), ...U.filter(u => u.team === me && !u.dead && STRUCT[u.type] !== undefined).map(u => this.structure(u))];
    built.sort((x, y) => x.ord - y.ord || x.label.localeCompare(y.label, undefined, { numeric: true }));
    for (const d of [...squads, ...vehicles, ...built]) { d.group = this.groupOf(d.key); d.sel = d.units.length > 0 && d.units.every(u => u.selected); }
    return { squads, vehicles, built };
  }

  // ---- drawing
  update(dt) {
    if (!this.app.match) return;
    this.acc += dt; if (this.acc >= 0.25) { this.acc = 0; this.refresh(); }
  }
  refresh() {
    if (!this.app.match) return;
    const R = this.R = this.collect(), list = this.list = [...R.squads, ...R.vehicles, ...R.built];
    this.byKey = new Map(list.map(d => [d.key, d]));
    const want = (d) => this.tab === 'all' || (this.tab === 'squads' && d.kind === 'squad') || (this.tab === 'vehicles' && d.kind === 'veh') || (this.tab === 'built' && d.kind === 'built') || (this.tab[0] === 'g' && (this.groups.get(+this.tab.slice(1)) || new Set()).has(d.key));
    const seen = new Set();
    list.forEach((d, i) => {
      seen.add(d.key); let c = this.cards.get(d.key);
      if (!c) {
        const el = document.createElement('div'); el.className = 'card'; el.dataset.k = d.key;
        el.innerHTML = '<div class="pic"><img alt="" draggable="false"></div><div class="st"></div><div class="ov"></div><div class="lbl"></div><div class="what"></div><div class="foot"></div>';
        c = { el, parts: [...el.children], cache: [] }; this.cards.set(d.key, c);
      }
      if (this.cardsEl.children[i] !== c.el) this.cardsEl.insertBefore(c.el, this.cardsEl.children[i] || null);
      this.paint(c, d); c.el.style.display = want(d) ? '' : 'none';
    });
    for (const [k, c] of this.cards) if (!seen.has(k)) { c.el.remove(); this.cards.delete(k); }
    this.drawTabs(R);
    const h = this.el.offsetHeight; if (h !== this.stripH) { this.stripH = h; document.documentElement.style.setProperty('--strip-h', h + 'px'); }
  }
  paint(c, d) {
    const set = (i, html) => { if (c.cache[i] !== html) { c.cache[i] = html; c.parts[i].innerHTML = html; } };
    const img = c.parts[0].firstChild, src = portrait(d.pic); if (c.pic !== src) { c.pic = src; img.src = src; }
    const cls = `card${d.sel ? ' sel' : ''}${d.alert ? ' alert' : ''}${d.down ? ' down' : ''}${d.ghost ? ' ghost' : ''}`; if (c.el.className !== cls) c.el.className = cls;
    set(1, `${d.group ? `<b class="g">${d.group}</b>` : ''}<b>${icon(d.glyph)}</b><i></i>${d.seat ? `<b class="seat">${icon('ride')}${d.seat}</b>` : ''}`);
    set(2, d.ring ? `${ring(d.ring.f, d.ring.glyph, 38, d.ring.color)}<span>${mmss(d.ring.t)}</span>` : '');
    set(3, `${d.label}${d.sub ? `<small>${d.sub}</small>` : ''}`);
    c.parts[4].className = `what ${d.tone || ''}`; set(4, `${icon(d.glyph)}<span>${d.text}</span>`);
    set(5, d.pips ? `<div class="pips">${d.pips.map(p => `<i class="${p}"></i>`).join('')}</div>`
      : `${d.sup != null ? `<div class="bar sup"><i style="width:${pct(d.sup)}%"></i></div>` : ''}${d.hp != null ? `<div class="bar"><i style="width:${pct(d.hp)}%"></i></div>` : ''}`);
  }
  drawTabs(R) {
    const n = R.squads.length + R.vehicles.length + R.built.length, tab = (k, name, c) => `<button class="tab${this.tab === k ? ' on' : ''}" data-k="tab:${k}">${name}<i>${c}</i></button>`;
    const groups = [...this.groups.keys()].sort((x, y) => x - y).map(g => `<button class="tab grp${this.tab === 'g' + g ? ' on' : ''}" data-k="tab:g${g}" title="Group ${g}: tap to select, hold to remove"><b>${g}</b><i>${this.groups.get(g).size}</i></button>`).join('');
    const html = tab('all', 'All', n) + tab('squads', 'Squads', R.squads.length) + tab('vehicles', 'Vehicles', R.vehicles.length) + tab('built', 'Built', R.built.length) + groups + `<button class="tab add" data-k="add" title="Make a group of the selection (Ctrl or Shift + 1-9)">+</button>`;
    if (html !== this.tabsHtml) { this.tabsHtml = html; this.tabsEl.innerHTML = html; }
    const fire = this.list.filter(d => d.alert && d.units.length).length, idle = this.list.filter(d => d.idle).length, sel = this.app.input.selected.length;
    const chips = `${fire ? `<button class="chip red" data-k="chip:fire" title="Go to the next unit under fire">${icon('fire')}<span>Under fire</span> ${fire}</button>` : ''}<button class="chip" data-k="chip:idle" title="Go to the next unit with no orders">${icon('idle')}<span>Idle</span> ${idle}</button>${sel ? `<button class="chip y" data-k="chip:sel" title="Go to the selection"><span>Selected</span> ${sel}</button>` : ''}`;
    if (chips !== this.chipsHtml) { this.chipsHtml = chips; this.chipsEl.innerHTML = chips; }
  }

  // ---- taps
  activate(k, add) {
    if (k === 'fold') { this.folded = !this.folded; this.el.classList.toggle('folded', this.folded); try { localStorage.setItem('pixelops.strip', this.folded ? 'folded' : 'open'); } catch {} this.refresh(); return; }
    if (k === 'add') return this.assign(null);
    if (k.startsWith('tab:')) {
      const t = k.slice(4);
      if (t[0] === 'g') { if (this.tab === t) this.goTo(null, false, this.groupUnits(+t.slice(1))); else this.recall(+t.slice(1)); }
      else this.tab = t;
      this.refresh(); return;
    }
    if (k === 'chip:fire' || k === 'chip:idle') {
      const which = k.slice(5), pool = this.list.filter(d => d.units.length && (which === 'fire' ? d.alert : d.idle)); if (!pool.length) return;
      const i = (this.last[which] + 1) % pool.length; this.last[which] = i; this.app.input.select(pool[i].units); this.glide(pool[i].anchor); return;
    }
    if (k === 'chip:sel') return this.goTo(null, false, this.app.input.selected);
    this.tap(k, add);
  }
  tap(k, add) {
    const d = this.byKey.get(k), inp = this.app.input, hud = this.app.hud; if (!d) return;
    const units = d.units.filter(u => !u.dead);
    if (inp.loading && units.length === 1 && units[0].seats) { inp.loadInto(units[0]); return; }   // Load, then a vehicle's card: board it
    if (!units.length) { this.glide(d.anchor); hud.toast(`${d.label}: ${d.text}`); return; }
    const all = units.every(u => u.selected);
    if (add) inp.select(all ? inp.selected.filter(u => !units.includes(u)) : [...new Set([...inp.selected, ...units])]);
    else if (all && inp.selected.length === units.length) this.glide(d.anchor);   // a second tap: go there
    else inp.select(units);
    this.refresh();
  }
  hold(k) {
    if (k.startsWith('tab:g')) { const g = +k.slice(5); this.groups.delete(g); if (this.tab === 'g' + g) this.tab = 'all'; this.app.hud.toast(`Group ${g} removed`); this.refresh(); return; }
    const d = this.byKey.get(k); if (!d) return; const units = d.units.filter(u => !u.dead); if (!units.length) return;
    this.app.input.select(units); this.app.rts.follow = units[0]; this.app.hud.toast(`Following ${d.label}`); this.refresh();
  }
  // the camera eases over to a spot (follow on a point that never moves; a pan or a drag ends it)
  glide(p) { if (p) this.app.rts.follow = { pos: { x: p.x, z: p.z } }; }
  goTo(k, select, units = null) {
    if (k) { const d = this.byKey.get(k); if (!d) return; units = d.units.filter(u => !u.dead); if (select && units.length) this.app.input.select(units); if (!units.length) return this.glide(d.anchor); }
    const live = (units || []).filter(u => !u.dead); if (!live.length) return;
    this.glide({ x: live.reduce((s, u) => s + u.pos.x, 0) / live.length, z: live.reduce((s, u) => s + u.pos.z, 0) / live.length });
  }

  // ---- groups: card keys, so a squad or vehicle stays in its group after it respawns
  keyOf(u) { return u.squad ? 'q:' + u.squad.members[0].label : u.type === 'emplacement' ? 's:' + u.label : VEH[u.type] ? 'v:' + u.label : null; }
  groupOf(key) { for (const [g, s] of [...this.groups].sort((x, y) => x[0] - y[0])) if (s.has(key)) return g; return 0; }
  groupUnits(g) {
    const keys = this.groups.get(g); if (!keys) return [];
    return this.app.units.units.filter(u => !u.dead && !u.mounted && u.team === this.me && keys.has(this.keyOf(u)));
  }
  assign(g) {
    const keys = new Set(this.app.input.selected.map(u => this.keyOf(u)).filter(Boolean)), hud = this.app.hud;
    if (!keys.size) { hud.toast(this.app.touch ? 'Select units first, then + makes them a group' : 'Select units first, then Ctrl or Shift + 1-9 makes them a group'); return; }
    if (g === null) { g = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(n => !this.groups.has(n)); if (!g) { hud.toast('All nine groups are in use: hold a group tab to remove one'); return; } }
    this.groups.set(g, keys); this.tab = 'g' + g; hud.toast(`Group ${g}: ${keys.size} unit${keys.size > 1 ? 's' : ''}${this.app.touch ? '' : ` (press ${g} to select)`}`); this.refresh();
  }
  recall(g) {
    const units = this.groupUnits(g); if (!this.groups.has(g)) return false;
    const now = performance.now(), again = this.lastRecall && this.lastRecall.g === g && now - this.lastRecall.t < 450; this.lastRecall = { g, t: now };
    if (units.length) this.app.input.select(units); this.tab = 'g' + g;
    if (again || !units.length) this.goTo(null, false, units);   // pressed twice: go there
    this.refresh(); return true;
  }

  // ---- pointers on the screen edge for units out of view, merged where they would overlap
  edges(w, h) {
    const E = this.edgesEl; if (!this.app.match || !this.list.length) { E.innerHTML = ''; return; }
    const rts = this.app.rts, dock = document.getElementById('dock'), bottom = Math.min(h - (this.stripH || 0) - 16, document.body.classList.contains('sel') ? dock.getBoundingClientRect().top - 6 : h);
    const box = { l: 10, r: w - 10, t: this.app.touch && h > w ? 340 : 150, b: bottom - 14 }, cx = w / 2, cy = (box.t + box.b) / 2, out = [];
    for (const d of this.list) {
      if (d.kind === 'built' || d.down) continue;
      const u = d.units[0]; if (!u || u.dead || u.mounted) continue;
      const [sx, sy] = rts.worldToScreen(u.pos.x, u.pos.y + 1, u.pos.z, w, h);
      if (sx > 0 && sx < w && sy > 0 && sy < bottom) continue;
      const dx = sx - cx, dy = sy - cy, k = Math.min((box.r - box.l) / 2 / Math.max(1e-6, Math.abs(dx)), (box.b - box.t) / 2 / Math.max(1e-6, Math.abs(dy)));
      const x = Math.max(box.l + 48, Math.min(box.r - 48, cx + dx * k)), y = Math.max(box.t, Math.min(box.b, cy + dy * k));
      const hit = out.find(p => Math.abs(p.x - x) < 96 && Math.abs(p.y - y) < 26);
      if (hit) { hit.more++; hit.alert = hit.alert || d.alert; continue; }
      out.push({ k: d.key, label: d.label, x, y, more: 0, alert: d.alert, ang: Math.atan2(dy, dx) * 180 / Math.PI + 180, dist: Math.round(Math.hypot(u.pos.x - rts.target.x, u.pos.z - rts.target.z)) });
    }
    while (this.pointers.length < out.length) { const b = document.createElement('button'); b.className = 'edge'; E.appendChild(b); this.pointers.push({ el: b, html: '' }); }
    this.pointers.forEach((p, i) => {
      const o = out[i]; p.el.style.display = o ? '' : 'none'; if (!o) return;
      const html = `<span class="dir" style="transform:rotate(${Math.round(o.ang / 10) * 10}deg)">${icon('arrow')}</span>${o.label}${o.more ? ` <small>+${o.more}</small>` : ''} <small>${o.dist} m</small>`;
      if (p.html !== html) { p.html = html; p.el.innerHTML = html; }
      p.el.dataset.k = o.k; p.el.classList.toggle('red', !!o.alert); p.el.style.transform = `translate(${Math.round(o.x)}px, ${Math.round(o.y)}px) translate(-50%, -50%)`;
    });
  }
}
