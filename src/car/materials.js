import * as THREE from 'three';
import { MAT } from './bodyGeometry.js';

export const PAINTS = {
  'Ano White': { color: 0xe7e5df, metalness: 0.06, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.2 },
  'Titanium': { color: 0x9c9a95, metalness: 0.75, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.12 },
  'Stealth Grey': { color: 0x3c3e42, metalness: 0.35, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.06 },
  'Midnight': { color: 0x0b0c0f, metalness: 0.25, roughness: 0.28, clearcoat: 1.0, clearcoatRoughness: 0.04 },
  'Ultra Red': { color: 0x8e0f12, metalness: 0.2, roughness: 0.25, clearcoat: 1.0, clearcoatRoughness: 0.03 },
  'Frost Blue': { color: 0x6f8fa8, metalness: 0.4, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.06 },
};

// Point lights produce pin-sharp glints on glossy surfaces that bloom into stars.
// Real studio lights are large softboxes, so cap the direct specular term.
function capGlints(mat, max) {
  const m = max.toFixed(2);
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(${m}));
      #ifdef USE_CLEARCOAT
        clearcoatSpecularDirect = min(clearcoatSpecularDirect, vec3(${m}));
      #endif`,
    );
  };
  mat.customProgramCacheKey = () => `capGlints${m}`;
  return mat;
}

export function createMaterials() {
  const paint = new THREE.MeshPhysicalMaterial({ ...PAINTS['Ano White'], side: THREE.DoubleSide });
  const trim = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.42, metalness: 0.1, clearcoat: 0.35, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x8f7350,
    metalness: 1.0,
    roughness: 0.07,
    transparent: true,
    opacity: 0.93,
    side: THREE.DoubleSide,
    envMapIntensity: 1.3,
  });
  const under = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
  const liner = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95, side: THREE.DoubleSide });
  const jamb = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.6, side: THREE.DoubleSide });
  const doorInner = new THREE.MeshPhysicalMaterial({ color: 0x1c1d20, roughness: 0.55, metalness: 0.1, clearcoat: 0.2, side: THREE.DoubleSide });

  capGlints(paint, 1.0);
  capGlints(trim, 1.0);
  capGlints(glass, 1.0);

  const body = [];
  body[MAT.PAINT] = paint;
  body[MAT.TRIM] = trim;
  body[MAT.GLASS] = glass;
  body[MAT.UNDER] = under;
  body[MAT.LINER] = liner;
  body[MAT.JAMB] = jamb;
  body[MAT.DOOR_INNER] = doorInner;

  const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.82, metalness: 0.0 });
  const rimDisc = new THREE.MeshPhysicalMaterial({ color: 0xc9cbcd, roughness: 0.42, metalness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.25 });
  const spoke = new THREE.MeshPhysicalMaterial({ color: 0x0e0e10, roughness: 0.3, metalness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.45, metalness: 0.8 });
  const titanium = new THREE.MeshPhysicalMaterial({ color: 0xb8b3aa, roughness: 0.22, metalness: 1.0, clearcoat: 0.3 });
  const brake = new THREE.MeshStandardMaterial({ color: 0x55575b, roughness: 0.35, metalness: 0.9 });
  const bronze = new THREE.MeshPhysicalMaterial({ color: 0x9a6a3c, roughness: 0.32, metalness: 1.0, clearcoat: 0.3 });
  const bronzeRim = new THREE.MeshPhysicalMaterial({ color: 0xdcc39b, roughness: 0.2, metalness: 1.0, clearcoat: 0.4 });
  // heat-tinted thruster bore: pale gold at the mouth darkening to brown inside
  const bore = document.createElement('canvas');
  bore.width = 4;
  bore.height = 128;
  const bg = bore.getContext('2d');
  const grad = bg.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#c99a5f');
  grad.addColorStop(0.45, '#8a5a32');
  grad.addColorStop(1, '#2a1a10');
  bg.fillStyle = grad;
  bg.fillRect(0, 0, 4, 128);
  const boreTex = new THREE.CanvasTexture(bore);
  boreTex.colorSpace = THREE.SRGBColorSpace;
  // a faint self-lit term stands in for the light the polished bore catches in photos
  const nozzleBore = new THREE.MeshPhysicalMaterial({ map: boreTex, emissive: 0xffffff, emissiveMap: boreTex, emissiveIntensity: 0.22, roughness: 0.34, metalness: 0.9, side: THREE.DoubleSide });
  for (const m of [rimDisc, spoke, titanium, bronze, bronzeRim, nozzleBore]) capGlints(m, 1.6);

  const lightFront = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xf4f7ff, emissiveIntensity: 0, roughness: 0.3 });
  const lightRear = new THREE.MeshStandardMaterial({ color: 0x120000, emissive: 0xff1418, emissiveIntensity: 0, roughness: 0.3 });
  const lightAmber = new THREE.MeshStandardMaterial({ color: 0x110700, emissive: 0xff8a1e, emissiveIntensity: 0, roughness: 0.3 });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, roughness: 0.08, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.85 });

  const interiorWhite = new THREE.MeshPhysicalMaterial({ color: 0xe6e3dd, roughness: 0.55, metalness: 0, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) });
  const suede = new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.97, metalness: 0 });
  const carbon = new THREE.MeshPhysicalMaterial({ color: 0x141518, roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const cabinDark = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.8 });

  return {
    body,
    paint,
    trim,
    glass,
    under,
    jamb,
    doorInner,
    tire,
    rimDisc,
    spoke,
    darkMetal,
    titanium,
    brake,
    bronze,
    bronzeRim,
    nozzleBore,
    lightFront,
    lightRear,
    lightAmber,
    lens,
    interiorWhite,
    suede,
    carbon,
    cabinDark,
  };
}

export function applyPaint(mat, name) {
  const p = PAINTS[name];
  if (!p) return;
  mat.color.setHex(p.color);
  mat.metalness = p.metalness;
  mat.roughness = p.roughness;
  mat.clearcoat = p.clearcoat;
  mat.clearcoatRoughness = p.clearcoatRoughness;
}
