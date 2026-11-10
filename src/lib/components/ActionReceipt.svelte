<script lang="ts">
  import { onMount } from "svelte";
  import type { PlayerView } from "$lib/game/types";
  import type { ActionReceipt as Receipt } from "$lib/ui/action-feedback";
  import { describeReceipt } from "$lib/ui/action-feedback";
  import { avatarForPlayer } from "$lib/ui/avatars";
  import { draggable } from "$lib/ui/draggable";
  import GameGlyph from "./GameGlyph.svelte";

  let {
    receipt, view, leaving, onClose, onOpenSecrets,
  }: {
    receipt: Receipt;
    view: PlayerView;
    leaving: boolean;
    onClose: () => void;
    onOpenSecrets: () => void;
  } = $props();
  const presentation = $derived(describeReceipt(receipt, view));
  let dialog: HTMLElement;
  onMount(() => dialog.focus());
</script>

<div class="action-receipt" class:is-leaving={leaving} data-tone={presentation.tone} role="dialog" aria-modal="false" aria-label="Retorno da sua ação" tabindex="-1" bind:this={dialog} use:draggable={{ handle: ".action-drag-handle", exiting: leaving }}>
  <div class="action-drag-handle" aria-hidden="true"><span class="drag-grip">⠿</span> Arraste para mover</div>
  <button type="button" class="receipt-dismiss" aria-label="Fechar retorno da ação" onclick={onClose}>×</button>
  <span class="receipt-medallion"><GameGlyph name={presentation.glyph} size={29} /></span>
  <p class="receipt-kicker">{presentation.kicker}</p>
  <h2>{presentation.title}</h2>
  <p class="receipt-description">{presentation.description}</p>
  {#if receipt.targetId && receipt.targetName && !presentation.hasSecret}
    <div class="receipt-target"><img src={avatarForPlayer(receipt.targetId)} alt="" /><span>ESCOLHA REGISTRADA<strong>{receipt.targetName}</strong></span></div>
  {/if}
  <div class="receipt-confirmation"><GameGlyph name="check" size={17} /><span>Confirmado pelo jogo</span></div>
  <div class="receipt-actions">
    {#if presentation.hasSecret}<button type="button" class="primary" onclick={onOpenSecrets}><GameGlyph name="eye" size={17} /> Ver em Segredos</button>{/if}
    <button type="button" class:primary={!presentation.hasSecret} onclick={onClose}>Voltar à cidade</button>
  </div>
</div>
