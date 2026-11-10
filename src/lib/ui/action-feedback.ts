import type { PlayerView, Role, Turn } from "$lib/game/types";
import { roles } from "$lib/game/roles";

export type ActionReceipt =
  | { kind: "night"; role: Role; turn: Turn; targetId: string | null; targetName: string | null; passed: boolean }
  | { kind: "vote"; role: Role; targetId: string | null; targetName: string | null; passed: boolean };

export type ReceiptPresentation = {
  tone: "danger" | "care" | "insight" | "gold";
  glyph: string;
  kicker: string;
  title: string;
  description: string;
  compact: string;
  waiting: string;
  hasSecret: boolean;
};

const chosen = (name: string | null) => name ? ` em ${name}` : "";

export function describeReceipt(receipt: ActionReceipt, view: PlayerView): ReceiptPresentation {
  if (receipt.kind === "vote") {
    const abstained = receipt.passed;
    return {
      tone: "gold", glyph: "vote", kicker: "VOTO CONFIRMADO",
      title: abstained ? "Abstenção registrada" : "Seu voto foi registrado",
      description: abstained
        ? "Você preferiu não votar nesta rodada. Aguarde o fim da votação."
        : `Seu voto${chosen(receipt.targetName)} foi registrado em segredo. Aguarde o fim da votação.`,
      compact: abstained ? "Abstenção registrada" : "Voto registrado",
      waiting: "Aguardando o fim da votação", hasSecret: false,
    };
  }

  switch (receipt.turn) {
    case "assassins": return {
      tone: "danger", glyph: "sword", kicker: "ESCOLHA CONFIRMADA",
      title: "Alvo indicado",
      description: `Seu voto${chosen(receipt.targetName)} foi registrado em segredo. O desfecho da noite será revelado ao amanhecer.`,
      compact: "Voto da noite registrado", waiting: "Aguardando o amanhecer", hasSecret: false,
    };
    case "doctor": return {
      tone: "care", glyph: "heart", kicker: "PROTEÇÃO CONFIRMADA",
      title: "Proteção escolhida",
      description: `Sua escolha de proteção${chosen(receipt.targetName)} foi registrada. O efeito será resolvido ao amanhecer.`,
      compact: "Proteção registrada", waiting: "Aguardando o amanhecer", hasSecret: false,
    };
    case "bodyguard": return {
      tone: "care", glyph: "shield", kicker: "VIGÍLIA CONFIRMADA",
      title: "Guarda posicionada",
      description: `Você ficou de guarda por ${receipt.targetName ?? "uma pessoa da cidade"}. O resultado da noite será conhecido ao amanhecer.`,
      compact: "Vigília registrada", waiting: "Aguardando o amanhecer", hasSecret: false,
    };
    case "sheriff": return receipt.passed ? {
      tone: "gold", glyph: "shield", kicker: "DECISÃO CONFIRMADA",
      title: "Bala preservada",
      description: `Você passou esta noite sem disparar. ${view.bulletsAvailable} ${view.bulletsAvailable === 1 ? "bala continua disponível" : "balas continuam disponíveis"}.`,
      compact: "Bala guardada", waiting: "Aguardando o amanhecer", hasSecret: false,
    } : {
      tone: "danger", glyph: "sword", kicker: "DISPARO CONFIRMADO",
      title: "Disparo registrado",
      description: `Seu disparo${chosen(receipt.targetName)} foi registrado. O resultado será revelado ao amanhecer. Você tem ${view.bulletsAvailable} ${view.bulletsAvailable === 1 ? "bala" : "balas"} restante${view.bulletsAvailable === 1 ? "" : "s"}.`,
      compact: "Disparo registrado", waiting: "Aguardando o amanhecer", hasSecret: false,
    };
    case "seer": return {
      tone: "insight", glyph: "eye", kicker: "VISÃO · SÓ VOCÊ PODE VER",
      title: view.vision ? `${view.vision.name} é ${roles[view.vision.role].label}` : "Visão registrada",
      description: view.vision
        ? "O papel exato foi revelado. Você pode consultar sua descoberta em Segredos."
        : "Sua escolha foi registrada. Consulte Segredos quando a visão estiver disponível.",
      compact: view.vision ? "Visão revelada" : "Visão registrada",
      waiting: "Descoberta disponível em Segredos", hasSecret: !!view.vision,
    };
    case "detective": return {
      tone: "insight", glyph: "eye", kicker: "INVESTIGAÇÃO · SÓ VOCÊ PODE VER",
      title: view.investigation
        ? `${view.investigation.name} ${view.investigation.isAssassin ? "é Assassino" : "não é Assassino"}`
        : "Investigação registrada",
      description: view.investigation
        ? "A resposta foi revelada apenas para você. Você pode consultá-la em Segredos."
        : "Sua escolha foi registrada. Consulte Segredos quando a resposta estiver disponível.",
      compact: view.investigation ? "Investigação concluída" : "Investigação registrada",
      waiting: "Descoberta disponível em Segredos", hasSecret: !!view.investigation,
    };
  }
}

export function passiveNightCopy(role: Role | null, bulletsAvailable: number) {
  if (role === "citizen") return "A cidade dorme. Prepare suas suspeitas para a conversa e a votação.";
  if (role === "fool") return "Observe a noite. Sua próxima decisão virá na votação da cidade.";
  if (role === "sheriff" && bulletsAvailable === 0) return "Sem balas restantes. Aguarde o amanhecer para conversar e votar.";
  return "A cidade dorme. Acompanhe a chamada.";
}
