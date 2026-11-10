import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/websocket/game-state.js";
import { RoomManager } from "../server/websocket/room-manager.js";
import {
  defaultRoleCounts,
  parseRoleCounts,
  roleDeck,
} from "../src/lib/game/roles.js";
import type { Role, RoleCounts } from "../src/lib/game/types.js";

function setup(overrides: Partial<RoleCounts> = {}, citizens = 3) {
  let now = 0;
  const game = new Game(
    () => now,
    () => 0,
  );
  game.roleCounts = { ...defaultRoleCounts(), ...overrides };
  const count =
    Object.values(game.roleCounts).reduce((sum, n) => sum + n, 0) + citizens;
  for (let i = 0; i < count; i++) game.join(`Pessoa ${i}`);
  game.draw();
  const deck = roleDeck(count, game.roleCounts);
  game.players.forEach((p, i) => (p.role = deck[i]));
  const byRole = (role: Role) => game.players.filter((p) => p.role === role);
  function finishNight() {
    for (const p of game.pendingPlayers()) {
      if (p.role === "sheriff") game.pass(p);
      else
        game.act(
          p,
          game.targets(p).find((target) => target.role === "citizen")!.id,
        );
    }
    game.wake();
  }
  function vote(target: string | null = null) {
    now += 90_000;
    game.tick();
    for (const p of game.players.filter((p) => p.alive))
      game.dayVote(p, target);
  }
  return { game, byRole, finishNight, vote };
}

test("Configuração rejeita papéis desconhecidos, cidadãos, quantidades inválidas e obrigatórios ausentes", () => {
  for (const invalid of [
    null,
    [],
    undefined,
    {},
    "roles",
    { ...defaultRoleCounts(), citizen: 1 },
    { ...defaultRoleCounts(), other: 0 },
  ])
    assert.throws(() => parseRoleCounts(invalid));
  for (const count of [
    -1,
    1.5,
    "2",
    null,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws(() =>
      parseRoleCounts({ ...defaultRoleCounts(), seer: count }),
    );
  for (const role of ["assassin", "doctor", "detective"])
    assert.throws(
      () => parseRoleCounts({ ...defaultRoleCounts(), [role]: 0 }),
      /obrigatório/,
    );
  const counts = { ...defaultRoleCounts(), assassin: 3, seer: 7 };
  assert.deepEqual(parseRoleCounts(counts), counts);
  assert.notEqual(parseRoleCounts(counts), counts);
  const rooms = new RoomManager();
  assert.throws(() => rooms.create({ ...counts, doctor: 0 }));
  assert.equal(rooms.rooms.size, 0);
});

test("Sorteio exige quatro jogadores além do narrador e vagas para todos os papéis", () => {
  const game = new Game();
  game.adminToken = "narrador";
  for (let count = 0; count < 4; count++) {
    assert.throws(() => game.draw(), /4 jogadores, além do Narrador/);
    assert.equal(game.status, "waiting");
    assert(game.players.every((p) => p.role === null));
    game.join(`Pessoa ${count}`);
  }
  game.draw();
  assert.equal(game.players.length, 4);
  assert.equal(game.players.filter((p) => p.role === "citizen").length, 1);
  assert.equal(game.status, "night");
  assert.throws(
    () => roleDeck(4, { ...defaultRoleCounts(), doctor: 3 }),
    /5 jogadores/,
  );
  const deck = roleDeck(10, {
    ...defaultRoleCounts(),
    assassin: 3,
    seer: 1,
    bodyguard: 1,
  });
  assert.equal(deck.filter((r) => r === "citizen").length, 3);
});

test("Videntes e Detetives têm ações e informações privadas independentes", () => {
  const { game, byRole, finishNight, vote } = setup({ seer: 2, detective: 2 });
  const [s1, s2] = byRole("seer"),
    [d1, d2] = byRole("detective");
  const [assassin] = byRole("assassin"),
    [citizen] = byRole("citizen");
  game.act(s1, assassin.id);
  assert.equal(game.playerView(s1).vision!.role, "assassin");
  assert.equal(game.playerView(s2).vision, null);
  assert(game.playerView(s2).action);
  assert(game.pendingPlayers().includes(s2));
  game.act(s2, citizen.id);
  game.act(d1, assassin.id);
  assert.equal(game.playerView(d2).investigation, null);
  game.act(d2, citizen.id);
  assert.equal(game.playerView(s1).vision!.name, assassin.name);
  assert.equal(game.playerView(s2).vision!.role, "citizen");
  assert.equal(game.playerView(d1).investigation!.isAssassin, true);
  assert.equal(game.playerView(d2).investigation!.isAssassin, false);
  assert.throws(() => game.act(s1, citizen.id));
  for (const p of game.players) {
    assert(!("nightActions" in game.playerView(p)));
    assert(!("roleCounts" in game.playerView(p)));
  }
  assert.equal(
    game.adminView().nightActions.find((a) => a.playerId === s2.id)!.targetId,
    citizen.id,
  );
  finishNight();
  assert.equal(game.playerView(s1).vision, null);
  vote();
  for (const p of [s1, s2, d1, d2]) {
    assert(game.playerView(p).action);
    assert.equal(game.playerView(p).submitted, false);
    assert.equal(game.playerView(p).vision, null);
    assert.equal(game.playerView(p).investigation, null);
  }
});

test("Médicos protegem alvos diferentes e cada Xerife mantém suas próprias duas balas", () => {
  const { game, byRole, finishNight, vote } = setup({ doctor: 2, sheriff: 2 });
  const [doctor1, doctor2] = byRole("doctor"),
    [sheriff1, sheriff2] = byRole("sheriff");
  const [a, b] = byRole("citizen");
  for (let night = 0; night < 3; night++) {
    game.act(doctor1, a.id);
    assert(game.playerView(doctor2).action);
    game.act(doctor2, b.id);
    if (night < 2) game.act(sheriff1, b.id);
    else assert.equal(game.playerView(sheriff1).action, null);
    if (night === 0) game.pass(sheriff2);
    else game.act(sheriff2, b.id);
    assert.equal(
      game.playerView(sheriff1).bulletsAvailable,
      Math.max(0, 1 - night),
    );
    assert.equal(game.playerView(sheriff2).bulletsAvailable, 2 - night);
    finishNight();
    assert(game.players.every((p) => p.alive));
    if (night < 2) vote();
  }
  vote(byRole("assassin")[0].id);
  assert.equal(game.status, "finished");
  const configuration = { ...game.roleCounts };
  game.restart();
  assert.deepEqual(game.roleCounts, configuration);
  assert.equal(game.nightChoices.size, 0);
  for (const p of game.players.filter((p) => p.role === "sheriff"))
    assert.equal(game.playerView(p).bulletsAvailable, 2);
});

test("Guarda-costas protegem independentemente e Médico evita sacrifício", () => {
  const { game, byRole, finishNight } = setup({ bodyguard: 2, sheriff: 1 });
  const [guard1, guard2] = byRole("bodyguard"),
    [a, b, c] = byRole("citizen");
  game.act(guard1, a.id);
  assert(game.playerView(guard2).action);
  game.act(guard2, b.id);
  game.act(byRole("assassin")[0], a.id);
  game.act(byRole("sheriff")[0], b.id);
  game.act(byRole("doctor")[0], c.id);
  finishNight();
  assert(a.alive && b.alive);
  assert(!guard1.alive && !guard2.alive);
  const saved = setup({ bodyguard: 2 });
  const [target] = saved.byRole("citizen");
  for (const guard of saved.byRole("bodyguard"))
    saved.game.act(guard, target.id);
  saved.finishNight();
  assert(saved.game.players.every((p) => p.alive));
});

test("Dois Guarda-costas no mesmo alvo provocam apenas um sacrifício", () => {
  const { game, byRole, finishNight } = setup({ bodyguard: 2 });
  const [a, b] = byRole("citizen");
  for (const guard of byRole("bodyguard")) game.act(guard, a.id);
  game.act(byRole("doctor")[0], b.id);
  finishNight();
  assert(a.alive);
  assert.equal(byRole("bodyguard").filter((p) => !p.alive).length, 1);
});

test("Vários Reis Loucos: só o eliminado pelo povo recebe a vitória individual", () => {
  const { game, byRole, finishNight, vote } = setup({ fool: 2 });
  const [winner, other] = byRole("fool");
  finishNight();
  vote(winner.id);
  assert.equal(game.result!.winner, "fool");
  assert.equal(game.result!.winnerId, winner.id);
  assert(other.alive);
});
