// API del participante de punta a punta. Port de MeApiTest.java: los datos se crean directamente
// en D1 (como allí con los repositorios) y las peticiones van al Worker por HTTP.

import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { call, expectError, freshIp, MSG, ok, participantLogin } from './helpers'

const UNKNOWN_CODE = 'Ese código no nos suena. Revísalo o pídeselo a quien organiza.'
const TEXT_TOO_LONG = 'Cada deseo puede tener como mucho 200 letras.'
const TOO_MANY_WISHES = 'Como mucho 30 deseos. ¡Deja algo para el año que viene!'
const BAD_URL = 'Ese enlace no parece válido. Cópialo entero desde la tienda.'

// ---------- utilidades ----------

let seq = 0

interface Fixture {
  eventId: string
  anaId: string
  beaId: string
  anaCode: string
  beaCode: string
  beaWish1: string
  beaWish2: string
}

/** Sorteo "Navidad" con Ana (sin deseos) y Bea (dos deseos), sin sortear. */
async function fixture(date: string | null = null): Promise<Fixture> {
  const n = ++seq
  const f: Fixture = {
    eventId: crypto.randomUUID(),
    anaId: crypto.randomUUID(),
    beaId: crypto.randomUUID(),
    anaCode: `ANA-T${n}`,
    beaCode: `BEA-T${n}`,
    beaWish1: crypto.randomUUID(),
    beaWish2: crypto.randomUUID(),
  }
  const now = Date.now()
  const at = (ms: number) => new Date(now + ms).toISOString()
  const db = env.DB
  await db.batch([
    db
      .prepare(
        'INSERT INTO draw_event (id, name, budget, exchange_date, drawn_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
      )
      .bind(f.eventId, 'Navidad', '20 €', date, at(0)),
    insertParticipant(f.anaId, f.eventId, 'Ana', f.anaCode, at(0)),
    insertParticipant(f.beaId, f.eventId, 'Bea', f.beaCode, at(1)),
    insertWish(f.beaWish1, f.beaId, 0, 'Calcetines', 'https://tienda.example/calcetines'),
    insertWish(f.beaWish2, f.beaId, 1, 'Un libro', null),
  ])
  return f
}

function insertParticipant(
  id: string,
  eventId: string,
  name: string,
  code: string,
  createdAt: string,
) {
  return env.DB.prepare(
    'INSERT INTO participant (id, event_id, name, code, receiver_id, seen_at, created_at) VALUES (?, ?, ?, ?, NULL, NULL, ?)',
  ).bind(id, eventId, name, code, createdAt)
}

function insertWish(
  id: string,
  participantId: string,
  order: number,
  text: string,
  url: string | null,
) {
  return env.DB.prepare(
    'INSERT INTO wish (id, participant_id, sort_order, wish_text, url) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, participantId, order, text, url)
}

/** Sorteo hecho a mano: Ana → Bea, Bea → Ana. */
async function draw(f: Fixture): Promise<void> {
  const db = env.DB
  await db.batch([
    db
      .prepare('UPDATE draw_event SET drawn_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), f.eventId),
    db.prepare('UPDATE participant SET receiver_id = ? WHERE id = ?').bind(f.beaId, f.anaId),
    db.prepare('UPDATE participant SET receiver_id = ? WHERE id = ?').bind(f.anaId, f.beaId),
  ])
}

async function seenAt(participantId: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT seen_at FROM participant WHERE id = ?')
    .bind(participantId)
    .first<{ seen_at: string | null }>()
  return row!.seen_at
}

const me = (token: string) => call('GET', '/api/me', { token })
const wishlist = (token: string) => call('GET', '/api/me/wishlist', { token })
const assignment = (token: string) => call('GET', '/api/me/assignment', { token })
const saveWishlist = (token: string, body: unknown) =>
  call('PUT', '/api/me/wishlist', { token, body })

function wishes(count: number) {
  return {
    wishes: Array.from({ length: count }, (_, i) => ({ id: '', text: `Deseo ${i}`, url: null })),
  }
}

// ---------- login ----------

describe('login de participante', () => {
  it('con el código exacto da un token', async () => {
    const f = await fixture()
    const body = ok(await call('POST', '/api/login', { body: { code: f.anaCode } }))
    expect(body.token).toEqual(expect.any(String))
    expect(body.token).not.toBe('')
  })

  it('normaliza el código', async () => {
    const eventId = crypto.randomUUID()
    const now = new Date().toISOString()
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO draw_event (id, name, budget, created_at) VALUES (?, 'Nieve', '', ?)",
      ).bind(eventId, now),
      insertParticipant(crypto.randomUUID(), eventId, 'Nora', 'NIEVE-42', now),
    ])

    const token = await participantLogin('  nieve 42 ')
    expect(ok(await me(token)).me.name).toBe('Nora')
  })

  it('un código desconocido o en blanco es 404 con mensaje', async () => {
    for (const code of ['NO-EXISTE-999', '   ']) {
      expectError(await call('POST', '/api/login', { body: { code } }), 404, UNKNOWN_CODE)
    }
  })

  // No está en MeApiTest.java (allí el limitador tenía su propio test unitario con reloj):
  // 10 fallos por IP en 10 minutos, y a partir de ahí 429 aunque el código sea bueno.
  it('demasiados intentos fallidos desde la misma IP es 429', async () => {
    const f = await fixture()
    const ip = freshIp()
    for (let i = 0; i < 10; i++) {
      expectError(
        await call('POST', '/api/login', { body: { code: `MAL-${i}` }, ip }),
        404,
        UNKNOWN_CODE,
      )
    }
    expectError(
      await call('POST', '/api/login', { body: { code: f.anaCode }, ip }),
      429,
      MSG.TOO_MANY,
    )
    // desde otra IP sí se puede
    await participantLogin(f.anaCode, freshIp())
  })
})

// ---------- sesión ----------

describe('sesión de participante', () => {
  it('sin token o con un token inventado es 401', async () => {
    expectError(await call('GET', '/api/me'), 401, MSG.SESSION_EXPIRED)
    expectError(await call('GET', '/api/me', { token: 'no-es-un-token' }), 401, MSG.SESSION_EXPIRED)
    expect((await call('GET', '/api/me/wishlist')).status).toBe(401)
  })

  it('/api/me devuelve sus datos y los del sorteo con la forma que espera el front', async () => {
    const f = await fixture()
    const body = ok(await me(await participantLogin(f.anaCode)))
    expect(body.me).toEqual({ id: f.anaId, name: 'Ana' })
    expect(body.me.code).toBeUndefined()
    expect(body.me.receiverId).toBeUndefined()
    expect(body.event).toEqual({
      id: f.eventId,
      name: 'Navidad',
      budget: '20 €',
      date: '',
      drawDone: false,
      drawnAt: null,
    })
    expect(body.event.participants).toBeUndefined()
  })

  it('enseña la fecha si la hay', async () => {
    const f = await fixture('2026-12-24')
    expect(ok(await me(await participantLogin(f.anaCode))).event.date).toBe('2026-12-24')
  })

  it('si borran al participante, su sesión es 401', async () => {
    const f = await fixture()
    const token = await participantLogin(f.anaCode)
    await env.DB.prepare('DELETE FROM participant WHERE id = ?').bind(f.anaId).run()
    // la sesión se borra en cascada en la base de datos, así que también es 401
    expectError(await me(token), 401, MSG.SESSION_EXPIRED)
  })

  // No está en MeApiTest.java (allí haría falta mover el reloj): la caducidad se mira en la consulta,
  // así que basta con apuntar una sesión que ya ha caducado.
  it('una sesión caducada es 401', async () => {
    const f = await fixture()
    const now = Date.now()
    await env.DB.prepare(
      'INSERT INTO app_session (token, participant_id, admin, created_at, expires_at) VALUES (?, ?, 0, ?, ?)',
    )
      .bind(
        'token-caducado',
        f.anaId,
        new Date(now - 91 * 86_400_000).toISOString(),
        new Date(now - 1000).toISOString(),
      )
      .run()
    expectError(await me('token-caducado'), 401, MSG.SESSION_EXPIRED)
  })
})

// ---------- a quién regalo ----------

describe('a quién regalo', () => {
  it('es null antes del sorteo', async () => {
    const f = await fixture()
    // aunque haya receptor apuntado, sin sorteo hecho no se enseña
    await env.DB.prepare('UPDATE participant SET receiver_id = ? WHERE id = ?')
      .bind(f.beaId, f.anaId)
      .run()

    expect(ok(await assignment(await participantLogin(f.anaCode)))).toEqual({ assignment: null })
    expect(await seenAt(f.anaId)).toBeNull()
  })

  it('con el sorteo hecho enseña a quién regala y apunta seenAt una sola vez', async () => {
    const f = await fixture()
    await draw(f)
    const token = await participantLogin(f.anaCode)

    const first = ok(await assignment(token)).assignment
    expect(first.name).toBe('Bea')
    expect(first.id).toBeUndefined()
    expect(first.wishlist).toHaveLength(2)
    expect(first.wishlist[0]).toEqual({
      id: f.beaWish1,
      text: 'Calcetines',
      url: 'https://tienda.example/calcetines',
    })
    expect(first.wishlist[1].text).toBe('Un libro')
    // sin enlace, el campo no va (en Java era null; el front lo trata igual)
    expect(first.wishlist[1].url ?? null).toBeNull()

    const firstSeen = await seenAt(f.anaId)
    expect(firstSeen).not.toBeNull()
    // Bea no ha mirado nada todavía
    expect(await seenAt(f.beaId)).toBeNull()

    expect(ok(await assignment(token)).assignment.name).toBe('Bea')
    expect(await seenAt(f.anaId)).toBe(firstSeen)

    const event = ok(await me(token)).event
    expect(event.drawDone).toBe(true)
    expect(event.drawnAt).toEqual(expect.any(String))
    expect(event.drawnAt).not.toBe('')
  })
})

// ---------- mi lista ----------

describe('mi lista', () => {
  it('solo enseña mis deseos', async () => {
    const f = await fixture()
    expect(ok(await wishlist(await participantLogin(f.anaCode))).wishes).toHaveLength(0)
    expect(ok(await wishlist(await participantLogin(f.beaCode))).wishes).toHaveLength(2)
  })

  it('al guardar conserva mis ids, da ids nuevos y descarta los vacíos', async () => {
    const f = await fixture()
    const token = await participantLogin(f.beaCode)
    const saved = ok(
      await saveWishlist(token, {
        wishes: [
          { id: '', text: '  Bufanda  ', url: '  ' },
          { id: f.beaWish2, text: 'Un libro', url: null },
          { id: '', text: '   ', url: 'https://x.example' },
          { id: f.beaWish1, text: 'Calcetines rojos', url: ' http://tienda.example/rojos ' },
        ],
      }),
    ).wishes
    expect(saved).toHaveLength(3)
    expect(saved[0].id).toEqual(expect.any(String))
    expect(saved[0].id).not.toBe('')
    expect(saved[0].text).toBe('Bufanda')
    expect(saved[0].url ?? null).toBeNull()
    expect(saved[1].id).toBe(f.beaWish2)
    expect(saved[2]).toEqual({
      id: f.beaWish1,
      text: 'Calcetines rojos',
      url: 'http://tienda.example/rojos',
    })

    // el orden y los ids se mantienen al volver a leer
    const reread = ok(await wishlist(token)).wishes
    expect(reread[0].text).toBe('Bufanda')
    expect(reread[1].id).toBe(f.beaWish2)
    expect(reread[2].id).toBe(f.beaWish1)
  })

  it('no respeta ids de deseos de otra persona', async () => {
    const f = await fixture()
    const saved = ok(
      await saveWishlist(await participantLogin(f.anaCode), {
        wishes: [{ id: f.beaWish1, text: 'Me lo quedo', url: null }],
      }),
    ).wishes
    expect(saved[0].id).not.toBe(f.beaWish1)

    // la lista de Bea sigue intacta
    const bea = ok(await wishlist(await participantLogin(f.beaCode))).wishes
    expect(bea).toHaveLength(2)
    expect(bea[0].text).toBe('Calcetines')
  })

  it('guardar una lista vacía o sin "wishes" la deja vacía', async () => {
    const f = await fixture()
    const token = await participantLogin(f.beaCode)
    expect(ok(await saveWishlist(token, {})).wishes).toHaveLength(0)
    expect(ok(await wishlist(token)).wishes).toHaveLength(0)
  })

  it('rechaza enlaces raros', async () => {
    const f = await fixture()
    const token = await participantLogin(f.beaCode)
    const longUrl = 'https://tienda.example/' + 'a'.repeat(2000)
    for (const url of [
      'javascript:alert(1)',
      'tienda.example/calcetines',
      'ftp://tienda.example/x',
      'https://',
      'http://con espacios.example',
      longUrl,
    ]) {
      const res = await saveWishlist(token, { wishes: [{ id: '', text: 'Algo', url }] })
      expect(res.status, url.slice(0, 40)).toBe(400)
      expect(res.body).toEqual({ error: BAD_URL })
    }
    // nada se ha guardado
    expect(ok(await wishlist(token)).wishes).toHaveLength(2)
  })

  it('rechaza textos largos y demasiados deseos', async () => {
    const f = await fixture()
    const token = await participantLogin(f.anaCode)

    expectError(
      await saveWishlist(token, { wishes: [{ id: '', text: 'x'.repeat(201), url: null }] }),
      400,
      TEXT_TOO_LONG,
    )
    expectError(await saveWishlist(token, wishes(31)), 400, TOO_MANY_WISHES)

    const saved = ok(await saveWishlist(token, wishes(30))).wishes
    expect(saved).toHaveLength(30)
    expect(saved[29].text).toBe('Deseo 29')
  })
})
