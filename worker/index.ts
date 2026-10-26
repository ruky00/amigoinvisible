// Worker de Cloudflare: estáticos del front + la API (/api/*) sobre D1.
// La configuración está en wrangler.jsonc. El secreto ADMIN_PASSWORD se pone con
// `npx wrangler secret put ADMIN_PASSWORD` (o en el panel: Settings -> Variables and Secrets).

import { purgeExpired } from './api/auth'
import type { Env } from './api/env'
import { handleApi } from './api/router'

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return handleApi(request, env)
    return env.ASSETS.fetch(request)
  },

  async scheduled(controller, env): Promise<void> {
    await purgeExpired(env, new Date(controller.scheduledTime))
  },
} satisfies ExportedHandler<Env>
