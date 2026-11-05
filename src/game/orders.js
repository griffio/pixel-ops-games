import { ROLES } from './ai/plan.js';
import { RULES } from './rules.js';

// Orders from the player to the hybrid commander of their own side (docs/GAME_PLAN.md "Command Wheel", W1). An order
// names who (squad ids, 'all', or 'fresh': the squads at base), what (a squad role from plan.js, or an intent for the
// whole plan) and where (a location by name), with how (quietly: hold fire; carefully, at all costs: the posture).
// The engine carries it out at once: strategist.tick reads active() every plan tick, direct orders outranking the
// CO's own jobs and intents binding its goals (applyOrders); the CO reads the list in the digest and acknowledges
// the newest in its reason. A squad the player moves by hand is "in your hand" (Squad.manual) until an order names
// it, Rejoin, or 90 s idle at its destination.
export const INTENTS = ['take', 'press', 'hold the line', 'bleed them', 'pull back', 'go quiet', 'rejoin'];
export const HOWS = ['quietly', 'carefully', 'at all costs'];
// a note without the strategist's "hold at Mill: " prefix (reason), and its first clause for a card or a chip (noteHead)
export const reason = (n) => String(n || '').replace(/^[a-z ]+? at [^:]+: /, '');
export const noteHead = (n) => reason(n).split(/[:;,]/)[0];
const PLAN_INTENTS = ['take', 'press', 'hold the line', 'bleed them', 'pull back'];   // one of these stands at a time
const NEEDS_PLACE = ['hold', 'reserve', 'screen', 'grab', 'antiair'];
const WHAT = { assault: 'join the attack', hold: 'hold', reserve: 'wait at', screen: 'screen', grab: 'grab', raid: 'raid the enemy FOB', escort: 'escort the truck', antiair: 'watch the sky at' };
// a vehicle named in an order is driven by the player's own hand (input.orderAt) and left alone by the CO until Rejoin: move to
// a place or a point, hold there, home (a supply truck goes to refill), rejoin; squad verbs map onto these
export const VEH_WHATS = ['move', 'hold', 'home', 'rejoin'];
const VEH_FROM = { take: 'move', screen: 'move', grab: 'move', assault: 'move', reserve: 'hold', ambush: 'hold', fallback: 'home', 'pull back': 'home' };
const KIND = { apc: 'APC', tank: 'tank', truck: 'truck', humvee: 'Humvee', heli: 'helicopter', bird: 'Little Bird' };

export class Orders {
  constructor(match) { this.match = match; this.list = []; this.seq = 0; this.acc = 0; }
  squadsOf(team) { return this.match.units.squads.filter(s => s.team === team && s.leader); }
  label(sq) { return sq.members[0].label; }
  vehiclesOf(team) { return this.match.units.units.filter(u => u.team === team && !u.dead && !u.squad && !u.spec.structure && !u.spec.naval && !u.afloat); }
  kindOf(v) { return v.supply ? 'supply truck' : KIND[v.type] || v.type; }
  forVehicle(v) { return this.active(v.team).find(o => o.vehicle && o.who.includes(v.label)) || null; }
  // add({ team, who, role, intent, at, how, text }) -> the order, or { error }
  add(spec) {
    const m = this.match, team = spec.team ?? (m.app.playerTeam ?? 0), o2 = m.objectives;
    const byName = (n) => (o2 ? o2.list.find(l => l.name.toLowerCase() === String(n).toLowerCase()) : null) || null;
    const vrole = VEH_WHATS.includes(spec.role) ? spec.role : null, role = spec.role && ROLES.includes(spec.role) ? spec.role : spec.role === 'move' ? 'hold' : null, intent = spec.intent && INTENTS.includes(spec.intent) ? spec.intent : null;   // move, for a squad: go there and hold
    if (!role && !intent && !vrole) return { error: `no such order${spec.role || spec.intent ? ': ' + (spec.role || spec.intent) : ''}` };
    let who = spec.who;
    if (Array.isArray(who)) {
      const known = this.squadsOf(team).map(s => this.label(s)), vehs = this.vehiclesOf(team), vKnown = vehs.map(v => v.label); who = who.map(w => String(w).toUpperCase());
      const bad = who.filter(w => !known.includes(w) && !vKnown.includes(w)); if (bad.length) return { error: `no squad or vehicle ${bad.join(', ')}` }; if (!who.length) return { error: 'say which squads' };
      // the vehicles named: driven at once by the player's hand; any squads named go on below as a squad order
      const vWho = who.filter(w => vKnown.includes(w));
      if (vWho.length) {
        const vwhat = VEH_WHATS.includes(spec.role) ? spec.role : VEH_FROM[spec.role] || VEH_FROM[spec.intent] || (spec.intent === 'rejoin' ? 'rejoin' : null);
        if (!vwhat) return { error: 'a vehicle can move, hold, go home or rejoin' };
        const vat = spec.at ? byName(spec.at) : null; if (spec.at && !vat) return { error: `no place called ${spec.at}` };
        if ((vwhat === 'move' || vwhat === 'hold') && !vat && typeof spec.x !== 'number') return { error: `${vwhat} needs a place` };
        for (const v of vehs) if (vWho.includes(v.label)) this.drive(v, vwhat, vat, spec);
        const vo = { id: ++this.seq, team, who: vWho, role: vwhat, at: vat ? vat.name : undefined, since: m.elapsed, status: vwhat === 'hold' ? 'standing' : 'done', doneAt: m.elapsed, note: 'by hand', vehicle: true };
        vo.text = spec.text || this.sentence(vo);
        for (const p of this.list) if (p.vehicle && p.team === team && p.status === 'standing' && p.who.some(w => vWho.includes(w))) { p.who = p.who.filter(w => !vWho.includes(w)); if (!p.who.length) this.end(p, 'replaced'); }
        this.list.push(vo); if (this.list.length > 40) this.list.shift();
        this.say(team, vwhat === 'rejoin' ? `Roger, ${vWho.join(', ')} back under the plan` : `Roger: ${vo.text}`);
        if (m.app && m.app.hud && m.app.hud.toast && team === (m.app.playerTeam ?? 0)) m.app.hud.toast(`Order: ${vo.text}`);
        who = who.filter(w => !vKnown.includes(w)); if (!who.length) return vo;
        if (!role && !intent) return { error: `${spec.role} is for vehicles: say where the squads should go` };
      }
    }
    else if (who !== 'all' && who !== 'fresh') who = intent ? 'all' : null;
    if (!role && !intent) return { error: `${spec.role} is for vehicles: say which vehicle` };
    if (role && !who) return { error: 'say which squads' };
    const at = spec.at ? byName(spec.at) : null; if (spec.at && !at) return { error: `no place called ${spec.at}` };
    if (((role && NEEDS_PLACE.includes(role)) || intent === 'take') && !at) return { error: `${role || intent} needs a place` };
    const how = HOWS.includes(spec.how) ? spec.how : undefined;
    const o = { id: ++this.seq, team, who, role, intent, at: at ? at.name : undefined, how, since: m.elapsed, status: 'standing', note: undefined, doneAt: 0 };
    o.text = spec.text || this.sentence(o);
    // a new order for a squad ends its old one; a new plan intent ends the old plan intent; rejoin is done at once
    for (const p of this.list) {
      if (p.team !== team || p.status !== 'standing') continue;
      if (Array.isArray(p.who) && Array.isArray(who) && p.who.some(w => who.includes(w))) { p.who = p.who.filter(w => !who.includes(w)); if (!p.who.length) this.end(p, 'replaced'); }
      else if (p.role && role && who === 'all') this.end(p, 'replaced');   // everyone: the earlier squad orders go with it
      else if (!Array.isArray(p.who) && p.role && !Array.isArray(who) && role) this.end(p, 'replaced');
      if (intent && PLAN_INTENTS.includes(intent) && PLAN_INTENTS.includes(p.intent)) this.end(p, 'replaced');
      if (intent === 'go quiet' && p.intent === 'go quiet') this.end(p, 'replaced');
    }
    const named = (sq) => who === 'all' || (Array.isArray(who) && who.includes(this.label(sq)));
    if (intent === 'rejoin') { for (const sq of this.squadsOf(team)) if (named(sq)) { sq.manual = false; sq.idleSince = null; } this.end(o, 'back under the plan'); }
    else if (Array.isArray(who)) for (const sq of this.squadsOf(team)) if (named(sq)) { sq.manual = false; sq.idleSince = null; }   // an order takes the squad out of the player's hand
    this.list.push(o); if (this.list.length > 40) this.list.shift();
    for (const s of m.strategists || []) if (s.team === team) s.timer = Math.min(s.timer, 0.2);   // carried out on the next plan tick
    this.say(team, intent === 'rejoin' ? `Roger, ${Array.isArray(who) ? who.join(', ') : 'everyone'} back under the plan` : `Roger: ${o.text}`);
    if (m.app && m.app.hud && m.app.hud.toast && team === (m.app.playerTeam ?? 0)) m.app.hud.toast(`Order: ${o.text}`);
    return o;
  }
  end(o, note) { o.status = 'done'; o.doneAt = this.match.elapsed; o.note = note; }
  // the player's own hand on a vehicle (input.orderAt: a helicopter circles, passengers stay aboard), the CO off it until Rejoin
  drive(v, what, at, spec = {}) {
    const m = this.match;
    if (what === 'rejoin') { v.manual = false; v.idleSince = null; return; }
    if (what === 'home') { if (v.supply && v.supplies < RULES.fob.truckSupplies && m.support && m.support.startRefill) { m.support.startRefill(v); v.manual = true; v.idleSince = null; } else { const b = m.teams[v.team].base; this.steer(v, b.x, b.z, 14); } return; }   // a supply truck with room goes to refill and comes back; otherwise home is home
    this.steer(v, at ? at.x : spec.x, at ? at.z : spec.z, at ? Math.max(6, at.r * 0.5) : 0);
  }
  steer(v, x, z, spread) {
    const m = this.match, inp = m.app && m.app.input, W = m.units.world;
    let px = x, pz = z; for (let i = 0; i < 8 && W.isBlocked && W.isBlocked(px, pz, 1); i++) { px = x + (Math.random() - 0.5) * 2 * (spread || 8); pz = z + (Math.random() - 0.5) * 2 * (spread || 8); }
    if (inp && inp.orderAt) { const prev = inp.selected; inp.selected = [v]; inp.orderAt(px, pz); inp.selected = prev; } else v.order(px, pz);
    v.manual = true; v.idleSince = null;
  }
  // the CO over the radio: a feed line in the player's own team's voice (hud: who CO); a model CO adds its own words when its next plan comes
  say(team, text) { const m = this.match; if (team === (m.app.playerTeam ?? 0) && m.event) m.event({ type: 'radio', team, who: 'CO', text }); }
  sentence(o) {
    if (o.vehicle) return `${o.who.join(', ')} ${o.role === 'move' ? 'move to' : o.role === 'hold' ? 'hold' : o.role === 'home' ? 'go home' : 'rejoin'}${o.at ? ' the ' + o.at : ''}`;
    const who = Array.isArray(o.who) ? o.who.join(', ') : o.who === 'fresh' ? 'the fresh squads' : 'everyone';
    const what = o.role ? WHAT[o.role] || o.role : o.intent, at = o.at && o.role !== 'assault' ? ` the ${o.at}` : '';
    return `${who} ${what}${at}${o.how ? ', ' + o.how : ''}`;
  }
  active(team) { return this.list.filter(o => o.team === team && o.status === 'standing'); }
  forSquad(sq) { const l = this.label(sq), A = this.active(sq.team); return A.find(o => Array.isArray(o.who) && o.who.includes(l)) || A.find(o => o.role && o.who === 'all') || null; }   // its own order first, else one for everyone
  // the digest's view: the standing orders and those done in the last 90 s, newest last
  forDigest(team) {
    const m = this.match;
    return this.list.filter(o => o.team === team && (o.status === 'standing' || m.elapsed - o.doneAt < 90)).slice(-6)
      .map(o => ({ id: o.id, text: o.text, who: o.who, role: o.role || undefined, intent: o.intent || undefined, at: o.at, how: o.how, minute: +(o.since / 60).toFixed(1), status: o.status === 'standing' && o.refusedNote ? 'refused' : o.status, note: o.refusedNote || o.note }));
  }
  // every second: a take is done when the place is ours; a refusal the strategist recorded goes on the order (it still
  // stands: the strategist keeps doing the nearest thing); a squad in the player's hand idle 90 s goes back under the plan
  tick(dt) {
    if ((this.acc += dt) < 1) return; this.acc = 0;
    const m = this.match, o2 = m.objectives;
    for (const o of this.list) {
      if (o.status !== 'standing') continue;
      if (o.intent === 'take' && o2) { const l = o2.list.find(l => l.name === o.at); if (l && l.owner === o.team) { this.end(o, 'taken'); this.say(o.team, `The ${o.at} is ours`); } }
      if (Array.isArray(o.who) && !o.vehicle) {
        const s = (m.strategists || []).find(s => s.team === o.team), notes = s && s.refused ? o.who.map(w => s.refused.get(w)).filter(Boolean) : []; o.refusedNote = notes.length ? notes[0] : undefined;
        // a take-worded order reads hold once the place is ours; while it stands, what its squads are doing instead of it
        const mine = this.squadsOf(o.team).filter(sq => o.who.includes(this.label(sq))), l = o.at && o2 ? o2.list.find(l => l.name === o.at) : null;
        if (l && l.owner === o.team && !o.taken && /\btake the\b/.test(o.text)) { o.taken = true; o.text = o.text.replace(/\btake the\b/, 'hold the'); o.note = 'taken, now holding'; }
        else if (mine.some(sq => sq.tag === 'cover')) o.note = 'hiding from enemy armour: needs a launcher or an APC';
        else if (mine.some(sq => sq.tag === 'back')) o.note = 'falling back, outnumbered';
        else if (mine.some(sq => sq.tag && sq.tag.startsWith('stage'))) o.note = 'gathering before going in';
        else if (o.note !== 'taken, now holding') o.note = undefined;
        // say a note once, as it changes: a refusal with its reason, the place taken, the squads hiding or gathering
        const now = o.refusedNote || o.note || ''; if (now !== (o.said || '')) { o.said = now; if (now) this.say(o.team, o.refusedNote ? `Can't: ${o.text}: ${reason(o.refusedNote)}` : o.note === 'taken, now holding' ? `The ${o.at} is ours, ${o.who.join(', ')} holding it` : `${o.who.join(', ')}: ${o.note}`); }
      }
    }
    for (const t of new Set((m.strategists || []).map(s => s.team))) for (const v of this.vehiclesOf(t)) if (v.manual) { const idle = !v.dest && !v.target && Math.abs(v.speed) < 0.3 && !v.refilling; if (!idle) v.idleSince = null; else if (v.idleSince == null) v.idleSince = m.elapsed; }   // a vehicle stays in the hand until Rejoin; the wheel's CO chip offers it when idle
    for (const t of new Set((m.strategists || []).map(s => s.team))) for (const sq of this.squadsOf(t)) {
      if (!sq.manual) continue;
      if (sq.busy) { if (m.elapsed - (sq.wheelAt ?? -1e9) > 5) sq.idleSince = null; continue; }   // a turn to face the enemy (Squad.wheel) is not the player's order: the idle clock runs on
      if (sq.idleSince == null) sq.idleSince = m.elapsed; else if (m.elapsed - sq.idleSince > 90) { sq.manual = false; sq.idleSince = null; }
    }
  }
}
