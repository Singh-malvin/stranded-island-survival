import * as THREE from 'three';
import { PART5_IMMERSION_TUNING, WORLD } from '../survival/config.ts';
import { WeatherState } from '../survival/types.ts';

interface GullEntry {
  root: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
  centerX: number;
  centerZ: number;
  orbitR: number;
  baseY: number;
  angle: number;
  speed: number;
  flapPhase: number;
  scatterBoost: number;
}

interface CrabEntry {
  x: number;
  z: number;
  yaw: number;
  homeX: number;
  homeZ: number;
  phase: number;
  scurryTimer: number;
}

interface FloatingParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  kind: 'breath' | 'bubble';
}

export class WorldLifeManager {
  public readonly root: THREE.Group;
  private readonly gullsGroup: THREE.Group;
  private readonly gulls: GullEntry[] = [];

  private readonly crabsMesh: THREE.InstancedMesh;
  private readonly crabs: CrabEntry[] = [];

  private readonly puddlesMesh: THREE.InstancedMesh;
  private readonly puddleAnchors: { x: number; y: number; z: number; maxScale: number; rot: number }[] = [];
  private puddleWetLevel = 0;

  private readonly leavesMesh: THREE.InstancedMesh;
  private readonly leaves: { x: number; y: number; z: number; rx: number; ry: number; rz: number; spd: number }[] = [];

  private readonly breathBubblesGroup: THREE.Group;
  private readonly breathBubblePool: FloatingParticle[] = [];
  private breathTimer = 0;
  private bubbleTimer = 0;

  private readonly tmpObj = new THREE.Object3D();
  private readonly geomDisposables: THREE.BufferGeometry[] = [];
  private readonly matDisposables: THREE.Material[] = [];
  private readonly texDisposables: THREE.Texture[] = [];

  private static createSoftPuddleTexture(): THREE.CanvasTexture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
      grad.addColorStop(0.0, 'rgba(255,255,255,0.92)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.58)');
      grad.addColorStop(0.85, 'rgba(255,255,255,0.14)');
      grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  constructor(private readonly sampleHeight: (x: number, z: number) => number) {
    this.root = new THREE.Group();
    this.root.name = 'WorldLifeFX_Root';

    // 1. Coastal Circling Seagulls (lightweight wing-flap groups orbiting bay & wreck)
    this.gullsGroup = new THREE.Group();
    const gullBodyGeo = new THREE.ConeGeometry(0.11, 0.56, 5);
    gullBodyGeo.rotateX(Math.PI * 0.5);
    const gullWingGeo = new THREE.BoxGeometry(0.58, 0.025, 0.18);
    gullWingGeo.translate(0.29, 0, 0);
    const gullWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.72 });
    const gullWingTipMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78 });
    this.geomDisposables.push(gullBodyGeo, gullWingGeo);
    this.matDisposables.push(gullWhiteMat, gullWingTipMat);

    const gullOrbits = [
      { cx: WORLD.WRECK_POS.x - 6, cz: WORLD.WRECK_POS.z + 8, r: 22, y: 18 },
      { cx: WORLD.PALM_COVE_POS.x, cz: WORLD.PALM_COVE_POS.z + 10, r: 26, y: 21 },
      { cx: -32, cz: 122, r: 24, y: 17 },
      { cx: 14, cz: 138, r: 29, y: 23 },
      { cx: WORLD.BOAT_DOCK_POS.x + 8, cz: WORLD.BOAT_DOCK_POS.z - 12, r: 20, y: 19 },
      { cx: -65, cz: 92, r: 22, y: 20 },
      { cx: 68, cz: 56, r: 25, y: 24 },
    ];
    gullOrbits.forEach((orb, idx) => {
      const gRoot = new THREE.Group();
      const body = new THREE.Mesh(gullBodyGeo, gullWhiteMat);
      const wingL = new THREE.Mesh(gullWingGeo, gullWingTipMat);
      const wingR = new THREE.Mesh(gullWingGeo, gullWingTipMat);
      wingL.scale.x = -1;
      wingL.position.set(-0.04, 0.02, 0);
      wingR.position.set(0.04, 0.02, 0);
      gRoot.add(body, wingL, wingR);
      this.gullsGroup.add(gRoot);
      this.gulls.push({
        root: gRoot,
        wingL,
        wingR,
        centerX: orb.cx,
        centerZ: orb.cz,
        orbitR: orb.r,
        baseY: orb.y,
        angle: idx * 0.92,
        speed: 0.24 + (idx % 3) * 0.05,
        flapPhase: idx * 1.3,
        scatterBoost: 0,
      });
    });
    this.root.add(this.gullsGroup);

    // 2. Scuttling Beach Crabs (single InstancedMesh draw call along wet sand)
    const crabGeo = new THREE.DodecahedronGeometry(0.13, 0);
    crabGeo.scale(1.25, 0.55, 0.95);
    const crabMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.55 });
    this.geomDisposables.push(crabGeo);
    this.matDisposables.push(crabMat);
    const crabSpots = [
      { x: -16, z: 148 },
      { x: -8, z: 151 },
      { x: 6, z: 149 },
      { x: 22, z: 144 },
      { x: 34, z: 138 },
      { x: 52, z: 112 },
      { x: -46, z: 132 },
      { x: -64, z: 120 },
      { x: 62, z: 82 },
      { x: -72, z: 74 },
      { x: 18, z: -98 },
      { x: 8, z: -102 },
    ];
    this.crabsMesh = new THREE.InstancedMesh(crabGeo, crabMat, crabSpots.length);
    this.crabsMesh.name = 'BeachCrabs_Instanced';
    this.crabsMesh.castShadow = false;
    this.crabsMesh.frustumCulled = false;
    crabSpots.forEach((spot, i) => {
      this.crabs.push({
        x: spot.x,
        z: spot.z,
        yaw: i * 1.1,
        homeX: spot.x,
        homeZ: spot.z,
        phase: i * 0.85,
        scurryTimer: 0,
      });
    });
    this.root.add(this.crabsMesh);

    // 3. Glossy Rain Puddles on flat coastal & jungle pockets (single InstancedMesh, soft feathered edges)
    const puddleGeo = new THREE.PlaneGeometry(2.0, 2.0);
    puddleGeo.rotateX(-Math.PI / 2);
    const puddleAlphaTex = WorldLifeManager.createSoftPuddleTexture();
    this.texDisposables.push(puddleAlphaTex);
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x1c2b35,
      roughness: 0.05,
      metalness: 0.45,
      alphaMap: puddleAlphaTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.geomDisposables.push(puddleGeo);
    this.matDisposables.push(puddleMat);
    const puddleSeeds = [
      [14, 134, 1.15],
      [29, 128, 1.05],
      [-18, 126, 1.1],
      [-31, 88, 1.2],
      [-26, 80, 0.95],
      [40, 82, 1.0],
      [-48, 12, 1.2],
      [-55, 6, 1.0],
      [44, -8, 1.05],
      [5, -88, 1.1],
      [-14, -76, 0.95],
      [12, 42, 1.15],
      [-12, 48, 1.1],
      [24, 18, 0.95],
      [-28, -24, 1.15],
      [36, -42, 1.0],
      [0, 108, 1.05],
    ];
    puddleSeeds.forEach(([px, pz, rad], i) => {
      const py = this.sampleHeight(px, pz);
      const slopeDiff = Math.max(
        Math.abs(this.sampleHeight(px + rad * 0.75, pz) - py),
        Math.abs(this.sampleHeight(px - rad * 0.75, pz) - py),
        Math.abs(this.sampleHeight(px, pz + rad * 0.75) - py),
        Math.abs(this.sampleHeight(px, pz - rad * 0.75) - py)
      );
      // Only place puddles on genuinely flat pockets so rims never hover over slopes
      if (py > WORLD.WATER_LEVEL + 0.45 && slopeDiff < 0.065) {
        this.puddleAnchors.push({ x: px, y: py + 0.015, z: pz, maxScale: rad, rot: i * 0.7 });
      }
    });
    this.puddlesMesh = new THREE.InstancedMesh(
      puddleGeo,
      puddleMat,
      Math.max(1, this.puddleAnchors.length)
    );
    this.puddlesMesh.name = 'RainPuddles_Instanced';
    this.puddlesMesh.castShadow = false;
    this.puddlesMesh.visible = false;
    this.root.add(this.puddlesMesh);

    // 4. Storm Wind-Blown Leaves (single InstancedMesh)
    const leafGeo = new THREE.PlaneGeometry(0.18, 0.09);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x65a30d,
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    this.geomDisposables.push(leafGeo);
    this.matDisposables.push(leafMat);
    const leafCount = 26;
    this.leavesMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
    this.leavesMesh.name = 'StormLeaves_Instanced';
    this.leavesMesh.castShadow = false;
    this.leavesMesh.frustumCulled = false;
    this.leavesMesh.visible = false;
    for (let i = 0; i < leafCount; i++) {
      this.leaves.push({
        x: (Math.random() - 0.5) * 24,
        y: 0.4 + Math.random() * 5.2,
        z: (Math.random() - 0.5) * 24,
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        rz: Math.random() * Math.PI,
        spd: 0.8 + Math.random() * 0.8,
      });
    }
    this.root.add(this.leavesMesh);

    // 5. Cold Breath Vapor & Underwater Bubble Puffs
    this.breathBubblesGroup = new THREE.Group();
    this.root.add(this.breathBubblesGroup);
  }

  public scatterBirds(origin: THREE.Vector3): void {
    for (const g of this.gulls) {
      if (g.root.position.distanceTo(origin) < 28) {
        g.scatterBoost = 1.0;
      }
    }
  }

  public setUnderwaterAndScatterVisibility(reflectionPass: boolean): void {
    this.crabsMesh.visible = !reflectionPass;
    this.leavesMesh.visible = !reflectionPass && this.leavesMesh.visible;
    this.breathBubblesGroup.visible = !reflectionPass;
  }

  public update(
    dt: number,
    tSec: number,
    playerPos: THREE.Vector3,
    cameraForward: THREE.Vector3,
    weather: WeatherState,
    waterLevel: number,
    isColdBreath: boolean,
    isUnderwater: boolean,
    inVoyage: boolean,
    enableParticles: boolean
  ): void {
    if (inVoyage) {
      this.gullsGroup.visible = true;
      this.crabsMesh.visible = false;
      this.puddlesMesh.visible = false;
      this.leavesMesh.visible = false;
      this.breathBubblesGroup.visible = false;
      return;
    }

    // 1. Seagulls orbit + startle climb
    for (const g of this.gulls) {
      g.scatterBoost = Math.max(0, g.scatterBoost - dt * 0.35);
      const d = Math.hypot(g.root.position.x - playerPos.x, g.root.position.z - playerPos.z);
      if (d < 13) g.scatterBoost = 1.0;
      g.angle += dt * g.speed * (1 + g.scatterBoost * 1.4);
      const r = g.orbitR + g.scatterBoost * 7.5;
      const gx = g.centerX + Math.cos(g.angle) * r;
      const gz = g.centerZ + Math.sin(g.angle) * r;
      const gy = g.baseY + Math.sin(tSec * 0.7 + g.flapPhase) * 1.4 + g.scatterBoost * 5.0;
      g.root.position.set(gx, gy, gz);
      g.root.rotation.y = -g.angle;
      const flapCycle = Math.sin(tSec * (5.8 + g.scatterBoost * 6.5) + g.flapPhase);
      const glideMask = g.scatterBoost > 0.1 || Math.sin(tSec * 0.45 + g.flapPhase) > -0.15 ? 1 : 0.15;
      const flapRad = flapCycle * 0.55 * glideMask;
      g.wingL.rotation.z = -flapRad;
      g.wingR.rotation.z = flapRad;
    }

    // 2. Beach Crabs scuttling near shoreline
    this.crabsMesh.visible = true;
    for (let i = 0; i < this.crabs.length; i++) {
      const c = this.crabs[i];
      const pdx = c.x - playerPos.x;
      const pdz = c.z - playerPos.z;
      const pDist = Math.hypot(pdx, pdz);
      if (pDist < 4.8 && pDist > 0.05) {
        c.scurryTimer = 1.4;
        c.yaw = Math.atan2(pdx, pdz) + Math.PI * 0.45;
      }
      if (c.scurryTimer > 0) {
        c.scurryTimer = Math.max(0, c.scurryTimer - dt);
        c.x += Math.sin(c.yaw) * dt * 2.35;
        c.z += Math.cos(c.yaw) * dt * 2.35;
      } else {
        const patrol = tSec * 0.65 + c.phase;
        const tx = c.homeX + Math.cos(patrol) * 1.8;
        const tz = c.homeZ + Math.sin(patrol * 1.3) * 1.4;
        c.yaw = Math.atan2(tx - c.x, tz - c.z);
        c.x = THREE.MathUtils.lerp(c.x, tx, Math.min(1, dt * 1.6));
        c.z = THREE.MathUtils.lerp(c.z, tz, Math.min(1, dt * 1.6));
      }
      const cy = Math.max(waterLevel + 0.03, this.sampleHeight(c.x, c.z) + 0.05);
      this.tmpObj.position.set(c.x, cy, c.z);
      this.tmpObj.rotation.set(0, c.yaw, Math.sin(tSec * 16 + c.phase) * 0.08);
      this.tmpObj.scale.setScalar(0.95);
      this.tmpObj.updateMatrix();
      this.crabsMesh.setMatrixAt(i, this.tmpObj.matrix);
    }
    this.crabsMesh.instanceMatrix.needsUpdate = true;

    // 3. Rain Puddles forming & evaporating smoothly
    const rainOn = weather.rain > 0.08;
    this.puddleWetLevel = THREE.MathUtils.clamp(
      this.puddleWetLevel +
        dt * (rainOn ? 0.065 * weather.rain : -PART5_IMMERSION_TUNING.DRY_RATE_SUN * 0.45),
      0,
      1
    );
    const pMat = this.puddlesMesh.material as THREE.MeshStandardMaterial;
    if (this.puddleWetLevel > 0.03 && this.puddleAnchors.length > 0) {
      this.puddlesMesh.visible = true;
      pMat.opacity = this.puddleWetLevel * 0.56;
      const scaleK = 0.25 + 0.75 * this.puddleWetLevel;
      for (let i = 0; i < this.puddleAnchors.length; i++) {
        const a = this.puddleAnchors[i];
        this.tmpObj.position.set(a.x, a.y, a.z);
        this.tmpObj.rotation.set(0, a.rot, 0);
        this.tmpObj.scale.set(a.maxScale * scaleK, 1, a.maxScale * 0.78 * scaleK);
        this.tmpObj.updateMatrix();
        this.puddlesMesh.setMatrixAt(i, this.tmpObj.matrix);
      }
      this.puddlesMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.puddlesMesh.visible = false;
    }

    // 4. Storm wind-blown leaves around player
    const showLeaves = enableParticles && (weather.kind === 'storm' || weather.wind > 0.42);
    this.leavesMesh.visible = showLeaves;
    if (showLeaves) {
      this.leavesMesh.position.set(playerPos.x, Math.max(0.2, playerPos.y - 1.0), playerPos.z);
      const windX = 3.2 + weather.wind * 5.2;
      for (let i = 0; i < this.leaves.length; i++) {
        const l = this.leaves[i];
        l.x += windX * l.spd * dt;
        l.y += Math.sin(tSec * 2.8 + i) * 0.9 * dt;
        l.z += (1.2 + Math.cos(tSec * 1.4 + i) * 1.1) * dt;
        if (l.x > 12) l.x = -12;
        if (l.z > 12) l.z = -12;
        if (l.y < 0.2) l.y = 4.6;
        if (l.y > 5.0) l.y = 0.4;
        this.tmpObj.position.set(l.x, l.y, l.z);
        this.tmpObj.rotation.set(l.rx + tSec * 3.2, l.ry + tSec * 4.5, l.rz);
        this.tmpObj.scale.setScalar(1);
        this.tmpObj.updateMatrix();
        this.leavesMesh.setMatrixAt(i, this.tmpObj.matrix);
      }
      this.leavesMesh.instanceMatrix.needsUpdate = true;
    }

    // 5. Cold breath vapor & underwater bubbles
    this.breathBubblesGroup.visible = enableParticles;
    if (enableParticles) {
      if (isUnderwater) {
        this.bubbleTimer += dt;
        if (this.bubbleTimer >= 0.22) {
          this.bubbleTimer = 0;
          const bGeo = new THREE.SphereGeometry(0.025 + Math.random() * 0.02, 6, 5);
          const bMat = new THREE.MeshBasicMaterial({
            color: 0xe0f2fe,
            transparent: true,
            opacity: 0.68,
            depthWrite: false,
          });
          const m = new THREE.Mesh(bGeo, bMat);
          m.position.set(
            playerPos.x + cameraForward.x * 0.35 + (Math.random() - 0.5) * 0.16,
            playerPos.y - 0.08,
            playerPos.z + cameraForward.z * 0.35 + (Math.random() - 0.5) * 0.16
          );
          this.breathBubblesGroup.add(m);
          this.breathBubblePool.push({
            mesh: m,
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.85 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2),
            age: 0,
            maxAge: 1.1,
            kind: 'bubble',
          });
        }
      } else if (isColdBreath) {
        this.breathTimer += dt;
        if (this.breathTimer >= 2.2) {
          this.breathTimer = 0;
          const pGeo = new THREE.SphereGeometry(0.065, 6, 5);
          const pMat = new THREE.MeshBasicMaterial({
            color: 0xf1f5f9,
            transparent: true,
            opacity: 0.34,
            depthWrite: false,
          });
          const m = new THREE.Mesh(pGeo, pMat);
          m.position.set(
            playerPos.x + cameraForward.x * 0.34,
            playerPos.y - 0.12,
            playerPos.z + cameraForward.z * 0.34
          );
          this.breathBubblesGroup.add(m);
          this.breathBubblePool.push({
            mesh: m,
            vel: new THREE.Vector3(cameraForward.x * 0.55, 0.24, cameraForward.z * 0.55),
            age: 0,
            maxAge: 0.95,
            kind: 'breath',
          });
        }
      }

      const nextPool: FloatingParticle[] = [];
      for (const fp of this.breathBubblePool) {
        fp.age += dt;
        if (fp.age >= fp.maxAge) {
          this.breathBubblesGroup.remove(fp.mesh);
          fp.mesh.geometry.dispose();
          (fp.mesh.material as THREE.Material).dispose();
        } else {
          fp.mesh.position.addScaledVector(fp.vel, dt);
          const r = fp.age / fp.maxAge;
          const mat = fp.mesh.material as THREE.MeshBasicMaterial;
          if (fp.kind === 'breath') {
            fp.mesh.scale.setScalar(1 + r * 2.4);
            mat.opacity = 0.34 * (1 - r);
          } else {
            mat.opacity = 0.68 * (1 - r);
          }
          nextPool.push(fp);
        }
      }
      this.breathBubblePool.length = 0;
      this.breathBubblePool.push(...nextPool);
    }
  }

  public dispose(): void {
    for (const g of this.geomDisposables) g.dispose();
    for (const m of this.matDisposables) m.dispose();
    for (const t of this.texDisposables) t.dispose();
    for (const fp of this.breathBubblePool) {
      fp.mesh.geometry.dispose();
      (fp.mesh.material as THREE.Material).dispose();
    }
    this.breathBubblePool.length = 0;
  }
}
