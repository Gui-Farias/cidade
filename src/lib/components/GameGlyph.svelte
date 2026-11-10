<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  {#if name === "moon"}
    <path d="M20.2 15.8A8.7 8.7 0 0 1 8.2 3.8 8.9 8.9 0 1 0 20.2 15.8Z"/><path d="M17 3v3m-1.5-1.5h3M21 7v2m-1-1h2"/>
  {:else if name === "sun"}
    <circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>
  {:else if name === "vote"}
    <path d="m5 8 5 5M14 4l6 6M9 13l5-5M3 21l8-8m6-7 2-2m-7 9 2 2M2 21h11"/>
  {:else if name === "hourglass"}
    <path d="M6 2h12M6 22h12M7 2v4c0 3 5 5 5 6s-5 3-5 6v4m10-20v4c0 3-5 5-5 6s5 3 5 6v4"/><path d="M9 7h6m-6 10h6"/>
  {:else if name === "mask"}
    <path d="M3 5c3-2 6-1 9 0 3-1 6-2 9 0v7c0 5-4 9-9 10-5-1-9-5-9-10V5Z"/><path d="M6.5 10.5c1.3-1 2.7-1 4 0m3 0c1.3-1 2.7-1 4 0M9 16c2 1.6 4 1.6 6 0"/>
  {:else if name === "users"}
    <circle cx="9" cy="8" r="3"/><path d="M3 20v-2c0-2.8 2.5-4.5 6-4.5s6 1.7 6 4.5v2H3Z"/><path d="M17 5a3 3 0 0 1 0 6m1 3c2 .4 3 1.8 3 4v2h-4"/>
  {:else if name === "scroll"}
    <path d="M7 3h12v17H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h1Z"/><path d="M7 3v14a2 2 0 0 1-4 0m8-9h5m-5 4h5m-5 4h4"/>
  {:else if name === "sword"}
    <path d="m15 3 6 0-1 6-9 9-4-4 8-11Zm-9 9 6 6M4 20l4-4m-6 6 3-3"/>
  {:else if name === "shield"}
    <path d="M12 2 3.5 5v6.5c0 5 3.2 8.5 8.5 10.5 5.3-2 8.5-5.5 8.5-10.5V5L12 2Z"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/>
  {:else if name === "check"}
    <path d="m4 12 5 5L20 6"/>
  {:else if name === "copy"}
    <rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
  {:else if name === "spark"}
    <path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z"/>
  {:else if name === "crown"}
    <path d="m2 7 5 4 5-7 5 7 5-4-2 12H4L2 7Zm2 14h16"/>
  {:else if name === "person"}
    <circle cx="12" cy="8" r="3"/><path d="M4.5 21v-2c0-3.4 3-5.4 7.5-5.4s7.5 2 7.5 5.4v2h-15Z"/>
  {:else if name === "eye"}
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>
  {:else if name === "heart"}
    <path d="M20.8 7.7c0 4.5-8.8 11-8.8 11s-8.8-6.5-8.8-11a4.5 4.5 0 0 1 8.8-1.2 4.5 4.5 0 0 1 8.8 1.2Z"/>
  {:else if name === "skull"}
    <path d="M12 2a8 8 0 0 0-8 8c0 3 1.6 5 4 6v4h8v-4c2.4-1 4-3 4-6a8 8 0 0 0-8-8Z"/><path d="M9 11h.01M15 11h.01M10 16h4m-2 0v4"/>
  {:else if name === "menu"}
    <path d="M4 6h16M4 12h16M4 18h16"/>
  {:else}
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5m0 4h.01"/>
  {/if}
</svg>
