(function () {
  function createEnemyCombatSystem(deps) {
    const {
      encounters,
    } = deps;

    function enemyWeaponIdFor(obj) {
      if (obj.enemyWeapon) return obj.enemyWeapon;
      return obj.type === "alienShip" ? "laser" : "acid";
    }

    function enemyWeaponCooldown(weaponId) {
      if (weaponId === "laser") return 1.05 + Math.random() * 0.85;
      if (weaponId === "rocket") return 1.35 + Math.random() * 1.1;
      if (weaponId === "plasma") return 1.5 + Math.random() * 1.25;
      if (weaponId === "cannon") return 0.95 + Math.random() * 0.7;
      return 1.25 + Math.random() * 1.15;
    }

    function fireEnemyWeapon(obj, ship) {
      const weaponId = enemyWeaponIdFor(obj);
      const spreadBase = obj.type === "alienShip" ? 22 : 18;
      const spread = (Math.random() - 0.5) * spreadBase;
      const targetX = ship.x + spread;
      const targetY = ship.y + spread * 0.45;

      if (weaponId === "laser") {
        encounters.spawnEnemyProjectile(obj.x, obj.y, targetX, targetY, 340, "energy", 1);
        return;
      }

      if (weaponId === "rocket") {
        encounters.spawnEnemyProjectile(obj.x, obj.y, targetX, targetY, 220, "explosive", 2);
        return;
      }

      if (weaponId === "plasma") {
        encounters.spawnEnemyFlameBurst(obj.x, obj.y, targetX, targetY, {
          damageType: "heat",
          damage: 1,
        });
        return;
      }

      if (weaponId === "cannon") {
        encounters.spawnEnemyProjectile(obj.x, obj.y, targetX, targetY, 300, "physical", 1);
        return;
      }

      encounters.spawnEnemyProjectile(obj.x, obj.y, targetX, targetY, 245, "acid", 1);
    }

    function nextEnemyShotAt(obj, now) {
      return now + enemyWeaponCooldown(enemyWeaponIdFor(obj));
    }

    return {
      enemyWeaponIdFor,
      enemyWeaponCooldown,
      fireEnemyWeapon,
      nextEnemyShotAt,
    };
  }

  window.VoidEnemyCombat = {
    createEnemyCombatSystem,
  };
})();
