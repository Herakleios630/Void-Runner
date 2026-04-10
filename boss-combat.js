(function () {
  function createBossCombatSystem(deps) {
    const {
      state,
      computeBurnTickDamage,
      addDamageText,
      onBossDefeated,
      hitShip,
      setGameOver,
    } = deps;

    function updateBossCombat(dt, ship) {
      if (!state.bossActive || !state.boss) return true;

      if (state.boss.burnUntil && state.boss.burnUntil > state.time && state.boss.hp > 0) {
        const burnStacks = Math.max(1, state.boss.burnStacks || 1);
        state.boss.burnTickCarry = (state.boss.burnTickCarry || 0) + (state.boss.burnDps || 0) * burnStacks * dt;
        while (state.boss.burnTickCarry >= 1 && state.boss.hp > 0) {
          state.boss.burnTickCarry -= 1;
          const burnDmg = computeBurnTickDamage();
          state.boss.hp -= burnDmg;
          addDamageText(state.boss.x, state.boss.y - state.boss.size * 0.4, burnDmg, burnDmg > 1);
          if (state.boss.hp <= 0) {
            onBossDefeated();
            break;
          }
        }
      }

      const dBoss = Math.hypot(
        (state.boss.worldX || state.boss.x) - (ship.worldX || ship.x),
        (state.boss.worldY || state.boss.y) - (ship.worldY || ship.y),
      );
      if (dBoss < state.boss.collisionRadius + ship.radius - 3) {
        if (!hitShip("physical", 2)) {
          setGameOver();
          return false;
        }
      }

      return true;
    }

    return {
      updateBossCombat,
    };
  }

  window.VoidBossCombat = {
    createBossCombatSystem,
  };
})();
