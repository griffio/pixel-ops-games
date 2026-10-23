// Medics revive fallen squadmates inside the revive window; engineers repair
// nearby vehicles. Ticks at the match rate.
import { RULES } from './rules.js';
export const REVIVE_WINDOW = 12, REVIVE_TIME = 3, REVIVE_RANGE = 14;

export class Support {
  constructor(units, respawn, teams) { this.units = units; this.respawn = respawn; this.teams = teams; }
  tick(dt) {
    const all = this.units.units;
    // supply trucks refill inside their own main base
    for (const t of all) if (t.supply && !t.dead && t.supplies < RULES.fob.truckSupplies) { const b = this.teams[t.team].base; if (Math.hypot(t.pos.x - b.x, t.pos.z - b.z) < b.r) t.supplies = Math.min(RULES.fob.truckSupplies, t.supplies + RULES.fob.resupplyRate * dt); }
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
