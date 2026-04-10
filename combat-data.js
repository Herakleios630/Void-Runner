(function () {
  const KILL_REWARD_TABLE = {
    shot: {
      miniAlien: 34,
      alienShip: 42,
      mothership: 120,
      mediumRock: 38,
      smallRock: 30,
      goldAsteroid: 92,
      ironAsteroid: 66,
      rockShard: 22,
      default: 24,
    },
    rocket: {
      boulder: 88,
      debris: 50,
      alienShip: 58,
      mothership: 140,
      miniAlien: 44,
      mediumRock: 46,
      smallRock: 34,
      goldAsteroid: 112,
      ironAsteroid: 82,
      default: 30,
    },
  };

  function getKillReward(reason, objectType) {
    const table = KILL_REWARD_TABLE[reason];
    if (!table) return 0;
    if (Object.prototype.hasOwnProperty.call(table, objectType)) {
      return table[objectType];
    }
    return table.default || 0;
  }

  window.VoidCombatData = {
    getKillReward,
  };
})();
