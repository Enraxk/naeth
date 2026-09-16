// Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
// No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE
// Modelo del grafo: todo lo que NO es pintar.
//
// Vive aparte del componente a proposito. Los dos prototipos de estetica (heptapoda y sobria)
// consumen exactamente este modelo, asi que la comparacion entre ellos es de dibujo y no de
// datos: si cada uno construyera su grafo, cualquier diferencia visual podria venir de que uno
// tiene mas aristas que el otro, y la eleccion dejaria de significar nada.
//
// Y porque asi se puede probar. La regla del repo es Vitest sobre logica pura, sin DOM: la fusion
// de tres capas con deduplicacion y las componentes conexas son justo el sitio donde un fallo no
// se ve, simplemente enseña otro grafo.

import type { GraphResponse, KnnNeighbor, MemType, TreeRow } from './types'
import { buildIndex, resolve, type WikiIndex } from './wikilinks'

/** Las tres capas, en orden de prioridad al deduplicar. Ver `LAYER_RANK`. */
export type EdgeLayer = 'relation' | 'wikilink' | 'semantic'

export interface GraphNode {
  id: string
  title: string | null
  path: string | null
  /** Primer segmento del path. Es lo que colorea el nodo y lo que agrupa el arbol. */
  project: string
  memory_type: MemType
  degree: number
  /** Indice de su componente conexa, 0 para la mayor. Ver `components`. */
  component: number
}

export interface GraphEdge {
  source: string
  target: string
  layer: EdgeLayer
  /** Solo en las de relacion. */
  predicate?: string
  /** Cuantas filas de `relation` colapsaron. Solo en las de relacion. */
  n?: number
  /** La misma pareja existe ADEMAS en otra capa por debajo. Ver la nota de `LAYER_RANK`. */
  confirmed?: boolean
  /** Solo en las semanticas. NO es un porcentaje de parecido: ver `core.graph_knn`. */
  sim?: number
}

export interface GraphFilters {
  layers: Record<EdgeLayer, boolean>
  /** `null` = todos los proyectos. Un conjunto vacio no es lo mismo: es "ninguno". */
  projects: Set<string> | null
  /** Solo las aristas que cruzan de un proyecto a otro. */
  crossOnly: boolean
  hideIsolated: boolean
  /** Una memoria que se ve pase lo que pase, aunque los filtros la escondan. */
  exempt?: string | null
  /**
   * Memorias que el arbol esconde porque su carpeta esta colapsada.
   *
   * ⚠ ESTO ES EL ARBOL GOBERNANDO EL GRAFO, decidido el 05/09/2026. Cerrar una carpeta la retira
   * del grafo, y es deliberado en los dos sentidos: lo decide un gesto explicito del usuario, y no
   * pasa nada por defecto (el arbol nace abierto). El coste hay que saberlo: al ocultar una
   * carpeta desaparecen tambien las aristas que salian de ella hacia otros proyectos, que son el
   * 24% del corpus y lo unico que el grafo cuenta y el arbol no. Por eso el modelo devuelve
   * `hiddenEdges` y la franja lo dice: esconder tiene que verse.
   */
  hidden?: ReadonlySet<string> | null
}

export interface GraphModel {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Cuantos nodos ha escondido `hideIsolated`. Se enseña, porque cambia al encender capas. */
  isolated: number
  /** Cuantos ha escondido el arbol al colapsar carpetas. Se enseña por el mismo motivo. */
  hiddenEdges: number
  /** Cuantas componentes conexas hay entre lo que queda visible. */
  components: number
}

export const NO_PROJECT = '(sin path)'

export const projectOf = (path: string | null | undefined): string =>
  (path || NO_PROJECT).split('/')[0]

/**
 * Prioridad al deduplicar: una relacion es una afirmacion deliberada, un wikilink es una mencion
 * en el texto, y un vecino semantico es un parecido calculado. Cuando la misma pareja aparece en
 * varias, gana la de arriba y la arista queda marcada como `confirmed`.
 *
 * MEDIDO el 04/09/2026, y es lo que hace que esto importe: de las 290 aristas que producen los
 * wikilinks, solo 128 coinciden con una relacion. Las otras 162 son parejas que NO estan en la
 * tabla `relation`, asi que fundir las capas sin marcar cual es cual perderia justo el dato de
 * cuanto se separan las dos.
 */
const LAYER_RANK: Record<EdgeLayer, number> = { relation: 0, wikilink: 1, semantic: 2 }

/**
 * Clave no dirigida: A->B y B->A son la MISMA arista del dibujo.
 *
 * ⚠ POR ESO EL MODELO CUENTA MENOS ARISTAS QUE `/api/graph`, y no es un fallo. El backend agrupa
 * por `(source, target, predicate)` porque le interesa conservar el predicado; el dibujo agrupa
 * por pareja, porque dos lineas entre los mismos dos puntos se solapan y no se distinguen.
 * Medido contra el corpus el 04/09/2026: 479 aristas en el endpoint y 476 en el modelo. Quien
 * compare los dos numeros sin saber esto va a buscar un bug que no existe.
 * El separador va explicito y no es un espacio porque un espacio invisible en una clave es
 * justo lo que nadie mira cuando dos parejas colisionan. Un uuid no contiene `|`.
 */
const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Resuelve los destinos en bruto de `/api/graph` a ids, memoizando por cadena.
 *
 * La memoizacion no es prematura: `resolve` recorre las ~520 entradas del indice en sus pasadas
 * por prefijo, y un destino como `[[naeth/status]]` aparece muchas veces en el corpus. Va aqui y
 * no dentro de `wikilinks.ts` para no tocar una funcion que ya tiene 43 tests.
 */
function resolveTargets(
  links: Record<string, string[]>,
  ix: WikiIndex,
): { source: string; target: string }[] {
  const cache = new Map<string, string | null>()
  const out: { source: string; target: string }[] = []
  for (const [source, destinos] of Object.entries(links)) {
    for (const d of destinos) {
      let hit = cache.get(d)
      if (hit === undefined) {
        hit = resolve(d, ix)?.id ?? null
        cache.set(d, hit)
      }
      // Un wikilink a uno mismo no es una arista: es una nota citandose, y en el dibujo seria un
      // lazo que no dice nada.
      if (hit && hit !== source) out.push({ source, target: hit })
    }
  }
  return out
}

/** Componentes conexas por recorrido en anchura. Devuelve el indice de componente por nodo. */
function componentsOf(ids: string[], adj: Map<string, Set<string>>): Map<string, number> {
  const comp = new Map<string, number>()
  const groups: string[][] = []
  for (const id of ids) {
    if (comp.has(id)) continue
    const group: string[] = []
    const queue = [id]
    comp.set(id, -1)
    while (queue.length) {
      const x = queue.pop()!
      group.push(x)
      for (const v of adj.get(x) ?? []) {
        if (!comp.has(v)) {
          comp.set(v, -1)
          queue.push(v)
        }
      }
    }
    groups.push(group)
  }
  // La componente 0 es SIEMPRE la mayor: el dibujo la coloca en el centro, y que su indice
  // dependiera del orden de llegada de los nodos haria saltar el grafo entero al recargar.
  groups.sort((a, b) => b.length - a.length)
  groups.forEach((g, i) => g.forEach((id) => comp.set(id, i)))
  return comp
}

/**
 * Construye el grafo visible a partir del arbol, la respuesta del backend, los vecinos semanticos
 * ya pedidos y los filtros.
 *
 * `knn` llega como mapa y no se pide aqui porque esta funcion es pura: quien decide de que nodos
 * hay vecinos semanticos es la vista, segun lo que el usuario haya enfocado o expandido.
 */
export function buildGraph(
  tree: TreeRow[],
  data: GraphResponse | null,
  knn: Map<string, KnnNeighbor[]>,
  filters: GraphFilters,
): GraphModel {
  const byId = new Map(tree.map((r) => [r.id, r]))
  const ix = buildIndex(tree)

  // 1) Reunir las tres capas, cada una con su forma, sin deduplicar todavia.
  const raw: GraphEdge[] = []
  if (data && filters.layers.relation) {
    for (const e of data.edges) {
      raw.push({ source: e.source_id, target: e.target_id, layer: 'relation',
                    predicate: e.predicate, n: e.n })
    }
  }
  if (data && filters.layers.wikilink) {
    for (const { source, target } of resolveTargets(data.links, ix)) {
      raw.push({ source, target, layer: 'wikilink' })
    }
  }
  if (filters.layers.semantic) {
    for (const [source, neighbors] of knn) {
      for (const v of neighbors) {
        if (v.id !== source) raw.push({ source, target: v.id, layer: 'semantic', sim: v.sim })
      }
    }
  }

  // 2) Deduplicar por pareja no dirigida, quedandose con la capa de mas rango y marcando que la
  //    pareja aparecia tambien mas abajo.
  const byPair = new Map<string, GraphEdge>()
  for (const e of raw) {
    // Una arista a un nodo que no esta en el arbol no se pinta: seria un punto sin titulo ni
    // proyecto. Pasa con los vecinos semanticos de una memoria recien retirada.
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    const k = pair(e.source, e.target)
    const previous = byPair.get(k)
    if (!previous) {
      byPair.set(k, e)
      continue
    }
    const wins = LAYER_RANK[e.layer] < LAYER_RANK[previous.layer] ? e : previous
    const other = wins === e ? previous : e
    byPair.set(k, { ...wins, confirmed: wins.layer !== other.layer || wins.confirmed })
  }
  let edges = [...byPair.values()]

  // 3) Filtros de nodo, que se aplican sobre las aristas porque una arista con un extremo
  //    filtrado deja de tener sentido.
  const projectOfId = (id: string) => projectOf(byId.get(id)?.path)
  // Lo que el arbol esconde se lleva por delante sus aristas, y esto NO es opcional: sin ello el
  // grado seguiria contando vecinos que ya no se ven, y `hideIsolated` dejaria en pie nodos
  // que en pantalla no tocan nada. Lo cazo un test antes que ningun ojo.
  if (filters.hidden) {
    const o = filters.hidden
    const ex = filters.exempt ?? null
    const outside = (id: string) => o.has(id) && id !== ex
    edges = edges.filter((e) => !outside(e.source) && !outside(e.target))
  }
  if (filters.projects) {
    const p = filters.projects
    edges = edges.filter((e) => p.has(projectOfId(e.source)) && p.has(projectOfId(e.target)))
  }
  if (filters.crossOnly) {
    edges = edges.filter((e) => projectOfId(e.source) !== projectOfId(e.target))
  }

  // 4) Nodos, grado y componentes.
  const adj = new Map<string, Set<string>>()
  const touches = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    adj.get(a)!.add(b)
  }
  for (const e of edges) {
    touches(e.source, e.target)
    touches(e.target, e.source)
  }

  // El EXENTO no lo esconde ningun filtro. Es para lo que se senala desde el arbol: pedir ver una
  // nota y que el grafo se quede callado porque un filtro la tapaba es la peor respuesta posible,
  // y ademas invisible (no hay forma de saber que el filtro fue la causa).
  const exempt = filters.exempt ?? null
  const hidden = filters.hidden ?? null
  const withFolder = hidden
    ? tree.filter((r) => r.id === exempt || !hidden.has(r.id))
    : tree
  const hiddenEdges = tree.length - withFolder.length
  const visible = filters.projects
    ? withFolder.filter((r) => r.id === exempt || filters.projects!.has(projectOf(r.path)))
    : withFolder
  const candidates = filters.hideIsolated
    ? visible.filter((r) => adj.has(r.id) || r.id === exempt)
    : visible
  const isolated = visible.length - visible.filter((r) => adj.has(r.id)).length

  const comp = componentsOf(candidates.map((r) => r.id), adj)
  const nodes: GraphNode[] = candidates.map((r) => ({
    id: r.id,
    title: r.title,
    path: r.path,
    project: projectOf(r.path),
    memory_type: r.memory_type,
    degree: adj.get(r.id)?.size ?? 0,
    component: comp.get(r.id) ?? 0,
  }))

  return {
    nodes,
    edges,
    isolated,
    hiddenEdges,
    components: new Set(nodes.map((n) => n.component)).size,
  }
}

/** Vecindario a un salto de una memoria. Es lo que pinta el mini grafo de la ficha. */
export function neighborhood(model: GraphModel, id: string): GraphModel {
  const edges = model.edges.filter((e) => e.source === id || e.target === id)
  const ids = new Set<string>([id])
  for (const e of edges) {
    ids.add(e.source)
    ids.add(e.target)
  }
  const nodes = model.nodes.filter((n) => ids.has(n.id))
  return { nodes, edges, isolated: 0, hiddenEdges: 0, components: nodes.length ? 1 : 0 }
}

/**
 * Como se cuenta un vecindario, SEPARANDO los vinculos reales de los parecidos calculados.
 *
 * No es cosmetico. Verificado el 04/09/2026 sobre una nota sin ninguna relacion ni wikilink: el
 * kNN devuelve sus seis vecinos igual, asi que la cabecera decia "Vecindario · 6" y la nota
 * parecia conectada cuando esta sola. La linea discontinua ya lo insinuaba, pero un numero es
 * mas fuerte que un trazo, y era el numero el que mentia.
 */
export function neighborhoodLabel(model: GraphModel | null): string {
  const real = model?.edges.filter((e) => e.layer !== 'semantic').length ?? 0
  const suggested = model?.edges.filter((e) => e.layer === 'semantic').length ?? 0
  if (real && suggested) return `${real} + ${suggested} sugeridos`
  if (real) return String(real)
  if (suggested) return `${suggested} sugerido${suggested === 1 ? '' : 's'}`
  return '0'
}

/** Filtros de partida: las tres capas encendidas y los aislados fuera. */
export const defaultFilters = (): GraphFilters => ({
  layers: { relation: true, wikilink: true, semantic: false },
  projects: null,
  crossOnly: false,
  hideIsolated: true,
  exempt: null,
  hidden: null,
})
