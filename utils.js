(function () {
  function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function circlesOverlap(ax, ay, ar, bx, by, br, pad = 0) {
    const dx = ax - bx;
    const dy = ay - by;
    const r = ar + br + pad;
    return dx * dx + dy * dy < r * r;
  }

  window.VoidUtils = {
    randomFrom,
    clamp,
    circlesOverlap,
  };
})();
