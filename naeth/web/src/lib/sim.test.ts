import { describe, expect, it } from 'vitest'
import { crearSimulador, radioNodo } from './sim'
import type { GraphEdge, GraphModel, GraphNode } from './graph'

// Contrato de la simulacion.
//
// Lo que se prueba NO es que quede bonito, que eso se mira. Se prueba lo que puede romperse sin
// que nadie lo vea: que el punto de partida sea el mismo entre recargas, que no salgan NaN (que en
// un lienzo no lanzan, simplemente dejan de dibujar), que un nodo sujetado se quede quieto, que
// cambiar de filtro no reordene lo que ya estabas mirando, y que la simulacion se calle sola en
// vez de quemar CPU para siempre.

const nodo = (id: string, component = 0, degree = 1): GraphNode => ({
  id,
  title: id,
  path: 'naeth/core',
  project: 'naeth',
  memory_type: 'fact',
  degree,
  component,
})

const arista = (source: string, target: string): GraphEdge => ({ source, target, layer: 'relation' })

const modelo = (nodes: GraphNode[], edges: GraphEdge[] = []): GraphModel => ({
  nodes,
  edges,
  aislados: 0,
  componentes: new Set(nodes.map((n) => n.component)).size,
})

const cadena = (n: number, comp = 0, pre = 'n') => {
  const ns = Array.from({ length: n }, (_, i) => nodo(`${pre}${i}`, comp, 2))
  const es = ns.slice(1).map((x, i) => arista(`${pre}${i}`, x.id))
  return { ns, es }
}

const avanzar = (s: ReturnType<typeof crearSimulador>, veces: number) => {
  let viva = true
  for (let i = 0; i < veces; i++) viva = s.paso()
  return viva
}

describe('simulador · determinismo del punto de partida', () => {
  it('dos simuladores del mismo modelo van al mismo sitio', () => {
    // Es la razon de sembrar el generador con el id y de pasarselo a d3 con `randomSource`. Un
    // grafo que sale distinto en cada recarga obliga a reorientarse cada vez, y a mirar dos veces
    // para saber si lo que cambio fue el corpus o el sorteo.
    const { ns, es } = cadena(8)
    const a = crearSimulador(modelo(ns, es))
    const b = crearSimulador(modelo(ns, es))
    avanzar(a, 40)
    avanzar(b, 40)
    for (let i = 0; i < ns.length; i++) {
      expect(a.nodos[i].x).toBeCloseTo(b.nodos[i].x!, 10)
      expect(a.nodos[i].y).toBeCloseTo(b.nodos[i].y!, 10)
    }
  })

  it('el orden de los nodos en la entrada no cambia donde acaba cada uno', () => {
    const { ns, es } = cadena(6)
    const a = crearSimulador(modelo(ns, es))
    const b = crearSimulador(modelo([...ns].reverse(), es))
    avanzar(a, 30)
    avanzar(b, 30)
    const pa = a.nodos.find((n) => n.id === 'n0')!
    const pb = b.nodos.find((n) => n.id === 'n0')!
    expect(pa.x).toBeCloseTo(pb.x!, 6)
  })
})

describe('simulador · lo degenerado, que no lanza sino que deja de pintar', () => {
  it('NINGUNA posicion es NaN, ni con doce nodos encima del mismo punto', () => {
    const ns = Array.from({ length: 12 }, (_, i) => nodo(`m${i}`, 0, 11))
    const es = ns.slice(1).map((n) => arista('m0', n.id))
    const s = crearSimulador(modelo(ns, es))
    avanzar(s, 60)
    for (const nd of s.nodos) {
      expect(Number.isFinite(nd.x!)).toBe(true)
      expect(Number.isFinite(nd.y!)).toBe(true)
    }
  })

  it('un grafo vacio no revienta y su caja es finita', () => {
    const s = crearSimulador(modelo([]))
    expect(s.paso()).toBe(true)
    const c = s.caja()
    expect(Number.isFinite(c.x0) && Number.isFinite(c.x1)).toBe(true)
    expect(c.x1).toBeGreaterThan(c.x0)
  })

  it('un solo nodo tiene posicion finita y caja con area', () => {
    const s = crearSimulador(modelo([nodo('solo')]))
    avanzar(s, 20)
    expect(Number.isFinite(s.nodos[0].x!)).toBe(true)
    const c = s.caja()
    expect(c.x1 - c.x0).toBeGreaterThan(0)
  })
})

describe('simulador · el arrastre', () => {
  it('un nodo sujetado se queda EXACTAMENTE donde se le pone', () => {
    const { ns, es } = cadena(10)
    const s = crearSimulador(modelo(ns, es))
    s.sujetar('n3', 123, -456)
    s.agitar(1, true)
    avanzar(s, 30)
    const nd = s.nodos.find((n) => n.id === 'n3')!
    expect(nd.x).toBe(123)
    expect(nd.y).toBe(-456)
  })

  it('al soltarlo vuelve a moverse', () => {
    const { ns, es } = cadena(10)
    const s = crearSimulador(modelo(ns, es))
    s.sujetar('n3', 123, -456)
    avanzar(s, 10)
    s.soltar('n3')
    s.agitar(0.8)
    const antes = { ...s.nodos.find((n) => n.id === 'n3')! }
    avanzar(s, 30)
    const nd = s.nodos.find((n) => n.id === 'n3')!
    expect(nd.x === antes.x && nd.y === antes.y).toBe(false)
  })

  it('sujetar un id que no existe no revienta', () => {
    const s = crearSimulador(modelo([nodo('a')]))
    expect(() => {
      s.sujetar('fantasma', 0, 0)
      s.soltar('fantasma')
    }).not.toThrow()
  })
})

describe('simulador · cambiar de filtro no reordena lo que ya mirabas', () => {
  it('los nodos que siguen estando CONSERVAN su posicion', () => {
    // Es el arreglo de los 265 a 411 ms de hilo bloqueado que medimos el 04/09: recalcular desde
    // cero no solo costaba, es que ademas movia de sitio lo que no habia cambiado.
    const { ns, es } = cadena(10)
    const s = crearSimulador(modelo(ns, es))
    avanzar(s, 50)
    const antes = new Map(s.nodos.map((n) => [n.id, { x: n.x!, y: n.y! }]))

    s.cambiar(modelo(ns.slice(0, 6), es.slice(0, 5)))
    for (const nd of s.nodos) {
      expect(nd.x).toBe(antes.get(nd.id)!.x)
      expect(nd.y).toBe(antes.get(nd.id)!.y)
    }
    expect(s.nodos).toHaveLength(6)
  })

  it('los nodos nuevos entran con posicion finita y los que se van desaparecen', () => {
    const { ns, es } = cadena(5)
    const s = crearSimulador(modelo(ns, es))
    avanzar(s, 20)
    const mas = cadena(9)
    s.cambiar(modelo(mas.ns, mas.es))
    expect(s.nodos).toHaveLength(9)
    for (const nd of s.nodos) expect(Number.isFinite(nd.x!)).toBe(true)

    s.cambiar(modelo([nodo('n0')], []))
    expect(s.nodos.map((n) => n.id)).toEqual(['n0'])
  })

  it('una arista a un nodo que ya no esta NO se queda colgada', () => {
    // d3 revienta con "node not found" si un link apunta a un id que no esta en `nodes`.
    const { ns, es } = cadena(6)
    const s = crearSimulador(modelo(ns, es))
    expect(() => {
      s.cambiar(modelo(ns.slice(0, 3), es))
      avanzar(s, 10)
    }).not.toThrow()
    expect(s.aristas).toHaveLength(2)
  })
})

describe('simulador · vecinos en O(1)', () => {
  it('da los vecinos de los dos lados de la arista', () => {
    const s = crearSimulador(modelo([nodo('a'), nodo('b'), nodo('c')], [arista('a', 'b'), arista('b', 'c')]))
    expect([...s.vecinos('b')].sort()).toEqual(['a', 'c'])
    expect([...s.vecinos('a')]).toEqual(['b'])
  })

  it('un nodo suelto devuelve un conjunto vacio, no undefined', () => {
    const s = crearSimulador(modelo([nodo('a'), nodo('b')], []))
    expect(s.vecinos('a').size).toBe(0)
    expect(s.vecinos('nada').size).toBe(0)
  })

  it('la adyacencia se rehace al cambiar el modelo', () => {
    const s = crearSimulador(modelo([nodo('a'), nodo('b')], [arista('a', 'b')]))
    expect(s.vecinos('a').size).toBe(1)
    s.cambiar(modelo([nodo('a'), nodo('b')], []))
    expect(s.vecinos('a').size).toBe(0)
  })
})

describe('simulador · apuntar con el raton', () => {
  it('encuentra el nodo mas cercano y respeta el radio', () => {
    const s = crearSimulador(modelo([nodo('a'), nodo('b')], [arista('a', 'b')]))
    const a = s.nodos[0]
    expect(s.cerca(a.x!, a.y!, 10)?.id).toBe('a')
    expect(s.cerca(a.x! + 5000, a.y!, 10)).toBe(null)
  })
})

describe('simulador · se calla sola', () => {
  it('deja de moverse y `viva` pasa a false', () => {
    // El `idleFrames` de Obsidian: la simulacion para tras quedarse quieta, no corre para siempre.
    // Sin esto el grafo quema CPU con nadie mirandolo.
    const { ns, es } = cadena(12)
    const s = crearSimulador(modelo(ns, es))
    expect(avanzar(s, 400)).toBe(false)
    expect(s.viva()).toBe(false)
  })

  it('`agitar` la despierta, y sostenida no se enfria', () => {
    const { ns, es } = cadena(12)
    const s = crearSimulador(modelo(ns, es))
    avanzar(s, 400)
    s.agitar(0.5)
    expect(s.viva()).toBe(true)

    s.agitar(0.5, true)
    expect(avanzar(s, 300)).toBe(true)
  })
})

describe('simulador · las componentes se quedan en su sitio', () => {
  it('dos componentes no acaban una encima de la otra', () => {
    // El caso del corpus: una masa grande y varias islas. Con un force global las islas salen
    // despedidas y su distancia deja de significar algo.
    const a = cadena(20, 0, 'a')
    const b = cadena(3, 1, 'b')
    const s = crearSimulador(modelo([...a.ns, ...b.ns], [...a.es, ...b.es]))
    avanzar(s, 200)

    const centro = (pre: string) => {
      const l = s.nodos.filter((n) => n.id.startsWith(pre))
      return { x: l.reduce((t, n) => t + n.x!, 0) / l.length, y: l.reduce((t, n) => t + n.y!, 0) / l.length }
    }
    const ca = centro('a')
    const cb = centro('b')
    expect(Math.hypot(ca.x - cb.x, ca.y - cb.y)).toBeGreaterThan(60)
  })

  it('la componente grande NO se apelmaza contra su ancla', () => {
    // El hallazgo de la fase 0: anclando cada nodo a su centro con fuerza uniforme, la componente
    // mayor salia comprimida en un cuadrado. `fuerzaComponente` corrige el centroide y no cada
    // nodo, asi que la componente se traslada entera y por dentro respira.
    const { ns, es } = cadena(30)
    const s = crearSimulador(modelo(ns, es))
    avanzar(s, 250)
    const c = s.caja()
    // Treinta nodos en cadena, con distancia de reposo 34, no caben en un pañuelo.
    expect(Math.max(c.x1 - c.x0, c.y1 - c.y0)).toBeGreaterThan(200)
  })
})

describe('simulador · el radio', () => {
  it('crece con el grado y tiene techo', () => {
    expect(radioNodo(nodo('a', 0, 1))).toBeLessThan(radioNodo(nodo('b', 0, 5)))
    expect(radioNodo(nodo('c', 0, 10))).toBe(radioNodo(nodo('d', 0, 40)))
  })
})
