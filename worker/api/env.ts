// Bindings y secretos del Worker (ver wrangler.jsonc).
// ADMIN_PASSWORD es un secreto: `npx wrangler secret put ADMIN_PASSWORD` (en local, en .dev.vars).

export interface Env {
  ASSETS: Fetcher
  DB: D1Database
  ADMIN_PASSWORD?: string
}

/** Lo que recibe cada manejador de la API. */
export interface Ctx {
  request: Request
  env: Env
  /** Parámetros de la ruta (:eventId, :id…), ya decodificados */
  params: Record<string, string>
  /** IP del visitante (CF-Connecting-IP), para el limitador de intentos de login */
  ip: string
  /** Hora de la petición. Todo lo que se guarde con fecha usa esta, en ISO-8601 UTC. */
  now: Date
}

export type Handler = (ctx: Ctx) => Promise<Response>
