// Stage 7 Atmospheric Rendering & Procedural Shaders:
// - Seamless procedural terrain grain & mist textures (zero external assets)
// - Custom GLSL Ocean Water shader (animated swells, Fresnel, sun glitter, coastal foam & fog)
// - Atmospheric Sky Dome (sunrise/sunset scattering, storm clouds, night horizon)
// - Drifting Low Ground Mist, Volumetric Sun Shafts, Twilight Fireflies & Storm Lightning

import * as THREE from 'three';
import { WORLD } from '../survival/config.ts';
import type { WeatherState } from '../survival/types.ts';

export function createTerrainDetailTexture(size: number = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const twoPi = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Tile-seamless organic wind/soil grain without nearest-neighbor pixel blocks
      const u = (x / size) * twoPi;
      const v = (y / size) * twoPi;
      const n1 = Math.sin(u * 2 + v) * Math.cos(u - v * 2);
      const n2 = Math.sin(u * 5 - v * 3) * 0.55;
      const hash = (((x * 73856093) ^ (y * 19349663)) & 255) / 255;
      const shade = Math.max(185, Math.min(255, Math.round(226 + n1 * 14 + n2 * 10 + (hash - 0.5) * 14)));
      const idx = (y * size + x) * 4;
      data[idx] = shade;
      data[idx + 1] = shade;
      data[idx + 2] = shade;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(76, 76);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createRainStreakTexture(size: number = 32): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x - half) / half;
      const dy = Math.abs(y - half) / half;
      const alpha = Math.max(0, 1 - dx * 4.2) * Math.max(0, 1 - dy * 1.15);
      const idx = (y * size + x) * 4;
      data[idx] = 210;
      data[idx + 1] = 228;
      data[idx + 2] = 246;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createSoftMistTexture(size: number = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const falloff = Math.max(0, 1 - dist);
      const alpha = Math.round(Math.pow(falloff, 2.1) * 255);
      const idx = (y * size + x) * 4;
      data[idx] = 225;
      data[idx + 1] = 236;
      data[idx + 2] = 245;
      data[idx + 3] = alpha;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// OCEAN WATER SHADER
// ---------------------------------------------------------------------------

export interface OceanWaterHandle {
  shaderMaterial: THREE.ShaderMaterial;
  fallbackMaterial: THREE.MeshStandardMaterial;
}

export function createOceanWaterMaterials(islandRadius: number): OceanWaterHandle {
  const shaderMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.45, 0.7, 0.35).normalize() },
      uSunColor: { value: new THREE.Color(0xfff1d6) },
      uSkyHorizon: { value: new THREE.Color(0x6ea6c4) },
      uShallowColor: { value: new THREE.Color(0x289b99) },
      uDeepColor: { value: new THREE.Color(0x134c69) },
      uFogColor: { value: new THREE.Color(0x6ea6c4) },
      uFogDensity: { value: 0.0026 },
      uWind: { value: 0.2 },
      uStorm: { value: 0.0 },
      uNight: { value: 0.0 },
      uIslandRadius: { value: islandRadius },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWind;
      uniform float uStorm;
      varying vec3 vWorldPos;
      varying float vWaveHeight;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        float amp = 0.08 + uWind * 0.14 + uStorm * 0.24;
        float w1 = sin(worldPos.x * 0.085 + uTime * 1.45) * cos(worldPos.z * 0.075 + uTime * 1.1);
        float w2 = sin((worldPos.x + worldPos.z) * 0.16 - uTime * 1.9) * 0.5;
        float h = (w1 + w2) * amp;
        worldPos.y += h;
        vWorldPos = worldPos.xyz;
        vWaveHeight = h;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyHorizon;
      uniform vec3 uShallowColor;
      uniform vec3 uDeepColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uWind;
      uniform float uStorm;
      uniform float uNight;
      uniform float uIslandRadius;

      varying vec3 vWorldPos;
      varying float vWaveHeight;

      void main() {
        // Multi-directional animated capillary ripples
        float t = uTime;
        float nx1 = sin(vWorldPos.x * 0.34 + t * 1.65) * 0.09 + cos(vWorldPos.z * 0.41 - t * 1.35) * 0.07;
        float nz1 = cos(vWorldPos.z * 0.37 + t * 1.4) * 0.09 + sin((vWorldPos.x - vWorldPos.z) * 0.48 + t * 1.8) * 0.06;
        float nx2 = sin(vWorldPos.x * 1.15 - vWorldPos.z * 0.9 + t * 2.4) * 0.04;
        float nz2 = cos(vWorldPos.z * 1.08 + vWorldPos.x * 0.85 - t * 2.2) * 0.04;
        float chop = 1.0 + uWind * 0.8 + uStorm * 1.2;
        vec3 normal = normalize(vec3(-(nx1 + nx2) * chop, 1.0, -(nz1 + nz2) * chop));

        vec3 viewVec = cameraPosition - vWorldPos;
        float dist = length(viewVec);
        vec3 V = viewVec / max(0.0001, dist);

        float fresnel = pow(1.0 - max(dot(normal, V), 0.0), 3.6);
        fresnel = clamp(fresnel * 0.88 + 0.08, 0.0, 0.94);

        // Island bathymetry: turquoise lagoon near coast -> deep pelagic navy offshore
        float radial = length(vWorldPos.xz);
        float coastalFactor = clamp(1.0 - max(0.0, radial - uIslandRadius * 0.58) / 48.0, 0.0, 1.0);
        // Disable lagoon turquoise out at open-ocean voyage stage (z > 280)
        float openSeaMask = smoothstep(230.0, 310.0, vWorldPos.z);
        coastalFactor *= (1.0 - openSeaMask);

        vec3 reflColor = mix(uSkyHorizon, uFogColor, 0.35);
        vec3 baseWater = mix(uDeepColor, uShallowColor, coastalFactor) + reflColor * (0.2 * (1.0 - uNight * 0.7));
        baseWater *= mix(1.0, 0.44, uNight);

        vec3 col = mix(baseWater, reflColor, fresnel * 0.68);

        // Specular sun / moon glint
        vec3 H = normalize(uSunDir + V);
        float specPow = mix(96.0, 28.0, uStorm);
        float spec = pow(max(dot(normal, H), 0.0), specPow);
        col += uSunColor * spec * mix(0.55, 0.16, uStorm) * mix(1.0, 0.35, uNight);

        // Shoreline surf ring & offshore storm whitecaps
        float crest = smoothstep(0.11, 0.26, vWaveHeight + uStorm * 0.08 + uWind * 0.04);
        float shoreLineNoise = sin(radial * 0.85 - t * 2.2 + vWorldPos.x * 0.12) * 0.5 + 0.5;
        float surfBand = smoothstep(uIslandRadius * 0.88, uIslandRadius * 0.68, radial) *
                         smoothstep(uIslandRadius * 0.55, uIslandRadius * 0.72, radial) *
                         (1.0 - openSeaMask);
        float foam = clamp(crest * (0.35 + uStorm * 0.55) + surfBand * shoreLineNoise * 0.5, 0.0, 0.75);
        vec3 foamColor = mix(vec3(0.82, 0.93, 0.97), vec3(0.35, 0.45, 0.56), uNight * 0.75);
        col = mix(col, foamColor, foam);

        // Exponential distance fog matching THREE.FogExp2
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

        float alpha = mix(0.84, 0.96, fresnel * 0.5 + (1.0 - coastalFactor) * 0.35 + foam * 0.25);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const fallbackMaterial = new THREE.MeshStandardMaterial({
    color: 0x134e5e,
    roughness: 0.22,
    metalness: 0.35,
    transparent: true,
    opacity: 0.84,
  });

  return { shaderMaterial, fallbackMaterial };
}

// ---------------------------------------------------------------------------
// ATMOSPHERIC SKY DOME
// ---------------------------------------------------------------------------

export interface SkyDomeHandle {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

export function buildAtmosphericSkyDome(scene: THREE.Scene): SkyDomeHandle {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenithColor: { value: new THREE.Color(0x2a6998) },
      uHorizonColor: { value: new THREE.Color(0x7fb4ce) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.65, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xffdfa8) },
      uStorm: { value: 0 },
      uNight: { value: 0 },
      uLightning: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = position;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uStorm;
      uniform float uNight;
      uniform float uLightning;
      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uZenithColor, pow(h, 0.55));

        // Solar disc & atmospheric Mie glow halo
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float halo = pow(sunDot, 10.0) * (1.0 - uStorm * 0.8) * (1.0 - uNight * 0.88);
        float disc = smoothstep(0.9975, 0.9994, sunDot) * (1.0 - uStorm * 0.9) * (1.0 - uNight);
        col += uSunColor * (halo * 0.42 + disc * 1.4);

        // Subtle storm anvil flash
        col += vec3(0.55, 0.68, 0.92) * uLightning * (0.25 + 0.55 * (1.0 - h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(430, 24, 16), material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, material };
}

// ---------------------------------------------------------------------------
// GROUND MIST, SUN SHAFTS, FIREFLIES & LIGHTNING
// ---------------------------------------------------------------------------

export interface AtmosphereFXRig {
  mistGroup: THREE.Group;
  mistPatches: Array<{ mesh: THREE.Mesh; baseX: number; baseZ: number; phase: number }>;
  shaftsGroup: THREE.Group;
  shaftMat: THREE.MeshBasicMaterial;
  fireflies: THREE.Points;
  fireflyMat: THREE.PointsMaterial;
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
    opacity: 0.22,
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

  // Volumetric-style forest sun shafts
  const shaftsGroup = new THREE.Group();
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xffe4b5,
    transparent: true,
    opacity: 0.065,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shaftGeom = new THREE.ConeGeometry(4.2, 26, 12, 1, true);
  const shaftSpots = [
    { x: -10, z: 78 },
    { x: 18, z: 64 },
    { x: -6, z: -12 },
    { x: 34, z: -26 },
    { x: -38, z: -22 },
  ];
  for (const s of shaftSpots) {
    const sy = Math.max(1.5, getTerrainHeight(s.x, s.z));
    const cone = new THREE.Mesh(shaftGeom, shaftMat);
    cone.position.set(s.x, sy + 11.5, s.z);
    cone.rotation.z = 0.24;
    cone.rotation.x = 0.14;
    shaftsGroup.add(cone);
  }
  scene.add(shaftsGroup);

  // Twilight fireflies / jungle pollen motes
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
    size: 0.24,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fireflies = new THREE.Points(flyGeom, fireflyMat);
  scene.add(fireflies);

  return {
    mistGroup,
    mistPatches,
    shaftsGroup,
    shaftMat,
    fireflies,
    fireflyMat,
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
  firefliesEnabled: boolean
): number {
  // 1. Storm Lightning Flash decay + occasional sheet lightning
  if (weather.kind === 'storm') {
    rig.lightningTimer -= delta;
    if (rig.lightningTimer <= 0) {
      rig.lightningFlash = 0.95;
      rig.lightningTimer = 7.5 + ((Math.sin(tSec * 12.7) * 0.5 + 0.5) * 8.0);
    }
  }
  rig.lightningFlash = Math.max(0, rig.lightningFlash - delta * 3.4);

  // 2. Ground Mist drift (dawn/dusk/rain in island interior; hidden offshore)
  rig.mistGroup.visible = mistAndShaftsEnabled && !inVoyage;
  if (rig.mistGroup.visible) {
    const isDawnDusk = (hour >= 4.5 && hour <= 8.8) || (hour >= 17.0 && hour <= 20.5);
    const targetMistOpacity =
      0.11 + (isDawnDusk ? 0.14 : 0) + weather.rain * 0.16;
    const mat = rig.mistPatches[0]?.mesh.material as THREE.MeshBasicMaterial | undefined;
    if (mat) {
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetMistOpacity, Math.min(1, delta * 2.5));
    }
    for (const p of rig.mistPatches) {
      p.mesh.position.x = p.baseX + Math.sin(tSec * 0.16 + p.phase) * 3.2;
      p.mesh.position.z = p.baseZ + Math.cos(tSec * 0.13 + p.phase) * 2.6;
    }
  }

  // 3. Sun Light Shafts
  const showShafts = mistAndShaftsEnabled && !inVoyage && sunElev > 0.08 && weather.rain < 0.45;
  rig.shaftsGroup.visible = showShafts;
  if (showShafts) {
    const goldenWeight = sunElev < 0.35 ? 1.15 : 0.72;
    rig.shaftMat.opacity = 0.058 * goldenWeight * (1 - weather.rain * 1.4);
  }

  // 4. Fireflies glow in twilight & warm night when not in heavy storm
  const isTwilightOrNight = hour < 6.2 || hour > 17.5;
  const showFlies = firefliesEnabled && !inVoyage && isTwilightOrNight && weather.kind !== 'storm';
  rig.fireflies.visible = showFlies;
  if (showFlies) {
    const pulse = 0.55 + Math.sin(tSec * 2.6) * 0.3;
    rig.fireflyMat.opacity = pulse * (1 - weather.rain * 0.8);
    rig.fireflies.rotation.y = tSec * 0.025;
  }

  return rig.lightningFlash;
}
