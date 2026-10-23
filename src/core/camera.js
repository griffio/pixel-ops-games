import { Vec3, Mat4, clamp, lerp } from './math.js';

const UP = new Vec3(0, 1, 0);

// Orthographic RTS camera in pure math. Zoom is "screen pixels per texel"
// (owned by the pixel settings object); the frustum is derived from the
// visible world size so one texel always covers 1/texelsPerUnit world units.
// Back ends read `view`, `proj`, `viewProj` and `eye`.
export class RtsCamera {
  constructor(pixel, bounds) {
    this.pixel = pixel; this.bounds = bounds;
    this.near = -200; this.far = 400;
    this.target = new Vec3(); this.eye = new Vec3();
    this.yaw = Math.PI * 0.25; this.yawT = this.yaw;
    this.pitch = 0.95; this.pitchT = this.pitch;
    // zoom > 1: screen pixels per texel. zoom < 1: strategic zoom, texel density itself drops.
    this.zoomT = pixel.pixelScale; this.zoom = this.zoomT; this.minZoom = 0.25; this.maxZoom = 12; this.baseTpu = pixel.texelsPerUnit;
    this.follow = null; this.keys = new Set(); this.edgePan = true; this.heightAt = null;
    this.mouse = new Vec3(-1, -1, 0);
    this.world = Mat4.create(); this.view = Mat4.create(); this.proj = Mat4.create();
    this.viewProj = Mat4.create(); this.invViewProj = Mat4.create();
    this.viewW = 1; this.viewH = 1;
    this.reset();
  }

  reset() { this.target.set(28, 0, 22); this.yawT = Math.PI * 0.25; this.pitchT = 0.95; this.zoomT = 3; this.follow = null; }
  zoomBy(f) { this.zoomT = clamp(this.zoomT * f, this.minZoom, this.maxZoom); }
  rotateBy(dyaw, dpitch) { this.yawT += dyaw; this.pitchT = clamp(this.pitchT + dpitch, 0.55, 1.35); }

  groundAxes() {
    return { right: new Vec3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), fwd: new Vec3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)) };
  }
  panBy(dx, dz) {
    const { right, fwd } = this.groundAxes();
    this.target.addScaledVector(right, dx).addScaledVector(fwd, dz); this.follow = null;
  }

  update(dt, screenW, screenH) {
    const k = 1 - Math.pow(0.001, dt);
    this.yaw = lerp(this.yaw, this.yawT, k);
    this.pitch = lerp(this.pitch, this.pitchT, k);
    this.zoom = lerp(this.zoom, this.zoomT, k);
    this.pixel.pixelScale = Math.max(1, this.zoom);
    this.pixel.texelsPerUnit = this.baseTpu * Math.min(1, this.zoom);

    const [viewW, viewH] = this.pixel.viewSize(screenW, screenH);
    this.viewW = viewW; this.viewH = viewH;
    const speed = viewH * 0.9;
    let px = 0, pz = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) px -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) px += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) pz += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) pz -= 1;
    if (this.edgePan && this.mouse.x >= 0) {
      const m = 0.012;
      if (this.mouse.x < m) px -= 1; if (this.mouse.x > 1 - m) px += 1;
      if (this.mouse.y < m) pz += 1; if (this.mouse.y > 1 - m) pz -= 1;
    }
    if (px || pz) this.panBy(px * speed * dt, pz * speed * dt);
    if (this.keys.has('KeyQ')) this.yawT += 1.6 * dt;
    if (this.keys.has('KeyE')) this.yawT -= 1.6 * dt;
    if (this.follow) { const p = this.follow.pos; this.target.x = lerp(this.target.x, p.x, k); this.target.z = lerp(this.target.z, p.z, k); }
    const b = this.bounds;
    this.target.x = clamp(this.target.x, -b, b); this.target.z = clamp(this.target.z, -b, b);
    this.target.y = this.heightAt ? this.heightAt(this.target.x, this.target.z) : 0;

    Mat4.ortho(this.proj, -viewW / 2, viewW / 2, viewH / 2, -viewH / 2, this.near, this.far);
    const dist = 120;
    const dir = new Vec3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.eye.copy(this.target).addScaledVector(dir, dist);
    Mat4.cameraWorld(this.world, this.eye, this.target, UP);

    // snap the camera to the texel grid in its own right/up axes so static geometry doesn't shimmer while panning
    if (this.pixel.enabled) {
      const texel = 1 / this.pixel.texelsPerUnit;
      const right = Mat4.column(this.world, 0), up = Mat4.column(this.world, 1);
      const ox = this.eye.dot(right), oy = this.eye.dot(up);
      const sx = Math.round(ox / texel) * texel - ox, sy = Math.round(oy / texel) * texel - oy;
      this.eye.addScaledVector(right, sx).addScaledVector(up, sy);
      this.world[12] = this.eye.x; this.world[13] = this.eye.y; this.world[14] = this.eye.z;
    }
    Mat4.invert(this.view, this.world);
    Mat4.multiply(this.viewProj, this.proj, this.view);
    Mat4.invert(this.invViewProj, this.viewProj);
  }

  // screen (0..1) -> point on the terrain (iterates against the height under the hit)
  screenToGround(nx, ny) {
    const p0 = Mat4.transformPoint(this.invViewProj, new Vec3(nx * 2 - 1, -(ny * 2 - 1), 0));
    const d = Mat4.column(this.world, 2).multiplyScalar(-1); // camera looks down its -z
    let h = 0, p = p0.clone().addScaledVector(d, -p0.y / d.y);
    if (this.heightAt) for (let i = 0; i < 4; i++) { h = this.heightAt(p.x, p.z); p = p0.clone().addScaledVector(d, (h - p0.y) / d.y); }
    return p;
  }

  worldToScreen(x, y, z, screenW, screenH) {
    const p = Mat4.transformPoint(this.viewProj, new Vec3(x, y, z));
    return [(p.x + 1) / 2 * screenW, (1 - p.y) / 2 * screenH, p.z];
  }
}
