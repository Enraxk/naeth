// Formas de los datos de /api/* (Paso 2: capa tipada).

/**
 * Los cuatro tipos de la convencion. El `(string & {})` no es decorativo: mantiene el autocompletado
 * de los cuatro y a la vez deja pasar cualquier cadena, que es lo que permite que una nota escrita
 * con un tipo que ya no se ofrece (hoy, las dos de `reference`) siga siendo legible y editable en
 * vez de romper el tipado del arbol entero.
 */
export type MemType =
  | 'fact' | 'observation' | 'decision' | 'preference'
  | (string & {})

export interface TreeRow {
  id: string
  title: string | null
  memory_type: MemType
  path: string | null
  tags: string[]
  created_at: string | null
}

/**
 * Autoria explicita de una memoria (Paso 10). Todos los campos son opcionales a proposito: las
 * notas anteriores al backfill llegan con `model` a null y algunas sin `surface`.
 *
 * `product` y `surface` son VERIFICABLES (salen del clientInfo y del endpoint por el que entro la
 * escritura); `model` lo DECLARA el agente. La diferencia la registra `model_source`.
 */
export interface Author {
  product?: string | null
  surface?: string | null
  zone?: string | null
  actor?: string | null
  vendor?: string | null
  model?: string | null
  model_source?: string | null
}

export interface MemoryRow {
  id: string
  title: string | null
  content: string
  memory_type: MemType
  tags: string[]
  path: string | null
  metadata?: Record<string, unknown>
  author?: Author | null
  created_at: string | null
}

export interface Supersession {
  child_id: string
  parent_id: string
  created_at: string | null
}

export interface MemoryDetail {
  memory: MemoryRow
  supersession: Supersession[]
}

export interface Counts {
  memory_total: number
  memory_current: number
  pendientes_embed: number
  relations: number
  tombstones: number
}

export interface Queue {
  pending: number
  processing: number
  done: number
  error: number
  avg_lag_s: number | null
}

export interface Status {
  counts: Counts
  queue: Queue
  embed_model: string
  embed_dim: number
}

export interface Relation {
  id: string
  source_id: string
  target_id: string
  predicate: string
  direction: 'in' | 'out'
}
