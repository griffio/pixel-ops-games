// A stand-in for the /commander endpoint, for working on the digest and the plan loop without Cloudflare:
// answers with a sensible plan computed from the digest. usage: node tools/commander-stub.mjs [port=8788]
// then open the game with ?commander=http://localhost:8788/commander
import http from 'node:http';
import { validatePlan } from '../src/game/ai/plan.js';
const port = +(process.argv[2] || 8788);
const plan = (d) => {
  const lead = d.tickets.ours - d.tickets.theirs, enemyNear = (name) => d.enemy.filter(c => c.near.startsWith(name + '+')).reduce((a, c) => a + Object.values(c.units).reduce((x, y) => x + y, 0), 0);
  const attack = d.next || 'none', hold = d.front ? [d.front] : [];
  const posture = lead < -100 ? 'cautious' : lead > 100 ? 'aggressive' : 'balanced';
  const logistics = d.fobs.kitsLeft > 0 ? 'fob' : d.sandbags.length < 3 ? 'sandbags' : 'none';
  const reason = attack !== 'none' ? `Push ${attack}, ${enemyNear(attack)} hostiles there; ${posture} posture, ${hold.length ? 'hold ' + hold[0] : 'nothing to hold'}.` : `Hold what we have and dig in.`;
  const swing = d.trends ? d.trends.tickets.now[0] - d.trends.tickets.now[1] - (d.trends.tickets.min3[0] - d.trends.tickets.min3[1]) : 0;
  const notes = `stub: ${attack !== 'none' ? 'pushing ' + attack : 'holding'}; 3-minute swing ${swing >= 0 ? '+' : ''}${swing}; ${d.plans && d.plans.length ? 'last plan ' + JSON.stringify(d.plans[d.plans.length - 1].outcome) : 'first plan'}`;
  return { attack, hold, attackShare: posture === 'aggressive' ? 0.8 : posture === 'cautious' ? 0.5 : 0.65, posture, logistics, lift: true, reason, notes };
};
http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'content-type': 'application/json' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.url !== '/commander') { res.writeHead(404, cors); return res.end('{"error":"not found"}'); }
  if (req.method === 'GET') { res.writeHead(200, cors); return res.end(JSON.stringify({ ok: true, model: 'stub' })); }
  let body = ''; req.on('data', (c) => body += c); req.on('end', () => {
    try { const d = JSON.parse(body); const p = validatePlan(plan(d), d.locations.map(l => l.name)); console.log(`${d.side} min ${d.minute} tickets ${d.tickets.ours}/${d.tickets.theirs} -> ${JSON.stringify(p)}`); res.writeHead(200, cors); res.end(JSON.stringify({ plan: p, model: 'stub', ms: 1 })); }
    catch (e) { res.writeHead(400, cors); res.end(JSON.stringify({ error: 'bad digest' })); }
  });
}).listen(port, () => console.log(`commander stub on http://localhost:${port}/commander`));
