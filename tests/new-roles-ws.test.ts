import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { Game } from "../server/websocket/game-state.js";
import { attachGameServer } from "../server/websocket/game-server.js";
import type {
  View,
  PlayerView,
  AdminView,
  ServerMessage,
} from "../src/lib/game/types.js";

test("WebSocket: novos papéis, visão privada, reconexão, tiro e vitória do Rei Louco", async () => {
  const server = createServer();
  let now = 0;
  const { wss } = attachGameServer(server, new Game(() => now));
  const sockets: WebSocket[] = [];
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  async function connect(playerToken?: string) {
    const ws = new WebSocket(origin.replace("http", "ws") + "/ws", { origin });
    sockets.push(ws);
    let view: View;
    let token = playerToken;
    const errors: string[] = [];
    ws.on("message", (raw) => {
      const message: ServerMessage = JSON.parse(raw.toString());
      if (message.type === "state") view = message.view;
      if (message.type === "identity") token = message.token;
      if (message.type === "error") errors.push(message.message);
    });
    const wait = async (predicate: () => boolean) => {
      const deadline = Date.now() + 3000;
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error("Timeout de WebSocket");
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };
    const send = (message: object) => ws.send(JSON.stringify(message));
    await once(ws, "open");
    send({ type: "hello", playerToken });
    await wait(() => !!view);
    return {
      ws,
      send,
      wait,
      errors,
      get view() {
        return view;
      },
      get token() {
        return token;
      },
    };
  }
  try {
    const admin = await connect();
    const players: Awaited<ReturnType<typeof connect>>[] = [];
    for (let i = 0; i < 9; i++) {
      const p = await connect();
      p.send({ type: "join", name: `Jogador ${i}` });
      await p.wait(() => p.view.kind === "player");
      players.push(p);
    }
    admin.send({ type: "draw" });
    await admin.wait(() => (admin.view as AdminView).status === "night");
    for (const p of players)
      await p.wait(() => (p.view as PlayerView).player.role !== null);
    const role = (r: string) =>
      players.find((p) => (p.view as PlayerView).player.role === r)!;
    const id = (p: (typeof players)[number]) =>
      (p.view as PlayerView).player.id;
    const seer = role("seer"),
      sheriff = role("sheriff"),
      fool = role("fool");
    const doctor = role("doctor"),
      guard = role("bodyguard"),
      assassin = role("assassin"),
      citizen = role("citizen");
    seer.send({ type: "act", targetId: id(fool) });
    await seer.wait(() => !!(seer.view as PlayerView).vision);
    assert.equal((seer.view as PlayerView).vision!.role, "fool");
    for (const p of players.filter((p) => p !== seer))
      assert.equal((p.view as PlayerView).vision, null);
    const returned = await connect(seer.token);
    assert.deepEqual(
      (returned.view as PlayerView).vision,
      (seer.view as PlayerView).vision,
    );
    citizen.send({ type: "pass" });
    await citizen.wait(() => citizen.errors.length > 0);
    assert.equal((citizen.view as PlayerView).action, null);
    sheriff.send({ type: "act", targetId: id(assassin) });
    await sheriff.wait(() => !(sheriff.view as PlayerView).bulletAvailable);
    const reSheriff = await connect(sheriff.token);
    assert.equal((reSheriff.view as PlayerView).bulletAvailable, false);
    reSheriff.send({ type: "act", targetId: id(assassin) });
    await reSheriff.wait(() => reSheriff.errors.length > 0);
    for (const p of players) {
      const r = (p.view as PlayerView).player.role;
      if (r === "assassin") p.send({ type: "act", targetId: id(citizen) });
      if (r === "doctor") p.send({ type: "act", targetId: id(citizen) });
      if (r === "bodyguard") p.send({ type: "act", targetId: id(doctor) });
    }
    await admin.wait(() => (admin.view as AdminView).canWake);
    assert.equal((admin.view as AdminView).bodyguardTarget, id(doctor));
    assert.equal((admin.view as AdminView).seerTarget, id(fool));
    assert.equal((admin.view as AdminView).sheriffTarget, id(assassin));
    admin.send({ type: "wake" });
    await admin.wait(() => (admin.view as AdminView).status === "day");
    now += 80_000;
    const living = players.filter((p) => id(p) !== id(assassin));
    for (const p of living) p.send({ type: "day-choice", choice: "vote" });
    await admin.wait(() => (admin.view as AdminView).day?.phase === "voting");
    for (const p of living) p.send({ type: "day-vote", targetId: id(fool) });
    for (const p of [...players, admin]) {
      await p.wait(() => p.view.kind !== "guest" && p.view.result !== null);
      assert.equal((p.view as PlayerView | AdminView).result!.winner, "fool");
    }
    assert.equal((guard.view as PlayerView).player.alive, true);
    const reFool = await connect(fool.token);
    assert.equal((reFool.view as PlayerView).result!.winner, "fool");
    assert.equal((reFool.view as PlayerView).player.alive, false);
  } finally {
    for (const ws of sockets) ws.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
