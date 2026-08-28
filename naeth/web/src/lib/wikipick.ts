import type { TreeRow } from './types'

/**
 * Ranking de candidatos del selector de `[[wikilinks]]`.
 *
 * Vivia dentro de `Memoria.svelte` como un `$derived.by` de treinta lineas, sin tests y sin
 * forma de ejercitarlo salvo abriendo el editor y tecleando. Se saca aqui porque la vista de
 * alta necesita exactamente el mismo comportamiento: si se copiaba, cualquier arreglo futuro
 * habria que hacerlo dos veces, y este repo ya tiene la cicatriz de eso.
 *
 * Es funcion pura a proposito: ni estado, ni DOM, ni red. Todo lo que decide que se enlaza y
 * que no cabe en los tests de al lado.
 */

/** Cuantos candidatos ve el usuario de una vez. */
export const MAX_HITS = 8

/**
 * Marcas diacriticas combinantes (U+0300 a U+036F), las que deja sueltas `normalize('NFD')`.
 * Escrito con escapes y no con el rango literal: entre editores, consolas y `git` el rango
 * literal viaja mal, y un regex con un caracter invisible corrompido no falla en voz alta,
 * simplemente deja de plegar acentos.
 */
const DIACRITICOS = /[̀-ͯ]/g

/**
 * Sin acentos y en minusculas. Los titulos del corpus van llenos de tildes y de `·`, asi que
 * comparar en crudo deja fuera resultados obvios: buscar "migracion" no encontraria
 * "Naeth: migracion de paths" si el titulo lleva tilde.
 */
export const fold = (s: string): string =>
  s.normalize('NFD').replace(DIACRITICOS, '').toLowerCase()

/**
 * Ordena las memorias que casan con lo tecleado tras `[[`.
 *
 * Se busca por PALABRAS y no por cadena literal: escribir "CENIT vigilancia" tiene que
 * encontrar "CENIT · vigilancia de hostnames", y con un `includes` del texto entero no lo
 * encuentra, porque el `· ` de en medio rompe la coincidencia.
 *
 * Empezar por lo tecleado vale mas que contenerlo: al escribir "cenit" interesa antes el
 * titulo que arranca asi que uno que lo menciona a mitad. A igualdad de rango gana la mas
 * reciente, que es casi siempre la que se estaba mirando.
 */
export function rankWikiCandidates(
  query: string,
  rows: readonly TreeRow[],
  opts: { excludeId?: string; limit?: number } = {},
): TreeRow[] {
  const { excludeId, limit = MAX_HITS } = opts
  const q = fold(query.trim())
  const tokens = q.split(/\s+/).filter(Boolean)

  const scored = rows
    // Una nota no se enlaza a si misma, y una fila sin titulo no se puede ni mostrar ni escribir.
    .filter((r) => r.id !== excludeId && r.title)
    .map((r) => {
      const t = fold(r.title ?? '')
      const rank = !tokens.length ? 2 : t.startsWith(q) ? 0 : tokens.every((k) => t.includes(k)) ? 1 : -1
      return { r, rank }
    })
    .filter((x) => x.rank >= 0)

  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      String(b.r.created_at || '').localeCompare(String(a.r.created_at || '')),
  )

  return scored.slice(0, limit).map((x) => x.r)
}
