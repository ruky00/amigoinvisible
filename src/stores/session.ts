import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const KEY = 'amigo-invisible:session'

function read(): { participant: string | null; admin: string | null } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // sin almacenamiento disponible
  }
  return { participant: null, admin: null }
}

/** Tokens de sesión de participante y de organización, recordados en este navegador. */
export const useSessionStore = defineStore('session', () => {
  const initial = read()
  const participantToken = ref<string | null>(initial.participant)
  const adminToken = ref<string | null>(initial.admin)

  watch([participantToken, adminToken], ([participant, admin]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ participant, admin }))
    } catch {
      // sin almacenamiento disponible
    }
  })

  return { participantToken, adminToken }
})
