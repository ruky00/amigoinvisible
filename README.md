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

## Estructura

```
├── public/            # Archivos estáticos servidos tal cual (favicon…)
├── src/
│   ├── App.vue        # Componente raíz
│   ├── main.ts        # Punto de entrada (monta Vue, Pinia y Router)
│   ├── router/        # Definición de rutas
│   └── stores/        # Stores de Pinia
├── index.html         # HTML base de la SPA
├── vite.config.ts     # Configuración de Vite (alias @ → src)
└── tsconfig*.json     # Configuración de TypeScript
```

## Despliegue en Cloudflare (referencia)

- Comando de build: `npm run build`
- Directorio de salida: `dist`
