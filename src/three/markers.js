import * as THREE from 'three';
import { geometry } from './geometry.js';

// Expanding ring shown where a move order lands.
export class Markers {
  constructor(scene) { this.scene = scene; this.list = []; this.geo = geometry('ring:0.6,0.9,12'); }
  add(x, z) {
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0x7fd1a8, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); this.scene.add(m); this.list.push({ m, t: 0 });
  }
  update(dt) {
    for (const mk of this.list) { mk.t += dt; mk.m.scale.setScalar(1 + mk.t * 1.5); mk.m.material.opacity = Math.max(0, 1 - mk.t); }
    this.list = this.list.filter(mk => { if (mk.t > 1) { this.scene.remove(mk.m); return false; } return true; });
  }
}
