(function () {
  function createCameraSystem(options = {}) {
    const state = {
      x: typeof options.x === "number" ? options.x : 0,
      y: typeof options.y === "number" ? options.y : 0,
      smoothing: typeof options.smoothing === "number" ? options.smoothing : 0.12,
      lookAheadSeconds: typeof options.lookAheadSeconds === "number" ? options.lookAheadSeconds : 0.14,
      lookAheadMax: typeof options.lookAheadMax === "number" ? options.lookAheadMax : 110,
      lookSmoothing: typeof options.lookSmoothing === "number" ? options.lookSmoothing : 0.18,
      lookX: 0,
      lookY: 0,
      lastTargetX: typeof options.x === "number" ? options.x : 0,
      lastTargetY: typeof options.y === "number" ? options.y : 0,
    };

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function update(dt, targetX, targetY) {
      const safeDt = Math.max(0.0001, dt || 0);
      const targetVx = (targetX - state.lastTargetX) / safeDt;
      const targetVy = (targetY - state.lastTargetY) / safeDt;

      const desiredLookX = clamp(targetVx * state.lookAheadSeconds, -state.lookAheadMax, state.lookAheadMax);
      const desiredLookY = clamp(targetVy * state.lookAheadSeconds, -state.lookAheadMax, state.lookAheadMax);
      const lookAlpha = 1 - Math.pow(1 - state.lookSmoothing, Math.max(0, dt) * 60);

      state.lookX += (desiredLookX - state.lookX) * lookAlpha;
      state.lookY += (desiredLookY - state.lookY) * lookAlpha;

      const desiredX = targetX + state.lookX;
      const desiredY = targetY + state.lookY;
      const frameAlpha = 1 - Math.pow(1 - state.smoothing, Math.max(0, dt) * 60);
      state.x += (desiredX - state.x) * frameAlpha;
      state.y += (desiredY - state.y) * frameAlpha;

      state.lastTargetX = targetX;
      state.lastTargetY = targetY;
    }

    function snap(x, y) {
      state.x = x;
      state.y = y;
      state.lookX = 0;
      state.lookY = 0;
      state.lastTargetX = x;
      state.lastTargetY = y;
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
