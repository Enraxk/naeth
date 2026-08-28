import { describe, it, expect } from 'vitest'
import { rankWikiCandidates, fold, MAX_HITS } from './wikipick'
import type { TreeRow } from './types'

/** Fila minima: solo importan id, title y created_at para el ranking. */
const row = (id: string, title: string | null, created_at = '2026-01-01'): TreeRow => ({
  id,
  title,
  memory_type: 'fact',
  path: 'p/s',
  tags: [],
  created_at,
})

describe('fold', () => {
  it('quita tildes y baja a minusculas', () => {
    expect(fold('Migración')).toBe('migracion')
    expect(fold('CENIT · Vigía')).toBe('cenit · vigia')
  })

  it('cubre las cinco vocales acentuadas, la enye y la dieresis', () => {
    expect(fold('áéíóú ñ ü')).toBe('aeiou n u')
  })

  it('deja intacto lo que no lleva diacriticos', () => {
    expect(fold('naeth/status')).toBe('naeth/status')
  })
})

describe('rankWikiCandidates', () => {
  it('sin consulta devuelve todo, de mas reciente a mas antigua', () => {
    const rows = [
      row('a', 'Antigua', '2026-01-01'),
      row('b', 'Reciente', '2026-08-01'),
      row('c', 'Media', '2026-04-01'),
    ]
    expect(rankWikiCandidates('', rows).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('empezar por lo tecleado gana a contenerlo', () => {
    const rows = [
      row('mid', 'Sobre CENIT y el vigia'),
      row('start', 'CENIT · el canal de avisos'),
    ]
    expect(rankWikiCandidates('cenit', rows).map((r) => r.id)).toEqual(['start', 'mid'])
  })

  it('busca por palabras sueltas, saltandose lo que hay en medio', () => {
    // El caso que motivo el ranking por tokens: un `includes` de la cadena entera no lo
    // encuentra porque el separador `· ` parte la coincidencia.
    const rows = [row('x', 'CENIT · vigilancia de hostnames')]
    expect(rankWikiCandidates('cenit vigilancia', rows).map((r) => r.id)).toEqual(['x'])
  })

  it('exige TODAS las palabras, no cualquiera de ellas', () => {
    const rows = [row('x', 'CENIT · vigilancia de hostnames')]
    expect(rankWikiCandidates('cenit inexistente', rows)).toEqual([])
  })

  it('encuentra aunque la consulta vaya sin tildes y el titulo las lleve', () => {
    const rows = [row('x', 'Naeth · migración de paths')]
    expect(rankWikiCandidates('migracion', rows).map((r) => r.id)).toEqual(['x'])
  })

  it('y al reves: consulta con tilde contra titulo sin ella', () => {
    const rows = [row('x', 'Naeth migracion de paths')]
    expect(rankWikiCandidates('migración', rows).map((r) => r.id)).toEqual(['x'])
  })

  it('excluye la nota que se esta editando: una memoria no se enlaza a si misma', () => {
    const rows = [row('yo', 'CENIT · algo'), row('otra', 'CENIT · otra cosa')]
    expect(rankWikiCandidates('cenit', rows, { excludeId: 'yo' }).map((r) => r.id)).toEqual(['otra'])
  })

  it('descarta las filas sin titulo, que no se podrian ni mostrar ni escribir', () => {
    // En el corpus real hay dos memorias sin titulo, en cenit/build.
    const rows = [row('sin', null), row('con', 'CENIT · con titulo')]
    expect(rankWikiCandidates('', rows).map((r) => r.id)).toEqual(['con'])
  })

  it('corta en MAX_HITS', () => {
    const rows = Array.from({ length: 20 }, (_, i) => row('id' + i, 'Nota ' + i))
    expect(rankWikiCandidates('nota', rows)).toHaveLength(MAX_HITS)
  })

  it('respeta un limite explicito', () => {
    const rows = Array.from({ length: 20 }, (_, i) => row('id' + i, 'Nota ' + i))
    expect(rankWikiCandidates('nota', rows, { limit: 3 })).toHaveLength(3)
  })

  it('a igualdad de rango desempata la mas reciente', () => {
    const rows = [
      row('vieja', 'CENIT arranca', '2026-01-01'),
      row('nueva', 'CENIT termina', '2026-08-01'),
    ]
    expect(rankWikiCandidates('cenit', rows).map((r) => r.id)).toEqual(['nueva', 'vieja'])
  })

  it('el rango manda sobre la fecha: un prefijo viejo gana a una coincidencia nueva', () => {
    const rows = [
      row('contiene', 'Sobre CENIT, hoy mismo', '2026-08-01'),
      row('empieza', 'CENIT de hace meses', '2026-01-01'),
    ]
    expect(rankWikiCandidates('cenit', rows).map((r) => r.id)).toEqual(['empieza', 'contiene'])
  })

  it('ignora los espacios de alrededor', () => {
    const rows = [row('x', 'CENIT · algo')]
    expect(rankWikiCandidates('  cenit  ', rows).map((r) => r.id)).toEqual(['x'])
  })

  it('una consulta que no casa con nada devuelve lista vacia', () => {
    const rows = [row('x', 'CENIT · algo')]
    expect(rankWikiCandidates('zzzz', rows)).toEqual([])
  })

  it('no revienta con el arbol vacio', () => {
    expect(rankWikiCandidates('lo que sea', [])).toEqual([])
  })

  it('no muta el array que recibe', () => {
    const rows = [row('a', 'B nota', '2026-01-01'), row('b', 'A nota', '2026-08-01')]
    const antes = rows.map((r) => r.id)
    rankWikiCandidates('nota', rows)
    expect(rows.map((r) => r.id)).toEqual(antes)
  })
})
