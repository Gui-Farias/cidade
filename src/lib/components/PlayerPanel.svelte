<script lang="ts">
  import { onMount } from "svelte";
  import type { PlayerView, ClientMessage } from "$lib/game/types";
  import { roles } from "$lib/game/roles";
  import DayPanel from "./DayPanel.svelte";
  import RoleCard from "./RoleCard.svelte";
  let {
    view,
    send,
    connected,
  }: {
    view: PlayerView;
    send: (m: ClientMessage) => void;
    connected: boolean;
  } = $props();
  let selected = $state("");
  let equalPresses = 0;
  let equalTimer: ReturnType<typeof setTimeout> | undefined;
  // Preserve the selection when another player's private action updates the state.
  const actionKey = $derived(
    view.action
      ? `${view.action.turn}:${view.action.targets.map((t) => t.id).join(",")}`
      : "",
  );
  $effect(() => {
    const key = actionKey;
    selected = "";
  });
  onMount(() => {
    const claimWithEquals = (event: KeyboardEvent) => {
      if (
        event.key !== "=" ||
        event.repeat ||
        view.status !== "waiting" ||
        !view.adminAvailable
      )
        return;
      equalPresses++;
      clearTimeout(equalTimer);
      equalTimer = setTimeout(() => (equalPresses = 0), 1000);
      if (equalPresses < 3) return;
      clearTimeout(equalTimer);
      equalPresses = 0;
      send({ type: "claim-admin" });
    };
    window.addEventListener("keydown", claimWithEquals);
    return () => {
      clearTimeout(equalTimer);
      window.removeEventListener("keydown", claimWithEquals);
    };
  });
</script>

<div class="player-layout" class:player-dead={!view.player.alive}>
  {#if !view.player.alive}
    <div class="notice death-notice" role="status">
      <strong>Você está morto.</strong>
      <p>
        Continue acompanhando a partida; suas ações noturnas estão encerradas.
      </p>
    </div>
  {/if}
  {#if view.status !== "waiting" && view.player.role}<RoleCard
      role={view.player.role}
      partners={view.partners}
      alive={view.player.alive}
    />{/if}
  <p class="eyebrow">VOCÊ FAZ PARTE DA CIDADE</p>
  <h1>Olá, {view.player.name}<span class="accent">.</span></h1>
  {#if view.status === "waiting"}<section class="panel waiting-screen">
      <span class="moon" aria-hidden="true">☾</span>
      <h2>Seu lugar está reservado.</h2>
      <p>Aguardando o Narrador iniciar a partida…</p>
      {#if view.adminAvailable}<p class="hint">
          O Narrador saiu. Pressione = três vezes para assumir.
        </p>{/if}
    </section>
  {:else}
    {#if view.status === "day" && view.day}
      <DayPanel day={view.day} alive={view.player.alive} {connected} {send} />
    {:else if view.action}
      <section class="panel">
        <p class="eyebrow">É A SUA VEZ</p>
        <h2>
          {view.action.turn === "assassins"
            ? "Escolha uma vítima"
            : view.action.turn === "doctor" || view.action.turn === "bodyguard"
              ? "Quem você deseja proteger?"
              : view.action.turn === "sheriff"
                ? "Em quem deseja usar sua única bala?"
                : view.action.turn === "seer"
                  ? "De quem deseja ver o papel?"
                  : "De quem deseja ver o papel?"}
        </h2>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            send({ type: "act", targetId: selected });
          }}
        >
          <fieldset disabled={!connected}>
            <legend class="sr-only">Escolha um jogador</legend>
            <div class="targets">
              {#each view.action.targets as target}<label
                  class:selected={selected === target.id}
                  ><input
                    type="radio"
                    name="target"
                    value={target.id}
                    bind:group={selected}
                  />{target.name}</label
                >{/each}
            </div>
            <button class="primary full" disabled={!selected}
              >{view.action.turn === "seer"
                ? "Consultar papel"
                : "Confirmar escolha"}</button
            >
          </fieldset>
        </form>
        {#if view.action.turn === "sheriff"}
          <button
            class="full"
            disabled={!connected}
            onclick={() => send({ type: "pass" })}
            >Guardar a bala nesta noite</button
          >
          <p class="hint">
            O tiro será resolvido ao amanhecer e pode ser impedido por proteção.
            A bala é gasta ao confirmar.
          </p>
        {/if}
        {#if view.action.targets.length === 0}<p>
            Não há alvos disponíveis. Aguarde o Narrador.
          </p>{/if}
      </section>
    {:else}<section class="panel centered">
        <p class="eyebrow">☾ A CIDADE DORME</p>
        <h2>
          {view.submitted
            ? "Escolha confirmada."
            : "O silêncio guarda segredos."}
        </h2>
        <p>
          {view.submitted
            ? "O Narrador recebeu a decisão. Aguarde a próxima fase."
            : "Acompanhe a chamada enquanto os jogadores concluem suas ações."}
        </p>
      </section>{/if}
    {#if view.player.role === "sheriff"}<p class="hint">
        {view.bulletAvailable
          ? "Munição: 1 bala."
          : "Munição esgotada. Você ainda participa das votações da cidade."}
      </p>{/if}
    {#if view.vision}<div class="notice investigation" aria-live="polite">
        <p class="eyebrow">SUA VISÃO · SÓ VOCÊ VÊ</p>
        <strong>{view.vision.name} — {roles[view.vision.role].label}</strong>
      </div>{/if}
  {/if}
</div>
