<script setup lang="ts">
// "Mis sorteos": todos los sorteos de quien organiza, y el formulario para crear uno nuevo.
import { onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { api, ApiError, usingMock } from '@/api'
import { resetMockDb } from '@/api/mock'
import { useSessionStore } from '@/stores/session'
import type { EventSummary } from '@/types'
import AdminLogin from '@/components/AdminLogin.vue'
import RibbonBow from '@/components/RibbonBow.vue'
import KnitSock from '@/components/KnitSock.vue'

const session = useSessionStore()
const router = useRouter()

const events = ref<EventSummary[] | null>(null)
const error = ref('')
const busy = ref(false)

const token = () => session.adminToken ?? ''

function logout() {
  session.adminToken = null
  events.value = null
}

async function load() {
  error.value = ''
  try {
    events.value = await api.listEvents(token())
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return logout()
    error.value = e instanceof ApiError ? e.message : 'No se han podido cargar los sorteos.'
  }
}

onMounted(() => {
  if (session.adminToken) load()
})

// --- Nuevo sorteo ---
const IDEAS = ['Papá Noel · Familia', 'Reyes Magos · Primos', 'Camisetas raras · Equipo', 'Cosas de menos de 5 €']
const draft = reactive({ name: '', budget: '', date: '' })
const createError = ref('')

async function create() {
  createError.value = ''
  if (!draft.name.trim()) {
    createError.value = 'Ponle un nombre, para distinguirlo de los demás.'
    return
  }
  busy.value = true
  try {
    const { id } = await api.createEvent(token(), { ...draft })
    router.push({ name: 'admin-event', params: { eventId: id } })
  } catch (e) {
    createError.value = e instanceof ApiError ? e.message : 'No se ha podido crear.'
  } finally {
    busy.value = false
  }
}

function goToCreate() {
  const form = document.getElementById('new-event')
  form?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  document.getElementById('new-name')?.focus({ preventScroll: true })
}

function shortDate(date: string) {
  if (!date) return ''
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
}

function resetDemo() {
  if (!confirm('Esto borra los datos de prueba de este navegador. ¿Seguro?')) return
  resetMockDb()
  load()
}
</script>

<template>
  <AdminLogin v-if="!session.adminToken" @done="load" />

  <div v-else class="events-page">
    <header class="head">
      <div>
        <p class="eyebrow">Organización</p>
        <h1 class="silver">Mis <em>sorteos</em></h1>
        <p class="muted lead">
          Cada sorteo va por su cuenta: su gente, sus códigos y sus listas. Puedes tener tantos
          como quieras (la paciencia ya es otra cosa).
        </p>
        <button type="button" class="btn btn-primary new-btn" @click="goToCreate">
          + Crear un sorteo nuevo
        </button>
      </div>
      <button class="btn btn-ghost btn-sm" @click="logout">Salir</button>
    </header>

    <p v-if="error" class="banner error" role="alert">{{ error }}</p>

    <p v-if="!events && !error" class="loading">Buscando tus sorteos…</p>

    <div v-else-if="events" class="layout">
      <!-- Lista de sorteos -->
      <section class="list" aria-label="Tus sorteos">
        <div v-if="events.length === 0" class="card empty">
          <KnitSock :size="60" />
          <p class="empty-title">Todavía no hay ningún sorteo</p>
          <p class="muted">Crea el primero con el formulario. ¿Empezamos por la familia?</p>
        </div>

        <article v-for="e in events" :key="e.id" class="card event">
          <div class="event-top">
            <h2 class="event-name">{{ e.name }}</h2>
            <span class="pill" :class="{ on: e.drawDone }">
              {{ e.drawDone ? 'Sorteo hecho ✦' : 'Preparando' }}
            </span>
          </div>

          <p class="meta muted">
            <span v-if="e.date">Intercambio <b>{{ shortDate(e.date) }}</b></span>
            <span v-if="e.budget">Presupuesto <b>{{ e.budget }}</b></span>
          </p>

          <ul class="numbers">
            <li><b>{{ e.participantCount }}</b> {{ e.participantCount === 1 ? 'persona' : 'personas' }}</li>
            <li><b>{{ e.wishlistCount }}</b> con lista</li>
            <li v-if="e.drawDone"><b>{{ e.seenCount }}</b> han entrado</li>
          </ul>

          <RouterLink
            :to="{ name: 'admin-event', params: { eventId: e.id } }"
            class="btn btn-secondary open"
            :aria-label="`Abrir el sorteo ${e.name}`"
          >
            Abrir y editar <span aria-hidden="true">→</span>
          </RouterLink>
        </article>
      </section>

      <!-- Crear -->
      <form id="new-event" class="card stack create" style="--gap: 0.9rem" @submit.prevent="create">
        <RibbonBow />
        <h2>Nuevo <em>sorteo</em></h2>
        <p class="muted small">Después podrás añadir a la gente y cambiar estos datos cuando quieras.</p>

        <div>
          <label for="new-name">Nombre del sorteo</label>
          <input id="new-name" v-model="draft.name" maxlength="60" placeholder="Reyes Magos · Primos" />
        </div>
        <div class="ideas" aria-label="Ideas de nombre">
          <span class="muted small">Ideas:</span>
          <button v-for="idea in IDEAS" :key="idea" type="button" class="chip" @click="draft.name = idea">
            {{ idea }}
          </button>
        </div>
        <div>
          <label for="new-budget">Presupuesto <span class="optional">(opcional)</span></label>
          <input id="new-budget" v-model="draft.budget" maxlength="30" placeholder="20 €" />
        </div>
        <div>
          <label for="new-date">Día del intercambio <span class="optional">(opcional)</span></label>
          <input id="new-date" v-model="draft.date" type="date" />
        </div>
        <p v-if="createError" class="error" role="alert">{{ createError }}</p>
        <button class="btn btn-primary" :disabled="busy">
          {{ busy ? 'Creando…' : 'Crear sorteo' }}
        </button>
      </form>
    </div>

    <p v-if="usingMock && events" class="demo muted small">
      Estás en modo pruebas: los datos viven solo en este navegador.
      <button class="btn-link" type="button" @click="resetDemo">Empezar de cero</button>
    </p>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2rem;
}

.head .eyebrow {
  margin-bottom: 0.6rem;
}

.lead {
  margin-top: 0.9rem;
  max-width: 36rem;
}

.new-btn {
  margin-top: 1.25rem;
}

.create {
  scroll-margin-top: 1.5rem;
}

.loading {
  text-align: center;
  font-family: var(--font-display);
  font-style: italic;
  font-size: 1.8rem;
  color: var(--text-soft);
  padding-top: 2rem;
}

.banner {
  background: rgba(255, 179, 166, 0.1);
  border: 1px dashed rgba(255, 179, 166, 0.5);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.4rem;
}

.layout {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 1.75rem;
  align-items: start;
}

.list {
  display: grid;
  gap: 1.25rem;
}

.event {
  display: grid;
  gap: 0.6rem;
}

.event-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.event-name {
  font-size: 1.6rem;
}

.pill {
  font-size: 0.9rem;
  padding: 0.15rem 0.7rem;
  border-radius: 999px;
  border: 1px dashed var(--line-strong);
  color: var(--text-soft);
  white-space: nowrap;
}

.pill.on {
  border-style: solid;
  border-color: rgba(169, 220, 195, 0.6);
  color: var(--ok);
  background: rgba(169, 220, 195, 0.08);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 1.5rem;
}

.meta b {
  margin-left: 0.3rem;
}

.numbers {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
}

.numbers li {
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  padding: 0.25rem 0.75rem;
  font-size: 0.95rem;
}

.open {
  justify-self: start;
  margin-top: 0.4rem;
}

.empty {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 0.6rem;
}

.empty-title {
  font-family: var(--font-display);
  font-size: 1.4rem;
  color: var(--white);
}

.create h2 {
  padding-right: 4rem;
}

.small {
  font-size: 0.95rem;
}

.optional {
  font-weight: 400;
  color: var(--text-soft);
}

.ideas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.chip {
  font: inherit;
  font-size: 0.92rem;
  min-height: 2.4rem;
  padding: 0.25rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.chip:hover {
  background: var(--hover);
}

.demo {
  text-align: center;
  margin-top: 2rem;
}

@media (max-width: 820px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
