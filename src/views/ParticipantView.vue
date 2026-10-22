<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError } from '@/api'
import { useSessionStore } from '@/stores/session'
import type { Assignment, EventInfo, Me, Wish } from '@/types'
import GiftTag from '@/components/GiftTag.vue'
import WishList from '@/components/WishList.vue'
import WishlistEditor from '@/components/WishlistEditor.vue'
import KnitSock from '@/components/KnitSock.vue'
import RibbonBow from '@/components/RibbonBow.vue'
import StepGuide, { type GuideStep } from '@/components/StepGuide.vue'

const router = useRouter()
const session = useSessionStore()

const loading = ref(true)
const error = ref('')
const me = ref<Me | null>(null)
const event = ref<EventInfo | null>(null)
const assignment = ref<Assignment | null>(null)
const myWishes = ref<Wish[]>([])
const revealed = ref(false)
const saving = ref(false)
const saveError = ref('')
/** Ya ha descubierto alguna vez a su amigo invisible (se recuerda en este dispositivo). */
const revealedOnce = ref(false)
const editorDirty = ref(false)
const gifteeEl = ref<HTMLElement | null>(null)
const mineEl = ref<HTMLElement | null>(null)

const token = () => session.participantToken ?? ''

const revealKey = () => `amigo-invisible:revealed:${me.value?.id}`

function readRevealedOnce() {
  try {
    return localStorage.getItem(revealKey()) === '1'
  } catch {
    return false
  }
}

function toggleReveal() {
  revealed.value = !revealed.value
  if (revealed.value && !revealedOnce.value) {
    revealedOnce.value = true
    try {
      localStorage.setItem(revealKey(), '1')
    } catch {
      // sin almacenamiento: solo dura esta visita
    }
  }
}

// En el móvil las cajas van una debajo de otra; en pantalla grande, lado a lado.
const narrowQuery = window.matchMedia('(max-width: 760px)')
const isNarrow = ref(narrowQuery.matches)
const onNarrowChange = (e: MediaQueryListEvent) => (isNarrow.value = e.matches)
narrowQuery.addEventListener('change', onNarrowChange)
onUnmounted(() => narrowQuery.removeEventListener('change', onNarrowChange))

onMounted(async () => {
  try {
    const [meRes, assign, wishes] = await Promise.all([
      api.getMe(token()),
      api.getMyAssignment(token()),
      api.getMyWishlist(token()),
    ])
    me.value = meRes.me
    event.value = meRes.event
    assignment.value = assign
    myWishes.value = wishes
    revealedOnce.value = readRevealedOnce()
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return logout()
    error.value = e instanceof ApiError ? e.message : 'No hemos podido cargar tus datos.'
  } finally {
    loading.value = false
  }
})

async function saveWishes(wishes: Wish[]) {
  saving.value = true
  saveError.value = ''
  try {
    myWishes.value = await api.saveMyWishlist(token(), wishes)
  } catch (e) {
    saveError.value = e instanceof ApiError ? e.message : 'No se ha podido guardar. Prueba otra vez.'
  } finally {
    saving.value = false
  }
}

function logout() {
  session.participantToken = null
  router.replace({ name: 'home' })
}

// --- Guía paso a paso: qué tiene que hacer ahora y dónde ---

type Spot = 'giftee' | 'mine'

function where(spot: Spot) {
  if (spot === 'giftee') return isNarrow.value ? 'aquí abajo' : 'a la izquierda'
  return isNarrow.value ? 'más abajo' : 'a la derecha'
}

interface Guide {
  steps: GuideStep[]
  spot: Spot | null
  title: string
  text: string
  action?: string
}

const guide = computed<Guide>(() => {
  const drawDone = assignment.value !== null
  const hasList = myWishes.value.length > 0
  const steps: GuideStep[] = [
    { label: 'Descubre a quién regalas', state: !drawDone ? 'waiting' : revealedOnce.value ? 'done' : 'todo' },
    { label: 'Escribe tu lista', state: hasList && !editorDirty.value ? 'done' : 'todo' },
    { label: '¡Listo!', state: 'todo' },
  ]

  if (editorDirty.value) {
    steps[1]!.state = 'current'
    return {
      steps,
      spot: 'mine',
      title: 'Te falta guardar tu lista',
      text: `Pulsa el botón «Guardar mi lista», al final del recuadro «Tu lista de deseos» (${where('mine')}). Si no, lo que has escrito se perderá.`,
      action: 'Ir al botón de guardar',
    }
  }

  if (drawDone && !revealedOnce.value) {
    steps[0]!.state = 'current'
    return {
      steps,
      spot: 'giftee',
      title: 'Descubre a quién te toca regalar',
      text: `Toca la etiqueta azul del recuadro «Tu amigo invisible» (${where('giftee')}). Se dará la vuelta y verás el nombre. Mejor sin nadie mirando.`,
      action: 'Llévame a la etiqueta',
    }
  }

  if (!hasList) {
    steps[1]!.state = 'current'
    const before = drawDone
      ? 'Debajo del nombre de tu amigo invisible tienes su lista, para inspirarte. '
      : 'El sorteo aún no se ha hecho: cuando se haga, aquí verás a quién regalas. '
    return {
      steps,
      spot: 'mine',
      title: drawDone ? 'Ahora, escribe tu lista de deseos' : 'Mientras llega el sorteo, escribe tu lista',
      text: `${before}Ve al recuadro «Tu lista de deseos» (${where('mine')}) y apunta lo que te haría ilusión.`,
      action: 'Ir a mi lista',
    }
  }

  if (!drawDone) {
    return {
      steps,
      spot: null,
      title: 'Lista guardada. Ahora, a esperar el sorteo',
      text: 'Cuando se haga el sorteo, vuelve a entrar con el mismo enlace o código y aquí podrás descubrir a quién regalas. Mientras, puedes cambiar tu lista cuando quieras.',
    }
  }

  steps[2]!.state = 'done'
  return {
    steps,
    spot: null,
    title: '¡Todo listo!',
    text: 'Ya sabes a quién regalas y tu lista está guardada. Vuelve cuando quieras para cambiarla o para ver si tu amigo invisible ha añadido algo. Y recuerda: el secreto, secreto.',
  }
})

/** Lleva a la persona al sitio exacto y pone el cursor donde tiene que actuar. */
async function goToSpot() {
  const spot = guide.value.spot
  const section = spot === 'giftee' ? gifteeEl.value : spot === 'mine' ? mineEl.value : null
  if (!section) return
  section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  await nextTick()
  let target: HTMLElement | null = null
  if (spot === 'giftee') target = section.querySelector<HTMLElement>('.tag')
  else if (editorDirty.value) target = section.querySelector<HTMLElement>('.actions .btn-primary')
  else
    target =
      [...section.querySelectorAll<HTMLInputElement>('.wish-text')].find((i) => !i.value.trim()) ?? null
  target?.focus({ preventScroll: true })
}

const prettyDate = computed(() => {
  if (!event.value?.date) return ''
  const d = new Date(`${event.value.date}T12:00:00`)
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
})
</script>

<template>
  <p v-if="loading" class="loading">Desenredando las luces…</p>

  <div v-else-if="error" class="card">
    <p class="error">{{ error }}</p>
  </div>

  <div v-else-if="me && event" class="participant">
    <header class="hello">
      <div>
        <p class="eyebrow">{{ event.name }}</p>
        <h1 class="silver">Hola, <em>{{ me.name }}</em></h1>
        <p class="facts muted">
          <span v-if="event.budget">Presupuesto <b>{{ event.budget }}</b></span>
          <span v-if="prettyDate">Intercambio <b>{{ prettyDate }}</b></span>
        </p>
      </div>
      <button class="btn btn-ghost btn-sm" @click="logout">Salir</button>
    </header>

    <StepGuide
      :steps="guide.steps"
      :title="guide.title"
      :text="guide.text"
      :action-label="guide.action"
      @action="goToSpot"
    />

    <div class="columns">
      <!-- A quién regalo -->
      <section ref="gifteeEl" class="card giftee" :class="{ 'is-current': guide.spot === 'giftee' }">
        <span v-if="guide.spot === 'giftee'" class="here">Ahora aquí</span>
        <RibbonBow />
        <h2>Tu amigo invisible</h2>

        <template v-if="assignment">
          <GiftTag :name="assignment.name" :revealed="revealed" @toggle="toggleReveal" />
          <p class="hint muted">
            {{ revealed ? 'Vuelve a tocar la etiqueta para taparlo.' : 'Asegúrate de que no hay ningún cuñado mirando.' }}
          </p>

          <div v-if="revealed" class="their-list">
            <hr class="seam" />
            <h3>Lo que le haría ilusión</h3>
            <WishList v-if="assignment.wishlist.length" :wishes="assignment.wishlist" />
            <p v-else class="muted empty">
              Todavía no ha escrito su lista. Vuelve en unos días… o tira de imaginación (y de
              ticket regalo).
            </p>
          </div>
        </template>

        <div v-else class="waiting">
          <KnitSock :size="64" />
          <p class="waiting-title">El sorteo todavía no se ha hecho</p>
          <p class="muted">
            Mientras tanto, escribe tu lista. Quien te regale te lo agradecerá (y tú también, cuando
            no te toque otra colonia).
          </p>
        </div>
      </section>

      <!-- Mi lista -->
      <section ref="mineEl" class="card mine" :class="{ 'is-current': guide.spot === 'mine' }">
        <span v-if="guide.spot === 'mine'" class="here">Ahora aquí</span>
        <h2>Tu lista de deseos</h2>
        <p class="muted intro">
          Solo la verá quien te regale. Puedes añadir enlaces a la tienda para que no haya dudas.
        </p>
        <WishlistEditor
          :wishes="myWishes"
          :saving="saving"
          @save="saveWishes"
          @dirty="editorDirty = $event"
        />
        <p v-if="saveError" class="error">{{ saveError }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.loading {
  text-align: center;
  font-family: var(--font-display);
  font-style: italic;
  font-size: 1.8rem;
  color: var(--text-soft);
  padding-top: 3rem;
}

.hello {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2.25rem;
}

.hello .eyebrow {
  margin-bottom: 0.6rem;
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.75rem;
  margin-top: 0.75rem;
  font-size: 0.95rem;
}

.facts b {
  margin-left: 0.3rem;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 1.75rem;
  align-items: start;
}

.giftee {
  text-align: center;
}

.card {
  scroll-margin-top: 1.5rem;
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
}

/* la caja donde toca hacer algo ahora brilla un poco más */
.card.is-current {
  border-color: rgba(255, 255, 255, 0.65);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.25),
    0 0 34px rgba(190, 210, 255, 0.22),
    var(--shadow);
}

.here {
  position: absolute;
  top: -0.85rem;
  left: 1.25rem;
  z-index: 3;
  background: var(--satin);
  color: var(--night);
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.8rem;
  border-radius: 999px;
  box-shadow: 0 4px 14px -4px rgba(0, 0, 0, 0.6);
}

.hint {
  margin-top: 1.4rem;
  font-size: 0.92rem;
}

.their-list {
  text-align: left;
}

.their-list h3 {
  margin-bottom: 0.5rem;
}

.empty {
  font-style: italic;
}

.waiting {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  padding: 2rem 0.5rem 0.5rem;
}

.waiting-title {
  margin-top: 0.5rem;
  font-family: var(--font-display);
  font-size: 1.35rem;
  color: var(--white);
}

.mine .intro {
  margin: 0.5rem 0 0.5rem;
  font-size: 0.95rem;
}

@media (max-width: 760px) {
  .columns {
    grid-template-columns: 1fr;
  }

  /* deja sitio al lazo de la esquina */
  .giftee h2 {
    margin-top: 2.2rem;
  }
}
</style>
