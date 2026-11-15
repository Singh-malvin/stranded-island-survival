/**
 * Pure simulation logic for the Final Boss Showdown: "Lavans Bali — The Aura King".
 * Handles difficulty scaling, 3-phase transitions, shield crystals, explosive fuel barrels,
 * Aura-Dim stagger windows, checkpoints, fight timer, and "Dethroned the Aura King" unlock.
 */

import { BOSS_TUNING, COMBAT_TUNING, NEEDS, TEMPERATURE, WORLD } from './config.ts';
import { addItem, countItem } from './items.ts';
import type {
  BossCombatPhase,
  BossDifficulty,
  BossEncounterState,
  BossPhase,
  SurvivalState,
} from './types.ts';

export function getBossDifficultyConfig(difficulty: BossDifficulty) {
  return BOSS_TUNING.DIFFICULTIES[difficulty] ?? BOSS_TUNING.DIFFICULTIES.normal;
}

export function createInitialBossState(
  difficulty: BossDifficulty = 'normal'
): BossEncounterState {
  const cfg = getBossDifficultyConfig(difficulty);
  return {
    combatPhase: 'inactive',
    phase: 1,
    difficulty,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    shielded: false,
    staggeredSec: 0,
    auraFlaring: false,
    crystalsAlive: [true, true, true],
    barrelsIntact: [true, true, true, true],
    shades: [],
    fightElapsedSec: 0,
    checkpointPhase: 1,
    defeated: false,
    subtitleText: null,
  };
}

export function normalizeBossState(
  raw: Partial<BossEncounterState> | undefined,
  difficulty: BossDifficulty = 'normal'
): BossEncounterState {
  const base = createInitialBossState(difficulty);
  if (!raw || typeof raw !== 'object') return base;
  const effDiff = raw.difficulty ?? difficulty;
  const cfg = getBossDifficultyConfig(effDiff);
  return {
    ...base,
    ...raw,
    difficulty: effDiff,
    maxHp: Number(raw.maxHp ?? cfg.maxHp),
    hp: Math.max(0, Math.min(Number(raw.maxHp ?? cfg.maxHp), Number(raw.hp ?? cfg.maxHp))),
    crystalsAlive: Array.isArray(raw.crystalsAlive) && raw.crystalsAlive.length === 3
      ? [Boolean(raw.crystalsAlive[0]), Boolean(raw.crystalsAlive[1]), Boolean(raw.crystalsAlive[2])]
      : [true, true, true],
    barrelsIntact: Array.isArray(raw.barrelsIntact) && raw.barrelsIntact.length === 4
      ? [
          Boolean(raw.barrelsIntact[0]),
          Boolean(raw.barrelsIntact[1]),
          Boolean(raw.barrelsIntact[2]),
          Boolean(raw.barrelsIntact[3]),
        ]
      : [true, true, true, true],
    shades: Array.isArray(raw.shades) ? raw.shades : [],
    fightElapsedSec: Number(raw.fightElapsedSec ?? 0),
    checkpointPhase: (raw.checkpointPhase === 2 || raw.checkpointPhase === 3 ? raw.checkpointPhase : 1),
    defeated: Boolean(raw.defeated),
  };
}

/**
 * Initiates the Lavans Bali encounter from Phase 1 intro cutscene (or specified phase checkpoint).
 */
export function startBossEncounter(
  state: SurvivalState,
  difficulty: BossDifficulty = state.bossDifficulty ?? 'normal',
  startAtPhase: BossPhase = 1
): SurvivalState {
  const cfg = getBossDifficultyConfig(difficulty);
  const startHp =
    startAtPhase === 3
      ? Math.round(cfg.maxHp * BOSS_TUNING.PHASE3_HP_RATIO)
      : startAtPhase === 2
        ? Math.round(cfg.maxHp * BOSS_TUNING.PHASE2_HP_RATIO)
        : cfg.maxHp;

  const combatPhase: BossCombatPhase =
    startAtPhase === 3 ? 'phase3_boat' : startAtPhase === 2 ? 'phase2' : 'intro';

  return {
    ...state,
    act: Math.max(state.act, startAtPhase === 3 ? 5 : 4) as SurvivalState['act'],
    bossDifficulty: difficulty,
    weather: { kind: 'storm', rain: 0.72, wind: 0.85, override: 'storm' },
    boss: {
      combatPhase,
      phase: startAtPhase,
      difficulty,
      hp: startHp,
      maxHp: cfg.maxHp,
      shielded: startAtPhase === 2,
      staggeredSec: 0,
      auraFlaring: true,
      crystalsAlive: startAtPhase === 2 ? [true, true, true] : [true, true, true],
      barrelsIntact: [true, true, true, true],
      shades: [],
      fightElapsedSec: 0,
      checkpointPhase: startAtPhase,
      defeated: false,
      subtitleText:
        startAtPhase === 1
          ? 'THE AURA KING: "No one leaves my island."'
          : startAtPhase === 2
            ? 'THE AURA KING: "My aura answers only to blood and ash!"'
            : 'THE AURA KING: "The tide belongs to me — sink into the abyss!"',
    },
    flags: {
      ...state.flags,
      boss_encounter_started: true,
    },
  };
}

export function setBossCombatPhase(
  state: SurvivalState,
  combatPhase: BossCombatPhase,
  subtitleText: string | null = state.boss.subtitleText
): SurvivalState {
  const nextPhase: BossPhase =
    combatPhase === 'phase3_boat' || combatPhase === 'phase3_transition'
      ? 3
      : combatPhase === 'phase2' || combatPhase === 'phase2_cutscene'
        ? 2
        : state.boss.phase;

  const crystalsAlive =
    combatPhase === 'phase2_cutscene'
      ? ([true, true, true] as [boolean, boolean, boolean])
      : state.boss.crystalsAlive;

  const checkpointPhase: BossPhase =
    combatPhase === 'phase3_boat'
      ? 3
      : combatPhase === 'phase2'
        ? 2
        : state.boss.checkpointPhase;

  const anyCrystalUp = crystalsAlive.some(Boolean);
  return {
    ...state,
    act: Math.max(state.act, nextPhase === 3 ? 5 : 4) as SurvivalState['act'],
    boss: {
      ...state.boss,
      combatPhase,
      phase: nextPhase,
      crystalsAlive,
      shielded: combatPhase === 'phase2' && anyCrystalUp,
      checkpointPhase,
      subtitleText,
    },
  };
}

export function applyPlayerDamageToBoss(
  state: SurvivalState,
  rawDamage: number,
  opts: {
    isHeavy?: boolean;
    isFireOrFlare?: boolean;
    ignoreShield?: boolean;
    causesStaggerSec?: number;
  } = {}
): {
  state: SurvivalState;
  dealt: number;
  triggeredPhase: BossCombatPhase | null;
  defeatedNow: boolean;
} {
  const boss = state.boss;
  if (
    boss.defeated ||
    boss.combatPhase === 'inactive' ||
    boss.combatPhase === 'intro' ||
    boss.combatPhase === 'phase2_cutscene' ||
    boss.combatPhase === 'phase3_transition' ||
    boss.combatPhase === 'defeat_cutscene' ||
    boss.combatPhase === 'ended'
  ) {
    return { state, dealt: 0, triggeredPhase: null, defeatedNow: false };
  }

  const diffCfg = getBossDifficultyConfig(boss.difficulty);
  let mult = diffCfg.playerDmgMult;

  if (boss.staggeredSec > 0) {
    mult *= BOSS_TUNING.STAGGER_DAMAGE_MULT;
  }
  if (boss.shielded && !opts.ignoreShield) {
    mult *= 1 - BOSS_TUNING.PHASE2_CRYSTAL_SHIELD_DR;
  }
  if (boss.phase === 3 && opts.isFireOrFlare) {
    mult *= BOSS_TUNING.PHASE3_FLARE_WEAKPOINT_MULT;
  }

  const dealt = Math.max(1, Math.round(rawDamage * mult));
  let nextHp = Math.max(0, boss.hp - dealt);
  let nextCombatPhase: BossCombatPhase = boss.combatPhase;
  let nextPhase: BossPhase = boss.phase;
  let triggeredPhase: BossCombatPhase | null = null;
  let defeatedNow = false;
  let nextSubtitle = boss.subtitleText;
  let nextStagger = Math.max(boss.staggeredSec, opts.causesStaggerSec ?? 0);
  let nextShades = boss.shades;

  const ratio = nextHp / Math.max(1, boss.maxHp);

  if (boss.phase === 1 && ratio <= BOSS_TUNING.PHASE2_HP_RATIO && nextHp > 0) {
    nextPhase = 2;
    nextCombatPhase = 'phase2_cutscene';
    triggeredPhase = 'phase2_cutscene';
    nextSubtitle = 'THE AURA KING: "Awaken, crystals of the reef! Witness true sovereign wrath!"';
    nextStagger = 0;
  } else if (boss.phase === 2 && ratio <= BOSS_TUNING.PHASE3_HP_RATIO && nextHp > 0) {
    nextPhase = 3;
    nextCombatPhase = 'phase3_transition';
    triggeredPhase = 'phase3_transition';
    nextSubtitle = 'THE AURA KING: "You dare cast off?! The storm itself will swallow your vessel!"';
    nextShades = [];
    nextStagger = 0;
  } else if (nextHp <= 0) {
    nextHp = 0;
    nextCombatPhase = 'defeat_cutscene';
    triggeredPhase = 'defeat_cutscene';
    defeatedNow = true;
    nextShades = [];
    nextStagger = 0;
    nextSubtitle = 'THE AURA KING: "Impossible... the horizon... breaks..."';
  }

  const achievements = Array.isArray(state.achievements) ? [...state.achievements] : [];
  if (defeatedNow && !achievements.includes(BOSS_TUNING.ACHIEVEMENT_NAME)) {
    achievements.push(BOSS_TUNING.ACHIEVEMENT_NAME);
  }

  const nextState: SurvivalState = {
    ...state,
    achievements,
    stats: {
      ...state.stats,
      bossFightTimeSec: defeatedNow
        ? Math.round(boss.fightElapsedSec)
        : state.stats.bossFightTimeSec,
    },
    boss: {
      ...boss,
      hp: nextHp,
      phase: nextPhase,
      combatPhase: nextCombatPhase,
      staggeredSec: nextStagger,
      shades: nextShades,
      defeated: defeatedNow ? true : boss.defeated,
      subtitleText: nextSubtitle,
    },
    flags: defeatedNow
      ? { ...state.flags, boss_lavans_defeated: true }
      : state.flags,
  };

  return { state: nextState, dealt, triggeredPhase, defeatedNow };
}

export function destroyBossCrystal(
  state: SurvivalState,
  crystalIdx: 0 | 1 | 2
): { state: SurvivalState; destroyed: boolean; allShattered: boolean } {
  if (!state.boss.crystalsAlive[crystalIdx]) {
    return { state, destroyed: false, allShattered: !state.boss.crystalsAlive.some(Boolean) };
  }
  const nextCrystals: [boolean, boolean, boolean] = [...state.boss.crystalsAlive] as [
    boolean,
    boolean,
    boolean,
  ];
  nextCrystals[crystalIdx] = false;
  const anyLeft = nextCrystals.some(Boolean);
  const allShattered = !anyLeft;

  // Shattering the final shield crystal staggers Lavans Bali immediately!
  return {
    state: {
      ...state,
      boss: {
        ...state.boss,
        crystalsAlive: nextCrystals,
        shielded: state.boss.phase === 2 && anyLeft,
        staggeredSec: allShattered ? BOSS_TUNING.STAGGER_DURATION_SEC : state.boss.staggeredSec,
        subtitleText: allShattered
          ? 'AURA SHIELD SHATTERED — Strike the Aura King while his aura dims!'
          : state.boss.subtitleText,
      },
    },
    destroyed: true,
    allShattered,
  };
}

export function detonateBossBarrel(
  state: SurvivalState,
  barrelIdx: 0 | 1 | 2 | 3,
  bossDistToBarrelM: number
): { state: SurvivalState; exploded: boolean; hitBoss: boolean; dealt: number; defeatedNow: boolean } {
  if (!state.boss.barrelsIntact[barrelIdx]) {
    return { state, exploded: false, hitBoss: false, dealt: 0, defeatedNow: false };
  }
  const nextBarrels: [boolean, boolean, boolean, boolean] = [...state.boss.barrelsIntact] as [
    boolean,
    boolean,
    boolean,
    boolean,
  ];
  nextBarrels[barrelIdx] = false;

  let workingState: SurvivalState = {
    ...state,
    boss: {
      ...state.boss,
      barrelsIntact: nextBarrels,
    },
  };

  if (bossDistToBarrelM <= BOSS_TUNING.EXPLOSIVE_BARREL_RADIUS_M) {
    const dmgRes = applyPlayerDamageToBoss(workingState, BOSS_TUNING.EXPLOSIVE_BARREL_DAMAGE, {
      isFireOrFlare: true,
      ignoreShield: true,
      causesStaggerSec: BOSS_TUNING.STAGGER_DURATION_SEC * 0.85,
    });
    return {
      state: dmgRes.state,
      exploded: true,
      hitBoss: true,
      dealt: dmgRes.dealt,
      defeatedNow: dmgRes.defeatedNow,
    };
  }

  return { state: workingState, exploded: true, hitBoss: false, dealt: 0, defeatedNow: false };
}

export function retryBossFromCheckpoint(
  state: SurvivalState,
  fromPhaseOne: boolean = false
): SurvivalState {
  const cpPhase: BossPhase = fromPhaseOne ? 1 : state.boss.checkpointPhase;
  const restarted = startBossEncounter(state, state.bossDifficulty ?? state.boss.difficulty, cpPhase);

  const playerPos =
    cpPhase === 3
      ? { x: 0, y: 1.5, z: -2.2, yaw: 0 }
      : {
          x: WORLD.BOAT_DOCK_POS.x,
          y: 2.0,
          z: WORLD.BOAT_DOCK_POS.z - 6.0,
          yaw: 0,
        };

  let inv = restarted.inventory;
  if (countItem(inv, 'bow') > 0 && countItem(inv, 'arrow') < 18) {
    inv = addItem(inv, 'arrow', 18 - countItem(inv, 'arrow')).inventory;
  }
  if (countItem(inv, 'flare_gun') > 0 && countItem(inv, 'flare_ammo') < 4) {
    inv = addItem(inv, 'flare_ammo', 4 - countItem(inv, 'flare_ammo')).inventory;
  }
  if (countItem(inv, 'fire_bomb') < 2) {
    inv = addItem(inv, 'fire_bomb', 2 - countItem(inv, 'fire_bomb')).inventory;
  }

  return {
    ...restarted,
    alive: true,
    inventory: inv,
    player: playerPos,
    needs: {
      ...restarted.needs,
      health: 100,
      stamina: 100,
      hunger: Math.max(NEEDS.WELL_FED_THRESHOLD, restarted.needs.hunger),
      thirst: Math.max(NEEDS.WELL_FED_THRESHOLD, restarted.needs.thirst),
      temperature: TEMPERATURE.NORMAL_BODY_C,
      sickness: 0,
    },
  };
}

export function getEquippedWeaponDamage(itemId: string | null | undefined, isHeavy: boolean): number {
  let base: number = COMBAT_TUNING.WEAPON_DAMAGE.bare_hands;
  switch (itemId) {
    case 'stone_axe':
      base = COMBAT_TUNING.WEAPON_DAMAGE.stone_axe;
      break;
    case 'stone_pick':
      base = COMBAT_TUNING.WEAPON_DAMAGE.stone_pick;
      break;
    case 'machete':
      base = COMBAT_TUNING.WEAPON_DAMAGE.machete;
      break;
    case 'spear':
      base = COMBAT_TUNING.WEAPON_DAMAGE.spear;
      break;
    case 'metal_axe':
      base = COMBAT_TUNING.WEAPON_DAMAGE.metal_axe;
      break;
    case 'metal_pick':
      base = COMBAT_TUNING.WEAPON_DAMAGE.metal_pick;
      break;
    case 'torch':
      base = COMBAT_TUNING.WEAPON_DAMAGE.torch;
      break;
    case 'bow':
      base = COMBAT_TUNING.WEAPON_DAMAGE.bow_full;
      break;
    case 'fire_bomb':
      base = COMBAT_TUNING.WEAPON_DAMAGE.fire_bomb;
      break;
    case 'flare_gun':
      base = COMBAT_TUNING.WEAPON_DAMAGE.flare_gun;
      break;
  }
  return isHeavy ? Math.round(base * COMBAT_TUNING.HEAVY_DAMAGE_MULT) : base;
}
