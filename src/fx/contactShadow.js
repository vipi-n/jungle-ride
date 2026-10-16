import * as THREE from 'three';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';

// Soft ambient-occlusion style shadow under the car: renders the car's depth
// from below into a small target, blurs it, and projects it onto the floor.
export class ContactShadow {
  constructor(renderer, { width = 6.4, depth = 3.6, height = 1.4, res = 512, layer = 1 } = {}) {
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.position.y = 0.002;
    this.width = width;
    this.depth = depth;
    const rx = res;
    const ry = Math.round((res * depth) / width);
    this.rt = new THREE.WebGLRenderTarget(rx, ry, { type: THREE.HalfFloatType });
    this.rt.texture.generateMipmaps = false;
    this.rtBlur = new THREE.WebGLRenderTarget(rx, ry, { type: THREE.HalfFloatType });
    this.rtBlur.texture.generateMipmaps = false;

    const planeGeo = new THREE.PlaneGeometry(width, depth).rotateX(Math.PI / 2);
    this.planeMat = new THREE.MeshBasicMaterial({ map: this.rt.texture, transparent: true, depthWrite: false, opacity: 1 });
    this.plane = new THREE.Mesh(planeGeo, this.planeMat);
    this.plane.renderOrder = 1;
    this.plane.scale.y = -1;
    this.group.add(this.plane);

    this.blurPlane = new THREE.Mesh(planeGeo);
    this.blurPlane.visible = false;
    this.group.add(this.blurPlane);

    this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0, height);
    this.camera.rotation.x = Math.PI / 2;
    this.camera.layers.set(layer);
    this.group.add(this.camera);

    this.depthMat = new THREE.MeshDepthMaterial();
    this.depthMat.userData.darkness = { value: 1.3 };
    this.depthMat.onBeforeCompile = (shader) => {
      shader.uniforms.darkness = this.depthMat.userData.darkness;
      shader.fragmentShader = /* glsl */ `
        uniform float darkness;
        ${shader.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );')}
      `;
    };
    this.depthMat.depthTest = false;
    this.depthMat.depthWrite = false;
    this.depthMat.side = THREE.DoubleSide;

    this.hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
    this.hBlur.depthTest = false;
    this.vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
    this.vBlur.depthTest = false;
    this.blur = 2.6;
    this.opacity = 0.92;
  }

  setDarkness(v) {
    this.depthMat.userData.darkness.value = v;
  }

  blurPass(amount) {
    const r = this.renderer;
    this.blurPlane.visible = true;
    this.blurPlane.material = this.hBlur;
    this.hBlur.uniforms.tDiffuse.value = this.rt.texture;
    this.hBlur.uniforms.h.value = amount / 256;
    r.setRenderTarget(this.rtBlur);
    r.render(this.blurPlane, this.camera);
    this.blurPlane.material = this.vBlur;
    this.vBlur.uniforms.tDiffuse.value = this.rtBlur.texture;
    this.vBlur.uniforms.v.value = amount / 256;
    r.setRenderTarget(this.rt);
    r.render(this.blurPlane, this.camera);
    this.blurPlane.visible = false;
  }

  render(scene) {
    const r = this.renderer;
    this.planeMat.opacity = this.opacity;
    const bg = scene.background;
    const ov = scene.overrideMaterial;
    const clearAlpha = r.getClearAlpha();
    const prevTarget = r.getRenderTarget();
    const autoClear = r.autoClear;
    scene.background = null;
    scene.overrideMaterial = this.depthMat;
    this.plane.visible = false;
    r.setClearAlpha(0);
    r.autoClear = true;
    const shadowEnabled = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, this.camera);
    scene.overrideMaterial = ov;
    this.blurPass(this.blur);
    this.blurPass(this.blur * 0.4);
    r.shadowMap.autoUpdate = shadowEnabled;
    r.setRenderTarget(prevTarget);
    r.setClearAlpha(clearAlpha);
    r.autoClear = autoClear;
    scene.background = bg;
    this.plane.visible = true;
  }
}
