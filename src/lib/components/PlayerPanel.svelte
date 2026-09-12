<script lang="ts">
  import type { PlayerView, ClientMessage } from "$lib/game/types";
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
</script>

<div class="player-layout" class:player-dead={!view.player.alive}>
  <p class="eyebrow">VOCÊ FAZ PARTE DA CIDADE</p>
  <h1>Olá, {view.player.name}<span class="accent">.</span></h1>
  {#if view.status === "waiting"}<section class="panel waiting-screen">
      <span class="moon" aria-hidden="true">☾</span>
      <h2>Seu lugar está reservado.</h2>
      <p>Aguardando o Narrador iniciar a partida…</p>
      <div class="quiet-label">
        Enquanto isso, entre na chamada com o grupo.
      </div>
    </section>
  {:else}
    {#if !view.player.alive}<div class="notice">
        Você está morto. Continue acompanhando a partida; suas ações noturnas
        estão encerradas.
      </div>{/if}
    {#if view.status === "day" && view.day}
      <DayPanel day={view.day} alive={view.player.alive} {connected} {send} />
    {:else if view.action}
      <section class="panel">
        <p class="eyebrow">É A SUA VEZ</p>
        <h2>
          {view.action.turn === "assassins"
            ? "Escolha uma vítima"
            : view.action.turn === "doctor"
              ? "Quem você deseja proteger?"
              : "Quem você deseja investigar?"}
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
              >{view.action.turn === "detective"
                ? "Investigar"
                : "Confirmar escolha"}</button
            >
          </fieldset>
        </form>
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
    {#if view.investigation}<div
        class="notice investigation"
        aria-live="polite"
      >
        <p class="eyebrow">RESULTADO DA INVESTIGAÇÃO</p>
        <strong
          >{view.investigation.assassin ? "SIM" : "NÃO"} — {view.investigation
            .name}
          {view.investigation.assassin
            ? "é Assassino."
            : "não é Assassino."}</strong
        >
      </div>{/if}
    {#if view.player.role}<RoleCard role={view.player.role} partners={view.partners} alive={view.player.alive} />{/if}
  {/if}
</div>
