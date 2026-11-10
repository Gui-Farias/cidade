import { test } from "node:test";
import assert from "node:assert/strict";
import { DayState } from "../server/websocket/day-state.js";
import { Game } from "../server/websocket/game-state.js";

const voters = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));

test("90 segundos de conversa levam diretamente a 30 segundos de votação", () => {
  const day = new DayState(voters, 1000, () => 0);
  assert.equal(day.remaining(1000), 90);
  assert.equal(day.tick(90_999), false);
  assert.throws(() => day.vote("a", "b", 90_999));
  assert.equal(day.tick(91_000), true);
  assert.equal(day.phase, "voting");
  assert.equal(day.duration, 30);
  assert.equal(day.remaining(91_000), 30);
  assert.equal(day.tick(120_999), false);
  assert.equal(day.remaining(120_999), 1);
});

test("Narrador pode iniciar 30 segundos de votação antes de terminar a conversa", () => {
  const day = new DayState(voters, 1_000, () => 0);
  day.startVoting(21_000);
  assert.equal(day.phase, "voting");
  assert.equal(day.duration, 30);
  assert.equal(day.remaining(21_000), 30);
  assert.throws(() => day.startVoting(22_000));
  assert.equal(day.tick(50_999), false);
  assert.equal(day.tick(51_000), true);
  assert.equal(day.phase, "completed");
  assert.equal(day.votes.size, voters.length);
});

test("Jogo só permite antecipar votação durante a conversa e registra a decisão", () => {
  let now = 2_000;
  const game = new Game(() => now);
  for (const name of ["Ana", "Bia", "Caio", "Dani"]) game.join(name);
  assert.throws(() => game.startVoting());
  game.status = "day";
  game.day = new DayState(game.players.map(({ id, name }) => ({ id, name })), now);
  now = 12_000;
  game.startVoting();
  assert.equal(game.day.phase, "voting");
  assert.equal(game.adminView().day?.remaining, 30);
  assert.equal(game.playerView(game.players[0]).day?.phase, "voting");
  assert.match(game.timeline.at(-1)?.text ?? "", /Narrador encerrou a conversa/);
  assert.throws(() => game.startVoting());
});

test("Cada voto é único; empate sorteia somente entre os mais votados", () => {
  const day = new DayState(voters, 0, () => 1);
  day.tick(90_000);
  assert.throws(() => day.vote("invasor", null, 90_000));
  assert.throws(() => day.vote("a", "invalid", 90_000));
  day.vote("a", "a", 90_000);
  assert.throws(() => day.vote("a", "b", 90_000));
  day.vote("b", "a", 90_000);
  day.vote("c", "b", 90_000);
  day.vote("d", "b", 90_000);
  assert.equal(day.phase, "completed");
  assert.equal(day.eliminated, "b");
  assert.equal(day.tiebreaker, true);
  assert.deepEqual(day.tally(), [{ id: "a", count: 2 }, { id: "b", count: 2 }]);
});

test("Após 30 segundos, votos ausentes viram abstenções e o resultado é fechado", () => {
  const day = new DayState(voters, 0, () => 0);
  day.tick(90_000);
  day.vote("a", "b", 100_000);
  day.vote("b", null, 101_000);
  assert.deepEqual(day.pending().map((p) => p.id), ["c", "d"]);
  assert.equal(day.tick(119_999), false);
  assert.equal(day.tick(120_000), true);
  assert.equal(day.phase, "completed");
  assert.equal(day.eliminated, "b");
  assert.deepEqual([...day.votes], [["a", "b"], ["b", null], ["c", null], ["d", null]]);
  assert.equal(day.pending().length, 0);
  assert.throws(() => day.vote("c", "a", 120_000));
});

test("Um relógio atrasado respeita os dois prazos e encerra sem votos", () => {
  const day = new DayState(voters, 0);
  assert.equal(day.tick(125_000), true);
  assert.equal(day.phase, "completed");
  assert.equal(day.eliminated, null);
  assert.deepEqual(day.tally(), []);
  assert.equal([...day.votes.values()].filter((vote) => vote === null).length, 4);
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
    if (game.eligible(p)) game.act(p, target.id);
  game.wake();
  const a = game.players.find((p) => p.role === "citizen")!;
  const b = game.players.find((p) => p !== a)!;
  assert.equal(game.playerView(a).day!.remaining, 90);
  assert.throws(() => game.dayVote(a, b.id));
  now = 90_000;
  game.tick();
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

test("Todos sem voto: nenhuma morte e novo dia reinicia em 90 segundos", () => {
  let now = 0;
  const game = new Game(() => now);
  for (let i = 0; i < 4; i++) game.join(`Pessoa ${i}`);
  game.draw();
  const assassin = game.players.find((p) => p.role === "assassin")!;
  const doctor = game.players.find((p) => p.role === "doctor")!;
  const detective = game.players.find((p) => p.role === "detective")!;
  const night = () => {
    game.act(assassin, detective.id);
    game.act(doctor, detective.id);
    game.act(detective, assassin.id);
    game.wake();
  };
  night();
  now = 90_000;
  game.tick();
  assert.equal(game.playerView(doctor).day!.remaining, 30);
  now = 120_000;
  assert.throws(() => game.dayVote(assassin, doctor.id));
  assert.equal(game.status, "day");
  game.tick();
  assert.equal(game.adminView().day!.abstentions, 4);
  assert(game.players.every((p) => p.alive));
  assert.equal(game.status, "night");
  assert.equal(game.result, null);
  assert(game.timeline.some((event) => event.text.includes("Ninguém foi eliminado")));
  night();
  assert.equal(game.playerView(doctor).day!.remaining, 90);
});
