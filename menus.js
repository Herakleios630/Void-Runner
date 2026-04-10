(function () {
  function createMenuSystem(deps) {
    const {
      state,
      overlay,
      SHIP_MODELS,
      DIFFICULTY_MODES,
      setPauseIndicatorVisible,
    } = deps;

    function shipStartKitText(model) {
      const kit = [];
      if (model.startCannonHalf) {
        kit.push("Geschuetz (50%)");
      } else if (!(model.startShield || model.startLaser || model.startRocket || model.startDrill || model.startPlasma)) {
        kit.push("Geschuetz");
      }
      if (model.startDrill) kit.push("Bohrer");
      if (model.startLaser) kit.push("Laser");
      if (model.startPlasma) kit.push("Plasmawerfer");
      if (model.startShield) kit.push("Schild");
      if (model.startRocket) kit.push("Raketenwerfer");
      return kit.length > 0 ? kit.join(", ") : "Kein Startmodul";
    }

    function selectedDifficultyMode() {
      return DIFFICULTY_MODES[state.selectedDifficultyId] || DIFFICULTY_MODES.medium;
    }

    function showDifficultySelectionMenu() {
      state.running = false;
      state.pauseReason = "difficulty-select";
      setPauseIndicatorVisible(false);

      overlay.classList.remove("hidden");
      overlay.innerHTML = `
        <h1>Void Runner</h1>
        <p>Waehle den Schwierigkeitsgrad</p>
        <div style="display:grid;gap:10px;width:min(92vw,720px)">
          <button data-action="select-difficulty" data-difficulty-id="easy" style="width:100%;max-width:720px;text-align:left;line-height:1.4;white-space:normal;word-break:break-word;">
            <strong>Einfach</strong><br />
            <span>Langsamere Objekte, weniger Spawn, +50% HP.</span>
          </button>
          <button data-action="select-difficulty" data-difficulty-id="medium" style="width:100%;max-width:720px;text-align:left;line-height:1.4;white-space:normal;word-break:break-word;">
            <strong>Mittel</strong><br />
            <span>Empfohlene Standardwerte.</span>
          </button>
          <button data-action="select-difficulty" data-difficulty-id="hard" style="width:100%;max-width:720px;text-align:left;line-height:1.4;white-space:normal;word-break:break-word;">
            <strong>Schwierig</strong><br />
            <span>Schnellere Gegner, mehr Spawn-Druck, haertere Bosse.</span>
          </button>
        </div>
      `;
    }

    function showShipSelectionMenu() {
      state.running = false;
      state.pauseReason = "ship-select";
      setPauseIndicatorVisible(false);
      const diff = selectedDifficultyMode();

      const shipButtons = Object.values(SHIP_MODELS)
        .map(
          (model) => `
          <button data-action="select-ship" data-ship-id="${model.id}" style="width:100%;max-width:740px;text-align:left;line-height:1.4;white-space:normal;word-break:break-word;">
            <strong>${model.name} (${model.role})</strong><br />
            <span>HP ${model.maxHp} | ARM ${model.maxArmor} | Speed ${Math.round(model.speed * 100)}% | Krit ${Math.round(model.critChance * 100)}% | Krit-DMG ${Math.round(model.critDamage * 100)}% | Reload ${Math.round(model.reloadRate * 100)}% | XP ${Math.round(model.xpBonus * 100)}%</span><br />
            <span>Start: ${shipStartKitText(model)}</span>
          </button>
        `,
        )
        .join("");

      overlay.classList.remove("hidden");
      overlay.innerHTML = `
        <h1>Void Runner</h1>
        <p>Schwierigkeit: <strong>${diff.title}</strong></p>
        <p>Waehle dein Raumschiff</p>
        <div style="display:grid;gap:10px;width:min(92vw,740px)">
          ${shipButtons}
        </div>
        <p style="margin-top:10px;">Steuerung: WASD/Pfeile, LMB/Space = Geschuetz, RMB = Rakete</p>
      `;
    }

    return {
      showDifficultySelectionMenu,
      showShipSelectionMenu,
    };
  }

  window.VoidMenus = {
    createMenuSystem,
  };
})();
