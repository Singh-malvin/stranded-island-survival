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
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { NEEDS, SAVE, TEMPERATURE, WORLD } from '../survival/config.ts';
import {
  GATHER_NODE_META,
  generateIslandNodes,
  isNodeAvailable,
} from '../survival/gathering.ts';
import { getEquipped } from '../survival/items.ts';
import { STATION_REPAIR_DEFS, STORY_CLUES } from '../survival/quests.ts';
import {
  BarrierGateDef,
  GatherNodeDef,
  PlacedCampfire,
  PlacedShelter,
  PlacedStructure,
  PlayerContext,
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
  classifyStepSurface,
  ISLAND_GATES,
  resolveWorldMovement,
  sampleIslandHeight,
  StepSurface,
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
  BoatSlipwayRecord,
  buildBoatSlipwayDock,
  buildVoyageDiorama,
  syncBoatBuildMeshes,
  updateVoyageDiorama,
  VOYAGE_STAGE_ORIGIN,
  VoyageSceneController,
} from './BoatAndVoyage3D.ts';
import {
  GRAPHICS_PRESETS,
  GraphicsQuality,
  loadGraphicsQuality,
  saveGraphicsQuality,
} from './GraphicsConfig.ts';
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

interface Particle3D {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
}

interface CampfireMeshRecord {
  data: PlacedCampfire;
  group: THREE.Group;
  flames: THREE.Mesh[];
  light: THREE.PointLight;
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

  // Lighting, Sky, Ocean Shaders & PostFX
  private sunLight: THREE.DirectionalLight;
  private sunShadowTarget: THREE.Object3D = new THREE.Object3D();
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;
  private torchLight: THREE.PointLight;
  private skyDome: SkyDomeHandle | null = null;
  private oceanMaterials: OceanWaterHandle | null = null;
  private terrainDetailTex: THREE.DataTexture | null = null;
  private atmosphereFx: AtmosphereFXRig | null = null;
  private postFx: PostFXPipeline | null = null;
  private moonMesh: THREE.Mesh | null = null;
  private starsPoints: THREE.Points | null = null;
  private starsMat: THREE.PointsMaterial | null = null;

  // Rain particles
  private rainPoints: THREE.Points | null = null;
  private rainMat: THREE.PointsMaterial | null = null;

  // Terrain & Water
  private terrainMesh: THREE.Mesh | null = null;
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
  private fpsValue: number = 0;
  private fpsFrames: number = 0;
  private fpsLastCheckMs: number = 0;
  private playerFootY: number = 0.8;
  private pitch: number = -0.06;
  private yaw: number = 0;
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
  private verticalVel: number = 0;
  private isGrounded: boolean = true;
  private peakAirY: number = 0;
  private landingDip: number = 0;
  private cameraFovCurrent: number = 68;
  private isMoving: boolean = false;
  private isSprinting: boolean = false;
  private isSwimming: boolean = false;
  private stepDistanceAccumulator: number = 0;
  private damageJoltTimer: number = 0;

  // Dual-Arm First-Person Hand & Tool Rig
  private toolRig: THREE.Group;
  private offhandRig: THREE.Group;
  private handMesh: THREE.Group;
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
  private onStepSound?: (surface: StepSurface) => void;
  private onJump?: () => void;
  private onFallImpact?: (fallMeters: number) => void;
  private onThunderStrike?: () => void;
  private lastThunderSoundAt: number = 0;

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
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.18, 780);
    this.camera.position.copy(this.playerPos);

    // Dual-Arm First-person Rigs
    this.toolRig = new THREE.Group();
    this.offhandRig = new THREE.Group();
    this.camera.add(this.toolRig);
    this.camera.add(this.offhandRig);

    const leftArm = this.createOffhandArm();
    this.offhandRig.add(leftArm);
    this.offhandRig.position.set(-0.36, -0.44, -0.58);
    this.offhandRig.rotation.set(0.18, 0.16, 0.08);

    this.torchLight = new THREE.PointLight(0xff8c2b, 0, 16, 1.45);
    this.torchLight.position.set(0.35, -0.1, -0.7);
    this.camera.add(this.torchLight);

    this.scene.add(this.camera);

    this.handMesh = this.createHandTool();
    this.axeMesh = this.createAxeTool();
    this.macheteMesh = this.createMacheteTool();
    this.pickaxeMesh = this.createPickaxeTool();
    this.spearMesh = this.createSpearTool();
    this.torchMesh = this.createTorchTool();
    this.lanternMesh = this.createLanternTool();

    this.toolRig.add(this.handMesh);
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
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && GRAPHICS_PRESETS[this.quality].shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.26;
    pmremGenerator.dispose();

    // Lighting rig
    this.ambientLight = new THREE.AmbientLight(0xc8dce8, 0.35);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x90cbe0, 0x2e4c34, 0.65);
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
    this.initWater();
    this.initCrashSiteAndSpring();
    this.landmarks = buildInteriorLandmarks(this.scene, (wx, wz) => this.getTerrainHeight(wx, wz));
    this.boatDock = buildBoatSlipwayDock(this.scene, (wx, wz) => this.getTerrainHeight(wx, wz));
    this.voyageDiorama = buildVoyageDiorama(this.scene);
    this.initAct1Barriers();
    this.initStoryClues();
    this.initGatherNodes();
    this.initFishSchools();
    this.wildlife3D = new Wildlife3DManager(this.scene);
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

    this.lastTime = performance.now();
    this.tick();
  }

  public getQuality(): GraphicsQuality {
    return this.quality;
  }

  public setQuality(nextQuality: GraphicsQuality) {
    this.quality = nextQuality;
    saveGraphicsQuality(nextQuality);

    const preset = GRAPHICS_PRESETS[nextQuality];
    const effectiveShadows = !this.isSoftwareGl && preset.shadows;
    const targetPr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, preset.pixelRatioCap);

    this.renderer.setPixelRatio(targetPr);
    this.renderer.shadowMap.enabled = effectiveShadows;
    this.sunLight.castShadow = effectiveShadows;

    if (
      this.sunLight.shadow.mapSize.width !== preset.shadowMapSize ||
      this.sunLight.shadow.mapSize.height !== preset.shadowMapSize
    ) {
      this.sunLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }

    if (this.waterMesh && this.oceanMaterials) {
      this.waterMesh.material =
        !this.isSoftwareGl && preset.waterShader
          ? this.oceanMaterials.shaderMaterial
          : this.oceanMaterials.fallbackMaterial;
    }

    if (this.postFx && !this.isSoftwareGl) {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.postFx.setSize(w, h, targetPr);
      this.postFx.configure(preset.bloom, preset.colorGrade);
    }

    if (!preset.fireShadow) {
      for (const fire of this.campfires3D.values()) {
        fire.light.castShadow = false;
      }
    }
  }

  private enableGroupShadows(obj: THREE.Object3D, cast: boolean = true, receive: boolean = true) {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.Material | undefined;
        if (!mat || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial || mat.transparent) {
          return;
        }
        mesh.castShadow = cast;
        mesh.receiveShadow = receive;
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
        child === this.moonMesh
      ) {
        return;
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.Material | undefined;
        if (!mat || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial || mat.transparent) {
          return;
        }
        // Keep first-person held arms/tools excluded from shadows
        let parent: THREE.Object3D | null = mesh;
        while (parent) {
          if (parent === this.camera || parent === this.toolRig || parent === this.offhandRig) {
            return;
          }
          parent = parent.parent;
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }

  public setCallbacks(callbacks: {
    onPrimaryAction?: (target: HoveredTargetInfo | null) => void;
    onOpenCampfireCraft?: () => void;
    onStepSound?: (surface: StepSurface) => void;
    onJump?: () => void;
    onFallImpact?: (fallMeters: number) => void;
    onThunderStrike?: () => void;
  }) {
    this.onPrimaryAction = callbacks.onPrimaryAction;
    this.onOpenCampfireCraft = callbacks.onOpenCampfireCraft;
    this.onStepSound = callbacks.onStepSound;
    this.onJump = callbacks.onJump;
    this.onFallImpact = callbacks.onFallImpact;
    this.onThunderStrike = callbacks.onThunderStrike;
  }

  public setUiBlocked(blocked: boolean) {
    this.isUiBlocked = blocked;
    if (blocked) {
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
  }

  public triggerDamageJolt() {
    this.damageJoltTimer = 0.38;
  }

  public triggerToolSwing(kind?: ToolKind | null) {
    this.isSwinging = true;
    this.swingAnimationTimer = 0;
    this.activeSwingKind = kind ?? this.currentEquippedTool;
  }

  public syncState(state: SurvivalState) {
    const prevState = this.latestState;
    this.latestState = state;

    // Update equipped tool visual
    const equipped = getEquipped(state.inventory, state.selectedSlot);
    const nextKind = equipped.def?.tool?.kind ?? null;
    if (nextKind !== this.currentEquippedTool) {
      this.equipAnimTimer = 1.0;
    }
    this.currentEquippedTool = nextKind;
    this.setEquippedToolMesh(nextKind);

    // Sync node visibility against state.nodes and clock.totalHours
    for (const [id, rec] of this.nodeMeshes.entries()) {
      const available = isNodeAvailable(id, state.nodes, state.clock.totalHours);
      rec.group.visible = available;
    }

    // Sync placed campfires, shelters, Stage 4 base structures, Stage 5 wildlife & station repairs
    this.syncCampfires(state.campfires ?? []);
    this.syncShelters(state.shelters ?? []);
    this.syncStructures(state.structures ?? []);
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
      },
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
    this.playerFootY = Math.max(0.35, this.getTerrainHeight(x, z));
    this.verticalVel = 0;
    this.isGrounded = true;
    this.peakAirY = this.playerFootY;
    this.landingDip = 0;
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
    const colors = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const h = sampleIslandHeight(x, z, this.islandRadius);
      posAttr.setY(i, h);
      this.terrainHeightMap[i] = h;

      // Earthy natural survival palette (wet sand -> dry sand -> mossy jungle -> ruins sandstone -> dark basalt peak)
      let r = 0.78;
      let g = 0.72;
      let b = 0.56;
      if (h < 0.25) {
        r = 0.55;
        g = 0.5;
        b = 0.39;
      } else if (h >= 1.55 && h < 6.8) {
        const blend = Math.min(1, (h - 1.55) / 2.2);
        // Slightly drier olive/ochre tone near Ancient Ruins on east ridge, darker moss near NW caves
        const eastBlend = x > 32 && z < -20 ? 0.35 : 0;
        r = 0.78 * (1 - blend) + (0.23 + eastBlend * 0.25) * blend;
        g = 0.72 * (1 - blend) + (0.44 + eastBlend * 0.08) * blend;
        b = 0.56 * (1 - blend) + 0.22 * blend;
      } else if (h >= 6.8) {
        r = 0.31;
        g = 0.31;
        b = 0.32;
      }

      const hash = (((Math.round(x) * 374761393) ^ (Math.round(z) * 668265263)) & 255) / 255;
      const jitter = (hash - 0.5) * 0.032;
      colors[i * 3] = Math.max(0, Math.min(1, r + jitter));
      colors[i * 3 + 1] = Math.max(0, Math.min(1, g + jitter * 0.9));
      colors[i * 3 + 2] = Math.max(0, Math.min(1, b + jitter * 0.7));
    }

    geom.computeVertexNormals();
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.terrainDetailTex = createTerrainDetailTexture(128);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: this.terrainDetailTex,
      bumpMap: this.terrainDetailTex,
      bumpScale: 0.22,
      roughness: 0.9,
      metalness: 0.02,
      flatShading: false,
    });
    this.terrainMesh = new THREE.Mesh(geom, mat);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  private initWater() {
    const waterSize = this.islandRadius * 5.2;
    const waterGeom = new THREE.PlaneGeometry(waterSize, waterSize, 56, 56);
    waterGeom.rotateX(-Math.PI / 2);

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
      color: 0x334155,
      transparent: true,
      opacity: 0.42,
    });
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.42 + i * 0.15, 7, 7), smokeMat);
      puff.position.set(-2.2, 1.2 + i * 1.1, 3.5);
      puff.userData.phase = i * 1.1;
      crashGroup.add(puff);
      this.crashSmokePuffs.push(puff);
    }

    const crashX = WORLD.WRECK_POS.x;
    const crashZ = WORLD.WRECK_POS.z;
    const crashY = this.getTerrainHeight(crashX, crashZ);
    crashGroup.position.set(crashX, crashY, crashZ);
    this.scene.add(crashGroup);

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

    springGroup.position.set(FRESHWATER_SPRING_POS.x, springY, FRESHWATER_SPRING_POS.z);
    this.scene.add(springGroup);
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
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x2d6a3e,
          roughness: 0.75,
          side: THREE.DoubleSide,
        });
        for (let s = 0; s < 5; s++) {
          const seg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24 - s * 0.028, 0.32 - s * 0.028, 1.25, 7),
            trunkMat
          );
          seg.position.set(Math.sin(s * 0.32) * 0.26, s * 1.12 + 0.6, 0);
          seg.rotation.z = -s * 0.07;
          group.add(seg);
        }
        const leafGeom = new THREE.ConeGeometry(0.68, 3.1, 5);
        leafGeom.rotateX(Math.PI / 2.3);
        for (let f = 0; f < 7; f++) {
          const leaf = new THREE.Mesh(leafGeom, leafMat);
          leaf.position.set(0.26, 5.5, 0);
          leaf.rotation.y = (f / 7) * Math.PI * 2;
          leaf.rotation.z = 0.52;
          group.add(leaf);
        }
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
  } {
    const group = new THREE.Group();
    const flames: THREE.Mesh[] = [];

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

    return { group, flames };
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
        const { group, flames } = this.buildCampfireMesh(false);
        const y = Math.max(0.2, this.getTerrainHeight(c.x, c.z));
        group.position.set(c.x, y, c.z);

        const light = new THREE.PointLight(0xff7b1c, 2.2, 16, 1.45);
        light.position.set(0, 0.85, 0);
        light.shadow.mapSize.set(256, 256);
        light.shadow.bias = -0.002;
        group.add(light);

        this.enableGroupShadows(group, true, true);
        this.scene.add(group);
        this.campfires3D.set(c.id, { data: c, group, flames, light });
      }
    }
  }

  private buildShelterMesh(isGhost: boolean = false): THREE.Group {
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

  private createOffhandArm(): THREE.Group {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd6a77a, roughness: 0.75 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88 });

    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.115, 0.24), sleeveMat);
    sleeve.position.set(0, 0.04, 0.18);
    sleeve.rotation.x = 0.28;
    group.add(sleeve);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.095, 0.26), skinMat);
    forearm.position.set(0, 0.1, 0.02);
    forearm.rotation.x = 0.22;
    group.add(forearm);

    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.085, 0.11), skinMat);
    fist.position.set(0.01, 0.14, -0.11);
    group.add(fist);
    return group;
  }

  private createHandTool(): THREE.Group {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd6a77a, roughness: 0.75 });
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.38), skinMat);
    forearm.position.set(0, 0.08, 0.1);
    forearm.rotation.x = 0.25;
    group.add(forearm);
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
    const color =
      soundType === 'mine' ? 0x64748b : soundType === 'chop' ? 0x9c6631 : 0x4d7c0f;
    const geom = new THREE.DodecahedronGeometry(0.08, 0);
    const mat = new THREE.MeshLambertMaterial({ color });

    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(geom, mat);
      p.position.copy(worldPos);
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 3.2,
          1.4 + Math.random() * 2.6,
          (Math.random() - 0.5) * 3.2
        ),
        lifetime: 0,
        maxLifetime: 0.55 + Math.random() * 0.35,
      });
    }
  }

  private spawnStepDust(isWater: boolean) {
    const geom = new THREE.DodecahedronGeometry(isWater ? 0.055 : 0.048, 0);
    const mat = new THREE.MeshLambertMaterial({ color: isWater ? 0xbae6fd : 0xb8a382 });
    const count = isWater ? 5 : 3;
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
      return;
    }

    const needs = this.latestState?.needs;
    const exhausted = (needs?.stamina ?? 100) < 12;
    const wantsSprint = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    this.isSprinting = wantsSprint && !exhausted && (needs?.stamina ?? 0) > 2;

    const terrainY = this.getTerrainHeight(this.playerPos.x, this.playerPos.z);
    this.isSwimming = terrainY < WORLD.WATER_LEVEL - 0.35;

    let moveSpeed = this.isSprinting ? 9.6 : 5.6;
    if (exhausted) moveSpeed *= 0.68;
    if (this.isSwimming) moveSpeed *= 0.65;

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    _moveDir.set(0, 0, 0);
    if (this.keys['KeyW'] || this.keys['ArrowUp']) _moveDir.add(_forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) _moveDir.sub(_forward);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) _moveDir.add(_right);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) _moveDir.sub(_right);

    this.isMoving = _moveDir.lengthSq() > 0;

    if (this.isMoving) {
      _moveDir.normalize();
      const stepDist = moveSpeed * delta;
      const desiredX = this.playerPos.x + _moveDir.x * stepDist;
      const desiredZ = this.playerPos.z + _moveDir.z * stepDist;
      const resolved = resolveWorldMovement(
        this.playerPos.x,
        this.playerPos.z,
        desiredX,
        desiredZ,
        this.latestState?.unlockedGates ?? [],
        WORLD.WATER_LEVEL
      );
      this.playerPos.x = resolved.x;
      this.playerPos.z = resolved.z;
      if (resolved.blockedByGate) {
        this.bumpedGate = resolved.blockedByGate;
      }

      this.walkTimer += delta * (this.isSprinting ? 13.5 : this.isSwimming ? 6.5 : 8.8);
      if (this.isGrounded) {
        this.stepDistanceAccumulator += stepDist;
        if (this.stepDistanceAccumulator > 2.3) {
          this.stepDistanceAccumulator = 0;
          this.spawnStepDust(this.isSwimming);
          const surface = classifyStepSurface(
            this.playerPos.x,
            this.playerPos.z,
            terrainY,
            this.isSwimming,
            false
          );
          this.onStepSound?.(surface);
        }
      }
    }

    // Clamp to outer reef boundary
    const radialDist = Math.hypot(this.playerPos.x, this.playerPos.z);
    if (radialDist > this.islandRadius * 0.9) {
      const ang = Math.atan2(this.playerPos.z, this.playerPos.x);
      this.playerPos.x = Math.cos(ang) * (this.islandRadius * 0.9);
      this.playerPos.z = Math.sin(ang) * (this.islandRadius * 0.9);
    }

    // Smooth locomotion blend weights & athletic strafe roll + dynamic FOV kick
    this.moveBlend = THREE.MathUtils.damp(
      this.moveBlend,
      this.isMoving ? (this.isSprinting ? 1.0 : 0.65) : 0,
      10,
      delta
    );
    this.swimBlend = THREE.MathUtils.damp(this.swimBlend, this.isSwimming ? 1 : 0, 8, delta);

    const strafeInput =
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
      (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);
    this.strafeLean = THREE.MathUtils.damp(
      this.strafeLean,
      -strafeInput * (this.isSprinting ? 0.032 : 0.016),
      10,
      delta
    );

    const targetFov = this.isSwimming
      ? 66.5
      : 68 + (this.isMoving && this.isSprinting ? 5.5 : this.isMoving ? 1.2 : 0);
    this.cameraFovCurrent = THREE.MathUtils.damp(this.cameraFovCurrent, targetFov, 9, delta);
    if (Math.abs(this.cameraFovCurrent - this.camera.fov) > 0.05) {
      this.camera.fov = this.cameraFovCurrent;
      this.camera.updateProjectionMatrix();
    }

    // Vertical physics: jump arc, gravity & fall impact feedback
    const updatedGroundY = this.getTerrainHeight(this.playerPos.x, this.playerPos.z);
    const targetFootY = Math.max(WORLD.WATER_LEVEL - 0.55, updatedGroundY);

    if (!this.isGrounded) {
      this.verticalVel -= 18.5 * delta;
      this.playerFootY += this.verticalVel * delta;
      this.peakAirY = Math.max(this.peakAirY, this.playerFootY);
      if (this.playerFootY <= targetFootY) {
        const drop = this.peakAirY - targetFootY;
        this.playerFootY = targetFootY;
        this.verticalVel = 0;
        this.isGrounded = true;
        this.landingDip = Math.min(0.28, Math.max(0.05, drop * 0.075));
        this.spawnStepDust(this.isSwimming);
        if (drop > NEEDS.FALL_SAFE_HEIGHT_M && !this.isSwimming) {
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

    this.landingDip = THREE.MathUtils.damp(this.landingDip, 0, 12, delta);

    const airBobScale = this.isGrounded ? 1 : 0.12;
    const headBobY =
      Math.sin(this.walkTimer) * (this.isSprinting ? 0.085 : 0.048) * this.moveBlend * airBobScale -
      this.landingDip;
    const headBobSide =
      Math.cos(this.walkTimer * 0.5) * 0.032 * this.moveBlend * airBobScale;

    // Exhaustion or cold shiver camera sway
    const isCold = (needs?.temperature ?? 37) < TEMPERATURE.COLD_FEEDBACK_C;
    const swayAmp = (exhausted ? 0.022 : 0) + (isCold ? 0.012 : 0);
    const swayRoll = swayAmp > 0 ? Math.sin(performance.now() * 0.004) * swayAmp : 0;

    // Damage jolt
    let joltPitch = 0;
    if (this.damageJoltTimer > 0) {
      this.damageJoltTimer = Math.max(0, this.damageJoltTimer - delta);
      joltPitch = Math.sin(this.damageJoltTimer * 24) * 0.08 * (this.damageJoltTimer / 0.38);
    }

    this.playerPos.y = this.playerFootY + 1.68;
    this.camera.position.set(
      this.playerPos.x + _right.x * headBobSide,
      this.playerPos.y + headBobY,
      this.playerPos.z + _right.z * headBobSide
    );

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + joltPitch;
    this.camera.rotation.z = swayRoll + this.strafeLean;
  }

  private updateToolAnimation(delta: number, nowMs: number) {
    if (this.isSwinging) {
      this.swingAnimationTimer += delta * 6.2;
      if (this.swingAnimationTimer >= Math.PI) {
        this.isSwinging = false;
        this.swingAnimationTimer = 0;
      }
    }
    this.equipAnimTimer = Math.max(0, this.equipAnimTimer - delta * 4.5);

    const swingSin = Math.sin(this.swingAnimationTimer);
    const idleBobY = Math.sin(nowMs * 0.0025) * 0.012;
    const sprintFactor = this.isMoving && this.isSprinting ? 1 : 0;

    // Rhythmic locomotion stride for hands
    const strideY = Math.abs(Math.sin(this.walkTimer)) * 0.035 * this.moveBlend;
    const strideX = Math.cos(this.walkTimer * 0.5) * 0.03 * this.moveBlend;
    const drawOffset = this.equipAnimTimer * 0.24;

    // Swim breaststroke paddle offsets
    const swimSweep = Math.sin(this.walkTimer * 0.85) * 0.14 * this.swimBlend;
    const swimOut = (0.5 + 0.5 * Math.cos(this.walkTimer * 0.85)) * 0.12 * this.swimBlend;

    // Action-specific right-hand swing curves (thrust vs slash vs chop)
    let actX = -swingSin * 0.12;
    let actY = -swingSin * 0.16;
    let actZ = swingSin * 0.14;
    let rotX = swingSin * 1.15;
    let rotY = -swingSin * 0.38;
    let rotZ = -swingSin * 0.25;

    if (this.activeSwingKind === 'spear') {
      actX = -swingSin * 0.04;
      actY = swingSin * 0.03;
      actZ = -swingSin * 0.44;
      rotX = -swingSin * 0.22;
      rotY = swingSin * 0.08;
      rotZ = 0;
    } else if (this.activeSwingKind === 'machete') {
      actX = -swingSin * 0.24;
      actY = -swingSin * 0.12;
      actZ = -swingSin * 0.18;
      rotX = swingSin * 0.95;
      rotY = -swingSin * 0.72;
      rotZ = -swingSin * 0.55;
    }

    this.toolRig.position.set(
      0.36 + strideX + swimOut - sprintFactor * 0.06 + actX,
      -0.32 - strideY - drawOffset + idleBobY - sprintFactor * 0.05 + actY,
      -0.62 + swimSweep + sprintFactor * 0.06 + actZ
    );
    this.toolRig.rotation.set(
      0.08 + sprintFactor * 0.22 - this.swimBlend * 0.3 + rotX,
      -0.15 + sprintFactor * 0.32 + swimOut * 1.1 + rotY,
      -0.05 - sprintFactor * 0.18 + rotZ
    );

    // Opposite-phase left offhand arm pump + swim stroke
    const oppStride = Math.sin(this.walkTimer + Math.PI) * 0.055 * this.moveBlend;
    this.offhandRig.position.set(
      -0.36 - strideX * 0.85 - swimOut,
      -0.44 - Math.abs(oppStride) * 0.65 + idleBobY * 0.8 - (1 - this.moveBlend) * 0.04,
      -0.58 - oppStride * 1.35 + swimSweep
    );
    this.offhandRig.rotation.set(
      0.18 + oppStride * 2.4 - this.swimBlend * 0.42 - swingSin * 0.18,
      0.16 - swimOut * 1.15,
      0.08 + sprintFactor * 0.15
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
    const dayHorizon = new THREE.Color(weather.rain > 0 ? 0x52677a : 0x7cb6d2);
    const dayZenith = new THREE.Color(weather.rain > 0 ? 0x344658 : 0x266596);
    const goldenHorizon = new THREE.Color(0xe07842);
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
      this.sunLight.intensity = (1.0 + t * 0.35) * (1 - weather.rain * 0.45);
      this.sunLight.color.setHex(0xfff1d6);
      this.ambientLight.intensity = 0.32 + t * 0.08;
      this.hemiLight.color.setHex(0x9be2fa);
      this.hemiLight.groundColor.setHex(0x2d4c33);
    } else if (sunElev > -0.18) {
      const t = THREE.MathUtils.clamp((sunElev + 0.18) / 0.4, 0, 1);
      skyColor.lerpColors(nightHorizon, goldenHorizon, t);
      zenithColor.lerpColors(nightZenith, goldenZenith, t);
      this.sunLight.intensity = 0.24 + t * 0.78;
      this.sunLight.color.setHex(0xff9e44);
      this.ambientLight.intensity = 0.16 + t * 0.18;
      this.hemiLight.color.setHex(0xd9824c);
      this.hemiLight.groundColor.setHex(0x1a2920);
      nightFactor = 1 - t;
    } else {
      skyColor.copy(nightHorizon);
      zenithColor.copy(nightZenith);
      this.sunLight.intensity = 0.24;
      this.sunLight.color.setHex(0x6088c2);
      this.ambientLight.intensity = 0.15;
      this.hemiLight.color.setHex(0x182b4d);
      this.hemiLight.groundColor.setHex(0x091220);
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
          preset.fireflies
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
      this.scene.fog.density = 0.0024 + weather.rain * 0.005 + caveFactor * 0.015;
    }
    this.scene.environmentIntensity = 0.26 - nightFactor * 0.14 - stormWeight * 0.06;

    // Update Atmospheric Sky Dome & animated Ocean Water uniforms
    const sunDirNorm = _toTarget.set(sunX, Math.max(8, sunY), 35).normalize();
    if (this.skyDome) {
      this.skyDome.mesh.position.copy(this.camera.position);
      const u = this.skyDome.material.uniforms;
      u.uZenithColor.value.copy(zenithColor);
      u.uHorizonColor.value.copy(skyColor);
      u.uSunDir.value.copy(sunDirNorm);
      u.uSunColor.value.copy(this.sunLight.color);
      u.uStorm.value = stormWeight;
      u.uNight.value = nightFactor;
      u.uLightning.value = lightningFlash;
    }

    if (this.oceanMaterials) {
      const wu = this.oceanMaterials.shaderMaterial.uniforms;
      wu.uTime.value = tSec;
      wu.uSunDir.value.copy(sunDirNorm);
      wu.uSunColor.value.copy(this.sunLight.color);
      wu.uSkyHorizon.value.copy(skyColor);
      wu.uFogColor.value.copy(skyColor);
      wu.uFogDensity.value =
        this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.density : 0.0052;
      wu.uWind.value = weather.wind;
      wu.uStorm.value = stormWeight;
      wu.uNight.value = nightFactor;
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
    const windAmp = 0.014 + weather.wind * 0.036;
    for (let i = 0; i < this.palmWindMeshes.length; i++) {
      const m = this.palmWindMeshes[i];
      if (!m.visible) continue;
      const baseRotZ = (m.userData.baseRotZ as number) || 0;
      const phase = (m.userData.windPhase as number) || 0;
      m.rotation.z = baseRotZ + Math.sin(tSec * 1.45 + phase) * windAmp;
    }

    // Flickering campfires (with High-quality closest campfire shadow casting) & forge lights
    let closestFireId: string | null = null;
    let closestFireDistSq = 28 * 28;
    const allowFireShadow = !this.isSoftwareGl && preset.fireShadow && !inVoyage;
    for (const [id, fire] of this.campfires3D.entries()) {
      fire.light.intensity = 2.1 + Math.sin(tSec * 13 + fire.data.x) * 0.35;
      for (let i = 0; i < fire.flames.length; i++) {
        const flame = fire.flames[i];
        const s = 0.85 + Math.sin(tSec * 15 + i * 2.1) * 0.18;
        flame.scale.set(1, s, 1);
      }
      if (allowFireShadow) {
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
      if (rec.forgeLight) {
        rec.forgeLight.intensity = 1.65 + Math.sin(tSec * 10 + rec.data.z) * 0.3;
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

    // PostFX environmental mood grading uniforms
    if (this.postFx && !this.isSoftwareGl) {
      const temp = this.latestState?.needs.temperature ?? 37;
      const coldFactor = THREE.MathUtils.clamp((36.2 - temp) / 2.0, 0, 1);
      const hp = this.latestState?.needs.health ?? 100;
      const lowHpFactor = THREE.MathUtils.clamp((35 - hp) / 35, 0, 1);
      const hurtFactor = Math.max(lowHpFactor * 0.7, this.damageJoltTimer / 0.38);
      this.postFx.updateUniforms({
        nightFactor,
        coldFactor,
        hurtFactor,
        stormFactor: stormWeight,
        tSec,
      });
    }

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
        p.velocity.y -= delta * 9.8;
        p.mesh.position.addScaledVector(p.velocity, delta);
        const s = 1 - p.lifetime / p.maxLifetime;
        p.mesh.scale.setScalar(s);
        alive.push(p);
      } else {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
      }
    }
    this.particles = alive;
  }

  // ---------------------------------------------------------------------------
  // INPUT EVENTS & RENDER LOOP
  // ---------------------------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isUiBlocked) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys[e.code] = true;

    if (e.code === 'Space') {
      e.preventDefault();
      const stam = this.latestState?.needs.stamina ?? 100;
      if (this.isGrounded && !this.isSwimming && stam >= NEEDS.STAMINA_JUMP) {
        this.verticalVel = 6.2;
        this.isGrounded = false;
        this.peakAirY = this.playerFootY;
        this.onJump?.();
      }
      return;
    }

    if (e.code === 'KeyE') {
      if (this.hoveredTarget?.kind === 'campfire') {
        this.onOpenCampfireCraft?.();
      } else {
        this.onPrimaryAction?.(this.hoveredTarget);
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
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
      try {
        canvas.requestPointerLock?.();
      } catch {
        // ignore
      }
    }

    if (this.hoveredTarget) {
      if (this.hoveredTarget.kind === 'campfire') {
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
    if (this.isUiBlocked) return;

    if (this.isPointerLocked) {
      const mx = THREE.MathUtils.clamp(e.movementX, -80, 80);
      const my = THREE.MathUtils.clamp(e.movementY, -80, 80);
      this.yaw -= mx * 0.0024;
      this.pitch -= my * 0.0024;
      this.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch));
    } else if (this.isDragging) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.yaw -= dx * 0.0035;
      this.pitch -= dy * 0.0035;
      this.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch));
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.isUiBlocked) return;
    if (e.button === 0) {
      this.pointerDownClient = { x: e.clientX, y: e.clientY };
      if (!this.isPointerLocked) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
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
    if (this.postFx && !this.isSoftwareGl) {
      const pr = Math.min(window.devicePixelRatio, GRAPHICS_PRESETS[this.quality].pixelRatioCap);
      this.postFx.setSize(w, h, pr);
    }
  };

  private setupEventListeners() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', this.onCanvasClick);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
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

  private tick = () => {
    if (this.isDisposed) return;

    const now = performance.now();
    const delta = Math.min(0.08, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.fpsFrames += 1;
    if (now - this.fpsLastCheckMs >= 500) {
      this.fpsValue = Math.round((this.fpsFrames * 1000) / Math.max(1, now - this.fpsLastCheckMs));
      this.fpsFrames = 0;
      this.fpsLastCheckMs = now;
    }

    for (const rec of this.clueMeshes.values()) {
      if (rec.beacon.visible) {
        rec.beacon.rotation.y += delta * 2.2;
        rec.beacon.position.y = 1.85 + Math.sin(now * 0.004) * 0.14;
      }
    }

    // Animate lagoon fish schools circling near shoreline
    const fishTime = now * 0.001;
    for (const school of this.fishSchools) {
      const ang = fishTime * school.speed + school.phase;
      const nx = school.centerX + Math.cos(ang) * school.radius;
      const nz = school.centerZ + Math.sin(ang) * school.radius;
      school.group.position.set(nx, WORLD.WATER_LEVEL - 0.14, nz);
      school.group.rotation.y = -ang + (school.speed > 0 ? Math.PI : 0);
    }

    this.updatePlayerPhysics(delta);
    this.wildlife3D.updateAnimations(delta, (wx, wz) => this.getTerrainHeight(wx, wz));
    if (this.voyageDiorama && this.latestState) {
      updateVoyageDiorama(this.voyageDiorama, this.latestState, delta, now);
    }
    this.updateHoveredTarget();
    this.updateToolAnimation(delta, now);
    this.updateAtmosphereAndLights(now, delta);
    this.updateParticles(delta);

    if (this.waterMesh) {
      const usingShader =
        !this.isSoftwareGl && GRAPHICS_PRESETS[this.quality].waterShader;
      this.waterMesh.position.y = usingShader
        ? WORLD.WATER_LEVEL
        : WORLD.WATER_LEVEL + Math.sin(now * 0.0018) * 0.06;
    }

    const usePostFx =
      this.postFx &&
      !this.isSoftwareGl &&
      (GRAPHICS_PRESETS[this.quality].bloom || GRAPHICS_PRESETS[this.quality].colorGrade);
    if (usePostFx && this.postFx) {
      this.postFx.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

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
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);

    const canvas = this.renderer.domElement;
    if (canvas) {
      canvas.removeEventListener('click', this.onCanvasClick);
      canvas.removeEventListener('mousedown', this.onMouseDown);
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
    }
    this.postFx?.dispose();
    this.terrainDetailTex?.dispose();
    this.rainMat?.map?.dispose();
    this.oceanMaterials?.shaderMaterial.dispose();
    this.oceanMaterials?.fallbackMaterial.dispose();
    this.skyDome?.material.dispose();
    this.renderer.dispose();
  }
}
