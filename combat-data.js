(function () {
  const KILL_REWARD_TABLE = {
    shot: {
      miniAlien: 34,
      alienShip: 42,
      mediumRock: 38,
      smallRock: 30,
      rockShard: 22,
      default: 24,
    },
    rocket: {
      boulder: 88,
      debris: 50,
      alienShip: 58,
      miniAlien: 44,
      mediumRock: 46,
      smallRock: 34,
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
