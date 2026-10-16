import * as THREE from 'three';

let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  // a cluster of soft blobs reads as a billow rather than a flat disc
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 28; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.pow(rnd(), 0.7) * S * 0.22;
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d;
    const r = S * (0.1 + rnd() * 0.15);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.34)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.13)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  }
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.5);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, S, S);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

// Billowing smoke as camera-facing instanced quads. Point sprites are capped at a
// few hundred pixels by the GPU, far smaller than a ground cloud seen up close.
export class Smoke {
  constructor({ max = 900, floorLift = 0.3 } = {}) {
    this.max = max;
    this.floorLift = floorLift;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.landed = new Uint8Array(max);
    this.cursor = 0;

    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    const inst = (arr, n) => new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('offset', inst(this.pos, 3));
    g.setAttribute('aSize', inst(this.size, 1));
    g.setAttribute('aAlpha', inst(this.alpha, 1));
    g.setAttribute('aRot', inst(this.rot, 1));
    g.instanceCount = max;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.geometry = g;

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { map: { value: puffTexture() }, color: { value: new THREE.Color(1, 1, 1) }, density: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec3 offset;
        attribute float aSize;
        attribute float aAlpha;
        attribute float aRot;
        varying vec2 vUv;
        varying vec2 vTex;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(offset, 1.0);
          mv.xy += position.xy * aSize;
          vUv = uv;
          vec2 q = uv - 0.5;
          float c = cos(aRot), s = sin(aRot);
          vTex = vec2(c * q.x - s * q.y, s * q.x + c * q.y) + 0.5;
          // fade out before a puff fills the lens
          vAlpha = aAlpha * smoothstep(0.4, 2.6, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 color;
        uniform float density;
        varying vec2 vUv;
        varying vec2 vTex;
        varying float vAlpha;
        void main() {
          float a = min(1.0, texture2D(map, vTex).a * vAlpha * density);
          if (a < 0.003) discard;
          // lit from above: brighter crowns, shadowed undersides
          vec3 c = color * mix(0.58, 1.12, vUv.y);
          gl_FragColor = vec4(c * a, a);
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  emit(origin, dir, n, o = {}) {
    const speed = o.speed ?? 5;
    const spread = o.spread ?? 0.08;
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const s = speed * (0.8 + Math.random() * 0.4);
      const r = o.radius ?? 0;
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * r;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * r;
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * r;
      this.vel[i * 3] = (dir.x + (Math.random() - 0.5) * 2 * spread) * s;
      this.vel[i * 3 + 1] = (dir.y + (Math.random() - 0.5) * 2 * spread) * s;
      this.vel[i * 3 + 2] = (dir.z + (Math.random() - 0.5) * 2 * spread) * s;
      this.size[i] = (o.size ?? 0.2) * (0.75 + Math.random() * 0.5);
      this.rot[i] = Math.random() * Math.PI * 2;
      this.spin[i] = (Math.random() - 0.5) * 0.8;
      this.grow[i] = o.grow ?? 0.8;
      this.a0[i] = o.alpha ?? 0.25;
      this.drag[i] = o.drag ?? 1.4;
      this.maxLife[i] = (o.life ?? 2.4) * (0.75 + Math.random() * 0.5);
      this.life[i] = this.maxLife[i];
      this.landed[i] = 0;
    }
  }

  update(dt, floorY = 0) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          this.size[i] = 0;
          any = true;
        }
        continue;
      }
      any = true;
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const d = Math.exp(-this.drag[i] * dt);
      const j = i * 3;
      this.vel[j] *= d;
      this.vel[j + 1] = this.vel[j + 1] * d + 0.3 * dt;
      this.vel[j + 2] *= d;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      // puffs rest on their lower fringe so the ground never cuts a hard line through them
      const minY = floorY + this.size[i] * this.floorLift;
      if (this.pos[j + 1] < minY) {
        this.pos[j + 1] = minY;
        const vy = this.vel[j + 1];
        if (vy < 0) {
          this.vel[j + 1] = 0;
          if (!this.landed[i]) {
            // the jet splashes outwards along the ground
            this.landed[i] = 1;
            const a = Math.random() * Math.PI * 2;
            const out = Math.abs(vy) * (0.7 + Math.random() * 0.5);
            this.vel[j] += Math.cos(a) * out;
            this.vel[j + 2] += Math.sin(a) * out;
          }
        }
      }
      this.size[i] += this.grow[i] * dt * (1 - t * 0.5);
      this.rot[i] += this.spin[i] * dt;
      this.alpha[i] = this.a0[i] * Math.min(1, t / 0.02) * Math.pow(1 - t, 1.4);
    }
    if (any) {
      const a = this.geometry.attributes;
      a.offset.needsUpdate = true;
      a.aSize.needsUpdate = true;
      a.aAlpha.needsUpdate = true;
      a.aRot.needsUpdate = true;
    }
  }
}
