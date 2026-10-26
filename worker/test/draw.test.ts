// Algoritmo del sorteo (src/lib/draw.ts), sin HTTP. Port de DrawAlgorithmTest.java.

import { describe, expect, it } from 'vitest'
import { drawPairs, DrawError, type DrawPerson } from '../../src/lib/draw'

const TOO_FEW = 'Hacen falta al menos 3 personas para el sorteo.'
const IMPOSSIBLE =
  'Con estas exclusiones no hay forma de hacer el sorteo. Quita alguna y prueba otra vez.'

const person = (id: string, exclusions: string[] = []): DrawPerson => ({ id, exclusions })

/** Lanza DrawError con ese mensaje exacto. */
function expectDrawError(people: DrawPerson[], message?: string): void {
  let error: unknown
  try {
    drawPairs(people)
  } catch (e) {
    error = e
  }
  expect(error).toBeInstanceOf(DrawError)
  if (message !== undefined) expect((error as Error).message).toBe(message)
}

describe('drawPairs', () => {
  it('todos regalan y reciben exactamente una vez y nadie a sí mismo', () => {
    for (let size = 3; size <= 12; size++) {
      const people = Array.from({ length: size }, (_, i) => person(`p${i}`))
      const ids = new Set(people.map((p) => p.id))
      for (let run = 0; run < 200; run++) {
        const pairs = drawPairs(people)
        expect(new Set(Object.keys(pairs))).toEqual(ids)
        expect(new Set(Object.values(pairs))).toEqual(ids)
        for (const [giver, receiver] of Object.entries(pairs)) expect(giver).not.toBe(receiver)
      }
    }
  })

  it('las exclusiones cuentan en los dos sentidos', () => {
    // Luna excluye a Carlos (solo lo dice ella); Abuela excluye a Paco
    const people = [
      person('luna', ['carlos']),
      person('carlos'),
      person('abuela', ['paco']),
      person('paco'),
      person('marta'),
    ]
    for (let run = 0; run < 500; run++) {
      const pairs = drawPairs(people)
      expect(pairs.luna).not.toBe('carlos')
      expect(pairs.carlos).not.toBe('luna')
      expect(pairs.abuela).not.toBe('paco')
      expect(pairs.paco).not.toBe('abuela')
    }
  })

  it('exclusiones justas pero posibles siguen funcionando', () => {
    // con 3 personas solo hay dos ciclos (a→b→c→a y a→c→b→a) y los dos usan a-b en algún sentido:
    // a-b bloqueado en los dos sentidos, con 3 personas no hay solución
    expectDrawError([person('a', ['b']), person('b'), person('c')], IMPOSSIBLE)

    const four = [person('a', ['b']), person('b'), person('c', ['d']), person('d')]
    for (let run = 0; run < 200; run++) {
      const pairs = drawPairs(four)
      expect(['c', 'd']).toContain(pairs.a)
      expect(['a', 'b']).toContain(pairs.c)
    }
  })

  it('con menos de 3 personas es un error', () => {
    expectDrawError([person('a'), person('b')], TOO_FEW)
    expectDrawError([], TOO_FEW)
  })

  it('exclusiones imposibles son un error', () => {
    // Luna excluye a todos los demás: nadie puede regalarle a ella
    const people = [
      person('luna', ['carlos', 'marta', 'paco']),
      person('carlos'),
      person('marta'),
      person('paco'),
    ]
    expectDrawError(people, IMPOSSIBLE)
  })

  it('un sorteo grande e imposible falla en un tiempo razonable', () => {
    // 25 personas, una excluida por todos: el tope de pasos evita el backtracking eterno
    const others = Array.from({ length: 24 }, (_, i) => `p${i + 1}`)
    const people = [...others.map((id) => person(id)), person('p0', others)]
    const start = Date.now()
    expectDrawError(people)
    // ojo: dentro de workerd Date.now() solo avanza con E/S, así que esto es una cota floja;
    // lo que de verdad protege es el timeout del test de vitest
    expect(Date.now() - start).toBeLessThan(30_000)
  }, 30_000)
})
