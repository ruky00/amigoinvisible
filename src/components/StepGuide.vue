<script lang="ts">
export interface GuideStep {
  label: string
  state: 'done' | 'current' | 'todo' | 'waiting'
}
</script>

<script setup lang="ts">
// Nota cosida que acompaña al participante: en qué paso va, qué tiene que hacer ahora
// y un botón para llevarle justo al sitio.

defineProps<{
  steps: GuideStep[]
  title: string
  text: string
  actionLabel?: string
}>()

defineEmits<{ action: [] }>()
</script>

<template>
  <aside class="guide" aria-live="polite">
    <ol class="progress" aria-label="Tus pasos">
      <li v-for="(s, i) in steps" :key="s.label" :class="s.state">
        <span class="dot" aria-hidden="true">
          <template v-if="s.state === 'done'">✓</template>
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="step-label">
          {{ s.label }}
          <span class="sr">
            {{ s.state === 'done' ? '(hecho)' : s.state === 'current' ? '(ahora)' : s.state === 'waiting' ? '(esperando)' : '' }}
          </span>
        </span>
      </li>
    </ol>

    <div class="now">
      <p class="eyebrow">Qué hacer ahora</p>
      <p class="title">{{ title }}</p>
      <p class="text">{{ text }}</p>
      <button v-if="actionLabel" type="button" class="btn btn-secondary btn-sm go" @click="$emit('action')">
        {{ actionLabel }} <span aria-hidden="true">↓</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.guide {
  position: relative;
  margin-bottom: 1.75rem;
  padding: 1.25rem 1.4rem 1.35rem 1.9rem;
  border-radius: var(--radius);
  background: rgba(214, 220, 231, 0.07);
  border: 1px solid var(--line-strong);
}

/* cinta de raso a la izquierda, con su costura */
.guide::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 9px;
  border-radius: var(--radius) 0 0 var(--radius);
  background: var(--satin);
}

.guide::after {
  content: '';
  position: absolute;
  inset: 6px 6px 6px 16px;
  border: 1.5px dashed var(--stitch);
  border-radius: calc(var(--radius) - 6px);
  pointer-events: none;
}

.guide > * {
  position: relative;
  z-index: 1;
}

.progress {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  margin: 0 0 1rem;
  padding: 0;
}

.progress li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-soft);
  font-size: 0.95rem;
}

.dot {
  display: inline-grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  border: 1.5px dashed var(--stitch);
  font-weight: 600;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.progress li.done {
  color: var(--ok);
}

.progress li.done .dot {
  border: 1.5px solid var(--ok);
  background: rgba(169, 220, 195, 0.12);
}

.progress li.current {
  color: var(--white);
  font-weight: 500;
}

.progress li.current .dot {
  border: none;
  background: var(--satin);
  color: var(--night);
  box-shadow: 0 0 14px rgba(214, 220, 231, 0.6);
}

.progress li.waiting {
  font-style: italic;
}

.title {
  font-family: var(--font-display);
  font-size: 1.55rem;
  font-weight: 500;
  line-height: 1.2;
  color: var(--white);
  margin-top: 0.3rem;
}

.text {
  margin-top: 0.4rem;
  max-width: 46rem;
}

.go {
  margin-top: 0.9rem;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
