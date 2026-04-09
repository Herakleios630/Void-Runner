(function () {
  function createEncountersSystem(deps) {
    const {
      state,
      WORLD,
      BOSS_VARIANTS,
      randomFrom,
      selectedDifficultyMode,
      createExplosion,
      playSfx,
      nextObjectId,
    } = deps;

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

      createExplosion(state.boss.x, state.boss.y, "#ff8e4f", 42);
      playSfx("levelup");
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

    return {
      spawnObject,
      spawnEdgeHazard,
      spawnBoss,
      spawnEnemyProjectile,
      spawnEnemyFlameBurst,
      updateBoss,
    };
  }

  window.VoidEncounters = {
    createEncountersSystem,
  };
})();
