import * as THREE from 'three';

export interface WalkableZone {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  yStart: number;
  yEnd: number;
  slopeAxis?: 'z' | 'x';
}

export interface BuildingStation {
  type: 'stove' | 'bar' | 'bed' | 'desk';
  localPos: THREE.Vector3;
  facingYaw: number;
}

export interface BuiltStructureResult {
  group: THREE.Group;
  walkableZones: WalkableZone[];
  stations: BuildingStation[];
  animatedParts: {
    elevatorCab?: THREE.Group;
    steamPuffs?: THREE.Mesh[];
    koiFish?: THREE.Mesh[];
    hammockFabric?: THREE.Mesh;
    tippingBucket?: THREE.Mesh;
    fireFlames?: THREE.Mesh[];
    ferryBoat?: THREE.Group;
  };
}

// Shared PBR / Phong Material Palette (cached once for zero-GC reuse)
const MAT = {
  teak: new THREE.MeshStandardMaterial({ color: 0x8f5d38, roughness: 0.72, metalness: 0.05 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x523219, roughness: 0.78, metalness: 0.05 }),
  bamboo: new THREE.MeshStandardMaterial({ color: 0xb8965c, roughness: 0.68, metalness: 0.02 }),
  thatch: new THREE.MeshStandardMaterial({ color: 0xc2a266, roughness: 0.92, flatShading: true }),
  whiteStucco: new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.75 }),
  creamWall: new THREE.MeshStandardMaterial({ color: 0xebe3d5, roughness: 0.8 }),
  marble: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.08 }),
  darkSlate: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.2 }),
  stonePaving: new THREE.MeshStandardMaterial({ color: 0x9b9589, roughness: 0.82, flatShading: true }),
  sandstone: new THREE.MeshStandardMaterial({ color: 0xd6c3a1, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.42,
    roughness: 0.1,
    metalness: 0.25,
    depthWrite: false,
  }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.22, metalness: 0.88 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x3f4754, roughness: 0.4, metalness: 0.75 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb86b35, roughness: 0.3, metalness: 0.82 }),
  poolWater: new THREE.MeshStandardMaterial({
    color: 0x14b8c4,
    transparent: true,
    opacity: 0.8,
    roughness: 0.12,
    metalness: 0.15,
  }),
  whiteLinen: new THREE.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.88 }),
  coralFabric: new THREE.MeshStandardMaterial({ color: 0xe16b5a, roughness: 0.85 }),
  tealFabric: new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.85 }),
  velvetNavy: new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.82 }),
  emeraldFelt: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 }),
  rugWarm: new THREE.MeshStandardMaterial({ color: 0xc9a87c, roughness: 0.95 }),
  lampGlow: new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.1,
    roughness: 0.3,
  }),
  burnerGlow: new THREE.MeshStandardMaterial({
    color: 0xff5a1f,
    emissive: 0xff4500,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  }),
  neonCyan: new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  }),
  neonPink: new THREE.MeshStandardMaterial({
    color: 0xf472b6,
    emissive: 0xec4899,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  }),
  foliage: new THREE.MeshStandardMaterial({ color: 0x2a7b3b, roughness: 0.82 }),
  blueCourt: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.72 }),
  courtWhiteLine: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
  netMesh: new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    transparent: true,
    opacity: 0.72,
    roughness: 0.8,
  }),
};

// Helper: Build a detailed King Bed with headboard, mattress, folded duvet, pillows, nightstands & lamps
function createBedAssembly(duvetMat: THREE.Material = MAT.coralFabric): THREE.Group {
  const bed = new THREE.Group();

  // Woven rug underneath
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.03, 3.0), MAT.rugWarm);
  rug.position.set(0, 0.015, 0.2);
  bed.add(rug);

  // Teak frame & legs
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 2.2), MAT.darkWood);
  frame.position.set(0, 0.22, 0);
  bed.add(frame);

  // Tall slatted headboard
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.96, 1.05, 0.12), MAT.teak);
  headboard.position.set(0, 0.75, -1.06);
  bed.add(headboard);

  // Crisp white mattress
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.24, 2.04), MAT.whiteLinen);
  mattress.position.set(0, 0.47, 0.02);
  bed.add(mattress);

  // Folded resort duvet covering lower 65% of bed
  const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.26, 1.32), duvetMat);
  duvet.position.set(0, 0.48, 0.39);
  bed.add(duvet);

  // Twin plump pillows
  for (const px of [-0.44, 0.44]) {
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.14, 0.42), MAT.whiteLinen);
    pillow.position.set(px, 0.64, -0.72);
    pillow.rotation.x = 0.18;
    bed.add(pillow);
  }

  // Twin Nightstands + glowing bedside lamps
  for (const nx of [-1.25, 1.25]) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.46), MAT.teak);
    stand.position.set(nx, 0.26, -0.82);
    bed.add(stand);

    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.16, 8), MAT.gold);
    lampBase.position.set(nx, 0.60, -0.82);
    bed.add(lampBase);

    const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.2, 10), MAT.lampGlow);
    lampShade.position.set(nx, 0.78, -0.82);
    bed.add(lampShade);
  }

  return bed;
}

// Helper: Build a commercial Stainless Steel Stove + Glowing Burners + Simmering Pot & Pan + Range Hood
function createChefStoveStation(includeHood: boolean = true): {
  group: THREE.Group;
  steamPuffs: THREE.Mesh[];
} {
  const station = new THREE.Group();
  const steamPuffs: THREE.Mesh[] = [];

  // Stainless steel range body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.92, 0.95), MAT.steel);
  body.position.set(0, 0.46, 0);
  station.add(body);

  // Oven doors on front
  for (const ox of [-0.45, 0.45]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.55, 0.05), MAT.darkSteel);
    door.position.set(ox, 0.36, 0.48);
    station.add(door);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.04, 0.06), MAT.gold);
    handle.position.set(ox, 0.58, 0.52);
    station.add(handle);
  }

  // Control knobs
  for (let k = -0.65; k <= 0.65; k += 0.32) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), MAT.darkSteel);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(k, 0.80, 0.49);
    station.add(knob);
  }

  // 4 Glowing Gas Burners & Grates
  const burnerPositions = [
    [-0.5, -0.18],
    [0.5, -0.18],
    [-0.5, 0.18],
    [0.5, 0.18],
  ];
  for (const [bx, bz] of burnerPositions) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.028, 6, 12), MAT.burnerGlow);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(bx, 0.94, bz);
    station.add(ring);
  }

  // Copper Stock Pot on back-left burner
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.28, 12), MAT.copper);
  pot.position.set(-0.5, 1.09, -0.18);
  station.add(pot);

  // Sizzling Frying Pan on front-right burner
  const skillet = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.08, 12), MAT.darkSteel);
  skillet.position.set(0.5, 0.99, 0.18);
  station.add(skillet);
  const skilletHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.28), MAT.darkWood);
  skilletHandle.position.set(0.5, 1.01, 0.40);
  station.add(skilletHandle);

  // Rising Steam Puff Meshes (animated in scene loop!)
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.11 + i * 0.02, 7, 7), steamMat);
    puff.position.set(i % 2 === 0 ? -0.5 : 0.5, 1.3 + i * 0.22, i % 2 === 0 ? -0.18 : 0.18);
    puff.userData.baseX = puff.position.x;
    puff.userData.baseZ = puff.position.z;
    puff.userData.phase = i * 1.4;
    station.add(puff);
    steamPuffs.push(puff);
  }

  // Stainless Range Hood above stove
  if (includeHood) {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.55, 4), MAT.steel);
    hood.rotation.y = Math.PI / 4;
    hood.position.set(0, 2.35, 0);
    station.add(hood);

    const flue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.75, 0.45), MAT.steel);
    flue.position.set(0, 2.85, 0);
    station.add(flue);
  }

  return { group: station, steamPuffs };
}

// Helper: Build a small Dining Table with 2 Chairs, Wine Glasses & Candle
function createDiningTableSet(): THREE.Group {
  const set = new THREE.Group();
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.72, 8), MAT.darkWood);
  leg.position.y = 0.36;
  set.add(leg);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.06, 12), MAT.whiteLinen);
  top.position.y = 0.75;
  set.add(top);

  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), MAT.lampGlow);
  candle.position.y = 0.84;
  set.add(candle);

  // Two Plates
  for (const px of [-0.32, 0.32]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.02, 10), MAT.marble);
    plate.position.set(px, 0.79, 0);
    set.add(plate);
  }

  // Two Chairs
  for (const cx of [-0.9, 0.9]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), MAT.teak);
    seat.position.set(cx, 0.45, 0);
    set.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.42), MAT.teak);
    back.position.set(cx + (cx > 0 ? 0.18 : -0.18), 0.70, 0);
    set.add(back);
    const cLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6), MAT.darkWood);
    cLeg.position.set(cx, 0.225, 0);
    set.add(cLeg);
  }

  return set;
}

// Helper: Build a Potted Tropical Palm Planter
function createPlanter(): THREE.Group {
  const p = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.38, 8), MAT.stonePaving);
  pot.position.y = 0.19;
  p.add(pot);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.65, 4), MAT.foliage);
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.14, 0.56, Math.sin(a) * 0.14);
    leaf.rotation.z = Math.cos(a) * 0.5;
    leaf.rotation.x = Math.sin(a) * 0.5;
    p.add(leaf);
  }
  return p;
}

export function buildResortStructure3D(defId: string): BuiltStructureResult {
  const group = new THREE.Group();
  const walkableZones: WalkableZone[] = [];
  const stations: BuildingStation[] = [];
  const animatedParts: BuiltStructureResult['animatedParts'] = {};

  switch (defId) {
    // =========================================================
    // 1. PATHS & WALKWAYS
    // =========================================================
    case 'stone_pathway': {
      // 4m long smooth sandstone path segment with borders and solar bollard lights
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 4.0), MAT.stonePaving);
      bed.position.set(0, 0.04, 0);
      group.add(bed);

      for (const z of [-1.4, -0.45, 0.5, 1.45]) {
        const paver = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.11, 0.82), MAT.sandstone);
        paver.position.set(0, 0.065, z);
        group.add(paver);
      }

      // Low warm solar bollards on edges
      for (const sx of [-1.05, 1.05]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.42, 6), MAT.darkSlate);
        post.position.set(sx, 0.22, 0);
        group.add(post);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 6), MAT.lampGlow);
        cap.position.set(sx, 0.46, 0);
        group.add(cap);
      }

      walkableZones.push({ minX: -1.2, maxX: 1.2, minZ: -2.0, maxZ: 2.0, yStart: 0.12, yEnd: 0.12 });
      break;
    }

    case 'timber_boardwalk': {
      // Elevated teak coastal boardwalk with pilings and rope railings
      for (let z = -1.8; z <= 1.8; z += 1.2) {
        for (const x of [-1.1, 1.1]) {
          const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 1.6, 6), MAT.darkWood);
          piling.position.set(x, -0.1, z);
          group.add(piling);
        }
      }
      for (let z = -1.85; z <= 1.85; z += 0.36) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.30), MAT.teak);
        plank.position.set(0, 0.35, z);
        group.add(plank);
      }
      // Side rope rails
      for (const sx of [-1.12, 1.12]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.0, 6), MAT.bamboo);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(sx, 0.85, 0);
        group.add(rail);
      }
      walkableZones.push({ minX: -1.2, maxX: 1.2, minZ: -2.0, maxZ: 2.0, yStart: 0.40, yEnd: 0.40 });
      break;
    }

    case 'garden_trail': {
      // Stepping stones with lush border ferns
      const earth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 4.0), MAT.sandstone);
      earth.position.y = 0.02;
      group.add(earth);

      for (let i = 0; i < 5; i++) {
        const z = -1.6 + i * 0.8;
        const xOff = i % 2 === 0 ? -0.22 : 0.22;
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.50, 0.08, 7), MAT.stonePaving);
        stone.position.set(xOff, 0.06, z);
        group.add(stone);
      }
      for (const [fx, fz] of [
        [-0.95, -1.2],
        [0.95, 0.0],
        [-0.95, 1.2],
      ]) {
        const fern = createPlanter();
        fern.scale.setScalar(0.85);
        fern.position.set(fx, 0, fz);
        group.add(fern);
      }
      walkableZones.push({ minX: -1.1, maxX: 1.1, minZ: -2.0, maxZ: 2.0, yStart: 0.1, yEnd: 0.1 });
      break;
    }

    case 'marble_promenade': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 4.2), MAT.marble);
      base.position.set(0, 0.07, 0);
      group.add(base);

      const goldInlay = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 4.18), MAT.gold);
      goldInlay.position.set(0, 0.075, 0);
      group.add(goldInlay);

      for (const sx of [-1.4, 1.4]) {
        const planter = createPlanter();
        planter.position.set(sx, 0.14, -1.3);
        group.add(planter);

        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 8), MAT.gold);
        lamp.position.set(sx, 0.68, 1.2);
        group.add(lamp);
        const globe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), MAT.lampGlow);
        globe.position.set(sx, 1.28, 1.2);
        group.add(globe);
      }
      walkableZones.push({ minX: -1.6, maxX: 1.6, minZ: -2.1, maxZ: 2.1, yStart: 0.14, yEnd: 0.14 });
      break;
    }

    // =========================================================
    // 2. STARTER TIER
    // =========================================================
    case 'koi_pond': {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.28, 7, 16), MAT.stonePaving);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.22;
      group.add(rim);

      const pondWater = new THREE.Mesh(new THREE.CircleGeometry(1.65, 16), MAT.poolWater);
      pondWater.rotation.x = -Math.PI / 2;
      pondWater.position.y = 0.24;
      group.add(pondWater);

      // Lily pads & lotus blooms
      for (const [lx, lz] of [
        [-0.7, 0.4],
        [0.6, -0.6],
        [-0.2, -0.8],
      ]) {
        const pad = new THREE.Mesh(new THREE.CircleGeometry(0.26, 8), MAT.foliage);
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(lx, 0.26, lz);
        group.add(pad);
      }

      const koiMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });
      const koiFish: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const koi = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 5), koiMat);
        const a = (i / 4) * Math.PI * 2;
        koi.position.set(Math.cos(a) * 0.9, 0.20, Math.sin(a) * 0.9);
        koi.rotation.x = Math.PI / 2;
        koi.rotation.z = -a;
        koi.userData.orbitAngle = a;
        koi.userData.orbitRadius = 0.75 + (i % 2) * 0.35;
        group.add(koi);
        koiFish.push(koi);
      }
      animatedParts.koiFish = koiFish;
      break;
    }

    case 'beach_firepit': {
      const fireRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.22, 7, 12), MAT.stonePaving);
      fireRing.rotation.x = Math.PI / 2;
      fireRing.position.y = 0.16;
      group.add(fireRing);

      // Charred firewood logs
      for (let i = 0; i < 4; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 6), MAT.darkWood);
        log.position.set(0, 0.22, 0);
        log.rotation.z = Math.PI / 2.4;
        log.rotation.y = (i / 4) * Math.PI * 2;
        group.add(log);
      }

      const fireFlames: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24 - i * 0.05, 0.65 - i * 0.1, 6), MAT.burnerGlow);
        flame.position.set((i - 1) * 0.14, 0.45, 0);
        group.add(flame);
        fireFlames.push(flame);
      }
      animatedParts.fireFlames = fireFlames;

      // 3 Split Log Benches
      for (let i = 0; i < 3; i++) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.34, 1.55), MAT.teak);
        const a = (i / 3) * Math.PI * 2;
        bench.position.set(Math.cos(a) * 2.25, 0.17, Math.sin(a) * 2.25);
        bench.rotation.y = a + Math.PI / 2;
        group.add(bench);
      }
      break;
    }

    case 'coconut_stand': {
      const floor = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.2, 2.6), MAT.teak);
      floor.position.y = 0.1;
      group.add(floor);

      // 4 Bamboo corner posts
      for (const px of [-1.3, 1.3]) {
        for (const pz of [-1.1, 1.1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.3, 6), MAT.bamboo);
          post.position.set(px, 1.25, pz);
          group.add(post);
        }
      }

      // Service counter
      const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.75), MAT.darkWood);
      counter.position.set(0, 0.7, 0.55);
      group.add(counter);

      // Pyramid of coconuts + smoothie blender on counter
      const cocoMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.75 });
      for (let i = 0; i < 5; i++) {
        const coco = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 7), cocoMat);
        coco.position.set(-0.7 + (i % 3) * 0.22, 1.30 + Math.floor(i / 3) * 0.18, 0.55);
        group.add(coco);
      }
      const blender = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.32, 8), MAT.glass);
      blender.position.set(0.65, 1.36, 0.55);
      group.add(blender);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.15, 4), MAT.thatch);
      roof.position.set(0, 2.85, 0);
      roof.rotation.y = Math.PI / 4;
      group.add(roof);

      walkableZones.push({ minX: -1.5, maxX: 1.5, minZ: -1.3, maxZ: 1.3, yStart: 0.2, yEnd: 0.2 });
      stations.push({ type: 'bar', localPos: new THREE.Vector3(0, 0.2, -0.25), facingYaw: 0 });
      break;
    }

    case 'garden_hammock': {
      for (const x of [-1.5, 1.5]) {
        const palm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.7, 6), MAT.darkWood);
        palm.position.set(x, 1.35, 0);
        palm.rotation.z = x > 0 ? 0.16 : -0.16;
        group.add(palm);

        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.7, 6), MAT.foliage);
        crown.position.set(x * 1.15, 2.8, 0);
        group.add(crown);
      }
      const fabric = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.58, 2.2, 8, 1, true, 0, Math.PI),
        MAT.whiteLinen
      );
      fabric.rotation.z = Math.PI / 2;
      fabric.position.set(0, 0.92, 0);
      group.add(fabric);
      animatedParts.hammockFabric = fabric;
      break;
    }

    // =========================================================
    // 3. INFRASTRUCTURE
    // =========================================================
    case 'ferry_dock': {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.35, 13.0), MAT.teak);
      deck.position.set(0, 0.8, 0);
      group.add(deck);

      for (let z = -5.5; z <= 5.5; z += 2.75) {
        for (const x of [-1.55, 1.55]) {
          const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 6), MAT.darkWood);
          stilt.position.set(x, -0.6, z);
          group.add(stilt);
          const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.45, 8), MAT.darkSlate);
          bollard.position.set(x, 1.18, z);
          group.add(bollard);
        }
      }

      // Welcome Pier Arch + Concierge Check-in Desk
      for (const px of [-1.6, 1.6]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.8, 8), MAT.teak);
        col.position.set(px, 2.35, -4.5);
        group.add(col);
      }
      const arch = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 0.35), MAT.teak);
      arch.position.set(0, 3.85, -4.5);
      group.add(arch);

      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 0.6), MAT.darkWood);
      desk.position.set(-0.9, 1.45, -2.5);
      group.add(desk);

      // Detailed Passenger Ferry Boat (animated docking!)
      const ferryBoat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 7.2), MAT.whiteStucco);
      hull.position.set(0, 0.35, 0);
      ferryBoat.add(hull);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 3.6), MAT.velvetNavy);
      cabin.position.set(0, 1.35, -0.8);
      ferryBoat.add(cabin);
      const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 3.7), MAT.glass);
      bridgeWin.position.set(0, 1.45, -0.8);
      ferryBoat.add(bridgeWin);
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 8), MAT.coralFabric);
      funnel.position.set(0, 2.2, -1.9);
      ferryBoat.add(funnel);
      ferryBoat.position.set(3.8, 0, 2.0);
      ferryBoat.userData.baseX = 3.8;
      ferryBoat.userData.baseZ = 2.0;
      group.add(ferryBoat);
      animatedParts.ferryBoat = ferryBoat;

      walkableZones.push({ minX: -1.9, maxX: 1.9, minZ: -6.5, maxZ: 6.5, yStart: 0.98, yEnd: 0.98 });
      stations.push({ type: 'desk', localPos: new THREE.Vector3(0.2, 0.98, -2.5), facingYaw: -Math.PI / 2 });
      break;
    }

    // =========================================================
    // 4. PROPER FURNISHED BEDROOMS & PENTHOUSE
    // =========================================================
    case 'beach_cabana': {
      // Raised walkable teak floor + entry steps
      const platform = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.36, 5.4), MAT.teak);
      platform.position.set(0, 0.25, 0);
      group.add(platform);

      const step = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.6), MAT.teak);
      step.position.set(0, 0.12, 2.9);
      group.add(step);

      // Four corner bamboo posts
      for (const px of [-2.3, 2.3]) {
        for (const pz of [-2.4, 2.4]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.8, 6), MAT.bamboo);
          post.position.set(px, 1.8, pz);
          group.add(post);
        }
      }

      // Back wall + Two Side Walls with wide open windows (open front doorway for walk-in!)
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.5, 0.14), MAT.creamWall);
      backWall.position.set(0, 1.65, -2.4);
      group.add(backWall);

      for (const sx of [-2.3, 2.3]) {
        const lowerSide = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 4.8), MAT.creamWall);
        lowerSide.position.set(sx, 0.93, 0);
        group.add(lowerSide);
        const upperSide = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 4.8), MAT.creamWall);
        upperSide.position.set(sx, 2.65, 0);
        group.add(upperSide);
      }

      // PROPER BEDROOM INTERIOR: Full King Bed, Nightstands, Lamps, Wardrobe, Wall Art!
      const bed = createBedAssembly(MAT.coralFabric);
      bed.position.set(-0.2, 0.43, -0.75);
      group.add(bed);

      // Dresser / Wardrobe in corner
      const dresser = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.15, 0.55), MAT.darkWood);
      dresser.position.set(1.65, 1.0, -1.9);
      group.add(dresser);

      // Potted plant near entrance
      const plant = createPlanter();
      plant.position.set(-1.75, 0.43, 1.85);
      group.add(plant);

      // Steep Palm Thatch Roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.1, 2.0, 4), MAT.thatch);
      roof.position.set(0, 4.05, 0);
      roof.rotation.y = Math.PI / 4;
      group.add(roof);

      walkableZones.push({ minX: -2.5, maxX: 2.5, minZ: -2.6, maxZ: 2.8, yStart: 0.43, yEnd: 0.43 });
      stations.push({ type: 'bed', localPos: new THREE.Vector3(-0.2, 0.43, 0.9), facingYaw: Math.PI });
      break;
    }

    case 'overwater_bungalow': {
      // Stilts in turquoise lagoon
      for (const x of [-2.6, 2.6]) {
        for (const z of [-3.2, 3.2]) {
          const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.5, 6), MAT.darkWood);
          stilt.position.set(x, -0.6, z);
          group.add(stilt);
        }
      }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.35, 7.2), MAT.teak);
      deck.position.set(0, 1.1, 0);
      group.add(deck);

      // Glass lagoon floor panel on outer sun deck
      const glassFloor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.2), MAT.glass);
      glassFloor.position.set(0, 1.29, 2.4);
      group.add(glassFloor);

      // Two deck sun loungers
      for (const lx of [-1.9, 1.9]) {
        const lounger = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.25, 1.75), MAT.whiteLinen);
        lounger.position.set(lx, 1.40, 2.3);
        group.add(lounger);
      }

      // Open walk-in villa suite walls (back wall + half side walls + glass front framing)
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 0.16), MAT.whiteStucco);
      backWall.position.set(0, 2.55, -3.1);
      group.add(backWall);

      for (const sx of [-2.6, 2.6]) {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 4.4), MAT.whiteStucco);
        sideWall.position.set(sx, 2.55, -0.9);
        group.add(sideWall);
      }

      // Front glass frames leaving center 2.4m wide open doorway
      for (const gx of [-1.9, 1.9]) {
        const glassPanel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.5, 0.1), MAT.glass);
        glassPanel.position.set(gx, 2.55, 1.3);
        group.add(glassPanel);
      }

      // Canopy Four-Poster King Bed inside!
      const bed = createBedAssembly(MAT.tealFabric);
      bed.position.set(-0.4, 1.28, -1.6);
      group.add(bed);

      for (const px of [-1.28, 0.48]) {
        for (const pz of [-2.65, -0.55]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.1, 6), MAT.darkWood);
          post.position.set(px, 2.35, pz);
          group.add(post);
        }
      }

      // Vanity & Lounge Sofa
      const vanity = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.5), MAT.teak);
      vanity.position.set(1.75, 1.70, -2.6);
      group.add(vanity);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.1, 4), MAT.thatch);
      roof.position.set(0, 4.85, -0.9);
      roof.rotation.y = Math.PI / 4;
      group.add(roof);

      walkableZones.push({ minX: -3.1, maxX: 3.1, minZ: -3.5, maxZ: 3.6, yStart: 1.28, yEnd: 1.28 });
      stations.push({ type: 'bed', localPos: new THREE.Vector3(-0.4, 1.28, 0.1), facingYaw: Math.PI });
      break;
    }

    case 'grand_hotel_wing': {
      // Majestic 3-Story Walk-in Grand Hotel with Lobby, Reception, Chandelier, Stair, & Furnished Suites
      const foundation = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.5, 10.0), MAT.marble);
      foundation.position.set(0, 0.25, 0);
      group.add(foundation);

      // Ground Floor Columns & Open Arch Entryway
      for (const cx of [-5.5, -2.2, 2.2, 5.5]) {
        for (const cz of [-4.4, 4.4]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 3.5, 10), MAT.marble);
          col.position.set(cx, 2.25, cz);
          group.add(col);
        }
      }

      // Back Lobby Wall
      const lobbyBack = new THREE.Mesh(new THREE.BoxGeometry(11.6, 3.5, 0.25), MAT.creamWall);
      lobbyBack.position.set(0, 2.25, -4.4);
      group.add(lobbyBack);

      // Reception Check-in Desk + Brass Chandelier + Velvet Lounge Sofas
      const recDesk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.05, 0.8), MAT.darkWood);
      recDesk.position.set(-2.5, 1.02, -2.4);
      group.add(recDesk);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), MAT.gold);
      bell.position.set(-1.6, 1.62, -2.3);
      group.add(bell);

      const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.75, 0.95), MAT.velvetNavy);
      sofa.position.set(1.8, 0.87, 1.2);
      group.add(sofa);

      const chandelier = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), MAT.lampGlow);
      chandelier.position.set(-0.5, 3.5, 0);
      group.add(chandelier);

      // Walkable Staircase up to Level 2 Balcony (right side)
      const stairRamp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 6.2), MAT.teak);
      stairRamp.position.set(4.1, 2.2, -0.5);
      stairRamp.rotation.x = 0.52;
      group.add(stairRamp);

      // Level 2 Floor Slab (with open stairwell cutout on right x > 3.0)
      const floor2Slab = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.3, 9.2), MAT.marble);
      floor2Slab.position.set(-1.5, 3.9, 0);
      group.add(floor2Slab);

      // Level 2 Furnished Bedrooms inside panoramic glass windows!
      const suiteBed1 = createBedAssembly(MAT.tealFabric);
      suiteBed1.position.set(-3.0, 4.05, -1.5);
      group.add(suiteBed1);
      const suiteBed2 = createBedAssembly(MAT.coralFabric);
      suiteBed2.position.set(1.2, 4.05, -1.5);
      group.add(suiteBed2);

      // Glass curtain walls & Balcony railings on Level 2 & 3
      const glassL2 = new THREE.Mesh(new THREE.BoxGeometry(11.4, 3.0, 8.6), MAT.glass);
      glassL2.position.set(0, 5.4, 0);
      group.add(glassL2);

      const floor3Slab = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.35, 8.8), MAT.marble);
      floor3Slab.position.set(0, 7.0, 0);
      group.add(floor3Slab);

      const floor3Core = new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.8, 7.2), MAT.whiteStucco);
      floor3Core.position.set(0, 8.4, 0);
      group.add(floor3Core);

      const crownRoof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 2.4, 4), MAT.thatch);
      crownRoof.position.set(0, 11.0, 0);
      crownRoof.rotation.y = Math.PI / 4;
      group.add(crownRoof);

      walkableZones.push({ minX: -6.0, maxX: 6.0, minZ: -4.8, maxZ: 4.8, yStart: 0.5, yEnd: 0.5 });
      walkableZones.push({ minX: 3.1, maxX: 5.1, minZ: -3.2, maxZ: 2.6, yStart: 4.05, yEnd: 0.5, slopeAxis: 'z' });
      walkableZones.push({ minX: -5.8, maxX: 2.9, minZ: -4.4, maxZ: 4.4, yStart: 4.05, yEnd: 4.05 });
      stations.push({ type: 'desk', localPos: new THREE.Vector3(-2.5, 0.5, -1.4), facingYaw: 0 });
      stations.push({ type: 'bed', localPos: new THREE.Vector3(-3.0, 4.05, 0.2), facingYaw: Math.PI });
      break;
    }

    case 'presidential_penthouse': {
      // TOWERING 5-STORY WALKABLE SKY PENTHOUSE (Goes all the way up to 17.5m + 21m golden spire!)
      // Footprint: 11.5m x 10.5m
      const FLOOR_H = 3.4;

      // Ground Foundation
      const base = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.45, 10.6), MAT.marble);
      base.position.set(0, 0.225, 0);
      group.add(base);

      // Panoramic Glass Elevator Shaft on Far-Left Back Corner (runs all 5 levels!)
      const shaftFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, FLOOR_H * 4 + 0.6, 1.8), MAT.glass);
      shaftFrame.position.set(-4.3, FLOOR_H * 2 + 0.45, -3.5);
      group.add(shaftFrame);
      for (const ex of [-5.15, -3.45]) {
        for (const ez of [-4.35, -2.65]) {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.12, FLOOR_H * 4 + 0.8, 0.12), MAT.gold);
          pillar.position.set(ex, FLOOR_H * 2 + 0.45, ez);
          group.add(pillar);
        }
      }
      const elevatorCab = new THREE.Group();
      const cabBox = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.4, 1.45), MAT.gold);
      const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.9, 1.50), MAT.lampGlow);
      elevatorCab.add(cabBox, cabGlass);
      elevatorCab.position.set(-4.3, 1.7, -3.5);
      group.add(elevatorCab);
      animatedParts.elevatorCab = elevatorCab;

      // Ground Floor Lobby Columns & Furnished Reception
      for (const cx of [-5.2, -1.8, 1.8, 5.2]) {
        for (const cz of [-4.6, 4.6]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, FLOOR_H, 10), MAT.marble);
          col.position.set(cx, 0.45 + FLOOR_H / 2, cz);
          group.add(col);
        }
      }
      const lobbyDesk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 0.7), MAT.darkWood);
      lobbyDesk.position.set(-2.0, 0.97, -1.8);
      group.add(lobbyDesk);
      const lobbySofa = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.72, 0.95), MAT.velvetNavy);
      lobbySofa.position.set(-2.0, 0.81, 1.6);
      group.add(lobbySofa);

      // Walkable Grand Golden-Edged Staircase Flights (4 stacked non-overlapping switchback flights all the way to Roof!)
      // Flight 1 (Ground 0.45 -> Level 2 3.85): x [2.9..4.7], z +3.4 -> -2.4
      // Flight 2 (Level 2 3.85 -> Level 3 7.25): x [0.9..2.7], z -2.4 -> +3.4
      // Flight 3 (Level 3 7.25 -> Level 4 10.65): x [2.9..4.7], z +3.4 -> -2.4
      // Flight 4 (Level 4 10.65 -> Roof 14.05): x [0.9..2.7], z -2.4 -> +3.4
      const stairConfigs = [
        { x: 3.8, yBase: 0.45, dir: -1 },
        { x: 1.8, yBase: 0.45 + FLOOR_H, dir: 1 },
        { x: 3.8, yBase: 0.45 + FLOOR_H * 2, dir: -1 },
        { x: 1.8, yBase: 0.45 + FLOOR_H * 3, dir: 1 },
      ];

      for (const sc of stairConfigs) {
        const stepsCount = 12;
        for (let s = 0; s < stepsCount; s++) {
          const frac = (s + 0.5) / stepsCount;
          const stepY = sc.yBase + frac * FLOOR_H;
          const stepZ = sc.dir === -1 ? 3.4 - frac * 5.8 : -2.4 + frac * 5.8;
          const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.24, 0.52), MAT.teak);
          stepMesh.position.set(sc.x, stepY - 0.12, stepZ);
          group.add(stepMesh);
        }
        // Golden stair handrail
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 6.7), MAT.gold);
        rail.position.set(sc.x - 0.85, sc.yBase + FLOOR_H / 2 + 0.8, 0.5);
        rail.rotation.x = sc.dir === -1 ? 0.53 : -0.53;
        group.add(rail);
      }

      // Multi-Story Structural Floors & Architectural Glass Facades
      for (let lvl = 1; lvl <= 4; lvl++) {
        const floorY = 0.45 + lvl * FLOOR_H;

        // Main Suite Floor Slab (covers left & center area x: -5.4..0.8 so stairwell x:0.8..4.8 stays clear!)
        const mainSlab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.28, 9.8), MAT.marble);
        mainSlab.position.set(-2.3, floorY - 0.14, 0);
        group.add(mainSlab);

        // North & South Stair Landings connecting stairs across x: 0.8..5.0
        const northLanding = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.28, 2.3), MAT.marble);
        northLanding.position.set(3.0, floorY - 0.14, -3.65);
        group.add(northLanding);

        const southLanding = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.28, 1.5), MAT.marble);
        southLanding.position.set(3.0, floorY - 0.14, 4.15);
        group.add(southLanding);

        // Exterior Architectural Gold-Trimmed Balcony Rings + Glass Walls (except roof lvl 4)
        const trimRing = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.22, 10.4), MAT.gold);
        trimRing.position.set(0, floorY - 0.1, 0);
        group.add(trimRing);

        if (lvl < 4) {
          // Wraparound architectural glass walls (leaving front/stairway open internally)
          const leftGlass = new THREE.Mesh(new THREE.BoxGeometry(0.14, FLOOR_H - 0.2, 9.8), MAT.glass);
          leftGlass.position.set(-5.4, floorY + FLOOR_H / 2, 0);
          group.add(leftGlass);

          const rightGlass = new THREE.Mesh(new THREE.BoxGeometry(0.14, FLOOR_H - 0.2, 9.8), MAT.glass);
          rightGlass.position.set(5.2, floorY + FLOOR_H / 2, 0);
          group.add(rightGlass);

          const backGlass = new THREE.Mesh(new THREE.BoxGeometry(10.6, FLOOR_H - 0.2, 0.14), MAT.glass);
          backGlass.position.set(-0.1, floorY + FLOOR_H / 2, -4.8);
          group.add(backGlass);
        }

        // Corner golden structural columns per floor
        if (lvl < 4) {
          for (const cx of [-5.4, 5.2]) {
            for (const cz of [-4.8, 4.8]) {
              const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, FLOOR_H, 8), MAT.gold);
              col.position.set(cx, floorY + FLOOR_H / 2, cz);
              group.add(col);
            }
          }
        }
      }

      // Level 2 Furnishings (y = 3.85): Sky Lounge & Executive Bar
      const lvl2Y = 0.45 + FLOOR_H;
      const skyBar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 0.7), MAT.darkWood);
      skyBar.position.set(-2.2, lvl2Y + 0.5, -2.6);
      group.add(skyBar);
      const lvl2Sofa = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.7, 1.0), MAT.coralFabric);
      lvl2Sofa.position.set(-2.0, lvl2Y + 0.35, 1.5);
      group.add(lvl2Sofa);

      // Level 3 Furnishings (y = 7.25): Executive Dining Salon
      const lvl3Y = 0.45 + FLOOR_H * 2;
      const diningSet = createDiningTableSet();
      diningSet.position.set(-2.0, lvl3Y, 0);
      diningSet.scale.setScalar(1.25);
      group.add(diningSet);

      // Level 4 Furnishings (y = 10.65): MASTER PRESIDENTIAL BEDROOM & PRIVATE KITCHEN!
      const lvl4Y = 0.45 + FLOOR_H * 3;
      const masterBed = createBedAssembly(MAT.velvetNavy);
      masterBed.position.set(-2.3, lvl4Y, -1.6);
      group.add(masterBed);
      const privateStove = createChefStoveStation(false);
      privateStove.group.position.set(-2.4, lvl4Y, 2.8);
      group.add(privateStove.group);
      animatedParts.steamPuffs = privateStove.steamPuffs;

      // LEVEL 5 / ROOFTOP SKY TERRACE (y = 14.05!): Infinity Pool, Sun Loungers, Champagne Bar & Architectural Crown!
      const roofY = 0.45 + FLOOR_H * 4;
      // Glass safety railings around rooftop perimeter
      for (const [rx, rz, rw, rd] of [
        [-2.3, -4.85, 6.4, 0.1],
        [-2.3, 4.85, 6.4, 0.1],
        [-5.45, 0, 0.1, 9.8],
        [5.15, 0, 0.1, 9.8],
      ]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(rw, 1.05, rd), MAT.glass);
        rail.position.set(rx, roofY + 0.52, rz);
        group.add(rail);
      }

      // Rooftop Infinity Sky Pool!
      const skyPoolRim = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.55, 5.2), MAT.marble);
      skyPoolRim.position.set(-2.3, roofY + 0.27, -1.2);
      group.add(skyPoolRim);
      const skyPoolWater = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.52, 4.6), MAT.poolWater);
      skyPoolWater.position.set(-2.3, roofY + 0.34, -1.2);
      group.add(skyPoolWater);

      // Rooftop Sun Loungers + Pergola Canopy + Crown Spire reaching 21m!
      for (const lx of [-3.6, -1.2]) {
        const lounger = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.28, 1.85), MAT.whiteLinen);
        lounger.position.set(lx, roofY + 0.14, 2.9);
        group.add(lounger);
      }

      const pergolaBeam = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.3, 3.2), MAT.gold);
      pergolaBeam.position.set(0, roofY + 3.4, -3.2);
      group.add(pergolaBeam);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.75, 4.2, 8), MAT.gold);
      spire.position.set(0, roofY + 5.5, -3.2);
      group.add(spire);

      // Register Walkable Floors & 4 Staircase Ramps so player can walk ALL THE WAY TO THE TOP!
      walkableZones.push({ minX: -5.8, maxX: 5.8, minZ: -5.2, maxZ: 5.2, yStart: 0.45, yEnd: 0.45 });
      for (let lvl = 1; lvl <= 4; lvl++) {
        const fy = 0.45 + lvl * FLOOR_H;
        walkableZones.push({ minX: -5.5, maxX: 0.9, minZ: -4.9, maxZ: 4.9, yStart: fy, yEnd: fy });
        walkableZones.push({ minX: 0.8, maxX: 5.2, minZ: -4.9, maxZ: -2.4, yStart: fy, yEnd: fy });
        walkableZones.push({ minX: 0.8, maxX: 5.2, minZ: 3.3, maxZ: 4.9, yStart: fy, yEnd: fy });
      }
      // 4 Stair Ramps
      walkableZones.push({ minX: 2.9, maxX: 4.7, minZ: -2.5, maxZ: 3.5, yStart: 0.45 + FLOOR_H, yEnd: 0.45, slopeAxis: 'z' });
      walkableZones.push({ minX: 0.9, maxX: 2.7, minZ: -2.5, maxZ: 3.5, yStart: 0.45 + FLOOR_H, yEnd: 0.45 + FLOOR_H * 2, slopeAxis: 'z' });
      walkableZones.push({ minX: 2.9, maxX: 4.7, minZ: -2.5, maxZ: 3.5, yStart: 0.45 + FLOOR_H * 3, yEnd: 0.45 + FLOOR_H * 2, slopeAxis: 'z' });
      walkableZones.push({ minX: 0.9, maxX: 2.7, minZ: -2.5, maxZ: 3.5, yStart: 0.45 + FLOOR_H * 3, yEnd: 0.45 + FLOOR_H * 4, slopeAxis: 'z' });

      stations.push({ type: 'desk', localPos: new THREE.Vector3(-2.0, 0.45, -0.8), facingYaw: 0 });
      stations.push({ type: 'bed', localPos: new THREE.Vector3(-2.3, lvl4Y, 0.1), facingYaw: Math.PI });
      stations.push({ type: 'stove', localPos: new THREE.Vector3(-2.4, lvl4Y, 1.8), facingYaw: 0 });
      break;
    }

    // =========================================================
    // 5. DINING & BARS (WITH REAL STOVES, POTS, BOTTLES, TABLES!)
    // =========================================================
    case 'tiki_bar': {
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.35, 10), MAT.teak);
      deck.position.set(0, 0.175, 0);
      group.add(deck);

      // Bamboo Support Pillars
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.8, 6), MAT.bamboo);
        post.position.set(Math.cos(a) * 3.4, 1.7, Math.sin(a) * 3.4);
        group.add(post);
      }

      // Semi-circular Bar Counter
      const counter = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 2.3, 1.05, 10, 1, false, -Math.PI * 0.65, Math.PI * 1.3),
        MAT.darkWood
      );
      counter.position.set(0, 0.87, 0);
      group.add(counter);

      // Bottle Shelf & Colorful Bottles behind bar
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.35), MAT.teak);
      shelf.position.set(0, 1.05, -1.65);
      group.add(shelf);
      const bottleColors = [0x22c55e, 0xf59e0b, 0xef4444, 0x38bdf8, 0xa855f7];
      for (let b = 0; b < 5; b++) {
        const bMat = new THREE.MeshStandardMaterial({ color: bottleColors[b], roughness: 0.15 });
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 6), bMat);
        bottle.position.set(-0.7 + b * 0.35, 1.9, -1.65);
        group.add(bottle);
      }

      // Flat-top Coconut Grill Stove beside counter
      const { group: grill, steamPuffs } = createChefStoveStation(false);
      grill.scale.setScalar(0.72);
      grill.position.set(1.15, 0.35, -0.8);
      group.add(grill);
      animatedParts.steamPuffs = steamPuffs;

      // 4 Barstools around front
      for (let s = 0; s < 4; s++) {
        const a = -Math.PI * 0.45 + (s / 3) * Math.PI * 0.9;
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.72, 8), MAT.bamboo);
        stool.position.set(Math.sin(a) * 2.9, 0.71, Math.cos(a) * 2.9);
        group.add(stool);
      }

      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 1.75, 10), MAT.thatch);
      roof.position.set(0, 3.85, 0);
      group.add(roof);

      walkableZones.push({ minX: -3.8, maxX: 3.8, minZ: -3.8, maxZ: 3.8, yStart: 0.35, yEnd: 0.35 });
      stations.push({ type: 'bar', localPos: new THREE.Vector3(-0.3, 0.35, 0.2), facingYaw: 0 });
      break;
    }

    case 'sunset_lounge': {
      // Gourmet Open-Air Restaurant with Commercial 4-Burner Stove, Range Hood, Prep Island, & 4 Dining Tables!
      const terrace = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.4, 8.6), MAT.sandstone);
      terrace.position.set(0, 0.2, 0);
      group.add(terrace);

      // Corner Timber Columns & Open Pergola Roof
      for (const px of [-3.9, 3.9]) {
        for (const pz of [-3.8, 3.8]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.2, 8), MAT.teak);
          post.position.set(px, 2.0, pz);
          group.add(post);
        }
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.22, 8.4), MAT.thatch);
      roof.position.set(0, 3.7, 0);
      group.add(roof);

      // OPEN CHEF KITCHEN ZONE (Back Left/Center)
      const { group: stove, steamPuffs } = createChefStoveStation(true);
      stove.position.set(-1.8, 0.4, -2.9);
      group.add(stove);
      animatedParts.steamPuffs = steamPuffs;

      // Butcher Block Prep Island in front of stove
      const island = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.75), MAT.teak);
      island.position.set(-1.8, 0.85, -1.2);
      group.add(island);
      const cuttingBoard = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.45), MAT.creamWall);
      cuttingBoard.position.set(-2.1, 1.32, -1.2);
      group.add(cuttingBoard);

      // Wine Rack Wall
      const wineRack = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.1, 0.45), MAT.darkWood);
      wineRack.position.set(2.2, 1.45, -3.2);
      group.add(wineRack);

      // 3 Candlelit Dining Tables
      for (const [tx, tz] of [
        [-2.2, 1.8],
        [1.8, 1.8],
        [2.0, -0.8],
      ]) {
        const table = createDiningTableSet();
        table.position.set(tx, 0.4, tz);
        group.add(table);
      }

      walkableZones.push({ minX: -4.4, maxX: 4.4, minZ: -4.3, maxZ: 4.3, yStart: 0.4, yEnd: 0.4 });
      stations.push({ type: 'stove', localPos: new THREE.Vector3(-1.8, 0.4, -2.05), facingYaw: Math.PI });
      break;
    }

    // =========================================================
    // 6. POOLS, LEISURE & MASSIVE ATTRACTIONS
    // =========================================================
    case 'snorkeling_pier': {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.3, 9.2), MAT.teak);
      pier.position.set(0, 0.6, 0);
      group.add(pier);
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 0.4), MAT.darkWood);
      rack.position.set(-1.0, 1.4, -2.0);
      group.add(rack);
      const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.0, 0.1), MAT.steel);
      ladder.position.set(0, -0.35, 4.5);
      group.add(ladder);
      walkableZones.push({ minX: -1.9, maxX: 1.9, minZ: -4.6, maxZ: 4.6, yStart: 0.75, yEnd: 0.75 });
      break;
    }

    case 'tennis_court': {
      // Stone curb + green tournament outer run-off apron + blue playing court
      const curb = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.14, 8.6), MAT.stonePaving);
      curb.position.set(0, 0.07, 0);
      group.add(curb);

      const outerApron = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.18, 8.0), MAT.emeraldFelt);
      outerApron.position.set(0, 0.09, 0);
      group.add(outerApron);

      const court = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.21, 5.8), MAT.blueCourt);
      court.position.set(0, 0.105, 0);
      group.add(court);

      // Crisp raised white painted court lines (y=0.222, proud of court top y=0.21 to avoid z-fighting)
      const lineY = 0.222;
      const lineH = 0.024;
      const lineW = 0.085;
      const addLine = (lx: number, lz: number, sizeX: number, sizeZ: number) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(sizeX, lineH, sizeZ), MAT.courtWhiteLine);
        line.position.set(lx, lineY, lz);
        line.name = 'tennis_court_line';
        group.add(line);
      };

      // Doubles sidelines (z = ±2.45) & Singles sidelines (z = ±1.85)
      addLine(0, -2.45, 9.18, lineW);
      addLine(0, 2.45, 9.18, lineW);
      addLine(0, -1.85, 9.18, lineW);
      addLine(0, 1.85, 9.18, lineW);

      // Two Baselines (x = ±4.55) + center baseline hash marks
      addLine(-4.55, 0, 0.1, 4.985);
      addLine(4.55, 0, 0.1, 4.985);
      addLine(-4.42, 0, 0.22, lineW);
      addLine(4.42, 0, 0.22, lineW);

      // Two Service lines (x = ±2.35 spanning between singles sidelines)
      addLine(-2.35, 0, lineW, 3.78);
      addLine(2.35, 0, lineW, 3.78);

      // Center Service line dividing left/right service boxes
      addLine(0, 0, 4.70, lineW);

      // Steel Net Posts + Mesh + Crisp White Net Top Tape & Center Strap
      for (const pz of [-2.85, 2.85]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 8), MAT.darkSteel);
        post.position.set(0, 0.65, pz);
        group.add(post);
      }
      const netBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.78, 5.64), MAT.netMesh);
      netBody.position.set(0, 0.62, 0);
      group.add(netBody);

      const netTape = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 5.68), MAT.courtWhiteLine);
      netTape.position.set(0, 1.03, 0);
      group.add(netTape);

      const centerStrap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.84, 0.09), MAT.courtWhiteLine);
      centerStrap.position.set(0, 0.64, 0);
      group.add(centerStrap);

      // Sideline teak benches
      for (const bx of [-2.2, 2.2]) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 0.55), MAT.teak);
        bench.position.set(bx, 0.36, -3.45);
        group.add(bench);
      }

      walkableZones.push({ minX: -5.8, maxX: 5.8, minZ: -4.0, maxZ: 4.0, yStart: 0.21, yEnd: 0.21 });
      break;
    }

    case 'infinity_pool': {
      const patio = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.5, 6.8), MAT.sandstone);
      patio.position.set(0, 0.25, 0);
      group.add(patio);
      const pool = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.48, 4.2), MAT.poolWater);
      pool.position.set(0, 0.35, 0.5);
      group.add(pool);
      const glassEdge = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.52, 0.12), MAT.glass);
      glassEdge.position.set(0, 0.42, 2.65);
      group.add(glassEdge);
      for (const lx of [-2.2, 0, 2.2]) {
        const lounger = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 1.65), MAT.whiteLinen);
        lounger.position.set(lx, 0.62, -2.2);
        group.add(lounger);
      }
      walkableZones.push({ minX: -4.4, maxX: 4.4, minZ: -3.4, maxZ: 3.4, yStart: 0.5, yEnd: 0.5 });
      break;
    }

    case 'wellness_spa': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.4, 8.6), MAT.sandstone);
      base.position.set(0, 0.2, 0);
      group.add(base);
      const spaPool = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.42, 14), MAT.poolWater);
      spaPool.position.set(0, 0.38, -1.4);
      group.add(spaPool);

      // Two Massage Tables with rolled white towels
      for (const mx of [-2.6, 2.6]) {
        const table = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.75, 2.1), MAT.teak);
        table.position.set(mx, 0.77, 1.5);
        group.add(table);
        const mat = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 1.98), MAT.whiteLinen);
        mat.position.set(mx, 1.2, 1.5);
        group.add(mat);
        const towelRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 8), MAT.tealFabric);
        towelRoll.rotation.z = Math.PI / 2;
        towelRoll.position.set(mx, 1.32, 0.8);
        group.add(towelRoll);
      }

      const roof1 = new THREE.Mesh(new THREE.ConeGeometry(5.6, 1.5, 4), MAT.darkWood);
      roof1.position.set(0, 3.6, 0);
      roof1.rotation.y = Math.PI / 4;
      group.add(roof1);
      walkableZones.push({ minX: -4.3, maxX: 4.3, minZ: -4.3, maxZ: 4.3, yStart: 0.4, yEnd: 0.4 });
      break;
    }

    case 'water_park': {
      const poolBase = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.5, 11.5), MAT.sandstone);
      poolBase.position.set(0, 0.25, 0);
      group.add(poolBase);
      const splashPool = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.48, 8.8), MAT.poolWater);
      splashPool.position.set(0, 0.38, 0);
      group.add(splashPool);

      const tower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 8.0, 3.2), MAT.whiteStucco);
      tower.position.set(-4.4, 4.2, -3.4);
      group.add(tower);

      const slideMat1 = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.2 });
      const slide1 = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.42, 8, 18, Math.PI * 1.2), slideMat1);
      slide1.rotation.x = Math.PI / 2.4;
      slide1.position.set(-1.0, 3.5, -0.5);
      group.add(slide1);

      const slideMat2 = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.2 });
      const slide2 = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.42, 8, 18, Math.PI * 1.15), slideMat2);
      slide2.rotation.x = -Math.PI / 2.3;
      slide2.position.set(0.6, 4.2, 0.6);
      group.add(slide2);

      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.65, 1.3, 8), slideMat2);
      bucket.position.set(-4.4, 8.8, -3.4);
      group.add(bucket);
      animatedParts.tippingBucket = bucket;
      break;
    }

    case 'superyacht_marina': {
      const pontoon = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 14.5), MAT.darkWood);
      pontoon.position.set(0, 0.7, 0);
      group.add(pontoon);

      const yacht = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.7, 10.2), MAT.marble);
      hull.position.set(4.8, 0.65, 0);
      yacht.add(hull);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.5, 5.2), MAT.marble);
      bridge.position.set(4.8, 1.95, -0.6);
      yacht.add(bridge);
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.75, 0.25), MAT.glass);
      windshield.position.set(4.8, 2.15, 2.0);
      yacht.add(windshield);
      const sunDeckRoof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 3.2), MAT.gold);
      sunDeckRoof.position.set(4.8, 3.3, -1.0);
      yacht.add(sunDeckRoof);
      group.add(yacht);

      walkableZones.push({ minX: -2.6, maxX: 2.6, minZ: -7.2, maxZ: 7.2, yStart: 0.9, yEnd: 0.9 });
      break;
    }

    case 'casino_nightclub': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.1, 0.55, 8), MAT.marble);
      base.position.set(0, 0.275, 0);
      group.add(base);

      // Emerald Roulette & Blackjack Gaming Tables inside!
      for (const [gx, gz] of [
        [-2.2, 1.4],
        [2.2, 1.4],
        [-2.2, -1.6],
      ]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.78, 8), MAT.darkWood);
        leg.position.set(gx, 0.94, gz);
        group.add(leg);
        const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 12), MAT.emeraldFelt);
        tableTop.position.set(gx, 1.36, gz);
        group.add(tableTop);
      }

      // VIP Bar + Neon Stage
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.05, 0.8), MAT.darkWood);
      bar.position.set(2.0, 1.07, -2.5);
      group.add(bar);
      const neonRing = new THREE.Mesh(new THREE.TorusGeometry(5.9, 0.12, 8, 16), MAT.neonPink);
      neonRing.rotation.x = Math.PI / 2;
      neonRing.position.set(0, 4.1, 0);
      group.add(neonRing);

      const glassHall = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 6.0, 3.6, 8, 1, true), MAT.glass);
      glassHall.position.set(0, 2.35, 0);
      group.add(glassHall);
      const goldRoof = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.5, 8), MAT.gold);
      goldRoof.position.set(0, 4.3, 0);
      group.add(goldRoof);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.6, 8), MAT.gold);
      spire.position.set(0, 6.2, 0);
      group.add(spire);

      walkableZones.push({ minX: -6.0, maxX: 6.0, minZ: -6.0, maxZ: 6.0, yStart: 0.55, yEnd: 0.55 });
      stations.push({ type: 'bar', localPos: new THREE.Vector3(2.0, 0.55, -1.6), facingYaw: 0 });
      break;
    }

    case 'tiki_torch': {
      const fireFlames: THREE.Mesh[] = [];
      for (const x of [-0.65, 0.65]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), MAT.darkWood);
        pole.position.set(x, 1.2, 0);
        group.add(pole);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 6), MAT.burnerGlow);
        flame.position.set(x, 2.55, 0);
        group.add(flame);
        fireFlames.push(flame);
      }
      animatedParts.fireFlames = fireFlames;
      break;
    }

    case 'sun_lounger_deck': {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 2.8), MAT.teak);
      deck.position.set(0, 0.08, 0);
      group.add(deck);
      for (const lx of [-0.7, 0.7]) {
        const lounger = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 1.85), MAT.whiteLinen);
        lounger.position.set(lx, 0.28, 0);
        group.add(lounger);
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), MAT.darkWood);
      pole.position.set(0, 1.2, 0);
      group.add(pole);
      const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 8), MAT.coralFabric);
      umbrella.position.set(0, 2.35, 0);
      group.add(umbrella);
      walkableZones.push({ minX: -1.4, maxX: 1.4, minZ: -1.4, maxZ: 1.4, yStart: 0.16, yEnd: 0.16 });
      break;
    }

    default: {
      const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), MAT.teak);
      box.position.y = 1;
      group.add(box);
      break;
    }
  }

  return { group, walkableZones, stations, animatedParts };
}
