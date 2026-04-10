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

      if (rand() < 0.32) {
        const nearPlane = rand() < 0.35;
        const planet = {
          type: "planet",
          drawOrder: nearPlane ? 6 : 5,
          parallax: nearPlane ? 0.7 : 0.33,
          collidablePlane: nearPlane,
          x: originX + rand() * chunkSize,
          y: originY + rand() * chunkSize,
          radius: nearPlane ? 36 + rand() * 48 : 22 + rand() * 28,
          hue: Math.floor(rand() * 360),
        };
        background.push(planet);

        if (nearPlane && rand() < 0.58) {
          const stationCount = rand() < 0.35 ? 2 : 1;
          for (let i = 0; i < stationCount; i += 1) {
            background.push({
              type: "orbitalStation",
              drawOrder: 7,
              parallax: planet.parallax,
              collidablePlane: true,
              orbitCx: planet.x,
              orbitCy: planet.y,
              orbitRadius: planet.radius * (1.45 + rand() * 1.25),
              orbitAngle: rand() * Math.PI * 2,
              orbitSpeed: (0.08 + rand() * 0.18) * (rand() < 0.5 ? -1 : 1),
              radius: 10 + rand() * 7,
              hitRadius: 8 + rand() * 6,
            });
          }
        }

        if (nearPlane && rand() < 0.52) {
          const beltCount = 14 + Math.floor(rand() * 18);
          const beltRadiusBase = planet.radius * (1.8 + rand() * 1.1);
          for (let i = 0; i < beltCount; i += 1) {
            const beltJitter = (rand() - 0.5) * planet.radius * 0.8;
            background.push({
              type: "beltRock",
              drawOrder: 6,
              parallax: planet.parallax,
              orbitCx: planet.x,
              orbitCy: planet.y,
              orbitRadius: Math.max(planet.radius * 1.35, beltRadiusBase + beltJitter),
              orbitAngle: (i / beltCount) * Math.PI * 2 + rand() * 0.25,
              orbitSpeed: (0.12 + rand() * 0.22) * (rand() < 0.5 ? -1 : 1),
              radius: 2.5 + rand() * 4.2,
              alpha: 0.45 + rand() * 0.35,
            });
          }
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

    return {
      update,
      getBackgroundObjects,
      getCollidablePlanets,
      getOrbitalStations,
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
