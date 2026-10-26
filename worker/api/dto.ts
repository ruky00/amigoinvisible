// Lecturas de D1 convertidas a los tipos que espera el front (src/types.ts).
// Es el único sitio donde se decide el formato de fechas y nulos de la API:
//   - fecha de intercambio: "YYYY-MM-DD" o "" si no hay
//   - instantes (drawnAt, seenAt): ISO-8601 en UTC o null
//   - url de un deseo: se omite si no hay

import type { AdminParticipant, AdminState, EventInfo, EventSummary, Wish } from '../../src/types'
import { ApiError } from './http'

export const EVENT_NOT_FOUND = 'Ese sorteo ya no existe.'
export const PARTICIPANT_NOT_FOUND = 'Esa persona ya no está en la lista.'

// --- Filas tal cual salen de D1 ---

export interface EventRow {
  id: string
  name: string
  budget: string
  exchange_date: string | null
  drawn_at: string | null
  created_at: string
}

export interface ParticipantRow {
  id: string
  event_id: string
  name: string
  code: string
  receiver_id: string | null
  seen_at: string | null
  created_at: string
}

export interface WishRow {
  id: string
  participant_id: string
  sort_order: number
  wish_text: string
  url: string | null
}

// --- Conversión ---

export function eventInfo(e: EventRow): EventInfo {
  return {
    id: e.id,
    name: e.name,
    budget: e.budget,
    date: e.exchange_date ?? '',
    drawDone: e.drawn_at !== null,
    drawnAt: e.drawn_at,
  }
}

export function wish(w: WishRow): Wish {
  return w.url ? { id: w.id, text: w.wish_text, url: w.url } : { id: w.id, text: w.wish_text }
}

// --- Consultas ---

/** El sorteo o 404 (EVENT_NOT_FOUND). */
export async function requireEvent(db: D1Database, eventId: string): Promise<EventRow> {
  const row = await db
    .prepare('SELECT * FROM draw_event WHERE id = ?')
    .bind(eventId)
    .first<EventRow>()
  if (!row) throw ApiError.notFound(EVENT_NOT_FOUND)
  return row
}

/** Participantes de un sorteo en el orden de la lista (por alta). */
export async function participantsOf(db: D1Database, eventId: string): Promise<ParticipantRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM participant WHERE event_id = ? ORDER BY created_at ASC, id ASC')
    .bind(eventId)
    .all<ParticipantRow>()
  return results
}

/** Lista de deseos de una persona, en su orden. */
export async function wishesOf(db: D1Database, participantId: string): Promise<Wish[]> {
  const { results } = await db
    .prepare('SELECT * FROM wish WHERE participant_id = ? ORDER BY sort_order ASC')
    .bind(participantId)
    .all<WishRow>()
  return results.map(wish)
}

/** Todo lo que ve la organización de un sorteo (o 404). Nunca incluye las parejas. */
export async function adminState(db: D1Database, eventId: string): Promise<AdminState> {
  const [events, people, exclusions, wishCounts] = await db.batch([
    db.prepare('SELECT * FROM draw_event WHERE id = ?').bind(eventId),
    db
      .prepare('SELECT * FROM participant WHERE event_id = ? ORDER BY created_at ASC, id ASC')
      .bind(eventId),
    db
      .prepare(
        `SELECT x.participant_id, x.excluded_id FROM participant_exclusion x
         JOIN participant p ON p.id = x.participant_id
         WHERE p.event_id = ? ORDER BY x.rowid`,
      )
      .bind(eventId),
    db
      .prepare(
        `SELECT w.participant_id, COUNT(*) AS n FROM wish w
         JOIN participant p ON p.id = w.participant_id
         WHERE p.event_id = ? GROUP BY w.participant_id`,
      )
      .bind(eventId),
  ])
  const event = events!.results[0] as EventRow | undefined
  if (!event) throw ApiError.notFound(EVENT_NOT_FOUND)

  const excluded = new Map<string, string[]>()
  for (const x of exclusions!.results as { participant_id: string; excluded_id: string }[]) {
    const list = excluded.get(x.participant_id) ?? []
    list.push(x.excluded_id)
    excluded.set(x.participant_id, list)
  }
  const counts = new Map<string, number>()
  for (const c of wishCounts!.results as { participant_id: string; n: number }[]) {
    counts.set(c.participant_id, c.n)
  }

  const participants: AdminParticipant[] = (people!.results as ParticipantRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    exclusions: excluded.get(p.id) ?? [],
    wishCount: counts.get(p.id) ?? 0,
    seenAt: p.seen_at,
  }))
  return { event: eventInfo(event), participants }
}

/** "Mis sorteos": los más recientes primero, con sus contadores. */
export async function eventSummaries(db: D1Database): Promise<EventSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT e.*,
         (SELECT COUNT(*) FROM participant p WHERE p.event_id = e.id) AS participant_count,
         (SELECT COUNT(*) FROM participant p WHERE p.event_id = e.id
            AND EXISTS (SELECT 1 FROM wish w WHERE w.participant_id = p.id)) AS wishlist_count,
         (SELECT COUNT(*) FROM participant p WHERE p.event_id = e.id AND p.seen_at IS NOT NULL) AS seen_count
       FROM draw_event e
       ORDER BY e.created_at DESC, e.id DESC`,
    )
    .all<EventRow & { participant_count: number; wishlist_count: number; seen_count: number }>()
  return results.map((r) => ({
    ...eventInfo(r),
    participantCount: r.participant_count,
    wishlistCount: r.wishlist_count,
    seenCount: r.seen_count,
  }))
}
