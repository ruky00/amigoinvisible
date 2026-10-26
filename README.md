# AmigoInvisibleDeLuna

Lista de deseos para el Amigo invisible.

Aplicación web para organizar el Amigo Invisible en familia:

- **Sorteo aleatorio** de parejas (quién regala a quién).
- **Lista de deseos** por cada participante.

Todo se aloja gratis en **Cloudflare**: un único Worker sirve el front y la API, y los datos se guardan en D1.

## Stack

| Pieza          | Tecnología                                    |
| -------------- | --------------------------------------------- |
| Framework      | Vue 3 (`<script setup>`) + TypeScript         |
| Build / dev    | Vite                                          |
| Enrutado       | Vue Router                                    |
| Estado global  | Pinia                                         |
| Calidad código | ESLint + Oxlint + Prettier                    |
| API            | Cloudflare Worker en TypeScript (`worker/`)   |
| Base de datos  | Cloudflare D1 (SQLite)                        |
| Tests de la API| Vitest + `@cloudflare/vitest-pool-workers`    |
| Hosting        | Cloudflare Workers (plan gratuito)            |

## Requisitos

- **Node.js** `^22.18.0` o `>=24.12.0` (ver `engines` en `package.json`).
- npm (incluido con Node).

## Puesta en marcha en local

```bash
npm install      # instala las dependencias (solo la primera vez o al cambiar package.json)
npm run dev      # arranca el servidor de desarrollo en http://localhost:5173
```

## Scripts disponibles

| Comando              | Qué hace                                                        |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | Servidor de desarrollo con recarga en caliente                  |
| `npm run build`      | Comprueba tipos y genera la versión de producción en `dist/`    |
| `npm run preview`    | Sirve en local el contenido de `dist/` (probar el build)        |
| `npm run type-check` | Solo comprobación de tipos TypeScript (front y Worker)          |
| `npm test`           | Tests de la API (Worker + D1 en local)                          |
| `npm run cf:dev`     | Genera `dist/` y arranca la app completa en local (puerto 8787) |
| `npm run db:migrate:local` | Crea/actualiza las tablas de la D1 local                  |
| `npm run db:seed:local`    | Carga los sorteos de ejemplo en la D1 local (`NIEVE-42`)  |
| `npm run db:migrate:remote`| Aplica las migraciones a la D1 de producción              |
| `npm run cf-typegen` | Regenera los tipos del Worker tras tocar `wrangler.jsonc`       |
| `npm run lint`       | Revisa y corrige el código con Oxlint y ESLint                  |
| `npm run format`     | Formatea `src/` con Prettier                                    |

## Cómo funciona

- **Quien organiza** entra en `/organizar`, donde ve **todos sus sorteos** ("Papá Noel · Familia",
  "Camisetas raras · Equipo"…) y puede crear, editar o borrar los que quiera. Cada sorteo tiene
  su propia gente: dentro de cada uno apunta a los participantes, marca exclusiones (p. ej. parejas)
  y hace el sorteo. Cada persona tiene un código (`NIEVE-42`) y un enlace personal para mandar por WhatsApp.
  Nadie, ni la organización, ve el reparto completo.
- **Cada participante** entra con su código, descubre a quién regala (etiqueta que se gira),
  ve la lista de deseos de esa persona y escribe la suya (texto + enlace opcional).

## Modo pruebas (sin backend)

Mientras no haya backend, la app usa un simulador que guarda los datos en el navegador
(`src/api/mock.ts`). Trae dos sorteos de ejemplo. La contraseña de organización de pruebas
es la constante `MOCK_ADMIN_PASSWORD` de ese archivo. Para conectar con la API real, mira
`.env.example` y **[API.md](API.md)**, donde están descritos todos los endpoints.

## API en local

La API es el Worker de [`worker/`](worker/) (contrato en **[API.md](API.md)**). La primera vez:

```bash
cp .dev.vars.example .dev.vars   # contraseña de organización en local (turron)
npm run db:migrate:local         # crea las tablas en la D1 local (.wrangler/)
npm run db:seed:local            # opcional: sorteos de ejemplo, entra con NIEVE-42
```

Después, dos terminales:

1. `npm run cf:dev`: genera `dist/` y arranca el Worker en `http://localhost:8787` (ya es la app entera).
2. Si quieres recarga en caliente del front: crea `.env.local` con `VITE_USE_MOCK=false` y lanza
   `npm run dev`. Vite reenvía `/api` a `http://localhost:8787`, así que `VITE_API_URL` se queda vacía.

## Estructura

```
├── public/              # Archivos estáticos (favicon)
├── src/
│   ├── api/             # Acceso a datos: mock.ts (pruebas), http.ts (API real), index.ts (elige)
│   ├── assets/main.css  # Estilos globales: colores, tipografías, botones, formularios
│   ├── components/      # GiftTag, WishList, WishlistEditor, HollySprig
│   ├── lib/             # draw.ts (algoritmo del sorteo), url.ts
│   ├── router/          # Rutas: /, /entrar/:code, /mi-sorteo, /organizar
│   ├── stores/          # session.ts (tokens de sesión)
│   ├── views/           # Pantallas
│   └── types.ts         # Tipos compartidos con la API
├── worker/
│   ├── index.ts         # Entrada del Worker: /api/* a la API, el resto a los estáticos de dist/
│   ├── api/             # Rutas (me.ts, admin.ts), sesiones (auth.ts), lecturas de D1 (dto.ts)
│   ├── migrations/      # Esquema de D1 (wrangler d1 migrations)
│   ├── seed/demo.sql    # Sorteos de ejemplo
│   └── test/            # Tests de la API
├── wrangler.jsonc       # Configuración de Cloudflare (Worker, D1, cron)
├── API.md               # Contrato entre el front y la API
└── index.html
```

## Despliegue en Cloudflare (gratis)

Un único Worker (`wrangler.jsonc`) sirve el front (`dist/`) y la API (`worker/`), con los datos en D1.
Todo entra en el plan gratuito.

La base de datos de producción ya existe (`amigoinvisible`, región Europa occidental; su
`database_id` está en `wrangler.jsonc`) y tiene las tablas creadas. Lo único que falta una vez,
desde tu ordenador (`npx wrangler login` primero):

- Contraseña de organización: `npx wrangler secret put ADMIN_PASSWORD` (o en el panel del Worker:
  Settings → Variables and Secrets). Sin ella nadie puede entrar en `/organizar`.

En el panel del Worker (Settings → Build), conectado al repo:

- **Build command:** `npm run build` (usa `.env.production`: API real en el mismo dominio)
- **Deploy command:** `npx wrangler deploy`

Cada push a `main` despliega. Si algún día se añade una migración nueva en `worker/migrations/`,
hay que volver a lanzar `npm run db:migrate:remote`.
