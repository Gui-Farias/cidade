<script lang="ts">
  import type { Role, Target } from "$lib/game/types";
  import { roles } from "$lib/game/roles";
  let { role, partners = [] }: { role: Role; partners?: Target[] } = $props();
</script>

<section class="role-card revealed" data-role={role}>
  <span class="role-symbol {role}" aria-hidden="true">{roles[role].symbol}</span
  >
  <p class="eyebrow">SEU PAPEL</p>
  <h2 class={role}>{roles[role].label}</h2>
  <p>{roles[role].description}</p>
  {#if role === "assassin"}
    <p>
      Seu parceiro: <strong>{partners.map((p) => p.name).join(", ")}</strong><br
      />Cada assassino vota individualmente. Seu voto é secreto.
    </p>
  {/if}
</section>
