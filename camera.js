(function () {
  function createCameraSystem(options = {}) {
    const state = {
      x: typeof options.x === "number" ? options.x : 0,
      y: typeof options.y === "number" ? options.y : 0,
      smoothing: typeof options.smoothing === "number" ? options.smoothing : 0.12,
    };

    function update(dt, targetX, targetY) {
      const frameAlpha = 1 - Math.pow(1 - state.smoothing, Math.max(0, dt) * 60);
      state.x += (targetX - state.x) * frameAlpha;
      state.y += (targetY - state.y) * frameAlpha;
    }

    function snap(x, y) {
      state.x = x;
      state.y = y;
    }

    function worldToScreen(worldX, worldY, parallax, viewWidth, viewHeight) {
      const p = typeof parallax === "number" ? parallax : 1;
      return {
        x: worldX - state.x * p + viewWidth * 0.5,
        y: worldY - state.y * p + viewHeight * 0.5,
      };
    }

    function getX() {
      return state.x;
    }

    function getY() {
      return state.y;
    }

    function getState() {
      return { ...state };
    }

    return {
      update,
      snap,
      worldToScreen,
      getX,
      getY,
      getState,
    };
  }

  window.VoidCamera = {
    createCameraSystem,
  };
})();
