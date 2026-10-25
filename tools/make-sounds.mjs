// Generates the optional sound clips with ElevenLabs and writes sounds/manifest.json.
// Reads the key from ELEVENLABS_API_KEY or ELEVEN_LABS_API in the environment or
// from a .env file next to package.json. Without the clips the game synthesizes
// every sound itself (src/core/audio.js), so this is a quality upgrade.
// Gunshots, explosions and impacts are not made here: they are cut from CC0 recordings (sounds/CREDITS.md).
// usage: node tools/make-sounds.mjs [names...]   (no names: every clip)
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
const env = { ...process.env };
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"#]*)"?\s*$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim(); }
const KEY = env.ELEVENLABS_API_KEY || env.ELEVEN_LABS_API; if (!KEY) { console.error('set ELEVENLABS_API_KEY (or ELEVEN_LABS_API) in the environment or .env'); process.exit(1); }
const credits = async () => { try { const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': KEY } }); const j = await r.json(); return typeof j.character_limit === 'number' ? j.character_limit - j.character_count : null; } catch { return null; } };   // null for keys without the user_read permission
const CLIPS = {
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
let manifest = { clips: {} }; try { manifest = JSON.parse(readFileSync('sounds/manifest.json', 'utf8')); } catch {}
const only = process.argv.slice(2), before = await credits(); console.log('credits before:', before === null ? 'unknown (key lacks user_read)' : before);
for (const [name, [text, duration]] of Object.entries(CLIPS)) {
  if (only.length && !only.includes(name)) continue;
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_96', { method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, duration_seconds: Math.max(0.5, duration), prompt_influence: 0.5 }) });
  if (!r.ok) { console.error(name, r.status, await r.text()); continue; }
  writeFileSync(`sounds/${name}.mp3`, Buffer.from(await r.arrayBuffer())); manifest.clips[name] = `${name}.mp3`; console.log('wrote', name);
}
writeFileSync('sounds/manifest.json', JSON.stringify(manifest, null, 1));
const after = await credits(); console.log('manifest with', Object.keys(manifest.clips).length, 'clips' + (before !== null && after !== null ? '; credits used: ' + (before - after) + ', left: ' + after : ''));
