import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { QUALITY } from '../quality.js';
import { buildStudioEnvMap } from './studio.js';
import { crustTextures, mountains } from './saltflat.js';
import { Scatter, PostLine, Motes, rockGeometry, wrap } from './scatter.js';

const TILE = 4.5;
// The band stands nearly upright and meets the horizon just left of the default
// three-quarter view (and, opposite, just right of the initial chase view): a
// 32° lens only shows the lowest ~15° of sky.
const GALACTIC_POLE = new THREE.Vector3(0.348, 0.342, -0.874).normalize();
const GALACTIC_CORE = new THREE.Vector3(-0.923, 0.291, -0.254).normalize();

// Twinkling stars; a second population is concentrated along the Milky Way.
function stars(count = 3600, bandCount = 2600, radius = 900) {
  const total = count + bandCount;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const extra = new Float32Array(total * 2);
  const v = new THREE.Vector3();
  const a = new THREE.Vector3(1, 0, 0).cross(GALACTIC_POLE).normalize();
  const b = GALACTIC_POLE.clone().cross(a).normalize();
  for (let i = 0; i < total; i++) {
    if (i < count) {
      const th = Math.random() * Math.PI * 2;
      const y = Math.pow(Math.random() * 0.97 + 0.03, 0.75);
      const r = Math.sqrt(1 - y * y);
      v.set(Math.cos(th) * r, y, Math.sin(th) * r);
    } else {
      const th = Math.random() * Math.PI * 2;
      const off = (Math.random() + Math.random() + Math.random() - 1.5) * 0.16;
      v.copy(a).multiplyScalar(Math.cos(th)).addScaledVector(b, Math.sin(th)).addScaledVector(GALACTIC_POLE, off).normalize();
      if (v.y < 0.02) v.negate();
    }
    pos.set([v.x * radius, v.y * radius, v.z * radius], i * 3);
    const bright = i < count ? 0.35 + Math.pow(Math.random(), 7) * 7 : 0.25 + Math.pow(Math.random(), 9) * 3;
    const warm = Math.random();
    col.set([bright * (0.85 + 0.15 * warm), bright * 0.92, bright * (1.05 - 0.2 * warm)], i * 3);
    extra.set([Math.random() * 6.28, 0.6 + Math.random() * 1.2], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('tw', new THREE.Float32BufferAttribute(extra, 2));
  const m = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, px: { value: Math.min(window.devicePixelRatio, 2) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float time; uniform float px;
      attribute vec3 color; attribute vec2 tw;
      varying vec3 vC;
      void main() {
        float tws = 0.84 + 0.16 * sin(time * (1.3 + tw.y * 2.2) + tw.x) * sin(time * 0.7 * tw.y + tw.x * 3.0);
        float hz = normalize(position).y;
        vC = color * tws * smoothstep(0.0, 0.08, hz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w * 0.99998;
        gl_PointSize = px * (1.7 + min(1.6, length(color) * 0.3));
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vC * (1.0 - smoothstep(0.32, 0.5, d)), 1.0);
      }`,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

function nightSky() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(1000, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { pole: { value: GALACTIC_POLE }, core: { value: GALACTIC_CORE } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w * 0.99999; }',
      fragmentShader: /* glsl */ `
        uniform vec3 pole;
        uniform vec3 core;
        varying vec3 vD;
        float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n3(vec3 x) {
          vec3 i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }
        float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n3(p); p = p * 2.02 + 3.1; a *= 0.5; } return v; }
        void main() {
          vec3 d = normalize(vD);
          float h = d.y;
          vec3 top = vec3(0.006, 0.008, 0.02);
          vec3 hor = vec3(0.04, 0.05, 0.08);
          vec3 c = mix(hor, top, smoothstep(0.0, 0.45, max(h, 0.0)));
          // last light behind the mountains, like the reveal photo
          float az = max(0.0, dot(normalize(d.xz), normalize(vec2(-1.0, 0.0))));
          c += vec3(0.5, 0.42, 0.32) * pow(az, 10.0) * exp(-max(h, 0.0) * 22.0) * 0.5;
          c += vec3(0.12, 0.16, 0.3) * exp(-abs(h) * 14.0) * 0.25;
          // Milky Way: soft band with a dark dust lane and a brighter core
          float b = dot(d, pole);
          float band = exp(-b * b / 0.02);
          float cloud = fbm(d * 5.0);
          float lane = smoothstep(0.48, 0.72, fbm(d * 11.0 + 7.0)) * exp(-b * b / 0.0035);
          float bulge = pow(max(0.0, dot(d, core)), 8.0);
          float mw = (band + 0.6 * bulge) * (0.35 + 0.9 * cloud) * (1.0 - 0.75 * lane) * (1.0 + 1.6 * bulge);
          c += mix(vec3(0.05, 0.055, 0.085), vec3(0.1, 0.08, 0.06), bulge) * mw * smoothstep(0.0, 0.07, h);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
}

// Low drifting ground haze that stays put in the world and wraps around the car.
function haze(count = 30, size = 26) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0.55, 0.6, 0.7), transparent: true, opacity: 0.1, depthWrite: false, fog: false });
    const s = new THREE.Sprite(mat);
    let x, z;
    do {
      x = (Math.random() - 0.5) * size;
      z = (Math.random() - 0.5) * size;
    } while (Math.hypot(x, z) < 2.4);
    const k = 3.5 + Math.random() * 4;
    s.scale.set(k * 1.6, k * 0.32, 1);
    // a camera-facing quad resting on its half-height never dips into the ground,
    // so the depth test can't cut a hard line through it
    s.position.set(x, s.scale.y / 2, z);
    group.add(s);
    items.push({ s, x, z, speed: 0.08 + Math.random() * 0.15, phase: Math.random() * 6 });
  }
  return { group, items, size };
}

class ShootingStars {
  constructor() {
    this.geo = new LineGeometry();
    this.seg = 12;
    this.pos = new Float32Array((this.seg + 1) * 3);
    this.col = new Float32Array((this.seg + 1) * 3);
    this.geo.setPositions(this.pos);
    this.geo.setColors(this.col);
    this.mat = new LineMaterial({ linewidth: 2.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, worldUnits: false });
    this.line = new Line2(this.geo, this.mat);
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.wait = 3 + Math.random() * 6;
    this.t = 0;
    this.dir = new THREE.Vector3();
    this.start = new THREE.Vector3();
    this.vel = new THREE.Vector3();
  }

  update(dt, center) {
    this.mat.resolution.set(window.innerWidth, window.innerHeight);
    if (!this.line.visible) {
      this.wait -= dt;
      if (this.wait > 0) return;
      const th = Math.random() * Math.PI * 2;
      const el = 0.35 + Math.random() * 0.45;
      this.start.set(Math.cos(th) * Math.cos(el), Math.sin(el), Math.sin(th) * Math.cos(el)).multiplyScalar(700);
      this.vel.set(Math.random() - 0.5, -0.35 - Math.random() * 0.3, Math.random() - 0.5).normalize().multiplyScalar(420 + Math.random() * 260);
      this.t = 0;
      this.life = 0.55 + Math.random() * 0.5;
      this.line.visible = true;
    }
    this.t += dt;
    const k = this.t / this.life;
    if (k >= 1) {
      this.line.visible = false;
      this.wait = 6 + Math.random() * 12;
      return;
    }
    const fade = Math.sin(Math.PI * k);
    for (let i = 0; i <= this.seg; i++) {
      const u = i / this.seg;
      const tt = Math.max(0, this.t - u * 0.22);
      this.pos[i * 3] = center.cx + this.start.x + this.vel.x * tt;
      this.pos[i * 3 + 1] = this.start.y + this.vel.y * tt;
      this.pos[i * 3 + 2] = center.cz + this.start.z + this.vel.z * tt;
      const a = fade * Math.pow(1 - u, 1.6) * 1.6;
      this.col.set([a * 0.9, a * 0.95, a * 1.1], i * 3);
    }
    this.geo.setPositions(this.pos);
    this.geo.setColors(this.col);
  }
}

export function createNight(renderer) {
  const group = new THREE.Group();
  group.name = 'night';
  const far = new THREE.Group();
  group.add(far);
  const sky = nightSky();
  sky.renderOrder = -10;
  const starField = stars();
  far.add(sky, starField);
  const darkHaze = new THREE.Color(0.035, 0.04, 0.06);
  const dir = new THREE.Vector3(-1, 0.2, 0).normalize();
  far.add(mountains(1300, 95, 0x07080b, 2.2, dir, darkHaze, 0.02));
  far.add(mountains(1000, 50, 0x0b0c10, 5.7, dir, darkHaze, 0.02));
  const meteors = new ShootingStars();
  group.add(meteors.line);

  const { map, bump } = crustTextures({ cells: 16, crack: true, width: 0.06, warp: 0.55 });
  const reps = 600 / TILE;
  map.repeat.set(reps, reps);
  bump.repeat.set(reps, reps);
  const groundMat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.6, roughness: 0.95, metalness: 0, color: 0x9a968f, envMapIntensity: 0.4 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- lights travel with the car
  const rig = new THREE.Group();
  group.add(rig);
  // moonlight, not a stage spot: white paint should read as cool grey at night
  const top = new THREE.SpotLight(0xa9bbec, 58, 0, 0.42, 0.9, 2);
  top.position.set(0.5, 9, 1.2);
  top.castShadow = true;
  top.shadow.mapSize.setScalar(QUALITY.shadowSize);
  top.shadow.camera.near = 4;
  top.shadow.camera.far = 14;
  top.shadow.radius = 7;
  top.shadow.blurSamples = 16;
  top.shadow.bias = -0.00012;
  top.shadow.normalBias = 0.02;
  const topTarget = new THREE.Object3D();
  rig.add(top, topTarget);
  top.target = topTarget;
  const moon = new THREE.DirectionalLight(0x8ea2d8, 0.35);
  moon.position.set(-8, 6, 4);
  group.add(moon);
  const rim = new THREE.SpotLight(0xffd2a8, 17, 0, 0.35, 1, 2);
  rim.position.set(-7, 2.2, 0);
  const rimTarget = new THREE.Object3D();
  rimTarget.position.set(0, 0.6, 0);
  rim.target = rimTarget;
  rig.add(rim, rimTarget);
  group.add(new THREE.HemisphereLight(0x33405e, 0x060606, 0.18));

  const mist = haze();
  group.add(mist.group);

  // ---- roadside: delineator posts whose reflectors light up in the headlamps
  const postGeo = new THREE.BoxGeometry(0.09, 1.0, 0.06).translate(0, 0.5, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 0.6 });
  const posts = new PostLine({ geometry: postGeo, material: postMat, spacing: 22, zs: [-6.8, 6.8], count: 26 });
  const reflGeo = new THREE.BoxGeometry(0.1, 0.16, 0.075).translate(0, 0.86, 0);
  const reflMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });
  const reflectors = new PostLine({ geometry: reflGeo, material: reflMat, spacing: 22, zs: [-6.8, 6.8], count: 26 });
  reflectors.mesh.castShadow = false;
  const refl = new THREE.Color();
  for (let i = 0; i < reflectors.mesh.count; i++) reflectors.mesh.setColorAt(i, refl.setRGB(0, 0, 0));
  group.add(posts.mesh, reflectors.mesh);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.92 });
  const rocks = new Scatter({ geometry: rockGeometry(1, 0.32, 13), material: rockMat, count: 200, size: 260, keepOut: 8, seed: 41, scale: [0.1, 0.6], squash: [0.35, 0.75] });
  group.add(rocks.mesh);
  const motes = new Motes({ count: 600, size: 50, height: 5, color: new THREE.Color(0.6, 0.7, 1.0), opacity: 0.2 });
  group.add(motes.points);

  // just enough softbox for clearcoat highlights; more floods white paint with studio fill
  const environment = buildStudioEnvMap(renderer, { top: 0.01, horizon: 0.03, floor: 0.01, intensity: 0.13, tint: 0xa6b6de });

  const world = { cx: 0, cz: 0, ox: 0, oz: 0 };
  const car = { heading: 0, lights: 0 };
  const apply = () => {
    const { cx, cz, ox, oz } = world;
    far.position.set(cx, 0, cz);
    ground.position.set(cx, 0, cz);
    const u = (((cx + ox) / TILE) % 1 + 1) % 1;
    const v = (((-(cz + oz)) / TILE) % 1 + 1) % 1;
    map.offset.set(u, v);
    bump.offset.set(u, v);
    rig.position.set(cx, 0, cz);
    posts.update(cx, ox, oz);
    reflectors.update(cx, ox, oz);
    rocks.update(cx, cz, ox, oz);
    for (const m of mist.items) {
      m.s.position.x = cx + wrap(m.x - ox - cx, mist.size);
      m.s.position.z = cz + wrap(m.z - oz - cz, mist.size);
    }
  };
  apply();

  // Retro-reflection: bright when inside the headlamp cone, falling off with distance.
  const updateReflectors = () => {
    const fx = Math.cos(car.heading);
    const fz = -Math.sin(car.heading);
    const p = reflectors.positions;
    for (let i = 0; i < reflectors.mesh.count; i++) {
      const dx = p[i * 3] - world.cx;
      const dz = p[i * 3 + 1] - world.cz;
      const d = Math.hypot(dx, dz) || 1;
      const cos = (dx * fx + dz * fz) / d;
      const inBeam = Math.max(0, (cos - 0.55) / 0.45);
      const k = car.lights * inBeam * inBeam * Math.min(1, 900 / (d * d)) * 9;
      const side = p[i * 3 + 2];
      if (side > 0) refl.setRGB(k * 1.0, k * 0.55, k * 0.12);
      else refl.setRGB(k * 0.95, k * 0.95, k);
      reflectors.mesh.setColorAt(i, refl.setRGB(refl.r + 0.02, refl.g + 0.02, refl.b + 0.02));
    }
    reflectors.mesh.instanceColor.needsUpdate = true;
  };

  let t = 0;
  return {
    name: 'night',
    group,
    background: new THREE.Color(0x05070d),
    environment,
    exposure: 1.0,
    bloom: { strength: 0.5, radius: 0.5, threshold: 2.2 },
    fog: new THREE.FogExp2(0x06080d, 0.02),
    headlamps: 0.12,
    vapor: 0.3,
    smoke: 0.4,
    groundMats: [groundMat, rockMat, postMat],
    shadowLight: top,
    dust: new THREE.Color(0.42, 0.44, 0.5),
    surface: 1,
    scroll(dx, heading = 0) {
      world.ox += Math.cos(heading) * dx;
      world.oz -= Math.sin(heading) * dx;
    },
    track(cx, cz, heading = 0, lights = 0) {
      world.cx = cx;
      world.cz = cz;
      car.heading = heading;
      car.lights = lights;
    },
    reset() {
      Object.assign(world, { cx: 0, cz: 0, ox: 0, oz: 0 });
      apply();
    },
    update(dt) {
      t += dt;
      starField.material.uniforms.time.value = t;
      apply();
      updateReflectors();
      motes.update(dt, world.cx, world.cz, world.ox, world.oz);
      meteors.update(dt, world);
      for (const m of mist.items) {
        m.x += Math.sin(t * 0.1 + m.phase) * m.speed * dt;
        m.s.material.opacity = 0.08 + 0.04 * Math.sin(t * 0.3 + m.phase);
      }
    },
  };
}
