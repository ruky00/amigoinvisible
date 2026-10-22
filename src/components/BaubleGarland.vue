<script setup lang="ts">
// Guirnalda plateada de lado a lado, con una bola colgando en cada curva.
// Ocupa su propio hueco bajo la cabecera, así se ve bien también en el móvil
// sin tapar ningún botón.
import HangingBauble from '@/components/HangingBauble.vue'

// Una bola por curva: posición (en % del ancho), tamaño, hilo y retraso del balanceo.
const baubles = [
  { x: 12.5, size: 24, drop: 6, delay: 0 },
  { x: 37.5, size: 32, drop: 18, delay: 1.3 },
  { x: 62.5, size: 22, drop: 10, delay: 0.6 },
  { x: 87.5, size: 30, drop: 22, delay: 2 },
]
</script>

<template>
  <div class="garland" aria-hidden="true">
    <svg class="string" viewBox="0 0 100 30" preserveAspectRatio="none">
      <path
        d="M0 3Q12.5 49 25 3T50 3T75 3T100 3"
        fill="none"
        stroke="url(#garland-silver)"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
      />
      <path
        d="M0 6Q12.5 52 25 6T50 6T75 6T100 6"
        fill="none"
        stroke="rgba(214,220,231,.35)"
        stroke-width="1"
        stroke-dasharray="3 3"
        vector-effect="non-scaling-stroke"
      />
      <defs>
        <linearGradient id="garland-silver" x1="0" x2="1">
          <stop offset="0" stop-color="#8e9ab1" />
          <stop offset=".25" stop-color="#ffffff" />
          <stop offset=".5" stop-color="#aab5c8" />
          <stop offset=".75" stop-color="#ffffff" />
          <stop offset="1" stop-color="#8e9ab1" />
        </linearGradient>
      </defs>
    </svg>

    <!-- brillitos donde se engancha la guirnalda -->
    <span v-for="x in [0, 25, 50, 75, 100]" :key="`k${x}`" class="knot" :style="{ left: `${x}%` }">✦</span>

    <HangingBauble
      v-for="(b, i) in baubles"
      :key="i"
      class="hang"
      :style="{ left: `${b.x}%` }"
      :size="b.size"
      :drop="b.drop"
      :delay="b.delay"
    />
  </div>
</template>

<style scoped>
.garland {
  position: relative;
  height: 92px;
  margin: 0.5rem 0.25rem 0;
  pointer-events: none;
}

.string {
  position: absolute;
  inset: 0 0 auto;
  width: 100%;
  height: 30px;
  overflow: visible;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
}

.knot {
  position: absolute;
  top: -6px;
  transform: translateX(-50%);
  font-size: 13px;
  color: var(--white);
  text-shadow: 0 0 8px rgba(220, 230, 255, 0.95);
}

/* cada bola cuelga del punto más bajo de su curva (y = 26 de 30) */
.hang {
  position: absolute;
  top: 25px;
  translate: -50% 0;
}
</style>
