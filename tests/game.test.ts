import { defaultRoleCounts } from "../src/lib/game/roles.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { Game as FullGame } from "../server/websocket/game-state.js";
import { attachGameServer } from "../server/websocket/game-server.js";
import { RoomManager } from "../server/websocket/room-manager.js";
import type {
  ServerMessage,
  View,
  AdminView,
  PlayerView,
} from "../src/lib/game/types.js";

// Preserve the original four-role regression scenarios; the expanded deck is tested separately.
class Game extends FullGame {
  override draw() {
    this.roleCounts = { ...defaultRoleCounts(), assassin: 2, sheriff: 1 };
    super.draw();
    for (const p of this.players)
      if (["bodyguard", "seer", "detective", "fool"].includes(p.role!))
        p.role = "citizen";
      else if (p.role === "sheriff") p.role = "seer";
  }
}
test("Fluxo real: identidade, sigilo, ações, proteção, morte e reconexão", async () => {
  const server = createServer();
  let now = Date.now();
  const game = new Game(
    () => now,
    () => 0,
  );
  const { wss } = attachGameServer(
    server,
    new RoomManager(
      () => now,
      () => game,
    ),
  );
  let roomCode: string | undefined;
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const clients: WebSocket[] = [];
  async function client(tokens = {}) {
    const ws = new WebSocket(origin.replace("http", "ws") + "/ws", { origin });
    clients.push(ws);
    const messages: ServerMessage[] = [];
    let view: View | undefined;
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      messages.push(m);
      if (m.type === "state") view = m.view;
      if (m.type === "identity") roomCode = m.roomCode;
    });
    await once(ws, "open");
    function send(m: object) {
      ws.send(JSON.stringify(m));
    }
    async function wait(predicate: () => boolean) {
      const end = Date.now() + 3000;
      while (!predicate()) {
        if (Date.now() > end) throw new Error("Timeout aguardando atualização");
        await new Promise((r) => setTimeout(r, 5));
      }
    }
    send({ type: "hello", roomCode, ...tokens });
    await wait(() => !!view);
    if (!roomCode) {
      send({
        type: "create-room",
        roleCounts: { ...defaultRoleCounts(), assassin: 2, sheriff: 1 },
      });
      await wait(() => view?.kind === "admin");
    }
    return {
      ws,
      messages,
      send,
      wait,
      get view() {
        return view!;
      },
      get token() {
        const m = messages.find((m) => m.type === "identity");
        return m?.type === "identity" ? m.token : undefined;
      },
    };
  }
  try {
    const admin = await client();
    assert.equal(admin.view.kind, "admin");
    const adminToken = admin.token!;
    const people: Awaited<ReturnType<typeof client>>[] = [];
    for (let i = 0; i < 9; i++) {
      const p = await client();
      assert.equal(p.view.kind, "guest");
      p.send({ type: "join", name: `Pessoa ${i}` });
      await p.wait(() => p.view.kind === "player");
      people.push(p);
    }
    await admin.wait(() => (admin.view as AdminView).players.length === 9);
    admin.send({ type: "draw" });
    await admin.wait(() => (admin.view as AdminView).status === "night");
    for (const p of people)
      await p.wait(() => !!(p.view as PlayerView).player.role);
    const roster = (admin.view as AdminView).players;
    assert.equal(roster.filter((p) => p.role === "assassin").length, 2);
    assert.equal(roster.filter((p) => p.role === "doctor").length, 1);
    assert.equal(roster.filter((p) => p.role === "seer").length, 1);
    assert.equal(roster.filter((p) => p.role === "citizen").length, 5);
    const byRole = (role: string) =>
      people.filter((p) => (p.view as PlayerView).player.role === role);
    const [a1, a2] = byRole("assassin");
    const [doctor] = byRole("doctor");
    const [seer] = byRole("seer");
    const [citizen] = byRole("citizen");
    const id = (p: typeof citizen) => (p.view as PlayerView).player.id;
    async function finishDay(adminClient: typeof admin) {
      assert.equal((adminClient.view as AdminView).day!.remaining, 90);
      now += 90_000;
      const living = people.filter((p) => (p.view as PlayerView).player.alive);
      await adminClient.wait(
        () => (adminClient.view as AdminView).day?.phase === "voting",
      );
      const victim = living.find(
        (p) =>
          p !== citizen && (p.view as PlayerView).player.role === "citizen",
      )!;
      for (const p of living)
        p.send({
          type: "day-vote",
          targetId: p === citizen ? null : id(victim),
        });
      await adminClient.wait(
        () => (adminClient.view as AdminView).status === "night",
      );
      assert.equal((adminClient.view as AdminView).day!.eliminated, id(victim));
      assert.equal((adminClient.view as AdminView).day!.abstentions, 1);
    }

    for (const p of people) {
      assert(!JSON.stringify(p.view).includes(adminToken));
      const visible = p.view as unknown as PlayerView;
      assert(!("token" in visible.player));
      assert(visible.players.every((other) => !("role" in other) && !("token" in other)));
    }
    const guest = await client();
    assert.deepEqual(guest.view, { kind: "guest", closed: true });
    guest.send({ type: "join", name: "Tarde" });
    await guest.wait(() => guest.messages.some((m) => m.type === "error"));
    citizen.send({ type: "draw" });
    citizen.send({ type: "turn", turn: "assassins" });
    citizen.send({ type: "getRole", targetId: id(a1) });
    await citizen.wait(
      () => citizen.messages.filter((m) => m.type === "error").length === 3,
    );
    await a1.wait(() => !!(a1.view as PlayerView).action);
    assert.equal((citizen.view as PlayerView).action, null);
    assert(
      !(a1.view as PlayerView).action!.targets.some(
        (t) => t.id === id(a1) || t.id === id(a2),
      ),
    );
    citizen.send({ type: "act", targetId: id(doctor) });
    await citizen.wait(
      () => citizen.messages.filter((m) => m.type === "error").length === 4,
    );
    assert.deepEqual((a1.view as PlayerView).partners, [
      { id: id(a2), name: (a2.view as PlayerView).player.name },
    ]);
    assert.deepEqual((citizen.view as PlayerView).partners, []);
    assert((doctor.view as PlayerView).action);
    assert((seer.view as PlayerView).action);
    assert.equal((admin.view as AdminView).pendingPlayers.length, 4);
    assert.equal((admin.view as AdminView).canWake, false);
    admin.send({ type: "wake" });
    await admin.wait(() => admin.messages.some((m) => m.type === "error"));
    const privateView = JSON.stringify(a2.view);
    a1.send({ type: "act", targetId: id(citizen) });
    await admin.wait(() => !!(admin.view as AdminView).assassinTarget);
    assert.equal(JSON.stringify(a2.view), privateView);
    assert((a2.view as PlayerView).action);
    a1.send({ type: "act", targetId: id(doctor) });
    await a1.wait(() => a1.messages.some((m) => m.type === "error"));
    const confirmedView = JSON.stringify(a1.view);
    a2.send({ type: "act", targetId: id(doctor) });
    await admin.wait(() => (admin.view as AdminView).assassinConflict);
    assert.equal(JSON.stringify(a1.view), confirmedView);
    assert.equal(
      (admin.view as AdminView).assassinVotes.filter((v) => v.targetId).length,
      2,
    );
    a2.send({ type: "resolve-assassins", targetId: id(doctor) });
    await a2.wait(() => a2.messages.some((m) => m.type === "error"));
    admin.send({ type: "wake" });
    await admin.wait(() => admin.messages.some((m) => m.type === "error"));
    assert.equal((admin.view as AdminView).status, "night");
    await doctor.wait(() => !!(doctor.view as PlayerView).action);
    assert(
      !(doctor.view as PlayerView).action!.targets.some(
        (t) => t.id === id(doctor),
      ),
    );
    doctor.send({ type: "act", targetId: id(citizen) });
    await admin.wait(
      () =>
        !!(admin.view as AdminView).nightActions.find(
          (a) => a.playerId === id(doctor),
        )?.targetId,
    );
    await seer.wait(() => !!(seer.view as PlayerView).action);
    assert(
      !(seer.view as PlayerView).action!.targets.some((t) => t.id === id(seer)),
    );
    seer.send({ type: "act", targetId: id(a1) });
    await seer.wait(() => !!(seer.view as PlayerView).vision);
    assert.equal((seer.view as PlayerView).vision!.role, "assassin");
    for (const p of people.filter((p) => p !== seer))
      assert.equal((p.view as PlayerView).vision, null);
    await admin.wait(() => (admin.view as AdminView).canWake);
    admin.send({ type: "wake" });
    await admin.wait(() => (admin.view as AdminView).status === "day");
    assert.equal(
      (admin.view as AdminView).outcome,
      "Ninguém morreu durante a noite.",
    );
    for (const p of people) {
      await p.wait(() => (p.view as PlayerView).status === "day");
      assert.equal((p.view as PlayerView).action, null);
      assert.equal((p.view as PlayerView).vision, null);
    }
    admin.ws.close();
    await once(admin.ws, "close");
    const reAdmin = await client({ adminToken });
    assert.equal(reAdmin.view.kind, "admin");
    await finishDay(reAdmin);
    await a1.wait(() => !!(a1.view as PlayerView).action);
    a1.send({ type: "act", targetId: id(doctor) });
    await reAdmin.wait(
      () => (reAdmin.view as AdminView).assassinTarget === id(doctor),
    );
    a2.send({ type: "act", targetId: id(doctor) });
    doctor.send({ type: "act", targetId: id(citizen) });
    await seer.wait(() => !!(seer.view as PlayerView).action);
    seer.send({ type: "act", targetId: id(citizen) });
    await seer.wait(() => !!(seer.view as PlayerView).vision);
    assert.equal((seer.view as PlayerView).vision!.role, "citizen");
    reAdmin.send({ type: "wake" });
    await doctor.wait(() => !(doctor.view as PlayerView).player.alive);
    for (const p of people)
      await p.wait(() => (p.view as PlayerView).status === "day");
    const doctorId = id(doctor);
    const doctorToken = doctor.token!;
    doctor.ws.close();
    await once(doctor.ws, "close");
    await reAdmin.wait(
      () =>
        !(reAdmin.view as AdminView).players.find((p) => p.id === doctorId)!
          .connected,
    );
    const reDoctor = await client({ playerToken: doctorToken });
    assert.equal((reDoctor.view as PlayerView).player.id, doctorId);
    assert.equal((reDoctor.view as PlayerView).player.alive, false);
    assert.equal((reDoctor.view as PlayerView).player.role, "doctor");
    assert.equal((reAdmin.view as AdminView).players.length, 9);
    await finishDay(reAdmin);
    await reAdmin.wait(() => (reAdmin.view as AdminView).status === "night");
    assert.equal((reAdmin.view as AdminView).pendingPlayers.length, 3);
    reDoctor.send({ type: "act", targetId: id(citizen) });
    await reDoctor.wait(() =>
      reDoctor.messages.some((m) => m.type === "error"),
    );
    assert.equal((reDoctor.view as PlayerView).action, null);
    for (const assassin of [a1, a2])
      assassin.send({ type: "act", targetId: id(citizen) });
    seer.send({ type: "act", targetId: id(a1) });
    await reAdmin.wait(() => (reAdmin.view as AdminView).canWake);
    reAdmin.send({ type: "wake" });
    await reAdmin.wait(() => (reAdmin.view as AdminView).status === "day");
    const survivors = people.filter(
      (p) =>
        (reAdmin.view as AdminView).players.find((t) => t.id === id(p))!.alive,
    );
    now += 90_000;
    await reAdmin.wait(
      () => (reAdmin.view as AdminView).day?.phase === "voting",
    );
    const lastVictim = survivors.find(
      (p) => (p.view as PlayerView).player.role === "citizen",
    )!;
    for (const p of survivors)
      p.send({ type: "day-vote", targetId: id(lastVictim) });
    await reAdmin.wait(() => (reAdmin.view as AdminView).status === "finished");
    assert.equal((reAdmin.view as AdminView).result!.winner, "assassins");
    const returned = await client({ playerToken: citizen.token });
    assert.equal((returned.view as PlayerView).status, "finished");
    assert.equal((returned.view as PlayerView).result!.winner, "assassins");
    returned.send({ type: "restart" });
    await returned.wait(() =>
      returned.messages.some((m) => m.type === "error"),
    );
    reAdmin.send({ type: "restart" });
    await reAdmin.wait(() => (reAdmin.view as AdminView).status === "night");
    await returned.wait(() => (returned.view as PlayerView).player.alive);
    assert.equal((returned.view as PlayerView).result, null);
    assert.equal((reAdmin.view as AdminView).players.length, 9);
  } finally {
    for (const ws of clients) ws.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("Votos iguais, reconexão de estado e nova noite", async () => {
  let now = Date.now();
  const game = new Game(
    () => now,
    () => 0,
  );
  const players = ["A", "B", "C", "D", "E", "F"].map((name) => game.join(name));
  game.draw();
  const assassins = players.filter((p) => p.role === "assassin");
  const target = players.find((p) => p.role === "doctor")!;
  assert.equal(game.pendingPlayers().length, 4);
  assert.equal(game.playerView(target).players.length, players.length);
  assert.equal(game.playerView(target).nightReady, false);
  game.act(assassins[0], target.id);
  assert.equal(game.playerView(assassins[0]).submitted, true);
  assert.equal(game.playerView(assassins[1]).submitted, false);
  assert.throws(() => game.act(assassins[0], target.id));
  game.act(assassins[1], target.id);
  assert.equal(game.assassinConflict(), false);
  assert.equal(game.assassinTarget, target.id);
  assert.throws(() => game.wake(), /Aguarde todos/);
  const seer = players.find((p) => p.role === "seer")!;
  target.connected = false;
  assert(game.pendingPlayers().includes(target));
  game.act(seer, assassins[0].id);
  assert.throws(() => game.wake(), /Aguarde todos/);
  game.act(target, seer.id);
  assert.equal(game.adminView().canWake, true);
  assert.equal(game.playerView(target).nightReady, true);
  game.wake();
  assert.equal(game.playerView(target).nightReady, false);
  assert.equal(target.alive, false);
  now += 90_000;
  game.tick();
  for (const p of players.filter((p) => p.alive))
    game.dayVote(p, assassins[0].id);
  assert.equal(game.assassinVotes.size, 0);
  assert.equal(game.assassinTarget, null);
  assert.equal(game.playerView(assassins[0]).action, null);
  assert(game.playerView(assassins[1]).action);
});
