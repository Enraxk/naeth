import { describe, expect, it } from 'vitest'
import {
  buildGraph, filtrosPorDefecto, proyectoDe, vecindario,
  type GraphFilters, type GraphModel,
} from './graph'
import type { GraphResponse, TreeRow } from './types'

// Contrato del modelo del grafo.
//
// Por que estos tests y no otros: aqui NADA falla ruidosamente. Una fusion mal hecha no lanza,
// enseña un grafo distinto; una componente mal calculada no rompe, coloca las islas en otro
// sitio. Lo unico que puede avisar es un test que fije el numero esperado.
//
// Las cifras de los comentarios son las MEDIDAS sobre el corpus el 04/09/2026, y estan aqui
// porque son la razon de que cada regla exista.

const row = (id: string, over: Partial<TreeRow> = {}): TreeRow => ({
  id,
  title: `nota ${id}`,
  memory_type: 'fact',
  path: 'naeth/core',
  tags: [],
  created_at: '2026-08-01T10:00:00Z',
  ...over,
})

const A = row('a', { title: 'alfa', path: 'naeth/core' })
const B = row('b', { title: 'beta', path: 'naeth/viewer' })
const C = row('c', { title: 'gamma', path: 'cenit/infra' })
const D = row('d', { title: 'delta', path: 'yogin/tech' })
const SOLA = row('z', { title: 'sin vinculos', path: 'naeth/core' })
const TREE = [A, B, C, D, SOLA]

const resp = (over: Partial<GraphResponse> = {}): GraphResponse => ({
  nodes: TREE.length,
  edges: [],
  links: {},
  ...over,
})

const filtros = (over: Partial<GraphFilters> = {}): GraphFilters => ({
  ...filtrosPorDefecto(),
  ocultarAislados: false,
  ...over,
})

const arista = (m: GraphModel, x: string, y: string) =>
  m.edges.find((e) => (e.source === x && e.target === y) || (e.source === y && e.target === x))

describe('buildGraph · fusion de las tres capas', () => {
  it('una pareja que es relacion Y wikilink sale como relacion, y queda marcada', () => {
    // Es el caso de 128 de las 290 aristas de wikilink del corpus. Fundirlas sin marcar cual es
    // cual perderia el dato de cuanto se separan las dos capas, que es informacion de higiene
    // que hoy no esta en ningun otro sitio.
    const m = buildGraph(TREE, resp({
      edges: [{ source_id: 'a', target_id: 'b', predicate: 'links_to', n: 1 }],
      links: { a: ['beta'] },
    }), new Map(), filtros())
    const e = arista(m, 'a', 'b')!
    expect(e.layer).toBe('relation')
    expect(e.confirmed).toBe(true)
    expect(m.edges).toHaveLength(1)
  })

  it('un wikilink SIN relacion detras aporta arista nueva y no va marcado', () => {
    // Las otras 162 del corpus, que son las que rescatan 45 nodos del limbo.
    const m = buildGraph(TREE, resp({ links: { a: ['gamma'] } }), new Map(), filtros())
    const e = arista(m, 'a', 'c')!
    expect(e.layer).toBe('wikilink')
    expect(e.confirmed).toBeFalsy()
  })

  it('la capa semantica entra por nodo, no de golpe', () => {
    const knn = new Map([['a', [{ id: 'd', sim: 0.94 }]]])
    const m = buildGraph(TREE, resp(), knn, filtros({
      layers: { relation: true, wikilink: true, semantic: true },
    }))
    expect(arista(m, 'a', 'd')!.layer).toBe('semantic')
    expect(arista(m, 'a', 'd')!.sim).toBe(0.94)
  })

  it('una relacion gana a un vecino semantico de la misma pareja', () => {
    const knn = new Map([['a', [{ id: 'b', sim: 0.94 }]]])
    const m = buildGraph(TREE, resp({
      edges: [{ source_id: 'a', target_id: 'b', predicate: 'depends_on', n: 1 }],
    }), knn, filtros({ layers: { relation: true, wikilink: true, semantic: true } }))
    expect(m.edges).toHaveLength(1)
    expect(arista(m, 'a', 'b')!.layer).toBe('relation')
    expect(arista(m, 'a', 'b')!.predicate).toBe('depends_on')
  })

  it('A hacia B y B hacia A son LA MISMA arista del dibujo', () => {
    const m = buildGraph(TREE, resp({
      edges: [
        { source_id: 'a', target_id: 'b', predicate: 'links_to', n: 1 },
        { source_id: 'b', target_id: 'a', predicate: 'links_to', n: 1 },
      ],
    }), new Map(), filtros())
    expect(m.edges).toHaveLength(1)
  })

  it('una capa apagada no aporta nada', () => {
    const m = buildGraph(TREE, resp({
      edges: [{ source_id: 'a', target_id: 'b', predicate: 'links_to', n: 1 }],
      links: { a: ['gamma'] },
    }), new Map(), filtros({ layers: { relation: true, wikilink: false, semantic: false } }))
    expect(m.edges).toHaveLength(1)
    expect(arista(m, 'a', 'c')).toBeUndefined()
  })
})

describe('buildGraph · lo que NO se pinta', () => {
  it('un wikilink de una nota a si misma no es una arista', () => {
    const m = buildGraph(TREE, resp({ links: { a: ['alfa'] } }), new Map(), filtros())
    expect(m.edges).toHaveLength(0)
  })

  it('una arista a un id que no esta en el arbol se descarta', () => {
    // Pasa con el vecino semantico de una memoria retirada hace un momento: el backend la
    // resolvio, el arbol del front todavia no se ha refrescado, y pintarla seria un punto sin
    // titulo ni proyecto.
    const m = buildGraph(TREE, resp({
      edges: [{ source_id: 'a', target_id: 'fantasma', predicate: 'links_to', n: 1 }],
    }), new Map(), filtros())
    expect(m.edges).toHaveLength(0)
  })

  it('un destino de wikilink que no resuelve no inventa arista', () => {
    const m = buildGraph(TREE, resp({ links: { a: ['esto no existe en el corpus'] } }),
                         new Map(), filtros())
    expect(m.edges).toHaveLength(0)
  })
})

describe('buildGraph · filtros', () => {
  it('filtrar por proyecto se lleva las aristas con un extremo fuera', () => {
    const m = buildGraph(TREE, resp({
      edges: [
        { source_id: 'a', target_id: 'b', predicate: 'links_to', n: 1 },
        { source_id: 'a', target_id: 'c', predicate: 'links_to', n: 1 },
      ],
    }), new Map(), filtros({ projects: new Set(['naeth']) }))
    expect(arista(m, 'a', 'b')).toBeDefined()
    expect(arista(m, 'a', 'c')).toBeUndefined()
  })

  it('solo transversales deja las que cruzan de proyecto a proyecto', () => {
    // Es el filtro que enseña las 114 aristas (24%) que el arbol de la izquierda no puede
    // mostrar, y que son la razon de que el grafo exista.
    const m = buildGraph(TREE, resp({
      edges: [
        { source_id: 'a', target_id: 'b', predicate: 'links_to', n: 1 },
        { source_id: 'a', target_id: 'c', predicate: 'links_to', n: 1 },
      ],
    }), new Map(), filtros({ soloTransversales: true }))
    expect(arista(m, 'a', 'b')).toBeUndefined()
    expect(arista(m, 'a', 'c')).toBeDefined()
  })

  it('ocultar aislados los quita y DICE cuantos', () => {
    // El contador cambia al encender la capa de wikilinks, que rescata 45 nodos del limbo. Ese
    // numero moviendose cuenta una historia sola, y por eso se devuelve en vez de callarlo.
    const m = buildGraph(TREE, resp({
      edges: [{ source_id: 'a', target_id: 'b', predicate: 'links_to', n: 1 }],
    }), new Map(), filtros({ ocultarAislados: true }))
    expect(m.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
    expect(m.aislados).toBe(3)
  })

  it('sin ocultar aislados, estan todos y con grado cero', () => {
    const m = buildGraph(TREE, resp({
      edges: [{ source_id: 'a', target_id: 'b', predicate: 'links_to', n: 1 }],
    }), new Map(), filtros())
    expect(m.nodes).toHaveLength(5)
    expect(m.nodes.find((n) => n.id === 'z')!.degree).toBe(0)
  })
})

describe('buildGraph · grado y componentes', () => {
  it('el grado cuenta vecinos distintos, no aristas', () => {
    const m = buildGraph(TREE, resp({
      edges: [
        { source_id: 'a', target_id: 'b', predicate: 'links_to', n: 1 },
        { source_id: 'a', target_id: 'c', predicate: 'links_to', n: 1 },
      ],
    }), new Map(), filtros())
    expect(m.nodes.find((n) => n.id === 'a')!.degree).toBe(2)
    expect(m.nodes.find((n) => n.id === 'b')!.degree).toBe(1)
  })

  it('la componente 0 es SIEMPRE la mayor, no la primera que llega', () => {
    // Sin este orden, el indice de componente dependeria del orden de los nodos en el arbol y el
    // dibujo saltaria entero al recargar, porque la vista coloca la 0 en el centro.
    // Aqui la isla c-d se declara ANTES en las aristas que la masa a-b-z.
    const m = buildGraph(TREE, resp({
      edges: [
        { source_id: 'c', target_id: 'd', predicate: 'links_to', n: 1 },
        { source_id: 'a', target_id: 'b', predicate: 'links_to', n: 1 },
        { source_id: 'b', target_id: 'z', predicate: 'links_to', n: 1 },
      ],
    }), new Map(), filtros({ ocultarAislados: true }))
    const compDe = (id: string) => m.nodes.find((n) => n.id === id)!.component
    expect(compDe('a')).toBe(0)
    expect(compDe('b')).toBe(0)
    expect(compDe('z')).toBe(0)
    expect(compDe('c')).toBe(1)
    expect(m.componentes).toBe(2)
  })
})

describe('vecindario · lo que pinta el mini grafo de la ficha', () => {
  it('trae solo los vecinos a un salto', () => {
    const m = buildGraph(TREE, resp({
      edges: [
        { source_id: 'a', target_id: 'b', predicate: 'links_to', n: 1 },
        { source_id: 'b', target_id: 'c', predicate: 'links_to', n: 1 },
      ],
    }), new Map(), filtros())
    const v = vecindario(m, 'a')
    expect(v.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
    expect(v.edges).toHaveLength(1)
  })

  it('una nota sin vinculos da un vecindario vacio', () => {
    const m = buildGraph(TREE, resp(), new Map(), filtros())
    expect(vecindario(m, 'z').edges).toHaveLength(0)
  })
})

describe('proyectoDe', () => {
  it('es el primer segmento del path', () => {
    expect(proyectoDe('naeth/viewer')).toBe('naeth')
  })

  it('una nota sin path no se queda sin grupo', () => {
    expect(proyectoDe(null)).toBe('(sin path)')
  })
})
