// Generates the optional sound clips with ElevenLabs and writes sounds/manifest.json.
// Needs ELEVENLABS_API_KEY in the environment. Without the clips the game
// synthesizes every sound itself (src/core/audio.js), so this is a quality upgrade.
// usage: ELEVENLABS_API_KEY=... node tools/make-sounds.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
const KEY = process.env.ELEVENLABS_API_KEY; if (!KEY) { console.error('set ELEVENLABS_API_KEY'); process.exit(1); }
const CLIPS = {
  rifle:      ['single assault rifle shot, dry, distant battlefield, short', 0.6],
  mg:         ['single machine gun shot, mechanical, dry, short', 0.5],
  marksman:   ['single sniper rifle shot with a sharp crack and short echo', 0.9],
  at:         ['rocket launcher firing, whoosh with ignition thump, short', 1.2],
  autocannon: ['20mm autocannon single shot, heavy mechanical thump, short', 0.7],
  doorgun:    ['helicopter door gun single shot, dry, short', 0.5],
  explosion:  ['vehicle explosion with debris, deep boom, open desert, 1.5 seconds', 1.8],
  impact:     ['bullet hitting sand, tiny thud, very short', 0.4],
  hit:        ['bullet ricochet off metal, very short ping', 0.4],
  captured:   ['short positive two-note military radio chime, 8-bit', 0.8],
  lost:       ['short negative two-note military radio chime, 8-bit', 0.8],
  fob:        ['short three-note confirmation chime, radio, 8-bit', 0.9],
  start:      ['short rising four-note arcade sting, 8-bit', 1.2],
  win:        ['triumphant short arcade victory sting, 8-bit, 2 seconds', 2.0],
  lose:       ['short descending arcade defeat sting, 8-bit, 2 seconds', 2.0],
  select:     ['tiny UI blip click, 8-bit, very short', 0.3],
  order:      ['short confirming UI beep, two tones, 8-bit', 0.4],
};
mkdirSync('sounds', { recursive: true });
const manifest = { clips: {} };
for (const [name, [text, duration]] of Object.entries(CLIPS)) {
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_96', { method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, duration_seconds: duration, prompt_influence: 0.5 }) });
  if (!r.ok) { console.error(name, r.status, await r.text()); continue; }
  writeFileSync(`sounds/${name}.mp3`, Buffer.from(await r.arrayBuffer())); manifest.clips[name] = `${name}.mp3`; console.log('wrote', name);
}
writeFileSync('sounds/manifest.json', JSON.stringify(manifest, null, 1));
console.log('manifest with', Object.keys(manifest.clips).length, 'clips');
