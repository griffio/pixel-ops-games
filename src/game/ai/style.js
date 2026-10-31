import { buildDigest } from './digest.js';

// The enemy's way of fighting, read about once a minute by the Worker's /style (Clef, a System One model: typed questions over a
// state, back probabilities) from what this side has seen of the other over the last 80 s, so the built-in planner can answer
// it with a persona and a Claude commander reads it in its digest as enemyStyle (docs/GAME_PLAN.md, "Note: Typesafe AI's Jev",
// adjustment 3). Quiet about failures: a server without the route (the local python one) stops it after the first 404.
const PERSONA_FOR = { turtle: 'aggressive', rusher: 'patient', flanker: 'balanced', piecemeal: 'patient', balanced: null };   // null: back to the persona the lobby chose
export class StyleReader {
  constructor(match, strategist, url = '/style', { interval = 60, first = 75, sampleEvery = 20 } = {}) {
    this.match = match; this.s = strategist; this.team = strategist.team; this.url = url; this.interval = interval; this.sampleEvery = sampleEvery;
    this.acc = interval - first; this.sampleAcc = 0; this.pending = false; this.off = false; this.seen = []; this.last = null; this.lastDigest = null;
    this.base = strategist.utility ? strategist.utility.persona : null; this.stats = { calls: 0, ok: 0 };
  }
  tick(dt) {
    if (this.off) return;
    if ((this.sampleAcc += dt) >= this.sampleEvery) { this.sampleAcc = 0; this.sample(); }   // a snapshot of the enemy as seen, the last four kept
    if (this.pending || (this.acc += dt) < this.interval) return; this.acc = 0; this.read();
  }
  sample() {
    const d = buildDigest(this.match, this.team, null); this.lastDigest = d;
    this.seen.push({ minute: d.minute, enemy: d.enemy, places: d.locations.map(l => ({ name: l.name, owner: l.owner, theirs: l.theirs, contested: l.contested || undefined, recent: l.recent })) });
    if (this.seen.length > 4) this.seen.shift();
  }
  state() {
    const d = this.lastDigest || buildDigest(this.match, this.team, null);
    return { minute: d.minute, tickets: d.tickets, trends: d.trends, seen: this.seen, previous: this.last ? this.last.style : null };
  }
  async read() {
    if (!this.seen.length) this.sample();
    const state = this.state(); this.pending = true; this.stats.calls++;
    try {
      const res = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state, previous: state.previous, side: this.team ? 'OPFOR' : 'BLUFOR' }) });
      if (res.status === 404) { this.off = true; return; }
      if (!res.ok) return;
      const b = await res.json(); if (!b || !b.style) return;
      this.stats.ok++; this.apply({ ...b.style, minute: state.minute });
    } catch {} finally { this.pending = false; }
  }
  // the read lands on the strategist (the digest carries it) and, when sure enough, picks the built-in planner's persona
  apply(r) {
    this.last = r; this.s.enemyStyle = r;
    const u = this.s.utility; if (!u || r.confidence < 0.35) return;
    const want = PERSONA_FOR[r.style] || this.base; if (want && want !== u.persona) { u.setPersona(want); this.s.personaBy = `${r.style} ${Math.round(r.confidence * 100)}%`; }
  }
}
