// Articulated 3D wildlife models and procedural walk/trot/slither/charge animations.

import * as THREE from 'three';
import { WORLD } from '../survival/config.ts';
import type { WildlifeEntity, WildlifeKind } from '../survival/types.ts';
import { WILDLIFE_SPECS } from '../survival/wildlife.ts';

export interface WildlifeMeshRecord {
  entity: WildlifeEntity;
  group: THREE.Group;
  legs: THREE.Group[];
  head?: THREE.Group;
  segments?: THREE.Group[];
  claws?: THREE.Group[];
  hitFlashTimer: number;
  lastHp: number;
}

function buildCrabMesh(): Omit<WildlifeMeshRecord, 'entity' | 'hitFlashTimer' | 'lastHp'> {
  const group = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.55 });
  const clawMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 });

  const carapace = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.16, 8), shellMat);
  carapace.position.y = 0.18;
  carapace.scale.set(1.25, 1.0, 0.9);
  group.add(carapace);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), darkMat);
    eye.position.set(side * 0.14, 0.28, 0.25);
    group.add(eye);
  }

  const claws: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.34, 0.18, 0.24);
    const pincer = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.22), clawMat);
    pincer.position.set(side * 0.08, 0.04, 0.14);
    arm.add(pincer);
    group.add(arm);
    claws.push(arm);
  }

  const legs: THREE.Group[] = [];
  for (let row = 0; row < 3; row++) {
    for (const side of [-1, 1]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.36, 0.16, (row - 1) * 0.14);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), shellMat);
      legMesh.position.set(side * 0.12, -0.06, 0);
      legMesh.rotation.z = side * -0.45;
      legPivot.add(legMesh);
      group.add(legPivot);
      legs.push(legPivot);
    }
  }

  return { group, legs, claws };
}

function buildBoarMesh(): Omit<WildlifeMeshRecord, 'entity' | 'hitFlashTimer' | 'lastHp'> {
  const group = new THREE.Group();
  const hideMat = new THREE.MeshStandardMaterial({ color: 0x3f2e25, roughness: 0.92, flatShading: true });
  const crestMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 });
  const tuskMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 });
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0x7c4f44, roughness: 0.85 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.66, 1.24), hideMat);
  body.position.set(0, 0.62, 0);
  group.add(body);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 1.05), crestMat);
  spine.position.set(0, 0.98, -0.05);
  group.add(spine);

  const head = new THREE.Group();
  head.position.set(0, 0.68, 0.66);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.48, 0.5), hideMat);
  head.add(skull);

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.24, 7), snoutMat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.05, 0.34);
  head.add(snout);

  for (const side of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 5), tuskMat);
    tusk.position.set(side * 0.14, -0.02, 0.36);
    tusk.rotation.set(0.4, 0, -side * 0.45);
    head.add(tusk);
  }
  group.add(head);

  const legs: THREE.Group[] = [];
  const legOffsets: Array<[number, number]> = [
    [-0.25, 0.42],
    [0.25, 0.42],
    [-0.25, -0.42],
    [0.25, -0.42],
  ];
  for (const [lx, lz] of legOffsets) {
    const legPivot = new THREE.Group();
    legPivot.position.set(lx, 0.42, lz);
    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), crestMat);
    legMesh.position.y = -0.2;
    legPivot.add(legMesh);
    group.add(legPivot);
    legs.push(legPivot);
  }

  return { group, legs, head };
}

function buildViperMesh(): Omit<WildlifeMeshRecord, 'entity' | 'hitFlashTimer' | 'lastHp'> {
  const group = new THREE.Group();
  const scaleMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.72 });
  const patternMat = new THREE.MeshStandardMaterial({ color: 0x1a2e05, roughness: 0.8 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.4,
  });

  const head = new THREE.Group();
  head.position.set(0, 0.12, 0.42);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.26), patternMat);
  head.add(skull);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 5, 5), eyeMat);
    eye.position.set(side * 0.08, 0.03, 0.06);
    head.add(eye);
  }
  group.add(head);

  const segments: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const segGroup = new THREE.Group();
    const radius = 0.095 - i * 0.011;
    const segMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.9, radius, 0.28, 6),
      i % 2 === 0 ? scaleMat : patternMat
    );
    segMesh.rotation.x = Math.PI / 2;
    segGroup.add(segMesh);
    segGroup.position.set(0, 0.09, 0.2 - i * 0.23);
    group.add(segGroup);
    segments.push(segGroup);
  }

  return { group, legs: [], head, segments };
}

function createMeshForKind(kind: WildlifeKind) {
  switch (kind) {
    case 'crab':
      return buildCrabMesh();
    case 'boar':
      return buildBoarMesh();
    case 'viper':
      return buildViperMesh();
  }
}

export class Wildlife3DManager {
  private scene: THREE.Scene;
  private records: Map<string, WildlifeMeshRecord> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public sync(entities: WildlifeEntity[], getHeight: (x: number, z: number) => number) {
    const seenIds = new Set<string>();

    for (const e of entities) {
      seenIds.add(e.id);
      let rec = this.records.get(e.id);
      if (!rec) {
        const built = createMeshForKind(e.kind);
        built.group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        built.group.position.set(e.x, Math.max(WORLD.WATER_LEVEL - 0.1, getHeight(e.x, e.z)), e.z);
        built.group.rotation.y = e.heading;
        this.scene.add(built.group);
        rec = {
          entity: e,
          ...built,
          hitFlashTimer: 0,
          lastHp: e.hp,
        };
        this.records.set(e.id, rec);
      }

      if (e.hp < rec.lastHp) {
        rec.hitFlashTimer = 0.25;
      }
      rec.lastHp = e.hp;
      rec.entity = e;
      rec.group.visible = e.behavior !== 'dead' && e.hp > 0;
    }

    for (const [id, rec] of this.records.entries()) {
      if (!seenIds.has(id)) {
        this.scene.remove(rec.group);
        this.records.delete(id);
      }
    }
  }

  public updateAnimations(delta: number, getHeight: (x: number, z: number) => number) {
    for (const rec of this.records.values()) {
      if (!rec.group.visible) continue;
      const e = rec.entity;

      const targetY = Math.max(WORLD.WATER_LEVEL - 0.08, getHeight(e.x, e.z));
      rec.group.position.x = THREE.MathUtils.damp(rec.group.position.x, e.x, 12, delta);
      rec.group.position.z = THREE.MathUtils.damp(rec.group.position.z, e.z, 12, delta);
      rec.group.position.y = THREE.MathUtils.damp(rec.group.position.y, targetY, 12, delta);

      // Smooth angular wrap for heading
      let diff = e.heading - rec.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rec.group.rotation.y += diff * Math.min(1, delta * 10);

      // Hit bounce feedback
      if (rec.hitFlashTimer > 0) {
        rec.hitFlashTimer = Math.max(0, rec.hitFlashTimer - delta);
        const pulse = 1 + Math.sin(rec.hitFlashTimer * Math.PI * 8) * 0.16;
        rec.group.scale.setScalar(pulse);
      } else {
        rec.group.scale.setScalar(1);
      }

      const p = e.animPhase;
      const movingFast = e.behavior === 'chase' || e.behavior === 'flee';
      const moving = e.behavior !== 'idle' || movingFast;

      if (e.kind === 'boar') {
        const stride = moving ? (movingFast ? 0.65 : 0.42) : 0;
        if (rec.legs.length === 4) {
          rec.legs[0].rotation.x = Math.sin(p) * stride;
          rec.legs[1].rotation.x = -Math.sin(p) * stride;
          rec.legs[2].rotation.x = -Math.sin(p) * stride;
          rec.legs[3].rotation.x = Math.sin(p) * stride;
        }
        if (rec.head) {
          rec.head.rotation.x =
            e.behavior === 'attack'
              ? Math.sin(p * 2.2) * 0.35 + 0.22
              : movingFast
                ? 0.2 + Math.sin(p * 2) * 0.12
                : Math.sin(p * 0.8) * 0.08;
        }
      } else if (e.kind === 'crab') {
        const scuttleAmp = moving ? 0.38 : 0.06;
        for (let i = 0; i < rec.legs.length; i++) {
          const phase = i % 2 === 0 ? p * 2.1 : p * 2.1 + Math.PI;
          rec.legs[i].rotation.y = Math.sin(phase) * scuttleAmp;
          rec.legs[i].rotation.z = Math.cos(phase) * scuttleAmp * 0.55;
        }
        if (rec.claws) {
          for (let i = 0; i < rec.claws.length; i++) {
            rec.claws[i].rotation.x = Math.sin(p * 1.4 + i) * 0.25 - 0.15;
          }
        }
      } else if (e.kind === 'viper' && rec.segments) {
        const amp = movingFast ? 0.18 : 0.11;
        for (let i = 0; i < rec.segments.length; i++) {
          const seg = rec.segments[i];
          const wave = Math.sin(p * 1.35 - i * 0.72);
          seg.position.x = wave * amp * (0.6 + i * 0.15);
          seg.rotation.y = Math.cos(p * 1.35 - i * 0.72) * 0.32;
        }
        if (rec.head) {
          rec.head.position.x = Math.sin(p * 1.35 + 0.5) * amp * 0.5;
          rec.head.position.y = e.behavior === 'attack' ? 0.24 : 0.12;
        }
      }
    }
  }

  public findHoveredCreature(
    playerPos: THREE.Vector3,
    camDir: THREE.Vector3,
    maxRange: number
  ): WildlifeEntity | null {
    let best: WildlifeEntity | null = null;
    let bestDist = maxRange;
    const toTarget = new THREE.Vector3();

    for (const rec of this.records.values()) {
      if (!rec.group.visible) continue;
      const e = rec.entity;
      const pos = rec.group.position;
      const d = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
      if (d <= bestDist) {
        const aimY = e.kind === 'boar' ? pos.y + 0.65 : pos.y + 0.25;
        toTarget.set(pos.x, aimY, pos.z).sub(playerPos).normalize();
        if (camDir.dot(toTarget) > 0.72) {
          bestDist = d;
          best = e;
        }
      }
    }

    return best;
  }

  public getLabel(kind: WildlifeKind): string {
    return WILDLIFE_SPECS[kind].name;
  }
}
