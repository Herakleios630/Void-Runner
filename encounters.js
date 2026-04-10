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
    const chunkEventMap = new Map(); // key -> zone label for debug overlay
    let gameplaySunsCache = [];
    let gameplaySunsCacheUntil = -1;

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

    function worldToScreen(worldX, worldY) {
      if (cameraSystem && typeof cameraSystem.worldToScreen === "function") {
        return cameraSystem.worldToScreen(worldX, worldY, 1, WORLD.width, WORLD.height);
      }
      return {
        x: worldX,
        y: worldY,
      };
    }

    function getGameplaySuns() {
      if (state.time < gameplaySunsCacheUntil) return gameplaySunsCache;
      gameplaySunsCacheUntil = state.time + 0.35;

      if (!worldSystem || typeof worldSystem.getBackgroundObjects !== "function") {
        gameplaySunsCache = [];
        return gameplaySunsCache;
      }

      const out = [];
      const bgObjects = worldSystem.getBackgroundObjects();
      for (const obj of bgObjects) {
        if (obj.type !== "sun") continue;
        if ((obj.parallax || 1) < 0.95) continue;
        out.push({
          x: obj.x,
          y: obj.y,
          radius: obj.radius || 180,
        });
      }
      gameplaySunsCache = out;
      return gameplaySunsCache;
    }

    function isWithinGameplaySystem(worldX, worldY) {
      return getGameplaySystemInfluence(worldX, worldY) >= 0.33;
    }

    function getGameplaySystemInfluence(worldX, worldY) {
      if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return 0;
      if (worldSystem && typeof worldSystem.estimateSystemInfluence === "function") {
        return worldSystem.estimateSystemInfluence(worldX, worldY);
      }
      const suns = getGameplaySuns();
      if (suns.length <= 0) return 0;
      const chunkSize = worldSystem && typeof worldSystem.chunkSize === "number" ? worldSystem.chunkSize : 960;
      let influence = 0;

      for (const sun of suns) {
        const influenceRadius = Math.max(chunkSize * 7.8, sun.radius * 4.4);
        const d = Math.hypot(worldX - sun.x, worldY - sun.y);
        const t = Math.max(0, 1 - d / influenceRadius);
        if (t > influence) influence = t;
      }
      return influence;
    }

    function createEnemyBlueprint(rand, difficulty) {
      const shipBias = difficulty.id === "hard" ? 0.44 : difficulty.id === "easy" ? 0.24 : 0.34;
      if (rand() < shipBias) {
        return {
          type: "alienShip",
          size: 20 + rand() * 10,
          hp: 6,
          destructible: true,
          collisionScale: 0.74,
          corners: 0,
        };
      }
      return {
        type: "miniAlien",
        size: 14 + rand() * 10,
        hp: 3,
        destructible: true,
        collisionScale: 0.7,
        corners: 0,
      };
    }

    function selectEnemyWeapon(type, rand) {
      const r = rand();
      if (type === "miniAlien") {
        if (r < 0.36) return "acid";
        if (r < 0.62) return "laser";
        if (r < 0.84) return "plasma";
        return "cannon";
      }
      if (type === "alienShip") {
        if (r < 0.42) return "laser";
        if (r < 0.7) return "rocket";
        if (r < 0.87) return "acid";
        return "cannon";
      }
      return null;
    }

    function createObjectBlueprint(rand, difficulty, options = {}) {
      if (options.systemInterior) {
        return createEnemyBlueprint(rand, difficulty);
      }

      const systemInfluence = Math.max(0, Math.min(1, Number.isFinite(options.systemInfluence) ? options.systemInfluence : 0));

      const alienShipChance = difficulty.id === "easy" ? 0.06 : difficulty.id === "hard" ? 0.18 : 0.12;
      const miniAlienChance = difficulty.id === "easy" ? 0.11 : difficulty.id === "hard" ? 0.15 : 0.13;
      const firstCut = miniAlienChance + systemInfluence * 0.22;
      const secondCut = firstCut + alienShipChance + systemInfluence * 0.2;

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
        hp = 4;
        destructible = true;
        collisionScale = 0.78;
        corners = 8;
      } else if (r < 0.66) {
        type = "mediumRock";
        size = 24 + rand() * 14;
        hp = 8;
        destructible = true;
        collisionScale = 0.8;
        corners = 9;
      } else if (r < 0.79) {
        type = systemInfluence > 0.45 ? "smallRock" : "debris";
        size = 22 + rand() * 18;
        hp = 11;
        destructible = true;
        collisionScale = 0.76;
        corners = 8;
      } else {
        type = "boulder";
        size = 36 + rand() * 28;
        hp = 18;
        destructible = true;
        collisionScale = 0.82;
        corners = 11;
      }

      if (type === "smallRock" || type === "mediumRock" || type === "boulder") {
        const specialRoll = rand();
        if (specialRoll < 0.018) {
          type = "goldAsteroid";
          size = Math.max(18, size * (0.84 + rand() * 0.22));
          hp = Math.max(8, Math.round(hp * (1.1 + rand() * 0.3)));
          collisionScale = 0.8;
          corners = 10;
        } else if (specialRoll < 0.04) {
          type = "ironAsteroid";
          size = Math.max(20, size * (0.9 + rand() * 0.22));
          hp = Math.max(10, Math.round(hp * (1.18 + rand() * 0.34)));
          collisionScale = 0.82;
          corners = 10;
        }
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

    function forcedObjectBlueprint(type, rand) {
      if (type === "miniAlien") {
        return {
          type,
          size: 14 + rand() * 10,
          hp: 3,
          destructible: true,
          collisionScale: 0.7,
          corners: 0,
        };
      }
      if (type === "alienShip") {
        return {
          type,
          size: 20 + rand() * 10,
          hp: 6,
          destructible: true,
          collisionScale: 0.74,
          corners: 0,
        };
      }
      if (type === "smallRock") {
        return {
          type,
          size: 11 + rand() * 12,
          hp: 4,
          destructible: true,
          collisionScale: 0.78,
          corners: 8,
        };
      }
      if (type === "mediumRock") {
        return {
          type,
          size: 24 + rand() * 14,
          hp: 8,
          destructible: true,
          collisionScale: 0.8,
          corners: 9,
        };
      }
      if (type === "boulder") {
        return {
          type,
          size: 36 + rand() * 28,
          hp: 18,
          destructible: true,
          collisionScale: 0.82,
          corners: 11,
        };
      }
      if (type === "debris") {
        return {
          type,
          size: 22 + rand() * 18,
          hp: 11,
          destructible: true,
          collisionScale: 0.76,
          corners: 8,
        };
      }
      if (type === "goldAsteroid") {
        return {
          type,
          size: 22 + rand() * 14,
          hp: 12,
          destructible: true,
          collisionScale: 0.8,
          corners: 10,
        };
      }
      if (type === "ironAsteroid") {
        return {
          type,
          size: 24 + rand() * 15,
          hp: 14,
          destructible: true,
          collisionScale: 0.82,
          corners: 10,
        };
      }
      if (type === "mothership") {
        return {
          type,
          size: 46 + rand() * 18,
          hp: 38,
          destructible: true,
          collisionScale: 0.86,
          corners: 0,
        };
      }
      return null;
    }

    function spawnObject(options = {}) {
      const rand = typeof options.rand === "function" ? options.rand : Math.random;
      const difficulty = selectedDifficultyMode();
      const focusX = state.ship && Number.isFinite(state.ship.x) ? state.ship.x : WORLD.width * 0.5;
      const focusY = state.ship && Number.isFinite(state.ship.y) ? state.ship.y : WORLD.height * 0.5;
      const angle = typeof options.angle === "number" ? options.angle : spawnAngleFromSides(rand);
      const probeRing = Math.max(WORLD.width, WORLD.height) * 0.64 + (options.spawnPadding || 32);
      const probeX = focusX + Math.cos(angle) * probeRing;
      const probeY = focusY + Math.sin(angle) * probeRing;
      const probeWorld = screenToWorld(probeX, probeY);
      const probeInfluence = getGameplaySystemInfluence(probeWorld.x, probeWorld.y);
      const systemInterior = options.systemInterior === true
        || (options.systemInterior !== false && probeInfluence >= 0.33);

      const forced = options.forceType ? forcedObjectBlueprint(options.forceType, rand) : null;
      const blueprint = forced || createObjectBlueprint(rand, difficulty, {
        systemInterior,
        systemInfluence: probeInfluence,
      });
      const isEnemy = blueprint.type === "miniAlien" || blueprint.type === "alienShip" || blueprint.type === "mothership";
      const baseAggro = Math.min(WORLD.width, WORLD.height) * 0.5;
      const aggroRange = baseAggro * (0.8 + rand() * 0.4);
      const disengageRange = aggroRange * (1.55 + rand() * 0.3);

      const spawnRing = Math.max(WORLD.width, WORLD.height) * 0.64 + blueprint.size + (options.spawnPadding || 32);
      const spawnX = focusX + Math.cos(angle) * spawnRing;
      const spawnY = focusY + Math.sin(angle) * spawnRing;
      // Enemies should only commit toward the player after aggro lock, not on spawn.
      const vx = Number.isFinite(options.initialVx) ? options.initialVx : 0;
      const vy = Number.isFinite(options.initialVy) ? options.initialVy : 0;
      const rockProfile = blueprint.corners > 0 ? Array.from({ length: blueprint.corners }, () => 0.72 + rand() * 0.26) : null;
      const spawnWorld = screenToWorld(spawnX, spawnY);
      const spawnInfluence = getGameplaySystemInfluence(spawnWorld.x, spawnWorld.y);
      let enemyWeapon = isEnemy ? selectEnemyWeapon(blueprint.type, rand) : null;
      if (blueprint.type === "mothership") {
        enemyWeapon = rand() < 0.5 ? "rocket" : "plasma";
      }

      const spawnedObj = {
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
        maxHp: blueprint.hp,
        destroyed: false,
        destructible: blueprint.destructible,
        collisionRadius: blueprint.size * blueprint.collisionScale,
        corners: blueprint.corners,
        rockProfile,
        spin: (rand() - 0.5) * 2,
        angle: rand() * Math.PI * 2,
        passed: true,
        enemy: isEnemy,
        aggroLocked: false,
        aggroRange: isEnemy ? aggroRange : 0,
        disengageRange: isEnemy ? disengageRange : 0,
        aggroUntil: 0,
        chaseSpeed: isEnemy ? (blueprint.type === "alienShip" ? 300 : blueprint.type === "mothership" ? 95 : 270) * difficulty.objectSpeedMult : 0,
        chaseAccel: isEnemy ? (blueprint.type === "alienShip" ? 300 : blueprint.type === "mothership" ? 140 : 270) : 0,
        steering: isEnemy ? (blueprint.type === "alienShip" ? 1.45 : blueprint.type === "mothership" ? 0.55 : 1.25) : 0,
        cruiseSpeed: isEnemy ? (blueprint.type === "alienShip" ? 150 : blueprint.type === "mothership" ? 80 : 130) * difficulty.objectSpeedMult : 0,
        preferredRange: isEnemy ? (blueprint.type === "alienShip" ? 220 + rand() * 80 : blueprint.type === "mothership" ? 280 + rand() * 100 : 150 + rand() * 70) : 0,
        nextShotAt: blueprint.type === "miniAlien"
          ? state.time + 1.2 + rand() * 2.4
          : blueprint.type === "alienShip"
            ? state.time + 1.4 + rand() * 2.2
            : blueprint.type === "mothership"
              ? state.time + 2.2 + rand() * 1.8
              : null,
        enemyWeapon,
        systemInfluence: spawnInfluence,
      };

      if (blueprint.type === "mothership") {
        spawnedObj.aggroLocked = true;
        spawnedObj.aggroUntil = state.time + 99999;
        spawnedObj.nextEscortAt = state.time + 6 + rand() * 4;
        spawnedObj.escortCooldown = 5.6 + rand() * 3.2;
        spawnedObj.escortWaveMin = 1;
        spawnedObj.escortWaveMax = 2;
      }

      state.objects.push(spawnedObj);
      return spawnedObj;
    }

    function spawnEscortNearMothership(mothership, rand) {
      const escort = spawnObject({
        rand,
        forceType: "alienShip",
        systemInterior: true,
        spawnPadding: 40 + rand() * 90,
      });
      if (!escort || !Number.isFinite(mothership.worldX) || !Number.isFinite(mothership.worldY)) return escort;

      const angle = rand() * Math.PI * 2;
      const distance = mothership.size * (0.9 + rand() * 1.1);
      escort.worldX = mothership.worldX + Math.cos(angle) * distance;
      escort.worldY = mothership.worldY + Math.sin(angle) * distance;
      const escortScreen = worldToScreen(escort.worldX, escort.worldY);
      escort.x = escortScreen.x;
      escort.y = escortScreen.y;
      escort.vx = (mothership.vx || 0) * 0.5 + Math.cos(angle) * (40 + rand() * 70);
      escort.vy = (mothership.vy || 0) * 0.5 + Math.sin(angle) * (40 + rand() * 70);
      escort.aggroLocked = true;
      escort.aggroUntil = state.time + 20;
      return escort;
    }

    function spawnMothershipEncounter(rand) {
      const mothership = spawnObject({
        rand,
        forceType: "mothership",
        systemInterior: true,
        spawnPadding: 120 + rand() * 170,
      });
      if (!mothership) return null;

      const escortCount = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < escortCount; i += 1) {
        spawnEscortNearMothership(mothership, rand);
      }
      return mothership;
    }

    function spawnFleetFormation(rand, options = {}) {
      const type = options.type || (rand() < 0.55 ? "wedge" : "line");
      const groupId = `fleet:${Math.floor(state.time * 10)}:${Math.floor(rand() * 100000)}`;
      const baseAngle = Number.isFinite(options.baseAngle) ? options.baseAngle : spawnAngleFromSides(rand);
      const spacing = Number.isFinite(options.spacing) ? options.spacing : (44 + rand() * 22);
      const heading = baseAngle + Math.PI;
      const speed = Number.isFinite(options.speed) ? options.speed : (90 + rand() * 70);

      const offsets = [];
      if (type === "line") {
        offsets.push({ x: 0, y: 0 });
        offsets.push({ x: -spacing, y: 0 });
        offsets.push({ x: spacing, y: 0 });
        if (rand() < 0.55) offsets.push({ x: -spacing * 2, y: 0 });
        if (rand() < 0.55) offsets.push({ x: spacing * 2, y: 0 });
      } else {
        offsets.push({ x: 0, y: 0 });
        offsets.push({ x: -spacing * 0.8, y: spacing * 0.55 });
        offsets.push({ x: spacing * 0.8, y: spacing * 0.55 });
        offsets.push({ x: -spacing * 1.55, y: spacing * 1.1 });
        offsets.push({ x: spacing * 1.55, y: spacing * 1.1 });
      }

      const cosH = Math.cos(heading);
      const sinH = Math.sin(heading);
      const cosN = -sinH;
      const sinN = cosH;

      for (let i = 0; i < offsets.length; i += 1) {
        const offset = offsets[i];
        const kindRoll = rand();
        const forceType = i === 0
          ? (kindRoll < 0.75 ? "alienShip" : "miniAlien")
          : (kindRoll < 0.55 ? "miniAlien" : "alienShip");
        const spawn = spawnObject({
          rand,
          forceType,
          systemInterior: true,
          angle: baseAngle + (rand() - 0.5) * 0.08,
          spawnPadding: 86 + rand() * 110,
          initialVx: cosH * speed,
          initialVy: sinH * speed,
        });
        if (!spawn) continue;

        const shiftX = cosH * offset.y + cosN * offset.x;
        const shiftY = sinH * offset.y + sinN * offset.x;
        spawn.worldX += shiftX;
        spawn.worldY += shiftY;
        const sPos = worldToScreen(spawn.worldX, spawn.worldY);
        spawn.x = sPos.x;
        spawn.y = sPos.y;
        spawn.patrolHeading = heading;
        spawn.patrolSpeed = speed;
        spawn.patrolUntil = state.time + 14 + rand() * 10;
        spawn.groupId = groupId;
      }
    }

    function spawnFactionEncounter(rand) {
      const axis = rand() * Math.PI * 2;
      const encounterType = rand() < 0.5 ? "crossfire" : "chase";
      const groups = [
        { name: "raider", angle: axis + Math.PI, speed: 95 + rand() * 55 },
        { name: "scavenger", angle: encounterType === "crossfire" ? axis : axis + Math.PI + (rand() - 0.5) * 0.4, speed: 85 + rand() * 50 },
      ];

      for (const g of groups) {
        const size = 2 + Math.floor(rand() * 3);
        const baseAngle = g.angle;
        for (let i = 0; i < size; i += 1) {
          const forceType = rand() < 0.5 ? "alienShip" : "miniAlien";
          const spawn = spawnObject({
            rand,
            forceType,
            systemInterior: true,
            angle: baseAngle + (rand() - 0.5) * 0.24,
            spawnPadding: 90 + rand() * 130,
            initialVx: Math.cos(g.angle) * g.speed,
            initialVy: Math.sin(g.angle) * g.speed,
          });
          if (!spawn) continue;
          spawn.faction = g.name;
          spawn.patrolHeading = g.angle;
          spawn.patrolSpeed = g.speed;
          spawn.patrolUntil = state.time + 16 + rand() * 12;
        }
      }
    }

    function spawnChunkEncounter(cx, cy) {
      const key = chunkKey(cx, cy);
      if (spawnedChunkEncounters.has(key)) return false;
      spawnedChunkEncounters.add(key);

      const rand = createChunkRng(chunkSeed(cx, cy));
      const difficulty = selectedDifficultyMode();
      const worldDistance = Math.hypot(cx, cy);
      const distancePressure = Math.min(1.4, worldDistance * 0.08);
      const chunkSize = worldSystem && typeof worldSystem.chunkSize === "number" ? worldSystem.chunkSize : 960;
      const chunkCenterX = (cx + 0.5) * chunkSize;
      const chunkCenterY = (cy + 0.5) * chunkSize;
      const centerInfluence = getGameplaySystemInfluence(chunkCenterX, chunkCenterY);
      const insideSystem = centerInfluence >= 0.33;
      const interstellarZone = centerInfluence < 0.2;
      const baseObjects = insideSystem ? (difficulty.id === "hard" ? 2 : 1) : (difficulty.id === "hard" ? 3 : 2);
      const bonusObjects = Math.floor(distancePressure * (insideSystem ? 1 : (difficulty.id === "hard" ? 2 : 1)));
      const objectCount = 1 + Math.floor(rand() * (baseObjects + bonusObjects));

      for (let i = 0; i < objectCount; i += 1) {
        spawnObject({
          rand,
          systemInterior: insideSystem,
          spawnPadding: 40 + rand() * 90,
        });
      }

      // Clustered asteroid fields are intentionally outside gameplay solar systems.
      if (interstellarZone && rand() < 0.74) {
        const clusterCount = 1 + Math.floor(rand() * (distancePressure > 0.7 ? 2 : 1));
        for (let c = 0; c < clusterCount; c += 1) {
          const baseAngle = spawnAngleFromSides(rand);
          const clusterSize = 4 + Math.floor(rand() * 5);
          for (let i = 0; i < clusterSize; i += 1) {
            const pick = rand();
            const forcedType = pick < 0.52 ? "smallRock" : pick < 0.84 ? "mediumRock" : pick < 0.95 ? "debris" : "boulder";
            spawnObject({
              rand,
              forceType: forcedType,
              angle: baseAngle + (rand() - 0.5) * 0.6,
              spawnPadding: 55 + rand() * 130,
            });
          }
        }
      }

      // Debris clusters in interstellar space improve readability between major systems.
      if (interstellarZone && rand() < 0.58) {
        const debrisClusterCount = 1 + Math.floor(rand() * (distancePressure > 0.85 ? 2 : 1));
        for (let c = 0; c < debrisClusterCount; c += 1) {
          const baseAngle = spawnAngleFromSides(rand);
          const debrisCount = 3 + Math.floor(rand() * 4);
          for (let i = 0; i < debrisCount; i += 1) {
            const pick = rand();
            const forcedType = pick < 0.66 ? "debris" : (pick < 0.88 ? "smallRock" : "mediumRock");
            spawnObject({
              rand,
              forceType: forcedType,
              angle: baseAngle + (rand() - 0.5) * 0.42,
              spawnPadding: 68 + rand() * 150,
            });
          }
        }
      }

      // Interstellar patrols: small enemy wings that occasionally roam between systems.
      const patrolChance = 0.16 + Math.min(0.14, distancePressure * 0.08) + (difficulty.id === "hard" ? 0.05 : 0);
      if (interstellarZone && rand() < patrolChance) {
        const patrolSize = difficulty.id === "hard"
          ? (2 + Math.floor(rand() * 3))
          : (difficulty.id === "easy" ? (2 + Math.floor(rand() * 2)) : (2 + Math.floor(rand() * 2)));
        const patrolAngle = spawnAngleFromSides(rand);
        for (let i = 0; i < patrolSize; i += 1) {
          spawnObject({
            rand,
            systemInterior: true,
            angle: patrolAngle + (rand() - 0.5) * 0.35,
            spawnPadding: 72 + rand() * 120,
          });
        }
      }

      // Record zone type for debug overlay.
      if (!chunkEventMap.has(key)) {
        chunkEventMap.set(key, insideSystem ? "system" : (interstellarZone ? "interstellar" : "edge"));
      }

      // Dynamic interstellar events: mutually exclusive, ~30% of interstellar chunks.
      // Ambush: coordinated multi-wing enemy attack, pre-aggroed.
      // Drift-Feld: dense isotropic debris cloud - tight ring for visible density.
      // Schrottspur: linear wreckage trail along a clear axis.
      // Meteorstrom: directed flow with high relative velocity.
      if (interstellarZone && rand() < 0.30) {
        const eventType = rand();
        if (eventType < 0.25) {
          // Ambush: 2-3 attack wings converging from different angles, enemies pre-aggroed.
          chunkEventMap.set(key, "ambush");
          const sideCount = 2 + Math.floor(rand() * 2);
          const baseAngle = rand() * Math.PI * 2;
          for (let s = 0; s < sideCount; s += 1) {
            const wingAngle = baseAngle + (s / sideCount) * Math.PI * 2;
            const wingSize = difficulty.id === "hard" ? (3 + Math.floor(rand() * 3)) : (2 + Math.floor(rand() * 2));
            for (let i = 0; i < wingSize; i += 1) {
              spawnObject({
                rand,
                systemInterior: true,
                angle: wingAngle + (rand() - 0.5) * 0.28,
                spawnPadding: 80 + rand() * 100,
              });
              // Pre-aggro the last spawned enemy so the ambush is immediately active.
              const spawned = state.objects[state.objects.length - 1];
              if (spawned && spawned.enemy) {
                spawned.aggroLocked = true;
                spawned.aggroUntil = state.time + 30;
              }
            }
          }
        } else if (eventType < 0.5) {
          // Drift-Feld: dense debris cloud - tight uniform ring so it reads as a wall.
          chunkEventMap.set(key, "drift");
          const fieldSize = 20 + Math.floor(rand() * 12);
          for (let i = 0; i < fieldSize; i += 1) {
            const pick = rand();
            const forcedType = pick < 0.5 ? "smallRock" : (pick < 0.78 ? "debris" : "mediumRock");
            spawnObject({
              rand,
              forceType: forcedType,
              angle: rand() * Math.PI * 2,
              spawnPadding: -20 + rand() * 80,
            });
          }
        } else if (eventType < 0.75) {
          // Schrottspur: dense debris along one straight axis - clearly directional.
          chunkEventMap.set(key, "trail");
          const trailAngle = rand() * Math.PI;
          const trailCount = 14 + Math.floor(rand() * 8);
          for (let i = 0; i < trailCount; i += 1) {
            const side = rand() < 0.5 ? 0 : Math.PI;
            const pick = rand();
            const forcedType = pick < 0.70 ? "debris" : (pick < 0.88 ? "smallRock" : "mediumRock");
            spawnObject({
              rand,
              forceType: forcedType,
              angle: trailAngle + side + (rand() - 0.5) * 0.18,
              spawnPadding: -10 + rand() * 160,
            });
          }
        } else {
          // Meteorstrom: one-way fast stream. Objects are spawned with directed velocity.
          chunkEventMap.set(key, "meteor");
          const flowAngle = rand() * Math.PI * 2;
          const flowSpeed = 190 + rand() * 170;
          const meteorCount = 12 + Math.floor(rand() * 10);
          for (let i = 0; i < meteorCount; i += 1) {
            const pick = rand();
            const forcedType = pick < 0.54 ? "debris" : (pick < 0.84 ? "smallRock" : (pick < 0.95 ? "mediumRock" : "boulder"));
            const vScale = 0.74 + rand() * 0.52;
            spawnObject({
              rand,
              forceType: forcedType,
              angle: flowAngle + Math.PI + (rand() - 0.5) * 0.42,
              spawnPadding: -20 + rand() * 120,
              initialVx: Math.cos(flowAngle) * flowSpeed * vScale,
              initialVy: Math.sin(flowAngle) * flowSpeed * vScale,
            });
          }
        }
      }

      const mothershipChance = 0.055 + Math.min(0.04, distancePressure * 0.03) + (difficulty.id === "hard" ? 0.025 : 0);
      if (interstellarZone && rand() < mothershipChance) {
        spawnMothershipEncounter(rand);
      }

      const fleetChance = 0.18 + Math.min(0.12, distancePressure * 0.07);
      if ((interstellarZone || !insideSystem) && rand() < fleetChance) {
        chunkEventMap.set(key, "fleet");
        spawnFleetFormation(rand, {
          type: rand() < 0.6 ? "wedge" : "line",
          baseAngle: spawnAngleFromSides(rand),
          spacing: 42 + rand() * 24,
          speed: 96 + rand() * 74,
        });
      }

      const factionChance = interstellarZone ? 0.11 : 0.05;
      if (rand() < factionChance) {
        chunkEventMap.set(key, "faction");
        spawnFactionEncounter(rand);
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
          chunkEventMap.delete(key);
        }
      }
    }

    function spawnChunksAround(cameraX, cameraY, radius = 1) {
      const effectiveX = Number.isFinite(cameraX) ? cameraX : (cameraSystem && typeof cameraSystem.getX === "function" ? cameraSystem.getX() : 0);
      const effectiveY = Number.isFinite(cameraY) ? cameraY : (cameraSystem && typeof cameraSystem.getY === "function" ? cameraSystem.getY() : 0);
      const centerCx = chunkCoord(effectiveX);
      const centerCy = chunkCoord(effectiveY);
      const difficulty = selectedDifficultyMode();
      const speed = state.ship ? Math.hypot(state.ship.vx || 0, state.ship.vy || 0) : 0;
      const dynamicRadius = Math.max(radius, speed > 420 ? 2 : radius);
      const maxNewChunkSpawns = Math.max(1, (speed > 420 ? 4 : 2) + (difficulty.id === "hard" ? 1 : 0));

      pruneChunkEncounterCache(centerCx, centerCy);

      const coords = [];
      for (let y = centerCy - dynamicRadius; y <= centerCy + dynamicRadius; y += 1) {
        for (let x = centerCx - dynamicRadius; x <= centerCx + dynamicRadius; x += 1) {
          const manhattan = Math.abs(x - centerCx) + Math.abs(y - centerCy);
          coords.push({ x, y, manhattan });
        }
      }
      coords.sort((a, b) => a.manhattan - b.manhattan);

      let spawnedNow = 0;
      for (const entry of coords) {
        if (spawnedNow >= maxNewChunkSpawns) break;
        if (spawnChunkEncounter(entry.x, entry.y)) {
          spawnedNow += 1;
        }
      }
    }

    function resetChunkSpawns() {
      spawnedChunkEncounters.clear();
    }

    function updateEliteEncounters() {
      const livingMotherships = state.objects.filter((obj) => obj && obj.type === "mothership" && obj.hp > 0 && !obj.destroyed);
      if (livingMotherships.length <= 0) return;

      const rand = Math.random;
      for (const mothership of livingMotherships) {
        const escortCap = 7;
        let activeEscortsNear = 0;
        for (const obj of state.objects) {
          if (!obj || obj.type !== "alienShip" || obj.hp <= 0 || obj.destroyed) continue;
          const dx = (obj.worldX || 0) - (mothership.worldX || 0);
          const dy = (obj.worldY || 0) - (mothership.worldY || 0);
          if (dx * dx + dy * dy <= 2200 * 2200) activeEscortsNear += 1;
        }

        if (!Number.isFinite(mothership.nextEscortAt)) {
          mothership.nextEscortAt = state.time + 5 + rand() * 4;
        }
        if (state.time < mothership.nextEscortAt) continue;
        if (activeEscortsNear >= escortCap) {
          mothership.nextEscortAt = state.time + 2 + rand() * 2;
          continue;
        }

        const waveMin = Number.isFinite(mothership.escortWaveMin) ? mothership.escortWaveMin : 1;
        const waveMax = Number.isFinite(mothership.escortWaveMax) ? mothership.escortWaveMax : 2;
        const waveSize = waveMin + Math.floor(rand() * Math.max(1, waveMax - waveMin + 1));
        const toSpawn = Math.max(1, Math.min(waveSize, escortCap - activeEscortsNear));
        for (let i = 0; i < toSpawn; i += 1) {
          spawnEscortNearMothership(mothership, rand);
        }
        const cooldown = Number.isFinite(mothership.escortCooldown) ? mothership.escortCooldown : 6.5;
        mothership.nextEscortAt = state.time + cooldown * (0.85 + rand() * 0.3);
      }
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

      const shipWX = state.ship && Number.isFinite(state.ship.worldX) ? state.ship.worldX : 0;
      const shipWY = state.ship && Number.isFinite(state.ship.worldY) ? state.ship.worldY : 0;
      const startWorldX = shipWX + WORLD.width * 0.56;
      const startWorldY = shipWY;
      const startScreen = worldToScreen(startWorldX, startWorldY);

      state.boss = {
        variant,
        x: startScreen.x,
        y: startScreen.y,
        worldX: startWorldX,
        worldY: startWorldY,
        anchorWorldX: startWorldX,
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

      createExplosion(startScreen.x, startScreen.y, "#ff8e4f", 42);
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
      const worldX = boss.worldX - boss.size * 0.42;
      const worldY = boss.worldY + yOffset;
      const screenPos = worldToScreen(worldX, worldY);

      state.objects.push({
        id: nextObjectId(),
        type,
        x: screenPos.x,
        y: screenPos.y,
        worldX,
        worldY,
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

    function spawnEnemyFlameBurst(fromX, fromY, toX, toY, options = {}) {
      const aim = Math.atan2(toY - fromY, toX - fromX);
      const pellets = 5;
      const worldFrom = screenToWorld(fromX, fromY);
      const damageType = options.damageType || "heat";
      const damage = Number.isFinite(options.damage) ? options.damage : 1;
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
          damage,
          damageType,
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

        const arenaClear = state.objects.length === 0;
        if (arenaClear || state.time >= boss.introMaxUntil) {
          boss.intro = false;
          boss.lastFire = state.time;
          boss.lastMinionSpawn = state.time;
        } else {
          return;
        }
      }

      const shipWX = state.ship && Number.isFinite(state.ship.worldX) ? state.ship.worldX : 0;
      const shipWY = state.ship && Number.isFinite(state.ship.worldY) ? state.ship.worldY : 0;
      const anchorX = shipWX + WORLD.width * 0.56;

      if (boss.variant === "tentacle") {
        boss.worldX = anchorX + Math.sin(boss.phase * 0.42) * 36;
        boss.worldY = shipWY + Math.sin(boss.phase * 1.4) * 125;
      } else if (boss.variant === "warship") {
        boss.worldX = anchorX + Math.sin(boss.phase * 0.32) * 54;
        boss.worldY = shipWY + Math.sin(boss.phase * 0.85) * 170;
      } else {
        boss.worldX = anchorX + Math.sin(boss.phase * 0.45) * 30;
        boss.worldY = shipWY + Math.sin(boss.phase * 1.1) * 95;
      }

      const maxOffsetY = WORLD.height * 0.42;
      boss.worldY = Math.max(shipWY - maxOffsetY, Math.min(shipWY + maxOffsetY, boss.worldY));
      const bossScreen = worldToScreen(boss.worldX, boss.worldY);
      boss.x = bossScreen.x;
      boss.y = bossScreen.y;

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
          const dx = shipWX - boss.worldX;
          const dy = shipWY - boss.worldY;
          const a = Math.atan2(dy, dx) + spread;
          const speed = (boss.variant === "warship" ? 300 : 260) * difficulty.enemyProjectileSpeedMult;
          const bossDamage = 2;

          const muzzleWorldX = boss.worldX - boss.size * 0.38;
          const muzzleWorldY = boss.worldY;
          const muzzleScreen = worldToScreen(muzzleWorldX, muzzleWorldY);
          const targetWorldX = muzzleWorldX + Math.cos(a) * 100;
          const targetWorldY = muzzleWorldY + Math.sin(a) * 100;
          const targetScreen = worldToScreen(targetWorldX, targetWorldY);

          spawnEnemyProjectile(
            muzzleScreen.x,
            muzzleScreen.y,
            targetScreen.x,
            targetScreen.y,
            speed,
            damageType,
            bossDamage,
          );
        }
      }
    }

    function getChunkEventMap() { return chunkEventMap; }

    return {
      spawnObject,
      spawnChunksAround,
      resetChunkSpawns,
      spawnBoss,
      spawnEnemyProjectile,
      spawnEnemyFlameBurst,
      updateBoss,
      updateEliteEncounters,
      getChunkEventMap,
    };
  }

  window.VoidEncounters = {
    createEncountersSystem,
  };
})();
