import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { FRONT_X, GLASS } from './bodyData.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

// Shut lines and glass seams projected onto the actual body surface. Matches the
// reference plan view: framed canopy split into front / centre strip / side panels /
// rear glass, a full-length frunk lid with fender-tip triangles, door-glass divider.
export function buildPanelLines(car) {
  const { body } = car;
  const shellProbe = new THREE.Mesh(body.shell);
  const doorProbe = new THREE.Mesh(body.door);
  shellProbe.geometry.computeBoundsTree();
  doorProbe.geometry.computeBoundsTree();
  shellProbe.raycast = acceleratedRaycast;
  doorProbe.raycast = acceleratedRaycast;

  const ray = new THREE.Raycaster();
  ray.firstHitOnly = true;
  const DOWN = new THREE.Vector3(0, -1, 0);
  const IN = new THREE.Vector3(0, 0, -1);
  const origin = new THREE.Vector3();

  const hit = (probe, o, dir) => {
    ray.set(o, dir);
    const h = ray.intersectObject(probe, false)[0];
    if (!h) return null;
    const n = h.face.normal.clone();
    if (n.dot(dir) > 0) n.negate();
    return { p: h.point.clone(), n };
  };
  const down = (x, z) => hit(shellProbe, origin.set(x, 3, z), DOWN);
  const sideDoor = (x, y) => hit(doorProbe, origin.set(x, y, 2), IN);

  const glassFrame = [];
  const glassSeams = [];
  const bodySeams = [];
  const doorSeams = [];

  const sampleDown = (pts) => pts.map(([x, z]) => down(x, z)).filter(Boolean);
  const lerpPath = (a, b, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    return out;
  };
  const glZ = (x) => body.section(x).Gl.z;

  // ---- canopy frame (plan outline of the glass)
  const xFront = GLASS.windshieldX - 0.004;
  const xRear = GLASS.rearGlassEndX + 0.004;
  for (const side of [1, -1]) {
    const edge = [];
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const x = xFront + (xRear - xFront) * (i / n);
      edge.push([x, side * (glZ(x) - 0.005)]);
    }
    glassFrame.push(sampleDown(edge));
  }
  glassFrame.push(sampleDown(lerpPath([xFront, -glZ(xFront) + 0.005], [xFront, glZ(xFront) - 0.005], 30)));
  glassFrame.push(sampleDown(lerpPath([xRear, -glZ(xRear) + 0.005], [xRear, glZ(xRear) - 0.005], 20)));

  // ---- glass seams: two transverse splits and the centre strip between them
  const T1 = 0.3;
  const T2 = -0.55;
  const bow = (x0, z, half) => x0 - 0.035 * (z / half) ** 2;
  for (const x0 of [T1, T2]) {
    const half = glZ(x0) - 0.006;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const z = -half + (2 * half * i) / 40;
      pts.push([bow(x0, z, half), z]);
    }
    glassSeams.push(sampleDown(pts));
  }
  for (const side of [1, -1]) {
    const a = [bow(T1, 0.17, glZ(T1)) - 0.004, side * 0.17];
    const b = [bow(T2, 0.125, glZ(T2)) + 0.004, side * 0.125];
    glassSeams.push(sampleDown(lerpPath(a, b, 24)));
  }

  // ---- frunk lid: one straight seam from each windshield corner to the nose
  // corner, a cross seam just ahead of the glass, and a small triangular panel on
  // each fender tip (outboard of the lid seam)
  const nose = body.section(FRONT_X - 0.012).Bt;
  const lid = (t, side) => {
    const x = GLASS.windshieldX + 0.003;
    const z = glZ(GLASS.windshieldX);
    return [x + (nose.x - x) * t, side * (z + (nose.z - 0.006 - z) * t)];
  };
  bodySeams.push(sampleDown(lerpPath(lid(0.27, -1), lid(0.27, 1), 40)));
  for (const side of [1, -1]) {
    bodySeams.push(sampleDown(lerpPath(lid(0, side), lid(1, side), 48)));
    const k = lid(0.63, side);
    const bx = k[0] - 0.01;
    const b = [bx, side * (body.section(bx).Bt.z - 0.012)];
    bodySeams.push(sampleDown(lerpPath(k, b, 14)));
    bodySeams.push(sampleDown(lerpPath(b, lid(1, side), 20)));
  }

  // ---- rear fender seams outboard of the sails
  const deckX = GLASS.rearGlassEndX - 0.03;
  const deck = body.section(deckX);
  for (const side of [1, -1]) {
    bodySeams.push(sampleDown(lerpPath([deckX, side * (deck.Ra.z + 0.02)], [deckX, side * (deck.Sh.z - 0.02)], 24)));
  }

  // ---- door glass divider (double line, like the reference)
  for (const dx of [0, -0.026]) {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const x = 0.56 + dx - 0.14 * t;
      const s = body.section(x);
      const y = THREE.MathUtils.lerp(s.Bt.y + 0.012, s.Re.y - 0.008, t);
      const h = sideDoor(x, y);
      if (h) pts.push(h);
    }
    doorSeams.push(pts);
  }

  shellProbe.geometry.disposeBoundsTree();
  doorProbe.geometry.disposeBoundsTree();

  const seamMat = new THREE.MeshStandardMaterial({
    color: 0x0b0b0c,
    roughness: 0.75,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x050506,
    roughness: 0.4,
    metalness: 0.2,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });

  const mk = (lines, width, mat, lift = 0.0016) => {
    const geo = ribbons(lines.filter((l) => l.length > 1), width, lift);
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    return m;
  };

  const shellLines = new THREE.Group();
  shellLines.name = 'panelLines';
  shellLines.add(mk(glassFrame, 0.011, frameMat));
  shellLines.add(mk(glassSeams, 0.0055, frameMat));
  shellLines.add(mk(bodySeams, 0.0045, seamMat));
  car.chassis.add(shellLines);

  const doorGeo = ribbons(doorSeams.filter((l) => l.length > 1), 0.005, 0.0016);
  for (const d of car.doors) {
    const m = new THREE.Mesh(doorGeo, frameMat);
    d.mesh.add(m);
  }
  return { group: shellLines, mats: [seamMat, frameMat] };
}

// Flat strips following each polyline, offset slightly along the surface normal.
function ribbons(lines, width, lift) {
  const pos = [];
  const nrm = [];
  const idx = [];
  const t = new THREE.Vector3();
  const s = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (const line of lines) {
    const n = line.length;
    // smooth normals along the line to avoid stepping across facets
    const normals = line.map((q, i) => {
      const v = q.n.clone();
      if (i > 0) v.add(line[i - 1].n);
      if (i < n - 1) v.add(line[i + 1].n);
      return v.normalize();
    });
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const p = line[i].p;
      const prev = line[Math.max(0, i - 1)].p;
      const next = line[Math.min(n - 1, i + 1)].p;
      t.subVectors(next, prev).normalize();
      s.crossVectors(t, normals[i]).normalize().multiplyScalar(width * 0.5);
      a.copy(p).addScaledVector(normals[i], lift).add(s);
      b.copy(p).addScaledVector(normals[i], lift).sub(s);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      nrm.push(normals[i].x, normals[i].y, normals[i].z, normals[i].x, normals[i].y, normals[i].z);
      if (i < n - 1) {
        const k = base + i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}
