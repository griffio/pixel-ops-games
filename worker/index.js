// Cloudflare Worker: serves the game as static assets and answers POST /commander with a plan from a
// Workers AI model or Claude. The game posts its state digest (src/game/ai/digest.js); the model answers in
// the plan schema (src/game/ai/plan.js); the same validator the game runs cleans the answer here too.
import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { PLAN_SCHEMA, validatePlan } from '../src/game/ai/plan.js';

const SYSTEM = `You are the commanding officer of one side in Pixel Ops, a 1v1 tactical game. The digest's map gives the map's name and size in metres; positions are [x, z] metres from its centre, and bases gives both main bases.
Rules: the locations form a network: each lists its links (the locations next to it) and base (whose main base it touches), and a side can only capture a location next to its own base or linked to one it holds ("capturable" in the digest). Holding the majority of locations bleeds the enemy 1 ticket every 5 s; losing a location costs 20 tickets; each side has about 500 tickets and loses at 0 or when the 25-minute clock runs out with fewer. Infantry die easily (4 rifle hits) and return in 15 s for 1 ticket; vehicles cost 10-30 tickets. APCs outrange infantry (150 m) and are killed by anti-tank rockets from inside 90 m; armour closes to about 70 m of the enemy at its goal, inside that reach, and backs off to 70 m when an enemy gets within 50 m (cautious: within 65 m, back to 91 m; aggressive: within 30 m, back to 42 m), so AT squads near the enemy put it at risk. A FOB (needs a kit, an engineer and a supply truck) is a forward spawn point; sandbags (engineer and supply truck, no kit) give half cover; a supply truck holds 100 supplies (a FOB costs 50, sandbags 12, tank traps 20) and refills at main base, driving home on its own when it has too little for any job (refilling in the digest) and taking no job until full; tank traps (engineer and supply truck) are a row of steel hedgehogs that stop every vehicle, ours too, until an engineer clears them, so they belong on a crossing enemy armour would use and not on our own way forward (two rows at most). FOB emplacements (engineer and supply truck, within 50 m of one of our FOBs, three to a FOB): hmg, a heavy machine gun that pins infantry out to 120 m (20 supplies); atgm, an anti-tank launcher reaching 200 m that kills an APC in three hits (30); mortar, shells anything our side sees 40-400 m away, no line of sight needed, bursting over 7 m (40). Each needs a gunner: one squad garrisons our emplacements on its own (its order reads garrison; jobs you give it are refused), and the digest's emplacements lists ours (manned or not) and the enemy's we have found, which are worth flanking or shelling. The engineer does exactly the logistics you choose: fob (sandbags when no kit or site is left), sandbags (at the first place we hold), traps (at a river crossing or bridge end on our side, off our own vehicles' way), hmg / atgm / mortar (one emplacement of that kind at our FOB nearest the front) or none; the engineer squad's job in the digest says what it is doing and where, and traps lists the rows we know of. Squads approach defended places to 35 m and shoot; "cover" and "stalk" orders mean they are hiding from or hunting enemy armour.
Helicopters: a door gun reaches 80 m and cuts down infantry in the open; only rockets (90 m) hurt a helicopter, and in the air they rarely hit unless braced (antiair); the digest's air lists the enemy helicopters in the air that you see or saw lately (they are not in enemy). Fog of war: you see only what your units see. "enemy" lists the enemy groups you know of: those in sight now, and those seen before with lastSeen (seconds since, up to 30), which may have moved. A location's "theirs" counts only the enemies you can see in it, and "contested" (both sides in the zone) shows whether you see them or not. A place the enemy holds may hold more than you see: a screen squad or a helicopter finds out before the attack does.
You receive the current state as JSON and answer with ONE JSON object matching the schema: attack (the single next location to take, or "none" to hold), hold (up to three of our locations to keep squads at, most important first), attackShare (0-1 share of the squads you give no job that join the attack; 0 sends none of them), posture (cautious, balanced or aggressive), logistics (fob, sandbags, traps, hmg, atgm, mortar or none), lift (vehicles may carry squads that are at base toward the attack: helicopters fly them near distant objectives, APCs and troop trucks drive them; squads already out walk, and with no helicopter nothing flies), reason (one line of radio chatter, under 160 characters, addressed to the player as if over the radio).
The digest also carries trends (tickets now and 1, 2, 3 minutes ago; deaths and vehicle losses per minute over the last three minutes), the locations that changed hands in the last five minutes, your last three plans with what followed each (ticket swing, captures, losses, our casualties), and the notes you wrote last time. Read the trends before the snapshot: a side bleeding tickets faster must change something. Change the plan when a plan's outcome was bad or the situation changed, keep it when it is working. Write fresh notes: what you intend over the next minutes, what you are waiting for, and why.
Tempo is yours: nextReviewIn is the number of seconds (10-60) until you are consulted again; ask soon while things are fluid, later when a plan needs time to work (you are also consulted at once when a location changes hands or one of your APCs dies). waitFor can hold the attack back until a condition the game checks every few seconds: squadsAt (count of our squads gathered at one of our locations, named in at, a staging point before a push), enemyBelow (fewer than count enemies near the location in at), apcAlive (one of our APCs is up), seconds (count seconds); while waiting, squads gather at the staging location instead of attacking, and the game stops waiting after two minutes. The digest's "waiting" shows the current wait and whether it holds. squads lets you give particular squads jobs by their digest id: assault (join the attack), hold (stand at location at, one of ours), reserve (wait near at behind the front, not drawn into attacks), screen (an overwatch position 50 m out from at towards the enemy, good for an MG or anti-tank squad), raid (go for the nearest enemy FOB), escort (stay with the supply truck), antiair (an anti-tank squad posted at location at, one of ours, that goes for enemy helicopters coming within 180 m of that place, and only those, and fires its rockets braced, hitting twice as often as unbraced; a squad without a launcher is refused), grab (take location at on its own, so the attack can go elsewhere: only a location the digest marks grabbable, one we can take with no enemy we know of in or near it; a grab anywhere else, the attack included, is ignored and that squad follows attackShare). Squads you leave out follow attackShare; leave the engineer squad to logistics (with no logistics job it waits at the first hold). A squad or vehicle whose job the game would not carry out as given shows refused, with the reason and what it does instead: read it before repeating the job. A squad sent to hold, reserve, screen, grab or antiair walks round known enemy fire when it can: while it walks, its route says which of our places it goes by and how far the walk is, or exposed when there is no way round and it walks past the enemy anyway. Anti-tank squads go after enemy armour within 300 m that threatens our squads, but leave alone armour with more than a squad of infantry round it. A rally point with enemy armour within 100 m brings no one back until the armour leaves; its squad's men return at the next spawn instead. vehicles gives our APCs and tanks jobs by their digest id: attack (go with the attack) or hold (stay at location at, one of ours, and fight what comes near it); armour you leave out goes with the attack, or to the first hold when attack is none, so name it when it should stay behind. Each vehicle's to says where it is heading, and a squad aboard one says riding or flying in and which. A squad wiped out shows down, men 0 and back, the seconds until its first man returns (0: waiting on its rally's wave); it is off the map until then, and a job you give it starts when it returns. Wait only when it buys something: an objective held by more than you can bring, or a push that needs the APC up or squads concentrated; a lightly held objective is attacked at once with kind "none", because waiting costs tempo and tickets bleed meanwhile. Output JSON only.`;

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' };
// models a match may ask for by key (?model=), with the output budget each needs; anything else uses env.MODEL
const MODELS = {
  'llama': { model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', maxTokens: 400 },
  'gpt-oss-120b': { model: '@cf/openai/gpt-oss-120b', maxTokens: 2500 },
  'qwen3-30b': { model: '@cf/qwen/qwen3-30b-a3b-fp8', maxTokens: 2500 },
  'mistral-small': { model: '@cf/mistralai/mistral-small-3.1-24b-instruct', maxTokens: 800 },
  // Claude through the gateway on the key stored there; they think before answering, at the effort a key may add (?model=opus:high)
  'haiku': { model: 'claude-haiku-5-5', claude: true, maxTokens: 16000 },
  'sonnet': { model: 'claude-sonnet-5-5', claude: true, maxTokens: 16000 },
  'opus': { model: 'claude-opus-5-5', claude: true, maxTokens: 16000 },
};
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
const ids = (list) => Array.isArray(list) ? list.map(x => x && x.id).filter(Boolean) : null;   // the squad or vehicle ids a digest offers
const extractJson = (text) => { const m = /\{[\s\S]*\}/.exec(text || ''); if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; } };
// Claude's structured outputs take no numeric, length or item limits: the SDK moves them into the descriptions and validatePlan enforces them
const PLAN_FORMAT = (({ type, schema }) => ({ type, schema }))(jsonSchemaOutputFormat(PLAN_SCHEMA));

// One plan from Claude through AI Gateway's Anthropic endpoint. The gateway adds the Anthropic key stored in it (BYOK,
// the "default" alias) when a request carries none, so the SDK's placeholder key is stripped on the way out and the
// request is authorised by the gateway token alone. Returns the raw answer and usage, or throws with the reason.
async function askClaude(env, pick, effort, digestBody, metadata) {
  if (!env.CF_AIG_TOKEN || !env.GATEWAY) throw new Error('Claude needs the gateway and its CF_AIG_TOKEN secret');
  const client = new Anthropic({
    apiKey: 'stored-in-gateway', baseURL: await env.AI.gateway(env.GATEWAY).getUrl('anthropic'), maxRetries: 0, timeout: 55000,   // the game gives up at 60 s and asks again later
    defaultHeaders: { 'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`, 'cf-aig-metadata': JSON.stringify(metadata) },
    fetch: (url, init) => { const headers = new Headers(init.headers); headers.delete('authorization'); headers.delete('x-api-key'); return fetch(url, { ...init, headers }); },
  });
  const msg = await client.messages.create({
    // the system prompt never changes: cached (5 minutes, refreshed by every read) and read back at a twentieth of the price;
    // the marker goes on it, not at the end, so the digest that differs every call is never written to the cache
    model: pick.model, max_tokens: pick.maxTokens, system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify(digestBody) }],
    thinking: { type: 'adaptive' }, output_config: effort ? { effort, format: PLAN_FORMAT } : { format: PLAN_FORMAT },
  });
  if (msg.stop_reason === 'refusal') throw new Error('refused' + (msg.stop_details && msg.stop_details.category ? ': ' + msg.stop_details.category : ''));
  if (msg.stop_reason === 'max_tokens') throw new Error('ran out of tokens');
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let raw; try { raw = JSON.parse(text); } catch { raw = extractJson(text); }
  return { raw, usage: msg.usage };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/commander') return env.ASSETS ? env.ASSETS.fetch(req) : new Response('not found', { status: 404 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });   // preflight: no body on a 204
    if (req.method === 'GET') return json({ ok: true, model: env.MODEL, gateway: env.GATEWAY || null, models: Object.keys(MODELS) });
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    let digest;
    try { const text = await req.text(); if (text.length > 48000) throw new Error('too large'); digest = JSON.parse(text); } catch { return json({ error: 'bad digest' }, 400); }
    const names = Array.isArray(digest.locations) ? digest.locations.map(l => l && l.name).filter(Boolean) : [];
    if (!names.length) return json({ error: 'digest has no locations' }, 400);
    const [key, effortKey] = typeof digest.model === 'string' ? digest.model.split(':') : [];
    const pick = MODELS[key] || { model: env.MODEL, maxTokens: +env.MAX_TOKENS || 400 }, effort = EFFORTS.includes(effortKey) ? effortKey : null;   // none: the model's own default
    const t0 = Date.now();
    try {
      // through AI Gateway when one is configured: every digest and plan is logged there, with the side and minute as metadata
      const metadata = { side: String(digest.side || ''), minute: String(digest.minute ?? ''), mode: String(digest.mode || ''), model: pick.model + (effort ? ':' + effort : '') };
      const gateway = env.GATEWAY ? { gateway: { id: env.GATEWAY, collectLog: true, metadata } } : undefined;
      const { model: _m, ...digestBody } = digest;
      if (pick.claude) {
        const { raw, usage } = await askClaude(env, pick, effort, digestBody, metadata);
        const plan = validatePlan(raw, names, ids(digest.squads), ids(digest.vehicles));
        if (!plan) return json({ error: 'no usable plan', raw: raw && typeof raw === 'object' ? JSON.stringify(raw).slice(0, 300) : null, ms: Date.now() - t0 }, 502);
        return json({ plan, model: metadata.model, ms: Date.now() - t0, usage });
      }
      const out = await env.AI.run(pick.model, {
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(digestBody) }],
        response_format: { type: 'json_schema', json_schema: PLAN_SCHEMA }, max_tokens: pick.maxTokens, temperature: 0.4,   // reasoning models spend output tokens thinking first: they get 2000+
      }, gateway);
      // Workers AI answers either { response } or an OpenAI-style { choices: [{ message: { content } }] }
      let raw = out && out.response !== undefined ? out.response : (out && out.choices && out.choices[0] && out.choices[0].message ? out.choices[0].message.content : out);
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = extractJson(raw); } }
      const plan = validatePlan(raw, names, ids(digest.squads), ids(digest.vehicles));
      if (!plan) return json({ error: 'no usable plan', raw: typeof raw === 'string' ? raw.slice(0, 300) : raw && typeof raw === 'object' ? JSON.stringify(raw).slice(0, 300) : null, ms: Date.now() - t0 }, 502);
      return json({ plan, model: pick.model, ms: Date.now() - t0, usage: out.usage || null });
    } catch (e) { return json({ error: String(e && e.message || e).slice(0, 200), ms: Date.now() - t0 }, 502); }
  },
};
