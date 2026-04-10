(function () {
  function createInputSystem(deps) {
    const {
      canvas,
      overlay,
      joystickAreaEl,
      joyBaseEl,
      joyKnobEl,
      input,
      state,
      WORLD,
      IS_COARSE_POINTER,
      initAudio,
      onTogglePause,
      onToggleAutoFire,
      onToggleMusic,
      onToggleHitboxes,
      onDebugBoostWeapons,
      onDebugTeleportNearWormhole,
      onToggleBalancePanel,
      isBalancePanelVisible,
      onBalanceTrackPrev,
      onBalanceTrackNext,
      onBalanceTuneDown,
      onBalanceTuneUp,
      onBalanceTuneReset,
      onToggleShipInfo,
      onOverlayAction,
    } = deps;

    function setKeyState(code, pressed) {
      if (code === "ArrowUp" || code === "KeyW") input.up = pressed;
      if (code === "ArrowDown" || code === "KeyS") input.down = pressed;
      if (code === "ArrowLeft" || code === "KeyA") input.left = pressed;
      if (code === "ArrowRight" || code === "KeyD") input.right = pressed;
      if (code === "Space") input.shooting = pressed;
    }

    function setAimFromClient(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = WORLD.width / rect.width;
      const scaleY = WORLD.height / rect.height;
      input.mouseX = (clientX - rect.left) * scaleX;
      input.mouseY = (clientY - rect.top) * scaleY;
    }

    function updateJoystickFromClient(clientX, clientY) {
      if (!joyBaseEl || !joyKnobEl) return;

      const rect = joyBaseEl.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const maxR = rect.width * 0.35;
      const mag = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(maxR, mag);
      const nx = (dx / mag) * clamped;
      const ny = (dy / mag) * clamped;

      joyKnobEl.style.transform = `translate(${nx}px, ${ny}px)`;
      input.axisX = nx / maxR;
      input.axisY = ny / maxR;
    }

    function resetJoystickInput() {
      input.axisX = 0;
      input.axisY = 0;
      state.joystickPointerId = null;
      if (joyKnobEl) {
        joyKnobEl.style.transform = "translate(0px, 0px)";
      }
    }

    function getPrimaryAimTouch(touches) {
      const rect = canvas.getBoundingClientRect();
      const splitX = rect.left + rect.width * 0.38;
      for (const t of touches) {
        if (t.clientX >= splitX) {
          return t;
        }
      }
      return null;
    }

    function setupTouchControls() {
      if (joystickAreaEl) {
        joystickAreaEl.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          initAudio();
          state.joystickPointerId = event.pointerId;
          joystickAreaEl.setPointerCapture(event.pointerId);
          updateJoystickFromClient(event.clientX, event.clientY);
        });

        joystickAreaEl.addEventListener("pointermove", (event) => {
          if (event.pointerId !== state.joystickPointerId) return;
          event.preventDefault();
          updateJoystickFromClient(event.clientX, event.clientY);
        });

        const clearJoystick = (event) => {
          if (event.pointerId !== state.joystickPointerId) return;
          event.preventDefault();
          resetJoystickInput();
        };

        joystickAreaEl.addEventListener("pointerup", clearJoystick);
        joystickAreaEl.addEventListener("pointercancel", clearJoystick);
        joystickAreaEl.addEventListener("lostpointercapture", clearJoystick);
      }

      canvas.addEventListener(
        "touchstart",
        (event) => {
          initAudio();
          const aimTouch = getPrimaryAimTouch(event.touches);
          if (aimTouch) {
            setAimFromClient(aimTouch.clientX, aimTouch.clientY);
            input.shooting = true;

            const now = state.realNow;
            if (now - state.lastAimTapAt <= 0.28) {
              input.rocketQueued = true;
            }
            state.lastAimTapAt = now;
          }
          event.preventDefault();
        },
        { passive: false },
      );

      canvas.addEventListener(
        "touchmove",
        (event) => {
          const aimTouch = getPrimaryAimTouch(event.touches);
          if (aimTouch) {
            setAimFromClient(aimTouch.clientX, aimTouch.clientY);
            input.shooting = true;
          } else {
            input.shooting = false;
          }
          event.preventDefault();
        },
        { passive: false },
      );

      const touchEndHandler = (event) => {
        const aimTouch = getPrimaryAimTouch(event.touches);
        input.shooting = Boolean(aimTouch);
        if (aimTouch) {
          setAimFromClient(aimTouch.clientX, aimTouch.clientY);
        }
        event.preventDefault();
      };

      canvas.addEventListener("touchend", touchEndHandler, { passive: false });
      canvas.addEventListener("touchcancel", touchEndHandler, { passive: false });
    }

    function setup() {
      setupTouchControls();

      window.addEventListener("keydown", (event) => {
        if ((event.code === "Escape" || event.code === "KeyP") && !event.repeat) {
          event.preventDefault();
          onTogglePause();
          return;
        }

        if (event.code === "KeyM" && !event.repeat) {
          onToggleMusic();
          return;
        }

        if (event.code === "KeyN" && !event.repeat && !IS_COARSE_POINTER) {
          onToggleAutoFire();
          return;
        }

        if (event.code === "KeyH" && !event.repeat) {
          onToggleHitboxes();
        }

        if (event.code === "KeyO" && !event.repeat) {
          onDebugBoostWeapons();
        }

        if (event.code === "KeyT" && !event.repeat) {
          onDebugTeleportNearWormhole();
        }

        if (event.code === "KeyB" && !event.repeat) {
          onToggleBalancePanel();
        }

        if (isBalancePanelVisible() && !event.repeat) {
          if (event.code === "BracketLeft") {
            onBalanceTrackPrev();
          }

          if (event.code === "BracketRight") {
            onBalanceTrackNext();
          }

          if (event.code === "Minus" || event.code === "NumpadSubtract") {
            onBalanceTuneDown();
          }

          if (event.code === "Equal" || event.code === "NumpadAdd") {
            onBalanceTuneUp();
          }

          if (event.code === "Digit0" || event.code === "Numpad0") {
            onBalanceTuneReset();
          }
        }

        if (event.code === "KeyI" && !event.repeat) {
          onToggleShipInfo();
        }

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyP", "Escape", "KeyM", "KeyN", "KeyO", "KeyT", "KeyB", "BracketLeft", "BracketRight", "Minus", "Equal", "NumpadAdd", "NumpadSubtract", "Digit0", "Numpad0"].includes(event.code)) {
          event.preventDefault();
        }

        setKeyState(event.code, true);
      });

      window.addEventListener("keyup", (event) => {
        setKeyState(event.code, false);
      });

      canvas.addEventListener("mousemove", (event) => {
        setAimFromClient(event.clientX, event.clientY);
        state.mouseInCanvas = true;
      });

      window.addEventListener("mousemove", (event) => {
        if (IS_COARSE_POINTER) return;
        setAimFromClient(event.clientX, event.clientY);
      });

      canvas.addEventListener("mouseenter", () => {
        state.mouseInCanvas = true;
      });

      canvas.addEventListener("mouseleave", () => {
        state.mouseInCanvas = false;
        if (!state.desktopAutoFire) {
          input.shooting = false;
        }
      });

      canvas.addEventListener("mousedown", (event) => {
        initAudio();
        if (event.button === 0) {
          input.shooting = true;
        }
        if (event.button === 2) {
          input.rocketQueued = true;
        }
      });

      canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });

      window.addEventListener("mouseup", (event) => {
        if (event.button === 0) {
          input.shooting = false;
        }
      });

      window.addEventListener("blur", () => {
        input.up = false;
        input.down = false;
        input.left = false;
        input.right = false;
        input.axisX = 0;
        input.axisY = 0;
        input.shooting = false;
        resetJoystickInput();
      });

      overlay.addEventListener("click", (event) => {
        const rawTarget = event.target;
        let actionNode = null;

        if (rawTarget instanceof Element) {
          actionNode = rawTarget.closest("[data-action]");
        } else if (rawTarget && rawTarget.parentElement) {
          actionNode = rawTarget.parentElement.closest("[data-action]");
        }

        if (!(actionNode instanceof HTMLElement)) return;

        onOverlayAction(actionNode);
      });
    }

    return {
      setup,
      resetJoystickInput,
    };
  }

  window.VoidInput = {
    createInputSystem,
  };
})();
