<script setup lang="ts">
// Etiqueta de regalo que se gira para descubrir el nombre.
defineProps<{ name: string; revealed: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    class="tag"
    :class="{ revealed }"
    :aria-label="revealed ? `Tu amigo invisible es ${name}. Pulsa para ocultarlo` : 'Pulsa para descubrir a tu amigo invisible'"
    @click="$emit('toggle')"
  >
    <span class="string" aria-hidden="true"></span>
    <span class="inner">
      <span class="face front">
        <span class="hole" aria-hidden="true"></span>
        <span class="eyebrow">No abrir hasta… bueno, ya</span>
        <span class="tap fancy">Toca para descubrirlo</span>
      </span>
      <span class="face back">
        <span class="hole" aria-hidden="true"></span>
        <span class="eyebrow">Este año regalas a</span>
        <span class="name fancy">{{ name }}</span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.tag {
  position: relative;
  display: block;
  width: 100%;
  max-width: 360px;
  margin: 2.75rem auto 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  perspective: 900px;
  transform: rotate(-2deg);
  font: inherit;
}

.string {
  position: absolute;
  left: 50%;
  top: -2rem;
  width: 1px;
  height: 3.1rem;
  background: linear-gradient(180deg, transparent, var(--silver));
  z-index: 2;
}

.inner {
  position: relative;
  display: block;
  height: 200px;
  transition: transform 0.8s cubic-bezier(0.3, 1.35, 0.5, 1);
  transform-style: preserve-3d;
}

.revealed .inner {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 2.4rem 1rem 1rem;
  backface-visibility: hidden;
  /* forma de etiqueta: esquinas superiores recortadas */
  clip-path: polygon(17% 0, 83% 0, 100% 17%, 100% 100%, 0 100%, 0 17%);
}

/* sombra bajo la etiqueta (un filter en las caras rompería el giro 3D) */
.inner::before {
  content: '';
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: -14px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  filter: blur(14px);
  transform: translateZ(-1px);
}

/* pespunte que sigue la forma de la etiqueta */
.face::after {
  content: '';
  position: absolute;
  inset: 9px;
  clip-path: polygon(16.5% 0, 83.5% 0, 100% 16.5%, 100% 100%, 0 100%, 0 16.5%);
  background:
    repeating-linear-gradient(90deg, var(--stitch-c) 0 6px, transparent 6px 11px) top / 100% 1.5px no-repeat,
    repeating-linear-gradient(90deg, var(--stitch-c) 0 6px, transparent 6px 11px) bottom / 100% 1.5px no-repeat,
    repeating-linear-gradient(180deg, var(--stitch-c) 0 6px, transparent 6px 11px) left / 1.5px 100% no-repeat,
    repeating-linear-gradient(180deg, var(--stitch-c) 0 6px, transparent 6px 11px) right / 1.5px 100% no-repeat;
  pointer-events: none;
}

.front {
  --stitch-c: rgba(226, 232, 242, 0.55);
  background:
    radial-gradient(ellipse at 30% 20%, rgba(120, 150, 220, 0.35), transparent 60%),
    linear-gradient(160deg, #1d3672, #0d1b42);
  color: var(--white);
}

.front .eyebrow {
  color: var(--silver);
  font-size: 0.78rem;
}

.back {
  --stitch-c: rgba(60, 74, 110, 0.5);
  background: var(--satin);
  color: var(--night);
  transform: rotateY(180deg);
}

.back .eyebrow {
  color: #2f3a58;
}

.hole {
  position: absolute;
  top: 0.85rem;
  left: 50%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border-radius: 50%;
  background: var(--night);
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.6),
    0 0 0 2px rgba(214, 220, 231, 0.55);
}

.tap {
  font-size: 2rem;
  line-height: 1.2;
  color: var(--silver);
}

.name {
  font-size: clamp(2.6rem, 9vw, 3.4rem);
  line-height: 1.15;
  color: #0d1a3d;
  text-align: center;
}

.tag:hover:not(.revealed) .inner {
  transform: rotateY(-10deg);
}

@media (prefers-reduced-motion: reduce) {
  .inner {
    transition: none;
  }
}
</style>
