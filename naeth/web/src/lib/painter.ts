// El contrato del pintado del grafo, y lo que comparten todos los pintores.
//
// POR QUE HAY UN CONTRATO Y NO UN PINTOR A SECAS. Medido el 05/09/2026
// (`docs/discovery/motor-grafo-2026-09-05.md`): con el corpus de hoy da igual el motor, los cuatro
// pasan de 140 fps. Con el corpus de dentro de tres anos, a 4.550 nodos, canvas da 45 fps y SVG
// 19. Y Naeth crece a unas 230 memorias vigentes al mes, asi que ese "dentro de tres anos" tiene
// fecha. Cuando canvas tampoco de, lo que hay que cambiar es esta pieza y no la vista, y por eso
// esta separada desde el primer dia.
//
// El pintor es TONTO a proposito: recibe el estado ya calculado y dibuja. No decide que esta
// enfocado, no anima nada y no toca la simulacion. Lo unico que sabe hacer es convertir mundo en
// pixeles, y eso lo hace con `toScreen`, que es de aqui para que la vista y el pintor no puedan
// discrepar sobre donde cae un nodo (que es como se pierde un clic).

import type { MemType } from './types'
import type { Simulator } from './sim'

/**
 * La camara: que trozo del mundo se mira y con cuanto aumento.
 *
 * `cx`/`cy` son el punto del MUNDO que queda en el centro del lienzo, no una esquina. Con la
 * esquina, cambiar el tamaño de la ventana desplaza lo que estabas mirando; con el centro, no.
 */
export interface Viewport {
  cx: number
  cy: number
  k: number
  /** Tamaño del lienzo en pixeles CSS. */
  w: number
  h: number
}

export interface PaintState {
  /** El nodo que lleva el anillo: el del raton, el seleccionado o el senalado en el arbol. */
  focus: string | null
  /**
   * Lo que se queda a plena luz: un nodo con sus vecinos, o una carpeta entera del arbol con los
   * suyos. Los vecinos entran a proposito, porque son lo que ensena hacia donde sale de su
   * proyecto lo que estas mirando, y eso es lo unico que el grafo cuenta y el arbol no.
   */
  lit: ReadonlySet<string> | null
  /**
   * Cuanto se ha apagado el resto, de 0 a 1. Lo anima quien llama, no el pintor.
   *
   * Es lo que hace que el resalte no aparezca de golpe. En el grafo de Quartz son 200 ms, y un
   * corte brusco se lee como que ha cambiado algo en los datos en vez de como que has movido el
   * raton.
   */
  dimming: number
  /** El que se esta arrastrando, que se pinta agarrado. */
  dragging: string | null
  /** Colorear por proyecto o dejarlo en tono neutro. */
  color: boolean
  /**
   * Multiplicador del radio dibujado.
   *
   * Existe por el mini grafo de la ficha: en 276 px de ancho el encuadre da un aumento pequeño, y
   * con el mismo radio que el grafo grande los nodos salen en el suelo de 1,6 px, o sea polvo. No
   * se toca `nodeRadius` porque ese radio tambien es el de colision, y agrandarlo separaria los
   * nodos en vez de dibujarlos mas gordos.
   */
  nodeScale?: number
  /**
   * Cuantos nombres como mucho, cuando hay algo senalado. Por defecto `LABEL_CAP_FOCUS`.
   *
   * El mini grafo de la ficha lo baja a uno. Alli el centro enciende a TODOS sus vecinos, asi que
   * con el tope normal salian los dieciseis titulos a la vez en 298 px de ancho: el mismo muro de
   * texto que se quito del grafo grande, solo que en un pañuelo. En el mini el nombre lo lleva
   * solo el nodo que estas apuntando.
   */
  labelCap?: number

  // ── Lo que el panel de ajustes gobierna ──────────────────────────────────────────────────
  //
  // TODOS OPCIONALES Y CON EL VALOR DE SIEMPRE POR DEFECTO. Este objeto ya era el canal de opciones
  // del pintor (`color`, `nodeScale`, `labelCap`), asi que los mandos entran por aqui en vez de
  // por una via nueva. Y siendo opcionales, quien no los pase (el mini, los tests) sigue viendo
  // exactamente el grafo de antes.

  /** Umbrales del fundido del texto. Ver `textOpacity`. */
  textFrom?: number
  textFull?: number
  /** Reparto del tamaño del nodo entre pantalla y mundo, y sus topes. Ver `screenRadius`. */
  nodoExp?: number
  nodeMin?: number
  nodeMax?: number
  /**
   * Punta de flecha en las aristas de relacion, y de que tamaño.
   *
   * De 501 relaciones medidas el 05/09 no hay UNA sola reciproca, asi que la direccion nunca es
   * redundante. El tamaño de 5 px y la posicion a media arista los eligio Eneko mirando el banco:
   * en el extremo la punta compite con el nodo y con lo que se cruce ahi.
   */
  arrows?: boolean
  arrowPx?: number
  arrowMid?: boolean
  /**
   * Color de la arista por tipo de relacion, y cuanto tiñe.
   *
   * `tintStrength` mezcla con el gris de siempre: 1 es el color puro y 0 el gris de hoy. A 0,3 el
   * contraste contra el fondo es 5,5:1, practicamente el 5,2:1 del gris, o sea que informa sin
   * pesar mas. Medido el 06/09 en `bench/canal-vivo.html`.
   */
  tinted?: boolean
  tintStrength?: number

  // ── Experimental ────────────────────────────────────────────────────────────────────────
  /**
   * Cuanto se arquea una arista, como fraccion de su largo. 0 son rectas.
   *
   * Sirve para distinguir dos vinculos entre el mismo par de memorias, que hoy se pintan
   * exactamente encima uno del otro. El precio es que el grafo deja de leerse como una malla.
   */
  curvature?: number
  /** Peso de cada capa, de 0 a 1. Multiplica su opacidad: bajarla la deja de fondo, no la apaga. */
  pesoCapa?: Record<string, number>
}

export interface Painter {
  draw(sim: Simulator, view: Viewport, state: PaintState): void
  /** Nuevo tamaño en pixeles CSS. */
  resize(w: number, h: number): void
  /**
   * Releer los colores del tema.
   *
   * Un lienzo no entiende `var(--ink)`: hay que resolver los tokens a mano con `getComputedStyle`
   * y volver a hacerlo cuando el tema cambia. Es el precio de no pintar en DOM, y es barato
   * siempre que no se pague en cada frame.
   */
  theme(): void
  destroy(): void
}

/** Mundo a pantalla. La inversa es `toWorld`. */
export const toScreen = (wx: number, wy: number, v: Viewport) => ({
  x: (wx - v.cx) * v.k + v.w / 2,
  y: (wy - v.cy) * v.k + v.h / 2,
})

/** Pantalla a mundo. La necesita el raton: apuntar es preguntar que hay bajo estos pixeles. */
export const toWorld = (sx: number, sy: number, v: Viewport) => ({
  x: (sx - v.w / 2) / v.k + v.cx,
  y: (sy - v.h / 2) / v.k + v.cy,
})

/**
 * Cuanto mide un nodo EN PANTALLA con este aumento.
 *
 * Ni tamaño fijo en pantalla ni tamaño fijo en el mundo, sino algo entre medias, que es el
 * `nodeScale` de Obsidian. Con tamaño fijo en pantalla, acercarse a una nota no sirve de nada y
 * sigue siendo un punto igual de pequeño, que fue la queja literal del 04/09. Con tamaño fijo en
 * el mundo, el grafo entero se ve como polvo de lejos y como pelotas gigantes de cerca.
 *
 * El exponente 0,6 es el reparto: acercarse el triple agranda el nodo casi el doble.
 *
 * ⚠ LOS TRES NUMEROS SON AHORA PARAMETROS CON EL VALOR DE SIEMPRE POR DEFECTO. No es un capricho de
 * firma: es lo que permite que el panel de ajustes los mueva sin que ninguna de las 34 pruebas de
 * `painter.test.ts` cambie una linea. Que esos tests sigan verdes llamando con dos argumentos ES la
 * prueba de que convertir constantes en mandos no ha movido el grafo de sitio.
 */
export const screenRadius = (r: number, k: number, exp = 0.6, min = 1.6, max = 40) =>
  Math.min(Math.max(r * Math.pow(k, exp), min), max)

/**
 * A partir de que aumento empiezan a verse los nombres, y a partir de cual se ven del todo.
 *
 * Son los dos numeros del "text fade threshold" de Obsidian, y los que la fase 3.5 convertira en un
 * deslizador. Los valores salen de los aumentos reales de la aplicacion: con el grafo entero
 * encuadrado el aumento ronda 0,3 o 0,5, asi que ahi no hay texto; acercarse a un nodo lleva a 2,6
 * y la ruta `#/graph/<id>` a 3, donde ya se lee todo; el mini grafo de una ficha se queda entre 1 y
 * 1,5, o sea en pleno fundido, que es donde tiene sentido porque ahi el nombre es el del centro.
 */
export const TEXT_ZOOM_FROM = 0.75
export const TEXT_ZOOM_FULL = 1.65

/**
 * Cuanto se ve el texto con este aumento.
 *
 * Va por fundido y no por umbral seco porque un corte al cruzar el umbral hace parpadear medio
 * lienzo con un pellizco de rueda, y el ojo lee ese parpadeo como que han cambiado los datos.
 */
export const textOpacity = (k: number, from = TEXT_ZOOM_FROM, pleno = TEXT_ZOOM_FULL) =>
  // Con los dos umbrales pegados la division se va a Infinity y el texto parpadea entre 0 y 1. El
  // panel deja moverlos por separado, asi que el suelo tiene que estar aqui y no en el panel.
  Math.max(0, Math.min(1, (k - from) / Math.max(pleno - from, 0.01)))

/**
 * Cuantos nombres se escriben SIN nada senalado. Hoy: ninguno.
 *
 * Se cuenta sobre lo que hay dentro del lienzo, no sobre el corpus, asi que con un numero alto los
 * nombres iban apareciendo al acercarse. Probado con 110 el 05/09/2026 y el grafo en reposo se
 * leia como un muro de texto: nadie esta buscando ahi un titulo concreto, y el ruido tapaba la
 * forma del grafo, que es lo que se ha venido a mirar.
 *
 * EL MECANISMO SE QUEDA, solo se pone a cero. Es exactamente el "text fade threshold" de Obsidian,
 * y en la fase 3.5 pasa a ser un deslizador. Retirarlo ahora seria tirar la pieza para volver a
 * escribirla dentro de dos fases.
 */
export const LABEL_CAP = 0

/**
 * Cuantos nombres se escriben cuando hay algo senalado.
 *
 * Un nodo con sus vecinos son tres o cuatro (grado medio 2,35 medido el 04/09/2026) y se leen. Una
 * carpeta del arbol pueden ser ochenta, y ochenta titulos superpuestos son el mismo muro de texto
 * que se venia a quitar, solo que concentrado. Pasado este tope el lienzo se calla y quien dice
 * que estas mirando es la franja de abajo, que tiene sitio para decirlo bien.
 */
export const LABEL_CAP_FOCUS = 26

/**
 * LA GEOMETRIA DE LAS CUATRO FORMAS, ESCRITA UNA SOLA VEZ.
 *
 * Devuelve los vertices en orden, o `null` para el circulo, que no tiene vertices. Existe porque
 * hasta el 05/09/2026 estas cuatro formas estaban escritas DOS veces, aqui y en el mini grafo de
 * la ficha, con la misma intencion y distinta sintaxis. Esa duplicacion no falla ruidosamente:
 * cambiar una forma en un sitio y no en el otro hace que el mismo tipo de memoria se vea distinto
 * en dos vistas de la misma aplicacion, y nada avisa.
 *
 * Los dos medios consumen de aqui: `strokeShape` para el lienzo y `shapePath` para el SVG.
 */
export function shapeVertices(kind: MemType, x: number, y: number, r: number): [number, number][] | null {
  switch (kind) {
    case 'decision':
      return [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]]
    case 'observation':
      return [[x, y - r], [x + r, y], [x, y + r], [x - r, y]]
    case 'preference':
      return [[x, y - r], [x + r, y + r * 0.8], [x - r, y + r * 0.8]]
    default:
      // `fact` y cualquier tipo retirado que siga vivo en una nota vieja: circulo.
      return null
  }
}

/**
 * Las cuatro formas trazadas sobre el path que le pasen, para el lienzo.
 *
 * No hace `beginPath` ni `fill`: eso es cosa de quien llama, que agrupa por color para no cambiar
 * de `fillStyle` una vez por nodo. Con 4.550 nodos esa diferencia es el pintado entero.
 */
export function strokeShape(
  ctx: CanvasRenderingContext2D | Path2D,
  kind: MemType,
  x: number,
  y: number,
  r: number,
) {
  const vs = shapeVertices(kind, x, y, r)
  if (!vs) {
    ctx.moveTo(x + r, y)
    ctx.arc(x, y, r, 0, Math.PI * 2)
    return
  }
  ctx.moveTo(vs[0][0], vs[0][1])
  for (let i = 1; i < vs.length; i++) ctx.lineTo(vs[i][0], vs[i][1])
  ctx.closePath()
}

/**
 * Las mismas cuatro formas como atributo `d` de un `<path>`, para el SVG del mini grafo.
 *
 * El circulo se dibuja con dos arcos y no con `<circle>` para que el vocabulario entero quepa en
 * un solo elemento: asi el mini grafo tiene un `<path>` por nodo y no dos ramas de marcado segun
 * el tipo.
 */
export function shapePath(kind: MemType, x: number, y: number, r: number): string {
  const vs = shapeVertices(kind, x, y, r)
  if (!vs) return `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`
  return `M${vs[0][0]} ${vs[0][1]}` + vs.slice(1).map(([a, b]) => `L${a} ${b}`).join('') + 'Z'
}

/**
 * Parte un titulo en las lineas que hagan falta para que quepa entero.
 *
 * Antes se recortaba a 38 caracteres con puntos suspensivos, y en este corpus eso se comia media
 * frase: los titulos son enunciados, no nombres de fichero. "CENIT · Paso 8 (multi-nodo) COMPLETO ·
 * estado al 2026-07-26" son 58 caracteres, y lo que se leia era "CENIT · Paso 8 (multi-nodo) COMPL…",
 * que no distingue una nota de la de al lado. Pero entero en una sola linea tampoco vale: se sale
 * del lienzo del mini grafo y pisa a los vecinos en el grande. Asi que se parte.
 *
 * El medidor se pasa de fuera para que la funcion sea pura y se pueda probar sin lienzo. Una
 * palabra mas ancha que el maximo se deja sola en su linea en vez de partirla por la mitad: cortar
 * una palabra es mas dificil de leer que una linea que sobresalga un poco.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  resize: (s: string) => number,
): string[] {
  const palabras = text.split(/\s+/).filter(Boolean)
  if (!palabras.length) return []
  const out: string[] = []
  let line = palabras[0]
  for (let i = 1; i < palabras.length; i++) {
    const prueba = line + ' ' + palabras[i]
    if (resize(prueba) <= maxWidth) line = prueba
    else {
      out.push(line)
      line = palabras[i]
    }
  }
  out.push(line)
  return out
}

/**
 * Recorta un titulo a una sola linea, con puntos suspensivos si no cabe.
 *
 * Es para los VECINOS de lo senalado. El titulo entero se reserva para el nodo que estas mirando:
 * si todos se escribieran completos, un vecindario de cinco enunciados largos vuelve a ser el muro
 * de texto que se quito, y ademas ninguno destacaria sobre los demas.
 *
 * Se mide por ancho real y no por numero de caracteres, que es lo que habia antes: una eme y una
 * ele no ocupan lo mismo, asi que contar letras recorta de mas en unos titulos y de menos en otros.
 */
export function clipToLine(
  text: string,
  maxWidth: number,
  resize: (s: string) => number,
): string {
  if (resize(text) <= maxWidth) return text
  let corte = text.length
  while (corte > 1 && resize(text.slice(0, corte) + '…') > maxWidth) corte--
  return text.slice(0, corte).trimEnd() + '…'
}

/** El trazo de cada capa, en unidades de pantalla. Solida, punteada, discontinua. */
export const DASH: Record<string, number[]> = {
  relation: [],
  wikilink: [2, 3],
  semantic: [5, 3],
}

/**
 * Mezcla dos colores hex. `f` es cuanto pesa el primero: 1 lo deja tal cual, 0 devuelve el segundo.
 *
 * Es lo que hace utilizable el color por tipo de relacion. A plena saturacion los tintes cambian el
 * caracter del grafo entero y compiten con el apagado del resalte; mezclados con el gris de siempre
 * informan sin pesar mas. Medido el 06/09 en `bench/canal-vivo.html`: a fuerza 0,3 el contraste
 * contra el fondo es 5,5:1, donde el gris de hoy da 5,2:1.
 *
 * Acepta `#rgb` y `#rrggbb`. Lo que no entienda lo devuelve intacto, porque un color mal escrito
 * tiene que pintar raro y no romper el frame.
 */
export function blend(a: string, b: string, f: number): string {
  const h = (c: string): [number, number, number] | null => {
    const s = c.trim()
    if (s[0] !== '#') return null
    const t = s.length === 4 ? '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3] : s
    if (t.length !== 7) return null
    const n = Number.parseInt(t.slice(1), 16)
    return Number.isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const x = h(a)
  const y = h(b)
  if (!x || !y) return a
  const p = Math.max(0, Math.min(1, f))
  const v = x.map((c, i) => Math.round(c * p + y[i] * (1 - p)))
  return '#' + v.map((c) => c.toString(16).padStart(2, '0')).join('')
}
