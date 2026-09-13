<script lang="ts">
  import type { Role, Target } from "$lib/game/types";
  import { roles } from "$lib/game/roles";
  let {
    role,
    partners = [],
    alive = true,
  }: { role: Role; partners?: Target[]; alive?: boolean } = $props();
</script>

<section class="role-card revealed" data-role={role} class:role-dead={!alive}>
  <p class="eyebrow">SEU PAPEL</p>
  <h2 class={role}>
    {roles[role].label}{#if !alive}<span
        class="role-death-mark"
        aria-label="Morto">×</span
      >{/if}
  </h2>
  <p>{roles[role].description}</p>
  {#if role === "assassin" && partners.length}
    <p>
      {partners.length === 1 ? "Seu parceiro" : "Seus parceiros"}:
      <strong>{partners.map((p) => p.name).join(", ")}</strong><br />Cada
      assassino vota individualmente. Seu voto é secreto.
    </p>
  {/if}
</section>
