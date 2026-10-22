// Tipos compartidos entre el front y la API.
// Si el backend (Cloudflare Workers) se escribe en TypeScript, puede importar este mismo archivo.

export interface Wish {
  id: string
  /** Qué quiere: "Una taza grande", "Libro de Rosalía de Castro"… */
  text: string
  /** Enlace opcional a la tienda o a una foto */
  url?: string
}

export interface EventInfo {
  name: string
  /** Presupuesto orientativo, en texto libre: "20 €", "entre 15 y 25 €" */
  budget: string
  /** Fecha del intercambio (YYYY-MM-DD) o cadena vacía */
  date: string
  drawDone: boolean
  drawnAt: string | null
}

/** Lo que ve un participante de sí mismo */
export interface Me {
  id: string
  name: string
}

/** Lo que ve un participante de la persona a la que regala */
export interface Assignment {
  name: string
  wishlist: Wish[]
}

/** Lo que ve quien organiza. Nunca incluye a quién le ha tocado cada uno. */
export interface AdminParticipant {
  id: string
  name: string
  code: string
  /** Ids de personas a las que no le puede tocar regalar (p. ej. su pareja) */
  exclusions: string[]
  wishCount: number
  /** Cuándo abrió por primera vez su amigo invisible */
  seenAt: string | null
}

export interface AdminState {
  event: EventInfo
  participants: AdminParticipant[]
}
