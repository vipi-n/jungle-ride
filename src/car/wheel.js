import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawTeslaT, canvas } from './logo.js';

const RIM_R = 0.268;

// One half-turn of outer-sidewall branding, drawn upright and left to right.
function sidewallStrip(w, h, fill) {
  const [c, g] = canvas(w, h);
  g.fillStyle = fill;
  g.textBaseline = 'middle';
  const stretch = 1.35;
  const items = [
    { logo: true },
    { text: 'P ZERO', px: 0.6 },
    { text: 'TROFEO RS', px: 0.78 },
    { logo: true },
    { text: 'ELECT', px: 0.42 },
    { text: '325/30 ZR21', px: 0.36 },
  ];
  for (const it of items) {
    if (it.logo) it.w = h * 0.86;
    else {
      g.font = `bold ${Math.round(h * it.px)}px Helvetica, Arial, sans-serif`;
      it.w = g.measureText(it.text).width * stretch;
    }
  }
  const gap = (w - items.reduce((s, it) => s + it.w, 0)) / items.length;
  let x = gap / 2;
  for (const it of items) {
    if (it.logo) drawTeslaT(g, x, h * 0.07, it.w);
    else {
      g.save();
      g.font = `bold ${Math.round(h * it.px)}px Helvetica, Arial, sans-serif`;
      g.translate(x, h * 0.54);
      g.scale(stretch, 1);
      g.fillText(it.text, 0, 0);
      g.restore();
    }
    x += it.w + gap;
  }
  return c;
}

let tireMaps = null;
function getTireMaps() {
  if (tireMaps) return tireMaps;
  // u runs around the tyre, v across the profile (inner bead -> outer bead); the
  // canvas is flipped, so its top rows land on the outer wall
  const W = 2048;
  const H = 512;
  const k = H / 256;
  const [bump, b] = canvas(W, H);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, W, H);
  // circumferential grooves on the tread band
  const tread0 = H * 0.36;
  const tread1 = H * 0.64;
  b.fillStyle = '#1a1a1a';
  for (const g of [0.42, 0.5, 0.58]) b.fillRect(0, H * g - 2.5 * k, W, 5 * k);
  // lateral sipes on the shoulders
  b.strokeStyle = '#2a2a2a';
  b.lineWidth = 3;
  for (let x = 0; x < W; x += 16) {
    b.beginPath();
    b.moveTo(x, tread0);
    b.lineTo(x + 7, tread0 + 16 * k);
    b.moveTo(x + 4, tread1);
    b.lineTo(x - 3, tread1 - 16 * k);
    b.stroke();
  }
  const [color, c] = canvas(W, H);
  c.fillStyle = '#181818';
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#101010';
  c.fillRect(0, tread0, W, tread1 - tread0);
  // raised lettering on the flat of the outer wall (v 0.84..0.94). Turned 180°
  // so it runs clockwise with the letter tops towards the tread, like a real tyre.
  const bandY = H * 0.058;
  const bandH = H * 0.1;
  for (const [g, fill] of [[c, '#6c6e72'], [b, '#b4b4b4']]) {
    const strip = sidewallStrip(W / 2, bandH, fill);
    for (let i = 0; i < 2; i++) {
      g.save();
      g.translate((i + 1) * (W / 2), bandY + bandH);
      g.rotate(Math.PI);
      g.drawImage(strip, 0, 0);
      g.restore();
    }
  }
  const bumpTex = new THREE.CanvasTexture(bump);
  const colorTex = new THREE.CanvasTexture(color);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  for (const t of [bumpTex, colorTex]) {
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  tireMaps = { bump: bumpTex, color: colorTex };
  return tireMaps;
}

function tireGeometry(R, width) {
  const W = width / 2;
  const ctrl = [
    [RIM_R + 0.004, -W * 0.84],
    [RIM_R + 0.022, -W * 0.96],
    [0.305, -W * 1.0],
    [0.333, -W * 0.985],
    [0.349, -W * 0.93],
    [R - 0.004, -W * 0.82],
    [R, -W * 0.62],
    [R, W * 0.62],
    [R - 0.004, W * 0.82],
    [0.349, W * 0.93],
    [0.333, W * 0.985],
    [0.305, W * 1.0],
    [RIM_R + 0.022, W * 0.96],
    [RIM_R + 0.004, W * 0.84],
  ].map(([r, w]) => new THREE.Vector3(r, w, 0));
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const pts = curve.getSpacedPoints(64).map((p) => new THREE.Vector2(p.x, p.y));
  const g = new THREE.LatheGeometry(pts, 128);
  g.rotateX(Math.PI / 2);
  return g;
}

function discGeometry(width) {
  const W = width / 2;
  const pts = [
    new THREE.Vector2(0.0, W * 0.5),
    new THREE.Vector2(0.05, W * 0.52),
    new THREE.Vector2(0.12, W * 0.6),
    new THREE.Vector2(0.2, W * 0.7),
    new THREE.Vector2(0.245, W * 0.76),
    new THREE.Vector2(RIM_R - 0.006, W * 0.79),
  ].reverse();
  const g = new THREE.LatheGeometry(pts, 96);
  g.rotateX(Math.PI / 2);
  return g;
}

function lipGeometry(width) {
  const W = width / 2;
  const pts = [
    new THREE.Vector2(RIM_R - 0.012, W * 0.79),
    new THREE.Vector2(RIM_R - 0.004, W * 0.86),
    new THREE.Vector2(RIM_R + 0.004, W * 0.88),
    new THREE.Vector2(RIM_R + 0.01, W * 0.84),
  ].reverse();
  const g = new THREE.LatheGeometry(pts, 128);
  g.rotateX(Math.PI / 2);
  return g;
}

function barrelGeometry(width) {
  const g = new THREE.CylinderGeometry(RIM_R, RIM_R, width * 0.86, 64, 1, true);
  g.rotateX(Math.PI / 2);
  return g;
}

// Six spokes, each a pair of thin blades with a bronze-lined slot between them.
function spokesGeometry(width) {
  const W = width / 2;
  const r0 = 0.052;
  const r1 = RIM_R - 0.008;
  const blade = (c) => {
    const s = new THREE.Shape();
    s.moveTo(r0, c - 0.0085);
    s.lineTo(r1, c - 0.0072);
    s.lineTo(r1, c + 0.0072);
    s.lineTo(r0, c + 0.0085);
    s.closePath();
    return s;
  };
  const blades = new THREE.ExtrudeGeometry([blade(-0.0155), blade(0.0155)], {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.011,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 4,
  });
  blades.translate(0, 0, -0.009);
  const slotShape = new THREE.Shape();
  slotShape.moveTo(r0 + 0.012, -0.007);
  slotShape.lineTo(r1 - 0.004, -0.007);
  slotShape.lineTo(r1 - 0.004, 0.007);
  slotShape.lineTo(r0 + 0.012, 0.007);
  slotShape.closePath();
  const slot = new THREE.ExtrudeGeometry(slotShape, { depth: 0.003, bevelEnabled: false });
  slot.translate(0, 0, 0.002);
  const place = (base) => {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const g = base.clone();
      // tilt so the hub end sits deeper in the dish than the rim end
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(-0.15));
      g.translate(0, 0, W * 0.52);
      g.applyMatrix4(new THREE.Matrix4().makeRotationZ((i / 6) * Math.PI * 2 + Math.PI / 6));
      parts.push(g);
    }
    return mergeGeometries(parts);
  };
  return { blades: place(blades), slots: place(slot) };
}

let capMat = null;
function getCapMaterial() {
  if (capMat) return capMat;
  const [c, g] = canvas(256, 256);
  const bg = g.createRadialGradient(128, 110, 10, 128, 128, 128);
  bg.addColorStop(0, '#26272b');
  bg.addColorStop(1, '#0c0c0e');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#c4c7cc';
  drawTeslaT(g, 58, 50, 140);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  capMat = new THREE.MeshStandardMaterial({ map: t, metalness: 0.55, roughness: 0.32 });
  return capMat;
}

function hubGeometry(width) {
  const W = width / 2;
  const g = new THREE.CylinderGeometry(0.056, 0.062, 0.05, 48);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, W * 0.6);
  return g;
}

export function createWheel(mats, { radius, width }) {
  const maps = getTireMaps();
  if (!mats.tire.bumpMap) {
    mats.tire.bumpMap = maps.bump;
    mats.tire.bumpScale = 1.4;
    // the map carries the rubber colour; a dark base colour would black out the lettering
    mats.tire.map = maps.color;
    mats.tire.color.setRGB(1, 1, 1);
    mats.tire.needsUpdate = true;
  }
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(tireGeometry(radius, width), mats.tire);
  const disc = new THREE.Mesh(discGeometry(width), mats.rimDisc);
  const lip = new THREE.Mesh(lipGeometry(width), mats.spoke);
  const barrel = new THREE.Mesh(barrelGeometry(width), mats.darkMetal);
  const spokeGeo = spokesGeometry(width);
  const spokes = new THREE.Mesh(spokeGeo.blades, mats.spoke);
  const slots = new THREE.Mesh(spokeGeo.slots, mats.bronze);
  const hub = new THREE.Mesh(hubGeometry(width), mats.spoke);
  const capZ = (width / 2) * 0.6 + 0.025;
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.0035, 8, 48), mats.darkMetal);
  capRing.position.z = capZ + 0.001;
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.04, 48), getCapMaterial());
  cap.position.z = capZ + 0.0012;
  spin.add(tire, disc, lip, barrel, spokes, slots, hub, capRing, cap);
  for (const m of spin.children) {
    m.castShadow = true;
    m.receiveShadow = true;
  }

  // brake disc + caliper, visible through the arch from low angles
  const brakeDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 48), mats.brake);
  brakeDisc.rotation.x = Math.PI / 2;
  brakeDisc.position.z = -0.02;
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.07), mats.darkMetal);
  caliper.position.set(-0.17, 0.08, -0.02);
  caliper.rotation.z = 0.5;

  const steer = new THREE.Group();
  steer.add(spin, brakeDisc, caliper);
  return { steer, spin };
}
