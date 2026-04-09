(function () {
  const manifest = {
    "ship.default": "assets/ship-default.png",
    "ship.scout": "assets/ship-scout.png",
    "ship.tank": "assets/ship-tank.png",
    "ship.glass": "assets/ship-glass.png",
    "ship.aegis": "assets/ship-aegis.png",
    "ship.demolisher": "assets/ship-demolisher.png",
    "ship.pioneer": "assets/ship-pioneer.png",
    "ship.pyro": "assets/ship-pyro.png",
    "enemy.miniAlien": "assets/enemy-minialien.png",
    "enemy.alienShip": "assets/enemy-alienship.png",
    "rock.smallRock": "assets/rock-small.png",
    "rock.mediumRock": "assets/rock-medium.png",
    "rock.rockShard": "assets/rock-shard.png",
    "rock.boulder": "assets/rock-boulder.png",
    "hazard.planet": "assets/hazard-planet.png",
    "hazard.station": "assets/hazard-station.png",
    "hazard.blackHole": "assets/hazard-blackhole.png",
  };

  class VoidAssetStore {
    constructor(assetManifest) {
      this.manifest = assetManifest;
      this.images = new Map();
      this.ready = false;
    }

    loadOne(key, path) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.images.set(key, img);
          resolve();
        };
        img.onerror = () => {
          resolve();
        };
        img.src = path;
      });
    }

    preload() {
      const jobs = Object.entries(this.manifest).map(([key, path]) => this.loadOne(key, path));
      return Promise.all(jobs).then(() => {
        this.ready = true;
      });
    }

    get(key) {
      return this.images.get(key) || null;
    }
  }

  const store = new VoidAssetStore(manifest);
  store.preload();

  window.VoidAssets = {
    ready: () => store.ready,
    get: (key) => store.get(key),
    manifest,
  };
})();
