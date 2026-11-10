<script lang="ts">
  import type { Role, Target } from "$lib/game/types";
  import { roles } from "$lib/game/roles";
  import GameGlyph from "./GameGlyph.svelte";
  let {
    role,
    partners = [],
    alive = true,
  }: { role: Role; partners?: Target[]; alive?: boolean } = $props();
  const glyph = $derived(
    role === "assassin" || role === "sheriff" ? "sword" :
    role === "doctor" || role === "bodyguard" ? "heart" :
    role === "detective" || role === "seer" ? "eye" : "mask",
  );
</script>

<section class="role-card revealed" data-role={role} class:role-dead={!alive}>
  <div class="role-heading"><span class="role-medallion"><GameGlyph name={glyph} size={28} /></span><div><p class="eyebrow">SEU PAPEL</p><h2 class={role}>{roles[role].label}{#if !alive}<span class="role-death-mark" aria-label="Morto">×</span>{/if}</h2></div></div>
  <div class="role-ability"><p class="eyebrow">HABILIDADE</p><p>{roles[role].description}</p></div>
  {#if role === "assassin" && partners.length}
    <p class="role-partners">
      {partners.length === 1 ? "Seu parceiro" : "Seus parceiros"}:
      <strong>{partners.map((p) => p.name).join(", ")}</strong><br />Cada
      assassino vota individualmente. Seu voto é secreto.
    </p>
  {/if}
</section>
