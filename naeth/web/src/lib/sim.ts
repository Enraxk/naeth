// La fisica del grafo. Logica pura: sin DOM, sin Svelte, sin canvas.
//
// POR QUE EXISTE ESTE FICHERO. El prototipo del 04/09 calculaba el grafo entero y lo pintaba ya
// asentado, y su cabecera lo decia con todas las letras: "NO ANIMA EL LAYOUT" (`GraphPlain.svelte`,
// retirado al entrar esto). Aquella decision resolvia el rendimiento y mataba la sensacion, y la
// sensacion era el encargo. Aqui vive lo que le faltaba: una simulacion que sigue viva, que se
// calma sola, que se deja empujar y que responde.
//
// POR QUE d3-force Y NO EL FRUCHTERMAN-REINGOLD PROPIO. Medido el 05/09/2026 en
// `docs/discovery/motor-grafo-2026-09-05.md`: con el corpus de hoy el propio gana por 0,6 ms
// (0,7 contra 1,3), que con los dos por debajo de 1,5 ms no significa nada; al corpus de dentro de
// un ano d3 gana por casi el doble (9,0 contra 16,0 ms), que es el quadtree de Barnes-Hut contra
// el O(n^2). Y trae resueltos `forceCollide`, `forceLink` por id, `alphaTarget` y el anclado con
// `fx`/`fy` del arrastre, que en el propio habria que escribir a mano.
//
// `layout.ts` NO SE TIRA: cambia de papel. Antes decidia la posicion final, ahora decide de donde
// se parte y donde vive cada componente. Arrancar de un empaquetado ya ordenado hace que la
// primera impresion sea buena en vez de una explosion que se ordena a los tres segundos.

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type ForceLink,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
import type { GraphEdge, GraphModel, GraphNode } from './graph'
import { place, seededRandom, seedOf } from './layout'

export interface SimNode extends SimulationNodeDatum {
  id: string
  /** El nodo del modelo. No se copian sus campos: se referencia, para que no haya dos verdades. */
  n: GraphNode
  /** Ancla de su componente: adonde tira `fuerzaComponente`. */
  ax: number
  ay: number
}

export interface SimEdge {
  source: string | SimNode
  target: string | SimNode
  e: GraphEdge
}

/**
 * El radio de un nodo dice su grado, con techo.
 *
 * Vive aqui y no en el pintor porque la colision lo necesita: si el radio de choque y el radio
 * dibujado se separan, los nodos se solapan o dejan huecos, y las dos cosas se ven.
 */
export const nodeRadius = (n: GraphNode) => 3.5 + Math.min(n.degree, 10) * 0.45

/**
 * Fuerza que mantiene cada componente en su celda SIN comprimirla.
 *
 * Es la correccion del hallazgo de la fase 0. El primer intento anclaba cada nodo a su centro con
 * una fuerza uniforme, y en la captura la componente mayor salio apelmazada en un cuadrado: a una
 * isla de dos nodos ese ancla la sujeta bien, y a la de 269 la aplasta contra su centro mas de lo
 * que la repulsion puede abrirla.
 *
 * Esta version corrige el CENTROIDE de la componente, no cada nodo. La componente entera se
 * traslada hacia su sitio y por dentro toma la forma que quiera. Es O(n) por tick.
 */
function componentForce(force = 0.9) {
  let nodes: SimNode[] = []
  const f = (alpha: number) => {
    const acc = new Map<number, { x: number; y: number; ax: number; ay: number; n: number }>()
    for (const nd of nodes) {
      let a = acc.get(nd.n.component)
      if (!a) acc.set(nd.n.component, (a = { x: 0, y: 0, ax: 0, ay: 0, n: 0 }))
      a.x += nd.x ?? 0
      a.y += nd.y ?? 0
      a.ax += nd.ax
      a.ay += nd.ay
      a.n++
    }
    for (const nd of nodes) {
      const a = acc.get(nd.n.component)!
      nd.vx = (nd.vx ?? 0) + ((a.ax - a.x) / a.n) * force * alpha
      nd.vy = (nd.vy ?? 0) + ((a.ay - a.y) / a.n) * force * alpha
    }
  }
  f.initialize = (ns: SimNode[]) => {
    nodes = ns
  }
  return f
}

/**
 * Fuerza EXPERIMENTAL que junta cada proyecto consigo mismo.
 *
 * La pregunta que contesta es de Eneko: si el grafo agrupara por proyecto, ¿se leerian mejor los
 * vinculos que cruzan? El 24% de las aristas van de un proyecto a otro (medido el 04/09), y son
 * justo las que el arbol no puede enseñar, asi que separando los proyectos esas aristas se
 * convierten en los puentes visibles entre islas.
 *
 * Tira de cada nodo hacia el CENTROIDE de su proyecto, no lo ancla a una celda fija. La diferencia
 * importa y ya se pago una vez en la fase 0 del motor: anclar a un punto aplasta los grupos
 * grandes, mientras que corregir hacia el centroide los mueve sin comprimirlos. O(n) por tick.
 *
 * A fuerza 0 no hace absolutamente nada, ni siquiera recorre los nodos.
 */
function projectForce(getFuerza: () => number) {
  let nodes: SimNode[] = []
  const f = (alpha: number) => {
    const k = getFuerza()
    if (k <= 0.001) return
    const acc = new Map<string, { x: number; y: number; n: number }>()
    for (const nd of nodes) {
      let a = acc.get(nd.n.project)
      if (!a) acc.set(nd.n.project, (a = { x: 0, y: 0, n: 0 }))
      a.x += nd.x ?? 0
      a.y += nd.y ?? 0
      a.n++
    }
    for (const nd of nodes) {
      const a = acc.get(nd.n.project)!
      if (a.n < 2) continue
      nd.vx = (nd.vx ?? 0) + (a.x / a.n - (nd.x ?? 0)) * k * 0.35 * alpha
      nd.vy = (nd.vy ?? 0) + (a.y / a.n - (nd.y ?? 0)) * k * 0.35 * alpha
    }
  }
  f.initialize = (ns: SimNode[]) => {
    nodes = ns
  }
  return f
}

export interface Simulator {
  readonly nodes: SimNode[]
  readonly edges: SimEdge[]
  /** Avanza un tick. Devuelve `false` cuando ya no queda movimiento que pintar. */
  step(): boolean
  /** Si sigue habiendo movimiento, sin avanzar nada. */
  alive(): boolean
  /** Reaviva la simulacion. Con `sostener` no se enfria hasta que se suelte. */
  reheat(alpha?: number, hold?: boolean): void
  /** Sujeta un nodo donde diga la mano. */
  pin(id: string, x: number, y: number): void
  release(id: string): void
  /**
   * Cambia el modelo CONSERVANDO la posicion de los nodos que siguen estando.
   *
   * `alpha` dice cuanto se reaviva para acomodar lo nuevo, y no es un detalle: gobierna cuanto se
   * mueve lo que NO ha cambiado. Medido el 05/09/2026, ver `bench/neighborhood.ts`.
   */
  update(model: GraphModel, alpha?: number): void
  /** El nodo mas cercano a un punto dentro de un radio, o `null`. */
  nearest(x: number, y: number, r: number): SimNode | null
  /** Vecinos de un nodo, en O(1). */
  neighbors(id: string): ReadonlySet<string>
  /** Si esta memoria esta en ESTE grafo. Ver `litFrom` para por que hace falta. */
  has(id: string): boolean
  /** Rectangulo que ocupa todo lo dibujado ahora mismo. */
  bounds(): { x0: number; y0: number; x1: number; y1: number }
  /**
   * Coloca los nodos donde diga el mapa y deja la simulacion QUIETA.
   *
   * Es lo que permite que la ficha de una memoria enseñe la disposicion que esa nota tiene en el
   * grafo global en vez de inventarse una propia. Medido el 05/09/2026
   * (`docs/discovery/forma-neighborhood-2026-09-05.md`): simulando el vecindario aparte, el 90% del
   * orden de los vecinos alrededor del centro se pierde, porque la fisica aislada convierte
   * cualquier vecindario en el mismo anillo regular.
   *
   * Quieta, no muerta: en cuanto alguien arrastra un nodo, `reheat` la despierta.
   */
  place(pos: ReadonlyMap<string, { x: number; y: number }>): void
  stop(): void
  /**
   * Cambia las fuerzas SIN reconstruir nada, y reaviva un poco para que se note.
   *
   * Es lo que permite que el panel de ajustes lleve deslizadores de fisica de verdad, que se mueven
   * en continuo. Medido el 06/09/2026 (`bench/fuerzas.html`): reconfigurar cuesta entre 0,05 y 0,2
   * ms, contra los 121-269 ms de crear el simulador otra vez. Tres ordenes de magnitud.
   *
   * ⚠ EL `initialize` NO SOBRA. En d3, `forceLink.distance(v)` guarda el valor pero no recalcula el
   * array interno de distancias, que se rellena al asignar la fuerza a la simulacion. Sin volver a
   * inicializarla, mover el deslizador no cambiaria nada en pantalla y pareceria que el mando esta
   * roto.
   *
   * `alpha` bajo mientras se arrastra y alto al soltar: un tick ya cuesta entre 3 y 17 ms con este
   * corpus, asi que reavivar del todo en cada pixel del deslizador va a tirones.
   */
  tune(
    opts: { distance?: number; repulsion?: number; damping?: number; groupByProject?: number },
    alpha?: number,
  ): void
}

export interface SimOptions {
  /** Ancho del empaquetado inicial de componentes. */
  width?: number
  /** Distancia de reposo de una arista. */
  distance?: number
  /** Repulsion entre nodos. Negativa. */
  repulsion?: number
  /** Cuanto frena el movimiento en cada tick. Alto se para antes. */
  damping?: number
  /** EXPERIMENTAL: cuanto se agrupa cada proyecto consigo mismo. 0 lo desactiva. */
  groupByProject?: number
}

/**
 * Crea el simulador de un modelo.
 *
 * ES DETERMINISTA de partida, y eso se conserva a proposito: las posiciones iniciales salen de
 * `place()`, que siembra su generador con el id de cada nodo, y a d3 se le pasa ese mismo
 * generador con `randomSource`. Un grafo que se dibuja distinto en cada recarga obliga a
 * reorientarse cada vez y a mirar dos veces para saber si lo que cambio fue el corpus o el sorteo.
 * En cuanto el usuario arrastra algo el determinismo se acaba, claro: lo que importa es el punto
 * de partida.
 */
export function createSimulator(model: GraphModel, opts: SimOptions = {}): Simulator {
  const distance = opts.distance ?? 34
  const repulsion = opts.repulsion ?? -38
  // La agrupacion por proyecto se lee por closure en cada tick, no se fija al crear: asi el
  // deslizador la mueve en vivo sin reinicializar la fuerza, que es mas barato todavia que el
  // `initialize` que si necesitan `link` y `charge`.
  let grouping = opts.groupByProject ?? 0

  const byId = new Map<string, SimNode>()
  const nodes: SimNode[] = []
  let edges: SimEdge[] = []
  const adjacency = new Map<string, Set<string>>()

  /** Centros de componente, del empaquetado por estanterias que ya teniamos. */
  function anchors(m: GraphModel) {
    const col = place(m, { width: opts.width ?? 1600, iterations: 40 })
    const centers = new Map<number, { x: number; y: number }>()
    for (const c of col.boxes) centers.set(c.comp, { x: c.x + c.w / 2, y: c.y + c.h / 2 })
    return { centers, pos: col.pos }
  }

  function rebuild(m: GraphModel) {
    const { centers, pos } = anchors(m)
    const live = new Set(m.nodes.map((n) => n.id))

    for (const n of m.nodes) {
      const c = centers.get(n.component) ?? { x: 0, y: 0 }
      const old = byId.get(n.id)
      if (old) {
        // CONSERVA LA POSICION. Es lo que hace que cambiar un filtro no sea un salto: lo que sigue
        // estando se queda donde estaba y solo se reacomoda. Medido ayer, recalcular desde cero
        // costaba entre 265 y 411 ms de hilo bloqueado.
        old.n = n
        old.ax = c.x
        old.ay = c.y
      } else {
        const p = pos.get(n.id) ?? c
        byId.set(n.id, { id: n.id, n, ax: c.x, ay: c.y, x: p.x, y: p.y, vx: 0, vy: 0 })
      }
    }
    for (const id of [...byId.keys()]) if (!live.has(id)) byId.delete(id)

    nodes.length = 0
    for (const n of m.nodes) nodes.push(byId.get(n.id)!)

    edges = m.edges
      .filter((e) => live.has(e.source) && live.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, e }))

    adjacency.clear()
    for (const e of m.edges) {
      if (!live.has(e.source) || !live.has(e.target)) continue
      let a = adjacency.get(e.source)
      if (!a) adjacency.set(e.source, (a = new Set()))
      a.add(e.target)
      let b = adjacency.get(e.target)
      if (!b) adjacency.set(e.target, (b = new Set()))
      b.add(e.source)
    }
  }

  rebuild(model)

  const sim: Simulation<SimNode, SimEdge> = forceSimulation(nodes)
    .randomSource(seededRandom(seedOf('naeth')))
    .force(
      'link',
      forceLink<SimNode, SimEdge>(edges)
        .id((d) => d.id)
        .distance(distance)
        .strength(0.6),
    )
    // `distanceMax` acota la repulsion a un vecindario: sin el, dos componentes lejanas se empujan
    // por algo que no significa nada y el lienzo se estira solo.
    .force('charge', forceManyBody<SimNode>().strength(repulsion).distanceMax(600))
    .force('collide', forceCollide<SimNode>((d) => nodeRadius(d.n) + 2))
    .force('comp', componentForce())
    .force('proy', projectForce(() => grouping))
    .velocityDecay(opts.damping ?? 0.35)
    .stop()

  return {
    get nodes() {
      return nodes
    },
    get edges() {
      return edges
    },
    step() {
      sim.tick()
      return sim.alpha() > sim.alphaMin()
    },
    alive() {
      return sim.alpha() > sim.alphaMin()
    },
    reheat(alpha = 0.35, hold = false) {
      if (hold) sim.alphaTarget(alpha)
      else sim.alphaTarget(0).alpha(Math.max(sim.alpha(), alpha))
    },
    pin(id, x, y) {
      const nd = byId.get(id)
      if (!nd) return
      nd.fx = x
      nd.fy = y
    },
    release(id) {
      const nd = byId.get(id)
      if (!nd) return
      nd.fx = null
      nd.fy = null
    },
    update(m, alpha = 0.3) {
      rebuild(m)
      sim.nodes(nodes)
      const fl = sim.force('link') as ForceLink<SimNode, SimEdge> | undefined
      fl?.links(edges)
      // Reavivar poco: lo que sigue estando ya esta colocado y solo tiene que acomodarse.
      sim.alpha(Math.max(sim.alpha(), alpha)).alphaTarget(0)
    },
    nearest(x, y, r) {
      let best: SimNode | null = null
      let d2 = r * r
      for (const nd of nodes) {
        const dx = (nd.x ?? 0) - x
        const dy = (nd.y ?? 0) - y
        const d = dx * dx + dy * dy
        if (d <= d2) {
          d2 = d
          best = nd
        }
      }
      return best
    },
    neighbors(id) {
      return adjacency.get(id) ?? EMPTY
    },

    has(id) {
      return byId.has(id)
    },
    place(pos) {
      const loose: SimNode[] = []
      let cx = 0
      let cy = 0
      let n = 0
      for (const nd of nodes) {
        const p = pos.get(nd.id)
        if (!p) {
          loose.push(nd)
          continue
        }
        nd.x = p.x
        nd.y = p.y
        nd.vx = 0
        nd.vy = 0
        cx += p.x
        cy += p.y
        n++
      }

      // ⚠ LOS QUE NO ESTAN EN EL MAPA. El vecindario de una ficha incluye vecinos SEMANTICOS, que
      // se piden por nota y no forman parte del grafo global, asi que no tienen posicion que
      // heredar. Si se les deja donde cayeron al crear el simulador, aparecen en cualquier sitio y
      // rompen la forma que se venia a conservar.
      //
      // Se les da sitio alrededor del centro de lo conocido y se les deja acomodarse unos pocos
      // ticks CON LO DEMAS CLAVADO, para que se coloquen sin arrastrar a nadie. Es el unico sitio
      // donde el anclado tiene sentido: aqui es local y dura un instante, no una politica global.
      if (loose.length && n) {
        const r = new Map(nodes.filter((x) => !loose.includes(x)).map((x) => [x.id, x]))
        loose.forEach((nd, i) => {
          const angle = (i / loose.length) * Math.PI * 2
          nd.x = cx / n + Math.cos(angle) * 60
          nd.y = cy / n + Math.sin(angle) * 60
          nd.vx = 0
          nd.vy = 0
        })
        for (const nd of r.values()) {
          nd.fx = nd.x
          nd.fy = nd.y
        }
        sim.alpha(0.5).alphaTarget(0)
        for (let i = 0; i < 80; i++) sim.tick()
        for (const nd of r.values()) {
          nd.fx = null
          nd.fy = null
        }
      }

      // Alpha a cero: el bucle pinta una vez y se calla. Sin esto la simulacion arrancaria con
      // alpha 1 y desharia en dos segundos lo que se acaba de colocar.
      sim.alpha(0).alphaTarget(0)
    },

    bounds() {
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const nd of nodes) {
        const r = nodeRadius(nd.n)
        if (nd.x! - r < x0) x0 = nd.x! - r
        if (nd.x! + r > x1) x1 = nd.x! + r
        if (nd.y! - r < y0) y0 = nd.y! - r
        if (nd.y! + r > y1) y1 = nd.y! + r
      }
      // Un grafo vacio devolveria infinitos, y de ahi salen NaN en la transformacion del pintor.
      // Un NaN en un canvas no lanza: simplemente deja de dibujar, y se pierde todo en silencio.
      if (!nodes.length) return { x0: 0, y0: 0, x1: 1, y1: 1 }
      return { x0, y0, x1, y1 }
    },
    stop() {
      sim.stop()
    },

    tune(opts, alpha = 0.15) {
      const fLink = sim.force('link') as ReturnType<typeof forceLink<SimNode, SimEdge>> | undefined
      const fCharge = sim.force('charge') as ReturnType<typeof forceManyBody<SimNode>> | undefined
      if (opts.distance !== undefined && fLink) {
        fLink.distance(opts.distance)
        fLink.initialize(nodes, Math.random)
      }
      if (opts.repulsion !== undefined && fCharge) {
        fCharge.strength(opts.repulsion)
        fCharge.initialize(nodes, Math.random)
      }
      if (opts.damping !== undefined) sim.velocityDecay(opts.damping)
      // Sin `initialize`: la fuerza lee este valor por closure en cada tick.
      if (opts.groupByProject !== undefined) grouping = opts.groupByProject
      // Reavivar, no reiniciar: `alphaTarget` a cero deja que se vuelva a dormir sola en cuanto
      // acomode el cambio, en vez de quedarse corriendo para siempre.
      if (sim.alpha() < alpha) sim.alpha(alpha)
      sim.alphaTarget(0)
    },
  }
}

const EMPTY: ReadonlySet<string> = new Set()

/**
 * Lo que se queda a plena luz: un nodo con sus vecinos, o una carpeta entera con los suyos.
 *
 * ⚠ IGNORA LOS IDS QUE NO ESTAN EN ESTE GRAFO, y esa guarda es la razon de que exista la funcion.
 * El resalte es GLOBAL (`lib/ui.svelte.ts`), asi que a un lienzo le puede llegar el id de una
 * memoria que no esta en su modelo: le pasa al mini grafo de una ficha cada vez que el raton toca
 * en el arbol una nota que no es vecina suya. Sin la guarda salia un conjunto de un solo elemento
 * inexistente, y el pintor lo leia como "hay algo enfocado" mientras ningun nodo presente pasaba el
 * filtro: el grafo entero se apagaba. Medido el 05/09/2026, el mini pasaba de 5.404 pixeles opacos
 * a CERO.
 *
 * Devuelve `null` cuando no queda nada que encender, que es lo que el pintor entiende como "no hay
 * foco" y deja el grafo como estaba. Senalar algo que no esta aqui no puede apagar lo que si esta.
 *
 * Vive fuera del componente para poder probarla: dentro del `.svelte` no la cubria ningun test, y
 * es justo donde estaba el fallo.
 */
export function litFrom(
  sim: Simulator,
  id: string | null,
  group: readonly string[] | null,
): Set<string> | null {
  if (group?.length) {
    const s = new Set<string>()
    for (const g of group) {
      if (!sim.has(g)) continue
      s.add(g)
      for (const v of sim.neighbors(g)) s.add(v)
    }
    return s.size ? s : null
  }
  if (id && sim.has(id)) return new Set([id, ...sim.neighbors(id)])
  return null
}
