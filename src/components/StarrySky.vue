<script setup lang="ts">
// Destellos plateados de fondo. Posiciones pseudoaleatorias pero fijas,
// para que no "salten" al recargar.

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

const rand = rng(1225)

const dots = Array.from({ length: 90 }, () => ({
  x: rand() * 100,
  y: rand() * 100,
  size: 0.8 + rand() * 1.8,
  opacity: 0.25 + rand() * 0.6,
  delay: rand() * 6,
}))

const sparkles = Array.from({ length: 14 }, () => ({
  x: 3 + rand() * 94,
  y: 3 + rand() * 94,
  size: 8 + rand() * 12,
  delay: rand() * 5,
  duration: 3.5 + rand() * 3,
}))
</script>

<template>
  <div class="sky" aria-hidden="true">
    <span
      v-for="(d, i) in dots"
      :key="`d${i}`"
      class="dot"
      :style="{
        left: `${d.x}%`,
        top: `${d.y}%`,
        width: `${d.size}px`,
        height: `${d.size}px`,
        opacity: d.opacity,
        animationDelay: `${d.delay}s`,
      }"
    ></span>
    <svg
      v-for="(s, i) in sparkles"
      :key="`s${i}`"
      class="sparkle"
      viewBox="0 0 20 20"
      :style="{
        left: `${s.x}%`,
        top: `${s.y}%`,
        width: `${s.size}px`,
        animationDelay: `${s.delay}s`,
        animationDuration: `${s.duration}s`,
      }"
    >
      <path d="M10 0C10.6 7 13 9.4 20 10 13 10.6 10.6 13 10 20 9.4 13 7 10.6 0 10 7 9.4 9.4 7 10 0Z" />
    </svg>
  </div>
</template>

<style scoped>
.sky {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.dot {
  position: absolute;
  border-radius: 50%;
  background: #e9eef8;
  box-shadow: 0 0 6px rgba(220, 230, 250, 0.8);
  animation: glint 7s ease-in-out infinite;
}

.sparkle {
  position: absolute;
  fill: #f2f5fb;
  filter: drop-shadow(0 0 4px rgba(220, 230, 255, 0.9));
  animation: twinkle 4s ease-in-out infinite;
  opacity: 0;
}

@keyframes glint {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(0.5);
  }
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.4) rotate(0deg);
  }
  50% {
    opacity: 0.9;
    transform: scale(1) rotate(25deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dot,
  .sparkle {
    animation: none;
  }

  .sparkle {
    opacity: 0.6;
  }
}
</style>
