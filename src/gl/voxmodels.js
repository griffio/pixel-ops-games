// Unit models from MagicaVoxel files (core/vox.js): models/vox/<type>.vox with a <type>.json beside it. Each named shape
// in the file becomes a part of the rig by its name: 'hull' is the body, 'turret' turns, 'wheels_<i>' spin (the json's
// `steer` lists which of them steer), the rest keep their names in parts. A part's node sits at its pivot from the json (its model's centre without one)
// and carries its mesh; nested groups nest. The palette is a 256 x 1 texture the quads' UVs index, one per team: the json's
// `team` map recolours OPFOR's slots; its `emissive` map gives glowing parts (tail lights: '<part>.glow', hung under their
// part) their glow; `parent` nests parts (a helicopter's rotors under the body that banks); `rotors` rebuilds the rotor sets
// (rotors_<i> turns, blades_<i> hides at speed behind a code-built blur disc). A builder here replaces the code-built one of
// the same type (main.js).
import { Node, Mesh } from './scene.js';
import { F } from './models.js';
import { parseVox, meshModel, paletteCanvas, VOXEL } from '../core/vox.js';
import { rng } from '../core/math.js';

export async function loadVoxModels(renderer, names) {
  const out = {};
  for (const name of names) {
    try {
      const res = await fetch(`models/vox/${name}.vox`); if (!res.ok) continue;   // no file: the code model stays
      const [buf, meta] = await Promise.all([res.arrayBuffer(), fetch(`models/vox/${name}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({}))]);
      const file = parseVox(buf), geos = file.models.map((m, i) => renderer.registerGeometry(`vox:${name}#${i}`, meshModel(m, meta.voxel || VOXEL)));
      const opt = { nearest: true, repeat: false, mips: false }, variants = meta.variants || [];
      renderer.texture(`voxpal:${name}`, paletteCanvas(file.palette), opt);
      renderer.texture(`voxpal:${name}B`, paletteCanvas(file.palette, meta.team || null), opt);
      variants.forEach((v, i) => {   // a palette variant (the soldier's other skin): one more texture per team
        renderer.texture(`voxpal:${name}:${i}`, paletteCanvas(file.palette, v), opt);
        renderer.texture(`voxpal:${name}:${i}B`, paletteCanvas(file.palette, { ...(meta.team || {}), ...v }), opt);
      });
      out[name] = (team = 0) => build(file, geos, name, meta, team, variants.length && rng() < 0.5 ? 0 : -1);   // one rng call, as the code soldier makes for its skin
    } catch (e) { console.warn(`vox model ${name} not loaded:`, e); }
  }
  return out;
}

function build(file, geos, name, meta, team, variant) {
  const tex = `voxpal:${name}${variant >= 0 ? ':' + variant : ''}${team === 1 ? 'B' : ''}`, mats = new Map(), vox = meta.voxel || VOXEL;
  const matFor = (part) => { const e = (meta.emissive && meta.emissive[part]) || null, k = e ? e.join(',') : ''; if (!mats.has(k)) mats.set(k, { color: [1, 1, 1, 1], tex, emissive: e || [0, 0, 0], cast: true }); return mats.get(k); };
  const g = new Node(), p = { wheels: [], steer: [] }, nodes = new Map([['hull', g]]), toGame = (t) => [-t[0] * vox, t[2] * vox, t[1] * vox];
  const place = (id, parent, part) => {
    const n = file.nodes.get(id); if (!n) return;
    if (n.type === 'grp') { for (const c of n.children) place(c, parent, part); return; }
    if (n.type === 'shp') { for (const mi of n.models) if (geos[mi]) parent.add(new Mesh(geos[mi], matFor(part))); return; }
    if (n.hidden) return;
    const glow = /^(.*)\.glow\d*$/.exec(n.name), base = glow ? glow[1] : null;
    const centre = toGame(n.t), pivot = (meta.pivots && meta.pivots[base || n.name]) || centre;
    const child = file.nodes.get(n.child), shape = child && child.type === 'shp';
    if (base && nodes.has(base)) {   // a glowing piece of a part sits under that part's node
      const holder = new Node(); holder.position.set(centre[0] - pivot[0], centre[1] - pivot[1], centre[2] - pivot[2]); nodes.get(base).add(holder); place(n.child, holder, n.name); return;
    }
    const node = n.name === 'hull' ? g : new Node(), par = meta.parent && meta.parent[n.name], parentNode = (par && nodes.get(par)) || parent, pp = (par && meta.pivots && meta.pivots[par]) || [0, 0, 0];
    if (node !== g) { node.position.set(pivot[0] - pp[0], pivot[1] - pp[1], pivot[2] - pp[2]); parentNode.add(node); nodes.set(n.name, node); }
    if (shape) { const holder = new Node(); holder.position.set(centre[0] - pivot[0], centre[1] - pivot[1], centre[2] - pivot[2]); node.add(holder); place(n.child, holder, n.name); }
    else place(n.child, node, n.name);
    const m = /^wheels_(\d+)$/.exec(n.name);
    if (m) p.wheels[+m[1]] = node; else if (n.name && n.name !== 'hull') p[n.name] = node;
  };
  place(file.root, g, 'hull');
  p.wheels = p.wheels.filter(Boolean); p.steer = (meta.steer || []).map(i => p.wheels[i]).filter(Boolean);
  if (meta.rotors) p.rotors = meta.rotors.map((r, i) => {
    const head = p[`rotors_${i}`] || new Node(), blades = p[`blades_${i}`] || new Node(); delete p[`rotors_${i}`]; delete p[`blades_${i}`];
    const disc = r.disc ? F.mesh(r.disc.geo, 'rotorBlur', 0, r.disc.y, 0, head) : new Node(); disc.visible = false;
    return { head, blades, disc, dir: r.dir };
  });
  p.ring = F.ring(meta.ring || meta.radius || 3, g);
  return { group: g, parts: p, height: meta.height || 3, radius: meta.radius || 2.5 };
}
