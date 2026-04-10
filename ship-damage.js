(function () {
  function createShipDamageSystem(deps) {
    const {
      state,
      consumeShield,
      createExplosion,
    } = deps;

    function armorReductionForType(damageType) {
      if (damageType === "physical") return 1;
      if (damageType === "explosive") return 1;
      if (damageType === "acid") return 0.2;
      return 0.5;
    }

    function hitShip(damageType = "physical", amount = 1) {
      if (!state.ship) return false;
      if (state.time < state.ship.invulnUntil) return true;

      state.shipHitsTaken = Number(state.shipHitsTaken || 0) + 1;

      if (consumeShield(damageType, amount)) {
        state.ship.invulnUntil = state.time + 0.5;
        return true;
      }

      let remaining = Math.max(0, amount);
      if (state.ship.armor > 0) {
        // One armor point is consumed per hit and mitigates damage by source type.
        state.ship.armor = Math.max(0, state.ship.armor - 1);
        remaining = Math.max(0, remaining - armorReductionForType(damageType));
      }

      if (remaining > 0) {
        state.ship.hp -= Math.max(1, Math.ceil(remaining));
      }

      state.ship.invulnUntil = state.time + 0.5;
      createExplosion(state.ship.x, state.ship.y, "#ff7f8a", 20);
      return state.ship.hp > 0;
    }

    function tickAcidDamageToShip(ship, dt) {
      if (!ship || !ship.acidUntil || ship.acidUntil <= state.time) {
        return true;
      }

      const acidResist = Math.max(0, Math.min(0.85, ship.acidResist || 0));
      ship.acidTickCarry = (ship.acidTickCarry || 0) + (ship.acidDps || 0) * (1 - acidResist) * dt;
      while (ship.acidTickCarry >= 1) {
        ship.acidTickCarry -= 1;
        if (ship.armor > 0) {
          ship.armor = Math.max(0, ship.armor - 1);
        } else {
          ship.hp -= 1;
        }
        if (ship.hp <= 0) {
          return false;
        }
      }

      return true;
    }

    return {
      hitShip,
      tickAcidDamageToShip,
    };
  }

  window.VoidShipDamage = {
    createShipDamageSystem,
  };
})();
