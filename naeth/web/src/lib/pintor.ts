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
// pixeles, y eso lo hace con `aPantalla`, que es de aqui para que la vista y el pintor no puedan
// discrepar sobre donde cae un nodo (que es como se pierde un clic).

import type { MemType } from './types'
import type { Simulador } from './sim'

/**
 * La camara: que trozo del mundo se mira y con cuanto aumento.
 *
 * `cx`/`cy` son el punto del MUNDO que queda en el centro del lienzo, no una esquina. Con la
 * esquina, cambiar el tamaño de la ventana desplaza lo que estabas mirando; con el centro, no.
 */
export interface Vista {
  cx: number
  cy: number
  k: number
  /** Tamaño del lienzo en pixeles CSS. */
  w: number
  h: number
}

export interface EstadoPintado {
  /** El nodo que lleva el anillo: el del raton, el seleccionado o el senalado en el arbol. */
  foco: string | null
  /**
   * Lo que se queda a plena luz: un nodo con sus vecinos, o una carpeta entera del arbol con los
   * suyos. Los vecinos entran a proposito, porque son lo que ensena hacia donde sale de su
   * proyecto lo que estas mirando, y eso es lo unico que el grafo cuenta y el arbol no.
   */
  encendidos: ReadonlySet<string> | null
  /**
   * Cuanto se ha apagado el resto, de 0 a 1. Lo anima quien llama, no el pintor.
   *
   * Es lo que hace que el resalte no aparezca de golpe. En el grafo de Quartz son 200 ms, y un
   * corte brusco se lee como que ha cambiado algo en los datos en vez de como que has movido el
   * raton.
   */
  atenuacion: number
  /** El que se esta arrastrando, que se pinta agarrado. */
  arrastrando: string | null
  /** Colorear por proyecto o dejarlo en tono neutro. */
  color: boolean
  /**
   * Multiplicador del radio dibujado.
   *
   * Existe por el mini grafo de la ficha: en 276 px de ancho el encuadre da un aumento pequeño, y
   * con el mismo radio que el grafo grande los nodos salen en el suelo de 1,6 px, o sea polvo. No
   * se toca `radioNodo` porque ese radio tambien es el de colision, y agrandarlo separaria los
   * nodos en vez de dibujarlos mas gordos.
   */
  escalaNodo?: number
  /**
   * Cuantos nombres como mucho, cuando hay algo senalado. Por defecto `TOPE_ETIQUETAS_FOCO`.
   *
   * El mini grafo de la ficha lo baja a uno. Alli el centro enciende a TODOS sus vecinos, asi que
   * con el tope normal salian los dieciseis titulos a la vez en 298 px de ancho: el mismo muro de
   * texto que se quito del grafo grande, solo que en un pañuelo. En el mini el nombre lo lleva
   * solo el nodo que estas apuntando.
   */
  topeNombres?: number
}

export interface Pintor {
  dibujar(sim: Simulador, vista: Vista, estado: EstadoPintado): void
  /** Nuevo tamaño en pixeles CSS. */
  medir(w: number, h: number): void
  /**
   * Releer los colores del tema.
   *
   * Un lienzo no entiende `var(--ink)`: hay que resolver los tokens a mano con `getComputedStyle`
   * y volver a hacerlo cuando el tema cambia. Es el precio de no pintar en DOM, y es barato
   * siempre que no se pague en cada frame.
   */
  tema(): void
  destruir(): void
}

/** Mundo a pantalla. La inversa es `aMundo`. */
export const aPantalla = (wx: number, wy: number, v: Vista) => ({
  x: (wx - v.cx) * v.k + v.w / 2,
  y: (wy - v.cy) * v.k + v.h / 2,
})

/** Pantalla a mundo. La necesita el raton: apuntar es preguntar que hay bajo estos pixeles. */
export const aMundo = (sx: number, sy: number, v: Vista) => ({
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
 */
export const radioEnPantalla = (r: number, k: number) =>
  Math.min(Math.max(r * Math.pow(k, 0.6), 1.6), 40)

/**
 * Cuanto se ve el texto con este aumento.
 *
 * Es el "text fade threshold" del grafo de Obsidian. Va por fundido y no por umbral seco porque un
 * corte al cruzar el umbral hace parpadear medio lienzo con un pellizco de rueda.
 */
export const opacidadTexto = (k: number) => Math.max(0, Math.min(1, (k - 0.75) / 0.9))

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
export const TOPE_ETIQUETAS = 0

/**
 * Cuantos nombres se escriben cuando hay algo senalado.
 *
 * Un nodo con sus vecinos son tres o cuatro (grado medio 2,35 medido el 04/09/2026) y se leen. Una
 * carpeta del arbol pueden ser ochenta, y ochenta titulos superpuestos son el mismo muro de texto
 * que se venia a quitar, solo que concentrado. Pasado este tope el lienzo se calla y quien dice
 * que estas mirando es la franja de abajo, que tiene sitio para decirlo bien.
 */
export const TOPE_ETIQUETAS_FOCO = 26

/**
 * LA GEOMETRIA DE LAS CUATRO FORMAS, ESCRITA UNA SOLA VEZ.
 *
 * Devuelve los vertices en orden, o `null` para el circulo, que no tiene vertices. Existe porque
 * hasta el 05/09/2026 estas cuatro formas estaban escritas DOS veces, aqui y en el mini grafo de
 * la ficha, con la misma intencion y distinta sintaxis. Esa duplicacion no falla ruidosamente:
 * cambiar una forma en un sitio y no en el otro hace que el mismo tipo de memoria se vea distinto
 * en dos vistas de la misma aplicacion, y nada avisa.
 *
 * Los dos medios consumen de aqui: `trazarForma` para el lienzo y `pathForma` para el SVG.
 */
export function verticesForma(tipo: MemType, x: number, y: number, r: number): [number, number][] | null {
  switch (tipo) {
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
export function trazarForma(
  ctx: CanvasRenderingContext2D | Path2D,
  tipo: MemType,
  x: number,
  y: number,
  r: number,
) {
  const vs = verticesForma(tipo, x, y, r)
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
export function pathForma(tipo: MemType, x: number, y: number, r: number): string {
  const vs = verticesForma(tipo, x, y, r)
  if (!vs) return `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`
  return `M${vs[0][0]} ${vs[0][1]}` + vs.slice(1).map(([a, b]) => `L${a} ${b}`).join('') + 'Z'
}

/** El trazo de cada capa, en unidades de pantalla. Solida, punteada, discontinua. */
export const TRAZO: Record<string, number[]> = {
  relation: [],
  wikilink: [2, 3],
  semantic: [5, 3],
}
