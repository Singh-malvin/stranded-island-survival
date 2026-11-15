import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { audio } from '../audio/audio.ts';
import { INTRO_TUNING } from '../survival/config.ts';

export type IntroStageId =
  | 'inactive'
  | 'calm'
  | 'storm'
  | 'breakup'
  | 'video'
  | 'blackout'
  | 'wakeup';

export interface IntroOverlayState {
  active: boolean;
  stage: IntroStageId;
  elapsedSec: number;
  subtitle: string | null;
  bannerTitle: string | null;
  bannerSubtitle: string | null;
  showVideo: boolean;
  fadeBlackAlpha: number;
  blurPx: number;
  skipHoldProgress: number;
  lightningFlashAlpha: number;
}

interface IntroSubtitleCue {
  startSec: number;
  endSec: number;
  text: string;
}

const INTRO_SUBTITLE_SCRIPT: IntroSubtitleCue[] = [
  { startSec: 2.0, endSec: 7.2, text: 'FLIGHT 404 — Pacific Charter · 34,000 ft · Approach to Cairns Sector' },
  { startSec: 9.0, endSec: 15.5, text: 'CAPTAIN (PA): "Folks, just ahead lies an unforecast tropical squall. We’ll be touching down early."' },
  { startSec: 20.5, endSec: 25.0, text: '[Seatbelt Chime — Keep Seatbelts Fastened]' },
  { startSec: 27.0, endSec: 32.5, text: 'FLIGHT ATTENDANT: "Stay seated! Close your tray tables — pressure is dropping!"' },
  { startSec: 34.0, endSec: 39.5, text: '[Yellow Oxygen Masks Drop — Grab Mask & Brace!]' },
  { startSec: 42.0, endSec: 47.0, text: 'RADIO STATIC: "...the Aura wakes beneath the storm... none cross his horizon..."' },
  { startSec: 50.0, endSec: 57.5, text: 'CAPTAIN (PA): "Port engine fire! Brace for emergency descent—"' },
  { startSec: 62.5, endSec: 70.5, text: '[Hull Stress Critical — Right Wing Structural Failure!]' },
  { startSec: 86.0, endSec: 93.0, text: '...water in your lungs. Sand on your cheek. Get up...' },
];

export class PlaneCrashIntro3D {
  public readonly scene = new THREE.Scene();
  public readonly camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.08, 300);

  private cabinRoot = new THREE.Group();
  private skySphere: THREE.Mesh;
  private skyMat: THREE.MeshBasicMaterial;
  private cabinMainLight: THREE.PointLight;
  private cabinAftLight: THREE.PointLight;
  private redEmergencyLightL: THREE.PointLight;
  private redEmergencyLightR: THREE.PointLight;
  private auraFlashLight: THREE.DirectionalLight;
  private ambLight: THREE.HemisphereLight;

  private oxyMaskRoots: THREE.Object3D[] = [];
  private looseBinDoor: THREE.Object3D | null = null;
  private cabinLightStripMat: THREE.MeshStandardMaterial | null = null;
  private aisleGlowMats: THREE.MeshStandardMaterial[] = [];
  private passengerRoots: THREE.Object3D[] = [];
  private sparkMeshes: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number }> = [];
  private sparkGroup = new THREE.Group();

  private loaded = false;
  private loading = false;

  public active = false;
  private preserveStateOnExit = false;
  private elapsedSec = 0;
  private lookYaw = 0;
  private lookPitch = -0.04;
  private leanX = 0;
  private leanZ = 0;
  private skipHoldSec = 0;
  private skipHeld = false;
  private triggeredCues = new Set<string>();
  private nextThunderAt = 29;
  private nextSparkAt = 47;
  private lightningIntensity = 0;

  private onWakeUpStartCallback?: (preserveState: boolean) => void;
  private onCompleteCallback?: (preserveState: boolean) => void;

  constructor(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.scene.background = new THREE.Color(0x0c192c);
    this.scene.fog = new THREE.FogExp2(0x162438, 0.012);

    this.ambLight = new THREE.HemisphereLight(0xdcebff, 0x262933, 0.65);
    this.scene.add(this.ambLight);

    // Exterior window scrolling sky/storm dome around the aircraft cabin
    const skyGeom = new THREE.SphereGeometry(95, 32, 20);
    this.skyMat = new THREE.MeshBasicMaterial({
      color: 0x6296c9,
      side: THREE.BackSide,
      fog: false,
    });
    this.skySphere = new THREE.Mesh(skyGeom, this.skyMat);
    this.scene.add(this.skySphere);

    new THREE.TextureLoader().load('./assets/world/clouds_storm_equirect.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      this.skyMat.map = tex;
      this.skyMat.needsUpdate = true;
    });

    // Cabin interior lighting
    this.cabinMainLight = new THREE.PointLight(0xffe9c8, 3.6, 14, 1.4);
    this.cabinMainLight.position.set(0, 2.08, -0.4);
    this.cabinRoot.add(this.cabinMainLight);

    this.cabinAftLight = new THREE.PointLight(0xffe4bc, 2.8, 12, 1.5);
    this.cabinAftLight.position.set(0, 2.05, 2.8);
    this.cabinRoot.add(this.cabinAftLight);

    this.redEmergencyLightL = new THREE.PointLight(0xff2c1a, 0, 11, 1.4);
    this.redEmergencyLightL.position.set(-0.2, 1.9, -4.5);
    this.cabinRoot.add(this.redEmergencyLightL);

    this.redEmergencyLightR = new THREE.PointLight(0xff381c, 0, 11, 1.4);
    this.redEmergencyLightR.position.set(0.2, 1.85, 1.6);
    this.cabinRoot.add(this.redEmergencyLightR);

    this.auraFlashLight = new THREE.DirectionalLight(0xc084fc, 0);
    this.auraFlashLight.position.set(-14, 5, -3);
    this.scene.add(this.auraFlashLight);

    // Electrical spark pool at forward bulkhead (y=1.24, z=-6.6)
    const sparkGeom = new THREE.BoxGeometry(0.035, 0.035, 0.035);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(sparkGeom, sparkMat);
      m.visible = false;
      this.sparkGroup.add(m);
      this.sparkMeshes.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
    }
    this.cabinRoot.add(this.sparkGroup);
    this.scene.add(this.cabinRoot);
  }

  public preload(): Promise<void> {
    if (this.loaded || this.loading) return Promise.resolve();
    this.loading = true;
    const loader = new GLTFLoader();
    return new Promise((resolve) => {
      loader.load(
        './assets/models/flight404_cabin.glb',
        (gltf) => {
          this.oxyMaskRoots = [];
          this.aisleGlowMats = [];
          this.passengerRoots = [];
          this.looseBinDoor = null;
          this.cabinLightStripMat = null;

          gltf.scene.traverse((obj) => {
            if (obj.name.startsWith('OxyMask_') && obj.children.length >= 2) {
              // Matches oxygen mask parent pivot (OxyMask_Player, OxyMask_1..5)
              obj.userData.baseY = obj.position.y;
              obj.userData.phase = this.oxyMaskRoots.length * 0.9;
              this.oxyMaskRoots.push(obj);
            }
            if (obj.name === 'LooseBinDoor') {
              this.looseBinDoor = obj;
            }
            if (obj.name.startsWith('Passenger_') && !obj.name.includes('_Torso') && !obj.name.includes('_Legs') && !obj.name.includes('_Head')) {
              obj.userData.baseRotZ = obj.rotation.z;
              obj.userData.phase = this.passengerRoots.length * 1.1;
              this.passengerRoots.push(obj);
            }
            if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
              if (obj.name === 'CabinLightStrip') {
                this.cabinLightStripMat = obj.material;
              } else if (obj.name.startsWith('AisleGlow_')) {
                this.aisleGlowMats.push(obj.material);
              }
            }
          });

          this.cabinRoot.add(gltf.scene);
          this.loaded = true;
          this.loading = false;
          resolve();
        },
        undefined,
        () => {
          this.loading = false;
          resolve();
        }
      );
    });
  }

  public start(opts: {
    preserveState: boolean;
    onWakeUpStart?: (preserveState: boolean) => void;
    onComplete?: (preserveState: boolean) => void;
  }) {
    void this.preload();
    this.active = true;
    this.preserveStateOnExit = opts.preserveState;
    this.onWakeUpStartCallback = opts.onWakeUpStart;
    this.onCompleteCallback = opts.onComplete;

    this.elapsedSec = 0;
    this.lookYaw = -0.18; // Slight natural glance slightly toward left cabin window + forward aisle
    this.lookPitch = -0.02;
    this.leanX = 0;
    this.leanZ = 0;
    this.skipHoldSec = 0;
    this.skipHeld = false;
    this.triggeredCues.clear();
    this.nextThunderAt = 29;
    this.nextSparkAt = INTRO_TUNING.BULKHEAD_SPARK_SEC;
    this.lightningIntensity = 0;
    this.resetCabinAnimationProps();
  }

  public skipImmediately() {
    if (!this.active) return;
    audio.stopIntroEngineDrone();
    this.active = false;
    this.onWakeUpStartCallback?.(this.preserveStateOnExit);
    this.onCompleteCallback?.(this.preserveStateOnExit);
  }

  public addLookDelta(dYaw: number, dPitch: number) {
    if (!this.active) return;
    this.lookYaw = THREE.MathUtils.clamp(
      this.lookYaw + dYaw,
      -INTRO_TUNING.CABIN_LOOK_MAX_YAW_RAD,
      INTRO_TUNING.CABIN_LOOK_MAX_YAW_RAD
    );
    this.lookPitch = THREE.MathUtils.clamp(
      this.lookPitch + dPitch,
      -INTRO_TUNING.CABIN_LOOK_MAX_PITCH_RAD,
      INTRO_TUNING.CABIN_LOOK_MAX_PITCH_RAD
    );
  }

  public setSkipHeld(held: boolean) {
    this.skipHeld = held;
  }

  public resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public getStage(): IntroStageId {
    if (!this.active) return 'inactive';
    const t = this.elapsedSec;
    if (t < INTRO_TUNING.STORM_START_SEC) return 'calm';
    if (t < INTRO_TUNING.BREAKUP_START_SEC) return 'storm';
    if (t < INTRO_TUNING.VIDEO_START_SEC) return 'breakup';
    if (t < INTRO_TUNING.BLACKOUT_START_SEC) return 'video';
    if (t < INTRO_TUNING.WAKEUP_START_SEC) return 'blackout';
    return 'wakeup';
  }

  public isInIslandWakeUp(): boolean {
    const st = this.getStage();
    return st === 'wakeup';
  }

  public getWakeUpProgress(): number {
    const t = this.elapsedSec - INTRO_TUNING.WAKEUP_START_SEC;
    return THREE.MathUtils.clamp(t / INTRO_TUNING.WAKEUP_DURATION_SEC, 0, 1);
  }

  private resetCabinAnimationProps() {
    this.cabinRoot.rotation.set(0, 0, 0);
    for (const m of this.oxyMaskRoots) {
      const baseY = (m.userData.baseY as number) ?? m.position.y;
      m.position.y = baseY + 0.56; // Tucked smoothly up into ceiling panel until triggered
      m.rotation.set(0, 0, 0);
    }
    if (this.looseBinDoor) {
      this.looseBinDoor.rotation.set(0, 0, 0);
    }
    for (const sp of this.sparkMeshes) {
      sp.mesh.visible = false;
      sp.life = 0;
    }
  }

  public update(dt: number, leanForwardInput: number, leanSideInput: number): IntroOverlayState {
    if (!this.active) {
      return {
        active: false,
        stage: 'inactive',
        elapsedSec: 0,
        subtitle: null,
        bannerTitle: null,
        bannerSubtitle: null,
        showVideo: false,
        fadeBlackAlpha: 0,
        blurPx: 0,
        skipHoldProgress: 0,
        lightningFlashAlpha: 0,
      };
    }

    if (this.skipHeld) {
      this.skipHoldSec += dt;
      if (this.skipHoldSec >= INTRO_TUNING.SKIP_HOLD_SEC) {
        this.skipImmediately();
        return {
          active: false,
          stage: 'inactive',
          elapsedSec: this.elapsedSec,
          subtitle: null,
          bannerTitle: null,
          bannerSubtitle: null,
          showVideo: false,
          fadeBlackAlpha: 0,
          blurPx: 0,
          skipHoldProgress: 1,
          lightningFlashAlpha: 0,
        };
      }
    } else {
      this.skipHoldSec = Math.max(0, this.skipHoldSec - dt * 2.4);
    }

    this.elapsedSec += dt;
    const t = this.elapsedSec;
    const stage = this.getStage();

    // Audio beats & drone progression
    if (stage === 'calm') {
      audio.setIntroEngineDrone(0.35 + (t / INTRO_TUNING.CALM_DURATION_SEC) * 0.2);
      if (t >= 20.5 && !this.triggeredCues.has('chime')) {
        this.triggeredCues.add('chime');
        audio.playIntroCue('chime');
      }
    } else if (stage === 'storm' || stage === 'breakup') {
      audio.setIntroEngineDrone(stage === 'breakup' ? 1.0 : 0.72);
      if (t >= INTRO_TUNING.OXYGEN_DROP_SEC && !this.triggeredCues.has('oxy')) {
        this.triggeredCues.add('oxy');
        audio.playIntroCue('oxygen');
      }
      if (t >= INTRO_TUNING.BREAKUP_START_SEC && !this.triggeredCues.has('breakup')) {
        this.triggeredCues.add('breakup');
        audio.playIntroCue('breakup');
        audio.playIntroCue('alarm');
      }
      if (t >= this.nextThunderAt) {
        this.lightningIntensity = 1.0;
        audio.playIntroCue('thunder');
        this.nextThunderAt = t + (stage === 'breakup' ? 3.2 : 5.4);
      }
    } else if (stage === 'video') {
      audio.setIntroEngineDrone(0.9);
      if (!this.triggeredCues.has('videoThunder')) {
        this.triggeredCues.add('videoThunder');
        audio.playIntroCue('thunder');
      }
    } else if (stage === 'blackout') {
      audio.stopIntroEngineDrone();
      if (!this.triggeredCues.has('impact')) {
        this.triggeredCues.add('impact');
        audio.playIntroCue('impact');
      }
    } else if (stage === 'wakeup') {
      if (!this.triggeredCues.has('wakeup')) {
        this.triggeredCues.add('wakeup');
        this.onWakeUpStartCallback?.(this.preserveStateOnExit);
        audio.playIntroCue('wakeup');
      }
    }

    // Lightning decay & cabin animation during cabin stages
    this.lightningIntensity = Math.max(0, this.lightningIntensity - dt * 2.8);
    if (stage === 'calm' || stage === 'storm' || stage === 'breakup') {
      this.updateCabinVisuals(dt, t, stage, leanForwardInput, leanSideInput);
    }

    // Subtitles matching active timestamp
    let subtitle: string | null = null;
    for (const cue of INTRO_SUBTITLE_SCRIPT) {
      if (t >= cue.startSec && t <= cue.endSec) {
        subtitle = cue.text;
        break;
      }
    }

    let fadeBlackAlpha = 0;
    let blurPx = 0;
    let bannerTitle: string | null = null;
    let bannerSubtitle: string | null = null;

    if (t < 1.8) {
      fadeBlackAlpha = Math.max(0, 1 - t / 1.8);
    } else if (stage === 'breakup') {
      const bt = (t - INTRO_TUNING.BREAKUP_START_SEC) / INTRO_TUNING.BREAKUP_CABIN_SEC;
      if (bt > 0.82) fadeBlackAlpha = (bt - 0.82) / 0.18;
    } else if (stage === 'video') {
      fadeBlackAlpha = 0;
    } else if (stage === 'blackout') {
      fadeBlackAlpha = 1;
      bannerTitle = 'DAY 1 — PALM COVE';
      bannerSubtitle = 'Flight 404 Survivor';
    } else if (stage === 'wakeup') {
      const wp = this.getWakeUpProgress();
      fadeBlackAlpha = Math.max(0, 1 - Math.min(1, wp * 2.6));
      blurPx = Math.max(0, (1 - wp * 1.45) * 6.5);
      if (wp < 0.35) {
        bannerTitle = 'DAY 1 — PALM COVE';
      }
    }

    if (t >= INTRO_TUNING.TOTAL_DURATION_SEC) {
      this.active = false;
      audio.stopIntroEngineDrone();
      this.onCompleteCallback?.(this.preserveStateOnExit);
    }

    return {
      active: this.active,
      stage,
      elapsedSec: t,
      subtitle,
      bannerTitle,
      bannerSubtitle,
      showVideo: stage === 'video',
      fadeBlackAlpha,
      blurPx,
      skipHoldProgress: THREE.MathUtils.clamp(this.skipHoldSec / INTRO_TUNING.SKIP_HOLD_SEC, 0, 1),
      lightningFlashAlpha: this.lightningIntensity * 0.32,
    };
  }

  private updateCabinVisuals(
    dt: number,
    t: number,
    stage: IntroStageId,
    leanForwardInput: number,
    leanSideInput: number
  ) {
    // Cloud sky panning outside windows + shift from sunlit cirrus -> deep violet-black storm
    this.skySphere.rotation.y += dt * (stage === 'calm' ? 0.035 : 0.14);
    const stormMix = THREE.MathUtils.clamp(
      (t - INTRO_TUNING.STORM_START_SEC * 0.7) / 14,
      0,
      1
    );
    const skyBase = new THREE.Color(0x6fa4d8).lerp(new THREE.Color(0x161425), stormMix);
    const flashCol = new THREE.Color(0xc084fc).lerp(new THREE.Color(0xfbbf24), 0.35);
    skyBase.lerp(flashCol, this.lightningIntensity * 0.75);
    this.skyMat.color.copy(skyBase);

    this.auraFlashLight.intensity = this.lightningIntensity * 12.0;

    // Cabin interior lights flicker then fall back to pulsing red emergency lighting
    if (stage === 'calm') {
      this.cabinMainLight.intensity = 3.6;
      this.cabinAftLight.intensity = 2.8;
      this.redEmergencyLightL.intensity = 0;
      this.redEmergencyLightR.intensity = 0;
    } else {
      const flicker = Math.sin(t * 29) * Math.sin(t * 47) > 0.4 ? 0.45 : 1.0;
      const powerDrop = stage === 'breakup' ? 0.12 : THREE.MathUtils.clamp(1 - (t - 26) / 18, 0.25, 1.0);
      this.cabinMainLight.intensity = 3.2 * powerDrop * flicker;
      this.cabinAftLight.intensity = 2.4 * powerDrop * flicker;
      const alarmPulse = 0.5 + 0.5 * Math.sin(t * 9.5);
      this.redEmergencyLightL.intensity = 2.8 * (0.4 + 0.6 * alarmPulse);
      this.redEmergencyLightR.intensity = 2.8 * (0.4 + 0.6 * (1 - alarmPulse));
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = stage === 'breakup' ? 0.095 : 0.022;
      }
    }

    // Aisle & ceiling emissives update cleanly
    if (this.cabinLightStripMat) {
      this.cabinLightStripMat.emissiveIntensity = stage === 'calm' ? 1.8 : 0.35 + this.lightningIntensity * 0.5;
    }
    const emergencyCol = new THREE.Color(stage === 'calm' ? 0xf59e0b : 0xef4444);
    for (const mat of this.aisleGlowMats) {
      mat.emissive.copy(emergencyCol);
      mat.emissiveIntensity = stage === 'calm' ? 1.2 : 1.8 + 1.4 * Math.sin(t * 8.0);
    }

    // Drop oxygen masks smoothly at OXYGEN_DROP_SEC & swing with airframe roll
    const oxyT = THREE.MathUtils.clamp((t - INTRO_TUNING.OXYGEN_DROP_SEC) / 0.85, 0, 1);
    const oxyBounce = oxyT < 1 ? 1 - Math.pow(1 - oxyT, 3) : 1 + Math.sin((t - INTRO_TUNING.OXYGEN_DROP_SEC) * 8) * 0.04 * Math.exp(-(t - INTRO_TUNING.OXYGEN_DROP_SEC));
    for (const mask of this.oxyMaskRoots) {
      const baseY = (mask.userData.baseY as number) ?? 1.98;
      const phase = (mask.userData.phase as number) ?? 0;
      mask.position.y = baseY + 0.56 - 0.56 * oxyBounce;
      if (oxyT > 0.1) {
        mask.rotation.z = Math.sin(t * 4.2 + phase) * (stage === 'breakup' ? 0.32 : 0.16);
        mask.rotation.x = Math.cos(t * 3.1 + phase) * 0.12;
      }
    }

    // Loose overhead luggage bin door snaps open during Stage B
    if (this.looseBinDoor) {
      const binT = THREE.MathUtils.clamp((t - INTRO_TUNING.OVERHEAD_BIN_OPEN_SEC) / 0.45, 0, 1);
      const shakeAngle = binT > 0 ? Math.sin(t * 14) * 0.08 : 0;
      this.looseBinDoor.rotation.z = -binT * 1.15 + shakeAngle;
    }

    // Passenger subtle lean & panic bracing shake
    for (const p of this.passengerRoots) {
      const baseRz = (p.userData.baseRotZ as number) ?? 0;
      const ph = (p.userData.phase as number) ?? 0;
      const amp = stage === 'calm' ? 0.015 : stage === 'breakup' ? 0.14 : 0.075;
      p.rotation.z = baseRz + Math.sin(t * 3.6 + ph) * amp;
      p.rotation.x = stage === 'calm' ? 0 : -0.18 + Math.cos(t * 5.2 + ph) * amp * 0.5;
    }

    // Electrical sparks from cockpit bulkhead panel in Stage B / Breakup
    if (t >= INTRO_TUNING.BULKHEAD_SPARK_SEC && t >= this.nextSparkAt) {
      this.nextSparkAt = t + (stage === 'breakup' ? 0.45 : 1.15);
      audio.playIntroCue('spark');
      for (let i = 0; i < this.sparkMeshes.length; i++) {
        const sp = this.sparkMeshes[i];
        sp.mesh.position.set(0.76, 1.24, -6.58);
        sp.vel.set(
          (Math.random() - 0.5) * 2.2,
          0.4 + Math.random() * 1.4,
          1.2 + Math.random() * 2.0
        );
        sp.life = 0.45 + Math.random() * 0.25;
        sp.mesh.visible = true;
      }
    }
    for (const sp of this.sparkMeshes) {
      if (sp.life <= 0) {
        sp.mesh.visible = false;
        continue;
      }
      sp.life -= dt;
      sp.vel.y -= 6.5 * dt;
      sp.mesh.position.addScaledVector(sp.vel, dt);
      if (sp.life <= 0) sp.mesh.visible = false;
    }

    // Airframe turbulence & cabin nose-down pitch/roll
    const turb = stage === 'calm' ? 0.008 : stage === 'breakup' ? 0.085 : 0.045;
    const bank =
      stage === 'calm'
        ? Math.sin(t * 0.4) * 0.018
        : stage === 'breakup'
          ? 0.26 + Math.sin(t * 8.2) * 0.07
          : Math.sin(t * 2.2) * 0.095;
    const pitchDive =
      stage === 'calm'
        ? 0.015
        : stage === 'breakup'
          ? -0.22 - (t - INTRO_TUNING.BREAKUP_START_SEC) * 0.012
          : -0.05 + Math.sin(t * 3.1) * 0.035;

    this.cabinRoot.rotation.set(pitchDive, 0, bank);

    // Smooth camera lean toward cabin window / aisle while preserving full mouse look
    this.leanX = THREE.MathUtils.lerp(this.leanX, leanSideInput * 0.14, 1 - Math.exp(-8 * dt));
    this.leanZ = THREE.MathUtils.lerp(this.leanZ, leanForwardInput * 0.12, 1 - Math.exp(-8 * dt));

    const shakeX = Math.sin(t * 23.0) * turb * 0.45;
    const shakeY = Math.cos(t * 31.0) * turb * 0.65;
    this.camera.position.set(
      INTRO_TUNING.CABIN_EYE_X + this.leanX + shakeX,
      INTRO_TUNING.CABIN_EYE_Y + shakeY,
      INTRO_TUNING.CABIN_EYE_Z - this.leanZ
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(
      this.lookPitch + pitchDive * 0.55 + Math.sin(t * 19.0) * turb * 0.25,
      this.lookYaw,
      bank * 0.45 + Math.cos(t * 17.0) * turb * 0.2
    );
  }

  public dispose() {
    audio.stopIntroEngineDrone();
    this.skyMat.map?.dispose();
    this.skyMat.dispose();
    this.skySphere.geometry.dispose();
  }
}
