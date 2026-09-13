import type { Role } from "./types.js";
export const roles: Record<
  Role,
  { label: string; description: string; symbol: string }
> = {
  sheriff: {
    label: "Xerife",
    description:
      "Você tem uma única bala para toda a partida. À noite, atire em outra pessoa ou guarde a bala.",
    symbol: "☆",
  },
  bodyguard: {
    label: "Guarda-costas",
    description:
      "Proteja outra pessoa durante a noite. Se ela sofrer um ataque sem proteção do Médico, você morre no lugar dela.",
    symbol: "⬡",
  },
  seer: {
    label: "Vidente",
    description: "A cada noite, veja em segredo o papel exato de outra pessoa.",
    symbol: "◉",
  },
  fool: {
    label: "Rei Louco",
    description:
      "Convença o povo a eliminar você na votação da cidade. Só essa morte encerra a partida com sua vitória individual; morrer à noite não dá vitória.",
    symbol: "♧",
  },
  assassin: {
    label: "Assassino",
    description: "Durante a noite, escolha uma pessoa para eliminar.",
    symbol: "†",
  },
  doctor: {
    label: "Médico",
    description:
      "Durante a noite, escolha outra pessoa para proteger. Você não pode se proteger.",
    symbol: "+",
  },
  citizen: {
    label: "Cidadão",
    description: "Observe, discuta e descubra quem são os Assassinos.",
    symbol: "◇",
  },
};
export const MIN_PLAYERS = 1;
export function roleDeck(count: number): Role[] {
  if (!Number.isInteger(count) || count < 1) return [];
  const assassins = count > 10 ? 3 : count > 5 ? 2 : 1;
  const deck: Role[] = Array<Role>(assassins).fill("assassin");
  if (deck.length < count) deck.push("doctor");
  for (const role of ["sheriff", "bodyguard", "seer", "fool"] as const)
    if (deck.length < count) deck.push(role);
  while (deck.length < count) deck.push("citizen");
  return deck;
}
