import { test } from "node:test";
import assert from "node:assert/strict";
import { DayState } from "../server/websocket/day-state.js";
import { Game } from "../server/websocket/game-state.js";
const voters = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));

test("60s, escolha majoritária, prorrogação de 30s e voto único", () => {
  const day = new DayState(voters, 1000);
  assert.equal(day.remaining(1000), 60);
  assert.equal(day.tick(60_999), false);
  assert.throws(() => day.choose("a", "extend", 1000));
  assert.equal(day.tick(61_000), true);
  assert.throws(() => day.choose("invasor", "vote", 61_000));
  for (const id of ["a", "b", "c"]) day.choose(id, "extend", 61_000);
  assert.throws(() => day.choose("a", "vote", 61_000));
  day.choose("d", "vote", 61_000);
  assert.equal(day.phase, "discussion");
  assert.equal(day.remaining(61_000), 30);
  day.tick(91_000);
  day.choose("a", "extend", 91_000);
  day.choose("b", "extend", 91_000);
  day.choose("c", "vote", 91_000);
  day.choose("d", "vote", 91_000);
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
  const doctor = game.players.find((p) => p.role === "doctor")!;
  for (const p of game.players)
    if (game.eligible(p))
      game.act(
        p,
        p.role === "detective"
          ? game.players.find((t) => t.id !== p.id)!.id
          : doctor.id,
      );
  game.wake();
  const [a, b] = game.players;
  assert.equal(game.playerView(a).day!.remaining, 60);
  assert.throws(() => game.dayVote(a, b.id));
  now = 60_000;
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
  assert.throws(() => game.dayVote(a, b.id));
});

test('Reset preserva o narrador e limpa jogadores', () => {
 const game = new Game(); game.join('Ana'); game.reset();
 assert.equal(game.status, 'waiting'); assert.equal(game.players.length, 0);
 assert.equal(game.adminView().players.length, 0);
});
