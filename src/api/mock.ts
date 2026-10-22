// Backend de mentira para desarrollar el front sin servidor.
// Guarda todo en el localStorage del navegador. NO es seguro: solo sirve para probar.

import { drawPairs, DrawError } from '@/lib/draw'
import type { AdminState, EventInfo, EventSummary, Wish } from '@/types'
import { ApiError, type Api } from './types'

/** Contraseña de organización en modo de pruebas (solo existe en este mock). */
export const MOCK_ADMIN_PASSWORD = 'turron'

const STORAGE_KEY = 'amigo-invisible:mock-db'
const ADMIN_TOKEN = 'mock-admin'

interface DbParticipant {
  id: string
  name: string
  code: string
  exclusions: string[]
  wishlist: Wish[]
  seenAt: string | null
}

interface DbEvent {
  id: string
  name: string
  budget: string
  date: string
  drawnAt: string | null
  createdAt: string
  participants: DbParticipant[]
  /** giverId -> receiverId */
  pairs: Record<string, string>
}

interface Db {
  events: DbEvent[]
}

/** Formato antiguo (un solo sorteo), para no perder los datos de prueba que ya hubiera. */
interface OldDb {
  event: { name: string; budget: string; date: string; drawnAt: string | null }
  participants: DbParticipant[]
  pairs: Record<string, string>
}

const CODE_WORDS = [
  'ABETO', 'ACEBO', 'BELEN', 'CAMPANA', 'COMETA', 'ESTRELLA', 'MAZAPAN', 'MUERDAGO',
  'NIEVE', 'PASTOR', 'POLVORON', 'RENO', 'TRINEO', 'TURRON', 'VELA', 'ZAMBOMBA',
]

/** Todos los códigos de todos los sorteos: tienen que ser únicos entre sí. */
function allCodes(db: Db): string[] {
  return db.events.flatMap((e) => e.participants.map((p) => p.code))
}

function newCode(existing: string[]): string {
  let code: string
  do {
    const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)]
    const num = String(Math.floor(Math.random() * 90) + 10)
    code = `${word}-${num}`
  } while (existing.includes(code))
  return code
}

function newId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function newParticipant(name: string, existingCodes: string[]): DbParticipant {
  return { id: newId(), name, code: newCode(existingCodes), exclusions: [], wishlist: [], seenAt: null }
}

function newEvent(name: string, budget: string, date: string): DbEvent {
  return {
    id: newId(),
    name,
    budget,
    date,
    drawnAt: null,
    createdAt: new Date().toISOString(),
    participants: [],
    pairs: {},
  }
}

function seed(): Db {
  const db: Db = { events: [] }

  const family = newEvent('Papá Noel · Familia', '25 €', '2026-12-24')
  db.events.push(family)
  for (const name of ['Luna', 'Carlos', 'Abuela Carmen', 'Tío Paco', 'Marta'])
    family.participants.push(newParticipant(name, allCodes(db)))
  family.participants[3]!.wishlist = [
    { id: newId(), text: 'Un buen jamón (o medio, no soy exigente)' },
    { id: newId(), text: 'Bufanda de lana gris', url: 'https://example.com/bufanda' },
  ]

  const team = newEvent('Camisetas raras · Equipo', '15 €', '2026-12-19')
  db.events.push(team)
  for (const name of ['Luna', 'Dani', 'Irene', 'Rober'])
    team.participants.push(newParticipant(name, allCodes(db)))

  return db
}

function migrate(old: OldDb): Db {
  const ev = newEvent(old.event.name, old.event.budget, old.event.date)
  ev.drawnAt = old.event.drawnAt
  ev.participants = old.participants
  ev.pairs = old.pairs
  return { events: [ev] }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as Db | OldDb
      if ('events' in data) return data
      const db = migrate(data)
      save(db)
      return db
    }
  } catch {
    // datos corruptos o localStorage bloqueado: empezamos de cero
  }
  const db = seed()
  save(db)
  return db
}

function save(db: Db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // sin almacenamiento: los cambios duran hasta recargar
  }
}

/** Borra los datos de prueba y vuelve a los de ejemplo. */
export function resetMockDb() {
  save(seed())
}

const wait = () => new Promise((r) => setTimeout(r, 250 + Math.random() * 250))

function eventInfo(e: DbEvent): EventInfo {
  return {
    id: e.id,
    name: e.name,
    budget: e.budget,
    date: e.date,
    drawnAt: e.drawnAt,
    drawDone: e.drawnAt !== null,
  }
}

function summary(e: DbEvent): EventSummary {
  return {
    ...eventInfo(e),
    participantCount: e.participants.length,
    wishlistCount: e.participants.filter((p) => p.wishlist.length > 0).length,
    seenCount: e.participants.filter((p) => p.seenAt).length,
  }
}

function adminState(e: DbEvent): AdminState {
  return {
    event: eventInfo(e),
    participants: e.participants.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      exclusions: p.exclusions,
      wishCount: p.wishlist.length,
      seenAt: p.seenAt,
    })),
  }
}

/** Encuentra al participante (y su sorteo) a partir del token de sesión. */
function participantFor(db: Db, token: string): { event: DbEvent; p: DbParticipant } {
  for (const event of db.events) {
    const p = event.participants.find((x) => `mock-${x.id}` === token)
    if (p) return { event, p }
  }
  throw new ApiError('Tu sesión ha caducado. Vuelve a entrar con tu código.', 401)
}

function requireAdmin(token: string) {
  if (token !== ADMIN_TOKEN) throw new ApiError('Solo quien organiza puede hacer esto.', 401)
}

function eventFor(db: Db, eventId: string): DbEvent {
  const e = db.events.find((x) => x.id === eventId)
  if (!e) throw new ApiError('Ese sorteo ya no existe.', 404)
  return e
}

function cleanDraft(data: { name: string; budget: string; date: string }) {
  const name = data.name.trim()
  if (!name) throw new ApiError('Ponle un nombre al sorteo.')
  return { name, budget: data.budget.trim(), date: data.date }
}

export const mockApi: Api = {
  async loginWithCode(code) {
    await wait()
    const db = load()
    const clean = code.trim().toUpperCase().replace(/\s+/g, '-')
    for (const event of db.events) {
      const p = event.participants.find((x) => x.code === clean)
      if (p) return { token: `mock-${p.id}` }
    }
    throw new ApiError('Ese código no nos suena. Revísalo o pídeselo a quien organiza.', 404)
  },

  async getMe(token) {
    await wait()
    const { event, p } = participantFor(load(), token)
    return { me: { id: p.id, name: p.name }, event: eventInfo(event) }
  },

  async getMyAssignment(token) {
    await wait()
    const db = load()
    const { event, p } = participantFor(db, token)
    const receiverId = event.pairs[p.id]
    if (!receiverId) return null
    const receiver = event.participants.find((x) => x.id === receiverId)
    if (!receiver) return null
    if (!p.seenAt) {
      p.seenAt = new Date().toISOString()
      save(db)
    }
    return { name: receiver.name, wishlist: receiver.wishlist }
  },

  async getMyWishlist(token) {
    await wait()
    return participantFor(load(), token).p.wishlist
  },

  async saveMyWishlist(token, wishes) {
    await wait()
    const db = load()
    const { p } = participantFor(db, token)
    p.wishlist = wishes
      .map((w) => ({ id: w.id || newId(), text: w.text.trim(), url: w.url?.trim() || undefined }))
      .filter((w) => w.text)
    save(db)
    return p.wishlist
  },

  async loginAdmin(password) {
    await wait()
    if (password !== MOCK_ADMIN_PASSWORD) throw new ApiError('Contraseña incorrecta.', 401)
    return { token: ADMIN_TOKEN }
  },

  async listEvents(token) {
    await wait()
    requireAdmin(token)
    // los más nuevos primero
    return [...load().events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summary)
  },

  async createEvent(token, data) {
    await wait()
    requireAdmin(token)
    const db = load()
    const draft = cleanDraft(data)
    const e = newEvent(draft.name, draft.budget, draft.date)
    db.events.push(e)
    save(db)
    return { id: e.id }
  },

  async deleteEvent(token, eventId) {
    await wait()
    requireAdmin(token)
    const db = load()
    eventFor(db, eventId)
    db.events = db.events.filter((e) => e.id !== eventId)
    save(db)
  },

  async getAdminState(token, eventId) {
    await wait()
    requireAdmin(token)
    return adminState(eventFor(load(), eventId))
  },

  async updateEvent(token, eventId, data) {
    await wait()
    requireAdmin(token)
    const db = load()
    const e = eventFor(db, eventId)
    Object.assign(e, cleanDraft(data))
    save(db)
    return adminState(e)
  },

  async addParticipant(token, eventId, name) {
    await wait()
    requireAdmin(token)
    const db = load()
    const e = eventFor(db, eventId)
    if (e.drawnAt) throw new ApiError('El sorteo ya está hecho. Anúlalo para añadir a alguien.')
    const clean = name.trim()
    if (!clean) throw new ApiError('Escribe un nombre.')
    if (e.participants.some((p) => p.name.toLowerCase() === clean.toLowerCase()))
      throw new ApiError(`Ya hay alguien llamado ${clean} en este sorteo.`)
    e.participants.push(newParticipant(clean, allCodes(db)))
    save(db)
    return adminState(e)
  },

  async updateParticipant(token, eventId, id, data) {
    await wait()
    requireAdmin(token)
    const db = load()
    const e = eventFor(db, eventId)
    const p = e.participants.find((x) => x.id === id)
    if (!p) throw new ApiError('Esa persona ya no está en la lista.', 404)
    if (data.name !== undefined) p.name = data.name.trim() || p.name
    if (data.exclusions !== undefined) p.exclusions = data.exclusions.filter((x) => x !== id)
    save(db)
    return adminState(e)
  },

  async removeParticipant(token, eventId, id) {
    await wait()
    requireAdmin(token)
    const db = load()
    const e = eventFor(db, eventId)
    if (e.drawnAt) throw new ApiError('El sorteo ya está hecho. Anúlalo para quitar a alguien.')
    e.participants = e.participants.filter((p) => p.id !== id)
    for (const p of e.participants) p.exclusions = p.exclusions.filter((x) => x !== id)
    save(db)
    return adminState(e)
  },

  async runDraw(token, eventId) {
    await wait()
    requireAdmin(token)
    const db = load()
    const e = eventFor(db, eventId)
    try {
      e.pairs = drawPairs(e.participants)
    } catch (err) {
      if (err instanceof DrawError) throw new ApiError(err.message)
      throw err
    }
    e.drawnAt = new Date().toISOString()
    for (const p of e.participants) p.seenAt = null
    save(db)
    return adminState(e)
  },

  async resetDraw(token, eventId) {
    await wait()
    requireAdmin(token)
    const db = load()
    const e = eventFor(db, eventId)
    e.pairs = {}
    e.drawnAt = null
    for (const p of e.participants) p.seenAt = null
    save(db)
    return adminState(e)
  },
}
