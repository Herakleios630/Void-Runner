(function () {
  function createStatusEffectsSystem(deps) {
    const {
      state,
      rollCrit,
      computeDamage,
      addDamageText,
      reloadRate,
      createExplosion,
      playSfx,
      damageNearbyFromShieldPulse,
      destroyObject,
      onBossDefeated,
    } = deps;

    function computeBurnTickDamage() {
      const crit = rollCrit();
      if (!crit) return 1;
      const critMult = state.shipStats ? state.shipStats.critDamage : 1.5;
      return Math.max(1, Math.round(critMult * 0.8));
    }

    function applyAcidToShip(duration = 3.8, dps = 0.8) {
      if (!state.ship) return;
      state.ship.acidUntil = Math.max(state.ship.acidUntil || 0, state.time + duration);
      state.ship.acidDps = Math.max(state.ship.acidDps || 0, dps);
      state.ship.acidTickCarry = state.ship.acidTickCarry || 0;
    }

    function consumeShield(damageType = "physical", amount = 1) {
      if (!state.shield.unlocked || state.shield.charges < 1) return false;

      if (state.shield.integrity <= 0) {
        state.shield.integrity = state.shield.charges;
      }

      // Energy hits drain only half shield integrity: shield is extra effective vs energy.
      const shieldCost = damageType === "energy" ? amount * 0.5 : amount;
      state.shield.integrity -= shieldCost;

      if (state.shield.integrity > 0) {
        if (state.weaponSpecials.shieldThornPulse && state.time - (state.shield.lastThornPulseAt || -999) >= 1.6) {
          state.shield.lastThornPulseAt = state.time;
          damageNearbyFromShieldPulse(state.shield.thornPulseRadius || 78, false);
        }
        playSfx("shieldHit");
        createExplosion(state.ship.x, state.ship.y, "#71f4ff", 18);
        return true;
      }

      state.shield.charges = 0;
      state.shield.integrity = 0;
      state.shield.cooldownUntil = state.time + state.shield.rechargeDelay / reloadRate();
      playSfx("shieldHit");
      createExplosion(state.ship.x, state.ship.y, "#71f4ff", 24);

      if (state.shield.thorns) {
        damageNearbyFromShieldPulse(state.shield.thornBreakRadius || 105, false);
      }

      // This hit is still fully consumed by the shield break.
      return true;
    }

    function applyHeatHit(target, damage, hitX, hitY) {
      if (target.heatHitUntil && target.heatHitUntil > state.time) return;
      target.heatHitUntil = state.time + 0.18;

      const stackCap = 5;
      if (!target.burnStacks) target.burnStacks = 0;
      if (!target.nextBurnStackAt || state.time >= target.nextBurnStackAt) {
        target.burnStacks = Math.min(stackCap, target.burnStacks + 1);
        target.nextBurnStackAt = state.time + 1;
      }

      // Plasma direct hit is intentionally near-zero; damage comes from burning ticks.
      if (damage > 0) {
        const dmg = computeDamage(damage, "heat");
        target.hp -= dmg.damage;
        addDamageText(hitX, hitY - 6, dmg.damage, dmg.crit);
      }

      target.burnUntil = Math.max(target.burnUntil || 0, state.time + state.weapon.plasmaBurnDuration);
      target.burnDps = Math.max(target.burnDps || 0, state.weapon.plasmaBurnDps * (state.shipStats ? state.shipStats.heatDamage : 1));
      target.burnTickCarry = target.burnTickCarry || 0;
      createExplosion(hitX, hitY, "#ff944d", 4);

      if (target.hp <= 0) {
        if (target === state.boss) {
          onBossDefeated();
        } else {
          destroyObject(target, DESTROY_REASONS.SHOT);
        }
      }
    }

    return {
      computeBurnTickDamage,
      applyAcidToShip,
      consumeShield,
      applyHeatHit,
    };
  }

  window.VoidStatusEffects = {
    createStatusEffectsSystem,
  };
})();
