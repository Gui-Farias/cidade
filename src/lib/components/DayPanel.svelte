<script lang="ts">
  import type {
    DayView,
    AdminDayView,
    ClientMessage,
    Target,
  } from "$lib/game/types";
  import GameGlyph from "./GameGlyph.svelte";
  import { avatarForPlayer } from "$lib/ui/avatars";
  let {
    day,
    admin = null,
    players = [],
    alive = false,
    connected,
    send,
    sending = false,
    onVote,
  }: {
    day: DayView;
    admin?: AdminDayView | null;
    players?: Target[];
    alive?: boolean;
    connected: boolean;
    send: (message: ClientMessage) => void;
    sending?: boolean;
    onVote?: (targetId: string | null, targetName: string | null) => void;
  } = $props();
  let selected = $state("");
  const phase = $derived(day.phase);
  $effect(() => {
    const current = phase;
    selected = "";
  });
  const name = (id: string | null) =>
    id === null
      ? "Prefiro não votar"
      : players.find((p) => p.id === id)?.name || id;
</script>

<section class="panel day-panel">
  {#if !admin && day.phase === "voting"}<span class="action-medallion"><GameGlyph name="vote" size={29} /></span>{/if}
  <p class="eyebrow">☼ A CIDADE ACORDOU</p>
  {#if day.phase === "discussion"}
    <h2>Hora de conversar.</h2>
    <p>Troquem suspeitas e defendam suas ideias pela chamada.</p>
    <div
      class="day-clock"
      role="timer"
      aria-label={`${day.remaining} segundos de discussão`}
    >
      {Math.floor(day.remaining / 60)
        .toString()
        .padStart(2, "0")}:{(day.remaining % 60).toString().padStart(2, "0")}
    </div>
    <progress
      class="day-progress"
      max={day.duration}
      value={day.remaining}
      aria-label="Tempo restante de discussão"
    ></progress>
    <p class="hint">
      A votação começa ao fim de 1 minuto e 30 segundos ou quando o Narrador encerrar a conversa.
    </p>
  {:else if day.phase === "voting"}
    <h2>Quem a cidade vai eliminar?</h2>
    <p>Escolha em segredo. Só o Narrador vê os votos.</p>
    {#if admin}
      <div
        class="day-clock"
        role="timer"
        aria-label={`${day.remaining} segundos de votação`}
      >
        {Math.floor(day.remaining / 60)
          .toString()
          .padStart(2, "0")}:{(day.remaining % 60).toString().padStart(2, "0")}
      </div>
      <progress
        class="day-progress"
        max={day.duration}
        value={day.remaining}
        aria-label="Tempo restante de votação"
      ></progress>
    {/if}
    <p class="hint">
      Sem voto confirmado, o jogo registra “Prefiro não votar”. Empates são resolvidos por sorteio.
    </p>
    {#if alive && !admin && !day.submitted}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          if (sending || !selected) return;
          const targetId = selected === "abstain" ? null : selected;
          if (onVote) onVote(targetId, day.targets.find((target) => target.id === targetId)?.name ?? null);
          else send({ type: "day-vote", targetId });
        }}
      >
        <fieldset disabled={!connected || sending}>
          <legend class="sr-only">Escolha quem eliminar</legend>
          <div class="targets">
            {#each day.targets as target}<label
                class:selected={selected === target.id}
                ><input
                  type="radio"
                  name="city-target"
                  value={target.id}
                  bind:group={selected}
              /><img class="target-avatar" src={avatarForPlayer(target.id)} alt="" />{target.name}</label
              >{/each}
            <label class:selected={selected === "abstain"}
              ><input
                type="radio"
                name="city-target"
                value="abstain"
                bind:group={selected}
              />Prefiro não votar</label
            >
          </div>
          <div class="action-footer"><button class="primary full" disabled={!selected || sending}
              ><GameGlyph name={sending ? "hourglass" : "vote"} size={17} />{sending ? "Registrando voto..." : "Confirmar voto secreto"}</button
            ></div>
        </fieldset>
      </form>
    {:else if !admin}<div class="notice">
        {day.submitted
          ? "Voto confirmado. Aguarde os demais."
          : "Você acompanha a votação, mas não pode votar."}
      </div>{/if}
  {:else}<h2>Resultado da cidade</h2>{/if}
  {#if admin}
    {#if admin.pending.length}<div class="notice" aria-live="polite">
        Aguardando: {admin.pending.map((p) => p.name).join(", ")}.
      </div>{/if}
    {#if admin.votes.length}<div class="city-results">
        <p class="eyebrow">RESULTADO · SÓ PARA O NARRADOR</p>
        {#each admin.tally as result}<p>
            <strong>{name(result.id)}</strong> — {result.count} voto(s)
          </p>{/each}
        <p>Abstenções — {admin.abstentions}</p>
        <details>
          <summary>Ver votos individuais</summary>{#each admin.votes as vote}<p>
              {name(vote.playerId)} → {name(vote.targetId)}
            </p>{/each}
        </details>
      </div>{/if}
    {#if day.phase === "completed" && !admin.eliminated}<div class="notice">
        Todos se abstiveram. Ninguém foi eliminado; a próxima noite começou.
      </div>{/if}
    {#if admin.eliminated}<div class="notice">
        {admin.tiebreaker
          ? `A votação empatou; o sorteio eliminou ${name(admin.eliminated)}.`
          : `${name(admin.eliminated)} foi eliminado pela cidade.`} A próxima noite começou.
      </div>{/if}
  {/if}
</section>
