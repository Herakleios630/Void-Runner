(function () {
  function createRenderer(deps) {
    const {
      ctx,
      state,
      input,
      WORLD,
      IS_COARSE_POINTER,
      selectedShipModel,
      getRocketCooldownLeft,
      getSprite,
    } = deps;

    const BURN_VFX_MAX_SPRITES = 80;
    let burnVfxSpriteCount = 0;

    function drawMobileCanvasHud() {
      if (!IS_COARSE_POINTER) return;

      const hpText = state.ship ? `HP ${Math.max(0, state.ship.hp)}/${state.ship.maxHp}` : "HP -";
      const armorText = state.ship ? `ARM ${Math.max(0, Math.floor(state.ship.armor))}/${state.ship.maxArmor}` : "ARM -";
      const scoreText = `Punkte ${Math.floor(state.score)}`;
      const levelText = `Lvl ${state.level}`;

      ctx.save();
      ctx.font = "bold 13px Trebuchet MS";
      ctx.textBaseline = "middle";

      const drawTag = (x, y, text) => {
        const tw = Math.ceil(ctx.measureText(text).width);
        const w = tw + 18;
        const h = 26;
        ctx.fillStyle = "rgba(6, 16, 38, 0.8)";
        ctx.strokeStyle = "rgba(103, 242, 255, 0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + w - 8, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + 8);
        ctx.lineTo(x + w, y + h - 8);
        ctx.quadraticCurveTo(x + w, y + h, x + w - 8, y + h);
        ctx.lineTo(x + 8, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - 8);
        ctx.lineTo(x, y + 8);
        ctx.quadraticCurveTo(x, y, x + 8, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#eef8ff";
        ctx.fillText(text, x + 9, y + h * 0.52);
        return w;
      };

      const topY = 8;
      const leftX = 8;
      const gap = 8;
      const scoreW = drawTag(leftX, topY, scoreText);
      drawTag(leftX + scoreW + gap, topY, levelText);

      const hpW = Math.ceil(ctx.measureText(hpText).width) + 18;
      drawTag(Math.max(8, WORLD.width - hpW - 8), topY, hpText);
      const armorW = Math.ceil(ctx.measureText(armorText).width) + 18;
      drawTag(Math.max(8, WORLD.width - armorW - 8), topY + 30, armorText);

      if (state.pauseReason === "manual-pause") {
        const pauseText = "PAUSE";
        const pauseW = Math.ceil(ctx.measureText(pauseText).width) + 18;
        drawTag(Math.max(8, WORLD.width - hpW - pauseW - 16), topY, pauseText);
      }

      ctx.restore();
    }

    function drawShip(ship) {
      const moveAngle = Math.atan2(ship.vy, ship.vx || 0.001);
      const aimAngle = Math.atan2(input.mouseY - ship.y, input.mouseX - ship.x);
      const model = selectedShipModel();
      const shipSprite = getSprite(`ship.${model.id}`) || getSprite("ship.default");

      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(moveAngle);

      if (shipSprite) {
        const w = ship.radius * 2.8;
        const h = ship.radius * 2.4;
        ctx.drawImage(shipSprite, -w * 0.5, -h * 0.5, w, h);
      } else if (model.id === "tank") {
        ctx.fillStyle = model.colorA;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-15, 13);
        ctx.lineTo(-20, 7);
        ctx.lineTo(-20, -7);
        ctx.lineTo(-15, -13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = model.colorB;
        ctx.fillRect(-8, -6, 14, 12);
      } else if (model.id === "glass") {
        ctx.fillStyle = model.colorA;
        ctx.beginPath();
        ctx.moveTo(24, 0);
        ctx.lineTo(-13, 9);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-13, -9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = model.colorB;
        ctx.beginPath();
        ctx.arc(-4, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-14, 10);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-14, -10);
        ctx.closePath();
        ctx.fillStyle = model.colorA;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-6, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = model.colorB;
        ctx.fill();
      }

      if (state.weapon.cannonUnlocked) {
        const turretCount = 1 + state.weapon.extraLasers;
        const offsets = turretCount === 1 ? [0] : turretCount === 2 ? [-6, 6] : [-8, 0, 8];
        for (const yOff of offsets) {
          ctx.save();
          ctx.translate(0, yOff);
          ctx.rotate(aimAngle - moveAngle);
          ctx.fillStyle = "#2e3d52";
          ctx.fillRect(-2, -2, 14, 4);
          ctx.fillStyle = "#ffd07b";
          ctx.fillRect(10, -1.2, 5, 2.4);
          ctx.restore();
        }
      }

      if (state.weapon.laserUnlocked) {
        ctx.save();
        ctx.rotate(aimAngle - moveAngle);
        ctx.fillStyle = "#79f2ff";
        ctx.fillRect(2, -5.5, 10, 3);
        ctx.fillRect(2, 2.5, 10, 3);
        ctx.restore();
      }

      if (state.shield.unlocked && state.shield.charges > 0) {
        ctx.strokeStyle = "rgba(132, 230, 255, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, ship.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (state.weapon.drillUnlocked) {
        const ready = state.weapon.drillCharges > 0;
        const reach = ship.radius + state.weapon.drillReach;
        ctx.save();
        ctx.rotate(aimAngle - moveAngle);
        ctx.strokeStyle = ready ? "rgba(142, 247, 255, 0.95)" : "rgba(122, 144, 166, 0.8)";
        ctx.fillStyle = ready ? "rgba(142, 247, 255, 0.42)" : "rgba(80, 97, 116, 0.36)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ship.radius - 4, -6);
        ctx.lineTo(reach, 0);
        ctx.lineTo(ship.radius - 4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      if (state.weapon.rocketUnlocked && getRocketCooldownLeft() <= 0.05) {
        ctx.save();
        ctx.translate(-18, -16);
        ctx.rotate(-0.2);
        ctx.fillStyle = "#ffb072";
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-8, 6);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-8, -6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffd39d";
        ctx.fillRect(-11, -2, 4, 4);
        ctx.restore();
      }

      ctx.restore();
    }

    function drawMissile(missile) {
      const a = Math.atan2(missile.vy, missile.vx || 0.001);
      ctx.save();
      ctx.translate(missile.x, missile.y);
      ctx.rotate(a);

      ctx.fillStyle = "#ff9f5f";
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-8, 5.5);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, -5.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffd5ac";
      ctx.fillRect(-10, -2, 4, 4);

      ctx.fillStyle = "rgba(255, 197, 99, 0.7)";
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-13 - Math.random() * 4, 2);
      ctx.lineTo(-13 - Math.random() * 4, -2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    function drawObject(obj) {
      const spriteKey =
        obj.type === "miniAlien"
          ? "enemy.miniAlien"
          : obj.type === "alienShip"
            ? "enemy.alienShip"
            : obj.type === "smallRock"
              ? "rock.smallRock"
              : obj.type === "mediumRock"
                ? "rock.mediumRock"
                : obj.type === "rockShard"
                  ? "rock.rockShard"
                  : obj.type === "boulder"
                    ? "rock.boulder"
                    : null;
      const sprite = spriteKey ? getSprite(spriteKey) : null;

      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(obj.angle);

      if (sprite) {
        const d = obj.size * 2;
        ctx.drawImage(sprite, -d * 0.5, -d * 0.5, d, d);
      } else if (obj.type === "miniAlien") {
        ctx.fillStyle = "#9eff7f";
        ctx.beginPath();
        ctx.ellipse(0, 0, obj.size * 0.95, obj.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#18250f";
        ctx.beginPath();
        ctx.arc(-obj.size * 0.28, -2, 2.2, 0, Math.PI * 2);
        ctx.arc(obj.size * 0.28, -2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.type === "alienShip") {
        ctx.fillStyle = "#8cf3a0";
        ctx.beginPath();
        ctx.moveTo(obj.size * 0.95, 0);
        ctx.lineTo(-obj.size * 0.7, obj.size * 0.45);
        ctx.lineTo(-obj.size * 0.2, 0);
        ctx.lineTo(-obj.size * 0.7, -obj.size * 0.45);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#1b3b24";
        ctx.fillRect(-obj.size * 0.2, -obj.size * 0.15, obj.size * 0.38, obj.size * 0.3);
      } else {
        ctx.beginPath();
        const corners = obj.corners || (obj.type === "boulder" ? 11 : obj.type === "mediumRock" ? 9 : 8);
        for (let i = 0; i < corners; i += 1) {
          const t = (i / corners) * Math.PI * 2;
          const profile = obj.rockProfile ? obj.rockProfile[i] : 0.8;
          const r = obj.size * profile;
          const px = Math.cos(t) * r;
          const py = Math.sin(t) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        if (obj.type === "smallRock") ctx.fillStyle = "#b8c4d4";
        else if (obj.type === "mediumRock") ctx.fillStyle = "#96a2b8";
        else if (obj.type === "rockShard") ctx.fillStyle = "#d5deea";
        else if (obj.type === "boulder") ctx.fillStyle = "#7b8496";
        else ctx.fillStyle = "#5c6474";

        ctx.fill();
      }

      if (obj.burnUntil && obj.burnUntil > state.time) {
        drawBurningEffect(0, -obj.size * 0.08, obj.size * 1.15);
      }

      ctx.restore();
    }

    function drawBurningEffect(x, y, size) {
      if (burnVfxSpriteCount >= BURN_VFX_MAX_SPRITES) return;
      const flicker = 0.82 + Math.sin(state.time * 25 + x * 0.02 + y * 0.02) * 0.18;
      const count = 3;
      for (let i = 0; i < count; i += 1) {
        if (burnVfxSpriteCount >= BURN_VFX_MAX_SPRITES) break;
        const a = (state.time * 3 + i * 2.2) % (Math.PI * 2);
        const r = size * (0.28 + i * 0.2);
        const px = x + Math.cos(a) * r * 0.55;
        const py = y + Math.sin(a * 1.2) * r * 0.42 - size * 0.1;
        const rr = Math.max(3, size * (0.2 + i * 0.09) * flicker);

        const g = ctx.createRadialGradient(px, py, 1, px, py, rr);
        g.addColorStop(0, "rgba(255, 245, 190, 0.95)");
        g.addColorStop(0.45, "rgba(255, 152, 72, 0.72)");
        g.addColorStop(1, "rgba(40, 26, 22, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, rr, 0, Math.PI * 2);
        ctx.fill();
        burnVfxSpriteCount += 1;

        const smokeR = rr * 0.95;
        const smoke = ctx.createRadialGradient(px, py - smokeR * 0.2, 1, px, py - smokeR * 0.2, smokeR);
        smoke.addColorStop(0, "rgba(60, 48, 44, 0.25)");
        smoke.addColorStop(1, "rgba(14, 14, 14, 0)");
        ctx.fillStyle = smoke;
        ctx.beginPath();
        ctx.arc(px, py - smokeR * 0.18, smokeR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawEdgeHazard(hazard) {
      const spriteKey =
        hazard.kind === "planet"
          ? "hazard.planet"
          : hazard.kind === "station"
            ? "hazard.station"
            : "hazard.blackHole";
      const sprite = getSprite(spriteKey);

      ctx.save();
      ctx.translate(hazard.x, hazard.y);
      ctx.rotate(hazard.angle);

      if (sprite) {
        const d = hazard.radius * 2;
        ctx.drawImage(sprite, -d * 0.5, -d * 0.5, d, d);
      } else if (hazard.kind === "planet") {
        const grad = ctx.createRadialGradient(-hazard.radius * 0.28, -hazard.radius * 0.28, hazard.radius * 0.1, 0, 0, hazard.radius);
        grad.addColorStop(0, "#9ec8ff");
        grad.addColorStop(0.45, "#4a74a8");
        grad.addColorStop(1, "#1a2a44");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, hazard.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(214, 236, 255, 0.22)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, 0, hazard.radius * 0.83, -1.8, 1.2);
        ctx.stroke();
      } else if (hazard.kind === "station") {
        ctx.fillStyle = "#96a9c3";
        ctx.beginPath();
        ctx.arc(0, 0, hazard.radius * 0.38, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#74839a";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, hazard.radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#5a667c";
        ctx.fillRect(-hazard.radius * 0.95, -8, hazard.radius * 1.9, 16);
        ctx.fillRect(-8, -hazard.radius * 0.95, 16, hazard.radius * 1.9);
      } else {
        const glow = ctx.createRadialGradient(0, 0, hazard.radius * 0.15, 0, 0, hazard.radius);
        glow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        glow.addColorStop(0.3, "rgba(106, 102, 255, 0.85)");
        glow.addColorStop(0.7, "rgba(43, 39, 96, 0.65)");
        glow.addColorStop(1, "rgba(0, 0, 0, 0.2)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, hazard.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    function drawBoss() {
      if (!state.bossActive || !state.boss) return;

      const boss = state.boss;

      ctx.save();
      ctx.translate(boss.x, boss.y);

      if (boss.variant === "tentacle") {
        ctx.fillStyle = "#8fff8b";
        ctx.beginPath();
        ctx.ellipse(0, 0, boss.size * 0.8, boss.size * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#71d764";
        ctx.lineWidth = 7;
        for (let i = 0; i < 4; i += 1) {
          const oy = (i - 1.5) * 26;
          ctx.beginPath();
          ctx.moveTo(-boss.size * 0.45, oy);
          ctx.bezierCurveTo(-boss.size * 0.7, oy + 18, -boss.size * 0.9, oy + Math.sin(state.time * 3 + i) * 20, -boss.size * 1.05, oy + 10);
          ctx.stroke();
        }
      } else if (boss.variant === "warship") {
        ctx.fillStyle = "#a2b6d9";
        ctx.beginPath();
        ctx.moveTo(boss.size * 0.85, 0);
        ctx.lineTo(-boss.size * 0.75, boss.size * 0.42);
        ctx.lineTo(-boss.size * 0.45, 0);
        ctx.lineTo(-boss.size * 0.75, -boss.size * 0.42);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#53617a";
        ctx.fillRect(-boss.size * 0.45, -boss.size * 0.2, boss.size * 0.95, boss.size * 0.4);
      } else {
        ctx.fillStyle = "#f6a268";
        ctx.beginPath();
        ctx.ellipse(0, 0, boss.size * 0.78, boss.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#db7c43";
        ctx.fillRect(-boss.size * 0.35, -boss.size * 0.6, boss.size * 0.7, boss.size * 0.18);
        ctx.fillRect(-boss.size * 0.35, boss.size * 0.42, boss.size * 0.7, boss.size * 0.18);
      }

      ctx.fillStyle = "#1d261a";
      ctx.beginPath();
      ctx.arc(-boss.size * 0.18, -boss.size * 0.08, 8, 0, Math.PI * 2);
      ctx.arc(boss.size * 0.18, -boss.size * 0.08, 8, 0, Math.PI * 2);
      ctx.fill();

      if (boss.burnUntil && boss.burnUntil > state.time) {
        drawBurningEffect(0, -boss.size * 0.08, boss.size * 1.2);
      }

      ctx.restore();

      const barW = 360;
      const barH = 16;
      const x = WORLD.width * 0.5 - barW * 0.5;
      const y = 14;
      const pct = Math.max(0, boss.hp / boss.maxHp);

      ctx.fillStyle = "rgba(11, 19, 40, 0.84)";
      ctx.fillRect(x - 3, y - 3, barW + 6, barH + 6);
      ctx.fillStyle = "#2a3657";
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = "#ff6e5f";
      ctx.fillRect(x, y, barW * pct, barH);
      ctx.fillStyle = "#e9f0ff";
      ctx.font = "13px Trebuchet MS";
      ctx.fillText(`BOSS (${boss.variant}) HP ${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp}`, x + 8, y + 12);
    }

    function drawBossWarning() {
      if (!state.bossActive || !state.boss || !state.boss.intro) return;

      const blink = Math.sin(state.time * 14) > 0;
      const alpha = blink ? 0.92 : 0.45;
      const text = "WARNING: BOSS INCOMING";

      ctx.save();
      ctx.fillStyle = `rgba(160, 28, 36, ${0.38 + alpha * 0.2})`;
      ctx.fillRect(0, WORLD.height * 0.38, WORLD.width, 52);
      ctx.strokeStyle = `rgba(255, 126, 118, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(0, WORLD.height * 0.38, WORLD.width, 52);
      ctx.fillStyle = `rgba(255, 240, 238, ${alpha})`;
      ctx.font = "bold 28px Trebuchet MS";
      const tw = ctx.measureText(text).width;
      ctx.fillText(text, WORLD.width * 0.5 - tw * 0.5, WORLD.height * 0.38 + 34);
      ctx.restore();
    }

    function drawDebugOverlay() {
      if (!state.running || !state.debugHitboxes) return;

      ctx.save();
      ctx.lineWidth = 1.2;

      ctx.strokeStyle = "rgba(113, 244, 255, 0.95)";
      ctx.beginPath();
      ctx.arc(state.ship.x, state.ship.y, state.ship.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 180, 106, 0.95)";
      for (const obj of state.objects) {
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.collisionRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255, 94, 121, 0.95)";
      for (const hazard of state.edgeHazards) {
        ctx.beginPath();
        ctx.arc(hazard.x, hazard.y, hazard.hitRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255, 218, 107, 0.95)";
      for (const bullet of state.bullets) {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const missile of state.missiles) {
        ctx.beginPath();
        ctx.arc(missile.x, missile.y, missile.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (state.bossActive && state.boss) {
        ctx.strokeStyle = "rgba(255, 95, 112, 0.95)";
        ctx.beginPath();
        ctx.arc(state.boss.x, state.boss.y, state.boss.collisionRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const proj of state.bossProjectiles) {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(8, 20, 42, 0.8)";
      ctx.fillRect(14, 14, 150, 28);
      ctx.fillStyle = "#ff8e4f";
      ctx.font = "14px Trebuchet MS";
      ctx.fillText("DEBUG HITBOXES: ON", 22, 33);

      ctx.restore();
    }

    function draw() {
      burnVfxSpriteCount = 0;
      ctx.clearRect(0, 0, WORLD.width, WORLD.height);

      for (const star of state.stars) {
        ctx.fillStyle = `rgba(183, 218, 255, ${Math.min(1, star.size / 2)})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }

      for (const hazard of state.edgeHazards) drawEdgeHazard(hazard);
      for (const obj of state.objects) drawObject(obj);

      ctx.fillStyle = "#ffda6b";
      for (const bullet of state.bullets) {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const missile of state.missiles) {
        drawMissile(missile);
      }

      for (const proj of state.bossProjectiles) {
        if (proj.damageType === "energy") ctx.fillStyle = "#74e8ff";
        else if (proj.damageType === "acid") ctx.fillStyle = "#79ff6f";
        else if (proj.damageType === "heat") ctx.fillStyle = "#ffb16a";
        else ctx.fillStyle = "#ff5f70";
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const pickup of state.pickups) {
        if (pickup.type !== "armor") continue;
        ctx.save();
        ctx.translate(pickup.x, pickup.y);
        ctx.fillStyle = "rgba(132, 188, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(0, 0, pickup.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(220, 242, 255, 0.95)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(4, 0);
        ctx.moveTo(0, -4);
        ctx.lineTo(0, 4);
        ctx.stroke();
        ctx.restore();
      }

      drawBoss();
      drawBossWarning();

      if (state.ship) {
        drawShip(state.ship);
      }

      ctx.strokeStyle = "#ff8e4f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(input.mouseX, input.mouseY, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(input.mouseX - 14, input.mouseY);
      ctx.lineTo(input.mouseX + 14, input.mouseY);
      ctx.moveTo(input.mouseX, input.mouseY - 14);
      ctx.lineTo(input.mouseX, input.mouseY + 14);
      ctx.stroke();

      if (state.ship) {
        ctx.strokeStyle = "rgba(255, 142, 79, 0.35)";
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.moveTo(state.ship.x, state.ship.y);
        ctx.lineTo(input.mouseX, input.mouseY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const p of state.particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      for (const beam of state.laserBeams) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, beam.life * 14));
        ctx.strokeStyle = "#8ef7ff";
        ctx.lineWidth = beam.width;
        ctx.beginPath();
        ctx.moveTo(beam.x1, beam.y1);
        ctx.lineTo(beam.x2, beam.y2);
        ctx.stroke();
        ctx.restore();
      }

      for (const burst of state.plasmaBursts) {
        const t = 1 - burst.life / (burst.maxLife || 1);
        const alpha = Math.max(0, Math.min(1, burst.life / (burst.maxLife || 1)));

        let core = "rgba(255, 245, 200, 0.95)";
        let mid = "rgba(255, 188, 96, 0.65)";
        if (t > 0.28 && t <= 0.6) {
          core = "rgba(255, 196, 108, 0.92)";
          mid = "rgba(255, 124, 62, 0.58)";
        } else if (t > 0.6 && t <= 0.82) {
          core = "rgba(242, 96, 46, 0.82)";
          mid = "rgba(148, 54, 28, 0.54)";
        } else if (t > 0.82) {
          core = "rgba(82, 52, 40, 0.7)";
          mid = "rgba(28, 24, 23, 0.52)";
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(burst.x, burst.y, Math.max(1, burst.radius * 0.25), burst.x, burst.y, burst.radius * 1.45);
        grad.addColorStop(0, core);
        grad.addColorStop(0.55, mid);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(burst.x, burst.y, burst.radius * 1.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const text of state.damageTexts) {
        const maxLife = text.maxLife || 0.6;
        const alpha = Math.max(0, Math.min(1, text.life / maxLife));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = text.crit ? "bold 24px Trebuchet MS" : "bold 15px Trebuchet MS";
        ctx.strokeStyle = "rgba(8, 16, 32, 0.9)";
        ctx.lineWidth = text.crit ? 4 : 3;
        ctx.strokeText(text.text, text.x, text.y);
        ctx.fillStyle = text.crit ? "#ffe08f" : "#f5f8ff";
        ctx.fillText(text.text, text.x, text.y);
        ctx.restore();
      }

      drawDebugOverlay();
      drawMobileCanvasHud();
    }

    return {
      draw,
    };
  }

  window.VoidRender = {
    createRenderer,
  };
})();
