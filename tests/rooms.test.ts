import { defaultRoleCounts } from "../src/lib/game/roles.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { attachGameServer } from "../server/websocket/game-server.js";
import { DayState } from "../server/websocket/day-state.js";
import {
  RoomManager,
  EMPTY_ROOM_TTL_MS,
} from "../server/websocket/room-manager.js";
import { normalizeRoomCode } from "../src/lib/game/rooms.js";
import type {
  AdminView,
  PlayerView,
  ServerMessage,
  View,
} from "../src/lib/game/types.js";

async function fixture(rooms = new RoomManager()) {
  const server = createServer();
  const { wss } = attachGameServer(server, rooms);
  const sockets: WebSocket[] = [];
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  async function connect(hello: object = {}) {
    const ws = new WebSocket(origin.replace("http", "ws") + "/ws", { origin });
    sockets.push(ws);
    let view: View | undefined;
    const messages: ServerMessage[] = [];
    ws.on("message", (raw) => {
      const message: ServerMessage = JSON.parse(raw.toString());
      messages.push(message);
      if (message.type === "state") view = message.view;
    });
    async function wait(predicate: () => boolean) {
      const deadline = Date.now() + 4000;
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error("Timeout aguardando a sala");
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    const send = (message: object) => ws.send(JSON.stringify(message));
    await once(ws, "open");
    send({ type: "hello", ...hello });
    await wait(() => !!view);
    return {
      ws,
      send,
      wait,
      messages,
      get view() {
        return view!;
      },
      get identity() {
        return messages.find((m) => m.type === "identity") as Extract<
          ServerMessage,
          { type: "identity" }
        >;
      },
      async reject(message: object) {
        const before = messages.filter((m) => m.type === "error").length;
        send(message);
        await wait(
          () => messages.filter((m) => m.type === "error").length > before,
        );
      },
      async close() {
        ws.close();
        await once(ws, "close");
      },
    };
  }
  async function createRoom(
    roleCounts = { ...defaultRoleCounts(), assassin: 2 },
  ) {
    const admin = await connect();
    assert.equal(admin.view.kind, "lobby");
    admin.send({ type: "create-room", roleCounts });
    await admin.wait(() => admin.view.kind === "admin");
    return admin;
  }
  async function join(roomCode: string, name: string) {
    const player = await connect({ roomCode });
    assert.equal(player.view.kind, "guest");
    player.send({ type: "join", name });
    await player.wait(() => player.view.kind === "player");
    return player;
  }
  return {
    rooms,
    connect,
    createRoom,
    join,
    async close() {
      for (const ws of sockets) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("Só o Narrador pode antecipar a votação, com 30 segundos novos para todos", async (t) => {
  let now = 5_000;
  const f = await fixture(new RoomManager(() => now));
  t.after(() => f.close());
  const admin = await f.createRoom({ ...defaultRoleCounts(), assassin: 1 });
  const roomCode = admin.identity.roomCode;
  const players: Awaited<ReturnType<typeof f.join>>[] = [];
  for (const name of ["Ana", "Bia", "Caio", "Dani"])
    players.push(await f.join(roomCode, name));
  const guest = await f.connect({ roomCode });
  const game = f.rooms.get(roomCode)!.game;
  game.status = "day";
  game.day = new DayState(game.players.map(({ id, name }) => ({ id, name })), now);
  await players[0].reject({ type: "start-voting" });
  await guest.reject({ type: "start-voting" });
  assert.equal(game.day.phase, "discussion");

  admin.send({ type: "start-voting" });
  await admin.wait(() => (admin.view as AdminView).day?.phase === "voting");
  await players[0].wait(() => (players[0].view as PlayerView).day?.phase === "voting");
  assert.equal(game.day.remaining(now), 30);
  assert.equal((players[0].view as PlayerView).day?.remaining, 30);
  await admin.reject({ type: "start-voting" });
  now = 34_999;
  players[0].send({ type: "day-vote", targetId: game.players[1].id });
  await players[0].wait(() => (players[0].view as PlayerView).day?.submitted === true);
  assert.equal(game.day.phase, "voting");
});

test("Duas salas com 11 jogadores isolam papéis, votos, timers, tokens e fechamento", async (t) => {
  let now = 0;
  const f = await fixture(new RoomManager(() => now));
  t.after(() => f.close());
  const a = await f.createRoom();
  const b = await f.createRoom();
  const codeA = a.identity.roomCode;
  const codeB = b.identity.roomCode;
  assert.notEqual(codeA, codeB);
  assert.match(codeA, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.notEqual(a.identity.token, b.identity.token);
  const playersA: Awaited<ReturnType<typeof f.join>>[] = [];
  const playersB: typeof playersA = [];
  for (let i = 0; i < 11; i++) {
    playersA.push(await f.join(codeA, `Turma A ${i}`));
    playersB.push(await f.join(codeB, `Turma B ${i}`));
  }
  const id = (p: (typeof playersA)[number]) => (p.view as PlayerView).player.id;
  const roomA = f.rooms.get(codeA)!;
  const roomB = f.rooms.get(codeB)!;
  assert.equal(roomA.game.players.length, 11);
  assert.equal(roomB.game.players.length, 11);
  const wrongAdmin = await f.connect({
    roomCode: codeB,
    adminToken: a.identity.token,
  });
  assert.equal(wrongAdmin.view.kind, "guest");
  await wrongAdmin.reject({ type: "close-room" });
  const wrongPlayer = await f.connect({
    roomCode: codeB,
    playerToken: playersA[0].identity.token,
  });
  assert.equal(wrongPlayer.view.kind, "guest");
  await wrongPlayer.reject({ type: "day-vote", targetId: id(playersA[0]) });
  await a.reject({ type: "expel-player", playerId: id(playersB[0]) });
  await a.reject({
    type: "hello",
    roomCode: codeB,
    adminToken: b.identity.token,
  });

  const bMessages = b.messages.length;
  // A roomCode supplied on an action cannot override the authenticated room.
  a.send({ type: "draw", roomCode: codeB });
  await a.wait(() => (a.view as AdminView).status === "night");
  assert.equal(roomB.game.status, "waiting");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(b.messages.length, bMessages);
  b.send({ type: "draw" });
  await b.wait(() => (b.view as AdminView).status === "night");

  async function night(admin: typeof a, players: typeof playersA) {
    for (const p of players)
      await p.wait(() => !!(p.view as PlayerView).player.role);
    const citizen = players.find(
      (p) => (p.view as PlayerView).player.role === "citizen",
    )!;
    const assassin = players.find(
      (p) => (p.view as PlayerView).player.role === "assassin",
    )!;
    await assassin.reject({
      type: "act",
      targetId: id(players === playersA ? playersB[0] : playersA[0]),
    });
    for (const p of players) {
      const view = p.view as PlayerView;
      if (view.player.role === "sheriff") p.send({ type: "pass" });
      else if (view.action) p.send({ type: "act", targetId: id(citizen) });
    }
    await admin.wait(() => (admin.view as AdminView).canWake);
    admin.send({ type: "wake" });
    await admin.wait(() => (admin.view as AdminView).status === "day");
    return assassin;
  }
  const assassinA = await night(a, playersA);
  assert.equal(roomB.game.assassinVotes.size, 0);
  assert(roomA.game.players.every((p) => p.alive));
  now = 90_000;
  await a.wait(() => (a.view as AdminView).day?.phase === "voting");
  await night(b, playersB);
  assert.equal((b.view as AdminView).day!.remaining, 90);
  await playersA[0].reject({ type: "day-vote", targetId: id(playersB[0]) });
  for (const p of playersA)
    p.send({ type: "day-vote", targetId: id(assassinA) });
  await a.wait(() => (a.view as AdminView).status === "night");
  assert.equal(
    roomA.game.players.find((p) => p.id === id(assassinA))!.alive,
    false,
  );
  assert.equal(roomB.game.day!.votes.size, 0);
  assert.equal(roomB.game.day!.phase, "discussion");
  assert(roomB.game.players.every((p) => p.alive));

  const returned = await f.connect({
    roomCode: codeA.toLowerCase().replace("-", ""),
    adminToken: a.identity.token,
  });
  assert.equal(returned.view.kind, "admin");
  const returnedPlayer = await f.connect({
    roomCode: codeA,
    playerToken: assassinA.identity.token,
  });
  assert.equal((returnedPlayer.view as PlayerView).player.alive, false);
  assert.equal(roomA.game.players.length, 11);
  a.send({ type: "close-room" });
  await returnedPlayer.wait(() =>
    returnedPlayer.messages.some((m) => m.type === "room-closed"),
  );
  assert(a.messages.some((m) => m.type === "room-closed"));
  assert(returned.messages.some((m) => m.type === "room-closed"));
  assert.equal(f.rooms.get(codeA), undefined);
  assert.equal(roomB.game.players.length, 11);
  assert.equal((b.view as AdminView).status, "day");
  assert(!b.messages.some((m) => m.type === "room-closed"));
});

test("Sala vazia expira em duas horas; reconexão preserva identidade e renova o prazo", async (t) => {
  let now = 0;
  const f = await fixture(new RoomManager(() => now));
  t.after(() => f.close());
  const admin = await f.createRoom();
  const code = admin.identity.roomCode;
  const player = await f.join(code, "Ana");
  const room = f.rooms.get(code)!;
  await admin.close();
  await player.wait(() => room.clients.size === 1);
  now = 3 * EMPTY_ROOM_TTL_MS;
  f.rooms.sweep();
  assert.equal(f.rooms.get(code), room);
  await player.close();
  await player.wait(() => room.clients.size === 0);
  now += EMPTY_ROOM_TTL_MS - 1;
  const returned = await f.connect({
    roomCode: code,
    playerToken: player.identity.token,
  });
  assert.equal(
    (returned.view as PlayerView).player.id,
    (player.view as PlayerView).player.id,
  );
  assert.equal(room.game.players.length, 1);
  now += EMPTY_ROOM_TTL_MS;
  f.rooms.sweep();
  assert.equal(f.rooms.get(code), room);
  await returned.close();
  await returned.wait(() => room.clients.size === 0);
  now += EMPTY_ROOM_TTL_MS;
  f.rooms.sweep();
  assert.equal(f.rooms.rooms.size, 0);
  const missing = await f.connect({
    roomCode: code,
    adminToken: admin.identity.token,
  });
  assert.equal(missing.view.kind, "missing");
  await missing.reject({ type: "draw" });
  assert.equal(f.rooms.rooms.size, 0);
  const malformed = await f.connect({ roomCode: "inexistente" });
  assert.equal(malformed.view.kind, "missing");
  assert.equal(f.rooms.rooms.size, 0);
});

test("Fechar sala encaminha todas as abas da sala, sem tocar nas demais", async (t) => {
  const f = await fixture();
  t.after(() => f.close());
  const a = await f.createRoom();
  const b = await f.createRoom();
  const code = a.identity.roomCode;
  const secondTab = await f.connect({
    roomCode: code,
    adminToken: a.identity.token,
  });
  const player = await f.join(code, "Ana");
  a.send({ type: "close-room" });
  await secondTab.wait(() =>
    secondTab.messages.some((m) => m.type === "room-closed"),
  );
  await player.wait(() =>
    player.messages.some((m) => m.type === "room-closed"),
  );
  assert.equal(f.rooms.get(code), undefined);
  assert.equal(b.view.kind, "admin");
  assert.equal(
    f.rooms.get(b.identity.roomCode)!.game.adminToken,
    b.identity.token,
  );
  await secondTab.reject({ type: "close-room" });
});

test("Códigos são normalizados e salas expiradas liberam o limite de memória", () => {
  assert.equal(normalizeRoomCode(" abcd 2345 "), "ABCD-2345");
  for (const invalid of [
    "",
    "ABCD-1234",
    "../../abcd",
    "ABCD-234567",
    "<script>",
  ])
    assert.equal(normalizeRoomCode(invalid), null);
  let now = 0;
  const rooms = new RoomManager(() => now, undefined, 1);
  const first = rooms.create();
  assert.throws(() => rooms.create(), /ocupadas/);
  now = EMPTY_ROOM_TTL_MS;
  assert.equal(rooms.get(first.code), undefined);
  assert.notEqual(rooms.create(), first);
  assert.equal(rooms.rooms.size, 1);
});

test("WebSocket valida configuração, preserva na reconexão e bloqueia sorteio sem vagas", async (t) => {
  const f = await fixture();
  t.after(() => f.close());
  const invalid = await f.connect();
  for (const roleCounts of [
    undefined,
    { ...defaultRoleCounts(), doctor: 0 },
    { ...defaultRoleCounts(), seer: 1.5 },
    { ...defaultRoleCounts(), citizen: 2 },
  ]) {
    await invalid.reject({ type: "create-room", roleCounts });
    assert.equal(f.rooms.rooms.size, 0);
    assert.equal(invalid.view.kind, "lobby");
  }
  const counts = { ...defaultRoleCounts(), doctor: 2, detective: 2, seer: 2 };
  const admin = await f.createRoom(counts);
  const code = admin.identity.roomCode;
  assert.deepEqual((admin.view as AdminView).roleCounts, counts);
  await admin.reject({ type: "draw" });
  for (let i = 0; i < 6; i++) await f.join(code, `Pessoa ${i}`);
  await admin.reject({ type: "draw" });
  assert((admin.view as AdminView).players.every((p) => p.role === null));
  const extra = await f.join(code, "Última pessoa");
  await extra.reject({ type: "create-room", roleCounts: defaultRoleCounts() });
  await extra.reject({ type: "draw" });
  const returned = await f.connect({
    roomCode: code,
    adminToken: admin.identity.token,
  });
  assert.deepEqual((returned.view as AdminView).roleCounts, counts);
  const second = await f.createRoom(defaultRoleCounts());
  assert.deepEqual((second.view as AdminView).roleCounts, defaultRoleCounts());
  admin.send({ type: "draw", roleCounts: defaultRoleCounts() });
  await admin.wait(() => (admin.view as AdminView).status === "night");
  const roster = (admin.view as AdminView).players;
  assert.equal(roster.filter((p) => p.role === "doctor").length, 2);
  assert.equal(roster.filter((p) => p.role === "detective").length, 2);
  assert.equal(roster.filter((p) => p.role === "seer").length, 2);
  assert.equal(roster.filter((p) => p.role === "citizen").length, 0);
  const room = f.rooms.get(code)!;
  const seers = room.game.players.filter((p) => p.role === "seer");
  room.game.act(
    seers[0],
    room.game.players.find((p) => p.role === "assassin")!.id,
  );
  const reSeer = await f.connect({
    roomCode: code,
    playerToken: seers[0].token,
  });
  const otherSeer = await f.connect({
    roomCode: code,
    playerToken: seers[1].token,
  });
  assert.equal((reSeer.view as PlayerView).vision!.role, "assassin");
  assert.equal((otherSeer.view as PlayerView).vision, null);
  assert((otherSeer.view as PlayerView).action);
  assert(!("nightActions" in otherSeer.view));
  assert(!("roleCounts" in otherSeer.view));
});
