import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { drawTeslaT, canvas } from './logo.js';

function screenTexture(kind) {
  const c = document.createElement('canvas');
  c.width = kind === 'main' ? 1024 : 384;
  c.height = kind === 'main' ? 560 : 256;
  const g = c.getContext('2d');
  const w = c.width;
  const h = c.height;
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0b0d12');
  bg.addColorStop(1, '#151a24');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8ecf2';
  g.font = '600 28px Helvetica, Arial, sans-serif';
  if (kind === 'main') {
    // map-like grid with route
    g.strokeStyle = 'rgba(120,140,170,0.18)';
    g.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.moveTo(420 + i * 46, 0);
      g.lineTo(380 + i * 52, h);
      g.stroke();
      g.beginPath();
      g.moveTo(400, i * 46);
      g.lineTo(w, i * 40 + 20);
      g.stroke();
    }
    g.strokeStyle = '#3e8bff';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(470, 520);
    g.bezierCurveTo(560, 380, 700, 420, 760, 260);
    g.bezierCurveTo(800, 160, 900, 140, 980, 60);
    g.stroke();
    // car card
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(24, 24, 340, 512);
    g.fillStyle = '#e8ecf2';
    g.font = '300 120px Helvetica, Arial, sans-serif';
    g.fillText('0', 60, 210);
    g.font = '500 26px Helvetica, Arial, sans-serif';
    g.fillText('MPH', 60, 250);
    g.fillStyle = '#9aa4b5';
    g.font = '500 24px Helvetica, Arial, sans-serif';
    g.fillText('ROADSTER  ·  THRUST', 60, 320);
    g.fillText('Aero: Road Mode', 60, 362);
    g.fillText('Fans: Standby', 60, 398);
    g.fillStyle = '#3e8bff';
    g.fillRect(60, 440, 260, 10);
    g.fillStyle = '#2a3242';
    g.fillRect(60, 470, 260, 10);
  } else {
    g.strokeStyle = '#3e8bff';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(w / 2, h * 0.62, 90, Math.PI * 0.85, Math.PI * 2.15);
    g.stroke();
    g.fillStyle = '#e8ecf2';
    g.font = '600 46px Helvetica, Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText(kind === 'left' ? 'P' : '97%', w / 2, h * 0.68);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function yokeGeometry() {
  // butterfly yoke: open-top rim with flat bottom
  const s = new THREE.Shape();
  const W = 0.17;
  const H = 0.09;
  s.moveTo(-W, 0.035);
  s.quadraticCurveTo(-W - 0.012, -H * 0.6, -W * 0.55, -H);
  s.lineTo(W * 0.55, -H);
  s.quadraticCurveTo(W + 0.012, -H * 0.6, W, 0.035);
  s.lineTo(W - 0.03, 0.04);
  s.quadraticCurveTo(W - 0.02, -H * 0.45, W * 0.5, -H + 0.026);
  s.lineTo(-W * 0.5, -H + 0.026);
  s.quadraticCurveTo(-W + 0.02, -H * 0.45, -W + 0.03, 0.04);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 16 });
  g.translate(0, 0, -0.011);
  return g;
}

const carbonWeave = (g, w, h) => {
  g.fillStyle = '#0b0b0d';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) {
    for (let x = 0; x < w; x += 8) {
      g.fillStyle = (x + y) % 16 ? '#17181b' : '#101113';
      g.fillRect(x, y, 8, 8);
    }
  }
};

// Seat-back plaque: carbon with an illuminated red ROADSTER wordmark.
let badgeMats = null;
function getBadgeMaterials() {
  if (badgeMats) return badgeMats;
  const W = 512;
  const H = 160;
  const word = (g, fill) => {
    g.save();
    g.fillStyle = fill;
    g.font = '800 74px "Helvetica Neue", Helvetica, Arial, sans-serif';
    g.textBaseline = 'middle';
    g.translate(W / 2, H / 2 + 4);
    g.scale(1.22, 1);
    const letters = 'ROADSTER'.split('');
    const adv = 50;
    letters.forEach((ch, i) => {
      const w = g.measureText(ch).width;
      g.fillText(ch, (i - (letters.length - 1) / 2) * adv - w / 2, 0);
    });
    g.restore();
  };
  const [color, cg] = canvas(W, H);
  carbonWeave(cg, W, H);
  word(cg, '#5a0a0c');
  const [glow, gg] = canvas(W, H);
  gg.fillStyle = '#000';
  gg.fillRect(0, 0, W, H);
  word(gg, '#ff2a2c');
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(glow);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, emissiveMap]) t.anisotropy = 4;
  const plaque = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.35, metalness: 0.2 });

  const [lc, lg] = canvas(128, 128);
  lg.fillStyle = '#5f6166';
  drawTeslaT(lg, 14, 14, 100);
  const logoMap = new THREE.CanvasTexture(lc);
  logoMap.colorSpace = THREE.SRGBColorSpace;
  const logo = new THREE.MeshStandardMaterial({ map: logoMap, transparent: true, alphaTest: 0.4, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  badgeMats = { plaque, logo };
  return badgeMats;
}

function seat(mats) {
  const g = new THREE.Group();
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.1, 0.4, 4, 0.04), mats.interiorWhite);
  cushion.position.set(0.02, 0.27, 0);
  cushion.rotation.z = 0.12;
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.68, 0.42, 4, 0.045), mats.interiorWhite);
  back.position.set(-0.27, 0.6, 0);
  back.rotation.z = 0.36;
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.16, 0.24, 4, 0.04), mats.interiorWhite);
  head.position.set(-0.4, 0.97, 0);
  head.rotation.z = 0.36;
  g.add(cushion, back, head);
  // ROADSTER plaque set into the top of the backrest, Tesla emblem on the headrest
  const badge = getBadgeMaterials();
  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.008, 0.074, 0.21, 2, 0.003), mats.carbon);
  frame.position.set(0.048, 0.215, 0);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.196, 0.06), badge.plaque);
  plaque.rotation.y = Math.PI / 2;
  plaque.position.set(0.0535, 0.215, 0);
  back.add(frame, plaque);
  const emblem = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.062), badge.logo);
  emblem.rotation.y = Math.PI / 2;
  emblem.position.set(0.0405, 0.002, 0);
  head.add(emblem);
  for (const s of [1, -1]) {
    const bolsterBack = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.52, 0.07, 4, 0.03), mats.suede);
    bolsterBack.position.set(-0.235, 0.58, s * 0.215);
    bolsterBack.rotation.z = 0.36;
    bolsterBack.rotation.x = -s * 0.25;
    const bolsterSeat = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.08, 0.07, 4, 0.03), mats.suede);
    bolsterSeat.position.set(0.02, 0.31, s * 0.2);
    bolsterSeat.rotation.z = 0.12;
    g.add(bolsterBack, bolsterSeat);
  }
  // harness slot accent
  const slot = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.05, 0.12, 2, 0.008), mats.titanium);
  slot.position.set(-0.36, 0.86, 0);
  slot.rotation.z = 0.36;
  g.add(slot);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

export function buildInterior(car) {
  const { mats } = car;
  const g = new THREE.Group();
  g.name = 'interior';

  // tub: floor, tunnel, sills, firewall and rear bulkhead
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.03, 1.66), mats.cabinDark);
  floor.position.set(0.15, 0.195, 0);
  const tunnel = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.2, 0.24, 3, 0.04), mats.carbon);
  tunnel.position.set(0.15, 0.3, 0);
  const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.82, 1.6), mats.cabinDark);
  bulkhead.position.set(-0.86, 0.6, 0);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 1.32), mats.carbon);
  shelf.position.set(-1.05, 0.98, 0);
  shelf.rotation.z = 0.12;
  const firewall = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 1.56), mats.cabinDark);
  firewall.position.set(1.18, 0.5, 0);
  firewall.rotation.z = -0.35;
  g.add(floor, tunnel, bulkhead, shelf, firewall);
  for (const s of [1, -1]) {
    const sill = new THREE.Mesh(new RoundedBoxGeometry(1.75, 0.26, 0.16, 3, 0.03), mats.carbon);
    sill.position.set(0.1, 0.32, s * 0.83);
    g.add(sill);
  }

  // dashboard: thin wing that floats ahead of the occupants
  const dashShape = new THREE.Shape();
  dashShape.moveTo(1.2, 0.73);
  dashShape.lineTo(0.66, 0.745);
  dashShape.quadraticCurveTo(0.6, 0.745, 0.6, 0.725);
  dashShape.lineTo(0.62, 0.7);
  dashShape.quadraticCurveTo(0.8, 0.62, 1.2, 0.6);
  dashShape.closePath();
  const dash = new THREE.Mesh(new THREE.ExtrudeGeometry(dashShape, { depth: 1.44, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 12 }), mats.suede);
  dash.position.z = -0.72;
  dash.castShadow = true;
  const dashTrim = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.012, 1.46, 2, 0.005), mats.titanium);
  dashTrim.position.set(0.6, 0.712, 0);
  g.add(dash, dashTrim);

  // centre touchscreen + two driver displays
  const mainScreen = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.2, 0.34, 2, 0.006), mats.carbon);
  mainScreen.position.set(0.6, 0.86, 0);
  mainScreen.rotation.z = 0.32;
  const mainFace = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.19), new THREE.MeshBasicMaterial({ map: screenTexture('main'), toneMapped: false }));
  mainFace.rotation.set(0, -Math.PI / 2, 0);
  mainFace.position.x = -0.0065;
  mainScreen.add(mainFace);
  g.add(mainScreen);
  for (const [z, kind] of [[-0.56, 'left'], [-0.18, 'right']]) {
    const d = new THREE.Mesh(new RoundedBoxGeometry(0.01, 0.075, 0.11, 2, 0.004), mats.carbon);
    d.position.set(0.56, 0.81, z);
    d.rotation.z = 0.4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.07), new THREE.MeshBasicMaterial({ map: screenTexture(kind), toneMapped: false }));
    face.rotation.y = -Math.PI / 2;
    face.position.x = -0.0055;
    d.add(face);
    g.add(d);
  }

  // yoke on a short column (left-hand drive)
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.26, 20), mats.carbon);
  column.rotation.z = Math.PI / 2 - 0.42;
  column.position.set(0.58, 0.67, -0.37);
  const yokeGroup = new THREE.Group();
  yokeGroup.position.set(0.44, 0.72, -0.37);
  yokeGroup.rotation.set(0, -Math.PI / 2, 0);
  const yokeTilt = new THREE.Group();
  yokeTilt.rotation.x = -0.42;
  const yoke = new THREE.Mesh(yokeGeometry(), mats.suede);
  const hub = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.07, 0.04, 3, 0.015), mats.carbon);
  hub.position.set(0, -0.035, 0.005);
  const spokeL = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.02, 0.018, 2, 0.006), mats.carbon);
  spokeL.position.set(-0.1, -0.04, 0);
  const spokeR = spokeL.clone();
  spokeR.position.x = 0.1;
  yokeTilt.add(yoke, hub, spokeL, spokeR);
  // champagne diamond inserts on the grips, both faces
  const diamond = new THREE.CylinderGeometry(0.013, 0.013, 0.005, 4);
  diamond.rotateX(Math.PI / 2);
  for (const x of [-0.158, 0.158]) {
    for (const z of [-0.0205, 0.0205]) {
      const d = new THREE.Mesh(diamond, mats.bronzeRim);
      d.position.set(x, -0.012, z);
      yokeTilt.add(d);
    }
  }
  yokeGroup.add(yokeTilt);
  g.add(column, yokeGroup);

  const seats = [];
  for (const z of [-0.37, 0.37]) {
    const s = seat(mats);
    s.position.set(-0.22, 0, z);
    g.add(s);
    seats.push(s);
  }

  // red ambient glow: under the dash and along both sills
  const ambientMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.06, 0.05).multiplyScalar(1.6) });
  const ambient = new THREE.Mesh(new RoundedBoxGeometry(0.01, 0.006, 1.36, 2, 0.002), ambientMat);
  ambient.position.set(0.56, 0.7, 0);
  g.add(ambient);
  for (const s of [1, -1]) {
    const strip = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.006, 0.006, 2, 0.002), ambientMat);
    strip.position.set(0.15, 0.43, s * 0.748);
    g.add(strip);
  }

  g.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  return { group: g, yoke: yokeGroup, ambient, seats };
}
