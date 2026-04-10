(function () {
  window.VoidTuning = {
    VISUAL: {
      // 1.0 is neutral. Increase to boost small-star readability.
      starVisibility: 1.12,
      // 1.0 is neutral. Increase for denser/stronger nebula presence.
      nebulaDensity: 1.15,
    },
    GAMEPLAY: {
      world: {
        chunkSize: 960,
      },
      spawn: {
        targetObjects: {
          easy: 46,
          medium: 58,
          hard: 70,
        },
        targetEnemies: {
          easy: 14,
          medium: 20,
          hard: 26,
        },
        minLastSpawnCarry: 0.28,
        minDynamicSpawnInterval: 0.44,
      },
      enemyCombat: {
        miniFireMaxDistViewportMult: 0.95,
        shipFireMaxDistViewportMult: 1.05,
        miniOutOfRangeDelayMin: 0.6,
        miniOutOfRangeDelayRand: 0.9,
        shipOutOfRangeDelayMin: 0.55,
        shipOutOfRangeDelayRand: 0.8,
      },
      shield: {
        novaInterval: 30,
      },
      progression: {
        spawnIntensityPerBoss: 0.2,
        spawnIntensityCap: 1.25,
      },
    },
    DESTROY_REASONS: {
      SHOT: "shot",
      ROCKET: "rocket",
      COLLISION: "collision",
      ACID: "acid",
    },
  };
})();
