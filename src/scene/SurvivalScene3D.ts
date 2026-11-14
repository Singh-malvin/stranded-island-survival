/**
 * First-person 3D Survival Scene Engine (Three.js)
 * Refactored from ResortScene3D:
 * - Reuses first-person WASD/mouse controller, pointer-lock + drag-look fallback,
 *   tool swing rig, terrain height interpolation, particle debris, day/night sky,
 *   and software-WebGL paced loop.
 * - Replaces tycoon guests/staff/hotels with:
 *   - Smoking plane crash wreckage on the beach
 *   - Freshwater spring pool with rock rim
 *   - 11 gathering node types with tool-tier checks & respawn syncing
 *   - Placeable stone-ring campfires with flickering firelight & embers
 *   - Equipped hand tools (bare hands, stone/steel axe, pickaxe, spear, lit torch)
 *   - Atmospheric day/night lighting (warm firelight vs. cold night blue) & rain
 */

import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import {
  ACTION_TUNING,
  ANIMATION_TUNING,
  COLLISION_TUNING,
  FORGE_TUNING,
  GRAPHICS_TUNING,
  IK_SWAY_TUNING,
  MOVEMENT_TUNING,
  NEEDS,
  PART5_IMMERSION_TUNING,
  PERFORMANCE_TUNING,
  SAVE,
  STANCE_TUNING,
  TEMPERATURE,
  WORLD,
} from '../survival/config.ts';
import { computeAmbientTempC, getBodyTempStage } from '../survival/needs.ts';
import {
  GATHER_NODE_META,
  generateIslandNodes,
  isNodeAvailable,
} from '../survival/gathering.ts';
import { getEquipped, getInitialDurability } from '../survival/items.ts';
import { STATION_REPAIR_DEFS, STORY_CLUES } from '../survival/quests.ts';
import {
  BarrierGateDef,
  GatherNodeDef,
  ItemId,
  PlacedCampfire,
  PlacedShelter,
  PlacedStructure,
  PlayerContext,
  PlayerStance,
  StationRepairId,
  StoryClueDef,
  StructureType,
  SurvivalState,
  ToolKind,
  WeatherState,
  WildlifeEntity,
} from '../survival/types.ts';
import {
  getStructureInteractionPrompt,
  isValidPlacementHeight,
  STRUCTURE_CATALOG,
} from '../survival/structures.ts';
import {
  canUnlockGate,
  clampCameraClearance,
  classifyStepSurface,
  canEnterStance,
  getEffectiveWaterLevel,
  ISLAND_GATES,
  resolveWorldMovement,
  sampleIslandHeight,
  StepSurface,
  WorldCollider,
} from '../survival/world.ts';
import {
  buildExtraGatherNodeMesh,
  buildInteriorLandmarks,
  buildStoryCluePropMesh,
  InteriorLandmarksHandle,
  syncStationSystemsVisuals,
} from './Landmarks3D.ts';
import {
  buildStructureMesh,
  StructureMeshRecord,
  syncStructureVisualState,
} from './Structures3D.ts';
import { WILDLIFE_SPECS } from '../survival/wildlife.ts';
import { Wildlife3DManager } from './Wildlife3D.ts';
import {
  buildGLBFirstPersonArm,
  extractWorldColliderFromGLB,
  FPArmClipName,
  FPArmsClipController,
  loadAllGameGLBModels,
  LoadedGLBSet,
  setFlipbookFrame,
} from './GLBModelBank.ts';
import { FirstPersonIKRig } from './FirstPersonIK.ts';
import {
  EuphoriaOutputs,
  EuphoriaPhysicsController,
  FootprintTrailSystem,
  PlayerFullBodyController,
} from './PlayerBodyAndFX.ts';
import {
  BoatSlipwayRecord,
  buildBoatSlipwayDock,
  buildVoyageDiorama,
  syncBoatBuildMeshes,
  updateVoyageDiorama,
  VOYAGE_STAGE_ORIGIN,
  VoyageSceneController,
} from './BoatAndVoyage3D.ts';
import {
  ControlKeybinds,
  DEFAULT_KEYBINDS,
  ExtendedGraphicsSettings,
  GRAPHICS_PRESETS,
  GraphicsQuality,
  loadExtendedGraphicsSettings,
  loadGraphicsQuality,
  saveExtendedGraphicsSettings,
  saveGraphicsQuality,
} from './GraphicsConfig.ts';
import { WorldLifeManager } from './WorldLifeFX.ts';
import {
  AtmosphereFXRig,
  buildAtmosphereFXRig,
  buildAtmosphericSkyDome,
  createOceanWaterMaterials,
  createRainStreakTexture,
  createTerrainDetailTexture,
  OceanWaterHandle,
  SkyDomeHandle,
  updateAtmosphereFXRig,
} from './AtmosphereFX3D.ts';
import { PostFXPipeline } from './PostFXPipeline.ts';
import { PBRTextureBank } from './PBRTextures.ts';
import {
  buildFoliageAndScatter,
  createTerrainSplatMaterial,
  FoliageFieldHandle,
  TerrainMaterialRecord,
} from './FoliageAndScatter3D.ts';
import { BOAT_STAGE_ORDER, computeSeaWeatherForLeg, countBoatStagesComplete } from '../survival/voyage.ts';

export interface HoveredTargetInfo {
  kind:
    | 'node'
    | 'spring'
    | 'campfire'
    | 'place_campfire'
    | 'shelter'
    | 'place_shelter'
    | 'structure'
    | 'place_structure'
    | 'fish_school'
    | 'wildlife'
    | 'station_repair'
    | 'boat_dock'
    | 'clue'
    | 'gate';
  label: string;
  prompt: string;
  subtext?: string;
  canInteract: boolean;
  nodeDef?: GatherNodeDef;
  campfireId?: string;
  shelterId?: string;
  structureDef?: PlacedStructure;
  structureType?: StructureType;
  clueDef?: StoryClueDef;
  gateDef?: BarrierGateDef;
  creature?: WildlifeEntity;
  repairId?: StationRepairId;
  fishPos?: { x: number; y: number; z: number };
}

export interface PerformanceMetrics {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  memoryMB: number;
  renderScale: number;
  fpsLimit: number;
  batterySaver: boolean;
}

export type ScenePerformanceMetrics = PerformanceMetrics;

interface Particle3D {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  gravity?: number;
  scaleCurve?: 'shrink' | 'smoke';
  sharedGeom?: boolean;
  flipbookTex?: THREE.Texture;
  flipbookFps?: number;
  billboard?: boolean;
}

interface CampfireMeshRecord {
  data: PlacedCampfire;
  group: THREE.Group;
  flames: THREE.Mesh[];
  light: THREE.PointLight;
  flipbookSprites?: Array<{
    kind?: 'fire' | 'embers' | 'smoke';
    tex: THREE.Texture;
    fps: number;
    phase: number;
    mesh: THREE.Mesh;
  }>;
}

interface ShelterMeshRecord {
  data: PlacedShelter;
  group: THREE.Group;
}

// Pre-allocated scratch math vectors outside frame loop
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _skySunDir = new THREE.Vector3();
const _euler = new THREE.Euler();

export const FRESHWATER_SPRING_POS = new THREE.Vector3(
  WORLD.SPRING_POS.x,
  1.35,
  WORLD.SPRING_POS.z
);

export class SurvivalScene3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private isSoftwareGl: boolean = false;
  private isDisposed: boolean = false;
  private frameId: number = 0;
  private quality: GraphicsQuality = 'high';

  // Lighting, Sky, Ocean Shaders, CSM, IBL, PBR & PostFX
  private sunLight: THREE.DirectionalLight;
  private sunShadowTarget: THREE.Object3D = new THREE.Object3D();
  private csm: CSM | null = null;
  private csmGeneration: number = 0;
  private csmActiveShadowSize: number = 0;
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;
  private torchLight: THREE.PointLight;
  private skyDome: SkyDomeHandle | null = null;
  private oceanMaterials: OceanWaterHandle | null = null;
  private terrainDetailTex: THREE.DataTexture | null = null;
  private pbrBank: PBRTextureBank = new PBRTextureBank(4);
  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private iblEnvRT: THREE.WebGLRenderTarget | null = null;
  private lastIblHour: number = -999;
  private waterReflectionRT: THREE.WebGLRenderTarget | null = null;
  private waterReflectionCam: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(68, 1, 0.25, 650);
  private atmosphereFx: AtmosphereFXRig | null = null;
  private postFx: PostFXPipeline | null = null;
  private moonMesh: THREE.Mesh | null = null;
  private starsPoints: THREE.Points | null = null;
  private starsMat: THREE.PointsMaterial | null = null;

  // Rain particles
  private rainPoints: THREE.Points | null = null;
  private rainMat: THREE.PointsMaterial | null = null;

  // Terrain, Splat Shader, 3D Foliage Scatter & Water
  private terrainMesh: THREE.Mesh | null = null;
  private terrainMatRecord: TerrainMaterialRecord | null = null;
  private foliageField: FoliageFieldHandle | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private terrainHeightMap: Float32Array;
  private terrainResolution: number = 152;
  private islandRadius: number = WORLD.ISLAND_RADIUS;

  // World Props & Nodes
  private nodeDefs: GatherNodeDef[] = [];
  private nodeMeshes: Map<string, { def: GatherNodeDef; group: THREE.Group; baseScale: number }> =
    new Map();
  private palmWindMeshes: THREE.Group[] = [];
  private landmarks: InteriorLandmarksHandle | null = null;
  private wildlife3D: Wildlife3DManager;
  private boatDock: BoatSlipwayRecord | null = null;
  private voyageDiorama: VoyageSceneController | null = null;
  private wasInVoyage: boolean = false;
  private campfires3D: Map<string, CampfireMeshRecord> = new Map();
  private campfireGhost: THREE.Group | null = null;
  private shelters3D: Map<string, ShelterMeshRecord> = new Map();
  private shelterGhost: THREE.Group | null = null;
  private structures3D: Map<string, StructureMeshRecord> = new Map();
  private dynamicCollidersCache: WorldCollider[] = [];
  private buildPreviewType: StructureType | null = null;
  private buildPreviewYaw: number = 0;
  private buildPreviewGhost: THREE.Group | null = null;
  private fishSchools: Array<{
    group: THREE.Group;
    centerX: number;
    centerZ: number;
    radius: number;
    speed: number;
    phase: number;
  }> = [];
  private clueMeshes: Map<
    string,
    { def: StoryClueDef; group: THREE.Group; beacon: THREE.Mesh }
  > = new Map();
  private gateMeshes: Map<string, { def: BarrierGateDef; group: THREE.Group }> = new Map();
  private crashSmokePuffs: THREE.Mesh[] = [];
  private particles: Particle3D[] = [];
  private forgeSmokeGeom: THREE.BufferGeometry | null = null;
  private forgeSmokeMat: THREE.MeshLambertMaterial | null = null;

  // First-person player state
  private playerPos: THREE.Vector3 = new THREE.Vector3(
    WORLD.PLAYER_SPAWN.x,
    2.5,
    WORLD.PLAYER_SPAWN.z
  );
  private lastSamplePos: { x: number; z: number } = {
    x: WORLD.PLAYER_SPAWN.x,
    z: WORLD.PLAYER_SPAWN.z,
  };
  private bumpedGate: BarrierGateDef | null = null;
  private fpsValue: number = 60;
  private fpsFrames: number = 0;
  private fpsLastCheckMs: number = 0;
  private frameTimeMs: number = 16.6;
  private lastRenderTimestamp: number = 0;
  private extSettings: ExtendedGraphicsSettings = loadExtendedGraphicsSettings();
  private dynamicResScale: number = 1.0;
  private isWindowFocused: boolean = true;
  private isDocumentHidden: boolean = false;
  private reflectionFrameCounter: number = 0;
  private csmFrameCounter: number = 0;
  private loadedGLBs: LoadedGLBSet | null = null;
  private fpClipController: FPArmsClipController | null = null;
  private fpIKRig: FirstPersonIKRig | null = null;
  private footprintsFx: FootprintTrailSystem | null = null;
  private fullBodyController: PlayerFullBodyController | null = null;
  private euphoria: EuphoriaPhysicsController = new EuphoriaPhysicsController();
  private lastEuphoriaOut: EuphoriaOutputs | null = null;
  private footRayTargets: THREE.Object3D[] = [];
  private glbCliffsGroup: THREE.Group | null = null;
  private currentEquippedItemId: ItemId | 'hammer_build' | null = null;
  private frameLookYawDelta: number = 0;
  private frameLookPitchDelta: number = 0;
  private staticGLBColliders: WorldCollider[] = [];
  private playerFootY: number = 0.8;
  private pitch: number = -0.06;
  private yaw: number = 0;
  private targetPitch: number = -0.06;
  private targetYaw: number = 0;
  private handLagX: number = 0;
  private handLagY: number = 0;
  private isPointerLocked: boolean = false;
  private isUiBlocked: boolean = false;
  private keys: Record<string, boolean> = {};
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private pointerDownClient: { x: number; y: number } = { x: 0, y: 0 };

  // Movement & Feedback Animations
  private walkTimer: number = 0;
  private moveBlend: number = 0;
  private swimBlend: number = 0;
  private strafeLean: number = 0;
  private velX: number = 0;
  private velZ: number = 0;
  private verticalVel: number = 0;
  private isGrounded: boolean = true;
  private isCrouching: boolean = false;
  private stance: PlayerStance = 'stand';
  private crouchBlend: number = 0;
  private proneBlend: number = 0;
  private sitBlend: number = 0;
  private sleepBlend: number = 0;
  private crouchHoldSec: number = 0;
  private crouchHoldProneTriggered: boolean = false;
  private sleepPhase: 'none' | 'lying_down' | 'black_hold' | 'waking_up' = 'none';
  private sleepPhaseTimer: number = 0;
  private sleepFadeAlpha: number = 0;
  private sleepBlackoutFired: boolean = false;
  private onSleepBlackoutCb: (() => void) | null = null;
  private onStanceBlocked?: (reason: string) => void;
  private lastStanceBlockedWarnAt: number = 0;
  private overheadRaycaster: THREE.Raycaster = new THREE.Raycaster(
    new THREE.Vector3(),
    new THREE.Vector3(0, 1, 0),
    0.2,
    2.4
  );
  // Part 4 Action & World Physics state
  private actionTimers = {
    drinkCupped: 0,
    drinkBottle: 0,
    eat: 0,
    bandage: 0,
    mapLook: 0,
    heatWipe: 0,
    cough: 0,
    craft: 0,
    place: 0,
  };
  private bandagedActive: boolean = false;
  private periodicActionAccum = {
    shiver: 0,
    heatWipe: 0,
    cough: 0,
    swimCycle: 0,
  };
  private nodeJiggles: Map<
    string,
    { timer: number; dur: number; dirX: number; dirZ: number; amp: number }
  > = new Map();
  private fallingTrees: {
    pivot: THREE.Group;
    tilt: number;
    angVel: number;
    dirX: number;
    dirZ: number;
    bounced: boolean;
    restTimer: number;
    phase: 'falling' | 'resting' | 'fading';
    fadeTimer: number;
  }[] = [];
  private chopStumps: Map<string, THREE.Mesh> = new Map();
  private chopNotches: Map<string, THREE.Mesh[]> = new Map();
  private actionAudioCallbacks: {
    onSwimStroke?: () => void;
    onTreeFell?: () => void;
    onCough?: () => void;
    onShiver?: () => void;
  } = {};
  private worldLifeFx: WorldLifeManager | null = null;
  private currentWaterLevel: number = WORLD.WATER_LEVEL;
  private oxygen: number = 100;
  private wasUnderwater: boolean = false;
  private wasSwimming: boolean = false;
  private drownDamageAccum: number = 0;
  private rainDropletLevel: number = 0;
  private grimeLevel: number = 0.08;
  private bloodLevel: number = 0;
  private lastKnownHp: number = 100;
  private holdInteractProgress: number = 0;
  private photoMode: boolean = false;
  private photoFilter: number = 0;
  private photoSavedCam: { x: number; y: number; z: number; pitch: number; yaw: number } | null =
    null;
  private lastSpatialAudioAtMs: number = 0;
  private part5Callbacks: {
    onDrowningDamage?: (hpLoss: number) => void;
    onPhotoModeChange?: (active: boolean, filter: number) => void;
    onSplash?: (intensity: number) => void;
    onSpatialAmbience?: (data: {
      listenerPos: { x: number; y: number; z: number };
      listenerForward: { x: number; y: number; z: number };
      surfPos: { x: number; y: number; z: number };
      springPos: { x: number; y: number; z: number };
      campfirePos: { x: number; y: number; z: number } | null;
      inCave: boolean;
      inForest: boolean;
      isNight: boolean;
      rainIntensity: number;
      nearOcean: boolean;
      health: number;
      underwater: boolean;
    }) => void;
  } = {};
  private currentEyeHeight: number = MOVEMENT_TUNING.EYE_HEIGHT_STAND_M;
  private peakAirY: number = 0;
  private jumpDip: number = 0;
  private landingDip: number = 0;
  private cameraFovCurrent: number = MOVEMENT_TUNING.BASE_FOV_DEG;
  private isMoving: boolean = false;
  private isSprinting: boolean = false;
  private isSwimming: boolean = false;
  private isWading: boolean = false;
  private stepDistanceAccumulator: number = 0;
  private damageJoltTimer: number = 0;
  private pickupAnimTimer: number = 0;
  private pickupReachHeight: 'ground' | 'waist' | 'bush' = 'ground';
  private holdERepeatTimer: number = 0;
  private flyingPickups: Array<{
    mesh: THREE.Object3D;
    startPos: THREE.Vector3;
    elapsed: number;
    duration: number;
  }> = [];

  // Dual-Arm First-Person Hand & Tool Rig
  private toolRig: THREE.Group;
  private offhandRig: THREE.Group;
  private leftOffhandArmGroup: THREE.Group;
  private handMesh: THREE.Group;
  private rightToolArm: THREE.Group;
  private crashSiteGroup: THREE.Group | null = null;
  private springGroup: THREE.Group | null = null;
  private axeMesh: THREE.Group;
  private macheteMesh: THREE.Group;
  private pickaxeMesh: THREE.Group;
  private spearMesh: THREE.Group;
  private torchMesh: THREE.Group;
  private lanternMesh: THREE.Group;
  private torchFlameMesh: THREE.Mesh | null = null;
  private lanternGlowMesh: THREE.Mesh | null = null;
  private currentEquippedTool: ToolKind | null = null;
  private equipAnimTimer: number = 0;
  private swingAnimationTimer: number = 0;
  private activeSwingKind: ToolKind | null = null;
  private isSwinging: boolean = false;

  // Synced state snapshot from React
  private latestState: SurvivalState | null = null;
  public hoveredTarget: HoveredTargetInfo | null = null;

  // Callbacks
  private onPrimaryAction?: (target: HoveredTargetInfo | null) => void;
  private onOpenCampfireCraft?: () => void;
  private onCancelBuild?: () => void;
  private onStepSound?: (surface: StepSurface) => void;
  private onJump?: () => void;
  private onFallImpact?: (fallMeters: number) => void;
  private onThunderStrike?: () => void;
  private lastThunderSoundAt: number = 0;
  private lastGhostValid: boolean | null = null;

  private lastTime: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6fa8c4);
    this.scene.fog = new THREE.FogExp2(0x6fa8c4, 0.0048);

    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.08, 780);
    this.camera.position.copy(this.playerPos);

    // Dual-Arm First-person Rigs
    this.toolRig = new THREE.Group();
    this.offhandRig = new THREE.Group();
    this.camera.add(this.toolRig);
    this.camera.add(this.offhandRig);

    const leftArm = this.createOffhandArm();
    this.leftOffhandArmGroup = leftArm;
    this.offhandRig.add(leftArm);
    this.offhandRig.position.set(-0.36, -0.44, -0.58);
    this.offhandRig.rotation.set(0.18, 0.16, 0.08);

    this.torchLight = new THREE.PointLight(0xff8c2b, 0, 16, 1.45);
    this.torchLight.position.set(0.35, -0.1, -0.7);
    this.camera.add(this.torchLight);

    this.scene.add(this.camera);

    this.handMesh = this.createHandTool();
    this.rightToolArm = this.createToolGripArm();
    this.axeMesh = this.createAxeTool();
    this.macheteMesh = this.createMacheteTool();
    this.pickaxeMesh = this.createPickaxeTool();
    this.spearMesh = this.createSpearTool();
    this.torchMesh = this.createTorchTool();
    this.lanternMesh = this.createLanternTool();

    this.toolRig.add(this.handMesh);
    this.toolRig.add(this.rightToolArm);
    this.rightToolArm.visible = false;
    this.toolRig.add(this.axeMesh);
    this.toolRig.add(this.macheteMesh);
    this.toolRig.add(this.pickaxeMesh);
    this.toolRig.add(this.spearMesh);
    this.toolRig.add(this.torchMesh);
    this.toolRig.add(this.lanternMesh);
    this.setEquippedToolMesh(null);

    this.toolRig.position.set(0.36, -0.32, -0.62);
    this.toolRig.rotation.set(0.08, -0.15, -0.05);

    this.quality = loadGraphicsQuality(this.isSoftwareGl);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, GRAPHICS_PRESETS[this.quality].pixelRatioCap)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && GRAPHICS_PRESETS[this.quality].shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    container.appendChild(this.renderer.domElement);

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileCubemapShader();
    this.scene.environmentIntensity = 0.24;

    // Lighting rig
    this.ambientLight = new THREE.AmbientLight(0xc8dce8, 0.22);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x90cbe0, 0x2e4c34, 0.42);
    this.scene.add(this.hemiLight);

    this.scene.add(this.sunShadowTarget);
    this.sunLight = new THREE.DirectionalLight(0xffe9c8, 1.2);
    this.sunLight.position.set(55, 75, 40);
    this.sunLight.target = this.sunShadowTarget;
    this.sunLight.shadow.camera.left = -52;
    this.sunLight.shadow.camera.right = 52;
    this.sunLight.shadow.camera.top = 52;
    this.sunLight.shadow.camera.bottom = -52;
    this.sunLight.shadow.camera.near = 8;
    this.sunLight.shadow.camera.far = 210;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.03;
    this.scene.add(this.sunLight);

    this.skyDome = buildAtmosphericSkyDome(this.scene);
    this.initCelestialSky();
    this.initRainSystem();

    this.terrainHeightMap = new Float32Array(this.terrainResolution * this.terrainResolution);
    this.initTerrain();
    this.foliageField = buildFoliageAndScatter(this.scene, (wx, wz) =>
      this.getTerrainHeight(wx, wz)
    );
    this.initWater();
    this.initCrashSiteAndSpring();
    this.landmarks = buildInteriorLandmarks(this.scene, (wx, wz) => this.getTerrainHeight(wx, wz));
    this.boatDock = buildBoatSlipwayDock(this.scene, (wx, wz) => this.getTerrainHeight(wx, wz));
    this.voyageDiorama = buildVoyageDiorama(this.scene);
    this.footprintsFx = new FootprintTrailSystem();
    this.scene.add(this.footprintsFx.mesh);
    this.initAct1Barriers();
    this.initStoryClues();
    this.initGatherNodes();
    this.rebuildDynamicColliders();
    this.initFishSchools();
    this.wildlife3D = new Wildlife3DManager(this.scene);
    this.worldLifeFx = new WorldLifeManager((wx, wz) => this.getTerrainHeight(wx, wz));
    this.scene.add(this.worldLifeFx.root);
    this.freezeStaticObject(this.terrainMesh);
    this.freezeStaticObject(this.crashSiteGroup);
    this.freezeStaticObject(this.springGroup);
    this.initCampfireGhost();
    this.initShelterGhost();
    this.atmosphereFx = buildAtmosphereFXRig(this.scene, (wx, wz) => this.getTerrainHeight(wx, wz));
    if (!this.isSoftwareGl) {
      this.postFx = new PostFXPipeline(
        this.renderer,
        this.scene,
        this.camera,
        container.clientWidth,
        container.clientHeight
      );
    }

    // Apply shadow flags across all initial world groups & set active preset
    this.enableAllWorldShadows();
    this.setQuality(this.quality);

    this.snapPlayerToGround(WORLD.PLAYER_SPAWN.x, WORLD.PLAYER_SPAWN.z, 0);
    this.fpsLastCheckMs = performance.now();
    this.setupEventListeners();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.loadAndApplyBlenderGLBModels();

    this.lastTime = performance.now();
    this.tick();
  }

  private loadAndApplyBlenderGLBModels() {
    loadAllGameGLBModels()
      .then((models) => {
        if (this.isDisposed) return;
        this.loadedGLBs = models;
        const preset = GRAPHICS_PRESETS[this.quality];
        const castShad = !this.isSoftwareGl && preset.shadows;

        // 1. Unified Modern Warfare Two-Bone IK Rig (upper_arm -> forearm -> wrist -> hand -> fingers)
        if (!this.fpIKRig) {
          this.fpIKRig = new FirstPersonIKRig(models);
          this.camera.add(this.fpIKRig.root);
          // Hide legacy procedural viewmodel groups once full IK rig is mounted
          this.toolRig.visible = false;
          this.offhandRig.visible = false;
          this.fpIKRig.setHeldItem(
            this.buildPreviewType ? 'hammer_build' : this.currentEquippedItemId
          );
        }

        // Full survivor body for down-look visibility, Foot IK & cast shadows
        if (!this.fullBodyController && models.playerBody && this.footprintsFx) {
          this.fullBodyController = new PlayerFullBodyController(
            models.playerBody,
            this.footprintsFx
          );
          this.scene.add(this.fullBodyController.group);
        }

        // Keep fallback arm/tool refs updated for non-IK compatibility if queried
        const leftArm = buildGLBFirstPersonArm(models.fpArms, 'left', 'relaxed');
        this.leftOffhandArmGroup.clear();
        this.leftOffhandArmGroup.add(leftArm);

        const rightHand = buildGLBFirstPersonArm(models.fpArms, 'right', 'relaxed');
        this.handMesh.clear();
        this.handMesh.add(rightHand);

        const rightGrip = buildGLBFirstPersonArm(models.fpArms, 'right', 'grip');
        this.rightToolArm.clear();
        this.rightToolArm.add(rightGrip);

        if (models.fpArmsAnimations && models.fpArmsAnimations.length > 0) {
          this.fpClipController = new FPArmsClipController(
            [leftArm, rightHand, rightGrip],
            models.fpArmsAnimations
          );
        }

        // 1b. Upgrade Held Stone Hatchet & Flint Pickaxe with Blender GLB tools
        if (models.tools.hatchetStone) {
          this.axeMesh.clear();
          const hatchet = models.tools.hatchetStone.clone(true);
          hatchet.position.set(0.0, 0.08, -0.02);
          hatchet.rotation.set(0.15, Math.PI * 0.5, 0);
          hatchet.scale.setScalar(0.92);
          this.axeMesh.add(hatchet);
        }
        if (models.tools.pickaxeFlint) {
          this.pickaxeMesh.clear();
          const pick = models.tools.pickaxeFlint.clone(true);
          pick.position.set(0.0, 0.08, -0.02);
          pick.rotation.set(0.15, Math.PI * 0.5, 0);
          pick.scale.setScalar(0.92);
          this.pickaxeMesh.add(pick);
        }
        if (models.buildables.torchStanding) {
          const torchGlb = models.buildables.torchStanding.clone(true);
          torchGlb.scale.setScalar(0.45);
          torchGlb.position.set(0, -0.18, 0);
          this.torchMesh.add(torchGlb);
        }

        // 2. Upgrade Flight 404 Plane Wreckage (plane_*.glb separate objects aligned with world.ts colliders)
        if (this.crashSiteGroup) {
          for (const child of [...this.crashSiteGroup.children]) {
            if (!this.crashSmokePuffs.includes(child as THREE.Mesh)) {
              this.crashSiteGroup.remove(child);
            }
          }
          const fuselage = models.wreckage.fuselage.clone(true);
          fuselage.position.set(0, -0.05, 0);
          fuselage.rotation.set(0.04, 0.35, 0.04);
          this.crashSiteGroup.add(fuselage);

          const wing = models.wreckage.wing.clone(true);
          wing.position.set(-1.5, -0.04, 2.6);
          wing.rotation.set(0.06, -0.4, -0.05);
          this.crashSiteGroup.add(wing);

          if (models.wreckage.engine) {
            const engine = models.wreckage.engine.clone(true);
            engine.position.set(-2.2, 0.02, 3.5);
            engine.rotation.set(0.05, -0.25, 0.04);
            this.crashSiteGroup.add(engine);
          }

          const tailFin = models.wreckage.tailFin.clone(true);
          tailFin.position.set(2.8, -0.06, -1.9);
          tailFin.rotation.set(0.05, 0.8, -0.12);
          this.crashSiteGroup.add(tailFin);

          const seat = models.wreckage.seat.clone(true);
          seat.position.set(-1.8, 0.0, 1.4);
          seat.rotation.set(0.03, 0.62, 0.05);
          this.crashSiteGroup.add(seat);

          const suitcase = models.wreckage.suitcase.clone(true);
          suitcase.position.set(1.4, 0.02, 2.2);
          suitcase.rotation.set(0, 0.9, 0);
          this.crashSiteGroup.add(suitcase);

          const panelDebris = models.wreckage.panelDebris.clone(true);
          panelDebris.position.set(-2.9, 0.02, -1.2);
          panelDebris.rotation.set(0.04, 0.5, 0.05);
          this.crashSiteGroup.add(panelDebris);

          this.enableGroupShadows(this.crashSiteGroup, castShad, castShad);
        }

        // 3. Upgrade All Gather Nodes with Phase 1 GLB Models + Selective Shadow Casting (Phase 5.4)
        for (const entry of this.nodeMeshes.values()) {
          const { def, group } = entry;
          if (def.type === 'palm_tree') {
            group.clear();
            const vIdx = Math.abs(Math.round(def.x * 7 + def.z * 13)) % 3;
            const lod = new THREE.LOD();
            const hi = models.palmTrees[vIdx].clone(true);
            const lo = models.palmTreeLods[vIdx].clone(true);
            lod.addLevel(hi, 0);
            lod.addLevel(lo, 76);
            group.add(lod);
            this.enableGroupShadows(group, castShad, castShad);
          } else if (
            def.type === 'boulder' ||
            def.type === 'iron_vein' ||
            def.type === 'copper_vein'
          ) {
            group.clear();
            const main = models.rocks.large.clone(true);
            main.scale.setScalar(0.88);
            group.add(main);
            const side = models.rocks.medium.clone(true);
            side.position.set(0.95, 0, 0.45);
            side.rotation.y = 1.4;
            group.add(side);
            this.enableGroupShadows(group, castShad, castShad);
          } else if (def.type === 'loose_stone') {
            group.clear();
            const peb = models.environment.pebbleCluster.clone(true);
            peb.scale.setScalar(0.95);
            group.add(peb);
            for (let i = 0; i < 2; i++) {
              const st = models.rocks.small.clone(true);
              st.scale.setScalar(0.76 - i * 0.12);
              st.position.set((i - 0.5) * 0.32, 0, (i % 2) * 0.18);
              st.rotation.y = i * 2.1;
              group.add(st);
            }
            this.enableGroupShadows(group, false, castShad);
          } else if (def.type === 'flint_nodule') {
            group.clear();
            const lod = new THREE.LOD();
            const hi = models.tools.flintSharp.clone(true);
            hi.scale.setScalar(1.35);
            const lo = models.tools.flintSharpLod.clone(true);
            lo.scale.setScalar(1.35);
            lod.addLevel(hi, 0);
            lod.addLevel(lo, 45);
            group.add(lod);
            this.enableGroupShadows(group, false, castShad);
          } else if (def.type === 'driftwood') {
            group.clear();
            const lod = new THREE.LOD();
            const hi = models.environment.driftwood.clone(true);
            const lo = models.environment.driftwoodLod.clone(true);
            lod.addLevel(hi, 0);
            lod.addLevel(lo, 55);
            group.add(lod);
            const branch = models.tools.branchFallen.clone(true);
            branch.position.set(0.28, 0.04, 0.24);
            branch.rotation.y = 0.65;
            group.add(branch);
            this.enableGroupShadows(group, false, castShad);
          } else if (def.type === 'fibre_bush' || def.type === 'berry_bush') {
            group.clear();
            const lod = new THREE.LOD();
            const hi = models.environment.bushTropical.clone(true);
            const lo = models.environment.bushTropicalLod.clone(true);
            lod.addLevel(hi, 0);
            lod.addLevel(lo, 55);
            group.add(lod);
            this.enableGroupShadows(group, false, castShad);
          } else if (def.type === 'herb_patch') {
            group.clear();
            const lod = new THREE.LOD();
            const hi = models.environment.fern.clone(true);
            const lo = models.environment.fernLod.clone(true);
            lod.addLevel(hi, 0);
            lod.addLevel(lo, 48);
            group.add(lod);
            this.enableGroupShadows(group, false, castShad);
          } else if (def.type === 'shell_cluster') {
            group.clear();
            for (let i = 0; i < 3; i++) {
              const sh = models.environment.shell.clone(true);
              sh.scale.setScalar(0.85 + (i % 2) * 0.2);
              sh.position.set((i - 1) * 0.24, 0.01, (i % 2) * 0.18);
              sh.rotation.y = i * 1.9;
              group.add(sh);
            }
            this.enableGroupShadows(group, false, castShad);
          } else if (def.type === 'supply_crate') {
            group.clear();
            const crate = models.buildables.crateStorage.clone(true);
            crate.scale.setScalar(0.92);
            group.add(crate);
            this.enableGroupShadows(group, castShad, castShad);
          } else if (def.type === 'crash_debris') {
            group.clear();
            const p = models.wreckage.panelDebris.clone(true);
            p.scale.setScalar(0.68);
            group.add(p);
            const sc = models.wreckage.suitcase.clone(true);
            sc.position.set(0.58, 0, 0.36);
            sc.rotation.y = 0.85;
            group.add(sc);
            this.enableGroupShadows(group, castShad, castShad);
          }
        }

        // 4. Upgrade Freshwater Spring Bank (pond_edge_bank.glb) & Add Coastal/Mountain Cliff Outcrops
        if (this.springGroup) {
          const keepPool = this.springGroup.children[0];
          this.springGroup.clear();
          if (keepPool) this.springGroup.add(keepPool);
          if (models.environment.pondEdgeBank) {
            const bank = models.environment.pondEdgeBank.clone(true);
            bank.position.set(0, -0.06, 0);
            this.springGroup.add(bank);
          }
          for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const rMesh = (i % 2 === 0 ? models.rocks.flat : models.rocks.small).clone(true);
            rMesh.scale.setScalar(i % 2 === 0 ? 0.52 : 0.6);
            rMesh.position.set(Math.cos(ang) * 2.55, -0.04, Math.sin(ang) * 2.55);
            rMesh.rotation.y = ang + 0.5;
            this.springGroup.add(rMesh);
          }
          this.enableGroupShadows(this.springGroup, false, castShad);
        }

        const cliffSpots: Array<[number, number, number, number, boolean]> = [
          [-26, 36, 0.4, 1.05, false],
          [28, 38, -0.5, 1.15, false],
          [-38, -14, 1.2, 1.2, true],
          [36, -18, -1.1, 1.1, true],
        ];
        const cliffGroup = new THREE.Group();
        const extractedCols: WorldCollider[] = [];
        for (let idx = 0; idx < cliffSpots.length; idx++) {
          const [cx, cz, rotY, sc, useMountain] = cliffSpots[idx];
          const cy = this.getTerrainHeight(cx, cz);
          const template = useMountain ? models.rocks.mountain : models.rocks.cliff;
          const cliff = template.clone(true);
          cliff.position.set(cx, Math.max(0, cy - 0.25), cz);
          cliff.rotation.y = rotY;
          cliff.scale.setScalar(sc);
          cliffGroup.add(cliff);
          const col = extractWorldColliderFromGLB(cliff, `glb_cliff_${idx}`, template);
          if (col) extractedCols.push(col);
        }
        this.staticGLBColliders = extractedCols;
        this.enableGroupShadows(cliffGroup, castShad, castShad);
        this.glbCliffsGroup = cliffGroup;
        this.scene.add(cliffGroup);

        // Refresh existing placed campfires, shelters, and structures with loaded GLBs
        for (const rec of this.campfires3D.values()) {
          this.scene.remove(rec.group);
        }
        this.campfires3D.clear();
        for (const rec of this.shelters3D.values()) {
          this.scene.remove(rec.group);
        }
        this.shelters3D.clear();
        if (this.latestState) {
          this.syncCampfires(this.latestState.campfires ?? []);
          this.syncShelters(this.latestState.shelters ?? []);
        }
        this.rebuildDynamicColliders();
        this.freezeStaticObject(this.crashSiteGroup);
        this.freezeStaticObject(this.glbCliffsGroup);
      })
      .catch(() => {
        // Keep procedural fallback meshes if GLB assets are unavailable
      });
  }

  public getQuality(): GraphicsQuality {
    return this.quality;
  }

  private rebuildCSM(enabled: boolean, shadowMapSize: number) {
    if (
      enabled &&
      !this.isSoftwareGl &&
      this.csm &&
      this.csmActiveShadowSize === shadowMapSize
    ) {
      return;
    }
    if (!enabled && !this.csm && this.csmGeneration > 0) {
      return;
    }

    const oldCsmMats = new Set<THREE.Material>();
    if (this.csm) {
      for (const m of this.csm.shaders.keys()) {
        oldCsmMats.add(m as THREE.Material);
      }
      this.csm.remove();
      this.csm.dispose();
      this.csm = null;
      this.csmActiveShadowSize = 0;
    }

    this.csmGeneration += 1;
    const gen = this.csmGeneration;

    const customShaderMaterials: Array<{
      mat: THREE.MeshStandardMaterial;
      hook: (shader: THREE.WebGLProgramParametersWithUniforms) => void;
      cacheKey: string;
    }> = [];
    if (this.terrainMatRecord) {
      customShaderMaterials.push({
        mat: this.terrainMatRecord.material,
        hook: this.terrainMatRecord.customCompile,
        cacheKey: 'stranded-terrain-splat-v2',
      });
    }
    if (this.foliageField) {
      customShaderMaterials.push({
        mat: this.foliageField.grassMaterial,
        hook: this.foliageField.grassCompileHook,
        cacheKey: 'stranded-grass-instanced-v1',
      });
    }

    const customMats = new Set<THREE.Material>(customShaderMaterials.map((item) => item.mat));

    if (enabled && !this.isSoftwareGl) {
      this.scene.remove(this.sunLight);
      this.csm = new CSM({
        camera: this.camera,
        parent: this.scene,
        cascades: GRAPHICS_TUNING.CSM_CASCADES,
        maxFar: GRAPHICS_TUNING.CSM_MAX_FAR,
        mode: 'practical',
        shadowMapSize,
        shadowBias: -0.0004,
        lightDirection: new THREE.Vector3(-0.4, -0.7, -0.4).normalize(),
      });
      this.csmActiveShadowSize = shadowMapSize;
      this.csm.fade = true;
      for (const l of this.csm.lights) {
        l.shadow.normalBias = 0.025;
      }
      // Register all other lit scene materials so CSM never falls back to 3x summed directional lights
      const seenMats = new Set<THREE.Material>();
      this.scene.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat || seenMats.has(mat) || customMats.has(mat)) continue;
          seenMats.add(mat);
          if (
            (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial ||
            (mat as THREE.ShaderMaterial).isShaderMaterial ||
            mat.userData.__csmSkip
          ) {
            continue;
          }
          this.csm!.setupMaterial(mat);
          mat.customProgramCacheKey = () => `csm-mat-${gen}`;
          mat.needsUpdate = true;
        }
      });

      // Compose custom terrain splat / wind-grass onBeforeCompile after CSM patched them
      for (const item of customShaderMaterials) {
        this.csm.setupMaterial(item.mat);
        const csmOnBeforeCompile = item.mat.onBeforeCompile;
        item.mat.onBeforeCompile = (shader, renderer) => {
          csmOnBeforeCompile.call(item.mat, shader, renderer);
          item.hook(shader);
        };
        item.mat.customProgramCacheKey = () => `${item.cacheKey}-csm-${gen}`;
        item.mat.needsUpdate = true;
      }
      this.csm.update();
    } else {
      if (!this.sunLight.parent) {
        this.scene.add(this.sunLight);
      }
      for (const mat of oldCsmMats) {
        if (customMats.has(mat)) continue;
        mat.customProgramCacheKey = () => `csm-off-${gen}`;
        mat.needsUpdate = true;
      }
      for (const item of customShaderMaterials) {
        item.mat.onBeforeCompile = item.hook;
        item.mat.customProgramCacheKey = () => `${item.cacheKey}-plain-${gen}`;
        item.mat.needsUpdate = true;
      }
    }
  }

  private rebuildWaterReflection(enabled: boolean) {
    if (!enabled || this.isSoftwareGl) {
      if (this.waterReflectionRT) {
        this.waterReflectionRT.dispose();
        this.waterReflectionRT = null;
      }
      if (this.oceanMaterials) {
        this.oceanMaterials.shaderMaterial.uniforms.uHasPlanarReflection.value = 0;
      }
      return;
    }
    if (!this.waterReflectionRT) {
      const sz = GRAPHICS_TUNING.WATER_REFLECTION_SIZE;
      this.waterReflectionRT = new THREE.WebGLRenderTarget(sz, sz, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        type: THREE.HalfFloatType,
      });
      this.waterReflectionRT.texture.generateMipmaps = false;
    }
    if (this.oceanMaterials) {
      this.oceanMaterials.shaderMaterial.uniforms.uReflectionMap.value =
        this.waterReflectionRT.texture;
      this.oceanMaterials.shaderMaterial.uniforms.uHasPlanarReflection.value = 1;
    }
  }

  private refreshSkyIBL(force: boolean = false, hour: number = 9) {
    if (this.isSoftwareGl || !this.pmremGenerator || !this.skyDome) return;
    if (!force && Math.abs(hour - this.lastIblHour) < GRAPHICS_TUNING.IBL_REFRESH_HOURS) {
      return;
    }
    this.lastIblHour = hour;
    const nextEnv = this.pmremGenerator.fromScene(this.skyDome.iblScene, 0.03);
    if (this.iblEnvRT) {
      this.iblEnvRT.dispose();
    }
    this.iblEnvRT = nextEnv;
    this.scene.environment = nextEnv.texture;
  }

  public setQuality(nextQuality: GraphicsQuality) {
    this.quality = nextQuality;
    saveGraphicsQuality(nextQuality);

    const preset = GRAPHICS_PRESETS[nextQuality];
    const effectiveShadows = !this.isSoftwareGl && preset.shadows;
    const targetPr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, preset.pixelRatioCap);

    this.renderer.setPixelRatio(targetPr);
    this.renderer.shadowMap.enabled = effectiveShadows;
    this.renderer.shadowMap.needsUpdate = effectiveShadows;
    this.sunLight.castShadow = effectiveShadows && !preset.csm;

    if (
      this.sunLight.shadow.mapSize.width !== preset.shadowMapSize ||
      this.sunLight.shadow.mapSize.height !== preset.shadowMapSize
    ) {
      this.sunLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }

    const usePBR = !this.isSoftwareGl && preset.pbrMaps;
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.pbrBank.setAnisotropy(nextQuality === 'ultra' ? maxAniso : nextQuality === 'high' ? 4 : 2);
    this.pbrBank.applyScenePBR(this.scene, usePBR, usePBR ? 0.28 : 0.14);

    if (this.terrainMatRecord) {
      this.terrainMatRecord.uniforms.uUsePBR.value = usePBR ? 1 : 0;
    }
    if (this.foliageField) {
      this.foliageField.setDensity(this.isSoftwareGl ? 0 : preset.grassDensity);
    }

    this.rebuildCSM(effectiveShadows && preset.csm, preset.shadowMapSize);

    if (this.waterMesh && this.oceanMaterials) {
      this.waterMesh.material =
        !this.isSoftwareGl && preset.waterShader
          ? this.oceanMaterials.shaderMaterial
          : this.oceanMaterials.fallbackMaterial;
    }
    this.rebuildWaterReflection(preset.planarReflection && preset.waterShader);
    this.refreshSkyIBL(true, this.latestState?.clock.hour ?? 9);

    if (this.postFx && !this.isSoftwareGl) {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.postFx.setSize(w, h, targetPr);
      this.postFx.configure({
        bloom: preset.bloom,
        grade: preset.colorGrade,
        ssao: preset.ssao,
        smaa: preset.smaa,
        dof: preset.dof,
      });
    }

    if (!preset.fireShadow) {
      for (const fire of this.campfires3D.values()) {
        fire.light.castShadow = false;
      }
    }
  }

  private enableGroupShadows(obj: THREE.Object3D, cast: boolean = true, receive: boolean = true) {
    const preset = GRAPHICS_PRESETS[this.quality];
    const usePBR = !this.isSoftwareGl && preset.pbrMaps;
    if (usePBR) {
      this.pbrBank.applyScenePBR(obj, true, 0.28);
    }
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.Material | undefined;
        if (
          !mat ||
          (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial ||
          (mat as THREE.ShaderMaterial).isShaderMaterial ||
          mat.transparent
        ) {
          return;
        }
        if (cast && !mesh.geometry.boundingSphere) {
          mesh.geometry.computeBoundingSphere();
        }
        const bsR = mesh.geometry.boundingSphere?.radius ?? 1;
        const maxS = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
        mesh.castShadow = cast && bsR * maxS >= 0.55;
        mesh.receiveShadow = receive;
        if (this.csm && !mat.userData.__csmSkip && !this.csm.shaders.has(mat)) {
          this.csm.setupMaterial(mat);
          mat.customProgramCacheKey = () => `csm-mat-${this.csmGeneration}`;
          mat.needsUpdate = true;
        }
      }
    });
  }

  private enableAllWorldShadows() {
    this.scene.traverse((child) => {
      if (
        child === this.camera ||
        child === this.terrainMesh ||
        child === this.waterMesh ||
        child === this.skyDome?.mesh ||
        child === this.moonMesh ||
        child === this.foliageField?.group
      ) {
        return;
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if ((mesh.name || '').toUpperCase().includes('COLLIDER')) {
          mesh.visible = false;
          return;
        }
        const mat = mesh.material as THREE.Material | undefined;
        if (!mat || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial || mat.transparent) {
          return;
        }
        // Keep first-person held arms/tools and small ground scatter excluded from shadow casting
        let parent: THREE.Object3D | null = mesh;
        while (parent) {
          if (
            parent === this.camera ||
            parent === this.toolRig ||
            parent === this.offhandRig ||
            parent === this.foliageField?.group ||
            parent === this.worldLifeFx?.root
          ) {
            return;
          }
          parent = parent.parent;
        }
        if (!mesh.geometry.boundingSphere) {
          mesh.geometry.computeBoundingSphere();
        }
        const bsR = mesh.geometry.boundingSphere?.radius ?? 1;
        const maxS = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
        // Tiny ground twigs/stones (<0.55m) only receive shadows to avoid cluttering 3x CSM cascades
        mesh.castShadow = bsR * maxS >= 0.55;
        mesh.receiveShadow = true;
      }
    });
  }

  public getExtendedGraphicsSettings(): ExtendedGraphicsSettings {
    return { ...this.extSettings };
  }

  public getExtendedSettings(): ExtendedGraphicsSettings {
    return this.getExtendedGraphicsSettings();
  }

  public setExtendedGraphicsSettings(partial: Partial<ExtendedGraphicsSettings>) {
    this.extSettings = { ...this.extSettings, ...partial };
    saveExtendedGraphicsSettings(this.extSettings);
    if (this.extSettings.batterySaver) {
      this.extSettings.fpsLimit = 30;
    }
    this.applyEffectivePixelRatioAndViewDist();
  }

  public setExtendedSettings(partial: Partial<ExtendedGraphicsSettings>) {
    this.setExtendedGraphicsSettings(partial);
  }

  private applyEffectivePixelRatioAndViewDist() {
    const preset = GRAPHICS_PRESETS[this.quality];
    const basePr = this.isSoftwareGl
      ? 1.0
      : Math.min(window.devicePixelRatio || 1, preset.pixelRatioCap);
    const scale = this.extSettings.batterySaver
      ? Math.min(0.78, this.extSettings.renderScale)
      : this.extSettings.renderScale * this.dynamicResScale;
    const effectivePr = Math.max(0.5, basePr * scale);
    this.renderer.setPixelRatio(effectivePr);
    if (this.postFx && !this.isSoftwareGl) {
      this.postFx.setSize(
        this.container.clientWidth,
        this.container.clientHeight,
        effectivePr
      );
    }
    const farDist =
      this.extSettings.viewDistance === 'near'
        ? 320
        : this.extSettings.viewDistance === 'medium'
          ? 520
          : 780;
    if (this.camera.far !== farDist) {
      this.camera.far = farDist;
      this.camera.updateProjectionMatrix();
    }
  }

  public getPerformanceMetrics(): PerformanceMetrics {
    const info = this.renderer.info;
    const perfMem = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory;
    const heapMb = perfMem?.usedJSHeapSize
      ? Math.round(perfMem.usedJSHeapSize / (1024 * 1024))
      : Math.round((info.memory.geometries * 0.18 + info.memory.textures * 1.4) * 10) / 10;
    return {
      fps: this.fpsValue,
      frameTimeMs: Math.round(this.frameTimeMs * 10) / 10,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      textures: info.memory.textures,
      geometries: info.memory.geometries,
      memoryMB: heapMb,
      renderScale: Math.round(this.extSettings.renderScale * this.dynamicResScale * 100),
      fpsLimit: this.extSettings.batterySaver ? 30 : this.extSettings.fpsLimit,
      batterySaver: this.extSettings.batterySaver,
    };
  }

  public setCallbacks(callbacks: {
    onPrimaryAction?: (target: HoveredTargetInfo | null) => void;
    onOpenCampfireCraft?: () => void;
    onCancelBuild?: () => void;
    onStepSound?: (surface: StepSurface) => void;
    onJump?: () => void;
    onFallImpact?: (fallMeters: number) => void;
    onThunderStrike?: () => void;
  }) {
    this.onPrimaryAction = callbacks.onPrimaryAction;
    this.onOpenCampfireCraft = callbacks.onOpenCampfireCraft;
    this.onCancelBuild = callbacks.onCancelBuild;
    this.onStepSound = callbacks.onStepSound;
    this.onJump = callbacks.onJump;
    this.onFallImpact = callbacks.onFallImpact;
    this.onThunderStrike = callbacks.onThunderStrike;
  }

  public unlockPointer() {
    this.keys = {};
    this.isDragging = false;
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // ignore
      }
    }
  }

  public lockPointer() {
    const canvas = this.renderer?.domElement;
    if (!canvas || this.isDisposed) return;
    this.keys = {};
    this.isDragging = false;
    if (document.pointerLockElement !== canvas) {
      try {
        const res = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            // Pointer lock may require direct click activation after native Esc unlock
          });
        }
      } catch {
        // ignore
      }
    }
  }

  public setUiBlocked(blocked: boolean) {
    this.isUiBlocked = blocked;
    if (blocked) {
      this.unlockPointer();
    }
  }

  public triggerDamageJolt() {
    this.damageJoltTimer = 0.38;
    this.bloodLevel = Math.min(1, this.bloodLevel + 0.55);
    this.grimeLevel = Math.min(1, this.grimeLevel + 0.25);
    this.worldLifeFx?.scatterBirds(this.playerPos);
    this.euphoria.triggerHit(Math.random() > 0.5 ? 1 : -1, 1.0);
    this.fpClipController?.triggerOneShot('DamageFlinch', 0.38);
  }

  public triggerToolSwing(kind?: ToolKind | null) {
    this.isSwinging = true;
    this.swingAnimationTimer = 0;
    this.activeSwingKind = kind ?? this.currentEquippedTool;
    this.fpClipController?.triggerOneShot('ChopSwing', ANIMATION_TUNING.CHOP_SWING_DURATION_SEC);
  }

  public notifyToolImpact(): void {
    this.fpIKRig?.notifyImpactHit();
  }

  public toggleInspectItem(): boolean {
    return this.fpIKRig?.toggleInspect() ?? false;
  }

  public setStanceBlockedCallback(cb: (reason: string) => void): void {
    this.onStanceBlocked = cb;
  }

  public getStance(): PlayerStance {
    return this.stance;
  }

  public getSleepFadeAlpha(): number {
    return this.sleepFadeAlpha;
  }

  /** Raycasts straight up from chest/hips to measure headroom height above feet. */
  private getOverheadClearanceRayM(): number {
    if (this.footRayTargets.length === 0) return Infinity;
    this.overheadRaycaster.ray.origin.set(
      this.playerPos.x,
      this.playerFootY + 0.25,
      this.playerPos.z
    );
    const hits = this.overheadRaycaster.intersectObjects(this.footRayTargets, true);
    for (let i = 0; i < hits.length; i++) {
      const obj = hits[i].object;
      if (obj.visible) {
        return hits[i].distance + 0.25;
      }
    }
    return Infinity;
  }

  private emitStanceBlocked(reason: string): void {
    const now = performance.now();
    if (now - this.lastStanceBlockedWarnAt > 1100) {
      this.lastStanceBlockedWarnAt = now;
      this.onStanceBlocked?.(reason);
    }
  }

  private trySetStance(next: PlayerStance, silent: boolean = false): boolean {
    if (this.sleepPhase !== 'none' && next !== 'sleep') return false;
    if (this.isSwimming && next !== 'stand') {
      this.stance = 'stand';
      this.isCrouching = false;
      return false;
    }

    const shelters = this.latestState?.shelters ?? [];
    const rayClear = this.getOverheadClearanceRayM();
    const check = canEnterStance(next, this.playerPos.x, this.playerPos.z, shelters, rayClear);
    if (!check.allowed) {
      if (next === 'stand') {
        const crouchCheck = canEnterStance(
          'crouch',
          this.playerPos.x,
          this.playerPos.z,
          shelters,
          rayClear
        );
        if (crouchCheck.allowed) {
          this.stance = 'crouch';
          this.isCrouching = true;
          if (!silent) {
            this.emitStanceBlocked(`${check.reason ?? 'Low overhead'} — crouched instead`);
          }
          return true;
        }
      }
      if (!silent) {
        this.emitStanceBlocked(check.reason ?? 'Not enough headroom here');
      }
      return false;
    }

    this.stance = next;
    this.isCrouching = next === 'crouch';
    return true;
  }

  public startSleepCinematic(shelter: PlacedShelter, onPeakBlackout: () => void): void {
    if (this.sleepPhase !== 'none') return;
    // Step smoothly onto the sleeping mat area inside the lean-to shelter
    this.playerPos.x = shelter.x + Math.sin(shelter.yaw) * 0.22;
    this.playerPos.z = shelter.z + Math.cos(shelter.yaw) * 0.22;
    this.velX = 0;
    this.velZ = 0;
    this.stance = 'sleep';
    this.isCrouching = false;
    this.sleepPhase = 'lying_down';
    this.sleepPhaseTimer = 0;
    this.sleepFadeAlpha = 0;
    this.sleepBlackoutFired = false;
    this.onSleepBlackoutCb = onPeakBlackout;
  }

  public triggerPickupAnimation(
    worldPos?: THREE.Vector3,
    reach: 'ground' | 'waist' | 'bush' = 'ground',
    nodeGroup?: THREE.Object3D
  ) {
    this.pickupAnimTimer = ANIMATION_TUNING.PICKUP_DURATION_SEC;
    this.pickupReachHeight = reach;
    const clip: FPArmClipName =
      reach === 'bush' ? 'PluckBush' : reach === 'waist' ? 'PickupWaist' : 'PickupGround';
    this.fpClipController?.triggerOneShot(clip, ANIMATION_TUNING.PICKUP_DURATION_SEC);

    if (worldPos) {
      let flyMesh: THREE.Object3D;
      if (nodeGroup && nodeGroup.children.length > 0) {
        flyMesh = nodeGroup.children[0].clone(true);
        flyMesh.scale.multiplyScalar(0.55);
      } else if (this.loadedGLBs?.rocks.small) {
        flyMesh = this.loadedGLBs.rocks.small.clone(true);
        flyMesh.scale.setScalar(0.42);
      } else {
        flyMesh = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.12, 0),
          new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.8 })
        );
      }
      flyMesh.position.copy(worldPos);
      this.scene.add(flyMesh);
      this.flyingPickups.push({
        mesh: flyMesh,
        startPos: worldPos.clone(),
        elapsed: 0,
        duration: 0.44,
      });
    }
  }

  public triggerActionAnimation(
    action: 'drink' | 'drink_spring' | 'eat' | 'craft' | 'place' | 'bandage' | 'map_look'
  ) {
    const clipMap: Record<
      'drink' | 'drink_spring' | 'eat' | 'craft' | 'place' | 'bandage' | 'map_look',
      FPArmClipName
    > = {
      drink: 'Drink',
      drink_spring: 'Drink',
      eat: 'Eat',
      craft: 'CraftBuild',
      place: 'PlaceObject',
      bandage: 'CraftBuild',
      map_look: 'Idle',
    };
    this.fpClipController?.triggerOneShot(clipMap[action], 0.55);

    if (action === 'drink_spring') {
      this.actionTimers.drinkCupped = ACTION_TUNING.DRINK_SPRING_DURATION_SEC;
    } else if (action === 'drink') {
      this.actionTimers.drinkBottle = ACTION_TUNING.DRINK_BOTTLE_DURATION_SEC;
    } else if (action === 'eat') {
      this.actionTimers.eat = ACTION_TUNING.EAT_DURATION_SEC;
    } else if (action === 'bandage') {
      this.actionTimers.bandage = ACTION_TUNING.BANDAGE_DURATION_SEC;
      this.bandagedActive = true;
    } else if (action === 'map_look') {
      this.actionTimers.mapLook = ACTION_TUNING.MAP_GLANCE_DURATION_SEC;
    } else if (action === 'craft') {
      this.actionTimers.craft = ACTION_TUNING.CRAFT_DURATION_SEC;
    } else if (action === 'place') {
      this.actionTimers.place = ACTION_TUNING.PLACE_DURATION_SEC;
    }
  }

  public setActionAudioCallbacks(callbacks: {
    onSwimStroke?: () => void;
    onTreeFell?: () => void;
    onCough?: () => void;
    onShiver?: () => void;
  }): void {
    this.actionAudioCallbacks = callbacks;
  }

  public setPart5Callbacks(callbacks: typeof this.part5Callbacks): void {
    this.part5Callbacks = callbacks;
  }

  private freezeStaticObject(obj: THREE.Object3D | null | undefined): void {
    if (!obj) return;
    obj.traverse((child) => {
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    });
    obj.updateMatrixWorld(true);
  }

  private getKeybind(action: keyof ControlKeybinds): string {
    return this.extSettings.keybinds?.[action] ?? DEFAULT_KEYBINDS[action];
  }

  private isActionKey(action: keyof ControlKeybinds): boolean {
    const code = this.getKeybind(action);
    if (this.keys[code]) return true;
    if (action === 'forward' && this.keys['ArrowUp']) return true;
    if (action === 'back' && this.keys['ArrowDown']) return true;
    if (action === 'left' && this.keys['ArrowLeft']) return true;
    if (action === 'right' && this.keys['ArrowRight']) return true;
    if (action === 'crouch' && this.keys['ControlLeft']) return true;
    if (action === 'sprint' && this.keys['ShiftRight']) return true;
    return false;
  }

  public isInPhotoMode(): boolean {
    return this.photoMode;
  }

  public setPhotoFilter(filterIdx: number): void {
    this.photoFilter = Math.max(0, Math.min(PART5_IMMERSION_TUNING.PHOTO_FILTER_NAMES.length - 1, filterIdx));
    this.part5Callbacks.onPhotoModeChange?.(this.photoMode, this.photoFilter);
  }

  public exitPhotoMode(): void {
    if (!this.photoMode) return;
    this.togglePhotoMode();
  }

  public togglePhotoMode(): boolean {
    const inVoy = Boolean(this.latestState?.voyage && this.latestState.voyage.phase !== 'docked');
    if (inVoy || this.sleepPhase !== 'none') return this.photoMode;
    this.photoMode = !this.photoMode;
    if (this.photoMode) {
      this.photoSavedCam = {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
        pitch: this.pitch,
        yaw: this.yaw,
      };
      this.fullBodyController?.setShowHeadForPhotoMode(true);
      if (this.fpIKRig) this.fpIKRig.root.visible = false;
      this.toolRig.visible = false;
      this.offhandRig.visible = false;
      this.unlockPointer();
    } else if (this.photoSavedCam) {
      this.camera.position.set(this.photoSavedCam.x, this.photoSavedCam.y, this.photoSavedCam.z);
      this.pitch = this.photoSavedCam.pitch;
      this.yaw = this.photoSavedCam.yaw;
      this.targetPitch = this.photoSavedCam.pitch;
      this.targetYaw = this.photoSavedCam.yaw;
      this.photoSavedCam = null;
      this.fullBodyController?.setShowHeadForPhotoMode(false);
      if (this.fpIKRig) this.fpIKRig.root.visible = true;
    }
    this.part5Callbacks.onPhotoModeChange?.(this.photoMode, this.photoFilter);
    return this.photoMode;
  }

  public capturePhotoSnapshot(): string | null {
    try {
      const usePostFx = this.postFx && !this.isSoftwareGl && this.postFx.hasActivePasses();
      if (usePostFx && this.postFx) {
        this.postFx.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
      return this.renderer.domElement.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  /** Spawns splintered wood & stone shards right in front of the camera when a tool shatters. */
  public spawnToolBreakShards(): void {
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    const origin = this.camera.position.clone().addScaledVector(fwd, 0.55);
    origin.y -= 0.12;
    const shardGeom = new THREE.DodecahedronGeometry(0.036, 0);
    for (let i = 0; i < 12; i++) {
      const isWood = i % 2 === 0;
      const mat = new THREE.MeshStandardMaterial({
        color: isWood ? 0x6b4c35 : 0x78716c,
        roughness: isWood ? 0.9 : 0.72,
      });
      const shard = new THREE.Mesh(shardGeom, mat);
      shard.scale.set(isWood ? 1.8 : 0.9, 0.65, isWood ? 0.55 : 0.9);
      shard.position.copy(origin).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.14,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.14
        )
      );
      this.scene.add(shard);
      this.particles.push({
        mesh: shard,
        velocity: new THREE.Vector3(
          fwd.x * 1.4 + (Math.random() - 0.5) * 2.8,
          1.2 + Math.random() * 2.2,
          fwd.z * 1.4 + (Math.random() - 0.5) * 2.8
        ),
        lifetime: 0,
        maxLifetime: 0.75 + Math.random() * 0.35,
        gravity: 9.2,
      });
    }
  }

  /** Spawns bright glowing flint/ember ignition sparks when lighting a campfire. */
  public spawnSparkBurst(worldPos: THREE.Vector3): void {
    const geom = new THREE.OctahedronGeometry(0.032, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfdba74 });
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(geom, mat);
      m.position.set(
        worldPos.x + (Math.random() - 0.5) * 0.18,
        worldPos.y + 0.18 + Math.random() * 0.14,
        worldPos.z + (Math.random() - 0.5) * 0.18
      );
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.6,
          1.6 + Math.random() * 2.8,
          (Math.random() - 0.5) * 2.6
        ),
        lifetime: 0,
        maxLifetime: 0.42 + Math.random() * 0.35,
        gravity: 6.5,
      });
    }
  }

  /**
   * Records physical chop notches, bush/tree spring shake, and toppling trunk physics
   * when chopping trees, mining rock veins, or shaking/plucking plants.
   */
  public recordNodeInteraction(
    nodeId: string,
    sound: 'chop' | 'mine' | 'pickup' | 'blocked',
    depleted: boolean
  ): void {
    const rec = this.nodeMeshes.get(nodeId);
    if (!rec) return;

    // Outward strike direction away from player
    let dx = rec.def.x - this.playerPos.x;
    let dz = rec.def.z - this.playerPos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) {
      dx = -Math.sin(this.yaw);
      dz = -Math.cos(this.yaw);
    } else {
      dx /= len;
      dz /= len;
    }

    // Spring-damped shake on struck tree, bush, or plant
    this.grimeLevel = Math.min(1, this.grimeLevel + (sound === 'chop' || sound === 'mine' ? 0.12 : 0.05));
    this.worldLifeFx?.scatterBirds(this.playerPos);
    this.nodeJiggles.set(nodeId, {
      timer: 0,
      dur: sound === 'chop' ? 0.52 : 0.42,
      dirX: dx,
      dirZ: dz,
      amp: sound === 'chop' ? 0.065 : sound === 'pickup' ? 0.09 : 0.025,
    });

    const isTree = rec.def.type === 'palm_tree' || rec.def.type === 'resin_tree';
    if (isTree && sound === 'chop' && !depleted) {
      // Carve a dark axe notch wedge ring around the trunk at strike height
      const notches = this.chopNotches.get(nodeId) ?? [];
      const depth = Math.min(3, notches.length + 1);
      const notch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.185 - depth * 0.015, 0.17, 0.11, 10),
        new THREE.MeshStandardMaterial({ color: 0x3f2718, roughness: 0.92 })
      );
      notch.position.set(dx * -0.05, 0.85 + depth * 0.05, dz * -0.05);
      rec.group.add(notch);
      notches.push(notch);
      this.chopNotches.set(nodeId, notches);
    }

    if (isTree && depleted) {
      this.actionAudioCallbacks.onTreeFell?.();
      // Remove notches & leave a freshly chopped wooden stump until respawn
      const existingNotches = this.chopNotches.get(nodeId);
      if (existingNotches) {
        for (const n of existingNotches) {
          rec.group.remove(n);
          n.geometry.dispose();
          (n.material as THREE.Material).dispose();
        }
        this.chopNotches.delete(nodeId);
      }

      if (!this.chopStumps.has(nodeId)) {
        const stump = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.24, 0.56, 10),
          new THREE.MeshStandardMaterial({ color: 0x7c4f2b, roughness: 0.88 })
        );
        stump.position.set(rec.def.x, rec.def.y + 0.26, rec.def.z);
        stump.castShadow = true;
        stump.receiveShadow = true;
        this.scene.add(stump);
        this.chopStumps.set(nodeId, stump);
      }

      // Spawn a physics-falling trunk clone that topples under angular gravity, bounces & dissolves
      const pivot = new THREE.Group();
      pivot.position.set(rec.def.x, rec.def.y + 0.2, rec.def.z);
      const clone = rec.group.clone(true);
      clone.position.set(0, -0.2, 0);
      clone.rotation.set(0, rec.group.rotation.y, 0);
      clone.scale.copy(rec.group.scale);
      clone.visible = true;
      pivot.add(clone);
      this.scene.add(pivot);
      this.fallingTrees.push({
        pivot,
        tilt: 0.06,
        angVel: 0.45,
        dirX: dx,
        dirZ: dz,
        bounced: false,
        restTimer: 0,
        phase: 'falling',
        fadeTimer: 0,
      });
    }
  }

  private updatePart4WorldPhysics(dt: number): void {
    // 1. Damped tree/bush strike shake
    for (const [nodeId, jg] of this.nodeJiggles.entries()) {
      jg.timer += dt;
      const rec = this.nodeMeshes.get(nodeId);
      if (rec) {
        if (jg.timer >= jg.dur) {
          rec.group.rotation.x = 0;
          rec.group.rotation.z = 0;
          this.nodeJiggles.delete(nodeId);
        } else {
          const p = jg.timer / jg.dur;
          const osc = Math.sin(p * Math.PI * 5) * (1 - p) * jg.amp;
          rec.group.rotation.z = -jg.dirX * osc;
          rec.group.rotation.x = jg.dirZ * osc;
        }
      } else {
        this.nodeJiggles.delete(nodeId);
      }
    }

    // 2. Falling tree angular gravity + bounce + dissolve
    const remaining: typeof this.fallingTrees = [];
    for (const ft of this.fallingTrees) {
      if (ft.phase === 'falling') {
        const angularAccel = ACTION_TUNING.TREE_FALL_GRAVITY_TORQUE * Math.sin(Math.max(0.14, ft.tilt));
        ft.angVel += angularAccel * dt;
        ft.tilt += ft.angVel * dt;
        const maxTilt = Math.PI * 0.485;
        if (ft.tilt >= maxTilt) {
          ft.tilt = maxTilt;
          if (!ft.bounced && ft.angVel > 1.2) {
            ft.bounced = true;
            ft.angVel = -ft.angVel * ACTION_TUNING.TREE_BOUNCE_RESTITUTION;
            const hitPos = new THREE.Vector3(
              ft.pivot.position.x + ft.dirX * 3.8,
              this.getTerrainHeight(
                ft.pivot.position.x + ft.dirX * 3.8,
                ft.pivot.position.z + ft.dirZ * 3.8
              ) + 0.25,
              ft.pivot.position.z + ft.dirZ * 3.8
            );
            this.spawnHarvestDebris('chop', hitPos);
          } else {
            ft.angVel = 0;
            ft.phase = 'resting';
          }
        }
        // Lean cleanly along (dirX, dirZ) axis
        ft.pivot.quaternion.setFromAxisAngle(
          new THREE.Vector3(ft.dirZ, 0, -ft.dirX).normalize(),
          ft.tilt
        );
        remaining.push(ft);
      } else if (ft.phase === 'resting') {
        ft.restTimer += dt;
        if (ft.restTimer >= ACTION_TUNING.TREE_FALL_REST_SEC) {
          ft.phase = 'fading';
        }
        remaining.push(ft);
      } else {
        ft.fadeTimer += dt;
        const t = ft.fadeTimer / ACTION_TUNING.TREE_FALL_DISSOLVE_SEC;
        if (t >= 1) {
          this.scene.remove(ft.pivot);
        } else {
          ft.pivot.scale.setScalar(Math.max(0.02, 1 - t));
          ft.pivot.position.y -= dt * 0.22;
          remaining.push(ft);
        }
      }
    }
    this.fallingTrees = remaining;
  }

  private rebuildDynamicColliders() {
    const cols: WorldCollider[] = [...this.staticGLBColliders];

    for (const [id, rec] of this.nodeMeshes.entries()) {
      if (!rec.group.visible) continue;
      const t = rec.def.type;
      const sc = Math.max(0.75, rec.baseScale);
      if (t === 'palm_tree' || t === 'resin_tree') {
        cols.push({
          kind: 'circle',
          id: `node_${id}`,
          x: rec.def.x,
          z: rec.def.z,
          radius: COLLISION_TUNING.TREE_TRUNK_RADIUS * sc,
        });
      } else if (
        t === 'boulder' ||
        t === 'copper_vein' ||
        t === 'iron_vein' ||
        t === 'flint_nodule'
      ) {
        cols.push({
          kind: 'circle',
          id: `node_${id}`,
          x: rec.def.x,
          z: rec.def.z,
          radius: 0.76 * sc,
        });
      } else if (
        t === 'supply_crate' ||
        t === 'fuel_drum' ||
        t === 'tech_wreck' ||
        t === 'crash_debris'
      ) {
        cols.push({
          kind: 'circle',
          id: `node_${id}`,
          x: rec.def.x,
          z: rec.def.z,
          radius: 0.65 * sc,
        });
      }
    }

    for (const [id, fire] of this.campfires3D.entries()) {
      cols.push({
        kind: 'circle',
        id: `fire_${id}`,
        x: fire.data.x,
        z: fire.data.z,
        radius: 0.48,
      });
    }

    for (const [id, sh] of this.shelters3D.entries()) {
      cols.push({
        kind: 'obb',
        id: `shelter_back_${id}`,
        x: sh.data.x - Math.sin(sh.data.yaw) * 0.85,
        z: sh.data.z - Math.cos(sh.data.yaw) * 0.85,
        halfW: 1.05,
        halfD: 0.24,
        yaw: sh.data.yaw,
      });
    }

    for (const [id, st] of this.structures3D.entries()) {
      const s = st.data;
      switch (s.type) {
        case 'workbench':
          cols.push({
            kind: 'obb',
            id: `st_${id}`,
            x: s.x,
            z: s.z,
            halfW: 1.0,
            halfD: 0.54,
            yaw: s.yaw,
          });
          break;
        case 'storage_chest':
          cols.push({
            kind: 'obb',
            id: `st_${id}`,
            x: s.x,
            z: s.z,
            halfW: 0.58,
            halfD: 0.38,
            yaw: s.yaw,
          });
          break;
        case 'drying_rack':
          cols.push({
            kind: 'obb',
            id: `st_${id}`,
            x: s.x,
            z: s.z,
            halfW: 0.85,
            halfD: 0.34,
            yaw: s.yaw,
          });
          break;
        case 'water_collector':
          cols.push({ kind: 'circle', id: `st_${id}`, x: s.x, z: s.z, radius: 0.65 });
          break;
        case 'forge':
          cols.push({ kind: 'circle', id: `st_${id}`, x: s.x, z: s.z, radius: 0.92 });
          break;
        default:
          break;
      }
    }

    this.dynamicCollidersCache = cols;
    this.rebuildFootRayTargets();
  }

  private rebuildFootRayTargets() {
    const targets: THREE.Object3D[] = [];
    if (this.crashSiteGroup) targets.push(this.crashSiteGroup);
    if (this.springGroup) targets.push(this.springGroup);
    if (this.glbCliffsGroup) targets.push(this.glbCliffsGroup);
    for (const sh of this.shelters3D.values()) targets.push(sh.group);
    for (const st of this.structures3D.values()) targets.push(st.group);
    this.footRayTargets = targets;
  }

  public syncState(state: SurvivalState) {
    const prevState = this.latestState;
    this.latestState = state;

    // Update equipped tool & holdable IK visual
    const equipped = getEquipped(state.inventory, state.selectedSlot);
    const nextKind = equipped.def?.tool?.kind ?? null;
    const nextItemId: ItemId | null = equipped.def?.id ?? null;
    if (nextKind !== this.currentEquippedTool || nextItemId !== this.currentEquippedItemId) {
      this.equipAnimTimer = 1.0;
      this.fpClipController?.triggerOneShot('SwitchItem', 0.42);
    }
    this.currentEquippedTool = nextKind;
    this.currentEquippedItemId = nextItemId;
    this.setEquippedToolMesh(nextKind);
    this.fpIKRig?.setHeldItem(this.buildPreviewType ? 'hammer_build' : nextItemId);

    // Sync node visibility against state.nodes and clock.totalHours
    for (const [id, rec] of this.nodeMeshes.entries()) {
      const available = isNodeAvailable(id, state.nodes, state.clock.totalHours);
      rec.group.visible = available;
      if (available) {
        const stump = this.chopStumps.get(id);
        if (stump) {
          this.scene.remove(stump);
          stump.geometry.dispose();
          (stump.material as THREE.Material).dispose();
          this.chopStumps.delete(id);
        }
      }
    }
    if (state.needs.health >= ACTION_TUNING.BANDAGE_HEAL_THRESHOLD_HP) {
      this.bandagedActive = false;
    }

    // Sync placed campfires, shelters, Stage 4 base structures, Stage 5 wildlife & station repairs
    this.syncCampfires(state.campfires ?? []);
    this.syncShelters(state.shelters ?? []);
    this.syncStructures(state.structures ?? []);
    this.rebuildDynamicColliders();
    this.wildlife3D.sync(state.wildlife ?? [], (wx, wz) => this.getTerrainHeight(wx, wz));
    if (this.landmarks && state.stationRepairs) {
      syncStationSystemsVisuals(this.landmarks.stationSystems, state.stationRepairs);
    }
    if (this.boatDock && state.boat) {
      syncBoatBuildMeshes(this.boatDock.vessel, state.boat);
    }

    const inVoyage = Boolean(state.voyage && state.voyage.phase !== 'docked');
    if (inVoyage && !this.wasInVoyage) {
      this.wasInVoyage = true;
      this.yaw = Math.PI;
      this.pitch = -0.04;
    } else if (!inVoyage && this.wasInVoyage) {
      this.wasInVoyage = false;
      this.snapPlayerToGround(state.player.x, state.player.z, state.player.yaw);
    }
    this.toolRig.visible = !inVoyage;
    this.offhandRig.visible = !inVoyage;
    if (inVoyage) {
      this.torchLight.intensity = 0;
    }

    // Sync barrier gates & clue beacons
    const unlocked = new Set(state.unlockedGates ?? []);
    for (const [id, rec] of this.gateMeshes.entries()) {
      rec.group.visible = !unlocked.has(id);
    }
    const foundClues = new Set(state.cluesFound ?? []);
    for (const [id, rec] of this.clueMeshes.entries()) {
      rec.beacon.visible = !foundClues.has(id);
    }

    // If player respawned or loaded a new game, snap position
    if (
      !prevState ||
      Math.hypot(prevState.player.x - state.player.x, prevState.player.z - state.player.z) > 12
    ) {
      this.snapPlayerToGround(state.player.x, state.player.z, state.player.yaw);
    }
  }

  public getPlayerRuntimeSnapshot(): {
    x: number;
    y: number;
    z: number;
    yaw: number;
    context: PlayerContext;
    stance: PlayerStance;
    sleepFadeAlpha: number;
    oxygen: number;
    holdInteractProgress: number;
    photoMode: boolean;
    photoFilter: number;
    waterLevel: number;
    distanceDelta: number;
    bumpedGate: BarrierGateDef | null;
    fps: number;
  } {
    const equipped = this.latestState
      ? getEquipped(this.latestState.inventory, this.latestState.selectedSlot)
      : { slot: null, def: null };
    const holdingLitTorch =
      equipped.def?.tool?.kind === 'torch' || equipped.def?.tool?.kind === 'lantern';

    let nearFire = false;
    for (const fire of this.campfires3D.values()) {
      const d = Math.hypot(this.playerPos.x - fire.data.x, this.playerPos.z - fire.data.z);
      if (d <= TEMPERATURE.CAMPFIRE_RADIUS_M) {
        nearFire = true;
        break;
      }
    }

    let sheltered = false;
    for (const shelter of this.shelters3D.values()) {
      const d = Math.hypot(this.playerPos.x - shelter.data.x, this.playerPos.z - shelter.data.z);
      if (d <= SAVE.SHELTER_RADIUS_M) {
        sheltered = true;
        break;
      }
    }

    const inVoyage = Boolean(this.latestState?.voyage && this.latestState.voyage.phase !== 'docked');
    const dx = this.playerPos.x - this.lastSamplePos.x;
    const dz = this.playerPos.z - this.lastSamplePos.z;
    const rawStep = inVoyage ? 0 : Math.hypot(dx, dz);
    const distanceDelta = rawStep < 12 ? Math.round(rawStep * 100) / 100 : 0;
    this.lastSamplePos.x = this.playerPos.x;
    this.lastSamplePos.z = this.playerPos.z;

    const bumpedGate = inVoyage ? null : this.bumpedGate;
    this.bumpedGate = null;

    return {
      x: Math.round(this.playerPos.x * 100) / 100,
      y: Math.round(this.playerFootY * 100) / 100,
      z: Math.round(this.playerPos.z * 100) / 100,
      yaw: Math.round(this.yaw * 100) / 100,
      context: {
        isMoving: inVoyage ? false : this.isMoving,
        isSprinting: inVoyage ? false : this.isSprinting,
        isSwimming: inVoyage ? false : this.isSwimming,
        nearFire: inVoyage ? false : nearFire,
        sheltered: inVoyage ? this.latestState?.voyage.phase === 'stopover' : sheltered,
        holdingLitTorch: inVoyage ? false : holdingLitTorch,
        stance: inVoyage ? 'stand' : this.stance,
      },
      stance: inVoyage ? 'stand' : this.stance,
      sleepFadeAlpha: this.sleepFadeAlpha,
      oxygen: Math.round(this.oxygen),
      holdInteractProgress: this.holdInteractProgress,
      photoMode: this.photoMode,
      photoFilter: this.photoFilter,
      waterLevel: this.currentWaterLevel,
      distanceDelta,
      bumpedGate,
      fps: this.fpsValue,
    };
  }

  public getPlayerYaw(): number {
    return this.yaw;
  }

  public setBuildPreviewType(type: StructureType | null) {
    if (this.buildPreviewGhost) {
      this.scene.remove(this.buildPreviewGhost);
      this.buildPreviewGhost = null;
    }
    this.buildPreviewType = type;
    this.lastGhostValid = null;
    this.fpIKRig?.setHeldItem(type ? 'hammer_build' : this.currentEquippedItemId);
    if (type) {
      this.buildPreviewYaw = this.yaw;
      const ghost =
        type === 'campfire'
          ? this.buildCampfireMesh(true).group
          : type === 'shelter'
            ? this.buildShelterMesh(true)
            : buildStructureMesh(type, true).group;
      ghost.visible = false;
      this.buildPreviewGhost = ghost;
      this.scene.add(ghost);
    }
  }

  public rotateBuildPreview(deltaRad: number = Math.PI / 4) {
    this.buildPreviewYaw += deltaRad;
  }

  public getBuildPlacementTarget(
    type: StructureType
  ): { x: number; y: number; z: number; yaw: number; valid: boolean } {
    _euler.set(0, this.yaw, 0);
    _forward.set(0, 0, -1).applyEuler(_euler);
    const dist = type === 'fish_trap' ? 3.5 : 3.1;
    const px = Math.round((this.playerPos.x + _forward.x * dist) * 100) / 100;
    const pz = Math.round((this.playerPos.z + _forward.z * dist) * 100) / 100;
    const py = Math.round(this.getTerrainHeight(px, pz) * 100) / 100;
    const valid = isValidPlacementHeight(type, py);
    return { x: px, y: py, z: pz, yaw: this.buildPreviewYaw, valid };
  }

  public getPlacementPointInFront(): { x: number; y: number; z: number } | null {
    _euler.set(0, this.yaw, 0);
    _forward.set(0, 0, -1).applyEuler(_euler);
    const px = this.playerPos.x + _forward.x * 3.0;
    const pz = this.playerPos.z + _forward.z * 3.0;
    const py = this.getTerrainHeight(px, pz);
    if (py < WORLD.WATER_LEVEL + 0.15) return null;
    return {
      x: Math.round(px * 100) / 100,
      y: Math.round(py * 100) / 100,
      z: Math.round(pz * 100) / 100,
    };
  }

  public snapPlayerToGround(x: number, z: number, yaw: number = this.yaw) {
    this.playerPos.x = x;
    this.playerPos.z = z;
    this.lastSamplePos.x = x;
    this.lastSamplePos.z = z;
    this.yaw = yaw;
    this.targetYaw = yaw;
    this.velX = 0;
    this.velZ = 0;
    this.playerFootY = Math.max(0.35, this.getTerrainHeight(x, z));
    this.verticalVel = 0;
    this.isGrounded = true;
    this.peakAirY = this.playerFootY;
    this.landingDip = 0;
    this.jumpDip = 0;
    this.playerPos.y = this.playerFootY + 1.7;
    this.camera.position.copy(this.playerPos);
  }

  // ---------------------------------------------------------------------------
  // SKY, RAIN, TERRAIN & CRASH SITE
  // ---------------------------------------------------------------------------

  private initCelestialSky() {
    const starCount = 360;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.12 + Math.random() * 0.88);
      const r = 390;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xdbeafe,
      size: 1.5,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    this.starsPoints = new THREE.Points(starGeom, this.starsMat);
    this.scene.add(this.starsPoints);

    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6.0, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xdbeafe, fog: false })
    );
    this.moonMesh.visible = false;
    this.scene.add(this.moonMesh);
  }

  private initRainSystem() {
    const dropCount = 450;
    const positions = new Float32Array(dropCount * 3);
    for (let i = 0; i < dropCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = Math.random() * 22;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: 0xbad7f2,
      map: createRainStreakTexture(32),
      size: 0.34,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainPoints = new THREE.Points(geom, this.rainMat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);
  }

  public getTerrainHeight(worldX: number, worldZ: number): number {
    const dist = Math.hypot(worldX, worldZ);
    if (dist > this.islandRadius + 24) return -3.2;

    const normX = (worldX / (this.islandRadius * 2) + 0.5) * (this.terrainResolution - 1);
    const normZ = (worldZ / (this.islandRadius * 2) + 0.5) * (this.terrainResolution - 1);

    const gx = Math.floor(normX);
    const gz = Math.floor(normZ);

    if (
      gx < 0 ||
      gx >= this.terrainResolution - 1 ||
      gz < 0 ||
      gz >= this.terrainResolution - 1
    ) {
      return sampleIslandHeight(worldX, worldZ, this.islandRadius);
    }

    const fx = normX - gx;
    const fz = normZ - gz;

    const h00 = this.terrainHeightMap[gz * this.terrainResolution + gx];
    const h10 = this.terrainHeightMap[gz * this.terrainResolution + (gx + 1)];
    const h01 = this.terrainHeightMap[(gz + 1) * this.terrainResolution + gx];
    const h11 = this.terrainHeightMap[(gz + 1) * this.terrainResolution + (gx + 1)];

    return (
      (1 - fx) * (1 - fz) * h00 +
      fx * (1 - fz) * h10 +
      (1 - fx) * fz * h01 +
      fx * fz * h11
    );
  }

  private initTerrain() {
    const res = this.terrainResolution;
    const size = this.islandRadius * 2;
    const geom = new THREE.PlaneGeometry(size, size, res - 1, res - 1);
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const h = sampleIslandHeight(x, z, this.islandRadius);
      posAttr.setY(i, h);
      this.terrainHeightMap[i] = h;
    }

    geom.computeVertexNormals();

    this.terrainDetailTex = createTerrainDetailTexture(128);
    this.terrainMatRecord = createTerrainSplatMaterial(this.pbrBank);
    this.terrainMesh = new THREE.Mesh(geom, this.terrainMatRecord.material);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  private initWater() {
    const waterSize = this.islandRadius * 5.2;
    const waterGeom = new THREE.PlaneGeometry(waterSize, waterSize, 180, 180);
    waterGeom.rotateX(-Math.PI / 2);

    const posAttr = waterGeom.attributes.position as THREE.BufferAttribute;
    const seaDepth = new Float32Array(posAttr.count);
    for (let i = 0; i < posAttr.count; i++) {
      const wx = posAttr.getX(i);
      const wz = posAttr.getZ(i);
      const h = this.getTerrainHeight(wx, wz);
      seaDepth[i] = Math.max(0, Math.min(24, WORLD.WATER_LEVEL - h));
    }
    waterGeom.setAttribute('aSeaDepth', new THREE.BufferAttribute(seaDepth, 1));

    this.oceanMaterials = createOceanWaterMaterials(this.islandRadius);
    const preset = GRAPHICS_PRESETS[this.quality];
    this.waterMesh = new THREE.Mesh(
      waterGeom,
      !this.isSoftwareGl && preset.waterShader
        ? this.oceanMaterials.shaderMaterial
        : this.oceanMaterials.fallbackMaterial
    );
    this.waterMesh.position.y = WORLD.WATER_LEVEL;
    this.scene.add(this.waterMesh);
  }

  private initCrashSiteAndSpring() {
    // 1. Smoking Plane Wing & Torn Fuselage on the Southern Beach (x=10.5, z=50)
    const crashGroup = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.55,
      metalness: 0.65,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.6,
      metalness: 0.3,
    });
    const charredMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      metalness: 0.2,
    });

    const fuselage = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.35, 6.8, 12, 1, true),
      hullMat
    );
    fuselage.rotation.z = Math.PI / 2.2;
    fuselage.rotation.y = 0.35;
    fuselage.position.set(0, 1.05, 0);
    crashGroup.add(fuselage);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, 3.12), stripeMat);
    stripe.rotation.z = 0.14;
    stripe.rotation.y = 0.35;
    stripe.position.set(0, 1.2, 0);
    crashGroup.add(stripe);

    const brokenWing = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.18, 2.2), hullMat);
    brokenWing.position.set(-1.5, 0.45, 2.6);
    brokenWing.rotation.set(0.18, -0.4, -0.12);
    crashGroup.add(brokenWing);

    const engineNacelle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.58, 1.9, 10),
      charredMat
    );
    engineNacelle.rotation.x = Math.PI / 2;
    engineNacelle.position.set(-2.2, 0.55, 3.5);
    crashGroup.add(engineNacelle);

    // Rising dark smoke puffs from the engine wreck
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.28,
    });
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24 + i * 0.08, 7, 7), smokeMat);
      puff.position.set(-2.2, 1.0 + i * 0.85, 3.5);
      puff.userData.phase = i * 1.1;
      crashGroup.add(puff);
      this.crashSmokePuffs.push(puff);
    }

    const crashX = WORLD.WRECK_POS.x;
    const crashZ = WORLD.WRECK_POS.z;
    const crashY = this.getTerrainHeight(crashX, crashZ);
    crashGroup.name = 'crash_site_group';
    crashGroup.position.set(crashX, crashY, crashZ);
    this.scene.add(crashGroup);
    this.crashSiteGroup = crashGroup;

    // 2. Freshwater Spring Pool (WORLD.SPRING_POS)
    const springY = this.getTerrainHeight(FRESHWATER_SPRING_POS.x, FRESHWATER_SPRING_POS.z);
    FRESHWATER_SPRING_POS.y = springY;

    const springGroup = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.9,
      flatShading: true,
    });
    const springWaterMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
    });

    const poolDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.2, 0.18, 14), springWaterMat);
    poolDisc.position.y = 0.08;
    springGroup.add(poolDisc);

    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), rockMat);
      stone.position.set(Math.cos(ang) * 2.35, 0.2, Math.sin(ang) * 2.35);
      stone.scale.set(1.2, 0.7, 1.0);
      springGroup.add(stone);
    }

    springGroup.name = 'spring_group';
    springGroup.position.set(FRESHWATER_SPRING_POS.x, springY, FRESHWATER_SPRING_POS.z);
    this.scene.add(springGroup);
    this.springGroup = springGroup;
    this.rebuildFootRayTargets();
  }

  private initAct1Barriers() {
    const vineMat = new THREE.MeshStandardMaterial({
      color: 0x2d4a22,
      roughness: 0.92,
      flatShading: true,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4b3621,
      roughness: 0.95,
      flatShading: true,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x4b4744,
      roughness: 0.94,
      flatShading: true,
    });
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.3,
      transparent: true,
      opacity: 0.85,
    });

    for (const gate of ISLAND_GATES) {
      const group = new THREE.Group();
      const baseY = this.getTerrainHeight(gate.x, gate.z);

      if (gate.id === 'gate_jungle_vines') {
        // Dense tangled banyan trunks & leafy vine wall spanning the central saddle
        for (let i = -4; i <= 4; i++) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 5.2, 6), woodMat);
          trunk.position.set(i * 1.15, 2.3, ((i * 17) % 3) * 0.28);
          trunk.rotation.z = ((i % 2 === 0 ? 1 : -1) * 0.14);
          group.add(trunk);

          const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 0), vineMat);
          bush.position.set(i * 1.15, 1.55 + (Math.abs(i) % 2) * 0.85, 0.2);
          bush.scale.set(1.15, 1.25, 1.25);
          group.add(bush);
        }
      } else if (gate.id === 'gate_west_cliffs') {
        // Sheer rockfall slabs & weathered piton post
        for (let i = -3; i <= 3; i++) {
          const slab = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 0), rockMat);
          slab.position.set(i * 1.25, 1.4 + Math.abs(i) * 0.25, 0);
          slab.scale.set(1.2, 2.2, 1.1);
          group.add(slab);
        }
      } else if (gate.id === 'gate_east_river') {
        // Churning rapids whitewater boulders
        for (let i = -4; i <= 4; i++) {
          const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), rockMat);
          boulder.position.set(i * 1.1, 0.45, (i % 2) * 0.65);
          group.add(boulder);

          const foam = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 1.4), foamMat);
          foam.position.set(i * 1.0, 0.65, 0.4);
          group.add(foam);
        }
      } else {
        // Research Station steel perimeter security gate + red keycard reader terminal
        const steelMat = new THREE.MeshStandardMaterial({
          color: 0x64748b,
          roughness: 0.42,
          metalness: 0.78,
        });
        const warnMat = new THREE.MeshStandardMaterial({
          color: 0xd97706,
          roughness: 0.55,
        });
        for (let i = -5; i <= 5; i += 2.5) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.3, 6), steelMat);
          post.position.set(i, 1.65, 0);
          group.add(post);
        }
        for (let r = 0.6; r <= 2.9; r += 0.75) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.09, 0.09), steelMat);
          rail.position.set(0, r, 0);
          group.add(rail);
        }
        const gateDoor = new THREE.Mesh(
          new THREE.BoxGeometry(4.4, 2.7, 0.12),
          new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.45,
            metalness: 0.75,
            transparent: true,
            opacity: 0.72,
          })
        );
        gateDoor.position.set(0, 1.45, 0);
        group.add(gateDoor);

        const readerBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 0.25), warnMat);
        readerBox.position.set(1.85, 1.35, 0.32);
        group.add(readerBox);

        const readerLed = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        readerLed.position.set(1.85, 1.5, 0.46);
        group.add(readerLed);
      }

      group.position.set(gate.x, Math.max(WORLD.WATER_LEVEL - 0.1, baseY), gate.z);
      this.scene.add(group);
      this.gateMeshes.set(gate.id, { def: gate, group });
    }
  }

  private initStoryClues() {
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.82,
    });

    for (const clue of STORY_CLUES) {
      const group = buildStoryCluePropMesh(clue);

      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), beaconMat);
      beacon.position.y = 1.85;
      group.add(beacon);

      const y = this.getTerrainHeight(clue.x, clue.z);
      group.position.set(clue.x, y, clue.z);
      this.scene.add(group);
      this.clueMeshes.set(clue.id, { def: clue, group, beacon });
    }
  }

  private initGatherNodes() {
    this.nodeDefs = generateIslandNodes(WORLD.SEED, this.islandRadius);

    for (const def of this.nodeDefs) {
      const group = this.buildGatherNodeMesh(def.type);
      const y = this.getTerrainHeight(def.x, def.z);
      def.y = y;
      group.position.set(def.x, Math.max(0.08, y), def.z);
      group.rotation.y = def.rotation;
      group.scale.setScalar(def.scale);
      if (def.type === 'palm_tree' || def.type === 'resin_tree') {
        group.userData.baseRotZ = group.rotation.z;
        group.userData.windPhase = def.x * 0.13 + def.z * 0.11;
        this.palmWindMeshes.push(group);
      }
      this.scene.add(group);
      this.nodeMeshes.set(def.id, { def, group, baseScale: def.scale });
    }
  }

  private buildGatherNodeMesh(type: GatherNodeDef['type']): THREE.Group {
    const extra = buildExtraGatherNodeMesh(type);
    if (extra) return extra;

    const group = new THREE.Group();

    switch (type) {
      case 'palm_tree': {
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.88 });
        trunkMat.userData.pbrKind = 'bark';
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x3b7a38,
          roughness: 0.62,
          side: THREE.DoubleSide,
        });
        leafMat.userData.pbrKind = 'none';
        const coconutMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.78 });

        // Arched tapered compound palm frond blade geometry with central V-fold ridge
        const buildFrondGeom = () => {
          const g = new THREE.PlaneGeometry(0.94, 3.25, 2, 7);
          g.translate(0, 1.62, 0);
          g.rotateX(Math.PI * 0.42);
          const pos = g.attributes.position as THREE.BufferAttribute;
          for (let vi = 0; vi < pos.count; vi++) {
            const x = pos.getX(vi);
            const y = pos.getY(vi);
            const z = pos.getZ(vi);
            const span = THREE.MathUtils.clamp(z / 3.15, 0, 1);
            const taper = span < 0.12 ? 0.35 + span * 5.2 : Math.sin(span * Math.PI) * 1.05 + 0.12;
            const archY = Math.sin(span * Math.PI * 0.85) * 0.48 - span * span * 0.92;
            const foldY = -Math.abs(x) * 0.24;
            pos.setXYZ(vi, x * taper, y + archY + foldY, z);
          }
          g.computeVertexNormals();
          return g;
        };

        const lod = new THREE.LOD();
        const hiGroup = new THREE.Group();
        for (let s = 0; s < 5; s++) {
          const seg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22 - s * 0.025, 0.30 - s * 0.025, 1.25, 9),
            trunkMat
          );
          seg.position.set(Math.sin(s * 0.32) * 0.26, s * 1.12 + 0.6, 0);
          seg.rotation.z = -s * 0.07;
          hiGroup.add(seg);
        }
        const frondGeom = buildFrondGeom();
        for (let f = 0; f < 9; f++) {
          const frond = new THREE.Mesh(frondGeom, leafMat);
          const tier = f % 2;
          frond.position.set(0.28, 5.45 + tier * 0.14, 0);
          frond.rotation.y = (f / 9) * Math.PI * 2 + tier * 0.18;
          frond.rotation.x = tier === 0 ? -0.18 : 0.12;
          frond.scale.setScalar(tier === 0 ? 1.04 : 0.86);
          hiGroup.add(frond);
        }
        for (let c = 0; c < 3; c++) {
          const a = (c / 3) * Math.PI * 2;
          const coco = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 7), coconutMat);
          coco.position.set(0.28 + Math.cos(a) * 0.22, 5.22, Math.sin(a) * 0.22);
          hiGroup.add(coco);
        }
        lod.addLevel(hiGroup, 0);

        const loGroup = new THREE.Group();
        const loTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, 5.5, 6), trunkMat);
        loTrunk.position.set(0.15, 2.75, 0);
        loTrunk.rotation.z = -0.14;
        loGroup.add(loTrunk);
        for (let f = 0; f < 6; f++) {
          const loFrond = new THREE.Mesh(frondGeom, leafMat);
          loFrond.position.set(0.26, 5.45, 0);
          loFrond.rotation.y = (f / 6) * Math.PI * 2;
          loFrond.scale.set(0.95, 0.9, 0.9);
          loGroup.add(loFrond);
        }
        lod.addLevel(loGroup, 86);

        group.add(lod);
        break;
      }

      case 'fibre_bush': {
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3c, roughness: 0.82 });
        for (let i = 0; i < 7; i++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.15, 5), leafMat);
          const a = (i / 7) * Math.PI * 2;
          blade.position.set(Math.cos(a) * 0.25, 0.5, Math.sin(a) * 0.25);
          blade.rotation.z = Math.cos(a) * 0.45;
          blade.rotation.x = Math.sin(a) * 0.45;
          group.add(blade);
        }
        break;
      }

      case 'berry_bush': {
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x2f6834, roughness: 0.85 });
        const berryMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
        const mound = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 1), bushMat);
        mound.position.y = 0.48;
        mound.scale.set(1.2, 0.85, 1.2);
        group.add(mound);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const berry = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), berryMat);
          berry.position.set(Math.cos(a) * 0.58, 0.55 + (i % 2) * 0.15, Math.sin(a) * 0.58);
          group.add(berry);
        }
        break;
      }

      case 'driftwood': {
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8c7355, roughness: 0.9 });
        const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.2, 6), woodMat);
        log1.rotation.z = Math.PI / 2;
        log1.position.y = 0.14;
        group.add(log1);
        const log2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.5, 6), woodMat);
        log2.rotation.set(0.3, 0.5, Math.PI / 2.2);
        log2.position.set(0.2, 0.18, 0.28);
        group.add(log2);
        break;
      }

      case 'loose_stone': {
        const stoneMat = new THREE.MeshStandardMaterial({
          color: 0x78716c,
          roughness: 0.9,
          flatShading: true,
        });
        for (let i = 0; i < 3; i++) {
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 - i * 0.04, 0), stoneMat);
          rock.position.set((i - 1) * 0.26, 0.14, (i % 2) * 0.18);
          group.add(rock);
        }
        break;
      }

      case 'flint_nodule': {
        const chertMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.45,
          metalness: 0.25,
          flatShading: true,
        });
        const base = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), chertMat);
        base.position.y = 0.22;
        base.scale.set(1.2, 0.75, 1.0);
        group.add(base);
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 5), chertMat);
        shard.position.set(0.22, 0.28, 0.12);
        shard.rotation.z = -0.35;
        group.add(shard);
        break;
      }

      case 'boulder': {
        const rockMat = new THREE.MeshStandardMaterial({
          color: 0x57534e,
          roughness: 0.92,
          flatShading: true,
        });
        const main = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), rockMat);
        main.scale.set(1.35, 0.9, 1.15);
        main.position.y = 0.58;
        group.add(main);
        const side = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 1), rockMat);
        side.position.set(0.85, 0.3, 0.45);
        group.add(side);
        break;
      }

      case 'coconut': {
        const huskMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.88 });
        const nut = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), huskMat);
        nut.scale.set(1.0, 0.85, 1.2);
        nut.position.y = 0.18;
        group.add(nut);
        break;
      }

      case 'shell_cluster': {
        const shellMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.55 });
        for (let i = 0; i < 4; i++) {
          const s = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.05, 0.07, 6), shellMat);
          s.position.set((i % 2) * 0.34 - 0.17, 0.04, Math.floor(i / 2) * 0.34 - 0.17);
          group.add(s);
        }
        break;
      }

      case 'crash_debris': {
        const metalMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.4,
          metalness: 0.78,
        });
        const warnMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.6 });
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.95), metalMat);
        panel.position.y = 0.22;
        panel.rotation.set(0.25, 0.2, -0.18);
        group.add(panel);
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6), warnMat);
        strut.position.set(0.15, 0.35, -0.1);
        strut.rotation.z = 0.8;
        group.add(strut);
        break;
      }

      case 'supply_crate': {
        const caseMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });
        const strapMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.4,
          metalness: 0.7,
        });
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.68), caseMat);
        box.position.y = 0.28;
        group.add(box);
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.58, 0.12), strapMat);
        strap.position.y = 0.28;
        group.add(strap);
        break;
      }
    }

    return group;
  }

  // ---------------------------------------------------------------------------
  // CAMPFIRES & PLACEMENT PREVIEW
  // ---------------------------------------------------------------------------

  private buildCampfireMesh(isGhost: boolean = false): {
    group: THREE.Group;
    flames: THREE.Mesh[];
    flipbookSprites: Array<{
      kind?: 'fire' | 'embers' | 'smoke';
      tex: THREE.Texture;
      fps: number;
      phase: number;
      mesh: THREE.Mesh;
    }>;
  } {
    const group = new THREE.Group();
    const flames: THREE.Mesh[] = [];
    const flipbookSprites: Array<{
      kind?: 'fire' | 'embers' | 'smoke';
      tex: THREE.Texture;
      fps: number;
      phase: number;
      mesh: THREE.Mesh;
    }> = [];

    if (!isGhost && this.loadedGLBs?.campfire.lit) {
      const baseCamp = this.loadedGLBs.campfire.lit.clone(true);
      group.add(baseCamp);

      const fb = this.loadedGLBs.flipbooks;
      const fireTex = fb.fire.clone();
      fireTex.needsUpdate = true;
      const fireMat = new THREE.MeshBasicMaterial({
        map: fireTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      for (let i = 0; i < 2; i++) {
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.88), fireMat);
        plane.position.set(0, 0.44, 0);
        plane.rotation.y = (i * Math.PI) / 2;
        group.add(plane);
        flames.push(plane);
        flipbookSprites.push({ kind: 'fire', tex: fireTex, fps: 24, phase: i * 17, mesh: plane });
      }

      const emberTex = fb.embers.clone();
      emberTex.needsUpdate = true;
      const emberMat = new THREE.MeshBasicMaterial({
        map: emberTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const emberPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.15), emberMat);
      emberPlane.position.set(0, 0.72, 0);
      group.add(emberPlane);
      flipbookSprites.push({ kind: 'embers', tex: emberTex, fps: 20, phase: 9, mesh: emberPlane });

      const smokeTex = fb.smoke.clone();
      smokeTex.needsUpdate = true;
      const smokeMat = new THREE.MeshBasicMaterial({
        map: smokeTex,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const smokePlane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.45), smokeMat);
      smokePlane.position.set(0, 1.32, 0);
      group.add(smokePlane);
      flipbookSprites.push({ kind: 'smoke', tex: smokeTex, fps: 16, phase: 23, mesh: smokePlane });

      return { group, flames, flipbookSprites };
    }

    const stoneMat = isGhost
      ? new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.5 })
      : new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9, flatShading: true });
    const woodMat = isGhost
      ? stoneMat
      : new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.85 });
    const flameMat = isGhost
      ? stoneMat
      : new THREE.MeshBasicMaterial({ color: 0xff7b00 });

    // Ring of 8 stones
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), stoneMat);
      stone.position.set(Math.cos(a) * 0.58, 0.12, Math.sin(a) * 0.58);
      group.add(stone);
    }

    // Teepee logs
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.75, 6), woodMat);
      stick.position.set(Math.cos(a) * 0.2, 0.24, Math.sin(a) * 0.2);
      stick.rotation.z = Math.cos(a) * 0.55;
      stick.rotation.x = Math.sin(a) * 0.55;
      group.add(stick);
    }

    if (!isGhost) {
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18 - i * 0.03, 0.55, 6), flameMat);
        cone.position.set((i - 1) * 0.08, 0.36 + i * 0.06, 0);
        group.add(cone);
        flames.push(cone);
      }
    }

    return { group, flames, flipbookSprites };
  }

  private initCampfireGhost() {
    const { group } = this.buildCampfireMesh(true);
    group.visible = false;
    this.campfireGhost = group;
    this.scene.add(group);
  }

  private syncCampfires(campfires: PlacedCampfire[]) {
    const incomingIds = new Set(campfires.map((c) => c.id));
    for (const [id, rec] of this.campfires3D.entries()) {
      if (!incomingIds.has(id)) {
        this.scene.remove(rec.group);
        this.campfires3D.delete(id);
      }
    }

    for (const c of campfires) {
      if (!this.campfires3D.has(c.id)) {
        const { group, flames, flipbookSprites } = this.buildCampfireMesh(false);
        const y = Math.max(0.2, this.getTerrainHeight(c.x, c.z));
        group.position.set(c.x, y, c.z);

        const light = new THREE.PointLight(0xff7b1c, 2.2, 16, 1.45);
        light.position.set(0, 0.85, 0);
        light.shadow.mapSize.set(256, 256);
        light.shadow.bias = -0.002;
        group.add(light);

        this.enableGroupShadows(group, true, true);
        this.scene.add(group);
        this.campfires3D.set(c.id, { data: c, group, flames, light, flipbookSprites });
      }
    }
  }

  private buildShelterMesh(isGhost: boolean = false): THREE.Group {
    if (!isGhost && this.loadedGLBs?.buildables.shelterLeanto) {
      const group = new THREE.Group();
      const leanto = this.loadedGLBs.buildables.shelterLeanto.clone(true);
      group.add(leanto);
      if (this.loadedGLBs.buildables.sleepingMat) {
        const mat = this.loadedGLBs.buildables.sleepingMat.clone(true);
        mat.position.set(0, 0.02, 0.05);
        group.add(mat);
      }
      return group;
    }
    const group = new THREE.Group();
    const poleMat = isGhost
      ? new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.48, wireframe: true })
      : new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const thatchMat = isGhost
      ? new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.36, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: 0x4b7031, roughness: 0.88, side: THREE.DoubleSide, flatShading: true });
    const matMat = isGhost
      ? new THREE.MeshBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.35 })
      : new THREE.MeshStandardMaterial({ color: 0xc2a36b, roughness: 0.85 });

    // Ridge pole & 4 corner A-frame struts
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), poleMat);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.set(0, 1.55, 0);
    group.add(ridge);

    for (const zOff of [-1.05, 1.05]) {
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 2.15, 6), poleMat);
        leg.position.set(side * 0.62, 0.8, zOff);
        leg.rotation.z = side * 0.62;
        group.add(leg);
      }
    }

    // Two pitched palm-frond roof panels
    for (const side of [-1, 1]) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.09, 2.45), thatchMat);
      roof.position.set(side * 0.62, 0.95, 0);
      roof.rotation.z = side * 0.62;
      group.add(roof);
    }

    // Woven bamboo sleeping mat inside
    const bedMat = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 1.9), matMat);
    bedMat.position.set(0, 0.08, 0.05);
    group.add(bedMat);

    return group;
  }

  private initShelterGhost() {
    const group = this.buildShelterMesh(true);
    group.visible = false;
    this.shelterGhost = group;
    this.scene.add(group);
  }

  private syncShelters(shelters: PlacedShelter[]) {
    const incomingIds = new Set(shelters.map((s) => s.id));
    for (const [id, rec] of this.shelters3D.entries()) {
      if (!incomingIds.has(id)) {
        this.scene.remove(rec.group);
        this.shelters3D.delete(id);
      }
    }

    for (const s of shelters) {
      if (!this.shelters3D.has(s.id)) {
        const group = this.buildShelterMesh(false);
        const y = Math.max(0.25, this.getTerrainHeight(s.x, s.z));
        group.position.set(s.x, y, s.z);
        group.rotation.y = s.yaw;
        this.enableGroupShadows(group, true, true);
        this.scene.add(group);
        this.shelters3D.set(s.id, { data: s, group });
      }
    }
  }

  private initFishSchools() {
    const fishMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.25,
      roughness: 0.25,
      metalness: 0.45,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });

    const spots = [
      { cx: -28, cz: 158, r: 3.4, speed: 0.85 },
      { cx: 6, cz: 162, r: 3.8, speed: -0.75 },
      { cx: 36, cz: 152, r: 3.2, speed: 0.9 },
      { cx: -66, cz: 134, r: 3.0, speed: 0.8 },
    ];

    spots.forEach((spot, idx) => {
      const group = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const fish = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.44, 5), fishMat);
        fish.rotation.x = Math.PI / 2;
        fish.position.set((i - 1) * 0.32, 0, Math.abs(i - 1) * 0.25);
        group.add(fish);
      }
      const ripple = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 12), ringMat);
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.y = 0.14;
      group.add(ripple);

      group.position.set(spot.cx, WORLD.WATER_LEVEL - 0.14, spot.cz);
      this.scene.add(group);
      this.fishSchools.push({
        group,
        centerX: spot.cx,
        centerZ: spot.cz,
        radius: spot.r,
        speed: spot.speed,
        phase: idx * 1.4,
      });
    });
  }

  private syncStructures(structures: PlacedStructure[]) {
    const incomingIds = new Set(structures.map((s) => s.id));
    for (const [id, rec] of this.structures3D.entries()) {
      if (!incomingIds.has(id)) {
        this.scene.remove(rec.group);
        this.structures3D.delete(id);
      }
    }

    for (const s of structures) {
      let rec = this.structures3D.get(s.id);
      if (!rec) {
        const built = buildStructureMesh(s.type, false);
        if (this.loadedGLBs) {
          const b = this.loadedGLBs.buildables;
          const glbTemplate =
            s.type === 'workbench'
              ? b.workbench
              : s.type === 'forge'
                ? b.forgeStone
                : s.type === 'storage_chest'
                  ? b.crateStorage
                  : s.type === 'water_collector'
                    ? b.waterCollector
                    : s.type === 'drying_rack'
                      ? b.dryingRack
                      : null;
          if (glbTemplate) {
            built.group.clear();
            built.group.add(glbTemplate.clone(true));
            if (built.forgeLight) built.group.add(built.forgeLight);
            if (built.forgeEmberMesh) built.group.add(built.forgeEmberMesh);
          }
        }
        const terrainY = this.getTerrainHeight(s.x, s.z);
        const y =
          s.type === 'fish_trap'
            ? Math.min(WORLD.WATER_LEVEL - 0.18, terrainY + 0.15)
            : Math.max(0.25, terrainY);
        built.group.position.set(s.x, y, s.z);
        built.group.rotation.y = s.yaw;
        this.enableGroupShadows(built.group, true, true);
        this.scene.add(built.group);
        rec = { data: s, ...built };
        this.structures3D.set(s.id, rec);
      }
      syncStructureVisualState(rec, s);
    }
  }

  // ---------------------------------------------------------------------------
  // FIRST-PERSON HAND & TOOL RIG
  // ---------------------------------------------------------------------------

  private buildSculptedFirstPersonArm(
    side: 'left' | 'right',
    pose: 'relaxed' | 'grip'
  ): THREE.Group {
    const arm = new THREE.Group();
    const s = side === 'left' ? -1 : 1;

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd9a078,
      roughness: 0.58,
      metalness: 0.02,
      emissive: 0x38150b,
      emissiveIntensity: 0.08,
    });
    skinMat.userData.pbrKind = 'none';

    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x2b3644,
      roughness: 0.88,
      metalness: 0.03,
    });
    sleeveMat.userData.pbrKind = 'none';

    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x3f2d21,
      roughness: 0.72,
      metalness: 0.06,
    });
    gloveMat.userData.pbrKind = 'none';

    // Rolled tactical jacket/shirt sleeve ending mid-forearm
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.24, 18), sleeveMat);
    sleeve.rotation.x = Math.PI / 2 - 0.22;
    sleeve.position.set(s * 0.015, -0.02, 0.25);
    arm.add(sleeve);

    const cuffFold = new THREE.Mesh(new THREE.TorusGeometry(0.061, 0.011, 10, 20), sleeveMat);
    cuffFold.rotation.x = -0.22;
    cuffFold.position.set(s * 0.01, 0.01, 0.14);
    arm.add(cuffFold);

    // Smooth tapered forearm from cuff to wrist
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.056, 0.25, 20), skinMat);
    forearm.rotation.x = Math.PI / 2 - 0.18;
    forearm.position.set(0, 0.035, 0.03);
    arm.add(forearm);

    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), skinMat);
    wrist.scale.set(1.02, 0.82, 1.0);
    wrist.position.set(0, 0.055, -0.075);
    arm.add(wrist);

    // Sculpted hand group anchored at wrist
    const handGroup = new THREE.Group();
    handGroup.position.set(0, 0.06, -0.105);
    if (pose === 'grip') {
      handGroup.rotation.set(0.18, s * -0.14, s * -0.32);
    } else {
      handGroup.rotation.set(0.06, s * -0.1, s * -0.14);
    }

    // Palm + fingerless survival leather glove wrap across knuckles
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 14), skinMat);
    palm.scale.set(0.92, 0.56, 1.08);
    palm.position.set(0, 0, -0.025);
    handGroup.add(palm);

    const gloveWrap = new THREE.Mesh(new THREE.SphereGeometry(0.049, 16, 14), gloveMat);
    gloveWrap.scale.set(0.95, 0.59, 0.82);
    gloveWrap.position.set(0, 0.002, -0.018);
    handGroup.add(gloveWrap);

    const curlAngle = pose === 'grip' ? 1.18 : 0.42;
    const fingerSpecs = [
      { x: -0.028 * s, len: 0.035, rad: 0.0095 },
      { x: -0.01 * s, len: 0.04, rad: 0.0098 },
      { x: 0.009 * s, len: 0.037, rad: 0.0092 },
      { x: 0.027 * s, len: 0.03, rad: 0.0082 },
    ];
    for (const fs of fingerSpecs) {
      const fPivot = new THREE.Group();
      fPivot.position.set(fs.x, 0.004, -0.068);
      fPivot.rotation.x = curlAngle;

      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(fs.rad, fs.len * 0.52, 6, 10), skinMat);
      seg1.rotation.x = Math.PI / 2;
      seg1.position.set(0, 0, -fs.len * 0.35);
      fPivot.add(seg1);

      const seg2 = new THREE.Mesh(
        new THREE.CapsuleGeometry(fs.rad * 0.86, fs.len * 0.46, 6, 10),
        skinMat
      );
      seg2.rotation.x = Math.PI / 2 + (pose === 'grip' ? 0.88 : 0.36);
      seg2.position.set(0, -fs.len * 0.22, -fs.len * 0.72);
      fPivot.add(seg2);

      handGroup.add(fPivot);
    }

    // Opposable thumb angled inward toward index knuckle
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-0.042 * s, 0.006, -0.018);
    thumbPivot.rotation.set(pose === 'grip' ? 0.55 : 0.25, 0.42 * s, -0.35 * s);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.036, 6, 10), skinMat);
    thumb.rotation.x = Math.PI / 2;
    thumb.position.set(0, 0, -0.024);
    thumbPivot.add(thumb);
    handGroup.add(thumbPivot);

    arm.add(handGroup);
    return arm;
  }

  private createOffhandArm(): THREE.Group {
    const group = this.buildSculptedFirstPersonArm('left', 'relaxed');
    group.position.set(0, 0.06, -0.04);
    return group;
  }

  private createHandTool(): THREE.Group {
    const group = this.buildSculptedFirstPersonArm('right', 'relaxed');
    group.position.set(0.01, 0.02, 0.02);
    return group;
  }

  private createToolGripArm(): THREE.Group {
    const group = this.buildSculptedFirstPersonArm('right', 'grip');
    group.position.set(0.03, -0.02, 0.14);
    group.rotation.set(0.24, -0.08, 0.12);
    return group;
  }

  private createMacheteTool(): THREE.Group {
    const group = new THREE.Group();
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.85 });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.28,
      metalness: 0.82,
    });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.18, 8), gripMat);
    grip.position.set(0, 0.11, 0);
    group.add(grip);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.04), guardMat);
    guard.position.set(0, 0.21, 0);
    group.add(guard);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.44, 0.014), steelMat);
    blade.position.set(-0.01, 0.44, 0);
    blade.rotation.z = 0.08;
    group.add(blade);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.11, 4), steelMat);
    tip.position.set(-0.035, 0.68, 0);
    tip.rotation.z = 0.18;
    group.add(tip);
    return group;
  }

  private createAxeTool(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c4f2e, roughness: 0.78 });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.45,
      metalness: 0.35,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.62, 8), woodMat);
    shaft.position.set(0, 0.2, 0);
    shaft.rotation.z = 0.12;
    group.add(shaft);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.045), stoneMat);
    blade.position.set(-0.06, 0.46, 0);
    blade.rotation.z = 0.15;
    group.add(blade);
    return group;
  }

  private createPickaxeTool(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.78 });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.4,
      metalness: 0.5,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.64, 8), woodMat);
    shaft.position.set(0, 0.22, 0);
    shaft.rotation.z = 0.14;
    group.add(shaft);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.055, 0.06), headMat);
    head.position.set(0.03, 0.5, 0);
    head.rotation.z = -0.22;
    group.add(head);
    return group;
  }

  private createSpearTool(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c4f2e, roughness: 0.75 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.95, 8), woodMat);
    shaft.position.set(0, 0.28, -0.1);
    shaft.rotation.x = -0.45;
    group.add(shaft);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 6), tipMat);
    tip.position.set(0, 0.68, -0.3);
    tip.rotation.x = -0.45;
    group.add(tip);
    return group;
  }

  private createTorchTool(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 });
    const wrapMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9429 });

    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.56, 8), woodMat);
    stick.position.set(0, 0.2, 0);
    group.add(stick);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.038, 0.14, 8), wrapMat);
    head.position.set(0, 0.48, 0);
    group.add(head);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 7), flameMat);
    flame.position.set(0, 0.64, 0);
    group.add(flame);
    this.torchFlameMesh = flame;
    return group;
  }

  private createLanternTool(): THREE.Group {
    const group = new THREE.Group();
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.4,
      metalness: 0.75,
    });
    const cageMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.7 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.08, 10), brassMat);
    base.position.set(0, 0.16, 0);
    group.add(base);

    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), glowMat);
    core.position.set(0, 0.28, 0);
    group.add(core);
    this.lanternGlowMesh = core;

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 5), cageMat);
      bar.position.set(Math.cos(a) * 0.072, 0.28, Math.sin(a) * 0.072);
      group.add(bar);
    }

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.08, 10), brassMat);
    cap.position.set(0, 0.4, 0);
    group.add(cap);

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 5, 10, Math.PI), cageMat);
    handle.position.set(0, 0.44, 0);
    group.add(handle);
    return group;
  }

  private setEquippedToolMesh(kind: ToolKind | null) {
    this.handMesh.visible = kind === null;
    this.rightToolArm.visible = kind !== null;
    this.axeMesh.visible = kind === 'axe';
    this.macheteMesh.visible = kind === 'machete';
    this.pickaxeMesh.visible = kind === 'pick';
    this.spearMesh.visible = kind === 'spear';
    this.torchMesh.visible = kind === 'torch';
    this.lanternMesh.visible = kind === 'lantern';

    if (kind === 'lantern') {
      this.torchLight.color.setHex(0xffd27a);
      this.torchLight.distance = 22;
      this.torchLight.intensity = 2.55;
    } else if (kind === 'torch') {
      this.torchLight.color.setHex(0xff8c2b);
      this.torchLight.distance = 16;
      this.torchLight.intensity = 1.85;
    } else {
      this.torchLight.intensity = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // PARTICLES & INTERACTION RAYCASTING
  // ---------------------------------------------------------------------------

  public spawnHarvestDebris(soundType: 'chop' | 'mine' | 'pickup', worldPos: THREE.Vector3) {
    if (soundType === 'pickup') {
      const dy = worldPos.y - (this.playerFootY + this.currentEyeHeight);
      const reach: 'ground' | 'waist' | 'bush' =
        dy > -0.45 ? 'bush' : dy > -1.05 ? 'waist' : 'ground';
      this.triggerPickupAnimation(worldPos, reach);
    }

    if (this.loadedGLBs?.flipbooks) {
      const fb = this.loadedGLBs.flipbooks;
      const baseTex =
        soundType === 'chop'
          ? fb.woodChips
          : soundType === 'mine'
            ? fb.dustPuff
            : fb.sandPuff;
      const tex = baseTex.clone();
      tex.needsUpdate = true;
      const pMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const pMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.65), pMat);
      pMesh.position.copy(worldPos).add(new THREE.Vector3(0, 0.25, 0));
      pMesh.lookAt(this.camera.position);
      this.scene.add(pMesh);
      this.particles.push({
        mesh: pMesh,
        velocity: new THREE.Vector3(0, 0.55, 0),
        lifetime: 0,
        maxLifetime: 0.52,
        gravity: 0,
        scaleCurve: 'smoke',
        flipbookTex: tex,
        flipbookFps: 28,
        billboard: true,
      });
    }

    const color =
      soundType === 'mine' ? 0x64748b : soundType === 'chop' ? 0x9c6631 : 0x4d7c0f;
    const geom = new THREE.DodecahedronGeometry(0.065, 0);
    const mat = new THREE.MeshLambertMaterial({ color });

    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(geom, mat);
      p.position.copy(worldPos);
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.8,
          1.2 + Math.random() * 2.2,
          (Math.random() - 0.5) * 2.8
        ),
        lifetime: 0,
        maxLifetime: 0.48 + Math.random() * 0.28,
      });
    }
  }

  private spawnStepDust(isWater: boolean) {
    if (this.loadedGLBs?.flipbooks) {
      const fb = this.loadedGLBs.flipbooks;
      const baseTex = isWater
        ? fb.waterSplash
        : this.playerFootY < 2.1
          ? fb.sandPuff
          : fb.dustPuff;
      const tex = baseTex.clone();
      tex.needsUpdate = true;
      const pMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const pMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), pMat);
      pMesh.position.set(
        this.playerPos.x + (Math.random() - 0.5) * 0.25,
        this.playerFootY + 0.16,
        this.playerPos.z + (Math.random() - 0.5) * 0.25
      );
      pMesh.lookAt(this.camera.position);
      this.scene.add(pMesh);
      this.particles.push({
        mesh: pMesh,
        velocity: new THREE.Vector3(0, 0.42, 0),
        lifetime: 0,
        maxLifetime: 0.42,
        gravity: 0,
        scaleCurve: 'smoke',
        flipbookTex: tex,
        flipbookFps: 30,
        billboard: true,
      });
      return;
    }

    const geom = new THREE.DodecahedronGeometry(isWater ? 0.055 : 0.048, 0);
    const mat = new THREE.MeshLambertMaterial({ color: isWater ? 0xbae6fd : 0xb8a382 });
    const count = isWater ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(geom, mat);
      p.position.set(
        this.playerPos.x + (Math.random() - 0.5) * 0.4,
        this.playerFootY + 0.08,
        this.playerPos.z + (Math.random() - 0.5) * 0.4
      );
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 1.4,
          0.9 + Math.random() * 1.1,
          (Math.random() - 0.5) * 1.4
        ),
        lifetime: 0,
        maxLifetime: 0.32 + Math.random() * 0.16,
      });
    }
  }

  private updateHoveredTarget() {
    if (!this.latestState || this.latestState.voyage?.phase !== 'docked') {
      if (this.campfireGhost) this.campfireGhost.visible = false;
      if (this.shelterGhost) this.shelterGhost.visible = false;
      if (this.buildPreviewGhost) this.buildPreviewGhost.visible = false;
      this.hoveredTarget = null;
      return;
    }

    const equipped = getEquipped(this.latestState.inventory, this.latestState.selectedSlot);

    // 0. If active Build Mode ghost is selected from [B] menu
    if (this.buildPreviewType) {
      if (this.campfireGhost) this.campfireGhost.visible = false;
      if (this.shelterGhost) this.shelterGhost.visible = false;
      const def = STRUCTURE_CATALOG[this.buildPreviewType];
      const placement = this.getBuildPlacementTarget(this.buildPreviewType);
      if (this.buildPreviewGhost) {
        this.buildPreviewGhost.visible = true;
        const previewY =
          this.buildPreviewType === 'fish_trap'
            ? Math.min(WORLD.WATER_LEVEL - 0.15, placement.y + 0.1)
            : Math.max(WORLD.WATER_LEVEL + 0.05, placement.y);
        this.buildPreviewGhost.position.set(placement.x, previewY, placement.z);
        this.buildPreviewGhost.rotation.y = placement.yaw;
        if (this.lastGhostValid !== placement.valid) {
          this.lastGhostValid = placement.valid;
          const tint = placement.valid ? 0x34d399 : 0xf87171;
          this.buildPreviewGhost.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const m of mats) {
                if ('color' in m && m.color instanceof THREE.Color) {
                  m.color.setHex(tint);
                }
                if ('emissive' in m && m.emissive instanceof THREE.Color) {
                  m.emissive.setHex(tint);
                }
              }
            }
          });
        }
      }
      this.hoveredTarget = placement.valid
        ? {
            kind: 'place_structure',
            label: def.name,
            prompt: `[E / Click] Place ${def.name} • [R] Rotate`,
            subtext: `[Esc] or Right-Click to cancel build mode`,
            canInteract: true,
            structureType: this.buildPreviewType,
          }
        : {
            kind: 'place_structure',
            label: `Invalid Spot for ${def.name}`,
            prompt:
              def.surface === 'shallow_water'
                ? 'Step to the beach and aim at shallow coastal water'
                : 'Move onto dry flat ground above the tide line',
            canInteract: false,
            structureType: this.buildPreviewType,
          };
      return;
    }

    // 1. If holding campfire_kit, show ghost preview and placement prompt
    if (equipped.def?.id === 'campfire_kit') {
      const pt = this.getPlacementPointInFront();
      if (this.campfireGhost) {
        if (pt) {
          this.campfireGhost.visible = true;
          this.campfireGhost.position.set(pt.x, pt.y, pt.z);
        } else {
          this.campfireGhost.visible = false;
        }
      }
      this.hoveredTarget = pt
        ? {
            kind: 'place_campfire',
            label: 'Stone Ring Campfire',
            prompt: '[E / Click] Place & Light Campfire',
            subtext: 'Provides warmth at night, boils water, and roasts food',
            canInteract: true,
          }
        : {
            kind: 'place_campfire',
            label: 'Cannot Place In Water',
            prompt: 'Move to dry ground to build a campfire',
            canInteract: false,
          };
      return;
    }

    if (this.campfireGhost) {
      this.campfireGhost.visible = false;
    }

    // 1b. If holding shelter_kit, show shelter ghost preview and placement prompt
    if (equipped.def?.id === 'shelter_kit') {
      const pt = this.getPlacementPointInFront();
      const validTerrain = pt !== null && this.getTerrainHeight(pt.x, pt.z) > WORLD.WATER_LEVEL + 0.3;
      if (this.shelterGhost) {
        if (pt && validTerrain) {
          this.shelterGhost.visible = true;
          this.shelterGhost.position.set(pt.x, pt.y, pt.z);
          this.shelterGhost.rotation.y = this.yaw;
        } else {
          this.shelterGhost.visible = false;
        }
      }
      this.hoveredTarget =
        pt && validTerrain
          ? {
              kind: 'place_shelter',
              label: 'Palm Lean-To Shelter',
              prompt: '[E / Click] Build Shelter (Sleep & Save Point)',
              subtext: 'Shields against storms/night chill and anchors respawn here',
              canInteract: true,
            }
          : {
              kind: 'place_shelter',
              label: 'Need Flat Dry Ground',
              prompt: 'Step farther onto dry beach or mossy ground to build shelter',
              canInteract: false,
            };
      return;
    }

    if (this.shelterGhost) {
      this.shelterGhost.visible = false;
    }

    this.camera.getWorldDirection(_camDir);

    // 1c. Check Live Wildlife Fauna (Hunt or defend with spear/machete/tools)
    const wildlifeReach =
      WORLD.INTERACT_RANGE + (equipped.def?.tool?.kind === 'spear' ? 1.25 : 0.45);
    const hitCreature = this.wildlife3D.findHoveredCreature(
      this.camera.position,
      _camDir,
      wildlifeReach
    );
    if (hitCreature) {
      const spec = WILDLIFE_SPECS[hitCreature.kind];
      const tKind = equipped.def?.tool?.kind;
      const dmg =
        tKind === 'spear' || tKind === 'machete'
          ? 3
          : tKind && tKind !== 'torch' && tKind !== 'lantern'
            ? 2
            : 1;
      this.hoveredTarget = {
        kind: 'wildlife',
        label: `${spec.name} (${hitCreature.hp}/${hitCreature.maxHp} HP)`,
        prompt: `[Click / E] Strike ${spec.name} (-${dmg} dmg)`,
        subtext: spec.aggressive
          ? 'Hostile fauna — Spear/Machete deal 3 dmg with longer reach'
          : 'Skittish crab — yields raw meat & shells',
        canInteract: true,
        creature: hitCreature,
      };
      return;
    }

    // 1c-2. Check Research Station Repair Consoles (Radio, Generator, Sea Chart)
    if (this.landmarks) {
      for (const [partId, rec] of this.landmarks.stationSystems.entries()) {
        const pPos = rec.group.position;
        const d = this.playerPos.distanceTo(pPos);
        if (d <= WORLD.INTERACT_RANGE + 1.35) {
          _toTarget
            .set(pPos.x, pPos.y + 0.85, pPos.z)
            .sub(this.camera.position)
            .normalize();
          if (_camDir.dot(_toTarget) > 0.56) {
            const def = STATION_REPAIR_DEFS[partId];
            const alreadyRepaired = Boolean(this.latestState.stationRepairs?.[partId]);
            const missingPrereqs = (def.requiresRepaired ?? []).filter(
              (reqId) => !this.latestState!.stationRepairs?.[reqId]
            );
            const hasAllParts = def.ingredients.every((ing) => {
              const total = this.latestState!.inventory.reduce(
                (acc, s) => (s && s.itemId === ing.itemId ? acc + s.count : acc),
                0
              );
              return total >= ing.count;
            });
            const reqText = def.ingredients
              .map((ing) => `${ing.count}x ${ing.itemId.replace(/_/g, ' ')}`)
              .join(', ');
            this.hoveredTarget = {
              kind: 'station_repair',
              label: def.name,
              prompt: alreadyRepaired
                ? 'System Online — Repaired'
                : missingPrereqs.length > 0
                  ? `Offline — Repair ${missingPrereqs.map((id) => STATION_REPAIR_DEFS[id].name.split(' ')[0]).join(' & ')} First`
                  : hasAllParts
                    ? `[E / Click] Repair ${def.name}`
                    : `Missing Parts: ${reqText}`,
              subtext: def.description,
              canInteract: !alreadyRepaired && missingPrereqs.length === 0 && hasAllParts,
              repairId: partId,
            };
            return;
          }
        }
      }
    }

    // 1c-3. Check Southern Boat Slipway & Dockyard (Act 4 Escape Vessel)
    if (this.boatDock) {
      const dockPos = this.boatDock.interactPos;
      const d = this.playerPos.distanceTo(dockPos);
      if (d <= WORLD.INTERACT_RANGE + 2.4) {
        _toTarget
          .set(dockPos.x, dockPos.y + 0.5, dockPos.z)
          .sub(this.camera.position)
          .normalize();
        if (_camDir.dot(_toTarget) > 0.45) {
          const stagesDone = countBoatStagesComplete(this.latestState.boat);
          const totalStages = BOAT_STAGE_ORDER.length;
          const chartReady = Boolean(this.latestState.stationRepairs?.chart);
          this.hoveredTarget = {
            kind: 'boat_dock',
            label: `Escape Boat Slipway (${stagesDone}/${totalStages} Stages)`,
            prompt: '[E / Click] Open Escape Boat Dockyard',
            subtext: !chartReady
              ? 'Repair Sea Chart inside the Research Station to unlock hull blueprints'
              : stagesDone >= totalStages
                ? 'Vessel complete — inspect sea rations & cast off toward Port Solis'
                : 'Construct boat stages & stock sea provisions',
            canInteract: true,
          };
          return;
        }
      }
    }

    // 1d. Check nearby interactive Story Clues
    for (const [id, rec] of this.clueMeshes.entries()) {
      const cluePos = rec.group.position;
      const d = this.playerPos.distanceTo(cluePos);
      if (d <= WORLD.INTERACT_RANGE + 0.8) {
        _toTarget.set(cluePos.x, cluePos.y + 0.4, cluePos.z).sub(this.camera.position).normalize();
        if (_camDir.dot(_toTarget) > 0.62) {
          const alreadyFound = this.latestState.cluesFound.includes(id);
          this.hoveredTarget = {
            kind: 'clue',
            label: rec.def.title,
            prompt: alreadyFound
              ? '[E / Click] Re-read Clue Note (Logged in Journal [J])'
              : '[E / Click] Inspect & Log Clue',
            subtext: rec.def.subtitle,
            canInteract: true,
            clueDef: rec.def,
          };
          return;
        }
      }
    }

    // 1d. Check nearby placed Shelters (sleep & save)
    for (const rec of this.shelters3D.values()) {
      const shelterPos = rec.group.position;
      const d = this.playerPos.distanceTo(shelterPos);
      if (d <= WORLD.INTERACT_RANGE + 1.1) {
        _toTarget
          .set(shelterPos.x, shelterPos.y + 0.85, shelterPos.z)
          .sub(this.camera.position)
          .normalize();
        if (_camDir.dot(_toTarget) > 0.6) {
          this.hoveredTarget = {
            kind: 'shelter',
            label: 'Palm Lean-To Shelter',
            prompt: '[E / Click] Sleep Until Dawn & Save Game',
            subtext: 'Restores health, warms body, skips night & sets bed respawn',
            canInteract: true,
            shelterId: rec.data.id,
          };
          return;
        }
      }
    }

    // 1e. Check nearby Stage 4 Base Structures (Workbench, Chest, Collectors, Farms, Traps, Racks, Forge)
    for (const rec of this.structures3D.values()) {
      const sPos = rec.group.position;
      const d = this.playerPos.distanceTo(sPos);
      if (d <= WORLD.INTERACT_RANGE + 1.0) {
        _toTarget
          .set(sPos.x, sPos.y + 0.65, sPos.z)
          .sub(this.camera.position)
          .normalize();
        if (_camDir.dot(_toTarget) > 0.62) {
          const info = getStructureInteractionPrompt(rec.data, this.latestState.inventory);
          this.hoveredTarget = {
            kind: 'structure',
            label: info.label,
            prompt: info.prompt,
            subtext: info.subtext,
            canInteract: info.canInteract,
            structureDef: rec.data,
          };
          return;
        }
      }
    }

    // 1f. Check swimming Lagoon Fish Schools (Spearfishing)
    for (const school of this.fishSchools) {
      const sPos = school.group.position;
      const d = Math.hypot(this.playerPos.x - sPos.x, this.playerPos.z - sPos.z);
      if (d <= WORLD.INTERACT_RANGE + 1.5) {
        _toTarget
          .set(sPos.x, sPos.y + 0.1, sPos.z)
          .sub(this.camera.position)
          .normalize();
        if (_camDir.dot(_toTarget) > 0.62) {
          const hasSpear = equipped.def?.tool?.kind === 'spear';
          this.hoveredTarget = {
            kind: 'fish_school',
            label: 'Lagoon Reef Fish',
            prompt: hasSpear
              ? '[E / Click] Thrust Spear (Catch Raw Fish)'
              : 'Equip Fire-Hardened Spear to Catch Fish',
            subtext: 'Cook caught fish at a campfire or cure on a drying rack',
            canInteract: hasSpear,
            fishPos: { x: sPos.x, y: sPos.y, z: sPos.z },
          };
          return;
        }
      }
    }

    // 2. Check proximity + look cone to Freshwater Spring
    const distSpring = this.playerPos.distanceTo(FRESHWATER_SPRING_POS);
    if (distSpring <= WORLD.INTERACT_RANGE + 1.2) {
      _toTarget.subVectors(FRESHWATER_SPRING_POS, this.camera.position).normalize();
      if (_camDir.dot(_toTarget) > 0.65) {
        const hasBottle = this.latestState.inventory.some((s) => s?.itemId === 'empty_bottle');
        this.hoveredTarget = {
          kind: 'spring',
          label: 'Freshwater Spring Pool',
          prompt: hasBottle
            ? '[E / Click] Fill Canteen Bottle (Unboiled)'
            : '[E / Click] Drink Spring Water (+22 Thirst)',
          subtext: hasBottle
            ? 'Boil filled bottles at a campfire to sterilize'
            : 'Drinking unboiled stream water carries a small parasite risk',
          canInteract: true,
        };
        return;
      }
    }

    // 3. Check proximity + look cone to placed Campfires
    for (const fire of this.campfires3D.values()) {
      const firePos = fire.group.position;
      const d = this.playerPos.distanceTo(firePos);
      if (d <= WORLD.INTERACT_RANGE + 0.8) {
        _toTarget.subVectors(firePos, this.camera.position).normalize();
        if (_camDir.dot(_toTarget) > 0.68) {
          this.hoveredTarget = {
            kind: 'campfire',
            label: 'Lit Stone Campfire',
            prompt: '[E / C] Boil Water & Roast Food',
            subtext: 'Warmth Aura Active (+18°C)',
            canInteract: true,
            campfireId: fire.data.id,
          };
          return;
        }
      }
    }

    // 4. Check gathering nodes in reach and look cone
    let bestNode: GatherNodeDef | null = null;
    let bestDist = WORLD.INTERACT_RANGE;

    for (const [id, rec] of this.nodeMeshes.entries()) {
      if (!rec.group.visible) continue;
      if (!isNodeAvailable(id, this.latestState.nodes, this.latestState.clock.totalHours)) continue;

      const nodePos = rec.group.position;
      const dist = this.playerPos.distanceTo(nodePos);
      if (dist <= bestDist) {
        _toTarget
          .set(nodePos.x, nodePos.y + 0.6, nodePos.z)
          .sub(this.camera.position)
          .normalize();
        if (_camDir.dot(_toTarget) > 0.74) {
          bestDist = dist;
          bestNode = rec.def;
        }
      }
    }

    if (bestNode) {
      const meta = GATHER_NODE_META[bestNode.type];
      const heldTool = equipped.def?.tool;
      const req = meta.requiredTool;
      const toolOk = !req || (Boolean(heldTool) && heldTool!.kind === req.kind && heldTool!.tier >= req.minTier);
      const st = this.latestState.nodes[bestNode.id];
      const hp = st && st.remaining > 0 ? st.remaining : meta.maxHealth;

      this.hoveredTarget = {
        kind: 'node',
        label: meta.label,
        prompt: toolOk
          ? `[E / Click] ${meta.promptVerb} (${hp}/${meta.maxHealth})`
          : `Requires ${req?.kind === 'axe' ? (req.minTier >= 2 ? 'Improved Hatchet or Machete' : 'Hatchet or Machete') : 'Pickaxe'} Equipped`,
        subtext: meta.yields.map((y) => `${y.count}x ${y.itemId.replace('_', ' ')}`).join(', '),
        canInteract: toolOk,
        nodeDef: bestNode,
      };
      return;
    }

    // 5. Check locked Act-1/Act-2/Act-3 barriers & gates
    for (const [id, rec] of this.gateMeshes.entries()) {
      if (!rec.group.visible) continue;
      if (this.latestState.unlockedGates.includes(id)) continue;
      const gatePos = rec.group.position;
      const d = Math.hypot(this.playerPos.x - gatePos.x, this.playerPos.z - gatePos.z);
      if (d <= WORLD.INTERACT_RANGE + 3.8) {
        _toTarget
          .set(gatePos.x, gatePos.y + 1.2, gatePos.z)
          .sub(this.camera.position)
          .normalize();
        if (_camDir.dot(_toTarget) > 0.6) {
          const canOpen = canUnlockGate(rec.def, this.latestState.inventory);
          this.hoveredTarget = {
            kind: 'gate',
            label: rec.def.name,
            prompt: canOpen
              ? `[E / Click] Unlock & Clear Passage (${rec.def.requiredToolLabel})`
              : `Locked — Requires ${rec.def.requiredToolLabel}`,
            subtext: rec.def.description,
            canInteract: true,
            gateDef: rec.def,
          };
          return;
        }
      }
    }

    this.hoveredTarget = null;
  }

  // ---------------------------------------------------------------------------
  // PLAYER MOVEMENT, LIGHTING & ANIMATION LOOP
  // ---------------------------------------------------------------------------

  private updatePlayerPhysics(delta: number) {
    // Update continuous diurnal tidal height
    const totalHours =
      ((this.latestState?.clock.day ?? 1) - 1) * 24 + (this.latestState?.clock.hour ?? 9);
    this.currentWaterLevel = getEffectiveWaterLevel(totalHours);

    // Smooth mouse-look interpolation for weight without input lag
    this.yaw = THREE.MathUtils.damp(
      this.yaw,
      this.targetYaw,
      MOVEMENT_TUNING.MOUSE_LOOK_SMOOTHING,
      delta
    );
    this.pitch = THREE.MathUtils.damp(
      this.pitch,
      this.targetPitch,
      MOVEMENT_TUNING.MOUSE_LOOK_SMOOTHING,
      delta
    );
    this.handLagX = THREE.MathUtils.damp(
      this.handLagX,
      0,
      ANIMATION_TUNING.HAND_SWAY_DAMPING,
      delta
    );
    this.handLagY = THREE.MathUtils.damp(
      this.handLagY,
      0,
      ANIMATION_TUNING.HAND_SWAY_DAMPING,
      delta
    );

    if (this.photoMode) {
      _forward.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      _moveDir.set(0, 0, 0);
      if (this.isActionKey('forward')) _moveDir.add(_forward);
      if (this.isActionKey('back')) _moveDir.sub(_forward);
      if (this.isActionKey('right')) _moveDir.add(_right);
      if (this.isActionKey('left')) _moveDir.sub(_right);
      if (this.keys['KeyE'] || this.keys['Space']) _moveDir.y += 1;
      if (this.keys['KeyQ'] || this.keys['KeyC']) _moveDir.y -= 1;
      if (_moveDir.lengthSq() > 0) {
        _moveDir.normalize().multiplyScalar(PART5_IMMERSION_TUNING.PHOTO_FLY_SPEED_MPS * delta);
        this.camera.position.add(_moveDir);
      }
      // Tether Photo Mode free-fly camera within radius around the survivor & keep above terrain
      const dx = this.camera.position.x - this.playerPos.x;
      const dy = this.camera.position.y - this.playerPos.y;
      const dz = this.camera.position.z - this.playerPos.z;
      const dist = Math.hypot(dx, dy, dz);
      const maxR = PART5_IMMERSION_TUNING.PHOTO_FLY_MAX_DIST_M;
      if (dist > maxR) {
        const s = maxR / dist;
        this.camera.position.set(
          this.playerPos.x + dx * s,
          this.playerPos.y + dy * s,
          this.playerPos.z + dz * s
        );
      }
      const floorH = this.getTerrainHeight(this.camera.position.x, this.camera.position.z);
      if (this.camera.position.y < floorH + 0.25) {
        this.camera.position.y = floorH + 0.25;
      }
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.z = 0;
      const photoFov = this.extSettings.fovDeg || MOVEMENT_TUNING.BASE_FOV_DEG;
      if (Math.abs(this.camera.fov - photoFov) > 0.05) {
        this.camera.fov = photoFov;
        this.camera.updateProjectionMatrix();
      }
      this.velX = 0;
      this.velZ = 0;
      this.isMoving = false;
      this.isSprinting = false;
      return;
    }

    if (this.latestState?.voyage && this.latestState.voyage.phase !== 'docked') {
      const deckLift = this.voyageDiorama ? this.voyageDiorama.boatPivot.position.y * 0.55 : 0;
      const deckRoll = this.voyageDiorama ? this.voyageDiorama.boatPivot.rotation.z * 0.55 : 0;
      this.camera.position.set(
        VOYAGE_STAGE_ORIGIN.x,
        VOYAGE_STAGE_ORIGIN.y + 2.25 + deckLift,
        VOYAGE_STAGE_ORIGIN.z - 2.15
      );
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.z = deckRoll;
      this.isMoving = false;
      this.isSprinting = false;
      this.isSwimming = false;
      this.isWading = false;
      this.velX = 0;
      this.velZ = 0;
      return;
    }

    const needs = this.latestState?.needs;
    const tempStage = getBodyTempStage(needs?.temperature ?? 37.0);
    const exhausted = (needs?.stamina ?? 100) < NEEDS.EXHAUSTED_THRESHOLD;

    // Sleep cinematic state machine (smooth lie-down -> black fade -> wake-up sit/stand)
    if (this.sleepPhase !== 'none') {
      this.sleepPhaseTimer += delta;
      this.velX = 0;
      this.velZ = 0;
      this.isMoving = false;
      this.isSprinting = false;
      if (this.sleepPhase === 'lying_down') {
        const t = Math.min(1, this.sleepPhaseTimer / STANCE_TUNING.SLEEP_LIEDOWN_SEC);
        this.sleepFadeAlpha = t * t;
        this.pitch = THREE.MathUtils.damp(this.pitch, -0.35, 6, delta);
        if (t >= 1) {
          this.sleepPhase = 'black_hold';
          this.sleepPhaseTimer = 0;
          if (!this.sleepBlackoutFired) {
            this.sleepBlackoutFired = true;
            this.onSleepBlackoutCb?.();
          }
        }
      } else if (this.sleepPhase === 'black_hold') {
        this.sleepFadeAlpha = 1;
        if (this.sleepPhaseTimer >= STANCE_TUNING.SLEEP_BLACK_HOLD_SEC) {
          this.sleepPhase = 'waking_up';
          this.sleepPhaseTimer = 0;
          const standRes = canEnterStance(
            'stand',
            this.playerPos.x,
            this.playerPos.z,
            this.latestState?.shelters ?? [],
            this.getOverheadClearanceRayM()
          );
          this.stance = standRes.allowed ? 'sit' : 'crouch';
          this.isCrouching = this.stance === 'crouch';
        }
      } else if (this.sleepPhase === 'waking_up') {
        const t = Math.min(1, this.sleepPhaseTimer / STANCE_TUNING.SLEEP_WAKEUP_SEC);
        this.sleepFadeAlpha = 1 - t;
        if (t > 0.65 && this.stance === 'sit') {
          this.trySetStance('stand', true);
        }
        if (t >= 1) {
          this.sleepPhase = 'none';
          this.sleepFadeAlpha = 0;
          this.onSleepBlackoutCb = null;
        }
      }
    }

    const terrainY = this.getTerrainHeight(this.playerPos.x, this.playerPos.z);
    const prevSwimming = this.isSwimming;
    this.isSwimming = terrainY < this.currentWaterLevel - 0.38;
    this.isWading = !this.isSwimming && terrainY < this.currentWaterLevel + 0.14;
    if (this.isSwimming && !prevSwimming) {
      this.part5Callbacks.onSplash?.(0.95);
      this.worldLifeFx?.scatterBirds(this.playerPos);
    }
    this.wasSwimming = this.isSwimming;

    if (this.isSwimming && this.stance !== 'stand' && this.sleepPhase === 'none') {
      this.stance = 'stand';
      this.isCrouching = false;
    }

    // Hold Crouch threshold transitions smoothly into Prone
    if (
      this.sleepPhase === 'none' &&
      !this.isSwimming &&
      this.isActionKey('crouch') &&
      !this.crouchHoldProneTriggered
    ) {
      this.crouchHoldSec += delta;
      if (this.crouchHoldSec >= STANCE_TUNING.HOLD_C_FOR_PRONE_SEC) {
        this.crouchHoldProneTriggered = true;
        this.trySetStance(this.stance === 'prone' ? 'crouch' : 'prone');
      }
    }

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    _moveDir.set(0, 0, 0);
    if (this.sleepPhase === 'none') {
      if (this.isActionKey('forward')) _moveDir.add(_forward);
      if (this.isActionKey('back')) _moveDir.sub(_forward);
      if (this.isActionKey('right')) _moveDir.add(_right);
      if (this.isActionKey('left')) _moveDir.sub(_right);
    }

    const hasInput = _moveDir.lengthSq() > 0;
    if (hasInput) {
      _moveDir.normalize();
      if (this.stance === 'sit') {
        this.trySetStance('stand', true);
      }
    }

    this.isCrouching = this.stance === 'crouch';
    const wantsSprint = Boolean(
      this.isActionKey('sprint') &&
        this.stance === 'stand' &&
        this.sleepPhase === 'none'
    );
    this.isSprinting = wantsSprint && !exhausted && (needs?.stamina ?? 0) > 2;

    let moveSpeed =
      this.stance === 'sit' || this.stance === 'sleep'
        ? 0
        : this.stance === 'prone'
          ? STANCE_TUNING.SPEED_PRONE_MPS
          : this.stance === 'crouch'
            ? STANCE_TUNING.SPEED_CROUCH_MPS
            : this.isSprinting
              ? STANCE_TUNING.SPEED_STAND_SPRINT_MPS
              : STANCE_TUNING.SPEED_STAND_WALK_MPS;
    if (exhausted) moveSpeed *= MOVEMENT_TUNING.EXHAUSTED_SPEED_MULT;
    if (this.isSwimming) moveSpeed *= MOVEMENT_TUNING.SWIM_SPEED_MULT;
    else if (this.isWading) moveSpeed *= MOVEMENT_TUNING.WADE_SPEED_MULT;
    moveSpeed *= tempStage.speedMult;
    moveSpeed *= this.lastEuphoriaOut?.speedMultiplier ?? 1;

    const targetVx = hasInput ? _moveDir.x * moveSpeed : 0;
    const targetVz = hasInput ? _moveDir.z * moveSpeed : 0;
    const dampRate = !this.isGrounded
      ? MOVEMENT_TUNING.AIR_CONTROL_DAMPING
      : hasInput
        ? MOVEMENT_TUNING.ACCEL_DAMPING
        : MOVEMENT_TUNING.DECEL_DAMPING;
    this.velX = THREE.MathUtils.damp(this.velX, targetVx, dampRate, delta);
    this.velZ = THREE.MathUtils.damp(this.velZ, targetVz, dampRate, delta);

    const curSpeed = Math.hypot(this.velX, this.velZ);
    this.isMoving = curSpeed > 0.18;

    if (curSpeed > 0.01) {
      const stepDist = curSpeed * delta;
      const desiredX = this.playerPos.x + this.velX * delta;
      const desiredZ = this.playerPos.z + this.velZ * delta;
      const resolved = resolveWorldMovement(
        this.playerPos.x,
        this.playerPos.z,
        desiredX,
        desiredZ,
        this.latestState?.unlockedGates ?? [],
        this.currentWaterLevel,
        this.dynamicCollidersCache
      );
      this.playerPos.x = resolved.x;
      this.playerPos.z = resolved.z;
      if (resolved.blockedByGate) {
        this.bumpedGate = resolved.blockedByGate;
      }

      const bobFreq = this.isCrouching
        ? ANIMATION_TUNING.CROUCH_BOB_FREQ
        : this.isSprinting
          ? ANIMATION_TUNING.SPRINT_BOB_FREQ
          : this.isSwimming
            ? 6.2
            : ANIMATION_TUNING.WALK_BOB_FREQ;
      this.walkTimer += delta * bobFreq * Math.min(1.15, curSpeed / MOVEMENT_TUNING.WALK_SPEED_MPS);
      if (this.isGrounded && hasInput) {
        this.stepDistanceAccumulator += stepDist;
        const stepThreshold = this.isSprinting ? 2.45 : this.isCrouching ? 1.8 : 2.15;
        if (this.stepDistanceAccumulator > stepThreshold) {
          this.stepDistanceAccumulator = 0;
          this.spawnStepDust(this.isSwimming || this.isWading);
          const surface = classifyStepSurface(
            this.playerPos.x,
            this.playerPos.z,
            terrainY,
            this.isSwimming || this.isWading,
            false
          );
          this.onStepSound?.(surface);
        }
      }
    }

    // Hold [Interact] continuous smooth pickup & circular ring progress
    if (this.isActionKey('interact') && !this.isUiBlocked) {
      this.holdERepeatTimer += delta;
      const canAct = Boolean(this.hoveredTarget && this.hoveredTarget.canInteract);
      this.holdInteractProgress = canAct
        ? Math.min(1, this.holdERepeatTimer / ANIMATION_TUNING.HOLD_E_REPEAT_INTERVAL_SEC)
        : 0;
      if (this.holdERepeatTimer >= ANIMATION_TUNING.HOLD_E_REPEAT_INTERVAL_SEC) {
        this.holdERepeatTimer = 0;
        if (
          this.hoveredTarget &&
          (this.hoveredTarget.kind === 'node' || this.hoveredTarget.kind === 'spring') &&
          this.hoveredTarget.canInteract
        ) {
          this.onPrimaryAction?.(this.hoveredTarget);
        }
      }
    } else {
      this.holdERepeatTimer = 0;
      this.holdInteractProgress = 0;
    }

    // Clamp to outer reef boundary
    const radialDist = Math.hypot(this.playerPos.x, this.playerPos.z);
    if (radialDist > this.islandRadius * 0.9) {
      const ang = Math.atan2(this.playerPos.z, this.playerPos.x);
      this.playerPos.x = Math.cos(ang) * (this.islandRadius * 0.9);
      this.playerPos.z = Math.sin(ang) * (this.islandRadius * 0.9);
    }

    // Smooth locomotion blend weights & athletic strafe roll + dynamic FOV kick (+5 deg when sprinting)
    this.moveBlend = THREE.MathUtils.damp(
      this.moveBlend,
      this.isMoving
        ? this.isSprinting
          ? 1.0
          : this.stance === 'prone'
            ? 0.25
            : this.isCrouching
              ? 0.38
              : 0.65
        : 0,
      10,
      delta
    );
    this.swimBlend = THREE.MathUtils.damp(this.swimBlend, this.isSwimming ? 1 : 0, 8, delta);

    const strafeInput =
      (this.isActionKey('right') ? 1 : 0) -
      (this.isActionKey('left') ? 1 : 0);
    this.strafeLean = THREE.MathUtils.damp(
      this.strafeLean,
      -strafeInput * (this.isSprinting ? 0.024 : 0.012),
      10,
      delta
    );

    const baseFov = this.extSettings.fovDeg || MOVEMENT_TUNING.BASE_FOV_DEG;
    const targetFov = this.isSwimming
      ? baseFov - 1.5
      : baseFov +
        (this.isMoving && this.isSprinting
          ? MOVEMENT_TUNING.SPRINT_FOV_BOOST_DEG
          : this.isMoving
            ? 1.0
            : 0);
    this.cameraFovCurrent = THREE.MathUtils.damp(
      this.cameraFovCurrent,
      targetFov,
      MOVEMENT_TUNING.FOV_LERP_SPEED,
      delta
    );
    if (Math.abs(this.cameraFovCurrent - this.camera.fov) > 0.05) {
      this.camera.fov = this.cameraFovCurrent;
      this.camera.updateProjectionMatrix();
    }

    // Smooth 5-stance eye height & posture weight transitions (0.3-0.6 s)
    const targetEyeH =
      this.stance === 'sleep'
        ? STANCE_TUNING.EYE_HEIGHT_SLEEP_M
        : this.stance === 'prone'
          ? STANCE_TUNING.EYE_HEIGHT_PRONE_M
          : this.stance === 'sit'
            ? STANCE_TUNING.EYE_HEIGHT_SIT_M
            : this.stance === 'crouch'
              ? STANCE_TUNING.EYE_HEIGHT_CROUCH_M
              : STANCE_TUNING.EYE_HEIGHT_STAND_M;
    this.currentEyeHeight = THREE.MathUtils.damp(
      this.currentEyeHeight,
      targetEyeH,
      STANCE_TUNING.EYE_LERP_SPEED,
      delta
    );
    this.crouchBlend = THREE.MathUtils.damp(
      this.crouchBlend,
      this.stance === 'crouch' ? 1 : 0,
      STANCE_TUNING.STANCE_BLEND_SPEED,
      delta
    );
    this.proneBlend = THREE.MathUtils.damp(
      this.proneBlend,
      this.stance === 'prone' ? 1 : 0,
      STANCE_TUNING.STANCE_BLEND_SPEED,
      delta
    );
    this.sitBlend = THREE.MathUtils.damp(
      this.sitBlend,
      this.stance === 'sit' ? 1 : 0,
      STANCE_TUNING.STANCE_BLEND_SPEED,
      delta
    );
    this.sleepBlend = THREE.MathUtils.damp(
      this.sleepBlend,
      this.stance === 'sleep' ? 1 : 0,
      STANCE_TUNING.STANCE_BLEND_SPEED,
      delta
    );

    // Vertical physics: jump anticipation dip, jump arc, gravity & landing dip + dust puff
    const updatedGroundY = this.getTerrainHeight(this.playerPos.x, this.playerPos.z);
    const targetFootY = Math.max(this.currentWaterLevel - 0.55, updatedGroundY);

    if (!this.isGrounded) {
      this.verticalVel -= MOVEMENT_TUNING.GRAVITY_MPS2 * delta;
      this.playerFootY += this.verticalVel * delta;
      this.peakAirY = Math.max(this.peakAirY, this.playerFootY);
      if (this.playerFootY <= targetFootY) {
        const drop = this.peakAirY - targetFootY;
        this.playerFootY = targetFootY;
        this.verticalVel = 0;
        this.isGrounded = true;
        this.landingDip = Math.min(
          ANIMATION_TUNING.LAND_DIP_MAX_M,
          Math.max(0.035, drop * 0.055)
        );
        this.fpClipController?.triggerOneShot('Land', 0.25);
        this.spawnStepDust(this.isSwimming || this.isWading);
        const landSurf = classifyStepSurface(
          this.playerPos.x,
          this.playerPos.z,
          updatedGroundY,
          this.isSwimming || this.isWading,
          false
        );
        this.onStepSound?.(landSurf);
        const hurtByFall = drop > NEEDS.FALL_SAFE_HEIGHT_M && !this.isSwimming;
        this.euphoria.triggerLanding(drop, hurtByFall);
        if (hurtByFall) {
          this.onFallImpact?.(drop);
        }
      }
    } else if (this.playerFootY - targetFootY > 0.65 && !this.isSwimming) {
      this.isGrounded = false;
      this.verticalVel = -0.6;
      this.peakAirY = this.playerFootY;
    } else {
      this.playerFootY = THREE.MathUtils.damp(this.playerFootY, targetFootY, 14, delta);
    }

    this.jumpDip = THREE.MathUtils.damp(this.jumpDip, 0, 14, delta);
    this.landingDip = THREE.MathUtils.damp(
      this.landingDip,
      0,
      ANIMATION_TUNING.LAND_DIP_RECOVERY_SPEED,
      delta
    );

    const airBobScale = this.isGrounded ? 1 : 0.1;
    const bobAmpY =
      this.stance === 'prone'
        ? ANIMATION_TUNING.CROUCH_BOB_AMP_Y * 0.45
        : this.isCrouching
          ? ANIMATION_TUNING.CROUCH_BOB_AMP_Y
          : this.isSprinting
            ? ANIMATION_TUNING.SPRINT_BOB_AMP_Y
            : ANIMATION_TUNING.WALK_BOB_AMP_Y;
    const bobAmpX = this.isSprinting
      ? ANIMATION_TUNING.SPRINT_BOB_AMP_X
      : ANIMATION_TUNING.WALK_BOB_AMP_X;
    const bobEnable = this.extSettings.headBob ? 1 : 0;
    const headBobY =
      Math.sin(this.walkTimer) * bobAmpY * this.moveBlend * airBobScale * bobEnable -
      this.landingDip -
      this.jumpDip;
    const headBobSide =
      Math.cos(this.walkTimer * 0.5) * bobAmpX * this.moveBlend * airBobScale * bobEnable;

    // Exhaustion or cold shiver camera sway (Stage 3 Cold / Stage 4 Hypothermic / Stage 5 Severe)
    const swayAmp = (exhausted ? 0.015 : 0) + (tempStage.shivering ? 0.008 : 0);
    const swayRoll =
      swayAmp > 0
        ? Math.sin(performance.now() * (tempStage.shivering ? 0.022 : 0.004)) * swayAmp
        : 0;

    // Damage jolt
    let joltPitch = 0;
    if (this.damageJoltTimer > 0) {
      this.damageJoltTimer = Math.max(0, this.damageJoltTimer - delta);
      joltPitch = Math.sin(this.damageJoltTimer * 24) * 0.06 * (this.damageJoltTimer / 0.38);
    }

    const curHorizSpeed = Math.hypot(this.velX, this.velZ);
    const euphoriaOut = this.euphoria.update(
      delta,
      this.isGrounded,
      this.verticalVel,
      curHorizSpeed,
      needs?.health ?? 100
    );
    this.lastEuphoriaOut = euphoriaOut;

    this.playerPos.y = this.playerFootY + this.currentEyeHeight + euphoriaOut.cameraDipOffset;
    const camCleared = clampCameraClearance(
      this.playerPos.x + _right.x * headBobSide,
      this.playerPos.y + headBobY,
      this.playerPos.z + _right.z * headBobSide,
      this.dynamicCollidersCache
    );
    this.camera.position.set(camCleared.x, camCleared.y, camCleared.z);

    // Underwater submersion & oxygen breath meter
    const isSubmerged = camCleared.y < this.currentWaterLevel + 0.04;
    if (isSubmerged) {
      this.oxygen = Math.max(0, this.oxygen - PART5_IMMERSION_TUNING.OXYGEN_DRAIN_PER_SEC * delta);
      if (this.oxygen <= 0) {
        this.drownDamageAccum += delta;
        if (this.drownDamageAccum >= 1.0) {
          this.drownDamageAccum -= 1.0;
          this.part5Callbacks.onDrowningDamage?.(PART5_IMMERSION_TUNING.DROWNING_DAMAGE_PER_SEC);
        }
      }
      this.rainDropletLevel = 1.0;
    } else {
      if (this.wasUnderwater) {
        this.part5Callbacks.onSplash?.(0.6);
      }
      this.oxygen = Math.min(100, this.oxygen + PART5_IMMERSION_TUNING.OXYGEN_RECOVER_PER_SEC * delta);
      this.drownDamageAccum = 0;
    }
    this.wasUnderwater = isSubmerged;

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + joltPitch + euphoriaOut.cameraPitchOffset;
    this.camera.rotation.z = swayRoll + this.strafeLean + euphoriaOut.cameraRollOffset;
  }

  /** Fast wall / solid obstacle proximity check (m) along camera forward ray for MW weapon pullback. */
  private getForwardObstacleDistance(): number {
    const maxDist = IK_SWAY_TUNING.WALL_AVOID_RAY_DIST;
    const fx = -Math.sin(this.yaw) * Math.cos(this.pitch);
    const fz = -Math.cos(this.yaw) * Math.cos(this.pitch);
    const fy = Math.sin(this.pitch);
    const gates = this.latestState?.unlockedGates ?? [];
    for (const d of [0.34, 0.56, maxDist]) {
      const px = this.playerPos.x + fx * d;
      const pz = this.playerPos.z + fz * d;
      const py = this.camera.position.y + fy * d;
      const res = resolveWorldMovement(
        this.playerPos.x,
        this.playerPos.z,
        px,
        pz,
        gates,
        WORLD.WATER_LEVEL,
        this.dynamicCollidersCache
      );
      const pushSq = (res.x - px) * (res.x - px) + (res.z - pz) * (res.z - pz);
      if (pushSq > 0.0025) {
        return Math.max(0.14, d - Math.sqrt(pushSq));
      }
      const floorH = this.getTerrainHeight(px, pz);
      if (floorH > py + 0.05) {
        return Math.max(0.14, d);
      }
    }
    return maxDist + 0.5;
  }

  private updateToolAnimation(delta: number, nowMs: number) {
    if (this.isSwinging) {
      const swingSpeed = Math.PI / ANIMATION_TUNING.CHOP_SWING_DURATION_SEC;
      this.swingAnimationTimer += delta * swingSpeed;
      if (this.swingAnimationTimer >= Math.PI) {
        this.isSwinging = false;
        this.swingAnimationTimer = 0;
      }
    }
    if (this.pickupAnimTimer > 0) {
      this.pickupAnimTimer = Math.max(0, this.pickupAnimTimer - delta);
    }
    this.equipAnimTimer = Math.max(0, this.equipAnimTimer - delta * 4.5);

    // Update flying 3D item pickup clones arcing smoothly into the left hand
    if (this.flyingPickups.length > 0) {
      const handWorldTarget = new THREE.Vector3(-0.22, -0.26, -0.45).applyMatrix4(
        this.camera.matrixWorld
      );
      const keepPickups: typeof this.flyingPickups = [];
      for (const fp of this.flyingPickups) {
        fp.elapsed += delta;
        const t = Math.min(1, fp.elapsed / fp.duration);
        const ease = t * t * (3 - 2 * t);
        fp.mesh.position.lerpVectors(fp.startPos, handWorldTarget, ease);
        fp.mesh.position.y += Math.sin(t * Math.PI) * 0.22;
        fp.mesh.rotation.y += delta * 6.5;
        const shrink = t < 0.7 ? 1.0 : Math.max(0.05, 1.0 - (t - 0.7) / 0.3);
        fp.mesh.scale.setScalar(0.42 * shrink);
        if (t < 1) {
          keepPickups.push(fp);
        } else {
          this.scene.remove(fp.mesh);
        }
      }
      this.flyingPickups = keepPickups;
    }

    // Drive skeletal NLA clip controller on fp_arms.glb
    const tempStage = getBodyTempStage(this.latestState?.needs.temperature ?? 37.0);
    const baseClip: FPArmClipName = !this.isGrounded
      ? 'Jump'
      : this.isSwimming
        ? 'Swim'
        : this.isWading && this.isMoving
          ? 'Wade'
          : this.isCrouching && this.isMoving
            ? 'CrouchWalk'
            : this.isMoving && this.isSprinting
              ? 'Sprint'
              : this.isMoving
                ? 'Walk'
                : tempStage.shivering
                  ? 'ColdShiver'
                  : 'Idle';
    this.fpClipController?.update(delta, baseClip);

    // Multi-phase chop/swing curve: wind-up (0..0.28) -> fast strike (0.28..0.55) -> recovery (0.55..1.0)
    const swingPhase = this.swingAnimationTimer / Math.PI;
    let swingCurve = 0;
    if (this.isSwinging) {
      if (swingPhase < 0.26) {
        // Wind-up pulls back slightly
        swingCurve = -0.35 * Math.sin((swingPhase / 0.26) * (Math.PI * 0.5));
      } else {
        // Fast strike and smooth follow-through recovery
        const strikeT = (swingPhase - 0.26) / 0.74;
        swingCurve = Math.sin(strikeT * Math.PI);
      }
    }

    const tSec = nowMs * 0.001;
    const breathPitch = Math.sin(tSec * ANIMATION_TUNING.IDLE_BREATH_FREQ) * 0.011;
    const idleBobY =
      Math.sin(tSec * ANIMATION_TUNING.IDLE_BREATH_FREQ) * ANIMATION_TUNING.IDLE_BREATH_AMP_Y;
    const idleSwayX =
      Math.cos(tSec * ANIMATION_TUNING.IDLE_BREATH_FREQ * 0.7) * ANIMATION_TUNING.IDLE_SWAY_AMP_X;
    const shiverJitter = tempStage.shivering ? Math.sin(nowMs * 0.038) * 0.0035 : 0;
    const sprintFactor = this.isMoving && this.isSprinting ? 1 : 0;

    // Rhythmic locomotion stride for hands (subtle and weighted)
    const strideY = Math.abs(Math.sin(this.walkTimer)) * 0.024 * this.moveBlend;
    const strideX = Math.cos(this.walkTimer * 0.5) * 0.020 * this.moveBlend;
    const drawOffset = this.equipAnimTimer * 0.22;

    // Swim breaststroke paddle offsets
    const swimSweep = Math.sin(this.walkTimer * 0.85) * 0.12 * this.swimBlend;
    const swimOut = (0.5 + 0.5 * Math.cos(this.walkTimer * 0.85)) * 0.10 * this.swimBlend;

    // Action-specific right-hand swing curves (thrust vs slash vs chop)
    let actX = -swingCurve * 0.11;
    let actY = -swingCurve * 0.14;
    let actZ = swingCurve * 0.12;
    let rotX = swingCurve * 1.05;
    let rotY = -swingCurve * 0.34;
    let rotZ = -swingCurve * 0.22;

    if (this.activeSwingKind === 'spear') {
      actX = -swingCurve * 0.04;
      actY = swingCurve * 0.03;
      actZ = -swingCurve * 0.42;
      rotX = -swingCurve * 0.22;
      rotY = swingCurve * 0.08;
      rotZ = 0;
    } else if (this.activeSwingKind === 'machete') {
      actX = -swingCurve * 0.22;
      actY = -swingCurve * 0.11;
      actZ = -swingCurve * 0.16;
      rotX = swingCurve * 0.88;
      rotY = -swingCurve * 0.65;
      rotZ = -swingCurve * 0.48;
    }

    // Scale Z slightly by 54° FOV ratio so first-person arms never stretch when sprinting increases world FOV
    const fovScale =
      Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) /
      Math.tan(THREE.MathUtils.degToRad(MOVEMENT_TUNING.FP_ARMS_FOV_DEG * 0.5));
    const zCompensation = THREE.MathUtils.clamp(1 / Math.max(0.85, fovScale * 0.84), 0.88, 1.08);

    this.toolRig.position.set(
      0.36 + idleSwayX + strideX + swimOut - sprintFactor * 0.04 + actX + this.handLagX + shiverJitter,
      -0.32 -
        strideY -
        drawOffset +
        idleBobY -
        sprintFactor * 0.035 +
        actY +
        this.handLagY -
        this.landingDip * 0.35,
      (-0.62 + swimSweep + sprintFactor * 0.045 + actZ) * zCompensation
    );
    this.toolRig.rotation.set(
      0.08 + breathPitch + sprintFactor * 0.18 - this.swimBlend * 0.28 + rotX + this.handLagY * 1.4,
      -0.15 + sprintFactor * 0.26 + swimOut * 1.0 + rotY + this.handLagX * 1.4,
      -0.05 - sprintFactor * 0.15 + rotZ
    );

    // Satisfying Left-Hand Reach & Grab curve during item pickup (0.50 s)
    let pickX = 0;
    let pickY = 0;
    let pickZ = 0;
    let pickRotX = 0;
    if (this.pickupAnimTimer > 0) {
      const pNorm = 1 - this.pickupAnimTimer / ANIMATION_TUNING.PICKUP_DURATION_SEC;
      const reachArc = Math.sin(pNorm * Math.PI);
      pickX = reachArc * 0.14;
      pickY =
        this.pickupReachHeight === 'ground'
          ? -reachArc * 0.16
          : this.pickupReachHeight === 'bush'
            ? reachArc * 0.12
            : -reachArc * 0.04;
      pickZ = -reachArc * 0.22;
      pickRotX =
        this.pickupReachHeight === 'ground' ? -reachArc * 0.45 : reachArc * 0.32;
    }

    // Opposite-phase left offhand arm pump + swim stroke + pickup reach
    const oppStride = Math.sin(this.walkTimer + Math.PI) * 0.036 * this.moveBlend;
    this.offhandRig.position.set(
      -0.36 - idleSwayX * 0.8 - strideX * 0.8 - swimOut + pickX + this.handLagX - shiverJitter,
      -0.44 -
        Math.abs(oppStride) * 0.55 +
        idleBobY * 0.85 -
        (1 - this.moveBlend) * 0.025 +
        pickY +
        this.handLagY -
        this.landingDip * 0.35,
      (-0.58 - oppStride * 1.1 + swimSweep + pickZ) * zCompensation
    );
    this.offhandRig.rotation.set(
      0.18 -
        breathPitch * 0.75 +
        oppStride * 1.8 -
        this.swimBlend * 0.38 -
        swingCurve * 0.14 +
        pickRotX,
      0.16 - swimOut * 1.05,
      0.08 + sprintFactor * 0.12
    );

    if (this.torchFlameMesh && this.torchMesh.visible) {
      const f = 0.9 + Math.sin(nowMs * 0.018) * 0.16;
      this.torchFlameMesh.scale.set(1, f, 1);
      this.torchLight.intensity = 1.75 + Math.sin(nowMs * 0.023) * 0.25;
    } else if (this.lanternGlowMesh && this.lanternMesh.visible) {
      const f = 0.95 + Math.sin(nowMs * 0.011) * 0.08;
      this.lanternGlowMesh.scale.set(1, f, 1);
      this.torchLight.intensity = 2.4 + Math.sin(nowMs * 0.015) * 0.18;
    }

    if (this.fpIKRig) {
      const inVoy = Boolean(this.latestState?.voyage && this.latestState.voyage.phase !== 'docked');
      this.fpIKRig.root.visible = !this.photoMode && !inVoy;
      // Track wetness, grime, dried blood & tool durability wear
      const hp = this.latestState?.needs.health ?? 100;
      if (hp < this.lastKnownHp - 1) {
        this.bloodLevel = Math.min(1, this.bloodLevel + (this.lastKnownHp - hp) * 0.025);
      }
      this.lastKnownHp = hp;
      const wet01 = Math.max(
        this.wasUnderwater ? 1 : 0,
        this.isSwimming ? 0.95 : this.isWading ? 0.55 : 0,
        (this.latestState?.needs.wetness ?? 0) / 100
      );
      const rain = this.latestState?.weather.rain ?? 0;
      if (this.isSwimming || this.isWading || rain > 0.25) {
        const washRate = (this.isSwimming ? 0.45 : 0.16) * delta;
        this.grimeLevel = Math.max(0, this.grimeLevel - washRate);
        this.bloodLevel = Math.max(0, this.bloodLevel - washRate * 1.15);
      } else if (this.isMoving) {
        this.grimeLevel = Math.min(
          1,
          this.grimeLevel + (this.stance === 'prone' ? 0.045 : 0.01) * delta
        );
      }
      this.fpIKRig.setSkinConditions(wet01, this.grimeLevel, this.bloodLevel);
      this.fullBodyController?.setWetAndGrime(wet01, this.grimeLevel);
      const eq = this.latestState
        ? getEquipped(this.latestState.inventory, this.latestState.selectedSlot)
        : { slot: null, def: null };
      const maxDur = eq.slot ? getInitialDurability(eq.slot.itemId) : undefined;
      const wearRatio =
        eq.slot && maxDur && eq.slot.durability !== undefined
          ? eq.slot.durability / maxDur
          : 1;
      this.fpIKRig.setToolDurabilityWear(wearRatio);

      // Tick down Part 4 action blends smoothly
      const dec = (val: number) => (val > 0 ? Math.max(0, val - delta) : 0);
      this.actionTimers.drinkCupped = dec(this.actionTimers.drinkCupped);
      this.actionTimers.drinkBottle = dec(this.actionTimers.drinkBottle);
      this.actionTimers.eat = dec(this.actionTimers.eat);
      this.actionTimers.bandage = dec(this.actionTimers.bandage);
      this.actionTimers.mapLook = dec(this.actionTimers.mapLook);
      this.actionTimers.heatWipe = dec(this.actionTimers.heatWipe);
      this.actionTimers.cough = dec(this.actionTimers.cough);
      this.actionTimers.craft = dec(this.actionTimers.craft);
      this.actionTimers.place = dec(this.actionTimers.place);

      // Physiological automatic animations + audio cues (cold chatter, hot brow-wipe, sickness cough, swim splash)
      if (tempStage.shivering) {
        this.periodicActionAccum.shiver += delta;
        if (this.periodicActionAccum.shiver >= ACTION_TUNING.SHIVER_SFX_INTERVAL_SEC) {
          this.periodicActionAccum.shiver = 0;
          this.actionAudioCallbacks.onShiver?.();
        }
      }
      if ((this.latestState?.needs.sickness ?? 0) > 0) {
        this.periodicActionAccum.cough += delta;
        if (this.periodicActionAccum.cough >= ACTION_TUNING.COUGH_INTERVAL_SEC) {
          this.periodicActionAccum.cough = 0;
          this.actionTimers.cough = ACTION_TUNING.COUGH_DURATION_SEC;
          this.actionAudioCallbacks.onCough?.();
        }
      }
      const ambientC = this.latestState
        ? computeAmbientTempC(this.latestState.clock, this.latestState.weather)
        : 28;
      if (ambientC >= ACTION_TUNING.HOT_BROW_WIPE_AMBIENT_C && !this.isSwimming) {
        this.periodicActionAccum.heatWipe += delta;
        if (this.periodicActionAccum.heatWipe >= ACTION_TUNING.HEAT_WIPE_INTERVAL_SEC) {
          this.periodicActionAccum.heatWipe = 0;
          this.actionTimers.heatWipe = ACTION_TUNING.HEAT_WIPE_DURATION_SEC;
        }
      }
      if (this.isSwimming) {
        const prevPhase = this.periodicActionAccum.swimCycle;
        const speedScale = this.isMoving ? 1.15 : 0.45;
        this.periodicActionAccum.swimCycle +=
          delta * ACTION_TUNING.SWIM_STROKE_CYCLE_RAD_PER_SEC * speedScale;
        if (
          this.isMoving &&
          Math.floor(prevPhase / (Math.PI * 2)) <
            Math.floor(this.periodicActionAccum.swimCycle / (Math.PI * 2))
        ) {
          this.actionAudioCallbacks.onSwimStroke?.();
        }
      }

      const blendCurve = (rem: number, dur: number) =>
        rem > 0 ? Math.sin((1 - rem / dur) * Math.PI) : 0;
      const exhaustedAmt = Math.max(
        0,
        Math.min(1, 1 - (this.latestState?.needs.stamina ?? 100) / NEEDS.EXHAUSTED_THRESHOLD)
      );

      const wallDist = this.getForwardObstacleDistance();
      const swingProg = this.isSwinging ? this.swingAnimationTimer / Math.PI : -1;
      const pickProg =
        this.pickupAnimTimer > 0
          ? 1 - this.pickupAnimTimer / ANIMATION_TUNING.PICKUP_DURATION_SEC
          : -1;
      const shiverAmt = tempStage.shivering ? 1 : 0;
      const sprintBlend = this.isMoving && this.isSprinting ? 1 : 0;
      this.fpIKRig.update({
        dt: delta,
        elapsedSec: tSec,
        yawDelta: this.frameLookYawDelta,
        pitchDelta: this.frameLookPitchDelta,
        moveBlend: this.moveBlend,
        sprintBlend,
        crouchBlend: this.crouchBlend,
        proneBlend: this.proneBlend,
        sitBlend: this.sitBlend,
        sleepBlend: this.sleepBlend,
        swimBlend: this.swimBlend,
        wallDistance: wallDist,
        swingProgress: swingProg,
        swingKind: this.activeSwingKind ?? 'axe',
        pickupProgress: pickProg,
        pickupReach: this.pickupReachHeight,
        activeActionClip: baseClip,
        shiverAmount: shiverAmt,
        injuredBandaged:
          this.bandagedActive ||
          (this.latestState?.needs.health ?? 100) < 35,
        cuppedDrinkBlend: blendCurve(
          this.actionTimers.drinkCupped,
          ACTION_TUNING.DRINK_SPRING_DURATION_SEC
        ),
        drinkBottleBlend: blendCurve(
          this.actionTimers.drinkBottle,
          ACTION_TUNING.DRINK_BOTTLE_DURATION_SEC
        ),
        biteEatBlend:
          this.actionTimers.eat > 0
            ? 1 - this.actionTimers.eat / ACTION_TUNING.EAT_DURATION_SEC
            : 0,
        bandageBlend: blendCurve(
          this.actionTimers.bandage,
          ACTION_TUNING.BANDAGE_DURATION_SEC
        ),
        mapLookBlend: blendCurve(
          this.actionTimers.mapLook,
          ACTION_TUNING.MAP_GLANCE_DURATION_SEC
        ),
        heatWipeBlend: blendCurve(
          this.actionTimers.heatWipe,
          ACTION_TUNING.HEAT_WIPE_DURATION_SEC
        ),
        coughBlend: blendCurve(this.actionTimers.cough, ACTION_TUNING.COUGH_DURATION_SEC),
        exhaustedAmount: exhaustedAmt,
        swimStrokePhase: this.periodicActionAccum.swimCycle,
        euphoriaBrace: this.lastEuphoriaOut?.fpArmBrace ?? 0,
        euphoriaFlail: this.lastEuphoriaOut?.fpArmFlail ?? 0,
        euphoriaFlailAngle: this.lastEuphoriaOut?.flailAngle ?? 0,
      });
    }
  }

  private updateAtmosphereAndLights(nowMs: number, delta: number) {
    const hour = this.latestState?.clock.hour ?? 9;
    const v = this.latestState?.voyage;
    const inVoyage = Boolean(v && v.phase !== 'docked');
    const weather: WeatherState =
      inVoyage && v && v.phase === 'sailing'
        ? computeSeaWeatherForLeg(v.legIndex, v.distanceNm)
        : (this.latestState?.weather ?? {
            kind: 'clear',
            rain: 0,
            wind: 0.15,
          });

    const norm = ((hour % 24) + 24) / 24;
    const sunAngle = norm * Math.PI * 2 - Math.PI / 2;
    const sunElev = Math.sin(sunAngle);
    const sunDist = 115;
    const sunX = Math.cos(sunAngle) * sunDist;
    const sunY = Math.sin(sunAngle) * sunDist;

    // Anchor directional shadow frustum smoothly around camera anchor (snapped to 1m grid to avoid shimmer)
    const anchorX = Math.round(inVoyage ? VOYAGE_STAGE_ORIGIN.x : this.playerPos.x);
    const anchorZ = Math.round(inVoyage ? VOYAGE_STAGE_ORIGIN.z : this.playerPos.z);
    this.sunShadowTarget.position.set(anchorX, 0, anchorZ);
    this.sunShadowTarget.updateMatrixWorld();

    if (sunElev >= -0.05) {
      this.sunLight.position.set(anchorX + sunX, Math.max(12, sunY), anchorZ + 35);
    } else {
      this.sunLight.position.set(anchorX - sunX, Math.max(24, -sunY), anchorZ - 35);
    }

    const stormWeight = weather.kind === 'storm' ? 1 : weather.rain * 0.65;

    // Earthy survival sky colors: golden dawn/sunset, crisp coastal day, cold blue night
    const dayHorizon = new THREE.Color(weather.rain > 0 ? 0x5c7286 : 0x74badb);
    const dayZenith = new THREE.Color(weather.rain > 0 ? 0x354759 : 0x1b589c);
    const goldenHorizon = new THREE.Color(0xe6884e);
    const goldenZenith = new THREE.Color(0x284770);
    const nightHorizon = new THREE.Color(0x0b1a33);
    const nightZenith = new THREE.Color(0x030816);

    const skyColor = new THREE.Color();
    const zenithColor = new THREE.Color();
    let nightFactor = 0;

    if (sunElev > 0.22) {
      const t = THREE.MathUtils.clamp((sunElev - 0.22) / 0.45, 0, 1);
      const st = THREE.MathUtils.smoothstep(t, 0, 1);
      skyColor.lerpColors(goldenHorizon, dayHorizon, st);
      zenithColor.lerpColors(goldenZenith, dayZenith, st);
      this.sunLight.intensity = (0.98 + t * 0.28) * (1 - weather.rain * 0.34);
      this.sunLight.color.setHex(0xfff0d4);
      this.ambientLight.intensity = 0.22 + t * 0.06;
      this.hemiLight.intensity = GRAPHICS_TUNING.AMBIENT_HEMI_INTENSITY_DAY - stormWeight * 0.14;
      this.hemiLight.color.setHex(weather.rain > 0 ? 0x90a4b8 : 0xa5d5ed);
      this.hemiLight.groundColor.setHex(0x645438);
    } else if (sunElev > -0.18) {
      const t = THREE.MathUtils.clamp((sunElev + 0.18) / 0.4, 0, 1);
      skyColor.lerpColors(nightHorizon, goldenHorizon, t);
      zenithColor.lerpColors(nightZenith, goldenZenith, t);
      this.sunLight.intensity = 0.38 + t * 0.72;
      this.sunLight.color.setHex(0xffb464);
      this.ambientLight.intensity = 0.18 + t * 0.06;
      this.hemiLight.intensity = GRAPHICS_TUNING.AMBIENT_HEMI_INTENSITY_NIGHT + t * 0.22;
      this.hemiLight.color.setHex(0xdc9868);
      this.hemiLight.groundColor.setHex(0x4a402a);
      nightFactor = 1 - t;
    } else {
      skyColor.copy(nightHorizon);
      zenithColor.copy(nightZenith);
      this.sunLight.intensity = 0.28;
      this.sunLight.color.setHex(0x6088c2);
      this.ambientLight.intensity = 0.19;
      this.hemiLight.intensity = GRAPHICS_TUNING.AMBIENT_HEMI_INTENSITY_NIGHT;
      this.hemiLight.color.setHex(0x223862);
      this.hemiLight.groundColor.setHex(0x121d30);
      nightFactor = 1;
    }

    // Palm breeze sway, cavern gloom near Obsidian Caves, & Stage 7 atmospheric mist/shafts/fireflies/lightning
    const tSec = nowMs * 0.001;
    const preset = GRAPHICS_PRESETS[this.quality];
    const lightningFlash = this.atmosphereFx
      ? updateAtmosphereFXRig(
          this.atmosphereFx,
          delta,
          tSec,
          hour,
          weather,
          sunElev,
          inVoyage,
          preset.mistAndShafts,
          preset.fireflies,
          this.playerPos
        )
      : 0;
    if (lightningFlash > 0.02) {
      this.sunLight.intensity += lightningFlash * 1.45;
      skyColor.lerp(new THREE.Color(0xcbd5e1), lightningFlash * 0.35);
      if (lightningFlash > 0.85 && nowMs - this.lastThunderSoundAt > 2500) {
        this.lastThunderSoundAt = nowMs;
        this.onThunderStrike?.();
      }
    }

    const caveDist = Math.hypot(
      this.playerPos.x - WORLD.CAVE_GROTTO_POS.x,
      this.playerPos.z - WORLD.CAVE_GROTTO_POS.z
    );
    const caveFactor = inVoyage ? 0 : THREE.MathUtils.clamp(1 - (caveDist - 8) / 14, 0, 0.72);
    if (caveFactor > 0.02) {
      skyColor.lerp(new THREE.Color(0x0b1322), caveFactor);
      zenithColor.lerp(new THREE.Color(0x050911), caveFactor);
      this.sunLight.intensity *= 1 - caveFactor * 0.75;
      this.ambientLight.intensity *= 1 - caveFactor * 0.45;
    }

    this.scene.background = skyColor;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(skyColor);
      this.scene.fog.density =
        THREE.MathUtils.lerp(
          GRAPHICS_TUNING.BASE_FOG_DENSITY,
          GRAPHICS_TUNING.STORM_FOG_DENSITY,
          Math.max(weather.rain, stormWeight)
        ) +
        caveFactor * 0.015;
    }

    // Update Atmospheric Sky Dome + Physical Scattering Sky + Periodic IBL Probe + CSM Cascades
    const actualSunDir = _skySunDir.set(sunX, sunY, 35).normalize();
    const sunDirNorm = _toTarget.set(sunElev >= -0.05 ? sunX : -sunX, Math.max(12, Math.abs(sunY)), sunElev >= -0.05 ? 35 : -35).normalize();
    if (this.skyDome) {
      this.skyDome.mesh.position.copy(this.camera.position);
      const u = this.skyDome.material.uniforms;
      u.uZenithColor.value.copy(zenithColor);
      u.uHorizonColor.value.copy(skyColor);
      u.uSunDir.value.copy(actualSunDir);
      u.uSunColor.value.copy(this.sunLight.color);
      u.uStorm.value = stormWeight;
      u.uNight.value = nightFactor;
      u.uLightning.value = lightningFlash;
      this.skyDome.updatePhysicalSky(tSec, actualSunDir, sunElev, stormWeight, nightFactor);
    }

    this.refreshSkyIBL(false, hour);
    this.scene.environmentIntensity =
      (preset.pbrMaps ? 0.28 : 0.14) * Math.max(0.28, 1 - nightFactor * 0.65 - stormWeight * 0.24);

    if (this.csm) {
      this.csm.lightDirection.copy(sunDirNorm).negate();
      for (const l of this.csm.lights) {
        l.color.copy(this.sunLight.color);
        l.intensity = this.sunLight.intensity;
      }
    }

    if (this.oceanMaterials) {
      const wu = this.oceanMaterials.shaderMaterial.uniforms;
      wu.uTime.value = tSec;
      wu.uSunDir.value.copy(sunDirNorm);
      wu.uSunColor.value.copy(this.sunLight.color);
      wu.uSkyHorizon.value.copy(skyColor);
      wu.uFogColor.value.copy(skyColor);
      wu.uFogDensity.value =
        this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.density : 0.0046;
      wu.uWind.value = weather.wind;
      wu.uStorm.value = stormWeight;
      wu.uNight.value = nightFactor;
    }

    if (this.foliageField) {
      this.foliageField.group.visible = !inVoyage;
      if (!inVoyage) {
        this.foliageField.update(tSec, weather.wind, this.camera.position);
      }
    }

    if (this.starsMat) {
      this.starsMat.opacity = nightFactor * (1 - weather.rain * 0.85) * 0.9;
    }
    if (this.moonMesh) {
      this.moonMesh.visible = nightFactor > 0.15 && weather.rain < 0.7;
      this.moonMesh.position.set(
        this.camera.position.x - sunX * 2.2,
        Math.max(42, -sunY * 2.2),
        this.camera.position.z - 95
      );
    }

    if (this.landmarks?.radioTowerBeacon) {
      this.landmarks.radioTowerBeacon.visible = Math.sin(tSec * 3.8) > -0.25;
    }
    if (this.landmarks?.caveCrystalLights) {
      for (let i = 0; i < this.landmarks.caveCrystalLights.length; i++) {
        this.landmarks.caveCrystalLights[i].intensity = 1.2 + Math.sin(tSec * 3.1 + i * 1.8) * 0.3;
      }
    }
    // Keep palm trunks anchored at their base while crown fronds sway gently (Phase 4.1)
    for (let i = 0; i < this.palmWindMeshes.length; i++) {
      const m = this.palmWindMeshes[i];
      if (!m.visible) continue;
      const baseRotZ = (m.userData.baseRotZ as number) || 0;
      m.rotation.z = baseRotZ;
    }

    // Flickering campfires (with High-quality closest campfire shadow casting + Blender flipbooks) & forge lights
    let closestFireId: string | null = null;
    let closestFireDistSq = 28 * 28;
    const allowFireShadow = !this.isSoftwareGl && preset.fireShadow && !inVoyage;
    for (const [id, fire] of this.campfires3D.entries()) {
      const fireData = fire.data as PlacedCampfire & { fuel?: number };
      const isLit = (fireData.fuel ?? 1) > 0;
      fire.light.intensity = isLit ? 2.15 + Math.sin(tSec * 13 + fire.data.x) * 0.32 : 0;
      for (let i = 0; i < fire.flames.length; i++) {
        const flame = fire.flames[i];
        const s = 0.88 + Math.sin(tSec * 14 + i * 2.1) * 0.14;
        flame.scale.set(1, s, 1);
      }
      if (fire.flipbookSprites && isLit) {
        for (const sp of fire.flipbookSprites) {
          const frame = Math.floor(tSec * sp.fps + sp.phase) % 64;
          setFlipbookFrame(sp.tex, frame);
          if (sp.kind === 'smoke' || sp.kind === 'embers') {
            sp.mesh.lookAt(this.camera.position.x, sp.mesh.position.y + fire.group.position.y, this.camera.position.z);
          }
        }
      }
      if (allowFireShadow && isLit) {
        const dx = fire.data.x - this.playerPos.x;
        const dz = fire.data.z - this.playerPos.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < closestFireDistSq) {
          closestFireDistSq = dSq;
          closestFireId = id;
        }
      }
    }
    for (const [id, fire] of this.campfires3D.entries()) {
      fire.light.castShadow = allowFireShadow && id === closestFireId;
    }

    for (const rec of this.structures3D.values()) {
      if (rec.data.type !== 'forge') continue;
      const queued = rec.data.forgeQueue?.inputWood ?? 0;
      const isBurning = queued > 0;
      if (rec.forgeLight) {
        rec.forgeLight.intensity = isBurning
          ? FORGE_TUNING.EMBER_GLOW_INTENSITY + Math.sin(tSec * 14 + rec.data.z) * 0.45
          : 0.72 + Math.sin(tSec * 5 + rec.data.z) * 0.12;
      }
      if (rec.forgeEmberMesh && rec.forgeEmberMesh.material instanceof THREE.MeshBasicMaterial) {
        rec.forgeEmberMesh.material.color.setHex(isBurning ? 0xfb923c : 0x7c2d12);
      }
      if (isBurning) {
        rec.forgeSmokeTimer = (rec.forgeSmokeTimer ?? 0) + delta;
        if (rec.forgeSmokeTimer >= FORGE_TUNING.SMOKE_SPAWN_INTERVAL_SEC) {
          rec.forgeSmokeTimer = 0;
          const smokeTex = this.loadedGLBs?.flipbooks.smoke ? this.loadedGLBs.flipbooks.smoke.clone() : null;
          if (smokeTex) {
            smokeTex.needsUpdate = true;
            setFlipbookFrame(smokeTex, Math.floor(Math.random() * 16));
          }
          const forgeGeom =
            this.forgeSmokeGeom ??
            (this.forgeSmokeGeom = new THREE.PlaneGeometry(0.45, 0.45));
          const puffMat = new THREE.MeshBasicMaterial({
            color: 0xe5e5e5,
            map: smokeTex ?? undefined,
            transparent: true,
            opacity: 0.56,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const puff = new THREE.Mesh(forgeGeom, puffMat);
          puff.position.set(
            rec.data.x + (Math.random() - 0.5) * 0.16,
            rec.data.y + 2.04,
            rec.data.z + (Math.random() - 0.5) * 0.16
          );
          this.scene.add(puff);
          this.particles.push({
            mesh: puff,
            velocity: new THREE.Vector3(
              0.24 + (Math.random() - 0.5) * 0.35,
              1.15 + Math.random() * 0.45,
              (Math.random() - 0.5) * 0.35
            ),
            lifetime: 0,
            maxLifetime: 1.85 + Math.random() * 0.45,
            gravity: -0.35,
            scaleCurve: 'smoke',
            sharedGeom: true,
            flipbookTex: smokeTex ?? undefined,
            billboard: true,
          });
        }
      } else {
        rec.forgeSmokeTimer = 0;
      }
    }

    // Rising crash smoke puffs
    for (let i = 0; i < this.crashSmokePuffs.length; i++) {
      const puff = this.crashSmokePuffs[i];
      const phase = (tSec * 0.35 + (puff.userData.phase || 0)) % 1;
      puff.position.y = 1.1 + phase * 6.5;
      puff.position.x = -2.2 + Math.sin(tSec * 1.2 + i) * 0.45 + phase * 1.2;
      const scale = 0.7 + phase * 1.6;
      puff.scale.setScalar(scale);
    }

    const underwaterNow = this.camera.position.y < this.currentWaterLevel + 0.04;
    if (underwaterNow) {
      this.rainDropletLevel = 1.0;
    } else if (weather.rain > 0.1 && !inVoyage) {
      this.rainDropletLevel = Math.min(1, Math.max(this.rainDropletLevel, weather.rain));
    } else {
      this.rainDropletLevel = Math.max(
        0,
        this.rainDropletLevel - delta / PART5_IMMERSION_TUNING.RAIN_DROPLET_DECAY_SEC
      );
    }

    const inCaveZone =
      Math.hypot(this.playerPos.x - WORLD.CAVE_GROTTO_POS.x, this.playerPos.z - WORLD.CAVE_GROTTO_POS.z) < 16;
    const coldBreath =
      computeAmbientTempC(this.latestState?.clock ?? { day: 1, hour: 9, totalHours: 9 }, weather) <=
      PART5_IMMERSION_TUNING.COLD_BREATH_AMBIENT_C;
    if (this.worldLifeFx) {
      _camDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      this.worldLifeFx.update(
        this.photoMode ? 0 : delta,
        tSec,
        this.camera.position,
        _camDir,
        weather,
        this.currentWaterLevel,
        coldBreath,
        underwaterNow,
        inVoyage,
        !this.isSoftwareGl && (preset.mistAndShafts || preset.fireflies)
      );
    }

    if (nowMs - this.lastSpatialAudioAtMs >= 140) {
      this.lastSpatialAudioAtMs = nowMs;
      _camDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      const rad = Math.hypot(this.playerPos.x, this.playerPos.z) || 1;
      const surfX = (this.playerPos.x / rad) * (this.islandRadius * 0.68);
      const surfZ = (this.playerPos.z / rad) * (this.islandRadius * 0.68);
      let closestFirePos: { x: number; y: number; z: number } | null = null;
      if (closestFireId) {
        const cf = this.campfires3D.get(closestFireId);
        if (cf) closestFirePos = { x: cf.data.x, y: cf.data.y + 0.3, z: cf.data.z };
      }
      this.part5Callbacks.onSpatialAmbience?.({
        listenerPos: {
          x: this.camera.position.x,
          y: this.camera.position.y,
          z: this.camera.position.z,
        },
        listenerForward: { x: _camDir.x, y: _camDir.y, z: _camDir.z },
        surfPos: { x: surfX, y: this.currentWaterLevel, z: surfZ },
        springPos: { x: WORLD.SPRING_POS.x, y: 1.5, z: WORLD.SPRING_POS.z },
        campfirePos: closestFirePos,
        inCave: inCaveZone,
        inForest: !inCaveZone && rad < 52 && this.playerPos.y > 2.2,
        isNight: nightFactor > 0.45,
        rainIntensity: weather.rain,
        nearOcean: rad > 48,
        health: this.latestState?.needs.health ?? 100,
        underwater: underwaterNow,
      });
    }

    // PostFX environmental mood grading uniforms (Phase 3.5 frost & Part 5 lens effects)
    if (this.postFx && !this.isSoftwareGl) {
      const temp = this.latestState?.needs.temperature ?? 37;
      const tempStage = getBodyTempStage(temp);
      const coldFactor = tempStage.frostIntensity;
      const hp = this.latestState?.needs.health ?? 100;
      const lowHpFactor =
        hp < GRAPHICS_TUNING.LOW_HEALTH_VIGNETTE_THRESHOLD
          ? THREE.MathUtils.clamp(
              (GRAPHICS_TUNING.LOW_HEALTH_VIGNETTE_THRESHOLD - hp) /
                GRAPHICS_TUNING.LOW_HEALTH_VIGNETTE_THRESHOLD,
              0,
              1
            )
          : 0;
      const hurtFactor = Math.max(lowHpFactor * 0.65, this.damageJoltTimer / 0.38);
      const heatShimmerFactor =
        preset.heatShimmer && !inVoyage && temp >= GRAPHICS_TUNING.HEAT_SHIMMER_TEMP_C
          ? THREE.MathUtils.clamp((temp - GRAPHICS_TUNING.HEAT_SHIMMER_TEMP_C) / 6.0, 0, 1) *
            GRAPHICS_TUNING.HEAT_SHIMMER_STRENGTH *
            (1 - weather.rain)
          : 0;
      this.postFx.updateUniforms({
        nightFactor,
        coldFactor,
        hurtFactor,
        stormFactor: stormWeight,
        heatShimmerFactor,
        rainDroplets: this.rainDropletLevel,
        underwaterFactor: underwaterNow ? 1 : 0,
        motionBlurStrength: this.extSettings.motionBlur ? 0.85 : 0,
        motionVelX: this.frameLookYawDelta * 2.4,
        motionVelY: this.frameLookPitchDelta * 2.4,
        photoFilter: this.photoMode ? this.photoFilter : 0,
        tSec,
      });
    }
    this.frameLookYawDelta = 0;
    this.frameLookPitchDelta = 0;

    // Rain particle fall around player (or around the Escape Boat at sea)
    if (this.rainPoints && this.rainMat) {
      if (weather.rain > 0.05) {
        this.rainPoints.visible = true;
        this.rainMat.opacity = weather.rain * 0.65;
        if (inVoyage) {
          this.rainPoints.position.set(VOYAGE_STAGE_ORIGIN.x, 0, VOYAGE_STAGE_ORIGIN.z);
        } else {
          this.rainPoints.position.set(this.playerPos.x, 0, this.playerPos.z);
        }
        const pos = this.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - delta * 18;
          if (y < 0) y = 22;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      } else {
        this.rainPoints.visible = false;
      }
    }
  }

  private updateParticles(delta: number) {
    const alive: Particle3D[] = [];
    for (const p of this.particles) {
      p.lifetime += delta;
      if (p.lifetime < p.maxLifetime) {
        p.velocity.y -= delta * (p.gravity ?? 9.8);
        p.mesh.position.addScaledVector(p.velocity, delta);
        const ratio = p.lifetime / p.maxLifetime;
        const s =
          p.scaleCurve === 'smoke'
            ? ratio < 0.72
              ? 0.75 + ratio * 1.45
              : Math.max(0.05, (0.75 + 0.72 * 1.45) * (1 - (ratio - 0.72) / 0.28))
            : 1 - ratio;
        p.mesh.scale.setScalar(s);
        if (p.flipbookTex) {
          setFlipbookFrame(p.flipbookTex, Math.min(63, Math.floor(ratio * 63)));
        }
        if (p.billboard) {
          p.mesh.lookAt(this.camera.position);
        }
        alive.push(p);
      } else {
        this.scene.remove(p.mesh);
        if (!p.sharedGeom) {
          p.mesh.geometry.dispose();
        }
        if (p.flipbookTex) {
          p.flipbookTex.dispose();
        }
      }
    }
    this.particles = alive;
  }

  // ---------------------------------------------------------------------------
  // INPUT EVENTS & RENDER LOOP
  // ---------------------------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isUiBlocked && !this.photoMode) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys[e.code] = true;

    if (e.code === this.getKeybind('photoMode') && !e.repeat) {
      this.togglePhotoMode();
      return;
    }
    if (this.photoMode) {
      if (e.code === 'Escape' && !e.repeat) {
        this.exitPhotoMode();
      }
      return;
    }

    if (this.sleepPhase !== 'none') return;

    if ((e.code === this.getKeybind('crouch') || e.code === 'ControlLeft') && !e.repeat) {
      this.crouchHoldSec = 0;
      this.crouchHoldProneTriggered = false;
      return;
    }

    if (e.code === this.getKeybind('prone') && !e.repeat) {
      if (this.stance === 'prone') {
        this.trySetStance('stand');
      } else {
        this.trySetStance('prone');
      }
      return;
    }

    if (e.code === this.getKeybind('sit') && !e.repeat) {
      if (this.stance === 'sit') {
        this.trySetStance('stand');
      } else {
        this.trySetStance('sit');
      }
      return;
    }

    if (e.code === this.getKeybind('jump')) {
      e.preventDefault();
      if (this.stance === 'prone') {
        this.trySetStance('crouch');
        return;
      }
      if (this.stance === 'sit') {
        this.trySetStance('stand');
        return;
      }
      const stam = this.latestState?.needs.stamina ?? 100;
      if (this.isGrounded && !this.isSwimming && stam >= NEEDS.STAMINA_JUMP) {
        this.verticalVel = MOVEMENT_TUNING.JUMP_VELOCITY_MPS;
        this.jumpDip = ANIMATION_TUNING.JUMP_DIP_DEPTH_M;
        this.isGrounded = false;
        this.peakAirY = this.playerFootY;
        this.fpClipController?.triggerOneShot('Jump', 0.45);
        this.onJump?.();
      }
      return;
    }

    if (e.code === this.getKeybind('interact')) {
      if (this.hoveredTarget?.kind === 'campfire') {
        this.onOpenCampfireCraft?.();
      } else {
        this.onPrimaryAction?.(this.hoveredTarget);
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
    if (e.code === this.getKeybind('crouch') || e.code === 'ControlLeft') {
      if (!this.crouchHoldProneTriggered && !this.isUiBlocked && !this.photoMode && this.sleepPhase === 'none') {
        if (this.stance === 'stand') {
          this.trySetStance('crouch');
        } else {
          this.trySetStance('stand');
        }
      }
      this.crouchHoldSec = 0;
      this.crouchHoldProneTriggered = false;
    }
  };

  private onCanvasClick = (e: MouseEvent) => {
    if (this.isUiBlocked) return;
    const movedDist = Math.hypot(
      e.clientX - this.pointerDownClient.x,
      e.clientY - this.pointerDownClient.y
    );
    if (movedDist > 6 && !this.isPointerLocked) {
      return;
    }

    const canvas = this.renderer.domElement;
    if (!this.isPointerLocked && document.pointerLockElement !== canvas) {
      this.lockPointer();
    }

    if (this.hoveredTarget || this.buildPreviewType !== null) {
      if (this.hoveredTarget?.kind === 'campfire') {
        this.onOpenCampfireCraft?.();
      } else {
        this.onPrimaryAction?.(this.hoveredTarget);
      }
    }
  };

  private onPointerLockChange = () => {
    this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.isUiBlocked && !this.photoMode) return;
    const sens = this.extSettings.mouseSensitivity || 1.0;

    if (this.isPointerLocked) {
      const mx = THREE.MathUtils.clamp(e.movementX, -80, 80);
      const my = THREE.MathUtils.clamp(e.movementY, -80, 80);
      const dYaw = -mx * 0.0024 * sens;
      const dPitch = -my * 0.0024 * sens;
      this.targetYaw += dYaw;
      this.targetPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.targetPitch + dPitch));
      this.frameLookYawDelta += dYaw;
      this.frameLookPitchDelta += dPitch;
      this.handLagX = THREE.MathUtils.clamp(
        this.handLagX - dYaw * 0.14,
        -ANIMATION_TUNING.HAND_SWAY_MAX_OFFSET,
        ANIMATION_TUNING.HAND_SWAY_MAX_OFFSET
      );
      this.handLagY = THREE.MathUtils.clamp(
        this.handLagY - dPitch * 0.14,
        -ANIMATION_TUNING.HAND_SWAY_MAX_OFFSET,
        ANIMATION_TUNING.HAND_SWAY_MAX_OFFSET
      );
    } else if (this.isDragging) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      const dYaw = -dx * 0.0035 * sens;
      const dPitch = -dy * 0.0035 * sens;
      this.targetYaw += dYaw;
      this.targetPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.targetPitch + dPitch));
      this.frameLookYawDelta += dYaw;
      this.frameLookPitchDelta += dPitch;
      this.handLagX = THREE.MathUtils.clamp(
        this.handLagX - dYaw * 0.14,
        -ANIMATION_TUNING.HAND_SWAY_MAX_OFFSET,
        ANIMATION_TUNING.HAND_SWAY_MAX_OFFSET
      );
      this.handLagY = THREE.MathUtils.clamp(
        this.handLagY - dPitch * 0.14,
        -ANIMATION_TUNING.HAND_SWAY_MAX_OFFSET,
        ANIMATION_TUNING.HAND_SWAY_MAX_OFFSET
      );
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.isUiBlocked && !this.photoMode) return;
    if (e.button === 2 && this.buildPreviewType !== null) {
      e.preventDefault();
      this.onCancelBuild?.();
      return;
    }
    if (e.button === 0) {
      this.pointerDownClient = { x: e.clientX, y: e.clientY };
      if (!this.isPointerLocked) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.buildPreviewType !== null || this.isPointerLocked) {
      e.preventDefault();
    }
  };

  private onMouseUp = () => {
    this.isDragging = false;
  };

  private onResize = () => {
    if (this.isDisposed || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.applyEffectivePixelRatioAndViewDist();
  };

  private onVisibilityChange = () => {
    this.isDocumentHidden = document.hidden;
    if (!this.isDocumentHidden) {
      this.lastTime = performance.now();
    }
  };

  private onWindowBlur = () => {
    this.isWindowFocused = false;
  };

  private onWindowFocus = () => {
    this.isWindowFocused = true;
    this.lastTime = performance.now();
  };

  private setupEventListeners() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', this.onCanvasClick);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('focus', this.onWindowFocus);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('resize', this.onResize);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDisposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateWaterReflection(inVoyage: boolean) {
    const preset = GRAPHICS_PRESETS[this.quality];
    if (
      this.isSoftwareGl ||
      !preset.planarReflection ||
      !preset.waterShader ||
      !this.waterReflectionRT ||
      !this.waterMesh ||
      inVoyage ||
      this.camera.position.y <= this.currentWaterLevel + 0.08
    ) {
      if (this.oceanMaterials) {
        this.oceanMaterials.shaderMaterial.uniforms.uHasPlanarReflection.value = 0;
      }
      return;
    }

    const rCam = this.waterReflectionCam;
    rCam.fov = this.camera.fov;
    rCam.aspect = this.camera.aspect;
    rCam.near = this.camera.near;
    rCam.far = this.camera.far;
    rCam.updateProjectionMatrix();

    rCam.position.set(
      this.camera.position.x,
      2 * this.currentWaterLevel - this.camera.position.y,
      this.camera.position.z
    );
    rCam.rotation.order = 'YXZ';
    rCam.rotation.set(-this.camera.rotation.x, this.camera.rotation.y, -this.camera.rotation.z);
    rCam.updateMatrixWorld();

    const prevWaterVis = this.waterMesh.visible;
    const prevToolVis = this.toolRig.visible;
    const prevOffhandVis = this.offhandRig.visible;
    const prevFpIKVis = this.fpIKRig?.root.visible ?? false;
    const prevBodyVis = this.fullBodyController?.group.visible ?? false;
    const prevRainVis = this.rainPoints?.visible ?? false;
    const prevGrassVis = this.foliageField?.grassMesh?.visible ?? false;
    const prevShadowAuto = this.renderer.shadowMap.autoUpdate;
    const prevTarget = this.renderer.getRenderTarget();

    this.waterMesh.visible = false;
    this.toolRig.visible = false;
    this.offhandRig.visible = false;
    if (this.fpIKRig) this.fpIKRig.root.visible = false;
    if (this.fullBodyController) this.fullBodyController.group.visible = false;
    if (this.rainPoints) this.rainPoints.visible = false;
    if (this.foliageField?.grassMesh) this.foliageField.grassMesh.visible = false;
    this.worldLifeFx?.setUnderwaterAndScatterVisibility(true);
    this.renderer.shadowMap.autoUpdate = false;

    this.renderer.setRenderTarget(this.waterReflectionRT);
    this.renderer.clear();
    this.renderer.render(this.scene, rCam);
    this.renderer.setRenderTarget(prevTarget);

    this.renderer.shadowMap.autoUpdate = prevShadowAuto;
    this.waterMesh.visible = prevWaterVis;
    this.toolRig.visible = prevToolVis;
    this.offhandRig.visible = prevOffhandVis;
    if (this.fpIKRig) this.fpIKRig.root.visible = prevFpIKVis;
    if (this.fullBodyController) this.fullBodyController.group.visible = prevBodyVis;
    if (this.rainPoints) this.rainPoints.visible = prevRainVis;
    if (this.foliageField?.grassMesh) this.foliageField.grassMesh.visible = prevGrassVis;
    this.worldLifeFx?.setUnderwaterAndScatterVisibility(false);

    if (this.oceanMaterials) {
      this.oceanMaterials.shaderMaterial.uniforms.uHasPlanarReflection.value = 1;
    }
  }

  private tick = () => {
    if (this.isDisposed) return;

    // Phase 5.2: Pause rendering completely when browser tab is hidden (0% GPU usage)
    if (this.isDocumentHidden || document.hidden) {
      this.frameId = window.setTimeout(this.tick, 250);
      return;
    }

    const now = performance.now();

    // Phase 5.1 & 5.2: Frame rate limiter & menu/background throttling
    let targetFps: number = this.extSettings.fpsLimit;
    if (this.isUiBlocked && !this.photoMode) {
      targetFps = PERFORMANCE_TUNING.MENU_OPEN_FPS_CAP; // 10 FPS when paused/menu open
    } else if (!this.isWindowFocused) {
      targetFps = Math.min(targetFps || 60, PERFORMANCE_TUNING.BACKGROUND_FPS_CAP);
    } else if (this.extSettings.batterySaver) {
      targetFps = Math.min(targetFps || 30, 30);
    }

    if (targetFps > 0 && !this.isSoftwareGl) {
      const minIntervalMs = 1000 / targetFps;
      if (now - this.lastRenderTimestamp < minIntervalMs - 1.2) {
        this.frameId = requestAnimationFrame(this.tick);
        return;
      }
    }
    this.lastRenderTimestamp = now;

    const delta = Math.min(0.08, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.fpsFrames += 1;
    if (now - this.fpsLastCheckMs >= 500) {
      this.fpsValue = Math.round((this.fpsFrames * 1000) / Math.max(1, now - this.fpsLastCheckMs));
      this.fpsFrames = 0;
      this.fpsLastCheckMs = now;

      // Phase 5.3: Dynamic Resolution Scaling when FPS dips under load on Auto/High/Ultra
      if (
        !this.isUiBlocked &&
        this.isWindowFocused &&
        !this.extSettings.batterySaver &&
        (this.extSettings.autoQuality || this.quality === 'high' || this.quality === 'ultra')
      ) {
        if (this.fpsValue < PERFORMANCE_TUNING.DYNAMIC_RES_LOW_FPS_THRESHOLD && this.dynamicResScale > PERFORMANCE_TUNING.DYNAMIC_RES_MIN_SCALE) {
          this.dynamicResScale = Math.max(
            PERFORMANCE_TUNING.DYNAMIC_RES_MIN_SCALE,
            this.dynamicResScale - 0.06
          );
          this.applyEffectivePixelRatioAndViewDist();
        } else if (this.fpsValue >= PERFORMANCE_TUNING.DYNAMIC_RES_RECOVER_FPS && this.dynamicResScale < 1.0) {
          this.dynamicResScale = Math.min(1.0, this.dynamicResScale + 0.04);
          this.applyEffectivePixelRatioAndViewDist();
        }
      }
    }

    for (const rec of this.clueMeshes.values()) {
      if (rec.beacon.visible) {
        rec.beacon.rotation.y += delta * 2.2;
        rec.beacon.position.y = 1.85 + Math.sin(now * 0.004) * 0.14;
      }
    }

    this.updatePlayerPhysics(delta);
    if (!this.photoMode) {
      // Animate lagoon fish schools circling near shoreline
      const fishTime = now * 0.001;
      for (const school of this.fishSchools) {
        const ang = fishTime * school.speed + school.phase;
        const nx = school.centerX + Math.cos(ang) * school.radius;
        const nz = school.centerZ + Math.sin(ang) * school.radius;
        school.group.position.set(nx, this.currentWaterLevel - 0.14, nz);
        school.group.rotation.y = -ang + (school.speed > 0 ? Math.PI : 0);
      }
      const strafeIn =
        (this.isActionKey('right') ? 1 : 0) -
        (this.isActionKey('left') ? 1 : 0);
      if (this.fullBodyController && this.lastEuphoriaOut) {
        const inVoy = Boolean(this.latestState?.voyage && this.latestState.voyage.phase !== 'docked');
        this.fullBodyController.group.visible = !inVoy;
        if (!inVoy) {
          this.fullBodyController.update({
            dt: delta,
            playerX: this.playerPos.x,
            playerFootY: this.playerFootY,
            playerZ: this.playerPos.z,
            yaw: this.yaw,
            turnDeltaYaw: this.frameLookYawDelta,
            moveBlend: this.moveBlend,
            sprintBlend: this.isMoving && this.isSprinting ? 1 : 0,
            strafeInput: strafeIn,
            isGrounded: this.isGrounded,
            isSwimming: this.isSwimming,
            crouchBlend: this.crouchBlend,
            proneBlend: this.proneBlend,
            sitBlend: this.sitBlend,
            sleepBlend: this.sleepBlend,
            walkTimer: this.walkTimer,
            euphoria: this.lastEuphoriaOut,
            sampleTerrainHeight: (x, z) => this.getTerrainHeight(x, z),
            footRayTargets: this.footRayTargets,
          });
        }
      }
      this.footprintsFx?.update(delta);
      this.updatePart4WorldPhysics(delta);
      this.wildlife3D.updateAnimations(delta, (wx, wz) => this.getTerrainHeight(wx, wz));
      if (this.voyageDiorama && this.latestState) {
        updateVoyageDiorama(this.voyageDiorama, this.latestState, delta, now);
      }
      this.updateHoveredTarget();
      this.updateToolAnimation(delta, now);
      this.updateAtmosphereAndLights(now, delta);
      this.updateParticles(delta);
    } else {
      this.updateAtmosphereAndLights(now, 0);
    }

    if (this.waterMesh) {
      const usingShader =
        !this.isSoftwareGl && GRAPHICS_PRESETS[this.quality].waterShader;
      this.waterMesh.position.y = usingShader
        ? this.currentWaterLevel
        : this.currentWaterLevel + Math.sin(now * 0.0018) * 0.06;
    }

    const inVoyage = Boolean(this.latestState?.voyage && this.latestState.voyage.phase !== 'docked');
    this.reflectionFrameCounter += 1;
    if (this.reflectionFrameCounter % 3 === 0) {
      this.updateWaterReflection(inVoyage);
    }

    if (this.csm) {
      this.csm.update();
    }
    this.csmFrameCounter += 1;
    this.renderer.shadowMap.needsUpdate =
      this.renderer.shadowMap.enabled &&
      (this.fpsValue >= 54 || this.csmFrameCounter % 2 === 0);

    this.renderer.info.autoReset = false;
    this.renderer.info.reset();

    const renderStart = performance.now();
    const usePostFx =
      this.postFx && !this.isSoftwareGl && this.postFx.hasActivePasses();
    if (usePostFx && this.postFx) {
      this.postFx.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    const renderElapsed = performance.now() - renderStart;
    this.frameTimeMs = this.frameTimeMs * 0.85 + renderElapsed * 0.15;

    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.isDisposed) {
          this.frameId = requestAnimationFrame(this.tick);
        }
      });
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('focus', this.onWindowFocus);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    const canvas = this.renderer.domElement;
    if (canvas) {
      canvas.removeEventListener('click', this.onCanvasClick);
      canvas.removeEventListener('mousedown', this.onMouseDown);
      canvas.removeEventListener('contextmenu', this.onContextMenu);
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
    }
    this.postFx?.dispose();
    this.fpIKRig?.dispose();
    this.fullBodyController?.dispose();
    this.footprintsFx?.dispose();
    this.worldLifeFx?.dispose();
    this.foliageField?.dispose();
    this.terrainMatRecord?.material.dispose();
    this.csm?.remove();
    this.csm?.dispose();
    this.csm = null;
    this.waterReflectionRT?.dispose();
    this.forgeSmokeGeom?.dispose();
    this.forgeSmokeMat?.dispose();
    this.iblEnvRT?.dispose();
    this.pmremGenerator?.dispose();
    this.pbrBank.dispose();
    this.terrainDetailTex?.dispose();
    this.rainMat?.map?.dispose();
    this.oceanMaterials?.shaderMaterial.dispose();
    this.oceanMaterials?.fallbackMaterial.dispose();
    this.skyDome?.material.dispose();
    this.skyDome?.physicalSky.material.dispose();
    this.skyDome?.iblSky.material.dispose();
    this.renderer.dispose();
  }
}
