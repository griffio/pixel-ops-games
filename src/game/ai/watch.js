import { buildDigest } from './digest.js';

// A watch on a remote commander's plan between its plans (docs/GAME_PLAN.md, "Note: Typesafe AI's Jev", adjustment 4):
// every few seconds a compact state goes to the Worker's /watch, where Clef answers three typed questions: is the plan working,
// which of our places is most threatened, should the attack be called off (or, with none under way, one be started). Nothing
// is acted on directly, these models do no arithmetic: two reads in a row against the plan nudge the commander to plan early,
// as a capture does, at most once a minute, and the digest carries the last read as `watch` so the model sees what tripped it.
// A read is skipped while nothing has changed (tickets, owners, enemy groups), at most three in a row; a server without the
// route, or six failures in a row, switch it off.
export class PlanWatch {
  constructor(match, strategist, url = '/watch', { interval = 8, nudgeGap = 60, first = 20, maxSkips = 3 } = {}) {
    this.match = match; this.s = strategist; this.team = strategist.team; this.url = url; this.interval = interval; this.nudgeGap = nudgeGap; this.maxSkips = maxSkips;
    this.acc = interval - first; this.pending = false; this.off = false; this.lastNudge = -Infinity; this.nudgedAt = -Infinity; this.strikes = 0; this.fails = 0; this.lastFp = null; this.skipped = 0;
    this.stats = { calls: 0, ok: 0, skipped: 0, nudges: 0, lastMs: 0 };
  }
  tick(dt) {
    const R = this.s.remote; if (this.off || !R || !R.plan || this.pending) return;
    if ((this.acc += dt) < this.interval) return; this.acc = 0;
    const st = this.state(), fp = JSON.stringify([st.state.tickets, st.state.places.map(p => [p.owner, p.contested, p.capturing]), st.state.enemy.length, st.attack, st.state.plan.hold]);
    if (fp === this.lastFp && this.skipped < this.maxSkips) { this.skipped++; this.stats.skipped++; return; }
    this.lastFp = fp; this.skipped = 0; this.read(st);
  }
  state() {
    const m = this.match, R = this.s.remote, d = buildDigest(m, this.team, R), p = R.plan;
    const ours = d.locations.filter(l => l.owner === 'ours').map(l => l.name), attack = p.attack && p.attack !== 'none' ? p.attack : null;
    return { ours, attack, state: {
      minute: d.minute, minutesLeft: d.minutesLeft, tickets: d.tickets, trends: d.trends,
      places: d.locations.map(l => ({ name: l.name, owner: l.owner, ours: l.ours, theirs: l.theirs, contested: l.contested || undefined, recent: l.recent, capturing: l.capturing || undefined })),
      enemy: d.enemy, ourSquads: d.squads.map(s => ({ id: s.id, men: s.men, near: s.near, order: s.order })).slice(0, 14),
      plan: { attack, hold: p.hold, posture: p.posture, reason: p.reason, minutesAgo: +((m.elapsed - R.planAt) / 60).toFixed(1), waiting: d.waiting || undefined },
    } };
  }
  async read(st) {
    const t0 = performance.now(); this.pending = true; this.stats.calls++;
    try {
      const res = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...st, side: this.team ? 'OPFOR' : 'BLUFOR' }) });
      if (res.status === 404) { this.off = true; return; }
      if (!res.ok) { if (++this.fails >= 6) this.off = true; return; }
      const b = await res.json(); if (!b || !b.watch) return;
      this.fails = 0; this.stats.ok++; this.stats.lastMs = Math.round(performance.now() - t0); this.apply(b.watch, st);
    } catch { if (++this.fails >= 6) this.off = true; } finally { this.pending = false; }
  }
  // what in a read speaks against the plan, as short notes; empty when the read agrees with it
  against(w, st) {
    const p = this.s.remote.plan, pc = (v) => Math.round(v * 100) + '%', out = [], t = w.threatened || {};
    if (w.working <= 0.33) out.push(`plan working ${pc(w.working)}`);
    if (st.attack && w.callOff >= 0.65) out.push(`call off the attack on ${st.attack} ${pc(w.callOff)}`);
    if (!st.attack && w.attackNow >= 0.75) out.push(`attack now ${pc(w.attackNow)}`);
    if (t.place && t.place !== 'none' && t.confidence >= 0.55 && !(p.hold || []).includes(t.place) && t.place !== st.attack) out.push(`${t.place} threatened ${pc(t.confidence)}, not in the plan`);
    return out;
  }
  apply(w, st) {
    const R = this.s.remote, now = this.match.elapsed, reasons = this.against(w, st);
    this.strikes = reasons.length ? this.strikes + 1 : 0;
    const nudge = this.strikes >= 2 && now - this.lastNudge >= this.nudgeGap && now - R.planAt > 10;
    if (nudge) { this.lastNudge = this.nudgedAt = now; this.strikes = 0; this.stats.nudges++; R.nudge(); }
    // nudged stays on the digest until the plan it asked for arrives, even when another read lands first
    R.watch = { minute: +(now / 60).toFixed(1), working: w.working, threatened: w.threatened && w.threatened.place !== 'none' ? w.threatened.place : undefined, threatenedConfidence: w.threatened && w.threatened.place !== 'none' ? w.threatened.confidence : undefined,
      callOff: st.attack ? w.callOff : undefined, attackNow: st.attack ? undefined : w.attackNow, against: reasons.length ? reasons : undefined, nudged: this.nudgedAt > R.planAt ? (nudge ? 'yes: this plan was asked for early on the read above' : 'yes: this plan was asked for early on an earlier read against the last one') : undefined };
  }
}
