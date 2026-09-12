export type DayPhase =
  "discussion" | "decision" | "voting" | "tie" | "completed";
export type DayChoice = "extend" | "vote";
export type DayView = {
  phase: DayPhase;
  remaining: number;
  duration: number;
  submitted: boolean;
  targets: Target[];
};
export type AdminDayView = DayView & {
  pending: Target[];
  votes: { playerId: string; targetId: string }[];
  tally: { id: string; count: number }[];
  tied: string[];
  eliminated: string | null;
};
export type Role = "assassin" | "detective" | "doctor" | "citizen";
export type Turn = "assassins" | "doctor" | "detective";
export type Status = "waiting" | "night" | "day";
export type PublicPlayer = {
  id: string;
  name: string;
  alive: boolean;
  connected: boolean;
};
export type AdminPlayer = PublicPlayer & { role: Role | null };
export type Target = { id: string; name: string };
export type AdminView = {
  kind: "admin";
  day: AdminDayView | null;
  status: Status;
  pendingPlayers: Target[];
  canWake: boolean;
  players: AdminPlayer[];
  night: number;
  assassinTarget: string | null;
  assassinVotes: { playerId: string; targetId: string | null }[];
  assassinConflict: boolean;
  doctorTarget: string | null;
  detectiveTarget: string | null;
  outcome: string | null;
};
export type PlayerView = {
  kind: "player";
  day: DayView | null;
  status: Status;
  player: PublicPlayer & { role: Role | null };
  action: { turn: Turn; targets: Target[] } | null;
  submitted: boolean;
  partners: Target[];
  investigation: { name: string; assassin: boolean } | null;
};
export type View = AdminView | PlayerView | { kind: "guest"; closed: boolean };
export type ServerMessage =
  | { type: "state"; view: View }
  | { type: "identity"; kind: "admin" | "player"; token: string; name?: string }
  | { type: "error"; message: string };
export type ClientMessage =
  | { type: "hello"; adminToken?: string; playerToken?: string }
  | { type: "join"; name: string }
  | { type: "draw" }
  | { type: "reset" }
  | { type: "day-choice"; choice: DayChoice }
  | { type: "day-vote"; targetId: string }
  | { type: "resolve-city"; targetId: string }
  | { type: "wake" }
  | { type: "resolve-assassins"; targetId: string }
  | { type: "act"; targetId: string };
