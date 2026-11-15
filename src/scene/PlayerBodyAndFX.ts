import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BODY_IK_TUNING } from '../survival/config.ts';
import { solveTwoBoneIK } from './FirstPersonIK.ts';

// ---------------------------------------------------------------------------
// 1. Fading Sand Footprint Trail (Single-Draw Instanced Decal Pool)
// ---------------------------------------------------------------------------

interface FootprintSlot {
  active: boolean;
  ageSec: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  isLeft: boolean;
  normal: THREE.Vector3;
}

function createBootPrintTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  // Outer boot silhouette (toe up, heel down)
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.48, 8, w * 0.5, h * 0.48, 110);
  grad.addColorStop(0, 'rgba(34, 24, 14, 0.85)');
  grad.addColorStop(0.68, 'rgba(42, 30, 18, 0.55)');
  grad.addColorStop(1, 'rgba(42, 30, 18, 0.0)');

  ctx.fillStyle = grad;
  // Forefoot pad
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.34, w * 0.30, h * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  // Heel block
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.74, w * 0.24, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal sole tread grooves
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  for (let y = 32; y < 220; y += 22) {
    if (y > 135 && y < 162) continue;
    ctx.fillRect(22, y, w - 44, 6);
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export class FootprintTrailSystem {
  public readonly mesh: THREE.InstancedMesh;
  private readonly slots: FootprintSlot[];
  private readonly alphaAttr: THREE.InstancedBufferAttribute;
  private readonly mat: THREE.MeshStandardMaterial;
  private readonly tex: THREE.CanvasTexture;
  private cursor = 0;

  private readonly tmpObj = new THREE.Object3D();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpUp = new THREE.Vector3(0, 1, 0);
  private readonly tmpAlign = new THREE.Quaternion();

  constructor(private readonly maxPrints: number = BODY_IK_TUNING.FOOTPRINT_POOL_SIZE) {
    const geom = new THREE.PlaneGeometry(0.16, 0.32);
    geom.rotateX(-Math.PI * 0.5);

    this.alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(maxPrints), 1);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('aAlpha', this.alphaAttr);

    this.tex = createBootPrintTexture();
    this.mat = new THREE.MeshStandardMaterial({
      map: this.tex,
      color: 0x5c4732,
      roughness: 0.96,
      metalness: 0.0,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aAlpha;\nvarying float vFpAlpha;'
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFpAlpha = aAlpha;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFpAlpha;')
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.a *= vFpAlpha;'
        );
    };

    this.mesh = new THREE.InstancedMesh(geom, this.mat, maxPrints);
    this.mesh.name = 'SandFootprints_Instanced';
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;

    this.slots = [];
    this.tmpObj.scale.set(0, 0, 0);
    this.tmpObj.updateMatrix();
    for (let i = 0; i < maxPrints; i++) {
      this.slots.push({
        active: false,
        ageSec: BODY_IK_TUNING.FOOTPRINT_FADE_SEC,
        x: 0,
        y: -50,
        z: 0,
        yaw: 0,
        isLeft: i % 2 === 0,
        normal: new THREE.Vector3(0, 1, 0),
      });
      this.mesh.setMatrixAt(i, this.tmpObj.matrix);
      this.alphaAttr.setX(i, 0);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  public stampFootprint(
    x: number,
    y: number,
    z: number,
    normal: THREE.Vector3,
    yaw: number,
    isLeft: boolean
  ): void {
    const slotIdx = this.cursor;
    const slot = this.slots[slotIdx];
    this.cursor = (this.cursor + 1) % this.maxPrints;
    slot.active = true;
    slot.ageSec = 0;
    slot.x = x;
    slot.y = y + 0.016;
    slot.z = z;
    slot.yaw = yaw;
    slot.isLeft = isLeft;
    slot.normal.copy(normal).normalize();
    this.writeSlotMatrix(slotIdx, slot, 0.72);
  }

  private writeSlotMatrix(index: number, slot: FootprintSlot, alpha: number): void {
    this.tmpAlign.setFromUnitVectors(this.tmpUp, slot.normal);
    this.tmpQuat.setFromAxisAngle(this.tmpUp, slot.yaw);
    this.tmpQuat.premultiply(this.tmpAlign);

    this.tmpObj.position.set(slot.x, slot.y, slot.z);
    this.tmpObj.quaternion.copy(this.tmpQuat);
    this.tmpObj.scale.set(slot.isLeft ? 1 : -1, 1, 1);
    this.tmpObj.updateMatrix();
    this.mesh.setMatrixAt(index, this.tmpObj.matrix);
    this.alphaAttr.setX(index, alpha);
  }

  public update(dt: number): void {
    let dirty = false;
    const maxAge = BODY_IK_TUNING.FOOTPRINT_FADE_SEC;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      s.ageSec += dt;
      if (s.ageSec >= maxAge) {
        s.active = false;
        this.alphaAttr.setX(i, 0);
        this.tmpObj.scale.set(0, 0, 0);
        this.tmpObj.updateMatrix();
        this.mesh.setMatrixAt(i, this.tmpObj.matrix);
      } else {
        const lifeT = s.ageSec / maxAge;
        const alpha = (1 - lifeT * lifeT) * 0.72;
        this.alphaAttr.setX(i, alpha);
      }
      dirty = true;
    }
    if (dirty) {
      this.alphaAttr.needsUpdate = true;
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}

// ---------------------------------------------------------------------------
// 2. Simplified GTA Euphoria-Style Limb Stiffness & Reaction Controller
// ---------------------------------------------------------------------------

export interface EuphoriaOutputs {
  torsoPitch: number;
  torsoRoll: number;
  cameraRollOffset: number;
  cameraPitchOffset: number;
  cameraDipOffset: number;
  fpArmBrace: number;
  fpArmFlail: number;
  flailAngle: number;
  isLimping: boolean;
  limpPhase: number;
  speedMultiplier: number;
}

export class EuphoriaPhysicsController {
  private torsoStiffness = 1.0;
  private armStiffness = 1.0;
  private legStiffness = 1.0;

  private stumblePitch = 0;
  private stumbleRoll = 0;
  private velPitch = 0;
  private velRoll = 0;

  private airborneSec = 0;
  private flailPhase = 0;
  private braceTimer = 0;
  private postFallLimpTimer = 0;
  private limpPhase = 0;

  public triggerHit(impulseDirSign: number = 1, strength: number = 1.0): void {
    this.torsoStiffness = BODY_IK_TUNING.EUPHORIA_HIT_STIFFNESS;
    this.legStiffness = BODY_IK_TUNING.EUPHORIA_HIT_STIFFNESS + 0.1;
    this.velPitch -= 2.8 * strength;
    this.velRoll += (impulseDirSign >= 0 ? 1 : -1) * 3.4 * strength;
  }

  public triggerLanding(dropHeightM: number, hurtByFall: boolean): void {
    if (dropHeightM >= BODY_IK_TUNING.EUPHORIA_LAND_BRACE_DIST_M) {
      this.braceTimer = 0.48;
      this.torsoStiffness = 0.36;
      this.armStiffness = 0.28;
      this.velPitch += Math.min(4.2, dropHeightM * 0.9);
    }
    if (hurtByFall) {
      this.postFallLimpTimer = BODY_IK_TUNING.LIMP_FALL_DURATION_SEC;
    }
  }

  public update(
    dt: number,
    isGrounded: boolean,
    verticalVel: number,
    horizontalSpeed: number,
    health: number
  ): EuphoriaOutputs {
    // Recover joint stiffness smoothly back toward 1.0
    const rec = Math.min(1, dt * BODY_IK_TUNING.EUPHORIA_RECOVERY_RATE);
    this.torsoStiffness = THREE.MathUtils.lerp(this.torsoStiffness, 1.0, rec);
    this.armStiffness = THREE.MathUtils.lerp(this.armStiffness, 1.0, rec);
    this.legStiffness = THREE.MathUtils.lerp(this.legStiffness, 1.0, rec);

    // Airborne free-fall detection -> slight windmilling flail
    if (!isGrounded) {
      this.airborneSec += dt;
      if (this.airborneSec > 0.28 && verticalVel < -3.0) {
        this.armStiffness = Math.min(this.armStiffness, BODY_IK_TUNING.EUPHORIA_FALL_FLAIL_STIFFNESS);
        this.flailPhase += dt * 11.5;
      }
    } else {
      this.airborneSec = 0;
    }

    if (this.braceTimer > 0) this.braceTimer = Math.max(0, this.braceTimer - dt);
    if (this.postFallLimpTimer > 0) {
      this.postFallLimpTimer = Math.max(0, this.postFallLimpTimer - dt);
    }

    // Spring-damper stagger recovery modulated by stiffness
    const k = 38.0 * (0.2 + this.torsoStiffness * 0.8);
    const d = 9.5;
    this.velPitch += (-this.stumblePitch * k - this.velPitch * d) * dt;
    this.velRoll += (-this.stumbleRoll * k - this.velRoll * d) * dt;
    this.stumblePitch = THREE.MathUtils.clamp(this.stumblePitch + this.velPitch * dt, -0.45, 0.45);
    this.stumbleRoll = THREE.MathUtils.clamp(this.stumbleRoll + this.velRoll * dt, -0.45, 0.45);

    const isLimping =
      health < BODY_IK_TUNING.LIMP_HEALTH_THRESHOLD || this.postFallLimpTimer > 0;
    if (isLimping && horizontalSpeed > 0.35 && isGrounded) {
      this.limpPhase += dt * 5.2;
    }

    const limpSin = Math.max(0, Math.sin(this.limpPhase));
    const limpDip = isLimping ? limpSin * BODY_IK_TUNING.LIMP_DIP_AMPLITUDE : 0;
    const limpRoll = isLimping ? Math.sin(this.limpPhase) * BODY_IK_TUNING.LIMP_ROLL_RAD : 0;

    const fpArmFlail = !isGrounded && this.airborneSec > 0.28 && verticalVel < -3.0
      ? Math.min(1, (1 - this.armStiffness) * 1.4)
      : 0;
    const fpArmBrace = this.braceTimer > 0 ? Math.sin((this.braceTimer / 0.48) * Math.PI) : 0;

    return {
      torsoPitch: this.stumblePitch + fpArmBrace * 0.22,
      torsoRoll: this.stumbleRoll + limpRoll,
      cameraRollOffset: this.stumbleRoll * 0.28 + limpRoll * 0.55,
      cameraPitchOffset: this.stumblePitch * 0.22 + fpArmBrace * 0.08,
      cameraDipOffset: limpDip + fpArmBrace * 0.06,
      fpArmBrace,
      fpArmFlail,
      flailAngle: Math.sin(this.flailPhase),
      isLimping,
      limpPhase: this.limpPhase,
      speedMultiplier: isLimping ? BODY_IK_TUNING.LIMP_SPEED_MULT : 1.0,
    };
  }
}

// ---------------------------------------------------------------------------
// 3. Full Player Body Controller with Downward Foot IK & Sand Footprints
// ---------------------------------------------------------------------------

export interface BodyUpdateContext {
  dt: number;
  playerX: number;
  playerFootY: number;
  playerZ: number;
  yaw: number;
  turnDeltaYaw: number;
  moveBlend: number;
  sprintBlend: number;
  strafeInput: number; // -1..+1
  isGrounded: boolean;
  isSwimming: boolean;
  crouchBlend: number; // 0..1 (from Part 3 too)
  proneBlend: number;  // 0..1 (from Part 3 too)
  sitBlend: number;    // 0..1 (from Part 3 too)
  sleepBlend: number;  // 0..1 (from Part 3 too)
  walkTimer: number;
  euphoria: EuphoriaOutputs;
  sampleTerrainHeight: (x: number, z: number) => number;
  footRayTargets: THREE.Object3D[];
}

interface FootState {
  plantY: number;
  normal: THREE.Vector3;
  prevCycleSin: number;
  planted: boolean;
}

const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3(0, -1, 0);
const _upVec = new THREE.Vector3(0, 1, 0);
const _slopeQ = new THREE.Quaternion();
const _footQ = new THREE.Quaternion();
const _targetFootL = new THREE.Vector3();
const _targetFootR = new THREE.Vector3();
const _poleL = new THREE.Vector3();
const _poleR = new THREE.Vector3();
const _normL = new THREE.Vector3(0, 1, 0);
const _normR = new THREE.Vector3(0, 1, 0);
const _nTmp = new THREE.Vector3();
const _invParentQ = new THREE.Quaternion();
const _rayHits: THREE.Intersection[] = [];

export class PlayerFullBodyController {
  public readonly group: THREE.Group;
  private readonly model: THREE.Group;
  private readonly raycaster = new THREE.Raycaster();

  private readonly hips: THREE.Bone | null;
  private readonly spine: THREE.Bone | null;
  private readonly chest: THREE.Bone | null;
  private readonly thighL: THREE.Bone | null;
  private readonly shinL: THREE.Bone | null;
  private readonly footL: THREE.Bone | null;
  private readonly thighR: THREE.Bone | null;
  private readonly shinR: THREE.Bone | null;
  private readonly footR: THREE.Bone | null;

  private readonly restHipsPos = new THREE.Vector3();
  private readonly restSpineQ = new THREE.Quaternion();
  private readonly restChestQ = new THREE.Quaternion();
  private readonly restFootLQ = new THREE.Quaternion();
  private readonly restFootRQ = new THREE.Quaternion();
  private readonly restThighLen: number;
  private readonly restShinLen: number;

  private smoothHipDrop = 0;
  private smoothLeanTurn = 0;
  private smoothSlopePitch = 0;
  private lastFootprintDist = 0;
  private prevPlayerX = 0;
  private prevPlayerZ = 0;
  private clothMaterials: Array<{ mat: THREE.MeshStandardMaterial; baseColor: THREE.Color; baseRoughness: number }> = [];
  private shadowHeadMaterials: THREE.Material[] = [];
  private lastBodyWet = -1;
  private lastBodyGrime = -1;

  private footStateL: FootState = {
    plantY: 0,
    normal: new THREE.Vector3(0, 1, 0),
    prevCycleSin: 0,
    planted: true,
  };
  private footStateR: FootState = {
    plantY: 0,
    normal: new THREE.Vector3(0, 1, 0),
    prevCycleSin: 0,
    planted: true,
  };

  constructor(
    playerBodyTemplate: THREE.Group,
    private readonly footprints: FootprintTrailSystem
  ) {
    this.group = new THREE.Group();
    this.group.name = 'Player_FullBody_Root';

    this.model = SkeletonUtils.clone(playerBodyTemplate) as THREE.Group;
    this.model.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;

      if (m.name.toLowerCase().includes('shadowhead')) {
        // Invisible to camera while casting real human head shadow
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.colorWrite = false;
          mat.depthWrite = false;
          mat.needsUpdate = true;
          this.shadowHeadMaterials.push(mat);
        }
      } else {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const cloned = mats.map((mat) => {
          const std = mat as THREE.MeshStandardMaterial;
          if (!std || !std.isMeshStandardMaterial) return mat;
          const copy = std.clone();
          this.clothMaterials.push({
            mat: copy,
            baseColor: copy.color.clone(),
            baseRoughness: copy.roughness,
          });
          return copy;
        });
        m.material = Array.isArray(m.material) ? cloned : cloned[0];
      }
    });
    this.group.add(this.model);

    const getB = (n: string) =>
      ((this.model.getObjectByName(n) ??
        this.model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n))) as
        | THREE.Bone
        | undefined) ?? null;
    this.hips = getB('hips');
    this.spine = getB('spine');
    this.chest = getB('chest');
    this.thighL = getB('thigh.L');
    this.shinL = getB('shin.L');
    this.footL = getB('foot.L');
    this.thighR = getB('thigh.R');
    this.shinR = getB('shin.R');
    this.footR = getB('foot.R');

    this.model.updateMatrixWorld(true);
    if (this.hips) this.restHipsPos.copy(this.hips.position);
    if (this.spine) this.restSpineQ.copy(this.spine.quaternion);
    if (this.chest) this.restChestQ.copy(this.chest.quaternion);
    if (this.footL) this.restFootLQ.copy(this.footL.quaternion);
    if (this.footR) this.restFootRQ.copy(this.footR.quaternion);

    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    if (this.thighL && this.shinL && this.footL) {
      this.thighL.getWorldPosition(p0);
      this.shinL.getWorldPosition(p1);
      this.footL.getWorldPosition(p2);
      this.restThighLen = Math.max(0.32, p0.distanceTo(p1));
      this.restShinLen = Math.max(0.32, p1.distanceTo(p2));
    } else {
      this.restThighLen = 0.41;
      this.restShinLen = 0.41;
    }
  }

  /**
   * Probes floor elevation and surface normal directly under `(wx, wz)`.
   * Uses analytic terrain sample + raycasts against nearby walkable props/rocks/wreckage.
   */
  private sampleFootSurface(
    wx: number,
    wz: number,
    refY: number,
    outNormal: THREE.Vector3,
    ctx: BodyUpdateContext
  ): number {
    const hCenter = ctx.sampleTerrainHeight(wx, wz);
    const eps = 0.16;
    const hx = ctx.sampleTerrainHeight(wx + eps, wz);
    const hz = ctx.sampleTerrainHeight(wx, wz + eps);
    outNormal.set(hCenter - hx, eps, hCenter - hz).normalize();
    let bestY = hCenter;

    if (ctx.footRayTargets.length > 0 && ctx.proneBlend < 0.5 && ctx.sleepBlend < 0.5) {
      _rayOrigin.set(wx, refY + BODY_IK_TUNING.FOOT_RAY_HEIGHT_ABOVE, wz);
      this.raycaster.set(_rayOrigin, _rayDir);
      this.raycaster.near = 0.05;
      this.raycaster.far = BODY_IK_TUNING.FOOT_RAY_MAX_DIST;
      _rayHits.length = 0;
      for (let i = 0; i < ctx.footRayTargets.length; i++) {
        const obj = ctx.footRayTargets[i];
        // Quick 2D distance cull before invoking triangle intersect (crash wreckage is centered near origin within ~45m)
        const dx = obj.position.x - wx;
        const dz = obj.position.z - wz;
        const maxDistSq = obj.name === 'crash_site_group' ? 2025 : 1600;
        if (dx * dx + dz * dz > maxDistSq) continue;
        this.raycaster.intersectObject(obj, true, _rayHits);
      }
      for (let i = 0; i < _rayHits.length; i++) {
        const hit = _rayHits[i];
        if (
          hit.point.y > bestY &&
          hit.point.y <= refY + 0.52 &&
          hit.face &&
          hit.face.normal
        ) {
          _nTmp
            .copy(hit.face.normal)
            .transformDirection(hit.object.matrixWorld)
            .normalize();
          if (_nTmp.y > 0.45) {
            bestY = hit.point.y;
            outNormal.copy(_nTmp);
          }
        }
      }
    }
    return bestY;
  }

  public update(ctx: BodyUpdateContext): void {
    const dt = Math.min(0.05, Math.max(0.001, ctx.dt));
    const sinYaw = Math.sin(ctx.yaw);
    const cosYaw = Math.cos(ctx.yaw);

    // Offset full body slightly behind camera origin so looking straight down frames chest -> boots cleanly
    const backDist =
      BODY_IK_TUNING.BODY_BACK_OFFSET_M * (1 - ctx.proneBlend * 0.7 - ctx.sleepBlend * 0.7);
    const rootX = ctx.playerX + sinYaw * backDist;
    const rootZ = ctx.playerZ + cosYaw * backDist;

    this.group.position.set(rootX, ctx.playerFootY, rootZ);
    this.group.rotation.order = 'YXZ';
    this.group.rotation.y = ctx.yaw;

    // When prone or sleeping, lie horizontally cleanly
    const horizontalTilt = Math.max(ctx.proneBlend, ctx.sleepBlend);
    this.group.rotation.x = horizontalTilt * (Math.PI * 0.47);
    this.group.position.y += horizontalTilt * 0.14;

    // Probe left & right foot ground heights in world space
    const rightX = cosYaw;
    const rightZ = -sinYaw;
    const hipHalfW = 0.105;

    const gaitFreq = ctx.walkTimer;
    const stepAmp =
      BODY_IK_TUNING.FOOT_STRIDE_LENGTH *
      ctx.moveBlend *
      (1 + ctx.sprintBlend * 0.45) *
      (ctx.isSwimming ? 0.35 : 1) *
      (1 - horizontalTilt * 0.7) *
      (ctx.euphoria.isLimping ? 0.72 : 1.0);

    const strideL = Math.sin(gaitFreq) * stepAmp;
    const strideR = Math.sin(gaitFreq + Math.PI) * stepAmp;
    const liftL =
      Math.max(0, Math.cos(gaitFreq)) *
      BODY_IK_TUNING.FOOT_STRIDE_LIFT *
      ctx.moveBlend *
      (ctx.euphoria.isLimping ? 0.65 : 1.0);
    const liftR =
      Math.max(0, Math.cos(gaitFreq + Math.PI)) * BODY_IK_TUNING.FOOT_STRIDE_LIFT * ctx.moveBlend;

    // Forward direction vector in XZ is (-sinYaw, -cosYaw)
    const fwdX = -sinYaw;
    const fwdZ = -cosYaw;

    const footWxL = rootX - rightX * hipHalfW + fwdX * strideL;
    const footWzL = rootZ - rightZ * hipHalfW + fwdZ * strideL;
    const footWxR = rootX + rightX * hipHalfW + fwdX * strideR;
    const footWzR = rootZ + rightZ * hipHalfW + fwdZ * strideR;

    const surfYL = this.sampleFootSurface(footWxL, footWzL, ctx.playerFootY, _normL, ctx);
    const surfYR = this.sampleFootSurface(footWxR, footWzR, ctx.playerFootY, _normR, ctx);

    this.footStateL.plantY = THREE.MathUtils.lerp(
      this.footStateL.plantY || surfYL,
      surfYL,
      Math.min(1, dt * BODY_IK_TUNING.FOOT_PLANT_SMOOTH_SPEED)
    );
    this.footStateR.plantY = THREE.MathUtils.lerp(
      this.footStateR.plantY || surfYR,
      surfYR,
      Math.min(1, dt * BODY_IK_TUNING.FOOT_PLANT_SMOOTH_SPEED)
    );
    this.footStateL.normal.lerp(_normL, Math.min(1, dt * 14)).normalize();
    this.footStateR.normal.lerp(_normR, Math.min(1, dt * 14)).normalize();

    // Lower hips subtly when standing across uneven ground so both feet reach without stretching
    const heightDiff = Math.abs(this.footStateL.plantY - this.footStateR.plantY);
    const lowestFootOffset = Math.min(
      0,
      Math.min(this.footStateL.plantY, this.footStateR.plantY) - ctx.playerFootY
    );
    const targetHipDrop = Math.min(
      BODY_IK_TUNING.MAX_HIP_DROP_M,
      Math.max(0, heightDiff * BODY_IK_TUNING.HIP_DROP_SLOPE_FACTOR - lowestFootOffset) +
        ctx.crouchBlend * 0.42 +
        ctx.sitBlend * 0.56
    );
    this.smoothHipDrop = THREE.MathUtils.lerp(
      this.smoothHipDrop,
      targetHipDrop,
      Math.min(1, dt * BODY_IK_TUNING.HIP_SMOOTH_SPEED)
    );

    if (this.hips) {
      this.hips.position.set(
        this.restHipsPos.x,
        this.restHipsPos.y - this.smoothHipDrop - ctx.euphoria.cameraDipOffset * 0.5,
        this.restHipsPos.z
      );
      this.hips.updateMatrixWorld(true);
    }

    // Body lean into turns, strafing, terrain slopes, limp, and Euphoria stumbles
    const turnLeanTarget = THREE.MathUtils.clamp(
      -ctx.turnDeltaYaw * BODY_IK_TUNING.LEAN_TURN_SCALE * 10 -
        ctx.strafeInput * BODY_IK_TUNING.LEAN_STRAFE_SCALE,
      -0.28,
      0.28
    );
    this.smoothLeanTurn = THREE.MathUtils.lerp(this.smoothLeanTurn, turnLeanTarget, Math.min(1, dt * 10));

    const aheadH = ctx.sampleTerrainHeight(ctx.playerX + fwdX * 0.65, ctx.playerZ + fwdZ * 0.65);
    const slopePitchTarget = THREE.MathUtils.clamp(
      (aheadH - ctx.playerFootY) * BODY_IK_TUNING.LEAN_SLOPE_SCALE +
        ctx.sprintBlend * 0.14 -
        ctx.sitBlend * 0.25,
      -0.25,
      0.32
    );
    this.smoothSlopePitch = THREE.MathUtils.lerp(
      this.smoothSlopePitch,
      slopePitchTarget,
      Math.min(1, dt * 9)
    );

    if (this.spine) {
      this.spine.quaternion.copy(this.restSpineQ);
      this.spine.rotation.x += this.smoothSlopePitch + ctx.euphoria.torsoPitch * 0.65;
      this.spine.rotation.z += this.smoothLeanTurn + ctx.euphoria.torsoRoll * 0.65;
    }
    if (this.chest) {
      this.chest.quaternion.copy(this.restChestQ);
      this.chest.rotation.x += ctx.euphoria.torsoPitch * 0.45 + ctx.crouchBlend * 0.14;
      this.chest.rotation.z += this.smoothLeanTurn * 0.45 + ctx.euphoria.torsoRoll * 0.45;
    }

    this.group.updateMatrixWorld(true);

    // Run Two-Bone IK for Left & Right legs when upright/crouching/sitting
    if (horizontalTilt < 0.55) {
      if (this.thighL && this.shinL && this.footL) {
        const sitFwd = ctx.sitBlend * 0.38;
        const sitUp = ctx.sitBlend * 0.18;
        _targetFootL.set(
          footWxL + fwdX * sitFwd,
          (ctx.isGrounded ? this.footStateL.plantY : ctx.playerFootY) + 0.085 + liftL + sitUp,
          footWzL + fwdZ * sitFwd
        );
        _poleL.set(rootX - rightX * 0.14 + fwdX * 0.65, ctx.playerFootY + 0.55, rootZ - rightZ * 0.14 + fwdZ * 0.65);
        solveTwoBoneIK(
          this.thighL,
          this.shinL,
          this.footL,
          _targetFootL,
          _poleL,
          this.restThighLen,
          this.restShinLen,
          null,
          0,
          1.03
        );
        // Align ankle quaternion to ground surface normal + player yaw
        _slopeQ.setFromUnitVectors(_upVec, this.footStateL.normal);
        _footQ.setFromAxisAngle(_upVec, ctx.yaw);
        _footQ.premultiply(_slopeQ);
        if (this.footL.parent) {
          this.footL.parent.getWorldQuaternion(_invParentQ).invert();
          this.footL.quaternion.multiplyQuaternions(_invParentQ, _footQ);
          this.footL.quaternion.slerp(this.restFootLQ, 0.25);
        }
      }

      if (this.thighR && this.shinR && this.footR) {
        const sitFwd = ctx.sitBlend * 0.36;
        const sitUp = ctx.sitBlend * 0.18;
        _targetFootR.set(
          footWxR + fwdX * sitFwd,
          (ctx.isGrounded ? this.footStateR.plantY : ctx.playerFootY) + 0.085 + liftR + sitUp,
          footWzR + fwdZ * sitFwd
        );
        _poleR.set(rootX + rightX * 0.14 + fwdX * 0.65, ctx.playerFootY + 0.55, rootZ + rightZ * 0.14 + fwdZ * 0.65);
        solveTwoBoneIK(
          this.thighR,
          this.shinR,
          this.footR,
          _targetFootR,
          _poleR,
          this.restThighLen,
          this.restShinLen,
          null,
          0,
          1.03
        );
        _slopeQ.setFromUnitVectors(_upVec, this.footStateR.normal);
        _footQ.setFromAxisAngle(_upVec, ctx.yaw);
        _footQ.premultiply(_slopeQ);
        if (this.footR.parent) {
          this.footR.parent.getWorldQuaternion(_invParentQ).invert();
          this.footR.quaternion.multiplyQuaternions(_invParentQ, _footQ);
          this.footR.quaternion.slerp(this.restFootRQ, 0.25);
        }
      }
    }

    // Stamp fading footprints onto sand when grounded & striding across sand zone
    const stepDx = ctx.playerX - this.prevPlayerX;
    const stepDz = ctx.playerZ - this.prevPlayerZ;
    this.lastFootprintDist += Math.hypot(stepDx, stepDz);
    this.prevPlayerX = ctx.playerX;
    this.prevPlayerZ = ctx.playerZ;

    if (
      ctx.isGrounded &&
      !ctx.isSwimming &&
      horizontalTilt < 0.3 &&
      ctx.sitBlend < 0.3 &&
      this.lastFootprintDist >= BODY_IK_TUNING.FOOTPRINT_STEP_INTERVAL_DIST
    ) {
      this.lastFootprintDist = 0;
      const isLeftStep = Math.sin(gaitFreq) >= 0;
      const fx = isLeftStep ? footWxL : footWxR;
      const fz = isLeftStep ? footWzL : footWzR;
      const fy = isLeftStep ? this.footStateL.plantY : this.footStateR.plantY;
      const fn = isLeftStep ? this.footStateL.normal : this.footStateR.normal;
      if (fy > -0.05 && fy <= BODY_IK_TUNING.FOOTPRINT_SAND_MAX_Y) {
        this.footprints.stampFootprint(fx, fy, fz, fn, ctx.yaw, isLeftStep);
      }
    }
  }

  public setWetAndGrime(wet01: number, grime01: number): void {
    if (Math.abs(wet01 - this.lastBodyWet) < 0.04 && Math.abs(grime01 - this.lastBodyGrime) < 0.04) {
      return;
    }
    this.lastBodyWet = wet01;
    this.lastBodyGrime = grime01;
    for (const item of this.clothMaterials) {
      item.mat.roughness = THREE.MathUtils.clamp(item.baseRoughness - wet01 * 0.34, 0.18, 0.96);
      const darken = 1.0 - wet01 * 0.22 - grime01 * 0.18;
      item.mat.color.setRGB(
        item.baseColor.r * darken,
        item.baseColor.g * (darken - grime01 * 0.03),
        item.baseColor.b * (darken - grime01 * 0.05)
      );
    }
  }

  public setShowHeadForPhotoMode(visible: boolean): void {
    for (const mat of this.shadowHeadMaterials) {
      if (mat.colorWrite !== visible) {
        mat.colorWrite = visible;
        mat.depthWrite = visible;
        mat.needsUpdate = true;
      }
    }
  }

  public dispose(): void {
    for (const item of this.clothMaterials) {
      item.mat.dispose();
    }
    this.clothMaterials = [];
  }
}
