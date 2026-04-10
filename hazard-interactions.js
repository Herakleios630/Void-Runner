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

    return {
      handleShipStructureCollisions,
      handleShipSolarHeat,
      handleShipToxicNebula,
    };
  }

  window.VoidHazardInteractions = {
    createHazardInteractionsSystem,
  };
})();
