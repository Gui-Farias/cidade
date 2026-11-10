<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import type { ClientMessage, Status, View } from "$lib/game/types";
  import { connectGame } from "$lib/game/websocket";
  import NarratorPanel from "$lib/components/NarratorPanel.svelte";
  import GameEnding from "$lib/components/GameEnding.svelte";
  import CityScenery from "$lib/components/CityScenery.svelte";
  import { visibleResidents } from "$lib/scenery/village";
  import PlayerPanel from "$lib/components/PlayerPanel.svelte";
  import RoomLobby from "$lib/components/RoomLobby.svelte";
  import GameGlyph from "$lib/components/GameGlyph.svelte";
  import crest from "$lib/assets/ui/crest.webp";
  import { draggable } from "$lib/ui/draggable";
  import "../../app.css";
  import "../../game-ui.css";
  import "../../game-reference.css";
  let { roomCode }: { roomCode?: string } = $props();
  let view = $state<View | null>(null);
  let connected = $state(false);
  let error = $state("");
  let actionErrorId = $state(0);
  let actionAck = $state<{ serial: number; action: "act" | "pass" | "day-vote" } | null>(null);
  let actionAckSerial = 0;
  let name = $state("");
  let rooster = $state<HTMLAudioElement>();
  let previousStatus = $state<Status | null>(null);
  let soundBlocked = $state(false);
  let soundDismissed = $state(false);
  let inviteLink = $state("");
  let copied = $state(false);
  let inviteFeedback = $state("");
  let toast = $state("");
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const showInvite = $derived(!!roomCode && !!view && view.kind !== "missing");
  let creating = $state(false);
  const gameView = $derived(
    view?.kind === "admin" || view?.kind === "player" ? view : null,
  );
  const sceneryPlayers = $derived(visibleResidents(gameView));
  const night = $derived(gameView?.status === "night");
  const phaseKind = $derived(
    gameView?.result ? "result" : gameView?.status === "night" ? "night" :
    gameView?.status === "day" && gameView.day?.phase === "voting" ? "voting" :
    gameView?.status === "day" ? "discussion" : "waiting",
  );
  const phaseGlyph = $derived(
    phaseKind === "night" ? "moon" : phaseKind === "discussion" ? "sun" :
    phaseKind === "voting" ? "vote" : "hourglass",
  );
  const phaseSubtitle = $derived(
    phaseKind === "night" ? "Escolha sua ação" :
    phaseKind === "discussion" ? "Discussão da cidade" :
    phaseKind === "voting" ? "Escolha um jogador" : "Aguardando jogadores",
  );
  const phaseLabel = $derived.by(() => {
    if (!gameView) return "";
    if (gameView.result) return "Fim de partida";
    if (gameView.status === "waiting") return "Preparação";
    if (gameView.status === "night")
      return gameView.kind === "admin" ? `Noite ${gameView.night}` : "Noite";
    return gameView.day?.phase === "voting" ? "Votação" : "Conversa";
  });
  const phaseTime = $derived(
    gameView?.status === "day" &&
    (gameView.day?.phase === "discussion" || gameView.day?.phase === "voting")
      ? gameView.day.remaining
      : null,
  );
  const pendingCount = $derived(
    gameView?.kind === "admin"
      ? gameView.status === "night"
        ? gameView.pendingPlayers.length
        : gameView.day?.phase === "voting"
          ? gameView.day.pending.length
          : 0
      : gameView?.kind === "player"
        ? gameView.status === "day"
          ? gameView.day?.phase === "voting" && !gameView.day.submitted && gameView.player.alive ? 1 : 0
          : gameView.action && !gameView.submitted ? 1 : 0
        : 0,
  );
  const profile = $derived(
    view?.kind === "player" ? view.player.role || "citizen" : "narrator",
  );
  let client: ReturnType<typeof connectGame> | undefined;
  function send(message: ClientMessage) {
    error = "";
    if (message.type === "create-room") creating = true;
    client?.send(message);
  }
  function announce(message: string) {
    toast = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ""), 3300);
  }
  function announceState(next: View) {
    const previous = view;
    if (previous?.kind === "admin" && next.kind === "admin") {
      if (next.players.length > previous.players.length) announce("Uma pessoa entrou na cidade.");
      else if (next.players.length < previous.players.length) announce("Uma pessoa deixou a cidade.");
    }
    if (previous?.kind === next.kind && "status" in previous && "status" in next && previous.status !== next.status) {
      if (next.status === "day") announce("A cidade acordou. Hora de conversar.");
      if (next.status === "night" && previous.status === "day") announce("A noite começou.");
    }
    if (previous?.kind === next.kind && "day" in previous && "day" in next &&
      previous.day?.phase === "discussion" && next.day?.phase === "voting")
      announce("A votação começou.");
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      copied = true;
      inviteFeedback = "Convite copiado!";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copied = false;
        inviteFeedback = "";
      }, 2500);
    } catch {
      clearTimeout(copyTimer);
      copied = false;
      inviteFeedback = "Não foi possível copiar o convite.";
      copyTimer = setTimeout(() => (inviteFeedback = ""), 3500);
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
        if (message.type === "state") {
          announceState(message.view);
          view = message.view;
        }
        if (message.type === "action-confirmed")
          actionAck = { serial: ++actionAckSerial, action: message.action };
        if (message.type === "identity" && !roomCode)
          void goto(`/sala/${message.roomCode}`, { replaceState: true });
        if (message.type === "room-closed") {
          void goto("/", { replaceState: true });
          return;
        }
        if (message.type === "error") {
          error = message.message;
          actionErrorId++;
          creating = false;
        }
      },
      (value) => {
        connected = value;
        if (!value) creating = false;
      },
      (message) => {
        error = message;
        actionErrorId++;
        creating = false;
      },
    );
    return () => {
      client?.close();
      clearTimeout(copyTimer);
      clearTimeout(toastTimer);
    };
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
  class="app-theme game-ui"
  data-time={night ? "night" : "day"}
  data-phase={phaseKind}
  data-profile={profile}
>
  <CityScenery
    players={sceneryPlayers}
    phase={gameView?.status ?? "waiting"}
    nightReady={gameView?.kind === "admin" ? gameView.canWake : gameView?.kind === "player" ? gameView.nightReady : false}
  />
  <div class="scene-shade" aria-hidden="true"></div>
  <div class="shell">
    <header class="hud" class:pre-game={!gameView}>
      <div class="hud-brand">
        <img class="brand-crest" src={crest} alt="" aria-hidden="true" />
        <span><strong>CIDADE DORME</strong><small>Uma vila, muitos segredos.</small></span>
      </div>
      {#if gameView && !gameView.result}
        <div class="hud-phase" aria-live="off">
          <span class="phase-medallion"><GameGlyph name={phaseGlyph} size={23} /></span>
          <span class="phase-copy"><strong>{phaseLabel}</strong><small>{phaseSubtitle}</small></span>
          {#if phaseTime !== null}<strong class="hud-timer" role="timer" aria-label={`${phaseTime} segundos restantes`}>
            {Math.floor(phaseTime / 60).toString().padStart(2, "0")}:{(phaseTime % 60).toString().padStart(2, "0")}
          </strong>{/if}
          {#if pendingCount}<span class="pending-indicator" aria-label={`${pendingCount} ação ou ações pendentes`}>{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</span>{/if}
          {#if phaseTime !== null && gameView?.day}<span class="phase-track" aria-hidden="true"><span style:width={`${(phaseTime / gameView.day.duration) * 100}%`}></span></span>{/if}
        </div>
      {/if}
      <div class="hud-right">
        {#if showInvite}
          <div class="invite-anchor">
            <button type="button" class="room-code-toggle" class:copied aria-label={`Copiar link de convite da sala ${roomCode}`} title="Copiar link de convite" onclick={copyInvite}>
              <GameGlyph name="users" size={20} /><span class="room-code-copy"><small>SALA</small><strong>{roomCode}</strong></span><GameGlyph name={copied ? "check" : "copy"} size={16} />
            </button>
            {#if inviteFeedback}<span class="invite-feedback" role="status"><GameGlyph name={copied ? "check" : "spark"} size={15} />{inviteFeedback}</span>{/if}
          </div>
        {/if}
        <span class="connection-status" class:online={connected} role="status" aria-label={connected ? "Conectado" : "Offline"} title={connected ? "Conectado" : "Offline"}>
          <i></i><span>{connected ? "Conectado" : "Offline"}{#if gameView?.kind === "admin"}<small>{gameView.players.filter((player) => player.connected).length} jogadores</small>{/if}</span>
        </span>
      </div>
    </header>
    <main class="game-main" data-screen={gameView?.result ? "ending" : (view?.kind ?? "loading")}>
      {#if soundBlocked && !soundDismissed}<div class="notice sound-notice" role="status" use:draggable={{ handle: ".notice-drag-handle" }}>
          <span class="notice-drag-handle" aria-hidden="true" title="Arraste para mover">⠿</span>
          O navegador bloqueou o som automático.
          <button onclick={playRooster}>Ativar som</button>
          <button type="button" class="sound-dismiss" aria-label="Dispensar aviso de som" onclick={() => (soundDismissed = true)}>×</button>
        </div>{/if}
      {#if error}<div class="error" role="alert" use:draggable={{ handle: ".notice-drag-handle" }}>
          <span class="notice-drag-handle" aria-hidden="true" title="Arraste para mover">⠿</span>
          {error}<button
            class="dismiss"
            onclick={() => (error = "")}
            aria-label="Fechar aviso">×</button
          >
        </div>{/if}{#if !connected && view}<div class="notice" role="status" use:draggable={{ handle: ".notice-drag-handle" }}>
          <span class="notice-drag-handle" aria-hidden="true" title="Arraste para mover">⠿</span>
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
      {:else if view.kind === "missing"}<section class="panel missing-room" use:draggable={{ handle: ".action-drag-handle" }}>
          <div class="action-drag-handle" aria-hidden="true"><span class="drag-grip">⠿</span> Arraste para mover</div>
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
      {:else if view.kind === "player"}<PlayerPanel {view} {send} {connected} {actionErrorId} {actionAck} />
      {:else}<div class="join-layout" use:draggable={{ handle: ".action-drag-handle" }}>
          <div class="action-drag-handle" aria-hidden="true"><span class="drag-grip">⠿</span> Arraste para mover</div>
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
    {#if toast}<div class="game-toast" class:success={toast.includes("registrad") || toast.includes("confirmad")} role="status"><span class="toast-icon"><GameGlyph name={toast.includes("registrad") || toast.includes("confirmad") ? "check" : "spark"} size={18} /></span>{toast}</div>{/if}
  </div>
</div>
