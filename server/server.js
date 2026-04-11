const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const port = Number.parseInt(process.env.PORT || "8080", 10);
const tickMs = 50;
const staleSeconds = 5;

const wss = new WebSocketServer({ port });
const clients = new Map();
const rooms = new Map();

function makeId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

function safeJsonParse(input) {
  try {
    if (typeof input === "string") return JSON.parse(input);
    if (Buffer.isBuffer(input)) return JSON.parse(input.toString("utf8"));
    return JSON.parse(String(input));
  } catch (err) {
    return null;
  }
}

function getRoomPlayers(roomId) {
  const result = [];
  const now = Date.now() / 1000;
  for (const client of clients.values()) {
    if (client.roomId !== roomId) continue;
    if (!client.state) continue;
    if ((now - (client.state.lastStateAt || 0)) > staleSeconds) continue;
    result.push({
      id: client.id,
      name: client.name,
      x: client.state.x,
      y: client.state.y,
      vx: client.state.vx,
      vy: client.state.vy,
      angle: client.state.angle,
      aimAngle: client.state.aimAngle,
      hp: client.state.hp,
      maxHp: client.state.maxHp,
    });
  }
  return result;
}

function ensureRoom(roomId) {
  const key = roomId || "alpha";
  let room = rooms.get(key);
  if (!room) {
    room = {
      roomId: key,
      hostId: null,
      phase: "lobby",
      runSequence: 0,
      config: null,
    };
    rooms.set(key, room);
  }
  return room;
}

function getRoomClientEntries(roomId) {
  const list = [];
  for (const entry of clients.values()) {
    if (entry.roomId === roomId) {
      list.push(entry);
    }
  }
  return list;
}

function findClientSocketById(roomId, clientId) {
  for (const [ws, entry] of clients.entries()) {
    if (entry.roomId !== roomId) continue;
    if (entry.id === clientId) return ws;
  }
  return null;
}

function sanitizePlayerAction(input) {
  if (!input || typeof input !== "object") return null;
  const kind = typeof input.kind === "string" ? input.kind.trim().slice(0, 16) : "";
  if (kind !== "cannon" && kind !== "rocket") return null;
  const aimWorldX = Number.isFinite(input.aimWorldX) ? input.aimWorldX : null;
  const aimWorldY = Number.isFinite(input.aimWorldY) ? input.aimWorldY : null;
  if (!Number.isFinite(aimWorldX) || !Number.isFinite(aimWorldY)) return null;
  return {
    kind,
    aimWorldX,
    aimWorldY,
  };
}

function normalizeRoomId(value) {
  if (typeof value !== "string") return "alpha";
  const safe = value.trim().slice(0, 32);
  return safe || "alpha";
}

function normalizePilotName(value) {
  if (typeof value !== "string") return "Pilot";
  const safe = value.trim().slice(0, 24);
  return safe || "Pilot";
}

function ensureRoomHost(roomId) {
  const room = ensureRoom(roomId);
  const roomClients = getRoomClientEntries(roomId);
  if (roomClients.length === 0) {
    rooms.delete(roomId);
    return null;
  }
  const hasHost = roomClients.some((entry) => entry.id === room.hostId);
  if (!hasHost) {
    room.hostId = roomClients[0].id;
  }
  return room;
}

function getRoomState(roomId) {
  const room = ensureRoomHost(roomId);
  if (!room) {
    return {
      roomId,
      hostId: null,
      phase: "lobby",
      players: [],
      canStart: false,
      runSequence: 0,
    };
  }

  const roomClients = getRoomClientEntries(roomId);
  const players = roomClients.map((entry) => ({
    id: entry.id,
    name: entry.name,
    ready: Boolean(entry.ready),
    connected: true,
  }));
  const readyCount = players.reduce((sum, p) => sum + (p.ready ? 1 : 0), 0);
  const canStart = players.length > 0 && readyCount === players.length;

  return {
    roomId,
    hostId: room.hostId,
    phase: room.phase,
    players,
    canStart,
    runSequence: room.runSequence,
    config: room.config,
  };
}

function broadcastRoomState(roomId) {
  const payload = {
    type: "room_state",
    ...getRoomState(roomId),
  };

  for (const [ws, entry] of clients.entries()) {
    if (entry.roomId !== roomId) continue;
    sendJson(ws, payload);
  }
}

function moveClientToRoom(client, nextRoomId) {
  const prevRoomId = client.roomId;
  client.roomId = normalizeRoomId(nextRoomId);
  client.ready = false;
  ensureRoom(client.roomId);
  ensureRoomHost(client.roomId);
  broadcastRoomState(client.roomId);
  if (prevRoomId && prevRoomId !== client.roomId) {
    ensureRoomHost(prevRoomId);
    broadcastRoomState(prevRoomId);
  }
}

function startRoomRun(roomId, requestedById) {
  const room = ensureRoom(roomId);
  const roomState = getRoomState(roomId);
  if (!roomState.hostId || requestedById !== roomState.hostId || !roomState.canStart) {
    return false;
  }

  room.phase = "running";
  room.config = null;
  room.runSequence += 1;

  for (const [ws, entry] of clients.entries()) {
    if (entry.roomId !== roomId) continue;
    sendJson(ws, {
      type: "room_started",
      roomId,
      runSequence: room.runSequence,
      startedAt: Date.now() / 1000,
    });
  }

  broadcastRoomState(roomId);
  return true;
}

function returnRoomToLobby(roomId, requestedById) {
  const room = ensureRoom(roomId);
  if (!room.hostId || requestedById !== room.hostId) {
    return false;
  }

  room.phase = "lobby";
  room.config = null;

  for (const entry of clients.values()) {
    if (entry.roomId !== roomId) continue;
    entry.ready = false;
  }

  for (const [ws, entry] of clients.entries()) {
    if (entry.roomId !== roomId) continue;
    sendJson(ws, {
      type: "room_lobby",
      roomId,
      at: Date.now() / 1000,
    });
  }

  broadcastRoomState(roomId);
  return true;
}

function returnRoomToMenu(roomId, requestedById) {
  const room = ensureRoom(roomId);
  if (!room.hostId || requestedById !== room.hostId) {
    return false;
  }

  room.phase = "menu";
  room.config = null;

  for (const entry of clients.values()) {
    if (entry.roomId !== roomId) continue;
    entry.ready = false;
  }

  for (const [ws, entry] of clients.entries()) {
    if (entry.roomId !== roomId) continue;
    sendJson(ws, {
      type: "room_menu",
      roomId,
      at: Date.now() / 1000,
    });
  }

  return true;
}

function applyRoomConfig(roomId, requestedById, payload = {}) {
  const room = ensureRoom(roomId);
  if (!room.hostId || requestedById !== room.hostId) {
    return false;
  }

  const difficultyId = typeof payload.difficultyId === "string" ? payload.difficultyId.trim().slice(0, 16) : "medium";
  const seed = Number.isFinite(payload.seed) && payload.seed > 0
    ? Math.floor(payload.seed)
    : (100000 + Math.floor(Math.random() * 900000000));

  room.config = {
    difficultyId: difficultyId || "medium",
    seed,
    updatedAt: Date.now() / 1000,
  };

  for (const [ws, entry] of clients.entries()) {
    if (entry.roomId !== roomId) continue;
    sendJson(ws, {
      type: "room_config",
      roomId,
      config: room.config,
    });
  }

  broadcastRoomState(roomId);
  return true;
}

function sendJson(ws, payload) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify(payload));
}

wss.on("connection", (ws) => {
  const id = makeId("p");
  clients.set(ws, {
    id,
    name: "Pilot",
    roomId: "alpha",
    ready: false,
    state: null,
  });

  ensureRoom("alpha");
  ensureRoomHost("alpha");

  sendJson(ws, {
    type: "welcome",
    selfId: id,
  });

  ws.on("message", (raw) => {
    const msg = safeJsonParse(raw);
    if (!msg || typeof msg.type !== "string") return;

    const client = clients.get(ws);
    if (!client) return;

    if (msg.type === "join") {
      client.name = normalizePilotName(msg.name);
      moveClientToRoom(client, msg.roomId);
      return;
    }

    if (msg.type === "ready") {
      client.ready = Boolean(msg.ready);
      broadcastRoomState(client.roomId);
      return;
    }

    if (msg.type === "start_room") {
      startRoomRun(client.roomId, client.id);
      return;
    }

    if (msg.type === "return_lobby") {
      returnRoomToLobby(client.roomId, client.id);
      return;
    }

    if (msg.type === "return_menu") {
      returnRoomToMenu(client.roomId, client.id);
      return;
    }

    if (msg.type === "room_config") {
      applyRoomConfig(client.roomId, client.id, msg);
      return;
    }

    if (msg.type === "world_state") {
      const room = ensureRoom(client.roomId);
      if (room.phase !== "running") return;
      if (!room.hostId || client.id !== room.hostId) return;

      const payload = {
        type: "world_state",
        roomId: client.roomId,
        t: Date.now() / 1000,
        world: msg.world && typeof msg.world === "object" ? msg.world : null,
      };

      for (const [peerWs, entry] of clients.entries()) {
        if (entry.roomId !== client.roomId) continue;
        sendJson(peerWs, payload);
      }
      return;
    }

    if (msg.type === "player_action") {
      const room = ensureRoom(client.roomId);
      if (room.phase !== "running") return;
      if (!room.hostId || client.id === room.hostId) return;

      const action = sanitizePlayerAction(msg.action);
      if (!action) return;

      const hostWs = findClientSocketById(client.roomId, room.hostId);
      if (!hostWs) return;

      sendJson(hostWs, {
        type: "player_action",
        roomId: client.roomId,
        senderId: client.id,
        action,
        t: Date.now() / 1000,
      });
      return;
    }

    if (msg.type === "state") {
      const nowSec = Date.now() / 1000;
      client.state = {
        t: Number.isFinite(msg.t) ? msg.t : 0,
        lastStateAt: nowSec,
        x: Number.isFinite(msg.x) ? msg.x : 0,
        y: Number.isFinite(msg.y) ? msg.y : 0,
        vx: Number.isFinite(msg.vx) ? msg.vx : 0,
        vy: Number.isFinite(msg.vy) ? msg.vy : 0,
        angle: Number.isFinite(msg.angle) ? msg.angle : 0,
        aimAngle: Number.isFinite(msg.aimAngle) ? msg.aimAngle : null,
        hp: Number.isFinite(msg.hp) ? msg.hp : null,
        maxHp: Number.isFinite(msg.maxHp) ? msg.maxHp : null,
      };
    }
  });

  ws.on("close", () => {
    const client = clients.get(ws);
    const roomId = client ? client.roomId : null;
    clients.delete(ws);
    if (roomId) {
      ensureRoomHost(roomId);
      broadcastRoomState(roomId);
    }
  });

  ws.on("error", () => {
    const client = clients.get(ws);
    const roomId = client ? client.roomId : null;
    clients.delete(ws);
    if (roomId) {
      ensureRoomHost(roomId);
      broadcastRoomState(roomId);
    }
  });

  broadcastRoomState("alpha");
});

setInterval(() => {
  const roomIds = new Set();
  for (const client of clients.values()) {
    roomIds.add(client.roomId || "alpha");
  }

  const roomSnapshots = new Map();
  for (const roomId of roomIds) {
    roomSnapshots.set(roomId, getRoomPlayers(roomId));
  }

  for (const [ws, client] of clients.entries()) {
    const players = roomSnapshots.get(client.roomId || "alpha") || [];
    sendJson(ws, {
      type: "snapshot",
      roomId: client.roomId,
      players,
    });
  }
}, tickMs);

console.log(`Void Runner multiplayer server listening on :${port}`);
