// Makes radio voice lines with ElevenLabs text to speech (eleven_v3; squad lines by the premade voice Adam, HQ lines by Brian,
// shouted lines tagged [shouting]) and colours them as the existing ones were (sounds/CREDITS.md): silence trimmed, a
// 320-3200 Hz band, a light crush, compression, loudness -16 LUFS, the push-to-talk click before and the squelch after (both
// cut from sounds/vo_sq_fire_1.mp3, so they match the rest), 44.1 kHz mono mp3 at 96 kb/s. Writes sounds/<key>_<n>.mp3 and
// adds the key to sounds/manifest.json. Reads ELEVENLABS_API_KEY (or ELEVEN_LABS_API) from the environment or a .env file
// next to package.json. Needs ffmpeg on the path. Each take costs its characters (a short shouted line about 25).
// usage: node tools/make-voices.mjs [key ...]   (no keys: every line below that has no file yet)
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const env = { ...process.env };
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"#]*)"?\s*$/); if (m && !env[m[1]]) env[m[1]] = m[2]; }
const KEY = env.ELEVENLABS_API_KEY || env.ELEVEN_LABS_API; if (!KEY) { console.error('set ELEVENLABS_API_KEY (or ELEVEN_LABS_API) in the environment or .env'); process.exit(1); }
const ADAM = 'pNInz6obpgDQGcFmaJgB', BRIAN = 'nPczCjzI2devNBz1zQrb';
// the lines (game/voices.js says when each plays); two takes a line, as the first batch had
export const LINES = {
  vo_sq_broken:  { voice: ADAM, takes: ['[shouting] Falling back!', "[shouting] We're pulling back, go!"] },          // a squad of ours breaks (morale)
  vo_sq_pinned:  { voice: ADAM, takes: ["[shouting] We're pinned down!", "[shouting] Pinned down, can't move!"] },  // a squad of ours goes to ground pinned
  vo_sq_lowammo: { voice: ADAM, takes: ['[shouting] Running low!', '[shouting] Low on ammo!'] },                     // a man of the squad on his last magazine
  vo_sq_dry:     { voice: ADAM, takes: ["[shouting] I'm out!", '[shouting] Out of ammo!'] },                          // a man of the squad dry
};
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LINES).filter(k => !existsSync(`sounds/${k}_1.mp3`));
for (const k of keys) if (!LINES[k]) { console.error(`no line called ${k}`); process.exit(1); }
const tmp = mkdtempSync(join(tmpdir(), 'pixel-ops-voices-'));
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
// the click and the squelch, cut from a clip of the first batch (silencedetect: the click runs 0-0.163 s, the squelch 1.52-1.59 s)
const click = join(tmp, 'click.wav'), squelch = join(tmp, 'squelch.wav'), SRC = 'sounds/vo_sq_fire_1.mp3';
ff(['-i', SRC, '-ss', '0', '-t', '0.163', '-ac', '1', '-ar', '44100', click]);
ff(['-i', SRC, '-ss', '1.515', '-t', '0.085', '-ac', '1', '-ar', '44100', squelch]);
const manifestPath = 'sounds/manifest.json', manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); manifest.clips = manifest.clips || {};
let made = 0;
for (const k of keys) {
  const { voice, takes } = LINES[k], files = [];
  for (let i = 0; i < takes.length; i++) {
    const text = takes[i], raw = join(tmp, `${k}_${i + 1}.raw.mp3`), out = `sounds/${k}_${i + 1}.mp3`;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, model_id: 'eleven_v3' }) });
    if (!r.ok) { console.error(`${k} take ${i + 1}: ${r.status} ${(await r.text()).slice(0, 200)}`); continue; }
    writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
    // trim, colour, level, then click + 70 ms + line + 190 ms + squelch + 75 ms, as the first batch was laid out
    const line = 'aformat=sample_rates=44100:channel_layouts=mono,silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.02,areverse,'
      + 'highpass=f=320,lowpass=f=3200,acrusher=bits=10:mode=log:mix=0.25,acompressor=threshold=-18dB:ratio=3:attack=5:release=60:makeup=2,loudnorm=I=-16:TP=-1.5:LRA=7,aformat=sample_rates=44100:channel_layouts=mono';
    ff(['-i', click, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono:d=0.07', '-i', raw, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono:d=0.19', '-i', squelch, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono:d=0.075',
      '-filter_complex', `[0:a]aformat=sample_rates=44100:channel_layouts=mono[c];[1:a]aformat=sample_rates=44100:channel_layouts=mono[g1];[2:a]${line}[v];[3:a]aformat=sample_rates=44100:channel_layouts=mono[g2];[4:a]aformat=sample_rates=44100:channel_layouts=mono[s];[5:a]aformat=sample_rates=44100:channel_layouts=mono[t];[c][g1][v][g2][s][t]concat=n=6:v=0:a=1[o]`,
      '-map', '[o]', '-ac', '1', '-ar', '44100', '-b:a', '96k', out]);
    files.push(`${k}_${i + 1}.mp3`); made++; console.log(`${out}  "${text}"`);
  }
  if (files.length) manifest.clips[k] = files;
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');   // one-space indent, as make-sounds writes it
rmSync(tmp, { recursive: true, force: true });
console.log(`${made} clip${made === 1 ? '' : 's'} made; manifest updated`);
