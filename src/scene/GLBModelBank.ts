import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface LoadedGLBSet {
  fpArms: THREE.Group;
  palmTrees: [THREE.Group, THREE.Group, THREE.Group];
  palmTreeLods: [THREE.Group, THREE.Group, THREE.Group];
  rocks: {
    small: THREE.Group;
    medium: THREE.Group;
    large: THREE.Group;
    flat: THREE.Group;
    cliff: THREE.Group;
  };
  wreckage: {
    fuselage: THREE.Group;
    wing: THREE.Group;
    tailFin: THREE.Group;
    seat: THREE.Group;
    suitcase: THREE.Group;
    panelDebris: THREE.Group;
  };
}

function markGLBMaterials(root: THREE.Object3D, isFirstPerson: boolean = false): void {
  root.traverse((obj) => {
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
  const loadOne = (file: string, isFP: boolean = false): Promise<THREE.Group> =>
    new Promise((resolve, reject) => {
      loader.load(
        `./assets/models/${file}`,
        (gltf) => {
          markGLBMaterials(gltf.scene, isFP);
          resolve(gltf.scene);
        },
        undefined,
        (err) => reject(err)
      );
    });

  cachedPromise = Promise.all([
    loadOne('fp_arms.glb', true),
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
    loadOne('plane_fuselage.glb'),
    loadOne('plane_wing.glb'),
    loadOne('plane_tail_fin.glb'),
    loadOne('plane_seat.glb'),
    loadOne('plane_suitcase.glb'),
    loadOne('plane_panel_debris.glb'),
  ]).then(
    ([
      fpArms,
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
      wFuse,
      wWing,
      wTail,
      wSeat,
      wSuit,
      wPanel,
    ]) => ({
      fpArms,
      palmTrees: [p1, p2, p3],
      palmTreeLods: [p1Lod, p2Lod, p3Lod],
      rocks: {
        small: rSmall,
        medium: rMed,
        large: rLarge,
        flat: rFlat,
        cliff: rCliff,
      },
      wreckage: {
        fuselage: wFuse,
        wing: wWing,
        tailFin: wTail,
        seat: wSeat,
        suitcase: wSuit,
        panelDebris: wPanel,
      },
    })
  );

  return cachedPromise;
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
  return wrapper;
}
