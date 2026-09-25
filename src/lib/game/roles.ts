import type { Role, RoleCounts, ConfigurableRole } from "./types.js";
export const roles: Record<
  Role,
  { label: string; description: string; symbol: string }
> = {
  sheriff: {
    label: "Xerife",
    description:
      "Você tem duas balas para toda a partida. À noite, atire em outra pessoa ou guarde suas balas.",
    symbol: "☆",
  },
  bodyguard: {
    label: "Guarda-costas",
    description:
      "Proteja outra pessoa durante a noite. Sem proteção do Médico, um Guarda-costas morre no lugar dela. Se houver vários no mesmo alvo, um deles é sorteado para o sacrifício.",
    symbol: "⬡",
  },
  seer: {
    label: "Vidente",
    description: "A cada noite, veja em segredo o papel exato de outra pessoa.",
    symbol: "◉",
  },
  detective: {
    label: "Detetive",
    description:
      "A cada noite, investigue outra pessoa em segredo para saber apenas se ela é Assassina ou não.",
    symbol: "⌕",
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
export const MIN_PLAYERS = 4;
export const SHERIFF_BULLETS = 2;
export const configurableRoles: ConfigurableRole[] = [
  "assassin",
  "doctor",
  "detective",
  "bodyguard",
  "seer",
  "sheriff",
  "fool",
];
export const requiredRoles: ConfigurableRole[] = [
  "assassin",
  "doctor",
  "detective",
];
export const defaultRoleCounts = (): RoleCounts => ({
  assassin: 1,
  doctor: 1,
  detective: 1,
  bodyguard: 0,
  seer: 0,
  sheriff: 0,
  fool: 0,
});

export function parseRoleCounts(value: unknown): RoleCounts {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Escolha a quantidade de cada papel para criar a sala.");
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !configurableRoles.includes(key as ConfigurableRole),
    )
  )
    throw new Error(
      "Papel inválido. Cidadãos completam as vagas automaticamente.",
    );
  const counts = defaultRoleCounts();
  for (const role of configurableRoles) {
    const count = input[role];
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)
      throw new Error(
        `Informe uma quantidade inteira e positiva ou zero para ${roles[role].label}.`,
      );
    if (requiredRoles.includes(role) && count < 1)
      throw new Error(`É obrigatório ter pelo menos 1 ${roles[role].label}.`);
    counts[role] = count;
  }
  if (!Number.isSafeInteger(specialRoleCount(counts)))
    throw new Error("A quantidade total de papéis é muito alta.");
  return counts;
}

export const specialRoleCount = (counts: RoleCounts) =>
  configurableRoles.reduce((total, role) => total + counts[role], 0);
export const minimumPlayers = (counts: RoleCounts) =>
  Math.max(MIN_PLAYERS, specialRoleCount(counts));

export function roleDeck(count: number, configuration: RoleCounts): Role[] {
  const counts = parseRoleCounts(configuration);
  if (!Number.isSafeInteger(count) || count < minimumPlayers(counts))
    throw new Error(
      `São necessários pelo menos ${minimumPlayers(counts)} jogadores, além do Narrador, para esta configuração.`,
    );
  const deck: Role[] = [];
  for (const role of configurableRoles)
    for (let i = 0; i < counts[role]; i++) deck.push(role);
  while (deck.length < count) deck.push("citizen");
  return deck;
}
