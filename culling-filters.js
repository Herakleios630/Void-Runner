(function () {
  function createCullingFiltersSystem(deps) {
    const {
      state,
      WORLD,
    } = deps;

    function applyEntityCulling(cameraX, cameraY) {
      const worldCullBase = Math.max(WORLD.width, WORLD.height) * 2.8;

      state.objects = state.objects.filter((o) => {
        if (o.hp <= 0) return false;
        if (!Number.isFinite(o.worldX) || !Number.isFinite(o.worldY)) {
          return o.x > -o.size * 2 && o.x < WORLD.width + o.size * 2 && o.y > -o.size * 2 && o.y < WORLD.height + o.size * 2;
        }
        const d = Math.hypot(o.worldX - cameraX, o.worldY - cameraY);
        return d < worldCullBase + o.size * 2;
      });

      state.bullets = state.bullets.filter((b) => {
        if (b.life <= 0) return false;
        if (!Number.isFinite(b.worldX) || !Number.isFinite(b.worldY)) {
          return b.x > -30 && b.x < WORLD.width + 30 && b.y > -30 && b.y < WORLD.height + 30;
        }
        const d = Math.hypot(b.worldX - cameraX, b.worldY - cameraY);
        return d < worldCullBase + 120;
      });

      state.laserBeams = state.laserBeams.filter((b) => b.life > 0);

      state.plasmaBursts = state.plasmaBursts.filter((b) => {
        if (b.life <= 0 || b.rangeLeft <= 0) return false;
        if (!Number.isFinite(b.worldX) || !Number.isFinite(b.worldY)) {
          return b.x > -80 && b.x < WORLD.width + 80 && b.y > -80 && b.y < WORLD.height + 80;
        }
        const d = Math.hypot(b.worldX - cameraX, b.worldY - cameraY);
        return d < worldCullBase + 220;
      });

      state.missiles = state.missiles.filter((m) => {
        if (m.life <= 0) return false;
        if (!Number.isFinite(m.worldX) || !Number.isFinite(m.worldY)) {
          return m.x > -60 && m.x < WORLD.width + 60 && m.y > -60 && m.y < WORLD.height + 60;
        }
        const d = Math.hypot(m.worldX - cameraX, m.worldY - cameraY);
        return d < worldCullBase + 180;
      });

      state.pickups = state.pickups.filter((p) => {
        if (p.life <= 0) return false;
        if (!Number.isFinite(p.worldX) || !Number.isFinite(p.worldY)) {
          return p.x > -60 && p.x < WORLD.width + 60 && p.y > -60 && p.y < WORLD.height + 60;
        }
        const d = Math.hypot(p.worldX - cameraX, p.worldY - cameraY);
        return d < worldCullBase + 120;
      });

      state.bossProjectiles = state.bossProjectiles.filter((p) => {
        if (p.life <= 0) return false;
        if (!Number.isFinite(p.worldX) || !Number.isFinite(p.worldY)) {
          return p.x > -80 && p.x < WORLD.width + 80 && p.y > -80 && p.y < WORLD.height + 80;
        }
        const d = Math.hypot(p.worldX - cameraX, p.worldY - cameraY);
        return d < worldCullBase + 240;
      });

      state.particles = state.particles.filter((p) => p.life > 0);
      state.damageTexts = state.damageTexts.filter((t) => t.life > 0);
    }

    return {
      applyEntityCulling,
    };
  }

  window.VoidCullingFilters = {
    createCullingFiltersSystem,
  };
})();
