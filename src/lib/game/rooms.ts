export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeRoomCode(value: string): string | null {
  const compact = value.trim().toUpperCase().replace(/[-\s]/g, "");
  if (
    compact.length !== 8 ||
    [...compact].some((character) => !ROOM_CODE_ALPHABET.includes(character))
  )
    return null;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export const roomStorageKey = (code: string, key: string) =>
  `cidade-dorme:room:${code}:${key}`;
