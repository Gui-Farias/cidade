<script lang="ts">
  let { night }: { night: boolean } = $props();
</script>

<div class="sky-scene" class:is-night={night} aria-hidden="true">
  <svg viewBox="0 0 360 150" fill="none">
    <g class="sky-stars" fill="currentColor">
      <path d="m65 29 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
      <path d="m259 18 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
      <circle cx="113" cy="52" r="1.5" /><circle cx="292" cy="65" r="2" />
      <circle cx="216" cy="22" r="1" /><circle cx="40" cy="74" r="1" />
    </g>
    <g class="sky-sun">
      <circle class="sun-halo" cx="180" cy="63" r="47" />
      <g
        class="sun-rays"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path
          d="M180 22v-6m0 94v-6m-41-41h-6m94 0h-6m-70-29-5-5m68 68-5-5m-58 0-5 5m68-68-5 5"
        />
      </g>
      <circle cx="180" cy="63" r="28" fill="currentColor" />
      <circle cx="171" cy="54" r="18" fill="#fff3cb" opacity=".22" />
    </g>
    <g class="sky-moon">
      <circle class="moon-halo" cx="180" cy="63" r="47" />
      <path
        d="M194 31a33 33 0 1 0 19 48 29 29 0 0 1-19-48Z"
        fill="currentColor"
      />
      <circle cx="163" cy="76" r="4" fill="#a0aec8" opacity=".3" />
      <circle cx="171" cy="88" r="2.5" fill="#a0aec8" opacity=".3" />
    </g>
    <g
      class="sky-clouds"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    >
      <path d="M32 85h46m-34-8h21m192-25h56m-40-8h19" />
    </g>
    <path
      class="sky-hill"
      d="M0 144c60-28 85-18 132-9 67 13 109-30 162-17 25 6 43 14 66 26"
    />
    <g
      class="sky-town"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linejoin="round"
    >
      <path
        d="M105 132v-25l14-12 14 12v28m-34-28 20-17 20 17m13 31V91l17-14 17 14v44m-40-44 23-20 23 20m9 38v-24l17-15 17 15v19m-40-19 23-20 23 20"
      />
      <path
        class="sky-windows"
        d="M115 113h8v10h-8zm48-17h10v12h-10zm0 23h10v17h-10zm50-10h9v10h-9z"
      />
    </g>
  </svg>
</div>
