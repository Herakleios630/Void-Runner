(function () {
  function createRenderer(deps) {
    const {
      ctx,
      state,
      input,
      WORLD,
      worldSystem,
      cameraSystem,
      encountersSystem,
      IS_COARSE_POINTER,
      selectedShipModel,
      getRocketCooldownLeft,
      getSprite,
    } = deps;

    const BURN_VFX_MAX_SPRITES = 80;
    let burnVfxSpriteCount = 0;
    let miniMapRefreshAt = 0;
    let miniMapPlanetPoints = [];
    let miniMapOrbitRings = [];
    let miniMapBeltRings = [];
    let miniMapToxicZones = [];
    const visualTuning = (window.VoidTuning && window.VoidTuning.VISUAL) || {};
    const STAR_VISIBILITY = Number.isFinite(visualTuning.starVisibility)
      ? Math.max(0.45, Math.min(2.5, visualTuning.starVisibility))
      : 1;
    const NEBULA_DENSITY = Number.isFinite(visualTuning.nebulaDensity)
      ? Math.max(0.5, Math.min(2.2, visualTuning.nebulaDensity))
      : 1;
    const nebulaDitherPattern = createNebulaDitherPattern();

    function resolveBgWorldPosition(obj, atTime) {
      if (worldSystem && typeof worldSystem.resolveOrbitPosition === "function") {
        return worldSystem.resolveOrbitPosition(obj, atTime);
      }
      if (Number.isFinite(obj.orbitCx) && Number.isFinite(obj.orbitCy) && Number.isFinite(obj.orbitRadius)) {
        const angle = (obj.orbitAngle || 0) + atTime * (obj.orbitSpeed || 0);
        return {
          x: (obj.orbitCx || 0) + Math.cos(angle) * (obj.orbitRadius || 0),
          y: (obj.orbitCy || 0) + Math.sin(angle) * (obj.orbitRadius || 0),
        };
      }
      return {
        x: obj.x,
        y: obj.y,
      };
    }

    function resolveLocalOrbitCenter(obj, atTime) {
      const ORBIT_SPEED_SCALE = 0.5; // must match world.js resolveOrbitPosition
      if (Number.isFinite(obj.parentOrbitCx) && Number.isFinite(obj.parentOrbitCy)) {
        if (Number.isFinite(obj.parentOrbitRadius)) {
          const parentAngle = (obj.parentOrbitAngle || 0) + atTime * (obj.parentOrbitSpeed || 0) * ORBIT_SPEED_SCALE;
          return {
            x: obj.parentOrbitCx + Math.cos(parentAngle) * obj.parentOrbitRadius,
            y: obj.parentOrbitCy + Math.sin(parentAngle) * obj.parentOrbitRadius,
          };
        }
        return {
          x: obj.parentOrbitCx,
          y: obj.parentOrbitCy,
        };
      }
      return {
        x: Number.isFinite(obj.orbitCx) ? obj.orbitCx : 0,
        y: Number.isFinite(obj.orbitCy) ? obj.orbitCy : 0,
      };
    }

    function stableUnitFrom2(x, y, salt = 0) {
      const v = Math.sin((x || 0) * 12.9898 + (y || 0) * 78.233 + salt * 37.719) * 43758.5453;
      return v - Math.floor(v);
    }

    // Simple layered noise for organic nebula texturing
    function perlinishNoise(x, y, scale) {
      let sum = 0;
      let amp = 1;
      let freq = 1;
      for (let i = 0; i < 3; i++) {
        sum += amp * stableUnitFrom2(Math.floor(x * freq) / scale, Math.floor(y * freq) / scale);
        amp *= 0.5;
        freq *= 2;
      }
      return Math.min(1, Math.max(0, sum / 1.75));
    }

    function createNebulaDitherPattern() {
      if (typeof document === "undefined") return null;
      const tile = document.createElement("canvas");
      tile.width = 64;
      tile.height = 64;
      const tctx = tile.getContext("2d");
      if (!tctx) return null;

      for (let y = 0; y < tile.height; y += 1) {
        for (let x = 0; x < tile.width; x += 1) {
          const n = stableUnitFrom2(x * 0.31, y * 0.47, 13.7);
          if (n < 0.55) continue;
          const a = (n - 0.55) * 0.12;
          tctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(4)})`;
          tctx.fillRect(x, y, 1, 1);
        }
      }

      return ctx.createPattern(tile, "repeat");
    }

    function drawParallaxBackground() {
      if (!worldSystem || !cameraSystem) {
        for (const star of state.stars) {
          ctx.fillStyle = `rgba(183, 218, 255, ${Math.min(1, star.size / 2)})`;
          ctx.fillRect(star.x, star.y, star.size, star.size);
        }
        return;
      }

      const bgObjects = worldSystem.getBackgroundObjects();
      if (!bgObjects || bgObjects.length === 0) return;

      const farStarCap = IS_COARSE_POINTER ? 220 : 360;
      const deepStarCap = IS_COARSE_POINTER ? 220 : 360;
      const midStarCap = IS_COARSE_POINTER ? 140 : 240;
      const nearStarCap = IS_COARSE_POINTER ? 90 : 160;
      const beltRockCap = IS_COARSE_POINTER ? 420 : 760;
      const beltDustCap = IS_COARSE_POINTER ? 900 : 1600;
      const beltBoulderCap = IS_COARSE_POINTER ? 90 : 170;
      let farStarCount = 0;
      let deepStarCount = 0;
      let midStarCount = 0;
      let nearStarCount = 0;
      let beltRockCount = 0;
      let beltDustCount = 0;
      let beltBoulderCount = 0;

      for (const obj of bgObjects) {
        const resolved = resolveBgWorldPosition(obj, state.time);
        const worldX = resolved.x;
        const worldY = resolved.y;

        const pos = cameraSystem.worldToScreen(worldX, worldY, obj.parallax, WORLD.width, WORLD.height);
        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue;

        if (obj.type === "star") {
          if (obj.layer === "far") {
            farStarCount += 1;
            if (farStarCount > farStarCap) continue;
          }
          if (obj.layer === "deep") {
            deepStarCount += 1;
            if (deepStarCount > deepStarCap) continue;
          }
          if (obj.layer === "mid") {
            midStarCount += 1;
            if (midStarCount > midStarCap) continue;
          }
          if (obj.layer === "near") {
            nearStarCount += 1;
            if (nearStarCount > nearStarCap) continue;
          }
          if (pos.x < -6 || pos.x > WORLD.width + 6 || pos.y < -6 || pos.y > WORLD.height + 6) continue;

          // Per-star unique seeds for deterministic variation
          const starSeed = stableUnitFrom2(worldX, worldY, obj.size || 1);
          const colorSeed = stableUnitFrom2(worldX * 1.7, worldY * 1.7, obj.size || 1);
          const brightSeed = stableUnitFrom2(worldX * 0.3, worldY * 0.3, obj.size || 1);

          // Enhanced twinkle with per-star variance
          const twinkelRate = 0.45 + colorSeed * 1.35;
          const twinkelPhase = state.time * twinkelRate + starSeed * Math.PI * 2;
          const twinkelAmplitude = 0.15 + starSeed * 0.22;
          const twinkle = (1 - twinkelAmplitude) + twinkelAmplitude * (0.5 + 0.5 * Math.sin(twinkelPhase));

          // Layer-dependent size and alpha falloff
          let size = 0.8;
          let baseAlpha = 0.4;
          if (obj.layer === "far") {
            size = 0.5 + starSeed * 0.4;
            baseAlpha = 0.25;
          } else if (obj.layer === "deep") {
            size = 0.6 + starSeed * 0.55;
            baseAlpha = 0.35;
          } else if (obj.layer === "mid") {
            size = 0.8 + starSeed * 0.7;
            baseAlpha = 0.5;
          } else if (obj.layer === "near") {
            size = 1.1 + starSeed * 0.9;
            baseAlpha = 0.65;
          }
          const layerAlphaFloor = (obj.layer === "far" ? 0.08 : obj.layer === "deep" ? 0.1 : 0.12) * STAR_VISIBILITY;
          const starAlpha = Math.min(
            1,
            Math.max(layerAlphaFloor, (obj.alpha !== undefined ? obj.alpha : baseAlpha) * twinkle * STAR_VISIBILITY)
          );

          // Enhanced color temperature: red/yellow (hot) to blue/white (cool)
          let r, g, b;
          if (colorSeed < 0.25) {
            // Red/orange stars (hot)
            r = 255;
            g = 140 + Math.floor(colorSeed * 80);
            b = 80 + Math.floor(brightSeed * 60);
          } else if (colorSeed < 0.55) {
            // Yellow/white stars (very hot)
            r = 255;
            g = 220 + Math.floor((colorSeed - 0.25) * 120);
            b = 150 + Math.floor(brightSeed * 100);
          } else if (colorSeed < 0.80) {
            // Cool white stars
            r = 200 + Math.floor((colorSeed - 0.55) * 160);
            g = 220 + Math.floor((colorSeed - 0.55) * 80);
            b = 250 + Math.floor(brightSeed * 5);
          } else {
            // Blue stars (hottest)
            r = 150 + Math.floor((colorSeed - 0.8) * 100);
            g = 200 + Math.floor((colorSeed - 0.8) * 100);
            b = 255;
          }

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${starAlpha})`;
          if (size < 1.05) {
            // Snap tiny stars to a full pixel so they remain visible on bright/hi-DPI displays.
            const px = Math.round(pos.x);
            const py = Math.round(pos.y);
            ctx.fillRect(px, py, 1, 1);
          } else {
            ctx.fillRect(pos.x - size * 0.5, pos.y - size * 0.5, size, size);
          }

          // Optional: subtle glow for brighter stars
          if (brightSeed > 0.7 && baseAlpha > 0.4) {
            const glowAlpha = starAlpha * 0.3 * (brightSeed - 0.7);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${glowAlpha})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size * 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
          continue;
        }

        if (obj.type === "sun") {
          const sunRadius = obj.radius || 0;
          if (pos.x < -sunRadius * 2.1 || pos.x > WORLD.width + sunRadius * 2.1 || pos.y < -sunRadius * 2.1 || pos.y > WORLD.height + sunRadius * 2.1) {
            continue;
          }
          const core = obj.coreColor || "rgba(255, 224, 164, 0.95)";
          const glow = obj.glowColor || "rgba(255, 178, 102, 0.32)";

          const halo = ctx.createRadialGradient(pos.x, pos.y, sunRadius * 0.1, pos.x, pos.y, sunRadius * 2.3);
          halo.addColorStop(0, core);
          halo.addColorStop(0.38, glow);
          halo.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, sunRadius * 2.3, 0, Math.PI * 2);
          ctx.fill();

          const disk = ctx.createRadialGradient(pos.x - sunRadius * 0.22, pos.y - sunRadius * 0.2, sunRadius * 0.08, pos.x, pos.y, sunRadius);
          disk.addColorStop(0, "rgba(255, 252, 238, 0.96)");
          disk.addColorStop(0.55, core);
          disk.addColorStop(1, glow);
          ctx.fillStyle = disk;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, sunRadius, 0, Math.PI * 2);
          ctx.fill();

          continue;
        }

        const radius = obj.radius || 0;
        if (radius > 0 && (pos.x < -radius * 1.2 || pos.x > WORLD.width + radius * 1.2 || pos.y < -radius * 1.2 || pos.y > WORLD.height + radius * 1.2)) {
          continue;
        }

        if (obj.type === "nebula") {
          const nebulaSeed = stableUnitFrom2(worldX, worldY, radius || 1);
          const colorSeed = stableUnitFrom2(worldX * 1.3, worldY * 1.3, radius || 1);
          const nebulaDepth = Math.max(0, Math.min(1, ((obj.parallax || 0.22) - 0.14) / 0.16));

          // Enhanced nebula color palettes (blue, pink, cyan, purple)
          let colorA, colorB, wispColor;
          if (colorSeed < 0.33) {
            // Blue nebula
            colorA = obj.colorA || `rgba(100, 160, 255, ${0.16 + nebulaDepth * 0.18})`;
            colorB = obj.colorB || `rgba(30, 50, 120, ${0.03 + nebulaDepth * 0.05})`;
            wispColor = `rgba(180, 210, 255, ${0.06 + nebulaDepth * 0.08})`;
          } else if (colorSeed < 0.66) {
            // Pink/magenta nebula
            colorA = `rgba(255, 120, 200, ${0.14 + nebulaDepth * 0.18})`;
            colorB = `rgba(100, 30, 80, ${0.025 + nebulaDepth * 0.045})`;
            wispColor = `rgba(255, 170, 220, ${0.055 + nebulaDepth * 0.075})`;
          } else {
            // Cyan/purple nebula
            colorA = `rgba(100, 220, 255, ${0.15 + nebulaDepth * 0.17})`;
            colorB = `rgba(40, 80, 140, ${0.03 + nebulaDepth * 0.05})`;
            wispColor = `rgba(150, 240, 255, ${0.065 + nebulaDepth * 0.085})`;
          }

          // Multi-layer gradient for depth
          const radiusScale = (1.15 + nebulaDepth * 0.25) * (0.9 + NEBULA_DENSITY * 0.12);
          const grad = ctx.createRadialGradient(pos.x, pos.y, radius * 0.05, pos.x, pos.y, radius * radiusScale);
          grad.addColorStop(0, colorA);
          grad.addColorStop(0.5, colorB);
          grad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius * radiusScale, 0, Math.PI * 2);
          ctx.fill();

          // Dither overlay helps reduce visible color banding on smooth gradients.
          if (nebulaDitherPattern) {
            const ditherRadius = radius * radiusScale;
            const ditherOffsetX = ((worldX * 0.037) % 64 + 64) % 64;
            const ditherOffsetY = ((worldY * 0.041) % 64 + 64) % 64;
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, ditherRadius * 0.98, 0, Math.PI * 2);
            ctx.clip();
            ctx.translate(ditherOffsetX, ditherOffsetY);
            ctx.globalAlpha = (0.018 + nebulaDepth * 0.016) * (0.85 + NEBULA_DENSITY * 0.15);
            ctx.fillStyle = nebulaDitherPattern;
            ctx.fillRect(
              pos.x - ditherRadius * 1.2,
              pos.y - ditherRadius * 1.2,
              ditherRadius * 2.4,
              ditherRadius * 2.4
            );
            ctx.restore();
          }

          // Layered wisps with organic motion
          const drift = state.time * (0.01 + nebulaSeed * 0.008);
          const wispLayers = Math.max(2, Math.min(8, Math.round((3 + Math.floor(nebulaSeed * 2)) * NEBULA_DENSITY)));
          for (let layer = 0; layer < wispLayers; layer += 1) {
            const layerSpeed = drift * (1 + layer * 0.4);
            const layerAmp = 1 - layer / wispLayers;
            const wispCountLayer = Math.max(2, Math.min(9, Math.round((2 + layer) * (0.85 + NEBULA_DENSITY * 0.2))));

            for (let i = 0; i < wispCountLayer; i += 1) {
              const baseSeed = stableUnitFrom2(worldX + i * 21.7, worldY + layer * 37.1, radius + layer * 3.3);
              const noiseFactor = stableUnitFrom2(worldX - i * 34.9, worldY + layer * 19.7, radius + 11.5);
              const ang = nebulaSeed * Math.PI * 2
                + i * (Math.PI * 2 / wispCountLayer)
                + layerSpeed * (0.4 + baseSeed * 0.5);

              const wispX = pos.x + Math.cos(ang) * radius * (0.2 + noiseFactor * 0.25 + layer * 0.12);
              const wispY = pos.y + Math.sin(ang * 1.3) * radius * (0.15 + noiseFactor * 0.18 + layer * 0.08);
              const wispScale = radius * (0.15 + noiseFactor * 0.12 + layer * 0.06);

              ctx.save();
              ctx.translate(wispX, wispY);
              ctx.rotate(ang + noiseFactor * Math.PI * 0.5);
              ctx.globalAlpha = (0.08 + noiseFactor * 0.08 + nebulaDepth * 0.08)
                * (0.8 + NEBULA_DENSITY * 0.2)
                * layerAmp
                * (1 - layer / wispLayers * 0.5);
              ctx.fillStyle = wispColor;
              ctx.beginPath();
              ctx.ellipse(0, 0, wispScale * (0.8 + noiseFactor * 0.4), wispScale * (0.3 + noiseFactor * 0.2), 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }
          ctx.globalAlpha = 1;
          continue;
        }

        if (obj.type === "toxicNebulaZone") {
          const toxicSeed = stableUnitFrom2(worldX, worldY, radius || 1);
          const baseA = obj.colorA || "rgba(124, 248, 145, 0.22)";
          const baseB = obj.colorB || "rgba(38, 122, 61, 0.1)";
          const toxicGrad = ctx.createRadialGradient(
            pos.x,
            pos.y,
            radius * 0.16,
            pos.x,
            pos.y,
            radius * 1.32
          );
          toxicGrad.addColorStop(0, baseA);
          toxicGrad.addColorStop(0.62, baseB);
          toxicGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

          ctx.fillStyle = toxicGrad;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius * 1.32, 0, Math.PI * 2);
          ctx.fill();

          const pulse = 0.72 + 0.28 * Math.sin(state.time * (1.2 + toxicSeed * 1.1));
          ctx.strokeStyle = `rgba(128, 255, 152, ${(0.16 + pulse * 0.18).toFixed(3)})`;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius * (0.94 + pulse * 0.04), 0, Math.PI * 2);
          ctx.stroke();

          continue;
        }

        if (obj.type === "galaxy") {
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.rotate(obj.rotation || 0);
          ctx.fillStyle = obj.tint || "rgba(218,198,255,0.2)";
          ctx.beginPath();
          ctx.ellipse(0, 0, radius, radius * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "rgba(244, 234, 255, 0.5)";
          ctx.beginPath();
          ctx.ellipse(0, 0, radius * 0.3, radius * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        if (obj.type === "planet") {
          const hue = obj.hue || 210;
          const isGasGiant = Boolean(obj.isGasGiant);
          const effectiveParallax = obj.isMoon ? 0.62 : (obj.parallax || 0.33);
          const depth = Math.max(0, Math.min(1, (effectiveParallax - 0.33) / 0.37));
          const solidPlanet = Boolean(obj.collidablePlane);
          const bodyAlpha = solidPlanet ? 1 : (obj.isMoon ? 0.78 : 0.62);
          const atmThickness = radius * (0.04 + depth * 0.12);
          const atmAlpha = (0.16 + depth * 0.34) * (solidPlanet ? 1 : 0.58);

          // Enhanced Atmosphere with multiple layers for atmospheric scattering
          const atmosphere = ctx.createRadialGradient(pos.x, pos.y, Math.max(0, radius - atmThickness), pos.x, pos.y, radius + atmThickness * 2.2);
          atmosphere.addColorStop(0, `hsla(${hue}, 78%, 70%, 0)`);
          atmosphere.addColorStop(0.45, `hsla(${hue}, 82%, 74%, ${atmAlpha * 0.7})`);
          atmosphere.addColorStop(0.75, `hsla(${hue}, 88%, 80%, ${atmAlpha * 0.4})`);
          atmosphere.addColorStop(1, `hsla(${hue}, 92%, 85%, 0)`);
          ctx.fillStyle = atmosphere;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius + atmThickness * 2.2, 0, Math.PI * 2);
          ctx.fill();

          // Secondary atmosphere layer (ozone haze) for depth
          if (depth > 0.3) {
            const secondaryAtm = ctx.createRadialGradient(pos.x, pos.y, radius * 0.95, pos.x, pos.y, radius + atmThickness * 3);
            const secondaryHue = (hue + 180) % 360;
            secondaryAtm.addColorStop(0, `hsla(${secondaryHue}, 60%, 60%, 0)`);
            secondaryAtm.addColorStop(0.5, `hsla(${secondaryHue}, 70%, 68%, ${atmAlpha * 0.2})`);
            secondaryAtm.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.fillStyle = secondaryAtm;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius + atmThickness * 3, 0, Math.PI * 2);
            ctx.fill();
          }

          const grad = ctx.createRadialGradient(pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.1, pos.x, pos.y, radius);
          if (isGasGiant) {
            grad.addColorStop(0, `hsla(${hue}, 78%, 70%, ${0.92 * bodyAlpha})`);
            grad.addColorStop(0.55, `hsla(${hue}, 56%, 46%, ${0.85 * bodyAlpha})`);
            grad.addColorStop(1, `hsla(${hue}, 42%, 28%, ${0.78 * bodyAlpha})`);
          } else {
            grad.addColorStop(0, `hsla(${hue}, 80%, 72%, ${0.95 * bodyAlpha})`);
            grad.addColorStop(0.55, `hsla(${hue}, 58%, 44%, ${0.88 * bodyAlpha})`);
            grad.addColorStop(1, `hsla(${hue}, 45%, 24%, ${0.78 * bodyAlpha})`);
          }
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.fill();

          const lightCenter = resolveLocalOrbitCenter(obj, state.time);
          const lightPos = cameraSystem.worldToScreen(lightCenter.x, lightCenter.y, obj.parallax, WORLD.width, WORLD.height);
          const lightAngle = Math.atan2((lightPos.y || pos.y) - pos.y, (lightPos.x || pos.x) - pos.x);
          const lx = Math.cos(lightAngle);
          const ly = Math.sin(lightAngle);

          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.clip();

          const terminator = ctx.createLinearGradient(
            pos.x - lx * radius,
            pos.y - ly * radius,
            pos.x + lx * radius,
            pos.y + ly * radius
          );
          terminator.addColorStop(0, `rgba(6, 10, 20, ${0.34 * bodyAlpha})`);
          terminator.addColorStop(0.52, "rgba(8, 12, 24, 0)");
          terminator.addColorStop(1, "rgba(255, 248, 236, 0.06)");
          ctx.fillStyle = terminator;
          ctx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);

          if (!isGasGiant) {
            const seedX = Number.isFinite(obj.orbitCx)
              ? obj.orbitCx
              : (Number.isFinite(obj.parentOrbitCx) ? obj.parentOrbitCx : worldX);
            const seedY = Number.isFinite(obj.orbitCy)
              ? obj.orbitCy
              : (Number.isFinite(obj.parentOrbitCy) ? obj.parentOrbitCy : worldY);
            const planetSeed = stableUnitFrom2(seedX, seedY, (radius || 1) + (obj.hue || 0));
            
            // Surface details: spread craters across sectors to avoid visual clustering.
            const craterCount = 5 + Math.floor(planetSeed * 5);
            for (let i = 0; i < craterCount; i += 1) {
              const angleSeed = stableUnitFrom2(seedX + i * 31.7, seedY - i * 19.9, radius + 3.1);
              const radialSeed = stableUnitFrom2(seedX - i * 23.4, seedY + i * 29.6, radius + 7.3);
              const sizeSeed = stableUnitFrom2(seedX + i * 13.9, seedY + i * 9.7, radius + 11.1);
              const sector = (i + 0.5) / craterCount;
              const ang = (sector + (angleSeed - 0.5) * 0.32) * Math.PI * 2;
              const radial = 0.14 + Math.sqrt(radialSeed) * 0.52;
              const craterR = radius * (0.09 + sizeSeed * 0.2);
              const cx = pos.x + Math.cos(ang) * radius * radial;
              const cy = pos.y + Math.sin(ang) * radius * radial * 0.92;
              
              // Crater shadow
              ctx.fillStyle = `hsla(${hue}, 45%, 18%, ${0.18 * bodyAlpha})`;
              ctx.beginPath();
              ctx.ellipse(cx, cy, craterR * 0.9, craterR * 0.6, ang * 0.5, 0, Math.PI * 2);
              ctx.fill();
              
              // Crater rim highlight
              ctx.strokeStyle = `hsla(${hue}, 55%, 52%, ${0.12 * bodyAlpha})`;
              ctx.lineWidth = Math.max(1, craterR * 0.15);
              ctx.beginPath();
              ctx.ellipse(cx - craterR * 0.2, cy - craterR * 0.12, craterR * 0.85, craterR * 0.55, ang * 0.5, 0, Math.PI * 2);
              ctx.stroke();
            }

            // Regional variation patches
            const patchCount = 4;
            for (let i = 0; i < patchCount; i += 1) {
              const angleSeed = stableUnitFrom2(seedX + i * 41.1, seedY - i * 27.3, radius + 5.7);
              const radialSeed = stableUnitFrom2(seedX - i * 15.8, seedY + i * 33.2, radius + 2.9);
              const sizeSeed = stableUnitFrom2(seedX + i * 21.4, seedY + i * 17.6, radius + 8.2);
              const sector = (i + 0.35) / patchCount;
              const ang = (sector + (angleSeed - 0.5) * 0.22) * Math.PI * 2;
              const radial = 0.18 + Math.sqrt(radialSeed) * 0.34;
              const px = pos.x + Math.cos(ang) * radius * radial;
              const py = pos.y + Math.sin(ang) * radius * radial * 0.9;
              ctx.fillStyle = `hsla(${hue + 14}, 58%, 36%, ${0.14 * bodyAlpha})`;
              ctx.beginPath();
              ctx.ellipse(
                px,
                py,
                radius * (0.09 + sizeSeed * 0.07),
                radius * (0.05 + sizeSeed * 0.04),
                ang * 0.4,
                0,
                Math.PI * 2
              );
              ctx.fill();
            }

            // Subtle terrain lanes add a second-frequency detail layer without heavy per-frame cost.
            const laneCount = 5 + Math.floor(planetSeed * 3);
            for (let i = 0; i < laneCount; i += 1) {
              const laneSeed = stableUnitFrom2(seedX + i * 53.3, seedY - i * 47.1, radius + 19.7);
              const laneAngle = laneSeed * Math.PI * 2;
              const laneDist = radius * (0.08 + laneSeed * 0.52);
              const laneX = pos.x + Math.cos(laneAngle) * laneDist;
              const laneY = pos.y + Math.sin(laneAngle) * laneDist * 0.9;
              const laneW = radius * (0.18 + laneSeed * 0.16);
              const laneH = radius * (0.045 + laneSeed * 0.03);

              ctx.fillStyle = `hsla(${hue - 8}, 46%, 30%, ${0.07 * bodyAlpha})`;
              ctx.beginPath();
              ctx.ellipse(laneX, laneY, laneW, laneH, laneAngle * 0.55, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          ctx.restore();

          if (isGasGiant) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.clip();

            // Enhanced banded structure with storms and rotation
            const gasSeed = stableUnitFrom2(worldX * 0.7, worldY * 0.7, radius * 0.5);
            const rotationPhase = state.time * (0.015 + gasSeed * 0.005);
            const bands = 10;
            for (let i = 0; i < bands; i += 1) {
              const t = i / (bands - 1);
              const yOff = (t - 0.5) * radius * 1.8 + Math.sin(rotationPhase + t * Math.PI * 4) * radius * 0.08;
              const bandH = radius * (0.09 + (i % 2 === 0 ? 0.02 : 0.05));
              const bandHue = hue + (i % 3) * 12 - 8;
              const bandLightness = 42 + (i % 3) * 10;
              const alpha = (0.08 + (i % 2 === 0 ? 0.08 : 0.04)) * bodyAlpha;
              ctx.fillStyle = `hsla(${bandHue}, 72%, ${bandLightness}%, ${alpha})`;
              ctx.fillRect(pos.x - radius * 1.1, pos.y + yOff - bandH * 0.5, radius * 2.2, bandH);
              
              // Band striations (texture)
              if (i % 2 === 1) {
                const stripeCount = 5;
                for (let s = 0; s < stripeCount; s++) {
                  const sx = pos.x - radius * 1.05 + (s / stripeCount) * radius * 2.1;
                  ctx.strokeStyle = `hsla(${bandHue + 4}, 80%, 55%, ${0.06 * bodyAlpha})`;
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(sx, pos.y + yOff - bandH * 0.5);
                  ctx.lineTo(sx + 12, pos.y + yOff + bandH * 0.5);
                  ctx.stroke();
                }
              }
            }

            // Great Red Spot-like storm feature (rare)
            if (gasSeed < 0.3) {
              const stormSize = radius * (0.08 + gasSeed * 0.12);
              const stormX = pos.x + Math.cos(rotationPhase * 0.5) * radius * 0.25;
              const stormY = pos.y + Math.sin(rotationPhase * 0.5 + 0.8) * radius * 0.35;
              ctx.fillStyle = `hsla(${hue + 8}, 65%, 35%, ${0.22 * bodyAlpha})`;
              ctx.beginPath();
              ctx.ellipse(stormX, stormY, stormSize, stormSize * 0.6, rotationPhase * 0.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = `hsla(${hue + 12}, 55%, 48%, ${0.14 * bodyAlpha})`;
              ctx.lineWidth = Math.max(1, stormSize * 0.12);
              ctx.stroke();
            }

            ctx.restore();
            ctx.strokeStyle = `hsla(${hue}, 85%, 80%, ${0.35 * bodyAlpha})`;
            ctx.lineWidth = Math.max(1, radius * 0.04);
            ctx.beginPath();
            ctx.ellipse(pos.x, pos.y, radius * 1.22, radius * 0.26, 0.2, 0.1, Math.PI * 1.88);
            ctx.stroke();
          }

          if (solidPlanet) {
            ctx.strokeStyle = "rgba(255, 212, 128, 0.72)";
            ctx.lineWidth = 2 + depth * 2;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius * 1.05, 0.15, Math.PI * 1.85);
            ctx.stroke();

            ctx.strokeStyle = "rgba(255, 120, 96, 0.48)";
            ctx.lineWidth = 1.2 + depth * 0.8;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius * 1.13, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeStyle = `hsla(${hue}, 70%, 82%, ${0.08 + depth * 0.1})`;
            ctx.lineWidth = 0.9 + depth * 0.9;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius * 1.02, 0, Math.PI * 2);
            ctx.stroke();
          }
          continue;
        }

        if (obj.type === "beltRock") {
          beltRockCount += 1;
          if (beltRockCount > beltRockCap) continue;
          ctx.fillStyle = `rgba(169, 188, 209, ${obj.alpha || 0.55})`;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        if (obj.type === "beltDust") {
          beltDustCount += 1;
          if (beltDustCount > beltDustCap) continue;
          const dustRadius = Math.max(0.6, radius || 1);
          ctx.fillStyle = `rgba(205, 224, 240, ${obj.alpha || 0.2})`;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, dustRadius, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        if (obj.type === "beltBoulder") {
          beltBoulderCount += 1;
          if (beltBoulderCount > beltBoulderCap) continue;

          const rr = Math.max(2.4, radius || 4.2);
          const spin = Number.isFinite(obj.spin) ? obj.spin : 0;
          const phase = Number.isFinite(obj.rotPhase) ? obj.rotPhase : 0;
          const rot = phase + state.time * spin;
          const alpha = Number.isFinite(obj.alpha) ? obj.alpha : 0.62;

          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.rotate(rot);
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          for (let i = 0; i < 7; i += 1) {
            const t = (i / 7) * Math.PI * 2;
            const profile = 0.76 + Math.sin(i * 2.11 + phase * 0.7) * 0.16;
            const px = Math.cos(t) * rr * profile;
            const py = Math.sin(t) * rr * profile;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = "#8f9caf";
          ctx.fill();
          ctx.strokeStyle = "rgba(218, 230, 244, 0.3)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (obj.type === "orbitalStation") {
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.rotate(state.time * 0.3 + (obj.orbitAngle || 0));

          ctx.strokeStyle = "rgba(214, 236, 255, 0.82)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.86, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = "rgba(84, 134, 188, 0.92)";
          ctx.fillRect(-radius * 0.62, -radius * 0.26, radius * 1.24, radius * 0.52);
          ctx.fillStyle = "rgba(174, 212, 247, 0.95)";
          ctx.fillRect(-radius * 0.24, -radius * 0.84, radius * 0.48, radius * 1.68);

          ctx.fillStyle = "rgba(236, 248, 255, 0.95)";
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.26, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }
    }

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

        if (state.shield.thorns) {
          const spikeCount = 12;
          const baseR = ship.radius + 10;
          const pulse = 1 + Math.sin(state.time * 8) * 0.06;
          ctx.fillStyle = "rgba(158, 242, 255, 0.62)";
          ctx.strokeStyle = "rgba(219, 250, 255, 0.82)";
          ctx.lineWidth = 1.1;
          for (let i = 0; i < spikeCount; i += 1) {
            const a = (i / spikeCount) * Math.PI * 2 + state.time * 0.45;
            const innerA = a - 0.09;
            const outerA = a + 0.09;
            const tipR = baseR * 1.38 * pulse;
            const sideR = baseR * 1.1;

            ctx.beginPath();
            ctx.moveTo(Math.cos(innerA) * sideR, Math.sin(innerA) * sideR);
            ctx.lineTo(Math.cos(a) * tipR, Math.sin(a) * tipR);
            ctx.lineTo(Math.cos(outerA) * sideR, Math.sin(outerA) * sideR);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
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

      const chunks = typeof worldSystem.getActiveChunkRects === "function" ? worldSystem.getActiveChunkRects() : [];
      if (chunks.length > 0) {
        ctx.strokeStyle = "rgba(132, 230, 255, 0.7)";
        ctx.lineWidth = 1;
        for (const chunk of chunks) {
          const topLeft = cameraSystem.worldToScreen(chunk.x, chunk.y, 1, WORLD.width, WORLD.height);
          const bottomRight = cameraSystem.worldToScreen(chunk.x + chunk.size, chunk.y + chunk.size, 1, WORLD.width, WORLD.height);
          const width = bottomRight.x - topLeft.x;
          const height = bottomRight.y - topLeft.y;
          if (width <= 0 || height <= 0) continue;
          if (topLeft.x > WORLD.width + 2 || topLeft.y > WORLD.height + 2 || bottomRight.x < -2 || bottomRight.y < -2) continue;
          ctx.strokeRect(topLeft.x, topLeft.y, width, height);
        }

        // Color-coded chunk zone/event labels for interstellar debugging.
        const chunkEventMap = typeof encountersSystem !== "undefined" && typeof encountersSystem.getChunkEventMap === "function"
          ? encountersSystem.getChunkEventMap() : null;
        if (chunkEventMap) {
          const ZONE_COLORS = {
            system:       "rgba(100, 210, 255, 0.72)",
            edge:         "rgba(200, 180, 100, 0.72)",
            interstellar: "rgba(140, 140, 160, 0.72)",
            ambush:       "rgba(255,  72,  72, 0.92)",
            drift:        "rgba( 80, 200, 255, 0.92)",
            trail:        "rgba(255, 200,  80, 0.92)",
          };
          const ZONE_LABEL = {
            system: "SYS", edge: "EDGE", interstellar: "VOID",
            ambush: "AMBUSH", drift: "DRIFT-FELD", trail: "SCHROTTSPUR",
          };
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (const chunk of chunks) {
            const cx = Math.floor(chunk.x / chunk.size);
            const cy = Math.floor(chunk.y / chunk.size);
            const eventKey = `${cx},${cy}`;
            const zone = chunkEventMap.get(eventKey);
            if (!zone) continue;
            const topLeft = cameraSystem.worldToScreen(chunk.x, chunk.y, 1, WORLD.width, WORLD.height);
            const bottomRight = cameraSystem.worldToScreen(chunk.x + chunk.size, chunk.y + chunk.size, 1, WORLD.width, WORLD.height);
            const midX = (topLeft.x + bottomRight.x) * 0.5;
            const midY = (topLeft.y + bottomRight.y) * 0.5;
            if (midX < -20 || midX > WORLD.width + 20 || midY < -20 || midY > WORLD.height + 20) continue;
            const color = ZONE_COLORS[zone] || "rgba(255, 255, 255, 0.6)";
            const label = ZONE_LABEL[zone] || zone.toUpperCase();
            // Tinted fill band
            ctx.fillStyle = color.replace("0.72", "0.08").replace("0.92", "0.12");
            ctx.fillRect(topLeft.x + 1, topLeft.y + 1, bottomRight.x - topLeft.x - 2, bottomRight.y - topLeft.y - 2);
            // Label text with shadow
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillText(label, midX + 1, midY + 1);
            ctx.fillStyle = color;
            ctx.fillText(label, midX, midY);
          }
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }
      }

      const bgObjects = typeof worldSystem.getBackgroundObjects === "function" ? worldSystem.getBackgroundObjects() : [];
      if (bgObjects.length > 0) {
        const orbitKeys = new Set();
        ctx.strokeStyle = "rgba(42, 86, 148, 0.62)";
        ctx.lineWidth = 1;
        for (const obj of bgObjects) {
          const importantOrbit = obj.type === "planet" || obj.type === "orbitalStation";
          if (!importantOrbit) continue;

          if (Number.isFinite(obj.parentOrbitRadius) && Number.isFinite(obj.parentOrbitCx) && Number.isFinite(obj.parentOrbitCy)) {
            const parentKey = `p:${obj.parentOrbitCx.toFixed(1)}:${obj.parentOrbitCy.toFixed(1)}:${obj.parentOrbitRadius.toFixed(1)}`;
            if (!orbitKeys.has(parentKey)) {
              orbitKeys.add(parentKey);
              const orbitParallax = obj.parallax || 1;
              const c = cameraSystem.worldToScreen(obj.parentOrbitCx, obj.parentOrbitCy, orbitParallax, WORLD.width, WORLD.height);
              ctx.beginPath();
              ctx.arc(c.x, c.y, obj.parentOrbitRadius * orbitParallax, 0, Math.PI * 2);
              ctx.stroke();
            }
          }

          if (Number.isFinite(obj.orbitRadius)) {
            const center = resolveLocalOrbitCenter(obj, state.time);
            const key = `o:${center.x.toFixed(1)}:${center.y.toFixed(1)}:${obj.orbitRadius.toFixed(1)}`;
            if (!orbitKeys.has(key)) {
              orbitKeys.add(key);
              const orbitParallax = obj.parallax || 1;
              const c = cameraSystem.worldToScreen(center.x, center.y, orbitParallax, WORLD.width, WORLD.height);
              ctx.beginPath();
              ctx.arc(c.x, c.y, obj.orbitRadius * orbitParallax, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
      }

      ctx.strokeStyle = "rgba(255, 78, 94, 0.6)";
      ctx.lineWidth = 1;
      for (const obj of state.objects) {
        if (!obj.enemy || !(obj.aggroRange > 0)) continue;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.aggroRange, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255, 180, 106, 0.95)";
      for (const obj of state.objects) {
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.collisionRadius, 0, Math.PI * 2);
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

    function refreshMiniMapCache() {
      if (!state.ship || state.time < miniMapRefreshAt) return;
      miniMapRefreshAt = state.time + 0.24;

      const bgObjects = typeof worldSystem.getBackgroundObjects === "function" ? worldSystem.getBackgroundObjects() : [];
      const toxicZones = typeof worldSystem.getToxicNebulaZones === "function" ? worldSystem.getToxicNebulaZones() : [];
      const planetPoints = [];
      const orbitRings = new Map();
      const beltRings = new Map();

      for (const obj of bgObjects) {
        if (obj.type === "planet") {
          if (!obj.collidablePlane) continue;
          const pos = resolveBgWorldPosition(obj, state.time);
          planetPoints.push({
            x: pos.x,
            y: pos.y,
            isMoon: Boolean(obj.isMoon),
          });

          if (Number.isFinite(obj.orbitRadius)) {
            const center = resolveLocalOrbitCenter(obj, state.time);
            const key = `o:${Math.round(center.x / 16)}:${Math.round(center.y / 16)}:${Math.round(obj.orbitRadius / 8)}`;
            if (!orbitRings.has(key)) {
              orbitRings.set(key, {
                x: center.x,
                y: center.y,
                radius: obj.orbitRadius,
              });
            }
          }
          continue;
        }

        if (obj.type === "orbitalStation") {
          if (!obj.collidablePlane || !Number.isFinite(obj.orbitRadius)) continue;
          const center = resolveLocalOrbitCenter(obj, state.time);
          const key = `s:${Math.round(center.x / 16)}:${Math.round(center.y / 16)}:${Math.round(obj.orbitRadius / 8)}`;
          if (!orbitRings.has(key)) {
            orbitRings.set(key, {
              x: center.x,
              y: center.y,
              radius: obj.orbitRadius,
            });
          }
          continue;
        }

        if ((obj.type !== "beltRock" && obj.type !== "beltDust" && obj.type !== "beltBoulder") || !Number.isFinite(obj.orbitRadius)) continue;
        if ((obj.parallax || 1) < 0.95) continue;

        let centerX = Number.isFinite(obj.orbitCx) ? obj.orbitCx : obj.x;
        let centerY = Number.isFinite(obj.orbitCy) ? obj.orbitCy : obj.y;
        if (Number.isFinite(obj.parentOrbitCx) && Number.isFinite(obj.parentOrbitCy)) {
          const parentCenter = resolveLocalOrbitCenter(obj, state.time);
          centerX = parentCenter.x;
          centerY = parentCenter.y;
        }

        const key = `${Math.round(centerX / 16)}:${Math.round(centerY / 16)}:${Math.round(obj.orbitRadius / 8)}`;
        if (!beltRings.has(key)) {
          beltRings.set(key, {
            x: centerX,
            y: centerY,
            radius: obj.orbitRadius,
          });
        }
      }

      miniMapPlanetPoints = planetPoints.slice(0, 240);
      miniMapOrbitRings = Array.from(orbitRings.values()).slice(0, 80);
      miniMapBeltRings = Array.from(beltRings.values()).slice(0, 40);
      miniMapToxicZones = toxicZones.slice(0, 36);
    }

    function drawMiniMap() {
      if (!state.running || !state.ship) return;

      refreshMiniMapCache();

      const chunkSpan = 6;
      const worldSpan = Math.max((worldSystem.chunkSize || 960) * chunkSpan, 4200);
      const halfSpan = worldSpan * 0.5;
      const centerX = state.ship.worldX || 0;
      const centerY = state.ship.worldY || 0;

      const mapSize = Math.max(140, Math.min(220, Math.floor(Math.min(WORLD.width, WORLD.height) * 0.29)));
      const padding = 14;
      const mapX = WORLD.width - mapSize - padding;
      const mapY = padding;
      const scannerJam = Math.max(0, Math.min(0.85, (state.ship && state.ship.scannerJam) || 0));

      function project(wx, wy) {
        const nx = (wx - (centerX - halfSpan)) / worldSpan;
        const ny = (wy - (centerY - halfSpan)) / worldSpan;
        return {
          x: mapX + nx * mapSize,
          y: mapY + ny * mapSize,
          visible: nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1,
        };
      }

      ctx.save();
      ctx.fillStyle = "rgba(7, 14, 26, 0.78)";
      ctx.fillRect(mapX, mapY, mapSize, mapSize);

      ctx.strokeStyle = "rgba(122, 170, 215, 0.72)";
      ctx.lineWidth = 1;
      ctx.strokeRect(mapX + 0.5, mapY + 0.5, mapSize - 1, mapSize - 1);

      ctx.strokeStyle = "rgba(122, 170, 215, 0.2)";
      ctx.beginPath();
      ctx.moveTo(mapX + mapSize * 0.5, mapY);
      ctx.lineTo(mapX + mapSize * 0.5, mapY + mapSize);
      ctx.moveTo(mapX, mapY + mapSize * 0.5);
      ctx.lineTo(mapX + mapSize, mapY + mapSize * 0.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.rect(mapX + 1, mapY + 1, mapSize - 2, mapSize - 2);
      ctx.clip();

      if (scannerJam > 0.06) {
        for (const zone of miniMapToxicZones) {
          const zp = project(zone.x, zone.y);
          const r = ((zone.hazardRadius || 120) / worldSpan) * mapSize;
          if (r < 2 || r > mapSize * 1.4) continue;
          ctx.fillStyle = `rgba(76, 198, 104, ${(0.08 + scannerJam * 0.16).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(zp.x, zp.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = "rgba(142, 188, 236, 0.48)";
      ctx.lineWidth = 1;
      const orbitRingBudget = Math.max(10, Math.floor(miniMapOrbitRings.length * (1 - scannerJam * 0.7)));
      for (let i = 0; i < orbitRingBudget; i += 1) {
        const ring = miniMapOrbitRings[i];
        const center = project(ring.x, ring.y);
        const radiusPx = (ring.radius / worldSpan) * mapSize;
        if (radiusPx < 2 || radiusPx > mapSize * 1.2) continue;
        if (center.x + radiusPx < mapX || center.x - radiusPx > mapX + mapSize || center.y + radiusPx < mapY || center.y - radiusPx > mapY + mapSize) {
          continue;
        }
        ctx.beginPath();
        ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(132, 170, 214, 0.35)";
      ctx.lineWidth = 1;
      const beltRingBudget = Math.max(4, Math.floor(miniMapBeltRings.length * (1 - scannerJam * 0.78)));
      for (let i = 0; i < beltRingBudget; i += 1) {
        const ring = miniMapBeltRings[i];
        const center = project(ring.x, ring.y);
        const radiusPx = (ring.radius / worldSpan) * mapSize;
        if (radiusPx < 2 || radiusPx > mapSize * 1.2) continue;
        if (center.x + radiusPx < mapX || center.x - radiusPx > mapX + mapSize || center.y + radiusPx < mapY || center.y - radiusPx > mapY + mapSize) {
          continue;
        }
        ctx.beginPath();
        ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
        ctx.stroke();
      }

      const planetBudget = Math.max(12, Math.floor(miniMapPlanetPoints.length * (1 - scannerJam * 0.84)));
      for (let i = 0; i < planetBudget; i += 1) {
        const planet = miniMapPlanetPoints[i];
        const p = project(planet.x, planet.y);
        if (!p.visible) continue;
        const r = planet.isMoon ? 1.5 : 2.2;
        ctx.fillStyle = planet.isMoon ? "rgba(140, 175, 215, 0.82)" : "rgba(214, 232, 255, 0.96)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (scannerJam > 0.06) {
        ctx.fillStyle = `rgba(15, 42, 24, ${(0.1 + scannerJam * 0.28).toFixed(3)})`;
        ctx.fillRect(mapX + 1, mapY + 1, mapSize - 2, mapSize - 2);
      }

      ctx.fillStyle = "rgba(255, 164, 108, 0.98)";
      ctx.beginPath();
      ctx.arc(mapX + mapSize * 0.5, mapY + mapSize * 0.5, 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.fillStyle = "rgba(210, 231, 255, 0.9)";
      ctx.font = "11px Trebuchet MS";
      ctx.fillText("MAP", mapX + 7, mapY + 13);
      ctx.fillText(`${chunkSpan} chunks`, mapX + mapSize - 60, mapY + 13);
      if (scannerJam > 0.25) {
        ctx.fillStyle = "rgba(170, 244, 170, 0.9)";
        ctx.fillText("SCANNER JAM", mapX + 42, mapY + mapSize - 8);
      }
    }

    function draw() {
      burnVfxSpriteCount = 0;
      ctx.clearRect(0, 0, WORLD.width, WORLD.height);

      drawParallaxBackground();

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
        const r = pickup.radius;
        const bob = Math.sin((state.time * 4) + pickup.x * 0.02) * 1.2;
        ctx.translate(0, bob);

        // Knight-shield silhouette.
        ctx.fillStyle = "rgba(98, 142, 198, 0.98)";
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.05);
        ctx.bezierCurveTo(-r * 0.86, -r * 0.9, -r * 0.95, -r * 0.2, -r * 0.74, r * 0.46);
        ctx.bezierCurveTo(-r * 0.52, r * 1.02, -r * 0.16, r * 1.28, 0, r * 1.45);
        ctx.bezierCurveTo(r * 0.16, r * 1.28, r * 0.52, r * 1.02, r * 0.74, r * 0.46);
        ctx.bezierCurveTo(r * 0.95, -r * 0.2, r * 0.86, -r * 0.9, 0, -r * 1.05);
        ctx.closePath();
        ctx.fill();

        const grad = ctx.createLinearGradient(0, -r * 1.05, 0, r * 1.45);
        grad.addColorStop(0, "rgba(210, 232, 255, 0.72)");
        grad.addColorStop(0.5, "rgba(142, 186, 235, 0.34)");
        grad.addColorStop(1, "rgba(58, 92, 142, 0.24)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.9);
        ctx.bezierCurveTo(-r * 0.7, -r * 0.78, -r * 0.75, -r * 0.18, -r * 0.58, r * 0.36);
        ctx.bezierCurveTo(-r * 0.41, r * 0.82, -r * 0.12, r * 1.02, 0, r * 1.14);
        ctx.bezierCurveTo(r * 0.12, r * 1.02, r * 0.41, r * 0.82, r * 0.58, r * 0.36);
        ctx.bezierCurveTo(r * 0.75, -r * 0.18, r * 0.7, -r * 0.78, 0, -r * 0.9);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(232, 246, 255, 0.95)";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.strokeStyle = "rgba(238, 250, 255, 0.9)";
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.68);
        ctx.lineTo(0, r * 0.9);
        ctx.moveTo(-r * 0.34, -r * 0.04);
        ctx.lineTo(r * 0.34, -r * 0.04);
        ctx.stroke();

        ctx.fillStyle = "rgba(240, 250, 255, 0.5)";
        ctx.beginPath();
        ctx.ellipse(-r * 0.22, -r * 0.38, r * 0.16, r * 0.09, -0.42, 0, Math.PI * 2);
        ctx.fill();
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
        if (p.kind === "alienGoo") {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "alienShard") {
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((state.time * 7 + p.size) % (Math.PI * 2));
          ctx.fillRect(-p.size * 0.5, -p.size * 0.2, p.size, p.size * 0.4);
          ctx.restore();
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        }
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
        const isEnemyAcid = burst.enemyOwned && burst.damageType === "acid";

        if (isEnemyAcid) {
          core = "rgba(202, 255, 170, 0.96)";
          mid = "rgba(86, 232, 95, 0.64)";
          if (t > 0.52) {
            core = "rgba(126, 235, 110, 0.88)";
            mid = "rgba(46, 146, 62, 0.52)";
          }
          if (t > 0.82) {
            core = "rgba(62, 118, 56, 0.72)";
            mid = "rgba(24, 52, 24, 0.5)";
          }
        } else if (t > 0.28 && t <= 0.6) {
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

      drawMiniMap();
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
