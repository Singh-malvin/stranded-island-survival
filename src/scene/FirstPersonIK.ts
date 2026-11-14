import * as THREE from 'three';
import { ANIMATION_TUNING, IK_SWAY_TUNING } from '../survival/config.ts';
import { ItemId } from '../survival/types.ts';
import {
  buildUnifiedFirstPersonArmsRig,
  cloneHoldableGLB,
  FPArmClipName,
  LoadedGLBSet,
} from './GLBModelBank.ts';

export type FingerGripPose = 'relaxed' | 'power' | 'pinch' | 'twoHanded' | 'cupped' | 'food';

export interface HeldItemVisualSpec {
  itemId: ItemId | 'hammer_build' | null;
  modelKey: keyof LoadedGLBSet['tools'] | null;
  gripPose: FingerGripPose;
  twoHanded: boolean;
  scale: number;
  baseOffset: [number, number, number];
  baseEuler: [number, number, number];
  handRollOffsetR: [number, number, number];
  handRollOffsetL: [number, number, number];
  metalTint?: number;
}

const FINGER_POSES: Record<
  FingerGripPose,
  { index: number; middle: number; ring: number; pinky: number; thumb01: number; thumbTip: number }
> = {
  relaxed: { index: 0.14, middle: 0.18, ring: 0.22, pinky: 0.26, thumb01: 0.08, thumbTip: 0.12 },
  power: { index: 0.78, middle: 0.84, ring: 0.88, pinky: 0.90, thumb01: 0.42, thumbTip: 0.56 },
  pinch: { index: 0.68, middle: 0.52, ring: 0.34, pinky: 0.28, thumb01: 0.54, thumbTip: 0.62 },
  twoHanded: { index: 0.82, middle: 0.86, ring: 0.88, pinky: 0.90, thumb01: 0.45, thumbTip: 0.58 },
  cupped: { index: 0.42, middle: 0.45, ring: 0.46, pinky: 0.42, thumb01: 0.18, thumbTip: 0.26 },
  food: { index: 0.55, middle: 0.58, ring: 0.62, pinky: 0.64, thumb01: 0.35, thumbTip: 0.44 },
};

export function resolveHeldItemSpec(itemId: ItemId | 'hammer_build' | null): HeldItemVisualSpec {
  if (!itemId) {
    return {
      itemId: null,
      modelKey: null,
      gripPose: 'relaxed',
      twoHanded: false,
      scale: 1,
      baseOffset: [0, 0, 0],
      baseEuler: [0, 0, 0],
      handRollOffsetR: [0, 0, 0],
      handRollOffsetL: [0, 0, 0],
    };
  }
  switch (itemId) {
    case 'stone_axe':
    case 'metal_axe':
      return {
        itemId,
        modelKey: 'hatchetStone',
        gripPose: 'power',
        twoHanded: false,
        scale: 0.92,
        baseOffset: [0.22, -0.25, -0.46],
        baseEuler: [0.16, Math.PI * 0.5, -0.06],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
        metalTint: itemId === 'metal_axe' ? 0xb8c2cc : undefined,
      };
    case 'stone_pick':
    case 'metal_pick':
      return {
        itemId,
        modelKey: 'pickaxeFlint',
        gripPose: 'twoHanded',
        twoHanded: true,
        scale: 0.92,
        baseOffset: [0.16, -0.27, -0.48],
        baseEuler: [0.18, Math.PI * 0.48, -0.08],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
        metalTint: itemId === 'metal_pick' ? 0xc0cad4 : undefined,
      };
    case 'spear':
      return {
        itemId,
        modelKey: 'spear',
        gripPose: 'twoHanded',
        twoHanded: true,
        scale: 0.95,
        baseOffset: [0.20, -0.26, -0.44],
        baseEuler: [-1.22, 0.14, 0.08],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
      };
    case 'machete':
      return {
        itemId,
        modelKey: 'machete',
        gripPose: 'power',
        twoHanded: false,
        scale: 1.0,
        baseOffset: [0.23, -0.26, -0.45],
        baseEuler: [0.24, Math.PI * 0.5, -0.08],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
      };
    case 'torch':
      return {
        itemId,
        modelKey: 'torchHand',
        gripPose: 'power',
        twoHanded: false,
        scale: 0.98,
        baseOffset: [0.24, -0.28, -0.44],
        baseEuler: [-0.28, 0.08, -0.10],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
      };
    case 'lantern':
      return {
        itemId,
        modelKey: 'lantern',
        gripPose: 'power',
        twoHanded: false,
        scale: 0.95,
        baseOffset: [0.24, -0.14, -0.46],
        baseEuler: [0.05, 0.25, 0.0],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
      };
    case 'hammer_build':
    case 'campfire_kit':
    case 'shelter_kit':
      return {
        itemId,
        modelKey: 'hammerCraft',
        gripPose: 'power',
        twoHanded: false,
        scale: 0.96,
        baseOffset: [0.22, -0.25, -0.45],
        baseEuler: [0.16, Math.PI * 0.5, -0.05],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
      };
    case 'water_bottle_clean':
    case 'water_bottle_dirty':
    case 'empty_bottle':
      return {
        itemId,
        modelKey: 'waterContainer',
        gripPose: 'power',
        twoHanded: false,
        scale: 0.98,
        baseOffset: [0.21, -0.24, -0.43],
        baseEuler: [-0.14, -0.35, 0.08],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
      };
    case 'coconut':
    case 'cooked_meat':
    case 'cooked_fish':
    case 'raw_meat':
    case 'raw_fish':
    case 'dried_meat':
    case 'dried_fish':
    case 'berries':
      return {
        itemId,
        modelKey: 'foodRation',
        gripPose: 'food',
        twoHanded: true,
        scale: 0.92,
        baseOffset: [0.16, -0.22, -0.42],
        baseEuler: [-0.35, 0.25, 0.0],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
      };
    case 'rope':
    case 'fibre':
    case 'cloth_scrap':
      return {
        itemId,
        modelKey: 'ropeCoil',
        gripPose: 'pinch',
        twoHanded: false,
        scale: 0.88,
        baseOffset: [0.21, -0.22, -0.42],
        baseEuler: [0.68, 0.22, 0.14],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
      };
    case 'stick':
    case 'driftwood':
    case 'palm_frond':
      return {
        itemId,
        modelKey: 'branchFallen',
        gripPose: 'power',
        twoHanded: true,
        scale: 0.82,
        baseOffset: [0.18, -0.26, -0.45],
        baseEuler: [-0.45, 0.35, 0.10],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
      };
    default:
      // Flint, stone, ore, herbs, poultice, small craftables
      return {
        itemId,
        modelKey: 'flintSharp',
        gripPose: 'pinch',
        twoHanded: false,
        scale: 0.94,
        baseOffset: [0.21, -0.21, -0.41],
        baseEuler: [0.22, 0.45, -0.10],
        handRollOffsetR: [0, 0, 0],
        handRollOffsetL: [0, 0, 0],
      };
  }
}

// Reusable scratch objects for zero-GC 60fps IK solve
const _pA = new THREE.Vector3();
const _pB = new THREE.Vector3();
const _pC = new THREE.Vector3();
const _toT = new THREE.Vector3();
const _dirT = new THREE.Vector3();
const _toPole = new THREE.Vector3();
const _bend = new THREE.Vector3();
const _desDirA = new THREE.Vector3();
const _desDirB = new THREE.Vector3();
const _curDirA = new THREE.Vector3();
const _curDirB = new THREE.Vector3();
const _pBDes = new THREE.Vector3();
const _qCur = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();
const _qWorldNew = new THREE.Quaternion();

/**
 * Analytic Two-Bone Inverse Kinematics solver using Law of Cosines + Elbow Pole Target.
 * Places `endBone` at `targetWorldPos` by rotating `upperBone` and `midBone` while
 * bending elbows toward `poleWorldPos` (no flipping/twisting) and optionally applying
 * slight anatomical stretch (`maxStretch`) when slightly out of reach.
 */
export function solveTwoBoneIK(
  upperBone: THREE.Bone,
  midBone: THREE.Bone,
  endBone: THREE.Bone,
  targetWorldPos: THREE.Vector3,
  poleWorldPos: THREE.Vector3,
  restL1: number,
  restL2: number,
  targetHandWorldQuat: THREE.Quaternion | null,
  handBlend: number,
  maxStretch: number = IK_SWAY_TUNING.MAX_ARM_STRETCH
): void {
  upperBone.getWorldPosition(_pA);
  midBone.getWorldPosition(_pB);
  endBone.getWorldPosition(_pC);

  _toT.subVectors(targetWorldPos, _pA);
  let dist = _toT.length();
  if (dist < 1e-4) return;
  _dirT.copy(_toT).divideScalar(dist);

  const minReach = Math.max(0.05, Math.abs(restL1 - restL2) + 0.02);
  const maxReach = restL1 + restL2 - 0.004;

  let effL1 = restL1;
  let effL2 = restL2;
  let stretchScale = 1.0;

  if (dist > maxReach && maxStretch > 1.0) {
    const ratio = Math.min(maxStretch, dist / maxReach);
    stretchScale = ratio;
    effL1 = restL1 * ratio;
    effL2 = restL2 * ratio;
    dist = Math.min(dist, maxReach * ratio);
  } else {
    dist = THREE.MathUtils.clamp(dist, minReach, maxReach);
  }

  // Slight length stretch on bones when overreaching so palm never snaps off grip
  upperBone.scale.set(1, stretchScale, 1);
  midBone.scale.set(1, stretchScale, 1);

  const cosA = THREE.MathUtils.clamp(
    (effL1 * effL1 + dist * dist - effL2 * effL2) / (2 * effL1 * dist),
    -1,
    1
  );
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

  _toPole.subVectors(poleWorldPos, _pA);
  const proj = _toPole.dot(_dirT);
  _bend.copy(_toPole).addScaledVector(_dirT, -proj);
  if (_bend.lengthSq() < 1e-6) {
    _bend.set(0, -1, 0);
  } else {
    _bend.normalize();
  }

  // Desired upper-arm direction
  _desDirA.copy(_dirT).multiplyScalar(cosA).addScaledVector(_bend, sinA).normalize();
  _pBDes.copy(_pA).addScaledVector(_desDirA, effL1);
  _desDirB.copy(_dirT).multiplyScalar(dist).add(_pA).sub(_pBDes).normalize();

  // Rotate upperBone so curDirA -> desDirA
  _curDirA.subVectors(_pB, _pA);
  if (_curDirA.lengthSq() > 1e-8) {
    _curDirA.normalize();
    _qDelta.setFromUnitVectors(_curDirA, _desDirA);
    upperBone.getWorldQuaternion(_qCur);
    _qWorldNew.multiplyQuaternions(_qDelta, _qCur);
    if (upperBone.parent) {
      upperBone.parent.getWorldQuaternion(_qParent);
      _qParent.invert();
      upperBone.quaternion.multiplyQuaternions(_qParent, _qWorldNew);
    }
    upperBone.updateMatrixWorld(true);
  }

  // Re-read mid & end positions after upperBone rotated, then align forearm -> target
  midBone.getWorldPosition(_pB);
  endBone.getWorldPosition(_pC);
  _curDirB.subVectors(_pC, _pB);
  if (_curDirB.lengthSq() > 1e-8) {
    _curDirB.normalize();
    _qDelta.setFromUnitVectors(_curDirB, _desDirB);
    midBone.getWorldQuaternion(_qCur);
    _qWorldNew.multiplyQuaternions(_qDelta, _qCur);
    if (midBone.parent) {
      midBone.parent.getWorldQuaternion(_qParent);
      _qParent.invert();
      midBone.quaternion.multiplyQuaternions(_qParent, _qWorldNew);
    }
    midBone.updateMatrixWorld(true);
  }

  // Orient hand to wrap grip orientation smoothly
  if (targetHandWorldQuat && handBlend > 0.01) {
    endBone.getWorldQuaternion(_qCur);
    if (endBone.parent) {
      endBone.parent.getWorldQuaternion(_qParent);
      _qParent.invert();
      _qWorldNew.copy(_qCur).slerp(targetHandWorldQuat, handBlend);
      endBone.quaternion.multiplyQuaternions(_qParent, _qWorldNew);
      endBone.updateMatrixWorld(true);
    }
  }
}

export interface IKFrameContext {
  dt: number;
  elapsedSec: number;
  yawDelta: number;
  pitchDelta: number;
  moveBlend: number;
  sprintBlend: number;
  crouchBlend: number;
  proneBlend: number;
  swimBlend: number;
  wallDistance: number;
  swingProgress: number; // -1 when inactive, 0..1 when chopping/swinging
  swingKind: string;
  pickupProgress: number; // -1 when inactive, 0..1
  pickupReach: 'ground' | 'waist' | 'bush';
  activeActionClip: FPArmClipName;
  shiverAmount: number;
  injuredBandaged: boolean;
  cuppedDrinkBlend: number; // 0..1 when drinking cupped from spring
  biteEatBlend: number; // 0..1 when eating food
  drinkBottleBlend?: number; // 0..1 when drinking from bottle/canteen
  bandageBlend?: number; // 0..1 when wrapping injury bandage
  mapLookBlend?: number; // 0..1 when unfolding physical paper map
  heatWipeBlend?: number; // 0..1 wiping sweat from brow when hot
  coughBlend?: number; // 0..1 coughing from sickness
  exhaustedAmount?: number; // 0..1 exhaustion droop + heavy breath
  swimStrokePhase?: number; // radians for breaststroke sweep
  sitBlend?: number; // 0..1 seated posture
  sleepBlend?: number; // 0..1 sleeping posture
  euphoriaBrace?: number; // 0..1 landing arm brace reach
  euphoriaFlail?: number; // 0..1 falling windmilling flail
  euphoriaFlailAngle?: number;
}

interface ArmBoneChain {
  upper: THREE.Bone | null;
  mid: THREE.Bone | null;
  hand: THREE.Bone | null;
  wrist: THREE.Bone | null;
  restL1: number;
  restL2: number;
  fingers: Record<'index' | 'middle' | 'ring' | 'pinky' | 'thumb', THREE.Bone[]>;
}

const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _poleWorld = new THREE.Vector3();
const _targetR = new THREE.Vector3();
const _targetL = new THREE.Vector3();
const _quatR = new THREE.Quaternion();
const _quatL = new THREE.Quaternion();
const _eulerScratch = new THREE.Euler();

export class FirstPersonIKRig {
  public readonly root: THREE.Group;
  private readonly armsModel: THREE.Group;
  private readonly itemAnchor: THREE.Group;
  private readonly mixer: THREE.AnimationMixer;
  private readonly clips: Map<FPArmClipName, THREE.AnimationAction> = new Map();
  private activeClip: FPArmClipName | null = null;

  private readonly boneR: ArmBoneChain;
  private readonly boneL: ArmBoneChain;
  private readonly injuryBandageMesh: THREE.Object3D | null = null;
  private readonly armMeshes: THREE.SkinnedMesh[] = [];
  private readonly mapPaperMesh: THREE.Mesh;

  private currentSpec: HeldItemVisualSpec = resolveHeldItemSpec(null);
  private activeItemClone: THREE.Group | null = null;
  private activeGripR: THREE.Object3D | null = null;
  private activeGripL: THREE.Object3D | null = null;
  private readonly itemCache: Map<string, THREE.Group> = new Map();

  // MW sway spring-damper state
  private swayX = 0;
  private swayY = 0;
  private swayVelX = 0;
  private swayVelY = 0;
  private walkPhase = 0;
  private sprintPose = 0;
  private wallPullback = 0;
  private offhandIKBlend = 0;

  // Impact & Inspect state
  private impactHitstopTimer = 0;
  private impactRecoil = 0;
  private inspectTimer = 0;
  private inspectActive = false;

  // Skin wetness / dirt shading state for Part 5
  private grimeIntensity = 0;
  private wetGloss = 0;

  constructor(private readonly glbs: LoadedGLBSet) {
    this.root = new THREE.Group();
    this.root.name = 'FP_IK_System';

    this.armsModel = buildUnifiedFirstPersonArmsRig(glbs.fpArms);
    this.armsModel.position.set(0, -0.02, -0.02);
    this.root.add(this.armsModel);

    this.itemAnchor = new THREE.Group();
    this.itemAnchor.name = 'FP_Item_Anchor';
    this.root.add(this.itemAnchor);

    this.injuryBandageMesh = this.armsModel.getObjectByName('InjuryBandage_L') ?? null;
    this.armsModel.traverse((obj) => {
      const sk = obj as THREE.SkinnedMesh;
      if (sk.isSkinnedMesh) this.armMeshes.push(sk);
    });

    // Folded survival island parchment map for quick [M]/[J] physical lookup animation
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = 128;
    mapCanvas.height = 96;
    const mctx = mapCanvas.getContext('2d');
    if (mctx) {
      mctx.fillStyle = '#e2cfa8';
      mctx.fillRect(0, 0, 128, 96);
      mctx.strokeStyle = '#6b533b';
      mctx.lineWidth = 2;
      mctx.beginPath();
      mctx.ellipse(64, 48, 36, 26, 0.2, 0, Math.PI * 2);
      mctx.stroke();
      mctx.fillStyle = '#8d9b72';
      mctx.fill();
      mctx.strokeStyle = '#9e2a2b';
      mctx.beginPath();
      mctx.moveTo(46, 54);
      mctx.lineTo(54, 62);
      mctx.moveTo(54, 54);
      mctx.lineTo(46, 62);
      mctx.stroke();
    }
    const mapTex = new THREE.CanvasTexture(mapCanvas);
    mapTex.colorSpace = THREE.SRGBColorSpace;
    this.mapPaperMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.17, 4, 2),
      new THREE.MeshStandardMaterial({
        map: mapTex,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide,
      })
    );
    this.mapPaperMesh.visible = false;
    this.mapPaperMesh.name = 'FP_FoldedMap_Prop';
    this.root.add(this.mapPaperMesh);

    this.boneR = this.collectChain('R');
    this.boneL = this.collectChain('L');

    // Bind animations cleanly on single unified rig
    this.mixer = new THREE.AnimationMixer(this.armsModel);
    this.armsModel.updateMatrixWorld(true);
    for (const clip of glbs.fpArmsAnimations) {
      const action = this.mixer.clipAction(clip);
      const name = clip.name as FPArmClipName;
      if (
        name === 'ChopSwing' ||
        name === 'PickupGround' ||
        name === 'PickupWaist' ||
        name === 'PluckBush' ||
        name === 'Jump' ||
        name === 'Land' ||
        name === 'DamageFlinch' ||
        name === 'SwitchItem' ||
        name === 'PlaceObject'
      ) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = false;
      }
      this.clips.set(name, action);
    }
    this.playClip('Idle');
  }

  private collectChain(side: 'L' | 'R'): ArmBoneChain {
    const getB = (n: string) => (this.armsModel.getObjectByName(n) as THREE.Bone | undefined) ?? null;
    const upper = getB(`upper_arm.${side}`);
    const mid = getB(`forearm.${side}`);
    const wrist = getB(`wrist.${side}`);
    const hand = getB(`hand.${side}`) ?? wrist;

    this.armsModel.updateMatrixWorld(true);
    let restL1 = 0.31;
    let restL2 = 0.26;
    if (upper && mid && hand) {
      upper.getWorldPosition(_tmpVecA);
      mid.getWorldPosition(_tmpVecB);
      restL1 = Math.max(0.18, _tmpVecA.distanceTo(_tmpVecB));
      hand.getWorldPosition(_tmpVecA);
      restL2 = Math.max(0.16, _tmpVecB.distanceTo(_tmpVecA));
    }

    const collectFingers = (prefix: string): THREE.Bone[] =>
      [1, 2, 3].map((i) => getB(`${prefix}_0${i}.${side}`)).filter((b): b is THREE.Bone => !!b);

    return {
      upper,
      mid,
      hand,
      wrist,
      restL1,
      restL2,
      fingers: {
        index: collectFingers('index'),
        middle: collectFingers('middle'),
        ring: collectFingers('ring'),
        pinky: collectFingers('pinky'),
        thumb: collectFingers('thumb'),
      },
    };
  }

  public playClip(name: FPArmClipName): void {
    if (this.activeClip === name) return;
    const next = this.clips.get(name) ?? this.clips.get('Idle');
    if (!next) return;
    const prev = this.activeClip ? this.clips.get(this.activeClip) : null;
    next.reset().play();
    if (prev && prev !== next) {
      prev.crossFadeTo(next, 0.16, false);
    }
    this.activeClip = name;
  }

  public setHeldItem(itemId: ItemId | 'hammer_build' | null): void {
    if (this.currentSpec.itemId === itemId) return;
    this.currentSpec = resolveHeldItemSpec(itemId);
    this.inspectActive = false;
    this.inspectTimer = 0;

    if (this.activeItemClone) {
      this.activeItemClone.visible = false;
      this.itemAnchor.remove(this.activeItemClone);
      this.activeItemClone = null;
      this.activeGripR = null;
      this.activeGripL = null;
    }

    const key = this.currentSpec.modelKey;
    if (!key) return;

    const cacheKey = `${key}_${itemId ?? 'default'}`;
    let inst = this.itemCache.get(cacheKey);
    if (!inst) {
      const tpl = this.glbs.tools[key];
      if (!tpl) return;
      inst = cloneHoldableGLB(tpl);
      if (this.currentSpec.metalTint !== undefined) {
        const tint = this.currentSpec.metalTint;
        inst.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m && m.isMeshStandardMaterial && (m.metalness > 0.1 || o.name.toLowerCase().includes('head') || o.name.toLowerCase().includes('hatchet') || o.name.toLowerCase().includes('pick'))) {
            const c = m.clone();
            c.color.setHex(tint);
            c.metalness = Math.max(c.metalness, 0.78);
            c.roughness = Math.min(c.roughness, 0.42);
            (o as THREE.Mesh).material = c;
          }
        });
      }
      this.itemCache.set(cacheKey, inst);
    }

    inst.visible = true;
    inst.scale.setScalar(this.currentSpec.scale);
    this.itemAnchor.add(inst);
    this.activeItemClone = inst;
    this.activeGripR = inst.getObjectByName('ik_hand_R') ?? null;
    this.activeGripL = inst.getObjectByName('ik_hand_L') ?? null;
  }

  public notifyImpactHit(): void {
    this.impactHitstopTimer = IK_SWAY_TUNING.IMPACT_HITSTOP_SEC;
    this.impactRecoil = 1.0;
  }

  public toggleInspect(): boolean {
    this.inspectActive = !this.inspectActive;
    if (this.inspectActive) {
      this.inspectTimer = IK_SWAY_TUNING.INSPECT_DURATION_SEC;
    } else {
      this.inspectTimer = 0;
    }
    return this.inspectActive;
  }

  public isInspecting(): boolean {
    return this.inspectActive;
  }

  public setBandageVisible(visible: boolean): void {
    if (this.injuryBandageMesh) {
      this.injuryBandageMesh.visible = visible;
    }
  }

  /** Visually scuffs and dulls the active held tool as its durability drops. */
  public setToolDurabilityWear(ratio01: number): void {
    if (!this.activeItemClone) return;
    const wear = Math.max(0, Math.min(1, 1 - ratio01));
    if (this.activeItemClone.userData._appliedWear === Math.round(wear * 20)) return;
    this.activeItemClone.userData._appliedWear = Math.round(wear * 20);
    this.activeItemClone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const nextMats = mats.map((mat, idx) => {
        const std = mat as THREE.MeshStandardMaterial;
        if (!std || !std.isMeshStandardMaterial) return mat;
        let target = std;
        if (!std.userData._wearCloned) {
          target = std.clone();
          target.userData._wearCloned = true;
          target.userData._baseRoughness = std.roughness;
          target.userData._baseColor = std.color.clone();
          if (Array.isArray(mesh.material)) {
            mats[idx] = target;
          } else {
            mesh.material = target;
          }
        }
        const baseR = (target.userData._baseRoughness as number | undefined) ?? 0.5;
        const baseC = target.userData._baseColor as THREE.Color | undefined;
        target.roughness = THREE.MathUtils.clamp(baseR + wear * 0.34, 0.15, 0.98);
        if (baseC) {
          const dull = 1.0 - wear * 0.32;
          target.color.setRGB(baseC.r * dull, baseC.g * (dull - wear * 0.04), baseC.b * (dull - wear * 0.06));
        }
        return target;
      });
      if (Array.isArray(mesh.material)) {
        mesh.material = nextMats;
      }
    });
  }

  /** Updates skin grime, blood smears, and wetness specular response for weather & injury immersion. */
  public setSkinConditions(wet01: number, grime01: number, blood01: number = 0): void {
    if (
      Math.abs(wet01 - this.wetGloss) < 0.03 &&
      Math.abs(grime01 - this.grimeIntensity) < 0.03 &&
      Math.abs(blood01 - ((this as any)._bloodLevel ?? 0)) < 0.04
    ) {
      return;
    }
    this.wetGloss = wet01;
    this.grimeIntensity = grime01;
    (this as any)._bloodLevel = blood01;
    for (const sk of this.armMeshes) {
      const mats = Array.isArray(sk.material) ? sk.material : [sk.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (!std.isMeshStandardMaterial) continue;
        if (std.name.toLowerCase().includes('skin')) {
          std.roughness = THREE.MathUtils.lerp(0.58, 0.22, wet01);
          const g = 1.0 - grime01 * 0.25;
          std.color.setRGB(
            Math.min(1, g + blood01 * 0.12),
            g * (1 - grime01 * 0.06 - blood01 * 0.24),
            g * (1 - grime01 * 0.10 - blood01 * 0.28)
          );
        }
      }
    }
  }

  private applyFingerCurl(chain: ArmBoneChain, pose: FingerGripPose, blend: number): void {
    const p = FINGER_POSES[pose];
    const curlChain = (bones: THREE.Bone[], amount: number) => {
      for (let i = 0; i < bones.length; i++) {
        bones[i].rotation.x += amount * blend * (i === 0 ? 0.62 : i === 1 ? 0.78 : 0.65);
      }
    };
    curlChain(chain.fingers.index, p.index);
    curlChain(chain.fingers.middle, p.middle);
    curlChain(chain.fingers.ring, p.ring);
    curlChain(chain.fingers.pinky, p.pinky);
    if (chain.fingers.thumb[0]) {
      chain.fingers.thumb[0].rotation.z -= p.thumb01 * blend * 0.32;
      chain.fingers.thumb[0].rotation.x += p.thumb01 * blend * 0.42;
    }
    if (chain.fingers.thumb[1]) chain.fingers.thumb[1].rotation.x += p.thumbTip * blend * 0.56;
    if (chain.fingers.thumb[2]) chain.fingers.thumb[2].rotation.x += p.thumbTip * blend * 0.48;
  }

  public update(ctx: IKFrameContext): void {
    const dt = Math.min(0.05, Math.max(0.001, ctx.dt));
    if (this.injuryBandageMesh) {
      this.injuryBandageMesh.visible = ctx.injuredBandaged || (ctx.bandageBlend ?? 0) > 0.25;
    }

    // Hitstop pauses swing advancement briefly on contact for weighty chop/mine feedback
    const effectiveDt = this.impactHitstopTimer > 0 ? dt * 0.08 : dt;
    if (this.impactHitstopTimer > 0) {
      this.impactHitstopTimer = Math.max(0, this.impactHitstopTimer - dt);
    }
    this.impactRecoil = Math.max(0, this.impactRecoil - dt * IK_SWAY_TUNING.IMPACT_RECOIL_DECAY_SPEED);

    // Advance base skeleton animation clip cleanly
    if (this.activeClip !== ctx.activeActionClip) {
      this.playClip(ctx.activeActionClip);
    }
    this.mixer.update(effectiveDt);

    // Inspect countdown
    if (this.inspectActive) {
      this.inspectTimer -= dt;
      if (this.inspectTimer <= 0) {
        this.inspectActive = false;
      }
    }

    // 1. Spring-damper Modern Warfare camera-look inertia
    const targetImpulseX = THREE.MathUtils.clamp(
      -ctx.yawDelta * IK_SWAY_TUNING.INERTIA_INPUT_SCALE_X,
      -IK_SWAY_TUNING.INERTIA_MAX_OFFSET,
      IK_SWAY_TUNING.INERTIA_MAX_OFFSET
    );
    const targetImpulseY = THREE.MathUtils.clamp(
      -ctx.pitchDelta * IK_SWAY_TUNING.INERTIA_INPUT_SCALE_Y,
      -IK_SWAY_TUNING.INERTIA_MAX_OFFSET,
      IK_SWAY_TUNING.INERTIA_MAX_OFFSET
    );
    this.swayVelX += (targetImpulseX - this.swayX) * IK_SWAY_TUNING.INERTIA_STIFFNESS * dt;
    this.swayVelY += (targetImpulseY - this.swayY) * IK_SWAY_TUNING.INERTIA_STIFFNESS * dt;
    const damp = Math.exp(-IK_SWAY_TUNING.INERTIA_DAMPING * dt);
    this.swayVelX *= damp;
    this.swayVelY *= damp;
    this.swayX = THREE.MathUtils.clamp(
      this.swayX + this.swayVelX * dt,
      -IK_SWAY_TUNING.INERTIA_MAX_OFFSET,
      IK_SWAY_TUNING.INERTIA_MAX_OFFSET
    );
    this.swayY = THREE.MathUtils.clamp(
      this.swayY + this.swayVelY * dt,
      -IK_SWAY_TUNING.INERTIA_MAX_OFFSET,
      IK_SWAY_TUNING.INERTIA_MAX_OFFSET
    );

    // 2. Figure-8 movement bob + sprint pose + breathing
    const freq =
      IK_SWAY_TUNING.WALK_BOB_FREQ * (1 + ctx.sprintBlend * 0.42);
    this.walkPhase += effectiveDt * freq * (0.15 + ctx.moveBlend * 0.85);
    const bobScale = ctx.moveBlend * (1 + ctx.sprintBlend * (IK_SWAY_TUNING.SPRINT_BOB_MULT - 1));
    const fig8X = Math.sin(this.walkPhase) * IK_SWAY_TUNING.WALK_BOB_AMP_X * bobScale;
    const fig8Y = Math.sin(this.walkPhase * 2) * IK_SWAY_TUNING.WALK_BOB_AMP_Y * bobScale;

    this.sprintPose = THREE.MathUtils.lerp(
      this.sprintPose,
      this.inspectActive || ctx.swingProgress >= 0 ? 0 : ctx.sprintBlend,
      Math.min(1, dt * IK_SWAY_TUNING.SPRINT_POSE_BLEND_SPEED)
    );

    const drinkBottle = ctx.drinkBottleBlend ?? 0;
    const bandage = ctx.bandageBlend ?? 0;
    const mapLook = ctx.mapLookBlend ?? 0;
    const heatWipe = ctx.heatWipeBlend ?? 0;
    const cough = ctx.coughBlend ?? 0;
    const exhausted = ctx.exhaustedAmount ?? 0;

    const exBreathMult = 1 + exhausted * 1.45;
    const breathY =
      Math.sin(ctx.elapsedSec * IK_SWAY_TUNING.BREATH_FREQ_RAD * (1 + exhausted * 0.6)) *
      IK_SWAY_TUNING.BREATH_AMP_Y *
      exBreathMult;
    const breathPitch =
      Math.sin(ctx.elapsedSec * IK_SWAY_TUNING.BREATH_FREQ_RAD + 0.5) *
      IK_SWAY_TUNING.BREATH_AMP_PITCH *
      exBreathMult;

    // 3. Wall / solid proximity avoidance pullback
    const rawWallFactor =
      ctx.wallDistance < IK_SWAY_TUNING.WALL_AVOID_RAY_DIST
        ? 1 - ctx.wallDistance / IK_SWAY_TUNING.WALL_AVOID_RAY_DIST
        : 0;
    this.wallPullback = THREE.MathUtils.lerp(
      this.wallPullback,
      THREE.MathUtils.clamp(rawWallFactor, 0, 1),
      Math.min(1, dt * IK_SWAY_TUNING.WALL_AVOID_BLEND_SPEED)
    );

    // 4. Shiver + Euphoria brace/flail + Swing arc + Impact recoil + Inspect pose
    const shiverJit = ctx.shiverAmount > 0 ? Math.sin(ctx.elapsedSec * 36) * 0.006 * ctx.shiverAmount : 0;
    const brace = ctx.euphoriaBrace ?? 0;
    const flail = ctx.euphoriaFlail ?? 0;
    const flailAng = ctx.euphoriaFlailAngle ?? 0;
    const euphY = -brace * 0.10 + flail * flailAng * 0.07;
    const euphZ = -brace * 0.12 - flail * 0.06;
    const euphPitch = -brace * 0.28 + flail * flailAng * 0.25;

    let swingPosX = 0;
    let swingPosY = 0;
    let swingPosZ = 0;
    let swingRotX = 0;
    let swingRotY = 0;
    let swingRotZ = 0;
    if (ctx.swingProgress >= 0) {
      const p = ctx.swingProgress;
      const windUp = p < 0.28 ? -Math.sin((p / 0.28) * Math.PI * 0.5) : 0;
      const strike =
        p >= 0.28 && p < 0.62
          ? Math.sin(((p - 0.28) / 0.34) * Math.PI)
          : p >= 0.62
            ? Math.sin(((p - 0.62) / 0.38) * Math.PI * 0.5) * 0.15
            : 0;
      if (ctx.swingKind === 'spear') {
        swingPosZ = windUp * -0.10 - strike * 0.32;
        swingPosX = -strike * 0.05;
        swingRotX = strike * 0.14;
      } else {
        swingPosX = -strike * 0.14 + windUp * -0.06;
        swingPosY = -strike * 0.12 - windUp * 0.10;
        swingPosZ = -strike * 0.12 + windUp * -0.05;
        swingRotX = windUp * -0.58 + strike * 1.08;
        swingRotY = -strike * 0.34;
        swingRotZ = -strike * 0.26;
      }
    }

    const inspectBlend = this.inspectActive
      ? Math.sin(Math.min(1, 1 - this.inspectTimer / IK_SWAY_TUNING.INSPECT_DURATION_SEC) * Math.PI)
      : 0;
    const inspectTurn = this.inspectActive
      ? Math.sin(
          (IK_SWAY_TUNING.INSPECT_DURATION_SEC - this.inspectTimer) * IK_SWAY_TUNING.INSPECT_ROT_SPEED
        )
      : 0;

    // 5. Place itemAnchor cleanly relative to camera
    const [bx, by, bz] = this.currentSpec.baseOffset;
    const [erx, ery, erz] = this.currentSpec.baseEuler;

    const sit = ctx.sitBlend ?? 0;
    const sleep = ctx.sleepBlend ?? 0;
    const chewBob = ctx.biteEatBlend > 0.05 ? Math.sin(ctx.elapsedSec * 16) * 0.014 * ctx.biteEatBlend : 0;

    if (this.activeItemClone) {
      const eatShrink = ctx.biteEatBlend > 0.05 ? Math.max(0.38, 1 - ctx.biteEatBlend * 0.48) : 1;
      this.activeItemClone.scale.setScalar(this.currentSpec.scale * eatShrink);
    }

    this.itemAnchor.position.set(
      bx +
        this.swayX +
        fig8X +
        swingPosX +
        shiverJit +
        inspectBlend * IK_SWAY_TUNING.INSPECT_POS_OFFSET[0] -
        drinkBottle * 0.08,
      by +
        this.swayY +
        fig8Y +
        breathY +
        this.sprintPose * IK_SWAY_TUNING.SPRINT_DROP_Y +
        this.wallPullback * IK_SWAY_TUNING.WALL_PULLBACK_MAX_Y +
        swingPosY +
        euphY -
        exhausted * 0.036 -
        sit * 0.045 -
        ctx.proneBlend * 0.055 -
        sleep * 0.12 -
        mapLook * 0.18 +
        ctx.biteEatBlend * 0.13 +
        chewBob +
        drinkBottle * 0.14 +
        inspectBlend * IK_SWAY_TUNING.INSPECT_POS_OFFSET[1],
      bz +
        this.sprintPose * IK_SWAY_TUNING.SPRINT_FORWARD_Z +
        this.wallPullback * IK_SWAY_TUNING.WALL_PULLBACK_MAX_Z +
        this.impactRecoil * IK_SWAY_TUNING.IMPACT_RECOIL_BACK_Z +
        swingPosZ +
        euphZ +
        ctx.biteEatBlend * 0.16 +
        drinkBottle * 0.17 +
        inspectBlend * IK_SWAY_TUNING.INSPECT_POS_OFFSET[2]
    );

    this.itemAnchor.rotation.set(
      erx +
        breathPitch +
        this.swayY * IK_SWAY_TUNING.INERTIA_ROT_PITCH_MULT +
        this.sprintPose * IK_SWAY_TUNING.SPRINT_TILT_PITCH +
        this.wallPullback * IK_SWAY_TUNING.WALL_PULLBACK_PITCH +
        this.impactRecoil * IK_SWAY_TUNING.IMPACT_RECOIL_PITCH +
        swingRotX +
        euphPitch +
        drinkBottle * 0.72 +
        ctx.biteEatBlend * 0.28 +
        inspectTurn * 0.35,
      ery +
        this.swayX * IK_SWAY_TUNING.INERTIA_ROT_YAW_MULT +
        this.sprintPose * IK_SWAY_TUNING.SPRINT_TILT_YAW +
        swingRotY +
        inspectTurn * 0.95,
      erz +
        this.swayX * IK_SWAY_TUNING.INERTIA_ROT_ROLL_MULT +
        this.sprintPose * IK_SWAY_TUNING.SPRINT_TILT_ROLL +
        swingRotZ +
        drinkBottle * 0.18 +
        inspectTurn * 0.28
    );

    if (mapLook > 0.05) {
      this.mapPaperMesh.visible = true;
      const slideIn = Math.sin(Math.min(1, mapLook) * Math.PI * 0.5);
      this.mapPaperMesh.position.set(0, -0.17 + slideIn * 0.06, -0.34);
      this.mapPaperMesh.rotation.set(-0.62 + slideIn * 0.22, 0.02, Math.sin(ctx.elapsedSec * 4) * 0.02);
      this.mapPaperMesh.scale.setScalar(0.55 + slideIn * 0.45);
    } else {
      this.mapPaperMesh.visible = false;
    }

    this.root.updateMatrixWorld(true);

    // 6. Solve Right & Left Two-Bone IK onto Grip Bones (`ik_hand_R` / `ik_hand_L`)
    const hasItem = this.activeItemClone !== null && this.activeGripR !== null;
    if (hasItem && this.boneR.upper && this.boneR.mid && this.boneR.hand) {
      this.activeGripR!.getWorldPosition(_targetR);
      this.activeGripR!.getWorldQuaternion(_quatR);

      _poleWorld
        .set(
          IK_SWAY_TUNING.ELBOW_POLE_R[0],
          IK_SWAY_TUNING.ELBOW_POLE_R[1],
          IK_SWAY_TUNING.ELBOW_POLE_R[2]
        )
        .applyMatrix4(this.root.matrixWorld);

      solveTwoBoneIK(
        this.boneR.upper,
        this.boneR.mid,
        this.boneR.hand,
        _targetR,
        _poleWorld,
        this.boneR.restL1,
        this.boneR.restL2,
        _quatR,
        0.92
      );
      this.applyFingerCurl(this.boneR, this.currentSpec.gripPose, 1.0);
    } else if (this.boneR.upper && this.boneR.mid && this.boneR.hand) {
      // Bare-hand IK: swim stroke, bandage wrap, map unfold, heat brow wipe, cough, cupped drinking, pickup reach, or Euphoria brace/flail
      const swim = ctx.swimBlend;
      const swimAng = ctx.swimStrokePhase ?? ctx.elapsedSec * 5.2;
      if (
        ctx.cuppedDrinkBlend > 0.02 ||
        ctx.pickupProgress >= 0 ||
        bandage > 0.02 ||
        mapLook > 0.02 ||
        heatWipe > 0.02 ||
        cough > 0.02 ||
        swim > 0.15 ||
        inspectBlend > 0.05 ||
        brace > 0.03 ||
        flail > 0.03
      ) {
        const reachArc =
          ctx.pickupProgress >= 0 ? Math.sin(ctx.pickupProgress * Math.PI) : 0;
        const cupArc = ctx.cuppedDrinkBlend;
        const bandSweep = bandage > 0.02 ? Math.sin(ctx.elapsedSec * 13) * 0.055 * bandage : 0;
        const wipeSweep = heatWipe > 0.02 ? Math.sin(heatWipe * Math.PI) : 0;
        const coughArc = cough > 0.02 ? Math.sin(cough * Math.PI) : 0;
        const swimOutX = swim > 0.15 ? Math.max(0, Math.sin(swimAng)) * 0.18 * swim : 0;
        const swimPushZ = swim > 0.15 ? -Math.cos(swimAng) * 0.17 * swim : 0;
        _tmpVecA.set(
          0.16 -
            cupArc * 0.10 -
            inspectBlend * 0.08 -
            bandage * 0.18 +
            bandSweep -
            wipeSweep * 0.14 -
            coughArc * 0.14 +
            mapLook * -0.02 +
            swimOutX +
            flail * 0.09,
          -0.27 +
            cupArc * 0.14 +
            bandage * 0.06 +
            Math.cos(ctx.elapsedSec * 13) * 0.04 * bandage +
            wipeSweep * 0.24 +
            coughArc * 0.19 +
            mapLook * 0.10 +
            inspectBlend * 0.11 +
            flail * flailAng * 0.12 -
            brace * 0.08 -
            exhausted * 0.03 -
            (ctx.pickupReach === 'ground' ? reachArc * 0.16 : reachArc * 0.03),
          -0.42 -
            reachArc * 0.18 -
            brace * 0.18 +
            cupArc * 0.10 +
            bandage * 0.08 +
            coughArc * 0.16 +
            mapLook * 0.06 +
            swimPushZ +
            inspectBlend * 0.08
        );
        _tmpVecA.applyMatrix4(this.root.matrixWorld);
        _poleWorld
          .set(...IK_SWAY_TUNING.ELBOW_POLE_R)
          .applyMatrix4(this.root.matrixWorld);
        solveTwoBoneIK(
          this.boneR.upper,
          this.boneR.mid,
          this.boneR.hand,
          _tmpVecA,
          _poleWorld,
          this.boneR.restL1,
          this.boneR.restL2,
          null,
          0
        );
        this.applyFingerCurl(
          this.boneR,
          cupArc > 0.2 ? 'cupped' : bandage > 0.2 || mapLook > 0.2 ? 'pinch' : reachArc > 0.35 ? 'power' : 'relaxed',
          Math.max(0.45, Math.max(cupArc, reachArc, bandage, mapLook))
        );
      } else {
        this.applyFingerCurl(this.boneR, 'relaxed', 0.65);
      }
    }

    // Left arm IK: engages on two-handed items, inspecting, cupped drinking, bandaging, map lookup, swim sweep, pickup reach, or brace
    const useLeftItemGrip =
      hasItem &&
      this.activeGripL !== null &&
      (this.currentSpec.twoHanded || this.inspectActive || ctx.biteEatBlend > 0.1);
    this.offhandIKBlend = THREE.MathUtils.lerp(
      this.offhandIKBlend,
      useLeftItemGrip ||
        ctx.cuppedDrinkBlend > 0.05 ||
        bandage > 0.05 ||
        mapLook > 0.05 ||
        ctx.swimBlend > 0.15 ||
        ctx.pickupProgress >= 0 ||
        brace > 0.03 ||
        flail > 0.03
        ? 1
        : 0,
      Math.min(1, dt * IK_SWAY_TUNING.IK_TARGET_BLEND_SPEED)
    );

    if (this.boneL.upper && this.boneL.mid && this.boneL.hand) {
      if (useLeftItemGrip && this.offhandIKBlend > 0.05) {
        this.activeGripL!.getWorldPosition(_targetL);
        this.activeGripL!.getWorldQuaternion(_quatL);
        _poleWorld
          .set(...IK_SWAY_TUNING.ELBOW_POLE_L)
          .applyMatrix4(this.root.matrixWorld);
        solveTwoBoneIK(
          this.boneL.upper,
          this.boneL.mid,
          this.boneL.hand,
          _targetL,
          _poleWorld,
          this.boneL.restL1,
          this.boneL.restL2,
          _quatL,
          this.offhandIKBlend * 0.9
        );
        this.applyFingerCurl(
          this.boneL,
          this.currentSpec.twoHanded ? 'twoHanded' : 'cupped',
          this.offhandIKBlend
        );
      } else if (
        ctx.cuppedDrinkBlend > 0.02 ||
        bandage > 0.02 ||
        mapLook > 0.02 ||
        ctx.swimBlend > 0.15 ||
        ctx.pickupProgress >= 0 ||
        brace > 0.03 ||
        flail > 0.03
      ) {
        const reachArc =
          ctx.pickupProgress >= 0 ? Math.sin(ctx.pickupProgress * Math.PI) : 0;
        const cupArc = ctx.cuppedDrinkBlend;
        const swim = ctx.swimBlend;
        const swimAng = ctx.swimStrokePhase ?? ctx.elapsedSec * 5.2;
        const swimOutX = swim > 0.15 ? -Math.max(0, Math.sin(swimAng)) * 0.18 * swim : 0;
        const swimPushZ = swim > 0.15 ? -Math.cos(swimAng) * 0.17 * swim : 0;
        _tmpVecA.set(
          -0.14 +
            cupArc * 0.08 +
            bandage * 0.07 +
            mapLook * 0.02 +
            reachArc * 0.12 +
            swimOutX -
            flail * 0.09,
          -0.25 +
            cupArc * 0.13 +
            bandage * 0.04 +
            mapLook * 0.10 -
            flail * flailAng * 0.12 -
            brace * 0.08 -
            exhausted * 0.03 -
            (ctx.pickupReach === 'ground' ? reachArc * 0.16 : reachArc * 0.03),
          -0.40 -
            reachArc * 0.22 -
            brace * 0.18 +
            cupArc * 0.12 +
            bandage * 0.08 +
            mapLook * 0.06 +
            swimPushZ
        );
        _tmpVecA.applyMatrix4(this.root.matrixWorld);
        _poleWorld
          .set(...IK_SWAY_TUNING.ELBOW_POLE_L)
          .applyMatrix4(this.root.matrixWorld);
        solveTwoBoneIK(
          this.boneL.upper,
          this.boneL.mid,
          this.boneL.hand,
          _tmpVecA,
          _poleWorld,
          this.boneL.restL1,
          this.boneL.restL2,
          null,
          0
        );
        this.applyFingerCurl(
          this.boneL,
          cupArc > 0.2 ? 'cupped' : mapLook > 0.2 ? 'pinch' : reachArc > 0.35 ? 'power' : 'relaxed',
          Math.max(0.5, Math.max(cupArc, reachArc, mapLook))
        );
      } else {
        // Organic idle / sprint / walk offhand arm counter-balance with camera inertia
        this.boneL.hand.rotation.x += this.swayY * 1.1;
        this.boneL.hand.rotation.y += this.swayX * 1.1;
        this.applyFingerCurl(this.boneL, 'relaxed', 0.65);
      }
    }

    // Silence unused lint helper if needed
    void _eulerScratch;
  }

  public dispose(): void {
    this.mixer.stopAllAction();
    this.itemCache.clear();
    this.mapPaperMesh.geometry.dispose();
    const mapMat = this.mapPaperMesh.material as THREE.MeshStandardMaterial;
    mapMat.map?.dispose();
    mapMat.dispose();
  }
}
