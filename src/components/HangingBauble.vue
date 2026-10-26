<script setup lang="ts">
// Bola de Navidad plateada colgando de un hilo, con un balanceo suave.
withDefaults(defineProps<{ size?: number; drop?: number; sway?: boolean; delay?: number }>(), {
  size: 34,
  drop: 0,
  sway: true,
  delay: 0,
})
</script>

<template>
  <span
    class="bauble"
    :class="{ sway }"
    :style="{ animationDelay: `${delay}s` }"
    aria-hidden="true"
  >
    <span v-if="drop" class="thread" :style="{ height: `${drop}px` }"></span>
    <svg :width="size" :height="size * 1.2" viewBox="0 0 40 48">
      <defs>
        <radialGradient id="bauble-shine" cx=".35" cy=".35" r=".8">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset=".3" stop-color="#dfe4ec" />
          <stop offset=".75" stop-color="#8a96ad" />
          <stop offset="1" stop-color="#5d6a86" />
        </radialGradient>
        <linearGradient id="bauble-cap" x1="0" x2="1">
          <stop offset="0" stop-color="#9aa5ba" />
          <stop offset=".5" stop-color="#ffffff" />
          <stop offset="1" stop-color="#8f9ab0" />
        </linearGradient>
      </defs>
      <path d="M20 0v5" stroke="#c4ccda" stroke-width="1" />
      <circle cx="20" cy="4.5" r="2.2" fill="none" stroke="#c4ccda" stroke-width="1" />
      <rect x="15" y="6" width="10" height="5" rx="1.2" fill="url(#bauble-cap)" />
      <circle cx="20" cy="28" r="18" fill="url(#bauble-shine)" />
      <!-- costura decorativa -->
      <path
        d="M3.5 25.5c10 4 23 4 33 0"
        fill="none"
        stroke="#4b5878"
        stroke-width="1"
        stroke-dasharray="2.4 2"
        opacity=".7"
      />
      <path
        d="M4 31c10 4 22 4 32 0"
        fill="none"
        stroke="#4b5878"
        stroke-width="1"
        stroke-dasharray="2.4 2"
        opacity=".7"
      />
      <ellipse cx="13" cy="20" rx="4" ry="2.4" fill="#fff" opacity=".55" transform="rotate(-35 13 20)" />
    </svg>
  </span>
</template>

<style scoped>
.bauble {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  transform-origin: top center;
}

.thread {
  width: 1px;
  background: rgba(214, 220, 231, 0.75);
}

.sway {
  animation: sway 5s ease-in-out infinite;
}

svg {
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45));
}

@keyframes sway {
  0%,
  100% {
    transform: rotate(-4deg);
  }
  50% {
    transform: rotate(4deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sway {
    animation: none;
  }
}
</style>
