(function () {
  function createHazardInteractionsSystem(deps) {
    const {
      state,
      WORLD,
      worldSystem,
      cameraSystem,
      projectWorldToScreen,
      hitShip,
      setGameOver,
      applyAcidToShip,
      createExplosion,
    } = deps;

    function resolveShipOrbitCollision(ship, collider, cameraX, cameraY, hitDamage, pushVelocity) {
      const p = cameraSystem.worldToScreen(collider.x, collider.y, collider.parallax || 1, WORLD.width, WORLD.height);
      const d = Math.hypot(ship.x - p.x, ship.y - p.y);
      const hitR = (collider.hitRadius || collider.radius || 12) + ship.radius - 2;
      if (d >= hitR) return true;

      if (!hitShip("physical", hitDamage)) {
        setGameOver();
        return false;
      }

      const nx = d > 0 ? (ship.x - p.x) / d : 1;
      const ny = d > 0 ? (ship.y - p.y) / d : 0;
      const pushOut = Math.max(0, hitR - d) + 1;
      ship.worldX += nx * pushOut;
      ship.worldY += ny * pushOut;
      ship.vx += nx * pushVelocity;
      ship.vy += ny * pushVelocity;

      const pushedScreen = projectWorldToScreen(ship.worldX, ship.worldY, cameraX, cameraY);
      ship.x = pushedScreen.x;
      ship.y = pushedScreen.y;
      return true;
    }

    function handleShipStructureCollisions(ship, cameraX, cameraY) {
      const collidableBodies = typeof worldSystem.getCollidableBodies === "function"
        ? worldSystem.getCollidableBodies(state.time)
        : worldSystem.getCollidablePlanets(state.time);

      if (collidableBodies.length > 0) {
        for (const body of collidableBodies) {
          const hitDamage = body.type === "orbitalStation" ? 1 : 2;
          const pushVelocity = body.type === "orbitalStation" ? 60 : 80;
          if (!resolveShipOrbitCollision(ship, body, cameraX, cameraY, hitDamage, pushVelocity)) {
            return false;
          }
        }
      }

      return true;
    }

    function handleShipSolarHeat(ship) {
      const heatZones = typeof worldSystem.getSolarHeatZones === "function" ? worldSystem.getSolarHeatZones() : [];
      if (heatZones.length <= 0) return true;

      for (const zone of heatZones) {
        const p = cameraSystem.worldToScreen(zone.x, zone.y, zone.parallax || 1, WORLD.width, WORLD.height);
        const d = Math.hypot(ship.x - p.x, ship.y - p.y);
        const hitRadius = (zone.heatRadius || 140) + ship.radius * 0.45;
        if (d > hitRadius) continue;

        applyAcidToShip(0.3, zone.heatDps || 0.5);
        if (!ship.nextSunHeatFxAt || state.time >= ship.nextSunHeatFxAt) {
          ship.nextSunHeatFxAt = state.time + 0.22;
          createExplosion(ship.x, ship.y, "#ffb16a", 3);
        }
      }

      return true;
    }

    function handleShipToxicNebula(ship, dt = 1 / 60) {
      const zones = typeof worldSystem.getToxicNebulaZones === "function" ? worldSystem.getToxicNebulaZones() : [];
      let strongestJam = 0;

      for (const zone of zones) {
        const p = cameraSystem.worldToScreen(zone.x, zone.y, zone.parallax || 1, WORLD.width, WORLD.height);
        const d = Math.hypot(ship.x - p.x, ship.y - p.y);
        const hitRadius = (zone.hazardRadius || 160) + ship.radius * 0.35;
        if (d > hitRadius) continue;

        const t = Math.max(0, 1 - d / hitRadius);
        const scannerHarden = Math.max(0, Math.min(0.85, ship.scannerHarden || 0));
        const jam = (zone.scannerJam || 0.4) * (0.35 + t * 0.75) * (1 - scannerHarden);
        if (jam > strongestJam) strongestJam = jam;

        const dps = (zone.toxicDps || 0.45) * (0.55 + t * 0.9);
        applyAcidToShip(0.34, dps);

        if (!ship.nextToxicNebulaFxAt || state.time >= ship.nextToxicNebulaFxAt) {
          ship.nextToxicNebulaFxAt = state.time + 0.2;
          createExplosion(ship.x, ship.y, "#86f79d", 3);
        }
      }

      const currentJam = ship.scannerJam || 0;
      if (strongestJam > currentJam) {
        ship.scannerJam = strongestJam;
      } else {
        ship.scannerJam = Math.max(0, currentJam - dt * 0.9);
      }

      return true;
    }

    function handleShipIonStorm(ship, dt = 1 / 60) {
      const zones = typeof worldSystem.getIonStormZones === "function" ? worldSystem.getIonStormZones() : [];
      let strongestJam = 0;

      for (const zone of zones) {
        const p = cameraSystem.worldToScreen(zone.x, zone.y, zone.parallax || 1, WORLD.width, WORLD.height);
        const d = Math.hypot(ship.x - p.x, ship.y - p.y);
        const hitRadius = (zone.hazardRadius || 150) + ship.radius * 0.3;
        if (d > hitRadius) continue;

        const t = Math.max(0, 1 - d / hitRadius);
        const scannerHarden = Math.max(0, Math.min(0.85, ship.scannerHarden || 0));
        const jam = (zone.scannerJam || 0.3) * (0.25 + t * 0.8) * (1 - scannerHarden);
        if (jam > strongestJam) strongestJam = jam;

        const swirl = Math.sin(state.time * 4.5 + (zone.x + zone.y) * 0.0005);
        const push = (8 + (zone.projectileDrift || 32) * 0.04) * t * dt;
        ship.vx += -swirl * push;
        ship.vy += swirl * push;

        if (!ship.nextIonStormFxAt || state.time >= ship.nextIonStormFxAt) {
          ship.nextIonStormFxAt = state.time + 0.24;
          createExplosion(ship.x, ship.y, "#8bc9ff", 2);
        }
      }

      const currentJam = ship.scannerJam || 0;
      if (strongestJam > currentJam) {
        ship.scannerJam = strongestJam;
      } else {
        ship.scannerJam = Math.max(0, currentJam - dt * 0.65);
      }

      return true;
    }

    function handleShipBlackHoles(ship, dt = 1 / 60, options = {}) {
      const zones = typeof worldSystem.getBlackHoleZones === "function" ? worldSystem.getBlackHoleZones() : [];
      if (!zones || zones.length <= 0) return true;

      const playerInfluenceEnabled = options.playerInfluence !== false;

      for (const zone of zones) {
        const p = cameraSystem.worldToScreen(zone.x, zone.y, zone.parallax || 0.3, WORLD.width, WORLD.height);
        const d = Math.hypot(ship.x - p.x, ship.y - p.y);
        const gravityR = zone.gravityRadius || 220;
        const horizonR = zone.eventHorizonRadius || 28;

        if (d <= horizonR + ship.radius * 0.2) {
          createExplosion(ship.x, ship.y, "#5f7cff", 16);
          setGameOver();
          return false;
        }

        if (!playerInfluenceEnabled || d > gravityR) continue;
        const t = Math.max(0, 1 - d / gravityR);
        const safeD = Math.max(1, d);
        const nx = (p.x - ship.x) / safeD;
        const ny = (p.y - ship.y) / safeD;
        const pull = (zone.gravityPull || 220) * (zone.playerPullScale || 0.8) * (0.2 + t * 1.2) * dt;
        ship.vx += nx * pull;
        ship.vy += ny * pull;

        if (!ship.nextBlackHoleFxAt || state.time >= ship.nextBlackHoleFxAt) {
          ship.nextBlackHoleFxAt = state.time + 0.22;
          createExplosion(ship.x, ship.y, "#8db5ff", 2);
        }
      }

      return true;
    }

    function handleShipWormholes(ship) {
      if (!ship) return true;
      if (ship.wormholeCooldownUntil && state.time < ship.wormholeCooldownUntil) return true;

      const portals = typeof worldSystem.getWormholePortals === "function" ? worldSystem.getWormholePortals() : [];
      if (portals.length <= 0) return true;

      for (const portal of portals) {
        if (!Number.isFinite(portal.linkedX) || !Number.isFinite(portal.linkedY)) continue;
        const p = cameraSystem.worldToScreen(portal.x, portal.y, portal.parallax || 1, WORLD.width, WORLD.height);
        const d = Math.hypot(ship.x - p.x, ship.y - p.y);
        const hitRadius = (portal.hitRadius || portal.radius || 20) + ship.radius * 0.4;
        if (d > hitRadius) continue;

        const fromX = ship.worldX;
        const fromY = ship.worldY;
        ship.worldX = portal.linkedX;
        ship.worldY = portal.linkedY;
        ship.vx *= 0.35;
        ship.vy *= 0.35;
        ship.wormholeCooldownUntil = state.time + 1.25;

        if (typeof cameraSystem.snap === "function") {
          cameraSystem.snap(ship.worldX, ship.worldY);
        }

        const cameraX = typeof cameraSystem.getX === "function" ? cameraSystem.getX() : ship.worldX;
        const cameraY = typeof cameraSystem.getY === "function" ? cameraSystem.getY() : ship.worldY;
        if (typeof worldSystem.update === "function") {
          worldSystem.update(cameraX, cameraY);
        }
        const teleportedScreen = projectWorldToScreen(ship.worldX, ship.worldY, cameraX, cameraY);
        ship.x = teleportedScreen.x;
        ship.y = teleportedScreen.y;

        createExplosion(WORLD.width * 0.5, WORLD.height * 0.5, "#8ecbff", 12);
        const fromScreen = projectWorldToScreen(fromX, fromY, cameraX, cameraY);
        createExplosion(fromScreen.x, fromScreen.y, "#6da7ff", 8);
        return true;
      }

      return true;
    }

    return {
      handleShipStructureCollisions,
      handleShipSolarHeat,
      handleShipToxicNebula,
      handleShipIonStorm,
      handleShipBlackHoles,
      handleShipWormholes,
    };
  }

  window.VoidHazardInteractions = {
    createHazardInteractionsSystem,
  };
})();
