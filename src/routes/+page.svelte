<script lang="ts">
  import { onMount } from "svelte";
  import type { ClientMessage, View } from "$lib/game/types";
  import { connectGame } from "$lib/game/websocket";
  import NarratorPanel from "$lib/components/NarratorPanel.svelte";
  import SkyScene from "$lib/components/SkyScene.svelte";
  import PlayerPanel from "$lib/components/PlayerPanel.svelte";
  import "../app.css";
  let view = $state<View | null>(null);
  let connected = $state(false);
  let error = $state("");
  let name = $state("");
  const night = $derived(view?.kind !== "guest" && view?.status === "night");
  const profile = $derived(
    view?.kind === "player" ? view.player.role || "citizen" : "narrator",
  );
  let client: ReturnType<typeof connectGame> | undefined;
  function send(message: ClientMessage) {
    error = "";
    client?.send(message);
  }
  onMount(() => {
    client = connectGame(
      (message) => {
        if (message.type === "state") view = message.view;
        if (message.type === "error") error = message.message;
      },
      (value) => (connected = value),
      (message) => (error = message),
    );
    return () => client?.close();
  });
</script>

<svelte:head
  ><title>Cidade Dorme — uma noite, muitos segredos</title><meta
    name="description"
    content="Reúna seus amigos na chamada. Uma partida de Cidade Dorme, simples e em tempo real."
  /><meta
    name="theme-color"
    content={night ? "#151923" : "#f3eddf"}
  /></svelte:head
>
<div
  class="app-theme"
  data-time={night ? "night" : "day"}
  data-profile={profile}
>
  <div class="shell">
    <header>
      <a class="brand" href="/" aria-label="Cidade Dorme, início"
        ><span class="brand-icon" aria-hidden="true">☾</span>CIDADE DORME</a
      ><span class="connection"
        ><i class:online={connected}></i>{connected
          ? "Conectado"
          : "Conectando…"}</span
      >
    </header>
    <div class="atmosphere">
      <div class="atmosphere-copy">
        <span class="sky-kicker">UMA CIDADE, MUITOS SEGREDOS</span>
        <p>
          {night
            ? "A noite guarda suas escolhas."
            : "Sob a luz, novas suspeitas."}
        </p>
        <span class="sky-caption"
          >{night
            ? "A cidade dorme. Siga seu instinto."
            : "Encontre sua turma. Entre na história."}</span
        >
      </div>
      <SkyScene {night} />
    </div>
    <main>
      {#if error}<div class="error" role="alert">
          {error}<button
            class="dismiss"
            onclick={() => (error = "")}
            aria-label="Fechar aviso">×</button
          >
        </div>{/if}{#if !connected && view}<div class="notice" role="status">
          Reconectando ao servidor… Suas ações estarão disponíveis quando a
          conexão voltar.
        </div>{/if}
      {#if !view}<div class="loading">
          <span class="moon" aria-hidden="true">☾</span>
          <h1>A cidade está chegando.</h1>
          <p>Conectando ao servidor…</p>
        </div>
      {:else if view.kind === "admin"}<NarratorPanel
          {view}
          {send}
          {connected}
        />
      {:else if view.kind === "player"}<PlayerPanel {view} {send} {connected} />
      {:else}<div class="join-layout">
          <p class="eyebrow">QUANDO A NOITE CAI</p>
          <h1>Todos têm<br />algo a esconder<span class="accent">.</span></h1>
          <p>Entre na chamada. Encontre seu lugar na cidade.</p>
          <section class="panel join-card">
            {#if view.closed}<h2>A partida já começou.</h2>
              <p>
                Novos jogadores não podem entrar nesta sessão. Se você já
                entrou, use o mesmo navegador e endereço.
              </p>{:else}<form
                onsubmit={(e) => {
                  e.preventDefault();
                  send({ type: "join", name });
                }}
              >
                <label for="name">Digite seu nome</label><input
                  id="name"
                  autocomplete="given-name"
                  placeholder="Como podemos chamar você?"
                  maxlength="32"
                  required
                  bind:value={name}
                  disabled={!connected}
                /><button
                  class="primary full"
                  disabled={!connected || !name.trim()}
                  >Entrar na cidade <span aria-hidden="true">↗</span></button
                >
              </form>
              <p class="hint">Só um nome. Seu segredo vem depois.</p>{/if}
          </section>
        </div>{/if}
    </main>
    <footer>
      <span>CIDADE DORME</span><span
        >O jogo acontece aqui. A conversa, na sua chamada.</span
      ><span>{night ? "BOA NOITE. ☾" : "UM NOVO DIA. ☼"}</span>
    </footer>
  </div>
</div>
