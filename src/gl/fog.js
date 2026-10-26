import { hexToLinear } from '../core/math.js';
import { RULES } from '../game/rules.js';
import { Mesh } from './scene.js';

const ENEMY = hexToLinear(0xff8a7a);
// Fog of war as the player sees it (game/vision.js decides what each side sees): enemies the player's side cannot see are
// left out of the frame, and so out of the shadows and picking; ground and props outside the side's sight are darkened (the
// Fog shading setting, ?fogshade=0 to start without it); each enemy that dropped out of sight leaves a fading red diamond
// where it was last seen. Off while the CPU plays both sides (spectating) and once the match is over; ?fog=0 turns fog of
// war off for everyone (game/vision.js), ?fog=1 shows team 0's view even when spectating.
export class FogView {
  constructor(app) {
    const q = new URLSearchParams(location.search);
    this.app = app; this.param = q.get('fog'); this.shade = q.get('fogshade') !== '0';
    this.vals = null; this.fresh = true; this.marks = new Map(); this.overlay = null;
  }
  team() { return this.app.playerTeam ?? 0; }
  active() {
    const m = this.app.match; if (!m || !m.vision || !m.vision.on || m.state !== 'play') return false;
    return this.param === '1' || !m.cpu.includes(this.team());
  }
  // does the player see unit u? (everything, when the fog is off)
  sees(u) { return !this.on || this.app.match.vision.sees(this.team(), u); }

  update(dt) {
    const a = this.app, m = a.match, on = this.on = this.active(), me = this.team(), V = on ? m.vision : null;
    for (const u of a.units.units) u.group.hidden = on && !V.sees(me, u);
    // shading: each cell eases toward seen (255) or not (0) over about a quarter of a second
    if (on && this.shade) {
      const n = V.n, N = n * n, st = V.stamp[me], gen = V.gen, k = Math.max(1, Math.round(dt * 1000));
      if (!this.vals || this.vals.length !== N) { this.vals = new Uint8Array(N); this.fresh = true; }
      const v = this.vals;
      for (let i = 0; i < N; i++) { const t = st[i] === gen ? 255 : 0; v[i] = this.fresh ? t : v[i] < t ? Math.min(t, v[i] + k) : Math.max(t, v[i] - k); }
      this.fresh = false;
      a.renderer.setFog(v, n, V.cell, V.half);
    } else { a.renderer.setFog(null); this.fresh = true; }
    // last-known positions
    const G = on ? V.ghosts[me] : null;
    for (const [e, mk] of this.marks) if (!G || G.get(e) !== mk.g) { a.units.scene.remove(mk.mesh); this.marks.delete(e); }
    if (G) for (const [e, g] of G) {
      let mk = this.marks.get(e);
      if (!mk) {
        const big = g.type !== 'soldier', mesh = new Mesh(big ? 'ring:2.4,3.2,4' : 'ring:0.9,1.3,4', { color: [...ENEMY, 0.8], tex: null, emissive: [0, 0, 0], unlit: true, cast: false });
        mesh.rotation.x = -Math.PI / 2; mesh.position.set(g.x, a.world.heightAt(g.x, g.z) + 0.12, g.z); a.units.scene.add(mesh);
        this.marks.set(e, mk = { g, mesh });
      }
      mk.mesh.mat.color[3] = 0.8 * Math.max(0, 1 - (V.t - g.t) / RULES.vision.ghost);
    }
  }

  // the minimap's fog: a canvas over the whole grid, north up, clear where seen; null with the fog or its shading off
  minimap() {
    if (!this.on || !this.shade || !this.vals) return null;
    const n = this.app.match.vision.n;
    if (!this.overlay || this.overlay.width !== n) { this.overlay = document.createElement('canvas'); this.overlay.width = this.overlay.height = n; this.img = this.overlay.getContext('2d').createImageData(n, n); }
    const d = this.img.data, v = this.vals;
    for (let cz = 0; cz < n; cz++) for (let cx = 0; cx < n; cx++) { const o = ((n - 1 - cz) * n + cx) * 4; d[o] = 18; d[o + 1] = 16; d[o + 2] = 14; d[o + 3] = Math.round((255 - v[cz * n + cx]) * 0.5); }
    this.overlay.getContext('2d').putImageData(this.img, 0, 0);
    return this.overlay;
  }
  ghosts() { return this.on ? [...this.app.match.vision.ghosts[this.team()].values()] : []; }
}
