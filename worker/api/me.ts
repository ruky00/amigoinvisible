// Rutas del participante (API.md, "Participantes"): entrar con su código, ver su sorteo, ver a quién
// regala y editar su lista. Nunca devuelve nada de otros participantes salvo el nombre y la lista de
// la persona a la que regala. Traducción de MeService/MeController/ParticipantLoginController.

import type { Assignment, Wish } from '../../src/types'
import {
  AUTH_MESSAGES,
  checkLoginAllowed,
  openParticipantSession,
  recordLoginFailure,
  requireParticipant,
} from './auth'
import { eventInfo, requireEvent, wish, wishesOf, type ParticipantRow } from './dto'
import type { Ctx } from './env'
import { ApiError, GENERIC, json, optionalString, readBody } from './http'
import type { Route } from './router'

export const UNKNOWN_CODE = 'Ese código no nos suena. Revísalo o pídeselo a quien organiza.'
export const TEXT_TOO_LONG = 'Cada deseo puede tener como mucho 200 letras.'
export const TOO_MANY_WISHES = 'Como mucho 30 deseos. ¡Deja algo para el año que viene!'
export const BAD_URL = 'Ese enlace no parece válido. Cópialo entero desde la tienda.'

const MAX_WISHES = 30
const TEXT_MAX = 200
const URL_MAX = 2000

/** El \s de Java (sin UNICODE_CHARACTER_CLASS): solo espacios ASCII */
const WHITESPACE = /[ \t\n\v\f\r]+/g

/** "  nieve 42 " → "NIEVE-42": así se puede dictar el código sin preocuparse del formato. */
export function normalizeCode(code: string | undefined): string {
  if (code === undefined) return ''
  return code.trim().toUpperCase().replace(WHITESPACE, '-')
}

// --- Login ---

async function login(ctx: Ctx): Promise<Response> {
  const code = normalizeCode(optionalString(await readBody(ctx.request), 'code'))
  await checkLoginAllowed(ctx)
  const row =
    code === ''
      ? null
      : await ctx.env.DB.prepare('SELECT id FROM participant WHERE code = ?')
          .bind(code)
          .first<{ id: string }>()
  if (!row) {
    // cada código fallido cuenta: es lo que impide adivinarlos probando
    await recordLoginFailure(ctx)
    throw ApiError.notFound(UNKNOWN_CODE)
  }
  return json({ token: await openParticipantSession(ctx, row.id) })
}

// --- Con sesión ---

/** El token puede sobrevivir a su participante (si la organización lo borra): se trata como sesión caducada. */
async function load(ctx: Ctx, participantId: string): Promise<ParticipantRow> {
  const row = await ctx.env.DB.prepare('SELECT * FROM participant WHERE id = ?')
    .bind(participantId)
    .first<ParticipantRow>()
  if (!row) throw ApiError.unauthorized(AUTH_MESSAGES.PARTICIPANT_EXPIRED)
  return row
}

async function me(ctx: Ctx): Promise<Response> {
  const p = await load(ctx, await requireParticipant(ctx))
  const event = await requireEvent(ctx.env.DB, p.event_id)
  return json({ me: { id: p.id, name: p.name }, event: eventInfo(event) })
}

/** null mientras no haya sorteo. La primera vez que se enseña, apunta seen_at ("Ha entrado"). */
async function assignment(ctx: Ctx): Promise<Response> {
  const db = ctx.env.DB
  const p = await load(ctx, await requireParticipant(ctx))
  const event = await requireEvent(db, p.event_id)
  if (event.drawn_at === null || p.receiver_id === null) return json({ assignment: null })

  const receiver = await db
    .prepare('SELECT name FROM participant WHERE id = ?')
    .bind(p.receiver_id)
    .first<{ name: string }>()
  if (!receiver) return json({ assignment: null })

  if (p.seen_at === null) {
    // "AND seen_at IS NULL": si llegan dos peticiones a la vez se queda la primera hora
    await db
      .prepare('UPDATE participant SET seen_at = ? WHERE id = ? AND seen_at IS NULL')
      .bind(ctx.now.toISOString(), p.id)
      .run()
  }
  const result: Assignment = { name: receiver.name, wishlist: await wishesOf(db, p.receiver_id) }
  return json({ assignment: result })
}

async function wishlist(ctx: Ctx): Promise<Response> {
  const p = await load(ctx, await requireParticipant(ctx))
  return json({ wishes: await wishesOf(ctx.env.DB, p.id) })
}

interface IncomingWish {
  id?: string
  text?: string
  url?: string
}

/** { wishes: [...] } tal cual llega; falta o null → lista vacía. Tipos que no cuadran → 400. */
function incomingWishes(body: Record<string, unknown>): (IncomingWish | null)[] {
  const list = body.wishes
  if (list === undefined || list === null) return []
  if (!Array.isArray(list)) throw ApiError.badRequest(GENERIC.BAD_REQUEST)
  return list.map((item: unknown) => {
    if (item === null) return null
    if (typeof item !== 'object' || Array.isArray(item)) {
      throw ApiError.badRequest(GENERIC.BAD_REQUEST)
    }
    const w = item as Record<string, unknown>
    return {
      id: optionalString(w, 'id'),
      text: optionalString(w, 'text'),
      url: optionalString(w, 'url'),
    }
  })
}

/**
 * Sustituye la lista entera. Los deseos vacíos se descartan; los que ya existían conservan
 * su id (si de verdad son de esta persona) y los nuevos reciben uno.
 */
async function saveWishlist(ctx: Ctx): Promise<Response> {
  const db = ctx.env.DB
  const participantId = await requireParticipant(ctx)
  const incoming = incomingWishes(await readBody(ctx.request))
  const p = await load(ctx, participantId)

  const clean: { id: string | undefined; text: string; url: string | null }[] = []
  for (const w of incoming) {
    if (w === null) continue
    const text = (w.text ?? '').trim()
    if (text === '') continue
    if (text.length > TEXT_MAX) throw ApiError.badRequest(TEXT_TOO_LONG)
    clean.push({ id: w.id, text, url: cleanUrl(w.url) })
  }
  if (clean.length > MAX_WISHES) throw ApiError.badRequest(TOO_MANY_WISHES)

  const { results } = await db
    .prepare('SELECT id FROM wish WHERE participant_id = ?')
    .bind(p.id)
    .all<{ id: string }>()
  const ownIds = new Set(results.map((r) => r.id))
  const used = new Set<string>()
  const saved: Wish[] = []
  const inserts = clean.map((w, i) => {
    // un id ajeno o repetido no se respeta: así nadie toca deseos de otra persona
    const keep = w.id !== undefined && ownIds.has(w.id) && !used.has(w.id)
    const id = keep ? w.id! : crypto.randomUUID()
    used.add(id)
    saved.push(wish({ id, participant_id: p.id, sort_order: i, wish_text: w.text, url: w.url }))
    return db
      .prepare(
        'INSERT INTO wish (id, participant_id, sort_order, wish_text, url) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(id, p.id, i, w.text, w.url)
  })

  // Un batch es una sola transacción: o se cambia la lista entera o no se toca nada
  await db.batch([db.prepare('DELETE FROM wish WHERE participant_id = ?').bind(p.id), ...inserts])
  return json({ wishes: saved })
}

// --- Enlaces ---

/** Vacía → null. Si hay algo, tiene que ser un enlace http(s) completo. */
function cleanUrl(url: string | undefined): string | null {
  const trimmed = (url ?? '').trim()
  if (trimmed === '') return null
  if (trimmed.length > URL_MAX || !isWebLink(trimmed)) throw ApiError.badRequest(BAD_URL)
  return trimmed
}

// Imitan lo que aceptaba java.net.URI (más estricto que new URL(), que lo arregla todo por su cuenta):
// sin espacios ni caracteres prohibidos, "%" solo como escape, un único "#", y un host de verdad.
const URI_ILLEGAL = /[\s\u0000-\u001f\u007f-\u009f"<>\\^`{|}]|%(?![0-9a-f]{2})|#.*#/i
const WEB_LINK = /^https?:\/\/(?:[^@/?#]*@)?([^/?#]+?)(?::\d*)?(?:[/?#]|$)/i
const LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const IPV6 = /^\[[0-9a-f:.]+\]$/i

function isWebLink(url: string): boolean {
  if (URI_ILLEGAL.test(url)) return false
  const host = WEB_LINK.exec(url)?.[1]
  return host !== undefined && (IPV4.test(host) || IPV6.test(host) || isHostname(host))
}

/** Etiquetas alfanuméricas con guiones por dentro; si hay varias, la última empieza por letra. */
function isHostname(host: string): boolean {
  const labels = host.replace(/\.$/, '').split('.')
  return (
    labels.every((l) => LABEL.test(l)) && (labels.length === 1 || /^[a-z]/i.test(labels.at(-1)!))
  )
}

export const meRoutes: Route[] = [
  { method: 'POST', path: '/api/login', handler: login },
  { method: 'GET', path: '/api/me', handler: me },
  { method: 'GET', path: '/api/me/assignment', handler: assignment },
  { method: 'GET', path: '/api/me/wishlist', handler: wishlist },
  { method: 'PUT', path: '/api/me/wishlist', handler: saveWishlist },
]
