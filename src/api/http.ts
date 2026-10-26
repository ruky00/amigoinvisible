// Implementación real: habla con la API que Carlos monte en Cloudflare.
// Los endpoints están descritos en API.md. La URL base sale de VITE_API_URL
// (vacía = mismo dominio, p. ej. Pages Functions en /api).

import type { AdminState, Assignment, EventInfo, EventSummary, Me, Wish } from '@/types'
import { ApiError, type Api } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function call<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let message = 'Algo ha fallado. Prueba otra vez en un momento.'
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // respuesta sin JSON
    }
    throw new ApiError(message, res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const ev = (eventId: string) => `/admin/events/${encodeURIComponent(eventId)}`

export const httpApi: Api = {
  loginWithCode: (code) => call('POST', '/login', undefined, { code }),
  getMe: (t) => call<{ me: Me; event: EventInfo }>('GET', '/me', t),
  getMyAssignment: (t) =>
    call<{ assignment: Assignment | null }>('GET', '/me/assignment', t).then((r) => r.assignment),
  getMyWishlist: (t) => call<{ wishes: Wish[] }>('GET', '/me/wishlist', t).then((r) => r.wishes),
  saveMyWishlist: (t, wishes) =>
    call<{ wishes: Wish[] }>('PUT', '/me/wishlist', t, { wishes }).then((r) => r.wishes),

  loginAdmin: (password) => call('POST', '/admin/login', undefined, { password }),
  listEvents: (t) => call<{ events: EventSummary[] }>('GET', '/admin/events', t).then((r) => r.events),
  createEvent: (t, data) => call<{ id: string }>('POST', '/admin/events', t, data),
  deleteEvent: (t, eventId) => call<void>('DELETE', ev(eventId), t),

  getAdminState: (t, eventId) => call<AdminState>('GET', ev(eventId), t),
  updateEvent: (t, eventId, data) => call<AdminState>('PATCH', ev(eventId), t, data),
  addParticipant: (t, eventId, name) =>
    call<AdminState>('POST', `${ev(eventId)}/participants`, t, { name }),
  updateParticipant: (t, eventId, id, data) =>
    call<AdminState>('PATCH', `${ev(eventId)}/participants/${encodeURIComponent(id)}`, t, data),
  removeParticipant: (t, eventId, id) =>
    call<AdminState>('DELETE', `${ev(eventId)}/participants/${encodeURIComponent(id)}`, t),
  runDraw: (t, eventId) => call<AdminState>('POST', `${ev(eventId)}/draw`, t),
  resetDraw: (t, eventId) => call<AdminState>('DELETE', `${ev(eventId)}/draw`, t),
}
