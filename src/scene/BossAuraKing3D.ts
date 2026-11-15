/**
 * 3D Encounter Manager for Final Boss: "Lavans Bali — The Aura King".
 * Manages:
 *  - Blender-rigged `lavans_bali.glb` + 8 AnimationClips + pulsing purple-gold Aura Shader
 *  - Shore Sanctum Arena (`boss_arena_shore.glb`) with cover pillars + colliders, braziers,
 *    destructible Aura Crystals, and explosive Flight 404 Fuel Barrels
 *  - Night Cliffside Watcher Silhouette & glowing Cave/Ruin foreshadowing glyphs (Acts 2–4)
 *  - Pre-allocated GPU Pools (Aura Orbs, Shockwaves, Aura Shades, Player Projectiles, InstancedMesh VFX)
 *  - Phase 1 (Shore Melee & Slams), Phase 2 (Crystal Shield & Shades), Phase 3 (Boat Storm Final Battle)
 */

import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { audio } from '../audio/audio.ts';
import { getBossDifficultyConfig } from '../survival/boss.ts';
import { BOSS_TUNING, COMBAT_TUNING, WORLD } from '../survival/config.ts';
import type { BossCombatPhase, SurvivalState } from '../survival/types.ts';
import { WorldCollider } from '../survival/world.ts';
import { VOYAGE_STAGE_ORIGIN, VoyageSceneController } from './BoatAndVoyage3D.ts';
import { LoadedGLBSet } from './GLBModelBank.ts';

export type BossClipName =
  | 'idle'
  | 'walk'
  | 'intro'
  | 'melee_swing'
  | 'aura_cast'
  | 'stagger'
  | 'rage_transition'
  | 'defeat';

export interface ActiveProjectile {
  active: boolean;
  kind: 'arrow' | 'fire_bomb' | 'flare' | 'spear';
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  damage: number;
  mesh: THREE.Object3D;
}

interface PooledOrb {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  mesh: THREE.Mesh;
}

interface PooledShockwave {
  active: boolean;
  origin: THREE.Vector3;
  radius: number;
  maxRadius: number;
  hitPlayer: boolean;
  mesh: THREE.Object3D;
}

interface PooledShade {
  active: boolean;
  hp: number;
  maxHp: number;
  pos: THREE.Vector3;
  attackCd: number;
  mesh: THREE.Object3D;
}

interface PooledParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

export interface BossUpdateContext {
  dt: number;
  elapsedSec: number;
  state: SurvivalState;
  playerPos: THREE.Vector3;
  playerVel: THREE.Vector3;
  playerEyeHeight: number;
  isPlayerBlocking: boolean;
  isPlayerParrying: boolean;
  isPlayerDodgeIFrame: boolean;
  isPlayerGrounded: boolean;
  getTerrainHeight: (x: number, z: number) => number;
  voyageCtrl: VoyageSceneController | null;
}

export interface ProjectileHitEvent {
  target: 'boss' | 'shade' | 'crystal' | 'barrel' | 'ground';
  index: number;
  damage: number;
  weaponKind: ActiveProjectile['kind'];
  isBurn: boolean;
  isWeakpoint: boolean;
  pos: THREE.Vector3;
}

export interface BossUpdateResult {
  shakeAmount: number;
  heatHazeBoost: number;
  slowMoScale: number;
  stormLightningFlash: number;
  cutsceneCamPos: THREE.Vector3 | null;
  cutsceneCamLook: THREE.Vector3 | null;
  playerDamageTaken: number;
  playerBlockedHit: boolean;
  playerParriedHit: boolean;
  subtitleOverride: string | null;
  clearWeatherToSunrise: boolean;
  advanceToPhase: BossCombatPhase | null;
  fightDefeatComplete: boolean;
  projectileHits: readonly ProjectileHitEvent[];
}

const _tmpV1 = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();
const _tmpMat4 = new THREE.Matrix4();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

export class BossAuraKing3D {
  public readonly root = new THREE.Group();
  public readonly arenaGroup: THREE.Group;
  public readonly arenaColliders: WorldCollider[] = [];
  private readonly pillarTopYs = new Map<string, number>();

  private readonly bossRoot: THREE.Group;
  private readonly bossMixer: THREE.AnimationMixer;
  private readonly bossClips = new Map<BossClipName, THREE.AnimationAction>();
  private activeClip: BossClipName = 'idle';

  private readonly auraShellMats: THREE.MeshStandardMaterial[] = [];
  private readonly eyeGlowMats: THREE.MeshStandardMaterial[] = [];
  private readonly bossAuraLight: THREE.PointLight;
  private readonly weakpointBeacon: THREE.Mesh;

  // Destructible Crystals & Explosive Barrels inside Arena
  private readonly crystalMeshes: (THREE.Object3D | null)[] = [null, null, null];
  private readonly crystalWorldPos: THREE.Vector3[] = [];
  private readonly barrelMeshes: (THREE.Object3D | null)[] = [null, null, null, null];
  private readonly barrelWorldPos: THREE.Vector3[] = [];
  private readonly crystalBeams: THREE.Mesh[] = [];

  // Foreshadowing props: Night Cliff Watcher & Cave/Ruin Glow Glyphs
  private readonly watcherRoot: THREE.Group;
  private watcherVanished = false;
  private readonly ruinGlyphsGroup = new THREE.Group();

  // Pre-allocated Combat Pools (zero per-frame allocations)
  private readonly orbPool: PooledOrb[] = [];
  private readonly shockwavePool: PooledShockwave[] = [];
  private readonly shadePool: PooledShade[] = [];
  private readonly playerProjPool: ActiveProjectile[] = [];
  private readonly frameProjHits: ProjectileHitEvent[] = [];
  private readonly particlePool: PooledParticle[] = [];
  private readonly particleInstanced: THREE.InstancedMesh;

  // Live Boss Spatial & AI Timers
  public readonly bossPos = new THREE.Vector3(BOSS_TUNING.ARENA_CENTER_X, 0, BOSS_TUNING.ARENA_CENTER_Z - 14);
  public bossYaw = 0;
  private bossAiState:
    | 'pursue'
    | 'windup_melee'
    | 'recover_melee'
    | 'windup_slam'
    | 'cast_orbs'
    | 'dash'
    | 'stagger' = 'pursue';
  private aiTimer = 0;
  private orbCooldown = 2.5;
  private slamCooldown = 7.5;
  private dashCooldown = 9.0;
  private cutsceneTimer = 0;
  private finisherSlowMoTimer = 0;
  private lastKnownPhase: BossCombatPhase = 'inactive';
  private meleeHitDealtInSwing = false;
  private stormFlashTimer = 0;

  // Teleport / Charge target during dash
  private readonly dashTarget = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    glbs: LoadedGLBSet,
    getTerrainHeight: (x: number, z: number) => number
  ) {
    this.root.name = 'BossEncounter_System';
    scene.add(this.root);

    // -----------------------------------------------------------------------
    // 1. LAVANS BALI RIGGED MODEL + DYNAMIC AURA MATERIALS
    // -----------------------------------------------------------------------
    this.bossRoot = SkeletonUtils.clone(glbs.boss.lavansBali) as THREE.Group;
    this.bossRoot.name = 'LavansBali_Boss';
    this.bossRoot.visible = false;
    this.bossRoot.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      const nm = (m.name || '').toLowerCase();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        const std = mat as THREE.MeshStandardMaterial;
        if (!std || !std.isMeshStandardMaterial) return;
        std.userData.__skipScenePBR = true;
        if (nm.includes('aura_shell')) {
          std.transparent = true;
          std.depthWrite = false;
          std.blending = THREE.AdditiveBlending;
          std.opacity = 0.55;
          std.emissive.setHex(0xa855f7);
          std.emissiveIntensity = 3.2;
          this.auraShellMats.push(std);
        } else if (nm.includes('eyes_emissive') || nm.includes('scepter_crystal')) {
          std.emissive.setHex(nm.includes('eyes') ? 0xfbbf24 : 0xc084fc);
          std.emissiveIntensity = 5.0;
          this.eyeGlowMats.push(std);
        }
      });
    });
    this.root.add(this.bossRoot);

    this.bossAuraLight = new THREE.PointLight(0xa855f7, 4.2, 24, 1.4);
    this.bossAuraLight.position.set(0, 1.9, 0);
    this.bossRoot.add(this.bossAuraLight);

    this.weakpointBeacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 1),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.weakpointBeacon.position.set(0, 1.72, -0.35);
    this.weakpointBeacon.visible = false;
    this.bossRoot.add(this.weakpointBeacon);

    this.bossMixer = new THREE.AnimationMixer(this.bossRoot);
    for (const clip of glbs.boss.lavansAnimations) {
      const action = this.bossMixer.clipAction(clip);
      const name = clip.name as BossClipName;
      this.bossClips.set(name, action);
    }
    this.playClip('idle', 0.05, true);

    // -----------------------------------------------------------------------
    // 2. SHORE ARENA RUINS, COVER PILLARS, CRYSTALS & EXPLOSIVE BARRELS
    // -----------------------------------------------------------------------
    const arenaY = getTerrainHeight(BOSS_TUNING.ARENA_CENTER_X, BOSS_TUNING.ARENA_CENTER_Z);
    this.arenaGroup = SkeletonUtils.clone(glbs.boss.arenaShore) as THREE.Group;
    this.arenaGroup.name = 'BossArena_ShoreRuins';
    this.arenaGroup.position.set(BOSS_TUNING.ARENA_CENTER_X, arenaY - 0.06, BOSS_TUNING.ARENA_CENTER_Z);
    this.root.add(this.arenaGroup);
    this.arenaGroup.updateMatrixWorld(true);

    const tmpBox = new THREE.Box3();
    const tmpSize = new THREE.Vector3();
    const tmpCenter = new THREE.Vector3();

    this.arenaGroup.traverse((obj) => {
      const n = obj.name || '';
      const up = n.toUpperCase();
      if (up.startsWith('COLLIDER_')) {
        obj.visible = false;
        const m = obj as THREE.Mesh;
        if (m.isMesh && m.geometry) {
          tmpBox.setFromObject(m);
          tmpBox.getSize(tmpSize);
          tmpBox.getCenter(tmpCenter);
          const groundY = getTerrainHeight(tmpCenter.x, tmpCenter.z);
          m.position.y += groundY - (arenaY - 0.06);
          const colId = `arena_${n}`;
          this.pillarTopYs.set(colId, groundY + tmpSize.y);
          this.arenaColliders.push({
            id: colId,
            kind: 'circle',
            x: tmpCenter.x,
            z: tmpCenter.z,
            radius: Math.max(0.65, Math.max(tmpSize.x, tmpSize.z) * 0.46),
          });
        }
        return;
      }
      // Terrain-snap individual arena pillars, pedestals, crystals, barrels & braziers (preserving local vertical offset)
      if (
        n.startsWith('ArenaPillar_') ||
        n.startsWith('AuraPedestal_') ||
        n.startsWith('AuraCrystal_') ||
        n.startsWith('ExplosiveBarrel_') ||
        n.startsWith('ArenaBrazier')
      ) {
        const snapWp = new THREE.Vector3();
        obj.getWorldPosition(snapWp);
        const snapGroundY = getTerrainHeight(snapWp.x, snapWp.z);
        obj.position.y += snapGroundY - (arenaY - 0.06);
        obj.updateMatrixWorld(true);
      }
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          if (!std || !std.isMeshStandardMaterial) continue;
          if (std.name === 'Arena_Coals' || n.startsWith('ArenaBrazierCoals_')) {
            std.color.setHex(0x9a3412);
            std.emissive.setHex(0xea580c);
            std.emissiveIntensity = 1.25;
          } else if (std.name === 'Arena_GoldRune') {
            std.emissiveIntensity = Math.min(std.emissiveIntensity || 1.2, 1.35);
          }
        }
      }
      if (n.startsWith('AuraCrystal_')) {
        const idx = Number(n.split('_')[1]);
        if (idx >= 0 && idx < 3) {
          this.crystalMeshes[idx] = obj;
          (obj.userData as { baseLocalY?: number }).baseLocalY = obj.position.y;
          const wp = new THREE.Vector3();
          obj.getWorldPosition(wp);
          this.crystalWorldPos[idx] = wp;
        }
      } else if (n.startsWith('ExplosiveBarrel_')) {
        const idx = Number(n.split('_')[1]);
        if (idx >= 0 && idx < 4) {
          this.barrelMeshes[idx] = obj;
          const wp = new THREE.Vector3();
          obj.getWorldPosition(wp);
          this.barrelWorldPos[idx] = wp;
        }
      }
    });

    // Shield tether beams from crystals to boss
    const beamGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 8);
    beamGeo.translate(0, 0.5, 0);
    beamGeo.rotateX(Math.PI * 0.5);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 3; i++) {
      const bm = new THREE.Mesh(beamGeo, beamMat);
      bm.visible = false;
      this.root.add(bm);
      this.crystalBeams.push(bm);
    }

    // -----------------------------------------------------------------------
    // 3. ACTS 2-4 FORESHADOWING: NIGHT WATCHER SILHOUETTE & GLOWING SYMBOLS
    // -----------------------------------------------------------------------
    this.watcherRoot = SkeletonUtils.clone(glbs.boss.lavansBali) as THREE.Group;
    this.watcherRoot.name = 'LavansBali_NightWatcher';
    const wy = getTerrainHeight(BOSS_TUNING.WATCHER_CLIFF_POS.x, BOSS_TUNING.WATCHER_CLIFF_POS.z);
    this.watcherRoot.position.set(
      BOSS_TUNING.WATCHER_CLIFF_POS.x,
      wy,
      BOSS_TUNING.WATCHER_CLIFF_POS.z
    );
    this.watcherRoot.rotation.y = Math.atan2(
      -BOSS_TUNING.WATCHER_CLIFF_POS.x,
      60 - BOSS_TUNING.WATCHER_CLIFF_POS.z
    );
    this.watcherRoot.visible = false;
    this.watcherRoot.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        const std = mat as THREE.MeshStandardMaterial;
        if (!std?.isMeshStandardMaterial) return;
        if ((m.name || '').toLowerCase().includes('eyes')) {
          std.emissive.setHex(0xfbbf24);
          std.emissiveIntensity = 8.0;
        } else {
          std.color.setHex(0x090612);
          std.roughness = 0.95;
          std.emissive.setHex(0x3b0764);
          std.emissiveIntensity = 0.45;
        }
      });
    });
    this.root.add(this.watcherRoot);

    // Carved glowing purple-gold aura sigil rings at Cave & Ruins to foreshadow the King
    const glyphGeo = new THREE.RingGeometry(1.15, 1.38, 24);
    glyphGeo.rotateX(-Math.PI / 2);
    const glyphMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const spot of [WORLD.CAVE_GROTTO_POS, WORLD.ANCIENT_RUINS_POS]) {
      const gMesh = new THREE.Mesh(glyphGeo, glyphMat);
      gMesh.position.set(spot.x, getTerrainHeight(spot.x, spot.z) + 0.08, spot.z);
      this.ruinGlyphsGroup.add(gMesh);
    }
    this.root.add(this.ruinGlyphsGroup);

    // -----------------------------------------------------------------------
    // 4. PRE-ALLOCATED POOLS (Orbs, Shockwaves, Shades, Player Projectiles, Particles)
    // -----------------------------------------------------------------------
    const orbGeo = new THREE.SphereGeometry(0.34, 12, 10);
    const orbMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < BOSS_TUNING.POOL_AURA_ORBS; i++) {
      const mesh = new THREE.Mesh(orbGeo, orbMat);
      mesh.visible = false;
      this.root.add(mesh);
      this.orbPool.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        mesh,
      });
    }

    for (let i = 0; i < BOSS_TUNING.POOL_SHOCKWAVES; i++) {
      const mesh = SkeletonUtils.clone(glbs.boss.shockwaveRing);
      mesh.visible = false;
      this.root.add(mesh);
      this.shockwavePool.push({
        active: false,
        origin: new THREE.Vector3(),
        radius: 0.5,
        maxRadius: BOSS_TUNING.SHOCKWAVE_MAX_RADIUS_M,
        hitPlayer: false,
        mesh,
      });
    }

    for (let i = 0; i < BOSS_TUNING.SHADE_MAX_COUNT; i++) {
      const mesh = SkeletonUtils.clone(glbs.boss.auraShade);
      mesh.visible = false;
      this.root.add(mesh);
      this.shadePool.push({
        active: false,
        hp: BOSS_TUNING.SHADE_HP,
        maxHp: BOSS_TUNING.SHADE_HP,
        pos: new THREE.Vector3(),
        attackCd: 1.5,
        mesh,
      });
    }

    // Player projectile meshes (arrow / flare / firebomb / spear)
    const fallbackArrowGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.72, 6);
    fallbackArrowGeo.rotateX(Math.PI * 0.5);
    for (let i = 0; i < BOSS_TUNING.POOL_PLAYER_PROJECTILES; i++) {
      const grp = new THREE.Group();
      const arrowClone = SkeletonUtils.clone(glbs.tools.arrow);
      arrowClone.name = 'Proj_Arrow';
      const flareMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffedd5 })
      );
      flareMesh.name = 'Proj_Flare';
      const bombClone = SkeletonUtils.clone(glbs.tools.fireBomb);
      bombClone.name = 'Proj_Bomb';
      grp.add(arrowClone, flareMesh, bombClone);
      grp.visible = false;
      this.root.add(grp);
      this.playerProjPool.push({
        active: false,
        kind: 'arrow',
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        damage: 30,
        mesh: grp,
      });
    }

    const pGeo = new THREE.IcosahedronGeometry(0.14, 0);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particleInstanced = new THREE.InstancedMesh(pGeo, pMat, BOSS_TUNING.POOL_VFX_PARTICLES);
    this.particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleInstanced.frustumCulled = false;
    this.root.add(this.particleInstanced);

    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < BOSS_TUNING.POOL_VFX_PARTICLES; i++) {
      this.particleInstanced.setMatrixAt(i, zeroMat);
      this.particleInstanced.setColorAt(i, new THREE.Color(0xa855f7));
      this.particlePool.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(0xa855f7),
      });
    }
  }

  private playClip(name: BossClipName, fadeSec: number = 0.22, loop: boolean = true) {
    const next = this.bossClips.get(name);
    if (!next) return;
    if (this.activeClip === name && loop && next.isRunning()) return;
    const prev = this.bossClips.get(this.activeClip);
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.fadeIn(fadeSec);
    next.play();
    if (prev && prev !== next) {
      prev.fadeOut(fadeSec);
    }
    this.activeClip = name;
  }

  public spawnBurstParticles(
    origin: THREE.Vector3,
    count: number,
    colorHex: number,
    speed: number = 6.5,
    size: number = 1.0,
    lifeSec: number = 0.75
  ) {
    let spawned = 0;
    for (let i = 0; i < this.particlePool.length && spawned < count; i++) {
      const p = this.particlePool[i];
      if (p.active) continue;
      p.active = true;
      p.pos.copy(origin);
      const a = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.25) * Math.PI;
      const sp = speed * (0.45 + Math.random() * 0.75);
      p.vel.set(Math.cos(a) * Math.cos(elev) * sp, Math.abs(Math.sin(elev)) * sp + 1.2, Math.sin(a) * Math.cos(elev) * sp);
      p.maxLife = lifeSec * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = size * (0.65 + Math.random() * 0.7);
      p.color.setHex(colorHex);
      spawned++;
    }
  }

  public spawnPlayerProjectile(
    kind: ActiveProjectile['kind'],
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    damage: number
  ) {
    for (const p of this.playerProjPool) {
      if (p.active) continue;
      p.active = true;
      p.kind = kind;
      p.pos.copy(origin);
      p.vel.copy(dir).normalize().multiplyScalar(speed);
      p.life = 4.0;
      p.damage = damage;
      p.mesh.position.copy(p.pos);
      p.mesh.visible = true;
      p.mesh.traverse((child) => {
        if (child.name === 'Proj_Arrow') child.visible = kind === 'arrow' || kind === 'spear';
        if (child.name === 'Proj_Flare') child.visible = kind === 'flare';
        if (child.name === 'Proj_Bomb') child.visible = kind === 'fire_bomb';
      });
      return;
    }
  }

  public getActiveProjectiles(): readonly ActiveProjectile[] {
    return this.playerProjPool;
  }

  public findHoveredCrystalOrBarrel(
    camOrigin: THREE.Vector3,
    camDir: THREE.Vector3,
    state: SurvivalState,
    maxDist: number
  ): { kind: 'crystal' | 'barrel'; index: number; pos: THREE.Vector3; dot: number } | null {
    if (state.boss.combatPhase === 'phase3_boat' || state.boss.combatPhase === 'defeat_cutscene') {
      return null;
    }
    let bestDot = 0.962;
    let best: { kind: 'crystal' | 'barrel'; index: number; pos: THREE.Vector3; dot: number } | null = null;

    if (state.boss.phase === 2 && state.boss.combatPhase === 'phase2') {
      for (let i = 0; i < 3; i++) {
        if (!state.boss.crystalsAlive[i]) continue;
        const pos = this.crystalWorldPos[i];
        if (!pos) continue;
        _tmpV1.copy(pos).add(new THREE.Vector3(0, 1.4, 0)).sub(camOrigin);
        const dist = _tmpV1.length();
        if (dist < maxDist) {
          _tmpV1.divideScalar(Math.max(0.001, dist));
          const dot = camDir.dot(_tmpV1);
          if (dot > bestDot) {
            bestDot = dot;
            best = { kind: 'crystal', index: i, pos, dot };
          }
        }
      }
    }

    for (let i = 0; i < 4; i++) {
      if (!state.boss.barrelsIntact[i]) continue;
      const pos = this.barrelWorldPos[i];
      if (!pos) continue;
      _tmpV1.copy(pos).add(new THREE.Vector3(0, 0.55, 0)).sub(camOrigin);
      const dist = _tmpV1.length();
      if (dist < maxDist) {
        _tmpV1.divideScalar(Math.max(0.001, dist));
        const dot = camDir.dot(_tmpV1);
        if (dot > bestDot) {
          bestDot = dot;
          best = { kind: 'barrel', index: i, pos, dot };
        }
      }
    }

    return best;
  }

  public findHoveredShade(
    camOrigin: THREE.Vector3,
    camDir: THREE.Vector3,
    maxDist: number
  ): { index: number; pos: THREE.Vector3 } | null {
    for (let i = 0; i < this.shadePool.length; i++) {
      const sh = this.shadePool[i];
      if (!sh.active) continue;
      _tmpV1.copy(sh.pos).add(new THREE.Vector3(0, 1.0, 0)).sub(camOrigin);
      const d = _tmpV1.length();
      if (d <= maxDist) {
        _tmpV1.divideScalar(Math.max(0.001, d));
        if (camDir.dot(_tmpV1) > 0.85) {
          return { index: i, pos: sh.pos };
        }
      }
    }
    return null;
  }

  public damageShade(index: number, dmg: number): boolean {
    const sh = this.shadePool[index];
    if (!sh || !sh.active) return false;
    sh.hp -= dmg;
    this.spawnBurstParticles(sh.pos.clone().add(new THREE.Vector3(0, 1.0, 0)), 14, 0xa855f7, 5.5, 0.9, 0.5);
    if (sh.hp <= 0) {
      sh.active = false;
      sh.mesh.visible = false;
      return true;
    }
    return false;
  }

  public getCrystalWorldPos(index: number): THREE.Vector3 | undefined {
    return this.crystalWorldPos[index];
  }

  public getBarrelWorldPos(index: number): THREE.Vector3 | undefined {
    return this.barrelWorldPos[index];
  }

  public forceStagger() {
    this.bossAiState = 'stagger';
    this.aiTimer = BOSS_TUNING.STAGGER_DURATION_SEC;
    this.playClip('stagger', 0.14, true);
  }

  public isStaggered(): boolean {
    return this.bossAiState === 'stagger';
  }

  public getBossHitTarget(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
    state: SurvivalState
  ): { isWeakpoint: boolean; dist: number; pos: THREE.Vector3 } | null {
    if (!this.bossRoot.visible) return null;
    const targetCenter = _tmpV1.set(this.bossPos.x, this.bossPos.y + 1.4, this.bossPos.z);
    const toTarget = _tmpV2.copy(targetCenter).sub(origin);
    const along = toTarget.dot(dir);
    if (along < 0 || along > maxDist + 1.15) return null;
    // Perpendicular distance from ray to boss vertical cylinder
    const closestX = origin.x + dir.x * along;
    const closestY = origin.y + dir.y * along;
    const closestZ = origin.z + dir.z * along;
    const horizDist = Math.hypot(closestX - this.bossPos.x, closestZ - this.bossPos.z);
    const relY = closestY - this.bossPos.y;
    if (horizDist <= 1.15 && relY >= -0.2 && relY <= 2.65) {
      const isWeakpoint =
        this.bossAiState === 'stagger' ||
        state.boss.staggeredSec > 0 ||
        (relY >= 1.25 && relY <= 2.05);
      return {
        isWeakpoint,
        dist: Math.max(0.1, along),
        pos: new THREE.Vector3(closestX, closestY, closestZ),
      };
    }
    return null;
  }

  private spawnOrb(from: THREE.Vector3, dir: THREE.Vector3, speed: number) {
    for (const orb of this.orbPool) {
      if (orb.active) continue;
      orb.active = true;
      orb.pos.copy(from);
      orb.vel.copy(dir).normalize().multiplyScalar(speed);
      orb.life = 4.5;
      orb.mesh.position.copy(orb.pos);
      orb.mesh.visible = true;
      return;
    }
  }

  private spawnShockwave(origin: THREE.Vector3, maxRadius: number = BOSS_TUNING.SHOCKWAVE_MAX_RADIUS_M) {
    for (const sw of this.shockwavePool) {
      if (sw.active) continue;
      sw.active = true;
      sw.origin.copy(origin);
      sw.radius = 0.8;
      sw.maxRadius = maxRadius;
      sw.hitPlayer = false;
      sw.mesh.position.set(origin.x, origin.y + 0.14, origin.z);
      sw.mesh.scale.set(0.8, 1.0, 0.8);
      sw.mesh.visible = true;
      return;
    }
  }

  private summonShades(count: number, center: THREE.Vector3, getTerrainHeight: (x: number, z: number) => number) {
    let activeCount = this.shadePool.filter((s) => s.active).length;
    for (let i = 0; i < this.shadePool.length && activeCount < count; i++) {
      const sh = this.shadePool[i];
      if (sh.active) continue;
      const ang = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.5;
      const sx = center.x + Math.cos(ang) * 7.5;
      const sz = center.z + Math.sin(ang) * 7.5;
      sh.active = true;
      sh.hp = BOSS_TUNING.SHADE_HP;
      sh.maxHp = BOSS_TUNING.SHADE_HP;
      sh.pos.set(sx, getTerrainHeight(sx, sz), sz);
      sh.attackCd = 1.2 + i * 0.35;
      sh.mesh.position.copy(sh.pos);
      sh.mesh.visible = true;
      this.spawnBurstParticles(sh.pos.clone().add(new THREE.Vector3(0, 1.0, 0)), 18, 0x9333ea, 6.0, 1.1, 0.6);
      activeCount++;
    }
  }

  public clearAllCombatPools() {
    for (const o of this.orbPool) {
      o.active = false;
      o.mesh.visible = false;
    }
    for (const sw of this.shockwavePool) {
      sw.active = false;
      sw.mesh.visible = false;
    }
    for (const sh of this.shadePool) {
      sh.active = false;
      sh.mesh.visible = false;
    }
    for (const p of this.playerProjPool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  public resetArenaForRetry() {
    this.clearAllCombatPools();
    this.lastKnownPhase = 'inactive';
    this.bossAiState = 'pursue';
    this.cutsceneTimer = 0;
    this.finisherSlowMoTimer = 0;
    this.orbCooldown = 2.0;
    this.slamCooldown = 6.5;
    this.dashCooldown = 5.0;
  }

  public update(ctx: BossUpdateContext): BossUpdateResult {
    this.frameProjHits.length = 0;
    const result: BossUpdateResult = {
      shakeAmount: 0,
      heatHazeBoost: 0,
      slowMoScale: 1.0,
      stormLightningFlash: 0,
      cutsceneCamPos: null,
      cutsceneCamLook: null,
      playerDamageTaken: 0,
      playerBlockedHit: false,
      playerParriedHit: false,
      subtitleOverride: null,
      clearWeatherToSunrise: false,
      advanceToPhase: null,
      fightDefeatComplete: false,
      projectileHits: this.frameProjHits,
    };

    const { dt, elapsedSec, state, playerPos, getTerrainHeight } = ctx;
    const bossState = state.boss;
    const combatPhase = bossState.combatPhase;

    // -----------------------------------------------------------------------
    // 0. UPDATE POOLED PARTICLES & PLAYER PROJECTILES EVEN OUTSIDE CUTSCENES
    // -----------------------------------------------------------------------
    this.updateParticles(dt);

    // -----------------------------------------------------------------------
    // 1. FORESHADOWING: ACTS 2-4 CLIFF WATCHER SILHOUETTE & GLOW GLYPHS
    // -----------------------------------------------------------------------
    this.ruinGlyphsGroup.visible = state.act >= 2 && !bossState.defeated;
    if (this.ruinGlyphsGroup.visible) {
      this.ruinGlyphsGroup.rotation.y += dt * 0.25;
    }

    const hour = ((state.clock.hour % 24) + 24) % 24;
    const isDarkHours = hour >= 18.5 || hour < 6.0;
    const showWatcher =
      !this.watcherVanished &&
      !bossState.defeated &&
      combatPhase === 'inactive' &&
      state.act >= 2 &&
      state.act <= 4 &&
      isDarkHours;
    this.watcherRoot.visible = showWatcher;
    if (showWatcher) {
      const dWatch = Math.hypot(
        playerPos.x - this.watcherRoot.position.x,
        playerPos.z - this.watcherRoot.position.z
      );
      if (dWatch < BOSS_TUNING.WATCHER_VANISH_DIST_M) {
        this.watcherVanished = true;
        this.watcherRoot.visible = false;
        this.spawnBurstParticles(
          this.watcherRoot.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
          28,
          0xa855f7,
          6.0,
          1.25,
          0.95
        );
      }
    }

    // Toggle Crystal & Barrel Mesh visibility cleanly inside the Sanctum arena
    const nearSanctum =
      Math.hypot(playerPos.x - BOSS_TUNING.ARENA_CENTER_X, playerPos.z - BOSS_TUNING.ARENA_CENTER_Z) <=
      BOSS_TUNING.ARENA_RADIUS_M * 1.45;
    const showArenaObjects =
      combatPhase !== 'phase3_boat' &&
      combatPhase !== 'defeat_cutscene' &&
      combatPhase !== 'ended' &&
      (combatPhase !== 'inactive' || nearSanctum);
    for (let i = 0; i < 3; i++) {
      const m = this.crystalMeshes[i];
      if (!m) continue;
      const alive = showArenaObjects && (combatPhase === 'inactive' || bossState.crystalsAlive[i]);
      m.visible = alive;
      if (alive) {
        const baseY = (m.userData as { baseLocalY?: number }).baseLocalY ?? m.position.y;
        m.rotation.y = elapsedSec * 1.35 + i;
        m.position.y = baseY + Math.sin(elapsedSec * 2.1 + i * 1.3) * 0.14;
      }
      const beam = this.crystalBeams[i];
      const beamOn = combatPhase === 'phase2' && bossState.crystalsAlive[i];
      beam.visible = beamOn;
      if (beamOn && this.crystalWorldPos[i]) {
        const cPos = _tmpV1.copy(this.crystalWorldPos[i]);
        const bPos = _tmpV2.copy(this.bossPos);
        bPos.y += 1.45;
        beam.position.copy(cPos);
        beam.lookAt(bPos);
        beam.scale.set(1, 1, cPos.distanceTo(bPos));
      }
    }

    for (let i = 0; i < 4; i++) {
      const b = this.barrelMeshes[i];
      if (b) {
        b.visible = showArenaObjects && bossState.barrelsIntact[i];
      }
    }

    // -----------------------------------------------------------------------
    // 2. PHASE TRANSITION & SLOW-MO FINISHER MANAGEMENT
    // -----------------------------------------------------------------------
    if (combatPhase !== this.lastKnownPhase) {
      this.onEnterCombatPhase(combatPhase, getTerrainHeight);
      this.lastKnownPhase = combatPhase;
    }

    if (this.finisherSlowMoTimer > 0) {
      this.finisherSlowMoTimer = Math.max(0, this.finisherSlowMoTimer - dt);
      result.slowMoScale = BOSS_TUNING.FINISHER_SLOWMO_SCALE;
    }

    const effDt = dt * result.slowMoScale;

    if (combatPhase === 'inactive' || combatPhase === 'ended') {
      this.bossRoot.visible = false;
      this.clearAllCombatPools();
      return result;
    }

    this.bossRoot.visible = true;
    this.bossMixer.update(effDt);

    // Aura shimmer intensity reacts to state: stagger dims weak, cast/rage flares bright
    const inStagger = this.bossAiState === 'stagger' || bossState.staggeredSec > 0;
    const isFlaring =
      this.bossAiState === 'windup_melee' ||
      this.bossAiState === 'windup_slam' ||
      this.bossAiState === 'cast_orbs' ||
      combatPhase === 'phase2_cutscene';
    const pulse = 0.5 + 0.5 * Math.sin(elapsedSec * (isFlaring ? 12.0 : 4.2));
    const auraStrength = inStagger ? 0.35 : isFlaring ? 4.8 + pulse * 2.5 : 2.1 + pulse * 1.1;

    for (const am of this.auraShellMats) {
      am.emissive.setHex(inStagger ? 0x475569 : isFlaring ? 0xf59e0b : 0xa855f7);
      am.emissiveIntensity = auraStrength;
      am.opacity = inStagger ? 0.16 : isFlaring ? 0.85 : 0.48 + pulse * 0.15;
    }
    for (const em of this.eyeGlowMats) {
      em.emissiveIntensity = inStagger ? 0.9 : isFlaring ? 8.5 : 4.5 + pulse * 1.2;
    }
    this.bossAuraLight.intensity = inStagger ? 0.9 : isFlaring ? 7.5 : 3.8 + pulse * 1.2;
    this.bossAuraLight.color.setHex(inStagger ? 0x64748b : isFlaring ? 0xfbbf24 : 0xa855f7);
    this.weakpointBeacon.visible = bossState.phase === 3 || inStagger;
    if (this.weakpointBeacon.visible) {
      this.weakpointBeacon.rotation.y += effDt * 4.5;
      this.weakpointBeacon.scale.setScalar(0.85 + Math.sin(elapsedSec * 9.0) * 0.25);
    }
    if (isFlaring) result.heatHazeBoost = 0.0032;

    // -----------------------------------------------------------------------
    // 3. CUTSCENE PHASES (Intro / Phase 2 Rage / Phase 3 Boat / Defeat Sunrise)
    // -----------------------------------------------------------------------
    if (combatPhase === 'intro') {
      this.cutsceneTimer += dt;
      const t = this.cutsceneTimer / BOSS_TUNING.INTRO_DURATION_SEC;
      // Dramatic Sanctum descent reveal inside the open Rune Circle
      const cliffPos = _tmpV1.set(
        BOSS_TUNING.ARENA_CENTER_X,
        getTerrainHeight(BOSS_TUNING.ARENA_CENTER_X, BOSS_TUNING.ARENA_CENTER_Z - 6.5) + Math.max(0, (1 - t) * 4.2),
        BOSS_TUNING.ARENA_CENTER_Z - 6.5
      );
      this.bossPos.copy(cliffPos);
      this.bossYaw = 0;
      this.bossRoot.position.copy(this.bossPos);
      this.bossRoot.rotation.y = this.bossYaw;

      result.cutsceneCamPos = new THREE.Vector3(
        this.bossPos.x + Math.sin(t * 1.1) * 3.2,
        this.bossPos.y + 1.85,
        this.bossPos.z + 6.8 - t * 1.6
      );
      result.cutsceneCamLook = new THREE.Vector3(this.bossPos.x, this.bossPos.y + 1.65, this.bossPos.z);

      if (t >= 1.0) {
        result.advanceToPhase = 'phase1';
        audio.setBossMusicState(true, 1);
      }
      return result;
    }

    if (combatPhase === 'phase2_cutscene') {
      this.cutsceneTimer += dt;
      result.shakeAmount = 0.14;
      result.heatHazeBoost = 0.0045;
      this.bossRoot.position.copy(this.bossPos);
      this.bossRoot.rotation.y = this.bossYaw;
      if (Math.random() < 0.45) {
        this.spawnBurstParticles(this.bossPos.clone().add(new THREE.Vector3(0, 1.5, 0)), 5, 0xc084fc, 8.0, 1.3, 0.7);
      }
      result.cutsceneCamPos = new THREE.Vector3(
        this.bossPos.x + 3.8,
        this.bossPos.y + 1.75,
        this.bossPos.z + 5.6
      );
      result.cutsceneCamLook = new THREE.Vector3(this.bossPos.x, this.bossPos.y + 1.75, this.bossPos.z);
      if (this.cutsceneTimer >= BOSS_TUNING.PHASE2_CUTSCENE_SEC) {
        result.advanceToPhase = 'phase2';
        audio.setBossMusicState(true, 2);
        this.summonShades(BOSS_TUNING.SHADE_MAX_COUNT, this.bossPos, getTerrainHeight);
      }
      return result;
    }

    if (combatPhase === 'phase3_transition') {
      this.cutsceneTimer += dt;
      result.shakeAmount = 0.18;
      result.stormLightningFlash = Math.sin(this.cutsceneTimer * 18) > 0.7 ? 1.0 : 0.0;
      const boatDeckY = VOYAGE_STAGE_ORIGIN.y + (ctx.voyageCtrl ? ctx.voyageCtrl.boatPivot.position.y * 0.55 : 0);
      this.bossPos.set(VOYAGE_STAGE_ORIGIN.x, boatDeckY + 1.2, VOYAGE_STAGE_ORIGIN.z + 5.8);
      this.bossYaw = Math.PI;
      this.bossRoot.position.copy(this.bossPos);
      this.bossRoot.rotation.y = this.bossYaw;
      result.cutsceneCamPos = new THREE.Vector3(VOYAGE_STAGE_ORIGIN.x + 2.4, boatDeckY + 2.7, VOYAGE_STAGE_ORIGIN.z - 3.0);
      result.cutsceneCamLook = new THREE.Vector3(this.bossPos.x, this.bossPos.y + 1.6, this.bossPos.z);
      if (this.cutsceneTimer >= BOSS_TUNING.PHASE3_TRANSITION_SEC) {
        result.advanceToPhase = 'phase3_boat';
        audio.setBossMusicState(true, 3);
      }
      return result;
    }

    if (combatPhase === 'defeat_cutscene') {
      this.cutsceneTimer += effDt;
      result.heatHazeBoost = 0.002 * (1 - Math.min(1, this.cutsceneTimer / BOSS_TUNING.DEFEAT_CUTSCENE_SEC));
      if (this.cutsceneTimer < 2.2) {
        this.spawnBurstParticles(
          this.bossPos.clone().add(new THREE.Vector3(0, 1.4, 0)),
          6,
          0xfbbf24,
          7.5,
          1.25,
          1.45
        );
      }
      const p = Math.min(1, this.cutsceneTimer / BOSS_TUNING.DEFEAT_CUTSCENE_SEC);
      if (p > 0.45) {
        result.clearWeatherToSunrise = true;
      }
      this.bossRoot.position.copy(this.bossPos);
      result.cutsceneCamPos = new THREE.Vector3(
        this.bossPos.x + 3.2 * Math.cos(p * 1.3),
        this.bossPos.y + 2.0 + p * 1.4,
        this.bossPos.z - 5.2
      );
      result.cutsceneCamLook = new THREE.Vector3(this.bossPos.x, this.bossPos.y + 1.3, this.bossPos.z);
      if (this.cutsceneTimer >= BOSS_TUNING.DEFEAT_CUTSCENE_SEC) {
        result.fightDefeatComplete = true;
        audio.setBossMusicState(true, 'victory');
      }
      return result;
    }

    // -----------------------------------------------------------------------
    // 4. ACTIVE COMBAT AI (Phase 1, Phase 2, Phase 3 Boat Storm)
    // -----------------------------------------------------------------------
    const diffCfg = getBossDifficultyConfig(bossState.difficulty);
    const rate = diffCfg.attackRateMult;

    if (combatPhase === 'phase3_boat') {
      // Storm lightning cadence + boat deck hovering patrol
      this.stormFlashTimer -= effDt;
      if (this.stormFlashTimer <= 0) {
        this.stormFlashTimer = 2.4 + Math.random() * 3.5;
        result.stormLightningFlash = 1.0;
        audio.playThunder();
      }
      const deckBaseY = VOYAGE_STAGE_ORIGIN.y + (ctx.voyageCtrl ? ctx.voyageCtrl.boatPivot.position.y * 0.55 : 0);
      const swayX = Math.sin(elapsedSec * 1.1) * 1.8;
      const swayZ = 2.8 + Math.cos(elapsedSec * 0.85) * 1.2;
      this.bossPos.set(VOYAGE_STAGE_ORIGIN.x + swayX, deckBaseY + 0.85, VOYAGE_STAGE_ORIGIN.z + swayZ);
    } else {
      this.bossPos.y = getTerrainHeight(this.bossPos.x, this.bossPos.z);
    }

    const toPlayerX = playerPos.x - this.bossPos.x;
    const toPlayerZ = playerPos.z - this.bossPos.z;
    const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);
    const targetYaw = Math.atan2(toPlayerX, toPlayerZ);
    // Smooth angular tracking unless mid-swing
    if (this.bossAiState !== 'windup_melee' && this.bossAiState !== 'stagger') {
      let diffAng = targetYaw - this.bossYaw;
      while (diffAng > Math.PI) diffAng -= Math.PI * 2;
      while (diffAng < -Math.PI) diffAng += Math.PI * 2;
      this.bossYaw += diffAng * Math.min(1, effDt * 6.5);
    }

    this.orbCooldown -= effDt * rate;
    this.slamCooldown -= effDt * rate;
    this.dashCooldown -= effDt * rate;

    if (bossState.staggeredSec > 0 && this.bossAiState !== 'stagger') {
      this.bossAiState = 'stagger';
      this.aiTimer = Math.max(0.85, bossState.staggeredSec);
      this.playClip('stagger', 0.14, true);
    }

    if (this.bossAiState === 'stagger') {
      this.aiTimer -= effDt;
      this.playClip('stagger', 0.16, true);
      if (this.aiTimer <= 0) {
        this.bossAiState = 'pursue';
      }
    } else if (this.bossAiState === 'windup_melee') {
      this.aiTimer -= effDt * rate;
      if (this.aiTimer <= BOSS_TUNING.MELEE_WINDUP_SEC * 0.35 && !this.meleeHitDealtInSwing) {
        this.meleeHitDealtInSwing = true;
        audio.playMeleeSlash(true);
        const reach = combatPhase === 'phase3_boat' ? 7.8 : BOSS_TUNING.MELEE_RANGE_M;
        if (distToPlayer <= reach) {
          this.applyHitToPlayer(BOSS_TUNING.MELEE_DAMAGE * diffCfg.bossDmgMult, ctx, result);
        }
      }
      if (this.aiTimer <= 0) {
        this.bossAiState = 'recover_melee';
        this.aiTimer = 0.65 / rate;
      }
    } else if (this.bossAiState === 'recover_melee') {
      this.aiTimer -= effDt;
      if (this.aiTimer <= 0) {
        this.bossAiState = 'pursue';
        this.playClip('idle', 0.2, true);
      }
    } else if (this.bossAiState === 'windup_slam') {
      this.aiTimer -= effDt * rate;
      if (this.aiTimer <= 0) {
        audio.playAuraCast();
        audio.playHeavyImpact(true);
        result.shakeAmount = 0.22;
        this.spawnShockwave(this.bossPos);
        this.spawnBurstParticles(this.bossPos.clone().add(new THREE.Vector3(0, 0.4, 0)), 32, 0xc084fc, 8.5, 1.4, 0.8);
        // Shockwave slam leaves Lavans Bali's Aura dimmed briefly for counter-attack!
        this.bossAiState = 'stagger';
        this.aiTimer = BOSS_TUNING.STAGGER_DURATION_SEC * 0.72;
        this.playClip('stagger', 0.16, true);
      }
    } else if (this.bossAiState === 'cast_orbs') {
      this.aiTimer -= effDt;
      if (this.aiTimer <= 0) {
        const orbCount = combatPhase === 'phase3_boat' ? 3 : bossState.phase === 2 ? 3 : 2;
        audio.playAuraCast();
        const origin = this.bossPos.clone().add(new THREE.Vector3(0, 1.75, 0));
        const baseDir = new THREE.Vector3(
          playerPos.x - origin.x,
          playerPos.y + ctx.playerEyeHeight * 0.72 - origin.y,
          playerPos.z - origin.z
        ).normalize();
        for (let k = 0; k < orbCount; k++) {
          const spread = (k - (orbCount - 1) * 0.5) * 0.24;
          const dir = baseDir.clone().applyAxisAngle(_upVec, spread);
          this.spawnOrb(origin, dir, BOSS_TUNING.ORB_SPEED_MPS * (combatPhase === 'phase3_boat' ? 1.15 : 1.0));
        }
        this.bossAiState = 'pursue';
        this.playClip('idle', 0.25, true);
      }
    } else if (this.bossAiState === 'dash') {
      this.aiTimer -= effDt;
      this.bossPos.lerp(this.dashTarget, Math.min(1, effDt * 11.0));
      if (Math.random() < 0.6) {
        this.spawnBurstParticles(this.bossPos.clone().add(new THREE.Vector3(0, 1.2, 0)), 3, 0xa855f7, 2.0, 1.1, 0.45);
      }
      if (this.aiTimer <= 0) {
        this.bossAiState = 'windup_melee';
        this.aiTimer = BOSS_TUNING.MELEE_WINDUP_SEC;
        this.meleeHitDealtInSwing = false;
        this.playClip('melee_swing', 0.1, false);
      }
    } else {
      // Pursue & pick next telegraphed attack
      if (combatPhase !== 'phase3_boat') {
        if (distToPlayer > 2.8) {
          this.playClip('walk', 0.22, true);
          const spd = (bossState.phase >= 2 ? 4.4 : 3.55) * effDt;
          const invD = 1 / Math.max(0.001, distToPlayer);
          this.bossPos.x += toPlayerX * invD * spd;
          this.bossPos.z += toPlayerZ * invD * spd;
          // Tether within shore arena radius
          const dxA = this.bossPos.x - BOSS_TUNING.ARENA_CENTER_X;
          const dzA = this.bossPos.z - BOSS_TUNING.ARENA_CENTER_Z;
          const dA = Math.hypot(dxA, dzA);
          if (dA > BOSS_TUNING.ARENA_RADIUS_M - 2) {
            const s = (BOSS_TUNING.ARENA_RADIUS_M - 2) / dA;
            this.bossPos.x = BOSS_TUNING.ARENA_CENTER_X + dxA * s;
            this.bossPos.z = BOSS_TUNING.ARENA_CENTER_Z + dzA * s;
          }
        } else {
          this.playClip('idle', 0.2, true);
        }
      } else {
        this.playClip('idle', 0.2, true);
      }

      if (distToPlayer <= (combatPhase === 'phase3_boat' ? 7.2 : BOSS_TUNING.MELEE_RANGE_M)) {
        this.bossAiState = 'windup_melee';
        this.aiTimer = BOSS_TUNING.MELEE_WINDUP_SEC;
        this.meleeHitDealtInSwing = false;
        this.playClip('melee_swing', 0.12, false);
      } else if (this.slamCooldown <= 0 && (distToPlayer < 13.5 || combatPhase === 'phase3_boat')) {
        this.slamCooldown = combatPhase === 'phase3_boat' ? 7.0 : 9.2;
        this.bossAiState = 'windup_slam';
        this.aiTimer = BOSS_TUNING.SHOCKWAVE_WINDUP_SEC;
        this.playClip('aura_cast', 0.12, false);
        audio.playAuraCast();
      } else if (bossState.phase >= 2 && this.dashCooldown <= 0 && combatPhase !== 'phase3_boat') {
        this.dashCooldown = 10.5;
        this.bossAiState = 'dash';
        this.aiTimer = 0.45;
        const sideSign = Math.random() > 0.5 ? 1 : -1;
        this.dashTarget.set(
          playerPos.x + Math.cos(targetYaw) * sideSign * 2.2 - Math.sin(targetYaw) * 2.4,
          this.bossPos.y,
          playerPos.z - Math.sin(targetYaw) * sideSign * 2.2 - Math.cos(targetYaw) * 2.4
        );
      } else if (this.orbCooldown <= 0) {
        this.orbCooldown = combatPhase === 'phase3_boat' ? 3.2 : BOSS_TUNING.ORB_COOLDOWN_SEC;
        this.bossAiState = 'cast_orbs';
        this.aiTimer = 0.52;
        this.playClip('aura_cast', 0.14, false);
      }
    }

    this.bossRoot.position.copy(this.bossPos);
    // Blender -Y front exports along glTF +Z, so rotation.y = bossYaw faces the target cleanly
    this.bossRoot.rotation.y = this.bossYaw;

    // -----------------------------------------------------------------------
    // 5. UPDATE POOLED AURA ORBS, SHOCKWAVES, SHADES & PLAYER PROJECTILES
    // -----------------------------------------------------------------------
    this.stepPlayerProjectiles(effDt, ctx);
    for (const orb of this.orbPool) {
      if (!orb.active) continue;
      orb.life -= effDt;
      orb.pos.addScaledVector(orb.vel, effDt);
      orb.mesh.position.copy(orb.pos);
      if (orb.life <= 0) {
        orb.active = false;
        orb.mesh.visible = false;
        continue;
      }
      // Pillar cover check!
      let blockedByPillar = false;
      for (const col of this.arenaColliders) {
        const colTopY = this.pillarTopYs.get(col.id) ?? 99;
        if (col.kind === 'circle' && Math.hypot(orb.pos.x - col.x, orb.pos.z - col.z) <= col.radius + 0.35 && orb.pos.y <= colTopY + 0.2) {
          blockedByPillar = true;
          break;
        }
      }
      if (blockedByPillar) {
        orb.active = false;
        orb.mesh.visible = false;
        this.spawnBurstParticles(orb.pos, 10, 0xc084fc, 4.5, 0.85, 0.4);
        continue;
      }
      // Player hit check
      const pDist = Math.hypot(
        orb.pos.x - playerPos.x,
        orb.pos.z - playerPos.z,
        orb.pos.y - (playerPos.y + ctx.playerEyeHeight * 0.55)
      );
      if (pDist < 0.85) {
        orb.active = false;
        orb.mesh.visible = false;
        this.applyHitToPlayer(BOSS_TUNING.ORB_DAMAGE * diffCfg.bossDmgMult, ctx, result);
        this.spawnBurstParticles(orb.pos, 12, 0xc084fc, 5.0, 0.9, 0.45);
      }
    }

    for (const sw of this.shockwavePool) {
      if (!sw.active) continue;
      sw.radius += effDt * BOSS_TUNING.SHOCKWAVE_SPEED_MPS;
      sw.mesh.scale.set(sw.radius, 1.0, sw.radius);
      if (sw.radius >= sw.maxRadius) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      if (!sw.hitPlayer) {
        const dP = Math.hypot(playerPos.x - sw.origin.x, playerPos.z - sw.origin.z);
        const playerClearJump = !ctx.isPlayerGrounded && playerPos.y - sw.origin.y > 0.45;
        if (Math.abs(dP - sw.radius) < 1.05 && !playerClearJump) {
          sw.hitPlayer = true;
          this.applyHitToPlayer(BOSS_TUNING.SHOCKWAVE_DAMAGE * diffCfg.bossDmgMult, ctx, result);
        }
      }
    }

    for (const sh of this.shadePool) {
      if (!sh.active) continue;
      const sx = playerPos.x - sh.pos.x;
      const sz = playerPos.z - sh.pos.z;
      const d = Math.hypot(sx, sz);
      if (d > 1.75) {
        sh.pos.x += (sx / d) * BOSS_TUNING.SHADE_SPEED_MPS * effDt;
        sh.pos.z += (sz / d) * BOSS_TUNING.SHADE_SPEED_MPS * effDt;
        sh.pos.y = getTerrainHeight(sh.pos.x, sh.pos.z);
      } else {
        sh.attackCd -= effDt;
        if (sh.attackCd <= 0) {
          sh.attackCd = 1.65;
          this.applyHitToPlayer(BOSS_TUNING.SHADE_DAMAGE * diffCfg.bossDmgMult, ctx, result);
        }
      }
      sh.mesh.position.set(sh.pos.x, sh.pos.y + Math.sin(elapsedSec * 3.5 + sh.pos.x) * 0.14, sh.pos.z);
      sh.mesh.rotation.y = Math.atan2(sx, sz) + Math.PI;
    }

    return result;
  }

  private stepPlayerProjectiles(effDt: number, ctx: BossUpdateContext) {
    const { state, getTerrainHeight } = ctx;
    const bossState = state.boss;
    const combatPhase = bossState.combatPhase;
    const boatDeckY = VOYAGE_STAGE_ORIGIN.y + (ctx.voyageCtrl ? ctx.voyageCtrl.boatPivot.position.y * 0.55 : 0);

    for (const p of this.playerProjPool) {
      if (!p.active) continue;
      p.life -= effDt;
      const grav =
        p.kind === 'fire_bomb' ? 11.2 : p.kind === 'spear' ? 7.2 : p.kind === 'flare' ? 1.4 : 4.6;
      p.vel.y -= grav * effDt;
      p.pos.addScaledVector(p.vel, effDt);
      p.mesh.position.copy(p.pos);

      if (p.kind !== 'fire_bomb') {
        _tmpV1.copy(p.pos).add(p.vel);
        p.mesh.lookAt(_tmpV1);
      } else {
        p.mesh.rotation.x += effDt * 8.0;
        p.mesh.rotation.z += effDt * 6.0;
      }

      if ((p.kind === 'flare' || p.kind === 'fire_bomb') && Math.random() < 0.45) {
        this.spawnBurstParticles(p.pos, 1, p.kind === 'flare' ? 0xfb7185 : 0xf97316, 1.8, 0.75, 0.25);
      }

      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // 1. Crystal direct hit (Phase 2 shield anchors)
      let hitHandled = false;
      if (combatPhase === 'phase2') {
        for (let i = 0; i < 3; i++) {
          if (!bossState.crystalsAlive[i]) continue;
          const cp = this.crystalWorldPos[i];
          if (!cp) continue;
          const d = Math.hypot(p.pos.x - cp.x, p.pos.y - (cp.y + 1.35), p.pos.z - cp.z);
          if (d <= 1.3) {
            this.frameProjHits.push({
              target: 'crystal',
              index: i,
              damage: p.damage,
              weaponKind: p.kind,
              isBurn: p.kind === 'fire_bomb' || p.kind === 'flare',
              isWeakpoint: false,
              pos: p.pos.clone(),
            });
            hitHandled = true;
            break;
          }
        }
      }

      // 2. Explosive barrel direct hit
      if (!hitHandled && combatPhase !== 'phase3_boat') {
        for (let i = 0; i < 4; i++) {
          if (!bossState.barrelsIntact[i]) continue;
          const bp = this.barrelWorldPos[i];
          if (!bp) continue;
          const d = Math.hypot(p.pos.x - bp.x, p.pos.y - (bp.y + 0.55), p.pos.z - bp.z);
          if (d <= 1.05) {
            this.frameProjHits.push({
              target: 'barrel',
              index: i,
              damage: p.damage,
              weaponKind: p.kind,
              isBurn: true,
              isWeakpoint: false,
              pos: p.pos.clone(),
            });
            hitHandled = true;
            break;
          }
        }
      }

      // 3. Summoned Shade hit
      if (!hitHandled) {
        for (let i = 0; i < this.shadePool.length; i++) {
          const sh = this.shadePool[i];
          if (!sh.active) continue;
          const d = Math.hypot(p.pos.x - sh.pos.x, p.pos.y - (sh.pos.y + 1.0), p.pos.z - sh.pos.z);
          if (d <= 1.05) {
            this.damageShade(i, p.damage);
            this.frameProjHits.push({
              target: 'shade',
              index: i,
              damage: p.damage,
              weaponKind: p.kind,
              isBurn: p.kind === 'fire_bomb' || p.kind === 'flare',
              isWeakpoint: false,
              pos: p.pos.clone(),
            });
            hitHandled = true;
            break;
          }
        }
      }

      // 4. Boss direct body / weakpoint beacon hit
      if (!hitHandled && this.bossRoot.visible) {
        const horizBoss = Math.hypot(p.pos.x - this.bossPos.x, p.pos.z - this.bossPos.z);
        const relY = p.pos.y - this.bossPos.y;
        if (horizBoss <= 1.08 && relY >= 0.0 && relY <= 2.65) {
          const isWeakpoint =
            this.bossAiState === 'stagger' ||
            bossState.staggeredSec > 0 ||
            (combatPhase === 'phase3_boat' && p.kind === 'flare') ||
            (relY >= 1.25 && relY <= 1.95);
          this.frameProjHits.push({
            target: 'boss',
            index: 0,
            damage: p.damage,
            weaponKind: p.kind,
            isBurn: p.kind === 'fire_bomb' || p.kind === 'flare',
            isWeakpoint,
            pos: p.pos.clone(),
          });
          this.spawnBurstParticles(
            p.pos,
            isWeakpoint ? 18 : 10,
            p.kind === 'flare' ? 0xfb7185 : isWeakpoint ? 0xfbbf24 : 0xa855f7,
            5.5,
            1.0,
            0.45
          );
          hitHandled = true;
        }
      }

      // 5. Pillar or Terrain / Deck impact
      if (!hitHandled) {
        let envHit = false;
        if (combatPhase !== 'phase3_boat') {
          for (const col of this.arenaColliders) {
            const colTopY = this.pillarTopYs.get(col.id) ?? 99;
            if (
              col.kind === 'circle' &&
              Math.hypot(p.pos.x - col.x, p.pos.z - col.z) <= col.radius + 0.15 &&
              p.pos.y <= colTopY
            ) {
              envHit = true;
              break;
            }
          }
          if (!envHit && p.pos.y <= getTerrainHeight(p.pos.x, p.pos.z)) {
            envHit = true;
          }
        } else if (p.pos.y <= boatDeckY + 0.15) {
          envHit = true;
        }
        if (envHit) {
          hitHandled = true;
        }
      }

      if (hitHandled) {
        if (p.kind === 'fire_bomb') {
          audio.playExplosionBlast();
          this.spawnBurstParticles(p.pos, 36, 0xf97316, 8.5, 1.35, 0.8);
          this.spawnShockwave(p.pos, 4.5);
          // Splash check against Boss, Shades & nearby Barrels
          const splashBossDist = p.pos.distanceTo(
            _tmpV1.set(this.bossPos.x, this.bossPos.y + 1.2, this.bossPos.z)
          );
          if (splashBossDist <= 4.5 && !this.frameProjHits.some((h) => h.target === 'boss' && h.weaponKind === 'fire_bomb')) {
            this.frameProjHits.push({
              target: 'boss',
              index: 0,
              damage: Math.round(p.damage * 0.85),
              weaponKind: 'fire_bomb',
              isBurn: true,
              isWeakpoint: false,
              pos: p.pos.clone(),
            });
          }
          for (let i = 0; i < this.shadePool.length; i++) {
            const sh = this.shadePool[i];
            if (sh.active && p.pos.distanceTo(sh.pos) <= 4.5) {
              this.damageShade(i, Math.round(p.damage * 0.85));
            }
          }
          if (combatPhase !== 'phase3_boat') {
            for (let i = 0; i < 4; i++) {
              const bp = this.barrelWorldPos[i];
              if (bossState.barrelsIntact[i] && bp && p.pos.distanceTo(bp) <= 4.0) {
                this.frameProjHits.push({
                  target: 'barrel',
                  index: i,
                  damage: p.damage,
                  weaponKind: 'fire_bomb',
                  isBurn: true,
                  isWeakpoint: false,
                  pos: bp.clone(),
                });
              }
            }
          }
        } else {
          this.spawnBurstParticles(p.pos, 6, 0xfbbf24, 3.2, 0.7, 0.3);
        }
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  private applyHitToPlayer(rawDmg: number, ctx: BossUpdateContext, result: BossUpdateResult) {
    if (ctx.isPlayerDodgeIFrame) {
      return; // Cleanly rolled through attack!
    }
    if (ctx.isPlayerParrying) {
      result.playerParriedHit = true;
      result.playerDamageTaken += Math.round(rawDmg * 0.12);
      audio.playParryBlock(true);
      this.forceStagger();
      return;
    }
    if (ctx.isPlayerBlocking) {
      result.playerBlockedHit = true;
      result.playerDamageTaken += Math.round(rawDmg * COMBAT_TUNING.BLOCK_DAMAGE_MULT);
      audio.playParryBlock(false);
      return;
    }
    result.playerDamageTaken += Math.round(rawDmg);
  }

  private onEnterCombatPhase(phase: BossCombatPhase, getTerrainHeight: (x: number, z: number) => number) {
    this.cutsceneTimer = 0;
    this.clearAllCombatPools();
    this.bossAiState = 'pursue';
    this.aiTimer = 0;
    if (phase === 'intro') {
      this.bossPos.set(
        BOSS_TUNING.ARENA_CENTER_X,
        getTerrainHeight(BOSS_TUNING.ARENA_CENTER_X, BOSS_TUNING.ARENA_CENTER_Z - 6.5),
        BOSS_TUNING.ARENA_CENTER_Z - 6.5
      );
      this.playClip('intro', 0.1, false);
      audio.playBossVoice('No one leaves my island.', 3800);
    } else if (phase === 'phase2_cutscene') {
      this.playClip('rage_transition', 0.12, false);
      audio.playBossVoice('Awaken, crystals of the reef! Witness true sovereign wrath!', 3200);
      audio.playAuraCast();
    } else if (phase === 'phase3_transition') {
      this.playClip('aura_cast', 0.12, false);
      audio.playBossVoice('You dare cast off?! The storm itself will swallow your vessel!', 3400);
      audio.playThunder();
    } else if (phase === 'defeat_cutscene') {
      this.finisherSlowMoTimer = BOSS_TUNING.FINISHER_SLOWMO_REAL_SEC;
      this.playClip('defeat', 0.12, false);
      audio.playBossVoice('Impossible... the horizon... breaks...', 4200);
      audio.playCrystalShatter();
    } else if (phase === 'phase1') {
      this.playClip('idle', 0.2, true);
    }
  }

  private updateParticles(dt: number) {
    const inst = this.particleInstanced;
    let dirty = false;
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;
      dirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _tmpMat4.makeScale(0, 0, 0);
        inst.setMatrixAt(i, _tmpMat4);
        continue;
      }
      p.vel.y -= 2.4 * dt;
      p.pos.addScaledVector(p.vel, dt);
      const s = p.size * (p.life / p.maxLife);
      _tmpScale.setScalar(s);
      _tmpMat4.compose(p.pos, _tmpQuat, _tmpScale);
      inst.setMatrixAt(i, _tmpMat4);
      inst.setColorAt(i, p.color);
    }
    if (dirty) {
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
  }

  public dispose() {
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
