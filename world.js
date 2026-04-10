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

    const activeChunks = new Map();

    function chunkKey(cx, cy) {
      return `${cx},${cy}`;
    }

    function chunkCoord(value) {
      return Math.floor(value / chunkSize);
    }

    function generateChunk(cx, cy) {
      const seed = mixSeed(cx, cy, worldSeed);
      const rand = createRng(seed);
      const originX = cx * chunkSize;
      const originY = cy * chunkSize;

      const background = [];

      if (rand() < 0.26) {
        const sun = chooseSunProfile(rand);
        background.push({
          type: "sun",
          drawOrder: 0,
          parallax: 0.05,
          x: originX + rand() * chunkSize,
          y: originY + rand() * chunkSize,
          radius: 72 + rand() * 120,
          coreColor: sun.core,
          glowColor: sun.glow,
          spectralClass: sun.cls,
        });
      }

      const deepStars = 22 + Math.floor(rand() * 18);
      for (let i = 0; i < deepStars; i += 1) {
        background.push({
          type: "star",
          layer: "deep",
          drawOrder: 1,
          parallax: 0.08,
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

      const hasPlanetarySystem = rand() < 0.16;
      if (hasPlanetarySystem) {
        const orbitDirection = rand() < 0.5 ? -1 : 1;
        const primaryPlanet = {
          type: "planet",
          drawOrder: 6,
          parallax: 0.7,
          collidablePlane: true,
          x: originX + rand() * chunkSize,
          y: originY + rand() * chunkSize,
          radius: 46 + rand() * 44,
          hue: Math.floor(rand() * 360),
        };
        background.push(primaryPlanet);

        const orbitalSpeedNear = 0.22 + rand() * 0.1;
        const referenceOrbitRadius = primaryPlanet.radius * 1.5;
        function orbitalAngularSpeed(orbitRadius, localScale = 1) {
          const safeRadius = Math.max(1, orbitRadius);
          const ratio = safeRadius / Math.max(1, referenceOrbitRadius);
          const angular = orbitalSpeedNear * Math.pow(ratio, -1.5) * localScale;
          return angular * orbitDirection;
        }

        let moonOrbitRadius = null;
        if (rand() < 0.78) {
          const moonRadius = Math.max(11, primaryPlanet.radius * (0.2 + rand() * 0.12));
          moonOrbitRadius = primaryPlanet.radius * (2.65 + rand() * 1.1);
          background.push({
            type: "planet",
            drawOrder: 6,
            parallax: primaryPlanet.parallax,
            collidablePlane: false,
            orbitCx: primaryPlanet.x,
            orbitCy: primaryPlanet.y,
            orbitRadius: moonOrbitRadius,
            orbitAngle: rand() * Math.PI * 2,
            orbitSpeed: orbitalAngularSpeed(moonOrbitRadius, 0.92 + rand() * 0.14),
            radius: moonRadius,
            hue: Math.floor(rand() * 360),
            isMoon: true,
          });
        }

        if (rand() < 0.72) {
          const stationCount = rand() < 0.22 ? 2 : 1;
          const stationOrbitBase = primaryPlanet.radius * (1.5 + rand() * 0.45);
          for (let i = 0; i < stationCount; i += 1) {
            const stationRadius = 11 + rand() * 8;
            const stationHitRadius = 9 + rand() * 6;
            const collidableStation = stationRadius >= 14;
            const stationOrbitRadius = stationOrbitBase + (rand() - 0.5) * primaryPlanet.radius * 0.25;
            background.push({
              type: "orbitalStation",
              drawOrder: 7,
              parallax: primaryPlanet.parallax,
              collidablePlane: collidableStation,
              orbitCx: primaryPlanet.x,
              orbitCy: primaryPlanet.y,
              orbitRadius: stationOrbitRadius,
              orbitAngle: rand() * Math.PI * 2,
              orbitSpeed: orbitalAngularSpeed(stationOrbitRadius, 0.95 + rand() * 0.12),
              radius: stationRadius,
              hitRadius: collidableStation ? stationHitRadius : 0,
            });
          }
        }

        if (rand() < 0.76) {
          const beltCount = 16 + Math.floor(rand() * 18);
          const outerBaseMultiplier = moonOrbitRadius ? (moonOrbitRadius / primaryPlanet.radius) + 0.9 : 3.8 + rand() * 0.7;
          const beltRadiusBase = primaryPlanet.radius * outerBaseMultiplier;
          for (let i = 0; i < beltCount; i += 1) {
            const beltJitter = (rand() - 0.5) * primaryPlanet.radius * 0.95;
            const orbitRadius = Math.max(primaryPlanet.radius * 2.4, beltRadiusBase + beltJitter);
            background.push({
              type: "beltRock",
              drawOrder: 6,
              parallax: primaryPlanet.parallax,
              orbitCx: primaryPlanet.x,
              orbitCy: primaryPlanet.y,
              orbitRadius,
              orbitAngle: (i / beltCount) * Math.PI * 2 + rand() * 0.25,
              orbitSpeed: orbitalAngularSpeed(orbitRadius, 0.9 + rand() * 0.12),
              radius: 2.4 + rand() * 4,
              alpha: 0.42 + rand() * 0.34,
            });
          }
        }
      } else if (rand() < 0.06) {
        background.push({
          type: "planet",
          drawOrder: 5,
          parallax: 0.3,
          collidablePlane: false,
          x: originX + rand() * chunkSize,
          y: originY + rand() * chunkSize,
          radius: 22 + rand() * 26,
          hue: Math.floor(rand() * 360),
        });
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

    function getCollidablePlanets() {
      const out = [];
      for (const chunk of activeChunks.values()) {
        for (const bg of chunk.background) {
          if (bg.type === "planet" && bg.collidablePlane) {
            out.push(bg);
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
          const angle = (bg.orbitAngle || 0) + atTime * (bg.orbitSpeed || 0);
          out.push({
            type: "orbitalStation",
            x: (bg.orbitCx || 0) + Math.cos(angle) * (bg.orbitRadius || 0),
            y: (bg.orbitCy || 0) + Math.sin(angle) * (bg.orbitRadius || 0),
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
