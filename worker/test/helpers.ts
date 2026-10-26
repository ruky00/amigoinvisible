// Utilidades compartidas de los tests: peticiones HTTP al Worker (como el front, src/api/http.ts)
// y atajos para montar sorteos a través de la propia API.

import { exports } from 'cloudflare:workers'
import { expect } from 'vitest'
import type { AdminState } from '../../src/types'

export const ADMIN_PASSWORD = 'turron'

/** Mensajes que comprueban varios archivos de tests (los mismos textos que el backend Java). */
export const MSG = {
  NOT_FOUND: 'Esa dirección no existe.',
  ADMIN_ONLY: 'Solo quien organiza puede hacer esto.',
  SESSION_EXPIRED: 'Tu sesión ha caducado. Vuelve a entrar con tu código.',
  WRONG_PASSWORD: 'Contraseña incorrecta.',
  TOO_MANY: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  EVENT_NOT_FOUND: 'Ese sorteo ya no existe.',
  PARTICIPANT_NOT_FOUND: 'Esa persona ya no está en la lista.',
} as const

// El cuerpo de las respuestas se explora a mano en cada test, como el jsonPath de los tests Java
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any

export interface ApiResponse {
  status: number
  headers: Headers
  /** Cuerpo tal cual (para comprobar que algo no aparece en ningún sitio) */
  text: string
  /** Cuerpo JSON, o undefined si no hay cuerpo */
  body: Json
}

export interface CallOptions {
  /** Token de sesión: se manda como "Bearer <token>" */
  token?: string
  /** Cabecera Authorization tal cual (gana a token) */
  authorization?: string
  /** Cuerpo: se manda como JSON */
  body?: unknown
  /** Cuerpo en crudo (gana a body), para mandar JSON roto */
  rawBody?: string
  /** IP del visitante (CF-Connecting-IP): el limitador de logins cuenta por IP */
  ip?: string
}

let ipSeq = 0

/** Una IP distinta en cada llamada (documentación, 198.51.100.0/24 y siguientes). */
export function freshIp(): string {
  ipSeq++
  return `198.51.${100 + Math.floor(ipSeq / 250)}.${ipSeq % 250}`
}

const DEFAULT_IP = '203.0.113.7'

/** Petición al Worker entero (worker/index.ts), igual que llegaría desde el navegador. */
export async function call(
  method: string,
  path: string,
  options: CallOptions = {},
): Promise<ApiResponse> {
  const headers = new Headers({ 'CF-Connecting-IP': options.ip ?? DEFAULT_IP })
  const authorization =
    options.authorization ?? (options.token ? `Bearer ${options.token}` : undefined)
  if (authorization !== undefined) headers.set('Authorization', authorization)
  let body: string | undefined
  if (options.rawBody !== undefined || options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = options.rawBody ?? JSON.stringify(options.body)
  }
  const res = await exports.default.fetch(`http://localhost${path}`, { method, headers, body })
  const text = await res.text()
  let parsed: Json
  if (text !== '' && (res.headers.get('Content-Type') ?? '').includes('application/json')) {
    parsed = JSON.parse(text)
  }
  return { status: res.status, headers: res.headers, text, body: parsed }
}

/** Comprueba un error de la API: código HTTP y { error: mensaje } exacto. */
export function expectError(res: ApiResponse, status: number, message?: string): void {
  expect(res.status, res.text).toBe(status)
  if (message === undefined) expect(typeof res.body?.error).toBe('string')
  else expect(res.body).toEqual({ error: message })
}

/** Comprueba un 200 y devuelve el cuerpo. */
export function ok(res: ApiResponse): Json {
  expect(res.status, res.text).toBe(200)
  return res.body
}

// --- Organización ---

export async function adminLogin(ip?: string): Promise<string> {
  const body = ok(
    await call('POST', '/api/admin/login', { body: { password: ADMIN_PASSWORD }, ip }),
  )
  expect(body.token).toEqual(expect.any(String))
  return body.token
}

export interface EventDraftInput {
  name: string | null
  budget: string | null
  date: string | null
}

/** Cuerpo { name, budget, date } con null donde haga falta (como draft() del test Java). */
export function draft(
  name: string | null,
  budget: string | null,
  date: string | null,
): EventDraftInput {
  return { name, budget, date }
}

/** Crea un sorteo y devuelve su id. */
export async function createEvent(
  token: string,
  name: string | null,
  budget: string | null = '',
  date: string | null = '',
): Promise<string> {
  const body = ok(
    await call('POST', '/api/admin/events', { token, body: draft(name, budget, date) }),
  )
  expect(body.id).toEqual(expect.any(String))
  return body.id
}

/** Añade a alguien y devuelve su id (el último de la lista, que tiene que ser él). */
export async function addParticipant(
  token: string,
  eventId: string,
  name: string,
): Promise<string> {
  const state: AdminState = ok(
    await call('POST', `/api/admin/events/${eventId}/participants`, { token, body: { name } }),
  )
  const last = state.participants.at(-1)!
  expect(last.name).toBe(name.trim())
  return last.id
}

export async function getState(token: string, eventId: string): Promise<AdminState> {
  return ok(await call('GET', `/api/admin/events/${eventId}`, { token }))
}

// --- Participantes ---

/** Entra con un código y devuelve el token de participante. */
export async function participantLogin(code: string, ip?: string): Promise<string> {
  const body = ok(await call('POST', '/api/login', { body: { code }, ip }))
  expect(body.token).toEqual(expect.any(String))
  return body.token
}

/** Código de un participante, leído de la vista de organización. */
export async function codeOf(
  token: string,
  eventId: string,
  participantId: string,
): Promise<string> {
  const state = await getState(token, eventId)
  return state.participants.find((p) => p.id === participantId)!.code
}
