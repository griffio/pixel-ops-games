// The wounded (first aid by a squadmate, a medic's treatment, bleeding out); engineers repair
// nearby vehicles; main base refills supply trucks and repairs landed helicopters. Ticks at the match rate.
import { RULES } from './rules.js';
import { WEAPONS } from './weapons.js';

export class Support {
  constructor(units, respawn, teams) { this.units = units; this.respawn = respawn; this.teams = teams; this.match = null; }
  landing(t) { const L = this.match && this.match.landing; return L && L.team === t.team ? L : null; }
  atRefill(t) { const L = this.landing(t), b = this.teams[t.team].base; return L ? L.dumpAt(t.pos.x, t.pos.z) || (t.amphib && L.atPen(t.pos.x, t.pos.z)) : Math.hypot(t.pos.x - b.x, t.pos.z - b.z) < b.r; }   // an amphibious carrier also fills up alongside the ship   // inside main base, or a held beach's dump
  // A refill trip: the truck drives home, fills up, and drives back to where it was (or stays, if it set out from base). The
  // Refill order starts one; a player's truck starts one on its own (trips) when it has less than the cheapest job costs.
  startRefill(t) {
    const L = this.landing(t), b = L ? L.refillPoint(t.pos.x, t.pos.z, t.amphib) : this.teams[t.team].base, home = [b.x + (Math.random() - 0.5) * 16, b.z + (Math.random() - 0.5) * 16];   // a side on a ship: a held beach's dump, or the beach its craft use
    t.refillBack = Math.hypot(t.pos.x - b.x, t.pos.z - b.z) < b.r ? null : [t.pos.x, t.pos.z];
    t.refilling = true; t.order(home[0], home[1]); t.refillHome = t.dest ? [t.dest.x, t.dest.z] : home;   // order() may move a goal out of a pocket
  }
  // Trips under way: a move order given on the way cancels one; full, the truck sets off back. A player's truck (not a CPU
  // side's: its strategist sends its own home) with less than sandbags cost, standing idle outside base and feeding no build,
  // sets off on its own.
  trips() {
    const M = this.match, full = RULES.fob.truckSupplies;
    for (const t of this.units.units) {
      if (!t.supply || t.dead || t.afloat) continue;   // one riding a landing craft back to its ship keeps its trip
      if (t.refillHome) {
        if (t.dest && Math.hypot(t.dest.x - t.refillHome[0], t.dest.z - t.refillHome[1]) > 2) { t.refilling = false; t.refillHome = t.refillBack = null; continue; }
        if (t.supplies >= full) { const back = t.refillBack; t.refilling = false; t.refillHome = t.refillBack = null; if (back) t.order(back[0], back[1]); }
        continue;
      }
      if (!M || M.cpu.includes(t.team) || t.noRefill || t.supplies >= RULES.sandbags.supplyCost || t.dest || Math.abs(t.speed) > 0.3) continue;
      if (this.atRefill(t)) continue;
      if (M.fobs && M.fobs.builds.some(x => x.truck === t)) continue;
      this.startRefill(t);
    }
  }
  tick(dt) {
    const all = this.units.units;
    // supply trucks refill inside their own main base
    for (const t of all) if (t.supply && !t.dead && !t.afloat && !t.noRefill && t.supplies < RULES.fob.truckSupplies) { if (this.atRefill(t)) t.supplies = Math.min(RULES.fob.truckSupplies, t.supplies + RULES.fob.resupplyRate * dt); }
    this.trips();
    // a helicopter landed in its own main base is patched up by the ground crew (full in a minute)
    // (the Little Bird never lands: hovering over the base counts, and its rocket pod is refilled too, full in half a minute)
    for (const h of all) {
      if (!h.spec.air || h.dead) continue; const b = this.teams[h.team].base; if (Math.hypot(h.pos.x - b.x, h.pos.z - b.z) >= b.r) continue;
      if (!(h.state === 'parked' || (h.spec.noLand && h.hover && !h.dest))) continue;
      if (h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.maxHp / 60 * dt);
      if (h.spec.ammo && h.ammo < h.spec.ammo) h.ammo = Math.min(h.spec.ammo, h.ammo + h.spec.ammo / 30 * dt);
    }
    // a ground vehicle with a belt (the Humvee) refills it parked in its own main base, full in half a minute; in the field a
    // supply truck stopped beside it swaps the belt for 10 supplies once it is half spent
    for (const v of all) {
      if (v.spec.air || v.dead || !v.spec.ammo || v.ammo >= v.spec.ammo || v.dest || Math.abs(v.speed) > 0.3) continue;
      const b = this.teams[v.team].base;
      if (Math.hypot(v.pos.x - b.x, v.pos.z - b.z) < b.r) { v.ammo = Math.min(v.spec.ammo, v.ammo + v.spec.ammo / 30 * dt); continue; }
      if (v.ammo > v.spec.ammo / 2) continue;
      const t = all.find(t => t.supply && !t.dead && t.team === v.team && t.supplies >= RULES.rearm.supplyCost && !t.dest && Math.abs(t.speed) < 0.3 && Math.hypot(t.pos.x - v.pos.x, t.pos.z - v.pos.z) < RULES.rearm.range);
      if (t) { t.supplies -= RULES.rearm.supplyCost; v.ammo = v.spec.ammo; if (this.onRearm) this.onRearm(v, t); }
    }
    // magazines (RULES.ammo, Unit.loadAmmo): a squad fills up standing still in its own main base, beside a stopped supply truck
    // or the Hold's dump for a few supplies a squad once it is down to half, or slowly within reach of one of its FOBs
    const AM = RULES.ammo, fobs = all.filter(f => f.type === 'fob' && !f.dead), holders = all.filter(t => t.supply && !t.dead && t.supplies >= AM.supplyCost && !t.dest && Math.abs(t.speed) < 0.3);
    for (const sq of this.units.squads) {
      const men = sq.members.filter(m => m.fit && !m.mounted && !m.afloat && m.ammoFrac < 1); if (!men.length) continue;
      const b = this.teams[sq.team].base;
      for (const m of men) if (!m.dest && Math.abs(m.speed) < 0.3 && Math.hypot(m.pos.x - b.x, m.pos.z - b.z) < b.r) m.loadAmmo();
      const out = men.filter(m => m.ammoFrac < 1); if (!out.length) continue;
      if (out.reduce((s, m) => s + m.ammoFrac, 0) / out.length <= 0.5) {
        const t = holders.find(t => t.team === sq.team && out.some(m => Math.hypot(t.pos.x - m.pos.x, t.pos.z - m.pos.z) < RULES.rearm.range));
        if (t) { t.supplies -= AM.supplyCost; for (const m of out) if (Math.hypot(t.pos.x - m.pos.x, t.pos.z - m.pos.z) < RULES.rearm.range) m.loadAmmo(); continue; }
      }
      for (const m of out) if (!m.dest && fobs.some(f => f.team === sq.team && Math.hypot(f.pos.x - m.pos.x, f.pos.z - m.pos.z) < AM.fobRange)) { m.fobAmmoT = (m.fobAmmoT || 0) + dt; if (m.fobAmmoT >= AM.fobEvery) { m.fobAmmoT = 0; const w = WEAPONS[m.kit]; m.mags = Math.min(w.mags, m.mags + 1); if (m.rounds <= 0) { m.rounds = w.mag; m.mags = Math.max(0, m.mags - 1); } } }
    }
    // riflemen get their grenades back standing still in their own main base, or beside a stopped supply truck in the field
    // for a few supplies a squad (RULES.grenades)
    const GR = RULES.grenades, trucks = all.filter(t => t.supply && !t.dead && t.supplies >= GR.supplyCost && !t.dest && Math.abs(t.speed) < 0.3);   // once a tick, not once a squad
    for (const sq of this.units.squads) {
      const men = sq.members.filter(m => !m.dead && !m.mounted && m.kit === 'rifle' && m.grenades < GR.count); if (!men.length) continue;
      const b = this.teams[sq.team].base, home = men.filter(m => !m.dest && Math.abs(m.speed) < 0.3 && Math.hypot(m.pos.x - b.x, m.pos.z - b.z) < b.r);
      for (const m of home) m.grenades = GR.count;
      const out = men.filter(m => !home.includes(m)); if (!out.length || !trucks.length) continue;
      const t = trucks.find(t => t.team === sq.team && out.some(m => Math.hypot(t.pos.x - m.pos.x, t.pos.z - m.pos.z) < RULES.rearm.range));
      if (t) { t.supplies -= GR.supplyCost; for (const m of out) if (Math.hypot(t.pos.x - m.pos.x, t.pos.z - m.pos.z) < RULES.rearm.range) m.grenades = GR.count; }
    }
    // the wounded (Unit.wound, RULES.wounds): a man down bleeds out unless someone sees to him. A fit squadmate within aidRange,
    // with no fit man of the squad under fire (suppressed above 0.3 or engaging), gives first aid over `aid` s: the squad standing
    // by him, which is what holding the ground after a fight buys; under fire the aid given so far is kept, so a squad that fights
    // on and then settles finishes it. A medic (below) does it in `treat` s from further off.
    const WD = RULES.wounds, C = this.match && this.match.combat;
    for (const u of all) {
      if (!u.down || u.dead) continue;
      u.bleed -= dt;
      if (u.bleed <= 0) { u.bledOut = true; u.die(u.wounder); if (C && C.onDeath) C.onDeath(u, u.wounder); continue; }
      if (u.treatedBy && !u.treatedBy.dead && !u.treatedBy.down) continue;   // a medic is on him
      u.treatedBy = null; const sq = u.squad; if (!sq) continue;
      const fit = sq.members.filter(m => m.fit && !m.mounted && !m.afloat);
      if (!fit.length || fit.some(m => m.supp > WD.aidSupp || (m.enemy && !m.enemy.dead && Math.hypot(m.enemy.pos.x - m.pos.x, m.enemy.pos.z - m.pos.z) < WD.aidEnemy))) continue;   // heads down, or the enemy on top of them: nobody can see to him
      if (!fit.some(m => Math.hypot(m.pos.x - u.pos.x, m.pos.z - u.pos.z) < WD.aidRange)) continue;
      if ((u.aidT += dt) >= WD.aid) { u.recover(); if (this.onRecovered) this.onRecovered(u, null); }
    }
    for (const u of all) {
      if (u.dead || u.down || u.mounted || (u.kit !== 'medic' && u.kit !== 'engineer')) continue;
      if (u.kit === 'medic') {
        // the nearest wounded man of his side within reach that no other medic is on: walk to him, kneel by him `treat` s
        let best = null, bd = WD.treatRange;
        for (const b of all) {
          if (!b.down || b.dead || b.team !== u.team || (b.treatedBy && b.treatedBy !== u && !b.treatedBy.dead && !b.treatedBy.down)) continue;
          const d = Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z); if (d < bd) { bd = d; best = b; }
        }
        if (u.medicTarget && u.medicTarget !== best && u.medicTarget.treatedBy === u) u.medicTarget.treatedBy = null;
        if (!best) { if (u.medicTarget) { u.medicTarget = null; u.target = null; u.dest = null; u.hold = false; } continue; }
        best.treatedBy = u;
        if (bd > 2.5) { if (u.medicTarget !== best || !u.dest) { u.medicTarget = best; u.order(best.pos.x, best.pos.z); } continue; }
        u.medicTarget = best; u.hold = true; best.treatT = (best.treatT || 0) + dt;
        if (best.treatT >= WD.treat) { best.recover(); u.medicTarget = null; u.hold = false; if (this.onRecovered) this.onRecovered(best, u); }
      } else if (u.speed < 0.2) {
        for (const v of all) {
          if (v.dead || v.team !== u.team || v.type === 'soldier' || v.hp >= v.maxHp) continue;
          if (Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) < 6) v.hp = Math.min(v.maxHp, v.hp + 6 * dt);
        }
      }
    }
  }
}
