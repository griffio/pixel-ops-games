import * as THREE from 'three';
import { WorldState, WORLD_SIZE } from '../core/layout.js';
import { groundCanvas } from '../core/textures.js';

// three.js view of the shared world layout + lighting state.
export class World extends WorldState {
  constructor(scene) {
    super(); this.scene = scene; this.lamps = [];
    this.buildGround(); this.buildProps(); this.buildLights(); this.applyLighting();
  }

  buildGround() {
    const tex = new THREE.CanvasTexture(groundCanvas());
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE), new THREE.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true; this.scene.add(m);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE * 4, WORLD_SIZE * 4), new THREE.MeshLambertMaterial({ color: 0x6b6557 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; outer.receiveShadow = true; this.scene.add(outer);
  }

  buildProps() {
    const geos = new Map(), mats = new Map();
    const geo = (key) => {
      if (!geos.has(key)) {
        const [type, args] = key.split(':'); const a = args.split(',').map(Number);
        geos.set(key, type === 'box' ? new THREE.BoxGeometry(a[0], a[1], a[2]) : new THREE.CylinderGeometry(a[0], a[1], a[2], a[3]));
      }
      return geos.get(key);
    };
    const heads = [];
    for (const p of this.layout.props) {
      let mat;
      if (p.emissive !== undefined) mat = new THREE.MeshLambertMaterial({ color: p.color, emissive: p.emissive, emissiveIntensity: 0 });
      else { if (!mats.has(p.color)) mats.set(p.color, new THREE.MeshLambertMaterial({ color: p.color })); mat = mats.get(p.color); }
      const m = new THREE.Mesh(geo(p.geo), mat);
      m.position.set(p.x, p.y, p.z); m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      m.castShadow = p.cast; m.receiveShadow = true; this.scene.add(m);
      if (p.lampHead) heads.push(m);
    }
    this.layout.lamps.forEach((l, i) => {
      const light = new THREE.PointLight(l.color, 0, l.distance, 2); light.position.set(l.x, l.y, l.z); this.scene.add(light);
      this.lamps.push({ light, head: heads[i] });
    });
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1); this.sun.castShadow = true;
    const s = this.sun.shadow; s.mapSize.set(4096, 4096);
    const c = s.camera; c.left = -125; c.right = 125; c.top = 125; c.bottom = -125; c.near = 1; c.far = 400;
    s.bias = -0.0006; s.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);
    this.scene.background = new THREE.Color();
  }

  update(dt) { super.update(dt); this.applyLighting(); }

  applyLighting() {
    const L = this.light;
    this.sun.position.set(L.sunDir[0] * 200, L.sunDir[1] * 200, L.sunDir[2] * 200);
    this.sun.color.setRGB(...L.sunColor); this.sun.intensity = L.sunI;
    this.hemi.intensity = L.hemiI; this.hemi.color.setRGB(...L.hemiSky); this.hemi.groundColor.setRGB(...L.hemiGround);
    this.scene.background.setRGB(...L.background);
    for (const l of this.lamps) { l.light.intensity = L.lampI; l.head.material.emissiveIntensity = L.lampEmissive; }
  }
}
