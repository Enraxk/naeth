import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CATALOGO, CLAVES, fabrica, grafoPrefs, mandosDe, olvidarPrefs, poner, restaurar, sanea,
  usarAlmacen, valida, type Almacen, type Valores,
} from './prefs-grafo.svelte'

// Contrato de las preferencias del grafo.
//
// POR QUE ESTOS TESTS Y NO OTROS. Aqui no se prueba que un deslizador mueva un numero, que es
// evidente. Se prueba LO QUE NO SE PUEDE ARREGLAR DESPUES: que un valor imposible guardado no deje
// el grafo inservible. El panel para corregirlo vive DENTRO del grafo, asi que si un `nodoMax` de
// cero sobrevive a la carga, el usuario se queda sin lienzo y sin mandos a la vez, y sin ninguna
// via de vuelta salvo abrir las herramientas del navegador.
//
// Es el segundo test del repo que importa un modulo con runes (`.svelte.ts`), despues de
// `mapa.test.ts`. Si algun dia el plugin de Svelte deja de compilarlos, el sintoma sera un error de
// `$state` en la importacion y no un fallo de logica.

/** Un almacen de mentira, para no depender de `localStorage` en el entorno `node` de Vitest. */
function almacenFalso(inicial: unknown = null): Almacen & { escrito: Valores | null } {
  return {
    escrito: null,
    leer: () => inicial,
    escribir(v) {
      this.escrito = v
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  })
  usarAlmacen(almacenFalso(null))
  olvidarPrefs()
})

describe('el catalogo', () => {
  it('todo mando numerico tiene su fabrica DENTRO de su rango', () => {
    // Si esto cae, el propio valor de fabrica seria invalido y `sanea` lo sustituiria por si mismo
    // en un bucle absurdo. Es barato y protege de una errata al añadir un mando.
    for (const k of CLAVES) {
      const m = CATALOGO[k]
      if (m.tipo !== 'num') continue
      expect(m.fabrica, k).toBeGreaterThanOrEqual(m.min)
      expect(m.fabrica, k).toBeLessThanOrEqual(m.max)
      expect(m.max, k).toBeGreaterThan(m.min)
      expect(m.paso, k).toBeGreaterThan(0)
    }
  })

  it('cada mando pertenece a un grupo que el panel sabe pintar', () => {
    const grupos = ['texto', 'nodos', 'aristas', 'fisica']
    for (const k of CLAVES) expect(grupos, k).toContain(CATALOGO[k].grupo)
    // Y ningun grupo se queda vacio, que seria una seccion en blanco en el panel.
    for (const g of grupos) expect(mandosDe(g as never).length, g).toBeGreaterThan(0)
  })

  it('la fabrica de los valores heredados es la constante que habia en el codigo', () => {
    // El grafo sin tocar nada tiene que verse como siempre. Estos cuatro numeros son los que estaban
    // escritos en `pintor.ts` y `sim.ts`, y si alguien los cambia aqui por gusto, el cambio se nota
    // en todos los grafos sin que nadie haya movido un deslizador.
    const f = fabrica()
    expect(f.textoDesde).toBe(0.75)
    expect(f.textoPleno).toBe(1.65)
    expect(f.distancia).toBe(34)
    expect(f.repulsion).toBe(-38)
  })

  it('lo NUEVO nace encendido, porque Eneko lo eligio viendolo', () => {
    const f = fabrica()
    expect(f.flechas).toBe(true)
    expect(f.puntaPx).toBe(5)
    expect(f.puntaMedio).toBe(true)
    expect(f.tinteFuerza).toBe(0.3)
  })
})

describe('sanea · lo que impide quedarse sin grafo', () => {
  it('un valor fuera de rango cae a fabrica', () => {
    const v = sanea({ nodoMax: 0, distancia: 99999 })
    expect(v.nodoMax).toBe(CATALOGO.nodoMax.fabrica)
    expect(v.distancia).toBe(CATALOGO.distancia.fabrica)
  })

  it('un valor de otro tipo cae a fabrica', () => {
    const v = sanea({ distancia: '80', flechas: 'si', topeNombres: null })
    expect(v.distancia).toBe(34)
    expect(v.flechas).toBe(true)
    expect(v.topeNombres).toBe(26)
  })

  it('NaN e Infinity caen a fabrica', () => {
    // `JSON.parse` no los produce, pero `sanea` tambien recibe lo que le pase el panel.
    expect(sanea({ escalaNodo: NaN }).escalaNodo).toBe(1)
    expect(sanea({ nodoExponente: Infinity }).nodoExponente).toBe(0.6)
  })

  it('lo que no es un objeto no rompe nada', () => {
    for (const basura of [null, undefined, 42, 'roto', [], true]) {
      expect(sanea(basura).distancia).toBe(34)
    }
  })

  it('los rangos del catalogo YA impiden que el radio minimo supere al maximo', () => {
    // Escrito primero al reves, y el test lo destapo: intente probar la validacion cruzada pasando
    // un `nodoMax` de 6, que esta FUERA de su rango [10,120], asi que caia a fabrica antes de llegar
    // al cruce. Con estos rangos el cruce es inalcanzable, porque `nodoMin` como mucho llega a donde
    // `nodoMax` empieza. Lo que hay que fijar no es el caso, es esa invariante: si alguien amplia un
    // rango y la rompe, este test cae y el guard de `sanea` pasa a hacer falta de verdad.
    expect(CATALOGO.nodoMin.max).toBeLessThanOrEqual(CATALOGO.nodoMax.min)

    // Y que dentro de sus rangos los dos se conservan tal cual.
    const v = sanea({ nodoMin: 9, nodoMax: 12 })
    expect(v.nodoMin).toBe(9)
    expect(v.nodoMax).toBe(12)
  })

  it('conserva lo que SI es valido, que es la mitad que importa', () => {
    const v = sanea({ distancia: 80, flechas: false, tinteFuerza: 0.55 })
    expect(v.distancia).toBe(80)
    expect(v.flechas).toBe(false)
    expect(v.tinteFuerza).toBe(0.55)
  })
})

describe('valida', () => {
  it('respeta los dos extremos del rango', () => {
    expect(valida('tinteFuerza', 0)).toBe(0)
    expect(valida('tinteFuerza', 1)).toBe(1)
    expect(valida('tinteFuerza', 1.01)).toBe(0.3)
    expect(valida('tinteFuerza', -0.01)).toBe(0.3)
  })

  it('la repulsion es negativa y su rango tambien', () => {
    expect(valida('repulsion', -120)).toBe(-120)
    expect(valida('repulsion', 50)).toBe(-38)
  })
})

describe('poner, restaurar y olvidar', () => {
  it('poner guarda en el almacen', () => {
    const a = almacenFalso(null)
    usarAlmacen(a)
    poner('distancia', 90)
    expect(grafoPrefs.distancia).toBe(90)
    expect(a.escrito?.distancia).toBe(90)
  })

  it('poner un valor imposible deja el de fabrica, no el imposible', () => {
    poner('nodoMax', 0)
    expect(grafoPrefs.nodoMax).toBe(40)
  })

  it('restaurar un grupo no toca los demas', () => {
    poner('distancia', 90)
    poner('tinteFuerza', 0.9)
    restaurar('fisica')
    expect(grafoPrefs.distancia).toBe(34)
    expect(grafoPrefs.tinteFuerza).toBe(0.9)
  })

  it('restaurar entero devuelve todo a fabrica', () => {
    poner('distancia', 90)
    poner('tinteFuerza', 0.9)
    poner('flechas', false)
    restaurar()
    const f = fabrica()
    for (const k of CLAVES) expect(grafoPrefs[k], k).toBe(f[k])
  })
})

describe('lo que degrada sin romper', () => {
  it('un almacen que LANZA al leer no impide arrancar', () => {
    // Es el caso del modo privado del navegador, donde `localStorage` no devuelve null: lanza.
    const explota: Almacen = {
      leer() { throw new Error('sin permiso') },
      escribir() { throw new Error('sin permiso') },
    }
    expect(() => usarAlmacen({ leer: () => { try { return explota.leer() } catch { return null } }, escribir: () => {} }))
      .not.toThrow()
    expect(grafoPrefs.distancia).toBe(34)
  })

  it('un almacen con basura da fabrica y no revienta', () => {
    usarAlmacen(almacenFalso('{{{ esto no es json'))
    expect(grafoPrefs.distancia).toBe(34)
    expect(grafoPrefs.flechas).toBe(true)
  })

  it('lo guardado por una version futura con claves de mas se ignora', () => {
    // Al reves de lo habitual: aqui la version vieja lee lo que escribio una nueva.
    usarAlmacen(almacenFalso({ distancia: 70, mandoQueNoExiste: 12 }))
    expect(grafoPrefs.distancia).toBe(70)
    expect((grafoPrefs as Record<string, unknown>).mandoQueNoExiste).toBeUndefined()
  })
})
