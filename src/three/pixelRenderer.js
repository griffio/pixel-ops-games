import * as THREE from 'three';

// Renders the scene into a small render target whose texel size is fixed in
// WORLD units (texelsPerUnit). Zooming changes how many screen pixels one texel
// covers (pixelScale), so zooming in makes the pixels chunkier - exactly the
// look of the reference screenshots. A composite pass upscales with nearest
// filtering and draws a 1-texel dark outline from depth discontinuities.
export class PixelRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.outline = true;
    this.texelsPerUnit = 10;   // world-space pixel density
    this.pixelScale = 3;       // screen px per texel (the zoom)
    this.dpr = 1;              // device pixel ratio, used only when pixelation is off
    this.rt = null;
    this.rtW = 0; this.rtH = 0;

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        texel: { value: new THREE.Vector2() },
        outline: { value: 1.0 },
        depthThresh: { value: 0.004 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel;
        uniform float outline; uniform float depthThresh; varying vec2 vUv;
        void main(){
          vec4 c = texture2D(tColor, vUv);
          if (outline > 0.5) {
            float d  = texture2D(tDepth, vUv).r;
            float dl = texture2D(tDepth, vUv - vec2(texel.x, 0.0)).r;
            float dr = texture2D(tDepth, vUv + vec2(texel.x, 0.0)).r;
            float du = texture2D(tDepth, vUv + vec2(0.0, texel.y)).r;
            float dd = texture2D(tDepth, vUv - vec2(0.0, texel.y)).r;
            // this texel is nearer than a neighbour -> it sits on a silhouette edge
            float e = max(max(dl - d, dr - d), max(du - d, dd - d));
            float k = step(depthThresh, e);
            c.rgb *= mix(1.0, 0.42, k);
          }
          gl_FragColor = c;
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }

  // Size of the low-res buffer for the current screen size and zoom.
  bufferSize(screenW, screenH) {
    if (!this.enabled) return [Math.round(screenW * this.dpr), Math.round(screenH * this.dpr)];
    const s = this.pixelScale;
    return [Math.max(32, Math.round(screenW / s)), Math.max(32, Math.round(screenH / s))];
  }

  // Visible world size depends only on zoom and texel density, never on whether pixelation is on,
  // so toggling it compares the two renderings at identical framing.
  viewSize(screenW, screenH) {
    return [screenW / this.pixelScale / this.texelsPerUnit, screenH / this.pixelScale / this.texelsPerUnit];
  }

  ensureTarget(w, h) {
    if (this.rt && this.rtW === w && this.rtH === h) return;
    if (this.rt) this.rt.dispose();
    const depth = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.rt = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthTexture: depth, depthBuffer: true, stencilBuffer: false,
    });
    this.rtW = w; this.rtH = h;
    this.mat.uniforms.tColor.value = this.rt.texture;
    this.mat.uniforms.tDepth.value = depth;
    this.mat.uniforms.texel.value.set(1 / w, 1 / h);
  }

  // Ortho-camera depth is linear, so a world-unit threshold maps to a constant.
  setDepthThreshold(camera, worldUnits) {
    this.mat.uniforms.depthThresh.value = worldUnits / (camera.far - camera.near);
  }

  render(scene, camera, screenW, screenH) {
    const r = this.renderer;
    const [w, h] = this.bufferSize(screenW, screenH);
    this.ensureTarget(w, h);
    this.mat.uniforms.outline.value = this.outline ? 1 : 0;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
  }
}
