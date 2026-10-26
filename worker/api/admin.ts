// Rutas de la organización (API.md, "Organización"). Port de AdminLoginController, AdminEventService
// y AdminDrawService del backend Java. La sesión de organización ya la exige el router.

import { drawPairs, DrawError, type DrawPerson } from '../../src/lib/draw'
import {
  AUTH_MESSAGES,
  checkLoginAllowed,
  isAdminPassword,
  openAdminSession,
  recordLoginFailure,
} from './auth'
import { newParticipantCode } from './codes'
import {
  adminState,
  eventSummaries,
  participantsOf,
  PARTICIPANT_NOT_FOUND,
  requireEvent,
  EVENT_NOT_FOUND,
  type ParticipantRow,
} from './dto'
import type { Ctx } from './env'
import { ApiError, GENERIC, json, noContent, optionalString, readBody } from './http'
import type { Route } from './router'

const EVENT_NAME_MAX = 60
const BUDGET_MAX = 30
const PARTICIPANT_NAME_MAX = 40

const MSG = {
  EVENT_NAME_EMPTY: 'Ponle un nombre al sorteo.',
  EVENT_NAME_TOO_LONG: `El nombre del sorteo es demasiado largo (máximo ${EVENT_NAME_MAX} letras).`,
  BUDGET_TOO_LONG: `El presupuesto es demasiado largo (máximo ${BUDGET_MAX} letras).`,
  BAD_DATE: 'La fecha no es válida.',
  ADD_WHEN_DRAWN: 'El sorteo ya está hecho. Anúlalo para añadir a alguien.',
  REMOVE_WHEN_DRAWN: 'El sorteo ya está hecho. Anúlalo para quitar a alguien.',
  NAME_EMPTY: 'Escribe un nombre.',
  NAME_TOO_LONG: `El nombre es demasiado largo (máximo ${PARTICIPANT_NAME_MAX} letras).`,
  NAME_TAKEN: (name: string) => `Ya hay alguien llamado ${name} en este sorteo.`,
  NOT_IN_EVENT: 'Esa persona no está en este sorteo.',
} as const

// --- Login ---

async function login(ctx: Ctx): Promise<Response> {
  // Como en Java, el cuerpo se lee antes de mirar el limitador (JSON roto -> 400 siempre)
  const body = await readBody(ctx.request)
  await checkLoginAllowed(ctx)
  if (!(await isAdminPassword(ctx.env, body.password))) {
    await recordLoginFailure(ctx)
    throw ApiError.unauthorized(AUTH_MESSAGES.WRONG_PASSWORD)
  }
  return json({ token: await openAdminSession(ctx) })
}

// --- Sorteos ---

async function listEvents(ctx: Ctx): Promise<Response> {
  return json({ events: await eventSummaries(ctx.env.DB) })
}

async function createEvent(ctx: Ctx): Promise<Response> {
  const draft = cleanDraft(await readBody(ctx.request))
  const id = crypto.randomUUID()
  await ctx.env.DB.prepare(
    'INSERT INTO draw_event (id, name, budget, exchange_date, drawn_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
  )
    .bind(id, draft.name, draft.budget, draft.date, ctx.now.toISOString())
    .run()
  return json({ id })
}

async function getEvent(ctx: Ctx): Promise<Response> {
  return json(await adminState(ctx.env.DB, ctx.params.eventId!))
}

async function updateEvent(ctx: Ctx): Promise<Response> {
  const db = ctx.env.DB
  const eventId = ctx.params.eventId!
  const body = await readBody(ctx.request)
  await requireEvent(db, eventId)
  const draft = cleanDraft(body)
  await db
    .prepare('UPDATE draw_event SET name = ?, budget = ?, exchange_date = ? WHERE id = ?')
    .bind(draft.name, draft.budget, draft.date, eventId)
    .run()
  return json(await adminState(db, eventId))
}

/** Participantes, exclusiones, deseos, parejas y sesiones caen por los ON DELETE CASCADE. */
async function deleteEvent(ctx: Ctx): Promise<Response> {
  const result = await ctx.env.DB.prepare('DELETE FROM draw_event WHERE id = ?')
    .bind(ctx.params.eventId!)
    .run()
  if (result.meta.changes === 0) throw ApiError.notFound(EVENT_NOT_FOUND)
  return noContent()
}

// --- Participantes ---

async function addParticipant(ctx: Ctx): Promise<Response> {
  const db = ctx.env.DB
  const eventId = ctx.params.eventId!
  const rawName = optionalString(await readBody(ctx.request), 'name')
  const event = await requireEvent(db, eventId)
  if (event.drawn_at !== null) throw ApiError.badRequest(MSG.ADD_WHEN_DRAWN)
  const name = participantName(rawName)
  if (name === '') throw ApiError.badRequest(MSG.NAME_EMPTY)
  const people = await participantsOf(db, eventId)
  requireFreeName(people, name, null)
  const code = await newParticipantCode(db)

  // La hora de alta va siempre después de la del anterior, para que el orden de la lista sea estable
  let createdAt = ctx.now
  const last = people.at(-1)
  if (last && createdAt.getTime() <= Date.parse(last.created_at)) {
    createdAt = new Date(Date.parse(last.created_at) + 1)
  }

  await db
    .prepare(
      `INSERT INTO participant (id, event_id, name, code, receiver_id, seen_at, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
    )
    .bind(crypto.randomUUID(), eventId, name, code, createdAt.toISOString())
    .run()
  return json(await adminState(db, eventId))
}

async function updateParticipant(ctx: Ctx): Promise<Response> {
  const db = ctx.env.DB
  const eventId = ctx.params.eventId!
  const participantId = ctx.params.id!
  const body = await readBody(ctx.request)
  const rawName = optionalString(body, 'name')
  const rawExclusions = exclusionList(body)

  await requireEvent(db, eventId)
  const people = await participantsOf(db, eventId)
  const self = people.find((p) => p.id === participantId)
  if (!self) throw ApiError.notFound(PARTICIPANT_NOT_FOUND)

  // Se valida todo antes de escribir nada: un fallo en las exclusiones no deja el nombre cambiado
  const writes: D1PreparedStatement[] = []
  if (rawName !== undefined) {
    const name = participantName(rawName)
    // como en el mock: un nombre en blanco deja el que había
    if (name !== '') {
      requireFreeName(people, name, self.id)
      writes.push(db.prepare('UPDATE participant SET name = ? WHERE id = ?').bind(name, self.id))
    }
  }

  if (rawExclusions !== undefined) {
    const inEvent = new Set(people.map((p) => p.id))
    const clean = new Set<string>()
    for (const id of rawExclusions) {
      if (id === null || id === self.id) continue
      if (!inEvent.has(id)) throw ApiError.badRequest(MSG.NOT_IN_EVENT)
      clean.add(id)
    }
    writes.push(
      db.prepare('DELETE FROM participant_exclusion WHERE participant_id = ?').bind(self.id),
    )
    // adminState las lee por rowid: se insertan en el orden recibido
    for (const id of clean) {
      writes.push(
        db
          .prepare('INSERT INTO participant_exclusion (participant_id, excluded_id) VALUES (?, ?)')
          .bind(self.id, id),
      )
    }
  }

  if (writes.length > 0) await db.batch(writes)
  return json(await adminState(db, eventId))
}

/** Sus exclusiones, las que otros tenían hacia él, sus deseos y sus sesiones caen por la BD. */
async function removeParticipant(ctx: Ctx): Promise<Response> {
  const db = ctx.env.DB
  const eventId = ctx.params.eventId!
  const event = await requireEvent(db, eventId)
  if (event.drawn_at !== null) throw ApiError.badRequest(MSG.REMOVE_WHEN_DRAWN)
  const result = await db
    .prepare('DELETE FROM participant WHERE id = ? AND event_id = ?')
    .bind(ctx.params.id!, eventId)
    .run()
  if (result.meta.changes === 0) throw ApiError.notFound(PARTICIPANT_NOT_FOUND)
  return json(await adminState(db, eventId))
}

// --- Sorteo ---

/**
 * Reparte (o vuelve a repartir) las parejas. El reparto se calcula entero antes de tocar nada
 * y se guarda en un solo batch (una transacción), así un fallo no deja el sorteo a medias.
 */
async function runDraw(ctx: Ctx): Promise<Response> {
  const db = ctx.env.DB
  const eventId = ctx.params.eventId!
  await requireEvent(db, eventId)
  const [people, exclusions] = await Promise.all([
    participantsOf(db, eventId),
    db
      .prepare(
        `SELECT x.participant_id, x.excluded_id FROM participant_exclusion x
         JOIN participant p ON p.id = x.participant_id
         WHERE p.event_id = ? ORDER BY x.rowid`,
      )
      .bind(eventId)
      .all<{ participant_id: string; excluded_id: string }>(),
  ])

  const excluded = new Map<string, string[]>()
  for (const x of exclusions.results) {
    const list = excluded.get(x.participant_id) ?? []
    list.push(x.excluded_id)
    excluded.set(x.participant_id, list)
  }
  const persons: DrawPerson[] = people.map((p) => ({
    id: p.id,
    exclusions: excluded.get(p.id) ?? [],
  }))

  let pairs: Record<string, string>
  try {
    pairs = drawPairs(persons)
  } catch (e) {
    if (e instanceof DrawError) throw ApiError.badRequest(e.message)
    throw e
  }

  await db.batch([
    // sorteo nuevo: nadie ha visto todavía a quién le toca
    ...people.map((p) =>
      db
        .prepare('UPDATE participant SET receiver_id = ?, seen_at = NULL WHERE id = ?')
        .bind(pairs[p.id]!, p.id),
    ),
    db
      .prepare('UPDATE draw_event SET drawn_at = ? WHERE id = ?')
      .bind(ctx.now.toISOString(), eventId),
  ])
  return json(await adminState(db, eventId))
}

/** Anula el sorteo: fuera parejas y "visto"; las listas de deseos se quedan. */
async function resetDraw(ctx: Ctx): Promise<Response> {
  const db = ctx.env.DB
  const eventId = ctx.params.eventId!
  await requireEvent(db, eventId)
  await db.batch([
    db
      .prepare('UPDATE participant SET receiver_id = NULL, seen_at = NULL WHERE event_id = ?')
      .bind(eventId),
    db.prepare('UPDATE draw_event SET drawn_at = NULL WHERE id = ?').bind(eventId),
  ])
  return json(await adminState(db, eventId))
}

// --- Validación ---

interface CleanDraft {
  name: string
  budget: string
  date: string | null
}

function cleanDraft(body: Record<string, unknown>): CleanDraft {
  const name = (optionalString(body, 'name') ?? '').trim()
  if (name === '') throw ApiError.badRequest(MSG.EVENT_NAME_EMPTY)
  if (name.length > EVENT_NAME_MAX) throw ApiError.badRequest(MSG.EVENT_NAME_TOO_LONG)
  const budget = (optionalString(body, 'budget') ?? '').trim()
  if (budget.length > BUDGET_MAX) throw ApiError.badRequest(MSG.BUDGET_TOO_LONG)
  return { name, budget, date: exchangeDate(optionalString(body, 'date')) }
}

/** "" o null = sin fecha; si no, YYYY-MM-DD de un día que exista (Java: LocalDate.parse, estricto). */
function exchangeDate(raw: string | undefined): string | null {
  const value = raw?.trim() ?? ''
  if (value === '') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw ApiError.badRequest(MSG.BAD_DATE)
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw ApiError.badRequest(MSG.BAD_DATE)
  }
  return value
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return leap ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** Recorta y comprueba la longitud; el vacío lo decide cada caso (añadir falla, editar lo ignora). */
function participantName(raw: string | undefined): string {
  const name = (raw ?? '').trim()
  if (name.length > PARTICIPANT_NAME_MAX) throw ApiError.badRequest(MSG.NAME_TOO_LONG)
  return name
}

/**
 * Nombres únicos dentro del sorteo sin distinguir mayúsculas ("luna" choca con "Luna").
 * El índice NOCASE de la BD solo entiende ASCII ("Ángel"/"ángel"), por eso se mira aquí.
 */
function requireFreeName(people: ParticipantRow[], name: string, selfId: string | null): void {
  const wanted = name.toLowerCase()
  if (people.some((p) => p.id !== selfId && p.name.toLowerCase() === wanted)) {
    throw ApiError.badRequest(MSG.NAME_TAKEN(name))
  }
}

/** exclusions del PATCH: undefined si no viene (no se tocan); si viene, lista de ids (o null). */
function exclusionList(body: Record<string, unknown>): (string | null)[] | undefined {
  const value = body.exclusions
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value) || value.some((id) => id !== null && typeof id !== 'string')) {
    throw ApiError.badRequest(GENERIC.BAD_REQUEST)
  }
  return value as (string | null)[]
}

const EVENT = '/api/admin/events/:eventId'

export const adminRoutes: Route[] = [
  { method: 'POST', path: '/api/admin/login', handler: login },
  { method: 'GET', path: '/api/admin/events', handler: listEvents },
  { method: 'POST', path: '/api/admin/events', handler: createEvent },
  { method: 'GET', path: EVENT, handler: getEvent },
  { method: 'PATCH', path: EVENT, handler: updateEvent },
  { method: 'DELETE', path: EVENT, handler: deleteEvent },
  { method: 'POST', path: `${EVENT}/participants`, handler: addParticipant },
  { method: 'PATCH', path: `${EVENT}/participants/:id`, handler: updateParticipant },
  { method: 'DELETE', path: `${EVENT}/participants/:id`, handler: removeParticipant },
  { method: 'POST', path: `${EVENT}/draw`, handler: runDraw },
  { method: 'DELETE', path: `${EVENT}/draw`, handler: resetDraw },
]
