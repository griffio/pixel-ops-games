// Buildings that stray rounds can knock down. A building is a group of touching obstacles the map kit tagged `bld` (houses,
// cottages, sheds, huts, garages, blocks of flats, barracks and hangars: a turned house is rows of them, a block has wings)
// with the props standing on them; landmarks, bridges, walls and the dam carry no tag and stand whatever hits them. A shell, rocket or mortar bomb into a wall or roof damages it
// (a bullet only chips it); enough of them bring it down: its props go, a heap of rubble stands in the footprint as low cover,
// the ground is scorched, and the nav grids and the line-of-sight grid learn the change. match.js makes one per match and
// combat.js reports the hits (a round in flight stops at the first tall box it meets, core/projectiles.js).
const CELL = 16;
export class Buildings {
  constructor(match) {
    this.m = match; this.world = match.world; this.list = []; this.cells = new Map(); this.down = 0;
    const O = this.world.obstacles, area = (o) => (o.maxX - o.minX) * (o.maxZ - o.minZ), hOf = (o) => (o.h === undefined ? 2 : o.h);
    const tall = O.filter(o => o.bld);
    // touching tall boxes make one building, found through a coarse grid so a city's thousands of rows stay cheap
    const grid = new Map(), key = (x, z) => Math.floor(x / 8) + ',' + Math.floor(z / 8), parent = tall.map((_, i) => i);
    const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
    tall.forEach((o, i) => { for (let x = Math.floor(o.minX / 8) * 8; x <= o.maxX; x += 8) for (let z = Math.floor(o.minZ / 8) * 8; z <= o.maxZ; z += 8) { const k = key(x, z); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); } });
    for (const a of grid.values()) for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      const p = tall[a[i]], q = tall[a[j]];
      if (p.minX <= q.maxX + 0.3 && q.minX <= p.maxX + 0.3 && p.minZ <= q.maxZ + 0.3 && q.minZ <= p.maxZ + 0.3) parent[find(a[i])] = find(a[j]);
    }
    const groups = new Map();
    tall.forEach((o, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(o); });
    for (const boxes of groups.values()) {
      const b = { boxes, props: [], down: false, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, h: 0, vol: 0 };
      for (const o of boxes) { b.minX = Math.min(b.minX, o.minX); b.maxX = Math.max(b.maxX, o.maxX); b.minZ = Math.min(b.minZ, o.minZ); b.maxZ = Math.max(b.maxZ, o.maxZ); b.h = Math.max(b.h, hOf(o)); b.vol += area(o) * hOf(o); o.bld = b; }
      b.hp = b.hits = Math.max(3, Math.min(8, Math.ceil(b.vol / 450)));   // a cottage takes three shells, a block of flats eight
      this.list.push(b);
      for (let x = Math.floor(b.minX / CELL) * CELL; x <= b.maxX; x += CELL) for (let z = Math.floor(b.minZ / CELL) * CELL; z <= b.maxZ; z += CELL) { const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL); let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(b); }
    }
    // the props standing on a building: a part by its anchor (a house's parts share one), a plain box by where it stands
    for (const p of this.world.layout.props) {
      if (p.absY) continue;
      const b = p.ax !== undefined ? this.at(p.ax, p.az, 0.1) : this.at(p.x, p.z, 0.6);
      if (b) b.props.push(p);
    }
  }
  // the building with a box under (x, z), `slack` outside its edges
  at(x, z, slack = 0) {
    const a = this.cells.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (!a) return null;
    for (const b of a) if (!b.down && x >= b.minX - slack && x <= b.maxX + slack && z >= b.minZ - slack && z <= b.maxZ + slack)
      for (const o of b.boxes) if (x >= o.minX - slack && x <= o.maxX + slack && z >= o.minZ - slack && z <= o.maxZ + slack) return b;
    return null;
  }

  // a wall run the player built (game/fob.js, B3): a building of its own, its hit points the unit's (RULES.wall.hp), so the
  // guns the strategist points at it (combat: u.breach) and the strays that strike it wear the same thing down
  addWall(u, boxes) {
    const b = { boxes, props: [], down: false, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, h: 0, vol: 0, unit: u, color: 0x8e8c72 };
    for (const o of boxes) { b.minX = Math.min(b.minX, o.minX); b.maxX = Math.max(b.maxX, o.maxX); b.minZ = Math.min(b.minZ, o.minZ); b.maxZ = Math.max(b.maxZ, o.maxZ); b.h = Math.max(b.h, o.h); b.vol += (o.maxX - o.minX) * (o.maxZ - o.minZ) * o.h; o.bld = b; }
    b.hp = b.hits = 3; u.bld = b; this.list.push(b);
    for (let x = Math.floor(b.minX / CELL) * CELL; x <= b.maxX; x += CELL) for (let z = Math.floor(b.minZ / CELL) * CELL; z <= b.maxZ; z += CELL) { const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL); let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(b); }
    return b;
  }
  // a wall an engineer took down: out of the list without rubble (the match clears its boxes and grids)
  remove(b) { if (!b || b.down) return; b.down = true; const i = this.list.indexOf(b); if (i >= 0) this.list.splice(i, 1); }
  // `dmg` in hits (a cottage takes three): a built wall takes it on its unit's scale (a hit is a third of RULES.wall.hp) and comes
  // down through the match's death hook (match.js onDeath: breached), like a wall shot at on purpose
  wound(b, dmg, u) {
    if (b.down || !dmg) return;
    if (b.unit) { if (!b.unit.dead && b.unit.damage(dmg * b.unit.maxHp / 3, u)) this.m.combat.onDeath(b.unit, u); return; }
    if ((b.hp -= dmg) <= 0) this.collapse(b, u);
  }
  // a round into a wall or roof: what it does to the building
  hit(b, p, w, kit, u) {
    const dmg = !w.explosive ? 0 : w.splash || kit === 'tankgun' || w.rocket ? 1 : 0.34;   // bombs, tank shells and rockets wound it; an autocannon's rounds take three
    this.wound(b, dmg, u);
  }
  // a burst on the ground near a wall
  splash(x, z, r, u) {
    const b = this.at(x, z, r); if (b) this.wound(b, 0.6, u);
  }
  // a built wall's unit died (shot at on purpose, or worn down by strays): the run comes down
  breached(v, k) { const b = v.bld; if (b && !b.down) this.collapse(b, k); }
  // down it comes: props out, rubble in, the obstacles and grids updated, dust and a scorch, anyone stood in a heap steps out
  collapse(b, u) {
    b.down = true; this.down++; if (u && this.m.teams && this.m.teams[u.team] && this.m.teams[u.team].stats) this.m.teams[u.team].stats.buildings++;
    const W = this.world, m = this.m, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, O = W.obstacles;
    for (const o of b.boxes) { const i = O.indexOf(o); if (i >= 0) O.splice(i, 1); }
    const heaps = W.collapse(b);   // the props go and rubble stands in their place; back come the heaps as low obstacles
    for (const o of heaps) O.push(o);
    if (b.unit) { const v = b.unit; for (const s of m.units.units) if (s.post && s.post.sb === v) s.leavePost(); v.dead = true; v.remove = true; }   // a built wall: its model goes with it
    const pad = 3;
    for (const g of ['foot', 'vehicle', 'amphib']) if (m.nav[g]) m.nav[g].refresh(b.minX - pad, b.maxX + pad, b.minZ - pad, b.maxZ + pad);
    m.combat.rebuildGrids(); if (m.vision) m.vision.refresh();   // the fog grid too: what stood in the way of a look is gone
    for (const v of m.units.units) {   // anyone standing where a heap now is steps clear
      if (v.dead || v.spec.structure || !v.spec.nav || v.pos.x < b.minX - pad || v.pos.x > b.maxX + pad || v.pos.z < b.minZ - pad || v.pos.z > b.maxZ + pad) continue;
      const nav = m.nav[v.spec.nav]; if (!nav.blocked(v.pos.x, v.pos.z)) continue;
      const c = nav.nearest(nav.cellOf(v.pos.x), nav.cellOf(v.pos.z), 12); if (c) { v.pos.x = nav.world(c[0]); v.pos.z = nav.world(c[1]); }
    }
    const D = m.app && m.app.dust, gy = W.heightAt(cx, cz), r = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
    if (D) {
      D.explosion(cx, gy + Math.min(b.h, 6) * 0.4, cz, Math.min(1.6, 0.9 + b.vol / 2000));
      for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * r; D.impact(cx + Math.sin(a) * d, gy + 0.2, cz + Math.cos(a) * d); }
    }
    if (m.combat.audio) { m.combat.audio.blast(cx, cz, 1.6); if (b.unit) m.combat.audio.foley('rubble', cx, cz, 1.2); }   // a built wall's gabions sliding down
    m.event && m.event({ type: b.unit ? 'wall breached' : 'building', team: u ? u.team : -1, x: cx, z: cz });
  }
}
