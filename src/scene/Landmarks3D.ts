// 3D Landmark Builders for Act 2 & Act 3 Interior Locations, Repairable Station Systems,
// and Expanded GatherNode / StoryClue 3D Props.

import * as THREE from 'three';
import { WORLD } from '../survival/config.ts';
import { STATION_REPAIR_DEFS } from '../survival/quests.ts';
import type { GatherNodeType, StationRepairId, StoryClueDef } from '../survival/types.ts';
import { mergeStaticMeshesByMaterial } from './meshMerge.ts';

export interface StationSystemMeshRecord {
  id: StationRepairId;
  group: THREE.Group;
  statusLightMesh: THREE.Mesh;
  statusMat: THREE.MeshStandardMaterial;
}

export interface InteriorLandmarksHandle {
  stationSystems: Map<StationRepairId, StationSystemMeshRecord>;
  radioTowerBeacon: THREE.Mesh;
  caveCrystalLights: THREE.PointLight[];
  groups: {
    campGroup: THREE.Group;
    tailGroup: THREE.Group;
    caveGroup: THREE.Group;
    ruinsGroup: THREE.Group;
    stationGroup: THREE.Group;
  };
}

export function buildInteriorLandmarks(
  scene: THREE.Scene,
  getTerrainHeight: (x: number, z: number) => number
): InteriorLandmarksHandle {
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.78, metalness: 0.45 });
  const aluminumMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.45, metalness: 0.65 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x5c3d28, roughness: 0.9 });
  const tarpMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85, side: THREE.DoubleSide });
  const basaltMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.95, flatShading: true });
  const mossStoneMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.92, flatShading: true });
  const mossCapMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9, flatShading: true });

  // -------------------------------------------------------------------------
  // 1. Abandoned Survivor Camp (-56, 8)
  // -------------------------------------------------------------------------
  const campGroup = new THREE.Group();
  for (const xOff of [-1.4, 1.4]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.1, 6), timberMat);
    post.position.set(xOff, 1.05, 0);
    campGroup.add(post);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 6), timberMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(0, 2.0, 0);
  campGroup.add(beam);

  const tornTarp = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 2.1), tarpMat);
  tornTarp.position.set(0, 1.55, -0.55);
  tornTarp.rotation.x = 0.55;
  campGroup.add(tornTarp);

  // Old cold fire pit stone ring
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), mossStoneMat);
    stone.position.set(Math.cos(a) * 0.65, 0.1, 2.2 + Math.sin(a) * 0.65);
    campGroup.add(stone);
  }
  const campY = getTerrainHeight(WORLD.ABANDONED_CAMP_POS.x, WORLD.ABANDONED_CAMP_POS.z);
  campGroup.position.set(WORLD.ABANDONED_CAMP_POS.x, campY, WORLD.ABANDONED_CAMP_POS.z);
  scene.add(campGroup);

  // -------------------------------------------------------------------------
  // 2. Jungle Flight 404 Tail Section Wreckage (48, -12)
  // -------------------------------------------------------------------------
  const tailGroup = new THREE.Group();
  const tailTube = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.45, 5.4, 10), aluminumMat);
  tailTube.rotation.z = Math.PI / 2.4;
  tailTube.rotation.y = -0.35;
  tailTube.position.set(0, 1.1, 0);
  tailGroup.add(tailTube);

  const verticalFin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.2, 2.1), stripeMat);
  verticalFin.position.set(-1.6, 2.4, 0.35);
  verticalFin.rotation.z = 0.25;
  verticalFin.rotation.y = -0.35;
  tailGroup.add(verticalFin);

  const stabilizer = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 4.2), aluminumMat);
  stabilizer.position.set(-1.8, 1.5, 0.35);
  stabilizer.rotation.y = -0.35;
  tailGroup.add(stabilizer);

  const tailY = getTerrainHeight(WORLD.JUNGLE_TAIL_POS.x, WORLD.JUNGLE_TAIL_POS.z);
  tailGroup.position.set(WORLD.JUNGLE_TAIL_POS.x, tailY, WORLD.JUNGLE_TAIL_POS.z);
  scene.add(tailGroup);

  // -------------------------------------------------------------------------
  // 3. Western Basalt Caves Grotto & Glowing Mineral Veins (-78, -48)
  // -------------------------------------------------------------------------
  const caveGroup = new THREE.Group();
  const caveY = getTerrainHeight(WORLD.CAVE_GROTTO_POS.x, WORLD.CAVE_GROTTO_POS.z);
  // Massive stone arch & cavern roof ribs facing south entrance
  for (let i = 0; i < 9; i++) {
    const ang = Math.PI * 0.25 + (i / 8) * Math.PI * 1.5; // Horseshoe opening facing south
    const rad = 11.5;
    const pillar = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 1), basaltMat);
    pillar.position.set(Math.cos(ang) * rad, 3.2, Math.sin(ang) * rad);
    pillar.scale.set(1.25, 2.1, 1.15);
    caveGroup.add(pillar);
  }
  const cavernRoof = new THREE.Mesh(new THREE.DodecahedronGeometry(9.5, 1), basaltMat);
  cavernRoof.position.set(0, 8.2, -3.5);
  cavernRoof.scale.set(1.35, 0.42, 1.15);
  caveGroup.add(cavernRoof);

  // Subtle glowing cave crystal sconces inside grotto
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.9,
  });
  const caveCrystalLights: THREE.PointLight[] = [];
  for (const [cx, cz] of [
    [-5.5, -4.5],
    [5.8, -4.2],
  ]) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), crystalMat);
    shard.position.set(cx, 1.6, cz);
    shard.scale.set(0.7, 1.6, 0.7);
    caveGroup.add(shard);

    const cl = new THREE.PointLight(0x38bdf8, 1.4, 15, 1.4);
    cl.position.set(cx, 2.1, cz);
    caveGroup.add(cl);
    caveCrystalLights.push(cl);
  }
  caveGroup.position.set(WORLD.CAVE_GROTTO_POS.x, caveY, WORLD.CAVE_GROTTO_POS.z);
  scene.add(caveGroup);

  // -------------------------------------------------------------------------
  // 4. Ancient Stone Ruins Monoliths & Keycard Altar (76, -62)
  // -------------------------------------------------------------------------
  const ruinsGroup = new THREE.Group();
  const ruinsY = getTerrainHeight(WORLD.ANCIENT_RUINS_POS.x, WORLD.ANCIENT_RUINS_POS.z);

  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.8, 0.35, 8), mossStoneMat);
  plaza.position.y = 0.15;
  ruinsGroup.add(plaza);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const h = 3.2 + (i % 3) * 1.1;
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.85, h, 0.85), mossStoneMat);
    col.position.set(Math.cos(a) * 5.6, h / 2, Math.sin(a) * 5.6);
    col.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.04;
    ruinsGroup.add(col);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.28, 1.05), mossCapMat);
    cap.position.set(Math.cos(a) * 5.6, h + 0.14, Math.sin(a) * 5.6);
    ruinsGroup.add(cap);
  }
  const altar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.05, 1.3), mossStoneMat);
  altar.position.set(0, 0.55, 0);
  ruinsGroup.add(altar);

  ruinsGroup.position.set(WORLD.ANCIENT_RUINS_POS.x, ruinsY, WORLD.ANCIENT_RUINS_POS.z);
  scene.add(ruinsGroup);

  // -------------------------------------------------------------------------
  // 5. Caldera Research Station, Radio Tower & 3 Repair Systems (-16, -112)
  // -------------------------------------------------------------------------
  const stationGroup = new THREE.Group();
  const stY = getTerrainHeight(WORLD.RESEARCH_STATION_POS.x, WORLD.RESEARCH_STATION_POS.z);
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
  const cabinWallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.72, metalness: 0.35 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.5 });

  // Station slab
  const pad = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 14), concreteMat);
  pad.position.set(0, 0.2, 0);
  stationGroup.add(pad);

  // Main Corrugated Radio Hut (open front south archway)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.1, 0.3), cabinWallMat);
  backWall.position.set(0, 1.75, -5.2);
  stationGroup.add(backWall);

  for (const side of [-3.1, 3.1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.1, 5.2), cabinWallMat);
    sideWall.position.set(side, 1.75, -2.7);
    stationGroup.add(sideWall);
  }
  const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.28, 5.8), roofMat);
  cabinRoof.position.set(0, 3.35, -2.7);
  stationGroup.add(cabinRoof);

  // Towering Steel Lattice Radio Mast with Red Beacon
  const mastBaseX = -5.6;
  const mastBaseZ = -3.8;
  const mastMat = aluminumMat;
  for (const [lx, lz] of [
    [-0.55, -0.55],
    [0.55, -0.55],
    [-0.55, 0.55],
    [0.55, 0.55],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 18, 6), mastMat);
    leg.position.set(mastBaseX + lx * 0.6, 9.2, mastBaseZ + lz * 0.6);
    stationGroup.add(leg);
  }
  for (let r = 2; r <= 16; r += 3.2) {
    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(1.15 - r * 0.025, 0.14, 1.15 - r * 0.025),
      r % 2 === 0 ? stripeMat : aluminumMat
    );
    brace.position.set(mastBaseX, r, mastBaseZ);
    stationGroup.add(brace);
  }
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 4.5, 6), aluminumMat);
  spire.position.set(mastBaseX, 20.2, mastBaseZ);
  stationGroup.add(spire);

  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const radioTowerBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), beaconMat);
  radioTowerBeacon.position.set(mastBaseX, 22.5, mastBaseZ);
  stationGroup.add(radioTowerBeacon);

  stationGroup.position.set(WORLD.RESEARCH_STATION_POS.x, stY, WORLD.RESEARCH_STATION_POS.z);
  scene.add(stationGroup);

  // Interactive Repair Systems placed explicitly by STATION_REPAIR_DEFS coordinates
  const stationSystems = new Map<StationRepairId, StationSystemMeshRecord>();

  (['radio', 'generator', 'chart'] as StationRepairId[]).forEach((partId) => {
    const def = STATION_REPAIR_DEFS[partId];
    const g = new THREE.Group();
    const statusMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xb91c1c,
      emissiveIntensity: 0.75,
    });
    const statusLightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), statusMat);

    if (partId === 'radio') {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.95), roofMat);
      desk.position.y = 0.45;
      g.add(desk);

      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.65), rustMat);
      rack.position.set(0, 1.25, -0.05);
      g.add(rack);

      statusLightMesh.position.set(0.45, 1.4, 0.3);
      g.add(statusLightMesh);
    } else if (partId === 'generator') {
      const tank = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.15, 1.1), rustMat);
      tank.position.y = 0.65;
      g.add(tank);

      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.0, 6), aluminumMat);
      exhaust.position.set(-0.6, 1.55, 0);
      g.add(exhaust);

      statusLightMesh.position.set(0.55, 1.28, 0.4);
      g.add(statusLightMesh);
    } else {
      const chartTable = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.95, 1.3), timberMat);
      chartTable.position.y = 0.48;
      g.add(chartTable);

      const paper = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.04, 0.95),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.75 })
      );
      paper.position.y = 0.98;
      g.add(paper);

      statusLightMesh.position.set(0.7, 1.15, 0.42);
      g.add(statusLightMesh);
    }

    const y = getTerrainHeight(def.x, def.z);
    g.position.set(def.x, Math.max(0.3, y), def.z);
    scene.add(g);
    stationSystems.set(partId, {
      id: partId,
      group: g,
      statusLightMesh,
      statusMat,
    });
  });

  mergeStaticMeshesByMaterial(campGroup);
  mergeStaticMeshesByMaterial(tailGroup);
  mergeStaticMeshesByMaterial(caveGroup, new Set<THREE.Object3D>(caveCrystalLights));
  mergeStaticMeshesByMaterial(ruinsGroup);
  mergeStaticMeshesByMaterial(stationGroup, new Set<THREE.Object3D>([radioTowerBeacon]));

  return {
    stationSystems,
    radioTowerBeacon,
    caveCrystalLights,
    groups: {
      campGroup,
      tailGroup,
      caveGroup,
      ruinsGroup,
      stationGroup,
    },
  };
}

export function syncStationSystemsVisuals(
  records: Map<StationRepairId, StationSystemMeshRecord>,
  repairs: { radio: boolean; generator: boolean; chart: boolean }
) {
  for (const [id, rec] of records.entries()) {
    const done = repairs[id];
    rec.statusMat.color.setHex(done ? 0x22c55e : 0xef4444);
    rec.statusMat.emissive.setHex(done ? 0x15803d : 0xb91c1c);
    rec.statusMat.emissiveIntensity = done ? 1.0 : 0.7;
  }
}

export function buildExtraGatherNodeMesh(type: GatherNodeType): THREE.Group | null {
  const group = new THREE.Group();

  switch (type) {
    case 'resin_tree': {
      const barkMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.92, flatShading: true });
      const boughMat = new THREE.MeshStandardMaterial({ color: 0x4d5c2b, roughness: 0.84, flatShading: true });
      const amberMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        emissive: 0x92400e,
        emissiveIntensity: 0.18,
        roughness: 0.35,
      });
      // Gnarled tropical acacia/resinwood trunk + spreading boughs (no blocky green pine cones!)
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 4.4, 7), barkMat);
      trunk.position.y = 2.2;
      trunk.rotation.z = 0.05;
      group.add(trunk);
      const branchAngles = [0.2, 2.3, 4.4];
      branchAngles.forEach((ba, idx) => {
        const bough = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 2.2, 6), barkMat);
        bough.position.set(Math.cos(ba) * 0.65, 4.1 + idx * 0.25, Math.sin(ba) * 0.65);
        bough.rotation.set(Math.sin(ba) * 0.62, 0, -Math.cos(ba) * 0.62);
        group.add(bough);
        for (let k = 0; k < 5; k++) {
          const fa = (k / 5) * Math.PI * 2 + ba;
          const frond = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 1.35), boughMat);
          frond.position.set(
            Math.cos(ba) * 1.15 + Math.sin(fa) * 0.55,
            4.85 + idx * 0.28,
            Math.sin(ba) * 1.15 + Math.cos(fa) * 0.55
          );
          frond.rotation.set(-0.22, fa, 0);
          group.add(frond);
        }
      });
      const sap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), amberMat);
      sap.position.set(0.24, 1.35, 0.12);
      sap.scale.set(0.8, 1.45, 0.8);
      group.add(sap);
      return group;
    }

    case 'herb_patch': {
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x5c7a38, roughness: 0.78 });
      const flowerMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.55 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + (i % 2) * 0.2;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.52, 4), leafMat);
        leaf.position.set(Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2);
        leaf.rotation.set(Math.sin(a) * 0.52, a, -Math.cos(a) * 0.52);
        group.add(leaf);
      }
      const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), flowerMat);
      bloom.position.y = 0.36;
      group.add(bloom);
      return group;
    }

    case 'iron_vein': {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x3b3532, roughness: 0.94, flatShading: true });
      const oreMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.48, metalness: 0.55 });
      const rock = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 1.08, 1.15, 7), rockMat);
      rock.position.y = 0.48;
      rock.rotation.y = 0.4;
      group.add(rock);
      for (let i = 0; i < 4; i++) {
        const chunk = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), oreMat);
        chunk.position.set((i - 1.5) * 0.32, 0.68, (i % 2 === 0 ? 1 : -1) * 0.38);
        group.add(chunk);
      }
      return group;
    }

    case 'copper_vein': {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.9, flatShading: true });
      const wireMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        emissive: 0x7c2d12,
        emissiveIntensity: 0.2,
        roughness: 0.38,
        metalness: 0.68,
      });
      const rock = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.98, 1.05, 7), rockMat);
      rock.position.y = 0.42;
      group.add(rock);
      const spool = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.075, 6, 12), wireMat);
      spool.position.set(0.32, 0.72, 0.35);
      spool.rotation.x = 0.6;
      group.add(spool);
      return group;
    }

    case 'fuel_drum': {
      const drumMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5, metalness: 0.45 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.6 });
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 10), drumMat);
      cyl.position.y = 0.52;
      group.add(cyl);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 10), rimMat);
      rim.position.y = 1.0;
      group.add(rim);
      return group;
    }

    case 'tech_wreck': {
      const boxMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.7 });
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
      const unit = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.65, 0.75), boxMat);
      unit.position.y = 0.34;
      unit.rotation.y = 0.3;
      group.add(unit);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.05), ledMat);
      led.position.set(0.22, 0.5, 0.38);
      group.add(led);
      return group;
    }

    default:
      return null;
  }
}

export function buildStoryCluePropMesh(clue: StoryClueDef): THREE.Group {
  const group = new THREE.Group();
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.85 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.45, metalness: 0.5 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.75 });
  const tapeMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.5,
    emissive: 0xca8a04,
    emissiveIntensity: 0.35,
  });

  if (clue.propKind === 'manifest') {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.72), darkMat);
    board.position.y = 0.08;
    board.rotation.set(0.18, 0.4, 0);
    group.add(board);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.6), paperMat);
    sheet.position.y = 0.09;
    sheet.rotation.set(0.18, 0.4, 0);
    group.add(sheet);
  } else if (clue.propKind === 'flask_note') {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), darkMat);
    rock.scale.set(1.2, 0.5, 1.1);
    group.add(rock);
    const flask = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.42, 8), bambooMat);
    flask.rotation.z = Math.PI / 3;
    flask.position.set(0, 0.25, 0);
    group.add(flask);
    const note = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22), paperMat);
    note.position.set(0.18, 0.22, 0.14);
    group.add(note);
  } else if (clue.propKind === 'journal_book' || clue.propKind === 'cave_note' || clue.propKind === 'station_log') {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.55), darkMat);
    crate.position.y = 0.21;
    group.add(crate);
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.06, 0.32),
      clue.propKind === 'station_log' ? tapeMat : paperMat
    );
    book.position.set(0, 0.45, 0);
    book.rotation.y = 0.3;
    group.add(book);
  } else if (clue.propKind === 'black_box') {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 })
    );
    box.position.y = 0.21;
    group.add(box);
  } else if (clue.propKind === 'stone_tablet') {
    // Weathered basalt keycard tablet & brass clasp resting on altar (no bright light-blue placeholder slab!)
    const keycard = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.03, 0.22),
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.42,
        metalness: 0.65,
      })
    );
    keycard.position.y = 1.07;
    group.add(keycard);
    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.034, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.35,
        metalness: 0.85,
      })
    );
    inlay.position.set(0.04, 1.072, 0.04);
    group.add(inlay);
  } else {
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.55, 6), metalMat);
    stake.position.y = 0.75;
    group.add(stake);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.06), tapeMat);
    flag.position.set(0.24, 1.32, 0);
    flag.rotation.z = -0.18;
    group.add(flag);
  }

  return group;
}
