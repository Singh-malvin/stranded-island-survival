/**
 * 3D First-Person Island Resort Engine using Three.js
 * Features:
 * - Dynamic Procedural Island Terrain with Land Reclamation (Island Expansion)
 * - Studio PBR Environment Reflection & Software-WebGL Pacing
 * - Walkable Multi-Story Structures & Staircases (All the way to the 5th-floor Penthouse Sky Pool!)
 * - Furnished Bedrooms, Open Kitchens with Stoves & Rising Steam, and Snap-to-End Resort Paths
 * - Role-Based Staff AI (Chefs cooking at stoves, Mixologists at bars, Housekeepers in bedrooms)
 * - First-Person Head Bobbing, Tool Sway, and Real Mining/Chopping 3D Animations
 * - Animated Wandering Guests & Visual 3D Cargo Delivery Crates
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BUILDING_CATALOG, PathObstacle, planPathSegments } from './tycoonRules.ts';
import { PlacedBuilding, StaffRoster } from './tycoonTypes.ts';
import { buildResortStructure3D, BuiltStructureResult } from './ResortBuildings3D.ts';

export interface CargoCrate3D {
  id: string;
  resource: string;
  amount: number;
  position: THREE.Vector3;
  mesh: THREE.Group;
}

export interface Staff3D {
  id: string;
  role: keyof StaffRoster;
  name: string;
  group: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  targetPos: THREE.Vector3;
  stationYaw: number | null;
  state: 'working' | 'patrol';
  idleTimer: number;
  walkCycle: number;
}

export interface HarvestNode3D {
  id: string;
  type: 'driftwood' | 'palm' | 'rock' | 'shells';
  position: THREE.Vector3;
  mesh: THREE.Group;
  remaining: number;
  initialScale: THREE.Vector3;
}

export interface Guest3D {
  id: string;
  name: string;
  tier: string;
  group: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  targetPos: THREE.Vector3;
  waypoints: THREE.Vector3[];
  state: 'arriving' | 'walk' | 'idle' | 'departing';
  idleTimer: number;
  walkCycle: number;
}

export interface Particle3D {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
}

interface PlacedStructureRecord {
  building: PlacedBuilding;
  built: BuiltStructureResult;
}

// Reusable scratch vectors outside frame loop for zero GC churn
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _euler = new THREE.Euler();

export class ResortScene3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private isSoftwareGl: boolean = false;
  private isDisposed: boolean = false;
  private frameId: number = 0;

  // Lighting & Celestial Sky
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;
  private nightFillLight: THREE.PointLight;
  private moonMesh: THREE.Mesh | null = null;
  private starsPoints: THREE.Points | null = null;
  private starsMat: THREE.PointsMaterial | null = null;

  // Environment & Terrain
  private terrainMesh: THREE.Mesh | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private terrainHeightMap: Float32Array;
  private terrainResolution: number = 72;
  private islandRadius: number = 75;

  // Placed Buildings, Staff, Guests & Nodes
  private placedStructures: Map<string, PlacedStructureRecord> = new Map();
  private placedBuildingList: PlacedBuilding[] = [];
  private harvestNodes: HarvestNode3D[] = [];
  private decorativeFloraMeshes: THREE.Group[] = [];
  private guests3D: Map<string, Guest3D> = new Map();
  private departingGuests3D: Guest3D[] = [];
  private ferryArrivalTimer: number = 0;
  private staff3D: Map<string, Staff3D> = new Map();
  public cargoCrates: CargoCrate3D[] = [];
  private particles: Particle3D[] = [];

  // First-Person Player & Physics
  private playerPos: THREE.Vector3 = new THREE.Vector3(0, 2.5, 20);
  private playerFootY: number = 0.8;
  private pitch: number = 0;
  private yaw: number = 0;
  private isPointerLocked: boolean = false;
  private isUiBlocked: boolean = false;
  private keys: Record<string, boolean> = {};
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private pointerDownClient: { x: number; y: number } = { x: 0, y: 0 };
  private pointerNDC: THREE.Vector2 = new THREE.Vector2(0, 0);
  private hasPointerMoved: boolean = false;

  // Walking & Head Bob
  private walkTimer: number = 0;
  private isMoving: boolean = false;
  private stepDistanceAccumulator: number = 0;

  // First-Person Hand & Tool Rig
  private toolRig: THREE.Group;
  private pickaxeMesh: THREE.Group;
  private axeMesh: THREE.Group;
  private netMesh: THREE.Group;
  private swingAnimationTimer: number = 0;
  private isSwinging: boolean = false;

  // Placement mode & Start-to-End Path Mapping
  private activeBuildDefId: string | null = null;
  private ghostGroup: THREE.Group | null = null;
  private ghostRotation: number = 0;
  private ghostPos: THREE.Vector3 = new THREE.Vector3();
  private pathStartPoint: THREE.Vector3 | null = null;
  private pathStartMarker: THREE.Group | null = null;
  private pathPreviewGroup: THREE.Group | null = null;
  private pathPreviewPool: THREE.Group[] = [];
  private plannedPathSegments: Array<{ x: number; y: number; z: number; rotation: number }> = [];
  private maxAffordablePathSegments: number = 24;
  private lastNotifiedPathStart: boolean = false;
  private lastNotifiedPathCount: number = -1;

  // Raycasting & Interaction
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private centerScreen: THREE.Vector2 = new THREE.Vector2(0, 0);
  public hoveredNode: HarvestNode3D | null = null;
  public hoveredCargoCrate: CargoCrate3D | null = null;

  // Callbacks
  private onHarvestCallback?: (type: 'driftwood' | 'palm' | 'rock' | 'shells', pos: THREE.Vector3) => void;
  private onPlaceBuildingCallback?: (defId: string, x: number, y: number, z: number, rotation: number) => void;
  private onPlacePathChainCallback?: (
    defId: string,
    segments: Array<{ x: number; y: number; z: number; rotation: number }>
  ) => void;
  private onPathStateChangeCallback?: (info: { startSet: boolean; segmentCount: number }) => void;
  private onBuildingsReseatedCallback?: (buildings: PlacedBuilding[]) => void;
  private onOpenCargoCallback?: (crateId: string, resource: string, amount: number) => void;
  private onStepSound?: () => void;

  private lastTime: number = 0;

  constructor(container: HTMLElement, initialRadius: number = 75) {
    this.container = container;
    this.islandRadius = initialRadius;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0052);

    // Detect software WebGL (SwiftShader / llvmpipe / WARP)
    this.isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
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

    // Setup Camera
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.2, 600);
    this.camera.position.copy(this.playerPos);

    // First-person Tool Rig attached directly to camera
    this.toolRig = new THREE.Group();
    this.camera.add(this.toolRig);
    this.scene.add(this.camera);

    // Create 3D Tools (Pickaxe, Axe, Net)
    this.pickaxeMesh = this.createPickaxeTool();
    this.axeMesh = this.createAxeTool();
    this.netMesh = this.createNetTool();

    this.toolRig.add(this.pickaxeMesh);
    this.toolRig.add(this.axeMesh);
    this.toolRig.add(this.netMesh);
    this.setToolVisibility('pickaxe');

    this.toolRig.position.set(0.38, -0.32, -0.65);
    this.toolRig.rotation.set(0.1, -0.15, -0.05);

    // Renderer configured cleanly for GPU and Software WebGL
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    // Studio Environment Reflection for metallic gold, stainless stoves & glass penthouse
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Warm/Cool Lighting Rig
    this.ambientLight = new THREE.AmbientLight(0xdff0f8, 0.45);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x9be2fa, 0x3b6e4c, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.25);
    this.sunLight.position.set(55, 75, 40);
    this.scene.add(this.sunLight);

    // Subtle warm lantern fill at night around player/island
    this.nightFillLight = new THREE.PointLight(0xfbbf24, 0, 28, 1.6);
    this.scene.add(this.nightFillLight);

    // Celestial Stars & Moon for clear night atmosphere
    this.initCelestialSky();

    // Island Terrain & Water
    this.terrainHeightMap = new Float32Array(this.terrainResolution * this.terrainResolution);
    this.initTerrain();
    this.initWater();
    this.initNaturalFloraAndRocks();
    this.snapPlayerToGround(0, 20);

    // Event Listeners
    this.setupEventListeners();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Start Paced Loop
    this.lastTime = performance.now();
    this.tick();
  }

  private initCelestialSky() {
    const starCount = 320;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.15 + Math.random() * 0.85);
      const r = 240;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 1.6,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    this.starsPoints = new THREE.Points(starGeom, this.starsMat);
    this.scene.add(this.starsPoints);

    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6.5, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfef9c3, fog: false })
    );
    this.moonMesh.visible = false;
    this.scene.add(this.moonMesh);
  }

  public setCallbacks(callbacks: {
    onHarvest?: (type: 'driftwood' | 'palm' | 'rock' | 'shells', pos: THREE.Vector3) => void;
    onPlaceBuilding?: (defId: string, x: number, y: number, z: number, rotation: number) => void;
    onPlacePathChain?: (
      defId: string,
      segments: Array<{ x: number; y: number; z: number; rotation: number }>
    ) => void;
    onPathStateChange?: (info: { startSet: boolean; segmentCount: number }) => void;
    onBuildingsReseated?: (buildings: PlacedBuilding[]) => void;
    onOpenCargo?: (crateId: string, resource: string, amount: number) => void;
    onStepSound?: () => void;
  }) {
    this.onHarvestCallback = callbacks.onHarvest;
    this.onPlaceBuildingCallback = callbacks.onPlaceBuilding;
    this.onPlacePathChainCallback = callbacks.onPlacePathChain;
    this.onPathStateChangeCallback = callbacks.onPathStateChange;
    this.onBuildingsReseatedCallback = callbacks.onBuildingsReseated;
    this.onOpenCargoCallback = callbacks.onOpenCargo;
    this.onStepSound = callbacks.onStepSound;
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
          // ignore browser pointer lock exit error
        }
      }
    }
  }

  // --- Dynamic Floating Text Billboard Generator ---
  public createTextSprite(text: string, bgColor: string, textColor: string = '#ffffff'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      const x = 4, y = 6, w = 248, h = 52, r = 16;
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.0, 0.5, 1);
    return sprite;
  }

  // --- First-Person Tool Builders ---

  private createPickaxeTool(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.75 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.35, metalness: 0.85 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.65, 8), woodMat);
    shaft.position.set(0, 0.22, 0);
    shaft.rotation.z = 0.15;
    group.add(shaft);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.06), ironMat);
    head.position.set(0.04, 0.52, 0);
    head.rotation.z = -0.25;
    group.add(head);

    const spike1 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), ironMat);
    spike1.position.set(-0.13, 0.54, 0);
    spike1.rotation.z = Math.PI / 1.7;
    group.add(spike1);

    const spike2 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), ironMat);
    spike2.position.set(0.21, 0.48, 0);
    spike2.rotation.z = -Math.PI / 1.7;
    group.add(spike2);

    return group;
  }

  private createAxeTool(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c4f2e, roughness: 0.75 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.28, metalness: 0.85 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.62, 8), woodMat);
    shaft.position.set(0, 0.2, 0);
    shaft.rotation.z = 0.12;
    group.add(shaft);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.04), steelMat);
    blade.position.set(-0.06, 0.48, 0);
    blade.rotation.z = 0.15;
    group.add(blade);

    return group;
  }

  private createNetTool(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x926c48, roughness: 0.75 });
    const netMat = new THREE.MeshBasicMaterial({ color: 0xd4d4d8, wireframe: true });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.55, 6), woodMat);
    pole.position.set(0, 0.18, 0);
    group.add(pole);

    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 12), woodMat);
    hoop.position.set(0, 0.46, 0);
    group.add(hoop);

    const bag = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 8), netMat);
    bag.position.set(0, 0.38, 0);
    bag.rotation.x = Math.PI;
    group.add(bag);

    return group;
  }

  private setToolVisibility(type: 'pickaxe' | 'axe' | 'net') {
    this.pickaxeMesh.visible = type === 'pickaxe';
    this.axeMesh.visible = type === 'axe';
    this.netMesh.visible = type === 'net';
  }

  // --- Terrain Height & Walkable Structure Floors/Stairs ---

  public getTerrainHeight(worldX: number, worldZ: number): number {
    const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
    if (dist > this.islandRadius + 20) return -3.0;

    const normX = (worldX / (this.islandRadius * 2) + 0.5) * (this.terrainResolution - 1);
    const normZ = (worldZ / (this.islandRadius * 2) + 0.5) * (this.terrainResolution - 1);

    const gx = Math.floor(normX);
    const gz = Math.floor(normZ);

    if (gx < 0 || gx >= this.terrainResolution - 1 || gz < 0 || gz >= this.terrainResolution - 1) {
      return -1.5;
    }

    const fx = normX - gx;
    const fz = normZ - gz;

    const h00 = this.terrainHeightMap[gz * this.terrainResolution + gx];
    const h10 = this.terrainHeightMap[gz * this.terrainResolution + (gx + 1)];
    const h01 = this.terrainHeightMap[(gz + 1) * this.terrainResolution + gx];
    const h11 = this.terrainHeightMap[(gz + 1) * this.terrainResolution + (gx + 1)];

    return (1 - fx) * (1 - fz) * h00 + fx * (1 - fz) * h10 + (1 - fx) * fz * h01 + fx * fz * h11;
  }

  private snapPlayerToGround(x: number, z: number) {
    this.playerPos.x = x;
    this.playerPos.z = z;
    this.playerFootY = Math.max(0.4, this.getTerrainHeight(x, z));
    this.playerPos.y = this.playerFootY + 1.7;
    this.camera.position.copy(this.playerPos);
  }

  private getWalkableSupportHeight(worldX: number, worldZ: number, currentFootY: number): number {
    const terrainY = Math.max(0.3, this.getTerrainHeight(worldX, worldZ));
    let bestY = terrainY;

    for (const rec of this.placedStructures.values()) {
      const { building, built } = rec;
      if (built.walkableZones.length === 0) continue;

      const dx = worldX - building.x;
      const dz = worldZ - building.z;
      const cosR = Math.cos(-building.rotation);
      const sinR = Math.sin(-building.rotation);
      const lx = dx * cosR + dz * sinR;
      const lz = -dx * sinR + dz * cosR;

      for (const zone of built.walkableZones) {
        if (lx >= zone.minX && lx <= zone.maxX && lz >= zone.minZ && lz <= zone.maxZ) {
          let localY = zone.yStart;
          if (zone.slopeAxis === 'z') {
            const t = THREE.MathUtils.clamp((lz - zone.minZ) / Math.max(0.001, zone.maxZ - zone.minZ), 0, 1);
            localY = zone.yStart + t * (zone.yEnd - zone.yStart);
          } else if (zone.slopeAxis === 'x') {
            const t = THREE.MathUtils.clamp((lx - zone.minX) / Math.max(0.001, zone.maxX - zone.minX), 0, 1);
            localY = zone.yStart + t * (zone.yEnd - zone.yStart);
          }
          const worldZoneY = building.y + localY;
          // Only climb onto surfaces within step-up reach (~1.4m above current feet)
          if (worldZoneY <= currentFootY + 1.45 && worldZoneY > bestY) {
            bestY = worldZoneY;
          }
        }
      }
    }

    return bestY;
  }

  private updateViewBoundsForRadius() {
    const scale = Math.max(1, this.islandRadius / 75);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = 0.0052 / Math.pow(scale, 0.72);
    }
    this.camera.far = Math.max(600, this.islandRadius * 4.5);
    this.camera.updateProjectionMatrix();
  }

  public initTerrain() {
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
    }

    // Scale grid resolution proportionally with islandRadius so mountains & beaches never distort into giant spikes
    const res = Math.min(200, Math.max(72, Math.round(72 * (this.islandRadius / 75))));
    this.terrainResolution = res;
    if (this.terrainHeightMap.length !== res * res) {
      this.terrainHeightMap = new Float32Array(res * res);
    }

    const size = this.islandRadius * 2;
    const geom = new THREE.PlaneGeometry(size, size, res - 1, res - 1);
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const CORE_BASE_RADIUS = 75;
    const CORE_PLATEAU_R = 52;
    const CORE_EDGE_FALLOFF = Math.cos((CORE_PLATEAU_R / CORE_BASE_RADIUS) * Math.PI * 0.5);

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);

      const d = Math.sqrt(x * x + z * z);

      let h = 0;
      if (d < this.islandRadius) {
        // Keep central island topography 100% invariant when expanding outward,
        // only extending the gentle sandy coastline from r=52m out to the expanded shoreline.
        const falloff =
          d <= CORE_PLATEAU_R
            ? Math.cos((d / CORE_BASE_RADIUS) * Math.PI * 0.5)
            : CORE_EDGE_FALLOFF *
              Math.cos(((d - CORE_PLATEAU_R) / Math.max(1, this.islandRadius - CORE_PLATEAU_R)) * Math.PI * 0.5);
        const plateau = Math.sin(x * 0.035) * Math.cos(z * 0.035) * 1.2;
        const peak = Math.exp(-Math.pow((x + 30) * 0.07, 2) - Math.pow((z + 30) * 0.07, 2)) * 11;
        const beachRipples = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.6;
        h = falloff * 4.5 + plateau + peak + beachRipples - 0.4;
      } else {
        h = -0.6 - ((d - this.islandRadius) / 30) * 8;
      }

      posAttr.setY(i, h);
      this.terrainHeightMap[i] = h;

      let r = 0.88, g = 0.82, b = 0.62;
      if (h > 1.6 && h < 7.5) {
        r = 0.28 + h * 0.02;
        g = 0.62 + h * 0.01;
        b = 0.25;
      } else if (h >= 7.5) {
        r = 0.45; g = 0.44; b = 0.42;
      } else if (h < 0.2) {
        r = 0.72; g = 0.66; b = 0.52;
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geom.computeVertexNormals();
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.terrainMesh = new THREE.Mesh(geom, mat);
    this.scene.add(this.terrainMesh);
    this.updateViewBoundsForRadius();
  }

  public initWater() {
    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
    }

    const waterSize = Math.max(550, this.islandRadius * 4.2);
    const waterGeom = new THREE.PlaneGeometry(waterSize, waterSize, 24, 24);
    waterGeom.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshPhongMaterial({
      color: 0x14a0a4,
      specular: 0x90e8ff,
      shininess: 95,
      transparent: true,
      opacity: 0.76,
    });

    this.waterMesh = new THREE.Mesh(waterGeom, waterMat);
    this.waterMesh.position.y = 0.3;
    this.scene.add(this.waterMesh);
  }

  private reseatWorldEntitiesAfterTerrainChange() {
    // 1. Re-anchor all harvestable nodes cleanly to updated terrain height
    for (const node of this.harvestNodes) {
      const y = this.getTerrainHeight(node.position.x, node.position.z);
      const meshY = node.type === 'shells' ? Math.max(0.1, y) : y;
      node.mesh.position.y = meshY;
      const yOff = node.type === 'palm' ? 1 : node.type === 'rock' ? 0.8 : node.type === 'driftwood' ? 0.4 : 0.3;
      node.position.y = meshY + yOff;
    }

    // 2. Re-anchor all decorative palm meshes
    for (const flora of this.decorativeFloraMeshes) {
      flora.position.y = this.getTerrainHeight(flora.position.x, flora.position.z);
    }

    // 3. Re-anchor active cargo crates
    for (const crate of this.cargoCrates) {
      const cy = Math.max(0.4, this.getTerrainHeight(crate.position.x, crate.position.z));
      crate.position.y = cy;
      crate.mesh.position.y = cy;
    }

    // 4. Re-anchor placed buildings & notify React state so saved heights stay exact
    const updatedList: PlacedBuilding[] = [];
    for (const b of this.placedBuildingList) {
      const def = BUILDING_CATALOG[b.defId];
      const terrainY = this.getTerrainHeight(b.x, b.z);
      const nextY = def?.allowedTerrain === 'water' ? Math.max(0.3, terrainY) : Math.max(0.2, terrainY);
      b.y = nextY;
      const rec = this.placedStructures.get(b.id);
      if (rec) {
        rec.building.y = nextY;
        rec.built.group.position.y = nextY;
      }
      updatedList.push({ ...b });
    }
    this.placedBuildingList = updatedList;
    this.onBuildingsReseatedCallback?.(updatedList);

    // 5. Re-anchor staff & guests onto walkable support / terrain
    for (const staff of this.staff3D.values()) {
      const sy = this.getWalkableSupportHeight(staff.group.position.x, staff.group.position.z, staff.group.position.y);
      staff.group.position.y = sy;
      staff.targetPos.y = this.getWalkableSupportHeight(staff.targetPos.x, staff.targetPos.z, staff.targetPos.y);
    }
    for (const guest of this.guests3D.values()) {
      const gy = this.getWalkableSupportHeight(guest.group.position.x, guest.group.position.z, guest.group.position.y);
      guest.group.position.y = gy;
      guest.targetPos.y = this.getWalkableSupportHeight(guest.targetPos.x, guest.targetPos.z, guest.targetPos.y);
    }

    // 6. Keep first-person camera cleanly above ground so the player never falls under terrain
    this.snapPlayerToGround(this.playerPos.x, this.playerPos.z);
  }

  public expandIsland(newRadius: number) {
    this.islandRadius = newRadius;
    this.initTerrain();
    this.initWater();
    this.reseatWorldEntitiesAfterTerrainChange();

    const rng = (seed: number) => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    let seed = Date.now();
    for (let i = 0; i < 15; i++) {
      const angle = rng(seed++) * Math.PI * 2;
      const radius = newRadius - 22 + rng(seed++) * 16;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = this.getTerrainHeight(x, z);

      if (y > 0.6 && y < 5.0) {
        const palmGroup = this.createPalmTreeMesh();
        palmGroup.position.set(x, y, z);
        this.scene.add(palmGroup);

        this.harvestNodes.push({
          id: `node_expanded_palm_${Date.now()}_${i}`,
          type: 'palm',
          position: new THREE.Vector3(x, y + 1, z),
          mesh: palmGroup,
          remaining: 4,
          initialScale: palmGroup.scale.clone(),
        });
      } else if (y >= -0.2 && y <= 1.2) {
        const driftGroup = this.createDriftwoodMesh();
        driftGroup.position.set(x, y, z);
        this.scene.add(driftGroup);

        this.harvestNodes.push({
          id: `node_expanded_drift_${Date.now()}_${i}`,
          type: 'driftwood',
          position: new THREE.Vector3(x, y + 0.5, z),
          mesh: driftGroup,
          remaining: 3,
          initialScale: driftGroup.scale.clone(),
        });
      }
    }
  }

  public initNaturalFloraAndRocks() {
    for (const n of this.harvestNodes) {
      this.scene.remove(n.mesh);
    }
    this.harvestNodes = [];
    for (const m of this.decorativeFloraMeshes) {
      this.scene.remove(m);
    }
    this.decorativeFloraMeshes = [];

    const rng = (seed: number) => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    let seed = 4321;
    for (let i = 0; i < 40; i++) {
      const angle = rng(seed++) * Math.PI * 2;
      const radius = 8 + rng(seed++) * (this.islandRadius - 16);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = this.getTerrainHeight(x, z);

      if (y > 0.8 && y < 6.5) {
        const palmGroup = this.createPalmTreeMesh();
        palmGroup.position.set(x, y, z);
        palmGroup.rotation.y = rng(seed++) * Math.PI * 2;
        this.scene.add(palmGroup);

        if (i % 2 === 0) {
          this.harvestNodes.push({
            id: `node_palm_${i}`,
            type: 'palm',
            position: new THREE.Vector3(x, y + 1, z),
            mesh: palmGroup,
            remaining: 4,
            initialScale: palmGroup.scale.clone(),
          });
        } else {
          this.decorativeFloraMeshes.push(palmGroup);
        }
      }
    }

    for (let i = 0; i < 22; i++) {
      const angle = rng(seed++) * Math.PI * 2;
      const radius = this.islandRadius - 16 + rng(seed++) * 14;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = this.getTerrainHeight(x, z);

      if (y >= -0.2 && y <= 1.4) {
        const driftGroup = this.createDriftwoodMesh();
        driftGroup.position.set(x, y, z);
        this.scene.add(driftGroup);

        this.harvestNodes.push({
          id: `node_drift_${i}`,
          type: 'driftwood',
          position: new THREE.Vector3(x, y + 0.4, z),
          mesh: driftGroup,
          remaining: 3,
          initialScale: driftGroup.scale.clone(),
        });
      }
    }

    for (let i = 0; i < 20; i++) {
      const angle = rng(seed++) * Math.PI * 2;
      const radius = 6 + rng(seed++) * 38;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = this.getTerrainHeight(x, z);

      if (y > 1.8) {
        const rockGroup = this.createRockMesh();
        rockGroup.position.set(x, y, z);
        this.scene.add(rockGroup);

        this.harvestNodes.push({
          id: `node_rock_${i}`,
          type: 'rock',
          position: new THREE.Vector3(x, y + 0.8, z),
          mesh: rockGroup,
          remaining: 4,
          initialScale: rockGroup.scale.clone(),
        });
      }
    }

    for (let i = 0; i < 15; i++) {
      const angle = rng(seed++) * Math.PI * 2;
      const radius = this.islandRadius - 12 + rng(seed++) * 10;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = this.getTerrainHeight(x, z);

      if (y >= -0.8 && y <= 0.6) {
        const shellGroup = this.createShellClusterMesh();
        shellGroup.position.set(x, Math.max(0.1, y), z);
        this.scene.add(shellGroup);

        this.harvestNodes.push({
          id: `node_shell_${i}`,
          type: 'shells',
          position: new THREE.Vector3(x, y + 0.3, z),
          mesh: shellGroup,
          remaining: 2,
          initialScale: shellGroup.scale.clone(),
        });
      }
    }
  }

  // --- 3D Procedural Meshes for Nature ---

  private createPalmTreeMesh(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x247834, roughness: 0.72, side: THREE.DoubleSide });

    for (let s = 0; s < 5; s++) {
      const part = new THREE.Mesh(new THREE.CylinderGeometry(0.26 - s * 0.03, 0.34 - s * 0.03, 1.2, 7), trunkMat);
      part.position.set(Math.sin(s * 0.3) * 0.28, s * 1.1 + 0.6, 0);
      part.rotation.z = -s * 0.08;
      group.add(part);
    }

    const leafGeom = new THREE.ConeGeometry(0.7, 3.2, 5);
    leafGeom.rotateX(Math.PI / 2.3);

    for (let f = 0; f < 7; f++) {
      const leaf = new THREE.Mesh(leafGeom, leafMat);
      const angle = (f / 7) * Math.PI * 2;
      leaf.position.set(0.28, 5.5, 0);
      leaf.rotation.y = angle;
      leaf.rotation.z = 0.55;
      group.add(leaf);
    }

    return group;
  }

  private createDriftwoodMesh(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6d4b, roughness: 0.88 });

    const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.6, 6), woodMat);
    log1.rotation.z = Math.PI / 2;
    group.add(log1);

    const log2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.8, 6), woodMat);
    log2.rotation.z = Math.PI / 2.2;
    log2.position.set(0.3, 0.2, 0.4);
    group.add(log2);

    return group;
  }

  private createRockMesh(): THREE.Group {
    const group = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6e6c69, roughness: 0.9, flatShading: true });

    const main = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), rockMat);
    main.scale.set(1.4, 0.9, 1.2);
    main.position.y = 0.6;
    group.add(main);

    const small = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 1), rockMat);
    small.position.set(0.9, 0.3, 0.5);
    group.add(small);

    return group;
  }

  private createShellClusterMesh(): THREE.Group {
    const group = new THREE.Group();
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xffe8d6, roughness: 0.6 });
    const pearlMat = new THREE.MeshStandardMaterial({ color: 0xfdfbf7, roughness: 0.12, metalness: 0.2 });

    for (let i = 0; i < 4; i++) {
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.05, 0.08, 5), shellMat);
      shell.position.set((i % 2) * 0.4 - 0.2, 0.04, Math.floor(i / 2) * 0.4 - 0.2);
      group.add(shell);
    }

    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), pearlMat);
    pearl.position.set(0.05, 0.12, 0.05);
    group.add(pearl);

    return group;
  }

  // --- 3D Particle Debris Burst on Mining/Chopping ---

  public spawnHarvestDebris(type: string, worldPos: THREE.Vector3) {
    const color = type === 'rock' ? 0x7c7873 : type === 'shells' ? 0xffffff : 0xab7d4d;
    const geom = new THREE.DodecahedronGeometry(0.09, 0);
    const mat = new THREE.MeshLambertMaterial({ color });

    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(geom, mat);
      p.position.copy(worldPos);

      const vx = (Math.random() - 0.5) * 3.5;
      const vy = 1.5 + Math.random() * 3.0;
      const vz = (Math.random() - 0.5) * 3.5;

      this.scene.add(p);
      this.particles.push({
        mesh: p,
        velocity: new THREE.Vector3(vx, vy, vz),
        lifetime: 0,
        maxLifetime: 0.6 + Math.random() * 0.4,
      });
    }
  }

  // --- Dynamic First-Person Tool Swing Animation ---

  public triggerToolSwing(harvestType: string) {
    if (harvestType === 'rock') {
      this.setToolVisibility('pickaxe');
    } else if (harvestType === 'shells') {
      this.setToolVisibility('net');
    } else {
      this.setToolVisibility('axe');
    }

    this.isSwinging = true;
    this.swingAnimationTimer = 0;
  }

  private updateToolAnimation(delta: number) {
    if (!this.toolRig) return;

    if (this.isSwinging) {
      this.swingAnimationTimer += delta * 5.0;
      if (this.swingAnimationTimer >= Math.PI) {
        this.isSwinging = false;
        this.swingAnimationTimer = 0;
      }
    }

    const swingSin = Math.sin(this.swingAnimationTimer);
    const idleBobY = Math.sin(this.walkTimer * 0.8) * 0.015;

    this.toolRig.position.set(
      0.38 - swingSin * 0.12,
      -0.32 - swingSin * 0.18 + idleBobY,
      -0.65 + swingSin * 0.15
    );

    this.toolRig.rotation.set(
      0.1 + swingSin * 1.2,
      -0.15 - swingSin * 0.4,
      -0.05 - swingSin * 0.3
    );
  }

  // --- Cargo Delivery Crates ---

  public spawnCargoDelivery(resource: string, amount: number) {
    const crateId = `crate_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const crateGroup = new THREE.Group();
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb4793d, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });

    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), crateMat);
    box.position.y = 0.65;
    crateGroup.add(box);

    const bandH = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.24, 1.34), metalMat);
    bandH.position.y = 0.65;
    crateGroup.add(bandH);

    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), beaconMat);
    beacon.position.y = 1.45;
    crateGroup.add(beacon);

    const chuteMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7, side: THREE.DoubleSide });
    const chute = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.55, 6, 1, true), chuteMat);
    chute.position.y = 1.85;
    crateGroup.add(chute);

    const label = this.createTextSprite(`📦 [E] Open Cargo (+${amount} ${resource.toUpperCase()})`, '#b45309');
    label.position.set(0, 2.35, 0);
    crateGroup.add(label);

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const spawnPos = this.playerPos.clone().addScaledVector(forward, 4.0);
    spawnPos.y = Math.max(0.4, this.getTerrainHeight(spawnPos.x, spawnPos.z));

    crateGroup.position.copy(spawnPos);
    this.scene.add(crateGroup);

    const crateObj: CargoCrate3D = {
      id: crateId,
      resource,
      amount,
      position: spawnPos.clone(),
      mesh: crateGroup,
    };
    this.cargoCrates.push(crateObj);
  }

  // --- Building Placement Mode (with Click Start -> Click End Auto-Connecting Paths!) ---

  private clearPathPreviewMeshes() {
    if (this.pathPreviewGroup) {
      this.scene.remove(this.pathPreviewGroup);
      this.pathPreviewGroup = null;
    }
    for (const segGroup of this.pathPreviewPool) {
      segGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).geometry?.dispose();
          const m = (child as THREE.Mesh).material;
          if (Array.isArray(m)) m.forEach((mat) => mat.dispose());
          else m?.dispose();
        }
      });
    }
    this.pathPreviewPool = [];
    if (this.pathStartMarker) {
      this.scene.remove(this.pathStartMarker);
      this.pathStartMarker = null;
    }
    this.plannedPathSegments = [];
  }

  private notifyPathState(startSet: boolean, segmentCount: number) {
    if (
      this.lastNotifiedPathStart !== startSet ||
      this.lastNotifiedPathCount !== segmentCount
    ) {
      this.lastNotifiedPathStart = startSet;
      this.lastNotifiedPathCount = segmentCount;
      this.onPathStateChangeCallback?.({ startSet, segmentCount });
    }
  }

  public resetPathStart() {
    this.pathStartPoint = null;
    if (this.pathStartMarker) {
      this.scene.remove(this.pathStartMarker);
      this.pathStartMarker = null;
    }
    if (this.pathPreviewGroup) {
      this.pathPreviewGroup.visible = false;
    }
    this.plannedPathSegments = [];
    this.notifyPathState(false, this.activeBuildDefId ? 1 : 0);
  }

  public updateMaxPathSegments(count: number) {
    this.maxAffordablePathSegments = Math.max(0, Math.min(24, count));
  }

  public setPlacementMode(defId: string | null, maxPathSegments: number = 24) {
    this.activeBuildDefId = defId;
    this.maxAffordablePathSegments = Math.max(0, Math.min(24, maxPathSegments));
    this.pathStartPoint = null;
    this.lastNotifiedPathStart = false;
    this.lastNotifiedPathCount = -1;

    if (this.ghostGroup) {
      this.scene.remove(this.ghostGroup);
      this.ghostGroup = null;
    }
    this.clearPathPreviewMeshes();

    if (defId) {
      // Pop cursor up automatically whenever entering placement mode so user can click destinations & HUD freely
      if (document.pointerLockElement) {
        try {
          document.exitPointerLock?.();
        } catch {
          // ignore pointer lock exit error
        }
      }

      const def = BUILDING_CATALOG[defId];
      const built = buildResortStructure3D(defId);
      built.group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = new THREE.MeshBasicMaterial({
            color: 0x34d399,
            transparent: true,
            opacity: 0.52,
          });
        }
      });
      this.ghostGroup = built.group;
      this.scene.add(this.ghostGroup);

      if (def?.category === 'paths') {
        this.pathPreviewGroup = new THREE.Group();
        this.scene.add(this.pathPreviewGroup);
        this.notifyPathState(false, 1);
      } else {
        this.notifyPathState(false, 0);
      }
    } else {
      this.notifyPathState(false, 0);
    }
  }

  public rotatePlacement() {
    this.ghostRotation = (this.ghostRotation + Math.PI / 4) % (Math.PI * 2);
  }

  private snapPointToNearbyTarget(pt: THREE.Vector3): number | null {
    let bestDistSq = 11.5; // ~3.4m snap radius
    let snappedYaw: number | null = null;
    let bestX = pt.x;
    let bestZ = pt.z;

    // 1. Prefer snapping to existing path ends
    for (const b of this.placedBuildingList) {
      const bDef = BUILDING_CATALOG[b.defId];
      if (!bDef) continue;

      if (bDef.category === 'paths') {
        const dirX = Math.sin(b.rotation);
        const dirZ = Math.cos(b.rotation);
        for (const sign of [-1, 1]) {
          const endX = b.x + dirX * 2.0 * sign;
          const endZ = b.z + dirZ * 2.0 * sign;
          const dSq = (pt.x - endX) ** 2 + (pt.z - endZ) ** 2;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestX = endX;
            bestZ = endZ;
            snappedYaw = b.rotation;
          }
        }
      } else {
        // 2. Also snap to the edge of placed resort buildings / Ferry Pier!
        const dx = pt.x - b.x;
        const dz = pt.z - b.z;
        const dist = Math.hypot(dx, dz);
        const edgeRadius = Math.max(2.6, bDef.footprintRadius + 1.2);
        if (dist > 0.2 && Math.abs(dist - edgeRadius) < 3.0) {
          const edgeX = b.x + (dx / dist) * edgeRadius;
          const edgeZ = b.z + (dz / dist) * edgeRadius;
          const dSq = (pt.x - edgeX) ** 2 + (pt.z - edgeZ) ** 2;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestX = edgeX;
            bestZ = edgeZ;
          }
        }
      }
    }

    pt.x = bestX;
    pt.z = bestZ;
    return snappedYaw;
  }

  private computeAimGroundPoint(previewDist: number): THREE.Vector3 {
    if (!this.isPointerLocked && this.hasPointerMoved && this.terrainMesh) {
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);
      const targets: THREE.Object3D[] = [this.terrainMesh];
      if (this.waterMesh) targets.push(this.waterMesh);
      const hits = this.raycaster.intersectObjects(targets, false);
      if (hits.length > 0 && hits[0].distance <= 68) {
        return hits[0].point.clone();
      }
    }

    _euler.set(0, this.yaw, 0);
    _forward.set(0, 0, -1).applyEuler(_euler);
    return this.playerPos.clone().addScaledVector(_forward, previewDist);
  }

  private ensurePathPreviewSegment(index: number, defId: string, affordable: boolean): THREE.Group {
    while (this.pathPreviewPool.length <= index) {
      const built = buildResortStructure3D(defId);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.52,
      });
      built.group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = mat;
        }
      });
      built.group.userData.previewMat = mat;
      this.pathPreviewGroup?.add(built.group);
      this.pathPreviewPool.push(built.group);
    }
    const segGroup = this.pathPreviewPool[index];
    const mat = segGroup.userData.previewMat as THREE.MeshBasicMaterial | undefined;
    if (mat) {
      mat.color.setHex(affordable ? 0x34d399 : 0xf43f5e);
    }
    return segGroup;
  }

  private getPathObstacles(): PathObstacle[] {
    const obs: PathObstacle[] = [];
    for (const node of this.harvestNodes) {
      const r = node.type === 'palm' ? 1.35 : node.type === 'rock' ? 1.85 : 0;
      if (r > 0) {
        obs.push({ x: node.position.x, z: node.position.z, radius: r });
      }
    }
    for (const palm of this.decorativeFloraMeshes) {
      obs.push({ x: palm.position.x, z: palm.position.z, radius: 1.35 });
    }
    for (const b of this.placedBuildingList) {
      const bDef = BUILDING_CATALOG[b.defId];
      if (bDef && bDef.category !== 'paths') {
        obs.push({ x: b.x, z: b.z, radius: Math.max(1.5, bDef.footprintRadius * 0.85) });
      }
    }
    return obs;
  }

  private updateGhostPlacement() {
    if (!this.ghostGroup || !this.activeBuildDefId) return;

    const def = BUILDING_CATALOG[this.activeBuildDefId];
    const previewDist = def?.category === 'paths' ? 6.5 : def?.category === 'massive' ? 11.5 : 8.0;
    const aimPoint = this.computeAimGroundPoint(previewDist);

    if (def?.category === 'paths') {
      const snappedPoint = aimPoint.clone();
      const snappedYaw = this.snapPointToNearbyTarget(snappedPoint);
      const endTerrainY = Math.max(0.2, this.getTerrainHeight(snappedPoint.x, snappedPoint.z));
      snappedPoint.y = endTerrainY;

      if (!this.pathStartPoint) {
        this.ghostGroup.visible = true;
        if (this.pathPreviewGroup) this.pathPreviewGroup.visible = false;
        this.ghostPos.copy(snappedPoint);
        this.ghostGroup.position.set(snappedPoint.x, endTerrainY, snappedPoint.z);
        this.ghostGroup.rotation.y = snappedYaw !== null ? snappedYaw : this.ghostRotation;
        this.plannedPathSegments = [];
        this.notifyPathState(false, 1);
      } else {
        this.ghostGroup.visible = false;
        if (this.pathPreviewGroup) this.pathPreviewGroup.visible = true;

        const planned = planPathSegments(
          this.pathStartPoint,
          snappedPoint,
          4.0,
          24,
          this.ghostRotation,
          this.getPathObstacles()
        );

        const affordableList: Array<{ x: number; y: number; z: number; rotation: number }> = [];
        for (let i = 0; i < planned.length; i++) {
          const seg = planned[i];
          const segY = Math.max(0.2, this.getTerrainHeight(seg.x, seg.z));
          const isAffordable = i < this.maxAffordablePathSegments;
          const previewMesh = this.ensurePathPreviewSegment(i, this.activeBuildDefId, isAffordable);
          previewMesh.visible = true;
          previewMesh.position.set(seg.x, segY, seg.z);
          previewMesh.rotation.y = seg.rotation;
          if (isAffordable) {
            affordableList.push({ x: seg.x, y: segY, z: seg.z, rotation: seg.rotation });
          }
        }
        for (let i = planned.length; i < this.pathPreviewPool.length; i++) {
          this.pathPreviewPool[i].visible = false;
        }
        this.plannedPathSegments = affordableList;
        this.notifyPathState(true, affordableList.length);
      }
      return;
    }

    this.ghostGroup.visible = true;
    this.ghostPos.copy(aimPoint);
    const terrainY = this.getTerrainHeight(this.ghostPos.x, this.ghostPos.z);
    const placeY = def?.allowedTerrain === 'water' ? Math.max(0.3, terrainY) : Math.max(0.2, terrainY);
    this.ghostGroup.position.set(this.ghostPos.x, placeY, this.ghostPos.z);
    this.ghostGroup.rotation.y = this.ghostRotation;
  }

  public confirmPlacement(): boolean {
    if (!this.activeBuildDefId || !this.ghostGroup) return false;
    const def = BUILDING_CATALOG[this.activeBuildDefId];

    if (def?.category === 'paths') {
      if (!this.pathStartPoint) {
        const startPt = this.ghostGroup.position.clone();
        this.pathStartPoint = startPt;

        if (this.pathStartMarker) {
          this.scene.remove(this.pathStartMarker);
        }
        const marker = new THREE.Group();
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.65, 0.95, 18),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.08;
        marker.add(ring);
        const beacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        beacon.position.y = 0.75;
        marker.add(beacon);
        marker.position.copy(startPt);
        this.pathStartMarker = marker;
        this.scene.add(marker);

        this.notifyPathState(true, Math.min(1, this.maxAffordablePathSegments));
        return true;
      }

      if (this.plannedPathSegments.length > 0 && this.onPlacePathChainCallback) {
        const segmentsCopy = this.plannedPathSegments.map((s) => ({ ...s }));
        this.onPlacePathChainCallback(this.activeBuildDefId, segmentsCopy);
        this.resetPathStart();
        return true;
      }
      return false;
    }

    const x = this.ghostGroup.position.x;
    const z = this.ghostGroup.position.z;
    const y = this.ghostGroup.position.y;
    const rot = this.ghostGroup.rotation.y;

    if (this.onPlaceBuildingCallback) {
      this.onPlaceBuildingCallback(this.activeBuildDefId, x, y, z, rot);
    }
    return true;
  }

  // --- Synchronize Placed Buildings, Guests & Role-Based Staff ---

  public syncBuildings(placedBuildings: PlacedBuilding[]) {
    this.placedBuildingList = placedBuildings;
    const currentIds = new Set(placedBuildings.map((b) => b.id));
    let changed = false;

    for (const [id, rec] of this.placedStructures.entries()) {
      if (!currentIds.has(id)) {
        this.scene.remove(rec.built.group);
        this.placedStructures.delete(id);
        changed = true;
      }
    }

    for (const b of placedBuildings) {
      if (!this.placedStructures.has(b.id)) {
        const built = buildResortStructure3D(b.defId);
        built.group.position.set(b.x, b.y, b.z);
        built.group.rotation.y = b.rotation;
        this.scene.add(built.group);
        this.placedStructures.set(b.id, { building: b, built });
        changed = true;
      }
    }

    // Re-route existing staff immediately if a new kitchen stove, bar, or bedroom was built!
    if (changed) {
      for (const staff of this.staff3D.values()) {
        this.assignStaffDestination(staff);
      }
    }
  }

  private getStationWorldTargets(stationType: 'stove' | 'bar' | 'bed' | 'desk'): Array<{ pos: THREE.Vector3; yaw: number }> {
    const targets: Array<{ pos: THREE.Vector3; yaw: number }> = [];
    for (const rec of this.placedStructures.values()) {
      const { building, built } = rec;
      const cosR = Math.cos(building.rotation);
      const sinR = Math.sin(building.rotation);
      for (const st of built.stations) {
        if (st.type !== stationType) continue;
        const wx = building.x + st.localPos.x * cosR + st.localPos.z * sinR;
        const wz = building.z - st.localPos.x * sinR + st.localPos.z * cosR;
        const wy = building.y + st.localPos.y;
        targets.push({
          pos: new THREE.Vector3(wx, wy, wz),
          yaw: building.rotation + st.facingYaw,
        });
      }
    }
    return targets;
  }

  private assignStaffDestination(staff: Staff3D) {
    let stationType: 'stove' | 'bar' | 'bed' | 'desk' = 'bed';
    if (staff.role === 'chefs') stationType = 'stove';
    else if (staff.role === 'bartenders') stationType = 'bar';
    else if (staff.role === 'concierges') stationType = 'desk';

    const stations = this.getStationWorldTargets(stationType);
    if (stations.length > 0) {
      const pick = stations[Math.floor(Math.random() * stations.length)];
      staff.targetPos.copy(pick.pos);
      staff.stationYaw = pick.yaw;
      staff.state = 'patrol';
      return;
    }

    // Fallback patrol near resort center
    const ang = Math.random() * Math.PI * 2;
    const dist = 4 + Math.random() * 14;
    const tx = Math.cos(ang) * dist;
    const tz = Math.sin(ang) * dist;
    const ty = Math.max(0.4, this.getTerrainHeight(tx, tz));
    staff.targetPos.set(tx, ty, tz);
    staff.stationYaw = null;
    staff.state = 'patrol';
  }

  private getFerryPierPoints(): { boarding: THREE.Vector3; landExit: THREE.Vector3 } | null {
    const dock = this.placedBuildingList.find((b) => b.defId === 'ferry_dock');
    if (!dock) return null;
    const cosR = Math.cos(dock.rotation);
    const sinR = Math.sin(dock.rotation);
    const toWorld = (lx: number, ly: number, lz: number) =>
      new THREE.Vector3(
        dock.x + lx * cosR + lz * sinR,
        dock.y + ly,
        dock.z - lx * sinR + lz * cosR
      );
    const boarding = toWorld(0, 0.98, 4.5);
    const landExit = toWorld(0, 0.98, -6.8);
    landExit.y = Math.max(0.4, this.getWalkableSupportHeight(landExit.x, landExit.z, landExit.y));
    return { boarding, landExit };
  }

  private pickResortDestination(nearOriginFallback: THREE.Vector3): THREE.Vector3 {
    const nonPathBuildings = this.placedBuildingList.filter(
      (b) => BUILDING_CATALOG[b.defId]?.category !== 'paths' && b.defId !== 'ferry_dock'
    );
    if (nonPathBuildings.length > 0 && Math.random() < 0.7) {
      const targetB = nonPathBuildings[Math.floor(Math.random() * nonPathBuildings.length)];
      const angle = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 3.5;
      const tx = targetB.x + Math.cos(angle) * r;
      const tz = targetB.z + Math.sin(angle) * r;
      const ty = this.getWalkableSupportHeight(tx, tz, Math.max(0.4, targetB.y));
      return new THREE.Vector3(tx, ty, tz);
    }

    const ang = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 14;
    const tx = nearOriginFallback.x + Math.cos(ang) * dist;
    const tz = nearOriginFallback.z + Math.sin(ang) * dist;
    const ty = Math.max(0.4, this.getTerrainHeight(tx, tz));
    return new THREE.Vector3(tx, ty, tz);
  }

  public syncGuests(guests: Array<{ id: string; name: string; tier: string }>) {
    const currentIds = new Set(guests.map((g) => g.id));
    const pierPoints = this.getFerryPierPoints();

    // Any guest who checked out visibly walks back to the Ferry Pier to depart!
    for (const [id, guest3D] of this.guests3D.entries()) {
      if (!currentIds.has(id)) {
        this.guests3D.delete(id);
        if (pierPoints) {
          guest3D.state = 'departing';
          guest3D.waypoints = [pierPoints.landExit.clone(), pierPoints.boarding.clone()];
          guest3D.targetPos.copy(guest3D.waypoints[0]);
          const badge = guest3D.group.children.find((c) => c instanceof THREE.Sprite) as THREE.Sprite | undefined;
          if (badge) {
            guest3D.group.remove(badge);
          }
          const departingLabel = this.createTextSprite(`👋 Leaving: ${guest3D.name}`, '#475569');
          departingLabel.position.set(0, 1.85, 0);
          guest3D.group.add(departingLabel);
          this.departingGuests3D.push(guest3D);
          this.ferryArrivalTimer = Math.max(this.ferryArrivalTimer, 4.5);
        } else {
          this.scene.remove(guest3D.group);
        }
      }
    }

    let spawnedNewOnPier = false;
    for (const g of guests) {
      if (!this.guests3D.has(g.id)) {
        const { group, legL, legR, armL, armR } = this.createAnimatedGuestFigure(g.tier, g.name);

        if (pierPoints) {
          // Spawn right at the Ferry Pier boarding deck and walk onto the island!
          const startPos = pierPoints.boarding.clone();
          startPos.x += (Math.random() - 0.5) * 1.4;
          group.position.copy(startPos);
          this.scene.add(group);

          const resortTarget = this.pickResortDestination(pierPoints.landExit);
          const waypoints = [pierPoints.landExit.clone(), resortTarget];
          spawnedNewOnPier = true;

          this.guests3D.set(g.id, {
            id: g.id,
            name: g.name,
            tier: g.tier,
            group,
            legL,
            legR,
            armL,
            armR,
            targetPos: waypoints[0].clone(),
            waypoints,
            state: 'arriving',
            idleTimer: 1.5 + Math.random() * 2.5,
            walkCycle: Math.random() * Math.PI,
          });
        } else {
          const angle = Math.random() * Math.PI * 2;
          const rad = 6 + Math.random() * 18;
          const gx = Math.cos(angle) * rad;
          const gz = Math.sin(angle) * rad;
          const gy = Math.max(0.4, this.getTerrainHeight(gx, gz));
          group.position.set(gx, gy, gz);
          this.scene.add(group);

          this.guests3D.set(g.id, {
            id: g.id,
            name: g.name,
            tier: g.tier,
            group,
            legL,
            legR,
            armL,
            armR,
            targetPos: new THREE.Vector3(gx, gy, gz),
            waypoints: [],
            state: 'idle',
            idleTimer: 2 + Math.random() * 4,
            walkCycle: 0,
          });
        }
      }
    }

    if (spawnedNewOnPier) {
      this.ferryArrivalTimer = 5.5;
    }
  }

  private createAnimatedGuestFigure(tier: string, name: string) {
    const group = new THREE.Group();
    const shirtColor = tier === 'vip' ? 0xd4af37 : tier === 'luxury' ? 0x38bdf8 : 0xf43f5e;
    const bodyMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.75 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.65, 6), bodyMat);
    torso.position.y = 0.85;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), skinMat);
    head.position.y = 1.35;
    group.add(head);

    const badgeColor = tier === 'vip' ? '#b45309' : tier === 'luxury' ? '#0284c7' : '#be123c';
    const labelSprite = this.createTextSprite(`👤 ${name}`, badgeColor);
    labelSprite.position.set(0, 1.85, 0);
    group.add(labelSprite);

    const legGeom = new THREE.CylinderGeometry(0.08, 0.07, 0.55, 6);
    const legL = new THREE.Mesh(legGeom, darkMat);
    legL.position.set(-0.1, 0.3, 0);
    group.add(legL);

    const legR = new THREE.Mesh(legGeom, darkMat);
    legR.position.set(0.1, 0.3, 0);
    group.add(legR);

    const armGeom = new THREE.CylinderGeometry(0.06, 0.05, 0.5, 6);
    const armL = new THREE.Mesh(armGeom, skinMat);
    armL.position.set(-0.25, 0.8, 0);
    group.add(armL);

    const armR = new THREE.Mesh(armGeom, skinMat);
    armR.position.set(0.25, 0.8, 0);
    group.add(armR);

    return { group, legL, legR, armL, armR };
  }

  // --- 3D Staff Management & Physical Characters ---

  public syncStaff(staff: StaffRoster, buildings: PlacedBuilding[]) {
    this.placedBuildingList = buildings;
    const roles: Array<keyof StaffRoster> = ['cleaners', 'bartenders', 'chefs', 'concierges'];

    for (const role of roles) {
      const targetCount = staff[role] || 0;
      const currentStaffForRole = Array.from(this.staff3D.values()).filter((s) => s.role === role);

      while (currentStaffForRole.length < targetCount) {
        const id = `staff_${role}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const staffObj = this.createStaffFigure(role, id);
        this.staff3D.set(id, staffObj);
        currentStaffForRole.push(staffObj);
        this.scene.add(staffObj.group);
      }

      while (currentStaffForRole.length > targetCount) {
        const toRemove = currentStaffForRole.pop();
        if (toRemove) {
          this.scene.remove(toRemove.group);
          this.staff3D.delete(toRemove.id);
        }
      }
    }
  }

  private createStaffFigure(role: keyof StaffRoster, id: string): Staff3D {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

    let shirtColor = 0x0d9488;
    if (role === 'bartenders') shirtColor = 0x18181b;
    else if (role === 'chefs') shirtColor = 0xf8fafc;
    else if (role === 'concierges') shirtColor = 0x1e3a8a;

    const bodyMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.72 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.65, 6), bodyMat);
    torso.position.y = 0.85;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), skinMat);
    head.position.y = 1.35;
    group.add(head);

    const legGeom = new THREE.CylinderGeometry(0.08, 0.07, 0.55, 6);
    const legL = new THREE.Mesh(legGeom, darkMat);
    legL.position.set(-0.1, 0.3, 0);
    group.add(legL);

    const legR = new THREE.Mesh(legGeom, darkMat);
    legR.position.set(0.1, 0.3, 0);
    group.add(legR);

    const armGeom = new THREE.CylinderGeometry(0.06, 0.05, 0.5, 6);
    const armL = new THREE.Mesh(armGeom, skinMat);
    armL.position.set(-0.25, 0.8, 0);
    group.add(armL);

    const armR = new THREE.Mesh(armGeom, skinMat);
    armR.position.set(0.25, 0.8, 0);
    group.add(armR);

    if (role === 'chefs') {
      // Tall Chef Toque Hat + Metal Spatula in right hand!
      const hat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.14, 0.38, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 })
      );
      hat.position.y = 1.64;
      group.add(hat);

      const spatulaHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.45, 6),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
      );
      spatulaHandle.rotation.x = Math.PI / 2;
      spatulaHandle.position.set(0, -0.22, 0.24);
      armR.add(spatulaHandle);
    } else if (role === 'cleaners') {
      const broomStick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6),
        new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.8 })
      );
      broomStick.position.set(0.04, -0.22, 0.18);
      broomStick.rotation.x = 0.35;
      armR.add(broomStick);
      const bristles = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.14, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.9 })
      );
      bristles.position.set(0.04, -0.70, 0.36);
      armR.add(bristles);
    } else if (role === 'bartenders') {
      const bowtie = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.05, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })
      );
      bowtie.position.set(0, 1.1, 0.16);
      group.add(bowtie);

      const shaker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.04, 0.2, 8),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })
      );
      shaker.position.set(0, -0.2, 0.12);
      armR.add(shaker);
    } else if (role === 'concierges') {
      const goldBadge = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.04, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
      );
      goldBadge.position.set(0.08, 1.05, 0.17);
      group.add(goldBadge);
    }

    const tagText =
      role === 'cleaners'
        ? '🧹 Housekeeper (Staff)'
        : role === 'bartenders'
        ? '🍸 Mixologist (Staff)'
        : role === 'chefs'
        ? '👨‍🍳 Chef (Cooking)'
        : '🛎️ Concierge (Staff)';

    const labelSprite = this.createTextSprite(tagText, '#065f46');
    labelSprite.position.set(0, 1.98, 0);
    group.add(labelSprite);

    const staffObj: Staff3D = {
      id,
      role,
      name: tagText,
      group,
      legL,
      legR,
      armL,
      armR,
      targetPos: new THREE.Vector3(),
      stationYaw: null,
      state: 'working',
      idleTimer: 1.5 + Math.random() * 2,
      walkCycle: 0,
    };

    this.assignStaffDestination(staffObj);
    group.position.copy(staffObj.targetPos);
    if (staffObj.stationYaw !== null) {
      group.rotation.y = staffObj.stationYaw;
      staffObj.state = 'working';
    }

    return staffObj;
  }

  private updateStaff(delta: number, nowMs: number) {
    for (const staff of this.staff3D.values()) {
      if (staff.state === 'working') {
        staff.idleTimer -= delta;
        staff.legL.rotation.x = 0;
        staff.legR.rotation.x = 0;

        if (staff.stationYaw !== null) {
          staff.group.rotation.y = staff.stationYaw;
        }

        if (staff.role === 'chefs') {
          // Animated cooking & stirring motion over stove!
          staff.armR.rotation.x = -0.85 + Math.sin(nowMs * 0.008) * 0.25;
          staff.armR.rotation.z = Math.cos(nowMs * 0.008) * 0.15;
          staff.armL.rotation.x = -0.5 + Math.sin(nowMs * 0.004) * 0.1;
        } else if (staff.role === 'bartenders') {
          // Shaking tropical cocktail shaker!
          staff.armR.rotation.x = -0.9 + Math.sin(nowMs * 0.014) * 0.35;
          staff.armL.rotation.x = -0.45;
        } else {
          // Sweeping / Greeting gesture
          staff.armR.rotation.x = -0.35 + Math.sin(nowMs * 0.006) * 0.3;
          staff.armL.rotation.x = -0.2;
        }

        if (staff.idleTimer <= 0) {
          if (staff.role === 'cleaners') {
            // Cleaners patrol between different bedrooms/buildings
            this.assignStaffDestination(staff);
            staff.idleTimer = 6 + Math.random() * 4;
          } else if (staff.stationYaw === null) {
            // If no dedicated stove/bar/desk yet, keep checking for one
            this.assignStaffDestination(staff);
            staff.idleTimer = 4 + Math.random() * 3;
          } else {
            // Keep working at stove / bar / concierge desk!
            staff.idleTimer = 8;
          }
        }
      } else {
        _toTarget.subVectors(staff.targetPos, staff.group.position);
        const horizontalDist = Math.hypot(_toTarget.x, _toTarget.z);
        if (horizontalDist > 0.35) {
          _toTarget.y = 0;
          _toTarget.normalize();
          staff.group.position.addScaledVector(_toTarget, delta * 2.0);
          const supportY = this.getWalkableSupportHeight(
            staff.group.position.x,
            staff.group.position.z,
            staff.targetPos.y
          );
          staff.group.position.y = THREE.MathUtils.damp(staff.group.position.y, supportY, 8, delta);
          staff.group.rotation.y = Math.atan2(_toTarget.x, _toTarget.z);

          staff.walkCycle += delta * 7.5;
          const swing = Math.sin(staff.walkCycle) * 0.45;
          staff.legL.rotation.x = swing;
          staff.legR.rotation.x = -swing;
          staff.armL.rotation.x = -swing * 0.5;
          staff.armR.rotation.x = swing * 0.5;
        } else {
          staff.group.position.copy(staff.targetPos);
          staff.state = 'working';
          staff.armR.rotation.z = 0;
        }
      }
    }
  }

  private stepGuestWalk(guest: Guest3D, delta: number, speed: number): boolean {
    _toTarget.subVectors(guest.targetPos, guest.group.position);
    _toTarget.y = 0;
    const dist = _toTarget.length();
    if (dist > 0.45) {
      _toTarget.normalize();
      guest.group.position.addScaledVector(_toTarget, delta * speed);
      const supportY = this.getWalkableSupportHeight(
        guest.group.position.x,
        guest.group.position.z,
        guest.group.position.y + 0.35
      );
      guest.group.position.y = THREE.MathUtils.damp(guest.group.position.y, supportY, 10, delta);
      guest.group.rotation.y = Math.atan2(_toTarget.x, _toTarget.z);

      guest.walkCycle += delta * (speed * 4.4);
      const swing = Math.sin(guest.walkCycle) * 0.55;
      guest.legL.rotation.x = swing;
      guest.legR.rotation.x = -swing;
      guest.armL.rotation.x = -swing * 0.7;
      guest.armR.rotation.x = swing * 0.7;
      return false;
    }
    return true;
  }

  private updateGuests(delta: number) {
    if (this.ferryArrivalTimer > 0) {
      this.ferryArrivalTimer = Math.max(0, this.ferryArrivalTimer - delta);
    }

    // Update arriving & wandering active guests
    for (const guest of this.guests3D.values()) {
      if (guest.state === 'arriving') {
        const reached = this.stepGuestWalk(guest, delta, 2.5);
        if (reached) {
          guest.waypoints.shift();
          if (guest.waypoints.length > 0) {
            guest.targetPos.copy(guest.waypoints[0]);
          } else {
            guest.state = 'idle';
            guest.idleTimer = 2 + Math.random() * 3;
          }
        }
      } else if (guest.state === 'idle') {
        guest.idleTimer -= delta;
        guest.legL.rotation.x = 0;
        guest.legR.rotation.x = 0;
        guest.armL.rotation.x = 0;
        guest.armR.rotation.x = 0;

        if (guest.idleTimer <= 0) {
          const nextDest = this.pickResortDestination(guest.group.position);
          if (nextDest.y > 0.2 && nextDest.y < 7.0) {
            guest.targetPos.copy(nextDest);
            guest.state = 'walk';
          }
          guest.idleTimer = 3 + Math.random() * 5;
        }
      } else {
        const reached = this.stepGuestWalk(guest, delta, 1.85);
        if (reached) {
          guest.state = 'idle';
        }
      }
    }

    // Update departing guests walking back onto the Ferry Pier
    const stillDeparting: Guest3D[] = [];
    for (const guest of this.departingGuests3D) {
      const reached = this.stepGuestWalk(guest, delta, 2.5);
      if (reached) {
        guest.waypoints.shift();
        if (guest.waypoints.length > 0) {
          guest.targetPos.copy(guest.waypoints[0]);
          stillDeparting.push(guest);
        } else {
          this.scene.remove(guest.group);
        }
      } else {
        stillDeparting.push(guest);
      }
    }
    this.departingGuests3D = stillDeparting;
  }

  private updateBuildingAnimations(nowMs: number) {
    const t = nowMs * 0.001;
    for (const rec of this.placedStructures.values()) {
      const anim = rec.built.animatedParts;

      // Passenger Ferry Boat glides smoothly into the pier when guests arrive/depart & rocks gently on waves
      if (anim.ferryBoat) {
        const baseX = anim.ferryBoat.userData.baseX ?? 3.8;
        const baseZ = anim.ferryBoat.userData.baseZ ?? 2.0;
        const approachFactor = this.ferryArrivalTimer > 2.5
          ? (this.ferryArrivalTimer - 2.5) / 3.0
          : 0;
        anim.ferryBoat.position.x = baseX + approachFactor * 22;
        anim.ferryBoat.position.z = baseZ + Math.sin(t * 0.7) * 0.25;
        anim.ferryBoat.position.y = Math.sin(t * 1.6) * 0.10;
        anim.ferryBoat.rotation.z = Math.sin(t * 1.3) * 0.03;
      }

      // Penthouse glass elevator glides smoothly from Ground (1.7) to Top Floor (12.0)!
      if (anim.elevatorCab) {
        const cycle = (Math.sin(t * 0.55) + 1) * 0.5; // 0..1
        anim.elevatorCab.position.y = 1.7 + cycle * 10.2;
      }

      // Rising steam puffs above active Chef Stoves & Grills
      if (anim.steamPuffs) {
        for (let i = 0; i < anim.steamPuffs.length; i++) {
          const puff = anim.steamPuffs[i];
          const phase = (t * 0.9 + (puff.userData.phase || 0)) % 1.0;
          puff.position.y = 1.18 + phase * 0.95;
          puff.position.x = (puff.userData.baseX || 0) + Math.sin(t * 3 + i) * 0.05;
          const s = 0.7 + phase * 0.85;
          puff.scale.set(s, s, s);
        }
      }

      // Koi swimming gracefully in pond
      if (anim.koiFish) {
        for (let i = 0; i < anim.koiFish.length; i++) {
          const koi = anim.koiFish[i];
          const ang = (koi.userData.orbitAngle || 0) + t * 0.7;
          const rad = koi.userData.orbitRadius || 0.9;
          koi.position.set(Math.cos(ang) * rad, 0.20, Math.sin(ang) * rad);
          koi.rotation.z = -ang;
        }
      }

      // Flickering campfire & tiki torch flames
      if (anim.fireFlames) {
        for (let i = 0; i < anim.fireFlames.length; i++) {
          const f = anim.fireFlames[i];
          const flicker = 0.88 + Math.sin(t * 14 + i * 2.1) * 0.16;
          f.scale.set(1, flicker, 1);
        }
      }

      // Gentle hammock breeze sway
      if (anim.hammockFabric) {
        anim.hammockFabric.rotation.x = Math.sin(t * 1.4) * 0.08;
      }

      // Tipping waterpark bucket
      if (anim.tippingBucket) {
        anim.tippingBucket.rotation.z = Math.sin(t * 1.2) * 0.4;
      }
    }
  }

  // --- Controls & Raycasting ---

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isUiBlocked) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys[e.code] = true;
    if (e.code === 'KeyR' && this.activeBuildDefId) {
      const def = BUILDING_CATALOG[this.activeBuildDefId];
      if (def?.category === 'paths' && this.pathStartPoint) {
        this.resetPathStart();
      } else {
        this.rotatePlacement();
      }
    }
    if (e.code === 'KeyE') {
      this.handleInteractKey();
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
      return; // User was dragging camera to look around
    }

    const canvas = this.renderer.domElement;
    if (this.activeBuildDefId) {
      this.confirmPlacement();
    } else {
      if (!this.isPointerLocked && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
      if (this.hoveredCargoCrate || this.hoveredNode) {
        this.handleInteractKey();
      }
    }
  };

  private onPointerLockChange = () => {
    this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.isUiBlocked) return;

    this.pointerNDC.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    this.pointerNDC.y = -(e.clientY / Math.max(1, window.innerHeight)) * 2 + 1;
    this.hasPointerMoved = true;

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

  private onResize = () => {
    if (this.isDisposed || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleInteractKey() {
    if (this.hoveredCargoCrate) {
      this.spawnHarvestDebris('driftwood', this.hoveredCargoCrate.position);
      if (this.onOpenCargoCallback) {
        this.onOpenCargoCallback(
          this.hoveredCargoCrate.id,
          this.hoveredCargoCrate.resource,
          this.hoveredCargoCrate.amount
        );
      }
      this.scene.remove(this.hoveredCargoCrate.mesh);
      this.cargoCrates = this.cargoCrates.filter((c) => c.id !== this.hoveredCargoCrate!.id);
      this.hoveredCargoCrate = null;
      return;
    }

    if (this.hoveredNode && this.onHarvestCallback) {
      this.triggerToolSwing(this.hoveredNode.type);
      this.spawnHarvestDebris(this.hoveredNode.type, this.hoveredNode.position);

      const nodeMesh = this.hoveredNode.mesh;
      const origScale = this.hoveredNode.initialScale.clone();
      nodeMesh.scale.multiplyScalar(0.85);
      setTimeout(() => {
        if (nodeMesh) nodeMesh.scale.copy(origScale);
      }, 150);

      this.onHarvestCallback(this.hoveredNode.type, this.hoveredNode.position);
      this.hoveredNode.remaining--;

      if (this.hoveredNode.remaining <= 0) {
        this.scene.remove(this.hoveredNode.mesh);
        this.harvestNodes = this.harvestNodes.filter((n) => n.id !== this.hoveredNode!.id);
        this.hoveredNode = null;
      }
    }
  }

  private updatePlayerPhysics(delta: number) {
    const isSprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const moveSpeed = isSprinting ? 11.0 : 6.2;

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
      this.playerPos.addScaledVector(_moveDir, moveSpeed * delta);

      this.walkTimer += delta * (isSprinting ? 14 : 9);
      this.stepDistanceAccumulator += moveSpeed * delta;
      if (this.stepDistanceAccumulator > 2.5) {
        this.stepDistanceAccumulator = 0;
        this.onStepSound?.();
      }
    }

    const dist = Math.sqrt(this.playerPos.x * this.playerPos.x + this.playerPos.z * this.playerPos.z);
    if (dist > this.islandRadius + 18) {
      const angle = Math.atan2(this.playerPos.z, this.playerPos.x);
      this.playerPos.x = Math.cos(angle) * (this.islandRadius + 18);
      this.playerPos.z = Math.sin(angle) * (this.islandRadius + 18);
    }

    const targetFootY = this.getWalkableSupportHeight(this.playerPos.x, this.playerPos.z, this.playerFootY);
    this.playerFootY = THREE.MathUtils.damp(this.playerFootY, targetFootY, 12, delta);

    const headBobY = this.isMoving ? Math.sin(this.walkTimer) * 0.065 : 0;
    const headBobX = this.isMoving ? Math.cos(this.walkTimer * 0.5) * 0.032 : 0;

    this.playerPos.y = this.playerFootY + 1.7;
    this.camera.position.set(
      this.playerPos.x + headBobX,
      this.playerPos.y + headBobY,
      this.playerPos.z
    );

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  private updateRaycastHover() {
    this.raycaster.setFromCamera(this.centerScreen, this.camera);

    let closestCrate: CargoCrate3D | null = null;
    let minCrateDist = 5.5;
    this.camera.getWorldDirection(_camDir);

    for (const crate of this.cargoCrates) {
      const dist = this.playerPos.distanceTo(crate.position);
      if (dist < minCrateDist) {
        _toTarget.subVectors(crate.position, this.camera.position).normalize();
        if (_camDir.dot(_toTarget) > 0.7) {
          closestCrate = crate;
          minCrateDist = dist;
        }
      }
    }

    this.hoveredCargoCrate = closestCrate;
    if (closestCrate) {
      this.hoveredNode = null;
      return;
    }

    let closestNode: HarvestNode3D | null = null;
    let minDist = 5.5;

    for (const node of this.harvestNodes) {
      const dist = this.playerPos.distanceTo(node.position);
      if (dist < minDist) {
        _toTarget.subVectors(node.position, this.camera.position).normalize();
        if (_camDir.dot(_toTarget) > 0.8) {
          closestNode = node;
          minDist = dist;
        }
      }
    }

    this.hoveredNode = closestNode;

    if (closestNode) {
      if (closestNode.type === 'rock') this.setToolVisibility('pickaxe');
      else if (closestNode.type === 'shells') this.setToolVisibility('net');
      else this.setToolVisibility('axe');
    }
  }

  private updateParticles(delta: number) {
    const alive: Particle3D[] = [];
    for (const p of this.particles) {
      p.lifetime += delta;
      if (p.lifetime < p.maxLifetime) {
        p.velocity.y -= delta * 9.8;
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.mesh.rotation.x += delta * 5;
        p.mesh.rotation.y += delta * 4;
        const scale = 1.0 - p.lifetime / p.maxLifetime;
        p.mesh.scale.set(scale, scale, scale);
        alive.push(p);
      } else {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
      }
    }
    this.particles = alive;
  }

  // --- Smooth Day / Morning / Sunset / Starlit Night Lighting ---

  public updateTimeOfDay(timeNorm: number) {
    const wrapped = ((timeNorm % 1) + 1) % 1;
    const sunAngle = wrapped * Math.PI * 2 - Math.PI / 2;
    const sunDist = 110;
    const sunY = Math.sin(sunAngle) * sunDist;
    const sunX = Math.cos(sunAngle) * sunDist;
    const sunElev = Math.sin(sunAngle); // -1 (midnight) to +1 (noon)

    if (sunElev >= -0.05) {
      this.sunLight.position.set(sunX, Math.max(8, sunY), 35);
    } else {
      // Soft moonlight directional cast from opposite sky arc
      this.sunLight.position.set(-sunX, Math.max(20, -sunY), -35);
    }

    const daySky = new THREE.Color(0x7ac9e8);
    const dawnSunsetSky = new THREE.Color(0xf97348);
    const nightSky = new THREE.Color(0x0b1530);

    const dayHemiSky = new THREE.Color(0xb2e6fa);
    const sunsetHemiSky = new THREE.Color(0xfbbf49);
    const nightHemiSky = new THREE.Color(0x1f325c);

    const dayHemiGround = new THREE.Color(0x3a6e4c);
    const nightHemiGround = new THREE.Color(0x0b1628);

    const skyColor = new THREE.Color();
    const hemiSky = new THREE.Color();
    const hemiGround = new THREE.Color();

    let nightFactor = 0;

    if (sunElev > 0.25) {
      // Morning -> Midday -> Afternoon
      const t = THREE.MathUtils.clamp((sunElev - 0.25) / 0.45, 0, 1);
      skyColor.lerpColors(dawnSunsetSky, daySky, THREE.MathUtils.smoothstep(t, 0, 1));
      hemiSky.lerpColors(sunsetHemiSky, dayHemiSky, t);
      hemiGround.copy(dayHemiGround);
      this.sunLight.intensity = 1.05 + t * 0.25;
      this.sunLight.color.setHex(0xfff7e6);
      this.ambientLight.intensity = 0.42 + t * 0.08;
    } else if (sunElev > -0.18) {
      // Golden Dawn & Sunset transition
      const t = THREE.MathUtils.clamp((sunElev + 0.18) / 0.43, 0, 1); // 0 = night edge, 1 = morning edge
      skyColor.lerpColors(nightSky, dawnSunsetSky, t);
      hemiSky.lerpColors(nightHemiSky, sunsetHemiSky, t);
      hemiGround.lerpColors(nightHemiGround, dayHemiGround, t);
      this.sunLight.intensity = 0.28 + t * 0.72;
      this.sunLight.color.setHex(0xffb454);
      this.ambientLight.intensity = 0.24 + t * 0.18;
      nightFactor = 1.0 - t;
    } else {
      // Starlit Night
      skyColor.copy(nightSky);
      hemiSky.copy(nightHemiSky);
      hemiGround.copy(nightHemiGround);
      this.sunLight.intensity = 0.30;
      this.sunLight.color.setHex(0x7ca3d8);
      this.ambientLight.intensity = 0.24;
      nightFactor = 1.0;
    }

    this.scene.background = skyColor;
    if (this.scene.fog) this.scene.fog.color.copy(skyColor);
    this.hemiLight.color.copy(hemiSky);
    this.hemiLight.groundColor.copy(hemiGround);

    // Cozy warm island night fill around player + visible moon & stars
    this.nightFillLight.position.set(this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z);
    this.nightFillLight.intensity = nightFactor * 1.15;

    if (this.starsMat) {
      this.starsMat.opacity = nightFactor * 0.9;
    }
    if (this.moonMesh) {
      this.moonMesh.visible = nightFactor > 0.12;
      this.moonMesh.position.set(-sunX * 1.9, Math.max(30, -sunY * 1.9), -70);
    }
  }

  // --- Software-WebGL-Safe Paced Animation Loop ---

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

    this.updatePlayerPhysics(delta);
    this.updateGhostPlacement();
    this.updateRaycastHover();
    this.updateToolAnimation(delta);
    this.updateParticles(delta);
    this.updateGuests(delta);
    this.updateStaff(delta, now);
    this.updateBuildingAnimations(now);

    if (this.waterMesh) {
      this.waterMesh.position.y = 0.3 + Math.sin(now * 0.0018) * 0.05;
    }

    this.renderer.render(this.scene, this.camera);

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

  public resetToDayOne() {
    for (const rec of this.placedStructures.values()) {
      this.scene.remove(rec.built.group);
    }
    this.placedStructures.clear();
    this.placedBuildingList = [];

    for (const crate of this.cargoCrates) {
      this.scene.remove(crate.mesh);
    }
    this.cargoCrates = [];
    this.hoveredCargoCrate = null;

    for (const staff of this.staff3D.values()) {
      this.scene.remove(staff.group);
    }
    this.staff3D.clear();

    for (const guest of this.guests3D.values()) {
      this.scene.remove(guest.group);
    }
    this.guests3D.clear();
    for (const guest of this.departingGuests3D) {
      this.scene.remove(guest.group);
    }
    this.departingGuests3D = [];
    this.ferryArrivalTimer = 0;

    this.islandRadius = 75;
    this.initTerrain();
    this.initWater();
    this.initNaturalFloraAndRocks();

    this.snapPlayerToGround(0, 20);
    this.yaw = 0;
    this.pitch = 0;
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.clearPathPreviewMeshes();

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
    this.renderer.dispose();
  }
}
