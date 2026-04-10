(function () {
  function createObjectLifecycleSystem(deps) {
    const {
      state,
      nextObjectId,
      createExplosion,
      playSfx,
      getKillReward,
      scoring,
    } = deps;

    function spawnAlienDeathFx(obj, variant = "mini") {
      const worldX = Number.isFinite(obj.worldX) ? obj.worldX : undefined;
      const worldY = Number.isFinite(obj.worldY) ? obj.worldY : undefined;
      const burstCount = variant === "ship" ? 18 : 12;

      for (let i = 0; i < burstCount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (variant === "ship" ? 90 : 70) + Math.random() * (variant === "ship" ? 170 : 120);
        const life = 0.28 + Math.random() * 0.5;
        const size = (variant === "ship" ? 1.8 : 1.4) + Math.random() * (variant === "ship" ? 3.4 : 2.6);
        const isShard = Math.random() < (variant === "ship" ? 0.55 : 0.35);

        state.particles.push({
          x: obj.x,
          y: obj.y,
          worldX,
          worldY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life,
          size,
          color: isShard ? "#d8ffe6" : "#86ff6c",
          kind: isShard ? "alienShard" : "alienGoo",
        });
      }
    }

    function spawnRockFragments(parent) {
      const pieces = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pieces; i += 1) {
        const angle = (i / pieces) * Math.PI * 2 + Math.random() * 0.8;
        const speed = 120 + Math.random() * 120;
        const size = 9 + Math.random() * 6;
        const corners = 7;

        state.objects.push({
          id: nextObjectId(),
          type: "rockShard",
          x: parent.x + Math.cos(angle) * 4,
          y: parent.y + Math.sin(angle) * 4,
          worldX: Number.isFinite(parent.worldX) ? parent.worldX + Math.cos(angle) * 4 : undefined,
          worldY: Number.isFinite(parent.worldY) ? parent.worldY + Math.sin(angle) * 4 : undefined,
          vx: parent.vx + Math.cos(angle) * speed,
          vy: parent.vy + Math.sin(angle) * speed,
          size,
          hp: 1,
          destroyed: false,
          destructible: true,
          collisionRadius: size * 0.77,
          corners,
          rockProfile: Array.from({ length: corners }, () => 0.72 + Math.random() * 0.26),
          spin: (Math.random() - 0.5) * 3,
          angle: Math.random() * Math.PI * 2,
          passed: true,
        });
      }
    }

    function maybeSpawnArmorPickup(obj) {
      const asteroidTypes = ["smallRock", "mediumRock", "rockShard", "boulder"];
      if (!asteroidTypes.includes(obj.type)) return;

      const dropChance = obj.type === "mediumRock" ? 0.18 : obj.type === "boulder" ? 0.22 : 0.1;
      if (Math.random() > dropChance) return;

      state.pickups.push({
        type: "armor",
        x: obj.x,
        y: obj.y,
        worldX: Number.isFinite(obj.worldX) ? obj.worldX : undefined,
        worldY: Number.isFinite(obj.worldY) ? obj.worldY : undefined,
        vx: obj.vx * 0.35,
        vy: obj.vy * 0.35,
        radius: 10,
        life: 10,
      });
    }

    function destroyObject(obj, reason) {
      if (obj.destroyed) return;

      obj.destroyed = true;
      obj.hp = 0;

      const playerKill = reason === "shot" || reason === "rocket";
      if (playerKill) {
        state.kills += 1;
        const reward = getKillReward(reason, obj.type);
        if (reward > 0) {
          scoring.addPoints(reward);
        }
      }

      if (obj.type === "mediumRock") {
        spawnRockFragments(obj);
      }

      maybeSpawnArmorPickup(obj);

      if (obj.type === "alienShip") {
        createExplosion(obj.x, obj.y, "#9eff7f", 28);
        createExplosion(obj.x, obj.y, "#ffb36a", 16);
        spawnAlienDeathFx(obj, "ship");
      } else if (obj.type === "miniAlien") {
        createExplosion(obj.x, obj.y, "#94ff74", 18);
        spawnAlienDeathFx(obj, "mini");
      } else {
        const color = obj.type === "miniAlien" ? "#94ff74" : "#ffb36a";
        createExplosion(obj.x, obj.y, color, obj.type === "mediumRock" ? 24 : 14);
      }
      playSfx("explosion");
    }

    return {
      destroyObject,
    };
  }

  window.VoidObjectLifecycle = {
    createObjectLifecycleSystem,
  };
})();
