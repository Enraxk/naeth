import { describe, expect, it } from 'vitest'
import { colocar } from './layout'
import type { GraphEdge, GraphModel, GraphNode } from './graph'

// Contrato de la colocacion.
//
// Lo que se prueba NO es que quede bonito, que eso se mira. Se prueba lo que puede romperse sin
// que nadie lo vea: que el dibujo sea el mismo entre recargas, que las componentes no se pisen, y
// que un caso degenerado no produzca NaN, que en SVG no lanza nada y simplemente deja de pintar.

const nodo = (id: string, component: number): GraphNode => ({
  id,
  title: id,
  path: 'naeth/core',
  project: 'naeth',
  memory_type: 'fact',
  degree: 1,
  component,
})

const arista = (source: string, target: string): GraphEdge => ({
  source,
  target,
  layer: 'relation',
})

const modelo = (nodes: GraphNode[], edges: GraphEdge[] = []): GraphModel => ({
  nodes,
  edges,
  aislados: 0,
  componentes: new Set(nodes.map((n) => n.component)).size,
})

describe('colocar · determinismo', () => {
  it('el mismo grafo se coloca IGUAL dos veces', () => {
    // Es la razon de que las posiciones de partida salgan de un PRNG sembrado con el id y no de
    // Math.random. Un layout que cambia en cada recarga obliga a reorientarse cada vez.
    const m = modelo(
      [nodo('a', 0), nodo('b', 0), nodo('c', 0), nodo('d', 0)],
      [arista('a', 'b'), arista('b', 'c'), arista('c', 'd')],
    )
    const p1 = colocar(m, { iteraciones: 30 })
    const p2 = colocar(m, { iteraciones: 30 })
    for (const n of m.nodes) {
      expect(p1.pos.get(n.id)).toEqual(p2.pos.get(n.id))
    }
  })

  it('el orden de los nodos en la entrada no cambia el resultado de cada nodo', () => {
    const ns = [nodo('a', 0), nodo('b', 0), nodo('c', 0)]
    const es = [arista('a', 'b'), arista('b', 'c')]
    const p1 = colocar(modelo(ns, es), { iteraciones: 30 })
    const p2 = colocar(modelo([...ns].reverse(), es), { iteraciones: 30 })
    // La posicion de partida depende del id, no del indice, asi que dar la vuelta a la lista no
    // reordena el dibujo.
    expect(p1.pos.get('a')).toEqual(p2.pos.get('a'))
  })
})

describe('colocar · las componentes no se pisan', () => {
  it('dos componentes acaban en cajas que no se solapan', () => {
    // El caso del corpus: una masa y varias islas. Con un force global las islas salen despedidas
    // y su distancia deja de significar algo.
    const m = modelo(
      [nodo('a', 0), nodo('b', 0), nodo('c', 0), nodo('x', 1), nodo('y', 1)],
      [arista('a', 'b'), arista('b', 'c'), arista('x', 'y')],
    )
    const { cajas } = colocar(m, { iteraciones: 40 })
    expect(cajas).toHaveLength(2)
    const [p, q] = cajas
    const solapan =
      p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h
    expect(solapan).toBe(false)
  })

  it('la componente mayor va primero', () => {
    const m = modelo(
      [nodo('x', 1), nodo('y', 1), nodo('a', 0), nodo('b', 0), nodo('c', 0)],
      [arista('a', 'b'), arista('b', 'c'), arista('x', 'y')],
    )
    expect(colocar(m, { iteraciones: 20 }).cajas[0].n).toBe(3)
  })

  it('con muchas islas, se salta de fila en vez de crecer a lo ancho sin fin', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => nodo(`n${i}`, i))
    const { ancho, cajas } = colocar(modelo(nodes), { ancho: 600, iteraciones: 10 })
    expect(ancho).toBeLessThanOrEqual(900)
    expect(new Set(cajas.map((c) => c.y)).size).toBeGreaterThan(1)
  })
})

describe('colocar · lo degenerado, que en SVG no lanza sino que deja de pintar', () => {
  it('un grafo vacio no revienta', () => {
    const c = colocar(modelo([]), { iteraciones: 10 })
    expect(c.pos.size).toBe(0)
    expect(c.ancho).toBeGreaterThan(0)
  })

  it('un solo nodo tiene posicion finita', () => {
    const c = colocar(modelo([nodo('solo', 0)]), { iteraciones: 10 })
    const p = c.pos.get('solo')!
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
  })

  it('NINGUNA posicion es NaN, ni con nodos amontonados', () => {
    // Dos nodos exactamente encima darian division por cero en la repulsion. Un NaN en SVG no
    // lanza: el elemento simplemente no se dibuja, asi que se perderian nodos en silencio.
    const nodes = Array.from({ length: 12 }, (_, i) => nodo(`m${i}`, 0))
    const edges = nodes.slice(1).map((n) => arista('m0', n.id))
    const c = colocar(modelo(nodes, edges), { iteraciones: 60 })
    for (const [, p] of c.pos) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('una arista a un nodo que no esta en la componente no descoloca nada', () => {
    const m = modelo([nodo('a', 0), nodo('b', 0)], [arista('a', 'b'), arista('a', 'fuera')])
    const c = colocar(m, { iteraciones: 20 })
    expect(Number.isFinite(c.pos.get('a')!.x)).toBe(true)
  })
})
