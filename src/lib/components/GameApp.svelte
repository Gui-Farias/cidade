<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import type { ClientMessage, Status, View } from "$lib/game/types";
  import { connectGame } from "$lib/game/websocket";
  import NarratorPanel from "$lib/components/NarratorPanel.svelte";
  import GameEnding from "$lib/components/GameEnding.svelte";
  import SkyScene from "$lib/components/SkyScene.svelte";
  import PlayerPanel from "$lib/components/PlayerPanel.svelte";
  import RoomLobby from "$lib/components/RoomLobby.svelte";
  import "../../app.css";
  let { roomCode }: { roomCode?: string } = $props();
  let view = $state<View | null>(null);
  let connected = $state(false);
  let error = $state("");
  let name = $state("");
  let rooster = $state<HTMLAudioElement>();
  let previousStatus = $state<Status | null>(null);
  let soundBlocked = $state(false);
  let inviteLink = $state("");
  let copied = $state(false);
  let creating = $state(false);
  const gameView = $derived(
    view?.kind === "admin" || view?.kind === "player" ? view : null,
  );
  const night = $derived(gameView?.status === "night");
  const profile = $derived(
    view?.kind === "player" ? view.player.role || "citizen" : "narrator",
  );
  let client: ReturnType<typeof connectGame> | undefined;
  function send(message: ClientMessage) {
    error = "";
    if (message.type === "create-room") creating = true;
    client?.send(message);
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      copied = true;
    } catch {
      error =
        "Não foi possível copiar automaticamente. Selecione e copie o link do convite abaixo.";
    }
  }
  function playRooster() {
    if (!rooster) return;
    rooster.currentTime = 0;
    void rooster.play().then(
      () => (soundBlocked = false),
      () => (soundBlocked = true),
    );
  }
  $effect(() => {
    const status = gameView?.status ?? null;
    const gameStarted =
      status === "night" &&
      (previousStatus === "waiting" || previousStatus === "finished");
    const dayBroke = status === "day" && previousStatus === "night";
    if (gameStarted || dayBroke) playRooster();
    previousStatus = status;
  });
  onMount(() => {
    if (roomCode)
      inviteLink = `${location.origin}/sala/${encodeURIComponent(roomCode)}`;
    client = connectGame(
      roomCode,
      (message) => {
        if (message.type === "state") view = message.view;
        if (message.type === "identity" && !roomCode)
          void goto(`/sala/${message.roomCode}`, { replaceState: true });
        if (message.type === "room-closed") {
          void goto("/", { replaceState: true });
          return;
        }
        if (message.type === "error") {
          error = message.message;
          creating = false;
        }
      },
      (value) => {
        connected = value;
        if (!value) creating = false;
      },
      (message) => {
        error = message;
        creating = false;
      },
    );
    return () => client?.close();
  });
</script>

<audio bind:this={rooster} preload="auto" src="/galo.mp3"></audio>

<svelte:head
  ><title
    >{roomCode
      ? `Sala ${roomCode} — Cidade Dorme`
      : "Cidade Dorme — uma noite, muitos segredos"}</title
  ><meta
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
    <header class="atmosphere">
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
    </header>
    <main>
      {#if roomCode && view && view.kind !== "missing"}
        <section class="room-bar" aria-label="Convite da sala">
          <div>
            <p class="eyebrow">SUA SALA</p>
            <strong class="room-code">{roomCode}</strong>
          </div>
          <div class="room-invite">
            <label for="invite-link" class="sr-only">Link de convite</label>
            <input
              id="invite-link"
              readonly
              value={inviteLink}
              onclick={(event) => event.currentTarget.select()}
            />
            <button onclick={copyInvite}
              >{copied ? "Link copiado!" : "Copiar convite"}</button
            >
          </div>
          <a class="home-link" href="/">Página inicial</a>
        </section>
      {/if}
      {#if soundBlocked}<div class="notice sound-notice" role="status">
          O navegador bloqueou o som automático.
          <button onclick={playRooster}>Ativar som</button>
        </div>{/if}
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
      {:else if view.kind === "lobby"}<RoomLobby
          {connected}
          {creating}
          {send}
        />
      {:else if view.kind === "missing"}<section class="panel missing-room">
          <p class="eyebrow">SALA INDISPONÍVEL</p>
          <h1>Essa cidade não está aqui.</h1>
          <p>
            Confira o código do convite. A sala pode ter expirado ou o servidor
            pode ter sido reiniciado.
          </p>
          <a class="home-link" href="/"
            >Voltar para criar ou entrar em uma sala</a
          >
        </section>
      {:else if gameView?.result}<GameEnding
          result={gameView.result}
          admin={gameView.kind === "admin"}
          {connected}
          {send}
        />
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
      <span>CIDADE DORME</span>
      <span>#guiFariasTheFirstOfHisName</span>
      <span>#justiceForTinkerbell</span>
    </footer>
  </div>
</div>
