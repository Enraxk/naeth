// Banco del canal de la arista, PERO SOBRE EL GRAFO ENTERO Y VIVO.
//
// POR QUE OTRO BANCO. `arista.ts` midio el tamano y enseno las candidatas en muestras sueltas: ahi
// gano la punta de flecha (97% de las aristas la admiten) y el color para el tipo (legible a 11,5
// px). Pero cinco trazos sobre fondo negro no contestan la pregunta que de verdad decide, que es si
// 651 aristas con flechas y tres tintes SE LEEN o se convierten en ruido. Eso solo se ve con el
// grafo entero delante.
//
// Y hay un choque concreto que hay que mirar, no razonar: **el color de la arista ya esta ocupado**.
// Hoy codifica el estado, `tk.dim` lo apagado y `tk.ink` lo encendido, que es lo que hace que al
// senalar en el arbol se apague el resto. Si el tipo se lleva el tono, el estado se queda solo con
// la opacidad. En teoria son separables. En pantalla, se vera.
//
// LAS CUATRO VARIANTES, el mismo grafo y el mismo encuadre en las cuatro:
//   A · HOY          la referencia, tal cual pinta el visor
//   B · FLECHAS      + direccion en el extremo
//   C · TINTES       + tipo de relacion en el color del trazo
//   D · LAS DOS      flechas y tintes a la vez
//
// Los controles cambian las cuatro a la vez, que es la unica forma de comparar: resalte encendido
// (el caso donde el color pelea con el estado), aumento (a encuadre completo y acercandose) y tema.
//
// ⚠ Esto NO toca el visor. Es un banco aparte, con su copia del pintado de aristas, y por eso las
// constantes se IMPORTAN de `pintor.ts` y `sim.ts` en vez de copiarse: si alguien cambia el trazo de
// una capa o el radio de un nodo, este banco cambia con el.

import { buildGraph, filtrosPorDefecto, type GraphEdge, type GraphModel } from '../src/lib/graph'
import { crearSimulador, radioNodo, type Simulador } from '../src/lib/sim'
import { radioEnPantalla, TRAZO } from '../src/lib/pintor'
import { projColor } from '../src/lib/colors'
import type { GraphResponse, TreeRow } from '../src/lib/types'

const estado = document.getElementById('estado') as HTMLElement
const rejilla = document.getElementById('rejilla') as HTMLElement
const info = document.getElementById('info') as HTMLElement

/** Los tres predicados reales, con su cuenta medida el 06/09. El tinte es lo que se juzga aqui. */
const TINTE: Record<string, [string, string]> = {
  // [oscuro, claro]
  links_to: ['#6ba6e8', '#2f6fb8'],
  derived_from: ['#b394e3', '#7a4fb5'],
  depends_on: ['#4dbba7', '#2b8574'],
}
const TINTE_OTRO: [string, string] = ['#8a929e', '#646d79']

const TEMA = {
  dark: { bg: '#1e2022', ink: '#e6e8eb', dim: '#8a929e', accent: '#5db0ff' },
  light: { bg: '#f7f7f5', ink: '#1f2329', dim: '#646d79', accent: '#2563eb' },
}

let modo: 'dark' | 'light' = 'dark'
let resalte = false
let aumento = 1 // multiplicador sobre el encuadre completo

// ⚠ ESTAS DOS SON VARIABLES DEL BANCO, NO CONCLUSIONES. La primera version pintaba la punta a 5 px
// fijos y pegada al nodo destino, y en el conjunto no se leia. Antes de concluir que la direccion
// no cabe hay que descartar que el problema fuera esa eleccion mia: una muestra aislada y un grafo
// de 651 aristas no perdonan lo mismo.
let puntaPx = 5
// Arranca A MEDIA ARISTA por lo que dijo Eneko el 06/09 mirando el banco: "las flechas en 5 px me
// gustan porque no se notan mucho pero ayudan" y "a lo mejor en medio se ve mejor". El extremo
// sigue a un clic para poder compararlos.
let puntaMedio = true

// FUERZA DEL TINTE. Tambien de ese repaso: "las lineas con colores me gusta pero si fueran en tonos
// mas apagados que no resalten tanto". En vez de elegir yo un apagado, el tinte se mezcla con el
// gris del tema y se puede recorrer: 1 es el color puro, 0 seria el gris de hoy. Los tres valores
// se ven, se compara, y se elige.
const FUERZAS = [1, 0.55, 0.3]
let fuerza = 0.55

let sim: Simulador | null = null
let model: GraphModel | null = null
let foco: string | null = null
let encendidos = new Set<string>()

const VARIANTES = [
  { id: 'A', nombre: 'HOY', nota: 'la referencia', flechas: false, tintes: false },
  { id: 'B', nombre: 'FLECHAS', nota: 'direccion en el extremo', flechas: true, tintes: false },
  { id: 'C', nombre: 'TINTES', nota: 'tipo en el color del trazo', flechas: false, tintes: true },
  { id: 'D', nombre: 'LAS DOS', nota: 'flechas y tintes a la vez', flechas: true, tintes: true },
]

const W = 560
const H = 380

function asentar(s: Simulador, tope = 600) {
  let n = 0
  while (n < tope && s.paso()) n++
  return n
}

/** El mismo calculo que `encuadraTodo`, con el multiplicador de aumento encima. */
function vistaDe(s: Simulador) {
  const c = s.caja()
  const k = Math.min(
    Math.min(W / Math.max(c.x1 - c.x0, 1), H / Math.max(c.y1 - c.y0, 1)) * 0.9,
    4,
  ) * aumento
  let cx = (c.x0 + c.x1) / 2
  let cy = (c.y0 + c.y1) / 2
  // Al acercarse, la camara va al nodo del resalte: si no, se acerca a un trozo vacio.
  if (aumento > 1 && foco) {
    const nd = s.nodos.find((n) => n.id === foco)
    if (nd) {
      cx = nd.x ?? cx
      cy = nd.y ?? cy
    }
  }
  return { k, cx, cy, w: W, h: H }
}

const hex = (c: string) => [
  parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16),
]
const aHex = (v: number[]) => '#' + v.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')

/** Mezcla el tinte con el gris del tema. `f`=1 es el color puro, `f`=0 el gris de hoy. */
function apaga(color: string, gris: string, f: number) {
  const a = hex(color)
  const b = hex(gris)
  return aHex(a.map((v, i) => v * f + b[i] * (1 - f)))
}

/** Contraste WCAG de un color contra el fondo. No es texto, pero por debajo de 1,5 se pierde. */
function contraste(c1: string, c2: string) {
  const L = (c: string) => {
    const [r, g, b] = hex(c).map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const a = L(c1)
  const b = L(c2)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function colorArista(e: GraphEdge, tintes: boolean, t: typeof TEMA.dark) {
  if (!tintes) return t.dim
  const par = e.layer === 'relation' ? (TINTE[e.predicate ?? ''] ?? TINTE_OTRO) : TINTE_OTRO
  return apaga(par[modo === 'dark' ? 0 : 1], t.dim, fuerza)
}

function pinta(cv: HTMLCanvasElement, v: { flechas: boolean; tintes: boolean }) {
  if (!sim) return
  const t = TEMA[modo]
  const vista = vistaDe(sim)
  const dpr = window.devicePixelRatio || 1
  cv.width = W * dpr
  cv.height = H * dpr
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, W, H)

  const P = (n: { x?: number; y?: number }) => ({
    x: ((n.x ?? 0) - vista.cx) * vista.k + W / 2,
    y: ((n.y ?? 0) - vista.cy) * vista.k + H / 2,
  })
  const dentro = (p: { x: number; y: number }) => p.x > -48 && p.x < W + 48 && p.y > -48 && p.y < H + 48

  const enFoco = (id: string) => !resalte || encendidos.has(id)

  // ── Aristas ────────────────────────────────────────────────────────────────────────────
  // Dos pasadas, apagadas primero, para que lo encendido quede por encima. Es lo que hace el
  // pintor de verdad, y aqui importa mas: con tintes, el orden decide que color se ve.
  for (const pasada of [0, 1]) {
    for (const nd of sim.aristas) {
      const a = nd.source as unknown as { id: string; x?: number; y?: number }
      const b = nd.target as unknown as { id: string; x?: number; y?: number }
      const viva = enFoco(a.id) && enFoco(b.id)
      if ((pasada === 0) === viva) continue
      const p = P(a)
      const q = P(b)
      if (!dentro(p) && !dentro(q)) continue

      ctx.globalAlpha = viva ? 1 : 0.3
      ctx.strokeStyle = colorArista(nd.e, v.tintes, t)
      ctx.lineWidth = 1.2
      ctx.setLineDash(TRAZO[nd.e.layer] ?? [])
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(q.x, q.y)
      ctx.stroke()
      ctx.setLineDash([])

      // La flecha se para en el BORDE del nodo destino, no en su centro: dentro del circulo no se
      // ve, y encima parece que el trazo entra en el nodo.
      if (v.flechas && nd.e.layer === 'relation') {
        const dx = q.x - p.x
        const dy = q.y - p.y
        const d = Math.hypot(dx, dy) || 1
        const rDest = radioEnPantalla(radioNodoDe(b.id), vista.k)
        // En el extremo, justo antes del nodo. O a media arista, que es zona limpia: en el extremo
        // la punta compite con el propio nodo y con todo lo que se cruce ahi.
        const retro = puntaMedio ? d * 0.5 : rDest + 1
        const ex = q.x - (dx / d) * retro
        const ey = q.y - (dy / d) * retro
        const a1 = Math.atan2(dy, dx)
        const largo = Math.min(puntaPx, d * 0.35)
        ctx.beginPath()
        ctx.moveTo(ex, ey)
        ctx.lineTo(ex - largo * Math.cos(a1 - 0.42), ey - largo * Math.sin(a1 - 0.42))
        ctx.moveTo(ex, ey)
        ctx.lineTo(ex - largo * Math.cos(a1 + 0.42), ey - largo * Math.sin(a1 + 0.42))
        ctx.stroke()
      }
    }
  }

  // ── Nodos ──────────────────────────────────────────────────────────────────────────────
  // Circulos y no las formas por tipo: aqui lo que se juzga son las aristas, y las formas
  // aportarian ruido a la comparacion. El COLOR si es el real del proyecto, porque es justo lo
  // que puede pelearse con los tintes de arista.
  for (const nd of sim.nodos) {
    const p = P(nd)
    if (!dentro(p)) continue
    ctx.globalAlpha = enFoco(nd.id) ? 1 : 0.3
    ctx.fillStyle = projColor(nd.n.project)
    ctx.beginPath()
    ctx.arc(p.x, p.y, radioEnPantalla(radioNodo(nd.n), vista.k), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

const radios = new Map<string, number>()
function radioNodoDe(id: string) {
  return radios.get(id) ?? 4
}

function pintaTodo() {
  for (const v of VARIANTES) {
    const cv = document.getElementById('cv-' + v.id) as HTMLCanvasElement
    if (cv) pinta(cv, v)
  }
  const t = TEMA[modo]
  const cs = ['links_to', 'derived_from', 'depends_on'].map((k) => {
    const c = apaga(TINTE[k][modo === 'dark' ? 0 : 1], t.dim, fuerza)
    return `${k} ${c} (${contraste(c, t.bg).toFixed(1)}:1)`
  })
  info.innerHTML =
    `tema ${modo} · resalte ${resalte ? 'ON (' + encendidos.size + ' encendidos)' : 'off'} · ` +
    `aumento ${aumento}x · punta ${puntaPx} px ${puntaMedio ? 'a media arista' : 'en el extremo'} · ` +
    `<b>tinte al ${Math.round(fuerza * 100)}%</b><br><small>contraste contra el fondo: ` +
    `${cs.join(' · ')} · el gris de hoy da ${contraste(t.dim, t.bg).toFixed(1)}:1</small>`
}

function monta() {
  rejilla.innerHTML = ''
  for (const v of VARIANTES) {
    const fig = document.createElement('figure')
    const cap = document.createElement('figcaption')
    cap.innerHTML = `<b>${v.id} · ${v.nombre}</b> <small>${v.nota}</small>`
    const cv = document.createElement('canvas')
    cv.id = 'cv-' + v.id
    cv.style.width = W + 'px'
    cv.style.height = H + 'px'
    fig.appendChild(cap)
    fig.appendChild(cv)
    rejilla.appendChild(fig)
  }
}

async function main() {
  estado.textContent = 'cargando el grafo real...'
  const [tree, graph] = await Promise.all([
    fetch('/api/tree').then((r) => r.json() as Promise<TreeRow[]>),
    fetch('/api/graph').then((r) => r.json() as Promise<GraphResponse>),
  ])

  model = buildGraph(tree, graph, new Map(), { ...filtrosPorDefecto(), ocultarAislados: false })
  estado.textContent = `asentando ${model.nodes.length} nodos...`
  sim = crearSimulador(model)
  const pasos = asentar(sim)
  for (const n of sim.nodos) radios.set(n.id, radioNodo(n.n))

  // El foco del resalte: el nodo de MAYOR grado, que es donde el choque entre tinte y estado se
  // ve mejor. Con un nodo de grado 1 no se juzga nada.
  let mejor = sim.nodos[0]
  for (const n of sim.nodos) if (n.n.degree > (mejor?.n.degree ?? 0)) mejor = n
  foco = mejor?.id ?? null
  encendidos = new Set([foco!, ...(sim.vecinos(foco!) ?? [])])

  const porTipo = new Map<string, number>()
  for (const e of model.edges) {
    if (e.layer !== 'relation') continue
    porTipo.set(e.predicate ?? '(sin)', (porTipo.get(e.predicate ?? '(sin)') ?? 0) + 1)
  }

  estado.textContent =
    `${model.nodes.length} nodos · ${model.edges.length} aristas · ${pasos} pasos · ` +
    `relaciones por tipo: ${[...porTipo].map(([k, n]) => `${k} ${n}`).join(' · ')} · ` +
    `foco en la de mayor grado (${mejor?.n.degree} vecinos)`

  monta()
  pintaTodo()

  document.getElementById('tema')!.addEventListener('click', () => {
    modo = modo === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = modo
    pintaTodo()
  })
  document.getElementById('resalte')!.addEventListener('click', () => {
    resalte = !resalte
    pintaTodo()
  })
  for (const z of [1, 2, 4]) {
    document.getElementById('z' + z)!.addEventListener('click', () => {
      aumento = z
      pintaTodo()
    })
  }
  document.getElementById('punta')!.addEventListener('click', () => {
    puntaPx = puntaPx === 5 ? 8 : puntaPx === 8 ? 12 : 5
    pintaTodo()
  })
  document.getElementById('donde')!.addEventListener('click', () => {
    puntaMedio = !puntaMedio
    pintaTodo()
  })
  document.getElementById('fuerza')!.addEventListener('click', () => {
    fuerza = FUERZAS[(FUERZAS.indexOf(fuerza) + 1) % FUERZAS.length]
    pintaTodo()
  })
}

main().catch((e) => {
  estado.textContent = 'fallo: ' + (e instanceof Error ? e.message : String(e))
})
