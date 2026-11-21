import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const KEY = 'amigo-invisible:session'

function readParticipant(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw).participant ?? null
  } catch {
    // sin almacenamiento disponible
  }
  return null
}

/**
 * Tokens de sesión.
 * - El de participante se recuerda en este navegador: la gente vuelve durante semanas a mirar la lista.
 * - El de organización NO se guarda: vive solo en memoria y el router lo borra al salir de
 *   /organizar, así que la contraseña se pide cada vez que se entra (aunque sea en el mismo móvil).
 */
export const useSessionStore = defineStore('session', () => {
  const participantToken = ref<string | null>(readParticipant())
  const adminToken = ref<string | null>(null)

  // immediate: reescribe al arrancar, así desaparece el token de organización que guardaban
  // las versiones anteriores
  watch(
    participantToken,
    (participant) => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ participant }))
      } catch {
        // sin almacenamiento disponible
      }
    },
    { immediate: true },
  )

  return { participantToken, adminToken }
})
