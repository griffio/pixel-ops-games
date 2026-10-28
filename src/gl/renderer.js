import { Mat4, Vec3 } from '../core/math.js';
import { buildGeometry } from '../core/geometry.js';
import * as S from './shaders.js';

const STRIDE = 24;            // floats per instance: mat4 (16) + colour (4) + emissive rgb + pick id (4)
const LIGHT_UP = new Vec3(0, 1, 0);

// Raw WebGL2 renderer. Every mesh is an instance of a shared geometry. Dynamic
// meshes (units, markers) are collected from the scene graph each frame; static
// props are baked once into per-chunk instance buffers and culled per chunk.
// Passes: shadow depth (frustum fitted to the view) -> low-res lit colour+depth ->
// composite (nearest upscale, outline, sRGB). Picking renders ids on demand.
export class GLRenderer {
  // opts: shadowSize (4096; 2048 on mobile), dprCap (2; 1 on mobile keeps the composite cheap on retina tablets)
  constructor(canvas, { shadowSize = 4096, dprCap = 2 } = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl; this.canvas = canvas; this.shadowSize = shadowSize; this.dprCap = dprCap;
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.shadows = true; this.pcf = true; this.stats = { calls: 0, chunks: 0 };
    this.pixel = {
      enabled: true, outline: true, texelsPerUnit: 10, pixelScale: 3, dpr: 1, rtW: 0, rtH: 0,
      bufferSize(w, h) {
        if (!this.enabled) return [Math.round(w * this.dpr), Math.round(h * this.dpr)];
        return [Math.max(32, Math.round(w / this.pixelScale)), Math.max(32, Math.round(h / this.pixelScale))];
      },
      viewSize(w, h) { return [w / this.pixelScale / this.texelsPerUnit, h / this.pixelScale / this.texelsPerUnit]; },
    };
    this.geos = new Map(); this.batches = new Map(); this.textures = new Map();
    this.chunkSize = 64; this.chunks = new Map(); this.ground = null;
    this.lightVP = Mat4.create(); this.lightView = Mat4.create(); this.lightProj = Mat4.create(); this.lightWorld = Mat4.create();
    this.progs = {
      main: this.program(S.MAIN_VS, S.MAIN_FS), shadow: this.program(S.SHADOW_VS, S.SHADOW_FS),
      pick: this.program(S.PICK_VS, S.PICK_FS), comp: this.program(S.COMP_VS, S.COMP_FS), dust: this.program(S.DUST_VS, S.DUST_FS), streak: this.program(S.STREAK_VS, S.STREAK_FS),
    };
    this.white = this.texture('white', (() => { const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1); return c; })(), { mips: false });
    this.buildShadowTarget();
    this.main = null; this.pickFb = null;
    this.emptyVao = gl.createVertexArray();
    this.dustVao = gl.createVertexArray(); this.dustBufs = [0, 1, 2, 3, 4].map(() => gl.createBuffer());
    gl.bindVertexArray(this.dustVao);
    [[0, 3], [1, 1], [2, 1], [3, 3], [4, 2]].forEach(([loc, n], i) => { gl.bindBuffer(gl.ARRAY_BUFFER, this.dustBufs[i]); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); });
    this.streakVao = gl.createVertexArray(); this.streakBuf = gl.createBuffer();
    gl.bindVertexArray(this.streakVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.streakBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
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
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest || nearestMag ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : (mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR));
    if (mips && !nearest) { gl.generateMipmap(gl.TEXTURE_2D); if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4); }
    this.textures.set(name, t); return t;
  }
  // splat map: linear so terrain blends are soft while the tiles stay crisp
  dataTexture(name, canvas) { return this.texture(name, canvas, { nearest: false, repeat: false, mips: false }); }

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
    this.shadowTex = this.depthTexture(this.shadowSize, this.shadowSize);
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
    this.pixel.dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.canvas.width = Math.round(W * this.pixel.dpr); this.canvas.height = Math.round(H * this.pixel.dpr);
  }

  // ---- geometry & batches ----------------------------------------------------
  uploadGeometry(key, src) {
    const gl = this.gl, g = { vbo: gl.createBuffer(), ebo: gl.createBuffer(), count: src.count };
    gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo); gl.bufferData(gl.ARRAY_BUFFER, src.data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ebo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, src.idx, gl.STATIC_DRAW);
    this.geos.set(key, g); return g;
  }
  geometry(key) { return this.geos.get(key) || this.uploadGeometry(key, buildGeometry(key)); }
  registerGeometry(key, src) { if (!this.geos.has(key)) this.uploadGeometry(key, src); return key; }

  batchKey(geo, m) { return `${geo}|${m.tex || ''}|${m.unlit ? 1 : 0}|${m.cast ? 1 : 0}|${m.cutout ? 1 : 0}|${m.ground ? 1 : 0}|${m.water ? 1 : 0}`; }
  makeBatch(geoKey, m, cap) {
    const gl = this.gl, geo = this.geometry(geoKey);
    const b = { geo, tex: m.tex, unlit: !!m.unlit, cast: !!m.cast, cutout: !!m.cutout, ground: !!m.ground, water: !!m.water, vao: gl.createVertexArray(), ibo: gl.createBuffer(), cap, n: 0, data: new Float32Array(cap * STRIDE) };
    gl.bindVertexArray(b.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbo);
    [[0, 3, 0], [1, 3, 12], [2, 2, 24]].forEach(([loc, n, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 32, off); });
    gl.bindBuffer(gl.ARRAY_BUFFER, b.ibo);
    for (let i = 0; i < 6; i++) { gl.enableVertexAttribArray(3 + i); gl.vertexAttribPointer(3 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16); gl.vertexAttribDivisor(3 + i, 1); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ebo);
    gl.bindVertexArray(null);
    return b;
  }
  pushInstance(b, world, m, id) {
    if (b.n === b.cap) { b.cap *= 2; const d = new Float32Array(b.cap * STRIDE); d.set(b.data); b.data = d; }
    const o = b.n * STRIDE, d = b.data, ei = m.emissiveI === undefined ? 1 : m.emissiveI;
    d.set(world, o);
    d[o + 16] = m.color[0]; d[o + 17] = m.color[1]; d[o + 18] = m.color[2]; d[o + 19] = m.color[3] === undefined ? 1 : m.color[3];
    d[o + 20] = m.emissive[0] * ei; d[o + 21] = m.emissive[1] * ei; d[o + 22] = m.emissive[2] * ei; d[o + 23] = id;
    b.n++;
  }

  // static props: baked once into per-chunk batches, culled per chunk
  addStatic(mesh) {
    const p = mesh.position, cs = this.chunkSize;
    const cx = Math.floor(p.x / cs), cz = Math.floor(p.z / cs), key = cx + ',' + cz;
    let c = this.chunks.get(key);
    if (!c) { c = { minX: cx * cs, maxX: (cx + 1) * cs, minZ: cz * cs, maxZ: (cz + 1) * cs, batches: new Map(), r: cs }; this.chunks.set(key, c); }
    const bk = this.batchKey(mesh.geo, mesh.mat);
    let b = c.batches.get(bk); if (!b) { b = this.makeBatch(mesh.geo, mesh.mat, 16); c.batches.set(bk, b); }
    Mat4.fromTRS(mesh.world, mesh.position, mesh.rotation, mesh.scale);
    this.pushInstance(b, mesh.world, mesh.mat, 0);
    if (mesh.mat.ground) c.ground = true;
  }
  finalizeStatic() {
    const gl = this.gl;
    for (const c of this.chunks.values()) for (const b of c.batches.values()) { gl.bindBuffer(gl.ARRAY_BUFFER, b.ibo); gl.bufferData(gl.ARRAY_BUFFER, b.data.subarray(0, b.n * STRIDE), gl.STATIC_DRAW); }
  }
  clearStatic() {
    const gl = this.gl;
    for (const c of this.chunks.values()) for (const b of c.batches.values()) { gl.deleteVertexArray(b.vao); gl.deleteBuffer(b.ibo); }
    this.chunks.clear();
  }
  setGround(g) { this.ground = g; }
  // water: the depth map (one byte per terrain vertex, n x n from -half, cell apart: (depth + 0.5) / 4.5), for the water's
  // colour and foam and the wet banks
  setWater(data, n, cell, half) {
    const gl = this.gl; this.waterTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.waterTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);   // rows go up in z as given
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, n, n, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const scale = 1 / (cell * n); this.waterMap = [scale, half * scale + 0.5 / n];
  }
  // fog of war: one byte per cell (255 seen) over a grid starting at -half; null switches the shading off
  setFog(data, n, cell, half) {
    if (!data) { this.fog = null; return; }
    const gl = this.gl;
    if (!this.fogTex || this.fogN !== n) {
      this.fogTex = gl.createTexture(); this.fogN = n; gl.bindTexture(gl.TEXTURE_2D, this.fogTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, n, n, 0, gl.RED, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    // rows go up in z as uploaded: the image textures leave UNPACK_FLIP_Y on, which would mirror the grid north to south
    gl.bindTexture(gl.TEXTURE_2D, this.fogTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, n, gl.RED, gl.UNSIGNED_BYTE, data); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    this.fog = { inv: 1 / (n * cell), off: half / (n * cell) };
  }   // { splat, base, tiles:[4 names], tileSize:[4], baseSize, mapSize }

  collect(scene) {
    for (const b of this.batches.values()) b.n = 0;
    const visit = (node, parentWorld, pid) => {
      if (!node.visible || node.hidden) return;   // hidden: an enemy the player's side cannot see (fog of war)
      Mat4.fromTRS(node.local, node.position, node.rotation, node.scale);
      parentWorld ? Mat4.multiply(node.world, parentWorld, node.local) : node.world.set(node.local);
      const id = node.pickId !== undefined ? node.pickId : pid;
      if (node.geo) {
        const bk = this.batchKey(node.geo, node.mat);
        let b = this.batches.get(bk); if (!b) { b = this.makeBatch(node.geo, node.mat, 64); this.batches.set(bk, b); }
        this.pushInstance(b, node.world, node.mat, id);
      }
      for (const c of node.children) visit(c, node.world, id);
    };
    for (const c of scene.children) visit(c, null, 0);
    const gl = this.gl;
    for (const b of this.batches.values()) if (b.n) { gl.bindBuffer(gl.ARRAY_BUFFER, b.ibo); gl.bufferData(gl.ARRAY_BUFFER, b.data.subarray(0, b.n * STRIDE), gl.DYNAMIC_DRAW); }
  }

  // ground-plane bounding box of the camera view, for chunk culling and the shadow fit
  viewBox(cam) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [sx, sy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const p = cam.screenToGround(sx, sy); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    return { minX, maxX, minZ, maxZ };
  }
  visibleChunks(box, margin) {
    const out = [];
    for (const c of this.chunks.values()) if (c.maxX + margin > box.minX && c.minX - margin < box.maxX && c.maxZ + margin > box.minZ && c.minZ - margin < box.maxZ) out.push(c);
    return out;
  }

  drawBatch(b) {
    const gl = this.gl;
    gl.bindVertexArray(b.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, b.geo.count, gl.UNSIGNED_SHORT, 0, b.n);
    this.stats.calls++;
  }
  *eachBatch(chunks) {
    for (const c of chunks) for (const b of c.batches.values()) if (b.n) yield b;
    for (const b of this.batches.values()) if (b.n) yield b;
  }

  // ---- frame -----------------------------------------------------------------
  render(scene, cam, L, dust, W, H) {
    const gl = this.gl, P = this.progs; this.stats.calls = 0;
    this.collect(scene);
    const box = this.viewBox(cam);
    // Light frustum: centred on the visible ground, sized from the camera's own footprint (view size and
    // pitch, not the terrain hits, which change continuously while panning over hills) and quantised to
    // quarter-octave steps, so the shadow texel size only changes at discrete zoom levels. With a fixed
    // texel size the eye snap below keeps the shadow grid still in the world and edges stop rippling.
    const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
    const footprint = Math.hypot(cam.viewW, cam.viewH / Math.max(0.3, Math.sin(cam.pitch)));
    const R = 8 * Math.pow(2, Math.ceil(Math.log2((footprint / 2 + 70) / 8) * 4) / 4);   // 70 m: hills shift the footprint, long shadows reach in
    const mainChunks = this.visibleChunks(box, 40), shadowChunks = this.visibleChunks(box, R);   // every chunk the light frustum can see
    this.stats.chunks = mainChunks.length; this.stats.shadowR = R;
    const target = new Vec3(cx, 0, cz), eye = new Vec3(cx + L.sunDir[0] * 400, L.sunDir[1] * 400, cz + L.sunDir[2] * 400);
    Mat4.cameraWorld(this.lightWorld, eye, target, LIGHT_UP);
    const right = Mat4.column(this.lightWorld, 0), up = Mat4.column(this.lightWorld, 1), texel = 2 * R / this.shadowSize;
    const ox = eye.dot(right), oy = eye.dot(up);
    eye.addScaledVector(right, Math.round(ox / texel) * texel - ox).addScaledVector(up, Math.round(oy / texel) * texel - oy);
    this.lightWorld[12] = eye.x; this.lightWorld[13] = eye.y; this.lightWorld[14] = eye.z;
    Mat4.invert(this.lightView, this.lightWorld);
    Mat4.ortho(this.lightProj, -R, R, R, -R, 1, 800);
    Mat4.multiply(this.lightVP, this.lightProj, this.lightView);

    // 1. shadow depth
    if (this.shadows) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb); gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(P.shadow.p); gl.uniformMatrix4fv(P.shadow.u.uLightVP, false, this.lightVP); gl.uniform1i(P.shadow.u.uTex, 0); gl.activeTexture(gl.TEXTURE0);
      for (const b of this.eachBatch(shadowChunks)) if (b.cast) {
        gl.uniform1f(P.shadow.u.uCutout, b.cutout ? 1 : 0); if (b.cutout) gl.bindTexture(gl.TEXTURE_2D, this.textures.get(b.tex));
        this.drawBatch(b);
      }
    }

    // 2. lit scene into the low-res buffer
    const [bw, bh] = this.pixel.bufferSize(W, H); this.ensureMainTarget(bw, bh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.main.fb); gl.viewport(0, 0, bw, bh);
    gl.clearColor(L.background[0], L.background[1], L.background[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const u = P.main.u; gl.useProgram(P.main.p);
    gl.uniformMatrix4fv(u.uViewProj, false, cam.viewProj); gl.uniformMatrix4fv(u.uLightVP, false, this.lightVP);
    gl.uniform1f(u.uNormalBias, 0.6); gl.uniform1f(u.uShadowBias, -0.0006); gl.uniform1f(u.uShadowOn, this.shadows ? 1 : 0); gl.uniform1f(u.uShadowPcf, this.pcf ? 1 : 0);
    gl.uniform3f(u.uSunDir, L.sunDir[0], L.sunDir[1], L.sunDir[2]);
    gl.uniform3f(u.uSunCol, L.sunColor[0] * L.sunI, L.sunColor[1] * L.sunI, L.sunColor[2] * L.sunI);
    gl.uniform3f(u.uHemiSky, L.hemiSky[0] * L.hemiI, L.hemiSky[1] * L.hemiI, L.hemiSky[2] * L.hemiI);
    gl.uniform3f(u.uHemiGround, L.hemiGround[0] * L.hemiI, L.hemiGround[1] * L.hemiI, L.hemiGround[2] * L.hemiI);
    const pp = [], pc = [], pd = [];
    for (let i = 0; i < 8; i++) { const l = L.points[i] || { pos: [0, -100, 0], color: [0, 0, 0], intensity: 0, distance: 1 }; pp.push(...l.pos); pc.push(l.color[0] * l.intensity, l.color[1] * l.intensity, l.color[2] * l.intensity); pd.push(l.distance); }
    gl.uniform3fv(u.uPointPos, pp); gl.uniform3fv(u.uPointCol, pc); gl.uniform1fv(u.uPointDist, pd);
    gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uShadow, 1);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    if (this.ground) {
      const g = this.ground, units = [2, 3, 4, 5, 6, 7], names = [g.splat, g.base, ...g.tiles];
      names.forEach((n, i) => { gl.activeTexture(gl.TEXTURE0 + units[i]); gl.bindTexture(gl.TEXTURE_2D, this.textures.get(n)); });
      gl.uniform1i(u.uSplat, 2); gl.uniform1i(u.uBase, 3); gl.uniform1i(u.uT0, 4); gl.uniform1i(u.uT1, 5); gl.uniform1i(u.uT2, 6); gl.uniform1i(u.uT3, 7);
      gl.uniform4f(u.uTileInv, 1 / g.tileSize[0], 1 / g.tileSize[1], 1 / g.tileSize[2], 1 / g.tileSize[3]);
      gl.uniform1f(u.uBaseInv, 1 / g.baseSize); gl.uniform1f(u.uMapInv, 1 / g.mapSize);
      if (g.rock) { gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D, this.textures.get(g.rock)); gl.uniform1i(u.uRock, 10); gl.uniform1f(u.uRockInv, 1 / g.rockSize); }
      gl.uniform1f(u.uRockOn, g.rock ? 1 : 0);   // rock on steep ground
    }
    gl.uniform1i(u.uWater, 9); gl.uniform1f(u.uWaterOn, this.waterTex ? 1 : 0); gl.uniform1f(u.uTime, (performance.now() / 1000) % 3600);
    if (this.waterTex) { gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, this.waterTex); gl.uniform2f(u.uWaterMap, this.waterMap[0], this.waterMap[1]); }
    gl.uniform1i(u.uFog, 8); gl.uniform1f(u.uFogOn, this.fog ? 1 : 0);
    if (this.fog) { gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, this.fogTex); gl.uniform2f(u.uFogMap, this.fog.inv, this.fog.off); }
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(u.uUnlit, 0); gl.depthMask(true); gl.disable(gl.BLEND);
    for (const b of this.eachBatch(mainChunks)) if (!b.unlit && !b.water) {
      gl.uniform1i(u.uMode, b.ground ? 1 : 0); gl.uniform1f(u.uCutout, b.cutout ? 1 : 0);
      gl.bindTexture(gl.TEXTURE_2D, b.tex ? this.textures.get(b.tex) : this.white); this.drawBatch(b);
    }
    // water: lit like the ground (shadows, the night, fog of war) but blended over the bed, without writing depth
    gl.uniform1i(u.uMode, 2); gl.uniform1f(u.uCutout, 0); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const b of this.eachBatch(mainChunks)) if (b.water) { gl.bindTexture(gl.TEXTURE_2D, this.white); this.drawBatch(b); }
    gl.depthMask(true); gl.disable(gl.BLEND);
    gl.uniform1i(u.uMode, 0); gl.uniform1f(u.uUnlit, 1); gl.uniform1f(u.uCutout, 0); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
    for (const b of this.eachBatch(mainChunks)) if (b.unlit) { gl.bindTexture(gl.TEXTURE_2D, b.tex ? this.textures.get(b.tex) : this.white); this.drawBatch(b); }

    // 3. particles (one draw call)
    if (dust && dust.n) {
      const d = P.dust; gl.useProgram(d.p); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied: additive glow and covering smoke in one pass
      gl.uniformMatrix4fv(d.u.uViewProj, false, cam.viewProj);
      gl.uniform1f(d.u.uTpu, this.pixel.enabled ? this.pixel.texelsPerUnit : this.pixel.texelsPerUnit * this.pixel.pixelScale * this.pixel.dpr);
      gl.bindVertexArray(this.dustVao);
      [dust.pos.subarray(0, dust.n * 3), dust.life.subarray(0, dust.n), dust.size.subarray(0, dust.n), dust.color.subarray(0, dust.n * 3), dust.params.subarray(0, dust.n * 2)].forEach((arr, i) => { gl.bindBuffer(gl.ARRAY_BUFFER, this.dustBufs[i]); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW); });
      gl.drawArrays(gl.POINTS, 0, dust.n); this.stats.calls++;
    }
    // 3b. tracer streaks (one draw call of additive lines)
    if (dust && dust.shots && dust.shots.segCount) {
      const s = P.streak, sh = dust.shots; gl.useProgram(s.p); gl.uniformMatrix4fv(s.u.uViewProj, false, cam.viewProj);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.bindVertexArray(this.streakVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.streakBuf); gl.bufferData(gl.ARRAY_BUFFER, sh.segs.subarray(0, sh.segCount * 14), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.LINES, 0, sh.segCount * 2); this.stats.calls++;
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
    gl.uniform1f(c.u.depthThresh, 0.9 / (cam.far - cam.near));
    gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); this.stats.calls++;
    gl.enable(gl.DEPTH_TEST); gl.activeTexture(gl.TEXTURE0);
    this.lastViewProj = cam.viewProj;
  }

  // Renders dynamic instance ids into a small buffer and reads the pixel under the cursor.
  // radiusPx > 0 (touch) searches a block around the point and returns the nearest id.
  pick(nx, ny, radiusPx = 0) {
    if (!this.main || !this.lastViewProj) return 0;
    const gl = this.gl, w = this.main.w, h = this.main.h, savedCalls = this.stats.calls; this.ensurePickTarget(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFb.fb); gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const p = this.progs.pick; gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.uViewProj, false, this.lastViewProj);
    for (const b of this.batches.values()) if (b.n && !b.unlit && !b.water) this.drawBatch(b);
    const cx = Math.min(w - 1, Math.floor(nx * w)), cy = Math.min(h - 1, Math.floor((1 - ny) * h));
    const r = Math.min(24, Math.round(radiusPx * w / (this.canvas.clientWidth || w)));
    const x0 = Math.max(0, cx - r), y0 = Math.max(0, cy - r), bw = Math.min(w - 1, cx + r) - x0 + 1, bh = Math.min(h - 1, cy + r) - y0 + 1;
    const px = new Uint8Array(bw * bh * 4);
    gl.readPixels(x0, y0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); this.stats.calls = savedCalls;
    let best = 0, bestD = Infinity;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = (y * bw + x) * 4, id = px[i] + px[i + 1] * 256 + px[i + 2] * 65536; if (!id) continue;
      const d = (x0 + x - cx) ** 2 + (y0 + y - cy) ** 2; if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }
}
