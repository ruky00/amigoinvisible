import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // En `npm run dev`, las llamadas a /api van al backend Spring Boot (backend/README.md).
    // Así VITE_API_URL puede quedarse vacía y no hay problemas de CORS.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
