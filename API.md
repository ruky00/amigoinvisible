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

## Reglas de privacidad (importante)

El front solo pide "lo mío", pero **quien garantiza la privacidad es el backend**:

1. Un participante solo puede ver: su nombre, los datos del evento, su propia lista y
   el nombre + la lista de la persona a la que regala. Nada más.
2. Nadie, tampoco la organización, puede consultar el mapa completo de parejas.
   `GET /api/admin` no lo devuelve.
3. El sorteo se hace en el servidor (el algoritmo está en [`src/lib/draw.ts`](src/lib/draw.ts),
   sin dependencias, listo para copiar).
4. La contraseña de organización vive como secreto del Worker (`wrangler secret put ADMIN_PASSWORD`),
   nunca en el código del front.

## Participantes

| Método | Ruta                 | Cuerpo               | Respuesta                                  |
| ------ | -------------------- | -------------------- | ------------------------------------------ |
| POST   | `/api/login`         | `{ code }`           | `{ token }` — 404 si el código no existe   |
| GET    | `/api/me`            | —                    | `{ me: Me, event: EventInfo }`             |
| GET    | `/api/me/assignment` | —                    | `{ assignment: Assignment \| null }`       |
| GET    | `/api/me/wishlist`   | —                    | `{ wishes: Wish[] }`                       |
| PUT    | `/api/me/wishlist`   | `{ wishes: Wish[] }` | `{ wishes: Wish[] }` (con ids asignados)   |

- El código se compara sin distinguir mayúsculas y quitando espacios (`nieve 42` = `NIEVE-42`).
- `assignment` es `null` mientras no se haya hecho el sorteo.
- La primera vez que alguien llama a `/api/me/assignment` con el sorteo hecho, guardar
  `seenAt` (la organización ve "Ha entrado").
- En `PUT /api/me/wishlist` los deseos nuevos llegan con `id: ""`. Validar: texto ≤ 200
  caracteres, `url` solo `http(s)`, como mucho ~30 deseos.

## Organización

| Método | Ruta                          | Cuerpo                       | Respuesta    |
| ------ | ----------------------------- | ---------------------------- | ------------ |
| POST   | `/api/admin/login`            | `{ password }`               | `{ token }`  |
| GET    | `/api/admin`                  | —                            | `AdminState` |
| PATCH  | `/api/admin/event`            | `{ name, budget, date }`     | `AdminState` |
| POST   | `/api/admin/participants`     | `{ name }`                   | `AdminState` |
| PATCH  | `/api/admin/participants/:id` | `{ name?, exclusions? }`     | `AdminState` |
| DELETE | `/api/admin/participants/:id` | —                            | `AdminState` |
| POST   | `/api/admin/draw`             | —                            | `AdminState` |
| DELETE | `/api/admin/draw`             | —                            | `AdminState` |

- Al crear un participante se le genera un código fácil de dictar: `PALABRA-NN`
  (ver `CODE_WORDS` en el mock).
- No se puede añadir ni quitar gente con el sorteo hecho (responder 400 con un mensaje).
- `POST /api/admin/draw` hace el sorteo respetando las exclusiones (en los dos sentidos) y
  pone `drawnAt`. Si no hay solución, 400 con un mensaje explicándolo.
- `DELETE /api/admin/draw` anula el sorteo (borra las parejas y los `seenAt`), pero **no**
  las listas de deseos.

## Modelo de datos sugerido (D1)

```sql
CREATE TABLE event (id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT, budget TEXT, date TEXT, drawn_at TEXT);
CREATE TABLE participant (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL, seen_at TEXT);
CREATE TABLE exclusion (participant_id TEXT, excluded_id TEXT, PRIMARY KEY (participant_id, excluded_id));
CREATE TABLE wish (id TEXT PRIMARY KEY, participant_id TEXT NOT NULL, position INTEGER, text TEXT NOT NULL, url TEXT);
CREATE TABLE pair (giver_id TEXT PRIMARY KEY, receiver_id TEXT UNIQUE NOT NULL);
CREATE TABLE session (token TEXT PRIMARY KEY, participant_id TEXT, is_admin INTEGER, created_at TEXT);
```

## Rutas del front (para el despliegue)

Es una SPA con rutas `/`, `/entrar/:code`, `/mi-sorteo` y `/organizar`. Hay que servir
`index.html` para cualquier ruta que no sea un archivo: en Cloudflare Pages funciona solo
(si no hay `404.html`); con Workers + static assets, poner
`not_found_handling = "single-page-application"` en `wrangler.toml`.
