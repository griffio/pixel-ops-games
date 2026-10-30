// 16x16 glyphs for the unit strip, the command bar and the toolbar (fill: currentColor).
const P = {
  move: '<path d="M1 6.5h9V3l5 5-5 5V9.5H1z"/>',
  advance: '<path d="M1 6.5h5V3l5 5-5 5V9.5H1z"/><path d="M10 3l5 5-5 5z"/>',
  hold: '<path d="M8 1l6 2.2v4.3c0 3.9-2.7 6.3-6 7.5-3.3-1.2-6-3.6-6-7.5V3.2z"/>',
  aim: '<path d="M7 0h2v4H7zM7 12h2v4H7zM0 7h4v2H0zM12 7h4v2h-4z"/><path d="M8 3.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zm0 2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z"/>',
  fire: '<path d="M8 .5c.6 2.6 4.8 4.4 4.8 9a4.8 4.8 0 0 1-9.6 0c0-2.2 1.2-3.5 2.2-4.6.2 1.4.8 2.3 1.6 2.6C6.6 5 7.4 2.6 8 .5z"/>',
  flag: '<path d="M3 1h1.8v14H3zM4.8 1.5L14 4.3 4.8 7.6z"/>',
  build: '<path d="M2 12.6l6.3-6.3 1.4 1.4-6.3 6.3zM8.2 2.3l2.9-1.2 3.8 3.8-1.2 2.9-1.8-1.8-1.6 1.6-2.1-2.1 1.6-1.6z"/>',
  clock: '<path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 8 3zM7 4.5h2v3.6l2.4 1.4-1 1.7L7 9.2z"/>',
  idle: '<path d="M3 7h10v2H3z"/>',
  ride: '<path d="M1 9h14v4H1zM3 5h7l2 4H3zM2.5 14.2a1.3 1.3 0 1 0 2.6 0zM10.9 14.2a1.3 1.3 0 1 0 2.6 0z"/>',
  air: '<path d="M0 2h7v1.2H0zM9 2h7v1.2H9zM7 2.6h2V5H7zM2 6h10.5a2.5 2.5 0 0 1 0 5H4z"/>',
  post: '<path d="M1 9.5h14V14H1zM2 6h3v3.5H2zM6.5 6h3v3.5h-3zM11 6h3v3.5h-3z"/>',
  follow: '<path d="M8 3C4 3 1.3 6 .5 8 1.3 10 4 13 8 13s6.7-3 7.5-5C14.7 6 12 3 8 3zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z"/>',
  rally: '<path d="M3 1h1.8v14H3zM4.8 1.5h9l-2.4 3 2.4 3h-9z"/>',
  load: '<path d="M7 1h2v6h2.5L8 10.5 4.5 7H7zM1 11h14v4H1z"/>',
  unload: '<path d="M7 10.5h2v-6h2.5L8 1 4.5 4.5H7zM1 11h14v4H1z"/>',
  clear: '<path d="M3.4 2l4.6 4.6L12.6 2 14 3.4 9.4 8l4.6 4.6-1.4 1.4L8 9.4 3.4 14 2 12.6 6.6 8 2 3.4z"/>',
  box: '<path d="M1 1h4v1.6H2.6V5H1zM11 1h4v4h-1.6V2.6H11zM1 11h1.6v2.4H5V15H1zM13.4 11H15v4h-4v-1.6h2.4z"/>',
  pause: '<path d="M3 2h3.6v12H3zM9.4 2H13v12H9.4z"/>',
  play: '<path d="M3 1.5l11 6.5-11 6.5z"/>',
  help: '<path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.9 10.2h1.8V13H7.1zM8 3.2c1.8 0 3 1.1 3 2.6 0 1.2-.8 1.8-1.5 2.3-.5.3-.6.6-.6 1.2H7.1c0-1.1.3-1.6 1.1-2.2.6-.4.9-.7.9-1.2 0-.6-.4-1-1.1-1-.7 0-1.2.4-1.2 1.1H5c0-1.7 1.2-2.8 3-2.8z"/>',
  sound: '<path d="M1 5.5h3L8 2v12l-4-3.5H1zM10 5a4 4 0 0 1 0 6l1.2 1.2a5.7 5.7 0 0 0 0-8.4z"/>',
  mute: '<path d="M1 5.5h3L8 2v12l-4-3.5H1zM10 5.6l1.1-1.1 1.9 1.9 1.9-1.9L16 5.6 14.1 7.5 16 9.4l-1.1 1.1L13 8.6l-1.9 1.9L10 9.4l1.9-1.9z"/>',
  gear: '<path d="M6.8 1h2.4l.4 2 1.3.6 1.7-1.1 1.7 1.7-1.1 1.7.6 1.3 2 .4v2.4l-2 .4-.6 1.3 1.1 1.7-1.7 1.7-1.7-1.1-1.3.6-.4 2H6.8l-.4-2-1.3-.6-1.7 1.1-1.7-1.7 1.1-1.7-.6-1.3-2-.4V6.8l2-.4.6-1.3-1.1-1.7 1.7-1.7 1.7 1.1 1.3-.6zM8 5.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z"/>',
  base: '<path d="M8 1l7 6h-2v8H9.5v-5h-3v5H3V7H1z"/>',
  arrow: '<path d="M2 8l12-6-4 6 4 6z"/>',
  fold: '<path d="M2 5.5L3.4 4 8 8.6 12.6 4 14 5.5l-6 6z"/>',
  sandbags: '<path d="M1 10.5h6.4a1.6 1.6 0 0 1 0 3.2H1a1.6 1.6 0 0 1 0-3.2zM8.6 10.5H15a1.6 1.6 0 0 1 0 3.2H8.6a1.6 1.6 0 0 1 0-3.2zM4.8 6.6h6.4a1.6 1.6 0 0 1 0 3.2H4.8a1.6 1.6 0 0 1 0-3.2zM1 6.6h2.6v3.2H1zM12.4 6.6H15v3.2h-2.6zM4.8 2.7h6.4a1.6 1.6 0 0 1 0 3.2H4.8a1.6 1.6 0 0 1 0-3.2z"/>',
  fob: '<path d="M7.4 1h1.2v9H7.4zM2 11h12v3.5H2z"/><path d="M4 4.6L8 2.2l4 2.4" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  traps: '<path d="M2 3l3-1 9 10-3 1zM14 3l-3-1-9 10 3 1z"/>',
  hmg: '<path d="M1 6h11v2H1zM12 5h3v1.5h-3zM5 8l-2 6h1.5l2-5zM8 8l2 6H8.5l-2-5z"/>',
  atgm: '<path d="M.5 5.5h12v3h-12zM12.5 4.5h3v5h-3zM5 8.5l-2 6h1.5L6.5 9zM8 8.5l2 6H8.5L6.5 9z"/>',
  mortar: '<path d="M6 1.5l2-1 4 9-2 1zM2 13h12v2H2zM9 10l2 3H9.5L8 11z"/>',
  sup: '<path d="M1 5h14v9H1zM1 2h14v2H1zM6 7h4v2H6z"/>',
};
export const icon = (k, cls = 'gi') => `<svg class="${cls}" viewBox="0 0 16 16" aria-hidden="true">${P[k] || ''}</svg>`;
// a progress ring with a glyph in the middle; f is the part done, 0..1
export const ring = (f, glyph, size = 38, color = 'var(--accent)') => {
  const r = size / 2 - 3, C = 2 * Math.PI * r, c = size / 2;
  return `<span class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="3.5"/><circle class="arc" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${(C * Math.max(0, Math.min(1, f))).toFixed(1)} ${C.toFixed(1)}"/></svg>${icon(glyph)}</span>`;
};
export const mmss = (t) => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// what each build is called, its glyph and portrait, and the HUD action that starts it
export const BUILDS = {
  sandbags: { name: 'Sandbags', glyph: 'sandbags', pic: 'sandbags', act: 'sandbags', key: 'N', say: 'digging sandbags' },
  fob: { name: 'FOB', glyph: 'fob', pic: 'fob', act: 'fob', key: 'B', say: 'building a FOB' },
  traps: { name: 'Tank traps', short: 'Traps', glyph: 'traps', pic: 'traps', act: 'traps', key: 'X', say: 'laying tank traps' },
  clear: { name: 'Clearing traps', short: 'Clear', glyph: 'traps', pic: 'traps', act: 'traps', key: 'X', say: 'clearing tank traps' },
  hmg: { name: 'HMG', glyph: 'hmg', pic: 'hmg', act: 'emp_hmg', key: 'G', say: 'setting up a heavy machine gun' },
  atgm: { name: 'AT gun', glyph: 'atgm', pic: 'atgm', act: 'emp_atgm', key: 'J', say: 'setting up an anti-tank launcher' },
  mortar: { name: 'Mortar', glyph: 'mortar', pic: 'mortar', act: 'emp_mortar', key: 'K', say: 'setting up a mortar' },
};
// the build an engineer is on: FOB builds carry no kind, emplacements say which gun
export const buildKind = (b) => (b.kind === 'emplacement' ? b.gun : b.kind || 'fob');
export const portrait = (k) => `icons/units/${k}.png`;
