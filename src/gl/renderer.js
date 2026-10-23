import { Mat4, Vec3, hexToLinear } from '../core/math.js';
import { buildGeometry } from '../core/geometry.js';
import * as S from './shaders.js';

const STRIDE = 24;            // floats per instance: mat4 (16) + colour (4) + emissive rgb + pick id (4)
const SHADOW_SIZE = 4096;
const LIGHT_UP = new Vec3(0, 1, 0), ORIGIN = new Vec3();
const DUST_COLOR = hexToLinear(0xb3a386);

// Raw WebGL2 renderer. Every mesh in the scene graph is an instance of a shared
// geometry; instances are grouped per (geometry, texture, flags) and drawn with
// drawElementsInstanced, so a scene of thousands of boxes costs a few dozen calls.
// Passes: shadow depth -> low-res lit colour+depth -> composite (nearest upscale,
// outline, sRGB). Picking renders ids into a small buffer on demand.
export class GLRenderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl; this.canvas = canvas;
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.shadows = true; this.stats = { calls: 0 };
    this.pixel = {
      enabled: true, outline: true, texelsPerUnit: 10, pixelScale: 3, dpr: 1, rtW: 0, rtH: 0,
      bufferSize(w, h) {
        if (!this.enabled) return [Math.round(w * this.dpr), Math.round(h * this.dpr)];
        return [Math.max(32, Math.round(w / this.pixelScale)), Math.max(32, Math.round(h / this.pixelScale))];
      },
      viewSize(w, h) { return [w / this.pixelScale / this.texelsPerUnit, h / this.pixelScale / this.texelsPerUnit]; },
    };
    this.geos = new Map(); this.batches = new Map(); this.textures = new Map();
    this.lightVP = Mat4.create(); this.lightView = Mat4.create(); this.lightProj = Mat4.create(); this.lightWorld = Mat4.create();
    this.progs = {
      main: this.program(S.MAIN_VS, S.MAIN_FS), shadow: this.program(S.SHADOW_VS, S.SHADOW_FS),
      pick: this.program(S.PICK_VS, S.PICK_FS), comp: this.program(S.COMP_VS, S.COMP_FS), dust: this.program(S.DUST_VS, S.DUST_FS),
    };
    this.white = this.texture('white', (() => { const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1); return c; })(), { mips: false });
    this.buildShadowTarget();
    this.main = null; this.pickFb = null;
    this.emptyVao = gl.createVertexArray();
    this.dustVao = gl.createVertexArray(); this.dustBufs = [gl.createBuffer(), gl.createBuffer(), gl.createBuffer()];
    gl.bindVertexArray(this.dustVao);
    [[0, 3], [1, 1], [2, 1]].forEach(([loc, n], i) => { gl.bindBuffer(gl.ARRAY_BUFFER, this.dustBufs[i]); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); });
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    Mat4.ortho(this.lightProj, -125, 125, 125, -125, 1, 400);
  }

  // ---- resources -------------------------------------------------------------
  program(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  texture(name, canvas, { nearest = false, repeat = false, mips = true, nearestMag = false } = {}) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);                       // same orientation as three.js canvas textures
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest || nearestMag ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : (mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR));
    if (mips && !nearest) { gl.generateMipmap(gl.TEXTURE_2D); if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4); }
    this.textures.set(name, t); return t;
  }

  depthTexture(w, h) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  colorTexture(w, h) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  buildShadowTarget() {
    const gl = this.gl;
    this.shadowTex = this.depthTexture(SHADOW_SIZE, SHADOW_SIZE);
    this.shadowFb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    this.checkFb('shadow'); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  ensureMainTarget(w, h) {
    if (this.main && this.main.w === w && this.main.h === h) return;
    const gl = this.gl;
    if (this.main) { gl.deleteFramebuffer(this.main.fb); gl.deleteTexture(this.main.color); gl.deleteTexture(this.main.depth); }
    const color = this.colorTexture(w, h), depth = this.depthTexture(w, h), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    this.checkFb('main'); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.main = { fb, color, depth, w, h }; this.pixel.rtW = w; this.pixel.rtH = h;
  }
  ensurePickTarget(w, h) {
    if (this.pickFb && this.pickFb.w === w && this.pickFb.h === h) return;
    const gl = this.gl;
    if (this.pickFb) { gl.deleteFramebuffer(this.pickFb.fb); gl.deleteTexture(this.pickFb.color); gl.deleteRenderbuffer(this.pickFb.depth); }
    const color = this.colorTexture(w, h), depth = gl.createRenderbuffer(), fb = gl.createFramebuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    this.checkFb('pick'); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.pickFb = { fb, color, depth, w, h };
  }
  checkFb(name) { const s = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER); if (s !== this.gl.FRAMEBUFFER_COMPLETE) throw new Error(`${name} framebuffer incomplete: ${s}`); }

  setSize(W, H) {
    this.pixel.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(W * this.pixel.dpr); this.canvas.height = Math.round(H * this.pixel.dpr);
  }

  // ---- batching --------------------------------------------------------------
  geometry(key) {
    let g = this.geos.get(key); if (g) return g;
    const gl = this.gl, src = buildGeometry(key);
    g = { vbo: gl.createBuffer(), ebo: gl.createBuffer(), count: src.count };
    gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo); gl.bufferData(gl.ARRAY_BUFFER, src.data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ebo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, src.idx, gl.STATIC_DRAW);
    this.geos.set(key, g); return g;
  }

  batch(mesh) {
    const m = mesh.mat, key = `${mesh.geo}|${m.tex || ''}|${m.unlit ? 1 : 0}|${m.cast ? 1 : 0}`;
    let b = this.batches.get(key); if (b) return b;
    const gl = this.gl, geo = this.geometry(mesh.geo);
    b = { key, geo, tex: m.tex, unlit: !!m.unlit, cast: !!m.cast, vao: gl.createVertexArray(), ibo: gl.createBuffer(), cap: 64, n: 0 };
    b.data = new Float32Array(b.cap * STRIDE);
    gl.bindVertexArray(b.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbo);
    [[0, 3, 0], [1, 3, 12], [2, 2, 24]].forEach(([loc, n, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 32, off); });
    gl.bindBuffer(gl.ARRAY_BUFFER, b.ibo);
    for (let i = 0; i < 6; i++) { gl.enableVertexAttribArray(3 + i); gl.vertexAttribPointer(3 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16); gl.vertexAttribDivisor(3 + i, 1); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ebo);
    gl.bindVertexArray(null);
    this.batches.set(key, b); return b;
  }

  collect(scene) {
    for (const b of this.batches.values()) b.n = 0;
    const visit = (node, parentWorld, pid) => {
      if (!node.visible) return;
      Mat4.fromTRS(node.local, node.position, node.rotation, node.scale);
      parentWorld ? Mat4.multiply(node.world, parentWorld, node.local) : node.world.set(node.local);
      const id = node.pickId !== undefined ? node.pickId : pid;
      if (node.geo) {
        const b = this.batch(node);
        if (b.n === b.cap) { b.cap *= 2; const d = new Float32Array(b.cap * STRIDE); d.set(b.data); b.data = d; }
        const o = b.n * STRIDE, d = b.data, m = node.mat, ei = m.emissiveI === undefined ? 1 : m.emissiveI;
        d.set(node.world, o);
        d[o + 16] = m.color[0]; d[o + 17] = m.color[1]; d[o + 18] = m.color[2]; d[o + 19] = m.color[3] === undefined ? 1 : m.color[3];
        d[o + 20] = m.emissive[0] * ei; d[o + 21] = m.emissive[1] * ei; d[o + 22] = m.emissive[2] * ei; d[o + 23] = id;
        b.n++;
      }
      for (const c of node.children) visit(c, node.world, id);
    };
    for (const c of scene.children) visit(c, null, 0);
    const gl = this.gl;
    for (const b of this.batches.values()) if (b.n) { gl.bindBuffer(gl.ARRAY_BUFFER, b.ibo); gl.bufferData(gl.ARRAY_BUFFER, b.data.subarray(0, b.n * STRIDE), gl.DYNAMIC_DRAW); }
  }

  drawBatch(b) {
    const gl = this.gl;
    gl.bindVertexArray(b.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, b.geo.count, gl.UNSIGNED_SHORT, 0, b.n);
    this.stats.calls++;
  }

  // ---- frame -----------------------------------------------------------------
  render(scene, cam, L, dust, W, H) {
    const gl = this.gl, P = this.progs; this.stats.calls = 0;
    this.collect(scene);

    // light matrices (orthographic shadow camera looking at the world origin)
    const eye = new Vec3(L.sunDir[0] * 200, L.sunDir[1] * 200, L.sunDir[2] * 200);
    Mat4.cameraWorld(this.lightWorld, eye, ORIGIN, LIGHT_UP); Mat4.invert(this.lightView, this.lightWorld);
    Mat4.multiply(this.lightVP, this.lightProj, this.lightView);

    // 1. shadow depth
    if (this.shadows) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb); gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(P.shadow.p); gl.uniformMatrix4fv(P.shadow.u.uLightVP, false, this.lightVP);
      for (const b of this.batches.values()) if (b.n && b.cast) this.drawBatch(b);
    }

    // 2. lit scene into the low-res buffer
    const [bw, bh] = this.pixel.bufferSize(W, H); this.ensureMainTarget(bw, bh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.main.fb); gl.viewport(0, 0, bw, bh);
    gl.clearColor(L.background[0], L.background[1], L.background[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const u = P.main.u; gl.useProgram(P.main.p);
    gl.uniformMatrix4fv(u.uViewProj, false, cam.viewProj); gl.uniformMatrix4fv(u.uLightVP, false, this.lightVP);
    gl.uniform1f(u.uNormalBias, 0.6); gl.uniform1f(u.uShadowBias, -0.0006); gl.uniform1f(u.uShadowOn, this.shadows ? 1 : 0);
    gl.uniform3f(u.uSunDir, L.sunDir[0], L.sunDir[1], L.sunDir[2]);
    gl.uniform3f(u.uSunCol, L.sunColor[0] * L.sunI, L.sunColor[1] * L.sunI, L.sunColor[2] * L.sunI);
    gl.uniform3f(u.uHemiSky, L.hemiSky[0] * L.hemiI, L.hemiSky[1] * L.hemiI, L.hemiSky[2] * L.hemiI);
    gl.uniform3f(u.uHemiGround, L.hemiGround[0] * L.hemiI, L.hemiGround[1] * L.hemiI, L.hemiGround[2] * L.hemiI);
    const pp = [], pc = [], pd = [];
    for (let i = 0; i < 4; i++) { const l = L.points[i] || { pos: [0, -100, 0], color: [0, 0, 0], intensity: 0, distance: 1 }; pp.push(...l.pos); pc.push(l.color[0] * l.intensity, l.color[1] * l.intensity, l.color[2] * l.intensity); pd.push(l.distance); }
    gl.uniform3fv(u.uPointPos, pp); gl.uniform3fv(u.uPointCol, pc); gl.uniform1fv(u.uPointDist, pd);
    gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uShadow, 1);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(u.uUnlit, 0); gl.depthMask(true); gl.disable(gl.BLEND);
    for (const b of this.batches.values()) if (b.n && !b.unlit) { gl.bindTexture(gl.TEXTURE_2D, b.tex ? this.textures.get(b.tex) : this.white); this.drawBatch(b); }
    gl.uniform1f(u.uUnlit, 1); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
    for (const b of this.batches.values()) if (b.n && b.unlit) { gl.bindTexture(gl.TEXTURE_2D, b.tex ? this.textures.get(b.tex) : this.white); this.drawBatch(b); }

    // 3. dust (one draw call)
    if (dust && dust.n) {
      const d = P.dust; gl.useProgram(d.p);
      gl.uniformMatrix4fv(d.u.uViewProj, false, cam.viewProj);
      gl.uniform1f(d.u.uTpu, this.pixel.enabled ? this.pixel.texelsPerUnit : this.pixel.texelsPerUnit * this.pixel.pixelScale * this.pixel.dpr);
      gl.uniform3f(d.u.uColor, DUST_COLOR[0], DUST_COLOR[1], DUST_COLOR[2]);
      gl.bindVertexArray(this.dustVao);
      [dust.pos.subarray(0, dust.n * 3), dust.life.subarray(0, dust.n), dust.size.subarray(0, dust.n)].forEach((arr, i) => { gl.bindBuffer(gl.ARRAY_BUFFER, this.dustBufs[i]); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW); });
      gl.drawArrays(gl.POINTS, 0, dust.n); this.stats.calls++;
    }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);

    // 4. composite to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    const c = P.comp; gl.useProgram(c.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.main.color);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.main.depth);
    gl.uniform1i(c.u.tColor, 0); gl.uniform1i(c.u.tDepth, 1);
    gl.uniform2f(c.u.texel, 1 / bw, 1 / bh); gl.uniform1f(c.u.outline, this.pixel.outline ? 1 : 0);
    gl.uniform1f(c.u.depthThresh, 0.9 / (cam.far - cam.near));   // silhouettes only
    gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); this.stats.calls++;
    gl.enable(gl.DEPTH_TEST); gl.activeTexture(gl.TEXTURE0);
    this.lastViewProj = cam.viewProj;
  }

  // Renders instance ids into a small buffer and reads the pixel under the cursor.
  pick(nx, ny) {
    if (!this.main || !this.lastViewProj) return 0;
    const gl = this.gl, w = this.main.w, h = this.main.h, savedCalls = this.stats.calls; this.ensurePickTarget(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFb.fb); gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const p = this.progs.pick; gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.uViewProj, false, this.lastViewProj);
    for (const b of this.batches.values()) if (b.n && !b.unlit) this.drawBatch(b);
    const px = new Uint8Array(4);
    gl.readPixels(Math.min(w - 1, Math.floor(nx * w)), Math.min(h - 1, Math.floor((1 - ny) * h)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); this.stats.calls = savedCalls;   // picks are not part of the frame cost
    return px[0] + px[1] * 256 + px[2] * 65536;
  }
}
