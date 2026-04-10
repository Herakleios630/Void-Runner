(function () {
  function createPickupSimulationSystem(deps) {
    const {
      state,
      screenToWorld,
      projectWorldToScreen,
      createExplosion,
      playSfx,
    } = deps;

    function updatePickups(dt, cameraX, cameraY, ship) {
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
    }

    return {
      updatePickups,
    };
  }

  window.VoidPickupSimulation = {
    createPickupSimulationSystem,
  };
})();
