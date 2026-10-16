import { WHEELS } from '../car/bodyData.js';

const WHEELBASE = WHEELS.front.x - WHEELS.rear.x;
const MAX_WHEEL = 0.42; // matches the front-wheel visual lock in Roadster.update
const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'boost',
};

const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// Arcade-tuned bicycle model. Heading 0 faces +x; heading grows to the left
// (forward vector = (cos h, 0, -sin h)), matching car.root.rotation.y.
export class FreeDrive {
  constructor() {
    this.active = false;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.wheelAngle = 0;
    this.yawRate = 0;
    this.accel = 0;
    this.lateral = 0;
    this.held = { up: false, down: false, left: false, right: false, boost: false };
    this.touch = { up: false, down: false, left: false, right: false, boost: false };
  }

  static handles(code) {
    return code in KEYMAP;
  }

  key(code, down) {
    const k = KEYMAP[code];
    if (!k) return false;
    this.held[k] = down;
    return true;
  }

  releaseAll() {
    for (const k of Object.keys(this.held)) this.held[k] = false;
    for (const k of Object.keys(this.touch)) this.touch[k] = false;
  }

  input(name) {
    return this.active && (this.held[name] || this.touch[name]);
  }

  get boosting() {
    return this.input('boost');
  }

  reset() {
    this.x = this.z = this.heading = 0;
    this.speed = this.steer = this.wheelAngle = this.yawRate = this.accel = this.lateral = 0;
    this.releaseAll();
  }

  update(dt, { flying = false, thrust = 0 } = {}) {
    const up = this.input('up');
    const down = this.input('down');
    const steerIn = (this.input('left') ? 1 : 0) - (this.input('right') ? 1 : 0);
    this.steer = approach(this.steer, steerIn, steerIn === 0 ? 7 : 3.6, dt);

    const v = this.speed;
    const vmax = this.boosting || thrust > 0.3 ? 112 : 86;
    let a = 0;
    if (up) a += v < -0.3 ? 26 : 15.5 * Math.max(0, 1 - Math.max(0, v) / vmax) + 0.6;
    if (down) {
      if (v > 0.3) a -= 26;
      else a -= v > -13 ? 8 : 0;
    }
    if (!this.active && Math.abs(v) > 0.05) a -= Math.sign(v) * 12;
    a += 30 * thrust * (v >= -0.5 ? 1 : 0);
    // rolling + aero drag, and EV regen when coasting
    const drag = (flying ? 0.15 : 0.4) + 0.00034 * v * v;
    const regen = !up && !down ? (flying ? 0.5 : 1.1) : 0;
    const resist = Math.sign(v) * (drag + regen);
    let nv = v + (a - resist) * dt;
    if (Math.sign(nv) !== Math.sign(v) && !up && !down && v !== 0) nv = 0;
    if (Math.abs(nv) < 0.02 && !up && !down) nv = 0;
    this.speed = nv;

    // steering: lock shrinks with speed so high-speed turns stay sane
    const sv = Math.abs(nv);
    const lock = MAX_WHEEL / (1 + Math.pow(sv / 17, 2) * 0.9);
    this.wheelAngle = lock * this.steer;
    let yawRate = (nv * Math.tan(this.wheelAngle)) / WHEELBASE;
    if (flying) yawRate = this.steer * 1.25 + yawRate * 0.3;
    this.yawRate = yawRate;
    this.heading += yawRate * dt;
    this.x += Math.cos(this.heading) * nv * dt;
    this.z -= Math.sin(this.heading) * nv * dt;

    this.accel = approach(this.accel, (nv - v) / Math.max(dt, 1e-4), 6, dt);
    this.lateral = approach(this.lateral, nv * yawRate, 6, dt);
  }

  // Body attitude from the load transfer: squat under power, roll out of corners.
  get pitch() {
    return Math.max(-0.035, Math.min(0.035, this.accel * 0.0016));
  }

  get roll() {
    return Math.max(-0.05, Math.min(0.05, this.lateral * 0.0024));
  }
}
