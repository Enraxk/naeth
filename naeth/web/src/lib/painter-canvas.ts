// Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
// No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE
// Pintor de canvas 2D. La implementacion elegida en la fase 0 del plan del 05/09/2026.
//
// La eleccion no fue por lo que cuesta hoy, que hoy da igual: los cuatro motores medidos pasan de
// 140 fps con el corpus actual. Fue por dos numeros del futuro que ya tiene fecha. A x5, o sea el
// corpus de dentro de un ano, el percentil 95 de SVG son 18,6 ms sobre un presupuesto de 16,7 a
// 60 Hz, o sea que ya no cabe en un frame ANTES de anadir hover, etiquetas y arrastre; canvas va
// en 12,1 y deja margen. A x10, tres anos, canvas da 45 fps y SVG 19.
//
// DOS REGLAS QUE SOSTIENEN ESE RENDIMIENTO, y que hay que respetar al tocar esto:
//  1. Un `fillStyle` por COLOR, no por nodo. Los nodos se agrupan y se rellenan de una vez. Con
//     4.550 nodos, cambiar de estilo uno a uno es el pintado entero.
//  2. Culling: lo que cae fuera del lienzo no se dibuja. Es lo que hace que acercarse SALGA MAS
//     BARATO en vez de mas caro, que es justo cuando el usuario esta interactuando.

import { predColor, projColor } from './colors'
import type { SimNode, Simulator } from './sim'
import { nodeRadius } from './sim'
import {
  toScreen,
  blend,
  textOpacity,
  screenRadius,
  LABEL_CAP,
  LABEL_CAP_FOCUS,
  wrapLines,
  clipToLine,
  DASH,
  strokeShape,
  type PaintState,
  type Painter,
  type Viewport,
} from './painter'

interface Tokens {
  ink: string
  dim: string
  bg: string
  accent: string
  borde: string
}

function readTokens(): Tokens {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string) => s.getPropertyValue(n).trim()
  return {
    ink: v('--ink') || '#e6e8eb',
    dim: v('--dim') || '#8a929e',
    bg: v('--bg') || '#1e2022',
    accent: v('--accent') || '#5db0ff',
    borde: v('--border') || '#363a3e',
  }
}

export function canvasPainter(host: HTMLElement): Painter {
  const cv = document.createElement('canvas')
  cv.style.width = '100%'
  cv.style.height = '100%'
  cv.style.display = 'block'
  host.appendChild(cv)
  const ctx = cv.getContext('2d')!

  let tk = readTokens()
  let dpr = 1
  let w = 0
  let h = 0

  /** Nodos y aristas visibles, reutilizados entre frames para no crear basura a 60 fps. */
  const visible: SimNode[] = []
  const byColor = new Map<string, SimNode[]>()

  return {
    resize(nw, nh) {
      w = nw
      h = nh
      // Tope de 2 en el ratio: por encima se cuadruplican los pixeles a rellenar sin que nadie
      // note la diferencia en un grafo de puntos y lineas.
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = Math.max(1, Math.round(w * dpr))
      cv.height = Math.max(1, Math.round(h * dpr))
    },

    theme() {
      tk = readTokens()
    },

    draw(sim: Simulator, v: Viewport, est: PaintState) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (!sim.nodes.length) return

      const P = (nd: SimNode) => toScreen(nd.x ?? 0, nd.y ?? 0, v)
      // Margen de un radio grande para que un nodo a medio salir no parpadee al entrar.
      const m = 48
      const inside = (p: { x: number; y: number }) =>
        p.x > -m && p.x < w + m && p.y > -m && p.y < h + m

      const hasFocus = !!est.lit?.size && est.dimming > 0.001
      const inFocus = (id: string) => !hasFocus || est.lit!.has(id) || id === est.focus
      // Cuanto se apaga lo que no es del vecindario. Quartz usa 0,2 sobre fondo claro; aqui la
      // paleta ya esta desaturada y el fondo es oscuro, asi que a 0,18 el resto desaparecia del
      // todo y el grafo se quedaba sin contexto alrededor de lo que miras. A 0,3 el resto sigue
      // ahi, como fondo, que es lo que hace que resaltar signifique algo.
      const dimmed = 1 - 0.7 * est.dimming
      const esc = est.nodeScale ?? 1
      const radius = (nd: SimNode) =>
        screenRadius(nodeRadius(nd.n) * esc, v.k, est.nodoExp, est.nodeMin, est.nodeMax)

      visible.length = 0
      for (const nd of sim.nodes) if (inside(P(nd))) visible.push(nd)

      // --- aristas ---------------------------------------------------------------------------
      //
      // Se agrupan por capa, no por arista: un `setLineDash` y un `stroke` por capa en vez de por
      // linea. Las del vecindario van aparte y encima, con el color de tinta.
      // El grupo era la capa; ahora es capa mas tipo de relacion, porque cada tipo puede llevar su
      // tinte. Siguen siendo pocos grupos (tres capas por tres predicados como mucho), asi que la
      // optimizacion de un `stroke` por grupo se conserva entera.
      const tinted = est.tinted ?? false
      const force = est.tintStrength ?? 0
      const layers: Record<string, {
        layer: string; pred: string
        fondo: [number, number, number, number][]; focus: [number, number, number, number][]
      }> = {}
      for (const e of sim.edges) {
        const a = e.source as SimNode
        const b = e.target as SimNode
        const pa = P(a)
        const pb = P(b)
        // Basta con que uno de los dos extremos se vea: si no, las aristas largas se cortarian al
        // acercarse, que es cuando mas se miran.
        if (!inside(pa) && !inside(pb)) continue
        const layer = e.e.layer
        const pred = tinted && layer === 'relation' ? (e.e.predicate ?? '') : ''
        const c = (layers[layer + '|' + pred] ??= { layer, pred, fondo: [], focus: [] })
        const target = hasFocus && inFocus(a.id) && inFocus(b.id) ? c.focus : c.fondo
        target.push([pa.x, pa.y, pb.x, pb.y])
      }

      /**
       * Mete la punta de flecha en el MISMO path que la arista, para no pagar un `stroke` por linea.
       *
       * Se para antes del nodo destino, o a media arista si asi se pide: en el extremo la punta
       * compite con el propio nodo y con todo lo que se cruce ahi, y Eneko la prefirio en medio
       * viendo las dos en el banco. `d * 0.35` evita que en una arista muy corta la punta sea mas
       * larga que la propia arista.
       */
      const tip = (x1: number, y1: number, x2: number, y2: number, px: number, medio: boolean) => {
        const dx = x2 - x1
        const dy = y2 - y1
        const d = Math.hypot(dx, dy)
        if (d < 6) return
        const setback = medio ? d * 0.5 : 7
        const ex = x2 - (dx / d) * setback
        const ey = y2 - (dy / d) * setback
        const angle = Math.atan2(dy, dx)
        const l = Math.min(px, d * 0.35)
        ctx.moveTo(ex, ey)
        ctx.lineTo(ex - l * Math.cos(angle - 0.42), ey - l * Math.sin(angle - 0.42))
        ctx.moveTo(ex, ey)
        ctx.lineTo(ex - l * Math.cos(angle + 0.42), ey - l * Math.sin(angle + 0.42))
      }
      const withArrows = (est.arrows ?? false) && (est.arrowPx ?? 0) > 0
      const arrowPx = est.arrowPx ?? 5
      const arrowMid = est.arrowMid ?? true
      const curve = est.curvature ?? 0

      ctx.lineCap = 'round'
      for (const l of Object.values(layers)) {
        // El tinte tiñe el trazo; el estado (apagado o encendido) sigue mandando en la OPACIDAD y en
        // si el color base es `dim` o `ink`. Son dos canales distintos y por eso conviven: el tipo
        // se lee en el tono y el resalte en cuanta luz tiene.
        const tint = l.pred ? predColor(l.pred) : null
        const arrowsHere = withArrows && l.layer === 'relation'
        // Peso de la capa: multiplica su opacidad. A 0 la capa desaparece SIN salir del modelo, que
        // es distinto de apagarla en los filtros: los nodos que solo cuelgan de ella siguen ahi.
        const weight = est.pesoCapa?.[l.layer] ?? 1
        if (weight <= 0.001) continue

        /** Recta, o arco si hay curvatura. Una sola via para que el fondo y el foco no discrepen. */
        const stroke = (x1: number, y1: number, x2: number, y2: number) => {
          ctx.moveTo(x1, y1)
          if (curve > 0.001) {
            // Punto de control perpendicular al punto medio: el arco sale siempre al mismo lado, y
            // eso es lo que separa visualmente dos vinculos que van del mismo A al mismo B.
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2
            ctx.quadraticCurveTo(mx - (y2 - y1) * curve, my + (x2 - x1) * curve, x2, y2)
          } else {
            ctx.lineTo(x2, y2)
          }
          if (arrowsHere) tip(x1, y1, x2, y2, arrowPx, arrowMid)
        }

        if (l.fondo.length) {
          ctx.globalAlpha = (hasFocus ? dimmed : 1) * 0.55 * weight
          ctx.strokeStyle = tint ? blend(tint, tk.dim, force) : tk.dim
          ctx.lineWidth = 1
          ctx.setLineDash(DASH[l.layer] ?? [])
          ctx.beginPath()
          for (const [x1, y1, x2, y2] of l.fondo) stroke(x1, y1, x2, y2)
          ctx.stroke()
        }
        if (l.focus.length) {
          ctx.globalAlpha = weight
          ctx.strokeStyle = tint ? blend(tint, tk.ink, force) : tk.ink
          ctx.lineWidth = 1.5
          ctx.setLineDash(DASH[l.layer] ?? [])
          ctx.beginPath()
          for (const [x1, y1, x2, y2] of l.focus) stroke(x1, y1, x2, y2)
          ctx.stroke()
        }
      }
      ctx.setLineDash([])

      // --- nodos -----------------------------------------------------------------------------
      const paint = (list: SimNode[], alpha: number) => {
        byColor.clear()
        for (const nd of list) {
          const c = est.color ? projColor(nd.n.project) : tk.dim
          let l = byColor.get(c)
          if (!l) byColor.set(c, (l = []))
          l.push(nd)
        }
        ctx.globalAlpha = alpha
        for (const [color, l] of byColor) {
          ctx.fillStyle = color
          ctx.beginPath()
          for (const nd of l) {
            const p = P(nd)
            strokeShape(ctx, nd.n.memory_type, p.x, p.y, radius(nd))
          }
          ctx.fill()
        }
      }

      if (hasFocus) {
        paint(visible.filter((nd) => !inFocus(nd.id)), dimmed)
        paint(visible.filter((nd) => inFocus(nd.id)), 1)
      } else {
        paint(visible, 1)
      }
      ctx.globalAlpha = 1

      // --- el nodo del que se habla ----------------------------------------------------------
      //
      // Un ANILLO alrededor, no un disco de otro color encima: el disco tapaba el color del
      // proyecto, que es la informacion que el nodo lleva. Va en `--accent`, que es el color con
      // el que esta aplicacion senala "esto".
      const focus = est.focus ? sim.nodes.find((n) => n.id === est.focus) : null
      if (focus) {
        const p = P(focus)
        const r = radius(focus)
        ctx.strokeStyle = tk.accent
        ctx.lineWidth = est.dragging === focus.id ? 3 : 2
        ctx.beginPath()
        ctx.arc(p.x, p.y, r + 3.5, 0, Math.PI * 2)
        ctx.stroke()
      }

      // --- etiquetas -------------------------------------------------------------------------
      //
      // Dos condiciones, y las dos hacen falta. Solo por aumento, acercarse a la componente de 269
      // escupiria 269 titulos superpuestos. Solo por cantidad, con el grafo entero en pantalla
      // saldrian etiquetas de cuatro pixeles. El enfocado lleva la suya siempre: si has apuntado a
      // algo, saber que es no deberia depender de a que distancia estas.
      // ⚠ CON ALGO SENALADO SE PINTAN SOLO SUS NOMBRES. Antes, si cabian, se pintaban los de todo
      // lo visible ademas del vecindario, y el resultado era un muro de texto alrededor de lo
      // unico que querias leer: el resalte se perdia entre el ruido que venia a quitar.
      // QUIEN LLEVA NOMBRE, EN TRES REGLAS.
      //
      //  1. Lo SENALADO, siempre y a cualquier aumento: si has apuntado a algo, saber que es no
      //     puede depender de a que distancia estas.
      //  2. Sus VECINOS, solo a partir del aumento en el que el texto empieza a leerse. De lejos se
      //     viene a mirar la forma, y cinco enunciados largos alrededor solo tapan.
      //  3. Sin nada senalado, lo que diga `LABEL_CAP`, hoy cero.
      const op = textOpacity(v.k, est.textFrom, est.textFull)
      const enc = hasFocus ? visible.filter((nd) => inFocus(nd.id)) : []
      const neighbors =
        op > 0.02 && enc.length <= (est.labelCap ?? LABEL_CAP_FOCUS)
          ? enc.filter((nd) => nd.id !== est.focus)
          : []
      const withName = focus
        ? [focus, ...neighbors]
        : op > 0.02 && visible.length <= LABEL_CAP
          ? visible
          : []

      if (withName.length) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = tk.bg
        // Ancho de linea proporcional al lienzo: en el grande son unos 200 px y en el mini de una
        // ficha, mucho mas estrecho, lo que quepa sin salirse por los lados.
        const lineWidth = Math.min(210, w * 0.42)
        for (const nd of withName) {
          const p = P(nd)
          const r = radius(nd)
          // EL NOMBRE DEL SENALADO SE ESCRIBE MAS GRANDE que el de sus vecinos. Con todos al
          // mismo cuerpo, en un vecindario de cinco no hay forma de saber cual era el que
          // apuntabas: el anillo lo dice, pero el ojo va antes al texto. Y el texto se aparta un
          // poco mas del nodo, que es el `moveText` de Obsidian: deja respirar al anillo.
          const isFocus = nd.id === est.focus
          ctx.font = isFocus
            ? '600 14px ui-sans-serif, system-ui, sans-serif'
            : '11px ui-sans-serif, system-ui, sans-serif'
          ctx.lineWidth = isFocus ? 4 : 3
          const height = isFocus ? 16 : 13
          const sep = isFocus ? r + 9 : r + 4
          // El senalado a plena luz siempre; los vecinos se funden con el aumento.
          ctx.globalAlpha = isFocus ? 1 : op
          // EL TITULO ENTERO SOLO PARA LO SENALADO, partido en las lineas que haga falta. En este
          // corpus los titulos son enunciados y dos notas del mismo proyecto se distinguen por el
          // final, asi que recortar el que miras se comia justo lo que lo identifica. Los vecinos
          // van a una linea recortada: estan para decir CON QUIEN habla, no para leerlos.
          const resize = (t: string) => ctx.measureText(t).width
          const title = nd.n.title ?? '(sin título)'
          const lines = isFocus
            ? wrapLines(title, lineWidth, resize)
            : [clipToLine(title, lineWidth, resize)]
          for (let i = 0; i < lines.length; i++) {
            const y = p.y + sep + i * height
            ctx.strokeText(lines[i], p.x, y)
            ctx.fillStyle = tk.ink
            ctx.fillText(lines[i], p.x, y)
          }
        }
        ctx.globalAlpha = 1
      }
    },

    destroy() {
      cv.remove()
    },
  }
}
