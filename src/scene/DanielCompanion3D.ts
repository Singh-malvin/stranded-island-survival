/**
 * 3D Rigged Companion Controller for Daniel (Cave Survivor).
 * - Clones `daniel.glb` with full Armature & 9 Blender NLA clips
 *   (`idle`, `walk`, `run`, `gather`, `build`, `attack`, `downed`, `wave`, `helm`)
 * - Syncs position, terrain height, boat helm stance, downed beacon & hover raycast.
 */

import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { SurvivalState } from '../survival/types.ts';
import { VOYAGE_STAGE_ORIGIN } from './BoatAndVoyage3D.ts';
import type { LoadedGLBSet } from './GLBModelBank.ts';

export type DanielClipName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'gather'
  | 'build'
  | 'attack'
  | 'downed'
  | 'wave'
  | 'helm';

const _tmpOrigin = new THREE.Vector3();
const _tmpTo = new THREE.Vector3();
const _tmpCenter = new THREE.Vector3();

export class DanielCompanion3D {
  public readonly root: THREE.Group;
  private readonly mixer: THREE.AnimationMixer;
  private readonly clips = new Map<DanielClipName, THREE.AnimationAction>();
  private activeClip: DanielClipName = 'idle';

  private readonly beaconMesh: THREE.Mesh;
  private readonly caveLantern: THREE.PointLight;
  private readonly pos = new THREE.Vector3();
  private readonly prevPos = new THREE.Vector3();
  private initializedPos = false;
  private currentYaw = 0;

  constructor(scene: THREE.Scene, glbs: LoadedGLBSet) {
    this.root = SkeletonUtils.clone(glbs.companion.daniel) as THREE.Group;
    this.root.name = 'Companion_Daniel_3D';
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    });

    // Subtle status beacon overhead (soft amber in cave before discovery, red-gold pulse when downed)
    this.beaconMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 0),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.beaconMesh.position.set(0, 2.08, 0);
    this.beaconMesh.visible = false;
    this.root.add(this.beaconMesh);

    // Faint warm lantern spill while Daniel waits injured inside the dark Basalt Cave
    this.caveLantern = new THREE.PointLight(0xf59e0b, 1.4, 9.5, 1.6);
    this.caveLantern.position.set(0.35, 0.9, 0.45);
    this.root.add(this.caveLantern);

    this.mixer = new THREE.AnimationMixer(this.root);
    for (const clip of glbs.companion.danielAnimations) {
      const action = this.mixer.clipAction(clip);
      this.clips.set(clip.name as DanielClipName, action);
    }
    this.playClip('idle', 0.05);
    scene.add(this.root);
  }

  private playClip(name: DanielClipName, fadeSec: number = 0.18) {
    const next = this.clips.get(name);
    if (!next) return;
    if (this.activeClip === name && next.isRunning()) return;
    const prev = this.clips.get(this.activeClip);
    next.reset();
    const loopOnce = name === 'downed';
    next.setLoop(loopOnce ? THREE.LoopOnce : THREE.LoopRepeat, loopOnce ? 1 : Infinity);
    next.clampWhenFinished = loopOnce;
    next.fadeIn(fadeSec);
    next.play();
    if (prev && prev !== next) {
      prev.fadeOut(fadeSec);
    }
    this.activeClip = name;
  }

  public getWorldPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.pos);
  }

  public update(
    dt: number,
    elapsedSec: number,
    state: SurvivalState,
    playerPos: THREE.Vector3,
    getTerrainHeight: (x: number, z: number) => number,
    boatBobY: number = 0
  ) {
    const d = state.companion;
    const isSailing = state.storyPhase === 'final_boat_chase' || state.voyage.phase === 'sailing';

    if (!d.found && state.storyPhase === 'escaped') {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;

    let targetX = d.x;
    let targetY = getTerrainHeight(d.x, d.z);
    let targetZ = d.z;
    let targetYaw = d.yaw;

    if (isSailing) {
      targetX = VOYAGE_STAGE_ORIGIN.x - 0.52;
      targetY = VOYAGE_STAGE_ORIGIN.y + 0.55 + boatBobY * 0.55;
      targetZ = VOYAGE_STAGE_ORIGIN.z - 1.55;
      targetYaw = 0; // Facing forward along boat deck (+Z)
    } else if (!d.found) {
      // Face faintly toward approaching player when they enter the cave threshold
      const dx = playerPos.x - d.x;
      const dz = playerPos.z - d.z;
      if (Math.hypot(dx, dz) < 18) {
        targetYaw = Math.atan2(dx, dz);
      }
    }

    if (!this.initializedPos) {
      this.pos.set(targetX, targetY, targetZ);
      this.prevPos.copy(this.pos);
      this.currentYaw = targetYaw;
      this.initializedPos = true;
    } else {
      this.prevPos.copy(this.pos);
      const blend = Math.min(1, dt * (isSailing ? 18 : 10));
      this.pos.x += (targetX - this.pos.x) * blend;
      this.pos.y += (targetY - this.pos.y) * blend;
      this.pos.z += (targetZ - this.pos.z) * blend;

      let yawDiff = targetYaw - this.currentYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      this.currentYaw += yawDiff * Math.min(1, dt * 9);
    }

    this.root.position.copy(this.pos);
    this.root.rotation.y = this.currentYaw;

    const speedMps = dt > 0.0001
      ? Math.hypot(this.pos.x - this.prevPos.x, this.pos.z - this.prevPos.z) / dt
      : 0;

    let clip: DanielClipName = 'idle';
    if (d.downed) {
      clip = 'downed';
    } else if (isSailing) {
      clip = 'helm';
    } else if (!d.found) {
      const distP = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
      clip = distP < 15 ? 'wave' : 'idle';
    } else if (speedMps > 4.6) {
      clip = 'run';
    } else if (speedMps > 0.45) {
      clip = 'walk';
    } else if (d.command === 'gather') {
      clip = 'gather';
    } else if (d.command === 'build') {
      clip = 'build';
    } else if (d.command === 'attack') {
      clip = 'attack';
    } else {
      clip = 'idle';
    }

    this.playClip(clip, 0.2);
    this.mixer.update(dt);

    // Downed / discovery status cues
    this.caveLantern.visible = !d.found;
    if (d.downed || !d.found) {
      this.beaconMesh.visible = true;
      (this.beaconMesh.material as THREE.MeshBasicMaterial).color.setHex(
        d.downed ? 0xef4444 : 0xf59e0b
      );
      this.beaconMesh.position.y = (d.downed ? 1.1 : 2.02) + Math.sin(elapsedSec * 3.8) * 0.08;
      this.beaconMesh.rotation.y = elapsedSec * 2.2;
    } else {
      this.beaconMesh.visible = false;
    }
  }

  public findHoveredDaniel(
    camOrigin: THREE.Vector3,
    camDir: THREE.Vector3,
    maxDist: number
  ): { pos: THREE.Vector3; dist: number } | null {
    if (!this.root.visible) return null;
    _tmpCenter.set(this.pos.x, this.pos.y + 1.05, this.pos.z);
    _tmpTo.copy(_tmpCenter).sub(camOrigin);
    const along = _tmpTo.dot(camDir);
    if (along < 0 || along > maxDist + 0.7) return null;
    _tmpOrigin.copy(camOrigin).addScaledVector(camDir, along);
    const perp = _tmpOrigin.distanceTo(_tmpCenter);
    if (perp > 0.85) return null;
    return { pos: this.pos.clone(), dist: along };
  }

  public dispose() {
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
