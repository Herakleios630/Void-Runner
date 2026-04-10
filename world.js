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
    const orbitUnit = typeof options.orbitUnit === "number" ? options.orbitUnit : 240;
    const maxOrbitShells = 10;
    const systemCellChunks = 13;
    const SYSTEM_PARALLAX = 1;
    const visualTuning = (window.VoidTuning && window.VoidTuning.VISUAL) || {};
    const STAR_VISIBILITY = Number.isFinite(visualTuning.starVisibility)
      ? Math.max(0.45, Math.min(2.5, visualTuning.starVisibility))
      : 1;
    const NEBULA_DENSITY = Number.isFinite(visualTuning.nebulaDensity)
      ? Math.max(0.5, Math.min(2.2, visualTuning.nebulaDensity))
      : 1;
    const TOXIC_NEBULA_CHANCE = 0.34;
    const WORMHOLE_CHANCE = 0.2;
    const MAX_WORMHOLE_JUMP_CELLS = 12;
    const COMET_CELL_CHUNKS = 18;
    const COMET_CELL_CHANCE = 0.5;

    const activeChunks = new Map();
    const wormholeOutgoingCache = new Map();

    function chunkKey(cx, cy) {
      return `${cx},${cy}`;
    }

    function chunkCoord(value) {
      return Math.floor(value / chunkSize);
    }

    function systemPresenceChanceForCell(cellX, cellY) {
      const cellDistance = Math.hypot(cellX, cellY);
      if (cellDistance < 3) return 0.95;
      if (cellDistance < 7) return 0.82;
      if (cellDistance < 12) return 0.68;
      return 0.56;
    }

    function cellHasGameplaySystem(cellX, cellY) {
      const chance = systemPresenceChanceForCell(cellX, cellY);
      const seed = mixSeed(cellX, cellY, worldSeed ^ 0x1e35b11f);
      const rand = createRng(seed);
      return rand() < chance;
    }

    function getSystemAnchorForCell(cellX, cellY) {
      if (!cellHasGameplaySystem(cellX, cellY)) return null;
      const seed = mixSeed(cellX, cellY, worldSeed ^ 0x5f74a1c3);
      const rand = createRng(seed);
      const anchorCx = cellX * systemCellChunks + Math.floor(systemCellChunks * 0.5);
      const anchorCy = cellY * systemCellChunks + Math.floor(systemCellChunks * 0.5);
      return {
        cx: anchorCx,
        cy: anchorCy,
        x: anchorCx * chunkSize + chunkSize * (0.5 + (rand() - 0.5) * 0.36),
        y: anchorCy * chunkSize + chunkSize * (0.5 + (rand() - 0.5) * 0.36),
        priority: rand(),
      };
    }

    function getSunCandidateForChunk(cx, cy) {
      const cellX = Math.floor(cx / systemCellChunks);
      const cellY = Math.floor(cy / systemCellChunks);
      const anchor = getSystemAnchorForCell(cellX, cellY);
      if (!anchor) return null;
      if (cx !== anchor.cx || cy !== anchor.cy) return null;
      return {
        x: anchor.x,
        y: anchor.y,
        priority: anchor.priority,
      };
    }

    function makeWormholePairId(aX, aY, bX, bY) {
      if (aX < bX || (aX === bX && aY <= bY)) {
        return `${aX},${aY}<->${bX},${bY}`;
      }
      return `${bX},${bY}<->${aX},${aY}`;
    }

    function computeOutgoingWormholeLinkForCell(cellX, cellY) {
      const sourceAnchor = getSystemAnchorForCell(cellX, cellY);
      if (!sourceAnchor) return null;

      const seed = mixSeed(cellX, cellY, worldSeed ^ 0x739ac521);
      const rand = createRng(seed);
      if (rand() >= WORMHOLE_CHANCE) return null;

      let targetCellX = cellX;
      let targetCellY = cellY;
      let targetAnchor = null;

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const jumpCells = 3 + Math.floor(rand() * 10);
        const angle = rand() * Math.PI * 2;
        const tx = cellX + Math.round(Math.cos(angle) * jumpCells);
        const ty = cellY + Math.round(Math.sin(angle) * jumpCells);
        if (tx === cellX && ty === cellY) continue;

        const candidate = getSystemAnchorForCell(tx, ty);
        if (!candidate) continue;

        targetCellX = tx;
        targetCellY = ty;
        targetAnchor = candidate;
        break;
      }

      if (!targetAnchor) return null;

      const sourcePortalSeed = mixSeed(cellX, cellY, worldSeed ^ 0x1185d3b9);
      const targetPortalSeed = mixSeed(targetCellX, targetCellY, worldSeed ^ 0x42cb6a17);
      const sourceRand = createRng(sourcePortalSeed);
      const targetRand = createRng(targetPortalSeed);

      const sourceAngle = sourceRand() * Math.PI * 2;
      const targetAngle = targetRand() * Math.PI * 2;
      const sourceRadius = chunkSize * (1.5 + sourceRand() * 1.25);
      const targetRadius = chunkSize * (1.5 + targetRand() * 1.25);

      return {
        sourceCellX: cellX,
        sourceCellY: cellY,
        targetCellX,
        targetCellY,
        sourceX: sourceAnchor.x + Math.cos(sourceAngle) * sourceRadius,
        sourceY: sourceAnchor.y + Math.sin(sourceAngle) * sourceRadius,
        targetX: targetAnchor.x + Math.cos(targetAngle) * targetRadius,
        targetY: targetAnchor.y + Math.sin(targetAngle) * targetRadius,
        pairId: makeWormholePairId(cellX, cellY, targetCellX, targetCellY),
      };
    }

    function getOutgoingWormholeLinkForCell(cellX, cellY) {
      const key = `${cellX},${cellY}`;
      if (wormholeOutgoingCache.has(key)) {
        return wormholeOutgoingCache.get(key);
      }
      const link = computeOutgoingWormholeLinkForCell(cellX, cellY);
      wormholeOutgoingCache.set(key, link);
      return link;
    }

    function getWormholeLinksForCell(cellX, cellY) {
      const links = [];
      const seen = new Set();

      const outgoing = getOutgoingWormholeLinkForCell(cellX, cellY);
      if (outgoing) {
        const outKey = `${outgoing.pairId}|${outgoing.targetCellX},${outgoing.targetCellY}`;
        seen.add(outKey);
        links.push(outgoing);
      }

      for (let cy = cellY - MAX_WORMHOLE_JUMP_CELLS; cy <= cellY + MAX_WORMHOLE_JUMP_CELLS; cy += 1) {
        for (let cx = cellX - MAX_WORMHOLE_JUMP_CELLS; cx <= cellX + MAX_WORMHOLE_JUMP_CELLS; cx += 1) {
          if (cx === cellX && cy === cellY) continue;
          const incomingSource = getOutgoingWormholeLinkForCell(cx, cy);
          if (!incomingSource) continue;
          if (incomingSource.targetCellX !== cellX || incomingSource.targetCellY !== cellY) continue;

          const reverseLink = {
            sourceCellX: cellX,
            sourceCellY: cellY,
            targetCellX: incomingSource.sourceCellX,
            targetCellY: incomingSource.sourceCellY,
            sourceX: incomingSource.targetX,
            sourceY: incomingSource.targetY,
            targetX: incomingSource.sourceX,
            targetY: incomingSource.sourceY,
            pairId: incomingSource.pairId,
          };

          const reverseKey = `${reverseLink.pairId}|${reverseLink.targetCellX},${reverseLink.targetCellY}`;
          if (seen.has(reverseKey)) continue;
          seen.add(reverseKey);
          links.push(reverseLink);
        }
      }

      return links;
    }

    function getWormholeLinkForCell(cellX, cellY) {
      const links = getWormholeLinksForCell(cellX, cellY);
      return links.length > 0 ? links[0] : null;
    }

    function isSunAnchorChunk(cx, cy) {
      return getSunCandidateForChunk(cx, cy);
    }

    function sampleGaussianOrbitCount(rand, min = 1, max = 10) {
      const avg = (rand() + rand() + rand() + rand() + rand() + rand()) / 6;
      const raw = min + Math.round(avg * (max - min));
      return Math.max(min, Math.min(max, raw));
    }

    function pickOrbitSlotIndices(rand, maxSlots, desiredCount) {
      const all = Array.from({ length: maxSlots }, (_, i) => i);
      for (let i = all.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        const t = all[i];
        all[i] = all[j];
        all[j] = t;
      }
      const count = Math.max(1, Math.min(maxSlots, desiredCount));
      return all.slice(0, count).sort((a, b) => a - b);
    }

    function getDecorativeSystemAnchor(cx, cy, layerIndex) {
      const cellSize = layerIndex === 0 ? 10 : 14;
      const cellX = Math.floor(cx / cellSize);
      const cellY = Math.floor(cy / cellSize);
      const seed = mixSeed(cellX, cellY, worldSeed ^ (layerIndex === 0 ? 0x2f71ab41 : 0x13c9d77d));
      const rand = createRng(seed);
      const chance = layerIndex === 0 ? 0.7 : 0.55;
      if (rand() > chance) return null;

      const anchorCx = cellX * cellSize + Math.floor(cellSize * 0.5);
      const anchorCy = cellY * cellSize + Math.floor(cellSize * 0.5);
      if (cx !== anchorCx || cy !== anchorCy) return null;

      return {
        x: cx * chunkSize + chunkSize * (0.5 + (rand() - 0.5) * 0.34),
        y: cy * chunkSize + chunkSize * (0.5 + (rand() - 0.5) * 0.34),
        layerIndex,
        seed,
      };
    }

    function getCometAnchorForChunk(cx, cy) {
      const cellX = Math.floor(cx / COMET_CELL_CHUNKS);
      const cellY = Math.floor(cy / COMET_CELL_CHUNKS);
      const seed = mixSeed(cellX, cellY, worldSeed ^ 0x6c31f22d);
      const rand = createRng(seed);
      if (rand() > COMET_CELL_CHANCE) return null;

      const anchorCx = cellX * COMET_CELL_CHUNKS + Math.floor(COMET_CELL_CHUNKS * 0.5);
      const anchorCy = cellY * COMET_CELL_CHUNKS + Math.floor(COMET_CELL_CHUNKS * 0.5);
      if (cx !== anchorCx || cy !== anchorCy) return null;

      return {
        x: anchorCx * chunkSize + chunkSize * (0.5 + (rand() - 0.5) * 0.32),
        y: anchorCy * chunkSize + chunkSize * (0.5 + (rand() - 0.5) * 0.32),
        seed,
      };
    }

    function resolveOrbitPosition(obj, atTime = 0) {
      const ORBIT_SPEED_SCALE = 0.5;
      if (obj.type === "comet") {
        const centerX = Number.isFinite(obj.cometCx) ? obj.cometCx : (Number.isFinite(obj.x) ? obj.x : 0);
        const centerY = Number.isFinite(obj.cometCy) ? obj.cometCy : (Number.isFinite(obj.y) ? obj.y : 0);
        const a = Math.max(chunkSize * 2.4, Number(obj.cometA) || chunkSize * 6.5);
        const b = Math.max(chunkSize * 0.9, Number(obj.cometB) || chunkSize * 2.1);
        const speed = Number(obj.cometSpeed) || 0.04;
        const phase = Number(obj.cometPhase) || 0;
        const angle = Number(obj.cometAngle) || 0;
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        const nx = -uy;
        const ny = ux;

        if (obj.cometPath === "hyperbolic") {
          const loop = atTime * speed + phase;
          const cycle = ((loop % 2) + 2) % 2;
          const u = cycle - 1;
          const localX = u * a;
          const localY = (u * u - 0.32) * b + Math.sin(loop * Math.PI * 0.5) * b * 0.08;
          return {
            x: centerX + ux * localX + nx * localY,
            y: centerY + uy * localX + ny * localY,
          };
        }

        const t = atTime * speed + phase;
        const localX = Math.cos(t) * a;
        const localY = Math.sin(t) * b;
        return {
          x: centerX + ux * localX + nx * localY,
          y: centerY + uy * localX + ny * localY,
        };
      }

      const hasParent = Number.isFinite(obj.parentOrbitCx) && Number.isFinite(obj.parentOrbitCy);
      let centerX = Number.isFinite(obj.orbitCx) ? obj.orbitCx : (Number.isFinite(obj.x) ? obj.x : 0);
      let centerY = Number.isFinite(obj.orbitCy) ? obj.orbitCy : (Number.isFinite(obj.y) ? obj.y : 0);

      if (hasParent) {
        const parentHasRadius = Number.isFinite(obj.parentOrbitRadius);
        if (parentHasRadius) {
          const parentAngle = (obj.parentOrbitAngle || 0) + atTime * (obj.parentOrbitSpeed || 0) * ORBIT_SPEED_SCALE;
          centerX = obj.parentOrbitCx + Math.cos(parentAngle) * obj.parentOrbitRadius;
          centerY = obj.parentOrbitCy + Math.sin(parentAngle) * obj.parentOrbitRadius;
        } else {
          centerX = obj.parentOrbitCx;
          centerY = obj.parentOrbitCy;
        }
      }

      if (Number.isFinite(obj.orbitRadius)) {
        const angle = (obj.orbitAngle || 0) + atTime * (obj.orbitSpeed || 0) * ORBIT_SPEED_SCALE;
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

      // Multi-layer focal clusters create a clear composition anchor in each chunk.
      const clusterCount = 1 + Math.floor(rand() * (1 + STAR_VISIBILITY * 0.9));
      for (let c = 0; c < clusterCount; c += 1) {
        const clusterX = originX + (0.2 + rand() * 0.6) * chunkSize;
        const clusterY = originY + (0.2 + rand() * 0.6) * chunkSize;
        const starsPerCluster = Math.max(6, Math.round((7 + rand() * 8) * (0.85 + STAR_VISIBILITY * 0.2)));
        for (let i = 0; i < starsPerCluster; i += 1) {
          const angle = rand() * Math.PI * 2;
          const distance = 14 + rand() * 110;
          const ringT = distance / 124;
          const nearLayer = ringT < 0.3 && rand() < 0.7;
          const midLayer = !nearLayer && rand() < 0.62;
          const layer = nearLayer ? "near" : (midLayer ? "mid" : "deep");
          const parallax = layer === "near" ? 0.24 : (layer === "mid" ? 0.16 : 0.075);
          const size = layer === "near"
            ? (1.3 + rand() * 2.4)
            : layer === "mid"
              ? (1 + rand() * 2)
              : (0.85 + rand() * 1.5);
          const alpha = layer === "near"
            ? (0.4 + rand() * 0.46)
            : layer === "mid"
              ? (0.34 + rand() * 0.44)
              : (0.28 + rand() * 0.32);
          background.push({
            type: "star",
            layer,
            drawOrder: layer === "near" ? 3 : 2,
            parallax,
            x: clusterX + Math.cos(angle) * distance,
            y: clusterY + Math.sin(angle) * distance,
            size,
            alpha,
          });
        }
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

      const baseNebulaCount = rand() < 0.85 ? (rand() < 0.6 ? 1 : 2) : (rand() < 0.4 ? 3 : 0);
      const nebulaCount = Math.max(0, Math.min(4, Math.round(baseNebulaCount * NEBULA_DENSITY)));
      for (let i = 0; i < nebulaCount; i += 1) {
        const palette = rand() < 0.5
          ? ["rgba(96,162,255,0.24)", "rgba(56,86,168,0.12)"]
          : ["rgba(194,104,255,0.2)", "rgba(78,40,132,0.12)"];
        
        // Cinematic placement: position nebulae in thirds/clusters for visual interest
        const placementBias = rand();
        let x, y;
        if (nebulaCount > 1 && i > 0) {
          // Second/third nebulae offset from first for composition
          const offsetAngle = Math.PI * (i - 0.5) + placementBias * Math.PI * 0.5;
          const offsetDist = 200 + rand() * 300;
          const baseX = originX + chunkSize * 0.5;
          const baseY = originY + chunkSize * 0.5;
          x = baseX + Math.cos(offsetAngle) * offsetDist;
          y = baseY + Math.sin(offsetAngle) * offsetDist;
        } else {
          // First nebula, slightly offset from center for composition depth
          const quadrant = Math.floor(placementBias * 4);
          const offset = 150 + rand() * 200;
          const angle = (quadrant * Math.PI * 0.5) + rand() * Math.PI * 0.3;
          x = originX + chunkSize * 0.5 + Math.cos(angle) * offset;
          y = originY + chunkSize * 0.5 + Math.sin(angle) * offset;
        }
        
        const nebulaParallax = 0.14 + rand() * 0.16;
        background.push({
          type: "nebula",
          drawOrder: nebulaParallax < 0.2 ? 2 : 3,
          parallax: nebulaParallax,
          x: x,
          y: y,
          radius: 160 + rand() * 210,
          colorA: palette[0],
          colorB: palette[1],
        });
      }

      // Increased galaxy frequency for visual depth
      if (rand() < 0.35) {
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

      const sunAnchor = isSunAnchorChunk(cx, cy);
      const hasPlanetarySystem = Boolean(sunAnchor);

      if (hasPlanetarySystem) {
        const systemCellX = Math.floor(cx / systemCellChunks);
        const systemCellY = Math.floor(cy / systemCellChunks);
        const systemSeed = mixSeed(cx, cy, worldSeed ^ 0x51e9a3d7);
        const systemRand = createRng(systemSeed);
        const sunProfile = chooseSunProfile(systemRand);
        const sun = {
          type: "sun",
          drawOrder: 0,
          parallax: SYSTEM_PARALLAX,
          x: sunAnchor.x,
          y: sunAnchor.y,
          radius: chunkSize * (0.4 + rand() * 0.6),
          heatRadius: chunkSize * (0.22 + rand() * 0.12),
          heatDps: 0.45 + rand() * 0.25,
          coreColor: sunProfile.core,
          glowColor: sunProfile.glow,
          spectralClass: sunProfile.cls,
        };
        background.push(sun);

        const toxicNebulaCount = rand() < TOXIC_NEBULA_CHANCE ? (rand() < 0.24 ? 2 : 1) : 0;
        for (let i = 0; i < toxicNebulaCount; i += 1) {
          const angle = rand() * Math.PI * 2;
          const minDist = Math.max(chunkSize * 0.68, sun.radius * 2.2);
          const maxDist = Math.min(chunkSize * 5.2, chunkSize * systemCellChunks * 0.31);
          const dist = minDist + rand() * Math.max(1, maxDist - minDist);
          const hazardRadius = chunkSize * (0.18 + rand() * 0.14);
          const scannerJam = 0.38 + rand() * 0.34;

          background.push({
            type: "toxicNebulaZone",
            drawOrder: 7,
            parallax: SYSTEM_PARALLAX,
            x: sun.x + Math.cos(angle) * dist,
            y: sun.y + Math.sin(angle) * dist,
            radius: hazardRadius,
            hazardRadius,
            toxicDps: 0.42 + rand() * 0.32,
            scannerJam,
            colorA: `rgba(122, 245, 136, ${(0.12 + scannerJam * 0.16).toFixed(3)})`,
            colorB: `rgba(36, 122, 58, ${(0.04 + scannerJam * 0.1).toFixed(3)})`,
          });
        }

        const wormholeLinks = getWormholeLinksForCell(systemCellX, systemCellY);
        for (const wormholeLink of wormholeLinks) {
          background.push({
            type: "wormholePortal",
            drawOrder: 8,
            parallax: SYSTEM_PARALLAX,
            x: wormholeLink.sourceX,
            y: wormholeLink.sourceY,
            radius: chunkSize * 0.032,
            hitRadius: chunkSize * 0.024,
            linkedX: wormholeLink.targetX,
            linkedY: wormholeLink.targetY,
            pairId: wormholeLink.pairId,
          });
        }

        // Keep a clear interstellar gap between neighboring anchor cells.
        const maxSystemRadius = Math.min(chunkSize * 5.8, chunkSize * systemCellChunks * 0.32);

        const orbitDirection = rand() < 0.5 ? -1 : 1;
        const orbitalSpeedNearSun = 0.095 + rand() * 0.05;
        const referenceSunOrbit = Math.max(120, sun.radius * 2.2);
        function sunOrbitAngularSpeed(orbitRadius, localScale = 1) {
          const safeRadius = Math.max(1, orbitRadius);
          const ratio = safeRadius / referenceSunOrbit;
          return orbitalSpeedNearSun * Math.pow(ratio, -1.5) * localScale * orbitDirection;
        }

        function beltCountForDensity(orbitRadius, densityPer100 = 1.8, minCount = 20, maxCount = 260) {
          const circumference = Math.max(1, 2 * Math.PI * Math.max(1, orbitRadius));
          const count = Math.round((circumference / 100) * densityPer100);
          return Math.max(minCount, Math.min(maxCount, count));
        }

        function addOrbitBeltParticles(options) {
          const {
            centerType,
            center,
            orbitRadius,
            orbitAngle,
            orbitSpeed,
            parallax,
            zone,
            randFn,
            orbitParent,
          } = options;

          const isOuter = zone === "outer";
          const rockDensity = isOuter ? 1.65 : 2.35;
          const dustDensity = isOuter ? 5.4 : 4.2;
          const boulderDensity = isOuter ? 0.3 : 0.24;
          const rockCount = beltCountForDensity(orbitRadius, rockDensity, isOuter ? 28 : 22, isOuter ? 420 : 340);
          const dustCount = beltCountForDensity(orbitRadius, dustDensity, isOuter ? 70 : 46, isOuter ? 1080 : 860);
          const boulderCount = beltCountForDensity(orbitRadius, boulderDensity, isOuter ? 6 : 5, isOuter ? 64 : 52);

          for (let i = 0; i < rockCount; i += 1) {
            const a = orbitAngle + (i / rockCount) * Math.PI * 2 + (randFn() - 0.5) * 0.16;
            const localR = Math.max(1, orbitRadius + (randFn() - 0.5) * Math.max(12, orbitRadius * 0.05));
            const base = {
              type: "beltRock",
              drawOrder: 6,
              parallax,
              orbitRadius: localR,
              orbitAngle: a,
              orbitSpeed: orbitSpeed * (0.92 + randFn() * 0.18),
              radius: isOuter ? (1.8 + randFn() * 2.8) : (2.2 + randFn() * 3.8),
              alpha: isOuter ? (0.34 + randFn() * 0.24) : (0.42 + randFn() * 0.3),
            };

            if (orbitParent) {
              background.push({
                ...base,
                parentOrbitCx: orbitParent.cx,
                parentOrbitCy: orbitParent.cy,
                parentOrbitRadius: orbitParent.radius,
                parentOrbitAngle: orbitParent.angle,
                parentOrbitSpeed: orbitParent.speed,
              });
            } else if (centerType === "sun") {
              background.push({
                ...base,
                orbitCx: center.x,
                orbitCy: center.y,
              });
            }
          }

          for (let i = 0; i < dustCount; i += 1) {
            const a = orbitAngle + (i / dustCount) * Math.PI * 2 + (randFn() - 0.5) * 0.24;
            const localR = Math.max(1, orbitRadius + (randFn() - 0.5) * Math.max(20, orbitRadius * 0.07));
            const baseDust = {
              type: "beltDust",
              drawOrder: 5,
              parallax,
              orbitRadius: localR,
              orbitAngle: a,
              orbitSpeed: orbitSpeed * (0.9 + randFn() * 0.22),
              radius: isOuter ? (0.65 + randFn() * 1.25) : (0.8 + randFn() * 1.45),
              alpha: isOuter ? (0.12 + randFn() * 0.2) : (0.15 + randFn() * 0.22),
            };

            if (orbitParent) {
              background.push({
                ...baseDust,
                parentOrbitCx: orbitParent.cx,
                parentOrbitCy: orbitParent.cy,
                parentOrbitRadius: orbitParent.radius,
                parentOrbitAngle: orbitParent.angle,
                parentOrbitSpeed: orbitParent.speed,
              });
            } else if (centerType === "sun") {
              background.push({
                ...baseDust,
                orbitCx: center.x,
                orbitCy: center.y,
              });
            }
          }

          for (let i = 0; i < boulderCount; i += 1) {
            const a = orbitAngle + (i / boulderCount) * Math.PI * 2 + (randFn() - 0.5) * 0.22;
            const localR = Math.max(1, orbitRadius + (randFn() - 0.5) * Math.max(16, orbitRadius * 0.06));
            const baseBoulder = {
              type: "beltBoulder",
              drawOrder: 7,
              parallax,
              orbitRadius: localR,
              orbitAngle: a,
              orbitSpeed: orbitSpeed * (0.84 + randFn() * 0.14),
              radius: isOuter ? (3.6 + randFn() * 4.8) : (4.2 + randFn() * 5.8),
              alpha: isOuter ? (0.44 + randFn() * 0.26) : (0.48 + randFn() * 0.26),
              spin: (randFn() - 0.5) * 0.9,
              rotPhase: randFn() * Math.PI * 2,
            };

            if (orbitParent) {
              background.push({
                ...baseBoulder,
                parentOrbitCx: orbitParent.cx,
                parentOrbitCy: orbitParent.cy,
                parentOrbitRadius: orbitParent.radius,
                parentOrbitAngle: orbitParent.angle,
                parentOrbitSpeed: orbitParent.speed,
              });
            } else if (centerType === "sun") {
              background.push({
                ...baseBoulder,
                orbitCx: center.x,
                orbitCy: center.y,
              });
            }
          }
        }

        function addPlanetSubOrbits(planet, orbitZone) {
          const satelliteBase = 0.22 + rand() * 0.1;
          const satelliteRef = Math.max(18, planet.radius * 1.6);
          function satelliteSpeed(orbitRadius, scale = 1) {
            const safeRadius = Math.max(1, orbitRadius);
            const ratio = safeRadius / satelliteRef;
            return satelliteBase * Math.pow(ratio, -1.5) * scale * orbitDirection;
          }

          const isOuterZone = orbitZone === "outer";

          if (isOuterZone ? rand() < 0.95 : rand() < 0.55) {
            const moonCount = isOuterZone
              ? 2 + Math.floor(rand() * 4)
              : (rand() < 0.22 ? 2 : 1);
            for (let i = 0; i < moonCount; i += 1) {
              const moonOrbitRadius = planet.radius * (isOuterZone
                ? (2.2 + i * 0.72 + rand() * 1)
                : (2.8 + i * 0.95 + rand() * 0.9));
              background.push({
                type: "planet",
                drawOrder: 6,
                parallax: SYSTEM_PARALLAX,
                collidablePlane: true,
                parentOrbitCx: Number.isFinite(planet.orbitCx) ? planet.orbitCx : planet.x,
                parentOrbitCy: Number.isFinite(planet.orbitCy) ? planet.orbitCy : planet.y,
                parentOrbitRadius: Number.isFinite(planet.orbitRadius) ? planet.orbitRadius : 0,
                parentOrbitAngle: Number.isFinite(planet.orbitAngle) ? planet.orbitAngle : 0,
                parentOrbitSpeed: Number.isFinite(planet.orbitSpeed) ? planet.orbitSpeed : 0,
                orbitRadius: moonOrbitRadius,
                orbitAngle: rand() * Math.PI * 2,
                orbitSpeed: satelliteSpeed(moonOrbitRadius, 0.86 + rand() * 0.2),
                radius: Math.max(8, planet.radius * (isOuterZone ? (0.12 + rand() * 0.12) : (0.16 + rand() * 0.13))),
                hue: Math.floor(rand() * 360),
                isMoon: true,
              });
            }
          }

          if (!isOuterZone && rand() < 0.78) {
            const stationCount = rand() < 0.3 ? 2 : 1;
            const stationOrbitBase = planet.radius * (1.45 + rand() * 0.5);
            for (let i = 0; i < stationCount; i += 1) {
              const stationRadius = 11 + rand() * 8;
              const stationHitRadius = 9 + rand() * 6;
              const collidableStation = true;
              const stationOrbitRadius = stationOrbitBase + (rand() - 0.5) * planet.radius * 0.35;
              background.push({
                type: "orbitalStation",
                drawOrder: 7,
                parallax: SYSTEM_PARALLAX,
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

          if (isOuterZone ? rand() < 0.82 : rand() < 0.2) {
            const beltRadiusBase = planet.radius * (isOuterZone ? (2.5 + rand() * 1.2) : (3.3 + rand() * 1.2));
            const beltOrbitRadius = Math.max(planet.radius * 2.2, beltRadiusBase);
            addOrbitBeltParticles({
              centerType: "planet",
              center: { x: planet.x, y: planet.y },
              orbitRadius: beltOrbitRadius,
              orbitAngle: rand() * Math.PI * 2,
              orbitSpeed: satelliteSpeed(beltOrbitRadius, 0.86 + rand() * 0.16),
              parallax: SYSTEM_PARALLAX,
              zone: isOuterZone ? "outer" : "inner",
              randFn: rand,
              orbitParent: {
                cx: Number.isFinite(planet.orbitCx) ? planet.orbitCx : planet.x,
                cy: Number.isFinite(planet.orbitCy) ? planet.orbitCy : planet.y,
                radius: Number.isFinite(planet.orbitRadius) ? planet.orbitRadius : 0,
                angle: Number.isFinite(planet.orbitAngle) ? planet.orbitAngle : 0,
                speed: Number.isFinite(planet.orbitSpeed) ? planet.orbitSpeed : 0,
              },
            });
          }
        }

        const orbitSlotCount = sampleGaussianOrbitCount(systemRand, 1, maxOrbitShells);
        const selectedOrbitSlots = pickOrbitSlotIndices(systemRand, maxOrbitShells, orbitSlotCount);
        const shellBase = Math.max(orbitUnit * 1.85, sun.radius * 1.05);
        const shellSpacing = orbitUnit * 1.2;
        const minOrbitLaneGap = chunkSize;
        let lastPlanetRadius = 0;
        let lastOrbitRadius = shellBase - shellSpacing;
        for (const slotIndex of selectedOrbitSlots) {
          const orbitZone = slotIndex < 5 ? "inner" : "outer";
          const innerRocky = orbitZone === "inner";
          const shellScale = 1 - slotIndex / Math.max(1, maxOrbitShells);
          const predictedPlanetRadius = innerRocky
            ? chunkSize * (0.06 + rand() * 0.14) * (0.9 + shellScale * 0.22)
            : chunkSize * (0.18 + rand() * 0.4) * (0.94 + shellScale * 0.2);
          const outerSpacingBoost = slotIndex >= 5 ? chunkSize * (0.5 + (slotIndex - 4) * 0.14) : 0;
          const minimumGap = Math.max(
            (lastPlanetRadius + predictedPlanetRadius) * 1.5,
            minOrbitLaneGap + lastPlanetRadius + predictedPlanetRadius,
            minOrbitLaneGap + outerSpacingBoost,
          );
          const shellRadius = shellBase + slotIndex * shellSpacing;
          const orbitRadius = Math.max(shellRadius, lastOrbitRadius + minimumGap);
          if (orbitRadius + predictedPlanetRadius > maxSystemRadius) {
            break;
          }
          const slotAngle = rand() * Math.PI * 2;
          const beltInsteadOfPlanet = rand() < (innerRocky ? 0.22 : 0.32);

          if (beltInsteadOfPlanet) {
            addOrbitBeltParticles({
              centerType: "sun",
              center: { x: sun.x, y: sun.y },
              orbitRadius,
              orbitAngle: slotAngle,
              orbitSpeed: sunOrbitAngularSpeed(orbitRadius, 0.9 + rand() * 0.16),
              parallax: SYSTEM_PARALLAX,
              zone: innerRocky ? "inner" : "outer",
              randFn: rand,
            });
            lastOrbitRadius = orbitRadius;
            continue;
          }

          const planetRadius = predictedPlanetRadius;
          const planet = {
            type: "planet",
            drawOrder: innerRocky ? 6 : 5,
            parallax: SYSTEM_PARALLAX,
            collidablePlane: true,
            orbitCx: sun.x,
            orbitCy: sun.y,
            orbitRadius,
            orbitAngle: slotAngle,
            orbitSpeed: sunOrbitAngularSpeed(orbitRadius, innerRocky ? 1 : 0.86 + rand() * 0.12),
            radius: planetRadius,
            hue: innerRocky ? Math.floor(18 + rand() * 42) : Math.floor(165 + rand() * 120),
            isGasGiant: !innerRocky,
          };
          planet.x = planet.orbitCx + Math.cos(planet.orbitAngle) * planet.orbitRadius;
          planet.y = planet.orbitCy + Math.sin(planet.orbitAngle) * planet.orbitRadius;
          background.push(planet);
          addPlanetSubOrbits(planet, orbitZone);
          lastPlanetRadius = planetRadius;
          lastOrbitRadius = orbitRadius;
        }
      }

      const cometAnchor = getCometAnchorForChunk(cx, cy);
      if (cometAnchor) {
        const cRand = createRng(cometAnchor.seed ^ 0x1ab7d42f);
        const hyperbolic = cRand() < 0.52;
        background.push({
          type: "comet",
          drawOrder: 8,
          parallax: 1,
          cometCx: cometAnchor.x,
          cometCy: cometAnchor.y,
          cometPath: hyperbolic ? "hyperbolic" : "elliptic",
          cometA: chunkSize * (6 + cRand() * 8),
          cometB: chunkSize * (hyperbolic ? (1.2 + cRand() * 2.3) : (2.4 + cRand() * 3.1)),
          cometAngle: cRand() * Math.PI * 2,
          cometSpeed: 0.028 + cRand() * 0.042,
          cometPhase: cRand() * Math.PI * 2,
          radius: chunkSize * (0.009 + cRand() * 0.007),
          tailLength: chunkSize * (0.52 + cRand() * 0.68),
          hue: 188 + Math.floor(cRand() * 48),
        });
      }

      // Decorative rear systems: full non-collidable systems for visual depth.
      for (let layerIndex = 0; layerIndex < 2; layerIndex += 1) {
        const anchor = getDecorativeSystemAnchor(cx, cy, layerIndex);
        if (!anchor) continue;

        const dRand = createRng(anchor.seed ^ 0x6d2f43);
        const dParallax = layerIndex === 0 ? 0.52 : 0.3;
        const dScale = layerIndex === 0 ? 0.56 : 0.38;
        const sunProfile = chooseSunProfile(dRand);
        const sun = {
          type: "sun",
          drawOrder: 0,
          parallax: dParallax,
          x: anchor.x,
          y: anchor.y,
          radius: chunkSize * (0.22 + dRand() * 0.28) * dScale,
          coreColor: sunProfile.core,
          glowColor: sunProfile.glow,
          spectralClass: sunProfile.cls,
        };
        background.push(sun);

        const orbitCount = sampleGaussianOrbitCount(dRand, 1, maxOrbitShells);
        const shellBase = Math.max(orbitUnit * 0.95 * dScale, sun.radius * 1.45);
        const shellSpacing = orbitUnit * 0.52 * dScale;
        for (let slot = 0; slot < orbitCount; slot += 1) {
          const orbitRadius = shellBase + slot * shellSpacing + dRand() * orbitUnit * 0.16 * dScale;
          const angle = dRand() * Math.PI * 2;
          background.push({
            type: "planet",
            drawOrder: 5,
            parallax: dParallax,
            collidablePlane: false,
            orbitCx: sun.x,
            orbitCy: sun.y,
            orbitRadius,
            orbitAngle: angle,
            orbitSpeed: (0.04 + dRand() * 0.03) * (dRand() < 0.5 ? -1 : 1),
            radius: chunkSize * (0.02 + dRand() * 0.06) * dScale,
            hue: Math.floor(dRand() * 360),
          });
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

    function getCollidableBodies(atTime = 0) {
      const out = [];
      for (const chunk of activeChunks.values()) {
        for (const bg of chunk.background) {
          if (bg.type !== "planet" && bg.type !== "orbitalStation") continue;
          if (!bg.collidablePlane) continue;
          const pos = resolveOrbitPosition(bg, atTime);
          const radius = bg.hitRadius || bg.radius || 12;
          out.push({
            type: bg.type,
            x: pos.x,
            y: pos.y,
            parallax: bg.parallax || 1,
            radius,
            hitRadius: radius,
          });
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

    function getSolarHeatZones() {
      const out = [];
      for (const chunk of activeChunks.values()) {
        for (const bg of chunk.background) {
          if (bg.type !== "sun") continue;
          out.push({
            type: "sun",
            x: bg.x,
            y: bg.y,
            parallax: bg.parallax || 1,
            heatRadius: bg.heatRadius || Math.max(80, bg.radius * 0.45),
            heatDps: bg.heatDps || 0.5,
          });
        }
      }
      return out;
    }

    function getToxicNebulaZones() {
      const out = [];
      for (const chunk of activeChunks.values()) {
        for (const bg of chunk.background) {
          if (bg.type !== "toxicNebulaZone") continue;
          out.push({
            type: "toxicNebulaZone",
            x: bg.x,
            y: bg.y,
            parallax: bg.parallax || 1,
            hazardRadius: bg.hazardRadius || bg.radius || 140,
            toxicDps: bg.toxicDps || 0.45,
            scannerJam: bg.scannerJam || 0.45,
          });
        }
      }
      return out;
    }

    function getWormholePortals() {
      const out = [];
      for (const chunk of activeChunks.values()) {
        for (const bg of chunk.background) {
          if (bg.type !== "wormholePortal") continue;
          out.push({
            type: "wormholePortal",
            x: bg.x,
            y: bg.y,
            parallax: bg.parallax || 1,
            radius: bg.radius || 24,
            hitRadius: bg.hitRadius || bg.radius || 20,
            linkedX: bg.linkedX,
            linkedY: bg.linkedY,
            pairId: bg.pairId || "pair",
          });
        }
      }
      return out;
    }

    function getNearestWormholePortal(worldX, worldY, maxCellRadius = 18) {
      if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;

      const worldChunkX = Math.floor(worldX / chunkSize);
      const worldChunkY = Math.floor(worldY / chunkSize);
      const baseCellX = Math.floor(worldChunkX / systemCellChunks);
      const baseCellY = Math.floor(worldChunkY / systemCellChunks);

      let nearest = null;
      let nearestDistSq = Number.POSITIVE_INFINITY;
      const radius = Math.max(1, Math.floor(maxCellRadius));

      for (let cy = baseCellY - radius; cy <= baseCellY + radius; cy += 1) {
        for (let cx = baseCellX - radius; cx <= baseCellX + radius; cx += 1) {
          const links = getWormholeLinksForCell(cx, cy);
          for (const link of links) {
            const dx = link.sourceX - worldX;
            const dy = link.sourceY - worldY;
            const distSq = dx * dx + dy * dy;
            if (distSq >= nearestDistSq) continue;

            nearestDistSq = distSq;
            nearest = {
              type: "wormholePortal",
              x: link.sourceX,
              y: link.sourceY,
              parallax: 1,
              radius: chunkSize * 0.032,
              hitRadius: chunkSize * 0.024,
              linkedX: link.targetX,
              linkedY: link.targetY,
              pairId: link.pairId,
            };
          }
        }
      }

      return nearest;
    }

    function setSeed(nextSeed) {
      const numeric = Number.parseInt(nextSeed, 10);
      if (!Number.isFinite(numeric)) return false;
      worldSeed = Math.abs(Math.floor(numeric)) || 1;
      activeChunks.clear();
      wormholeOutgoingCache.clear();
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

    function estimateSystemInfluence(worldX, worldY) {
      if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return 0;

      const worldChunkX = Math.floor(worldX / chunkSize);
      const worldChunkY = Math.floor(worldY / chunkSize);
      const baseCellX = Math.floor(worldChunkX / systemCellChunks);
      const baseCellY = Math.floor(worldChunkY / systemCellChunks);

      let influence = 0;
      const influenceRadius = chunkSize * 7.8;

      for (let cy = baseCellY - 1; cy <= baseCellY + 1; cy += 1) {
        for (let cx = baseCellX - 1; cx <= baseCellX + 1; cx += 1) {
          const anchor = getSystemAnchorForCell(cx, cy);
          if (!anchor) continue;
          const d = Math.hypot(worldX - anchor.x, worldY - anchor.y);
          const t = Math.max(0, 1 - d / influenceRadius);
          if (t > influence) influence = t;
        }
      }

      return influence;
    }

    return {
      update,
      getBackgroundObjects,
      getCollidablePlanets,
      getCollidableBodies,
      getOrbitalStations,
      getSolarHeatZones,
      getToxicNebulaZones,
      getWormholePortals,
      getNearestWormholePortal,
      resolveOrbitPosition,
      estimateSystemInfluence,
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
