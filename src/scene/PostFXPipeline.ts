import * as THREE from 'three';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GRAPHICS_TUNING } from '../survival/config.ts';

const SurvivalGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uNight: { value: 0 },
    uCold: { value: 0 },
    uHurt: { value: 0 },
    uStorm: { value: 0 },
    uHeatShimmer: { value: 0 },
    uTime: { value: 0 },
    uCaOffset: { value: GRAPHICS_TUNING.CHROMATIC_ABERRATION_OFFSET },
    uGrainIntensity: { value: GRAPHICS_TUNING.FILM_GRAIN_INTENSITY },
    uVignette: { value: GRAPHICS_TUNING.VIGNETTE_DARKNESS },
    uContrast: { value: GRAPHICS_TUNING.GRADE_CONTRAST },
    uSaturation: { value: GRAPHICS_TUNING.GRADE_SATURATION },
    uShadowLift: { value: GRAPHICS_TUNING.SHADOW_LIFT_FLOOR },
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
    uniform float uNight;
    uniform float uCold;
    uniform float uHurt;
    uniform float uStorm;
    uniform float uHeatShimmer;
    uniform float uTime;
    uniform float uCaOffset;
    uniform float uGrainIntensity;
    uniform float uVignette;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uShadowLift;
    varying vec2 vUv;

    float randGrain(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233)) + uTime * 3.17) * 43758.5453);
    }

    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      vec2 radialDir = dist > 0.0001 ? center / dist : vec2(0.0);

      // Subtle hot-day atmospheric mirage shimmer mainly above middle horizon band
      vec2 sampleUv = vUv;
      if (uHeatShimmer > 0.0001) {
        float horizonMask = smoothstep(0.18, 0.58, vUv.y) * (1.0 - smoothstep(0.68, 0.98, vUv.y));
        float waveX = sin(vUv.y * 54.0 + uTime * 7.2) * cos(vUv.x * 26.0 - uTime * 4.1);
        sampleUv.x += waveX * uHeatShimmer * horizonMask;
        sampleUv.y += cos(vUv.x * 42.0 + uTime * 6.5) * uHeatShimmer * 0.55 * horizonMask;
      }

      // Edge chromatic aberration (very subtle)
      float caWeight = pow(clamp(dist * 1.45, 0.0, 1.0), 1.8) * uCaOffset;
      vec2 uvR = clamp(sampleUv + radialDir * caWeight, vec2(0.0), vec2(1.0));
      vec2 uvB = clamp(sampleUv - radialDir * caWeight, vec2(0.0), vec2(1.0));

      float rCh = texture2D(tDiffuse, uvR).r;
      vec4 base = texture2D(tDiffuse, clamp(sampleUv, vec2(0.0), vec2(1.0)));
      float bCh = texture2D(tDiffuse, uvB).b;
      vec3 col = vec3(rCh, base.g, bCh);

      // Hypothermia stage 4 & 5 screen-edge blur when uCold > 0.42 (< 34.5 C)
      float edgeBlurMask = smoothstep(0.26, 0.72, dist) * clamp((uCold - 0.40) * 1.65, 0.0, 1.0);
      if (edgeBlurMask > 0.01) {
        vec2 bStep = radialDir * 0.0045 * edgeBlurMask;
        vec3 b1 = texture2D(tDiffuse, clamp(sampleUv + bStep, vec2(0.0), vec2(1.0))).rgb;
        vec3 b2 = texture2D(tDiffuse, clamp(sampleUv - bStep, vec2(0.0), vec2(1.0))).rgb;
        col = mix(col, 0.5 * (b1 + b2), edgeBlurMask * 0.75);
      }

      // Lifted shadows so caves/jungle undersides never crush to pitch black
      col = col + vec3(uShadowLift) * (1.0 - col);

      // Natural warm sunlight highlights & cool shadow fill
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.92, 0.96, 1.04);
      vec3 highlightTint = vec3(1.03, 1.00, 0.95);
      col *= mix(shadowTint, highlightTint, smoothstep(0.15, 0.85, luma));

      // Gentle saturation & soft S-curve contrast (no harsh blown-out sand or crushed blacks)
      col = mix(vec3(luma), col, mix(uSaturation, 0.88, uStorm * 0.7 + uNight * 0.28));
      col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);

      // Night cool moonlight tint
      col = mix(col, col * vec3(0.82, 0.90, 1.06), uNight * 0.34);

      // Hypothermia cold rim frost (crystalline pattern near edges at Severe stage)
      float vig = smoothstep(0.28, 0.84, dist);
      float frostCrystal = 0.85 + 0.15 * sin(vUv.x * 90.0 + cos(vUv.y * 90.0));
      vec3 frost = vec3(0.54, 0.80, 0.98) * frostCrystal;
      col = mix(col, frost, vig * uCold * 0.62);

      // Low HP (<25%) subtle perimeter pulse
      if (uHurt > 0.001) {
        float pulse = 0.78 + 0.22 * sin(uTime * 6.5);
        vec3 blood = vec3(0.62, 0.07, 0.07);
        col = mix(col, blood, vig * uHurt * 0.52 * pulse);
      }

      // Subtle cinematic vignette & light film grain
      col *= 1.0 - smoothstep(0.42, 0.96, dist) * uVignette;
      float grain = (randGrain(vUv * vec2(1280.0, 720.0)) - 0.5) * uGrainIntensity;
      col += grain;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), base.a);
    }
  `,
};

export interface PostFXConfigOptions {
  bloom: boolean;
  grade: boolean;
  ssao?: boolean;
  smaa?: boolean;
  dof?: boolean;
}

export class PostFXPipeline {
  private composer: EffectComposer;
  private ssaoPass: SSAOPass;
  private bloomPass: UnrealBloomPass;
  private bokehPass: BokehPass;
  private smaaPass: SMAAPass;
  private gradePass: ShaderPass;
  private ssaoEnabled = false;
  private bloomEnabled = false;
  private dofEnabled = false;
  private smaaEnabled = false;
  private gradeEnabled = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ) {
    const safeW = Math.max(2, width);
    const safeH = Math.max(2, height);
    const rt = new THREE.WebGLRenderTarget(safeW, safeH, {
      type: THREE.HalfFloatType,
      samples: 0,
    });
    this.composer = new EffectComposer(renderer, rt);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    this.ssaoPass = new SSAOPass(scene, camera, safeW, safeH, 32);
    this.ssaoPass.output = SSAOPass.OUTPUT.Default;
    this.ssaoPass.kernelRadius = GRAPHICS_TUNING.SSAO_KERNEL_RADIUS;
    this.ssaoPass.minDistance = GRAPHICS_TUNING.SSAO_MIN_DISTANCE;
    this.ssaoPass.maxDistance = GRAPHICS_TUNING.SSAO_MAX_DISTANCE;
    this.composer.addPass(this.ssaoPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(safeW, safeH),
      GRAPHICS_TUNING.BLOOM_STRENGTH,
      GRAPHICS_TUNING.BLOOM_RADIUS,
      GRAPHICS_TUNING.BLOOM_THRESHOLD
    );
    this.composer.addPass(this.bloomPass);

    this.bokehPass = new BokehPass(scene, camera, {
      focus: GRAPHICS_TUNING.DOF_FOCUS_DISTANCE,
      aperture: GRAPHICS_TUNING.DOF_APERTURE,
      maxblur: GRAPHICS_TUNING.DOF_MAX_BLUR,
    });
    this.composer.addPass(this.bokehPass);

    // SMAA runs in linear space prior to OutputPass tone mapping / sRGB conversion
    this.smaaPass = new SMAAPass();
    this.composer.addPass(this.smaaPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    this.gradePass = new ShaderPass(SurvivalGradeShader);
    this.composer.addPass(this.gradePass);

    this.configure({ bloom: true, grade: true, ssao: true, smaa: true, dof: false });
  }

  public configure(optsOrBloom: PostFXConfigOptions | boolean, legacyGrade?: boolean) {
    const opts: PostFXConfigOptions =
      typeof optsOrBloom === 'boolean'
        ? { bloom: optsOrBloom, grade: Boolean(legacyGrade) }
        : optsOrBloom;

    this.bloomEnabled = opts.bloom;
    this.gradeEnabled = opts.grade;
    this.ssaoEnabled = Boolean(opts.ssao);
    this.smaaEnabled = Boolean(opts.smaa);
    this.dofEnabled = Boolean(opts.dof);

    this.ssaoPass.enabled = this.ssaoEnabled;
    this.bloomPass.enabled = this.bloomEnabled;
    this.bokehPass.enabled = this.dofEnabled;
    this.smaaPass.enabled = this.smaaEnabled;
    this.gradePass.enabled = this.gradeEnabled;
  }

  public setSize(width: number, height: number, pixelRatio: number) {
    const safeW = Math.max(2, width);
    const safeH = Math.max(2, height);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(safeW, safeH);
  }

  public updateUniforms(opts: {
    nightFactor: number;
    coldFactor: number;
    hurtFactor: number;
    stormFactor: number;
    heatShimmerFactor?: number;
    tSec: number;
  }) {
    const u = this.gradePass.uniforms;
    u.uNight.value = opts.nightFactor;
    u.uCold.value = opts.coldFactor;
    u.uHurt.value = opts.hurtFactor;
    u.uStorm.value = opts.stormFactor;
    u.uHeatShimmer.value = opts.heatShimmerFactor ?? 0;
    u.uTime.value = opts.tSec;
  }

  public hasActivePasses(): boolean {
    return (
      this.ssaoEnabled ||
      this.bloomEnabled ||
      this.dofEnabled ||
      this.smaaEnabled ||
      this.gradeEnabled
    );
  }

  public render() {
    this.composer.render();
  }

  public dispose() {
    this.ssaoPass.dispose();
    this.bloomPass.dispose();
    this.bokehPass.dispose();
    this.smaaPass.dispose();
    this.composer.dispose();
  }
}
