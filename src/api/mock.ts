// Backend de mentira para desarrollar el front sin servidor.
// Guarda todo en el localStorage del navegador. NO es seguro: solo sirve para probar.

import { drawPairs, DrawError } from '@/lib/draw'
import type { AdminState, Wish } from '@/types'
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

interface Db {
  event: { name: string; budget: string; date: string; drawnAt: string | null }
  participants: DbParticipant[]
  /** giverId -> receiverId */
  pairs: Record<string, string>
}

const CODE_WORDS = [
  'ABETO', 'ACEBO', 'BELEN', 'CAMPANA', 'COMETA', 'ESTRELLA', 'MAZAPAN', 'MUERDAGO',
  'NIEVE', 'PASTOR', 'POLVORON', 'RENO', 'TRINEO', 'TURRON', 'VELA', 'ZAMBOMBA',
]

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

function seed(): Db {
  const names = ['Luna', 'Carlos', 'Abuela Carmen', 'Tío Paco', 'Marta']
  const participants: DbParticipant[] = []
  for (const name of names) {
    participants.push({
      id: newId(),
      name,
      code: newCode(participants.map((p) => p.code)),
      exclusions: [],
      wishlist: [],
      seenAt: null,
    })
  }
  participants[3]!.wishlist = [
    { id: newId(), text: 'Un buen jamón (o medio, no soy exigente)' },
    { id: newId(), text: 'Bufanda de lana gris', url: 'https://example.com/bufanda' },
  ]
  return {
    event: { name: 'Amigo invisible 2026', budget: '25 €', date: '2026-12-24', drawnAt: null },
    participants,
    pairs: {},
  }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Db
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

function adminState(db: Db): AdminState {
  return {
    event: { ...db.event, drawDone: db.event.drawnAt !== null },
    participants: db.participants.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      exclusions: p.exclusions,
      wishCount: p.wishlist.length,
      seenAt: p.seenAt,
    })),
  }
}

function participantFor(db: Db, token: string): DbParticipant {
  const p = db.participants.find((x) => `mock-${x.id}` === token)
  if (!p) throw new ApiError('Tu sesión ha caducado. Vuelve a entrar con tu código.', 401)
  return p
}

function requireAdmin(token: string) {
  if (token !== ADMIN_TOKEN) throw new ApiError('Solo quien organiza puede hacer esto.', 401)
}

export const mockApi: Api = {
  async loginWithCode(code) {
    await wait()
    const db = load()
    const clean = code.trim().toUpperCase().replace(/\s+/g, '-')
    const p = db.participants.find((x) => x.code === clean)
    if (!p) throw new ApiError('Ese código no nos suena. Revísalo o pídeselo a quien organiza.', 404)
    return { token: `mock-${p.id}` }
  },

  async getMe(token) {
    await wait()
    const db = load()
    const p = participantFor(db, token)
    return {
      me: { id: p.id, name: p.name },
      event: { ...db.event, drawDone: db.event.drawnAt !== null },
    }
  },

  async getMyAssignment(token) {
    await wait()
    const db = load()
    const p = participantFor(db, token)
    const receiverId = db.pairs[p.id]
    if (!receiverId) return null
    const receiver = db.participants.find((x) => x.id === receiverId)
    if (!receiver) return null
    if (!p.seenAt) {
      p.seenAt = new Date().toISOString()
      save(db)
    }
    return { name: receiver.name, wishlist: receiver.wishlist }
  },

  async getMyWishlist(token) {
    await wait()
    return participantFor(load(), token).wishlist
  },

  async saveMyWishlist(token, wishes) {
    await wait()
    const db = load()
    const p = participantFor(db, token)
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

  async getAdminState(token) {
    await wait()
    requireAdmin(token)
    return adminState(load())
  },

  async updateEvent(token, data) {
    await wait()
    requireAdmin(token)
    const db = load()
    db.event = { ...db.event, ...data }
    save(db)
    return adminState(db)
  },

  async addParticipant(token, name) {
    await wait()
    requireAdmin(token)
    const db = load()
    if (db.event.drawnAt) throw new ApiError('El sorteo ya está hecho. Anúlalo para añadir a alguien.')
    const clean = name.trim()
    if (!clean) throw new ApiError('Escribe un nombre.')
    if (db.participants.some((p) => p.name.toLowerCase() === clean.toLowerCase()))
      throw new ApiError(`Ya hay alguien llamado ${clean}.`)
    db.participants.push({
      id: newId(),
      name: clean,
      code: newCode(db.participants.map((p) => p.code)),
      exclusions: [],
      wishlist: [],
      seenAt: null,
    })
    save(db)
    return adminState(db)
  },

  async updateParticipant(token, id, data) {
    await wait()
    requireAdmin(token)
    const db = load()
    const p = db.participants.find((x) => x.id === id)
    if (!p) throw new ApiError('Esa persona ya no está en la lista.', 404)
    if (data.name !== undefined) p.name = data.name.trim() || p.name
    if (data.exclusions !== undefined) p.exclusions = data.exclusions.filter((x) => x !== id)
    save(db)
    return adminState(db)
  },

  async removeParticipant(token, id) {
    await wait()
    requireAdmin(token)
    const db = load()
    if (db.event.drawnAt) throw new ApiError('El sorteo ya está hecho. Anúlalo para quitar a alguien.')
    db.participants = db.participants.filter((p) => p.id !== id)
    for (const p of db.participants) p.exclusions = p.exclusions.filter((x) => x !== id)
    save(db)
    return adminState(db)
  },

  async runDraw(token) {
    await wait()
    requireAdmin(token)
    const db = load()
    try {
      db.pairs = drawPairs(db.participants)
    } catch (e) {
      if (e instanceof DrawError) throw new ApiError(e.message)
      throw e
    }
    db.event.drawnAt = new Date().toISOString()
    for (const p of db.participants) p.seenAt = null
    save(db)
    return adminState(db)
  },

  async resetDraw(token) {
    await wait()
    requireAdmin(token)
    const db = load()
    db.pairs = {}
    db.event.drawnAt = null
    for (const p of db.participants) p.seenAt = null
    save(db)
    return adminState(db)
  },
}
