(function () {
  function createDebugToolsSystem(deps) {
    const {
      state,
      stageWrapEl,
      shipInfoPanelEl,
      progression,
      balanceTuningTracks,
    } = deps;

    const balanceDebug = {
      visible: false,
      selectedTrackIndex: 0,
      tuneStep: 0.05,
    };

    const balanceDebugPanelEl = document.createElement("aside");
    balanceDebugPanelEl.className = "balance-debug hidden";
    stageWrapEl.appendChild(balanceDebugPanelEl);

    function selectedBalanceTrack() {
      return balanceTuningTracks[Math.max(0, Math.min(balanceTuningTracks.length - 1, balanceDebug.selectedTrackIndex))] || "cannon";
    }

    function cycleBalanceTrack(dir) {
      const len = balanceTuningTracks.length;
      if (len <= 0) return;
      balanceDebug.selectedTrackIndex = (balanceDebug.selectedTrackIndex + dir + len) % len;
    }

    function updateBalanceDebugPanel() {
      if (!balanceDebug.visible) {
        balanceDebugPanelEl.classList.add("hidden");
        return;
      }

      const snapshot = progression.getLevelTuningSnapshot();
      const selected = selectedBalanceTrack();
      const rows = balanceTuningTracks
        .map((track) => {
          const marker = track === selected ? ">" : " ";
          const value = snapshot.tracks[track] || 1;
          return `<div>${marker} ${track.padEnd(6, " ")}: x${value.toFixed(2)}</div>`;
        })
        .join("");

      balanceDebugPanelEl.classList.remove("hidden");
      balanceDebugPanelEl.innerHTML = `
        <div><strong>Balance Debug</strong> (${snapshot.profileId})</div>
        <div class="balance-debug-hint">B: Panel | [ ]: Waffe | - / +: Faktor | 0: Reset</div>
        <div class="balance-debug-rows">${rows}</div>
      `;
    }

    function toggleHitboxes() {
      state.debugHitboxes = !state.debugHitboxes;
      if (!state.debugHitboxes) {
        state.damageTexts = [];
      }
    }

    function debugBoostWeapons() {
      progression.debugBoostCurrentWeapons(5);
    }

    function toggleBalancePanel() {
      balanceDebug.visible = !balanceDebug.visible;
    }

    function isBalancePanelVisible() {
      return balanceDebug.visible;
    }

    function balanceTrackPrev() {
      cycleBalanceTrack(-1);
    }

    function balanceTrackNext() {
      cycleBalanceTrack(1);
    }

    function balanceTuneDown() {
      progression.adjustTrackLevelTuning(selectedBalanceTrack(), -balanceDebug.tuneStep);
    }

    function balanceTuneUp() {
      progression.adjustTrackLevelTuning(selectedBalanceTrack(), balanceDebug.tuneStep);
    }

    function balanceTuneReset() {
      progression.setTrackLevelTuning(selectedBalanceTrack(), 1);
    }

    function toggleShipInfo() {
      state.showShipInfo = !state.showShipInfo;
      if (shipInfoPanelEl) {
        shipInfoPanelEl.classList.toggle("hidden", !state.showShipInfo);
      }
    }

    function getPerformanceSnapshot() {
      const perf = state.perfCounters;
      const pct = (val) => ((val / (perf.frameTotal || 1)) * 100).toFixed(1);
      return {
        movement: `${perf.movement.toFixed(2)}ms (${pct(perf.movement)}%)`,
        combat: `${perf.combat.toFixed(2)}ms (${pct(perf.combat)}%)`,
        cleanup: `${perf.cleanup.toFixed(2)}ms (${pct(perf.cleanup)}%)`,
        frameTotal: `${perf.frameTotal.toFixed(2)}ms`,
      };
    }

    return {
      updateBalanceDebugPanel,
      toggleHitboxes,
      debugBoostWeapons,
      toggleBalancePanel,
      isBalancePanelVisible,
      balanceTrackPrev,
      balanceTrackNext,
      balanceTuneDown,
      balanceTuneUp,
      balanceTuneReset,
      toggleShipInfo,
      getPerformanceSnapshot,
    };
  }

  window.VoidDebugTools = {
    createDebugToolsSystem,
  };
})();
