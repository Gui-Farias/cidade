<script lang="ts">
  import { onMount } from "svelte";
  import type { AdminPlayer, AdminView, ClientMessage, NightAction, Role } from "$lib/game/types";
  import { roles, minimumPlayers, specialRoleCount } from "$lib/game/roles";
  import GameGlyph from "./GameGlyph.svelte";
  import { avatarForPlayer } from "$lib/ui/avatars";
  import { draggable } from "$lib/ui/draggable";

  let { view, send, connected }: { view: AdminView; send: (message: ClientMessage) => void; connected: boolean } = $props();
  const roleOrder: Role[] = ["assassin", "doctor", "detective", "bodyguard", "seer", "sheriff", "fool", "citizen"];
  let collapsed = $state(false);
  let screen = $state<"city" | "decisions">("city");
  let previousPhase = "";

  const minimum = $derived(minimumPlayers(view.roleCounts));
  const citizens = $derived(Math.max(0, view.players.length - specialRoleCount(view.roleCounts)));
  const connectedCount = $derived(view.players.filter((player) => player.connected).length);
  const aliveCount = $derived(view.players.filter((player) => player.alive).length);
  const actionByPlayer = $derived(new Map(view.nightActions.map((action) => [action.playerId, action])));
  const assassinVoteByPlayer = $derived(new Map(view.assassinVotes.map((vote) => [vote.playerId, vote.targetId])));
  const dayVoteByPlayer = $derived(new Map(view.day?.votes.map((vote) => [vote.playerId, vote.targetId]) ?? []));
  const pendingAtNight = $derived(new Set(view.pendingPlayers.map((player) => player.id)));
  const nightDone = $derived(view.assassinVotes.filter((vote) => vote.targetId).length + view.nightActions.filter((action) => action.targetId || action.passed).length);
  const nightTotal = $derived(nightDone + view.pendingPlayers.length);
  const voteDone = $derived(view.day?.votes.length ?? 0);
  const voteTotal = $derived(voteDone + (view.day?.pending.length ?? 0));
  const phaseName = $derived(view.status === "waiting" ? "Preparação" : view.status === "night" ? `Noite ${view.night}` : view.day?.phase === "voting" ? "Votação" : "Conversa");

  $effect(() => {
    const phase = `${view.status}:${view.day?.phase ?? ""}`;
    if (previousPhase && phase !== previousPhase) screen = "city";
    previousPhase = phase;
  });
  onMount(() => {
    const media = matchMedia("(max-width: 760px)");
    const adapt = () => (collapsed = media.matches);
    adapt();
    media.addEventListener("change", adapt);
    return () => media.removeEventListener("change", adapt);
  });

  const playerName = (id: string | null) => id ? view.players.find((player) => player.id === id)?.name ?? "Jogador" : "Ninguém";
  const roleCount = (role: Role) => role === "citizen" ? citizens : view.roleCounts[role];
  const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  function actionLabel(action: NightAction) {
    if (action.passed) return "Guardou as balas";
    if (!action.targetId && !view.players.find((player) => player.id === action.playerId)?.alive) return "Eliminado";
    if (!action.targetId) return action.role === "sheriff" && action.bulletsAvailable === 0 ? "Sem balas" : "Aguardando ação";
    const verb = action.role === "doctor" || action.role === "bodyguard" ? "Protegeu" : action.role === "sheriff" ? "Atirou em" : action.role === "seer" ? "Viu" : "Investigou";
    return `${verb} ${playerName(action.targetId)}`;
  }
  function playerProgress(player: AdminPlayer) {
    if (view.status === "waiting") return player.connected ? "Na sala" : "Offline";
    if (!player.alive) return "Eliminado";
    if (view.status === "night") {
      if (player.role === "citizen" || player.role === "fool") return "Sem ação noturna";
      if (pendingAtNight.has(player.id)) return "Aguardando ação";
      if (player.role === "assassin") {
        const target = assassinVoteByPlayer.get(player.id);
        return target ? `Alvo: ${playerName(target)}` : "Sem alvo disponível";
      }
      const action = actionByPlayer.get(player.id);
      return action ? actionLabel(action) : "Aguardando ação";
    }
    if (view.day?.phase === "voting") {
      if (!dayVoteByPlayer.has(player.id)) return "Voto pendente";
      const target = dayVoteByPlayer.get(player.id);
      return target ? `Votou em ${playerName(target)}` : "Absteve-se";
    }
    return "Na conversa";
  }
  function playerState(player: AdminPlayer) {
    if (!player.alive) return "dead";
    if (!player.connected) return "offline";
    if (view.status === "night" && pendingAtNight.has(player.id)) return "pending";
    if (view.day?.phase === "voting" && !dayVoteByPlayer.has(player.id)) return "pending";
    return "ready";
  }
  function closeRoom() {
    if (confirm("Fechar esta sala? Todos voltarão para a página inicial e o convite deixará de funcionar.")) send({ type: "close-room" });
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === "Escape" && !collapsed) collapsed = true; }} />

<section class="director-console" class:collapsed aria-label="Mesa do Narrador" use:draggable={{ handle: ".director-console-head", resetKey: collapsed }}>
  <div class="director-console-head">
    <span class="director-emblem"><GameGlyph name="crown" size={22} /></span>
    <span class="director-heading"><small>MESA DO NARRADOR</small><strong>{phaseName}</strong></span>
    <span class="director-drag-grip" aria-hidden="true">⠿</span>
    <span class="director-head-count" aria-label={`${view.players.length} jogadores`}><GameGlyph name="users" size={16} /> {view.players.length}</span>
    <button type="button" class="director-toggle" aria-expanded={!collapsed} aria-label={collapsed ? "Abrir mesa do Narrador" : "Recolher mesa do Narrador"} onclick={() => (collapsed = !collapsed)}>{collapsed ? "+" : "−"}</button>
  </div>
  {#if !collapsed}
    <div class="director-console-body">
      <div class="director-metrics" aria-label="Resumo da cidade"><span><strong>{view.players.length}</strong><small>Jogadores</small></span><span><strong>{aliveCount}</strong><small>Vivos</small></span><span><strong>{connectedCount}</strong><small>Conectados</small></span></div>

      <section class="director-stage" aria-label="Situação atual da partida">
        {#if view.status === "waiting"}
          <div class="director-stage-title"><span class="director-stage-icon"><GameGlyph name="users" size={20} /></span><div><small>PREPARAÇÃO</small><h2>{view.players.length >= minimum ? "A cidade está pronta" : "Reunindo a cidade"}</h2></div></div>
          <p>{view.players.length >= minimum ? "Confira o elenco e comece o sorteio dos papéis." : `Faltam ${minimum - view.players.length} jogadores para começar.`}</p>
          <div class="director-progress-copy"><span>{view.players.length} na sala</span><span>Mínimo {minimum}</span></div>
          <div class="director-progress"><span style:width={`${Math.min(100, view.players.length / minimum * 100)}%`}></span></div>
          {#if view.players.length >= minimum && view.roleCounts.assassin * 2 >= view.players.length}<p class="director-alert">Os Assassinos já são metade da cidade e vencerão ao iniciar. Convide mais pessoas.</p>{/if}
          <button type="button" class="primary director-main-action" disabled={!connected || view.players.length < minimum} onclick={() => send({ type: "draw" })}><GameGlyph name="spark" size={17} /> Sortear papéis</button>
        {:else if view.status === "night"}
          <div class="director-stage-title"><span class="director-stage-icon"><GameGlyph name="moon" size={20} /></span><div><small>NOITE {view.night}</small><h2>{view.canWake ? "Todas as ações chegaram" : "Decisões em andamento"}</h2></div></div>
          <div class="director-progress-copy"><span>{nightDone} de {nightTotal} ações recebidas</span><strong>{view.pendingPlayers.length} pendente{view.pendingPlayers.length === 1 ? "" : "s"}</strong></div>
          <div class="director-progress"><span style:width={`${nightTotal ? nightDone / nightTotal * 100 : 100}%`}></span></div>
          {#if view.pendingPlayers.length}<p class="director-pending">Aguardando: <strong>{view.pendingPlayers.map((player) => player.name).join(", ")}</strong></p>{:else}<p>Você pode anunciar o amanhecer quando estiver pronto.</p>{/if}
          <button type="button" class="primary director-main-action" disabled={!connected || !view.canWake} onclick={() => send({ type: "wake" })}><GameGlyph name="sun" size={18} /> Cidade acorda</button>
        {:else if view.day}
          <div class="director-stage-title"><span class="director-stage-icon"><GameGlyph name={view.day.phase === "voting" ? "vote" : "sun"} size={20} /></span><div><small>DIA {view.night}</small><h2>{view.day.phase === "voting" ? "Votação da cidade" : "Hora de conversar"}</h2></div><strong class="director-stage-clock" role="timer">{clock(view.day.remaining)}</strong></div>
          {#if view.day.phase === "voting"}
            <div class="director-progress-copy"><span>{voteDone} de {voteTotal} votos recebidos</span><strong>{view.day.pending.length} pendente{view.day.pending.length === 1 ? "" : "s"}</strong></div>
            <div class="director-progress"><span style:width={`${voteTotal ? voteDone / voteTotal * 100 : 100}%`}></span></div>
            {#if view.day.pending.length}<p class="director-pending">Aguardando: <strong>{view.day.pending.map((player) => player.name).join(", ")}</strong></p>{:else}<p>Todos votaram. O resultado será resolvido pelo jogo.</p>{/if}
          {:else}<p>A votação começa automaticamente após 1 minuto e 30 segundos de conversa. Se a cidade estiver pronta, você pode iniciá-la antes.</p><div class="director-progress"><span style:width={`${view.day.duration ? view.day.remaining / view.day.duration * 100 : 0}%`}></span></div><button type="button" class="director-main-action director-skip-action" disabled={!connected} onclick={() => send({ type: "start-voting" })}><GameGlyph name="vote" size={17} /> Encerrar conversa e iniciar votação</button>{/if}
          {#if view.outcome}<p class="director-outcome">{view.outcome}</p>{/if}
        {/if}
      </section>

      <div class="director-tabs" role="group" aria-label="Informações do Narrador"><button type="button" class:active={screen === "city"} aria-pressed={screen === "city"} onclick={() => (screen = "city")}><GameGlyph name="users" size={16} /> Elenco</button><button type="button" class:active={screen === "decisions"} aria-pressed={screen === "decisions"} onclick={() => (screen = "decisions")}><GameGlyph name="scroll" size={16} /> {view.status === "waiting" ? "Papéis" : "Decisões"}</button></div>

      <div class="director-scroll">
        {#if screen === "city"}
          <div class="director-list-title"><div><small>VISÃO PRIVADA</small><h3>Jogadores e papéis</h3></div><span>{view.players.length.toString().padStart(2, "0")}</span></div>
          {#if view.players.length === 0}<p class="director-empty">Ninguém entrou ainda. Compartilhe o convite da sala.</p>{/if}
          <ul class="director-roster">
            {#each view.players as player (player.id)}
              <li data-role={player.role ?? "unknown"} data-state={playerState(player)}>
                <img src={avatarForPlayer(player.id)} alt="" class:dead={!player.alive} />
                <div class="director-player-copy"><strong>{player.name}</strong><small>{playerProgress(player)}</small></div>
                <div class="director-player-right">{#if player.role}<span class="director-role">{roles[player.role].label}</span>{:else}<span class="director-role undecided">Sem papel</span>{/if}<span class="director-state-dot" title={!player.alive ? "Eliminado" : player.connected ? "Conectado" : "Offline"}></span></div>
                {#if view.status === "waiting"}<button type="button" class="director-expel" disabled={!connected} aria-label={`Expulsar ${player.name}`} onclick={() => { if (confirm(`Expulsar ${player.name}? A pessoa terá de entrar novamente.`)) send({ type: "expel-player", playerId: player.id }); }}>Expulsar</button>{/if}
              </li>
            {/each}
          </ul>
          {#if view.status !== "waiting"}<p class="director-private-note"><GameGlyph name="eye" size={14} /> Os papéis e as escolhas são visíveis só para o Narrador.</p>{/if}
        {:else if view.status === "waiting"}
          <div class="director-list-title"><div><small>CONFIGURAÇÃO</small><h3>Papéis desta cidade</h3></div></div>
          <p class="director-detail-intro">Os Cidadãos preenchem automaticamente as vagas restantes.</p>
          <div class="director-composition">{#each roleOrder as role}<div data-role={role}><span>{roles[role].label}</span><strong>{roleCount(role)}</strong></div>{/each}</div>
        {:else}
          {#if view.day && (view.status === "day" || view.day.phase === "completed")}
            <div class="director-list-title"><div><small>{view.day.phase === "voting" ? "VOTOS EM TEMPO REAL" : view.day.phase === "completed" ? "ÚLTIMA VOTAÇÃO" : "PRÓXIMA DECISÃO"}</small><h3>{view.day.phase === "discussion" ? "A cidade conversa" : "Votação da cidade"}</h3></div></div>
            {#if view.day.phase === "completed"}<p class="director-vote-result">{view.day.eliminated ? view.day.tiebreaker ? `O empate foi sorteado: ${playerName(view.day.eliminated)} foi eliminado.` : `${playerName(view.day.eliminated)} foi eliminado pela cidade.` : "Todos se abstiveram. Ninguém foi eliminado."}</p>{/if}
            {#if view.day.phase === "voting" || view.day.phase === "completed"}
              {#if view.day.votes.length}<div class="director-tally">{#each view.day.tally as result}<div><span>{playerName(result.id)}</span><strong>{result.count} voto{result.count === 1 ? "" : "s"}</strong></div>{/each}<div><span>Abstenções</span><strong>{view.day.abstentions}</strong></div></div>{:else}<p class="director-empty">Nenhum voto recebido ainda.</p>{/if}
              <h4 class="director-subheading">Votos individuais</h4>
              {#each view.day.votes as vote}<p class="director-decision-row"><strong>{playerName(vote.playerId)}</strong><span>{vote.targetId ? `Votou em ${playerName(vote.targetId)}` : "Preferiu não votar"}</span></p>{/each}
            {:else}<p class="director-detail-intro">Depois da conversa, o jogo abre 30 segundos de votação automaticamente.</p>{/if}
          {/if}
          <div class="director-list-title director-night-heading"><div><small>{view.status === "night" ? "NOITE EM ANDAMENTO" : "NOITE ANTERIOR"}</small><h3>Escolhas noturnas</h3></div></div>
          {#each view.assassinVotes as vote}<p class="director-decision-row" data-role="assassin"><strong>{playerName(vote.playerId)} <em>· Assassino</em></strong><span>{vote.targetId ? `Votou em ${playerName(vote.targetId)}` : "Aguardando alvo"}</span></p>{/each}
          {#if view.assassinConflict && view.status === "night"}<p class="director-alert">Os Assassinos escolheram alvos diferentes. O sorteio automático decidirá entre eles ao amanhecer: 80% de chance de um ataque e 20% de dois.</p>{/if}
          {#if view.assassinVotes.length}<p class="director-target-summary">Alvos dos Assassinos: <strong>{view.assassinTargets.length ? view.assassinTargets.map(playerName).join(" e ") : view.assassinConflict ? "aguardando sorteio" : playerName(view.assassinTarget)}</strong></p>{/if}
          {#each view.nightActions as action (action.playerId)}<p class="director-decision-row" data-role={action.role}><strong>{playerName(action.playerId)} <em>· {roles[action.role].label}</em></strong><span>{actionLabel(action)}{#if action.role === "sheriff"} · {action.bulletsAvailable} {action.bulletsAvailable === 1 ? "bala" : "balas"}{/if}</span></p>{/each}
          {#if view.outcome}<p class="director-outcome">{view.outcome}</p>{/if}
        {/if}
      </div>
      <details class="director-options"><summary>Opções da sala</summary><button type="button" disabled={!connected} onclick={closeRoom}>Fechar sala</button></details>
    </div>
  {/if}
</section>
