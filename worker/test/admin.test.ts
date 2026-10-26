// La zona de organización de punta a punta: HTTP, Worker y D1. Port de AdminApiTest.java.
// Diferencias con Java: la contraseña de los tests es "turron" (vitest.config.ts) en vez de
// "test-admin", y las sesiones de participante se abren entrando con su código por /api/login
// (en Java se pedían directamente a AuthService).

import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  addParticipant,
  ADMIN_PASSWORD,
  adminLogin,
  call,
  type CallOptions,
  codeOf,
  createEvent,
  draft,
  expectError,
  getState,
  MSG,
  ok,
  participantLogin,
} from './helpers'

const CODE_PATTERN = /^[A-Z]+-\d{2,3}$/

let token: string

beforeEach(async () => {
  token = await adminLogin()
})

/** Petición con la sesión de organización. */
const auth = (method: string, path: string, options: CallOptions = {}) =>
  call(method, path, { token, ...options })

async function expect400(
  method: string,
  path: string,
  body: unknown,
  error: string,
): Promise<void> {
  expectError(await auth(method, path, body === undefined ? {} : { body }), 400, error)
}

async function receiverOf(participantId: string): Promise<string | null | undefined> {
  const row = await env.DB.prepare('SELECT receiver_id FROM participant WHERE id = ?')
    .bind(participantId)
    .first<{ receiver_id: string | null }>()
  return row === null ? undefined : row.receiver_id
}

async function participantExists(participantId: string): Promise<boolean> {
  return (await receiverOf(participantId)) !== undefined
}

/** Simula que alguien rellena su lista y abre su sobre (eso lo hace la parte de participantes). */
async function giveWishesAndSee(participantId: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM wish WHERE participant_id = ?').bind(participantId),
    env.DB.prepare(
      "INSERT INTO wish (id, participant_id, sort_order, wish_text, url) VALUES (?, ?, 0, 'Calcetines', NULL)",
    ).bind(crypto.randomUUID(), participantId),
    env.DB.prepare('UPDATE participant SET seen_at = ? WHERE id = ?').bind(
      new Date().toISOString(),
      participantId,
    ),
  ])
}

// --- Login y protección ---

describe('login y protección', () => {
  it('con la contraseña buena da un token', async () => {
    const body = ok(await call('POST', '/api/admin/login', { body: { password: ADMIN_PASSWORD } }))
    expect(body.token).toEqual(expect.any(String))
  })

  it('con la contraseña mala es 401', async () => {
    expectError(
      await call('POST', '/api/admin/login', { body: { password: 'polvoron' } }),
      401,
      MSG.WRONG_PASSWORD,
    )
    expect((await call('POST', '/api/admin/login', { body: {} })).status).toBe(401)
  })

  it('todas las rutas de organización exigen un token de organización', async () => {
    const eventId = await createEvent(token, 'Protegido', '', '')
    const pid = await addParticipant(token, eventId, 'Alguien')
    const participantToken = await participantLogin(await codeOf(token, eventId, pid))
    const base = `/api/admin/events/${eventId}`
    const calls: [string, string][] = [
      ['GET', '/api/admin/events'],
      ['POST', '/api/admin/events'],
      ['GET', base],
      ['PATCH', base],
      ['DELETE', base],
      ['POST', `${base}/participants`],
      ['PATCH', `${base}/participants/${pid}`],
      ['DELETE', `${base}/participants/${pid}`],
      ['POST', `${base}/draw`],
      ['DELETE', `${base}/draw`],
    ]
    // sin token, token inventado, token de participante y token de admin con otro esquema
    const headers = [
      undefined,
      `Bearer ${crypto.randomUUID()}`,
      `Bearer ${participantToken}`,
      `Basic ${token}`,
    ]
    for (const authorization of headers) {
      for (const [method, path] of calls) {
        const res = await call(method, path, {
          authorization,
          body: method === 'GET' ? undefined : {},
        })
        expect(res.status, `${method} ${path} con ${authorization}`).toBe(401)
        expect(res.body.error).toEqual(expect.any(String))
      }
    }
    // y el sorteo sigue ahí
    expect((await auth('GET', base)).status).toBe(200)
  })
})

// --- Sorteos ---

describe('sorteos', () => {
  it('crear, listar, ver, editar y borrar un sorteo', async () => {
    const older = await createEvent(token, '  Cena de empresa  ', ' 20 € ', '2026-12-20')
    const newer = await createEvent(token, 'Amigos del barrio', null, null)

    const ids: string[] = ok(await auth('GET', '/api/admin/events')).events.map(
      (e: { id: string }) => e.id,
    )
    expect(ids).toContain(older)
    expect(ids).toContain(newer)
    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older))

    const state = ok(await auth('GET', `/api/admin/events/${older}`))
    expect(state.event).toEqual({
      id: older,
      name: 'Cena de empresa',
      budget: '20 €',
      date: '2026-12-20',
      drawDone: false,
      drawnAt: null,
    })
    expect(state.participants).toHaveLength(0)
    const newerState = ok(await auth('GET', `/api/admin/events/${newer}`))
    expect(newerState.event.budget).toBe('')
    expect(newerState.event.date).toBe('')

    const patched = ok(
      await auth('PATCH', `/api/admin/events/${older}`, { body: draft('Cena', '30 €', '') }),
    )
    expect(patched.event.name).toBe('Cena')
    expect(patched.event.budget).toBe('30 €')
    expect(patched.event.date).toBe('')

    const deleted = await auth('DELETE', `/api/admin/events/${older}`)
    expect(deleted.status).toBe(204)
    expect(deleted.text).toBe('')
    expectError(await auth('GET', `/api/admin/events/${older}`), 404, MSG.EVENT_NOT_FOUND)
    expect((await auth('DELETE', `/api/admin/events/${older}`)).status).toBe(404)
    expect(
      (await auth('PATCH', `/api/admin/events/${older}`, { body: draft('X', '', '') })).status,
    ).toBe(404)
  })

  it('valida los datos del sorteo', async () => {
    const path = '/api/admin/events'
    await expect400('POST', path, draft('   ', '', ''), 'Ponle un nombre al sorteo.')
    await expect400('POST', path, {}, 'Ponle un nombre al sorteo.')
    await expect400(
      'POST',
      path,
      draft('x'.repeat(61), '', ''),
      'El nombre del sorteo es demasiado largo (máximo 60 letras).',
    )
    await expect400(
      'POST',
      path,
      draft('Ok', 'x'.repeat(31), ''),
      'El presupuesto es demasiado largo (máximo 30 letras).',
    )
    await expect400('POST', path, draft('Ok', '', '24/12/2026'), 'La fecha no es válida.')
    await expect400('POST', path, draft('Ok', '', '2026-02-30'), 'La fecha no es válida.')
    await createEvent(token, 'x'.repeat(60), 'x'.repeat(30), '2026-12-24')
  })

  it('borrar un sorteo borra todo lo que tiene dentro', async () => {
    const eventId = await createEvent(token, 'Para borrar', '', '')
    const a = await addParticipant(token, eventId, 'Ana')
    await addParticipant(token, eventId, 'Bea')
    await addParticipant(token, eventId, 'Ceci')
    const participantToken = await participantLogin(await codeOf(token, eventId, a))
    expect((await auth('POST', `/api/admin/events/${eventId}/draw`)).status).toBe(200)

    expect((await auth('DELETE', `/api/admin/events/${eventId}`)).status).toBe(204)

    expect(await participantExists(a)).toBe(false)
    // la sesión de participante ya no vale para nada (ni para colarse en admin)
    expect((await call('GET', '/api/admin/events', { token: participantToken })).status).toBe(401)
    expectError(await call('GET', '/api/me', { token: participantToken }), 401, MSG.SESSION_EXPIRED)
  })
})

// --- Participantes ---

describe('participantes', () => {
  it('cada participante recibe un código único', async () => {
    const eventId = await createEvent(token, 'Códigos', '', '')
    const first = ok(
      await auth('POST', `/api/admin/events/${eventId}/participants`, {
        body: { name: '  Luna  ' },
      }),
    ).participants[0]
    expect(first.name).toBe('Luna')
    expect(first.code).toMatch(CODE_PATTERN)
    expect(first.exclusions).toEqual([])
    expect(first.wishCount).toBe(0)
    expect(first.seenAt).toBeNull()
    expect(first.receiverId).toBeUndefined()

    for (let i = 0; i < 20; i++) await addParticipant(token, eventId, `Persona ${i}`)
    const state = await getState(token, eventId)
    const codes = state.participants.map((p) => p.code)
    const names = state.participants.map((p) => p.name)
    expect(codes).toHaveLength(21)
    expect(new Set(codes).size).toBe(21)
    for (const code of codes) expect(code).toMatch(CODE_PATTERN)
    // en el orden en que se apuntaron
    expect(names[0]).toBe('Luna')
    expect(names[20]).toBe('Persona 19')
    const dup = await env.DB.prepare(
      'SELECT code FROM participant GROUP BY code HAVING COUNT(*) > 1',
    ).all()
    expect(dup.results).toHaveLength(0)
  })

  it('valida el nombre', async () => {
    const eventId = await createEvent(token, 'Nombres', '', '')
    const path = `/api/admin/events/${eventId}/participants`
    await addParticipant(token, eventId, 'Luna')
    await expect400(
      'POST',
      path,
      { name: '  LUNA ' },
      'Ya hay alguien llamado LUNA en este sorteo.',
    )
    await expect400('POST', path, { name: '   ' }, 'Escribe un nombre.')
    await expect400('POST', path, {}, 'Escribe un nombre.')
    await expect400(
      'POST',
      path,
      { name: 'x'.repeat(41) },
      'El nombre es demasiado largo (máximo 40 letras).',
    )
    await addParticipant(token, eventId, 'x'.repeat(40))

    // el mismo nombre en otro sorteo sí vale
    await addParticipant(token, await createEvent(token, 'Otro', '', ''), 'Luna')

    expectError(
      await auth('POST', `/api/admin/events/${crypto.randomUUID()}/participants`, {
        body: { name: 'A' },
      }),
      404,
      MSG.EVENT_NOT_FOUND,
    )
  })

  it('cambiar el nombre y las exclusiones', async () => {
    const eventId = await createEvent(token, 'Exclusiones', '', '')
    const luna = await addParticipant(token, eventId, 'Luna')
    const carlos = await addParticipant(token, eventId, 'Carlos')
    const marta = await addParticipant(token, eventId, 'Marta')
    const foreign = await addParticipant(token, await createEvent(token, 'Ajeno', '', ''), 'Ajena')
    const path = `/api/admin/events/${eventId}/participants/`

    // a sí misma se descarta, los repetidos también
    let first = ok(
      await auth('PATCH', path + luna, { body: { exclusions: [luna, carlos, carlos] } }),
    ).participants[0]
    expect(first.exclusions).toEqual([carlos])
    expect(first.name).toBe('Luna')

    // gente de otro sorteo: no
    await expect400(
      'PATCH',
      path + luna,
      { exclusions: [foreign] },
      'Esa persona no está en este sorteo.',
    )
    expect((await getState(token, eventId)).participants[0]!.exclusions).toEqual([carlos])

    // solo nombre: las exclusiones no se tocan; nombre en blanco deja el anterior
    first = ok(await auth('PATCH', path + luna, { body: { name: '  Luna Pérez ' } }))
      .participants[0]
    expect(first.name).toBe('Luna Pérez')
    expect(first.exclusions).toEqual([carlos])
    first = ok(await auth('PATCH', path + luna, { body: { name: '   ' } })).participants[0]
    expect(first.name).toBe('Luna Pérez')
    // cambiar solo mayúsculas del propio nombre vale; ponerse el de otro, no
    expect((await auth('PATCH', path + luna, { body: { name: 'luna pérez' } })).status).toBe(200)
    await expect400(
      'PATCH',
      path + luna,
      { name: 'marta' },
      'Ya hay alguien llamado marta en este sorteo.',
    )
    await expect400(
      'PATCH',
      path + luna,
      { name: 'x'.repeat(41) },
      'El nombre es demasiado largo (máximo 40 letras).',
    )

    expect((await auth('PATCH', path + marta, { body: { exclusions: [] } })).status).toBe(200)
    expectError(
      await auth('PATCH', path + crypto.randomUUID(), { body: { name: 'X' } }),
      404,
      MSG.PARTICIPANT_NOT_FOUND,
    )
  })

  it('quitar a alguien limpia las exclusiones de los demás', async () => {
    const eventId = await createEvent(token, 'Quitar', '', '')
    const a = await addParticipant(token, eventId, 'Ana')
    const b = await addParticipant(token, eventId, 'Bea')
    const c = await addParticipant(token, eventId, 'Ceci')
    const path = `/api/admin/events/${eventId}/participants/`
    expect((await auth('PATCH', path + a, { body: { exclusions: [b, c] } })).status).toBe(200)

    const state = ok(await auth('DELETE', path + b))
    expect(state.participants).toHaveLength(2)
    expect(state.participants[0].exclusions).toEqual([c])
    expect(await participantExists(b)).toBe(false)

    expectError(await auth('DELETE', path + b), 404, MSG.PARTICIPANT_NOT_FOUND)
  })
})

// --- Sorteo ---

describe('el sorteo', () => {
  it('asigna a todos respetando las exclusiones y nunca enseña las parejas', async () => {
    const eventId = await createEvent(token, 'Sorteo', '', '')
    const ids: string[] = []
    for (let i = 0; i < 6; i++) ids.push(await addParticipant(token, eventId, `P${i}`))
    const path = `/api/admin/events/${eventId}`
    // P0 no puede regalar a P1 (ni P1 a P0), P2 no a P3
    expect(
      (await auth('PATCH', `${path}/participants/${ids[0]}`, { body: { exclusions: [ids[1]] } }))
        .status,
    ).toBe(200)
    expect(
      (await auth('PATCH', `${path}/participants/${ids[2]}`, { body: { exclusions: [ids[3]] } }))
        .status,
    ).toBe(200)

    for (let run = 0; run < 10; run++) {
      const res = await auth('POST', `${path}/draw`)
      const state = ok(res)
      expect(state.event.drawDone).toBe(true)
      expect(state.event.drawnAt).toEqual(expect.any(String))
      expect(res.text).not.toContain('receiver')

      const pairs = new Map<string, string | null | undefined>()
      for (const id of ids) pairs.set(id, await receiverOf(id))
      const receivers = [...pairs.values()]
      expect(receivers).not.toContain(null)
      expect(new Set(receivers)).toEqual(new Set(ids))
      for (const [giver, receiver] of pairs) expect(giver).not.toBe(receiver)
      expect(pairs.get(ids[0]!)).not.toBe(ids[1])
      expect(pairs.get(ids[1]!)).not.toBe(ids[0])
      expect(pairs.get(ids[2]!)).not.toBe(ids[3])
      expect(pairs.get(ids[3]!)).not.toBe(ids[2])
    }

    expect((await auth('GET', path)).text).not.toContain('receiver')
    expect((await auth('GET', '/api/admin/events')).text).not.toContain('receiver')

    // con el sorteo hecho no se añade ni se quita a nadie
    await expect400(
      'POST',
      `${path}/participants`,
      { name: 'Nuevo' },
      'El sorteo ya está hecho. Anúlalo para añadir a alguien.',
    )
    expectError(
      await auth('DELETE', `${path}/participants/${ids[0]}`),
      400,
      'El sorteo ya está hecho. Anúlalo para quitar a alguien.',
    )
  })

  it('errores del sorteo', async () => {
    const eventId = await createEvent(token, 'Poca gente', '', '')
    const a = await addParticipant(token, eventId, 'Ana')
    const b = await addParticipant(token, eventId, 'Bea')
    const path = `/api/admin/events/${eventId}`
    await expect400(
      'POST',
      `${path}/draw`,
      undefined,
      'Hacen falta al menos 3 personas para el sorteo.',
    )

    await addParticipant(token, eventId, 'Ceci')
    expect(
      (await auth('PATCH', `${path}/participants/${a}`, { body: { exclusions: [b] } })).status,
    ).toBe(200)
    await expect400(
      'POST',
      `${path}/draw`,
      undefined,
      'Con estas exclusiones no hay forma de hacer el sorteo. Quita alguna y prueba otra vez.',
    )
    expect((await getState(token, eventId)).event.drawDone).toBe(false)
    expect(await receiverOf(a)).toBeNull()

    expect((await auth('POST', `/api/admin/events/${crypto.randomUUID()}/draw`)).status).toBe(404)
  })

  it('anular el sorteo conserva las listas y borra los seenAt', async () => {
    const eventId = await createEvent(token, 'Anular', '', '')
    const a = await addParticipant(token, eventId, 'Ana')
    await addParticipant(token, eventId, 'Bea')
    await addParticipant(token, eventId, 'Ceci')
    const path = `/api/admin/events/${eventId}`
    expect((await auth('POST', `${path}/draw`)).status).toBe(200)
    await giveWishesAndSee(a)

    const before = (await getState(token, eventId)).participants[0]!
    expect(before.wishCount).toBe(1)
    expect(before.seenAt).toEqual(expect.any(String))

    const state = ok(await auth('DELETE', `${path}/draw`))
    expect(state.event.drawDone).toBe(false)
    expect(state.event.drawnAt).toBeNull()
    expect(state.participants[0].wishCount).toBe(1)
    expect(state.participants[0].seenAt).toBeNull()
    expect(await receiverOf(a)).toBeNull()

    // ya se puede volver a añadir gente
    await addParticipant(token, eventId, 'Dani')
  })

  it('contadores del resumen de sorteos', async () => {
    const eventId = await createEvent(token, 'Contadores', '10 €', '2026-12-24')
    const a = await addParticipant(token, eventId, 'Ana')
    const b = await addParticipant(token, eventId, 'Bea')
    await addParticipant(token, eventId, 'Ceci')
    expect((await auth('POST', `/api/admin/events/${eventId}/draw`)).status).toBe(200)
    await giveWishesAndSee(a)
    await env.DB.prepare(
      "INSERT INTO wish (id, participant_id, sort_order, wish_text, url) VALUES (?, ?, 0, 'Libro', NULL)",
    )
      .bind(crypto.randomUUID(), b)
      .run()

    const events = ok(await auth('GET', '/api/admin/events')).events
    const matching = events.filter((e: { id: string }) => e.id === eventId)
    expect(matching).toHaveLength(1)
    expect(matching[0]).toMatchObject({
      participantCount: 3,
      wishlistCount: 2,
      seenCount: 1,
      drawDone: true,
      budget: '10 €',
      date: '2026-12-24',
    })
  })
})
