import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merges static visible sub-meshes sharing a material inside `container` into one
 * mesh per unique material to cut draw calls while preserving any excluded subtrees
 * (e.g. animated gates, beacons, smoke puffs) and direct `THREE.LOD` children.
 */
export function mergeStaticMeshesByMaterial(
  container: THREE.Group,
  exclude?: ReadonlySet<THREE.Object3D>
): void {
  let hasSkinnedOrSpecial = false;
  const checkSpecial = (obj: THREE.Object3D) => {
    if (hasSkinnedOrSpecial) return;
    if (obj !== container && (!obj.visible || exclude?.has(obj))) return;
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh || (obj as THREE.InstancedMesh).isInstancedMesh) {
      hasSkinnedOrSpecial = true;
      return;
    }
    for (const ch of obj.children) checkSpecial(ch);
  };
  checkSpecial(container);
  if (hasSkinnedOrSpecial) return;

  container.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(container.matrixWorld).invert();
  const relMat = new THREE.Matrix4();

  const lodChildren: THREE.LOD[] = [];
  for (const child of container.children) {
    if (child instanceof THREE.LOD && child.visible && !exclude?.has(child)) {
      lodChildren.push(child);
    }
  }
  for (const lod of lodChildren) {
    for (const lvl of lod.levels) {
      if (lvl.object instanceof THREE.Group && !exclude?.has(lvl.object)) {
        mergeStaticMeshesByMaterial(lvl.object, exclude);
      }
    }
  }

  const lodSet = new Set<THREE.Object3D>(lodChildren);
  const buckets = new Map<
    THREE.Material,
    Array<{ geom: THREE.BufferGeometry; cast: boolean; receive: boolean }>
  >();
  const arrayMatMeshes: THREE.Mesh[] = [];
  const sourceMeshes: THREE.Mesh[] = [];

  const visitStatic = (obj: THREE.Object3D) => {
    if (obj !== container && (!obj.visible || exclude?.has(obj) || lodSet.has(obj))) return;
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      if (!mesh.geometry) return;
      if (Array.isArray(mesh.material)) {
        const cloneMesh = new THREE.Mesh(mesh.geometry.clone(), mesh.material);
        relMat.multiplyMatrices(invRoot, mesh.matrixWorld);
        cloneMesh.applyMatrix4(relMat);
        cloneMesh.castShadow = mesh.castShadow;
        cloneMesh.receiveShadow = mesh.receiveShadow;
        arrayMatMeshes.push(cloneMesh);
        sourceMeshes.push(mesh);
        return;
      }
      const mat = mesh.material;
      if (!mat) return;
      const g = mesh.geometry.clone();
      relMat.multiplyMatrices(invRoot, mesh.matrixWorld);
      g.applyMatrix4(relMat);
      let list = buckets.get(mat);
      if (!list) {
        list = [];
        buckets.set(mat, list);
      }
      list.push({ geom: g, cast: mesh.castShadow, receive: mesh.receiveShadow });
      sourceMeshes.push(mesh);
      return;
    }
    for (const ch of obj.children) {
      visitStatic(ch);
    }
  };
  visitStatic(container);

  if (buckets.size === 0 && arrayMatMeshes.length === 0) return;
  // Nothing to reduce if every bucket is already a single mesh and no flattening needed
  if (buckets.size === sourceMeshes.length && arrayMatMeshes.length === 0 && sourceMeshes.every((m) => m.parent === container)) {
    for (const entries of buckets.values()) {
      for (const e of entries) e.geom.dispose();
    }
    return;
  }

  const mergedResults: THREE.Mesh[] = [];
  let failed = false;
  for (const [mat, entries] of buckets.entries()) {
    if (failed) {
      for (const e of entries) e.geom.dispose();
      continue;
    }
    if (entries.length === 1) {
      const g = entries[0].geom;
      g.computeBoundingSphere();
      const single = new THREE.Mesh(g, mat);
      single.castShadow = entries[0].cast;
      single.receiveShadow = entries[0].receive;
      mergedResults.push(single);
      continue;
    }

    const rawGeoms = entries.map((e) => e.geom);
    const anyNonIndexed = rawGeoms.some((g) => !g.index);
    const normGeoms = rawGeoms.map((g) => {
      if (anyNonIndexed && g.index) {
        const nonIdx = g.toNonIndexed();
        g.dispose();
        return nonIdx;
      }
      return g;
    });
    const firstAttrNames = Object.keys(normGeoms[0].attributes);
    const commonAttrNames = firstAttrNames.filter((k) =>
      normGeoms.every(
        (g) =>
          g.attributes[k] !== undefined &&
          g.attributes[k].itemSize === normGeoms[0].attributes[k].itemSize
      )
    );
    for (const g of normGeoms) {
      for (const k of Object.keys(g.attributes)) {
        if (!commonAttrNames.includes(k)) g.deleteAttribute(k);
      }
    }

    const mergedGeom = mergeGeometries(normGeoms, false);
    for (const g of normGeoms) g.dispose();
    if (!mergedGeom) {
      failed = true;
      continue;
    }
    mergedGeom.computeBoundingSphere();
    const mergedMesh = new THREE.Mesh(mergedGeom, mat);
    mergedMesh.castShadow = entries.some((e) => e.cast);
    mergedMesh.receiveShadow = entries.some((e) => e.receive);
    mergedResults.push(mergedMesh);
  }

  if (failed) {
    for (const m of mergedResults) m.geometry.dispose();
    for (const m of arrayMatMeshes) m.geometry.dispose();
    return;
  }

  const parentSet = new Set<THREE.Object3D>();
  for (const m of sourceMeshes) {
    if (m.parent && m.parent !== container) parentSet.add(m.parent);
    m.parent?.remove(m);
  }
  // Prune empty non-excluded intermediate groups
  for (const p of parentSet) {
    let cur: THREE.Object3D | null = p;
    while (cur && cur !== container && cur.children.length === 0 && !exclude?.has(cur) && !(cur as THREE.Light).isLight) {
      const next: THREE.Object3D | null = cur.parent;
      cur.parent?.remove(cur);
      cur = next;
    }
  }
  for (const m of mergedResults) container.add(m);
  for (const m of arrayMatMeshes) container.add(m);
}
