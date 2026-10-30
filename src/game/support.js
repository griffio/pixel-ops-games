// Medics revive fallen squadmates inside the revive window; engineers repair
// nearby vehicles; main base refills supply trucks and repairs landed helicopters. Ticks at the match rate.
import { RULES } from './rules.js';
export const REVIVE_WINDOW = 12, REVIVE_TIME = 3, REVIVE_RANGE = 14;

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
      if (!M || M.cpu.includes(t.team) || t.supplies >= RULES.sandbags.supplyCost || t.dest || Math.abs(t.speed) > 0.3) continue;
      if (this.atRefill(t)) continue;
      if (M.fobs && M.fobs.builds.some(x => x.truck === t)) continue;
      this.startRefill(t);
    }
  }
  tick(dt) {
    const all = this.units.units;
    // supply trucks refill inside their own main base
    for (const t of all) if (t.supply && !t.dead && !t.afloat && t.supplies < RULES.fob.truckSupplies) { if (this.atRefill(t)) t.supplies = Math.min(RULES.fob.truckSupplies, t.supplies + RULES.fob.resupplyRate * dt); }
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
    for (const u of all) {
      if (u.dead || (u.kit !== 'medic' && u.kit !== 'engineer')) continue;
      if (u.kit === 'medic') {
        // nearest recent body of a friendly soldier
        let best = null, bd = REVIVE_RANGE;
        for (const b of all) {
          if (!b.dead || b.type !== 'soldier' || b.team !== u.team || b.deathT > REVIVE_WINDOW || b.spec.air) continue;
          const d = Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z); if (d < bd) { bd = d; best = b; }
        }
        if (!best) { if (u.medicTarget) { u.medicTarget = null; u.target = null; u.dest = null; } continue; }
        if (bd > 2.5) { if (u.medicTarget !== best || !u.dest) { u.medicTarget = best; u.order(best.pos.x, best.pos.z); } continue; }
        u.hold = true; best.reviveT = (best.reviveT || 0) + dt;
        if (best.reviveT >= REVIVE_TIME) {
          this.respawn.cancel(best);
          best.revive(best.pos.x, best.pos.z, u.heading); best.hp = Math.round(best.maxHp * 0.5); best.reviveT = 0;
          u.medicTarget = null; u.hold = false;
        }
      } else if (u.speed < 0.2) {
        for (const v of all) {
          if (v.dead || v.team !== u.team || v.type === 'soldier' || v.hp >= v.maxHp) continue;
          if (Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) < 6) v.hp = Math.min(v.maxHp, v.hp + 6 * dt);
        }
      }
    }
  }
}
