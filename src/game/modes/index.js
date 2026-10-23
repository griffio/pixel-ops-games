import { AAS } from './aas.js';
import { Invasion } from './invasion.js';
import { Destruction } from './destruction.js';
import { Territory } from './territory.js';
import { Skirmish } from './skirmish.js';

export const MODES = { aas: AAS, invasion: Invasion, destruction: Destruction, territory: Territory, skirmish: Skirmish };
export function createMode(key, match, opts) { const M = MODES[key] || AAS; return new M(match, opts); }
