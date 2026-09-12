import { randomInt, randomUUID } from "node:crypto";
import type {
  AdminView,
  PlayerView,
  Role,
  Status,
  Turn,
} from "../../src/lib/game/types.js";
import { MIN_PLAYERS } from "../../src/lib/game/roles.js";
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
  day: DayState | null = null;
  constructor(private now: () => number = Date.now) {}
  tick() {
    return this.day && this.status === "day"
      ? this.day.tick(this.now())
      : false;
  }
  dayChoice(p: Player, choice: unknown) {
    if (this.status !== "day" || !p.alive || !this.day)
      throw new Error("Votação indisponível.");
    this.day.choose(p.id, choice, this.now());
  }
  dayVote(p: Player, target: unknown) {
    if (this.status !== "day" || !p.alive || !this.day)
      throw new Error("Votação indisponível.");
    this.day.vote(p.id, target);
    this.finishDay();
  }
  resolveCity(target: unknown) {
    if (this.status !== "day" || !this.day)
      throw new Error("Votação indisponível.");
    this.day.resolve(target);
    this.finishDay();
  }
  private finishDay() {
    if (this.day?.phase !== "completed") return;
    const victim = this.players.find((p) => p.id === this.day!.eliminated);
    if (victim) victim.alive = false;
    this.startNight();
  }
  private dayView(p?: Player) {
    if (!this.day) return null;
    return {
      phase: this.day.phase,
      remaining: this.day.remaining(this.now()),
      duration: this.day.duration,
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
  adminToken: string | null = null;
  players: Player[] = [];
  status: Status = "waiting";
  night = 0;
  assassinTarget: string | null = null;
  assassinVotes = new Map<string, string>();
  doctorTarget: string | null = null;
  detectiveTarget: string | null = null;
  outcome: string | null = null;
  reset() {
    this.players = [];
    this.status = "waiting";
    this.day = null;
    this.night = 0;
    this.assassinTarget = this.doctorTarget = this.detectiveTarget = null;
    this.assassinVotes.clear();
    this.outcome = null;
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
  draw() {
    if (this.status !== "waiting")
      throw new Error("Os papéis já foram sorteados.");
    if (this.players.length < MIN_PLAYERS)
      throw new Error("São necessários pelo menos 4 jogadores.");
    const deck: Role[] = [
      "assassin",
      "assassin",
      "doctor",
      "detective",
      ...Array<Role>(this.players.length - 4).fill("citizen"),
    ];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.players.forEach((p, i) => (p.role = deck[i]));
    this.status = "night";
    this.night = 1;
  }
  private startNight() {
    if (this.status !== "day" || this.day?.phase !== "completed")
      throw new Error("A próxima noite só pode começar depois do dia.");
    this.status = "night";
    this.night++;
    this.assassinTarget = this.doctorTarget = this.detectiveTarget = null;
    this.assassinVotes.clear();
    this.outcome = null;
  }
  actionTurn(p: Player): Turn | null {
    return p.role === "assassin"
      ? "assassins"
      : p.role === "doctor" || p.role === "detective"
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
      ? this.assassinVotes.get(p.id)
      : p.role === "doctor"
        ? this.doctorTarget
        : this.detectiveTarget;
  }
  targets(p: Player) {
    return this.players.filter(
      (t) =>
        t.alive &&
        (p.role !== "assassin" || t.role !== "assassin") &&
        (p.role !== "detective" || t.id !== p.id),
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
    if (p.role === "doctor") this.doctorTarget = target.id;
    if (p.role === "detective") this.detectiveTarget = target.id;
  }
  assassinConflict() {
    return (
      new Set(this.assassinVotes.values()).size > 1 && !this.assassinTarget
    );
  }
  resolveAssassins(id: unknown) {
    if (
      this.status !== "night" ||
      !this.assassinConflict() ||
      typeof id !== "string" ||
      ![...this.assassinVotes.values()].includes(id)
    )
      throw new Error(
        "Escolha um dos alvos votados para resolver a divergência.",
      );
    this.assassinTarget = id;
  }
  wake() {
    if (this.status !== "night") throw new Error("A cidade não está dormindo.");
    if (this.pendingPlayers().length)
      throw new Error(
        "Aguarde todos os jogadores confirmarem suas ações noturnas.",
      );
    if (this.assassinConflict())
      throw new Error(
        "Resolva os votos diferentes dos assassinos antes de acordar a cidade.",
      );
    const victim = this.players.find((p) => p.id === this.assassinTarget);
    this.outcome = "Ninguém morreu durante a noite.";
    if (victim && victim.id !== this.doctorTarget) {
      victim.alive = false;
      this.outcome = `${victim.name} morreu durante a noite.`;
    }
    this.status = "day";
    this.day = new DayState(
      this.players
        .filter((p) => p.alive)
        .map((p) => ({ id: p.id, name: p.name })),
      this.now(),
    );
  }
  publicPlayer(p: Player) {
    return { id: p.id, name: p.name, alive: p.alive, connected: p.connected };
  }
  adminView(): AdminView {
    return {
      kind: "admin",
      day: this.day
        ? {
            ...this.dayView()!,
            pending: this.day.pending(),
            votes: [...this.day.votes].map(([playerId, targetId]) => ({
              playerId,
              targetId,
            })),
            tally: this.day.tally(),
            tied: this.day.phase === "tie" ? this.day.leaders() : [],
            eliminated: this.day.eliminated,
          }
        : null,
      status: this.status,
      pendingPlayers: this.pendingPlayers().map((p) => ({
        id: p.id,
        name: p.name,
      })),
      canWake:
        this.status === "night" &&
        this.pendingPlayers().length === 0 &&
        !this.assassinConflict(),
      night: this.night,
      players: this.players.map((p) => ({
        ...this.publicPlayer(p),
        role: p.role,
      })),
      assassinTarget: this.assassinTarget,
      assassinVotes: this.players
        .filter((p) => p.role === "assassin" && p.alive)
        .map((p) => ({
          playerId: p.id,
          targetId: this.assassinVotes.get(p.id) ?? null,
        })),
      assassinConflict: this.assassinConflict(),
      doctorTarget: this.doctorTarget,
      detectiveTarget: this.detectiveTarget,
      outcome: this.outcome,
    };
  }
  playerView(p: Player): PlayerView {
    const target = this.players.find((t) => t.id === this.detectiveTarget);
    const eligible = this.eligible(p);
    return {
      kind: "player",
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
      submitted: eligible && !!this.chosen(p),
      investigation:
        this.status === "night" && p.role === "detective" && target
          ? { name: target.name, assassin: target.role === "assassin" }
          : null,
    };
  }
}
