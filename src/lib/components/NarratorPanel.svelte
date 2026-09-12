<script lang="ts">
  import type { AdminView, ClientMessage } from "$lib/game/types";
  import DayPanel from "./DayPanel.svelte";
  import { roles, MIN_PLAYERS } from "$lib/game/roles";
  let {
    view,
    send,
    connected,
  }: { view: AdminView; send: (m: ClientMessage) => void; connected: boolean } =
    $props();
  const name = (id: string | null) =>
    view.players.find((p) => p.id === id)?.name;
</script>

<div class="page-heading">
  <div>
    <p class="eyebrow">VOCÊ CONDUZ A HISTÓRIA</p>
    <h1>Narrador<span class="accent">.</span></h1>
    <p>As vozes estão na chamada. Os segredos ficam aqui.</p>
  </div>
  <span class="phase"
    >{view.status === "waiting"
      ? "○ Preparação"
      : view.status === "night"
        ? `☾ Noite ${view.night}`
        : "☼ Cidade acordada"}</span
  >
</div>
<div class="dashboard">
  <section class="panel roster">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">A CIDADE</p>
        <h2>
          {view.status === "waiting"
            ? "Quem está por aqui"
            : "Jogadores e papéis"}
        </h2>
      </div>
      <span class="count"
        >{view.players.length.toString().padStart(2, "0")}</span
      >
    </div>
    <p class="small">
      Jogadores conectados: {view.players.filter((p) => p.connected).length}
    </p>
    {#if view.players.length === 0}<div class="empty">
        <span aria-hidden="true">⌂</span>
        <h3>A cidade ainda está vazia.</h3>
        <p>
          Peça ao grupo para abrir este mesmo endereço<br />e informar o nome
          para entrar.
        </p>
      </div>{:else}
      <ul class="players">
        {#each view.players as player, index (player.id)}<li
            class:dead={!player.alive}
          >
            <span class="player-number"
              >{String(index + 1).padStart(2, "0")}</span
            ><span class="player-name"
              >{player.name}<small
                >{!player.alive ? "Morto" : ""}{!player.connected
                  ? " · offline"
                  : ""}</small
              ></span
            >{#if player.role}<span class="badge {player.role}"
                >{roles[player.role].label}</span
              >{:else}<span
                class="waiting-dot"
                aria-label={player.connected ? "Conectado" : "Offline"}
                class:offline={!player.connected}
              ></span>{/if}
          </li>{/each}
      </ul>
    {/if}
    <div class="panel-foot">
      {view.status === "waiting"
        ? "Só você vê todos os papéis. Os assassinos também conhecem seu parceiro."
        : "Só você pode ver todos os papéis. Não compartilhe esta tela."}
    </div>
  </section>
  <aside>
    <button class="reset-room" disabled={!connected} onclick={() => { if (confirm("Resetar a sala? A partida e todos os jogadores serão removidos.")) send({ type: "reset" }); }}>↺ Resetar sala</button>
    {#if view.status === "waiting"}
      <section class="panel">
        <p class="eyebrow">ANTES DE COMEÇAR</p>
        <h2>Toda cidade tem<br />seus segredos.</h2>
        <p>
          Reúna o grupo na chamada. Quando todos estiverem aqui, distribua os
          papéis.
        </p>
        <div class="composition">
          <span><b class="assassin">02</b> Assassinos</span><span
            ><b class="doctor">01</b> Médico</span
          ><span><b class="detective">01</b> Detetive</span><span
            ><b>＋</b> Demais cidadãos</span
          >
        </div>
        <button
          class="primary full"
          disabled={!connected || view.players.length < MIN_PLAYERS}
          onclick={() => send({ type: "draw" })}
          >Sortear papéis <span aria-hidden="true">↗</span></button
        >
        <p class="hint">
          {view.players.length < MIN_PLAYERS
            ? `Faltam ${MIN_PLAYERS - view.players.length} jogadores para começar.`
            : "Tudo pronto. Confirme se todos entraram."}
        </p>
      </section>
    {:else}
      <section class="panel">
        <p class="eyebrow">CONDUZA A PARTIDA</p>
        <h2>
          {view.status === "day"
            ? "A cidade está acordada."
            : "A cidade dorme."}
        </h2>
        {#if view.status === "day" && view.day}
          <DayPanel
            day={view.day}
            admin={view.day}
            players={view.players}
            {connected}
            {send}
          />
        {:else}
          <p>As ações de todos os papéis estão abertas ao mesmo tempo.</p>
          <div class="notice" aria-live="polite">
            {#if view.pendingPlayers.length}
              Aguardando {view.pendingPlayers.length} confirmação(ões):
              <strong
                >{view.pendingPlayers.map((p) => p.name).join(", ")}</strong
              >.
            {:else}
              Todos confirmaram suas ações.
            {/if}
          </div>
          <button
            class="primary full"
            disabled={!connected || !view.canWake}
            onclick={() => send({ type: "wake" })}
            >☼ &nbsp; Cidade acorda</button
          >
          <p class="hint">
            Só é possível continuar após todas as confirmações e resolver votos
            divergentes.
          </p>
        {/if}
      </section>
      {#if view.status === "night" && view.day}
        <DayPanel
          day={view.day}
          admin={view.day}
          players={view.players}
          {connected}
          {send}
        />
      {/if}
      <section class="panel log" aria-live="polite">
        <p class="eyebrow">SÓ PARA O NARRADOR</p>
        <h2>Acontecimentos da noite</h2>
        {#each view.assassinVotes as vote}
          <p>
            {name(vote.playerId)}:
            <strong
              >{vote.targetId
                ? `votou em ${name(vote.targetId)}`
                : "ainda não votou"}</strong
            >
          </p>
        {/each}
        {#if view.assassinConflict}
          <div class="notice">
            Os votos foram diferentes. Escolha o alvo do ataque:
            <div class="turns">
              {#each [...new Set(view.assassinVotes
                    .map((v) => v.targetId)
                    .filter(Boolean))] as targetId}
                <button
                  disabled={!connected}
                  onclick={() =>
                    send({ type: "resolve-assassins", targetId: targetId! })}
                  >{name(targetId)}</button
                >
              {/each}
            </div>
          </div>
        {/if}
        <p>
          Assassinos: <strong
            >{name(view.assassinTarget) || "nenhuma escolha"}</strong
          >
        </p>
        <p>
          Médico: <strong
            >{view.doctorTarget
              ? `protegeu ${name(view.doctorTarget)}`
              : "nenhuma proteção"}</strong
          >
        </p>
        <p>
          Detetive: <strong
            >{view.detectiveTarget
              ? `investigou ${name(view.detectiveTarget)}`
              : "nenhuma investigação"}</strong
          >
        </p>
        {#if view.outcome}<div class="notice">{view.outcome}</div>{/if}
      </section>
    {/if}
    <p class="aside-note">
      ◇ &nbsp; Uma cidade. Uma chamada. Ninguém sabe em quem confiar.
    </p>
  </aside>
</div>
