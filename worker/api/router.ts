// Enrutado de /api/*: busca la ruta, exige sesión de organización en /api/admin/** (salvo el login)
// y convierte cualquier error en { "error": "mensaje" } con su código HTTP.

import { requireAdmin } from './auth'
import { adminRoutes } from './admin'
import type { Ctx, Env, Handler } from './env'
import { ApiError, errorResponse, GENERIC } from './http'
import { meRoutes } from './me'

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Ruta completa con parámetros: '/api/admin/events/:eventId/participants/:id' */
  path: string
  handler: Handler
}

interface CompiledRoute extends Route {
  regex: RegExp
  names: string[]
}

function compile(route: Route): CompiledRoute {
  const names: string[] = []
  const pattern = route.path.replace(/:(\w+)/g, (_, name: string) => {
    names.push(name)
    return '([^/]+)'
  })
  return { ...route, regex: new RegExp(`^${pattern}/?$`), names }
}

const routes = [...meRoutes, ...adminRoutes].map(compile)

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const ctx: Ctx = {
    request,
    env,
    params: {},
    ip: request.headers.get('CF-Connecting-IP') ?? 'local',
    now: new Date(),
  }
  try {
    // Toda la zona de organización exige su sesión, salvo el propio login (como el interceptor de Java)
    if (
      url.pathname.startsWith('/api/admin/') &&
      url.pathname.replace(/\/$/, '') !== '/api/admin/login'
    ) {
      await requireAdmin(ctx)
    }

    let pathMatched = false
    for (const route of routes) {
      const match = route.regex.exec(url.pathname)
      if (!match) continue
      pathMatched = true
      if (route.method !== request.method) continue
      route.names.forEach((name, i) => {
        ctx.params[name] = decodeURIComponent(match[i + 1]!)
      })
      return await route.handler(ctx)
    }
    return pathMatched
      ? errorResponse(405, GENERIC.METHOD_NOT_ALLOWED)
      : errorResponse(404, GENERIC.NOT_FOUND)
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e.status, e.message)
    // Choque con una restricción de la base de datos (p. ej. dos peticiones a la vez con el mismo nombre)
    if (
      e instanceof Error &&
      /UNIQUE constraint failed|FOREIGN KEY constraint failed/.test(e.message)
    ) {
      console.warn('Violación de integridad:', e.message)
      return errorResponse(409, GENERIC.CONFLICT)
    }
    console.error('Error inesperado', e)
    return errorResponse(500, GENERIC.UNEXPECTED)
  }
}
