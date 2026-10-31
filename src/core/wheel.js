import { icon } from './icons.js';
import { noteHead } from '../game/orders.js';

const $ = (id) => document.getElementById(id);
// The Command Wheel (docs/GAME_PLAN.md "Command Wheel", W2): the player's orders to their hybrid CO, dialled in three
// steps, who, what, where, from a round button in thumb reach left of the minimap. Each choice is a pill on a ring round
// a hub (tap, or drag and release on one; the hub goes back a step); the sentence builds in the bar; the order goes to
// match.orders (game/orders.js) the moment it is complete, the engine carries it out and the CO acknowledges over the
// radio. Chips above the bar offer three orders the rules suggest from the state. "Here" takes a tap on the ground and
// is the player's own hand (input.orderAt), an ambush there holding fire. Only with a hybrid commander (body.hybrid).
const WHAT = [
  { k: 'take', name: 'Take', glyph: 'flag', where: 'any' },
  { k: 'hold', name: 'Hold', glyph: 'hold', where: 'any' },
  { k: 'screen', name: 'Screen', glyph: 'aim', where: 'ours' },
  { k: 'ambush', name: 'Ambush', glyph: 'holdfire', where: 'any' },
  { k: 'grab', name: 'Grab', glyph: 'move', where: 'free' },
  { k: 'fallback', name: 'Fall back', glyph: 'base', where: 'ours' },
  { k: 'rejoin', name: 'Rejoin', glyph: 'follow', where: null },
];
const INTENT = [
  { k: 'press', name: 'Press', glyph: 'fire' }, { k: 'hold the line', name: 'Hold the line', glyph: 'hold' }, { k: 'go quiet', name: 'Go quiet', glyph: 'holdfire' },
  { k: 'bleed them', name: 'Bleed them', glyph: 'clock' }, { k: 'pull back', name: 'Pull back', glyph: 'base' },
];

export class Wheel {
  constructor(app) {
    this.app = app; this.open_ = false; this.step = 0; this.who = null; this.what = null; this.mods = { quiet: false, costs: false }; this.sugg = [];
    this.btn = $('wheel-btn'); this.el = $('wheel'); if (!this.btn || !this.el) return;
    this.ring = this.el.querySelector('.w-ring'); this.hub = this.el.querySelector('.w-hub'); this.say = this.el.querySelector('.w-say'); this.modsEl = this.el.querySelector('.w-mods'); this.chips = this.el.querySelector('.w-chips');
    this.btn.addEventListener('click', () => this.toggle());
    this.el.querySelector('.w-x').addEventListener('click', () => this.close());
    this.el.querySelector('.w-plan').addEventListener('click', () => this.showPlan());
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });   // a tap on the dimmed map closes it
    this.ring.addEventListener('pointerup', (e) => { const b = e.target.closest('.w-seg'); if (b) this.pick(b.dataset.k); else if (e.target.closest('.w-hub') && this.step > 0) this.back(); });
    this.ring.addEventListener('pointermove', (e) => {   // a drag lights the pill under the finger; release picks it (pointerup lands on it)
      if (!e.buttons && e.pointerType !== 'touch') return;
      const t = document.elementFromPoint(e.clientX, e.clientY), b = t && t.closest('.w-seg');
      for (const s of this.ring.querySelectorAll('.w-seg.hot')) if (s !== b) s.classList.remove('hot'); if (b) b.classList.add('hot');
    });
    this.modsEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; this.mods[b.dataset.m] = !this.mods[b.dataset.m]; this.renderBar(); });
    this.chips.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.c !== undefined) { const p = this.pending; this.pending = null; if (b.dataset.c === '1' && p) { if (this.send(p.spec, p.sentence)) this.input.value = ''; } else { this.say.textContent = this.sentence(); this.renderChips(); } return; }   // the confirm chip
      const s = this.sugg[+b.dataset.i]; if (s) this.send(s.spec, s.text);
    });
    // the typed order: the Worker's /orders reads it with Clef and proposes a structured order; dictation feeds the same box
    this.form = this.el.querySelector('.w-type'); this.input = this.el.querySelector('.w-in'); this.mic = this.el.querySelector('.w-mic');
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.submitText(this.input.value); });
    this.input.addEventListener('keydown', (e) => e.stopPropagation());   // the game's hotkeys stay out of the box
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) this.mic.hidden = true; else this.mic.addEventListener('click', () => this.dictate());
  }
  // "SQ-01 hold the Mill, quietly" in words: /orders -> { order } -> the same spec the pills make; under 0.7 confidence, a
  // compound sentence or nobody named, a confirm chip shows the reading before it goes
  async submitText(text) {
    text = String(text || '').trim(); if (!text || this.busyText) return;
    const squads = this.squads().map(s => s.members[0].label), places = this.places().map(l => l.name);
    this.busyText = true; this.say.textContent = `${text} \u2026`;
    let r; try { const res = await fetch(this.app.ordersUrl || '/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, squads, places }) }); r = await res.json(); } catch { r = { error: 'no order service here' }; }
    this.busyText = false; if (!this.open_) return;
    if (r.error || !r.order) { this.app.hud.toast(`Can't read that${r.error ? ': ' + r.error : ''}`); this.say.textContent = this.sentence(); return; }
    const o = r.order, sentence = this.sentenceFor(o), spec = this.specFor(o);
    if (o.missing || !spec) { this.say.textContent = this.sentence(); this.app.hud.toast(o.missing === 'a place' ? `Which place? ${sentence}` : `Can't read that: ${sentence}`); return; }
    if (o.needsConfirm) {
      this.pending = { spec, sentence }; this.say.textContent = `${sentence}?`;
      this.chips.innerHTML = `<button type="button" class="confirm" data-c="1">Send: ${sentence}</button><button type="button" data-c="0">No</button>${o.compound >= 0.6 ? '<button type="button" disabled>one order at a time</button>' : ''}`;
      return;
    }
    if (this.send(spec, sentence)) this.input.value = '';
  }
  dictate() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    if (this.rec) { try { this.rec.stop(); } catch {} return; }
    const rec = this.rec = new SR(); rec.lang = navigator.language || 'en-GB'; rec.interimResults = true; rec.maxAlternatives = 1;
    this.mic.classList.add('on'); const ph = this.input.placeholder; this.input.placeholder = 'Listening\u2026';
    rec.onresult = (e) => { const t = [...e.results].map(x => x[0].transcript).join(' ').trim(); this.input.value = t; if (e.results[e.results.length - 1].isFinal) this.submitText(t); };
    rec.onerror = (e) => { if (e.error !== 'aborted' && e.error !== 'no-speech') this.app.hud.toast(`Dictation: ${e.error}`); };
    rec.onend = () => { this.rec = null; this.mic.classList.remove('on'); this.input.placeholder = ph; };
    try { rec.start(); } catch { this.rec = null; this.mic.classList.remove('on'); this.input.placeholder = ph; }
  }
  // the order a who, a what, a place and a how make (game/orders.js), shared by the pills and the typed path
  specFor({ who, what, at, how }) {
    const me = this.me;
    if (INTENT.some(i => i.k === what)) return { team: me, intent: what, how };
    if (what === 'rejoin') return { team: me, who: who || 'all', intent: 'rejoin' };
    if (!who) return null; const h = what === 'ambush' ? 'quietly' : how;
    if (what === 'take') return who === 'all' ? { team: me, intent: 'take', at, how: h } : { team: me, who, role: 'hold', at, how: h };   // a squad told to take a place takes it and holds it
    if (what === 'hold' || what === 'ambush') return { team: me, who, role: 'hold', at, how: h };
    if (what === 'screen') return { team: me, who, role: 'screen', at, how: h };
    if (what === 'grab') return { team: me, who, role: 'grab', at, how: h };
    if (what === 'fallback') return { team: me, who, role: 'reserve', at, how: h };
    return null;
  }
  sentenceFor({ who, what, at, how }) {
    const W = WHAT.find(x => x.k === what) || INTENT.find(x => x.k === what), name = Array.isArray(who) ? who.join(', ') : who === 'fresh' ? 'Fresh squads' : 'Everyone';
    return [name, W ? W.name.toLowerCase() : what, at ? 'the ' + at : ''].filter(Boolean).join(' ') + (how && !(what === 'ambush' && how === 'quietly') ? ', ' + how : '');
  }
  get match() { return this.app.match; }
  get me() { return this.app.playerTeam ?? 0; }
  get on() { return !!(this.match && this.match.hybrid && this.match.orders); }
  toggle() { if (this.open_) this.close(); else this.open(); }
  open() {
    if (!this.on || !this.el) return;
    this.open_ = true; this.el.hidden = false; this.step = 0; this.what = null; this.mods = { quiet: false, costs: false }; this.pending = null; this.busyText = false;
    const sel = [...new Set(this.app.input.selected.filter(u => u.squad && u.team === this.me && !u.dead).map(u => u.squad))];   // a selection is the who
    this.who = sel.length ? { k: 'sel', ids: sel.map(s => s.members[0].label), squads: sel } : null; if (this.who) this.step = 1;
    this.sugg = this.suggestions(); this.render(); this.btn.classList.add('on'); document.body.classList.add('wheel-open');
  }
  close() { this.open_ = false; if (this.el) this.el.hidden = true; if (this.btn) this.btn.classList.remove('on'); document.body.classList.remove('wheel-open'); }
  back() { if (this.step === 2) { this.what = null; this.step = 1; } else if (this.step === 1) { this.who = null; this.step = 0; } this.render(); }
  squads() { return this.match.units.squads.filter(s => s.team === this.me && s.leader); }
  freshSquads() { const b = this.match.teams[this.me].base; return this.squads().filter(s => { const c = s.centroid(); return Math.hypot(c.x - b.x, c.z - b.z) < b.r + 30; }); }
  places() { const o = this.match.objectives; return o ? o.list : []; }
  subjectPos() { if (this.who && this.who.squads && this.who.squads.length) { const c = this.who.squads[0].centroid(); return { x: c.x, z: c.z }; } return this.match.teams[this.me].base; }
  // the pills for the step
  items() {
    const me = this.me, o = this.match.objectives;
    if (this.step === 0) return [{ k: 'all', name: 'Everyone', glyph: 'flag' }, { k: 'fresh', name: 'Fresh', glyph: 'base', title: 'the squads at base' }, ...this.squads().map(s => ({ k: s.members[0].label, name: s.members[0].label, cls: s.manual ? 'hand' : '', title: s.manual ? 'in your hand' : '' }))];
    if (this.step === 1) { const all = this.who.k === 'all'; return [...WHAT.filter(w => !(all && w.k === 'grab')), ...(all ? INTENT.map(i => ({ ...i, cls: 'intent' })) : [])]; }
    const w = WHAT.find(x => x.k === this.what), p = this.subjectPos(), m = this.match;
    const foes = m.vision ? m.vision.contacts(me).filter(u => !u.spec.structure && !(u.spec.air && u.alt > 2)) : [];   // what we see at each place: men, and vehicles counted as four
    const seen = (l) => { const near = foes.filter(f => Math.hypot(f.pos.x - l.x, f.pos.z - l.z) < l.r + 40), inf = near.filter(f => f.type === 'soldier').length, veh = near.length - inf; return { badge: inf + veh ? `${inf}${veh ? ' +' + veh + ' veh' : ''}` : '', weight: inf + veh * 4 }; };
    let L = this.places().map(l => ({ l, d: Math.hypot(l.x - p.x, l.z - p.z) }));
    if (w.where === 'ours') L = L.filter(x => x.l.owner === me);
    if (w.where === 'free') L = L.filter(x => x.l.owner !== me && o && o.capturable(me, x.l));
    L.sort((a, b) => a.d - b.d);
    const items = L.slice(0, 8).map(x => { const s = seen(x.l); return { k: 'at:' + x.l.name, name: x.l.name, cls: x.l.owner === me ? 'ours' : x.l.owner >= 0 ? 'theirs' : '', title: `${Math.round(x.d)} m${s.badge ? ', ' + s.badge + ' seen' : ''}`, badge: s.badge, weight: s.weight }; });
    if (w.k !== 'take' && w.k !== 'grab') items.push({ k: 'here', name: 'Here', glyph: 'move', title: 'then tap the ground' });
    return items;
  }
  render() {
    const items = this.items(), n = items.length, R = n > 8 ? 144 : 118; this.lastItems = items;
    for (const e of this.ring.querySelectorAll('.w-seg')) e.remove();
    items.forEach((it, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, b = document.createElement('button');
      b.type = 'button'; b.className = 'w-seg' + (it.cls ? ' ' + it.cls : ''); b.dataset.k = it.k; b.title = it.title || it.name;
      b.style.setProperty('--dx', `${Math.round(R * Math.cos(a))}px`); b.style.setProperty('--dy', `${Math.round(R * Math.sin(a))}px`);
      b.innerHTML = `${it.glyph ? icon(it.glyph) : ''}<span>${it.name}</span>${it.badge ? `<em>${it.badge}</em>` : ''}`; this.ring.appendChild(b);
    });
    this.hub.className = 'w-hub' + (this.step ? ' back' : '');
    this.hub.innerHTML = this.step === 0 ? '<small>who</small><b>?</b>' : this.step === 1 ? `<small>what</small><b>${this.whoName()}</b>` : `<small>where</small><b>${this.whatName()}</b><small>tap: back</small>`;
    this.renderBar(); this.renderChips();
  }
  whoName() { return !this.who ? '' : this.who.k === 'all' ? 'Everyone' : this.who.k === 'fresh' ? 'Fresh squads' : this.who.ids.join(', '); }
  whatName() { const w = WHAT.find(x => x.k === this.what) || INTENT.find(x => x.k === this.what); return w ? w.name : ''; }
  renderBar() { this.say.textContent = this.sentence(); this.modsEl.innerHTML = `<button type="button" data-m="quiet" class="${this.mods.quiet ? 'on' : ''}">quietly</button><button type="button" data-m="costs" class="${this.mods.costs ? 'on' : ''}">at all costs</button>`; }
  renderChips() { this.chips.innerHTML = this.sugg.map((s, i) => `<button type="button" data-i="${i}"${s.co ? ' class="co"' : ''}>${s.text}</button>`).join(''); }
  // what the CO is doing, from the strategist's last plan tick and the squads' tags, with a model CO's own notes after it
  planText() {
    const m = this.match, s = (m.strategists || []).find(x => x.team === this.me); if (!s) return 'No CO on our side.';
    const P = s.lastPlan, sq = this.squads(), n = (re) => sq.filter(x => x.tag && re.test(x.tag)).length, attacking = n(/^(cap|approach|stage)/), holding = n(/^(hold|post|reserve|screen|aa)/), hand = sq.filter(x => x.manual).length;
    const notes = s.remote && s.remote.plan ? (s.remote.plan.notes || s.remote.plan.reason || '') : '';
    if (!P) return notes || 'Planning.';
    const holds = P.hold ? [P.hold, ...(P.holds || []).filter(h => h !== P.hold)] : [];
    const head = `${P.attack ? `Taking the ${P.attack} with ${attacking} squad${attacking === 1 ? '' : 's'}` : 'No attack'}${holds.length ? `, holding the ${holds.join(' and the ')} with ${holding}` : ''}${hand ? `, ${hand} in your hand` : ''}, ${P.posture}.`;
    return notes ? `${head} ${notes}` : head;
  }
  showPlan() { const t = this.planText(); this.say.textContent = t; if (this.match.event) this.match.event({ type: 'radio', team: this.me, who: 'CO', text: t }); }
  sentence(at) {
    const who = this.whoName(), what = this.whatName().toLowerCase();
    return [who, what, at ? 'the ' + at : ''].filter(Boolean).join(' ') + (this.mods.quiet && this.what !== 'ambush' ? ', quietly' : '') + (this.mods.costs ? ', at all costs' : '');
  }
  pick(k) {
    if (this.step === 0) { this.who = k === 'all' ? { k: 'all' } : k === 'fresh' ? { k: 'fresh' } : { k: 'sel', ids: [k], squads: this.squads().filter(s => s.members[0].label === k) }; this.step = 1; return this.render(); }
    if (this.step === 1) {
      this.what = k; const w = WHAT.find(x => x.k === k), it = INTENT.find(x => x.k === k);
      if (it) return this.send({ team: this.me, intent: it.k, how: this.how() }, this.sentence());
      if (w && w.k === 'rejoin') return this.send({ team: this.me, who: this.whoSpec(), intent: 'rejoin' }, this.sentence());
      this.step = 2; return this.render();
    }
    if (k === 'here') { this.close(); this.app.hud.toast(`${this.app.touch ? 'Tap' : 'Click'} the ground`); this.app.input.pickGround((x, z) => this.here(x, z)); return; }
    const at = k.slice(3), it = (this.lastItems || []).find(x => x.k === k), lone = this.who.k === 'sel' && this.who.ids.length === 1;
    if (this.send(this.spec(at), this.sentence(at)) && lone && it && it.weight >= 8) this.app.hud.toast(`${it.badge} seen at the ${at}: one squad alone? Everyone, then Take, sends the lot`);   // sent all the same: the player's call
  }
  how() { return this.mods.costs ? 'at all costs' : this.mods.quiet ? 'quietly' : undefined; }
  whoSpec() { return this.who.k === 'sel' ? this.who.ids : this.who.k; }
  spec(at) { return this.specFor({ who: this.whoSpec(), what: this.what, at, how: this.how() }); }
  send(spec, text) {
    if (!spec) return; const r = this.match.orders.add({ ...spec, text });
    if (r.error) { this.app.hud.toast(`Can't: ${r.error}`); if (this.app.audio) this.app.audio.ui('deny'); return false; }
    if (this.app.audio) this.app.audio.ui('order'); this.close(); return true;
  }
  // "Here": the squads go to the point by the player's own hand (an ambush there holds fire)
  here(x, z) {
    const sq = this.who.k === 'sel' ? this.who.squads : this.who.k === 'fresh' ? this.freshSquads() : this.squads();
    const inp = this.app.input, prev = inp.selected, men = sq.flatMap(s => s.members.filter(u => !u.dead)); if (!men.length) return;
    inp.selected = men; inp.orderAt(x, z); inp.selected = prev;
    const quiet = this.what === 'ambush' || this.mods.quiet; if (quiet) for (const s of sq) s.setHoldFire(true);
    this.app.hud.toast(`${this.whoName()} ${this.what === 'ambush' ? 'ambush' : this.whatName().toLowerCase()} here${quiet ? ', quietly' : ''} · in your hand`);
  }
  // three orders the rules suggest: the nearest place we can take (the fresh squads, or everyone); a place of ours with enemies
  // round it and few of ours; the idle squad nearest to screen our farthest place; else hold the line or press
  suggestions() {
    const m = this.match, me = this.me, o = m.objectives, out = []; if (!o) return out;
    // the CO's own: release a squad whose order has it hiding, refused or stuck; rejoin a squad left idle in the player's hand
    const co = [], sqAll = this.squads();
    for (const ord of m.orders ? m.orders.active(me) : []) if (Array.isArray(ord.who) && (ord.refusedNote || (ord.note && ord.note !== 'taken, now holding' && ord.note !== 'gathering before going in'))) co.push({ co: true, text: `release ${ord.who.join(', ')} (${noteHead(ord.refusedNote || ord.note)})`, spec: { team: me, who: ord.who, intent: 'rejoin' } });
    for (const s of sqAll) if (s.manual && s.idleSince != null && m.elapsed - s.idleSince > 20) co.push({ co: true, text: `${s.members[0].label} rejoin (idle in your hand)`, spec: { team: me, who: [s.members[0].label], intent: 'rejoin' } });
    out.push(...co.slice(0, 2));
    const base = m.teams[me].base, L = o.list, ours = L.filter(l => l.owner === me), fresh = this.freshSquads(), sq = this.squads(), dist = (l) => Math.hypot(l.x - base.x, l.z - base.z);
    const cap = L.filter(l => l.owner !== me && o.capturable(me, l)).sort((a, b) => dist(a) - dist(b))[0];
    if (cap) out.push(fresh.length ? { text: `Fresh squads take the ${cap.name}`, spec: { team: me, who: 'fresh', role: 'hold', at: cap.name } } : { text: `Everyone take the ${cap.name}`, spec: { team: me, intent: 'take', at: cap.name } });
    const foes = m.vision ? m.vision.contacts(me).filter(u => !u.spec.structure && !(u.spec.air && u.alt > 2)) : [];
    const hot = ours.map(l => ({ l, n: foes.filter(f => Math.hypot(f.pos.x - l.x, f.pos.z - l.z) < 120).length, mine: sq.filter(s => { const c = s.centroid(); return Math.hypot(c.x - l.x, c.z - l.z) < l.r + 20; }).length })).filter(x => x.n > 0 && x.n > x.mine * 2).sort((a, b) => b.n - a.n)[0];
    if (hot) out.push({ text: `Everyone hold the ${hot.l.name}`, spec: { team: me, who: 'all', role: 'hold', at: hot.l.name } });
    const idle = sq.find(s => !s.busy && !s.manual && !s.members.some(u => u.enemy)), front = ours.slice().sort((a, b) => dist(b) - dist(a))[0];
    if (idle && front && out.length < 3) out.push({ text: `${idle.members[0].label} screen the ${front.name}`, spec: { team: me, who: [idle.members[0].label], role: 'screen', at: front.name } });
    if (out.length < 3) out.push(o.owned(me) * 2 > L.length ? { text: 'Everyone hold the line', spec: { team: me, intent: 'hold the line' } } : { text: 'Everyone press', spec: { team: me, intent: 'press' } });
    return out.slice(0, 4);
  }
}
