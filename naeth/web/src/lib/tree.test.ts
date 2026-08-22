import { describe, expect, it } from 'vitest'
import type { TreeRow } from './types'
import { buildTree } from './tree'

// Contrato del agrupado del arbol: `path` es `proyecto/subtema`, dos niveles, y de ahi salen las
// dos ramas de la sidebar. Lo que se fija aqui es que un path incompleto degrade a un sitio
// concreto en vez de perder la nota, y que los tres modos de orden hagan lo que dicen.

const row = (id: string, path: string | null, title: string, created_at: string): TreeRow => ({
  id,
  title,
  memory_type: 'fact',
  path,
  tags: [],
  created_at,
})

/**
 * Aplana el arbol a `[proyecto, [[subtema, [ids]]]]`.
 *
 * Existe para que los tests dependan de la FORMA del arbol y no de como se llamen sus campos. Se
 * gano el sueldo el 22/08/2026, cuando el segundo nivel paso de `origins`/`origin` a
 * `subtopics`/`subtopic`: el renombrado toco esta funcion y ni uno solo de los `expect` de abajo.
 */
const shape = (rows: TreeRow[], sort: 'az' | 'date-desc' | 'date-asc') =>
  buildTree(rows, sort).map(
    (p) => [p.proj, p.subtopics.map((s) => [s.subtopic, s.leaves.map((l) => l.id)])] as const,
  )

const NAE_1 = row('n1', 'naeth/viewer', 'Zeta del visor', '2026-07-10T10:00:00Z')
const NAE_2 = row('n2', 'naeth/viewer', 'Alfa del visor', '2026-07-20T10:00:00Z')
const NAE_3 = row('n3', 'naeth/core', 'Cola de embeddings', '2026-07-05T10:00:00Z')
const CEN_1 = row('c1', 'cenit/build', 'Reconciler', '2026-08-01T10:00:00Z')

describe('buildTree · agrupado en dos niveles', () => {
  it('agrupa por proyecto y por subtema', () => {
    expect(shape([NAE_1, NAE_2, NAE_3, CEN_1], 'az')).toEqual([
      ['cenit', [['build', ['c1']]]],
      ['naeth', [['core', ['n3']], ['viewer', ['n2', 'n1']]]],
    ])
  })

  it('un path sin segundo nivel cae en el subtema "·", no se pierde', () => {
    expect(shape([row('x', 'suelto', 'Sin subtema', '2026-07-01T10:00:00Z')], 'az')).toEqual([
      ['suelto', [['·', ['x']]]],
    ])
  })

  it('un path nulo cae en "(sin path)" en los dos niveles', () => {
    expect(shape([row('x', null, 'Huerfana', '2026-07-01T10:00:00Z')], 'az')).toEqual([
      ['(sin path)', [['·', ['x']]]],
    ])
  })

  it('una cadena vacia como path se trata igual que un path nulo', () => {
    expect(shape([row('x', '', 'Huerfana', '2026-07-01T10:00:00Z')], 'az')).toEqual([
      ['(sin path)', [['·', ['x']]]],
    ])
  })

  it('un arbol vacio devuelve una lista vacia', () => {
    expect(buildTree([], 'az')).toEqual([])
  })
})

describe('buildTree · los tres modos de orden', () => {
  const TODO = [NAE_1, NAE_2, NAE_3, CEN_1]

  it('az · proyectos, subtemas y hojas por nombre', () => {
    const t = shape(TODO, 'az')
    expect(t.map(([proj]) => proj)).toEqual(['cenit', 'naeth'])
    // Dentro de naeth/viewer: "Alfa del visor" antes que "Zeta del visor".
    expect(t[1][1][1][1]).toEqual(['n2', 'n1'])
  })

  it('date-desc · lo mas reciente primero, en los tres niveles', () => {
    const t = shape(TODO, 'date-desc')
    // cenit tiene la nota mas nueva (01/08) y por eso encabeza.
    expect(t.map(([proj]) => proj)).toEqual(['cenit', 'naeth'])
    const naeth = t[1][1]
    expect(naeth.map(([sub]) => sub)).toEqual(['viewer', 'core'])
    expect(naeth[0][1]).toEqual(['n2', 'n1'])
  })

  it('date-asc · lo mas antiguo primero, en los tres niveles', () => {
    const t = shape(TODO, 'date-asc')
    expect(t.map(([proj]) => proj)).toEqual(['naeth', 'cenit'])
    const naeth = t[0][1]
    expect(naeth.map(([sub]) => sub)).toEqual(['core', 'viewer'])
    expect(naeth[0 + 1][1]).toEqual(['n1', 'n2'])
  })
})

describe('buildTree · la fecha que se muestra en la fila', () => {
  it('`mod` de un grupo es siempre la fecha MAS RECIENTE de lo que contiene', () => {
    // `mod` es lo que pinta la sidebar al pasar por encima, e independientemente del orden
    // elegido tiene que responder "cuando se toco esto por ultima vez".
    for (const sort of ['az', 'date-desc', 'date-asc'] as const) {
      const naeth = buildTree([NAE_1, NAE_2, NAE_3], sort).find((p) => p.proj === 'naeth')!
      expect(naeth.mod).toBe('2026-07-20T10:00:00Z')
    }
  })

  it('una fila sin fecha no rompe el agrupado', () => {
    const sinFecha: TreeRow = { ...NAE_1, id: 'nf', created_at: null }
    expect(() => buildTree([sinFecha, NAE_2], 'date-desc')).not.toThrow()
    expect(buildTree([sinFecha, NAE_2], 'date-desc')[0].proj).toBe('naeth')
  })
})
