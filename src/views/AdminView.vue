<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api, ApiError, usingMock } from '@/api'
import { resetMockDb } from '@/api/mock'
import { useSessionStore } from '@/stores/session'
import type { AdminParticipant, AdminState } from '@/types'
import HangingBauble from '@/components/HangingBauble.vue'
import RibbonBow from '@/components/RibbonBow.vue'

const session = useSessionStore()

const state = ref<AdminState | null>(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')

// --- Login ---
const password = ref('')
const loginError = ref('')

async function login() {
  loginError.value = ''
  busy.value = true
  try {
    const { token } = await api.loginAdmin(password.value)
    session.adminToken = token
    password.value = ''
    await load()
  } catch (e) {
    loginError.value = e instanceof ApiError ? e.message : 'No se ha podido entrar.'
  } finally {
    busy.value = false
  }
}

function logout() {
  session.adminToken = null
  state.value = null
}

const token = () => session.adminToken ?? ''

async function load() {
  loading.value = true
  try {
    setState(await api.getAdminState(token()))
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return logout()
    error.value = e instanceof ApiError ? e.message : 'No se han podido cargar los datos.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (session.adminToken) load()
})

/** Ejecuta una acción de la API mostrando el error, si lo hay, arriba del todo. */
async function run(action: () => Promise<AdminState>): Promise<boolean> {
  error.value = ''
  busy.value = true
  try {
    setState(await action())
    return true
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) logout()
    error.value = e instanceof ApiError ? e.message : 'Algo ha fallado. Prueba otra vez.'
    return false
  } finally {
    busy.value = false
  }
}

// --- Evento ---
const eventForm = reactive({ name: '', budget: '', date: '' })
const eventSaved = ref(false)

function setState(s: AdminState) {
  state.value = s
  eventForm.name = s.event.name
  eventForm.budget = s.event.budget
  eventForm.date = s.event.date
}

async function saveEvent() {
  if (await run(() => api.updateEvent(token(), { ...eventForm }))) {
    eventSaved.value = true
    setTimeout(() => (eventSaved.value = false), 2000)
  }
}

// --- Participantes ---
const newName = ref('')
const openExclusions = ref<string | null>(null)
const copied = ref<string | null>(null)

async function addPerson() {
  if (!newName.value.trim()) return
  if (await run(() => api.addParticipant(token(), newName.value))) newName.value = ''
}

async function removePerson(p: AdminParticipant) {
  if (!confirm(`¿Quitar a ${p.name} del sorteo?`)) return
  await run(() => api.removeParticipant(token(), p.id))
}

async function toggleExclusion(p: AdminParticipant, otherId: string) {
  const exclusions = p.exclusions.includes(otherId)
    ? p.exclusions.filter((x) => x !== otherId)
    : [...p.exclusions, otherId]
  await run(() => api.updateParticipant(token(), p.id, { exclusions }))
}

function linkFor(p: AdminParticipant) {
  return `${location.origin}/entrar/${encodeURIComponent(p.code)}`
}

function whatsappFor(p: AdminParticipant) {
  const text = `¡Hola ${p.name}! Ya está montado el amigo invisible 🎁\nEntra aquí para ver a quién te toca y escribir tu lista: ${linkFor(p)}\n(Tu código es ${p.code})`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

async function copyLink(p: AdminParticipant) {
  try {
    await navigator.clipboard.writeText(linkFor(p))
    copied.value = p.id
    setTimeout(() => (copied.value = null), 1800)
  } catch {
    prompt('Copia este enlace:', linkFor(p))
  }
}

function nameOf(id: string) {
  return state.value?.participants.find((p) => p.id === id)?.name ?? '¿?'
}

// --- Sorteo ---
const drawDone = computed(() => state.value?.event.drawDone ?? false)
const seenCount = computed(() => state.value?.participants.filter((p) => p.seenAt).length ?? 0)
const listCount = computed(() => state.value?.participants.filter((p) => p.wishCount > 0).length ?? 0)

const drawing = ref(false)

async function doDraw() {
  drawing.value = true
  await run(() => api.runDraw(token()))
  drawing.value = false
}

async function redoDraw() {
  const ok = confirm(
    'Se anulará el sorteo actual y podrás volver a hacerlo (y añadir o quitar gente). Las listas de deseos se mantienen. ¿Seguro?',
  )
  if (ok) await run(() => api.resetDraw(token()))
}

function drawnAtText() {
  const at = state.value?.event.drawnAt
  if (!at) return ''
  return new Date(at).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

function resetDemo() {
  if (!confirm('Esto borra los datos de prueba de este navegador. ¿Seguro?')) return
  resetMockDb()
  load()
}
</script>

<template>
  <!-- Acceso -->
  <section v-if="!session.adminToken" class="login">
    <form class="card stack" @submit.prevent="login">
      <RibbonBow />
      <HangingBauble :size="40" :sway="false" />
      <h2>Zona de <em>organización</em></h2>
      <p class="muted">Aquí se apunta a la familia y se mezclan los papelitos.</p>
      <div>
        <label for="pw">Contraseña</label>
        <input id="pw" v-model="password" type="password" autocomplete="current-password" />
      </div>
      <p v-if="loginError" class="error" role="alert">{{ loginError }}</p>
      <button class="btn btn-primary" :disabled="busy || !password">Entrar</button>
    </form>
  </section>

  <p v-else-if="loading && !state" class="loading">Contando a la familia…</p>

  <div v-else-if="state" class="admin">
    <header class="head">
      <div>
        <p class="eyebrow">Organización</p>
        <h1 class="silver">{{ state.event.name || 'Amigo invisible' }}</h1>
      </div>
      <button class="btn btn-ghost btn-sm" @click="logout">Salir</button>
    </header>

    <p v-if="error" class="banner error" role="alert">{{ error }}</p>

    <div class="grid">
      <!-- Participantes -->
      <section class="card people">
        <RibbonBow />
        <div class="section-head">
          <h2>La familia</h2>
          <span class="muted count">{{ state.participants.length }} personas</span>
        </div>

        <form v-if="!drawDone" class="add" @submit.prevent="addPerson">
          <input v-model="newName" placeholder="Nombre (p. ej. Tía Rosa)" maxlength="40" aria-label="Nombre" />
          <button class="btn btn-secondary" :disabled="busy || !newName.trim()">Añadir</button>
        </form>
        <p v-else class="muted note">
          El sorteo ya está hecho. Para añadir o quitar a alguien, anúlalo y vuelve a hacerlo.
        </p>

        <ul class="list">
          <li v-for="p in state.participants" :key="p.id" class="person">
            <div class="person-main">
              <div class="who">
                <span class="name">{{ p.name }}</span>
                <span class="code" title="Código personal">{{ p.code }}</span>
              </div>
              <div class="status">
                <span class="pill" :class="{ on: p.wishCount > 0 }">
                  {{ p.wishCount > 0 ? `Lista: ${p.wishCount}` : 'Sin lista' }}
                </span>
                <span v-if="drawDone" class="pill" :class="{ on: p.seenAt }">
                  {{ p.seenAt ? 'Ha entrado' : 'No ha entrado' }}
                </span>
              </div>
            </div>

            <div class="person-actions">
              <button class="btn btn-ghost btn-sm" type="button" @click="copyLink(p)">
                {{ copied === p.id ? '¡Copiado!' : 'Copiar enlace' }}
              </button>
              <a class="btn btn-ghost btn-sm" :href="whatsappFor(p)" target="_blank" rel="noopener">WhatsApp</a>
              <button
                class="btn-link small"
                type="button"
                :aria-expanded="openExclusions === p.id"
                @click="openExclusions = openExclusions === p.id ? null : p.id"
              >
                {{ p.exclusions.length ? `No le toca: ${p.exclusions.map(nameOf).join(', ')}` : 'Exclusiones' }}
              </button>
              <button
                v-if="!drawDone"
                class="remove"
                type="button"
                :aria-label="`Quitar a ${p.name}`"
                @click="removePerson(p)"
              >
                Quitar
              </button>
            </div>

            <div v-if="openExclusions === p.id" class="exclusions">
              <p class="muted small">
                ¿A quién <b>no</b> puede tocarle {{ p.name }}? (Su pareja, por ejemplo.)
              </p>
              <div class="chips">
                <button
                  v-for="o in state.participants.filter((x) => x.id !== p.id)"
                  :key="o.id"
                  type="button"
                  class="chip"
                  :class="{ on: p.exclusions.includes(o.id) }"
                  :aria-pressed="p.exclusions.includes(o.id)"
                  :disabled="busy || drawDone"
                  @click="toggleExclusion(p, o.id)"
                >
                  {{ o.name }}
                </button>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <div class="side">
        <!-- Sorteo -->
        <section class="card draw" :class="{ done: drawDone }">
          <RibbonBow />
          <h2>El sorteo</h2>
          <template v-if="!drawDone">
            <p class="muted">
              Cuando esté toda la familia apuntada, haz el sorteo. Nadie, ni siquiera tú, verá quién le
              toca a quién: cada uno solo ve el suyo.
            </p>
            <button
              class="btn btn-primary big"
              :disabled="busy || state.participants.length < 3"
              @click="doDraw"
            >
              {{ drawing ? 'Mezclando papelitos…' : 'Hacer el sorteo' }}
            </button>
            <p v-if="state.participants.length < 3" class="muted small">Hacen falta al menos 3 personas.</p>
          </template>
          <template v-else>
            <p class="stamp fancy">¡Sorteo hecho!</p>
            <p class="muted small">{{ drawnAtText() }}</p>
            <dl class="numbers">
              <div>
                <dt>Han entrado</dt>
                <dd>{{ seenCount }} / {{ state.participants.length }}</dd>
              </div>
              <div>
                <dt>Con lista</dt>
                <dd>{{ listCount }} / {{ state.participants.length }}</dd>
              </div>
            </dl>
            <button class="btn-link small" :disabled="busy" @click="redoDraw">Anular el sorteo</button>
          </template>
        </section>

        <!-- Datos del evento -->
        <form class="card stack event" style="--gap: 0.85rem" @submit.prevent="saveEvent">
          <h2>Detalles</h2>
          <div>
            <label for="ev-name">Nombre</label>
            <input id="ev-name" v-model="eventForm.name" maxlength="60" />
          </div>
          <div>
            <label for="ev-budget">Presupuesto</label>
            <input id="ev-budget" v-model="eventForm.budget" placeholder="20 €" maxlength="30" />
          </div>
          <div>
            <label for="ev-date">Día del intercambio</label>
            <input id="ev-date" v-model="eventForm.date" type="date" />
          </div>
          <div class="row-end">
            <span v-if="eventSaved" class="saved">Guardado ✦</span>
            <button class="btn btn-ghost" :disabled="busy">Guardar</button>
          </div>
        </form>

        <p v-if="usingMock" class="demo muted small">
          Estás en modo pruebas: los datos viven solo en este navegador.
          <button class="btn-link" type="button" @click="resetDemo">Empezar de cero</button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login {
  max-width: 430px;
  margin: 1rem auto 0;
}

.login .card {
  text-align: center;
  padding-top: 2.4rem;
}

.login label,
.login input {
  text-align: left;
}

.login .btn {
  width: 100%;
}

.loading {
  text-align: center;
  font-family: var(--font-display);
  font-style: italic;
  font-size: 1.8rem;
  color: var(--text-soft);
  padding-top: 3rem;
}

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

.banner {
  background: rgba(255, 179, 166, 0.1);
  border: 1px dashed rgba(255, 179, 166, 0.5);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.4rem;
}

.grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 1.75rem;
  align-items: start;
}

.side {
  display: grid;
  gap: 1.75rem;
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding-right: 4.5rem;
}

.count {
  font-size: 0.9rem;
  letter-spacing: 0.08em;
}

.add {
  display: flex;
  gap: 0.6rem;
  margin: 1.25rem 0 0.5rem;
}

.note {
  margin: 0.9rem 0 0.25rem;
  font-size: 0.95rem;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.person {
  padding: 1.1rem 0;
  border-bottom: 1px dashed var(--stitch);
}

.person:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.person-main {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.who {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.name {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 1.35rem;
  color: var(--white);
}

.code {
  font-size: 0.9rem;
  letter-spacing: 0.16em;
  color: var(--silver);
  border: 1px solid var(--line-strong);
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
}

.status {
  display: flex;
  gap: 0.4rem;
}

.pill {
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  padding: 0.12rem 0.6rem;
  border-radius: 999px;
  border: 1px dashed var(--line-strong);
  color: var(--text-soft);
}

.pill.on {
  border-style: solid;
  border-color: rgba(169, 220, 195, 0.6);
  color: var(--ok);
  background: rgba(169, 220, 195, 0.08);
}

.person-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.7rem;
}

.person-actions .remove {
  margin-left: auto;
}

.remove {
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.95rem;
  color: var(--text-soft);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  min-height: 2.6rem;
  padding: 0 0.5rem;
  border-radius: 8px;
}

.remove:hover {
  color: var(--white);
  background: var(--hover);
}

.small {
  font-size: 0.9rem;
}

.exclusions {
  margin-top: 0.8rem;
  padding: 0.85rem;
  background: rgba(6, 14, 36, 0.4);
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.55rem;
}

.chip {
  font: inherit;
  font-size: 0.9rem;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.chip:hover:not(:disabled) {
  background: var(--hover);
}

.chip.on {
  background: var(--satin);
  border-color: transparent;
  color: var(--night);
  font-weight: 400;
}

.draw {
  display: grid;
  gap: 0.9rem;
}

.big {
  padding: 0.95rem;
  font-size: 1.05rem;
}

.stamp {
  font-size: 2.2rem;
  line-height: 1.2;
  color: var(--white);
  text-shadow: 0 0 18px rgba(200, 215, 255, 0.45);
  transform: rotate(-3deg);
  transform-origin: left;
}

.numbers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 0.25rem 0;
}

.numbers div {
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  padding: 0.6rem 0.8rem;
}

.numbers dt {
  font-size: 0.9rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--silver-deep);
}

.numbers dd {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.8rem;
  color: var(--white);
}

.draw .btn-link {
  justify-self: start;
}

.row-end {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
}

.saved {
  color: var(--ok);
  font-size: 0.92rem;
}

.demo {
  text-align: center;
  padding: 0 0.5rem;
}

@media (max-width: 820px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .side {
    order: -1;
  }
}
</style>
