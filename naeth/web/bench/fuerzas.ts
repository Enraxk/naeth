// Fase 0 del panel de ajustes: cuanto cuesta mover un deslizador de fisica.
//
// LA PREGUNTA. El panel va a tener deslizadores para la distancia de arista y la repulsion. Un
// deslizador se mueve en continuo, asi que puede pedir el cambio diez veces por segundo. Y
// RECONSTRUIR el simulador esta medido y cuesta entre 265 y 411 ms de hilo bloqueado (05/09), o sea
// que a diez por segundo el grafo se congela. La salida es reconfigurar la fuerza VIVA, sin
// reconstruir nada. Aqui se mide si eso es de verdad barato.
//
// ⚠ EL DETALLE QUE HACE QUE ESTO NO SEA OBVIO. En d3, `forceLink.distance(v)` guarda el accessor
// pero NO recalcula nada: el array interno de distancias se rellena en `initialize`, que la
// simulacion llama al ASIGNAR la fuerza. Asi que cambiar la distancia de verdad obliga a
// reinicializar, y eso es O(aristas). Barato no quiere decir gratis, y por eso se mide en vez de
// suponerse.
//
// EL CRITERIO, DECLARADO ANTES DE MIRAR (plan del 06/09):
//   - por debajo de 16 ms  -> los deslizadores de fisica se aplican EN CONTINUO
//   - por encima            -> se aplican AL SOLTAR, y el panel lo dice
// 16 ms es un frame a 60 fps: por encima de eso, mover el deslizador se nota como tiron.
//
// Se mide tambien el coste de un tick y el de reconstruir, para tener la referencia al lado y no
// citar de memoria un numero de otro dia.

import { buildGraph, defaultFilters, type GraphModel } from '../src/lib/graph'
import { createSimulator } from '../src/lib/sim'
import { forceLink, forceManyBody, forceSimulation } from 'd3-force'
import type { GraphResponse, TreeRow } from '../src/lib/types'

const salida = document.getElementById('salida') as HTMLPreElement
const estado = document.getElementById('estado') as HTMLElement

const UMBRAL_CONTINUO = 16

function linea(t = '') {
  salida.textContent += t + '\n'
}

function mediana(v: number[]) {
  const s = [...v].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** Mide `fn` n veces y devuelve mediana, p90 y peor. Descarta la primera, que paga el calentamiento. */
function mide(n: number, fn: () => void) {
  const t: number[] = []
  fn()
  for (let i = 0; i < n; i++) {
    const a = performance.now()
    fn()
    t.push(performance.now() - a)
  }
  const s = [...t].sort((x, y) => x - y)
  return { med: mediana(t), p90: s[Math.floor(s.length * 0.9)], max: s[s.length - 1] }
}

const f3 = (n: number) => n.toFixed(3).padStart(8) + ' ms'

async function main() {
  estado.textContent = 'cargando el grafo real...'
  const [tree, graph] = await Promise.all([
    fetch('/api/tree').then((r) => r.json() as Promise<TreeRow[]>),
    fetch('/api/graph').then((r) => r.json() as Promise<GraphResponse>),
  ])
  const model: GraphModel = buildGraph(tree, graph, new Map(), {
    ...defaultFilters(),
    hideIsolated: false,
  })

  estado.textContent = `asentando ${model.nodes.length} nodos...`
  const sim = createSimulator(model)
  let pasos = 0
  while (pasos < 600 && sim.step()) pasos++

  // ── La simulacion d3 "desnuda", con la misma fisica y los nodos ya asentados ───────────────
  //
  // No se mide sobre el simulador de la aplicacion porque hoy NO expone sus fuerzas: eso es
  // justamente lo que la fase 2 tendria que anadir. Se replica aqui la misma configuracion sobre
  // los nodos ya colocados, que es donde vivira el ajuste.
  const nodes = sim.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, vx: 0, vy: 0 }))
  const porId = new Map(nodes.map((n) => [n.id, n]))
  const edges = model.edges
    .filter((e) => porId.has(e.source) && porId.has(e.target))
    .map((e) => ({ source: e.source, target: e.target }))

  const link = forceLink(edges as never[]).id((d: never) => (d as { id: string }).id).distance(34).strength(0.6)
  const carga = forceManyBody().strength(-38).distanceMax(600)
  const s = forceSimulation(nodes as never[]).force('link', link).force('charge', carga).stop()

  salida.textContent = ''
  linea(`CORPUS   ${model.nodes.length} nodos · ${edges.length} aristas · ${pasos} pasos hasta asentarse`)
  linea(`CRITERIO declarado antes de medir: por debajo de ${UMBRAL_CONTINUO} ms, deslizador en continuo`)
  linea()
  linea('                                                mediana      p90      peor')
  linea('  ' + '-'.repeat(74))

  let d = 34
  const distance = mide(60, () => {
    d = d === 34 ? 44 : 34
    link.distance(d)
    // Reinicializar es lo que hace que el cambio SURTA EFECTO. Sin esto la medicion seria mentira:
    // estaria midiendo guardar un numero en un campo.
    ;(link as unknown as { initialize: (n: unknown[], r: () => number) => void })
      .initialize(nodes as never[], Math.random)
  })
  linea('  cambiar la distancia de arista (viva)    ' + f3(distance.med) + f3(distance.p90) + f3(distance.max))

  let r = -38
  const repulsion = mide(60, () => {
    r = r === -38 ? -60 : -38
    carga.strength(r)
    ;(carga as unknown as { initialize: (n: unknown[], rnd: () => number) => void })
      .initialize(nodes as never[], Math.random)
  })
  linea('  cambiar la repulsion (viva)               ' + f3(repulsion.med) + f3(repulsion.p90) + f3(repulsion.max))

  const tick = mide(60, () => s.tick(1))
  linea('  un tick de la simulacion                  ' + f3(tick.med) + f3(tick.p90) + f3(tick.max))

  const recon = mide(6, () => {
    const s2 = createSimulator(model)
    s2.step()
  })
  linea('  RECONSTRUIR el simulador (la referencia)  ' + f3(recon.med) + f3(recon.p90) + f3(recon.max))

  linea()
  // ⚠ EL CRITERIO ESTABA MAL PLANTEADO, y se corrige aqui en vez de maquillarse. La primera version
  // sumaba "reconfigurar + un tick" y daba 15,6 de 16 ms: un aprobado raspado que asustaba sin
  // motivo. El tick NO lo anade el deslizador: lo paga el grafo vivo en cada frame, se toque o no se
  // toque nada. La pregunta correcta es cuanto ANADE mover el deslizador, y eso es solo reconfigurar.
  const anade = Math.max(distance.p90, repulsion.p90)
  linea('LO QUE ANADE MOVER EL DESLIZADOR (solo reconfigurar; el tick ya se paga sin tocar nada)')
  linea(`  p90: ${anade.toFixed(3)} ms de ${UMBRAL_CONTINUO} ms de presupuesto (${((anade / UMBRAL_CONTINUO) * 100).toFixed(1)}% del frame)`)
  linea()
  linea(anade < UMBRAL_CONTINUO
    ? `VEREDICTO: EN CONTINUO, y sin discusion: cuesta el ${((anade / UMBRAL_CONTINUO) * 100).toFixed(1)}% de un frame.`
    : `VEREDICTO: AL SOLTAR. No cabe en un frame, y el panel tiene que decirlo.`)
  linea(`  Reconstruir cuesta ${(recon.med / Math.max(distance.med, 0.001)).toFixed(0)}x mas que reconfigurar.`)
  linea()
  linea('⚠ HALLAZGO APARTE, Y NO ES DEL PANEL: el tick ya va justo de frame con este corpus.')
  linea(`  mediana ${tick.med.toFixed(1)} ms · p90 ${tick.p90.toFixed(1)} ms · peor ${tick.max.toFixed(1)} ms, sobre 16 ms.`)
  linea('  Importa aqui porque mover la fisica obliga a REASENTAR, o sea a encadenar ticks. Por eso')
  linea('  el deslizador debe despertar la simulacion con alpha bajo mientras se arrastra, y subirlo')
  linea('  solo al soltar. Con 532 nodos ya se nota; con 3.000 sera otra conversacion.')

  estado.textContent = 'listo'
}

main().catch((e) => {
  estado.textContent = 'fallo: ' + (e instanceof Error ? e.message : String(e))
})
