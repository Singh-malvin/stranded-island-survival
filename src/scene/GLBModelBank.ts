import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { WorldCollider } from '../survival/world.ts';

export interface LoadedGLBSet {
  fpArms: THREE.Group;
  fpArmsAnimations: THREE.AnimationClip[];
  playerBody: THREE.Group;
  palmTrees: [THREE.Group, THREE.Group, THREE.Group];
  palmTreeLods: [THREE.Group, THREE.Group, THREE.Group];
  rocks: {
    small: THREE.Group;
    medium: THREE.Group;
    large: THREE.Group;
    flat: THREE.Group;
    cliff: THREE.Group;
    mountain: THREE.Group;
  };
  wreckage: {
    fuselage: THREE.Group;
    wing: THREE.Group;
    tailFin: THREE.Group;
    engine: THREE.Group;
    seat: THREE.Group;
    suitcase: THREE.Group;
    panelDebris: THREE.Group;
  };
  tools: {
    hatchetStone: THREE.Group;
    pickaxeFlint: THREE.Group;
    hammerCraft: THREE.Group;
    flintSharp: THREE.Group;
    flintSharpLod: THREE.Group;
    branchFallen: THREE.Group;
    branchFallenLod: THREE.Group;
    ropeCoil: THREE.Group;
    ropeCoilLod: THREE.Group;
    torchHand: THREE.Group;
    lantern: THREE.Group;
    machete: THREE.Group;
    spear: THREE.Group;
    waterContainer: THREE.Group;
    foodRation: THREE.Group;
  };
  campfire: {
    lit: THREE.Group;
    burntOut: THREE.Group;
  };
  environment: {
    pondEdgeBank: THREE.Group;
    fern: THREE.Group;
    fernLod: THREE.Group;
    bushTropical: THREE.Group;
    bushTropicalLod: THREE.Group;
    grassClump: THREE.Group;
    grassClumpLod: THREE.Group;
    logFallen: THREE.Group;
    logFallenLod: THREE.Group;
    driftwood: THREE.Group;
    driftwoodLod: THREE.Group;
    shell: THREE.Group;
    pebbleCluster: THREE.Group;
  };
  buildables: {
    shelterLeanto: THREE.Group;
    crateStorage: THREE.Group;
    workbench: THREE.Group;
    forgeStone: THREE.Group;
    waterCollector: THREE.Group;
    rainCatcher: THREE.Group;
    sleepingMat: THREE.Group;
    dryingRack: THREE.Group;
    torchStanding: THREE.Group;
  };
  flipbooks: {
    fire: THREE.Texture;
    smoke: THREE.Texture;
    embers: THREE.Texture;
    steam: THREE.Texture;
    dustPuff: THREE.Texture;
    sandPuff: THREE.Texture;
    woodChips: THREE.Texture;
    waterSplash: THREE.Texture;
  };
}

function markGLBMaterials(root: THREE.Object3D, isFirstPerson: boolean = false): void {
  root.traverse((obj) => {
    const upperName = (obj.name || '').toUpperCase();
    if (
      upperName.includes('COLLIDER') ||
      upperName.includes('GRIP_POINT') ||
      upperName === 'ICOSPHERE'
    ) {
      obj.visible = false;
      const colMesh = obj as THREE.Mesh;
      if (upperName.includes('COLLIDER') && colMesh.isMesh && colMesh.geometry) {
        colMesh.geometry.computeBoundingBox();
        if (colMesh.geometry.boundingBox) {
          root.userData.__colliderBox = colMesh.geometry.boundingBox.clone();
        }
      }
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (isFirstPerson) {
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      m.userData.__skipScenePBR = true;
      if (isFirstPerson) {
        m.userData.__csmSkip = true;
      }
      const std = m as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial) {
        std.envMapIntensity = isFirstPerson ? 0.55 : 0.72;
        std.needsUpdate = true;
      }
    }
  });
}

let cachedPromise: Promise<LoadedGLBSet> | null = null;

export function loadAllGameGLBModels(): Promise<LoadedGLBSet> {
  if (cachedPromise) return cachedPromise;
  const loader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();

  const loadOneWithClips = (
    file: string,
    isFP: boolean = false
  ): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> =>
    new Promise((resolve, reject) => {
      loader.load(
        `./assets/models/${file}`,
        (gltf) => {
          markGLBMaterials(gltf.scene, isFP);
          resolve({ scene: gltf.scene, animations: gltf.animations || [] });
        },
        undefined,
        (err) => reject(err)
      );
    });

  const loadOne = (file: string, isFP: boolean = false): Promise<THREE.Group> =>
    loadOneWithClips(file, isFP).then((r) => r.scene);

  const loadFlipbook = (file: string): Promise<THREE.Texture> =>
    new Promise((resolve) => {
      texLoader.load(
        `./assets/effects/${file}`,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.repeat.set(1 / 8, 1 / 8);
          tex.offset.set(0, 7 / 8);
          tex.needsUpdate = true;
          resolve(tex);
        },
        undefined,
        () => {
          const fallback = new THREE.Texture();
          fallback.repeat.set(1 / 8, 1 / 8);
          resolve(fallback);
        }
      );
    });

  cachedPromise = Promise.all([
    loadOneWithClips('fp_arms.glb', true),
    loadOne('player_body.glb', false),
    loadOne('palm_tree_01.glb'),
    loadOne('palm_tree_02.glb'),
    loadOne('palm_tree_03.glb'),
    loadOne('palm_tree_01_lod1.glb'),
    loadOne('palm_tree_02_lod1.glb'),
    loadOne('palm_tree_03_lod1.glb'),
    loadOne('rock_small_01.glb'),
    loadOne('rock_medium_01.glb'),
    loadOne('rock_large_01.glb'),
    loadOne('rock_flat_01.glb'),
    loadOne('rock_cliff_01.glb'),
    loadOne('mountain_section_01.glb'),
    loadOne('plane_fuselage.glb'),
    loadOne('plane_wing.glb'),
    loadOne('plane_tail_fin.glb'),
    loadOne('plane_engine.glb'),
    loadOne('plane_seat.glb'),
    loadOne('plane_suitcase.glb'),
    loadOne('plane_panel_debris.glb'),
    loadOne('hatchet_stone.glb', true),
    loadOne('pickaxe_flint.glb', true),
    loadOne('hammer_craft.glb', true),
    loadOne('flint_sharp.glb', true),
    loadOne('flint_sharp_lod1.glb'),
    loadOne('branch_fallen.glb', true),
    loadOne('branch_fallen_lod1.glb'),
    loadOne('rope_coil.glb', true),
    loadOne('rope_coil_lod1.glb'),
    loadOne('torch_hand.glb', true),
    loadOne('lantern.glb', true),
    loadOne('machete.glb', true),
    loadOne('spear.glb', true),
    loadOne('water_container.glb', true),
    loadOne('food_ration.glb', true),
    loadOne('campfire_lit.glb'),
    loadOne('campfire_burnt_out.glb'),
    loadOne('pond_edge_bank.glb'),
    loadOne('fern_01.glb'),
    loadOne('fern_01_lod1.glb'),
    loadOne('bush_tropical_01.glb'),
    loadOne('bush_tropical_01_lod1.glb'),
    loadOne('grass_clump_01.glb'),
    loadOne('grass_clump_01_lod1.glb'),
    loadOne('log_fallen_01.glb'),
    loadOne('log_fallen_01_lod1.glb'),
    loadOne('driftwood_01.glb'),
    loadOne('driftwood_01_lod1.glb'),
    loadOne('shell_01.glb'),
    loadOne('pebble_cluster_01.glb'),
    loadOne('shelter_leanto.glb'),
    loadOne('crate_storage.glb'),
    loadOne('workbench.glb'),
    loadOne('forge_stone.glb'),
    loadOne('water_collector.glb'),
    loadOne('rain_catcher.glb'),
    loadOne('sleeping_mat.glb'),
    loadOne('drying_rack.glb'),
    loadOne('torch_standing.glb'),
    loadFlipbook('fire_flipbook.png'),
    loadFlipbook('smoke_flipbook.png'),
    loadFlipbook('embers_flipbook.png'),
    loadFlipbook('steam_flipbook.png'),
    loadFlipbook('dust_puff_flipbook.png'),
    loadFlipbook('sand_puff_flipbook.png'),
    loadFlipbook('wood_chips_flipbook.png'),
    loadFlipbook('water_splash_flipbook.png'),
  ]).then(
    ([
      fpArmsRes,
      playerBody,
      p1,
      p2,
      p3,
      p1Lod,
      p2Lod,
      p3Lod,
      rSmall,
      rMed,
      rLarge,
      rFlat,
      rCliff,
      rMountain,
      wFuse,
      wWing,
      wTail,
      wEngine,
      wSeat,
      wSuit,
      wPanel,
      tHatchet,
      tPickaxe,
      tHammer,
      tFlint,
      tFlintLod,
      tBranch,
      tBranchLod,
      tRope,
      tRopeLod,
      tTorchHand,
      tLantern,
      tMachete,
      tSpear,
      tWaterContainer,
      tFoodRation,
      cLit,
      cBurnt,
      ePond,
      eFern,
      eFernLod,
      eBush,
      eBushLod,
      eGrass,
      eGrassLod,
      eLog,
      eLogLod,
      eDrift,
      eDriftLod,
      eShell,
      ePebble,
      bShelter,
      bCrate,
      bWorkbench,
      bForge,
      bWaterCol,
      bRainCatch,
      bSleepMat,
      bDryRack,
      bTorch,
      fxFire,
      fxSmoke,
      fxEmbers,
      fxSteam,
      fxDust,
      fxSand,
      fxChips,
      fxSplash,
    ]) => ({
      fpArms: fpArmsRes.scene,
      fpArmsAnimations: fpArmsRes.animations,
      playerBody,
      palmTrees: [p1, p2, p3],
      palmTreeLods: [p1Lod, p2Lod, p3Lod],
      rocks: {
        small: rSmall,
        medium: rMed,
        large: rLarge,
        flat: rFlat,
        cliff: rCliff,
        mountain: rMountain,
      },
      wreckage: {
        fuselage: wFuse,
        wing: wWing,
        tailFin: wTail,
        engine: wEngine,
        seat: wSeat,
        suitcase: wSuit,
        panelDebris: wPanel,
      },
      tools: {
        hatchetStone: tHatchet,
        pickaxeFlint: tPickaxe,
        hammerCraft: tHammer,
        flintSharp: tFlint,
        flintSharpLod: tFlintLod,
        branchFallen: tBranch,
        branchFallenLod: tBranchLod,
        ropeCoil: tRope,
        ropeCoilLod: tRopeLod,
        torchHand: tTorchHand,
        lantern: tLantern,
        machete: tMachete,
        spear: tSpear,
        waterContainer: tWaterContainer,
        foodRation: tFoodRation,
      },
      campfire: {
        lit: cLit,
        burntOut: cBurnt,
      },
      environment: {
        pondEdgeBank: ePond,
        fern: eFern,
        fernLod: eFernLod,
        bushTropical: eBush,
        bushTropicalLod: eBushLod,
        grassClump: eGrass,
        grassClumpLod: eGrassLod,
        logFallen: eLog,
        logFallenLod: eLogLod,
        driftwood: eDrift,
        driftwoodLod: eDriftLod,
        shell: eShell,
        pebbleCluster: ePebble,
      },
      buildables: {
        shelterLeanto: bShelter,
        crateStorage: bCrate,
        workbench: bWorkbench,
        forgeStone: bForge,
        waterCollector: bWaterCol,
        rainCatcher: bRainCatch,
        sleepingMat: bSleepMat,
        dryingRack: bDryRack,
        torchStanding: bTorch,
      },
      flipbooks: {
        fire: fxFire,
        smoke: fxSmoke,
        embers: fxEmbers,
        steam: fxSteam,
        dustPuff: fxDust,
        sandPuff: fxSand,
        woodChips: fxChips,
        waterSplash: fxSplash,
      },
    })
  );

  return cachedPromise;
}

/**
 * Extracts a solid 2D WorldCollider (OBB or circle) from a placed 3D object's
 * child `COLLIDER` bounding box so the player cannot walk through GLB assets.
 */
export function extractWorldColliderFromGLB(
  instance: THREE.Object3D,
  id: string,
  template?: THREE.Object3D
): WorldCollider | null {
  let box: THREE.Box3 | undefined =
    instance.userData.__colliderBox || template?.userData.__colliderBox;
  if (!box) {
    instance.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh && (m.name || '').toUpperCase().includes('COLLIDER') && m.geometry) {
        m.geometry.computeBoundingBox();
        if (m.geometry.boundingBox) box = m.geometry.boundingBox.clone();
      }
    });
  }
  if (!box) return null;
  const size = new THREE.Vector3();
  box.getSize(size);
  const sx = Math.abs(instance.scale.x || 1);
  const sz = Math.abs(instance.scale.z || 1);
  const halfW = Math.max(0.28, (size.x * sx) * 0.5);
  const halfD = Math.max(0.28, (size.z * sz) * 0.5);
  if (Math.abs(halfW - halfD) < 0.18) {
    return {
      kind: 'circle',
      id,
      x: instance.position.x,
      z: instance.position.z,
      radius: (halfW + halfD) * 0.5,
    };
  }
  return {
    kind: 'obb',
    id,
    x: instance.position.x,
    z: instance.position.z,
    halfW,
    halfD,
    yaw: instance.rotation.y || 0,
  };
}

/**
 * Updates an 8x8 flipbook texture offset for frame index (0..63).
 */
export function setFlipbookFrame(tex: THREE.Texture, frameIndex: number): void {
  const f = ((Math.floor(frameIndex) % 64) + 64) % 64;
  const col = f % 8;
  const row = Math.floor(f / 8);
  tex.offset.set(col / 8, (7 - row) / 8);
}

/**
 * Strips triangles belonging to the opposite arm (x < 0 for 'right', x > 0 for 'left')
 * from a cloned SkinnedMesh geometry so each first-person arm rig only renders its own arm.
 */
function filterArmSideGeometry(root: THREE.Object3D, side: 'left' | 'right'): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geom = mesh.geometry.clone();
    const pos = geom.attributes.position;
    const idx = geom.index;
    if (pos && idx) {
      const src = idx.array;
      const kept: number[] = [];
      for (let i = 0; i < src.length; i += 3) {
        const a = src[i];
        const b = src[i + 1];
        const c = src[i + 2];
        const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
        if (side === 'right' ? cx >= 0 : cx <= 0) {
          kept.push(a, b, c);
        }
      }
      geom.setIndex(kept);
    }
    mesh.geometry = geom;
  });
}

/**
 * Clones one side ('left' | 'right') of the rigged `fp_arms.glb` model,
 * strips the opposite arm mesh triangles, and optionally curls the fingers for tool grip.
 */
export function buildGLBFirstPersonArm(
  fpArmsTemplate: THREE.Group,
  side: 'left' | 'right',
  pose: 'relaxed' | 'grip'
): THREE.Group {
  const wrapper = new THREE.Group();
  const cloned = SkeletonUtils.clone(fpArmsTemplate) as THREE.Group;
  filterArmSideGeometry(cloned, side);
  markGLBMaterials(cloned, true);

  // Align wrist to local (0, 0.055, -0.075) to match the procedural rig pivots
  if (side === 'right') {
    cloned.position.set(-0.21, 0.28, 0.30);
  } else {
    cloned.position.set(0.21, 0.28, 0.30);
  }

  const activeSuffix = side === 'right' ? 'R' : 'L';

  cloned.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (!bone.isBone) return;
    const nm = bone.name;
    if (pose === 'grip' && nm.endsWith(activeSuffix)) {
      if (
        nm.startsWith('index_') ||
        nm.startsWith('middle_') ||
        nm.startsWith('ring_') ||
        nm.startsWith('pinky_')
      ) {
        bone.rotation.x -= 0.42;
      } else if (nm.startsWith('thumb_02') || nm.startsWith('thumb_03')) {
        bone.rotation.x -= 0.28;
      }
    }
  });

  wrapper.add(cloned);
  wrapper.userData.__skinnedClone = cloned;
  return wrapper;
}

/**
 * Clones a holdable GLB template while preserving SkinnedMesh + Bone hierarchy (`ik_hand_R` / `ik_hand_L`).
 */
export function cloneHoldableGLB(template: THREE.Group): THREE.Group {
  const cloned = SkeletonUtils.clone(template) as THREE.Group;
  markGLBMaterials(cloned, true);
  return cloned;
}

/**
 * Clones the complete, single-rig first-person arms & sleeves (`fp_arms.glb`)
 * for real-time Two-Bone IK in `FirstPersonIKRig`.
 */
export function buildUnifiedFirstPersonArmsRig(fpArmsTemplate: THREE.Group): THREE.Group {
  const cloned = SkeletonUtils.clone(fpArmsTemplate) as THREE.Group;
  markGLBMaterials(cloned, true);
  // Start injury bandage hidden until player applies a bandage wound dressing
  const inj = cloned.getObjectByName('InjuryBandage_L');
  if (inj) inj.visible = false;
  return cloned;
}

export type FPArmClipName =
  | 'Idle'
  | 'Walk'
  | 'Sprint'
  | 'CrouchWalk'
  | 'Jump'
  | 'Land'
  | 'Wade'
  | 'Swim'
  | 'ChopSwing'
  | 'PickupGround'
  | 'PickupWaist'
  | 'PluckBush'
  | 'Drink'
  | 'Eat'
  | 'CraftBuild'
  | 'PlaceObject'
  | 'SwitchItem'
  | 'DamageFlinch'
  | 'ColdShiver';

export class FPArmsClipController {
  private mixers: THREE.AnimationMixer[] = [];
  private actions: Map<string, THREE.AnimationAction[]> = new Map();
  private activeClip: FPArmClipName = 'Idle';
  private oneShotTimer: number = 0;

  constructor(roots: THREE.Object3D[], clips: THREE.AnimationClip[]) {
    for (const root of roots) {
      const target = (root.userData.__skinnedClone as THREE.Object3D) || root;
      const mixer = new THREE.AnimationMixer(target);
      this.mixers.push(mixer);
      for (const clip of clips) {
        const act = mixer.clipAction(clip);
        act.weight = 0;
        const list = this.actions.get(clip.name) || [];
        list.push(act);
        this.actions.set(clip.name, list);
      }
    }
    this.crossfadeTo('Idle', 0.05, true);
  }

  public crossfadeTo(
    clipName: FPArmClipName,
    durationSec: number = 0.18,
    loop: boolean = true
  ): void {
    if (this.activeClip === clipName && loop) return;
    const prevActions = this.actions.get(this.activeClip) || [];
    const nextActions = this.actions.get(clipName) || [];
    if (nextActions.length === 0) return;

    for (const next of nextActions) {
      next.reset();
      next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      next.clampWhenFinished = !loop;
      next.enabled = true;
      next.setEffectiveTimeScale(1);
      next.setEffectiveWeight(0.32); // Blend skeletal motion subtly with procedural IK sway
      next.fadeIn(durationSec);
      next.play();
    }
    for (const prev of prevActions) {
      if (!nextActions.includes(prev)) {
        prev.fadeOut(durationSec);
      }
    }
    this.activeClip = clipName;
  }

  public triggerOneShot(clipName: FPArmClipName, durationSec: number): void {
    this.oneShotTimer = durationSec;
    this.crossfadeTo(clipName, 0.08, false);
  }

  public update(dt: number, baseLocomotionClip: FPArmClipName): void {
    if (this.oneShotTimer > 0) {
      this.oneShotTimer = Math.max(0, this.oneShotTimer - dt);
    } else if (this.activeClip !== baseLocomotionClip) {
      this.crossfadeTo(baseLocomotionClip, 0.18, true);
    }
    for (const m of this.mixers) {
      m.update(dt);
    }
  }
}
