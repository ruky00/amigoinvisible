<script setup lang="ts">
// Cinta de raso plateado que cruza la esquina de una caja, con su lazo.
// Se coloca como primer hijo de un elemento con position: relative (p. ej. .card).
defineProps<{ corner?: 'right' | 'left' }>()
</script>

<template>
  <div class="ribbon" :class="corner === 'left' ? 'left' : 'right'" aria-hidden="true">
    <div class="clip"><span class="band"></span></div>
    <svg class="bow" viewBox="0 0 60 46">
      <defs>
        <linearGradient id="bow-satin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset=".35" stop-color="#dfe4ec" />
          <stop offset=".6" stop-color="#9ea9bd" />
          <stop offset="1" stop-color="#e6eaf1" />
        </linearGradient>
      </defs>
      <!-- colas -->
      <path d="M28 22 17 44l5.5-2.8L25 45.5l6-22.5Z" fill="url(#bow-satin)" />
      <path d="M32 22l11 22-5.5-2.8L35 45.5l-6-22.5Z" fill="url(#bow-satin)" />
      <!-- lazadas -->
      <path d="M30 20C18 3 1 5 5.5 17.5 8.6 26 22 25 30 20Z" fill="url(#bow-satin)" />
      <path d="M30 20C42 3 59 5 54.5 17.5 51.4 26 38 25 30 20Z" fill="url(#bow-satin)" />
      <!-- pespunte de las lazadas -->
      <path
        d="M27 19C18 8 7 9 9.5 17 11.5 22.5 20 22 27 19.5M33 19c9-11 20-10 17.5-2-2 5.5-10.5 5-17.5 2.5"
        fill="none"
        stroke="#7d889e"
        stroke-width=".9"
        stroke-dasharray="2 1.7"
      />
      <ellipse cx="30" cy="20.5" rx="5" ry="4.6" fill="url(#bow-satin)" stroke="#8e99ae" stroke-width=".6" />
    </svg>
  </div>
</template>

<style scoped>
.ribbon {
  position: absolute;
  top: 0;
  width: 118px;
  height: 118px;
  pointer-events: none;
  z-index: 2;
}

.right {
  right: 0;
}

.left {
  left: 0;
  transform: scaleX(-1);
}

.clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-top-right-radius: var(--radius);
}

.band {
  position: absolute;
  top: 30px;
  right: -44px;
  width: 175px;
  height: 17px;
  background: var(--satin);
  transform: rotate(45deg);
  box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.6);
}

/* costura a los dos lados de la cinta */
.band::before {
  content: '';
  position: absolute;
  inset: 3px 0;
  border-top: 1px dashed rgba(90, 102, 128, 0.7);
  border-bottom: 1px dashed rgba(90, 102, 128, 0.7);
}

.bow {
  position: absolute;
  top: 13px;
  right: 15px;
  width: 58px;
  transform: rotate(42deg);
  filter: drop-shadow(0 5px 6px rgba(0, 0, 0, 0.45));
}
</style>
