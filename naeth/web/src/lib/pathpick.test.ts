import { describe, it, expect } from 'vitest'
import { rankPaths } from './pathpick'
import { MAX_HITS } from './wikipick'
import type { TreeRow } from './types'

/** Fila minima: para este ranking solo importa `path`. */
const row = (path: string | null, id = Math.random().toString(36).slice(2)): TreeRow => ({
  id,
  title: 'da igual',
  memory_type: 'fact',
  path,
  tags: [],
  created_at: '2026-01-01',
})

/** `n` filas colgando de la misma ruta, que es como se fabrica un conteo. */
const rows = (spec: Record<string, number>): TreeRow[] =>
  Object.entries(spec).flatMap(([path, n]) => Array.from({ length: n }, () => row(path)))

const paths = (hits: { path: string }[]) => hits.map((h) => h.path)

describe('rankPaths', () => {
  it('sin consulta devuelve las rutas mas usadas primero', () => {
    const t = rows({ 'cenit/build': 19, 'naeth/status': 2, 'eneko/method': 37 })
    expect(paths(rankPaths('', t))).toEqual(['eneko/method', 'cenit/build', 'naeth/status'])
  })

  it('cuenta las memorias de cada ruta, no las rutas', () => {
    const t = rows({ 'cenit/build': 19, 'naeth/status': 2 })
    expect(rankPaths('', t)).toEqual([
      { path: 'cenit/build', count: 19 },
      { path: 'naeth/status', count: 2 },
    ])
  })

  it('busca por palabras salteadas: "cenit bu" encuentra "cenit/build"', () => {
    // El caso que justifica el ranking por tokens. Con un `includes` de la cadena entera no lo
    // encontraria, porque la `/` de en medio parte la coincidencia.
    const t = rows({ 'cenit/build': 19, 'naeth/viewer': 3 })
    expect(paths(rankPaths('cenit bu', t))).toEqual(['cenit/build'])
  })

  it('una consulta con la barra dentro tambien vale', () => {
    const t = rows({ 'cenit/build': 19, 'cenit/security': 7 })
    expect(paths(rankPaths('cenit/se', t))).toEqual(['cenit/security'])
  })

  it('exige TODAS las palabras, no cualquiera de ellas', () => {
    const t = rows({ 'cenit/build': 19 })
    expect(rankPaths('cenit inexistente', t)).toEqual([])
  })

  it('empezar por lo tecleado gana a contenerlo, aunque tenga menos memorias', () => {
    // El rango manda sobre el conteo: si no, escribir "naeth" ofreceria antes una ruta
    // gorda que solo lo menciona que la que de verdad empieza asi.
    const t = rows({ 'x/naeth-cosas': 50, 'naeth/core': 3 })
    expect(paths(rankPaths('naeth', t))).toEqual(['naeth/core', 'x/naeth-cosas'])
  })

  it('a igualdad de rango desempata la ruta con mas memorias', () => {
    const t = rows({ 'cenit/build': 19, 'cenit/design': 11, 'cenit/infra': 16 })
    expect(paths(rankPaths('cenit', t))).toEqual(['cenit/build', 'cenit/infra', 'cenit/design'])
  })

  it('a igualdad de conteo desempata el orden alfabetico, para que la lista no baile', () => {
    const t = rows({ 'cenit/infra': 5, 'cenit/build': 5, 'cenit/design': 5 })
    expect(paths(rankPaths('cenit', t))).toEqual(['cenit/build', 'cenit/design', 'cenit/infra'])
  })

  it('encuentra sin tildes lo que las lleva, y al reves', () => {
    const t = rows({ 'formacion/materials': 4 })
    expect(paths(rankPaths('formación', t))).toEqual(['formacion/materials'])
    const t2 = rows({ 'formación/materials': 4 })
    expect(paths(rankPaths('formacion', t2))).toEqual(['formación/materials'])
  })

  it('descarta las filas sin ruta en vez de inventarles una', () => {
    const t = [row(null), row('   '), row('naeth/core')]
    expect(paths(rankPaths('', t))).toEqual(['naeth/core'])
  })

  it('corta en MAX_HITS', () => {
    const t = Array.from({ length: 20 }, (_, i) => row('proj/sub' + i))
    expect(rankPaths('proj', t)).toHaveLength(MAX_HITS)
  })

  it('respeta un limite explicito', () => {
    const t = Array.from({ length: 20 }, (_, i) => row('proj/sub' + i))
    expect(rankPaths('proj', t, { limit: 3 })).toHaveLength(3)
  })

  it('ignora los espacios de alrededor', () => {
    const t = rows({ 'naeth/core': 3 })
    expect(paths(rankPaths('  naeth  ', t))).toEqual(['naeth/core'])
  })

  it('una ruta que todavia no existe no ofrece nada, y eso no es un error', () => {
    // Es el caso normal: se esta escribiendo una ruta nueva. El campo es libre y guarda igual.
    const t = rows({ 'naeth/core': 3 })
    expect(rankPaths('proyecto-nuevo/sub', t)).toEqual([])
  })

  it('no revienta con el arbol vacio', () => {
    expect(rankPaths('lo que sea', [])).toEqual([])
  })

  it('no muta el array que recibe', () => {
    const t = [row('b/dos'), row('a/uno')]
    const antes = t.map((r) => r.path)
    rankPaths('', t)
    expect(t.map((r) => r.path)).toEqual(antes)
  })
})
