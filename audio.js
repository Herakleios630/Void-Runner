(function () {
  const audio = {
    ctx: null,
  };

  function initAudio() {
    if (audio.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
  }

  function playTone(freq, duration, type = "sine", volume = 0.03, slide = 1) {
    if (!audio.ctx) return;
    if (audio.ctx.state === "suspended") {
      audio.ctx.resume();
    }

    const now = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
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

  window.VoidAudio = {
    initAudio,
    playSfx,
  };
})();
