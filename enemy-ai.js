(function () {
  function createEnemyAISteeringSystem(deps) {
    const {
      state,
      WORLD,
    } = deps;

    function isSteeringEnemy(obj) {
      return obj && (obj.type === "miniAlien" || obj.type === "alienShip");
    }

    function updateEnemySteering(obj, ship, dt) {
      if (!isSteeringEnemy(obj) || !ship) return;

      const dxToShip = (ship.worldX || 0) - obj.worldX;
      const dyToShip = (ship.worldY || 0) - obj.worldY;
      const distToShip = Math.hypot(dxToShip, dyToShip) || 1;
      const engageRange = obj.aggroRange || 700;
      const disengageRange = obj.disengageRange || engageRange * 1.7;
      const memoryWindow = 2.8;
      const targetRange = obj.preferredRange || 190;
      const visibleAggroMargin = 90;
      const inVisibleAggroBand =
        obj.x >= -visibleAggroMargin &&
        obj.x <= WORLD.width + visibleAggroMargin &&
        obj.y >= -visibleAggroMargin &&
        obj.y <= WORLD.height + visibleAggroMargin;

      if (!obj.aggroLocked && inVisibleAggroBand && distToShip <= engageRange) {
        obj.aggroLocked = true;
        obj.aggroUntil = state.time + memoryWindow;
      }

      if (obj.aggroLocked && distToShip <= disengageRange) {
        obj.aggroUntil = state.time + memoryWindow;
      }

      if (obj.aggroLocked && state.time > (obj.aggroUntil || 0)) {
        obj.aggroLocked = false;
      }

      if (obj.aggroLocked) {
        const chaseSpeed = obj.chaseSpeed || 540;
        const steer = obj.steering || 1.5;
        const chaseAccel = obj.chaseAccel || 320;
        const chaseDir = distToShip > targetRange ? 1 : -0.5;
        const desiredVx = (dxToShip / distToShip) * chaseSpeed * chaseDir;
        const desiredVy = (dyToShip / distToShip) * chaseSpeed * chaseDir;
        const maxDelta = chaseAccel * dt;
        const deltaVx = (desiredVx - obj.vx) * Math.min(1, steer * dt);
        const deltaVy = (desiredVy - obj.vy) * Math.min(1, steer * dt);
        const deltaLen = Math.hypot(deltaVx, deltaVy) || 1;
        const scale = deltaLen > maxDelta ? maxDelta / deltaLen : 1;
        obj.vx += deltaVx * scale;
        obj.vy += deltaVy * scale;
        return;
      }

      if (Number.isFinite(obj.patrolUntil) && state.time < obj.patrolUntil && Number.isFinite(obj.patrolHeading)) {
        const patrolSpeed = Math.max(0, obj.patrolSpeed || obj.cruiseSpeed || 120);
        const desiredVx = Math.cos(obj.patrolHeading) * patrolSpeed;
        const desiredVy = Math.sin(obj.patrolHeading) * patrolSpeed;
        const steer = Math.max(0.3, obj.steering || 0.9);
        obj.vx += (desiredVx - obj.vx) * Math.min(1, steer * dt * 0.55);
        obj.vy += (desiredVy - obj.vy) * Math.min(1, steer * dt * 0.55);
        return;
      }

      // Outside aggro, enemies should not actively home toward the player.
      const cruiseDamp = Math.max(0.94, 1 - dt * 0.18);
      obj.vx *= cruiseDamp;
      obj.vy *= cruiseDamp;
    }

    return {
      updateEnemySteering,
    };
  }

  window.VoidEnemyAI = {
    createEnemyAISteeringSystem,
  };
})();
