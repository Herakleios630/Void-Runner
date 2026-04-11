const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const stageWrapEl = document.querySelector(".stage-wrap");
const hudEl = document.querySelector(".hud");
const notesEl = document.querySelector(".notes");

const overlay = document.getElementById("overlay");
const shipInfoPanelEl = document.getElementById("shipInfoPanel");
const scoreEl = document.getElementById("score");
const killsEl = document.getElementById("kills");
const timeEl = document.getElementById("timeSurvived");
const levelEl = document.getElementById("level");
const fireModeStatusEl = document.getElementById("fireModeStatus");
const hpStatusEl = document.getElementById("hpStatus");
const critStatusEl = document.getElementById("critStatus");
const physicalStatusEl = document.getElementById("physicalStatus");
const energyStatusEl = document.getElementById("energyStatus");
const explosiveStatusEl = document.getElementById("explosiveStatus");
const heatStatusEl = document.getElementById("heatStatus");
const reloadStatusEl = document.getElementById("reloadStatus");
const xpStatusEl = document.getElementById("xpStatus");
const weaponLevelsStatusEl = document.getElementById("weaponLevelsStatus");
const armorStatusEl = document.getElementById("armorStatus");
const hazardStatusEl = document.getElementById("hazardStatus");
const exploredChunksStatEl = document.getElementById("exploredChunksStat");
const enemyKillsByTypeStatEl = document.getElementById("enemyKillsByTypeStat");
const topSpeedStatEl = document.getElementById("topSpeedStat");
const distanceStatEl = document.getElementById("distanceStat");
const shieldStatusEl = document.getElementById("shieldStatus");
const rocketStatusEl = document.getElementById("rocketStatus");
const musicStatusEl = document.getElementById("musicStatus");
const mpStatusEl = document.getElementById("mpStatus");
const missionWidgetTitleEl = document.getElementById("missionWidgetTitle");
const missionWidgetProgressEl = document.getElementById("missionWidgetProgress");
const pauseIndicatorEl = document.getElementById("pauseIndicator");
const joystickAreaEl = document.getElementById("joystickArea");
const joyBaseEl = document.getElementById("joyBase");
const joyKnobEl = document.getElementById("joyKnob");

const WORLD = {
  width: canvas.width,
  height: canvas.height,
  scrollSpeed: 220,
};

const BASE_WORLD = {
  width: canvas.width,
  height: canvas.height,
  aspect: canvas.width / canvas.height,
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  axisX: 0,
  axisY: 0,
  shooting: false,
  rocketQueued: false,
  mouseX: WORLD.width * 0.7,
  mouseY: WORLD.height * 0.5,
};

const IS_COARSE_POINTER = window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches;
const spriteAssets = window.VoidAssets || null;
const { SHIP_MODELS, DIFFICULTY_MODES } = window.VoidConfig;
const { randomFrom, clamp, circlesOverlap } = window.VoidUtils;
const {
  initAudio,
  playSfx,
  playMusicCategory,
  setMusicEnabled,
  getMusicEnabled,
  toggleMusicEnabled,
  setMusicVolume,
  getMusicVolume,
  setSfxVolume,
  getSfxVolume,
} = window.VoidAudio;
const { createWorldSystem } = window.VoidWorld;
const { createCameraSystem } = window.VoidCamera;
const { createRenderer } = window.VoidRender;
const { createEncountersSystem } = window.VoidEncounters;
const { createMenuSystem } = window.VoidMenus;
const { createProgressionSystem } = window.VoidProgression;
const { createScoringSystem } = window.VoidScoring;
const { getKillReward } = window.VoidCombatData;
const { createWeaponsSystem } = window.VoidWeapons;
const { createInputSystem } = window.VoidInput;
const { createStatusEffectsSystem } = window.VoidStatusEffects;
const { createEnemyAISteeringSystem } = window.VoidEnemyAI;
const { createShipDamageSystem } = window.VoidShipDamage;
const { createProjectileResolverSystem } = window.VoidProjectileResolver;
const { createHazardInteractionsSystem } = window.VoidHazardInteractions;
const { createObjectLifecycleSystem } = window.VoidObjectLifecycle;
const { createEnemyCombatSystem } = window.VoidEnemyCombat;
const { createMovementUtils } = window.VoidMovementUtils;
const { createCullingFiltersSystem } = window.VoidCullingFilters;
const { createPickupSimulationSystem } = window.VoidPickupSimulation;
const { createBossCombatSystem } = window.VoidBossCombat;
const { createFlightControlSystem } = window.VoidFlightControl;
const { createDebugToolsSystem } = window.VoidDebugTools;
const { createMultiplayerSystem } = window.VoidMultiplayer || {};

const GAMEPLAY_TUNING = (window.VoidTuning && window.VoidTuning.GAMEPLAY) || {
  world: {
    chunkSize: 960,
  },
  spawn: {
    targetObjects: { easy: 46, medium: 58, hard: 70 },
    targetEnemies: { easy: 14, medium: 20, hard: 26 },
    minLastSpawnCarry: 0.28,
    minDynamicSpawnInterval: 0.44,
  },
  enemyCombat: {
    miniFireMaxDistViewportMult: 0.95,
    shipFireMaxDistViewportMult: 1.05,
    miniOutOfRangeDelayMin: 0.6,
    miniOutOfRangeDelayRand: 0.9,
    shipOutOfRangeDelayMin: 0.55,
    shipOutOfRangeDelayRand: 0.8,
  },
  shield: {
    novaInterval: 30,
  },
  progression: {
    spawnIntensityPerBoss: 0.2,
    spawnIntensityCap: 1.25,
  },
  blackHole: {
    playerInfluenceEnabled: true,
  },
};

const DESTROY_REASONS = (window.VoidTuning && window.VoidTuning.DESTROY_REASONS) || {
  SHOT: "shot",
  ROCKET: "rocket",
  COLLISION: "collision",
  ACID: "acid",
};

const BALANCE_PROFILE_ID = "medium"; // safe | medium | chaos
const BALANCE_TUNING_TRACKS = ["cannon", "laser", "rocket", "drill", "plasma", "shield"];
const WORLD_CHUNK_SIZE = GAMEPLAY_TUNING.world.chunkSize;

function generateWorldSeed() {
  return 100000 + Math.floor(Math.random() * 900000000);
}

const state = {
  running: false,
  gameOver: false,
  pauseReason: "menu",
  debugHitboxes: false,
  showShipInfo: false,
  selectedDifficultyId: "medium",
  selectedShipId: "scout",
  worldSeed: generateWorldSeed(),
  musicEnabled: typeof getMusicEnabled === "function" ? getMusicEnabled() : true,
  desktopAutoFire: false,
  mouseInCanvas: false,
  joystickPointerId: null,
  lastAimTapAt: -999,
  score: 0,
  kills: 0,
  shipHitsTaken: 0,
  killStatsByType: {
    miniAlien: 0,
    alienShip: 0,
    mothership: 0,
    smallRock: 0,
    mediumRock: 0,
    boulder: 0,
    debris: 0,
    goldAsteroid: 0,
    ironAsteroid: 0,
  },
  runStats: {
    distanceWU: 0,
    topSpeedWU: 0,
    exploredChunks: Object.create(null),
    exploredChunksCount: 0,
  },
  time: 0,
  realNow: performance.now() / 1000,
  level: 1,
  levelCost: 100,
  nextLevelScore: 100,
  lastLevelScore: 0,
  lastLevelTime: 0,
  lastLevelKills: 0,
  levelUpPending: false,
  objects: [],
  bullets: [],
  laserBeams: [],
  plasmaBursts: [],
  missiles: [],
  pickups: [],
  bossProjectiles: [],
  particles: [],
  damageTexts: [],
  stars: [],
  ship: null,
  shipStats: null,
  objectIdCounter: 1,
  lastSpawn: 0,
  spawnInterval: 0.8,
  lastShot: 0,
  shotCooldown: 0.14,
  bossActive: false,
  boss: null,
  bossLevelsCleared: 0,
  bossRewardPending: false,
  pendingBossRewards: [],
  bossLootTaken: {},
  weapon: {
    cannonUnlocked: true,
    cannonEffectiveness: 1,
    extraLasers: 0,
    laserSpread: 11,
    laserUnlocked: false,
    laserCooldown: 0.22,
    lastLaserShot: -999,
    laserRange: 260,
    laserDamage: 1,
    laserPierce: 1,
    rocketUnlocked: false,
    rocketCooldown: 10,
    lastRocketShot: -999,
    lastRocketRealShot: -999,
    rocketHoming: false,
    rocketSplit: false,
    rocketDamage: 18,
    rocketBlastRadius: 110,
    drillUnlocked: false,
    drillRechargeDelay: 5,
    drillCharges: 0,
    drillMaxCharges: 1,
    drillCooldownUntil: 0,
    drillRadius: 13,
    drillReach: 18,
    plasmaUnlocked: false,
    plasmaCooldown: 0.12,
    lastPlasmaShot: -999,
    plasmaRange: 520,
    plasmaArc: 0.18,
    plasmaDamage: 0,
    plasmaBurnDps: 1.65,
    plasmaBurnDuration: 5,
  },
  shield: {
    unlocked: false,
    charges: 0,
    integrity: 0,
    maxCharges: 1,
    rechargeDelay: 10,
    thornPulseRadius: 78,
    thornBreakRadius: 105,
    cooldownUntil: 0,
    thorns: false,
    nova: false,
    nextNova: 30,
    lastThornPulseAt: -999,
  },
  weaponLevels: {
    cannon: 0,
    laser: 0,
    rocket: 0,
    drill: 0,
    plasma: 0,
    shield: 0,
  },
  weaponMilestones: {
    cannon: 0,
    laser: 0,
    rocket: 0,
    drill: 0,
    plasma: 0,
    shield: 0,
  },
  weaponCounters: {
    cannonShots: 0,
    rocketShots: 0,
    plasmaShots: 0,
  },
  weaponSpecials: {
    cannonExtraChannel: 0,
    cannonDoubleTap: false,
    cannonStorm: false,
    cannonRicochetMaxBounces: 0,
    cannonRicochetSplit: false,
    cannonRicochetRamp: false,
    cannonRicochetNova: false,
    laserRear: false,
    laserTri: false,
    rocketOmega: false,
    drillPulse: false,
    plasmaBack: false,
    plasmaTriad: false,
    plasmaCross: false,
    plasmaNova: false,
    shieldThornPulse: false,
  },
  upgradesTaken: {},
  pendingUpgradeOptions: [],
  world: {
    playerX: 0,
    playerY: 0,
  },
  perfCounters: {
    movement: 0,
    combat: 0,
    cleanup: 0,
    frameTotal: 0,
  },
  statusBarsMode: 0,
  options: {
    missionToastEnabled: true,
    musicVolume: 1.0,
    sfxVolume: 1.0,
    dailyRunChallengesEnabled: false,
    missionFailExtraTimeLimit: false,
    missionFailExtraHitLimit: false,
    missionFailExtraNoHit: false,
  },
  multiplayer: {
    enabled: false,
    connected: false,
    roomId: "solo",
    localName: "Pilot",
    wsUrl: "",
    remoteCount: 0,
    lastAppliedWorldT: -1,
    lastMirrorFireActionAt: 0,
    remoteCannonLastById: {},
    remoteRocketLastById: {},
  },
  lastDeathPenalty: null,
  missionToast: {
    text: "",
    subText: "",
    startedAt: 0,
    showUntil: 0,
  },
  missionRerollTokens: 0,
  missionRewardBuff: null,
  runChallenge: null,
  missionLog: [],
  missions: {
    serial: 0,
    runSeed: 1,
    offers: [],
    chain: {
      active: false,
      total: 0,
      nextStep: 1,
    },
    active: null,
  },
};

const UPGRADE_WEIGHTS = {
  shield_core: 7,
  cannon_mount: 5,
  shield_recharge: 5,
  shield_thorns: 3,
  shield_nova: 2,
  laser_extra: 6,
  laser_rapid: 8,
  laser_spread: 4,
  cannon_ricochet: 4,
  rocket_launcher: 5,
  rocket_cooldown: 4,
  rocket_homing: 2,
  rocket_split: 2,
  rocket_blast: 3,
  laser_emitter: 4,
  laser_charge: 3,
  laser_range: 3,
  laser_pierce: 2,
  plasma_emitter: 5,
  plasma_focus: 4,
  plasma_fuel: 4,
  drill_module: 4,
  drill_recharge: 3,
  stat_hull: 7,
  stat_crit_chance: 6,
  stat_crit_damage: 5,
  stat_reload_tuning: 6,
  stat_thrusters: 5,
  stat_physical_damage: 6,
  stat_energy_damage: 6,
  stat_explosive_damage: 5,
  stat_heat_damage: 5,
  stat_armor_core: 6,
  stat_toxic_filter: 4,
  stat_scanner_hardening: 4,
};

const BOSS_VARIANTS = ["tentacle", "warship", "carrier"];
const MISSION_TYPES = {
  DESTROY: "destroy",
  TRAVEL: "travel",
  SURVIVE: "survive",
  REACH_ZONE: "reach-zone",
  SPECIAL_TARGET: "special-target",
};
const MISSION_ENEMY_CLASS_DEFS = [
  { type: "miniAlien", label: "Mini-Aliens", minTarget: 8, targetSpan: 8, rewardFactor: 9 },
  { type: "alienShip", label: "Alien-Schiffe", minTarget: 5, targetSpan: 6, rewardFactor: 12 },
];
const MISSION_OBJECT_CLASS_DEFS = [
  { type: "smallRock", label: "kleine Felsen", minTarget: 12, targetSpan: 10, rewardFactor: 6 },
  { type: "mediumRock", label: "mittlere Felsen", minTarget: 8, targetSpan: 8, rewardFactor: 7 },
  { type: "boulder", label: "Felsbrocken", minTarget: 5, targetSpan: 6, rewardFactor: 9 },
  { type: "debris", label: "Schrott", minTarget: 10, targetSpan: 10, rewardFactor: 6 },
];
// Combined pool: enemies (weight 2) + objects (weight 1)
const MISSION_DESTROY_POOL = [
  ...MISSION_ENEMY_CLASS_DEFS.map(d => ({ ...d, isObject: false })),
  ...MISSION_ENEMY_CLASS_DEFS.map(d => ({ ...d, isObject: false })),
  ...MISSION_OBJECT_CLASS_DEFS.map(d => ({ ...d, isObject: true })),
];

const MAX_WEAPON_SLOTS = 3;
const WEAPON_LEVEL_MILESTONES = [5, 10, 15, 20];
const WEAPON_UPGRADE_TRACK = {
  cannon_mount: "cannon",
  laser_extra: "cannon",
  laser_rapid: "cannon",
  laser_spread: "cannon",
  cannon_ricochet: "cannon",
  laser_emitter: "laser",
  laser_charge: "laser",
  laser_range: "laser",
  laser_pierce: "laser",
  rocket_launcher: "rocket",
  rocket_cooldown: "rocket",
  rocket_homing: "rocket",
  rocket_split: "rocket",
  rocket_blast: "rocket",
  drill_module: "drill",
  drill_recharge: "drill",
  plasma_emitter: "plasma",
  plasma_focus: "plasma",
  plasma_fuel: "plasma",
  shield_core: "shield",
  shield_recharge: "shield",
  shield_thorns: "shield",
  shield_nova: "shield",
};

function activeWeaponSlotsCount() {
  return Number(state.weapon.cannonUnlocked)
    + Number(state.shield.unlocked)
    + Number(state.weapon.laserUnlocked)
    + Number(state.weapon.rocketUnlocked)
    + Number(state.weapon.drillUnlocked)
    + Number(state.weapon.plasmaUnlocked);
}

function canUnlockNewWeapon() {
  return activeWeaponSlotsCount() < MAX_WEAPON_SLOTS;
}

function missionUnitLabel(type) {
  if (type === MISSION_TYPES.DESTROY) return "Kills";
  if (type === MISSION_TYPES.TRAVEL) return "WU";
  if (type === MISSION_TYPES.REACH_ZONE) return "WU";
  if (type === MISSION_TYPES.SPECIAL_TARGET) return "Ziel";
  return "Sek";
}

function missionTitle(type) {
  if (type === MISSION_TYPES.DESTROY) return "Zerstoere Gegner";
  if (type === MISSION_TYPES.TRAVEL) return "Lege Distanz zurueck";
  if (type === MISSION_TYPES.REACH_ZONE) return "Erreiche Zielkoordinate";
  if (type === MISSION_TYPES.SPECIAL_TARGET) return "Zerstoere Spezial-Ziel";
  return "Ueberlebe ohne Tod";
}

function missionFailBaselineForDifficulty(diffId) {
  if (diffId === "hard") {
    return {
      timeLimit: true,
      hitLimit: true,
      noHit: true,
    };
  }
  if (diffId === "medium") {
    return {
      timeLimit: true,
      hitLimit: false,
      noHit: false,
    };
  }
  return {
    timeLimit: false,
    hitLimit: false,
    noHit: false,
  };
}

function missionEffectiveFailRules() {
  const difficulty = selectedDifficultyMode();
  const baseline = missionFailBaselineForDifficulty(difficulty && difficulty.id);
  const opts = state.options || {};
  return {
    timeLimit: baseline.timeLimit || opts.missionFailExtraTimeLimit === true,
    hitLimit: baseline.hitLimit || opts.missionFailExtraHitLimit === true,
    noHit: baseline.noHit || opts.missionFailExtraNoHit === true,
  };
}

function missionTimeLimitSeconds(type, target) {
  if (type === MISSION_TYPES.DESTROY) {
    return Math.max(26, target * 3.6);
  }
  if (type === MISSION_TYPES.TRAVEL) {
    return Math.max(24, target / 210 + 16);
  }
  if (type === MISSION_TYPES.REACH_ZONE) {
    return Math.max(20, Math.min(84, target / 7 + 20));
  }
  if (type === MISSION_TYPES.SPECIAL_TARGET) {
    return 72;
  }
  return Math.max(16, target + 10);
}

function missionHitLimit(type, target) {
  if (type === MISSION_TYPES.DESTROY) {
    return Math.max(2, Math.floor(target * 0.18));
  }
  if (type === MISSION_TYPES.TRAVEL) {
    return Math.max(2, Math.floor(target / 900));
  }
  if (type === MISSION_TYPES.REACH_ZONE) {
    return 3;
  }
  if (type === MISSION_TYPES.SPECIAL_TARGET) {
    return 2;
  }
  return Math.max(1, Math.floor(target / 14));
}

function buildMissionFailConditions(type, target, now) {
  const rules = missionEffectiveFailRules();
  const cond = {
    timeLimitSec: null,
    failAt: null,
    hitLimit: null,
    noHit: false,
    startShipHits: Number(state.shipHitsTaken || 0),
  };

  if (rules.timeLimit) {
    cond.timeLimitSec = missionTimeLimitSeconds(type, target);
    cond.failAt = now + cond.timeLimitSec;
  }
  if (rules.hitLimit) {
    cond.hitLimit = missionHitLimit(type, target);
  }
  if (rules.noHit) {
    cond.noHit = true;
  }

  return cond;
}

function missionFailStatusText(mission) {
  const cond = mission && mission.failConditions;
  if (!cond) return "";

  const parts = [];
  if (Number.isFinite(cond.failAt)) {
    const left = Math.max(0, cond.failAt - state.time);
    parts.push(`Zeit ${left.toFixed(1)}s`);
  }

  const hitsTaken = Math.max(0, Number(state.shipHitsTaken || 0) - Number(cond.startShipHits || 0));
  if (Number.isFinite(cond.hitLimit)) {
    parts.push(`Treffer ${hitsTaken}/${cond.hitLimit}`);
  }
  if (cond.noHit) {
    parts.push(`No-Hit ${hitsTaken === 0 ? "aktiv" : "verletzt"}`);
  }
  return parts.join(" | ");
}

function missionFailReason(mission, value) {
  const cond = mission && mission.failConditions;
  if (!cond || mission.completed || mission.failed) return "";

  const hitsTaken = Math.max(0, Number(state.shipHitsTaken || 0) - Number(cond.startShipHits || 0));
  if (cond.noHit && hitsTaken > 0) {
    return "No-Hit verletzt";
  }
  if (Number.isFinite(cond.hitLimit) && hitsTaken > cond.hitLimit) {
    return `Trefferlimit ueberschritten (${hitsTaken}/${cond.hitLimit})`;
  }
  if (Number.isFinite(cond.failAt) && state.time >= cond.failAt && value < mission.target) {
    return "Zeitlimit abgelaufen";
  }
  return "";
}

function trackExploredChunk(worldX, worldY) {
  const chunkX = Math.floor(worldX / WORLD_CHUNK_SIZE);
  const chunkY = Math.floor(worldY / WORLD_CHUNK_SIZE);
  const key = `${chunkX},${chunkY}`;
  if (!state.runStats.exploredChunks[key]) {
    state.runStats.exploredChunks[key] = true;
    state.runStats.exploredChunksCount += 1;
  }
}

function updateRunStats(movedDistance, shipSpeed) {
  state.runStats.distanceWU += Math.max(0, movedDistance || 0);
  state.runStats.topSpeedWU = Math.max(state.runStats.topSpeedWU || 0, Math.max(0, shipSpeed || 0));
  if (state.ship && Number.isFinite(state.ship.worldX) && Number.isFinite(state.ship.worldY)) {
    trackExploredChunk(state.ship.worldX, state.ship.worldY);
  }
}

function missionProgressValue(mission) {
  if (!mission) return 0;
  if (mission.type === MISSION_TYPES.DESTROY) {
    const targetKey = mission.targetEnemyType || mission.targetObjectType;
    if (targetKey) {
      const byType = state.killStatsByType || {};
      const startByType = mission.startKillsByType || {};
      const current = Number(byType[targetKey] || 0);
      const baseline = Number(startByType[targetKey] || 0);
      return Math.max(0, current - baseline);
    }
    return Math.max(0, state.kills - mission.startKills);
  }
  if (mission.type === MISSION_TYPES.SPECIAL_TARGET) {
    return Math.max(0, mission.progress || 0);
  }
  return mission.progress || 0;
}

function missionDeterministicRand(seedBase) {
  const x = Math.sin(seedBase * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

function pushMissionLog(text) {
  if (!text) return;
  if (!Array.isArray(state.missionLog)) {
    state.missionLog = [];
  }
  state.missionLog.push({
    at: state.time,
    text,
  });
  if (state.missionLog.length > 4) {
    state.missionLog.shift();
  }
}

function localDaySeed() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return y * 10000 + m * 100 + day;
}

function assignRunChallenge(now = state.time) {
  if (!state.options || state.options.dailyRunChallengesEnabled !== true) {
    state.runChallenge = null;
    return;
  }

  const seed = localDaySeed();
  const roll = missionDeterministicRand(seed * 0.013 + 3.11);
  const targetRoll = missionDeterministicRand(seed * 0.017 + 9.27);
  const rewardRoll = missionDeterministicRand(seed * 0.021 + 13.71);

  let type = "travel";
  let title = "Tages-Challenge: Lege Distanz zurueck";
  let unit = "WU";
  let target = 12000 + Math.floor(targetRoll * 7000);

  if (roll < 0.33) {
    type = "kills";
    title = "Tages-Challenge: Zerstoere Gegner";
    unit = "Kills";
    target = 55 + Math.floor(targetRoll * 35);
  } else if (roll > 0.66) {
    type = "survive";
    title = "Tages-Challenge: Ueberlebe";
    unit = "Sek";
    target = 150 + Math.floor(targetRoll * 120);
  }

  const rewardScore = 260 + Math.floor(target * (type === "kills" ? 4.5 : type === "travel" ? 0.05 : 2.2));
  const rewardRerolls = rewardRoll < 0.3 ? 2 : 1;

  state.runChallenge = {
    seed,
    type,
    title,
    unit,
    target,
    progress: 0,
    rewardScore,
    rewardRerolls,
    startedAt: now,
    completed: false,
    failed: false,
  };

  pushMissionLog(`${title} gestartet`);

  if (state.options.missionToastEnabled !== false) {
    state.missionToast = {
      text: title,
      subText: `${Math.floor(target)} ${unit}  |  +${rewardScore} Pkt`,
      startedAt: now,
      showUntil: now + 4,
    };
  }
}

function updateRunChallenge(dt, movedWorldDistance) {
  const ch = state.runChallenge;
  if (!ch || ch.completed || ch.failed) return;

  if (ch.type === "kills") {
    ch.progress = state.kills;
  } else if (ch.type === "travel") {
    ch.progress += Math.max(0, movedWorldDistance);
  } else {
    ch.progress += dt;
  }

  if (ch.progress < ch.target) return;

  ch.completed = true;
  scoring.addPoints(ch.rewardScore);
  state.missionRerollTokens = Math.min(9, (state.missionRerollTokens || 0) + ch.rewardRerolls);
  pushMissionLog(`Challenge geschafft (+${ch.rewardScore})`);
  if (state.options.missionToastEnabled !== false) {
    state.missionToast = {
      text: "Challenge geschafft",
      subText: `+${ch.rewardScore} Pkt | +${ch.rewardRerolls} Reroll`,
      startedAt: state.time,
      showUntil: state.time + 3.2,
    };
  }
}

function missionRewardRand(serial, salt = 0) {
  const runSeed = Number.isFinite(state.missions.runSeed) ? state.missions.runSeed : (state.worldSeed || 1);
  return missionDeterministicRand(runSeed * 0.0023 + serial * 23.17 + salt);
}

function spawnMissionArmorDrop() {
  if (!state.ship) return;
  const shipWX = Number.isFinite(state.ship.worldX) ? state.ship.worldX : (state.world.playerX || 0);
  const shipWY = Number.isFinite(state.ship.worldY) ? state.ship.worldY : (state.world.playerY || 0);
  const a = missionRewardRand(state.missions.serial, 41.9) * Math.PI * 2;
  const r = 36 + missionRewardRand(state.missions.serial, 47.2) * 24;
  const worldX = shipWX + Math.cos(a) * r;
  const worldY = shipWY + Math.sin(a) * r;
  const cameraX = typeof cameraSystem.getX === "function" ? cameraSystem.getX() : shipWX;
  const cameraY = typeof cameraSystem.getY === "function" ? cameraSystem.getY() : shipWY;
  const screen = projectWorldToScreen(worldX, worldY, cameraX, cameraY);

  state.pickups.push({
    id: nextObjectId(),
    type: "armor",
    x: screen.x,
    y: screen.y,
    worldX,
    worldY,
    vx: Math.cos(a) * 18,
    vy: Math.sin(a) * 18,
    radius: 10,
    life: 14,
  });
}

function grantMissionCompletionRewards(mission) {
  scoring.addPoints(mission.rewardScore);
  spawnMissionArmorDrop();

  const serial = state.missions.serial || 1;
  const rerollChance = mission.type === MISSION_TYPES.SPECIAL_TARGET ? 0.55 : 0.28;
  if (missionRewardRand(serial, 53.1) < rerollChance) {
    state.missionRerollTokens = Math.min(9, (state.missionRerollTokens || 0) + 1);
  }

  const rareBuffChance = mission.type === MISSION_TYPES.SPECIAL_TARGET ? 0.2 : 0.1;
  if (missionRewardRand(serial, 61.7) < rareBuffChance) {
    state.missionRewardBuff = {
      id: "score-overdrive",
      until: state.time + 18,
      scoreMult: 1.35,
      reloadMult: 1.12,
    };
  }
}

function createMissionOffer(serial) {
  const runSeed = Number.isFinite(state.missions.runSeed) ? state.missions.runSeed : (state.worldSeed || 1);
  const seedBase = runSeed * 0.001 + serial * 17.131;
  const missionRoll = missionDeterministicRand(seedBase);
  const targetRoll = missionDeterministicRand(seedBase + 3.71);

  let type = MISSION_TYPES.TRAVEL;
  if (missionRoll < 0.24) type = MISSION_TYPES.DESTROY;
  else if (missionRoll < 0.46) type = MISSION_TYPES.TRAVEL;
  else if (missionRoll < 0.64) type = MISSION_TYPES.SURVIVE;
  else if (missionRoll < 0.82) type = MISSION_TYPES.REACH_ZONE;
  else type = MISSION_TYPES.SPECIAL_TARGET;

  let target = 8;
  let title = missionTitle(type);
  let targetEnemyType = null;
  let targetEnemyLabel = null;
  let rewardFactor = type === MISSION_TYPES.DESTROY ? 9 : type === MISSION_TYPES.TRAVEL ? 11 : type === MISSION_TYPES.REACH_ZONE ? 10 : type === MISSION_TYPES.SPECIAL_TARGET ? 26 : 7;

  let targetObjectType = null;
  let targetWorldX = null;
  let targetWorldY = null;
  let orbitDistance = 0;
  let specialTargetType = null;
  let specialTargetName = null;
  let specialSpawnAngle = null;

  if (type === MISSION_TYPES.DESTROY) {
    const classRoll = missionDeterministicRand(seedBase + 9.13);
    const classIndex = Math.min(
      MISSION_DESTROY_POOL.length - 1,
      Math.floor(classRoll * MISSION_DESTROY_POOL.length),
    );
    const classDef = MISSION_DESTROY_POOL[classIndex];
    if (classDef.isObject) {
      targetObjectType = classDef.type;
    } else {
      targetEnemyType = classDef.type;
    }
    targetEnemyLabel = classDef.label;
    title = `Zerstoere ${classDef.label}`;
    target = classDef.minTarget + Math.floor(targetRoll * classDef.targetSpan);
    rewardFactor = classDef.rewardFactor;
  } else if (type === MISSION_TYPES.TRAVEL) {
    target = 4500 + Math.floor(targetRoll * 5500);
  } else if (type === MISSION_TYPES.REACH_ZONE) {
    const angleRoll = missionDeterministicRand(seedBase + 6.91);
    const radiusRoll = missionDeterministicRand(seedBase + 11.47);
    const radius = 3400 + Math.floor(radiusRoll * 9600);
    const angle = angleRoll * Math.PI * 2;
    targetWorldX = Math.round(Math.cos(angle) * radius);
    targetWorldY = Math.round(Math.sin(angle) * radius);
    orbitDistance = radius;
    target = 200;
    title = "Erreiche Zone/Orbit";
  } else if (type === MISSION_TYPES.SPECIAL_TARGET) {
    const eliteRoll = missionDeterministicRand(seedBase + 15.33);
    specialTargetType = eliteRoll < 0.56 ? "alienShip" : "miniAlien";
    specialTargetName = specialTargetType === "alienShip" ? "Elite-Schiff" : "Elite-Mini-Alien";
    specialSpawnAngle = missionDeterministicRand(seedBase + 13.77) * Math.PI * 2;
    target = 1;
    title = `Zerstoere ${specialTargetName}`;
  } else {
    target = 35 + Math.floor(targetRoll * 35);
  }

  let rewardScore = Math.round(80 + target * rewardFactor);
  if (type === MISSION_TYPES.REACH_ZONE) {
    rewardScore = Math.round(180 + orbitDistance * 0.03 + target * 0.09);
  }

  return {
    type,
    title,
    unit: missionUnitLabel(type),
    target,
    rewardScore,
    targetEnemyType,
    targetEnemyLabel,
    targetObjectType,
    targetWorldX,
    targetWorldY,
    specialTargetType,
    specialTargetName,
    specialSpawnAngle,
  };
}

function missionDifficultyScale() {
  const shipX = state.ship && Number.isFinite(state.ship.worldX) ? state.ship.worldX : (state.world.playerX || 0);
  const shipY = state.ship && Number.isFinite(state.ship.worldY) ? state.ship.worldY : (state.world.playerY || 0);
  const distFromSpawn = Math.hypot(shipX, shipY);
  const bossNorm = Math.max(0, Math.min(1, (state.bossLevelsCleared || 0) / 8));
  const distNorm = Math.max(0, Math.min(1, distFromSpawn / 22000));

  return {
    targetMult: 1 + bossNorm * 0.45 + distNorm * 0.35,
    rewardMult: 1 + bossNorm * 0.55 + distNorm * 0.45,
    eliteHpMult: 1 + bossNorm * 0.5 + distNorm * 0.4,
    eliteSpeedMult: 1 + bossNorm * 0.16 + distNorm * 0.12,
  };
}

function assignNextMission(now = state.time, showToast = false) {
  const serial = (state.missions.serial || 0) + 1;
  state.missions.serial = serial;
  if (!Array.isArray(state.missions.offers)) {
    state.missions.offers = [];
  }

  if (!state.missions.offers[serial - 1]) {
    state.missions.offers[serial - 1] = createMissionOffer(serial);
  }

  const offer = state.missions.offers[serial - 1];
  let type = offer.type;
  let title = offer.title;
  let target = offer.target;
  const targetEnemyType = offer.targetEnemyType;
  const targetEnemyLabel = offer.targetEnemyLabel;
  const targetObjectType = offer.targetObjectType;
  const targetWorldX = offer.targetWorldX;
  const targetWorldY = offer.targetWorldY;
  let specialTargetObjectId = null;
  let rewardScore = offer.rewardScore;
  const difficultyScale = missionDifficultyScale();

  if (!state.missions.chain) {
    state.missions.chain = { active: false, total: 0, nextStep: 1 };
  }

  if (!state.missions.chain.active) {
    const runSeed = Number.isFinite(state.missions.runSeed) ? state.missions.runSeed : (state.worldSeed || 1);
    const chainRoll = missionDeterministicRand(runSeed * 0.0019 + serial * 8.31 + 91.17);
    if (chainRoll < 0.32) {
      const lenRoll = missionDeterministicRand(runSeed * 0.0021 + serial * 9.47 + 103.7);
      state.missions.chain.active = true;
      state.missions.chain.total = lenRoll < 0.56 ? 2 : 3;
      state.missions.chain.nextStep = 1;
    }
  }

  let chainStep = 0;
  let chainTotal = 0;
  let chainRewardMult = 1;
  if (state.missions.chain.active) {
    chainStep = Math.max(1, state.missions.chain.nextStep || 1);
    chainTotal = Math.max(chainStep, state.missions.chain.total || 1);
    chainRewardMult = 1 + (chainStep - 1) * 0.35;
    title = `Kette ${chainStep}/${chainTotal}: ${title}`;
  }

  if (type === MISSION_TYPES.DESTROY || type === MISSION_TYPES.TRAVEL || type === MISSION_TYPES.SURVIVE) {
    target = Math.max(1, Math.floor(target * difficultyScale.targetMult));
  }
  rewardScore = Math.max(10, Math.floor(rewardScore * difficultyScale.rewardMult));
  rewardScore = Math.max(10, Math.floor(rewardScore * chainRewardMult));

  if (type === MISSION_TYPES.SPECIAL_TARGET) {
    const eliteType = offer.specialTargetType;
    const spawnAngle = offer.specialSpawnAngle;
    const runSeed = Number.isFinite(state.missions.runSeed) ? state.missions.runSeed : (state.worldSeed || 1);
    const seedBase = runSeed * 0.001 + serial * 17.131;
    let randTick = 0;
    const deterministicSpawnRand = () => {
      randTick += 1;
      return missionDeterministicRand(seedBase + 19.1 + randTick * 1.73);
    };
    const spawned = encounters && typeof encounters.spawnObject === "function"
      ? encounters.spawnObject({
        rand: deterministicSpawnRand,
        forceType: eliteType,
        systemInterior: true,
        angle: spawnAngle,
        spawnPadding: 96,
      })
      : null;

    if (spawned && spawned.enemy) {
      spawned.missionSpecialTarget = true;
      spawned.aggroLocked = true;
      spawned.aggroUntil = state.time + 120;
      spawned.hp = Math.max(spawned.hp + 8, Math.floor(spawned.hp * 2.8 * difficultyScale.eliteHpMult));
      spawned.maxHp = spawned.hp;
      spawned.size *= 1.16;
      spawned.collisionRadius *= 1.14;
      spawned.chaseSpeed *= 1.08 * difficultyScale.eliteSpeedMult;
      specialTargetObjectId = spawned.id;
    }
  }

  state.missions.active = {
    id: `mission-${serial}`,
    type,
    title,
    unit: missionUnitLabel(type),
    target,
    progress: 0,
    rewardScore,
    startKills: state.kills,
    startKillsByType: {
      miniAlien: Number((state.killStatsByType && state.killStatsByType.miniAlien) || 0),
      alienShip: Number((state.killStatsByType && state.killStatsByType.alienShip) || 0),
      smallRock: Number((state.killStatsByType && state.killStatsByType.smallRock) || 0),
      mediumRock: Number((state.killStatsByType && state.killStatsByType.mediumRock) || 0),
      boulder: Number((state.killStatsByType && state.killStatsByType.boulder) || 0),
      debris: Number((state.killStatsByType && state.killStatsByType.debris) || 0),
    },
    targetEnemyType,
    targetEnemyLabel,
    targetObjectType,
    targetWorldX,
    targetWorldY,
    currentDistance: null,
    specialTargetObjectId,
    chainStep,
    chainTotal,
    chainRewardMult,
    progressLogBucket: 0,
    failConditions: buildMissionFailConditions(type, target, now),
    failReason: "",
    completed: false,
    completedUntil: 0,
    startedAt: now,
  };

  pushMissionLog(`Neue Mission: ${state.missions.active.title}`);

  if (showToast && state.options && state.options.missionToastEnabled !== false) {
    const m = state.missions.active;
    const toastDuration = 4.0;
    const unitStr = m.unit === "Sek"
      ? `${m.target} ${m.unit}`
      : `${m.target} ${m.unit}`;
    state.missionToast = {
      text: m.title,
      subText: `Ziel: ${unitStr}  |  +${m.rewardScore} Pkt`,
      startedAt: now,
      showUntil: now + toastDuration,
    };
  }
}

function updateMissions(dt, movedWorldDistance) {
  const mission = state.missions.active;
  if (!mission) {
    assignNextMission(state.time, true);
    return;
  }

  if (mission.completed) {
    if (state.time >= mission.completedUntil) {
      assignNextMission(state.time, true);
    }
    return;
  }

  if (mission.failed) {
    if (state.time >= mission.failedUntil) {
      const reason = mission.failReason ? ` (${mission.failReason})` : "";
      pushMissionLog(`Mission fehlgeschlagen: ${mission.title}${reason}`);
      state.missions.chain.active = false;
      state.missions.chain.total = 0;
      state.missions.chain.nextStep = 1;
      assignNextMission(state.time, true);
    }
    return;
  }

  if (mission.type === MISSION_TYPES.TRAVEL) {
    mission.progress += Math.max(0, movedWorldDistance);
  } else if (mission.type === MISSION_TYPES.SURVIVE) {
    mission.progress += dt;
  } else if (mission.type === MISSION_TYPES.REACH_ZONE) {
    const shipX = state.ship && Number.isFinite(state.ship.worldX) ? state.ship.worldX : state.world.playerX;
    const shipY = state.ship && Number.isFinite(state.ship.worldY) ? state.ship.worldY : state.world.playerY;
    const dx = shipX - mission.targetWorldX;
    const dy = shipY - mission.targetWorldY;
    const distance = Math.hypot(dx, dy);
    mission.currentDistance = distance;
    mission.progress = distance <= mission.target ? mission.target : 0;
  } else if (mission.type === MISSION_TYPES.SPECIAL_TARGET) {
    const targetObj = state.objects.find((obj) => obj && obj.id === mission.specialTargetObjectId);
    if (!targetObj || targetObj.destroyed || targetObj.hp <= 0) {
      mission.progress = 1;
    } else {
      mission.progress = 0;
    }
  }

  const value = missionProgressValue(mission);
  const failReason = missionFailReason(mission, value);
  if (failReason) {
    mission.failed = true;
    mission.failedUntil = state.time + 2.2;
    mission.failReason = failReason;
    return;
  }

  if (mission.target > 0 && !mission.completed && !mission.failed) {
    const pct = Math.max(0, Math.min(0.999, value / mission.target));
    const bucket = Math.floor(pct * 4);
    if (bucket > (mission.progressLogBucket || 0)) {
      mission.progressLogBucket = bucket;
      pushMissionLog(`${mission.title}: ${Math.floor(pct * 100)}%`);
    }
  }
  if (value < mission.target) return;

  mission.completed = true;
  mission.completedUntil = state.time + 2.2;
  grantMissionCompletionRewards(mission);
  pushMissionLog(`Mission geschafft: ${mission.title}`);

  if (mission.chainTotal > 1) {
    if (mission.chainStep < mission.chainTotal) {
      state.missions.chain.active = true;
      state.missions.chain.total = mission.chainTotal;
      state.missions.chain.nextStep = mission.chainStep + 1;
    } else {
      state.missions.chain.active = false;
      state.missions.chain.total = 0;
      state.missions.chain.nextStep = 1;
    }
  }
}

function areMissionUpdatesBlockedByOverlay() {
  return state.levelUpPending === true
    || state.bossRewardPending === true
    || state.pauseReason === "levelup"
    || state.pauseReason === "bossreward";
}

function missionHudText() {
  const mission = state.missions.active;
  if (!mission) return "Mission: -";

  if (mission.failed) {
    return "Mission fehlgeschlagen";
  }

  if (mission.completed) {
    return `Mission abgeschlossen: +${mission.rewardScore} Punkte`;
  }

  if (mission.type === MISSION_TYPES.REACH_ZONE) {
    const shipX = state.ship && Number.isFinite(state.ship.worldX) ? state.ship.worldX : state.world.playerX;
    const shipY = state.ship && Number.isFinite(state.ship.worldY) ? state.ship.worldY : state.world.playerY;
    const dx = shipX - mission.targetWorldX;
    const dy = shipY - mission.targetWorldY;
    const distance = Number.isFinite(mission.currentDistance)
      ? mission.currentDistance
      : Math.hypot(dx, dy);
    const sx = mission.targetWorldX >= 0 ? "+" : "";
    const sy = mission.targetWorldY >= 0 ? "+" : "";
    return `Mission: ${mission.title} Dist ${Math.floor(distance)} <= ${Math.floor(mission.target)} WU @ ${sx}${Math.floor(mission.targetWorldX)}, ${sy}${Math.floor(mission.targetWorldY)} (+${mission.rewardScore})`;
  }

  if (mission.type === MISSION_TYPES.SPECIAL_TARGET) {
    const targetObj = state.objects.find((obj) => obj && obj.id === mission.specialTargetObjectId);
    if (!targetObj || targetObj.destroyed || targetObj.hp <= 0) {
      return `Mission: ${mission.title} [eliminiert] (+${mission.rewardScore})`;
    }
    const shipX = state.ship && Number.isFinite(state.ship.worldX) ? state.ship.worldX : state.world.playerX;
    const shipY = state.ship && Number.isFinite(state.ship.worldY) ? state.ship.worldY : state.world.playerY;
    const distance = Math.hypot((targetObj.worldX || 0) - shipX, (targetObj.worldY || 0) - shipY);
    return `Mission: ${mission.title} Dist ${Math.floor(distance)} WU (+${mission.rewardScore})`;
  }

  const value = missionProgressValue(mission);
  const shown = mission.unit === "Sek"
    ? value.toFixed(1)
    : `${Math.floor(value)}`;
  const targetShown = mission.unit === "Sek"
    ? mission.target.toFixed(1)
    : `${Math.floor(mission.target)}`;
  const missionText = `Mission: ${mission.title} ${shown}/${targetShown} ${mission.unit} (+${mission.rewardScore})`;
  const failText = missionFailStatusText(mission);
  const ch = state.runChallenge;
  if (ch && !ch.completed && !ch.failed) {
    const challengeShown = ch.unit === "Sek" ? ch.progress.toFixed(1) : `${Math.floor(ch.progress)}`;
    const challengeTarget = ch.unit === "Sek" ? ch.target.toFixed(1) : `${Math.floor(ch.target)}`;
    if (failText) {
      return `${missionText} | Fail: ${failText} | CH: ${challengeShown}/${challengeTarget} ${ch.unit}`;
    }
    return `${missionText} | CH: ${challengeShown}/${challengeTarget} ${ch.unit}`;
  }
  if (failText) {
    return `${missionText} | Fail: ${failText}`;
  }
  return missionText;
}

const BOSS_LOOT_DEFS = [
  {
    id: "loot_overdrive",
    title: "Boss-Loot: Overdrive Core",
    description: "Geschuetz feuert 18% schneller.",
    maxStacks: 4,
    apply: () => {
      state.shotCooldown = Math.max(0.04, state.shotCooldown * 0.82);
      playSfx("upgrade");
    },
  },
  {
    id: "loot_aegis",
    title: "Boss-Loot: Aegis Matrix",
    description: "+1 Schildladung (max 3).",
    maxStacks: 2,
    apply: () => {
      state.shield.unlocked = true;
      state.shield.maxCharges = Math.min(3, state.shield.maxCharges + 1);
      state.shield.charges = state.shield.maxCharges;
      state.shield.integrity = state.shield.charges;
      state.shield.cooldownUntil = state.time;
      playSfx("upgrade");
    },
  },
  {
    id: "loot_propulsion",
    title: "Boss-Loot: Ion Thrusters",
    description: "Mehr Schub und hoehere Maximalgeschwindigkeit.",
    maxStacks: 3,
    apply: () => {
      state.ship.thrust *= 1.12;
      state.ship.maxSpeed *= 1.08;
      playSfx("upgrade");
    },
  },
  {
    id: "loot_missile_core",
    title: "Boss-Loot: Raketenkern",
    description: "Raketen-Cooldown -20%, Blast +20.",
    maxStacks: 3,
    apply: () => {
      state.weapon.rocketUnlocked = true;
      state.weapon.rocketCooldown = Math.max(2.8, state.weapon.rocketCooldown * 0.8);
      state.weapon.rocketBlastRadius += 20;
      playSfx("upgrade");
    },
  },
  {
    id: "loot_salvage",
    title: "Boss-Loot: Salvage Scanner",
    description: "Dauerpunkte +20% (passives Scoring).",
    maxStacks: 3,
    apply: () => {
      state.upgradesTaken.lootSalvageBoost = (state.upgradesTaken.lootSalvageBoost || 0) + 1;
      playSfx("upgrade");
    },
  },
];

const UPGRADE_DEFS = [
  {
    id: "cannon_mount",
    title: "Geschuetz-Montage",
    description: "Aktiviert oder kalibriert das Basis-Geschuetz auf volle Leistung.",
    maxStacks: 1,
    canOffer: () => (!state.weapon.cannonUnlocked && canUnlockNewWeapon()) || state.weapon.cannonEffectiveness < 1,
    apply: () => {
      state.weapon.cannonUnlocked = true;
      state.weapon.cannonEffectiveness = 1;
      playSfx("upgrade");
    },
  },
  {
    id: "shield_core",
    title: "Schild",
    description: "Absorbiert 1 Treffer und laedt sich nach 10s wieder auf.",
    canOffer: () => !state.shield.unlocked && canUnlockNewWeapon(),
    apply: () => {
      state.shield.unlocked = true;
      state.shield.charges = state.shield.maxCharges;
      state.shield.integrity = state.shield.charges;
      state.shield.cooldownUntil = state.time;
      playSfx("upgrade");
    },
  },
  {
    id: "shield_recharge",
    title: "Schild-Generator+",
    description: "Schild lädt 2s schneller nach (mehrfach).",
    maxStacks: 3,
    canOffer: () => state.shield.unlocked,
    apply: () => {
      state.shield.rechargeDelay = Math.max(4, state.shield.rechargeDelay - 2);
      playSfx("upgrade");
    },
  },
  {
    id: "shield_thorns",
    title: "Schild-Stacheln",
    description: "Beim Treffer zerstoert der Schild nahe Objekte.",
    maxStacks: 1,
    canOffer: () => state.shield.unlocked,
    apply: () => {
      state.shield.thorns = true;
      playSfx("upgrade");
    },
  },
  {
    id: "shield_nova",
    title: "Schild-Nova",
    description: "Alle 30s eine starke Welle, die Objekte zerstoert.",
    maxStacks: 1,
    canOffer: () => state.shield.unlocked,
    apply: () => {
      state.shield.nova = true;
      state.shield.nextNova = state.time + GAMEPLAY_TUNING.shield.novaInterval;
      playSfx("upgrade");
    },
  },
  {
    id: "laser_extra",
    title: "Zusaetzliches Geschuetz",
    description: "+1 Kugelkanal (maximal 3 insgesamt).",
    maxStacks: 2,
    canOffer: () => state.weapon.cannonUnlocked && state.weapon.extraLasers < 2,
    apply: () => {
      state.weapon.extraLasers += 1;
      playSfx("upgrade");
    },
  },
  {
    id: "laser_rapid",
    title: "Geschuetz Overclock",
    description: "Hohe Feuerrate fuer Kugelgeschuetz (mehrfach stapelbar).",
    maxStacks: 5,
    canOffer: () => state.weapon.cannonUnlocked,
    apply: () => {
      state.shotCooldown = Math.max(0.05, state.shotCooldown * 0.88);
      playSfx("upgrade");
    },
  },
  {
    id: "laser_spread",
    title: "Geschuetz-Fokus",
    description: "Seitliche Kugelkanonen werden praeziser.",
    maxStacks: 3,
    canOffer: () => state.weapon.cannonUnlocked && state.weapon.extraLasers > 0,
    apply: () => {
      state.weapon.laserSpread = Math.max(6, state.weapon.laserSpread - 2);
      playSfx("upgrade");
    },
  },
  {
    id: "cannon_ricochet",
    title: "Ricochet-Ladung",
    description: "+1 moeglicher Abpraller fuer Geschuetzkugeln.",
    maxStacks: 4,
    canOffer: () => state.weapon.cannonUnlocked && (state.weaponSpecials.cannonRicochetMaxBounces || 0) >= 1 && (state.weaponSpecials.cannonRicochetMaxBounces || 0) < 5,
    apply: () => {
      state.weaponSpecials.cannonRicochetMaxBounces = Math.min(5, (state.weaponSpecials.cannonRicochetMaxBounces || 0) + 1);
      playSfx("upgrade");
    },
  },
  {
    id: "rocket_launcher",
    title: "Raketenwerfer",
    description: "Rechte Maustaste feuert Raketen (10s Cooldown).",
    maxStacks: 1,
    canOffer: () => !state.weapon.rocketUnlocked && canUnlockNewWeapon(),
    apply: () => {
      state.weapon.rocketUnlocked = true;
      state.weapon.lastRocketShot = -999;
      playSfx("upgrade");
    },
  },
  {
    id: "rocket_cooldown",
    title: "Schnelllade-Raketen",
    description: "Raketen-Cooldown sinkt um 1.5s (mehrfach).",
    maxStacks: 4,
    canOffer: () => state.weapon.rocketUnlocked,
    apply: () => {
      state.weapon.rocketCooldown = Math.max(3.5, state.weapon.rocketCooldown - 1.5);
      playSfx("upgrade");
    },
  },
  {
    id: "rocket_homing",
    title: "Zielsuchende Raketen",
    description: "Raketen folgen dem naechsten Ziel.",
    maxStacks: 1,
    canOffer: () => state.weapon.rocketUnlocked,
    apply: () => {
      state.weapon.rocketHoming = true;
      playSfx("upgrade");
    },
  },
  {
    id: "rocket_split",
    title: "Cluster-Raketen",
    description: "Raketen starten als Dreifachsalve.",
    maxStacks: 1,
    canOffer: () => state.weapon.rocketUnlocked,
    apply: () => {
      state.weapon.rocketSplit = true;
      playSfx("upgrade");
    },
  },
  {
    id: "rocket_blast",
    title: "Schockwellen-Sprengkopf",
    description: "Groesserer Explosionsradius fuer Raketen.",
    maxStacks: 3,
    canOffer: () => state.weapon.rocketUnlocked,
    apply: () => {
      state.weapon.rocketBlastRadius += 30;
      playSfx("upgrade");
    },
  },
  {
    id: "drill_module",
    title: "Bohrer-Modul",
    description: "Front-Bohrer zerstoert 1 Objekt, dann 5s Aufladung.",
    maxStacks: 1,
    canOffer: () => !state.weapon.drillUnlocked && canUnlockNewWeapon(),
    apply: () => {
      state.weapon.drillUnlocked = true;
      state.weapon.drillCharges = state.weapon.drillMaxCharges;
      state.weapon.drillCooldownUntil = state.time;
      playSfx("upgrade");
    },
  },
  {
    id: "drill_recharge",
    title: "Bohrer-Kondensator",
    description: "Bohrer laedt schneller auf und reicht weiter.",
    maxStacks: 4,
    canOffer: () => state.weapon.drillUnlocked,
    apply: () => {
      state.weapon.drillRechargeDelay = Math.max(2.2, state.weapon.drillRechargeDelay - 0.8);
      state.weapon.drillReach = Math.min(34, state.weapon.drillReach + 2.5);
      playSfx("upgrade");
    },
  },
  {
    id: "laser_emitter",
    title: "Laser-Emitter",
    description: "Kurzer Lichtstrahl zusaetzlich zum Geschuetz.",
    maxStacks: 1,
    canOffer: () => !state.weapon.laserUnlocked && canUnlockNewWeapon(),
    apply: () => {
      state.weapon.laserUnlocked = true;
      state.weapon.lastLaserShot = -999;
      playSfx("upgrade");
    },
  },
  {
    id: "plasma_emitter",
    title: "Plasmawerfer",
    description: "Lange fokussierte Hitze-Waffe mit Brand-DoT.",
    maxStacks: 1,
    canOffer: () => !state.weapon.plasmaUnlocked && canUnlockNewWeapon(),
    apply: () => {
      state.weapon.plasmaUnlocked = true;
      state.weapon.lastPlasmaShot = -999;
      playSfx("upgrade");
    },
  },
  {
    id: "plasma_focus",
    title: "Plasma-Fokus",
    description: "Mehr Brandschaden und engerer Kegel.",
    maxStacks: 4,
    canOffer: () => state.weapon.plasmaUnlocked,
    apply: () => {
      state.weapon.plasmaBurnDps += 0.25;
      state.weapon.plasmaArc = Math.max(0.08, state.weapon.plasmaArc - 0.025);
      playSfx("upgrade");
    },
  },
  {
    id: "plasma_fuel",
    title: "Plasma-Tank",
    description: "Mehr Reichweite, laengere Branddauer, schnelleres Feuern.",
    maxStacks: 4,
    canOffer: () => state.weapon.plasmaUnlocked,
    apply: () => {
      state.weapon.plasmaRange = Math.min(760, state.weapon.plasmaRange + 28);
      state.weapon.plasmaBurnDuration = Math.min(10, state.weapon.plasmaBurnDuration + 0.8);
      state.weapon.plasmaCooldown = Math.max(0.07, state.weapon.plasmaCooldown * 0.92);
      playSfx("upgrade");
    },
  },
  {
    id: "laser_charge",
    title: "Laser-Overcharge",
    description: "Laser verursacht mehr Schaden.",
    maxStacks: 4,
    canOffer: () => state.weapon.laserUnlocked,
    apply: () => {
      state.weapon.laserDamage += 1;
      state.weapon.laserCooldown = Math.max(0.09, state.weapon.laserCooldown * 0.9);
      playSfx("upgrade");
    },
  },
  {
    id: "laser_range",
    title: "Laser-Reichweite",
    description: "Laser reicht weiter und wird stabiler.",
    maxStacks: 4,
    canOffer: () => state.weapon.laserUnlocked,
    apply: () => {
      state.weapon.laserRange += 45;
      playSfx("upgrade");
    },
  },
  {
    id: "laser_pierce",
    title: "Laser-Piercing",
    description: "Laser kann mehrere Ziele in Linie treffen.",
    maxStacks: 2,
    canOffer: () => state.weapon.laserUnlocked,
    apply: () => {
      state.weapon.laserPierce += 1;
      playSfx("upgrade");
    },
  },
  {
    id: "stat_hull",
    title: "Hull Reinforcement",
    description: "+1 Max-HP und sofort +1 Heilung.",
    maxStacks: 6,
    canOffer: () => true,
    apply: () => {
      if (!state.ship || !state.shipStats) return;
      state.ship.maxHp += 1;
      state.shipStats.maxHp = state.ship.maxHp;
      state.ship.hp = Math.min(state.ship.maxHp, state.ship.hp + 1);
      playSfx("upgrade");
    },
  },
  {
    id: "stat_crit_chance",
    title: "Targeting Uplink",
    description: "+4% Krit-Chance.",
    maxStacks: 8,
    canOffer: () => (state.shipStats ? state.shipStats.critChance < 0.55 : true),
    apply: () => {
      state.shipStats.critChance = Math.min(0.55, state.shipStats.critChance + 0.04);
      playSfx("upgrade");
    },
  },
  {
    id: "stat_crit_damage",
    title: "Krit-Amplifier",
    description: "+15% Krit-Schaden.",
    maxStacks: 7,
    canOffer: () => true,
    apply: () => {
      state.shipStats.critDamage = Math.min(3.5, state.shipStats.critDamage + 0.15);
      playSfx("upgrade");
    },
  },
  {
    id: "stat_reload_tuning",
    title: "Reaktor-Tuning",
    description: "+8% Nachladerate fuer alle Waffen.",
    maxStacks: 8,
    canOffer: () => true,
    apply: () => {
      state.shipStats.reloadRate = Math.min(2.2, state.shipStats.reloadRate + 0.08);
      playSfx("upgrade");
    },
  },
  {
    id: "stat_thrusters",
    title: "Triebwerks-Tuning",
    description: "+8% Schub und Maximalgeschwindigkeit.",
    maxStacks: 7,
    canOffer: () => true,
    apply: () => {
      state.ship.thrust *= 1.08;
      state.ship.maxSpeed *= 1.08;
      playSfx("upgrade");
    },
  },
  {
    id: "stat_physical_damage",
    title: "Ballistik-Fokus",
    description: "+12% physischer Schaden (Geschuetz).",
    maxStacks: 8,
    canOffer: () => true,
    apply: () => {
      state.shipStats.physicalDamage = Math.min(3, state.shipStats.physicalDamage + 0.12);
      playSfx("upgrade");
    },
  },
  {
    id: "stat_energy_damage",
    title: "Plasma-Kalibrierung",
    description: "+12% Energieschaden (Laser).",
    maxStacks: 8,
    canOffer: () => true,
    apply: () => {
      state.shipStats.energyDamage = Math.min(3, state.shipStats.energyDamage + 0.12);
      playSfx("upgrade");
    },
  },
  {
    id: "stat_explosive_damage",
    title: "Sprengstoff-Mix",
    description: "+12% Explosivschaden (Raketen).",
    maxStacks: 8,
    canOffer: () => true,
    apply: () => {
      state.shipStats.explosiveDamage = Math.min(3, state.shipStats.explosiveDamage + 0.12);
      playSfx("upgrade");
    },
  },
  {
    id: "stat_heat_damage",
    title: "Thermo-Linsen",
    description: "+12% Hitzeschaden (Plasma + Brand-DoT).",
    maxStacks: 8,
    canOffer: () => true,
    apply: () => {
      state.shipStats.heatDamage = Math.min(3, state.shipStats.heatDamage + 0.12);
      playSfx("upgrade");
    },
  },
  {
    id: "stat_armor_core",
    title: "Panzerungsplatten",
    description: "+1 maximale Panzerung und +1 sofortige Wiederherstellung.",
    maxStacks: 8,
    canOffer: () => true,
    apply: () => {
      state.ship.maxArmor += 1;
      state.ship.armor = Math.min(state.ship.maxArmor, state.ship.armor + 1);
      state.shipStats.maxArmor = state.ship.maxArmor;
      playSfx("upgrade");
    },
  },
  {
    id: "stat_toxic_filter",
    title: "Toxic Filter",
    description: "Spaetes Gegenmassnahmen-Upgrade: reduziert Saeure-DoT um 10%.",
    maxStacks: 6,
    canOffer: () => state.level >= 8,
    apply: () => {
      if (!state.ship) return;
      state.ship.acidResist = Math.min(0.65, (state.ship.acidResist || 0) + 0.1);
      state.ship.acidDps = Math.max(0, (state.ship.acidDps || 0) * 0.85);
      playSfx("upgrade");
    },
  },
  {
    id: "stat_scanner_hardening",
    title: "Scanner Hardening",
    description: "Spaetes Gegenmassnahmen-Upgrade: reduziert Scanner-Stoerung um 12%.",
    maxStacks: 6,
    canOffer: () => state.level >= 12,
    apply: () => {
      if (!state.ship) return;
      state.ship.scannerHarden = Math.min(0.72, (state.ship.scannerHarden || 0) + 0.12);
      state.ship.scannerJam = Math.max(0, (state.ship.scannerJam || 0) * 0.72);
      playSfx("upgrade");
    },
  },
];

function getSprite(key) {
  if (!spriteAssets || !spriteAssets.ready()) return null;
  return spriteAssets.get(key);
}

function scaleEntitiesToWorld(sx, sy) {
  for (const collection of [state.objects, state.bullets, state.laserBeams, state.plasmaBursts, state.missiles, state.pickups, state.bossProjectiles, state.particles, state.damageTexts, state.stars]) {
    for (const entity of collection) {
      if (typeof entity.x === "number") entity.x *= sx;
      if (typeof entity.y === "number") entity.y *= sy;
      if (typeof entity.x1 === "number") entity.x1 *= sx;
      if (typeof entity.y1 === "number") entity.y1 *= sy;
      if (typeof entity.x2 === "number") entity.x2 *= sx;
      if (typeof entity.y2 === "number") entity.y2 *= sy;
    }
  }

  if (state.ship) {
    state.ship.x *= sx;
    state.ship.y *= sy;
  }

  if (state.boss) {
    state.boss.x *= sx;
    state.boss.y *= sy;
    state.boss.baseY *= sy;
  }

  input.mouseX *= sx;
  input.mouseY *= sy;
}

function applyWorldSize(newWidth, newHeight) {
  const oldWidth = WORLD.width;
  const oldHeight = WORLD.height;

  if (oldWidth === newWidth && oldHeight === newHeight) return;

  const sx = newWidth / oldWidth;
  const sy = newHeight / oldHeight;

  WORLD.width = newWidth;
  WORLD.height = newHeight;
  canvas.width = newWidth;
  canvas.height = newHeight;

  scaleEntitiesToWorld(sx, sy);

  input.mouseX = clamp(input.mouseX, 0, WORLD.width);
  input.mouseY = clamp(input.mouseY, 0, WORLD.height);

  if (state.ship) {
    state.ship.x = clamp(state.ship.x, state.ship.radius, WORLD.width - state.ship.radius);
    state.ship.y = clamp(state.ship.y, state.ship.radius, WORLD.height - state.ship.radius);
  }
}

function fitMobileViewport() {
  const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const hudVisible = hudEl ? window.getComputedStyle(hudEl).display !== "none" : false;
  const hudHeight = hudVisible && hudEl ? hudEl.offsetHeight : 0;
  const notesVisible = notesEl ? window.getComputedStyle(notesEl).display !== "none" : false;
  const notesHeight = notesVisible && notesEl ? notesEl.offsetHeight : 0;

  const sideInset = IS_COARSE_POINTER ? 8 : 18;
  const verticalInset = IS_COARSE_POINTER ? 18 : 28;

  const horizontalSpace = Math.max(420, viewportWidth - sideInset * 2);
  const verticalSpace = Math.max(240, viewportHeight - hudHeight - notesHeight - verticalInset);

  const maxDesktopWidth = IS_COARSE_POINTER ? 1280 : 1860;
  const maxDesktopHeight = IS_COARSE_POINTER ? 900 : 1060;
  const usableWidth = Math.min(horizontalSpace, maxDesktopWidth);
  const usableHeight = Math.min(verticalSpace, maxDesktopHeight);

  let nextWidth = usableWidth;
  let nextHeight = Math.floor(nextWidth / BASE_WORLD.aspect);

  if (nextHeight > usableHeight) {
    nextHeight = usableHeight;
    nextWidth = Math.floor(nextHeight * BASE_WORLD.aspect);
  }

  applyWorldSize(Math.max(420, Math.floor(nextWidth)), Math.max(240, Math.floor(nextHeight)));

  if (stageWrapEl) {
    stageWrapEl.style.width = `${WORLD.width}px`;
    stageWrapEl.style.height = `${WORLD.height}px`;
  }
}

function applyBlackHoleEntityEffects(dt) {
  if (dt <= 0) return;
  const zones = typeof worldSystem.getBlackHoleZones === "function" ? worldSystem.getBlackHoleZones() : [];
  if (!zones || zones.length === 0) return;

  for (const zone of zones) {
    const gravityR = zone.gravityRadius || 220;
    const horizonR = zone.eventHorizonRadius || 28;
    const gravityPull = zone.gravityPull || 220;
    const parallax = zone.parallax || 0.3;

    const applyPull = (entity, lifeProp = null) => {
      if (!entity) return;
      if (lifeProp && entity[lifeProp] <= 0) return;
      if (!Number.isFinite(entity.worldX) || !Number.isFinite(entity.worldY)) return;
      if (!Number.isFinite(entity.vx) || !Number.isFinite(entity.vy)) return;

      const dx = zone.x - entity.worldX;
      const dy = zone.y - entity.worldY;
      const d = Math.hypot(dx, dy);
      if (d <= horizonR) {
        if (lifeProp) entity[lifeProp] = 0;
        return;
      }
      if (d > gravityR) return;

      const t = Math.max(0, 1 - d / gravityR);
      const nx = dx / Math.max(1, d);
      const ny = dy / Math.max(1, d);
      const pull = gravityPull * (0.16 + t * 1.18) * dt * Math.max(0.25, parallax);
      entity.vx += nx * pull;
      entity.vy += ny * pull;
    };

    for (const obj of state.objects) {
      if (!obj || obj.hp <= 0 || obj.destroyed) continue;
      const dx = zone.x - (obj.worldX || 0);
      const dy = zone.y - (obj.worldY || 0);
      const d = Math.hypot(dx, dy);
      if (d <= horizonR + (obj.collisionRadius || 8) * 0.25) {
        destroyObject(obj, DESTROY_REASONS.COLLISION);
        continue;
      }
      applyPull(obj);
    }

    for (const bullet of state.bullets) applyPull(bullet, "life");
    for (const missile of state.missiles) applyPull(missile, "life");
    for (const burst of state.plasmaBursts) applyPull(burst, "life");
    for (const proj of state.bossProjectiles) applyPull(proj, "life");

    for (const pickup of state.pickups) {
      if (!pickup || pickup.life <= 0 || !Number.isFinite(pickup.worldX) || !Number.isFinite(pickup.worldY)) continue;
      const dx = zone.x - pickup.worldX;
      const dy = zone.y - pickup.worldY;
      const d = Math.hypot(dx, dy);
      if (d <= horizonR + (pickup.radius || 8) * 0.2) {
        pickup.life = 0;
        continue;
      }
      applyPull(pickup, "life");
    }
  }
}

function scheduleMobileViewportFit() {
  fitMobileViewport();
  requestAnimationFrame(() => {
    fitMobileViewport();
  });
  setTimeout(fitMobileViewport, 120);
}

function selectedShipModel() {
  return SHIP_MODELS[state.selectedShipId] || SHIP_MODELS.scout;
}

function selectedDifficultyMode() {
  return DIFFICULTY_MODES[state.selectedDifficultyId] || DIFFICULTY_MODES.medium;
}

function setPauseIndicatorVisible(visible) {
  if (!pauseIndicatorEl) return;
  pauseIndicatorEl.classList.toggle("hidden", !visible);
  pauseIndicatorEl.classList.toggle("pause", visible);
}

function getMultiplayerLobbyState() {
  if (!multiplayerSystem || typeof multiplayerSystem.getLobbyState !== "function") return null;
  return multiplayerSystem.getLobbyState();
}

function isMultiplayerHost() {
  const lobby = getMultiplayerLobbyState();
  if (!lobby) return false;
  return Boolean(lobby.selfId && lobby.hostId && lobby.selfId === lobby.hostId);
}

function isHostSpectatingAfterDeath() {
  return Boolean(
    state.gameOver
    && state.multiplayer.enabled
    && multiplayerSystem
    && typeof multiplayerSystem.isHost === "function"
    && multiplayerSystem.isHost(),
  );
}

function isMultiplayerSpectatingAfterDeath() {
  return Boolean(state.gameOver && state.multiplayer.enabled);
}

const menus = createMenuSystem({
  state,
  overlay,
  SHIP_MODELS,
  DIFFICULTY_MODES,
  setPauseIndicatorVisible,
  playMusicCategory,
});

const worldSystem = createWorldSystem({
  chunkSize: WORLD_CHUNK_SIZE,
  worldSeed: state.worldSeed,
  activeRadius: 6,
  unloadRadius: 8,
});

const cameraSystem = createCameraSystem({
  x: 0,
  y: 0,
  smoothing: 0.12,
  lookAheadSeconds: 0.11,
  lookAheadMax: 80,
  lookSmoothing: 0.16,
});

const multiplayerSystem = typeof createMultiplayerSystem === "function"
  ? createMultiplayerSystem({
    onStatusChange: (status) => {
      state.multiplayer.enabled = Boolean(status && status.enabled);
      state.multiplayer.connected = Boolean(status && status.connected);
      state.multiplayer.roomId = (status && status.roomId) || "solo";
      state.multiplayer.localName = (status && status.localName) || "Pilot";
      state.multiplayer.wsUrl = (status && status.wsUrl) || "";
      state.multiplayer.remoteCount = Math.max(0, Number((status && status.remoteCount) || 0));
      if (state.running || state.pauseReason !== "menu") {
        refreshHud();
      }
    },
    onLobbyChange: () => {
      if (state.pauseReason === "multiplayer-lobby" && typeof menus.showMultiplayerLobby === "function" && multiplayerSystem) {
        menus.showMultiplayerLobby(multiplayerSystem.getStatus(), multiplayerSystem.getLobbyState());
      }
    },
    onRoomStarted: () => {
      if (!state.multiplayer.enabled) return;
      if (isMultiplayerHost()) {
        menus.showDifficultySelectionMenu();
      } else if (typeof menus.showMultiplayerWaitingForHostConfig === "function" && multiplayerSystem) {
        menus.showMultiplayerWaitingForHostConfig(multiplayerSystem.getStatus(), multiplayerSystem.getLobbyState());
      }
    },
    onRoomConfig: ({ config }) => {
      if (!state.multiplayer.enabled) return;
      if (!config) return;
      if (config.difficultyId && DIFFICULTY_MODES[config.difficultyId]) {
        state.selectedDifficultyId = config.difficultyId;
      }
      if (Number.isFinite(config.seed) && config.seed > 0) {
        state.worldSeed = Math.floor(config.seed);
      }
      menus.showShipSelectionMenu();
    },
    onRoomLobby: () => {
      state.running = false;
      state.gameOver = false;
      state.pauseReason = "multiplayer-lobby";
      state.multiplayer.lastMirrorFireActionAt = 0;
      state.multiplayer.remoteCannonLastById = {};
      state.multiplayer.remoteRocketLastById = {};
      input.shooting = false;
      input.rocketQueued = false;
      setPauseIndicatorVisible(false);
      if (state.multiplayer.enabled && typeof menus.showMultiplayerLobby === "function" && multiplayerSystem) {
        menus.showMultiplayerLobby(multiplayerSystem.getStatus(), multiplayerSystem.getLobbyState());
      }
    },
    onRoomMenu: () => {
      state.running = false;
      state.gameOver = false;
      state.pauseReason = "menu";
      state.multiplayer.lastMirrorFireActionAt = 0;
      state.multiplayer.remoteCannonLastById = {};
      state.multiplayer.remoteRocketLastById = {};
      input.shooting = false;
      input.rocketQueued = false;
      setPauseIndicatorVisible(false);
      if (multiplayerSystem && typeof multiplayerSystem.configure === "function") {
        multiplayerSystem.configure({ enabled: false });
      }
      menus.showMainLandingMenu();
    },
  })
  : null;

function reloadRate() {
  const base = state.shipStats ? state.shipStats.reloadRate : 1;
  const buff = state.missionRewardBuff;
  if (buff && state.time < buff.until) {
    return base * Math.max(1, buff.reloadMult || 1);
  }
  return base;
}

function effectiveRocketCooldown() {
  return weapons.effectiveRocketCooldown();
}

function effectiveCannonCooldown() {
  return weapons.effectiveCannonCooldown();
}

function effectiveLaserCooldown() {
  return weapons.effectiveLaserCooldown();
}

function effectivePlasmaCooldown() {
  return weapons.effectivePlasmaCooldown();
}

function rollCrit() {
  const chance = state.shipStats ? state.shipStats.critChance : 0.1;
  return Math.random() < chance;
}

function computeDamage(baseDamage, damageType = "physical") {
  const crit = rollCrit();
  const critMult = state.shipStats ? state.shipStats.critDamage : 1.5;
  const typeMult = state.shipStats
    ? damageType === "energy"
      ? state.shipStats.energyDamage
      : damageType === "explosive"
        ? state.shipStats.explosiveDamage
        : damageType === "heat"
          ? state.shipStats.heatDamage
        : state.shipStats.physicalDamage
    : 1;
  const scaled = baseDamage * typeMult;
  const dmg = crit ? scaled * critMult : scaled;
  return {
    damage: Math.max(1, Math.floor(dmg)),
    crit,
  };
}

function addDamageText(x, y, amount, crit = false) {
  if (!state.debugHitboxes) return;
  const life = crit ? 0.82 : 0.62;
  state.damageTexts.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 10,
    vy: crit ? -40 : -30,
    life,
    maxLife: life,
    text: `${Math.max(0, Math.floor(amount))}`,
    crit,
  });
}

function hitShip(damageType = "physical", amount = 1) {
  return shipDamage.hitShip(damageType, amount);
}

function spawnIntensity() {
  // Progression pressure increases only after each defeated boss.
  return 1 + Math.min(
    GAMEPLAY_TUNING.progression.spawnIntensityCap,
    state.bossLevelsCleared * GAMEPLAY_TUNING.progression.spawnIntensityPerBoss,
  );
}

const encounters = createEncountersSystem({
  state,
  WORLD,
  BOSS_VARIANTS,
  randomFrom,
  selectedDifficultyMode,
  createExplosion,
  playSfx,
  nextObjectId,
  worldSystem,
  cameraSystem,
});

const scoring = createScoringSystem({
  state,
  selectedDifficultyMode,
  clamp,
});

const progression = createProgressionSystem({
  state,
  overlay,
  playSfx,
  refreshHud,
  spawnBoss: encounters.spawnBoss,
  computeNextLevelCost: scoring.computeNextLevelCost,
  setPauseIndicatorVisible,
  upgradeDefs: UPGRADE_DEFS,
  upgradeWeights: UPGRADE_WEIGHTS,
  bossLootDefs: BOSS_LOOT_DEFS,
  weaponUpgradeTrack: WEAPON_UPGRADE_TRACK,
  weaponLevelMilestones: WEAPON_LEVEL_MILESTONES,
  balanceProfileId: BALANCE_PROFILE_ID,
});

const debugTools = createDebugToolsSystem({
  state,
  stageWrapEl,
  shipInfoPanelEl,
  progression,
  balanceTuningTracks: BALANCE_TUNING_TRACKS,
});

function onBossDefeated() {
  if (!state.bossActive || !state.boss) return;
  const guaranteedLoot = state.boss.hasLoot;
  createExplosion(state.boss.x, state.boss.y, "#ff7b4a", 64);
  scoring.addPoints(220 + state.level * 20);
  state.bossActive = false;
  state.boss = null;
  state.bossProjectiles = [];
  state.bossLevelsCleared += 1;

  // Boss clear grants mastery progress to currently equipped systems.
  for (const track of ["cannon", "laser", "rocket", "drill", "plasma", "shield"]) {
    if ((state.weaponLevels[track] || 0) > 0) {
      progression.gainWeaponLevel(track, 1);
    }
  }

  playSfx("explosion");

  if (guaranteedLoot) {
    progression.showBossRewardChoice();
    return;
  }

  if (Math.random() < 0.42) {
    progression.showBossRewardChoice();
  }
}

function resetGame() {
  initAudio();
  playMusicCategory("game");
  const model = selectedShipModel();
  const difficulty = selectedDifficultyMode();
  const maxHp = Math.max(2, Math.round(model.maxHp * difficulty.playerHpMult * 2));
  state.shipStats = {
    maxHp,
    maxArmor: Math.max(1, Math.round(model.maxArmor * difficulty.playerHpMult)),
    speed: model.speed,
    critChance: model.critChance,
    critDamage: model.critDamage,
    physicalDamage: model.physicalDamage,
    energyDamage: model.energyDamage,
    explosiveDamage: model.explosiveDamage,
    heatDamage: model.heatDamage,
    reloadRate: model.reloadRate,
    xpBonus: model.xpBonus,
    colorA: model.colorA,
    colorB: model.colorB,
    role: model.role,
    name: model.name,
  };

  state.running = true;
  state.gameOver = false;
  state.pauseReason = "running";
  state.lastDeathPenalty = null;
  state.multiplayer.lastMirrorFireActionAt = 0;
  state.multiplayer.remoteCannonLastById = {};
  state.multiplayer.remoteRocketLastById = {};
  state.levelUpPending = false;
  state.score = 0;
  state.kills = 0;
  state.shipHitsTaken = 0;
  state.killStatsByType.miniAlien = 0;
  state.killStatsByType.alienShip = 0;
  state.killStatsByType.mothership = 0;
  state.killStatsByType.smallRock = 0;
  state.killStatsByType.mediumRock = 0;
  state.killStatsByType.boulder = 0;
  state.killStatsByType.debris = 0;
  state.killStatsByType.goldAsteroid = 0;
  state.killStatsByType.ironAsteroid = 0;
  state.runStats.distanceWU = 0;
  state.runStats.topSpeedWU = 0;
  state.runStats.exploredChunks = Object.create(null);
  state.runStats.exploredChunksCount = 0;
  state.time = 0;
  state.realNow = performance.now() / 1000;
  state.level = 1;
  state.levelCost = 220;
  state.nextLevelScore = 220;
  state.lastLevelScore = 0;
  state.lastLevelTime = 0;
  state.lastLevelKills = 0;
  state.objects = [];
  state.bullets = [];
  state.laserBeams = [];
  state.plasmaBursts = [];
  state.missiles = [];
  state.pickups = [];
  state.bossProjectiles = [];
  state.particles = [];
  state.damageTexts = [];
  state.pendingUpgradeOptions = [];
  state.objectIdCounter = 1;
  state.lastSpawn = 0;
  state.lastShot = 0;
  state.shotCooldown = 0.14;
  state.bossActive = false;
  state.boss = null;
  state.bossLevelsCleared = 0;
  state.bossRewardPending = false;
  state.pendingBossRewards = [];
  state.bossLootTaken = {};
  state.missionRerollTokens = 0;
  state.missionRewardBuff = null;
  state.missionLog = [];
  state.missions.serial = 0;
  state.missions.runSeed = state.worldSeed;
  state.missions.offers = [];
  state.missions.chain.active = false;
  state.missions.chain.total = 0;
  state.missions.chain.nextStep = 1;
  state.missions.active = null;
  worldSystem.setSeed(state.worldSeed);
  encounters.resetChunkSpawns();
  state.world.playerX = 0;
  state.world.playerY = 0;
  cameraSystem.snap(0, 0);
  worldSystem.update(0, 0);

  state.weapon.extraLasers = 0;
  state.weapon.cannonUnlocked = Boolean(model.startCannonHalf || !(model.startShield || model.startLaser || model.startRocket || model.startDrill || model.startPlasma));
  state.weapon.cannonEffectiveness = model.startCannonHalf ? 0.5 : 1;
  state.weapon.laserSpread = 11;
  state.weapon.laserUnlocked = false;
  state.weapon.laserCooldown = 0.22;
  state.weapon.lastLaserShot = -999;
  state.weapon.laserRange = 260;
  state.weapon.laserDamage = 1;
  state.weapon.laserPierce = 1;
  state.weapon.rocketUnlocked = false;
  state.weapon.rocketCooldown = 10 * model.rocketCooldownMult;
  state.weapon.lastRocketShot = -999;
  state.weapon.lastRocketRealShot = -999;
  state.weapon.rocketHoming = false;
  state.weapon.rocketSplit = false;
  state.weapon.rocketDamage = 18;
  state.weapon.rocketBlastRadius = 110;
  state.weapon.drillUnlocked = false;
  state.weapon.drillRechargeDelay = 5 * model.drillRechargeMult;
  state.weapon.drillCharges = 0;
  state.weapon.drillMaxCharges = 1;
  state.weapon.drillCooldownUntil = 0;
  state.weapon.drillRadius = 13;
  state.weapon.drillReach = 18;
  state.weapon.plasmaUnlocked = false;
  state.weapon.plasmaCooldown = 0.12;
  state.weapon.lastPlasmaShot = -999;
  state.weapon.plasmaRange = 520;
  state.weapon.plasmaArc = 0.18;
  state.weapon.plasmaDamage = 0;
  state.weapon.plasmaBurnDps = 1.65;
  state.weapon.plasmaBurnDuration = 5;

  state.shield.unlocked = false;
  state.shield.charges = 0;
  state.shield.integrity = 0;
  state.shield.maxCharges = 1;
  state.shield.rechargeDelay = 10 * model.shieldRechargeMult;
  state.shield.thornPulseRadius = 78;
  state.shield.thornBreakRadius = 105;
  state.shield.cooldownUntil = 0;
  state.shield.thorns = false;
  state.shield.nova = false;
  state.shield.nextNova = 30;
  state.shield.lastThornPulseAt = -999;

  state.upgradesTaken = {};
  state.showShipInfo = false;
  state.joystickPointerId = null;
  input.axisX = 0;
  input.axisY = 0;
  if (joyKnobEl) {
    joyKnobEl.style.transform = "translate(0px, 0px)";
  }
  if (shipInfoPanelEl) {
    shipInfoPanelEl.classList.add("hidden");
  }

  state.ship = {
    x: WORLD.width * 0.5,
    y: WORLD.height * 0.5,
    worldX: 0,
    worldY: 0,
    vx: 0,
    vy: 0,
    hp: maxHp,
    maxHp: maxHp,
    armor: Math.max(0, Math.round((state.shipStats ? state.shipStats.maxArmor : 2) * 0.65)),
    maxArmor: state.shipStats ? state.shipStats.maxArmor : 2,
    invulnUntil: 0,
    scannerJam: 0,
    scannerHarden: 0,
    acidResist: 0,
    wormholeCooldownUntil: 0,
    radius: 17,
    thrust: 420 * model.speed,
    maxSpeed: 560 * model.speed,
  };

  state.world.playerX = state.ship.worldX;
  state.world.playerY = state.ship.worldY;
  trackExploredChunk(state.ship.worldX, state.ship.worldY);
  cameraSystem.snap(state.ship.worldX, state.ship.worldY);
  worldSystem.update(state.ship.worldX, state.ship.worldY);

  state.stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * WORLD.width,
    y: Math.random() * WORLD.height,
    size: Math.random() * 2 + 0.6,
    speed: 25 + Math.random() * 90,
  }));

  // Starter loadout by ship archetype.
  state.weapon.laserUnlocked = model.startLaser;
  state.weapon.rocketUnlocked = model.startRocket;
  state.weapon.drillUnlocked = model.startDrill;
  state.weapon.plasmaUnlocked = model.startPlasma;
  if (state.weapon.drillUnlocked) {
    state.weapon.drillCharges = state.weapon.drillMaxCharges;
    state.weapon.drillCooldownUntil = state.time;
  }

  state.shield.unlocked = model.startShield;
  if (state.shield.unlocked) {
    state.shield.charges = state.shield.maxCharges;
    state.shield.integrity = state.shield.charges;
    state.shield.cooldownUntil = state.time;
  }

  progression.initializeWeaponLevelsFromLoadout();
  assignRunChallenge(0);
  assignNextMission(0, true);

  overlay.classList.add("hidden");
  setPauseIndicatorVisible(false);
  refreshHud();
}

function refreshHud() {
  scoreEl.textContent = Math.floor(state.score);
  killsEl.textContent = state.kills;
  timeEl.textContent = state.time.toFixed(1);
  levelEl.textContent = state.level;
  if (state.ship) {
    hpStatusEl.textContent = `${Math.max(0, state.ship.hp)}/${state.ship.maxHp}`;
    if (armorStatusEl) {
      armorStatusEl.textContent = `${Math.max(0, Math.floor(state.ship.armor))}/${state.ship.maxArmor}`;
    }
    if (hazardStatusEl) {
      const acidResistPct = Math.round(Math.max(0, Math.min(0.9, state.ship.acidResist || 0)) * 100);
      const scannerResistPct = Math.round(Math.max(0, Math.min(0.9, state.ship.scannerHarden || 0)) * 100);
      hazardStatusEl.textContent = `Saeure -${acidResistPct}% | Scanner -${scannerResistPct}%`;
    }
  }
  critStatusEl.textContent = `${Math.round((state.shipStats ? state.shipStats.critChance : 0.1) * 100)}%`;
  if (physicalStatusEl) {
    physicalStatusEl.textContent = `${Math.round((state.shipStats ? state.shipStats.physicalDamage : 1) * 100)}%`;
  }
  if (energyStatusEl) {
    energyStatusEl.textContent = `${Math.round((state.shipStats ? state.shipStats.energyDamage : 1) * 100)}%`;
  }
  if (explosiveStatusEl) {
    explosiveStatusEl.textContent = `${Math.round((state.shipStats ? state.shipStats.explosiveDamage : 1) * 100)}%`;
  }
  if (heatStatusEl) {
    heatStatusEl.textContent = `${Math.round((state.shipStats ? state.shipStats.heatDamage : 1) * 100)}%`;
  }
  reloadStatusEl.textContent = `${Math.round(reloadRate() * 100)}%`;
  xpStatusEl.textContent = `${Math.round(((state.shipStats ? state.shipStats.xpBonus : 1) - 1) * 100)}%`;
  if (weaponLevelsStatusEl) {
    const tierClass = (lvl) => {
      if (lvl >= 20) return "weapon-level-tier-orange";
      if (lvl >= 15) return "weapon-level-tier-purple";
      if (lvl >= 10) return "weapon-level-tier-blue";
      if (lvl >= 5) return "weapon-level-tier-green";
      return "weapon-level-tier-white";
    };
    const entries = [];
    if ((state.weaponLevels.cannon || 0) > 0) entries.push(`<span class="${tierClass(state.weaponLevels.cannon)}">Geschuetz L${state.weaponLevels.cannon}</span>`);
    if ((state.weaponLevels.laser || 0) > 0) entries.push(`<span class="${tierClass(state.weaponLevels.laser)}">Laser L${state.weaponLevels.laser}</span>`);
    if ((state.weaponLevels.rocket || 0) > 0) entries.push(`<span class="${tierClass(state.weaponLevels.rocket)}">Rakete L${state.weaponLevels.rocket}</span>`);
    if ((state.weaponLevels.drill || 0) > 0) entries.push(`<span class="${tierClass(state.weaponLevels.drill)}">Bohrer L${state.weaponLevels.drill}</span>`);
    if ((state.weaponLevels.plasma || 0) > 0) entries.push(`<span class="${tierClass(state.weaponLevels.plasma)}">Plasma L${state.weaponLevels.plasma}</span>`);
    if ((state.weaponLevels.shield || 0) > 0) entries.push(`<span class="${tierClass(state.weaponLevels.shield)}">Schild L${state.weaponLevels.shield}</span>`);
    weaponLevelsStatusEl.innerHTML = entries.length > 0 ? entries.join('<span class="weapon-level-sep">|</span>') : "-";
  }
  if (fireModeStatusEl) {
    fireModeStatusEl.textContent = state.desktopAutoFire ? "Automatisch" : "Manuell (LMB)";
  }
  if (musicStatusEl) {
    musicStatusEl.textContent = state.musicEnabled ? "An (M)" : "Aus (M)";
  }
  if (mpStatusEl) {
    if (!state.multiplayer.enabled) {
      mpStatusEl.textContent = "SP";
    } else if (!state.multiplayer.connected) {
      mpStatusEl.textContent = "Verbinden...";
    } else {
      mpStatusEl.textContent = `Online (${state.multiplayer.remoteCount + 1})`;
    }
  }
  if (exploredChunksStatEl) {
    exploredChunksStatEl.textContent = `${Math.max(0, state.runStats.exploredChunksCount || 0)}`;
  }
  if (enemyKillsByTypeStatEl) {
    const mini = Math.max(0, Number((state.killStatsByType && state.killStatsByType.miniAlien) || 0));
    const ships = Math.max(0, Number((state.killStatsByType && state.killStatsByType.alienShip) || 0));
    enemyKillsByTypeStatEl.textContent = `Mini ${mini} | Schiff ${ships}`;
  }
  if (topSpeedStatEl) {
    topSpeedStatEl.textContent = `${Math.floor(Math.max(0, state.runStats.topSpeedWU || 0))} WU/s`;
  }
  if (distanceStatEl) {
    distanceStatEl.textContent = `${Math.floor(Math.max(0, state.runStats.distanceWU || 0))} WU`;
  }

  if (missionWidgetTitleEl && missionWidgetProgressEl) {
    const mission = state.missions && state.missions.active;
    if (!mission) {
      missionWidgetTitleEl.textContent = "Keine aktive Mission";
      missionWidgetProgressEl.textContent = "Nimm eine Mission im Pause-Menue an.";
    } else {
      missionWidgetTitleEl.textContent = mission.title;
      if (mission.failed) {
        missionWidgetProgressEl.textContent = "Fehlgeschlagen";
      } else if (mission.completed) {
        missionWidgetProgressEl.textContent = `Abgeschlossen (+${mission.rewardScore})`;
      } else if (mission.type === MISSION_TYPES.REACH_ZONE) {
        const distance = Number.isFinite(mission.currentDistance) ? mission.currentDistance : 0;
        missionWidgetProgressEl.textContent = `${Math.floor(distance)} / ${Math.floor(mission.target)} WU`;
      } else {
        const value = missionProgressValue(mission);
        const shown = mission.unit === "Sek" ? value.toFixed(1) : `${Math.floor(value)}`;
        const targetShown = mission.unit === "Sek" ? mission.target.toFixed(1) : `${Math.floor(mission.target)}`;
        missionWidgetProgressEl.textContent = `${shown} / ${targetShown} ${mission.unit}`;
      }

      const failText = missionFailStatusText(mission);
      if (failText && !mission.failed && !mission.completed) {
        missionWidgetProgressEl.textContent += ` | ${failText}`;
      }
    }
  }

  if (!state.shield.unlocked) {
    shieldStatusEl.textContent = "Aus";
  } else if (state.shield.charges > 0) {
    shieldStatusEl.textContent = "Bereit";
  } else {
    const left = Math.max(0, state.shield.cooldownUntil - state.time);
    shieldStatusEl.textContent = `Laedt ${left.toFixed(1)}s`;
  }

  if (!state.weapon.rocketUnlocked) {
    rocketStatusEl.textContent = "Nicht freigeschaltet";
  } else {
    const left = getRocketCooldownLeft();
    rocketStatusEl.textContent = left > 0.05 ? `${left.toFixed(1)}s` : "Bereit";
  }

  debugTools.updateBalanceDebugPanel();
}

function setGameOver() {
  if (state.gameOver) return;

  if (state.runChallenge && !state.runChallenge.completed) {
    state.runChallenge.failed = true;
    pushMissionLog(`Challenge fehlgeschlagen: ${state.runChallenge.title}`);
  }

  const mission = state.missions && state.missions.active;
  if (mission && mission.type === MISSION_TYPES.SURVIVE && !mission.completed && !mission.failed) {
    mission.failed = true;
    mission.failReason = "Tod";
    mission.failedUntil = state.time + 2.2;
  }

  const deathPenalty = applyDeathPenalty();

  const multiplayerSpectate = Boolean(state.multiplayer.enabled);

  state.running = multiplayerSpectate;
  state.gameOver = true;
  state.pauseReason = "gameover";
  input.shooting = false;
  input.rocketQueued = false;
  if (multiplayerSpectate && state.ship) {
    state.ship.vx = 0;
    state.ship.vy = 0;
    state.ship.acidUntil = 0;
    state.ship.acidTickCarry = 0;
    state.ship.hp = Math.max(1, Number(state.ship.hp) || 1);
    state.ship.invulnUntil = state.time + 3600;
  }
  setPauseIndicatorVisible(false);
  overlay.classList.remove("hidden");
  playMusicCategory("menu");
  const hostCanControlRoom = state.multiplayer.enabled && isMultiplayerHost();
  const restartButton = state.multiplayer.enabled
    ? `<button data-action="continue-after-death">Weiter</button>`
    : `<button data-action="restart">Neu starten</button>`;
  const mpButtons = hostCanControlRoom
    ? `<button data-action="multiplayer-return-lobby">Zurueck zur Lobby</button>`
    : "";
  const menuButton = hostCanControlRoom
    ? `<button data-action="open-main-menu">Zurueck zum Menue</button>`
    : `<button data-action="open-main-menu">Menue verlassen</button>`;
  const penaltyText = deathPenalty
    ? `<p>Strafe: -${deathPenalty.scorePenalty} Punkte | -${deathPenalty.lostLevels} Level | -${deathPenalty.lostUpgrades} Upgrades</p>`
    : "";
  overlay.innerHTML = `
    <h1>Game Over</h1>
    <p>Zeit: ${state.time.toFixed(1)}s | Punkte: ${Math.floor(state.score)} | Kills: ${state.kills}</p>
    ${penaltyText}
    ${restartButton}
    <button data-action="open-ship-select">Raumschiff wechseln</button>
    ${mpButtons}
    ${menuButton}
  `;
}

function applyDeathPenalty() {
  const scorePenalty = Math.max(250, 300 + Math.floor(state.level * 40));
  state.score = Math.max(0, state.score - scorePenalty);

  const lostLevels = Math.max(0, Math.min(5, (state.level || 1) - 1));
  let lostUpgrades = 0;
  if (lostLevels > 0) {
    state.level = Math.max(1, state.level - lostLevels);

    let rollbackCost = Math.max(120, Math.floor(state.levelCost || 220));
    let rollbackNextLevelScore = Math.max(220, Math.floor(state.nextLevelScore || 220));
    for (let i = 0; i < lostLevels; i += 1) {
      rollbackNextLevelScore = Math.max(220, rollbackNextLevelScore - rollbackCost);
      rollbackCost = Math.max(120, Math.floor((rollbackCost - 18) / 1.14));
    }

    state.levelCost = rollbackCost;
    state.nextLevelScore = Math.max(state.score + 80, rollbackNextLevelScore);

    if (progression && typeof progression.rollbackRecentLevelUpgrades === "function") {
      lostUpgrades = progression.rollbackRecentLevelUpgrades(lostLevels);
    }
  }

  state.lastLevelScore = Math.min(state.lastLevelScore || 0, state.score);
  state.lastLevelTime = state.time;
  state.lastLevelKills = state.kills;
  state.levelUpPending = false;

  const penaltySummary = {
    scorePenalty,
    lostLevels,
    lostUpgrades,
  };
  state.lastDeathPenalty = penaltySummary;
  return penaltySummary;
}

function showPauseOverlay() {
  setPauseIndicatorVisible(true);
  overlay.classList.remove("hidden");
  const hostCanControlRoom = state.multiplayer.enabled && isMultiplayerHost();
  const mpButtons = hostCanControlRoom
    ? `<button data-action="multiplayer-return-lobby">Zurueck zur Lobby</button>`
    : "";
  const menuButton = hostCanControlRoom
    ? `<button data-action="open-main-menu">Zurueck zum Menue</button>`
    : `<button data-action="open-main-menu">Menue verlassen</button>`;
  overlay.innerHTML = `
    <h1>Pause</h1>
    <p>Spiel pausiert</p>
    <button data-action="resume">Fortsetzen</button>
    <button data-action="open-options" data-back="manual-pause">Optionen</button>
    <button data-action="restart">Neu starten</button>
    <button data-action="open-ship-select">Raumschiff wechseln</button>
    ${mpButtons}
    ${menuButton}
  `;
}

function togglePause() {
  if (state.pauseReason === "menu" || state.pauseReason === "options" || state.pauseReason === "difficulty-select" || state.pauseReason === "ship-select" || state.pauseReason === "levelup" || state.pauseReason === "bossreward" || state.pauseReason === "gameover") {
    return;
  }

  if (state.running) {
    state.running = false;
    state.pauseReason = "manual-pause";
    input.shooting = false;
    showPauseOverlay();
    return;
  }

  if (state.pauseReason === "manual-pause") {
    state.running = true;
    state.pauseReason = "running";
    setPauseIndicatorVisible(false);
    overlay.classList.add("hidden");
  }
}

function nextObjectId() {
  const id = state.objectIdCounter;
  state.objectIdCounter += 1;
  return id;
}

function screenToWorld(screenX, screenY) {
  return {
    x: cameraSystem.getX() + (screenX - WORLD.width * 0.5),
    y: cameraSystem.getY() + (screenY - WORLD.height * 0.5),
  };
}

function projectWorldToScreen(worldX, worldY, cameraX, cameraY) {
  return {
    x: worldX - cameraX + WORLD.width * 0.5,
    y: worldY - cameraY + WORLD.height * 0.5,
  };
}

const movementUtils = createMovementUtils({
  screenToWorld,
  projectWorldToScreen,
});

const {
  ensureEntityWorldPosition,
  syncEntityScreenPosition,
  entityWorldX,
  entityWorldY,
  circlesOverlapWorldEntities,
} = movementUtils;


function createExplosion(x, y, color, amount = 18) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 220;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.5,
      size: 1.3 + Math.random() * 3,
      color,
    });
  }
}

const objectLifecycle = createObjectLifecycleSystem({
  state,
  nextObjectId,
  createExplosion,
  playSfx,
  getKillReward,
  scoring,
});

function destroyObject(obj, reason) {
  objectLifecycle.destroyObject(obj, reason);
}

function damageNearbyFromShieldPulse(radius, allowHeavyTargets) {
  for (const obj of state.objects) {
    if (obj.hp <= 0) continue;
    const d = Math.hypot(entityWorldX(obj) - entityWorldX(state.ship), entityWorldY(obj) - entityWorldY(state.ship));
    if (d > radius + obj.collisionRadius) continue;

    if (obj.destructible || allowHeavyTargets || obj.type === "boulder" || obj.type === "debris") {
      destroyObject(obj, DESTROY_REASONS.ROCKET);
    }
  }

  createExplosion(state.ship.x, state.ship.y, "#84e7ff", 28);
}

const statusEffects = createStatusEffectsSystem({
  state,
  rollCrit,
  computeDamage,
  addDamageText,
  reloadRate,
  createExplosion,
  playSfx,
  damageNearbyFromShieldPulse,
  destroyObject,
  onBossDefeated,
});

const {
  computeBurnTickDamage,
  applyAcidToShip,
  consumeShield,
  applyHeatHit,
} = statusEffects;

function reflectVector(vx, vy, nx, ny) {
  const dot = vx * nx + vy * ny;
  return {
    vx: vx - 2 * dot * nx,
    vy: vy - 2 * dot * ny,
  };
}

function tryRicochetBullet(bullet, normalX, normalY, hitX, hitY) {
  const ricochetLeft = bullet.ricochetLeft || 0;
  if (ricochetLeft <= 0) {
    bullet.life = 0;
    return false;
  }

  let nx = normalX;
  let ny = normalY;
  const nLen = Math.hypot(nx, ny) || 1;
  nx /= nLen;
  ny /= nLen;

  const reflected = reflectVector(bullet.vx, bullet.vy, nx, ny);
  let speed = Math.hypot(reflected.vx, reflected.vy);
  if (speed < 1) speed = 1;

  if (state.weaponSpecials.cannonRicochetRamp) {
    speed *= 1.05;
    bullet.damageBase = Math.min(5.2, (bullet.damageBase || state.weapon.cannonEffectiveness) * 1.16);
  }

  const reflectedLen = Math.hypot(reflected.vx, reflected.vy) || 1;
  bullet.vx = (reflected.vx / reflectedLen) * speed;
  bullet.vy = (reflected.vy / reflectedLen) * speed;
  bullet.ricochetLeft = ricochetLeft - 1;
  bullet.ricochetCount = (bullet.ricochetCount || 0) + 1;

  const pushOut = 2 + bullet.radius;
  bullet.x = hitX + nx * pushOut;
  bullet.y = hitY + ny * pushOut;
  if (Number.isFinite(bullet.worldX) && Number.isFinite(bullet.worldY)) {
    bullet.worldX += nx * pushOut;
    bullet.worldY += ny * pushOut;
  }

  const shouldNova = state.weaponSpecials.cannonRicochetNova
    && bullet.ricochetCount >= 2
    && bullet.ricochetCount % 2 === 0;

  if (shouldNova) {
    const baseAngle = Math.atan2(bullet.vy, bullet.vx);
    const shardSpeed = Math.max(390, Math.hypot(bullet.vx, bullet.vy) * 0.84);
    for (const off of [-0.95, 0.95]) {
      const a = baseAngle + off;
      weapons.spawnCannonBullet({
        x: hitX,
        y: hitY,
        vx: Math.cos(a) * shardSpeed,
        vy: Math.sin(a) * shardSpeed,
        life: 0.24,
        radius: 2.2,
        damageBase: Math.max(0.38, (bullet.damageBase || state.weapon.cannonEffectiveness) * 0.46),
        ricochetLeft: 0,
        ricochetCount: bullet.ricochetCount,
      });
    }
  }

  createExplosion(hitX, hitY, "#ffe188", 4);
  return true;
}

const weapons = createWeaponsSystem({
  state,
  input,
  reloadRate,
  computeDamage,
  addDamageText,
  createExplosion,
  onBossDefeated,
  destroyObject,
  applyHeatHit,
  playSfx,
});

function getRocketCooldownLeft() {
  return weapons.getRocketCooldownLeft();
}

const enemyAI = createEnemyAISteeringSystem({
  state,
  WORLD,
});

const enemyCombat = createEnemyCombatSystem({
  encounters,
});

const shipDamage = createShipDamageSystem({
  state,
  consumeShield,
  createExplosion,
});

const projectileResolver = createProjectileResolverSystem({
  state,
  WORLD,
  worldSystem,
  cameraSystem,
  ensureEntityWorldPosition,
  syncEntityScreenPosition,
  entityWorldX,
  entityWorldY,
  circlesOverlapWorldEntities,
  computeDamage,
  addDamageText,
  destroyObject,
  onBossDefeated,
  weapons,
  tryRicochetBullet,
  hitShip,
  setGameOver,
  applyAcidToShip,
  createExplosion,
  applyHeatHit,
});

const hazardInteractions = createHazardInteractionsSystem({
  state,
  WORLD,
  worldSystem,
  cameraSystem,
  projectWorldToScreen,
  hitShip,
  setGameOver,
  applyAcidToShip,
  createExplosion,
});

const cullingFilters = createCullingFiltersSystem({
  state,
  WORLD,
});

const pickupSimulation = createPickupSimulationSystem({
  state,
  screenToWorld,
  projectWorldToScreen,
  createExplosion,
  playSfx,
});

const bossCombat = createBossCombatSystem({
  state,
  computeBurnTickDamage,
  addDamageText,
  onBossDefeated,
  hitShip,
  setGameOver,
});

const flightControl = createFlightControlSystem({
  input,
});

function getShipAimUnit() {
  const dx = input.mouseX - state.ship.x;
  const dy = input.mouseY - state.ship.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    ux: dx / len,
    uy: dy / len,
  };
}

function tryUseDrillOnObject(obj) {
  if (!state.weapon.drillUnlocked) return false;
  if (state.weapon.drillCharges < 1) return false;
  if (state.time < state.weapon.drillCooldownUntil) return false;
  if (obj.hp <= 0) return false;

  const { ux, uy } = getShipAimUnit();
  const tipX = state.ship.x + ux * (state.ship.radius + state.weapon.drillReach);
  const tipY = state.ship.y + uy * (state.ship.radius + state.weapon.drillReach);
  const tipWorld = {
    x: entityWorldX(state.ship) + ux * (state.ship.radius + state.weapon.drillReach),
    y: entityWorldY(state.ship) + uy * (state.ship.radius + state.weapon.drillReach),
  };
  const d = Math.hypot(entityWorldX(obj) - tipWorld.x, entityWorldY(obj) - tipWorld.y);

  if (d > obj.collisionRadius + state.weapon.drillRadius) return false;

  state.weapon.drillCharges = 0;
  state.weapon.drillCooldownUntil = state.time + state.weapon.drillRechargeDelay / reloadRate();
  destroyObject(obj, DESTROY_REASONS.ROCKET);

  if (state.weaponSpecials.drillPulse) {
    let cleared = 0;
    for (const other of state.objects) {
      if (other === obj || other.hp <= 0 || !other.destructible) continue;
      const d2 = Math.hypot(entityWorldX(other) - entityWorldX(obj), entityWorldY(other) - entityWorldY(obj));
      if (d2 <= 86 + other.collisionRadius) {
        destroyObject(other, DESTROY_REASONS.SHOT);
        cleared += 1;
        if (cleared >= 4) break;
      }
    }
  }

  createExplosion(tipX, tipY, "#8ef7ff", 16);
  playSfx("shieldHit");
  return true;
}

function runMovementPhase(dt, ship) {
  const deathSpectating = isMultiplayerSpectatingAfterDeath();

  if (!deathSpectating) {
    if (!shipDamage.tickAcidDamageToShip(ship, dt)) {
      setGameOver();
      return null;
    }

    flightControl.applyInputThrust(ship, dt);
  } else {
    ship.vx = 0;
    ship.vy = 0;
  }

  if (!Number.isFinite(ship.worldX) || !Number.isFinite(ship.worldY)) {
    const initialWorld = screenToWorld(ship.x, ship.y);
    ship.worldX = initialWorld.x;
    ship.worldY = initialWorld.y;
  }

  ship.worldX += ship.vx * dt;
  ship.worldY += ship.vy * dt;

  state.world.playerX = ship.worldX;
  state.world.playerY = ship.worldY;
  cameraSystem.update(dt, ship.worldX, ship.worldY);
  const cameraX = cameraSystem.getX();
  const cameraY = cameraSystem.getY();
  worldSystem.update(cameraX, cameraY);

  const shipScreen = projectWorldToScreen(ship.worldX, ship.worldY, cameraX, cameraY);
  ship.x = shipScreen.x;
  ship.y = shipScreen.y;
  const aimDx = input.mouseX - ship.x;
  const aimDy = input.mouseY - ship.y;
  if (Number.isFinite(aimDx) && Number.isFinite(aimDy) && (Math.abs(aimDx) > 0.0001 || Math.abs(aimDy) > 0.0001)) {
    ship.aimAngle = Math.atan2(aimDy, aimDx);
  }
  const speed = Math.hypot(ship.vx || 0, ship.vy || 0);
  if (speed > 2.5) {
    ship.angle = Math.atan2(ship.vy || 0, ship.vx || 0.001);
  }

  return {
    cameraX,
    cameraY,
  };
}

function runSpawnPhase(dt, difficulty, cameraX, cameraY) {
  if (state.bossActive) return;

  const shipSpeed = state.ship ? Math.hypot(state.ship.vx || 0, state.ship.vy || 0) : 0;
  const preloadRadius = shipSpeed > 360 ? 2 : 1;
  encounters.spawnChunksAround(cameraX, cameraY, preloadRadius);

  const intensity = spawnIntensity();

  const activeObjects = state.objects.length;
  const enemyCount = state.objects.reduce((count, obj) => count + (obj.enemy ? 1 : 0), 0);
  const targetObjects = difficulty.id === "hard"
    ? GAMEPLAY_TUNING.spawn.targetObjects.hard
    : difficulty.id === "easy"
      ? GAMEPLAY_TUNING.spawn.targetObjects.easy
      : GAMEPLAY_TUNING.spawn.targetObjects.medium;
  const targetEnemies = difficulty.id === "hard"
    ? GAMEPLAY_TUNING.spawn.targetEnemies.hard
    : difficulty.id === "easy"
      ? GAMEPLAY_TUNING.spawn.targetEnemies.easy
      : GAMEPLAY_TUNING.spawn.targetEnemies.medium;
  if (activeObjects >= targetObjects || enemyCount >= targetEnemies) {
    state.lastSpawn = Math.min(state.lastSpawn, GAMEPLAY_TUNING.spawn.minLastSpawnCarry);
    return;
  }

  state.lastSpawn += dt;
  const dynamicSpawn = Math.max(
    GAMEPLAY_TUNING.spawn.minDynamicSpawnInterval,
    state.spawnInterval / (intensity * difficulty.spawnRateMult),
  );
  let spawnedThisFrame = 0;
  const pressureGap = Math.max(0, targetObjects - activeObjects);
  const maxSpawnsPerFrame = Math.max(2, Math.min(5, Math.floor(pressureGap / 10) + 1));
  while (state.lastSpawn >= dynamicSpawn && spawnedThisFrame < maxSpawnsPerFrame) {
    state.lastSpawn -= dynamicSpawn;
    encounters.spawnObject();
    spawnedThisFrame += 1;
  }
  if (state.lastSpawn > dynamicSpawn * maxSpawnsPerFrame) {
    state.lastSpawn = dynamicSpawn * maxSpawnsPerFrame;
  }

}

function serializeWorldEntity(obj) {
  return {
    id: obj.id,
    type: obj.type,
    worldX: Number.isFinite(obj.worldX) ? obj.worldX : 0,
    worldY: Number.isFinite(obj.worldY) ? obj.worldY : 0,
    vx: Number.isFinite(obj.vx) ? obj.vx : 0,
    vy: Number.isFinite(obj.vy) ? obj.vy : 0,
    angle: Number.isFinite(obj.angle) ? obj.angle : 0,
    spin: Number.isFinite(obj.spin) ? obj.spin : 0,
    size: Number.isFinite(obj.size) ? obj.size : 12,
    radius: Number.isFinite(obj.radius) ? obj.radius : (Number.isFinite(obj.size) ? obj.size * 0.5 : 6),
    collisionRadius: Number.isFinite(obj.collisionRadius) ? obj.collisionRadius : (Number.isFinite(obj.radius) ? obj.radius : 6),
    hp: Number.isFinite(obj.hp) ? obj.hp : null,
    maxHp: Number.isFinite(obj.maxHp) ? obj.maxHp : null,
    enemy: Boolean(obj.enemy),
    destructible: Boolean(obj.destructible),
    color: obj.color || null,
    aggroLocked: Boolean(obj.aggroLocked),
    aggroRange: Number.isFinite(obj.aggroRange) ? obj.aggroRange : 0,
    passed: Boolean(obj.passed),
  };
}

function serializeProjectile(proj) {
  return {
    worldX: Number.isFinite(proj.worldX) ? proj.worldX : 0,
    worldY: Number.isFinite(proj.worldY) ? proj.worldY : 0,
    vx: Number.isFinite(proj.vx) ? proj.vx : 0,
    vy: Number.isFinite(proj.vy) ? proj.vy : 0,
    radius: Number.isFinite(proj.radius) ? proj.radius : 3,
    life: Number.isFinite(proj.life) ? proj.life : 0,
    maxLife: Number.isFinite(proj.maxLife) ? proj.maxLife : 1,
    damageType: proj.damageType || null,
    damageAmount: Number.isFinite(proj.damageAmount) ? proj.damageAmount : null,
    damage: Number.isFinite(proj.damage) ? proj.damage : null,
    enemyOwned: Boolean(proj.enemyOwned),
    color: proj.color || null,
  };
}

function serializePickup(pickup) {
  return {
    type: pickup.type,
    worldX: Number.isFinite(pickup.worldX) ? pickup.worldX : 0,
    worldY: Number.isFinite(pickup.worldY) ? pickup.worldY : 0,
    radius: Number.isFinite(pickup.radius) ? pickup.radius : 8,
    ttl: Number.isFinite(pickup.ttl) ? pickup.ttl : 0,
  };
}

function serializeLaserBeam(beam, cameraX, cameraY) {
  if (!beam) return null;
  const wx1 = Number.isFinite(beam.x1) ? (cameraX + (beam.x1 - WORLD.width * 0.5)) : null;
  const wy1 = Number.isFinite(beam.y1) ? (cameraY + (beam.y1 - WORLD.height * 0.5)) : null;
  const wx2 = Number.isFinite(beam.x2) ? (cameraX + (beam.x2 - WORLD.width * 0.5)) : null;
  const wy2 = Number.isFinite(beam.y2) ? (cameraY + (beam.y2 - WORLD.height * 0.5)) : null;
  if (!Number.isFinite(wx1) || !Number.isFinite(wy1) || !Number.isFinite(wx2) || !Number.isFinite(wy2)) return null;
  return {
    worldX1: wx1,
    worldY1: wy1,
    worldX2: wx2,
    worldY2: wy2,
    life: Number.isFinite(beam.life) ? beam.life : 0,
    width: Number.isFinite(beam.width) ? beam.width : 2,
  };
}

function serializeParticle(particle, cameraX, cameraY) {
  if (!particle) return null;
  const worldX = Number.isFinite(particle.x) ? (cameraX + (particle.x - WORLD.width * 0.5)) : null;
  const worldY = Number.isFinite(particle.y) ? (cameraY + (particle.y - WORLD.height * 0.5)) : null;
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
  return {
    worldX,
    worldY,
    vx: Number.isFinite(particle.vx) ? particle.vx : 0,
    vy: Number.isFinite(particle.vy) ? particle.vy : 0,
    life: Number.isFinite(particle.life) ? particle.life : 0,
    size: Number.isFinite(particle.size) ? particle.size : 2,
    color: particle.color || "#ffffff",
  };
}

function serializeDamageText(text, cameraX, cameraY) {
  if (!text) return null;
  const worldX = Number.isFinite(text.x) ? (cameraX + (text.x - WORLD.width * 0.5)) : null;
  const worldY = Number.isFinite(text.y) ? (cameraY + (text.y - WORLD.height * 0.5)) : null;
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
  return {
    worldX,
    worldY,
    vx: Number.isFinite(text.vx) ? text.vx : 0,
    vy: Number.isFinite(text.vy) ? text.vy : -28,
    life: Number.isFinite(text.life) ? text.life : 0,
    maxLife: Number.isFinite(text.maxLife) ? text.maxLife : (Number.isFinite(text.life) ? text.life : 0.5),
    text: text.text || "",
    crit: Boolean(text.crit),
  };
}

function buildSharedWorldPayload(cameraX, cameraY) {
  const objects = state.objects.slice(0, 180).map(serializeWorldEntity);
  const bullets = state.bullets.slice(0, 220).map(serializeProjectile);
  const laserBeams = Number.isFinite(cameraX) && Number.isFinite(cameraY)
    ? state.laserBeams.slice(0, 48).map((b) => serializeLaserBeam(b, cameraX, cameraY)).filter(Boolean)
    : [];
  const particles = Number.isFinite(cameraX) && Number.isFinite(cameraY)
    ? state.particles.slice(0, 180).map((p) => serializeParticle(p, cameraX, cameraY)).filter(Boolean)
    : [];
  const damageTexts = Number.isFinite(cameraX) && Number.isFinite(cameraY)
    ? state.damageTexts.slice(0, 80).map((t) => serializeDamageText(t, cameraX, cameraY)).filter(Boolean)
    : [];
  const missiles = state.missiles.slice(0, 80).map(serializeProjectile);
  const plasmaBursts = state.plasmaBursts.slice(0, 90).map(serializeProjectile);
  const bossProjectiles = state.bossProjectiles.slice(0, 140).map(serializeProjectile);
  const pickups = state.pickups.slice(0, 90).map(serializePickup);

  let boss = null;
  if (state.boss && Number.isFinite(state.boss.worldX) && Number.isFinite(state.boss.worldY)) {
    boss = serializeWorldEntity(state.boss);
    boss.collisionRadius = Number.isFinite(state.boss.collisionRadius) ? state.boss.collisionRadius : boss.collisionRadius;
  }

  return {
    t: state.time,
    score: Math.floor(state.score),
    kills: state.kills,
    objects,
    bullets,
    laserBeams,
    particles,
    damageTexts,
    missiles,
    plasmaBursts,
    bossProjectiles,
    pickups,
    bossActive: Boolean(state.bossActive),
    boss,
  };
}

function applySharedWorldPayload(snapshot, cameraX, cameraY) {
  if (!snapshot || typeof snapshot !== "object") return;

  function toScreenEntity(entity) {
    const worldX = Number.isFinite(entity.worldX) ? entity.worldX : 0;
    const worldY = Number.isFinite(entity.worldY) ? entity.worldY : 0;
    const screen = projectWorldToScreen(worldX, worldY, cameraX, cameraY);
    return {
      ...entity,
      x: screen.x,
      y: screen.y,
    };
  }

  function toScreenBeam(beam) {
    const x1 = Number.isFinite(beam.worldX1) ? beam.worldX1 : 0;
    const y1 = Number.isFinite(beam.worldY1) ? beam.worldY1 : 0;
    const x2 = Number.isFinite(beam.worldX2) ? beam.worldX2 : 0;
    const y2 = Number.isFinite(beam.worldY2) ? beam.worldY2 : 0;
    const s1 = projectWorldToScreen(x1, y1, cameraX, cameraY);
    const s2 = projectWorldToScreen(x2, y2, cameraX, cameraY);
    return {
      x1: s1.x,
      y1: s1.y,
      x2: s2.x,
      y2: s2.y,
      life: Number.isFinite(beam.life) ? beam.life : 0,
      width: Number.isFinite(beam.width) ? beam.width : 2,
    };
  }

  function toScreenParticle(particle) {
    const worldX = Number.isFinite(particle.worldX) ? particle.worldX : 0;
    const worldY = Number.isFinite(particle.worldY) ? particle.worldY : 0;
    const screen = projectWorldToScreen(worldX, worldY, cameraX, cameraY);
    return {
      x: screen.x,
      y: screen.y,
      vx: Number.isFinite(particle.vx) ? particle.vx : 0,
      vy: Number.isFinite(particle.vy) ? particle.vy : 0,
      life: Number.isFinite(particle.life) ? particle.life : 0,
      size: Number.isFinite(particle.size) ? particle.size : 2,
      color: particle.color || "#ffffff",
    };
  }

  function toScreenDamageText(text) {
    const worldX = Number.isFinite(text.worldX) ? text.worldX : 0;
    const worldY = Number.isFinite(text.worldY) ? text.worldY : 0;
    const screen = projectWorldToScreen(worldX, worldY, cameraX, cameraY);
    return {
      x: screen.x,
      y: screen.y,
      vx: Number.isFinite(text.vx) ? text.vx : 0,
      vy: Number.isFinite(text.vy) ? text.vy : -28,
      life: Number.isFinite(text.life) ? text.life : 0,
      maxLife: Number.isFinite(text.maxLife) ? text.maxLife : (Number.isFinite(text.life) ? text.life : 0.5),
      text: text.text || "",
      crit: Boolean(text.crit),
    };
  }

  state.objects = Array.isArray(snapshot.objects) ? snapshot.objects.map(toScreenEntity) : [];
  state.bullets = Array.isArray(snapshot.bullets) ? snapshot.bullets.map(toScreenEntity) : [];
  state.laserBeams = Array.isArray(snapshot.laserBeams) ? snapshot.laserBeams.map(toScreenBeam) : [];
  state.particles = Array.isArray(snapshot.particles) ? snapshot.particles.map(toScreenParticle) : [];
  state.damageTexts = Array.isArray(snapshot.damageTexts) ? snapshot.damageTexts.map(toScreenDamageText) : [];
  state.missiles = Array.isArray(snapshot.missiles) ? snapshot.missiles.map(toScreenEntity) : [];
  state.plasmaBursts = Array.isArray(snapshot.plasmaBursts) ? snapshot.plasmaBursts.map(toScreenEntity) : [];
  state.bossProjectiles = Array.isArray(snapshot.bossProjectiles) ? snapshot.bossProjectiles.map(toScreenEntity) : [];
  state.pickups = Array.isArray(snapshot.pickups) ? snapshot.pickups.map(toScreenEntity) : [];

  state.bossActive = Boolean(snapshot.bossActive && snapshot.boss);
  state.boss = snapshot.boss ? toScreenEntity(snapshot.boss) : null;

  if (Number.isFinite(snapshot.t)) state.time = snapshot.t;
  if (Number.isFinite(snapshot.score)) state.score = snapshot.score;
  if (Number.isFinite(snapshot.kills)) state.kills = snapshot.kills;

  // Mirror mode keeps host-generated temporary effects so both players see identical combat moments.
}

function advanceMirroredWorld(dt, cameraX, cameraY) {
  function advanceEntity(entity) {
    if (!entity) return;
    if (Number.isFinite(entity.vx)) entity.worldX = (Number.isFinite(entity.worldX) ? entity.worldX : 0) + entity.vx * dt;
    if (Number.isFinite(entity.vy)) entity.worldY = (Number.isFinite(entity.worldY) ? entity.worldY : 0) + entity.vy * dt;
    if (Number.isFinite(entity.spin)) entity.angle = (Number.isFinite(entity.angle) ? entity.angle : 0) + entity.spin * dt;
    const screen = projectWorldToScreen(
      Number.isFinite(entity.worldX) ? entity.worldX : 0,
      Number.isFinite(entity.worldY) ? entity.worldY : 0,
      cameraX,
      cameraY,
    );
    entity.x = screen.x;
    entity.y = screen.y;
  }

  for (const obj of state.objects) advanceEntity(obj);
  for (const bullet of state.bullets) {
    advanceEntity(bullet);
    if (Number.isFinite(bullet.life)) bullet.life -= dt;
  }
  for (const p of state.particles) {
    if (!p) continue;
    p.x += (Number.isFinite(p.vx) ? p.vx : 0) * dt;
    p.y += (Number.isFinite(p.vy) ? p.vy : 0) * dt;
    p.vx = (Number.isFinite(p.vx) ? p.vx : 0) * 0.97;
    p.vy = (Number.isFinite(p.vy) ? p.vy : 0) * 0.97;
    if (Number.isFinite(p.life)) p.life -= dt;
  }
  for (const text of state.damageTexts) {
    if (!text) continue;
    text.x += (Number.isFinite(text.vx) ? text.vx : 0) * dt;
    text.y += (Number.isFinite(text.vy) ? text.vy : -28) * dt;
    text.vy = (Number.isFinite(text.vy) ? text.vy : -28) * 0.94;
    if (Number.isFinite(text.life)) text.life -= dt;
  }
  for (const beam of state.laserBeams) {
    if (Number.isFinite(beam.life)) beam.life -= dt;
  }
  for (const missile of state.missiles) {
    advanceEntity(missile);
    if (Number.isFinite(missile.life)) missile.life -= dt;
  }
  for (const burst of state.plasmaBursts) {
    advanceEntity(burst);
    if (Number.isFinite(burst.life)) burst.life -= dt;
  }
  for (const proj of state.bossProjectiles) {
    advanceEntity(proj);
    if (Number.isFinite(proj.life)) proj.life -= dt;
  }
  for (const pickup of state.pickups) {
    advanceEntity(pickup);
    if (Number.isFinite(pickup.ttl)) pickup.ttl -= dt;
  }

  if (state.boss) {
    advanceEntity(state.boss);
  }
}

function queueMirrorClientActions(nowSec) {
  if (!state.multiplayer.enabled || !multiplayerSystem) return;
  if (typeof multiplayerSystem.isHost === "function" && multiplayerSystem.isHost()) return;
  if (typeof multiplayerSystem.sendPlayerAction !== "function") return;

  const aimWorld = screenToWorld(input.mouseX, input.mouseY);
  const desktopAutoShooting = state.desktopAutoFire && !IS_COARSE_POINTER && state.mouseInCanvas;
  const wantsFire = Boolean(input.shooting || desktopAutoShooting);

  if (wantsFire && (nowSec - (state.multiplayer.lastMirrorFireActionAt || 0)) >= 0.06) {
    const sent = multiplayerSystem.sendPlayerAction({
      kind: "cannon",
      aimWorldX: aimWorld.x,
      aimWorldY: aimWorld.y,
    });
    if (sent) {
      state.multiplayer.lastMirrorFireActionAt = nowSec;
    }
  }

  if (input.rocketQueued) {
    if (state.weapon.rocketUnlocked && getRocketCooldownLeft() <= 0.01) {
      state.weapon.lastRocketShot = nowSec;
      state.weapon.lastRocketRealShot = state.realNow;
      multiplayerSystem.sendPlayerAction({
        kind: "rocket",
        aimWorldX: aimWorld.x,
        aimWorldY: aimWorld.y,
      });
    }
    input.rocketQueued = false;
  }
}

function processRemotePlayerActions(nowSec, cameraX, cameraY) {
  if (!state.multiplayer.enabled || !multiplayerSystem) return;
  if (typeof multiplayerSystem.isHost !== "function" || !multiplayerSystem.isHost()) return;
  if (typeof multiplayerSystem.consumePlayerActions !== "function") return;

  const actions = multiplayerSystem.consumePlayerActions();
  if (!Array.isArray(actions) || actions.length <= 0) return;

  const remotes = typeof multiplayerSystem.getRemotePlayers === "function"
    ? multiplayerSystem.getRemotePlayers()
    : [];
  const remoteById = new Map();
  for (const remote of remotes) {
    if (!remote || !remote.id) continue;
    remoteById.set(remote.id, remote);
  }

  for (const packet of actions) {
    if (!packet || !packet.senderId || !packet.action) continue;
    const remote = remoteById.get(packet.senderId);
    if (!remote) continue;

    const shipWorldX = Number.isFinite(remote.x) ? remote.x : 0;
    const shipWorldY = Number.isFinite(remote.y) ? remote.y : 0;
    const aimWorldX = Number.isFinite(packet.action.aimWorldX) ? packet.action.aimWorldX : shipWorldX;
    const aimWorldY = Number.isFinite(packet.action.aimWorldY) ? packet.action.aimWorldY : shipWorldY;
    const dx = aimWorldX - shipWorldX;
    const dy = aimWorldY - shipWorldY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const perpX = -uy;
    const perpY = ux;
    const shipScreen = projectWorldToScreen(shipWorldX, shipWorldY, cameraX, cameraY);

    if (packet.action.kind === "cannon") {
      const lastAt = Number(state.multiplayer.remoteCannonLastById[packet.senderId] || -999);
      if ((nowSec - lastAt) < effectiveCannonCooldown()) {
        continue;
      }
      state.multiplayer.remoteCannonLastById[packet.senderId] = nowSec;

      const channels = 1 + state.weapon.extraLasers + state.weaponSpecials.cannonExtraChannel;
      for (let i = 0; i < channels; i += 1) {
        const indexOffset = i - (channels - 1) / 2;
        const offset = indexOffset * state.weapon.laserSpread;
        const sx = shipScreen.x + perpX * offset;
        const sy = shipScreen.y + perpY * offset;
        const swx = shipWorldX + perpX * offset;
        const swy = shipWorldY + perpY * offset;

        weapons.spawnCannonBullet({
          x: sx,
          y: sy,
          worldX: swx,
          worldY: swy,
          vx: ux * 820,
          vy: uy * 820,
          life: 1.25,
          radius: 3.5,
        });
      }
      continue;
    }

    if (packet.action.kind === "rocket" && state.weapon.rocketUnlocked) {
      const lastAt = Number(state.multiplayer.remoteRocketLastById[packet.senderId] || -999);
      if ((nowSec - lastAt) < effectiveRocketCooldown()) {
        continue;
      }
      state.multiplayer.remoteRocketLastById[packet.senderId] = nowSec;

      const baseAngle = Math.atan2(uy, ux);
      const offsets = state.weapon.rocketSplit ? [-0.18, 0, 0.18] : [0];
      state.weaponCounters.rocketShots += 1;
      const omega = state.weaponSpecials.rocketOmega && state.weaponCounters.rocketShots % 3 === 0;

      for (const off of offsets) {
        const a = baseAngle + off;
        state.missiles.push({
          x: shipScreen.x,
          y: shipScreen.y,
          worldX: shipWorldX,
          worldY: shipWorldY,
          vx: Math.cos(a) * 380,
          vy: Math.sin(a) * 380,
          speed: 380,
          life: 4,
          radius: 6,
          turnRate: 2.6,
          damageBase: omega ? state.weapon.rocketDamage * 1.55 : state.weapon.rocketDamage,
          blastScale: omega ? 1.35 : 1,
          targetRef: null,
          acquireIn: 0,
        });
      }
    }
  }
}

function getEnemyCombatTargetForObject(obj, cameraX, cameraY, localShip) {
  let bestTarget = localShip;
  let bestDist = Math.hypot((obj.worldX || 0) - (localShip.worldX || 0), (obj.worldY || 0) - (localShip.worldY || 0));

  if (
    state.multiplayer.enabled
    && multiplayerSystem
    && typeof multiplayerSystem.isHost === "function"
    && multiplayerSystem.isHost()
    && typeof multiplayerSystem.getRemotePlayers === "function"
  ) {
    const remotes = multiplayerSystem.getRemotePlayers();
    for (const remote of remotes) {
      if (!remote) continue;
      const rx = Number.isFinite(remote.x) ? remote.x : 0;
      const ry = Number.isFinite(remote.y) ? remote.y : 0;
      const d = Math.hypot((obj.worldX || 0) - rx, (obj.worldY || 0) - ry);
      if (d >= bestDist) continue;
      const screen = projectWorldToScreen(rx, ry, cameraX, cameraY);
      bestDist = d;
      bestTarget = {
        x: screen.x,
        y: screen.y,
        worldX: rx,
        worldY: ry,
        radius: Number.isFinite(remote.radius) ? remote.radius : localShip.radius,
      };
    }
  }

  return bestTarget;
}

function resolveMirrorShipInteractions(ship) {
  for (const obj of state.objects) {
    if (!obj || !Number.isFinite(obj.collisionRadius)) continue;
    const dx = (obj.worldX || 0) - (ship.worldX || 0);
    const dy = (obj.worldY || 0) - (ship.worldY || 0);
    const d = Math.hypot(dx, dy);
    const hitR = obj.collisionRadius + ship.radius - 2;
    if (d >= hitR) continue;

    const objDamage = obj.type === "mothership"
      ? 3
      : (obj.type === "boulder" || obj.type === "mediumRock" || obj.type === "ironAsteroid" ? 2 : 1);
    if (!hitShip("physical", objDamage)) {
      setGameOver();
      return false;
    }

    const nx = d > 0 ? ((ship.worldX || 0) - (obj.worldX || 0)) / d : 1;
    const ny = d > 0 ? ((ship.worldY || 0) - (obj.worldY || 0)) / d : 0;
    const push = Math.max(0, hitR - d) + 0.5;
    ship.worldX += nx * push;
    ship.worldY += ny * push;
  }

  for (const proj of state.bossProjectiles) {
    if (!proj || proj.life <= 0) continue;
    const d = Math.hypot((proj.worldX || 0) - (ship.worldX || 0), (proj.worldY || 0) - (ship.worldY || 0));
    if (d >= (proj.radius || 4) + ship.radius) continue;
    proj.life = 0;
    const damageType = proj.damageType || "physical";
    const damageAmount = Number.isFinite(proj.damageAmount) ? proj.damageAmount : 1;
    if (!hitShip(damageType, damageAmount)) {
      setGameOver();
      return false;
    }
    if (damageType === "acid") {
      applyAcidToShip(4, 0.9);
      createExplosion(ship.x, ship.y, "#7eff6f", 9);
    }
  }

  for (const burst of state.plasmaBursts) {
    if (!burst || burst.life <= 0 || !burst.enemyOwned) continue;
    const d = Math.hypot((burst.worldX || 0) - (ship.worldX || 0), (burst.worldY || 0) - (ship.worldY || 0));
    if (d >= (burst.radius || 4) + ship.radius) continue;
    burst.life = 0;
    const damageType = burst.damageType || "heat";
    const damageAmount = Number.isFinite(burst.damage) ? burst.damage : 1;
    if (!hitShip(damageType, damageAmount)) {
      setGameOver();
      return false;
    }
    if (damageType === "acid") {
      applyAcidToShip(3.6, 0.85);
      createExplosion(ship.x, ship.y, "#79ff6f", 8);
    }
  }

  return true;
}

function applyIonStormToProjectiles(dt) {
  if (dt <= 0) return;
  const zones = typeof worldSystem.getIonStormZones === "function" ? worldSystem.getIonStormZones() : [];
  if (!zones || zones.length === 0) return;

  const projectileGroups = [state.bullets, state.missiles, state.plasmaBursts, state.bossProjectiles];
  for (const group of projectileGroups) {
    if (!group || group.length === 0) continue;
    for (const proj of group) {
      if (!proj) continue;
      const wx = Number.isFinite(proj.worldX) ? proj.worldX : null;
      const wy = Number.isFinite(proj.worldY) ? proj.worldY : null;
      if (!Number.isFinite(wx) || !Number.isFinite(wy) || !Number.isFinite(proj.vx) || !Number.isFinite(proj.vy)) continue;

      for (const zone of zones) {
        const hitRadius = zone.hazardRadius || 150;
        const dx = wx - zone.x;
        const dy = wy - zone.y;
        const d = Math.hypot(dx, dy);
        if (d > hitRadius || d <= 0.0001) continue;

        const t = Math.max(0, 1 - d / hitRadius);
        const nx = -dy / d;
        const ny = dx / d;
        const drift = (zone.projectileDrift || 32) * (0.2 + t * 0.85) * dt;
        proj.vx += nx * drift;
        proj.vy += ny * drift;

        const damp = Math.max(0.9, 1 - 0.08 * t * dt * 60);
        proj.vx *= damp;
        proj.vy *= damp;
        break;
      }
    }
  }
}

function update(dt, now) {
  if (!state.running) return;

  const difficulty = selectedDifficultyMode();
  const perfStart = performance.now();
  const hostSpectating = isMultiplayerSpectatingAfterDeath();
  const mirrorSharedWorld = state.multiplayer.enabled
    && multiplayerSystem
    && typeof multiplayerSystem.shouldMirrorWorld === "function"
    && multiplayerSystem.shouldMirrorWorld();

  state.time += dt;
  if (!hostSpectating && !mirrorSharedWorld) {
    scoring.addPassiveScore(dt);
  }

  if (!hostSpectating && !mirrorSharedWorld && state.score >= state.nextLevelScore && !state.levelUpPending && !state.bossActive) {
    progression.showLevelUpChoice();
    return;
  }

  const ship = state.ship;
  const beforeMoveWorldX = Number.isFinite(ship.worldX) ? ship.worldX : 0;
  const beforeMoveWorldY = Number.isFinite(ship.worldY) ? ship.worldY : 0;
  
  // === MOVEMENT PHASE ===
  const perfMovementStart = performance.now();
  const movement = runMovementPhase(dt, ship);
  if (!movement) return;
  const { cameraX, cameraY } = movement;

  if (!hostSpectating) {
    if (!hazardInteractions.handleShipStructureCollisions(ship, cameraX, cameraY)) {
      return;
    }

    if (!hazardInteractions.handleShipSolarHeat(ship, dt)) {
      return;
    }

    if (!hazardInteractions.handleShipToxicNebula(ship, dt)) {
      return;
    }

    if (!hazardInteractions.handleShipIonStorm(ship, dt)) {
      return;
    }

    if (!hazardInteractions.handleShipBlackHoles(ship, dt, {
      playerInfluence: !GAMEPLAY_TUNING.blackHole || GAMEPLAY_TUNING.blackHole.playerInfluenceEnabled !== false,
    })) {
      return;
    }

    if (!hazardInteractions.handleShipWormholes(ship, cameraX, cameraY)) {
      return;
    }
  }

  if (multiplayerSystem) {
    multiplayerSystem.update(dt, now, ship);
  }

  if (mirrorSharedWorld) {
    queueMirrorClientActions(now);

    const shared = typeof multiplayerSystem.getWorldState === "function"
      ? multiplayerSystem.getWorldState()
      : null;
    if (shared) {
      const snapshotT = Number.isFinite(shared.t) ? shared.t : -1;
      if (snapshotT !== state.multiplayer.lastAppliedWorldT) {
        applySharedWorldPayload(shared, cameraX, cameraY);
        state.multiplayer.lastAppliedWorldT = snapshotT;
      } else {
        advanceMirroredWorld(dt, cameraX, cameraY);
      }
    } else {
      state.objects = [];
      state.bullets = [];
      state.missiles = [];
      state.plasmaBursts = [];
      state.bossProjectiles = [];
      state.pickups = [];
      state.boss = null;
      state.bossActive = false;
      state.multiplayer.lastAppliedWorldT = -1;
    }

    if (!resolveMirrorShipInteractions(ship)) {
      return;
    }

    refreshHud();
    return;
  }

  const movedDistance = Math.hypot(ship.worldX - beforeMoveWorldX, ship.worldY - beforeMoveWorldY);
  updateRunStats(movedDistance, Math.hypot(ship.vx || 0, ship.vy || 0));
  if (!areMissionUpdatesBlockedByOverlay()) {
    updateMissions(dt, movedDistance);
    updateRunChallenge(dt, movedDistance);
  }

  const desktopAutoShooting = state.desktopAutoFire && !IS_COARSE_POINTER && state.mouseInCanvas;
  if (!hostSpectating && (input.shooting || desktopAutoShooting)) weapons.shootAtCursor(now);

  if (!hostSpectating && input.rocketQueued) {
    weapons.fireRocket(now);
    input.rocketQueued = false;
  }

  processRemotePlayerActions(now, cameraX, cameraY);

  if (state.shield.unlocked && state.shield.charges < state.shield.maxCharges && state.time >= state.shield.cooldownUntil) {
    state.shield.charges = state.shield.maxCharges;
    state.shield.integrity = state.shield.charges;
    playSfx("shieldReady");
  }

  if (state.weapon.drillUnlocked && state.weapon.drillCharges < state.weapon.drillMaxCharges && state.time >= state.weapon.drillCooldownUntil) {
    state.weapon.drillCharges = state.weapon.drillMaxCharges;
    playSfx("shieldReady");
  }

  if (state.shield.unlocked && state.shield.nova && state.time >= state.shield.nextNova) {
    state.shield.nextNova = state.time + GAMEPLAY_TUNING.shield.novaInterval;
    damageNearbyFromShieldPulse(220, true);
    createExplosion(ship.x, ship.y, "#71f4ff", 42);
    playSfx("shieldHit");
  }
  const perfMovementEnd = performance.now();
  state.perfCounters.movement = perfMovementEnd - perfMovementStart;

  // === COMBAT PHASE ===
  const perfCombatStart = performance.now();
  runSpawnPhase(dt, difficulty, cameraX, cameraY);
  if (typeof encounters.updateEliteEncounters === "function") {
    encounters.updateEliteEncounters(dt);
  }

  encounters.updateBoss(dt);

  for (const obj of state.objects) {
    if (!Number.isFinite(obj.worldX) || !Number.isFinite(obj.worldY)) {
      const worldPos = screenToWorld(obj.x, obj.y);
      obj.worldX = worldPos.x;
      obj.worldY = worldPos.y;
    }

    const enemyTarget = getEnemyCombatTargetForObject(obj, cameraX, cameraY, ship);
    enemyAI.updateEnemySteering(obj, enemyTarget, dt);

    obj.worldX += obj.vx * dt;
    obj.worldY += obj.vy * dt;

    const objScreen = projectWorldToScreen(obj.worldX, obj.worldY, cameraX, cameraY);
    obj.x = objScreen.x;
    obj.y = objScreen.y;
    obj.angle += obj.spin * dt;

    if (obj.burnUntil && obj.burnUntil > state.time && obj.hp > 0) {
      const burnStacks = Math.max(1, obj.burnStacks || 1);
      obj.burnTickCarry = (obj.burnTickCarry || 0) + (obj.burnDps || 0) * burnStacks * dt;
      while (obj.burnTickCarry >= 1 && obj.hp > 0) {
        obj.burnTickCarry -= 1;
        const burnDmg = computeBurnTickDamage();
        obj.hp -= burnDmg;
        addDamageText(obj.x, obj.y - obj.size * 0.35, burnDmg, burnDmg > 1);
        if (obj.hp <= 0) {
          destroyObject(obj, DESTROY_REASONS.SHOT);
        }
      }
    }

    if (!obj.passed) {
      const dxPass = (obj.worldX || obj.x) - (ship.worldX || ship.x);
      const dyPass = (obj.worldY || obj.y) - (ship.worldY || ship.y);
      const distPass = Math.hypot(dxPass, dyPass);
      if (distPass > Math.max(WORLD.width, WORLD.height) * 1.05) {
        obj.passed = true;
        scoring.addPoints(obj.destructible ? 1 : 2);
      }
    }

    if (obj.type === "miniAlien" && obj.aggroLocked && obj.nextShotAt !== null && state.time >= obj.nextShotAt) {
      const dxShip = (enemyTarget.worldX || 0) - (obj.worldX || 0);
      const dyShip = (enemyTarget.worldY || 0) - (obj.worldY || 0);
      const distShip = Math.hypot(dxShip, dyShip);
      if (distShip > Math.max(WORLD.width, WORLD.height) * GAMEPLAY_TUNING.enemyCombat.miniFireMaxDistViewportMult) {
        obj.nextShotAt = state.time
          + GAMEPLAY_TUNING.enemyCombat.miniOutOfRangeDelayMin
          + Math.random() * GAMEPLAY_TUNING.enemyCombat.miniOutOfRangeDelayRand;
      } else {
      enemyCombat.fireEnemyWeapon(obj, enemyTarget);
      obj.nextShotAt = enemyCombat.nextEnemyShotAt(obj, state.time);
      }
    }

    if ((obj.type === "alienShip" || obj.type === "mothership") && obj.aggroLocked && obj.nextShotAt !== null && state.time >= obj.nextShotAt) {
      const dxShip = (enemyTarget.worldX || 0) - (obj.worldX || 0);
      const dyShip = (enemyTarget.worldY || 0) - (obj.worldY || 0);
      const distShip = Math.hypot(dxShip, dyShip);
      const fireDistMult = obj.type === "mothership"
        ? GAMEPLAY_TUNING.enemyCombat.shipFireMaxDistViewportMult * 1.35
        : GAMEPLAY_TUNING.enemyCombat.shipFireMaxDistViewportMult;
      if (distShip > Math.max(WORLD.width, WORLD.height) * fireDistMult) {
        obj.nextShotAt = state.time
          + GAMEPLAY_TUNING.enemyCombat.shipOutOfRangeDelayMin
          + Math.random() * GAMEPLAY_TUNING.enemyCombat.shipOutOfRangeDelayRand;
      } else {
      enemyCombat.fireEnemyWeapon(obj, enemyTarget);
      obj.nextShotAt = enemyCombat.nextEnemyShotAt(obj, state.time);
      }
    }

    if (!hostSpectating) {
      const dxShip = (obj.worldX || obj.x) - (ship.worldX || ship.x);
      const dyShip = (obj.worldY || obj.y) - (ship.worldY || ship.y);
      const d = Math.hypot(dxShip, dyShip);
      if (d < obj.collisionRadius + ship.radius - 2) {
        if (tryUseDrillOnObject(obj)) {
          continue;
        }
        const objDamage = obj.type === "mothership"
          ? 3
          : (obj.type === "boulder" || obj.type === "mediumRock" || obj.type === "ironAsteroid" ? 2 : 1);
        if (!hitShip("physical", objDamage)) {
          setGameOver();
          return;
        }
        if (obj.destructible) {
          destroyObject(obj, DESTROY_REASONS.COLLISION);
        }
      }
    }
  }

  if (!bossCombat.updateBossCombat(dt, ship)) {
    return;
  }

  projectileResolver.resolveBulletsMovement(dt, cameraX, cameraY);
  applyIonStormToProjectiles(dt);
  applyBlackHoleEntityEffects(dt);
  projectileResolver.resolveBulletTargets();
  projectileResolver.resolveMissiles(dt, cameraX, cameraY);
  if (!projectileResolver.resolveBossProjectiles(dt, cameraX, cameraY, ship)) {
    return;
  }
  const perfCombatEnd = performance.now();
  state.perfCounters.combat = perfCombatEnd - perfCombatStart;

  // === CLEANUP PHASE ===
  const perfCleanupStart = performance.now();
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt;
  }

  if (state.damageTexts.length > 0) {
    for (const text of state.damageTexts) {
      text.x += (text.vx || 0) * dt;
      text.y += (text.vy || -28) * dt;
      text.vy *= 0.94;
      text.life -= dt;
    }
  }

  pickupSimulation.updatePickups(dt, cameraX, cameraY, ship);

  for (const beam of state.laserBeams) {
    beam.life -= dt;
  }

  if (!projectileResolver.resolvePlasmaBursts(dt, cameraX, cameraY, ship)) {
    return;
  }

  cullingFilters.applyEntityCulling(cameraX, cameraY);

  if (state.multiplayer.enabled && multiplayerSystem && typeof multiplayerSystem.isHost === "function" && multiplayerSystem.isHost() && typeof multiplayerSystem.sendWorldState === "function") {
    multiplayerSystem.sendWorldState(buildSharedWorldPayload(cameraX, cameraY), now);
  }

  refreshHud();
  const perfCleanupEnd = performance.now();
  state.perfCounters.cleanup = perfCleanupEnd - perfCleanupStart;

  state.perfCounters.frameTotal = perfCleanupEnd - perfStart;
}

function drawRemotePlayers() {
  if (!multiplayerSystem || !cameraSystem) return;
  const remotes = multiplayerSystem.getRemotePlayers();
  if (!Array.isArray(remotes) || remotes.length === 0) return;

  for (const remote of remotes) {
    const pos = cameraSystem.worldToScreen(remote.x, remote.y, 1, WORLD.width, WORLD.height);
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue;
    if (pos.x < -80 || pos.x > WORLD.width + 80 || pos.y < -80 || pos.y > WORLD.height + 80) continue;

    const angle = Number.isFinite(remote.angle) ? remote.angle : 0;
    const aimAngle = Number.isFinite(remote.aimAngle) ? remote.aimAngle : angle;
    const r = 14;
    const noseX = pos.x + Math.cos(angle) * r;
    const noseY = pos.y + Math.sin(angle) * r;
    const leftX = pos.x + Math.cos(angle + 2.45) * (r * 0.78);
    const leftY = pos.y + Math.sin(angle + 2.45) * (r * 0.78);
    const rightX = pos.x + Math.cos(angle - 2.45) * (r * 0.78);
    const rightY = pos.y + Math.sin(angle - 2.45) * (r * 0.78);

    ctx.beginPath();
    ctx.moveTo(noseX, noseY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fillStyle = "rgba(140, 235, 255, 0.82)";
    ctx.fill();
    ctx.strokeStyle = "rgba(230, 250, 255, 0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 208, 123, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + Math.cos(aimAngle) * (r + 10), pos.y + Math.sin(aimAngle) * (r + 10));
    ctx.stroke();

    if (remote.name) {
      ctx.fillStyle = "rgba(235, 248, 255, 0.95)";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(remote.name, pos.x, pos.y - 18);
    }
  }
}

const renderer = createRenderer({
  ctx,
  state,
  input,
  WORLD,
  worldSystem,
  cameraSystem,
  encountersSystem: encounters,
  IS_COARSE_POINTER,
  selectedShipModel,
  getRocketCooldownLeft,
  getSprite,
});

let lastTime = performance.now() / 1000;
function gameLoop(nowMs) {
  const now = nowMs / 1000;
  state.realNow = now;
  const dt = Math.min(0.033, now - lastTime);
  lastTime = now;

  // Fail-safe: recover from broken startup/menu states where no playable session exists.
  const overlayHidden = overlay.classList.contains("hidden");
  const inSelectionState = state.pauseReason === "difficulty-select" || state.pauseReason === "ship-select";
  const recoverableNoShip = !state.ship && overlayHidden && (state.pauseReason === "running" || inSelectionState);
  const recoverableStopped = !state.running && overlayHidden && (state.pauseReason === "running" || inSelectionState) && state.pauseReason !== "menu" && state.pauseReason !== "options";

  if (recoverableNoShip || recoverableStopped) {
    resetGame();
  }

  if (state.ship) {
    if (!Number.isFinite(state.ship.worldX) || !Number.isFinite(state.ship.worldY)) {
      state.ship.worldX = state.world.playerX || 0;
      state.ship.worldY = state.world.playerY || 0;
    }
    if (!Number.isFinite(state.ship.x) || !Number.isFinite(state.ship.y)) {
      state.ship.x = WORLD.width * 0.5;
      state.ship.y = WORLD.height * 0.5;
    }
  }

  update(dt, now);
  renderer.draw();
  drawRemotePlayers();

  requestAnimationFrame(gameLoop);
}
function handleOverlayAction(actionNode) {
  if (actionNode.dataset.action === "open-diff-select") {
    if (multiplayerSystem && typeof multiplayerSystem.configure === "function") {
      multiplayerSystem.configure({ enabled: false });
    }
    menus.showDifficultySelectionMenu();
    return;
  }

  if (actionNode.dataset.action === "open-multiplayer-menu") {
    const wsHost = (window.location.hostname && window.location.hostname.trim()) || "localhost";
    const defaults = multiplayerSystem && typeof multiplayerSystem.getStatus === "function"
      ? multiplayerSystem.getStatus()
      : {
        roomId: state.multiplayer.roomId || "alpha",
        localName: state.multiplayer.localName || "Pilot",
        wsUrl: state.multiplayer.wsUrl || `${window.location.protocol === "https:" ? "wss" : "ws"}://${wsHost}:8080`,
      };
    menus.showMultiplayerMenu(defaults);
    return;
  }

  if (actionNode.dataset.action === "multiplayer-join") {
    const nameEl = overlay.querySelector("#mpPilotName");
    const roomEl = overlay.querySelector("#mpRoomName");
    const wsEl = overlay.querySelector("#mpServerUrl");

    const localName = nameEl ? nameEl.value : "Pilot";
    const roomId = roomEl ? roomEl.value : "alpha";
    const wsHost = (window.location.hostname && window.location.hostname.trim()) || "localhost";
    const wsUrl = wsEl ? wsEl.value : `${window.location.protocol === "https:" ? "wss" : "ws"}://${wsHost}:8080`;

    if (multiplayerSystem && typeof multiplayerSystem.configure === "function") {
      multiplayerSystem.configure({
        enabled: true,
        localName,
        roomId,
        wsUrl,
      });
      if (typeof multiplayerSystem.setReady === "function") {
        multiplayerSystem.setReady(false);
      }
      if (typeof menus.showMultiplayerLobby === "function") {
        menus.showMultiplayerLobby(multiplayerSystem.getStatus(), multiplayerSystem.getLobbyState());
      }
    } else {
      menus.showMainLandingMenu();
    }

    return;
  }

  if (actionNode.dataset.action === "multiplayer-ready-toggle") {
    if (multiplayerSystem && typeof multiplayerSystem.setReady === "function") {
      const lobby = typeof multiplayerSystem.getLobbyState === "function" ? multiplayerSystem.getLobbyState() : null;
      multiplayerSystem.setReady(!(lobby && lobby.localReady));
      if (typeof menus.showMultiplayerLobby === "function") {
        menus.showMultiplayerLobby(multiplayerSystem.getStatus(), multiplayerSystem.getLobbyState());
      }
    }
    return;
  }

  if (actionNode.dataset.action === "multiplayer-start") {
    if (multiplayerSystem && typeof multiplayerSystem.requestRoomStart === "function") {
      multiplayerSystem.requestRoomStart();
    }
    return;
  }

  if (actionNode.dataset.action === "multiplayer-back-to-lobby") {
    if (multiplayerSystem && typeof menus.showMultiplayerLobby === "function") {
      menus.showMultiplayerLobby(multiplayerSystem.getStatus(), multiplayerSystem.getLobbyState());
    } else {
      menus.showMainLandingMenu();
    }
    return;
  }

  if (actionNode.dataset.action === "multiplayer-return-lobby") {
    const canControlRoom = isMultiplayerHost();
    if (canControlRoom && multiplayerSystem && typeof multiplayerSystem.requestReturnLobby === "function") {
      multiplayerSystem.requestReturnLobby();
      return;
    }
    if (!state.multiplayer.enabled) {
      menus.showMainLandingMenu();
      return;
    }
    if (multiplayerSystem && typeof menus.showMultiplayerLobby === "function") {
      menus.showMultiplayerLobby(multiplayerSystem.getStatus(), multiplayerSystem.getLobbyState());
    } else {
      menus.showMainLandingMenu();
    }
    return;
  }

  if (actionNode.dataset.action === "multiplayer-open-config") {
    const wsHost = (window.location.hostname && window.location.hostname.trim()) || "localhost";
    const defaults = multiplayerSystem && typeof multiplayerSystem.getStatus === "function"
      ? multiplayerSystem.getStatus()
      : {
        roomId: state.multiplayer.roomId || "alpha",
        localName: state.multiplayer.localName || "Pilot",
        wsUrl: state.multiplayer.wsUrl || `${window.location.protocol === "https:" ? "wss" : "ws"}://${wsHost}:8080`,
      };
    menus.showMultiplayerMenu(defaults);
    return;
  }

  if (actionNode.dataset.action === "multiplayer-leave") {
    if (multiplayerSystem && typeof multiplayerSystem.configure === "function") {
      multiplayerSystem.configure({ enabled: false });
    }
    menus.showMainLandingMenu();
    return;
  }

  if (actionNode.dataset.action === "open-options") {
    const backAction = actionNode.dataset.back || "main-menu";
    menus.showOptionsMenu(backAction);
    return;
  }

  if (actionNode.dataset.action === "set-statusbars-mode") {
    const mode = Number(actionNode.dataset.mode);
    if (Number.isFinite(mode)) state.statusBarsMode = mode;
    // Persist current slider state so values survive the re-render
    const musicSlider = overlay.querySelector("#musicVolumeSlider");
    const sfxSlider = overlay.querySelector("#sfxVolumeSlider");
    const toastToggle = overlay.querySelector("#missionToastToggle");
    const dailyChallengeToggle = overlay.querySelector("#dailyChallengeToggle");
    const failTimeToggle = overlay.querySelector("#missionFailTimeToggle");
    const failHitToggle = overlay.querySelector("#missionFailHitToggle");
    const failNoHitToggle = overlay.querySelector("#missionFailNoHitToggle");
    if (musicSlider) state.options.musicVolume = Math.max(0, Math.min(1, Number(musicSlider.value) / 100));
    if (sfxSlider) state.options.sfxVolume = Math.max(0, Math.min(1, Number(sfxSlider.value) / 100));
    if (toastToggle) state.options.missionToastEnabled = toastToggle.checked;
    if (dailyChallengeToggle) state.options.dailyRunChallengesEnabled = dailyChallengeToggle.checked;
    if (failTimeToggle) state.options.missionFailExtraTimeLimit = failTimeToggle.checked;
    if (failHitToggle) state.options.missionFailExtraHitLimit = failHitToggle.checked;
    if (failNoHitToggle) state.options.missionFailExtraNoHit = failNoHitToggle.checked;
    const backAction = actionNode.dataset.back || "main-menu";
    menus.showOptionsMenu(backAction);
    return;
  }

  if (actionNode.dataset.action === "apply-options") {
    const musicSlider = overlay.querySelector("#musicVolumeSlider");
    const sfxSlider = overlay.querySelector("#sfxVolumeSlider");
    const toastToggle = overlay.querySelector("#missionToastToggle");
    const dailyChallengeToggle = overlay.querySelector("#dailyChallengeToggle");
    const failTimeToggle = overlay.querySelector("#missionFailTimeToggle");
    const failHitToggle = overlay.querySelector("#missionFailHitToggle");
    const failNoHitToggle = overlay.querySelector("#missionFailNoHitToggle");
    if (musicSlider) {
      const v = Math.max(0, Math.min(1, Number(musicSlider.value) / 100));
      state.options.musicVolume = v;
      if (typeof setMusicVolume === "function") setMusicVolume(v);
    }
    if (sfxSlider) {
      const v = Math.max(0, Math.min(1, Number(sfxSlider.value) / 100));
      state.options.sfxVolume = v;
      if (typeof setSfxVolume === "function") setSfxVolume(v);
    }
    if (toastToggle) {
      state.options.missionToastEnabled = toastToggle.checked;
    }
    if (dailyChallengeToggle) {
      state.options.dailyRunChallengesEnabled = dailyChallengeToggle.checked;
    }
    if (failTimeToggle) {
      state.options.missionFailExtraTimeLimit = failTimeToggle.checked;
    }
    if (failHitToggle) {
      state.options.missionFailExtraHitLimit = failHitToggle.checked;
    }
    if (failNoHitToggle) {
      state.options.missionFailExtraNoHit = failNoHitToggle.checked;
    }
    const backAction = actionNode.dataset.back || "main-menu";
    if (backAction === "manual-pause") {
      showPauseOverlay();
    } else {
      menus.showMainLandingMenu();
    }
    return;
  }

  if (actionNode.dataset.action === "continue-after-death") {
    if (state.pauseReason === "gameover" && state.running) {
      state.gameOver = false;
      state.pauseReason = "running";
      if (state.ship) {
        state.ship.invulnUntil = state.time + 2.0;
        state.ship.hp = Math.max(1, Number(state.ship.maxHp) || Number(state.ship.hp) || 1);
        state.ship.armor = Math.max(0, Number(state.ship.maxArmor) || Number(state.ship.armor) || 0);
        state.ship.acidUntil = 0;
        state.ship.acidTickCarry = 0;
      }
      overlay.classList.add("hidden");
      setPauseIndicatorVisible(false);
    }
    return;
  }

  if (actionNode.dataset.action === "open-main-menu") {
    if (state.multiplayer.enabled && isMultiplayerHost() && multiplayerSystem && typeof multiplayerSystem.requestReturnMenu === "function") {
      const sent = multiplayerSystem.requestReturnMenu();
      if (sent) return;
    }
    if (multiplayerSystem && typeof multiplayerSystem.configure === "function") {
      multiplayerSystem.configure({ enabled: false });
    }
    menus.showMainLandingMenu();
    return;
  }

  if (actionNode.dataset.action === "seed-randomize") {
    state.worldSeed = generateWorldSeed();
    menus.showDifficultySelectionMenu();
    return;
  }

  if (actionNode.dataset.action === "seed-apply") {
    const seedInputEl = overlay.querySelector("#worldSeedInput");
    if (seedInputEl) {
      const parsed = Number.parseInt(seedInputEl.value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        state.worldSeed = parsed;
      }
    }
    menus.showDifficultySelectionMenu();
    return;
  }

  if (actionNode.dataset.action === "restart") {
    menus.showDifficultySelectionMenu();
    return;
  }

  if (actionNode.dataset.action === "select-difficulty") {
    const lobbyState = getMultiplayerLobbyState();
    if (state.multiplayer.enabled) {
      const hostKnown = Boolean(lobbyState && lobbyState.hostId && lobbyState.selfId);
      const isHost = Boolean(hostKnown && lobbyState.selfId === lobbyState.hostId);
      if (!hostKnown || !isHost) {
        if (multiplayerSystem && typeof menus.showMultiplayerWaitingForHostConfig === "function") {
          menus.showMultiplayerWaitingForHostConfig(multiplayerSystem.getStatus(), multiplayerSystem.getLobbyState());
        }
        return;
      }
    }

    const seedInputEl = overlay.querySelector("#worldSeedInput");
    if (seedInputEl) {
      const parsed = Number.parseInt(seedInputEl.value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        state.worldSeed = parsed;
      }
    }

    const difficultyId = actionNode.dataset.difficultyId;
    if (difficultyId && DIFFICULTY_MODES[difficultyId]) {
      state.selectedDifficultyId = difficultyId;
      if (state.multiplayer.enabled && multiplayerSystem && typeof multiplayerSystem.sendRoomConfig === "function") {
        const sent = multiplayerSystem.sendRoomConfig({
          difficultyId: state.selectedDifficultyId,
          seed: state.worldSeed,
        });
        if (sent) {
          if (typeof menus.showMultiplayerWaitingForHostConfig === "function") {
            menus.showMultiplayerWaitingForHostConfig(multiplayerSystem.getStatus(), multiplayerSystem.getLobbyState());
          }
          return;
        }
      }
      menus.showShipSelectionMenu();
    }
    return;
  }

  if (actionNode.dataset.action === "resume") {
    if (state.pauseReason === "manual-pause") {
      state.running = true;
      state.pauseReason = "running";
      setPauseIndicatorVisible(false);
      overlay.classList.add("hidden");
    }
    return;
  }

  if (actionNode.dataset.action === "open-ship-select") {
    menus.showShipSelectionMenu();
    return;
  }

  if (actionNode.dataset.action === "select-ship") {
    const shipId = actionNode.dataset.shipId;
    if (shipId && SHIP_MODELS[shipId]) {
      state.selectedShipId = shipId;
      resetGame();
    }
    return;
  }

  if (actionNode.dataset.action === "upgrade") {
    const id = actionNode.dataset.upgradeId;
    if (id) {
      progression.applyUpgrade(id);
    }
  }

  if (actionNode.dataset.action === "reroll-upgrades") {
    progression.rerollLevelUpOptions();
    return;
  }

  if (actionNode.dataset.action === "boss-reward") {
    const rewardId = actionNode.dataset.rewardId;
    if (rewardId) {
      progression.applyBossReward(rewardId);
    }
  }
}

function cycleStatusBarsMode() {
  state.statusBarsMode = ((state.statusBarsMode || 0) + 1) % 4;
}

function debugTeleportNearNearestWormhole() {
  if (!state.debugHitboxes || !state.ship) return;

  const ship = state.ship;
  if (!Number.isFinite(ship.worldX) || !Number.isFinite(ship.worldY)) return;

  let nearest = null;

  const portals = typeof worldSystem.getWormholePortals === "function" ? worldSystem.getWormholePortals() : [];
  if (portals.length > 0) {
    let nearestDistSq = Number.POSITIVE_INFINITY;
    for (const portal of portals) {
      if (!Number.isFinite(portal.x) || !Number.isFinite(portal.y)) continue;
      const dx = portal.x - ship.worldX;
      const dy = portal.y - ship.worldY;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = portal;
      }
    }
  } else if (typeof worldSystem.getNearestWormholePortal === "function") {
    nearest = worldSystem.getNearestWormholePortal(ship.worldX, ship.worldY);
  }

  if (!nearest) return;

  let offsetX = ship.worldX - nearest.x;
  let offsetY = ship.worldY - nearest.y;
  const offsetLen = Math.hypot(offsetX, offsetY);
  if (offsetLen > 0.0001) {
    offsetX /= offsetLen;
    offsetY /= offsetLen;
  } else {
    offsetX = 1;
    offsetY = 0;
  }

  const safeOffset = (nearest.hitRadius || nearest.radius || 20) + ship.radius + 28;
  ship.worldX = nearest.x + offsetX * safeOffset;
  ship.worldY = nearest.y + offsetY * safeOffset;
  ship.vx = 0;
  ship.vy = 0;
  ship.wormholeCooldownUntil = state.time + 0.6;

  state.world.playerX = ship.worldX;
  state.world.playerY = ship.worldY;

  if (typeof cameraSystem.snap === "function") {
    cameraSystem.snap(ship.worldX, ship.worldY);
  }

  worldSystem.update(ship.worldX, ship.worldY);

  const cameraX = typeof cameraSystem.getX === "function" ? cameraSystem.getX() : ship.worldX;
  const cameraY = typeof cameraSystem.getY === "function" ? cameraSystem.getY() : ship.worldY;
  const teleportedScreen = projectWorldToScreen(ship.worldX, ship.worldY, cameraX, cameraY);
  ship.x = teleportedScreen.x;
  ship.y = teleportedScreen.y;
}

const inputSystem = createInputSystem({
  canvas,
  overlay,
  joystickAreaEl,
  joyBaseEl,
  joyKnobEl,
  input,
  state,
  WORLD,
  IS_COARSE_POINTER,
  initAudio,
  onTogglePause: togglePause,
  onToggleAutoFire: () => {
    state.desktopAutoFire = !state.desktopAutoFire;
    refreshHud();
  },
  onToggleMusic: () => {
    const nextEnabled = typeof toggleMusicEnabled === "function"
      ? toggleMusicEnabled()
      : !state.musicEnabled;
    if (typeof setMusicEnabled === "function") {
      setMusicEnabled(nextEnabled);
    }
    state.musicEnabled = Boolean(nextEnabled);

    if (state.musicEnabled) {
      playMusicCategory(state.running ? "game" : "menu");
    }

    refreshHud();
  },
  onToggleHitboxes: () => {
    debugTools.toggleHitboxes();
  },
  onDebugBoostWeapons: () => {
    debugTools.debugBoostWeapons();
  },
  onDebugTeleportNearWormhole: () => {
    debugTeleportNearNearestWormhole();
  },
  onToggleBalancePanel: () => {
    debugTools.toggleBalancePanel();
    refreshHud();
  },
  isBalancePanelVisible: () => debugTools.isBalancePanelVisible(),
  onBalanceTrackPrev: () => {
    debugTools.balanceTrackPrev();
    refreshHud();
  },
  onBalanceTrackNext: () => {
    debugTools.balanceTrackNext();
    refreshHud();
  },
  onBalanceTuneDown: () => {
    debugTools.balanceTuneDown();
    refreshHud();
  },
  onBalanceTuneUp: () => {
    debugTools.balanceTuneUp();
    refreshHud();
  },
  onBalanceTuneReset: () => {
    debugTools.balanceTuneReset();
    refreshHud();
  },
  onToggleShipInfo: () => {
    debugTools.toggleShipInfo();
  },
  onToggleStatusBars: () => {
    cycleStatusBarsMode();
  },
  onOverlayAction: handleOverlayAction,
});

menus.showMainLandingMenu();
playMusicCategory("menu");
inputSystem.setup();
worldSystem.update(0, 0);
fitMobileViewport();
window.addEventListener("resize", scheduleMobileViewportFit);
window.addEventListener("orientationchange", scheduleMobileViewportFit);
window.addEventListener("pageshow", scheduleMobileViewportFit);
window.addEventListener("focus", scheduleMobileViewportFit);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", scheduleMobileViewportFit);
}
if (window.matchMedia) {
  const orientationMedia = window.matchMedia("(orientation: landscape)");
  if (typeof orientationMedia.addEventListener === "function") {
    orientationMedia.addEventListener("change", scheduleMobileViewportFit);
  } else if (typeof orientationMedia.addListener === "function") {
    orientationMedia.addListener(scheduleMobileViewportFit);
  }
}
window.addEventListener("beforeunload", () => {
  if (multiplayerSystem && typeof multiplayerSystem.disconnect === "function") {
    multiplayerSystem.disconnect();
  }
});
requestAnimationFrame(gameLoop);
