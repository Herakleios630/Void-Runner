(function () {
  function createProjectileResolverSystem(deps) {
    const {
      state,
      WORLD,
      worldSystem,
      cameraSystem,
      ensureEntityWorldPosition,
      syncEntityScreenPosition,
      entityWorldX,
      entityWorldY,
      circlesOverlapWorldEntities,
      computeDamage,
      addDamageText,
      destroyObject,
      onBossDefeated,
      weapons,
      tryRicochetBullet,
      hitShip,
      setGameOver,
      applyAcidToShip,
      createExplosion,
      applyHeatHit,
    } = deps;

    function resolveBulletsMovement(dt, cameraX, cameraY) {
      for (const bullet of state.bullets) {
        ensureEntityWorldPosition(bullet);
        bullet.worldX += bullet.vx * dt;
        bullet.worldY += bullet.vy * dt;
        syncEntityScreenPosition(bullet, cameraX, cameraY);
        bullet.life -= dt;
      }
    }

    function resolveBulletTargets() {
      for (const bullet of state.bullets) {
        if (bullet.life <= 0) continue;
        const bulletW = { worldX: entityWorldX(bullet), worldY: entityWorldY(bullet) };

        const worldBodies = typeof worldSystem.getCollidableBodies === "function" ? worldSystem.getCollidableBodies(state.time) : [];
        let blockedByWorldBody = false;
        for (const body of worldBodies) {
          if (circlesOverlapWorldEntities(body, body.hitRadius || body.radius || 12, bulletW, bullet.radius)) {
            tryRicochetBullet(
              bullet,
              entityWorldX(bullet) - entityWorldX(body),
              entityWorldY(bullet) - entityWorldY(body),
              bullet.x,
              bullet.y,
            );
            blockedByWorldBody = true;
            break;
          }
        }
        if (blockedByWorldBody) continue;

        if (state.bossActive && state.boss && circlesOverlapWorldEntities(state.boss, state.boss.collisionRadius, bulletW, bullet.radius)) {
          const dmg = computeDamage((bullet.damageBase || state.weapon.cannonEffectiveness), "physical");
          state.boss.hp -= dmg.damage;
          addDamageText(bullet.x, bullet.y - 6, dmg.damage, dmg.crit);
          tryRicochetBullet(bullet, entityWorldX(bullet) - entityWorldX(state.boss), entityWorldY(bullet) - entityWorldY(state.boss), bullet.x, bullet.y);
          if (state.boss.hp <= 0) {
            onBossDefeated();
          }
          continue;
        }

        for (const obj of state.objects) {
          if (obj.hp <= 0) continue;
          if (!circlesOverlapWorldEntities(obj, obj.collisionRadius, bulletW, bullet.radius)) continue;
          if (obj.destructible) {
            const dmg = computeDamage((bullet.damageBase || state.weapon.cannonEffectiveness), "physical");
            obj.hp -= dmg.damage;
            addDamageText(bullet.x, bullet.y - 6, dmg.damage, dmg.crit);
            if (obj.hp <= 0) {
              destroyObject(obj, DESTROY_REASONS.SHOT);
            }
          }
          tryRicochetBullet(bullet, entityWorldX(bullet) - entityWorldX(obj), entityWorldY(bullet) - entityWorldY(obj), bullet.x, bullet.y);
          break;
        }
      }
    }

    function resolveMissiles(dt, cameraX, cameraY) {
      for (const missile of state.missiles) {
        ensureEntityWorldPosition(missile);
        if (state.weapon.rocketHoming) {
          missile.acquireIn = (missile.acquireIn || 0) - dt;
          let target = missile.targetRef;
          if (!target || target.hp <= 0 || missile.acquireIn <= 0) {
            target = weapons.findNearestObject(missile.worldX, missile.worldY);
            missile.targetRef = target || null;
            missile.acquireIn = 0.12 + Math.random() * 0.08;
          }
          if (target) {
            const targetX = Number.isFinite(target.worldX) ? target.worldX : target.x;
            const targetY = Number.isFinite(target.worldY) ? target.worldY : target.y;
            const dx = targetX - missile.worldX;
            const dy = targetY - missile.worldY;
            const dist = Math.hypot(dx, dy) || 1;
            const desiredVx = (dx / dist) * missile.speed;
            const desiredVy = (dy / dist) * missile.speed;
            missile.vx += (desiredVx - missile.vx) * Math.min(1, missile.turnRate * dt);
            missile.vy += (desiredVy - missile.vy) * Math.min(1, missile.turnRate * dt);
          }
        }

        missile.worldX += missile.vx * dt;
        missile.worldY += missile.vy * dt;
        syncEntityScreenPosition(missile, cameraX, cameraY);
        missile.life -= dt;
        const missileW = { worldX: missile.worldX, worldY: missile.worldY };

        if (state.bossActive && state.boss) {
          if (circlesOverlapWorldEntities(state.boss, state.boss.collisionRadius, missileW, missile.radius)) {
            const blastScale = missile.blastScale || 1;
            weapons.explodeRocketAt(missile.x, missile.y, blastScale);
            const dmg = computeDamage(missile.damageBase || 18, "explosive");
            state.boss.hp -= dmg.damage;
            addDamageText(missile.x, missile.y - 8, dmg.damage, dmg.crit);
            missile.life = 0;
            if (state.boss.hp <= 0) {
              onBossDefeated();
            }
            continue;
          }
        }

        let exploded = false;
        const worldBodies = typeof worldSystem.getCollidableBodies === "function" ? worldSystem.getCollidableBodies(state.time) : [];
        for (const body of worldBodies) {
          if (circlesOverlapWorldEntities(body, body.hitRadius || body.radius || 12, missileW, missile.radius)) {
            weapons.explodeRocketAt(missile.x, missile.y, missile.blastScale || 1);
            missile.life = 0;
            exploded = true;
            break;
          }
        }

        if (exploded) continue;

        for (const obj of state.objects) {
          if (obj.hp <= 0) continue;
          if (circlesOverlapWorldEntities(obj, obj.collisionRadius, missileW, missile.radius)) {
            weapons.explodeRocketAt(missile.x, missile.y, missile.blastScale || 1);
            missile.life = 0;
            exploded = true;
            break;
          }
        }

        if (exploded) continue;
      }
    }

    function resolveBossProjectiles(dt, cameraX, cameraY, ship) {
      for (const proj of state.bossProjectiles) {
        ensureEntityWorldPosition(proj);
        proj.worldX += proj.vx * dt;
        proj.worldY += proj.vy * dt;
        syncEntityScreenPosition(proj, cameraX, cameraY);
        proj.life -= dt;

        if (proj.damageType === "explosive") {
          const splashR = proj.radius + 30;
          const dSplash = Math.hypot(entityWorldX(proj) - entityWorldX(ship), entityWorldY(proj) - entityWorldY(ship));
          if (dSplash < splashR + ship.radius) {
            proj.life = 0;
            const splashDamage = dSplash < proj.radius + ship.radius ? 2 : 1;
            if (!hitShip("explosive", splashDamage)) {
              setGameOver();
              return false;
            }
            createExplosion(proj.x, proj.y, "#ff8f64", 12);
          }
        }

        const dShip = Math.hypot(entityWorldX(proj) - entityWorldX(ship), entityWorldY(proj) - entityWorldY(ship));
        if (dShip < proj.radius + ship.radius) {
          proj.life = 0;
          if (!hitShip(proj.damageType || "physical", proj.damageAmount || 1)) {
            setGameOver();
            return false;
          }
          if (proj.damageType === "acid") {
            applyAcidToShip(4, 0.9);
            createExplosion(proj.x, proj.y, "#7eff6f", 9);
          }
        }

        for (const bullet of state.bullets) {
          if (bullet.life <= 0) continue;
          const d = Math.hypot(entityWorldX(proj) - entityWorldX(bullet), entityWorldY(proj) - entityWorldY(bullet));
          if (d < proj.radius + bullet.radius) {
            proj.life = 0;
            bullet.life = 0;
            break;
          }
        }
      }

      return true;
    }

    function resolvePlasmaBursts(dt, cameraX, cameraY, ship) {
      for (const burst of state.plasmaBursts) {
        ensureEntityWorldPosition(burst);
        burst.worldX += burst.vx * dt;
        burst.worldY += burst.vy * dt;
        syncEntityScreenPosition(burst, cameraX, cameraY);
        burst.life -= dt;
        burst.radius += burst.growth * dt;
        burst.vx *= 0.975;
        burst.vy *= 0.975;
        burst.rangeLeft -= Math.hypot(burst.vx, burst.vy) * dt;

        if (burst.hitDone || burst.life <= 0 || burst.rangeLeft <= 0) continue;

        if (burst.enemyOwned) {
          const dShip = Math.hypot(ship.x - burst.x, ship.y - burst.y);
          if (dShip < ship.radius + burst.radius) {
            const enemyDamageType = burst.damageType || "heat";
            const enemyDamageAmount = Number.isFinite(burst.damage) ? burst.damage : 1;
            if (!hitShip(enemyDamageType, enemyDamageAmount)) {
              setGameOver();
              return false;
            }
            if (enemyDamageType === "acid") {
              applyAcidToShip(3.6, 0.85);
              createExplosion(burst.x, burst.y, "#79ff6f", 8);
            }
            burst.hitDone = true;
            burst.life = Math.min(burst.life, 0.04);
          }
          continue;
        }

        for (const obj of state.objects) {
          if (obj.hp <= 0 || !obj.destructible) continue;
          const d = Math.hypot(obj.x - burst.x, obj.y - burst.y);
          if (d < obj.collisionRadius + burst.radius) {
            applyHeatHit(obj, burst.damage, burst.x, burst.y);
            burst.hitDone = true;
            burst.life = Math.min(burst.life, 0.05);
            break;
          }
        }

        if (!burst.hitDone && state.bossActive && state.boss) {
          const dBoss = Math.hypot(state.boss.x - burst.x, state.boss.y - burst.y);
          if (dBoss < state.boss.collisionRadius + burst.radius) {
            applyHeatHit(state.boss, burst.damage, burst.x, burst.y);
            burst.hitDone = true;
            burst.life = Math.min(burst.life, 0.05);
          }
        }

        if (!burst.hitDone) {
          const worldBodies = typeof worldSystem.getCollidableBodies === "function" ? worldSystem.getCollidableBodies(state.time) : [];
          for (const body of worldBodies) {
            const bodyPos = cameraSystem.worldToScreen(body.x, body.y, body.parallax || 1, WORLD.width, WORLD.height);
            const dBody = Math.hypot(bodyPos.x - burst.x, bodyPos.y - burst.y);
            const bodyR = body.hitRadius || body.radius || 12;
            if (dBody < bodyR + burst.radius) {
              burst.hitDone = true;
              burst.life = 0;
              break;
            }
          }
        }
      }

      return true;
    }

    return {
      resolveBulletsMovement,
      resolveBulletTargets,
      resolveMissiles,
      resolveBossProjectiles,
      resolvePlasmaBursts,
    };
  }

  window.VoidProjectileResolver = {
    createProjectileResolverSystem,
  };
})();
