import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WORLD_VISUAL_TUNING } from '../survival/config.ts';
import type { WorldCollider } from '../survival/world.ts';
import type { GraphicsQuality } from './GraphicsConfig.ts';
import type { PBRTextureBank } from './PBRTextures.ts';

export interface TerrainGridData {
  heights: Float32Array;
  cliffMask: Uint8Array;
  res: number;
  spanM: number;
  minZ: number;
  maxZ: number;
}

export interface CSMHookEntry {
  mat: THREE.MeshStandardMaterial;
  hook: (shader: THREE.WebGLProgramParametersWithUniforms) => void;
  cacheKey: string;
}

export interface WorldAssetsHandle {
  terrainGrid: TerrainGridData;
  macroAlbedoTex: THREE.Texture;
  terrainMask0Tex: THREE.Texture;
  cloudPanoramaTex: THREE.Texture;
  cliffsRoot: THREE.Group;
  cliffsLod0: THREE.Object3D | null;
  cliffsLod1: THREE.Object3D | null;
  cliffsCollider: THREE.Object3D | null;
  vegetationGroup: THREE.Group;
  boulderColliders: WorldCollider[];
  csmHookEntries: CSMHookEntry[];
  totalInstances: number;
  setQuality: (quality: GraphicsQuality, castShadow: boolean, receiveShadow: boolean) => void;
  update: (
    tSec: number,
    windSpeed: number,
    camPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    sunDir: THREE.Vector3,
    sunColor: THREE.Color,
    hazeColor: THREE.Color,
    quality: GraphicsQuality,
    viewDist: number
  ) => void;
  dispose: () => void;
}

interface SharedEnvUniforms {
  uTime: { value: number };
  uWind: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uHazeColor: { value: THREE.Color };
  uHazeDensity: { value: number };
  uHazeFalloff: { value: number };
}

interface FloraBatchRecord {
  typeId: number;
  lodLevel: 0 | 1;
  mesh: THREE.InstancedMesh;
  fullCount: number;
  fadeStart: number;
  fadeEnd: number;
  castsSunShadow: boolean;
}

interface VegChunkRecord {
  cx: number;
  cz: number;
  sphere: THREE.Sphere;
  group: THREE.Group;
  batches: FloraBatchRecord[];
  hasFoliageTypes: Set<number>;
}

interface ParsedVegInstance {
  typeId: number;
  r: number;
  g: number;
  b: number;
  px: number;
  py: number;
  pz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  sx: number;
  sy: number;
  sz: number;
}

interface ProtoPrimitive {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  localMatrix: THREE.Matrix4;
  isFoliageLeaf: boolean;
}

const FADE_GROUPS: Array<{ types: number[]; start: number; end: number }> = [
  {
    types: [0, 1],
    start: WORLD_VISUAL_TUNING.VEG_GRASS_FADE_START_M,
    end: WORLD_VISUAL_TUNING.VEG_GRASS_FADE_END_M,
  },
  {
    types: [2, 3, 4],
    start: WORLD_VISUAL_TUNING.VEG_SHRUB_FADE_START_M,
    end: WORLD_VISUAL_TUNING.VEG_SHRUB_FADE_END_M,
  },
  {
    types: [5, 6],
    start: 240,
    end: 310,
  },
];

const QUALITY_DENSITY: Record<GraphicsQuality, number> = {
  low: 0.34,
  medium: 0.65,
  high: 0.9,
  ultra: 1.0,
};

function parseTerrainGridBin(buffer: ArrayBuffer): TerrainGridData {
  const dv = new DataView(buffer);
  const magic = dv.getUint32(0, true);
  if (magic !== 0x4d485453) {
    throw new Error(`Invalid island_terrain_data.bin magic: 0x${magic.toString(16)}`);
  }
  const res = dv.getUint32(4, true);
  const spanM = dv.getFloat32(8, true);
  const minZ = dv.getFloat32(12, true);
  const maxZ = dv.getFloat32(16, true);
  const count = res * res;
  const headerBytes = 24;
  const u16Bytes = count * 2;
  const heights = new Float32Array(count);
  const zRange = maxZ - minZ;
  for (let i = 0; i < count; i++) {
    const q = dv.getUint16(headerBytes + i * 2, true);
    heights[i] = minZ + (q / 65535.0) * zRange;
  }
  const cliffMask = new Uint8Array(buffer, headerBytes + u16Bytes, count);
  return { heights, cliffMask: new Uint8Array(cliffMask), res, spanM, minZ, maxZ };
}

function parseVegetationBin(buffer: ArrayBuffer): ParsedVegInstance[] {
  const dv = new DataView(buffer);
  const magic = dv.getUint32(0, true);
  if (magic !== 0x47565453) {
    throw new Error(`Invalid island_vegetation.bin magic: 0x${magic.toString(16)}`);
  }
  const count = dv.getUint32(4, true);
  const stride = dv.getUint32(8, true);
  const out: ParsedVegInstance[] = new Array(count);
  let off = 12;
  for (let i = 0; i < count; i++) {
    out[i] = {
      typeId: dv.getUint8(off),
      r: dv.getUint8(off + 1),
      g: dv.getUint8(off + 2),
      b: dv.getUint8(off + 3),
      px: dv.getFloat32(off + 4, true),
      py: dv.getFloat32(off + 8, true),
      pz: dv.getFloat32(off + 12, true),
      qx: dv.getFloat32(off + 16, true),
      qy: dv.getFloat32(off + 20, true),
      qz: dv.getFloat32(off + 24, true),
      qw: dv.getFloat32(off + 28, true),
      sx: dv.getFloat32(off + 32, true),
      sy: dv.getFloat32(off + 36, true),
      sz: dv.getFloat32(off + 40, true),
    };
    off += stride;
  }
  return out;
}

function createCliffShaderHook(
  sharedEnv: SharedEnvUniforms,
  microRockNor: THREE.Texture
): (shader: THREE.WebGLProgramParametersWithUniforms) => void {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uMicroRockNor = { value: microRockNor };
    shader.uniforms.uMicroScale = { value: WORLD_VISUAL_TUNING.CLIFF_MICRO_DETAIL_SCALE };
    shader.uniforms.uMicroStrength = { value: WORLD_VISUAL_TUNING.CLIFF_MICRO_NORMAL_STRENGTH };
    shader.uniforms.uSunDir = sharedEnv.uSunDir;
    shader.uniforms.uSunColor = sharedEnv.uSunColor;
    shader.uniforms.uHazeColor = sharedEnv.uHazeColor;
    shader.uniforms.uHazeDensity = sharedEnv.uHazeDensity;
    shader.uniforms.uHazeFalloff = sharedEnv.uHazeFalloff;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vCliffWPos;
varying vec3 vCliffWNorm;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vCliffWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vCliffWNorm = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uMicroRockNor;
uniform float uMicroScale;
uniform float uMicroStrength;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHazeColor;
uniform float uHazeDensity;
uniform float uHazeFalloff;

varying vec3 vCliffWPos;
varying vec3 vCliffWNorm;

vec3 cliffPerturbNormal(vec3 viewPos, vec3 surfNorm, vec3 mapNormalTS, vec2 uv) {
  vec3 q0 = dFdx(viewPos);
  vec3 q1 = dFdy(viewPos);
  vec2 st0 = dFdx(uv);
  vec2 st1 = dFdy(uv);
  vec3 N = normalize(surfNorm);
  vec3 q1perp = cross(q1, N);
  vec3 q0perp = cross(N, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float sc = (det == 0.0) ? 0.0 : inversesqrt(det);
  return normalize(mat3(T * sc, B * sc, N) * mapNormalTS);
}`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  float camDist = length(vCliffWPos - cameraPosition);
  float detailFade = 1.0 - smoothstep(26.0, 95.0, camDist);
  if (detailFade > 0.01) {
    vec3 wNormAbs = abs(normalize(vCliffWNorm));
    vec2 strataUv = mix(
      vCliffWPos.xz,
      vec2(vCliffWPos.x + vCliffWPos.z, vCliffWPos.y * 1.48),
      clamp(1.0 - wNormAbs.y, 0.0, 1.0)
    ) * uMicroScale;
    vec3 microN = texture2D(uMicroRockNor, strataUv).xyz * 2.0 - 1.0;
    microN.xy *= uMicroStrength * detailFade;
    normal = normalize(mix(normal, cliffPerturbNormal(-vViewPosition, normal, normalize(microN), strataUv), 0.72 * detailFade));
  }
}`
      )
      .replace(
        '#include <fog_fragment>',
        `#include <fog_fragment>
{
  vec3 toFrag = vCliffWPos - cameraPosition;
  float dist = length(toFrag);
  vec3 rayDir = toFrag / max(0.001, dist);
  float hFactor = exp(-max(0.0, vCliffWPos.y) * max(0.001, uHazeFalloff));
  float heightFog = (1.0 - exp(-max(0.0, dist - 24.0) * 0.0044 * hFactor)) * clamp(uHazeDensity, 0.0, 0.95);
  float sunAlign = pow(max(dot(rayDir, normalize(uSunDir)), 0.0), ${WORLD_VISUAL_TUNING.HAZE_SUN_GLOW_POWER.toFixed(2)});
  vec3 hazeTint = mix(uHazeColor, uSunColor * 1.15, clamp(sunAlign * 0.85, 0.0, 0.85));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeTint, clamp(heightFog * 0.64, 0.0, 0.74));
  gl_FragColor.rgb += uSunColor * sunAlign * clamp((dist - 22.0) / 145.0, 0.0, 1.0) * ${WORLD_VISUAL_TUNING.HAZE_SUN_GLOW_STRENGTH.toFixed(3)};
}`
      );
  };
}

function createFloraShaderHook(
  sharedEnv: SharedEnvUniforms,
  fadeStart: number,
  fadeEnd: number,
  swayAmp: number,
  backlitStrength: number
): (shader: THREE.WebGLProgramParametersWithUniforms) => void {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = sharedEnv.uTime;
    shader.uniforms.uWind = sharedEnv.uWind;
    shader.uniforms.uSunDir = sharedEnv.uSunDir;
    shader.uniforms.uSunColor = sharedEnv.uSunColor;
    shader.uniforms.uHazeColor = sharedEnv.uHazeColor;
    shader.uniforms.uHazeDensity = sharedEnv.uHazeDensity;
    shader.uniforms.uHazeFalloff = sharedEnv.uHazeFalloff;
    shader.uniforms.uFadeStart = { value: fadeStart };
    shader.uniforms.uFadeEnd = { value: fadeEnd };
    shader.uniforms.uSwayAmp = { value: swayAmp };
    shader.uniforms.uBacklit = { value: backlitStrength };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uWind;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform float uSwayAmp;
varying vec3 vFloraWPos;
varying float vFloraHeightFrac;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec4 flBaseLocal = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  flBaseLocal = instanceMatrix * flBaseLocal;
#endif
vec3 flOriginW = (modelMatrix * flBaseLocal).xyz;
float flCamDist = length(flOriginW - cameraPosition);
float flDistScale = 1.0 - smoothstep(uFadeStart, uFadeEnd, flCamDist);
float flWeight = smoothstep(0.04, 1.25, transformed.y);
vFloraHeightFrac = flWeight;
if (uSwayAmp > 0.0001) {
  float flPhase = flOriginW.x * 0.24 + flOriginW.z * 0.19 + transformed.y * 0.85;
  float flGust = sin(uTime * ${WORLD_VISUAL_TUNING.VEG_WIND_SWAY_SPEED.toFixed(2)} + flPhase)
    + 0.42 * sin(uTime * 3.1 + flPhase * 1.7);
  float flAmp = uSwayAmp * (0.35 + uWind * 0.65) * flWeight;
  transformed.x += flGust * flAmp;
  transformed.z += flGust * flAmp * 0.55;
}
transformed *= mix(0.001, 1.0, flDistScale);`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 flPos4 = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  flPos4 = instanceMatrix * flPos4;
#endif
vFloraWPos = (modelMatrix * flPos4).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHazeColor;
uniform float uHazeDensity;
uniform float uHazeFalloff;
uniform float uBacklit;
varying vec3 vFloraWPos;
varying float vFloraHeightFrac;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
if (uBacklit > 0.001) {
  vec3 vRay = normalize(vFloraWPos - cameraPosition);
  float transGlow = pow(max(dot(vRay, normalize(uSunDir)), 0.0), 3.0);
  totalEmissiveRadiance += diffuseColor.rgb * uSunColor * transGlow * uBacklit * (0.4 + 0.6 * vFloraHeightFrac);
}`
      )
      .replace(
        '#include <fog_fragment>',
        `#include <fog_fragment>
{
  vec3 toFrag = vFloraWPos - cameraPosition;
  float dist = length(toFrag);
  vec3 rayDir = toFrag / max(0.001, dist);
  float hFactor = exp(-max(0.0, vFloraWPos.y) * max(0.001, uHazeFalloff));
  float heightFog = (1.0 - exp(-max(0.0, dist - 24.0) * 0.0044 * hFactor)) * clamp(uHazeDensity, 0.0, 0.95);
  float sunAlign = pow(max(dot(rayDir, normalize(uSunDir)), 0.0), ${WORLD_VISUAL_TUNING.HAZE_SUN_GLOW_POWER.toFixed(2)});
  vec3 hazeTint = mix(uHazeColor, uSunColor * 1.15, clamp(sunAlign * 0.85, 0.0, 0.85));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeTint, clamp(heightFog * 0.56, 0.0, 0.68));
}`
      );
  };
}

function findObjectByNamePrefix(root: THREE.Object3D, exactName: string): THREE.Object3D | null {
  let exact: THREE.Object3D | null = null;
  let prefix: THREE.Object3D | null = null;
  const wantLod1 = exactName.endsWith('_LOD1');
  root.traverse((obj) => {
    if (obj.name === exactName) {
      exact = obj;
    } else if (
      !prefix &&
      obj.name.startsWith(exactName) &&
      (wantLod1 || !obj.name.includes('_LOD1'))
    ) {
      prefix = obj;
    }
  });
  return exact ?? prefix;
}

function collectProtoPrimitives(
  obj: THREE.Object3D,
  sharedEnv: SharedEnvUniforms,
  typeId: number,
  csmHookEntries: CSMHookEntry[],
  isLod1: boolean
): ProtoPrimitive[] {
  const out: ProtoPrimitive[] = [];
  obj.updateMatrixWorld(true);
  const invRoot = obj.matrixWorld.clone().invert();
  const fadeCfg = FADE_GROUPS.find((fg) => fg.types.includes(typeId)) ?? FADE_GROUPS[2];
  const isBoulder = typeId === 5;
  const isPalm = typeId === 6;

  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;
    const localMatrix = invRoot.clone().multiply(child.matrixWorld);
    const rawMats = Array.isArray(child.material) ? child.material : [child.material];
    const clonedMats: THREE.MeshStandardMaterial[] = [];

    for (let mIdx = 0; mIdx < rawMats.length; mIdx++) {
      const rm = rawMats[mIdx];
      const mat =
        rm instanceof THREE.MeshStandardMaterial
          ? rm.clone()
          : new THREE.MeshStandardMaterial({ color: 0x3b6e28, roughness: 0.72 });
      mat.userData.__skipScenePBR = true;
      const matName = (mat.name || '').toLowerCase();
      const isBark = matName.includes('bark') || matName.includes('trunk') || matName.includes('cliff');
      const isLeaf = !isBoulder && !isBark;
      if (isLeaf) {
        mat.side = THREE.DoubleSide;
      }
      mat.metalness = 0.0;

      const swayAmp = isBoulder
        ? 0.0
        : isPalm
          ? WORLD_VISUAL_TUNING.VEG_WIND_SWAY_AMP * 0.55
          : WORLD_VISUAL_TUNING.VEG_WIND_SWAY_AMP;
      const backlit = isLeaf ? WORLD_VISUAL_TUNING.VEG_BACKLIT_TRANSLUCENCY : 0.0;
      const cacheKey = `stranded-flora-t${typeId}-l${isLod1 ? 1 : 0}-m${mIdx}`;
      mat.customProgramCacheKey = () => cacheKey;
      const hook = createFloraShaderHook(
        sharedEnv,
        fadeCfg.start,
        fadeCfg.end,
        swayAmp,
        backlit
      );
      mat.onBeforeCompile = hook;
      csmHookEntries.push({ mat, hook, cacheKey });
      clonedMats.push(mat);
    }

    const chosenMat = clonedMats[0];
    out.push({
      geometry: child.geometry.clone(),
      material: chosenMat,
      localMatrix,
      isFoliageLeaf: !isBoulder && !((chosenMat.name || '').toLowerCase().includes('bark')),
    });
  });

  return out;
}

function loadTextureAsync(
  url: string,
  colorSpace: THREE.ColorSpace,
  maxAnisotropy: number,
  wrapS: THREE.Wrapping = THREE.ClampToEdgeWrapping,
  wrapT: THREE.Wrapping = THREE.ClampToEdgeWrapping
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace;
        tex.wrapS = wrapS;
        tex.wrapT = wrapT;
        tex.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

function loadGLBAsync(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => reject(err)
    );
  });
}

export async function loadBlenderWorldAssets(
  pbrBank: PBRTextureBank,
  maxAnisotropy: number,
  initialQuality: GraphicsQuality,
  castShadow: boolean,
  receiveShadow: boolean
): Promise<WorldAssetsHandle> {
  const base = './assets/world';
  const [terrBinBuf, vegBinBuf, macroAlbedoTex, terrainMask0Tex, cloudPanoramaTex, cliffsScene, floraScene] =
    await Promise.all([
      fetch(`${base}/island_terrain_data.bin`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading island_terrain_data.bin`);
        return r.arrayBuffer();
      }),
      fetch(`${base}/island_vegetation.bin`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading island_vegetation.bin`);
        return r.arrayBuffer();
      }),
      loadTextureAsync(`${base}/island_terrain_albedo.jpg`, THREE.SRGBColorSpace, maxAnisotropy),
      loadTextureAsync(`${base}/island_terrain_mask0.png`, THREE.NoColorSpace, maxAnisotropy),
      loadTextureAsync(
        `${base}/clouds_storm_equirect.png`,
        THREE.SRGBColorSpace,
        maxAnisotropy,
        THREE.RepeatWrapping,
        THREE.ClampToEdgeWrapping
      ),
      loadGLBAsync(`${base}/island_cliffs.glb`),
      loadGLBAsync(`${base}/island_flora_protos.glb`),
    ]);

  const terrainGrid = parseTerrainGridBin(terrBinBuf);
  const vegInstances = parseVegetationBin(vegBinBuf);

  const sharedEnv: SharedEnvUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.45 },
    uSunDir: { value: new THREE.Vector3(0.45, 0.55, -0.7).normalize() },
    uSunColor: { value: new THREE.Color(0xfff1d6) },
    uHazeColor: { value: new THREE.Color(0x7c8d9c) },
    uHazeDensity: { value: WORLD_VISUAL_TUNING.HAZE_HEIGHT_DENSITY },
    uHazeFalloff: { value: WORLD_VISUAL_TUNING.HAZE_HEIGHT_FALLOFF },
  };

  const csmHookEntries: CSMHookEntry[] = [];

  // -------------------------------------------------------------------------
  // 1. Eroded Cliffs (Cliffs_LOD0 / Cliffs_LOD1 / COLLIDER_Cliffs)
  // -------------------------------------------------------------------------
  const cliffsRoot = new THREE.Group();
  cliffsRoot.name = 'BlenderWorld_Cliffs';
  const microRockNor = pbrBank.getBase('rock').normalMap;
  const cliffHook = createCliffShaderHook(sharedEnv, microRockNor);

  const cliffsLod0 = findObjectByNamePrefix(cliffsScene, 'Cliffs_LOD0');
  const cliffsLod1 = findObjectByNamePrefix(cliffsScene, 'Cliffs_LOD1');
  const cliffsCollider = findObjectByNamePrefix(cliffsScene, 'COLLIDER_Cliffs');

  const prepCliffBranch = (branch: THREE.Object3D | null, branchTag: string) => {
    if (!branch) return;
    branch.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.userData.__skipScenePBR = true;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const nextMats = mats.map((m, idx) => {
        const sm =
          m instanceof THREE.MeshStandardMaterial
            ? m.clone()
            : new THREE.MeshStandardMaterial({ color: 0x5c4738, roughness: 0.88 });
        sm.userData.__skipScenePBR = true;
        sm.aoMapIntensity = WORLD_VISUAL_TUNING.CLIFF_AO_INTENSITY;
        sm.envMapIntensity = WORLD_VISUAL_TUNING.CLIFF_ENV_INTENSITY;
        sm.roughness = Math.max(sm.roughness, 0.72);
        sm.metalness = 0.0;
        const ck = `stranded-cliff-${branchTag}-${idx}`;
        sm.customProgramCacheKey = () => ck;
        sm.onBeforeCompile = cliffHook;
        csmHookEntries.push({ mat: sm, hook: cliffHook, cacheKey: ck });
        return sm;
      });
      obj.material = Array.isArray(obj.material) ? nextMats : nextMats[0];
      obj.castShadow = castShadow;
      obj.receiveShadow = receiveShadow;
    });
    cliffsRoot.add(branch);
  };

  prepCliffBranch(cliffsLod0, 'lod0');
  prepCliffBranch(cliffsLod1, 'lod1');
  if (cliffsCollider) {
    cliffsCollider.visible = false;
    cliffsCollider.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
    cliffsRoot.add(cliffsCollider);
  }

  // -------------------------------------------------------------------------
  // 2. Chunked InstancedMesh Tropical Flora & Talus Boulders
  // -------------------------------------------------------------------------
  const vegetationGroup = new THREE.Group();
  vegetationGroup.name = 'BlenderWorld_Vegetation';

  const PROTO_NAMES: Array<{ id: number; name: string; lod1?: string }> = [
    { id: 0, name: 'Proto_Grass_Green' },
    { id: 1, name: 'Proto_Grass_Dry' },
    { id: 2, name: 'Proto_Tropical_Shrub' },
    { id: 3, name: 'Proto_Tropical_Fern', lod1: 'Proto_Tropical_Fern_LOD1' },
    { id: 4, name: 'Proto_Agave_Rosette', lod1: 'Proto_Agave_Rosette_LOD1' },
    { id: 5, name: 'Proto_Talus_Boulder' },
    { id: 6, name: 'Proto_Coconut_Palm', lod1: 'Proto_Coconut_Palm_LOD1' },
  ];

  const protosLod0 = new Map<number, ProtoPrimitive[]>();
  const protosLod1 = new Map<number, ProtoPrimitive[]>();
  for (const pn of PROTO_NAMES) {
    const obj0 = findObjectByNamePrefix(floraScene, pn.name);
    if (obj0) {
      protosLod0.set(pn.id, collectProtoPrimitives(obj0, sharedEnv, pn.id, csmHookEntries, false));
    }
    if (pn.lod1) {
      const obj1 = findObjectByNamePrefix(floraScene, pn.lod1);
      if (obj1) {
        protosLod1.set(pn.id, collectProtoPrimitives(obj1, sharedEnv, pn.id, csmHookEntries, true));
      }
    }
  }

  const gridN = WORLD_VISUAL_TUNING.VEG_CHUNK_GRID_N;
  const spanM = terrainGrid.spanM;
  const halfM = spanM * 0.5;
  const cellSpan = spanM / gridN;
  const buckets = new Map<number, ParsedVegInstance[]>();
  const boulderColliders: WorldCollider[] = [];

  for (let i = 0; i < vegInstances.length; i++) {
    const inst = vegInstances[i];
    const gx = Math.max(0, Math.min(gridN - 1, Math.floor(((inst.px + halfM) / spanM) * gridN)));
    const gz = Math.max(0, Math.min(gridN - 1, Math.floor(((inst.pz + halfM) / spanM) * gridN)));
    const key = gz * gridN + gx;
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(inst);

    if (inst.typeId === 5) {
      const maxSc = Math.max(inst.sx, inst.sy, inst.sz);
      if (maxSc >= 1.25) {
        boulderColliders.push({
          kind: 'circle',
          id: `blender_boulder_${i}`,
          x: inst.px,
          z: inst.pz,
          radius: Math.min(2.2, 0.72 * maxSc),
        });
      }
    }
  }

  const chunks: VegChunkRecord[] = [];
  const mat4 = new THREE.Matrix4();
  const posV = new THREE.Vector3();
  const quatV = new THREE.Quaternion();
  const sclV = new THREE.Vector3();
  const colV = new THREE.Color();
  const combinedM = new THREE.Matrix4();

  for (let gz = 0; gz < gridN; gz++) {
    for (let gx = 0; gx < gridN; gx++) {
      const key = gz * gridN + gx;
      const list = buckets.get(key);
      if (!list || list.length === 0) continue;

      const byType = new Map<number, ParsedVegInstance[]>();
      let minY = Infinity;
      let maxY = -Infinity;
      for (const item of list) {
        let tList = byType.get(item.typeId);
        if (!tList) {
          tList = [];
          byType.set(item.typeId, tList);
        }
        tList.push(item);
        if (item.py < minY) minY = item.py;
        if (item.py > maxY) maxY = item.py;
      }

      const cx = -halfM + (gx + 0.5) * cellSpan;
      const cz = -halfM + (gz + 0.5) * cellSpan;
      const cy = (minY + maxY) * 0.5;
      const halfDiagXZ = cellSpan * 0.72;
      const halfY = Math.max(12, (maxY - minY) * 0.5 + 10);
      const sphere = new THREE.Sphere(
        new THREE.Vector3(cx, cy, cz),
        Math.hypot(halfDiagXZ, halfY)
      );

      const chunkGroup = new THREE.Group();
      chunkGroup.name = `VegChunk_${gx}_${gz}`;
      const batches: FloraBatchRecord[] = [];
      const hasFoliageTypes = new Set<number>();

      const buildTypeInstanced = (
        typeId: number,
        tList: ParsedVegInstance[],
        prims: ProtoPrimitive[],
        lodLevel: 0 | 1
      ) => {
        const fadeCfg = FADE_GROUPS.find((fg) => fg.types.includes(typeId)) ?? FADE_GROUPS[2];
        for (const prim of prims) {
          const im = new THREE.InstancedMesh(prim.geometry, prim.material, tList.length);
          im.frustumCulled = false; // chunk culling done via exact precomputed chunk bounding sphere
          const castsSunShadow = typeId === 5 || typeId === 6;
          im.castShadow = castsSunShadow && castShadow && (lodLevel === 0 || !protosLod0.has(typeId));
          im.receiveShadow = receiveShadow && (typeId === 5 || typeId === 6);

          for (let j = 0; j < tList.length; j++) {
            const d = tList[j];
            posV.set(d.px, d.py, d.pz);
            quatV.set(d.qx, d.qy, d.qz, d.qw);
            sclV.set(d.sx, d.sy, d.sz);
            mat4.compose(posV, quatV, sclV);
            combinedM.multiplyMatrices(mat4, prim.localMatrix);
            im.setMatrixAt(j, combinedM);

            if (prim.isFoliageLeaf || typeId === 5) {
              colV.setRGB(d.r / 255, d.g / 255, d.b / 255, THREE.SRGBColorSpace);
            } else {
              colV.setRGB(1, 1, 1);
            }
            im.setColorAt(j, colV);
          }
          im.instanceMatrix.needsUpdate = true;
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
          chunkGroup.add(im);
          batches.push({
            typeId,
            lodLevel,
            mesh: im,
            fullCount: tList.length,
            fadeStart: fadeCfg.start,
            fadeEnd: fadeCfg.end,
            castsSunShadow,
          });
        }
      };

      for (const [typeId, tList] of byType.entries()) {
        hasFoliageTypes.add(typeId);
        const p0 = protosLod0.get(typeId);
        const p1 = protosLod1.get(typeId);
        if (p0 && p0.length > 0) buildTypeInstanced(typeId, tList, p0, 0);
        if (p1 && p1.length > 0) buildTypeInstanced(typeId, tList, p1, 1);
      }

      vegetationGroup.add(chunkGroup);
      chunks.push({ cx, cz, sphere, group: chunkGroup, batches, hasFoliageTypes });
    }
  }

  let activeShadowCast = castShadow;
  let activeShadowRecv = receiveShadow;

  const setQuality = (quality: GraphicsQuality, nextCast: boolean, nextRecv: boolean) => {
    activeShadowCast = nextCast;
    activeShadowRecv = nextRecv;
    const useLod1Cliffs = (quality === 'low' || quality === 'medium') && Boolean(cliffsLod1);
    if (cliffsLod0) cliffsLod0.visible = !useLod1Cliffs;
    if (cliffsLod1) cliffsLod1.visible = useLod1Cliffs;

    for (const branch of [cliffsLod0, cliffsLod1]) {
      if (!branch) continue;
      branch.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = nextCast;
          obj.receiveShadow = nextRecv;
        }
      });
    }

    const density = QUALITY_DENSITY[quality] ?? 1.0;
    for (const chunk of chunks) {
      for (const batch of chunk.batches) {
        if (batch.typeId <= 4) {
          batch.mesh.count = Math.max(0, Math.floor(batch.fullCount * density));
        } else {
          batch.mesh.count = batch.fullCount;
        }
        batch.mesh.receiveShadow = nextRecv && (batch.typeId === 5 || batch.typeId === 6);
      }
    }
  };

  setQuality(initialQuality, castShadow, receiveShadow);

  const frustum = new THREE.Frustum();
  const projScreenMatrix = new THREE.Matrix4();

  const update = (
    tSec: number,
    windSpeed: number,
    camPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    sunDir: THREE.Vector3,
    sunColor: THREE.Color,
    hazeColor: THREE.Color,
    quality: GraphicsQuality,
    viewDist: number
  ) => {
    sharedEnv.uTime.value = tSec;
    sharedEnv.uWind.value = windSpeed;
    sharedEnv.uSunDir.value.copy(sunDir).normalize();
    sharedEnv.uSunColor.value.copy(sunColor);
    sharedEnv.uHazeColor.value.copy(hazeColor);

    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    const lowOrMed = quality === 'low' || quality === 'medium';

    for (const chunk of chunks) {
      const dx = camPos.x - chunk.cx;
      const dz = camPos.z - chunk.cz;
      const centerDist = Math.hypot(dx, dz);
      const minCornerDist = Math.max(0, centerDist - chunk.sphere.radius);

      if (minCornerDist > viewDist || !frustum.intersectsSphere(chunk.sphere)) {
        chunk.group.visible = false;
        continue;
      }
      chunk.group.visible = true;

      for (const batch of chunk.batches) {
        if (minCornerDist > batch.fadeEnd) {
          batch.mesh.visible = false;
          continue;
        }

        if (batch.typeId === 3 || batch.typeId === 4 || batch.typeId === 6) {
          const hasLod1 = protosLod1.has(batch.typeId);
          const swapDist =
            batch.typeId === 6
              ? WORLD_VISUAL_TUNING.VEG_PALM_LOD1_DIST_M
              : WORLD_VISUAL_TUNING.VEG_FERN_LOD1_DIST_M;
          const wantLod1 = hasLod1 && (lowOrMed || centerDist > swapDist);
          batch.mesh.visible = batch.lodLevel === (wantLod1 ? 1 : 0);
        } else {
          batch.mesh.visible = batch.lodLevel === 0;
        }

        if (batch.mesh.visible && batch.castsSunShadow) {
          batch.mesh.castShadow =
            activeShadowCast && minCornerDist < WORLD_VISUAL_TUNING.VEG_PALM_LOD1_DIST_M + 45;
        }
      }
    }
  };

  const dispose = () => {
    macroAlbedoTex.dispose();
    terrainMask0Tex.dispose();
    cloudPanoramaTex.dispose();
    for (const grp of [cliffsRoot, vegetationGroup]) {
      grp.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (m) m.dispose();
          }
        }
      });
    }
    for (const list of [...protosLod0.values(), ...protosLod1.values()]) {
      for (const p of list) {
        p.geometry.dispose();
        p.material.dispose();
      }
    }
  };

  return {
    terrainGrid,
    macroAlbedoTex,
    terrainMask0Tex,
    cloudPanoramaTex,
    cliffsRoot,
    cliffsLod0,
    cliffsLod1,
    cliffsCollider,
    vegetationGroup,
    boulderColliders,
    csmHookEntries,
    totalInstances: vegInstances.length,
    setQuality,
    update,
    dispose,
  };
}
