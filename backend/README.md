# Amigo invisible · API (Spring Boot)

Backend del Amigo invisible: implementa la API descrita en [`../API.md`](../API.md), la que usa
el front de Vue.

- Java 21 · Spring Boot 4.1.2 · Maven (con wrapper, no hace falta instalar Maven)
- Base de datos: **H2** en un fichero (para desarrollar, sin instalar nada) o **PostgreSQL**
- Esquema versionado con **Flyway** (`src/main/resources/db/migration`)

Todos los comandos se lanzan **desde esta carpeta `backend/`**. Cada bloque tiene dos versiones:

- **Windows (PowerShell)**: usa `.\mvnw.cmd`
- **macOS / Linux / Git Bash**: usa `./mvnw`

---

## 1. Requisitos

| Qué | Para qué | Cómo comprobarlo |
| --- | --- | --- |
| **JDK 21** (p. ej. [Eclipse Temurin 21](https://adoptium.net/)) | Siempre | `java -version` → debe decir `21` |
| **Docker** (Docker Desktop) | Solo si quieres PostgreSQL o ejecutar todo en contenedores | `docker --version` |

La primera vez, el wrapper (`mvnw`) descarga Maven y las dependencias: tarda unos minutos.

---

## 2. Arrancar en local con H2 (lo más fácil)

No necesita base de datos instalada: los datos se guardan en `backend/data/` y sobreviven a
reinicios. Trae **sorteos de ejemplo** (ver [sección 7](#7-datos-de-ejemplo)).

PowerShell:

```powershell
.\mvnw.cmd spring-boot:run
```

macOS / Linux / Git Bash:

```bash
./mvnw spring-boot:run
```

Cuando veas `Started AmigoInvisibleApplication`, está listo en **http://localhost:8080**.
Para pararlo: `Ctrl + C`.

**¿Funciona?** Abre http://localhost:8080/actuator/health → debe responder `{"status":"UP"}`.

### Ver la base de datos (consola H2)

1. Abre http://localhost:8080/h2-console
2. Rellena:
   - **JDBC URL**: `jdbc:h2:file:./data/amigoinvisible;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;AUTO_SERVER=TRUE`
   - **User Name**: `sa`
   - **Password**: (vacía)
3. Pulsa **Connect**.

¿Quieres empezar de cero? Para la app y borra la carpeta `backend/data/`.

---

## 3. Tests

Usan una base H2 en memoria; no tocan tus datos.

PowerShell:

```powershell
.\mvnw.cmd test
```

macOS / Linux / Git Bash:

```bash
./mvnw test
```

---

## 4. Arrancar con PostgreSQL (Docker)

### Opción A: PostgreSQL en Docker y la app en tu ordenador

1. (Opcional) Copia `.env.example` como `.env` si quieres cambiar contraseñas o puertos.
2. Arranca la base de datos:

   ```bash
   docker compose up -d
   ```

   (Mismo comando en PowerShell y en bash.) `docker compose ps` debe mostrar `db` como `healthy`.

3. Arranca la app con el perfil `postgres`:

   PowerShell:

   ```powershell
   .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=postgres"
   ```

   macOS / Linux / Git Bash:

   ```bash
   ./mvnw spring-boot:run -Dspring-boot.run.profiles=postgres
   ```

   > En PowerShell las comillas alrededor de `-D...` son necesarias.

Si cambiaste algo en `.env`, la app **no** lo lee sola (solo Docker lo lee): pásale las mismas
variables en la terminal antes de arrancar, p. ej. en PowerShell `$env:DB_PASSWORD = "otra"`, en
bash `export DB_PASSWORD=otra`. Con los valores por defecto no hace falta nada.

Con PostgreSQL **no** se cargan los sorteos de ejemplo salvo que pongas `DEMO_DATA=true`.

### Opción B: todo en Docker (base de datos + API)

```bash
docker compose --profile app up -d --build
```

Construye la imagen con el `Dockerfile` y la arranca en http://localhost:8080 cuando PostgreSQL
está listo. Ver logs: `docker compose logs -f api`.

### Parar

```bash
docker compose --profile app down        # para todo; los datos se quedan
docker compose --profile app down -v     # para todo y BORRA los datos de PostgreSQL
```

---

## 5. Generar el `.jar` y ejecutarlo

PowerShell:

```powershell
.\mvnw.cmd -DskipTests package
java -jar target\amigo-invisible-api-0.0.1-SNAPSHOT.jar
```

macOS / Linux / Git Bash:

```bash
./mvnw -DskipTests package
java -jar target/amigo-invisible-api-0.0.1-SNAPSHOT.jar
```

Sin más, arranca con H2. Para PostgreSQL añade `--spring.profiles.active=postgres` al final.

---

## 6. Conectar el front de Vue

Dos terminales:

1. **Terminal 1 (backend)**, en `backend/`: `.\mvnw.cmd spring-boot:run` (o `./mvnw spring-boot:run`).
2. **Terminal 2 (front)**, en la carpeta raíz del proyecto:
   - Crea el archivo `.env.local` con esta línea:

     ```
     VITE_USE_MOCK=false
     ```

   - Arranca: `npm run dev` y abre http://localhost:5173

`VITE_API_URL` se deja **vacía**: en desarrollo, Vite reenvía todo lo que empieza por `/api` a
`http://localhost:8080` (proxy en `vite.config.ts`). Si cambias `.env.local`, reinicia `npm run dev`.
Para volver al simulador, borra `.env.local` o pon `VITE_USE_MOCK=true`.

---

## 7. Datos de ejemplo

Con el perfil `h2` (o con `DEMO_DATA=true`) se cargan, **solo si la base de datos está vacía**,
los mismos sorteos que el simulador del front:

| Sorteo | Participantes y códigos |
| --- | --- |
| Papá Noel · Familia (ya sorteado) | Luna `NIEVE-42`, Carlos `RENO-11`, Abuela Carmen `TURRON-23`, Tío Paco `ACEBO-35`, Marta `ESTRELLA-47` |
| Camisetas raras · Equipo (sin sortear) | Luna `TRINEO-58`, Dani `COMETA-62`, Irene `VELA-74`, Rober `BELEN-86` |

- Entrar como participante: http://localhost:5173/entrar/NIEVE-42
- Zona de organización: http://localhost:5173/organizar, contraseña **`turron`** (solo en desarrollo).

---

## 8. Configuración (variables de entorno)

| Variable | Por defecto | Qué es |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | `h2` (en la imagen Docker: `postgres`) | `h2` o `postgres` |
| `PORT` | `8080` | Puerto HTTP de la API |
| `ADMIN_PASSWORD` | `turron` | Contraseña de `/organizar`. **Cámbiala fuera de tu ordenador** |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Dominios del front que pueden llamar a la API, separados por comas |
| `DB_HOST` | `localhost` | Servidor PostgreSQL (perfil `postgres`) |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `DB_NAME` | `amigoinvisible` | Nombre de la base de datos |
| `DB_USER` | `amigo` | Usuario |
| `DB_PASSWORD` | `amigo` | Contraseña |
| `DEMO_DATA` | `false` | `true` = carga los datos de ejemplo en PostgreSQL si está vacía |

Los ficheros de configuración están en `src/main/resources/`: `application.yml` (común),
`application-h2.yml` y `application-postgres.yml`. `.env.example` lista las variables que usa
`docker-compose.yml`.

---

## 9. Estructura del código

```
backend/
├── src/main/java/com/amigoinvisible/
│   ├── AmigoInvisibleApplication.java   # punto de entrada
│   ├── auth/      # login, sesiones (tokens), límite de intentos, protección de /api/admin
│   ├── common/    # errores ({ "error": "..." }), utilidades
│   ├── config/    # propiedades app.*, CORS, reloj
│   ├── domain/    # entidades JPA y repositorios (sorteo, participante, deseo)
│   ├── dto/       # objetos JSON de entrada/salida (coinciden con src/types.ts del front)
│   ├── me/        # API del participante: /api/login, /api/me/...
│   ├── admin/     # API de organización: /api/admin/...
│   ├── draw/      # algoritmo del sorteo (con exclusiones)
│   └── demo/      # carga de los datos de ejemplo
├── src/main/resources/
│   ├── application*.yml
│   └── db/migration/V1__init.sql        # esquema inicial (Flyway)
├── src/test/                            # tests
├── Dockerfile · docker-compose.yml · .env.example
└── pom.xml
```

---

## 10. Cambiar la base de datos (migraciones Flyway)

Flyway aplica los ficheros de `src/main/resources/db/migration/` en orden y recuerda cuáles ya
aplicó en cada base de datos.

1. **Nunca edites `V1__init.sql`** (ni ninguna migración ya aplicada): Flyway detecta el cambio y
   la app no arranca.
2. Crea un fichero nuevo con el siguiente número, p. ej. `V2__add_wish_price.sql`
   (dos guiones bajos después del número):

   ```sql
   ALTER TABLE wish ADD COLUMN price VARCHAR(30);
   ```

3. Actualiza la entidad JPA correspondiente en `domain/`. Hibernate está en modo `validate`:
   si la entidad y la tabla no coinciden, la app avisa al arrancar.
4. Usa SQL que funcione en PostgreSQL **y** en H2 (modo PostgreSQL), y lanza los tests.

---

## 11. Seguridad

- **`ADMIN_PASSWORD`**: en cualquier sitio que no sea tu ordenador, ponla por variable de entorno
  y que sea larga. `turron` es solo para desarrollo.
- **Límite de intentos**: tras 10 logins fallidos desde la misma IP en 10 minutos, se bloquean más
  intentos un rato (frena que alguien adivine códigos). Detrás de un proxy (Cloudflare, etc.) hay
  que activar `SERVER_FORWARD_HEADERS_STRATEGY=framework` para que la API vea la IP real y no la
  del proxy.
- **Tokens**: al entrar, la API da un token que el front manda como `Authorization: Bearer ...`.
  Las sesiones duran 90 días (los participantes vuelven a mirar la lista durante semanas).
- **CORS**: solo los dominios de `CORS_ALLOWED_ORIGINS` pueden llamar a la API desde el navegador.
- La consola H2 solo existe en el perfil `h2`; en producción se usa `postgres`.
- Usa siempre **HTTPS** en producción (los códigos y tokens viajan en cada petición).

---

## 12. Despliegue

Lo importante, sin rodeos: **Cloudflare Workers y Cloudflare Pages no pueden ejecutar Java** (no hay
JVM ahí). Este backend es un contenedor Docker normal, así que las opciones son:

1. **Cloudflare Containers**: ejecuta esta misma imagen Docker (el `Dockerfile` de esta carpeta)
   detrás de un Worker. Cloudflare **no ofrece PostgreSQL**, así que la base de datos va en un
   proveedor externo gestionado (Neon, Supabase, AWS RDS…). Cloudflare **Hyperdrive** puede ponerse
   delante de ese PostgreSQL externo para acelerar las conexiones.
2. **El contenedor en otro sitio** (Render, Fly.io, Railway, un VPS con Docker…) junto a un
   PostgreSQL gestionado, y **Cloudflare delante** (DNS/proxy, HTTPS) apuntando a ese servidor.

En ambos casos:

- Variables mínimas: `SPRING_PROFILES_ACTIVE=postgres`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
  `DB_PASSWORD`, `ADMIN_PASSWORD` (segura) y `CORS_ALLOWED_ORIGINS`. Si va detrás de un proxy, añade
  `SERVER_FORWARD_HEADERS_STRATEGY=framework`. Si el proveedor de PostgreSQL exige SSL, puede hacer
  falta añadir `?sslmode=require` a la conexión (configurable con `SPRING_DATASOURCE_URL`).
- Las tablas las crea Flyway solo, al arrancar la primera vez.
- Comprobación de salud para la plataforma: `GET /actuator/health`.

**El front** puede seguir en **Cloudflare Pages** (build `npm run build`, salida `dist`), con estas
variables de build:

- `VITE_USE_MOCK=false`
- `VITE_API_URL=https://<dominio-de-la-api>` (sin `/api` al final; el front lo añade)

Y en la API, `CORS_ALLOWED_ORIGINS` **debe incluir el dominio del front**, p. ej.
`CORS_ALLOWED_ORIGINS=https://amigoinvisible.pages.dev,https://amigo.midominio.com`.
