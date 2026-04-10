(function () {
  function createScoringSystem(deps) {
    const {
      state,
      selectedDifficultyMode,
      clamp,
    } = deps;

    function scoreMultiplier() {
      return 1 + Math.min(2.4, Math.pow(Math.max(0, state.level - 1), 0.92) * 0.08);
    }

    function passiveScoreMultiplier() {
      const salvage = 1 + (state.upgradesTaken.lootSalvageBoost || 0) * 0.2;
      const xp = state.shipStats ? state.shipStats.xpBonus : 1;
      return salvage * xp;
    }

    function addPoints(base) {
      const xp = state.shipStats ? state.shipStats.xpBonus : 1;
      const earlyLevelScale = state.level <= 4 ? (0.62 + state.level * 0.1) : 1;
      state.score += base * scoreMultiplier() * xp * earlyLevelScale;
    }

    function addPassiveScore(dt) {
      const earlyPassiveScale = state.level <= 4 ? (0.5 + state.level * 0.1) : 1;
      state.score += dt * (2.4 + state.level * 0.14) * passiveScoreMultiplier() * earlyPassiveScale;
    }

    function computeNextLevelCost() {
      const difficulty = selectedDifficultyMode();
      const elapsed = Math.max(1, state.time - state.lastLevelTime);
      const gained = Math.max(1, state.score - state.lastLevelScore);
      const killsGained = Math.max(0, state.kills - (state.lastLevelKills || 0));
      const scoreRate = gained / elapsed;
      const killsPerMinute = (killsGained / elapsed) * 60;
      const passiveRate = (2.4 + state.level * 0.14) * passiveScoreMultiplier();
      const combatRate = Math.max(0, scoreRate - passiveRate);

      // Hard mode spawns more score opportunities, easy mode fewer.
      // Scale required XP so all difficulties stay in a comparable level-time corridor.
      const difficultyLevelScale = Math.max(0.86, Math.min(1.18, (difficulty.spawnRateMult * 0.7) + (difficulty.edgeSpawnRateMult * 0.3)));
      const adjustedRate = scoreRate * difficultyLevelScale;

      // Kill-heavy play targets 30-60s; passive/low-kill windows may stretch toward 90s.
      const killPressure = clamp(killsPerMinute / 7.5, 0, 2.2);
      const combatPressure = clamp(combatRate / 24, 0, 2.2);
      const pressure = clamp(killPressure * 0.68 + combatPressure * 0.32, 0, 2.2);
      const baseTargetSeconds = clamp(90 - pressure * 27, 30, 90);
      const earlyLevelBoost = state.level <= 4 ? (1.35 - state.level * 0.08) : 1;
      const targetSeconds = clamp(baseTargetSeconds * earlyLevelBoost, 32, 105);

      const dynamicCost = Math.floor(adjustedRate * targetSeconds);
      const exponentialBase = Math.floor(state.levelCost * 1.14 + 18);
      const blended = Math.floor(exponentialBase * 0.44 + dynamicCost * 0.56);

      const minBound = state.level <= 4 ? state.levelCost + 34 : state.levelCost + 14;
      const maxBound = Math.floor(state.levelCost * 1.5 + 120);
      return Math.max(minBound, Math.min(maxBound, blended));
    }

    return {
      addPoints,
      addPassiveScore,
      computeNextLevelCost,
    };
  }

  window.VoidScoring = {
    createScoringSystem,
  };
})();
