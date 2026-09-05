import { describe, expect, it } from 'vitest'
import {
  aMundo, aPantalla, opacidadTexto, partirEnLineas, pathForma, radioEnPantalla, recortarALinea,
  TRAZO, trazarForma,
  verticesForma, ZOOM_TEXTO_DESDE, ZOOM_TEXTO_PLENO, type Vista,
} from './pintor'
import type { MemType } from './types'

// Contrato de la conversion entre mundo y pantalla.
//
// ESTO ES LO QUE HACE QUE EL CLIC CAIGA DONDE DEBE, y por eso se prueba. El 04/09 el clic sobre un
// nodo no abria la nota, se dio por arreglado dos veces sin estarlo, y la segunda fue justo por
// aqui: se comprobo pasando coordenadas de un marco a una herramienta que las esperaba en otro. Un
// par de funciones inversas mal casadas no lanzan nada, solo hacen que apuntar falle por unos
// pixeles y que parezca que el raton no responde.

const vista = (p: Partial<Vista> = {}): Vista => ({ cx: 0, cy: 0, k: 1, w: 800, h: 600, ...p })

describe('mundo y pantalla, ida y vuelta', () => {
  it('el centro de la vista cae en el centro del lienzo', () => {
    const v = vista({ cx: 120, cy: -40 })
    const p = aPantalla(120, -40, v)
    expect(p.x).toBeCloseTo(400)
    expect(p.y).toBeCloseTo(300)
  })

  it('`aMundo` deshace `aPantalla` EXACTAMENTE, a cualquier aumento', () => {
    for (const k of [0.2, 0.75, 1, 3.5, 12]) {
      const v = vista({ cx: -300, cy: 88, k })
      for (const [x, y] of [[0, 0], [1234, -567], [-9, 9]]) {
        const p = aPantalla(x, y, v)
        const m = aMundo(p.x, p.y, v)
        expect(m.x).toBeCloseTo(x, 8)
        expect(m.y).toBeCloseTo(y, 8)
      }
    }
  })

  it('acercarse separa dos puntos en pantalla, pero no los mueve en el mundo', () => {
    const a = aPantalla(100, 0, vista({ k: 1 }))
    const b = aPantalla(200, 0, vista({ k: 1 }))
    const a2 = aPantalla(100, 0, vista({ k: 4 }))
    const b2 = aPantalla(200, 0, vista({ k: 4 }))
    expect(b2.x - a2.x).toBeCloseTo((b.x - a.x) * 4)
  })

  it('cambiar el tamaño del lienzo NO desplaza lo que estabas mirando', () => {
    // Es la razon de que la vista guarde el centro y no una esquina.
    const p1 = aPantalla(50, 50, vista({ cx: 50, cy: 50, w: 800, h: 600 }))
    const p2 = aPantalla(50, 50, vista({ cx: 50, cy: 50, w: 1200, h: 400 }))
    expect(p1.x / 800).toBeCloseTo(p2.x / 1200)
    expect(p1.y / 600).toBeCloseTo(p2.y / 400)
  })
})

describe('el tamaño del nodo con el aumento', () => {
  it('crece al acercarse, que era la queja', () => {
    // "Por mucho que haga zoom una nota va a seguir siendo pequeña cuando tendria que hacerse mas
    // grande si hago zoom a esa" (04/09/2026).
    expect(radioEnPantalla(6, 4)).toBeGreaterThan(radioEnPantalla(6, 1) * 1.8)
  })

  it('no crece linealmente: acercarse no lo convierte en una pelota', () => {
    expect(radioEnPantalla(6, 4)).toBeLessThan(6 * 4)
  })

  it('tiene suelo, para que de lejos no sea polvo invisible', () => {
    // El primer intento del 04/09 salio como una nube de polvo gris: 454 nodos ahi y ninguno
    // visible, porque el radio se encogia con el lienzo sin tope.
    expect(radioEnPantalla(4, 0.02)).toBeGreaterThanOrEqual(1.6)
  })

  it('tiene techo, para que de cerca no tape a los vecinos', () => {
    expect(radioEnPantalla(8, 500)).toBeLessThanOrEqual(40)
  })
})

describe('el fundido del texto', () => {
  it('de lejos no hay nombres, de cerca si', () => {
    expect(opacidadTexto(0.4)).toBe(0)
    expect(opacidadTexto(3)).toBe(1)
  })

  it('con el grafo entero encuadrado NO hay texto, ni siquiera para lo senalado', () => {
    // Los aumentos reales: el encuadre completo del grafo ronda 0,3 o 0,5. De lejos se viene a
    // mirar la forma, y un titulo de tres lineas sobre puntos de dos pixeles es solo ruido.
    expect(opacidadTexto(0.3)).toBe(0)
    expect(opacidadTexto(0.5)).toBe(0)
  })

  it('acercarse a un nodo lo pone a plena luz', () => {
    // 2,6 es el aumento al que lleva senalar en el arbol, y 3 el de la ruta `#/grafo/<id>`.
    expect(opacidadTexto(2.6)).toBe(1)
    expect(opacidadTexto(3)).toBe(1)
  })

  it('el mini grafo cae en pleno fundido, que es donde tiene sentido', () => {
    // Alli el nombre es el del centro y el lienzo son 300 px: se quiere leer, pero sin gritar.
    const enElMini = opacidadTexto(1.2)
    expect(enElMini).toBeGreaterThan(0.3)
    expect(enElMini).toBeLessThan(1)
  })

  it('los dos umbrales estan en orden y son los que dice la curva', () => {
    expect(ZOOM_TEXTO_DESDE).toBeLessThan(ZOOM_TEXTO_PLENO)
    expect(opacidadTexto(ZOOM_TEXTO_DESDE)).toBe(0)
    expect(opacidadTexto(ZOOM_TEXTO_PLENO)).toBe(1)
  })

  it('funde en vez de cortar: hay valores intermedios', () => {
    // Un corte seco al cruzar el umbral hace parpadear medio lienzo con un pellizco de rueda, y el
    // ojo lee ese parpadeo como que han cambiado los datos.
    const medio = opacidadTexto(1.2)
    expect(medio).toBeGreaterThan(0)
    expect(medio).toBeLessThan(1)
  })

  it('nunca se sale de 0 a 1', () => {
    for (const k of [0, 0.001, 50, 1000]) {
      expect(opacidadTexto(k)).toBeGreaterThanOrEqual(0)
      expect(opacidadTexto(k)).toBeLessThanOrEqual(1)
    }
  })
})

describe('el trazo de cada capa', () => {
  it('la relacion es solida y las otras dos no', () => {
    expect(TRAZO.relation).toEqual([])
    expect(TRAZO.wikilink.length).toBeGreaterThan(0)
    expect(TRAZO.semantic.length).toBeGreaterThan(0)
  })

  it('wikilink y semantica se distinguen entre si', () => {
    expect(TRAZO.wikilink).not.toEqual(TRAZO.semantic)
  })
})


describe('las cuatro formas, una sola geometria', () => {
  // Hasta el 05/09/2026 estas formas estaban escritas dos veces, aqui y en el mini grafo de la
  // ficha. Esa duplicacion no falla ruidosamente: cambiar una forma en un sitio y no en el otro
  // hace que el mismo tipo de memoria se vea distinto en dos vistas, y nada avisa. Estos tests
  // son lo que avisa.
  const TIPOS: MemType[] = ['fact', 'decision', 'observation', 'preference']

  it('cada tipo tiene su forma, y ninguna se repite', () => {
    const paths = TIPOS.map((t) => pathForma(t, 0, 0, 10))
    expect(new Set(paths).size).toBe(TIPOS.length)
  })

  it('el SVG y el lienzo dibujan LOS MISMOS vertices', () => {
    // El trazador de canvas se graba en un doble que apunta por donde pasa, y se compara contra
    // las coordenadas del `d` del SVG. Si alguien toca una de las dos rutas, esto cae.
    for (const tipo of TIPOS) {
      const vs = verticesForma(tipo, 5, -3, 8)
      const puntos: number[][] = []
      const espia = {
        moveTo: (x: number, y: number) => puntos.push([x, y]),
        lineTo: (x: number, y: number) => puntos.push([x, y]),
        closePath: () => {},
        arc: () => {},
        rect: () => {},
      } as unknown as CanvasRenderingContext2D
      trazarForma(espia, tipo, 5, -3, 8)

      if (!vs) {
        // El circulo: el lienzo arranca en el borde derecho y el SVG tambien.
        expect(puntos[0]).toEqual([13, -3])
        expect(pathForma(tipo, 5, -3, 8)).toContain('M-3 -3')
        continue
      }
      expect(puntos).toEqual(vs.map(([x, y]) => [x, y]))
      const d = pathForma(tipo, 5, -3, 8)
      for (const [x, y] of vs) expect(d).toContain(`${x} ${y}`)
      expect(d.endsWith('Z')).toBe(true)
    }
  })

  it('el circulo no tiene vertices y los otros tres si', () => {
    expect(verticesForma('fact', 0, 0, 5)).toBe(null)
    expect(verticesForma('decision', 0, 0, 5)).toHaveLength(4)
    expect(verticesForma('observation', 0, 0, 5)).toHaveLength(4)
    expect(verticesForma('preference', 0, 0, 5)).toHaveLength(3)
  })

  it('un tipo desconocido cae en circulo en los dos medios', () => {
    // Un `memory_type` retirado que siga vivo en una nota vieja no puede dejar de dibujarse.
    const raro = 'lo-que-sea' as MemType
    expect(verticesForma(raro, 0, 0, 5)).toBe(null)
    expect(pathForma(raro, 0, 0, 5)).toBe(pathForma('fact', 0, 0, 5))
  })

  it('la forma escala con el radio', () => {
    const chico = verticesForma('decision', 0, 0, 4)!
    const grande = verticesForma('decision', 0, 0, 8)!
    expect(grande[0][0]).toBe(chico[0][0] * 2)
  })
})


describe('partirEnLineas · el titulo entero, sin puntos suspensivos', () => {
  // Antes se recortaba a 38 caracteres, y en este corpus los titulos son enunciados, no nombres de
  // fichero: dos notas del mismo proyecto se distinguen justo por el final, que era lo que se
  // perdia. "CENIT · Paso 8 (multi-nodo) COMPLETO · estado al 2026-07-26" se leia como
  // "CENIT · Paso 8 (multi-nodo) COMPL...".
  //
  // El medidor de mentira cuenta seis pixeles por caracter, que basta para fijar el reparto.
  const medir = (t: string) => t.length * 6

  it('lo que cabe se queda en una linea', () => {
    expect(partirEnLineas('Naeth es publico', 200, medir)).toEqual(['Naeth es publico'])
  })

  it('NO SE PIERDE NI UNA PALABRA, que es lo que se pedia', () => {
    const t = 'CENIT · Paso 8 (multi-nodo) COMPLETO · estado al 2026-07-26'
    expect(partirEnLineas(t, 120, medir).join(' ')).toBe(t)
  })

  it('ninguna linea se pasa del ancho, salvo que sea una palabra sola', () => {
    const t = 'Las huerfanas son 120 y no 190, y los wikilinks rotos 80 y no 41'
    for (const l of partirEnLineas(t, 120, medir)) {
      if (l.includes(' ')) expect(medir(l)).toBeLessThanOrEqual(120)
    }
  })

  it('una palabra mas ancha que el maximo va sola, sin partirla por la mitad', () => {
    // Cortar una palabra se lee peor que una linea que sobresalga un poco.
    const r = partirEnLineas('corto supercalifragilisticoespialidoso fin', 60, medir)
    expect(r).toContain('supercalifragilisticoespialidoso')
  })

  it('un titulo vacio no da una linea vacia', () => {
    expect(partirEnLineas('', 100, medir)).toEqual([])
    expect(partirEnLineas('   ', 100, medir)).toEqual([])
  })

  it('los espacios de sobra no crean lineas fantasma', () => {
    expect(partirEnLineas('uno   dos', 200, medir)).toEqual(['uno dos'])
  })

  it('cuanto mas estrecho, mas lineas, y siempre el texto completo', () => {
    const t = 'El grafo del visor: las nueve decisiones tomadas el 04/09'
    const ancho = partirEnLineas(t, 400, medir)
    const estrecho = partirEnLineas(t, 90, medir)
    expect(estrecho.length).toBeGreaterThan(ancho.length)
    expect(estrecho.join(' ')).toBe(t)
  })
})


describe('recortarALinea · los vecinos van a una linea', () => {
  // El titulo entero se reserva para lo senalado. Los vecinos estan para decir CON QUIEN habla una
  // nota, no para leerlos: si todos salieran completos, un vecindario de cinco enunciados largos
  // vuelve a ser el muro de texto que se quito, y ademas ninguno destacaria.
  const medir = (t: string) => t.length * 6

  it('lo que cabe se deja intacto, sin puntos', () => {
    expect(recortarALinea('Naeth', 200, medir)).toBe('Naeth')
  })

  it('lo que no cabe se recorta y avisa con puntos suspensivos', () => {
    const r = recortarALinea('CENIT · Paso 8 (multi-nodo) COMPLETO · estado al 2026-07-26', 60, medir)
    expect(r.endsWith('…')).toBe(true)
    expect(medir(r)).toBeLessThanOrEqual(60)
  })

  it('el recorte se mide por ANCHO, no por numero de letras', () => {
    // Es el arreglo de contar caracteres: con un medidor donde la eme ocupa el triple, caben menos
    // emes que eles en el mismo ancho. Contando letras las dos frases se cortarian igual.
    const ancho = (t: string) => [...t].reduce((n, c) => n + (c === 'm' ? 18 : 6), 0)
    const emes = recortarALinea('mmmmmmmmmmmmmmmm', 60, ancho)
    const eles = recortarALinea('llllllllllllllll', 60, ancho)
    expect(emes.length).toBeLessThan(eles.length)
  })

  it('no deja un espacio colgando antes de los puntos', () => {
    expect(recortarALinea('uno dos tres cuatro', 30, medir)).not.toContain(' …')
  })

  it('con un ancho ridiculo sigue devolviendo algo, no cadena vacia', () => {
    const r = recortarALinea('cualquier cosa', 1, medir)
    expect(r.length).toBeGreaterThan(0)
  })
})
