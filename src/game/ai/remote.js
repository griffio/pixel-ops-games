import { buildDigest } from './digest.js';
import { validatePlan } from './plan.js';

// A remote commander for one CPU side: every `interval` seconds of match time it posts the state digest
// to `url` and keeps the latest usable plan. Everything is asynchronous and optional: the strategist
// follows the plan while it is fresh and its own goals otherwise, so a slow or failing endpoint never
// stalls the match. ?commander=1 uses /commander on the serving origin (the Cloudflare Worker),
// ?commander=<url> any endpoint that speaks the same JSON (tools/commander-stub.mjs for local work).
export class RemoteCommander {
  constructor(match, team, url, { interval = 20, timeout = 8, maxAge = 90 } = {}) {
    this.match = match; this.team = team; this.url = url; this.interval = interval; this.timeout = timeout; this.maxAge = maxAge;
    this.acc = interval - 4; this.plan = null; this.planAt = -Infinity; this.pending = false; this.onPlan = null;
    this.stats = { calls: 0, ok: 0, failed: 0, lastMs: 0, lastError: '', model: '' };
  }
  get fresh() { return !!this.plan && this.match.elapsed - this.planAt < this.maxAge; }
  tick(dt) { if (this.pending) return; if ((this.acc += dt) < this.interval) return; this.acc = 0; this.request(); }
  async request() {
    const digest = buildDigest(this.match, this.team, this.plan), names = digest.locations.map(l => l.name), t0 = performance.now();
    this.pending = true; this.stats.calls++;
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), this.timeout * 1000);
      const res = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(digest), signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('http ' + res.status);
      const body = await res.json();
      const plan = validatePlan(body.plan || body, names);
      if (!plan) throw new Error('no usable plan');
      this.plan = plan; this.planAt = this.match.elapsed; this.stats.ok++; this.stats.lastMs = Math.round(performance.now() - t0); if (body.model) this.stats.model = body.model;
      if (this.onPlan) this.onPlan(plan);
    } catch (e) { this.stats.failed++; this.stats.lastError = String(e && e.message || e).slice(0, 80); }
    this.pending = false;
  }
}
