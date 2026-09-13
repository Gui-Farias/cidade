import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/websocket/game-state.js";
import { roleDeck } from "../src/lib/game/roles.js";

function setup(roll = 0) {
  let now = 0;
  const game = new Game(
    () => now,
    () => roll,
  );
  for (let i = 0; i < 9; i++) game.join(`Pessoa ${i}`);
  game.draw();
  game.players.forEach((p, i) => (p.role = roleDeck(9)[i]));
  const [a, b, doctor, sheriff, guard, seer, fool, citizen] = game.players;
  function night(
    options: {
      attacks?: string[];
      protect?: string;
      guard?: string;
      shot?: string;
    } = {},
  ) {
    if (a.alive) game.act(a, options.attacks?.[0] ?? citizen.id);
    if (b.alive)
      game.act(b, options.attacks?.[1] ?? options.attacks?.[0] ?? citizen.id);
    game.act(doctor, options.protect ?? citizen.id);
    game.act(guard, options.guard ?? doctor.id);
    game.act(seer, fool.id);
    if (options.shot) game.act(sheriff, options.shot);
    else game.pass(sheriff);
    game.wake();
  }
  function vote(target: string) {
    now += 80_000;
    game.tick();
    for (const p of game.players.filter((p) => p.alive))
      game.dayChoice(p, "vote");
    for (const p of game.players.filter((p) => p.alive))
      game.dayVote(p, target);
  }
  return {
    game,
    a,
    b,
    doctor,
    sheriff,
    guard,
    seer,
    fool,
    citizen,
    night,
    vote,
  };
}

test("Sorteio inclui os novos papéis uma vez conforme as vagas", () => {
  for (let count = 1; count <= 20; count++) {
    const deck = roleDeck(count);
    assert.equal(deck.length, count);
    const special = ["doctor", "sheriff", "bodyguard", "seer", "fool"];
    const slots = count - (count > 10 ? 3 : count > 5 ? 2 : 1);
    special.forEach((role, i) =>
      assert.equal(deck.filter((r) => r === role).length, slots > i ? 1 : 0),
    );
  }
});

test("Xerife passa sem gastar, não pode passar duas vezes; tiro único sobrevive à reconexão e à próxima noite", () => {
  const g = setup();
  g.game.pass(g.sheriff);
  assert(g.game.playerView(g.sheriff).bulletAvailable);
  assert.throws(() => g.game.pass(g.sheriff));
  assert.throws(() => g.game.act(g.sheriff, g.a.id));
  assert.throws(() => g.game.pass(g.citizen));
  const fired = setup();
  fired.night({ shot: fired.a.id });
  assert.equal(fired.a.alive, false);
  assert.equal(fired.game.playerView(fired.sheriff).bulletAvailable, false);
  fired.vote(fired.citizen.id);
  assert.equal(fired.game.status, "night");
  assert.equal(fired.game.playerView(fired.sheriff).action, null);
  assert.equal(fired.game.sheriffTarget, null);
  assert.equal(fired.game.sheriffSpent, true);
  assert.throws(() => fired.game.act(fired.sheriff, fired.b.id));
  assert.throws(() => fired.game.pass(fired.sheriff));
  const tokens = fired.game.players.map((p) => p.token);
  fired.game.act(fired.b, fired.fool.id);
  fired.game.act(fired.doctor, fired.b.id);
  fired.game.act(fired.guard, fired.doctor.id);
  fired.game.act(fired.seer, fired.b.id);
  fired.game.wake();
  fired.vote(fired.b.id);
  fired.game.restart();
  assert.equal(fired.game.sheriffSpent, false);
  assert.deepEqual(
    fired.game.players.map((p) => p.token),
    tokens,
  );
});

test("Guarda-costas salva de ataque duplo e tiro; Médico evita sacrifício ao proteger o alvo", () => {
  for (const doctorSaves of [true, false]) {
    const g = setup(90);
    assert.throws(() => g.game.act(g.guard, g.guard.id));
    g.night({
      attacks: [g.citizen.id, g.guard.id],
      guard: g.citizen.id,
      protect: doctorSaves ? g.citizen.id : g.guard.id,
      shot: g.citizen.id,
    });
    assert.equal(g.citizen.alive, true);
    // A direct attack kills the guard even when the protected target is saved by the doctor.
    assert.equal(g.guard.alive, false);
    assert.equal(g.game.players.filter((p) => !p.alive).length, 1);
  }
  const safe = setup();
  safe.night({ guard: safe.citizen.id, shot: safe.citizen.id });
  assert(safe.game.players.every((p) => p.alive));
  assert(safe.game.sheriffSpent);
  const shot = setup();
  shot.night({ guard: shot.fool.id, shot: shot.fool.id });
  assert.equal(shot.guard.alive, false);
  assert.equal(shot.fool.alive, true);
  assert.equal(shot.game.result, null);
});

test("Ações simultâneas: Xerife morto ainda dispara, Guarda-costas morto ainda protege", () => {
  const g = setup(90);
  g.night({
    attacks: [g.sheriff.id, g.guard.id],
    guard: g.fool.id,
    shot: g.fool.id,
  });
  assert.equal(g.sheriff.alive, false);
  assert.equal(g.guard.alive, false);
  assert.equal(g.fool.alive, true);
  assert(g.game.timeline.some((e) => e.text.includes("se sacrificou")));
});

test("Vidente recebe papel exato só para si; não pode ver a si, repetir ou agir morta", () => {
  const g = setup();
  assert.throws(() => g.game.act(g.seer, g.seer.id));
  g.game.act(g.seer, g.fool.id);
  assert.deepEqual(g.game.playerView(g.seer).vision, {
    name: g.fool.name,
    role: "fool",
  });
  for (const p of g.game.players.filter((p) => p !== g.seer))
    assert.equal(g.game.playerView(p).vision, null);
  assert.equal(g.game.adminView().seerTarget, g.fool.id);
  assert.throws(() => g.game.act(g.seer, g.a.id));
  assert.throws(() => g.game.act(g.fool, g.a.id));
  g.seer.alive = false;
  assert.equal(g.game.playerView(g.seer).action, null);
  assert.throws(() => g.game.act(g.seer, g.a.id));
});

test("Rei Louco só vence eliminado pelo povo; mortes noturnas não encerram a partida", () => {
  for (const cause of ["assassins", "sheriff", "city"]) {
    const g = setup();
    g.night(
      cause === "assassins"
        ? { attacks: [g.fool.id] }
        : cause === "sheriff"
          ? { shot: g.fool.id }
          : {},
    );
    if (cause === "city") {
      g.vote(g.fool.id);
      assert.equal(g.game.result!.winner, "fool");
      assert.equal(g.game.status, "finished");
      assert.equal(g.game.day, null);
      assert.equal(g.game.playerView(g.fool).result!.winner, "fool");
    } else {
      assert.equal(g.fool.alive, false);
      assert.equal(g.game.result, null);
      g.vote(g.citizen.id);
      assert.equal(g.game.status, "night");
      assert.equal(g.game.result, null);
    }
  }
  const priority = setup();
  priority.a.alive = false;
  priority.night({ shot: priority.b.id, attacks: [priority.fool.id] });
  assert.equal(priority.game.result!.winner, "city");
});

test("Rei Louco vence também no desempate da votação; proteção não impede eliminação pelo povo", () => {
  const g = setup();
  g.night({ attacks: [g.fool.id], protect: g.fool.id, guard: g.fool.id });
  assert.equal(g.fool.alive, true);
  // Advance the real day state to the public voting phase.
  g.game.day!.tick(80_000);
  for (const p of g.game.players) g.game.dayChoice(p, "vote");
  g.game.players.forEach((p, i) =>
    g.game.dayVote(p, i < 4 ? g.fool.id : i < 8 ? g.citizen.id : g.a.id),
  );
  assert.equal(g.game.day!.phase, "tie");
  assert.equal(g.game.result, null);
  g.game.resolveCity(g.fool.id);
  assert.equal(g.game.result!.winner, "fool");
});
