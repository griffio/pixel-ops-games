// Generates voxel-style reference images for map props and units with a Workers AI text-to-image model
// (FLUX.2 klein 4B by default, the user's pick from a nine-model comparison). The models are built by hand
// from these references (src/core/models.js, src/game/maps/desert1km.js); the images are not used in the game.
// Reads CLOUDFLARE_API_ACCOUNT and CLOUDFLARE_API_KEY from the environment or a .env file next to package.json.
// The account's free plan allows 10,000 neurons a day (reset 00:00 UTC), shared with the LLM commander.
// usage: node tools/make-refs.mjs <outDir> [name ...]   (no names: every subject below)
//        MODEL=@cf/black-forest-labs/flux-2-dev node tools/make-refs.mjs refs hangar
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
const env = { ...process.env };
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"#]*)"?\s*$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim(); }
const A = env.CLOUDFLARE_API_ACCOUNT, K = env.CLOUDFLARE_API_KEY;
if (!A || !K) { console.error('set CLOUDFLARE_API_ACCOUNT and CLOUDFLARE_API_KEY in the environment or .env'); process.exit(1); }
const MODEL = env.MODEL || '@cf/black-forest-labs/flux-2-klein-4b';
const BASE = 'Create a 3dsprite - crudely pixel drawn suitable for simple 3d rendered game. No background. Blocky pixels.';   // the user's prompt
const VIEW = 'seen from an isometric three-quarter view.';
const SUBJECTS = {
  hesco: 'a short military Hesco barrier wall, a row of square wire-mesh cages with fabric liners filled with sand,',
  container: 'a weathered steel shipping container with corrugated sides and cargo doors,',
  // Peninsula's landmarks (P4, 2026-10-29)
  assaultShip: 'a grey amphibious assault ship (LHD): a long flat flight deck with helicopter landing circles, a tall island superstructure with a bridge, radar mast and funnel on the starboard side, and an open well dock gate at the stern,',
  lighthouse: 'a tall round white lighthouse tower with one red band, a black railed gallery and a glass lantern room with a red cap on top, on a stone plinth,',
  radarStation: 'a military radar station: a large white geodesic radome ball on a square concrete blockhouse with a steel door, a lattice antenna mast beside it,',
  harbourShed: 'a harbour warehouse: a long shed with corrugated metal walls, a low pitched roof with skylights, two big sliding doors on the gable end facing the quay, a bollard and a crate outside,',
  humvee: 'a US Army HMMWV Humvee with an Mk 19 automatic grenade launcher on a roof ring mount behind a small gunner shield, a boxy slab-sided body with a flat bonnet, four big tyres, a spare wheel on the back, a grenade belt box beside the gun, olive drab with a tan dust coat,',
  littleBird: 'an AH-6 Little Bird attack helicopter: a tiny egg-shaped cabin with a bubble canopy, skids, a slim tail boom with a small tail rotor, a five-blade main rotor, stub mounts carrying a seven-shot rocket pod on one side and a three-barrel gatling gun on the other, dark olive drab,',
  fishingBoat: 'a small wooden fishing boat with a red hull, a white wheelhouse aft, a short mast with a boom and nets, floating,',
  watchtower: 'a military watchtower: a square concrete tower with a sandbagged observation post on top under a flat corrugated roof, a ladder up one side,',
  hangar: 'an aircraft hangar with a curved corrugated metal roof and large sliding doors on the front,',
  barracks: 'a long single-storey prefab military barracks hut with a low pitched roof, small windows and a door,',
  fueltank: 'a large horizontal cylindrical fuel storage tank lying on concrete saddles, with a ladder and a walkway on top,',
  floodlight: 'a tall steel floodlight pole with a rectangular bank of lamps at the top,',
  radiomast: 'a tall steel lattice radio mast with antennas and dishes, and a small concrete equipment hut beside its base,',
  stall: 'a desert market stall with a striped cloth awning on four wooden poles and crates of fruit underneath,',
  well: 'an old round stone village well with a wooden frame, a rope and a bucket,',
};
const [,, out = 'refs', ...names] = process.argv;
mkdirSync(out, { recursive: true });
const run = async (name) => {
  const t0 = Date.now(), f = new FormData(), prompt = `${BASE} Subject: ${SUBJECTS[name]} ${VIEW}`;
  f.append('prompt', prompt); f.append('width', '1024'); f.append('height', '1024');   // the FLUX.2 models take multipart form data
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${A}/ai/run/${MODEL}`, { method: 'POST', headers: { Authorization: `Bearer ${K}` }, body: f });
  const j = await res.json().catch(() => ({})), img = j.result?.image;
  if (!img) return console.log(`${name}: FAILED ${res.status} ${JSON.stringify(j.errors || j).slice(0, 200)}`);
  const buf = Buffer.from(img, 'base64'), ext = buf[0] === 0xff ? 'jpg' : 'png';
  writeFileSync(`${out}/${name}.${ext}`, buf); console.log(`${name}: ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${out}/${name}.${ext}`);
};
for (const n of names.length ? names : Object.keys(SUBJECTS)) { if (!SUBJECTS[n]) { console.log(`${n}: unknown (${Object.keys(SUBJECTS).join(', ')})`); continue; } await run(n); }
