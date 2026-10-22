import type { AdminState, Assignment, EventInfo, Me, Wish } from '@/types'

/**
 * Todo lo que el front necesita del backend.
 * Hay dos implementaciones: `mock.ts` (guarda en localStorage, para desarrollar sin backend)
 * y `http.ts` (llama a la API real de Cloudflare). Se elige en `api/index.ts`.
 *
 * El token devuelto en los login se guarda en el navegador y se manda en cada llamada.
 * La regla de privacidad (cada persona solo ve su amigo invisible) la tiene que
 * garantizar el backend: el front solo pide "lo mío".
 */
export interface Api {
  // --- Participantes ---
  /** Entra con el código personal que le pasa quien organiza. Devuelve un token de sesión. */
  loginWithCode(code: string): Promise<{ token: string }>
  getMe(token: string): Promise<{ me: Me; event: EventInfo }>
  /** null si el sorteo aún no se ha hecho */
  getMyAssignment(token: string): Promise<Assignment | null>
  getMyWishlist(token: string): Promise<Wish[]>
  saveMyWishlist(token: string, wishes: Wish[]): Promise<Wish[]>

  // --- Organización ---
  loginAdmin(password: string): Promise<{ token: string }>
  getAdminState(token: string): Promise<AdminState>
  updateEvent(token: string, data: Pick<EventInfo, 'name' | 'budget' | 'date'>): Promise<AdminState>
  addParticipant(token: string, name: string): Promise<AdminState>
  updateParticipant(
    token: string,
    id: string,
    data: { name?: string; exclusions?: string[] },
  ): Promise<AdminState>
  removeParticipant(token: string, id: string): Promise<AdminState>
  runDraw(token: string): Promise<AdminState>
  resetDraw(token: string): Promise<AdminState>
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}
