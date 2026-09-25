import { parseRoleCounts } from "../../src/lib/game/roles.js";
import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { Player } from "./game-state.js";
import { RoomManager, type Room } from "./room-manager.js";
import type { ServerMessage } from "../../src/lib/game/types.js";
type Session =
  | { kind: "lobby" }
  | ({ room: Room } & (
      { kind: "admin" } | { kind: "player"; player: Player } | { kind: "guest" }
    ));
export function attachGameServer(server: Server, rooms = new RoomManager()) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const sessions = new Map<WebSocket, Session>();
  const living = new Set<WebSocket>();
  const send = (ws: WebSocket, message: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };
  const broadcast = (room: Room) => {
    const game = room.game;
    for (const ws of room.clients) {
      const s = sessions.get(ws);
      if (!s || s.kind === "lobby") continue;
      send(ws, {
        type: "state",
        view:
          s.kind === "admin"
            ? game.adminView()
            : s.kind === "player"
              ? game.playerView(s.player)
              : { kind: "guest", closed: game.status !== "waiting" },
      });
    }
  };
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws") return;
    try {
      if (
        !req.headers.origin ||
        new URL(req.headers.origin).host !== req.headers.host
      ) {
        socket.destroy();
        return;
      }
    } catch {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });
  wss.on("connection", (ws) => {
    living.add(ws);
    ws.on("pong", () => living.add(ws));
    let count = 0;
    let windowStart = Date.now();
    const helloTimeout = setTimeout(() => {
      if (!sessions.has(ws)) ws.close(1008, "Identificação necessária");
    }, 10000);
    ws.on("message", (raw) => {
      try {
        if (Date.now() - windowStart > 1000) {
          count = 0;
          windowStart = Date.now();
        }
        if (++count > 30) throw new Error("Muitas ações. Aguarde um instante.");
        const m = JSON.parse(raw.toString());
        if (!m || typeof m !== "object" || Array.isArray(m))
          throw new Error("Mensagem inválida.");
        const s = sessions.get(ws);
        if (m.type === "hello" && !s) {
          clearTimeout(helloTimeout);
          if (m.roomCode === undefined) {
            sessions.set(ws, { kind: "lobby" });
            send(ws, { type: "state", view: { kind: "lobby" } });
            return;
          }
          const room = rooms.get(m.roomCode);
          if (!room) {
            sessions.set(ws, { kind: "lobby" });
            send(ws, { type: "state", view: { kind: "missing" } });
            return;
          }
          const game = room.game;
          rooms.connect(room, ws);
          if (game.adminToken && m.adminToken === game.adminToken)
            sessions.set(ws, { kind: "admin", room });
          else {
            const player = game.players.find((p) => p.token === m.playerToken);
            if (player) {
              player.connected = true;
              sessions.set(ws, { kind: "player", player, room });
            } else sessions.set(ws, { kind: "guest", room });
          }
          game.tick();
          broadcast(room);
          return;
        }
        if (m.type === "create-room" && s?.kind === "lobby") {
          const room = rooms.create(parseRoleCounts(m.roleCounts));
          rooms.connect(room, ws);
          sessions.set(ws, { kind: "admin", room });
          send(ws, {
            type: "identity",
            roomCode: room.code,
            kind: "admin",
            token: room.game.adminToken!,
          });
          broadcast(room);
          return;
        }
        if (!s || s.kind === "lobby")
          throw new Error("Entre em uma sala para jogar.");
        const { room } = s;
        const game = room.game;
        if (game.tick()) broadcast(room);
        if (m.type === "join" && s.kind === "guest") {
          const player = game.join(m.name);
          sessions.set(ws, { kind: "player", player, room });
          send(ws, {
            type: "identity",
            roomCode: room.code,
            kind: "player",
            token: player.token,
            name: player.name,
          });
        } else if (s?.kind === "admin" && m.type === "draw") game.draw();
        else if (s?.kind === "admin" && m.type === "restart") game.restart();
        else if (s?.kind === "admin" && m.type === "expel-player") {
          if (game.status !== "waiting")
            throw new Error(
              "Jogadores só podem ser expulsos antes do sorteio.",
            );
          const player = game.removePlayer(m.playerId);
          for (const client of room.clients) {
            const session = sessions.get(client);
            if (session?.kind === "player" && session.player === player) {
              sessions.set(client, { kind: "guest", room });
              send(client, {
                type: "identity-reset",
                roomCode: room.code,
                kind: "player",
              });
            }
          }
        } else if (s?.kind === "admin" && m.type === "close-room") {
          rooms.close(room);
          for (const client of room.clients) {
            sessions.set(client, { kind: "lobby" });
            send(client, { type: "room-closed", roomCode: room.code });
          }
          room.clients.clear();
          return;
        } else if (s?.kind === "player" && m.type === "day-choice")
          game.dayChoice(s.player, m.choice);
        else if (s?.kind === "player" && m.type === "day-vote")
          game.dayVote(s.player, m.targetId);
        else if (s?.kind === "admin" && m.type === "resolve-assassins")
          throw new Error(
            "Os votos dos Assassinos são resolvidos automaticamente pelo sorteio.",
          );
        else if (s?.kind === "admin" && m.type === "wake") game.wake();
        else if (s?.kind === "player" && m.type === "act")
          game.act(s.player, m.targetId);
        else if (s?.kind === "player" && m.type === "pass") game.pass(s.player);
        else throw new Error("Você não tem permissão para esta ação.");
        broadcast(room);
      } catch (error) {
        send(ws, {
          type: "error",
          message:
            error instanceof SyntaxError
              ? "Mensagem inválida."
              : error instanceof Error
                ? error.message
                : "Não foi possível realizar a ação.",
        });
      }
    });
    ws.on("error", () => ws.terminate());
    ws.on("close", () => {
      clearTimeout(helloTimeout);
      const s = sessions.get(ws);
      sessions.delete(ws);
      living.delete(ws);
      if (!s || s.kind === "lobby") return;
      rooms.disconnect(s.room, ws);
      if (s?.kind === "player")
        s.player.connected = [...s.room.clients].some((client) => {
          const other = sessions.get(client);
          return other?.kind === "player" && other.player === s.player;
        });
      broadcast(s.room);
    });
  });
  const dayTimer = setInterval(() => {
    for (const room of rooms.rooms.values()) {
      if (room.game.status === "day" && room.game.day?.phase === "discussion") {
        room.game.tick();
        broadcast(room);
      }
    }
  }, 1000);
  dayTimer.unref();
  const cleanup = setInterval(() => rooms.sweep(), 60_000);
  cleanup.unref();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!living.has(ws)) {
        ws.terminate();
        continue;
      }
      living.delete(ws);
      ws.ping();
    }
  }, 15000);
  heartbeat.unref();
  wss.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(dayTimer);
    clearInterval(cleanup);
  });
  return { rooms, wss };
}
