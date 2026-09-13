export type DayPhase =
  "discussion" | "decision" | "voting" | "tie" | "completed";
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
  tied: string[];
  eliminated: string | null;
};
export type Role =
  "assassin" | "doctor" | "citizen" | "sheriff" | "bodyguard" | "seer" | "fool";
export type Turn = "assassins" | "doctor" | "sheriff" | "bodyguard" | "seer";
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
  sheriffTarget: string | null;
  sheriffSpent: boolean;
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
  bulletAvailable: boolean;
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
  | { type: "restart" }
  | { type: "day-choice"; choice: DayChoice }
  | { type: "day-vote"; targetId: string | null }
  | { type: "resolve-city"; targetId: string }
  | { type: "wake" }
  | { type: "pass" }
  | { type: "act"; targetId: string };
