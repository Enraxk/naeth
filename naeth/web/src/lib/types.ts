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

/** Tope del digest, el mismo que el CHECK de la columna y el `DIGEST_MAX` del backend. */
export const DIGEST_MAX = 300

export interface MemoryRow {
  id: string
  title: string | null
  content: string
  /**
   * Resumen corto escrito a mano (fase 4). Es lo que `memory_search` devuelve por MCP en vez del
   * contenido entero. `null` en todo lo anterior al backfill, que va por tandas.
   */
  digest?: string | null
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
  /**
   * Estos dos los devuelve `/api/status` desde el 28/08/2026 y no estaban declarados aqui, asi que
   * ninguna vista podia pintarlos. Van OPCIONALES a proposito: si el visor acaba hablando con un
   * backend anterior (un rollback quitando `NAETH_VIEWER_DIR` deja el v1, pero al reves tambien
   * puede pasar), el tipo no debe prometer un campo que no llega. Se pintan con `?? '-'`, que es lo
   * que ya hace toda la vista Estado.
   */
  superseded?: number
  tombstones_relation?: number
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


/**
 * Una fila de `/api/authors`: el desglose de quien ha escrito el corpus, agrupado y con su conteo.
 * Existe desde el Paso 10 y hasta hoy no lo pintaba ninguna vista.
 */
export interface AuthorCount extends Author {
  n: number
}

/**
 * `/healthz`. Es la unica fuente que dice si ESTE nodo exige OAuth: `api` y `viewer` comparten
 * imagen y se distinguen solo por esa variable de entorno, asi que el dato no se puede deducir del
 * front. `oauth` llega como cadena ("enabled" / "disabled"), no como booleano.
 */
export interface Health {
  ok: boolean
  model: string
  mcp: string
  oauth: string
  oauth_provider?: string | null
  oauth_base_url?: string | null
}

// --- Grafo (Paso 5.4) ---

/** Una arista tal y como la devuelve `/api/graph`, con los extremos ya resueltos a lo vigente. */
export interface GraphEdgeRow {
  source_id: string
  target_id: string
  predicate: string
  /** Cuántas filas de `relation` colapsaron sobre esta arista al resolver la cadena. */
  n: number
}

/**
 * `/api/graph`. `nodes` es un CONTEO y no la lista: el árbol ya viaja en `data.tree` y repetirlo
 * aquí crearía dos fuentes de verdad para el título de un nodo. Sirve para detectar desfase.
 * `links` son los destinos de los `[[wikilinks]]` EN BRUTO, sin resolver: la resolución vive en
 * `wikilinks.ts`, que es donde tiene sus tests.
 */
export interface GraphResponse {
  nodes: number
  edges: GraphEdgeRow[]
  links: Record<string, string[]>
}

/** Un vecino semántico de `/api/graph/knn`. Ver el aviso sobre `sim` en `core.graph_knn`. */
export interface KnnNeighbor {
  id: string
  sim: number
}
