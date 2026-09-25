import { randomInt, randomUUID } from "node:crypto";
import type {
  AdminView,
  PlayerView,
  Role,
  Status,
  Turn,
  GameResult,
  TimelineEvent,
  RoleCounts,
  NightAction,
} from "../../src/lib/game/types.js";
import {
  defaultRoleCounts,
  roleDeck,
  SHERIFF_BULLETS,
} from "../../src/lib/game/roles.js";
import { MAX_DAY_EXTENSIONS } from "../../src/lib/game/types.js";
export type Player = {
  id: string;
  token: string;
  name: string;
  role: Role | null;
  alive: boolean;
  connected: boolean;
};
import { DayState } from "./day-state.js";
export class Game {
  result: GameResult | null = null;
  timeline: TimelineEvent[] = [];
  private record(phase: "day" | "night", text: string) {
    this.timeline.push({ round: this.night, phase, text });
  }
  private checkWinner(phase: "day" | "night" = "night") {
    const living = this.players.filter((p) => p.alive);
    const assassins = living.filter((p) => p.role === "assassin").length;
    const winner =
      phase === "day" &&
      this.players.some(
        (p) => p.role === "fool" && !p.alive && p.id === this.day?.eliminated,
      )
        ? "fool"
        : living.length === 0
          ? "draw"
          : assassins === 0
            ? "city"
            : assassins >= living.length - assassins
              ? "assassins"
              : null;
    if (!winner) return false;
    this.status = "finished";
    this.record(
      phase,
      winner === "fool"
        ? "O Rei Louco foi eliminado pelo povo e venceu sozinho."
        : winner === "city"
          ? "A cidade encontrou todos os assassinos."
          : winner === "assassins"
            ? "Os assassinos assumiram o controle da cidade."
            : "Não restaram sobreviventes.",
    );
    this.result = {
      winner,
      rounds: this.night,
      winnerId: winner === "fool" ? this.day!.eliminated : null,
      players: this.players.map((p) => ({
        ...this.publicPlayer(p),
        role: p.role,
      })),
      timeline: [...this.timeline],
    };
    this.day = null;
    return true;
  }
  restart() {
    if (this.status !== "finished")
      throw new Error("Aguarde o fim da partida para sortear novamente.");
    const players = this.players;
    this.reset();
    this.players = players;
    for (const player of players) {
      player.alive = true;
      player.role = null;
    }
    this.draw();
  }
  day: DayState | null = null;
  constructor(
    private now: () => number = Date.now,
    private random: (max: number) => number = randomInt,
  ) {}
  tick() {
    const changed = this.status === "day" && !!this.day?.tick(this.now());
    if (changed && this.day?.phase === "voting")
      this.record(
        "day",
        "As duas prorrogações terminaram. A votação começou automaticamente.",
      );
    return changed;
  }
  dayChoice(p: Player, choice: unknown) {
    if (this.status !== "day" || !p.alive || !this.day)
      throw new Error("Votação indisponível.");
    this.day.choose(p.id, choice, this.now());
    if (this.day.phase === "discussion")
      this.record("day", "A cidade escolheu conversar por mais 30 segundos.");
    if (this.day.phase === "voting")
      this.record("day", "A cidade decidiu iniciar a votação.");
  }
  dayVote(p: Player, target: unknown) {
    if (this.status !== "day" || !p.alive || !this.day)
      throw new Error("Votação indisponível.");
    this.day.vote(p.id, target);
    this.finishDay();
  }
  private finishDay() {
    if (this.day?.phase !== "completed") return;
    const victim = this.players.find((p) => p.id === this.day!.eliminated);
    if (victim) {
      victim.alive = false;
      this.record(
        "day",
        this.day!.tiebreaker
          ? `A votação empatou; o sorteio eliminou ${victim.name}.`
          : `${victim.name} foi eliminado pela cidade.`,
      );
    } else
      this.record(
        "day",
        "Todos se abstiveram. Ninguém foi eliminado pela cidade.",
      );
    if (this.checkWinner("day")) return;
    this.startNight();
  }
  private dayView(p?: Player) {
    if (!this.day) return null;
    return {
      phase: this.day.phase,
      remaining: this.day.remaining(this.now()),
      duration: this.day.duration,
      extensionsRemaining: Math.max(
        0,
        MAX_DAY_EXTENSIONS - this.day.extensions,
      ),
      submitted:
        !!p &&
        (this.day.phase === "decision"
          ? this.day.decisions.has(p.id)
          : this.day.votes.has(p.id)),
      targets:
        p?.alive && this.day.phase === "voting" && !this.day.votes.has(p.id)
          ? this.day.voters
          : [],
    };
  }
  roleCounts: RoleCounts = defaultRoleCounts();
  adminToken: string | null = null;
  players: Player[] = [];
  status: Status = "waiting";
  night = 0;
  assassinTarget: string | null = null;
  assassinTargets: string[] = [];
  assassinVotes = new Map<string, string>();
  nightChoices = new Map<string, string | null>();
  bullets = new Map<string, number>();
  bulletsAvailable(p: Player) {
    return this.bullets.get(p.id) ?? SHERIFF_BULLETS;
  }
  outcome: string | null = null;
  reset() {
    this.players = [];
    this.status = "waiting";
    this.day = null;
    this.night = 0;
    this.assassinTarget = null;
    this.assassinTargets = [];
    this.assassinVotes.clear();
    this.outcome = null;
    this.result = null;
    this.timeline = [];
    this.nightChoices.clear();
    this.bullets.clear();
  }
  join(name: unknown) {
    if (this.status !== "waiting")
      throw new Error("A partida já começou. Aguarde uma próxima sessão.");
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 32 ||
      /[\p{Cc}\p{Cf}]/u.test(name)
    )
      throw new Error("Informe um nome de 1 a 32 caracteres.");
    const player: Player = {
      id: randomUUID(),
      token: randomUUID(),
      name: name.trim(),
      role: null,
      alive: true,
      connected: true,
    };
    this.players.push(player);
    return player;
  }
  removePlayer(id: unknown) {
    if (this.status !== "waiting")
      throw new Error("Jogadores só podem ser removidos antes do sorteio.");
    const index = this.players.findIndex((player) => player.id === id);
    if (index === -1) throw new Error("Jogador não encontrado.");
    return this.players.splice(index, 1)[0];
  }
  draw() {
    if (this.status !== "waiting")
      throw new Error("Os papéis já foram sorteados.");
    const deck = roleDeck(this.players.length, this.roleCounts);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.players.forEach((p, i) => (p.role = deck[i]));
    this.status = "night";
    this.night = 1;
    this.record(
      "night",
      `${this.players.length} jogadores receberam seus papéis.`,
    );
    this.checkWinner();
  }
  private startNight() {
    if (this.status !== "day" || this.day?.phase !== "completed")
      throw new Error("A próxima noite só pode começar depois do dia.");
    this.status = "night";
    this.night++;
    this.nightChoices.clear();
    this.assassinTarget = null;
    this.assassinTargets = [];
    this.assassinVotes.clear();
    this.outcome = null;
  }
  actionTurn(p: Player): Turn | null {
    return p.role === "assassin"
      ? "assassins"
      : p.role === "doctor" ||
          p.role === "bodyguard" ||
          p.role === "seer" ||
          p.role === "detective" ||
          (p.role === "sheriff" && this.bulletsAvailable(p) > 0)
        ? p.role
        : null;
  }
  eligible(p: Player) {
    return (
      this.status === "night" &&
      p.alive &&
      this.actionTurn(p) !== null &&
      this.targets(p).length > 0
    );
  }
  pendingPlayers() {
    return this.players.filter((p) => this.eligible(p) && !this.chosen(p));
  }
  chosen(p: Player) {
    return p.role === "assassin"
      ? this.assassinVotes.has(p.id)
      : this.nightChoices.has(p.id);
  }
  targets(p: Player) {
    return this.players.filter(
      (t) =>
        t.alive &&
        (p.role !== "assassin" || t.role !== "assassin") &&
        t.id !== p.id,
    );
  }
  act(p: Player, id: unknown) {
    if (!this.eligible(p) || this.chosen(p))
      throw new Error("Ação indisponível ou já confirmada neste turno.");
    const target = this.targets(p).find((t) => t.id === id);
    if (!target) throw new Error("Escolha um jogador vivo e válido.");
    if (p.role === "assassin") {
      this.assassinVotes.set(p.id, target.id);
      const targets = [...new Set(this.assassinVotes.values())];
      this.assassinTarget = targets.length === 1 ? targets[0] : null;
    }
    if (p.role !== "assassin") this.nightChoices.set(p.id, target.id);
    if (p.role === "sheriff")
      this.bullets.set(p.id, this.bulletsAvailable(p) - 1);
  }
  pass(p: Player) {
    if (p.role !== "sheriff" || !this.eligible(p) || this.chosen(p))
      throw new Error("Você não pode passar esta ação.");
    this.nightChoices.set(p.id, null);
  }

  assassinConflict() {
    return (
      new Set(this.assassinVotes.values()).size > 1 && !this.assassinTarget
    );
  }
  wake() {
    if (this.status !== "night") throw new Error("A cidade não está dormindo.");
    if (this.pendingPlayers().length)
      throw new Error(
        "Aguarde todos os jogadores confirmarem suas ações noturnas.",
      );
    const votedTargets = [...new Set(this.assassinVotes.values())];
    this.assassinTargets = selectAttacks(votedTargets, this.random);
    this.assassinTarget = this.assassinTargets[0] ?? null;
    const attacks = new Set(this.assassinTargets);
    const shooters = this.players.filter(
      (p) => p.alive && p.role === "sheriff" && this.nightChoices.get(p.id),
    );
    for (const shooter of shooters)
      attacks.add(this.nightChoices.get(shooter.id)!);
    const protectedTargets = new Set(
      this.players
        .filter((p) => p.alive && p.role === "doctor")
        .map((p) => this.nightChoices.get(p.id)),
    );
    const guards = this.players.filter(
      (p) => p.alive && p.role === "bodyguard",
    );
    const victims = this.players.filter((p) => p.alive && attacks.has(p.id));
    const deaths = new Set<string>();
    for (const victim of victims) {
      if (protectedTargets.has(victim.id)) {
        this.record("night", `${victim.name} foi salvo pelo Médico.`);
      } else {
        const protectors = guards.filter(
          (guard) => this.nightChoices.get(guard.id) === victim.id,
        );
        if (protectors.length) {
          // One sacrifice per attacked person; all night actions remain simultaneous.
          const guard = protectors[randomInt(protectors.length)];
          deaths.add(guard.id);
          this.record(
            "night",
            `${guard.name} se sacrificou para salvar ${victim.name}.`,
          );
        } else deaths.add(victim.id);
      }
    }
    this.outcome = "Ninguém morreu durante a noite.";
    const killed = this.players.filter((p) => deaths.has(p.id));
    if (killed.length) {
      killed.forEach((p) => (p.alive = false));
      this.outcome = `${killed.map((p) => p.name).join(" e ")} ${killed.length === 1 ? "morreu" : "morreram"} durante a noite.`;
    }
    if (votedTargets.length > 1)
      this.record(
        "night",
        `O sorteio escolheu atacar: ${this.players
          .filter((p) => this.assassinTargets.includes(p.id))
          .map((p) => p.name)
          .join(" e ")}.`,
      );
    for (const shooter of shooters)
      this.record(
        "night",
        `${shooter.name} (Xerife) disparou em ${this.players.find((p) => p.id === this.nightChoices.get(shooter.id))!.name}.`,
      );
    this.record("night", this.outcome);
    if (this.checkWinner()) return;
    this.status = "day";
    this.day = new DayState(
      this.players
        .filter((p) => p.alive)
        .map((p) => ({ id: p.id, name: p.name })),
      this.now(),
      this.random,
    );
  }
  publicPlayer(p: Player) {
    return { id: p.id, name: p.name, alive: p.alive, connected: p.connected };
  }
  adminView(): AdminView {
    return {
      kind: "admin",
      roleCounts: { ...this.roleCounts },
      nightActions: this.players
        .filter(
          (p) => p.role && !["assassin", "citizen", "fool"].includes(p.role),
        )
        .map((p) => ({
          playerId: p.id,
          role: p.role as NightAction["role"],
          targetId: this.nightChoices.get(p.id) ?? null,
          passed:
            this.nightChoices.has(p.id) && this.nightChoices.get(p.id) === null,
          bulletsAvailable: p.role === "sheriff" ? this.bulletsAvailable(p) : 0,
        })),
      result: this.result,
      day: this.day
        ? {
            ...this.dayView()!,
            pending: this.day.pending(),
            votes: [...this.day.votes].map(([playerId, targetId]) => ({
              playerId,
              targetId,
            })),
            tally: this.day.tally(),
            abstentions: [...this.day.votes.values()].filter(
              (target) => target === null,
            ).length,
            tiebreaker: this.day.tiebreaker,
            eliminated: this.day.eliminated,
          }
        : null,
      status: this.status,
      pendingPlayers: this.pendingPlayers().map((p) => ({
        id: p.id,
        name: p.name,
      })),
      canWake: this.status === "night" && this.pendingPlayers().length === 0,
      night: this.night,
      players: this.players.map((p) => ({
        ...this.publicPlayer(p),
        role: p.role,
      })),
      assassinTarget: this.assassinTarget,
      assassinTargets: this.assassinTargets,
      assassinVotes: this.players
        .filter((p) => p.role === "assassin" && p.alive)
        .map((p) => ({
          playerId: p.id,
          targetId: this.assassinVotes.get(p.id) ?? null,
        })),
      assassinConflict: this.assassinConflict(),
      outcome: this.outcome,
    };
  }
  playerView(p: Player): PlayerView {
    const eligible = this.eligible(p);
    const seen = this.players.find((t) => t.id === this.nightChoices.get(p.id));
    const investigated = this.players.find(
      (t) => t.id === this.nightChoices.get(p.id),
    );
    return {
      kind: "player",
      result: this.result,
      day: this.status === "day" ? this.dayView(p) : null,
      status: this.status,
      player: { ...this.publicPlayer(p), role: p.role },
      action:
        eligible && !this.chosen(p)
          ? {
              turn: this.actionTurn(p)!,
              targets: this.targets(p).map((t) => ({ id: t.id, name: t.name })),
            }
          : null,
      partners:
        p.role === "assassin"
          ? this.players
              .filter((t) => t.role === "assassin" && t.id !== p.id)
              .map((t) => ({ id: t.id, name: t.name }))
          : [],
      submitted: this.status === "night" && p.alive && !!this.chosen(p),
      bulletsAvailable: p.role === "sheriff" ? this.bulletsAvailable(p) : 0,
      vision:
        this.status === "night" && p.role === "seer" && seen?.role
          ? { name: seen.name, role: seen.role }
          : null,
      investigation:
        this.status === "night" && p.role === "detective" && investigated?.role
          ? {
              name: investigated.name,
              isAssassin: investigated.role === "assassin",
            }
          : null,
    };
  }
}

// Two distinct targets: 40% each, 20% both. With more targets, select fairly.
export function selectAttacks(
  targets: string[],
  random: (max: number) => number = randomInt,
): string[] {
  const unique = [...new Set(targets)];
  if (unique.length <= 1) return unique;
  const roll = random(100);
  if (unique.length === 2)
    return roll < 40 ? [unique[0]] : roll < 80 ? [unique[1]] : unique;
  const first = unique.splice(random(unique.length), 1)[0];
  return roll < 80 ? [first] : [first, unique[random(unique.length)]];
}
