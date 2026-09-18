import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/websocket/game-state.js";
import { roleDeck } from "../src/lib/game/roles.js";

function setup(count: number) {
  let now = 0;
  const game = new Game(() => now);
  for (let i = 0; i < count; i++) game.join(`Pessoa ${i}`);
  game.draw();
  // Fixed assignment makes the scenarios reproducible without replacing any rules.
  game.players.forEach((p, i) => (p.role = roleDeck(count)[i]));
  const assassin = game.players.find((p) => p.role === "assassin")!;
  const doctor = game.players.find((p) => p.role === "doctor");
  function night(targetId: string, protectId = targetId) {
    for (const p of game.players)
      if (p.role === "sheriff" && game.eligible(p)) game.pass(p);
      else if (game.eligible(p))
        game.act(
          p,
          p.role === "assassin"
            ? targetId
            : p.role === "doctor"
              ? protectId
              : assassin.id,
        );
    game.wake();
  }
  function voting() {
    now += 80_000;
    game.tick();
    for (const p of game.players.filter((p) => p.alive))
      game.dayChoice(p, "vote");
  }
  return { game, assassin, doctor, night, voting };
}

test("Composição inclui o segundo assassino no sexto jogador e o terceiro no décimo primeiro", () => {
  for (let count = 1; count <= 20; count++) {
    const { game } = setup(count);
    assert.equal(game.players.length, count);
    assert.equal(
      game.players.filter((p) => p.role === "assassin").length,
      count > 10 ? 3 : count >= 6 ? 2 : 1,
    );
    assert.equal(game.status, count <= 2 ? "finished" : "night");
  }
});

test("Morte noturna em paridade encerra; proteção mantém a partida", () => {
  const saved = setup(3);
  saved.night(saved.game.players.find((p) => p.role === "seer")!.id);
  assert.equal(saved.game.status, "day");
  assert.equal(saved.game.result, null);
  const killed = setup(3);
  killed.night(killed.doctor!.id, killed.assassin.id);
  assert.equal(killed.game.result!.winner, "assassins");
  assert.equal(killed.game.status, "finished");
  assert.equal(killed.game.day, null);
  assert.equal(killed.game.tick(), false);
  assert.throws(() => killed.game.wake());
  assert.throws(() => killed.game.act(killed.assassin, killed.doctor!.id));
  assert.throws(() => killed.game.dayChoice(killed.assassin, "vote"));
  assert.throws(() => killed.game.join("Tarde"));
});

test("Cidade vence ao eliminar último assassino; reinício preserva identidades e limpa histórico", () => {
  const { game, assassin, doctor, night, voting } = setup(5);
  game.adminToken = "narrador";
  night(game.players.find((p) => p.role === "seer")!.id);
  voting();
  assert.equal(game.playerView(doctor!).result, null);
  for (const p of game.players) game.dayVote(p, assassin.id);
  assert.equal(game.result!.winner, "city");
  assert(
    game.result!.timeline.some(
      (e) => e.phase === "day" && e.text.includes("eliminado"),
    ),
  );
  assert.equal(game.playerView(doctor!).result!.players.length, 5);
  const identities = game.players.map((p) => p.token);
  game.restart();
  assert.equal(game.adminToken, "narrador");
  assert.deepEqual(
    game.players.map((p) => p.token),
    identities,
  );
  assert(game.players.every((p) => p.alive));
  assert.equal(game.result, null);
  assert.equal(game.timeline.length, 1);
  assert.equal(game.day, null);
  assert.throws(() => game.restart());
});

test("Voto da cidade em inocente pode dar vitória aos assassinos", () => {
  const { game, doctor, night, voting } = setup(3);
  night(game.players.find((p) => p.role === "seer")!.id);
  voting();
  for (const p of game.players) game.dayVote(p, doctor!.id);
  assert.equal(game.result!.winner, "assassins");
  assert.equal(game.result!.timeline.at(-1)!.phase, "day");
});

test("Empate da cidade só encerra depois do desempate do Narrador", () => {
  const { game, assassin, doctor, night, voting } = setup(4);
  night(game.players.find((p) => p.role === "seer")!.id);
  voting();
  game.players.forEach((p, i) =>
    game.dayVote(p, i < 2 ? assassin.id : doctor!.id),
  );
  assert.equal(game.result, null);
  assert.equal(game.day!.phase, "tie");
  game.resolveCity(assassin.id);
  assert.equal(game.result!.winner, "city");
  assert.throws(() => game.resolveCity(doctor!.id));
});

test("Sem sobreviventes encerra sem timer nem votação vazia", () => {
  const { game } = setup(3);
  game.players.forEach((p) => (p.alive = false));
  game.wake();
  assert.equal(game.result!.winner, "draw");
});
