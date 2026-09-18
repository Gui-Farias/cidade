import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { Game } from "../server/websocket/game-state.js";
import { attachGameServer } from "../server/websocket/game-server.js";
import type { AdminView, PlayerView, ServerMessage, View } from "../src/lib/game/types.js";

test("Narrador expulsa jogador e transfere a condução da sala", async () => {
  const server = createServer();
  const game = new Game();
  const { wss } = attachGameServer(server, game);
  const sockets: WebSocket[] = [];
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;

  async function connect() {
    const ws = new WebSocket(origin.replace("http", "ws") + "/ws", { origin });
    sockets.push(ws);
    const messages: ServerMessage[] = [];
    let view: View | undefined;
    ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as ServerMessage;
      messages.push(message);
      if (message.type === "state") view = message.view;
    });
    const wait = async (predicate: () => boolean) => {
      const deadline = Date.now() + 3000;
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error("Timeout de WebSocket");
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };
    await once(ws, "open");
    ws.send(JSON.stringify({ type: "hello" }));
    await wait(() => !!view);
    return {
      send: (message: object) => ws.send(JSON.stringify(message)),
      wait,
      messages,
      get view() {
        return view!;
      },
    };
  }

  try {
    const admin = await connect();
    assert.equal(admin.view.kind, "admin");
    const player = await connect();
    player.send({ type: "join", name: "Ana" });
    await player.wait(() => player.view.kind === "player");
    const playerId = (player.view as PlayerView).player.id;

    admin.send({ type: "expel-player", playerId });
    await player.wait(
      () => player.view.kind === "guest" && !player.view.closed,
    );
    assert(player.messages.some((m) => m.type === "identity-reset" && m.kind === "player"));
    assert.equal((admin.view as AdminView).players.length, 0);

    player.send({ type: "join", name: "Ana de novo" });
    await player.wait(() => player.view.kind === "player");
    assert.equal((player.view as PlayerView).player.name, "Ana de novo");

    admin.send({ type: "leave-admin" });
    await admin.wait(() => admin.view.kind === "guest" && !admin.view.closed);
    await player.wait(
      () => player.view.kind === "player" && player.view.adminAvailable,
    );
    assert(admin.messages.some((m) => m.type === "identity-reset" && m.kind === "admin"));

    player.send({ type: "claim-admin" });
    await player.wait(() => player.view.kind === "admin");
    assert.equal((player.view as AdminView).players.length, 0);
    assert(player.messages.some((m) => m.type === "identity-reset" && m.kind === "player"));
    assert(player.messages.some((m) => m.type === "identity" && m.kind === "admin"));
  } finally {
    for (const ws of sockets) ws.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
