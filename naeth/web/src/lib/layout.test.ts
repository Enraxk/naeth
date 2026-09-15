import { describe, expect, it } from 'vitest'
import { place } from './layout'
import type { GraphEdge, GraphModel, GraphNode } from './graph'

// Contrato de la colocacion.
//
// Lo que se prueba NO es que quede bonito, que eso se mira. Se prueba lo que puede romperse sin
// que nadie lo vea: que el dibujo sea el mismo entre recargas, que las componentes no se pisen, y
// que un caso degenerado no produzca NaN, que en SVG no lanza nada y simplemente deja de pintar.

const node = (id: string, component: number): GraphNode => ({
  id,
  title: id,
  path: 'naeth/core',
  project: 'naeth',
  memory_type: 'fact',
  degree: 1,
  component,
})

const edge = (source: string, target: string): GraphEdge => ({
  source,
  target,
  layer: 'relation',
})

const modelo = (nodes: GraphNode[], edges: GraphEdge[] = []): GraphModel => ({
  nodes,
  edges,
  isolated: 0,
  hiddenEdges: 0,
  components: new Set(nodes.map((n) => n.component)).size,
})

describe('place · determinismo', () => {
  it('el mismo grafo se coloca IGUAL dos veces', () => {
    // Es la razon de que las posiciones de partida salgan de un PRNG sembrado con el id y no de
    // Math.random. Un layout que cambia en cada recarga obliga a reorientarse cada vez.
    const m = modelo(
      [node('a', 0), node('b', 0), node('c', 0), node('d', 0)],
      [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')],
    )
    const p1 = place(m, { iterations: 30 })
    const p2 = place(m, { iterations: 30 })
    for (const n of m.nodes) {
      expect(p1.pos.get(n.id)).toEqual(p2.pos.get(n.id))
    }
  })

  it('el orden de los nodos en la entrada no cambia el resultado de cada nodo', () => {
    const ns = [node('a', 0), node('b', 0), node('c', 0)]
    const es = [edge('a', 'b'), edge('b', 'c')]
    const p1 = place(modelo(ns, es), { iterations: 30 })
    const p2 = place(modelo([...ns].reverse(), es), { iterations: 30 })
    // La posicion de partida depende del id, no del indice, asi que dar la vuelta a la lista no
    // reordena el dibujo.
    expect(p1.pos.get('a')).toEqual(p2.pos.get('a'))
  })
})

describe('place · las componentes no se pisan', () => {
  it('dos componentes acaban en cajas que no se solapan', () => {
    // El caso del corpus: una masa y varias islas. Con una fuerza global las islas salen despedidas
    // y su distancia deja de significar algo.
    const m = modelo(
      [node('a', 0), node('b', 0), node('c', 0), node('x', 1), node('y', 1)],
      [edge('a', 'b'), edge('b', 'c'), edge('x', 'y')],
    )
    const { boxes } = place(m, { iterations: 40 })
    expect(boxes).toHaveLength(2)
    const [p, q] = boxes
    const solapan =
      p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h
    expect(solapan).toBe(false)
  })

  it('la componente mayor va primero', () => {
    const m = modelo(
      [node('x', 1), node('y', 1), node('a', 0), node('b', 0), node('c', 0)],
      [edge('a', 'b'), edge('b', 'c'), edge('x', 'y')],
    )
    expect(place(m, { iterations: 20 }).boxes[0].n).toBe(3)
  })

  it('con muchas islas, se salta de fila en vez de crecer a lo ancho sin fin', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => node(`n${i}`, i))
    const { width, boxes } = place(modelo(nodes), { width: 600, iterations: 10 })
    expect(width).toBeLessThanOrEqual(900)
    expect(new Set(boxes.map((c) => c.y)).size).toBeGreaterThan(1)
  })
})

describe('place · lo degenerado, que en SVG no lanza sino que deja de pintar', () => {
  it('un grafo vacio no revienta', () => {
    const c = place(modelo([]), { iterations: 10 })
    expect(c.pos.size).toBe(0)
    expect(c.width).toBeGreaterThan(0)
  })

  it('un solo nodo tiene posicion finita', () => {
    const c = place(modelo([node('solo', 0)]), { iterations: 10 })
    const p = c.pos.get('solo')!
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
  })

  it('NINGUNA posicion es NaN, ni con nodos amontonados', () => {
    // Dos nodos exactamente encima darian division por cero en la repulsion. Un NaN en SVG no
    // lanza: el elemento simplemente no se dibuja, asi que se perderian nodos en silencio.
    const nodes = Array.from({ length: 12 }, (_, i) => node(`m${i}`, 0))
    const edges = nodes.slice(1).map((n) => edge('m0', n.id))
    const c = place(modelo(nodes, edges), { iterations: 60 })
    for (const [, p] of c.pos) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('una arista a un nodo que no esta en la componente no descoloca nada', () => {
    const m = modelo([node('a', 0), node('b', 0)], [edge('a', 'b'), edge('a', 'fuera')])
    const c = place(m, { iterations: 20 })
    expect(Number.isFinite(c.pos.get('a')!.x)).toBe(true)
  })
})
