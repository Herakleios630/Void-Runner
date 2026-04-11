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
    const defaultHost = (window.location.hostname && window.location.hostname.trim()) || "localhost";
    const defaultUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${defaultHost}:${defaultPort}`;

    const state = {
      enabled: enabledByQuery,
      roomId: query.get("room") || "alpha",
      localName: query.get("name") || `pilot-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`,
      wsUrl: query.get("ws") || defaultUrl,
      ws: null,
      connected: false,
      selfId: null,
      remotePlayers: [],
      lobbyPlayers: [],
      hostId: null,
      roomPhase: "lobby",
      canStart: false,
      localReady: false,
      runSequence: 0,
      lastRoomConfigToken: null,
      worldState: null,
      incomingPlayerActions: [],
      lastWorldSentAt: 0,
      reconnectAt: 0,
      reconnectDelay: 2,
      sendAccumulator: 0,
      lastSentAt: 0,
      lastActionSentAt: 0,
    };

    function roomConfigToken(config) {
      if (!config || typeof config !== "object") return "";
      const d = config.difficultyId || "";
      const s = Number.isFinite(config.seed) ? config.seed : "";
      const u = Number.isFinite(config.updatedAt) ? config.updatedAt : "";
      return `${d}|${s}|${u}`;
    }

    function notifyRoomConfig(config) {
      if (!config || typeof options.onRoomConfig !== "function") return;
      const token = roomConfigToken(config);
      if (!token || token === state.lastRoomConfigToken) return;
      state.lastRoomConfigToken = token;
      options.onRoomConfig({
        roomId: state.roomId,
        config,
      });
    }

    function emitStatus() {
      if (typeof options.onStatusChange === "function") {
        options.onStatusChange({
          enabled: state.enabled,
          connected: state.connected,
          selfId: state.selfId,
          roomId: state.roomId,
          localName: state.localName,
          roomPhase: state.roomPhase,
          localReady: state.localReady,
          remoteCount: state.remotePlayers.length,
          wsUrl: state.wsUrl,
        });
      }
    }

    function emitLobby() {
      if (typeof options.onLobbyChange === "function") {
        options.onLobbyChange({
          roomId: state.roomId,
          hostId: state.hostId,
          phase: state.roomPhase,
          canStart: state.canStart,
          runSequence: state.runSequence,
          selfId: state.selfId,
          localReady: state.localReady,
          players: state.lobbyPlayers.slice(),
        });
      }
    }

    function applyRoomState(payload) {
      if (!payload || !Array.isArray(payload.players)) return;
      state.hostId = payload.hostId || null;
      state.roomPhase = typeof payload.phase === "string" ? payload.phase : "lobby";
      state.canStart = Boolean(payload.canStart);
      state.runSequence = Number.isFinite(payload.runSequence) ? payload.runSequence : state.runSequence;
      state.lobbyPlayers = payload.players.map((p) => ({
        id: p.id,
        name: p.name || "Pilot",
        ready: Boolean(p.ready),
        connected: p.connected !== false,
      }));

      const selfEntry = state.lobbyPlayers.find((p) => p.id === state.selfId);
      state.localReady = Boolean(selfEntry && selfEntry.ready);
      if (payload.config) {
        notifyRoomConfig(payload.config);
      }
      emitStatus();
      emitLobby();
    }

    function sanitizeRoomId(value) {
      if (typeof value !== "string") return "alpha";
      const safe = value.trim().slice(0, 32);
      return safe || "alpha";
    }

    function sanitizePilotName(value) {
      if (typeof value !== "string") return "Pilot";
      const safe = value.trim().slice(0, 24);
      return safe || "Pilot";
    }

    function sanitizeWsUrl(value) {
      if (typeof value !== "string") return state.wsUrl;
      const safe = value.trim();
      if (!safe) return state.wsUrl;
      if (!/^wss?:\/\//i.test(safe)) return state.wsUrl;
      return safe;
    }

    function applySnapshot(payload) {
      if (!payload || !Array.isArray(payload.players)) return;
      const now = performance.now() / 1000;
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
          aimAngle: Number.isFinite(p.aimAngle) ? p.aimAngle : null,
          hp: Number.isFinite(p.hp) ? p.hp : null,
          maxHp: Number.isFinite(p.maxHp) ? p.maxHp : null,
          seenAt: now,
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
            emitLobby();
            return;
          }

          if (msg.type === "room_state") {
            applyRoomState(msg);
            return;
          }

          if (msg.type === "room_started") {
            state.roomPhase = "running";
            state.runSequence = Number.isFinite(msg.runSequence) ? msg.runSequence : state.runSequence;
            state.incomingPlayerActions = [];
            emitStatus();
            emitLobby();
            if (typeof options.onRoomStarted === "function") {
              options.onRoomStarted({
                roomId: state.roomId,
                runSequence: state.runSequence,
              });
            }
            return;
          }

          if (msg.type === "room_lobby") {
            state.roomPhase = "lobby";
            state.localReady = false;
            state.incomingPlayerActions = [];
            emitStatus();
            emitLobby();
            if (typeof options.onRoomLobby === "function") {
              options.onRoomLobby({ roomId: state.roomId });
            }
            return;
          }

          if (msg.type === "room_menu") {
            state.roomPhase = "menu";
            state.localReady = false;
            state.incomingPlayerActions = [];
            emitStatus();
            emitLobby();
            if (typeof options.onRoomMenu === "function") {
              options.onRoomMenu({ roomId: state.roomId });
            }
            return;
          }

          if (msg.type === "room_config") {
            notifyRoomConfig(msg && msg.config);
            return;
          }

          if (msg.type === "world_state") {
            if (msg && msg.world && typeof msg.world === "object") {
              state.worldState = msg.world;
              if (typeof options.onWorldState === "function") {
                options.onWorldState({ roomId: state.roomId, world: state.worldState });
              }
            }
            return;
          }

          if (msg.type === "player_action") {
            if (msg && msg.action && typeof msg.action === "object" && typeof msg.senderId === "string") {
              state.incomingPlayerActions.push({
                senderId: msg.senderId,
                action: msg.action,
                t: Number.isFinite(msg.t) ? msg.t : 0,
              });
            }
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
      state.lobbyPlayers = [];
      state.hostId = null;
      state.roomPhase = "lobby";
      state.canStart = false;
      state.localReady = false;
      state.lastRoomConfigToken = null;
      state.worldState = null;
      state.incomingPlayerActions = [];
      emitStatus();
      emitLobby();
    }

    function configure(next = {}) {
      const prevEnabled = state.enabled;
      const nextEnabled = next.enabled === undefined ? state.enabled : Boolean(next.enabled);
      const nextRoom = next.roomId === undefined ? state.roomId : sanitizeRoomId(next.roomId);
      const nextName = next.localName === undefined ? state.localName : sanitizePilotName(next.localName);
      const nextUrl = next.wsUrl === undefined ? state.wsUrl : sanitizeWsUrl(next.wsUrl);

      const connectionChanged = nextRoom !== state.roomId || nextName !== state.localName || nextUrl !== state.wsUrl;

      state.roomId = nextRoom;
      state.localName = nextName;
      state.wsUrl = nextUrl;
      state.enabled = nextEnabled;

      if (!nextEnabled) {
        state.reconnectAt = 0;
        state.remotePlayers = [];
        state.lobbyPlayers = [];
        state.hostId = null;
        state.roomPhase = "lobby";
        state.canStart = false;
        state.localReady = false;
        state.lastRoomConfigToken = null;
        state.worldState = null;
        state.incomingPlayerActions = [];
        closeSocket();
        emitStatus();
        emitLobby();
        return;
      }

      if (!prevEnabled || connectionChanged) {
        state.selfId = null;
        state.remotePlayers = [];
        state.lobbyPlayers = [];
        state.hostId = null;
        state.roomPhase = "lobby";
        state.canStart = false;
        state.localReady = false;
        state.lastRoomConfigToken = null;
        state.worldState = null;
        state.incomingPlayerActions = [];
        state.reconnectAt = 0;
        closeSocket();
        connect();
      }

      emitStatus();
      emitLobby();
    }

    function setReady(ready) {
      state.localReady = Boolean(ready);
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
        emitStatus();
        emitLobby();
        return;
      }
      try {
        state.ws.send(JSON.stringify({
          type: "ready",
          ready: state.localReady,
        }));
      } catch (err) {
        closeSocket();
      }
      emitStatus();
      emitLobby();
    }

    function requestRoomStart() {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;
      try {
        state.ws.send(JSON.stringify({ type: "start_room" }));
        return true;
      } catch (err) {
        closeSocket();
        return false;
      }
    }

    function requestReturnLobby() {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;
      try {
        state.ws.send(JSON.stringify({ type: "return_lobby" }));
        return true;
      } catch (err) {
        closeSocket();
        return false;
      }
    }

    function requestReturnMenu() {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;
      try {
        state.ws.send(JSON.stringify({ type: "return_menu" }));
        return true;
      } catch (err) {
        closeSocket();
        return false;
      }
    }

    function sendRoomConfig(config = {}) {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;
      try {
        state.ws.send(JSON.stringify({
          type: "room_config",
          difficultyId: config.difficultyId,
          seed: config.seed,
        }));
        return true;
      } catch (err) {
        closeSocket();
        return false;
      }
    }

    function getLobbyState() {
      return {
        roomId: state.roomId,
        hostId: state.hostId,
        phase: state.roomPhase,
        canStart: state.canStart,
        runSequence: state.runSequence,
        selfId: state.selfId,
        localReady: state.localReady,
        players: state.lobbyPlayers.slice(),
      };
    }

    function isHost() {
      return Boolean(state.selfId && state.hostId && state.selfId === state.hostId);
    }

    function shouldMirrorWorld() {
      return Boolean(state.enabled && state.roomPhase === "running" && state.selfId && state.hostId && state.selfId !== state.hostId);
    }

    function sendPlayerAction(action = {}) {
      if (!state.enabled || !state.selfId || isHost()) return false;
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;
      if (state.roomPhase !== "running") return false;
      if (!action || typeof action !== "object") return false;

      try {
        const now = performance.now() / 1000;
        if (action.kind === "cannon" && (now - state.lastActionSentAt) < 0.06) {
          return false;
        }
        state.lastActionSentAt = now;
        state.ws.send(JSON.stringify({
          type: "player_action",
          action,
          t: now,
        }));
        return true;
      } catch (err) {
        closeSocket();
        return false;
      }
    }

    function consumePlayerActions() {
      if (!isHost()) return [];
      if (state.incomingPlayerActions.length <= 0) return [];
      const list = state.incomingPlayerActions.slice();
      state.incomingPlayerActions.length = 0;
      return list;
    }

    function sendWorldState(world, nowSec = 0) {
      if (!state.enabled || !isHost()) return false;
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;

      const now = Number.isFinite(nowSec) ? nowSec : performance.now() / 1000;
      if ((now - state.lastWorldSentAt) < 0.09) return false;
      state.lastWorldSentAt = now;

      try {
        state.ws.send(JSON.stringify({
          type: "world_state",
          world,
        }));
        return true;
      } catch (err) {
        closeSocket();
        return false;
      }
    }

    function getWorldState() {
      return state.worldState;
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
        angle: Math.atan2(Number.isFinite(ship.vy) ? ship.vy : 0, (Number.isFinite(ship.vx) ? ship.vx : 0) || 0.001),
        aimAngle: Number.isFinite(ship.aimAngle) ? ship.aimAngle : null,
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
      const now = performance.now() / 1000;
      return state.remotePlayers.map((p) => {
        const age = Math.max(0, Math.min(0.12, now - (Number.isFinite(p.seenAt) ? p.seenAt : now)));
        return {
          ...p,
          x: (Number.isFinite(p.x) ? p.x : 0) + (Number.isFinite(p.vx) ? p.vx : 0) * age,
          y: (Number.isFinite(p.y) ? p.y : 0) + (Number.isFinite(p.vy) ? p.vy : 0) * age,
        };
      });
    }

    if (state.enabled) {
      connect();
    }
    emitStatus();

    return {
      update,
      configure,
      setReady,
      requestRoomStart,
      requestReturnLobby,
      requestReturnMenu,
      sendRoomConfig,
      sendPlayerAction,
      sendWorldState,
      disconnect,
      getRemotePlayers,
      getLobbyState,
      getWorldState,
      consumePlayerActions,
      isHost,
      shouldMirrorWorld,
      getStatus: () => ({
        enabled: state.enabled,
        connected: state.connected,
        selfId: state.selfId,
        roomId: state.roomId,
        localName: state.localName,
        roomPhase: state.roomPhase,
        localReady: state.localReady,
        remoteCount: state.remotePlayers.length,
        wsUrl: state.wsUrl,
      }),
    };
  }

  window.VoidMultiplayer = {
    createMultiplayerSystem,
  };
})();
