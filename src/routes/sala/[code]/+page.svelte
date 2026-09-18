<script lang="ts">
  import GameApp from "$lib/components/GameApp.svelte";
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

{#key data.roomCode}
  <GameApp roomCode={data.roomCode} />
{/key}
