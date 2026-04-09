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
const { createRenderer } = window.VoidRender;

const state = {
  running: false,
  gameOver: false,
  pauseReason: "menu",
  debugHitboxes: false,
  showShipInfo: false,
  selectedDifficultyId: "medium",
  selectedShipId: "scout",
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
    plasmaArc: 0.24,
    plasmaDamage: 0,
    plasmaBurnDps: 1.1,
    plasmaBurnDuration: 5,
  },
  shield: {
    unlocked: false,
    charges: 0,
    integrity: 0,
    maxCharges: 1,
    rechargeDelay: 10,
    cooldownUntil: 0,
    thorns: false,
    nova: false,
    nextNova: 30,
  },
  upgradesTaken: {},
  pendingUpgradeOptions: [],
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
const WEAPON_UNLOCK_IDS = new Set(["cannon_mount", "shield_core", "laser_emitter", "rocket_launcher", "drill_module", "plasma_emitter"]);

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
      state.weapon.plasmaArc = Math.max(0.12, state.weapon.plasmaArc - 0.03);
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

function shipStartKitText(model) {
  const kit = [];
  if (model.startCannonHalf) {
    kit.push("Geschuetz (50%)");
  } else if (!(model.startShield || model.startLaser || model.startRocket || model.startDrill || model.startPlasma)) {
    kit.push("Geschuetz");
  }
  if (model.startDrill) kit.push("Bohrer");
  if (model.startLaser) kit.push("Laser");
  if (model.startPlasma) kit.push("Plasmawerfer");
  if (model.startShield) kit.push("Schild");
  if (model.startRocket) kit.push("Raketenwerfer");
  return kit.length > 0 ? kit.join(", ") : "Kein Startmodul";
}

function selectedDifficultyMode() {
  return DIFFICULTY_MODES[state.selectedDifficultyId] || DIFFICULTY_MODES.medium;
}

function setPauseIndicatorVisible(visible) {
  if (!pauseIndicatorEl) return;
  pauseIndicatorEl.classList.toggle("hidden", !visible);
  pauseIndicatorEl.classList.toggle("pause", visible);
}

function showDifficultySelectionMenu() {
  state.running = false;
  state.pauseReason = "difficulty-select";
  setPauseIndicatorVisible(false);

  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <h1>Void Runner</h1>
    <p>Waehle den Schwierigkeitsgrad</p>
    <div style="display:grid;gap:10px;width:min(92vw,720px)">
      <button data-action="select-difficulty" data-difficulty-id="easy" style="width:100%;max-width:720px;text-align:left;line-height:1.4;white-space:normal;word-break:break-word;">
        <strong>Einfach</strong><br />
        <span>Langsamere Objekte, weniger Spawn, +50% HP.</span>
      </button>
      <button data-action="select-difficulty" data-difficulty-id="medium" style="width:100%;max-width:720px;text-align:left;line-height:1.4;white-space:normal;word-break:break-word;">
        <strong>Mittel</strong><br />
        <span>Empfohlene Standardwerte.</span>
      </button>
      <button data-action="select-difficulty" data-difficulty-id="hard" style="width:100%;max-width:720px;text-align:left;line-height:1.4;white-space:normal;word-break:break-word;">
        <strong>Schwierig</strong><br />
        <span>Schnellere Gegner, mehr Spawn-Druck, haertere Bosse.</span>
      </button>
    </div>
  `;
}

function showShipSelectionMenu() {
  state.running = false;
  state.pauseReason = "ship-select";
  setPauseIndicatorVisible(false);
  const diff = selectedDifficultyMode();

  const shipButtons = Object.values(SHIP_MODELS)
    .map(
      (model) => `
      <button data-action="select-ship" data-ship-id="${model.id}" style="width:100%;max-width:740px;text-align:left;line-height:1.4;white-space:normal;word-break:break-word;">
        <strong>${model.name} (${model.role})</strong><br />
        <span>HP ${model.maxHp} | ARM ${model.maxArmor} | Speed ${Math.round(model.speed * 100)}% | Krit ${Math.round(model.critChance * 100)}% | Krit-DMG ${Math.round(model.critDamage * 100)}% | Reload ${Math.round(model.reloadRate * 100)}% | XP ${Math.round(model.xpBonus * 100)}%</span><br />
        <span>Start: ${shipStartKitText(model)}</span>
      </button>
    `,
    )
    .join("");

  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <h1>Void Runner</h1>
    <p>Schwierigkeit: <strong>${diff.title}</strong></p>
    <p>Waehle dein Raumschiff</p>
    <div style="display:grid;gap:10px;width:min(92vw,740px)">
      ${shipButtons}
    </div>
    <p style="margin-top:10px;">Steuerung: WASD/Pfeile, LMB/Space = Geschuetz, RMB = Rakete</p>
  `;
}

function reloadRate() {
  return state.shipStats ? state.shipStats.reloadRate : 1;
}

function effectiveRocketCooldown() {
  return state.weapon.rocketCooldown / reloadRate();
}

function effectiveCannonCooldown() {
  return state.shotCooldown / reloadRate();
}

function effectiveLaserCooldown() {
  return state.weapon.laserCooldown / reloadRate();
}

function effectivePlasmaCooldown() {
  return state.weapon.plasmaCooldown / reloadRate();
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
    state.ship.invulnUntil = state.time + 0.35;
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
  state.ship.invulnUntil = state.time + 0.9;
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
  state.score += base * scoreMultiplier() * xp;
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
  const elapsed = Math.max(1, state.time - state.lastLevelTime);
  const gained = Math.max(1, state.score - state.lastLevelScore);
  const scoreRate = gained / elapsed;

  // Good runs should level closer to 30s, slower runs closer to 60s.
  const perf = Math.max(0, Math.min(2.2, scoreRate / 28));
  const targetSeconds = Math.max(30, Math.min(60, 60 - perf * 15));

  const dynamicCost = Math.floor(scoreRate * targetSeconds);
  const exponentialBase = Math.floor(state.levelCost * 1.14 + 18);
  const blended = Math.floor(exponentialBase * 0.45 + dynamicCost * 0.55);

  const minBound = state.levelCost + 14;
  const maxBound = Math.floor(state.levelCost * 1.45 + 90);
  return Math.max(minBound, Math.min(maxBound, blended));
}

function chooseBossRewards() {
  const pool = BOSS_LOOT_DEFS.filter((loot) => {
    const stacks = state.bossLootTaken[loot.id] || 0;
    return !loot.maxStacks || stacks < loot.maxStacks;
  });

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, Math.min(3, pool.length));
}

function showBossRewardChoice() {
  state.running = false;
  state.pauseReason = "bossreward";
  state.bossRewardPending = true;
  state.pendingBossRewards = chooseBossRewards();
  setPauseIndicatorVisible(false);

  if (state.pendingBossRewards.length === 0) {
    state.bossRewardPending = false;
    state.pauseReason = "running";
    state.running = true;
    overlay.classList.add("hidden");
    return;
  }

  const cards = state.pendingBossRewards
    .map(
      (u) => `
        <button data-action="boss-reward" data-reward-id="${u.id}" style="width:100%;max-width:560px;text-align:left;display:block;line-height:1.4;white-space:normal;word-break:break-word;">
          <strong>${u.title}</strong><br />
          <span>${u.description}</span>
        </button>
      `,
    )
    .join("<div style='height:8px'></div>");

  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <h1>Boss-Loot</h1>
    <p>Waehle 1 Belohnung</p>
    <div style="width:min(92vw,620px)">${cards}</div>
  `;
}

function applyBossReward(id) {
  const reward = BOSS_LOOT_DEFS.find((r) => r.id === id);
  if (!reward) return;

  const stacks = state.bossLootTaken[id] || 0;
  if (reward.maxStacks && stacks >= reward.maxStacks) return;

  state.bossLootTaken[id] = stacks + 1;
  reward.apply();

  state.bossRewardPending = false;
  state.pendingBossRewards = [];
  state.pauseReason = "running";
  state.running = true;
  overlay.classList.add("hidden");
}

function weightedPick(options) {
  const total = options.reduce((sum, opt) => {
    const base = UPGRADE_WEIGHTS[opt.id] || 1;
    const rareBoost = state.level >= 12 ? 1 + Math.min(0.9, (state.level - 11) * 0.06) : 1;
    return sum + (base < 3 ? base * rareBoost : base);
  }, 0);

  if (total <= 0) return null;

  let roll = Math.random() * total;
  for (const opt of options) {
    const base = UPGRADE_WEIGHTS[opt.id] || 1;
    const rareBoost = state.level >= 12 ? 1 + Math.min(0.9, (state.level - 11) * 0.06) : 1;
    const w = base < 3 ? base * rareBoost : base;
    roll -= w;
    if (roll <= 0) return opt;
  }
  return options[options.length - 1] || null;
}

function spawnBoss(level) {
  const difficulty = selectedDifficultyMode();
  const variant = randomFrom(BOSS_VARIANTS);
  const size = 96 + Math.min(70, level * 1.8);
  const hp = Math.floor((140 + level * 28 + Math.pow(level, 1.15) * 6) * difficulty.bossHpMult);
  const hasPhases = Math.random() < 0.78;
  const hasMinions = Math.random() < 0.74;
  const hasLoot = Math.random() < 0.68;

  const thresholds = [0.72 + Math.random() * 0.08, 0.38 + Math.random() * 0.12].sort((a, b) => b - a);

  state.boss = {
    variant,
    x: WORLD.width * 0.78,
    y: WORLD.height * 0.5,
    baseY: WORLD.height * 0.5,
    size,
    collisionRadius: size * 0.72,
    hp,
    maxHp: hp,
    phase: 0,
    phaseStage: 0,
    phaseThresholds: thresholds,
    hasPhases,
    hasMinions,
    hasLoot,
    intro: true,
    introMaxUntil: state.time + 8,
    warningUntil: state.time + 2.8,
    lastWarningBeep: state.time - 1,
    fireCooldown: Math.max(0.55, (1.35 - level * 0.03) / difficulty.bossAggroMult),
    lastFire: state.time,
    minionCooldown: (3.8 + Math.random() * 1.4) / difficulty.bossAggroMult,
    lastMinionSpawn: state.time,
  };

  state.bossActive = true;
  state.bossProjectiles = [];

  // Transition: keep current objects so they naturally leave the screen.
  // New spawns are already paused while bossActive is true.

  createExplosion(state.boss.x, state.boss.y, "#ff8e4f", 42);
  playSfx("levelup");
}

function onBossDefeated() {
  if (!state.bossActive || !state.boss) return;
  const guaranteedLoot = state.boss.hasLoot;
  createExplosion(state.boss.x, state.boss.y, "#ff7b4a", 64);
  addPoints(220 + state.level * 20);
  state.bossActive = false;
  state.boss = null;
  state.bossProjectiles = [];
  state.bossLevelsCleared += 1;
  playSfx("explosion");

  if (guaranteedLoot) {
    showBossRewardChoice();
    return;
  }

  if (Math.random() < 0.42) {
    showBossRewardChoice();
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
  state.levelCost = 100;
  state.nextLevelScore = 100;
  state.lastLevelScore = 0;
  state.lastLevelTime = 0;
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
  state.weapon.plasmaArc = 0.24;
  state.weapon.plasmaDamage = 0;
  state.weapon.plasmaBurnDps = 1.1;
  state.weapon.plasmaBurnDuration = 5;

  state.shield.unlocked = false;
  state.shield.charges = 0;
  state.shield.integrity = 0;
  state.shield.maxCharges = 1;
  state.shield.rechargeDelay = 10 * model.shieldRechargeMult;
  state.shield.cooldownUntil = 0;
  state.shield.thorns = false;
  state.shield.nova = false;
  state.shield.nextNova = 30;

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
    x: WORLD.width * 0.2,
    y: WORLD.height * 0.5,
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

function canOfferUpgrade(def) {
  if (!def.canOffer()) return false;
  const stacks = state.upgradesTaken[def.id] || 0;
  if (def.maxStacks && stacks >= def.maxStacks) return false;
  return true;
}

function isStatUpgrade(def) {
  return def.id.startsWith("stat_");
}

function isWeaponUpgrade(def) {
  return !isStatUpgrade(def);
}

function isWeaponUnlockUpgrade(def) {
  return WEAPON_UNLOCK_IDS.has(def.id);
}

function chooseUpgradeOptions() {
  const pool = UPGRADE_DEFS.filter(canOfferUpgrade);
  const picked = [];
  const statPool = pool.filter((u) => isStatUpgrade(u));
  const weaponPool = pool.filter((u) => isWeaponUpgrade(u));

  // One weapon card: either a new weapon unlock or an upgrade for already owned weapon systems.
  const preferredWeaponPool = weaponPool;

  if (preferredWeaponPool.length > 0) {
    const weaponChoice = weightedPick(preferredWeaponPool);
    if (weaponChoice) {
      picked.push(weaponChoice);
      const wIdx = weaponPool.findIndex((u) => u.id === weaponChoice.id);
      if (wIdx >= 0) weaponPool.splice(wIdx, 1);
    }
  }

  while (statPool.length > 0 && picked.filter((u) => isStatUpgrade(u)).length < 2 && picked.length < 3) {
    const statChoice = weightedPick(statPool);
    if (!statChoice) break;
    picked.push(statChoice);
    const sIdx = statPool.findIndex((u) => u.id === statChoice.id);
    if (sIdx >= 0) statPool.splice(sIdx, 1);
  }

  const fallbackPool = pool.filter((u) => !picked.some((p) => p.id === u.id));
  while (fallbackPool.length > 0 && picked.length < 3) {
    const choice = weightedPick(fallbackPool);
    if (!choice) break;
    picked.push(choice);
    const idx = fallbackPool.findIndex((u) => u.id === choice.id);
    if (idx >= 0) fallbackPool.splice(idx, 1);
  }

  return picked.slice(0, 3);
}

function showLevelUpChoice() {
  state.running = false;
  state.levelUpPending = true;
  state.pauseReason = "levelup";

  state.pendingUpgradeOptions = chooseUpgradeOptions();

  if (state.pendingUpgradeOptions.length === 0) {
    // Safety fallback if all upgrades are exhausted.
    state.shotCooldown = Math.max(0.05, state.shotCooldown * 0.93);
    finishLevelUp();
    return;
  }

  overlay.classList.remove("hidden");

  const cards = state.pendingUpgradeOptions
    .map(
      (u) => `
        <button data-action="upgrade" data-upgrade-id="${u.id}" style="width:100%;max-width:560px;text-align:left;display:block;line-height:1.4;white-space:normal;word-break:break-word;">
          <strong>[${isStatUpgrade(u) ? "Stat" : "Waffe"}] ${u.title}</strong><br />
          <span>${u.description}</span>
        </button>
      `,
    )
    .join("<div style='height:8px'></div>");

  overlay.innerHTML = `
    <h1>Level ${state.level + 1}</h1>
    <p>Waehle 1 Upgrade</p>
    <div style="width:min(92vw,620px)">${cards}</div>
  `;

  playSfx("levelup");
}

function finishLevelUp() {
  state.level += 1;
  state.levelCost = computeNextLevelCost();
  state.nextLevelScore += state.levelCost;
  state.lastLevelScore = state.score;
  state.lastLevelTime = state.time;
  state.levelUpPending = false;
  state.pauseReason = "running";
  state.running = true;
  overlay.classList.add("hidden");

  if (state.level % 10 === 0) {
    spawnBoss(state.level);
  }

  refreshHud();
}

function applyUpgrade(id) {
  const upgrade = UPGRADE_DEFS.find((u) => u.id === id);
  if (!upgrade) return;
  if (!canOfferUpgrade(upgrade)) return;

  state.upgradesTaken[id] = (state.upgradesTaken[id] || 0) + 1;
  upgrade.apply();
  finishLevelUp();
}

function nextObjectId() {
  const id = state.objectIdCounter;
  state.objectIdCounter += 1;
  return id;
}

function spawnObject() {
  const difficulty = selectedDifficultyMode();
  const alienShipChance = difficulty.id === "easy" ? 0.06 : difficulty.id === "hard" ? 0.18 : 0.12;
  const miniAlienChance = difficulty.id === "easy" ? 0.11 : difficulty.id === "hard" ? 0.15 : 0.13;
  const firstCut = miniAlienChance;
  const secondCut = firstCut + alienShipChance;

  const r = Math.random();
  let type = "debris";
  let size = 30;
  let hp = 999;
  let destructible = false;
  let collisionScale = 0.8;
  let corners = 8;

  if (r < firstCut) {
    type = "miniAlien";
    size = 14 + Math.random() * 10;
    hp = 3;
    destructible = true;
    collisionScale = 0.7;
    corners = 0;
  } else if (r < secondCut) {
    type = "alienShip";
    size = 20 + Math.random() * 10;
    hp = 6;
    destructible = true;
    collisionScale = 0.74;
    corners = 0;
  } else if (r < 0.42) {
    type = "smallRock";
    size = 11 + Math.random() * 12;
    hp = 3;
    destructible = true;
    collisionScale = 0.78;
    corners = 8;
  } else if (r < 0.66) {
    type = "mediumRock";
    size = 24 + Math.random() * 14;
    hp = 5;
    destructible = true;
    collisionScale = 0.8;
    corners = 9;
  } else if (r < 0.79) {
    type = "debris";
    size = 22 + Math.random() * 18;
    collisionScale = 0.76;
    corners = 8;
  } else {
    type = "boulder";
    size = 36 + Math.random() * 28;
    collisionScale = 0.82;
    corners = 11;
  }

  let y = size + Math.random() * (WORLD.height - size * 2);
  if (Math.random() < 0.58) {
    if (Math.random() < 0.5) {
      y = size + Math.random() * (WORLD.height * 0.2);
    } else {
      y = WORLD.height - size - Math.random() * (WORLD.height * 0.2);
    }
  }

  const vx = -(WORLD.scrollSpeed + Math.random() * 120) * difficulty.objectSpeedMult;
  const vy = (Math.random() - 0.5) * 70 * difficulty.objectSpeedMult;
  const rockProfile = corners > 0 ? Array.from({ length: corners }, () => 0.72 + Math.random() * 0.26) : null;

  state.objects.push({
    id: nextObjectId(),
    type,
    x: WORLD.width + size + 20,
    y,
    vx,
    vy,
    size,
    hp,
    destroyed: false,
    destructible,
    collisionRadius: size * collisionScale,
    corners,
    rockProfile,
    spin: (Math.random() - 0.5) * 2,
    angle: Math.random() * Math.PI * 2,
    passed: false,
    nextShotAt: type === "miniAlien" ? state.time + 1.2 + Math.random() * 2.4 : type === "alienShip" ? state.time + 1.4 + Math.random() * 2.2 : null,
  });
}

function spawnEdgeHazard() {
  const difficulty = selectedDifficultyMode();
  const side = Math.random() < 0.5 ? "top" : "bottom";
  const r = Math.random();

  if (r < 0.36) {
    const radius = 270 + Math.random() * 150;
    const cy = side === "top" ? -radius * 0.68 : WORLD.height + radius * 0.68;
    state.edgeHazards.push({
      kind: "planet",
      side,
      x: WORLD.width + radius + 40,
      y: cy,
      radius,
      hitRadius: radius * 0.93,
      vx: -(WORLD.scrollSpeed * (0.84 + Math.random() * 0.22) * difficulty.edgeSpeedMult),
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.12,
    });
    return;
  }

  if (r < 0.72) {
    const radius = 48 + Math.random() * 22;
    const y = side === "top" ? radius + 8 : WORLD.height - radius - 8;
    state.edgeHazards.push({
      kind: "station",
      side,
      x: WORLD.width + radius + 20,
      y,
      radius,
      hitRadius: radius * 0.66,
      vx: -(WORLD.scrollSpeed * (1 + Math.random() * 0.25) * difficulty.edgeSpeedMult),
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.4,
    });
    return;
  }

  const radius = 44 + Math.random() * 18;
  const y = side === "top" ? radius + 10 : WORLD.height - radius - 10;
  state.edgeHazards.push({
    kind: "blackHole",
    side,
    x: WORLD.width + radius + 20,
    y,
    radius,
    hitRadius: radius * 0.6,
    vx: -(WORLD.scrollSpeed * (0.92 + Math.random() * 0.22) * difficulty.edgeSpeedMult),
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.8,
  });
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
    if (obj.type === "miniAlien") addPoints(18);
    else if (obj.type === "mediumRock") addPoints(20);
    else addPoints(12);
  }

  if (reason === "rocket") {
    state.kills += 1;
    if (obj.type === "boulder") addPoints(55);
    else if (obj.type === "debris") addPoints(30);
    else if (obj.type === "miniAlien") addPoints(24);
    else addPoints(18);
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
    damageNearbyFromShieldPulse(105, false);
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
  createExplosion(tipX, tipY, "#8ef7ff", 16);
  playSfx("shieldHit");
  return true;
}

function getRocketCooldownLeft() {
  if (!state.weapon.rocketUnlocked) return 0;
  return Math.max(0, state.weapon.rocketCooldown - (state.realNow - state.weapon.lastRocketRealShot));
}

function rayCircleHitDistance(ox, oy, dx, dy, cx, cy, r, maxRange) {
  const lx = cx - ox;
  const ly = cy - oy;
  const tca = lx * dx + ly * dy;
  if (tca < 0 || tca > maxRange) return null;
  const d2 = lx * lx + ly * ly - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return null;
  const thc = Math.sqrt(Math.max(0, r2 - d2));
  const t0 = tca - thc;
  const t1 = tca + thc;
  if (t0 >= 0 && t0 <= maxRange) return t0;
  if (t1 >= 0 && t1 <= maxRange) return t1;
  return null;
}

function fireLaserPulse(now) {
  if (!state.weapon.laserUnlocked) return;
  if (now - state.weapon.lastLaserShot < effectiveLaserCooldown()) return;

  state.weapon.lastLaserShot = now;

  const ox = state.ship.x;
  const oy = state.ship.y;
  const dxRaw = input.mouseX - ox;
  const dyRaw = input.mouseY - oy;
  const len = Math.hypot(dxRaw, dyRaw) || 1;
  const dx = dxRaw / len;
  const dy = dyRaw / len;
  const maxRange = state.weapon.laserRange;

  const candidates = [];

  for (const obj of state.objects) {
    if (obj.hp <= 0) continue;
    const t = rayCircleHitDistance(ox, oy, dx, dy, obj.x, obj.y, obj.collisionRadius, maxRange);
    if (t === null) continue;
    candidates.push({ t, kind: "object", ref: obj });
  }

  if (state.bossActive && state.boss) {
    const t = rayCircleHitDistance(ox, oy, dx, dy, state.boss.x, state.boss.y, state.boss.collisionRadius, maxRange);
    if (t !== null) {
      candidates.push({ t, kind: "boss", ref: state.boss });
    }
  }

  for (const hazard of state.edgeHazards) {
    const t = rayCircleHitDistance(ox, oy, dx, dy, hazard.x, hazard.y, hazard.hitRadius, maxRange);
    if (t === null) continue;
    candidates.push({ t, kind: "hazard", ref: hazard });
  }

  candidates.sort((a, b) => a.t - b.t);

  let remainingPierce = state.weapon.laserPierce;
  let beamEnd = maxRange;
  const hitColor = "#8ef7ff";

  for (const hit of candidates) {
    if (remainingPierce <= 0) break;
    beamEnd = Math.min(beamEnd, hit.t);

    if (hit.kind === "boss") {
      const dmg = computeDamage(state.weapon.laserDamage, "energy");
      hit.ref.hp -= dmg.damage;
      addDamageText(ox + dx * hit.t, oy + dy * hit.t - 6, dmg.damage, dmg.crit);
      createExplosion(ox + dx * hit.t, oy + dy * hit.t, hitColor, 7);
      if (hit.ref.hp <= 0) {
        onBossDefeated();
      }
      remainingPierce -= 1;
      continue;
    }

    if (hit.kind === "object") {
      if (hit.ref.destructible) {
        const dmg = computeDamage(state.weapon.laserDamage, "energy");
        hit.ref.hp -= dmg.damage;
        addDamageText(ox + dx * hit.t, oy + dy * hit.t - 6, dmg.damage, dmg.crit);
        if (hit.ref.hp <= 0) {
          destroyObject(hit.ref, "shot");
        }
      }
      createExplosion(ox + dx * hit.t, oy + dy * hit.t, hitColor, 6);
      remainingPierce -= 1;
      continue;
    }

    // Hazards absorb the beam and stop it.
    beamEnd = hit.t;
    remainingPierce = 0;
  }

  state.laserBeams.push({
    x1: ox,
    y1: oy,
    x2: ox + dx * beamEnd,
    y2: oy + dy * beamEnd,
    life: 0.09,
    width: 2.3 + state.weapon.laserDamage * 0.35,
  });

  playSfx("plasma");
}

function firePlasmaPulse(now) {
  if (!state.weapon.plasmaUnlocked) return;
  if (now - state.weapon.lastPlasmaShot < effectivePlasmaCooldown()) return;

  state.weapon.lastPlasmaShot = now;

  const ox = state.ship.x;
  const oy = state.ship.y;
  const dxRaw = input.mouseX - ox;
  const dyRaw = input.mouseY - oy;
  const aim = Math.atan2(dyRaw, dxRaw);
  const pellets = 6;
  for (let i = 0; i < pellets; i += 1) {
    const t = pellets <= 1 ? 0 : i / (pellets - 1);
    const spread = (t - 0.5) * state.weapon.plasmaArc * 2;
    const a = aim + spread + (Math.random() - 0.5) * 0.04;
    const speed = 380 + Math.random() * 170;
    const life = 0.72 + Math.random() * 0.3;
    state.plasmaBursts.push({
      x: ox,
      y: oy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life,
      maxLife: life,
      radius: 2.8 + Math.random() * 0.9,
      growth: 22 + Math.random() * 14,
      damage: state.weapon.plasmaDamage,
      rangeLeft: state.weapon.plasmaRange,
      hitDone: false,
    });
  }

  playSfx("plasma");
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

function shootAtCursor(now) {
  if (state.weapon.cannonUnlocked && now - state.lastShot >= effectiveCannonCooldown()) {
    state.lastShot = now;

    const channels = 1 + state.weapon.extraLasers;
    const baseDx = input.mouseX - state.ship.x;
    const baseDy = input.mouseY - state.ship.y;
    const baseLen = Math.hypot(baseDx, baseDy) || 1;
    const ux = baseDx / baseLen;
    const uy = baseDy / baseLen;

    const perpX = -uy;
    const perpY = ux;

    for (let i = 0; i < channels; i += 1) {
      const indexOffset = i - (channels - 1) / 2;
      const offset = indexOffset * state.weapon.laserSpread;
      const sx = state.ship.x + perpX * offset;
      const sy = state.ship.y + perpY * offset;

      state.bullets.push({
        x: sx,
        y: sy,
        vx: ux * 820,
        vy: uy * 820,
        life: 1.25,
        radius: 3.5,
      });
    }

    playSfx("cannon");
  }

  // Side weapons can fire independently of cannon mount.
  fireLaserPulse(now);
  firePlasmaPulse(now);
}

function fireRocket(now) {
  if (!state.weapon.rocketUnlocked) return;
  if (getRocketCooldownLeft() > 0) return;

  state.weapon.lastRocketShot = now;
  state.weapon.lastRocketRealShot = state.realNow;

  const dx = input.mouseX - state.ship.x;
  const dy = input.mouseY - state.ship.y;
  const baseAngle = Math.atan2(dy, dx);
  const offsets = state.weapon.rocketSplit ? [-0.18, 0, 0.18] : [0];

  for (const off of offsets) {
    const a = baseAngle + off;
    state.missiles.push({
      x: state.ship.x,
      y: state.ship.y,
      vx: Math.cos(a) * 380,
      vy: Math.sin(a) * 380,
      speed: 380,
      life: 4,
      radius: 6,
      turnRate: 2.6,
      targetRef: null,
      acquireIn: 0,
    });
  }

  playSfx("rocket");
}

function findNearestObject(x, y) {
  let best = null;
  let bestDistSq = Infinity;
  for (const obj of state.objects) {
    if (obj.hp <= 0) continue;
    const dx = obj.x - x;
    const dy = obj.y - y;
    const dSq = dx * dx + dy * dy;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = obj;
    }
  }
  return best;
}

function explodeRocketAt(x, y) {
  const radius = state.weapon.rocketBlastRadius;

  for (const obj of state.objects) {
    if (obj.hp <= 0) continue;
    const d = Math.hypot(obj.x - x, obj.y - y);
    if (d > radius + obj.collisionRadius) continue;

    if (obj.destructible || obj.type === "boulder" || obj.type === "debris") {
      destroyObject(obj, "rocket");
    }
  }

  createExplosion(x, y, "#ff9652", 30);
  playSfx("explosion");
}

function spawnBossMinion(boss) {
  let type = "miniAlien";
  let size = 16;
  let hp = 2;
  let corners = 0;
  let destructible = true;
  let collisionRadius = 12;

  if (boss.variant === "warship") {
    type = "smallRock";
    size = 18 + Math.random() * 8;
    corners = 8;
    hp = 2;
    collisionRadius = size * 0.76;
  } else if (boss.variant === "carrier") {
    type = "mediumRock";
    size = 20 + Math.random() * 10;
    corners = 9;
    hp = 2;
    collisionRadius = size * 0.8;
  }

  const yOffset = (Math.random() - 0.5) * boss.size * 0.95;
  const rockProfile = corners > 0 ? Array.from({ length: corners }, () => 0.72 + Math.random() * 0.26) : null;

  state.objects.push({
    id: nextObjectId(),
    type,
    x: boss.x - boss.size * 0.42,
    y: boss.y + yOffset,
    vx: -(210 + Math.random() * 110),
    vy: (Math.random() - 0.5) * 95,
    size,
    hp,
    destroyed: false,
    destructible,
    collisionRadius,
    corners,
    rockProfile,
    spin: (Math.random() - 0.5) * 2,
    angle: Math.random() * Math.PI * 2,
    passed: true,
    nextShotAt: type === "miniAlien" ? state.time + 1 + Math.random() * 2 : null,
  });
}

function spawnEnemyProjectile(fromX, fromY, toX, toY, speed, damageType, damageAmount = 1) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const radius = damageType === "energy" ? 8 : damageType === "explosive" ? 9 : damageType === "acid" ? 7.5 : 7;
  state.bossProjectiles.push({
    x: fromX,
    y: fromY,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    life: 6,
    radius,
    damageType,
    damageAmount,
  });
}

function spawnEnemyFlameBurst(fromX, fromY, toX, toY) {
  const aim = Math.atan2(toY - fromY, toX - fromX);
  const pellets = 5;
  for (let i = 0; i < pellets; i += 1) {
    const t = pellets <= 1 ? 0 : i / (pellets - 1);
    const spread = (t - 0.5) * 0.55;
    const a = aim + spread + (Math.random() - 0.5) * 0.06;
    const speed = 230 + Math.random() * 130;
    const life = 0.42 + Math.random() * 0.32;
    state.plasmaBursts.push({
      x: fromX,
      y: fromY,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life,
      maxLife: life,
      radius: 2.8 + Math.random() * 1,
      growth: 34 + Math.random() * 24,
      damage: 1,
      rangeLeft: 115,
      hitDone: false,
      enemyOwned: true,
    });
  }
}

function updateBoss(dt) {
  if (!state.bossActive || !state.boss) return;

  const difficulty = selectedDifficultyMode();
  const boss = state.boss;
  boss.phase += dt;

  if (boss.intro) {
    if (state.time - boss.lastWarningBeep >= 0.9) {
      boss.lastWarningBeep = state.time;
      playSfx("warning");
    }

    const arenaClear = state.objects.length === 0 && state.edgeHazards.length === 0;
    if (arenaClear || state.time >= boss.introMaxUntil) {
      boss.intro = false;
      boss.lastFire = state.time;
      boss.lastMinionSpawn = state.time;
    } else {
      return;
    }
  }

  if (boss.variant === "tentacle") {
    boss.y = boss.baseY + Math.sin(boss.phase * 1.4) * 125;
  } else if (boss.variant === "warship") {
    boss.y = boss.baseY + Math.sin(boss.phase * 0.85) * 170;
  } else {
    boss.y = boss.baseY + Math.sin(boss.phase * 1.1) * 95;
    boss.x = WORLD.width * 0.8 + Math.sin(boss.phase * 0.45) * 30;
  }

  boss.y = Math.max(boss.size * 0.65, Math.min(WORLD.height - boss.size * 0.65, boss.y));

  if (boss.hasPhases) {
    const hpPct = boss.hp / boss.maxHp;
    if (boss.phaseStage < boss.phaseThresholds.length && hpPct <= boss.phaseThresholds[boss.phaseStage]) {
      boss.phaseStage += 1;
      boss.fireCooldown = Math.max(0.3, boss.fireCooldown * 0.82);
      boss.minionCooldown = Math.max(1.4, boss.minionCooldown * 0.86);
      createExplosion(boss.x, boss.y, "#ff6e5f", 26);
      playSfx("levelup");
    }
  }

  if (boss.hasMinions && state.time - boss.lastMinionSpawn >= boss.minionCooldown) {
    boss.lastMinionSpawn = state.time;
    const count = boss.variant === "carrier" ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      spawnBossMinion(boss);
    }
  }

  if (state.time - boss.lastFire >= boss.fireCooldown) {
    boss.lastFire = state.time;
    const shots = boss.variant === "carrier" ? 3 : 2;
    const damageType = boss.variant === "warship" ? "physical" : "energy";
    for (let i = 0; i < shots; i += 1) {
      const spread = (i - (shots - 1) / 2) * 0.24;
      const dx = state.ship.x - boss.x;
      const dy = state.ship.y - boss.y;
      const a = Math.atan2(dy, dx) + spread;
      const speed = (boss.variant === "warship" ? 300 : 260) * difficulty.enemyProjectileSpeedMult;
      const bossDamage = 2;
      spawnEnemyProjectile(
        boss.x - boss.size * 0.38,
        boss.y,
        boss.x - boss.size * 0.38 + Math.cos(a) * 100,
        boss.y + Math.sin(a) * 100,
        speed,
        damageType,
        bossDamage,
      );
    }
  }
}

function update(dt, now) {
  if (!state.running) return;

  const difficulty = selectedDifficultyMode();

  state.time += dt;
  state.score += dt * (7 + state.level * 0.45) * passiveScoreMultiplier();

  if (state.score >= state.nextLevelScore && !state.levelUpPending && !state.bossActive) {
    showLevelUpChoice();
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

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  if (ship.x < ship.radius) {
    ship.x = ship.radius;
    ship.vx *= -0.75;
  }
  if (ship.x > WORLD.width - ship.radius) {
    ship.x = WORLD.width - ship.radius;
    ship.vx *= -0.75;
  }
  if (ship.y < ship.radius) {
    ship.y = ship.radius;
    ship.vy *= -0.75;
  }
  if (ship.y > WORLD.height - ship.radius) {
    ship.y = WORLD.height - ship.radius;
    ship.vy *= -0.75;
  }

  const desktopAutoShooting = state.desktopAutoFire && !IS_COARSE_POINTER && state.mouseInCanvas;
  if (input.shooting || desktopAutoShooting) shootAtCursor(now);

  if (input.rocketQueued) {
    fireRocket(now);
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
    const intensity = spawnIntensity();

    state.lastSpawn += dt;
    const dynamicSpawn = Math.max(0.24, state.spawnInterval / (intensity * difficulty.spawnRateMult));
    while (state.lastSpawn >= dynamicSpawn) {
      state.lastSpawn -= dynamicSpawn;
      spawnObject();
    }

    state.lastEdgeSpawn += dt;
    const dynamicEdgeSpawn = Math.max(0.86, state.edgeSpawnInterval / Math.max(1, intensity * 0.82 * difficulty.edgeSpawnRateMult));
    while (state.lastEdgeSpawn >= dynamicEdgeSpawn) {
      state.lastEdgeSpawn -= dynamicEdgeSpawn;
      spawnEdgeHazard();
    }
  }

  updateBoss(dt);

  for (const star of state.stars) {
    star.x -= star.speed * dt;
    if (star.x < -4) {
      star.x = WORLD.width + Math.random() * 50;
      star.y = Math.random() * WORLD.height;
    }
  }

  for (const obj of state.objects) {
    obj.x += obj.vx * dt;
    obj.y += obj.vy * dt;
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

    if (obj.y < obj.size || obj.y > WORLD.height - obj.size) {
      obj.vy *= -1;
    }

    if (!obj.passed && obj.x + obj.size < ship.x) {
      obj.passed = true;
      addPoints(obj.destructible ? 6 : 12);
    }

    if (obj.type === "miniAlien" && obj.nextShotAt !== null && state.time >= obj.nextShotAt) {
      const spread = (Math.random() - 0.5) * 18;
      if (Math.random() < 0.62) {
        spawnEnemyProjectile(obj.x, obj.y, ship.x + spread, ship.y + spread * 0.4, 235, "acid", 1);
      } else {
        spawnEnemyFlameBurst(obj.x, obj.y, ship.x + spread, ship.y + spread * 0.4);
      }
      obj.nextShotAt = state.time + 1.7 + Math.random() * 1.8;
    }

    if (obj.type === "alienShip" && obj.nextShotAt !== null && state.time >= obj.nextShotAt) {
      const spread = (Math.random() - 0.5) * 22;
      if (Math.random() < 0.66) {
        spawnEnemyProjectile(obj.x, obj.y, ship.x + spread, ship.y + spread * 0.5, 280, "energy", 1);
      } else {
        spawnEnemyProjectile(obj.x, obj.y, ship.x + spread, ship.y + spread * 0.5, 220, "explosive", 2);
      }
      obj.nextShotAt = state.time + 1.35 + Math.random() * 1.45;
    }

    const d = Math.hypot(obj.x - ship.x, obj.y - ship.y);
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

    const dBoss = Math.hypot(state.boss.x - ship.x, state.boss.y - ship.y);
    if (dBoss < state.boss.collisionRadius + ship.radius - 3) {
      if (!hitShip("physical", 2)) {
        setGameOver();
        return;
      }
    }
  }

  for (const hazard of state.edgeHazards) {
    hazard.x += hazard.vx * dt;
    hazard.angle += hazard.spin * dt;

    const dShip = Math.hypot(hazard.x - ship.x, hazard.y - ship.y);
    if (dShip < hazard.hitRadius + ship.radius - 3) {
      const hazardDamage = hazard.kind === "blackHole" || hazard.kind === "planet" ? 2 : 1;
      if (!hitShip("physical", hazardDamage)) {
        createExplosion(ship.x, ship.y, "#71f4ff", 28);
        setGameOver();
        return;
      }
    }

    if (hazard.kind === "blackHole") {
      const pullX = hazard.x - ship.x;
      const pullY = hazard.y - ship.y;
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
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }

  for (const bullet of state.bullets) {
    if (bullet.life <= 0) continue;

    if (state.bossActive && state.boss && circlesOverlap(state.boss.x, state.boss.y, state.boss.collisionRadius, bullet.x, bullet.y, bullet.radius)) {
      bullet.life = 0;
      const dmg = computeDamage(1 * state.weapon.cannonEffectiveness, "physical");
      state.boss.hp -= dmg.damage;
      addDamageText(bullet.x, bullet.y - 6, dmg.damage, dmg.crit);
      createExplosion(bullet.x, bullet.y, "#ffe188", 6);
      if (state.boss.hp <= 0) {
        onBossDefeated();
      }
      continue;
    }

    let blockedByHazard = false;
    for (const hazard of state.edgeHazards) {
      if (circlesOverlap(hazard.x, hazard.y, hazard.hitRadius, bullet.x, bullet.y, bullet.radius)) {
        bullet.life = 0;
        blockedByHazard = true;
        break;
      }
    }
    if (blockedByHazard) continue;

    for (const obj of state.objects) {
      if (obj.hp <= 0) continue;
      if (!circlesOverlap(obj.x, obj.y, obj.collisionRadius, bullet.x, bullet.y, bullet.radius)) continue;
      bullet.life = 0;
      if (obj.destructible) {
        const dmg = computeDamage(1 * state.weapon.cannonEffectiveness, "physical");
        obj.hp -= dmg.damage;
        addDamageText(bullet.x, bullet.y - 6, dmg.damage, dmg.crit);
        if (obj.hp <= 0) {
          destroyObject(obj, "shot");
        }
      }
      break;
    }
  }

  for (const missile of state.missiles) {
    if (state.weapon.rocketHoming) {
      missile.acquireIn = (missile.acquireIn || 0) - dt;
      let target = missile.targetRef;
      if (!target || target.hp <= 0 || missile.acquireIn <= 0) {
        target = findNearestObject(missile.x, missile.y);
        missile.targetRef = target || null;
        missile.acquireIn = 0.12 + Math.random() * 0.08;
      }
      if (target) {
        const dx = target.x - missile.x;
        const dy = target.y - missile.y;
        const dist = Math.hypot(dx, dy) || 1;
        const desiredVx = (dx / dist) * missile.speed;
        const desiredVy = (dy / dist) * missile.speed;
        missile.vx += (desiredVx - missile.vx) * Math.min(1, missile.turnRate * dt);
        missile.vy += (desiredVy - missile.vy) * Math.min(1, missile.turnRate * dt);
      }
    }

    missile.x += missile.vx * dt;
    missile.y += missile.vy * dt;
    missile.life -= dt;

    if (state.bossActive && state.boss) {
      if (circlesOverlap(state.boss.x, state.boss.y, state.boss.collisionRadius, missile.x, missile.y, missile.radius)) {
        explodeRocketAt(missile.x, missile.y);
        const dmg = computeDamage(18, "explosive");
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
        explodeRocketAt(missile.x, missile.y);
        missile.life = 0;
        exploded = true;
        break;
      }
    }

    if (exploded) continue;

    for (const hazard of state.edgeHazards) {
      if (circlesOverlap(hazard.x, hazard.y, hazard.hitRadius, missile.x, missile.y, missile.radius)) {
        explodeRocketAt(missile.x, missile.y);
        missile.life = 0;
        break;
      }
    }
  }

  for (const proj of state.bossProjectiles) {
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
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
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
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
    burst.x += burst.vx * dt;
    burst.y += burst.vy * dt;
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

  state.objects = state.objects.filter((o) => o.x > -o.size * 2 && o.hp > 0);
  state.edgeHazards = state.edgeHazards.filter((h) => h.x > -h.radius * 1.3);
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -30 && b.x < WORLD.width + 30 && b.y > -30 && b.y < WORLD.height + 30);
  state.laserBeams = state.laserBeams.filter((b) => b.life > 0);
  state.plasmaBursts = state.plasmaBursts.filter((b) => b.life > 0 && b.rangeLeft > 0 && b.x > -80 && b.x < WORLD.width + 80 && b.y > -80 && b.y < WORLD.height + 80);
  state.missiles = state.missiles.filter((m) => m.life > 0 && m.x > -60 && m.x < WORLD.width + 60 && m.y > -60 && m.y < WORLD.height + 60);
  state.pickups = state.pickups.filter((p) => p.life > 0 && p.x > -60 && p.x < WORLD.width + 60 && p.y > -60 && p.y < WORLD.height + 60);
  state.bossProjectiles = state.bossProjectiles.filter((p) => p.life > 0 && p.x > -80 && p.x < WORLD.width + 80 && p.y > -80 && p.y < WORLD.height + 80);
  state.particles = state.particles.filter((p) => p.life > 0);
  state.damageTexts = state.damageTexts.filter((t) => t.life > 0);

  refreshHud();
}

const renderer = createRenderer({
  ctx,
  state,
  input,
  WORLD,
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
  refreshHud();
  renderer.draw();

  requestAnimationFrame(gameLoop);
}

function setKeyState(code, pressed) {
  if (code === "ArrowUp" || code === "KeyW") input.up = pressed;
  if (code === "ArrowDown" || code === "KeyS") input.down = pressed;
  if (code === "ArrowLeft" || code === "KeyA") input.left = pressed;
  if (code === "ArrowRight" || code === "KeyD") input.right = pressed;
  if (code === "Space") input.shooting = pressed;
}

function setAimFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = WORLD.width / rect.width;
  const scaleY = WORLD.height / rect.height;
  input.mouseX = (clientX - rect.left) * scaleX;
  input.mouseY = (clientY - rect.top) * scaleY;
}

function updateJoystickFromClient(clientX, clientY) {
  if (!joyBaseEl || !joyKnobEl) return;

  const rect = joyBaseEl.getBoundingClientRect();
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.5;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const maxR = rect.width * 0.35;
  const mag = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(maxR, mag);
  const nx = (dx / mag) * clamped;
  const ny = (dy / mag) * clamped;

  joyKnobEl.style.transform = `translate(${nx}px, ${ny}px)`;
  input.axisX = nx / maxR;
  input.axisY = ny / maxR;
}

function resetJoystickInput() {
  input.axisX = 0;
  input.axisY = 0;
  state.joystickPointerId = null;
  if (joyKnobEl) {
    joyKnobEl.style.transform = "translate(0px, 0px)";
  }
}

function getPrimaryAimTouch(touches) {
  const rect = canvas.getBoundingClientRect();
  const splitX = rect.left + rect.width * 0.38;
  for (const t of touches) {
    if (t.clientX >= splitX) {
      return t;
    }
  }
  return null;
}

function setupTouchControls() {
  if (joystickAreaEl) {
    joystickAreaEl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      initAudio();
      state.joystickPointerId = event.pointerId;
      joystickAreaEl.setPointerCapture(event.pointerId);
      updateJoystickFromClient(event.clientX, event.clientY);
    });

    joystickAreaEl.addEventListener("pointermove", (event) => {
      if (event.pointerId !== state.joystickPointerId) return;
      event.preventDefault();
      updateJoystickFromClient(event.clientX, event.clientY);
    });

    const clearJoystick = (event) => {
      if (event.pointerId !== state.joystickPointerId) return;
      event.preventDefault();
      resetJoystickInput();
    };

    joystickAreaEl.addEventListener("pointerup", clearJoystick);
    joystickAreaEl.addEventListener("pointercancel", clearJoystick);
    joystickAreaEl.addEventListener("lostpointercapture", clearJoystick);
  }

  canvas.addEventListener("touchstart", (event) => {
    initAudio();
    const aimTouch = getPrimaryAimTouch(event.touches);
    if (aimTouch) {
      setAimFromClient(aimTouch.clientX, aimTouch.clientY);
      input.shooting = true;

      const now = state.realNow;
      if (now - state.lastAimTapAt <= 0.28) {
        input.rocketQueued = true;
      }
      state.lastAimTapAt = now;
    }
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", (event) => {
    const aimTouch = getPrimaryAimTouch(event.touches);
    if (aimTouch) {
      setAimFromClient(aimTouch.clientX, aimTouch.clientY);
      input.shooting = true;
    } else {
      input.shooting = false;
    }
    event.preventDefault();
  }, { passive: false });

  const touchEndHandler = (event) => {
    const aimTouch = getPrimaryAimTouch(event.touches);
    input.shooting = Boolean(aimTouch);
    if (aimTouch) {
      setAimFromClient(aimTouch.clientX, aimTouch.clientY);
    }
    event.preventDefault();
  };

  canvas.addEventListener("touchend", touchEndHandler, { passive: false });
  canvas.addEventListener("touchcancel", touchEndHandler, { passive: false });
}

window.addEventListener("keydown", (event) => {
  if ((event.code === "Escape" || event.code === "KeyP") && !event.repeat) {
    event.preventDefault();
    togglePause();
    return;
  }

  if (event.code === "KeyM" && !event.repeat && !IS_COARSE_POINTER) {
    state.desktopAutoFire = !state.desktopAutoFire;
    return;
  }

  if (event.code === "KeyH" && !event.repeat) {
    state.debugHitboxes = !state.debugHitboxes;
    if (!state.debugHitboxes) {
      state.damageTexts = [];
    }
  }

  if (event.code === "KeyI" && !event.repeat) {
    state.showShipInfo = !state.showShipInfo;
    if (shipInfoPanelEl) {
      shipInfoPanelEl.classList.toggle("hidden", !state.showShipInfo);
    }
  }

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyP", "Escape", "KeyM"].includes(event.code)) {
    event.preventDefault();
  }

  setKeyState(event.code, true);
});

window.addEventListener("keyup", (event) => {
  setKeyState(event.code, false);
});

canvas.addEventListener("mousemove", (event) => {
  setAimFromClient(event.clientX, event.clientY);
  state.mouseInCanvas = true;
});

canvas.addEventListener("mouseenter", () => {
  state.mouseInCanvas = true;
});

canvas.addEventListener("mouseleave", () => {
  state.mouseInCanvas = false;
  if (!state.desktopAutoFire) {
    input.shooting = false;
  }
});

canvas.addEventListener("mousedown", (event) => {
  initAudio();
  if (event.button === 0) {
    input.shooting = true;
  }
  if (event.button === 2) {
    input.rocketQueued = true;
  }
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 0) {
    input.shooting = false;
  }
});

window.addEventListener("blur", () => {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  input.axisX = 0;
  input.axisY = 0;
  input.shooting = false;
  resetJoystickInput();
});

overlay.addEventListener("click", (event) => {
  const rawTarget = event.target;
  let actionNode = null;

  if (rawTarget instanceof Element) {
    actionNode = rawTarget.closest("[data-action]");
  } else if (rawTarget && rawTarget.parentElement) {
    actionNode = rawTarget.parentElement.closest("[data-action]");
  }

  if (!(actionNode instanceof HTMLElement)) return;

  if (actionNode.dataset.action === "restart") {
    showDifficultySelectionMenu();
    return;
  }

  if (actionNode.dataset.action === "select-difficulty") {
    const difficultyId = actionNode.dataset.difficultyId;
    if (difficultyId && DIFFICULTY_MODES[difficultyId]) {
      state.selectedDifficultyId = difficultyId;
      showShipSelectionMenu();
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
    showShipSelectionMenu();
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
      applyUpgrade(id);
    }
  }

  if (actionNode.dataset.action === "boss-reward") {
    const rewardId = actionNode.dataset.rewardId;
    if (rewardId) {
      applyBossReward(rewardId);
    }
  }
});

showDifficultySelectionMenu();
setupTouchControls();
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
