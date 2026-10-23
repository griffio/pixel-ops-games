import { hexToLinear } from '../core/math.js';
import { Mesh } from './scene.js';

const GREEN = hexToLinear(0x7fd1a8);
export class Markers {
  constructor(scene, heightAt = () => 0) { this.scene = scene; this.list = []; this.heightAt = heightAt; }
  add(x, z) {
    const m = new Mesh('ring:0.6,0.9,12', { color: [...GREEN, 1], tex: null, emissive: [0, 0, 0], unlit: true, cast: false });
    m.rotation.x = -Math.PI / 2; m.position.set(x, this.heightAt(x, z) + 0.08, z); this.scene.add(m); this.list.push({ m, t: 0 });
  }
  update(dt) {
    for (const mk of this.list) { mk.t += dt; mk.m.scale.setScalar(1 + mk.t * 1.5); mk.m.mat.color[3] = Math.max(0, 1 - mk.t); }
    this.list = this.list.filter(mk => { if (mk.t > 1) { this.scene.remove(mk.m); return false; } return true; });
  }
}
