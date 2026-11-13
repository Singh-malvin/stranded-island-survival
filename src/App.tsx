import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { audio } from './audio/audio.ts';
import { GraphicsQuality, loadGraphicsQuality } from './scene/GraphicsConfig.ts';
import { HoveredTargetInfo, SurvivalScene3D } from './scene/SurvivalScene3D.ts';
import { INVENTORY, NEEDS, SAVE, TIME, WILDLIFE, WORLD } from './survival/config.ts';
import {
  createInitialSurvivalState,
  hitGatherNode,
  tickNodeRespawns,
} from './survival/gathering.ts';
import {
  addItem,
  damageSlotDurability,
  getEquipped,
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
  getNearbyStations,
  interactWithStructure,
  performSpearfishing,
  placeStructure,
  STRUCTURE_CATALOG,
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
  tryUnlockGate,
} from './survival/world.ts';
import { BoatVoyageModal } from './ui/BoatVoyageModal.tsx';
import { BuildModal } from './ui/BuildModal.tsx';
import { CityEndingModal } from './ui/CityEndingModal.tsx';
import { InventoryCraftModal } from './ui/InventoryCraftModal.tsx';
import { JournalMapModal, JournalTab } from './ui/JournalMapModal.tsx';
import { StorageModal } from './ui/StorageModal.tsx';
import { SurvivalHUD } from './ui/SurvivalHUD.tsx';
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
  const [isBoatDockOpen, setIsBoatDockOpen] = useState(false);
  const [journalTab, setJournalTab] = useState<JournalTab | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() =>
    loadGraphicsQuality(false)
  );
  const [isMuted, setIsMuted] = useState(false);

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

  const isUiModalOpen =
    screen !== 'playing' ||
    isInventoryOpen ||
    isBuildMenuOpen ||
    isBoatDockOpen ||
    gameState.voyage.phase === 'stopover' ||
    gameState.voyage.phase === 'arrived' ||
    openChestId !== null ||
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

    // 3. Sleep in Shelter (Advance night, heal, bed save)
    if (target.kind === 'shelter' && target.shelterId) {
      const shelter = current.shelters.find((s) => s.id === target.shelterId);
      if (!shelter) return;
      const slept = sleepAtShelter(current, shelter);
      audio.playCraft();
      commitAndSave(slept.state, 'bed', 'Slept & Saved');
      showStatus(slept.message);
      return;
    }

    // 4. Inspect or Unlock Island Progression Gate
    if (target.kind === 'gate' && target.gateDef) {
      if (canUnlockGate(target.gateDef, current.inventory)) {
        const res = tryUnlockGate(current, target.gateDef.id);
        if (res.ok) {
          audio.playBuild();
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
      if (res.sound === 'drink') audio.playDrink();
      else if (res.sound === 'pickup') audio.playPickup();
      else if (res.sound === 'craft') audio.playCraft();

      if (res.openModal === 'craft') {
        setIsInventoryOpen(true);
        return;
      }
      if (res.openModal === 'storage') {
        setOpenChestId(target.structureDef.id);
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
      sceneRef.current?.triggerToolSwing();
      const res = hitGatherNode(current, target.nodeDef);
      if (res.sound === 'chop') audio.playChop();
      else if (res.sound === 'mine') audio.playMine();
      else if (res.sound === 'pickup') audio.playPickup();

      if (res.hit) {
        sceneRef.current?.spawnHarvestDebris(
          res.sound === 'blocked' ? 'pickup' : res.sound,
          new THREE.Vector3(target.nodeDef.x, target.nodeDef.y + 0.6, target.nodeDef.z)
        );
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
    scene.syncState(stateRef.current);

    scene.setCallbacks({
      onPrimaryAction: (t) => handlePrimaryActionRef.current(t),
      onOpenCampfireCraft: () => setIsInventoryOpen(true),
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
      if (showDebug) {
        setFps(runtime.fps);
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

        // 4. Respawn renewable nodes whose timer elapsed, advance structures & expand Fog-of-War
        const deltaGameHours = Math.max(0, nextClock.totalHours - prev.clock.totalHours);
        const nextNodes = tickNodeRespawns(prev.nodes, nextClock.totalHours);
        const nextStructures = tickStructuresProduction(
          prev.structures ?? [],
          deltaGameHours,
          nextWeather
        );
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
  }, [screen, isPaused, showDebug]);

  // Global keyboard shortcuts (Hotbar 1–6, [Tab]/[I]/[C] Craft, [J] Journal, [M] Map, [F] Consume, [Esc])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'playing' || !stateRef.current.alive) return;

      if (e.code === 'Tab' || e.code === 'KeyI' || e.code === 'KeyC') {
        e.preventDefault();
        setJournalTab(null);
        setIsBuildMenuOpen(false);
        setIsBoatDockOpen(false);
        setOpenChestId(null);
        setIsInventoryOpen((open) => !open);
        return;
      }

      if (e.code === 'KeyB') {
        e.preventDefault();
        setJournalTab(null);
        setIsInventoryOpen(false);
        setIsBoatDockOpen(false);
        setOpenChestId(null);
        cancelBuildMode();
        setIsBuildMenuOpen((open) => !open);
        return;
      }

      if (e.code === 'KeyR' && activeBuildType && !isUiModalOpen) {
        e.preventDefault();
        sceneRef.current?.rotateBuildPreview();
        return;
      }

      if (e.code === 'KeyJ') {
        e.preventDefault();
        setIsInventoryOpen(false);
        setIsBuildMenuOpen(false);
        setIsBoatDockOpen(false);
        setOpenChestId(null);
        setJournalTab((tab) => (tab === 'objectives' || tab === 'clues' ? null : 'objectives'));
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        setIsInventoryOpen(false);
        setIsBuildMenuOpen(false);
        setIsBoatDockOpen(false);
        setOpenChestId(null);
        setJournalTab((tab) => (tab === 'map' ? null : 'map'));
        return;
      }

      if (e.code === 'Escape') {
        if (isBoatDockOpen) {
          setIsBoatDockOpen(false);
        } else if (openChestId !== null) {
          setOpenChestId(null);
        } else if (isBuildMenuOpen) {
          setIsBuildMenuOpen(false);
        } else if (activeBuildType !== null) {
          cancelBuildMode();
        } else if (journalTab !== null) {
          setJournalTab(null);
        } else if (isInventoryOpen) {
          setIsInventoryOpen(false);
        } else {
          setIsPaused((p) => !p);
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

      if (e.code === 'KeyF') {
        handleConsumeSlot(stateRef.current.selectedSlot);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screen,
    isInventoryOpen,
    isBuildMenuOpen,
    isBoatDockOpen,
    activeBuildType,
    openChestId,
    journalTab,
    isUiModalOpen,
  ]);

  const handleConsumeSlot = (slotIdx: number) => {
    const consumedItemId = stateRef.current.inventory[slotIdx]?.itemId;
    const res = consumeInventorySlot(stateRef.current, slotIdx);
    if (!res.consumed) {
      showStatus(res.message);
      return;
    }
    audio.playDrink();
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
    showStatus('Debug: Added Stage 5 expedition gear & station repair parts.');
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

  const handleStartNewGame = (difficulty: 'survivor' | 'hardcore') => {
    const fresh = createInitialSurvivalState(difficulty);
    lastActToastRef.current = fresh.act;
    commitAndSave(fresh, 'autosave', 'New Game Saved');
    setIsInventoryOpen(false);
    setIsBuildMenuOpen(false);
    setIsBoatDockOpen(false);
    setOpenChestId(null);
    cancelBuildMode();
    setJournalTab(null);
    setIsPaused(false);
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
          onChangeGraphicsQuality={handleChangeGraphicsQuality}
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
          saveBadgeText={saveBadgeText}
          activeBuildType={activeBuildType}
          nearbyStations={nearbyStations}
          fps={fps}
          showDebug={showDebug}
          damageFlash={damageFlash}
          isMuted={isMuted}
          onSelectSlot={(idx) => setGameState((prev) => ({ ...prev, selectedSlot: idx }))}
          onUseSelected={() => handleConsumeSlot(gameState.selectedSlot)}
          onOpenInventory={() => {
            setJournalTab(null);
            setIsBuildMenuOpen(false);
            setOpenChestId(null);
            setIsInventoryOpen(true);
          }}
          onOpenBuild={() => {
            setJournalTab(null);
            setIsInventoryOpen(false);
            setOpenChestId(null);
            cancelBuildMode();
            setIsBuildMenuOpen(true);
          }}
          onCancelBuild={cancelBuildMode}
          onOpenJournal={() => {
            setIsInventoryOpen(false);
            setIsBuildMenuOpen(false);
            setOpenChestId(null);
            setJournalTab('objectives');
          }}
          onOpenMap={() => {
            setIsInventoryOpen(false);
            setIsBuildMenuOpen(false);
            setOpenChestId(null);
            setJournalTab('map');
          }}
          onTogglePause={() => setIsPaused((p) => !p)}
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
          onCloseDock={() => setIsBoatDockOpen(false)}
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
          showStatus(
            `Aim at ${
              STRUCTURE_CATALOG[type].surface === 'shallow_water' ? 'shallow water' : 'dry ground'
            } and press [E / Click] to place ${STRUCTURE_CATALOG[type].name}.`
          );
        }}
        onClose={() => setIsBuildMenuOpen(false)}
      />

      <StorageModal
        chest={activeChest}
        state={gameState}
        onTransfer={(chestId, fromChest, slotIdx) => {
          audio.playPickup();
          commitAndSave(transferChestSlot(stateRef.current, chestId, fromChest, slotIdx), 'autosave');
        }}
        onClose={() => setOpenChestId(null)}
      />

      <JournalMapModal
        isOpen={journalTab !== null}
        initialTab={journalTab ?? 'objectives'}
        state={gameState}
        onChangeTab={(tab) => setJournalTab(tab)}
        onClose={() => setJournalTab(null)}
      />

      <InventoryCraftModal
        isOpen={isInventoryOpen}
        state={gameState}
        nearbyStations={nearbyStations}
        onClose={() => setIsInventoryOpen(false)}
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
        onChangeGraphicsQuality={handleChangeGraphicsQuality}
        onResume={() => setIsPaused(false)}
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
