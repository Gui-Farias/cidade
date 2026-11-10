import type { DayPhase, Target } from "../../src/lib/game/types.js";
import { randomInt } from "node:crypto";

export const DISCUSSION_SECONDS = 90;
export const VOTING_SECONDS = 30;

export class DayState {
  phase: DayPhase = "discussion";
  deadline: number;
  duration = DISCUSSION_SECONDS;
  votes = new Map<string, string | null>();
  eliminated: string | null = null;
  tiebreaker = false;
  constructor(
    public voters: Target[],
    now: number,
    private random: (max: number) => number = randomInt,
  ) {
    this.deadline = now + DISCUSSION_SECONDS * 1000;
  }
  remaining(now: number) {
    return this.phase === "discussion" || this.phase === "voting"
      ? Math.max(0, Math.ceil((this.deadline - now) / 1000))
      : 0;
  }
  startVoting(now: number) {
    if (this.phase !== "discussion")
      throw new Error("A conversa já terminou.");
    this.phase = "voting";
    this.duration = VOTING_SECONDS;
    this.deadline = now + VOTING_SECONDS * 1000;
  }
  tick(now: number) {
    let changed = false;
    if (this.phase === "discussion" && now >= this.deadline) {
      this.startVoting(this.deadline);
      changed = true;
    }
    if (this.phase === "voting" && now >= this.deadline) {
      for (const voter of this.voters)
        if (!this.votes.has(voter.id)) this.votes.set(voter.id, null);
      this.completeVoting();
      changed = true;
    }
    return changed;
  }
  vote(id: string, target: unknown, now: number) {
    this.validate(id, "voting");
    if (now >= this.deadline) throw new Error("O tempo de votação terminou.");
    if (this.votes.has(id)) throw new Error("Seu voto já foi confirmado.");
    if (
      target !== null &&
      (typeof target !== "string" || !this.voters.some((p) => p.id === target))
    )
      throw new Error("Escolha um jogador vivo.");
    this.votes.set(id, target);
    if (this.votes.size === this.voters.length) this.completeVoting();
  }
  private completeVoting() {
    const leaders = this.leaders();
    this.tiebreaker = leaders.length > 1;
    this.eliminated = leaders.length
      ? leaders[this.random(leaders.length)]
      : null;
    this.phase = "completed";
  }
  tally() {
    const counts = new Map<string, number>();
    for (const target of this.votes.values())
      if (target !== null) counts.set(target, (counts.get(target) || 0) + 1);
    return [...counts]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
  }
  leaders() {
    const tally = this.tally();
    return tally.filter((t) => t.count === tally[0]?.count).map((t) => t.id);
  }
  pending() {
    return this.phase === "voting"
      ? this.voters.filter((p) => !this.votes.has(p.id))
      : [];
  }
  validate(id: string, phase: DayPhase) {
    if (this.phase !== phase || !this.voters.some((p) => p.id === id))
      throw new Error("Você não pode votar nesta fase.");
  }
}
