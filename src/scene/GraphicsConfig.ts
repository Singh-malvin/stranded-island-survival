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
    pixelRatioCap: 1.5,
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
    description: 'Full 2048px CSM, maximum 3D grass & scatter density, SSAO, SMAA, DoF, planar reflections & volumetric haze (capped at 1.5x DPR for cool Mac thermals).',
    pixelRatioCap: 1.5,
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

export type FpsLimitOption = 30 | 60 | 0;
export type ViewDistancePreset = 'near' | 'medium' | 'far';

export interface ControlKeybinds {
  forward: string;
  back: string;
  left: string;
  right: string;
  jump: string;
  sprint: string;
  crouch: string;
  prone: string;
  sit: string;
  interact: string;
  inspect: string;
  photoMode: string;
}

export const DEFAULT_KEYBINDS: ControlKeybinds = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  crouch: 'KeyC',
  prone: 'KeyZ',
  sit: 'KeyX',
  interact: 'KeyE',
  inspect: 'KeyF',
  photoMode: 'KeyP',
};

export interface ExtendedGraphicsSettings {
  autoQuality: boolean;
  fpsLimit: FpsLimitOption; // 0 = uncapped
  batterySaver: boolean;
  renderScale: number; // 0.65 - 1.0
  viewDistance: ViewDistancePreset;
  fovDeg: number;
  mouseSensitivity: number;
  motionBlur: boolean;
  headBob: boolean;
  closedCaptions: boolean;
  keybinds: ControlKeybinds;
}

const EXTENDED_STORAGE_KEY = 'stranded_graphics_ext_v1';

export function loadExtendedGraphicsSettings(): ExtendedGraphicsSettings {
  const defaults: ExtendedGraphicsSettings = {
    autoQuality: false,
    fpsLimit: 60,
    batterySaver: false,
    renderScale: 1.0,
    viewDistance: 'far',
    fovDeg: 75,
    mouseSensitivity: 1.0,
    motionBlur: true,
    headBob: true,
    closedCaptions: true,
    keybinds: { ...DEFAULT_KEYBINDS },
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(EXTENDED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          autoQuality: Boolean(parsed.autoQuality),
          fpsLimit: parsed.fpsLimit === 30 || parsed.fpsLimit === 0 ? parsed.fpsLimit : 60,
          batterySaver: Boolean(parsed.batterySaver),
          renderScale:
            typeof parsed.renderScale === 'number'
              ? Math.max(0.65, Math.min(1.0, parsed.renderScale))
              : 1.0,
          viewDistance:
            parsed.viewDistance === 'near' || parsed.viewDistance === 'medium'
              ? parsed.viewDistance
              : 'far',
          fovDeg:
            typeof parsed.fovDeg === 'number'
              ? Math.max(60, Math.min(100, parsed.fovDeg))
              : 75,
          mouseSensitivity:
            typeof parsed.mouseSensitivity === 'number'
              ? Math.max(0.4, Math.min(2.4, parsed.mouseSensitivity))
              : 1.0,
          motionBlur: parsed.motionBlur !== false,
          headBob: parsed.headBob !== false,
          closedCaptions: parsed.closedCaptions !== false,
          keybinds: {
            ...DEFAULT_KEYBINDS,
            ...(parsed.keybinds && typeof parsed.keybinds === 'object' ? parsed.keybinds : {}),
          },
        };
      }
    }
  } catch {
    // ignore
  }
  return defaults;
}

export function saveExtendedGraphicsSettings(settings: ExtendedGraphicsSettings): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(EXTENDED_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    // ignore
  }
}

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
