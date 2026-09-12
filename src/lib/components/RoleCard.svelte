<script lang="ts">
  import type { Role, Target } from "$lib/game/types";
  import { roles } from "$lib/game/roles";
  let { role, partners = [], alive = true }: { role: Role; partners?: Target[]; alive?: boolean } = $props();
</script>

<section class="role-card revealed" data-role={role} class:role-dead={!alive}>
  <span class="role-symbol {role}" aria-hidden="true">{alive ? roles[role].symbol : "×"}</span
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
