(function () {
  function hashInt(value) {
    let x = value | 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    return x >>> 0;
  }

  function mixSeed(cx, cy, worldSeed) {
    const a = hashInt(cx * 374761393);
    const b = hashInt(cy * 668265263);
    const c = hashInt(worldSeed * 122949829);
    return hashInt(a ^ b ^ c);
  }

  function createRng(seed) {
    let s = seed >>> 0;
    return function next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function chooseSunProfile(rand) {
    const roll = rand();
    // Rough stellar distribution and color impression (OBAFGKM classes).
    if (roll < 0.0002) {
      return { cls: "O", core: "rgba(165, 205, 255, 0.96)", glow: "rgba(120, 170, 255, 0.45)" };
    }
    if (roll < 0.003) {
      return { cls: "B", core: "rgba(196, 224, 255, 0.96)", glow: "rgba(148, 192, 255, 0.42)" };
    }
    if (roll < 0.016) {
      return { cls: "A", core: "rgba(236, 244, 255, 0.96)", glow: "rgba(198, 218, 248, 0.38)" };
    }
    if (roll < 0.046) {
      return { cls: "F", core: "rgba(253, 244, 224, 0.95)", glow: "rgba(240, 220, 170, 0.36)" };
    }
    if (roll < 0.122) {
      return { cls: "G", core: "rgba(255, 233, 168, 0.95)", glow: "rgba(255, 196, 128, 0.34)" };
    }
    if (roll < 0.242) {
      return { cls: "K", core: "rgba(255, 204, 142, 0.95)", glow: "rgba(248, 158, 102, 0.33)" };
    }
    return { cls: "M", core: "rgba(255, 173, 138, 0.95)", glow: "rgba(228, 122, 96, 0.32)" };
  }

  function createWorldSystem(options = {}) {
    const chunkSize = typeof options.chunkSize === "number" ? options.chunkSize : 960;
    let worldSeed = typeof options.worldSeed === "number" ? options.worldSeed : 94321;
    const activeRadius = typeof options.activeRadius === "number" ? options.activeRadius : 2;
    const unloadRadius = typeof options.unloadRadius === "number" ? options.unloadRadius : activeRadius + 1;
    const systemGridSize = 4;

    const activeChunks = new Map();

    function chunkKey(cx, cy) {
      return `${cx},${cy}`;
    }

    function chunkCoord(value) {
      return Math.floor(value / chunkSize);
    }

    function systemCellCoord(chunkCoordValue) {
      return Math.floor(chunkCoordValue / systemGridSize);
    }

    function resolveOrbitPosition(obj, atTime = 0) {
      const hasParent = Number.isFinite(obj.parentOrbitCx) && Number.isFinite(obj.parentOrbitCy);
      let centerX = Number.isFinite(obj.orbitCx) ? obj.orbitCx : (Number.isFinite(obj.x) ? obj.x : 0);
      let centerY = Number.isFinite(obj.orbitCy) ? obj.orbitCy : (Number.isFinite(obj.y) ? obj.y : 0);

      if (hasParent) {
        const parentHasRadius = Number.isFinite(obj.parentOrbitRadius);
        if (parentHasRadius) {
          const parentAngle = (obj.parentOrbitAngle || 0) + atTime * (obj.parentOrbitSpeed || 0);
          centerX = obj.parentOrbitCx + Math.cos(parentAngle) * obj.parentOrbitRadius;
          centerY = obj.parentOrbitCy + Math.sin(parentAngle) * obj.parentOrbitRadius;
        } else {
          centerX = obj.parentOrbitCx;
          centerY = obj.parentOrbitCy;
        }
      }

      if (Number.isFinite(obj.orbitRadius)) {
        const angle = (obj.orbitAngle || 0) + atTime * (obj.orbitSpeed || 0);
        return {
          x: centerX + Math.cos(angle) * obj.orbitRadius,
          y: centerY + Math.sin(angle) * obj.orbitRadius,
        };
      }

      return {
        x: centerX,
        y: centerY,
      };
    }

    function generateChunk(cx, cy) {
      const seed = mixSeed(cx, cy, worldSeed);
      const rand = createRng(seed);
      const originX = cx * chunkSize;
      const originY = cy * chunkSize;

      const background = [];

      const farStars = 18 + Math.floor(rand() * 16);
      for (let i = 0; i < farStars; i += 1) {
        background.push({
          type: "star",
          layer: "far",
          drawOrder: 1,
          parallax: 0.035,
          x: originX + rand() * chunkSize,
          y: originY + rand() * chunkSize,
          size: 0.7 + rand() * 1.2,
          alpha: 0.22 + rand() * 0.3,
        });
      }

      const deepStars = 22 + Math.floor(rand() * 18);
      for (let i = 0; i < deepStars; i += 1) {
        background.push({
          type: "star",
          layer: "deep",
          drawOrder: 2,
          parallax: 0.075,
          x: originX + rand() * chunkSize,
          y: originY + rand() * chunkSize,
          size: 0.8 + rand() * 1.7,
          alpha: 0.3 + rand() * 0.45,
        });
      }

      const midStars = 10 + Math.floor(rand() * 10);
      for (let i = 0; i < midStars; i += 1) {
        background.push({
          type: "star",
          layer: "mid",
          drawOrder: 2,
          parallax: 0.16,
          x: originX + rand() * chunkSize,
          y: originY + rand() * chunkSize,
          size: 1.2 + rand() * 2.2,
          alpha: 0.42 + rand() * 0.5,
        });
      }

      const nearStars = 7 + Math.floor(rand() * 7);
      for (let i = 0; i < nearStars; i += 1) {
        background.push({
          type: "star",
          layer: "near",
          drawOrder: 3,
          parallax: 0.24,
          x: originX + rand() * chunkSize,
          y: originY + rand() * chunkSize,
          size: 1.4 + rand() * 2.2,
          alpha: 0.35 + rand() * 0.42,
        });
      }

      const nebulaCount = rand() < 0.7 ? 1 : 2;
      for (let i = 0; i < nebulaCount; i += 1) {
        const palette = rand() < 0.5
          ? ["rgba(96,162,255,0.24)", "rgba(56,86,168,0.12)"]
          : ["rgba(194,104,255,0.2)", "rgba(78,40,132,0.12)"];
        background.push({
          type: "nebula",
          drawOrder: 3,
          parallax: 0.22,
          x: originX + rand() * chunkSize,
          y: originY + rand() * chunkSize,
          radius: 160 + rand() * 210,
          colorA: palette[0],
          colorB: palette[1],
        });
      }

      if (rand() < 0.2) {
        background.push({
          type: "galaxy",
          drawOrder: 4,
          parallax: 0.12,
          x: originX + rand() * chunkSize,
          y: originY + rand() * chunkSize,
          radius: 120 + rand() * 170,
          rotation: rand() * Math.PI * 2,
          tint: rand() < 0.5 ? "rgba(218,198,255,0.24)" : "rgba(255,210,168,0.22)",
        });
      }

      const systemCellX = systemCellCoord(cx);
      const systemCellY = systemCellCoord(cy);
      const systemSeed = mixSeed(systemCellX, systemCellY, worldSeed ^ 0x51e9a3d7);
      const systemRand = createRng(systemSeed);
      const hasSystemInCell = systemRand() < 0.5;
      const anchorCx = systemCellX * systemGridSize + Math.floor(systemRand() * systemGridSize);
      const anchorCy = systemCellY * systemGridSize + Math.floor(systemRand() * systemGridSize);
      const hasPlanetarySystem = hasSystemInCell && cx === anchorCx && cy === anchorCy;

      if (hasPlanetarySystem) {
        const sunProfile = chooseSunProfile(systemRand);
        const sun = {
          type: "sun",
          drawOrder: 0,
          parallax: 0.05,
          x: originX + (0.2 + rand() * 0.6) * chunkSize,
          y: originY + (0.2 + rand() * 0.6) * chunkSize,
          radius: 88 + rand() * 110,
          coreColor: sunProfile.core,
          glowColor: sunProfile.glow,
          spectralClass: sunProfile.cls,
        };
        background.push(sun);

        const orbitDirection = rand() < 0.5 ? -1 : 1;
        const orbitalSpeedNearSun = 0.095 + rand() * 0.05;
        const referenceSunOrbit = Math.max(120, sun.radius * 2.2);
        function sunOrbitAngularSpeed(orbitRadius, localScale = 1) {
          const safeRadius = Math.max(1, orbitRadius);
          const ratio = safeRadius / referenceSunOrbit;
          return orbitalSpeedNearSun * Math.pow(ratio, -1.5) * localScale * orbitDirection;
        }

        function addPlanetSubOrbits(planet) {
          const satelliteBase = 0.22 + rand() * 0.1;
          const satelliteRef = Math.max(18, planet.radius * 1.6);
          function satelliteSpeed(orbitRadius, scale = 1) {
            const safeRadius = Math.max(1, orbitRadius);
            const ratio = safeRadius / satelliteRef;
            return satelliteBase * Math.pow(ratio, -1.5) * scale * orbitDirection;
          }

          if (rand() < 0.72) {
            const moonCount = rand() < 0.24 ? 2 : 1;
            for (let i = 0; i < moonCount; i += 1) {
              const moonOrbitRadius = planet.radius * (2.4 + i * 0.85 + rand() * 0.9);
              background.push({
                type: "planet",
                drawOrder: 6,
                parallax: planet.parallax,
                collidablePlane: false,
                parentOrbitCx: Number.isFinite(planet.orbitCx) ? planet.orbitCx : planet.x,
                parentOrbitCy: Number.isFinite(planet.orbitCy) ? planet.orbitCy : planet.y,
                parentOrbitRadius: Number.isFinite(planet.orbitRadius) ? planet.orbitRadius : 0,
                parentOrbitAngle: Number.isFinite(planet.orbitAngle) ? planet.orbitAngle : 0,
                parentOrbitSpeed: Number.isFinite(planet.orbitSpeed) ? planet.orbitSpeed : 0,
                orbitRadius: moonOrbitRadius,
                orbitAngle: rand() * Math.PI * 2,
                orbitSpeed: satelliteSpeed(moonOrbitRadius, 0.86 + rand() * 0.2),
                radius: Math.max(8, planet.radius * (0.18 + rand() * 0.14)),
                hue: Math.floor(rand() * 360),
                isMoon: true,
              });
            }
          }

          if (rand() < 0.66) {
            const stationCount = rand() < 0.22 ? 2 : 1;
            const stationOrbitBase = planet.radius * (1.45 + rand() * 0.5);
            for (let i = 0; i < stationCount; i += 1) {
              const stationRadius = 11 + rand() * 8;
              const stationHitRadius = 9 + rand() * 6;
              const collidableStation = stationRadius >= 14;
              const stationOrbitRadius = stationOrbitBase + (rand() - 0.5) * planet.radius * 0.35;
              background.push({
                type: "orbitalStation",
                drawOrder: 7,
                parallax: planet.parallax,
                collidablePlane: collidableStation,
                parentOrbitCx: Number.isFinite(planet.orbitCx) ? planet.orbitCx : planet.x,
                parentOrbitCy: Number.isFinite(planet.orbitCy) ? planet.orbitCy : planet.y,
                parentOrbitRadius: Number.isFinite(planet.orbitRadius) ? planet.orbitRadius : 0,
                parentOrbitAngle: Number.isFinite(planet.orbitAngle) ? planet.orbitAngle : 0,
                parentOrbitSpeed: Number.isFinite(planet.orbitSpeed) ? planet.orbitSpeed : 0,
                orbitRadius: stationOrbitRadius,
                orbitAngle: rand() * Math.PI * 2,
                orbitSpeed: satelliteSpeed(stationOrbitRadius, 0.92 + rand() * 0.14),
                radius: stationRadius,
                hitRadius: collidableStation ? stationHitRadius : 0,
              });
            }
          }

          if (rand() < 0.54) {
            const beltCount = 14 + Math.floor(rand() * 16);
            const beltRadiusBase = planet.radius * (3.2 + rand() * 1.3);
            for (let i = 0; i < beltCount; i += 1) {
              const jitter = (rand() - 0.5) * planet.radius * 0.95;
              const orbitRadius = Math.max(planet.radius * 2.2, beltRadiusBase + jitter);
              background.push({
                type: "beltRock",
                drawOrder: 6,
                parallax: planet.parallax,
                parentOrbitCx: Number.isFinite(planet.orbitCx) ? planet.orbitCx : planet.x,
                parentOrbitCy: Number.isFinite(planet.orbitCy) ? planet.orbitCy : planet.y,
                parentOrbitRadius: Number.isFinite(planet.orbitRadius) ? planet.orbitRadius : 0,
                parentOrbitAngle: Number.isFinite(planet.orbitAngle) ? planet.orbitAngle : 0,
                parentOrbitSpeed: Number.isFinite(planet.orbitSpeed) ? planet.orbitSpeed : 0,
                orbitRadius,
                orbitAngle: (i / beltCount) * Math.PI * 2 + rand() * 0.2,
                orbitSpeed: satelliteSpeed(orbitRadius, 0.86 + rand() * 0.16),
                radius: 2.4 + rand() * 4,
                alpha: 0.42 + rand() * 0.34,
              });
            }
          }
        }

        const orbitSlotCount = 3 + Math.floor(rand() * 2);
        const shellBase = sun.radius * (2.2 + rand() * 0.25);
        const shellSpacing = sun.radius * (1.15 + rand() * 0.22);
        for (let slot = 0; slot < orbitSlotCount; slot += 1) {
          const orbitRadius = shellBase + slot * shellSpacing + (rand() - 0.5) * sun.radius * 0.12;
          const slotAngle = rand() * Math.PI * 2;
          const beltInsteadOfPlanet = slot > 0 && rand() < (slot >= 2 ? 0.38 : 0.26);

          if (beltInsteadOfPlanet) {
            const beltCount = 18 + Math.floor(rand() * 18);
            for (let i = 0; i < beltCount; i += 1) {
              const jitter = (rand() - 0.5) * sun.radius * 0.36;
              const localOrbit = Math.max(sun.radius * 1.9, orbitRadius + jitter);
              background.push({
                type: "beltRock",
                drawOrder: 5,
                parallax: 0.5,
                orbitCx: sun.x,
                orbitCy: sun.y,
                orbitRadius: localOrbit,
                orbitAngle: slotAngle + (i / beltCount) * Math.PI * 2,
                orbitSpeed: sunOrbitAngularSpeed(localOrbit, 0.9 + rand() * 0.16),
                radius: 2.6 + rand() * 4.4,
                alpha: 0.4 + rand() * 0.3,
              });
            }
            continue;
          }

          const nearPlanePlanet = slot <= 1 || rand() < 0.24;
          const shellScale = 1 - slot / Math.max(1, orbitSlotCount + 1);
          const planet = {
            type: "planet",
            drawOrder: nearPlanePlanet ? 6 : 5,
            parallax: nearPlanePlanet ? 0.66 : 0.38,
            collidablePlane: nearPlanePlanet && rand() < 0.65,
            orbitCx: sun.x,
            orbitCy: sun.y,
            orbitRadius,
            orbitAngle: slotAngle,
            orbitSpeed: sunOrbitAngularSpeed(orbitRadius, nearPlanePlanet ? 1 : 0.92 + rand() * 0.14),
            radius: (nearPlanePlanet ? 20 + rand() * 18 : 10 + rand() * 13) * (0.8 + shellScale * 0.35),
            hue: Math.floor(rand() * 360),
          };
          planet.x = planet.orbitCx + Math.cos(planet.orbitAngle) * planet.orbitRadius;
          planet.y = planet.orbitCy + Math.sin(planet.orbitAngle) * planet.orbitRadius;
          background.push(planet);
          addPlanetSubOrbits(planet);
        }
      }

      background.sort((a, b) => a.drawOrder - b.drawOrder);
      return {
        cx,
        cy,
        key: chunkKey(cx, cy),
        background,
      };
    }

    function ensureChunk(cx, cy) {
      const key = chunkKey(cx, cy);
      if (!activeChunks.has(key)) {
        activeChunks.set(key, generateChunk(cx, cy));
      }
    }

    function update(cameraX, cameraY) {
      const centerCx = chunkCoord(cameraX);
      const centerCy = chunkCoord(cameraY);

      for (let y = centerCy - activeRadius; y <= centerCy + activeRadius; y += 1) {
        for (let x = centerCx - activeRadius; x <= centerCx + activeRadius; x += 1) {
          ensureChunk(x, y);
        }
      }

      for (const [key, chunk] of activeChunks.entries()) {
        const dx = Math.abs(chunk.cx - centerCx);
        const dy = Math.abs(chunk.cy - centerCy);
        if (dx > unloadRadius || dy > unloadRadius) {
          activeChunks.delete(key);
        }
      }
    }

    function getBackgroundObjects() {
      const out = [];
      for (const chunk of activeChunks.values()) {
        out.push(...chunk.background);
      }
      return out;
    }

    function getCollidablePlanets(atTime = 0) {
      const out = [];
      for (const chunk of activeChunks.values()) {
        for (const bg of chunk.background) {
          if (bg.type === "planet" && bg.collidablePlane) {
            const pos = resolveOrbitPosition(bg, atTime);
            out.push({
              ...bg,
              x: pos.x,
              y: pos.y,
            });
          }
        }
      }
      return out;
    }

    function getOrbitalStations(atTime = 0) {
      const out = [];
      for (const chunk of activeChunks.values()) {
        for (const bg of chunk.background) {
          if (bg.type !== "orbitalStation" || !bg.collidablePlane) continue;
          const pos = resolveOrbitPosition(bg, atTime);
          out.push({
            type: "orbitalStation",
            x: pos.x,
            y: pos.y,
            parallax: bg.parallax || 1,
            radius: bg.radius || 12,
            hitRadius: bg.hitRadius || bg.radius || 12,
          });
        }
      }
      return out;
    }

    function setSeed(nextSeed) {
      const numeric = Number.parseInt(nextSeed, 10);
      if (!Number.isFinite(numeric)) return false;
      worldSeed = Math.abs(Math.floor(numeric)) || 1;
      activeChunks.clear();
      return true;
    }

    function getSeed() {
      return worldSeed;
    }

    function getDebugInfo() {
      return {
        activeChunkCount: activeChunks.size,
        chunkSize,
        worldSeed,
      };
    }

    function getActiveChunkRects() {
      const out = [];
      for (const chunk of activeChunks.values()) {
        out.push({
          cx: chunk.cx,
          cy: chunk.cy,
          x: chunk.cx * chunkSize,
          y: chunk.cy * chunkSize,
          size: chunkSize,
        });
      }
      return out;
    }

    return {
      update,
      getBackgroundObjects,
      getCollidablePlanets,
      getOrbitalStations,
      resolveOrbitPosition,
      getActiveChunkRects,
      getDebugInfo,
      setSeed,
      getSeed,
      chunkSize,
    };
  }

  window.VoidWorld = {
    createWorldSystem,
  };
})();
