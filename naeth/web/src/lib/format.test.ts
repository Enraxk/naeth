import { describe, expect, it } from 'vitest'
import type { Author } from './types'
import { fmtAuthor, fmtLag } from './format'

// Los casos de `fmtAuthor` son las OCHO combinaciones que de verdad existen hoy en el corpus,
// leidas de `GET /api/authors` el 21/08/2026. No son ejemplos inventados: la mitad de las notas
// (207 de 411) son anteriores al backfill del Paso 10 y llegan sin modelo, asi que el escalon de
// degradacion es el caso comun, no el raro.

const author = (over: Author): Author => ({ actor: 'agent', ...over })

describe('fmtAuthor · las combinaciones reales del corpus', () => {
  it('producto y modelo, sin repetir la palabra claude (142 notas)', () => {
    expect(fmtAuthor(author({ product: 'claude-code', surface: 'code', model: 'claude-opus-5' })))
      .toBe('claude-code · opus-5')
  })

  it('claude-ai con modelo (33 notas)', () => {
    expect(fmtAuthor(author({ product: 'claude-ai', surface: 'web', model: 'claude-opus-5' })))
      .toBe('claude-ai · opus-5')
  })

  it('un modelo con version de dos numeros no se recorta de mas (19 notas)', () => {
    expect(fmtAuthor(author({ product: 'claude-code', model: 'claude-opus-4-8' })))
      .toBe('claude-code · opus-4-8')
  })

  it('legado sin modelo: queda el producto solo, nunca "undefined" (134 + 73 notas)', () => {
    expect(fmtAuthor(author({ product: 'claude-ai', model: null }))).toBe('claude-ai')
    expect(fmtAuthor(author({ product: 'claude-code', model: null }))).toBe('claude-code')
  })

  it('lo escrito a mano por Eneko desde el propio visor (1 nota)', () => {
    expect(fmtAuthor(author({ product: 'naeth-web', surface: 'visor', actor: 'human' })))
      .toBe('Eneko')
  })
})

describe('fmtAuthor · lo que no se pinta', () => {
  it('sin autoria devuelve cadena vacia, para que el llamante omita tambien el separador', () => {
    expect(fmtAuthor(null)).toBe('')
    expect(fmtAuthor(undefined)).toBe('')
    expect(fmtAuthor({})).toBe('')
  })

  it('un producto vacio o en blanco cuenta como no tener autoria', () => {
    expect(fmtAuthor(author({ product: '', model: 'claude-opus-5' }))).toBe('')
    expect(fmtAuthor(author({ product: '   ' }))).toBe('')
  })

  it('un modelo que no empieza por claude- se muestra tal cual', () => {
    // No se asume el vendor: el dia que escriba otro agente, su modelo no debe salir mutilado.
    expect(fmtAuthor(author({ product: 'algun-agente', model: 'llama-4' })))
      .toBe('algun-agente · llama-4')
  })
})

describe('fmtLag · el retardo de la cola en el pie', () => {
  it('sin dato pinta un guion, no un cero enganoso', () => {
    expect(fmtLag(null)).toBe('-')
    expect(fmtLag(undefined)).toBe('-')
  })

  it('por debajo del segundo va en milisegundos', () => {
    expect(fmtLag(0.25)).toBe('250 ms')
  })

  it('a partir del segundo va en segundos con un decimal', () => {
    expect(fmtLag(1)).toBe('1.0 s')
    expect(fmtLag(3957.401691)).toBe('3957.4 s')
  })
})
