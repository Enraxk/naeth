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
  /** Indice de su componente conexa, 0 para la mayor. Ver `componentes`. */
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
  soloTransversales: boolean
  ocultarAislados: boolean
  /** Una memoria que se ve pase lo que pase, aunque los filtros la escondan. */
  exento?: string | null
  /**
   * Memorias que el arbol esconde porque su carpeta esta colapsada.
   *
   * ⚠ ESTO ES EL ARBOL GOBERNANDO EL GRAFO, decidido el 05/09/2026. Cerrar una carpeta la retira
   * del grafo, y es deliberado en los dos sentidos: lo decide un gesto explicito del usuario, y no
   * pasa nada por defecto (el arbol nace abierto). El coste hay que saberlo: al ocultar una
   * carpeta desaparecen tambien las aristas que salian de ella hacia otros proyectos, que son el
   * 24% del corpus y lo unico que el grafo cuenta y el arbol no. Por eso el modelo devuelve
   * `ocultas` y la franja lo dice: esconder tiene que verse.
   */
  ocultos?: ReadonlySet<string> | null
}

export interface GraphModel {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Cuantos nodos ha escondido `ocultarAislados`. Se enseña, porque cambia al encender capas. */
  aislados: number
  /** Cuantos ha escondido el arbol al colapsar carpetas. Se enseña por el mismo motivo. */
  ocultas: number
  /** Cuantas componentes conexas hay entre lo que queda visible. */
  componentes: number
}

export const SIN_PROYECTO = '(sin path)'

export const proyectoDe = (path: string | null | undefined): string =>
  (path || SIN_PROYECTO).split('/')[0]

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
const par = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Resuelve los destinos en bruto de `/api/graph` a ids, memoizando por cadena.
 *
 * La memoizacion no es prematura: `resolve` recorre las ~520 entradas del indice en sus pasadas
 * por prefijo, y un destino como `[[naeth/status]]` aparece muchas veces en el corpus. Va aqui y
 * no dentro de `wikilinks.ts` para no tocar una funcion que ya tiene 43 tests.
 */
function resolverDestinos(
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
function componentesDe(ids: string[], adj: Map<string, Set<string>>): Map<string, number> {
  const comp = new Map<string, number>()
  const grupos: string[][] = []
  for (const id of ids) {
    if (comp.has(id)) continue
    const grupo: string[] = []
    const cola = [id]
    comp.set(id, -1)
    while (cola.length) {
      const x = cola.pop()!
      grupo.push(x)
      for (const v of adj.get(x) ?? []) {
        if (!comp.has(v)) {
          comp.set(v, -1)
          cola.push(v)
        }
      }
    }
    grupos.push(grupo)
  }
  // La componente 0 es SIEMPRE la mayor: el dibujo la coloca en el centro, y que su indice
  // dependiera del orden de llegada de los nodos haria saltar el grafo entero al recargar.
  grupos.sort((a, b) => b.length - a.length)
  grupos.forEach((g, i) => g.forEach((id) => comp.set(id, i)))
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
  const porId = new Map(tree.map((r) => [r.id, r]))
  const ix = buildIndex(tree)

  // 1) Reunir las tres capas, cada una con su forma, sin deduplicar todavia.
  const brutas: GraphEdge[] = []
  if (data && filters.layers.relation) {
    for (const e of data.edges) {
      brutas.push({ source: e.source_id, target: e.target_id, layer: 'relation',
                    predicate: e.predicate, n: e.n })
    }
  }
  if (data && filters.layers.wikilink) {
    for (const { source, target } of resolverDestinos(data.links, ix)) {
      brutas.push({ source, target, layer: 'wikilink' })
    }
  }
  if (filters.layers.semantic) {
    for (const [source, vecinos] of knn) {
      for (const v of vecinos) {
        if (v.id !== source) brutas.push({ source, target: v.id, layer: 'semantic', sim: v.sim })
      }
    }
  }

  // 2) Deduplicar por pareja no dirigida, quedandose con la capa de mas rango y marcando que la
  //    pareja aparecia tambien mas abajo.
  const porPar = new Map<string, GraphEdge>()
  for (const e of brutas) {
    // Una arista a un nodo que no esta en el arbol no se pinta: seria un punto sin titulo ni
    // proyecto. Pasa con los vecinos semanticos de una memoria recien retirada.
    if (!porId.has(e.source) || !porId.has(e.target)) continue
    const k = par(e.source, e.target)
    const previa = porPar.get(k)
    if (!previa) {
      porPar.set(k, e)
      continue
    }
    const gana = LAYER_RANK[e.layer] < LAYER_RANK[previa.layer] ? e : previa
    const otra = gana === e ? previa : e
    porPar.set(k, { ...gana, confirmed: gana.layer !== otra.layer || gana.confirmed })
  }
  let edges = [...porPar.values()]

  // 3) Filtros de nodo, que se aplican sobre las aristas porque una arista con un extremo
  //    filtrado deja de tener sentido.
  const proyectoDeId = (id: string) => proyectoDe(porId.get(id)?.path)
  // Lo que el arbol esconde se lleva por delante sus aristas, y esto NO es opcional: sin ello el
  // grado seguiria contando vecinos que ya no se ven, y `ocultarAislados` dejaria en pie nodos
  // que en pantalla no tocan nada. Lo cazo un test antes que ningun ojo.
  if (filters.ocultos) {
    const o = filters.ocultos
    const ex = filters.exento ?? null
    const fuera = (id: string) => o.has(id) && id !== ex
    edges = edges.filter((e) => !fuera(e.source) && !fuera(e.target))
  }
  if (filters.projects) {
    const p = filters.projects
    edges = edges.filter((e) => p.has(proyectoDeId(e.source)) && p.has(proyectoDeId(e.target)))
  }
  if (filters.soloTransversales) {
    edges = edges.filter((e) => proyectoDeId(e.source) !== proyectoDeId(e.target))
  }

  // 4) Nodos, grado y componentes.
  const adj = new Map<string, Set<string>>()
  const toca = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    adj.get(a)!.add(b)
  }
  for (const e of edges) {
    toca(e.source, e.target)
    toca(e.target, e.source)
  }

  // El EXENTO no lo esconde ningun filtro. Es para lo que se senala desde el arbol: pedir ver una
  // nota y que el grafo se quede callado porque un filtro la tapaba es la peor respuesta posible,
  // y ademas invisible (no hay forma de saber que el filtro fue la causa).
  const exento = filters.exento ?? null
  const ocultos = filters.ocultos ?? null
  const conCarpeta = ocultos
    ? tree.filter((r) => r.id === exento || !ocultos.has(r.id))
    : tree
  const ocultas = tree.length - conCarpeta.length
  const visibles = filters.projects
    ? conCarpeta.filter((r) => r.id === exento || filters.projects!.has(proyectoDe(r.path)))
    : conCarpeta
  const candidatos = filters.ocultarAislados
    ? visibles.filter((r) => adj.has(r.id) || r.id === exento)
    : visibles
  const aislados = visibles.length - visibles.filter((r) => adj.has(r.id)).length

  const comp = componentesDe(candidatos.map((r) => r.id), adj)
  const nodes: GraphNode[] = candidatos.map((r) => ({
    id: r.id,
    title: r.title,
    path: r.path,
    project: proyectoDe(r.path),
    memory_type: r.memory_type,
    degree: adj.get(r.id)?.size ?? 0,
    component: comp.get(r.id) ?? 0,
  }))

  return {
    nodes,
    edges,
    aislados,
    ocultas,
    componentes: new Set(nodes.map((n) => n.component)).size,
  }
}

/** Vecindario a un salto de una memoria. Es lo que pinta el mini grafo de la ficha. */
export function vecindario(model: GraphModel, id: string): GraphModel {
  const edges = model.edges.filter((e) => e.source === id || e.target === id)
  const ids = new Set<string>([id])
  for (const e of edges) {
    ids.add(e.source)
    ids.add(e.target)
  }
  const nodes = model.nodes.filter((n) => ids.has(n.id))
  return { nodes, edges, aislados: 0, ocultas: 0, componentes: nodes.length ? 1 : 0 }
}

/**
 * Como se cuenta un vecindario, SEPARANDO los vinculos reales de los parecidos calculados.
 *
 * No es cosmetico. Verificado el 04/09/2026 sobre una nota sin ninguna relacion ni wikilink: el
 * kNN devuelve sus seis vecinos igual, asi que la cabecera decia "Vecindario · 6" y la nota
 * parecia conectada cuando esta sola. La linea discontinua ya lo insinuaba, pero un numero es
 * mas fuerte que un trazo, y era el numero el que mentia.
 */
export function etiquetaVecindario(model: GraphModel | null): string {
  const reales = model?.edges.filter((e) => e.layer !== 'semantic').length ?? 0
  const sugeridos = model?.edges.filter((e) => e.layer === 'semantic').length ?? 0
  if (reales && sugeridos) return `${reales} + ${sugeridos} sugeridos`
  if (reales) return String(reales)
  if (sugeridos) return `${sugeridos} sugerido${sugeridos === 1 ? '' : 's'}`
  return '0'
}

/** Filtros de partida: las tres capas encendidas y los aislados fuera. */
export const filtrosPorDefecto = (): GraphFilters => ({
  layers: { relation: true, wikilink: true, semantic: false },
  projects: null,
  soloTransversales: false,
  ocultarAislados: true,
  exento: null,
  ocultos: null,
})
