// Algoritmo del sorteo. Es TypeScript puro, sin dependencias, para que el
// backend pueda reutilizarlo tal cual (el sorteo de verdad debe hacerse allí).

export interface DrawPerson {
  id: string
  exclusions: string[]
}

export class DrawError extends Error {}

/**
 * Devuelve un mapa giverId -> receiverId en el que nadie se regala a sí mismo
 * ni a alguien de su lista de exclusiones (las exclusiones cuentan en los dos sentidos).
 */
export function drawPairs(people: DrawPerson[]): Record<string, string> {
  if (people.length < 3) throw new DrawError('Hacen falta al menos 3 personas para el sorteo.')

  const blocked = new Map<string, Set<string>>()
  for (const p of people) blocked.set(p.id, new Set([p.id]))
  for (const p of people) {
    for (const other of p.exclusions) {
      blocked.get(p.id)?.add(other)
      blocked.get(other)?.add(p.id)
    }
  }

  // Backtracking sobre un orden aleatorio: con familias de tamaño normal es instantáneo.
  for (let attempt = 0; attempt < 50; attempt++) {
    const givers = shuffle(people.map((p) => p.id))
    const result: Record<string, string> = {}
    const taken = new Set<string>()

    const assign = (i: number): boolean => {
      if (i === givers.length) return true
      const giver = givers[i]!
      for (const receiver of shuffle(givers)) {
        if (taken.has(receiver) || blocked.get(giver)!.has(receiver)) continue
        result[giver] = receiver
        taken.add(receiver)
        if (assign(i + 1)) return true
        taken.delete(receiver)
      }
      return false
    }

    if (assign(0)) return result
  }

  throw new DrawError('Con estas exclusiones no hay forma de hacer el sorteo. Quita alguna y prueba otra vez.')
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! % max
}
