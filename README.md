# AmigoInvisibleDeLuna

Lista de deseos para el Amigo invisible.

Aplicación web para organizar el Amigo Invisible en familia:

- **Sorteo aleatorio** de parejas (quién regala a quién).
- **Lista de deseos** por cada participante.

Se alojará en **Cloudflare** (front y base de datos).

## Stack

| Pieza          | Tecnología                                    |
| -------------- | --------------------------------------------- |
| Framework      | Vue 3 (`<script setup>`) + TypeScript         |
| Build / dev    | Vite                                          |
| Enrutado       | Vue Router                                    |
| Estado global  | Pinia                                         |
| Calidad código | ESLint + Oxlint + Prettier                    |
| Hosting        | Cloudflare (pendiente de configurar)          |

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
| `npm run type-check` | Solo comprobación de tipos TypeScript                           |
| `npm run lint`       | Revisa y corrige el código con Oxlint y ESLint                  |
| `npm run format`     | Formatea `src/` con Prettier                                    |

## Cómo funciona

- **Quien organiza** entra en `/organizar`, apunta a la familia, marca exclusiones (p. ej. parejas)
  y hace el sorteo. Cada persona tiene un código (`NIEVE-42`) y un enlace personal para mandar por WhatsApp.
  Nadie, ni la organización, ve el reparto completo.
- **Cada participante** entra con su código, descubre a quién regala (etiqueta que se gira),
  ve la lista de deseos de esa persona y escribe la suya (texto + enlace opcional).

## Modo pruebas (sin backend)

Mientras no haya backend, la app usa un simulador que guarda los datos en el navegador
(`src/api/mock.ts`). Trae una familia de ejemplo. La contraseña de organización de pruebas
es la constante `MOCK_ADMIN_PASSWORD` de ese archivo. Para conectar con la API real, mira
`.env.example` y **[API.md](API.md)**, donde están descritos todos los endpoints.

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
│   └── types.ts         # Tipos compartidos con el backend
├── API.md               # Contrato con el backend
└── index.html
```

## Despliegue en Cloudflare (referencia)

- Comando de build: `npm run build`
- Directorio de salida: `dist`
