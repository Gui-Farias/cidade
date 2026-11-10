import { defaultRoleCounts } from "../src/lib/game/roles.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { attachGameServer } from "../server/websocket/game-server.js";
import { RoomManager } from "../server/websocket/room-manager.js";
import type {
  View,
  PlayerView,
  AdminView,
  ServerMessage,
} from "../src/lib/game/types.js";

test("WebSocket: novos papéis, visão privada, reconexão, tiro e vitória do Rei Louco", async () => {
  const server = createServer();
  let now = 0;
  const { wss } = attachGameServer(server, new RoomManager(() => now));
  let roomCode: string | undefined;
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
    const confirmations: Array<"act" | "pass" | "day-vote"> = [];
    ws.on("message", (raw) => {
      const message: ServerMessage = JSON.parse(raw.toString());
      if (message.type === "state") view = message.view;
      if (message.type === "identity") {
        token = message.token;
        roomCode = message.roomCode;
      }
      if (message.type === "error") errors.push(message.message);
      if (message.type === "action-confirmed") confirmations.push(message.action);
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
    send({ type: "hello", roomCode, playerToken });
    await wait(() => !!view);
    if (!roomCode) {
      send({
        type: "create-room",
        roleCounts: {
          ...defaultRoleCounts(),
          assassin: 2,
          seer: 1,
          sheriff: 1,
          bodyguard: 1,
          fool: 1,
        },
      });
      await wait(() => view.kind === "admin");
    }
    return {
      ws,
      send,
      wait,
      errors,
      confirmations,
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
      detective = role("detective"),
      fool = role("fool");
    const doctor = role("doctor"),
      guard = role("bodyguard"),
      assassin = role("assassin"),
      citizen = role("citizen");
    seer.send({ type: "act", targetId: id(fool) });
    await seer.wait(() => !!(seer.view as PlayerView).vision);
    assert.deepEqual(seer.confirmations, ["act"]);
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
    assert.deepEqual(citizen.confirmations, []);
    assert.equal((citizen.view as PlayerView).action, null);
    sheriff.send({ type: "act", targetId: id(assassin) });
    await sheriff.wait(
      () => (sheriff.view as PlayerView).bulletsAvailable === 1,
    );
    const reSheriff = await connect(sheriff.token);
    assert.equal((reSheriff.view as PlayerView).bulletsAvailable, 1);
    reSheriff.send({ type: "act", targetId: id(assassin) });
    await reSheriff.wait(() => reSheriff.errors.length > 0);
    for (const p of players) {
      const r = (p.view as PlayerView).player.role;
      if (r === "assassin") p.send({ type: "act", targetId: id(citizen) });
      if (r === "doctor") p.send({ type: "act", targetId: id(citizen) });
      if (r === "bodyguard") p.send({ type: "act", targetId: id(doctor) });
      if (r === "detective") p.send({ type: "act", targetId: id(assassin) });
    }
    await admin.wait(() => (admin.view as AdminView).canWake);
    for (const p of players) {
      const playerRole = (p.view as PlayerView).player.role;
      if (playerRole !== "citizen" && playerRole !== "fool") {
        await p.wait(() => p.confirmations.includes("act"));
        assert(p.confirmations.includes("act"), `Ação de ${playerRole} deve ser confirmada`);
      }
    }
    assert.equal(
      (admin.view as AdminView).nightActions.find((a) => a.role === "bodyguard")
        ?.targetId,
      id(doctor),
    );
    assert.equal(
      (admin.view as AdminView).nightActions.find((a) => a.role === "seer")
        ?.targetId,
      id(fool),
    );
    assert.equal(
      (admin.view as AdminView).nightActions.find((a) => a.role === "sheriff")
        ?.targetId,
      id(assassin),
    );
    admin.send({ type: "wake" });
    await admin.wait(() => (admin.view as AdminView).status === "day");
    now += 90_000;
    const living = players.filter((p) => id(p) !== id(assassin));
    await admin.wait(() => (admin.view as AdminView).day?.phase === "voting");
    for (const p of living) p.send({ type: "day-vote", targetId: id(fool) });
    for (const p of living) {
      await p.wait(() => p.confirmations.includes("day-vote"));
      assert(p.confirmations.includes("day-vote"));
    }
    for (const p of [...players, admin]) {
      await p.wait(
        () =>
          (p.view.kind === "player" || p.view.kind === "admin") &&
          p.view.result !== null,
      );
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
