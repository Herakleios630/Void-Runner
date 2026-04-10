(function () {
  function createFlightControlSystem(deps) {
    const {
      input,
    } = deps;

    function applyInputThrust(ship, dt) {
      ship.vx += input.axisX * ship.thrust * dt;
      ship.vy += input.axisY * ship.thrust * dt;
      if (input.up) ship.vy -= ship.thrust * dt;
      if (input.down) ship.vy += ship.thrust * dt;
      if (input.left) ship.vx -= ship.thrust * dt;
      if (input.right) ship.vx += ship.thrust * dt;

      const speed = Math.hypot(ship.vx, ship.vy);
      if (speed > ship.maxSpeed) {
        ship.vx = (ship.vx / speed) * ship.maxSpeed;
        ship.vy = (ship.vy / speed) * ship.maxSpeed;
      }
    }

    return {
      applyInputThrust,
    };
  }

  window.VoidFlightControl = {
    createFlightControlSystem,
  };
})();
