// Utilidades HTTP de la API: errores con mensaje para la persona, respuestas JSON y lectura del cuerpo.
// Todas las respuestas de error tienen la forma { "error": "mensaje" } (API.md, "Generalidades").

/** Error que se le enseña tal cual a la persona en el front (por eso va en castellano y en tono cercano). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }

  static badRequest(message: string) {
    return new ApiError(400, message)
  }

  static unauthorized(message: string) {
    return new ApiError(401, message)
  }

  static notFound(message: string) {
    return new ApiError(404, message)
  }
}

/** Mensajes genéricos, los mismos que daba el backend Java (GlobalExceptionHandler). */
export const GENERIC = {
  BAD_REQUEST: 'La petición no es válida.',
  NOT_FOUND: 'Esa dirección no existe.',
  METHOD_NOT_ALLOWED: 'Esa operación no está permitida aquí.',
  CONFLICT: 'Ese dato choca con otro que ya existe. Recarga la página y prueba otra vez.',
  UNEXPECTED: 'Algo ha fallado. Prueba otra vez en un momento.',
} as const

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}

export function errorResponse(status: number, message: string): Response {
  return json({ error: message }, status)
}

/**
 * Cuerpo JSON de la petición como objeto. Cuerpo vacío -> {} (los manejadores validan cada campo);
 * JSON roto o que no sea un objeto -> 400.
 */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (text.trim() === '') return {}
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw ApiError.badRequest(GENERIC.BAD_REQUEST)
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw ApiError.badRequest(GENERIC.BAD_REQUEST)
  }
  return data as Record<string, unknown>
}

/** Campo de texto opcional del cuerpo: string, o undefined si falta o es null. Otro tipo -> 400. */
export function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw ApiError.badRequest(GENERIC.BAD_REQUEST)
  return value
}
