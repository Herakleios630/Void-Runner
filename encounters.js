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
      worldSystem,
      cameraSystem,
    } = deps;

    const spawnedChunkEncounters = new Set();

    function chunkKey(cx, cy) {
      return `${cx},${cy}`;
    }

    function chunkCoord(value) {
      const size = worldSystem && typeof worldSystem.chunkSize === "number" ? worldSystem.chunkSize : 960;
      return Math.floor(value / size);
    }

    function chunkSeed(cx, cy) {
      const worldSeed = worldSystem && typeof worldSystem.getSeed === "function" ? worldSystem.getSeed() : 1;
      let x = (cx * 73856093) ^ (cy * 19349663) ^ (worldSeed * 83492791);
      x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
      x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
      return (x ^ (x >>> 16)) >>> 0;
    }

    function createChunkRng(seed) {
      let s = seed >>> 0;
      return function next() {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function spawnAngleFromSides(rand) {
      const side = Math.floor(rand() * 4);
      const jitter = (rand() - 0.5) * 1.1;
      if (side === 0) return 0 + jitter; // right
      if (side === 1) return Math.PI * 0.5 + jitter; // bottom
      if (side === 2) return Math.PI + jitter; // left
      return Math.PI * 1.5 + jitter; // top
    }

    function screenToWorld(screenX, screenY) {
      const camX = cameraSystem && typeof cameraSystem.getX === "function" ? cameraSystem.getX() : 0;
      const camY = cameraSystem && typeof cameraSystem.getY === "function" ? cameraSystem.getY() : 0;
      return {
        x: camX + (screenX - WORLD.width * 0.5),
        y: camY + (screenY - WORLD.height * 0.5),
      };
    }

    function createObjectBlueprint(rand, difficulty) {
      const alienShipChance = difficulty.id === "easy" ? 0.06 : difficulty.id === "hard" ? 0.18 : 0.12;
      const miniAlienChance = difficulty.id === "easy" ? 0.11 : difficulty.id === "hard" ? 0.15 : 0.13;
      const firstCut = miniAlienChance;
      const secondCut = firstCut + alienShipChance;

      const r = rand();
      let type = "debris";
      let size = 30;
      let hp = 999;
      let destructible = false;
      let collisionScale = 0.8;
      let corners = 8;

      if (r < firstCut) {
        type = "miniAlien";
        size = 14 + rand() * 10;
        hp = 3;
        destructible = true;
        collisionScale = 0.7;
        corners = 0;
      } else if (r < secondCut) {
        type = "alienShip";
        size = 20 + rand() * 10;
        hp = 6;
        destructible = true;
        collisionScale = 0.74;
        corners = 0;
      } else if (r < 0.42) {
        type = "smallRock";
        size = 11 + rand() * 12;
        hp = 3;
        destructible = true;
        collisionScale = 0.78;
        corners = 8;
      } else if (r < 0.66) {
        type = "mediumRock";
        size = 24 + rand() * 14;
        hp = 5;
        destructible = true;
        collisionScale = 0.8;
        corners = 9;
      } else if (r < 0.79) {
        type = "debris";
        size = 22 + rand() * 18;
        collisionScale = 0.76;
        corners = 8;
      } else {
        type = "boulder";
        size = 36 + rand() * 28;
        collisionScale = 0.82;
        corners = 11;
      }

      return {
        type,
        size,
        hp,
        destructible,
        collisionScale,
        corners,
      };
    }

    function spawnObject(options = {}) {
      const rand = typeof options.rand === "function" ? options.rand : Math.random;
      const difficulty = selectedDifficultyMode();
      const blueprint = createObjectBlueprint(rand, difficulty);
      const focusX = state.ship && Number.isFinite(state.ship.x) ? state.ship.x : WORLD.width * 0.5;
      const focusY = state.ship && Number.isFinite(state.ship.y) ? state.ship.y : WORLD.height * 0.5;
      const angle = typeof options.angle === "number" ? options.angle : spawnAngleFromSides(rand);
      const spawnRing = Math.max(WORLD.width, WORLD.height) * 0.64 + blueprint.size + (options.spawnPadding || 32);
      const spawnX = focusX + Math.cos(angle) * spawnRing;
      const spawnY = focusY + Math.sin(angle) * spawnRing;
      const targetX = focusX + (rand() - 0.5) * WORLD.width * 0.22;
      const targetY = focusY + (rand() - 0.5) * WORLD.height * 0.22;
      const dx = targetX - spawnX;
      const dy = targetY - spawnY;
      const len = Math.hypot(dx, dy) || 1;
      const baseSpeed = (WORLD.scrollSpeed + rand() * 120) * difficulty.objectSpeedMult;
      const vx = (dx / len) * baseSpeed + (rand() - 0.5) * 42;
      const vy = (dy / len) * baseSpeed + (rand() - 0.5) * 42;
      const rockProfile = blueprint.corners > 0 ? Array.from({ length: blueprint.corners }, () => 0.72 + rand() * 0.26) : null;
      const spawnWorld = screenToWorld(spawnX, spawnY);

      state.objects.push({
        id: nextObjectId(),
        type: blueprint.type,
        x: spawnX,
        y: spawnY,
        worldX: spawnWorld.x,
        worldY: spawnWorld.y,
        vx,
        vy,
        size: blueprint.size,
        hp: blueprint.hp,
        destroyed: false,
        destructible: blueprint.destructible,
        collisionRadius: blueprint.size * blueprint.collisionScale,
        corners: blueprint.corners,
        rockProfile,
        spin: (rand() - 0.5) * 2,
        angle: rand() * Math.PI * 2,
        passed: true,
        nextShotAt: blueprint.type === "miniAlien" ? state.time + 1.2 + rand() * 2.4 : blueprint.type === "alienShip" ? state.time + 1.4 + rand() * 2.2 : null,
      });
    }

    function spawnEdgeHazard(options = {}) {
      const rand = typeof options.rand === "function" ? options.rand : Math.random;
      const difficulty = selectedDifficultyMode();
      const focusX = state.ship && Number.isFinite(state.ship.x) ? state.ship.x : WORLD.width * 0.5;
      const focusY = state.ship && Number.isFinite(state.ship.y) ? state.ship.y : WORLD.height * 0.5;
      const angle = typeof options.angle === "number" ? options.angle : spawnAngleFromSides(rand);
      const side = Math.sin(angle) < 0 ? "top" : "bottom";
      const r = rand();

      if (r < 0.36) {
        const radius = 270 + rand() * 150;
        const spawnRing = Math.max(WORLD.width, WORLD.height) * 0.72 + radius + (options.spawnPadding || 20);
        const x = focusX + Math.cos(angle) * spawnRing;
        const y = focusY + Math.sin(angle) * spawnRing;
        const pullDx = focusX - x;
        const pullDy = focusY - y;
        const pullLen = Math.hypot(pullDx, pullDy) || 1;
        const speed = WORLD.scrollSpeed * (0.84 + rand() * 0.22) * difficulty.edgeSpeedMult;
        const spawnWorld = screenToWorld(x, y);
        state.edgeHazards.push({
          kind: "planet",
          side,
          x,
          y,
          worldX: spawnWorld.x,
          worldY: spawnWorld.y,
          radius,
          hitRadius: radius * 0.93,
          vx: (pullDx / pullLen) * speed,
          vy: (pullDy / pullLen) * speed,
          angle: rand() * Math.PI * 2,
          spin: (rand() - 0.5) * 0.12,
        });
        return;
      }

      if (r < 0.72) {
        const radius = 48 + rand() * 22;
        const spawnRing = Math.max(WORLD.width, WORLD.height) * 0.72 + radius + (options.spawnPadding || 20);
        const x = focusX + Math.cos(angle) * spawnRing;
        const y = focusY + Math.sin(angle) * spawnRing;
        const pullDx = focusX - x;
        const pullDy = focusY - y;
        const pullLen = Math.hypot(pullDx, pullDy) || 1;
        const speed = WORLD.scrollSpeed * (1 + rand() * 0.25) * difficulty.edgeSpeedMult;
        const spawnWorld = screenToWorld(x, y);
        state.edgeHazards.push({
          kind: "station",
          side,
          x,
          y,
          worldX: spawnWorld.x,
          worldY: spawnWorld.y,
          radius,
          hitRadius: radius * 0.66,
          vx: (pullDx / pullLen) * speed,
          vy: (pullDy / pullLen) * speed,
          angle: rand() * Math.PI * 2,
          spin: (rand() - 0.5) * 0.4,
        });
        return;
      }

      const radius = 44 + rand() * 18;
      const spawnRing = Math.max(WORLD.width, WORLD.height) * 0.72 + radius + (options.spawnPadding || 20);
      const x = focusX + Math.cos(angle) * spawnRing;
      const y = focusY + Math.sin(angle) * spawnRing;
      const pullDx = focusX - x;
      const pullDy = focusY - y;
      const pullLen = Math.hypot(pullDx, pullDy) || 1;
      const speed = WORLD.scrollSpeed * (0.92 + rand() * 0.22) * difficulty.edgeSpeedMult;
      const spawnWorld = screenToWorld(x, y);
      state.edgeHazards.push({
        kind: "blackHole",
        side,
        x,
        y,
        worldX: spawnWorld.x,
        worldY: spawnWorld.y,
        radius,
        hitRadius: radius * 0.6,
        vx: (pullDx / pullLen) * speed,
        vy: (pullDy / pullLen) * speed,
        angle: rand() * Math.PI * 2,
        spin: (rand() - 0.5) * 0.8,
      });
    }

    function spawnChunkEncounter(cx, cy) {
      const key = chunkKey(cx, cy);
      if (spawnedChunkEncounters.has(key)) return false;
      spawnedChunkEncounters.add(key);

      const rand = createChunkRng(chunkSeed(cx, cy));
      const difficulty = selectedDifficultyMode();
      const worldDistance = Math.hypot(cx, cy);
      const distancePressure = Math.min(1.4, worldDistance * 0.08);
      const baseObjects = difficulty.id === "hard" ? 3 : 2;
      const bonusObjects = Math.floor(distancePressure * (difficulty.id === "hard" ? 2 : 1));
      const objectCount = 1 + Math.floor(rand() * (baseObjects + bonusObjects));

      for (let i = 0; i < objectCount; i += 1) {
        spawnObject({
          rand,
          spawnPadding: 40 + rand() * 90,
        });
      }

      const hazardChance = Math.min(0.88, (difficulty.id === "hard" ? 0.72 : 0.55) + distancePressure * 0.12);
      if (rand() < hazardChance) {
        spawnEdgeHazard({
          rand,
          spawnPadding: 20 + rand() * 70,
        });
      }

      return true;
    }

    function pruneChunkEncounterCache(centerCx, centerCy) {
      const keepRadius = 6;
      for (const key of spawnedChunkEncounters) {
        const [rawX, rawY] = key.split(",");
        const x = Number.parseInt(rawX, 10);
        const y = Number.parseInt(rawY, 10);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          spawnedChunkEncounters.delete(key);
          continue;
        }
        if (Math.abs(x - centerCx) > keepRadius || Math.abs(y - centerCy) > keepRadius) {
          spawnedChunkEncounters.delete(key);
        }
      }
    }

    function spawnChunksAround(cameraX, cameraY, radius = 1) {
      const effectiveX = Number.isFinite(cameraX) ? cameraX : (cameraSystem && typeof cameraSystem.getX === "function" ? cameraSystem.getX() : 0);
      const effectiveY = Number.isFinite(cameraY) ? cameraY : (cameraSystem && typeof cameraSystem.getY === "function" ? cameraSystem.getY() : 0);
      const centerCx = chunkCoord(effectiveX);
      const centerCy = chunkCoord(effectiveY);
      const speed = state.ship ? Math.hypot(state.ship.vx || 0, state.ship.vy || 0) : 0;
      const dynamicRadius = Math.max(radius, speed > 420 ? 2 : radius);

      pruneChunkEncounterCache(centerCx, centerCy);

      for (let y = centerCy - dynamicRadius; y <= centerCy + dynamicRadius; y += 1) {
        for (let x = centerCx - dynamicRadius; x <= centerCx + dynamicRadius; x += 1) {
          spawnChunkEncounter(x, y);
        }
      }
    }

    function resetChunkSpawns() {
      spawnedChunkEncounters.clear();
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
      const worldFrom = screenToWorld(fromX, fromY);
      state.bossProjectiles.push({
        x: fromX,
        y: fromY,
        worldX: worldFrom.x,
        worldY: worldFrom.y,
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
      const worldFrom = screenToWorld(fromX, fromY);
      for (let i = 0; i < pellets; i += 1) {
        const t = pellets <= 1 ? 0 : i / (pellets - 1);
        const spread = (t - 0.5) * 0.55;
        const a = aim + spread + (Math.random() - 0.5) * 0.06;
        const speed = 230 + Math.random() * 130;
        const life = 0.42 + Math.random() * 0.32;
        state.plasmaBursts.push({
          x: fromX,
          y: fromY,
          worldX: worldFrom.x,
          worldY: worldFrom.y,
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
      spawnChunksAround,
      resetChunkSpawns,
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
