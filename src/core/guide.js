import { RULES } from '../game/rules.js';
import { REVIVE_WINDOW } from '../game/support.js';

// Player help. The field manual (H, the Manual button, ? on touch) explains how to win and what each tool is for; the
// game pauses while it is open. It opens by itself on the objective page at the player's first match (the briefing).
// Hints: a card the first time something becomes useful (an engineer beside a supply truck, a squad far from home, enemy
// armour in sight); each shows once per browser, and the Hints setting turns them off. Both say "tap" and name the
// buttons on a touch screen. Seen hints and the briefing are kept in localStorage (pixelops.guide).
const STORE = 'pixelops.guide';
const T = RULES.ticketCost, F = RULES.fob, RA = RULES.rally, SB = RULES.sandbags, V = RULES.vision.sight, RS = RULES.respawnTime;

// the manual's pages; t: touch screen. k(key, tap) shows a key, or what to tap instead
const PAGES = [
  { title: 'Objective', body: (t, k) => `
    <p>Each side has <b>${RULES.startTickets.aas} tickets</b>. You lose when yours run out, or when the ${RULES.matchLength / 60}-minute clock runs out and you have fewer.</p>
    <p><b>Places</b> (the bar at the top): stand inside a place's circle with no enemies in it and it turns yours. You can take a place that touches your base or borders one you hold. Hold more than half and the enemy loses a ticket every ${RULES.bleedEvery} s; take every place and you win outright.</p>
    <p><b>Tickets go</b> when a soldier comes back (${T.soldier}), a vehicle is destroyed (truck ${T.truck}, supply truck ${T.supply}, APC ${T.apc}, tank ${T.tank}, helicopter ${T.heli}), a FOB is destroyed (${T.fob}) and a place is lost (${T.location}).</p>
    <p>Infantry are cheap and come back; vehicles, FOBs and places are what cost you. Other modes (chosen in the lobby) change the goal.</p>
    <p class="tip">${k('H', 'the ? button')} opens this manual at any time; the game pauses while it is open.</p>` },
  { title: 'Controls', body: (t, k) => t ? `
    <p><b>Tap</b> a unit to select it, <b>tap the ground</b> to move there, <b>tap an enemy</b> to attack-move onto it. <b>Hold</b>, then drag, for a selection box.</p>
    <p><b>Drag</b> to pan, <b>pinch</b> to zoom, <b>twist</b> to rotate, <b>three fingers</b> to tilt.</p>
    <p>Tap one of <b>your vehicles</b> with soldiers selected to board it, or your <b>sandbags</b> to man them. The buttons under the selection build a FOB, dig in, drop a rally point, unload.</p>
    <p>Bottom bar: Box, Clear, Follow, Pause, Base (the camera to your base), sound, and ? for this manual.</p>` : `
    <p><b>Left click</b> select, drag for a box. <b>Right click</b> the ground to move, an enemy to attack-move onto it, one of <b>your vehicles</b> to board it, your <b>sandbags</b> to man them.</p>
    <p><b>WASD</b> or the screen edge pans, <b>wheel</b> zooms, <b>Q E</b> or right-drag rotates, middle-drag pans. <b>F</b> follows the selection, <b>R</b> resets the view, <b>Space</b> pauses, <b>Esc</b> clears the selection, <b>M</b> sound.</p>
    <p><b>B</b> build a FOB, <b>N</b> dig a sandbag position, <b>T</b> drop a rally point, <b>U</b> unload a vehicle or leave a position, <b>H</b> this manual. The buttons under the selection do the same.</p>` },
  { title: 'Squads', body: (t, k) => `
    <p>Squads of four, each man with a kit: <b>rifle</b>; <b>machine gun</b>, which pins a squad down; <b>anti-tank</b>, rockets that kill vehicles from 90 m; <b>medic</b>, who revives a fallen squadmate within ${REVIVE_WINDOW} s; <b>engineer</b>, who repairs vehicles and builds FOBs and sandbags; <b>marksman</b>, who picks off infantry at 110 m.</p>
    <p>Soldiers kneel to shoot and go flat under heavy fire. A <b>suppressed</b> squad shoots badly and crawls: machine guns and explosions do that.</p>
    <p><b>Cover</b>: a wall or rock right in front of a soldier halves his chance of being hit; buildings and hills block sight and fire.</p>
    <p>A fallen soldier comes back after ${RS.soldier} s, with squadmates who fell about the same time, for ${T.soldier} ticket. Where he comes back is the next page.</p>` },
  { title: 'Spawns: FOBs and rally points', body: (t, k) => `
    <p>Every fallen soldier walks back to the fight from where he comes back, so <b>where your spawns are decides how fast an attack refills</b>. He comes back at the one nearest his squad (nearest where he fell, if the whole squad is down).</p>
    <p><b>Main base</b>: always there, and far from the front.</p>
    <p><b>FOB</b> (forward operating base): a spawn for <b>every squad</b>, and it lasts. It takes a FOB kit from your loadout, an engineer squad and a supply truck with ${F.supplyCost} supplies within ${F.buildRange} m: select the engineers and ${k('B', 'Build FOB')}. ${F.buildTime} s to build; not within ${F.minSpacing} m of another FOB or ${F.enemyBaseDistance} m of the enemy base. Losing one costs <b>${T.fob} tickets</b>, so build it behind the place you are pushing for, not on it.</p>
    <p><b>Rally point</b>: <b>one squad's</b> own spawn, cheap and quick. Select the squad and ${k('T', 'Rally')}: it goes down where the leader stands (a squadmate within ${RA.placeRange} m, no enemy within ${RA.blockRadius} m, once a minute). The squad comes back there every ${RA.wave} s. Any enemy within ${RA.burnRadius} m burns it. Drop one when a squad reaches the fight.</p>
    <p>Air Assault can also come back beside a landed helicopter, Light Infantry beside a parked troop truck. The Reinforcements panel can send everyone to the main base instead.</p>` },
  { title: 'Sandbags', body: (t, k) => `
    <p>An engineer next to a supply truck (${SB.supplyCost} supplies): ${k('N', 'Sandbags')} digs a U of sandbags in ${SB.buildTime} s, open at the back. Up to ${SB.max}; not on a road.</p>
    <p>${t ? 'Tap' : 'Right-click'} it with a squad selected to <b>man</b> it: four firing slots. Men in it are hit about a third as often from the front and sides and shrug off half the suppression. ${k('U', 'Leave')} walks them out.</p>
    <p>The enemy digs in too: expect positions at the places it holds, facing your way.</p>` },
  { title: 'Transport', body: (t, k) => `
    <p>Trucks carry 8, APCs 4, helicopters 8. Select soldiers and ${t ? 'tap' : 'right-click'} one of your vehicles to board it. Move the vehicle; the passengers get out where it stops, or press ${k('U', 'Unload')}. A helicopter has to land first.</p>
    <p><b>Supply trucks</b> carry supplies, not troops: ${F.truckSupplies} each, refilled at your main base. FOBs and sandbags are built from them.</p>
    <p>On Palm Valley vehicles cannot use the footbridge, and everyone wades the ford at half speed.</p>` },
  { title: 'Vehicles', body: (t, k) => `
    <p><b>APC</b>: an autocannon that reaches 150 m, carries a squad. <b>Tank</b>: a 120 mm gun that reaches 200 m and a machine gun; armour thickest at the front, thinnest at the back. <b>Helicopter</b>: door guns, flies squads over everything.</p>
    <p><b>Anti-tank rockets reach 90 m.</b> Keep armour back from infantry you cannot see, and use it from range. Engineers repair vehicles.</p>
    <p>A destroyed vehicle costs tickets and comes back at the main base later: truck ${RS.truck} s, APC ${RS.apc} s, helicopter ${RS.heli} s, tank ${RS.tank} s.</p>` },
  { title: 'Fog of war', body: (t, k) => `
    <p>You see only what your units see: soldiers ${V.soldier} m, APCs ${V.apc} m, tanks ${V.tank} m, trucks ${V.truck} m, a helicopter in the air ${V.air} m, over buildings. Hills and buildings block sight.</p>
    <p><b>Darker ground</b> is out of sight. A <b>red outline</b> marks where an enemy was last seen, for ${RULES.vision.ghost} s. A unit that fires shows itself for ${RULES.vision.reveal} s.</p>
    <p>FOBs, sandbags and rally points stay on the map once spotted. Places and their capture bars always show. The enemy plays by the same rules: scout before you commit.</p>
    <p class="tip">Fog shading (the panel on the right) turns the darkening off and keeps only the hidden enemies.</p>` },
];

export class Guide {
  constructor(app) {
    this.app = app; this.page = 0; this.isOpen = false; this.acc = 0; this.hintT = 0;
    try { this.store = JSON.parse(localStorage.getItem(STORE)) || {}; } catch { this.store = {}; }
    this.store.seen = this.store.seen || []; if (this.store.hints === undefined) this.store.hints = true;
    const el = this.el = document.createElement('div'); el.id = 'manual'; el.className = 'panel';
    el.innerHTML = `<div class="hd"><span>FIELD MANUAL</span><button class="x" title="close">Close</button></div><div class="bd"><nav></nav><article></article></div>`;
    document.getElementById('app').appendChild(el);
    el.querySelector('.x').addEventListener('click', () => this.close());
    this.nav = el.querySelector('nav'); this.art = el.querySelector('article');
    PAGES.forEach((p, i) => { const b = document.createElement('button'); b.textContent = p.title; b.addEventListener('click', () => this.show(i)); this.nav.appendChild(b); });
    const hint = this.hintEl = document.createElement('div'); hint.id = 'hint'; hint.className = 'panel';
    hint.innerHTML = `<div class="tx"></div><div class="row"><button class="ok">Got it</button><button class="more">Manual</button></div>`;
    document.getElementById('app').appendChild(hint);
    hint.querySelector('.ok').addEventListener('click', () => this.dropHint());
    hint.querySelector('.more').addEventListener('click', () => { this.dropHint(); this.open(this.hintPage || 0); });
    this.art.addEventListener('click', (e) => { const a = e.target.closest('[data-page]'); if (a) this.show(+a.dataset.page); });
  }
  save() { try { localStorage.setItem(STORE, JSON.stringify(this.store)); } catch {} }
  key(k, tap) { return this.app.touch ? `<b>${tap}</b>` : `<kbd>${k}</kbd>`; }

  // ---- the manual
  show(i) {
    this.page = i; const p = PAGES[i];
    this.art.innerHTML = `<h3>${p.title}</h3>${p.body(this.app.touch, (k, tap) => this.key(k, tap))}`;
    [...this.nav.children].forEach((b, j) => b.classList.toggle('on', j === i));
  }
  open(i = this.page) {
    const hud = this.app.hud; this.wasPaused = hud.paused; hud.setPaused(true, true);
    this.isOpen = true; this.el.style.display = 'flex'; this.show(i); this.dropHint();
  }
  close() { if (!this.isOpen) return; this.isOpen = false; this.el.style.display = 'none'; this.app.hud.setPaused(this.wasPaused, true); }
  toggle() { this.isOpen ? this.close() : this.open(); }

  // ---- hints
  hint(id, text, page = 0) {
    if (!this.store.hints || this.store.seen.includes(id) || this.isOpen || this.hintEl.style.display === 'block') return false;
    this.store.seen.push(id); this.save(); this.hintPage = page;
    this.hintEl.querySelector('.tx').innerHTML = text; this.hintEl.style.display = 'block'; this.hintT = 16;
    return true;
  }
  dropHint() { this.hintEl.style.display = 'none'; }
  setHints(on) { this.store.hints = on; this.save(); if (!on) this.dropHint(); }

  // checked twice a second during a match the player plays (not while spectating, nor once it is over)
  tick(dt) {
    if (this.hintEl.style.display === 'block' && !this.app.hud.paused && (this.hintT -= dt) <= 0) this.dropHint();
    if ((this.acc += dt) < 0.5) return; this.acc = 0;
    const a = this.app, m = a.match, me = a.playerTeam ?? 0;
    if (!m || m.state !== 'play' || m.cpu.includes(me)) return;
    if (!this.store.briefed && m.elapsed > 0.5) { this.store.briefed = true; this.save(); this.open(0); return; }   // the first match: the objective page
    const t = a.touch, k = (key, tap) => this.key(key, tap), U = a.units.units, sel = (a.input && a.input.selected) || [], V = m.vision;
    const mine = (u) => u.team === me && !u.dead, near = (p, q, r) => Math.hypot(p.pos.x - q.pos.x, p.pos.z - q.pos.z) < r;
    const soldiers = sel.filter(u => mine(u) && u.type === 'soldier' && !u.mounted), squads = [...new Set(soldiers.map(u => u.squad).filter(Boolean))];
    const base = m.teams[me].base, sees = (u) => !V || V.sees(me, u);
    if (!this.store.seen.includes('start')) { if (m.elapsed > 1) this.hint('start', `Take the places next to yours: your own row is free to grab. Hold more than half and the enemy's tickets bleed. ${k('H', 'The ? button')} opens the field manual.`, 0); return; }   // the first hint, before any other
    if (soldiers.length && this.hint('squad', `${t ? 'Tap' : 'Right-click'} the ground to move, an enemy to attack. Soldiers use walls and rocks for cover, and buildings block sight.`, 1)) return;
    const eng = soldiers.find(u => u.kit === 'engineer'), truck = eng && U.find(v => mine(v) && v.supply && near(v, eng, F.buildRange));
    if (truck && this.hint('engineer', `Engineers beside a supply truck: ${k('B', 'Build FOB')} builds a FOB, a spawn point for every squad; ${k('N', 'Sandbags')} digs a sandbag position.`, 3)) return;
    const far = squads.find(sq => { const c = sq.centroid(); return Math.hypot(c.x - base.x, c.z - base.z) > 250 && !(sq.rally && !sq.rally.dead); });
    if (far && this.hint('rally', `This squad is a long walk from your base. ${k('T', 'Rally')} drops a rally point: its men come back here every ${RA.wave} s instead.`, 3)) return;
    const ride = soldiers.length && U.find(v => mine(v) && v.seats && !v.supply && v.passengers.length < v.seats && soldiers.some(s => near(s, v, 40)));
    if (ride && this.hint('board', `${t ? 'Tap' : 'Right-click'} the ${ride.type === 'heli' ? 'helicopter' : ride.type === 'apc' ? 'APC' : 'truck'} to put the squad aboard; select it and ${k('U', 'Unload')} to let them out.`, 5)) return;
    const bags = soldiers.length && U.find(s => mine(s) && s.type === 'sandbags' && s.freeSlots === 4 && soldiers.some(u => near(u, s, 30)));   // an empty position close by
    if (bags && this.hint('man', `${t ? 'Tap' : 'Right-click'} the sandbag position to man it: men in it are much harder to hit.`, 4)) return;
    if (U.some(u => !u.dead && u.team !== me && (u.type === 'apc' || u.type === 'tank') && sees(u)) && this.hint('armour', `Enemy armour. Only anti-tank rockets hurt it, from 90 m; keep other squads in cover.`, 6)) return;
    if (V && V.on && V.ghosts[me].size && this.hint('ghost', `A red outline marks where an enemy was last seen. It may have moved on.`, 7)) return;
    const drained = m.objectives && m.objectives.list.find(l => l.owner === me && l.pushing === 1 - me);
    if (drained && this.hint('drain', `${drained.name} is being taken: its bar is draining. Send someone, or lose ${T.location} tickets.`, 0)) return;
    if (a.units.squads.some(sq => sq.team === me && sq.members.every(u => u.dead)) && this.hint('wiped', `A squad wiped out comes back at the spawn nearest where it fell: the main base, a FOB or its rally point.`, 3)) return;
  }
}
