import { WEAPONS } from './weapons.js';

// Targeting, line of sight, firing and damage. Ticks at a fixed rate from Match. Each shot is a
// round in flight (core/projectiles.js): the hit is rolled when the trigger is pulled, the damage
// lands when the round arrives, so bullets, cannon shells and rockets are seen travelling.
const GUN_MUZZLE = { hmg: [1.5, 0.9], atgm: [1.1, 1.02], mortar: [0.62, 1.15] };   // a FOB gun's muzzle: metres out from the mount toward the target, and up
const MUZZLE_KIND = { coax: 'mg', mg: 'mg', marksman: 'marksman', autocannon: 'cannon', at: 'rocket', doorgun: 'doorgun', tankgun: 'tank', hmg: 'mg', atgm: 'rocket', mortar: 'cannon', hydra: 'rocket', gau19: 'mg' };   // flash class per kit (recipes in core/dust.js)
const CELL = 20;

export class Combat {
  constructor(units, spatial, world, dust) {
    this.units = units; this.spatial = spatial; this.world = world; this.dust = dust;
    this.onDeath = null; this.scratch = []; this.teams = null; this.audio = null; this.vision = null;
    // coarse grids over the obstacles so a segment test only touches the boxes near it: tall boxes block
    // line of sight, low ones (walls, sandbags, rocks) give partial cover to a soldier right behind them
    this.half = (world.size || 1000) / 2; this.nx = Math.ceil(this.half * 2 / CELL) + 1;
    const h = (o) => (o.h === undefined ? 2 : o.h);
    this.tall = this.gridOf(world.obstacles.filter(o => h(o) >= 1.5));
    this.low = this.gridOf(world.obstacles.filter(o => h(o) >= 0.7 && h(o) < 1.5));
    this.buildings = null;   // game/buildings.js, set by the match
    dust.shots.walls = (x0, y0, z0, x1, y1, z1) => this.wallHit(x0, y0, z0, x1, y1, z1);
  }
  // the obstacles changed in height or number (a building came down): the grids again
  rebuildGrids() {
    const h = (o) => (o.h === undefined ? 2 : o.h), O = this.world.obstacles; for (const o of O) delete o.top;
    this.tall = this.gridOf(O.filter(o => h(o) >= 1.5)); this.low = this.gridOf(O.filter(o => h(o) >= 0.7 && h(o) < 1.5));
  }
  // where a stray round's step meets a tall box: into a wall where the line enters below the top, onto the roof where it comes
  // down inside; a step that starts inside a box (a muzzle against a wall) passes. Only misses are stopped: a hit was settled at
  // the trigger, and stopping those at walls the line-of-sight test had let the shooter see past cut kills by two fifths
  wallHit(ax, ay, az, bx, by, bz) {
    const G = this.tall, B = G.list, st = G.stamp, gen = ++G.gen, dx = bx - ax, dz = bz - az;
    const x0 = this.ci(Math.min(ax, bx)), x1 = this.ci(Math.max(ax, bx)), z0 = this.ci(Math.min(az, bz)), z1 = this.ci(Math.max(az, bz));
    let best = null;
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const a = G.cells.get(cz * this.nx + cx); if (!a) continue;
      for (const i of a) {
        if (st[i] === gen) continue; st[i] = gen;
        const o = B[i]; let t0 = 0, t1 = 1, inside = true;
        for (const [p, d, lo, hi] of [[ax, dx, o.minX, o.maxX], [az, dz, o.minZ, o.maxZ]]) {
          if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
          let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) [ta, tb] = [tb, ta];
          if (ta > 0) inside = false;
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) break;
        }
        if (t0 > t1 || inside) continue;
        if (o.top === undefined) o.top = this.groundAt((o.minX + o.maxX) / 2, (o.minZ + o.maxZ) / 2) + (o.h === undefined ? 2 : o.h);
        let t = -1;
        if (ay + (by - ay) * t0 < o.top) t = t0;                                                      // into the wall
        else if (by < ay && ay + (by - ay) * t1 < o.top) t = Math.max(t0, (o.top - ay) / (by - ay));   // down onto the roof
        if (t >= 0 && (!best || t < best.t)) best = { t, o };
      }
    }
    return best ? { x: ax + dx * best.t, y: ay + (by - ay) * best.t, z: az + dz * best.t, o: best.o, b: best.o.bld || null } : null;
  }
  ci(v) { return Math.max(0, Math.min(this.nx - 1, Math.floor((v + this.half) / CELL))); }
  gridOf(list) {
    const g = { list, cells: new Map(), stamp: new Int32Array(list.length), gen: 0 };
    list.forEach((o, i) => { for (let cz = this.ci(o.minZ); cz <= this.ci(o.maxZ); cz++) for (let cx = this.ci(o.minX); cx <= this.ci(o.maxX); cx++) { const k = cz * this.nx + cx; let a = g.cells.get(k); if (!a) g.cells.set(k, a = []); a.push(i); } });
    return g;
  }
  // does the 2D segment cross any box of the grid?
  segHits(G, ax, az, bx, bz, ya, yb) {
    const B = G.list, st = G.stamp, gen = ++G.gen, dx = bx - ax, dz = bz - az;
    const x0 = this.ci(Math.min(ax, bx)), x1 = this.ci(Math.max(ax, bx)), z0 = this.ci(Math.min(az, bz)), z1 = this.ci(Math.max(az, bz));
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const a = G.cells.get(cz * this.nx + cx); if (!a) continue;
      for (const i of a) {
        if (st[i] === gen) continue; st[i] = gen;
        const o = B[i]; let t0 = 0, t1 = 1;
        for (const [p, d, lo, hi] of [[ax, dx, o.minX, o.maxX], [az, dz, o.minZ, o.maxZ]]) {
          if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
          let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) break;
        }
        if (t0 > t1) continue;
        if (ya === undefined) return true;
        if (o.top === undefined) o.top = this.groundAt((o.minX + o.maxX) / 2, (o.minZ + o.maxZ) / 2) + (o.h === undefined ? 2 : o.h);
        if (Math.min(ya + (yb - ya) * t0, ya + (yb - ya) * t1) < o.top) return true;   // the line dips below the box's top inside it
      }
    }
    return false;
  }
  // ya/yb (absolute heights of the two ends) make it a 3D test: a box blocks only where the line passes below its top, so
  // a tank's gun at 3 m sees over a bush, a rock or a garden wall midway while a soldier crouched behind one stays hidden
  los(ax, az, bx, bz, ya, yb) { return !this.segHits(this.tall, ax, az, bx, bz, ya, yb); }
  // a low obstacle added after the match started (sandbags)
  addLow(o) {
    const G = this.low, i = G.list.length; G.list.push(o); const st = new Int32Array(i + 1); st.set(G.stamp); G.stamp = st;
    for (let cz = this.ci(o.minZ); cz <= this.ci(o.maxZ); cz++) for (let cx = this.ci(o.minX); cx <= this.ci(o.maxX); cx++) { const k = cz * this.nx + cx; let a = G.cells.get(k); if (!a) G.cells.set(k, a = []); a.push(i); }
  }
  // a soldier settled in a sandbag position's firing slot, shot at from its front or sides (not through the open rear)
  dugIn(e, from) { const p = e.post; if (!p || !p.settled) return false; const a = Math.atan2(from.pos.x - e.pos.x, from.pos.z - e.pos.z) - p.sb.heading; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < Math.PI * 0.6; }
  // partial cover: a low obstacle within 3 m of the target on the shooter's side
  covered(e, from) { const dx = from.pos.x - e.pos.x, dz = from.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1, L = Math.min(3, d); return this.segHits(this.low, e.pos.x, e.pos.z, e.pos.x + dx / d * L, e.pos.z + dz / d * L); }
  // can unit u see a point on the ground (hills and tall boxes)?
  canSeePoint(u, x, z) {
    const T = this.world.terrain;
    if (T && !T.los(u.pos.x, this.eyeY(u), u.pos.z, x, this.groundAt(x, z) + 1.2, z)) return false;
    return this.los(u.pos.x, u.pos.z, x, z, this.eyeY(u), this.groundAt(x, z) + 1.2);
  }
  // the nearest passable spot around (x,z), out to r, wide enough for a squad, that the threat at (tx,tz) cannot
  // see: behind a building or a hill. null if there is none.
  coverPoint(x, z, tx, tz, r, nav) {
    const T = this.world.terrain, ty = this.groundAt(tx, tz) + 3.6;
    const hidden = (px, pz) => !(nav && nav.blocked(px, pz)) && ((T && !T.los(tx, ty, tz, px, this.groundAt(px, pz) + 1.2, pz)) || !this.los(tx, tz, px, pz, ty, this.groundAt(px, pz) + 1.2));
    for (const dist of [5, 9, 14, 20, r]) for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + dist * 0.37, px = x + Math.cos(a) * dist, pz = z + Math.sin(a) * dist;
      const ex = px - tx, ez = pz - tz, el = Math.hypot(ex, ez) || 1, qx = -ez / el * 2.2, qz = ex / el * 2.2;   // across the line of fire
      if (hidden(px, pz) && hidden(px + qx, pz + qz) && hidden(px - qx, pz - qz)) return [px, pz];
    }
    return null;
  }

  eyeY(u) { return u.pos.y + (u.type === 'soldier' ? 1.5 - 0.5 * (u.kneelK || 0) - 1.0 * (u.proneK || 0) : u.type === 'apc' ? 3.2 : u.type === 'tank' ? 2.9 : 1.8); }
  // armoured vehicles take explosive hits by facing: 60% on the front, 125% on the sides, double from behind
  facing(e, from) {
    const a = Math.atan2(from.pos.x - e.pos.x, from.pos.z - e.pos.z) - e.heading, d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    return d < Math.PI / 4 ? 0.6 : d > Math.PI * 3 / 4 ? 2 : 1.25;
  }
  // suppression: rounds landing or bursting near infantry push them down; an MG burst pins a squad, a rifle burst rattles it
  suppress(x, z, w, shooterTeam, victim = null) {
    const r = w.explosive ? 9 : 4, amount = w.explosive ? 0.4 : w.burst >= 8 ? 0.1 : w.dmgInf >= 20 ? 0.25 : 0.07;
    for (const s of this.spatial.query(x, z, r, this.scratch)) {
      if (s.type !== 'soldier' || s.dead || s.mounted || s.team === shooterTeam) continue;
      const d = Math.hypot(s.pos.x - x, s.pos.z - z); s.supp = Math.min(1, s.supp + amount * (1 - 0.5 * d / r) * (s === victim ? 2 : 1) * (s.post && s.post.settled ? 0.5 : 1));   // dug in: half the suppression
    }
  }
  canSee(u, e) {
    const T = this.world.terrain;
    if (T && !T.los(u.pos.x, this.eyeY(u), u.pos.z, e.pos.x, e.pos.y + 1.2, e.pos.z)) return false;   // hills block
    if ((u.spec.air && u.alt > 2) || (e.spec.air && e.alt > 2)) return true;
    return this.los(u.pos.x, u.pos.z, e.pos.x, e.pos.z, this.eyeY(u), e.pos.y + 1.2);
  }
  // a turreted vehicle (tank, APC) fires only once its turret has swung onto the target, so the round leaves the barrel
  onTarget(u, e) {
    const t = u.parts && u.parts.turret; if (!t) return true;
    const a = Math.atan2(e.pos.x - u.pos.x, e.pos.z - u.pos.z) - u.heading - t.rotation.y;
    return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.12;
  }
  groundAt(x, z) { return this.world.heightAt ? this.world.heightAt(x, z) : 0; }

  // a mortar's target: an enemy its side sees (no line of sight from the tube) between its least and greatest range,
  // the one with the most others about it first (the burst takes them too)
  findIndirect(u, w) {
    const seen = this.vision ? this.vision.contacts(u.team).filter(e => !e.ghost) : this.units.units.filter(e => e.team !== u.team);
    let best = null, bestScore = -Infinity;
    for (const e of seen) {
      if (e.dead || e.mounted || e.spec.untargetable || (e.spec.air && e.alt > 2) || e.team === u.team || e.team < 0 || e.team > 1) continue;
      const d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z); if (d > w.range || d < w.min) continue;
      let n = 0; for (const o of seen) if (o !== e && !o.dead && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < w.splash * 1.5) n++;
      const score = n * 10 + (e.type === 'soldier' ? 3 : 0) - d * 0.01; if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }
  findTarget(u, w) {
    if (w.indirect) return this.findIndirect(u, w);
    const list = this.spatial.query(u.pos.x, u.pos.z, w.range, this.scratch);
    let best = null, bestScore = -Infinity;
    for (const e of list) {
      if (e.team === u.team || e.dead || e.mounted || e.spec.untargetable) continue;
      if (e.spec.air && e.alt > 2 && !w.air) continue;
      const d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z);
      let score = -d;
      if (w.prefersVehicles && e.type !== 'soldier') score += 40;
      if (!w.prefersVehicles && e.type === 'soldier') score += 6;
      if (u.kit2 === 'coax' && e.type === 'soldier' && d < 60) score += 60;   // a tank deals with infantry close by first: they carry the rockets
      if (score <= bestScore) continue;
      if (!this.canSee(u, e)) continue;
      best = e; bestScore = score;
    }
    return best;
  }

  // the weapon a unit fires: its kit, or the gun of the emplacement it mans once in place
  gunOf(u) { const p = u.post; return p && p.settled && p.sb.gun && !p.sb.dead ? p.sb.gun : u.kit; }
  tick(dt) {
    for (const u of this.units.units) {
      if (u.dead || !u.kit || u.mounted) continue;
      const kit = this.gunOf(u), w = WEAPONS[kit];
      if (u.armed !== kit) { if (u.armed !== undefined) { u.enemy = null; u.burst = 0; u.retarget = 0; } u.armed = kit; }   // took over or left a gun
      u.cooldown -= dt;
      if (u.enemy) {
        const e = u.enemy, d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z);
        let lost = e.dead || e.mounted || d > w.range * 1.15 || (w.min && d < w.min * 0.8);
        if (!lost && (u.retarget -= dt) <= 0) {
          u.retarget = 0.5; lost = w.indirect ? !!this.vision && !this.vision.sees(u.team, e) : !this.canSee(u, e);   // a mortar needs its side to see the target, not the tube
          if (!lost && u.kit2 && e.type !== 'soldier') { const n = this.findTarget(u, w); if (n && n.type === 'soldier') { u.enemy = n; u.burst = 0; continue; } }   // a tank turns from armour to infantry closing in
        }
        if (lost) { u.enemy = null; u.retarget = 0.3; u.burst = 0; }
        else u.hold = u.type === 'soldier' && d < (u.dest && !u.advance ? Math.min(w.hold, 18) : w.hold);   // infantry on the move only stop for an enemy at close quarters, unless the move is an attack-move; once where they were sent they hold and shoot out to their hold range
      }
      if (!u.enemy) {
        u.hold = false;
        if ((u.retarget -= dt) <= 0) { u.retarget = 0.4 + Math.random() * 0.3; u.enemy = this.findTarget(u, w); }
      }
      if (u.enemy && u.cooldown <= 0 && this.onTarget(u, u.enemy) && !(u.ammo !== undefined && u.ammo < 1)) this.fire(u, w, u.enemy, kit);   // an empty rocket pod waits for the base
      if (u.kit2) {   // the coax shares the turret: it fires at the turret's target when that is infantry in its range
        const w2 = WEAPONS[u.kit2], e = u.enemy; u.cooldown2 -= dt;
        if (e && e.type === 'soldier' && !e.dead && u.cooldown2 <= 0 && Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z) <= w2.range && this.onTarget(u, e)) this.fire(u, w2, e, u.kit2);
      }
    }
  }

  // one round: roll the hit now, send the round on its way, settle the damage when it lands
  fire(u, w, e, kit = u.kit) {
    const two = !!u.kit2 && kit === u.kit2, B = two ? 'burst2' : 'burst', CD = two ? 'cooldown2' : 'cooldown';   // a second weapon keeps its own burst and reload
    if (!two && u.ammo !== undefined) u.ammo--;   // a rocket off the pod
    if (!u[B]) u[B] = w.burst;
    const first = u[B] === w.burst; u[B]--;
    u[CD] = u[B] > 0 ? w.burstGap * (0.8 + Math.random() * 0.4) : w.rate * (0.85 + Math.random() * 0.3);
    if (u.type === 'soldier' && u.supp > 0.7) u.cooldown *= 1.5;   // pinned: head down, fewer rounds
    const d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z), T = this.teams ? this.teams[u.team] : null;
    let chance = w.acc * Math.max(0.05, 1 - 0.75 * d / w.range) * ((T && T.acc) || 1);
    if (Math.abs(u.speed) > 0.5) chance *= 0.5;
    if (!first) chance *= 0.8;                          // recoil through the burst
    if (u.type === 'soldier') chance *= 1 - 0.4 * u.supp; // a suppressed shooter aims badly
    if (e.type !== 'soldier') chance *= 1.6;            // vehicles are big targets
    if (w.rocket && e.spec.air && e.alt > 2) chance *= u.squad && u.squad.aa && !u.dest ? 0.7 : 0.35;   // an unguided rocket at a helicopter in the air rarely connects; braced for it (a squad standing to fire at helicopters, strategist.skyward) twice as often
    else { const dug = this.dugIn(e, u); chance *= Math.max(dug ? 0.2 : 0.3, (dug ? 0.35 : this.covered(e, u) ? 0.5 : 1) * (1 - 0.2 * (e.kneelK || 0) - 0.4 * (e.proneK || 0))); }   // a manned position, cover and a low stance shrink the target
    const hit = Math.random() < chance;
    // the round leaves the barrel a little ahead of the unit at gun height, aimed where the target will be
    // when it arrives; a miss is aimed past the target and comes down on the ground around it
    const gun = u.post && u.post.settled && u.post.sb.gun === kit && !u.post.sb.dead ? u.post.sb : null, GM = gun && GUN_MUZZLE[kit];   // a manned FOB gun: from its own muzzle
    const reach = GM ? GM[0] : u.type === 'soldier' ? (u.kit === 'at' ? 0.75 : u.kit === 'mg' ? 1.28 : 1.16) + 0.1 * (u.kneelK || 0) + 0.46 * (u.proneK || 0) : u.type === 'apc' ? 2.8 : u.type === 'tank' ? (kit === 'coax' ? 2.9 : 6.2) : 1.6, gunY = u.pos.y + (u.type === 'soldier' ? 1.85 - 0.59 * (u.kneelK || 0) - 1.65 * (u.proneK || 0) : u.type === 'tank' ? 2.1 : u.type === 'apc' ? 3.25 : u.type === 'bird' ? 1.1 : 2.65);
    const o = GM ? gun.pos : u.pos, hx = e.pos.x - o.x, hz = e.pos.z - o.z, hd = Math.hypot(hx, hz) || 1, gy = GM ? gun.pos.y + GM[1] : gunY;
    let mx = o.x + hx / hd * reach, mz = o.z + hz / hd * reach;
    if (u.type === 'heli') {   // the Chinook fires from the crew-door gun on the target's side
      const c = Math.cos(u.heading), sn = Math.sin(u.heading), side = hx * c - hz * sn > 0 ? 1.45 : -1.45;
      mx = u.pos.x + side * c + 3.6 * sn; mz = u.pos.z - side * sn + 3.6 * c;
    } else if (u.type === 'bird') {   // the Little Bird fires from its stub mounts: the pod to port, the gatling to starboard
      const c = Math.cos(u.heading), sn = Math.sin(u.heading), side = kit === 'hydra' ? 1.1 : -1.1;
      mx = u.pos.x + side * c + 1.0 * sn; mz = u.pos.z - side * sn + 1.0 * c;
    }
    const flight = d / (w.arc ? w.speed * 0.85 : w.speed), ev = Math.abs(e.speed) > 0.05 && !e.dead && !w.indirect ? e.speed : 0;   // a mortar lays on where the target is
    let tx = e.pos.x + Math.sin(e.heading) * ev * flight, tz = e.pos.z + Math.cos(e.heading) * ev * flight, ty = e.pos.y + (e.spec.air ? 2 : e.type === 'soldier' ? 1.1 - 0.35 * (e.kneelK || 0) - 0.75 * (e.proneK || 0) : 2.2);
    if (!hit) { const sp = (w.arc ? 2 : 1.5) + d * (w.arc ? 0.06 : 0.04); tx += (Math.random() - 0.5) * 2 * sp; tz += (Math.random() - 0.5) * 2 * sp; ty = e.spec.air && e.alt > 2 ? ty + (Math.random() - 0.5) * 6 : this.groundAt(tx, tz) + 0.1; }
    let near = null;
    if (!hit && !w.arc && !w.splash && !(e.spec.air && e.alt > 2)) {   // a missed bullet or rocket flies on past the target, into the ground beyond or whatever stands there (a bursting shell still comes down around the target)
      near = { x: tx, z: tz };
      const ox = tx - mx, oz = tz - mz, od = Math.hypot(ox, oz) || 1, over = 4 + Math.random() * 24;
      tx += ox / od * over; tz += oz / od * over; ty = this.groundAt(tx, tz) + 0.1;
    }
    const vx = tx - mx, vz = tz - mz, vy = w.elev ? Math.tan(w.elev) * Math.hypot(vx, vz) : ty - gy, vl = Math.hypot(vx, vy, vz) || 1;   // the flash points the way the tube does
    this.dust.muzzle(mx, gy, mz, vx / vl, vy / vl, vz / vl, MUZZLE_KIND[kit] || 'rifle');
    if (this.audio) {
      this.audio.shot(kit, u.pos.x, u.pos.z, u.team);
      if (kit === 'at') { const x = u.pos.x, z = u.pos.z; setTimeout(() => this.audio.foley('reload', x, z, 0.5), 1600); }   // the loader's next round
      if (!hit && e.type === 'soldier' && Math.random() < 0.3) this.audio.whizz(e.pos.x, e.pos.z);                        // a near miss
    }
    if (this.onShot) this.onShot(u, w, e, hit);
    if (this.vision) { this.vision.reveal(u, e.team); this.vision.reveal(e, u.team); }   // the flash and the noise give the shooter away; whoever is aimed at is seen
    this.dust.shots.fire({ x: mx, y: gy, z: mz, tx, ty, tz, speed: w.speed, arc: !!w.arc, high: !!w.indirect, elev: w.elev || 0, kind: w.arc || kit === 'tankgun' ? 'shell' : w.rocket ? 'rocket' : 'bullet',
      trail: w.arc ? 7 : kit === 'tankgun' ? 14 : w.rocket ? 2.5 : (kit === 'mg' || kit === 'doorgun' || kit === 'coax' || kit === 'hmg') ? 8 : 4.5, stray: !hit, near, onArrive: (p) => this.arrive(p, u, w, e, hit, kit) });
  }

  arrive(p, u, w, e, hit, kit = u.kit) {
    const T = this.teams ? this.teams[u.team] : null;
    if (p.wall) {   // into a wall or a roof before it got anywhere: sparks or a burst on the face, the building the worse for it
      if (w.explosive) this.dust.explosion(p.x, p.y, p.z, kit === 'tankgun' ? 0.7 : w.splash ? 0.6 : 0.35); else this.dust.hitSpark(p.x, p.y, p.z);
      if (this.audio) w.explosive ? this.audio.blast(p.x, p.z, kit === 'tankgun' || w.splash ? 1.4 : 1) : this.audio.hit(p.x, p.z);
      this.suppress(p.near ? p.near.x : p.x, p.near ? p.near.z : p.z, w, u.team);   // the round cracked past the target on its way to the wall
      if (w.splash) this.splashAt(p.x, p.z, w, u, kit, null);
      if (p.wall.b && this.buildings) this.buildings.hit(p.wall.b, p, w, kit, u);
      return;
    }
    const close = hit && !e.dead && !e.mounted && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < (e.type === 'soldier' ? 2.5 : 4.5);
    if (close) {
      let dmg = (e.type === 'soldier' ? w.dmgInf : w.dmgVeh) * ((T && T.dmg) || 1);
      if (e.spec.armour && w.explosive) dmg *= this.facing(e, u);   // flank the tank
      if (w.explosive) this.dust.explosion(p.x, p.y, p.z, kit === 'tankgun' ? 0.7 : 0.35); else this.dust.hitSpark(p.x, p.y, p.z);
      if (this.audio) w.explosive ? this.audio.blast(p.x, p.z, kit === 'tankgun' ? 1.4 : 1) : this.audio.hit(p.x, p.z);
      u.firedKit = kit;   // the kill feed names the weapon that did it
      if (e.damage(dmg, u)) { this.onDeath && this.onDeath(e, u); }
      this.suppress(p.x, p.z, w, u.team, e);
    } else {
      const gy = this.groundAt(p.x, p.z), y = Math.max(p.y, gy + 0.1);
      if (w.explosive) this.dust.explosion(p.x, y, p.z, w.splash ? 0.6 : 0.3); else this.dust.impact(p.x, y, p.z);
      if (this.audio) w.explosive ? this.audio.blast(p.x, p.z, kit === 'tankgun' || w.splash ? 1.4 : 1) : this.audio.impact(p.x, p.z);
      this.suppress(p.near ? p.near.x : p.x, p.near ? p.near.z : p.z, w, u.team);   // a miss that flew on still cracked past the target
    }
    if (w.splash) this.splashAt(p.x, p.z, w, u, kit, close ? e : null);
  }
  // a shell bursting at (x, z) hurts everyone of the other side within w.splash: less further out, a third as much in a
  // manned position facing the burst or behind cover, less again lying down; the target it struck is not hit twice
  splashAt(x, z, w, u, kit, skip) {
    if (this.buildings) this.buildings.splash(x, z, Math.min(w.splash, 3), u);   // a burst against a wall
    const T = this.teams ? this.teams[u.team] : null, near = this.spatial.query(x, z, w.splash, this.splashList || (this.splashList = []));
    const at = { pos: { x, z } };
    for (const o of [...near]) {
      if (o === skip || o.dead || o.mounted || o.team === u.team || o.team < 0 || o.team > 1 || o.spec.untargetable || (o.spec.air && o.alt > 2)) continue;
      const d = Math.hypot(o.pos.x - x, o.pos.z - z), k = 1 - d / w.splash; if (k <= 0) continue;
      let dmg = (o.type === 'soldier' ? w.dmgInf : w.dmgVeh * 0.5) * k * ((T && T.dmg) || 1);
      if (o.type === 'soldier') dmg *= (this.dugIn(o, at) || this.covered(o, at) ? 0.35 : 1) * (1 - 0.5 * (o.proneK || 0));
      u.firedKit = kit;
      if (o.damage(dmg, u)) this.onDeath && this.onDeath(o, u);
    }
  }
}
