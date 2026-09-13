<script lang="ts">
  import type {
    DayView,
    AdminDayView,
    ClientMessage,
    Target,
  } from "$lib/game/types";
  let {
    day,
    admin = null,
    players = [],
    alive = false,
    connected,
    send,
  }: {
    day: DayView;
    admin?: AdminDayView | null;
    players?: Target[];
    alive?: boolean;
    connected: boolean;
    send: (message: ClientMessage) => void;
  } = $props();
  let selected = $state("");
  const phase = $derived(day.phase);
  $effect(() => {
    const current = phase;
    selected = "";
  });
  const name = (id: string | null) =>
    id === null
      ? "Não votou nesta rodada"
      : players.find((p) => p.id === id)?.name || id;
</script>

<section class="panel day-panel">
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
      {day.extensionsRemaining > 0
        ? `São permitidas apenas 2 prorrogações de 30 segundos. Restam ${day.extensionsRemaining}. Ao terminar, a cidade decide se precisa de mais tempo.`
        : "As duas prorrogações foram usadas. Ao terminar este tempo, a votação começa automaticamente."}
    </p>
  {:else if day.phase === "decision"}
    <h2>Mais tempo ou votação?</h2>
    <p>A maioria decide. Em empate, começa a votação da cidade.</p>
    <p class="hint">
      Restam {day.extensionsRemaining} de 2 prorrogações de 30 segundos.
    </p>
    {#if alive && !admin && !day.submitted}
      <div class="turns">
        <button
          disabled={!connected || day.extensionsRemaining === 0}
          onclick={() => send({ type: "day-choice", choice: "extend" })}
          >Conversar mais 30 segundos</button
        ><button
          class="primary"
          disabled={!connected}
          onclick={() => send({ type: "day-choice", choice: "vote" })}
          >Ir para votação</button
        >
      </div>
    {:else if !admin}<div class="notice">
        {day.submitted
          ? "Escolha confirmada. Aguarde os demais."
          : "Acompanhe a decisão dos jogadores vivos."}
      </div>{/if}
  {:else if day.phase === "voting"}
    <h2>Quem a cidade vai eliminar?</h2>
    <p>
      Cada jogador vivo tem um voto. Somente o Narrador vê os votos e o
      resultado.
    </p>
    <p class="hint">
      Você também pode se abster. A abstenção não conta contra ninguém; se todos
      se abstiverem, a próxima noite começa sem eliminação.
    </p>
    {#if alive && !admin && !day.submitted}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          send({
            type: "day-vote",
            targetId: selected === "abstain" ? null : selected,
          });
        }}
      >
        <fieldset disabled={!connected}>
          <legend class="sr-only">Escolha quem eliminar</legend>
          <div class="targets">
            {#each day.targets as target}<label
                class:selected={selected === target.id}
                ><input
                  type="radio"
                  name="city-target"
                  value={target.id}
                  bind:group={selected}
                />{target.name}</label
              >{/each}
            <label class:selected={selected === "abstain"}
              ><input
                type="radio"
                name="city-target"
                value="abstain"
                bind:group={selected}
              />Não votar nesta rodada</label
            >
          </div>
          <button class="primary full" disabled={!selected}
            >Confirmar voto secreto</button
          >
        </fieldset>
      </form>
    {:else if !admin}<div class="notice">
        {day.submitted
          ? "Voto confirmado. Aguarde os demais."
          : "Você acompanha a votação, mas não pode votar."}
      </div>{/if}
  {:else if day.phase === "tie"}
    <h2>{admin ? "A votação empatou." : "Aguardando o Narrador."}</h2>
    {#if admin}<p>
        Escolha um dos mais votados. Ele será eliminado e a próxima noite
        começará.
      </p>
      <div class="turns">
        {#each admin.tied as id}<button
            disabled={!connected}
            onclick={() => send({ type: "resolve-city", targetId: id })}
            >Eliminar {name(id)}</button
          >{/each}
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
        {name(admin.eliminated)} foi eliminado pela cidade. A próxima noite começou.
      </div>{/if}
  {/if}
</section>
