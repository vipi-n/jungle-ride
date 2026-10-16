import * as THREE from 'three';
import { QUALITY } from '../quality.js';
import { Scatter, PostLine, Motes, courseLine, rockGeometry } from './scatter.js';

const TILE = 7;

function hash(i, j, s) {
  const h = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

// Tileable crust: jittered-grid Voronoi. Salt gets raised ridges on the cell
// edges; dried mud (`crack`) gets dark sunken cracks and slightly domed plates.
export function crustTextures({ size = 1024, cells = 11, crack = false, width = 0.07, warp = 0 } = {}) {
  const pts = new Float32Array(cells * cells * 2);
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      pts[(j * cells + i) * 2] = i + 0.12 + 0.76 * hash(i, j, 1);
      pts[(j * cells + i) * 2 + 1] = j + 0.12 + 0.76 * hash(i, j, 2);
    }
  }
  const color = new Uint8ClampedArray(size * size * 4);
  const bump = new Uint8ClampedArray(size * size * 4);
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    const fy = y / size;
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      // periodic domain warp keeps the tile seamless while breaking up the cell grid
      const wu = warp * (Math.sin(TAU * (fy * 3 + fx)) * 0.6 + Math.sin(TAU * (fx * 7 - fy * 2) + 1.3) * 0.4);
      const wv = warp * (Math.sin(TAU * (fx * 3 - fy) + 2.1) * 0.6 + Math.sin(TAU * (fy * 6 + fx * 2) + 0.4) * 0.4);
      const u = ((fx * cells + wu) % cells + cells) % cells;
      const v = ((fy * cells + wv) % cells + cells) % cells;
      const ci = Math.floor(u);
      const cj = Math.floor(v);
      let d1 = 1e9;
      let d2 = 1e9;
      let id = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = (ci + di + cells) % cells;
          const jj = (cj + dj + cells) % cells;
          const px = pts[(jj * cells + ii) * 2] + (ci + di - ii);
          const py = pts[(jj * cells + ii) * 2 + 1] + (cj + dj - jj);
          const dx = px - u;
          const dy = py - v;
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            id = jj * cells + ii;
          } else if (d < d2) d2 = d;
        }
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const ridge = Math.max(0, 1 - edge / width);
      const r2 = ridge * ridge * (3 - 2 * ridge);
      const n = hash(x, y, 3);
      const cellTone = hash(id, 0, 4);
      const k = (y * size + x) * 4;
      if (crack) {
        const base = 150 + cellTone * 26 + n * 16 - 18 * Math.sqrt(d1);
        const c = base * (1 - 0.82 * r2);
        color[k] = c;
        color[k + 1] = c * 0.93;
        color[k + 2] = c * 0.84;
        const b = 200 - r2 * 190 + n * 10 - Math.sqrt(d1) * 40;
        bump[k] = bump[k + 1] = bump[k + 2] = b;
      } else {
        const base = 224 + cellTone * 14 + n * 8 - 12 * Math.sqrt(d1);
        const c = base + r2 * 22;
        color[k] = c;
        color[k + 1] = c - 3 - cellTone * 4;
        color[k + 2] = c - 9 - cellTone * 6;
        const b = 110 + r2 * 140 + n * 14 - Math.sqrt(d1) * 10;
        bump[k] = bump[k + 1] = bump[k + 2] = b;
      }
      color[k + 3] = 255;
      bump[k + 3] = 255;
    }
  }
  const mk = (data, srgb) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 16;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { map: mk(color, true), bump: mk(bump, false) };
}

function skyMaterial(sunDir, { radius, clouds = false }) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    defines: clouds ? { CLOUDS: 1 } : {},
    uniforms: { sunDir: { value: sunDir }, radius: { value: radius }, time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w * 0.99999;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir;
      uniform float time;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float s = max(dot(d, normalize(sunDir)), 0.0);
        vec3 zenith = vec3(0.10, 0.22, 0.50);
        vec3 mid = vec3(0.42, 0.52, 0.72);
        vec3 horizon = vec3(1.25, 0.92, 0.70);
        vec3 col = h > 0.0
          ? mix(mix(horizon, mid, smoothstep(0.0, 0.18, h)), zenith, smoothstep(0.12, 0.85, h))
          : mix(horizon, vec3(0.95, 0.86, 0.76), smoothstep(0.0, -0.05, h));
        col += vec3(1.4, 0.75, 0.35) * pow(s, 6.0) * (0.9 - 0.6 * smoothstep(0.0, 0.5, h));
        #ifdef CLOUDS
          // high golden-hour cirrus: streaky fbm on a plane above the camera
          if (h > 0.0) {
            vec2 uv = d.xz / (h + 0.08);
            uv = vec2(uv.x * 0.32 + uv.y * 0.1, uv.y * 0.95) * 0.7 + vec2(time * 0.006, time * 0.002);
            float n = fbm(uv);
            float m = fbm(uv * 3.1 + 4.0);
            float cov = smoothstep(0.44, 0.78, n * 0.8 + m * 0.3);
            cov *= smoothstep(0.01, 0.09, h) * (1.0 - 0.55 * smoothstep(0.35, 0.9, h));
            vec3 lit = mix(vec3(1.05, 0.86, 0.76), vec3(1.9, 1.25, 0.78), pow(s, 2.5));
            vec3 shade = vec3(0.62, 0.6, 0.72);
            vec3 cloud = mix(shade, lit, 0.55 + 0.45 * smoothstep(0.4, 0.9, m));
            col = mix(col, cloud, cov * 0.72);
          }
        #endif
        col += vec3(2.0, 1.2, 0.6) * pow(s, 60.0) * 0.8;
        col += vec3(30.0, 22.0, 14.0) * smoothstep(0.99955, 0.99975, s);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function ridge(seed, a) {
  let h = 0;
  let amp = 1;
  let f = 1;
  for (let o = 0; o < 6; o++) {
    // whole-number frequencies keep the ring seamless where the angle wraps
    h += amp * (0.5 + 0.5 * Math.sin(a * Math.round(f * 3) + seed * 13.1 + Math.sin(a * Math.round(f * 1.7) + seed * 3.3) * 2.0));
    amp *= 0.5;
    f *= 2.13;
  }
  return h / 1.9;
}

export function mountains(radius, height, color, seed, sunDir, haze = new THREE.Color(1.0, 0.86, 0.72), litMix = 0.35) {
  const segs = 360;
  const pos = [];
  const col = [];
  const c = new THREE.Color(color);
  const lit = c.clone().lerp(new THREE.Color(1.0, 0.8, 0.65), litMix);
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const mask = (a) => 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(a * 2 + seed), 1.5);
    const h0 = height * ridge(seed, a0) * mask(a0);
    const h1 = height * ridge(seed, a1) * mask(a1);
    const p = (a, h) => [Math.cos(a) * radius, h, Math.sin(a) * radius];
    const facing = (a) => Math.max(0, Math.cos(a) * sunDir.x + Math.sin(a) * sunDir.z) * -1 + 1;
    const top0 = c.clone().lerp(lit, Math.min(1, facing(a0) * 0.5));
    const top1 = c.clone().lerp(lit, Math.min(1, facing(a1) * 0.5));
    const quad = [
      [p(a0, -4), haze],
      [p(a1, -4), haze],
      [p(a1, h1), top1],
      [p(a0, -4), haze],
      [p(a1, h1), top1],
      [p(a0, h0), top0],
    ];
    for (const [v, cc] of quad) {
      pos.push(...v);
      col.push(cc.r, cc.g, cc.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
}

export function createSaltFlat(renderer) {
  const group = new THREE.Group();
  group.name = 'saltflat';
  const sunDir = new THREE.Vector3(-0.35, 0.24, 0.9).normalize();

  // far scenery rides along with the car so the horizon never gets closer
  const far = new THREE.Group();
  group.add(far);
  const skyMat = skyMaterial(sunDir, { radius: 1800, clouds: true });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), skyMat);
  sky.renderOrder = -10;
  far.add(sky);
  far.add(mountains(1500, 120, 0x8b8fa6, 1.3, sunDir));
  far.add(mountains(1200, 70, 0xa4a2ae, 4.1, sunDir));

  const { map, bump } = crustTextures();
  const reps = 1200 / TILE;
  map.repeat.set(reps, reps);
  bump.repeat.set(reps, reps);
  const groundMat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.2, roughness: 0.92, metalness: 0, color: 0xffffff, envMapIntensity: 0.6 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const sun = new THREE.DirectionalLight(0xffcf9e, 4.2);
  sun.position.copy(sunDir).multiplyScalar(20);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(QUALITY.shadowSize);
  const sc = sun.shadow.camera;
  sc.left = -6;
  sc.right = 6;
  sc.top = 6;
  sc.bottom = -6;
  sc.near = 5;
  sc.far = 40;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  sun.shadow.blurSamples = 12;
  group.add(sun, sun.target);
  const skyFill = new THREE.HemisphereLight(0xc4cde0, 0xf5dcc0, 0.5);
  group.add(skyFill);

  // reflection map: same sky with a bright salt ground
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 64, 32), skyMaterial(sunDir, { radius: 40 })));
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(39, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.74, 0.62) }));
  envGround.rotation.x = -Math.PI / 2;
  envGround.position.y = -1.2;
  envScene.add(envGround);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(envScene, 0.01).texture;
  pmrem.dispose();

  // ---- things that pass by: salt mounds, the course line, marker poles, dust
  const moundMat = new THREE.MeshStandardMaterial({ color: 0xece4d9, roughness: 0.95, metalness: 0, envMapIntensity: 0.6 });
  const mounds = new Scatter({ geometry: rockGeometry(1, 0.3, 5), material: moundMat, count: 260, size: 340, keepOut: 9, seed: 11, scale: [0.12, 0.65], squash: [0.18, 0.4] });
  group.add(mounds.mesh);
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x9d9286, roughness: 0.9 });
  const pebbles = new Scatter({ geometry: rockGeometry(0, 0.35, 8), material: pebbleMat, count: 160, size: 160, keepOut: 6, seed: 29, scale: [0.04, 0.16], squash: [0.4, 0.8] });
  group.add(pebbles.mesh);
  const line = courseLine({ z: -7.5, width: 0.32, dash: 9, gap: 6 });
  group.add(line.mesh);
  const poleGeo = new THREE.CylinderGeometry(0.028, 0.035, 1.5, 8).translate(0, 0.75, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.6 });
  const flagGeo = new THREE.BoxGeometry(0.02, 0.24, 0.42).translate(0, 1.36, 0.21);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.55, emissive: 0x401000 });
  const poles = new PostLine({ geometry: poleGeo, material: poleMat, spacing: 80, zs: [-9.5], count: 18 });
  const flags = new PostLine({ geometry: flagGeo, material: flagMat, spacing: 80, zs: [-9.5], count: 18 });
  group.add(poles.mesh, flags.mesh);
  const motes = new Motes({ count: 700, size: 60, height: 6, color: new THREE.Color(1.0, 0.9, 0.75), opacity: 0.32 });
  group.add(motes.points);

  const world = { cx: 0, cz: 0, ox: 0, oz: 0 };
  const sunOffset = sunDir.clone().multiplyScalar(20);
  const apply = () => {
    const { cx, cz, ox, oz } = world;
    far.position.set(cx, 0, cz);
    ground.position.set(cx, 0, cz);
    const u = (((cx + ox) / TILE) % 1 + 1) % 1;
    const v = (((-(cz + oz)) / TILE) % 1 + 1) % 1;
    map.offset.set(u, v);
    bump.offset.set(u, v);
    sun.position.set(cx, 0, cz).add(sunOffset);
    sun.target.position.set(cx, 0, cz);
    mounds.update(cx, cz, ox, oz);
    pebbles.update(cx, cz, ox, oz);
    line.update(cx, ox, oz);
    poles.update(cx, ox, oz);
    flags.update(cx, ox, oz);
  };
  apply();

  const horizon = new THREE.Color(1.0, 0.84, 0.7);
  return {
    name: 'salt',
    group,
    background: new THREE.Color(horizon),
    environment,
    exposure: 0.9,
    bloom: { strength: 0.2, radius: 0.5, threshold: 1.8 },
    fog: new THREE.Fog(horizon.clone().multiplyScalar(0.98), 40, 600),
    headlamps: 0,
    vapor: 0.8,
    // the sunlit salt sits high on the tone curve: a thin pale veil over it
    // changes almost nothing on screen, so the cloud is greyer and denser here
    smoke: 0.5,
    smokeDensity: 4,
    groundMats: [groundMat, moundMat, pebbleMat, line.mesh.material, poleMat, flagMat],
    shadowLight: sun,
    dust: new THREE.Color(0.95, 0.9, 0.84),
    surface: 0.8,
    // parked "Drive" demo: the world slides back under the car
    scroll(dx, heading = 0) {
      world.ox += Math.cos(heading) * dx;
      world.oz -= Math.sin(heading) * dx;
    },
    track(cx, cz) {
      world.cx = cx;
      world.cz = cz;
    },
    reset() {
      Object.assign(world, { cx: 0, cz: 0, ox: 0, oz: 0 });
      apply();
    },
    update(dt) {
      skyMat.uniforms.time.value += dt;
      apply();
      motes.update(dt, world.cx, world.cz, world.ox, world.oz);
    },
  };
}
