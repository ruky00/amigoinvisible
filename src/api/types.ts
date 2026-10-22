import type { AdminState, Assignment, EventDraft, EventInfo, EventSummary, Me, Wish } from '@/types'

/**
 * Todo lo que el front necesita del backend.
 * Hay dos implementaciones: `mock.ts` (guarda en localStorage, para desarrollar sin backend)
 * y `http.ts` (llama a la API real de Cloudflare). Se elige en `api/index.ts`.
 *
 * Puede haber varios sorteos a la vez, cada uno con sus propios participantes.
 * El código de un participante identifica a la persona Y a su sorteo, así que quien
 * esté en dos sorteos tiene dos códigos distintos.
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

  // --- Organización: los sorteos ---
  loginAdmin(password: string): Promise<{ token: string }>
  listEvents(token: string): Promise<EventSummary[]>
  /** Crea un sorteo vacío y devuelve su id */
  createEvent(token: string, data: EventDraft): Promise<{ id: string }>
  /** Borra el sorteo con todos sus participantes, listas y parejas */
  deleteEvent(token: string, eventId: string): Promise<void>

  // --- Organización: dentro de un sorteo ---
  getAdminState(token: string, eventId: string): Promise<AdminState>
  updateEvent(token: string, eventId: string, data: EventDraft): Promise<AdminState>
  addParticipant(token: string, eventId: string, name: string): Promise<AdminState>
  updateParticipant(
    token: string,
    eventId: string,
    id: string,
    data: { name?: string; exclusions?: string[] },
  ): Promise<AdminState>
  removeParticipant(token: string, eventId: string, id: string): Promise<AdminState>
  runDraw(token: string, eventId: string): Promise<AdminState>
  resetDraw(token: string, eventId: string): Promise<AdminState>
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}
