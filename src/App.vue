<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import StarrySky from '@/components/StarrySky.vue'
import BaubleGarland from '@/components/BaubleGarland.vue'
import { usingMock } from '@/api'

// "Letra grande": agranda toda la app y se recuerda en este dispositivo.
const BIG_TEXT_KEY = 'amigo-invisible:big-text'

function readBigText() {
  try {
    return localStorage.getItem(BIG_TEXT_KEY) === '1'
  } catch {
    return false
  }
}

const bigText = ref(readBigText())

watchEffect(() => {
  document.documentElement.classList.toggle('big-text', bigText.value)
  try {
    localStorage.setItem(BIG_TEXT_KEY, bigText.value ? '1' : '0')
  } catch {
    // sin almacenamiento: dura hasta recargar
  }
})
</script>

<template>
  <StarrySky />
  <div class="shell">
    <header class="top">
      <RouterLink to="/" class="brand">
        <span class="brand-mark">✦</span>
        <span class="brand-name">Amigo <em>invisible</em></span>
      </RouterLink>

      <button
        type="button"
        class="btn btn-ghost btn-sm text-size"
        :aria-pressed="bigText"
        @click="bigText = !bigText"
      >
        <span class="aa" aria-hidden="true">A<span>A</span></span>
        {{ bigText ? 'Letra normal' : 'Letra grande' }}
      </button>
    </header>

    <div class="garland-wrap">
      <BaubleGarland />
    </div>

    <main class="page">
      <RouterView />
    </main>

    <footer class="foot">
      <p>Hecho en casa · Prohibido regalar calcetines (salvo emergencia)</p>
      <span v-if="usingMock" class="mock-badge" title="Los datos se guardan solo en este navegador">
        modo pruebas
      </span>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  max-width: 1020px;
  width: 100%;
  margin: 0 auto;
  padding: 1.4rem 1rem 0;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: var(--white);
}

.brand-mark {
  font-size: 1rem;
  color: var(--silver);
  text-shadow: 0 0 10px rgba(220, 230, 255, 0.9);
}

.brand-name {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.02em;
}

.brand-name em {
  font-weight: 300;
}

.text-size {
  position: relative;
  z-index: 1;
}

.aa {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.85em;
}

.aa span {
  font-size: 1.35em;
}

.garland-wrap {
  width: 100%;
  max-width: 1020px;
  margin: 0 auto;
  padding: 0 1rem;
}

.page {
  flex: 1;
  width: 100%;
  max-width: 1020px;
  margin: 0 auto;
  padding: 0.75rem 1rem 3rem;
}

.foot {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
  padding: 1.5rem 1rem 2.2rem;
  color: var(--silver-deep);
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  text-align: center;
}

.mock-badge {
  font-size: 0.9rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  border: 1px dashed var(--stitch);
  color: var(--silver);
  border-radius: 999px;
  padding: 0.18rem 0.7rem;
}

@media (max-width: 600px) {
  .brand-name {
    font-size: 1.3rem;
  }

  .page {
    padding-top: 0.5rem;
  }
}
</style>
