import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { audio } from './audio/audio.ts';
import {
  ExtendedGraphicsSettings,
  GraphicsQuality,
  loadExtendedGraphicsSettings,
  loadGraphicsQuality,
} from './scene/GraphicsConfig.ts';
import {
  HoveredTargetInfo,
  ScenePerformanceMetrics,
  SurvivalScene3D,
} from './scene/SurvivalScene3D.ts';
import {
  HUD_TUNING,
  INVENTORY,
  NEEDS,
  PART5_IMMERSION_TUNING,
  SAVE,
  TIME,
  WILDLIFE,
  WORLD,
} from './survival/config.ts';
import {
  createInitialSurvivalState,
  hitGatherNode,
  tickNodeRespawns,
} from './survival/gathering.ts';
import {
  addItem,
  damageSlotDurability,
  getEquipped,
  ITEM_DEFS,
  removeItem,
  swapSlots,
} from './survival/items.ts';
import {
  advanceClock,
  applyFallDamage,
  computeAmbientTempC,
  consumeInventorySlot,
  interactFreshwaterSpring,
  respawnAtLastBed,
  stepWeather,
  tickNeeds,
} from './survival/needs.ts';
import {
  computeCurrentAct,
  discoverClue,
  getActLabel,
  repairStationSystem,
} from './survival/quests.ts';
import { craftRecipeById } from './survival/recipes.ts';
import {
  loadSurvivalSave,
  sleepAtShelter,
  writeSurvivalSave,
} from './survival/save.ts';
import {
  collectForgeDriftwood,
  depositWoodToForge,
  getNearbyStations,
  interactWithStructure,
  performSpearfishing,
  placeStructure,
  STRUCTURE_CATALOG,
  tickForgeJobs,
  tickStructuresProduction,
  transferChestSlot,
} from './survival/structures.ts';
import {
  BoatStageId,
  ItemId,
  PlayerContext,
  SaveKind,
  StructureType,
  SurvivalState,
  VoyageThrottle,
  WeatherKind,
} from './survival/types.ts';
import {
  anchorRestAtStop,
  buildBoatStage,
  launchEscapeVoyage,
  refuelVoyageFromPack,
  repairVoyageHull,
  resumeVoyageLeg,
  returnToIslandDock,
  scavengeVoyageStop,
  setVoyageThrottle,
  tickVoyage,
} from './survival/voyage.ts';
import { attackWildlife, tickWildlifeAI } from './survival/wildlife.ts';
import {
  canUnlockGate,
  getZoneAt,
  revealMapAround,
  sampleIslandHeight,
  tryUnlockGate,
} from './survival/world.ts';
import { BoatVoyageModal } from './ui/BoatVoyageModal.tsx';
import { BuildModal } from './ui/BuildModal.tsx';
import { CityEndingModal } from './ui/CityEndingModal.tsx';
import { ForgeModal } from './ui/ForgeModal.tsx';
import { InventoryCraftModal } from './ui/InventoryCraftModal.tsx';
import { JournalMapModal, JournalTab } from './ui/JournalMapModal.tsx';
import { StorageModal } from './ui/StorageModal.tsx';
import { PickupToastItem, SurvivalHUD } from './ui/SurvivalHUD.tsx';
import {
  SurvivalDeathModal,
  SurvivalPauseModal,
  SurvivalTitleScreen,
} from './ui/SurvivalModals.tsx';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SurvivalScene3D | null>(null);

  const initialLoad = useMemo(() => {
    const saved = loadSurvivalSave();
    return saved
      ? { state: saved, hasSave: true }
      : { state: createInitialSurvivalState('survivor'), hasSave: false };
  }, []);
  const [hasSave, setHasSave] = useState<boolean>(initialLoad.hasSave);
  const [gameState, setGameState] = useState<SurvivalState>(initialLoad.state);

  const [screen, setScreen] = useState<'title' | 'playing'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'playing' : 'title';
  });
  const showDebug = useMemo(
    () => new URLSearchParams(window.location.search).get('debug') === '1',
    []
  );
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isBuildMenuOpen, setIsBuildMenuOpen] = useState(false);
  const [activeBuildType, setActiveBuildType] = useState<StructureType | null>(null);
  const [openChestId, setOpenChestId] = useState<string | null>(null);
  const [openForgeId, setOpenForgeId] = useState<string | null>(null);
  const [isBoatDockOpen, setIsBoatDockOpen] = useState(false);
  const [journalTab, setJournalTab] = useState<JournalTab | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() =>
    loadGraphicsQuality(false)
  );
  const [extSettings, setExtSettings] = useState<ExtendedGraphicsSettings>(() =>
    loadExtendedGraphicsSettings()
  );
  const [showPerfOverlay, setShowPerfOverlay] = useState<boolean>(false);
  const [perfMetrics, setPerfMetrics] = useState<ScenePerformanceMetrics | null>(null);
  const [pickupToasts, setPickupToasts] = useState<PickupToastItem[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [showControlsHint, setShowControlsHint] = useState(true);
  const [sleepFadeAlpha, setSleepFadeAlpha] = useState(0);
  const [playerYaw, setPlayerYaw] = useState(0);
  const [oxygen, setOxygen] = useState(100);
  const [holdInteractProgress, setHoldInteractProgress] = useState(0);
  const [photoMode, setPhotoMode] = useState(false);
  const [photoFilter, setPhotoFilter] = useState(0);
  const [captions, setCaptions] = useState<Array<{ id: string; text: string }>>([]);
  const [dismissedHints, setDismissedHints] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('stranded_tutorial_hints_v1');
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  const [hoveredTarget, setHoveredTarget] = useState<HoveredTargetInfo | null>(null);
  const [playerContext, setPlayerContext] = useState<PlayerContext>({
    isMoving: false,
    isSprinting: false,
    isSwimming: false,
    nearFire: false,
    sheltered: false,
    holdingLitTorch: false,
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveBadgeText, setSaveBadgeText] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [damageFlash, setDamageFlash] = useState(false);
  const [causeOfDeath, setCauseOfDeath] = useState<string>('exposure');

  const statusTimerRef = useRef<number>(0);
  const saveBadgeTimerRef = useRef<number>(0);
  const lastGateMsgMsRef = useRef<number>(0);
  const lastBiteToastMsRef = useRef<number>(0);
  const lastActToastRef = useRef<number>(initialLoad.state.act);
  const prevTideWaterRef = useRef<number>(WORLD.WATER_LEVEL);
  const lastTideWashHourRef = useRef<number>(-99);

  const dismissTutorialHint = (hintId: string) => {
    setDismissedHints((prev) => {
      const next = { ...prev, [hintId]: true };
      try {
        localStorage.setItem('stranded_tutorial_hints_v1', JSON.stringify(next));
      } catch {
        // Ignore storage quota issues
      }
      return next;
    });
  };

  useEffect(() => {
    if (!extSettings.closedCaptions) {
      audio.setCaptionCallback(null);
      setCaptions([]);
      return;
    }
    audio.setCaptionCallback((text) => {
      const id = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setCaptions((prev) => [...prev.slice(-2), { id, text }]);
      window.setTimeout(() => {
        setCaptions((prev) => prev.filter((c) => c.id !== id));
      }, 3000);
    });
    return () => audio.setCaptionCallback(null);
  }, [extSettings.closedCaptions]);

  const pushPickupToast = (text: string, icon?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setPickupToasts((prev) => [...prev.slice(-3), { id, text, icon }]);
    window.setTimeout(() => {
      setPickupToasts((prev) => prev.filter((t) => t.id !== id));
    }, HUD_TUNING.PICKUP_TOAST_DURATION_MS);
  };

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage(null);
    }, 3800);
  };

  const applyActPromotion = (s: SurvivalState): SurvivalState => {
    const nextAct = computeCurrentAct(s);
    if (nextAct > s.act) {
      if (nextAct > lastActToastRef.current) {
        lastActToastRef.current = nextAct;
        queueMicrotask(() => showStatus(`Act ${nextAct} Reached: ${getActLabel(nextAct)}!`));
      }
      return { ...s, act: nextAct };
    }
    return s;
  };

  const triggerSaveBadge = (label: string) => {
    setSaveBadgeText(label);
    window.clearTimeout(saveBadgeTimerRef.current);
    saveBadgeTimerRef.current = window.setTimeout(() => {
      setSaveBadgeText(null);
    }, 2800);
  };

  const triggerDamageFeedback = () => {
    setDamageFlash(true);
    sceneRef.current?.triggerDamageJolt();
    window.setTimeout(() => setDamageFlash(false), 220);
  };

  const cancelBuildMode = () => {
    setActiveBuildType(null);
    sceneRef.current?.setBuildPreviewType(null);
  };

  type ActivePanel = 'inventory' | 'build' | 'journal' | 'map' | 'chest' | 'forge' | 'boatDock';

  const closeAllMenusAndLock = (options?: { relockPointer?: boolean }) => {
    setIsInventoryOpen(false);
    setIsBuildMenuOpen(false);
    setIsBoatDockOpen(false);
    setOpenChestId(null);
    setOpenForgeId(null);
    setJournalTab(null);
    setIsPaused(false);
    sceneRef.current?.setUiBlocked(false);
    if (options?.relockPointer !== false) {
      sceneRef.current?.lockPointer();
    }
  };

  const openPanel = (panel: 'inventory' | 'build' | 'journal' | 'map') => {
    sceneRef.current?.triggerActionAnimation('map_look');
    audio.playPaperRustle();
    cancelBuildMode();
    setIsInventoryOpen(panel === 'inventory');
    setIsBuildMenuOpen(panel === 'build');
    setIsBoatDockOpen(false);
    setOpenChestId(null);
    setOpenForgeId(null);
    setJournalTab(panel === 'journal' ? 'objectives' : panel === 'map' ? 'map' : null);
    sceneRef.current?.setUiBlocked(true);
    sceneRef.current?.unlockPointer();
  };

  const currentPanel: ActivePanel | null = isBoatDockOpen
    ? 'boatDock'
    : openChestId !== null
      ? 'chest'
      : openForgeId !== null
        ? 'forge'
        : isBuildMenuOpen
          ? 'build'
          : isInventoryOpen
            ? 'inventory'
            : journalTab === 'map'
              ? 'map'
              : journalTab !== null
                ? 'journal'
                : null;

  const togglePanel = (panel: 'inventory' | 'build' | 'journal' | 'map') => {
    if (currentPanel === panel) {
      closeAllMenusAndLock({ relockPointer: true });
    } else {
      openPanel(panel);
    }
  };

  const isUiModalOpen =
    screen !== 'playing' ||
    isInventoryOpen ||
    isBuildMenuOpen ||
    isBoatDockOpen ||
    gameState.voyage.phase === 'stopover' ||
    gameState.voyage.phase === 'arrived' ||
    openChestId !== null ||
    openForgeId !== null ||
    journalTab !== null ||
    isPaused ||
    !gameState.alive;

  // Keep latest state in a ref for callbacks mounted once
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const commitAndSave = (nextState: SurvivalState, kind: SaveKind, badgeLabel?: string) => {
    const saved = writeSurvivalSave(nextState, kind);
    setGameState(saved);
    setHasSave(true);
    triggerSaveBadge(badgeLabel ?? (kind === 'bed' ? 'Saved at Shelter' : 'Autosaved'));
  };

  // Periodic rolling autosave + flush before page unload
  useEffect(() => {
    if (screen !== 'playing') return;
    const autoId = window.setInterval(() => {
      if (!stateRef.current.alive) return;
      const saved = writeSurvivalSave(stateRef.current, 'autosave');
      setGameState(saved);
      setHasSave(true);
      triggerSaveBadge('Autosaved');
    }, SAVE.AUTOSAVE_REAL_SEC * 1000);

    const onUnload = () => {
      writeSurvivalSave(stateRef.current, 'autosave');
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.clearInterval(autoId);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [screen]);

  // Sync state changes to the 3D scene
  useEffect(() => {
    sceneRef.current?.syncState(gameState);
  }, [gameState]);

  // Block/unblock pointer lock when UI modals open
  useEffect(() => {
    sceneRef.current?.setUiBlocked(isUiModalOpen);
  }, [isUiModalOpen]);

  // Primary interaction handler ([E] or Left Click)
  const handlePrimaryAction = (target: HoveredTargetInfo | null) => {
    const current = stateRef.current;
    if (!current.alive) return;

    // 0. Place structure when active in Build Mode ([B])
    if (activeBuildType) {
      const placement = sceneRef.current?.getBuildPlacementTarget(activeBuildType);
      if (!placement) return;
      const res = placeStructure(
        current,
        activeBuildType,
        placement.x,
        placement.y,
        placement.z,
        placement.yaw
      );
      if (!res.ok) {
        showStatus(res.message);
        return;
      }
      audio.playBuild();
      sceneRef.current?.triggerActionAnimation('place');
      cancelBuildMode();
      commitAndSave(res.state, 'bed', `${STRUCTURE_CATALOG[activeBuildType].name} Built`);
      showStatus(res.message);
      return;
    }

    // 1. Place Campfire Kit or Shelter Kit if equipped
    const equipped = getEquipped(current.inventory, current.selectedSlot);
    if (equipped.def?.id === 'campfire_kit') {
      const pt = sceneRef.current?.getPlacementPointInFront();
      if (!pt) {
        showStatus('Move onto dry ground above the tide line to build a campfire.');
        return;
      }
      const rem = removeItem(current.inventory, 'campfire_kit', 1);
      if (!rem.success) return;

      const newFire = {
        id: `fire_${Date.now()}`,
        x: pt.x,
        y: pt.y,
        z: pt.z,
      };
      audio.playBuild();
      audio.playSparkIgnite();
      sceneRef.current?.spawnSparkBurst(new THREE.Vector3(pt.x, pt.y, pt.z));
      sceneRef.current?.triggerActionAnimation('place');
      commitAndSave(
        {
          ...current,
          inventory: rem.inventory,
          campfires: [...(current.campfires ?? []), newFire],
          spawnPoint: { x: pt.x, y: pt.y, z: pt.z + 2.2, yaw: current.player.yaw },
        },
        'bed',
        'Campfire Saved'
      );
      showStatus('Built Stone Ring Campfire! Respawn point updated & game saved.');
      return;
    }

    if (equipped.def?.id === 'shelter_kit') {
      const pt = sceneRef.current?.getPlacementPointInFront();
      if (!pt) {
        showStatus('Step onto dry flat ground above the tide line to build your shelter.');
        return;
      }
      const rem = removeItem(current.inventory, 'shelter_kit', 1);
      if (!rem.success) return;

      const yaw = sceneRef.current?.getPlayerYaw() ?? current.player.yaw;
      const newShelter = {
        id: `shelter_${Date.now()}`,
        x: pt.x,
        y: pt.y,
        z: pt.z,
        yaw,
        builtDay: current.clock.day,
      };
      audio.playBuild();
      sceneRef.current?.triggerActionAnimation('place');
      commitAndSave(
        {
          ...current,
          inventory: rem.inventory,
          shelters: [...(current.shelters ?? []), newShelter],
          spawnPoint: { x: pt.x, y: pt.y, z: pt.z + 2.1, yaw },
        },
        'bed',
        'Shelter Saved'
      );
      showStatus('Built Palm Lean-To Shelter! Interact with it to sleep till dawn & save.');
      return;
    }

    if (!target) return;

    // 2. Inspect Story Clue
    if (target.kind === 'clue' && target.clueDef) {
      const res = discoverClue(current, target.clueDef.id);
      audio.playPickup();
      const clueY = sampleIslandHeight(target.clueDef.x, target.clueDef.z, WORLD.ISLAND_RADIUS);
      sceneRef.current?.triggerPickupAnimation(
        new THREE.Vector3(target.clueDef.x, clueY + 0.35, target.clueDef.z),
        'waist'
      );
      if (res.newlyFound) {
        commitAndSave(applyActPromotion(res.state), 'autosave', 'Clue Logged');
        showStatus(
          res.itemGranted
            ? `Logged ${target.clueDef.title} & found ${res.itemGranted}! Press [J] to inspect.`
            : `Logged Clue: ${target.clueDef.title} — Press [J] to read full entry.`
        );
      } else {
        setJournalTab('clues');
      }
      return;
    }

    // 2b. Attack Live Wildlife Fauna
    if (target.kind === 'wildlife' && target.creature) {
      sceneRef.current?.triggerToolSwing();
      const res = attackWildlife(current, target.creature.id);
      if (res.hit) {
        sceneRef.current?.notifyToolImpact();
        audio.playChop();
        const cy =
          sceneRef.current?.getTerrainHeight(target.creature.x, target.creature.z) ??
          current.player.y;
        sceneRef.current?.spawnHarvestDebris(
          'pickup',
          new THREE.Vector3(target.creature.x, cy + 0.45, target.creature.z)
        );
        if (res.killed) {
          audio.playPickup();
          commitAndSave(res.state, 'autosave');
        } else {
          setGameState(res.state);
        }
      }
      showStatus(res.message);
      return;
    }

    // 2c. Repair Research Station Equipment (Act 3)
    if (target.kind === 'station_repair' && target.repairId) {
      const res = repairStationSystem(current, target.repairId);
      if (res.ok) {
        audio.playCraft();
        sceneRef.current?.triggerActionAnimation('craft');
        commitAndSave(applyActPromotion(res.state), 'autosave', 'Station System Online');
      }
      showStatus(res.message);
      return;
    }

    // 2d. Open Escape Boat Slipway & Dockyard (Act 4)
    if (target.kind === 'boat_dock') {
      setIsInventoryOpen(false);
      setIsBuildMenuOpen(false);
      setOpenChestId(null);
      setJournalTab(null);
      setIsBoatDockOpen(true);
      return;
    }

    // 3. Sleep in Shelter (Smooth lie-down cinematic -> advance night, heal, bed save -> wake up)
    if (target.kind === 'shelter' && target.shelterId) {
      const shelter = current.shelters.find((s) => s.id === target.shelterId);
      if (!shelter) return;
      if (sceneRef.current) {
        showStatus('Resting in shelter...');
        sceneRef.current.startSleepCinematic(shelter, () => {
          const slept = sleepAtShelter(stateRef.current, shelter);
          audio.playCraft();
          commitAndSave(slept.state, 'bed', 'Slept & Saved');
          showStatus(slept.message);
        });
      } else {
        const slept = sleepAtShelter(current, shelter);
        audio.playCraft();
        commitAndSave(slept.state, 'bed', 'Slept & Saved');
        showStatus(slept.message);
      }
      return;
    }

    // 4. Inspect or Unlock Island Progression Gate
    if (target.kind === 'gate' && target.gateDef) {
      if (canUnlockGate(target.gateDef, current.inventory)) {
        const res = tryUnlockGate(current, target.gateDef.id);
        if (res.ok) {
          audio.playBuild();
          sceneRef.current?.triggerActionAnimation('place');
          commitAndSave(applyActPromotion(res.state), 'autosave', 'Passage Opened');
          showStatus(res.message);
          return;
        }
      }
      showStatus(target.gateDef.blockedMessage);
      return;
    }

    // 5. Open Campfire Cooking/Boiling Menu
    if (target.kind === 'campfire') {
      setIsInventoryOpen(true);
      return;
    }

    // 5b. Interact with placed Stage 4 Base Structures
    if (target.kind === 'structure' && target.structureDef) {
      const res = interactWithStructure(current, target.structureDef.id, current.weather);
      if (res.sound === 'drink') {
        audio.playDrink();
        sceneRef.current?.triggerActionAnimation('drink');
      } else if (res.sound === 'pickup') {
        audio.playPickup();
        sceneRef.current?.triggerPickupAnimation(
          new THREE.Vector3(target.structureDef.x, target.structureDef.y + 0.5, target.structureDef.z),
          'waist'
        );
      } else if (res.sound === 'craft') {
        audio.playCraft();
        sceneRef.current?.triggerActionAnimation('craft');
      }

      if (res.openModal === 'craft') {
        openPanel('inventory');
        return;
      }
      if (res.openModal === 'storage') {
        cancelBuildMode();
        setOpenForgeId(null);
        setOpenChestId(target.structureDef.id);
        sceneRef.current?.setUiBlocked(true);
        sceneRef.current?.unlockPointer();
        return;
      }
      if (res.openModal === 'forge') {
        cancelBuildMode();
        setOpenChestId(null);
        setOpenForgeId(target.structureDef.id);
        sceneRef.current?.setUiBlocked(true);
        sceneRef.current?.unlockPointer();
        return;
      }
      if (res.state !== current) {
        commitAndSave(res.state, 'autosave');
      }
      showStatus(res.message);
      return;
    }

    // 5c. Spearfish swimming Lagoon Reef Fish
    if (target.kind === 'fish_school') {
      sceneRef.current?.triggerToolSwing();
      const res = performSpearfishing(current);
      if (res.caught) {
        audio.playPickup();
        pushPickupToast('+1 Raw Fish', ITEM_DEFS.raw_fish.icon);
        if (target.fishPos) {
          sceneRef.current?.spawnHarvestDebris(
            'pickup',
            new THREE.Vector3(target.fishPos.x, target.fishPos.y + 0.3, target.fishPos.z)
          );
        }
        setGameState(res.state);
      }
      showStatus(res.message);
      return;
    }

    // 6. Drink or Fill Bottle at Freshwater Spring
    if (target.kind === 'spring') {
      const res = interactFreshwaterSpring(current);
      audio.playDrink();
      sceneRef.current?.triggerActionAnimation('drink_spring');
      if (res.gotSick) {
        audio.playHurt();
        triggerDamageFeedback();
      }
      setGameState(res.state);
      showStatus(res.message);
      return;
    }

    // 7. Harvest Gathering Node
    if (target.kind === 'node' && target.nodeDef) {
      const isPickupKind =
        target.nodeDef.type === 'loose_stone' ||
        target.nodeDef.type === 'flint_nodule' ||
        target.nodeDef.type === 'coconut' ||
        target.nodeDef.type === 'shell_cluster' ||
        target.nodeDef.type === 'herb_patch' ||
        target.nodeDef.type === 'berry_bush' ||
        target.nodeDef.type === 'supply_crate';
      if (isPickupKind) {
        const pickupHeight =
          target.nodeDef.type === 'berry_bush'
            ? 'bush'
            : target.nodeDef.type === 'supply_crate'
              ? 'waist'
              : 'ground';
        sceneRef.current?.triggerPickupAnimation(
          new THREE.Vector3(target.nodeDef.x, target.nodeDef.y + 0.28, target.nodeDef.z),
          pickupHeight
        );
      } else {
        sceneRef.current?.triggerToolSwing();
      }

      const res = hitGatherNode(current, target.nodeDef);
      if (res.sound === 'chop') audio.playChop();
      else if (res.sound === 'mine') audio.playMine();
      else if (res.sound === 'pickup') audio.playPickup();
      if (res.message.includes('broke!')) {
        audio.playToolBreak();
        sceneRef.current?.spawnToolBreakShards();
      }

      if (res.hit) {
        if (res.sound === 'chop' || res.sound === 'mine') {
          sceneRef.current?.notifyToolImpact();
        }
        sceneRef.current?.recordNodeInteraction(
          target.nodeDef.id,
          res.sound,
          res.depleted
        );
        sceneRef.current?.spawnHarvestDebris(
          res.sound === 'blocked' ? 'pickup' : res.sound,
          new THREE.Vector3(target.nodeDef.x, target.nodeDef.y + 0.6, target.nodeDef.z)
        );
      }

      if (res.granted && res.granted.length > 0) {
        for (const g of res.granted) {
          const def = ITEM_DEFS[g.itemId];
          pushPickupToast(`+${g.count} ${def ? def.name : g.itemId}`, def?.icon);
        }
      }

      if (res.depleted && target.nodeDef.type === 'supply_crate') {
        commitAndSave(res.state, 'autosave');
      } else {
        setGameState(res.state);
      }
      showStatus(res.message);
    }
  };

  const handlePrimaryActionRef = useRef(handlePrimaryAction);
  handlePrimaryActionRef.current = handlePrimaryAction;

  // Mount Three.js scene once
  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new SurvivalScene3D(mountRef.current);
    sceneRef.current = scene;
    setGraphicsQuality(scene.getQuality());
    setExtSettings(scene.getExtendedGraphicsSettings());
    scene.syncState(stateRef.current);

    scene.setStanceBlockedCallback((reason) => showStatus(reason));
    scene.setActionAudioCallbacks({
      onSwimStroke: () => audio.playSwimStroke(),
      onTreeFell: () => audio.playWoodCrack(),
      onCough: () => audio.playCough(),
      onShiver: () => audio.playShiverChatter(),
    });
    scene.setPart5Callbacks({
      onPhotoModeChange: (active, filter) => {
        setPhotoMode(active);
        setPhotoFilter(filter);
      },
      onSplash: (intensity) => audio.playSplash(intensity),
      onSpatialAmbience: (data) => audio.updateSpatialAndBiomeAmbience(data),
      onDrowningDamage: (hpLoss) => {
        audio.playHurt();
        audio.playHeartbeat(0.95);
        triggerDamageFeedback();
        setGameState((prev) => {
          if (!prev.alive) return prev;
          const nextHp = Math.max(0, prev.needs.health - hpLoss);
          const died = nextHp <= 0;
          if (died) {
            queueMicrotask(() => {
              audio.playDefeat();
              setCauseOfDeath('drowning');
            });
          }
          return {
            ...prev,
            alive: !died,
            needs: { ...prev.needs, health: nextHp },
          };
        });
      },
    });
    scene.setCallbacks({
      onPrimaryAction: (t) => handlePrimaryActionRef.current(t),
      onOpenCampfireCraft: () => openPanel('inventory'),
      onCancelBuild: () => {
        cancelBuildMode();
        showStatus('Build mode cancelled.');
      },
      onStepSound: (surface) => audio.playStep(surface),
      onThunderStrike: () => audio.playThunder(),
      onJump: () => {
        setGameState((prev) =>
          prev.alive
            ? {
                ...prev,
                needs: {
                  ...prev.needs,
                  stamina: Math.max(0, prev.needs.stamina - NEEDS.STAMINA_JUMP),
                },
              }
            : prev
        );
      },
      onFallImpact: (fallMeters) => {
        const res = applyFallDamage(stateRef.current, fallMeters);
        if (res.damage > 0) {
          audio.playHurt();
          triggerDamageFeedback();
          setGameState(res.state);
          if (res.died) {
            audio.playDefeat();
            setCauseOfDeath('fall');
          } else {
            showStatus(`Hard Landing! (-${res.damage} HP from ${fallMeters.toFixed(1)}m drop)`);
          }
        }
      },
    });

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Core Survival Simulation Tick (runs every 200ms while playing)
  useEffect(() => {
    if (screen !== 'playing' || isPaused) return;

    let lastTick = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const dtSec = Math.min(1.0, (now - lastTick) / 1000);
      lastTick = now;

      const scene = sceneRef.current;
      if (!scene) return;

      const runtime = scene.getPlayerRuntimeSnapshot();
      setHoveredTarget(scene.hoveredTarget ? { ...scene.hoveredTarget } : null);
      setPlayerContext(runtime.context);
      setPlayerYaw(runtime.yaw);
      setOxygen((prev) => (Math.abs(prev - runtime.oxygen) >= 1 ? runtime.oxygen : prev));
      setHoldInteractProgress(runtime.holdInteractProgress);
      setPhotoMode(runtime.photoMode);
      setPhotoFilter(runtime.photoFilter);
      setSleepFadeAlpha((prev) =>
        Math.abs(prev - runtime.sleepFadeAlpha) > 0.015 ? runtime.sleepFadeAlpha : prev
      );
      if (showDebug || showPerfOverlay) {
        setFps(runtime.fps);
        setPerfMetrics(scene.getPerformanceMetrics());
      }
      if (runtime.photoMode) {
        return;
      }

      if (runtime.bumpedGate) {
        const nowMs = performance.now();
        if (nowMs - lastGateMsgMsRef.current > 2600) {
          lastGateMsgMsRef.current = nowMs;
          const gateMsg = canUnlockGate(runtime.bumpedGate, stateRef.current.inventory)
            ? `Look at ${runtime.bumpedGate.name} and press [E / Click] to unlock it!`
            : runtime.bumpedGate.blockedMessage;
          showStatus(gateMsg);
        }
      }

      setGameState((prev) => {
        if (!prev.alive) return prev;

        if (prev.voyage.phase !== 'docked') {
          if (prev.voyage.phase !== 'sailing') {
            return prev;
          }
          const vRes = tickVoyage(prev, dtSec);
          audio.updateAmbience({
            distanceToOcean: 0,
            rainIntensity: vRes.state.weather.rain,
            windSpeed: vRes.state.weather.wind,
            nearCampfire: false,
            isNight:
              vRes.state.clock.hour >= TIME.NIGHT_START_HOUR ||
              vRes.state.clock.hour < TIME.DAY_START_HOUR,
            tenseFactor: Math.min(
              1,
              (vRes.state.weather.kind === 'storm' ? 0.85 : 0.25) +
                (vRes.state.voyage.hullIntegrity < 45 ? 0.3 : 0)
            ),
            health: vRes.state.needs.health,
            hypothermia: vRes.state.needs.temperature < 35.4,
          });
          if (vRes.shipwrecked) {
            queueMicrotask(() => {
              audio.playDefeat();
              triggerDamageFeedback();
              setCauseOfDeath('drowning');
            });
          } else if (vRes.reachedCity) {
            queueMicrotask(() => {
              audio.playVictoryFanfare();
              audio.playArrivalTheme();
              showStatus('Port Solis Coastguard Quay reached — You escaped the island!');
              writeSurvivalSave(applyActPromotion(vRes.state), 'autosave');
            });
          } else if (vRes.arrivedStop) {
            queueMicrotask(() => {
              audio.playCraft();
              showStatus(`Anchored at ${vRes.arrivedStop!.name}. Scavenge supplies or rest.`);
            });
          }
          return applyActPromotion(vRes.state);
        }

        // 1. Advance Day/Night clock & Weather
        const { clock: nextClock } = advanceClock(prev.clock, dtSec);
        const nextWeather = stepWeather(prev.weather, nextClock.totalHours);
        const currentZone = getZoneAt(runtime.x, runtime.z);
        const caveChill = currentZone === 'basalt_caves' ? SAVE.CAVE_CHILL_C : 0;
        const ambientC = computeAmbientTempC(nextClock, nextWeather) - caveChill;

        // 2. Tick Needs & Temperature
        const needRes = tickNeeds(
          prev.needs,
          dtSec,
          ambientC,
          nextWeather,
          runtime.context,
          prev.difficulty
        );

        // 2b. Tick Island Wildlife AI & Fauna Attacks
        const isNight =
          nextClock.hour >= TIME.NIGHT_START_HOUR || nextClock.hour < TIME.DAY_START_HOUR;
        const aiRes = tickWildlifeAI(
          prev.wildlife ?? [],
          { x: runtime.x, z: runtime.z },
          nextClock.totalHours,
          dtSec,
          isNight,
          prev.difficulty
        );
        let nextNeeds = needRes.needs;
        let diedByAnimal = false;
        if (aiRes.damageToPlayer > 0 && !needRes.died) {
          nextNeeds = {
            ...nextNeeds,
            health: Math.max(0, nextNeeds.health - aiRes.damageToPlayer),
            sickness: aiRes.poisonedPlayer
              ? Math.max(nextNeeds.sickness, WILDLIFE.VIPER_VENOM_SEC)
              : nextNeeds.sickness,
          };
          diedByAnimal = nextNeeds.health <= 0;
          const nowMs = performance.now();
          if (nowMs - lastBiteToastMsRef.current > 650) {
            lastBiteToastMsRef.current = nowMs;
            queueMicrotask(() => {
              audio.playAnimalBite();
              triggerDamageFeedback();
              if (aiRes.attackerMessage) {
                showStatus(aiRes.attackerMessage);
              }
            });
          }
        }

        // 3. Burn equipped torch / lantern durability over time
        let nextInventory = prev.inventory;
        if (runtime.context.holdingLitTorch) {
          const torchDmg = damageSlotDurability(nextInventory, prev.selectedSlot, dtSec);
          nextInventory = torchDmg.inventory;
        }

        // 4. Respawn renewable nodes whose timer elapsed, tide wash-up, structures & expand Fog-of-War
        const deltaGameHours = Math.max(0, nextClock.totalHours - prev.clock.totalHours);
        let nextNodes = tickNodeRespawns(prev.nodes, nextClock.totalHours);
        const tideThreshold = WORLD.WATER_LEVEL + PART5_IMMERSION_TUNING.TIDE_AMPLITUDE_M * 0.45;
        if (
          prevTideWaterRef.current >= tideThreshold &&
          runtime.waterLevel < tideThreshold &&
          nextClock.totalHours - lastTideWashHourRef.current >= 5
        ) {
          lastTideWashHourRef.current = nextClock.totalHours;
          let washedUp = 0;
          const refreshedNodes: typeof nextNodes = { ...nextNodes };
          for (const [nId, nSt] of Object.entries(refreshedNodes)) {
            if (nSt.remaining <= 0 && (nId.includes('driftwood') || nId.includes('kelp') || nId.includes('coconut'))) {
              refreshedNodes[nId] = { remaining: 1, respawnAt: null };
              washedUp += 1;
              if (washedUp >= 2) break;
            }
          }
          if (washedUp > 0) {
            nextNodes = refreshedNodes;
            queueMicrotask(() => showStatus('Receding tide washed fresh coastal salvage ashore!'));
          }
        }
        prevTideWaterRef.current = runtime.waterLevel;
        const producedStructures = tickStructuresProduction(
          prev.structures ?? [],
          deltaGameHours,
          nextWeather
        );
        const nextStructures = tickForgeJobs(producedStructures, dtSec);
        const nextCells = revealMapAround(prev.discoveredCells, runtime.x, runtime.z);

        // Update procedural ambient & adaptive soundscape
        const distFromCoast = Math.max(
          0,
          WORLD.ISLAND_RADIUS - Math.hypot(runtime.x, runtime.z)
        );
        const inCave = currentZone === 'basalt_caves';
        const stormTension = nextWeather.kind === 'storm' ? 0.65 : nextWeather.rain * 0.35;
        const hpTension = nextNeeds.health < 45 ? 0.35 : 0;
        const nightTension = isNight && !runtime.context.nearFire ? 0.38 : isNight ? 0.16 : 0;
        const tenseFactor = Math.min(
          1,
          (inCave ? 0.68 : 0.08) + stormTension + nightTension + hpTension
        );
        audio.updateAmbience({
          distanceToOcean: distFromCoast * 12,
          rainIntensity: nextWeather.rain,
          windSpeed: nextWeather.wind,
          nearCampfire: runtime.context.nearFire,
          isNight,
          inCave,
          tenseFactor,
          health: nextNeeds.health,
          hypothermia: nextNeeds.temperature < 35.4,
        });

        const totalDead = needRes.died || diedByAnimal;
        if (totalDead) {
          queueMicrotask(() => {
            audio.playDefeat();
            setCauseOfDeath(needRes.causeOfDeath ?? 'wildlife');
          });
        }

        const nextCandidate: SurvivalState = {
          ...prev,
          clock: nextClock,
          weather: nextWeather,
          needs: nextNeeds,
          alive: !totalDead,
          inventory: nextInventory,
          nodes: nextNodes,
          structures: nextStructures,
          wildlife: aiRes.wildlife,
          discoveredCells: nextCells,
          player: {
            x: runtime.x,
            y: runtime.y,
            z: runtime.z,
            yaw: runtime.yaw,
          },
          stats: {
            ...prev.stats,
            distanceTravelled: prev.stats.distanceTravelled + runtime.distanceDelta,
            playTimeSec: prev.stats.playTimeSec + dtSec,
          },
        };
        const promotedAct = computeCurrentAct(nextCandidate);
        if (promotedAct > nextCandidate.act) {
          if (promotedAct > lastActToastRef.current) {
            lastActToastRef.current = promotedAct;
            queueMicrotask(() => showStatus(`Act ${promotedAct} Reached: ${getActLabel(promotedAct)}!`));
          }
          nextCandidate.act = promotedAct;
        }
        return nextCandidate;
      });
    }, 200);

    return () => window.clearInterval(interval);
  }, [screen, isPaused, showDebug, showPerfOverlay]);

  // Auto-hide controls hint ribbon after the first few minutes of active play (toggle anytime with H)
  useEffect(() => {
    if (screen !== 'playing') return;
    const tid = window.setTimeout(() => {
      setShowControlsHint(false);
    }, HUD_TUNING.HINT_AUTO_HIDE_SEC * 1000);
    return () => window.clearTimeout(tid);
  }, [screen]);

  // Global keyboard shortcuts (Hotbar 1–6, [B] Build, [Tab]/[I]/[C] Craft, [J] Journal, [M] Map, [H] Hints, [F] Consume, [F3] Perf Overlay, [Esc])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'playing' || !stateRef.current.alive) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'F3') {
        e.preventDefault();
        setShowPerfOverlay((prev) => {
          const next = !prev;
          if (next && sceneRef.current) {
            setPerfMetrics(sceneRef.current.getPerformanceMetrics());
          }
          return next;
        });
        return;
      }

      if (isPaused) {
        if (e.code === 'Escape') {
          e.preventDefault();
          closeAllMenusAndLock({ relockPointer: true });
        }
        return;
      }

      if (e.code === 'Tab' || e.code === 'KeyI') {
        e.preventDefault();
        togglePanel('inventory');
        return;
      }

      if (e.code === 'KeyB') {
        e.preventDefault();
        togglePanel('build');
        return;
      }

      if (e.code === 'KeyR' && activeBuildType && !isUiModalOpen) {
        e.preventDefault();
        sceneRef.current?.rotateBuildPreview();
        return;
      }

      if (e.code === 'KeyJ') {
        e.preventDefault();
        togglePanel('journal');
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        togglePanel('map');
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (currentPanel !== null) {
          closeAllMenusAndLock({ relockPointer: true });
        } else if (activeBuildType !== null) {
          cancelBuildMode();
        } else {
          sceneRef.current?.setUiBlocked(true);
          sceneRef.current?.unlockPointer();
          setIsPaused(true);
        }
        return;
      }

      if (e.code.startsWith('Digit')) {
        const num = Number(e.code.replace('Digit', ''));
        if (num >= 1 && num <= INVENTORY.HOTBAR_SIZE) {
          setGameState((prev) => ({ ...prev, selectedSlot: num - 1 }));
        }
        return;
      }

      if (e.code === 'KeyF' && !isUiModalOpen) {
        const equipped = getEquipped(stateRef.current.inventory, stateRef.current.selectedSlot);
        const isConsumable =
          !e.shiftKey &&
          equipped.def !== null &&
          (equipped.def.food !== undefined || equipped.def.id === 'medicinal_poultice');
        if (isConsumable) {
          handleConsumeSlot(stateRef.current.selectedSlot);
        } else {
          const inspecting = sceneRef.current?.toggleInspectItem() ?? false;
          if (inspecting) {
            showStatus(`Inspecting ${equipped.def?.name ?? 'Hands'} [F / T]`);
          }
        }
        return;
      }

      if (e.code === 'KeyT' && !isUiModalOpen) {
        const equipped = getEquipped(stateRef.current.inventory, stateRef.current.selectedSlot);
        const inspecting = sceneRef.current?.toggleInspectItem() ?? false;
        if (inspecting) {
          showStatus(`Inspecting ${equipped.def?.name ?? 'Hands'} [T]`);
        }
        return;
      }

      if (e.code === 'KeyH' && !isUiModalOpen) {
        e.preventDefault();
        setShowControlsHint((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    screen,
    isPaused,
    currentPanel,
    activeBuildType,
    isUiModalOpen,
  ]);

  const handleConsumeSlot = (slotIdx: number) => {
    const consumedItemId = stateRef.current.inventory[slotIdx]?.itemId;
    const res = consumeInventorySlot(stateRef.current, slotIdx);
    if (!res.consumed) {
      showStatus(res.message);
      return;
    }
    if (consumedItemId === 'medicinal_poultice') {
      audio.playBandageWrap();
      sceneRef.current?.triggerActionAnimation('bandage');
    } else if (consumedItemId?.startsWith('water_') || consumedItemId === 'coconut') {
      audio.playDrink();
      sceneRef.current?.triggerActionAnimation('drink');
    } else {
      audio.playEat();
      sceneRef.current?.triggerActionAnimation('eat');
    }
    if (res.gotSick) {
      audio.playHurt();
      triggerDamageFeedback();
    }
    const nextState: SurvivalState =
      consumedItemId === 'water_bottle_clean'
        ? { ...res.state, flags: { ...res.state.flags, drank_water_bottle_clean: true } }
        : res.state;
    setGameState(nextState);
    showStatus(res.message);
  };

  const handleCraftRecipe = (recipeId: string) => {
    const stations = getNearbyStations(stateRef.current);

    const res = craftRecipeById(
      recipeId,
      stateRef.current.inventory,
      stations,
      stateRef.current.flags
    );
    if (!res.ok) {
      showStatus(res.message);
      return;
    }
    audio.playCraft();
    sceneRef.current?.triggerActionAnimation('craft');
    const cur = stateRef.current;
    const nextFlags = {
      ...cur.flags,
      [`crafted_${recipeId}`]: true,
      ...(recipeId === 'boil_water' ? { cooked_boil_water: true } : {}),
    };
    commitAndSave(
      applyActPromotion({
        ...cur,
        inventory: res.inventory,
        flags: nextFlags,
        stats: {
          ...cur.stats,
          itemsCrafted: cur.stats.itemsCrafted + 1,
        },
      }),
      'autosave',
      'Saved'
    );
    showStatus(res.message);
  };

  const handleDebugTeleport = (dest: 'beach' | 'camp' | 'caves' | 'ruins' | 'station' | 'dock') => {
    const spots: Record<typeof dest, { x: number; z: number; label: string }> = {
      beach: { x: WORLD.PLAYER_SPAWN.x, z: WORLD.PLAYER_SPAWN.z, label: 'Southern Beach' },
      camp: {
        x: WORLD.ABANDONED_CAMP_POS.x,
        z: WORLD.ABANDONED_CAMP_POS.z + 4,
        label: 'Abandoned Camp',
      },
      caves: { x: WORLD.CAVE_GROTTO_POS.x, z: WORLD.CAVE_GROTTO_POS.z + 8, label: 'Obsidian Caves' },
      ruins: { x: WORLD.ANCIENT_RUINS_POS.x, z: WORLD.ANCIENT_RUINS_POS.z + 8, label: 'Ancient Ruins' },
      station: {
        x: WORLD.RESEARCH_STATION_POS.x,
        z: WORLD.RESEARCH_STATION_POS.z + 10,
        label: 'Research Station',
      },
      dock: {
        x: WORLD.BOAT_DOCK_POS.x,
        z: WORLD.BOAT_DOCK_POS.z - 6,
        label: 'Southern Boat Slipway Dock',
      },
    };
    const spot = spots[dest];
    const yaw = dest === 'dock' ? Math.PI : stateRef.current.player.yaw;
    setGameState((prev) => ({
      ...prev,
      player: { ...prev.player, x: spot.x, z: spot.z, yaw },
    }));
    sceneRef.current?.snapPlayerToGround(spot.x, spot.z, yaw);
    showStatus(`Debug TP: ${spot.label}`);
  };

  const handleDebugStage6Setup = () => {
    const stage6Grants: Array<[ItemId, number]> = [
      ['log', 12],
      ['plank', 16],
      ['rope', 14],
      ['resin', 10],
      ['stick', 10],
      ['cloth_scrap', 8],
      ['metal_ingot', 8],
      ['scrap_metal', 6],
      ['copper_wire', 4],
      ['circuit_board', 2],
      ['fuel_can', 4],
      ['water_bottle_clean', 4],
      ['dried_fish', 5],
    ];
    let inv = stateRef.current.inventory;
    for (const [id, count] of stage6Grants) {
      inv = addItem(inv, id, count).inventory;
    }
    const nextState: SurvivalState = {
      ...stateRef.current,
      act: 4,
      inventory: inv,
      stationRepairs: { radio: true, generator: true, chart: true },
      flags: {
        ...stateRef.current.flags,
        repair_radio: true,
        repair_generator: true,
        repair_chart: true,
      },
      player: {
        ...stateRef.current.player,
        x: WORLD.BOAT_DOCK_POS.x,
        z: WORLD.BOAT_DOCK_POS.z - 6,
        yaw: Math.PI,
      },
    };
    commitAndSave(nextState, 'autosave', 'Stage 6 Kit Ready');
    sceneRef.current?.snapPlayerToGround(
      WORLD.BOAT_DOCK_POS.x,
      WORLD.BOAT_DOCK_POS.z - 6,
      Math.PI
    );
    showStatus('Debug: Station online & boatyard materials stocked at the Boat Dock!');
  };

  const handleBuildBoatStage = (stageId: BoatStageId) => {
    const res = buildBoatStage(stateRef.current, stageId);
    if (res.ok) {
      audio.playBuild();
      commitAndSave(applyActPromotion(res.state), 'autosave', 'Boat Stage Built');
    } else {
      audio.playHurt();
    }
    showStatus(res.message);
  };

  const handleLaunchVoyage = () => {
    const res = launchEscapeVoyage(stateRef.current);
    if (res.ok) {
      audio.playBuild();
      setIsBoatDockOpen(false);
      commitAndSave(applyActPromotion(res.state), 'autosave', 'Set Sail');
    }
    showStatus(res.message);
  };

  const handleSetThrottle = (throttle: VoyageThrottle) => {
    setGameState((prev) => setVoyageThrottle(prev, throttle));
  };

  const handleRepairHull = () => {
    const res = repairVoyageHull(stateRef.current);
    if (res.ok) {
      audio.playBuild();
      setGameState(res.state);
    }
    showStatus(res.message);
  };

  const handleRefuelBoat = () => {
    const res = refuelVoyageFromPack(stateRef.current);
    if (res.ok) {
      audio.playCraft();
      setGameState(res.state);
    }
    showStatus(res.message);
  };

  const handleScavengeStop = () => {
    const res = scavengeVoyageStop(stateRef.current);
    if (res.ok) {
      audio.playPickup();
      commitAndSave(res.state, 'autosave', 'Stop Scavenged');
    }
    showStatus(res.message);
  };

  const handleAnchorRest = () => {
    const res = anchorRestAtStop(stateRef.current);
    if (res.ok) {
      audio.playCraft();
      setGameState(res.state);
    }
    showStatus(res.message);
  };

  const handleResumeVoyageLeg = () => {
    const res = resumeVoyageLeg(stateRef.current);
    if (res.ok) {
      audio.playBuild();
      commitAndSave(applyActPromotion(res.state), 'autosave', 'Voyage Resumed');
    }
    showStatus(res.message);
  };

  const handleReturnToIslandDock = () => {
    const docked = returnToIslandDock(stateRef.current);
    commitAndSave(docked, 'autosave', 'Docked at Island');
    sceneRef.current?.snapPlayerToGround(
      docked.player.x,
      docked.player.z,
      docked.player.yaw
    );
    showStatus('Returned safely to the Southern Boat Slipway Dock.');
  };

  const handleDebugGrantSupplies = () => {
    const grants: Array<[ItemId, number]> = [
      ['stone', 12],
      ['log', 10],
      ['flint', 6],
      ['stick', 8],
      ['machete', 1],
      ['spear', 1],
      ['climbing_gear', 1],
      ['river_raft', 1],
      ['lantern', 1],
      ['copper_wire', 4],
      ['circuit_board', 2],
      ['fuel_can', 2],
      ['metal_ingot', 4],
      ['scrap_metal', 4],
      ['station_keycard', 1],
      ['medicinal_poultice', 2],
    ];
    let inv = stateRef.current.inventory;
    for (const [id, count] of grants) {
      inv = addItem(inv, id, count).inventory;
    }
    setGameState((prev) => ({ ...prev, inventory: inv }));
    showStatus('Debug: Added building supplies, wood, Stage 5 gear & repair parts.');
  };

  const handleDebugAdvanceTime = (hours: number = 4) => {
    setGameState((prev) => {
      let nextHour = prev.clock.hour + hours;
      let nextDay = prev.clock.day;
      while (nextHour >= 24) {
        nextHour -= 24;
        nextDay += 1;
      }
      const nextTotalHours = prev.clock.totalHours + hours;
      const nextWeather = stepWeather(prev.weather, nextTotalHours);
      return {
        ...prev,
        clock: { day: nextDay, hour: nextHour, totalHours: nextTotalHours },
        weather: nextWeather,
        nodes: tickNodeRespawns(prev.nodes, nextTotalHours),
        structures: tickStructuresProduction(prev.structures ?? [], hours, nextWeather),
      };
    });
    showStatus(`Debug: Skipped +${hours}h forward.`);
  };

  const handleDebugCycleWeather = () => {
    const order: Array<WeatherKind | undefined> = ['clear', 'rain', 'storm', undefined];
    const cur = stateRef.current.weather.override;
    const nextIdx = (order.indexOf(cur) + 1) % order.length;
    const nextOverride = order[nextIdx];
    setGameState((prev) => ({
      ...prev,
      weather: stepWeather(
        { ...prev.weather, override: nextOverride },
        prev.clock.totalHours
      ),
    }));
    showStatus(`Debug Weather: ${nextOverride ? nextOverride.toUpperCase() : 'AUTO'}`);
  };

  const handleDebugFastSail = () => {
    setGameState((prev) => {
      if (prev.voyage.phase !== 'sailing') return prev;
      const stepped = tickVoyage(prev, 18);
      return applyActPromotion(stepped.state);
    });
    showStatus('Debug: Fast-forwarded open-ocean voyage leg.');
  };

  const handleChangeGraphicsQuality = (nextQ: GraphicsQuality) => {
    setGraphicsQuality(nextQ);
    sceneRef.current?.setQuality(nextQ);
    showStatus(`Graphics Quality set to ${nextQ.toUpperCase()}.`);
  };

  const handleChangeExtendedSettings = (partial: Partial<ExtendedGraphicsSettings>) => {
    setExtSettings((prev) => {
      const next = { ...prev, ...partial };
      sceneRef.current?.setExtendedGraphicsSettings(next);
      return next;
    });
  };

  const handleStartNewGame = (difficulty: 'survivor' | 'hardcore') => {
    const fresh = createInitialSurvivalState(difficulty);
    lastActToastRef.current = fresh.act;
    commitAndSave(fresh, 'autosave', 'New Game Saved');
    setIsInventoryOpen(false);
    setIsBuildMenuOpen(false);
    setIsBoatDockOpen(false);
    setOpenChestId(null);
    setOpenForgeId(null);
    cancelBuildMode();
    setJournalTab(null);
    setIsPaused(false);
    setShowControlsHint(true);
    setScreen('playing');
    sceneRef.current?.snapPlayerToGround(fresh.player.x, fresh.player.z, fresh.player.yaw);
    showStatus('Washed ashore beside Flight 404. Inspect the wing manifest and gather materials.');
  };

  const handleRespawn = () => {
    const respawned = respawnAtLastBed(gameState);
    commitAndSave(respawned, 'bed', 'Respawn Saved');
    sceneRef.current?.snapPlayerToGround(
      respawned.player.x,
      respawned.player.z,
      respawned.player.yaw
    );
    showStatus('Woke at your last camp. Tools and structures preserved.');
  };

  const nearbyStations = useMemo(() => getNearbyStations(gameState), [gameState]);
  const activeChest = useMemo(
    () => (openChestId ? (gameState.structures ?? []).find((s) => s.id === openChestId) ?? null : null),
    [openChestId, gameState.structures]
  );
  const activeForge = useMemo(
    () => (openForgeId ? (gameState.structures ?? []).find((s) => s.id === openForgeId) ?? null : null),
    [openForgeId, gameState.structures]
  );

  const activeTutorialHint = useMemo(() => {
    if (gameState.voyage.phase !== 'docked' || photoMode) return null;
    if (gameState.stats.itemsGathered === 0 && !dismissedHints['gather_first']) {
      return {
        id: 'gather_first',
        text: 'Tip: Look at branches, stones, or Flight 404 manifests and press [E] or Click to scavenge.',
      };
    }
    if (
      gameState.stats.itemsGathered >= 2 &&
      gameState.campfires.length === 0 &&
      !dismissedHints['craft_fire']
    ) {
      return {
        id: 'craft_fire',
        text: 'Tip: Open Crafting [Tab/I] or Build [B] to kindle a Stone Campfire before nightfall.',
      };
    }
    if (
      gameState.stats.itemsCrafted >= 1 &&
      gameState.campfires.length > 0 &&
      !dismissedHints['photo_mode']
    ) {
      return {
        id: 'photo_mode',
        text: 'Tip: Press [P] anytime to enter Photo Mode and capture scenic island snapshots.',
      };
    }
    return null;
  }, [gameState.stats.itemsGathered, gameState.stats.itemsCrafted, gameState.campfires.length, gameState.voyage.phase, photoMode, dismissedHints]);

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-stone-950 select-none"
      onContextMenu={(e) => {
        if (activeBuildType) {
          e.preventDefault();
          cancelBuildMode();
        }
      }}
    >
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} data-testid="survival-canvas" className="h-full w-full" />

      {screen === 'title' && (
        <SurvivalTitleScreen
          hasSavedGame={hasSave}
          savedDay={gameState.clock.day}
          graphicsQuality={graphicsQuality}
          extSettings={extSettings}
          onChangeGraphicsQuality={handleChangeGraphicsQuality}
          onChangeExtendedSettings={handleChangeExtendedSettings}
          onContinue={() => setScreen('playing')}
          onStartNew={handleStartNewGame}
        />
      )}

      {screen === 'playing' && (
        <SurvivalHUD
          state={gameState}
          playerContext={playerContext}
          hoveredTarget={hoveredTarget}
          statusMessage={statusMessage}
          pickupToasts={pickupToasts}
          saveBadgeText={saveBadgeText}
          activeBuildType={activeBuildType}
          nearbyStations={nearbyStations}
          fps={fps}
          perfMetrics={perfMetrics}
          showPerfOverlay={showPerfOverlay}
          showDebug={showDebug}
          damageFlash={damageFlash}
          sleepFadeAlpha={sleepFadeAlpha}
          playerYaw={playerYaw}
          oxygen={oxygen}
          holdInteractProgress={holdInteractProgress}
          captions={captions}
          tutorialHint={activeTutorialHint}
          onDismissTutorialHint={() =>
            activeTutorialHint && dismissTutorialHint(activeTutorialHint.id)
          }
          photoMode={photoMode}
          photoFilter={photoFilter}
          onTogglePhotoMode={() => sceneRef.current?.togglePhotoMode()}
          onChangePhotoFilter={(idx) => sceneRef.current?.setPhotoFilter(idx)}
          onCapturePhoto={() => {
            const url = sceneRef.current?.capturePhotoSnapshot();
            if (!url) {
              showStatus('Snapshot failed.');
              return;
            }
            const a = document.createElement('a');
            a.href = url;
            a.download = `stranded_day${gameState.clock.day}_${PART5_IMMERSION_TUNING.PHOTO_FILTER_NAMES[photoFilter] ?? 'Natural'}.png`;
            a.click();
            pushPickupToast('Photo Captured!', '📷');
          }}
          isMuted={isMuted}
          showControlsHint={showControlsHint}
          onToggleControlsHint={() => setShowControlsHint((prev) => !prev)}
          onSelectSlot={(idx) => setGameState((prev) => ({ ...prev, selectedSlot: idx }))}
          onUseSelected={() => handleConsumeSlot(gameState.selectedSlot)}
          onOpenInventory={() => openPanel('inventory')}
          onOpenBuild={() => openPanel('build')}
          onCancelBuild={cancelBuildMode}
          onOpenJournal={() => openPanel('journal')}
          onOpenMap={() => openPanel('map')}
          onTogglePause={() => {
            if (isPaused) {
              closeAllMenusAndLock({ relockPointer: true });
            } else {
              closeAllMenusAndLock({ relockPointer: false });
              setIsPaused(true);
              sceneRef.current?.setUiBlocked(true);
              sceneRef.current?.unlockPointer();
            }
          }}
          onToggleMute={() => setIsMuted(audio.toggleMute())}
          onDebugTeleport={handleDebugTeleport}
          onDebugGrantSupplies={handleDebugGrantSupplies}
          onDebugStage6Setup={handleDebugStage6Setup}
          onDebugAdvanceTime={() => handleDebugAdvanceTime(4)}
          onDebugCycleWeather={handleDebugCycleWeather}
          onDebugFastSail={handleDebugFastSail}
        />
      )}

      {screen === 'playing' && (
        <BoatVoyageModal
          state={gameState}
          isDockOpen={isBoatDockOpen}
          onCloseDock={() => closeAllMenusAndLock({ relockPointer: true })}
          onBuildStage={handleBuildBoatStage}
          onLaunchVoyage={handleLaunchVoyage}
          onSetThrottle={handleSetThrottle}
          onRepairHull={handleRepairHull}
          onRefuel={handleRefuelBoat}
          onScavengeStop={handleScavengeStop}
          onAnchorRest={handleAnchorRest}
          onResumeLeg={handleResumeVoyageLeg}
          onReturnToDock={handleReturnToIslandDock}
          onConsumeItemSlot={handleConsumeSlot}
        />
      )}

      {screen === 'playing' && (
        <CityEndingModal
          state={gameState}
          onReturnToIslandDock={handleReturnToIslandDock}
          onStartNewExpedition={() => handleStartNewGame(gameState.difficulty)}
        />
      )}

      <BuildModal
        isOpen={isBuildMenuOpen}
        state={gameState}
        onSelectBuild={(type) => {
          setIsBuildMenuOpen(false);
          setActiveBuildType(type);
          sceneRef.current?.setBuildPreviewType(type);
          sceneRef.current?.setUiBlocked(false);
          sceneRef.current?.lockPointer();
          showStatus(
            `Aim at ${
              STRUCTURE_CATALOG[type].surface === 'shallow_water' ? 'shallow water' : 'dry ground'
            } and press [E / Click] to place ${STRUCTURE_CATALOG[type].name}.`
          );
        }}
        onClose={() => closeAllMenusAndLock({ relockPointer: true })}
      />

      <StorageModal
        chest={activeChest}
        state={gameState}
        onTransfer={(chestId, fromChest, slotIdx) => {
          audio.playPickup();
          commitAndSave(transferChestSlot(stateRef.current, chestId, fromChest, slotIdx), 'autosave');
        }}
        onClose={() => closeAllMenusAndLock({ relockPointer: true })}
      />

      <ForgeModal
        forge={activeForge}
        state={gameState}
        onDepositWood={(forgeId, itemId, slotIdx) => {
          const res = depositWoodToForge(stateRef.current, forgeId, itemId, slotIdx);
          if (res.ok) {
            audio.playCraft();
            commitAndSave(res.state, 'autosave');
          }
          showStatus(res.message);
        }}
        onCollectDriftwood={(forgeId) => {
          const res = collectForgeDriftwood(stateRef.current, forgeId);
          if (res.collected > 0) {
            audio.playPickup();
            commitAndSave(res.state, 'autosave');
          }
          showStatus(res.message);
        }}
        onOpenAlloyRecipes={() => openPanel('inventory')}
        onClose={() => closeAllMenusAndLock({ relockPointer: true })}
      />

      <JournalMapModal
        isOpen={journalTab !== null}
        initialTab={journalTab ?? 'objectives'}
        state={gameState}
        onChangeTab={(tab) => setJournalTab(tab)}
        onClose={() => closeAllMenusAndLock({ relockPointer: true })}
      />

      <InventoryCraftModal
        isOpen={isInventoryOpen}
        state={gameState}
        nearbyStations={nearbyStations}
        onClose={() => closeAllMenusAndLock({ relockPointer: true })}
        onSwapSlots={(fromIdx, toIdx) =>
          setGameState((prev) => ({
            ...prev,
            inventory: swapSlots(prev.inventory, fromIdx, toIdx),
          }))
        }
        onSelectHotbar={(idx) => setGameState((prev) => ({ ...prev, selectedSlot: idx }))}
        onConsumeSlot={handleConsumeSlot}
        onDropSlot={(slotIdx) =>
          setGameState((prev) => {
            const next = prev.inventory.map((s) => (s ? { ...s } : null));
            next[slotIdx] = null;
            return { ...prev, inventory: next };
          })
        }
        onCraftRecipe={handleCraftRecipe}
      />

      <SurvivalPauseModal
        isOpen={isPaused}
        state={gameState}
        graphicsQuality={graphicsQuality}
        extSettings={extSettings}
        onChangeGraphicsQuality={handleChangeGraphicsQuality}
        onChangeExtendedSettings={handleChangeExtendedSettings}
        onResume={() => closeAllMenusAndLock({ relockPointer: true })}
        onRestart={() => handleStartNewGame(gameState.difficulty)}
      />

      <SurvivalDeathModal
        isOpen={!gameState.alive}
        causeOfDeath={causeOfDeath}
        state={gameState}
        onRespawn={handleRespawn}
        onRestart={() => handleStartNewGame(gameState.difficulty)}
      />
    </div>
  );
}
