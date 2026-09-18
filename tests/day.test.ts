import { test } from "node:test";
import assert from "node:assert/strict";
import { DayState } from "../server/websocket/day-state.js";
import { Game } from "../server/websocket/game-state.js";
const voters = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));

test("80s, escolha majoritária, prorrogação de 30s e voto único", () => {
  const day = new DayState(voters, 1000);
  assert.equal(day.remaining(1000), 80);
  assert.equal(day.tick(80_999), false);
  assert.throws(() => day.choose("a", "extend", 1000));
  assert.equal(day.tick(81_000), true);
  assert.throws(() => day.choose("invasor", "vote", 81_000));
  for (const id of ["a", "b", "c"]) day.choose(id, "extend", 81_000);
  assert.throws(() => day.choose("a", "vote", 81_000));
  day.choose("d", "vote", 81_000);
  assert.equal(day.phase, "discussion");
  assert.equal(day.remaining(81_000), 30);
  day.tick(111_000);
  day.choose("a", "extend", 111_000);
  day.choose("b", "extend", 111_000);
  day.choose("c", "vote", 111_000);
  day.choose("d", "vote", 111_000);
  assert.equal(day.phase, "voting");
  assert.throws(() => day.vote("a", "invalid"));
  day.vote("a", "a");
  assert.throws(() => day.vote("a", "b"));
  day.vote("b", "a");
  day.vote("c", "b");
  day.vote("d", "b");
  assert.equal(day.phase, "tie");
  assert.throws(() => day.resolve("c"));
  day.resolve("a");
  assert.equal(day.eliminated, "a");
});

test("Sigilo, vivos/offline, eliminação automática e limpeza para outra noite", () => {
  let now = 0;
  const game = new Game(() => now);
  for (const name of ["a", "b", "c", "d", "e"]) game.join(name);
  game.draw();
  game.players.forEach((p) => {
    if (["sheriff", "bodyguard", "seer", "detective", "fool"].includes(p.role!))
      p.role = "citizen";
  });
  const target = game.players.find((p) => p.role === "citizen")!;
  for (const p of game.players)
    if (game.eligible(p))
      game.act(
        p,
        p.role === "seer"
          ? game.players.find((t) => t.id !== p.id)!.id
          : target.id,
      );
  game.wake();
  const a = game.players.find((p) => p.role === "citizen")!;
  const b = game.players.find((p) => p !== a)!;
  assert.equal(game.playerView(a).day!.remaining, 80);
  assert.throws(() => game.dayVote(a, b.id));
  now = 80_000;
  game.tick();
  for (const p of game.players) game.dayChoice(p, "vote");
  const before = game.playerView(b);
  game.dayVote(a, a.id);
  assert.deepEqual(game.playerView(b), before);
  assert(!("votes" in game.playerView(a).day!));
  assert(!("tally" in game.playerView(a).day!));
  b.connected = false;
  assert(game.adminView().day!.pending.some((p) => p.id === b.id));
  for (const p of game.players.filter((p) => p !== a)) game.dayVote(p, a.id);
  assert.equal(game.status, "night");
  assert.equal(a.alive, false);
  assert.equal(game.adminView().day!.eliminated, a.id);
  assert.equal(game.playerView(b).day, null);
  assert.equal(game.assassinVotes.size, 0);
  assert.deepEqual(game.assassinTargets, []);
  assert.throws(() => game.dayVote(a, b.id));
});

test("Reset preserva o narrador e limpa jogadores", () => {
  const game = new Game();
  game.adminToken = "narrador";
  game.join("Ana");
  game.reset();
  assert.equal(game.status, "waiting");
  assert.equal(game.players.length, 0);
  assert.equal(game.adminView().players.length, 0);
  assert.equal(game.adminToken, "narrador");
});

test("Duas prorrogações no máximo, depois votação automática e sem terceira decisão", () => {
  const day = new DayState(voters, 0);
  assert.equal(day.tick(79_999), false);
  assert.equal(day.tick(80_000), true);
  for (const p of voters) day.choose(p.id, "extend", 80_000);
  assert.equal(day.extensions, 1);
  assert.equal(day.remaining(80_000), 30);
  assert.equal(day.tick(109_999), false);
  day.tick(110_000);
  for (const p of voters) day.choose(p.id, "extend", 110_000);
  assert.equal(day.extensions, 2);
  assert.equal(day.tick(139_999), false);
  assert.equal(day.tick(140_000), true);
  assert.equal(day.phase, "voting");
  assert.throws(() => day.choose("a", "extend", 140_000));
  for (const p of voters) day.vote(p.id, null);
  assert.equal(day.phase, "completed");
  assert.equal(day.eliminated, null);
  assert.deepEqual(day.tally(), []);
});

test("Abstenção conta como confirmação única, não como candidato ou desempate", () => {
  const day = new DayState(voters, 0);
  day.tick(80_000);
  for (const p of voters) day.choose(p.id, "vote", 80_000);
  assert.throws(() => day.vote("invasor", null));
  assert.throws(() => day.vote("a", undefined));
  day.vote("a", null);
  assert.throws(() => day.vote("a", "b"));
  day.vote("b", null);
  day.vote("c", null);
  assert.equal(day.phase, "voting");
  assert.equal(day.pending().length, 1);
  day.vote("d", "a");
  assert.equal(day.eliminated, "a");
  assert.deepEqual(day.tally(), [{ id: "a", count: 1 }]);
});

test("Todos se abstêm: sem morte ou vitória, próxima noite e limite renovado no próximo dia", () => {
  let now = 0;
  const game = new Game(() => now);
  for (let i = 0; i < 3; i++) game.join(`Pessoa ${i}`);
  game.draw();
  const assassin = game.players.find((p) => p.role === "assassin")!;
  const doctor = game.players.find((p) => p.role === "doctor")!;
  const seer = game.players.find((p) => p.role === "seer")!;
  const night = () => {
    game.act(assassin, seer.id);
    game.act(doctor, seer.id);
    game.act(seer, assassin.id);
    game.wake();
  };
  night();
  now = 80_000;
  game.tick();
  for (let i = 0; i < 2; i++) {
    for (const p of game.players) game.dayChoice(p, "extend");
    now += 30_000;
    game.tick();
  }
  assert.equal(game.playerView(doctor).day!.extensionsRemaining, 0);
  const privateView = game.playerView(doctor);
  game.dayVote(assassin, null);
  assert.deepEqual(game.playerView(doctor), privateView);
  assert.equal(game.playerView(assassin).day!.submitted, true);
  game.dayVote(doctor, null);
  game.dayVote(seer, null);
  assert.equal(game.adminView().day!.abstentions, 3);
  assert(game.players.every((p) => p.alive));
  assert.equal(game.status, "night");
  assert.equal(game.result, null);
  assert(game.timeline.some((e) => e.text.includes("Ninguém foi eliminado")));
  night();
  assert.equal(game.playerView(doctor).day!.remaining, 80);
  assert.equal(game.playerView(doctor).day!.extensionsRemaining, 2);
});
