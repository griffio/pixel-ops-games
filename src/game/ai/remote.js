import { buildDigest } from './digest.js';
import { validatePlan } from './plan.js';

// A remote commander for one CPU side: every `interval` seconds of match time it posts the state digest
// to `url` and keeps the latest usable plan. Everything is asynchronous and optional: the strategist
// follows the plan while it is fresh and its own goals otherwise, so a slow or failing endpoint never
// stalls the match. ?commander=1 uses /commander on the serving origin (the Cloudflare Worker),
// ?commander=<url> any endpoint that speaks the same JSON (tools/commander-stub.mjs for local work).
export class RemoteCommander {
  constructor(match, team, url, { interval = 20, timeout = 60, maxAge = 90, model = null } = {}) {   // timeout: thinking models take tens of seconds
    this.match = match; this.team = team; this.url = url; this.interval = interval; this.timeout = timeout; this.maxAge = maxAge; this.model = model;   // model: a key from the Worker's allow-list, for comparisons
    this.acc = interval - 4; this.plan = null; this.planAt = -Infinity; this.pending = false; this.onPlan = null; this.history = [];   // the last plans with the state they were made in
    this.stats = { calls: 0, ok: 0, failed: 0, lastMs: 0, lastError: '', model: '' };
  }
  get fresh() { return !!this.plan && this.match.elapsed - this.planAt < this.maxAge; }
  // something happened (a location changed hands, one of our vehicles died): ask again within a few seconds
  nudge() { if (!this.pending && this.match.elapsed - this.planAt > 8) this.acc = Math.max(this.acc, this.interval - 4); }
  // the wait the current plan is under, with whether it holds yet (set by the strategist each plan tick)
  waitState() { const p = this.plan; if (!p || !p.waitFor) return null; return { ...p.waitFor, met: !!this.waitMet, waitedSeconds: Math.round(this.match.elapsed - (this.waitSince ?? this.planAt)) }; }
  // the state a plan starts from, so its outcome can be measured later
  snapshot() { const m = this.match, s = m.sample(), t = this.team; return { t: m.elapsed, tickets: [s[1 + t], s[2 - t]], inf: s[3 + t], veh: s[5 + t], owned: s[7 + t] }; }
  // the last three plans with what followed each: ticket swing (ours minus theirs), locations captured and lost, our losses
  planHistory() {
    const m = this.match, t = this.team, now = this.snapshot();
    return this.history.map((h, i) => {
      const to = this.history[i + 1] ? this.history[i + 1].snap : now, from = h.snap, since = (e) => e.t > from.t && e.t <= to.t && e.team === t;
      const { notes, squads, vehicles, ...plan } = h.plan; if (squads && squads.length) plan.roles = squads.reduce((acc, s) => { acc[s.role] = (acc[s.role] || 0) + 1; return acc; }, {}); if (vehicles && vehicles.length) plan.armour = vehicles.map(v => v.id + ' ' + v.role + (v.at ? ' ' + v.at : ''));
      return { minute: +(from.t / 60).toFixed(1), ...plan, outcome: { minutes: +((to.t - from.t) / 60).toFixed(1), ticketSwing: (to.tickets[0] - to.tickets[1]) - (from.tickets[0] - from.tickets[1]), captured: m.log.filter(e => since(e) && e.type === 'captured').map(e => e.loc), lost: m.log.filter(e => since(e) && e.type === 'lost').map(e => e.loc), infantryLost: to.inf - from.inf, vehiclesLost: to.veh - from.veh } };
    });
  }
  tick(dt) { if (this.pending) return; if ((this.acc += dt) < this.interval) return; this.acc = 0; this.request(); }
  async request() {
    const digest = buildDigest(this.match, this.team, this), names = digest.locations.map(l => l.name), t0 = performance.now();
    if (this.model) digest.model = this.model;
    this.pending = true; this.stats.calls++;
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), this.timeout * 1000);
      const res = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(digest), signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('http ' + res.status);
      const body = await res.json();
      const plan = validatePlan(body.plan || body, names, digest.squads.map(s => s.id), digest.vehicles.map(v => v.id));
      if (!plan) throw new Error('no usable plan');
      const sameWait = this.plan && JSON.stringify(this.plan.waitFor) === JSON.stringify(plan.waitFor);   // a re-issued wait keeps its clock, so the two-minute give-up can fire
      this.waitSince = sameWait && plan.waitFor ? this.waitSince : this.match.elapsed;
      this.plan = plan; this.planAt = this.match.elapsed; this.stats.ok++; this.interval = plan.nextReviewIn || 20; this.acc = 0; if (!sameWait) this.waitMet = false;
      // the history keeps a plan only when the orders change or a minute has passed, so three entries span real time and their outcomes mean something
      const last = this.history[this.history.length - 1], same = (a, b) => a.attack === b.attack && a.posture === b.posture && a.logistics === b.logistics && a.lift === b.lift && a.hold.join() === b.hold.join() && Math.abs(a.attackShare - b.attackShare) < 0.1;
      if (!last || !same(last.plan, plan) || this.match.elapsed - last.snap.t > 60) { this.history.push({ plan, snap: this.snapshot() }); if (this.history.length > 3) this.history.shift(); } else last.plan = plan; this.stats.lastMs = Math.round(performance.now() - t0); if (body.model) this.stats.model = body.model;
      if (this.onPlan) this.onPlan(plan);
    } catch (e) { this.stats.failed++; this.stats.lastError = String(e && e.message || e).slice(0, 80); }
    this.pending = false;
  }
}
