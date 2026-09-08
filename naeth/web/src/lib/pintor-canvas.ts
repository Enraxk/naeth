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
import type { NodoSim, Simulador } from './sim'
import { radioNodo } from './sim'
import {
  aPantalla,
  mezcla,
  opacidadTexto,
  radioEnPantalla,
  TOPE_ETIQUETAS,
  TOPE_ETIQUETAS_FOCO,
  partirEnLineas,
  recortarALinea,
  TRAZO,
  trazarForma,
  type EstadoPintado,
  type Pintor,
  type Vista,
} from './pintor'

interface Tokens {
  ink: string
  dim: string
  bg: string
  accent: string
  borde: string
}

function leerTokens(): Tokens {
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

export function pintorCanvas(host: HTMLElement): Pintor {
  const cv = document.createElement('canvas')
  cv.style.width = '100%'
  cv.style.height = '100%'
  cv.style.display = 'block'
  host.appendChild(cv)
  const ctx = cv.getContext('2d')!

  let tk = leerTokens()
  let dpr = 1
  let w = 0
  let h = 0

  /** Nodos y aristas visibles, reutilizados entre frames para no crear basura a 60 fps. */
  const visibles: NodoSim[] = []
  const porColor = new Map<string, NodoSim[]>()

  return {
    medir(nw, nh) {
      w = nw
      h = nh
      // Tope de 2 en el ratio: por encima se cuadruplican los pixeles a rellenar sin que nadie
      // note la diferencia en un grafo de puntos y lineas.
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = Math.max(1, Math.round(w * dpr))
      cv.height = Math.max(1, Math.round(h * dpr))
    },

    tema() {
      tk = leerTokens()
    },

    dibujar(sim: Simulador, v: Vista, est: EstadoPintado) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (!sim.nodos.length) return

      const P = (nd: NodoSim) => aPantalla(nd.x ?? 0, nd.y ?? 0, v)
      // Margen de un radio grande para que un nodo a medio salir no parpadee al entrar.
      const m = 48
      const dentro = (p: { x: number; y: number }) =>
        p.x > -m && p.x < w + m && p.y > -m && p.y < h + m

      const hayFoco = !!est.encendidos?.size && est.atenuacion > 0.001
      const enFoco = (id: string) => !hayFoco || est.encendidos!.has(id) || id === est.foco
      // Cuanto se apaga lo que no es del vecindario. Quartz usa 0,2 sobre fondo claro; aqui la
      // paleta ya esta desaturada y el fondo es oscuro, asi que a 0,18 el resto desaparecia del
      // todo y el grafo se quedaba sin contexto alrededor de lo que miras. A 0,3 el resto sigue
      // ahi, como fondo, que es lo que hace que resaltar signifique algo.
      const apagado = 1 - 0.7 * est.atenuacion
      const esc = est.escalaNodo ?? 1
      const radio = (nd: NodoSim) =>
        radioEnPantalla(radioNodo(nd.n) * esc, v.k, est.nodoExp, est.nodoMin, est.nodoMax)

      visibles.length = 0
      for (const nd of sim.nodos) if (dentro(P(nd))) visibles.push(nd)

      // --- aristas ---------------------------------------------------------------------------
      //
      // Se agrupan por capa, no por arista: un `setLineDash` y un `stroke` por capa en vez de por
      // linea. Las del vecindario van aparte y encima, con el color de tinta.
      // El grupo era la capa; ahora es capa mas tipo de relacion, porque cada tipo puede llevar su
      // tinte. Siguen siendo pocos grupos (tres capas por tres predicados como mucho), asi que la
      // optimizacion de un `stroke` por grupo se conserva entera.
      const tintado = est.tintado ?? false
      const fuerza = est.tinteFuerza ?? 0
      const capas: Record<string, {
        capa: string; pred: string
        fondo: [number, number, number, number][]; foco: [number, number, number, number][]
      }> = {}
      for (const e of sim.aristas) {
        const a = e.source as NodoSim
        const b = e.target as NodoSim
        const pa = P(a)
        const pb = P(b)
        // Basta con que uno de los dos extremos se vea: si no, las aristas largas se cortarian al
        // acercarse, que es cuando mas se miran.
        if (!dentro(pa) && !dentro(pb)) continue
        const capa = e.e.layer
        const pred = tintado && capa === 'relation' ? (e.e.predicate ?? '') : ''
        const c = (capas[capa + '|' + pred] ??= { capa, pred, fondo: [], foco: [] })
        const destino = hayFoco && enFoco(a.id) && enFoco(b.id) ? c.foco : c.fondo
        destino.push([pa.x, pa.y, pb.x, pb.y])
      }

      /**
       * Mete la punta de flecha en el MISMO path que la arista, para no pagar un `stroke` por linea.
       *
       * Se para antes del nodo destino, o a media arista si asi se pide: en el extremo la punta
       * compite con el propio nodo y con todo lo que se cruce ahi, y Eneko la prefirio en medio
       * viendo las dos en el banco. `d * 0.35` evita que en una arista muy corta la punta sea mas
       * larga que la propia arista.
       */
      const punta = (x1: number, y1: number, x2: number, y2: number, px: number, medio: boolean) => {
        const dx = x2 - x1
        const dy = y2 - y1
        const d = Math.hypot(dx, dy)
        if (d < 6) return
        const retro = medio ? d * 0.5 : 7
        const ex = x2 - (dx / d) * retro
        const ey = y2 - (dy / d) * retro
        const ang = Math.atan2(dy, dx)
        const l = Math.min(px, d * 0.35)
        ctx.moveTo(ex, ey)
        ctx.lineTo(ex - l * Math.cos(ang - 0.42), ey - l * Math.sin(ang - 0.42))
        ctx.moveTo(ex, ey)
        ctx.lineTo(ex - l * Math.cos(ang + 0.42), ey - l * Math.sin(ang + 0.42))
      }
      const conFlechas = (est.flechas ?? false) && (est.puntaPx ?? 0) > 0
      const puntaPx = est.puntaPx ?? 5
      const puntaMedio = est.puntaMedio ?? true

      ctx.lineCap = 'round'
      for (const l of Object.values(capas)) {
        // El tinte tiñe el trazo; el estado (apagado o encendido) sigue mandando en la OPACIDAD y en
        // si el color base es `dim` o `ink`. Son dos canales distintos y por eso conviven: el tipo
        // se lee en el tono y el resalte en cuanta luz tiene.
        const tinte = l.pred ? predColor(l.pred) : null
        const flechasAqui = conFlechas && l.capa === 'relation'
        if (l.fondo.length) {
          ctx.globalAlpha = (hayFoco ? apagado : 1) * 0.55
          ctx.strokeStyle = tinte ? mezcla(tinte, tk.dim, fuerza) : tk.dim
          ctx.lineWidth = 1
          ctx.setLineDash(TRAZO[l.capa] ?? [])
          ctx.beginPath()
          for (const [x1, y1, x2, y2] of l.fondo) {
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            if (flechasAqui) punta(x1, y1, x2, y2, puntaPx, puntaMedio)
          }
          ctx.stroke()
        }
        if (l.foco.length) {
          ctx.globalAlpha = 1
          ctx.strokeStyle = tinte ? mezcla(tinte, tk.ink, fuerza) : tk.ink
          ctx.lineWidth = 1.5
          ctx.setLineDash(TRAZO[l.capa] ?? [])
          ctx.beginPath()
          for (const [x1, y1, x2, y2] of l.foco) {
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            if (flechasAqui) punta(x1, y1, x2, y2, puntaPx, puntaMedio)
          }
          ctx.stroke()
        }
      }
      ctx.setLineDash([])

      // --- nodos -----------------------------------------------------------------------------
      const pinta = (lista: NodoSim[], alpha: number) => {
        porColor.clear()
        for (const nd of lista) {
          const c = est.color ? projColor(nd.n.project) : tk.dim
          let l = porColor.get(c)
          if (!l) porColor.set(c, (l = []))
          l.push(nd)
        }
        ctx.globalAlpha = alpha
        for (const [color, l] of porColor) {
          ctx.fillStyle = color
          ctx.beginPath()
          for (const nd of l) {
            const p = P(nd)
            trazarForma(ctx, nd.n.memory_type, p.x, p.y, radio(nd))
          }
          ctx.fill()
        }
      }

      if (hayFoco) {
        pinta(visibles.filter((nd) => !enFoco(nd.id)), apagado)
        pinta(visibles.filter((nd) => enFoco(nd.id)), 1)
      } else {
        pinta(visibles, 1)
      }
      ctx.globalAlpha = 1

      // --- el nodo del que se habla ----------------------------------------------------------
      //
      // Un ANILLO alrededor, no un disco de otro color encima: el disco tapaba el color del
      // proyecto, que es la informacion que el nodo lleva. Va en `--accent`, que es el color con
      // el que esta aplicacion senala "esto".
      const foco = est.foco ? sim.nodos.find((n) => n.id === est.foco) : null
      if (foco) {
        const p = P(foco)
        const r = radio(foco)
        ctx.strokeStyle = tk.accent
        ctx.lineWidth = est.arrastrando === foco.id ? 3 : 2
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
      //  3. Sin nada senalado, lo que diga `TOPE_ETIQUETAS`, hoy cero.
      const op = opacidadTexto(v.k, est.textoDesde, est.textoPleno)
      const enc = hayFoco ? visibles.filter((nd) => enFoco(nd.id)) : []
      const vecinos =
        op > 0.02 && enc.length <= (est.topeNombres ?? TOPE_ETIQUETAS_FOCO)
          ? enc.filter((nd) => nd.id !== est.foco)
          : []
      const conNombre = foco
        ? [foco, ...vecinos]
        : op > 0.02 && visibles.length <= TOPE_ETIQUETAS
          ? visibles
          : []

      if (conNombre.length) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = tk.bg
        // Ancho de linea proporcional al lienzo: en el grande son unos 200 px y en el mini de una
        // ficha, mucho mas estrecho, lo que quepa sin salirse por los lados.
        const anchoLinea = Math.min(210, w * 0.42)
        for (const nd of conNombre) {
          const p = P(nd)
          const r = radio(nd)
          // EL NOMBRE DEL SENALADO SE ESCRIBE MAS GRANDE que el de sus vecinos. Con todos al
          // mismo cuerpo, en un vecindario de cinco no hay forma de saber cual era el que
          // apuntabas: el anillo lo dice, pero el ojo va antes al texto. Y el texto se aparta un
          // poco mas del nodo, que es el `moveText` de Obsidian: deja respirar al anillo.
          const esFoco = nd.id === est.foco
          ctx.font = esFoco
            ? '600 14px ui-sans-serif, system-ui, sans-serif'
            : '11px ui-sans-serif, system-ui, sans-serif'
          ctx.lineWidth = esFoco ? 4 : 3
          const alto = esFoco ? 16 : 13
          const sep = esFoco ? r + 9 : r + 4
          // El senalado a plena luz siempre; los vecinos se funden con el aumento.
          ctx.globalAlpha = esFoco ? 1 : op
          // EL TITULO ENTERO SOLO PARA LO SENALADO, partido en las lineas que haga falta. En este
          // corpus los titulos son enunciados y dos notas del mismo proyecto se distinguen por el
          // final, asi que recortar el que miras se comia justo lo que lo identifica. Los vecinos
          // van a una linea recortada: estan para decir CON QUIEN habla, no para leerlos.
          const medir = (t: string) => ctx.measureText(t).width
          const titulo = nd.n.title ?? '(sin título)'
          const lineas = esFoco
            ? partirEnLineas(titulo, anchoLinea, medir)
            : [recortarALinea(titulo, anchoLinea, medir)]
          for (let i = 0; i < lineas.length; i++) {
            const y = p.y + sep + i * alto
            ctx.strokeText(lineas[i], p.x, y)
            ctx.fillStyle = tk.ink
            ctx.fillText(lineas[i], p.x, y)
          }
        }
        ctx.globalAlpha = 1
      }
    },

    destruir() {
      cv.remove()
    },
  }
}
