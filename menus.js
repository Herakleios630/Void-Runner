(function () {
  function createMenuSystem(deps) {
    const {
      state,
      overlay,
      SHIP_MODELS,
      DIFFICULTY_MODES,
      setPauseIndicatorVisible,
      playMusicCategory,
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

    function showMainLandingMenu() {
      state.running = false;
      state.pauseReason = "menu";
      setPauseIndicatorVisible(false);
      if (typeof playMusicCategory === "function") {
        playMusicCategory("menu");
      }
      overlay.classList.remove("hidden");
      overlay.innerHTML = `
        <h1>Void Runner</h1>
        <p style="color:#b8d8f8;">Prozedurales Weltraum-Abenteuer</p>
        <div style="display:grid;gap:12px;width:min(92vw,340px);margin:24px auto 0;">
          <button data-action="open-diff-select" style="padding:14px 28px;font-size:17px;">Spiel starten</button>
          <button data-action="open-options" data-back="main-menu" style="padding:11px 28px;">Optionen</button>
        </div>
        <p style="margin-top:28px;font-size:12px;color:#6a98c0;">WASD/Pfeile = Schub &nbsp;|&nbsp; LMB/Space = Schiessen &nbsp;|&nbsp; ESC = Pause</p>
      `;
    }

    function showOptionsMenu(backAction) {
      state.running = false;
      state.pauseReason = "options";
      setPauseIndicatorVisible(false);
      const opts = state.options || {};
      const musicVolPct = Math.round((opts.musicVolume !== undefined ? opts.musicVolume : 1) * 100);
      const sfxVolPct = Math.round((opts.sfxVolume !== undefined ? opts.sfxVolume : 1) * 100);
      const toastEnabled = opts.missionToastEnabled !== false;
      const dailyChallengesEnabled = opts.dailyRunChallengesEnabled === true;
      const failTimeExtraEnabled = opts.missionFailExtraTimeLimit === true;
      const failHitExtraEnabled = opts.missionFailExtraHitLimit === true;
      const failNoHitExtraEnabled = opts.missionFailExtraNoHit === true;
      const statusBarsMode = state.statusBarsMode || 0;
      const modeLabels = ["Aus", "Nur Spieler", "Nur Gegner", "Beide"];

      overlay.classList.remove("hidden");
      overlay.innerHTML = `
        <h1>Optionen</h1>
        <div style="width:min(92vw,460px);display:grid;gap:20px;text-align:left;">
          <div>
            <label style="display:block;margin-bottom:6px;color:#d0e8ff;">Musik-Lautstaerke: <strong id="musicVolLabel">${musicVolPct}%</strong></label>
            <input type="range" id="musicVolumeSlider" min="0" max="100" value="${musicVolPct}" style="width:100%;accent-color:#67f2ff;" />
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;color:#d0e8ff;">Sound-Effekte: <strong id="sfxVolLabel">${sfxVolPct}%</strong></label>
            <input type="range" id="sfxVolumeSlider" min="0" max="100" value="${sfxVolPct}" style="width:100%;accent-color:#67f2ff;" />
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" id="missionToastToggle" ${toastEnabled ? "checked" : ""} style="width:18px;height:18px;accent-color:#67f2ff;" />
            <label for="missionToastToggle" style="color:#d0e8ff;cursor:pointer;">Missions-Popup anzeigen</label>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" id="dailyChallengeToggle" ${dailyChallengesEnabled ? "checked" : ""} style="width:18px;height:18px;accent-color:#67f2ff;" />
            <label for="dailyChallengeToggle" style="color:#d0e8ff;cursor:pointer;">Tages-/Run-Challenges aktivieren</label>
          </div>
          <div style="padding:10px 12px;border:1px solid rgba(255,255,255,0.18);border-radius:10px;background:rgba(9,23,46,0.45);display:grid;gap:8px;">
            <div style="font-weight:600;color:#d9ecff;">Missionen: zusaetzliche Fail-Conditions</div>
            <div style="font-size:12px;color:#9ec8e9;">Schwierigkeit: Einfach = keine, Mittel = Zeitlimit, Schwer = alle. Diese Schalter fuegen extra Regeln hinzu.</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="missionFailTimeToggle" ${failTimeExtraEnabled ? "checked" : ""} style="width:18px;height:18px;accent-color:#67f2ff;" />
              <label for="missionFailTimeToggle" style="color:#d0e8ff;cursor:pointer;">Extra: Zeitlimit</label>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="missionFailHitToggle" ${failHitExtraEnabled ? "checked" : ""} style="width:18px;height:18px;accent-color:#67f2ff;" />
              <label for="missionFailHitToggle" style="color:#d0e8ff;cursor:pointer;">Extra: Trefferlimit</label>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="missionFailNoHitToggle" ${failNoHitExtraEnabled ? "checked" : ""} style="width:18px;height:18px;accent-color:#67f2ff;" />
              <label for="missionFailNoHitToggle" style="color:#d0e8ff;cursor:pointer;">Extra: No-Hit</label>
            </div>
          </div>
          <div>
            <label style="display:block;margin-bottom:8px;color:#d0e8ff;">Lebensbalken-Modus</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${modeLabels.map((label, i) => `<button data-action="set-statusbars-mode" data-mode="${i}" data-back="${backAction}" style="padding:7px 16px;${statusBarsMode === i ? "border-color:rgba(103,242,255,0.9);background:rgba(103,242,255,0.14);" : ""}">${label}</button>`).join("")}
            </div>
          </div>
          <button data-action="apply-options" data-back="${backAction}" style="padding:12px 20px;margin-top:4px;">Speichern &amp; Zurueck</button>
        </div>
      `;

      const musicSlider = overlay.querySelector("#musicVolumeSlider");
      const sfxSlider = overlay.querySelector("#sfxVolumeSlider");
      const musicLabel = overlay.querySelector("#musicVolLabel");
      const sfxLabel = overlay.querySelector("#sfxVolLabel");
      if (musicSlider && musicLabel) {
        musicSlider.addEventListener("input", () => { musicLabel.textContent = `${musicSlider.value}%`; });
      }
      if (sfxSlider && sfxLabel) {
        sfxSlider.addEventListener("input", () => { sfxLabel.textContent = `${sfxSlider.value}%`; });
      }
    }

    function showDifficultySelectionMenu() {
      state.running = false;
      state.pauseReason = "difficulty-select";
      setPauseIndicatorVisible(false);
      if (typeof playMusicCategory === "function") {
        playMusicCategory("menu");
      }

      const seedValue = Number.isFinite(state.worldSeed) ? state.worldSeed : 1;

      overlay.classList.remove("hidden");
      overlay.innerHTML = `
        <h1>Void Runner</h1>
        <p>Waehle den Schwierigkeitsgrad</p>
        <div style="width:min(92vw,720px);padding:10px 12px;border:1px solid rgba(255,255,255,0.22);border-radius:12px;background:rgba(6,16,38,0.52);margin-bottom:10px;text-align:left;">
          <strong>Welt-Seed</strong><br />
          <input id="worldSeedInput" value="${seedValue}" inputmode="numeric" style="width:100%;max-width:320px;margin-top:6px;padding:7px 9px;border-radius:8px;border:1px solid rgba(255,255,255,0.3);background:rgba(7,20,42,0.8);color:#eef8ff;" />
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <button data-action="seed-randomize" style="padding:8px 14px;">Zufaelligen Seed</button>
            <button data-action="seed-apply" style="padding:8px 14px;">Seed uebernehmen</button>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#c9ddf5;">Gleicher Seed = gleiche prozedurale Welt.</div>
        </div>
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
      if (typeof playMusicCategory === "function") {
        playMusicCategory("menu");
      }
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
      showMainLandingMenu,
      showOptionsMenu,
      showDifficultySelectionMenu,
      showShipSelectionMenu,
    };
  }

  window.VoidMenus = {
    createMenuSystem,
  };
})();
