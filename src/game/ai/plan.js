// A commander plan: what a remote commander (a model behind /commander) may ask the CPU to do, and the
// validation that turns any answer into something the strategist can act on. Shared by the game and
// the Cloudflare Worker, so it must stay free of browser and Worker specifics.
export const POSTURES = ['cautious', 'balanced', 'aggressive'];
export const LOGISTICS = ['fob', 'sandbags', 'none'];
export const WAITS = ['none', 'squadsAt', 'enemyBelow', 'apcAlive', 'seconds'];
export const ROLES = ['assault', 'hold', 'reserve', 'screen', 'raid', 'escort'];

export const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    attack: { type: 'string', description: 'the location to take next, by name, or "none" to stop attacking and hold' },
    hold: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'locations to keep squads at, by name, most important first' },
    attackShare: { type: 'number', minimum: 0, maximum: 1, description: 'fraction of free squads committed to the attack' },
    posture: { type: 'string', enum: POSTURES, description: 'cautious keeps more distance and falls back sooner; aggressive closes in and holds ground' },
    logistics: { type: 'string', enum: LOGISTICS, description: 'what the engineer and supply truck build next' },
    lift: { type: 'boolean', description: 'use helicopters to lift squads to distant objectives' },
    reason: { type: 'string', maxLength: 160, description: 'one line of radio chatter explaining the plan, shown to the player' },
    notes: { type: 'string', maxLength: 300, description: 'your own notes for next time: what you intend over the next minutes and why; they come back to you unchanged' },
    nextReviewIn: { type: 'integer', minimum: 10, maximum: 60, description: 'seconds until you want to be consulted again: short while things are fluid, long when a plan needs time to work' },
    waitFor: {
      type: 'object', additionalProperties: false,
      properties: {
        kind: { type: 'string', enum: WAITS, description: 'none: attack now. squadsAt: hold the attack until count of our squads stand at location "at" (one of ours, a staging point). enemyBelow: until fewer than count enemies are near location "at". apcAlive: until one of our APCs is alive. seconds: until count seconds have passed' },
        at: { type: 'string', description: 'location name for squadsAt and enemyBelow' },
        count: { type: 'integer', minimum: 1, maximum: 120, description: 'squads for squadsAt, enemies for enemyBelow, seconds for seconds' },
      },
      required: ['kind'],
      description: 'optionally hold the attack until a condition the game checks every few seconds; it gives up waiting after two minutes',
    },
    squads: {
      type: 'array', maxItems: 8,
      items: { type: 'object', additionalProperties: false, required: ['id', 'role'], properties: {
        id: { type: 'string', description: 'a squad id from the digest, e.g. SQ-11' },
        role: { type: 'string', enum: ROLES, description: 'assault: join the attack. hold: stand at location at (ours). reserve: wait near at behind the front, not drawn into attacks. screen: overwatch position 50 m out from at towards the enemy. raid: go for the nearest enemy FOB. escort: stay with the supply truck' },
        at: { type: 'string', description: 'location name for hold, reserve and screen' },
      } },
      description: 'jobs for particular squads; squads left out follow attackShare. Leave the engineer squad to logistics',
    },
  },
  required: ['attack', 'hold', 'attackShare', 'posture', 'logistics', 'lift', 'reason', 'notes', 'nextReviewIn', 'waitFor', 'squads'],
};

// A clean plan or null. `names` are the location names the digest offered, `squadIds` our squad ids; anything else is dropped.
export function validatePlan(p, names, squadIds = null) {
  if (!p || typeof p !== 'object') return null;
  const name = (v) => (typeof v === 'string' && names.includes(v.trim())) ? v.trim() : null;
  const attack = name(p.attack);
  const hold = Array.isArray(p.hold) ? [...new Set(p.hold.map(name).filter(Boolean))].slice(0, 3) : [];
  const share = Number.isFinite(+p.attackShare) ? Math.min(1, Math.max(0, +p.attackShare)) : 0.65;
  const posture = POSTURES.includes(p.posture) ? p.posture : 'balanced';
  const logistics = LOGISTICS.includes(p.logistics) ? p.logistics : 'fob';
  const lift = p.lift !== false;
  const reason = typeof p.reason === 'string' ? p.reason.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  const notes = typeof p.notes === 'string' ? p.notes.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  const nextReviewIn = Number.isFinite(+p.nextReviewIn) ? Math.round(Math.min(60, Math.max(10, +p.nextReviewIn))) : 20;
  let waitFor = null;
  if (p.waitFor && typeof p.waitFor === 'object' && WAITS.includes(p.waitFor.kind) && p.waitFor.kind !== 'none') {
    const w = p.waitFor, at = name(w.at), count = Number.isFinite(+w.count) ? Math.round(+w.count) : 0;
    if (w.kind === 'squadsAt' && at) waitFor = { kind: 'squadsAt', at, count: Math.min(squadIds ? Math.max(1, squadIds.length) : 8, Math.max(1, count || 2)) };   // never more squads than we have
    else if (w.kind === 'enemyBelow' && at) waitFor = { kind: 'enemyBelow', at, count: Math.min(40, Math.max(1, count || 3)) };
    else if (w.kind === 'apcAlive') waitFor = { kind: 'apcAlive' };
    else if (w.kind === 'seconds') waitFor = { kind: 'seconds', count: Math.min(120, Math.max(5, count || 30)) };
  }
  const seen = new Set(), squads = [];
  if (Array.isArray(p.squads)) for (const s of p.squads) {
    if (!s || typeof s.id !== 'string' || !ROLES.includes(s.role) || seen.has(s.id) || (squadIds && !squadIds.includes(s.id))) continue;
    seen.add(s.id); const at = name(s.at); squads.push(at ? { id: s.id, role: s.role, at } : { id: s.id, role: s.role }); if (squads.length >= 8) break;
  }
  if (!attack && !hold.length) return null;
  return { attack, hold, attackShare: +share.toFixed(2), posture, logistics, lift, reason, notes, nextReviewIn, waitFor, squads };
}
