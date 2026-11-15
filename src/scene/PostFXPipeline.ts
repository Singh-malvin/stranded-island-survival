import * as THREE from 'three';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GRAPHICS_TUNING, WORLD_VISUAL_TUNING } from '../survival/config.ts';

const GodRayShaftShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSunScreenPos: { value: new THREE.Vector2(0.72, 0.65) },
    uSunColor: { value: new THREE.Color(0xffdfa8) },
    uStrength: { value: WORLD_VISUAL_TUNING.GODRAY_INTENSITY_HIGH },
    uWeight: { value: WORLD_VISUAL_TUNING.GODRAY_WEIGHT },
    uDecay: { value: WORLD_VISUAL_TUNING.GODRAY_DECAY },
    uDensity: { value: WORLD_VISUAL_TUNING.GODRAY_DENSITY },
    uSampleSteps: { value: WORLD_VISUAL_TUNING.GODRAY_SAMPLES_HIGH },
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
    uniform vec2 uSunScreenPos;
    uniform vec3 uSunColor;
    uniform float uStrength;
    uniform float uWeight;
    uniform float uDecay;
    uniform float uDensity;
    uniform float uSampleSteps;
    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (uStrength <= 0.005) {
        gl_FragColor = base;
        return;
      }
      int steps = int(clamp(uSampleSteps, 6.0, 24.0));
      vec2 deltaTexCoord = (vUv - uSunScreenPos) * (uDensity / float(steps));
      vec2 coord = vUv;
      float illumDecay = 1.0;
      float accum = 0.0;
      for (int i = 0; i < 24; i++) {
        if (i >= steps) break;
        coord -= deltaTexCoord;
        vec2 cClamped = clamp(coord, vec2(0.001), vec2(0.999));
        vec3 s = texture2D(tDiffuse, cClamped).rgb;
        // Isolate sunlit sky / bright cloud breaks so dark cliff edges cast long crepuscular shafts
        float luma = dot(s, vec3(0.2126, 0.7152, 0.0722));
        float skyMask = smoothstep(0.68, 1.15, luma);
        float inBounds = step(0.0, coord.x) * step(coord.x, 1.0) * step(0.0, coord.y) * step(coord.y, 1.0);
        accum += skyMask * illumDecay * uWeight * inBounds;
        illumDecay *= uDecay;
      }
      float sunProx = 1.0 - smoothstep(0.0, 1.35, length(vUv - uSunScreenPos));
      float shaft = (accum / float(steps)) * uStrength * (0.38 + 0.62 * sunProx);
      gl_FragColor = vec4(base.rgb + uSunColor * shaft, base.a);
    }
  `,
};

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
    uRainDroplets: { value: 0 },
    uUnderwater: { value: 0 },
    uMotionBlur: { value: 0 },
    uMotionVel: { value: new THREE.Vector2(0, 0) },
    uPhotoFilter: { value: 0 },
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
    uniform float uRainDroplets;
    uniform float uUnderwater;
    uniform float uMotionBlur;
    uniform vec2 uMotionVel;
    uniform float uPhotoFilter;
    varying vec2 vUv;

    float randGrain(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233)) + uTime * 3.17) * 43758.5453);
    }

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
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

      // Underwater optical ripple distortion
      if (uUnderwater > 0.005) {
        float uw = uUnderwater * 0.0075;
        sampleUv.x += sin(vUv.y * 22.0 + uTime * 4.2) * uw;
        sampleUv.y += cos(vUv.x * 19.0 + uTime * 3.5) * uw * 0.7;
      }

      // Rain droplets clinging subtly near camera lens edges during storm / post-swim
      float dropletRim = 0.0;
      if (uRainDroplets > 0.005) {
        float edgeMask = smoothstep(0.18, 0.72, dist);
        vec2 gridUv = sampleUv * vec2(15.0, 9.0);
        gridUv.y += uTime * 0.36;
        vec2 id = floor(gridUv);
        vec2 gv = fract(gridUv) - 0.5;
        float rnd = hash21(id);
        vec2 dropPos = vec2((rnd - 0.5) * 0.48, (fract(rnd * 13.7) - 0.5) * 0.48);
        vec2 dv = gv - dropPos;
        float dDrop = length(dv);
        float activeDrop = step(0.56, rnd);
        float radius = mix(0.08, 0.15, fract(rnd * 29.1)) * activeDrop;
        float mask = smoothstep(radius, radius * 0.35, dDrop) * uRainDroplets * edgeMask;
        vec2 refractOff = dv * mask * 0.026;
        sampleUv += refractOff;
        float rimRing = smoothstep(radius * 0.92, radius * 0.70, dDrop) * (1.0 - smoothstep(radius * 0.65, radius * 0.35, dDrop));
        float glint = clamp(dot(normalize(dv + vec2(0.0001)), vec2(-0.55, 0.72)), 0.0, 1.0);
        dropletRim = rimRing * glint * uRainDroplets * edgeMask * 0.12;
      }

      // Edge chromatic aberration (very subtle)
      float caWeight = pow(clamp(dist * 1.45, 0.0, 1.0), 1.8) * (uCaOffset + uUnderwater * 0.0022);
      vec2 uvR = clamp(sampleUv + radialDir * caWeight, vec2(0.0), vec2(1.0));
      vec2 uvB = clamp(sampleUv - radialDir * caWeight, vec2(0.0), vec2(1.0));

      float rCh = texture2D(tDiffuse, uvR).r;
      vec4 base = texture2D(tDiffuse, clamp(sampleUv, vec2(0.0), vec2(1.0)));
      float bCh = texture2D(tDiffuse, uvB).b;
      vec3 col = vec3(rCh, base.g, bCh);

      // Subtle directional camera turn motion blur
      float velMag = length(uMotionVel);
      if (uMotionBlur > 0.01 && velMag > 0.0004) {
        vec2 mbStep = clamp(uMotionVel, vec2(-0.02), vec2(0.02)) * uMotionBlur;
        vec3 m1 = texture2D(tDiffuse, clamp(sampleUv - mbStep, vec2(0.0), vec2(1.0))).rgb;
        vec3 m2 = texture2D(tDiffuse, clamp(sampleUv + mbStep, vec2(0.0), vec2(1.0))).rgb;
        col = mix(col, (col + m1 + m2) / 3.0, clamp(velMag * 28.0, 0.0, 0.45) * uMotionBlur);
      }

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

      // Rain droplet specular rim highlight
      col += vec3(0.76, 0.85, 0.94) * dropletRim;

      // Underwater deep teal-blue absorption & caustics shimmer
      if (uUnderwater > 0.005) {
        float caust = 0.5 + 0.5 * sin(vUv.x * 28.0 + uTime * 3.1) * cos(vUv.y * 24.0 - uTime * 2.4);
        vec3 uwTint = vec3(0.09, 0.42, 0.54) + vec3(0.05, 0.14, 0.16) * caust * (1.0 - dist);
        col = mix(col, col * vec3(0.36, 0.78, 0.90) + uwTint * 0.32, uUnderwater * 0.72);
      }

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

      // Photo Mode grading filter presets (1=Cinematic, 2=Noir, 3=Golden, 4=Vibrant)
      if (uPhotoFilter > 0.5 && uPhotoFilter < 1.5) {
        // Cinematic teal shadows + warm highlights
        float lC = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col *= mix(vec3(0.84, 0.96, 1.08), vec3(1.10, 0.99, 0.88), smoothstep(0.2, 0.8, lC));
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.26);
      } else if (uPhotoFilter >= 1.5 && uPhotoFilter < 2.5) {
        // Noir dramatic monochrome
        float gray = dot(col, vec3(0.299, 0.587, 0.114));
        gray = smoothstep(0.04, 0.96, gray);
        col = vec3(gray) * vec3(0.98, 0.99, 1.02);
      } else if (uPhotoFilter >= 2.5 && uPhotoFilter < 3.5) {
        // Golden sunset glow
        col *= vec3(1.12, 1.01, 0.84);
        col += vec3(0.03, 0.015, 0.0) * (1.0 - dist);
      } else if (uPhotoFilter >= 3.5) {
        // Vibrant tropical punch
        float lV = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(lV), col, 1.32);
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
  godRays?: boolean;
  godRayIntensity?: number;
  godRaySamples?: number;
}

export class PostFXPipeline {
  private composer: EffectComposer;
  private ssaoPass: SSAOPass;
  private godRayPass: ShaderPass;
  private bloomPass: UnrealBloomPass;
  private bokehPass: BokehPass;
  private smaaPass: SMAAPass;
  private gradePass: ShaderPass;
  private ssaoEnabled = false;
  private godRaysEnabled = false;
  private bloomEnabled = false;
  private dofEnabled = false;
  private smaaEnabled = false;
  private gradeEnabled = false;
  private godRayBaseIntensity: number = WORLD_VISUAL_TUNING.GODRAY_INTENSITY_HIGH;

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

    this.godRayPass = new ShaderPass(GodRayShaftShader);
    this.composer.addPass(this.godRayPass);

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

    this.configure({ bloom: true, grade: true, ssao: true, smaa: true, dof: false, godRays: true });
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
    this.godRaysEnabled = opts.godRays !== false && (opts.godRayIntensity ?? this.godRayBaseIntensity) > 0;
    if (opts.godRayIntensity !== undefined) {
      this.godRayBaseIntensity = opts.godRayIntensity;
    }
    if (opts.godRaySamples !== undefined) {
      this.godRayPass.uniforms.uSampleSteps.value = opts.godRaySamples;
    }

    this.ssaoPass.enabled = this.ssaoEnabled;
    this.godRayPass.enabled = this.godRaysEnabled;
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
    rainDroplets?: number;
    underwaterFactor?: number;
    motionBlurStrength?: number;
    motionVelX?: number;
    motionVelY?: number;
    photoFilter?: number;
    sunScreenX?: number;
    sunScreenY?: number;
    sunScreenWeight?: number;
    sunColor?: THREE.Color;
    tSec: number;
  }) {
    const gu = this.godRayPass.uniforms;
    const grW = opts.sunScreenWeight ?? 0;
    const activeRay = this.godRaysEnabled && grW > 0.01 && opts.nightFactor < 0.85;
    this.godRayPass.enabled = activeRay;
    if (activeRay) {
      gu.uSunScreenPos.value.set(opts.sunScreenX ?? 0.5, opts.sunScreenY ?? 0.5);
      gu.uStrength.value =
        this.godRayBaseIntensity *
        grW *
        (1 - opts.nightFactor * 0.9) *
        Math.max(0.28, 1 - opts.stormFactor * 0.45);
      if (opts.sunColor) {
        gu.uSunColor.value.copy(opts.sunColor);
      }
    }

    const u = this.gradePass.uniforms;
    u.uNight.value = opts.nightFactor;
    u.uCold.value = opts.coldFactor;
    u.uHurt.value = opts.hurtFactor;
    u.uStorm.value = opts.stormFactor;
    u.uHeatShimmer.value = opts.heatShimmerFactor ?? 0;
    u.uRainDroplets.value = opts.rainDroplets ?? 0;
    u.uUnderwater.value = opts.underwaterFactor ?? 0;
    u.uMotionBlur.value = opts.motionBlurStrength ?? 0;
    if (u.uMotionVel.value) {
      u.uMotionVel.value.set(opts.motionVelX ?? 0, opts.motionVelY ?? 0);
    }
    u.uPhotoFilter.value = opts.photoFilter ?? 0;
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
