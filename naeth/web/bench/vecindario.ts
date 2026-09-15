// Banco de la representacion del vecindario. Compara como sale la forma de un vecindario en la
// ficha segun de donde vengan sus posiciones.
//
// LA PREGUNTA: Eneko quiere que el vecindario de una ficha tenga la MISMA forma que ese mismo
// vecindario dentro del grafo global, para reconocer la nota por su dibujo. Hoy son dos
// simulaciones independientes con la misma fisica, asi que dan resultados parecidos pero
// distintos. Antes de cambiar la arquitectura de la aplicacion hay que ver cuanto se gana.
//
// LAS CUATRO OPCIONES:
//   A · RECORTE      El vecindario es un trozo del simulador global, tal cual. Fidelidad perfecta
//                    por definicion. Exige un simulador unico y vivo en toda la aplicacion, y con
//                    el los filtros dejan de mover el grafo.
//   B · SEMBRADO     Simulacion propia del vecindario, pero PARTIENDO de las posiciones globales.
//                    No exige nada de arquitectura mas alla de recordar las posiciones.
//   C · ACTUAL       Simulacion propia desde el empaquetado, que es lo que hay hoy.
//   D · CONGELADO    Las posiciones globales tal cual, sin simular, reescaladas para que quepan.
//                    Es A sin necesitar el simulador vivo: solo un mapa de posiciones guardado.
//
// COMO SE MIDE LA FIDELIDAD, que es la parte que no es obvia. La rotacion no importa: un
// vecindario girado se reconoce igual. Asi que se busca el giro que mejor casa las dos
// disposiciones y se mide lo que queda:
//   - error angular medio, en grados, despues de ese giro
//   - conservacion del ORDEN circular de los vecinos alrededor del centro, que es lo que el ojo
//     de verdad reconoce
// Y aparte el coste: cuanto tarda cada opcion en dar una ficha lista.

import { buildGraph, defaultFilters, neighborhood, type GraphModel } from '../src/lib/graph'
import { createSimulator, type Simulator } from '../src/lib/sim'
import type { GraphResponse, TreeRow } from '../src/lib/types'

const output = document.getElementById('salida') as HTMLPreElement
const state = document.getElementById('estado') as HTMLElement
const lienzos = document.getElementById('lienzos') as HTMLElement

type Point = { x: number; y: number }

/** Asienta una simulacion hasta que se calla, con tope por si acaso. */
function asentar(s: Simulator, cap = 400) {
  let n = 0
  while (n < cap && s.step()) n++
  return n
}

/** Posiciones de un conjunto de ids relativas a su centro. */
function relativas(pos: Map<string, Point>, ids: string[], center: string): Map<string, Point> {
  const c = pos.get(center) ?? { x: 0, y: 0 }
  const out = new Map<string, Point>()
  for (const id of ids) {
    const p = pos.get(id)
    if (p) out.set(id, { x: p.x - c.x, y: p.y - c.y })
  }
  return out
}

/**
 * Error angular medio despues del mejor giro posible.
 *
 * El giro optimo entre dos conjuntos de angulos es la media circular de sus diferencias, asi que
 * se calcula directamente en vez de probar giros.
 */
function errorAngular(a: Map<string, Point>, b: Map<string, Point>, ids: string[]): number {
  const difs: number[] = []
  for (const id of ids) {
    const pa = a.get(id)
    const pb = b.get(id)
    if (!pa || !pb) continue
    difs.push(Math.atan2(pa.y, pa.x) - Math.atan2(pb.y, pb.x))
  }
  if (!difs.length) return 0
  const sx = difs.reduce((t, d) => t + Math.cos(d), 0)
  const sy = difs.reduce((t, d) => t + Math.sin(d), 0)
  const giro = Math.atan2(sy, sx)
  let suma = 0
  for (const d of difs) {
    let e = Math.abs(d - giro)
    while (e > Math.PI) e = Math.abs(e - 2 * Math.PI)
    suma += e
  }
  return (suma / difs.length) * (180 / Math.PI)
}

/**
 * Cuanto se conserva el ORDEN circular de los vecinos.
 *
 * Se ordenan por angulo en las dos disposiciones y se cuenta que fraccion de "quien va detras de
 * quien" coincide. Es lo que el ojo reconoce: da igual el giro y da igual la distancia exacta, lo
 * que hace que un vecindario "sea el mismo" es que los vecinos esten en el mismo orden alrededor.
 */
function ordenCircular(a: Map<string, Point>, b: Map<string, Point>, ids: string[]): number {
  const orden = (m: Map<string, Point>) =>
    ids
      .filter((id) => m.has(id))
      .sort((x, y) => {
        const px = m.get(x)!
        const py = m.get(y)!
        return Math.atan2(px.y, px.x) - Math.atan2(py.y, py.x)
      })
  const oa = orden(a)
  const ob = orden(b)
  if (oa.length < 3) return 1
  const sig = (o: string[]) => new Map(o.map((id, i) => [id, o[(i + 1) % o.length]]))
  const sa = sig(oa)
  const sb = sig(ob)
  let ok = 0
  for (const [id, n] of sa) if (sb.get(id) === n) ok++
  return ok / oa.length
}

interface Row {
  opcion: string
  notes: number
  errorGrados: number
  ordenPct: number
  msPorFicha: number
  architecture: string
}

async function arranca() {
  state.textContent = 'cargando el corpus real...'
  const [tree, graph] = await Promise.all([
    fetch('/api/tree').then((r) => r.json() as Promise<TreeRow[]>),
    fetch('/api/graph').then((r) => r.json() as Promise<GraphResponse>),
  ])

  const filters = defaultFilters()
  const model = buildGraph(tree, graph, new Map(), filters)
  state.textContent = `${model.nodes.length} nodos y ${model.edges.length} aristas. Asentando el grafo global...`

  // 1) El grafo global, asentado. Es la referencia contra la que se compara todo.
  const t0 = performance.now()
  const global = createSimulator(model)
  const ticksGlobal = asentar(global)
  const msGlobal = performance.now() - t0
  const posGlobal = new Map<string, Point>(global.nodes.map((n) => [n.id, { x: n.x!, y: n.y! }]))

  // 2) Las notas de muestra: las de mas grado, que son donde la forma tiene algo que decir.
  const byDegree = [...model.nodes].sort((a, b) => b.degree - a.degree)
  const sample = byDegree.filter((n) => n.degree >= 3).slice(0, 40)

  state.textContent = `global asentado en ${Math.round(msGlobal)} ms (${ticksGlobal} ticks). Midiendo ${sample.length} vecindarios...`
  await new Promise((r) => setTimeout(r, 10))

  const acc: Record<string, { err: number[]; ord: number[]; ms: number[] }> = {
    'B · sembrado': { err: [], ord: [], ms: [] },
    'C · actual': { err: [], ord: [], ms: [] },
    'D · congelado': { err: [], ord: [], ms: [] },
  }

  /** El primer vecindario medido se guarda para dibujarlo. */
  let ejemplo: { center: string; ids: string[]; disp: Record<string, Map<string, Point>> } | null = null

  for (const nd of sample) {
    const vec = neighborhood(model, nd.id)
    const ids = vec.nodes.map((n) => n.id)
    const ref = relativas(posGlobal, ids, nd.id)

    // C · ACTUAL: simulacion propia desde cero, que es lo que hace hoy la ficha.
    const tc = performance.now()
    const simC = createSimulator(vec, { distance: 96, repulsion: -140, width: 420 })
    asentar(simC)
    const msC = performance.now() - tc
    const posC = relativas(new Map(simC.nodes.map((n) => [n.id, { x: n.x!, y: n.y! }])), ids, nd.id)

    // B · SEMBRADO: lo mismo, pero arrancando de donde estan en el global.
    const tb = performance.now()
    const simB = createSimulator(vec, { distance: 96, repulsion: -140, width: 420 })
    for (const n of simB.nodes) {
      const p = posGlobal.get(n.id)
      if (p) {
        n.x = p.x
        n.y = p.y
        n.vx = 0
        n.vy = 0
      }
    }
    asentar(simB)
    const msB = performance.now() - tb
    const posB = relativas(new Map(simB.nodes.map((n) => [n.id, { x: n.x!, y: n.y! }])), ids, nd.id)

    // D · CONGELADO: las posiciones globales tal cual, sin simular nada.
    const td = performance.now()
    const posD = relativas(posGlobal, ids, nd.id)
    const msD = performance.now() - td

    acc['C · actual'].err.push(errorAngular(ref, posC, ids))
    acc['C · actual'].ord.push(ordenCircular(ref, posC, ids))
    acc['C · actual'].ms.push(msC)
    acc['B · sembrado'].err.push(errorAngular(ref, posB, ids))
    acc['B · sembrado'].ord.push(ordenCircular(ref, posB, ids))
    acc['B · sembrado'].ms.push(msB)
    acc['D · congelado'].err.push(errorAngular(ref, posD, ids))
    acc['D · congelado'].ord.push(ordenCircular(ref, posD, ids))
    acc['D · congelado'].ms.push(msD)

    if (!ejemplo && ids.length >= 8) {
      ejemplo = { center: nd.id, ids, disp: { global: ref, 'B · sembrado': posB, 'C · actual': posC } }
    }
    simB.stop()
    simC.stop()
  }

  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1)
  const rows: Row[] = [
    {
      opcion: 'A · recorte del global',
      notes: sample.length,
      errorGrados: 0,
      ordenPct: 100,
      msPorFicha: 0,
      architecture: 'simulador unico vivo; los filtros dejan de mover el grafo',
    },
    {
      opcion: 'D · congelado',
      notes: sample.length,
      errorGrados: media(acc['D · congelado'].err),
      ordenPct: media(acc['D · congelado'].ord) * 100,
      msPorFicha: media(acc['D · congelado'].ms),
      architecture: 'solo un mapa de posiciones guardado; nada mas cambia',
    },
    {
      opcion: 'B · sembrado',
      notes: sample.length,
      errorGrados: media(acc['B · sembrado'].err),
      ordenPct: media(acc['B · sembrado'].ord) * 100,
      msPorFicha: media(acc['B · sembrado'].ms),
      architecture: 'un mapa de posiciones guardado; la ficha sigue viva',
    },
    {
      opcion: 'C · actual',
      notes: sample.length,
      errorGrados: media(acc['C · actual'].err),
      ordenPct: media(acc['C · actual'].ord) * 100,
      msPorFicha: media(acc['C · actual'].ms),
      architecture: 'lo que hay hoy; nada que cambiar',
    },
  ]

  const cab = ['opcion', 'error', 'orden', 'ms/ficha', 'que exige']
  const cuerpo = rows.map((f) => [
    f.opcion,
    f.errorGrados.toFixed(1) + ' grados',
    f.ordenPct.toFixed(0) + '%',
    f.msPorFicha.toFixed(1),
    f.architecture,
  ])
  const anchos = cab.map((c, i) => Math.max(c.length, ...cuerpo.map((r) => r[i].length)))
  const line = (r: string[]) => r.map((v, i) => v.padEnd(anchos[i])).join('  ')
  output.textContent = [
    `grafo global: ${model.nodes.length} nodos, ${model.edges.length} aristas, asentado en ${Math.round(msGlobal)} ms (${ticksGlobal} ticks)`,
    `muestra: ${sample.length} notas de grado 3 o mas`,
    '',
    line(cab),
    anchos.map((a) => '-'.repeat(a)).join('  '),
    ...cuerpo.map(line),
    '',
    'error = desviacion angular media de cada vecino respecto al global, tras el mejor giro',
    'orden = fraccion de vecinos que conservan a su vecino de al lado en el circulo',
  ].join('\n')

  if (ejemplo) dibuja(ejemplo)

  // ---------------------------------------------------------------------------------------------
  // SEGUNDA PARTE: como se sostiene el mapa cuando el corpus crece.
  //
  // La pregunta de Eneko: si la forma sale de un mapa guardado, una nota que gana relaciones tiene
  // que CAMBIAR de forma, no quedarse con la de ayer. Asi que el mapa no puede congelarse: tiene
  // que evolucionar. Se mide si eso es barato y, sobre todo, si evoluciona BIEN, es decir, si lo
  // que no ha cambiado se queda donde estaba y solo se mueve lo que tiene motivo.
  //
  // Se compara mantener el mapa (`update`, que conserva posiciones) contra rehacerlo desde cero.
  state.textContent = 'midiendo como envejece el mapa...'
  await new Promise((r) => setTimeout(r, 10))
  await creceElCorpus(tree, graph, model, posGlobal, sample.map((n) => n.id))

  state.textContent = 'terminado.'
}

/**
 * Simula el crecimiento real del corpus y mide que le pasa al mapa.
 *
 * Las notas nuevas se enganchan a notas EXISTENTES, que es como crece de verdad: lo que se escribe
 * hoy enlaza a lo de ayer. El ritmo medido el 05/09/2026 es de unas 230 memorias vigentes al mes.
 */
async function creceElCorpus(
  tree: TreeRow[],
  graph: GraphResponse,
  model: GraphModel,
  posAntes: Map<string, Point>,
  muestraIds: string[],
) {
  const rows: string[][] = []
  const ids = model.nodes.map((n) => n.id)
  let seed = 7
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  for (const [label, cuantas] of [['un dia', 8], ['un mes', 230], ['tres meses', 690]] as const) {
    // Notas nuevas con su path y una o dos relaciones a notas ya existentes.
    const newOnes: TreeRow[] = []
    const edges = [...graph.edges]
    for (let i = 0; i < cuantas; i++) {
      const id = `nueva-${label}-${i}`
      newOnes.push({
        id,
        title: `nota nueva ${i}`,
        memory_type: 'fact',
        path: 'naeth/core',
        tags: [],
        created_at: '2026-10-01T10:00:00Z',
      })
      const howMany = rnd() < 0.35 ? 2 : 1
      for (let j = 0; j < howMany; j++) {
        edges.push({
          source_id: id,
          target_id: ids[Math.floor(rnd() * ids.length)],
          predicate: 'links_to',
          n: 1,
        })
      }
    }
    const grown = buildGraph([...tree, ...newOnes], { ...graph, edges: edges }, new Map(), defaultFilters())

    // MANTENIDO: el simulador que ya estaba, al que se le cuenta lo nuevo. Se prueban dos maneras
    // de acomodarlo, porque la diferencia entre ellas es justo lo que decide si la forma de una
    // nota significa algo o es el sorteo de hoy.
    const mant = (alpha: number) => {
      const s = createSimulator(model)
      asentar(s)
      const t = performance.now()
      s.update(grown, alpha)
      const ticks = asentar(s, 400)
      const ms = performance.now() - t
      const pos = new Map<string, Point>(s.nodes.map((n) => [n.id, { x: n.x!, y: n.y! }]))
      s.stop()
      return { ticks, ms, pos }
    }
    const fuerte = mant(0.3)
    const suave = mant(0.06)

    /**
     * E · ANCLADO SELECTIVO: lo que no ha cambiado NO se mueve, y punto.
     *
     * Es la respuesta literal al requisito: una nota cambia de forma cuando SU vecindario cambia,
     * no cuando el vecino del vecino escribe algo. Se compara la adyacencia antes y despues, y los
     * nodos con la misma lista de vecinos se clavan mientras lo nuevo se acomoda. Los que ganaron o
     * perdieron vecinos quedan libres, que es justo lo que se quiere que se mueva.
     */
    const anchored = (() => {
      const s = createSimulator(model)
      asentar(s)
      const before = new Map<string, string>()
      for (const n of s.nodes) before.set(n.id, [...s.neighbors(n.id)].sort().join(','))
      const t = performance.now()
      s.update(grown, 0.3)
      let clavados = 0
      for (const n of s.nodes) {
        const a = before.get(n.id)
        if (a !== undefined && a === [...s.neighbors(n.id)].sort().join(',')) {
          s.pin(n.id, n.x!, n.y!)
          clavados++
        }
      }
      const ticks = asentar(s, 400)
      const ms = performance.now() - t
      const pos = new Map<string, Point>(s.nodes.map((n) => [n.id, { x: n.x!, y: n.y! }]))
      s.stop()
      return { ms, ticks, pos, clavados }
    })()
    const ticksM = fuerte.ticks
    const msM = fuerte.ms
    const posM = fuerte.pos

    // REHECHO: se tira el mapa y se calcula otra vez desde cero.
    const tr = performance.now()
    const rehecho = createSimulator(grown)
    asentar(rehecho)
    const msR = performance.now() - tr
    const posR = new Map<string, Point>(rehecho.nodes.map((n) => [n.id, { x: n.x!, y: n.y! }]))

    // Cuanto se movio la forma de los vecindarios que NO han cambiado, en cada caso. Lo que no ha
    // cambiado no deberia moverse: si se mueve, cada nota nueva reordena el mapa entero y la forma
    // deja de significar nada.
    const vecinosDe = new Map<string, string[]>()
    for (const id of muestraIds) {
      const v = neighborhood(model, id)
      vecinosDe.set(id, v.nodes.map((n) => n.id))
    }
    const err = (pos: Map<string, Point>) => {
      const es: number[] = []
      for (const [center, vs] of vecinosDe) {
        const sigueIgual = vs.every((x) => pos.has(x))
        if (!sigueIgual) continue
        es.push(errorAngular(relativas(posAntes, vs, center), relativas(pos, vs, center), vs))
      }
      return es.reduce((a, b) => a + b, 0) / Math.max(es.length, 1)
    }

    rows.push([
      label + ' (+' + cuantas + ')',
      Math.round(msM) + ' ms',
      ticksM + ' ticks',
      err(posM).toFixed(1) + ' grados',
      Math.round(suave.ms) + ' ms',
      err(suave.pos).toFixed(1) + ' grados',
      Math.round(anchored.ms) + ' ms',
      err(anchored.pos).toFixed(1) + ' grados',
      anchored.clavados + '',
      Math.round(msR) + ' ms',
      err(posR).toFixed(1) + ' grados',
    ])
    rehecho.stop()
    await new Promise((r) => setTimeout(r, 5))
  }

  const cab = ['crecimiento', 'normal', 'ticks', 'deriva', 'suave', 'deriva', 'anclado', 'deriva', 'clavados', 'rehacer', 'deriva']
  const anchos = cab.map((c, i) => Math.max(c.length, ...rows.map((r) => r[i].length)))
  const line = (r: string[]) => r.map((v, i) => v.padEnd(anchos[i])).join('  ')
  const bloque = [
    'COMO ENVEJECE EL MAPA (notas nuevas enganchadas a notas existentes, como crece de verdad)',
    '',
    line(cab),
    anchos.map((a) => '-'.repeat(a)).join('  '),
    ...rows.map(line),
    '',
    'deriva = cuanto se mueve la forma de los vecindarios que NO han cambiado. Cuanto mas baja,',
    'mas se puede confiar en que la forma de una nota significa algo y no es el sorteo de hoy.',
  ]
  output.textContent += String.fromCharCode(10, 10) + bloque.join(String.fromCharCode(10))
}

/** El mismo vecindario dibujado con cada opcion, para poder mirarlo y no solo leerlo. */
function dibuja(e: { center: string; ids: string[]; disp: Record<string, Map<string, Point>> }) {
  lienzos.innerHTML = ''
  for (const [name, pos] of Object.entries(e.disp)) {
    const bounds = document.createElement('figure')
    const cv = document.createElement('canvas')
    cv.width = 260
    cv.height = 260
    const ctx = cv.getContext('2d')!
    let max = 1
    for (const p of pos.values()) max = Math.max(max, Math.hypot(p.x, p.y))
    const k = 110 / max
    ctx.strokeStyle = '#8a8a95'
    ctx.lineWidth = 1
    for (const id of e.ids) {
      const p = pos.get(id)
      if (!p || id === e.center) continue
      ctx.beginPath()
      ctx.moveTo(130, 130)
      ctx.lineTo(130 + p.x * k, 130 + p.y * k)
      ctx.stroke()
    }
    for (const id of e.ids) {
      const p = pos.get(id)
      if (!p) continue
      ctx.fillStyle = id === e.center ? '#5db0ff' : '#d88a6a'
      ctx.beginPath()
      ctx.arc(130 + p.x * k, 130 + p.y * k, id === e.center ? 7 : 5, 0, Math.PI * 2)
      ctx.fill()
    }
    const cap = document.createElement('figcaption')
    cap.textContent = name
    bounds.appendChild(cv)
    bounds.appendChild(cap)
    lienzos.appendChild(bounds)
  }
}

void arranca()
