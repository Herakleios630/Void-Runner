(function () {
  const MUSIC_TARGET_VOLUME = 0.19;
  let musicVolumeScale = 1.0;
  let sfxVolumeScale = 1.0;

  const audio = {
    ctx: null,
    music: {
      enabled: true,
      category: null,
      index: -1,
      active: null,
      fading: null,
      gainA: null,
      gainB: null,
      transitionMs: 1800,
      pauseToken: null,
      gestureHooksInstalled: false,
      pendingCategory: null,
      tracks: {
        menu: [
          "assets/music/Title.mp3",
          "assets/music/Title 2.mp3",
        ],
        game: [
          "assets/music/Ambient.mp3",
          "assets/music/Ambient 2.mp3",
          "assets/music/Void Drift.mp3",
          "assets/music/Void Drift v2.mp3",
          "assets/music/Runner of the Void.mp3",
          "assets/music/Nebula Veil.mp3",
          "assets/music/Nebula Veil v2.mp3",
        ],
      },
    },
  };

  function ensureMusicNodes() {
    if (!audio.ctx) return false;
    if (audio.music.gainA && audio.music.gainB) return true;

    const gA = audio.ctx.createGain();
    const gB = audio.ctx.createGain();
    gA.gain.value = 0;
    gB.gain.value = 0;
    gA.connect(audio.ctx.destination);
    gB.connect(audio.ctx.destination);
    audio.music.gainA = gA;
    audio.music.gainB = gB;
    return true;
  }

  function pickNextTrack(category) {
    const list = audio.music.tracks[category] || [];
    if (list.length === 0) return null;
    if (list.length === 1) {
      audio.music.index = 0;
      return list[0];
    }

    let next = Math.floor(Math.random() * list.length);
    if (next === audio.music.index) {
      next = (next + 1) % list.length;
    }
    audio.music.index = next;
    return list[next];
  }

  function createTrack(path, targetGainNode) {
    const el = new Audio(path);
    el.preload = "auto";
    if (window.location.protocol !== "file:") {
      el.crossOrigin = "anonymous";
    }
    el.loop = false;
    const source = audio.ctx.createMediaElementSource(el);
    source.connect(targetGainNode);
    return {
      el,
      source,
      gain: targetGainNode,
      path,
    };
  }

  function installGestureResumeHooks() {
    if (audio.music.gestureHooksInstalled) return;
    audio.music.gestureHooksInstalled = true;

    const onGesture = () => {
      if (!audio.ctx) initAudio();
      if (!audio.ctx) return;
      if (audio.ctx.state === "suspended") {
        audio.ctx.resume().finally(() => {
          if (!audio.music.active && (audio.music.pendingCategory || audio.music.category)) {
            playMusicCategory(audio.music.pendingCategory || audio.music.category);
          }
        });
        return;
      }
      if (!audio.music.active && (audio.music.pendingCategory || audio.music.category)) {
        playMusicCategory(audio.music.pendingCategory || audio.music.category);
      }
    };

    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture, { passive: true });
    window.addEventListener("touchstart", onGesture, { passive: true });
  }

  function stopTrack(track) {
    if (!track) return;
    try {
      if (track.fadeTimer) {
        clearInterval(track.fadeTimer);
        track.fadeTimer = null;
      }
      track.el.pause();
      track.el.currentTime = 0;
      track.el.src = "";
      track.el.load();
    } catch (_err) {
      // ignore
    }
  }

  function fadeTrackVolume(track, from, to, durationMs, onDone) {
    if (!track || !track.el) {
      if (typeof onDone === "function") onDone();
      return;
    }
    const el = track.el;
    const start = Math.max(0, Math.min(1, Number.isFinite(from) ? from : 0));
    const end = Math.max(0, Math.min(1, Number.isFinite(to) ? to : 0));
    const duration = Math.max(40, Math.floor(durationMs));
    const t0 = performance.now();

    if (track.fadeTimer) {
      clearInterval(track.fadeTimer);
      track.fadeTimer = null;
    }

    try {
      el.volume = start;
    } catch (_err) {
      // ignore
    }

    track.fadeTimer = setInterval(() => {
      const elapsed = performance.now() - t0;
      const p = Math.max(0, Math.min(1, elapsed / duration));
      const v = start + (end - start) * p;
      try {
        el.volume = Math.max(0, Math.min(1, v));
      } catch (_err) {
        // ignore
      }

      if (p >= 1) {
        clearInterval(track.fadeTimer);
        track.fadeTimer = null;
        if (typeof onDone === "function") onDone();
      }
    }, 40);
  }

  function createFallbackTrack(path) {
    const el = new Audio(path);
    el.preload = "auto";
    el.loop = false;
    el.muted = false;
    el.volume = 0;
    return {
      el,
      source: null,
      gain: null,
      path,
      fallback: true,
      fadeTimer: null,
    };
  }

  function shouldForceHtmlAudioMusic() {
    return window.location.protocol === "file:";
  }

  function crossfadeToFallback(path, category) {
    if (!path) return;
    const fadeMs = Math.max(250, audio.music.transitionMs);
    const from = audio.music.active;
    const to = createFallbackTrack(path);

    to.el.addEventListener("error", () => {
      if (audio.music.active !== to) return;
      const nextPath = pickNextTrack(category);
      if (nextPath && nextPath !== to.path) {
        crossfadeToFallback(nextPath, category);
      }
    });

    to.el.addEventListener("ended", () => {
      if (audio.music.active !== to || audio.music.category !== category) return;
      const nextPath = pickNextTrack(category);
      crossfadeTo(nextPath, category);
    });

    audio.music.active = to;
    audio.music.category = category;
    try {
      to.el.currentTime = 0;
      to.el.volume = 0;
      to.el.muted = false;
    } catch (_err) {
      // ignore
    }
    to.el.play().then(() => {
      audio.music.pendingCategory = null;
      fadeTrackVolume(to, 0, MUSIC_TARGET_VOLUME * musicVolumeScale, fadeMs);

      if (from && from !== to) {
        const fromVol = Number.isFinite(from.el?.volume) ? from.el.volume : 0.35;
        fadeTrackVolume(from, fromVol, 0, fadeMs, () => stopTrack(from));
      }
    }).catch(() => {
      stopTrack(to);
      if (audio.music.active === to) {
        audio.music.active = null;
      }
      audio.music.pendingCategory = category;
    });
  }

  function crossfadeTo(path, category) {
    if (!audio.ctx || !path) return;

    if (shouldForceHtmlAudioMusic()) {
      crossfadeToFallback(path, category);
      return;
    }

    if (!ensureMusicNodes()) {
      crossfadeToFallback(path, category);
      return;
    }

    let to;
    const now = audio.ctx.currentTime;
    const fadeSeconds = Math.max(0.25, audio.music.transitionMs / 1000);
    const from = audio.music.active;
    const toGain = from && from.gain === audio.music.gainA ? audio.music.gainB : audio.music.gainA;

    try {
      to = createTrack(path, toGain);
    } catch (_err) {
      crossfadeToFallback(path, category);
      return;
    }

    try {
      to.gain.gain.cancelScheduledValues(now);
      to.gain.gain.setValueAtTime(0.0001, now);
      to.gain.gain.exponentialRampToValueAtTime(MUSIC_TARGET_VOLUME * musicVolumeScale, now + fadeSeconds);
    } catch (_err) {
      stopTrack(to);
      crossfadeToFallback(path, category);
      return;
    }

    if (from && from.gain) {
      from.gain.gain.cancelScheduledValues(now);
      from.gain.gain.setValueAtTime(Math.max(0.0001, from.gain.gain.value || 0.2), now);
      from.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
      audio.music.fading = from;
      setTimeout(() => {
        if (audio.music.fading === from) {
          stopTrack(from);
          audio.music.fading = null;
        }
      }, Math.ceil((fadeSeconds + 0.06) * 1000));
    } else if (from) {
      stopTrack(from);
    }

    to.el.addEventListener("ended", () => {
      if (audio.music.active !== to || audio.music.category !== category) return;
      const nextPath = pickNextTrack(category);
      crossfadeTo(nextPath, category);
    });

    audio.music.active = to;
    audio.music.category = category;
    to.el.play().then(() => {
      audio.music.pendingCategory = null;
    }).catch(() => {
      // autoplay may still be blocked until user gesture
      stopTrack(to);
      if (audio.music.active === to) {
        audio.music.active = null;
      }
      audio.music.pendingCategory = category;
    });
  }

  function playMusicCategory(category) {
    if (!audio.music.enabled) return;
    if (!audio.ctx) initAudio();
    if (!audio.ctx) return;
    if (audio.ctx.state === "suspended") {
      audio.music.pendingCategory = category;
      audio.ctx.resume().then(() => {
        if (!audio.music.active && audio.music.pendingCategory === category) {
          playMusicCategory(category);
        }
      }).catch(() => {
        // keep pending category and wait for next user gesture
      });
      return;
    }

    if (audio.music.category === category && audio.music.active) return;
    const nextPath = pickNextTrack(category);
    crossfadeTo(nextPath, category);
  }

  function setMusicEnabled(enabled) {
    audio.music.enabled = Boolean(enabled);
    if (!audio.music.enabled && audio.music.active) {
      stopTrack(audio.music.active);
      audio.music.active = null;
      audio.music.category = null;
      audio.music.pendingCategory = null;
      return;
    }

    if (audio.music.enabled && !audio.music.active && (audio.music.pendingCategory || audio.music.category)) {
      playMusicCategory(audio.music.pendingCategory || audio.music.category);
    }
  }

  function getMusicEnabled() {
    return Boolean(audio.music.enabled);
  }

  function toggleMusicEnabled() {
    setMusicEnabled(!audio.music.enabled);
    return audio.music.enabled;
  }

  function initAudio() {
    installGestureResumeHooks();
    if (audio.ctx) {
      if (audio.ctx.state === "suspended") {
        audio.ctx.resume().finally(() => {
          if (!audio.music.active && (audio.music.pendingCategory || audio.music.category)) {
            playMusicCategory(audio.music.pendingCategory || audio.music.category);
          }
        });
        return;
      }
      if (!audio.music.active && (audio.music.pendingCategory || audio.music.category)) {
        playMusicCategory(audio.music.pendingCategory || audio.music.category);
      }
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    if (!audio.music.active && (audio.music.pendingCategory || audio.music.category)) {
      playMusicCategory(audio.music.pendingCategory || audio.music.category);
    }
  }

  function playTone(freq, duration, type = "sine", volume = 0.03, slide = 1) {
    if (!audio.ctx) return;
    if (audio.ctx.state === "suspended") {
      audio.ctx.resume();
    }

    const now = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    const scaledVolume = Math.max(0.0001, volume * sfxVolumeScale);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(scaledVolume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(audio.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playSfx(type) {
    if (type === "cannon") {
      playTone(680, 0.06, "square", 0.02, 1.15);
    } else if (type === "laser") {
      playTone(980, 0.07, "sawtooth", 0.02, 0.92);
    } else if (type === "plasma") {
      // Smoother plasma burst: soft hiss + warm descending body.
      playTone(760, 0.03, "triangle", 0.011, 0.9);
      setTimeout(() => playTone(520, 0.08, "sawtooth", 0.019, 0.78), 6);
      setTimeout(() => playTone(340, 0.14, "sine", 0.021, 0.62), 18);
    } else if (type === "rocket") {
      playTone(150, 0.18, "sawtooth", 0.035, 0.7);
    } else if (type === "explosion") {
      playTone(120, 0.2, "triangle", 0.04, 0.45);
    } else if (type === "shieldHit") {
      playTone(350, 0.2, "sine", 0.045, 0.6);
    } else if (type === "shieldReady") {
      playTone(430, 0.09, "sine", 0.03, 1.35);
    } else if (type === "upgrade") {
      playTone(520, 0.09, "triangle", 0.03, 1.2);
      setTimeout(() => playTone(700, 0.1, "triangle", 0.025, 1.1), 65);
    } else if (type === "levelup") {
      playTone(420, 0.12, "triangle", 0.03, 1.25);
      setTimeout(() => playTone(620, 0.14, "triangle", 0.03, 1.1), 90);
    } else if (type === "warning") {
      playTone(260, 0.1, "square", 0.03, 1.2);
    }
  }

  function setMusicVolume(v) {
    musicVolumeScale = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
    const target = MUSIC_TARGET_VOLUME * musicVolumeScale;
    const track = audio.music.active;
    if (track && track.fallback) {
      try { track.el.volume = Math.max(0, Math.min(1, target)); } catch (_) {}
    } else if (track && track.gain) {
      try {
        const now = audio.ctx ? audio.ctx.currentTime : 0;
        track.gain.gain.setValueAtTime(Math.max(0.0001, track.gain.gain.value || target), now);
        track.gain.gain.linearRampToValueAtTime(Math.max(0.0001, target), now + 0.4);
      } catch (_) {}
    }
  }

  function getMusicVolume() {
    return musicVolumeScale;
  }

  function setSfxVolume(v) {
    sfxVolumeScale = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
  }

  function getSfxVolume() {
    return sfxVolumeScale;
  }

  window.VoidAudio = {
    initAudio,
    playSfx,
    playMusicCategory,
    setMusicEnabled,
    getMusicEnabled,
    toggleMusicEnabled,
    setMusicVolume,
    getMusicVolume,
    setSfxVolume,
    getSfxVolume,
  };
})();
