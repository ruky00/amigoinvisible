// Tests de la API (worker/test/) dentro del runtime de Workers (workerd), con
// @cloudflare/vitest-plugin (vitest 4): el plugin cloudflareTest() monta el pool.
// - Lee wrangler.jsonc: el Worker de worker/index.ts y la base D1 `DB` (en memoria).
// - Las migraciones de D1 se leen aquí (en Node) y se pasan como binding; worker/test/setup.ts
//   las aplica y vacía las tablas antes de cada test.
// - Los estáticos apuntan a una carpeta de prueba (worker/test/fixtures/assets) para no depender
//   de que exista ./dist (solo existe después de `npm run build-only`).

import { fileURLToPath } from 'node:url'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path('./worker/migrations'))

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          assets: { directory: path('./worker/test/fixtures/assets') },
          bindings: {
            // la contraseña de organización en los tests (en local va en .dev.vars)
            ADMIN_PASSWORD: 'turron',
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      include: ['worker/test/**/*.test.ts'],
      setupFiles: ['./worker/test/setup.ts'],
    },
  }
})
