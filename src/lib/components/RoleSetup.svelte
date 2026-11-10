<script lang="ts">
  import type { ClientMessage, ConfigurableRole } from "$lib/game/types";
  import { draggable } from "$lib/ui/draggable";
  import {
    roles,
    MIN_PLAYERS,
    configurableRoles,
    requiredRoles,
    defaultRoleCounts,
    minimumPlayers,
    specialRoleCount,
    parseRoleCounts,
  } from "$lib/game/roles";
  let {
    connected,
    creating,
    send,
    back,
  }: {
    connected: boolean;
    creating: boolean;
    send: (message: ClientMessage) => void;
    back: () => void;
  } = $props();
  let counts = $state(defaultRoleCounts());
  let error = $state("");
  const valid = $derived(
    configurableRoles.every(
      (role) =>
        Number.isSafeInteger(counts[role]) &&
        counts[role] >= (requiredRoles.includes(role) ? 1 : 0),
    ) && Number.isSafeInteger(specialRoleCount(counts)),
  );
  const total = $derived(valid ? specialRoleCount(counts) : 0);
  const minimum = $derived(valid ? minimumPlayers(counts) : MIN_PLAYERS);
  function change(role: ConfigurableRole, amount: number) {
    const floor = requiredRoles.includes(role) ? 1 : 0;
    counts[role] = Math.max(
      floor,
      (Number.isSafeInteger(counts[role]) ? counts[role] : floor) + amount,
    );
    error = "";
  }
  function create(event: SubmitEvent) {
    event.preventDefault();
    try {
      const roleCounts = parseRoleCounts(counts);
      error = "";
      send({ type: "create-room", roleCounts });
    } catch (cause) {
      error = (cause as Error).message;
    }
  }
</script>

<div class="role-setup" use:draggable={{ handle: ".action-drag-handle" }}>
  <div class="action-drag-handle" aria-hidden="true"><span class="drag-grip">⠿</span> Arraste para mover</div>
  <button class="setup-back" disabled={creating} onclick={back}>← Voltar</button
  >
  <div class="page-heading">
    <div>
      <p class="eyebrow">CRIE SUA CIDADE · VOCÊ SERÁ O NARRADOR</p>
      <h1>Quem habita essa cidade<span class="accent">?</span></h1>
      <p>
        Escolha os papéis e a quantidade de cada um. O sorteio fica por nossa
        conta.
      </p>
    </div>
  </div>
  <form class="setup-layout" onsubmit={create}>
    <fieldset disabled={creating} class="role-options">
      <legend class="sr-only">Quantidades de papéis</legend>
      {#each configurableRoles as role}
        {@const required = requiredRoles.includes(role)}
        <div class="role-option" class:role-active={counts[role] > 0}>
          <span class="setup-symbol {role}" aria-hidden="true"
            >{roles[role].symbol}</span
          >
          <div class="role-option-copy">
            <div class="role-option-title">
              <label for={`count-${role}`}>{roles[role].label}</label>
              <span class="role-requirement"
                >{required
                  ? "Obrigatório · mín. 1"
                  : counts[role] > 0
                    ? "Ativado"
                    : "Opcional"}</span
              >
            </div>
            <p id={`help-${role}`}>{roles[role].description}</p>
          </div>
          <div class="role-stepper">
            <button
              type="button"
              aria-label={`Diminuir ${roles[role].label}`}
              disabled={counts[role] <= (required ? 1 : 0)}
              onclick={() => change(role, -1)}>−</button
            >
            <input
              id={`count-${role}`}
              type="number"
              inputmode="numeric"
              min={required ? 1 : 0}
              max={Number.MAX_SAFE_INTEGER}
              step="1"
              required
              bind:value={counts[role]}
              aria-describedby={`help-${role}`}
            />
            <button
              type="button"
              aria-label={`Aumentar ${roles[role].label}`}
              disabled={counts[role] >= Number.MAX_SAFE_INTEGER}
              onclick={() => change(role, 1)}>+</button
            >
          </div>
        </div>
      {/each}
      <div class="role-option citizen-option">
        <span class="setup-symbol citizen" aria-hidden="true">◇</span>
        <div class="role-option-copy">
          <div class="role-option-title">
            <strong>Cidadãos</strong><span class="role-requirement"
              >Automático</span
            >
          </div>
          <p>
            Todos os jogadores que sobrarem recebem este papel. Você não precisa
            definir a quantidade.
          </p>
        </div>
      </div>
    </fieldset>
    <aside class="panel setup-summary">
      <p class="eyebrow">SUA PARTIDA</p>
      <h2>Os segredos começam aqui.</h2>
      <div class="setup-total" aria-live="polite">
        <strong>{valid ? total : "—"}</strong><span
          >papéis escolhidos<br />+ cidadãos para completar</span
        >
      </div>
      <div class="setup-rules">
        <p>
          <strong>{minimum} jogadores + você</strong><br />{minimum >
          MIN_PLAYERS
            ? "Mínimo para acomodar os papéis escolhidos."
            : "Mínimo de 4 jogadores, além do Narrador."}
        </p>
        <p>
          Assassino, Médico e Detetive sempre participam. Deixe os opcionais em
          zero para desativá-los.
        </p>
        <p>
          As quantidades ficam salvas nesta sala, inclusive ao jogar novamente.
        </p>
      </div>
      {#if !valid}<p class="setup-error" role="status">
          Use quantidades inteiras. Os papéis obrigatórios precisam de pelo
          menos 1 jogador cada.
        </p>{/if}
      {#if error}<p class="setup-error" role="alert">{error}</p>{/if}
      <button class="primary full" disabled={!connected || creating || !valid}
        >{creating ? "Criando sala…" : "Criar sala com estes papéis"}<span
          aria-hidden="true">↗</span
        ></button
      >
      <p class="hint">Depois, é só compartilhar o convite.</p>
    </aside>
  </form>
</div>

<style>
  .setup-back {
    margin-bottom: 24px;
    background: transparent;
  }
  .setup-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(280px, 1fr);
    gap: 24px;
    align-items: start;
  }
  .role-options {
    display: grid;
    gap: 12px;
  }
  .role-option {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 22px;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 16px;
  }
  .role-active {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
  }
  .setup-symbol {
    font-size: 28px;
    flex: 0 0 38px;
    text-align: center;
  }
  .role-option-copy {
    flex: 1;
    min-width: 0;
  }
  .role-option-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
  }
  .role-option-title label,
  .role-option-title strong {
    font-size: 15px;
    font-weight: 650;
  }
  .role-requirement {
    font-size: 10px;
    color: var(--muted);
  }
  .role-option p {
    font-size: 12px;
    line-height: 1.6;
    margin: 6px 0 0;
  }
  .role-stepper {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .role-stepper button {
    width: 44px;
    min-height: 44px;
    padding: 0;
    font-size: 20px;
  }
  .role-stepper input {
    width: 48px;
    min-height: 44px;
    padding: 4px;
    text-align: center;
    font: inherit;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface-raised);
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .role-stepper input::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }
  .citizen-option {
    background: var(--soft);
    border-style: dashed;
  }
  .setup-summary {
    position: sticky;
    top: 24px;
  }
  .setup-total {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 22px 0;
    border-block: 1px solid var(--line);
    margin: 24px 0;
  }
  .setup-total strong {
    font-size: 40px;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .setup-total span {
    font-size: 12px;
    line-height: 1.7;
    color: var(--muted);
  }
  .setup-rules p {
    font-size: 13px;
  }
  .setup-error {
    color: var(--assassin);
    font-size: 12px;
  }
  @media (max-width: 960px) {
    .setup-layout {
      grid-template-columns: 1fr;
    }
    .setup-summary {
      position: static;
    }
  }
  @media (max-width: 520px) {
    .role-option {
      gap: 12px;
      padding: 18px;
      display: grid;
      grid-template-columns: 26px minmax(0, 1fr);
    }
    .setup-symbol {
      align-self: start;
    }
    .role-stepper {
      grid-column: 2;
      justify-self: start;
    }
    .setup-total strong {
      font-size: 32px;
    }
  }
</style>
