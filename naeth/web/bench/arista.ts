// Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
// No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE
// Banco del CANAL DE LA ARISTA: cuanto sitio hay de verdad para decir algo en un trazo.
//
// LA PREGUNTA. Tres entradas de la lista del grafo quieren hablar por la arista: la DIRECCION de la
// relacion (G-A, 501 relaciones y cero reciprocas) y el TIPO (G-B, `links_to` 286, `derived_from`
// 165, `depends_on` 48). Antes de decidir COMO se pinta cada una hay que saber CUANTO mide una
// arista en pantalla, porque a encuadre completo el grafo entero cabe en un lienzo y cada trazo se
// queda en unos pocos pixeles. Una punta de flecha de 4 px no es una flecha: es un pixel sucio.
//
// Y hay un canal ya ocupado que acota las respuestas: **el patron del trazo es de las tres capas**
// (relacion solida, wikilink punteada, semantica discontinua), asi que el tipo de relacion NO puede
// usarlo. Le quedan el color y el grosor.
//
// QUE MIDE, en dos mitades:
//
//   1. ARITMETICA. Asienta el grafo real, calcula el `k` de encuadre con la MISMA formula que
//      `Canvas.svelte` (min(w/ancho, h/alto) * 0.9, y 0.72 en el compacto) y convierte las
//      longitudes de arista a pixeles. Percentiles, y cuantas superan cada umbral de legibilidad.
//
//   2. PERCEPTIVA, que es la que no se puede deducir. Pinta las candidatas A SU TAMANO REAL
//      medido, no a un tamano comodo de demostracion. Es la unica forma de contestar si una punta
//      de flecha se lee a 9 px, porque el numero solo no lo dice.
//
// LOS UMBRALES, declarados ANTES de medir para que la comparacion no este amanada:
//   - 10 px: minimo para una punta de flecha con dos lados distinguibles
//   - 18 px: minimo para tres ciclos de un patron (lo que hace falta para leerlo como patron)
//   - 30 px: minimo para que un degradado a lo largo del trazo se perciba como direccion
// Salen de que el trazo mide 1,2 px de ancho: por debajo de unas 8 veces el ancho, el ojo ve un
// punto y no una forma.

import { buildGraph, defaultFilters, type GraphModel } from '../src/lib/graph'
import { createSimulator } from '../src/lib/sim'
import type { GraphResponse, TreeRow } from '../src/lib/types'

const output = document.getElementById('salida') as HTMLPreElement
const state = document.getElementById('estado') as HTMLElement
const muestras = document.getElementById('muestras') as HTMLElement

const UMBRAL_FLECHA = 10
const UMBRAL_PATRON = 18
const DEGRADED_THRESHOLD = 30

/** Los tamanos que existen de verdad, no los que serian comodos. */
const LIENZOS = [
  { name: 'escritorio', w: 1400, h: 900, compact: false },
  { name: 'portatil', w: 1100, h: 700, compact: false },
  { name: 'movil', w: 375, h: 520, compact: false },
]

// ⚠ EL MINI DE LA FICHA NO ES UN LIENZO PEQUENO CON EL GRAFO ENTERO, y meterlo en la tabla de
// arriba fue el primer error de este banco: daba 3,7 px de mediana y "nada cabe", que es cierto
// para un caso que no ocurre nunca. El mini enseña UN VECINDARIO, ocho nodos y no 532, asi que su
// encuadre es muchisimo mayor. Se mide aparte, vecindario por vecindario, con las posiciones
// heredadas del mapa global (que es lo que hace el mini de verdad desde el 05/09).
const MINI = { w: 276, h: 220, factor: 0.72 }

function percentil(v: number[], p: number) {
  if (!v.length) return 0
  const i = (v.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (i - lo)
}

/** Asienta hasta que la simulacion se calla, con tope. */
function asentar(s: ReturnType<typeof createSimulator>, cap = 600) {
  let n = 0
  while (n < cap && s.step()) n++
  return n
}

/** El mismo calculo que `encuadraTodo` en Lienzo.svelte, sin copiar mas de lo necesario. */
function escalaEncuadre(bounds: { x0: number; y0: number; x1: number; y1: number },
                        w: number, h: number, compact: boolean) {
  const k = Math.min(w / Math.max(bounds.x1 - bounds.x0, 1), h / Math.max(bounds.y1 - bounds.y0, 1)) *
    (compact ? 0.72 : 0.9)
  return Math.min(k, 4)
}

function line(txt = '') {
  output.textContent += txt + '\n'
}

// ── Las candidatas ────────────────────────────────────────────────────────────────────────
//
// Cada una recibe un contexto ya trasladado y girado: la arista va de (0,0) a (largo,0). Asi la
// candidata solo se ocupa de decir la direccion, y no de la trigonometria.

type Candidata = { name: string; note: string; paint: (c: CanvasRenderingContext2D, length: number) => void }

const TINTA = '#c8c9d4'

const DIRECTION: Candidata[] = [
  {
    name: 'punta de flecha',
    note: 'lo que hace Obsidian',
    paint(c, length) {
      c.strokeStyle = TINTA
      c.lineWidth = 1.2
      c.beginPath()
      c.moveTo(0, 0)
      c.lineTo(length, 0)
      c.stroke()
      const a = Math.min(5, length * 0.35)
      c.beginPath()
      c.moveTo(length, 0)
      c.lineTo(length - a, -a * 0.55)
      c.moveTo(length, 0)
      c.lineTo(length - a, a * 0.55)
      c.stroke()
    },
  },
  {
    name: 'degradado',
    note: 'transparente en el origen, opaco en el destino',
    paint(c, length) {
      const g = c.createLinearGradient(0, 0, length, 0)
      g.addColorStop(0, 'rgba(200,201,212,0.12)')
      g.addColorStop(1, 'rgba(200,201,212,0.95)')
      c.strokeStyle = g
      c.lineWidth = 1.2
      c.beginPath()
      c.moveTo(0, 0)
      c.lineTo(length, 0)
      c.stroke()
    },
  },
  {
    name: 'trazo que engorda',
    note: 'fino en el origen, grueso en el destino',
    paint(c, length) {
      c.fillStyle = TINTA
      c.beginPath()
      c.moveTo(0, -0.35)
      c.lineTo(length, -1.5)
      c.lineTo(length, 1.5)
      c.lineTo(0, 0.35)
      c.closePath()
      c.fill()
    },
  },
  {
    name: 'punto en el destino',
    note: 'no ocupa largo, ocupa ancho',
    paint(c, length) {
      c.strokeStyle = TINTA
      c.lineWidth = 1.2
      c.beginPath()
      c.moveTo(0, 0)
      c.lineTo(length, 0)
      c.stroke()
      c.fillStyle = TINTA
      c.beginPath()
      c.arc(length, 0, 1.9, 0, Math.PI * 2)
      c.fill()
    },
  },
  {
    name: 'curva asimetrica',
    note: 'se lee en el conjunto, no en una arista',
    paint(c, length) {
      c.strokeStyle = TINTA
      c.lineWidth = 1.2
      c.beginPath()
      c.moveTo(0, 0)
      c.quadraticCurveTo(length * 0.5, -length * 0.16, length, 0)
      c.stroke()
    },
  },
]

const TYPE: Candidata[] = [
  {
    name: 'color',
    note: 'tres tintes. El patron NO esta libre: lo usan las capas',
    paint(c, length) {
      const tintes = ['#6ba6e8', '#b394e3', '#4dbba7']
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = tintes[i]
        c.lineWidth = 1.2
        c.beginPath()
        c.moveTo(0, i * 5 - 5)
        c.lineTo(length, i * 5 - 5)
        c.stroke()
      }
    },
  },
  {
    name: 'grosor',
    note: 'tres grosores, que compiten con el peso de la arista',
    paint(c, length) {
      const grosores = [0.7, 1.4, 2.4]
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = TINTA
        c.lineWidth = grosores[i]
        c.beginPath()
        c.moveTo(0, i * 5 - 5)
        c.lineTo(length, i * 5 - 5)
        c.stroke()
      }
    },
  },
]

function pintaMuestra(cand: Candidata, length: number, height = 26) {
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(length + 16, 40)
  const cv = document.createElement('canvas')
  cv.width = w * dpr
  cv.height = height * dpr
  cv.style.width = w + 'px'
  cv.style.height = height + 'px'
  const c = cv.getContext('2d')!
  c.scale(dpr, dpr)
  c.translate(8, height / 2)
  cand.paint(c, length)
  return cv
}

async function main() {
  state.textContent = 'cargando el grafo real...'
  const [tree, graph] = await Promise.all([
    fetch('/api/tree').then((r) => r.json() as Promise<TreeRow[]>),
    fetch('/api/graph').then((r) => r.json() as Promise<GraphResponse>),
  ])

  // El mismo modelo que usa el mapa compartido: sin ocultar aisladas, porque el mapa las necesita.
  const model: GraphModel = buildGraph(tree, graph, new Map(), {
    ...defaultFilters(),
    hideIsolated: false,
  })

  state.textContent = `asentando ${model.nodes.length} nodos y ${model.edges.length} aristas...`
  const sim = createSimulator(model)
  const steps = asentar(sim)

  const pos = new Map(sim.nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]))
  const largos: number[] = []
  for (const e of model.edges) {
    const a = pos.get(e.source)
    const b = pos.get(e.target)
    if (a && b) largos.push(Math.hypot(b.x - a.x, b.y - a.y))
  }
  largos.sort((x, y) => x - y)

  const bounds = sim.bounds()
  state.textContent = `listo: ${model.nodes.length} nodos, ${largos.length} aristas, ${steps} pasos`

  output.textContent = ''
  line(`GRAFO REAL   ${model.nodes.length} nodos · ${largos.length} aristas · ${steps} pasos hasta asentarse`)
  line(`CAJA         ${Math.round(bounds.x1 - bounds.x0)} x ${Math.round(bounds.y1 - bounds.y0)} unidades de mundo`)
  line(`ARISTA       en unidades: p10 ${percentil(largos, 0.1).toFixed(1)} · mediana ${percentil(largos, 0.5).toFixed(1)} · p90 ${percentil(largos, 0.9).toFixed(1)}`)
  line()
  line('A ENCUADRE COMPLETO, que es como se abre el grafo:')
  line()
  line('  lienzo             k       p10      mediana      p90    >=10px   >=18px   >=30px')
  line('  ' + '-'.repeat(78))

  const rows: { name: string; k: number; mediana: number }[] = []
  for (const L of LIENZOS) {
    const k = escalaEncuadre(bounds, L.w, L.h, L.compact)
    const px = (u: number) => u * k
    const count = (t: number) => largos.filter((l) => px(l) >= t).length
    const pc = (n: number) => ((n / largos.length) * 100).toFixed(0) + '%'
    line(
      '  ' + L.name.padEnd(18) +
      k.toFixed(3).padStart(5) +
      (px(percentil(largos, 0.1)).toFixed(1) + ' px').padStart(10) +
      (px(percentil(largos, 0.5)).toFixed(1) + ' px').padStart(12) +
      (px(percentil(largos, 0.9)).toFixed(1) + ' px').padStart(10) +
      pc(count(UMBRAL_FLECHA)).padStart(9) +
      pc(count(UMBRAL_PATRON)).padStart(9) +
      pc(count(DEGRADED_THRESHOLD)).padStart(9),
    )
    rows.push({ name: L.name, k, mediana: px(percentil(largos, 0.5)) })
  }

  // ── El mini de la ficha, medido como es y no como seria comodo ────────────────────────────
  //
  // Para cada nodo con vecinos: su vecindario hereda las posiciones del mapa global, se encuadra en
  // 276x220 con el factor del compacto, y se miden SUS aristas en pixeles.
  const ady = new Map<string, Set<string>>()
  for (const e of model.edges) {
    if (!ady.has(e.source)) ady.set(e.source, new Set())
    if (!ady.has(e.target)) ady.set(e.target, new Set())
    ady.get(e.source)!.add(e.target)
    ady.get(e.target)!.add(e.source)
  }
  const largosMini: number[] = []
  const kMini: number[] = []
  const tamVec: number[] = []
  for (const [id, vec] of ady) {
    if (!vec.size) continue
    const ids = [id, ...vec]
    const pts = ids.map((i) => pos.get(i)).filter(Boolean) as { x: number; y: number }[]
    if (pts.length < 2) continue
    const cj = {
      x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)),
      y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)),
    }
    const k = escalaEncuadre(cj, MINI.w, MINI.h, true)
    kMini.push(k)
    tamVec.push(ids.length)
    const c = pos.get(id)!
    for (const v of vec) {
      const p = pos.get(v)
      if (p) largosMini.push(Math.hypot(p.x - c.x, p.y - c.y) * k)
    }
  }
  largosMini.sort((a, b) => a - b)
  kMini.sort((a, b) => a - b)
  tamVec.sort((a, b) => a - b)
  const pcMini = (t: number) =>
    ((largosMini.filter((l) => l >= t).length / largosMini.length) * 100).toFixed(0) + '%'

  line()
  line(`EL MINI DE LA FICHA, medido vecindario a vecindario (${kMini.length} fichas con vecinos):`)
  line(`  vecindario mediano ${percentil(tamVec, 0.5).toFixed(0)} nodes · aumento mediano k=${percentil(kMini, 0.5).toFixed(2)} (tope 4)`)
  line(`  arista:  p10 ${percentil(largosMini, 0.1).toFixed(1)} px · mediana ${percentil(largosMini, 0.5).toFixed(1)} px · p90 ${percentil(largosMini, 0.9).toFixed(1)} px`)
  line(`  supera:  >=10px ${pcMini(UMBRAL_FLECHA)} · >=18px ${pcMini(UMBRAL_PATRON)} · >=30px ${pcMini(DEGRADED_THRESHOLD)}`)

  line()
  line('A QUE AUMENTO la arista MEDIANA cruza cada umbral (el encuadre de escritorio es la base):')
  const kBase = escalaEncuadre(bounds, 1400, 900, false)
  const medianaU = percentil(largos, 0.5)
  for (const [name, t] of [['flecha', UMBRAL_FLECHA], ['patron', UMBRAL_PATRON], ['degradado', DEGRADED_THRESHOLD]] as const) {
    const kNec = t / medianaU
    line(`  ${String(name).padEnd(11)} k >= ${kNec.toFixed(2)}  ·  ${(kNec / kBase).toFixed(1)}x el encuadre completo`)
  }

  // ── La mitad perceptiva ────────────────────────────────────────────────────────────────
  muestras.innerHTML = ''
  const tamanos = [
    { et: 'p10 a encuadre', px: rows[0].k * percentil(largos, 0.1) },
    { et: 'mediana a encuadre', px: rows[0].mediana },
    { et: 'p90 a encuadre', px: rows[0].k * percentil(largos, 0.9) },
    { et: 'mediana a 2x', px: rows[0].mediana * 2 },
    { et: 'mediana a 4x', px: rows[0].mediana * 4 },
  ]

  for (const [title, list] of [['DIRECCION (G-A)', DIRECTION], ['TIPO (G-B)', TYPE]] as const) {
    const h = document.createElement('h2')
    h.textContent = title
    muestras.appendChild(h)
    const tabla = document.createElement('table')
    const thead = document.createElement('tr')
    thead.appendChild(document.createElement('th'))
    for (const t of tamanos) {
      const th = document.createElement('th')
      th.innerHTML = `${t.et}<br><small>${t.px.toFixed(1)} px</small>`
      thead.appendChild(th)
    }
    tabla.appendChild(thead)
    for (const cand of list) {
      const tr = document.createElement('tr')
      const td0 = document.createElement('td')
      td0.className = 'nom'
      td0.innerHTML = `${cand.name}<br><small>${cand.note}</small>`
      tr.appendChild(td0)
      for (const t of tamanos) {
        const td = document.createElement('td')
        td.appendChild(pintaMuestra(cand, t.px))
        tr.appendChild(td)
      }
      tabla.appendChild(tr)
    }
    muestras.appendChild(tabla)
  }
}

main().catch((e) => {
  state.textContent = 'fallo: ' + (e instanceof Error ? e.message : String(e))
})
