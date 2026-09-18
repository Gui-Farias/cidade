export type DayPhase = "discussion" | "decision" | "voting" | "completed";
export type DayChoice = "extend" | "vote";
export const MAX_DAY_EXTENSIONS = 2;
export type DayView = {
  phase: DayPhase;
  remaining: number;
  duration: number;
  extensionsRemaining: number;
  submitted: boolean;
  targets: Target[];
};
export type AdminDayView = DayView & {
  pending: Target[];
  votes: { playerId: string; targetId: string | null }[];
  abstentions: number;
  tally: { id: string; count: number }[];
  tiebreaker: boolean;
  eliminated: string | null;
};
export type Role =
  | "assassin"
  | "doctor"
  | "citizen"
  | "sheriff"
  | "bodyguard"
  | "seer"
  | "detective"
  | "fool";
export type Turn =
  "assassins" | "doctor" | "sheriff" | "bodyguard" | "seer" | "detective";
export type Status = "waiting" | "night" | "day" | "finished";
export type TimelineEvent = {
  round: number;
  phase: "night" | "day";
  text: string;
};
export type GameResult = {
  winner: "city" | "assassins" | "draw" | "fool";
  rounds: number;
  players: AdminPlayer[];
  timeline: TimelineEvent[];
};
export type PublicPlayer = {
  id: string;
  name: string;
  alive: boolean;
  connected: boolean;
};
export type AdminPlayer = PublicPlayer & { role: Role | null };
export type Target = { id: string; name: string };
export type AdminView = {
  result: GameResult | null;
  kind: "admin";
  day: AdminDayView | null;
  status: Status;
  pendingPlayers: Target[];
  canWake: boolean;
  players: AdminPlayer[];
  night: number;
  assassinTarget: string | null;
  assassinTargets: string[];
  assassinVotes: { playerId: string; targetId: string | null }[];
  assassinConflict: boolean;
  doctorTarget: string | null;
  bodyguardTarget: string | null;
  seerTarget: string | null;
  detectiveTarget: string | null;
  sheriffTarget: string | null;
  sheriffBullets: number;
  sheriffPassed: boolean;
  outcome: string | null;
};
export type PlayerView = {
  result: GameResult | null;
  kind: "player";
  day: DayView | null;
  status: Status;
  player: PublicPlayer & { role: Role | null };
  action: { turn: Turn; targets: Target[] } | null;
  submitted: boolean;
  partners: Target[];
  vision: { name: string; role: Role } | null;
  investigation: { name: string; isAssassin: boolean } | null;
  bulletsAvailable: number;
};
export type View =
  | AdminView
  | PlayerView
  | { kind: "guest"; closed: boolean }
  | { kind: "lobby" }
  | { kind: "missing" };
export type ServerMessage =
  | { type: "state"; view: View }
  | {
      type: "identity";
      roomCode: string;
      kind: "admin" | "player";
      token: string;
      name?: string;
    }
  | { type: "identity-reset"; roomCode: string; kind: "admin" | "player" }
  | { type: "room-closed"; roomCode: string }
  | { type: "error"; message: string };
export type ClientMessage =
  | {
      type: "hello";
      roomCode?: string;
      adminToken?: string;
      playerToken?: string;
    }
  | { type: "create-room" }
  | { type: "join"; name: string }
  | { type: "draw" }
  | { type: "close-room" }
  | { type: "restart" }
  | { type: "expel-player"; playerId: string }
  | { type: "day-choice"; choice: DayChoice }
  | { type: "day-vote"; targetId: string | null }
  | { type: "wake" }
  | { type: "pass" }
  | { type: "act"; targetId: string };
