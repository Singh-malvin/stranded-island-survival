import * as THREE from 'three';
import { BASE_BUILDING } from '../survival/config.ts';
import type { PlacedStructure, StructureType } from '../survival/types.ts';

export interface StructureMeshRecord {
  data: PlacedStructure;
  group: THREE.Group;
  waterFillMesh?: THREE.Mesh;
  sproutGroup?: THREE.Group;
  readyCropGroup?: THREE.Group;
  trapReadyMesh?: THREE.Mesh;
  dryHangMesh?: THREE.Mesh;
  forgeLight?: THREE.PointLight;
}

export function buildStructureMesh(
  type: StructureType,
  isGhost: boolean = false
): Omit<StructureMeshRecord, 'data'> {
  const group = new THREE.Group();

  const makeMat = (color: number, roughness = 0.85, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    isGhost
      ? new THREE.MeshBasicMaterial({
          color: 0x34d399,
          transparent: true,
          opacity: 0.42,
          wireframe: roughness > 0.9,
        })
      : new THREE.MeshStandardMaterial({ color, roughness, flatShading: true, ...extra });

  const woodMat = makeMat(0x6b4c35, 0.88);
  const darkWoodMat = makeMat(0x452e1e, 0.9);
  const plankMat = makeMat(0x9a734b, 0.78);
  const stoneMat = makeMat(0x57534e, 0.92);
  const leafMat = makeMat(0x3f7034, 0.85);
  const ropeMat = makeMat(0xb69766, 0.9);

  const rec: Omit<StructureMeshRecord, 'data'> = { group };

  if (type === 'workbench') {
    const legGeo = new THREE.BoxGeometry(0.14, 0.85, 0.14);
    for (const lx of [-0.85, 0.85]) {
      for (const lz of [-0.42, 0.42]) {
        const leg = new THREE.Mesh(legGeo, darkWoodMat);
        leg.position.set(lx, 0.425, lz);
        group.add(leg);
      }
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.12, 1.1), plankMat);
    top.position.set(0, 0.88, 0);
    group.add(top);

    const vise = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.25), stoneMat);
    vise.position.set(-0.68, 1.02, 0.32);
    group.add(vise);

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.75), woodMat);
    shelf.position.set(0, 0.28, 0);
    group.add(shelf);
    return rec;
  }

  if (type === 'storage_chest') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.56, 0.72), plankMat);
    body.position.set(0, 0.3, 0);
    group.add(body);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.15, 8, 1, false, 0, Math.PI), woodMat);
    lid.rotation.z = Math.PI / 2;
    lid.position.set(0, 0.58, 0);
    group.add(lid);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 0.75), ropeMat);
    strap.position.set(0, 0.52, 0);
    group.add(strap);

    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.08), stoneMat);
    clasp.position.set(0, 0.54, 0.38);
    group.add(clasp);
    return rec;
  }

  if (type === 'water_collector') {
    for (const a of [0, 1.57, 3.14, 4.71]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.25, 6), woodMat);
      post.position.set(Math.cos(a) * 0.52, 0.62, Math.sin(a) * 0.52);
      group.add(post);
    }
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.52, 10), darkWoodMat);
    basin.position.set(0, 0.28, 0);
    group.add(basin);

    const funnel = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.55, 8, 1, true), leafMat);
    funnel.rotation.x = Math.PI;
    funnel.position.set(0, 1.15, 0);
    group.add(funnel);

    if (!isGhost) {
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        roughness: 0.15,
        metalness: 0.25,
      });
      const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 10), waterMat);
      fill.position.set(0, 0.35, 0);
      fill.visible = false;
      group.add(fill);
      rec.waterFillMesh = fill;
    }
    return rec;
  }

  if (type === 'farm_plot') {
    const frameW = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.22, 0.14), woodMat);
    frameW.position.set(0, 0.11, -0.98);
    group.add(frameW);
    const frameS = frameW.clone();
    frameS.position.z = 0.98;
    group.add(frameS);

    const frameE = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 1.84), woodMat);
    frameE.position.set(0.98, 0.11, 0);
    group.add(frameE);
    const frameWest = frameE.clone();
    frameWest.position.x = -0.98;
    group.add(frameWest);

    const soilMat = makeMat(0x3b2a1e, 0.96);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.16, 1.86), soilMat);
    soil.position.set(0, 0.08, 0);
    group.add(soil);

    if (!isGhost) {
      const sproutGroup = new THREE.Group();
      for (const sx of [-0.45, 0.45]) {
        for (const sz of [-0.45, 0.45]) {
          const bud = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 5), leafMat);
          bud.position.set(sx, 0.26, sz);
          sproutGroup.add(bud);
        }
      }
      sproutGroup.visible = false;
      group.add(sproutGroup);
      rec.sproutGroup = sproutGroup;

      const readyCropGroup = new THREE.Group();
      const berryMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
      for (const sx of [-0.45, 0.45]) {
        for (const sz of [-0.45, 0.45]) {
          const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), leafMat);
          bush.position.set(sx, 0.36, sz);
          readyCropGroup.add(bush);
          const berry = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), berryMat);
          berry.position.set(sx + 0.14, 0.48, sz + 0.14);
          readyCropGroup.add(berry);
        }
      }
      readyCropGroup.visible = false;
      group.add(readyCropGroup);
      rec.readyCropGroup = readyCropGroup;
    }
    return rec;
  }

  if (type === 'snare_trap') {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.05, 6), woodMat);
    post.position.set(-0.35, 0.5, 0);
    post.rotation.z = -0.32;
    group.add(post);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 12), ropeMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0.15, 0.05, 0);
    group.add(ring);

    if (!isGhost) {
      const catchMesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.22, 0),
        new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 })
      );
      catchMesh.position.set(0.15, 0.25, 0);
      catchMesh.visible = false;
      group.add(catchMesh);
      rec.trapReadyMesh = catchMesh;
    }
    return rec;
  }

  if (type === 'fish_trap') {
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.36, 1.15, 8, 1, true), ropeMat);
    cage.rotation.z = Math.PI / 2;
    cage.position.set(0, 0.25, 0);
    group.add(cage);

    const buoy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.42, 6),
      makeMat(0xd97706, 0.65)
    );
    buoy.position.set(0.42, 0.62, 0);
    group.add(buoy);

    if (!isGhost) {
      const readyFish = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.45,
          roughness: 0.3,
        })
      );
      readyFish.scale.set(1.5, 0.75, 0.75);
      readyFish.position.set(0, 0.32, 0);
      readyFish.visible = false;
      group.add(readyFish);
      rec.trapReadyMesh = readyFish;
    }
    return rec;
  }

  if (type === 'drying_rack') {
    for (const sx of [-0.75, 0.75]) {
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.5, 6), woodMat);
      p1.position.set(sx, 0.72, -0.24);
      p1.rotation.x = 0.22;
      group.add(p1);

      const p2 = p1.clone();
      p2.position.z = 0.24;
      p2.rotation.x = -0.22;
      group.add(p2);
    }

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.75, 6), darkWoodMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.38, 0);
    group.add(bar);

    if (!isGhost) {
      const meatMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.65 });
      const hang = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.12), meatMat);
      hang.position.set(0, 1.06, 0);
      hang.visible = false;
      group.add(hang);
      rec.dryHangMesh = hang;
    }
    return rec;
  }

  if (type === 'forge') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.05, 0.55, 8), stoneMat);
    base.position.set(0, 0.28, 0);
    group.add(base);

    const dome = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 0), stoneMat);
    dome.position.set(0, 0.85, 0);
    group.add(dome);

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.9, 7), stoneMat);
    chimney.position.set(0, 1.55, 0);
    group.add(chimney);

    if (!isGhost) {
      const emberMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.18), emberMat);
      glow.position.set(0, 0.68, 0.64);
      group.add(glow);

      const light = new THREE.PointLight(0xff6b1a, 1.8, 12, 1.5);
      light.position.set(0, 0.9, 0.9);
      group.add(light);
      rec.forgeLight = light;
    }
    return rec;
  }

  // Fallback ghost silhouette if needed for campfire/shelter preview
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 8), leafMat);
  marker.position.y = 0.7;
  group.add(marker);
  return rec;
}

export function syncStructureVisualState(rec: StructureMeshRecord, data: PlacedStructure) {
  rec.data = data;

  if (rec.waterFillMesh && data.type === 'water_collector') {
    const doses = data.waterDoses ?? 0;
    rec.waterFillMesh.visible = doses > 0.05;
    const ratio = Math.min(1, doses / BASE_BUILDING.WATER_COLLECTOR_CAP);
    rec.waterFillMesh.position.y = 0.12 + ratio * 0.38;
  }

  if (data.type === 'farm_plot') {
    if (rec.sproutGroup) rec.sproutGroup.visible = data.cropState === 'growing';
    if (rec.readyCropGroup) rec.readyCropGroup.visible = data.cropState === 'ready';
  }

  if (rec.trapReadyMesh && (data.type === 'snare_trap' || data.type === 'fish_trap')) {
    rec.trapReadyMesh.visible = data.trapState === 'ready';
  }

  if (rec.dryHangMesh && data.type === 'drying_rack') {
    if (!data.dryItem) {
      rec.dryHangMesh.visible = false;
    } else {
      rec.dryHangMesh.visible = true;
      const mat = rec.dryHangMesh.material as THREE.MeshStandardMaterial;
      const cured = (data.dryProgress ?? 0) >= 1;
      if (data.dryItem === 'raw_fish') {
        mat.color.setHex(cured ? 0x92400e : 0x7dd3fc);
      } else {
        mat.color.setHex(cured ? 0x451a03 : 0xb91c1c);
      }
    }
  }
}
