// Sesiones (tokens Bearer) de participantes y de organización, y el limitador de intentos de login.

import type { Ctx, Env } from './env'
import { ApiError } from './http'

/** Cuánto dura una sesión: los participantes vuelven durante semanas a mirar la lista. */
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000

/** Intentos fallidos de login permitidos por IP dentro de la ventana. */
const MAX_LOGIN_FAILURES = 10
const LOGIN_WINDOW_MS = 10 * 60 * 1000

export const AUTH_MESSAGES = {
  PARTICIPANT_EXPIRED: 'Tu sesión ha caducado. Vuelve a entrar con tu código.',
  ADMIN_ONLY: 'Solo quien organiza puede hacer esto.',
  WRONG_PASSWORD: 'Contraseña incorrecta.',
  TOO_MANY: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
} as const

// --- Sesiones ---

export async function openParticipantSession(ctx: Ctx, participantId: string): Promise<string> {
  return openSession(ctx, participantId, false)
}

export async function openAdminSession(ctx: Ctx): Promise<string> {
  return openSession(ctx, null, true)
}

async function openSession(
  ctx: Ctx,
  participantId: string | null,
  admin: boolean,
): Promise<string> {
  const token = newToken()
  const expires = new Date(ctx.now.getTime() + SESSION_TTL_MS)
  await ctx.env.DB.prepare(
    'INSERT INTO app_session (token, participant_id, admin, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(token, participantId, admin ? 1 : 0, ctx.now.toISOString(), expires.toISOString())
    .run()
  return token
}

interface SessionRow {
  participant_id: string | null
  admin: number
}

async function validSession(ctx: Ctx): Promise<SessionRow | null> {
  const token = bearerToken(ctx.request.headers.get('Authorization'))
  if (!token) return null
  return ctx.env.DB.prepare(
    'SELECT participant_id, admin FROM app_session WHERE token = ? AND expires_at > ?',
  )
    .bind(token, ctx.now.toISOString())
    .first<SessionRow>()
}

/**
 * Exige una sesión de participante válida y devuelve el id del participante (o 401).
 * Ojo: el participante puede haber sido borrado después; quien lo cargue debe responder 401
 * con AUTH_MESSAGES.PARTICIPANT_EXPIRED si ya no existe.
 */
export async function requireParticipant(ctx: Ctx): Promise<string> {
  const session = await validSession(ctx)
  if (!session || session.admin || !session.participant_id) {
    throw ApiError.unauthorized(AUTH_MESSAGES.PARTICIPANT_EXPIRED)
  }
  return session.participant_id
}

/** Exige una sesión de organización válida (o 401). */
export async function requireAdmin(ctx: Ctx): Promise<void> {
  const session = await validSession(ctx)
  if (!session || !session.admin) throw ApiError.unauthorized(AUTH_MESSAGES.ADMIN_ONLY)
}

export function bearerToken(header: string | null): string | null {
  if (!header || header.slice(0, 7).toLowerCase() !== 'bearer ') return null
  const token = header.slice(7).trim()
  return token === '' ? null : token
}

/** 32 bytes aleatorios en base64url sin relleno (43 caracteres), como en el backend Java. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Compara en tiempo constante para no dar pistas por lo que tarda la respuesta.
 * Sin secreto ADMIN_PASSWORD configurado nadie puede entrar como organización.
 */
export async function isAdminPassword(env: Env, candidate: unknown): Promise<boolean> {
  const expected = env.ADMIN_PASSWORD
  if (!expected) {
    console.error('Falta el secreto ADMIN_PASSWORD: nadie puede entrar en /organizar.')
    return false
  }
  if (typeof candidate !== 'string') return false
  const encoder = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  return crypto.subtle.timingSafeEqual(a, b)
}

// --- Limitador de intentos de login ---
// Los códigos son cortos a propósito (fáciles de dictar): esto es lo que evita que alguien
// los adivine probando. Uso en un login:
//   await checkLoginAllowed(ctx)
//   if (fallo) { await recordLoginFailure(ctx); throw ... }

/** Lanza 429 si esa IP ya ha fallado demasiadas veces en la ventana. */
export async function checkLoginAllowed(ctx: Ctx): Promise<void> {
  const since = new Date(ctx.now.getTime() - LOGIN_WINDOW_MS).toISOString()
  const row = await ctx.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM login_failure WHERE ip = ? AND failed_at >= ?',
  )
    .bind(ctx.ip, since)
    .first<{ n: number }>()
  if ((row?.n ?? 0) >= MAX_LOGIN_FAILURES) throw new ApiError(429, AUTH_MESSAGES.TOO_MANY)
}

export async function recordLoginFailure(ctx: Ctx): Promise<void> {
  await ctx.env.DB.prepare('INSERT INTO login_failure (ip, failed_at) VALUES (?, ?)')
    .bind(ctx.ip, ctx.now.toISOString())
    .run()
}

/** Limpieza diaria (cron de wrangler.jsonc): sesiones caducadas e intentos fuera de la ventana. */
export async function purgeExpired(env: Env, now: Date): Promise<void> {
  const loginLimit = new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString()
  await env.DB.batch([
    env.DB.prepare('DELETE FROM app_session WHERE expires_at <= ?').bind(now.toISOString()),
    env.DB.prepare('DELETE FROM login_failure WHERE failed_at < ?').bind(loginLimit),
  ])
}
