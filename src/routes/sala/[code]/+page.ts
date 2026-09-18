import { normalizeRoomCode } from "$lib/game/rooms";
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => ({
  roomCode: normalizeRoomCode(params.code) ?? params.code,
});
