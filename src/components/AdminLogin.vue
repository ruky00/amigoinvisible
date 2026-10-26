<script setup lang="ts">
// Acceso a la zona de organización. Al entrar guarda el token en la sesión.
import { ref } from 'vue'
import { api, ApiError } from '@/api'
import { useSessionStore } from '@/stores/session'
import HangingBauble from '@/components/HangingBauble.vue'
import RibbonBow from '@/components/RibbonBow.vue'

const emit = defineEmits<{ done: [] }>()
const session = useSessionStore()

const password = ref('')
const error = ref('')
const busy = ref(false)

async function login() {
  error.value = ''
  busy.value = true
  try {
    const { token } = await api.loginAdmin(password.value)
    session.adminToken = token
    password.value = ''
    emit('done')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se ha podido entrar.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="login">
    <form class="card stack" @submit.prevent="login">
      <RibbonBow />
      <HangingBauble :size="40" :sway="false" />
      <h2>Zona de <em>organización</em></h2>
      <p class="muted">Aquí se montan los sorteos y se mezclan los papelitos.</p>
      <div>
        <label for="pw">Contraseña</label>
        <input id="pw" v-model="password" type="password" autocomplete="current-password" />
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" :disabled="busy || !password">Entrar</button>
    </form>
  </section>
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
</style>
