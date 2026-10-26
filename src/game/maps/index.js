import { desert1km } from './desert1km.js';

// The maps a match can be played on, by key (?map=<key>); the first is the default.
export const MAPS = { desert1km };
export const mapFor = (key) => MAPS[key] || MAPS.desert1km;
