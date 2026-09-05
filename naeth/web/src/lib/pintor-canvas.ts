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

import { projColor } from './colors'
import type { NodoSim, Simulador } from './sim'
import { radioNodo } from './sim'
import {
  aPantalla,
  opacidadTexto,
  radioEnPantalla,
  TOPE_ETIQUETAS,
  TOPE_ETIQUETAS_FOCO,
  partirEnLineas,
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
      const radio = (nd: NodoSim) => radioEnPantalla(radioNodo(nd.n) * esc, v.k)

      visibles.length = 0
      for (const nd of sim.nodos) if (dentro(P(nd))) visibles.push(nd)

      // --- aristas ---------------------------------------------------------------------------
      //
      // Se agrupan por capa, no por arista: un `setLineDash` y un `stroke` por capa en vez de por
      // linea. Las del vecindario van aparte y encima, con el color de tinta.
      const capas: Record<string, { fondo: [number, number, number, number][]; foco: [number, number, number, number][] }> = {}
      for (const e of sim.aristas) {
        const a = e.source as NodoSim
        const b = e.target as NodoSim
        const pa = P(a)
        const pb = P(b)
        // Basta con que uno de los dos extremos se vea: si no, las aristas largas se cortarian al
        // acercarse, que es cuando mas se miran.
        if (!dentro(pa) && !dentro(pb)) continue
        const c = (capas[e.e.layer] ??= { fondo: [], foco: [] })
        const destino = hayFoco && enFoco(a.id) && enFoco(b.id) ? c.foco : c.fondo
        destino.push([pa.x, pa.y, pb.x, pb.y])
      }

      ctx.lineCap = 'round'
      for (const [capa, l] of Object.entries(capas)) {
        if (l.fondo.length) {
          ctx.globalAlpha = (hayFoco ? apagado : 1) * 0.55
          ctx.strokeStyle = tk.dim
          ctx.lineWidth = 1
          ctx.setLineDash(TRAZO[capa] ?? [])
          ctx.beginPath()
          for (const [x1, y1, x2, y2] of l.fondo) {
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
          }
          ctx.stroke()
        }
        if (l.foco.length) {
          ctx.globalAlpha = 1
          ctx.strokeStyle = tk.ink
          ctx.lineWidth = 1.5
          ctx.setLineDash(TRAZO[capa] ?? [])
          ctx.beginPath()
          for (const [x1, y1, x2, y2] of l.foco) {
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
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
      const op = opacidadTexto(v.k)
      const enc = hayFoco ? visibles.filter((nd) => enFoco(nd.id)) : []
      const conNombre = hayFoco
        ? enc.length <= (est.topeNombres ?? TOPE_ETIQUETAS_FOCO)
          ? enc
          : foco
            ? [foco]
            : []
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
          ctx.globalAlpha = hayFoco ? 1 : op
          // EL TITULO ENTERO, partido en las lineas que haga falta. Recortarlo con puntos
          // suspensivos se comia media frase, y en este corpus los titulos son enunciados: dos
          // notas del mismo proyecto se distinguen justo por el final.
          const lineas = partirEnLineas(nd.n.title ?? '(sin título)', anchoLinea, (t) =>
            ctx.measureText(t).width,
          )
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
