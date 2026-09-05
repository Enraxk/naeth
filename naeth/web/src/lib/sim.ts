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
import { colocar, sembrado, semillaDe } from './layout'

export interface NodoSim extends SimulationNodeDatum {
  id: string
  /** El nodo del modelo. No se copian sus campos: se referencia, para que no haya dos verdades. */
  n: GraphNode
  /** Ancla de su componente: adonde tira `fuerzaComponente`. */
  ax: number
  ay: number
}

export interface AristaSim {
  source: string | NodoSim
  target: string | NodoSim
  e: GraphEdge
}

/**
 * El radio de un nodo dice su grado, con techo.
 *
 * Vive aqui y no en el pintor porque la colision lo necesita: si el radio de choque y el radio
 * dibujado se separan, los nodos se solapan o dejan huecos, y las dos cosas se ven.
 */
export const radioNodo = (n: GraphNode) => 3.5 + Math.min(n.degree, 10) * 0.45

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
function fuerzaComponente(fuerza = 0.9) {
  let nodos: NodoSim[] = []
  const f = (alpha: number) => {
    const acc = new Map<number, { x: number; y: number; ax: number; ay: number; n: number }>()
    for (const nd of nodos) {
      let a = acc.get(nd.n.component)
      if (!a) acc.set(nd.n.component, (a = { x: 0, y: 0, ax: 0, ay: 0, n: 0 }))
      a.x += nd.x ?? 0
      a.y += nd.y ?? 0
      a.ax += nd.ax
      a.ay += nd.ay
      a.n++
    }
    for (const nd of nodos) {
      const a = acc.get(nd.n.component)!
      nd.vx = (nd.vx ?? 0) + ((a.ax - a.x) / a.n) * fuerza * alpha
      nd.vy = (nd.vy ?? 0) + ((a.ay - a.y) / a.n) * fuerza * alpha
    }
  }
  f.initialize = (ns: NodoSim[]) => {
    nodos = ns
  }
  return f
}

export interface Simulador {
  readonly nodos: NodoSim[]
  readonly aristas: AristaSim[]
  /** Avanza un tick. Devuelve `false` cuando ya no queda movimiento que pintar. */
  paso(): boolean
  /** Si sigue habiendo movimiento, sin avanzar nada. */
  viva(): boolean
  /** Reaviva la simulacion. Con `sostener` no se enfria hasta que se suelte. */
  agitar(alpha?: number, sostener?: boolean): void
  /** Sujeta un nodo donde diga la mano. */
  sujetar(id: string, x: number, y: number): void
  soltar(id: string): void
  /**
   * Cambia el modelo CONSERVANDO la posicion de los nodos que siguen estando.
   *
   * `alpha` dice cuanto se reaviva para acomodar lo nuevo, y no es un detalle: gobierna cuanto se
   * mueve lo que NO ha cambiado. Medido el 05/09/2026, ver `bench/vecindario.ts`.
   */
  cambiar(model: GraphModel, alpha?: number): void
  /** El nodo mas cercano a un punto dentro de un radio, o `null`. */
  cerca(x: number, y: number, r: number): NodoSim | null
  /** Vecinos de un nodo, en O(1). */
  vecinos(id: string): ReadonlySet<string>
  /** Si esta memoria esta en ESTE grafo. Ver `encendidosDe` para por que hace falta. */
  tiene(id: string): boolean
  /** Rectangulo que ocupa todo lo dibujado ahora mismo. */
  caja(): { x0: number; y0: number; x1: number; y1: number }
  /**
   * Coloca los nodos donde diga el mapa y deja la simulacion QUIETA.
   *
   * Es lo que permite que la ficha de una memoria enseñe la disposicion que esa nota tiene en el
   * grafo global en vez de inventarse una propia. Medido el 05/09/2026
   * (`docs/discovery/forma-vecindario-2026-09-05.md`): simulando el vecindario aparte, el 90% del
   * orden de los vecinos alrededor del centro se pierde, porque la fisica aislada convierte
   * cualquier vecindario en el mismo anillo regular.
   *
   * Quieta, no muerta: en cuanto alguien arrastra un nodo, `agitar` la despierta.
   */
  colocar(pos: ReadonlyMap<string, { x: number; y: number }>): void
  parar(): void
}

export interface OpcionesSim {
  /** Ancho del empaquetado inicial de componentes. */
  ancho?: number
  /** Distancia de reposo de una arista. */
  distancia?: number
  /** Repulsion entre nodos. Negativa. */
  repulsion?: number
}

/**
 * Crea el simulador de un modelo.
 *
 * ES DETERMINISTA de partida, y eso se conserva a proposito: las posiciones iniciales salen de
 * `colocar()`, que siembra su generador con el id de cada nodo, y a d3 se le pasa ese mismo
 * generador con `randomSource`. Un grafo que se dibuja distinto en cada recarga obliga a
 * reorientarse cada vez y a mirar dos veces para saber si lo que cambio fue el corpus o el sorteo.
 * En cuanto el usuario arrastra algo el determinismo se acaba, claro: lo que importa es el punto
 * de partida.
 */
export function crearSimulador(model: GraphModel, opts: OpcionesSim = {}): Simulador {
  const distancia = opts.distancia ?? 34
  const repulsion = opts.repulsion ?? -38

  const porId = new Map<string, NodoSim>()
  const nodos: NodoSim[] = []
  let aristas: AristaSim[] = []
  const adyacencia = new Map<string, Set<string>>()

  /** Centros de componente, del empaquetado por estanterias que ya teniamos. */
  function anclas(m: GraphModel) {
    const col = colocar(m, { ancho: opts.ancho ?? 1600, iteraciones: 40 })
    const centros = new Map<number, { x: number; y: number }>()
    for (const c of col.cajas) centros.set(c.comp, { x: c.x + c.w / 2, y: c.y + c.h / 2 })
    return { centros, pos: col.pos }
  }

  function reconstruir(m: GraphModel) {
    const { centros, pos } = anclas(m)
    const vivos = new Set(m.nodes.map((n) => n.id))

    for (const n of m.nodes) {
      const c = centros.get(n.component) ?? { x: 0, y: 0 }
      const viejo = porId.get(n.id)
      if (viejo) {
        // CONSERVA LA POSICION. Es lo que hace que cambiar un filtro no sea un salto: lo que sigue
        // estando se queda donde estaba y solo se reacomoda. Medido ayer, recalcular desde cero
        // costaba entre 265 y 411 ms de hilo bloqueado.
        viejo.n = n
        viejo.ax = c.x
        viejo.ay = c.y
      } else {
        const p = pos.get(n.id) ?? c
        porId.set(n.id, { id: n.id, n, ax: c.x, ay: c.y, x: p.x, y: p.y, vx: 0, vy: 0 })
      }
    }
    for (const id of [...porId.keys()]) if (!vivos.has(id)) porId.delete(id)

    nodos.length = 0
    for (const n of m.nodes) nodos.push(porId.get(n.id)!)

    aristas = m.edges
      .filter((e) => vivos.has(e.source) && vivos.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, e }))

    adyacencia.clear()
    for (const e of m.edges) {
      if (!vivos.has(e.source) || !vivos.has(e.target)) continue
      let a = adyacencia.get(e.source)
      if (!a) adyacencia.set(e.source, (a = new Set()))
      a.add(e.target)
      let b = adyacencia.get(e.target)
      if (!b) adyacencia.set(e.target, (b = new Set()))
      b.add(e.source)
    }
  }

  reconstruir(model)

  const sim: Simulation<NodoSim, AristaSim> = forceSimulation(nodos)
    .randomSource(sembrado(semillaDe('naeth')))
    .force(
      'link',
      forceLink<NodoSim, AristaSim>(aristas)
        .id((d) => d.id)
        .distance(distancia)
        .strength(0.6),
    )
    // `distanceMax` acota la repulsion a un vecindario: sin el, dos componentes lejanas se empujan
    // por algo que no significa nada y el lienzo se estira solo.
    .force('charge', forceManyBody<NodoSim>().strength(repulsion).distanceMax(600))
    .force('collide', forceCollide<NodoSim>((d) => radioNodo(d.n) + 2))
    .force('comp', fuerzaComponente())
    .velocityDecay(0.35)
    .stop()

  return {
    get nodos() {
      return nodos
    },
    get aristas() {
      return aristas
    },
    paso() {
      sim.tick()
      return sim.alpha() > sim.alphaMin()
    },
    viva() {
      return sim.alpha() > sim.alphaMin()
    },
    agitar(alpha = 0.35, sostener = false) {
      if (sostener) sim.alphaTarget(alpha)
      else sim.alphaTarget(0).alpha(Math.max(sim.alpha(), alpha))
    },
    sujetar(id, x, y) {
      const nd = porId.get(id)
      if (!nd) return
      nd.fx = x
      nd.fy = y
    },
    soltar(id) {
      const nd = porId.get(id)
      if (!nd) return
      nd.fx = null
      nd.fy = null
    },
    cambiar(m, alpha = 0.3) {
      reconstruir(m)
      sim.nodes(nodos)
      const fl = sim.force('link') as ForceLink<NodoSim, AristaSim> | undefined
      fl?.links(aristas)
      // Reavivar poco: lo que sigue estando ya esta colocado y solo tiene que acomodarse.
      sim.alpha(Math.max(sim.alpha(), alpha)).alphaTarget(0)
    },
    cerca(x, y, r) {
      let mejor: NodoSim | null = null
      let d2 = r * r
      for (const nd of nodos) {
        const dx = (nd.x ?? 0) - x
        const dy = (nd.y ?? 0) - y
        const d = dx * dx + dy * dy
        if (d <= d2) {
          d2 = d
          mejor = nd
        }
      }
      return mejor
    },
    vecinos(id) {
      return adyacencia.get(id) ?? VACIO
    },

    tiene(id) {
      return porId.has(id)
    },
    colocar(pos) {
      const sueltos: NodoSim[] = []
      let cx = 0
      let cy = 0
      let n = 0
      for (const nd of nodos) {
        const p = pos.get(nd.id)
        if (!p) {
          sueltos.push(nd)
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
      if (sueltos.length && n) {
        const r = new Map(nodos.filter((x) => !sueltos.includes(x)).map((x) => [x.id, x]))
        sueltos.forEach((nd, i) => {
          const ang = (i / sueltos.length) * Math.PI * 2
          nd.x = cx / n + Math.cos(ang) * 60
          nd.y = cy / n + Math.sin(ang) * 60
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

    caja() {
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const nd of nodos) {
        const r = radioNodo(nd.n)
        if (nd.x! - r < x0) x0 = nd.x! - r
        if (nd.x! + r > x1) x1 = nd.x! + r
        if (nd.y! - r < y0) y0 = nd.y! - r
        if (nd.y! + r > y1) y1 = nd.y! + r
      }
      // Un grafo vacio devolveria infinitos, y de ahi salen NaN en la transformacion del pintor.
      // Un NaN en un canvas no lanza: simplemente deja de dibujar, y se pierde todo en silencio.
      if (!nodos.length) return { x0: 0, y0: 0, x1: 1, y1: 1 }
      return { x0, y0, x1, y1 }
    },
    parar() {
      sim.stop()
    },
  }
}

const VACIO: ReadonlySet<string> = new Set()

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
export function encendidosDe(
  sim: Simulador,
  id: string | null,
  grupo: readonly string[] | null,
): Set<string> | null {
  if (grupo?.length) {
    const s = new Set<string>()
    for (const g of grupo) {
      if (!sim.tiene(g)) continue
      s.add(g)
      for (const v of sim.vecinos(g)) s.add(v)
    }
    return s.size ? s : null
  }
  if (id && sim.tiene(id)) return new Set([id, ...sim.vecinos(id)])
  return null
}
