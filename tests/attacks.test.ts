import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, selectAttacks } from "../server/websocket/game-state.js";
import { roleDeck } from "../src/lib/game/roles.js";

test("Dois alvos: exatamente 40/40/20, sem favorecer votos repetidos", () => {
  const counts = new Map<string, number>();
  for (let roll = 0; roll < 100; roll++) {
    const key = selectAttacks(["a", "b", "a"], () => roll).join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.deepEqual(
    [...counts],
    [
      ["a", 40],
      ["b", 40],
      ["a,b", 20],
    ],
  );
  assert.deepEqual(selectAttacks(["a", "a"]), ["a"]);
  assert.deepEqual(selectAttacks([]), []);
});

test("Três alvos: todos podem ser escolhidos, nunca há três ataques", () => {
  for (let first = 0; first < 3; first++) {
    for (const roll of [0, 79, 80, 99]) {
      for (let second = 0; second < 2; second++) {
        const draws = [roll, first, second];
        const selected = selectAttacks(["a", "b", "c"], () => draws.shift()!);
        assert.equal(selected[0], ["a", "b", "c"][first]);
        assert.equal(selected.length, roll < 80 ? 1 : 2);
        assert.equal(new Set(selected).size, selected.length);
      }
    }
  }
});

test("Ataque duplo aplica proteção e todas as mortes antes de verificar vitória", () => {
  for (const protectVictim of [true, false]) {
    const game = new Game(
      () => 0,
      () => 90,
    );
    for (let i = 0; i < 6; i++) game.join(`Pessoa ${i}`);
    game.draw();
    game.players.forEach(
      (p, i) =>
        (p.role = (
          [
            "assassin",
            "assassin",
            "doctor",
            "seer",
            "citizen",
            "citizen",
          ] as const
        )[i]),
    );
    const [a, b, doctor, seer, citizen] = game.players;
    assert.throws(() => game.act(doctor, doctor.id));
    assert.equal(game.doctorTarget, null);
    game.act(a, doctor.id);
    game.act(b, seer.id);
    assert.throws(() => game.wake());
    game.act(doctor, protectVictim ? seer.id : citizen.id);
    game.act(seer, a.id);
    assert.equal(game.playerView(seer).vision!.role, "assassin");
    game.wake();
    assert.equal(doctor.alive, false);
    assert.equal(seer.alive, protectVictim);
    assert.equal(game.status, protectVictim ? "day" : "finished");
    assert.equal(
      game.result?.winner ?? null,
      protectVictim ? null : "assassins",
    );
    assert.equal(game.assassinTargets.length, 2);
    assert.throws(() => game.act(doctor, citizen.id));
    assert.throws(() => game.wake());
    if (protectVictim)
      assert(game.timeline.some((e) => e.text.includes("salvo")));
    else assert.equal(game.result!.players.filter((p) => !p.alive).length, 2);
  }
});
