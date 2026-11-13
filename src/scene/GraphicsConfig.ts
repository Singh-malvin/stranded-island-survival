// Pure Graphics Quality Preset configuration and persistence (Low / Medium / High).

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GraphicsPreset {
  id: GraphicsQuality;
  label: string;
  description: string;
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: 512 | 1024 | 2048;
  fireShadow: boolean;
  bloom: boolean;
  colorGrade: boolean;
  waterShader: boolean;
  mistAndShafts: boolean;
  fireflies: boolean;
}

export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsPreset> = {
  low: {
    id: 'low',
    label: 'Low (Performance)',
    description: 'Flat lighting, no shadow maps, basic ocean, zero post-processing. Best for laptops & software WebGL.',
    pixelRatioCap: 1.0,
    shadows: false,
    shadowMapSize: 512,
    fireShadow: false,
    bloom: false,
    colorGrade: false,
    waterShader: false,
    mistAndShafts: false,
    fireflies: false,
  },
  medium: {
    id: 'medium',
    label: 'Medium (Balanced)',
    description: 'Sun shadows (1024px), animated ocean shader, sky scattering, mist & light shafts, color grading.',
    pixelRatioCap: 1.25,
    shadows: true,
    shadowMapSize: 1024,
    fireShadow: false,
    bloom: true,
    colorGrade: true,
    waterShader: true,
    mistAndShafts: true,
    fireflies: true,
  },
  high: {
    id: 'high',
    label: 'High (Atmospheric)',
    description: 'Crisp 2048px sun shadows, nearest campfire real-time shadow, full bloom, mist, fireflies & ocean specular.',
    pixelRatioCap: 1.75,
    shadows: true,
    shadowMapSize: 2048,
    fireShadow: true,
    bloom: true,
    colorGrade: true,
    waterShader: true,
    mistAndShafts: true,
    fireflies: true,
  },
};

const STORAGE_KEY = 'stranded_graphics_quality_v1';

export function isValidGraphicsQuality(val: unknown): val is GraphicsQuality {
  return val === 'low' || val === 'medium' || val === 'high';
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
