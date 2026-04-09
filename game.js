const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const scoreEl = document.getElementById("score");
const killsEl = document.getElementById("kills");
const timeEl = document.getElementById("timeSurvived");
const levelEl = document.getElementById("level");
const hpStatusEl = document.getElementById("hpStatus");
const critStatusEl = document.getElementById("critStatus");
const reloadStatusEl = document.getElementById("reloadStatus");
const xpStatusEl = document.getElementById("xpStatus");
const shieldStatusEl = document.getElementById("shieldStatus");
const rocketStatusEl = document.getElementById("rocketStatus");

const WORLD = {
  width: canvas.width,
  height: canvas.height,
  scrollSpeed: 220,
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  shooting: false,
  rocketQueued: false,
  mouseX: WORLD.width * 0.7,
  mouseY: WORLD.height * 0.5,
};

const audio = {
  ctx: null,
};

const SHIP_MODELS = {
  normal: {
    id: "normal",
    name: "Scout",
    role: "Ausgewogen",
    maxHp: 3,
    speed: 1,
    critChance: 0.1,
    critDamage: 1.5,
    reloadRate: 1,
    xpBonus: 1,
    colorA: "#71f4ff",
    colorB: "#ff995a",
  },
  tank: {
    id: "tank",
    name: "Bulwark",
    role: "Tank",
    maxHp: 5,
    speed: 0.82,
    critChance: 0.06,
    critDamage: 1.4,
    reloadRate: 0.9,
    xpBonus: 0.95,
    colorA: "#6db5ff",
    colorB: "#8bd2ff",
  },
  glass: {
    id: "glass",
    name: "Viper",
    role: "Glaskanone",
    maxHp: 2,
    speed: 1.2,
    critChance: 0.22,
    critDamage: 1.8,
    reloadRate: 1.1,
    xpBonus: 1.1,
    colorA: "#ff8f8f",
    colorB: "#ffc06f",
  },
};

const state = {
  running: false,
  gameOver: false,
  pauseReason: "menu",
  debugHitboxes: false,
  selectedShipId: "normal",
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
  missiles: [],
  bossProjectiles: [],
  particles: [],
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
  },
  shield: {
    unlocked: false,
    charges: 0,
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
};

const BOSS_VARIANTS = ["tentacle", "warship", "carrier"];

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
    id: "shield_core",
    title: "Schild",
    description: "Absorbiert 1 Treffer und laedt sich nach 10s wieder auf.",
    canOffer: () => !state.shield.unlocked,
    apply: () => {
      state.shield.unlocked = true;
      state.shield.charges = state.shield.maxCharges;
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
    canOffer: () => state.weapon.extraLasers < 2,
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
    canOffer: () => true,
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
    canOffer: () => state.weapon.extraLasers > 0,
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
    canOffer: () => !state.weapon.rocketUnlocked,
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
    id: "laser_emitter",
    title: "Laser-Emitter",
    description: "Kurzer Lichtstrahl zusaetzlich zum Geschuetz.",
    maxStacks: 1,
    canOffer: () => !state.weapon.laserUnlocked,
    apply: () => {
      state.weapon.laserUnlocked = true;
      state.weapon.lastLaserShot = -999;
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
];

function initAudio() {
  if (audio.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
}

function playTone(freq, duration, type = "sine", volume = 0.03, slide = 1) {
  if (!audio.ctx) return;
  if (audio.ctx.state === "suspended") {
    audio.ctx.resume();
  }

  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), now + duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(audio.ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playSfx(type) {
  if (type === "cannon") {
    playTone(680, 0.06, "square", 0.02, 1.15);
  } else if (type === "laser") {
    playTone(980, 0.07, "sawtooth", 0.02, 0.92);
  } else if (type === "rocket") {
    playTone(150, 0.18, "sawtooth", 0.035, 0.7);
  } else if (type === "explosion") {
    playTone(120, 0.2, "triangle", 0.04, 0.45);
  } else if (type === "shieldHit") {
    playTone(350, 0.2, "sine", 0.045, 0.6);
  } else if (type === "shieldReady") {
    playTone(430, 0.09, "sine", 0.03, 1.35);
  } else if (type === "upgrade") {
    playTone(520, 0.09, "triangle", 0.03, 1.2);
    setTimeout(() => playTone(700, 0.1, "triangle", 0.025, 1.1), 65);
  } else if (type === "levelup") {
    playTone(420, 0.12, "triangle", 0.03, 1.25);
    setTimeout(() => playTone(620, 0.14, "triangle", 0.03, 1.1), 90);
  } else if (type === "warning") {
    playTone(260, 0.1, "square", 0.03, 1.2);
  }
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function selectedShipModel() {
  return SHIP_MODELS[state.selectedShipId] || SHIP_MODELS.normal;
}

function showShipSelectionMenu() {
  state.running = false;
  state.pauseReason = "ship-select";

  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <h1>Orbital Flappy</h1>
    <p>Waehle dein Raumschiff</p>
    <div style="display:grid;gap:10px;width:min(92vw,740px)">
      <button data-action="select-ship" data-ship-id="tank" style="text-align:left;line-height:1.4;">
        <strong>Bulwark (Tank)</strong><br />
        <span>HP 5 | Speed 82% | Krit 6% | Krit-DMG 140% | Reload 90% | XP 95%</span>
      </button>
      <button data-action="select-ship" data-ship-id="normal" style="text-align:left;line-height:1.4;">
        <strong>Scout (Normal)</strong><br />
        <span>HP 3 | Speed 100% | Krit 10% | Krit-DMG 150% | Reload 100% | XP 100%</span>
      </button>
      <button data-action="select-ship" data-ship-id="glass" style="text-align:left;line-height:1.4;">
        <strong>Viper (Glaskanone)</strong><br />
        <span>HP 2 | Speed 120% | Krit 22% | Krit-DMG 180% | Reload 110% | XP 110%</span>
      </button>
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

function rollCrit() {
  const chance = state.shipStats ? state.shipStats.critChance : 0.1;
  return Math.random() < chance;
}

function computeDamage(baseDamage) {
  const crit = rollCrit();
  const critMult = state.shipStats ? state.shipStats.critDamage : 1.5;
  const dmg = crit ? baseDamage * critMult : baseDamage;
  return {
    damage: Math.max(1, Math.floor(dmg)),
    crit,
  };
}

function hitShip() {
  if (!state.ship) return false;
  if (state.time < state.ship.invulnUntil) return true;

  if (consumeShield()) {
    state.ship.invulnUntil = state.time + 0.35;
    return true;
  }

  state.ship.hp -= 1;
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
  return 1 + Math.min(1.8, (state.level - 1) * 0.06);
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
        <button data-action="boss-reward" data-reward-id="${u.id}" style="max-width:560px;text-align:left;display:block;line-height:1.4;">
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
  const variant = randomFrom(BOSS_VARIANTS);
  const size = 96 + Math.min(70, level * 1.8);
  const hp = Math.floor(140 + level * 28 + Math.pow(level, 1.15) * 6);
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
    fireCooldown: Math.max(0.55, 1.35 - level * 0.03),
    lastFire: state.time,
    minionCooldown: 3.8 + Math.random() * 1.4,
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
  state.shipStats = {
    maxHp: model.maxHp,
    speed: model.speed,
    critChance: model.critChance,
    critDamage: model.critDamage,
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
  state.missiles = [];
  state.bossProjectiles = [];
  state.particles = [];
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
  state.weapon.laserSpread = 11;
  state.weapon.laserUnlocked = false;
  state.weapon.laserCooldown = 0.22;
  state.weapon.lastLaserShot = -999;
  state.weapon.laserRange = 260;
  state.weapon.laserDamage = 1;
  state.weapon.laserPierce = 1;
  state.weapon.rocketUnlocked = false;
  state.weapon.rocketCooldown = 10;
  state.weapon.lastRocketShot = -999;
  state.weapon.lastRocketRealShot = -999;
  state.weapon.rocketHoming = false;
  state.weapon.rocketSplit = false;
  state.weapon.rocketBlastRadius = 110;

  state.shield.unlocked = false;
  state.shield.charges = 0;
  state.shield.maxCharges = 1;
  state.shield.rechargeDelay = 10;
  state.shield.cooldownUntil = 0;
  state.shield.thorns = false;
  state.shield.nova = false;
  state.shield.nextNova = 30;

  state.upgradesTaken = {};

  state.ship = {
    x: WORLD.width * 0.2,
    y: WORLD.height * 0.5,
    vx: 0,
    vy: 0,
    hp: model.maxHp,
    maxHp: model.maxHp,
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

  overlay.classList.add("hidden");
  refreshHud();
}

function refreshHud() {
  scoreEl.textContent = Math.floor(state.score);
  killsEl.textContent = state.kills;
  timeEl.textContent = state.time.toFixed(1);
  levelEl.textContent = state.level;
  if (state.ship) {
    hpStatusEl.textContent = `${Math.max(0, state.ship.hp)}/${state.ship.maxHp}`;
  }
  critStatusEl.textContent = `${Math.round((state.shipStats ? state.shipStats.critChance : 0.1) * 100)}%`;
  reloadStatusEl.textContent = `${Math.round(reloadRate() * 100)}%`;
  xpStatusEl.textContent = `${Math.round(((state.shipStats ? state.shipStats.xpBonus : 1) - 1) * 100)}%`;

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
  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <h1>Game Over</h1>
    <p>Zeit: ${state.time.toFixed(1)}s | Punkte: ${Math.floor(state.score)} | Kills: ${state.kills}</p>
    <button data-action="restart">Neu starten</button>
    <button data-action="open-ship-select">Raumschiff wechseln</button>
  `;
}

function canOfferUpgrade(def) {
  if (!def.canOffer()) return false;
  const stacks = state.upgradesTaken[def.id] || 0;
  if (def.maxStacks && stacks >= def.maxStacks) return false;
  return true;
}

function chooseUpgradeOptions() {
  const pool = UPGRADE_DEFS.filter(canOfferUpgrade);
  const picked = [];

  while (pool.length > 0 && picked.length < 3) {
    const choice = weightedPick(pool);
    if (!choice) break;
    picked.push(choice);
    const idx = pool.findIndex((u) => u.id === choice.id);
    if (idx >= 0) pool.splice(idx, 1);
  }

  return picked;
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
        <button data-action="upgrade" data-upgrade-id="${u.id}" style="max-width:560px;text-align:left;display:block;line-height:1.4;">
          <strong>${u.title}</strong><br />
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
  const r = Math.random();
  let type = "debris";
  let size = 30;
  let hp = 999;
  let destructible = false;
  let collisionScale = 0.8;
  let corners = 8;

  if (r < 0.2) {
    type = "miniAlien";
    size = 14 + Math.random() * 10;
    hp = 1;
    destructible = true;
    collisionScale = 0.7;
    corners = 0;
  } else if (r < 0.42) {
    type = "smallRock";
    size = 11 + Math.random() * 12;
    hp = 1;
    destructible = true;
    collisionScale = 0.78;
    corners = 8;
  } else if (r < 0.66) {
    type = "mediumRock";
    size = 24 + Math.random() * 14;
    hp = 2;
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

  const vx = -(WORLD.scrollSpeed + Math.random() * 120);
  const vy = (Math.random() - 0.5) * 70;
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
  });
}

function spawnEdgeHazard() {
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
      vx: -(WORLD.scrollSpeed * (0.84 + Math.random() * 0.22)),
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
      vx: -(WORLD.scrollSpeed * (1 + Math.random() * 0.25)),
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
    vx: -(WORLD.scrollSpeed * (0.92 + Math.random() * 0.22)),
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

function consumeShield() {
  if (!state.shield.unlocked || state.shield.charges < 1) return false;

  state.shield.charges = 0;
  state.shield.cooldownUntil = state.time + state.shield.rechargeDelay / reloadRate();
  playSfx("shieldHit");
  createExplosion(state.ship.x, state.ship.y, "#71f4ff", 24);

  if (state.shield.thorns) {
    damageNearbyFromShieldPulse(105, false);
  }

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
      const dmg = computeDamage(state.weapon.laserDamage);
      hit.ref.hp -= dmg.damage;
      createExplosion(ox + dx * hit.t, oy + dy * hit.t, hitColor, 7);
      if (hit.ref.hp <= 0) {
        onBossDefeated();
      }
      remainingPierce -= 1;
      continue;
    }

    if (hit.kind === "object") {
      if (hit.ref.destructible) {
        const dmg = computeDamage(state.weapon.laserDamage);
        hit.ref.hp -= dmg.damage;
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

  playSfx("laser");
}

function shootAtCursor(now) {
  if (now - state.lastShot < effectiveCannonCooldown()) return;
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

  // Laser is a short beam weapon that can be unlocked and upgraded independently.
  fireLaserPulse(now);
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
    });
  }

  playSfx("rocket");
}

function findNearestObject(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const obj of state.objects) {
    if (obj.hp <= 0) continue;
    const d = Math.hypot(obj.x - x, obj.y - y);
    if (d < bestDist) {
      bestDist = d;
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
  let hp = 1;
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
  });
}

function updateBoss(dt) {
  if (!state.bossActive || !state.boss) return;

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
    for (let i = 0; i < shots; i += 1) {
      const spread = (i - (shots - 1) / 2) * 0.24;
      const dx = state.ship.x - boss.x;
      const dy = state.ship.y - boss.y;
      const a = Math.atan2(dy, dx) + spread;
      const speed = boss.variant === "warship" ? 300 : 260;

      state.bossProjectiles.push({
        x: boss.x - boss.size * 0.38,
        y: boss.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 6,
        radius: boss.variant === "carrier" ? 10 : 8,
      });
    }
  }
}

function update(dt, now) {
  if (!state.running) return;

  state.time += dt;
  state.score += dt * (7 + state.level * 0.45) * passiveScoreMultiplier();

  if (state.score >= state.nextLevelScore && !state.levelUpPending && !state.bossActive) {
    showLevelUpChoice();
    return;
  }

  const ship = state.ship;
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

  if (input.shooting) shootAtCursor(now);

  if (input.rocketQueued) {
    fireRocket(now);
    input.rocketQueued = false;
  }

  if (state.shield.unlocked && state.shield.charges < state.shield.maxCharges && state.time >= state.shield.cooldownUntil) {
    state.shield.charges = state.shield.maxCharges;
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
    const dynamicSpawn = Math.max(0.19, (state.spawnInterval / intensity) - Math.min(0.45, state.time * 0.012));
    while (state.lastSpawn >= dynamicSpawn) {
      state.lastSpawn -= dynamicSpawn;
      spawnObject();
    }

    state.lastEdgeSpawn += dt;
    const dynamicEdgeSpawn = Math.max(0.72, (state.edgeSpawnInterval / Math.max(1, intensity * 0.82)) - Math.min(0.9, state.time * 0.01));
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

    if (obj.y < obj.size || obj.y > WORLD.height - obj.size) {
      obj.vy *= -1;
    }

    if (!obj.passed && obj.x + obj.size < ship.x) {
      obj.passed = true;
      addPoints(obj.destructible ? 6 : 12);
    }

    const d = Math.hypot(obj.x - ship.x, obj.y - ship.y);
    if (d < obj.collisionRadius + ship.radius - 2) {
      if (!hitShip()) {
        setGameOver();
        return;
      }
      if (obj.destructible) {
        destroyObject(obj, "rocket");
      }
    }
  }

  if (state.bossActive && state.boss) {
    const dBoss = Math.hypot(state.boss.x - ship.x, state.boss.y - ship.y);
    if (dBoss < state.boss.collisionRadius + ship.radius - 3) {
      if (!hitShip()) {
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
      if (!hitShip()) {
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
      const d = Math.hypot(hazard.x - obj.x, hazard.y - obj.y);
      if (d < hazard.hitRadius + obj.collisionRadius - 2) {
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
    if (state.bossActive && state.boss) {
      const dBoss = Math.hypot(state.boss.x - bullet.x, state.boss.y - bullet.y);
      if (dBoss < state.boss.collisionRadius + bullet.radius) {
        bullet.life = 0;
        const dmg = computeDamage(1);
        state.boss.hp -= dmg.damage;
        createExplosion(bullet.x, bullet.y, "#ffe188", 6);
        if (state.boss.hp <= 0) {
          onBossDefeated();
        }
        continue;
      }
    }

    for (const hazard of state.edgeHazards) {
      const d = Math.hypot(hazard.x - bullet.x, hazard.y - bullet.y);
      if (d < hazard.hitRadius + bullet.radius) {
        bullet.life = 0;
        break;
      }
    }
  }

  for (const bullet of state.bullets) {
    for (const obj of state.objects) {
      if (obj.hp <= 0) continue;
      const d = Math.hypot(obj.x - bullet.x, obj.y - bullet.y);
      if (d < obj.collisionRadius + bullet.radius) {
        bullet.life = 0;
        if (obj.destructible) {
          const dmg = computeDamage(1);
          obj.hp -= dmg.damage;
          if (obj.hp <= 0) {
            destroyObject(obj, "shot");
          }
        }
        break;
      }
    }
  }

  for (const missile of state.missiles) {
    if (state.weapon.rocketHoming) {
      const target = findNearestObject(missile.x, missile.y);
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
      const dBoss = Math.hypot(state.boss.x - missile.x, state.boss.y - missile.y);
      if (dBoss < state.boss.collisionRadius + missile.radius) {
        explodeRocketAt(missile.x, missile.y);
        const dmg = computeDamage(18);
        state.boss.hp -= dmg.damage;
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
      const d = Math.hypot(obj.x - missile.x, obj.y - missile.y);
      if (d < obj.collisionRadius + missile.radius) {
        explodeRocketAt(missile.x, missile.y);
        missile.life = 0;
        exploded = true;
        break;
      }
    }

    if (exploded) continue;

    for (const hazard of state.edgeHazards) {
      const d = Math.hypot(hazard.x - missile.x, hazard.y - missile.y);
      if (d < hazard.hitRadius + missile.radius) {
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

    const dShip = Math.hypot(proj.x - ship.x, proj.y - ship.y);
    if (dShip < proj.radius + ship.radius) {
      proj.life = 0;
      if (!hitShip()) {
        setGameOver();
        return;
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

  for (const beam of state.laserBeams) {
    beam.life -= dt;
  }

  state.objects = state.objects.filter((o) => o.x > -o.size * 2 && o.hp > 0);
  state.edgeHazards = state.edgeHazards.filter((h) => h.x > -h.radius * 1.3);
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -30 && b.x < WORLD.width + 30 && b.y > -30 && b.y < WORLD.height + 30);
  state.laserBeams = state.laserBeams.filter((b) => b.life > 0);
  state.missiles = state.missiles.filter((m) => m.life > 0 && m.x > -60 && m.x < WORLD.width + 60 && m.y > -60 && m.y < WORLD.height + 60);
  state.bossProjectiles = state.bossProjectiles.filter((p) => p.life > 0 && p.x > -80 && p.x < WORLD.width + 80 && p.y > -80 && p.y < WORLD.height + 80);
  state.particles = state.particles.filter((p) => p.life > 0);

  refreshHud();
}

function drawShip(ship) {
  const moveAngle = Math.atan2(ship.vy, ship.vx || 0.001);
  const aimAngle = Math.atan2(input.mouseY - ship.y, input.mouseX - ship.x);
  const model = selectedShipModel();

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(moveAngle);

  if (model.id === "tank") {
    ctx.fillStyle = model.colorA;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-15, 13);
    ctx.lineTo(-20, 7);
    ctx.lineTo(-20, -7);
    ctx.lineTo(-15, -13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = model.colorB;
    ctx.fillRect(-8, -6, 14, 12);
  } else if (model.id === "glass") {
    ctx.fillStyle = model.colorA;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-13, 9);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-13, -9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = model.colorB;
    ctx.beginPath();
    ctx.arc(-4, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, 10);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-14, -10);
    ctx.closePath();
    ctx.fillStyle = model.colorA;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-6, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = model.colorB;
    ctx.fill();
  }

  // Visible cannon turrets that rotate toward mouse cursor.
  const turretCount = 1 + state.weapon.extraLasers;
  const offsets = turretCount === 1 ? [0] : turretCount === 2 ? [-6, 6] : [-8, 0, 8];
  for (const yOff of offsets) {
    ctx.save();
    ctx.translate(0, yOff);
    ctx.rotate(aimAngle - moveAngle);
    ctx.fillStyle = "#2e3d52";
    ctx.fillRect(-2, -2, 14, 4);
    ctx.fillStyle = "#ffd07b";
    ctx.fillRect(10, -1.2, 5, 2.4);
    ctx.restore();
  }

  if (state.weapon.laserUnlocked) {
    ctx.save();
    ctx.rotate(aimAngle - moveAngle);
    ctx.fillStyle = "#79f2ff";
    ctx.fillRect(2, -5.5, 10, 3);
    ctx.fillRect(2, 2.5, 10, 3);
    ctx.restore();
  }

  if (state.shield.unlocked && state.shield.charges > 0) {
    ctx.strokeStyle = "rgba(132, 230, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ship.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (state.weapon.rocketUnlocked && getRocketCooldownLeft() <= 0.05) {
    ctx.save();
    ctx.translate(-18, -16);
    ctx.rotate(-0.2);
    ctx.fillStyle = "#ffb072";
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-8, 6);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd39d";
    ctx.fillRect(-11, -2, 4, 4);
    ctx.restore();
  }

  ctx.restore();
}

function drawMissile(missile) {
  const a = Math.atan2(missile.vy, missile.vx || 0.001);
  ctx.save();
  ctx.translate(missile.x, missile.y);
  ctx.rotate(a);

  ctx.fillStyle = "#ff9f5f";
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-8, 5.5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-8, -5.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffd5ac";
  ctx.fillRect(-10, -2, 4, 4);

  ctx.fillStyle = "rgba(255, 197, 99, 0.7)";
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(-13 - Math.random() * 4, 2);
  ctx.lineTo(-13 - Math.random() * 4, -2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawObject(obj) {
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate(obj.angle);

  if (obj.type === "miniAlien") {
    ctx.fillStyle = "#9eff7f";
    ctx.beginPath();
    ctx.ellipse(0, 0, obj.size * 0.95, obj.size * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#18250f";
    ctx.beginPath();
    ctx.arc(-obj.size * 0.28, -2, 2.2, 0, Math.PI * 2);
    ctx.arc(obj.size * 0.28, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    const corners = obj.corners || (obj.type === "boulder" ? 11 : obj.type === "mediumRock" ? 9 : 8);
    for (let i = 0; i < corners; i += 1) {
      const t = (i / corners) * Math.PI * 2;
      const profile = obj.rockProfile ? obj.rockProfile[i] : 0.8;
      const r = obj.size * profile;
      const px = Math.cos(t) * r;
      const py = Math.sin(t) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    if (obj.type === "smallRock") ctx.fillStyle = "#b8c4d4";
    else if (obj.type === "mediumRock") ctx.fillStyle = "#96a2b8";
    else if (obj.type === "rockShard") ctx.fillStyle = "#d5deea";
    else if (obj.type === "boulder") ctx.fillStyle = "#7b8496";
    else ctx.fillStyle = "#5c6474";

    ctx.fill();
  }

  ctx.restore();
}

function drawEdgeHazard(hazard) {
  ctx.save();
  ctx.translate(hazard.x, hazard.y);
  ctx.rotate(hazard.angle);

  if (hazard.kind === "planet") {
    const grad = ctx.createRadialGradient(-hazard.radius * 0.28, -hazard.radius * 0.28, hazard.radius * 0.1, 0, 0, hazard.radius);
    grad.addColorStop(0, "#9ec8ff");
    grad.addColorStop(0.45, "#4a74a8");
    grad.addColorStop(1, "#1a2a44");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, hazard.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(214, 236, 255, 0.22)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, hazard.radius * 0.83, -1.8, 1.2);
    ctx.stroke();
  } else if (hazard.kind === "station") {
    ctx.fillStyle = "#96a9c3";
    ctx.beginPath();
    ctx.arc(0, 0, hazard.radius * 0.38, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#74839a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, hazard.radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#5a667c";
    ctx.fillRect(-hazard.radius * 0.95, -8, hazard.radius * 1.9, 16);
    ctx.fillRect(-8, -hazard.radius * 0.95, 16, hazard.radius * 1.9);
  } else {
    const glow = ctx.createRadialGradient(0, 0, hazard.radius * 0.15, 0, 0, hazard.radius);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    glow.addColorStop(0.3, "rgba(106, 102, 255, 0.85)");
    glow.addColorStop(0.7, "rgba(43, 39, 96, 0.65)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0.2)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, hazard.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBoss() {
  if (!state.bossActive || !state.boss) return;

  const boss = state.boss;

  ctx.save();
  ctx.translate(boss.x, boss.y);

  if (boss.variant === "tentacle") {
    ctx.fillStyle = "#8fff8b";
    ctx.beginPath();
    ctx.ellipse(0, 0, boss.size * 0.8, boss.size * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#71d764";
    ctx.lineWidth = 7;
    for (let i = 0; i < 4; i += 1) {
      const oy = (i - 1.5) * 26;
      ctx.beginPath();
      ctx.moveTo(-boss.size * 0.45, oy);
      ctx.bezierCurveTo(-boss.size * 0.7, oy + 18, -boss.size * 0.9, oy + Math.sin(state.time * 3 + i) * 20, -boss.size * 1.05, oy + 10);
      ctx.stroke();
    }
  } else if (boss.variant === "warship") {
    ctx.fillStyle = "#a2b6d9";
    ctx.beginPath();
    ctx.moveTo(boss.size * 0.85, 0);
    ctx.lineTo(-boss.size * 0.75, boss.size * 0.42);
    ctx.lineTo(-boss.size * 0.45, 0);
    ctx.lineTo(-boss.size * 0.75, -boss.size * 0.42);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#53617a";
    ctx.fillRect(-boss.size * 0.45, -boss.size * 0.2, boss.size * 0.95, boss.size * 0.4);
  } else {
    ctx.fillStyle = "#f6a268";
    ctx.beginPath();
    ctx.ellipse(0, 0, boss.size * 0.78, boss.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#db7c43";
    ctx.fillRect(-boss.size * 0.35, -boss.size * 0.6, boss.size * 0.7, boss.size * 0.18);
    ctx.fillRect(-boss.size * 0.35, boss.size * 0.42, boss.size * 0.7, boss.size * 0.18);
  }

  ctx.fillStyle = "#1d261a";
  ctx.beginPath();
  ctx.arc(-boss.size * 0.18, -boss.size * 0.08, 8, 0, Math.PI * 2);
  ctx.arc(boss.size * 0.18, -boss.size * 0.08, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const barW = 360;
  const barH = 16;
  const x = WORLD.width * 0.5 - barW * 0.5;
  const y = 14;
  const pct = Math.max(0, boss.hp / boss.maxHp);

  ctx.fillStyle = "rgba(11, 19, 40, 0.84)";
  ctx.fillRect(x - 3, y - 3, barW + 6, barH + 6);
  ctx.fillStyle = "#2a3657";
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = "#ff6e5f";
  ctx.fillRect(x, y, barW * pct, barH);
  ctx.fillStyle = "#e9f0ff";
  ctx.font = "13px Trebuchet MS";
  ctx.fillText(`BOSS (${boss.variant}) HP ${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp}`, x + 8, y + 12);
}

function drawBossWarning() {
  if (!state.bossActive || !state.boss || !state.boss.intro) return;

  const blink = Math.sin(state.time * 14) > 0;
  const alpha = blink ? 0.92 : 0.45;
  const text = "WARNING: BOSS INCOMING";

  ctx.save();
  ctx.fillStyle = `rgba(160, 28, 36, ${0.38 + alpha * 0.2})`;
  ctx.fillRect(0, WORLD.height * 0.38, WORLD.width, 52);
  ctx.strokeStyle = `rgba(255, 126, 118, ${alpha})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, WORLD.height * 0.38, WORLD.width, 52);
  ctx.fillStyle = `rgba(255, 240, 238, ${alpha})`;
  ctx.font = "bold 28px Trebuchet MS";
  const tw = ctx.measureText(text).width;
  ctx.fillText(text, WORLD.width * 0.5 - tw * 0.5, WORLD.height * 0.38 + 34);
  ctx.restore();
}

function drawDebugOverlay() {
  if (!state.running || !state.debugHitboxes) return;

  ctx.save();
  ctx.lineWidth = 1.2;

  ctx.strokeStyle = "rgba(113, 244, 255, 0.95)";
  ctx.beginPath();
  ctx.arc(state.ship.x, state.ship.y, state.ship.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 180, 106, 0.95)";
  for (const obj of state.objects) {
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, obj.collisionRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 94, 121, 0.95)";
  for (const hazard of state.edgeHazards) {
    ctx.beginPath();
    ctx.arc(hazard.x, hazard.y, hazard.hitRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 218, 107, 0.95)";
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const missile of state.missiles) {
    ctx.beginPath();
    ctx.arc(missile.x, missile.y, missile.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (state.bossActive && state.boss) {
    ctx.strokeStyle = "rgba(255, 95, 112, 0.95)";
    ctx.beginPath();
    ctx.arc(state.boss.x, state.boss.y, state.boss.collisionRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const proj of state.bossProjectiles) {
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(8, 20, 42, 0.8)";
  ctx.fillRect(14, 14, 150, 28);
  ctx.fillStyle = "#ff8e4f";
  ctx.font = "14px Trebuchet MS";
  ctx.fillText("DEBUG HITBOXES: ON", 22, 33);

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  for (const star of state.stars) {
    ctx.fillStyle = `rgba(183, 218, 255, ${Math.min(1, star.size / 2)})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }

  for (const hazard of state.edgeHazards) drawEdgeHazard(hazard);
  for (const obj of state.objects) drawObject(obj);

  ctx.fillStyle = "#ffda6b";
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const missile of state.missiles) {
    drawMissile(missile);
  }

  ctx.fillStyle = "#ff5f70";
  for (const proj of state.bossProjectiles) {
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBoss();
  drawBossWarning();

  if (state.ship) {
    drawShip(state.ship);
  }

  ctx.strokeStyle = "#ff8e4f";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(input.mouseX, input.mouseY, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(input.mouseX - 14, input.mouseY);
  ctx.lineTo(input.mouseX + 14, input.mouseY);
  ctx.moveTo(input.mouseX, input.mouseY - 14);
  ctx.lineTo(input.mouseX, input.mouseY + 14);
  ctx.stroke();

  if (state.ship) {
    ctx.strokeStyle = "rgba(255, 142, 79, 0.35)";
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(state.ship.x, state.ship.y);
    ctx.lineTo(input.mouseX, input.mouseY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (const beam of state.laserBeams) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, beam.life * 14));
    ctx.strokeStyle = "#8ef7ff";
    ctx.lineWidth = beam.width;
    ctx.beginPath();
    ctx.moveTo(beam.x1, beam.y1);
    ctx.lineTo(beam.x2, beam.y2);
    ctx.stroke();
    ctx.restore();
  }

  drawDebugOverlay();
}

let lastTime = performance.now() / 1000;
function gameLoop(nowMs) {
  const now = nowMs / 1000;
  state.realNow = now;
  const dt = Math.min(0.033, now - lastTime);
  lastTime = now;

  update(dt, now);
  refreshHud();
  draw();

  requestAnimationFrame(gameLoop);
}

function setKeyState(code, pressed) {
  if (code === "ArrowUp" || code === "KeyW") input.up = pressed;
  if (code === "ArrowDown" || code === "KeyS") input.down = pressed;
  if (code === "ArrowLeft" || code === "KeyA") input.left = pressed;
  if (code === "ArrowRight" || code === "KeyD") input.right = pressed;
  if (code === "Space") input.shooting = pressed;
}

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyH" && !event.repeat) {
    state.debugHitboxes = !state.debugHitboxes;
  }

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  setKeyState(event.code, true);
});

window.addEventListener("keyup", (event) => {
  setKeyState(event.code, false);
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = WORLD.width / rect.width;
  const scaleY = WORLD.height / rect.height;
  input.mouseX = (event.clientX - rect.left) * scaleX;
  input.mouseY = (event.clientY - rect.top) * scaleY;
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

overlay.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const actionNode = target.closest("[data-action]");
  if (!(actionNode instanceof HTMLElement)) return;

  if (actionNode.dataset.action === "restart") {
    resetGame();
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

showShipSelectionMenu();
requestAnimationFrame(gameLoop);
