import { RULES } from './rules.js';
import { Vec3, clamp, wrapAngle as wrap } from '../core/math.js';

// Landing craft for a side whose main base is a ship (map.sea; that base is marked ship: true). Only its helicopters stand on
// the ship, on the flight deck. Everything else waits in the well dock (afloat: mounted on the dock, hidden) for a landing
// craft to run it ashore along a fixed lane to a beach. The player picks the beach; a CPU side takes the one nearest the
// place it wants, weighed against the enemies it has seen there. A craft is a unit, so it can be shot and goes down with its
// load, but it is moved here and never ordered: out along its lane, its load down the ramp and up the beach, back to the
// dock. A beach whose place the side holds is a supply dump. With none held, a supply truck waiting to refill at the beach
// rides a craft back to the ship and comes out again full.
export class Landing {
  constructor(match, sea) {
    this.m = match; this.units = match.units; this.sea = sea;
    this.team = match.teams.findIndex(t => t.base.ship); match.teams[this.team].landing = this;
    this.lanes = sea.lanes.map(l => ({ ...l, len: l.path.reduce((s, p, i) => i ? s + Math.hypot(p[0] - l.path[i - 1][0], p[1] - l.path[i - 1][1]) : 0, 0), at: { x: l.muster[0], z: l.muster[1], r: 30 } }));
    const [dx, dz] = sea.dock;
    this.dock = { pos: new Vec3(dx, match.world.terrain.water, dz), passengers: [], spec: { air: false }, type: 'dock', team: this.team, dead: false, heading: 0 };
    this.craft = []; this.rebuilds = []; this.last = this.lanes[0]; this.choice = this.lanes[0].name; this.clock = 0;
    for (let i = 0; i < sea.craft; i++) this.launch(i);
  }

  // ---- the ship, the dock and the beaches
  get base() { return this.m.teams[this.team].base; }
  atShip(x, z) { return Math.hypot(x - this.base.x, z - this.base.z) < this.base.r; }
  slot(i) { const [x, z] = this.sea.dock, h = this.sea.out; return [x + Math.cos(h) * (i - 1) * 10 + Math.sin(h) * 16, z - Math.sin(h) * (i - 1) * 10 + Math.cos(h) * 16]; }   // craft wait side by side off the stern gate
  deckSpot() { const S = this.sea.deck, U = this.units.units, free = S.find(([x, z]) => !U.some(u => u.type === 'heli' && !u.dead && Math.hypot(u.pos.x - x, u.pos.z - z) < 8)); return free || S[Math.floor(Math.random() * S.length)]; }
  home() { return this.last.at; }   // where the side's ground units go home to: the beach its craft used last
  held(l) { const o = this.m.objectives, p = o && o.list.find(q => q.name === l.place); return !!p && p.owner === this.team; }
  dumpAt(x, z) { return this.lanes.some(l => this.held(l) && Math.hypot(x - l.at.x, z - l.at.z) < RULES.landing.dump); }
  refillPoint(x, z) { const d = this.lanes.filter(l => this.held(l)).sort((a, b) => Math.hypot(a.at.x - x, a.at.z - z) - Math.hypot(b.at.x - x, b.at.z - z))[0]; return d ? d.at : this.home(); }

  // a unit into the well dock: hidden, aboard nothing yet, waiting for the next craft out
  embark(u) {
    u.afloat = true; u.mounted = this.dock; this.dock.passengers.push(u); u.group.visible = false; u.pos.copy(this.dock.pos);
    u.target = null; u.dest = null; u.path = null; u.enemy = null; u.speed = 0; u.hold = false; u.boardTarget = null;
  }
  // at the start: the ground force into the dock for the first wave, the helicopters onto the flight deck
  afterDeploy() {
    const W = this.m.world;
    for (const u of this.units.units) {
      if (u.team !== this.team || u.dead || u.spec.naval || u.spec.structure) continue;
      if (u.spec.air) { const [x, z] = this.deckSpot(); u.pos.set(x, W.heightAt(x, z), z); }
      else this.embark(u);
    }
  }
  launch(i) {
    const [x, z] = this.slot(i), c = this.units.spawn('craft', x, z, this.sea.out, this.team);
    Object.assign(c, { slotI: i, state: 'dock', route: null, k: 0, lane: null, wait: 0, sinkT: 0 }); c.pos.y = this.m.world.terrain.water;
    this.craft.push(c); return c;
  }

  // ---- choosing a beach: the player's choice; a CPU side's best by distance to the place it wants, the run, and the enemies
  // it has seen near the beach (a beach whose place it holds is a little safer still)
  cpu() { return this.m.cpu.includes(this.team); }
  choose(vehicles) {
    const ok = this.lanes.filter(l => l.vehicles || !vehicles);
    if (!this.cpu()) { const want = this.lanes.find(l => l.name === this.choice) || this.lanes[0]; return ok.includes(want) ? want : ok.sort((a, b) => Math.hypot(a.at.x - want.at.x, a.at.z - want.at.z) - Math.hypot(b.at.x - want.at.x, b.at.z - want.at.z))[0]; }
    const g = this.m.mode.goals ? this.m.mode.goals(this.team) : null, goal = g && (g.attack || g.hold), seen = this.m.vision.contacts(this.team);
    const score = (l) => (goal ? Math.hypot(l.at.x - goal.x, l.at.z - goal.z) : 0) + 0.2 * l.len - (this.held(l) ? 40 : 0)
      + 90 * seen.filter(u => !u.spec.structure && !(u.spec.air && u.alt > 2) && Math.hypot(u.pos.x - l.at.x, u.pos.z - l.at.z) < 140).length;
    return ok.sort((a, b) => score(a) - score(b))[0];
  }
  // fill a docked craft from the dock, first come first aboard (a squad's men together); vehicles only for a beach that takes them
  load(c) {
    const P = RULES.landing.places, D = this.dock.passengers; if (!D.length) return 0;
    const lane = this.choose(!D.some(u => u.type === 'soldier'));
    let room = RULES.landing.room - c.passengers.reduce((s, u) => s + (P[u.type] || 1), 0), n = 0;
    for (const u of [...D]) {
      const need = P[u.type] || 1; if (need > room || (u.type !== 'soldier' && !lane.vehicles)) continue;
      D.splice(D.indexOf(u), 1); u.mounted = c; c.passengers.push(u); room -= need; n++;
    }
    if (n) c.lane = lane;
    return n;
  }

  // ---- the logic, at the match's tick: loading and sailing, the beach, sunk craft replaced
  tick(dt) {
    this.clock += dt;
    for (let i = this.rebuilds.length - 1; i >= 0; i--) if ((this.rebuilds[i].t -= dt) <= 0) { this.launch(this.rebuilds[i].slotI); this.rebuilds.splice(i, 1); }
    for (const c of this.craft) {
      if (c.dead) continue;
      if (c.state === 'dock') {
        if (this.load(c)) c.wait = c.wait || 3;   // gather for a few seconds once loading starts, so a wave goes out together
        if (c.passengers.length && ((c.wait -= dt) <= 0 || this.full(c))) this.sail(c, this.berth(c), 'out');
      } else if (c.state === 'beach' && (c.wait -= dt) <= 0) {
        this.pickUp(c);
        this.sail(c, this.berth(c).reverse().concat([this.slot(c.slotI)]), 'back');
      }
    }
  }
  full(c) { const P = RULES.landing.places; return RULES.landing.room - c.passengers.reduce((s, u) => s + (P[u.type] || 1), 0) < 1; }
  sail(c, route, state) { c.route = route; c.k = 0; c.state = state; c.wait = 0; c.slow = 0; }
  // the lane with its last point moved along the beach by the craft's slot, 14 m apart, so craft beach side by side
  berth(c) { const P = c.lane.path, [ax, az] = P[P.length - 2], [bx, bz] = P[P.length - 1], d = Math.hypot(bx - ax, bz - az) || 1, o = (c.slotI - 1) * 14; return [...P.slice(0, -1), [bx + (bz - az) / d * o, bz - (bx - ax) / d * o]]; }

  // ---- the motion, every frame: steer for the next point of the lane, slow to a stop at its end; a sunk craft settles
  move(dt) {
    const water = this.m.world.terrain.water, S = RULES.landing.speed;
    for (let i = this.craft.length - 1; i >= 0; i--) {
      const c = this.craft[i];
      if (c.dead) {
        c.pos.y = water - (c.sinkT += dt) * 0.35; if (c.sinkT > 14) { c.remove = true; this.craft.splice(i, 1); this.rebuilds.push({ slotI: c.slotI, t: RULES.landing.rebuild }); }
        continue;
      }
      if (c.route) {
        const last = c.k === c.route.length - 1, [tx, tz] = c.route[c.k], dx = tx - c.pos.x, dz = tz - c.pos.z, d = Math.hypot(dx, dz);
        if (!last && d < 9) c.k++;
        else if (last && (d < 2.5 || (d < 10 && (c.slow += dt) > 4))) { c.speed = 0; c.route = null; this.arrive(c); }   // there, or nosing about close by for 4 s
        else {
          const diff = wrap(Math.atan2(dx, dz) - c.heading), spec = c.spec;
          c.heading += clamp(diff, -spec.turn * dt, spec.turn * dt);
          const want = (last ? Math.min(S, Math.max(1.5, d * 0.45)) : S) * clamp(1.2 - Math.abs(diff), 0.15, 1);
          c.speed += clamp(want - c.speed, -spec.accel * 1.5 * dt, spec.accel * dt);
          c.pos.x += Math.sin(c.heading) * c.speed * dt; c.pos.z += Math.cos(c.heading) * c.speed * dt;
        }
      }
      c.pos.y = water - 0.15 + Math.sin(this.clock * 1.4 + c.slotI * 2) * 0.12;
      c.group.rotation.y = c.heading; c.group.rotation.z = Math.sin(this.clock * 1.1 + c.slotI) * 0.02;
    }
  }
  arrive(c) {
    if (c.state === 'out') { this.last = c.lane; this.unload(c); c.state = 'beach'; c.wait = RULES.landing.beach; return; }
    c.state = 'dock';
    for (const t of c.passengers) { t.supplies = RULES.fob.truckSupplies; t.mounted = this.dock; this.dock.passengers.push(t); }   // refilled aboard the ship
    c.passengers = [];
  }
  // down the ramp: men in rows just past the bow, vehicles further up; each on the nearest open ground, then up the beach to
  // their squad if it is ashore, else to the beach's muster point (a supply truck stays put for its driver or its trip)
  unload(c) {
    const W = this.m.world, h = c.heading, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h), bx = c.pos.x + fx * 11, bz = c.pos.z + fz * 11, at = c.lane.at;
    let si = 0, vi = 0;
    for (const u of c.passengers) {
      const veh = u.type !== 'soldier', nav = this.m.nav[veh ? 'vehicle' : 'foot'];
      let x, z;
      if (veh) { x = bx + fx * (9 + vi * 10); z = bz + fz * (9 + vi * 10); vi++; }
      else { const row = Math.floor(si / 4), col = (si % 4) - 1.5; x = bx + fx * (3 + row * 1.6) + rx * col * 1.6; z = bz + fz * (3 + row * 1.6) + rz * col * 1.6; si++; }
      const cell = nav.nearest(nav.cellOf(x), nav.cellOf(z), 14); if (cell) { x = nav.world(cell[0]); z = nav.world(cell[1]); }
      u.afloat = false; u.mounted = null; u.group.visible = true; u.pos.set(x, W.heightAt(x, z), z); u.heading = h; u.group.rotation.y = h;
      if (u.supply) continue;
      const mate = u.squad && u.squad.members.find(o => o !== u && !o.dead && !o.afloat);
      if (mate) u.order(mate.pos.x + (Math.random() - 0.5) * 3, mate.pos.z + (Math.random() - 0.5) * 3);
      else u.order(at.x + (Math.random() - 0.5) * 14, at.z + (Math.random() - 0.5) * 14);
    }
    c.passengers = [];
  }
  // before leaving the beach: supply trucks waiting there to refill, with no held dump to do it, ride back to the ship
  pickUp(c) {
    if (this.held(c.lane)) return;
    const P = RULES.landing.places, at = c.lane.at; let room = RULES.landing.room;
    for (const t of this.units.units) {
      if (!t.supply || t.team !== this.team || t.dead || t.afloat || !t.refilling || t.supplies >= RULES.sandbags.supplyCost * 2 || Math.abs(t.speed) > 0.5 || Math.hypot(t.pos.x - at.x, t.pos.z - at.z) > 45 || P.truck > room) continue;
      t.afloat = true; t.mounted = c; c.passengers.push(t); t.group.visible = false; t.dest = null; t.path = null; t.target = null; room -= P.truck;
    }
  }
  // what the player sees of it: craft at sea and in the dock, men and vehicles waiting
  status() {
    const D = this.dock.passengers;
    return { waiting: D.filter(u => u.type === 'soldier').length, vehicles: D.filter(u => u.type !== 'soldier').length, out: this.craft.filter(c => !c.dead && c.state !== 'dock').length, craft: this.craft.filter(c => !c.dead).length };
  }
}
