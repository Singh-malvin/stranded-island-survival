import * as THREE from 'three';
import { TERRAIN_TUNING, WORLD } from '../survival/config.ts';
import type { PBRTextureBank } from './PBRTextures.ts';

export interface TerrainSplatUniforms {
  uUsePBR: { value: number };
  uSandDiff: { value: THREE.Texture };
  uSandNor: { value: THREE.Texture };
  uSandRough: { value: THREE.Texture };
  uGrassDiff: { value: THREE.Texture };
  uGrassNor: { value: THREE.Texture };
  uGrassRough: { value: THREE.Texture };
  uRockDiff: { value: THREE.Texture };
  uRockNor: { value: THREE.Texture };
  uRockRough: { value: THREE.Texture };
}

export interface TerrainMaterialRecord {
  material: THREE.MeshStandardMaterial;
  uniforms: TerrainSplatUniforms;
  customCompile: (shader: THREE.WebGLProgramParametersWithUniforms) => void;
}

export function createTerrainSplatMaterial(pbrBank: PBRTextureBank): TerrainMaterialRecord {
  const sand = pbrBank.getBase('sand');
  const grass = pbrBank.getBase('grass');
  const rock = pbrBank.getBase('rock');

  const uniforms: TerrainSplatUniforms = {
    uUsePBR: { value: 1 },
    uSandDiff: { value: sand.map },
    uSandNor: { value: sand.normalMap },
    uSandRough: { value: sand.roughnessMap },
    uGrassDiff: { value: grass.map },
    uGrassNor: { value: grass.normalMap },
    uGrassRough: { value: grass.roughnessMap },
    uRockDiff: { value: rock.map },
    uRockNor: { value: rock.normalMap },
    uRockRough: { value: rock.roughnessMap },
  };

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
    flatShading: false,
  });
  material.userData.__skipScenePBR = true;
  material.customProgramCacheKey = () => 'stranded-terrain-splat-v2';

  const customCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vTerrainWPos;
varying vec3 vTerrainWNorm;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vTerrainWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTerrainWNorm = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uUsePBR;
uniform sampler2D uSandDiff;
uniform sampler2D uSandNor;
uniform sampler2D uSandRough;
uniform sampler2D uGrassDiff;
uniform sampler2D uGrassNor;
uniform sampler2D uGrassRough;
uniform sampler2D uRockDiff;
uniform sampler2D uRockNor;
uniform sampler2D uRockRough;

varying vec3 vTerrainWPos;
varying vec3 vTerrainWNorm;

float tHash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 41.2);
  return fract(p.x * p.y);
}

float tNoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(tHash21(i), tHash21(i + vec2(1.0, 0.0)), f.x),
    mix(tHash21(i + vec2(0.0, 1.0)), tHash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float tFbm(vec2 p) {
  float v = 0.0;
  v += tNoise2(p) * 0.56;
  v += tNoise2(p * 2.17 + vec2(5.1, 8.3)) * 0.29;
  v += tNoise2(p * 4.71 + vec2(1.7, 3.9)) * 0.15;
  return v;
}

void computeTerrainWeights(
  vec3 wp,
  vec3 wn,
  out float wWet,
  out float wDrySand,
  out float wTrans,
  out float wGrass,
  out float wRock,
  out vec2 sandUv,
  out vec2 grassUv,
  out vec2 rockUv
) {
  vec2 xz = wp.xz;
  sandUv = xz * ${TERRAIN_TUNING.SAND_UV_SCALE.toFixed(4)};
  grassUv = xz * ${TERRAIN_TUNING.GRASS_UV_SCALE.toFixed(4)};
  // Slope-blended UV for steep mountain walls to eliminate vertical stretching
  float slopeSteep = clamp(1.0 - abs(wn.y), 0.0, 1.0);
  vec2 cliffUv = mix(xz, vec2(xz.x + xz.y, wp.y * 1.35), clamp(slopeSteep * 1.4, 0.0, 1.0));
  rockUv = cliffUv * ${TERRAIN_TUNING.ROCK_UV_SCALE.toFixed(4)};

  float largeNoise = tFbm(xz * 0.12);
  float detailNoise = tFbm(xz * 0.55);
  float organicPerturb = (largeNoise - 0.5) * 0.98 + (detailNoise - 0.5) * 0.44;
  float hOrg = wp.y + organicPerturb;

  // 1. Dark damp shoreline sand vs dry beach sand
  wWet = 1.0 - smoothstep(0.02, ${(TERRAIN_TUNING.WET_SAND_MAX_Y + 0.35).toFixed(3)}, wp.y + (detailNoise - 0.5) * 0.25);

  // 2. Gradual noise-splatted Sand -> Sparse Grass/Soil/Pebble Transition -> Lush Meadow
  float grassBand = smoothstep(
    ${TERRAIN_TUNING.SAND_TO_GRASS_START_Y.toFixed(3)},
    ${TERRAIN_TUNING.SAND_TO_GRASS_END_Y.toFixed(3)},
    hOrg
  );
  // Extra patchy organic tufts protruding out onto sand dunes
  float dunePatch = smoothstep(0.56, 0.80, largeNoise * 0.72 + detailNoise * 0.42) *
    smoothstep(${(TERRAIN_TUNING.SAND_TO_GRASS_START_Y - 0.42).toFixed(3)}, ${(TERRAIN_TUNING.SAND_TO_GRASS_START_Y + 0.5).toFixed(3)}, wp.y) *
    (1.0 - grassBand);
  float gCombined = clamp(grassBand + dunePatch * 0.65, 0.0, 1.0);

  // Mid-transition peak where pebbles, dirt & root patches live
  wTrans = clamp(4.0 * gCombined * (1.0 - gCombined) * (0.75 + detailNoise * 0.45), 0.0, 0.85);

  // 3. Basalt / volcanic cliff rock driven by both height and steep normal slope
  float cliffBySlope = 1.0 - smoothstep(${(TERRAIN_TUNING.ROCK_SLOPE_COS_THRESHOLD - 0.12).toFixed(3)}, ${(TERRAIN_TUNING.ROCK_SLOPE_COS_THRESHOLD + 0.14).toFixed(3)}, wn.y);
  float cliffByAlt = smoothstep(${(TERRAIN_TUNING.ROCK_CLIFF_MIN_Y - 1.2).toFixed(3)}, ${(TERRAIN_TUNING.ROCK_CLIFF_MIN_Y + 2.4).toFixed(3)}, hOrg);
  wRock = clamp(max(cliffBySlope, cliffByAlt), 0.0, 1.0);

  float nonRock = 1.0 - wRock;
  wGrass = gCombined * (1.0 - wTrans * 0.42) * nonRock;
  float dryRaw = (1.0 - gCombined) * (1.0 - wWet * 0.85) * nonRock;
  wDrySand = dryRaw * (1.0 - wTrans * 0.45);
  wTrans *= nonRock;
  wWet *= nonRock * (1.0 - gCombined);

  float total = max(0.0001, wWet + wDrySand + wTrans + wGrass + wRock);
  wWet /= total;
  wDrySand /= total;
  wTrans /= total;
  wGrass /= total;
  wRock /= total;
}

vec3 terrainPerturbNormal(vec3 viewPos, vec3 surfNorm, vec3 mapNormalTS, vec2 worldUv) {
  vec3 q0 = dFdx(viewPos);
  vec3 q1 = dFdy(viewPos);
  vec2 st0 = dFdx(worldUv);
  vec2 st1 = dFdy(worldUv);
  vec3 N = normalize(surfNorm);
  vec3 q1perp = cross(q1, N);
  vec3 q0perp = cross(N, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float sc = (det == 0.0) ? 0.0 : inversesqrt(det);
  mat3 tbn = mat3(T * sc, B * sc, N);
  return normalize(tbn * mapNormalTS);
}`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float tWWet, tWDrySand, tWTrans, tWGrass, tWRock;
vec2 tSandUv, tGrassUv, tRockUv;
computeTerrainWeights(
  vTerrainWPos,
  normalize(vTerrainWNorm),
  tWWet, tWDrySand, tWTrans, tWGrass, tWRock,
  tSandUv, tGrassUv, tRockUv
);

vec3 sandBaseCol = vec3(0.54, 0.47, 0.34);
vec3 grassBaseCol = vec3(0.16, 0.30, 0.12);
vec3 rockBaseCol = vec3(0.18, 0.17, 0.17);
vec3 transBaseCol = vec3(0.28, 0.24, 0.16);

// Fine sand wind ripples & grain variation + footprints/hollows
float microGrain = tNoise2(vTerrainWPos.xz * 14.5) * 0.08;
float ripplePattern = sin(vTerrainWPos.x * 5.2 + vTerrainWPos.z * 2.1 + tFbm(vTerrainWPos.xz * 0.7) * 3.2) * 0.5 + 0.5;
float dimples = tNoise2(vTerrainWPos.xz * 2.3);

if (uUsePBR > 0.5) {
  vec3 sTex = texture2D(uSandDiff, tSandUv).rgb;
  vec3 gTex = texture2D(uGrassDiff, tGrassUv).rgb;
  vec3 rTex = texture2D(uRockDiff, tRockUv).rgb;
  sandBaseCol = sTex * vec3(0.84, 0.72, 0.50) * (0.94 + ripplePattern * 0.08 + microGrain - dimples * 0.05);
  grassBaseCol = gTex * vec3(0.46, 0.74, 0.34);
  rockBaseCol = rTex * vec3(0.45, 0.43, 0.42);
  // Transition soil/pebble zone mixes darkened loam, coarse sand & pebbled noise speckles
  float pebbleNoise = smoothstep(0.66, 0.85, tNoise2(vTerrainWPos.xz * 7.8));
  transBaseCol = mix(sandBaseCol * 0.70, grassBaseCol * 0.84, 0.46);
  transBaseCol = mix(transBaseCol, rockBaseCol * 0.84, pebbleNoise * 0.58);
}

vec3 wetSandCol = sandBaseCol * vec3(0.48, 0.45, 0.40);
// Ruins eastern sandstone plateau & western cave obsidian subtle biome nuance
float eastWarm = smoothstep(26.0, 58.0, vTerrainWPos.x) * smoothstep(-10.0, -45.0, vTerrainWPos.z);
grassBaseCol = mix(grassBaseCol, grassBaseCol * vec3(1.16, 1.02, 0.78), eastWarm * 0.38);

diffuseColor.rgb =
  wetSandCol * tWWet +
  sandBaseCol * tWDrySand +
  transBaseCol * tWTrans +
  grassBaseCol * tWGrass +
  rockBaseCol * tWRock;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
if (uUsePBR > 0.5) {
  float sR = texture2D(uSandRough, tSandUv).g;
  float gR = texture2D(uGrassRough, tGrassUv).g;
  float rR = texture2D(uRockRough, tRockUv).g;
  roughnessFactor =
    (0.24 * tWWet) +
    (mix(0.76, 0.96, sR) * tWDrySand) +
    (mix(0.82, 0.96, sR) * tWTrans) +
    (mix(0.74, 0.94, gR) * tWGrass) +
    (mix(0.78, 0.96, rR) * tWRock);
} else {
  roughnessFactor = mix(0.90, 0.28, tWWet);
}`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
if (uUsePBR > 0.5) {
  vec3 sN = texture2D(uSandNor, tSandUv).xyz * 2.0 - 1.0;
  vec3 gN = texture2D(uGrassNor, tGrassUv).xyz * 2.0 - 1.0;
  vec3 rN = texture2D(uRockNor, tRockUv).xyz * 2.0 - 1.0;
  // Subtle procedural sand ripple normal tilt
  float ripSlope = cos(vTerrainWPos.x * 5.2 + vTerrainWPos.z * 2.1 + tFbm(vTerrainWPos.xz * 0.7) * 3.2) * 0.14 * (tWDrySand + tWWet * 0.5);
  sN.xy += vec2(ripSlope, ripSlope * 0.4);
  sN.xy *= 0.90;
  gN.xy *= 0.95;
  rN.xy *= 1.48;
  vec3 blendedN = normalize(sN * (tWWet + tWDrySand + tWTrans * 0.5) + gN * (tWGrass + tWTrans * 0.5) + rN * tWRock);
  normal = terrainPerturbNormal(-vViewPosition, normal, blendedN, vTerrainWPos.xz * 0.15);
}`
      );
  };

  material.onBeforeCompile = customCompile;

  return { material, uniforms, customCompile };
}

function r2LowDiscrepancy(i: number): [number, number] {
  const g = 1.324717957244746;
  const a1 = 1 / g;
  const a2 = 1 / (g * g);
  return [(i * a1) % 1, (i * a2) % 1];
}

function hashSeed(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Creates a multi-blade curved 3D grass tuft BufferGeometry (5 varied arched tapered blades).
 */
function buildGrassTuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const bladeCount = 7;
  const segments = 3;

  for (let b = 0; b < bladeCount; b++) {
    const ang = b * 2.39996 + (b % 2) * 0.25;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const radialOff = 0.025 + (b / bladeCount) * 0.135;
    const offX = cos * radialOff;
    const offZ = sin * radialOff;
    const leanOut = 0.08 + (b % 3) * 0.042;
    const bladeHeight = 0.72 + ((b * 37) % 10) * 0.032;

    const baseVert = positions.length / 3;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const y = t * bladeHeight;
      const halfW = (1 - t * 0.92) * 0.024;
      const bend = t * t * leanOut;
      const cx = offX + cos * bend;
      const cz = offZ + sin * bend;
      const px = -sin * halfW;
      const pz = cos * halfW;

      // Soft shaded root -> sunlit chartreuse/emerald blade tip
      const lum = 0.48 + t * 0.62;
      const tipWarm = t * 0.12;
      if (s === segments) {
        positions.push(cx, y, cz);
        normals.push(cos * 0.35, 0.94, sin * 0.35);
        colors.push(lum + tipWarm, lum * 1.08 + tipWarm, lum * 0.76);
      } else {
        positions.push(cx - px, y, cz - pz);
        normals.push(cos * 0.35, 0.94, sin * 0.35);
        colors.push(lum + tipWarm, lum * 1.08 + tipWarm, lum * 0.76);

        positions.push(cx + px, y, cz + pz);
        normals.push(cos * 0.35, 0.94, sin * 0.35);
        colors.push(lum + tipWarm, lum * 1.08 + tipWarm, lum * 0.76);
      }
    }

    for (let s = 0; s < segments - 1; s++) {
      const row = baseVert + s * 2;
      indices.push(row, row + 1, row + 2);
      indices.push(row + 1, row + 3, row + 2);
    }
    const lastRow = baseVert + (segments - 1) * 2;
    indices.push(lastRow, lastRow + 1, lastRow + 2);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  return geom;
}

export interface FoliageFieldHandle {
  group: THREE.Group;
  grassMesh: THREE.InstancedMesh;
  grassMaterial: THREE.MeshStandardMaterial;
  grassCompileHook: (shader: THREE.WebGLProgramParametersWithUniforms) => void;
  setDensity: (density: number) => void;
  update: (tSec: number, wind: number, camPos: THREE.Vector3) => void;
  dispose: () => void;
}

export function buildFoliageAndScatter(
  scene: THREE.Scene,
  getTerrainHeight: (x: number, z: number) => number
): FoliageFieldHandle {
  const group = new THREE.Group();
  const halfSpan = WORLD.ISLAND_RADIUS * 0.88;

  const estimateSlopeY = (x: number, z: number, h: number): number => {
    const eps = 1.2;
    const dx = getTerrainHeight(x + eps, z) - h;
    const dz = getTerrainHeight(x, z + eps) - h;
    const len = Math.hypot(dx, eps, dz);
    return eps / Math.max(0.001, len);
  };

  const nearExclusion = (x: number, z: number): boolean => {
    if (Math.hypot(x - WORLD.WRECK_POS.x, z - WORLD.WRECK_POS.z) < 5.6) return true;
    if (Math.hypot(x - WORLD.SPRING_POS.x, z - WORLD.SPRING_POS.z) < 4.5) return true;
    if (Math.hypot(x - WORLD.CAVE_GROTTO_POS.x, z - WORLD.CAVE_GROTTO_POS.z) < 9.5) return true;
    if (Math.hypot(x - WORLD.ANCIENT_RUINS_POS.x, z - WORLD.ANCIENT_RUINS_POS.z) < 7.8) return true;
    if (Math.hypot(x - WORLD.RESEARCH_STATION_POS.x, z - WORLD.RESEARCH_STATION_POS.z) < 8.5)
      return true;
    if (Math.hypot(x - WORLD.BOAT_DOCK_POS.x, z - WORLD.BOAT_DOCK_POS.z) < 6.0) return true;
    return false;
  };

  // -------------------------------------------------------------------------
  // 1. 3D Instanced Grass Field (transition fade -> lush meadows)
  // -------------------------------------------------------------------------
  const maxGrass = TERRAIN_TUNING.GRASS_BLADE_BASE_COUNT;
  const grassGeom = buildGrassTuftGeometry();
  const grassUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.3 },
    uCamPos: { value: new THREE.Vector3() },
  };

  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  grassMat.userData.__skipScenePBR = true;
  grassMat.customProgramCacheKey = () => 'stranded-grass-instanced-v1';

  const grassCompileHook = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, grassUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uWind;
uniform vec3 uCamPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec4 instOrigin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float hRatio = clamp(position.y, 0.0, 1.0);
float distCam = distance(instOrigin.xyz, uCamPos);
float lodScale = 1.0 - smoothstep(${TERRAIN_TUNING.GRASS_LOD_FADE_START.toFixed(1)}, ${TERRAIN_TUNING.GRASS_LOD_FADE_END.toFixed(1)}, distCam);
transformed *= lodScale;
float gustPhase = instOrigin.x * 0.24 + instOrigin.z * 0.19;
float sway = sin(uTime * ${TERRAIN_TUNING.GRASS_WIND_SPEED.toFixed(2)} + gustPhase) * 0.12
  + cos(uTime * 3.1 + instOrigin.x * 0.6) * 0.04;
float windStrength = (0.35 + uWind * 1.15) * hRatio * hRatio * lodScale;
transformed.x += sway * windStrength;
transformed.z += sway * 0.65 * windStrength;`
      );
  };
  grassMat.onBeforeCompile = grassCompileHook;

  const grassMesh = new THREE.InstancedMesh(grassGeom, grassMat, maxGrass);
  grassMesh.castShadow = false;
  grassMesh.receiveShadow = true;
  grassMesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();
  const grassPalette = [0x4f8a36, 0x649d3b, 0x7cb044, 0x3d752c, 0x90a94a];

  let gPlaced = 0;
  let sampleIdx = 1;
  while (gPlaced < maxGrass && sampleIdx < maxGrass * 9) {
    const [rx, rz] = r2LowDiscrepancy(sampleIdx++);
    // Spatial hash jitter prevents visible Fibonacci diagonal rows across flat beaches
    const wx = (rx - 0.5) * 2 * halfSpan + (hashSeed(sampleIdx * 11.3) - 0.5) * 1.65;
    const wz = (rz - 0.5) * 2 * halfSpan + (hashSeed(sampleIdx * 17.7) - 0.5) * 1.65;
    const h = getTerrainHeight(wx, wz);

    // Avoid deep water & cliffs; smoothly taper probability across sand-to-grass transition zone
    if (h < TERRAIN_TUNING.SAND_TO_GRASS_START_Y - 0.1 || h > TERRAIN_TUNING.ROCK_CLIFF_MIN_Y + 0.5)
      continue;
    const slopeY = estimateSlopeY(wx, wz, h);
    if (slopeY < 0.78 || nearExclusion(wx, wz)) continue;

    const transT = THREE.MathUtils.clamp(
      (h - (TERRAIN_TUNING.SAND_TO_GRASS_START_Y - 0.1)) /
        (TERRAIN_TUNING.SAND_TO_GRASS_END_Y - TERRAIN_TUNING.SAND_TO_GRASS_START_Y + 0.4),
      0,
      1
    );
    const patchCluster = 0.55 + 0.45 * Math.sin(wx * 0.23 + wz * 0.17) * Math.cos(wx * 0.13 - wz * 0.21);
    const keepProb = (0.06 + 0.94 * transT * transT) * patchCluster;
    if (hashSeed(sampleIdx * 1.37) > keepProb) continue;

    dummy.position.set(wx, h - 0.02, wz);
    dummy.rotation.set(
      (hashSeed(sampleIdx * 2.1) - 0.5) * 0.15,
      hashSeed(sampleIdx * 3.7) * Math.PI * 2,
      (hashSeed(sampleIdx * 4.3) - 0.5) * 0.15
    );
    const heightScale = THREE.MathUtils.lerp(
      TERRAIN_TUNING.GRASS_MIN_HEIGHT,
      TERRAIN_TUNING.GRASS_MAX_HEIGHT,
      transT * 0.65 + hashSeed(sampleIdx * 5.9) * 0.35
    );
    const widthScale = 0.75 + hashSeed(sampleIdx * 6.7) * 0.75;
    dummy.scale.set(widthScale, heightScale, widthScale);
    dummy.updateMatrix();
    grassMesh.setMatrixAt(gPlaced, dummy.matrix);

    const hex = grassPalette[Math.floor(hashSeed(sampleIdx * 7.3) * grassPalette.length)];
    cColor.setHex(hex);
    // Slightly sun-bleached olive straw near sunny beach transition
    if (transT < 0.5) {
      cColor.lerp(new THREE.Color(0x9ea14a), (0.5 - transT) * 0.7);
    }
    grassMesh.setColorAt(gPlaced, cColor);
    gPlaced++;
  }
  grassMesh.count = gPlaced;
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  group.add(grassMesh);

  // -------------------------------------------------------------------------
  // 2. Natural Ground Scatter: Shells, Pebbles, Driftwood Twigs, Jungle Ferns
  // -------------------------------------------------------------------------
  const makeScatterBatch = (
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    maxCount: number,
    minY: number,
    maxY: number,
    minSlope: number,
    scaleRange: [number, number],
    colors: number[],
    flattenY: boolean = false
  ): { mesh: THREE.InstancedMesh; total: number } => {
    const im = new THREE.InstancedMesh(geom, mat, maxCount);
    im.receiveShadow = true;
    im.castShadow = false;
    let placed = 0;
    let idx = 10000 + maxCount * 13;
    while (placed < maxCount && idx < 10000 + maxCount * 95) {
      const [rx, rz] = r2LowDiscrepancy(idx++);
      const wx = (rx - 0.5) * 2 * halfSpan + (hashSeed(idx * 13.1) - 0.5) * 1.85;
      const wz = (rz - 0.5) * 2 * halfSpan + (hashSeed(idx * 19.3) - 0.5) * 1.85;
      const h = getTerrainHeight(wx, wz);
      if (h < minY || h > maxY) continue;
      if (estimateSlopeY(wx, wz, h) < minSlope) continue;
      if (nearExclusion(wx, wz)) continue;

      const s = THREE.MathUtils.lerp(scaleRange[0], scaleRange[1], hashSeed(idx * 2.7));
      dummy.position.set(wx, h + (flattenY ? s * 0.14 : s * 0.25), wz);
      dummy.rotation.set(
        flattenY ? (hashSeed(idx * 3.1) - 0.5) * 0.35 : hashSeed(idx * 3.1) * Math.PI,
        hashSeed(idx * 4.7) * Math.PI * 2,
        flattenY ? (hashSeed(idx * 5.3) - 0.5) * 0.35 : hashSeed(idx * 5.3) * Math.PI
      );
      dummy.scale.set(
        s * (0.85 + hashSeed(idx * 6.1) * 0.45),
        s * (flattenY ? 0.42 : 0.65 + hashSeed(idx * 7.1) * 0.55),
        s * (0.85 + hashSeed(idx * 8.3) * 0.45)
      );
      dummy.updateMatrix();
      im.setMatrixAt(placed, dummy.matrix);
      cColor.setHex(colors[Math.floor(hashSeed(idx * 9.7) * colors.length)]);
      im.setColorAt(placed, cColor);
      placed++;
    }
    im.count = placed;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
    return { mesh: im, total: placed };
  };

  // Seashells scattered along beach wash & dry sand
  const shellGeom = new THREE.SphereGeometry(0.11, 7, 5);
  const shellMat = new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.08 });
  shellMat.userData.pbrKind = 'none';
  const shells = makeScatterBatch(
    shellGeom,
    shellMat,
    TERRAIN_TUNING.GROUND_DETAIL_SHELLS,
    0.1,
    1.6,
    0.85,
    [0.65, 1.35],
    [0xfef3c7, 0xfde68a, 0xfecdd3, 0xe2e8f0],
    true
  );

  // Coastal & transition zone pebbles
  const pebbleGeom = new THREE.DodecahedronGeometry(0.12, 0);
  const pebbleMat = new THREE.MeshStandardMaterial({ roughness: 0.88, flatShading: true });
  pebbleMat.userData.pbrKind = 'rock';
  const pebbles = makeScatterBatch(
    pebbleGeom,
    pebbleMat,
    TERRAIN_TUNING.GROUND_DETAIL_PEBBLES,
    0.15,
    6.2,
    0.72,
    [0.55, 1.65],
    [0x64748b, 0x57534e, 0x78716c, 0x44403c, 0x94a3b8],
    true
  );

  // Fallen weathered driftwood twigs near beaches & forest floor
  const twigGeom = new THREE.CylinderGeometry(0.032, 0.048, 0.72, 6);
  twigGeom.rotateZ(Math.PI / 2);
  const twigMat = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  twigMat.userData.pbrKind = 'wood';
  const twigs = makeScatterBatch(
    twigGeom,
    twigMat,
    TERRAIN_TUNING.GROUND_DETAIL_TWIGS,
    0.32,
    5.8,
    0.8,
    [0.7, 1.65],
    [0xa89278, 0x8c7355, 0x6f553b, 0xb8a388],
    true
  );

  // Small lush ground ferns & coastal tussocks in transition -> meadow
  const fernGeom = buildGrassTuftGeometry();
  const fernMat = new THREE.MeshStandardMaterial({
    roughness: 0.75,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  fernMat.userData.__skipScenePBR = true;
  const ferns = makeScatterBatch(
    fernGeom,
    fernMat,
    TERRAIN_TUNING.GROUND_DETAIL_FERNS,
    1.5,
    6.8,
    0.78,
    [0.85, 1.45],
    [0x15803d, 0x166534, 0x3f6212, 0x4d7c0f],
    false
  );

  scene.add(group);

  const setDensity = (density: number) => {
    const d = THREE.MathUtils.clamp(density, 0, 1);
    grassMesh.visible = d > 0.02;
    grassMesh.count = Math.floor(gPlaced * d);

    const propScale = d <= 0.02 ? 0.2 : Math.max(0.35, d);
    shells.mesh.count = Math.floor(shells.total * propScale);
    pebbles.mesh.count = Math.floor(pebbles.total * propScale);
    twigs.mesh.count = Math.floor(twigs.total * propScale);
    ferns.mesh.count = Math.floor(ferns.total * (d <= 0.02 ? 0.15 : d));
  };

  const update = (tSec: number, wind: number, camPos: THREE.Vector3) => {
    grassUniforms.uTime.value = tSec;
    grassUniforms.uWind.value = wind;
    grassUniforms.uCamPos.value.copy(camPos);
  };

  const dispose = () => {
    grassGeom.dispose();
    grassMat.dispose();
    shellGeom.dispose();
    shellMat.dispose();
    pebbleGeom.dispose();
    pebbleMat.dispose();
    twigGeom.dispose();
    twigMat.dispose();
    fernGeom.dispose();
    fernMat.dispose();
  };

  return {
    group,
    grassMesh,
    grassMaterial: grassMat,
    grassCompileHook,
    setDensity,
    update,
    dispose,
  };
}
