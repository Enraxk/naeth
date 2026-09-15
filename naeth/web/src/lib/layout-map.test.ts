import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphResponse, TreeRow } from './types'

// Contrato del mapa de posiciones compartido.
//
// POR QUE ESTOS TESTS Y NO OTROS. Aqui vivio el peor bug del 05/09/2026: `requestMap` muta el estado
// que las vistas leen, asi que llamada desde un efecto reactivo se reinvocaba sola y hacia QUINCE
// peticiones a `/api/graph` por abrir una ficha. Se arreglo moviendo la guarda por delante de la
// red, y no habia nada que impidiera que volviera a ponerse detras. Eso es lo que fija el primer
// test.
//
// Es el primer test del repo que importa un modulo con runes (`.svelte.ts`). Funciona porque el
// plugin de Svelte esta en la config de Vitest y compila tambien estos ficheros; si algun dia deja
// de hacerlo, el sintoma sera un error de `$state` en la importacion, no un fallo de logica.

const getGraph = vi.fn()
vi.mock('./api', () => ({ getGraph: () => getGraph() }))

const arbol = vi.hoisted(() => ({ tree: null as TreeRow[] | null }))
vi.mock('./data.svelte', () => ({ data: arbol }))

const fila = (id: string): TreeRow => ({
  id,
  title: id,
  memory_type: 'fact',
  path: 'naeth/core',
  tags: [],
  created_at: '2026-09-01T10:00:00Z',
})

const respuesta = (edges: GraphResponse['edges'] = []): GraphResponse => ({
  nodes: 2,
  edges,
  links: {},
})

const arista = (a: string, b: string) => ({ source_id: a, target_id: b, predicate: 'links_to', n: 1 })

/**
 * El calculo se reparte en frames con `requestAnimationFrame`, que en Node no existe. Se sustituye
 * por una ejecucion inmediata, asi que en los tests el mapa queda listo en cuanto se resuelve la
 * promesa en vez de en cosa de un segundo.
 */
beforeEach(async () => {
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    fn(0)
    return 0
  })
  getGraph.mockReset()
  arbol.tree = [fila('a'), fila('b')]
  const { forgetMap } = await import('./layout-map.svelte')
  forgetMap()
})

describe('requestMap · una sola peticion', () => {
  it('DOS llamadas seguidas piden el grafo UNA vez', async () => {
    // El test de regresion de las quince peticiones. Si la guarda vuelve a quedar por detras de la
    // llamada de red, esto cae.
    getGraph.mockResolvedValue(respuesta([arista('a', 'b')]))
    const { requestMap } = await import('./layout-map.svelte')
    await requestMap()
    await requestMap()
    await requestMap()
    expect(getGraph).toHaveBeenCalledTimes(1)
  })

  it('deja el mapa listo y con una posicion por memoria', async () => {
    getGraph.mockResolvedValue(respuesta([arista('a', 'b')]))
    const { requestMap, layoutMap } = await import('./layout-map.svelte')
    await requestMap()
    expect(layoutMap.ready).toBe(true)
    expect(layoutMap.computing).toBe(false)
    expect([...layoutMap.pos.keys()].sort()).toEqual(['a', 'b'])
    for (const p of layoutMap.pos.values()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
    }
  })
})

describe('requestMap · cuando el corpus cambia', () => {
  it('con memorias nuevas SI se recalcula, sin volver a pedir el grafo', async () => {
    // El grafo solo se pide una vez por sesion; lo que cambia el mapa es la firma del corpus.
    getGraph.mockResolvedValue(respuesta([arista('a', 'b')]))
    const { requestMap, layoutMap } = await import('./layout-map.svelte')
    await requestMap()
    const v = layoutMap.version

    arbol.tree = [fila('a'), fila('b'), fila('c')]
    await requestMap()
    expect(getGraph).toHaveBeenCalledTimes(1)
    expect(layoutMap.version).toBeGreaterThan(v)
    expect(layoutMap.pos.has('c')).toBe(true)
  })

  it('las memorias que siguen estando CONSERVAN su posicion', async () => {
    // Es la conclusion del banco: mantener el mapa mueve la forma de lo que no ha cambiado tres
    // grados por jornada, y rehacerlo doce. Si esto cae, se esta rehaciendo.
    getGraph.mockResolvedValue(respuesta([arista('a', 'b')]))
    const { requestMap, layoutMap } = await import('./layout-map.svelte')
    await requestMap()
    const antes = new Map([...layoutMap.pos].map(([k, v]) => [k, { ...v }]))

    arbol.tree = [fila('a'), fila('b'), fila('c')]
    await requestMap()
    // No tienen por que quedarse clavadas (lo nuevo las empuja un poco), pero si cerca: rehacer
    // desde cero las mandaria a cualquier sitio.
    for (const [id, p] of antes) {
      const d = Math.hypot(layoutMap.pos.get(id)!.x - p.x, layoutMap.pos.get(id)!.y - p.y)
      expect(d).toBeLessThan(200)
    }
  })
})

describe('requestMap · lo que degrada sin romper', () => {
  it('sin arbol cargado no hace nada, y no pide el grafo', async () => {
    arbol.tree = null
    const { requestMap, layoutMap } = await import('./layout-map.svelte')
    await requestMap()
    expect(getGraph).not.toHaveBeenCalled()
    expect(layoutMap.ready).toBe(false)
  })

  it('si el grafo falla, el mapa se queda sin listo pero deja de calcular', async () => {
    // La ficha degrada a su vecindario propio. No es un error fatal y no puede dejar el estado
    // colgado en "calculando", que bloquearia todos los intentos posteriores.
    getGraph.mockRejectedValue(new Error('sin red'))
    const { requestMap, layoutMap } = await import('./layout-map.svelte')
    await requestMap()
    expect(layoutMap.ready).toBe(false)
    expect(layoutMap.computing).toBe(false)
  })

  it('tras un fallo, una llamada posterior vuelve a intentarlo', async () => {
    getGraph.mockRejectedValueOnce(new Error('sin red'))
    getGraph.mockResolvedValue(respuesta([arista('a', 'b')]))
    const { requestMap, layoutMap } = await import('./layout-map.svelte')
    await requestMap()
    await requestMap()
    expect(layoutMap.ready).toBe(true)
  })
})
