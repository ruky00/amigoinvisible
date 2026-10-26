// Enrutado general de /api (worker/api/router.ts) y reparto entre la API y los estáticos
// (worker/index.ts). Equivale a lo que en Java hacían GlobalExceptionHandler y el interceptor de admin.

import { describe, expect, it } from 'vitest'
import { call, expectError, MSG } from './helpers'

describe('router de /api', () => {
  it('una ruta de la API que no existe es 404 con mensaje', async () => {
    for (const path of ['/api/no-existe', '/api', '/api/me/otra-cosa']) {
      const res = await call('GET', path)
      expectError(res, 404, MSG.NOT_FOUND)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
    }
  })

  it('un método que no toca en una ruta que existe es 405', async () => {
    expectError(await call('DELETE', '/api/login'), 405, 'Esa operación no está permitida aquí.')
  })

  it('la zona de organización sin token es 401', async () => {
    expectError(await call('GET', '/api/admin/events'), 401, MSG.ADMIN_ONLY)
    // también las rutas de admin que no existen: primero se mira la sesión
    expectError(await call('GET', '/api/admin/no-existe'), 401, MSG.ADMIN_ONLY)
  })

  it('JSON roto es 400', async () => {
    const res = await call('POST', '/api/login', { rawBody: '{"code": ' })
    expectError(res, 400, 'La petición no es válida.')
  })
})

describe('fuera de /api', () => {
  it('las rutas del front no pasan por la API: se sirven los estáticos', async () => {
    for (const path of ['/', '/organizar', '/apis', '/mi-sorteo']) {
      const res = await call('GET', path)
      expect(res.status, path).toBe(200)
      expect(res.text, path).toContain('front-de-prueba')
      expect(res.headers.get('Content-Type') ?? '', path).toContain('text/html')
    }
  })
})
