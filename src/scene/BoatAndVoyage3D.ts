// 3D Procedural Boat Slipway Dock, 4-Stage Escape Vessel, Stopover Islets,
// and Port Solis Harbor Skyline for Acts 4 & 5.

import * as THREE from 'three';
import { VOYAGE, WORLD } from '../survival/config.ts';
import type { BoatBuildState, SurvivalState } from '../survival/types.ts';
import { computeSeaWeatherForLeg } from '../survival/voyage.ts';

export interface VesselMeshRecord {
  root: THREE.Group;
  hullGroup: THREE.Group;
  mastGroup: THREE.Group;
  engineGroup: THREE.Group;
  provisionsGroup: THREE.Group;
  propeller: THREE.Group;
  sailMesh: THREE.Mesh;
  bowLight: THREE.PointLight;
}

export interface BoatSlipwayRecord {
  dockGroup: THREE.Group;
  interactPos: THREE.Vector3;
  vessel: VesselMeshRecord;
}

export interface VoyageSceneController {
  root: THREE.Group;
  boatPivot: THREE.Group;
  vessel: VesselMeshRecord;
  isletGroup: THREE.Group;
  cityGroup: THREE.Group;
  wakeLeft: THREE.Mesh;
  wakeRight: THREE.Mesh;
  lighthouseBeam: THREE.Mesh;
}

export function buildEscapeVesselMesh(): VesselMeshRecord {
  const root = new THREE.Group();

  const cedarMat = new THREE.MeshStandardMaterial({ color: 0x7c4a26, roughness: 0.82 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x9e6a3e, roughness: 0.78 });
  const pitchMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 });
  const canvasMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.9 });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.38,
    metalness: 0.75,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.35,
    metalness: 0.78,
  });

  // 1. Keel & Hull Group
  const hullGroup = new THREE.Group();
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.25, 6.2), pitchMat);
  keel.position.set(0, 0.08, 0);
  hullGroup.add(keel);

  const floorDeck = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.16, 5.2), deckMat);
  floorDeck.position.set(0, 0.38, -0.1);
  hullGroup.add(floorDeck);

  // Port & Starboard curved hull bulwarks
  for (const side of [-1, 1]) {
    const gunwale = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 4.9), cedarMat);
    gunwale.position.set(side * 1.1, 0.62, -0.2);
    gunwale.rotation.z = side * -0.14;
    hullGroup.add(gunwale);

    const bowPlank = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.74, 1.85), cedarMat);
    bowPlank.position.set(side * 0.56, 0.66, 2.75);
    bowPlank.rotation.y = side * -0.56;
    hullGroup.add(bowPlank);
  }

  const bowStem = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.35, 4), cedarMat);
  bowStem.rotation.x = Math.PI / 2;
  bowStem.position.set(0, 0.58, 3.6);
  hullGroup.add(bowStem);

  const sternTransom = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.76, 0.18), cedarMat);
  sternTransom.position.set(0, 0.62, -2.62);
  hullGroup.add(sternTransom);

  for (const bz of [-0.9, 0.9]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.1, 0.42), deckMat);
    bench.position.set(0, 0.64, bz);
    hullGroup.add(bench);
  }
  root.add(hullGroup);

  // 2. Mast & Canvas Mainsail Group
  const mastGroup = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.12, 5.4, 8), cedarMat);
  mast.position.set(0, 2.95, 0.45);
  mastGroup.add(mast);

  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 3.0, 7), cedarMat);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0.15, 1.55, -0.95);
  mastGroup.add(boom);

  const crossYard = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.5, 6), cedarMat);
  crossYard.rotation.z = Math.PI / 2;
  crossYard.position.set(0, 4.95, 0.45);
  mastGroup.add(crossYard);

  const sailMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 3.25, 4, 4), canvasMat);
  sailMesh.position.set(0, 3.3, 0.55);
  sailMesh.rotation.y = 0.08;
  mastGroup.add(sailMesh);

  for (const side of [-1, 1]) {
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 4.8, 4), ropeMat);
    shroud.position.set(side * 0.54, 2.95, 0.45);
    shroud.rotation.z = side * 0.22;
    mastGroup.add(shroud);
  }
  root.add(mastGroup);

  // 3. Salvaged Outboard Engine & Helm Console
  const engineGroup = new THREE.Group();
  const motorPod = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.72, 0.52), steelMat);
  motorPod.position.set(0, 0.85, -2.88);
  engineGroup.add(motorPod);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.85, 6), steelMat);
  shaft.position.set(0, 0.35, -2.92);
  engineGroup.add(shaft);

  const propeller = new THREE.Group();
  propeller.position.set(0, -0.05, -3.02);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.03), brassMat);
    blade.rotation.z = (i / 3) * Math.PI * 2;
    propeller.add(blade);
  }
  engineGroup.add(propeller);

  const helmStand = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.92, 0.36), cedarMat);
  helmStand.position.set(0, 0.84, -1.35);
  engineGroup.add(helmStand);

  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 12), brassMat);
  wheel.position.set(0, 1.24, -1.16);
  wheel.rotation.x = 0.35;
  engineGroup.add(wheel);

  const compassHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 8), brassMat);
  compassHousing.position.set(0, 1.34, -1.35);
  engineGroup.add(compassHousing);
  root.add(engineGroup);

  // 4. Offshore Provisions, Fuel & Bow Lantern
  const provisionsGroup = new THREE.Group();
  const fuelMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.82 });
  const kegMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.55 });

  for (const side of [-0.62, 0.62]) {
    const can = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.24), fuelMat);
    can.position.set(side, 0.65, -2.1);
    provisionsGroup.add(can);
  }

  const rationCrate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.54), crateMat);
  rationCrate.position.set(-0.56, 0.65, 1.45);
  provisionsGroup.add(rationCrate);

  const waterKeg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.52, 10), kegMat);
  waterKeg.position.set(0.58, 0.72, 1.45);
  provisionsGroup.add(waterKeg);

  const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.65, 6), steelMat);
  lanternPost.position.set(0, 0.96, 3.05);
  provisionsGroup.add(lanternPost);

  const lanternBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfde047 })
  );
  lanternBulb.position.set(0, 1.32, 3.05);
  provisionsGroup.add(lanternBulb);

  const bowLight = new THREE.PointLight(0xfbbf24, 0, 14, 1.5);
  bowLight.position.set(0, 1.4, 3.1);
  provisionsGroup.add(bowLight);
  root.add(provisionsGroup);

  return {
    root,
    hullGroup,
    mastGroup,
    engineGroup,
    provisionsGroup,
    propeller,
    sailMesh,
    bowLight,
  };
}

export function syncBoatBuildMeshes(vessel: VesselMeshRecord, boat: BoatBuildState) {
  vessel.hullGroup.visible = boat.keel_hull;
  vessel.mastGroup.visible = boat.mast_sail;
  vessel.engineGroup.visible = boat.outboard_engine;
  vessel.provisionsGroup.visible = boat.nav_provisions;
  vessel.bowLight.intensity = boat.nav_provisions ? 1.8 : 0;
}

export function buildBoatSlipwayDock(
  scene: THREE.Scene,
  getTerrainHeight: (x: number, z: number) => number
): BoatSlipwayRecord {
  const dockGroup = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.88 });
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.82 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.9 });

  const baseY = Math.max(WORLD.WATER_LEVEL + 0.15, getTerrainHeight(WORLD.BOAT_DOCK_POS.x, WORLD.BOAT_DOCK_POS.z));

  // Shore signpost & tool rack on sandy approach
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 10.5), plankMat);
  pierDeck.position.set(0, WORLD.WATER_LEVEL + 0.55 - baseY, 4.2);
  dockGroup.add(pierDeck);

  // Support pilings extending into shallow reef water
  for (let pz = 0; pz <= 8.5; pz += 2.8) {
    for (const px of [-1.35, 1.35]) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.2, 7), timberMat);
      piling.position.set(px, WORLD.WATER_LEVEL + 0.15 - baseY, pz);
      dockGroup.add(piling);
    }
  }

  // Drydock slipway sign & mooring bollard at landward entrance
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.1, 6), timberMat);
  signPost.position.set(-1.6, 1.05, 0.2);
  dockGroup.add(signPost);

  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.08), plankMat);
  signBoard.position.set(-1.6, 1.85, 0.25);
  dockGroup.add(signBoard);

  const dockLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
  );
  dockLantern.position.set(1.4, WORLD.WATER_LEVEL + 1.5 - baseY, 8.8);
  dockGroup.add(dockLantern);

  const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 12), ropeMat);
  ropeCoil.rotation.x = Math.PI / 2;
  ropeCoil.position.set(1.05, WORLD.WATER_LEVEL + 0.7 - baseY, 1.8);
  dockGroup.add(ropeCoil);

  // Moor the progressively constructed Escape Vessel right alongside the pierhead
  const vessel = buildEscapeVesselMesh();
  vessel.root.position.set(3.1, WORLD.WATER_LEVEL - baseY + 0.08, 6.2);
  vessel.root.rotation.y = Math.PI * 0.08;
  dockGroup.add(vessel.root);

  dockGroup.position.set(WORLD.BOAT_DOCK_POS.x, baseY, WORLD.BOAT_DOCK_POS.z);
  scene.add(dockGroup);

  return {
    dockGroup,
    interactPos: new THREE.Vector3(WORLD.BOAT_DOCK_POS.x, baseY + 0.9, WORLD.BOAT_DOCK_POS.z + 2.5),
    vessel,
  };
}

export const VOYAGE_STAGE_ORIGIN = new THREE.Vector3(0, WORLD.WATER_LEVEL, 420);

export function buildVoyageDiorama(scene: THREE.Scene): VoyageSceneController {
  const root = new THREE.Group();
  root.position.copy(VOYAGE_STAGE_ORIGIN);
  root.visible = false;

  const boatPivot = new THREE.Group();
  const vessel = buildEscapeVesselMesh();
  syncBoatBuildMeshes(vessel, {
    keel_hull: true,
    mast_sail: true,
    outboard_engine: true,
    nav_provisions: true,
  });
  boatPivot.add(vessel.root);

  // Sea spray / hull wake ribbons
  const wakeMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
  });
  const wakeLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 6.5), wakeMat);
  wakeLeft.rotation.x = -Math.PI / 2;
  wakeLeft.rotation.z = -0.22;
  wakeLeft.position.set(-1.3, 0.08, -1.8);
  boatPivot.add(wakeLeft);

  const wakeRight = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 6.5), wakeMat);
  wakeRight.rotation.x = -Math.PI / 2;
  wakeRight.rotation.z = 0.22;
  wakeRight.position.set(1.3, 0.08, -1.8);
  boatPivot.add(wakeRight);

  root.add(boatPivot);

  // Stopover Islet silhouette (positioned ahead during stopovers / leg approaches)
  const isletGroup = new THREE.Group();
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xe2c792, roughness: 0.9 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.92, flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d6a3e, roughness: 0.75 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.88 });

  const sandbar = new THREE.Mesh(new THREE.CylinderGeometry(11, 14, 1.4, 12), sandMat);
  sandbar.position.y = 0.25;
  isletGroup.add(sandbar);

  const peak = new THREE.Mesh(new THREE.DodecahedronGeometry(4.8, 0), rockMat);
  peak.position.set(-3.2, 2.2, 1.2);
  peak.scale.set(1.2, 0.9, 1.1);
  isletGroup.add(peak);

  for (const [px, pz] of [
    [3.5, -1.5],
    [-1.5, -3.2],
  ]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 4.4, 6), trunkMat);
    trunk.position.set(px, 2.6, pz);
    isletGroup.add(trunk);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.4, 6), leafMat);
    canopy.position.set(px, 4.9, pz);
    isletGroup.add(canopy);
  }
  isletGroup.position.set(-8, 0, 26);
  isletGroup.visible = false;
  root.add(isletGroup);

  // Port Solis Mainland City Harbor Skyline (visible during Act 5 final crossing)
  const cityGroup = new THREE.Group();
  const quayMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
  const towerDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const beaconRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const beaconGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

  // Harbor seawall & channel buoys
  const seawall = new THREE.Mesh(new THREE.BoxGeometry(96, 3.2, 8), quayMat);
  seawall.position.set(0, 1.2, 0);
  cityGroup.add(seawall);

  for (const bx of [-16, 16]) {
    const buoy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 2.2, 8),
      bx < 0 ? beaconRedMat : beaconGreenMat
    );
    buoy.position.set(bx, 1.1, -24);
    cityGroup.add(buoy);
  }

  // Harbor Lighthouse + Sweeping Beam
  const lhTower = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.65, 16, 8),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 })
  );
  lhTower.position.set(-28, 8.2, -3);
  cityGroup.add(lhTower);

  const lighthouseBeam = new THREE.Mesh(
    new THREE.ConeGeometry(6.5, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfef9c3,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    })
  );
  lighthouseBeam.rotation.z = Math.PI / 2;
  lighthouseBeam.position.set(-28, 15.8, -3);
  cityGroup.add(lighthouseBeam);

  // Downtown Skyscraper Silhouettes with glowing windows
  const buildings: Array<[number, number, number, number, number]> = [
    [-34, 24, 9, 9, 10],
    [-20, 34, 10, 10, 12],
    [-7, 46, 11, 11, 14],
    [8, 52, 10, 11, 13],
    [22, 38, 10, 9, 11],
    [35, 26, 9, 9, 9],
  ];
  for (const [bx, bh, bw, bd, bz] of buildings) {
    const bldg = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), towerDarkMat);
    bldg.position.set(bx, bh / 2 + 2.5, bz);
    cityGroup.add(bldg);

    for (let wy = 7; wy < bh - 2; wy += 4.5) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.76, 1.2, 0.35), windowMat);
      strip.position.set(bx, wy + 2.5, bz - bd / 2 - 0.1);
      cityGroup.add(strip);
    }
  }

  cityGroup.position.set(0, 0, 150);
  cityGroup.visible = false;
  root.add(cityGroup);

  scene.add(root);

  return {
    root,
    boatPivot,
    vessel,
    isletGroup,
    cityGroup,
    wakeLeft,
    wakeRight,
    lighthouseBeam,
  };
}

export function updateVoyageDiorama(
  ctrl: VoyageSceneController,
  state: SurvivalState,
  delta: number,
  nowMs: number
) {
  const v = state.voyage;
  const active = v.phase !== 'docked';
  ctrl.root.visible = active;
  if (!active) return;

  const tSec = nowMs * 0.001;
  const weather =
    v.phase === 'sailing'
      ? computeSeaWeatherForLeg(v.legIndex, v.distanceNm)
      : state.weather;
  const stormAmp = v.phase === 'stopover' || v.phase === 'arrived' ? 0.25 : 0.45 + weather.wind * 0.9;

  // Buoyant wave pitching & rolling
  ctrl.boatPivot.position.y = Math.sin(tSec * 2.1) * 0.22 * stormAmp;
  ctrl.boatPivot.rotation.z = Math.sin(tSec * 1.7) * 0.065 * stormAmp;
  ctrl.boatPivot.rotation.x = Math.cos(tSec * 2.4) * 0.045 * stormAmp;

  // Outboard prop spin when motoring
  if (v.phase === 'sailing' && v.throttle === 'motor' && v.fuelPct > 0) {
    ctrl.vessel.propeller.rotation.z += delta * 24;
  } else if (v.phase === 'sailing') {
    ctrl.vessel.propeller.rotation.z += delta * 3.5;
  }

  // Wake stretch with speed
  const moving = v.phase === 'sailing';
  ctrl.wakeLeft.visible = moving;
  ctrl.wakeRight.visible = moving;
  if (moving) {
    const speedScale = v.throttle === 'motor' ? 1.35 : v.throttle === 'brace' ? 0.55 : 1.0;
    ctrl.wakeLeft.scale.y = speedScale + Math.sin(tSec * 8) * 0.08;
    ctrl.wakeRight.scale.y = speedScale + Math.cos(tSec * 8) * 0.08;
  }

  // Islet visibility during stopovers or right before landing at a stop
  const distToStop = Math.max(0, v.targetNm - v.distanceNm);
  if (v.phase === 'stopover') {
    ctrl.isletGroup.visible = true;
    ctrl.isletGroup.position.set(-10, 0, 22);
  } else if (v.phase === 'sailing' && v.legIndex < 4 && distToStop < 1.1) {
    ctrl.isletGroup.visible = true;
    ctrl.isletGroup.position.set(-10, 0, 24 + distToStop * 52);
  } else {
    ctrl.isletGroup.visible = false;
  }

  // Port Solis skyline appears during Act 5 (>= 8.5 nm) and draws near as you reach 12.0 nm
  const showCity = v.distanceNm >= VOYAGE.FINAL_ACT5_NM || v.phase === 'arrived';
  ctrl.cityGroup.visible = showCity;
  if (showCity) {
    const remaining = Math.max(0, VOYAGE.TOTAL_DISTANCE_NM - v.distanceNm);
    ctrl.cityGroup.position.z = v.phase === 'arrived' ? 38 : 40 + remaining * 36;
    ctrl.lighthouseBeam.rotation.y = tSec * 0.85;
  }
}
