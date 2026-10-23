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
uniform vec3 uPointPos[4]; uniform vec3 uPointCol[4]; uniform float uPointDist[4];
uniform float uShadowOn; uniform float uShadowBias; uniform float uUnlit;
out vec4 frag;
void main() {
  vec4 albedo = vColor * texture(uTex, vUv);
  if (uUnlit > 0.5) { frag = albedo; return; }
  vec3 n = normalize(vN);
  float sh = 1.0;
  if (uShadowOn > 0.5) {
    vec3 sc = vShadow.xyz / vShadow.w * 0.5 + 0.5;
    if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z <= 1.0) {
      float d = texture(uShadow, sc.xy).r;
      sh = (sc.z + uShadowBias) > d ? 0.0 : 1.0;
    }
  }
  vec3 irr = uSunCol * max(dot(n, uSunDir), 0.0) * sh;
  irr += mix(uHemiGround, uHemiSky, 0.5 * n.y + 0.5);
  for (int i = 0; i < 4; i++) {
    vec3 L = uPointPos[i] - vWorld; float d = length(L);
    float cut = pow(clamp(1.0 - pow(d / uPointDist[i], 4.0), 0.0, 1.0), 2.0);
    irr += uPointCol[i] * cut / max(d * d, 0.01) * max(dot(n, L / d), 0.0);
  }
  frag = vec4(albedo.rgb * irr / 3.14159265 + vEmis, albedo.a);
}`;

export const SHADOW_VS = `#version 300 es
${INSTANCE_IN}
uniform mat4 uLightVP;
void main() { gl_Position = uLightVP * (mat4(iM0, iM1, iM2, iM3) * vec4(aPos, 1.0)); }`;

export const SHADOW_FS = `#version 300 es
precision mediump float;
void main() {}`;

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
layout(location=0) in vec3 aPos; layout(location=1) in float aLife; layout(location=2) in float aSize;
uniform mat4 uViewProj; uniform float uTpu; out float vA;
void main() { vA = aLife; gl_PointSize = max(1.0, aSize * (1.6 - aLife) * uTpu); gl_Position = uViewProj * vec4(aPos, 1.0); }`;

export const DUST_FS = `#version 300 es
precision mediump float;
uniform vec3 uColor; in float vA; out vec4 frag;
void main() { if (vA <= 0.0) discard; frag = vec4(uColor, vA * 0.55); }`;
