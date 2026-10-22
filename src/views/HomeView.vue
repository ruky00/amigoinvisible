<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { api, ApiError } from '@/api'
import { useSessionStore } from '@/stores/session'
import RibbonBow from '@/components/RibbonBow.vue'

const router = useRouter()
const session = useSessionStore()

const code = ref('')
const error = ref('')
const loading = ref(false)

async function enter() {
  if (!code.value.trim()) {
    error.value = 'Escribe el código que te han pasado.'
    return
  }
  error.value = ''
  loading.value = true
  try {
    const { token } = await api.loginWithCode(code.value)
    session.participantToken = token
    router.push({ name: 'participant' })
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Algo ha fallado. Prueba otra vez.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="home">
    <div class="intro">
      <p class="eyebrow">Navidad en familia</p>
      <h1 class="silver">¿A quién te toca <em>regalar</em> este año?</h1>
      <p class="lead muted">
        Descubre a tu amigo invisible, cotillea su lista de deseos y escribe la tuya. Sin papelitos
        perdidos y sin que el primo haga trampas.
      </p>
      <ol class="steps">
        <li><span class="num">I</span> Entra con tu código</li>
        <li><span class="num">II</span> Descubre a quién regalas</li>
        <li><span class="num">III</span> Escribe tu lista de deseos</li>
      </ol>
    </div>

    <form class="card ticket" @submit.prevent="enter">
      <RibbonBow />
      <h2>Tu código</h2>
      <ol class="how">
        <li>
          <span class="k">1</span>
          <span>Busca el mensaje que te ha mandado quien organiza (seguramente por WhatsApp).</span>
        </li>
        <li>
          <span class="k">2</span>
          <span>
            Si trae un enlace, púlsalo y entrarás solo. Si no, copia aquí abajo tu código: una
            palabra y un número, como <b>NIEVE-42</b>.
          </span>
        </li>
        <li>
          <span class="k">3</span>
          <span>Pulsa el botón «Entrar».</span>
        </li>
      </ol>
      <div>
        <label for="code" class="sr">Código</label>
        <input
          id="code"
          v-model="code"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="NIEVE-42"
          class="code-input"
        />
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="btn btn-primary wide" :disabled="loading">
        {{ loading ? 'Abriendo…' : 'Entrar' }}
      </button>
      <p class="admin-link">
        <RouterLink to="/organizar">Soy quien organiza</RouterLink>
      </p>
    </form>
  </section>
</template>

<style scoped>
.home {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 3.5rem;
  align-items: center;
  padding-top: 2rem;
}

.intro .eyebrow {
  margin-bottom: 1rem;
}

.intro h1 {
  max-width: 13ch;
}

.lead {
  margin-top: 1.25rem;
  font-size: 1.08rem;
  max-width: 31rem;
}

.steps {
  list-style: none;
  padding: 0;
  margin: 2.25rem 0 0;
  display: grid;
  gap: 0.75rem;
}

.steps li {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  color: var(--text);
}

.num {
  display: inline-grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  border: 1px dashed var(--stitch);
  color: var(--silver);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 0.95rem;
}

.ticket {
  display: grid;
  gap: 1rem;
  padding: 2.25rem 2rem 1.75rem;
}

.how {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
  color: var(--text-soft);
  font-size: 0.97rem;
}

.how li {
  display: flex;
  gap: 0.7rem;
  align-items: baseline;
}

.k {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 50%;
  border: 1px dashed var(--stitch);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--white);
}

.small {
  font-size: 0.95rem;
}

.code-input {
  font-family: var(--font-display);
  font-size: 1.7rem;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-align: center;
  padding: 0.75rem;
}

.wide {
  width: 100%;
  padding: 0.85rem;
  font-size: 1.02rem;
}

.admin-link {
  text-align: center;
  font-size: 0.9rem;
}

.admin-link a {
  color: var(--text-soft);
}

.admin-link a:hover {
  color: var(--white);
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (max-width: 760px) {
  .home {
    grid-template-columns: 1fr;
    gap: 2.25rem;
    padding-top: 0.5rem;
  }

  .ticket {
    padding: 2rem 1.25rem 1.5rem;
  }
}
</style>
