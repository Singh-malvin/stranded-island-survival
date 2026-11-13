import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GRAPHICS_TUNING, WORLD } from '../survival/config.ts';
import type { WeatherState } from '../survival/types.ts';

/**
 * Generates a tileable procedural noise texture for micro surface detail modulation.
 */
export function createTerrainDetailTexture(size: number = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const u = x / size;
      const v = y / size;
      const w1 = Math.sin(u * Math.PI * 8) * Math.cos(v * Math.PI * 8);
      const w2 = Math.sin((u + v) * Math.PI * 16);
      const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      const grain = hash - Math.floor(hash);
      const val = Math.max(
        180,
        Math.min(255, Math.floor(228 + w1 * 12 + w2 * 8 + (grain - 0.5) * 28))
      );
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 36);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function createRainStreakTexture(size: number = 32): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const cx = size / 2;
  for (let y = 0; y < size; y++) {
    const yf = y / (size - 1);
    const vFade = Math.sin(yf * Math.PI);
    for (let x = 0; x < size; x++) {
      const dist = Math.abs(x - cx) / (size * 0.22);
      const hFade = Math.max(0, 1 - dist * dist);
      const alpha = Math.floor(Math.max(0, Math.min(255, vFade * hFade * 235)));
      const idx = (y * size + x) * 4;
      data[idx] = 215;
      data[idx + 1] = 230;
      data[idx + 2] = 255;
      data[idx + 3] = alpha;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export function createSoftMistTexture(size: number = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const r2 = dx * dx + dy * dy;
      const a = Math.max(0, 1 - r2);
      const smooth = a * a * 255;
      const idx = (y * size + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.floor(smooth);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export interface OceanWaterHandle {
  shaderMaterial: THREE.ShaderMaterial;
  fallbackMaterial: THREE.MeshLambertMaterial;
}

const dummyReflectionTex = new THREE.DataTexture(
  new Uint8Array([110, 165, 215, 255]),
  1,
  1,
  THREE.RGBAFormat
);
dummyReflectionTex.needsUpdate = true;

export function createOceanWaterMaterials(islandRadius: number): OceanWaterHandle {
  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.45, 0.72, 0.52).normalize() },
      uSunColor: { value: new THREE.Color(0xfff4dc) },
      uSkyHorizon: { value: new THREE.Color(0xbce2fa) },
      uFogColor: { value: new THREE.Color(0x9fd0ea) },
      uFogDensity: { value: 0.0055 },
      uWind: { value: 0.28 },
      uStorm: { value: 0 },
      uNight: { value: 0 },
      uIslandRadius: { value: islandRadius },
      uReflectionMap: { value: dummyReflectionTex },
      uHasPlanarReflection: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeaDepth;
      uniform float uTime;
      uniform float uWind;
      uniform float uStorm;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vWaveCrest;
      varying float vSeaDepth;
      varying float vViewDist;
      varying vec4 vProjPos;

      float waveComponent(vec2 p, vec2 dir, float freq, float speed, float t) {
        return sin(dot(p, dir) * freq + t * speed);
      }

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        float seaDepth = max(0.0, aSeaDepth);
        float shoreAtten = smoothstep(0.08, 3.6, seaDepth);
        float stormAmp = (0.14 + uWind * 0.24 + uStorm * 0.48) * (0.35 + 0.65 * shoreAtten);

        float w1 = waveComponent(worldPos.xz, normalize(vec2(1.0, 0.35)), 0.16, 1.35, uTime);
        float w2 = waveComponent(worldPos.xz, normalize(vec2(-0.55, 0.84)), 0.27, 1.85, uTime);
        float w3 = waveComponent(worldPos.xz, normalize(vec2(0.42, -0.91)), 0.48, 2.35, uTime);
        float w4 = waveComponent(worldPos.xz, normalize(vec2(-0.88, -0.45)), 0.79, 2.95, uTime);

        float disp = (w1 * 0.46 + w2 * 0.30 + w3 * 0.16 + w4 * 0.08) * stormAmp;
        // Swash gentle surf lift right on shoreline
        float surfWash = sin(seaDepth * 3.8 - uTime * 2.1) * 0.045 * (1.0 - smoothstep(0.0, 1.4, seaDepth));
        worldPos.y += disp + surfWash;

        float eps = 0.32;
        vec2 px = worldPos.xz + vec2(eps, 0.0);
        vec2 pz = worldPos.xz + vec2(0.0, eps);
        float hx = (
          waveComponent(px, normalize(vec2(1.0, 0.35)), 0.16, 1.35, uTime) * 0.46 +
          waveComponent(px, normalize(vec2(-0.55, 0.84)), 0.27, 1.85, uTime) * 0.30 +
          waveComponent(px, normalize(vec2(0.42, -0.91)), 0.48, 2.35, uTime) * 0.16 +
          waveComponent(px, normalize(vec2(-0.88, -0.45)), 0.79, 2.95, uTime) * 0.08
        ) * stormAmp;
        float hz = (
          waveComponent(pz, normalize(vec2(1.0, 0.35)), 0.16, 1.35, uTime) * 0.46 +
          waveComponent(pz, normalize(vec2(-0.55, 0.84)), 0.27, 1.85, uTime) * 0.30 +
          waveComponent(pz, normalize(vec2(0.42, -0.91)), 0.48, 2.35, uTime) * 0.16 +
          waveComponent(pz, normalize(vec2(-0.88, -0.45)), 0.79, 2.95, uTime) * 0.08
        ) * stormAmp;

        vec3 calcNormal = normalize(vec3(disp - hx, eps, disp - hz));

        vWorldPos = worldPos.xyz;
        vNormalW = calcNormal;
        vWaveCrest = clamp((disp / max(0.06, stormAmp)) * 0.5 + 0.5, 0.0, 1.0);
        vSeaDepth = seaDepth;

        vec4 mvPos = viewMatrix * worldPos;
        vViewDist = -mvPos.z;
        vProjPos = projectionMatrix * mvPos;
        gl_Position = vProjPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyHorizon;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uWind;
      uniform float uStorm;
      uniform float uNight;
      uniform float uIslandRadius;
      uniform sampler2D uReflectionMap;
      uniform float uHasPlanarReflection;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vWaveCrest;
      varying float vSeaDepth;
      varying float vViewDist;
      varying vec4 vProjPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm2(vec2 p) {
        return valueNoise(p) * 0.62 + valueNoise(p * 2.13 + vec2(7.3, 4.1)) * 0.38;
      }

      float causticPattern(vec2 uv, float t) {
        vec2 p1 = uv * 1.45 + vec2(t * 0.28, -t * 0.19);
        vec2 p2 = uv * 1.92 - vec2(t * 0.22, t * 0.31);
        float c1 = abs(sin(p1.x + sin(p1.y * 1.3)) + cos(p1.y + cos(p1.x * 1.2)));
        float c2 = abs(sin(p2.x - cos(p2.y * 1.4)) + cos(p2.y + sin(p2.x * 1.1)));
        float ridge = 1.0 - clamp(min(c1, c2) * 0.85, 0.0, 1.0);
        return pow(ridge, 3.0);
      }

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);

        // Multi-scale micro-ripple normal perturbation
        vec2 uv1 = vWorldPos.xz * 0.72 + vec2(uTime * 0.21, uTime * 0.15);
        vec2 uv2 = vWorldPos.xz * 1.85 - vec2(uTime * 0.31, -uTime * 0.23);
        vec2 uv3 = vWorldPos.xz * 4.40 + vec2(-uTime * 0.42, uTime * 0.36);
        float n1 = sin(uv1.x * 2.4 + cos(uv1.y * 1.9)) * 0.5;
        float n2 = cos(uv2.y * 2.6 + sin(uv2.x * 2.3)) * 0.32;
        float n3 = sin(uv3.x * 1.8 - uv3.y * 2.1) * 0.18;
        float rippleFade = 1.0 - smoothstep(18.0, 140.0, vViewDist);
        float amp = (0.045 + uWind * 0.045 + uStorm * 0.07) * (0.35 + 0.65 * rippleFade);

        vec3 N = normalize(vNormalW + vec3((n1 + n2 + n3) * amp, 0.0, (n2 - n1 + n3 * 0.6) * amp));
        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);

        // Fresnel (Schlick F0 = 0.022 for seawater)
        float ndotv = clamp(dot(N, V), 0.0, 1.0);
        float fresnel = 0.022 + 0.978 * pow(1.0 - ndotv, 4.6);

        // Depth-driven turquoise -> cerulean -> deep cobalt refraction color
        float shallowMix = 1.0 - smoothstep(0.0, 2.9, vSeaDepth);
        float midMix = 1.0 - smoothstep(1.8, 9.5, vSeaDepth);

        vec3 shoreSandTint = vec3(0.55, 0.50, 0.39);
        vec3 shallowTurquoise = vec3(0.06, 0.58, 0.56);
        vec3 tropicalTeal = vec3(0.03, 0.34, 0.44);
        vec3 deepAbyss = vec3(0.015, 0.10, 0.22);

        vec3 refracted = mix(deepAbyss, tropicalTeal, midMix);
        refracted = mix(refracted, shallowTurquoise, shallowMix * 0.88);
        // Very shallow wet shore sand shows beneath refracted water with animated caustics
        float wetBed = 1.0 - smoothstep(0.0, 0.95, vSeaDepth);
        refracted = mix(refracted, shoreSandTint * vec3(0.75, 0.95, 0.98), wetBed * 0.58);

        float caustics = causticPattern(vWorldPos.xz, uTime) * shallowMix * (1.0 - uNight * 0.88) * (1.0 - uStorm * 0.65);
        refracted += vec3(0.18, 0.34, 0.32) * caustics * 0.42;

        // Subsurface crest glow when waves catch low sunlight
        float sss = pow(clamp(dot(V, -L + N * 0.55), 0.0, 1.0), 3.0) * vWaveCrest * (1.0 - uNight);
        refracted += vec3(0.03, 0.45, 0.42) * sss * (0.48 + uStorm * 0.25);

        // Night & Storm ocean darkening
        vec3 stormTint = mix(vec3(1.0), vec3(0.45, 0.55, 0.62), uStorm * 0.72);
        vec3 nightTint = mix(vec3(1.0), vec3(0.14, 0.22, 0.34), uNight * 0.85);
        refracted *= stormTint * nightTint;

        // Reflection: combine sky gradient/planar reflection sample
        vec3 R = reflect(-V, N);
        float reflElev = clamp(R.y, 0.0, 1.0);
        vec3 zenithRefl = mix(vec3(0.10, 0.34, 0.66), vec3(0.02, 0.05, 0.12), uNight);
        vec3 skyRefl = mix(uSkyHorizon * (1.0 - uNight * 0.55), zenithRefl, pow(reflElev, 0.6));

        if (uHasPlanarReflection > 0.5) {
          vec2 screenUv = (vProjPos.xy / max(0.001, vProjPos.w)) * 0.5 + 0.5;
          // Mirror texture is vertically inverted when rendered with flipped camera or normal UV Y
          vec2 reflUv = clamp(vec2(screenUv.x, 1.0 - screenUv.y) + N.xz * 0.055, vec2(0.005), vec2(0.995));
          vec3 planar = min(texture2D(uReflectionMap, reflUv).rgb, vec3(1.6));
          skyRefl = mix(skyRefl, planar, 0.68);
        }

        // Crisp sun specular glints + broad sheen
        float specTight = pow(max(dot(N, H), 0.0), 340.0) * (1.0 - uStorm * 0.82) * (1.0 - uNight * 0.88);
        float specBroad = pow(max(dot(N, H), 0.0), 36.0) * 0.18 * (1.0 - uStorm * 0.7) * (1.0 - uNight * 0.8);
        vec3 specular = uSunColor * (specTight * 2.4 + specBroad);

        // Swirling coastal surf foam + offshore wind whitecaps
        float surfBand = 1.0 - smoothstep(0.02, 0.72, vSeaDepth);
        float surfCycle = sin(vSeaDepth * 6.5 - uTime * 2.4 + fbm2(vWorldPos.xz * 0.35) * 4.2) * 0.5 + 0.5;
        float foamNoise = fbm2(vWorldPos.xz * 1.35 + vec2(uTime * 0.25, -uTime * 0.18));
        float shoreFoam = surfBand * smoothstep(0.32, 0.76, foamNoise * 0.75 + surfCycle * 0.45);
        float crestFoam = smoothstep(0.68 - uStorm * 0.24, 0.96, vWaveCrest * 0.65 + foamNoise * 0.52) *
          (0.18 + uWind * 0.45 + uStorm * 0.65);
        float foam = clamp(shoreFoam * 0.92 + crestFoam * 0.55, 0.0, 0.95);
        vec3 foamColor = mix(vec3(0.92, 0.96, 0.98), vec3(0.24, 0.30, 0.38), uNight * 0.76);

        vec3 waterColor = mix(refracted, skyRefl, clamp(fresnel * 0.92, 0.04, 0.92)) + specular;
        waterColor = mix(waterColor, foamColor, foam);

        // Soft shoreline transparency fade right at the beach feather
        float alpha = smoothstep(0.0, 0.14, vSeaDepth + surfWashDistort(vWorldPos.xz, uTime));
        alpha = clamp(max(alpha, 0.78), 0.78, 0.98);
        if (vSeaDepth < 0.12) {
          alpha = smoothstep(0.0, 0.12, vSeaDepth);
        }

        // Exponential distance fog matching Three.js FogExp2
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vViewDist * vViewDist);
        waterColor = mix(waterColor, uFogColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(waterColor, clamp(max(alpha, fogFactor * 0.5), 0.12, 1.0));
      }

      float surfWashDistort(vec2 xz, float t) {
        return sin(xz.x * 0.9 + t * 1.4) * 0.025 + cos(xz.y * 0.8 - t * 1.1) * 0.025;
      }
    `,
    transparent: true,
    depthWrite: true,
  });

  // Note: move surfWashDistort above main() in GLSL so WebGL 1/2 compilers never fail forward ref!
  shaderMaterial.fragmentShader = shaderMaterial.fragmentShader
    .replace(
      'float surfWashDistort(vec2 xz, float t) {\n        return sin(xz.x * 0.9 + t * 1.4) * 0.025 + cos(xz.y * 0.8 - t * 1.1) * 0.025;\n      }\n',
      ''
    )
    .replace(
      'void main() {',
      `float surfWashDistort(vec2 xz, float t) {
        return sin(xz.x * 0.9 + t * 1.4) * 0.025 + cos(xz.y * 0.8 - t * 1.1) * 0.025;
      }

      void main() {`
    );

  const fallbackMaterial = new THREE.MeshLambertMaterial({
    color: 0x0f5e7a,
    transparent: true,
    opacity: 0.88,
  });

  return { shaderMaterial, fallbackMaterial };
}

export interface SkyDomeHandle {
  mesh: THREE.Group;
  physicalSky: Sky;
  cloudDome: THREE.Mesh;
  material: THREE.ShaderMaterial;
  iblScene: THREE.Scene;
  iblSky: Sky;
  updatePhysicalSky: (
    tSec: number,
    sunDir: THREE.Vector3,
    sunElev: number,
    storm: number,
    night: number
  ) => void;
}

export function buildAtmosphericSkyDome(scene: THREE.Scene): SkyDomeHandle {
  const skyGroup = new THREE.Group();

  const physicalSky = new Sky();
  physicalSky.scale.setScalar(4200);
  physicalSky.renderOrder = -12;
  // Scale & clamp Three.js Sky HDR Preetham radiance so midday zenith/horizon stay rich blue and never white-out bloom
  physicalSky.material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( texColor, 1.0 );',
      'vec3 calSky = texColor * 0.44; calSky = calSky / (vec3(1.0) + calSky * 0.35); gl_FragColor = vec4( min(calSky, vec3(0.96)), 1.0 );'
    );
  };
  physicalSky.material.customProgramCacheKey = () => 'stranded-sky-calibrated-v1';
  const su = physicalSky.material.uniforms;
  su.turbidity.value = GRAPHICS_TUNING.SKY_TURBIDITY_DAY;
  su.rayleigh.value = GRAPHICS_TUNING.SKY_RAYLEIGH_DAY;
  su.mieCoefficient.value = GRAPHICS_TUNING.SKY_MIE_COEFFICIENT;
  su.mieDirectionalG.value = GRAPHICS_TUNING.SKY_MIE_DIRECTIONAL_G;
  su.sunPosition.value.set(0.4, 0.5, 0.6).normalize();
  if (su.showSunDisc) su.showSunDisc.value = 0;
  if (su.cloudCoverage) su.cloudCoverage.value = 0;
  skyGroup.add(physicalSky);

  // Separate minimal scene for fast periodic PMREMGenerator IBL probes (calibrated sky radiance prevents HDR blowout)
  const iblScene = new THREE.Scene();
  const iblSky = new Sky();
  iblSky.scale.setScalar(1000);
  iblSky.material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( texColor, 1.0 );',
      'vec3 calSky = texColor * 0.40; gl_FragColor = vec4( min(calSky, vec3(0.95)), 1.0 );'
    );
  };
  iblSky.material.customProgramCacheKey = () => 'stranded-ibl-sky-calibrated-v1';
  const iu = iblSky.material.uniforms;
  if (iu.showSunDisc) iu.showSunDisc.value = 0;
  if (iu.cloudCoverage) iu.cloudCoverage.value = 0;
  iblScene.add(iblSky);

  const geom = new THREE.SphereGeometry(560, 48, 32);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uZenithColor: { value: new THREE.Color(0x1f62b5) },
      uHorizonColor: { value: new THREE.Color(0x9fd0ea) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.6).normalize() },
      uSunColor: { value: new THREE.Color(0xfff4d6) },
      uStorm: { value: 0 },
      uNight: { value: 0 },
      uLightning: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uStorm;
      uniform float uNight;
      uniform float uLightning;
      varying vec3 vDir;

      float hash31(vec3 p) {
        p = fract(p * vec3(443.897, 441.423, 437.195));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.5);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float cloudFbm(vec2 p) {
        float v = 0.0;
        float amp = 0.52;
        vec2 shift = vec2(19.3, 11.7);
        for (int i = 0; i < 4; i++) {
          v += amp * noise2(p);
          p = p * 2.04 + shift;
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float elev = clamp(d.y, -0.05, 1.0);

        // Layered procedural cumulus clouds projected onto virtual altitude plane
        float planeY = max(0.085, d.y + 0.05);
        vec2 cloudUv = d.xz / planeY;
        float drift = uTime * 0.011;
        vec2 warp = vec2(
          cloudFbm(cloudUv * 0.38 + vec2(drift * 0.7, 0.0)),
          cloudFbm(cloudUv * 0.38 + vec2(4.2, drift * 0.6))
        );
        float cDensity = cloudFbm(cloudUv * 0.62 + warp * 0.65 + vec2(drift, drift * 0.35));
        float coverage = mix(0.43, 0.16, uStorm);
        float clouds = smoothstep(coverage, coverage + 0.32, cDensity) * smoothstep(0.005, 0.15, d.y);

        // Directional cloud self-shadow & silver-lining Mie highlight toward sun
        float dNext = cloudFbm((cloudUv + uSunDir.xz * 0.14) * 0.62 + warp * 0.65 + vec2(drift, drift * 0.35));
        float lit = clamp(0.58 + (cDensity - dNext) * 2.3, 0.12, 1.0);
        float sunForward = pow(max(dot(d, normalize(uSunDir)), 0.0), 10.0);

        vec3 cloudLit = mix(vec3(0.68, 0.74, 0.82), uSunColor * 0.72, 0.38);
        cloudLit += uSunColor * sunForward * 0.24;
        vec3 cloudShadow = mix(uHorizonColor * 0.46, vec3(0.22, 0.28, 0.38), 0.52 + uStorm * 0.36);
        vec3 cloudCol = mix(cloudShadow, cloudLit, lit);
        cloudCol = mix(cloudCol, vec3(0.08, 0.11, 0.18), uNight * 0.88);
        cloudCol += vec3(0.65, 0.78, 0.95) * uLightning * 0.75;

        // Night canopy blend & crisp starfield peeking between clouds
        float nightAlpha = clamp(uNight * 0.94, 0.0, 0.94);
        vec3 nightBase = mix(uHorizonColor * 0.18, uZenithColor * 0.14, pow(max(0.0, elev), 0.55));
        vec3 starGrid = floor(d * 290.0);
        float starRand = hash31(starGrid);
        float starMask = step(0.9958, starRand) * smoothstep(0.08, 0.48, d.y) * uNight * (1.0 - uStorm * 0.9) * (1.0 - clouds);
        float twinkle = 0.72 + 0.28 * sin(uTime * 2.2 + starRand * 40.0);
        vec3 starCol = mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.95, 0.84), fract(starRand * 19.7)) * starMask * twinkle * 1.25;

        // Horizon atmospheric haze softening distant island silhouette
        float horizonHaze = pow(1.0 - clamp(abs(d.y), 0.0, 1.0), 6.0) * 0.14 * (1.0 - uNight * 0.8);

        // Soft controlled HDR solar disc & warm corona (won't explode bloom across screen)
        float sunCos = max(dot(d, normalize(uSunDir)), 0.0);
        float sunDiscGlow = pow(sunCos, 680.0) * 1.45 + pow(sunCos, 28.0) * 0.16;
        vec3 sunOverlay = uSunColor * sunDiscGlow * (1.0 - uNight) * (1.0 - uStorm * 0.85) * (1.0 - clouds * 0.72);

        vec3 outRgb = mix(cloudCol, nightBase + starCol, nightAlpha * (1.0 - clouds * 0.72));
        outRgb = mix(outRgb, uHorizonColor * 0.88, horizonHaze * (1.0 - uNight * 0.6));
        outRgb += sunOverlay;
        float sunAlpha = clamp(sunDiscGlow * 0.85 * (1.0 - uNight) * (1.0 - uStorm * 0.85), 0.0, 0.92);
        float outAlpha = clamp(max(max(clouds * (0.80 + uStorm * 0.15), max(nightAlpha, horizonHaze)), sunAlpha), 0.0, 1.0);

        gl_FragColor = vec4(outRgb, outAlpha);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    fog: false,
  });

  const cloudDome = new THREE.Mesh(geom, material);
  cloudDome.renderOrder = -10;
  skyGroup.add(cloudDome);
  scene.add(skyGroup);

  const updatePhysicalSky = (
    tSec: number,
    sunDir: THREE.Vector3,
    sunElev: number,
    storm: number,
    night: number
  ) => {
    material.uniforms.uTime.value = tSec;
    const lowSun = 1 - THREE.MathUtils.clamp((sunElev - 0.02) / 0.35, 0, 1);
    const turbidity = THREE.MathUtils.lerp(
      GRAPHICS_TUNING.SKY_TURBIDITY_DAY,
      GRAPHICS_TUNING.SKY_TURBIDITY_DUSK,
      lowSun * 0.85 + storm * 0.6
    );
    const rayleigh = THREE.MathUtils.lerp(
      GRAPHICS_TUNING.SKY_RAYLEIGH_DAY,
      GRAPHICS_TUNING.SKY_RAYLEIGH_DUSK,
      lowSun * 0.7
    ) * (1 - night * 0.72);
    const mieCoeff = GRAPHICS_TUNING.SKY_MIE_COEFFICIENT + storm * 0.008;

    const u1 = physicalSky.material.uniforms;
    u1.turbidity.value = turbidity;
    u1.rayleigh.value = rayleigh;
    u1.mieCoefficient.value = mieCoeff;
    u1.mieDirectionalG.value = GRAPHICS_TUNING.SKY_MIE_DIRECTIONAL_G;
    u1.sunPosition.value.copy(sunDir);
    if (u1.showSunDisc) u1.showSunDisc.value = 0;

    const u2 = iblSky.material.uniforms;
    u2.turbidity.value = turbidity;
    u2.rayleigh.value = rayleigh;
    u2.mieCoefficient.value = mieCoeff;
    u2.mieDirectionalG.value = GRAPHICS_TUNING.SKY_MIE_DIRECTIONAL_G;
    u2.sunPosition.value.copy(sunDir);
    if (u2.showSunDisc) u2.showSunDisc.value = 0;
  };

  return {
    mesh: skyGroup,
    physicalSky,
    cloudDome,
    material,
    iblScene,
    iblSky,
    updatePhysicalSky,
  };
}

export interface AtmosphereFXRig {
  mistGroup: THREE.Group;
  mistPatches: { mesh: THREE.Mesh; baseX: number; baseZ: number; phase: number }[];
  shaftsGroup: THREE.Group;
  shaftMat: THREE.ShaderMaterial;
  fireflies: THREE.Points;
  fireflyMat: THREE.PointsMaterial;
  dustMotes: THREE.Points;
  dustMat: THREE.PointsMaterial;
  lightningTimer: number;
  lightningFlash: number;
}

export function buildAtmosphereFXRig(
  scene: THREE.Scene,
  getTerrainHeight: (x: number, z: number) => number
): AtmosphereFXRig {
  const mistTex = createSoftMistTexture(64);
  const mistMat = new THREE.MeshBasicMaterial({
    map: mistTex,
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mistGroup = new THREE.Group();
  const mistAnchors = [
    { x: 10, z: -18, r: 22 },
    { x: -16, z: -26, r: 20 },
    { x: 58, z: -22, r: 22 },
    { x: 64, z: -48, r: 24 },
    { x: -64, z: -38, r: 24 },
    { x: -72, z: -56, r: 22 },
    { x: 18, z: -52, r: 26 },
    { x: -24, z: 74, r: 18 },
    { x: 26, z: 68, r: 18 },
    { x: -12, z: 112, r: 20 },
    { x: 52, z: 10, r: 20 },
    { x: -46, z: 4, r: 20 },
  ];

  const mistPatches: AtmosphereFXRig['mistPatches'] = [];
  const patchGeom = new THREE.PlaneGeometry(1, 1);
  patchGeom.rotateX(-Math.PI / 2);

  mistAnchors.forEach((a, idx) => {
    const mesh = new THREE.Mesh(patchGeom, mistMat);
    const y = Math.max(WORLD.WATER_LEVEL + 0.35, getTerrainHeight(a.x, a.z) + 0.95);
    mesh.position.set(a.x, y, a.z);
    mesh.scale.set(a.r * 1.4, 1, a.r * 1.2);
    mistGroup.add(mesh);
    mistPatches.push({ mesh, baseX: a.x, baseZ: a.z, phase: idx * 1.17 });
  });
  scene.add(mistGroup);

  // Volumetric-style forest sun shafts (smooth fresnel-attenuated shader, no hard cone edges)
  const shaftsGroup = new THREE.Group();
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xffe7ba) },
      uOpacity: { value: 0.035 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mvPos.xyz;
        vNormalV = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewPos;
      void main() {
        float edgeFade = pow(abs(dot(normalize(vNormalV), normalize(-vViewPos))), 2.6);
        float verticalFade = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        float nearFade = smoothstep(8.0, 22.0, length(vViewPos));
        float alpha = uOpacity * edgeFade * verticalFade * nearFade;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shaftGeom = new THREE.ConeGeometry(5.2, 30, 18, 1, true);
  const shaftSpots = [
    { x: -18, z: 72 },
    { x: 24, z: 58 },
    { x: -6, z: -12 },
    { x: 34, z: -26 },
    { x: -38, z: -22 },
    { x: 26, z: 102 },
  ];
  for (const s of shaftSpots) {
    const sy = Math.max(1.5, getTerrainHeight(s.x, s.z));
    const cone = new THREE.Mesh(shaftGeom, shaftMat);
    cone.position.set(s.x, sy + 13.0, s.z);
    cone.rotation.z = 0.24;
    cone.rotation.x = 0.14;
    shaftsGroup.add(cone);
  }
  scene.add(shaftsGroup);

  // Twilight fireflies (soft circular sprite texture)
  const flyCount = 95;
  const flyPos = new Float32Array(flyCount * 3);
  for (let i = 0; i < flyCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 14 + Math.random() * 88;
    const fx = Math.cos(ang) * rad;
    const fz = Math.sin(ang) * rad - 8;
    const fy = Math.max(0.8, getTerrainHeight(fx, fz)) + 0.9 + Math.random() * 2.4;
    flyPos[i * 3] = fx;
    flyPos[i * 3 + 1] = fy;
    flyPos[i * 3 + 2] = fz;
  }
  const flyGeom = new THREE.BufferGeometry();
  flyGeom.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const fireflyMat = new THREE.PointsMaterial({
    color: 0xd9f99d,
    map: mistTex,
    size: 0.34,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fireflies = new THREE.Points(flyGeom, fireflyMat);
  scene.add(fireflies);

  // Sunlit atmospheric floating dust motes / sea spray around camera (soft circular glow)
  const dustCount = GRAPHICS_TUNING.DUST_MOTE_COUNT;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 26;
    dustPos[i * 3 + 1] = 0.5 + Math.random() * 5.2;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 26;
  }
  const dustGeom = new THREE.BufferGeometry();
  dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xfef3c7,
    map: mistTex,
    size: 0.14,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dustMotes = new THREE.Points(dustGeom, dustMat);
  scene.add(dustMotes);

  return {
    mistGroup,
    mistPatches,
    shaftsGroup,
    shaftMat,
    fireflies,
    fireflyMat,
    dustMotes,
    dustMat,
    lightningTimer: 5.5,
    lightningFlash: 0,
  };
}

export function updateAtmosphereFXRig(
  rig: AtmosphereFXRig,
  delta: number,
  tSec: number,
  hour: number,
  weather: WeatherState,
  sunElev: number,
  inVoyage: boolean,
  mistAndShaftsEnabled: boolean,
  firefliesEnabled: boolean,
  playerPos?: THREE.Vector3
): number {
  if (weather.kind === 'storm') {
    rig.lightningTimer -= delta;
    if (rig.lightningTimer <= 0) {
      rig.lightningFlash = 0.95;
      rig.lightningTimer = 7.5 + (Math.sin(tSec * 12.7) * 0.5 + 0.5) * 8.0;
    }
  }
  rig.lightningFlash = Math.max(0, rig.lightningFlash - delta * 3.4);

  rig.mistGroup.visible = mistAndShaftsEnabled && !inVoyage;
  if (rig.mistGroup.visible) {
    const isDawnDusk = (hour >= 4.5 && hour <= 8.8) || (hour >= 17.0 && hour <= 20.5);
    const targetMistOpacity = 0.1 + (isDawnDusk ? 0.14 : 0) + weather.rain * 0.15;
    const mat = rig.mistPatches[0]?.mesh.material as THREE.MeshBasicMaterial | undefined;
    if (mat) {
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetMistOpacity, Math.min(1, delta * 2.5));
    }
    for (const p of rig.mistPatches) {
      p.mesh.position.x = p.baseX + Math.sin(tSec * 0.16 + p.phase) * 3.2;
      p.mesh.position.z = p.baseZ + Math.cos(tSec * 0.13 + p.phase) * 2.6;
    }
  }

  const showShafts = mistAndShaftsEnabled && !inVoyage && sunElev > 0.08 && weather.rain < 0.45;
  rig.shaftsGroup.visible = showShafts;
  if (showShafts) {
    const goldenWeight = sunElev < 0.35 ? 1.15 : 0.72;
    rig.shaftMat.uniforms.uOpacity.value = 0.036 * goldenWeight * (1 - weather.rain * 1.4);
  }

  const isTwilightOrNight = hour < 6.2 || hour > 17.5;
  const showFlies = firefliesEnabled && !inVoyage && isTwilightOrNight && weather.kind !== 'storm';
  rig.fireflies.visible = showFlies;
  if (showFlies) {
    const pulse = 0.55 + Math.sin(tSec * 2.6) * 0.3;
    rig.fireflyMat.opacity = pulse * (1 - weather.rain * 0.8);
    rig.fireflies.rotation.y = tSec * 0.025;
  }

  // Sunlit dust motes drift slowly around player during clear/sunny hours
  const showDust = mistAndShaftsEnabled && !inVoyage && sunElev > 0.05 && weather.rain < 0.35;
  rig.dustMotes.visible = showDust;
  if (showDust) {
    if (playerPos) {
      rig.dustMotes.position.set(
        playerPos.x,
        Math.max(0.5, playerPos.y - 1.4),
        playerPos.z
      );
    }
    rig.dustMat.opacity = (0.28 + (1 - Math.abs(sunElev - 0.35)) * 0.16) * (1 - weather.rain * 1.5);
    const pos = rig.dustMotes.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + (Math.sin(tSec * 0.45 + i * 1.7) * 0.14 + weather.wind * 0.25) * delta;
      let y = pos.getY(i) + Math.sin(tSec * 0.62 + i * 2.3) * 0.12 * delta;
      if (x > 13) x = -13;
      if (x < -13) x = 13;
      if (y > 5.7) y = 0.5;
      if (y < 0.5) y = 5.7;
      pos.setX(i, x);
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  return rig.lightningFlash;
}
