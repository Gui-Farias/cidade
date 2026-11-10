<script lang="ts">
  import { goto } from "$app/navigation";
  import { normalizeRoomCode } from "$lib/game/rooms";
  import RoleSetup from "./RoleSetup.svelte";
  import type { ClientMessage } from "$lib/game/types";
  import { draggable } from "$lib/ui/draggable";
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
  let activeTab = $state<"create" | "join">("create");
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
  <div class="room-lobby" use:draggable={{ handle: ".action-drag-handle" }}>
    <div class="action-drag-handle" aria-hidden="true"><span class="drag-grip">⠿</span> Arraste para mover</div>
    <p class="eyebrow">REÚNA SUA TURMA</p>
    <h1>Uma cidade.<br />Muitos segredos<span class="accent">.</span></h1>
    <p>Comece uma partida ou entre na cidade dos seus amigos.</p>
    <div class="lobby-tabs" role="group" aria-label="Acesso à cidade">
      <button type="button" aria-pressed={activeTab === "create"} class:active={activeTab === "create"} onclick={() => (activeTab = "create")}>Criar sala</button>
      <button type="button" aria-pressed={activeTab === "join"} class:active={activeTab === "join"} onclick={() => (activeTab = "join")}>Entrar com código</button>
    </div>
    <div class="room-options">
      {#if activeTab === "create"}
        <section class="panel" aria-label="Criar sala">
          <span class="moon" aria-hidden="true">☾</span>
          <h2>Reúna a vila.</h2>
          <p>Você será o Narrador. Escolha os papéis e compartilhe o convite com a turma.</p>
          <button class="primary full" disabled={!connected || creating} onclick={() => (configuring = true)}>
            Preparar partida <span aria-hidden="true">↗</span>
          </button>
        </section>
      {:else}
        <section class="panel" aria-label="Entrar com código">
          <h2>Já tem um convite?</h2>
          <p>Informe o código que o Narrador compartilhou.</p>
          <form onsubmit={enterRoom}>
            <label for="room-code">Código da sala</label>
            <input id="room-code" class="code-input" bind:value={code} placeholder="ABCD-2345" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" required aria-invalid={!!error} aria-describedby={error ? "code-error" : undefined} />
            {#if error}<p id="code-error" role="alert">{error}</p>{/if}
            <button class="primary full" disabled={!code.trim() || creating}>Entrar na cidade <span aria-hidden="true">↗</span></button>
          </form>
        </section>
      {/if}
    </div>
    <p class="hint">
      A sala fica disponível enquanto alguém estiver conectado. Depois de 2
      horas vazia, ela é encerrada.
    </p>
  </div>
{/if}
