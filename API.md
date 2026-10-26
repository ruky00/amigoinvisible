# API que espera el front

Documento para el backend (Cloudflare Workers / Pages Functions + D1 o KV).
El front ya está hecho contra esta API: está en [`src/api/http.ts`](src/api/http.ts), y los
tipos en [`src/types.ts`](src/types.ts), que se pueden importar tal cual desde el Worker.
Mientras no exista el backend, el front usa un simulador ([`src/api/mock.ts`](src/api/mock.ts))
que guarda los datos en el navegador.

## Generalidades

- Todas las rutas van bajo `/api`. Si la API va en otro dominio, se configura con `VITE_API_URL`.
- Cuerpos y respuestas en JSON.
- Autenticación: `Authorization: Bearer <token>`. Hay dos tipos de token: el de participante
  (sale de `POST /api/login`) y el de organización (sale de `POST /api/admin/login`).
- Errores: código HTTP adecuado + `{ "error": "Mensaje para mostrar a la persona" }`.
  El front enseña ese mensaje tal cual, así que mejor en castellano y en tono cercano.
  Con `401` el front cierra la sesión y vuelve a pedir el código/contraseña.

## Varios sorteos

La organización puede tener **varios sorteos a la vez** ("Papá Noel · Familia",
"Camisetas raras · Equipo"…). Cada sorteo es independiente: sus datos, sus participantes,
sus exclusiones, sus listas y sus parejas. Si la misma persona está en dos sorteos, es un
participante distinto en cada uno, con **su propio código**.

Por eso los códigos tienen que ser **únicos en toda la base de datos** (no solo dentro de un
sorteo): el código identifica a la persona y a su sorteo a la vez.

## Reglas de privacidad (importante)

El front solo pide "lo mío", pero **quien garantiza la privacidad es el backend**:

1. Un participante solo puede ver: su nombre, los datos del evento, su propia lista y
   el nombre + la lista de la persona a la que regala. Nada más.
2. Nadie, tampoco la organización, puede consultar el mapa completo de parejas.
   `GET /api/admin/events/:eventId` no lo devuelve.
3. Un token de participante solo da acceso a su propio sorteo.
4. El sorteo se hace en el servidor (el algoritmo está en [`src/lib/draw.ts`](src/lib/draw.ts),
   sin dependencias, listo para copiar).
5. La contraseña de organización vive como secreto del Worker (`wrangler secret put ADMIN_PASSWORD`),
   nunca en el código del front.

## Participantes

| Método | Ruta                 | Cuerpo               | Respuesta                                  |
| ------ | -------------------- | -------------------- | ------------------------------------------ |
| POST   | `/api/login`         | `{ code }`           | `{ token }` — 404 si el código no existe   |
| GET    | `/api/me`            | —                    | `{ me: Me, event: EventInfo }` (su sorteo) |
| GET    | `/api/me/assignment` | —                    | `{ assignment: Assignment \| null }`       |
| GET    | `/api/me/wishlist`   | —                    | `{ wishes: Wish[] }`                       |
| PUT    | `/api/me/wishlist`   | `{ wishes: Wish[] }` | `{ wishes: Wish[] }` (con ids asignados)   |

- El código se compara sin distinguir mayúsculas y quitando espacios (`nieve 42` = `NIEVE-42`).
- `assignment` es `null` mientras no se haya hecho el sorteo.
- La primera vez que alguien llama a `/api/me/assignment` con el sorteo hecho, guardar
  `seenAt` (la organización ve "Ha entrado").
- En `PUT /api/me/wishlist` los deseos nuevos llegan con `id: ""`. Validar: texto ≤ 200
  caracteres, `url` solo `http(s)`, como mucho ~30 deseos.

## Organización: los sorteos

| Método | Ruta                          | Cuerpo                   | Respuesta                      |
| ------ | ----------------------------- | ------------------------ | ------------------------------ |
| POST   | `/api/admin/login`            | `{ password }`           | `{ token }`                    |
| GET    | `/api/admin/events`           | —                        | `{ events: EventSummary[] }`   |
| POST   | `/api/admin/events`           | `{ name, budget, date }` | `{ id }`                       |
| DELETE | `/api/admin/events/:eventId`  | —                        | `204` sin cuerpo               |

- `GET /api/admin/events` devuelve los sorteos con más recientes primero, cada uno con sus
  contadores (`participantCount`, `wishlistCount`, `seenCount`).
- `name` es obligatorio; `budget` y `date` pueden ir vacíos.
- Borrar un sorteo borra en cascada sus participantes, exclusiones, deseos, parejas y las
  sesiones de esos participantes.

## Organización: dentro de un sorteo

Todas las rutas cuelgan de `/api/admin/events/:eventId` (abreviado `…/:eventId`).
404 si el sorteo no existe.

| Método | Ruta                                 | Cuerpo                   | Respuesta    |
| ------ | ------------------------------------ | ------------------------ | ------------ |
| GET    | `…/:eventId`                         | —                        | `AdminState` |
| PATCH  | `…/:eventId`                         | `{ name, budget, date }` | `AdminState` |
| POST   | `…/:eventId/participants`            | `{ name }`               | `AdminState` |
| PATCH  | `…/:eventId/participants/:id`        | `{ name?, exclusions? }` | `AdminState` |
| DELETE | `…/:eventId/participants/:id`        | —                        | `AdminState` |
| POST   | `…/:eventId/draw`                    | —                        | `AdminState` |
| DELETE | `…/:eventId/draw`                    | —                        | `AdminState` |

- Al crear un participante se le genera un código fácil de dictar: `PALABRA-NN`
  (ver `CODE_WORDS` en el mock), único en toda la base de datos.
- Los nombres no se pueden repetir dentro del mismo sorteo (sí entre sorteos distintos).
- Las exclusiones solo pueden apuntar a gente del mismo sorteo.
- No se puede añadir ni quitar gente con el sorteo hecho (responder 400 con un mensaje).
- `POST /api/admin/draw` hace el sorteo respetando las exclusiones (en los dos sentidos) y
  pone `drawnAt`. Si no hay solución, 400 con un mensaje explicándolo.
- `DELETE /api/admin/draw` anula el sorteo (borra las parejas y los `seenAt`), pero **no**
  las listas de deseos.

## Modelo de datos sugerido (D1)

```sql
CREATE TABLE event (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, budget TEXT, date TEXT,
  drawn_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE participant (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT UNIQUE NOT NULL, seen_at TEXT,
  UNIQUE (event_id, name)
);
CREATE TABLE exclusion (participant_id TEXT, excluded_id TEXT, PRIMARY KEY (participant_id, excluded_id));
CREATE TABLE wish (id TEXT PRIMARY KEY, participant_id TEXT NOT NULL, position INTEGER, text TEXT NOT NULL, url TEXT);
CREATE TABLE pair (
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  giver_id TEXT PRIMARY KEY, receiver_id TEXT UNIQUE NOT NULL
);
CREATE TABLE session (token TEXT PRIMARY KEY, participant_id TEXT, is_admin INTEGER, created_at TEXT);
```

## Rutas del front (para el despliegue)

Es una SPA con rutas `/`, `/entrar/:code`, `/mi-sorteo`, `/organizar` (lista de sorteos) y
`/organizar/:eventId` (un sorteo). Hay que servir
`index.html` para cualquier ruta que no sea un archivo: en Cloudflare Pages funciona solo
(si no hay `404.html`); con Workers + static assets, poner
`not_found_handling = "single-page-application"` en `wrangler.toml`.
