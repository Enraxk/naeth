import type { TreeRow } from './types'
import { fold, MAX_HITS } from './wikipick'

/**
 * Ranking de rutas para el campo `proyecto/subtema`.
 *
 * Hermano de `wikipick.ts`, y a proposito: el campo de ruta y el selector de `[[wikilinks]]`
 * resuelven el mismo problema (filtrar una lista larga con lo que se va tecleando), asi que
 * comparten criterio y comparten el `fold`. Lo que NO comparten es el desempate, y ahi esta la
 * unica diferencia de verdad: ver abajo.
 *
 * El campo sigue siendo un input libre. Esto ORDENA sugerencias, no las impone: escribir una ruta
 * que no existe todavia es el caso normal y no la excepcion. Medido el 28/08/2026, el corpus tiene
 * 81 rutas y treinta de ellas cuelgan de una sola memoria, o sea que las rutas nuevas nacen a
 * menudo. Una lista cerrada seria un error.
 */

/** Una ruta del corpus y cuantas memorias vigentes cuelgan de ella. */
export interface PathHit {
  path: string
  count: number
}

/**
 * Agrupa las filas del arbol por `path`, descartando las que no lo tienen.
 *
 * `TreeRow.path` es `string | null`, y aunque hoy no haya ni una fila sin ruta (462 de 462 la
 * tienen, y con dos niveles), el tipo manda sobre el dato: una fila sin path no puede sugerirse
 * ni contarse.
 */
function countByPath(rows: readonly TreeRow[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    const p = (r.path ?? '').trim()
    if (!p) continue
    m.set(p, (m.get(p) ?? 0) + 1)
  }
  return m
}

/**
 * Ordena las rutas que casan con lo tecleado.
 *
 * El criterio de rango es el mismo que `rankWikiCandidates`: sin consulta pasa todo, empezar por
 * lo tecleado vale mas que contenerlo, y se busca POR PALABRAS y no por cadena literal. Esto
 * ultimo es lo que hace que `cenit bu` encuentre `cenit/build`: con un `includes` de la cadena
 * entera no lo encontraria, porque la `/` de en medio parte la coincidencia.
 *
 * EL DESEMPATE ES LO QUE CAMBIA: en los wikilinks gana la memoria mas reciente, porque casi
 * siempre es la que se estaba mirando. Aqui gana LA RUTA CON MAS MEMORIAS, porque lo que se busca
 * es el sitio habitual donde va la nota. A igualdad de conteo, orden alfabetico, para que la lista
 * no baile entre dos renders con los mismos datos.
 */
export function rankPaths(
  query: string,
  rows: readonly TreeRow[],
  opts: { limit?: number } = {},
): PathHit[] {
  const { limit = MAX_HITS } = opts
  const q = fold(query.trim())
  const tokens = q.split(/\s+/).filter(Boolean)

  const scored: { hit: PathHit; rank: number }[] = []
  for (const [path, count] of countByPath(rows)) {
    const p = fold(path)
    const rank = !tokens.length ? 2 : p.startsWith(q) ? 0 : tokens.every((k) => p.includes(k)) ? 1 : -1
    if (rank >= 0) scored.push({ hit: { path, count }, rank })
  }

  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      b.hit.count - a.hit.count ||
      a.hit.path.localeCompare(b.hit.path, 'es', { sensitivity: 'base' }),
  )

  return scored.slice(0, limit).map((x) => x.hit)
}
