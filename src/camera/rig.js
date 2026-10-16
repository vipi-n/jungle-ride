import * as THREE from 'three';

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Animated camera moves that travel on a sphere around the moving target, so the
// camera sweeps around the car instead of cutting through it.
export class CameraRig {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.flight = null;
    this.limits = { min: controls.minDistance, max: controls.maxDistance };
  }

  get busy() {
    return !!this.flight;
  }

  flyTo(position, target, { duration = 1.8, lift = 0.25, limits = null, onDone = null } = {}) {
    const c = this.controls;
    const fromTarget = c.target.clone();
    const toTarget = new THREE.Vector3(...target);
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(fromTarget));
    const to = new THREE.Spherical().setFromVector3(new THREE.Vector3(...position).sub(toTarget));
    let dTheta = to.theta - from.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    this.flight = { t: 0, duration, from, to, dTheta, fromTarget, toTarget, lift, limits, onDone };
    this.clearInertia();
    c.enabled = false;
    c.minDistance = 0.01;
    c.maxDistance = 100;
  }

  clearInertia() {
    const c = this.controls;
    c._sphericalDelta?.set(0, 0, 0);
    c._panOffset?.set(0, 0, 0);
  }

  cancel() {
    if (!this.flight) return;
    this.finish();
  }

  // Carry an in-progress flight along with a moving, turning car.
  shift(from, to, dYaw) {
    const f = this.flight;
    if (!f) return;
    for (const p of [f.fromTarget, f.toTarget]) {
      p.x -= from.x;
      p.z -= from.z;
      const c = Math.cos(dYaw);
      const s = Math.sin(dYaw);
      const x = p.x * c + p.z * s;
      const z = -p.x * s + p.z * c;
      p.x = x + to.x;
      p.z = z + to.z;
    }
    f.from.theta += dYaw;
    f.to.theta += dYaw;
  }

  finish() {
    const f = this.flight;
    this.flight = null;
    const c = this.controls;
    c.enabled = true;
    const l = f.limits || this.limits;
    c.minDistance = l.min;
    c.maxDistance = l.max;
    this.clearInertia();
    if (f.onDone) f.onDone();
  }

  update(dt) {
    const f = this.flight;
    if (!f) return;
    f.t = Math.min(1, f.t + dt / f.duration);
    const e = easeInOut(f.t);
    const target = f.fromTarget.clone().lerp(f.toTarget, e);
    const radius = THREE.MathUtils.lerp(f.from.radius, f.to.radius, e) * (1 + Math.sin(Math.PI * e) * f.lift * Math.min(1, Math.abs(f.dTheta) / 1.5));
    const phi = THREE.MathUtils.lerp(f.from.phi, f.to.phi, e);
    const theta = f.from.theta + f.dTheta * e;
    const off = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, theta));
    this.camera.position.copy(target).add(off);
    this.controls.target.copy(target);
    this.camera.lookAt(target);
    if (f.t >= 1) this.finish();
  }
}
