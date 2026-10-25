// Radio chatter for the player's side (ElevenLabs voices, sounds/vo_*): squad callouts from Adam (moving, contact,
// taking fire, man down or medic, enemy armour, rally down, digging in, reloading, target down) and HQ reports from
// Brian (objective secured or lost, FOB up, under attack or lost, rally overrun, armour sighted, tickets low,
// reinforcements, the result). It watches the match and calls AudioEngine.voice(); each line has a cooldown (match
// time) and squad chatter keeps a 10 s gap, so the radio stays at a few lines a minute and never talks over itself.
const ARMOUR = new Set(['apc', 'tank']);

export class VoiceDirector {
  constructor(match, audio, team) {
    this.m = match; this.audio = audio; this.team = team;
    this.next = {}; this.chatterAt = 0; this.acc = 0;
    this.seen = new Set(); this.fobHp = new Map(); this.vehicles = null; this.ticketsWarned = false;
  }

  // a line by manifest name; group shares a cooldown between lines, hq lines queue behind the one playing
  say(key, cool = 8, { hq = false, group = key, delay = 0 } = {}) {
    const now = this.m.elapsed;
    if ((this.next[group] || 0) > now || (!hq && now < this.chatterAt)) return false;
    if (!this.audio.voice(key, hq, delay)) return false;
    this.next[group] = now + cool; if (!hq) this.chatterAt = now + 10;   // a gap after any squad line
    return true;
  }

  tick(dt) {
    if ((this.acc += dt) < 0.5) return; this.acc = 0;
    const T = this.team, U = this.m.units.units, now = this.m.elapsed;
    const mine = U.filter(u => u.team === T && !u.dead && !u.mounted && !u.spec.structure);
    const armour = U.filter(u => u.team !== T && !u.dead && ARMOUR.has(u.type));
    for (const sq of this.m.units.squads) {
      if (sq.team !== T || !sq.alive) continue;
      const alive = sq.members.filter(m => !m.dead && !m.mounted); if (!alive.length) continue;
      const engaged = alive.some(m => m.enemy && !m.enemy.dead);
      if (engaged && !sq.vEngaged) this.say('vo_sq_contact', 45);
      sq.vEngaged = engaged;
      if (alive.reduce((s, m) => s + m.supp, 0) / alive.length > 0.55) this.say('vo_sq_fire', 50);
      const c = sq.centroid();
      const close = armour.find(a => Math.hypot(a.pos.x - c.x, a.pos.z - c.z) < 70 && !(sq.vArmour || (sq.vArmour = new Set())).has(a));   // each vehicle once per squad
      if (close && this.say('vo_sq_armour', 20)) sq.vArmour.add(close);
    }
    for (const a of armour) {   // HQ calls each enemy vehicle the first time it comes within 200 m of our forces
      if (this.seen.has(a) || !mine.some(u => Math.hypot(u.pos.x - a.pos.x, u.pos.z - a.pos.z) < 200)) continue;
      this.seen.add(a); this.say('vo_hq_armour', 45, { hq: true });
    }
    for (const f of U) if (f.type === 'fob' && f.team === T && !f.dead) {
      const last = this.fobHp.get(f); if (last !== undefined && f.hp < last) this.say('vo_hq_fob_attack', 45, { hq: true });
      this.fobHp.set(f, f.hp);
    }
    if (!this.ticketsWarned && this.m.teams[T].tickets <= 100) { this.ticketsWarned = true; this.say('vo_hq_tickets', 1e9, { hq: true }); }
    const veh = new Set(U.filter(u => u.team === T && !u.dead && !u.spec.structure && u.type !== 'soldier'));
    if (this.vehicles && now > 5 && [...veh].some(v => !this.vehicles.has(v))) this.say('vo_hq_reinforce', 60, { hq: true });   // a vehicle back from its respawn timer
    this.vehicles = veh;
  }

  onDeath(v, k) {
    const T = this.team;
    if (v.team === T && v.type === 'soldier') {
      const medic = v.squad && v.squad.members.some(m => m !== v && !m.dead && m.kit === 'medic');
      this.say(medic ? 'vo_sq_medic' : 'vo_sq_mandown', 30, { group: 'casualty' });
    } else if (v.team === T && v.type === 'fob') this.say('vo_hq_fob_lost', 5, { hq: true });
    else if (k && k.team === T && v.team !== T && v.type !== 'soldier' && !v.spec.structure) this.say('vo_sq_kill', 20);
  }
  onEvent(e) {
    if (e.team !== this.team) return;
    const line = { captured: 'vo_hq_captured', lost: 'vo_hq_lost', fob: 'vo_hq_fob', 'rally lost': 'vo_hq_rally_lost' }[e.type];
    if (line) this.say(line, e.type === 'rally lost' ? 45 : 4, { hq: true, delay: 0.7 });   // after the chime
  }
  onShot(u) { if (u.team === this.team && u.kit === 'at' && Math.random() < 0.35) this.say('vo_sq_reload', 75); }
  ordered(units) { if (units.some(u => u.type === 'soldier' && u.team === this.team)) this.say('vo_sq_moving', 6); }
  end(won) { this.say(won ? 'vo_hq_win' : 'vo_hq_lose', 0, { hq: true, delay: 1.6 }); }
}
