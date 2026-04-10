(function () {
  function parseBoolParam(value) {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
  }

  function createMultiplayerSystem(options = {}) {
    const query = new URLSearchParams(window.location.search || "");
    const enabledByQuery = parseBoolParam(query.get("mp"));
    const defaultPort = options.defaultPort || 8080;
    const defaultUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:${defaultPort}`;

    const state = {
      enabled: enabledByQuery,
      roomId: query.get("room") || "alpha",
      localName: query.get("name") || `pilot-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`,
      wsUrl: query.get("ws") || defaultUrl,
      ws: null,
      connected: false,
      selfId: null,
      remotePlayers: [],
      reconnectAt: 0,
      reconnectDelay: 2,
      sendAccumulator: 0,
      lastSentAt: 0,
    };

    function emitStatus() {
      if (typeof options.onStatusChange === "function") {
        options.onStatusChange({
          enabled: state.enabled,
          connected: state.connected,
          selfId: state.selfId,
          roomId: state.roomId,
          remoteCount: state.remotePlayers.length,
          wsUrl: state.wsUrl,
        });
      }
    }

    function applySnapshot(payload) {
      if (!payload || !Array.isArray(payload.players)) return;
      const remotes = [];
      for (const p of payload.players) {
        if (!p || !p.id || p.id === state.selfId) continue;
        remotes.push({
          id: p.id,
          name: p.name || "Pilot",
          x: Number.isFinite(p.x) ? p.x : 0,
          y: Number.isFinite(p.y) ? p.y : 0,
          vx: Number.isFinite(p.vx) ? p.vx : 0,
          vy: Number.isFinite(p.vy) ? p.vy : 0,
          angle: Number.isFinite(p.angle) ? p.angle : 0,
          hp: Number.isFinite(p.hp) ? p.hp : null,
          maxHp: Number.isFinite(p.maxHp) ? p.maxHp : null,
        });
      }
      state.remotePlayers = remotes;
      emitStatus();
    }

    function closeSocket() {
      if (!state.ws) return;
      try {
        state.ws.onopen = null;
        state.ws.onmessage = null;
        state.ws.onerror = null;
        state.ws.onclose = null;
        state.ws.close();
      } catch (err) {
        // Ignore close errors during shutdown/reconnect.
      }
      state.ws = null;
      state.connected = false;
      emitStatus();
    }

    function scheduleReconnect(nowSec) {
      if (!state.enabled) return;
      state.reconnectAt = nowSec + state.reconnectDelay;
      state.reconnectDelay = Math.min(10, state.reconnectDelay * 1.35);
    }

    function connect() {
      if (!state.enabled || state.ws) return;
      try {
        const ws = new WebSocket(state.wsUrl);
        state.ws = ws;

        ws.onopen = () => {
          state.connected = true;
          state.reconnectDelay = 2;
          emitStatus();
          ws.send(JSON.stringify({
            type: "join",
            roomId: state.roomId,
            name: state.localName,
          }));
        };

        ws.onmessage = (event) => {
          let msg = null;
          try {
            msg = JSON.parse(event.data);
          } catch (err) {
            return;
          }
          if (!msg || typeof msg !== "object") return;

          if (msg.type === "welcome") {
            state.selfId = msg.selfId || null;
            emitStatus();
            return;
          }

          if (msg.type === "snapshot") {
            applySnapshot(msg);
          }
        };

        ws.onerror = () => {
          state.connected = false;
          emitStatus();
        };

        ws.onclose = () => {
          closeSocket();
          scheduleReconnect(performance.now() / 1000);
        };
      } catch (err) {
        scheduleReconnect(performance.now() / 1000);
      }
    }

    function disconnect() {
      state.enabled = false;
      state.reconnectAt = 0;
      closeSocket();
      state.remotePlayers = [];
      emitStatus();
    }

    function update(dt, nowSec, ship) {
      if (!state.enabled) return;

      if (!state.ws && state.reconnectAt > 0 && nowSec >= state.reconnectAt) {
        state.reconnectAt = 0;
        connect();
      } else if (!state.ws && state.reconnectAt <= 0) {
        connect();
      }

      if (!state.connected || !state.ws || state.ws.readyState !== WebSocket.OPEN || !ship) {
        return;
      }

      state.sendAccumulator += Math.max(0, dt || 0);
      if (state.sendAccumulator < 0.05) return;
      state.sendAccumulator = 0;
      state.lastSentAt = nowSec;

      const payload = {
        type: "state",
        t: nowSec,
        x: Number.isFinite(ship.worldX) ? ship.worldX : 0,
        y: Number.isFinite(ship.worldY) ? ship.worldY : 0,
        vx: Number.isFinite(ship.vx) ? ship.vx : 0,
        vy: Number.isFinite(ship.vy) ? ship.vy : 0,
        angle: Number.isFinite(ship.angle) ? ship.angle : 0,
        hp: Number.isFinite(ship.hp) ? ship.hp : null,
        maxHp: Number.isFinite(ship.maxHp) ? ship.maxHp : null,
      };

      try {
        state.ws.send(JSON.stringify(payload));
      } catch (err) {
        closeSocket();
        scheduleReconnect(nowSec);
      }
    }

    function getRemotePlayers() {
      return state.remotePlayers;
    }

    if (state.enabled) {
      connect();
    }
    emitStatus();

    return {
      update,
      disconnect,
      getRemotePlayers,
      getStatus: () => ({
        enabled: state.enabled,
        connected: state.connected,
        selfId: state.selfId,
        roomId: state.roomId,
        remoteCount: state.remotePlayers.length,
        wsUrl: state.wsUrl,
      }),
    };
  }

  window.VoidMultiplayer = {
    createMultiplayerSystem,
  };
})();
