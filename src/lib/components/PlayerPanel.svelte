<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import type { PlayerView, ClientMessage, Role } from "$lib/game/types";
  import { roles } from "$lib/game/roles";
  import type { ActionReceipt as Receipt } from "$lib/ui/action-feedback";
  import { describeReceipt, passiveNightCopy } from "$lib/ui/action-feedback";
  import DayPanel from "./DayPanel.svelte";
  import RoleCard from "./RoleCard.svelte";
  import ActionReceipt from "./ActionReceipt.svelte";
  import GameGlyph from "./GameGlyph.svelte";
  import { avatarForPlayer } from "$lib/ui/avatars";
  import { draggable } from "$lib/ui/draggable";

  let {
    view,
    send,
    connected,
    actionErrorId,
    actionAck,
  }: {
    view: PlayerView;
    send: (message: ClientMessage) => void;
    connected: boolean;
    actionErrorId: number;
    actionAck: { serial: number; action: "act" | "pass" | "day-vote" } | null;
  } = $props();

  let selected = $state("");
  let sending = $state(false);
  let pendingReceipt = $state<Receipt | null>(null);
  let latestReceipt = $state<Receipt | null>(null);
  let receiptOpen = $state(false);
  let receiptLeaving = $state(false);
  let receiptButton = $state<HTMLButtonElement>();
  let secretButton = $state<HTMLButtonElement>();
  let receiptTimer: ReturnType<typeof setTimeout> | undefined;
  let receiptExitTimer: ReturnType<typeof setTimeout> | undefined;
  type Finding =
    | { key: string; kind: "vision"; name: string; role: Role }
    | { key: string; kind: "investigation"; name: string; isAssassin: boolean };
  let findings = $state<Finding[]>([]);
  let infoPanel = $state<"role" | "secrets" | null>(null);
  let infoDialog = $state<HTMLElement>();
  let infoTrigger: HTMLButtonElement | undefined;
  const actionKey = $derived(
    view.action
      ? `${view.action.turn}:${view.action.targets.map((target) => target.id).join(",")}`
      : "",
  );
  $effect(() => {
    const key = actionKey;
    selected = "";
  });

  let lastStage = "";
  let lastNightConfirmed = false;
  let lastVoteConfirmed = false;
  let lastErrorId = 0;
  let lastAckSerial = 0;

  function matchesAck(receipt: Receipt, action: "act" | "pass" | "day-vote") {
    return receipt.kind === "vote" ? action === "day-vote" : action === (receipt.passed ? "pass" : "act");
  }
  function showsAcceptedState(receipt: Receipt) {
    return receipt.kind === "vote"
      ? view.status !== "day" || view.day?.phase !== "voting" || !!view.day.submitted
      : view.status !== "night" || view.submitted;
  }

  function closeReceipt() {
    clearTimeout(receiptTimer);
    if (!receiptOpen || receiptLeaving) return;
    const restoreFocus = !!document.activeElement?.closest(".action-receipt");
    receiptLeaving = true;
    clearTimeout(receiptExitTimer);
    receiptExitTimer = setTimeout(() => {
      receiptOpen = false;
      receiptLeaving = false;
      if (restoreFocus) receiptButton?.focus();
    }, 180);
  }
  function showReceipt(receipt: Receipt) {
    clearTimeout(receiptExitTimer);
    receiptLeaving = false;
    latestReceipt = receipt;
    pendingReceipt = null;
    sending = false;
    receiptOpen = true;
    clearTimeout(receiptTimer);
    const duration = receipt.kind === "night" && (receipt.turn === "seer" || receipt.turn === "detective") ? 6500 : 4200;
    receiptTimer = setTimeout(closeReceipt, duration);
  }
  function submitNight(passed = false) {
    const action = view.action;
    if (!action || !connected || sending || (!passed && !selected)) return;
    const target = action.targets.find((item) => item.id === selected);
    pendingReceipt = {
      kind: "night", role: view.player.role ?? "citizen", turn: action.turn,
      targetId: passed ? null : selected,
      targetName: passed ? null : target?.name ?? null,
      passed,
    };
    sending = true;
    send(passed ? { type: "pass" } : { type: "act", targetId: selected });
  }
  function submitVote(targetId: string | null, targetName: string | null) {
    if (!connected || sending) return;
    pendingReceipt = {
      kind: "vote", role: view.player.role ?? "citizen", targetId, targetName,
      passed: targetId === null,
    };
    sending = true;
    send({ type: "day-vote", targetId });
  }
  function openReceipt() {
    if (latestReceipt) showReceipt(latestReceipt);
  }
  function openSecretsFromReceipt() {
    closeReceipt();
    if (secretButton) void openInfo("secrets", secretButton);
  }

  $effect(() => {
    if (actionAck && actionAck.serial > lastAckSerial) {
      if (pendingReceipt && matchesAck(pendingReceipt, actionAck.action)) {
        if (showsAcceptedState(pendingReceipt)) {
          lastAckSerial = actionAck.serial;
          showReceipt(pendingReceipt);
        }
      } else lastAckSerial = actionAck.serial;
    }
  });
  $effect(() => {
    const stage = `${view.status}:${view.day?.phase ?? ""}:${view.player.role ?? ""}`;
    if (stage !== lastStage) {
      if (pendingReceipt && actionAck && actionAck.serial > lastAckSerial && matchesAck(pendingReceipt, actionAck.action) && showsAcceptedState(pendingReceipt)) {
        lastAckSerial = actionAck.serial;
        showReceipt(pendingReceipt);
      }
      if (!receiptOpen) {
        clearTimeout(receiptTimer);
        latestReceipt = null;
      }
      sending = false;
      pendingReceipt = null;
      if (view.status === "waiting") findings = [];
      lastStage = stage;
    }
  });
  $effect(() => {
    const confirmed = view.status === "night" && view.submitted;
    if (confirmed && !lastNightConfirmed && pendingReceipt?.kind === "night") showReceipt(pendingReceipt);
    lastNightConfirmed = confirmed;
  });
  $effect(() => {
    const confirmed = view.status === "day" && view.day?.phase === "voting" && !!view.day.submitted;
    if (confirmed && !lastVoteConfirmed && pendingReceipt?.kind === "vote") showReceipt(pendingReceipt);
    lastVoteConfirmed = confirmed;
  });
  $effect(() => {
    if (actionErrorId !== lastErrorId) {
      lastErrorId = actionErrorId;
      sending = false;
      pendingReceipt = null;
    }
  });
  $effect(() => {
    if (!connected && sending) {
      sending = false;
      pendingReceipt = null;
    }
  });
  $effect(() => {
    if (view.vision) {
      const { name, role } = view.vision;
      const key = `vision:${name}:${role}`;
      if (!findings.some((item) => item.key === key)) findings = [...findings, { key, kind: "vision", name, role }];
    }
    if (view.investigation) {
      const { name, isAssassin } = view.investigation;
      const key = `investigation:${name}:${isAssassin}`;
      if (!findings.some((item) => item.key === key)) findings = [...findings, { key, kind: "investigation", name, isAssassin }];
    }
  });
  onDestroy(() => {
    clearTimeout(receiptTimer);
    clearTimeout(receiptExitTimer);
  });

  async function openInfo(panel: "role" | "secrets", trigger: HTMLButtonElement) {
    if (infoPanel === panel) return closeInfo();
    infoTrigger = trigger;
    infoPanel = panel;
    await tick();
    infoDialog?.focus();
  }
  async function closeInfo() {
    infoPanel = null;
    await tick();
    infoTrigger?.focus();
  }
  const actionTitle = $derived(
    view.action?.turn === "assassins"
      ? "Escolha uma vítima"
      : view.action?.turn === "doctor" || view.action?.turn === "bodyguard"
        ? "Quem você deseja proteger?"
        : view.action?.turn === "sheriff"
          ? "Em quem deseja usar uma bala?"
          : view.action?.turn === "seer"
            ? "De quem deseja ver o papel?"
            : "Quem deseja investigar?",
  );
  const actionGlyph = $derived(
    view.action?.turn === "assassins" || view.action?.turn === "sheriff" ? "sword" :
    view.action?.turn === "doctor" || view.action?.turn === "bodyguard" ? "heart" : "eye",
  );
  const confirmedReceipt = $derived(
    latestReceipt && ((latestReceipt.kind === "night" && view.status === "night" && view.submitted) ||
      (latestReceipt.kind === "vote" && view.status === "day" && view.day?.phase === "voting" && view.day.submitted))
      ? latestReceipt : null,
  );
  const receiptPresentation = $derived(confirmedReceipt ? describeReceipt(confirmedReceipt, view) : null);
  const nightSummary = $derived(
    receiptPresentation?.compact ??
    (view.player.role === "seer" && view.vision ? "Visão revelada" :
      view.player.role === "detective" && view.investigation ? "Investigação concluída" :
      view.player.role === "assassin" ? "Voto da noite registrado" :
      view.player.role === "doctor" ? "Proteção registrada" :
      view.player.role === "bodyguard" ? "Vigília registrada" :
      view.player.role === "sheriff" ? "Decisão do Xerife registrada" : "Ação confirmada"),
  );
</script>

<svelte:window onkeydown={(event) => { if (event.key === "Escape") { if (infoPanel) void closeInfo(); else if (receiptOpen) closeReceipt(); } }} />

<div class="player-hud" use:draggable={{ handle: ".dock-drag-handle", resetKey: view.status }}>
  <div class="dock-drag-handle" aria-hidden="true" title="Arraste para mover">⠿</div>
  <span class="player-identity" title={view.player.name}>
    <img class="player-avatar" class:dead={!view.player.alive} src={avatarForPlayer(view.player.id)} alt="" />
    {view.player.name}
  </span>
  {#if view.status !== "waiting" && view.player.role}
    <button type="button" class="hud-tool" aria-expanded={infoPanel === "role"} onclick={(event) => openInfo("role", event.currentTarget)}><GameGlyph name="mask" size={22} /><span>Meu papel</span></button>
  {/if}
  {#if findings.length || view.vision || view.investigation}
    <button type="button" class="hud-tool secret-tool" bind:this={secretButton} aria-expanded={infoPanel === "secrets"} onclick={(event) => openInfo("secrets", event.currentTarget)}><GameGlyph name="eye" size={21} /><span>Segredos</span><b>{findings.length || 1}</b></button>
  {/if}
  {#if view.player.role === "sheriff" && view.status !== "waiting"}
    <span class="ammo-chip" title="Munição do Xerife"><GameGlyph name="spark" size={16} /> {view.bulletsAvailable} {view.bulletsAvailable === 1 ? "bala" : "balas"}</span>
  {/if}
</div>

{#if view.status === "waiting"}
  <div class="quiet-status" role="status" use:draggable={{ handle: ".quiet-status" }}>Seu lugar está reservado. Aguardando o Narrador.</div>
{:else if !view.player.alive}
  <div class="quiet-status" role="status" use:draggable={{ handle: ".quiet-status" }}>Você foi eliminado. Acompanhe a partida.</div>
{:else if view.status === "day" && view.day?.phase === "discussion"}
  <div class="quiet-status" role="status" use:draggable={{ handle: ".quiet-status" }}>Converse com o grupo. O Narrador pode iniciar a votação antes do tempo acabar.</div>
{:else if view.status === "day" && view.day?.phase === "voting" && view.day.submitted}
  <div class="quiet-status confirmed action-waiting" data-tone="gold" role="status" use:draggable={{ handle: ".quiet-status" }}><GameGlyph name="vote" size={20} /><span><strong>{receiptPresentation?.compact ?? "Voto confirmado"}</strong><small>Aguardando o fim da votação</small></span>{#if confirmedReceipt}<button type="button" bind:this={receiptButton} onclick={openReceipt}>Ver retorno</button>{/if}</div>
{:else if view.status === "night" && view.submitted}
  <div class="quiet-status confirmed action-waiting" data-tone={receiptPresentation?.tone ?? "gold"} role="status" use:draggable={{ handle: ".quiet-status" }}><GameGlyph name={receiptPresentation?.glyph ?? "check"} size={20} /><span><strong>{nightSummary}</strong><small>{receiptPresentation?.waiting ?? "Aguardando o amanhecer"}</small></span>{#if confirmedReceipt}<button type="button" bind:this={receiptButton} onclick={openReceipt}>Ver retorno</button>{/if}</div>
{:else if view.status === "night" && !view.action}
  <div class="quiet-status passive-night" role="status" use:draggable={{ handle: ".quiet-status" }}><GameGlyph name={view.player.role === "fool" ? "crown" : "moon"} size={18} />{passiveNightCopy(view.player.role, view.bulletsAvailable)}</div>
{/if}

{#if view.status === "day" && view.day?.phase === "voting" && view.player.alive && !view.day.submitted}
  <div class="action-dialog vote-dialog" role="region" aria-label="Sua votação" use:draggable={{ handle: ".action-drag-handle" }}>
    <div class="action-drag-handle" aria-hidden="true"><span class="drag-grip">⠿</span> Arraste para mover</div>
    <DayPanel day={view.day} alive={view.player.alive} {connected} {send} {sending} onVote={submitVote} />
  </div>
{:else if view.status === "night" && view.action && view.player.alive && !view.submitted}
  <section class="action-dialog" data-action={view.action.turn} aria-labelledby="night-action-title" use:draggable={{ handle: ".action-drag-handle" }}>
    <div class="action-drag-handle" aria-hidden="true"><span class="drag-grip">⠿</span> Arraste para mover</div>
    <span class="action-medallion"><GameGlyph name={actionGlyph} size={30} /></span>
    <div class="action-kicker">SUA AÇÃO</div>
    <h1 id="night-action-title">{actionTitle}</h1>
    <p class="action-caption">{view.action.turn === "seer" ? "O papel exato aparecerá após a confirmação." : view.action.turn === "detective" ? "A resposta secreta aparecerá após a confirmação." : view.action.turn === "sheriff" ? "Uma bala será usada; o desfecho virá ao amanhecer." : "Sua escolha é secreta. O desfecho virá ao amanhecer."}</p>
    <form onsubmit={(event) => { event.preventDefault(); submitNight(); }}>
      <fieldset disabled={!connected || sending}>
        <legend class="sr-only">Escolha um jogador</legend>
        <div class="targets action-targets">
          {#each view.action.targets as target}
            <label class:selected={selected === target.id}>
              <input type="radio" name="night-target" value={target.id} bind:group={selected} />
              <img class="target-avatar" src={avatarForPlayer(target.id)} alt="" />
              {target.name}
            </label>
          {/each}
        </div>
        <div class="action-footer">
          <button class="primary full" disabled={!selected || sending}>
            <GameGlyph name={sending ? "hourglass" : actionGlyph} size={17} />{sending ? "Registrando ação..." : view.action.turn === "seer" || view.action.turn === "detective" ? "Revelar resposta" : "Confirmar escolha"}
          </button>
        </div>
      </fieldset>
    </form>
    {#if view.action.turn === "sheriff"}
      <button type="button" class="secondary-action" disabled={!connected || sending} onclick={() => submitNight(true)}>Guardar a bala nesta noite</button>
      <p class="hint">O tiro será resolvido ao amanhecer. Uma bala é gasta ao confirmar.</p>
    {/if}
    {#if view.action.targets.length === 0}<p class="hint">Não há alvos disponíveis. Aguarde o Narrador.</p>{/if}
  </section>
{/if}

{#if receiptOpen && latestReceipt}
  <ActionReceipt receipt={latestReceipt} {view} leaving={receiptLeaving} onClose={closeReceipt} onOpenSecrets={openSecretsFromReceipt} />
{/if}

{#if infoPanel}
  <button type="button" class="drawer-scrim" aria-label="Fechar informações" onclick={closeInfo}></button>
  <div class="context-drawer" role="dialog" aria-modal="false" aria-label={infoPanel === "role" ? "Meu papel" : "Meus segredos"} tabindex="-1" bind:this={infoDialog} use:draggable={{ handle: ".drawer-heading" }}>
    <div class="drawer-heading">
      <div><p class="eyebrow">SÓ VOCÊ PODE VER <span class="drawer-drag-grip" aria-hidden="true">⠿</span></p><h2>{infoPanel === "role" ? "Meu papel" : "Meus segredos"}</h2></div>
      <button type="button" class="drawer-close" aria-label="Fechar painel" onclick={closeInfo}>×</button>
    </div>
    <div class="drawer-content">
      {#if infoPanel === "role" && view.player.role}
        <RoleCard role={view.player.role} partners={view.partners} alive={view.player.alive} />
        {#if view.player.role === "sheriff"}<p class="drawer-note">Munição restante: {view.bulletsAvailable} {view.bulletsAvailable === 1 ? "bala" : "balas"}.</p>{/if}
      {:else}
        {#each findings as finding (finding.key)}
          <div class="secret-result"><p class="eyebrow">{finding.kind === "vision" ? "VISÃO DA VIDENTE" : "INVESTIGAÇÃO DO DETETIVE"}</p><strong>{finding.name} {finding.kind === "vision" ? `— ${roles[finding.role].label}` : finding.isAssassin ? "é Assassino." : "não é Assassino."}</strong></div>
        {/each}
      {/if}
    </div>
  </div>
{/if}
