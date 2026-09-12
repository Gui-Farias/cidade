import type { Role } from "./types.js";
export const roles: Record<
  Role,
  { label: string; description: string; symbol: string }
> = {
  assassin: {
    label: "Assassino",
    description: "Durante a noite, escolha uma pessoa para eliminar.",
    symbol: "†",
  },
  detective: {
    label: "Detetive",
    description:
      "Durante a noite, investigue um jogador e descubra se ele é Assassino.",
    symbol: "◎",
  },
  doctor: {
    label: "Médico",
    description: "Durante a noite, escolha uma pessoa para proteger.",
    symbol: "+",
  },
  citizen: {
    label: "Cidadão",
    description: "Observe, discuta e descubra quem são os Assassinos.",
    symbol: "◇",
  },
};
export const MIN_PLAYERS = 4;
