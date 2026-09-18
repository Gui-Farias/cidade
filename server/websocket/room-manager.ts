import { randomInt, randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { Game } from "./game-state.js";
import {
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
} from "../../src/lib/game/rooms.js";

export const EMPTY_ROOM_TTL_MS = 2 * 60 * 60 * 1000;
export type Room = {
  code: string;
  game: Game;
  clients: Set<WebSocket>;
  createdAt: number;
  emptySince: number | null;
};

export class RoomManager {
  readonly rooms = new Map<string, Room>();

  constructor(
    private now: () => number = Date.now,
    private createGame: () => Game = () => new Game(now),
    private maxRooms = 200,
  ) {}

  create(): Room {
    this.sweep();
    if (this.rooms.size >= this.maxRooms)
      throw new Error(
        "Todas as salas estão ocupadas. Tente novamente mais tarde.",
      );
    let code: string;
    do {
      code = normalizeRoomCode(
        Array.from(
          { length: 8 },
          () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
        ).join(""),
      )!;
    } while (this.rooms.has(code));
    const game = this.createGame();
    game.adminToken = randomUUID();
    const room: Room = {
      code,
      game,
      clients: new Set(),
      createdAt: this.now(),
      emptySince: this.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  get(value: unknown): Room | undefined {
    const code = typeof value === "string" ? normalizeRoomCode(value) : null;
    if (!code) return;
    const room = this.rooms.get(code);
    if (room && this.expired(room)) {
      this.rooms.delete(code);
      return;
    }
    return room;
  }

  connect(room: Room, client: WebSocket) {
    room.clients.add(client);
    room.emptySince = null;
  }

  disconnect(room: Room, client: WebSocket) {
    room.clients.delete(client);
    if (room.clients.size === 0) room.emptySince = this.now();
  }

  close(room: Room) {
    this.rooms.delete(room.code);
  }

  sweep() {
    for (const [code, room] of this.rooms)
      if (this.expired(room)) this.rooms.delete(code);
  }

  private expired(room: Room) {
    return (
      room.clients.size === 0 &&
      room.emptySince !== null &&
      this.now() - room.emptySince >= EMPTY_ROOM_TTL_MS
    );
  }
}
