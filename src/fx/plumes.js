import * as THREE from 'three';

let sprite = null;
function spriteTexture() {
  if (sprite) return sprite;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  sprite = new THREE.CanvasTexture(c);
  return sprite;
}

// World-space point-sprite particles. One instance per blending style.
export class Plumes {
  constructor({ max = 2500, additive = true } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: spriteTexture() }, uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        uniform float uScale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.05, -mv.z);
          vColor = aColor;
          // fade out before a particle fills the lens
          vAlpha = aAlpha * smoothstep(0.35, 2.4, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float a = texture2D(map, gl_PointCoord).a * vAlpha;
          if (a < 0.002) discard;
          gl_FragColor = vec4(vColor * a, a);
        }`,
    });
    if (!additive) {
      this.material.blending = THREE.CustomBlending;
      this.material.blendSrc = THREE.OneFactor;
      this.material.blendDst = THREE.OneMinusSrcAlphaFactor;
    }
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geometry = g;
  }

  setViewport(height, fov) {
    this.material.uniforms.uScale.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  }

  emit(origin, dir, n, o = {}) {
    const speed = o.speed ?? 6;
    const spread = o.spread ?? 0.12;
    const color = o.color ?? new THREE.Color(1, 1, 1);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const jx = (Math.random() - 0.5) * 2 * spread;
      const jy = (Math.random() - 0.5) * 2 * spread;
      const jz = (Math.random() - 0.5) * 2 * spread;
      const s = speed * (0.75 + Math.random() * 0.5);
      const r = o.radius ?? 0;
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * r;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * r;
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * r;
      this.vel[i * 3] = (dir.x + jx) * s;
      this.vel[i * 3 + 1] = (dir.y + jy) * s;
      this.vel[i * 3 + 2] = (dir.z + jz) * s;
      this.col[i * 3] = color.r;
      this.col[i * 3 + 1] = color.g;
      this.col[i * 3 + 2] = color.b;
      this.size[i] = (o.size ?? 0.06) * (0.7 + Math.random() * 0.6);
      this.grow[i] = o.grow ?? 0.5;
      this.a0[i] = o.alpha ?? 0.5;
      this.drag[i] = o.drag ?? 2.5;
      this.maxLife[i] = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      this.life[i] = this.maxLife[i];
    }
  }

  update(dt, floorY = 0) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          any = true;
        }
        continue;
      }
      any = true;
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d + 0.25 * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < floorY + 0.02) {
        // spread out along the floor
        this.pos[i * 3 + 1] = floorY + 0.02;
        const vy = this.vel[i * 3 + 1];
        this.vel[i * 3 + 1] = 0;
        const sx = Math.random() - 0.5;
        const sz = Math.random() - 0.5;
        const l = Math.hypot(sx, sz) || 1;
        this.vel[i * 3] += (sx / l) * Math.abs(vy) * 0.9;
        this.vel[i * 3 + 2] += (sz / l) * Math.abs(vy) * 0.9;
      }
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = this.a0[i] * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.4);
    }
    if (any) {
      const a = this.geometry.attributes;
      a.position.needsUpdate = true;
      a.aSize.needsUpdate = true;
      a.aAlpha.needsUpdate = true;
      a.aColor.needsUpdate = true;
    }
  }
}
