import { Vec3, lerp, clamp, wrapAngle as wrap, rng } from './math.js';

const rnd = (a, b) => a + rng() * (b - a);

export const SPEC = {
  soldier: { speed: 4.6, turn: 9, accel: 18, label: 'SQ', air: false, hp: 35, nav: 'foot' },   // four rifle hits; infantry are expendable, vehicles are not
  truck:   { speed: 9.5, turn: 1.1, accel: 5, label: 'TR', air: false, hp: 150, nav: 'vehicle' },
  apc:     { speed: 8,   turn: 0.9, accel: 4, label: 'AP', air: false, hp: 600, nav: 'vehicle', kit: 'autocannon' },
  heli:    { speed: 16,  turn: 1.4, accel: 6, label: 'HE', air: true, hp: 300, nav: null, kit: 'doorgun' },
  fob:     { speed: 0,   turn: 0,   accel: 0, label: 'FB', air: false, hp: 300, nav: null, structure: true },
  cache:   { speed: 0,   turn: 0,   accel: 0, label: 'CA', air: false, hp: 250, nav: null, structure: true },
  sandbags: { speed: 0, turn: 0,   accel: 0, label: 'SB', air: false, hp: 1e9, nav: null, structure: true, untargetable: true },   // low cover, not a target
  tank:     { speed: 7,   turn: 0.8, accel: 3.5, label: 'TK', air: false, hp: 1200, nav: 'vehicle', kit: 'tankgun', armour: true },   // M1 Abrams: thick front, weaker sides and rear
  rally:    { speed: 0, turn: 0,   accel: 0, label: 'RP', air: false, hp: 1e9, nav: null, structure: true, untargetable: true },   // a squad's spawn: burned by enemies close by, not shot
};
const counters = {}; let pickSeq = 0;

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
    this.stance = 'stand'; this.supp = 0; this.kneelK = 0; this.proneK = 0;   // infantry: suppression 0..1 and the pose blends it drives
    this.dead = false; this.deathT = 0; this.wreck = false; this.remove = false;
    this.mounted = null; this.passengers = []; this.boardTarget = null; this.supplies = 0;
    this.alt = 0; this.altT = 0; this.rotor = 0; this.rotorT = 0; this.state = 'parked'; this.tilt = 0; this.bank = 0;
    this.id = (counters[type] = (counters[type] || 0) + 1);
    this.label = `${spec.label}-${String(this.id).padStart(2, '0')}`;
    this.dist = 0;
  }

  get moving() { return Math.abs(this.speed) > 0.05 || this.state === 'cruise' || this.state === 'takeoff'; }
  setSelected(s) { this.selected = s; this.parts.ring.visible = s && !this.dead; }

  // Move order: path through the nav grid when one is available, otherwise straight line.
  order(x, z) {
    if (this.dead) return;
    const nav = this.mgr && this.mgr.nav && this.spec.nav ? this.mgr.nav[this.spec.nav] : null;
    if (nav && nav.inPocket(x, z)) { const c = nav.nearestMain(nav.cellOf(x), nav.cellOf(z)); if (c) { x = nav.world(c[0]); z = nav.world(c[1]); } }   // a goal inside a building, or in a pocket between buildings, becomes the nearest open ground
    this.dest = new Vec3(x, 0, z); this.idle = 0; this.hold = false; this.bestDist = Infinity; this.noProgress = 0;
    this.path = nav ? nav.findPath(this.pos.x, this.pos.z, x, z) : null;
    if (nav && !this.path) this.path = this.escapeRoute(nav, x, z);
    const first = this.path && this.path.length ? this.path[0] : [x, z];
    this.target = new Vec3(first[0], 0, first[1]);
    if (this.spec.air && (this.state === 'parked' || this.state === 'spooldown')) this.state = 'spool';
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
    this.bestDist = Infinity; this.noProgress = 0;
    if (this.path && this.path.length > 1) { this.path.shift(); this.target.set(this.path[0][0], 0, this.path[0][1]); return true; }
    this.target = null; this.path = null; this.dest = null; return false;
  }

  // ---- transport ---------------------------------------------------------
  board(heli) { if (this.type !== 'soldier' || this.dead || this.mounted) return; this.boardTarget = heli; this.boardT = 0; this.order(heli.pos.x, heli.pos.z + 3); }
  mount(heli) {
    this.mounted = heli; heli.passengers.push(this); this.boardTarget = null; this.group.visible = false;
    this.target = null; this.dest = null; this.path = null; this.hold = false; this.enemy = null; this.speed = 0;
  }
  unload() {   // helicopter: put passengers down around the airframe
    const n = this.passengers.length; if (!n) return;
    this.passengers.forEach((p, i) => { const a = i / n * Math.PI * 2; p.mounted = null; p.group.visible = true; p.pos.set(this.pos.x + Math.cos(a) * 5, this.pos.y, this.pos.z + Math.sin(a) * 5); p.heading = a; p.group.rotation.y = a; });
    this.passengers = [];
  }

  damage(amount, from) {
    if (this.dead) return false;
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.die(from); return true; }
    return false;
  }
  die(from) {
    this.dead = true; this.deathT = 0; this.enemy = null; this.target = null; this.path = null; this.dest = null; this.hold = false; this.boardTarget = null; this.building = null;
    this.killer = from || null; this.parts.ring.visible = false;
    if (this.passengers.length) { const ps = this.passengers; this.passengers = []; for (const p of ps) { p.mounted = null; p.group.visible = true; p.pos.set(this.pos.x, this.pos.y, this.pos.z); p.damage(9999, from); } }
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
    this.group.visible = true; this.speed = 0; this.enemy = null; this.target = null; this.path = null; this.dest = null; this.deathT = 0; this.reviveT = 0; this.hold = false; this.boardTarget = null; this.mounted = null;
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
      if (dust && this.wreckT < 75 && rng() < dt * (this.wreckT < 45 ? 6 : 4) * (this.type === 'apc' ? 1.5 : 1)) dust.smoke(this.pos.x, roof + 0.8, this.pos.z, k);   // from above the roof, so the plume clears the hull
      if (dust && this.wreckT < 45) for (let n = dt * (this.type === 'apc' ? 18 : 12) * (1 - this.wreckT / 50); n > 0; n -= 1) if (rng() < n) dust.fire(this.pos.x, roof - 0.4, this.pos.z, k);   // flames die down over the first 45 s
      if (this.wreckT > 90) this.remove = true;
    }
  }

  // ---- ground vehicles & infantry ------------------------------------------
  stepGround(dt, world) {
    const s = this.spec; let want = 0;
    if (this.target) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, dist = Math.hypot(dx, dz);
      const last = !this.path || this.path.length <= 1, arrive = last ? (this.type === 'soldier' ? 0.5 : 1.5) : 1.2;
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
        // trying to move but getting no nearer for a while (a wall, a crowd): call the last waypoint reached, else look for a way round
        if (want !== 0) {
          if (dist < this.bestDist - 0.15) { this.bestDist = dist; this.noProgress = 0; } else this.noProgress += dt;
          if (this.noProgress > 1.5) { if (last) this.nextWaypoint(); else { const d = this.dest; this.order(d.x, d.z); } }
        }
      }
    }
    if (this.hold && this.type === 'soldier') want = 0;
    // infantry stance: standing on the move, a knee when still, flat when suppressed (and only crawling then)
    if (this.type === 'soldier') {
      this.supp *= Math.exp(-dt / 2.5);
      this.stance = this.supp > 0.5 ? 'prone' : (this.supp > 0.25 && want === 0) ? 'prone' : want === 0 ? 'kneel' : 'stand';
      if (this.stance === 'prone' && want !== 0) want *= 0.3;
      const kk = this.stance === 'kneel' ? 1 : 0, pk = this.stance === 'prone' ? 1 : 0, r1 = Math.min(1, dt * 4), r2 = Math.min(1, dt * 3);
      this.kneelK += (kk - this.kneelK) * r1; this.proneK += (pk - this.proneK) * r2;
    }
    // face the enemy while standing still
    if (want === 0 && this.enemy && this.type === 'soldier') {
      const diff = wrap(Math.atan2(this.enemy.pos.x - this.pos.x, this.enemy.pos.z - this.pos.z) - this.heading);
      this.heading += clamp(diff, -s.turn * dt, s.turn * dt);
    }
    this.speed += clamp(want - this.speed, -s.accel * 2 * dt, s.accel * dt);
    if (Math.abs(this.speed) < 0.01) this.speed = 0;
    const step = this.speed * dt, sx = Math.sin(this.heading) * step, sz = Math.cos(this.heading) * step;
    let nx = this.pos.x + sx, nz = this.pos.z + sz;
    const pad = this.radius * 0.9;
    // a unit already inside a wall's clearance (shoved there, or sandbags went up beside it) squeezes out with half the
    // clearance, so it can leave a slot narrower than its full clearance, and any step that doesn't take it deeper is allowed
    const p = world.isBlocked(this.pos.x, this.pos.z, pad) ? pad * 0.5 : pad, deep = world.penetration(this.pos.x, this.pos.z, p);
    const free = (x, z) => !world.isBlocked(x, z, p) || (deep > 0 && world.penetration(x, z, p) <= deep + 1e-3);
    if (!free(nx, nz)) {
      if (free(this.pos.x + sx, this.pos.z)) nz = this.pos.z;
      else if (free(this.pos.x, this.pos.z + sz)) nx = this.pos.x;
      else { nx = this.pos.x; nz = this.pos.z; this.speed *= 0.5; }   // boxed in: stop (the no-progress rule above releases the order)
    }
    this.dist += Math.hypot(nx - this.pos.x, nz - this.pos.z);
    const H = this.mgr.world.half; this.pos.x = clamp(nx, -H + 2, H - 2); this.pos.z = clamp(nz, -H + 2, H - 2);
    this.pos.y = this.mgr.world.heightAt(this.pos.x, this.pos.z);
    this.group.rotation.y = this.heading;
    this.animate(dt);
  }

  animate(dt) {
    const p = this.parts;
    if (this.type === 'soldier') {
      const run = clamp(this.speed / this.spec.speed, 0, 1);
      this.phase += dt * (3 + 10 * run);
      const sw = Math.sin(this.phase) * 0.85 * run;              // +x rotation swings a leg backward
      p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
      p.kneeL.rotation.x = Math.max(0, sw) * 1.4 + 0.12 * run;   // heel kicks up on the trailing leg
      p.kneeR.rotation.x = Math.max(0, -sw) * 1.4 + 0.12 * run;
      const bob = 1.1 + Math.abs(Math.cos(this.phase)) * 0.08 * run;
      p.torso.position.y = p.legL.position.y = p.legR.position.y = bob;
      p.torso.rotation.x = 0.22 * run + (this.enemy && run < 0.2 ? 0.12 : 0);   // lean into the run / into the rifle
      p.torso.rotation.y = Math.sin(this.phase) * 0.08 * run;
      p.armL.rotation.x = -1.35 + Math.sin(this.phase) * 0.12 * run; p.armL.rotation.z = 0.35;
      p.armR.rotation.x = -1.0 - Math.sin(this.phase) * 0.12 * run; p.armR.rotation.z = -0.25;
      // stance on top of the walk: kneel drops the hips with the left thigh forward and the right knee down,
      // prone lays the body flat with the legs straight back and the arms forward on the rifle
      const k = this.kneelK, pr = this.proneK;
      if (k > 0.01 || pr > 0.01) {
        p.torso.position.y = p.legL.position.y = p.legR.position.y = bob - 0.45 * k - 0.8 * pr;
        p.torso.rotation.x += 0.15 * k + 1.45 * pr;
        p.legL.rotation.x += -1.5 * k + 1.5 * pr; p.kneeL.rotation.x += 1.5 * k;
        p.legR.rotation.x += 0.9 * k + 1.5 * pr; p.kneeR.rotation.x += 1.3 * k;
        p.armL.rotation.x += 1.1 * pr; p.armR.rotation.x += 0.8 * pr;
      }
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
        const want = this.enemy ? wrap(Math.atan2(this.enemy.pos.x - this.pos.x, this.enemy.pos.z - this.pos.z) - this.heading) : Math.sin(this.phase + performance.now() * 0.0004) * 0.6;
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
        if (!this.target) { this.state = 'land'; break; }
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, dist = Math.hypot(dx, dz);
        if (dist < 1.2 && this.speed < 1.5) { this.state = 'land'; this.target = null; this.dest = null; break; }
        const desired = Math.atan2(dx, dz), diff = wrap(desired - this.heading);
        const turn = clamp(diff, -s.turn * dt, s.turn * dt); this.heading += turn;
        const want = s.speed * clamp(dist / 14, 0.08, 1) * clamp(1.3 - Math.abs(diff), 0.15, 1);
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
    this.pos.y = this.mgr.world.heightAt(this.pos.x, this.pos.z) + this.alt;
    this.group.rotation.y = this.heading;
    this.tilt = lerp(this.tilt, this.speed / s.speed * 0.22, 1 - Math.pow(0.02, dt));
    p.body.rotation.x = this.tilt; p.body.rotation.z = this.bank;
    p.ring.position.y = -this.alt + 0.04;
    this.dist += step;
  }

  step(dt, world) {
    if (this.dead) { this.stepDead(dt); return; }
    if (this.spec.structure) { this.pos.y = world.heightAt(this.pos.x, this.pos.z); return; }   // structures sit on the terrain
    if (this.mounted) { this.pos.copy(this.mounted.pos); return; }
    if (this.boardTarget) {
      const h = this.boardTarget;
      if (h.dead || h.passengers.length >= 8) this.boardTarget = null;
      else if (Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z) < 5 && h.alt < 0.5) { this.mount(h); return; }
      else if ((this.boardT += dt) > 1.5 && !this.dest) { this.boardT = 0; this.order(h.pos.x, h.pos.z + 3); }
    }
    this.spec.air ? this.stepAir(dt, world) : this.stepGround(dt, world);
  }
}

export class Squad {
  constructor(members) { this.members = members; for (const m of members) m.squad = this; this.idle = rnd(0, 4); }
  get leader() { return this.members.find(m => !m.dead) || null; }
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
  board(heli) { for (const m of this.members) if (!m.dead && !m.mounted) m.board(heli); }
  get mounted() { const a = this.members.filter(m => !m.dead); return a.length > 0 && a.every(m => m.mounted); }
  get engineer() { return this.members.find(m => !m.dead && m.kit === 'engineer') || null; }
  centroid() { const a = this.members.filter(m => !m.dead); const c = new Vec3(); for (const m of a) c.add(m.pos); return c.multiplyScalar(1 / (a.length || 1)); }
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

  add(unit) { unit.mgr = this; this.units.push(unit); this.scene.add(unit.group); return unit; }
  spawn(type, x, z, heading, team = 0, opts = {}) {
    if (x === undefined) [x, z] = this.freePoint(SPEC[type].air ? 6 : 3);
    const u = this.add(new Unit(type, (opts.supply && this.builders.supplyTruck) || this.builders[type], x, z, heading, team));   // the supply truck shows its load
    u.pos.y = this.world.heightAt(x, z);
    if (opts.supply) { u.supply = true; u.supplies = 100; u.label = u.label.replace('TR', 'SP'); }
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
    for (const u of this.units) { u.step(dt, w); if (this.dust && dt > 0 && !u.dead) this.dust.fromUnit(u, dt); }
    for (let i = this.units.length - 1; i >= 0; i--) if (this.units[i].remove) this.removeUnit(this.units[i]);
    // separation between ground units
    const push = (a, b) => {
      if (a.dead || b.dead || a.mounted || b.mounted || (a.spec.air && a.alt > 0.1) || (b.spec.air && b.alt > 0.1)) return;
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
