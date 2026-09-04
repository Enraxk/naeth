// Colocacion de los nodos del grafo. Logica pura, sin DOM y sin Svelte.
//
// LA DECISION DE FONDO: cada COMPONENTE CONEXA se coloca por separado y luego se empaquetan las
// cajas resultantes. No es un adorno, es lo que hace legible este corpus en concreto.
//
// Medido el 04/09/2026: 24 componentes con solo relaciones (una de 269 nodos, otra de 60 y 22
// islas de 2 a 8), y 18 al encender los wikilinks. Un force global sobre eso reparte fuerzas de
// repulsion entre nodos que no se conocen de nada, asi que las islas salen despedidas hacia los
// bordes y acaban a distancias que no significan nada: parecen lejanas por no tener con quien
// atarse, no por estar lejos. Separando, cada componente se ve compacta y su sitio en el lienzo
// lo decide su tamaño, que si es informacion.
//
// ES DETERMINISTA A PROPOSITO. Las posiciones de partida salen de un generador sembrado con el id
// del nodo, no de `Math.random`, asi que el mismo grafo se dibuja siempre igual. Un layout que
// cambia en cada recarga obliga a reorientarse cada vez, y a mirar dos veces para saber si lo que
// cambio fue el corpus o el sorteo.

import type { GraphEdge, GraphModel } from './graph'

export interface Punto {
  x: number
  y: number
}

export interface Colocacion {
  pos: Map<string, Punto>
  /** Tamaño total del lienzo que hace falta para dibujarlo entero. */
  ancho: number
  alto: number
  /** Una caja por componente, en orden. Sirve para etiquetarlas o enmarcarlas. */
  cajas: { comp: number; x: number; y: number; w: number; h: number; n: number }[]
}

/** PRNG de 32 bits sembrado. Lo unico que se le pide es ser estable entre recargas. */
function sembrado(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Semilla estable a partir del id: mismo nodo, misma posicion de partida, siempre. */
function semillaDe(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Fruchterman-Reingold sobre UNA componente, centrado en el origen.
 *
 * La repulsion es O(n^2), y con la componente mayor del corpus (269 nodos) son unos 36.000 pares
 * por iteracion. A 160 iteraciones sale en decenas de milisegundos, asi que un Barnes-Hut aqui
 * seria complejidad sin problema que resolver. Si algun dia la componente mayor pasa de unos
 * 1.500 nodos, esta es la linea que hay que cambiar.
 */
function forceLocal(ids: string[], aristas: GraphEdge[], iteraciones: number): Map<string, Punto> {
  const n = ids.length
  const pos = new Map<string, Punto>()
  if (n === 0) return pos

  // Un nodo suelto no necesita simulacion, y dos tampoco: se colocan y ya.
  // El area por nodo fija la densidad. Medido el 04/09/2026 sobre el corpus real: con 5.200 la
  // componente mayor (269 nodos) daba un lienzo de 5.000 unidades de lado y el grafo entero se
  // veia como polvo; con 2.000 cabe legible y sigue sin amontonarse.
  const area = Math.max(n, 2) * 2000
  const k = Math.sqrt(area / Math.max(n, 2))
  const radio = Math.sqrt(area) / 2

  for (const id of ids) {
    const r = sembrado(semillaDe(id))
    const ang = r() * Math.PI * 2
    const d = Math.sqrt(r()) * radio
    pos.set(id, { x: Math.cos(ang) * d, y: Math.sin(ang) * d })
  }
  if (n <= 2) {
    ids.forEach((id, i) => pos.set(id, { x: i === 0 ? -k / 2 : k / 2, y: 0 }))
    return pos
  }

  const dentro = new Set(ids)
  const eds = aristas.filter((e) => dentro.has(e.source) && dentro.has(e.target))
  let t = radio / 4

  for (let it = 0; it < iteraciones; it++) {
    const dsp = new Map<string, Punto>(ids.map((id) => [id, { x: 0, y: 0 }]))

    for (let i = 0; i < n; i++) {
      const a = pos.get(ids[i])!
      const da = dsp.get(ids[i])!
      for (let j = i + 1; j < n; j++) {
        const b = pos.get(ids[j])!
        let dx = a.x - b.x
        let dy = a.y - b.y
        let d2 = dx * dx + dy * dy
        // Dos nodos exactamente encima darian division por cero. Se los separa un pelo en una
        // direccion estable, no aleatoria, para no romper el determinismo.
        if (d2 < 0.01) {
          dx = (i - j) * 0.1
          dy = 0.1
          d2 = dx * dx + dy * dy
        }
        const d = Math.sqrt(d2)
        const f = (k * k) / d
        const ux = (dx / d) * f
        const uy = (dy / d) * f
        da.x += ux
        da.y += uy
        const db = dsp.get(ids[j])!
        db.x -= ux
        db.y -= uy
      }
    }

    for (const e of eds) {
      const a = pos.get(e.source)!
      const b = pos.get(e.target)!
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01)
      const f = (d * d) / k
      const ux = (dx / d) * f
      const uy = (dy / d) * f
      const da = dsp.get(e.source)!
      const db = dsp.get(e.target)!
      da.x -= ux
      da.y -= uy
      db.x += ux
      db.y += uy
    }

    for (const id of ids) {
      const p = pos.get(id)!
      const d = dsp.get(id)!
      const len = Math.max(Math.sqrt(d.x * d.x + d.y * d.y), 0.01)
      p.x += (d.x / len) * Math.min(len, t)
      p.y += (d.y / len) * Math.min(len, t)
    }
    // Enfriamiento lineal: al final los nodos ya casi no se mueven y el dibujo se asienta.
    t = Math.max(t * 0.94, 0.3)
  }
  return pos
}

/** Caja que ocupa un conjunto de puntos, con margen. */
function caja(puntos: Punto[], margen: number) {
  const xs = puntos.map((p) => p.x)
  const ys = puntos.map((p) => p.y)
  const x0 = Math.min(...xs) - margen
  const y0 = Math.min(...ys) - margen
  return { x0, y0, w: Math.max(...xs) - x0 + margen, h: Math.max(...ys) - y0 + margen }
}

/**
 * Coloca el grafo entero: cada componente por su cuenta, y luego las cajas empaquetadas por filas
 * de mayor a menor.
 *
 * El empaquetado es por estanterias (shelf packing), que es lo mas simple que da un resultado
 * legible: las componentes grandes arriba, las islas pequeñas rellenando por debajo. Deja huecos,
 * y esta bien que los deje: un hueco entre dos islas se lee como separacion, que es justo lo que
 * son.
 */
export function colocar(
  model: GraphModel,
  opts: { ancho?: number; iteraciones?: number } = {},
): Colocacion {
  const anchoMax = opts.ancho ?? 1600
  const iteraciones = opts.iteraciones ?? 160

  const porComp = new Map<number, string[]>()
  for (const nd of model.nodes) {
    if (!porComp.has(nd.component)) porComp.set(nd.component, [])
    porComp.get(nd.component)!.push(nd.id)
  }

  const grupos = [...porComp.entries()].sort((a, b) => b[1].length - a[1].length)
  const pos = new Map<string, Punto>()
  const cajas: Colocacion['cajas'] = []

  let filaX = 0
  let filaY = 0
  let altoFila = 0

  for (const [comp, ids] of grupos) {
    const local = forceLocal(ids, model.edges, iteraciones)
    const c = caja([...local.values()], 40)

    // Salto de estanteria: si no cabe a lo ancho, se baja. La primera de cada fila entra siempre,
    // aunque sea mas ancha que el lienzo, porque el lienzo crece con ella.
    if (filaX > 0 && filaX + c.w > anchoMax) {
      filaY += altoFila
      filaX = 0
      altoFila = 0
    }
    for (const id of ids) {
      const p = local.get(id)!
      pos.set(id, { x: filaX + (p.x - c.x0), y: filaY + (p.y - c.y0) })
    }
    cajas.push({ comp, x: filaX, y: filaY, w: c.w, h: c.h, n: ids.length })
    filaX += c.w
    altoFila = Math.max(altoFila, c.h)
  }

  const ancho = Math.max(...cajas.map((b) => b.x + b.w), 1)
  const alto = Math.max(...cajas.map((b) => b.y + b.h), 1)
  return { pos, ancho, alto, cajas }
}
