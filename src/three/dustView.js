import * as THREE from 'three';

// Draws the shared particle arrays as one Points draw call. Point size is given in
// world units and converted to buffer texels so sprites stay chunky at any zoom.
export class DustView {
  constructor(scene, sim, pixel) {
    this.sim = sim; this.pixel = pixel;
    const g = new THREE.BufferGeometry();
    const attr = (name, arr, n) => g.setAttribute(name, new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage));
    attr('position', sim.pos, 3); attr('aLife', sim.life, 1); attr('aSize', sim.size, 1); attr('aColor', sim.color, 3); attr('aParams', sim.params, 2);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tpu: { value: 10 } },
      vertexShader: `attribute float aLife; attribute float aSize; attribute vec3 aColor; attribute vec2 aParams; varying vec4 vC; uniform float tpu;
        void main(){ vC = vec4(aColor, aLife * aParams.y); vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.0, aSize * mix(1.0, 1.6 - aLife, aParams.x) * tpu); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ if (vC.a <= 0.0) discard; gl_FragColor = vC;
        #include <colorspace_fragment> }`,
      transparent: true, depthWrite: false,
    });
    const points = new THREE.Points(g, this.mat); points.frustumCulled = false; points.renderOrder = 5;
    scene.add(points); g.setDrawRange(0, 0);
  }
  update() {
    const p = this.pixel;
    this.mat.uniforms.tpu.value = p.enabled ? p.texelsPerUnit : p.texelsPerUnit * p.pixelScale * p.dpr;
    for (const a of Object.values(this.geo.attributes)) a.needsUpdate = true;
    this.geo.setDrawRange(0, this.sim.n);
  }
}
