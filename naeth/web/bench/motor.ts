// Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
// No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE
// Banco de pruebas del motor del grafo. Fase 0 del plan del 05/09/2026.
//
// Responde UNA pregunta y nada mas: con la simulacion viva y el corpus real, mas su proyeccion a
// uno y tres anos, que combinacion de pintado y fisica aguanta. El plan declara el criterio ANTES
// de mirar: pasa quien de 50 fps o mas con el corpus de hoy y 30 fps o mas a x5.
//
// NO ES PRODUCCION y no entra en el build: `vite build` solo empaqueta `index.html`. Vive aqui
// para poder volver a correrlo el dia que el corpus haya crecido y comprobar si el techo medido
// hoy sigue estando donde decia.
//
// DOS AVISOS SOBRE LA JUSTICIA DE LA COMPARACION, porque un banco amanado no sirve de nada:
//  - El pintor SVG actualiza atributos de elementos que ya existen, con `setAttribute` y sin pasar
//    por Svelte. Es el MEJOR caso posible para SVG, mejor que lo que tenemos hoy en la app. Si con
//    esa ventaja pierde, con Svelte por delante pierde mas.
//  - La fisica corre con `alphaDecay(0)`, o sea sin enfriarse nunca. Mide el coste SOSTENIDO, que
//    es el peor caso. En la app real la simulacion se calma y para.

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { buildGraph, defaultFilters, type GraphModel } from '../src/lib/graph'
import { place } from '../src/lib/layout'
import { projColor } from '../src/lib/colors'
import type { GraphResponse, TreeRow } from '../src/lib/types'

// --- tipos del banco -------------------------------------------------------------------------

interface Node extends SimulationNodeDatum {
  id: string
  project: string
  degree: number
  /** Ancla: el centro de su componente, de donde no debe alejarse. */
  ax: number
  ay: number
}

interface Edge {
  source: string | Node
  target: string | Node
}

type PainterName = 'svg' | 'canvas'
type NombreFisica = 'd3' | 'propia'

interface Painter {
  draw(nodes: Node[], edges: Edge[]): void
  destroy(): void
}

const W = 900
const H = 620

// --- datos -----------------------------------------------------------------------------------

/**
 * Replica el corpus k veces para simular el crecimiento.
 *
 * No basta con copiar y pegar: k copias identicas y aisladas son k grafos pequenos, y un grafo
 * pequeno repetido es mas facil de simular que uno grande de verdad (la repulsion se reparte entre
 * componentes que no se tocan). Por eso un 8% de las aristas replicadas se reengancha a OTRA
 * replica, que es ademas lo que pasa de verdad: las notas nuevas enlazan a las viejas.
 */
function escalar(model: GraphModel, k: number, centers: Map<number, { x: number; y: number }>) {
  const nodes: Node[] = []
  const edges: Edge[] = []
  let seed = 1
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  for (let r = 0; r < k; r++) {
    const desvio = { x: (r % 4) * 2600, y: Math.floor(r / 4) * 2600 }
    for (const n of model.nodes) {
      const c = centers.get(n.component) ?? { x: 0, y: 0 }
      nodes.push({
        id: r === 0 ? n.id : `${n.id}#${r}`,
        project: n.project,
        degree: n.degree,
        ax: c.x + desvio.x,
        ay: c.y + desvio.y,
        x: c.x + desvio.x + (rnd() - 0.5) * 400,
        y: c.y + desvio.y + (rnd() - 0.5) * 400,
      })
    }
    const suf = (id: string) => (r === 0 ? id : `${id}#${r}`)
    for (const e of model.edges) {
      if (k > 1 && rnd() < 0.08) {
        const other = Math.floor(rnd() * k)
        const s = other === 0 ? e.source : `${e.source}#${other}`
        edges.push({ source: suf(e.target), target: s })
      } else {
        edges.push({ source: suf(e.source), target: suf(e.target) })
      }
    }
  }
  return { nodes, edges }
}

// --- fisica ----------------------------------------------------------------------------------

/** El radio del nodo, que es tambien el radio de colision. Mismo criterio que la app de hoy. */
const radius = (n: Node) => 3.5 + Math.min(n.degree, 10) * 0.45

function fisicaD3(nodes: Node[], edges: Edge[]): Simulation<Node, undefined> {
  return forceSimulation(nodes)
    .force('link', forceLink<Node, Edge>(edges).id((d) => d.id).distance(34).strength(0.6))
    .force('charge', forceManyBody<Node>().strength(-38).distanceMax(600))
    .force('collide', forceCollide<Node>((d) => radius(d) + 2))
    // Las anclas por componente: es lo que evita que las islas salgan despedidas, que era la razon
    // de colocar cada componente por separado en `layout.ts`.
    .force('x', forceX<Node>((d) => d.ax).strength(0.05))
    .force('y', forceY<Node>((d) => d.ay).strength(0.05))
    .alphaDecay(0)
    .velocityDecay(0.35)
    .stop()
}

/**
 * Un paso del Fruchterman-Reingold propio, el de `layout.ts:63`, pero incremental.
 *
 * La repulsion es O(n^2) a proposito, que es exactamente como esta hoy. La comparacion contra d3
 * es la comparacion contra el quadtree de Barnes-Hut, y esa es la pregunta que interesa: a partir
 * de cuantos nodos el O(n^2) deja de caber en un frame.
 */
function pasoPropio(nodes: Node[], edges: Edge[], k: number, t: number) {
  const n = nodes.length
  const dspx = new Float64Array(n)
  const dspy = new Float64Array(n)
  const idx = new Map<string, number>()
  nodes.forEach((nd, i) => idx.set(nd.id, i))

  for (let i = 0; i < n; i++) {
    const a = nodes[i]
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j]
      let dx = a.x! - b.x!
      let dy = a.y! - b.y!
      let d2 = dx * dx + dy * dy
      if (d2 < 0.01) {
        dx = (i - j) * 0.1
        dy = 0.1
        d2 = dx * dx + dy * dy
      }
      const d = Math.sqrt(d2)
      const f = (k * k) / d
      const ux = (dx / d) * f
      const uy = (dy / d) * f
      dspx[i] += ux
      dspy[i] += uy
      dspx[j] -= ux
      dspy[j] -= uy
    }
  }

  for (const e of edges) {
    const i = idx.get(typeof e.source === 'string' ? e.source : e.source.id)
    const j = idx.get(typeof e.target === 'string' ? e.target : e.target.id)
    if (i === undefined || j === undefined) continue
    const a = nodes[i]
    const b = nodes[j]
    const dx = a.x! - b.x!
    const dy = a.y! - b.y!
    const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01)
    const f = (d * d) / k
    dspx[i] -= (dx / d) * f
    dspy[i] -= (dy / d) * f
    dspx[j] += (dx / d) * f
    dspy[j] += (dy / d) * f
  }

  for (let i = 0; i < n; i++) {
    const len = Math.max(Math.sqrt(dspx[i] * dspx[i] + dspy[i] * dspy[i]), 0.01)
    nodes[i].x! += (dspx[i] / len) * Math.min(len, t)
    nodes[i].y! += (dspy[i] / len) * Math.min(len, t)
  }
}

// --- pintores --------------------------------------------------------------------------------

/** Encuadre comun a los dos pintores, para que dibujen lo mismo y la comparacion valga. */
function frameOf(nodes: Node[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const n of nodes) {
    if (n.x! < x0) x0 = n.x!
    if (n.x! > x1) x1 = n.x!
    if (n.y! < y0) y0 = n.y!
    if (n.y! > y1) y1 = n.y!
  }
  const k = Math.min(W / Math.max(x1 - x0, 1), H / Math.max(y1 - y0, 1)) * 0.92
  return { x0, y0, k }
}

function canvasPainter(host: HTMLElement): Painter {
  const cv = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  cv.width = W * dpr
  cv.height = H * dpr
  cv.style.width = W + 'px'
  cv.style.height = H + 'px'
  host.appendChild(cv)
  const ctx = cv.getContext('2d')!

  return {
    draw(nodes, edges) {
      const { x0, y0, k } = frameOf(nodes)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const X = (v: number) => (v - x0) * k + 8
      const Y = (v: number) => (v - y0) * k + 8

      // TODAS las aristas en un solo trazo. Cambiar de estilo por arista seria el error caro.
      ctx.strokeStyle = 'rgba(130,130,140,0.45)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const e of edges) {
        const a = e.source as Node
        const b = e.target as Node
        ctx.moveTo(X(a.x!), Y(a.y!))
        ctx.lineTo(X(b.x!), Y(b.y!))
      }
      ctx.stroke()

      // Los nodos AGRUPADOS POR COLOR: un `fillStyle` por proyecto en vez de uno por nodo.
      const byColor = new Map<string, Node[]>()
      for (const n of nodes) {
        const c = projColor(n.project)
        let l = byColor.get(c)
        if (!l) byColor.set(c, (l = []))
        l.push(n)
      }
      for (const [color, list] of byColor) {
        ctx.fillStyle = color
        ctx.beginPath()
        for (const n of list) {
          const r = radius(n) * 0.9
          ctx.moveTo(X(n.x!) + r, Y(n.y!))
          ctx.arc(X(n.x!), Y(n.y!), r, 0, Math.PI * 2)
        }
        ctx.fill()
      }
    },
    destroy() {
      cv.remove()
    },
  }
}

function pintorSvg(host: HTMLElement, nodes: Node[], edges: Edge[]): Painter {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('width', String(W))
  svg.setAttribute('height', String(H))
  host.appendChild(svg)

  const gA = document.createElementNS(NS, 'g')
  gA.setAttribute('stroke', 'rgba(130,130,140,0.45)')
  gA.setAttribute('stroke-width', '1')
  svg.appendChild(gA)
  const gN = document.createElementNS(NS, 'g')
  svg.appendChild(gN)

  // Los elementos se crean UNA VEZ. En cada frame solo se actualizan atributos, que es lo mas
  // rapido que se puede hacer en SVG.
  const lines = edges.map(() => {
    const l = document.createElementNS(NS, 'line')
    gA.appendChild(l)
    return l
  })
  const circulos = nodes.map((n) => {
    const c = document.createElementNS(NS, 'circle')
    c.setAttribute('r', String(radius(n) * 0.9))
    c.setAttribute('fill', projColor(n.project))
    gN.appendChild(c)
    return c
  })

  return {
    draw(ns, es) {
      const { x0, y0, k } = frameOf(ns)
      const X = (v: number) => (v - x0) * k + 8
      const Y = (v: number) => (v - y0) * k + 8
      for (let i = 0; i < es.length; i++) {
        const a = es[i].source as Node
        const b = es[i].target as Node
        const l = lines[i]
        l.setAttribute('x1', X(a.x!).toFixed(1))
        l.setAttribute('y1', Y(a.y!).toFixed(1))
        l.setAttribute('x2', X(b.x!).toFixed(1))
        l.setAttribute('y2', Y(b.y!).toFixed(1))
      }
      for (let i = 0; i < ns.length; i++) {
        circulos[i].setAttribute('cx', X(ns[i].x!).toFixed(1))
        circulos[i].setAttribute('cy', Y(ns[i].y!).toFixed(1))
      }
    },
    destroy() {
      svg.remove()
    },
  }
}

// --- medicion --------------------------------------------------------------------------------

interface Measure {
  scale: number
  nodes: number
  edges: number
  painter: PainterName
  physics: NombreFisica
  fps: number
  fisicaMs: number
  pintadoMs: number
  p95Ms: number
  arranqueMs: number
}

const p = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(s.length * q))] ?? 0
}

async function resize(
  model: GraphModel,
  centers: Map<number, { x: number; y: number }>,
  scale: number,
  painter: PainterName,
  physics: NombreFisica,
  segundos = 4,
): Promise<Measure> {
  const host = document.getElementById('lienzo')!
  host.innerHTML = ''
  const t0 = performance.now()
  const { nodes, edges } = escalar(model, scale, centers)

  let sim: Simulation<Node, undefined> | null = null
  if (physics === 'd3') {
    sim = fisicaD3(nodes, edges)
  } else {
    // d3 sustituye las cadenas de las aristas por los objetos; la propia no, asi que se hace aqui
    // para que los dos pintores reciban exactamente la misma estructura.
    const idx = new Map(nodes.map((n) => [n.id, n]))
    for (const e of edges) {
      e.source = idx.get(e.source as string)!
      e.target = idx.get(e.target as string)!
    }
  }

  const pt = painter === 'canvas' ? canvasPainter(host) : pintorSvg(host, nodes, edges)
  const arranqueMs = performance.now() - t0

  const kFR = Math.sqrt((Math.max(nodes.length, 2) * 2000) / Math.max(nodes.length, 2))
  const fis: number[] = []
  const pin: number[] = []
  const tot: number[] = []

  await new Promise<void>((ready) => {
    const end = performance.now() + segundos * 1000
    let frames = 0
    const step = () => {
      const a = performance.now()
      if (sim) sim.tick()
      else pasoPropio(nodes, edges, kFR, 8)
      const b = performance.now()
      pt.draw(nodes, edges)
      const c = performance.now()
      fis.push(b - a)
      pin.push(c - b)
      tot.push(c - a)
      frames++
      if (performance.now() < end) requestAnimationFrame(step)
      else ready()
    }
    requestAnimationFrame(step)
  })

  // El pintor NO se destruye aqui: la siguiente medida ya limpia el `host`, y asi al terminar la
  // tanda queda en pantalla el ultimo grafo dibujado. Sin eso no hay forma de comprobar que los
  // pintores estaban pintando algo, y unos fps preciosos sobre un lienzo vacio son la clase de
  // numero que parece verificacion y no lo es.
  const fps = tot.length / segundos
  sim?.stop()
  void pt

  return {
    scale,
    nodes: nodes.length,
    edges: edges.length,
    painter,
    physics,
    fps: Math.round(fps),
    fisicaMs: +p(fis, 0.5).toFixed(2),
    pintadoMs: +p(pin, 0.5).toFixed(2),
    p95Ms: +p(tot, 0.95).toFixed(2),
    arranqueMs: Math.round(arranqueMs),
  }
}

// --- arranque --------------------------------------------------------------------------------

const output = document.getElementById('salida') as HTMLPreElement
const state = document.getElementById('estado') as HTMLElement
const rows: Measure[] = []

function paint() {
  const cab = ['escala', 'nodes', 'edges', 'pintor', 'physics', 'fps', 'fis ms', 'sujetar ms', 'p95 ms', 'arranque']
  const anchos = cab.map((c) => c.length)
  const cuerpo = rows.map((f) => [
    'x' + f.scale, String(f.nodes), String(f.edges), f.painter, f.physics,
    String(f.fps), String(f.fisicaMs), String(f.pintadoMs), String(f.p95Ms), f.arranqueMs + ' ms',
  ])
  for (const r of cuerpo) r.forEach((v, i) => (anchos[i] = Math.max(anchos[i], v.length)))
  const line = (r: string[]) => r.map((v, i) => v.padEnd(anchos[i])).join('  ')
  output.textContent = [line(cab), anchos.map((a) => '-'.repeat(a)).join('  '), ...cuerpo.map(line)].join('\n')
}

async function arranca() {
  state.textContent = 'cargando el corpus real...'
  const [tree, graph] = await Promise.all([
    fetch('/api/tree').then((r) => r.json() as Promise<TreeRow[]>),
    fetch('/api/graph').then((r) => r.json() as Promise<GraphResponse>),
  ])

  // Las tres capas menos la semantica, que se pide por nodo y no forma parte del grafo de partida.
  const filters = defaultFilters()
  filters.layers.wikilink = true
  const model = buildGraph(tree, graph, new Map(), filters)

  // Las anclas salen del empaquetado por componentes que ya tenemos, que es justo el papel que le
  // da el plan: dejar de decidir la posicion final y pasar a decidir de donde se parte.
  const col = place(model, { width: 1600, iterations: 40 })
  const centers = new Map<number, { x: number; y: number }>()
  for (const c of col.boxes) centers.set(c.comp, { x: c.x + c.w / 2, y: c.y + c.h / 2 })

  state.textContent = `${model.nodes.length} nodos y ${model.edges.length} aristas reales. Listo.`

  const button = document.getElementById('correr') as HTMLButtonElement
  button.disabled = false
  button.onclick = async () => {
    button.disabled = true
    rows.length = 0
    const escalas = [1, 5, 10]
    for (const e of escalas) {
      for (const f of ['d3', 'propia'] as NombreFisica[]) {
        for (const pn of ['canvas', 'svg'] as PainterName[]) {
          // El O(n^2) propio a x10 son 28 millones de pares por frame: no se mide, se declara.
          if (f === 'propia' && e >= 10) continue
          state.textContent = `midiendo x${e} ${pn} ${f}...`
          rows.push(await resize(model, centers, e, pn, f))
          paint()
        }
      }
    }
    state.textContent = 'terminado.'
    button.disabled = false
  }
}

void arranca()
