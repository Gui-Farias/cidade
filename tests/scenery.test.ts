import assert from "node:assert/strict";
import { test } from "node:test";
import { pointAlong, residentDestination, residentsFor, visibleResidents } from "../src/lib/scenery/village.js";
import { Game } from "../server/websocket/game-state.js";

test("moradores compartilham casas sem sobrepor caminhos e se espalham pela praça", () => {
  const players = Array.from({ length: 24 }, (_, index) => ({
    id: `morador-${index}`, name: `Pessoa ${index}`, sceneSlot: index, alive: true, connected: true,
  }));
  const first = residentsFor(players);
  assert.deepEqual(first, residentsFor(players));
  assert.equal(first.length, players.length);
  assert.equal(new Set(first.map((resident) => resident.homeSlot)).size, 6);
  assert.equal(new Set(first.map((resident) => `${resident.gathering.x},${resident.gathering.y}`)).size, players.length);
  for (let index = 0; index < 6; index++) {
    const housemates = [first[index], first[index + 6], first[index + 12], first[index + 18]];
    assert(housemates.every((resident) => resident.homeSlot === index));
    assert(housemates.every((resident) => resident.house === housemates[0].house));
    assert(housemates.every((resident) => resident.houseWidth === housemates[0].houseWidth));
    for (const resident of housemates) assert.deepEqual(resident.route.slice(0, -1), housemates[0].route.slice(0, -1));
  }
  for (let index = 0; index < first.length; index++) for (let other = index + 1; other < first.length; other++) {
    assert(Math.hypot(first[index].gathering.x - first[other].gathering.x,
      first[index].gathering.y - first[other].gathering.y) >= 100);
  }
  for (const resident of first) {
    assert(resident.house >= 0 && resident.house < 4);
    assert(resident.character >= 0 && resident.character < 4);
    assert.deepEqual(pointAlong(resident.route, 0).point, resident.door);
    assert.deepEqual(pointAlong(resident.route, 1).point, resident.gathering);
    assert(Math.hypot(resident.entrance.x, resident.entrance.y) < 330);
  }
});

test("em telas desktop, nove jogadores ocupam nove casas antes de compartilhar moradia", () => {
  const players = Array.from({ length: 24 }, (_, index) => ({
    id: `morador-${index}`, name: `Pessoa ${index}`, sceneSlot: index, alive: true, connected: true,
  }));
  const residents = residentsFor(players, 9);
  assert.equal(new Set(residents.map((resident) => resident.homeSlot)).size, 9);
  for (let index = 0; index < 9; index++) {
    assert.equal(residents[index].homeSlot, index);
    assert.equal(residents[index + 9].homeSlot, index);
    assert.deepEqual(residents[index + 9].home, residents[index].home);
  }
  for (const [outer, neighbor] of [[6, 0], [7, 1]]) {
    const branch = residents[outer];
    const main = residents[neighbor];
    assert.equal(branch.sharedWith, neighbor);
    const join = branch.route[branch.sharedFrom!];
    const mainJoin = main.route.findIndex((point) => point.x === join.x && point.y === join.y);
    assert(mainJoin >= 0);
    assert.deepEqual(branch.route.slice(branch.sharedFrom!, -1), main.route.slice(mainJoin, -1));
  }
});

test("moradores voltam à casa quando a noite está pronta e retornam quando a cidade acorda", () => {
  assert.equal(residentDestination("waiting", false, true), "plaza");
  assert.equal(residentDestination("night", false, true), "plaza");
  assert.equal(residentDestination("night", true, true), "home");
  assert.equal(residentDestination("day", false, true), "plaza");
  assert.equal(residentDestination("day", false, false), "home");
});

test("uma saída não muda a casa dos outros jogadores", () => {
  const game = new Game();
  const first = game.join("Primeiro");
  const second = game.join("Segundo");
  const third = game.join("Terceiro");
  const original = residentsFor(game.adminView().players).find((resident) => resident.id === third.id)!.home;
  game.removePlayer(second.id);
  assert.deepEqual(residentsFor(game.adminView().players).find((resident) => resident.id === third.id)!.home, original);
  assert.equal(game.join("Novo").sceneSlot, second.sceneSlot);
  assert.equal(first.sceneSlot, 0);
});

test("a casa do próprio jogador aparece mesmo com estado de servidor anterior", () => {
  const game = new Game();
  const player = game.join("Morador");
  const neighbor = game.join("Vizinho");
  const current = game.playerView(player);
  assert.equal(visibleResidents(current).length, 2);
  assert.deepEqual(
    residentsFor(visibleResidents(current)).map((resident) => resident.home),
    residentsFor(visibleResidents(game.adminView())).map((resident) => resident.home),
  );
  const older = { ...current, players: undefined } as unknown as typeof current;
  assert.deepEqual(visibleResidents(older), [current.player]);
  assert.equal(residentsFor(visibleResidents(older)).length, 1);
  assert.equal(neighbor.sceneSlot, 1);
});
