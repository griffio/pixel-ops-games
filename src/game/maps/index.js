import { desert1km } from './desert1km.js';
import { valley2km } from './valley2km.js';
import { narva3km } from './narva3km.js';
import { peninsula } from './peninsula.js';
import { hollow } from './hollow.js';

// The maps a match can be played on, by key (?map=<key>); the first is the default.
export const MAPS = { valley2km, desert1km, narva3km, peninsula, hollow };
export const mapFor = (key) => MAPS[key] || MAPS.valley2km;   // Palm Valley by default (mirror-symmetric); ?map=desert1km for Desert Crossing, ?map=narva3km for Narva, ?map=peninsula for Peninsula, ?map=hollow for The Hollow (infantry only)
