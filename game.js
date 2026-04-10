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
const shieldStatusEl = document.getElementById("shieldStatus");
const rocketStatusEl = document.getElementById("rocketStatus");
const musicStatusEl = document.getElementById("musicStatus");
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
  if (!IS_COARSE_POINTER) {
    if (stageWrapEl) {
      stageWrapEl.style.removeProperty("width");
      stageWrapEl.style.removeProperty("height");
    }
    return;
  }

  const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const hudVisible = hudEl ? window.getComputedStyle(hudEl).display !== "none" : false;
  const hudHeight = hudVisible && hudEl ? hudEl.offsetHeight : 0;

  const horizontalSpace = Math.max(260, viewportWidth - 8);
  const verticalSpace = Math.max(150, viewportHeight - hudHeight - 18);

  let nextWidth = horizontalSpace;
  let nextHeight = Math.floor(nextWidth / BASE_WORLD.aspect);

  if (nextHeight > verticalSpace) {
    nextHeight = verticalSpace;
    nextWidth = Math.floor(nextHeight * BASE_WORLD.aspect);
  }

  applyWorldSize(Math.max(260, Math.floor(nextWidth)), Math.max(150, Math.floor(nextHeight)));

  if (stageWrapEl) {
    stageWrapEl.style.width = `${WORLD.width}px`;
    stageWrapEl.style.height = `${WORLD.height}px`;
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

function reloadRate() {
  return state.shipStats ? state.shipStats.reloadRate : 1;
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
  state.levelUpPending = false;
  state.score = 0;
  state.kills = 0;
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
  state.running = false;
  state.gameOver = true;
  state.pauseReason = "gameover";
  setPauseIndicatorVisible(false);
  overlay.classList.remove("hidden");
  playMusicCategory("menu");
  overlay.innerHTML = `
    <h1>Game Over</h1>
    <p>Zeit: ${state.time.toFixed(1)}s | Punkte: ${Math.floor(state.score)} | Kills: ${state.kills}</p>
    <button data-action="restart">Neu starten</button>
    <button data-action="open-ship-select">Raumschiff wechseln</button>
  `;
}

function showPauseOverlay() {
  setPauseIndicatorVisible(true);
  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <h1>Pause</h1>
    <p>Spiel pausiert</p>
    <button data-action="resume">Fortsetzen</button>
    <button data-action="restart">Neu starten</button>
    <button data-action="open-ship-select">Raumschiff wechseln</button>
  `;
}

function togglePause() {
  if (state.pauseReason === "difficulty-select" || state.pauseReason === "ship-select" || state.pauseReason === "levelup" || state.pauseReason === "bossreward" || state.pauseReason === "gameover") {
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
  if (!shipDamage.tickAcidDamageToShip(ship, dt)) {
    setGameOver();
    return null;
  }

  flightControl.applyInputThrust(ship, dt);

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

function update(dt, now) {
  if (!state.running) return;

  const difficulty = selectedDifficultyMode();
  const perfStart = performance.now();

  state.time += dt;
  scoring.addPassiveScore(dt);

  if (state.score >= state.nextLevelScore && !state.levelUpPending && !state.bossActive) {
    progression.showLevelUpChoice();
    return;
  }

  const ship = state.ship;
  
  // === MOVEMENT PHASE ===
  const perfMovementStart = performance.now();
  const movement = runMovementPhase(dt, ship);
  if (!movement) return;
  const { cameraX, cameraY } = movement;

  if (!hazardInteractions.handleShipStructureCollisions(ship, cameraX, cameraY)) {
    return;
  }

  if (!hazardInteractions.handleShipSolarHeat(ship, dt)) {
    return;
  }

  if (!hazardInteractions.handleShipToxicNebula(ship, dt)) {
    return;
  }

  if (!hazardInteractions.handleShipWormholes(ship, cameraX, cameraY)) {
    return;
  }

  const desktopAutoShooting = state.desktopAutoFire && !IS_COARSE_POINTER && state.mouseInCanvas;
  if (input.shooting || desktopAutoShooting) weapons.shootAtCursor(now);

  if (input.rocketQueued) {
    weapons.fireRocket(now);
    input.rocketQueued = false;
  }

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

  encounters.updateBoss(dt);

  for (const obj of state.objects) {
    if (!Number.isFinite(obj.worldX) || !Number.isFinite(obj.worldY)) {
      const worldPos = screenToWorld(obj.x, obj.y);
      obj.worldX = worldPos.x;
      obj.worldY = worldPos.y;
    }

    enemyAI.updateEnemySteering(obj, ship, dt);

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
      const dxShip = (ship.worldX || 0) - (obj.worldX || 0);
      const dyShip = (ship.worldY || 0) - (obj.worldY || 0);
      const distShip = Math.hypot(dxShip, dyShip);
      if (distShip > Math.max(WORLD.width, WORLD.height) * GAMEPLAY_TUNING.enemyCombat.miniFireMaxDistViewportMult) {
        obj.nextShotAt = state.time
          + GAMEPLAY_TUNING.enemyCombat.miniOutOfRangeDelayMin
          + Math.random() * GAMEPLAY_TUNING.enemyCombat.miniOutOfRangeDelayRand;
      } else {
      enemyCombat.fireEnemyWeapon(obj, ship);
      obj.nextShotAt = enemyCombat.nextEnemyShotAt(obj, state.time);
      }
    }

    if (obj.type === "alienShip" && obj.aggroLocked && obj.nextShotAt !== null && state.time >= obj.nextShotAt) {
      const dxShip = (ship.worldX || 0) - (obj.worldX || 0);
      const dyShip = (ship.worldY || 0) - (obj.worldY || 0);
      const distShip = Math.hypot(dxShip, dyShip);
      if (distShip > Math.max(WORLD.width, WORLD.height) * GAMEPLAY_TUNING.enemyCombat.shipFireMaxDistViewportMult) {
        obj.nextShotAt = state.time
          + GAMEPLAY_TUNING.enemyCombat.shipOutOfRangeDelayMin
          + Math.random() * GAMEPLAY_TUNING.enemyCombat.shipOutOfRangeDelayRand;
      } else {
      enemyCombat.fireEnemyWeapon(obj, ship);
      obj.nextShotAt = enemyCombat.nextEnemyShotAt(obj, state.time);
      }
    }

    const dxShip = (obj.worldX || obj.x) - (ship.worldX || ship.x);
    const dyShip = (obj.worldY || obj.y) - (ship.worldY || ship.y);
    const d = Math.hypot(dxShip, dyShip);
    if (d < obj.collisionRadius + ship.radius - 2) {
      if (tryUseDrillOnObject(obj)) {
        continue;
      }
      const objDamage = obj.type === "boulder" || obj.type === "mediumRock" ? 2 : 1;
      if (!hitShip("physical", objDamage)) {
        setGameOver();
        return;
      }
      if (obj.destructible) {
        destroyObject(obj, DESTROY_REASONS.COLLISION);
      }
    }
  }

  if (!bossCombat.updateBossCombat(dt, ship)) {
    return;
  }

  projectileResolver.resolveBulletsMovement(dt, cameraX, cameraY);
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

  refreshHud();
  const perfCleanupEnd = performance.now();
  state.perfCounters.cleanup = perfCleanupEnd - perfCleanupStart;

  state.perfCounters.frameTotal = perfCleanupEnd - perfStart;
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
  const recoverableStopped = !state.running && overlayHidden && (state.pauseReason === "running" || inSelectionState);

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

  requestAnimationFrame(gameLoop);
}
function handleOverlayAction(actionNode) {
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

  if (actionNode.dataset.action === "boss-reward") {
    const rewardId = actionNode.dataset.rewardId;
    if (rewardId) {
      progression.applyBossReward(rewardId);
    }
  }
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
  onOverlayAction: handleOverlayAction,
});

menus.showDifficultySelectionMenu();
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
requestAnimationFrame(gameLoop);
