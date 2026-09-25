<script lang="ts">
  import { goto } from "$app/navigation";
  import { normalizeRoomCode } from "$lib/game/rooms";
  import RoleSetup from "./RoleSetup.svelte";
  import type { ClientMessage } from "$lib/game/types";
  let {
    connected,
    creating,
    send,
  }: {
    connected: boolean;
    creating: boolean;
    send: (message: ClientMessage) => void;
  } = $props();
  let configuring = $state(false);
  let code = $state("");
  let error = $state("");
  function enterRoom(event: SubmitEvent) {
    event.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!normalized) {
      error = "Confira o código de 8 letras e números do convite.";
      return;
    }
    error = "";
    void goto(`/sala/${normalized}`);
  }
</script>

{#if configuring}
  <RoleSetup {connected} {creating} {send} back={() => (configuring = false)} />
{:else}
  <div class="room-lobby">
    <p class="eyebrow">REÚNA SUA TURMA</p>
    <h1>Cada sala,<br />uma nova história<span class="accent">.</span></h1>
    <p>Entre na chamada com seus amigos e encontrem sua cidade.</p>
    <div class="room-options">
      <section class="panel">
        <span class="moon" aria-hidden="true">☾</span>
        <h2>Comece uma cidade.</h2>
        <p>
          Crie uma sala, seja o Narrador e compartilhe o convite com a turma.
        </p>
        <button
          class="primary full"
          disabled={!connected || creating}
          onclick={() => (configuring = true)}
        >
          Criar sala <span aria-hidden="true">↗</span>
        </button>
      </section>
      <section class="panel">
        <h2>Já recebeu um convite?</h2>
        <p>Use o código da sala para encontrar seu grupo.</p>
        <form onsubmit={enterRoom}>
          <label for="room-code">Código da sala</label>
          <input
            id="room-code"
            class="code-input"
            bind:value={code}
            placeholder="ABCD-2345"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            maxlength="24"
            required
            aria-invalid={!!error}
            aria-describedby={error ? "code-error" : undefined}
          />
          {#if error}<p id="code-error" role="alert">{error}</p>{/if}
          <button class="full" disabled={!code.trim() || creating}
            >Entrar com código</button
          >
        </form>
      </section>
    </div>
    <p class="hint">
      A sala fica disponível enquanto alguém estiver conectado. Depois de 2
      horas vazia, ela é encerrada.
    </p>
  </div>
{/if}
