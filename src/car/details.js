import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FRONT_X, REAR_X } from './bodyData.js';

function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#f4f4f2');
  grad.addColorStop(1, '#d9d9d6');
  g.fillStyle = grad;
  roundRect(g, 4, 4, 504, 248, 22);
  g.fill();
  g.strokeStyle = '#8a8a88';
  g.lineWidth = 6;
  roundRect(g, 14, 14, 484, 228, 16);
  g.stroke();
  g.fillStyle = '#2b2b2d';
  g.font = '600 150px "DIN Alternate", "Arial Narrow", Helvetica, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('RDSTR', 256, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function airfoilShape(chord, thick) {
  // simple cambered profile, leading edge at +x (forward)
  const s = new THREE.Shape();
  const n = 24;
  const top = [];
  const bot = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = chord * (1 - u);
    const t = 5 * thick * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4);
    const camber = 0.035 * chord * Math.sin(Math.PI * u);
    top.push([x, camber + t]);
    bot.push([x, camber - t * 0.7]);
  }
  s.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i <= n; i++) s.lineTo(top[i][0], top[i][1]);
  for (let i = n; i >= 0; i--) s.lineTo(bot[i][0], bot[i][1]);
  s.closePath();
  return s;
}

function wingSection(mat, chord, span, thick) {
  const g = new THREE.ExtrudeGeometry(airfoilShape(chord, thick), { depth: span, bevelEnabled: false, curveSegments: 12 });
  g.translate(-chord, 0, -span / 2);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

export function buildDetails(car) {
  const { mats, body, chassis } = car;
  const parts = {};

  // ---------------- front light bar -----------------
  const front = body.section(FRONT_X);
  const edgeY = front.Re.y;
  const barPts = [];
  const barHalf = front.Bt.z - 0.012;
  for (let i = -12; i <= 12; i++) {
    const z = (i / 12) * barHalf;
    const curl = Math.max(0, Math.abs(z) - (barHalf - 0.075)) / 0.075;
    barPts.push(new THREE.Vector3(FRONT_X + 0.0035 - curl * curl * 0.012, edgeY - 0.011 - curl * curl * 0.012, z));
  }
  const barCurve = new THREE.CatmullRomCurve3(barPts);
  const frontBar = new THREE.Mesh(new THREE.TubeGeometry(barCurve, 160, 0.0052, 10, false), mats.lightFront);
  frontBar.scale.set(1, 0.75, 1);
  frontBar.position.y = edgeY * 0.25;
  chassis.add(frontBar);
  parts.frontBar = frontBar;
  // smoked lens band under the light bar
  const lensBand = new THREE.Mesh(new THREE.PlaneGeometry(barHalf * 2 - 0.12, 0.03), mats.lens);
  lensBand.rotation.y = Math.PI / 2;
  lensBand.position.set(FRONT_X + 0.0015, edgeY - 0.012, 0);
  chassis.add(lensBand);

  // hidden headlight slits on the nose corners
  for (const side of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const x = FRONT_X - 0.02 - i * 0.018;
      const s = body.section(x);
      const p = s.Bt.clone().lerp(s.Sh, 0.35);
      p.y += 0.004;
      p.z = (p.z + 0.004) * side;
      pts.push(p);
    }
    const slit = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0042, 8, false), mats.lightFront);
    chassis.add(slit);
    (parts.headSlits ||= []).push(slit);
  }

  // splitter lip
  const splitShape = new THREE.Shape();
  splitShape.moveTo(-0.64, 0);
  splitShape.lineTo(0.64, 0);
  splitShape.lineTo(0.56, 0.03);
  splitShape.lineTo(-0.56, 0.03);
  splitShape.closePath();
  const splitter = new THREE.Mesh(new THREE.ExtrudeGeometry(splitShape, { depth: 0.022, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }), mats.trim);
  splitter.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  splitter.position.set(FRONT_X + 0.004, 0.19, 0);
  splitter.scale.z = 0.6;
  chassis.add(splitter);

  // ---------------- side markers -----------------
  for (const side of [1, -1]) {
    const blade = sideStrip(body, 0.985, 0.76, 0.655, 0.69, 0.003, side, 0.03);
    chassis.add(new THREE.Mesh(blade, mats.trim));
    const amber = sideStrip(body, 0.82, 0.762, 0.668, 0.684, 0.0045, side, 0.03);
    chassis.add(new THREE.Mesh(amber, mats.lightAmber));
    const red = sideStrip(body, -2.08, -2.15, 0.745, 0.76, 0.003, side, 0);
    chassis.add(new THREE.Mesh(red, mats.lightRear));
  }

  // ---------------- rear fascia -----------------
  const rear = body.section(REAR_X);
  const rx = REAR_X - 0.002;
  const tailY = rear.Sh.y - 0.04;
  const tail = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.014, 1.74, 2, 0.005), mats.lightRear);
  tail.position.set(rx - 0.004, tailY, 0);
  chassis.add(tail);
  parts.tail = tail;
  const tailLens = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.055), mats.lens);
  tailLens.rotation.y = -Math.PI / 2;
  tailLens.position.set(rx, tailY + 0.004, 0);
  chassis.add(tailLens);
  // wrap-around tail tips
  for (const side of [1, -1]) {
    const tip = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.012, 0.012, 2, 0.004), mats.lightRear);
    tip.position.set(rx + 0.03, tailY, side * 0.872);
    tip.rotation.y = side * 0.25;
    chassis.add(tip);
  }

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.31, 0.155),
    new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.4, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  );
  plate.rotation.y = -Math.PI / 2;
  plate.position.set(rx - 0.012, 0.665, 0);
  chassis.add(plate);
  // recess face sits 4 mm behind the plate: coplanar faces z-fight
  const plateRecess = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.18, 0.34, 2, 0.008), mats.trim);
  plateRecess.position.set(rx + 0.002, 0.665, 0);
  chassis.add(plateRecess);
  // reversing camera and plate lamps above the plate
  const camPod = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.016, 0.06, 2, 0.006), mats.trim);
  camPod.position.set(rx - 0.014, 0.751, 0);
  const camLens = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 20), mats.lens);
  camLens.rotation.y = -Math.PI / 2;
  camLens.position.set(rx - 0.0255, 0.751, 0);
  chassis.add(camPod, camLens);
  for (const side of [1, -1]) {
    const lamp = new THREE.Mesh(new RoundedBoxGeometry(0.004, 0.005, 0.022, 1, 0.002), mats.lightFront);
    lamp.position.set(rx - 0.012, 0.752, side * 0.065);
    chassis.add(lamp);
  }

  // diffuser block with thrusters and fans
  const diffuser = new THREE.Group();
  diffuser.position.set(rx, 0, 0);
  chassis.add(diffuser);
  const lipMat = mats.titanium;
  const lip = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.012, 1.1, 2, 0.004), lipMat);
  lip.position.set(-0.012, 0.505, 0);
  diffuser.add(lip);

  parts.nozzles = [];
  const nozzleZ = [-0.36, -0.12, 0.12, 0.36];
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.85, 1).multiplyScalar(0), toneMapped: true });
  parts.nozzleGlowMat = glowMat;
  // bronze nozzles with heat-tinted bores
  for (const z of nozzleZ) {
    const g = new THREE.Group();
    g.position.set(-0.005, 0.445, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0048, 12, 40), mats.bronzeRim);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = -0.02;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.026, 0.12, 32, 1, true), mats.nozzleBore);
    bell.rotation.z = Math.PI / 2;
    bell.position.x = 0.04;
    const throat = new THREE.Mesh(new THREE.CircleGeometry(0.027, 32), glowMat);
    throat.rotation.y = -Math.PI / 2;
    throat.position.x = 0.09;
    g.add(ring, bell, throat);
    diffuser.add(g);
    parts.nozzles.push(g);
  }
  // dark recessed ports between and beside the nozzles
  const portRing = new THREE.TorusGeometry(0.028, 0.004, 10, 36);
  const portBack = new THREE.CircleGeometry(0.028, 32);
  for (const z of [-0.48, -0.24, 0, 0.24, 0.48]) {
    const ring = new THREE.Mesh(portRing, mats.darkMetal);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-0.014, 0.455, z);
    const back = new THREE.Mesh(portBack, mats.under);
    back.rotation.y = -Math.PI / 2;
    back.position.set(0.02, 0.455, z);
    diffuser.add(ring, back);
  }

  // vertical strakes
  for (const z of [-0.62, -0.42, -0.24, 0, 0.24, 0.42, 0.62]) {
    const fin = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.17, 0.012, 2, 0.004), mats.trim);
    fin.position.set(-0.04, 0.33, z);
    diffuser.add(fin);
  }
  // fan housings in the diffuser
  parts.fans = [];
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0.012, -0.01);
  bladeShape.quadraticCurveTo(0.05, -0.022, 0.072, -0.004);
  bladeShape.lineTo(0.072, 0.012);
  bladeShape.quadraticCurveTo(0.045, 0.004, 0.012, 0.01);
  bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.006, bevelEnabled: false });
  for (const z of [-0.33, 0.33]) {
    const housing = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.009, 10, 48), mats.darkMetal);
    housing.rotation.y = Math.PI / 2;
    housing.position.set(0.02, 0.33, z);
    diffuser.add(housing);
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.08, 40), mats.under);
    back.rotation.y = -Math.PI / 2;
    back.position.set(0.07, 0.33, z);
    diffuser.add(back);
    const fan = new THREE.Group();
    fan.position.set(0.04, 0.33, z);
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(bladeGeo, mats.spoke);
      b.rotation.z = (i / 9) * Math.PI * 2;
      const holder = new THREE.Group();
      holder.add(b);
      holder.rotation.y = Math.PI / 2;
      fan.add(holder);
    }
    const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 20), lipMat);
    hubMesh.rotation.z = Math.PI / 2;
    fan.add(hubMesh);
    diffuser.add(fan);
    parts.fans.push(fan);
  }

  // ---------------- active rear wing -----------------
  parts.wing = buildWing(car, rear);

  // ---------------- underbody fan intakes -----------------
  for (const x of [0.6, -0.2]) {
    const grille = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.16, 40), mats.darkMetal);
    grille.rotation.x = Math.PI / 2;
    grille.position.set(x, 0.168, 0);
    chassis.add(grille);
  }

  // ---------------- Rocket perimeter thruster ports -----------------
  parts.ports = [];
  const portGeo = new THREE.TorusGeometry(0.026, 0.006, 10, 32);
  const throatGeo = new THREE.CircleGeometry(0.022, 24);
  const addPort = (pos, dir, scale = 1) => {
    const g = new THREE.Group();
    g.position.copy(pos);
    g.lookAt(pos.clone().add(dir));
    g.scale.setScalar(scale);
    const ring = new THREE.Mesh(portGeo, lipMat);
    const throat = new THREE.Mesh(throatGeo, glowMat);
    throat.position.z = -0.003;
    g.add(ring, throat);
    chassis.add(g);
    parts.ports.push({ group: g, pos: pos.clone(), dir: dir.clone().normalize() });
  };
  for (const side of [1, -1]) {
    addPort(new THREE.Vector3(FRONT_X + 0.004, 0.27, 0.5 * side), new THREE.Vector3(1, 0, 0));
    for (const x of [0.98, -0.95]) {
      const { p, n } = body.flank(x, 0.27);
      p.addScaledVector(n, 0.004);
      p.z *= side;
      addPort(p, new THREE.Vector3(n.x, n.y, n.z * side));
    }
    for (const x of [1.78, -1.95]) addPort(new THREE.Vector3(x, 0.162, 0.48 * side), new THREE.Vector3(0, -1, 0), 1.6);
  }

  return parts;
}

function buildWing(car, rear) {
  const { mats, chassis } = car;
  const deckY = rear.Ra.y + 0.004;
  const root = new THREE.Group();
  root.position.set(-1.955, deckY, 0);
  chassis.add(root);

  const lift = new THREE.Group();
  root.add(lift);
  const pitch = new THREE.Group();
  lift.add(pitch);

  const chord = 0.24;
  const center = wingSection(mats.body[0], chord, 0.98, 0.075);
  pitch.add(center);
  const under = wingSection(mats.trim, chord * 0.98, 0.96, 0.05);
  under.position.y = -0.006;
  pitch.add(under);

  const exts = [];
  for (const side of [1, -1]) {
    const ext = new THREE.Group();
    const plane = wingSection(mats.trim, chord * 0.96, 0.5, 0.065);
    plane.position.z = side * 0.25;
    ext.add(plane);
    const hinge = new THREE.Group();
    hinge.position.set(-chord * 0.5, 0.0, side * 0.5);
    const plateShape = new THREE.Shape();
    plateShape.moveTo(chord * 0.55, 0.01);
    plateShape.lineTo(-chord * 0.6, 0.02);
    plateShape.lineTo(-chord * 0.45, -0.17);
    plateShape.lineTo(chord * 0.35, -0.12);
    plateShape.closePath();
    const endplate = new THREE.Mesh(new THREE.ExtrudeGeometry(plateShape, { depth: 0.008, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 }), mats.trim);
    endplate.position.z = -0.004;
    endplate.castShadow = true;
    hinge.add(endplate);
    ext.add(hinge);
    ext.userData = { side, hinge };
    pitch.add(ext);
    exts.push(ext);
  }

  const struts = [];
  for (const side of [1, -1]) {
    const s = new THREE.Mesh(new RoundedBoxGeometry(0.11, 1, 0.022, 2, 0.008), mats.trim);
    s.position.set(-0.1, -0.5, side * 0.3);
    s.castShadow = true;
    const holder = new THREE.Group();
    holder.position.z = 0;
    holder.add(s);
    lift.add(holder);
    struts.push(holder);
  }

  return { root, lift, pitch, exts, struts, chord, deckY };
}

// Thin strip lying on the flank between two x stations and two heights.
// `rise` lifts the strip towards x1 so it follows the body's rake.
function sideStrip(body, x0, x1, y0, y1, offset, side, rise = 0) {
  const nx = 6;
  const positions = [];
  const pts = [];
  for (let i = 0; i <= nx; i++) {
    const u = i / nx;
    const x = x0 + (x1 - x0) * u;
    const at = (y) => {
      const { p, n } = body.flank(x, y);
      p.addScaledVector(n, offset);
      p.z *= side;
      return p;
    };
    const dy = rise * u;
    pts.push([at(y0 + dy), at(y1 + dy)]);
  }
  for (let i = 0; i < nx; i++) {
    const [a0, a1] = pts[i];
    const [b0, b1] = pts[i + 1];
    const quad = side > 0 ? [a0, b1, b0, a0, a1, b1] : [a0, b0, b1, a0, b1, a1];
    for (const p of quad) positions.push(p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}
