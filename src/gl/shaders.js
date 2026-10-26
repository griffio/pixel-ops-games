// GLSL ES 3.00 sources. Attribute layout shared by every program so one VAO per
// batch serves the shadow, main and pick passes:
//   0 aPos  1 aNormal  2 aUv  |  per instance: 3-6 world matrix columns, 7 colour rgba, 8 emissive rgb + pick id

const INSTANCE_IN = `
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNormal; layout(location=2) in vec2 aUv;
layout(location=3) in vec4 iM0; layout(location=4) in vec4 iM1; layout(location=5) in vec4 iM2; layout(location=6) in vec4 iM3;
layout(location=7) in vec4 iColor; layout(location=8) in vec4 iEmis;`;

export const MAIN_VS = `#version 300 es
${INSTANCE_IN}
uniform mat4 uViewProj; uniform mat4 uLightVP; uniform float uNormalBias;
out vec3 vN; out vec2 vUv; out vec4 vColor; out vec3 vEmis; out vec3 vWorld; out vec4 vShadow;
void main() {
  mat4 M = mat4(iM0, iM1, iM2, iM3);
  vec4 w = M * vec4(aPos, 1.0);
  vec3 n = normalize(mat3(M) * aNormal);
  vWorld = w.xyz; vN = n; vUv = aUv; vColor = iColor; vEmis = iEmis.rgb;
  vShadow = uLightVP * vec4(w.xyz + n * uNormalBias, 1.0);
  gl_Position = uViewProj * w;
}`;

// Lambert lighting in three.js' physical units: irradiance / PI, hard shadow compare.
export const MAIN_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec2 vUv; in vec4 vColor; in vec3 vEmis; in vec3 vWorld; in vec4 vShadow;
uniform sampler2D uTex; uniform sampler2D uShadow;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uHemiSky; uniform vec3 uHemiGround;
uniform vec3 uPointPos[8]; uniform vec3 uPointCol[8]; uniform float uPointDist[8];
uniform float uShadowOn; uniform float uShadowBias; uniform float uShadowPcf; uniform float uUnlit; uniform float uCutout;
// ground mode: albedo blended from tileable textures by a splat map in world space
uniform int uMode; uniform sampler2D uSplat; uniform sampler2D uBase; uniform sampler2D uT0; uniform sampler2D uT1; uniform sampler2D uT2; uniform sampler2D uT3;
uniform vec4 uTileInv; uniform float uBaseInv; uniform float uMapInv;
// fog of war: one value per cell over the map (1 seen), uFogMap = (1 / grid extent, half the map / grid extent)
uniform sampler2D uFog; uniform float uFogOn; uniform vec2 uFogMap;
// water (mode 2) and wet banks: the map's water depth (r: (metres below the surface + 0.5) / 4.5, so the bank up to 0.5 m
// above the water reads below 0.5 / 4.5), at uWaterMap = (scale, offset) over the world; uTime animates the foam
uniform sampler2D uWater; uniform float uWaterOn; uniform vec2 uWaterMap; uniform float uTime;
out vec4 frag;
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise2(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y); }
float depthAt(vec2 w) { return texture(uWater, w * uWaterMap.x + uWaterMap.y).r * 4.5 - 0.5; }
void main() {
  vec4 albedo;
  if (uMode == 1) {
    vec2 w = vWorld.xz;
    vec4 s = texture(uSplat, w * uMapInv + 0.5);
    float rest = max(0.0, 1.0 - (s.r + s.g + s.b + s.a));
    vec3 c = texture(uBase, w * uBaseInv).rgb * rest + texture(uT0, w * uTileInv.x).rgb * s.r + texture(uT1, w * uTileInv.y).rgb * s.g
           + texture(uT2, w * uTileInv.z).rgb * s.b + texture(uT3, w * uTileInv.w).rgb * s.a;
    if (uWaterOn > 0.5) { float above = -depthAt(w); c = mix(c, c * vec3(0.62, 0.66, 0.64), 1.0 - smoothstep(0.0, 0.45, above)); }   // wet sand at the water's edge, and the bed under it
    albedo = vec4(c * vColor.rgb, 1.0);
  } else if (uMode == 2) {
    // Teal water, paler where it is shallow; at the edge a ragged band of foam, and from it wavering foam lines run out
    // across the water (along the depth's slope), fading over 7 m; faint drifting ripples on the shallows (the ford). Foam
    // goes by distance from the shore (depth over the bank's slope), so a steep bank gets as wide a band as a gentle one.
    vec2 w = vWorld.xz; float d = depthAt(w);
    vec2 g = vec2(depthAt(w + vec2(1.5, 0.0)) - depthAt(w - vec2(1.5, 0.0)), depthAt(w + vec2(0.0, 1.5)) - depthAt(w - vec2(0.0, 1.5)));
    float slope = max(length(g) / 3.0, 0.04), dist = max(d, 0.0) / slope;                       // metres to the shore
    vec2 out1 = length(g) > 1e-4 ? normalize(g) : vec2(1.0, 0.0), along = vec2(-out1.y, out1.x);
    vec3 c = mix(vec3(0.03, 0.19, 0.18), vec3(0.014, 0.117, 0.122), smoothstep(0.1, 2.2, d));
    vec2 q = w + vec2(vnoise2(w * 0.45 + uTime * 0.12), vnoise2(w * 0.45 + 9.0 - uTime * 0.1)) * 3.6;   // curls
    float line = 1.0 - smoothstep(0.07, 0.18, abs(fract(dot(q, along) / 4.6) - 0.5) * 2.0);
    float tendril = line * (1.0 - smoothstep(1.2, 7.0, dist)) * step(0.42, vnoise2(w * 0.3 + 3.0));
    float band = (1.0 - smoothstep(0.8, 1.15, dist + (vnoise2(w * 0.7 + uTime * 0.25) - 0.5) * 1.2)) * (0.55 + 0.45 * step(0.3, vnoise2(w * 0.18 + 5.0)));   // a crisp band, broken into brighter chunks
    vec2 rw = w + vec2(vnoise2(w * 0.2 + uTime * 0.1), vnoise2(w * 0.2 - uTime * 0.1)) * 4.0;
    float ripple = smoothstep(0.8, 1.0, sin(dot(rw, vec2(0.9, 0.5)) * 1.3 + uTime * 0.8)) * (1.0 - smoothstep(0.3, 1.4, d)) * 0.3;
    float foam = max(max(band, tendril * 0.85), ripple);
    albedo = vec4(mix(c, vec3(0.78, 0.9, 0.86), foam), mix(0.66 + 0.26 * smoothstep(0.0, 1.2, d), 0.96, foam));
  } else albedo = vColor * texture(uTex, vUv);
  if (uCutout > 0.5 && albedo.a < 0.5) discard;

  if (uUnlit > 0.5) { frag = albedo; return; }
  vec3 n = normalize(vN);
  float sh = 1.0;
  if (uShadowOn > 0.5) {
    vec3 sc = vShadow.xyz / vShadow.w * 0.5 + 0.5;
    if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z <= 1.0) {
      float z = sc.z + uShadowBias;
      if (uShadowPcf > 0.5) {
        // 2x2 bilinear comparison, then a hard threshold: the edge follows the sub-texel iso-line of the
        // depth test instead of the shadow texel staircase, so it stays put as the screen grid slides over it
        vec2 ts = vec2(textureSize(uShadow, 0)), p = sc.xy * ts - 0.5, f = fract(p), b = (floor(p) + 0.5) / ts;
        float s00 = z > texture(uShadow, b).r ? 0.0 : 1.0, s10 = z > texture(uShadow, b + vec2(1.0 / ts.x, 0.0)).r ? 0.0 : 1.0;
        float s01 = z > texture(uShadow, b + vec2(0.0, 1.0 / ts.y)).r ? 0.0 : 1.0, s11 = z > texture(uShadow, b + 1.0 / ts).r ? 0.0 : 1.0;
        sh = mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y) >= 0.5 ? 1.0 : 0.0;
      } else sh = z > texture(uShadow, sc.xy).r ? 0.0 : 1.0;
    }
  }
  vec3 irr = uSunCol * max(dot(n, uSunDir), 0.0) * sh;
  irr += mix(uHemiGround, uHemiSky, 0.5 * n.y + 0.5);
  for (int i = 0; i < 8; i++) {
    vec3 L = uPointPos[i] - vWorld; float d = length(L);
    float cut = pow(clamp(1.0 - pow(d / uPointDist[i], 4.0), 0.0, 1.0), 2.0);
    irr += uPointCol[i] * cut / max(d * d, 0.01) * max(dot(n, L / d), 0.0);
  }
  vec3 col = albedo.rgb * irr / 3.14159265 + vEmis;
  if (uFogOn > 0.5) {   // what the player's side cannot see: darker and greyer
    float v = texture(uFog, vWorld.xz * uFogMap.x + uFogMap.y).r;
    col = mix(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, 0.35) * 0.25, col, v);
  }
  frag = vec4(col, albedo.a);
}`;

export const SHADOW_VS = `#version 300 es
${INSTANCE_IN}
uniform mat4 uLightVP; out vec2 vUv;
void main() { vUv = aUv; gl_Position = uLightVP * (mat4(iM0, iM1, iM2, iM3) * vec4(aPos, 1.0)); }`;

export const SHADOW_FS = `#version 300 es
precision mediump float;
uniform sampler2D uTex; uniform float uCutout; in vec2 vUv;
void main() { if (uCutout > 0.5 && texture(uTex, vUv).a < 0.5) discard; }`;

export const PICK_VS = `#version 300 es
${INSTANCE_IN}
uniform mat4 uViewProj; flat out float vId;
void main() { vId = iEmis.w; gl_Position = uViewProj * (mat4(iM0, iM1, iM2, iM3) * vec4(aPos, 1.0)); }`;

export const PICK_FS = `#version 300 es
precision highp float;
flat in float vId; out vec4 frag;
void main() {
  float id = vId;
  frag = vec4(mod(id, 256.0), mod(floor(id / 256.0), 256.0), floor(id / 65536.0), 255.0) / 255.0;
}`;

// Fullscreen triangle from gl_VertexID, no buffers needed.
export const COMP_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0);
}`;

// Nearest upscale + 1-texel outline from depth discontinuities + linear->sRGB.
export const COMP_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 frag;
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel; uniform float outline; uniform float depthThresh;
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(0.0031308, c)); }
void main() {
  vec4 c = texture(tColor, vUv);
  if (outline > 0.5) {
    float d = texture(tDepth, vUv).r;
    float dl = texture(tDepth, vUv - vec2(texel.x, 0.0)).r, dr = texture(tDepth, vUv + vec2(texel.x, 0.0)).r;
    float du = texture(tDepth, vUv + vec2(0.0, texel.y)).r, dd = texture(tDepth, vUv - vec2(0.0, texel.y)).r;
    float e = max(max(dl - d, dr - d), max(du - d, dd - d));
    c.rgb *= mix(1.0, 0.55, step(depthThresh, e));
  }
  frag = vec4(toSrgb(clamp(c.rgb, 0.0, 1.0)), 1.0);
}`;

export const DUST_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in float aLife; layout(location=2) in float aSize; layout(location=3) in vec3 aColor; layout(location=4) in vec2 aParams;
uniform mat4 uViewProj; uniform float uTpu; out vec4 vC; out float vAdd;
// an alpha of 2 + a flags an additive (glowing) particle; see core/dust.js
void main() { float a = aParams.y; vAdd = step(1.5, a); a -= 2.0 * vAdd; vC = vec4(aColor, aLife * a); gl_PointSize = max(1.0, aSize * mix(1.0, 1.6 - aLife, aParams.x) * uTpu); gl_Position = uViewProj * vec4(aPos, 1.0); }`;

// tracer streaks: additive line segments, bright at the head, dark at the tail
export const STREAK_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol;
uniform mat4 uViewProj; out vec4 vC;
void main() { vC = aCol; gl_Position = uViewProj * vec4(aPos, 1.0); }`;

export const STREAK_FS = `#version 300 es
precision mediump float;
in vec4 vC; out vec4 frag;
void main() { frag = vec4(vC.rgb * vC.a, 0.0); }`;

export const DUST_FS = `#version 300 es
precision mediump float;
in vec4 vC; in float vAdd; out vec4 frag;
// round sprites, premultiplied output: normal particles cover, additive ones only add light
void main() { if (vC.a <= 0.0) discard; vec2 q = gl_PointCoord - 0.5; if (dot(q, q) > 0.25) discard; frag = vec4(vC.rgb * vC.a, vC.a * (1.0 - vAdd)); }`;
