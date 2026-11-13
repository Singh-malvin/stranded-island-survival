// Pure Graphics Quality Preset configuration and persistence (Low / Medium / High / Ultra).

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsPreset {
  id: GraphicsQuality;
  label: string;
  description: string;
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: 512 | 1024 | 2048;
  csm: boolean;
  fireShadow: boolean;
  bloom: boolean;
  ssao: boolean;
  smaa: boolean;
  dof: boolean;
  colorGrade: boolean;
  waterShader: boolean;
  planarReflection: boolean;
  pbrMaps: boolean;
  grassDensity: number;
  mistAndShafts: boolean;
  fireflies: boolean;
  heatShimmer: boolean;
}

export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsPreset> = {
  low: {
    id: 'low',
    label: 'Low (Performance)',
    description: 'Minimal shading, no shadow maps, flat ocean, no 3D grass or post-FX. Ideal for software WebGL.',
    pixelRatioCap: 1.0,
    shadows: false,
    shadowMapSize: 512,
    csm: false,
    fireShadow: false,
    bloom: false,
    ssao: false,
    smaa: false,
    dof: false,
    colorGrade: false,
    waterShader: false,
    planarReflection: false,
    pbrMaps: false,
    grassDensity: 0,
    mistAndShafts: false,
    fireflies: false,
    heatShimmer: false,
  },
  medium: {
    id: 'medium',
    label: 'Medium (Balanced)',
    description: '1024px sun shadows, PBR materials, animated ocean waves, sky scattering & light 3D grass.',
    pixelRatioCap: 1.25,
    shadows: true,
    shadowMapSize: 1024,
    csm: false,
    fireShadow: false,
    bloom: true,
    ssao: false,
    smaa: true,
    dof: false,
    colorGrade: true,
    waterShader: true,
    planarReflection: false,
    pbrMaps: true,
    grassDensity: 0.4,
    mistAndShafts: true,
    fireflies: true,
    heatShimmer: true,
  },
  high: {
    id: 'high',
    label: 'High (Cinematic)',
    description: 'Cascaded sun shadows (CSM), PBR textures, SSAO, SMAA, dense 3D grass, IBL sky & planar water reflections.',
    pixelRatioCap: 1.6,
    shadows: true,
    shadowMapSize: 2048,
    csm: true,
    fireShadow: true,
    bloom: true,
    ssao: true,
    smaa: true,
    dof: false,
    colorGrade: true,
    waterShader: true,
    planarReflection: true,
    pbrMaps: true,
    grassDensity: 0.78,
    mistAndShafts: true,
    fireflies: true,
    heatShimmer: true,
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra (Max Fidelity)',
    description: 'Full 2048px CSM, maximum 3D grass & scatter density, SSAO, SMAA, DoF, planar reflections & volumetric haze.',
    pixelRatioCap: 2.0,
    shadows: true,
    shadowMapSize: 2048,
    csm: true,
    fireShadow: true,
    bloom: true,
    ssao: true,
    smaa: true,
    dof: true,
    colorGrade: true,
    waterShader: true,
    planarReflection: true,
    pbrMaps: true,
    grassDensity: 1.0,
    mistAndShafts: true,
    fireflies: true,
    heatShimmer: true,
  },
};

const STORAGE_KEY = 'stranded_graphics_quality_v1';

export function isValidGraphicsQuality(val: unknown): val is GraphicsQuality {
  return val === 'low' || val === 'medium' || val === 'high' || val === 'ultra';
}

export function loadGraphicsQuality(isSoftwareGl: boolean = false): GraphicsQuality {
  try {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('quality');
      if (isValidGraphicsQuality(param)) {
        return param;
      }
      const saved = window.localStorage?.getItem(STORAGE_KEY);
      if (isValidGraphicsQuality(saved)) {
        return saved;
      }
    }
  } catch {
    // ignore storage restriction
  }
  return isSoftwareGl ? 'low' : 'high';
}

export function saveGraphicsQuality(quality: GraphicsQuality): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, quality);
    }
  } catch {
    // ignore
  }
}
