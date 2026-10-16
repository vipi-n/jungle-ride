import * as THREE from 'three';

// Wrap v into [-size/2, size/2).
export const wrap = (v, size) => v - size * Math.floor(v / size + 0.5);

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// World-anchored instances on a torus around the car: they stay fixed on the
// ground as the car moves, and wrap at the far edge where fog hides the pop.
// (ox, oz) is the scroll offset used by the parked "Drive" demo.
export class Scatter {
  constructor({ geometry, material, count, size, keepOut = 0, seed = 1, scale = [0.5, 1], lift = 0, squash = [1, 1], spin = true }) {
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.size = size;
    this.items = [];
    const r = rng(seed);
    while (this.items.length < count) {
      const x = (r() - 0.5) * size;
      const z = (r() - 0.5) * size;
      if (Math.hypot(x, z) < keepOut) continue;
      const k = scale[0] + (scale[1] - scale[0]) * r() * r();
      const sy = squash[0] + (squash[1] - squash[0]) * r();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, spin ? r() * Math.PI * 2 : 0, (r() - 0.5) * 0.3));
      this.items.push({ x, z, k, sy, q, lift: lift * k * sy });
    }
    this.m = new THREE.Matrix4();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.key = '';
  }

  update(cx, cz, ox = 0, oz = 0) {
    const key = `${cx.toFixed(2)},${cz.toFixed(2)},${ox.toFixed(2)},${oz.toFixed(2)}`;
    if (key === this.key) return;
    this.key = key;
    const { size, m, p, s } = this;
    this.items.forEach((it, i) => {
      p.set(cx + wrap(it.x - ox - cx, size), it.lift, cz + wrap(it.z - oz - cz, size));
      s.set(it.k, it.k * it.sy, it.k);
      m.compose(p, it.q, s);
      this.mesh.setMatrixAt(i, m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const FLIP = new THREE.Matrix4().makeRotationY(Math.PI);

// Posts repeating along a line parallel to x at fixed z (course markers, delineators).
export class PostLine {
  constructor({ geometry, material, spacing, zs, count = 40, y = 0 }) {
    this.mesh = new THREE.InstancedMesh(geometry, material, count * zs.length);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.spacing = spacing;
    this.zs = zs;
    this.count = count;
    this.y = y;
    this.m = new THREE.Matrix4();
    this.positions = [];
  }

  update(cx, ox = 0, oz = 0) {
    const { spacing, count, m } = this;
    const first = Math.floor((cx + ox) / spacing - count / 2);
    let i = 0;
    this.positions.length = 0;
    for (const z of this.zs) {
      for (let k = 0; k < count; k++) {
        const x = (first + k) * spacing - ox;
        m.makeTranslation(x, this.y, z - oz);
        if (z > 0) m.multiply(FLIP);
        this.mesh.setMatrixAt(i++, m);
        this.positions.push(x, z - oz, z < 0 ? -1 : 1);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// A long painted line along x (the black guide line on a salt speed course).
export function courseLine({ z, width = 0.3, dash = 6, gap = 6, color = 0x2c2724, opacity = 0.7, length = 1400 }) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 16;
  const g = c.getContext('2d');
  const on = (dash / (dash + gap)) * 256;
  for (let x = 0; x < 256; x++) {
    const inside = x < on;
    const wear = 0.75 + 0.25 * Math.sin(x * 1.7) * Math.sin(x * 0.31);
    g.fillStyle = `rgba(255,255,255,${inside ? wear : 0})`;
    g.fillRect(x, 0, 1, 16);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.6})`;
    g.fillRect(Math.random() * 256, Math.random() * 16, 1 + Math.random() * 3, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  const period = dash + gap;
  tex.repeat.set(length / period, 1);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, transparent: true, opacity, alphaMap: tex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  mat.userData.baseOpacity = opacity;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, width), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.004, z);
  mesh.receiveShadow = true;
  return {
    mesh,
    update(cx, ox = 0, oz = 0) {
      mesh.position.x = cx;
      mesh.position.z = z - oz;
      tex.offset.x = (((cx + ox) / period) % 1 + 1) % 1;
    },
  };
}

// Airborne dust motes in a box that wraps around the car; drifting with the wind
// they make speed readable even on a featureless salt flat.
export class Motes {
  constructor({ count = 900, size = 56, height = 7, color = new THREE.Color(1, 0.95, 0.85), opacity = 0.35, px = 2.2 }) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const r = rng(77);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = r() * size;
      pos[i * 3 + 1] = Math.pow(r(), 1.8) * height + 0.05;
      pos[i * 3 + 2] = r() * size;
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.uniforms = {
      uCenter: { value: new THREE.Vector3() },
      uOffset: { value: new THREE.Vector3() },
      uSize: { value: size },
      uColor: { value: color },
      uOpacity: { value: opacity },
      uPx: { value: px },
      uTime: { value: 0 },
      uStreak: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform vec3 uCenter; uniform vec3 uOffset; uniform float uSize; uniform float uPx; uniform float uTime;
        attribute float seed;
        varying float vA;
        void main() {
          vec3 base = position;
          base.x += sin(uTime * 0.7 + seed * 40.0) * 0.4;
          base.y += sin(uTime * 0.5 + seed * 17.0) * 0.15;
          float h = uSize * 0.5;
          vec2 rel = mod(base.xz - uOffset.xz - uCenter.xz + h, uSize) - h;
          vec3 world = vec3(uCenter.x + rel.x, base.y, uCenter.z + rel.y);
          vec4 mv = modelViewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mv;
          float edge = 1.0 - smoothstep(h * 0.55, h, length(rel));
          vA = edge * (0.4 + 0.6 * fract(seed * 13.7));
          gl_PointSize = uPx * (0.6 + seed) * 14.0 / max(1.0, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity;
        varying float vA;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(d));
          gl_FragColor = vec4(uColor * a * vA * uOpacity, 1.0);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.wind = new THREE.Vector3(0.6, 0, 0.25);
    this.drift = new THREE.Vector3();
  }

  update(dt, cx, cz, ox = 0, oz = 0) {
    this.uniforms.uTime.value += dt;
    this.drift.addScaledVector(this.wind, dt);
    this.uniforms.uCenter.value.set(cx, 0, cz);
    this.uniforms.uOffset.value.set(ox - this.drift.x, 0, oz - this.drift.z);
  }
}

export function rockGeometry(detail = 1, jitter = 0.28, seed = 3) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const r = rng(seed);
  const pos = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, 1 + (r() - 0.5) * 2 * jitter);
    const k = map.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}
