(function () {
  function createMovementUtils(deps) {
    const {
      screenToWorld,
      projectWorldToScreen,
    } = deps;

    function ensureEntityWorldPosition(entity) {
      if (Number.isFinite(entity.worldX) && Number.isFinite(entity.worldY)) {
        return;
      }
      const worldPos = screenToWorld(entity.x, entity.y);
      entity.worldX = worldPos.x;
      entity.worldY = worldPos.y;
    }

    function syncEntityScreenPosition(entity, cameraX, cameraY) {
      if (!Number.isFinite(entity.worldX) || !Number.isFinite(entity.worldY)) return;
      const screenPos = projectWorldToScreen(entity.worldX, entity.worldY, cameraX, cameraY);
      entity.x = screenPos.x;
      entity.y = screenPos.y;
    }

    function entityWorldX(entity) {
      return Number.isFinite(entity.worldX) ? entity.worldX : entity.x;
    }

    function entityWorldY(entity) {
      return Number.isFinite(entity.worldY) ? entity.worldY : entity.y;
    }

    function circlesOverlapWorldEntities(a, radiusA, b, radiusB) {
      const dx = entityWorldX(a) - entityWorldX(b);
      const dy = entityWorldY(a) - entityWorldY(b);
      return dx * dx + dy * dy < Math.pow(radiusA + radiusB, 2);
    }

    return {
      ensureEntityWorldPosition,
      syncEntityScreenPosition,
      entityWorldX,
      entityWorldY,
      circlesOverlapWorldEntities,
    };
  }

  window.VoidMovementUtils = {
    createMovementUtils,
  };
})();
