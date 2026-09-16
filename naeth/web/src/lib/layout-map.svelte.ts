// Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
// No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE
// El mapa de posiciones del grafo entero, mantenido y compartido.
//
// POR QUE EXISTE. La ficha de una memoria enseña su vecindario, y ese vecindario tiene que verse
// como se ve dentro del grafo global: si no, no representa nada. Medido el 05/09/2026 en
// `docs/discovery/forma-neighborhood-2026-09-05.md`, simulando el vecindario aparte se pierde el
// **90% del orden** de los vecinos alrededor del centro, porque la física aislada convierte
// cualquier vecindario en el mismo anillo regular. Con las posiciones globales, la fidelidad es
// exacta.
//
// SE MANTIENE, NO SE CONGELA, y esa distinción es todo el diseño. Eneko: *"cuando tengamos más
// relaciones ese nodo puede llegar a cambiar de forma y quiero que cambie de forma"*. Así que
// cuando el corpus crece no se rehace el mapa desde cero (eso mueve la forma de notas que no han
// cambiado: 12 grados de deriva por jornada, contra 3 manteniéndolo), sino que se le cuenta lo
// nuevo con `update`, que conserva las posiciones de lo que sigue estando.
//
// LO QUE NO PROMETE. Una forma permanente. Al ritmo real de Naeth, **en un mes la mitad del corpus
// ha cambiado de vecindario** (227 nodos de 455 conservan el suyo exacto; a tres meses, 59). Que
// una forma cambie a esa escala no es que el mapa haya derivado: es que esa nota se relaciona ahora
// con otras cosas. La estabilidad que sí se promete es la de la jornada de trabajo.

import { buildGraph, defaultFilters } from './graph'
import { createSimulator, type Simulator } from './sim'
import { getGraph } from './api'
import { data } from './data.svelte'
import type { GraphResponse } from './types'

export interface Point {
  x: number
  y: number
}

export const layoutMap = $state<{
  /** Posiciones del grafo completo, sin filtros. Vacío hasta que el cálculo termina. */
  pos: Map<string, Point>
  ready: boolean
  computing: boolean
  /** Sube cada vez que el mapa cambia, para que las vistas se enteren. */
  version: number
}>({ pos: new Map(), ready: false, computing: false, version: 0 })

let sim: Simulator | null = null
let response: GraphResponse | null = null
/** Con cuántas memorias y vínculos se calculó lo que hay, para saber si se ha quedado viejo. */
let signature = ''

const signatureOf = (nodes: number, edges: number) => `${nodes}/${edges}`

/**
 * Asienta la simulación repartida en frames, con presupuesto de tiempo.
 *
 * El grafo entero tarda unos 620 ms en asentarse, y de una tacada eso son 37 frames perdidos: la
 * aplicación se quedaría clavada. Con un presupuesto por frame se reparte en cosa de un segundo de
 * reloj sin que nada se congele, y el presupuesto se mide en tiempo y no en ticks porque un tick
 * cuesta muy distinto con 455 nodos que con 1.100.
 */
function settleGradually(s: Simulator, alTerminar: () => void) {
  const step = () => {
    const end = performance.now() + 6
    let live = true
    while (live && performance.now() < end) live = s.step()
    if (live) requestAnimationFrame(step)
    else alTerminar()
  }
  requestAnimationFrame(step)
}

function dump(s: Simulator) {
  const m = new Map<string, Point>()
  for (const n of s.nodes) m.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })
  layoutMap.pos = m
  layoutMap.ready = true
  layoutMap.computing = false
  layoutMap.version++
}

/**
 * Pide el mapa. Es perezoso e idempotente: la primera llamada lo calcula y las siguientes no hacen
 * nada mientras el corpus no cambie.
 *
 * ⚠ LA GUARDA SE COMPRUEBA ANTES DE TOCAR LA RED, y no es un detalle de eficiencia. La primera
 * version pedía `/api/graph` y luego miraba si hacía falta, y como esta función muta `layoutMap`, que
 * las vistas leen, cada llamada reinvocaba al que la había llamado: 15 peticiones al mismo
 * endpoint por abrir una ficha. La guarda barata rompe el ciclo, y quien llama lo hace UNA vez al
 * montar en vez de desde un efecto reactivo.
 */
export async function requestMap() {
  if (layoutMap.computing) return
  const tree = data.tree
  if (!tree?.length) return

  // Firma barata, sin construir el modelo: cuántas memorias hay y cuántos vínculos trajo la última
  // respuesta. Si no ha cambiado, no hay nada que recalcular.
  if (layoutMap.ready && response && signatureOf(tree.length, response.edges.length) === signature) return

  if (!response) {
    layoutMap.computing = true
    try {
      response = await getGraph()
    } catch {
      // Sin grafo no hay mapa, y la ficha degrada a su vecindario propio. No es un error fatal.
      layoutMap.computing = false
      return
    }
  }
  signature = signatureOf(tree.length, response.edges.length)

  // Las tres capas menos la semántica, que se pide por nodo y no forma parte del grafo de partida.
  // Y SIN filtros: el mapa es del corpus entero, así que ocultar una carpeta en el grafo no cambia
  // la forma que la ficha de una memoria enseña.
  //
  // ⚠ `hideIsolated: false` A PROPÓSITO, y lo destapó un test. Con el valor por defecto, las
  // memorias sin ningún vínculo se quedaban fuera y el "mapa del grafo entero" no las tenía: al
  // abrir la ficha de una nota suelta, ni ella ni sus vecinos semánticos (que suelen ser sueltos
  // también) heredaban posición, y el vecindario volvía a inventarse una. Que no se vean en el
  // grafo grande es cosa de los filtros de ESA vista, no del mapa.
  const model = buildGraph(tree, response, new Map(), {
    ...defaultFilters(),
    hideIsolated: false,
  })

  layoutMap.computing = true
  if (sim) {
    // Mantener, no rehacer: con `update` lo que sigue estando conserva su sitio. El acomodo suave
    // es el que menos mueve lo que no ha cambiado (3,0 grados por jornada, contra 5,4 con el
    // acomodo normal y 12,0 rehaciendo desde cero).
    sim.update(model, 0.06)
  } else {
    sim = createSimulator(model)
  }
  const s = sim
  settleGradually(s, () => dump(s))
}

/** Suelta el mapa. Solo para pruebas y para cuando el corpus cambia de raíz. */
export function forgetMap() {
  sim?.stop()
  sim = null
  response = null
  signature = ''
  layoutMap.pos = new Map()
  layoutMap.ready = false
  layoutMap.computing = false
}
