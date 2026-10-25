// Force builder data: items, doctrines, presets, validation, CPU counter-picks and
// saved loadouts. A loadout is { doctrine, items: { key: count } }.
export const BUDGET = 1200, MAX_SQUADS = 8, MAX_VEHICLES = 9;

export const ITEMS = {
  rifle:    { kind: 'squad', name: 'Rifle squad', cost: 100, kits: ['rifle', 'rifle', 'mg', 'rifle'], desc: 'All-round infantry' },
  support:  { kind: 'squad', name: 'Support squad', cost: 130, kits: ['mg', 'mg', 'rifle', 'rifle'], desc: 'Two machine guns' },
  at:       { kind: 'squad', name: 'Anti-tank squad', cost: 140, kits: ['at', 'at', 'rifle', 'rifle'], desc: 'Two launchers, kills vehicles' },
  medic:    { kind: 'squad', name: 'Medic squad', cost: 120, kits: ['rifle', 'medic', 'rifle', 'rifle'], desc: 'Revives fallen soldiers nearby' },
  marksman: { kind: 'squad', name: 'Marksman squad', cost: 110, kits: ['marksman', 'rifle', 'rifle', 'rifle'], desc: 'Long range, picks off infantry' },
  engineer: { kind: 'squad', name: 'Engineer squad', cost: 120, kits: ['rifle', 'engineer', 'rifle', 'rifle'], desc: 'Repairs vehicles, builds FOBs' },
  truck:    { kind: 'vehicle', type: 'truck', name: 'Truck', cost: 60, desc: 'Fast, unarmed; carries two squads' },
  supply:   { kind: 'vehicle', type: 'truck', name: 'Supply truck', cost: 80, supply: true, desc: 'Carries FOB supplies' },
  apc:      { kind: 'vehicle', type: 'apc', name: 'APC', cost: 220, desc: 'Autocannon, 600 hp; carries a squad' },
  tank:     { kind: 'vehicle', type: 'tank', name: 'M1 Abrams tank', cost: 380, desc: '120 mm gun, 1,200 hp; thick front armour, weak rear' },
  heli:     { kind: 'vehicle', type: 'heli', name: 'Chinook helicopter', cost: 300, desc: 'Door guns, fast, fragile; carries 8' },
  fob:      { kind: 'kit', name: 'FOB kit', cost: 50, desc: 'One forward operating base an engineer can build near a supply truck' },
};

export const DOCTRINES = {
  mechanized: { name: 'Mechanized', desc: 'APCs 25% and tanks 15% cheaper, vehicles respawn 30% faster', costMul: { apc: 0.75, tank: 0.85 }, vehicleRespawn: 0.7, infantryRespawn: 1 },
  air:        { name: 'Air Assault', desc: 'Helicopters 35% cheaper; infantry may respawn beside an idle helicopter', costMul: { heli: 0.65 }, vehicleRespawn: 1, infantryRespawn: 1, heliSpawn: true },
  light:      { name: 'Light Infantry', desc: 'Infantry respawn halved, one extra squad slot; infantry may respawn beside a parked truck', costMul: {}, vehicleRespawn: 1, infantryRespawn: 0.5, squadSlots: 1, truckSpawn: true },
  entrenched: { name: 'Entrenched', desc: '+20 tickets for every location captured; FOBs build twice as fast', costMul: {}, vehicleRespawn: 1, infantryRespawn: 1, captureBonus: 20, fobBuild: 0.5 },
};

export const PRESETS = {
  balanced:   { name: 'Balanced', doctrine: 'entrenched', items: { rifle: 3, support: 1, at: 1, medic: 1, engineer: 1, apc: 1, supply: 1, fob: 1 } },
  mechanized: { name: 'Mechanized', doctrine: 'mechanized', items: { rifle: 2, support: 1, at: 1, engineer: 1, apc: 2, supply: 1, fob: 1 } },
  air:        { name: 'Air Assault', doctrine: 'air', items: { rifle: 3, at: 1, medic: 1, engineer: 1, heli: 2, supply: 1, fob: 1 } },
  light:      { name: 'Light Infantry', doctrine: 'light', items: { rifle: 4, support: 1, at: 1, medic: 1, engineer: 1, truck: 1, supply: 1, fob: 1 } },
  armoured:   { name: 'Armoured', doctrine: 'mechanized', items: { rifle: 2, at: 1, engineer: 1, tank: 1, apc: 1, supply: 1, fob: 1 } },
  defensive:  { name: 'Defensive', doctrine: 'entrenched', items: { rifle: 2, support: 1, at: 2, engineer: 1, apc: 1, supply: 1, fob: 1 } },
};

export function itemCost(key, doctrine) { const it = ITEMS[key], mul = (DOCTRINES[doctrine] && DOCTRINES[doctrine].costMul[key]) || 1; return Math.round(it.cost * mul); }
export function summarize(l) {
  let cost = 0, squads = 0, vehicles = 0;
  for (const [k, n] of Object.entries(l.items || {})) { if (!ITEMS[k] || !n) continue; cost += itemCost(k, l.doctrine) * n; if (ITEMS[k].kind === 'squad') squads += n; else if (ITEMS[k].kind === 'vehicle') vehicles += n; }
  const slots = MAX_SQUADS + ((DOCTRINES[l.doctrine] && DOCTRINES[l.doctrine].squadSlots) || 0);
  const errors = [];
  if (cost > BUDGET) errors.push(`over budget by ${cost - BUDGET}`);
  if (squads > slots) errors.push(`too many squads (${squads}/${slots})`);
  if (vehicles > MAX_VEHICLES) errors.push(`too many vehicles (${vehicles}/${MAX_VEHICLES})`);
  if (squads === 0) errors.push('at least one squad');
  if (!DOCTRINES[l.doctrine]) errors.push('pick a doctrine');
  return { cost, squads, vehicles, slots, errors, ok: errors.length === 0 };
}
// deploy list: [{ kind:'squad', kits }, { kind:'vehicle', type, supply }]
export function expand(l) {
  const out = [];
  for (const [k, n] of Object.entries(l.items || {})) for (let i = 0; i < n; i++) {
    const it = ITEMS[k]; if (!it || it.kind === 'kit') continue;
    out.push(it.kind === 'squad' ? { kind: 'squad', item: k, kits: it.kits } : { kind: 'vehicle', item: k, type: it.type, supply: !!it.supply });
  }
  return out;
}
export const clone = (l) => ({ doctrine: l.doctrine, items: { ...l.items } });
export const preset = (key) => clone(PRESETS[key] || PRESETS.balanced);

// The CPU reads the player's force and answers it.
export function counterPick(player, rnd = Math.random) {
  const n = (k) => (player.items && player.items[k]) || 0;
  const squads = Object.keys(ITEMS).filter(k => ITEMS[k].kind === 'squad').reduce((s, k) => s + n(k), 0);
  if (n('apc') >= 2 || n('tank') >= 1) return 'defensive';
  if (n('heli') >= 2) return 'light';
  if (player.doctrine === 'light' || squads >= 7) return 'mechanized';
  if (player.doctrine === 'entrenched') return 'air';
  return ['balanced', 'mechanized', 'air', 'armoured'][Math.floor(rnd() * 4)];
}

const KEY = 'pixelops.loadout';
export function saveLoadout(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch { return false; } }
export function loadSaved() { try { const s = localStorage.getItem(KEY); if (!s) return null; const l = JSON.parse(s); return summarize(l).ok ? l : null; } catch { return null; } }
