import { Vec3, lerp, clamp, wrapAngle as wrap, rng } from './math.js';

const rnd = (a, b) => a + rng() * (b - a);

export const SPEC = {
  soldier: { speed: 4.6, turn: 9, accel: 18, label: 'SQ', air: false, hp: 35, nav: 'foot' },   // four rifle hits; infantry are expendable, vehicles are not
  truck:   { speed: 9.5, turn: 1.1, accel: 5, label: 'TR', air: false, hp: 150, nav: 'vehicle', seats: 8 },   // two squads (a supply truck carries cargo, not troops)
  apc:     { speed: 8,   turn: 0.9, accel: 4, label: 'AP', air: false, hp: 600, nav: 'vehicle', kit: 'autocannon', seats: 4 },   // one squad
  heli:    { speed: 16,  turn: 1.4, accel: 6, label: 'HE', air: true, hp: 300, nav: null, kit: 'doorgun', seats: 8 },
  fob:     { speed: 0,   turn: 0,   accel: 0, label: 'FB', air: false, hp: 300, nav: null, structure: true },
  cache:   { speed: 0,   turn: 0,   accel: 0, label: 'CA', air: false, hp: 250, nav: null, structure: true },
  sandbags: { speed: 0, turn: 0,   accel: 0, label: 'SB', air: false, hp: 1e9, nav: null, structure: true, untargetable: true, hollow: true },   // low cover, not a target; soldiers stand inside it
  tank:     { speed: 7,   turn: 0.8, accel: 3.5, label: 'TK', air: false, hp: 1200, nav: 'vehicle', kit: 'tankgun', kit2: 'coax', armour: true },   // M1 Abrams: thick front, weaker sides and rear
  traps:    { speed: 0, turn: 0,   accel: 0, label: 'TT', air: false, hp: 1e9, nav: null, structure: true, untargetable: true },   // tank traps: stop vehicles, not infantry
  rally:    { speed: 0, turn: 0,   accel: 0, label: 'RP', air: false, hp: 1e9, nav: null, structure: true, untargetable: true },   // a squad's spawn: burned by enemies close by, not shot
  // a FOB emplacement (game/fob.js): a gun in a ring of bags with one gunner's slot behind it; u.gun names the weapon
  // (hmg, atgm, mortar) the soldier manning it fires; it can be shot up (three rockets) and costs tickets when lost
  craft:    { speed: 12, turn: 0.7, accel: 3, label: 'LC', air: false, hp: 900, nav: null, naval: true },   // a landing craft: run along its lanes by game/landing.js, never ordered
  emplacement: { speed: 0, turn: 0, accel: 0, label: 'EM', air: false, hp: 250, nav: null, structure: true, hollow: true, slots: [[0, -0.55]], entry: -2.8 },
};
const counters = {}; let pickSeq = 0;
const SWIM = { apc: 3.6, truck: 3.0 };   // m/s afloat (a tracked amphibian makes 12 km/h in the water)
const POST_SLOTS = [[-1.0, 0.75], [1.0, 0.75], [-1.85, -0.5], [1.85, -0.5]];   // a sandbag position's firing slots (local: x across, z out over the front wall)
const slotsOf = (spec) => spec.slots || POST_SLOTS;                                // an emplacement has one, the gunner's
const LANDED = 90;   // seconds a soldier a helicopter set down counts as freshly landed (Air Assault captures)

// ---- soldier arms -------------------------------------------------------------
// Euler XYZ rotation of a vector, in the order Mat4.fromTRS and three.js compose it (z, then y, then x).
function rotXYZ(v, r) {
  let { x, y, z } = v, c = Math.cos(r.z), s = Math.sin(r.z); [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(r.y); s = Math.sin(r.y); [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(r.x); s = Math.sin(r.x); [y, z] = [y * c - z * s, y * s + z * c];
  return { x, y, z };
}
const UPPER = 0.38, FORE = 0.39;   // shoulder to elbow, elbow to the middle of the hand (models.js soldier)
// Two-bone reach in the torso's frame: turn the shoulder joint `arm` (the arm hangs along its -y) and bend the elbow
// joint `el` (about its x) so the hand lands on T, with the elbow pushed toward `pole`. Out of reach, the arm points at T.
function reach(arm, el, T, pole) {
  const S = arm.position; let dx = T.x - S.x, dy = T.y - S.y, dz = T.z - S.z;
  const d0 = Math.hypot(dx, dy, dz) || 1e-6, d = Math.min(d0, UPPER + FORE - 1e-3); dx /= d0; dy /= d0; dz /= d0;
  const pu = pole.x * dx + pole.y * dy + pole.z * dz; let wx = pole.x - pu * dx, wy = pole.y - pu * dy, wz = pole.z - pu * dz;
  const wl = Math.hypot(wx, wy, wz) || 1; wx /= wl; wy /= wl; wz /= wl;   // toward the pole, square to the reach
  const ca = clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const ax = dx * ca + wx * sa, ay = dy * ca + wy * sa, az = dz * ca + wz * sa;   // upper arm
  let fx = dx * d - ax * UPPER, fy = dy * d - ay * UPPER, fz = dz * d - az * UPPER; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;   // forearm
  // shoulder frame: y back up the upper arm, x the elbow hinge (normal to the arm's plane), z = x × y; then its Euler XYZ
  const Yx = -ax, Yy = -ay, Yz = -az;
  let Xx = dy * wz - dz * wy, Xy = dz * wx - dx * wz, Xz = dx * wy - dy * wx; const xl = Math.hypot(Xx, Xy, Xz) || 1; Xx /= xl; Xy /= xl; Xz /= xl;
  const Zx = Xy * Yz - Xz * Yy, Zy = Xz * Yx - Xx * Yz, Zz = Xx * Yy - Xy * Yx;
  arm.rotation.set(Math.atan2(-Zy, Zz), Math.asin(clamp(Zx, -1, 1)), Math.atan2(-Yx, Xx));
  el.rotation.set(Math.atan2(-(Zx * fx + Zy * fy + Zz * fz), -(Yx * fx + Yy * fy + Yz * fz)), 0, 0);
}
// rifle poses in the torso's frame [x, y, z, rx, ry, rz]: carried across the chest muzzle down to the left, shouldered
// (pitch and yaw are set each frame to cancel the torso's, so the barrel points where the soldier faces), out in front
// prone; and where the hands hold it in the rifle's own frame
const CARRY = [0, 0.5, 0.36, 0.35, 0.9, 0.15], AIM = [-0.11, 0.8, 0.46], PRONE = [-0.1, 1.0, 0.12];
const HOLD = {   // trigger hand and support hand per weapon
  rifle: [{ x: 0, y: -0.1, z: -0.07 }, { x: 0, y: -0.07, z: 0.17 }],
  mg: [{ x: 0, y: -0.11, z: -0.08 }, { x: 0, y: -0.08, z: 0.18 }],
  launcher: [{ x: 0, y: -0.17, z: 0 }, { x: 0, y: -0.17, z: 0.27 }],
};
// the launcher is only ever held up: over the right shoulder standing or kneeling, alongside the head prone; whatever
// the soldier isn't holding rides diagonally across the pack
const TUBE_AIM = [-0.2, 0.86, 0.15], TUBE_PRONE = [-0.2, 0.75, -0.12];
const SLUNG_TUBE = [0, 0.55, -0.5, -1.75, 0.5, 0], SLUNG_RIFLE = [0, 0.5, -0.47, -1.75, -0.5, 0];
const POLE_TRIGGER = { x: -0.6, y: -1, z: -0.2 }, POLE_SUPPORT = { x: 0.4, y: -1, z: 0 };

export class Unit {
  constructor(type, build, x, z, heading = rng() * Math.PI * 2, team = 0) {
    const spec = SPEC[type]; this.type = type; this.spec = spec; this.team = team;
    const m = build(team);
    this.pickId = m.group.pickId = ++pickSeq; this.group = m.group; this.parts = m.parts; this.height = m.height; this.radius = m.radius;
    this.pos = this.group.position; this.pos.set(x, 0, z);
    this.heading = heading; this.group.rotation.y = heading;
    this.speed = 0; this.target = null; this.dest = null; this.path = null; this.hold = false;
    this.selected = false; this.squad = null; this.mgr = null;
    this.idle = rnd(0, 3); this.phase = rng() * 6;
    this.hp = this.maxHp = spec.hp; this.kit = spec.kit || null; this.enemy = null; this.cooldown = 0; this.retarget = 0;
    this.kit2 = spec.kit2 || null; this.cooldown2 = 0; this.burst2 = 0;   // a second weapon on the same turret (the tank's coax MG)
    this.stance = 'stand'; this.supp = 0; this.kneelK = 0; this.proneK = 0; this.aimK = 0;   // infantry: suppression 0..1 and the pose blends it drives
    this.dead = false; this.deathT = 0; this.wreck = false; this.remove = false;
    this.mounted = null; this.passengers = []; this.boardTarget = null; this.turnT = 0; this.supplies = 0; this.landedT = 0; this.hover = false;
    this.post = null; this.crew = spec.hollow ? slotsOf(spec).map(() => null) : null;   // a soldier's firing slot in a sandbag position; a position's crew by slot
    this.alt = 0; this.altT = 0; this.rotor = 0; this.rotorT = 0; this.state = 'parked'; this.tilt = 0; this.bank = 0;
    this.id = (counters[type] = (counters[type] || 0) + 1);
    this.label = `${spec.label}-${String(this.id).padStart(2, '0')}`;
    this.dist = 0;
  }

  get moving() { return Math.abs(this.speed) > 0.05 || this.state === 'cruise' || this.state === 'takeoff'; }
  setSelected(s) { this.selected = s; this.parts.ring.visible = s && !this.dead; }

  // Move order: path through the nav grid when one is available, otherwise straight line.
  order(x, z, keepPost = false) {   // any order takes a soldier out of his sandbag position, unless it is his way into it
    if (this.dead || this.afloat) return;   // afloat: waiting on the ship or aboard a landing craft (game/landing.js)
    if (!keepPost) this.leavePost();
    const nav = this.mgr && this.mgr.nav && this.spec.nav ? this.mgr.nav[this.spec.nav] : null;
    if (nav && nav.inPocket(x, z)) { const c = nav.nearestMain(nav.cellOf(x), nav.cellOf(z)); if (c) { x = nav.world(c[0]); z = nav.world(c[1]); } }   // a goal inside a building, or in a pocket between buildings, becomes the nearest open ground
    this.dest = new Vec3(x, 0, z); this.idle = 0; this.hold = false; this.bestDist = Infinity; this.noProgress = 0; this.turnT = 0; this.orbit = null;
    this.path = nav ? nav.findPath(this.pos.x, this.pos.z, x, z) : null;
    if (nav && !this.path) this.path = this.escapeRoute(nav, x, z);
    const first = this.path && this.path.length ? this.path[0] : [x, z];
    this.target = new Vec3(first[0], 0, first[1]);
    if (this.spec.air && (this.state === 'parked' || this.state === 'spooldown')) this.state = 'spool';
    if (!this.spec.air && this.seats) this.dropOnArrive = true;   // passengers get out where it stops
  }
  // No route from here (a vehicle shoved into a pocket between buildings): drive straight to the nearest cell from which the goal
  // can be reached, along a line that clears buildings by half the usual margin, then follow the route from there.
  escapeRoute(nav, x, z) {
    const want = nav.region(nav.cellOf(x), nav.cellOf(z)) || nav.main, w = this.mgr.world, half = this.radius * 0.45, x0 = this.pos.x, z0 = this.pos.z, cx0 = nav.cellOf(x0), cz0 = nav.cellOf(z0);
    const deep0 = w.penetration(x0, z0, half) + 1e-3;   // like movement: the line may start inside a clearance but never go deeper
    const clear = (px, pz) => { const steps = Math.ceil(Math.hypot(px - x0, pz - z0) * 2); for (let i = 1; i <= steps; i++) { const t = i / steps, sx = x0 + (px - x0) * t, sz = z0 + (pz - z0) * t; if (w.isBlocked(sx, sz, half) && w.penetration(sx, sz, half) > deep0) return false; } return true; };
    for (let r = 1; r <= 20; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
      const ix = cx0 + dx, iz = cz0 + dz; if (nav.region(ix, iz) !== want) continue;
      const px = nav.world(ix), pz = nav.world(iz); if (!clear(px, pz)) continue;
      const rest = nav.findPath(px, pz, x, z); return [[px, pz], ...(rest || [[x, z]])];
    }
    return null;
  }
  nextWaypoint() {
    this.bestDist = Infinity; this.noProgress = 0; this.turnT = 0;
    if (this.path && this.path.length > 1) { this.path.shift(); this.target.set(this.path[0][0], 0, this.path[0][1]); return true; }
    this.target = null; this.path = null; this.dest = null; return false;
  }

  // ---- transport ---------------------------------------------------------
  // Helicopters, trucks and APCs carry soldiers (spec.seats; a supply truck carries cargo). Soldiers walk to the carrier,
  // a helicopter's side or a ground vehicle's tail, and get in once it has landed or stopped; a ground vehicle given a
  // move order lets them out where it stops (dropOnArrive), a helicopter where it lands (dropOnLand): the CPU's rides. The
  // player's orders clear both (input.js), so the player's passengers stay aboard until Unload.
  get seats() { return this.supply ? 0 : this.spec.seats || 0; }
  boardPoint(c) {
    if (c.spec.air) return [c.pos.x, c.pos.z + 3];
    return [c.pos.x - Math.sin(c.heading) * 4.5, c.pos.z - Math.cos(c.heading) * 4.5];   // the tail: the APC's ramp, the truck's tailgate
  }
  board(c) { if (this.type !== 'soldier' || this.dead || this.mounted || c.swimming) return; this.boardTarget = c; this.boardT = 0; const [x, z] = this.boardPoint(c); this.order(x, z); }
  mount(c) {
    this.mounted = c; c.passengers.push(this); this.boardTarget = null; this.group.visible = false;
    this.target = null; this.dest = null; this.path = null; this.hold = false; this.enemy = null; this.speed = 0;
  }
  // where passengers stand once out: round a helicopter, in a fan behind a ground vehicle; never inside a wall
  exitPoints(n) {
    const out = [], w = this.mgr && this.mgr.world, free = (x, z) => !w || !w.isBlocked(x, z, 0.5), h = this.heading;
    const air = this.spec.air, cands = [];
    for (let k = 0; k < 24; k++) {
      const ring = Math.floor(k / 8), i = k % 8;
      if (air) { const a = i / 8 * Math.PI * 2 + ring * 0.4, r = 5 + ring * 1.5; cands.push([this.pos.x + Math.cos(a) * r, this.pos.z + Math.sin(a) * r, a]); }
      else { const side = (i - 3.5) * 1.1, back = 4.5 + ring * 1.4; cands.push([this.pos.x - Math.sin(h) * back + Math.cos(h) * side, this.pos.z - Math.cos(h) * back - Math.sin(h) * side, h + Math.PI]); }
    }
    for (const c of cands) if (out.length < n && free(c[0], c[1])) out.push(c);
    while (out.length < n) out.push([this.pos.x, this.pos.z, h]);
    return out;
  }
  unload() {
    const n = this.passengers.length; if (!n || this.swimming) return;   // not into the sea: an amphibian unloads once it has driven ashore
    const pts = this.exitPoints(n), y = this.spec.air ? this.pos.y : (this.mgr ? this.mgr.world.heightAt(this.pos.x, this.pos.z) : this.pos.y);
    this.passengers.forEach((p, i) => { const [x, z, a] = pts[i]; p.mounted = null; p.group.visible = true; p.pos.set(x, y, z); p.heading = a; p.group.rotation.y = a; p.landedT = this.spec.air ? LANDED : 0; });
    this.passengers = []; this.dropOnArrive = false;
  }

  // ---- fighting positions ---------------------------------------------------
  // A sandbag position (spec.hollow) is manned by up to four soldiers, one per firing slot: two against the front wall, one
  // against each side. A soldier walks to the open rear (postEntry), then straight in to his slot, since the walking grid's
  // clearance closes the inside; settled there he holds it, faces out over the bags and is harder to hit from the front and
  // sides (Combat.dugIn), until any other order takes him out.
  localToWorld(lx, lz) { const c = Math.cos(this.heading), s = Math.sin(this.heading); return [this.pos.x + lx * c + lz * s, this.pos.z - lx * s + lz * c]; }
  worldToLocal(x, z) { const c = Math.cos(this.heading), s = Math.sin(this.heading), dx = x - this.pos.x, dz = z - this.pos.z; return [dx * c - dz * s, dx * s + dz * c]; }
  postSlot(i) { return this.localToWorld(...slotsOf(this.spec)[i]); }
  postEntry() { return this.localToWorld(0, this.spec.entry ?? -3.4); }
  crewAt(i) { const c = this.crew[i]; return c && !c.dead && c.post && c.post.sb === this ? c : null; }
  get freeSlots() { return this.crew ? slotsOf(this.spec).filter((_, i) => !this.crewAt(i)).length : 0; }
  man(sb) {   // take the first free slot (front ones first); false when the position is full
    if (this.type !== 'soldier' || this.dead || this.mounted || !sb.crew || sb.dead) return false;
    if (this.post && this.post.sb === sb) return true;
    const i = slotsOf(sb.spec).findIndex((_, k) => !sb.crewAt(k)); if (i < 0) return false;
    this.leavePost(); this.boardTarget = null;
    sb.crew[i] = this; this.post = { sb, slot: i, settled: false, t: 0 };
    const [ex, ez] = sb.postEntry(); this.order(ex, ez, true);
    return true;
  }
  leavePost() { const p = this.post; if (!p) return; if (p.sb.crew[p.slot] === this) p.sb.crew[p.slot] = null; this.post = null; }
  stepPost(dt) {
    const p = this.post, sb = p.sb;
    if (sb.dead) { this.leavePost(); return; }
    const [sx, sz] = sb.postSlot(p.slot), d = Math.hypot(sx - this.pos.x, sz - this.pos.z);
    if (p.settled && d > p.off + 0.5) p.settled = false;                                 // shoved out of it: back in
    if (p.settled) { if (!this.enemy) this.heading += clamp(wrap(sb.heading - this.heading), -this.spec.turn * dt, this.spec.turn * dt); return; }   // face out over the bags
    p.stuck = d < 1.2 && Math.abs(this.speed) < 0.2 ? (p.stuck || 0) + dt : 0;             // as close as the bags let him get
    if (d < 0.6 || p.stuck > 1) { p.settled = true; p.off = d; p.stuck = 0; this.dest = this.target = this.path = null; this.speed = 0; return; }
    const [lx, lz] = sb.worldToLocal(this.pos.x, this.pos.z);
    if (Math.abs(lx) < 1.9 && lz > -4.6 && lz < 1.6) {                                    // in the mouth or inside: straight to the slot
      if (!this.dest || this.path || Math.hypot(this.dest.x - sx, this.dest.z - sz) > 0.1) { this.dest = new Vec3(sx, 0, sz); this.target = new Vec3(sx, 0, sz); this.path = null; this.bestDist = Infinity; this.noProgress = 0; }
    } else if ((p.t += dt) > 1.5 || !this.dest) {                                           // on the way to the rear of it: keep going there
      p.t = 0; const [ex, ez] = sb.postEntry(); if (!this.dest || Math.hypot(this.dest.x - ex, this.dest.z - ez) > 2) this.order(ex, ez, true);
    }
  }

  damage(amount, from) {
    if (this.dead) return false;
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.die(from); return true; }
    return false;
  }
  die(from) {
    this.dead = true; this.deathT = 0; this.enemy = null; this.target = null; this.path = null; this.dest = null; this.hold = false; this.boardTarget = null; this.building = null; this.leavePost();
    this.killer = from || null; this.parts.ring.visible = false;
    // passengers: out of a ground vehicle (or a landed helicopter) shaken and hurt, lost with a helicopter shot down in the
    // air; the match applies the damage (Match: ejected) so a death is counted and respawned like any other
    if (this.passengers.length) {
      const lethal = (this.spec.air && this.alt > 2) || this.spec.naval, pts = this.exitPoints(this.passengers.length);   // a landing craft goes down with its load
      this.ejected = this.passengers.map((p, i) => { p.mounted = null; p.group.visible = true; p.pos.set(pts[i][0], p.pos.y, pts[i][1]); return { p, dmg: lethal ? 9999 : 20 }; });
      this.passengers = [];
    }
    if (this.boardTarget) this.boardTarget = null;
    if (this.spec.air && this.alt > 0.1) { this.state = 'crash'; this.speed *= 0.5; return; }
    this.speed = 0;
    if (this.type !== 'soldier') this.becomeWreck();
  }
  becomeWreck() {
    this.wreck = true; this.wreckT = 0;
    if (this.mgr) { this.mgr.recolor(this.group, 'wreck'); if (this.mgr.dust) this.mgr.dust.explosion(this.pos.x, 0, this.pos.z, this.type === 'tank' ? 1.9 : this.type === 'apc' ? 1.5 : 1); }
    if (this.spec.air) { for (const r of this.parts.rotors) { r.blades.visible = true; r.disc.visible = false; } this.alt = 0; this.pos.y = this.mgr ? this.mgr.world.heightAt(this.pos.x, this.pos.z) : 0; this.parts.body.rotation.x = 0; this.parts.body.rotation.z = 0.35; }
  }
  // revive at a position (infantry respawn reuses the object so squads keep their members)
  revive(x, z, heading) {
    this.dead = false; this.hp = this.maxHp; this.pos.set(x, 0, z); this.heading = heading; this.group.rotation.set(0, heading, 0);
    this.group.visible = true; this.speed = 0; this.enemy = null; this.target = null; this.path = null; this.dest = null; this.deathT = 0; this.reviveT = 0; this.hold = false; this.boardTarget = null; this.mounted = null; this.landedT = 0;
  }

  stepDead(dt) {
    this.deathT += dt;
    const p = this.parts;
    if (this.spec.air && this.state === 'crash') {           // falling out of the sky
      this.alt = Math.max(0, this.alt - 9 * dt); this.pos.y = this.mgr.world.heightAt(this.pos.x, this.pos.z) + this.alt; this.heading += 2.5 * dt; this.group.rotation.y = this.heading;
      p.body.rotation.z = lerp(p.body.rotation.z, 0.6, 1 - Math.pow(0.1, dt)); for (const r of p.rotors) r.head.rotation.y += 10 * dt * r.dir;
      const step = this.speed * dt; this.pos.x += Math.sin(this.heading) * step; this.pos.z += Math.cos(this.heading) * step;
      if (this.alt <= 0) { this.state = 'wrecked'; this.becomeWreck(); }
      return;
    }
    if (this.type === 'soldier') {
      this.group.rotation.x = -clamp(this.deathT / 0.4, 0, 1) * 1.45;            // fall onto the back
      if (this.deathT > 10) this.group.visible = false;                              // body fades; object is reused on respawn
    } else if (this.wreck) {
      this.wreckT += dt;
      const roof = this.pos.y + (this.type === 'apc' ? 2.7 : this.type === 'tank' ? 2.6 : 3.3), k = this.type === 'apc' || this.type === 'tank' ? 1.4 : 1, dust = this.mgr && this.mgr.dust;
      if (dust && this.wreckT < 75 && rng() < dt * (this.wreckT < 45 ? 6 : 4) * (this.type === 'apc' ? 1.5 : 1)) dust.smoke(this.pos.x, roof + 0.8, this.pos.z, k);
      if (dust && this.wreckT < 10 && (this.type === 'tank' || this.type === 'apc') && rng() < dt * 0.7) dust.pop(this.pos.x, roof - 0.5, this.pos.z);   // ammunition cooking off   // from above the roof, so the plume clears the hull
      if (dust && this.wreckT < 45) for (let n = dt * (this.type === 'apc' ? 18 : 12) * (1 - this.wreckT / 50); n > 0; n -= 1) if (rng() < n) dust.fire(this.pos.x, roof - 0.4, this.pos.z, k);   // flames die down over the first 45 s
      if (this.wreckT > 90) this.remove = true;
    }
  }

  // ---- ground vehicles & infantry ------------------------------------------
  stepGround(dt, world) {
    const s = this.spec; let want = 0;
    if (this.target) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, dist = Math.hypot(dx, dz);
      // a vehicle takes a waypoint on the way within 3 m: one closer than its turning circle (a truck starting beside the
      // first point of its route) would have it circling the point for ever
      const last = !this.path || this.path.length <= 1, arrive = last ? (this.type === 'soldier' ? 0.5 : 1.5) : (this.type === 'soldier' ? 1.2 : 3);
      if (dist < arrive) { this.nextWaypoint(); }
      else {
        const desired = Math.atan2(dx, dz); let diff = wrap(desired - this.heading);
        // a vehicle backs up to a near goal behind it, and pivots for a near goal off to the side, instead of
        // creeping forward while it turns and orbiting the point it can never reach
        const vehicle = this.type !== 'soldier', reverse = vehicle && last && dist < 24 && Math.abs(diff) > 2.0;
        if (reverse) diff = wrap(diff + Math.PI);
        const maxTurn = s.turn * dt * (vehicle ? clamp(Math.abs(this.speed) / 3, 0.6, 1) : 1);
        this.heading += clamp(diff, -maxTurn, maxTurn);
        const align = vehicle ? clamp(1.2 - Math.abs(diff) / Math.PI * 2.2, 0.3, 1) : 1;
        want = s.speed * align * (last ? clamp(dist / (vehicle ? 6 : 1.5), 0.25, 1) : 1);
        if (reverse) want = -want * 0.7;
        else if (vehicle && last && dist < 10 && Math.abs(diff) > 0.9) want = 0;
        // trying to move but getting no nearer for a while (a wall, a crowd): call the last waypoint reached, else look for a way round.
        // A vehicle still turning towards the waypoint is not stuck: swinging round to a goal behind it takes it further away
        // for a few seconds, which used to cancel the order (a truck told to drive back out the way it came would not move);
        // still turning after 8 s it is circling something it cannot reach, and is released like one making no progress
        // (a vehicle short of its goal on a straight route, its way blocked after swinging round, finds another way first, three tries)
        const release = () => { const d = this.dest; if (!last || (vehicle && dist > 8 && (this.retry = (this.retry || 0) + 1) <= 3)) this.order(d.x, d.z, true); else { this.retry = 0; this.nextWaypoint(); } };
        if (vehicle && Math.abs(diff) > 0.6) { this.bestDist = dist; this.noProgress = 0; if ((this.turnT += dt) > 8) { this.turnT = 0; release(); } }
        else if (want !== 0) {
          this.turnT = 0;
          if (dist < this.bestDist - 0.15) { if (this.bestDist - dist > 3) this.retry = 0; this.bestDist = dist; this.noProgress = 0; } else this.noProgress += dt;
          if (this.noProgress > 1.5) release();
        }
      }
    }
    if (this.hold && this.type === 'soldier') want = 0;
    // infantry stance: standing on the move or at rest, a knee to shoot from when still, flat when suppressed (and only crawling then)
    if (this.type === 'soldier') {
      this.supp *= Math.exp(-dt / 2.5);
      this.stance = this.supp > 0.5 ? 'prone' : (this.supp > 0.25 && want === 0) ? 'prone' : want === 0 && this.enemy ? 'kneel' : 'stand';
      if (this.stance === 'prone' && want !== 0) want *= 0.3;
      const kk = this.stance === 'kneel' ? 1 : 0, pk = this.stance === 'prone' ? 1 : 0, r1 = Math.min(1, dt * 4), r2 = Math.min(1, dt * 3);
      this.kneelK += (kk - this.kneelK) * r1; this.proneK += (pk - this.proneK) * r2;
    }
    // face the enemy while standing still
    if (want === 0 && this.enemy && this.type === 'soldier') {
      const diff = wrap(Math.atan2(this.enemy.pos.x - this.pos.x, this.enemy.pos.z - this.pos.z) - this.heading);
      this.heading += clamp(diff, -s.turn * dt, s.turn * dt);
    }
    const W = this.mgr.world, T = W.terrain, ground = W.heightAt(this.pos.x, this.pos.z);
    const swim = this.spec.swim !== undefined && T && ground < T.water - 0.2; this.swimming = swim;   // an amphibian afloat: slower, on the waterline, a wake instead of dust
    if (swim) want = clamp(want, -s.swim * 0.6, s.swim);
    else if (want && T && T.wade > 0 && ground < T.water) want *= 0.5;   // wading (a ford, on a map with wadable water): half speed
    this.speed += clamp(want - this.speed, -s.accel * 2 * dt, s.accel * dt);
    if (Math.abs(this.speed) < 0.01) this.speed = 0;
    const step = this.speed * dt, sx = Math.sin(this.heading) * step, sz = Math.cos(this.heading) * step;
    let nx = this.pos.x + sx, nz = this.pos.z + sz;
    const pad = this.radius * 0.9;
    // a unit already inside a wall's clearance (shoved there, or sandbags went up beside it) squeezes out with half the
    // clearance, so it can leave a slot narrower than its full clearance, and any step that doesn't take it deeper is allowed
    const veh = this.spec.nav === 'vehicle' || this.spec.nav === 'amphib';   // vehicles also stop at tank traps
    const p = world.isBlocked(this.pos.x, this.pos.z, pad, veh) ? pad * 0.5 : pad, deep = world.penetration(this.pos.x, this.pos.z, p, veh);
    const free = (x, z) => !world.isBlocked(x, z, p, veh) || (deep > 0 && world.penetration(x, z, p, veh) <= deep + 1e-3);
    if (!free(nx, nz)) {
      if (free(this.pos.x + sx, this.pos.z)) nz = this.pos.z;
      else if (free(this.pos.x, this.pos.z + sz)) nx = this.pos.x;
      else { nx = this.pos.x; nz = this.pos.z; this.speed *= 0.5; }   // boxed in: stop (the no-progress rule above releases the order)
    }
    this.dist += Math.hypot(nx - this.pos.x, nz - this.pos.z);
    const H = this.mgr.world.half; this.pos.x = clamp(nx, -H + 2, H - 2); this.pos.z = clamp(nz, -H + 2, H - 2);
    const h = this.mgr.world.heightAt(this.pos.x, this.pos.z);
    this.pos.y = this.swimming ? Math.max(h, T.water - 0.45 + Math.sin(performance.now() * 0.0014 + this.phase) * 0.06) : h;   // afloat: sat low on the water, riding the swell
    this.group.rotation.y = this.heading;
    this.animate(dt);
  }

  animate(dt) {
    const p = this.parts;
    if (this.type === 'soldier') {
      const run = clamp(this.speed / this.spec.speed, 0, 1);
      this.phase += dt * (3 + 10 * run);
      this.aimK += ((this.enemy ? 1 : 0) - this.aimK) * Math.min(1, dt * 6);   // shoulder the rifle while engaged
      const ak = this.aimK, k = this.kneelK, pr = this.proneK;
      const sw = Math.sin(this.phase) * 0.85 * run;              // +x rotation swings a leg backward
      p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
      p.kneeL.rotation.x = Math.max(0, sw) * 1.4 + 0.12 * run;   // heel kicks up on the trailing leg
      p.kneeR.rotation.x = Math.max(0, -sw) * 1.4 + 0.12 * run;
      const bob = 1.1 + Math.abs(Math.cos(this.phase)) * 0.08 * run;
      p.torso.position.y = p.legL.position.y = p.legR.position.y = bob;
      p.torso.rotation.x = 0.22 * run + 0.1 * ak * (1 - run);   // lean into the run / into the rifle
      p.torso.rotation.y = Math.sin(this.phase) * 0.08 * run - 0.25 * ak;   // bladed to the target when aiming
      // stance on top of the walk: kneel drops the hips onto the right knee with that shin flat behind, the left thigh
      // forward and its shin upright; prone lays the body flat with the legs straight back
      if (k > 0.01 || pr > 0.01) {
        p.torso.position.y = p.legL.position.y = p.legR.position.y = bob - 0.5 * k - 0.8 * pr;
        p.torso.rotation.x += 0.15 * k + 1.45 * pr;
        p.legL.rotation.x += -1.5 * k + 1.5 * pr; p.kneeL.rotation.x += 1.5 * k;
        p.legR.rotation.x += 0.1 * k + 1.5 * pr; p.kneeR.rotation.x += 1.55 * k;
      }
      // the rifle between its poses, then both hands onto it; the head drops to the sight, or lifts to look ahead when prone
      // machine gunners hold the machine gun; anti-tank soldiers swap the carbine for the launcher once they have a target
      const tp = p.torso.rotation.x, ty = p.torso.rotation.y, up = 1 - pr, c = 1 - ak, kit = this.kit;
      const tube = kit === 'at' && ak > 0.5, R = kit === 'mg' ? p.mg : tube ? p.launcher : p.rifle;
      p.rifle.visible = kit !== 'mg'; p.mg.visible = kit === 'mg'; p.launcher.visible = kit === 'at';
      if (tube) R.position.set(TUBE_AIM[0] * up + TUBE_PRONE[0] * pr, TUBE_AIM[1] * up + TUBE_PRONE[1] * pr, TUBE_AIM[2] * up + TUBE_PRONE[2] * pr);
      else R.position.set((CARRY[0] * c + AIM[0] * ak) * up + PRONE[0] * pr, (CARRY[1] * c + AIM[1] * ak) * up + PRONE[1] * pr, (CARRY[2] * c + AIM[2] * ak) * up + PRONE[2] * pr);
      if (tube) R.rotation.set(-tp, -ty, 0);
      else R.rotation.set((CARRY[3] * c - tp * ak) * up - tp * pr, (CARRY[4] * c - ty * ak) * up - ty * pr, CARRY[5] * c * up);
      if (kit === 'at') { const B = tube ? p.rifle : p.launcher, P = tube ? SLUNG_RIFLE : SLUNG_TUBE; B.position.set(P[0], P[1], P[2]); B.rotation.set(P[3], P[4], P[5]); }
      if (kit === 'mg') p.bipod.rotation.x = -Math.PI / 2 * clamp((pr - 0.5) * 3, 0, 1);   // bipod down when prone
      const at = (h) => { const v = rotXYZ(h, R.rotation); return { x: R.position.x + v.x, y: R.position.y + v.y, z: R.position.z + v.z }; };
      const [grip, guard] = HOLD[tube ? 'launcher' : kit === 'mg' ? 'mg' : 'rifle'];
      reach(p.armL, p.elbowL, at(grip), POLE_TRIGGER); reach(p.armR, p.elbowR, at(guard), POLE_SUPPORT);
      p.head.rotation.set(0.15 * ak * up - 1.2 * pr, -ty * 0.8, 0.12 * ak * up);
    } else {
      const spin = this.speed * dt / 0.6;
      for (const w of p.wheels) w.rotation.x += spin;
      if (this.target) {
        const diff = wrap(Math.atan2(this.target.x - this.pos.x, this.target.z - this.pos.z) - this.heading);
        const st = clamp(diff, -0.5, 0.5);
        for (const w of p.steer) w.rotation.y = lerp(w.rotation.y, st, 1 - Math.pow(0.01, dt));
      }
      if (p.turret) {
        const dh = wrap(this.heading - (this.lastHeading === undefined ? this.heading : this.lastHeading)); this.lastHeading = this.heading;
        p.turret.rotation.y = wrap(p.turret.rotation.y - dh);   // the turret holds its bearing while the hull turns under it
        // on a target, or forward when idle (an idle scan swung the turret and its shadow about at close zoom)
        const want = this.enemy ? wrap(Math.atan2(this.enemy.pos.x - this.pos.x, this.enemy.pos.z - this.pos.z) - this.heading) : 0;
        p.turret.rotation.y += clamp(wrap(want - p.turret.rotation.y), -2.5 * dt, 2.5 * dt);
      }
    }
  }

  // ---- helicopter ----------------------------------------------------------
  stepAir(dt, world) {
    const s = this.spec, p = this.parts;
    switch (this.state) {
      case 'parked': this.rotorT = 0; break;
      case 'spool': this.rotorT = 1; if (this.rotor > 0.95) { this.state = 'takeoff'; this.altT = rnd(7, 11); } break;
      case 'takeoff': if (this.alt > this.altT - 0.5) this.state = 'cruise'; break;
      case 'cruise': {
        // circling (the player's helicopters at the end of a move): fly at a point a little ahead on a circle round the
        // destination, so the door gun keeps working on everything in reach until Unload (or Land) brings it down
        const o = this.orbit, circling = !!o && Math.hypot(this.pos.x - o.x, this.pos.z - o.z) < o.r + 10;
        if (circling) {
          const a = Math.atan2(this.pos.x - o.x, this.pos.z - o.z) + 0.6;
          if (this.target) this.target.set(o.x + Math.sin(a) * o.r, 0, o.z + Math.cos(a) * o.r); else this.target = new Vec3(o.x + Math.sin(a) * o.r, 0, o.z + Math.cos(a) * o.r);
          this.dest = null;
        }
        if (!this.target) {
          if (!this.hover) { this.state = 'land'; break; }
          // hovering (CPU fire support): hold here and turn broadside to the target so a door gun bears on it
          this.speed = Math.max(0, this.speed - s.accel * 1.5 * dt);
          const e = this.enemy;
          if (e && !e.dead) { const to = Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z), a = wrap(to + Math.PI / 2 - this.heading), b = wrap(to - Math.PI / 2 - this.heading), diff = Math.abs(a) < Math.abs(b) ? a : b; this.heading += clamp(diff, -s.turn * 0.5 * dt, s.turn * 0.5 * dt); }
          if (dt > 0) this.bank = lerp(this.bank, 0, 1 - Math.pow(0.02, dt));
          break;
        }
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, dist = Math.hypot(dx, dz);
        if (dist < 1.2 && this.speed < 1.5) { this.target = null; this.dest = null; if (!this.hover) this.state = 'land'; break; }
        const desired = Math.atan2(dx, dz), diff = wrap(desired - this.heading);
        const turn = clamp(diff, -s.turn * dt, s.turn * dt); this.heading += turn;
        const want = Math.min(circling ? 8 : s.speed, s.speed * clamp(dist / 14, 0.08, 1) * clamp(1.3 - Math.abs(diff), 0.15, 1));   // circling at 8 m/s
        this.speed += clamp(want - this.speed, -s.accel * 1.5 * dt, s.accel * dt);
        if (dt > 0) this.bank = lerp(this.bank, -turn / dt * 0.25, 1 - Math.pow(0.02, dt));   // a paused frame (dt 0) would make it 0/0 and lose the helicopter for good
        break;
      }
      case 'land': {
        this.speed = Math.max(0, this.speed - s.accel * 1.5 * dt); this.altT = 0;
        if (this.alt < 0.02) { this.state = 'spooldown'; }
        break;
      }
      case 'spooldown': this.rotorT = 0; if (this.passengers.length && this.dropOnLand) { this.unload(); this.dropOnLand = false; } if (this.rotor < 0.02) { this.state = 'parked'; this.rotor = 0; } break;
    }
    if (this.state !== 'cruise') { this.bank = lerp(this.bank, 0, 1 - Math.pow(0.02, dt)); if (this.state !== 'land') this.speed = Math.max(0, this.speed - s.accel * dt); }
    const climb = this.state === 'land' ? 2.2 : 3.5;
    this.alt += clamp(this.altT - this.alt, -climb * dt, climb * dt);
    if (this.state === 'land' && this.alt < 0.02) this.alt = 0;
    this.rotor += clamp(this.rotorT - this.rotor, -0.35 * dt, 0.3 * dt);
    const blur = this.rotor > 0.8;
    for (const r of p.rotors) { r.head.rotation.y += this.rotor * 28 * dt * r.dir; r.blades.visible = !blur; r.disc.visible = blur; }   // tandem rotors turn opposite ways
    p.beacon.visible = (performance.now() * 0.002 + this.id) % 2 < 0.25;
    const step = this.speed * dt;
    const H = this.mgr.world.half; this.pos.x = clamp(this.pos.x + Math.sin(this.heading) * step, -H + 4, H - 4);
    this.pos.z = clamp(this.pos.z + Math.cos(this.heading) * step, -H + 4, H - 4);
    const W = this.mgr.world, T = W.terrain; this.pos.y = Math.max(W.heightAt(this.pos.x, this.pos.z), T ? T.water : -Infinity) + this.alt;   // over water, height above its surface
    this.group.rotation.y = this.heading;
    this.tilt = lerp(this.tilt, this.speed / s.speed * 0.22, 1 - Math.pow(0.02, dt));
    p.body.rotation.x = this.tilt; p.body.rotation.z = this.bank;
    p.ring.position.y = -this.alt + 0.04;
    this.dist += step;
  }

  step(dt, world) {
    if (this.dead) { this.stepDead(dt); return; }
    if (this.spec.naval) return;   // a landing craft is moved along its lane by game/landing.js
    if (this.spec.structure) {   // structures sit on the terrain; a FOB gun swings to its gunner's target, back to the front when he has none
      this.pos.y = world.heightAt(this.pos.x, this.pos.z);
      const t = this.parts && this.parts.turret, g = t && this.crew && this.crewAt(0), e = g && g.enemy;
      if (t) { const want = e ? wrap(Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z) - this.heading) : 0; t.rotation.y += clamp(wrap(want - t.rotation.y), -1.5 * dt, 1.5 * dt); }
      return;
    }
    if (this.mounted) { this.pos.copy(this.mounted.pos); return; }
    if (this.landedT > 0) this.landedT -= dt;   // fresh off a helicopter: counts double in a capture zone under Air Assault (Objectives)
    if (this.boardTarget) {
      const h = this.boardTarget;
      const [bx, bz] = this.boardPoint(h), settled = h.spec.air ? h.alt < 0.5 : Math.abs(h.speed) < 1.5;
      if (h.dead || h.passengers.length >= h.seats) this.boardTarget = null;
      else if ((Math.hypot(bx - this.pos.x, bz - this.pos.z) < 2.5 || Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z) < h.radius + 2.2) && settled) { this.mount(h); return; }   // at the tail, or alongside if a wall is behind it
      else if ((this.boardT += dt) > 1.5 && (!this.dest || Math.hypot(this.dest.x - bx, this.dest.z - bz) > 3)) { this.boardT = 0; this.order(bx, bz); }   // it moved: follow it
    }
    if (this.post) this.stepPost(dt);
    this.spec.air ? this.stepAir(dt, world) : this.stepGround(dt, world);
    if (this.dropOnArrive && !this.dest && Math.abs(this.speed) < 0.3) { this.dropOnArrive = false; if (this.passengers.length) this.unload(); }   // a ground carrier stopped where it was sent
  }
}

export class Squad {
  constructor(members) { this.members = members; for (const m of members) m.squad = this; this.idle = rnd(0, 4); }
  get leader() { return this.members.find(m => !m.dead && !m.afloat) || this.members.find(m => !m.dead) || null; }   // one ashore, if any are
  get alive() { return this.members.some(m => !m.dead); }
  get aliveCount() { return this.members.filter(m => !m.dead).length; }
  get team() { return this.members[0].team; }
  order(x, z) {
    const L = this.leader; if (!L) return;
    const h = Math.atan2(x - L.pos.x, z - L.pos.z), c = Math.cos(h), s = Math.sin(h);
    const offs = [[0, 0], [-1.3, -1.3], [1.3, -1.3], [-2.6, -2.6], [2.6, -2.6], [0, -2.6], [-1.3, -3.9], [1.3, -3.9]];
    let i = 0;
    for (const m of this.members) { if (m.dead) continue; const [ox, oz] = offs[i++ % offs.length]; m.order(x + ox * c + oz * s, z - ox * s + oz * c); }
  }
  get busy() { return this.members.some(m => !m.dead && (m.dest || m.boardTarget)); }
  board(c) { for (const m of this.members) if (!m.dead && !m.mounted) m.board(c); }
  man(sb) { let n = 0; for (const m of this.members) if (!m.dead && !m.mounted && m.man(sb)) n++; return n; }   // into a sandbag position, as many as it has slots
  get posted() { const a = this.members.filter(m => !m.dead); return a.length > 0 && a.every(m => m.post); }
  get mounted() { const a = this.members.filter(m => !m.dead); return a.length > 0 && a.every(m => m.mounted); }
  get engineer() { return this.members.find(m => !m.dead && m.kit === 'engineer') || null; }
  centroid() { const live = this.members.filter(m => !m.dead), a = live.some(m => !m.afloat) ? live.filter(m => !m.afloat) : live; const c = new Vec3(); for (const m of a) c.add(m.pos); return c.multiplyScalar(1 / (a.length || 1)); }   // men still on the ship don't count while any are ashore
}

const KITS = ['rifle', 'mg', 'at', 'rifle'];

export class UnitManager {
  constructor(scene, world, builders, recolor) {
    this.scene = scene; this.world = world; this.builders = builders; this.recolorFn = recolor || (() => {});
    this.units = []; this.squads = []; this.auto = true; this.nav = null; this.spatial = null; this.dust = null;
  }
  recolor(group, mat) { this.recolorFn(group, mat); }
  byPickId(id) { return this.units.find(u => u.pickId === id) || null; }

  freePoint(pad = 3, tries = 40, cx = 0, cz = 0, r = this.world.half - 8) {
    for (let i = 0; i < tries; i++) {
      const x = cx + rnd(-r, r), z = cz + rnd(-r, r);
      if (Math.abs(x) > this.world.half - 6 || Math.abs(z) > this.world.half - 6) continue;
      if (!this.world.isBlocked(x, z, pad)) return [x, z];
    }
    return [cx, cz];
  }

  add(unit) { unit.mgr = this; this.units.push(unit); unit.group.bound = 14; this.scene.add(unit.group); return unit; }   // bound: how far its parts reach, for the renderer's culling (a helicopter's rotors)
  spawn(type, x, z, heading, team = 0, opts = {}) {
    if (x === undefined) [x, z] = this.freePoint(SPEC[type].air ? 6 : 3);
    const amphib = opts.amphib !== undefined ? opts.amphib : !!(this.amphibFor && this.amphibFor(team, type, opts));   // a ship's APCs and supply trucks swim (game/landing.js)
    const build = amphib ? this.builders[type === 'truck' ? 'amphibSupply' : 'amphib'] || this.builders[type] : (opts.supply && this.builders.supplyTruck) || (opts.gun && this.builders['emp_' + opts.gun]) || this.builders[type];   // the supply truck shows its load; an emplacement its gun
    const u = this.add(new Unit(type, build, x, z, heading, team));
    if (opts.gun) u.gun = opts.gun;
    u.pos.y = this.world.heightAt(x, z);
    if (opts.supply) { u.supply = true; u.supplies = 100; u.label = u.label.replace('TR', 'SP'); }
    if (amphib) { u.amphib = true; u.spec = { ...u.spec, nav: 'amphib', swim: SWIM[type] || 3.5 }; if (type === 'apc') u.label = u.label.replace('AP', 'AV'); }   // its own spec: the amphibious grid, a swimming speed
    return u;
  }
  spawnSquad(x, z, team = 0, kits = KITS) {
    if (x === undefined) [x, z] = this.freePoint(3);
    const members = []; const h = rng() * Math.PI * 2;
    for (let i = 0; i < 4; i++) { const m = this.spawn('soldier', x + (i % 2) * 1.4 - 0.7, z + Math.floor(i / 2) * 1.4 - 0.7, h, team); m.kit = kits[i] || 'rifle'; members.push(m); }
    const sq = new Squad(members); sq.id = (this.squadCount = (this.squadCount || 0) + 1);
    for (const m of members) m.label = `SQ-${String(sq.id).padStart(2, '0')}`;
    this.squads.push(sq); return sq;
  }
  removeUnit(u) { this.scene.remove(u.group); const i = this.units.indexOf(u); if (i >= 0) this.units.splice(i, 1); }
  clear() { for (const u of this.units) this.scene.remove(u.group); this.units = []; this.squads = []; }

  update(dt) {
    const w = this.world;
    for (const u of this.units) {
      u.step(dt, w);
      if (!this.dust || dt <= 0 || u.dead || u.spec.naval) continue;   // no dust off a craft at sea
      if (u.swimming) { if (Math.abs(u.speed) > 0.8) this.dust.wake(u.pos.x, w.terrain.water + 0.05, u.pos.z, u.heading, Math.abs(u.speed), 3.2, 9, dt); } else this.dust.fromUnit(u, dt);
    }
    for (let i = this.units.length - 1; i >= 0; i--) if (this.units[i].remove) this.removeUnit(this.units[i]);
    // separation between ground units
    const push = (a, b) => {
      if (a.dead || b.dead || a.mounted || b.mounted || (a.spec.air && a.alt > 0.1) || (b.spec.air && b.alt > 0.1) || a.spec.hollow || b.spec.hollow) return;   // a sandbag position's walls are obstacles; its middle is for standing in
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, r = a.radius + b.radius, d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) {
        const d = Math.sqrt(d2), k = (r - d) * 0.5, nx = dx / d, nz = dz / d, wa = b.radius / r, wb = a.radius / r;
        // never shove a unit deeper into a wall's clearance: that is how vehicles used to end up pinned against buildings
        const shove = (u, sx, sz) => { if (u.spec.air || u.spec.structure) return; const p = u.radius * 0.9, x = u.pos.x + sx, z = u.pos.z + sz; if (w.isBlocked(x, z, p) && w.penetration(x, z, p) > w.penetration(u.pos.x, u.pos.z, p)) return; u.pos.x = x; u.pos.z = z; };
        shove(a, -nx * k * wa, -nz * k * wa); shove(b, nx * k * wb, nz * k * wb);
      }
    };
    if (this.spatial) this.spatial.forEachPair(6, push);
    else for (let i = 0; i < this.units.length; i++) for (let j = i + 1; j < this.units.length; j++) push(this.units[i], this.units[j]);
    if (!this.auto) return;
    // sandbox-only autonomous wandering
    for (const sq of this.squads) {
      if (!sq.leader) continue;
      if (!sq.busy) { sq.idle -= dt; if (sq.idle <= 0) { const [x, z] = this.freePoint(2); sq.order(x, z); sq.idle = rnd(2, 9); } }
    }
    for (const u of this.units) {
      if (u.squad || u.dead) continue;
      const parked = u.spec.air ? u.state === 'parked' : !u.dest;
      if (parked) { u.idle -= dt; if (u.idle <= 0) { const [x, z] = this.freePoint(u.spec.air ? 7 : 4); u.order(x, z); u.idle = u.spec.air ? rnd(6, 20) : rnd(2, 10); } }
    }
  }
}
