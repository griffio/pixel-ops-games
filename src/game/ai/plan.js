// A commander plan: what a remote commander (a model behind /commander) may ask the CPU to do, and the
// validation that turns any answer into something the strategist can act on. Shared by the game and
// the Cloudflare Worker, so it must stay free of browser and Worker specifics.
export const POSTURES = ['cautious', 'balanced', 'aggressive'];
export const LOGISTICS = ['fob', 'sandbags', 'none'];

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
  },
  required: ['attack', 'hold', 'attackShare', 'posture', 'logistics', 'lift', 'reason'],
};

// A clean plan or null. `names` are the location names the digest offered; anything else is dropped.
export function validatePlan(p, names) {
  if (!p || typeof p !== 'object') return null;
  const name = (v) => (typeof v === 'string' && names.includes(v.trim())) ? v.trim() : null;
  const attack = name(p.attack);
  const hold = Array.isArray(p.hold) ? [...new Set(p.hold.map(name).filter(Boolean))].slice(0, 3) : [];
  const share = Number.isFinite(+p.attackShare) ? Math.min(1, Math.max(0, +p.attackShare)) : 0.65;
  const posture = POSTURES.includes(p.posture) ? p.posture : 'balanced';
  const logistics = LOGISTICS.includes(p.logistics) ? p.logistics : 'fob';
  const lift = p.lift !== false;
  const reason = typeof p.reason === 'string' ? p.reason.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  if (!attack && !hold.length) return null;
  return { attack, hold, attackShare: +share.toFixed(2), posture, logistics, lift, reason };
}
