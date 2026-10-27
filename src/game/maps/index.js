import { desert1km } from './desert1km.js';
import { valley2km } from './valley2km.js';

// The maps a match can be played on, by key (?map=<key>); the first is the default.
export const MAPS = { valley2km, desert1km };
export const mapFor = (key) => MAPS[key] || MAPS.valley2km;   // Palm Valley by default (mirror-symmetric); ?map=desert1km for Desert Crossing
