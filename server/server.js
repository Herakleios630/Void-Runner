const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const port = Number.parseInt(process.env.PORT || "8080", 10);
const tickMs = 50;
const staleSeconds = 5;

const wss = new WebSocketServer({ port });
const clients = new Map();

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
    if ((now - (client.state.t || 0)) > staleSeconds) continue;
    result.push({
      id: client.id,
      name: client.name,
      x: client.state.x,
      y: client.state.y,
      vx: client.state.vx,
      vy: client.state.vy,
      angle: client.state.angle,
      hp: client.state.hp,
      maxHp: client.state.maxHp,
    });
  }
  return result;
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
    state: null,
  });

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
      client.roomId = typeof msg.roomId === "string" && msg.roomId.trim() ? msg.roomId.trim().slice(0, 32) : "alpha";
      client.name = typeof msg.name === "string" && msg.name.trim() ? msg.name.trim().slice(0, 24) : "Pilot";
      return;
    }

    if (msg.type === "state") {
      client.state = {
        t: Number.isFinite(msg.t) ? msg.t : (Date.now() / 1000),
        x: Number.isFinite(msg.x) ? msg.x : 0,
        y: Number.isFinite(msg.y) ? msg.y : 0,
        vx: Number.isFinite(msg.vx) ? msg.vx : 0,
        vy: Number.isFinite(msg.vy) ? msg.vy : 0,
        angle: Number.isFinite(msg.angle) ? msg.angle : 0,
        hp: Number.isFinite(msg.hp) ? msg.hp : null,
        maxHp: Number.isFinite(msg.maxHp) ? msg.maxHp : null,
      };
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });

  ws.on("error", () => {
    clients.delete(ws);
  });
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
