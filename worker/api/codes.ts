// Códigos para entrar ("NIEVE-42"): una palabra navideña y un número, fáciles de dictar.
// Únicos en TODA la base de datos, porque el código identifica a la persona y a su sorteo.

/** Las mismas palabras que el mock del front. */
export const CODE_WORDS = [
  'ABETO',
  'ACEBO',
  'BELEN',
  'CAMPANA',
  'COMETA',
  'ESTRELLA',
  'MAZAPAN',
  'MUERDAGO',
  'NIEVE',
  'PASTOR',
  'POLVORON',
  'RENO',
  'TRINEO',
  'TURRON',
  'VELA',
  'ZAMBOMBA',
] as const

/** Con 16 palabras x 90 números hay 1440 códigos de dos cifras; si se llenan, pasamos a tres. */
const SHORT_ATTEMPTS = 30

/**
 * Un código que no tiene nadie todavía. Entre la comprobación y el INSERT otra petición podría
 * llevárselo; en ese caso salta el índice UNIQUE y el router responde 409.
 */
export async function newParticipantCode(db: D1Database): Promise<string> {
  const exists = db.prepare('SELECT 1 FROM participant WHERE code = ?')
  for (let i = 0; i < SHORT_ATTEMPTS; i++) {
    const code = candidate(10, 99)
    if (!(await exists.bind(code).first())) return code
  }
  for (;;) {
    const code = candidate(100, 999)
    if (!(await exists.bind(code).first())) return code
  }
}

function candidate(min: number, max: number): string {
  const word = CODE_WORDS[randomInt(CODE_WORDS.length)]!
  return `${word}-${min + randomInt(max - min + 1)}`
}

/** Entero uniforme en [0, max), con el generador criptográfico. */
function randomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buf = new Uint32Array(1)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0]! >= limit)
  return buf[0]! % max
}
