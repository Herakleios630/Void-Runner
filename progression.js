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
      balanceProfileId = "medium",
    } = deps;

    const BALANCE_PROFILES = {
      safe: {
        cannonDamageAdd: 0.045,
        cannonCooldownEvery: 5,
        cannonCooldownMult: 0.994,
        laserDamageAdd: 0.22,
        laserRangeAdd: 6,
        laserCooldownMult: 0.997,
        rocketDamageAdd: 0.7,
        rocketRadiusAdd: 3,
        rocketCooldownMult: 0.997,
        drillReachAdd: 0.55,
        drillRadiusAdd: 0.16,
        drillRechargeMult: 0.995,
        plasmaBurnAdd: 0.08,
        plasmaRangeAdd: 6,
        plasmaCooldownMult: 0.997,
        shieldRechargeMult: 0.994,
        shieldPulseAdd: 0.8,
        shieldBreakAdd: 1.1,
      },
      medium: {
        cannonDamageAdd: 0.06,
        cannonCooldownEvery: 4,
        cannonCooldownMult: 0.992,
        laserDamageAdd: 0.3,
        laserRangeAdd: 8,
        laserCooldownMult: 0.996,
        rocketDamageAdd: 0.9,
        rocketRadiusAdd: 4,
        rocketCooldownMult: 0.995,
        drillReachAdd: 0.7,
        drillRadiusAdd: 0.22,
        drillRechargeMult: 0.993,
        plasmaBurnAdd: 0.1,
        plasmaRangeAdd: 8,
        plasmaCooldownMult: 0.996,
        shieldRechargeMult: 0.992,
        shieldPulseAdd: 1,
        shieldBreakAdd: 1.4,
      },
      chaos: {
        cannonDamageAdd: 0.08,
        cannonCooldownEvery: 3,
        cannonCooldownMult: 0.989,
        laserDamageAdd: 0.4,
        laserRangeAdd: 11,
        laserCooldownMult: 0.994,
        rocketDamageAdd: 1.2,
        rocketRadiusAdd: 5.5,
        rocketCooldownMult: 0.992,
        drillReachAdd: 0.95,
        drillRadiusAdd: 0.3,
        drillRechargeMult: 0.99,
        plasmaBurnAdd: 0.14,
        plasmaRangeAdd: 10,
        plasmaCooldownMult: 0.994,
        shieldRechargeMult: 0.989,
        shieldPulseAdd: 1.3,
        shieldBreakAdd: 1.9,
      },
    };

    const activeProfileId = BALANCE_PROFILES[balanceProfileId] ? balanceProfileId : "medium";
    const levelTuning = {
      cannon: 1,
      laser: 1,
      rocket: 1,
      drill: 1,
      plasma: 1,
      shield: 1,
    };

    function activeProfile() {
      return BALANCE_PROFILES[activeProfileId];
    }

    function tuningFor(track) {
      return Math.max(0.5, Math.min(2.5, levelTuning[track] || 1));
    }

    function tunedCooldownMult(baseMult, track) {
      const tune = tuningFor(track);
      return Math.max(0.85, Math.min(1, Math.pow(baseMult, tune)));
    }

    function tierClassByLevel(level) {
      if (level >= 20) return "weapon-level-tier-orange";
      if (level >= 15) return "weapon-level-tier-purple";
      if (level >= 10) return "weapon-level-tier-blue";
      if (level >= 5) return "weapon-level-tier-green";
      return "weapon-level-tier-white";
    }

    function tierCardClassByLevel(level) {
      if (level >= 20) return "upgrade-card-tier-orange";
      if (level >= 15) return "upgrade-card-tier-purple";
      if (level >= 10) return "upgrade-card-tier-blue";
      if (level >= 5) return "upgrade-card-tier-green";
      return "upgrade-card-tier-white";
    }

    function weaponTrackLabel(track) {
      if (track === "cannon") return "Geschuetz";
      if (track === "laser") return "Laser";
      if (track === "rocket") return "Rakete";
      if (track === "drill") return "Bohrer";
      if (track === "plasma") return "Plasma";
      if (track === "shield") return "Schild";
      return "Waffe";
    }

    function milestoneEffectText(track, milestone) {
      if (track === "cannon") {
        if (milestone === 5) return "+1 Abpraller fuer Kugeln.";
        if (milestone === 10) return "Kugeln splitten bei geeigneten Abprallern.";
        if (milestone === 15) return "Ricochet-Ramp: Abpraller werden staerker/schneller.";
        if (milestone === 20) return "Ricochet-Nova: Zusatzsplitter bei spaeteren Abprallern.";
      }
      if (track === "laser") {
        if (milestone === 5) return "+40 Laser-Reichweite.";
        if (milestone === 10) return "Rueckwaertiger Laser aktiviert.";
        if (milestone === 15) return "+1 Laser-Pierce.";
        if (milestone === 20) return "Tri-Laser aktiviert.";
      }
      if (track === "rocket") {
        if (milestone === 5) return "Raketen-Cooldown -10%.";
        if (milestone === 10) return "Cluster-Raketen aktiviert.";
        if (milestone === 15) return "+25 Explosionsradius.";
        if (milestone === 20) return "Omega: jede 3. Rakete massiv verstaerkt.";
      }
      if (track === "drill") {
        if (milestone === 5) return "Bohrer-Reichweite und Radius erhoeht.";
        if (milestone === 10) return "Bohrer-Aufladung stark beschleunigt.";
        if (milestone === 15) return "Bohrer-Puls aktiviert.";
        if (milestone === 20) return "Bohrer erhaelt 2 Ladungen.";
      }
      if (track === "plasma") {
        if (milestone === 5) return "Plasma-Rueckschuss aktiviert.";
        if (milestone === 10) return "Plasma-Triad aktiviert.";
        if (milestone === 15) return "Plasma-Kreuzfeuer aktiviert.";
        if (milestone === 20) return "Plasma-Nova + starker DoT/Reichweiten-Boost.";
      }
      if (track === "shield") {
        if (milestone === 5) return "+1 Schildladung (bis max 3).";
        if (milestone === 10) return "Schild-Stacheln aktiviert.";
        if (milestone === 15) return "Schild-Thorn-Pulse aktiviert.";
        if (milestone === 20) return "Schnelleres Laden + Shield-Nova.";
      }
      return "Milestone freigeschaltet.";
    }

    function applyWeaponLevelBonus(track, levelReached) {
      const profile = activeProfile();
      const tune = tuningFor(track);

      if (track === "cannon") {
        state.weapon.cannonEffectiveness = Math.min(3.2, state.weapon.cannonEffectiveness + (profile.cannonDamageAdd * tune));
        if (levelReached % profile.cannonCooldownEvery === 0) {
          state.shotCooldown = Math.max(0.042, state.shotCooldown * tunedCooldownMult(profile.cannonCooldownMult, track));
        }
        return;
      }

      if (track === "laser") {
        state.weapon.laserDamage = Math.min(8, state.weapon.laserDamage + (profile.laserDamageAdd * tune));
        state.weapon.laserRange = Math.min(900, state.weapon.laserRange + (profile.laserRangeAdd * tune));
        state.weapon.laserCooldown = Math.max(0.07, state.weapon.laserCooldown * tunedCooldownMult(profile.laserCooldownMult, track));
        return;
      }

      if (track === "rocket") {
        state.weapon.rocketDamage = Math.min(80, state.weapon.rocketDamage + (profile.rocketDamageAdd * tune));
        state.weapon.rocketBlastRadius = Math.min(280, state.weapon.rocketBlastRadius + (profile.rocketRadiusAdd * tune));
        state.weapon.rocketCooldown = Math.max(2.2, state.weapon.rocketCooldown * tunedCooldownMult(profile.rocketCooldownMult, track));
        return;
      }

      if (track === "drill") {
        state.weapon.drillReach = Math.min(56, state.weapon.drillReach + (profile.drillReachAdd * tune));
        state.weapon.drillRadius = Math.min(24, state.weapon.drillRadius + (profile.drillRadiusAdd * tune));
        state.weapon.drillRechargeDelay = Math.max(1.3, state.weapon.drillRechargeDelay * tunedCooldownMult(profile.drillRechargeMult, track));
        return;
      }

      if (track === "plasma") {
        state.weapon.plasmaBurnDps = Math.min(7, state.weapon.plasmaBurnDps + (profile.plasmaBurnAdd * tune));
        state.weapon.plasmaRange = Math.min(900, state.weapon.plasmaRange + (profile.plasmaRangeAdd * tune));
        state.weapon.plasmaCooldown = Math.max(0.06, state.weapon.plasmaCooldown * tunedCooldownMult(profile.plasmaCooldownMult, track));
        return;
      }

      if (track === "shield") {
        state.shield.rechargeDelay = Math.max(2.8, state.shield.rechargeDelay * tunedCooldownMult(profile.shieldRechargeMult, track));
        state.shield.thornPulseRadius = Math.min(140, (state.shield.thornPulseRadius || 78) + (profile.shieldPulseAdd * tune));
        state.shield.thornBreakRadius = Math.min(180, (state.shield.thornBreakRadius || 105) + (profile.shieldBreakAdd * tune));
      }
    }

    function setTrackLevelTuning(track, value) {
      if (!(track in levelTuning)) return null;
      const clamped = Math.max(0.5, Math.min(2.5, value));
      levelTuning[track] = clamped;
      return clamped;
    }

    function adjustTrackLevelTuning(track, delta) {
      if (!(track in levelTuning)) return null;
      return setTrackLevelTuning(track, (levelTuning[track] || 1) + delta);
    }

    function getLevelTuningSnapshot() {
      return {
        profileId: activeProfileId,
        tracks: { ...levelTuning },
      };
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
        .map((u) => {
          const track = weaponUpgradeTrack[u.id] || null;
          const current = track ? (state.weaponLevels[track] || 0) : 0;
          const projected = track ? Math.min(20, current + 1) : 0;
          const milestone = track ? weaponLevelMilestones.find((m) => current < m && projected >= m) : null;

          const cardTierClass = track ? tierCardClassByLevel(projected) : "upgrade-card-tier-white";
          const textTierClass = track ? tierClassByLevel(projected) : "weapon-level-tier-white";
          const levelPreview = track
            ? `<br /><span class="upgrade-level-preview ${textTierClass}">${weaponTrackLabel(track)} L${current} -> L${projected}</span>`
            : "";
          const milestonePreview = milestone
            ? `<br /><span class="upgrade-milestone-note ${textTierClass}">Milestone L${milestone}: ${milestoneEffectText(track, milestone)}</span>`
            : "";

          return `
        <button data-action="upgrade" data-upgrade-id="${u.id}" class="upgrade-card ${cardTierClass}" style="width:100%;max-width:560px;text-align:left;display:block;line-height:1.4;white-space:normal;word-break:break-word;">
          <strong>[${isStatUpgrade(u) ? "Stat" : "Waffe"}] ${u.title}</strong><br />
          <span>${u.description}</span>${levelPreview}${milestonePreview}
        </button>
      `;
        })
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
      if (next <= current) return;

      for (let lvl = current + 1; lvl <= next; lvl += 1) {
        state.weaponLevels[track] = lvl;
        applyWeaponLevelBonus(track, lvl);

        for (const milestone of weaponLevelMilestones) {
          if (lvl >= milestone && (state.weaponMilestones[track] || 0) < milestone) {
            state.weaponMilestones[track] = milestone;
            applyWeaponMilestone(track, milestone);
            playSfx("upgrade");
          }
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
      setTrackLevelTuning,
      adjustTrackLevelTuning,
      getLevelTuningSnapshot,
    };
  }

  window.VoidProgression = {
    createProgressionSystem,
  };
})();
