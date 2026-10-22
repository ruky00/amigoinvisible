<script setup lang="ts">
// Entrada directa desde el enlace personal (/entrar/NIEVE-42).
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '@/api'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const error = ref('')

onMounted(async () => {
  try {
    const { token } = await api.loginWithCode(String(route.params.code))
    session.participantToken = token
    router.replace({ name: 'participant' })
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Algo ha fallado. Prueba otra vez.'
  }
})
</script>

<template>
  <section class="enter">
    <template v-if="error">
      <h2>Vaya…</h2>
      <p class="muted">{{ error }}</p>
      <RouterLink to="/" class="btn btn-ghost">Escribir el código a mano</RouterLink>
    </template>
    <p v-else class="loading">Abriendo tu sobre…</p>
  </section>
</template>

<style scoped>
.enter {
  display: grid;
  justify-items: center;
  gap: 1rem;
  text-align: center;
  padding-top: 3rem;
}

.loading {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 1.8rem;
  color: var(--text-soft);
}
</style>
