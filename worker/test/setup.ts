// Se ejecuta antes de cada archivo de tests (setupFiles en vitest.config.ts).
// Cada test empieza con la base de datos vacía: se aplican las migraciones (solo la primera vez,
// applyD1Migrations apunta las ya aplicadas en d1_migrations) y se vacían todas las tablas.

import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach } from 'vitest'

// En orden de hijos a padres, por las claves ajenas
const TABLES = [
  'app_session',
  'login_failure',
  'wish',
  'participant_exclusion',
  'participant',
  'draw_event',
]

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  await env.DB.batch(TABLES.map((table) => env.DB.prepare(`DELETE FROM ${table}`)))
})
