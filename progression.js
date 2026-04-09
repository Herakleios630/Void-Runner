(function () {
  function createProgressionSystem(deps) {
    const {
      state,
      overlay,
      playSfx,
      refreshHud,
      spawnBoss,
      computeNextLevelCost,
      setPauseIndicatorVisible,
      upgradeDefs,
      upgradeWeights,
      bossLootDefs,
      weaponUpgradeTrack,
      weaponLevelMilestones,
    } = deps;

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

    function weightedPick(options) {
      const total = options.reduce((sum, opt) => {
        const base = upgradeWeights[opt.id] || 1;
        const rareBoost = state.level >= 12 ? 1 + Math.min(0.9, (state.level - 11) * 0.06) : 1;
        return sum + (base < 3 ? base * rareBoost : base);
      }, 0);

      if (total <= 0) return null;

      let roll = Math.random() * total;
      for (const opt of options) {
        const base = upgradeWeights[opt.id] || 1;
        const rareBoost = state.level >= 12 ? 1 + Math.min(0.9, (state.level - 11) * 0.06) : 1;
        const w = base < 3 ? base * rareBoost : base;
        roll -= w;
        if (roll <= 0) return opt;
      }
      return options[options.length - 1] || null;
    }

    function chooseUpgradeOptions() {
      const pool = upgradeDefs.filter(canOfferUpgrade);
      const picked = [];
      const statPool = pool.filter((u) => isStatUpgrade(u));
      const weaponPool = pool.filter((u) => isWeaponUpgrade(u));

      if (weaponPool.length > 0) {
        const weaponChoice = weightedPick(weaponPool);
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

    function showLevelUpChoice() {
      state.running = false;
      state.levelUpPending = true;
      state.pauseReason = "levelup";

      state.pendingUpgradeOptions = chooseUpgradeOptions();

      if (state.pendingUpgradeOptions.length === 0) {
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

    function applyWeaponMilestone(track, milestone) {
      if (track === "plasma") {
        if (milestone === 5) {
          state.weaponSpecials.plasmaBack = true;
        } else if (milestone === 10) {
          state.weaponSpecials.plasmaTriad = true;
          state.weaponSpecials.plasmaBack = false;
        } else if (milestone === 15) {
          state.weaponSpecials.plasmaCross = true;
          state.weaponSpecials.plasmaTriad = false;
          state.weaponSpecials.plasmaBack = false;
        } else if (milestone === 20) {
          state.weaponSpecials.plasmaNova = true;
          state.weapon.plasmaBurnDps += 0.8;
          state.weapon.plasmaRange = Math.min(900, state.weapon.plasmaRange + 120);
        }
        return;
      }

      if (track === "cannon") {
        if (milestone === 5) {
          state.weaponSpecials.cannonRicochetMaxBounces = Math.max(state.weaponSpecials.cannonRicochetMaxBounces || 0, 1);
        } else if (milestone === 10) {
          state.weaponSpecials.cannonRicochetSplit = true;
        } else if (milestone === 15) {
          state.weaponSpecials.cannonRicochetRamp = true;
        } else if (milestone === 20) {
          state.weaponSpecials.cannonRicochetNova = true;
          state.weaponSpecials.cannonRicochetMaxBounces = Math.max(state.weaponSpecials.cannonRicochetMaxBounces || 0, 2);
        }
        return;
      }

      if (track === "laser") {
        if (milestone === 5) {
          state.weapon.laserRange += 40;
        } else if (milestone === 10) {
          state.weaponSpecials.laserRear = true;
        } else if (milestone === 15) {
          state.weapon.laserPierce += 1;
        } else if (milestone === 20) {
          state.weaponSpecials.laserTri = true;
        }
        return;
      }

      if (track === "rocket") {
        if (milestone === 5) {
          state.weapon.rocketCooldown = Math.max(2.8, state.weapon.rocketCooldown * 0.9);
        } else if (milestone === 10) {
          state.weapon.rocketSplit = true;
        } else if (milestone === 15) {
          state.weapon.rocketBlastRadius += 25;
        } else if (milestone === 20) {
          state.weaponSpecials.rocketOmega = true;
        }
        return;
      }

      if (track === "drill") {
        if (milestone === 5) {
          state.weapon.drillReach = Math.min(42, state.weapon.drillReach + 4);
          state.weapon.drillRadius = Math.min(20, state.weapon.drillRadius + 2);
        } else if (milestone === 10) {
          state.weapon.drillRechargeDelay = Math.max(1.6, state.weapon.drillRechargeDelay * 0.85);
        } else if (milestone === 15) {
          state.weaponSpecials.drillPulse = true;
        } else if (milestone === 20) {
          state.weapon.drillMaxCharges = 2;
          state.weapon.drillCharges = Math.max(state.weapon.drillCharges, 1);
        }
        return;
      }

      if (track === "shield") {
        if (milestone === 5) {
          state.shield.maxCharges = Math.min(3, state.shield.maxCharges + 1);
          state.shield.charges = state.shield.maxCharges;
          state.shield.integrity = state.shield.charges;
        } else if (milestone === 10) {
          state.shield.thorns = true;
        } else if (milestone === 15) {
          state.weaponSpecials.shieldThornPulse = true;
        } else if (milestone === 20) {
          state.shield.rechargeDelay = Math.max(3.2, state.shield.rechargeDelay * 0.8);
          state.shield.nova = true;
          state.shield.nextNova = Math.min(state.shield.nextNova, state.time + 18);
        }
      }
    }

    function gainWeaponLevel(track, amount = 1) {
      if (!track) return;
      const current = state.weaponLevels[track] || 0;
      const next = Math.min(20, current + amount);
      state.weaponLevels[track] = next;

      for (const milestone of weaponLevelMilestones) {
        if (current < milestone && next >= milestone && (state.weaponMilestones[track] || 0) < milestone) {
          state.weaponMilestones[track] = milestone;
          applyWeaponMilestone(track, milestone);
          playSfx("upgrade");
        }
      }
    }

    function initializeWeaponLevelsFromLoadout() {
      state.weaponLevels = { cannon: 0, laser: 0, rocket: 0, drill: 0, plasma: 0, shield: 0 };
      state.weaponMilestones = { cannon: 0, laser: 0, rocket: 0, drill: 0, plasma: 0, shield: 0 };
      state.weaponCounters = { cannonShots: 0, rocketShots: 0, plasmaShots: 0 };
      state.weaponSpecials = {
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
      };

      if (state.weapon.cannonUnlocked) state.weaponLevels.cannon = 1;
      if (state.weapon.laserUnlocked) state.weaponLevels.laser = 1;
      if (state.weapon.rocketUnlocked) state.weaponLevels.rocket = 1;
      if (state.weapon.drillUnlocked) state.weaponLevels.drill = 1;
      if (state.weapon.plasmaUnlocked) state.weaponLevels.plasma = 1;
      if (state.shield.unlocked) state.weaponLevels.shield = 1;
    }

    function applyUpgrade(id) {
      const upgrade = upgradeDefs.find((u) => u.id === id);
      if (!upgrade) return;
      if (!canOfferUpgrade(upgrade)) return;

      state.upgradesTaken[id] = (state.upgradesTaken[id] || 0) + 1;
      upgrade.apply();
      gainWeaponLevel(weaponUpgradeTrack[id], 1);
      finishLevelUp();
    }

    function chooseBossRewards() {
      const pool = bossLootDefs.filter((loot) => {
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
      const reward = bossLootDefs.find((r) => r.id === id);
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

    function debugBoostCurrentWeapons(amount = 5) {
      for (const track of ["cannon", "laser", "rocket", "drill", "plasma", "shield"]) {
        if ((state.weaponLevels[track] || 0) > 0) {
          gainWeaponLevel(track, amount);
        }
      }
      refreshHud();
      playSfx("upgrade");
    }

    return {
      showLevelUpChoice,
      applyUpgrade,
      initializeWeaponLevelsFromLoadout,
      gainWeaponLevel,
      showBossRewardChoice,
      applyBossReward,
      debugBoostCurrentWeapons,
    };
  }

  window.VoidProgression = {
    createProgressionSystem,
  };
})();
