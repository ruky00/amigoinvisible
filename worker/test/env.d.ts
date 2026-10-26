// Bindings que solo existen en los tests (ver vitest.config.ts), además de los de wrangler.jsonc.

import type { D1Migration } from 'cloudflare:test'

declare global {
  namespace Cloudflare {
    interface Env {
      ADMIN_PASSWORD: string
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}
