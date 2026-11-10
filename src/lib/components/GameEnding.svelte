<script lang="ts">
  import { tick } from "svelte";
  import type { GameResult, ClientMessage } from "$lib/game/types";
  import { roles } from "$lib/game/roles";
  import GameGlyph from "./GameGlyph.svelte";
  import { avatarForPlayer } from "$lib/ui/avatars";
  import { draggable } from "$lib/ui/draggable";
  import crest from "$lib/assets/ui/crest.webp";

  let {
    result,
    admin,
    connected,
    send,
  }: {
    result: GameResult;
    admin: boolean;
    connected: boolean;
    send: (message: ClientMessage) => void;
  } = $props();

  let heroOpen = $state(true);
  let details = $state<"players" | "timeline" | null>(null);
  let drawer = $state<HTMLElement>();
  let detailTrigger: HTMLButtonElement | undefined;
  let resultDockButton = $state<HTMLButtonElement>();
  let detailsDockButton = $state<HTMLButtonElement>();

  async function openDetails(tab: "players" | "timeline", trigger: HTMLButtonElement) {
    detailTrigger = detailsDockButton ?? trigger;
    heroOpen = false;
    details = tab;
    await tick();
    drawer?.focus();
  }
  async function closeDetails() {
    details = null;
    await tick();
    detailTrigger?.focus();
  }
  async function dismissHero() {
    heroOpen = false;
    await tick();
    resultDockButton?.focus();
  }
  function closeRoom() {
    if (confirm("Fechar esta sala? Todos voltarão para a página inicial e o convite deixará de funcionar."))
      send({ type: "close-room" });
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === "Escape") { if (details) void closeDetails(); else if (heroOpen) void dismissHero(); } }} />

{#if heroOpen}
  <section class="result-hero" data-winner={result.winner} aria-labelledby="result-title" aria-live="polite" use:draggable={{ handle: ".action-drag-handle" }}>
    <div class="action-drag-handle" aria-hidden="true"><span class="drag-grip">⠿</span> Arraste para mover</div>
    <button type="button" class="result-dismiss" aria-label="Recolher resultado" onclick={dismissHero}>×</button>
    <p class="eyebrow">FIM DE PARTIDA · {result.rounds} NOITE(S)</p>
    <img class="ending-crest" src={crest} alt="" aria-hidden="true" />
    <h1 id="result-title">{result.winner === "fool" ? "O Rei Louco riu por último." : result.winner === "city" ? "A cidade resistiu." : result.winner === "assassins" ? "A noite venceu." : "Uma cidade em silêncio."}</h1>
    <p>{result.winner === "fool" ? `Vitória individual de ${result.players.find((player) => player.id === result.winnerId)?.name ?? "Rei Louco"}! Foi eliminado pelo povo e encerrou a partida.` : result.winner === "city" ? "Vitória da cidade! Todos os assassinos foram descobertos." : result.winner === "assassins" ? "Vitória dos assassinos! Eles alcançaram o controle da cidade." : "Empate. Não restaram sobreviventes."}</p>
    <div class="result-actions">
      <button type="button" onclick={(event) => openDetails("players", event.currentTarget)}>Ver detalhes da partida</button>
      {#if admin}<button class="primary" disabled={!connected} onclick={() => send({ type: "restart" })}>Jogar novamente</button>{/if}
    </div>
    {#if admin}<p class="hint">Jogar novamente mantém o grupo, os papéis configurados e sua identificação como Narrador.</p>{:else}<p class="hint">Aguarde o Narrador iniciar uma nova partida.</p>{/if}
  </section>
{/if}

<div class="result-dock" role="group" aria-label="Resultado da partida" use:draggable={{ handle: ".dock-drag-handle" }}>
  <div class="dock-drag-handle" aria-hidden="true" title="Arraste para mover">⠿</div>
  <button type="button" class="hud-tool" aria-expanded={heroOpen} bind:this={resultDockButton} onclick={() => { details = null; heroOpen = !heroOpen; }}><GameGlyph name="shield" size={20} /><span>Resultado</span></button>
  <button type="button" class="hud-tool" aria-expanded={details !== null} bind:this={detailsDockButton} onclick={(event) => openDetails("players", event.currentTarget)}><GameGlyph name="scroll" size={20} /><span>Detalhes</span></button>
  {#if admin}<button type="button" class="hud-tool" disabled={!connected} onclick={closeRoom}>× <span>Fechar sala</span></button>{/if}
</div>

{#if details}
  <button type="button" class="drawer-scrim" aria-label="Fechar detalhes da partida" onclick={closeDetails}></button>
  <div class="context-drawer result-drawer" role="dialog" aria-modal="false" aria-label="Detalhes da partida" tabindex="-1" bind:this={drawer} use:draggable={{ handle: ".drawer-heading" }}>
    <div class="drawer-heading">
      <div><p class="eyebrow">AGORA TODOS OS SEGREDOS <span class="drawer-drag-grip" aria-hidden="true">⠿</span></p><h2>Como terminou</h2></div>
      <button type="button" class="drawer-close" aria-label="Fechar detalhes" onclick={closeDetails}>×</button>
    </div>
    <div class="drawer-tabs" role="group" aria-label="Detalhes do resultado">
      <button type="button" class:active={details === "players"} aria-pressed={details === "players"} onclick={() => (details = "players")}>Jogadores</button>
      <button type="button" class:active={details === "timeline"} aria-pressed={details === "timeline"} onclick={() => (details = "timeline")}>Histórico</button>
    </div>
    <div class="drawer-content">
      {#if details === "players"}
        <h3>Quem era quem</h3>
        <ul class="players compact-roster">
          {#each result.players as player}
            <li><img class="roster-avatar" class:dead={!player.alive} src={avatarForPlayer(player.id)} alt="" /><span class="player-name">{player.name}<small>{player.alive ? "Sobreviveu" : "Morto"}</small></span>{#if player.role}<span class="badge {player.role}">{roles[player.role].label}</span>{/if}</li>
          {/each}
        </ul>
      {:else}
        <h3>Como tudo aconteceu</h3>
        <ol class="ending-timeline">
          {#each result.timeline as event}
            <li data-phase={event.phase}><span class="eyebrow"><GameGlyph name={event.phase === "night" ? "moon" : "sun"} size={14} />{event.phase === "night" ? "Noite" : "Dia"} {event.round}</span><p>{event.text}</p></li>
          {/each}
        </ol>
      {/if}
    </div>
    {#if admin}<div class="drawer-bottom"><button class="primary" disabled={!connected} onclick={() => send({ type: "restart" })}>Jogar novamente</button><button disabled={!connected} onclick={closeRoom}>Fechar sala</button></div>{/if}
  </div>
{/if}
