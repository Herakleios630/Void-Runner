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
const shieldStatusEl = document.getElementById("shieldStatus");
const rocketStatusEl = document.getElementById("rocketStatus");
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
const { initAudio, playSfx } = window.VoidAudio;
const { createWorldSystem } = window.VoidWorld;
const { createCameraSystem } = window.VoidCamera;
const { createRenderer } = window.VoidRender;
const { createEncountersSystem } = window.VoidEncounters;
const { createMenuSystem } = window.VoidMenus;
const { createProgressionSystem } = window.VoidProgression;
const { createWeaponsSystem } = window.VoidWeapons;
const { createInputSystem } = window.VoidInput;

const BALANCE_PROFILE_ID = "medium"; // safe | medium | chaos
const BALANCE_TUNING_TRACKS = ["cannon", "laser", "rocket", "drill", "plasma", "shield"];
const WORLD_CHUNK_SIZE = 960;

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
  edgeHazards: [],
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
  lastEdgeSpawn: 0,
  edgeSpawnInterval: 2.2,
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
};

const balanceDebug = {
  visible: false,
  selectedTrackIndex: 0,
  tuneStep: 0.05,
};

const balanceDebugPanelEl = document.createElement("aside");
balanceDebugPanelEl.className = "balance-debug hidden";
stageWrapEl.appendChild(balanceDebugPanelEl);

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
      state.shield.nextNova = state.time + 30;
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
];

function getSprite(key) {
  if (!spriteAssets || !spriteAssets.ready()) return null;
  return spriteAssets.get(key);
}

function scaleEntitiesToWorld(sx, sy) {
  for (const collection of [state.objects, state.edgeHazards, state.bullets, state.laserBeams, state.plasmaBursts, state.missiles, state.pickups, state.bossProjectiles, state.particles, state.damageTexts, state.stars]) {
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
});

const worldSystem = createWorldSystem({
  chunkSize: WORLD_CHUNK_SIZE,
  worldSeed: state.worldSeed,
  activeRadius: 2,
  unloadRadius: 3,
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

function computeBurnTickDamage() {
  const crit = rollCrit();
  if (!crit) return 1;
  const critMult = state.shipStats ? state.shipStats.critDamage : 1.5;
  return Math.max(1, Math.round(critMult * 0.8));
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

function applyAcidToShip(duration = 3.8, dps = 0.8) {
  if (!state.ship) return;
  state.ship.acidUntil = Math.max(state.ship.acidUntil || 0, state.time + duration);
  state.ship.acidDps = Math.max(state.ship.acidDps || 0, dps);
  state.ship.acidTickCarry = state.ship.acidTickCarry || 0;
}

function hitShip(damageType = "physical", amount = 1) {
  if (!state.ship) return false;
  if (state.time < state.ship.invulnUntil) return true;

  if (consumeShield(damageType, amount)) {
    state.ship.invulnUntil = state.time + 0.5;
    return true;
  }

  let remaining = Math.max(0, amount);
  if (state.ship.armor > 0) {
    // One armor point is consumed per hit and mitigates damage by source type.
    state.ship.armor = Math.max(0, state.ship.armor - 1);
    const reduction = damageType === "physical" ? 1 : damageType === "explosive" ? 1 : damageType === "acid" ? 0.2 : 0.5;
    remaining = Math.max(0, remaining - reduction);
  }

  if (remaining > 0) {
    state.ship.hp -= Math.max(1, Math.ceil(remaining));
  }
  state.ship.invulnUntil = state.time + 0.5;
  createExplosion(state.ship.x, state.ship.y, "#ff7f8a", 20);
  if (state.ship.hp <= 0) {
    return false;
  }
  return true;
}

function scoreMultiplier() {
  return 1 + Math.min(2.4, Math.pow(Math.max(0, state.level - 1), 0.92) * 0.08);
}

function addPoints(base) {
  const xp = state.shipStats ? state.shipStats.xpBonus : 1;
  const earlyLevelScale = state.level <= 4 ? (0.62 + state.level * 0.1) : 1;
  state.score += base * scoreMultiplier() * xp * earlyLevelScale;
}

function spawnIntensity() {
  // Progression pressure increases only after each defeated boss.
  return 1 + Math.min(1.25, state.bossLevelsCleared * 0.2);
}

function passiveScoreMultiplier() {
  const salvage = 1 + (state.upgradesTaken.lootSalvageBoost || 0) * 0.2;
  const xp = state.shipStats ? state.shipStats.xpBonus : 1;
  return salvage * xp;
}

function computeNextLevelCost() {
  const difficulty = selectedDifficultyMode();
  const elapsed = Math.max(1, state.time - state.lastLevelTime);
  const gained = Math.max(1, state.score - state.lastLevelScore);
  const killsGained = Math.max(0, state.kills - (state.lastLevelKills || 0));
  const scoreRate = gained / elapsed;
  const killsPerMinute = (killsGained / elapsed) * 60;
  const passiveRate = (2.4 + state.level * 0.14) * passiveScoreMultiplier();
  const combatRate = Math.max(0, scoreRate - passiveRate);

  // Hard mode spawns more score opportunities, easy mode fewer.
  // Scale required XP so all difficulties stay in a comparable level-time corridor.
  const difficultyLevelScale = Math.max(0.86, Math.min(1.18, (difficulty.spawnRateMult * 0.7) + (difficulty.edgeSpawnRateMult * 0.3)));
  const adjustedRate = scoreRate * difficultyLevelScale;

  // Kill-heavy play targets 30-60s; passive/low-kill windows may stretch toward 90s.
  const killPressure = clamp(killsPerMinute / 7.5, 0, 2.2);
  const combatPressure = clamp(combatRate / 24, 0, 2.2);
  const pressure = clamp(killPressure * 0.68 + combatPressure * 0.32, 0, 2.2);
  const baseTargetSeconds = clamp(90 - pressure * 27, 30, 90);
  const earlyLevelBoost = state.level <= 4 ? (1.35 - state.level * 0.08) : 1;
  const targetSeconds = clamp(baseTargetSeconds * earlyLevelBoost, 32, 105);

  const dynamicCost = Math.floor(adjustedRate * targetSeconds);
  const exponentialBase = Math.floor(state.levelCost * 1.14 + 18);
  const blended = Math.floor(exponentialBase * 0.44 + dynamicCost * 0.56);

  const minBound = state.level <= 4 ? state.levelCost + 34 : state.levelCost + 14;
  const maxBound = Math.floor(state.levelCost * 1.5 + 120);
  return Math.max(minBound, Math.min(maxBound, blended));
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

const progression = createProgressionSystem({
  state,
  overlay,
  playSfx,
  refreshHud,
  spawnBoss: encounters.spawnBoss,
  computeNextLevelCost,
  setPauseIndicatorVisible,
  upgradeDefs: UPGRADE_DEFS,
  upgradeWeights: UPGRADE_WEIGHTS,
  bossLootDefs: BOSS_LOOT_DEFS,
  weaponUpgradeTrack: WEAPON_UPGRADE_TRACK,
  weaponLevelMilestones: WEAPON_LEVEL_MILESTONES,
  balanceProfileId: BALANCE_PROFILE_ID,
});

function onBossDefeated() {
  if (!state.bossActive || !state.boss) return;
  const guaranteedLoot = state.boss.hasLoot;
  createExplosion(state.boss.x, state.boss.y, "#ff7b4a", 64);
  addPoints(220 + state.level * 20);
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
  state.edgeHazards = [];
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
  state.lastEdgeSpawn = 0;
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

  updateBalanceDebugPanel();
}

function selectedBalanceTrack() {
  return BALANCE_TUNING_TRACKS[Math.max(0, Math.min(BALANCE_TUNING_TRACKS.length - 1, balanceDebug.selectedTrackIndex))] || "cannon";
}

function cycleBalanceTrack(dir) {
  const len = BALANCE_TUNING_TRACKS.length;
  if (len <= 0) return;
  balanceDebug.selectedTrackIndex = (balanceDebug.selectedTrackIndex + dir + len) % len;
}

function updateBalanceDebugPanel() {
  if (!balanceDebug.visible) {
    balanceDebugPanelEl.classList.add("hidden");
    return;
  }

  const snapshot = progression.getLevelTuningSnapshot();
  const selected = selectedBalanceTrack();
  const rows = BALANCE_TUNING_TRACKS
    .map((track) => {
      const marker = track === selected ? ">" : " ";
      const value = snapshot.tracks[track] || 1;
      return `<div>${marker} ${track.padEnd(6, " ")}: x${value.toFixed(2)}</div>`;
    })
    .join("");

  balanceDebugPanelEl.classList.remove("hidden");
  balanceDebugPanelEl.innerHTML = `
    <div><strong>Balance Debug</strong> (${snapshot.profileId})</div>
    <div class="balance-debug-hint">B: Panel | [ ]: Waffe | - / +: Faktor | 0: Reset</div>
    <div class="balance-debug-rows">${rows}</div>
  `;
}

function setGameOver() {
  state.running = false;
  state.gameOver = true;
  state.pauseReason = "gameover";
  setPauseIndicatorVisible(false);
  overlay.classList.remove("hidden");
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

function ensureEntityWorldPosition(entity) {
  if (Number.isFinite(entity.worldX) && Number.isFinite(entity.worldY)) {
    return;
  }
  const worldPos = screenToWorld(entity.x, entity.y);
  entity.worldX = worldPos.x;
  entity.worldY = worldPos.y;
}

function syncEntityScreenPosition(entity, cameraX, cameraY) {
  if (!Number.isFinite(entity.worldX) || !Number.isFinite(entity.worldY)) return;
  const screenPos = projectWorldToScreen(entity.worldX, entity.worldY, cameraX, cameraY);
  entity.x = screenPos.x;
  entity.y = screenPos.y;
}


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

function spawnRockFragments(parent) {
  const pieces = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < pieces; i += 1) {
    const angle = (i / pieces) * Math.PI * 2 + Math.random() * 0.8;
    const speed = 120 + Math.random() * 120;
    const size = 9 + Math.random() * 6;
    const corners = 7;

    state.objects.push({
      id: nextObjectId(),
      type: "rockShard",
      x: parent.x + Math.cos(angle) * 4,
      y: parent.y + Math.sin(angle) * 4,
      worldX: Number.isFinite(parent.worldX) ? parent.worldX + Math.cos(angle) * 4 : undefined,
      worldY: Number.isFinite(parent.worldY) ? parent.worldY + Math.sin(angle) * 4 : undefined,
      vx: parent.vx + Math.cos(angle) * speed,
      vy: parent.vy + Math.sin(angle) * speed,
      size,
      hp: 1,
      destroyed: false,
      destructible: true,
      collisionRadius: size * 0.77,
      corners,
      rockProfile: Array.from({ length: corners }, () => 0.72 + Math.random() * 0.26),
      spin: (Math.random() - 0.5) * 3,
      angle: Math.random() * Math.PI * 2,
      passed: true,
    });
  }
}

function maybeSpawnArmorPickup(obj) {
  const asteroidTypes = ["smallRock", "mediumRock", "rockShard", "boulder"];
  if (!asteroidTypes.includes(obj.type)) return;

  const dropChance = obj.type === "mediumRock" ? 0.18 : obj.type === "boulder" ? 0.22 : 0.1;
  if (Math.random() > dropChance) return;

  state.pickups.push({
    type: "armor",
    x: obj.x,
    y: obj.y,
    worldX: Number.isFinite(obj.worldX) ? obj.worldX : undefined,
    worldY: Number.isFinite(obj.worldY) ? obj.worldY : undefined,
    vx: obj.vx * 0.35,
    vy: obj.vy * 0.35,
    radius: 10,
    life: 10,
  });
}

function destroyObject(obj, reason) {
  if (obj.destroyed) return;

  obj.destroyed = true;
  obj.hp = 0;

  if (reason === "shot") {
    state.kills += 1;
    if (obj.type === "miniAlien") addPoints(34);
    else if (obj.type === "alienShip") addPoints(42);
    else if (obj.type === "mediumRock") addPoints(38);
    else if (obj.type === "smallRock") addPoints(30);
    else if (obj.type === "rockShard") addPoints(22);
    else addPoints(24);
  }

  if (reason === "rocket") {
    state.kills += 1;
    if (obj.type === "boulder") addPoints(88);
    else if (obj.type === "debris") addPoints(50);
    else if (obj.type === "alienShip") addPoints(58);
    else if (obj.type === "miniAlien") addPoints(44);
    else if (obj.type === "mediumRock") addPoints(46);
    else if (obj.type === "smallRock") addPoints(34);
    else addPoints(30);
  }

  if (obj.type === "mediumRock") {
    spawnRockFragments(obj);
  }

  maybeSpawnArmorPickup(obj);

  const color = obj.type === "miniAlien" ? "#94ff74" : "#ffb36a";
  createExplosion(obj.x, obj.y, color, obj.type === "mediumRock" ? 24 : 14);
  playSfx("explosion");
}

function damageNearbyFromShieldPulse(radius, allowHeavyTargets) {
  for (const obj of state.objects) {
    if (obj.hp <= 0) continue;
    const d = Math.hypot(obj.x - state.ship.x, obj.y - state.ship.y);
    if (d > radius + obj.collisionRadius) continue;

    if (obj.destructible || allowHeavyTargets || obj.type === "boulder" || obj.type === "debris") {
      destroyObject(obj, "rocket");
    }
  }

  createExplosion(state.ship.x, state.ship.y, "#84e7ff", 28);
}

function consumeShield(damageType = "physical", amount = 1) {
  if (!state.shield.unlocked || state.shield.charges < 1) return false;

  if (state.shield.integrity <= 0) {
    state.shield.integrity = state.shield.charges;
  }

  // Energy hits drain only half shield integrity: shield is extra effective vs energy.
  const shieldCost = damageType === "energy" ? amount * 0.5 : amount;
  state.shield.integrity -= shieldCost;

  if (state.shield.integrity > 0) {
    if (state.weaponSpecials.shieldThornPulse && state.time - (state.shield.lastThornPulseAt || -999) >= 1.6) {
      state.shield.lastThornPulseAt = state.time;
      damageNearbyFromShieldPulse(state.shield.thornPulseRadius || 78, false);
    }
    playSfx("shieldHit");
    createExplosion(state.ship.x, state.ship.y, "#71f4ff", 18);
    return true;
  }

  state.shield.charges = 0;
  state.shield.integrity = 0;
  state.shield.cooldownUntil = state.time + state.shield.rechargeDelay / reloadRate();
  playSfx("shieldHit");
  createExplosion(state.ship.x, state.ship.y, "#71f4ff", 24);

  if (state.shield.thorns) {
    damageNearbyFromShieldPulse(state.shield.thornBreakRadius || 105, false);
  }

  // This hit is still fully consumed by the shield break.
  return true;
}

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
  const d = Math.hypot(obj.x - tipX, obj.y - tipY);

  if (d > obj.collisionRadius + state.weapon.drillRadius) return false;

  state.weapon.drillCharges = 0;
  state.weapon.drillCooldownUntil = state.time + state.weapon.drillRechargeDelay / reloadRate();
  destroyObject(obj, "rocket");

  if (state.weaponSpecials.drillPulse) {
    let cleared = 0;
    for (const other of state.objects) {
      if (other === obj || other.hp <= 0 || !other.destructible) continue;
      const d2 = Math.hypot(other.x - obj.x, other.y - obj.y);
      if (d2 <= 86 + other.collisionRadius) {
        destroyObject(other, "shot");
        cleared += 1;
        if (cleared >= 4) break;
      }
    }
  }

  createExplosion(tipX, tipY, "#8ef7ff", 16);
  playSfx("shieldHit");
  return true;
}

function getRocketCooldownLeft() {
  return weapons.getRocketCooldownLeft();
}

function applyHeatHit(target, damage, hitX, hitY) {
  if (target.heatHitUntil && target.heatHitUntil > state.time) return;
  target.heatHitUntil = state.time + 0.18;

  const stackCap = 5;
  if (!target.burnStacks) target.burnStacks = 0;
  if (!target.nextBurnStackAt || state.time >= target.nextBurnStackAt) {
    target.burnStacks = Math.min(stackCap, target.burnStacks + 1);
    target.nextBurnStackAt = state.time + 1;
  }

  // Plasma direct hit is intentionally near-zero; damage comes from burning ticks.
  if (damage > 0) {
    const dmg = computeDamage(damage, "heat");
    target.hp -= dmg.damage;
    addDamageText(hitX, hitY - 6, dmg.damage, dmg.crit);
  }

  target.burnUntil = Math.max(target.burnUntil || 0, state.time + state.weapon.plasmaBurnDuration);
  target.burnDps = Math.max(target.burnDps || 0, state.weapon.plasmaBurnDps * (state.shipStats ? state.shipStats.heatDamage : 1));
  target.burnTickCarry = target.burnTickCarry || 0;
  createExplosion(hitX, hitY, "#ff944d", 4);

  if (target.hp <= 0) {
    if (target === state.boss) {
      onBossDefeated();
    } else {
      destroyObject(target, "shot");
    }
  }
}

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
  bullet.life = Math.max(0.1, bullet.life - 0.08);
  bullet.x = hitX + nx * (bullet.radius + 1.5);
  bullet.y = hitY + ny * (bullet.radius + 1.5);

  const shouldSplit = state.weaponSpecials.cannonRicochetSplit
    && bullet.ricochetLeft > 0
    && bullet.ricochetCount <= 3
    && bullet.ricochetCount % 2 === 1;

  if (shouldSplit) {
    const baseAngle = Math.atan2(bullet.vy, bullet.vx);
    const speedNow = Math.hypot(bullet.vx, bullet.vy) || 1;
    const splitOff = 0.14;

    bullet.vx = Math.cos(baseAngle + splitOff) * speedNow;
    bullet.vy = Math.sin(baseAngle + splitOff) * speedNow;

    weapons.spawnCannonBullet({
      x: bullet.x,
      y: bullet.y,
      vx: Math.cos(baseAngle - splitOff) * speedNow,
      vy: Math.sin(baseAngle - splitOff) * speedNow,
      life: Math.max(0.18, bullet.life * 0.9),
      radius: Math.max(2.7, bullet.radius * 0.92),
      damageBase: Math.max(0.55, (bullet.damageBase || state.weapon.cannonEffectiveness) * 0.9),
      ricochetLeft: Math.max(0, bullet.ricochetLeft - 1),
      ricochetCount: bullet.ricochetCount,
    });
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


function update(dt, now) {
  if (!state.running) return;

  const difficulty = selectedDifficultyMode();

  state.time += dt;
  const earlyPassiveScale = state.level <= 4 ? (0.5 + state.level * 0.1) : 1;
  state.score += dt * (2.4 + state.level * 0.14) * passiveScoreMultiplier() * earlyPassiveScale;

  if (state.score >= state.nextLevelScore && !state.levelUpPending && !state.bossActive) {
    progression.showLevelUpChoice();
    return;
  }

  const ship = state.ship;

  if (ship.acidUntil && ship.acidUntil > state.time) {
    ship.acidTickCarry = (ship.acidTickCarry || 0) + (ship.acidDps || 0) * dt;
    while (ship.acidTickCarry >= 1) {
      ship.acidTickCarry -= 1;
      if (ship.armor > 0) {
        ship.armor = Math.max(0, ship.armor - 1);
      } else {
        ship.hp -= 1;
      }
      if (ship.hp <= 0) {
        setGameOver();
        return;
      }
    }
  }
  ship.vx += input.axisX * ship.thrust * dt;
  ship.vy += input.axisY * ship.thrust * dt;
  if (input.up) ship.vy -= ship.thrust * dt;
  if (input.down) ship.vy += ship.thrust * dt;
  if (input.left) ship.vx -= ship.thrust * dt;
  if (input.right) ship.vx += ship.thrust * dt;

  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > ship.maxSpeed) {
    ship.vx = (ship.vx / speed) * ship.maxSpeed;
    ship.vy = (ship.vy / speed) * ship.maxSpeed;
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

  const collidablePlanets = worldSystem.getCollidablePlanets();
  if (collidablePlanets.length > 0) {
    for (const planet of collidablePlanets) {
      const p = cameraSystem.worldToScreen(planet.x, planet.y, planet.parallax || 1, WORLD.width, WORLD.height);
      const d = Math.hypot(ship.x - p.x, ship.y - p.y);
      const hitR = (planet.radius || 0) + ship.radius - 2;
      if (d < hitR) {
        if (!hitShip("physical", 2)) {
          setGameOver();
          return;
        }

        const nx = d > 0 ? (ship.x - p.x) / d : 1;
        const ny = d > 0 ? (ship.y - p.y) / d : 0;
        const pushOut = Math.max(0, hitR - d) + 1;
        ship.worldX += nx * pushOut;
        ship.worldY += ny * pushOut;
        ship.vx += nx * 80;
        ship.vy += ny * 80;

        const pushedScreen = projectWorldToScreen(ship.worldX, ship.worldY, cameraX, cameraY);
        ship.x = pushedScreen.x;
        ship.y = pushedScreen.y;
      }
    }
  }

  const orbitalStations = typeof worldSystem.getOrbitalStations === "function" ? worldSystem.getOrbitalStations(state.time) : [];
  if (orbitalStations.length > 0) {
    for (const station of orbitalStations) {
      const p = cameraSystem.worldToScreen(station.x, station.y, station.parallax || 1, WORLD.width, WORLD.height);
      const d = Math.hypot(ship.x - p.x, ship.y - p.y);
      const hitR = (station.hitRadius || station.radius || 12) + ship.radius - 2;
      if (d < hitR) {
        if (!hitShip("physical", 1)) {
          setGameOver();
          return;
        }

        const nx = d > 0 ? (ship.x - p.x) / d : 1;
        const ny = d > 0 ? (ship.y - p.y) / d : 0;
        const pushOut = Math.max(0, hitR - d) + 1;
        ship.worldX += nx * pushOut;
        ship.worldY += ny * pushOut;
        ship.vx += nx * 60;
        ship.vy += ny * 60;

        const pushedScreen = projectWorldToScreen(ship.worldX, ship.worldY, cameraX, cameraY);
        ship.x = pushedScreen.x;
        ship.y = pushedScreen.y;
      }
    }
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
    state.shield.nextNova = state.time + 30;
    damageNearbyFromShieldPulse(220, true);
    createExplosion(ship.x, ship.y, "#71f4ff", 42);
    playSfx("shieldHit");
  }

  if (!state.bossActive) {
    encounters.spawnChunksAround(cameraX, cameraY, 1);

    const intensity = spawnIntensity();

    state.lastSpawn += dt;
    const dynamicSpawn = Math.max(0.34, state.spawnInterval / (intensity * difficulty.spawnRateMult));
    while (state.lastSpawn >= dynamicSpawn) {
      state.lastSpawn -= dynamicSpawn;
      encounters.spawnObject();
    }

    state.lastEdgeSpawn += dt;
    const dynamicEdgeSpawn = Math.max(1.2, state.edgeSpawnInterval / Math.max(1, intensity * 0.82 * difficulty.edgeSpawnRateMult));
    while (state.lastEdgeSpawn >= dynamicEdgeSpawn) {
      state.lastEdgeSpawn -= dynamicEdgeSpawn;
      encounters.spawnEdgeHazard();
    }
  }

  encounters.updateBoss(dt);

  for (const obj of state.objects) {
    if (!Number.isFinite(obj.worldX) || !Number.isFinite(obj.worldY)) {
      const worldPos = screenToWorld(obj.x, obj.y);
      obj.worldX = worldPos.x;
      obj.worldY = worldPos.y;
    }

    if (obj.type === "miniAlien" || obj.type === "alienShip") {
      const dxToShip = (ship.worldX || 0) - obj.worldX;
      const dyToShip = (ship.worldY || 0) - obj.worldY;
      const distToShip = Math.hypot(dxToShip, dyToShip) || 1;
      const engageRange = obj.aggroRange || 700;
      const disengageRange = obj.disengageRange || engageRange * 1.7;
      const memoryWindow = 2.8;
      const targetRange = obj.preferredRange || 190;

      if (!obj.aggroLocked && distToShip <= engageRange) {
        obj.aggroLocked = true;
        obj.aggroUntil = state.time + memoryWindow;
      }

      if (obj.aggroLocked && distToShip <= disengageRange) {
        obj.aggroUntil = state.time + memoryWindow;
      }

      if (obj.aggroLocked && state.time > (obj.aggroUntil || 0)) {
        obj.aggroLocked = false;
      }

      if (obj.aggroLocked) {
        const chaseSpeed = obj.chaseSpeed || 540;
        const steer = obj.steering || 1.5;
        const chaseAccel = obj.chaseAccel || 320;
        const chaseDir = distToShip > targetRange ? 1 : -0.5;
        const desiredVx = (dxToShip / distToShip) * chaseSpeed * chaseDir;
        const desiredVy = (dyToShip / distToShip) * chaseSpeed * chaseDir;
        const maxDelta = chaseAccel * dt;
        const deltaVx = (desiredVx - obj.vx) * Math.min(1, steer * dt);
        const deltaVy = (desiredVy - obj.vy) * Math.min(1, steer * dt);
        const deltaLen = Math.hypot(deltaVx, deltaVy) || 1;
        const scale = deltaLen > maxDelta ? maxDelta / deltaLen : 1;
        obj.vx += deltaVx * scale;
        obj.vy += deltaVy * scale;
      } else {
        obj.vx *= 0.88;
        obj.vy *= 0.88;
      }
    }

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
          destroyObject(obj, "shot");
        }
      }
    }

    if (!obj.passed) {
      const dxPass = (obj.worldX || obj.x) - (ship.worldX || ship.x);
      const dyPass = (obj.worldY || obj.y) - (ship.worldY || ship.y);
      const distPass = Math.hypot(dxPass, dyPass);
      if (distPass > Math.max(WORLD.width, WORLD.height) * 1.05) {
        obj.passed = true;
        addPoints(obj.destructible ? 1 : 2);
      }
    }

    if (obj.type === "miniAlien" && obj.nextShotAt !== null && state.time >= obj.nextShotAt) {
      const dxShip = (ship.worldX || 0) - (obj.worldX || 0);
      const dyShip = (ship.worldY || 0) - (obj.worldY || 0);
      const distShip = Math.hypot(dxShip, dyShip);
      if (distShip > Math.max(WORLD.width, WORLD.height) * 0.95) {
        obj.nextShotAt = state.time + 0.6 + Math.random() * 0.9;
      } else {
      const spread = (Math.random() - 0.5) * 18;
      if (Math.random() < 0.62) {
        encounters.spawnEnemyProjectile(obj.x, obj.y, ship.x + spread, ship.y + spread * 0.4, 235, "acid", 1);
      } else {
        encounters.spawnEnemyFlameBurst(obj.x, obj.y, ship.x + spread, ship.y + spread * 0.4);
      }
      obj.nextShotAt = state.time + 1.7 + Math.random() * 1.8;
      }
    }

    if (obj.type === "alienShip" && obj.nextShotAt !== null && state.time >= obj.nextShotAt) {
      const dxShip = (ship.worldX || 0) - (obj.worldX || 0);
      const dyShip = (ship.worldY || 0) - (obj.worldY || 0);
      const distShip = Math.hypot(dxShip, dyShip);
      if (distShip > Math.max(WORLD.width, WORLD.height) * 1.05) {
        obj.nextShotAt = state.time + 0.55 + Math.random() * 0.8;
      } else {
      const spread = (Math.random() - 0.5) * 22;
      if (Math.random() < 0.66) {
        encounters.spawnEnemyProjectile(obj.x, obj.y, ship.x + spread, ship.y + spread * 0.5, 280, "energy", 1);
      } else {
        encounters.spawnEnemyProjectile(obj.x, obj.y, ship.x + spread, ship.y + spread * 0.5, 220, "explosive", 2);
      }
      obj.nextShotAt = state.time + 1.35 + Math.random() * 1.45;
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
        destroyObject(obj, "rocket");
      }
    }
  }

  if (state.bossActive && state.boss) {
    if (state.boss.burnUntil && state.boss.burnUntil > state.time && state.boss.hp > 0) {
      const burnStacks = Math.max(1, state.boss.burnStacks || 1);
      state.boss.burnTickCarry = (state.boss.burnTickCarry || 0) + (state.boss.burnDps || 0) * burnStacks * dt;
      while (state.boss.burnTickCarry >= 1 && state.boss.hp > 0) {
        state.boss.burnTickCarry -= 1;
        const burnDmg = computeBurnTickDamage();
        state.boss.hp -= burnDmg;
        addDamageText(state.boss.x, state.boss.y - state.boss.size * 0.4, burnDmg, burnDmg > 1);
        if (state.boss.hp <= 0) {
          onBossDefeated();
          break;
        }
      }
    }

    const dBoss = Math.hypot((state.boss.worldX || state.boss.x) - (ship.worldX || ship.x), (state.boss.worldY || state.boss.y) - (ship.worldY || ship.y));
    if (dBoss < state.boss.collisionRadius + ship.radius - 3) {
      if (!hitShip("physical", 2)) {
        setGameOver();
        return;
      }
    }
  }

  for (const hazard of state.edgeHazards) {
    if (!Number.isFinite(hazard.worldX) || !Number.isFinite(hazard.worldY)) {
      const worldPos = screenToWorld(hazard.x, hazard.y);
      hazard.worldX = worldPos.x;
      hazard.worldY = worldPos.y;
    }

    hazard.worldX += hazard.vx * dt;
    hazard.worldY += (hazard.vy || 0) * dt;

    const hazardScreen = projectWorldToScreen(hazard.worldX, hazard.worldY, cameraX, cameraY);
    hazard.x = hazardScreen.x;
    hazard.y = hazardScreen.y;
    hazard.angle += hazard.spin * dt;

    const dShip = Math.hypot((hazard.worldX || hazard.x) - (ship.worldX || ship.x), (hazard.worldY || hazard.y) - (ship.worldY || ship.y));
    if (dShip < hazard.hitRadius + ship.radius - 3) {
      const hazardDamage = hazard.kind === "blackHole" || hazard.kind === "planet" ? 2 : 1;
      if (!hitShip("physical", hazardDamage)) {
        createExplosion(ship.x, ship.y, "#71f4ff", 28);
        setGameOver();
        return;
      }
    }

    if (hazard.kind === "blackHole") {
      const pullX = (hazard.worldX || hazard.x) - (ship.worldX || ship.x);
      const pullY = (hazard.worldY || hazard.y) - (ship.worldY || ship.y);
      const distSq = pullX * pullX + pullY * pullY;
      const minDistSq = Math.max(900, distSq);
      const force = 32000 / minDistSq;
      ship.vx += (pullX / Math.sqrt(minDistSq)) * force * dt;
      ship.vy += (pullY / Math.sqrt(minDistSq)) * force * dt;
    }
  }

  for (const obj of state.objects) {
    for (const hazard of state.edgeHazards) {
      if (circlesOverlap(hazard.x, hazard.y, hazard.hitRadius - 2, obj.x, obj.y, obj.collisionRadius)) {
        destroyObject(obj, "rocket");
        break;
      }
    }
  }

  for (const bullet of state.bullets) {
    ensureEntityWorldPosition(bullet);
    bullet.worldX += bullet.vx * dt;
    bullet.worldY += bullet.vy * dt;
    syncEntityScreenPosition(bullet, cameraX, cameraY);
    bullet.life -= dt;

    if (bullet.life <= 0) continue;
  }

  for (const bullet of state.bullets) {
    if (bullet.life <= 0) continue;

    if (state.bossActive && state.boss && circlesOverlap(state.boss.x, state.boss.y, state.boss.collisionRadius, bullet.x, bullet.y, bullet.radius)) {
      const dmg = computeDamage((bullet.damageBase || state.weapon.cannonEffectiveness), "physical");
      state.boss.hp -= dmg.damage;
      addDamageText(bullet.x, bullet.y - 6, dmg.damage, dmg.crit);
      createExplosion(bullet.x, bullet.y, "#ffe188", 6);
      tryRicochetBullet(bullet, bullet.x - state.boss.x, bullet.y - state.boss.y, bullet.x, bullet.y);
      if (state.boss.hp <= 0) {
        onBossDefeated();
      }
      continue;
    }

    let blockedByHazard = false;
    for (const hazard of state.edgeHazards) {
      if (circlesOverlap(hazard.x, hazard.y, hazard.hitRadius, bullet.x, bullet.y, bullet.radius)) {
        tryRicochetBullet(bullet, bullet.x - hazard.x, bullet.y - hazard.y, bullet.x, bullet.y);
        blockedByHazard = true;
        break;
      }
    }
    if (blockedByHazard) continue;

    for (const obj of state.objects) {
      if (obj.hp <= 0) continue;
      if (!circlesOverlap(obj.x, obj.y, obj.collisionRadius, bullet.x, bullet.y, bullet.radius)) continue;
      if (obj.destructible) {
        const dmg = computeDamage((bullet.damageBase || state.weapon.cannonEffectiveness), "physical");
        obj.hp -= dmg.damage;
        addDamageText(bullet.x, bullet.y - 6, dmg.damage, dmg.crit);
        if (obj.hp <= 0) {
          destroyObject(obj, "shot");
        }
      }
      tryRicochetBullet(bullet, bullet.x - obj.x, bullet.y - obj.y, bullet.x, bullet.y);
      break;
    }
  }

  for (const missile of state.missiles) {
    ensureEntityWorldPosition(missile);
    if (state.weapon.rocketHoming) {
      missile.acquireIn = (missile.acquireIn || 0) - dt;
      let target = missile.targetRef;
      if (!target || target.hp <= 0 || missile.acquireIn <= 0) {
        target = weapons.findNearestObject(missile.worldX, missile.worldY);
        missile.targetRef = target || null;
        missile.acquireIn = 0.12 + Math.random() * 0.08;
      }
      if (target) {
        const targetX = Number.isFinite(target.worldX) ? target.worldX : target.x;
        const targetY = Number.isFinite(target.worldY) ? target.worldY : target.y;
        const dx = targetX - missile.worldX;
        const dy = targetY - missile.worldY;
        const dist = Math.hypot(dx, dy) || 1;
        const desiredVx = (dx / dist) * missile.speed;
        const desiredVy = (dy / dist) * missile.speed;
        missile.vx += (desiredVx - missile.vx) * Math.min(1, missile.turnRate * dt);
        missile.vy += (desiredVy - missile.vy) * Math.min(1, missile.turnRate * dt);
      }
    }

    missile.worldX += missile.vx * dt;
    missile.worldY += missile.vy * dt;
    syncEntityScreenPosition(missile, cameraX, cameraY);
    missile.life -= dt;

    if (state.bossActive && state.boss) {
      if (circlesOverlap(state.boss.x, state.boss.y, state.boss.collisionRadius, missile.x, missile.y, missile.radius)) {
        const blastScale = missile.blastScale || 1;
        weapons.explodeRocketAt(missile.x, missile.y, blastScale);
        const dmg = computeDamage(missile.damageBase || 18, "explosive");
        state.boss.hp -= dmg.damage;
        addDamageText(missile.x, missile.y - 8, dmg.damage, dmg.crit);
        missile.life = 0;
        if (state.boss.hp <= 0) {
          onBossDefeated();
        }
        continue;
      }
    }

    let exploded = false;
    for (const obj of state.objects) {
      if (obj.hp <= 0) continue;
      if (circlesOverlap(obj.x, obj.y, obj.collisionRadius, missile.x, missile.y, missile.radius)) {
        weapons.explodeRocketAt(missile.x, missile.y, missile.blastScale || 1);
        missile.life = 0;
        exploded = true;
        break;
      }
    }

    if (exploded) continue;

    for (const hazard of state.edgeHazards) {
      if (circlesOverlap(hazard.x, hazard.y, hazard.hitRadius, missile.x, missile.y, missile.radius)) {
        weapons.explodeRocketAt(missile.x, missile.y, missile.blastScale || 1);
        missile.life = 0;
        break;
      }
    }
  }

  for (const proj of state.bossProjectiles) {
    ensureEntityWorldPosition(proj);
    proj.worldX += proj.vx * dt;
    proj.worldY += proj.vy * dt;
    syncEntityScreenPosition(proj, cameraX, cameraY);
    proj.life -= dt;

    if (proj.damageType === "explosive") {
      const splashR = proj.radius + 30;
      const dSplash = Math.hypot(proj.x - ship.x, proj.y - ship.y);
      if (dSplash < splashR + ship.radius) {
        proj.life = 0;
        const splashDamage = dSplash < proj.radius + ship.radius ? 2 : 1;
        if (!hitShip("explosive", splashDamage)) {
          setGameOver();
          return;
        }
        createExplosion(proj.x, proj.y, "#ff8f64", 12);
      }
    }

    const dShip = Math.hypot(proj.x - ship.x, proj.y - ship.y);
    if (dShip < proj.radius + ship.radius) {
      proj.life = 0;
      if (!hitShip(proj.damageType || "physical", proj.damageAmount || 1)) {
        setGameOver();
        return;
      }
      if (proj.damageType === "acid") {
        applyAcidToShip(4, 0.9);
        createExplosion(proj.x, proj.y, "#7eff6f", 9);
      }
    }

    for (const bullet of state.bullets) {
      if (bullet.life <= 0) continue;
      const d = Math.hypot(proj.x - bullet.x, proj.y - bullet.y);
      if (d < proj.radius + bullet.radius) {
        proj.life = 0;
        bullet.life = 0;
        break;
      }
    }
  }

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

  for (const pickup of state.pickups) {
    if (!Number.isFinite(pickup.worldX) || !Number.isFinite(pickup.worldY)) {
      const worldPos = screenToWorld(pickup.x, pickup.y);
      pickup.worldX = worldPos.x;
      pickup.worldY = worldPos.y;
    }

    pickup.worldX += pickup.vx * dt;
    pickup.worldY += pickup.vy * dt;

    const pickupScreen = projectWorldToScreen(pickup.worldX, pickup.worldY, cameraX, cameraY);
    pickup.x = pickupScreen.x;
    pickup.y = pickupScreen.y;
    pickup.vx *= 0.985;
    pickup.vy *= 0.985;
    pickup.life -= dt;

    const dShip = Math.hypot(pickup.x - ship.x, pickup.y - ship.y);
    if (dShip < pickup.radius + ship.radius) {
      if (pickup.type === "armor") {
        ship.armor = Math.min(ship.maxArmor, ship.armor + 1);
        createExplosion(pickup.x, pickup.y, "#a5d8ff", 9);
        playSfx("shieldReady");
      }
      pickup.life = 0;
    }
  }

  for (const beam of state.laserBeams) {
    beam.life -= dt;
  }

  for (const burst of state.plasmaBursts) {
    ensureEntityWorldPosition(burst);
    burst.worldX += burst.vx * dt;
    burst.worldY += burst.vy * dt;
    syncEntityScreenPosition(burst, cameraX, cameraY);
    burst.life -= dt;
    burst.radius += burst.growth * dt;
    burst.vx *= 0.975;
    burst.vy *= 0.975;
    burst.rangeLeft -= Math.hypot(burst.vx, burst.vy) * dt;

    if (burst.hitDone || burst.life <= 0 || burst.rangeLeft <= 0) continue;

    if (burst.enemyOwned) {
      const dShip = Math.hypot(ship.x - burst.x, ship.y - burst.y);
      if (dShip < ship.radius + burst.radius) {
        if (!hitShip("heat", 1)) {
          setGameOver();
          return;
        }
        burst.hitDone = true;
        burst.life = Math.min(burst.life, 0.04);
      }
    } else {
      for (const obj of state.objects) {
        if (obj.hp <= 0 || !obj.destructible) continue;
        const d = Math.hypot(obj.x - burst.x, obj.y - burst.y);
        if (d < obj.collisionRadius + burst.radius) {
          applyHeatHit(obj, burst.damage, burst.x, burst.y);
          burst.hitDone = true;
          burst.life = Math.min(burst.life, 0.05);
          break;
        }
      }

      if (!burst.hitDone && state.bossActive && state.boss) {
        const dBoss = Math.hypot(state.boss.x - burst.x, state.boss.y - burst.y);
        if (dBoss < state.boss.collisionRadius + burst.radius) {
          applyHeatHit(state.boss, burst.damage, burst.x, burst.y);
          burst.hitDone = true;
          burst.life = Math.min(burst.life, 0.05);
        }
      }

      if (!burst.hitDone) {
        for (const hazard of state.edgeHazards) {
          const d = Math.hypot(hazard.x - burst.x, hazard.y - burst.y);
          if (d < hazard.hitRadius + burst.radius) {
            burst.hitDone = true;
            burst.life = 0;
            break;
          }
        }
      }
    }
  }

  const worldCullBase = Math.max(WORLD.width, WORLD.height) * 1.7;
  state.objects = state.objects.filter((o) => {
    if (o.hp <= 0) return false;
    if (!Number.isFinite(o.worldX) || !Number.isFinite(o.worldY)) {
      return o.x > -o.size * 2 && o.x < WORLD.width + o.size * 2 && o.y > -o.size * 2 && o.y < WORLD.height + o.size * 2;
    }
    const d = Math.hypot(o.worldX - cameraX, o.worldY - cameraY);
    return d < worldCullBase + o.size * 2;
  });
  state.edgeHazards = state.edgeHazards.filter((h) => {
    if (!Number.isFinite(h.worldX) || !Number.isFinite(h.worldY)) {
      return h.x > -h.radius * 1.3 && h.x < WORLD.width + h.radius * 1.3 && h.y > -h.radius * 1.3 && h.y < WORLD.height + h.radius * 1.3;
    }
    const d = Math.hypot(h.worldX - cameraX, h.worldY - cameraY);
    return d < worldCullBase + h.radius * 1.4;
  });
  state.bullets = state.bullets.filter((b) => {
    if (b.life <= 0) return false;
    if (!Number.isFinite(b.worldX) || !Number.isFinite(b.worldY)) {
      return b.x > -30 && b.x < WORLD.width + 30 && b.y > -30 && b.y < WORLD.height + 30;
    }
    const d = Math.hypot(b.worldX - cameraX, b.worldY - cameraY);
    return d < worldCullBase + 120;
  });
  state.laserBeams = state.laserBeams.filter((b) => b.life > 0);
  state.plasmaBursts = state.plasmaBursts.filter((b) => {
    if (b.life <= 0 || b.rangeLeft <= 0) return false;
    if (!Number.isFinite(b.worldX) || !Number.isFinite(b.worldY)) {
      return b.x > -80 && b.x < WORLD.width + 80 && b.y > -80 && b.y < WORLD.height + 80;
    }
    const d = Math.hypot(b.worldX - cameraX, b.worldY - cameraY);
    return d < worldCullBase + 220;
  });
  state.missiles = state.missiles.filter((m) => {
    if (m.life <= 0) return false;
    if (!Number.isFinite(m.worldX) || !Number.isFinite(m.worldY)) {
      return m.x > -60 && m.x < WORLD.width + 60 && m.y > -60 && m.y < WORLD.height + 60;
    }
    const d = Math.hypot(m.worldX - cameraX, m.worldY - cameraY);
    return d < worldCullBase + 180;
  });
  state.pickups = state.pickups.filter((p) => {
    if (p.life <= 0) return false;
    if (!Number.isFinite(p.worldX) || !Number.isFinite(p.worldY)) {
      return p.x > -60 && p.x < WORLD.width + 60 && p.y > -60 && p.y < WORLD.height + 60;
    }
    const d = Math.hypot(p.worldX - cameraX, p.worldY - cameraY);
    return d < worldCullBase + 120;
  });
  state.bossProjectiles = state.bossProjectiles.filter((p) => {
    if (p.life <= 0) return false;
    if (!Number.isFinite(p.worldX) || !Number.isFinite(p.worldY)) {
      return p.x > -80 && p.x < WORLD.width + 80 && p.y > -80 && p.y < WORLD.height + 80;
    }
    const d = Math.hypot(p.worldX - cameraX, p.worldY - cameraY);
    return d < worldCullBase + 240;
  });
  state.particles = state.particles.filter((p) => p.life > 0);
  state.damageTexts = state.damageTexts.filter((t) => t.life > 0);

  refreshHud();
}

const renderer = createRenderer({
  ctx,
  state,
  input,
  WORLD,
  worldSystem,
  cameraSystem,
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
  },
  onToggleHitboxes: () => {
    state.debugHitboxes = !state.debugHitboxes;
    if (!state.debugHitboxes) {
      state.damageTexts = [];
    }
  },
  onDebugBoostWeapons: () => {
    progression.debugBoostCurrentWeapons(5);
  },
  onToggleBalancePanel: () => {
    balanceDebug.visible = !balanceDebug.visible;
    refreshHud();
  },
  isBalancePanelVisible: () => balanceDebug.visible,
  onBalanceTrackPrev: () => {
    cycleBalanceTrack(-1);
    refreshHud();
  },
  onBalanceTrackNext: () => {
    cycleBalanceTrack(1);
    refreshHud();
  },
  onBalanceTuneDown: () => {
    progression.adjustTrackLevelTuning(selectedBalanceTrack(), -balanceDebug.tuneStep);
    refreshHud();
  },
  onBalanceTuneUp: () => {
    progression.adjustTrackLevelTuning(selectedBalanceTrack(), balanceDebug.tuneStep);
    refreshHud();
  },
  onBalanceTuneReset: () => {
    progression.setTrackLevelTuning(selectedBalanceTrack(), 1);
    refreshHud();
  },
  onToggleShipInfo: () => {
    state.showShipInfo = !state.showShipInfo;
    if (shipInfoPanelEl) {
      shipInfoPanelEl.classList.toggle("hidden", !state.showShipInfo);
    }
  },
  onOverlayAction: handleOverlayAction,
});

menus.showDifficultySelectionMenu();
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
