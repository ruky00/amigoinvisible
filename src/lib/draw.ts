// Algoritmo del sorteo. Es TypeScript puro, sin dependencias: lo usan el Worker (el sorteo de
// verdad, worker/api/admin.ts) y el simulador del front (src/api/mock.ts).

export interface DrawPerson {
  id: string
  exclusions: string[]
}

export class DrawError extends Error {}

const TOO_FEW = 'Hacen falta al menos 3 personas para el sorteo.'
const IMPOSSIBLE =
  'Con estas exclusiones no hay forma de hacer el sorteo. Quita alguna y prueba otra vez.'

const MAX_ATTEMPTS = 50
/**
 * Tope de pasos por intento: el backtracking es exponencial y un sorteo grande e imposible
 * dejaría la petición pensando para siempre (un Worker tiene un límite de CPU).
 */
const MAX_STEPS_PER_ATTEMPT = 200_000

/**
 * Devuelve un mapa giverId -> receiverId en el que nadie se regala a sí mismo
 * ni a alguien de su lista de exclusiones (las exclusiones cuentan en los dos sentidos).
 */
export function drawPairs(people: DrawPerson[]): Record<string, string> {
  if (people.length < 3) throw new DrawError(TOO_FEW)

  const blocked = new Map<string, Set<string>>()
  for (const p of people) blocked.set(p.id, new Set([p.id]))
  for (const p of people) {
    for (const other of p.exclusions ?? []) {
      blocked.get(p.id)!.add(other)
      blocked.get(other)?.add(p.id)
    }
  }

  const ids = people.map((p) => p.id)
  // Sin esto, un sorteo grande e imposible agota todos los intentos (segundos de CPU) para acabar igual
  if (!hasPerfectMatching(ids, blocked)) throw new DrawError(IMPOSSIBLE)

  // Backtracking sobre un orden aleatorio: con familias de tamaño normal es instantáneo.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const givers = shuffle(ids)
    const result: Record<string, string> = {}
    const taken = new Set<string>()
    let steps = 0

    const assign = (i: number): boolean => {
      if (i === givers.length) return true
      const giver = givers[i]!
      for (const receiver of shuffle(givers)) {
        if (++steps > MAX_STEPS_PER_ATTEMPT) return false
        if (taken.has(receiver) || blocked.get(giver)!.has(receiver)) continue
        result[giver] = receiver
        taken.add(receiver)
        if (assign(i + 1)) return true
        taken.delete(receiver)
        delete result[giver]
      }
      return false
    }

    if (assign(0)) return result
  }

  throw new DrawError(IMPOSSIBLE)
}

/**
 * ¿Hay algún reparto válido? Un reparto es un emparejamiento perfecto entre quien regala y quien
 * recibe (los ciclos dan igual), así que basta con buscar uno (Kuhn, O(n³) en el peor caso).
 */
function hasPerfectMatching(ids: string[], blocked: Map<string, Set<string>>): boolean {
  const giverOf = new Map<string, string>()
  const place = (giver: string, visited: Set<string>): boolean => {
    for (const receiver of ids) {
      if (visited.has(receiver) || blocked.get(giver)!.has(receiver)) continue
      visited.add(receiver)
      const current = giverOf.get(receiver)
      if (current === undefined || place(current, visited)) {
        giverOf.set(receiver, giver)
        return true
      }
    }
    return false
  }
  return ids.every((giver) => place(giver, new Set()))
}

/** Fisher-Yates sobre una copia. */
function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

/** Entero uniforme en [0, max). Descarta el tramo final para no favorecer los números bajos. */
function randomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buf = new Uint32Array(1)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0]! >= limit)
  return buf[0]! % max
}
