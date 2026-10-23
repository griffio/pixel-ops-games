import { Vec3, Mat4 } from '../core/math.js';

// Tiny scene graph with the same surface the simulation code uses on three.js
// objects: position / rotation (Euler XYZ) / scale, add/remove, visible.
export class Node {
  constructor() {
    this.position = new Vec3(); this.rotation = new Vec3(); this.scale = new Vec3(1, 1, 1);
    this.children = []; this.parent = null; this.visible = true;
    this.local = Mat4.create(); this.world = Mat4.create();
  }
  add(...nodes) { for (const n of nodes) { if (n.parent) n.parent.remove(n); n.parent = this; this.children.push(n); } return this; }
  remove(n) { const i = this.children.indexOf(n); if (i >= 0) { this.children.splice(i, 1); n.parent = null; } return this; }
}

// geo: geometry key ('box:w,h,d', 'cyl:rt,rb,h,seg', 'ring:in,out,seg', 'plane:w,h')
// mat: { color:[r,g,b,a] (linear), tex: name|null, emissive:[r,g,b], emissiveI?, unlit, cast, blend }
export class Mesh extends Node {
  constructor(geo, mat) { super(); this.geo = geo; this.mat = mat; }
}

export class Scene extends Node {}
