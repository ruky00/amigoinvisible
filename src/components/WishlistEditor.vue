<script setup lang="ts">
// Editor de la lista de deseos propia: cada deseo es un texto y, si se quiere, un enlace.
import { computed, ref, watch } from 'vue'
import type { Wish } from '@/types'
import { normalizeUrl } from '@/lib/url'

const props = defineProps<{ wishes: Wish[]; saving: boolean }>()
const emit = defineEmits<{ save: [wishes: Wish[]]; dirty: [dirty: boolean] }>()

interface Row {
  id: string
  text: string
  url: string
}

const rows = ref<Row[]>([])
const savedSnapshot = ref('')
const justSaved = ref(false)
const linkError = ref<number | null>(null)

function fromWishes(wishes: Wish[]): Row[] {
  return wishes.map((w) => ({ id: w.id, text: w.text, url: w.url ?? '' }))
}

watch(
  () => props.wishes,
  (wishes) => {
    rows.value = fromWishes(wishes)
    if (rows.value.length === 0) addRow(false)
    savedSnapshot.value = snapshot()
  },
  { immediate: true },
)

function snapshot() {
  return JSON.stringify(rows.value.filter((r) => r.text.trim() || r.url.trim()).map((r) => [r.text.trim(), r.url.trim()]))
}

const dirty = computed(() => snapshot() !== savedSnapshot.value)

watch(dirty, (d) => {
  emit('dirty', d)
  if (d) justSaved.value = false
})

function addRow(focus = true) {
  rows.value.push({ id: '', text: '', url: '' })
  if (focus) {
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.wish-text')
      inputs[inputs.length - 1]?.focus()
    })
  }
}

function removeRow(i: number) {
  rows.value.splice(i, 1)
  if (rows.value.length === 0) addRow(false)
}

function save() {
  linkError.value = null
  const out: Wish[] = []
  for (const [i, r] of rows.value.entries()) {
    if (!r.text.trim() && !r.url.trim()) continue
    const url = normalizeUrl(r.url)
    if (r.url.trim() && !url) {
      linkError.value = i
      return
    }
    out.push({ id: r.id, text: r.text.trim() || 'Esto de aquí', url })
  }
  emit('save', out)
  justSaved.value = true
}
</script>

<template>
  <form class="editor" @submit.prevent="save">
    <!-- mini instrucciones, justo encima de donde se escribe -->
    <ol class="how">
      <li><span class="k">1</span> Escribe una cosa que te guste en cada recuadro.</li>
      <li><span class="k">2</span> Si tienes el enlace de la tienda, pégalo en la casilla de debajo (no es obligatorio).</li>
      <li><span class="k">3</span> ¿Quieres pedir más cosas? Pulsa «Añadir otro deseo».</li>
      <li><span class="k">4</span> Al terminar, pulsa «Guardar mi lista».</li>
    </ol>

    <div v-for="(r, i) in rows" :key="i" class="row">
      <span class="n" aria-hidden="true">{{ i + 1 }}</span>
      <div class="fields">
        <input
          v-model="r.text"
          class="wish-text"
          :aria-label="`Deseo ${i + 1}`"
          placeholder="Algo que te haga ilusión…"
          maxlength="200"
        />
        <input
          v-model="r.url"
          type="text"
          autocapitalize="off"
          spellcheck="false"
          inputmode="url"
          class="wish-url"
          :class="{ bad: linkError === i }"
          :aria-label="`Enlace del deseo ${i + 1} (opcional)`"
          placeholder="Enlace de la tienda (opcional)"
        />
      </div>
      <button
        type="button"
        class="remove"
        :aria-label="`Quitar deseo ${i + 1}`"
        @click="removeRow(i)"
      >
        Quitar
      </button>
    </div>

    <p v-if="linkError !== null" class="error">Ese enlace no parece válido. Cópialo entero desde la tienda.</p>

    <div class="actions">
      <button type="button" class="btn btn-ghost btn-sm" @click="addRow()">+ Añadir otro deseo</button>
      <span class="spacer"></span>
      <span v-if="justSaved && !dirty && !saving" class="saved">Guardada ✦</span>
      <span v-else-if="dirty && !saving" class="pending">Falta guardar <span aria-hidden="true">→</span></span>
      <button class="btn btn-primary" :disabled="saving || !dirty">
        {{ saving ? 'Guardando…' : 'Guardar mi lista' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1.6rem 1fr auto;
  column-gap: 0.6rem;
  gap: 0.5rem;
  align-items: start;
  padding: 0.75rem 0;
  border-bottom: 1px dashed var(--stitch);
}

.n {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 1.4rem;
  color: var(--silver-deep);
  line-height: 1.9;
}

.fields {
  display: grid;
  gap: 0.4rem;
}

.wish-url {
  font-size: 0.9rem;
  padding: 0.45rem 0.7rem;
  background: transparent;
  border-style: dashed;
}

.wish-url.bad {
  border-color: var(--danger);
  border-style: solid;
}

.remove {
  border: 1.5px solid transparent;
  background: none;
  font: inherit;
  font-size: 0.92rem;
  color: var(--text-soft);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  min-height: 3rem;
  padding: 0 0.5rem;
  border-radius: 10px;
}

.remove:hover {
  color: var(--white);
  background: var(--hover);
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.spacer {
  flex: 1;
}

.how {
  list-style: none;
  margin: 0.25rem 0 0.5rem;
  padding: 0.75rem 0.9rem;
  display: grid;
  gap: 0.35rem;
  font-size: 0.95rem;
  color: var(--text-soft);
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
}

.how li {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
}

.k {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--white);
}

.pending {
  color: var(--white);
  font-weight: 500;
  font-size: 0.95rem;
  animation: nudge 1.6s ease-in-out infinite;
}

@keyframes nudge {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pending {
    animation: none;
  }
}

.saved {
  color: var(--ok);
  font-size: 0.95rem;
  letter-spacing: 0.05em;
}

.error {
  margin-top: 0.5rem;
}

/* en el móvil, «Quitar» va debajo para que los recuadros tengan todo el ancho */
@media (max-width: 600px) {
  .row {
    grid-template-columns: 1.6rem 1fr;
  }

  .remove {
    grid-column: 2;
    justify-self: end;
    min-height: 2.4rem;
  }
}
</style>
