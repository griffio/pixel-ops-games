// Cloudflare Worker: serves the game as static assets and answers POST /commander with a plan from a
// Workers AI model. The game posts its state digest (src/game/ai/digest.js); the model answers in the
// plan schema (src/game/ai/plan.js); the same validator the game runs cleans the answer here too.
import { PLAN_SCHEMA, validatePlan } from '../src/game/ai/plan.js';

const SYSTEM = `You are the commanding officer of one side in Pixel Ops, a 1v1 tactical game played on a 1 km desert map.
Rules: five locations lie in a line (Outpost, Airfield, Village, Depot, Relay) and each side can only capture the next one along from the ones it holds ("capturable" in the digest). Holding the majority of locations bleeds the enemy 1 ticket every 5 s; losing a location costs 20 tickets; each side has about 500 tickets and loses at 0 or when the 25-minute clock runs out with fewer. Infantry die easily (4 rifle hits) and return in 15 s for 1 ticket; vehicles cost 10-30 tickets. APCs outrange infantry (150 m) and are killed by anti-tank rockets from inside 90 m. A FOB (needs a kit, an engineer and a supply truck) is a forward spawn point; sandbags (engineer and supply truck, no kit) give half cover. Squads approach defended places to 35 m and shoot; "cover" and "stalk" orders mean they are hiding from or hunting enemy armour.
You receive the current state as JSON and answer with ONE JSON object matching the schema: attack (the single next location to take, or "none" to hold), hold (up to three of our locations to keep squads at, most important first), attackShare (0-1 share of free squads for the attack), posture (cautious, balanced or aggressive), logistics (fob, sandbags or none), lift (helicopter lifts allowed), reason (one line of radio chatter, under 160 characters, addressed to the player as if over the radio).
The digest also carries trends (tickets now and 1, 2, 3 minutes ago; deaths and vehicle losses per minute over the last three minutes), the locations that changed hands in the last five minutes, your last three plans with what followed each (ticket swing, captures, losses, our casualties), and the notes you wrote last time. Read the trends before the snapshot: a side bleeding tickets faster must change something. Change the plan when a plan's outcome was bad or the situation changed, keep it when it is working. Write fresh notes: what you intend over the next minutes, what you are waiting for, and why.
Tempo is yours: nextReviewIn is the number of seconds (10-60) until you are consulted again; ask soon while things are fluid, later when a plan needs time to work (you are also consulted at once when a location changes hands or one of your APCs dies). waitFor can hold the attack back until a condition the game checks every few seconds: squadsAt (count of our squads gathered at one of our locations, named in at, a staging point before a push), enemyBelow (fewer than count enemies near the location in at), apcAlive (one of our APCs is up), seconds (count seconds); while waiting, squads gather at the staging location instead of attacking, and the game stops waiting after two minutes. The digest's "waiting" shows the current wait and whether it holds. Wait only when it buys something: an objective held by more than you can bring, or a push that needs the APC up or squads concentrated; a lightly held objective is attacked at once with kind "none", because waiting costs tempo and tickets bleed meanwhile. Output JSON only.`;

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
const extractJson = (text) => { const m = /\{[\s\S]*\}/.exec(text || ''); if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; } };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/commander') return env.ASSETS ? env.ASSETS.fetch(req) : new Response('not found', { status: 404 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });   // preflight: no body on a 204
    if (req.method === 'GET') return json({ ok: true, model: env.MODEL });
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    let digest;
    try { const text = await req.text(); if (text.length > 48000) throw new Error('too large'); digest = JSON.parse(text); } catch { return json({ error: 'bad digest' }, 400); }
    const names = Array.isArray(digest.locations) ? digest.locations.map(l => l && l.name).filter(Boolean) : [];
    if (!names.length) return json({ error: 'digest has no locations' }, 400);
    const t0 = Date.now();
    try {
      const out = await env.AI.run(env.MODEL, {
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(digest) }],
        response_format: { type: 'json_schema', json_schema: PLAN_SCHEMA }, max_tokens: 400, temperature: 0.4,
      });
      let raw = out && out.response !== undefined ? out.response : out;
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = extractJson(raw); } }
      const plan = validatePlan(raw, names);
      if (!plan) return json({ error: 'no usable plan', raw: typeof out?.response === 'string' ? out.response.slice(0, 300) : null, ms: Date.now() - t0 }, 502);
      return json({ plan, model: env.MODEL, ms: Date.now() - t0, usage: out.usage || null });
    } catch (e) { return json({ error: String(e && e.message || e).slice(0, 200), ms: Date.now() - t0 }, 502); }
  },
};
