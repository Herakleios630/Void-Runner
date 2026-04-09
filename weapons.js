(function () {
  function createWeaponsSystem(deps) {
    const {
      state,
      input,
      reloadRate,
      computeDamage,
      addDamageText,
      createExplosion,
      onBossDefeated,
      destroyObject,
      applyHeatHit,
      playSfx,
    } = deps;

    function effectiveRocketCooldown() {
      return state.weapon.rocketCooldown / reloadRate();
    }

    function effectiveCannonCooldown() {
      return state.shotCooldown / reloadRate();
    }

    function effectiveLaserCooldown() {
      return state.weapon.laserCooldown / reloadRate();
    }

    function effectivePlasmaCooldown() {
      return state.weapon.plasmaCooldown / reloadRate();
    }

    function getRocketCooldownLeft() {
      if (!state.weapon.rocketUnlocked) return 0;
      return Math.max(0, state.weapon.rocketCooldown - (state.realNow - state.weapon.lastRocketRealShot));
    }

    function rayCircleHitDistance(ox, oy, dx, dy, cx, cy, r, maxRange) {
      const lx = cx - ox;
      const ly = cy - oy;
      const tca = lx * dx + ly * dy;
      if (tca < 0 || tca > maxRange) return null;
      const d2 = lx * lx + ly * ly - tca * tca;
      const r2 = r * r;
      if (d2 > r2) return null;
      const thc = Math.sqrt(Math.max(0, r2 - d2));
      const t0 = tca - thc;
      const t1 = tca + thc;
      if (t0 >= 0 && t0 <= maxRange) return t0;
      if (t1 >= 0 && t1 <= maxRange) return t1;
      return null;
    }

    function fireSingleLaserRay(ox, oy, dx, dy, maxRange) {
      const candidates = [];

      for (const obj of state.objects) {
        if (obj.hp <= 0) continue;
        const t = rayCircleHitDistance(ox, oy, dx, dy, obj.x, obj.y, obj.collisionRadius, maxRange);
        if (t === null) continue;
        candidates.push({ t, kind: "object", ref: obj });
      }

      if (state.bossActive && state.boss) {
        const t = rayCircleHitDistance(ox, oy, dx, dy, state.boss.x, state.boss.y, state.boss.collisionRadius, maxRange);
        if (t !== null) {
          candidates.push({ t, kind: "boss", ref: state.boss });
        }
      }

      for (const hazard of state.edgeHazards) {
        const t = rayCircleHitDistance(ox, oy, dx, dy, hazard.x, hazard.y, hazard.hitRadius, maxRange);
        if (t === null) continue;
        candidates.push({ t, kind: "hazard", ref: hazard });
      }

      candidates.sort((a, b) => a.t - b.t);

      let remainingPierce = state.weapon.laserPierce;
      let beamEnd = maxRange;
      const hitColor = "#8ef7ff";

      for (const hit of candidates) {
        if (remainingPierce <= 0) break;
        beamEnd = Math.min(beamEnd, hit.t);

        if (hit.kind === "boss") {
          const dmg = computeDamage(state.weapon.laserDamage, "energy");
          hit.ref.hp -= dmg.damage;
          addDamageText(ox + dx * hit.t, oy + dy * hit.t - 6, dmg.damage, dmg.crit);
          createExplosion(ox + dx * hit.t, oy + dy * hit.t, hitColor, 7);
          if (hit.ref.hp <= 0) {
            onBossDefeated();
          }
          remainingPierce -= 1;
          continue;
        }

        if (hit.kind === "object") {
          if (hit.ref.destructible) {
            const dmg = computeDamage(state.weapon.laserDamage, "energy");
            hit.ref.hp -= dmg.damage;
            addDamageText(ox + dx * hit.t, oy + dy * hit.t - 6, dmg.damage, dmg.crit);
            if (hit.ref.hp <= 0) {
              destroyObject(hit.ref, "shot");
            }
          }
          createExplosion(ox + dx * hit.t, oy + dy * hit.t, hitColor, 6);
          remainingPierce -= 1;
          continue;
        }

        beamEnd = hit.t;
        remainingPierce = 0;
      }

      state.laserBeams.push({
        x1: ox,
        y1: oy,
        x2: ox + dx * beamEnd,
        y2: oy + dy * beamEnd,
        life: 0.09,
        width: 2.3 + state.weapon.laserDamage * 0.35,
      });
    }

    function fireLaserPulse(now) {
      if (!state.weapon.laserUnlocked) return;
      if (now - state.weapon.lastLaserShot < effectiveLaserCooldown()) return;

      state.weapon.lastLaserShot = now;

      const ox = state.ship.x;
      const oy = state.ship.y;
      const dxRaw = input.mouseX - ox;
      const dyRaw = input.mouseY - oy;
      const len = Math.hypot(dxRaw, dyRaw) || 1;
      const dx = dxRaw / len;
      const dy = dyRaw / len;
      const maxRange = state.weapon.laserRange;

      const offsets = state.weaponSpecials.laserTri ? [-0.18, 0, 0.18] : [0];
      for (const off of offsets) {
        const a = Math.atan2(dy, dx) + off;
        fireSingleLaserRay(ox, oy, Math.cos(a), Math.sin(a), maxRange);
      }

      if (state.weaponSpecials.laserRear) {
        fireSingleLaserRay(ox, oy, -dx, -dy, maxRange * 0.9);
      }

      playSfx("laser");
    }

    function firePlasmaPulse(now) {
      if (!state.weapon.plasmaUnlocked) return;
      if (now - state.weapon.lastPlasmaShot < effectivePlasmaCooldown()) return;

      state.weapon.lastPlasmaShot = now;

      const ox = state.ship.x;
      const oy = state.ship.y;
      const dxRaw = input.mouseX - ox;
      const dyRaw = input.mouseY - oy;
      const aim = Math.atan2(dyRaw, dxRaw);
      const beamOffsets = state.weaponSpecials.plasmaCross
        ? [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5]
        : state.weaponSpecials.plasmaTriad
          ? [0, (Math.PI * 2) / 3, -(Math.PI * 2) / 3]
          : state.weaponSpecials.plasmaBack
            ? [0, Math.PI]
            : [0];

      const pellets = beamOffsets.length >= 4 ? 4 : 6;
      for (const beamOff of beamOffsets) {
        const beamAim = aim + beamOff;
        for (let i = 0; i < pellets; i += 1) {
          const t = pellets <= 1 ? 0 : i / (pellets - 1);
          const spread = (t - 0.5) * state.weapon.plasmaArc * 2;
          const a = beamAim + spread + (Math.random() - 0.5) * 0.02;
          const speed = 380 + Math.random() * 170;
          const life = 0.72 + Math.random() * 0.3;
          state.plasmaBursts.push({
            x: ox,
            y: oy,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            life,
            maxLife: life,
            radius: 2.8 + Math.random() * 0.9,
            growth: 22 + Math.random() * 14,
            damage: state.weapon.plasmaDamage,
            rangeLeft: state.weapon.plasmaRange,
            hitDone: false,
          });
        }
      }

      state.weaponCounters.plasmaShots += 1;
      if (state.weaponSpecials.plasmaNova && state.weaponCounters.plasmaShots % 3 === 0) {
        const novaR = 126;
        for (const obj of state.objects) {
          if (obj.hp <= 0 || !obj.destructible) continue;
          if (Math.hypot(obj.x - ox, obj.y - oy) <= novaR + obj.collisionRadius) {
            applyHeatHit(obj, 0, obj.x, obj.y);
          }
        }
        if (state.bossActive && state.boss && Math.hypot(state.boss.x - ox, state.boss.y - oy) <= novaR + state.boss.collisionRadius) {
          applyHeatHit(state.boss, 0, state.boss.x, state.boss.y);
        }
        createExplosion(ox, oy, "#ff944d", 30);
      }

      playSfx("plasma");
    }

    function spawnCannonBullet(params) {
      const {
        x,
        y,
        vx,
        vy,
        life = 1.25,
        radius = 3.5,
        damageBase = state.weapon.cannonEffectiveness,
        ricochetLeft = state.weaponSpecials.cannonRicochetMaxBounces || 0,
        ricochetCount = 0,
      } = params;

      state.bullets.push({
        x,
        y,
        vx,
        vy,
        life,
        radius,
        damageBase,
        ricochetLeft,
        ricochetCount,
      });
    }

    function shootAtCursor(now) {
      if (state.weapon.cannonUnlocked && now - state.lastShot >= effectiveCannonCooldown()) {
        state.lastShot = now;

        const baseDx = input.mouseX - state.ship.x;
        const baseDy = input.mouseY - state.ship.y;
        const baseLen = Math.hypot(baseDx, baseDy) || 1;
        const spawnCannonWave = (speedMult = 1, spreadMult = 1) => {
          const channels = 1 + state.weapon.extraLasers + state.weaponSpecials.cannonExtraChannel;
          const ux = baseDx / baseLen;
          const uy = baseDy / baseLen;
          const perpX = -uy;
          const perpY = ux;

          for (let i = 0; i < channels; i += 1) {
            const indexOffset = i - (channels - 1) / 2;
            const offset = indexOffset * state.weapon.laserSpread * spreadMult;
            const sx = state.ship.x + perpX * offset;
            const sy = state.ship.y + perpY * offset;

            spawnCannonBullet({
              x: sx,
              y: sy,
              vx: ux * 820 * speedMult,
              vy: uy * 820 * speedMult,
              life: 1.25,
              radius: 3.5,
            });
          }
        };

        spawnCannonWave(1, 1);
        if (state.weaponSpecials.cannonDoubleTap && Math.random() < 0.33) {
          spawnCannonWave(0.92, 0.94);
        }

        state.weaponCounters.cannonShots += 1;
        if (state.weaponSpecials.cannonStorm && state.weaponCounters.cannonShots % 6 === 0) {
          for (let i = 0; i < 6; i += 1) {
            const a = (i / 6) * Math.PI * 2;
            spawnCannonBullet({
              x: state.ship.x,
              y: state.ship.y,
              vx: Math.cos(a) * 680,
              vy: Math.sin(a) * 680,
              life: 0.85,
              radius: 3.1,
            });
          }
        }

        playSfx("cannon");
      }

      fireLaserPulse(now);
      firePlasmaPulse(now);
    }

    function fireRocket(now) {
      if (!state.weapon.rocketUnlocked) return;
      if (getRocketCooldownLeft() > 0) return;

      state.weapon.lastRocketShot = now;
      state.weapon.lastRocketRealShot = state.realNow;

      const dx = input.mouseX - state.ship.x;
      const dy = input.mouseY - state.ship.y;
      const baseAngle = Math.atan2(dy, dx);
      const offsets = state.weapon.rocketSplit ? [-0.18, 0, 0.18] : [0];
      state.weaponCounters.rocketShots += 1;
      const omega = state.weaponSpecials.rocketOmega && state.weaponCounters.rocketShots % 3 === 0;

      for (const off of offsets) {
        const a = baseAngle + off;
        state.missiles.push({
          x: state.ship.x,
          y: state.ship.y,
          vx: Math.cos(a) * 380,
          vy: Math.sin(a) * 380,
          speed: 380,
          life: 4,
          radius: 6,
          turnRate: 2.6,
          damageBase: omega ? 28 : 18,
          blastScale: omega ? 1.35 : 1,
          targetRef: null,
          acquireIn: 0,
        });
      }

      playSfx("rocket");
    }

    function findNearestObject(x, y) {
      let best = null;
      let bestDistSq = Infinity;
      for (const obj of state.objects) {
        if (obj.hp <= 0) continue;
        const dx = obj.x - x;
        const dy = obj.y - y;
        const dSq = dx * dx + dy * dy;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          best = obj;
        }
      }
      return best;
    }

    function explodeRocketAt(x, y, radiusScale = 1) {
      const radius = state.weapon.rocketBlastRadius * radiusScale;

      for (const obj of state.objects) {
        if (obj.hp <= 0) continue;
        const d = Math.hypot(obj.x - x, obj.y - y);
        if (d > radius + obj.collisionRadius) continue;

        if (obj.destructible || obj.type === "boulder" || obj.type === "debris") {
          destroyObject(obj, "rocket");
        }
      }

      createExplosion(x, y, "#ff9652", 30);
      playSfx("explosion");
    }

    return {
      effectiveRocketCooldown,
      effectiveCannonCooldown,
      effectiveLaserCooldown,
      effectivePlasmaCooldown,
      getRocketCooldownLeft,
      shootAtCursor,
      fireRocket,
      findNearestObject,
      explodeRocketAt,
      spawnCannonBullet,
    };
  }

  window.VoidWeapons = {
    createWeaponsSystem,
  };
})();
