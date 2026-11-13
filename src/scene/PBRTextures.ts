import * as THREE from 'three';

export type PBRMaterialKind = 'sand' | 'grass' | 'rock' | 'bark' | 'wood' | 'metal';

export interface PBRTextureBundle {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap: THREE.Texture;
}

type MapChannel = 'diff' | 'nor' | 'rough' | 'ao';

const CHANNEL_PLACEHOLDER: Record<MapChannel, [number, number, number]> = {
  diff: [232, 232, 232],
  nor: [128, 128, 255],
  rough: [204, 204, 204],
  ao: [255, 255, 255],
};

function makeSeedTexture(channel: MapChannel, anisotropy: number): THREE.Texture {
  const [r, g, b] = CHANNEL_PLACEHOLDER[channel];
  let tex: THREE.Texture;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, 2, 2);
    }
    tex = new THREE.Texture(canvas);
  } else {
    const data = new Uint8Array([r, g, b, 255]);
    tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  tex.colorSpace = channel === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Shared CC0 Poly Haven 1K PBR texture bank (sRGB diffuse + linear normal/rough/AO).
 * Seeds a neutral 2x2 canvas before async JPG decode finishes so objects never flash black,
 * and allows cheap UV-tiling variants via Three.js Texture clones that share GPU Image backing.
 */
export class PBRTextureBank {
  private bases = new Map<PBRMaterialKind, PBRTextureBundle>();
  private trackedClones: THREE.Texture[] = [];
  private disposed = false;
  private maxAnisotropy: number;

  constructor(maxAnisotropy: number = 4) {
    this.maxAnisotropy = Math.max(1, Math.min(8, maxAnisotropy));
  }

  public getBase(kind: PBRMaterialKind): PBRTextureBundle {
    const existing = this.bases.get(kind);
    if (existing) return existing;

    const loadChannel = (channel: MapChannel): THREE.Texture => {
      const tex = makeSeedTexture(channel, this.maxAnisotropy);
      if (typeof Image !== 'undefined') {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (this.disposed) return;
          tex.image = img;
          tex.needsUpdate = true;
          for (const clone of this.trackedClones) {
            if (clone.userData.__sourceTex === tex) {
              clone.image = img;
              clone.needsUpdate = true;
            }
          }
        };
        img.src = `./textures/${kind}/${channel}.jpg`;
      }
      return tex;
    };

    const bundle: PBRTextureBundle = {
      map: loadChannel('diff'),
      normalMap: loadChannel('nor'),
      roughnessMap: loadChannel('rough'),
      aoMap: loadChannel('ao'),
    };
    this.bases.set(kind, bundle);
    return bundle;
  }

  public getTiled(kind: PBRMaterialKind, repeatX: number, repeatY: number): PBRTextureBundle {
    const base = this.getBase(kind);
    const cloneWithRepeat = (src: THREE.Texture): THREE.Texture => {
      const c = src.clone();
      c.repeat.set(repeatX, repeatY);
      c.wrapS = THREE.RepeatWrapping;
      c.wrapT = THREE.RepeatWrapping;
      c.anisotropy = this.maxAnisotropy;
      c.colorSpace = src.colorSpace;
      c.userData.__sourceTex = src;
      c.needsUpdate = true;
      this.trackedClones.push(c);
      return c;
    };
    return {
      map: cloneWithRepeat(base.map),
      normalMap: cloneWithRepeat(base.normalMap),
      roughnessMap: cloneWithRepeat(base.roughnessMap),
      aoMap: cloneWithRepeat(base.aoMap),
    };
  }

  public applyToMaterial(
    mat: THREE.MeshStandardMaterial,
    kind: PBRMaterialKind,
    repeatX: number = 1,
    repeatY: number = 1,
    options?: {
      normalScale?: number;
      aoMapIntensity?: number;
    }
  ): THREE.MeshStandardMaterial {
    const bundle =
      repeatX === 1 && repeatY === 1 ? this.getBase(kind) : this.getTiled(kind, repeatX, repeatY);
    mat.map = bundle.map;
    mat.normalMap = bundle.normalMap;
    mat.roughnessMap = bundle.roughnessMap;
    mat.aoMap = bundle.aoMap;
    mat.aoMapIntensity = options?.aoMapIntensity ?? 0.65;
    const ns = options?.normalScale ?? 0.9;
    mat.normalScale.set(ns, ns);
    mat.needsUpdate = true;
    return mat;
  }

  /**
   * Automatically attaches or detaches 1K PBR normal/roughness/AO (and diffuse where appropriate)
   * across all MeshStandardMaterials in a scene graph, preserving painted tints & toggleability.
   */
  public applyScenePBR(root: THREE.Object3D, enabled: boolean, envIntensity: number = 0.85) {
    const visited = new Set<THREE.Material>();

    const inferKind = (mat: THREE.MeshStandardMaterial): PBRMaterialKind | 'none' => {
      const explicit = mat.userData.pbrKind as PBRMaterialKind | 'none' | undefined;
      if (explicit) return explicit;
      if (mat.vertexColors || mat.transparent || mat.emissiveIntensity > 0.35) return 'none';

      const hsl = { h: 0, s: 0, l: 0 };
      mat.color.getHSL(hsl);

      if (mat.metalness >= 0.32) return 'metal';
      // Green leaves / foliage / crops / cloth
      if (hsl.h > 0.2 && hsl.h < 0.45 && hsl.s > 0.18) return 'none';
      // Bright water / berry / flesh / parchment accents
      if (hsl.l > 0.82 && hsl.s > 0.2) return 'none';
      // Warm browns: bark or timber
      if (hsl.h >= 0.04 && hsl.h <= 0.14 && hsl.s >= 0.2) {
        return mat.roughness >= 0.87 ? 'bark' : 'wood';
      }
      // Neutral grays / dark basalt / slate concrete
      if (hsl.s < 0.18) return 'rock';
      return 'none';
    };

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m || visited.has(m)) continue;
        visited.add(m);
        if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
        const std = m as THREE.MeshStandardMaterial;
        if (std.userData.__skipScenePBR) continue;

        if (!std.userData.__origSaved) {
          std.userData.__origSaved = true;
          std.userData.__origColorHex = std.color.getHex();
          std.userData.__origFlat = std.flatShading;
          std.userData.__origRough = std.roughness;
        }

        const kind = inferKind(std);
        if (kind === 'none') {
          std.envMapIntensity = enabled ? Math.min(0.65, envIntensity * 0.65) : 0.35;
          continue;
        }

        if (!enabled) {
          std.map = null;
          std.normalMap = null;
          std.roughnessMap = null;
          std.aoMap = null;
          std.color.setHex(std.userData.__origColorHex as number);
          std.flatShading = Boolean(std.userData.__origFlat);
          std.roughness = Number(std.userData.__origRough ?? std.roughness);
          std.envMapIntensity = 0.25;
          std.needsUpdate = true;
          continue;
        }

        const repeat = kind === 'bark' ? 2 : kind === 'wood' ? 1.5 : 1;
        const bundle = repeat === 1 ? this.getBase(kind) : this.getTiled(kind, repeat, repeat);

        std.normalMap = bundle.normalMap;
        std.roughnessMap = bundle.roughnessMap;
        std.aoMap = bundle.aoMap;
        std.aoMapIntensity = 0.72;
        std.normalScale.set(kind === 'rock' ? 1.05 : 0.85, kind === 'rock' ? 1.05 : 0.85);
        std.envMapIntensity = envIntensity;

        // Attach albedo diffuse map for raw natural stone/bark/wood, lifting base tint so colors don't crush
        const origColor = new THREE.Color(std.userData.__origColorHex as number);
        if (kind === 'rock' || kind === 'bark' || kind === 'wood') {
          std.map = bundle.map;
          std.color.copy(origColor).lerp(new THREE.Color(0xffffff), 0.28);
        } else if (kind === 'metal') {
          // For painted metal / aluminum keep rich normal+roughness+AO scratches; rusty iron also uses map
          const isRusty = origColor.r > origColor.b * 1.45;
          std.map = isRusty ? bundle.map : null;
          if (isRusty) std.color.copy(origColor).lerp(new THREE.Color(0xffffff), 0.26);
        }

        if (kind !== 'rock') {
          std.flatShading = false;
        }
        std.needsUpdate = true;
      }
    });
  }

  public setAnisotropy(maxAnisotropy: number) {
    this.maxAnisotropy = Math.max(1, Math.min(8, maxAnisotropy));
    for (const bundle of this.bases.values()) {
      bundle.map.anisotropy = this.maxAnisotropy;
      bundle.normalMap.anisotropy = this.maxAnisotropy;
      bundle.roughnessMap.anisotropy = this.maxAnisotropy;
      bundle.aoMap.anisotropy = this.maxAnisotropy;
    }
    for (const c of this.trackedClones) {
      c.anisotropy = this.maxAnisotropy;
    }
  }

  public dispose() {
    this.disposed = true;
    for (const bundle of this.bases.values()) {
      bundle.map.dispose();
      bundle.normalMap.dispose();
      bundle.roughnessMap.dispose();
      bundle.aoMap.dispose();
    }
    this.bases.clear();
    for (const c of this.trackedClones) {
      c.dispose();
    }
    this.trackedClones = [];
  }
}
