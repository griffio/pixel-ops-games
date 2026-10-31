import { ROLES } from './ai/plan.js';

// Orders from the player to the hybrid commander of their own side (docs/GAME_PLAN.md "Command Wheel", W1). An order
// names who (squad ids, 'all', or 'fresh': the squads at base), what (a squad role from plan.js, or an intent for the
// whole plan) and where (a location by name), with how (quietly: hold fire; carefully, at all costs: the posture).
// The engine carries it out at once: strategist.tick reads active() every plan tick, direct orders outranking the
// CO's own jobs and intents binding its goals (applyOrders); the CO reads the list in the digest and acknowledges
// the newest in its reason. A squad the player moves by hand is "in your hand" (Squad.manual) until an order names
// it, Rejoin, or 90 s idle at its destination.
export const INTENTS = ['take', 'press', 'hold the line', 'bleed them', 'pull back', 'go quiet', 'rejoin'];
export const HOWS = ['quietly', 'carefully', 'at all costs'];
const PLAN_INTENTS = ['take', 'press', 'hold the line', 'bleed them', 'pull back'];   // one of these stands at a time
const NEEDS_PLACE = ['hold', 'reserve', 'screen', 'grab', 'antiair'];
const WHAT = { assault: 'join the attack', hold: 'hold', reserve: 'wait at', screen: 'screen', grab: 'grab', raid: 'raid the enemy FOB', escort: 'escort the truck', antiair: 'watch the sky at' };

export class Orders {
  constructor(match) { this.match = match; this.list = []; this.seq = 0; this.acc = 0; }
  squadsOf(team) { return this.match.units.squads.filter(s => s.team === team && s.leader); }
  label(sq) { return sq.members[0].label; }
  // add({ team, who, role, intent, at, how, text }) -> the order, or { error }
  add(spec) {
    const m = this.match, team = spec.team ?? (m.app.playerTeam ?? 0), o2 = m.objectives;
    const byName = (n) => (o2 ? o2.list.find(l => l.name.toLowerCase() === String(n).toLowerCase()) : null) || null;
    const role = spec.role && ROLES.includes(spec.role) ? spec.role : null, intent = spec.intent && INTENTS.includes(spec.intent) ? spec.intent : null;
    if (!role && !intent) return { error: `no such order${spec.role || spec.intent ? ': ' + (spec.role || spec.intent) : ''}` };
    let who = spec.who;
    if (Array.isArray(who)) { const known = this.squadsOf(team).map(s => this.label(s)); who = who.map(w => String(w).toUpperCase()); const bad = who.filter(w => !known.includes(w)); if (bad.length) return { error: `no squad ${bad.join(', ')}` }; if (!who.length) return { error: 'say which squads' }; }
    else if (who !== 'all' && who !== 'fresh') who = intent ? 'all' : null;
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
    if (m.app && m.app.hud && m.app.hud.toast && team === (m.app.playerTeam ?? 0)) m.app.hud.toast(`Order: ${o.text}`);
    return o;
  }
  end(o, note) { o.status = 'done'; o.doneAt = this.match.elapsed; o.note = note; }
  sentence(o) {
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
      if (o.intent === 'take' && o2) { const l = o2.list.find(l => l.name === o.at); if (l && l.owner === o.team) this.end(o, 'taken'); }
      if (Array.isArray(o.who)) {
        const s = (m.strategists || []).find(s => s.team === o.team), notes = s && s.refused ? o.who.map(w => s.refused.get(w)).filter(Boolean) : []; o.refusedNote = notes.length ? notes[0] : undefined;
        // a take-worded order reads hold once the place is ours; while it stands, what its squads are doing instead of it
        const mine = this.squadsOf(o.team).filter(sq => o.who.includes(this.label(sq))), l = o.at && o2 ? o2.list.find(l => l.name === o.at) : null;
        if (l && l.owner === o.team && !o.taken && /\btake the\b/.test(o.text)) { o.taken = true; o.text = o.text.replace(/\btake the\b/, 'hold the'); o.note = 'taken, now holding'; }
        else if (mine.some(sq => sq.tag === 'cover')) o.note = 'hiding from enemy armour: needs a launcher or an APC';
        else if (mine.some(sq => sq.tag === 'back')) o.note = 'falling back, outnumbered';
        else if (mine.some(sq => sq.tag && sq.tag.startsWith('stage'))) o.note = 'gathering before going in';
        else if (o.note !== 'taken, now holding') o.note = undefined;
      }
    }
    for (const t of new Set((m.strategists || []).map(s => s.team))) for (const sq of this.squadsOf(t)) {
      if (!sq.manual) continue;
      if (sq.busy) { sq.idleSince = null; continue; }
      if (sq.idleSince == null) sq.idleSince = m.elapsed; else if (m.elapsed - sq.idleSince > 90) { sq.manual = false; sq.idleSince = null; }
    }
  }
}
