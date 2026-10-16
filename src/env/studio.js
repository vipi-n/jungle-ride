import * as THREE from 'three';
import { QUALITY } from '../quality.js';

// Reflection environment: a dark studio with long softboxes so the paint picks
// up the clean strip highlights seen in Tesla's reveal footage.
export function buildStudioEnvMap(renderer, opts = {}) {
  const scene = new THREE.Scene();
  const top = opts.top ?? 0.07;
  const horizon = opts.horizon ?? 0.2;
  const floor = opts.floor ?? 0.34;
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(40, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: top }, hor: { value: horizon }, bot: { value: floor } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform float top; uniform float hor; uniform float bot; varying vec3 vP; void main(){ float h = vP.y; float c = h > 0.0 ? mix(hor, top, pow(h, 0.55)) : mix(hor, bot, pow(-h, 0.4)); gl_FragColor = vec4(vec3(c), 1.0); }',
    }),
  );
  scene.add(sphere);

  const cast = new THREE.Color(opts.tint ?? 0xffffff);
  const panel = (w, h, intensity, pos, target, tint = 0xffffff) => {
    const c = new THREE.Color(tint).multiply(cast).multiplyScalar(intensity);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(new THREE.Vector3(...target));
    scene.add(m);
    return m;
  };
  const k = opts.intensity ?? 1;
  panel(20, 4.5, 4.5 * k, [0, 15, 0], [0, 0, 0]);
  panel(18, 1.6, 4 * k, [0, 3.4, 13], [0, 1.4, 0]);
  panel(18, 1.6, 4 * k, [0, 3.4, -13], [0, 1.4, 0]);
  panel(18, 0.9, 2.2 * k, [0, 7.5, 11], [0, 0, 0]);
  panel(18, 0.9, 2.2 * k, [0, 7.5, -11], [0, 0, 0]);
  panel(5, 7, 2.6 * k, [15, 4.5, 3], [0, 1, 0]);
  panel(5, 7, 2.0 * k, [-15, 4.5, -3], [0, 1, 0]);
  panel(30, 30, 0.5 * k, [0, -0.5, 0], [0, 10, 0], 0xd8d8d8);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.015);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return rt.texture;
}

export function createStudio(renderer) {
  const group = new THREE.Group();
  group.name = 'studio';

  // cyclorama: floor that curves into a wall
  const profile = [];
  const R0 = 11;
  const cove = 4;
  profile.push(new THREE.Vector2(0.001, 0));
  for (let r = 1; r <= R0; r += 1) profile.push(new THREE.Vector2(r, 0));
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 0.5;
    profile.push(new THREE.Vector2(R0 + Math.sin(a) * cove, cove - Math.cos(a) * cove));
  }
  profile.push(new THREE.Vector2(R0 + cove, 20));
  const cycMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.05 });
  const cyc = new THREE.Mesh(new THREE.LatheGeometry(profile, 128), cycMat);
  cyc.receiveShadow = true;
  group.add(cyc);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x5c5c5f, roughness: 0.72, metalness: 0, envMapIntensity: 0.04 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R0, 96), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.0005;
  floor.receiveShadow = true;
  group.add(floor);

  const key = new THREE.SpotLight(0xffffff, 340, 0, 0.34, 1, 2);
  key.position.set(0.6, 10.5, 0.4);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(QUALITY.shadowSize);
  key.shadow.camera.near = 5;
  key.shadow.camera.far = 16;
  key.shadow.bias = -0.00012;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 6;
  key.shadow.blurSamples = 16;
  group.add(key, key.target);

  const rim = new THREE.SpotLight(0xdfe6ff, 140, 0, 0.6, 1, 2);
  rim.position.set(-7, 4.5, -5);
  rim.target.position.set(0, 0.6, 0);
  group.add(rim, rim.target);

  const fill = new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.08);
  group.add(fill);

  const beam = makeBeam();
  beam.position.set(-1.5, 0, -10.4);
  group.add(beam);

  return {
    name: 'studio',
    group,
    background: new THREE.Color(0x0d0d0e),
    environment: buildStudioEnvMap(renderer, { intensity: 0.8 }),
    exposure: 0.95,
    bloom: { strength: 0.24, radius: 0.4, threshold: 2.2 },
    fog: null,
    headlamps: 0,
    vapor: 0.38,
    smoke: 0.78,
    groundMats: [floorMat, cycMat],
    shadowLight: key,
    surface: 0.55,
    scroll() {},
    track() {},
    reset() {},
    update() {},
  };
}

function makeBeam() {
  // soft light shaft on the backdrop, like the reveal film
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { opacity: { value: 0.12 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform float opacity; varying vec2 vUv; void main(){ float x = abs(vUv.x - 0.5) * 2.0; float a = smoothstep(1.0, 0.1, x) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y); gl_FragColor = vec4(vec3(1.0), a * opacity); }',
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 16), mat);
  m.position.y = 8;
  return m;
}
