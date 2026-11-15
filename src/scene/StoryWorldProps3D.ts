/**
 * 3D World Props & Autonomous NPC Visuals for the Open-Ended Story:
 *  - Early survivor breadcrumbs (boot prints & distant cave smoke/campfire glow before Daniel is found)
 *  - 4 Relic Shrines (`aura_shrine.glb`) with crystal state (dormant amethyst vs awakened cyan-gold)
 *  - Caldera Stronghold Citadel (`stronghold_citadel.glb`) at RESEARCH_STATION_POS (-16, -112)
 *    with Armory Rifle & Harpoon displays, Prison Gate, Cracked Escape Vent, and Evidence Locker beacon
 *  - 3 Patrolling Stronghold Sentinels (`auraShade`) with ground FOV vision cones
 *  - Outer Reef Aura Blockade Pillars on the southern horizon (`z = 212`)
 *  - Autonomous Roaming Aura King silhouette (`lavans_bali.glb`) + [T] Aura Sight X-ray halo
 *  - [K] Sovereign Cleave golden ground shockwave ring
 */

import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { POWER_TUNING, PRISON_TUNING } from '../survival/config.ts';
import type { PowerId, SurvivalState } from '../survival/types.ts';
import type { WorldCollider } from '../survival/world.ts';
import { extractWorldColliderFromGLB, type LoadedGLBSet } from './GLBModelBank.ts';
import { mergeStaticMeshesByMaterial } from './meshMerge.ts';

export type StoryHoverTarget =
  | { kind: 'shrine'; powerId: PowerId; pos: THREE.Vector3; label: string; dist: number }
  | { kind: 'armory_item'; armoryTarget: 'aura_rifle' | 'harpoon_gun'; pos: THREE.Vector3; label: string; dist: number }
  | { kind: 'prison_gate'; pos: THREE.Vector3; label: string; dist: number }
  | { kind: 'prison_vent'; pos: THREE.Vector3; label: string; dist: number }
  | { kind: 'evidence_locker'; pos: THREE.Vector3; label: string; dist: number }
  | { kind: 'stronghold_guard'; guardId: string; pos: THREE.Vector3; label: string; dist: number };

interface ShrineVisual {
  id: PowerId;
  root: THREE.Group;
  crystal: THREE.Object3D | null;
  crystalMat: THREE.MeshStandardMaterial | null;
  light: THREE.PointLight;
  pos: THREE.Vector3;
}

interface GuardVisual {
  id: string;
  mesh: THREE.Object3D;
  visionCone: THREE.Mesh;
  visionMat: THREE.MeshBasicMaterial;
  sightBeacon: THREE.Mesh;
  pos: THREE.Vector3;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class StoryWorldProps3D {
  public readonly root = new THREE.Group();
  public readonly staticColliders: WorldCollider[] = [];
  private prisonGateCollider: WorldCollider | null = null;

  private readonly breadcrumbGroup = new THREE.Group();
  private readonly caveRidgeLight: THREE.PointLight;

  private readonly shrines: ShrineVisual[] = [];
  private readonly citadelRoot: THREE.Group;
  private prisonGateObj: THREE.Object3D | null = null;
  private readonly armoryRifleProp: THREE.Group;
  private readonly armoryHarpoonProp: THREE.Group;
  private readonly lockerBeacon: THREE.Mesh;
  private readonly ventShimmer: THREE.Mesh;
  private readonly riflePos: THREE.Vector3;
  private readonly harpoonPos: THREE.Vector3;
  private readonly gatePos: THREE.Vector3;
  private readonly ventPos: THREE.Vector3;
  private readonly lockerPos: THREE.Vector3;

  private readonly guards: GuardVisual[] = [];
  private readonly outerReefGroup = new THREE.Group();

  private readonly roamingKingRoot: THREE.Group;
  private readonly kingSightHalo: THREE.Mesh;
  private readonly kingAuraLight: THREE.PointLight;

  private readonly cleaveRing: THREE.Mesh;
  private cleaveTimer = 0;
  private voyageHidden = false;
  private readonly reflSavedVis: Array<{ obj: THREE.Object3D; vis: boolean }> = [];

  constructor(
    scene: THREE.Scene,
    glbs: LoadedGLBSet,
    getTerrainHeight: (x: number, z: number) => number
  ) {
    this.root.name = 'StoryWorldProps_3D';

    // -----------------------------------------------------------------------
    // 1. EARLY "SOMEONE ELSE IS ALIVE" FOOTPRINTS & DISTANT CAVE CAMP GLOW
    // -----------------------------------------------------------------------
    const printGeo = new THREE.BoxGeometry(0.18, 0.02, 0.34);
    const printMat = new THREE.MeshStandardMaterial({
      color: 0x5c4734,
      roughness: 0.96,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72,
    });
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const fx = 6 - t * 66 + Math.sin(i * 1.4) * 0.6;
      const fz = 64 - t * 98 + (i % 2 === 0 ? 0.22 : -0.22);
      const fy = getTerrainHeight(fx, fz);
      if (fy < 0.25) continue;
      const step = new THREE.Mesh(printGeo, printMat);
      step.position.set(fx, fy + 0.02, fz);
      step.rotation.y = -0.62 + (i % 2 === 0 ? 0.08 : -0.08);
      step.receiveShadow = true;
      this.breadcrumbGroup.add(step);
    }
    this.root.add(this.breadcrumbGroup);
    mergeStaticMeshesByMaterial(this.breadcrumbGroup);

    const caveSmokeY = getTerrainHeight(-74, -44);
    this.caveRidgeLight = new THREE.PointLight(0xf97316, 1.8, 22, 1.5);
    this.caveRidgeLight.position.set(-74, caveSmokeY + 2.2, -44);
    this.root.add(this.caveRidgeLight);

    // -----------------------------------------------------------------------
    // 2. 4 RELIC SHRINES (ANY ORDER UNLOCK)
    // -----------------------------------------------------------------------
    for (const def of POWER_TUNING.SHRINES) {
      const sy = getTerrainHeight(def.x, def.z);
      const shrineRoot = SkeletonUtils.clone(glbs.stronghold.shrine) as THREE.Group;
      shrineRoot.name = `RelicShrine_${def.id}`;
      shrineRoot.position.set(def.x, sy - 0.05, def.z);
      shrineRoot.rotation.y = Math.atan2(-def.x, -def.z);

      let crystal: THREE.Object3D | null = null;
      let crystalMat: THREE.MeshStandardMaterial | null = null;
      shrineRoot.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        if ((m.name || '').toLowerCase().includes('crystal')) {
          crystal = m;
          const std = m.material as THREE.MeshStandardMaterial;
          if (std && std.isMeshStandardMaterial) {
            crystalMat = std.clone();
            crystalMat.emissive.setHex(0x9333ea);
            crystalMat.emissiveIntensity = 1.8;
            m.material = crystalMat;
          }
        }
      });

      const light = new THREE.PointLight(0xa855f7, 2.2, 13, 1.5);
      light.position.set(0, 1.85, 0);
      shrineRoot.add(light);
      this.root.add(shrineRoot);

      const col = extractWorldColliderFromGLB(shrineRoot, `shrine_${def.id}`, glbs.stronghold.shrine);
      this.staticColliders.push(
        col ?? { kind: 'circle', id: `shrine_${def.id}`, x: def.x, z: def.z, radius: 1.05 }
      );

      this.shrines.push({
        id: def.id,
        root: shrineRoot,
        crystal,
        crystalMat,
        light,
        pos: new THREE.Vector3(def.x, sy, def.z),
      });
    }

    // -----------------------------------------------------------------------
    // 3. CALDERA STRONGHOLD CITADEL + ARMORY + PRISON + EVIDENCE LOCKER
    // -----------------------------------------------------------------------
    const sh = PRISON_TUNING.STRONGHOLD_POS;
    const shY = getTerrainHeight(sh.x, sh.z);
    this.citadelRoot = SkeletonUtils.clone(glbs.stronghold.citadel) as THREE.Group;
    this.citadelRoot.name = 'Stronghold_Citadel_3D';
    this.citadelRoot.position.set(sh.x, shY - 0.1, sh.z);
    this.root.add(this.citadelRoot);
    this.citadelRoot.updateMatrixWorld(true);

    const tmpBox = new THREE.Box3();
    const tmpSize = new THREE.Vector3();
    const tmpCenter = new THREE.Vector3();
    let extractedWalls = 0;

    this.citadelRoot.traverse((obj) => {
      const n = obj.name || '';
      const lower = n.toLowerCase();
      if (n.toUpperCase().startsWith('COLLIDER_')) {
        obj.visible = false;
        const m = obj as THREE.Mesh;
        if (m.isMesh && m.geometry) {
          tmpBox.setFromObject(m);
          tmpBox.getSize(tmpSize);
          tmpBox.getCenter(tmpCenter);
          this.staticColliders.push({
            kind: 'obb',
            id: `citadel_${n}`,
            x: tmpCenter.x,
            z: tmpCenter.z,
            halfW: Math.max(0.4, tmpSize.x * 0.48),
            halfD: Math.max(0.4, tmpSize.z * 0.48),
            yaw: 0,
          });
          extractedWalls++;
        }
        return;
      }
      if (lower.includes('prisongate') || lower.includes('prison_gate')) {
        this.prisonGateObj = obj;
      }
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (lower.includes('brazier') || lower.includes('aura')) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && mat.isMeshStandardMaterial) {
            mat.emissive.setHex(0xc084fc);
            mat.emissiveIntensity = 2.4;
          }
        }
      }
    });

    if (extractedWalls === 0) {
      // Fallback courtyard perimeter colliders leaving front south archway & west sneak breach passable
      this.staticColliders.push(
        { kind: 'obb', id: 'citadel_wall_north', x: sh.x, z: sh.z - 12.5, halfW: 13.5, halfD: 0.75, yaw: 0 },
        { kind: 'obb', id: 'citadel_wall_east', x: sh.x + 12.5, z: sh.z, halfW: 0.75, halfD: 12.5, yaw: 0 },
        { kind: 'obb', id: 'citadel_wall_west_n', x: sh.x - 12.5, z: sh.z - 6.5, halfW: 0.75, halfD: 5.5, yaw: 0 },
        { kind: 'obb', id: 'citadel_wall_west_s', x: sh.x - 12.5, z: sh.z + 6.5, halfW: 0.75, halfD: 5.5, yaw: 0 }
      );
    }

    // Prison door collider (enforced while locked in cell)
    this.gatePos = new THREE.Vector3(
      PRISON_TUNING.CELL_WORLD_POS.x + 2.2,
      getTerrainHeight(PRISON_TUNING.CELL_WORLD_POS.x + 2.2, PRISON_TUNING.CELL_WORLD_POS.z + 2.5),
      PRISON_TUNING.CELL_WORLD_POS.z + 2.5
    );
    this.prisonGateCollider = {
      kind: 'obb',
      id: 'stronghold_prison_door_lock',
      x: this.gatePos.x,
      z: this.gatePos.z,
      halfW: 1.6,
      halfD: 0.45,
      yaw: 0,
    };
    const citadelExclude = this.prisonGateObj ? new Set<THREE.Object3D>([this.prisonGateObj]) : undefined;
    mergeStaticMeshesByMaterial(this.citadelRoot, citadelExclude);

    // Armory display weapons on pedestals
    const ry = getTerrainHeight(PRISON_TUNING.ARMORY_RIFLE_POS.x, PRISON_TUNING.ARMORY_RIFLE_POS.z);
    this.riflePos = new THREE.Vector3(PRISON_TUNING.ARMORY_RIFLE_POS.x, ry + 1.08, PRISON_TUNING.ARMORY_RIFLE_POS.z);
    this.armoryRifleProp = SkeletonUtils.clone(glbs.tools.auraRifle) as THREE.Group;
    this.armoryRifleProp.scale.setScalar(1.35);
    this.armoryRifleProp.position.copy(this.riflePos);
    this.armoryRifleProp.rotation.set(0.15, 0.55, 0);
    this.root.add(this.armoryRifleProp);

    const hy = getTerrainHeight(PRISON_TUNING.ARMORY_HARPOON_POS.x, PRISON_TUNING.ARMORY_HARPOON_POS.z);
    this.harpoonPos = new THREE.Vector3(PRISON_TUNING.ARMORY_HARPOON_POS.x, hy + 1.08, PRISON_TUNING.ARMORY_HARPOON_POS.z);
    this.armoryHarpoonProp = SkeletonUtils.clone(glbs.tools.harpoonGun) as THREE.Group;
    this.armoryHarpoonProp.scale.setScalar(1.35);
    this.armoryHarpoonProp.position.copy(this.harpoonPos);
    this.armoryHarpoonProp.rotation.set(0.12, -0.45, 0);
    this.root.add(this.armoryHarpoonProp);

    // Evidence Locker pulsing indicator & Cracked Escape Vent shimmer
    const ly = getTerrainHeight(PRISON_TUNING.LOCKER_WORLD_POS.x, PRISON_TUNING.LOCKER_WORLD_POS.z);
    this.lockerPos = new THREE.Vector3(PRISON_TUNING.LOCKER_WORLD_POS.x, ly + 0.85, PRISON_TUNING.LOCKER_WORLD_POS.z);
    this.lockerBeacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.lockerBeacon.position.copy(this.lockerPos);
    this.lockerBeacon.visible = false;
    this.root.add(this.lockerBeacon);

    const vy = getTerrainHeight(PRISON_TUNING.CELL_WORLD_POS.x - 1.9, PRISON_TUNING.CELL_WORLD_POS.z - 0.8);
    this.ventPos = new THREE.Vector3(PRISON_TUNING.CELL_WORLD_POS.x - 1.9, vy + 0.52, PRISON_TUNING.CELL_WORLD_POS.z - 0.8);
    this.ventShimmer = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.34, 16),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.ventShimmer.position.copy(this.ventPos);
    this.ventShimmer.rotation.y = Math.PI * 0.5;
    this.root.add(this.ventShimmer);

    // -----------------------------------------------------------------------
    // 4. PATROLLING STRONGHOLD SENTINEL GUARDS (3x Aura Shade + Vision Cone)
    // -----------------------------------------------------------------------
    const coneGeo = new THREE.CircleGeometry(14, 18, -0.62, 1.24);
    coneGeo.rotateX(-Math.PI * 0.5);
    coneGeo.rotateY(Math.PI * 0.5); // Orient sector forward along +Z yaw

    const guardIds = ['guard_gate', 'guard_armory', 'guard_prison'];
    for (const gid of guardIds) {
      const mesh = SkeletonUtils.clone(glbs.boss.auraShade) as THREE.Group;
      mesh.scale.setScalar(1.06);
      mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          const std = m.material as THREE.MeshStandardMaterial;
          if (std && std.isMeshStandardMaterial) {
            std.emissive.setHex(0x9333ea);
            std.emissiveIntensity = 1.6;
          }
        }
      });

      const visionMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.11,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const visionCone = new THREE.Mesh(coneGeo, visionMat);
      visionCone.position.y = 0.08;
      mesh.add(visionCone);

      const sightBeacon = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshBasicMaterial({
          color: 0xc084fc,
          wireframe: true,
          transparent: true,
          opacity: 0.9,
          depthTest: false,
        })
      );
      sightBeacon.position.y = 1.15;
      sightBeacon.visible = false;
      mesh.add(sightBeacon);

      this.root.add(mesh);
      this.guards.push({
        id: gid,
        mesh,
        visionCone,
        visionMat,
        sightBeacon,
        pos: new THREE.Vector3(),
      });
    }

    // -----------------------------------------------------------------------
    // 5. OUTER REEF AURA BLOCKADE PILLARS (SOUTHERN HORIZON)
    // -----------------------------------------------------------------------
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1c1926,
      roughness: 0.85,
      metalness: 0.15,
    });
    const tipMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const spireGeo = new THREE.ConeGeometry(2.6, 16, 6);
    const crystalGeo = new THREE.OctahedronGeometry(1.5, 0);
    for (let i = -3; i <= 3; i++) {
      const px = i * 32 + (i % 2) * 8;
      const pz = 212 + Math.abs(i) * 4;
      const g = new THREE.Group();
      const rock = new THREE.Mesh(spireGeo, pillarMat);
      rock.position.y = 6.5;
      g.add(rock);
      const tip = new THREE.Mesh(crystalGeo, tipMat);
      tip.position.y = 15.8;
      g.add(tip);
      g.position.set(px, -0.4, pz);
      this.outerReefGroup.add(g);
    }
    this.root.add(this.outerReefGroup);
    mergeStaticMeshesByMaterial(this.outerReefGroup);

    // -----------------------------------------------------------------------
    // 6. AUTONOMOUS ROAMING AURA KING SILHOUETTE + [T] AURA SIGHT HALO
    // -----------------------------------------------------------------------
    this.roamingKingRoot = SkeletonUtils.clone(glbs.boss.lavansBali) as THREE.Group;
    this.roamingKingRoot.name = 'AuraKing_AutonomousPatrol';
    this.roamingKingRoot.visible = false;
    this.roamingKingRoot.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const nm = (m.name || '').toLowerCase();
      const std = m.material as THREE.MeshStandardMaterial;
      if (std && std.isMeshStandardMaterial && (nm.includes('aura_shell') || nm.includes('eyes'))) {
        std.transparent = nm.includes('aura_shell');
        std.opacity = 0.55;
        std.emissive.setHex(nm.includes('eyes') ? 0xfbbf24 : 0xa855f7);
        std.emissiveIntensity = 3.2;
      }
    });
    this.kingAuraLight = new THREE.PointLight(0xa855f7, 3.2, 20, 1.4);
    this.kingAuraLight.position.set(0, 1.8, 0);
    this.roamingKingRoot.add(this.kingAuraLight);

    this.kingSightHalo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 2.7, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        wireframe: true,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      })
    );
    this.kingSightHalo.position.set(0, 1.4, 0);
    this.kingSightHalo.visible = false;
    this.roamingKingRoot.add(this.kingSightHalo);
    this.root.add(this.roamingKingRoot);

    // -----------------------------------------------------------------------
    // 7. [K] SOVEREIGN CLEAVE GOLDEN WAVE RING
    // -----------------------------------------------------------------------
    this.cleaveRing = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.35, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.cleaveRing.rotation.x = -Math.PI * 0.5;
    this.cleaveRing.visible = false;
    this.root.add(this.cleaveRing);

    scene.add(this.root);
  }

  public triggerCleaveWave(origin: THREE.Vector3) {
    this.cleaveRing.position.set(origin.x, origin.y + 0.22, origin.z);
    this.cleaveRing.scale.setScalar(1);
    this.cleaveRing.visible = true;
    this.cleaveTimer = 0.52;
  }

  public getDynamicColliders(state: SurvivalState): WorldCollider[] {
    if (state.prison.inPrison && this.prisonGateCollider) {
      return [this.prisonGateCollider];
    }
    return [];
  }

  public resnapToTerrain(getTerrainHeight: (x: number, z: number) => number): void {
    for (const child of this.breadcrumbGroup.children) {
      const fy = getTerrainHeight(child.position.x, child.position.z);
      child.visible = fy >= 0.25;
      child.position.y = fy + 0.02;
    }

    const caveSmokeY = getTerrainHeight(-74, -44);
    this.caveRidgeLight.position.y = caveSmokeY + 2.2;

    for (const sh of this.shrines) {
      const sy = getTerrainHeight(sh.pos.x, sh.pos.z);
      sh.pos.y = sy;
      sh.root.position.y = sy - 0.05;
    }

    const sh = PRISON_TUNING.STRONGHOLD_POS;
    const shY = getTerrainHeight(sh.x, sh.z);
    this.citadelRoot.position.y = shY - 0.1;
    this.citadelRoot.updateMatrixWorld(true);

    this.gatePos.y = getTerrainHeight(this.gatePos.x, this.gatePos.z);

    this.riflePos.y = getTerrainHeight(this.riflePos.x, this.riflePos.z) + 1.08;
    this.armoryRifleProp.position.y = this.riflePos.y;

    this.harpoonPos.y = getTerrainHeight(this.harpoonPos.x, this.harpoonPos.z) + 1.08;
    this.armoryHarpoonProp.position.y = this.harpoonPos.y;

    this.lockerPos.y = getTerrainHeight(this.lockerPos.x, this.lockerPos.z) + 0.85;
    this.lockerBeacon.position.y = this.lockerPos.y;

    this.ventPos.y = getTerrainHeight(this.ventPos.x, this.ventPos.z) + 0.52;
    this.ventShimmer.position.y = this.ventPos.y;
  }

  public update(
    dt: number,
    elapsedSec: number,
    state: SurvivalState,
    getTerrainHeight: (x: number, z: number) => number
  ) {
    // 1. Early companion clues & faint cave camp flicker
    this.breadcrumbGroup.visible = !state.companion.found;
    const hr = ((state.clock.hour % 24) + 24) % 24;
    const isDim = hr >= 17.5 || hr < 6.5;
    this.caveRidgeLight.visible = !state.companion.found;
    this.caveRidgeLight.intensity =
      (isDim ? 2.4 : 0.7) * (0.85 + 0.15 * Math.sin(elapsedSec * 7.2));

    // 2. Relic Shrines animation & color shift
    for (let i = 0; i < this.shrines.length; i++) {
      const sh = this.shrines[i];
      const unlocked = state.powers.unlocked.includes(sh.id);
      if (sh.crystal) {
        sh.crystal.rotation.y = elapsedSec * (unlocked ? 1.8 : 0.65) + i;
      }
      if (sh.crystalMat) {
        sh.crystalMat.emissive.setHex(unlocked ? 0x38bdf8 : 0x9333ea);
        sh.crystalMat.emissiveIntensity =
          (unlocked ? 3.2 : 1.5) + Math.sin(elapsedSec * 2.5 + i) * 0.35;
      }
      sh.light.color.setHex(unlocked ? 0x38bdf8 : 0xa855f7);
      sh.light.intensity = unlocked ? 3.2 : 1.8;
    }

    // 3. Armory stolen status & Evidence Locker beacon & Prison Gate
    this.armoryRifleProp.visible = !state.stronghold.stolenRifle;
    this.armoryHarpoonProp.visible = !state.stronghold.stolenHarpoon;
    if (this.armoryRifleProp.visible) {
      this.armoryRifleProp.position.y = this.riflePos.y + Math.sin(elapsedSec * 2.1) * 0.04;
    }
    if (this.armoryHarpoonProp.visible) {
      this.armoryHarpoonProp.position.y = this.harpoonPos.y + Math.sin(elapsedSec * 2.1 + 1.1) * 0.04;
    }

    const hasConfiscated = !state.prison.lockerRecovered && state.prison.confiscatedItems.some(Boolean);
    this.lockerBeacon.visible = hasConfiscated;
    if (hasConfiscated) {
      this.lockerBeacon.position.y = this.lockerPos.y + 0.55 + Math.sin(elapsedSec * 3.4) * 0.09;
      this.lockerBeacon.rotation.y = elapsedSec * 2.0;
    }

    this.ventShimmer.visible = state.prison.inPrison;
    if (this.prisonGateObj) {
      this.prisonGateObj.rotation.y = state.prison.inPrison ? 0 : Math.PI * 0.48;
    }

    // 4. Patrolling Stronghold Sentinels + Aura Sight highlights
    const auraSightActive = state.powers.activeAuraSightSec > 0;
    for (let i = 0; i < this.guards.length; i++) {
      const gv = this.guards[i];
      const gs = state.stronghold.guards.find((g) => g.id === gv.id);
      if (!gs || gs.hp <= 0 || state.storyPhase === 'escaped') {
        gv.mesh.visible = false;
        continue;
      }
      gv.mesh.visible = true;
      const gy = getTerrainHeight(gs.x, gs.z);
      const safeDt = Math.min(0.05, Math.max(0.001, dt));
      if (gv.pos.lengthSq() < 0.001 || Math.hypot(gs.x - gv.pos.x, gs.z - gv.pos.z) > 10) {
        gv.pos.set(gs.x, gy, gs.z);
        gv.mesh.rotation.y = gs.yaw;
      } else {
        gv.pos.x = THREE.MathUtils.damp(gv.pos.x, gs.x, 12, safeDt);
        gv.pos.y = THREE.MathUtils.damp(gv.pos.y, gy, 14, safeDt);
        gv.pos.z = THREE.MathUtils.damp(gv.pos.z, gs.z, 12, safeDt);
        let yd = gs.yaw - gv.mesh.rotation.y;
        while (yd > Math.PI) yd -= Math.PI * 2;
        while (yd < -Math.PI) yd += Math.PI * 2;
        gv.mesh.rotation.y += yd * (1 - Math.exp(-10 * safeDt));
      }
      gv.mesh.position.copy(gv.pos);
      const hot = gs.alert >= 50 || state.stronghold.alertLevel >= 60;
      gv.visionMat.color.setHex(hot ? 0xef4444 : gs.alert >= 20 ? 0xf59e0b : 0xa855f7);
      gv.visionMat.opacity = hot ? 0.18 : 0.10;
      gv.sightBeacon.visible = auraSightActive;
      gv.sightBeacon.rotation.y = elapsedSec * 2.8;
    }

    // 5. Outer Reef Blockade Pillars (clear once escaped/defeated)
    this.outerReefGroup.visible = !state.boss.defeated && state.storyPhase !== 'escaped';

    // 6. Autonomous Roaming Aura King Silhouette
    const showRoamingKing =
      state.boss.combatPhase === 'inactive' &&
      !state.boss.defeated &&
      state.storyPhase !== 'escaped' &&
      !state.prison.inPrison;
    this.roamingKingRoot.visible = showRoamingKing;
    if (showRoamingKing) {
      const ky = getTerrainHeight(state.auraKingAI.x, state.auraKingAI.z);
      const safeDt = Math.min(0.05, Math.max(0.001, dt));
      if (
        this.roamingKingRoot.position.lengthSq() < 0.001 ||
        Math.hypot(state.auraKingAI.x - this.roamingKingRoot.position.x, state.auraKingAI.z - this.roamingKingRoot.position.z) > 12
      ) {
        this.roamingKingRoot.position.set(state.auraKingAI.x, ky, state.auraKingAI.z);
        this.roamingKingRoot.rotation.y = state.auraKingAI.yaw;
      } else {
        this.roamingKingRoot.position.x = THREE.MathUtils.damp(this.roamingKingRoot.position.x, state.auraKingAI.x, 11, safeDt);
        this.roamingKingRoot.position.y = THREE.MathUtils.damp(this.roamingKingRoot.position.y, ky, 12, safeDt);
        this.roamingKingRoot.position.z = THREE.MathUtils.damp(this.roamingKingRoot.position.z, state.auraKingAI.z, 11, safeDt);
        let kd = state.auraKingAI.yaw - this.roamingKingRoot.rotation.y;
        while (kd > Math.PI) kd -= Math.PI * 2;
        while (kd < -Math.PI) kd += Math.PI * 2;
        this.roamingKingRoot.rotation.y += kd * (1 - Math.exp(-9 * safeDt));
      }
      const isHunting = state.auraKingAI.awareness === 'hunting' || state.auraKingAI.awareness === 'catching';
      this.kingAuraLight.color.setHex(isHunting ? 0xf59e0b : 0xa855f7);
      this.kingAuraLight.intensity = isHunting ? 4.8 : 2.6;
      this.kingSightHalo.visible = auraSightActive;
      this.kingSightHalo.rotation.y = -elapsedSec * 2.4;
    }

    // 7. Sovereign Cleave shockwave animation
    if (this.cleaveTimer > 0) {
      this.cleaveTimer = Math.max(0, this.cleaveTimer - dt);
      const p = 1 - this.cleaveTimer / 0.52;
      const s = 1 + p * (POWER_TUNING.CLEAVE_RADIUS_M - 0.8);
      this.cleaveRing.scale.setScalar(s);
      (this.cleaveRing.material as THREE.MeshBasicMaterial).opacity = 0.88 * (1 - p);
      if (this.cleaveTimer <= 0) {
        this.cleaveRing.visible = false;
      }
    }
    if (this.voyageHidden) {
      this.applyVoyageVisibility(true);
    }
  }

  private applyVoyageVisibility(hidden: boolean): void {
    this.citadelRoot.visible = !hidden;
    this.ventShimmer.visible = !hidden;
    if (hidden) {
      this.breadcrumbGroup.visible = false;
      this.caveRidgeLight.visible = false;
      this.armoryRifleProp.visible = false;
      this.armoryHarpoonProp.visible = false;
      this.lockerBeacon.visible = false;
      this.roamingKingRoot.visible = false;
      for (let i = 0; i < this.shrines.length; i++) {
        this.shrines[i].root.visible = false;
        this.shrines[i].light.visible = false;
      }
      for (let i = 0; i < this.guards.length; i++) {
        this.guards[i].mesh.visible = false;
      }
    } else {
      for (let i = 0; i < this.shrines.length; i++) {
        this.shrines[i].root.visible = true;
        this.shrines[i].light.visible = true;
      }
    }
  }

  public setVoyageMode(inVoyage: boolean): void {
    if (this.voyageHidden === inVoyage) return;
    this.voyageHidden = inVoyage;
    this.applyVoyageVisibility(inVoyage);
  }

  public setReflectionMode(reflecting: boolean): void {
    if (reflecting) {
      this.reflSavedVis.length = 0;
      const hideTemp = (obj: THREE.Object3D) => {
        if (obj.visible) {
          this.reflSavedVis.push({ obj, vis: true });
          obj.visible = false;
        }
      };
      hideTemp(this.breadcrumbGroup);
      hideTemp(this.caveRidgeLight);
      hideTemp(this.armoryRifleProp);
      hideTemp(this.armoryHarpoonProp);
      hideTemp(this.lockerBeacon);
      hideTemp(this.ventShimmer);
      for (let i = 0; i < this.shrines.length; i++) {
        hideTemp(this.shrines[i].root);
        hideTemp(this.shrines[i].light);
      }
      for (let i = 0; i < this.guards.length; i++) {
        hideTemp(this.guards[i].mesh);
      }
    } else {
      for (let i = 0; i < this.reflSavedVis.length; i++) {
        const entry = this.reflSavedVis[i];
        entry.obj.visible = entry.vis;
      }
      this.reflSavedVis.length = 0;
    }
  }

  public findHoveredProp(
    camOrigin: THREE.Vector3,
    camDir: THREE.Vector3,
    state: SurvivalState,
    maxDist: number
  ): StoryHoverTarget | null {
    let bestDot = 0.90;
    let best: StoryHoverTarget | null = null;

    const consider = (
      candidatePos: THREE.Vector3,
      hitHeightOffset: number,
      distCap: number,
      build: (dist: number) => StoryHoverTarget
    ) => {
      _v1.set(candidatePos.x, candidatePos.y + hitHeightOffset, candidatePos.z).sub(camOrigin);
      const dist = _v1.length();
      if (dist > distCap) return;
      _v1.divideScalar(Math.max(0.001, dist));
      const dot = camDir.dot(_v1);
      if (dot > bestDot) {
        bestDot = dot;
        best = build(dist);
      }
    };

    for (const sh of this.shrines) {
      const def = POWER_TUNING.SHRINES.find((s) => s.id === sh.id)!;
      const unlocked = state.powers.unlocked.includes(sh.id);
      consider(sh.pos, 1.35, maxDist + 1.2, (dist) => ({
        kind: 'shrine',
        powerId: sh.id,
        pos: sh.pos,
        label: unlocked ? `${def.name} (Awakened)` : `Awaken ${def.name} [E]`,
        dist,
      }));
    }

    if (this.armoryRifleProp.visible) {
      consider(this.riflePos, 0.05, maxDist + 0.8, (dist) => ({
        kind: 'armory_item',
        armoryTarget: 'aura_rifle',
        pos: this.riflePos,
        label: 'Steal Aura-Infused Rifle [E]',
        dist,
      }));
    }

    if (this.armoryHarpoonProp.visible) {
      consider(this.harpoonPos, 0.05, maxDist + 0.8, (dist) => ({
        kind: 'armory_item',
        armoryTarget: 'harpoon_gun',
        pos: this.harpoonPos,
        label: 'Steal Pneumatic Harpoon Gun [E]',
        dist,
      }));
    }

    if (!state.prison.lockerRecovered && state.prison.confiscatedItems.some(Boolean)) {
      consider(this.lockerPos, 0.1, maxDist + 1.0, (dist) => ({
        kind: 'evidence_locker',
        pos: this.lockerPos,
        label: 'Reclaim Gear from Evidence Locker [E]',
        dist,
      }));
    }

    if (state.prison.inPrison) {
      consider(this.gatePos, 1.0, maxDist + 1.2, (dist) => ({
        kind: 'prison_gate',
        pos: this.gatePos,
        label: 'Inspect Cell Gate / Pick Lock / Escape Options [E]',
        dist,
      }));
      consider(this.ventPos, 0.1, maxDist + 1.2, (dist) => ({
        kind: 'prison_vent',
        pos: this.ventPos,
        label: 'Squeeze Cracked Wall Vent [E] (Requires Crouch/Prone)',
        dist,
      }));
    }

    if (best) return best;

    for (const gv of this.guards) {
      if (!gv.mesh.visible) continue;
      consider(gv.pos, 1.15, maxDist + 1.0, (dist) => ({
        kind: 'stronghold_guard',
        guardId: gv.id,
        pos: gv.pos,
        label: 'Stronghold Aura Sentinel',
        dist,
      }));
    }

    return best;
  }

  public findGuardInRay(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number
  ): { guardId: string; pos: THREE.Vector3; dist: number } | null {
    let closest: { guardId: string; pos: THREE.Vector3; dist: number } | null = null;
    for (const gv of this.guards) {
      if (!gv.mesh.visible) continue;
      const center = _v1.set(gv.pos.x, gv.pos.y + 1.1, gv.pos.z);
      _v2.copy(center).sub(origin);
      const along = _v2.dot(dir);
      if (along < 0 || along > maxDist + 0.8) continue;
      _v2.copy(origin).addScaledVector(dir, along);
      if (_v2.distanceTo(center) <= 0.95) {
        if (!closest || along < closest.dist) {
          closest = { guardId: gv.id, pos: gv.pos.clone(), dist: along };
        }
      }
    }
    return closest;
  }

  public dispose() {
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
