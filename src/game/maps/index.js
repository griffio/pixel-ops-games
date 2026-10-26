import { desert1km } from './desert1km.js';
import { valley2km } from './valley2km.js';

// The maps a match can be played on, by key (?map=<key>); the first is the default.
export const MAPS = { desert1km, valley2km };
export const mapFor = (key) => MAPS[key] || MAPS.desert1km;
