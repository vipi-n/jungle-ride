import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Roadster } from './car/Roadster.js';
import { PAINTS } from './car/materials.js';
import { createStudio } from './env/studio.js';
import { createSaltFlat } from './env/saltflat.js';
import { createNight } from './env/night.js';
import { ContactShadow } from './fx/contactShadow.js';
import { Plumes } from './fx/plumes.js';
import { Smoke } from './fx/smoke.js';
import { CameraRig } from './camera/rig.js';
import { FreeDrive } from './drive/freeDrive.js';
import { createAudio } from './audio/index.js';
import { createUI } from './ui/ui.js';
import { CAMERAS, HOTSPOTS, AERO_MODES, ENVIRONMENTS, TRIMS } from './ui/content.js';
import { QUALITY, MOBILE } from './quality.js';
import './style.css';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');

// ------------------------------------------------------------------ renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
let pixelRatio = Math.min(window.devicePixelRatio, QUALITY.maxPixelRatio);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;

const scene = new THREE.Scene();
const BASE_FOV = 32;
// the camera presets are framed for 16:10; narrower screens widen the lens so the
// car still fits across (portrait phones end up near 78°)
const REF_ASPECT = 1.6;
function baseFov(aspect) {
  if (aspect >= REF_ASPECT) return BASE_FOV;
  const t = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * Math.pow(REF_ASPECT / aspect, 0.85);
  return Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan(t)));
}
const camera = new THREE.PerspectiveCamera(baseFov(window.innerWidth / window.innerHeight), window.innerWidth / window.innerHeight, 0.03, 5000);
camera.position.set(6.2, 1.7, 5.6);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.55, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.screenSpacePanning = true;
controls.minDistance = 2.2;
controls.maxDistance = 16;
controls.minPolarAngle = 0.02;
controls.autoRotateSpeed = 0.55;
const DEFAULT_LIMITS = { min: 2.2, max: 16 };
const DRIVE_LIMITS = { min: 2.2, max: 24 };
const POLAR_ABOVE = Math.PI / 2 - 0.035;
const POLAR_UNDER = Math.PI * 0.94;
const rig = new CameraRig(camera, controls);

// ------------------------------------------------------------------ car + fx
const car = new Roadster();
scene.add(car.root);
const contact = new ContactShadow(renderer);
scene.add(contact.group);
const glow = new Plumes({ max: 2400, additive: true });
const vapor = new Plumes({ max: 3200, additive: false });
// lift-off smoke: columns under the car that billow out across the ground
const smoke = new Smoke({ max: MOBILE ? 560 : 1000 });
const SMOKE_RATE = MOBILE ? 26 : 50;
let smokeCarry = 0;
scene.add(glow.points, vapor.points, smoke.mesh);
const drive = new FreeDrive();
const audio = createAudio();

const size = new THREE.Vector2();
renderer.getDrawingBufferSize(size);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: QUALITY.samples }));
composer.addPass(new RenderPass(scene, camera));
// Point-light glints on glass reach hundreds of units; cap them so bloom stays soft.
composer.addPass(
  new ShaderPass({
    uniforms: { tDiffuse: { value: null }, maxLum: { value: 5 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float maxLum;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        c.rgb *= min(1.0, maxLum / max(l, 1e-4));
        gl_FragColor = c;
      }`,
  }),
);
const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.4, 1.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ------------------------------------------------------------------ environments
const builders = { studio: createStudio, salt: createSaltFlat, night: createNight };
const envs = {};
let env = null;

function applyEnv(name) {
  if (!envs[name]) envs[name] = builders[name](renderer);
  if (env) scene.remove(env.group);
  env = envs[name];
  scene.add(env.group);
  scene.background = env.background;
  scene.environment = env.environment;
  scene.fog = env.fog;
  renderer.toneMappingExposure = parseFloat(params.get('exp') || env.exposure);
  bloom.strength = env.bloom.strength;
  bloom.radius = env.bloom.radius;
  bloom.threshold = env.bloom.threshold;
  vaporColor.setRGB(0.92, 0.95, 1.0).multiplyScalar(env.vapor);
  smoke.material.uniforms.color.value.setRGB(0.92, 0.95, 1.0).multiplyScalar(env.smoke);
  smoke.material.uniforms.density.value = env.smokeDensity ?? 1;
  env.track(car.root.position.x, car.root.position.z, drive.heading, car.state.lights.level);
  state.env = name;
  audio.setEnv(name);
}

// ------------------------------------------------------------------ app state
const state = {
  env: 'studio',
  cam: '34',
  aero: 'road',
  paint: 'Ano White',
  trim: 'thrust',
  doors: false,
  lights: true,
  thrusting: false,
  hovering: false,
  driving: false,
  spin: !SHOT,
  hotspots: true,
  // Free Drive and the underside view are opt-in every visit
  settings: { ...audio.prefs, freeDrive: false, underside: false },
};

const seq = {
  thrust: null,
  hover: null,
  intro: null,
};

const allowUnder = () => state.settings.underside;

// car-local preset → world, following the car's position and heading
const presetToWorld = (arr, out = new THREE.Vector3()) => {
  const c = Math.cos(drive.heading);
  const s = Math.sin(drive.heading);
  return out.set(car.root.position.x + arr[0] * c + arr[2] * s, arr[1], car.root.position.z - arr[0] * s + arr[2] * c);
};

const app = {
  setEnv(name, then) {
    if (name === state.env || !builders[name]) return;
    audio.envSwitch();
    const toStudio = name === 'studio';
    if (toStudio && state.settings.freeDrive) app.setSetting('freeDrive', false, { quiet: true });
    ui.veil(() => {
      if (toStudio) parkAtOrigin();
      applyEnv(name);
      if (name === 'night' && !state.lights) app.action('lights');
      sync();
      then?.();
    });
    ui.caption(ENVIRONMENTS[name], name === 'salt' ? 'Golden hour on the salt flats' : name === 'night' ? 'Lights on' : 'Reveal studio', 2.4);
  },
  setCam(name, opts = {}) {
    const c = CAMERAS[name];
    if (!c) return;
    if (name === 'under' && !allowUnder()) return;
    const wasInterior = CAMERAS[state.cam]?.interior;
    state.cam = name;
    idleTimer = -4;
    const lift = c.interior ? 0 : car.root.position.y * 0.7;
    const target = presetToWorld(c.target);
    const pos = presetToWorld(c.pos);
    target.y += lift;
    pos.y += lift;
    const duration = opts.duration ?? (c.interior || wasInterior ? 2.2 : 1.9);
    rig.flyTo(pos.toArray(), target.toArray(), {
      duration,
      lift: c.interior ? 0 : 0.22,
      limits: c.limits || (state.settings.freeDrive ? DRIVE_LIMITS : DEFAULT_LIMITS),
    });
    if (!opts.silent) audio.camera(duration);
    sync();
  },
  setAero(mode) {
    if (!AERO_MODES[mode]) return;
    if (mode !== state.aero) audio.aero(mode);
    state.aero = mode;
    car.setAero(mode);
    ui.caption(AERO_MODES[mode].caption, AERO_MODES[mode].sub);
    sync();
  },
  setPaint(name) {
    state.paint = name;
    car.setPaint(name);
    sync();
  },
  setTrim(t) {
    if (!TRIMS[t]) return;
    state.trim = t;
    car.setTrim(t);
    sync();
  },
  setSetting(key, value, { quiet = false } = {}) {
    const st = state.settings;
    if (st[key] === value) return;
    st[key] = value;
    if (key === 'music') audio.setMusic(value);
    else if (key === 'musicVolume') audio.setMusicVolume(value);
    else if (key === 'sfx') audio.setSfx(value);
    else if (key === 'sfxVolume') audio.setSfxVolume(value);
    else if (key === 'underside') setUnderside(value, quiet);
    else if (key === 'freeDrive') setFreeDrive(value, quiet);
    sync();
  },
  touchDrive(k, v) {
    drive.touch[k] = v;
  },
  nextCam() {
    const order = camCycle();
    app.setCam(order[(order.indexOf(state.cam) + 1) % order.length]);
  },
  action(a) {
    switch (a) {
      case 'doors':
        if (state.hovering) return;
        if (state.settings.freeDrive && Math.abs(drive.speed) > 2) {
          ui.caption('Doors', 'Stop the car to open the doors', 2);
          return;
        }
        car.toggleDoors();
        state.doors = car.doorsOpen;
        audio.door(state.doors, car.state.door.dur);
        break;
      case 'lights':
        state.lights = !state.lights;
        car.setLights(state.lights);
        audio.lights(state.lights);
        break;
      case 'thrust':
        fireThrust();
        break;
      case 'hover':
        if (seq.hover?.free) landFree();
        else startHover();
        break;
      case 'drive':
        if (state.settings.freeDrive) return;
        state.driving = !state.driving;
        car.setDrive(state.driving ? 24 : 0);
        ui.caption(state.driving ? 'Drive' : 'Park', state.driving ? '86 km/h · steer-by-wire' : '', 1.8);
        break;
      case 'freedrive':
        app.setSetting('freeDrive', !state.settings.freeDrive);
        return;
      case 'underside':
        app.setSetting('underside', !state.settings.underside);
        return;
      case 'spin':
        state.spin = !state.spin;
        break;
      case 'hotspots':
        state.hotspots = !state.hotspots;
        if (!state.hotspots) ui.closeInfo();
        break;
      case 'hide':
        ui.setHidden(true);
        break;
    }
    sync();
  },
  hotspotAction(a) {
    if (a === 'aero') {
      const order = ['road', 'downforce', 'lowdrag'];
      app.setAero(order[(order.indexOf(state.aero) + 1) % order.length]);
    } else if (a === 'downforce') app.setAero(state.aero === 'downforce' ? 'road' : 'downforce');
    else app.action(a);
  },
};

const ui = createUI(app);
function sync() {
  ui.sync(state);
}

// ------------------------------------------------------------------ settings
function setUnderside(on, quiet) {
  controls.maxPolarAngle = on ? POLAR_UNDER : POLAR_ABOVE;
  if (!on && (camera.position.y < 0.15 || state.cam === 'under')) app.setCam('34', { silent: true });
  if (!quiet) ui.caption('Underside view', on ? 'The camera can now go below the car' : 'Camera stays above the ground', 2.2);
}

function setFreeDrive(on, quiet) {
  if (on) {
    if (state.driving) {
      state.driving = false;
      car.setDrive(0);
    }
    if (car.doorsOpen) {
      car.setDoors(false);
      state.doors = false;
      audio.door(false, car.state.door.dur);
    }
    const begin = () => {
      drive.active = true;
      ui.toggleSettings(false);
      app.setCam('chase', { duration: 1.6 });
      let how = 'W A S D or arrow keys · Space to boost · F to fly';
      if (matchMedia('(pointer: coarse)').matches) how = innerHeight > innerWidth ? 'Turn your phone sideways for the best view' : 'Steer on the left · pedals on the right';
      ui.caption('Free Drive', how, 5);
    };
    if (state.env === 'studio') app.setEnv('salt', begin);
    else begin();
  } else {
    drive.active = false;
    drive.releaseAll();
    if (seq.hover?.free) landFree();
    if (state.cam === 'chase') state.cam = null;
    if (!quiet) ui.caption('Free Drive off', 'The car rolls to a stop', 2);
  }
  controls.maxDistance = on ? DRIVE_LIMITS.max : DEFAULT_LIMITS.max;
}

function parkAtOrigin() {
  drive.reset();
  seq.hover = null;
  state.hovering = false;
  car.flying = false;
  car.root.position.set(0, 0, 0);
  car.root.rotation.set(0, 0, 0);
  for (const e of Object.values(envs)) e.reset();
  const c = CAMERAS['34'];
  camera.position.set(...c.pos);
  controls.target.set(...c.target);
  state.cam = '34';
}

// ------------------------------------------------------------------ sequences
function fireThrust() {
  if (seq.thrust) return;
  seq.thrust = { t: 0, dur: 2.6, prevSpeed: car.state.wheelSpeedTarget };
  state.thrusting = true;
  car.setThrust(1);
  if (!state.settings.freeDrive) car.setDrive(40);
  audio.thrust();
  ui.caption('Cold-Gas Thrusters', TRIMS[state.trim].specs[0][0] + ' s · 0-60 mph', 2.4);
}

function startHover() {
  if (seq.hover) return;
  if (car.doorsOpen) {
    car.setDoors(false);
    audio.door(false, car.state.door.dur);
  }
  state.doors = false;
  const free = state.settings.freeDrive;
  seq.hover = { t: 0, dur: 9.4, free, landAt: null, baseYaw: drive.heading };
  state.hovering = true;
  car.flying = true;
  audio.liftoff();
  ui.caption('So… yes, it can fly.', free ? 'Steer with A / D · F to land' : 'Perimeter cold-gas thrusters', 3.6);
  sync();
}

function landFree() {
  const hv = seq.hover;
  if (!hv || hv.landAt !== null) return;
  hv.landAt = hv.t;
  ui.caption('Landing', '', 1.6);
}

function endHover() {
  seq.hover = null;
  state.hovering = false;
  car.flying = false;
  car.root.position.y = 0;
  car.root.rotation.set(0, drive.heading, 0);
  car.setThrust(seq.thrust ? 1 : 0);
  audio.touchdown();
  sync();
}

const tmpV = new THREE.Vector3();
const tmpD = new THREE.Vector3();
const glowColor = new THREE.Color(0.55, 0.78, 1.3);
const vaporColor = new THREE.Color(0.92, 0.95, 1.0);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

let boostWas = false;
function updateSequences(dt) {
  // thrust burst: rear nozzles
  const th = seq.thrust;
  if (th) {
    th.t += dt;
    const on = th.t < 1.9;
    if (!on) car.setThrust(drive.boosting ? 1 : 0);
    if (th.t > th.dur) {
      seq.thrust = null;
      state.thrusting = false;
      if (!state.settings.freeDrive) car.setDrive(state.driving ? 24 : th.prevSpeed);
      sync();
    }
  }
  // Free Drive boost (Space) uses the same thrusters
  const boosting = drive.boosting;
  if (boosting !== boostWas) {
    boostWas = boosting;
    if (boosting) audio.boost();
    if (!seq.thrust && !seq.hover) car.setThrust(boosting ? 1 : 0);
  }
  const thrust = car.state.thrust;
  if (thrust > 0.02 && !(seq.hover && !seq.thrust && !boosting)) {
    const q = car.root.quaternion;
    const k = seq.hover ? 0.6 : 1;
    for (const n of car.parts.nozzles) {
      if (!n.visible) continue;
      n.getWorldPosition(tmpV);
      tmpD.set(-1, 0, 0).applyQuaternion(q);
      tmpV.addScaledVector(tmpD, 0.04);
      glow.emit(tmpV, tmpD, Math.ceil(5 * thrust * k), { speed: 9, spread: 0.03, size: 0.034, grow: 0.2, life: 0.2, alpha: 0.42 * thrust, color: glowColor, drag: 1.5 });
      vapor.emit(tmpV, tmpD, Math.ceil(3 * thrust * k), { speed: 7, spread: 0.08, size: 0.07, grow: 0.85, life: 1.2, alpha: 0.14 * thrust, color: vaporColor, drag: 2.2 });
    }
  }

  // hover / flight
  const hv = seq.hover;
  if (hv) {
    hv.t += dt;
    const t = hv.t;
    let rise;
    let power;
    let yaw = 0;
    if (hv.free) {
      const land = hv.landAt === null ? 0 : smooth(hv.landAt, hv.landAt + 2.4, t);
      rise = smooth(0.9, 2.9, t) * (1 - land);
      power = smooth(0.0, 0.8, t) * (0.6 + 0.4 * (1 - smooth(2.9, 3.4, t)) + 0.25 * (hv.landAt === null ? 0 : smooth(hv.landAt, hv.landAt + 0.5, t))) * (hv.landAt === null ? 1 : 1 - smooth(hv.landAt + 2.0, hv.landAt + 2.8, t));
    } else {
      rise = smooth(0.9, 2.9, t) * (1 - smooth(6.6, 8.7, t));
      power = smooth(0.0, 0.8, t) * (1 - smooth(8.4, 9.2, t)) * (0.55 + 0.45 * (1 - smooth(2.9, 3.4, t)) + 0.2 * smooth(6.6, 7.0, t));
      yaw = Math.PI * 2 * smooth(3.0, 6.4, t);
    }
    const height = (hv.free ? 1.35 : 1.05) * rise;
    const bob = Math.sin(t * 2.1) * 0.025 * rise;
    const prevY = car.root.position.y;
    car.root.position.y = height + bob;
    car.root.rotation.y = drive.heading + yaw;
    car.root.rotation.z = Math.sin(t * 1.3) * 0.015 * rise;
    car.root.rotation.x = Math.sin(t * 1.7 + 1) * 0.012 * rise;
    if (!rig.busy) {
      controls.target.y += (car.root.position.y - prevY) * 0.7;
      camera.position.y += (car.root.position.y - prevY) * 0.7;
    }
    car.setThrust(Math.max(power * 0.8, seq.thrust || boosting ? 1 : 0));
    if (power > 0.02) {
      const q = car.root.quaternion;
      smokeCarry += SMOKE_RATE * power * dt;
      const puffs = Math.floor(smokeCarry);
      smokeCarry -= puffs;
      for (const p of car.parts.ports) {
        if (p.dir.y > -0.5) continue;
        tmpV.copy(p.pos);
        car.chassis.localToWorld(tmpV);
        tmpD.copy(p.dir).applyQuaternion(q);
        glow.emit(tmpV, tmpD, Math.ceil(4 * power), { speed: 7, spread: 0.05, size: 0.045, grow: 0.25, life: 0.22, alpha: 0.45 * power, color: glowColor, drag: 1.5 });
        smoke.emit(tmpV, tmpD, puffs, { speed: 4.5, spread: 0.07, size: 0.24, grow: 0.85, life: 2.6, alpha: 0.3 * Math.min(1, power * 1.4), drag: 1.2, radius: 0.05 });
      }
      // perimeter side ports fire short stabilising pulses while yawing
      const yawRate = hv.free ? Math.min(1, Math.abs(drive.yawRate)) : smooth(3.0, 3.6, t) * (1 - smooth(5.8, 6.4, t));
      if (yawRate > 0.05) {
        for (const p of car.parts.ports) {
          if (Math.abs(p.dir.y) > 0.5) continue;
          if (Math.random() > 0.5) continue;
          tmpV.copy(p.pos);
          car.chassis.localToWorld(tmpV);
          tmpD.copy(p.dir).applyQuaternion(q);
          glow.emit(tmpV, tmpD, 2, { speed: 5, spread: 0.05, size: 0.04, grow: 0.2, life: 0.18, alpha: 0.45 * yawRate, color: glowColor });
          vapor.emit(tmpV, tmpD, 1, { speed: 4, spread: 0.12, size: 0.06, grow: 1, life: 0.9, alpha: 0.12 * yawRate, color: vaporColor });
        }
      }
    }
    const done = hv.free ? hv.landAt !== null && t > hv.landAt + 2.9 : t >= hv.dur;
    if (done) endHover();
  }

  // the parked "Drive" demo slides the world back under the car
  const physics = drive.active || drive.speed !== 0;
  const ws = car.state.wheelSpeed;
  if (!physics) env.scroll(ws * dt, drive.heading);

  // dust kicked up by the rear tyres on the salt
  if (Math.abs(ws) > 3 && env?.dust && car.root.position.y < 0.05) {
    const dir = Math.sign(ws);
    const fx = Math.cos(drive.heading) * dir;
    const fz = -Math.sin(drive.heading) * dir;
    for (const w of car.wheels) {
      if (w.front) continue;
      w.turn.getWorldPosition(tmpV);
      tmpV.y = 0.04;
      tmpV.x -= fx * 0.32;
      tmpV.z -= fz * 0.32;
      // dust streams away at ~70% of road speed relative to the car; in free drive the
      // particles live in the world frame, in the parked demo in the car's frame
      const k = physics ? 2.5 : -5.8;
      tmpD.set(fx * k, 0.25, fz * k);
      const a = Math.abs(ws);
      vapor.emit(tmpV, tmpD, Math.ceil(a / 12), { speed: a * 0.12, spread: 0.3, size: 0.18, grow: 1.4, life: 1.4, alpha: (env.name === 'salt' ? 0.16 : 0.06) * Math.min(1, a / 20), color: env.dust, drag: 0.5, radius: 0.2 });
    }
  }
  if (!physics) {
    if (state.driving && !seq.thrust) car.setSteer(Math.sin(performance.now() * 0.00045) * 0.35);
    else car.setSteer(0);
  }
}

// ------------------------------------------------------------------ free drive
const prevPos = new THREE.Vector3();
const camOff = new THREE.Vector3();
function updateDrive(dt) {
  const flying = !!seq.hover && car.root.position.y > 0.1;
  const physics = drive.active || drive.speed !== 0;
  if (!physics) {
    car.bodyPitch += (0 - car.bodyPitch) * 0.1;
    car.bodyRoll += (0 - car.bodyRoll) * 0.1;
    return;
  }
  prevPos.set(drive.x, 0, drive.z);
  const prevHeading = drive.heading;
  drive.update(dt, { flying, thrust: seq.thrust ? car.state.thrust : drive.boosting ? car.state.thrust : 0 });
  const dYaw = drive.heading - prevHeading;
  car.root.position.x = drive.x;
  car.root.position.z = drive.z;
  if (!seq.hover) car.root.rotation.y = drive.heading;
  else if (seq.hover.free) car.root.rotation.y = drive.heading;

  if (flying) car.setDrive(0);
  else {
    car.state.wheelSpeed = drive.speed;
    car.state.wheelSpeedTarget = drive.speed;
  }
  car.setSteer(drive.wheelAngle / 0.42);
  car.bodyPitch = flying ? car.bodyPitch * 0.9 : drive.pitch;
  car.bodyRoll = flying ? -drive.steer * 0.06 : drive.roll;

  // camera rides with the car, keeping its angle relative to the heading
  const to = car.root.position;
  if (rig.busy) rig.shift(prevPos, to, dYaw);
  else {
    for (const p of [camera.position, controls.target]) {
      camOff.set(p.x - prevPos.x, 0, p.z - prevPos.z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, dYaw);
      p.x = to.x + camOff.x;
      p.z = to.z + camOff.z;
    }
  }
}

// speed reads through the lens: a little FOV stretch and road buzz
const shake = new THREE.Vector3();
let fovNow = camera.fov;
function updateLens(dt) {
  const v = Math.abs(car.state.wheelSpeed);
  const moving = state.settings.freeDrive ? v : 0;
  const target = baseFov(camera.aspect) + 7 * Math.min(1, moving / 85) + 3.5 * car.state.thrust * (state.settings.freeDrive ? 1 : 0.4);
  fovNow += (target - fovNow) * (1 - Math.exp(-dt * 3));
  if (Math.abs(camera.fov - fovNow) > 0.01 && !CAMERAS[state.cam]?.interior) {
    camera.fov = fovNow;
    camera.updateProjectionMatrix();
    glow.setViewport(size.y, camera.fov);
    vapor.setViewport(size.y, camera.fov);
  }
  const amp = state.settings.freeDrive && car.root.position.y < 0.05 ? 0.0035 * Math.pow(Math.min(1, v / 85), 2) + 0.004 * car.state.thrust : 0;
  shake.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
}

// ------------------------------------------------------------------ music + sound
function updateAudio(dt) {
  const v = Math.abs(car.state.wheelSpeed);
  let level = 0;
  if (state.driving || v > 4) level = 1;
  if (v > 30) level = 2;
  if (state.hovering) level = 3;
  if (CAMERAS[state.cam]?.interior && v < 1) level = 0;
  audio.setLevel(level);
  audio.update(dt, {
    speed: car.state.wheelSpeed,
    grounded: car.root.position.y < 0.05,
    thrust: car.state.thrust,
    fans: car.state.aero.cur.fans,
    surface: env.surface ?? 1,
  });
  if (state.settings.freeDrive) {
    const kmh = Math.round(Math.abs(drive.speed) * 3.6);
    ui.updateHud({ kmh, gear: drive.speed < -0.2 ? 'R' : drive.speed > 0.2 || drive.input('up') ? 'D' : 'P', boost: car.state.thrust > 0.3 });
  }
}

// ------------------------------------------------------------------ hotspots
const hsData = HOTSPOTS.map((h) => ({ ...h, a: new THREE.Vector3(...h.anchor), n: new THREE.Vector3(...h.normal).normalize() }));
const proj = new THREE.Vector3();
const toCam = new THREE.Vector3();
const nWorld = new THREE.Vector3();
function updateHotspots() {
  if (!state.hotspots || ui.hidden) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const inside = CAMERAS[state.cam]?.interior && !rig.busy;
  const moving = Math.abs(car.state.wheelSpeed) > 1.5;
  const list = [];
  for (const hs of hsData) {
    proj.copy(hs.a);
    car.chassis.localToWorld(proj);
    toCam.copy(camera.position).sub(proj).normalize();
    nWorld.copy(hs.n).applyQuaternion(car.root.quaternion);
    const facing = nWorld.dot(toCam) > 0.12;
    const dist = camera.position.distanceTo(proj);
    proj.project(camera);
    const onScreen = proj.z < 1 && Math.abs(proj.x) < 1 && Math.abs(proj.y) < 1;
    const doorBlocks = hs.id === 'doors' && car.state.door.value > 0.2;
    list.push({
      id: hs.id,
      x: (proj.x * 0.5 + 0.5) * w,
      y: (-proj.y * 0.5 + 0.5) * h,
      visible: facing && onScreen && !inside && dist > 1.2 && !doorBlocks && !seq.hover && !seq.intro && !(state.settings.freeDrive && moving),
    });
  }
  ui.updateHotspots(list);
}

// ------------------------------------------------------------------ input
let idleTimer = 0;
let dragging = false;
controls.addEventListener('start', () => {
  dragging = true;
  idleTimer = 0;
  if (seq.intro && !seq.intro.waiting) seq.intro = null;
});
controls.addEventListener('end', () => {
  dragging = false;
  idleTimer = 0;
});

const raycaster = new THREE.Raycaster();
canvas.addEventListener('dblclick', (e) => {
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(car.root, true)[0];
  if (!hit) return;
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.max(2.4, Math.min(4, camera.position.distanceTo(hit.point)));
  const pos = hit.point.clone().addScaledVector(dir, dist);
  pos.y = Math.max(pos.y, allowUnder() ? -3 : 0.2);
  state.cam = null;
  rig.flyTo(pos.toArray(), hit.point.toArray(), { duration: 1.2, lift: 0, limits: { min: 1.2, max: state.settings.freeDrive ? DRIVE_LIMITS.max : DEFAULT_LIMITS.max } });
  sync();
});

// every UI click gets a soft tick; feature hotspots chime
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('button');
  if (!b || b.closest('#loader')) return;
  if (b.classList.contains('hs')) audio.chime();
  else audio.ui();
});

const envOrder = Object.keys(ENVIRONMENTS);
const paintOrder = Object.keys(PAINTS);
const camCycle = () => ['34', 'front', 'side', 'rear34', 'rear', 'top', 'under', 'cabin', 'chase'].filter((k) => (k !== 'under' || allowUnder()) && (k !== 'chase' || state.settings.freeDrive));
const isField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || isField(e.target)) return;
  audio.unlock();
  if (drive.active && FreeDrive.handles(e.code)) {
    e.preventDefault();
    if (!e.repeat) ui.toggleSettings(false);
    drive.key(e.code, true);
    return;
  }
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === '1') app.setAero('road');
  else if (k === '2') app.setAero('downforce');
  else if (k === '3') app.setAero('lowdrag');
  else if (k === 'd' || k === 'o') app.action('doors');
  else if (k === 'l') app.action('lights');
  else if (k === 't') app.action('thrust');
  else if (k === 'f') app.action('hover');
  else if (k === 'v') app.action('drive');
  else if (k === 'r') app.action('spin');
  else if (k === 'g') app.setSetting('freeDrive', !state.settings.freeDrive);
  else if (k === 'u') app.setSetting('underside', !state.settings.underside);
  else if (k === 'm') app.setSetting('music', !state.settings.music);
  else if (k === 'c') app.nextCam();
  else if (k === 'e') app.setEnv(envOrder[(envOrder.indexOf(state.env) + 1) % envOrder.length]);
  else if (k === 'p') app.setPaint(paintOrder[(paintOrder.indexOf(state.paint) + 1) % paintOrder.length]);
  else if (k === 'h') ui.setHidden(!ui.hidden);
  else if (k === '?' || k === '/') ui.toggleHelp();
  else if (k === 'escape') {
    ui.toggleHelp(false);
    ui.closeInfo();
    ui.toggleSettings(false);
  }
});
window.addEventListener('keyup', (e) => drive.key(e.code, false));
window.addEventListener('blur', () => drive.releaseAll());
window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

// ------------------------------------------------------------------ resize + quality
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // rotating a phone changes the lens at once rather than easing through updateLens
  if (!CAMERAS[state.cam]?.interior) fovNow = camera.fov = baseFov(camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(w, h);
  renderer.getDrawingBufferSize(size);
  glow.setViewport(size.y, camera.fov);
  vapor.setViewport(size.y, camera.fov);
}
window.addEventListener('resize', resize);

let slowFrames = 0;
// sustained slow frames: drop resolution first, then the bloom pass
function adaptQuality(dt) {
  if (SHOT || (pixelRatio <= 1 && !bloom.enabled)) return;
  slowFrames = dt > 1 / 38 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
  if (slowFrames <= 90) return;
  slowFrames = 0;
  if (pixelRatio > 1) {
    pixelRatio = Math.max(1, pixelRatio - 0.5);
    resize();
  } else bloom.enabled = false;
}

// ------------------------------------------------------------------ camera limits + ground
const underLight = new THREE.DirectionalLight(0xdfe6ff, 0);
underLight.position.set(1, -6, 2);
scene.add(underLight);

// With the underside view off the camera never dips below the ground plane,
// whether orbiting, panning, zooming or riding along in Free Drive.
function clampCamera() {
  if (allowUnder()) return;
  if (controls.target.y < 0) controls.target.y = 0;
  if (camera.position.y < 0.12) camera.position.y = 0.12;
}

const camLocal = new THREE.Vector3();
function updateGround() {
  const fade = smooth(-0.32, 0.04, camera.position.y);
  underLight.intensity = (1 - fade) * 1.6;
  // let the canopy read as see-through from the driver's seat
  const local = car.chassis.worldToLocal(camLocal.copy(camera.position));
  const inCabin = Math.abs(local.x) < 1.1 && local.y < 1.1 && local.y > 0.2 && Math.abs(local.z) < 0.85;
  const targetOpacity = inCabin ? 0.45 : 0.93;
  car.mats.glass.opacity += (targetOpacity - car.mats.glass.opacity) * 0.15;
  for (const m of env.groundMats) {
    const base = m.userData.baseOpacity ?? 1;
    const tr = base < 1 || fade < 0.999;
    if (m.transparent !== tr) {
      m.transparent = tr;
      m.needsUpdate = true;
    }
    m.opacity = base * fade;
    m.depthWrite = base >= 1 && fade > 0.5;
  }
  contact.opacity = 0.92 * fade * (1 - smooth(0.2, 1.4, car.root.position.y) * 0.6);
  contact.group.visible = fade > 0.01;
  contact.group.position.set(car.root.position.x, 0.002, car.root.position.z);
  contact.group.rotation.y = car.root.rotation.y;
  car.headlampScale = env.headlamps * (state.settings.freeDrive && env.name === 'night' ? 4 : 1);
  env.track(car.root.position.x, car.root.position.z, drive.heading, car.state.lights.level);
}

// ------------------------------------------------------------------ boot
applyEnv(params.get('env') && builders[params.get('env')] ? params.get('env') : 'studio');
controls.maxPolarAngle = POLAR_ABOVE;
if (params.has('under')) app.setSetting('underside', true, { quiet: true });
if (params.has('trim')) app.setTrim(params.get('trim'));
if (params.has('paint')) app.setPaint(params.get('paint'));
if (params.has('doors')) {
  const v = parseFloat(params.get('doors'));
  Object.assign(car.state.door, { from: v, to: v, value: v, t: 1 });
  state.doors = v > 0.5;
}
if (params.has('aero')) {
  state.aero = params.get('aero');
  car.setAero(state.aero);
  if (SHOT) for (let i = 0; i < 400; i++) car.update(1 / 30);
}
if (params.has('thrust')) car.setThrust(parseFloat(params.get('thrust')));
if (params.has('lights')) {
  state.lights = params.get('lights') !== '0';
  car.setLights(state.lights, true);
}
if (params.has('hover')) {
  seq.hover = { t: parseFloat(params.get('hover')), dur: 9.4, free: false, landAt: null };
  state.hovering = true;
  car.flying = true;
}
if (params.has('drivepos')) {
  // shot helper: place the car somewhere in the world, e.g. drivepos=120,-40,0.6
  const [x, z, h] = params.get('drivepos').split(',').map(Number);
  Object.assign(drive, { x, z, heading: h || 0 });
  car.root.position.set(x, 0, z);
  car.root.rotation.y = h || 0;
}
if (params.has('speed')) {
  car.state.wheelSpeed = car.state.wheelSpeedTarget = parseFloat(params.get('speed'));
  state.driving = true;
}
const startCam = CAMERAS[params.get('cam')] ? params.get('cam') : '34';
state.cam = startCam;
{
  const c = CAMERAS[startCam];
  presetToWorld(c.pos, camera.position);
  presetToWorld(c.target, controls.target);
  if (c.limits) {
    controls.minDistance = c.limits.min;
    controls.maxDistance = c.limits.max;
  }
  if (params.has('pos')) camera.position.fromArray(params.get('pos').split(',').map(Number));
  if (params.has('tgt')) controls.target.fromArray(params.get('tgt').split(',').map(Number));
}
if (SHOT) {
  document.getElementById('loader')?.remove();
  if (params.get('ui') !== '1') ui.setHidden(true);
}

if (!SHOT) {
  // intro: dark car, low sweep from the front, light bar powers on with the music hit
  car.setLights(false, true);
  state.lights = true;
  camera.position.set(9.5, 0.32, -3.2);
  controls.target.set(0.6, 0.3, 0);
  seq.intro = { t: 0, waiting: true };
}
sync();
resize();

if (navigator.webdriver) {
  // hooks for the tools/ scripts
  window.__debug = {
    camY: () => +camera.position.y.toFixed(3),
    drive: () => ({ active: drive.active, x: +drive.x.toFixed(1), z: +drive.z.toFixed(1), kmh: Math.round(drive.speed * 3.6), heading: +drive.heading.toFixed(2), env: state.env }),
    audio: () => JSON.stringify(audio.status),
    smoke: () => smoke.life.reduce((n, l) => n + (l > 0), 0),
  };
}

const timer = new THREE.Timer();
let frames = 0;
let readyShown = false;
function frame(now) {
  requestAnimationFrame(frame);
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 1 / 20);

  if (seq.intro && !seq.intro.waiting) {
    const it = seq.intro;
    it.t += dt;
    if (it.t > 0.6 && !it.flew) {
      it.flew = true;
      const c = CAMERAS['34'];
      rig.flyTo(c.pos, c.target, { duration: 4.2, lift: 0.05, limits: DEFAULT_LIMITS });
    }
    if (it.t > 1.4 && !it.lit) {
      it.lit = true;
      car.setLights(true);
      audio.lights(true);
    }
    if (it.t > 4.4 && !it.cap) {
      it.cap = true;
      ui.caption('Roadster', 'Drag to explore the design in 360°', 3.4);
    }
    if (it.t > 5) seq.intro = null;
  }

  updateDrive(dt);
  updateSequences(dt);
  rig.update(dt);
  if (!dragging) idleTimer += dt;
  controls.autoRotate = state.spin && !rig.busy && idleTimer > 6 && !CAMERAS[state.cam]?.interior && !state.settings.freeDrive && !seq.intro;
  if (!rig.busy) controls.update(dt);
  clampCamera();
  car.update(dt);
  glow.update(dt, 0);
  vapor.update(dt, 0);
  smoke.update(dt, 0);
  updateGround();
  env.update?.(dt, camera);
  updateHotspots();
  updateLens(dt);
  updateAudio(dt);
  contact.render(scene);
  camera.position.add(shake);
  composer.render(dt);
  camera.position.sub(shake);
  adaptQuality(dt);

  frames++;
  if (frames === 3 && !readyShown) {
    readyShown = true;
    if (SHOT) ui.ready();
    else {
      ui.awaitStart().then(() => {
        audio.unlock();
        audio.intro(1.4);
        ui.ready();
        seq.intro.waiting = false;
      });
    }
  }
  if (frames === 8) window.__ready = true;
}
requestAnimationFrame(frame);
