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

import { buildGraph, filtrosPorDefecto, vecindario, type GraphModel } from '../src/lib/graph'
import { crearSimulador, type Simulador } from '../src/lib/sim'
import type { GraphResponse, TreeRow } from '../src/lib/types'

const salida = document.getElementById('salida') as HTMLPreElement
const estado = document.getElementById('estado') as HTMLElement
const lienzos = document.getElementById('lienzos') as HTMLElement

type Punto = { x: number; y: number }

/** Asienta una simulacion hasta que se calla, con tope por si acaso. */
function asentar(s: Simulador, tope = 400) {
  let n = 0
  while (n < tope && s.paso()) n++
  return n
}

/** Posiciones de un conjunto de ids relativas a su centro. */
function relativas(pos: Map<string, Punto>, ids: string[], centro: string): Map<string, Punto> {
  const c = pos.get(centro) ?? { x: 0, y: 0 }
  const out = new Map<string, Punto>()
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
function errorAngular(a: Map<string, Punto>, b: Map<string, Punto>, ids: string[]): number {
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
function ordenCircular(a: Map<string, Punto>, b: Map<string, Punto>, ids: string[]): number {
  const orden = (m: Map<string, Punto>) =>
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

interface Fila {
  opcion: string
  notas: number
  errorGrados: number
  ordenPct: number
  msPorFicha: number
  arquitectura: string
}

async function arranca() {
  estado.textContent = 'cargando el corpus real...'
  const [tree, graph] = await Promise.all([
    fetch('/api/tree').then((r) => r.json() as Promise<TreeRow[]>),
    fetch('/api/graph').then((r) => r.json() as Promise<GraphResponse>),
  ])

  const filtros = filtrosPorDefecto()
  const model = buildGraph(tree, graph, new Map(), filtros)
  estado.textContent = `${model.nodes.length} nodos y ${model.edges.length} aristas. Asentando el grafo global...`

  // 1) El grafo global, asentado. Es la referencia contra la que se compara todo.
  const t0 = performance.now()
  const global = crearSimulador(model)
  const ticksGlobal = asentar(global)
  const msGlobal = performance.now() - t0
  const posGlobal = new Map<string, Punto>(global.nodos.map((n) => [n.id, { x: n.x!, y: n.y! }]))

  // 2) Las notas de muestra: las de mas grado, que son donde la forma tiene algo que decir.
  const porGrado = [...model.nodes].sort((a, b) => b.degree - a.degree)
  const muestra = porGrado.filter((n) => n.degree >= 3).slice(0, 40)

  estado.textContent = `global asentado en ${Math.round(msGlobal)} ms (${ticksGlobal} ticks). Midiendo ${muestra.length} vecindarios...`
  await new Promise((r) => setTimeout(r, 10))

  const acc: Record<string, { err: number[]; ord: number[]; ms: number[] }> = {
    'B · sembrado': { err: [], ord: [], ms: [] },
    'C · actual': { err: [], ord: [], ms: [] },
    'D · congelado': { err: [], ord: [], ms: [] },
  }

  /** El primer vecindario medido se guarda para dibujarlo. */
  let ejemplo: { centro: string; ids: string[]; disp: Record<string, Map<string, Punto>> } | null = null

  for (const nd of muestra) {
    const vec = vecindario(model, nd.id)
    const ids = vec.nodes.map((n) => n.id)
    const ref = relativas(posGlobal, ids, nd.id)

    // C · ACTUAL: simulacion propia desde cero, que es lo que hace hoy la ficha.
    const tc = performance.now()
    const simC = crearSimulador(vec, { distancia: 96, repulsion: -140, ancho: 420 })
    asentar(simC)
    const msC = performance.now() - tc
    const posC = relativas(new Map(simC.nodos.map((n) => [n.id, { x: n.x!, y: n.y! }])), ids, nd.id)

    // B · SEMBRADO: lo mismo, pero arrancando de donde estan en el global.
    const tb = performance.now()
    const simB = crearSimulador(vec, { distancia: 96, repulsion: -140, ancho: 420 })
    for (const n of simB.nodos) {
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
    const posB = relativas(new Map(simB.nodos.map((n) => [n.id, { x: n.x!, y: n.y! }])), ids, nd.id)

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
      ejemplo = { centro: nd.id, ids, disp: { global: ref, 'B · sembrado': posB, 'C · actual': posC } }
    }
    simB.parar()
    simC.parar()
  }

  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1)
  const filas: Fila[] = [
    {
      opcion: 'A · recorte del global',
      notas: muestra.length,
      errorGrados: 0,
      ordenPct: 100,
      msPorFicha: 0,
      arquitectura: 'simulador unico vivo; los filtros dejan de mover el grafo',
    },
    {
      opcion: 'D · congelado',
      notas: muestra.length,
      errorGrados: media(acc['D · congelado'].err),
      ordenPct: media(acc['D · congelado'].ord) * 100,
      msPorFicha: media(acc['D · congelado'].ms),
      arquitectura: 'solo un mapa de posiciones guardado; nada mas cambia',
    },
    {
      opcion: 'B · sembrado',
      notas: muestra.length,
      errorGrados: media(acc['B · sembrado'].err),
      ordenPct: media(acc['B · sembrado'].ord) * 100,
      msPorFicha: media(acc['B · sembrado'].ms),
      arquitectura: 'un mapa de posiciones guardado; la ficha sigue viva',
    },
    {
      opcion: 'C · actual',
      notas: muestra.length,
      errorGrados: media(acc['C · actual'].err),
      ordenPct: media(acc['C · actual'].ord) * 100,
      msPorFicha: media(acc['C · actual'].ms),
      arquitectura: 'lo que hay hoy; nada que cambiar',
    },
  ]

  const cab = ['opcion', 'error', 'orden', 'ms/ficha', 'que exige']
  const cuerpo = filas.map((f) => [
    f.opcion,
    f.errorGrados.toFixed(1) + ' grados',
    f.ordenPct.toFixed(0) + '%',
    f.msPorFicha.toFixed(1),
    f.arquitectura,
  ])
  const anchos = cab.map((c, i) => Math.max(c.length, ...cuerpo.map((r) => r[i].length)))
  const linea = (r: string[]) => r.map((v, i) => v.padEnd(anchos[i])).join('  ')
  salida.textContent = [
    `grafo global: ${model.nodes.length} nodos, ${model.edges.length} aristas, asentado en ${Math.round(msGlobal)} ms (${ticksGlobal} ticks)`,
    `muestra: ${muestra.length} notas de grado 3 o mas`,
    '',
    linea(cab),
    anchos.map((a) => '-'.repeat(a)).join('  '),
    ...cuerpo.map(linea),
    '',
    'error = desviacion angular media de cada vecino respecto al global, tras el mejor giro',
    'orden = fraccion de vecinos que conservan a su vecino de al lado en el circulo',
  ].join('\n')

  if (ejemplo) dibuja(ejemplo)
  estado.textContent = 'terminado.'
}

/** El mismo vecindario dibujado con cada opcion, para poder mirarlo y no solo leerlo. */
function dibuja(e: { centro: string; ids: string[]; disp: Record<string, Map<string, Punto>> }) {
  lienzos.innerHTML = ''
  for (const [nombre, pos] of Object.entries(e.disp)) {
    const caja = document.createElement('figure')
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
      if (!p || id === e.centro) continue
      ctx.beginPath()
      ctx.moveTo(130, 130)
      ctx.lineTo(130 + p.x * k, 130 + p.y * k)
      ctx.stroke()
    }
    for (const id of e.ids) {
      const p = pos.get(id)
      if (!p) continue
      ctx.fillStyle = id === e.centro ? '#5db0ff' : '#d88a6a'
      ctx.beginPath()
      ctx.arc(130 + p.x * k, 130 + p.y * k, id === e.centro ? 7 : 5, 0, Math.PI * 2)
      ctx.fill()
    }
    const cap = document.createElement('figcaption')
    cap.textContent = nombre
    caja.appendChild(cv)
    caja.appendChild(cap)
    lienzos.appendChild(caja)
  }
}

void arranca()
