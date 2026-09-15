import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  localStore, changed, CATALOG, KEYS, LEGACY_KEYS, factory, graphPrefs, GROUPS, controlsOf, migrateKeys,
  forgetPrefs, set, restore, sanitize, useStore, validate, type Store, type Values,
} from './prefs-graph.svelte'

// Contrato de las preferencias del grafo.
//
// POR QUE ESTOS TESTS Y NO OTROS. Aqui no se prueba que un deslizador mueva un numero, que es
// evidente. Se prueba LO QUE NO SE PUEDE ARREGLAR DESPUES: que un valor imposible guardado no deje
// el grafo inservible. El panel para corregirlo vive DENTRO del grafo, asi que si un `nodeMax` de
// cero sobrevive a la carga, el usuario se queda sin lienzo y sin mandos a la vez, y sin ninguna
// via de vuelta salvo abrir las herramientas del navegador.
//
// Es el segundo test del repo que importa un modulo con runes (`.svelte.ts`), despues de
// `layout-map.test.ts`. Si algun dia el plugin de Svelte deja de compilarlos, el sintoma sera un error de
// `$state` en la importacion y no un fallo de logica.

/** Un almacen de mentira, para no depender de `localStorage` en el entorno `node` de Vitest. */
function almacenFalso(inicial: unknown = null): Store & { escrito: Values | null } {
  return {
    escrito: null,
    read: () => inicial,
    write(v) {
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
  useStore(almacenFalso(null))
  forgetPrefs()
})

describe('el catalogo', () => {
  it('todo mando numerico tiene su fabrica DENTRO de su rango', () => {
    // Si esto cae, el propio valor de fabrica seria invalido y `sanitize` lo sustituiria por si mismo
    // en un bucle absurdo. Es barato y protege de una errata al añadir un mando.
    for (const k of KEYS) {
      const m = CATALOG[k]
      if (m.kind !== 'num') continue
      expect(m.factory, k).toBeGreaterThanOrEqual(m.min)
      expect(m.factory, k).toBeLessThanOrEqual(m.max)
      expect(m.max, k).toBeGreaterThan(m.min)
      expect(m.step, k).toBeGreaterThan(0)
    }
  })

  it('cada mando pertenece a un grupo declarado, y ningun grupo se queda vacio', () => {
    // La lista sale de `GROUPS` y no se copia aqui: la primera version la duplicaba y cayo en cuanto
    // entro `experimental`, avisando de algo que no estaba mal. Un grupo vacio si es un defecto de
    // verdad: seria una seccion en blanco en el panel.
    for (const k of KEYS) expect(GROUPS as readonly string[], k).toContain(CATALOG[k].group)
    for (const g of GROUPS) expect(controlsOf(g).length, g).toBeGreaterThan(0)
  })

  it('la fabrica de los valores heredados es la constante que habia en el codigo', () => {
    // El grafo sin tocar nada tiene que verse como siempre. Estos cuatro numeros son los que estaban
    // escritos en `painter.ts` y `sim.ts`, y si alguien los cambia aqui por gusto, el cambio se nota
    // en todos los grafos sin que nadie haya movido un deslizador.
    const f = factory()
    expect(f.textFrom).toBe(0.75)
    expect(f.textFull).toBe(1.65)
    expect(f.distance).toBe(34)
    expect(f.repulsion).toBe(-38)
  })

  it('lo NUEVO nace encendido, porque Eneko lo eligio viendolo', () => {
    const f = factory()
    expect(f.arrows).toBe(true)
    expect(f.arrowPx).toBe(5)
    expect(f.arrowMid).toBe(true)
    expect(f.tintStrength).toBe(0.3)
  })
})

describe('sanitize · lo que impide quedarse sin grafo', () => {
  it('un valor fuera de rango cae a fabrica', () => {
    const v = sanitize({ nodeMax: 0, distance: 99999 })
    expect(v.nodeMax).toBe(CATALOG.nodeMax.factory)
    expect(v.distance).toBe(CATALOG.distance.factory)
  })

  it('un valor de otro tipo cae a fabrica', () => {
    const v = sanitize({ distance: '80', arrows: 'si', labelCap: null })
    expect(v.distance).toBe(34)
    expect(v.arrows).toBe(true)
    expect(v.labelCap).toBe(26)
  })

  it('NaN e Infinity caen a fabrica', () => {
    // `JSON.parse` no los produce, pero `sanitize` tambien recibe lo que le pase el panel.
    expect(sanitize({ nodeScale: NaN }).nodeScale).toBe(1)
    expect(sanitize({ nodeExponent: Infinity }).nodeExponent).toBe(0.6)
  })

  it('lo que no es un objeto no rompe nada', () => {
    for (const basura of [null, undefined, 42, 'roto', [], true]) {
      expect(sanitize(basura).distance).toBe(34)
    }
  })

  it('los rangos del catalogo YA impiden que el radio minimo supere al maximo', () => {
    // Escrito primero al reves, y el test lo destapo: intente probar la validacion cruzada pasando
    // un `nodeMax` de 6, que esta FUERA de su rango [10,120], asi que caia a fabrica antes de llegar
    // al cruce. Con estos rangos el cruce es inalcanzable, porque `nodeMin` como mucho llega a donde
    // `nodeMax` empieza. Lo que hay que fijar no es el caso, es esa invariante: si alguien amplia un
    // rango y la rompe, este test cae y el guard de `sanitize` pasa a hacer falta de verdad.
    expect(CATALOG.nodeMin.max).toBeLessThanOrEqual(CATALOG.nodeMax.min)

    // Y que dentro de sus rangos los dos se conservan tal cual.
    const v = sanitize({ nodeMin: 9, nodeMax: 12 })
    expect(v.nodeMin).toBe(9)
    expect(v.nodeMax).toBe(12)
  })

  it('conserva lo que SI es valido, que es la mitad que importa', () => {
    const v = sanitize({ distance: 80, arrows: false, tintStrength: 0.55 })
    expect(v.distance).toBe(80)
    expect(v.arrows).toBe(false)
    expect(v.tintStrength).toBe(0.55)
  })
})

describe('validate', () => {
  it('respeta los dos extremos del rango', () => {
    expect(validate('tintStrength', 0)).toBe(0)
    expect(validate('tintStrength', 1)).toBe(1)
    expect(validate('tintStrength', 1.01)).toBe(0.3)
    expect(validate('tintStrength', -0.01)).toBe(0.3)
  })

  it('la repulsion es negativa y su rango tambien', () => {
    expect(validate('repulsion', -120)).toBe(-120)
    expect(validate('repulsion', 50)).toBe(-38)
  })
})

describe('poner, restaurar y olvidar', () => {
  it('poner guarda en el almacen', () => {
    const a = almacenFalso(null)
    useStore(a)
    set('distance', 90)
    expect(graphPrefs.distance).toBe(90)
    expect(a.escrito?.distance).toBe(90)
  })

  it('poner un valor imposible deja el de fabrica, no el imposible', () => {
    set('nodeMax', 0)
    expect(graphPrefs.nodeMax).toBe(40)
  })

  it('restaurar un grupo no toca los demas', () => {
    set('distance', 90)
    set('tintStrength', 0.9)
    restore('physics')
    expect(graphPrefs.distance).toBe(34)
    expect(graphPrefs.tintStrength).toBe(0.9)
  })

  it('restaurar entero devuelve todo a fabrica', () => {
    set('distance', 90)
    set('tintStrength', 0.9)
    set('arrows', false)
    restore()
    const f = factory()
    for (const k of KEYS) expect(graphPrefs[k], k).toBe(f[k])
  })
})

describe('lo que degrada sin romper', () => {
  it('un almacen que LANZA al leer no impide arrancar', () => {
    // Es el caso del modo privado del navegador, donde `localStorage` no devuelve null: lanza.
    const explota: Store = {
      read() { throw new Error('sin permiso') },
      write() { throw new Error('sin permiso') },
    }
    expect(() => useStore({ read: () => { try { return explota.read() } catch { return null } }, write: () => {} }))
      .not.toThrow()
    expect(graphPrefs.distance).toBe(34)
  })

  it('un almacen con basura da fabrica y no revienta', () => {
    useStore(almacenFalso('{{{ esto no es json'))
    expect(graphPrefs.distance).toBe(34)
    expect(graphPrefs.arrows).toBe(true)
  })

  it('lo guardado por una version futura con claves de mas se ignora', () => {
    // Al reves de lo habitual: aqui la version vieja lee lo que escribio una nueva.
    useStore(almacenFalso({ distance: 70, mandoQueNoExiste: 12 }))
    expect(graphPrefs.distance).toBe(70)
    expect((graphPrefs as Record<string, unknown>).mandoQueNoExiste).toBeUndefined()
  })
})

describe('changed · el resumen que enseña Ajustes', () => {
  it('recien restaurado no hay ninguno', () => {
    restore()
    expect(changed()).toEqual([])
  })

  it('enumera solo lo que se ha movido', () => {
    restore()
    set('distance', 90)
    set('arrows', false)
    expect(changed().sort()).toEqual(['arrows', 'distance'])
  })

  it('poner un valor igual al de fabrica NO cuenta como cambiado', () => {
    // Importa porque el deslizador puede volver a su sitio, y entonces Ajustes tiene que decir
    // "todo de fabrica" en vez de seguir contandolo.
    restore()
    set('distance', 34)
    expect(changed()).toEqual([])
  })
})

describe('migracion de las claves viejas (2.2026.09.3)', () => {
  // Hasta el 15/09/2026 la clave era `naeth-graph` y los mandos se llamaban en castellano. Lo
  // guardado es de quien lo ajusto mirando el grafo, y un rename no puede costarle sus valores.

  it('la tabla cubre exactamente las claves del catalogo', () => {
    expect(Object.values(LEGACY_KEYS).sort()).toEqual([...KEYS].sort())
  })

  it('traduce lo viejo y deja pasar lo que no conoce', () => {
    expect(migrateKeys({ distancia: 80, flechas: false, mandoQueNoExiste: 12 }))
      .toEqual({ distance: 80, arrows: false, mandoQueNoExiste: 12 })
    expect(sanitize(migrateKeys({ distancia: 80, flechas: false }))).toMatchObject({ distance: 80, arrows: false })
    expect(migrateKeys(null)).toBeNull()
    expect(migrateKeys('basura')).toBe('basura')
  })

  it('el almacen lee la clave vieja si no hay nueva, la escribe traducida y NO borra la vieja', () => {
    const store = new Map<string, string>([['naeth-grafo', JSON.stringify({ distancia: 80, tintado: false })]])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    })
    expect(localStore.read()).toEqual({ distance: 80, tinted: false })
    expect(JSON.parse(store.get('naeth-graph')!)).toEqual({ distance: 80, tinted: false })
    expect(store.has('naeth-grafo')).toBe(true)
    // Con la nueva ya escrita, la vieja deja de contar aunque cambie.
    store.set('naeth-grafo', JSON.stringify({ distancia: 10 }))
    expect(localStore.read()).toEqual({ distance: 80, tinted: false })
    vi.unstubAllGlobals()
  })
})
