<script lang="ts">
  import type { AdminView, ClientMessage } from "$lib/game/types";
  import DayPanel from "./DayPanel.svelte";
  import { roles, minimumPlayers, specialRoleCount } from "$lib/game/roles";
  let {
    view,
    send,
    connected,
  }: { view: AdminView; send: (m: ClientMessage) => void; connected: boolean } =
    $props();
  const minimum = $derived(minimumPlayers(view.roleCounts));
  const citizens = $derived(
    Math.max(0, view.players.length - specialRoleCount(view.roleCounts)),
  );
  const name = (id: string | null) =>
    view.players.find((p) => p.id === id)?.name;
</script>

<div class="page-heading">
  <div>
    <p class="eyebrow">VOCÊ CONDUZ A HISTÓRIA</p>
    <h1>Narrador<span class="accent">.</span></h1>
    <p>As vozes estão na chamada. Os segredos ficam aqui.</p>
  </div>
  <div class="heading-actions">
    <button
      class="close-room"
      disabled={!connected}
      onclick={() => {
        if (
          confirm(
            "Fechar esta sala? Todos voltarão para a página inicial e o convite deixará de funcionar.",
          )
        )
          send({ type: "close-room" });
      }}>Fechar sala</button
    >
    <span class="phase"
      >{view.status === "waiting"
        ? "○ Preparação"
        : view.status === "night"
          ? `☾ Noite ${view.night}`
          : "☼ Cidade acordada"}</span
    >
  </div>
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
            {#if view.status === "waiting"}<button
                class="remove-player"
                disabled={!connected}
                onclick={() => {
                  if (
                    confirm(
                      `Expulsar ${player.name}? A pessoa terá de entrar novamente.`,
                    )
                  )
                    send({ type: "expel-player", playerId: player.id });
                }}
                aria-label={`Expulsar ${player.name}`}>Expulsar</button
              >{/if}
          </li>{/each}
      </ul>
    {/if}
    <div class="panel-foot">
      {view.status === "waiting"
        ? "Só você vê todos os papéis. Os assassinos também conhecem seus parceiros."
        : "Só você pode ver todos os papéis. Não compartilhe esta tela."}
    </div>
  </section>
  <aside>
    {#if view.status === "waiting"}
      <section class="panel">
        <p class="eyebrow">ANTES DE COMEÇAR</p>
        <h2>Toda cidade tem<br />seus segredos.</h2>
        <p>
          Estes são os papéis escolhidos na criação da sala. Os cidadãos
          completam as vagas conforme o grupo entra.
        </p>
        <div class="composition">
          {#each Object.keys(roles) as (keyof typeof roles)[] as role}
            <span
              ><b class={role}
                >{(role === "citizen" ? citizens : view.roleCounts[role])
                  .toString()
                  .padStart(2, "0")}</b
              >{roles[role].label}</span
            >
          {/each}
        </div>
        <p class="small">
          Mínimo: {minimum} jogadores + Narrador. Cidadãos: preenchimento automático.
        </p>
        {#if view.players.length >= minimum && view.roleCounts.assassin * 2 >= view.players.length}<div
            class="notice"
          >
            Com este grupo, os Assassinos já são metade ou mais dos jogadores e
            vencerão ao iniciar. Convide mais pessoas para disputar.
          </div>{/if}
        <button
          class="primary full"
          disabled={!connected || view.players.length < minimum}
          onclick={() => send({ type: "draw" })}
          >Sortear papéis <span aria-hidden="true">↗</span></button
        >
        <p class="hint">
          {view.players.length < minimum
            ? `Faltam ${minimum - view.players.length} jogadores para começar.`
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
            Só é possível continuar após todas as confirmações. O Xerife pode
            guardar suas balas.
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
        {#if view.assassinConflict && view.status === "night"}<div
            class="notice"
          >
            Votos diferentes: o sorteio decidirá automaticamente entre os alvos
            quando a cidade acordar (80% de chance de um ataque e 20% de dois,
            com chances iguais entre os alvos).
          </div>{/if}
        <p>
          Assassinos: <strong
            >{view.assassinTargets.length
              ? view.assassinTargets.map(name).join(" e ")
              : view.assassinConflict
                ? "aguardando sorteio"
                : name(view.assassinTarget) || "nenhuma escolha"}</strong
          >
        </p>
        {#each view.nightActions as action (action.playerId)}
          <p>
            {name(action.playerId)} · {roles[action.role].label}:
            <strong
              >{action.targetId
                ? `${action.role === "doctor" || action.role === "bodyguard" ? "protegeu" : action.role === "sheriff" ? "atirou em" : action.role === "seer" ? "observou" : "investigou"} ${name(action.targetId)}`
                : action.passed
                  ? "guardou as balas"
                  : !view.players.find((p) => p.id === action.playerId)?.alive
                    ? "morto"
                    : action.role === "sheriff" && action.bulletsAvailable === 0
                      ? "munição esgotada"
                      : "aguardando escolha"}</strong
            >
            {#if action.role === "sheriff"}
              · {action.bulletsAvailable} bala(s){/if}
          </p>
        {/each}
        {#if view.outcome}<div class="notice">{view.outcome}</div>{/if}
      </section>
    {/if}
    <p class="aside-note">
      ◇ &nbsp; Uma cidade. Uma chamada. Ninguém sabe em quem confiar.
    </p>
  </aside>
</div>
