// Stage 7 Post-Processing Pipeline:
// EffectComposer -> RenderPass -> UnrealBloomPass -> SurvivalGradeShaderPass -> OutputPass

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const SurvivalGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uNightFactor: { value: 0 },
    uColdFactor: { value: 0 },
    uHurtFactor: { value: 0 },
    uStormFactor: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uNightFactor;
    uniform float uColdFactor;
    uniform float uHurtFactor;
    uniform float uStormFactor;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = clamp(tex.rgb, 0.0, 1.0);

      // Gentle perceptual S-curve & warm daylight / moonlit blue lift (in bounded sRGB post-ACES)
      vec3 lifted = col * col * (3.0 - 2.0 * col);
      col = mix(col, lifted, 0.08);

      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      // Cool moonlit blue cast at night & storm slate desaturation
      vec3 nightTint = vec3(luma * 0.78, luma * 0.88, luma * 1.14);
      col = mix(col, nightTint, uNightFactor * 0.2);
      col = mix(col, vec3(luma * 0.92, luma * 0.96, luma * 1.03), uStormFactor * 0.16);

      // Peripheral atmospheric vignette (intensified by cold hypothermia & low health)
      vec2 centered = vUv - vec2(0.5);
      float rad = dot(centered, centered) * 2.1;
      float vig = clamp(rad * (0.22 + uNightFactor * 0.1), 0.0, 0.46);
      col *= (1.0 - vig);

      if (uColdFactor > 0.01) {
        float frostMask = clamp(rad * 1.2 * uColdFactor, 0.0, 0.58);
        col = mix(col, vec3(0.45, 0.72, 0.96), frostMask * 0.48);
      }
      if (uHurtFactor > 0.01) {
        float redMask = clamp(rad * 1.25 * uHurtFactor, 0.0, 0.65);
        col = mix(col, vec3(0.75, 0.08, 0.08), redMask * 0.52);
      }

      // Ultra-subtle film grain for organic texture
      float grain = fract(sin(dot(vUv + fract(uTime * 0.13), vec2(12.9898, 78.233))) * 43758.5453);
      col += (grain - 0.5) * 0.008;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), tex.a);
    }
  `,
};

export class PostFXPipeline {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass;
  private gradePass: ShaderPass;
  private outputPass: OutputPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number
  ) {
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, width), Math.max(1, height)),
      0.22,
      0.34,
      1.28
    );
    this.gradePass = new ShaderPass(SurvivalGradeShader);
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
    this.composer.addPass(this.gradePass);
  }

  public configure(bloomEnabled: boolean, gradeEnabled: boolean) {
    this.bloomPass.enabled = bloomEnabled;
    this.gradePass.enabled = gradeEnabled;
  }

  public setSize(width: number, height: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(Math.max(1, width), Math.max(1, height));
    this.bloomPass.setSize(Math.max(1, width), Math.max(1, height));
  }

  public updateUniforms(opts: {
    nightFactor: number;
    coldFactor: number;
    hurtFactor: number;
    stormFactor: number;
    tSec: number;
  }) {
    this.gradePass.uniforms.uNightFactor.value = opts.nightFactor;
    this.gradePass.uniforms.uColdFactor.value = opts.coldFactor;
    this.gradePass.uniforms.uHurtFactor.value = opts.hurtFactor;
    this.gradePass.uniforms.uStormFactor.value = opts.stormFactor;
    this.gradePass.uniforms.uTime.value = opts.tSec;
  }

  public render() {
    this.composer.render();
  }

  public dispose() {
    this.bloomPass.dispose();
    this.gradePass.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
  }
}
