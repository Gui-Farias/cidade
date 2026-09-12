import type { DayPhase, DayChoice, Target } from "../../src/lib/game/types.js";

export class DayState {
  phase: DayPhase = "discussion";
  deadline: number;
  duration = 60;
  decisions = new Map<string, DayChoice>();
  votes = new Map<string, string>();
  eliminated: string | null = null;
  constructor(
    public voters: Target[],
    now: number,
  ) {
    this.deadline = now + 60_000;
  }
  remaining(now: number) {
    return this.phase === "discussion"
      ? Math.max(0, Math.ceil((this.deadline - now) / 1000))
      : 0;
  }
  tick(now: number) {
    if (this.phase !== "discussion" || now < this.deadline) return false;
    this.phase = "decision";
    return true;
  }
  choose(id: string, choice: unknown, now: number) {
    this.validate(id, "decision");
    if (this.decisions.has(id))
      throw new Error("Você já confirmou sua escolha.");
    if (choice !== "extend" && choice !== "vote")
      throw new Error("Escolha inválida.");
    this.decisions.set(id, choice);
    if (this.decisions.size === this.voters.length) {
      const extensions = [...this.decisions.values()].filter(
        (v) => v === "extend",
      ).length;
      if (extensions > this.voters.length / 2) {
        this.phase = "discussion";
        this.duration = 30;
        this.deadline = now + 30_000;
        this.decisions.clear();
      } else this.phase = "voting";
    }
  }
  vote(id: string, target: unknown) {
    this.validate(id, "voting");
    if (this.votes.has(id)) throw new Error("Seu voto já foi confirmado.");
    if (typeof target !== "string" || !this.voters.some((p) => p.id === target))
      throw new Error("Escolha um jogador vivo.");
    this.votes.set(id, target);
    if (this.votes.size === this.voters.length) {
      const leaders = this.leaders();
      if (leaders.length === 1) {
        this.eliminated = leaders[0];
        this.phase = "completed";
      } else this.phase = "tie";
    }
  }
  resolve(target: unknown) {
    if (
      this.phase !== "tie" ||
      typeof target !== "string" ||
      !this.leaders().includes(target)
    )
      throw new Error("Escolha um dos jogadores empatados.");
    this.eliminated = target;
    this.phase = "completed";
  }
  tally() {
    const counts = new Map<string, number>();
    for (const target of this.votes.values())
      counts.set(target, (counts.get(target) || 0) + 1);
    return [...counts]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
  }
  leaders() {
    const tally = this.tally();
    return tally.filter((t) => t.count === tally[0]?.count).map((t) => t.id);
  }
  pending() {
    const ballots = this.phase === "decision" ? this.decisions : this.votes;
    return this.phase === "decision" || this.phase === "voting"
      ? this.voters.filter((p) => !ballots.has(p.id))
      : [];
  }
  validate(id: string, phase: DayPhase) {
    if (this.phase !== phase || !this.voters.some((p) => p.id === id))
      throw new Error("Você não pode votar nesta fase.");
  }
}
