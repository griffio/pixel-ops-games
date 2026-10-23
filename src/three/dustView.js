import * as THREE from 'three';

// Draws the shared DustSim arrays as one Points draw call. Point size is given
// in world units and converted to buffer texels so puffs stay chunky at any zoom.
export class DustView {
  constructor(scene, sim, pixel) {
    this.sim = sim; this.pixel = pixel;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sim.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aLife', new THREE.BufferAttribute(sim.life, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(sim.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tpu: { value: 10 }, color: { value: new THREE.Color(0xb3a386) } },
      vertexShader: `attribute float aLife; attribute float aSize; varying float vA; uniform float tpu;
        void main(){ vA = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.0, aSize * (1.6 - aLife) * tpu); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 color; varying float vA; void main(){ if (vA <= 0.0) discard; gl_FragColor = vec4(color, vA * 0.55);
        #include <colorspace_fragment> }`,
      transparent: true, depthWrite: false,
    });
    const points = new THREE.Points(g, this.mat); points.frustumCulled = false; points.renderOrder = 5;
    scene.add(points); g.setDrawRange(0, 0);
  }
  update() {
    const p = this.pixel;
    this.mat.uniforms.tpu.value = p.enabled ? p.texelsPerUnit : p.texelsPerUnit * p.pixelScale * p.dpr;
    this.geo.attributes.position.needsUpdate = this.geo.attributes.aLife.needsUpdate = this.geo.attributes.aSize.needsUpdate = true;
    this.geo.setDrawRange(0, this.sim.n);
  }
}
