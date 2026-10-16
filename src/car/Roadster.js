import * as THREE from 'three';
import { buildBody } from './bodyGeometry.js';
import { createMaterials, applyPaint } from './materials.js';
import { createWheel } from './wheel.js';
import { buildDetails } from './details.js';
import { buildInterior } from './interior.js';
import { buildPanelLines } from './panelLines.js';
import { WHEELS } from './bodyData.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// Wing poses per aero mode. pitch < 0 lifts the trailing edge.
const AERO = {
  road: { lift: 0, pitch: 0, ext: 0, plate: 0, ride: 0, fans: 0.15 },
  downforce: { lift: 0.32, pitch: -0.34, ext: 1, plate: 1, ride: 1, fans: 1 },
  lowdrag: { lift: 0.07, pitch: 0.03, ext: 1, plate: 0.55, ride: 1, fans: 0.55 },
};

export class Roadster {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'roadster';
    this.chassis = new THREE.Group();
    this.root.add(this.chassis);
    this.mats = createMaterials();
    this.body = buildBody();

    const shell = new THREE.Mesh(this.body.shell, this.mats.body);
    shell.castShadow = true;
    shell.receiveShadow = true;
    this.chassis.add(shell);
    this.shell = shell;

    this.buildDoors();
    this.buildWheels();
    this.parts = buildDetails(this);
    this.panelLines = buildPanelLines(this);
    this.interior = buildInterior(this);
    this.chassis.add(this.interior.group);

    this.root.traverse((o) => o.layers.enable(1));

    this.headlamps = [];
    for (const side of [1, -1]) {
      const lamp = new THREE.SpotLight(0xeef3ff, 0, 40, 0.42, 0.65, 1.6);
      lamp.position.set(2.1, 0.52, 0.42 * side);
      lamp.target.position.set(9, -0.6, 0.9 * side);
      this.chassis.add(lamp, lamp.target);
      this.headlamps.push(lamp);
    }
    this.headlampScale = 0.4;
    this.trim = 'thrust';
    this.flying = false;
    this.bodyPitch = 0;
    this.bodyRoll = 0;

    this.state = {
      door: { from: 0, to: 0, t: 1, dur: 2.1, value: 0 },
      aero: { mode: 'road', cur: { ...AERO.road } },
      lights: { on: true, level: 0, sweep: 0 },
      thrust: 0,
      thrustTarget: 0,
      wheelSpeed: 0,
      wheelSpeedTarget: 0,
      steer: 0,
      steerTarget: 0,
      fanAngle: 0,
      time: 0,
    };
    this.setLights(true, true);
    this.setTrim(this.trim);
  }

  buildDoors() {
    const info = this.body.doorInfo;
    const pivot = new THREE.Vector3(info.tip.x - 0.06, info.tip.y - 0.02, info.tip.z - 0.03);
    this.doors = [];
    for (const side of [1, -1]) {
      const hinge = new THREE.Group();
      hinge.position.set(pivot.x, pivot.y, pivot.z * side);
      const lift = new THREE.Group();
      hinge.add(lift);
      const holder = new THREE.Group();
      if (side < 0) holder.scale.z = -1;
      const mesh = new THREE.Mesh(this.body.door, this.mats.body);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(-pivot.x, -pivot.y, -pivot.z);
      holder.add(mesh);
      lift.add(holder);
      this.chassis.add(hinge);
      this.doors.push({ side, hinge, lift, mesh });
    }
  }

  buildWheels() {
    this.wheels = [];
    this.wheelRoot = new THREE.Group();
    this.root.add(this.wheelRoot);
    for (const [key, spec] of Object.entries(WHEELS)) {
      for (const side of [1, -1]) {
        const w = createWheel(this.mats, spec);
        w.steer.position.set(spec.x, spec.radius, spec.z * side);
        const turn = new THREE.Group();
        turn.position.copy(w.steer.position);
        w.steer.position.set(0, 0, 0);
        if (side < 0) w.steer.rotation.y = Math.PI;
        turn.add(w.steer);
        this.wheelRoot.add(turn);
        this.wheels.push({ ...w, turn, side, front: key === 'front', radius: spec.radius });
      }
    }
  }

  // ---------------------------------------------------------------- controls
  get doorsOpen() {
    return this.state.door.to > 0.5;
  }

  setDoors(open) {
    const d = this.state.door;
    const target = open ? 1 : 0;
    if (d.to === target) return;
    d.from = d.value;
    d.to = target;
    d.t = 0;
    d.dur = 2.1 * Math.abs(d.to - d.from) + 0.2;
  }

  toggleDoors() {
    this.setDoors(!this.doorsOpen);
  }

  setAero(mode) {
    if (!AERO[mode]) return;
    this.state.aero.mode = mode;
  }

  setLights(on, instant = false) {
    const l = this.state.lights;
    l.on = on;
    if (on) l.sweep = instant ? 1 : 0;
    if (instant) l.level = on ? 1 : 0;
  }

  setPaint(name) {
    applyPaint(this.mats.paint, name);
  }

  setTrim(trim) {
    this.trim = trim;
    this.interior.seats[1].visible = trim !== 'rocket';
    this.updateThrusterVisibility();
  }

  // Rear nozzles are a Thrust/Rocket feature and the perimeter ports a Rocket one,
  // but every trim shows them while they are actually firing.
  updateThrusterVisibility() {
    const nozzles = this.trim !== 'performance' || this.state.thrust > 0.004 || this.state.thrustTarget > 0;
    const ports = this.trim === 'rocket' || this.flying;
    for (const n of this.parts.nozzles) n.visible = nozzles;
    for (const p of this.parts.ports) p.group.visible = ports;
  }

  setThrust(v) {
    this.state.thrustTarget = v;
  }

  setDrive(speed) {
    this.state.wheelSpeedTarget = speed;
  }

  setSteer(v) {
    this.state.steerTarget = v;
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const s = this.state;
    s.time += dt;

    // doors: eased tween, slight overshoot settle
    const d = s.door;
    if (d.t < 1) {
      d.t = clamp01(d.t + dt / d.dur);
      d.value = d.from + (d.to - d.from) * ease(d.t);
    }
    this.poseDoors(d.value);

    // aero: each channel eases at its own pace so the wing unfolds in sequence
    const tgt = AERO[s.aero.mode];
    const cur = s.aero.cur;
    const rising = tgt.lift >= cur.lift;
    const k = (rate) => 1 - Math.exp(-rate * dt);
    cur.lift += (tgt.lift - cur.lift) * k(rising ? 3.2 : 2.2 * (cur.ext < 0.2 ? 1.4 : 0.6));
    cur.ext += (tgt.ext - cur.ext) * k(rising ? (cur.lift > 0.03 || tgt.lift < 0.1 ? 3 : 0.8) : 3.5);
    cur.plate += (tgt.plate - cur.plate) * k(cur.ext > 0.7 || tgt.plate < cur.plate ? 4 : 0.6);
    cur.pitch += (tgt.pitch - cur.pitch) * k(2.4);
    cur.ride += (tgt.ride - cur.ride) * k(1.8);
    cur.fans += (tgt.fans - cur.fans) * k(1.5);
    this.poseWing(cur);
    this.chassis.position.y = -0.03 * cur.ride;
    this.chassis.rotation.z = 0.012 * s.thrust + this.bodyPitch;
    this.chassis.rotation.x = this.bodyRoll;

    // lights
    const l = s.lights;
    l.level += ((l.on ? 1 : 0) - l.level) * k(l.on ? 5 : 8);
    if (l.on && l.sweep < 1) l.sweep = clamp01(l.sweep + dt / 1.1);
    const sw = ease(l.sweep);
    const flick = l.sweep < 1 ? 0.75 + 0.25 * Math.sin(s.time * 60) * (1 - sw) : 1;
    this.mats.lightFront.emissiveIntensity = 7 * l.level * sw * flick;
    this.parts.frontBar.scale.z = Math.max(0.02, l.on ? sw : 1);
    this.mats.lightRear.emissiveIntensity = 6 * l.level * clamp01(sw * 1.4);
    this.mats.lightAmber.emissiveIntensity = 3.5 * l.level * sw;
    for (const lamp of this.headlamps) lamp.intensity = 60 * this.headlampScale * l.level * sw;

    // thrusters
    s.thrust += (s.thrustTarget - s.thrust) * k(s.thrustTarget > s.thrust ? 9 : 3);
    this.updateThrusterVisibility();
    const glow = s.thrust * (0.85 + 0.15 * Math.sin(s.time * 47));
    this.parts.nozzleGlowMat.color.setRGB(0.55 * glow * 7, 0.8 * glow * 7, 1.0 * glow * 7);

    // fans in the diffuser
    s.fanAngle += dt * (4 + cur.fans * 70 + s.thrust * 20);
    for (const f of this.parts.fans) f.rotation.x = s.fanAngle;

    // wheels
    s.wheelSpeed += (s.wheelSpeedTarget - s.wheelSpeed) * k(1.2);
    s.steer += (s.steerTarget - s.steer) * k(3);
    for (const w of this.wheels) {
      w.spin.rotation.z -= (s.wheelSpeed / w.radius) * dt * w.side;
      if (w.front) w.turn.rotation.y = s.steer * 0.42;
    }
    if (this.interior.yoke) this.interior.yoke.rotation.x = -s.steer * 0.9;
  }

  poseDoors(t) {
    const lift = ease(clamp01(t * 1.08));
    const tilt = ease(clamp01((t - 0.1) / 0.9));
    for (const d of this.doors) {
      d.lift.rotation.set(0, 0, -1.28 * lift);
      d.hinge.rotation.set(0.36 * tilt * d.side, 0.62 * tilt * d.side, 0);
    }
  }

  poseWing(c) {
    const w = this.parts.wing;
    w.lift.position.y = c.lift;
    w.pitch.rotation.z = c.pitch;
    for (const s of w.struts) {
      s.scale.y = Math.max(0.0001, c.lift + 0.02);
      s.visible = c.lift > 0.004;
    }
    for (const e of w.exts) {
      const side = e.userData.side;
      e.position.z = side * 0.38 * c.ext;
      const folded = side * Math.PI * 0.5;
      const vertical = 0;
      const angled = -side * 0.75;
      let rot;
      if (c.plate <= 0.55) rot = THREE.MathUtils.lerp(folded, angled, c.plate / 0.55);
      else rot = THREE.MathUtils.lerp(angled, vertical, (c.plate - 0.55) / 0.45);
      e.userData.hinge.rotation.x = rot;
      e.visible = c.ext > 0.01;
    }
  }
}
