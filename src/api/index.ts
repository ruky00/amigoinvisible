import { httpApi } from './http'
import { mockApi } from './mock'

/**
 * Mientras no haya backend se usa el mock. Para usar la API real, crea un archivo
 * `.env.local` con `VITE_USE_MOCK=false` (y `VITE_API_URL` si la API va en otro dominio).
 */
export const usingMock = import.meta.env.VITE_USE_MOCK !== 'false'

export const api = usingMock ? mockApi : httpApi

export { ApiError } from './types'
