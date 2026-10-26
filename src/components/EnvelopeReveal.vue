<script setup lang="ts">
// Sobre que se abre para descubrir el nombre: la solapa se levanta, sale la tarjeta
// con el nombre iluminado y salta purpurina. Al volver a tocarlo, se cierra.

defineProps<{ name: string; revealed: boolean }>()
defineEmits<{ toggle: [] }>()

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

const rand = rng(2412)
const COLORS = ['#ffffff', '#e4e9f2', '#c9d8f5', '#f4e6b8', '#ffffff', '#dfe4ec']

// Purpurina que estalla hacia fuera desde el nombre (una sola vez al abrir)
const burst = Array.from({ length: 44 }, (_, i) => {
  const angle = (i / 44) * Math.PI * 2 + rand() * 0.4
  const dist = 70 + rand() * 110
  return {
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist * 0.75 - 20,
    size: 4 + rand() * 6,
    delay: rand() * 0.25,
    color: COLORS[i % COLORS.length],
    star: i % 4 === 0,
    spin: Math.round(rand() * 360),
  }
})

// Destellos que se quedan parpadeando alrededor del nombre
const twinkles = Array.from({ length: 12 }, () => ({
  x: 4 + rand() * 92,
  y: 8 + rand() * 70,
  size: 7 + rand() * 9,
  delay: rand() * 2.5,
}))
</script>

<template>
  <div class="reveal" :class="{ open: revealed }">
    <button
      type="button"
      class="envelope"
      :aria-label="revealed ? `Tu amigo invisible es ${name}. Pulsa para cerrar el sobre` : 'Pulsa para abrir el sobre y descubrir a tu amigo invisible'"
      @click="$emit('toggle')"
    >
      <!-- interior del sobre (se ve al abrir la solapa) -->
      <span class="inside" aria-hidden="true"></span>

      <!-- la tarjeta con el nombre -->
      <span class="letter">
        <span class="eyebrow">Este año regalas a</span>
        <span class="name fancy">{{ name }}</span>

        <span v-if="revealed" class="glitter" aria-hidden="true">
          <span
            v-for="(g, i) in burst"
            :key="`b${i}`"
            class="bit"
            :class="{ star: g.star }"
            :style="{
              '--dx': `${g.dx}px`,
              '--dy': `${g.dy}px`,
              '--spin': `${g.spin}deg`,
              width: `${g.size}px`,
              height: `${g.size}px`,
              background: g.color,
              animationDelay: `${1 + g.delay}s`,
            }"
          ></span>
          <svg
            v-for="(t, i) in twinkles"
            :key="`t${i}`"
            class="twinkle"
            viewBox="0 0 20 20"
            :style="{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.size}px`, animationDelay: `${1.2 + t.delay}s` }"
          >
            <path d="M10 0C10.6 7 13 9.4 20 10 13 10.6 10.6 13 10 20 9.4 13 7 10.6 0 10 7 9.4 9.4 7 10 0Z" />
          </svg>
        </span>
      </span>

      <!-- bolsillo delantero, con sus costuras -->
      <svg class="pocket" viewBox="0 0 340 210" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="env-side" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#f4f6fa" />
            <stop offset="1" stop-color="#bcc5d4" />
          </linearGradient>
          <linearGradient id="env-bottom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#e9edf3" />
            <stop offset="1" stop-color="#c3cbd8" />
          </linearGradient>
        </defs>
        <path d="M0 0 170 118 0 210Z" fill="url(#env-side)" />
        <path d="M340 0 170 118 340 210Z" fill="url(#env-side)" />
        <path d="M0 210 170 104 340 210Z" fill="url(#env-bottom)" />
        <path
          d="M8 14 166 118M332 14 174 118M10 202 170 112 330 202"
          fill="none"
          stroke="#7e8aa3"
          stroke-width="1.2"
          stroke-dasharray="5 4"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <span class="to fancy" aria-hidden="true">Para ti · no abrir con público</span>

      <!-- solapa con su sello de lacre -->
      <span class="flap" aria-hidden="true">
        <svg viewBox="0 0 340 128" preserveAspectRatio="none">
          <defs>
            <linearGradient id="env-flap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#dfe4ec" />
              <stop offset="1" stop-color="#f7f9fc" />
            </linearGradient>
          </defs>
          <path d="M0 0H340L170 126Z" fill="url(#env-flap)" />
          <path
            d="M12 6H328L170 118Z"
            fill="none"
            stroke="#7e8aa3"
            stroke-width="1.2"
            stroke-dasharray="5 4"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <span class="seal">✦</span>
      </span>
    </button>

    <!-- el mensaje solo ocupa sitio cuando el sobre está abierto -->
    <div class="shh-wrap">
      <p class="shh fancy" :aria-hidden="!revealed">Chsss… no se lo cuentes a nadie</p>
    </div>
  </div>
</template>

<style scoped>
.reveal {
  --lift: 150px;
  padding-top: 1.75rem;
  transition: padding-top 0.6s ease 0.1s;
}

.reveal.open {
  padding-top: calc(var(--lift) + 1rem);
  transition-delay: 0.35s;
}

.envelope {
  position: relative;
  display: block;
  width: 100%;
  max-width: 340px;
  height: 210px;
  margin: 0 auto;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  perspective: 900px;
  font: inherit;
  filter: drop-shadow(0 20px 26px rgba(0, 0, 0, 0.5));
}

.envelope {
  transition: translate 0.2s ease;
}

.reveal:not(.open) .envelope:hover {
  translate: 0 -4px;
}

.inside {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: linear-gradient(180deg, #9aa5ba, #c4ccda);
  z-index: 0;
}

/* --- La tarjeta --- */
.letter {
  position: absolute;
  left: 6%;
  right: 6%;
  bottom: 8px;
  height: 196px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 1.1rem 0.75rem 0;
  border-radius: 8px;
  background:
    radial-gradient(ellipse at 50% 35%, rgba(130, 160, 230, 0.35), transparent 65%),
    linear-gradient(170deg, #1d3672, #0c1940);
  box-shadow: inset 0 0 0 1px rgba(214, 220, 231, 0.35);
  transform: translateY(0);
  transition: transform 0.6s cubic-bezier(0.5, 0, 0.75, 0);
}

.letter::before {
  content: '';
  position: absolute;
  inset: 6px;
  border: 1.5px dashed rgba(226, 232, 242, 0.45);
  border-radius: 5px;
  pointer-events: none;
}

.open .letter {
  transform: translateY(calc(var(--lift) * -1));
  transition: transform 0.85s cubic-bezier(0.2, 0.9, 0.3, 1.15) 0.45s;
}

.letter .eyebrow {
  color: var(--silver);
  font-size: 0.8rem;
}

.name {
  position: relative;
  font-size: clamp(2.7rem, 11vw, 3.4rem);
  line-height: 1.15;
  text-align: center;
  color: #fff;
  /* brillo plateado que recorre el nombre */
  background: linear-gradient(100deg, #ffffff 0%, #ffffff 40%, #b9c8ee 50%, #ffffff 60%, #ffffff 100%);
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 8px rgba(220, 232, 255, 0.95)) drop-shadow(0 0 24px rgba(160, 190, 255, 0.7));
}

.open .name {
  animation: shine 3.2s ease-in-out 1.2s infinite;
}

@keyframes shine {
  0% {
    background-position: 100% 0;
  }
  60%,
  100% {
    background-position: -50% 0;
  }
}

/* --- Purpurina --- */
.glitter {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bit {
  position: absolute;
  left: 50%;
  top: 34%;
  border-radius: 50%;
  opacity: 0;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.9);
  animation: burst 1.5s cubic-bezier(0.15, 0.7, 0.3, 1) forwards;
}

.bit.star {
  border-radius: 1px;
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
}

@keyframes burst {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.3) rotate(0deg);
  }
  15% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 40px)) scale(1) rotate(var(--spin));
  }
}

.twinkle {
  position: absolute;
  fill: #ffffff;
  filter: drop-shadow(0 0 4px rgba(220, 230, 255, 1));
  opacity: 0;
  animation: twinkle 2.6s ease-in-out infinite;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.3) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(30deg);
  }
}

/* --- Bolsillo y solapa --- */
.pocket {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  overflow: visible;
}

.to {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 22px;
  z-index: 3;
  text-align: center;
  font-size: 1.1rem;
  color: #3a4668;
}

.flap {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 128px;
  z-index: 4;
  transform-origin: top center;
  transform: rotateX(0deg);
  /* al cerrar: primero baja la tarjeta y luego se cierra la solapa */
  transition:
    transform 0.5s ease 0.45s,
    z-index 0s linear 0.6s;
}

.open .flap {
  z-index: 1;
  transform: rotateX(180deg);
  transition:
    transform 0.5s ease,
    z-index 0s linear 0.25s;
}

.flap svg {
  display: block;
  width: 100%;
  height: 100%;
}

.seal {
  position: absolute;
  left: 50%;
  top: 100px;
  width: 46px;
  height: 46px;
  margin-left: -23px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 1.2rem;
  color: #dfe6f5;
  background: radial-gradient(circle at 35% 30%, #3b5aa8, #14275a 70%);
  box-shadow:
    0 0 0 3px #1a2f66,
    0 4px 10px rgba(0, 0, 0, 0.45),
    inset 0 0 0 2px rgba(214, 220, 231, 0.35);
  transition: opacity 0.2s ease 0.5s;
}

.open .seal {
  opacity: 0;
  transition-delay: 0s;
}

/* --- Mensaje secreto --- */
.shh-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}

.open .shh-wrap {
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.5s ease 1.4s;
}

.shh {
  overflow: hidden;
  padding-top: 1.1rem;
  text-align: center;
  font-size: 1.45rem;
  color: var(--white);
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 0.3s,
    transform 0.3s;
}

.open .shh {
  opacity: 1;
  transform: none;
  transition:
    opacity 0.6s ease 1.6s,
    transform 0.6s ease 1.6s;
}

@media (prefers-reduced-motion: reduce) {
  .reveal,
  .shh-wrap,
  .open .shh-wrap,
  .letter,
  .flap,
  .seal,
  .shh,
  .open .letter,
  .open .flap,
  .open .shh {
    transition: none;
  }

  .bit,
  .open .name {
    animation: none;
  }

  .bit {
    display: none;
  }
}
</style>
