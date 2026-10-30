import { RULES } from '../game/rules.js';
import { REVIVE_WINDOW } from '../game/support.js';
import { WEAPONS as W } from '../game/weapons.js';

// Player help. The field manual (H, the Manual button, ? on touch) explains how to win and what each tool is for; the
// game pauses while it is open. It opens by itself on the objective page at the player's first match (the briefing).
// Hints: a card the first time something becomes useful (an engineer beside a supply truck, a squad far from home, enemy
// armour in sight); each shows once per browser, and the Hints setting turns them off. Both say "tap" and name the
// buttons on a touch screen. Seen hints and the briefing are kept in localStorage (pixelops.guide).
const STORE = 'pixelops.guide';
const T = RULES.ticketCost, F = RULES.fob, E = RULES.emplacement, RA = RULES.rally, SB = RULES.sandbags, TT = RULES.traps, V = RULES.vision.sight, RS = RULES.respawnTime;

// the objective page follows the match: its mode and numbers, and which side the player is on (before a match, Advance & Secure)
const objective = (ctx = {}) => {
  const m = ctx.m, M = m && m.mode, C = M ? M.constructor : null, key = C ? C.key : 'aas', me = ctx.me ?? 0;
  const mins = Math.round((M ? M.length : RULES.matchLength) / 60), att = M && C.sides ? M.attacker : null, tk = (team) => M ? M.tickets(team) : RULES.startTickets.aas;
  const side = att === null ? '' : ` You are <b>${att === me ? 'attacking' : 'defending'}</b>.`;
  const places = `<p><b>Places</b> (the bar at the top): stand inside a place's circle with no enemies in it and it turns yours. You can take a place that touches your base or borders one you hold.</p>`;
  const sea = m && m.landing ? `<p>The attacker's main base is a ship. Its men and vehicles come ashore in landing craft at the beach it picks, and its three landing places can be taken first, in any order; everything the defender sends crosses the canal bridge. The Transport page has the rest.</p>` : '';
  const lost = key === 'invasion' ? `and a place lost by the defenders (30)` : `and a place is lost (${T.location})`;
  const costs = `<p><b>Tickets go</b> when a soldier comes back (${T.soldier}), a vehicle is destroyed (truck ${T.truck}, supply truck ${T.supply}, APC ${T.apc}, tank ${T.tank}, helicopter ${T.heli}, Little Bird ${T.bird}${m && m.landing ? `, landing craft ${T.craft}` : ''}), a FOB is destroyed (${T.fob}), a FOB gun is destroyed (${T.emplacement}) ${lost}. A side whose tickets run out loses.</p>`;
  if (key === 'invasion') return `
    <p><b>Invasion.</b>${side} The attackers must hold <b>every place</b> before the ${mins}-minute clock runs out; the defenders start with all of them and win by holding out. Attackers have <b>${tk(att)}</b> tickets, defenders <b>${tk(1 - att)}</b>. Holding more places bleeds no one here: only the clock and the places count.</p>
    ${places}${sea}${costs}`;
  if (key === 'aas') return `
    <p><b>Advance &amp; Secure.</b> Each side has <b>${tk(0)} tickets</b>. You lose when yours run out, or when the ${mins}-minute clock runs out and you have fewer.</p>
    ${places.replace('</p>', ` Hold more than half and the enemy loses a ticket every ${RULES.bleedEvery} s; take every place and you win outright.</p>`)}${costs}
    <p>Infantry are cheap and come back; vehicles, FOBs and places are what cost you. Other modes (chosen in the lobby) change the goal.</p>`;
  return `
    <p><b>${C.name}.</b>${side} ${C.desc} ${att === null ? `Each side has <b>${tk(0)}</b> tickets` : `Attackers have <b>${tk(att)}</b> tickets, defenders <b>${tk(1 - att)}</b>`}; the clock runs ${mins} minutes.</p>${costs}`;
};

// the manual's pages; t: touch screen. k(key, tap) shows a key, or what to tap instead; ctx: the match and the player's team
// the unit strip, the same on both control pages
const STRIP = (t) => `<p><b>The unit strip</b> along the bottom has a card for every squad, vehicle and build, saying what it is doing; a red edge means under fire, a grey card a squad waiting to respawn, with the time left. ${t ? 'Tap' : 'Click'} a card to select it, ${t ? 'tap' : 'click'} it again to go there, hold it to follow. <b>Under fire</b> and <b>Idle</b> step through those units, and pointers on the screen edge show where units out of view are. ${t ? '<b>+</b> makes a group of the selection; tap its number to select it again, hold the number to remove it.' : '<b>Ctrl</b> or <b>Shift</b> + <b>1</b>–<b>9</b> (or <b>+</b>) makes a group of the selection, <b>1</b>–<b>9</b> selects it, twice goes there.'}</p>`;
const PAGES = [
  { title: 'Objective', body: (t, k, ctx) => `${objective(ctx)}
    <p><b>Capture rings.</b> Every place wears a ring on the ground at its capture radius: the holder's colour, blue or red, solid while it is held, dashed in the taking side's colour while a side is capturing it, faint grey when nobody holds it. Stand inside the ring to capture; it shows through walls and roofs. The Capture rings setting turns them off.</p>
    <p class="tip">${k('H', 'the ? button')} opens this manual at any time; the game pauses while it is open.</p>` },
  { title: 'Controls', body: (t, k) => t ? `
    <p><b>Tap</b> a unit to select it, <b>tap the ground</b> to move there, <b>tap an enemy</b> to attack-move onto it. <b>Advance</b>, then tap the ground, is an attack-move there: the squad stops and fights whatever comes into range on the way, where a plain move walks through fire. <b>Hold fire</b> keeps a squad quiet and hidden, no target and no shot, until an enemy comes within 20 m or it is fired on, then it opens up (an ambush); press again to fire at will. <b>Hold</b>, then drag, for a selection box.</p>
    <p><b>Drag</b> to pan, <b>pinch</b> to zoom, <b>twist</b> to rotate, <b>three fingers</b> to tilt.</p>
    <p>To board, select soldiers, press <b>Load</b>, then tap one of <b>your vehicles</b> (or hold on the vehicle). Tapping a vehicle otherwise just selects it. Tap your <b>sandbags</b> or a <b>FOB gun</b> with soldiers selected to man it. The command bar over the unit strip holds the rest: <b>Orders</b> (Follow, Rally, Load, Unload, Deselect) and, with engineers, <b>Build</b>, each with its supply cost. A greyed tile says why in a word; tap it for the whole reason.</p>
    <p>Top left: Box (drag a selection box), Pause, Base (the camera to your base), ? for this manual, sound, and the engine panels.</p>${STRIP(t)}` : `
    <p><b>Left click</b> select, drag for a box. <b>Right click</b> the ground to move (<b>Alt + right click</b>, or <b>Z</b> then a click, to attack-move there: the squad stops and fights whatever comes into range on the way, where a plain move walks through fire), an enemy to attack-move onto it, one of <b>your vehicles</b> to board it, your <b>sandbags</b> or a <b>FOB gun</b> to man it.</p>
    <p><b>WASD</b> or the screen edge pans, <b>wheel</b> zooms, <b>Q E</b> or right-drag rotates, middle-drag pans. <b>F</b> follows the selection, <b>R</b> resets the view, <b>Space</b> pauses, <b>Esc</b> clears the selection, <b>M</b> sound, <b>F3</b> the engine panels (stats, spawning, render and world settings).</p>
    <p><b>L</b> load the selected soldiers into the vehicle you click next, <b>Z</b> attack-move to the ground you click next, <b>O</b> hold fire or fire at will (a squad holding fire stays quiet and hidden until an enemy is within 20 m or it is fired on), <b>B</b> build a FOB, <b>N</b> dig a sandbag position, <b>X</b> lay or clear tank traps, <b>G J K</b> set up a heavy machine gun, anti-tank launcher or mortar at a FOB, <b>T</b> drop a rally point, <b>U</b> unload a vehicle or leave a position, <b>C</b> cancel a build, <b>V</b> send the selected supply trucks home to refill and back, <b>H</b> this manual. The command bar over the unit strip does the same, grouped into Orders and Build.</p>${STRIP(t)}` },
  { title: 'Squads', body: (t, k) => `
    <p>Squads of four, each man with a kit: <b>rifle</b>; <b>machine gun</b>, which pins a squad down; <b>anti-tank</b>, rockets that kill vehicles from 90 m; <b>medic</b>, who revives a fallen squadmate within ${REVIVE_WINDOW} s; <b>engineer</b>, who repairs vehicles and builds FOBs and sandbags; <b>marksman</b>, who picks off infantry at 110 m.</p>
    <p>Soldiers kneel to shoot and go flat under heavy fire. A <b>suppressed</b> squad shoots badly and crawls: machine guns and explosions do that.</p>
    <p><b>Cover</b>: a wall or rock right in front of a soldier halves his chance of being hit; buildings and hills block sight and fire. <b>Thickets</b> (the woods on The Hollow) block sight like a wall but not bullets or men: infantry push through at half pace, see out from the edge, and a man inside is seen only from within 20 m or once he fires.</p>
    <p>A fallen soldier comes back after ${RS.soldier} s, with squadmates who fell about the same time, for ${T.soldier} ticket. Where he comes back is the next page.</p>` },
  { title: 'Spawns: FOBs and rally points', body: (t, k) => `
    <p>Every fallen soldier walks back to the fight from where he comes back, so <b>where your spawns are decides how fast an attack refills</b>. He comes back at the one nearest his squad (nearest where he fell, if the whole squad is down).</p>
    <p><b>Main base</b>: always there, and far from the front.</p>
    <p><b>FOB</b> (forward operating base): a spawn for <b>every squad</b>, and it lasts. It takes a FOB kit from your loadout, an engineer squad and a supply truck with ${F.supplyCost} supplies within ${F.buildRange} m: select the engineers and ${k('B', 'FOB')}. ${F.buildTime} s to build; not within ${F.minSpacing} m of another FOB or ${F.enemyBaseDistance} m of the enemy base. Losing one costs <b>${T.fob} tickets</b>, so build it behind the place you are pushing for, not on it.</p>
    <p><b>Rally point</b>: <b>one squad's</b> own spawn, cheap and quick. Select the squad and ${k('T', 'Rally')}: it goes down where the leader stands (a squadmate within ${RA.placeRange} m, no enemy within ${RA.blockRadius} m, once a minute). The squad comes back there every ${RA.wave} s. Any enemy within ${RA.burnRadius} m burns it. Drop one when a squad reaches the fight.</p>
    <p>Air Assault can also come back beside a landed helicopter, Light Infantry beside a parked troop truck. The respawn menu on the unit strip can send everyone to the main base instead.</p>` },
  { title: 'Sandbags and tank traps', body: (t, k) => `
    <p>An engineer next to a supply truck (${SB.supplyCost} supplies): ${k('N', 'Sandbags')} digs a U of sandbags in ${SB.buildTime} s, open at the back. Up to ${SB.max}; never on a road, a bridge deck or the railway, so a crossing stays open. Any engineer standing at a position clears it, yours or theirs: ${k('X', 'Clear')}, ${SB.clearTime} s.</p>
    <p>${t ? 'Tap' : 'Right-click'} it with a squad selected to <b>man</b> it: four firing slots. Men in it are hit about a third as often from the front and sides and shrug off half the suppression. ${k('U', 'Leave')} walks them out.</p>
    <p>The enemy digs in too: expect positions at the places it holds, facing your way.</p>
    <p><b>Tank traps</b>: an engineer next to a supply truck (${TT.supplyCost} supplies): ${k('X', 'Traps')} lays a row of steel hedgehogs, 15 m, across the road he stands on, in ${TT.buildTime} s. They stop <b>every</b> vehicle, yours too; infantry walk between them. Close a bridge or a ford and armour has to go the long way round. Up to ${TT.max} rows.</p>
    <p>Any engineer standing at a row clears it, yours or theirs: ${k('X', 'Clear')}, ${TT.clearTime} s (the same clears a sandbag position). The enemy lays them at crossings on its side when your armour is about, and clears its own when it wants to push through.</p>` },
  { title: 'FOB guns', body: (t, k) => `
    <p>Within ${E.fobRange} m of one of your FOBs, an engineer next to a supply truck sets up a gun where he stands: ${k('G', 'HMG')} a heavy machine gun (${E.hmg.supplyCost} supplies), ${k('J', 'AT gun')} an anti-tank launcher (${E.atgm.supplyCost}), ${k('K', 'Mortar')} a mortar (${E.mortar.supplyCost}). Up to ${E.perFob} per FOB, facing the enemy base; not on a road or right against the FOB.</p>
    <p>A gun fires only with a <b>gunner</b>: ${t ? 'tap' : 'right-click'} it with a squad selected, as with sandbags. One man works it, behind a low wall of sandbags; the rest of the squad waits beside it.</p>
    <p><b>Heavy machine gun</b>: ${W.hmg.range} m, long bursts that pin infantry down. <b>Anti-tank launcher</b>: guided missiles at vehicles and helicopters out to ${W.atgm.range} m. <b>Mortar</b>: shells over hills and buildings onto anything your side can see, ${W.mortar.min} to ${W.mortar.range} m; each one hurts everyone near where it lands.</p>
    <p>Guns don't move, and a destroyed one costs ${T.emplacement} tickets. The enemy sets them up at its FOBs too, and keeps a squad on them.</p>` },
  { title: 'Transport', body: (t, k) => `
    <p>Trucks carry 8, APCs 4, helicopters 8. Select soldiers, press ${k('L', 'Load')} and ${t ? 'tap' : 'click'} one of your vehicles${t ? ' (or hold on it)' : ' (or right-click it)'}: they walk over and get in, and the vehicle is selected, ready to drive. A squad standing together all go; a man back from a respawn a long way from the rest gets in alone when the vehicle is at him, and the rest keep their orders (and the other way round). Selecting soldiers and the vehicle together and pressing ${k('L', 'Load')} boards at once. Move the vehicle wherever you like: the passengers stay aboard until you press ${k('U', 'Unload')}. A helicopter circles where you send it, door gun firing, until ${k('U', 'Unload')} lands it and lets them out (${k('U', 'Land')} when nobody is aboard). Rockets braced at a helicopter hit it twice as often: the enemy's anti-tank squads go for yours. A Little Bird carries nobody: it circles where you send it, rockets and gatling working, and never lands; send it home to hover over your base, where its pod is refilled and its hull patched.</p>
    <p><b>Supply trucks</b> carry supplies, not troops: ${F.truckSupplies} each, refilled at your main base. FOBs, sandbags, tank traps and FOB guns are built from them. A truck left with too little for any job drives home on its own, fills up and comes back to where it was; <b>Refill</b> sends one any time.</p>
    <p>On Palm Valley vehicles cannot use the footbridge, and everyone wades the ford at half speed.</p>
    <p>On Peninsula the attacker's main base is an assault ship. Its helicopters fly from the deck; everything else waits in its well dock and goes ashore in landing craft, to the beach you pick beside the respawn choice (North Cove takes infantry only, so vehicles go to the nearest beach that takes them). A craft can be sunk with everyone aboard. A beach whose place you hold refills supply trucks; with none held, a truck waiting on the beach rides a craft back to the ship and returns full.</p>` },
  { title: 'Vehicles', body: (t, k) => `
    <p><b>APC</b>: an autocannon that reaches 150 m, carries a squad. <b>Tank</b>: a 120 mm gun that reaches 200 m and a machine gun; armour thickest at the front, thinnest at the back. <b>Helicopter</b>: door guns, flies squads over everything; it sets down only on clear dry ground or a deck, flying on to the nearest such spot within 60 m, and hovers with none. <b>Little Bird</b>: a gunship with a seven-shot rocket pod and a gatling, no seats; it circles where you send it and never lands, and hovering over your base refills its pod and patches it up.</p>
    <p><b>Anti-tank rockets reach 90 m.</b> Keep armour back from infantry you cannot see, and use it from range. Engineers repair vehicles.</p>
    <p>A destroyed vehicle costs tickets and comes back at the main base later: truck ${RS.truck} s, APC ${RS.apc} s, helicopter ${RS.heli} s, Little Bird ${RS.bird} s, tank ${RS.tank} s.</p>` },
  { title: 'Fog of war', body: (t, k) => `
    <p>You see only what your units see: soldiers ${V.soldier} m, APCs ${V.apc} m, tanks ${V.tank} m, trucks ${V.truck} m, a helicopter in the air ${V.air} m, over buildings. Hills and buildings block sight.</p>
    <p><b>Darker ground</b> is out of sight. A <b>red outline</b> marks where an enemy was last seen, for ${RULES.vision.ghost} s. A unit that fires shows itself for ${RULES.vision.reveal} s.</p>
    <p>FOBs, their guns, sandbags and rally points stay on the map once spotted. Places and their capture bars always show. The enemy plays by the same rules: scout before you commit.</p>
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
    this.art.innerHTML = `<h3>${p.title}</h3>${p.body(this.app.touch, (k, tap) => this.key(k, tap), { m: this.app.match, me: this.app.playerTeam ?? 0 })}`;
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
    if (m.elapsed > 20 && this.hint('strip', `Every squad, vehicle and build has a card on the strip at the bottom. ${t ? 'Tap' : 'Click'} a card to select it, ${t ? 'tap' : 'click'} it again to go there.`, 1)) return;
    if (soldiers.length && this.hint('squad', `${t ? 'Tap' : 'Right-click'} the ground to move, an enemy to attack. Soldiers use walls and rocks for cover, and buildings block sight.`, 1)) return;
    const eng = soldiers.find(u => u.kit === 'engineer'), truck = eng && U.find(v => mine(v) && v.supply && near(v, eng, F.buildRange));
    if (truck && this.hint('engineer', `Engineers beside a supply truck: ${k('B', 'FOB')} builds a FOB, a spawn point for every squad; ${k('N', 'Sandbags')} digs a sandbag position; ${k('X', 'Traps')} closes the road to vehicles.`, 3)) return;
    const fob = truck && m.fobs.active(me).find(f => near(f, eng, E.fobRange) && m.fobs.emplacementsAt(f) < E.perFob);
    if (fob && this.hint('guns', `Engineers by a supply truck near your FOB: ${t ? `${k('G', 'HMG')}, ${k('J', 'AT gun')} or ${k('K', 'Mortar')}` : `${k('G')} (machine gun), ${k('J')} (anti-tank) or ${k('K')} (mortar)`} sets up a gun where they stand. ${t ? 'Tap' : 'Right-click'} it with a squad to crew it.`, 3)) return;
    const far = squads.find(sq => { const c = sq.centroid(); return Math.hypot(c.x - base.x, c.z - base.z) > 250 && !(sq.rally && !sq.rally.dead); });
    if (far && this.hint('rally', `This squad is a long walk from your base. ${k('T', 'Rally')} drops a rally point: its men come back here every ${RA.wave} s instead.`, 3)) return;
    const ride = soldiers.length && U.find(v => mine(v) && v.seats && !v.supply && v.passengers.length < v.seats && soldiers.some(s => near(s, v, 40)));
    if (ride && this.hint('board', `${k('L', 'Load')}, then ${t ? 'tap' : 'click'} the ${ride.type === 'heli' ? 'helicopter' : ride.type === 'apc' ? 'APC' : 'truck'}, puts the squad aboard; ${k('U', 'Unload')} lets them out.`, 5)) return;
    const bags = soldiers.length && U.find(s => mine(s) && s.type === 'sandbags' && s.freeSlots === 4 && soldiers.some(u => near(u, s, 30)));   // an empty position close by
    if (bags && this.hint('man', `${t ? 'Tap' : 'Right-click'} the sandbag position to man it: men in it are much harder to hit.`, 4)) return;
    if (U.some(u => !u.dead && u.team !== me && (u.type === 'apc' || u.type === 'tank') && sees(u)) && this.hint('armour', `Enemy armour. Only anti-tank rockets hurt it, from 90 m; keep other squads in cover.`, 6)) return;
    if (U.some(u => !u.dead && u.type === 'traps' && u.team !== me && sees(u)) && this.hint('traps', `Enemy tank traps: no vehicle gets past them. An engineer standing at the row clears it (${k('X', 'Clear')}).`, 4)) return;
    if (V && V.on && V.ghosts[me].size && this.hint('ghost', `A red outline marks where an enemy was last seen. It may have moved on.`, 7)) return;
    const drained = m.objectives && m.objectives.list.find(l => l.owner === me && l.pushing === 1 - me);
    if (drained && this.hint('drain', `${drained.name} is being taken: its bar is draining. Send someone, or lose ${T.location} tickets.`, 0)) return;
    if (a.units.squads.some(sq => sq.team === me && sq.members.every(u => u.dead)) && this.hint('wiped', `A squad wiped out comes back at the spawn nearest where it fell: the main base, a FOB or its rally point. Its card on the strip counts down to its return.`, 3)) return;
  }
}
