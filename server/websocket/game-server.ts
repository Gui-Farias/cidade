import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { Game, type Player } from "./game-state.js";
import type { ServerMessage } from "../../src/lib/game/types.js";
type Session =
  { kind: "admin" } | { kind: "player"; player: Player } | { kind: "guest" };
export function attachGameServer(server: Server, game = new Game()) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const sessions = new Map<WebSocket, Session>();
  const living = new Set<WebSocket>();
  let adminClaimRequired = false;
  const send = (ws: WebSocket, message: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };
  const broadcast = () => {
    for (const [ws, s] of sessions)
      send(ws, {
        type: "state",
        view:
          s.kind === "admin"
            ? game.adminView()
            : s.kind === "player"
              ? game.playerView(s.player)
              : { kind: "guest", closed: game.status !== "waiting" },
      });
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
        if (game.tick()) broadcast();
        const s = sessions.get(ws);
        if (m.type === "hello" && !s) {
          clearTimeout(helloTimeout);
          if (!game.adminToken && !adminClaimRequired) {
            game.adminToken = randomUUID();
            sessions.set(ws, { kind: "admin" });
            send(ws, {
              type: "identity",
              kind: "admin",
              token: game.adminToken,
            });
          } else if (m.adminToken === game.adminToken)
            sessions.set(ws, { kind: "admin" });
          else {
            const player = game.players.find((p) => p.token === m.playerToken);
            if (player) {
              player.connected = true;
              sessions.set(ws, { kind: "player", player });
            } else sessions.set(ws, { kind: "guest" });
          }
        } else if (m.type === "join" && s?.kind === "guest") {
          const player = game.join(m.name);
          sessions.set(ws, { kind: "player", player });
          send(ws, {
            type: "identity",
            kind: "player",
            token: player.token,
            name: player.name,
          });
        } else if (s?.kind === "admin" && m.type === "draw") game.draw();
        else if (s?.kind === "admin" && m.type === "restart") game.restart();
        else if (s?.kind === "admin" && m.type === "expel-player") {
          if (game.status !== "waiting")
            throw new Error("Jogadores só podem ser expulsos antes do sorteio.");
          const player = game.removePlayer(m.playerId);
          for (const [client, session] of sessions) {
            if (session.kind === "player" && session.player === player) {
              sessions.set(client, { kind: "guest" });
              send(client, { type: "identity-reset", kind: "player" });
            }
          }
        } else if (s?.kind === "admin" && m.type === "leave-admin") {
          if (game.status !== "waiting")
            throw new Error("O Narrador só pode sair antes do sorteio.");
          game.adminToken = null;
          adminClaimRequired = true;
          sessions.set(ws, { kind: "guest" });
          send(ws, { type: "identity-reset", kind: "admin" });
        } else if (s?.kind === "player" && m.type === "claim-admin") {
          if (game.status !== "waiting")
            throw new Error("O Narrador só pode ser escolhido antes do sorteio.");
          if (game.adminToken) throw new Error("Já existe um Narrador na sala.");
          const player = game.removePlayer(s.player.id);
          for (const [client, session] of sessions) {
            if (
              client !== ws &&
              session.kind === "player" &&
              session.player === player
            ) {
              sessions.set(client, { kind: "guest" });
              send(client, { type: "identity-reset", kind: "player" });
            }
          }
          game.adminToken = randomUUID();
          adminClaimRequired = false;
          sessions.set(ws, { kind: "admin" });
          send(ws, { type: "identity-reset", kind: "player" });
          send(ws, {
            type: "identity",
            kind: "admin",
            token: game.adminToken,
          });
        } else if (s?.kind === "admin" && m.type === "reset") {
          game.reset();
          for (const [client, session] of sessions) {
            if (session.kind === "player")
              sessions.set(client, { kind: "guest" });
          }
        } else if (s?.kind === "admin" && m.type === "resolve-city")
          game.resolveCity(m.targetId);
        else if (s?.kind === "player" && m.type === "day-choice")
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
        broadcast();
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
      if (s?.kind === "player")
        s.player.connected = [...sessions.values()].some(
          (other) => other.kind === "player" && other.player === s.player,
        );
      broadcast();
    });
  });
  const dayTimer = setInterval(() => {
    if (game.status === "day" && game.day?.phase === "discussion") {
      game.tick();
      broadcast();
    }
  }, 1000);
  dayTimer.unref();
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
  });
  return { game, wss };
}
