<script lang="ts">
  import type { GameResult, ClientMessage } from "$lib/game/types";
  import { roles } from "$lib/game/roles";
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
</script>

<div class="ending" data-winner={result.winner}>
  <section class="panel ending-hero" aria-live="polite">
    <p class="eyebrow">FIM DE PARTIDA · {result.rounds} NOITE(S)</p>
    <span class="ending-emblem" aria-hidden="true"
      >{result.winner === "fool"
        ? "♧"
        : result.winner === "city"
          ? "☼"
          : result.winner === "assassins"
            ? "☾"
            : "◇"}</span
    >
    <h1>
      {result.winner === "fool"
        ? "O Rei Louco riu por último."
        : result.winner === "city"
          ? "A cidade resistiu."
          : result.winner === "assassins"
            ? "A noite venceu."
            : "Uma cidade em silêncio."}
    </h1>
    <p>
      {result.winner === "fool"
        ? "Vitória individual do Rei Louco! Ele foi eliminado pelo povo e encerrou a partida."
        : result.winner === "city"
          ? "Vitória da cidade! Todos os assassinos foram descobertos."
          : result.winner === "assassins"
            ? "Vitória dos assassinos! Eles alcançaram o controle da cidade."
            : "Empate. Não restaram sobreviventes."}
    </p>
    {#if admin}
      <div class="ending-actions">
        <button
          class="primary"
          disabled={!connected}
          onclick={() => send({ type: "restart" })}
          >Jogar novamente · sortear papéis</button
        >
        <button
          disabled={!connected}
          onclick={() => {
            if (confirm("Limpar a sala e remover os jogadores?"))
              send({ type: "reset" });
          }}>Limpar sala</button
        >
      </div>
      <p class="hint">
        Jogar novamente mantém o grupo e sua identificação como Narrador.
      </p>
    {:else}<p class="hint">Aguarde o Narrador iniciar uma nova partida.</p>{/if}
  </section>
  <div class="ending-grid">
    <section class="panel">
      <p class="eyebrow">AGORA TODOS OS SEGREDOS</p>
      <h2>Quem era quem</h2>
      <ul class="players">
        {#each result.players as player}<li>
            <span class="player-name"
              >{player.name}<small
                >{player.alive ? "Sobreviveu" : "Morto"}</small
              ></span
            >{#if player.role}<span class="badge {player.role}"
                >{roles[player.role].label}</span
              >{/if}
          </li>{/each}
      </ul>
    </section>
    <section class="panel">
      <p class="eyebrow">A HISTÓRIA DESTA PARTIDA</p>
      <h2>Como tudo aconteceu</h2>
      <ol class="ending-timeline">
        {#each result.timeline as event}<li>
            <span class="eyebrow"
              >{event.phase === "night" ? "Noite" : "Dia"} {event.round}</span
            >
            <p>{event.text}</p>
          </li>{/each}
      </ol>
    </section>
  </div>
</div>
