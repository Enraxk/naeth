// Formas de los datos de /api/* (Paso 2: capa tipada).

export type MemType =
  | 'fact' | 'observation' | 'decision' | 'preference' | 'learning' | 'error'
  | (string & {})

export interface TreeRow {
  id: string
  title: string | null
  memory_type: MemType
  path: string | null
  tags: string[]
  created_at: string | null
}

export interface MemoryRow {
  id: string
  title: string | null
  content: string
  memory_type: MemType
  tags: string[]
  path: string | null
  metadata?: Record<string, unknown>
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
